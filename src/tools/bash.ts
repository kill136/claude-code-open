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
   - If the command will create new directories or files, first use \`ls\` to verify the parent directory exists and is the correct location
   - For example, before running "mkdir foo/bar", first use \`ls foo\` to check that "foo" exists and is the intended parent directory

2. Command Execution:
   - Always quote file paths that contain spaces with double quotes (e.g., cd "path with spaces/file.txt")
   - Examples of proper quoting:
     - cd "/Users/name/My Documents" (correct)
     - cd /Users/name/My Documents (incorrect - will fail)
     - python "/path/with spaces/script.py" (correct)
     - python /path/with spaces/script.py (incorrect - will fail)
   - After ensuring proper quoting, execute the command.
   - Capture the output of the command.

Usage notes:
  - The command argument is required.
  - You can specify an optional timeout in milliseconds (up to ${MAX_TIMEOUT}ms / ${MAX_TIMEOUT / 60000} minutes). If not specified, commands will timeout after ${DEFAULT_TIMEOUT}ms (${DEFAULT_TIMEOUT / 60000} minutes).
  - It is very helpful if you write a clear, concise description of what this command does in 5-10 words.
  - If the output exceeds ${MAX_OUTPUT_LENGTH} characters, output will be truncated before being returned to you.
  - You can use the \`run_in_background\` parameter to run the command in the background, which allows you to continue working while the command runs. You can monitor the output using the BashOutput tool as it becomes available. You do not need to use '&' at the end of the command when using this parameter.
  - Avoid using Bash with the \`find\`, \`grep\`, \`cat\`, \`head\`, \`tail\`, \`sed\`, \`awk\`, or \`echo\` commands, unless explicitly instructed or when these commands are truly necessary for the task. Instead, always prefer using the dedicated tools for these commands:
    - File search: Use Glob (NOT find or ls)
    - Content search: Use Grep (NOT grep or rg)
    - Read files: Use Read (NOT cat/head/tail)
    - Edit files: Use Edit (NOT sed/awk)
    - Write files: Use Write (NOT echo >/cat <<EOF)
    - Communication: Output text directly (NOT echo/printf)
  - When issuing multiple commands:
    - If the commands are independent and can run in parallel, make multiple Bash tool calls in a single message. For example, if you need to run "git status" and "git diff", send a single message with two Bash tool calls in parallel.
    - If the commands depend on each other and must run sequentially, use a single Bash call with '&&' to chain them together (e.g., \`git add . && git commit -m "message" && git push\`). For instance, if one operation must complete before another starts (like mkdir before cp, Write before Bash for git operations, or git add before git commit), run these operations sequentially instead.
    - Use ';' only when you need to run commands sequentially but don't care if earlier commands fail
    - DO NOT use newlines to separate commands (newlines are ok in quoted strings)
  - Try to maintain your current working directory throughout the session by using absolute paths and avoiding usage of \`cd\`. You may use \`cd\` if the User explicitly requests it.
    <good-example>
    pytest /foo/bar/tests
    </good-example>
    <bad-example>
    cd /foo/bar && pytest tests
    </bad-example>

# Committing changes with git

Only create commits when requested by the user. If unclear, ask first. When the user asks you to create a new git commit, follow these steps carefully:

Git Safety Protocol:
- NEVER update the git config
- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc) unless the user explicitly requests them
- NEVER skip hooks (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests it
- NEVER run force push to main/master, warn the user if they request it
- Avoid git commit --amend. ONLY use --amend when ALL conditions are met:
  (1) User explicitly requested amend, OR commit SUCCEEDED but pre-commit hook auto-modified files that need including
  (2) HEAD commit was created by you in this conversation (verify: git log -1 --format='%an %ae')
  (3) Commit has NOT been pushed to remote (verify: git status shows "Your branch is ahead")
- CRITICAL: If commit FAILED or was REJECTED by hook, NEVER amend - fix the issue and create a NEW commit
- CRITICAL: If you already pushed to remote, NEVER amend unless user explicitly requests it (requires force push)
- NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.

1. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel, each using the Bash tool:
  - Run a git status command to see all untracked files.
  - Run a git diff command to see both staged and unstaged changes that will be committed.
  - Run a git log command to see recent commit messages, so that you can follow this repository's commit message style.
2. Analyze all staged changes (both previously staged and newly added) and draft a commit message:
  - Summarize the nature of the changes (eg. new feature, enhancement to an existing feature, bug fix, refactoring, test, docs, etc.). Ensure the message accurately reflects the changes and their purpose (i.e. "add" means a wholly new feature, "update" means an enhancement to an existing feature, "fix" means a bug fix, etc.).
  - Do not commit files that likely contain secrets (.env, credentials.json, etc). Warn the user if they specifically request to commit those files
  - Draft a concise (1-2 sentences) commit message that focuses on the "why" rather than the "what"
  - Ensure it accurately reflects the changes and their purpose
3. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands:
   - Add relevant untracked files to the staging area.
   - Create the commit with a message.
   - Run git status after the commit completes to verify success.
   Note: git status depends on the commit completing, so run it sequentially after the commit.
4. If the commit fails due to pre-commit hook, fix the issue and create a NEW commit (see amend rules above)

Important notes:
- NEVER run additional commands to read or explore code, besides git bash commands
- NEVER use the TodoWrite or Task tools
- DO NOT push to the remote repository unless the user explicitly asks you to do so
- IMPORTANT: Never use git commands with the -i flag (like git rebase -i or git add -i) since they require interactive input which is not supported.
- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit
- In order to ensure good formatting, ALWAYS pass the commit message via a HEREDOC, a la this example:
<example>
git commit -m "$(cat <<'EOF'
   Commit message here.
   EOF
   )"
</example>

# Creating pull requests
Use the gh command via the Bash tool for ALL GitHub-related tasks including working with issues, pull requests, checks, and releases. If given a Github URL use the gh command to get the information needed.

IMPORTANT: When the user asks you to create a pull request, follow these steps carefully:

1. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel using the Bash tool, in order to understand the current state of the branch since it diverged from the main branch:
   - Run a git status command to see all untracked files
   - Run a git diff command to see both staged and unstaged changes that will be committed
   - Check if the current branch tracks a remote branch and is up to date with the remote, so you know if you need to push to the remote
   - Run a git log command and \`git diff [base-branch]...HEAD\` to understand the full commit history for the current branch (from the time it diverged from the base branch)
2. Analyze all changes that will be included in the pull request, making sure to look at all relevant commits (NOT just the latest commit, but ALL commits that will be included in the pull request!!!), and draft a pull request summary
3. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands in parallel:
   - Create new branch if needed
   - Push to remote with -u flag if needed
   - Create PR using gh pr create with the format below. Use a HEREDOC to pass the body to ensure correct formatting.
<example>
gh pr create --title "the pr title" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
[Bulleted markdown checklist of TODOs for testing the pull request...]
EOF
)"
</example>

Important:
- DO NOT use the TodoWrite or Task tools
- Return the PR URL when you're done, so the user can see it

# Other common operations
- View comments on a Github PR: gh api repos/foo/bar/pulls/123/comments`;

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

    // 使用沙箱执行（与官方实现对齐）
    // 注意：这里通过 executeInSandbox 来决定是否使用沙箱，而不是在这里判断
    // executeInSandbox 内部会调用 shouldUseSandbox 来判断

    // 如果禁用沙箱，记录警告
    if (dangerouslyDisableSandbox) {
      console.warn('[Bash Security Warning] Sandbox disabled for command:', command);
    }

    try {
      let result: BashResult;

      // 统一使用 executeInSandbox 来执行命令
      // 它会根据各种条件自动决定是否真正使用沙箱
      const sandboxResult = await executeInSandbox(command, {
        cwd: process.cwd(),
        timeout: maxTimeout,
        disableSandbox: dangerouslyDisableSandbox,
        command, // 传递命令用于特殊处理（如 MCP 检测）
        // 可选：传递权限上下文（暂时不传，使用全局状态）
        // permissionContext: getGlobalAppState()?.toolPermissionContext,
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

      // 运行 post-tool hooks
      await runPostToolUseHooks('Bash', input, result.output || '');

      // 记录审计日志
      const duration = Date.now() - startTime;
      const auditLog: AuditLog = {
        timestamp: Date.now(),
        command,
        cwd: process.cwd(),
        sandboxed: sandboxResult.sandboxed, // 从 sandboxResult 中获取实际的沙箱状态
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
        sandboxed: false, // 发生错误时默认为 false
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
  { bash_id?: string; task_id?: string; filter?: string; block?: boolean; timeout?: number },
  BashResult
> {
  name = 'BashOutput';
  description = `
- Retrieves output from a running or completed task (background shell, agent, or remote session)
- Takes a task_id parameter identifying the task
- Returns the task output along with status information
- Use block=true (default) to wait for task completion
- Use block=false for non-blocking check of current status
- Task IDs can be found using the /tasks command
- Works with all task types: background shells, async agents, and remote sessions`.trim();

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        bash_id: {
          type: 'string',
          description: 'The ID of the background bash shell',
        },
        task_id: {
          type: 'string',
          description: 'The task ID to get output from',
        },
        filter: {
          type: 'string',
          description: 'Optional regex to filter output lines',
        },
        block: {
          type: 'boolean',
          description: 'Whether to wait for completion (default: true)',
        },
        timeout: {
          type: 'number',
          description: 'Max wait time in ms when blocking (default: 30000)',
        },
      },
      required: [],
    };
  }

  async execute(input: {
    bash_id?: string;
    task_id?: string;
    filter?: string;
    block?: boolean;
    timeout?: number;
  }): Promise<BashResult> {
    // 同时支持 task_id 和 bash_id 参数
    const taskId = input.task_id || input.bash_id;
    if (!taskId) {
      return { success: false, error: 'Either task_id or bash_id parameter is required' };
    }

    const task = backgroundTasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task ${taskId} not found` };
    }

    // 如果需要阻塞等待完成（默认为 true）
    const shouldBlock = input.block !== false;
    if (shouldBlock && task.status === 'running') {
      const maxTimeout = input.timeout || 30000;
      const startTime = Date.now();

      while (task.status === 'running' && Date.now() - startTime < maxTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (task.status === 'running') {
        return {
          success: true,
          output: `Task ${taskId} is still running after ${maxTimeout}ms timeout.\nUse block=false to check current output without waiting.`,
          stdout: `Status: ${task.status}`,
          task_id: taskId,
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
    statusInfo.push(`<task-id>${taskId}</task-id>`);
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
      task_id: taskId,
    };
  }
}

export class KillShellTool extends BaseTool<{ shell_id: string }, BashResult> {
  name = 'KillShell';
  description = `
- Kills a running background bash shell by its ID
- Takes a shell_id parameter identifying the shell to kill
- Returns a success or failure status
- Use this tool when you need to terminate a long-running shell
- Shell IDs can be found using the /tasks command`.trim();

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
    const task = backgroundTasks.get(input.shell_id);
    if (!task) {
      return { success: false, error: `No shell found with ID: ${input.shell_id}` };
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
        output: `Successfully killed shell: ${input.shell_id} (${task.command})`,
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
