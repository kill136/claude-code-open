# 错误处理和重试机制

## 概述

本文档介绍了 Claude Code 项目中的错误处理和重试机制,包括工具级别的重试逻辑、动态超时调整和详细的错误分类。

## 错误类型系统

### 错误代码 (ErrorCode)

错误代码使用分段管理系统:
- **1000-1999**: 工具相关错误
- **2000-2999**: 权限相关错误
- **3000-3999**: 配置相关错误
- **4000-4999**: 网络相关错误
- **5000-5999**: 认证相关错误
- **6000-6999**: 验证相关错误
- **7000-7999**: 会话相关错误
- **8000-8999**: 沙箱相关错误
- **9000-9999**: 系统相关错误
- **10000-10999**: 插件相关错误

### 工具错误类型 (ToolErrorType)

用于更细粒度的工具错误分类:
- `permission_denied` - 权限被拒绝
- `execution_failed` - 执行失败
- `timeout` - 超时
- `invalid_input` - 无效输入
- `network_error` - 网络错误
- `sandbox_error` - 沙箱错误
- `file_system_error` - 文件系统错误
- `mcp_error` - MCP错误
- `unknown` - 未知错误

### 错误严重级别 (ErrorSeverity)

- `low` - 低级:不影响主要功能,可以继续运行
- `medium` - 中级:部分功能受影响,可能需要用户干预
- `high` - 高级:主要功能受影响,需要立即处理
- `critical` - 严重:系统无法正常运行,必须停止

## 重试机制

### 基本概念

重试机制提供了自动重试失败操作的能力,支持:
- **指数退避** (Exponential Backoff): 每次重试的延迟时间递增
- **抖动** (Jitter): 在延迟时间中添加随机性,避免"惊群效应"
- **可配置的重试条件**: 指定哪些错误可以重试
- **重试回调**: 在每次重试前执行自定义逻辑

### 重试选项

```typescript
interface RetryOptions {
  maxRetries?: number;        // 最大重试次数 (默认: 3)
  initialDelay?: number;      // 初始延迟时间 (毫秒, 默认: 1000)
  maxDelay?: number;          // 最大延迟时间 (毫秒, 默认: 30000)
  backoffFactor?: number;     // 退避因子 (默认: 2)
  retryableErrors?: ErrorCode[]; // 可重试的错误代码列表
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
  useJitter?: boolean;        // 是否使用抖动 (默认: true)
}
```

### 使用重试装饰器

```typescript
import { withRetry } from '../utils/retry.js';

const result = await withRetry(
  async () => {
    // 可能失败的操作
    return await fetch('https://api.example.com/data');
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    },
  }
);
```

## 超时机制

### 基本超时

```typescript
import { withTimeout } from '../utils/retry.js';

const result = await withTimeout(
  async () => {
    // 可能超时的操作
    return await fetch('https://api.example.com/slow-endpoint');
  },
  {
    timeout: 5000, // 5秒超时
    toolName: 'example_fetch',
    onTimeout: () => {
      console.log('Operation timed out');
    },
  }
);
```

### 动态超时调整

动态超时调整器根据历史执行时间自动调整超时时间:

```typescript
import { DynamicTimeoutAdjuster } from '../utils/retry.js';

const adjuster = new DynamicTimeoutAdjuster(5000, {
  maxHistorySize: 10,
  multiplier: 2.0,
});

// 记录执行时间
adjuster.recordExecutionTime(3000);
adjuster.recordExecutionTime(4000);

// 获取建议的超时时间
const timeout = adjuster.getTimeout(); // 基于历史数据动态调整
```

## 工具级别的重试和超时

### BaseTool 配置

所有工具都可以通过构造函数配置重试和超时选项:

```typescript
class MyTool extends BaseTool<InputType, OutputType> {
  constructor() {
    super({
      maxRetries: 3,              // 最大重试次数
      baseTimeout: 30000,         // 基础超时时间 (30秒)
      enableDynamicTimeout: true, // 启用动态超时调整
      retryableErrors: [
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCode.NETWORK_TIMEOUT,
      ],
    });
  }

  async execute(input: InputType): Promise<OutputType> {
    // 使用重试和超时包装器
    return this.executeWithRetryAndTimeout(async () => {
      // 实际的执行逻辑
      return this.performOperation(input);
    });
  }
}
```

### MCP 工具的重试策略

MCP 工具默认启用了重试机制:
- **最大重试次数**: 3次
- **超时时间**: 5分钟
- **可重试错误**:
  - `NETWORK_CONNECTION_FAILED` (4000)
  - `NETWORK_TIMEOUT` (4001)
  - `NETWORK_RATE_LIMITED` (4005)

## 错误判断和处理

### 判断错误是否可重试

```typescript
import { isRetryableError, isErrorRetryable } from '../utils/retry.js';

// 方法1: 使用 isRetryableError (检查 ClaudeError)
if (isRetryableError(error)) {
  // 错误可重试
}

// 方法2: 使用 isErrorRetryable (更全面的检查)
if (isErrorRetryable(error, [ErrorCode.NETWORK_TIMEOUT])) {
  // 错误可重试
}
```

### 错误转换和格式化

```typescript
import {
  fromNativeError,
  formatError,
  isClaudeError
} from '../types/errors.js';

try {
  // 一些操作
} catch (error) {
  // 转换为 ClaudeError
  const claudeError = fromNativeError(
    error as Error,
    ErrorCode.TOOL_EXECUTION_FAILED,
    {
      context: { toolName: 'my_tool' }
    }
  );

  // 格式化错误
  console.log(formatError(claudeError, true)); // verbose 模式
}
```

## 最佳实践

### 1. 为网络操作启用重试

```typescript
class NetworkTool extends BaseTool {
  constructor() {
    super({
      maxRetries: 3,
      retryableErrors: [
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCode.NETWORK_TIMEOUT,
        ErrorCode.NETWORK_RATE_LIMITED,
      ],
    });
  }
}
```

### 2. 为长时间操作使用动态超时

```typescript
class LongRunningTool extends BaseTool {
  constructor() {
    super({
      baseTimeout: 60000,        // 1分钟基础超时
      enableDynamicTimeout: true, // 根据历史调整
    });
  }
}
```

### 3. 不要为快速操作启用重试

```typescript
class SimpleTool extends BaseTool {
  constructor() {
    super(); // 使用默认配置,不重试
  }
}
```

### 4. 使用重试回调记录日志

```typescript
const result = await withRetry(
  async () => performOperation(),
  {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      logger.warn(`Retry ${attempt}/3 after error: ${error.message}`);
      metrics.incrementRetryCount();
    },
  }
);
```

## 错误类型层次结构

```
Error (原生)
  └── BaseClaudeError
        ├── ToolExecutionError
        ├── ToolTimeoutError
        ├── PermissionDeniedError
        ├── ConfigurationError
        ├── NetworkError
        ├── AuthenticationError
        ├── ValidationError
        ├── SessionError
        ├── SandboxError
        ├── PluginError
        └── SystemError
```

## 重试延迟计算

重试延迟使用指数退避算法:

```
delay = initialDelay * (backoffFactor ^ (attempt - 1))
```

例如,使用默认配置 (initialDelay=1000, backoffFactor=2):
- 第1次重试: 1秒
- 第2次重试: 2秒
- 第3次重试: 4秒
- 第4次重试: 8秒

添加抖动后 (±25%):
- 第1次重试: 750-1250ms
- 第2次重试: 1500-2500ms
- 第3次重试: 3000-5000ms

## 常见问题

### Q: 如何禁用某个工具的重试?

A: 在构造函数中设置 `maxRetries: 0`:

```typescript
constructor() {
  super({ maxRetries: 0 });
}
```

### Q: 如何自定义重试判断逻辑?

A: 重写 `isRetryable` 方法:

```typescript
protected isRetryable(error: unknown): boolean {
  // 自定义逻辑
  if (error instanceof MyCustomError) {
    return error.shouldRetry;
  }
  return super.isRetryable(error);
}
```

### Q: 超时后是否会重试?

A: 是的,如果超时错误在可重试错误列表中,会触发重试。

### Q: 如何调整重试延迟策略?

A: 重写 `getRetryDelay` 方法:

```typescript
protected getRetryDelay(attempt: number): number {
  // 线性退避而不是指数退避
  return 1000 * attempt;
}
```

## 参考实现

完整的示例代码请参考:
- `src/examples/retry-usage.ts` - 重试机制使用示例
- `src/utils/retry.ts` - 重试工具函数实现
- `src/types/errors.ts` - 错误类型定义
- `src/tools/base.ts` - 工具基类实现
- `src/tools/mcp.ts` - MCP 工具重试示例
