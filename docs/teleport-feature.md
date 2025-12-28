# Teleport 远程连接功能实现

## 概述

本次更新实现了 `--teleport` 远程连接功能，允许用户连接到运行在远程机器上的 Claude Code 会话。

## 实现的功能

### 1. 核心模块 (`src/teleport/`)

#### 类型定义 (`types.ts`)
- **TeleportConfig**: 远程会话配置
  - sessionId: 会话 ID
  - ingressUrl: 远程服务器 WebSocket URL
  - authToken: 认证令牌
  - metadata: 会话元数据（仓库、分支等）

- **RemoteMessage**: 远程会话消息
  - 支持多种消息类型：sync_request, sync_response, message, assistant_message, tool_result, heartbeat, error
  - 包含消息 ID、会话 ID、载荷和时间戳

- **RemoteSessionState**: 连接和同步状态
  - connectionState: 连接状态（disconnected, connecting, connected, syncing, error）
  - syncState: 同步状态（同步中、最后同步时间、同步的消息数量）

#### 仓库验证 (`validation.ts`)
- **getCurrentRepoUrl()**: 获取当前 Git 仓库 URL
- **normalizeRepoUrl()**: 规范化仓库 URL（处理 SSH/HTTPS 转换）
- **compareRepoUrls()**: 比较两个仓库 URL 是否相同
- **validateSessionRepository()**: 验证会话仓库是否匹配
- **getCurrentBranch()**: 获取当前分支
- **isWorkingDirectoryClean()**: 检查工作目录是否干净

#### 远程会话类 (`session.ts`)
- **RemoteSession 类**:
  - 基于 EventEmitter，支持事件驱动编程
  - 使用 WebSocketConnection 建立连接
  - 实现连接管理、消息发送、同步请求
  - 自动仓库验证
  - 完整的错误处理

核心方法：
- `connect()`: 连接到远程会话
- `disconnect()`: 断开连接
- `sendMessage()`: 发送消息到远程会话
- `requestSync()`: 请求同步会话数据
- `getState()`: 获取当前状态
- `isConnected()`: 检查连接状态

事件：
- `connecting`: 开始连接
- `connected`: 连接建立
- `disconnected`: 连接断开
- `message`: 收到消息
- `sync_start`: 开始同步
- `sync_complete`: 同步完成
- `sync_error`: 同步错误
- `error`: 一般错误
- `remote_error`: 远程错误

#### 主模块 (`index.ts`)
- **connectToRemoteSession()**: 便捷连接函数
  - 自动从环境变量读取配置
  - 支持 CLAUDE_TELEPORT_URL 和 CLAUDE_TELEPORT_TOKEN
- **canTeleportToSession()**: 检查会话是否可以 teleport
- 导出所有类型和函数

### 2. CLI 集成

更新了 `src/cli.ts` 中的 teleport 选项处理：

```typescript
// 旧实现（简单的本地会话加载）
const session = Session.load(options.teleport);

// 新实现（完整的远程连接）
const { connectToRemoteSession } = await import('./teleport/index.js');
const remoteSession = await connectToRemoteSession(
  options.teleport,
  ingressUrl,
  authToken
);
```

功能：
- 支持从环境变量读取配置
- 仓库验证
- 事件监听（message, disconnected, error）
- 优雅退出（SIGINT 处理）
- 详细的错误处理和日志输出

### 3. 底层基础设施

利用了现有的基础设施：
- **WebSocketConnection** (`src/mcp/websocket-connection.ts`)
  - 连接状态管理
  - 消息缓冲和重放
  - 断线重连（指数退避）
  - Keepalive 机制

- **Network 模块** (`src/network/`)
  - 代理支持
  - 超时控制
  - 重试策略

## 使用方法

### 命令行使用

```bash
# 设置环境变量
export CLAUDE_TELEPORT_URL="wss://your-server.com/teleport"
export CLAUDE_TELEPORT_TOKEN="your-auth-token"

# 连接到远程会话
claude --teleport <session-id>

# 带 verbose 输出
claude --teleport <session-id> --verbose
```

### 编程使用

```typescript
import { connectToRemoteSession } from './teleport/index.js';

const session = await connectToRemoteSession(
  'session-uuid',
  'wss://server.com/teleport',
  'auth-token'
);

session.on('message', (msg) => {
  console.log('收到消息:', msg);
});

await session.disconnect();
```

## 技术特性

### 1. 连接管理
- ✅ WebSocket 连接（ws/wss）
- ✅ 自动重连（最多 3 次，指数退避）
- ✅ 连接状态跟踪
- ✅ Keepalive 心跳

### 2. 消息传输
- ✅ JSON + 换行符协议
- ✅ 消息缓冲和重放
- ✅ UUID 追踪
- ✅ 多种消息类型支持

### 3. 同步机制
- ✅ 自动同步请求
- ✅ 同步状态跟踪
- ✅ 增量同步支持
- ✅ 同步错误处理

### 4. 安全性
- ✅ Bearer Token 认证
- ✅ WSS 加密传输
- ✅ 仓库验证
- ✅ 会话 ID 验证

### 5. 错误处理
- ✅ 完整的错误类型
- ✅ 详细的错误消息
- ✅ 优雅降级
- ✅ 错误恢复机制

## 文件列表

### 新增文件

1. **src/teleport/types.ts** - 类型定义
2. **src/teleport/validation.ts** - 仓库验证
3. **src/teleport/session.ts** - 远程会话类
4. **src/teleport/index.ts** - 主模块
5. **src/teleport/README.md** - 使用文档
6. **src/teleport/example.ts** - 使用示例
7. **docs/teleport-feature.md** - 功能文档（本文件）

### 修改文件

1. **src/cli.ts** - 更新 teleport 选项处理逻辑（第 204-269 行）

### 编译输出

```
dist/teleport/
├── index.d.ts
├── index.d.ts.map
├── index.js
├── index.js.map
├── session.d.ts
├── session.d.ts.map
├── session.js
├── session.js.map
├── types.d.ts
├── types.d.ts.map
├── types.js
├── types.js.map
├── validation.d.ts
├── validation.d.ts.map
├── validation.js
└── validation.js.map
```

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      CLI (cli.ts)                        │
│  - 解析 --teleport 参数                                  │
│  - 调用 connectToRemoteSession()                         │
│  - 设置事件监听器                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Teleport Module (teleport/)                 │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │  RemoteSession                              │         │
│  │  - connect()                                │         │
│  │  - disconnect()                             │         │
│  │  - sendMessage()                            │         │
│  │  - requestSync()                            │         │
│  └─────────────┬──────────────────────────────┘         │
│                │                                          │
│                ├─► validateSessionRepository()           │
│                │   (仓库验证)                             │
│                │                                          │
│                └─► WebSocketConnection                    │
│                    (MCP WebSocket 传输层)                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│         WebSocket Transport (mcp/websocket-connection)   │
│  - 连接管理                                               │
│  - 消息缓冲和重放                                         │
│  - 断线重连                                               │
│  - Keepalive                                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
           ┌──────────────┐
           │ 远程会话服务器 │
           └──────────────┘
```

## 与官方实现的对比

### 已实现的功能

- ✅ WebSocket 连接
- ✅ 仓库验证
- ✅ 消息传输
- ✅ 断线重连
- ✅ 认证支持
- ✅ 状态同步
- ✅ 错误处理

### 未实现的功能

- ⏳ 服务器端实现（需要单独的服务器组件）
- ⏳ 会话发现服务
- ⏳ 端到端加密
- ⏳ 文件变更实时同步
- ⏳ 多客户端广播

## 未来改进方向

1. **服务器实现**
   - 创建独立的 teleport 服务器
   - 支持会话管理和路由
   - 实现消息广播

2. **会话发现**
   - 自动发现可用的远程会话
   - 会话列表和搜索

3. **增强安全性**
   - 端到端加密
   - 访问控制列表
   - 审计日志

4. **文件同步**
   - 实时文件变更同步
   - 冲突检测和解决

5. **性能优化**
   - 消息压缩
   - 增量同步优化
   - 连接池管理

## 测试建议

### 单元测试

```typescript
// 测试仓库验证
import { normalizeRepoUrl, compareRepoUrls } from './teleport/validation.js';

test('normalize repo URLs', () => {
  expect(normalizeRepoUrl('git@github.com:user/repo.git'))
    .toBe('https://github.com/user/repo');
});

test('compare repo URLs', () => {
  expect(compareRepoUrls(
    'git@github.com:user/repo.git',
    'https://github.com/user/repo'
  )).toBe(true);
});
```

### 集成测试

```bash
# 启动测试服务器
node test-server.js

# 连接测试
export CLAUDE_TELEPORT_URL="ws://localhost:8080/teleport"
claude --teleport test-session-id --verbose
```

## 参考资料

- WebSocket 规范: [RFC 6455](https://tools.ietf.org/html/rfc6455)
- MCP Protocol: `src/mcp/protocol.ts`
- WebSocket Connection: `src/mcp/websocket-connection.ts`
- Network Utils: `src/network/`

## 贡献者

- 基于官方 Claude Code v2.0.76 的 teleport 实现
- 参考官方混淆代码中的连接管理逻辑
- 利用项目现有的 WebSocket 和网络基础设施

## 版本历史

- **v1.0.0** (2025-12-28)
  - 初始实现
  - 基本连接功能
  - 仓库验证
  - 消息传输
  - 同步机制
