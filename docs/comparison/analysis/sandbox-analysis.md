# 沙箱系统模块分析报告

## 执行摘要

本报告分析了官方 Claude Code 的沙箱系统实现，并对比了本项目的现有实现。由于官方源码（cli.js）是压缩混淆的，主要分析依据来自 TypeScript 定义文件（sdk-tools.d.ts）和已知的沙箱技术。

**关键发现：**
- 官方支持沙箱模式，通过 `dangerouslyDisableSandbox` 参数控制
- 本项目已实现基础的 Bubblewrap（Linux）沙箱
- 缺失 macOS Seatbelt 和 Docker 容器模式支持

---

## 官方源码分析

### 1. Bash 工具沙箱支持

**来源：** `/node_modules/@anthropic-ai/claude-code/sdk-tools.d.ts` (行 57-89)

```typescript
export interface BashInput {
  /**
   * The command to execute
   */
  command: string;

  /**
   * Optional timeout in milliseconds (max 600000)
   */
  timeout?: number;

  /**
   * Clear, concise description of what this command does
   */
  description?: string;

  /**
   * Set to true to run this command in the background
   */
  run_in_background?: boolean;

  /**
   * Set this to true to dangerously override sandbox mode
   * and run commands without sandboxing.
   */
  dangerouslyDisableSandbox?: boolean;
}
```

**关键推断：**
- 默认情况下，Bash 命令在沙箱模式下运行
- 沙箱可通过 `dangerouslyDisableSandbox: true` 禁用
- 这意味着官方实现了完整的沙箱隔离机制

### 2. Bubblewrap (Linux) 实现推断

虽然官方源码被混淆，但根据 Bubblewrap 的标准用法，官方实现应包含：

**命令参数推断：**
```bash
bwrap \
  --unshare-all \              # 取消共享所有命名空间
  --share-net \                # 可选：共享网络（如果允许）
  --die-with-parent \          # 父进程死亡时终止
  --new-session \              # 创建新会话
  --ro-bind /usr /usr \        # 只读挂载系统路径
  --ro-bind /lib /lib \
  --ro-bind /lib64 /lib64 \
  --ro-bind /bin /bin \
  --ro-bind /sbin /sbin \
  --ro-bind /etc/resolv.conf /etc/resolv.conf \
  --ro-bind /etc/hosts /etc/hosts \
  --ro-bind /etc/passwd /etc/passwd \
  --ro-bind /etc/group /etc/group \
  --proc /proc \               # 挂载 /proc
  --dev /dev \                 # 挂载 /dev
  --tmpfs /tmp \               # tmpfs 挂载 /tmp
  --bind $CWD $CWD \           # 绑定当前工作目录
  --chdir $CWD \               # 切换到工作目录
  -- \
  bash -c "command"
```

**挂载点配置推断：**
- **只读系统路径：** `/usr`, `/lib`, `/lib64`, `/bin`, `/sbin`, `/etc/*`
- **可写路径：** `/tmp`, 当前工作目录
- **特殊文件系统：** `/proc`, `/dev`

### 3. Seatbelt (macOS) 实现推断

macOS 上使用 `sandbox-exec` 命令和 Seatbelt 配置文件：

**基本用法：**
```bash
sandbox-exec -f /path/to/profile.sb command args...
```

**推断的配置规则：**
```scheme
(version 1)
(debug deny)

;; 拒绝所有操作（默认）
(deny default)

;; 允许基本系统操作
(allow process*)
(allow signal*)

;; 允许读取系统路径
(allow file-read*
    (subpath "/usr")
    (subpath "/System")
    (subpath "/Library"))

;; 允许读写临时目录
(allow file*
    (subpath "/tmp")
    (subpath "/var/tmp"))

;; 允许读写工作目录
(allow file*
    (subpath (param "CWD")))

;; 网络访问控制
(if (param "allow-network")
    (allow network*)
    (deny network*))
```

### 4. Docker 集成推断

**基本命令格式：**
```bash
docker run \
  --rm \                       # 退出时删除容器
  --interactive \              # 交互模式
  --tty \                      # 分配 TTY
  --network bridge \           # 网络模式
  --memory 1g \                # 内存限制
  --cpus 1.0 \                 # CPU 限制
  --read-only \                # 根文件系统只读
  --tmpfs /tmp:rw,size=100m \ # tmpfs 挂载
  -v $CWD:/workspace:rw \      # 挂载工作目录
  -w /workspace \              # 工作目录
  --user $(id -u):$(id -g) \   # 用户映射
  node:20-alpine \             # 基础镜像
  sh -c "command"
```

**镜像配置推断：**
- 默认镜像：`node:20-alpine`（轻量级）
- 支持自定义镜像
- 卷挂载：工作目录映射到容器内

### 5. 资源限制

**推断的资源控制：**
```typescript
interface ResourceLimits {
  maxMemory?: number;        // 最大内存（字节）
  maxCpu?: number;           // CPU 使用率（0-100）
  maxProcesses?: number;     // 最大进程数
  maxFileSize?: number;      // 最大文件大小（字节）
  maxExecutionTime?: number; // 最大执行时间（毫秒）
  maxFileDescriptors?: number; // 最大文件描述符
}
```

**实现方式：**
- **Linux (cgroups):** 通过 Bubblewrap 或直接配置 cgroups
- **macOS:** 通过 `launchctl` 或 Seatbelt 配置
- **Docker:** 通过 `--memory`, `--cpus` 等参数

---

## 本项目现有实现分析

### 已实现模块

#### 1. Bubblewrap 沙箱 (`src/sandbox/bubblewrap.ts`)

**功能特性：**
- ✅ 基础的 Bubblewrap 命令生成
- ✅ 命名空间隔离（user, network, pid）
- ✅ 挂载点管理（bind, ro-bind, tmpfs）
- ✅ 进程管理（die-with-parent, new-session）
- ✅ 沙箱可用性检测
- ✅ 版本检测
- ✅ Fallback 机制（无沙箱时降级执行）

**代码示例：**
```typescript
// 创建沙箱
const sandbox = new BubblewrapSandbox({
  unshareUser: true,
  unshareNetwork: true,
  unsharePid: true,
  dieWithParent: true,
  newSession: true,
});

// 添加挂载点
sandbox.addBindMount('/path/to/source', '/path/to/dest', false);

// 执行命令
const result = await sandbox.execute('ls', ['-la']);
```

**实现质量：**
- ⭐⭐⭐⭐ 代码结构清晰
- ⭐⭐⭐⭐ 类型定义完善
- ⭐⭐⭐ 错误处理良好
- ⭐⭐⭐ 文档完整

#### 2. 文件系统沙箱 (`src/sandbox/filesystem.ts`)

**功能特性：**
- ✅ 路径访问控制（允许/拒绝列表）
- ✅ 操作权限管理（read, write, execute）
- ✅ 通配符模式匹配
- ✅ 临时目录管理
- ✅ 路径规范化

**代码示例：**
```typescript
const policy: FilesystemPolicy = {
  allowedPaths: [
    { pattern: '/tmp/**', operations: ['read', 'write'] },
    { pattern: '/usr/**', operations: ['read'] }
  ],
  deniedPaths: [
    { pattern: '/etc/shadow', operations: ['read'] }
  ],
  defaultAction: 'deny',
};

const sandbox = new FilesystemSandbox(policy);
const allowed = sandbox.isPathAllowed('/tmp/test.txt', 'write');
```

#### 3. 网络沙箱 (`src/sandbox/network.ts`)

**功能特性：**
- ✅ 域名白名单/黑名单
- ✅ 端口过滤
- ✅ 协议限制
- ✅ 请求速率限制
- ✅ 请求日志记录
- ✅ 统计信息

**代码示例：**
```typescript
const sandbox = new NetworkSandbox({
  allowedDomains: ['*.example.com'],
  allowedPorts: [80, 443],
  allowedProtocols: ['http:', 'https:'],
  maxRequestsPerMinute: 60,
});

// 包装 fetch
const safeFetch = sandbox.wrapFetch();
```

#### 4. 沙箱配置管理 (`src/sandbox/config.ts`)

**功能特性：**
- ✅ 配置预设（strict, development, production, docker 等）
- ✅ 配置验证（Zod schema）
- ✅ 配置合并
- ✅ 配置持久化
- ✅ 配置热重载
- ✅ 资源限制配置

**预设配置：**
```typescript
// 8 个预设配置
SANDBOX_PRESETS = {
  strict,         // 严格隔离
  development,    // 开发模式
  testing,        // 测试模式
  production,     // 生产模式
  docker,         // Docker 模式
  unrestricted,   // 无限制
  webscraping,    // 网络爬虫
  aicode,         // AI 代码执行
}
```

### 实现评估

**优势：**
1. 🎯 **模块化设计：** 文件系统、网络、进程隔离分离
2. 🎯 **类型安全：** 完整的 TypeScript 类型定义
3. 🎯 **配置灵活：** 多种预设和自定义选项
4. 🎯 **Fallback 机制：** 沙箱不可用时优雅降级

**不足：**
1. ❌ **平台支持有限：** 仅支持 Linux Bubblewrap
2. ❌ **缺少 macOS 支持：** 无 Seatbelt 实现
3. ❌ **缺少 Docker 模式：** 配置存在但未实现
4. ❌ **资源限制未实现：** 配置定义了但未应用
5. ❌ **测试覆盖不足：** 缺少单元测试和集成测试

---

## 差距分析

### 缺失功能对比表

| 功能模块 | 官方状态 | 本项目状态 | 优先级 | 难度 |
|---------|---------|-----------|-------|------|
| Bubblewrap (Linux) | ✅ 已实现 | ✅ 已实现 | - | - |
| Seatbelt (macOS) | ✅ 推测已实现 | ❌ 未实现 | **高** | 中等 |
| Docker 容器模式 | ✅ 推测已实现 | ❌ 未实现 | **高** | 中等 |
| Windows 沙箱 | ❓ 未知 | ❌ 未实现 | 中 | 高 |
| CPU 限制 | ✅ 推测已实现 | ❌ 配置存在未应用 | 中 | 中等 |
| 内存限制 | ✅ 推测已实现 | ❌ 配置存在未应用 | 中 | 中等 |
| 进程数限制 | ✅ 推测已实现 | ❌ 配置存在未应用 | 低 | 简单 |
| 文件大小限制 | ✅ 推测已实现 | ❌ 配置存在未应用 | 低 | 简单 |
| 审计日志 | ❓ 未知 | ⚠️ 部分实现 | 中 | 简单 |
| Seccomp 过滤 | ❓ 未知 | ❌ 未实现 | 低 | 高 |

---

## 具体实现建议

### T-016: macOS Seatbelt 支持

#### 实现方案

**1. 创建 Seatbelt 沙箱模块**

文件：`src/sandbox/seatbelt.ts`

```typescript
/**
 * macOS Seatbelt Sandbox Implementation
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SeatbeltOptions {
  /** Allow network access */
  allowNetwork?: boolean;
  /** Allowed read paths */
  allowRead?: string[];
  /** Allowed write paths */
  allowWrite?: string[];
  /** Allow subprocesses */
  allowSubprocesses?: boolean;
  /** Custom Seatbelt profile */
  customProfile?: string;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface SeatbeltResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
  duration?: number;
}

// ============================================================================
// Seatbelt Profile Generator
// ============================================================================

/**
 * Generate Seatbelt profile (Scheme-like syntax)
 */
export function generateSeatbeltProfile(options: SeatbeltOptions): string {
  const {
    allowNetwork = false,
    allowRead = [],
    allowWrite = [],
    allowSubprocesses = true,
  } = options;

  const profile: string[] = [
    '(version 1)',
    '(debug deny)',
    '',
    ';; Default deny all',
    '(deny default)',
    '',
    ';; Allow basic process operations',
    '(allow process-exec*)',
    '(allow process-fork)',
    '(allow signal*)',
    '(allow sysctl-read)',
    '',
  ];

  // Subprocess control
  if (!allowSubprocesses) {
    profile.push(';; Deny subprocess creation');
    profile.push('(deny process-fork)');
    profile.push('(deny process-exec*)');
    profile.push('');
  }

  // System paths (read-only)
  profile.push(';; Allow read access to system paths');
  profile.push('(allow file-read*');
  profile.push('    (subpath "/System")');
  profile.push('    (subpath "/usr")');
  profile.push('    (subpath "/Library")');
  profile.push('    (subpath "/Applications")');
  profile.push('    (literal "/dev/null")');
  profile.push('    (literal "/dev/random")');
  profile.push('    (literal "/dev/urandom"))');
  profile.push('');

  // Custom read paths
  if (allowRead.length > 0) {
    profile.push(';; Custom read paths');
    profile.push('(allow file-read*');
    for (const readPath of allowRead) {
      profile.push(`    (subpath "${readPath}")`);
    }
    profile.push(')');
    profile.push('');
  }

  // Write paths
  if (allowWrite.length > 0) {
    profile.push(';; Allow write access to specified paths');
    profile.push('(allow file*');
    for (const writePath of allowWrite) {
      profile.push(`    (subpath "${writePath}")`);
    }
    profile.push(')');
    profile.push('');
  } else {
    // At minimum, allow /tmp
    profile.push(';; Allow write access to /tmp');
    profile.push('(allow file*');
    profile.push('    (subpath "/tmp")');
    profile.push('    (subpath "/private/tmp")');
    profile.push('    (subpath "/var/tmp"))');
    profile.push('');
  }

  // Network access
  if (allowNetwork) {
    profile.push(';; Allow network access');
    profile.push('(allow network*)');
  } else {
    profile.push(';; Deny network access');
    profile.push('(deny network*)');
  }
  profile.push('');

  // IPC
  profile.push(';; Allow IPC');
  profile.push('(allow ipc*)');
  profile.push('(allow mach*)');
  profile.push('');

  return profile.join('\n');
}

// ============================================================================
// Seatbelt Sandbox Class
// ============================================================================

export class SeatbeltSandbox {
  private options: SeatbeltOptions;
  private profilePath: string | null = null;

  /**
   * Check if sandbox-exec is available (macOS only)
   */
  static isAvailable(): boolean {
    if (os.platform() !== 'darwin') {
      return false;
    }

    try {
      child_process.execSync('which sandbox-exec', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  constructor(options: SeatbeltOptions = {}) {
    this.options = options;
  }

  /**
   * Create temporary profile file
   */
  private async createProfileFile(): Promise<string> {
    const profile = this.options.customProfile ||
                    generateSeatbeltProfile(this.options);

    const tmpDir = os.tmpdir();
    const profilePath = path.join(tmpDir, `seatbelt-${Date.now()}-${process.pid}.sb`);

    await fs.promises.writeFile(profilePath, profile, 'utf-8');
    this.profilePath = profilePath;

    return profilePath;
  }

  /**
   * Cleanup profile file
   */
  private async cleanupProfileFile(): Promise<void> {
    if (this.profilePath && fs.existsSync(this.profilePath)) {
      await fs.promises.unlink(this.profilePath);
      this.profilePath = null;
    }
  }

  /**
   * Execute command in Seatbelt sandbox
   */
  async execute(command: string, args: string[] = []): Promise<SeatbeltResult> {
    if (!SeatbeltSandbox.isAvailable()) {
      // Fallback to unsandboxed execution
      return this.executeFallback(command, args);
    }

    const startTime = Date.now();
    const profilePath = await this.createProfileFile();

    try {
      return await new Promise((resolve) => {
        const sandboxArgs = [
          'sandbox-exec',
          '-f',
          profilePath,
          command,
          ...args,
        ];

        const proc = child_process.spawn(sandboxArgs[0], sandboxArgs.slice(1), {
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

        proc.on('close', async (code) => {
          await this.cleanupProfileFile();
          resolve({
            exitCode: code ?? 1,
            stdout,
            stderr,
            sandboxed: true,
            duration: Date.now() - startTime,
          });
        });

        proc.on('error', async (err) => {
          await this.cleanupProfileFile();
          // Fallback to unsandboxed
          const fallback = await this.executeFallback(command, args);
          resolve(fallback);
        });
      });
    } catch (error) {
      await this.cleanupProfileFile();
      return this.executeFallback(command, args);
    }
  }

  /**
   * Execute without sandbox (fallback)
   */
  private async executeFallback(command: string, args: string[]): Promise<SeatbeltResult> {
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
          stderr: err.message,
          sandboxed: false,
          duration: Date.now() - startTime,
        });
      });
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Execute command in Seatbelt sandbox (convenience function)
 */
export async function execInSeatbelt(
  command: string,
  args: string[] = [],
  options: SeatbeltOptions = {}
): Promise<SeatbeltResult> {
  const sandbox = new SeatbeltSandbox(options);
  return sandbox.execute(command, args);
}

/**
 * Get Seatbelt info
 */
export function getSeatbeltInfo(): {
  available: boolean;
  platform: string;
} {
  return {
    available: SeatbeltSandbox.isAvailable(),
    platform: os.platform(),
  };
}
```

**2. 集成到主沙箱模块**

修改 `src/sandbox/index.ts`:

```typescript
// 添加 Seatbelt 导出
export {
  SeatbeltSandbox,
  generateSeatbeltProfile,
  execInSeatbelt,
  getSeatbeltInfo,
} from './seatbelt.js';

export type {
  SeatbeltOptions,
  SeatbeltResult,
} from './seatbelt.js';

// 更新统一的沙箱工厂函数
export function createPlatformSandbox(): 'bubblewrap' | 'seatbelt' | 'none' {
  const platform = os.platform();

  if (platform === 'linux' && isBubblewrapAvailable()) {
    return 'bubblewrap';
  }

  if (platform === 'darwin' && SeatbeltSandbox.isAvailable()) {
    return 'seatbelt';
  }

  return 'none';
}
```

**3. 测试用例**

文件：`src/sandbox/__tests__/seatbelt.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  SeatbeltSandbox,
  generateSeatbeltProfile,
  execInSeatbelt,
  getSeatbeltInfo,
} from '../seatbelt.js';
import * as os from 'os';

describe('Seatbelt Sandbox', () => {
  const isMacOS = os.platform() === 'darwin';

  beforeAll(() => {
    if (!isMacOS) {
      console.warn('Skipping Seatbelt tests on non-macOS platform');
    }
  });

  it('should detect availability correctly', () => {
    const available = SeatbeltSandbox.isAvailable();
    if (isMacOS) {
      expect(typeof available).toBe('boolean');
    } else {
      expect(available).toBe(false);
    }
  });

  it('should generate valid Seatbelt profile', () => {
    const profile = generateSeatbeltProfile({
      allowNetwork: true,
      allowRead: ['/usr/local'],
      allowWrite: ['/tmp'],
    });

    expect(profile).toContain('(version 1)');
    expect(profile).toContain('(allow network*)');
    expect(profile).toContain('(subpath "/tmp")');
  });

  it('should execute simple command', async () => {
    if (!isMacOS) return;

    const sandbox = new SeatbeltSandbox({
      allowWrite: ['/tmp'],
    });

    const result = await sandbox.execute('echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should deny network access when disabled', async () => {
    if (!isMacOS) return;

    const sandbox = new SeatbeltSandbox({
      allowNetwork: false,
    });

    const result = await sandbox.execute('curl', ['https://example.com']);

    // Should fail due to network restriction
    expect(result.exitCode).not.toBe(0);
  });
});
```

---

### T-017: Docker 容器模式

#### 实现方案

**1. 创建 Docker 沙箱模块**

文件：`src/sandbox/docker.ts`

```typescript
/**
 * Docker Container Sandbox Implementation
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DockerOptions {
  /** Docker image to use */
  image?: string;
  /** Container name */
  containerName?: string;
  /** Volume mounts (host:container:mode) */
  volumes?: string[];
  /** Port mappings (host:container) */
  ports?: string[];
  /** Network mode */
  network?: string;
  /** User (uid:gid) */
  user?: string;
  /** Working directory in container */
  workdir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Memory limit (e.g., "512m", "1g") */
  memory?: string;
  /** CPU limit (e.g., "0.5", "2.0") */
  cpus?: string;
  /** Read-only root filesystem */
  readOnly?: boolean;
  /** Remove container after execution */
  autoRemove?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Container entrypoint override */
  entrypoint?: string;
}

export interface DockerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
  containerId?: string;
  duration?: number;
}

export interface DockerInfo {
  available: boolean;
  version?: string;
  images: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<DockerOptions, 'containerName' | 'entrypoint'>> = {
  image: 'node:20-alpine',
  volumes: [],
  ports: [],
  network: 'bridge',
  user: `${os.userInfo().uid}:${os.userInfo().gid}`,
  workdir: '/workspace',
  env: {},
  memory: '1g',
  cpus: '1.0',
  readOnly: false,
  autoRemove: true,
  timeout: 60000,
};

// ============================================================================
// Docker Availability
// ============================================================================

let dockerAvailable: boolean | null = null;
let dockerVersion: string | null = null;

/**
 * Check if Docker is available
 */
export function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) {
    return dockerAvailable;
  }

  try {
    child_process.execSync('docker version', { stdio: 'ignore' });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }

  return dockerAvailable;
}

/**
 * Get Docker version
 */
export function getDockerVersion(): string | null {
  if (dockerVersion !== null) {
    return dockerVersion;
  }

  if (!isDockerAvailable()) {
    return null;
  }

  try {
    const result = child_process.execSync('docker version --format "{{.Server.Version}}"', {
      encoding: 'utf-8',
    });
    dockerVersion = result.trim();
    return dockerVersion;
  } catch {
    return null;
  }
}

/**
 * List available Docker images
 */
export function listDockerImages(): string[] {
  if (!isDockerAvailable()) {
    return [];
  }

  try {
    const result = child_process.execSync('docker images --format "{{.Repository}}:{{.Tag}}"', {
      encoding: 'utf-8',
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Pull Docker image if not exists
 */
export async function pullDockerImage(image: string): Promise<boolean> {
  if (!isDockerAvailable()) {
    return false;
  }

  try {
    // Check if image exists locally
    const images = listDockerImages();
    if (images.includes(image)) {
      return true;
    }

    // Pull image
    console.log(`Pulling Docker image: ${image}...`);
    child_process.execSync(`docker pull ${image}`, {
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Docker Sandbox Class
// ============================================================================

export class DockerSandbox {
  private options: DockerOptions;

  /**
   * Check if Docker is available
   */
  static isAvailable(): boolean {
    return isDockerAvailable();
  }

  /**
   * Get Docker version
   */
  static getVersion(): string | null {
    return getDockerVersion();
  }

  constructor(options: DockerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Build docker run command arguments
   */
  private buildDockerArgs(command: string, args: string[] = []): string[] {
    const opts = this.options;
    const dockerArgs: string[] = ['run'];

    // Auto-remove container
    if (opts.autoRemove) {
      dockerArgs.push('--rm');
    }

    // Interactive + TTY
    dockerArgs.push('-i');

    // Container name
    if (opts.containerName) {
      dockerArgs.push('--name', opts.containerName);
    }

    // Resource limits
    if (opts.memory) {
      dockerArgs.push('--memory', opts.memory);
    }
    if (opts.cpus) {
      dockerArgs.push('--cpus', opts.cpus);
    }

    // Read-only filesystem
    if (opts.readOnly) {
      dockerArgs.push('--read-only');
      // Add tmpfs for /tmp
      dockerArgs.push('--tmpfs', '/tmp:rw,size=100m');
    }

    // Network
    if (opts.network) {
      dockerArgs.push('--network', opts.network);
    }

    // User
    if (opts.user) {
      dockerArgs.push('--user', opts.user);
    }

    // Working directory
    if (opts.workdir) {
      dockerArgs.push('-w', opts.workdir);
    }

    // Environment variables
    if (opts.env) {
      for (const [key, value] of Object.entries(opts.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    // Volume mounts
    if (opts.volumes && opts.volumes.length > 0) {
      for (const volume of opts.volumes) {
        dockerArgs.push('-v', volume);
      }
    } else {
      // Default: mount current directory
      const cwd = process.cwd();
      dockerArgs.push('-v', `${cwd}:${opts.workdir || '/workspace'}:rw`);
    }

    // Port mappings
    if (opts.ports && opts.ports.length > 0) {
      for (const port of opts.ports) {
        dockerArgs.push('-p', port);
      }
    }

    // Entrypoint override
    if (opts.entrypoint) {
      dockerArgs.push('--entrypoint', opts.entrypoint);
    }

    // Image
    dockerArgs.push(opts.image || DEFAULT_OPTIONS.image);

    // Command and args
    dockerArgs.push(command, ...args);

    return dockerArgs;
  }

  /**
   * Execute command in Docker container
   */
  async execute(command: string, args: string[] = []): Promise<DockerResult> {
    if (!isDockerAvailable()) {
      return this.executeFallback(command, args);
    }

    // Ensure image is available
    const imagePulled = await pullDockerImage(this.options.image || DEFAULT_OPTIONS.image);
    if (!imagePulled) {
      console.warn(`Failed to pull image: ${this.options.image}, falling back to unsandboxed`);
      return this.executeFallback(command, args);
    }

    const startTime = Date.now();
    const dockerArgs = this.buildDockerArgs(command, args);

    return new Promise((resolve) => {
      const proc = child_process.spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.timeout || DEFAULT_OPTIONS.timeout,
      });

      let stdout = '';
      let stderr = '';
      let containerId: string | undefined;

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
          containerId,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        // Fallback to unsandboxed execution
        this.executeFallback(command, args).then(resolve);
      });
    });
  }

  /**
   * Execute without Docker (fallback)
   */
  private async executeFallback(command: string, args: string[]): Promise<DockerResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const proc = child_process.spawn(command, args, {
        env: this.options.env || process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.timeout || DEFAULT_OPTIONS.timeout,
        cwd: process.cwd(),
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
          stderr: err.message,
          sandboxed: false,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Stop and remove container
   */
  async stop(containerId: string, force: boolean = false): Promise<void> {
    if (!isDockerAvailable()) {
      return;
    }

    try {
      const command = force ? 'kill' : 'stop';
      child_process.execSync(`docker ${command} ${containerId}`, {
        stdio: 'ignore',
      });

      // Remove container
      child_process.execSync(`docker rm ${containerId}`, {
        stdio: 'ignore',
      });
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Execute command in Docker sandbox (convenience function)
 */
export async function execInDocker(
  command: string,
  args: string[] = [],
  options: DockerOptions = {}
): Promise<DockerResult> {
  const sandbox = new DockerSandbox(options);
  return sandbox.execute(command, args);
}

/**
 * Get Docker info
 */
export function getDockerInfo(): DockerInfo {
  return {
    available: isDockerAvailable(),
    version: getDockerVersion() || undefined,
    images: listDockerImages(),
  };
}

/**
 * Build a Docker image from Dockerfile
 */
export async function buildDockerImage(
  dockerfilePath: string,
  imageName: string,
  buildContext?: string
): Promise<boolean> {
  if (!isDockerAvailable()) {
    return false;
  }

  try {
    const context = buildContext || path.dirname(dockerfilePath);
    child_process.execSync(`docker build -t ${imageName} -f ${dockerfilePath} ${context}`, {
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}
```

**2. 集成到配置系统**

修改 `src/sandbox/config.ts` 中的 Docker 预设配置，添加实际的实现调用：

```typescript
// 在 SandboxConfigManager 中添加 Docker 执行方法
export class SandboxConfigManager {
  // ... 现有代码 ...

  /**
   * Execute command with Docker sandbox
   */
  async executeWithDocker(
    command: string,
    args: string[] = []
  ): Promise<DockerResult> {
    if (this.currentConfig.type !== 'docker') {
      throw new Error('Docker mode is not enabled in current configuration');
    }

    const dockerOptions: DockerOptions = {
      image: this.currentConfig.docker?.image,
      volumes: this.currentConfig.docker?.volumes,
      ports: this.currentConfig.docker?.ports,
      network: this.currentConfig.docker?.network,
      user: this.currentConfig.docker?.user,
      workdir: this.currentConfig.docker?.workdir,
      env: this.getEnvironmentVariables(),
      memory: this.currentConfig.resourceLimits?.maxMemory
        ? `${Math.floor(this.currentConfig.resourceLimits.maxMemory / 1024 / 1024)}m`
        : undefined,
      cpus: this.currentConfig.resourceLimits?.maxCpu
        ? `${this.currentConfig.resourceLimits.maxCpu / 100}`
        : undefined,
      timeout: this.currentConfig.resourceLimits?.maxExecutionTime,
    };

    return execInDocker(command, args, dockerOptions);
  }
}
```

**3. 创建统一的沙箱执行接口**

文件：`src/sandbox/executor.ts`

```typescript
/**
 * Unified Sandbox Executor
 * Automatically selects the appropriate sandbox based on platform and configuration
 */

import * as os from 'os';
import { SandboxConfig } from './config.js';
import { execInSandbox, SandboxResult as BwrapResult } from './bubblewrap.js';
import { execInSeatbelt, SeatbeltResult } from './seatbelt.js';
import { execInDocker, DockerResult } from './docker.js';

export interface ExecutorResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
  sandboxType: 'bubblewrap' | 'seatbelt' | 'docker' | 'none';
  duration?: number;
}

/**
 * Execute command with automatic sandbox selection
 */
export async function executeInSandbox(
  command: string,
  args: string[] = [],
  config: SandboxConfig
): Promise<ExecutorResult> {
  const platform = os.platform();

  // Disabled sandbox
  if (!config.enabled || config.type === 'none') {
    return executeUnsandboxed(command, args);
  }

  // Docker mode (cross-platform)
  if (config.type === 'docker') {
    const result = await execInDocker(command, args, {
      image: config.docker?.image,
      volumes: config.docker?.volumes,
      network: config.docker?.network,
      memory: config.resourceLimits?.maxMemory
        ? `${Math.floor(config.resourceLimits.maxMemory / 1024 / 1024)}m`
        : undefined,
      cpus: config.resourceLimits?.maxCpu
        ? `${config.resourceLimits.maxCpu / 100}`
        : undefined,
    });

    return {
      ...result,
      sandboxType: 'docker',
    };
  }

  // Platform-specific sandboxes
  if (platform === 'linux' && config.type === 'bubblewrap') {
    const result = await execInSandbox(command, args, {
      config: {
        enabled: true,
        allowNetwork: config.networkAccess,
        allowRead: config.readOnlyPaths,
        allowWrite: config.writablePaths,
      },
    });

    return {
      ...result,
      sandboxType: 'bubblewrap',
    };
  }

  if (platform === 'darwin') {
    const result = await execInSeatbelt(command, args, {
      allowNetwork: config.networkAccess,
      allowRead: config.readOnlyPaths,
      allowWrite: config.writablePaths,
    });

    return {
      ...result,
      sandboxType: 'seatbelt',
    };
  }

  // Fallback to unsandboxed
  console.warn(`No sandbox available for platform: ${platform}, executing unsandboxed`);
  return executeUnsandboxed(command, args);
}

/**
 * Execute without sandbox
 */
async function executeUnsandboxed(
  command: string,
  args: string[]
): Promise<ExecutorResult> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
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
        sandboxType: 'none',
      });
    });

    proc.on('error', (err) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: err.message,
        sandboxed: false,
        sandboxType: 'none',
      });
    });
  });
}
```

---

## 资源限制实现

### 实现 cgroups 限制（Linux）

文件：`src/sandbox/resource-limits.ts`

```typescript
/**
 * Resource Limits Implementation
 * Uses cgroups v2 on Linux, launchctl on macOS, Docker resource limits
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ResourceLimits {
  maxMemory?: number;        // bytes
  maxCpu?: number;           // 0-100 percentage
  maxProcesses?: number;
  maxFileSize?: number;      // bytes
  maxExecutionTime?: number; // milliseconds
  maxFileDescriptors?: number;
}

/**
 * Apply resource limits using cgroups v2 (Linux)
 */
export async function applyCgroupLimits(
  pid: number,
  limits: ResourceLimits
): Promise<boolean> {
  if (os.platform() !== 'linux') {
    return false;
  }

  try {
    const cgroupPath = `/sys/fs/cgroup/claude-sandbox-${pid}`;

    // Create cgroup
    if (!fs.existsSync(cgroupPath)) {
      fs.mkdirSync(cgroupPath, { recursive: true });
    }

    // Memory limit
    if (limits.maxMemory) {
      fs.writeFileSync(
        path.join(cgroupPath, 'memory.max'),
        limits.maxMemory.toString()
      );
    }

    // CPU limit
    if (limits.maxCpu) {
      const cpuMax = Math.floor((limits.maxCpu / 100) * 100000);
      fs.writeFileSync(
        path.join(cgroupPath, 'cpu.max'),
        `${cpuMax} 100000`
      );
    }

    // Process limit
    if (limits.maxProcesses) {
      fs.writeFileSync(
        path.join(cgroupPath, 'pids.max'),
        limits.maxProcesses.toString()
      );
    }

    // Add process to cgroup
    fs.writeFileSync(
      path.join(cgroupPath, 'cgroup.procs'),
      pid.toString()
    );

    return true;
  } catch (error) {
    console.error('Failed to apply cgroup limits:', error);
    return false;
  }
}

/**
 * Cleanup cgroup
 */
export async function cleanupCgroup(pid: number): Promise<void> {
  const cgroupPath = `/sys/fs/cgroup/claude-sandbox-${pid}`;

  if (fs.existsSync(cgroupPath)) {
    try {
      fs.rmdirSync(cgroupPath);
    } catch {
      // Ignore errors
    }
  }
}
```

---

## 实施优先级和路线图

### Phase 1: macOS 支持（2-3 周）
**优先级：高**

1. ✅ 实现 `src/sandbox/seatbelt.ts`
2. ✅ Seatbelt profile 生成器
3. ✅ 集成到 `src/sandbox/index.ts`
4. ✅ 编写单元测试
5. ✅ 编写集成测试
6. ✅ 文档更新

**验收标准：**
- macOS 上可以成功执行沙箱命令
- 网络隔离工作正常
- 文件系统访问控制生效
- 测试覆盖率 > 80%

### Phase 2: Docker 支持（2-3 周）
**优先级：高**

1. ✅ 实现 `src/sandbox/docker.ts`
2. ✅ Docker 镜像管理
3. ✅ 资源限制集成
4. ✅ 统一执行接口
5. ✅ 编写测试
6. ✅ 文档更新

**验收标准：**
- Docker 容器可以成功运行命令
- 资源限制（CPU、内存）生效
- 卷挂载正确
- 跨平台兼容

### Phase 3: 资源限制（1-2 周）
**优先级：中**

1. ✅ 实现 `src/sandbox/resource-limits.ts`
2. ✅ cgroups v2 集成（Linux）
3. ✅ Docker 资源限制
4. ✅ macOS 资源限制（launchctl）
5. ✅ 测试和验证

**验收标准：**
- 内存限制生效
- CPU 限制生效
- 进程数限制生效
- 超时机制工作

### Phase 4: 增强和优化（1-2 周）
**优先级：低**

1. ✅ Seccomp 过滤器（Linux）
2. ✅ 审计日志增强
3. ✅ 性能优化
4. ✅ 错误处理改进
5. ✅ 文档完善

---

## 测试策略

### 单元测试

```typescript
// src/sandbox/__tests__/seatbelt.test.ts
// src/sandbox/__tests__/docker.test.ts
// src/sandbox/__tests__/resource-limits.test.ts
```

### 集成测试

```typescript
// tests/integration/sandbox.test.ts
describe('Sandbox Integration', () => {
  it('should execute on Linux with Bubblewrap', async () => {
    // ...
  });

  it('should execute on macOS with Seatbelt', async () => {
    // ...
  });

  it('should execute with Docker', async () => {
    // ...
  });

  it('should enforce resource limits', async () => {
    // ...
  });
});
```

### 性能测试

```typescript
// tests/performance/sandbox.bench.ts
describe('Sandbox Performance', () => {
  it('should have minimal overhead (<50ms)', async () => {
    const start = Date.now();
    await executeInSandbox('echo', ['test'], config);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
```

---

## 安全考虑

### 1. 沙箱逃逸防护

- ✅ 禁用 ptrace（防止调试）
- ✅ 禁用 setuid/setgid
- ✅ 最小权限原则
- ✅ Seccomp 系统调用过滤

### 2. 资源耗尽防护

- ✅ 内存限制
- ✅ CPU 限制
- ✅ 进程数限制
- ✅ 文件大小限制
- ✅ 执行时间限制

### 3. 文件系统隔离

- ✅ 只读系统路径
- ✅ 限制可写路径
- ✅ 禁止访问敏感文件（/etc/shadow, etc.）
- ✅ 临时文件自动清理

### 4. 网络隔离

- ✅ 域名白名单/黑名单
- ✅ 端口过滤
- ✅ 协议限制
- ✅ 速率限制

---

## 参考资料

### 官方文档

- **Bubblewrap:** https://github.com/containers/bubblewrap
- **Seatbelt:** `man sandbox-exec` (macOS)
- **Docker:** https://docs.docker.com/engine/reference/run/
- **cgroups v2:** https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html

### 相关行号

- **sdk-tools.d.ts:88** - `dangerouslyDisableSandbox` 参数定义
- **bubblewrap.ts:106** - `isBubblewrapAvailable()` 函数
- **bubblewrap.ts:350** - `createBubblewrapArgs()` 函数
- **config.ts:242** - Docker 预设配置

---

## 总结

### 已完成
- ✅ Bubblewrap（Linux）基础实现
- ✅ 文件系统沙箱
- ✅ 网络沙箱
- ✅ 配置管理系统

### 待实现
- ❌ Seatbelt（macOS）支持
- ❌ Docker 容器模式
- ❌ 资源限制应用
- ❌ Windows 沙箱（低优先级）

### 估算工作量
- **T-016 (macOS Seatbelt):** 2-3 周
- **T-017 (Docker):** 2-3 周
- **资源限制:** 1-2 周
- **测试和文档:** 1 周

**总计:** 6-9 周

### 下一步行动
1. 从 T-016 开始实现 macOS Seatbelt 支持
2. 编写测试用例
3. 集成到 Bash 工具
4. 更新文档
