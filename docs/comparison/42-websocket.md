# WebSocket 服务功能对比分析

## 概述

本文档对比分析 WebSocket 服务相关功能点（T484-T491）在本项目与官方实现中的差异。

## 功能点对比

### T484: WebSocket 服务器

#### 官方实现
- **文件位置**: `cli.js` 行 4870-4873 (LR0 类)
- **实现方式**: 实现了完整的 WebSocket 客户端传输类
```javascript
class LR0 {
  ws = null;
  lastSentId = null;
  url;
  state = "idle";
  onData;
  onCloseCallback;
  headers;
  sessionId;
  reconnectAttempts = 0;
  reconnectTimer = null;
  pingInterval = null;
  messageBuffer;

  constructor(A, Q={}, B) {
    this.url = A;
    this.headers = Q;
    this.sessionId = B;
    this.messageBuffer = new VNA(WK7);  // 循环缓冲区，大小 1000
  }

  connect() {
    // WebSocket 连接实现
    this.ws = new Xv(this.url.href, {
      headers: A,
      agent: HqA(this.url.href)
    });
    // 设置事件处理
  }

  // 其他方法...
}
```
- **特性**:
  - 状态管理: idle, reconnecting, connected, closing, closed
  - 使用 `ws` 包 (Xv)
  - 集成代理支持
  - 完整的生命周期管理

#### 本项目实现
- **文件位置**: `/src/mcp/connection.ts`
- **实现状态**: ❌ **未实现**
- **类型定义**:
```typescript
export interface McpServerInfo {
  name: string;
  type: 'stdio' | 'sse' | 'http' | 'websocket';  // 定义了 WebSocket 类型
  url?: string;
  headers?: Record<string, string>;
  // ...
}
```
- **问题**:
  - 只有类型定义，没有实现 `WebSocketConnection` 类
  - `switch` 语句中只实现了 stdio、sse、http 三种类型

#### Chrome 集成中的 WebSocket
- **文件位置**: `/src/chrome/index.ts`
- **用途**: 用于 Chrome DevTools Protocol 通信
```typescript
import WebSocket from 'ws';

export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;

  async connect(): Promise<boolean> {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.on('open', () => { /* ... */ });
    this.ws.on('message', (data) => { /* ... */ });
    // ...
  }
}
```
- **说明**: 这是独立的 CDP 实现，与 MCP WebSocket 传输无关

---

### T485: cli_websocket_connect

#### 官方实现
- **文件位置**: `cli.js` 行 4870
- **实现方式**:
```javascript
connect() {
  if (this.state !== "idle" && this.state !== "reconnecting") {
    k(`WebSocketTransport: Cannot connect, current state is ${this.state}`, {level: "error"});
    V3("error", "cli_websocket_connect_failed");
    return;
  }

  this.state = "reconnecting";
  k(`WebSocketTransport: Opening ${this.url.href}`);
  V3("info", "cli_websocket_connect_opening");

  // 添加 X-Last-Request-Id header
  let A = {...this.headers};
  if (this.lastSentId) {
    A["X-Last-Request-Id"] = this.lastSentId;
    k(`WebSocketTransport: Adding X-Last-Request-Id header: ${this.lastSentId}`);
  }

  this.ws = new Xv(this.url.href, {
    headers: A,
    agent: HqA(this.url.href)
  });

  this.ws.on("open", () => {
    k("WebSocketTransport: Connected");
    V3("info", "cli_websocket_connect_connected");

    // 检查服务器返回的 X-Last-Request-Id
    let Q = this.ws.upgradeReq;
    if (Q?.headers?.["x-last-request-id"]) {
      let B = Q.headers["x-last-request-id"];
      this.replayBufferedMessages(B);
    }

    this.reconnectAttempts = 0;
    this.state = "connected";
    this.startPingInterval();
    // 注册 keep_alive 发送器
  });

  // 错误和关闭处理
  this.ws.on("error", (Q) => {
    k(`WebSocketTransport: Error: ${Q.message}`, {level: "error"});
    V3("error", "cli_websocket_connect_error");
    this.handleConnectionError();
  });

  this.ws.on("close", (Q, B) => {
    k(`WebSocketTransport: Closed: ${Q}`, {level: "error"});
    V3("error", "cli_websocket_connect_closed");
    this.handleConnectionError();
  });
}
```
- **特性**:
  - 状态检查和转换
  - Headers 管理（包括 Authorization 和 X-Last-Request-Id）
  - 事件日志（使用 k 函数）
  - 遥测事件（使用 V3 函数）
  - 自动消息重放
  - 错误处理和重连

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**: 无法建立 WebSocket MCP 连接

---

### T486: 消息重放 messages_to_replay

#### 官方实现
- **文件位置**: `cli.js` 行 4872
- **实现方式**:
```javascript
replayBufferedMessages(A) {
  let Q = this.messageBuffer.toArray();
  if (Q.length === 0) return;

  let B = 0;
  if (A) {
    // 找到上次发送的消息位置
    let Z = Q.findIndex((Y) => ("uuid" in Y) && Y.uuid === A);
    if (Z >= 0) B = Z + 1;
  }

  // 获取需要重放的消息
  let G = Q.slice(B);
  if (G.length === 0) {
    k("WebSocketTransport: No new messages to replay");
    V3("info", "cli_websocket_no_messages_to_replay");
    return;
  }

  k(`WebSocketTransport: Replaying ${G.length} buffered messages`);
  V3("info", "cli_websocket_messages_to_replay", {count: G.length});

  for (let Z of G) {
    let Y = JSON.stringify(Z) + `\n`;
    if (!this.sendLine(Y)) {
      this.handleConnectionError();
      break;
    }
  }
}
```
- **消息缓冲实现**:
```javascript
// 在 write 方法中
write(A) {
  if ("uuid" in A && typeof A.uuid === "string") {
    this.messageBuffer.add(A);  // 添加到循环缓冲区
    this.lastSentId = A.uuid;   // 记录最后发送的 ID
  }

  let Q = JSON.stringify(A) + `\n`;
  if (this.state !== "connected") return;

  this.sendLine(Q);
}
```
- **VNA 循环缓冲区**:
  - 大小: `WK7 = 1000`
  - 类型: 固定大小的循环缓冲区
  - 方法: `add()`, `toArray()`

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 连接断开重连后消息丢失
  - 无法实现可靠的消息传输
  - 不支持会话恢复

---

### T487: Keepalive 机制

#### 官方实现
- **文件位置**: `cli.js` 行 4871, 4873
- **实现方式**:
```javascript
// 启动 ping 间隔
startPingInterval() {
  this.stopPingInterval();

  this.pingInterval = setInterval(() => {
    if (this.state === "connected" && this.ws) {
      try {
        this.ws.ping();  // WebSocket 层面的 ping
      } catch (A) {
        k(`WebSocketTransport: Ping failed: ${A}`, {level: "error"});
        V3("error", "cli_websocket_ping_failed");
      }
    }
  }, HK7);  // HK7 = 10000 (10秒)
}

stopPingInterval() {
  if (this.pingInterval) {
    clearInterval(this.pingInterval);
    this.pingInterval = null;
  }
}

// 应用层 keep_alive
// 在连接成功后注册
uA2(() => {
  if (this.state === "connected" && this.ws) {
    try {
      this.ws.send(JSON.stringify({type: "keep_alive"}) + `\n`);
      k("WebSocketTransport: Sent keep_alive (activity signal)");
    } catch (B) {
      k(`WebSocketTransport: Keep-alive failed: ${B}`, {level: "error"});
      V3("error", "cli_websocket_keepalive_failed");
    }
  }
});
```
- **特性**:
  - 两层 keepalive:
    1. WebSocket 协议层 ping (10秒间隔)
    2. 应用层 keep_alive 消息
  - 失败检测和日志记录
  - 自动清理机制

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 无法检测僵尸连接
  - 可能被中间网络设备断开
  - 无法及时发现连接问题

---

### T488: 重连策略 reconnect_attempt

#### 官方实现
- **文件位置**: `cli.js` 行 4871
- **实现方式**:
```javascript
handleConnectionError() {
  k(`WebSocketTransport: Disconnected from ${this.url.href}`);
  V3("info", "cli_websocket_disconnected");

  this.doDisconnect();

  if (this.state === "closing" || this.state === "closed") return;

  // 重连逻辑
  if (this.reconnectAttempts < yD9) {  // yD9 = 3 (最大重连次数)
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.state = "reconnecting";
    this.reconnectAttempts++;

    // 指数退避: min(baseDelay * 2^(attempt-1), maxDelay)
    let A = Math.min(KK7 * Math.pow(2, this.reconnectAttempts - 1), VK7);
    // KK7 = 1000 (基础延迟 1秒)
    // VK7 = 30000 (最大延迟 30秒)

    k(`WebSocketTransport: Reconnecting in ${A}ms (attempt ${this.reconnectAttempts}/${yD9})`);
    V3("error", "cli_websocket_reconnect_attempt", {
      reconnectAttempts: this.reconnectAttempts
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, A);
  } else {
    // 重连失败
    k(`WebSocketTransport: Max reconnection attempts reached for ${this.url.href}`, {level: "error"});
    V3("error", "cli_websocket_reconnect_exhausted", {
      reconnectAttempts: this.reconnectAttempts
    });

    this.state = "closed";
    if (this.onCloseCallback) this.onCloseCallback();
  }
}
```
- **常量定义**:
```javascript
var WK7 = 1000;  // 消息缓冲区大小
var yD9 = 3;     // 最大重连次数
var KK7 = 1000;  // 基础延迟 (ms)
var VK7 = 30000; // 最大延迟 (ms)
var HK7 = 10000; // Ping 间隔 (ms)
```
- **重连策略**:
  - 指数退避: 1s, 2s, 4s (但不超过 30s)
  - 最多 3 次重连尝试
  - 失败后触发 onClose 回调

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 网络抖动导致连接完全失败
  - 无自动恢复能力
  - 用户体验差

---

### T489: send_error 处理

#### 官方实现
- **文件位置**: `cli.js` 行 4871
- **实现方式**:
```javascript
sendLine(A) {
  if (!this.ws || this.state !== "connected") {
    k("WebSocketTransport: Not connected");
    V3("info", "cli_websocket_send_not_connected");
    return false;
  }

  try {
    this.ws.send(A);
    return true;
  } catch (Q) {
    k(`WebSocketTransport: Failed to send: ${Q}`, {level: "error"});
    V3("error", "cli_websocket_send_error");

    this.ws = null;
    this.handleConnectionError();  // 触发重连
    return false;
  }
}
```
- **特性**:
  - 状态检查
  - 异常捕获
  - 返回布尔值指示成功/失败
  - 失败时自动触发重连
  - 日志记录和遥测

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 发送失败时可能崩溃
  - 错误未被正确处理
  - 无法进行错误追踪

---

### T490: WebSocket 认证

#### 官方实现
- **文件位置**: `cli.js` 行 4870, fD9 模块
- **实现方式**:
```javascript
// 1. 在 OR0 类 (WebSocket 流包装器) 中
constructor(A, Q, B) {
  // ...
  let Z = {};
  let Y = kBA();  // 获取 Bearer token
  if (Y) {
    Z.Authorization = `Bearer ${Y}`;
  }

  this.transport = kD9(this.url, Z, h0());  // h0() 获取 sessionId
  // ...
}

// 2. 在 LR0 类中
connect() {
  // ...
  let A = {...this.headers};

  // 添加 X-Last-Request-Id 用于消息重放
  if (this.lastSentId) {
    A["X-Last-Request-Id"] = this.lastSentId;
  }

  this.ws = new Xv(this.url.href, {
    headers: A,
    agent: HqA(this.url.href)  // 代理支持
  });
  // ...
}
```
- **认证机制**:
  1. **Authorization header**: Bearer token
  2. **X-Last-Request-Id header**: 用于会话恢复和消息重放
  3. **Session ID**: 通过 sessionId 参数传递
- **代理支持**: `HqA()` 函数处理代理配置

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 无法建立认证的 WebSocket 连接
  - 不支持需要认证的 MCP 服务器
  - 无会话恢复能力

---

### T491: 消息序列化

#### 官方实现
- **文件位置**: `cli.js` 行 4869-4873
- **实现方式**:
```javascript
// 1. 发送消息序列化
write(A) {
  if ("uuid" in A && typeof A.uuid === "string") {
    this.messageBuffer.add(A);
    this.lastSentId = A.uuid;
  }

  let Q = JSON.stringify(A) + `\n`;  // JSON + 换行符

  if (this.state !== "connected") return;

  let B = this.sessionId ? ` session=${this.sessionId}` : "";
  k(`WebSocketTransport: Sending message type=${A.type}${B}`);

  this.sendLine(Q);
}

// 2. 接收消息反序列化 (在 ffA 类中)
async processLine(A) {
  try {
    let Q = JSON.parse(A);  // 解析 JSON

    // 处理 keep_alive
    if (Q.type === "keep_alive") return;

    // 处理 control_response
    if (Q.type === "control_response") {
      let B = this.pendingRequests.get(Q.response.request_id);
      if (!B) {
        if (this.unexpectedResponseCallback) {
          await this.unexpectedResponseCallback(Q);
        }
        return;
      }

      this.pendingRequests.delete(Q.response.request_id);

      if (Q.response.subtype === "error") {
        B.reject(Error(Q.response.error));
        return;
      }

      let G = Q.response.response;
      if (B.schema) {
        try {
          B.resolve(B.schema.parse(G));  // Zod 验证
        } catch (Z) {
          B.reject(Z);
        }
      } else {
        B.resolve({});
      }

      if (this.replayUserMessages) return Q;
      return;
    }

    // 处理其他消息类型
    if (Q.type !== "user" && Q.type !== "control_request") {
      qR0(`Error: Expected message type 'user' or 'control', got '${Q.type}'`);
    }

    return Q;
  } catch (Q) {
    console.error(`Error parsing streaming input line: ${A}: ${Q}`);
    process.exit(1);
  }
}
```
- **序列化格式**:
  - **编码**: UTF-8
  - **格式**: JSON + `\n` (换行符分隔)
  - **消息类型**:
    - `keep_alive`: 心跳
    - `control_request`: 控制请求
    - `control_response`: 控制响应
    - `user`: 用户消息
- **特性**:
  - 基于行的协议（换行符分隔）
  - JSON 格式
  - 支持消息验证（Zod schema）
  - 错误处理和日志记录
  - UUID 追踪

#### 本项目实现
- **状态**: ❌ **未实现**
- **影响**:
  - 无法与官方 WebSocket 服务通信
  - 协议不兼容

---

## 总体差异总结

| 功能点 | 官方实现 | 本项目实现 | 差异程度 |
|--------|----------|------------|----------|
| T484: WebSocket 服务器 | ✅ 完整实现 (LR0 类) | ❌ 仅类型定义 | **严重** |
| T485: cli_websocket_connect | ✅ 完整实现 | ❌ 未实现 | **严重** |
| T486: 消息重放 | ✅ 循环缓冲区 + UUID 追踪 | ❌ 未实现 | **严重** |
| T487: Keepalive 机制 | ✅ 双层 keepalive | ❌ 未实现 | **严重** |
| T488: 重连策略 | ✅ 指数退避 (3次) | ❌ 未实现 | **严重** |
| T489: send_error 处理 | ✅ 完整错误处理 | ❌ 未实现 | **严重** |
| T490: WebSocket 认证 | ✅ Bearer + Headers | ❌ 未实现 | **严重** |
| T491: 消息序列化 | ✅ JSON + 换行符 | ❌ 未实现 | **严重** |

---

## 实现建议

### 1. 优先级：高 - 实现 WebSocket MCP 传输

创建 `/src/mcp/websocket-connection.ts`:

```typescript
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { McpTransport, McpMessage } from './connection';

interface WebSocketTransportOptions {
  headers?: Record<string, string>;
  sessionId?: string;
  bufferSize?: number;
}

export class WebSocketConnection extends EventEmitter implements McpTransport {
  private ws: WebSocket | null = null;
  private url: string;
  private headers: Record<string, string>;
  private sessionId?: string;
  private state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closing' | 'closed' = 'idle';
  private lastSentId: string | null = null;
  private messageBuffer: CircularBuffer<McpMessage>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private connected = false;

  // 常量
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly BASE_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private readonly PING_INTERVAL = 10000;

  constructor(url: string, options: WebSocketTransportOptions = {}) {
    super();
    this.url = url;
    this.headers = options.headers || {};
    this.sessionId = options.sessionId;
    this.messageBuffer = new CircularBuffer<McpMessage>(options.bufferSize || 1000);
  }

  async connect(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'reconnecting') {
      throw new Error(`Cannot connect in state: ${this.state}`);
    }

    this.state = 'connecting';

    const headers = { ...this.headers };
    if (this.lastSentId) {
      headers['X-Last-Request-Id'] = this.lastSentId;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, { headers });

        this.ws.on('open', () => {
          this.state = 'connected';
          this.connected = true;
          this.reconnectAttempts = 0;

          // 检查服务器返回的 X-Last-Request-Id
          const upgradeReq = (this.ws as any).upgradeReq;
          const lastRequestId = upgradeReq?.headers?.['x-last-request-id'];
          if (lastRequestId) {
            this.replayBufferedMessages(lastRequestId);
          }

          this.startPingInterval();
          this.emit('connect');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (err: Error) => {
          this.emit('error', err);
          if (this.state === 'connecting') {
            reject(err);
          }
          this.handleConnectionError();
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.emit('disconnect');
          this.handleConnectionError();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(data: string): void {
    const lines = data.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message: McpMessage = JSON.parse(line);

        // 忽略 keep_alive
        if ((message as any).type === 'keep_alive') continue;

        this.emit('message', message);
      } catch (err) {
        this.emit('parse-error', err, line);
      }
    }
  }

  async send(message: McpMessage): Promise<void> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Connection not established');
    }

    // 缓冲消息
    if ('uuid' in message && typeof message.uuid === 'string') {
      this.messageBuffer.add(message);
      this.lastSentId = message.uuid;
    }

    return new Promise((resolve, reject) => {
      try {
        const data = JSON.stringify(message) + '\n';
        this.ws!.send(data, (err) => {
          if (err) {
            this.handleConnectionError();
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private replayBufferedMessages(lastRequestId: string): void {
    const messages = this.messageBuffer.toArray();
    if (messages.length === 0) return;

    let startIndex = 0;
    const lastIndex = messages.findIndex(
      (msg) => 'uuid' in msg && msg.uuid === lastRequestId
    );
    if (lastIndex >= 0) {
      startIndex = lastIndex + 1;
    }

    const toReplay = messages.slice(startIndex);
    if (toReplay.length === 0) return;

    console.log(`Replaying ${toReplay.length} buffered messages`);

    for (const message of toReplay) {
      this.send(message).catch((err) => {
        console.error('Failed to replay message:', err);
        this.handleConnectionError();
      });
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.state === 'connected' && this.ws) {
        try {
          // WebSocket 层 ping
          this.ws.ping();

          // 应用层 keep_alive
          this.send({ type: 'keep_alive' } as any).catch((err) => {
            console.error('Keep-alive failed:', err);
          });
        } catch (err) {
          console.error('Ping failed:', err);
        }
      }
    }, this.PING_INTERVAL);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleConnectionError(): void {
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.state === 'closing' || this.state === 'closed') {
      return;
    }

    // 重连逻辑
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      this.state = 'reconnecting';
      this.reconnectAttempts++;

      const delay = Math.min(
        this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
        this.MAX_RECONNECT_DELAY
      );

      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`
      );

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch((err) => {
          console.error('Reconnect failed:', err);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.state = 'closed';
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();
    this.state = 'closing';

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected && this.state === 'connected';
  }

  async sendNotification(method: string, params: unknown): Promise<void> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    await this.send(message);
  }
}

// 循环缓冲区实现
class CircularBuffer<T> {
  private buffer: T[] = [];
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  add(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  toArray(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}
```

### 2. 在 connection.ts 中集成

```typescript
import { WebSocketConnection } from './websocket-connection';

async connect(server: McpServerInfo): Promise<McpConnection> {
  // ...
  let transport: McpTransport;

  switch (server.type) {
    case 'stdio':
      // ...
      break;
    case 'sse':
      // ...
      break;
    case 'http':
      // ...
      break;
    case 'websocket':
      if (!server.url) throw new Error('URL required for WebSocket connection');
      transport = new WebSocketConnection(server.url, {
        headers: server.headers,
        sessionId: connectionId,
      });
      break;
    default:
      throw new Error(`Unsupported connection type: ${server.type}`);
  }
  // ...
}
```

### 3. 添加认证支持

在 WebSocketConnection 构造函数中：

```typescript
constructor(url: string, options: WebSocketTransportOptions = {}) {
  super();
  this.url = url;

  // 默认 headers
  this.headers = { ...options.headers };

  // 添加认证
  const token = getAuthToken(); // 从环境或配置获取
  if (token) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  this.sessionId = options.sessionId;
  this.messageBuffer = new CircularBuffer<McpMessage>(options.bufferSize || 1000);
}
```

---

## 兼容性影响

### 功能影响
1. **无法使用 WebSocket MCP 服务器**: 本项目完全不支持 WebSocket 传输
2. **无会话恢复**: 连接断开后消息丢失
3. **无自动重连**: 网络问题导致永久失败
4. **无 keepalive**: 可能被中间设备断开

### 用户体验影响
- ⚠️ **关键**: 不支持远程 MCP 服务器（WebSocket 是远程连接的标准方式）
- ⚠️ **重要**: 网络不稳定环境下体验差
- ⚠️ **一般**: 无法与官方 WebSocket 服务集成

---

## 测试建议

### 单元测试
```typescript
describe('WebSocketConnection', () => {
  it('should connect successfully', async () => {
    const conn = new WebSocketConnection('ws://localhost:8080');
    await conn.connect();
    expect(conn.isConnected()).toBe(true);
  });

  it('should replay messages after reconnect', async () => {
    // 测试消息重放
  });

  it('should retry with exponential backoff', async () => {
    // 测试重连策略
  });

  it('should send keepalive messages', async () => {
    // 测试 keepalive
  });
});
```

### 集成测试
1. 测试与真实 WebSocket MCP 服务器的连接
2. 测试网络中断和恢复
3. 测试消息重放机制
4. 测试认证流程

---

## 相关文档
- MCP WebSocket 传输规范: https://modelcontextprotocol.io/docs/concepts/transports#websocket
- WebSocket RFC 6455: https://tools.ietf.org/html/rfc6455
- 本项目 MCP 连接实现: `/src/mcp/connection.ts`
- 官方实现: `cli.js` 行 4870-4873

---

**生成时间**: 2025-12-25
**对比版本**: 官方 v2.0.76 vs 本项目当前版本
**分析者**: Claude Code 对比分析工具
