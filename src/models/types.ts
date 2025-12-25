/**
 * 模型配置类型定义
 */

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 显示名称 */
  displayName: string;
  /** 模型别名 */
  aliases: string[];
  /** 上下文窗口大小 (tokens) */
  contextWindow: number;
  /** 最大输出 tokens */
  maxOutputTokens: number;
  /** 是否支持 Extended Thinking */
  supportsThinking: boolean;
  /** 是否支持工具调用 */
  supportsTools: boolean;
  /** 是否支持视觉 */
  supportsVision: boolean;
  /** 是否支持 PDF */
  supportsPdf: boolean;
  /** 是否支持缓存 */
  supportsCaching: boolean;
  /** 模型家族 */
  family: 'opus' | 'sonnet' | 'haiku';
  /** 发布日期 */
  releaseDate?: string;
}

/**
 * 模型能力
 */
export interface ModelCapabilities {
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 最大输出 tokens */
  maxOutputTokens: number;
  /** 是否支持 Extended Thinking */
  supportsThinking: boolean;
  /** 是否支持工具调用 */
  supportsTools: boolean;
  /** 是否支持视觉 */
  supportsVision: boolean;
  /** 是否支持 PDF */
  supportsPdf: boolean;
  /** 是否支持缓存 */
  supportsCaching: boolean;
  /** 思考预算范围 */
  thinkingBudgetRange?: {
    min: number;
    max: number;
    default: number;
  };
}

/**
 * 模型定价
 */
export interface ModelPricing {
  /** 输入价格 (每 1M tokens) */
  input: number;
  /** 输出价格 (每 1M tokens) */
  output: number;
  /** 缓存读取价格 (每 1M tokens) */
  cacheRead?: number;
  /** 缓存创建价格 (每 1M tokens) */
  cacheCreate?: number;
  /** 思考 tokens 价格 (每 1M tokens) */
  thinking?: number;
}

/**
 * Extended Thinking 配置
 */
export interface ThinkingConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 思考预算 (tokens) */
  budgetTokens?: number;
  /** 是否显示思考过程 */
  showThinking?: boolean;
  /** 思考超时 (ms) */
  timeout?: number;
}

/**
 * Extended Thinking 结果
 */
export interface ThinkingResult {
  /** 思考内容 */
  thinking: string;
  /** 思考使用的 tokens */
  thinkingTokens: number;
  /** 思考耗时 (ms) */
  thinkingTimeMs: number;
  /** 是否达到预算限制 */
  budgetExhausted: boolean;
}

/**
 * 模型使用统计
 */
export interface ModelUsageStats {
  /** 输入 tokens */
  inputTokens: number;
  /** 输出 tokens */
  outputTokens: number;
  /** 缓存读取 tokens */
  cacheReadTokens: number;
  /** 缓存创建 tokens */
  cacheCreationTokens: number;
  /** 思考 tokens */
  thinkingTokens: number;
  /** Web 搜索请求数 */
  webSearchRequests: number;
  /** 成本 (USD) */
  costUSD: number;
  /** 上下文窗口使用率 */
  contextWindowUsage: number;
  /** API 调用次数 */
  apiCalls: number;
  /** API 总耗时 (ms) */
  apiDurationMs: number;
  /** 工具调用总耗时 (ms) */
  toolDurationMs: number;
}

/**
 * 回退配置
 */
export interface FallbackConfig {
  /** 主模型 */
  primaryModel: string;
  /** 回退模型 */
  fallbackModel?: string;
  /** 启用回退的错误类型 */
  retryableErrors: string[];
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟 (ms) */
  retryDelayMs: number;
  /** 是否指数退避 */
  exponentialBackoff: boolean;
}

/**
 * 模型切换事件
 */
export interface ModelSwitchEvent {
  /** 原模型 */
  fromModel: string;
  /** 新模型 */
  toModel: string;
  /** 原因 */
  reason: 'fallback' | 'manual' | 'capacity';
  /** 时间戳 */
  timestamp: number;
  /** 错误信息 (如果是回退) */
  error?: string;
}

/**
 * 回退错误
 */
export class ModelFallbackError extends Error {
  constructor(
    public readonly primaryError: Error,
    public readonly fallbackError?: Error,
    public readonly attempts: number = 1,
    message?: string
  ) {
    super(
      message ||
        `Model fallback failed after ${attempts} attempts. ` +
        `Primary: ${primaryError.message}` +
        (fallbackError ? `. Fallback: ${fallbackError.message}` : '')
    );
    this.name = 'ModelFallbackError';
  }
}

/**
 * Extended Thinking 不支持错误
 */
export class ThinkingNotSupportedError extends Error {
  constructor(public readonly modelId: string) {
    super(`Extended thinking is not supported by model ${modelId}`);
    this.name = 'ThinkingNotSupportedError';
  }
}

/**
 * 配额类型
 */
export type QuotaType = 'cost' | 'tokens' | 'requests';

/**
 * 预警级别
 */
export type AlertLevel = 'info' | 'warning' | 'critical' | 'exceeded';

/**
 * 成本预警配置
 */
export interface CostAlert {
  /** 阈值 (如 $1.00 或 50% 用量) */
  threshold: number;
  /** 触发动作 */
  action: 'warn' | 'pause' | 'stop';
  /** 预警消息 */
  message: string;
  /** 预警级别 */
  level: AlertLevel;
}

/**
 * 配额限制配置
 */
export interface QuotaLimit {
  /** 成本限制 (USD) */
  maxCost?: number;
  /** Token 限制 */
  maxTokens?: number;
  /** 请求次数限制 */
  maxRequests?: number;
}

/**
 * 使用情况
 */
export interface UsageInfo {
  /** 当前成本 (USD) */
  currentCost: number;
  /** 当前 tokens */
  currentTokens: number;
  /** 当前请求次数 */
  currentRequests: number;
  /** 成本限制 */
  maxCost?: number;
  /** Token 限制 */
  maxTokens?: number;
  /** 请求限制 */
  maxRequests?: number;
}

/**
 * 预算状态
 */
export interface BudgetStatus {
  /** 配额类型 */
  type: QuotaType;
  /** 当前使用量 */
  current: number;
  /** 最大限制 */
  limit: number;
  /** 使用百分比 (0-100) */
  percentage: number;
  /** 剩余预算 */
  remaining: number;
  /** 预警级别 */
  alertLevel: AlertLevel;
  /** 是否超出限制 */
  exceeded: boolean;
}

/**
 * 阈值回调函数
 */
export type ThresholdCallback = (alert: CostAlert, status: BudgetStatus) => void;

/**
 * 限制超出回调函数
 */
export type LimitExceededCallback = (type: QuotaType, status: BudgetStatus) => void;
