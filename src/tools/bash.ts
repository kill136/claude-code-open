/**
 * Bash 工具
 * 执行 shell 命令，支持沙箱隔离
 * 跨平台支持: Windows (PowerShell/CMD), macOS, Linux
 */

import { spawn, exec, ChildProcess, spawnSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './base.js';
import { executeInSandbox, isBubblewrapAvailable } from './sandbox.js';
import { runPreToolUseHooks, runPostToolUseHooks } from '../hooks/index.js';
import type { BashInput, BashResult, ToolDefinition } from '../types/index.js';

const execAsync = promisify(exec);

// ============================================================================
// 跨平台支持
// ============================================================================

/** 平台检测 */
const IS_WINDOWS = os.platform() === 'win32';
const IS_WSL = os.platform() === 'linux' &&
  fs.existsSync('/proc/version') &&
  fs.readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft');

/** Shell 配置接口 */
interface ShellConfig {
  shell: string;
  args: string[];
  isCmd: boolean;
  isPowerShell: boolean;
}

/** 获取平台适配的 Shell 配置 */
function getPlatformShell(): ShellConfig {
  if (IS_WINDOWS) {
    // Windows: 优先使用 PowerShell，回退到 cmd
    try {
      const result = spawnSync('powershell.exe', ['-Command', 'echo test'], {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      });
      if (result.status === 0) {
        return {
          shell: 'powershell.exe',
          args: ['-NoProfile', '-NonInteractive', '-Command'],
          isCmd: false,
          isPowerShell: true,
        };
      }
    } catch {
      // PowerShell 不可用
    }

    // 回退到 cmd
    const cmdPath = process.env.COMSPEC || 'cmd.exe';
    return {
      shell: cmdPath,
      args: ['/c'],
      isCmd: true,
      isPowerShell: false,
    };
  }

  // Unix 系统: 使用 bash 或 sh
  const shell = process.env.SHELL || '/bin/bash';
  return {
    shell,
    args: ['-c'],
    isCmd: false,
    isPowerShell: false,
  };
}

/** 缓存的 Shell 配置 */
let cachedShellConfig: ShellConfig | null = null;

function getShellConfig(): ShellConfig {
  if (!cachedShellConfig) {
    cachedShellConfig = getPlatformShell();
  }
  return cachedShellConfig;
}

/** 获取平台适配的终止信号类型 */
type TermSignal = 'SIGTERM' | 'SIGKILL' | 'SIGINT';

/**
 * 安全地终止进程（跨平台）
 */
function killProcessSafely(proc: ChildProcess, signal: TermSignal = 'SIGTERM'): boolean {
  try {
    if (IS_WINDOWS && proc.pid) {
      // Windows: 使用 taskkill 终止进程树
      try {
        spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        return true;
      } catch {
        // 回退到标准方法
      }
    }
    proc.kill(signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取平台适配的 spawn 选项
 */
function getPlatformSpawnOptions(cwd: string): {
  shell: string | boolean;
  cwd: string;
  env: NodeJS.ProcessEnv;
  windowsHide?: boolean;
  stdio: ['ignore', 'pipe', 'pipe'];
} {
  const options: {
    shell: string | boolean;
    cwd: string;
    env: NodeJS.ProcessEnv;
    windowsHide?: boolean;
    stdio: ['ignore', 'pipe', 'pipe'];
  } = {
    shell: false,
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  if (IS_WINDOWS) {
    options.windowsHide = true;
  }

  return options;
}

// 后台任务管理（统一使用 task_id）
interface TaskState {
  taskId: string; // 使用 UUID 格式的 task_id
  process: ReturnType<typeof spawn>;
  output: string[];
  outputFile: string;
  outputStream?: fs.WriteStream;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  timeout?: NodeJS.Timeout;
  maxRuntime?: number;
  outputSize: number;
  command: string;
  exitCode?: number;
  description?: string;
  // 用于增量读取输出
  lastReadPosition: number;
}

// 使用 task_id 作为键，兼容官方格式
const backgroundTasks: Map<string, TaskState> = new Map();

// 向后兼容：保留旧的变量名作为别名
const backgroundShells = backgroundTasks;

/**
 * 获取后台任务信息（供 TaskOutput 工具使用）
 */
export function getBackgroundTask(taskId: string): TaskState | undefined {
  return backgroundTasks.get(taskId);
}

/**
 * 向后兼容：获取后台 shell 信息
 */
export function getBackgroundShell(taskId: string): TaskState | undefined {
  return getBackgroundTask(taskId);
}

/**
 * 检查 ID 是否是任务 ID（支持 UUID 和旧格式）
 */
export function isTaskId(id: string): boolean {
  // 支持 UUID 格式和旧的 bash_ 格式
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || id.startsWith('bash_');
}

/**
 * 向后兼容：检查 ID 是否是 shell ID
 */
export function isShellId(id: string): boolean {
  return isTaskId(id);
}

// 获取任务输出文件路径（使用官方的 tasks 目录）
function getTaskOutputPath(taskId: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const tasksDir = path.join(homeDir, '.claude', 'tasks');

  // 确保目录存在
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  return path.join(tasksDir, `${taskId}.log`);
}

// 向后兼容：保留旧的函数名
function getBackgroundOutputPath(taskId: string): string {
  return getTaskOutputPath(taskId);
}

// 配置
const MAX_OUTPUT_LENGTH = parseInt(process.env.BASH_MAX_OUTPUT_LENGTH || '30000', 10);
const DEFAULT_TIMEOUT = parseInt(process.env.BASH_DEFAULT_TIMEOUT_MS || '120000', 10); // 默认 2 分钟
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
 * 清理超时的后台任务
 */
function cleanupTimedOutTasks(): number {
  let cleaned = 0;
  const now = Date.now();

  Array.from(backgroundTasks.entries()).forEach(([id, task]) => {
    if (task.maxRuntime && now - task.startTime > task.maxRuntime) {
      try {
        task.process.kill('SIGTERM');
        // 关闭输出流
        task.outputStream?.end();
        setTimeout(() => {
          if (task.status === 'running') {
            task.process.kill('SIGKILL');
          }
        }, 1000);
        backgroundTasks.delete(id);
        cleaned++;
      } catch (err) {
        console.error(`Failed to cleanup task ${id}:`, err);
      }
    }
  });

  return cleaned;
}

// 向后兼容
const cleanupTimedOutShells = cleanupTimedOutTasks;

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
    // 检查后台任务数量限制
    if (backgroundTasks.size >= MAX_BACKGROUND_SHELLS) {
      // 尝试清理已完成的任务
      const cleaned = cleanupCompletedTasks();
      if (cleaned === 0 && backgroundTasks.size >= MAX_BACKGROUND_SHELLS) {
        return {
          success: false,
          error: `Maximum number of background tasks (${MAX_BACKGROUND_SHELLS}) reached. Clean up completed tasks first.`,
        };
      }
    }

    // 定期清理超时的任务
    cleanupTimedOutTasks();

    // 使用 UUID 作为 task_id，与官方一致
    const taskId = uuidv4();
    const outputFile = getTaskOutputPath(taskId);

    const proc = spawn('bash', ['-c', command], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 创建输出文件流
    const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });

    const taskState: TaskState = {
      taskId,
      process: proc,
      output: [],
      outputFile,
      outputStream,
      status: 'running',
      startTime: Date.now(),
      maxRuntime: Math.min(maxRuntime, BACKGROUND_SHELL_MAX_RUNTIME),
      outputSize: 0,
      command,
      lastReadPosition: 0,
    };

    // 设置超时清理
    const timeout = setTimeout(() => {
      if (taskState.status === 'running') {
        console.warn(`[Bash] Background task ${taskId} exceeded max runtime, terminating...`);
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (taskState.status === 'running') {
              proc.kill('SIGKILL');
            }
          }, 1000);
        } catch (err) {
          console.error(`Failed to kill task ${taskId}:`, err);
        }
      }
    }, taskState.maxRuntime);

    taskState.timeout = timeout;

    proc.stdout?.on('data', (data) => {
      const dataStr = data.toString();
      taskState.outputSize += dataStr.length;

      // 写入文件
      taskState.outputStream?.write(dataStr);

      // 同时保存在内存中（用于 TaskOutput 工具）
      if (taskState.outputSize < MAX_BACKGROUND_OUTPUT) {
        taskState.output.push(dataStr);
      } else if (taskState.output[taskState.output.length - 1] !== '[Output limit reached]') {
        taskState.output.push('[Output limit reached - further output discarded]');
      }
    });

    proc.stderr?.on('data', (data) => {
      const dataStr = data.toString();
      const stderrStr = `STDERR: ${dataStr}`;
      taskState.outputSize += dataStr.length;

      // 写入文件
      taskState.outputStream?.write(stderrStr);

      // 同时保存在内存中
      if (taskState.outputSize < MAX_BACKGROUND_OUTPUT) {
        taskState.output.push(stderrStr);
      } else if (taskState.output[taskState.output.length - 1] !== '[Output limit reached]') {
        taskState.output.push('[Output limit reached - further output discarded]');
      }
    });

    proc.on('close', (code) => {
      taskState.status = code === 0 ? 'completed' : 'failed';
      taskState.exitCode = code ?? undefined;
      taskState.endTime = Date.now();

      if (taskState.timeout) {
        clearTimeout(taskState.timeout);
      }

      // 关闭输出文件流
      taskState.outputStream?.end();

      // 记录审计日志
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: false,
        success: code === 0,
        exitCode: code ?? undefined,
        duration: Date.now() - taskState.startTime,
        outputSize: taskState.outputSize,
        background: true,
      };
      recordAudit(auditLog);
    });

    proc.on('error', (err) => {
      taskState.status = 'failed';
      const errorMsg = `ERROR: ${err.message}`;
      taskState.output.push(errorMsg);
      taskState.outputStream?.write(errorMsg + '\n');
      taskState.outputStream?.end();
      if (taskState.timeout) {
        clearTimeout(taskState.timeout);
      }
    });

    backgroundTasks.set(taskId, taskState);

    // 返回与官方一致的格式（使用 task_id）
    const statusMsg = `<task-id>${taskId}</task-id>
<task-type>bash</task-type>
<output-file>${outputFile}</output-file>
<status>running</status>
<summary>Background command "${command.substring(0, 50)}${command.length > 50 ? '...' : ''}" started.</summary>
Use TaskOutput tool with task_id="${taskId}" to retrieve the output.`;

    return {
      success: true,
      output: statusMsg,
      task_id: taskId, // 官方字段名
      shell_id: taskId, // 向后兼容
      bash_id: taskId, // 向后兼容
    };
  }
}

/**
 * BashOutput 工具（向后兼容）
 * 直接实现，不依赖 TaskOutput 以避免循环依赖
 */
export class BashOutputTool extends BaseTool<
  { bash_id: string; filter?: string; block?: boolean; timeout?: number },
  BashResult
> {
  name = 'BashOutput';
  description = `Retrieves output from a running or completed background bash shell.

DEPRECATED: This tool is deprecated. Use TaskOutput instead.

Usage:
  - Takes a bash_id (or task_id) parameter identifying the task
  - Returns new output since the last check (incremental updates)
  - Use block=true to wait for task completion
  - Use block=false for non-blocking check of current status
  - timeout specifies max wait time in ms when blocking
  - Supports optional regex filtering to show only lines matching a pattern`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        bash_id: {
          type: 'string',
          description: 'The ID of the background task (bash_id or task_id)',
        },
        filter: {
          type: 'string',
          description: 'Optional regex to filter output lines',
        },
        block: {
          type: 'boolean',
          description: 'Whether to wait for completion (default: false)',
        },
        timeout: {
          type: 'number',
          description: 'Max wait time in ms when blocking (default: 30000)',
        },
      },
      required: ['bash_id'],
    };
  }

  async execute(input: {
    bash_id: string;
    filter?: string;
    block?: boolean;
    timeout?: number;
  }): Promise<BashResult> {
    const task = backgroundTasks.get(input.bash_id);
    if (!task) {
      return { success: false, error: `Task ${input.bash_id} not found` };
    }

    // 如果需要阻塞等待完成
    const shouldBlock = input.block === true;
    if (shouldBlock && task.status === 'running') {
      const maxTimeout = input.timeout || 30000;
      const startTime = Date.now();

      while (task.status === 'running' && Date.now() - startTime < maxTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (task.status === 'running') {
        return {
          success: true,
          output: `Task ${input.bash_id} is still running after ${maxTimeout}ms timeout.\nUse block=false to check current output without waiting.`,
          stdout: `Status: ${task.status}`,
          task_id: input.bash_id,
        };
      }
    }

    // 读取新输出（增量）
    let output = task.output.join('');
    task.output.length = 0;

    if (input.filter) {
      try {
        const regex = new RegExp(input.filter);
        output = output
          .split('\n')
          .filter((line) => regex.test(line))
          .join('\n');
      } catch {
        return { success: false, error: `Invalid regex: ${input.filter}` };
      }
    }

    const duration = Date.now() - task.startTime;

    // 构建状态信息
    const statusInfo = [];
    statusInfo.push(`<task-id>${input.bash_id}</task-id>`);
    statusInfo.push(`<task-type>bash</task-type>`);
    statusInfo.push(`<status>${task.status}</status>`);
    statusInfo.push(`<duration>${duration}ms</duration>`);
    statusInfo.push(`<output-file>${task.outputFile}</output-file>`);

    if (task.exitCode !== undefined) {
      statusInfo.push(`<exit-code>${task.exitCode}</exit-code>`);
    }

    if (output.trim()) {
      statusInfo.push(`<output>\n${output}\n</output>`);
    } else {
      statusInfo.push(`<output>(no new output)</output>`);
    }

    if (task.status === 'completed') {
      statusInfo.push(`<summary>Task completed successfully.</summary>`);
    } else if (task.status === 'failed') {
      statusInfo.push(`<summary>Task failed with exit code ${task.exitCode}.</summary>`);
    } else {
      statusInfo.push(`<summary>Task is still running.</summary>`);
    }

    return {
      success: true,
      output: statusInfo.join('\n'),
      exitCode: task.exitCode,
      stdout: output,
      task_id: input.bash_id,
    };
  }
}

export class KillShellTool extends BaseTool<{ shell_id: string }, BashResult> {
  name = 'KillShell';
  description = `Kills a running background task by its ID.

Usage:
  - Takes a shell_id (or task_id) parameter identifying the task to kill
  - Returns a success or failure status
  - Use this tool when you need to terminate a long-running task`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        shell_id: {
          type: 'string',
          description: 'The ID of the background task to kill (shell_id or task_id)',
        },
      },
      required: ['shell_id'],
    };
  }

  async execute(input: { shell_id: string }): Promise<BashResult> {
    const task = backgroundTasks.get(input.shell_id);
    if (!task) {
      return { success: false, error: `Task ${input.shell_id} not found` };
    }

    try {
      task.process.kill('SIGTERM');
      // 关闭输出流
      task.outputStream?.end();

      // 等待一秒，如果还在运行则强制杀死
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (task.status === 'running') {
        task.process.kill('SIGKILL');
      }

      backgroundTasks.delete(input.shell_id);

      return {
        success: true,
        output: `Task ${input.shell_id} killed`,
      };
    } catch (err) {
      return { success: false, error: `Failed to kill task: ${err}` };
    }
  }
}

/**
 * 获取所有后台任务的状态
 */
export function getBackgroundTasks(): Array<{
  id: string;
  status: string;
  duration: number;
}> {
  const result: Array<{ id: string; status: string; duration: number }> = [];

  Array.from(backgroundTasks.entries()).forEach(([id, task]) => {
    result.push({
      id,
      status: task.status,
      duration: Date.now() - task.startTime,
    });
  });

  return result;
}

/**
 * 向后兼容：获取所有后台 shell 的状态
 */
export function getBackgroundShells(): Array<{
  id: string;
  status: string;
  duration: number;
}> {
  return getBackgroundTasks();
}

/**
 * 清理已完成的后台任务
 */
export function cleanupCompletedTasks(): number {
  let cleaned = 0;

  Array.from(backgroundTasks.entries()).forEach(([id, task]) => {
    if (task.status !== 'running') {
      // 清理超时定时器
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      // 关闭输出流
      task.outputStream?.end();
      backgroundTasks.delete(id);
      cleaned++;
    }
  });

  return cleaned;
}

/**
 * 向后兼容：清理已完成的后台 shell
 */
export function cleanupCompletedShells(): number {
  return cleanupCompletedTasks();
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
 * 列出所有后台任务详细信息
 */
export function listBackgroundTasks(): Array<{
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

  Array.from(backgroundTasks.entries()).forEach(([id, task]) => {
    result.push({
      id,
      command: task.command.substring(0, 100) + (task.command.length > 100 ? '...' : ''),
      status: task.status,
      duration: Date.now() - task.startTime,
      outputSize: task.outputSize,
      maxRuntime: task.maxRuntime,
    });
  });

  return result;
}

/**
 * 向后兼容：列出所有后台 shell 详细信息
 */
export function listBackgroundShells(): Array<{
  id: string;
  command: string;
  status: string;
  duration: number;
  outputSize: number;
  maxRuntime?: number;
}> {
  return listBackgroundTasks();
}

/**
 * 强制终止所有后台任务
 */
export function killAllBackgroundTasks(): number {
  let killed = 0;

  Array.from(backgroundTasks.entries()).forEach(([id, task]) => {
    try {
      task.process.kill('SIGTERM');
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      // 关闭输出流
      task.outputStream?.end();
      setTimeout(() => {
        if (task.status === 'running') {
          task.process.kill('SIGKILL');
        }
      }, 1000);
      killed++;
    } catch (err) {
      console.error(`Failed to kill task ${id}:`, err);
    }
  });

  backgroundTasks.clear();
  return killed;
}

/**
 * 向后兼容：强制终止所有后台 shell
 */
export function killAllBackgroundShells(): number {
  return killAllBackgroundTasks();
}
