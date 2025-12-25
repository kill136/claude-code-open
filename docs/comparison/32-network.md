# 网络与代理功能对比分析 (T368-T379)

## 概述

本文档对比分析本项目与官方 `@anthropic-ai/claude-code` 在网络与代理功能方面的实现差异。

**分析日期**: 2025-12-25
**官方版本**: v2.0.76
**对比范围**: T368-T379 (共 12 个功能点)

---

## T368: HTTP 代理支持

### 官方实现
**状态**: ✅ **已实现**

在 `cli.js` 中发现完整的 HTTP 代理实现：
- 使用 `http-proxy-agent` / `https-proxy-agent` 库
- 支持环境变量 `HTTP_PROXY` / `http_proxy`
- 代理连接头设置：`Proxy-Connection: Keep-Alive/close`
- Host 头设置：`Host: ${hostname}:${port}`
- 完整的代理请求构建

**代码特征**：
```javascript
// 从官方 cli.js 反编译分析
Z["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close"
Z.Host = `${Y}:${Q.port}`
```

### 本项目实现
**状态**: ⚠️ **部分实现**

**位置**: 无专门的代理支持模块

**现状**：
- `src/core/client.ts` - 使用 Anthropic SDK，未配置代理
- `src/tools/web.ts` - 使用 axios，支持系统代理（axios 默认行为）
- `src/mcp/connection.ts` - HTTP 连接未配置代理

**差距分析**：
1. ❌ 缺少显式的 HTTP 代理配置接口
2. ❌ 不支持 `HTTP_PROXY` 环境变量解析
3. ❌ 没有代理认证机制
4. ⚠️ 依赖底层库的隐式代理支持（axios）

---

## T369: HTTPS 代理支持

### 官方实现
**状态**: ✅ **已实现**

**关键特性**：
- 使用 `https-proxy-agent` 库
- 支持 `HTTPS_PROXY` / `https_proxy` 环境变量
- SSL/TLS 隧道支持（CONNECT 方法）
- 证书验证选项

**代码特征**：
```javascript
// HTTPS 代理连接建立
if (B.username || B.password) {
  let V = `${decodeURIComponent(B.username)}:${decodeURIComponent(B.password)}`
  Z["Proxy-Authorization"] = `Basic ${Buffer.from(V).toString("base64")}`
}
```

### 本项目实现
**状态**: ⚠️ **部分实现**

**位置**:
- `src/core/client.ts` (第 68-72 行) - 创建 Anthropic 客户端
- `src/tools/web.ts` (第 46-54 行) - WebFetch 工具

**现状**：
```typescript
// src/core/client.ts
this.client = new Anthropic({
  apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
  baseURL: config.baseUrl,
  maxRetries: 0, // 自己处理重试
});
// ❌ 未配置 httpAgent
```

**差距分析**：
1. ❌ 未实现 HTTPS 代理配置
2. ❌ 不支持 `HTTPS_PROXY` 环境变量
3. ❌ 缺少 SSL 证书选项（`rejectUnauthorized`）
4. ❌ 无代理认证支持

---

## T370: SOCKS 代理支持

### 官方实现
**状态**: ✅ **已实现**

**关键特性**：
- 使用 `socks-proxy-agent` 库
- 支持 SOCKS4/SOCKS5 协议
- 环境变量支持（可能通过统一代理配置）

**代码特征**：
```javascript
// cli.js 中检测到 socks 相关引用
// 支持 socks:// 和 socks5:// 协议
```

### 本项目实现
**状态**: ❌ **未实现**

**差距分析**：
1. ❌ 完全没有 SOCKS 代理支持
2. ❌ 缺少 `socks-proxy-agent` 依赖
3. ❌ 无 SOCKS 配置接口
4. ❌ 不支持 `ALL_PROXY` 环境变量

**建议方案**：
```typescript
// 需要安装 socks-proxy-agent
import { SocksProxyAgent } from 'socks-proxy-agent';

// 配置示例
const socksAgent = new SocksProxyAgent('socks5://127.0.0.1:1080');
```

---

## T371: 代理认证

### 官方实现
**状态**: ✅ **已实现**

**认证方式**：
1. **Basic 认证** - 用户名/密码
2. **代理 URL 格式** - `http://user:pass@proxy:port`
3. **Authorization 头** - 自动生成

**代码实现**（从 cli.js 反编译）：
```javascript
if (B.username || B.password) {
  let V = `${decodeURIComponent(B.username)}:${decodeURIComponent(B.password)}`
  Z["Proxy-Authorization"] = `Basic ${Buffer.from(V).toString("base64")}`
}
```

### 本项目实现
**状态**: ❌ **未实现**

**差距分析**：
1. ❌ 无代理认证机制
2. ❌ 不解析代理 URL 中的用户名密码
3. ❌ 不生成 `Proxy-Authorization` 头
4. ❌ 不支持 NTLM 等其他认证方式

**安全考虑**：
- 官方使用 `decodeURIComponent` 处理特殊字符
- Base64 编码用户凭据
- 密码不应明文存储在配置文件中

---

## T372: WebSocket 连接

### 官方实现
**状态**: ✅ **已实现**

**用途**：
- MCP (Model Context Protocol) 传输层
- 实时双向通信

**代码特征**（从 cli.js 搜索结果）：
```javascript
// 支持 ws:// 和 wss:// 协议
// WebSocket 客户端实现
// 消息帧处理
```

### 本项目实现
**状态**: ⚠️ **部分实现**

**位置**: `src/mcp/connection.ts`

**现状**：
```typescript
// 第 216-313 行定义了 WebSocket 相关类型
export interface McpServerInfo {
  type: 'stdio' | 'sse' | 'http' | 'websocket';
  url?: string;
  // ...
}

// ❌ WebSocket 传输未实现，仅有类型定义
// 第 458 行：throw new Error(`Unsupported connection type: ${server.type}`);
```

**差距分析**：
1. ✅ 类型定义完整
2. ❌ WebSocket 传输层未实现
3. ❌ 缺少 `ws` 库依赖
4. ❌ 无消息帧处理逻辑

**TODO 实现**：
```typescript
import WebSocket from 'ws';

export class WebSocketConnection extends EventEmitter implements McpTransport {
  private ws?: WebSocket;

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url);
    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.emit('message', message);
    });
  }
}
```

---

## T373: WebSocket 重连

### 官方实现
**状态**: ✅ **已实现**

**特性**：
- 指数退避重连策略
- 最大重试次数限制
- 连接状态跟踪
- 重连事件通知

**代码特征**（基于 grep 结果）：
```javascript
// reconnect 逻辑
// 指数退避延迟计算
delay = reconnectDelayBase * Math.pow(2, attempt)
```

### 本项目实现
**状态**: ⚠️ **部分实现**

**位置**: `src/mcp/connection.ts`

**现状**：
```typescript
// 第 401-410 行 - 连接管理器配置
constructor(options: ConnectionOptions = {}) {
  this.options = {
    reconnectDelayBase: options.reconnectDelayBase ?? 1000,
    // ❌ 但未实际使用此配置
  };
}

// 第 724-731 行 - 心跳失败处理
catch (err) {
  this.emit('heartbeat:failed', connectionId, err);

  // 第 728 行注释：尝试重连
  const connection = this.connections.get(connectionId);
  if (connection) {
    this.emit('connection:reconnecting', connection);
    // ❌ 但未实现实际重连逻辑
  }
}
```

**差距分析**：
1. ✅ 有重连配置项（`reconnectDelayBase`）
2. ✅ 有重连事件（`connection:reconnecting`）
3. ❌ **缺少实际重连实现**
4. ❌ 无指数退避逻辑
5. ❌ 无重连次数限制

**建议实现**：
```typescript
private async reconnect(connectionId: string, attempt: number = 0): Promise<void> {
  if (attempt >= this.options.maxRetries) {
    this.emit('connection:failed', connectionId);
    return;
  }

  const delay = this.options.reconnectDelayBase * Math.pow(2, attempt);
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    await this.connect(serverInfo);
  } catch (err) {
    await this.reconnect(connectionId, attempt + 1);
  }
}
```

---

## T374: WebSocket 心跳

### 官方实现
**状态**: ✅ **已实现**

**特性**：
- Ping/Pong 帧
- 心跳间隔配置
- 超时检测
- 自动断开死连接

### 本项目实现
**状态**: ✅ **已实现**

**位置**: `src/mcp/connection.ts` (第 700-735 行)

**代码实现**：
```typescript
startHeartbeat(connectionId: string): void {
  this.stopHeartbeat(connectionId); // 清除现有定时器

  const timer = setInterval(async () => {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection || connection.status !== 'connected') {
        this.stopHeartbeat(connectionId);
        return;
      }

      // 发送 ping 消息
      const pingMessage: McpMessage = {
        jsonrpc: '2.0',
        id: this.messageIdCounter++,
        method: 'ping',
        params: {},
      };

      await this.send(connectionId, pingMessage);
    } catch (err) {
      this.emit('heartbeat:failed', connectionId, err);
      // ⚠️ 应触发重连，但未实现
    }
  }, this.options.heartbeatInterval); // 默认 30000ms

  this.heartbeatTimers.set(connectionId, timer);
}
```

**对比分析**：
| 特性 | 本项目 | 官方 |
|------|--------|------|
| 心跳间隔配置 | ✅ 30s | ✅ 可配置 |
| Ping 消息 | ✅ JSON-RPC ping | ✅ WebSocket Ping 帧 |
| 超时检测 | ❌ 未实现 | ✅ 已实现 |
| 失败重连 | ❌ 仅触发事件 | ✅ 自动重连 |
| 定时器管理 | ✅ 完整 | ✅ 完整 |

**差距**：
1. ⚠️ 使用 JSON-RPC ping 而非 WebSocket 原生 Ping 帧
2. ❌ 缺少心跳超时检测（未收到 pong 响应）
3. ❌ 心跳失败后未触发自动重连

---

## T375: SSE 客户端

### 官方实现
**状态**: ✅ **已实现**

**用途**：
- MCP 服务器的 SSE 传输
- 服务端推送事件

**代码特征**（从 cli.js）：
```javascript
// SSE 解析器
case "retry":
  /^\d+$/.test(z) ? G(parseInt(z, 10)) :
  B(new O30(`Invalid \`retry\` value: "${z}"`))

// 事件字段
- id: 事件 ID
- event: 事件类型
- data: 事件数据
- retry: 重连间隔
```

**SSE 配置示例**（从 cli.js 帮助文本）：
```bash
claude mcp add --transport sse <name> <url>
```

### 本项目实现
**状态**: ⚠️ **部分实现**

**位置**: `src/mcp/connection.ts` (第 216-313 行)

**代码实现**：
```typescript
export class SseConnection extends EventEmitter implements McpTransport {
  private url: string;
  private headers: Record<string, string>;
  private eventSource?: any; // ⚠️ EventSource 类型未定义
  private httpClient: AxiosInstance;
  private connected: boolean = false;

  async connect(): Promise<void> {
    // ❌ 使用轮询代替真正的 SSE
    this.startPolling();
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.connected) return;

      try {
        // ❌ 轮询实现，非 SSE 标准
        const response = await this.httpClient.get('/events');
        if (response.data) {
          this.emit('message', response.data);
        }
      } catch (err) {
        this.emit('error', err);
      }

      if (this.connected) {
        setTimeout(poll, 1000); // ❌ 固定 1s 间隔
      }
    };

    poll();
  }
}
```

**差距分析**：
| 特性 | 本项目 | 官方 |
|------|--------|------|
| SSE 标准实现 | ❌ 使用轮询模拟 | ✅ 真正的 SSE |
| 事件 ID | ❌ | ✅ |
| 事件类型 | ❌ | ✅ |
| 自动重连 | ❌ | ✅ |
| Retry 间隔 | ❌ 固定 1s | ✅ 服务器指定 |
| 库依赖 | ❌ axios 轮询 | ✅ eventsource / 原生 |

**关键问题**：
1. ❌ **未使用真正的 SSE 协议**（注释说明：需要使用 `eventsource` 库）
2. ❌ 轮询实现效率低下
3. ❌ 无 SSE 标准字段解析（id/event/data/retry）
4. ❌ 缺少断线重连机制

**正确实现方案**：
```typescript
import EventSource from 'eventsource';

export class SseConnection extends EventEmitter {
  private eventSource?: EventSource;

  async connect(): Promise<void> {
    this.eventSource = new EventSource(this.url, {
      headers: this.headers,
    });

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);
      } catch (err) {
        this.emit('parse-error', err);
      }
    };

    this.eventSource.onerror = (err) => {
      this.emit('error', err);
      // EventSource 会自动重连
    };
  }
}
```

---

## T376: 请求超时控制

### 官方实现
**状态**: ✅ **已实现**

**超时类型**：
1. **连接超时** - 建立连接的时间限制
2. **请求超时** - 完整请求的时间限制
3. **空闲超时** - Socket 空闲时间
4. **工具超时** - Bash 工具的 `timeout` 参数（最大 600000ms）

**代码特征**（从 cli.js）：
```javascript
// Socket 超时
if (Q[XI].timeout && Q[XI].timeoutType === hGA) {
  if (Q[XI].timeout.refresh) Q[XI].timeout.refresh()
}

// HTTP 超时
if (Y) W.timeout = Y;

// AbortSignal 超时
AbortSignal.timeout(B);
```

**工具定义**（从 sdk-tools.d.ts）：
```typescript
export interface BashInput {
  timeout?: number; // 最大 600000ms (10分钟)
}
```

### 本项目实现
**状态**: ⚠️ **部分实现**

#### 1. API 客户端超时

**位置**: `src/core/client.ts` (未明确设置)

```typescript
this.client = new Anthropic({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
  maxRetries: 0,
  // ❌ 未设置 timeout
});
```

#### 2. WebFetch 超时

**位置**: `src/tools/web.ts` (第 47-48 行)

```typescript
const response = await axios.get(url, {
  timeout: 30000, // ✅ 30s 超时
  headers: { /* ... */ },
  maxRedirects: 5,
});
```

#### 3. MCP 连接超时

**位置**: `src/mcp/connection.ts` (第 401-410 行)

```typescript
constructor(options: ConnectionOptions = {}) {
  this.options = {
    timeout: options.timeout ?? 30000, // ✅ 默认 30s
    // ...
  };
}

// 第 632-638 行 - 超时实现
setTimeout(() => {
  if (message.id !== undefined) {
    this.pendingRequests.delete(message.id);
  }
  reject(new Error('Request timeout'));
}, this.options.timeout);
```

**差距分析**：
| 超时类型 | 本项目 | 官方 |
|----------|--------|------|
| Anthropic API | ❌ 未配置 | ✅ 已配置 |
| WebFetch | ✅ 30s | ✅ 可配置 |
| MCP 请求 | ✅ 30s | ✅ 可配置 |
| Bash 工具 | ❌ 未限制 | ✅ 最大 10min |
| Socket 超时 | ❌ | ✅ 已实现 |
| AbortSignal | ❌ | ✅ 已实现 |

**关键问题**：
1. ❌ Anthropic SDK 未配置超时（可能导致请求挂起）
2. ❌ Bash 工具无超时限制（安全风险）
3. ❌ 缺少 `AbortController` 支持

---

## T377: 重试策略

### 官方实现
**状态**: ✅ **已实现**

**重试特性**：
1. **可重试错误类型识别**
2. **指数退避算法**
3. **最大重试次数**
4. **抖动（Jitter）**
5. **特定错误处理**

**代码特征**（从 cli.js）：
```javascript
// 重试检测
if (!W && $c9(I)) {
  k("rg EAGAIN error detected, retrying with single-threaded mode (-j 1)");
  Hp0 = !0;
  n("tengu_ripgrep_eagain_retry", {});
  Wp0(A, Q, B, ($, L, N) => { Y($, L, N, !0) }, !0);
  return;
}

// 指数退避
delay = reconnectDelayBase * Math.pow(2, attempt)
```

### 本项目实现
**状态**: ✅ **已实现**

**位置**: `src/core/client.ts` (第 82-105 行)

**代码实现**：
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

**配置**（第 75-76 行）：
```typescript
this.maxRetries = config.maxRetries ?? 4; // 最多重试 4 次
this.retryDelay = config.retryDelay ?? 1000; // 基础延迟 1s
```

**对比分析**：
| 特性 | 本项目 | 官方 |
|------|--------|------|
| 指数退避 | ✅ `delay * 2^n` | ✅ 相同 |
| 最大重试 | ✅ 4 次（可配置） | ✅ 可配置 |
| 错误识别 | ✅ 7 种错误类型 | ✅ 更多类型 |
| 抖动（Jitter） | ❌ 未实现 | ⚠️ 未知 |
| 特定工具重试 | ❌ | ✅ (如 ripgrep) |
| 重试日志 | ✅ console.error | ✅ 结构化日志 |

**差距**：
1. ❌ 缺少抖动（避免惊群效应）
2. ❌ 工具级别的自定义重试策略
3. ⚠️ 日志系统简陋（仅 console.error）

**建议改进**：
```typescript
// 添加抖动
const jitter = Math.random() * 0.3; // ±30% 抖动
const delay = this.retryDelay * Math.pow(2, retryCount) * (1 + jitter);

// 工具特定重试
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableErrors: string[];
}

const toolRetryConfigs: Record<string, RetryConfig> = {
  'Bash': { maxRetries: 1, retryDelay: 500, retryableErrors: ['EAGAIN'] },
  'WebFetch': { maxRetries: 3, retryDelay: 2000, retryableErrors: ['ETIMEDOUT'] },
};
```

---

## T378: 请求取消

### 官方实现
**状态**: ✅ **已实现**

**取消机制**：
1. **AbortController / AbortSignal** - 标准 Web API
2. **取消令牌** - 自定义 CancelToken
3. **超时自动取消** - `AbortSignal.timeout(ms)`

**代码特征**（从 cli.js）：
```javascript
// AbortSignal 超时
let Y = Q || AbortSignal.timeout(B);

// AbortSignal 使用
if (I) return I
} catch(J) {
  k(`Status hook failed: ${J}`, {level: "error"});
  return
}

// Bash 中的 signal 处理
J.signal === "SIGTERM" || J.code === "ABORT_ERR"
```

### 本项目实现
**状态**: ❌ **未实现**

**现状检查**：

#### 1. Anthropic 客户端

**位置**: `src/core/client.ts`

```typescript
// ❌ 未使用 AbortSignal
async createMessage(
  messages: Message[],
  tools?: ToolDefinition[],
  systemPrompt?: string
): Promise<{ /* ... */ }> {
  const response = await this.withRetry(async () => {
    return await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      // ❌ 缺少 signal 参数
    });
  });
}
```

#### 2. WebFetch 工具

**位置**: `src/tools/web.ts`

```typescript
async execute(input: WebFetchInput): Promise<ToolResult> {
  // ❌ 无取消机制
  const response = await axios.get(url, {
    timeout: 30000, // 仅超时，无法手动取消
  });
}
```

#### 3. MCP 连接

**位置**: `src/mcp/connection.ts`

```typescript
// ❌ 请求无法取消
async send(connectionId: string, message: McpMessage): Promise<McpResponse> {
  return new Promise((resolve, reject) => {
    // 第 632-638 行 - 仅超时，无法主动取消
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, this.options.timeout);
  });
}
```

**差距分析**：
| 功能 | 本项目 | 官方 |
|------|--------|------|
| AbortController | ❌ 未使用 | ✅ 已实现 |
| AbortSignal | ❌ 未使用 | ✅ 已实现 |
| CancelToken | ❌ 未实现 | ⚠️ 可能有 |
| Bash 信号 | ❌ 未处理 | ✅ SIGTERM 支持 |
| 流式取消 | ❌ | ✅ 已实现 |
| 工具取消 | ❌ | ✅ 已实现 |

**建议实现**：
```typescript
// 1. 为 API 客户端添加取消支持
async createMessage(
  messages: Message[],
  tools?: ToolDefinition[],
  systemPrompt?: string,
  signal?: AbortSignal // ✅ 添加信号参数
): Promise<{ /* ... */ }> {
  const response = await this.client.messages.create({
    model: this.model,
    max_tokens: this.maxTokens,
    system: systemPrompt,
    messages: messages,
    tools: tools,
    signal, // ✅ 传递取消信号
  });
}

// 2. 为工具添加取消支持
interface ToolExecutionContext {
  signal?: AbortSignal;
}

abstract class BaseTool {
  async execute(input: I, context?: ToolExecutionContext): Promise<R> {
    if (context?.signal?.aborted) {
      throw new Error('Tool execution cancelled');
    }
    // ...
  }
}

// 3. MCP 请求取消
async send(
  connectionId: string,
  message: McpMessage,
  signal?: AbortSignal
): Promise<McpResponse> {
  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      this.pendingRequests.delete(message.id!);
      reject(new Error('Request cancelled'));
    };

    signal?.addEventListener('abort', abortHandler);

    // ... 发送逻辑
  });
}
```

---

## T379: CORS 处理

### 官方实现
**状态**: ⚠️ **不适用**

**原因分析**：
- Claude Code CLI 是 **Node.js 应用**，不是浏览器环境
- Node.js 中的 HTTP 请求**不受 CORS 限制**
- CORS 是浏览器安全策略，不适用于服务端

**搜索结果**：
```bash
# 在官方 cli.js 中搜索 CORS 相关关键词
grep -i "cors\|access-control-allow\|options.*request\|preflight" cli.js
# ❌ 无结果
```

### 本项目实现
**状态**: ⚠️ **不适用**

**原因**：同官方，本项目也是 Node.js CLI 应用

**相关说明**：
- `src/tools/web.ts` - WebFetch 使用 axios（Node.js 环境）
- `src/core/client.ts` - Anthropic SDK（Node.js 环境）
- `src/mcp/connection.ts` - MCP 连接（服务端到服务端）

**如果未来有浏览器版本**：
```typescript
// 仅在浏览器环境需要
interface FetchOptions {
  mode?: 'cors' | 'no-cors' | 'same-origin';
  credentials?: 'omit' | 'same-origin' | 'include';
}

async function webFetch(url: string, options: FetchOptions = {}) {
  const response = await fetch(url, {
    mode: 'cors', // 允许跨域
    credentials: 'include', // 携带 Cookie
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
```

**结论**：
- ✅ **本项目无需实现 CORS 处理**（Node.js CLI 应用）
- ✅ **官方也未实现 CORS 处理**（同样原因）
- ⚠️ 如果开发 Web 版本，才需要考虑 CORS

---

## 总结对比表

| 功能点 | 功能名称 | 官方实现 | 本项目实现 | 差距等级 | 优先级 |
|--------|----------|----------|------------|----------|--------|
| T368 | HTTP 代理支持 | ✅ 完整 | ⚠️ 部分 | **高** | P0 |
| T369 | HTTPS 代理支持 | ✅ 完整 | ⚠️ 部分 | **高** | P0 |
| T370 | SOCKS 代理支持 | ✅ 完整 | ❌ 缺失 | **高** | P1 |
| T371 | 代理认证 | ✅ 完整 | ❌ 缺失 | **高** | P0 |
| T372 | WebSocket 连接 | ✅ 完整 | ⚠️ 类型定义 | **高** | P1 |
| T373 | WebSocket 重连 | ✅ 完整 | ⚠️ 事件定义 | **中** | P2 |
| T374 | WebSocket 心跳 | ✅ 完整 | ✅ 已实现 | **低** | - |
| T375 | SSE 客户端 | ✅ 标准实现 | ⚠️ 轮询模拟 | **高** | P1 |
| T376 | 请求超时控制 | ✅ 完整 | ⚠️ 部分 | **中** | P2 |
| T377 | 重试策略 | ✅ 完整 | ✅ 已实现 | **低** | - |
| T378 | 请求取消 | ✅ 完整 | ❌ 缺失 | **高** | P1 |
| T379 | CORS 处理 | ⚠️ 不适用 | ⚠️ 不适用 | - | - |

---

## 关键差距分析

### 1. 代理支持（T368-T371）

**差距**：
- ❌ 无 HTTP/HTTPS 代理配置接口
- ❌ 不支持环境变量（`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`）
- ❌ 无 SOCKS 代理支持
- ❌ 无代理认证机制

**影响**：
- 企业用户无法在代理环境下使用
- 部署受限（防火墙后、VPN 环境）
- 安全性降低（无认证控制）

**建议方案**：
```typescript
// src/proxy/index.ts
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface ProxyConfig {
  http?: string;  // HTTP_PROXY
  https?: string; // HTTPS_PROXY
  socks?: string; // ALL_PROXY
  noProxy?: string[]; // NO_PROXY
}

export function createProxyAgent(config: ProxyConfig) {
  const proxyUrl = config.https || config.http || config.socks;
  if (!proxyUrl) return undefined;

  if (proxyUrl.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl);
  } else {
    return new HttpsProxyAgent(proxyUrl);
  }
}

// 使用
const agent = createProxyAgent({
  https: process.env.HTTPS_PROXY,
  http: process.env.HTTP_PROXY,
  socks: process.env.ALL_PROXY,
});

const client = new Anthropic({
  apiKey: config.apiKey,
  httpAgent: agent,
});
```

### 2. WebSocket/SSE 传输（T372-T375）

**差距**：
- ❌ WebSocket 传输未实现
- ❌ SSE 使用轮询模拟（非标准）
- ❌ 无自动重连机制
- ❌ 心跳失败后无重连

**影响**：
- MCP 服务器连接不稳定
- SSE 性能低下（轮询开销）
- 网络波动易断连

**建议方案**：
```typescript
// 安装依赖
npm install ws eventsource

// WebSocket 实现
import WebSocket from 'ws';

export class WebSocketConnection extends EventEmitter implements McpTransport {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url, {
      headers: this.headers,
    });

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connect');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('message', message);
      } catch (err) {
        this.emit('parse-error', err);
      }
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.emit('disconnect');
      this.reconnect();
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
    });

    // WebSocket 心跳
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect-failed');
      return;
    }

    const delay = 1000 * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect();
  }
}

// SSE 实现
import EventSource from 'eventsource';

export class SseConnection extends EventEmitter implements McpTransport {
  private eventSource?: EventSource;

  async connect(): Promise<void> {
    this.eventSource = new EventSource(this.url, {
      headers: this.headers,
    });

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);
      } catch (err) {
        this.emit('parse-error', err);
      }
    };

    this.eventSource.onerror = (err) => {
      this.emit('error', err);
      // EventSource 自动重连
    };

    this.connected = true;
    this.emit('connect');
  }
}
```

### 3. 请求取消（T378）

**差距**：
- ❌ 无 AbortController 支持
- ❌ Anthropic API 请求无法取消
- ❌ 长时间运行的工具无法中断

**影响**：
- 用户无法取消错误操作
- 资源泄漏风险
- 响应性差

**建议方案**：
```typescript
// 为所有工具添加取消支持
export interface ToolExecutionContext {
  signal?: AbortSignal;
  timeout?: number;
}

export abstract class BaseTool<I, R> {
  async execute(input: I, context?: ToolExecutionContext): Promise<R> {
    // 检查取消信号
    if (context?.signal?.aborted) {
      throw new Error('Tool execution cancelled');
    }

    // 创建超时信号
    const timeoutSignal = context?.timeout
      ? AbortSignal.timeout(context.timeout)
      : undefined;

    // 合并信号
    const signal = this.combineSignals(context?.signal, timeoutSignal);

    // 执行逻辑
    return this.executeInternal(input, signal);
  }

  private combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (!signal) continue;

      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => controller.abort());
    }

    return controller.signal;
  }

  protected abstract executeInternal(input: I, signal?: AbortSignal): Promise<R>;
}

// Bash 工具示例
export class BashTool extends BaseTool<BashInput, ToolResult> {
  protected async executeInternal(
    input: BashInput,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const proc = spawn(input.command, [], { shell: true });

    signal?.addEventListener('abort', () => {
      proc.kill('SIGTERM');
    });

    return new Promise((resolve, reject) => {
      // ...
    });
  }
}
```

---

## 改进优先级

### P0 级（关键功能，立即实现）

1. **HTTP/HTTPS 代理支持**（T368, T369, T371）
   - 实现代理配置接口
   - 支持环境变量
   - 实现代理认证
   - **工作量**: 2-3 天

2. **请求取消机制**（T378）
   - 添加 AbortController 支持
   - 为所有工具添加取消接口
   - 实现信号传播
   - **工作量**: 1-2 天

### P1 级（重要功能，近期实现）

3. **WebSocket 传输**（T372）
   - 实现 WebSocket 连接类
   - 添加自动重连
   - **工作量**: 2-3 天

4. **SSE 标准实现**（T375）
   - 使用 `eventsource` 库
   - 替换轮询实现
   - **工作量**: 1 天

5. **SOCKS 代理**（T370）
   - 添加 `socks-proxy-agent` 依赖
   - 实现 SOCKS 配置
   - **工作量**: 1 天

### P2 级（优化功能，可延后）

6. **请求超时优化**（T376）
   - 为 Anthropic SDK 配置超时
   - 为 Bash 工具添加超时限制
   - **工作量**: 0.5 天

7. **WebSocket 重连**（T373）
   - 完善重连逻辑
   - 添加指数退避
   - **工作量**: 0.5 天

8. **重试策略优化**（T377）
   - 添加抖动
   - 工具特定重试配置
   - **工作量**: 0.5 天

---

## 依赖包需求

### 需要安装的包

```bash
# 代理支持
npm install https-proxy-agent http-proxy-agent socks-proxy-agent

# WebSocket 支持
npm install ws
npm install -D @types/ws

# SSE 支持
npm install eventsource
npm install -D @types/eventsource
```

### package.json 更新

```json
{
  "dependencies": {
    "https-proxy-agent": "^7.0.2",
    "http-proxy-agent": "^7.0.0",
    "socks-proxy-agent": "^8.0.2",
    "ws": "^8.14.2",
    "eventsource": "^2.0.2"
  },
  "devDependencies": {
    "@types/ws": "^8.5.9",
    "@types/eventsource": "^1.1.15"
  }
}
```

---

## 测试建议

### 1. 代理测试

```typescript
// tests/proxy.test.ts
describe('Proxy Support', () => {
  it('should use HTTP proxy from environment', async () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
    const client = new ClaudeClient();
    // 验证请求通过代理
  });

  it('should authenticate with proxy', async () => {
    const proxy = 'http://user:pass@proxy.example.com:8080';
    // 验证代理认证
  });

  it('should support SOCKS proxy', async () => {
    process.env.ALL_PROXY = 'socks5://127.0.0.1:1080';
    // 验证 SOCKS 代理
  });
});
```

### 2. WebSocket 测试

```typescript
// tests/websocket.test.ts
describe('WebSocket Connection', () => {
  it('should establish WebSocket connection', async () => {
    const ws = new WebSocketConnection('ws://localhost:8080');
    await ws.connect();
    expect(ws.isConnected()).toBe(true);
  });

  it('should reconnect on disconnection', async () => {
    // 模拟断线
    // 验证自动重连
  });

  it('should handle heartbeat', async () => {
    // 验证心跳机制
  });
});
```

### 3. 取消测试

```typescript
// tests/abort.test.ts
describe('Request Cancellation', () => {
  it('should cancel API request', async () => {
    const controller = new AbortController();
    const promise = client.createMessage(messages, tools, system, controller.signal);

    controller.abort();

    await expect(promise).rejects.toThrow('cancelled');
  });

  it('should cancel tool execution', async () => {
    const controller = new AbortController();
    const tool = new BashTool();

    setTimeout(() => controller.abort(), 100);

    await expect(
      tool.execute({ command: 'sleep 10' }, { signal: controller.signal })
    ).rejects.toThrow('cancelled');
  });
});
```

---

## 配置文件更新

### settings.json 新增配置

```json
{
  "proxy": {
    "http": "http://proxy.example.com:8080",
    "https": "https://proxy.example.com:8080",
    "socks": "socks5://127.0.0.1:1080",
    "noProxy": ["localhost", "127.0.0.1", "*.local"],
    "auth": {
      "username": "user",
      "password": "pass"
    }
  },
  "network": {
    "timeout": 30000,
    "retries": 4,
    "retryDelay": 1000
  },
  "mcp": {
    "heartbeatInterval": 30000,
    "reconnectDelay": 1000,
    "maxReconnectAttempts": 5
  }
}
```

---

## 文档更新需求

1. **用户文档**
   - 代理配置指南
   - 企业网络环境部署
   - 故障排查（代理连接失败）

2. **开发文档**
   - WebSocket/SSE 传输协议
   - 请求取消机制使用
   - 自定义重试策略

3. **API 文档**
   - `ProxyConfig` 接口
   - `ToolExecutionContext` 接口
   - 取消信号传播

---

## 结论

### 完成度评估

- **整体完成度**: ~50%
- **关键功能缺失**: 代理支持、请求取消、WebSocket 传输
- **部分实现功能**: SSE（轮询）、超时控制、重试策略
- **完整实现功能**: WebSocket 心跳、基础重试

### 推荐路线图

**第一阶段**（1 周）：
1. 实现 HTTP/HTTPS 代理支持
2. 添加代理认证
3. 实现请求取消机制

**第二阶段**（1 周）：
4. 实现 WebSocket 传输
5. 修复 SSE 实现（替换轮询）
6. 添加 SOCKS 代理

**第三阶段**（3 天）：
7. 优化超时控制
8. 完善重连逻辑
9. 重试策略优化

**总工作量**: 约 2.5 周

---

## 参考资料

### 官方资源
- [Anthropic SDK 文档](https://github.com/anthropics/anthropic-sdk-typescript)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

### 代理库文档
- [https-proxy-agent](https://github.com/TooTallNate/proxy-agents)
- [socks-proxy-agent](https://github.com/TooTallNate/proxy-agents)
- [proxy-from-env](https://github.com/Rob--W/proxy-from-env)

### Node.js 文档
- [AbortController](https://nodejs.org/api/globals.html#class-abortcontroller)
- [EventSource (eventsource)](https://github.com/EventSource/eventsource)
- [WebSocket (ws)](https://github.com/websockets/ws)

---

**文档版本**: 1.0
**最后更新**: 2025-12-25
**维护者**: Claude Code 开发团队
