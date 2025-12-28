# Teleport - 远程会话连接

## 概述

Teleport 功能允许你连接到运行在远程机器上的 Claude Code 会话，实现：

- **远程协作**：多个开发者可以连接到同一个会话
- **跨设备工作**：在不同设备间无缝切换
- **会话共享**：分享你的会话给团队成员
- **断线续传**：自动重连和消息同步

## 架构

```
┌─────────────┐          WebSocket          ┌──────────────┐
│  本地 CLI   │ ←─────────────────────────→ │ 远程会话服务器 │
└─────────────┘                             └──────────────┘
      │                                            │
      ├─ 仓库验证                                  ├─ 会话管理
      ├─ 消息同步                                  ├─ 消息广播
      └─ 断线重连                                  └─ 状态同步
```

## 使用方法

### 1. 基本用法

```bash
# 连接到远程会话
export CLAUDE_TELEPORT_URL="wss://your-server.com/teleport"
export CLAUDE_TELEPORT_TOKEN="your-auth-token"

claude --teleport <session-id>
```

### 2. 环境变量

- `CLAUDE_TELEPORT_URL`: 远程服务器 WebSocket URL
- `CLAUDE_TELEPORT_TOKEN`: 认证令牌（可选）

### 3. 编程方式

```typescript
import { connectToRemoteSession } from './teleport/index.js';

// 连接到远程会话
const session = await connectToRemoteSession(
  'session-uuid',
  'wss://your-server.com/teleport',
  'your-auth-token'
);

// 监听消息
session.on('message', (msg) => {
  console.log('收到消息:', msg);
});

// 监听连接状态
session.on('connected', () => {
  console.log('已连接');
});

session.on('disconnected', () => {
  console.log('连接断开');
});

// 发送消息
await session.sendMessage({
  type: 'message',
  sessionId: 'session-uuid',
  timestamp: new Date().toISOString(),
  payload: { content: 'Hello' },
});

// 断开连接
await session.disconnect();
```

## 功能特性

### 1. 仓库验证

Teleport 会自动验证当前仓库是否与远程会话的仓库匹配：

```typescript
import { validateSessionRepository } from './teleport/index.js';

const result = await validateSessionRepository('git@github.com:user/repo.git');

if (result.status === 'mismatch') {
  console.error(`仓库不匹配: 会话仓库是 ${result.sessionRepo}, 当前仓库是 ${result.currentRepo}`);
}
```

### 2. 自动重连

连接断开时，会自动尝试重连（最多 3 次）：

- 第 1 次重连：延迟 1 秒
- 第 2 次重连：延迟 2 秒
- 第 3 次重连：延迟 4 秒

### 3. 消息同步

连接建立后会自动同步历史消息：

```typescript
session.on('sync_complete', (data) => {
  console.log(`同步完成: ${data.totalMessages} 条消息`);
});
```

### 4. 心跳保活

自动发送心跳消息保持连接活跃（每 10 秒）。

## 消息格式

### 消息类型

```typescript
type RemoteMessageType =
  | 'sync_request'      // 同步请求
  | 'sync_response'     // 同步响应
  | 'message'           // 用户消息
  | 'assistant_message' // 助手消息
  | 'tool_result'       // 工具结果
  | 'heartbeat'         // 心跳
  | 'error';            // 错误
```

### 消息结构

```typescript
interface RemoteMessage {
  type: RemoteMessageType;
  id?: string;
  sessionId: string;
  payload: unknown;
  timestamp: string;
}
```

## 安全性

1. **认证**：使用 Bearer Token 进行身份验证
2. **加密**：使用 WSS (WebSocket Secure) 加密传输
3. **仓库验证**：确保在正确的代码仓库中操作

## 错误处理

```typescript
session.on('error', (error) => {
  console.error('连接错误:', error.message);
});

session.on('remote_error', (error, code) => {
  console.error(`远程错误 (${code}):`, error.message);
});

session.on('sync_error', (error) => {
  console.error('同步错误:', error);
});
```

## 状态管理

获取当前连接状态：

```typescript
const state = session.getState();

console.log('连接状态:', state.connectionState);
console.log('同步状态:', state.syncState);
console.log('配置:', state.config);
```

连接状态：
- `disconnected` - 未连接
- `connecting` - 连接中
- `connected` - 已连接
- `syncing` - 同步中
- `error` - 错误

## 最佳实践

1. **使用环境变量**：将敏感信息存储在环境变量中
2. **错误处理**：始终监听错误事件
3. **优雅退出**：在程序退出时断开连接
4. **日志记录**：使用 `--verbose` 查看详细日志

## 故障排除

### 连接失败

```bash
# 检查 URL 是否正确
echo $CLAUDE_TELEPORT_URL

# 检查网络连接
ping your-server.com

# 使用 verbose 模式查看详细信息
claude --teleport <session-id> --verbose
```

### 仓库不匹配

```bash
# 检查当前仓库
git remote get-url origin

# 切换到正确的仓库
cd /path/to/correct/repo
```

### 认证失败

```bash
# 检查令牌
echo $CLAUDE_TELEPORT_TOKEN

# 使用正确的令牌
export CLAUDE_TELEPORT_TOKEN="your-valid-token"
```

## 未来改进

- [ ] 支持多个并发连接
- [ ] 文件变更实时同步
- [ ] 会话录制和回放
- [ ] 端到端加密
- [ ] 会话共享链接生成
- [ ] WebRTC 点对点连接

## 参考

- WebSocket MCP Transport: `src/mcp/websocket-connection.ts`
- Session Management: `src/core/session.ts`
- Network Utils: `src/network/`
