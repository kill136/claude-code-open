# MCP 错误处理模块

完整的 MCP (Model Context Protocol) 错误处理系统，提供错误分类、转换、恢复和报告功能。

## 功能特性

### 1. 错误分类
- **JSON-RPC 标准错误** - 完整支持 JSON-RPC 2.0 错误代码
- **MCP 自定义错误** - 连接、超时、资源等特定错误
- **错误严重级别** - LOW, MEDIUM, HIGH, CRITICAL 四个级别
- **错误类型层次** - McpError 基类及特定子类

### 2. 错误转换
- **JSON-RPC 错误转换** - 双向转换 MCP 错误和 JSON-RPC 格式
- **原生错误包装** - 自动包装 JavaScript 原生错误
- **错误堆栈保留** - 完整保留错误调用堆栈和原因链

### 3. 错误恢复
- **可恢复性检测** - 自动判断错误是否可恢复
- **智能重试策略** - 支持指数退避和抖动
- **连接重建** - 自动处理连接失败场景

### 4. 错误报告
- **错误统计** - 按代码、严重级别、服务器聚合
- **错误回调** - 支持自定义错误处理逻辑
- **格式化输出** - 人类可读的错误信息

## 错误代码

### JSON-RPC 标准错误 (-32xxx)
- `-32700` PARSE_ERROR - JSON 解析错误
- `-32600` INVALID_REQUEST - 无效的请求格式
- `-32601` METHOD_NOT_FOUND - 方法不存在
- `-32602` INVALID_PARAMS - 参数无效
- `-32603` INTERNAL_ERROR - 内部错误
- `-32000` SERVER_ERROR - 服务器错误

### MCP 自定义错误
- `-1001` CONNECTION_FAILED - 连接失败
- `-1002` CONNECTION_TIMEOUT - 连接超时
- `-1003` CONNECTION_CLOSED - 连接关闭
- `-1004` SERVER_NOT_FOUND - 服务器未找到
- `-1005` TOOL_NOT_FOUND - 工具未找到
- `-1006` RESOURCE_NOT_FOUND - 资源未找到
- `-1007` PERMISSION_DENIED - 权限拒绝
- `-1008` RATE_LIMITED - 请求限流
- `-1009` INITIALIZATION_FAILED - 初始化失败
- `-1010` NOT_INITIALIZED - 未初始化
- `-1011` CAPABILITY_NOT_SUPPORTED - 能力不支持
- `-1012` PROTOCOL_VERSION_MISMATCH - 协议版本不匹配

## 使用示例

### 基本错误创建

```typescript
import { McpError, McpErrorCode } from './mcp/errors.js';

// 创建基本错误
const error = new McpError(
  McpErrorCode.CONNECTION_FAILED,
  'Failed to connect to server',
  {
    serverName: 'my-server',
    data: { host: 'localhost', port: 8080 },
  }
);
```

### 使用特定错误类型

```typescript
import {
  McpConnectionError,
  McpTimeoutError,
  McpProtocolError,
  McpServerError,
} from './mcp/errors.js';

// 连接错误
const connError = new McpConnectionError('Connection refused', {
  serverName: 'my-server',
});

// 超时错误
const timeoutError = new McpTimeoutError('Request timeout', 5000, {
  serverName: 'my-server',
});

// 协议错误
const protocolError = new McpProtocolError('Invalid JSON format');

// 服务器错误
const serverError = new McpServerError('Internal server error');
```

### 错误转换

```typescript
import { McpError } from './mcp/errors.js';

// 从 JSON-RPC 错误创建
const jsonRpcError = {
  code: -32601,
  message: 'Method not found',
  data: { method: 'unknown' },
};
const mcpError = McpError.fromJsonRpc(jsonRpcError, 'server-name');

// 从原生错误创建
try {
  throw new Error('Something went wrong');
} catch (err) {
  const mcpError = McpError.fromNative(err as Error);
}

// 转换为 JSON-RPC 格式
const jsonRpc = mcpError.toJsonRpc();
```

### 错误处理器

```typescript
import { createErrorHandler, McpError, McpErrorCode } from './mcp/errors.js';

// 创建错误处理器
const handler = createErrorHandler({
  maxRetries: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
  jitter: true,
  onError: (error) => {
    console.error('Error occurred:', error.message);
  },
});

// 处理错误
const error = new McpError(McpErrorCode.CONNECTION_TIMEOUT, 'Timeout');
const action = handler.handle(error);

// 检查是否应该重试
if (handler.shouldRetry(error, 0)) {
  const delay = handler.getRetryDelay(error, 0);
  console.log(`Retrying after ${delay}ms...`);
}

// 获取错误统计
const stats = handler.getErrorStats();
console.log('Total errors:', stats.total);
console.log('Recoverable:', stats.recoverable);
```

### 自动重试包装

```typescript
import { withErrorHandling, createErrorHandler } from './mcp/errors.js';

const handler = createErrorHandler({ maxRetries: 3 });

const riskyOperation = async () => {
  // 可能失败的操作
  return await fetch('https://api.example.com/data');
};

// 包装函数，自动处理错误和重试
const wrappedOperation = withErrorHandling(
  riskyOperation,
  handler,
  'my-server'
);

try {
  const result = await wrappedOperation();
  console.log('Success:', result);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

### 错误格式化

```typescript
import { formatMcpError, McpError, McpErrorCode } from './mcp/errors.js';

const error = new McpError(
  McpErrorCode.CONNECTION_FAILED,
  'Failed to connect',
  { serverName: 'my-server' }
);

// 简单格式化
console.log(formatMcpError(error));

// 详细格式化（包含堆栈等）
console.log(formatMcpError(error, true));
```

## API 参考

### 类

- `McpError` - 基础错误类
- `McpConnectionError` - 连接错误
- `McpTimeoutError` - 超时错误
- `McpProtocolError` - 协议错误
- `McpServerError` - 服务器错误
- `McpErrorHandler` - 错误处理器

### 枚举

- `McpErrorCode` - 错误代码
- `McpErrorSeverity` - 严重级别
- `ErrorAction` - 错误处理动作

### 函数

- `createErrorHandler()` - 创建错误处理器
- `formatMcpError()` - 格式化错误
- `isRecoverableError()` - 判断是否可恢复
- `isRetryableError()` - 判断是否可重试
- `withErrorHandling()` - 错误处理包装器

### 接口

- `JsonRpcError` - JSON-RPC 错误格式
- `McpErrorOptions` - 错误选项
- `ErrorHandlerOptions` - 错误处理器选项
- `ErrorStats` - 错误统计

## 重试策略

错误处理器支持智能重试策略：

1. **指数退避** - 重试延迟以指数增长
2. **最大延迟限制** - 防止延迟过长
3. **抖动** - 添加随机化避免雷鸣群效应
4. **限流特殊处理** - 尊重 retry-after 头
5. **重试次数限制** - 防止无限重试

## 错误严重级别

- **LOW** - 不影响主要功能的错误
- **MEDIUM** - 部分功能受影响
- **HIGH** - 主要功能受影响
- **CRITICAL** - 系统无法运行

## 最佳实践

1. **使用特定错误类型** - 优先使用 McpConnectionError 等特定类型
2. **保留错误上下文** - 传递 serverName 和相关数据
3. **合理设置重试** - 根据错误类型调整重试策略
4. **记录错误统计** - 使用错误处理器收集统计信息
5. **优雅降级** - 对于不可恢复的错误，提供替代方案

## 运行示例

```bash
# 编译并运行示例
npx tsx src/mcp/errors.example.ts
```

## 类型安全

所有错误处理功能都是完全类型安全的，支持 TypeScript 的类型推断和检查。
