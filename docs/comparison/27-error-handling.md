# 错误处理功能对比分析 (T299-T305)

## 概述

本文档对比分析开源实现与官方 `@anthropic-ai/claude-code` 包在错误处理方面的差异。

**分析日期**: 2025-12-25
**官方包版本**: 最新版（从 node_modules）
**对比范围**: 错误处理功能点 T299-T305

---

## T299: 全局错误处理

### 本项目实现

**位置**: `/home/user/claude-code-open/src/cli.ts` (1112-1119行)

```typescript
// 错误处理
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
});
```

**特点**:
- ✅ 捕获未捕获异常（uncaughtException）
- ✅ 捕获未处理的 Promise 拒绝（unhandledRejection）
- ✅ 使用 chalk 着色输出
- ⚠️ uncaughtException 后立即退出
- ⚠️ unhandledRejection 不退出（可能导致不一致状态）

### 官方实现

**位置**: 混淆代码中包含全局错误处理器

**特点**:
- ✅ 集成 Sentry 错误报告系统
- ✅ 错误分类和过滤（ignoreErrors, ignoreTransactions）
- ✅ 错误事件描述生成
- ✅ 更完善的错误上下文收集
- ✅ 崩溃报告自动上传

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 基础错误捕获 | ✅ | ✅ | 无 |
| 错误报告系统 | ❌ | ✅ Sentry | **重大** |
| 错误过滤 | ❌ | ✅ | 中等 |
| 错误上下文 | 基础 | 完整 | 中等 |
| 崩溃恢复 | ❌ | ✅ | 重大 |

**完成度**: **40%** ⚠️

---

## T300: 错误分类

### 本项目实现

**位置**: `/home/user/claude-code-open/src/types/errors.ts`

```typescript
/**
 * 错误代码枚举
 * 使用分段管理：
 * - 1000-1999: 工具相关错误
 * - 2000-2999: 权限相关错误
 * - 3000-3999: 配置相关错误
 * - 4000-4999: 网络相关错误
 * - 5000-5999: 认证相关错误
 * - 6000-6999: 验证相关错误
 * - 7000-7999: 会话相关错误
 * - 8000-8999: 沙箱相关错误
 * - 9000-9999: 系统相关错误
 */
export enum ErrorCode {
  // ========== 工具相关错误 (1000-1999) ==========
  TOOL_EXECUTION_FAILED = 1000,
  TOOL_NOT_FOUND = 1001,
  TOOL_TIMEOUT = 1002,
  // ... 共37个错误代码
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

**错误类层次结构**:
```typescript
BaseClaudeError (基类)
├── ToolExecutionError (工具执行错误)
├── PermissionDeniedError (权限拒绝)
├── ConfigurationError (配置错误)
├── NetworkError (网络错误)
├── AuthenticationError (认证错误)
├── ValidationError (验证错误)
├── SessionError (会话错误)
├── SandboxError (沙箱错误)
├── PluginError (插件错误)
└── SystemError (系统错误)
```

**MCP 专用错误分类** (`src/mcp/errors.ts`):
```typescript
export enum McpErrorCode {
  // JSON-RPC 2.0 标准错误代码
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  // MCP 自定义错误代码
  CONNECTION_FAILED = -1001,
  TOOL_NOT_FOUND = -1005,
  // ... 共13个 MCP 错误代码
}
```

**特点**:
- ✅ 完整的错误代码体系（37个通用 + 13个 MCP）
- ✅ 四级严重级别分类
- ✅ 完整的错误类层次结构
- ✅ 自动严重级别推断
- ✅ 错误上下文和原因链
- ✅ JSON 序列化支持

### 官方实现

**观察到的特征**:
- ✅ 错误事件描述系统
- ✅ 错误类型匹配（ignoreErrors, denyUrls）
- ⚠️ 错误代码结构不明确（混淆）

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 错误代码体系 | ✅ 50种 | ⚠️ 未知 | 可能相当 |
| 错误分类 | ✅ 10类 | ⚠️ 未知 | 可能相当 |
| 严重级别 | ✅ 4级 | ⚠️ 未知 | 可能相当 |
| MCP 专用错误 | ✅ | ✅ | 相当 |
| 错误继承 | ✅ | ⚠️ 未知 | 可能相当 |

**完成度**: **85%** ✅

---

## T301: 错误恢复策略

### 本项目实现

**1. 自动重试逻辑** (`src/core/client.ts`):

```typescript
// 可重试的错误类型
const RETRYABLE_ERRORS = [
  'overloaded_error',
  'rate_limit_error',
  'api_error',
  'timeout',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];

/**
 * 执行带重试的请求
 */
private async withRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorType = error.type || error.code || error.message || '';
    const isRetryable = RETRYABLE_ERRORS.some(
      (e) => errorType.includes(e) || error.message?.includes(e)
    );

    if (isRetryable && retryCount < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, retryCount); // 指数退避
      console.error(
        `API error (${errorType}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
      );
      await this.sleep(delay);
      return this.withRetry(operation, retryCount + 1);
    }

    throw error;
  }
}
```

**配置**:
- 默认最大重试次数: 4
- 默认基础延迟: 1000ms
- 重试策略: 指数退避

**2. MCP 错误恢复** (`src/mcp/errors.ts`):

```typescript
export class McpErrorHandler {
  /**
   * 处理错误
   */
  handle(error: McpError): ErrorAction {
    // 更新统计
    this.updateStats(error);

    // 触发回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });

    // 确定处理动作
    if (!error.recoverable) {
      return ErrorAction.FAIL;
    }

    if (error.retryable) {
      if (
        error.code === McpErrorCode.CONNECTION_FAILED ||
        error.code === McpErrorCode.CONNECTION_CLOSED ||
        error.code === McpErrorCode.CONNECTION_TIMEOUT
      ) {
        return ErrorAction.RECONNECT;
      }
      return ErrorAction.RETRY;
    }

    if (error.severity === McpErrorSeverity.LOW) {
      return ErrorAction.IGNORE;
    }

    return ErrorAction.FAIL;
  }

  /**
   * 获取重试延迟（带抖动）
   */
  getRetryDelay(error: McpError, attempt: number): number {
    let delay: number;

    // 限流错误的特殊处理
    if (error.code === McpErrorCode.RATE_LIMITED) {
      const retryAfter = (error.data as { retryAfter?: number })?.retryAfter;
      if (retryAfter && typeof retryAfter === 'number') {
        return Math.min(retryAfter * 1000, this.maxDelay);
      }
      delay = this.baseDelay * 5;
    } else {
      delay = this.baseDelay;
    }

    // 指数退避
    if (this.exponentialBackoff) {
      delay *= Math.pow(2, attempt);
    }

    // 限制最大延迟
    delay = Math.min(delay, this.maxDelay);

    // 添加抖动
    if (this.jitter) {
      const jitterAmount = delay * 0.3; // ±30% 抖动
      delay += (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.max(Math.floor(delay), 0);
  }
}
```

**3. 错误可恢复性判断**:

```typescript
/**
 * 根据错误代码判断是否可恢复
 */
private determineRecoverable(code: ErrorCode): boolean {
  const unrecoverableCodes = [
    ErrorCode.CONFIG_SCHEMA_ERROR,
    ErrorCode.VALIDATION_SCHEMA_ERROR,
    ErrorCode.PLUGIN_CIRCULAR_DEPENDENCY,
    ErrorCode.SANDBOX_ESCAPE_ATTEMPT,
    ErrorCode.SYSTEM_OUT_OF_MEMORY,
    ErrorCode.SYSTEM_DISK_FULL,
  ];
  return !unrecoverableCodes.includes(code);
}
```

**特点**:
- ✅ 指数退避重试
- ✅ 智能抖动（防止惊群）
- ✅ 可恢复性自动判断
- ✅ 限流特殊处理（Retry-After）
- ✅ 错误动作决策（RETRY/RECONNECT/FAIL/IGNORE）
- ✅ 最大重试限制

### 官方实现

**观察到的特征**:
- ✅ EAGAIN 错误自动重试（ripgrep 单线程模式）
- ✅ 重试逻辑
- ⚠️ 具体策略不明确（混淆）

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 自动重试 | ✅ | ✅ | 无 |
| 指数退避 | ✅ | ⚠️ 可能有 | 小 |
| 抖动机制 | ✅ | ⚠️ 未知 | 可能有 |
| 限流处理 | ✅ | ⚠️ 未知 | 可能有 |
| 可恢复性判断 | ✅ | ⚠️ 未知 | 可能有 |
| 重连策略 | ✅ | ⚠️ 未知 | 可能有 |

**完成度**: **80%** ✅

---

## T302: 错误报告

### 本项目实现

**1. 错误格式化** (`src/types/errors.ts`):

```typescript
/**
 * 格式化错误为人类可读字符串
 */
export function formatError(error: unknown, verbose = false): string {
  if (isClaudeError(error)) {
    const parts: string[] = [];

    // 错误名称和消息
    parts.push(`${error.name}: ${error.message}`);

    // 错误代码
    parts.push(`  Code: ${error.code} (${ErrorCode[error.code] || 'Unknown'})`);

    // 严重级别
    parts.push(`  Severity: ${error.severity}`);

    // 可恢复性和重试性
    const flags: string[] = [];
    if (error.recoverable) flags.push('recoverable');
    if (error.retryable) flags.push('retryable');
    if (flags.length > 0) {
      parts.push(`  Flags: ${flags.join(', ')}`);
    }

    // 上下文信息
    if (error.context && Object.keys(error.context).length > 0) {
      parts.push(`  Context: ${JSON.stringify(error.context)}`);
    }

    // 详细信息（verbose 模式）
    if (verbose) {
      // 时间戳
      parts.push(`  Timestamp: ${new Date(error.timestamp).toISOString()}`);

      // 详细数据
      if (error.details) {
        parts.push(`  Details: ${JSON.stringify(error.details, null, 2)}`);
      }

      // 原因链
      if (error.cause) {
        parts.push(`  Caused by: ${error.cause.message}`);
        if (error.cause.stack) {
          parts.push(`    ${error.cause.stack.split('\n').slice(0, 3).join('\n    ')}`);
        }
      }

      // 堆栈跟踪
      if (error.stack) {
        parts.push(`  Stack: ${error.stack.split('\n').slice(1, 4).join('\n  ')}`);
      }
    }

    return parts.join('\n');
  }

  // 非 Claude 错误
  if (error instanceof Error) {
    return verbose
      ? `${error.name}: ${error.message}\n${error.stack}`
      : `${error.name}: ${error.message}`;
  }

  return String(error);
}
```

**2. MCP 错误格式化**:

```typescript
export function formatMcpError(error: McpError, verbose = false): string {
  const parts: string[] = [];

  parts.push(`${error.name}: ${error.message}`);

  if (error.serverName) {
    parts.push(`  Server: ${error.serverName}`);
  }

  parts.push(`  Code: ${error.code} (${McpErrorCode[error.code] || 'Unknown'})`);
  parts.push(`  Severity: ${error.severity}`);

  // ... 详细信息

  return parts.join('\n');
}
```

**3. 错误统计**:

```typescript
export interface ErrorStats {
  total: number;
  byCode: Map<McpErrorCode, number>;
  bySeverity: Map<McpErrorSeverity, number>;
  byServer: Map<string, number>;
  recoverable: number;
  unrecoverable: number;
  retried: number;
  firstError?: McpError;
  lastError?: McpError;
}
```

**特点**:
- ✅ 人类可读的错误格式化
- ✅ 详细/简洁两种模式
- ✅ 错误统计收集
- ✅ 原因链追踪
- ✅ 上下文信息
- ❌ 无自动错误上报（Sentry）
- ❌ 无错误聚合

### 官方实现

**观察到的特征**:
- ✅ Sentry 错误报告集成
- ✅ 事件描述生成
- ✅ 堆栈跟踪处理
- ✅ 错误过滤和采样

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 错误格式化 | ✅ | ✅ | 无 |
| 详细模式 | ✅ | ✅ | 无 |
| 统计收集 | ✅ | ✅ | 无 |
| 自动上报 | ❌ | ✅ Sentry | **重大** |
| 错误聚合 | ❌ | ✅ | 中等 |
| 堆栈跟踪 | ✅ | ✅ | 无 |

**完成度**: **60%** ⚠️

---

## T303: 优雅降级

### 本项目实现

**1. TUI 降级到文本界面** (`src/cli.ts`):

```typescript
async function runTuiInterface(...) {
  try {
    // 动态导入 App 组件
    const { App } = await import('./ui/App.js');

    // 渲染 Ink 应用
    render(React.createElement(App, {...}));
  } catch (error) {
    console.error(chalk.red('Failed to start TUI interface:'), error);
    console.log(chalk.yellow('Falling back to text interface...'));
    await runTextInterface(prompt, options, modelMap, systemPrompt);
  }
}
```

**2. 工具降级**:
- ⚠️ 未实现明确的工具降级策略
- ⚠️ 工具失败时不会尝试替代方案

**3. 模型降级** (`src/cli.ts`):

```typescript
// 配置支持，但未实现自动降级
.option('--fallback-model <model>', 'Fallback model when default is overloaded')
```

**特点**:
- ✅ UI 降级（TUI → 文本）
- ⚠️ 模型降级支持但未实现
- ❌ 工具降级未实现
- ❌ 功能降级策略不完整

### 官方实现

**观察到的特征**:
- ✅ 包含 fallback 相关代码
- ⚠️ 具体策略不明确

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| UI 降级 | ✅ | ⚠️ 未知 | 可能相当 |
| 模型降级 | ⚠️ 部分 | ✅ | 中等 |
| 工具降级 | ❌ | ⚠️ 未知 | 可能有 |
| 功能降级 | ❌ | ⚠️ 未知 | 可能有 |

**完成度**: **40%** ⚠️

---

## T304: 崩溃恢复

### 本项目实现

**1. 会话持久化** (`src/core/session.ts`):

```typescript
export class Session {
  // 会话保存到 ~/.claude/sessions/
  save(): string {
    const sessionData = {
      id: this.sessionId,
      messages: this.messages,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
    };

    const sessionFile = path.join(this.getSessionDir(), `${this.sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
    return sessionFile;
  }

  static load(sessionId: string): Session | null {
    const sessionFile = path.join(Session.getSessionDir(), `${sessionId}.json`);
    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    const session = new Session();
    // ... 恢复会话状态
    return session;
  }
}
```

**2. 会话恢复选项** (`src/cli.ts`):

```typescript
.option('-c, --continue', 'Continue the most recent conversation')
.option('-r, --resume [value]', 'Resume by session ID, or open interactive picker')
```

**3. 崩溃处理**:

```typescript
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err.message);
  process.exit(1);  // ⚠️ 直接退出，未保存状态
});
```

**问题**:
- ❌ 崩溃前不保存会话
- ❌ 无自动崩溃报告
- ❌ 无崩溃后自动恢复
- ⚠️ 需要手动恢复会话

### 官方实现

**观察到的特征**:
- ✅ Sentry 崩溃报告
- ✅ 错误追踪和恢复
- ⚠️ 具体恢复机制不明确

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 会话持久化 | ✅ | ✅ | 无 |
| 崩溃保存 | ❌ | ⚠️ 可能有 | 可能有 |
| 自动恢复 | ❌ | ⚠️ 可能有 | 可能有 |
| 崩溃报告 | ❌ | ✅ Sentry | **重大** |
| 状态检查点 | ❌ | ⚠️ 未知 | 可能有 |

**完成度**: **30%** ❌

---

## T305: 错误提示优化

### 本项目实现

**1. 用户友好的错误消息**:

```typescript
// CLI 错误提示
console.error(chalk.red('Uncaught Exception:'), err.message);
console.error(chalk.red('Unhandled Rejection:'), reason);
```

**2. 工厂函数提供默认消息**:

```typescript
export function createPermissionDeniedError(
  resource: string,
  permissionType: string,
  message?: string,
  options?: ErrorOptions
): PermissionDeniedError {
  const defaultMessage = `Permission denied: ${permissionType} access to ${resource}`;
  return new PermissionDeniedError(
    message || defaultMessage,
    resource,
    permissionType,
    options
  );
}
```

**3. API 错误重试提示**:

```typescript
console.error(
  `API error (${errorType}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
);
```

**特点**:
- ✅ 彩色输出（chalk）
- ✅ 默认错误消息
- ✅ 重试进度提示
- ⚠️ 错误建议不完整
- ❌ 无多语言支持
- ❌ 无错误文档链接

### 官方实现

**观察到的特征**:
- ✅ 详细的错误描述
- ✅ 堆栈跟踪格式化
- ✅ 错误上下文信息

**差异分析**:

| 功能 | 本项目 | 官方实现 | 差距 |
|------|--------|----------|------|
| 彩色输出 | ✅ | ⚠️ 未知 | 可能相当 |
| 默认消息 | ✅ | ✅ | 无 |
| 错误建议 | ⚠️ 部分 | ⚠️ 未知 | 可能有 |
| 文档链接 | ❌ | ⚠️ 未知 | 可能有 |
| 多语言 | ❌ | ❌ | 无 |

**完成度**: **65%** ⚠️

---

## 总体评估

### 功能完成度总览

| 任务ID | 功能点 | 完成度 | 状态 | 主要差距 |
|--------|--------|--------|------|----------|
| T299 | 全局错误处理 | 40% | ⚠️ | 缺少 Sentry 集成 |
| T300 | 错误分类 | 85% | ✅ | 基本完整 |
| T301 | 错误恢复策略 | 80% | ✅ | 基本完整 |
| T302 | 错误报告 | 60% | ⚠️ | 缺少自动上报 |
| T303 | 优雅降级 | 40% | ⚠️ | 策略不完整 |
| T304 | 崩溃恢复 | 30% | ❌ | 缺少自动恢复 |
| T305 | 错误提示优化 | 65% | ⚠️ | 缺少建议和文档 |

**平均完成度**: **57%** ⚠️

### 优势分析

1. **完整的错误类型系统** ✅
   - 50+ 错误代码
   - 10 种错误类型
   - 4 级严重级别
   - 完整的继承层次

2. **智能重试机制** ✅
   - 指数退避
   - 智能抖动
   - 限流处理
   - 可配置策略

3. **MCP 专用错误处理** ✅
   - JSON-RPC 兼容
   - 错误统计
   - 自动重连

4. **会话持久化** ✅
   - 自动保存
   - 手动恢复
   - 30天过期

### 主要差距

1. **缺少错误报告系统** ❌ **重大**
   - 官方使用 Sentry
   - 自动崩溃报告
   - 错误聚合分析

   **影响**: 无法追踪生产环境问题

2. **崩溃恢复不完整** ❌ **重大**
   - 崩溃前不保存状态
   - 无自动恢复机制
   - 依赖手动操作

   **影响**: 用户体验差，数据丢失风险

3. **优雅降级策略不完整** ⚠️ **中等**
   - 只有 UI 降级
   - 缺少模型降级
   - 缺少工具降级

   **影响**: 部分功能不可用时整体失败

4. **错误提示不够友好** ⚠️ **中等**
   - 缺少解决建议
   - 无文档链接
   - 上下文信息有限

   **影响**: 用户难以自行解决问题

### 架构优势

本项目的错误处理架构有以下优势：

1. **清晰的分层设计**:
   ```
   BaseClaudeError (基础)
   ├── 通用错误类型 (10种)
   └── MCP 专用错误
   ```

2. **自动化元数据**:
   - 自动推断严重级别
   - 自动判断可恢复性
   - 自动判断可重试性

3. **完整的类型安全**:
   - TypeScript 类型定义
   - 运行时类型检查
   - 错误转换工具

### 推荐改进

#### 优先级 P0（必须）

1. **集成错误报告系统**
   ```typescript
   // 建议集成 Sentry
   import * as Sentry from '@sentry/node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
   });
   ```

2. **实现崩溃前保存**
   ```typescript
   process.on('uncaughtException', async (err) => {
     console.error(chalk.red('Uncaught Exception:'), err.message);

     // 保存当前会话
     try {
       await this.session.save();
       console.log('Session saved before exit');
     } catch (saveErr) {
       console.error('Failed to save session:', saveErr);
     }

     // 上报错误
     Sentry.captureException(err);
     await Sentry.close(2000);

     process.exit(1);
   });
   ```

#### 优先级 P1（重要）

3. **完善优雅降级**
   ```typescript
   // 模型降级
   async function executeWithFallback<T>(
     primary: () => Promise<T>,
     fallback: () => Promise<T>
   ): Promise<T> {
     try {
       return await primary();
     } catch (error) {
       if (isOverloadedError(error)) {
         console.warn('Primary model overloaded, using fallback...');
         return await fallback();
       }
       throw error;
     }
   }
   ```

4. **增强错误提示**
   ```typescript
   export function formatErrorWithSuggestion(error: ClaudeError): string {
     const formatted = formatError(error);
     const suggestion = getSuggestionForError(error);
     const docs = getDocsLinkForError(error);

     return `${formatted}\n\nSuggestion: ${suggestion}\nDocs: ${docs}`;
   }
   ```

#### 优先级 P2（建议）

5. **错误统计仪表板**
   ```typescript
   // 添加错误统计 API
   export class ErrorStats {
     getTopErrors(limit: number): ErrorSummary[];
     getErrorRate(timeWindow: number): number;
     exportReport(): string;
   }
   ```

6. **多语言错误消息**
   ```typescript
   export function formatError(
     error: ClaudeError,
     locale: string = 'en'
   ): string {
     const messages = ERROR_MESSAGES[locale];
     return messages[error.code] || error.message;
   }
   ```

---

## 结论

本项目在错误分类和恢复策略方面表现优秀（80-85%），但在错误报告、崩溃恢复和优雅降级方面存在明显差距（30-40%）。

**核心问题**:
1. 缺少生产级错误报告系统（Sentry）
2. 崩溃恢复机制不完整
3. 降级策略覆盖不全

**建议行动**:
1. 立即集成 Sentry 或类似的错误报告系统
2. 实现崩溃前自动保存和自动恢复
3. 完善模型/工具降级策略
4. 增强错误提示的实用性

通过实施这些改进，可以将错误处理功能完成度从 **57%** 提升到 **90%** 以上，接近官方实现水平。

---

**文档版本**: 1.0
**最后更新**: 2025-12-25
**维护者**: Claude Code 开发团队
