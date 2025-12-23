/**
 * Claude API 客户端
 * 处理与 Anthropic API 的通信
 * 支持重试逻辑和 token 计数
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ContentBlock, ToolDefinition } from '../types/index.js';

export interface ClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (id: string, name: string, input: unknown) => void;
  onToolResult?: (id: string, result: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// 模型价格 (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
};

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

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private maxRetries: number;
  private retryDelay: number;
  private totalUsage: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };

  constructor(config: ClientConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
      baseURL: config.baseUrl,
      maxRetries: 0, // 我们自己处理重试
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 8192;
    this.maxRetries = config.maxRetries ?? 4;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  /**
   * 执行带重试的请求
   */
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 计算估算成本
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[this.model] || { input: 3, output: 15 };
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * 更新使用统计
   */
  private updateUsage(inputTokens: number, outputTokens: number): void {
    this.totalUsage.inputTokens += inputTokens;
    this.totalUsage.outputTokens += outputTokens;
    this.totalUsage.totalTokens += inputTokens + outputTokens;
    this.totalUsage.estimatedCost += this.calculateCost(inputTokens, outputTokens);
  }

  async createMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string
  ): Promise<{
    content: ContentBlock[];
    stopReason: string;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    const response = await this.withRetry(async () => {
      return await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) as any,
        tools: tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })) as any,
      });
    });

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    this.updateUsage(usage.inputTokens, usage.outputTokens);

    return {
      content: response.content as ContentBlock[],
      stopReason: response.stop_reason || 'end_turn',
      usage,
    };
  }

  async *createMessageStream(
    messages: Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string
  ): AsyncGenerator<{
    type: 'text' | 'tool_use_start' | 'tool_use_delta' | 'stop' | 'usage';
    text?: string;
    id?: string;
    name?: string;
    input?: string;
    stopReason?: string;
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })) as any,
      tools: tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })) as any,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.type === 'text_delta') {
          yield { type: 'text', text: delta.text };
        } else if (delta.type === 'input_json_delta') {
          yield { type: 'tool_use_delta', input: delta.partial_json };
        }
      } else if (event.type === 'content_block_start') {
        const block = event.content_block as any;
        if (block.type === 'tool_use') {
          yield { type: 'tool_use_start', id: block.id, name: block.name };
        }
      } else if (event.type === 'message_delta') {
        const delta = event as any;
        if (delta.usage) {
          outputTokens = delta.usage.output_tokens || 0;
        }
      } else if (event.type === 'message_start') {
        const msg = (event as any).message;
        if (msg?.usage) {
          inputTokens = msg.usage.input_tokens || 0;
        }
      } else if (event.type === 'message_stop') {
        this.updateUsage(inputTokens, outputTokens);
        yield {
          type: 'usage',
          usage: { inputTokens, outputTokens },
        };
        yield { type: 'stop' };
      }
    }
  }

  /**
   * 获取总使用统计
   */
  getUsageStats(): UsageStats {
    return { ...this.totalUsage };
  }

  /**
   * 获取格式化的成本字符串
   */
  getFormattedCost(): string {
    if (this.totalUsage.estimatedCost < 0.01) {
      return `$${(this.totalUsage.estimatedCost * 100).toFixed(2)}¢`;
    }
    return `$${this.totalUsage.estimatedCost.toFixed(4)}`;
  }

  /**
   * 重置使用统计
   */
  resetUsageStats(): void {
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  setMaxTokens(tokens: number): void {
    this.maxTokens = tokens;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }
}

// 默认客户端实例
export const defaultClient = new ClaudeClient();
