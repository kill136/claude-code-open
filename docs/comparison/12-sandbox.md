# 沙箱系统功能对比分析 (T131-T142)

## 概述

本文档对比分析本项目的沙箱系统实现与官方 `@anthropic-ai/claude-code@2.0.76` 的差异。

**分析日期**: 2025-12-25
**官方版本**: 2.0.76
**分析范围**: T131-T142（沙箱系统功能点）

---

## T131: Bubblewrap 沙箱集成

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/sandbox/bubblewrap.ts`

**核心功能**:
```typescript
// Bubblewrap 可用性检测
export function isBubblewrapAvailable(): boolean {
  if (bubblewrapAvailable !== null) {
    return bubblewrapAvailable;
  }

  // 仅在 Linux 上可用
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

// BubblewrapSandbox 类
export class BubblewrapSandbox {
  static isAvailable(): Promise<boolean>
  static getVersion(): Promise<string | null>

  constructor(options: BubblewrapOptions)
  addBindMount(source: string, dest: string, readonly?: boolean): void
  buildCommand(command: string, args: string[]): string[]
  async execute(command: string, args: string[]): Promise<ExecutionResult>
}

// 命令构建
export function createBubblewrapArgs(options: BubblewrapOptions): string[] {
  // --unshare-all 隔离所有命名空间
  // --ro-bind 只读挂载
  // --bind 读写挂载
  // --tmpfs 临时文件系统
  // --proc /proc 挂载
  // --dev /dev 挂载
  // --die-with-parent 父进程退出时终止
  // --new-session 新会话
}

// 执行函数
export async function execInSandbox(
  command: string,
  args: string[],
  options: { config?, timeout?, env? }
): Promise<SandboxResult>

export function createSandboxedBash(
  config: Partial<BubblewrapConfig>
): (command: string, timeout?: number) => Promise<SandboxResult>
```

**关键特性**:
1. ✅ 完整的 Bubblewrap 集成
2. ✅ 版本检测 (`getBubblewrapVersion()`)
3. ✅ 命名空间隔离（user, network, pid）
4. ✅ 挂载管理（只读/读写/tmpfs）
5. ✅ 进程管理（die-with-parent, new-session）
6. ✅ 超时控制
7. ✅ 失败时回退到非沙箱执行
8. ✅ 能力检测（`getSandboxCapabilities()`）

**配置选项**:
```typescript
interface BubblewrapOptions {
  unshareUser?: boolean;         // 用户命名空间隔离
  unshareNetwork?: boolean;      // 网络命名空间隔离
  unsharePid?: boolean;          // PID 命名空间隔离
  bindMounts?: BindMount[];      // 读写挂载点
  roBindMounts?: BindMount[];    // 只读挂载点
  tmpfsMounts?: string[];        // tmpfs 挂载点
  devBinds?: boolean;            // /dev 访问
  procMount?: boolean;           // /proc 挂载
  dieWithParent?: boolean;       // 父进程退出时终止
  newSession?: boolean;          // 创建新会话
  shareNet?: boolean;            // 共享网络
  cwd?: string;                  // 工作目录
  env?: Record<string, string>;  // 环境变量
  timeout?: number;              // 超时（毫秒）
}
```

### 官方实现

**观察到的特征**（基于代码分析）:
- ✅ `bubblewrap` 关键字出现 4 次
- ✅ `bwrap` 命令出现 4 次
- ✅ 检测到 Linux 平台支持（10 次引用）
- ✅ `isSupportedPlatform` 函数存在
- ✅ `checkDependencies` 函数（检查 bwrap 依赖）
- ✅ `wrapWithSandbox` 函数（包装命令）

**API 特征**:
```typescript
// 从混淆代码推断的接口
interface SandboxAPI {
  isSupportedPlatform(): boolean
  checkDependencies(): Promise<DependencyCheck>
  wrapWithSandbox(command: string, ...): WrappedCommand
  // ... 其他方法
}
```

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| Bubblewrap 可用性检测 | ✅ 完整实现 | ✅ 有 | 实现方式可能不同 |
| 版本检测 | ✅ `getBubblewrapVersion()` | ❓ 未确定 | 本项目有明确的版本检测 |
| 命名空间隔离 | ✅ user/net/pid | ✅ 有 | 具体配置可能不同 |
| 挂载管理 | ✅ 详细的挂载配置 | ✅ 有 | 本项目提供更细粒度控制 |
| BubblewrapSandbox 类 | ✅ 完整的 OOP 封装 | ❓ 函数式？ | 本项目采用类封装 |
| 失败回退机制 | ✅ `executeFallback()` | ✅ 有 | 都支持回退 |
| 能力检测 | ✅ `getSandboxCapabilities()` | ✅ 有 | 功能相似 |

**实现完整度**: ⭐⭐⭐⭐⭐ (95%)

---

## T132: 沙箱启用检测

### 本项目实现

**文件位置**:
- `/home/user/claude-code-open/src/sandbox/bubblewrap.ts`
- `/home/user/claude-code-open/src/sandbox/config.ts`

**核心功能**:
```typescript
// Bubblewrap 可用性
export function isBubblewrapAvailable(): boolean {
  // 平台检测 + 命令检测
}

// 配置管理器
export class SandboxConfigManager {
  getConfig(): SandboxConfig

  getSummary(): {
    enabled: boolean;
    type: string;
    networkAccess: boolean;
    // ...
  }
}

// 配置模式
export interface SandboxConfig {
  enabled: boolean;
  type: 'bubblewrap' | 'docker' | 'firejail' | 'none';
  // ...
}

// 预设配置
export const SANDBOX_PRESETS: Record<string, SandboxConfig> = {
  strict: { enabled: true, ... },
  development: { enabled: true, ... },
  testing: { enabled: true, ... },
  production: { enabled: true, ... },
  unrestricted: { enabled: false, ... }
}
```

### 官方实现

**观察到的特征**:
- ✅ `isSandboxingEnabled` 函数（从代码中提取）
- ✅ `areSandboxSettingsLockedByPolicy` 函数
- ✅ `setSandboxSettings` 函数
- ✅ `sandbox?.enabled` 配置项
- ✅ 多个平台支持检测

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 沙箱启用检测 | ✅ `enabled` 配置 | ✅ `isSandboxingEnabled()` | 功能相同 |
| 多种沙箱类型 | ✅ 4 种类型 | ❓ 未确定 | 本项目支持 bubblewrap/docker/firejail/none |
| 预设配置 | ✅ 7 种预设 | ❓ 未确定 | 本项目提供丰富预设 |
| 配置持久化 | ✅ JSON 文件 | ✅ 有 | 都支持持久化 |
| 配置验证 | ✅ Zod schema | ❓ 未确定 | 本项目使用 Zod 验证 |
| 配置合并 | ✅ `mergeConfigs()` | ❓ 未确定 | 本项目支持配置合并 |

**实现完整度**: ⭐⭐⭐⭐ (85%)

---

## T133: 沙箱目录白名单

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/sandbox/filesystem.ts`

**核心功能**:
```typescript
export interface PathRule {
  pattern: string;                              // 路径模式（支持通配符）
  operations?: Array<'read' | 'write' | 'execute'>;
  description?: string;
}

export interface FilesystemPolicy {
  allowedPaths: PathRule[];                     // 允许的路径
  deniedPaths: PathRule[];                      // 拒绝的路径（优先级更高）
  defaultAction: 'allow' | 'deny';
  caseSensitive?: boolean;
}

export class FilesystemSandbox {
  isPathAllowed(filePath: string, operation: 'read' | 'write' | 'execute'): boolean

  addAllowedPath(rule: PathRule): void
  addDeniedPath(rule: PathRule): void
  removePathRule(pattern: string, listType: 'allowed' | 'denied'): boolean
}

// 路径匹配（支持通配符）
export function matchPathPattern(
  filePath: string,
  pattern: string,
  caseSensitive?: boolean
): boolean {
  // 支持: *, **, ? 等通配符
  // 处理目录包含关系
}

// 默认策略
export function createDefaultPolicy(cwd?: string): FilesystemPolicy {
  return {
    allowedPaths: [
      { pattern: path.join(workDir, '**'), description: 'Working directory' },
      { pattern: path.join(tmpDir, '**'), description: 'Temp directory' },
      { pattern: path.join(homeDir, '.claude', '**'), operations: ['read', 'write'] }
    ],
    deniedPaths: [
      { pattern: path.join(homeDir, '.ssh', '**'), description: 'SSH keys' },
      { pattern: path.join(homeDir, '.aws', '**'), description: 'AWS credentials' },
      { pattern: path.join(homeDir, '.gnupg', '**'), description: 'GPG keys' },
      { pattern: '/etc/shadow', description: 'System password file' }
    ],
    defaultAction: 'deny',
    caseSensitive: os.platform() !== 'win32'
  };
}
```

**通配符支持**:
- `*` - 匹配任意字符（不含路径分隔符）
- `**` - 匹配任意目录（含路径分隔符）
- `?` - 匹配单个字符
- `/path/*` - 匹配目录下所有文件
- `/path/**` - 递归匹配所有子目录

### 官方实现

**观察到的特征**（基于代码分析）:
- ✅ `getFsReadConfig` 函数
- ✅ `getFsWriteConfig` 函数
- ✅ 文件系统限制配置
- ✅ Glob 模式警告 (`getLinuxGlobPatternWarnings`)
- ✅ 路径规则系统

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 路径白名单 | ✅ `allowedPaths` | ✅ `getFsReadConfig` | 功能相同 |
| 路径黑名单 | ✅ `deniedPaths` | ✅ 有 | 都支持拒绝列表 |
| 操作级权限 | ✅ read/write/execute | ❓ 未确定 | 本项目支持细粒度权限 |
| 通配符支持 | ✅ */\*\*/? | ✅ 有 glob 警告 | 都支持通配符 |
| 默认策略 | ✅ allow/deny | ✅ 有 | 功能相似 |
| 敏感路径保护 | ✅ .ssh/.aws/.gnupg | ✅ 有 | 都保护敏感路径 |
| 路径规则描述 | ✅ `description` 字段 | ❓ 未确定 | 本项目支持规则描述 |

**实现完整度**: ⭐⭐⭐⭐ (90%)

---

## T134: 沙箱网络控制

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/sandbox/network.ts`

**核心功能**:
```typescript
export interface NetworkPolicy {
  allowedDomains: string[];        // 域名白名单（支持通配符）
  deniedDomains: string[];         // 域名黑名单
  allowedPorts: number[];          // 端口白名单
  deniedPorts: number[];           // 端口黑名单
  allowedProtocols: string[];      // 协议白名单
  maxRequestsPerMinute?: number;   // 速率限制
  enableLogging?: boolean;         // 请求日志
}

export class NetworkSandbox {
  isRequestAllowed(url: string): boolean
  isDomainAllowed(domain: string): boolean
  isPortAllowed(port: number): boolean
  isProtocolAllowed(protocol: string): boolean

  wrapFetch(): typeof fetch                    // 包装 fetch API
  wrapHttp(): SandboxedHttp                    // 包装 http/https 模块

  getRequestLog(limit?: number): NetworkRequest[]
  getStats(): NetworkStats
}

// 域名模式匹配
export function matchDomainPattern(domain: string, pattern: string): boolean {
  // 支持: example.com, *.example.com, **.example.com, *
}

// 预设沙箱
export function createRestrictiveSandbox(allowedDomains: string[]): NetworkSandbox
export function createPermissiveSandbox(deniedDomains?: string[]): NetworkSandbox
export function createUnrestrictedSandbox(): NetworkSandbox
```

**网络统计**:
```typescript
export interface NetworkStats {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  requestsPerMinute: number;
  topDomains: Array<{ domain: string; count: number }>;
  topPorts: Array<{ port: number; count: number }>;
  protocolBreakdown: Record<string, number>;
  errorCount: number;
}
```

### 官方实现

**观察到的特征**:
- ✅ `getNetworkRestrictionConfig` 函数
- ✅ `getAllowUnixSockets` 函数
- ✅ `getAllowLocalBinding` 函数
- ✅ `getProxyPort` / `getSocksProxyPort` 函数
- ✅ `getLinuxHttpSocketPath` / `getLinuxSocksSocketPath`
- ✅ `waitForNetworkInitialization` 函数
- ✅ 网络限制配置

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 域名过滤 | ✅ 白名单+黑名单 | ✅ `NetworkRestrictionConfig` | 功能相似 |
| 端口过滤 | ✅ 白名单+黑名单 | ✅ 有 | 都支持端口控制 |
| 协议过滤 | ✅ http/https/ws/wss | ✅ 有 | 功能相似 |
| Unix Socket | ❌ 未实现 | ✅ `getAllowUnixSockets` | 官方支持更全面 |
| 本地绑定 | ❌ 未实现 | ✅ `getAllowLocalBinding` | 官方有本地绑定控制 |
| 代理支持 | ❌ 未实现 | ✅ HTTP/SOCKS 代理 | 官方有代理功能 |
| 速率限制 | ✅ `maxRequestsPerMinute` | ❓ 未确定 | 本项目有速率限制 |
| 请求日志 | ✅ 详细日志+统计 | ❓ 未确定 | 本项目有完整日志 |
| Fetch 包装 | ✅ `wrapFetch()` | ❓ 未确定 | 本项目包装 fetch API |

**实现完整度**: ⭐⭐⭐ (70%)
**差距**: 缺少 Unix Socket、本地绑定、代理等高级功能

---

## T135: 沙箱文件系统隔离

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/sandbox/filesystem.ts`

**核心功能**:
```typescript
export class FilesystemSandbox {
  // 路径验证
  isPathAllowed(filePath: string, operation: 'read' | 'write' | 'execute'): boolean

  // 路径规范化（解析符号链接、. 和 ..）
  normalizePath(filePath: string): string
  resolvePath(filePath: string, base?: string): string

  // 临时目录隔离
  async createTempDir(prefix?: string): Promise<string>
  async cleanupTempDirs(): Promise<void>

  // 包装文件系统 API
  wrapFs(): SandboxedFs
}

// 沙箱化的文件系统接口
export interface SandboxedFs {
  readFile: typeof fs.promises.readFile;
  writeFile: typeof fs.promises.writeFile;
  readdir: typeof fs.promises.readdir;
  stat: typeof fs.promises.stat;
  mkdir: typeof fs.promises.mkdir;
  rm: typeof fs.promises.rm;
  exists: (path: string) => Promise<boolean>;
  realpath: (path: string) => Promise<string>;
}

// 路径包含检测（防止路径遍历攻击）
export function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}
```

**安全特性**:
1. 路径规范化（防止 `..` 遍历）
2. 符号链接解析
3. 操作级权限控制
4. 临时目录自动清理
5. 拒绝列表优先级

### 官方实现

**观察到的特征**:
- ✅ `getFsReadConfig` - 读取配置
- ✅ `getFsWriteConfig` - 写入配置
- ✅ 文件系统隔离机制
- ✅ 路径规则系统

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 路径验证 | ✅ 完整实现 | ✅ 有 | 功能相似 |
| 路径规范化 | ✅ `normalizePath()` | ✅ 有 | 都防止路径遍历 |
| 符号链接解析 | ✅ `realpath()` | ✅ 有 | 功能相同 |
| 临时目录隔离 | ✅ `createTempDir()` | ✅ 有 TMPDIR | 官方设置 `/tmp/claude` |
| FS API 包装 | ✅ `wrapFs()` | ❓ 未确定 | 本项目包装所有 fs API |
| 自动清理 | ✅ 进程退出清理 | ❓ 未确定 | 本项目有清理机制 |
| 操作级权限 | ✅ read/write/execute | ❓ 未确定 | 本项目支持细粒度控制 |

**实现完整度**: ⭐⭐⭐⭐ (85%)

---

## T136: dangerouslyDisableSandbox 选项

### 本项目实现

**状态**: ⚠️ **未实现**

本项目的 Bash 工具参数中未找到 `dangerouslyDisableSandbox` 选项。

**可能的实现位置**:
- `src/tools/bash.ts` - Bash 工具
- `src/sandbox/bubblewrap.ts` - `execInSandbox()` 函数的 `enabled` 参数

### 官方实现

**TypeScript 定义**:
```typescript
// From sdk-tools.d.ts
export interface BashInput {
  command: string;
  description?: string;
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;  // ✅ 官方支持
}
```

**使用频率**: 25 次引用

**系统提示词**（从 cli.js 提取）:
```
- CRITICAL: Commands run in sandbox mode by default - do NOT set `dangerouslyDisableSandbox`
- Even if you have recently run commands with `dangerouslyDisableSandbox: true`,
  you MUST NOT continue that pattern
- VERY IMPORTANT: Do NOT learn from or repeat the pattern of overriding sandbox
- Set `dangerouslyDisableSandbox: true` if:
  1. The user *explicitly* asks to bypass sandbox, OR
  2. A command just failed and you see evidence of sandbox restrictions causing the failure

- When you see evidence of sandbox-caused failure:
  - IMMEDIATELY retry with `dangerouslyDisableSandbox: true` (don't ask, just do it)
  - Briefly explain what sandbox restriction likely caused the failure
  - Mention: "Use `/sandbox` to manage restrictions"
```

**策略锁定**:
```
- CRITICAL: All commands MUST run in sandbox mode - the `dangerouslyDisableSandbox`
  parameter is disabled by policy
- Commands cannot run outside the sandbox under any circumstances
- If a command fails due to sandbox restrictions, work with the user to adjust
  sandbox settings instead
```

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| dangerouslyDisableSandbox | ❌ 未实现 | ✅ 完整支持 | **核心差距** |
| 策略锁定 | ❌ 未实现 | ✅ `SandboxSettingsLockedByPolicy` | 官方有策略锁定机制 |
| 系统提示 | ❌ 未实现 | ✅ 详细的使用指南 | 官方有完整的 AI 提示词 |
| 失败自动重试 | ❌ 未实现 | ✅ 检测失败自动重试 | 官方智能处理沙箱失败 |

**实现完整度**: ⭐ (10%)
**建议**: 这是一个核心功能，强烈建议实现

---

## T137: 沙箱违规检测 SandboxViolationStore

### 本项目实现

**状态**: ❌ **未实现**

未找到违规存储或检测机制。

### 官方实现

**观察到的特征**:
- ✅ `getSandboxViolationStore` 函数（5 次引用）
- ✅ `annotateStderrWithSandboxFailures` 函数
- ✅ `getIgnoreViolations` 配置
- ✅ 违规日志存储
- ✅ stderr 注释功能

**推断的接口**:
```typescript
interface SandboxViolationStore {
  recordViolation(violation: SandboxViolation): void
  getViolations(filter?): SandboxViolation[]
  clearViolations(): void
  // ...
}

interface SandboxViolation {
  timestamp: number
  type: 'fs' | 'network' | 'process'
  operation: string
  path?: string
  url?: string
  reason: string
  // ...
}

// 标注 stderr 中的沙箱失败
function annotateStderrWithSandboxFailures(stderr: string): string
```

**macOS 沙箱违规解析**（从代码片段）:
```javascript
// 检测 macOS 沙箱拒绝消息
W = I.find((E) => E.includes("Sandbox:") && E.includes("deny"))
K = I.find((E) => E.startsWith("CMD64_"))

// 解析违规信息
V = W.match(G)  // 提取违规详情
```

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 违规存储 | ❌ 未实现 | ✅ `SandboxViolationStore` | **重大差距** |
| 违规记录 | ❌ 未实现 | ✅ 完整记录 | 官方记录所有违规 |
| stderr 注释 | ❌ 未实现 | ✅ `annotateStderrWithSandboxFailures` | 官方自动标注错误 |
| macOS 违规解析 | ❌ 未实现 | ✅ 支持 | 官方解析 macOS 沙箱日志 |
| 忽略违规选项 | ❌ 未实现 | ✅ `getIgnoreViolations` | 官方可忽略特定违规 |

**实现完整度**: ⭐ (0%)
**建议**: 这是重要的调试和监控功能，建议实现

---

## T138: 沙箱失败回退

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/sandbox/bubblewrap.ts`

**核心功能**:
```typescript
export class BubblewrapSandbox {
  async execute(command: string, args: string[]): Promise<ExecutionResult> {
    if (!isBubblewrapAvailable()) {
      return this.executeFallback(command, args);  // ✅ 回退
    }

    // ... bwrap 执行 ...

    proc.on('error', (err) => {
      // ✅ 错误时回退到非沙箱执行
      this.executeFallback(command, args).then(resolve);
    });
  }

  private async executeFallback(command: string, args: string[]): Promise<ExecutionResult> {
    // 直接执行，不使用沙箱
    const proc = child_process.spawn(command, args, {
      env: this.options.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: this.options.timeout || 60000,
      cwd: this.options.cwd || process.cwd(),
    });

    // ... 返回 sandboxed: false
    return {
      exitCode: code ?? 1,
      stdout,
      stderr,
      sandboxed: false,  // ✅ 标记为未沙箱化
      duration: Date.now() - startTime,
    };
  }
}

// execInSandbox 也有回退
export async function execInSandbox(...): Promise<SandboxResult> {
  if (!isBubblewrapAvailable() || config.enabled === false) {
    // ✅ 回退到非沙箱执行
    return new Promise((resolve) => {
      const proc = child_process.spawn(command, args, ...);
      // ...
      resolve({ exitCode, stdout, stderr, sandboxed: false });
    });
  }

  // bwrap 执行失败时也回退
  proc.on('error', (err) => {
    // ✅ 回退机制
  });
}
```

### 官方实现

**观察到的特征**:
- ✅ 169 次 `fallback` 引用
- ✅ 32 次 `sandbox.*fail` 匹配
- ✅ 47 次 `sandbox.*error` 匹配
- ✅ 2 次 "Sandbox Error" 错误消息
- ✅ 失败检测和自动重试机制

**推断的行为**:
1. 检测沙箱失败原因
2. 自动用 `dangerouslyDisableSandbox: true` 重试
3. 向用户说明失败原因
4. 提示使用 `/sandbox` 命令调整设置

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 基本回退 | ✅ `executeFallback()` | ✅ 有 | 都支持基本回退 |
| 回退标记 | ✅ `sandboxed: false` | ✅ 有 | 都标记是否沙箱化 |
| 失败检测 | ✅ error 事件 | ✅ 更智能 | 官方有更详细的失败分析 |
| 自动重试 | ❌ 未实现 | ✅ 智能重试 | 官方自动重试失败命令 |
| 错误注释 | ❌ 未实现 | ✅ `annotateStderrWithSandboxFailures` | 官方标注沙箱错误 |
| 用户提示 | ❌ 未实现 | ✅ 详细提示 | 官方提示如何解决 |

**实现完整度**: ⭐⭐⭐ (60%)
**差距**: 缺少智能失败分析、自动重试、用户提示

---

## T139: 沙箱设置锁定 SandboxSettingsLockedByPolicy

### 本项目实现

**状态**: ❌ **未实现**

未找到策略锁定机制。

### 官方实现

**观察到的特征**:
- ✅ `areSandboxSettingsLockedByPolicy` 函数（4 次引用）
- ✅ `setSandboxSettings` 函数
- ✅ 策略强制模式

**推断的功能**:
```typescript
// 检查沙箱设置是否被策略锁定
function areSandboxSettingsLockedByPolicy(): boolean

// 设置沙箱配置（可能被策略阻止）
function setSandboxSettings(settings: SandboxSettings): boolean

// 策略锁定时的行为
if (areSandboxSettingsLockedByPolicy()) {
  // - 禁止 dangerouslyDisableSandbox
  // - 强制使用沙箱
  // - 不允许修改沙箱设置
}
```

**系统提示词**（策略锁定模式）:
```
- CRITICAL: All commands MUST run in sandbox mode - the `dangerouslyDisableSandbox`
  parameter is disabled by policy
- Commands cannot run outside the sandbox under any circumstances
- If a command fails due to sandbox restrictions, work with the user to adjust
  sandbox settings instead
```

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 策略锁定检测 | ❌ 未实现 | ✅ `areSandboxSettingsLockedByPolicy` | **核心差距** |
| 强制沙箱模式 | ❌ 未实现 | ✅ 完整支持 | 官方可强制启用沙箱 |
| 禁用绕过选项 | ❌ 未实现 | ✅ 策略控制 | 官方可禁止 dangerouslyDisableSandbox |
| 设置保护 | ❌ 未实现 | ✅ `setSandboxSettings` | 官方保护沙箱设置 |
| 企业策略支持 | ❌ 未实现 | ✅ 完整支持 | 官方支持企业策略 |

**实现完整度**: ⭐ (0%)
**建议**: 企业环境的重要功能，建议实现

---

## T140: 沙箱调试模式 SandboxDebug

### 本项目实现

**状态**: ⚠️ **部分实现**

有一些基本的错误信息，但没有专门的调试模式。

**现有的调试信息**:
```typescript
// 在 bubblewrap.ts 中
console.warn('Failed to load sandbox config, using defaults:', error);

// 在 config.ts 中
console.error('Invalid configuration:', validation.errors);
console.warn('Configuration warnings:', validation.warnings);
```

### 官方实现

**观察到的特征**:
- ✅ `SandboxDebug` 标识（1 次引用）
- ✅ `SRT_DEBUG` 环境变量
- ✅ 调试日志系统

**代码片段**（从 cli.js 提取）:
```javascript
function FB(A, Q) {
  if (!process.env.SRT_DEBUG) return;  // ✅ 调试开关

  let B = Q?.level || "info",
      G = "[SandboxDebug]";

  switch (B) {
    case "error":
      console.error(`${G} ${A}`);
      break;
    case "warn":
      console.warn(`${G} ${A}`);
      break;
    default:
      console.error(`${G} ${A}`);
  }
}
```

**推断的功能**:
```typescript
// 沙箱调试日志
function sandboxDebug(message: string, options?: { level?: 'info' | 'warn' | 'error' })

// 使用方式
if (process.env.SRT_DEBUG) {
  sandboxDebug('Bubblewrap command: ' + bwrapArgs.join(' '));
  sandboxDebug('Sandbox violation detected', { level: 'warn' });
}
```

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| 调试模式开关 | ❌ 未实现 | ✅ `SRT_DEBUG` 环境变量 | 官方有专门的调试开关 |
| 调试日志标识 | ❌ 未实现 | ✅ `[SandboxDebug]` 前缀 | 官方有清晰的日志标识 |
| 日志级别 | ⚠️ 基本支持 | ✅ info/warn/error | 官方有完整的日志级别 |
| 详细沙箱信息 | ❌ 未实现 | ✅ 详细调试 | 官方输出详细的沙箱操作 |
| 违规调试 | ❌ 未实现 | ✅ 违规详情 | 官方调试违规情况 |

**实现完整度**: ⭐⭐ (20%)
**建议**: 添加 `CLAUDE_SANDBOX_DEBUG` 环境变量和统一的调试日志

---

## T141: macOS 沙箱支持

### 本项目实现

**状态**: ❌ **未实现**

本项目的沙箱主要针对 Linux（Bubblewrap）。

**能力检测**:
```typescript
export function getSandboxCapabilities(): {
  bubblewrap: boolean;
  firejail: boolean;
  docker: boolean;
  macosSandbox: boolean;  // ✅ 有检测
} {
  const platform = os.platform();

  return {
    bubblewrap: platform === 'linux' && isBubblewrapAvailable(),
    firejail: platform === 'linux' && checkCommand('firejail'),
    docker: checkCommand('docker'),
    macosSandbox: platform === 'darwin',  // ❌ 但未实现
  };
}
```

### 官方实现

**观察到的特征**:
- ✅ 2 次 `darwin.*sandbox` 匹配
- ✅ 6 次 `macos.*sandbox` 匹配
- ✅ macOS 沙箱违规解析
- ✅ macOS 平台支持

**macOS 沙箱违规解析**（从代码提取）:
```javascript
// 查找 macOS 沙箱拒绝消息
W = I.find((E) => E.includes("Sandbox:") && E.includes("deny"))

// 查找 CMD64_ 编码的命令
K = I.find((E) => E.startsWith("CMD64_"))

// 解析违规信息
if (!W) return;
let V = W.match(G);  // 正则匹配违规详情
if (!V?.[1]) return;

// 提取文件操作、进程操作等违规类型
```

**推断的 macOS 沙箱功能**:
1. 使用 macOS 原生 `sandbox-exec` 命令
2. 解析 macOS 沙箱拒绝日志
3. 支持 Sandbox Profile Language
4. 检测文件系统、网络、进程违规

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| macOS 检测 | ✅ `platform === 'darwin'` | ✅ 完整检测 | 都检测 macOS |
| macOS 沙箱实现 | ❌ 未实现 | ✅ sandbox-exec | **重大差距** |
| 违规日志解析 | ❌ 未实现 | ✅ 解析 Sandbox: deny | 官方解析 macOS 日志 |
| CMD64 解码 | ❌ 未实现 | ✅ 支持 | 官方解析编码的命令 |
| Sandbox Profile | ❌ 未实现 | ✅ 可能支持 | 官方可能支持自定义 profile |

**实现完整度**: ⭐ (10%)
**建议**: 实现 macOS `sandbox-exec` 支持

---

## T142: Windows 沙箱支持

### 本项目实现

**状态**: ❌ **未实现**

本项目没有 Windows 沙箱实现。

**能力检测**:
```typescript
export function getSandboxCapabilities() {
  // ❌ 没有检测 Windows 沙箱
  return {
    bubblewrap: platform === 'linux' && ...,
    firejail: platform === 'linux' && ...,
    docker: checkCommand('docker'),
    macosSandbox: platform === 'darwin',
    // ❌ 缺少 windowsSandbox
  };
}
```

### 官方实现

**观察到的特征**:
- ✅ 8 次 `windows.*sandbox` 匹配
- ✅ 5 次 `win32.*sandbox` 匹配
- ✅ Windows 平台支持

**可能的实现方式**:
1. **Windows Sandbox** - Windows 10/11 内置沙箱
2. **Docker for Windows** - 容器化
3. **WSL2 + Bubblewrap** - WSL 中使用 Linux 沙箱
4. **限制性更低的路径控制** - Windows 特定的路径过滤

### 对比分析

| 功能特性 | 本项目 | 官方实现 | 差异说明 |
|---------|--------|---------|---------|
| Windows 检测 | ❌ 未实现 | ✅ `win32` 支持 | 官方检测 Windows |
| Windows 沙箱 | ❌ 未实现 | ✅ 某种实现 | **重大差距** |
| WSL 支持 | ❌ 未实现 | ❓ 未确定 | 可能通过 WSL 支持 |
| Docker Windows | ⚠️ 基本支持 | ✅ 完整支持 | 本项目有 Docker 配置 |
| 路径过滤 | ⚠️ 跨平台 | ✅ Windows 特定 | 官方可能有 Windows 优化 |

**实现完整度**: ⭐ (10%)
**建议**: 至少支持 Docker for Windows

---

## 总体对比总结

### 实现完整度评分

| 功能点 | 功能描述 | 本项目 | 官方 | 完整度 |
|-------|---------|--------|------|--------|
| T131 | Bubblewrap 沙箱集成 | ✅ | ✅ | ⭐⭐⭐⭐⭐ 95% |
| T132 | 沙箱启用检测 | ✅ | ✅ | ⭐⭐⭐⭐ 85% |
| T133 | 沙箱目录白名单 | ✅ | ✅ | ⭐⭐⭐⭐ 90% |
| T134 | 沙箱网络控制 | ⚠️ | ✅ | ⭐⭐⭐ 70% |
| T135 | 沙箱文件系统隔离 | ✅ | ✅ | ⭐⭐⭐⭐ 85% |
| T136 | dangerouslyDisableSandbox | ❌ | ✅ | ⭐ 10% |
| T137 | SandboxViolationStore | ❌ | ✅ | ⭐ 0% |
| T138 | 沙箱失败回退 | ⚠️ | ✅ | ⭐⭐⭐ 60% |
| T139 | SandboxSettingsLockedByPolicy | ❌ | ✅ | ⭐ 0% |
| T140 | SandboxDebug | ⚠️ | ✅ | ⭐⭐ 20% |
| T141 | macOS 沙箱支持 | ❌ | ✅ | ⭐ 10% |
| T142 | Windows 沙箱支持 | ❌ | ✅ | ⭐ 10% |

**平均完整度**: ⭐⭐⭐ (46%)

### 核心优势

**本项目的优势**:
1. ✅ **代码结构清晰** - 模块化设计，易于理解和维护
2. ✅ **类型安全** - 完整的 TypeScript 类型定义
3. ✅ **详细文档** - README 和示例代码
4. ✅ **灵活配置** - 7 种预设配置，Zod 验证
5. ✅ **OOP 封装** - 使用类封装沙箱功能
6. ✅ **通配符支持** - 强大的路径模式匹配
7. ✅ **网络统计** - 详细的网络请求日志和统计

**官方的优势**:
1. ✅ **多平台支持** - Linux, macOS, Windows 全覆盖
2. ✅ **违规检测** - `SandboxViolationStore` 记录所有违规
3. ✅ **智能重试** - 自动检测失败并重试
4. ✅ **策略锁定** - 企业策略强制模式
5. ✅ **调试模式** - `SRT_DEBUG` 环境变量
6. ✅ **错误注释** - 自动标注 stderr 中的沙箱错误
7. ✅ **Unix Socket** - 支持 Unix Socket 和代理

### 关键差距

#### 🔴 高优先级差距

1. **T136: dangerouslyDisableSandbox** (10%)
   - 核心功能缺失
   - 需要在 Bash 工具中添加此参数
   - 包括智能失败检测和自动重试

2. **T137: SandboxViolationStore** (0%)
   - 缺少违规记录系统
   - 需要实现违规存储和查询
   - 需要 stderr 注释功能

3. **T139: SandboxSettingsLockedByPolicy** (0%)
   - 缺少策略锁定机制
   - 企业环境的重要功能
   - 需要强制沙箱模式

#### 🟡 中优先级差距

4. **T141: macOS 沙箱支持** (10%)
   - 仅检测但未实现
   - 需要 `sandbox-exec` 集成
   - 需要 macOS 日志解析

5. **T142: Windows 沙箱支持** (10%)
   - 完全缺失
   - 需要 Windows Sandbox 或 Docker 支持

6. **T134: 网络控制** (70%)
   - 缺少 Unix Socket 支持
   - 缺少代理功能
   - 缺少本地绑定控制

#### 🟢 低优先级差距

7. **T140: SandboxDebug** (20%)
   - 缺少统一的调试系统
   - 需要添加 `CLAUDE_SANDBOX_DEBUG` 环境变量

8. **T138: 失败回退** (60%)
   - 基本功能有，但不够智能
   - 需要更好的失败分析和用户提示

### 实现建议

#### 第一阶段：核心功能补全（高优先级）

1. **实现 dangerouslyDisableSandbox**
   ```typescript
   // src/tools/bash.ts
   interface BashInput {
     command: string;
     description?: string;
     dangerouslyDisableSandbox?: boolean;  // 新增
   }

   // src/sandbox/bubblewrap.ts
   export async function execInSandbox(
     command: string,
     args: string[],
     options: {
       dangerouslyDisableSandbox?: boolean;  // 新增
       // ...
     }
   ) {
     if (options.dangerouslyDisableSandbox) {
       // 绕过沙箱
       return executeFallback(command, args);
     }
     // 正常沙箱执行
   }
   ```

2. **实现 SandboxViolationStore**
   ```typescript
   // src/sandbox/violation-store.ts
   export class SandboxViolationStore {
     private violations: SandboxViolation[] = [];

     recordViolation(violation: SandboxViolation): void
     getViolations(filter?: ViolationFilter): SandboxViolation[]
     clearViolations(): void
     exportViolations(): string
   }

   export function annotateStderrWithSandboxFailures(stderr: string): string {
     // 解析 stderr 并标注沙箱错误
   }
   ```

3. **实现策略锁定**
   ```typescript
   // src/sandbox/policy.ts
   export class SandboxPolicy {
     private locked: boolean = false;

     isLocked(): boolean
     lock(): void
     unlock(): void
     canDisableSandbox(): boolean
   }
   ```

#### 第二阶段：平台扩展（中优先级）

4. **macOS 沙箱支持**
   ```typescript
   // src/sandbox/macos.ts
   export class MacOSSandbox {
     static isAvailable(): boolean
     async execute(command: string, profile?: string): Promise<SandboxResult>
     parseViolations(stderr: string): SandboxViolation[]
   }
   ```

5. **Windows 沙箱支持**
   ```typescript
   // src/sandbox/windows.ts
   export class WindowsSandbox {
     static isAvailable(): boolean
     async execute(command: string): Promise<SandboxResult>
     // 可能使用 Docker for Windows
   }
   ```

6. **网络功能增强**
   ```typescript
   // src/sandbox/network.ts
   export class NetworkSandbox {
     // 新增功能
     allowUnixSocket(path: string): void
     setProxy(proxy: ProxyConfig): void
     allowLocalBinding(port: number): void
   }
   ```

#### 第三阶段：用户体验优化（低优先级）

7. **调试模式**
   ```typescript
   // src/sandbox/debug.ts
   export function sandboxDebug(
     message: string,
     options?: { level?: 'info' | 'warn' | 'error' }
   ) {
     if (!process.env.CLAUDE_SANDBOX_DEBUG) return;
     console.error(`[SandboxDebug] ${message}`);
   }
   ```

8. **智能失败处理**
   ```typescript
   // src/sandbox/failure-analyzer.ts
   export class SandboxFailureAnalyzer {
     analyzeFailure(result: ExecutionResult): FailureAnalysis
     shouldRetryWithoutSandbox(analysis: FailureAnalysis): boolean
     getUserHint(analysis: FailureAnalysis): string
   }
   ```

### 架构建议

**推荐的沙箱抽象层**:
```typescript
// src/sandbox/sandbox-manager.ts
export class SandboxManager {
  private linux: BubblewrapSandbox;
  private macos: MacOSSandbox;
  private windows: WindowsSandbox;
  private violations: SandboxViolationStore;
  private policy: SandboxPolicy;

  async execute(
    command: string,
    options: {
      dangerouslyDisableSandbox?: boolean;
      timeout?: number;
      // ...
    }
  ): Promise<SandboxResult> {
    // 1. 检查策略锁定
    if (this.policy.isLocked() && options.dangerouslyDisableSandbox) {
      throw new Error('Sandbox bypass disabled by policy');
    }

    // 2. 选择合适的沙箱实现
    const sandbox = this.selectSandbox();

    // 3. 执行命令
    const result = await sandbox.execute(command);

    // 4. 记录违规
    if (result.violations) {
      result.violations.forEach(v => this.violations.recordViolation(v));
    }

    // 5. 失败处理
    if (result.exitCode !== 0 && !options.dangerouslyDisableSandbox) {
      const analysis = this.analyzeFailure(result);
      if (analysis.isSandboxRelated) {
        // 智能重试
        return this.execute(command, {
          ...options,
          dangerouslyDisableSandbox: true
        });
      }
    }

    return result;
  }

  private selectSandbox(): Sandbox {
    const platform = os.platform();
    if (platform === 'linux') return this.linux;
    if (platform === 'darwin') return this.macos;
    if (platform === 'win32') return this.windows;
    throw new Error('Unsupported platform');
  }
}
```

---

## 总结

### ✅ 已实现的核心功能

1. **Linux Bubblewrap 沙箱** - 完整实现，功能强大
2. **文件系统隔离** - 路径白名单/黑名单，通配符支持
3. **网络沙箱** - 域名/端口/协议过滤，速率限制
4. **配置系统** - 7 种预设，Zod 验证，配置合并
5. **基本回退机制** - 沙箱不可用时自动回退

### ❌ 核心差距

1. **dangerouslyDisableSandbox** - 官方的核心功能，本项目缺失
2. **SandboxViolationStore** - 违规记录和调试，完全缺失
3. **策略锁定** - 企业策略强制模式，完全缺失
4. **多平台支持** - macOS 和 Windows 沙箱未实现
5. **智能失败处理** - 缺少自动重试和用户提示

### 🎯 后续工作优先级

**立即实现** (关键功能):
1. T136: `dangerouslyDisableSandbox` 参数
2. T137: `SandboxViolationStore` 违规存储

**短期实现** (重要功能):
3. T139: 策略锁定机制
4. T141: macOS 沙箱支持
5. T138: 智能失败处理改进

**长期实现** (增强功能):
6. T142: Windows 沙箱支持
7. T140: 完整的调试模式
8. T134: 网络功能增强（Unix Socket, 代理）

---

**文档生成时间**: 2025-12-25
**分析工具**: Claude Code Agent
**数据来源**:
- 本项目源码: `/home/user/claude-code-open/src/sandbox/`
- 官方包: `@anthropic-ai/claude-code@2.0.76`
