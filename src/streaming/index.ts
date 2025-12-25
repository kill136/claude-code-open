/**
 * Stream JSON I/O
 * 支持流式 JSON 输入输出
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';

// 流式消息类型
export type StreamMessageType =
  | 'user_message'
  | 'assistant_message'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done'
  | 'partial'
  | 'system';

// 基础流式消息
export interface StreamMessage {
  type: StreamMessageType;
  timestamp: number;
  session_id?: string;
}

// 用户消息
export interface UserStreamMessage extends StreamMessage {
  type: 'user_message';
  content: string;
  attachments?: Array<{
    type: 'file' | 'image';
    path?: string;
    data?: string;
    mimeType?: string;
  }>;
}

// 助手消息
export interface AssistantStreamMessage extends StreamMessage {
  type: 'assistant_message';
  content: string;
  model?: string;
  stop_reason?: string;
}

// 工具使用
export interface ToolUseStreamMessage extends StreamMessage {
  type: 'tool_use';
  tool_id: string;
  tool_name: string;
  input: unknown;
}

// 工具结果
export interface ToolResultStreamMessage extends StreamMessage {
  type: 'tool_result';
  tool_id: string;
  success: boolean;
  output?: string;
  error?: string;
}

// 部分消息（流式输出）
export interface PartialStreamMessage extends StreamMessage {
  type: 'partial';
  content: string;
  index: number;
}

// 错误消息
export interface ErrorStreamMessage extends StreamMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

// 完成消息
export interface DoneStreamMessage extends StreamMessage {
  type: 'done';
  stats?: {
    input_tokens: number;
    output_tokens: number;
    total_cost_usd: number;
    duration_ms: number;
  };
}

// 系统消息
export interface SystemStreamMessage extends StreamMessage {
  type: 'system';
  event: string;
  data?: unknown;
}

// 联合类型
export type AnyStreamMessage =
  | UserStreamMessage
  | AssistantStreamMessage
  | ToolUseStreamMessage
  | ToolResultStreamMessage
  | PartialStreamMessage
  | ErrorStreamMessage
  | DoneStreamMessage
  | SystemStreamMessage;

// 流式 JSON 读取器
export class StreamJsonReader extends EventEmitter {
  private rl: readline.Interface;
  private buffer: string = '';
  private closed: boolean = false;

  constructor(input: NodeJS.ReadableStream = process.stdin) {
    super();

    this.rl = readline.createInterface({
      input,
      terminal: false,
    });

    this.rl.on('line', (line) => {
      this.processLine(line);
    });

    this.rl.on('close', () => {
      this.closed = true;
      this.emit('close');
    });

    this.rl.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private processLine(line: string): void {
    line = line.trim();
    if (!line) return;

    try {
      const message = JSON.parse(line) as AnyStreamMessage;

      // 添加时间戳如果没有
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      this.emit('message', message);
      this.emit(message.type, message);
    } catch (err) {
      this.emit('parse_error', line, err);
    }
  }

  // 异步迭代器
  async *messages(): AsyncGenerator<AnyStreamMessage> {
    const queue: AnyStreamMessage[] = [];
    let resolve: ((value: AnyStreamMessage | null) => void) | null = null;

    const onMessage = (msg: AnyStreamMessage) => {
      if (resolve) {
        resolve(msg);
        resolve = null;
      } else {
        queue.push(msg);
      }
    };

    const onClose = () => {
      if (resolve) {
        resolve(null);
        resolve = null;
      }
    };

    this.on('message', onMessage);
    this.on('close', onClose);

    try {
      while (!this.closed || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          const msg = await new Promise<AnyStreamMessage | null>((r) => {
            resolve = r;
          });
          if (msg === null) break;
          yield msg;
        }
      }
    } finally {
      this.off('message', onMessage);
      this.off('close', onClose);
    }
  }

  close(): void {
    this.rl.close();
  }
}

// 流式 JSON 写入器
export class StreamJsonWriter {
  private output: NodeJS.WritableStream;
  private sessionId: string;
  private messageIndex: number = 0;

  constructor(
    output: NodeJS.WritableStream = process.stdout,
    sessionId?: string
  ) {
    this.output = output;
    this.sessionId = sessionId || this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  write(message: Partial<StreamMessage>): void {
    const fullMessage: StreamMessage = {
      type: message.type || 'system',
      timestamp: Date.now(),
      session_id: this.sessionId,
      ...message,
    };

    this.output.write(JSON.stringify(fullMessage) + '\n');
  }

  // 写入用户消息
  writeUserMessage(content: string, attachments?: UserStreamMessage['attachments']): void {
    this.write({
      type: 'user_message',
      content,
      attachments,
    } as UserStreamMessage);
  }

  // 写入助手消息
  writeAssistantMessage(content: string, model?: string, stopReason?: string): void {
    this.write({
      type: 'assistant_message',
      content,
      model,
      stop_reason: stopReason,
    } as AssistantStreamMessage);
  }

  // 写入工具使用
  writeToolUse(toolId: string, toolName: string, input: unknown): void {
    this.write({
      type: 'tool_use',
      tool_id: toolId,
      tool_name: toolName,
      input,
    } as ToolUseStreamMessage);
  }

  // 写入工具结果
  writeToolResult(toolId: string, success: boolean, output?: string, error?: string): void {
    this.write({
      type: 'tool_result',
      tool_id: toolId,
      success,
      output,
      error,
    } as ToolResultStreamMessage);
  }

  // 写入部分消息
  writePartial(content: string): void {
    this.write({
      type: 'partial',
      content,
      index: this.messageIndex++,
    } as PartialStreamMessage);
  }

  // 写入错误
  writeError(code: string, message: string, details?: unknown): void {
    this.write({
      type: 'error',
      code,
      message,
      details,
    } as ErrorStreamMessage);
  }

  // 写入完成
  writeDone(stats?: DoneStreamMessage['stats']): void {
    this.write({
      type: 'done',
      stats,
    } as DoneStreamMessage);
  }

  // 写入系统事件
  writeSystem(event: string, data?: unknown): void {
    this.write({
      type: 'system',
      event,
      data,
    } as SystemStreamMessage);
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// 流式会话处理器
export class StreamSession {
  private reader: StreamJsonReader;
  private writer: StreamJsonWriter;
  private handlers: Map<StreamMessageType, ((msg: AnyStreamMessage) => Promise<void>)[]> = new Map();

  constructor(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout
  ) {
    this.reader = new StreamJsonReader(input);
    this.writer = new StreamJsonWriter(output);

    // 设置消息路由
    this.reader.on('message', async (msg: AnyStreamMessage) => {
      const handlers = this.handlers.get(msg.type) || [];
      for (const handler of handlers) {
        try {
          await handler(msg);
        } catch (err) {
          this.writer.writeError('handler_error', String(err));
        }
      }
    });
  }

  // 注册消息处理器
  on<T extends StreamMessageType>(
    type: T,
    handler: (msg: Extract<AnyStreamMessage, { type: T }>) => Promise<void>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as (msg: AnyStreamMessage) => Promise<void>);
  }

  // 获取写入器
  getWriter(): StreamJsonWriter {
    return this.writer;
  }

  // 获取读取器
  getReader(): StreamJsonReader {
    return this.reader;
  }

  // 启动会话
  async start(): Promise<void> {
    this.writer.writeSystem('session_start');
  }

  // 结束会话
  async end(): Promise<void> {
    this.writer.writeDone();
    this.reader.close();
  }
}

// 重放用户消息（用于 --replay-user-messages 选项）
export class MessageReplay {
  private writer: StreamJsonWriter;

  constructor(writer: StreamJsonWriter) {
    this.writer = writer;
  }

  replay(message: UserStreamMessage): void {
    // 原样输出用户消息作为确认
    this.writer.write({
      type: 'system',
      event: 'user_message_acknowledged',
      data: {
        original: message,
      },
    } as SystemStreamMessage);
  }
}

// ========== 导出增强的流式处理模块 ==========

// T333: SSE 解析器
export {
  SSEEvent,
  SSEDecoder,
  NewlineDecoder,
  parseSSEStream,
  SSEStream,
} from './sse.js';

// T334-T342: 增强的消息流处理
export {
  StreamEventType,
  DeltaType,
  ContentBlockType,
  TextContentBlock,
  ThinkingContentBlock,
  ToolUseContentBlock,
  ContentBlock,
  MessageState,
  StreamOptions,
  StreamCallbacks,
  parseTolerantJSON,
  EnhancedMessageStream,
} from './message-stream.js';
