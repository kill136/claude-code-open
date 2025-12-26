/**
 * 沙箱执行支持
 * 支持多平台: Linux (Bubblewrap), macOS (Seatbelt), Windows (无沙箱)
 */

import { spawn, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ============ 类型定义 ============

export type SandboxType = 'bubblewrap' | 'seatbelt' | 'none';

export interface SandboxOptions {
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 允许写入的路径 */
  writablePaths?: string[];
  /** 允许读取的路径 */
  readOnlyPaths?: string[];
  /** 是否允许网络访问 */
  network?: boolean;
  /** 是否禁用沙箱 */
  disableSandbox?: boolean;
  /** 是否允许访问 /dev */
  allowDevAccess?: boolean;
  /** 是否允许访问 /proc */
  allowProcAccess?: boolean;
  /** 是否允许访问 /sys */
  allowSysAccess?: boolean;
  /** 自定义环境变量白名单 */
  envWhitelist?: string[];
  /** 最大内存限制（字节） */
  maxMemory?: number;
  /** 最大 CPU 使用率 (0-100) */
  maxCpu?: number;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed: boolean;
  error?: string;
  /** 是否在沙箱中执行 */
  sandboxed: boolean;
  /** 使用的沙箱类型 */
  sandboxType: SandboxType;
}

export interface SandboxConfig {
  /** 是否启用沙箱 */
  enabled: boolean;
  /** 默认允许写入的路径 */
  defaultWritablePaths: string[];
  /** 默认只读路径 */
  defaultReadOnlyPaths: string[];
  /** 沙箱失败时是否降级执行 */
  fallbackOnError: boolean;
  /** 显示沙箱错误信息 */
  showSandboxErrors: boolean;
  /** 允许用户绕过沙箱 */
  allowBypass: boolean;
}

// ============ 全局配置 ============

let sandboxConfig: SandboxConfig = {
  enabled: true,
  defaultWritablePaths: [],
  defaultReadOnlyPaths: [],
  fallbackOnError: true,
  showSandboxErrors: true,
  allowBypass: true,
};

/**
 * 获取沙箱配置
 */
export function getSandboxConfig(): SandboxConfig {
  return { ...sandboxConfig };
}

/**
 * 设置沙箱配置
 */
export function setSandboxConfig(config: Partial<SandboxConfig>): void {
  sandboxConfig = { ...sandboxConfig, ...config };
}

// ============ 平台检测 ============

/**
 * 获取当前平台
 */
export function getPlatform(): 'linux' | 'darwin' | 'win32' | 'unknown' {
  const platform = os.platform();
  if (platform === 'linux' || platform === 'darwin' || platform === 'win32') {
    return platform;
  }
  return 'unknown';
}

/**
 * 检查 bubblewrap 是否可用 (Linux)
 */
export function isBubblewrapAvailable(): boolean {
  if (getPlatform() !== 'linux') {
    return false;
  }
  try {
    const result = spawnSync('which', ['bwrap'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * 检查 seatbelt 是否可用 (macOS)
 */
export function isSeatbeltAvailable(): boolean {
  if (getPlatform() !== 'darwin') {
    return false;
  }
  try {
    // macOS 自带 sandbox-exec
    const result = spawnSync('which', ['sandbox-exec'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * 检查是否有任何沙箱可用
 */
export function isSandboxAvailable(): boolean {
  return isBubblewrapAvailable() || isSeatbeltAvailable();
}

/**
 * 获取可用的沙箱类型
 */
export function getSandboxType(): SandboxType {
  if (isBubblewrapAvailable()) {
    return 'bubblewrap';
  }
  if (isSeatbeltAvailable()) {
    return 'seatbelt';
  }
  return 'none';
}

// ============ 沙箱状态 ============

/**
 * 沙箱状态信息
 */
export function getSandboxStatus(): {
  available: boolean;
  type: SandboxType;
  version?: string;
  platform: string;
  reason?: string;
} {
  const platform = getPlatform();

  if (isBubblewrapAvailable()) {
    try {
      const result = spawnSync('bwrap', ['--version'], { encoding: 'utf-8' });
      const version = result.stdout?.trim() || result.stderr?.trim();
      return {
        available: true,
        type: 'bubblewrap',
        version,
        platform,
      };
    } catch {
      return { available: true, type: 'bubblewrap', platform };
    }
  }

  if (isSeatbeltAvailable()) {
    return {
      available: true,
      type: 'seatbelt',
      version: 'macOS built-in',
      platform,
    };
  }

  // 返回不可用的原因
  let reason: string;
  if (platform === 'win32') {
    reason = 'Windows does not support sandboxing. Consider using WSL for sandbox support.';
  } else if (platform === 'linux') {
    reason = 'Bubblewrap (bwrap) is not installed. Install it with your package manager.';
  } else if (platform === 'darwin') {
    reason = 'sandbox-exec is not available on this macOS version.';
  } else {
    reason = `Unsupported platform: ${platform}`;
  }

  return { available: false, type: 'none', platform, reason };
}

// ============ Bubblewrap 配置 (Linux) ============

/**
 * 获取 Bubblewrap 的默认配置
 */
function getBubblewrapConfig(cwd: string, options: SandboxOptions = {}): string[] {
  const home = os.homedir();
  const tmpDir = '/tmp/claude';

  const config: string[] = [
    // 基本的隔离设置
    '--unshare-all',        // 取消共享所有命名空间
    '--die-with-parent',    // 父进程退出时终止
  ];

  // 网络访问控制
  if (options.network !== false) {
    config.push('--share-net');
  }

  // 基础文件系统 - 只读绑定
  const readOnlyDirs = ['/usr', '/bin', '/lib', '/lib64', '/sbin'];
  for (const dir of readOnlyDirs) {
    if (fs.existsSync(dir)) {
      config.push('--ro-bind', dir, dir);
    }
  }

  // 符号链接
  config.push('--symlink', '/usr/lib', '/lib');
  config.push('--symlink', '/usr/lib64', '/lib64');
  config.push('--symlink', '/usr/bin', '/bin');
  config.push('--symlink', '/usr/sbin', '/sbin');

  // /etc 下的必要文件
  const etcFiles = [
    '/etc/resolv.conf',
    '/etc/hosts',
    '/etc/passwd',
    '/etc/group',
    '/etc/ssl',
    '/etc/ca-certificates',
    '/etc/nsswitch.conf',
    '/etc/protocols',
    '/etc/services',
    '/etc/localtime',
    '/etc/alternatives',
  ];

  for (const file of etcFiles) {
    if (fs.existsSync(file)) {
      try {
        config.push('--ro-bind', file, file);
      } catch {
        // 忽略无法绑定的文件
      }
    }
  }

  // /proc 访问
  if (options.allowProcAccess !== false) {
    config.push('--proc', '/proc');
  }

  // /dev 访问
  if (options.allowDevAccess !== false) {
    config.push('--dev', '/dev');
  } else {
    // 最小化 /dev 访问 - 只允许必要的设备
    config.push('--dev-bind', '/dev/null', '/dev/null');
    config.push('--dev-bind', '/dev/zero', '/dev/zero');
    config.push('--dev-bind', '/dev/random', '/dev/random');
    config.push('--dev-bind', '/dev/urandom', '/dev/urandom');
    if (fs.existsSync('/dev/tty')) {
      config.push('--dev-bind', '/dev/tty', '/dev/tty');
    }
  }

  // /sys 访问（默认不允许）
  if (options.allowSysAccess === true && fs.existsSync('/sys')) {
    config.push('--ro-bind', '/sys', '/sys');
  }

  // 创建沙箱专用临时目录
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    config.push('--bind', tmpDir, '/tmp');
    // 设置 TMPDIR 环境变量
    config.push('--setenv', 'TMPDIR', '/tmp/claude');
  } catch {
    config.push('--tmpfs', '/tmp');
  }

  // 工作目录（可写）
  if (fs.existsSync(cwd)) {
    config.push('--bind', cwd, cwd);
    config.push('--chdir', cwd);
  }

  // 用户目录（默认只读）
  if (fs.existsSync(home)) {
    config.push('--ro-bind', home, home);
  }

  // Node.js 和 npm 相关
  if (fs.existsSync('/usr/local')) {
    config.push('--ro-bind', '/usr/local', '/usr/local');
  }

  // 默认可写路径
  for (const p of sandboxConfig.defaultWritablePaths) {
    if (fs.existsSync(p)) {
      config.push('--bind', p, p);
    }
  }

  // 默认只读路径
  for (const p of sandboxConfig.defaultReadOnlyPaths) {
    if (fs.existsSync(p)) {
      config.push('--ro-bind', p, p);
    }
  }

  return config;
}

// ============ Seatbelt 配置 (macOS) ============

/**
 * 生成 Seatbelt 配置文件内容
 */
function getSeatbeltProfile(cwd: string, options: SandboxOptions = {}): string {
  const home = os.homedir();

  let profile = `
(version 1)
(deny default)

;; Allow basic process operations
(allow process-fork)
(allow process-exec)
(allow signal (target self))

;; Allow read access to system libraries and executables
(allow file-read* (subpath "/usr"))
(allow file-read* (subpath "/bin"))
(allow file-read* (subpath "/sbin"))
(allow file-read* (subpath "/Library"))
(allow file-read* (subpath "/System"))
(allow file-read* (subpath "/Applications"))
(allow file-read* (subpath "/private/var"))
(allow file-read* (subpath "/var"))

;; Allow read/write access to working directory
(allow file-read* (subpath "${cwd}"))
(allow file-write* (subpath "${cwd}"))

;; Allow read access to home directory (for configs)
(allow file-read* (subpath "${home}"))

;; Allow read/write to temp directories
(allow file-read* (subpath "/tmp"))
(allow file-write* (subpath "/tmp"))
(allow file-read* (subpath "/private/tmp"))
(allow file-write* (subpath "/private/tmp"))

;; Allow access to /dev
(allow file-read* (subpath "/dev"))
(allow file-write* (literal "/dev/null"))
(allow file-write* (literal "/dev/tty"))
(allow file-read-data (literal "/dev/urandom"))
(allow file-read-data (literal "/dev/random"))

;; Allow mach operations
(allow mach-lookup)
(allow mach-bootstrap)

;; Allow IPC
(allow ipc-posix-shm)

;; Allow sysctl reads
(allow sysctl-read)
`;

  // 网络访问
  if (options.network !== false) {
    profile += `
;; Allow network access
(allow network*)
`;
  }

  // 额外的可写路径
  for (const p of (options.writablePaths || [])) {
    profile += `(allow file-read* (subpath "${p}"))\n`;
    profile += `(allow file-write* (subpath "${p}"))\n`;
  }

  // 额外的只读路径
  for (const p of (options.readOnlyPaths || [])) {
    profile += `(allow file-read* (subpath "${p}"))\n`;
  }

  // 默认路径
  for (const p of sandboxConfig.defaultWritablePaths) {
    profile += `(allow file-read* (subpath "${p}"))\n`;
    profile += `(allow file-write* (subpath "${p}"))\n`;
  }
  for (const p of sandboxConfig.defaultReadOnlyPaths) {
    profile += `(allow file-read* (subpath "${p}"))\n`;
  }

  return profile;
}

// ============ 执行函数 ============

/**
 * 使用 Bubblewrap 执行命令 (Linux)
 */
async function executeWithBubblewrap(
  command: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const {
    cwd = process.cwd(),
    env = {},
    timeout = 120000,
    writablePaths = [],
    readOnlyPaths = [],
    network = true,
    allowDevAccess = true,
    allowProcAccess = true,
    allowSysAccess = false,
    envWhitelist,
  } = options;

  // 构建 bwrap 参数
  const bwrapArgs = getBubblewrapConfig(cwd, {
    network,
    allowDevAccess,
    allowProcAccess,
    allowSysAccess,
  });

  // 添加额外的可写路径
  for (const p of writablePaths) {
    if (fs.existsSync(p)) {
      bwrapArgs.push('--bind', p, p);
    }
  }

  // 添加额外的只读路径
  for (const p of readOnlyPaths) {
    if (fs.existsSync(p)) {
      bwrapArgs.push('--ro-bind', p, p);
    }
  }

  // 准备环境变量
  let sandboxEnv: Record<string, string | undefined> = { ...process.env, ...env };

  // 如果指定了环境变量白名单，则过滤
  if (envWhitelist && envWhitelist.length > 0) {
    const filteredEnv: Record<string, string> = {};
    for (const key of envWhitelist) {
      if (sandboxEnv[key]) {
        filteredEnv[key] = sandboxEnv[key]!;
      }
    }
    // 保留一些必要的环境变量
    const essentialVars = ['PATH', 'HOME', 'USER', 'LANG', 'TERM', 'SHELL'];
    for (const key of essentialVars) {
      if (sandboxEnv[key] && !filteredEnv[key]) {
        filteredEnv[key] = sandboxEnv[key]!;
      }
    }
    sandboxEnv = filteredEnv;
  }

  // 添加命令
  bwrapArgs.push('--', 'bash', '-c', command);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bwrap', bwrapArgs, {
      env: sandboxEnv as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        killed,
        sandboxed: true,
        sandboxType: 'bubblewrap',
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        killed: false,
        error: err.message,
        sandboxed: false,
        sandboxType: 'bubblewrap',
      });
    });
  });
}

/**
 * 使用 Seatbelt 执行命令 (macOS)
 */
async function executeWithSeatbelt(
  command: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const {
    cwd = process.cwd(),
    env = {},
    timeout = 120000,
    writablePaths = [],
    readOnlyPaths = [],
    network = true,
  } = options;

  // 生成 Seatbelt 配置
  const profile = getSeatbeltProfile(cwd, { writablePaths, readOnlyPaths, network });

  // 创建临时配置文件
  const profilePath = path.join(os.tmpdir(), `claude-sandbox-${Date.now()}.sb`);

  try {
    fs.writeFileSync(profilePath, profile);
  } catch (err) {
    return {
      stdout: '',
      stderr: '',
      exitCode: null,
      killed: false,
      error: `Failed to create sandbox profile: ${err}`,
      sandboxed: false,
      sandboxType: 'seatbelt',
    };
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('sandbox-exec', ['-f', profilePath, 'bash', '-c', command], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      // 清理临时配置文件
      try {
        fs.unlinkSync(profilePath);
      } catch {
        // 忽略清理错误
      }
      resolve({
        stdout,
        stderr,
        exitCode: code,
        killed,
        sandboxed: true,
        sandboxType: 'seatbelt',
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      // 清理临时配置文件
      try {
        fs.unlinkSync(profilePath);
      } catch {
        // 忽略清理错误
      }
      resolve({
        stdout,
        stderr,
        exitCode: null,
        killed: false,
        error: err.message,
        sandboxed: false,
        sandboxType: 'seatbelt',
      });
    });
  });
}

/**
 * 直接执行命令（无沙箱）
 */
async function executeDirectly(
  command: string,
  options: { cwd: string; env: Record<string, string>; timeout: number }
): Promise<SandboxResult> {
  const { cwd, env, timeout } = options;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        killed,
        sandboxed: false,
        sandboxType: 'none',
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        killed: false,
        error: err.message,
        sandboxed: false,
        sandboxType: 'none',
      });
    });
  });
}

// ============ 主执行函数 ============

/**
 * 使用沙箱执行命令 - 自动选择最佳沙箱
 */
export async function executeInSandbox(
  command: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const {
    cwd = process.cwd(),
    env = {},
    timeout = 120000,
    disableSandbox = false,
  } = options;

  // 如果禁用沙箱或沙箱不可用，直接执行
  if (disableSandbox || !sandboxConfig.enabled) {
    return executeDirectly(command, { cwd, env, timeout });
  }

  const sandboxType = getSandboxType();

  try {
    if (sandboxType === 'bubblewrap') {
      return await executeWithBubblewrap(command, options);
    } else if (sandboxType === 'seatbelt') {
      return await executeWithSeatbelt(command, options);
    } else {
      // 没有可用的沙箱
      if (sandboxConfig.fallbackOnError) {
        return executeDirectly(command, { cwd, env, timeout });
      } else {
        return {
          stdout: '',
          stderr: '',
          exitCode: null,
          killed: false,
          error: 'No sandbox available and fallback is disabled',
          sandboxed: false,
          sandboxType: 'none',
        };
      }
    }
  } catch (err) {
    // 沙箱执行失败，尝试降级
    if (sandboxConfig.fallbackOnError) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[Sandbox] Execution failed, falling back to direct execution: ${errorMessage}`);
      return executeDirectly(command, { cwd, env, timeout });
    } else {
      return {
        stdout: '',
        stderr: '',
        exitCode: null,
        killed: false,
        error: `Sandbox execution failed: ${err}`,
        sandboxed: false,
        sandboxType: sandboxType,
      };
    }
  }
}

// ============ 沙箱错误处理 ============

/**
 * 检测是否是沙箱相关的错误
 */
export function isSandboxError(error: string): boolean {
  const sandboxErrorPatterns = [
    /permission denied/i,
    /operation not permitted/i,
    /sandbox violation/i,
    /bwrap:/i,
    /sandbox-exec/i,
    /EPERM/i,
    /EACCES/i,
    /can't access/i,
    /read-only file system/i,
  ];

  return sandboxErrorPatterns.some(pattern => pattern.test(error));
}

/**
 * 获取沙箱错误提示信息
 */
export function getSandboxErrorHint(error: string): string {
  if (isSandboxError(error)) {
    return `
This error may be caused by sandbox restrictions. To retry without sandbox:
1. Set dangerouslyDisableSandbox: true in the Bash tool call
2. Or use /sandbox command to manage sandbox settings

Note: Only bypass sandbox if the command failed due to sandbox restrictions.
`.trim();
  }
  return '';
}

/**
 * 格式化沙箱错误消息
 */
export function formatSandboxError(result: SandboxResult): string {
  if (result.error && sandboxConfig.showSandboxErrors) {
    let message = `Sandbox Error: ${result.error}`;

    if (result.sandboxType !== 'none') {
      message += `\nSandbox Type: ${result.sandboxType}`;
    }

    const hint = getSandboxErrorHint(result.error);
    if (hint) {
      message += `\n\n${hint}`;
    }

    return message;
  }
  return result.error || '';
}
