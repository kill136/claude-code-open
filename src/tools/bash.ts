/**
 * Bash 工具
 * 执行 shell 命令，支持沙箱隔离
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import { executeInSandbox, isBubblewrapAvailable } from './sandbox.js';
import { runPreToolUseHooks, runPostToolUseHooks } from '../hooks/index.js';
import type { BashInput, BashResult, ToolDefinition } from '../types/index.js';

const execAsync = promisify(exec);

// 后台 shell 管理
interface ShellState {
  process: ReturnType<typeof spawn>;
  output: string[];
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  timeout?: NodeJS.Timeout;
  maxRuntime?: number;
  outputSize: number;
  command: string;
}

const backgroundShells: Map<string, ShellState> = new Map();

// 配置
const MAX_OUTPUT_LENGTH = parseInt(process.env.BASH_MAX_OUTPUT_LENGTH || '30000', 10);
const DEFAULT_TIMEOUT = 120000;
const MAX_TIMEOUT = 600000;
const MAX_BACKGROUND_OUTPUT = 10 * 1024 * 1024; // 10MB per background shell
const MAX_BACKGROUND_SHELLS = parseInt(process.env.BASH_MAX_BACKGROUND_SHELLS || '10', 10);
const BACKGROUND_SHELL_MAX_RUNTIME = parseInt(process.env.BASH_BACKGROUND_MAX_RUNTIME || '3600000', 10); // 1 hour

// 危险命令黑名单
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  'fork bomb',
  ':(){ :|:& };:',
  'chmod -R 777 /',
  'chown -R',
];

// 需要警告的命令模式
const WARNING_PATTERNS = [
  /rm\s+-rf/,
  /sudo\s+rm/,
  /chmod\s+777/,
  /eval\s+/,
  /exec\s+/,
  /\|\s*sh/,
  /curl.*\|\s*bash/,
  /wget.*\|\s*sh/,
];

// 命令审计日志
interface AuditLog {
  timestamp: number;
  command: string;
  cwd: string;
  sandboxed: boolean;
  success: boolean;
  exitCode?: number;
  duration: number;
  outputSize: number;
  background: boolean;
}

const auditLogs: AuditLog[] = [];
const MAX_AUDIT_LOGS = 1000;

/**
 * 检查命令是否安全
 */
function checkCommandSafety(command: string): { safe: boolean; reason?: string; warning?: string } {
  // 检查危险命令
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (command.includes(dangerous)) {
      return { safe: false, reason: `Dangerous command detected: ${dangerous}` };
    }
  }

  // 检查警告模式
  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(command)) {
      return {
        safe: true,
        warning: `Potentially dangerous command pattern detected: ${pattern}. Use with caution.`,
      };
    }
  }

  return { safe: true };
}

/**
 * 记录审计日志
 */
function recordAudit(log: AuditLog): void {
  auditLogs.push(log);

  // 限制日志大小
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOGS);
  }

  // 可选：写入文件
  if (process.env.BASH_AUDIT_LOG_FILE) {
    try {
      const logLine = JSON.stringify(log) + '\n';
      fs.appendFileSync(process.env.BASH_AUDIT_LOG_FILE, logLine);
    } catch (err) {
      // 忽略日志写入错误
      console.error('Failed to write audit log:', err);
    }
  }
}

/**
 * 清理超时的后台 shell
 */
function cleanupTimedOutShells(): number {
  let cleaned = 0;
  const now = Date.now();

  Array.from(backgroundShells.entries()).forEach(([id, shell]) => {
    if (shell.maxRuntime && now - shell.startTime > shell.maxRuntime) {
      try {
        shell.process.kill('SIGTERM');
        setTimeout(() => {
          if (shell.status === 'running') {
            shell.process.kill('SIGKILL');
          }
        }, 1000);
        backgroundShells.delete(id);
        cleaned++;
      } catch (err) {
        console.error(`Failed to cleanup shell ${id}:`, err);
      }
    }
  });

  return cleaned;
}

export class BashTool extends BaseTool<BashInput, BashResult> {
  name = 'Bash';
  description = `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

IMPORTANT: This tool is for terminal operations like git, npm, docker, etc. DO NOT use it for file operations (reading, writing, editing, searching, finding files) - use the specialized tools for this instead.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first use 'ls' to verify the parent directory exists

2. Command Execution:
   - Always quote file paths that contain spaces with double quotes
   - After ensuring proper quoting, execute the command

Usage notes:
  - The command argument is required.
  - Optional timeout in milliseconds (up to 600000ms / 10 minutes). Default: 120000ms (2 minutes).
  - Use run_in_background to run commands in the background.
  - Output exceeding ${MAX_OUTPUT_LENGTH} characters will be truncated.
  - Set dangerouslyDisableSandbox to true to run without sandboxing (use with caution).

Sandbox: ${isBubblewrapAvailable() ? 'Available (bubblewrap)' : 'Not available'}`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Optional timeout in milliseconds (max 600000)',
        },
        description: {
          type: 'string',
          description: 'Clear, concise description of what this command does in 5-10 words',
        },
        run_in_background: {
          type: 'boolean',
          description: 'Run command in the background',
        },
        dangerouslyDisableSandbox: {
          type: 'boolean',
          description: 'Disable sandbox mode (dangerous)',
        },
      },
      required: ['command'],
    };
  }

  async execute(input: BashInput): Promise<BashResult> {
    const {
      command,
      timeout = DEFAULT_TIMEOUT,
      run_in_background = false,
      dangerouslyDisableSandbox = false,
    } = input;

    const startTime = Date.now();
    const maxTimeout = Math.min(timeout, MAX_TIMEOUT);

    // 安全检查
    const safetyCheck = checkCommandSafety(command);
    if (!safetyCheck.safe) {
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: false,
        success: false,
        duration: 0,
        outputSize: 0,
        background: run_in_background,
      };
      recordAudit(auditLog);

      return {
        success: false,
        error: `Command blocked for security reasons: ${safetyCheck.reason}`,
      };
    }

    // 记录警告
    if (safetyCheck.warning) {
      console.warn(`[Bash Security Warning] ${safetyCheck.warning}`);
    }

    // 运行 pre-tool hooks
    const hookResult = await runPreToolUseHooks('Bash', input);
    if (!hookResult.allowed) {
      return {
        success: false,
        error: `Blocked by hook: ${hookResult.message || 'Operation not allowed'}`,
      };
    }

    // 后台执行
    if (run_in_background) {
      return this.executeBackground(command, maxTimeout);
    }

    // 使用沙箱执行
    const useSandbox = !dangerouslyDisableSandbox && isBubblewrapAvailable();

    // 如果禁用沙箱，记录警告
    if (dangerouslyDisableSandbox) {
      console.warn('[Bash Security Warning] Sandbox disabled for command:', command);
    }

    try {
      let result: BashResult;

      if (useSandbox) {
        const sandboxResult = await executeInSandbox(command, {
          cwd: process.cwd(),
          timeout: maxTimeout,
          disableSandbox: false,
        });

        let output = sandboxResult.stdout + (sandboxResult.stderr ? `\nSTDERR:\n${sandboxResult.stderr}` : '');
        if (output.length > MAX_OUTPUT_LENGTH) {
          output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... [output truncated]';
        }

        result = {
          success: sandboxResult.exitCode === 0,
          output,
          stdout: sandboxResult.stdout,
          stderr: sandboxResult.stderr,
          exitCode: sandboxResult.exitCode ?? 1,
          error: sandboxResult.error,
        };
      } else {
        // 直接执行
        const { stdout, stderr } = await execAsync(command, {
          timeout: maxTimeout,
          maxBuffer: 50 * 1024 * 1024, // 50MB
          cwd: process.cwd(),
          env: { ...process.env },
        });

        let output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
        if (output.length > MAX_OUTPUT_LENGTH) {
          output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... [output truncated]';
        }

        result = {
          success: true,
          output,
          stdout,
          stderr,
          exitCode: 0,
        };
      }

      // 运行 post-tool hooks
      await runPostToolUseHooks('Bash', input, result.output || '');

      // 记录审计日志
      const duration = Date.now() - startTime;
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: useSandbox,
        success: result.success,
        exitCode: result.exitCode,
        duration,
        outputSize: (result.output || '').length,
        background: false,
      };
      recordAudit(auditLog);

      return result;
    } catch (err: any) {
      const exitCode = err.code || 1;
      const output = (err.stdout || '') + (err.stderr ? `\nSTDERR:\n${err.stderr}` : '');

      const result: BashResult = {
        success: false,
        error: err.message,
        output,
        stdout: err.stdout,
        stderr: err.stderr,
        exitCode,
      };

      // 运行 post-tool hooks
      await runPostToolUseHooks('Bash', input, result.output || result.error || '');

      // 记录审计日志
      const duration = Date.now() - startTime;
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: useSandbox,
        success: false,
        exitCode,
        duration,
        outputSize: output.length,
        background: false,
      };
      recordAudit(auditLog);

      return result;
    }
  }

  private executeBackground(command: string, maxRuntime: number): BashResult {
    // 检查后台 shell 数量限制
    if (backgroundShells.size >= MAX_BACKGROUND_SHELLS) {
      // 尝试清理已完成的 shell
      const cleaned = cleanupCompletedShells();
      if (cleaned === 0 && backgroundShells.size >= MAX_BACKGROUND_SHELLS) {
        return {
          success: false,
          error: `Maximum number of background shells (${MAX_BACKGROUND_SHELLS}) reached. Clean up completed shells first.`,
        };
      }
    }

    // 定期清理超时的 shell
    cleanupTimedOutShells();

    const id = `bash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const proc = spawn('bash', ['-c', command], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const shellState: ShellState = {
      process: proc,
      output: [],
      status: 'running',
      startTime: Date.now(),
      maxRuntime: Math.min(maxRuntime, BACKGROUND_SHELL_MAX_RUNTIME),
      outputSize: 0,
      command,
    };

    // 设置超时清理
    const timeout = setTimeout(() => {
      if (shellState.status === 'running') {
        console.warn(`[Bash] Background shell ${id} exceeded max runtime, terminating...`);
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (shellState.status === 'running') {
              proc.kill('SIGKILL');
            }
          }, 1000);
        } catch (err) {
          console.error(`Failed to kill shell ${id}:`, err);
        }
      }
    }, shellState.maxRuntime);

    shellState.timeout = timeout;

    proc.stdout?.on('data', (data) => {
      const dataStr = data.toString();
      shellState.outputSize += dataStr.length;

      // 检查输出大小限制
      if (shellState.outputSize < MAX_BACKGROUND_OUTPUT) {
        shellState.output.push(dataStr);
      } else if (shellState.output[shellState.output.length - 1] !== '[Output limit reached]') {
        shellState.output.push('[Output limit reached - further output discarded]');
      }
    });

    proc.stderr?.on('data', (data) => {
      const dataStr = `STDERR: ${data.toString()}`;
      shellState.outputSize += dataStr.length;

      if (shellState.outputSize < MAX_BACKGROUND_OUTPUT) {
        shellState.output.push(dataStr);
      } else if (shellState.output[shellState.output.length - 1] !== '[Output limit reached]') {
        shellState.output.push('[Output limit reached - further output discarded]');
      }
    });

    proc.on('close', (code) => {
      shellState.status = code === 0 ? 'completed' : 'failed';
      if (shellState.timeout) {
        clearTimeout(shellState.timeout);
      }

      // 记录审计日志
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: false,
        success: code === 0,
        exitCode: code ?? undefined,
        duration: Date.now() - shellState.startTime,
        outputSize: shellState.outputSize,
        background: true,
      };
      recordAudit(auditLog);
    });

    proc.on('error', (err) => {
      shellState.status = 'failed';
      shellState.output.push(`ERROR: ${err.message}`);
      if (shellState.timeout) {
        clearTimeout(shellState.timeout);
      }
    });

    backgroundShells.set(id, shellState);

    return {
      success: true,
      output: `Background process started with ID: ${id}\nMax runtime: ${shellState.maxRuntime}ms\nUse BashOutput tool to retrieve output.`,
      bash_id: id,
    };
  }
}

export class BashOutputTool extends BaseTool<{ bash_id: string; filter?: string }, BashResult> {
  name = 'BashOutput';
  description = `Retrieves output from a running or completed background bash shell.

Usage:
  - Takes a bash_id parameter identifying the shell
  - Always returns only new output since the last check
  - Returns stdout and stderr output along with shell status
  - Supports optional regex filtering to show only lines matching a pattern`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        bash_id: {
          type: 'string',
          description: 'The ID of the background shell',
        },
        filter: {
          type: 'string',
          description: 'Optional regex to filter output lines',
        },
      },
      required: ['bash_id'],
    };
  }

  async execute(input: { bash_id: string; filter?: string }): Promise<BashResult> {
    const shell = backgroundShells.get(input.bash_id);
    if (!shell) {
      return { success: false, error: `Shell ${input.bash_id} not found` };
    }

    let output = shell.output.join('');
    // 清空已读取的输出
    shell.output.length = 0;

    if (input.filter) {
      try {
        const regex = new RegExp(input.filter);
        output = output.split('\n').filter((line) => regex.test(line)).join('\n');
      } catch {
        return { success: false, error: `Invalid regex: ${input.filter}` };
      }
    }

    const duration = Date.now() - shell.startTime;

    return {
      success: true,
      output: output || '(no new output)',
      exitCode: shell.status === 'completed' ? 0 : shell.status === 'failed' ? 1 : undefined,
      stdout: `Status: ${shell.status}, Duration: ${duration}ms`,
    };
  }
}

export class KillShellTool extends BaseTool<{ shell_id: string }, BashResult> {
  name = 'KillShell';
  description = `Kills a running background bash shell by its ID.

Usage:
  - Takes a shell_id parameter identifying the shell to kill
  - Returns a success or failure status
  - Use this tool when you need to terminate a long-running shell`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        shell_id: {
          type: 'string',
          description: 'The ID of the background shell to kill',
        },
      },
      required: ['shell_id'],
    };
  }

  async execute(input: { shell_id: string }): Promise<BashResult> {
    const shell = backgroundShells.get(input.shell_id);
    if (!shell) {
      return { success: false, error: `Shell ${input.shell_id} not found` };
    }

    try {
      shell.process.kill('SIGTERM');

      // 等待一秒，如果还在运行则强制杀死
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (shell.status === 'running') {
        shell.process.kill('SIGKILL');
      }

      backgroundShells.delete(input.shell_id);

      return {
        success: true,
        output: `Shell ${input.shell_id} killed`,
      };
    } catch (err) {
      return { success: false, error: `Failed to kill shell: ${err}` };
    }
  }
}

/**
 * 获取所有后台 shell 的状态
 */
export function getBackgroundShells(): Array<{
  id: string;
  status: string;
  duration: number;
}> {
  const result: Array<{ id: string; status: string; duration: number }> = [];

  Array.from(backgroundShells.entries()).forEach(([id, shell]) => {
    result.push({
      id,
      status: shell.status,
      duration: Date.now() - shell.startTime,
    });
  });

  return result;
}

/**
 * 清理已完成的后台 shell
 */
export function cleanupCompletedShells(): number {
  let cleaned = 0;

  Array.from(backgroundShells.entries()).forEach(([id, shell]) => {
    if (shell.status !== 'running') {
      // 清理超时定时器
      if (shell.timeout) {
        clearTimeout(shell.timeout);
      }
      backgroundShells.delete(id);
      cleaned++;
    }
  });

  return cleaned;
}

/**
 * 获取审计日志
 */
export function getAuditLogs(options?: {
  limit?: number;
  since?: number;
  success?: boolean;
}): AuditLog[] {
  let logs = [...auditLogs];

  // 按时间筛选
  if (options?.since) {
    logs = logs.filter((log) => log.timestamp >= options.since);
  }

  // 按成功状态筛选
  if (options?.success !== undefined) {
    logs = logs.filter((log) => log.success === options.success);
  }

  // 限制数量
  if (options?.limit) {
    logs = logs.slice(-options.limit);
  }

  return logs;
}

/**
 * 获取审计统计
 */
export function getAuditStats(): {
  total: number;
  success: number;
  failed: number;
  sandboxed: number;
  background: number;
  avgDuration: number;
  totalOutputSize: number;
} {
  const total = auditLogs.length;
  const success = auditLogs.filter((log) => log.success).length;
  const failed = total - success;
  const sandboxed = auditLogs.filter((log) => log.sandboxed).length;
  const background = auditLogs.filter((log) => log.background).length;

  const totalDuration = auditLogs.reduce((sum, log) => sum + log.duration, 0);
  const avgDuration = total > 0 ? totalDuration / total : 0;

  const totalOutputSize = auditLogs.reduce((sum, log) => sum + log.outputSize, 0);

  return {
    total,
    success,
    failed,
    sandboxed,
    background,
    avgDuration,
    totalOutputSize,
  };
}

/**
 * 清除审计日志
 */
export function clearAuditLogs(): number {
  const count = auditLogs.length;
  auditLogs.length = 0;
  return count;
}

/**
 * 列出所有后台 shell 详细信息
 */
export function listBackgroundShells(): Array<{
  id: string;
  command: string;
  status: string;
  duration: number;
  outputSize: number;
  maxRuntime?: number;
}> {
  const result: Array<{
    id: string;
    command: string;
    status: string;
    duration: number;
    outputSize: number;
    maxRuntime?: number;
  }> = [];

  Array.from(backgroundShells.entries()).forEach(([id, shell]) => {
    result.push({
      id,
      command: shell.command.substring(0, 100) + (shell.command.length > 100 ? '...' : ''),
      status: shell.status,
      duration: Date.now() - shell.startTime,
      outputSize: shell.outputSize,
      maxRuntime: shell.maxRuntime,
    });
  });

  return result;
}

/**
 * 强制终止所有后台 shell
 */
export function killAllBackgroundShells(): number {
  let killed = 0;

  Array.from(backgroundShells.entries()).forEach(([id, shell]) => {
    try {
      shell.process.kill('SIGTERM');
      if (shell.timeout) {
        clearTimeout(shell.timeout);
      }
      setTimeout(() => {
        if (shell.status === 'running') {
          shell.process.kill('SIGKILL');
        }
      }, 1000);
      killed++;
    } catch (err) {
      console.error(`Failed to kill shell ${id}:`, err);
    }
  });

  backgroundShells.clear();
  return killed;
}
