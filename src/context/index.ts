/**
 * 上下文管理系统
 * 处理对话历史、上下文窗口和自动摘要
 */

import type { Message, ContentBlock } from '../types/index.js';

// Token 估算常量
const CHARS_PER_TOKEN = 4; // 粗略估算
const MAX_CONTEXT_TOKENS = 180000; // Claude 3.5 的上下文窗口
const RESERVE_TOKENS = 8192; // 保留给输出

export interface ContextConfig {
  maxTokens?: number;
  reserveTokens?: number;
  summarizeThreshold?: number; // 何时开始摘要
  keepRecentMessages?: number; // 保留最近多少条消息
}

export interface ContextStats {
  totalMessages: number;
  estimatedTokens: number;
  summarizedMessages: number;
  compressionRatio: number;
}

export interface ConversationTurn {
  user: Message;
  assistant: Message;
  timestamp: number;
  tokenEstimate: number;
  summarized?: boolean;
  summary?: string;
}

/**
 * 估算文本 token 数
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 估算消息 token 数
 */
export function estimateMessageTokens(message: Message): number {
  if (typeof message.content === 'string') {
    return estimateTokens(message.content) + 10; // 额外的消息开销
  }

  let total = 10; // 消息开销

  for (const block of message.content) {
    if (block.type === 'text') {
      total += estimateTokens(block.text);
    } else if (block.type === 'tool_use') {
      total += estimateTokens(block.name) + estimateTokens(JSON.stringify(block.input));
    } else if (block.type === 'tool_result') {
      const content = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content);
      total += estimateTokens(content);
    } else if (block.type === 'image') {
      // 图片按固定大小估算
      total += 1000;
    }
  }

  return total;
}

/**
 * 估算消息数组的总 token 数
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * 提取消息的核心内容用于摘要
 */
function extractMessageCore(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  const parts: string[] = [];

  for (const block of message.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'tool_use') {
      parts.push(`[Used tool: ${block.name}]`);
    } else if (block.type === 'tool_result') {
      const content = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content);
      // 只保留工具结果的摘要
      parts.push(`[Tool result: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}]`);
    }
  }

  return parts.join('\n');
}

/**
 * 创建对话摘要
 */
export function createSummary(turns: ConversationTurn[]): string {
  const summaryParts: string[] = ['Summary of previous conversation:'];

  for (const turn of turns) {
    const userContent = extractMessageCore(turn.user).slice(0, 200);
    const assistantContent = extractMessageCore(turn.assistant).slice(0, 300);

    summaryParts.push(`- User: ${userContent}`);
    summaryParts.push(`  Assistant: ${assistantContent}`);
  }

  return summaryParts.join('\n');
}

/**
 * 上下文管理器
 */
export class ContextManager {
  private config: Required<ContextConfig>;
  private turns: ConversationTurn[] = [];
  private systemPrompt: string = '';

  constructor(config: ContextConfig = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? MAX_CONTEXT_TOKENS,
      reserveTokens: config.reserveTokens ?? RESERVE_TOKENS,
      summarizeThreshold: config.summarizeThreshold ?? 0.7, // 70% 时开始摘要
      keepRecentMessages: config.keepRecentMessages ?? 10,
    };
  }

  /**
   * 设置系统提示
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * 添加对话轮次
   */
  addTurn(user: Message, assistant: Message): void {
    const tokenEstimate = estimateMessageTokens(user) + estimateMessageTokens(assistant);

    this.turns.push({
      user,
      assistant,
      timestamp: Date.now(),
      tokenEstimate,
    });

    // 检查是否需要压缩
    this.maybeCompress();
  }

  /**
   * 获取当前上下文的消息
   */
  getMessages(): Message[] {
    const messages: Message[] = [];

    // 添加摘要消息（如果有）
    const summarizedTurns = this.turns.filter((t) => t.summarized);
    if (summarizedTurns.length > 0) {
      const summary = createSummary(summarizedTurns);
      messages.push({
        role: 'user',
        content: summary,
      });
      messages.push({
        role: 'assistant',
        content: 'I understand. I\'ll keep this context in mind.',
      });
    }

    // 添加非摘要的消息
    const recentTurns = this.turns.filter((t) => !t.summarized);
    for (const turn of recentTurns) {
      messages.push(turn.user);
      messages.push(turn.assistant);
    }

    return messages;
  }

  /**
   * 获取可用的 token 数
   */
  getAvailableTokens(): number {
    const used = this.getUsedTokens();
    return this.config.maxTokens - this.config.reserveTokens - used;
  }

  /**
   * 获取已使用的 token 数
   */
  getUsedTokens(): number {
    let total = estimateTokens(this.systemPrompt);

    for (const turn of this.turns) {
      if (turn.summarized && turn.summary) {
        total += estimateTokens(turn.summary);
      } else {
        total += turn.tokenEstimate;
      }
    }

    return total;
  }

  /**
   * 检查并执行压缩
   */
  private maybeCompress(): void {
    const threshold = this.config.maxTokens * this.config.summarizeThreshold;
    const used = this.getUsedTokens();

    if (used < threshold) {
      return;
    }

    // 标记旧消息为需要摘要
    const recentCount = this.config.keepRecentMessages;
    const toSummarize = this.turns.slice(0, -recentCount);

    for (const turn of toSummarize) {
      if (!turn.summarized) {
        turn.summarized = true;
        turn.summary = createSummary([turn]);
      }
    }
  }

  /**
   * 强制压缩
   */
  compact(): void {
    const recentCount = this.config.keepRecentMessages;

    if (this.turns.length <= recentCount) {
      return;
    }

    const toSummarize = this.turns.slice(0, -recentCount);

    for (const turn of toSummarize) {
      if (!turn.summarized) {
        turn.summarized = true;
        turn.summary = createSummary([turn]);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): ContextStats {
    const summarized = this.turns.filter((t) => t.summarized).length;

    const originalTokens = this.turns.reduce((sum, t) => sum + t.tokenEstimate, 0);
    const currentTokens = this.getUsedTokens();

    return {
      totalMessages: this.turns.length * 2, // user + assistant
      estimatedTokens: currentTokens,
      summarizedMessages: summarized * 2,
      compressionRatio: originalTokens > 0 ? currentTokens / originalTokens : 1,
    };
  }

  /**
   * 清除所有历史
   */
  clear(): void {
    this.turns = [];
  }

  /**
   * 导出为可序列化格式
   */
  export(): {
    systemPrompt: string;
    turns: ConversationTurn[];
    config: Required<ContextConfig>;
  } {
    return {
      systemPrompt: this.systemPrompt,
      turns: this.turns,
      config: this.config,
    };
  }

  /**
   * 从导出数据恢复
   */
  import(data: {
    systemPrompt: string;
    turns: ConversationTurn[];
    config?: ContextConfig;
  }): void {
    this.systemPrompt = data.systemPrompt;
    this.turns = data.turns;
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
  }
}

/**
 * 智能裁剪消息数组以适应 token 限制
 */
export function truncateMessages(
  messages: Message[],
  maxTokens: number,
  keepFirst: number = 2,
  keepLast: number = 10
): Message[] {
  let totalTokens = estimateTotalTokens(messages);

  if (totalTokens <= maxTokens) {
    return messages;
  }

  // 保护首尾消息
  const firstMessages = messages.slice(0, keepFirst);
  const lastMessages = messages.slice(-keepLast);
  const middleMessages = messages.slice(keepFirst, -keepLast);

  // 逐步移除中间消息
  const result = [...firstMessages];
  let currentTokens = estimateTotalTokens(firstMessages) + estimateTotalTokens(lastMessages);

  for (const msg of middleMessages) {
    const msgTokens = estimateMessageTokens(msg);
    if (currentTokens + msgTokens <= maxTokens) {
      result.push(msg);
      currentTokens += msgTokens;
    }
  }

  result.push(...lastMessages);
  return result;
}

/**
 * 裁剪单条消息的内容
 */
export function truncateMessageContent(
  message: Message,
  maxTokens: number
): Message {
  if (typeof message.content === 'string') {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (message.content.length <= maxChars) {
      return message;
    }
    return {
      ...message,
      content: message.content.slice(0, maxChars) + '\n[Content truncated...]',
    };
  }

  // 对于数组内容，裁剪每个块
  const truncatedBlocks: ContentBlock[] = [];
  let remainingTokens = maxTokens;

  for (const block of message.content) {
    if (remainingTokens <= 0) {
      break;
    }

    if (block.type === 'text') {
      const maxChars = remainingTokens * CHARS_PER_TOKEN;
      if (block.text.length <= maxChars) {
        truncatedBlocks.push(block);
        remainingTokens -= estimateTokens(block.text);
      } else {
        truncatedBlocks.push({
          type: 'text',
          text: block.text.slice(0, maxChars) + '\n[Content truncated...]',
        });
        remainingTokens = 0;
      }
    } else if (block.type === 'tool_result') {
      const content = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content);
      const maxChars = remainingTokens * CHARS_PER_TOKEN;

      if (content.length <= maxChars) {
        truncatedBlocks.push(block);
        remainingTokens -= estimateTokens(content);
      } else {
        truncatedBlocks.push({
          ...block,
          content: content.slice(0, maxChars) + '\n[Output truncated...]',
        });
        remainingTokens = 0;
      }
    } else {
      // 保留其他类型的块
      truncatedBlocks.push(block);
      remainingTokens -= 100; // 估算
    }
  }

  return {
    ...message,
    content: truncatedBlocks,
  };
}

// 默认实例
export const contextManager = new ContextManager();
