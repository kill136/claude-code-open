/**
 * Bubblewrap Sandbox Integration
 * Enhanced Linux sandboxing using bwrap with comprehensive mount and namespace management
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

export interface BindMount {
  source: string;
  dest: string;
  readonly?: boolean;
}

export interface BubblewrapOptions {
  unshareUser?: boolean;
  unshareNetwork?: boolean;
  unsharePid?: boolean;
  bindMounts?: BindMount[];
  roBindMounts?: BindMount[];
  tmpfsMounts?: string[];
  devBinds?: boolean;
  procMount?: boolean;
  dieWithParent?: boolean;
  newSession?: boolean;
  shareNet?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface BubblewrapConfig {
  enabled: boolean;
  allowNetwork: boolean;
  allowWrite: string[];
  allowRead: string[];
  tmpfsSize?: string;
  unshareAll?: boolean;
  shareNet?: boolean;
  dieWithParent?: boolean;
  newSession?: boolean;
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
  killed?: boolean;
  error?: string;
  duration?: number;
}

export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CONFIG: BubblewrapConfig = {
  enabled: true,
  allowNetwork: false,
  allowWrite: ['/tmp'],
  allowRead: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
  tmpfsSize: '100M',
  unshareAll: true,
  dieWithParent: true,
  newSession: true,
};

const DEFAULT_OPTIONS: Required<Omit<BubblewrapOptions, 'cwd' | 'env' | 'timeout'>> = {
  unshareUser: true,
  unshareNetwork: true,
  unsharePid: true,
  bindMounts: [],
  roBindMounts: [],
  tmpfsMounts: ['/tmp'],
  devBinds: true,
  procMount: true,
  dieWithParent: true,
  newSession: true,
  shareNet: false,
};

// ============================================================================
// Bubblewrap Availability
// ============================================================================

let bubblewrapAvailable: boolean | null = null;
let bubblewrapVersion: string | null = null;

/**
 * Check if bubblewrap is available on the system
 */
export function isBubblewrapAvailable(): boolean {
  if (bubblewrapAvailable !== null) {
    return bubblewrapAvailable;
  }

  // Only available on Linux
  if (os.platform() !== 'linux') {
    bubblewrapAvailable = false;
    return false;
  }

  try {
    child_process.execSync('which bwrap', { stdio: 'ignore' });
    bubblewrapAvailable = true;
  } catch {
    bubblewrapAvailable = false;
  }

  return bubblewrapAvailable;
}

/**
 * Get bubblewrap version
 */
export function getBubblewrapVersion(): string | null {
  if (bubblewrapVersion !== null) {
    return bubblewrapVersion;
  }

  if (!isBubblewrapAvailable()) {
    return null;
  }

  try {
    const result = child_process.execSync('bwrap --version', { encoding: 'utf-8' });
    bubblewrapVersion = result.trim();
    return bubblewrapVersion;
  } catch {
    return null;
  }
}

// ============================================================================
// BubblewrapSandbox Class
// ============================================================================

export class BubblewrapSandbox {
  private options: BubblewrapOptions;
  private bindMounts: BindMount[] = [];
  private roBindMounts: BindMount[] = [];
  private tmpfsMounts: string[] = [];

  /**
   * Check if bubblewrap is available
   */
  static isAvailable(): Promise<boolean> {
    return Promise.resolve(isBubblewrapAvailable());
  }

  /**
   * Get bubblewrap version
   */
  static getVersion(): Promise<string | null> {
    return Promise.resolve(getBubblewrapVersion());
  }

  constructor(options: BubblewrapOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.bindMounts = [...(options.bindMounts || [])];
    this.roBindMounts = [...(options.roBindMounts || [])];
    this.tmpfsMounts = [...(options.tmpfsMounts || ['/tmp'])];
  }

  /**
   * Add a bind mount
   */
  addBindMount(source: string, dest: string, readonly: boolean = false): void {
    const mount: BindMount = { source, dest, readonly };
    if (readonly) {
      this.roBindMounts.push(mount);
    } else {
      this.bindMounts.push(mount);
    }
  }

  /**
   * Add multiple bind mounts
   */
  addBindMounts(mounts: BindMount[]): void {
    for (const mount of mounts) {
      this.addBindMount(mount.source, mount.dest, mount.readonly);
    }
  }

  /**
   * Add a tmpfs mount
   */
  addTmpfsMount(path: string): void {
    if (!this.tmpfsMounts.includes(path)) {
      this.tmpfsMounts.push(path);
    }
  }

  /**
   * Build command arguments for bwrap
   */
  buildCommand(command: string, args: string[] = []): string[] {
    const bwrapArgs = createBubblewrapArgs({
      ...this.options,
      bindMounts: this.bindMounts,
      roBindMounts: this.roBindMounts,
      tmpfsMounts: this.tmpfsMounts,
    });

    return ['bwrap', ...bwrapArgs, command, ...args];
  }

  /**
   * Execute a command in the sandbox
   */
  async execute(command: string, args: string[] = []): Promise<ExecutionResult> {
    if (!isBubblewrapAvailable()) {
      return this.executeFallback(command, args);
    }

    const bwrapArgs = createBubblewrapArgs({
      ...this.options,
      bindMounts: this.bindMounts,
      roBindMounts: this.roBindMounts,
      tmpfsMounts: this.tmpfsMounts,
    });

    const fullArgs = [...bwrapArgs, command, ...args];
    const startTime = Date.now();

    return new Promise((resolve) => {
      const proc = child_process.spawn('bwrap', fullArgs, {
        env: this.options.env || process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.timeout || 60000,
        cwd: this.options.cwd || process.cwd(),
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          sandboxed: true,
          killed,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        // Fallback to unsandboxed execution
        this.executeFallback(command, args).then(resolve);
      });

      // Handle timeout
      if (this.options.timeout) {
        setTimeout(() => {
          if (!proc.killed) {
            killed = true;
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill('SIGKILL');
              }
            }, 1000);
          }
        }, this.options.timeout);
      }
    });
  }

  /**
   * Execute without sandbox (fallback)
   */
  private async executeFallback(command: string, args: string[]): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const proc = child_process.spawn(command, args, {
        env: this.options.env || process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.timeout || 60000,
        cwd: this.options.cwd || process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          sandboxed: false,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr,
          sandboxed: false,
          error: err.message,
          duration: Date.now() - startTime,
        });
      });
    });
  }
}

// ============================================================================
// Argument Building Functions
// ============================================================================

/**
 * Create bubblewrap arguments from options
 */
export function createBubblewrapArgs(options: BubblewrapOptions = {}): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const args: string[] = [];

  // Namespace isolation
  if (opts.unshareUser || opts.unsharePid || opts.unshareNetwork) {
    // Unshare all by default, then selectively share
    args.push('--unshare-all');
  }

  // Network sharing
  if (opts.shareNet || !opts.unshareNetwork) {
    args.push('--share-net');
  }

  // Process management
  if (opts.dieWithParent) {
    args.push('--die-with-parent');
  }

  if (opts.newSession) {
    args.push('--new-session');
  }

  // Read-only bind mounts
  if (opts.roBindMounts && opts.roBindMounts.length > 0) {
    for (const mount of opts.roBindMounts) {
      if (fs.existsSync(mount.source)) {
        args.push('--ro-bind', mount.source, mount.dest);
      }
    }
  }

  // Writable bind mounts
  if (opts.bindMounts && opts.bindMounts.length > 0) {
    for (const mount of opts.bindMounts) {
      if (fs.existsSync(mount.source)) {
        args.push('--bind', mount.source, mount.dest);
      }
    }
  }

  // Standard system paths (read-only)
  const systemPaths = ['/usr', '/lib', '/lib64', '/bin', '/sbin'];
  for (const sysPath of systemPaths) {
    if (fs.existsSync(sysPath)) {
      args.push('--ro-bind', sysPath, sysPath);
    }
  }

  // Essential /etc files
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
  ];

  for (const file of etcFiles) {
    if (fs.existsSync(file)) {
      args.push('--ro-bind', file, file);
    }
  }

  // /proc filesystem
  if (opts.procMount) {
    args.push('--proc', '/proc');
  }

  // /dev filesystem
  if (opts.devBinds) {
    args.push('--dev', '/dev');
  } else {
    // Minimal /dev access
    const minimalDevs = ['/dev/null', '/dev/zero', '/dev/random', '/dev/urandom'];
    for (const dev of minimalDevs) {
      if (fs.existsSync(dev)) {
        args.push('--dev-bind', dev, dev);
      }
    }
  }

  // Tmpfs mounts
  if (opts.tmpfsMounts && opts.tmpfsMounts.length > 0) {
    for (const tmpPath of opts.tmpfsMounts) {
      args.push('--tmpfs', tmpPath);
    }
  }

  // Working directory
  const cwd = opts.cwd || process.cwd();
  if (fs.existsSync(cwd)) {
    args.push('--bind', cwd, cwd);
    args.push('--chdir', cwd);
  }

  // Home directory (read-only by default)
  const home = os.homedir();
  if (fs.existsSync(home)) {
    args.push('--ro-bind', home, home);
  }

  // Add separator before actual command
  args.push('--');

  return args;
}

/**
 * Build bubblewrap command arguments (legacy support)
 */
export function buildBwrapArgs(
  command: string,
  args: string[],
  config: Partial<BubblewrapConfig> = {}
): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bwrapArgs: string[] = [];

  // Unshare namespaces
  if (cfg.unshareAll) {
    bwrapArgs.push('--unshare-all');
  }

  // Network
  if (cfg.shareNet || cfg.allowNetwork) {
    bwrapArgs.push('--share-net');
  }

  // Die with parent
  if (cfg.dieWithParent) {
    bwrapArgs.push('--die-with-parent');
  }

  // New session
  if (cfg.newSession) {
    bwrapArgs.push('--new-session');
  }

  // Bind mount read-only paths
  for (const readPath of cfg.allowRead) {
    if (fs.existsSync(readPath)) {
      bwrapArgs.push('--ro-bind', readPath, readPath);
    }
  }

  // Bind mount writable paths
  for (const writePath of cfg.allowWrite) {
    if (fs.existsSync(writePath)) {
      bwrapArgs.push('--bind', writePath, writePath);
    }
  }

  // Current working directory
  const cwd = process.cwd();
  if (!cfg.allowWrite.includes(cwd)) {
    bwrapArgs.push('--bind', cwd, cwd);
  }

  // Home directory (read-only by default)
  const home = os.homedir();
  if (!cfg.allowRead.includes(home) && !cfg.allowWrite.includes(home)) {
    bwrapArgs.push('--ro-bind', home, home);
  }

  // Proc filesystem
  bwrapArgs.push('--proc', '/proc');

  // Dev filesystem
  bwrapArgs.push('--dev', '/dev');

  // Tmpfs
  if (cfg.tmpfsSize) {
    bwrapArgs.push('--tmpfs', '/tmp');
  }

  // Set working directory
  bwrapArgs.push('--chdir', cwd);

  // Add the command
  bwrapArgs.push(command, ...args);

  return bwrapArgs;
}

// ============================================================================
// Execution Functions
// ============================================================================

/**
 * Execute command in sandbox
 */
export async function execInSandbox(
  command: string,
  args: string[] = [],
  options: {
    config?: Partial<BubblewrapConfig>;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<SandboxResult> {
  const { config = {}, timeout = 60000, env = process.env } = options;

  // Check if sandbox is available and enabled
  if (!isBubblewrapAvailable() || config.enabled === false) {
    // Fall back to unsandboxed execution
    return new Promise((resolve) => {
      const proc = child_process.spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          sandboxed: false,
        });
      });

      proc.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: err.message,
          sandboxed: false,
        });
      });
    });
  }

  // Build bwrap arguments
  const bwrapArgs = buildBwrapArgs(command, args, config);

  return new Promise((resolve) => {
    const proc = child_process.spawn('bwrap', bwrapArgs, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        sandboxed: true,
      });
    });

    proc.on('error', (err) => {
      // If bwrap fails, fall back to unsandboxed
      const fallbackProc = child_process.spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });

      let fallbackStdout = '';
      let fallbackStderr = '';

      fallbackProc.stdout.on('data', (data) => {
        fallbackStdout += data.toString();
      });

      fallbackProc.stderr.on('data', (data) => {
        fallbackStderr += data.toString();
      });

      fallbackProc.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout: fallbackStdout,
          stderr: fallbackStderr,
          sandboxed: false,
        });
      });

      fallbackProc.on('error', (fallbackErr) => {
        resolve({
          exitCode: 1,
          stdout: '',
          stderr: fallbackErr.message,
          sandboxed: false,
        });
      });
    });
  });
}

/**
 * Create a sandboxed shell function
 */
export function createSandboxedBash(
  config: Partial<BubblewrapConfig> = {}
): (command: string, timeout?: number) => Promise<SandboxResult> {
  return async (command: string, timeout?: number): Promise<SandboxResult> => {
    return execInSandbox('bash', ['-c', command], { config, timeout });
  };
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check if command is available
 */
function checkCommand(cmd: string): boolean {
  try {
    child_process.execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check sandbox capabilities
 */
export function getSandboxCapabilities(): {
  bubblewrap: boolean;
  firejail: boolean;
  docker: boolean;
  macosSandbox: boolean;
} {
  const platform = os.platform();

  return {
    bubblewrap: platform === 'linux' && isBubblewrapAvailable(),
    firejail: platform === 'linux' && checkCommand('firejail'),
    docker: checkCommand('docker'),
    macosSandbox: platform === 'darwin',
  };
}

/**
 * Get recommended sandbox for current platform
 */
export function getRecommendedSandbox(): string | null {
  const caps = getSandboxCapabilities();

  if (caps.bubblewrap) return 'bubblewrap';
  if (caps.firejail) return 'firejail';
  if (caps.macosSandbox) return 'macos-sandbox';
  if (caps.docker) return 'docker';

  return null;
}

/**
 * Sandbox info for display
 */
export function getSandboxInfo(): {
  available: boolean;
  type: string | null;
  version?: string | null;
  capabilities: ReturnType<typeof getSandboxCapabilities>;
} {
  const caps = getSandboxCapabilities();
  const recommended = getRecommendedSandbox();

  return {
    available: recommended !== null,
    type: recommended,
    version: recommended === 'bubblewrap' ? getBubblewrapVersion() : null,
    capabilities: caps,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple sandbox with common defaults
 */
export function createSimpleSandbox(options: {
  allowNetwork?: boolean;
  allowWrite?: string[];
  allowRead?: string[];
} = {}): BubblewrapSandbox {
  const sandbox = new BubblewrapSandbox({
    unshareUser: true,
    unshareNetwork: !options.allowNetwork,
    unsharePid: true,
    devBinds: true,
    procMount: true,
    dieWithParent: true,
    newSession: true,
  });

  // Add writable paths
  if (options.allowWrite) {
    for (const writePath of options.allowWrite) {
      if (fs.existsSync(writePath)) {
        sandbox.addBindMount(writePath, writePath, false);
      }
    }
  }

  // Add read-only paths
  if (options.allowRead) {
    for (const readPath of options.allowRead) {
      if (fs.existsSync(readPath)) {
        sandbox.addBindMount(readPath, readPath, true);
      }
    }
  }

  return sandbox;
}

/**
 * Test sandbox functionality
 */
export async function testSandbox(): Promise<{
  available: boolean;
  working: boolean;
  error?: string;
}> {
  if (!isBubblewrapAvailable()) {
    return { available: false, working: false, error: 'Bubblewrap not available' };
  }

  try {
    const sandbox = new BubblewrapSandbox({
      unshareUser: true,
      unshareNetwork: true,
      unsharePid: true,
      timeout: 5000,
    });

    const result = await sandbox.execute('echo', ['test']);

    return {
      available: true,
      working: result.exitCode === 0 && result.stdout.trim() === 'test',
      error: result.exitCode !== 0 ? result.stderr : undefined,
    };
  } catch (err: any) {
    return {
      available: true,
      working: false,
      error: err.message,
    };
  }
}
