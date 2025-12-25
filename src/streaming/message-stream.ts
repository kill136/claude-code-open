/**
 * Enhanced Message Stream Handler
 * T334-T342: 流式消息处理、delta 事件、错误处理、中断控制等
 *
 * 基于 Anthropic API 标准事件模型
 */

import { EventEmitter } from 'events';
import type Anthropic from '@anthropic-ai/sdk';

// ========== 类型定义 ==========

/**
 * Anthropic API 标准流式事件类型
 * T334: stream_event 处理
 */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop';

/**
 * Delta 类型
 * T335-T339: 各种 delta 处理
 */
export type DeltaType =
  | 'text_delta'          // T335: 文本增量
  | 'thinking_delta'      // T336: 思考过程增量
  | 'input_json_delta'    // T337: 工具参数 JSON 增量
  | 'citations_delta'     // T338: 引用增量
  | 'signature_delta';    // T339: 签名增量

/**
 * 内容块类型
 */
export type ContentBlockType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'server_tool_use'
  | 'mcp_tool_use';

/**
 * 文本内容块
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
  citations?: Array<{
    type: string;
    cited_text: string;
    start: number;
    end: number;
  }>;
}

/**
 * 思考内容块
 */
export interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

/**
 * 工具使用内容块
 */
export interface ToolUseContentBlock {
  type: 'tool_use' | 'server_tool_use' | 'mcp_tool_use';
  id: string;
  name: string;
  input: any;
}

/**
 * 联合内容块类型
 */
export type ContentBlock = TextContentBlock | ThinkingContentBlock | ToolUseContentBlock;

/**
 * 消息状态
 */
export interface MessageState {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * 流式选项
 * T338: 流取消 (AbortController)
 * T340: 流超时
 */
export interface StreamOptions {
  signal?: AbortSignal;
  timeout?: number;
  onHeartbeat?: () => void;  // T341: 心跳检测
}

/**
 * 流式回调
 * T342: 流式事件回调
 */
export interface StreamCallbacks {
  onText?: (delta: string, snapshot: string) => void;
  onThinking?: (delta: string, snapshot: string) => void;
  onInputJson?: (delta: string, snapshot: any) => void;
  onCitation?: (citation: any, citations: any[]) => void;
  onSignature?: (signature: string) => void;
  onContentBlock?: (block: ContentBlock) => void;
  onMessage?: (message: MessageState) => void;
  onStreamEvent?: (event: any, snapshot: MessageState) => void;
  onError?: (error: Error) => void;
  onAbort?: (error: Error) => void;
  onComplete?: () => void;
}

// ========== 容错 JSON 解析 ==========

/**
 * T337: 容错 JSON 解析
 * 基于官方实现的 aA1 函数
 *
 * 自动修复不完整的 JSON:
 * - 补全未闭合的括号和引号
 * - 处理尾部逗号
 * - 处理截断的字符串
 */
export function parseTolerantJSON(jsonStr: string): any {
  if (!jsonStr || !jsonStr.trim()) {
    return {};
  }

  // 首先尝试标准解析
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    // 如果失败，尝试修复
  }

  let fixed = jsonStr.trim();

  // 移除尾部逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // 计算需要补全的括号
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;
  const openQuotes = (fixed.match(/"/g) || []).length;

  // 补全未闭合的引号（如果数量为奇数）
  if (openQuotes % 2 !== 0) {
    fixed += '"';
  }

  // 补全未闭合的数组
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }

  // 补全未闭合的对象
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  // 再次尝试解析
  try {
    return JSON.parse(fixed);
  } catch (error) {
    // 如果还是失败，返回空对象
    console.warn('Failed to parse JSON even after repair:', jsonStr, error);
    return {};
  }
}

// ========== 增强的消息流处理器 ==========

/**
 * 增强的消息流处理器
 * 实现 T334-T342 的所有功能
 */
export class EnhancedMessageStream extends EventEmitter {
  private currentMessage: MessageState | null = null;
  private messages: MessageState[] = [];
  private aborted: boolean = false;
  private ended: boolean = false;
  private error: Error | null = null;

  // T338: AbortController 支持
  private abortController: AbortController;

  // T340: 超时控制
  private timeoutId: NodeJS.Timeout | null = null;

  // T341: 心跳检测
  private lastActivityTime: number = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // T339: 背压控制
  private eventQueue: any[] = [];
  private processing: boolean = false;
  private maxQueueSize: number = 100;

  // 隐藏属性用于存储 JSON 缓冲区
  private readonly JSON_BUF_SYMBOL = Symbol('__json_buf');

  constructor(
    private callbacks: StreamCallbacks = {},
    private options: StreamOptions = {}
  ) {
    super();
    this.abortController = new AbortController();

    // 设置超时
    if (options.timeout) {
      this.setupTimeout(options.timeout);
    }

    // 设置心跳检测
    if (options.onHeartbeat) {
      this.setupHeartbeat();
    }

    // 监听外部 AbortSignal
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this.abort();
      });
    }
  }

  /**
   * T340: 设置超时
   */
  private setupTimeout(timeout: number): void {
    this.timeoutId = setTimeout(() => {
      const error = new Error(`Stream timeout after ${timeout}ms`);
      this.handleError(error);
    }, timeout);
  }

  /**
   * T341: 设置心跳检测
   */
  private setupHeartbeat(): void {
    const HEARTBEAT_INTERVAL = 5000; // 5 秒
    const HEARTBEAT_TIMEOUT = 30000; // 30 秒无活动则超时

    this.heartbeatInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;

      if (timeSinceActivity > HEARTBEAT_TIMEOUT) {
        const error = new Error('Stream heartbeat timeout');
        this.handleError(error);
        return;
      }

      // 调用心跳回调
      this.options.onHeartbeat?.();
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * 更新活动时间
   */
  private updateActivity(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * T338: 中止流
   */
  abort(): void {
    if (this.aborted || this.ended) {
      return;
    }

    this.aborted = true;
    this.abortController.abort();

    const error = new Error('Stream aborted');
    this.callbacks.onAbort?.(error);
    this.emit('abort', error);

    this.cleanup();
  }

  /**
   * T337: 错误处理
   */
  private handleError(error: Error): void {
    if (this.ended) {
      return;
    }

    this.error = error;
    this.ended = true;

    this.callbacks.onError?.(error);
    this.emit('error', error);

    this.cleanup();
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * T334: 处理流式事件
   */
  async handleStreamEvent(event: any): Promise<void> {
    if (this.aborted || this.ended) {
      return;
    }

    this.updateActivity();

    // T339: 背压处理
    if (this.eventQueue.length >= this.maxQueueSize) {
      console.warn('Event queue full, dropping event');
      return;
    }

    this.eventQueue.push(event);

    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * T339: 处理事件队列（背压控制）
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.eventQueue.length > 0 && !this.aborted && !this.ended) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);

      // 让出事件循环
      await new Promise(resolve => setImmediate(resolve));
    }

    this.processing = false;
  }

  /**
   * 处理单个事件
   */
  private async processEvent(event: any): Promise<void> {
    try {
      const snapshot = this.updateMessageState(event);

      // T342: 发送 streamEvent 回调
      this.callbacks.onStreamEvent?.(event, snapshot);
      this.emit('streamEvent', event, snapshot);

      // 处理特定事件类型
      switch (event.type) {
        case 'content_block_delta':
          // delta 已在 updateMessageState 中处理
          break;

        case 'message_stop':
          this.handleMessageStop(snapshot);
          break;

        case 'content_block_stop':
          this.handleContentBlockStop(snapshot);
          break;

        case 'message_start':
        case 'content_block_start':
        case 'message_delta':
          // 已在 updateMessageState 中处理
          break;
      }
    } catch (error: any) {
      this.handleError(error);
    }
  }

  /**
   * 更新消息状态
   */
  private updateMessageState(event: any): MessageState {
    switch (event.type) {
      case 'message_start':
        this.currentMessage = event.message;
        return this.currentMessage;

      case 'content_block_start':
        if (!this.currentMessage) {
          throw new Error('Received content_block_start before message_start');
        }
        this.currentMessage.content.push(event.content_block);
        return this.currentMessage;

      case 'content_block_delta':
        return this.applyContentBlockDelta(event);

      case 'message_delta':
        return this.applyMessageDelta(event);

      case 'message_stop':
        return this.currentMessage!;

      case 'content_block_stop':
        return this.currentMessage!;

      default:
        return this.currentMessage!;
    }
  }

  /**
   * T335-T339: 应用内容块 delta
   */
  private applyContentBlockDelta(event: any): MessageState {
    if (!this.currentMessage) {
      throw new Error('Received content_block_delta before message_start');
    }

    const block = this.currentMessage.content[event.index];
    if (!block) {
      throw new Error(`Invalid content block index: ${event.index}`);
    }

    switch (event.delta.type) {
      case 'text_delta':
        this.applyTextDelta(event.index, event.delta);
        break;

      case 'thinking_delta':
        this.applyThinkingDelta(event.index, event.delta);
        break;

      case 'input_json_delta':
        this.applyInputJsonDelta(event.index, event.delta);
        break;

      case 'citations_delta':
        this.applyCitationsDelta(event.index, event.delta);
        break;

      case 'signature_delta':
        this.applySignatureDelta(event.index, event.delta);
        break;
    }

    return this.currentMessage;
  }

  /**
   * T335: 应用文本 delta
   */
  private applyTextDelta(index: number, delta: any): void {
    const block = this.currentMessage!.content[index] as TextContentBlock;

    if (block.type !== 'text') {
      return;
    }

    const oldText = block.text || '';
    block.text = oldText + delta.text;

    // T342: 发送文本回调
    this.callbacks.onText?.(delta.text, block.text);
    this.emit('text', delta.text, block.text);
  }

  /**
   * T336: 应用思考 delta
   */
  private applyThinkingDelta(index: number, delta: any): void {
    const block = this.currentMessage!.content[index] as ThinkingContentBlock;

    if (block.type !== 'thinking') {
      return;
    }

    block.thinking = block.thinking + delta.thinking;

    // T342: 发送思考回调
    this.callbacks.onThinking?.(delta.thinking, block.thinking);
    this.emit('thinking', delta.thinking, block.thinking);
  }

  /**
   * T337: 应用 input_json delta（容错解析）
   */
  private applyInputJsonDelta(index: number, delta: any): void {
    const block = this.currentMessage!.content[index] as ToolUseContentBlock;

    if (!this.isToolUseBlock(block)) {
      return;
    }

    // 获取或初始化 JSON 缓冲区
    let jsonBuffer = (block as any)[this.JSON_BUF_SYMBOL] || '';
    jsonBuffer += delta.partial_json;

    // 使用 Symbol 存储，不污染对象
    (block as any)[this.JSON_BUF_SYMBOL] = jsonBuffer;

    // 容错解析
    try {
      block.input = parseTolerantJSON(jsonBuffer);
    } catch (error) {
      console.warn('Failed to parse tool input JSON:', jsonBuffer, error);
      block.input = {};
    }

    // T342: 发送 inputJson 回调
    this.callbacks.onInputJson?.(delta.partial_json, block.input);
    this.emit('inputJson', delta.partial_json, block.input);
  }

  /**
   * T338: 应用 citations delta
   */
  private applyCitationsDelta(index: number, delta: any): void {
    const block = this.currentMessage!.content[index] as TextContentBlock;

    if (block.type !== 'text') {
      return;
    }

    if (!block.citations) {
      block.citations = [];
    }

    block.citations.push(delta.citation);

    // T342: 发送 citation 回调
    this.callbacks.onCitation?.(delta.citation, block.citations);
    this.emit('citation', delta.citation, block.citations);
  }

  /**
   * T339: 应用 signature delta
   */
  private applySignatureDelta(index: number, delta: any): void {
    const block = this.currentMessage!.content[index] as ThinkingContentBlock;

    if (block.type !== 'thinking') {
      return;
    }

    block.signature = delta.signature;

    // T342: 发送 signature 回调
    this.callbacks.onSignature?.(block.signature);
    this.emit('signature', block.signature);
  }

  /**
   * 应用消息 delta
   */
  private applyMessageDelta(event: any): MessageState {
    if (!this.currentMessage) {
      throw new Error('Received message_delta before message_start');
    }

    if (event.delta.stop_reason !== undefined) {
      this.currentMessage.stop_reason = event.delta.stop_reason;
    }

    if (event.delta.stop_sequence !== undefined) {
      this.currentMessage.stop_sequence = event.delta.stop_sequence;
    }

    if (event.usage) {
      if (event.usage.output_tokens !== undefined) {
        this.currentMessage.usage.output_tokens = event.usage.output_tokens;
      }

      if (event.usage.input_tokens !== undefined) {
        this.currentMessage.usage.input_tokens = event.usage.input_tokens;
      }

      if (event.usage.cache_creation_input_tokens !== undefined) {
        this.currentMessage.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
      }

      if (event.usage.cache_read_input_tokens !== undefined) {
        this.currentMessage.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
      }
    }

    return this.currentMessage;
  }

  /**
   * 处理内容块停止
   */
  private handleContentBlockStop(snapshot: MessageState): void {
    const lastBlock = snapshot.content[snapshot.content.length - 1];

    // T342: 发送 contentBlock 回调
    this.callbacks.onContentBlock?.(lastBlock);
    this.emit('contentBlock', lastBlock);
  }

  /**
   * 处理消息停止
   */
  private handleMessageStop(snapshot: MessageState): void {
    this.messages.push(snapshot);

    // T342: 发送 message 回调
    this.callbacks.onMessage?.(snapshot);
    this.emit('message', snapshot);

    // 标记完成
    this.ended = true;
    this.callbacks.onComplete?.();
    this.emit('complete');

    this.cleanup();
  }

  /**
   * 判断是否为工具使用块
   */
  private isToolUseBlock(block: ContentBlock): block is ToolUseContentBlock {
    return block.type === 'tool_use'
      || block.type === 'server_tool_use'
      || block.type === 'mcp_tool_use';
  }

  /**
   * 获取最终消息
   */
  getFinalMessage(): MessageState | null {
    return this.messages[this.messages.length - 1] || null;
  }

  /**
   * 获取最终文本
   */
  getFinalText(): string {
    const message = this.getFinalMessage();
    if (!message) {
      return '';
    }

    return message.content
      .filter((block): block is TextContentBlock => block.type === 'text')
      .map(block => block.text)
      .join(' ');
  }

  /**
   * 获取所有消息
   */
  getMessages(): MessageState[] {
    return [...this.messages];
  }

  /**
   * 检查是否已结束
   */
  isEnded(): boolean {
    return this.ended;
  }

  /**
   * 检查是否已中止
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * 获取错误
   */
  getError(): Error | null {
    return this.error;
  }
}
