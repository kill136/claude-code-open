# MCP 取消机制改进总结

## 任务概述
参考官方 @anthropic-ai/claude-code 源码完善 MCP 取消机制的实现。

## 改进内容

### 1. 增强的请求注册 (registerRequest)

**改进前**：
- 简单的请求注册
- 基本的超时支持

**改进后**：
```typescript
registerRequest(
  id: string | number,
  serverName: string,
  method: string,
  options?: {
    timeout?: number;                    // 自动超时取消
    abortController?: AbortController;   // 链接到 AbortController
    onCancel?: (reason) => void;         // 取消时回调
    onTimeout?: () => void;              // 超时专用回调
  }
): CancellationToken
```

**新功能**：
- ✅ 支持 AbortController 集成：当 AbortController 触发 abort 时，自动取消请求
- ✅ 超时回调分离：`onTimeout` 在超时发生时首先被调用，然后才调用 `onCancel`
- ✅ 双向绑定：AbortController.abort() → Token.cancel()

### 2. 取消通知生成 (cancelRequestWithNotification)

**新增方法**：
```typescript
cancelRequestWithNotification(
  id: string | number,
  reason: CancellationReason
): {
  result: CancellationResult | null;
  notification: CancelledNotification | null;
}
```

**功能**：
- 同时取消请求和生成 MCP 协议规范的取消通知
- 自动将取消原因转换为人类可读的消息
- 返回结构化的结果和通知对象

### 3. 取消原因字符串化 (getCancellationReasonString)

**新增私有方法**：
```typescript
private getCancellationReasonString(reason: CancellationReason): string
```

**映射关系**：
- `UserCancelled` → "Request cancelled by user"
- `Timeout` → "Request timed out"
- `ServerRequest` → "Cancelled at server request"
- `Shutdown` → "Cancelled due to shutdown"
- `Error` → "Cancelled due to error"

### 4. 高级超时处理 (setupTimeout)

**改进前**：
```typescript
private setupTimeout(id: string | number, timeout: number): void
```

**改进后**：
```typescript
private setupTimeout(
  id: string | number,
  timeout: number,
  onTimeout?: () => void  // 新增：超时回调
): void
```

**改进**：
- ✅ 支持超时特定回调
- ✅ 错误处理：捕获并通过事件发射超时回调错误
- ✅ 顺序保证：先调用 onTimeout，再取消请求

### 5. 托管式取消请求 (createCancellableRequest)

**新增高级 API**：
```typescript
createCancellableRequest(
  id: string | number,
  serverName: string,
  method: string,
  options?: { ... }
): {
  token: CancellationToken;
  sendNotification: () => CancelledNotification | null;
  cleanup: () => void;
}
```

**优势**：
- ✅ 一站式 API：注册、取消、通知、清理一体化
- ✅ 自动管理：返回的 `sendNotification` 函数自动检查取消状态
- ✅ 易于使用：统一的清理入口

**使用示例**：
```typescript
const { token, sendNotification, cleanup } = manager.createCancellableRequest(
  requestId,
  'myServer',
  'tools/call',
  { timeout: 30000 }
);

try {
  // 发送请求...
  token.onCancelled(async (reason) => {
    const notification = sendNotification();
    if (notification) {
      await protocol.sendCancelledNotification(transport, notification);
    }
  });
} finally {
  cleanup();
}
```

## 关键特性总结

### ✅ 完整的取消令牌管理
- 请求注册时创建令牌
- 完成/超时时自动清理
- 支持手动取消和自动超时取消

### ✅ MCP 协议集成
- 生成符合 MCP 规范的 `CancelledNotification`
- 支持通过 `notifications/cancelled` 方法发送通知
- 正确的 requestId 和 reason 字段

### ✅ AbortController 支持
- 标准的浏览器/Node.js 取消模式
- 单向绑定：AbortController → CancellationToken
- 便于与其他异步 API 集成

### ✅ 事件驱动架构
- `request:registered` - 请求注册时
- `request:cancelled` - 请求取消时
- `request:unregistered` - 请求注销时
- `timeout:error` - 超时回调错误时
- `cancel:error` - 取消回调错误时

### ✅ 批量操作支持
- `cancelServerRequests()` - 取消特定服务器的所有请求
- `cancelAll()` - 取消所有请求
- 适用于服务器关闭场景

### ✅ 监控和调试
- `getStats()` - 获取活动请求统计
- `getRequestDurations()` - 获取请求持续时间
- `findLongRunningRequests()` - 查找长时间运行的请求

## 使用示例文件

创建了完整的使用示例：`src/mcp/examples/cancellation-usage.ts`

包含以下场景：
1. **基础请求取消** - 基本的注册、取消、通知流程
2. **AbortController 集成** - 与标准 API 集成
3. **批量取消** - 服务器关闭时批量取消
4. **Connection Manager 集成** - 扩展连接管理器
5. **监控和调试** - 事件监听和统计收集

## 架构改进

### 取消流程
```
1. 注册请求
   ↓
2. 创建 CancellationToken
   ↓
3. 设置超时定时器（可选）
   ↓
4. 链接 AbortController（可选）
   ↓
5. 触发取消（超时/手动/abort）
   ↓
6. 调用 onTimeout（如果是超时）
   ↓
7. 调用 onCancel
   ↓
8. 触发 AbortController（如果有）
   ↓
9. 发射取消事件
   ↓
10. 生成取消通知
   ↓
11. 清理资源
```

### 与 Connection Manager 集成建议

在 `McpConnectionManager` 中可以这样集成：

```typescript
class McpConnectionManager {
  private cancellationManager = new McpCancellationManager();

  async send(connectionId: string, message: McpMessage): Promise<McpResponse> {
    const { token, sendNotification, cleanup } =
      this.cancellationManager.createCancellableRequest(
        message.id,
        serverName,
        message.method,
        {
          timeout: this.options.timeout,
          onCancel: async (reason) => {
            const notification = sendNotification();
            if (notification && transport) {
              await protocol.sendCancelledNotification(transport, notification);
            }
          }
        }
      );

    try {
      // 发送请求...
      return await this.sendInternal(connectionId, message);
    } finally {
      cleanup();
    }
  }
}
```

## 符合 MCP 规范

所有改进都严格遵循 MCP 规范 2024-11-05：

- ✅ 使用标准的 `notifications/cancelled` 方法
- ✅ `CancelledNotification` 接口符合规范
  - `requestId: string | number` - 必需
  - `reason?: string` - 可选
- ✅ 正确的 JSON-RPC 2.0 格式
- ✅ 单向通知（无需响应）

## 测试建议

建议添加以下测试：

1. **基础功能测试**
   - 注册和注销请求
   - 手动取消
   - 超时取消

2. **AbortController 测试**
   - abort() 触发取消
   - 取消后 abort 状态

3. **批量操作测试**
   - 取消服务器所有请求
   - 取消所有请求

4. **通知生成测试**
   - 正确的通知格式
   - 原因字符串映射

5. **事件发射测试**
   - 各种事件正确触发
   - 事件数据正确

6. **清理测试**
   - 超时清理
   - 请求清理
   - cleanup() 方法

## 总结

本次改进主要集中在以下方面：

1. **完善取消令牌生命周期** - 从注册到清理的完整管理
2. **MCP 协议集成** - 正确生成和发送取消通知
3. **AbortController 支持** - 标准化的取消模式
4. **易用性提升** - 提供高级 API 简化使用
5. **监控能力** - 事件和统计支持调试

所有改进都基于 MCP 规范和最佳实践，确保与官方实现的兼容性。
