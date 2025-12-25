/**
 * 沙箱执行支持
 * 使用 Bubblewrap (bwrap) 实现命令隔离
 */

import { spawn, spawnSync, SpawnSyncReturns } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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
}

/**
 * 检查 bubblewrap 是否可用
 */
export function isBubblewrapAvailable(): boolean {
  try {
    const result = spawnSync('which', ['bwrap'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * 获取沙箱的默认配置
 */
function getDefaultSandboxConfig(cwd: string, options: SandboxOptions = {}): string[] {
  const home = os.homedir();
  const tmpDir = os.tmpdir();

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
  const readOnlyDirs = ['/usr', '/bin', '/lib', '/lib64'];
  for (const dir of readOnlyDirs) {
    if (fs.existsSync(dir)) {
      config.push('--ro-bind', dir, dir);
    }
  }

  // 符号链接
  config.push('--symlink', '/usr/lib', '/lib');
  config.push('--symlink', '/usr/lib64', '/lib64');
  config.push('--symlink', '/usr/bin', '/bin');

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
  }

  // /sys 访问（默认不允许）
  if (options.allowSysAccess === true && fs.existsSync('/sys')) {
    config.push('--ro-bind', '/sys', '/sys');
  }

  // 临时目录
  config.push('--tmpfs', '/tmp');
  if (fs.existsSync(tmpDir)) {
    config.push('--bind', tmpDir, tmpDir);
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

  return config;
}

/**
 * 使用沙箱执行命令
 */
export async function executeInSandbox(
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
    disableSandbox = false,
    allowDevAccess = true,
    allowProcAccess = true,
    allowSysAccess = false,
    envWhitelist,
  } = options;

  // 如果禁用沙箱或 bwrap 不可用，直接执行
  if (disableSandbox || !isBubblewrapAvailable()) {
    return executeDirectly(command, { cwd, env, timeout });
  }

  // 构建 bwrap 参数
  const bwrapArgs = getDefaultSandboxConfig(cwd, {
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
  let sandboxEnv = { ...process.env, ...env };

  // 如果指定了环境变量白名单，则过滤
  if (envWhitelist && envWhitelist.length > 0) {
    const filteredEnv: Record<string, string> = {};
    for (const key of envWhitelist) {
      if (sandboxEnv[key]) {
        filteredEnv[key] = sandboxEnv[key];
      }
    }
    // 保留一些必要的环境变量
    const essentialVars = ['PATH', 'HOME', 'USER', 'LANG', 'TERM'];
    for (const key of essentialVars) {
      if (sandboxEnv[key] && !filteredEnv[key]) {
        filteredEnv[key] = sandboxEnv[key];
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
      env: sandboxEnv,
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
      });
    });
  });
}

/**
 * 沙箱状态信息
 */
export function getSandboxStatus(): {
  available: boolean;
  type: 'bubblewrap' | 'none';
  version?: string;
} {
  if (isBubblewrapAvailable()) {
    try {
      const result = spawnSync('bwrap', ['--version'], { encoding: 'utf-8' });
      const version = result.stdout?.trim() || result.stderr?.trim();
      return {
        available: true,
        type: 'bubblewrap',
        version,
      };
    } catch {
      return { available: true, type: 'bubblewrap' };
    }
  }

  return { available: false, type: 'none' };
}
