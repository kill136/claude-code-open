/**
 * Claude API 客户端
 * 处理与 Anthropic API 的通信
 * 支持重试逻辑、token 计数、模型回退、Extended Thinking
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ContentBlock, ToolDefinition } from '../types/index.js';
import type { ProxyConfig, ProxyAgentOptions, TimeoutConfig } from '../network/index.js';
import { createProxyAgent } from '../network/index.js';
import {
  modelConfig,
  modelFallback,
  modelStats,
  thinkingManager,
  type ThinkingConfig,
  type ThinkingResult,
} from '../models/index.js';

export interface ClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  /** 代理配置 */
  proxy?: ProxyConfig;
  /** 代理 Agent 选项 */
  proxyOptions?: ProxyAgentOptions;
  /** 超时配置 */
  timeout?: number | TimeoutConfig;
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 回退模型 */
  fallbackModel?: string;
  /** Extended Thinking 配置 */
  thinking?: ThinkingConfig;
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
  /** 缓存读取 tokens */
  cacheReadTokens?: number;
  /** 缓存创建 tokens */
  cacheCreationTokens?: number;
  /** 思考 tokens */
  thinkingTokens?: number;
  /** API 调用耗时 */
  apiDurationMs?: number;
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
  private fallbackModel?: string;
  private debug: boolean;
  private totalUsage: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    thinkingTokens: 0,
    apiDurationMs: 0,
  };

  constructor(config: ClientConfig = {}) {
    // 准备 Anthropic 客户端配置
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      console.error('[ClaudeClient] ERROR: No API key found!');
      console.error('[ClaudeClient] Please set ANTHROPIC_API_KEY environment variable or provide apiKey in config');
    }

    const anthropicConfig: any = {
      apiKey,
      baseURL: config.baseUrl,
      maxRetries: 0, // 我们自己处理重试
    };

    // 配置代理（如果需要）
    const baseUrl = config.baseUrl || 'https://api.anthropic.com';
    const proxyAgent = createProxyAgent(
      baseUrl,
      config.proxy,
      {
        ...config.proxyOptions,
        timeout: typeof config.timeout === 'number' ? config.timeout : config.timeout?.connect,
      }
    );

    if (proxyAgent) {
      anthropicConfig.httpAgent = proxyAgent;
      if (config.debug) {
        console.log('[ClaudeClient] Using proxy agent for:', baseUrl);
      }
    }

    // 配置超时
    if (config.timeout) {
      const timeoutMs = typeof config.timeout === 'number'
        ? config.timeout
        : config.timeout.request || 120000;
      anthropicConfig.timeout = timeoutMs;
    }

    this.client = new Anthropic(anthropicConfig);
    this.debug = config.debug ?? false;

    // 解析模型别名
    const resolvedModel = modelConfig.resolveAlias(config.model || 'sonnet');
    this.model = resolvedModel;

    // 根据模型能力设置 maxTokens
    const capabilities = modelConfig.getCapabilities(this.model);
    this.maxTokens = config.maxTokens || Math.min(8192, capabilities.maxOutputTokens);

    this.maxRetries = config.maxRetries ?? 4;
    this.retryDelay = config.retryDelay ?? 1000;

    // 配置回退模型
    if (config.fallbackModel) {
      const resolvedFallback = modelConfig.resolveAlias(config.fallbackModel);
      if (resolvedFallback === this.model) {
        console.warn('Fallback model cannot be the same as primary model, ignoring');
      } else {
        this.fallbackModel = resolvedFallback;
        modelFallback.setPrimaryModel(this.model);
        modelFallback.setFallbackModel(this.fallbackModel);
      }
    }

    // 配置 Extended Thinking
    if (config.thinking) {
      thinkingManager.configure(config.thinking);
    }

    if (this.debug) {
      console.log(`[ClaudeClient] Initialized with model: ${this.model}`);
      console.log(`[ClaudeClient] Context window: ${capabilities.contextWindow.toLocaleString()} tokens`);
      console.log(`[ClaudeClient] Supports thinking: ${capabilities.supportsThinking}`);
      if (this.fallbackModel) {
        console.log(`[ClaudeClient] Fallback model: ${this.fallbackModel}`);
      }
    }
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
      const errorStatus = error.status || error.statusCode || '';
      const isRetryable = RETRYABLE_ERRORS.some(
        (e) => errorType.includes(e) || error.message?.includes(e)
      );

      // 详细的错误日志
      if (this.debug) {
        console.error('[ClaudeClient] API Error Details:');
        console.error(`  Type: ${errorType}`);
        console.error(`  Status: ${errorStatus}`);
        console.error(`  Message: ${error.message}`);
        if (error.error) {
          console.error(`  Error body: ${JSON.stringify(error.error, null, 2)}`);
        }
      }

      if (isRetryable && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount); // 指数退避
        console.error(
          `[ClaudeClient] API error (${errorType}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await this.sleep(delay);
        return this.withRetry(operation, retryCount + 1);
      }

      // 非重试错误，打印详细信息
      console.error(`[ClaudeClient] API request failed: ${error.message}`);
      if (errorStatus === 401) {
        console.error('[ClaudeClient] Authentication failed - check your API key');
      } else if (errorStatus === 403) {
        console.error('[ClaudeClient] Access denied - check API key permissions');
      } else if (errorStatus === 400) {
        console.error('[ClaudeClient] Bad request - check your request parameters');
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
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens?: number,
    cacheCreationTokens?: number,
    thinkingTokens?: number
  ): number {
    return modelConfig.calculateCost(this.model, {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      thinkingTokens,
    });
  }

  /**
   * 更新使用统计
   */
  private updateUsage(usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    thinkingTokens?: number;
    apiDurationMs?: number;
  }): void {
    this.totalUsage.inputTokens += usage.inputTokens;
    this.totalUsage.outputTokens += usage.outputTokens;
    this.totalUsage.totalTokens += usage.inputTokens + usage.outputTokens;
    this.totalUsage.cacheReadTokens = (this.totalUsage.cacheReadTokens || 0) + (usage.cacheReadTokens || 0);
    this.totalUsage.cacheCreationTokens = (this.totalUsage.cacheCreationTokens || 0) + (usage.cacheCreationTokens || 0);
    this.totalUsage.thinkingTokens = (this.totalUsage.thinkingTokens || 0) + (usage.thinkingTokens || 0);
    this.totalUsage.apiDurationMs = (this.totalUsage.apiDurationMs || 0) + (usage.apiDurationMs || 0);
    this.totalUsage.estimatedCost += this.calculateCost(
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadTokens,
      usage.cacheCreationTokens,
      usage.thinkingTokens
    );

    // 同步到全局模型统计
    modelStats.record(this.model, usage);
  }

  async createMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
    options?: {
      enableThinking?: boolean;
      thinkingBudget?: number;
    }
  ): Promise<{
    content: ContentBlock[];
    stopReason: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      thinkingTokens?: number;
    };
    thinking?: ThinkingResult;
    model: string;
  }> {
    const startTime = Date.now();

    // 准备 Extended Thinking 参数
    const thinkingParams = options?.enableThinking
      ? thinkingManager.getThinkingParams(this.model)
      : {};

    // 如果指定了思考预算，覆盖默认值
    if (options?.thinkingBudget && thinkingParams.thinking) {
      thinkingParams.thinking.budget_tokens = options.thinkingBudget;
    }

    // 使用回退机制执行请求
    const executeRequest = async (currentModel: string) => {
      return await this.withRetry(async () => {
        const requestParams: any = {
          model: currentModel,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          tools: tools?.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
          })),
          ...thinkingParams,
        };

        return await this.client.messages.create(requestParams);
      });
    };

    let response: any;
    let usedModel = this.model;

    if (this.fallbackModel) {
      const result = await modelFallback.executeWithFallback(executeRequest, {
        onRetry: (model, attempt, error) => {
          if (this.debug) {
            console.log(`[ClaudeClient] Retry ${attempt} for ${model}: ${error.message}`);
          }
        },
        onFallback: (from, to, error) => {
          console.warn(`[ClaudeClient] Falling back from ${from} to ${to}: ${error.message}`);
        },
      });
      response = result.result;
      usedModel = result.model;
    } else {
      response = await executeRequest(this.model);
    }

    const apiDurationMs = Date.now() - startTime;

    // 提取使用统计
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens,
      thinkingTokens: 0,
      apiDurationMs,
    };

    // 处理 Extended Thinking 响应
    let thinkingResult: ThinkingResult | undefined;
    if (response.thinking) {
      usage.thinkingTokens = response.thinking_tokens || 0;
      thinkingResult = thinkingManager.processThinkingResponse(
        {
          thinking: response.thinking,
          thinking_tokens: response.thinking_tokens,
        },
        startTime
      ) || undefined;
    }

    this.updateUsage(usage);

    return {
      content: response.content as ContentBlock[],
      stopReason: response.stop_reason || 'end_turn',
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        thinkingTokens: usage.thinkingTokens,
      },
      thinking: thinkingResult,
      model: usedModel,
    };
  }

  async *createMessageStream(
    messages: Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
    options?: {
      enableThinking?: boolean;
      thinkingBudget?: number;
    }
  ): AsyncGenerator<{
    type: 'text' | 'thinking' | 'tool_use_start' | 'tool_use_delta' | 'stop' | 'usage' | 'error';
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: string;
    stopReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      thinkingTokens?: number;
    };
    error?: string;
  }> {
    let stream: any;

    try {
      if (this.debug) {
        console.log('[ClaudeClient] Starting message stream...');
        console.log(`[ClaudeClient] Model: ${this.model}, MaxTokens: ${this.maxTokens}`);
        console.log(`[ClaudeClient] Messages: ${messages.length}, Tools: ${tools?.length || 0}`);
      }

      // 准备 Extended Thinking 参数
      const thinkingParams = options?.enableThinking
        ? thinkingManager.getThinkingParams(this.model)
        : {};

      // 如果指定了思考预算，覆盖默认值
      if (options?.thinkingBudget && thinkingParams.thinking) {
        thinkingParams.thinking.budget_tokens = options.thinkingBudget;
      }

      stream = this.client.messages.stream({
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
        ...thinkingParams,
      });
    } catch (error: any) {
      console.error('[ClaudeClient] Failed to create stream:', error.message);
      yield { type: 'error', error: error.message };
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let thinkingTokens = 0;

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'text_delta') {
            yield { type: 'text', text: delta.text };
          } else if (delta.type === 'thinking_delta') {
            // Extended Thinking delta
            yield { type: 'thinking', thinking: delta.thinking };
          } else if (delta.type === 'input_json_delta') {
            yield { type: 'tool_use_delta', input: delta.partial_json };
          }
        } else if (event.type === 'content_block_start') {
          const block = event.content_block as any;
          if (block.type === 'tool_use') {
            yield { type: 'tool_use_start', id: block.id, name: block.name };
          } else if (block.type === 'thinking') {
            // Extended Thinking block started
            if (this.debug) {
              console.log('[ClaudeClient] Extended Thinking block started');
            }
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
            cacheReadTokens = msg.usage.cache_read_input_tokens || 0;
            cacheCreationTokens = msg.usage.cache_creation_input_tokens || 0;
          }
        } else if (event.type === 'message_stop') {
          // 从最终消息中获取 thinking_tokens
          const finalMessage = await stream.finalMessage();
          if (finalMessage?.usage) {
            thinkingTokens = (finalMessage.usage as any).thinking_tokens || 0;
          }

          this.updateUsage({
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            thinkingTokens,
          });

          yield {
            type: 'usage',
            usage: {
              inputTokens,
              outputTokens,
              cacheReadTokens,
              cacheCreationTokens,
              thinkingTokens,
            },
          };
          yield { type: 'stop' };
        } else if (event.type === 'error') {
          const errorEvent = event as any;
          console.error('[ClaudeClient] Stream error event:', errorEvent.error);
          yield { type: 'error', error: errorEvent.error?.message || 'Unknown stream error' };
        }
      }
    } catch (error: any) {
      console.error('[ClaudeClient] Stream processing error:', error.message);
      if (this.debug) {
        console.error('[ClaudeClient] Full error:', error);
      }
      yield { type: 'error', error: error.message };
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
