# 流式处理模块 (Streaming)

本模块实现了完善的流式处理功能，包含 10 个功能点 (T333-T342)，与 Anthropic 官方实现对齐。

## 目录结构

```
src/streaming/
├── index.ts              # 主导出文件（原有基础流式处理）
├── sse.ts                # T333: SSE 解析器
├── message-stream.ts     # T334-T342: 增强的消息流处理
├── examples.ts           # 使用示例
└── README.md             # 本文档
```

## 功能清单

### T333: SSE 流式解析

实现标准 Server-Sent Events (SSE) 协议解析器：

**核心类：**
- `SSEDecoder` - SSE 事件解码器
- `NewlineDecoder` - 字节级换行解码器
- `parseSSEStream()` - 异步生成器函数
- `SSEStream` - 高层次的 SSE 流包装器

**特性：**
- ✅ 支持 `event:` 和 `data:` 字段
- ✅ 多行数据字段
- ✅ CRLF 和 LF 换行符
- ✅ 注释行（以 `:` 开头）
- ✅ `id` 和 `retry` 字段
- ✅ 流式重连支持

**使用示例：**
```typescript
import { parseSSEStream, SSEStream } from './sse.js';

// 从 Response 创建 SSE 流
const stream = SSEStream.fromResponse(response);

for await (const data of stream) {
  console.log('收到数据:', data);
}
```

### T334: stream_event 处理

实现 Anthropic API 标准流式事件处理：

**支持的事件类型：**
- `message_start` - 消息开始
- `content_block_start` - 内容块开始
- `content_block_delta` - 内容增量更新
- `content_block_stop` - 内容块结束
- `message_delta` - 消息元数据更新
- `message_stop` - 消息结束

**状态管理：**
- 自动累积消息状态
- 提供当前消息快照
- 事件监听机制

### T335: text_delta 处理

处理文本内容的增量更新：

**特性：**
- ✅ 实时累积文本内容
- ✅ 提供增量文本和完整文本
- ✅ 文本回调事件

**示例：**
```typescript
stream.on('text', (delta, fullText) => {
  console.log('增量:', delta);
  console.log('完整文本:', fullText);
});
```

### T336: thinking_delta 处理

支持 Extended Thinking 功能：

**特性：**
- ✅ 思考过程增量更新
- ✅ 独立的思考内容块
- ✅ 思考完成回调

**内容块类型：**
```typescript
interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}
```

### T337: input_json_delta 处理

工具参数的增量 JSON 解析：

**核心功能：**
- ✅ 容错 JSON 解析器 `parseTolerantJSON()`
- ✅ 自动修复不完整的 JSON
- ✅ 补全未闭合的括号和引号
- ✅ 处理尾部逗号
- ✅ 使用 Symbol 存储 JSON 缓冲区

**容错解析示例：**
```typescript
import { parseTolerantJSON } from './message-stream.js';

// 不完整的 JSON
const json = '{"name": "test", "value": 123';

// 自动修复并解析
const result = parseTolerantJSON(json);
// => { name: "test", value: 123 }
```

### T338: citations_delta 处理

引用的增量更新：

**特性：**
- ✅ 引用列表管理
- ✅ 增量添加引用
- ✅ 引用完成回调

**引用格式：**
```typescript
interface Citation {
  type: string;
  cited_text: string;
  start: number;
  end: number;
}
```

### T339: signature_delta 处理

思考签名处理：

**特性：**
- ✅ 签名字段更新
- ✅ 签名回调事件

### T340: 流式中断处理

完整的 AbortController 集成：

**特性：**
- ✅ 内部 AbortController
- ✅ 外部 AbortSignal 传播
- ✅ 优雅清理
- ✅ Abort 事件通知

**示例：**
```typescript
const abortController = new AbortController();

const stream = new EnhancedMessageStream({
  onAbort: (error) => {
    console.log('流已中止');
  },
}, {
  signal: abortController.signal,
});

// 中止流
abortController.abort();
```

### T341: 流式重连机制

基础错误处理和重试：

**特性：**
- ✅ 错误检测和处理
- ✅ 连接状态管理
- ⚠️ 自动重连（依赖上层实现）

### T342: 流式缓冲管理

多层缓冲策略：

**实现层次：**
1. **字节级缓冲** - `NewlineDecoder` 处理 Uint8Array
2. **行级缓冲** - SSE 行解析
3. **事件缓冲** - 事件队列管理（背压控制）
4. **消息状态缓冲** - 累积的消息状态

**背压处理：**
```typescript
// 默认队列大小: 100
private maxQueueSize: number = 100;

// 自动背压控制
if (this.eventQueue.length >= this.maxQueueSize) {
  console.warn('Event queue full, dropping event');
  return;
}
```

## 增强功能

### 超时控制

```typescript
const stream = new EnhancedMessageStream({}, {
  timeout: 30000,  // 30秒超时
});
```

### 心跳检测

```typescript
const stream = new EnhancedMessageStream({}, {
  onHeartbeat: () => {
    console.log('心跳检测...');
  },
});
```

## 完整示例

```typescript
import { EnhancedMessageStream } from './message-stream.js';

const stream = new EnhancedMessageStream({
  // 文本增量回调
  onText: (delta, snapshot) => {
    process.stdout.write(delta);
  },

  // 工具输入 JSON 回调
  onInputJson: (delta, parsedInput) => {
    console.log('工具输入:', parsedInput);
  },

  // 消息完成回调
  onMessage: (message) => {
    console.log('\n消息完成');
    console.log('Token 使用:', message.usage);
  },

  // 错误回调
  onError: (error) => {
    console.error('错误:', error.message);
  },
}, {
  timeout: 60000,      // 60秒超时
  signal: abortSignal, // 外部中止信号
});

// 处理来自 Anthropic API 的事件
for await (const event of apiStream) {
  await stream.handleStreamEvent(event);
}

// 获取最终结果
const finalMessage = stream.getFinalMessage();
const finalText = stream.getFinalText();
```

## 与官方实现的对比

### 相同点

| 功能 | 本项目 | 官方 |
|------|--------|------|
| 事件类型系统 | ✅ 完整支持 | ✅ 完整支持 |
| Delta 处理 | ✅ 5种 delta | ✅ 5种 delta |
| 容错 JSON 解析 | ✅ 实现 | ✅ 实现 |
| AbortController | ✅ 完整支持 | ✅ 完整支持 |
| 异步迭代器 | ✅ 支持 | ✅ 支持 |
| 背压控制 | ✅ 队列管理 | ✅ 双向队列 |

### 差异点

| 维度 | 本项目 | 官方 | 说明 |
|------|--------|------|------|
| **流协议** | JSON 行流 + SSE | SSE | 本项目支持两种 |
| **缓冲层次** | 2-4层 | 4层 | 官方更完整 |
| **重连机制** | ⚠️ 基础 | ✅ 完整 | 需上层实现 |
| **状态快照** | ✅ 支持 | ✅ 支持 | 实现方式略有不同 |

## 运行示例

```bash
# 运行所有示例
npx tsx src/streaming/examples.ts

# 或在代码中导入
import { runAllExamples } from './examples.js';
await runAllExamples();
```

## API 文档

### EnhancedMessageStream

#### 构造函数

```typescript
constructor(
  callbacks?: StreamCallbacks,
  options?: StreamOptions
)
```

#### 方法

- `handleStreamEvent(event: any): Promise<void>` - 处理流式事件
- `abort(): void` - 中止流
- `getFinalMessage(): MessageState | null` - 获取最终消息
- `getFinalText(): string` - 获取最终文本
- `getMessages(): MessageState[]` - 获取所有消息
- `isEnded(): boolean` - 检查是否已结束
- `isAborted(): boolean` - 检查是否已中止
- `getError(): Error | null` - 获取错误

#### 事件

- `text` - 文本增量
- `thinking` - 思考增量
- `inputJson` - 工具输入 JSON
- `citation` - 引用
- `signature` - 签名
- `contentBlock` - 内容块完成
- `message` - 消息完成
- `streamEvent` - 流式事件
- `error` - 错误
- `abort` - 中止
- `complete` - 完成

## 类型定义

所有类型定义导出自 `./message-stream.js`：

- `StreamEventType` - 事件类型
- `DeltaType` - Delta 类型
- `ContentBlockType` - 内容块类型
- `TextContentBlock` - 文本块
- `ThinkingContentBlock` - 思考块
- `ToolUseContentBlock` - 工具使用块
- `ContentBlock` - 联合类型
- `MessageState` - 消息状态
- `StreamOptions` - 流选项
- `StreamCallbacks` - 流回调

## 注意事项

1. **协议兼容性**: 本项目同时支持 JSON 行流和 SSE，而官方仅使用 SSE
2. **教育用途**: 这是一个学习项目，生产环境建议使用官方 SDK
3. **依赖关系**: 部分功能依赖 Anthropic SDK 的类型定义
4. **平台支持**: 所有功能在 Node.js 18+ 上测试通过

## 扩展阅读

- [Anthropic API 文档](https://docs.anthropic.com/en/api/messages-streaming)
- [Server-Sent Events 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [AbortController 文档](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

## 贡献

如需改进此模块，请：
1. 阅读对比文档 `docs/comparison/29-streaming.md`
2. 查阅官方源码了解最新实现
3. 运行类型检查确保无错误
4. 添加单元测试
5. 更新此 README

## 许可证

MIT License
