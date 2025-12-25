/**
 * 模型回退机制
 * 实现自动切换到备用模型
 */

import type { FallbackConfig, ModelSwitchEvent } from './types.js';
import { ModelFallbackError } from './types.js';
import { modelConfig } from './config.js';

/**
 * 可重试的错误类型
 */
const DEFAULT_RETRYABLE_ERRORS = [
  'overloaded_error',
  'rate_limit_error',
  'api_error',
  'timeout',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'capacity_exceeded',
  'model_unavailable',
];

/**
 * 模型回退管理器
 */
export class ModelFallback {
  private config: FallbackConfig;
  private switchHistory: ModelSwitchEvent[] = [];
  private listeners: Array<(event: ModelSwitchEvent) => void> = [];

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      primaryModel: config?.primaryModel || modelConfig.getDefaultModel(),
      fallbackModel: config?.fallbackModel,
      retryableErrors: config?.retryableErrors || DEFAULT_RETRYABLE_ERRORS,
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      exponentialBackoff: config?.exponentialBackoff ?? true,
    };
  }

  /**
   * 设置主模型
   */
  setPrimaryModel(model: string): void {
    if (model === this.config.fallbackModel) {
      throw new Error('Primary model cannot be the same as fallback model');
    }
    this.config.primaryModel = modelConfig.resolveAlias(model);
  }

  /**
   * 设置回退模型
   */
  setFallbackModel(model: string | undefined): void {
    if (model === this.config.primaryModel) {
      throw new Error('Fallback model cannot be the same as primary model');
    }
    this.config.fallbackModel = model ? modelConfig.resolveAlias(model) : undefined;
  }

  /**
   * 获取当前配置
   */
  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  /**
   * 检查错误是否可重试
   */
  isRetryable(error: Error | unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    const errorType = (error as any).type || (error as any).code || '';

    return this.config.retryableErrors.some(
      (retryable) =>
        errorMessage.includes(retryable.toLowerCase()) ||
        errorType.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  /**
   * 计算重试延迟
   */
  private getRetryDelay(attempt: number): number {
    if (this.config.exponentialBackoff) {
      return this.config.retryDelayMs * Math.pow(2, attempt);
    }
    return this.config.retryDelayMs;
  }

  /**
   * 等待
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 执行带回退的操作
   */
  async executeWithFallback<T>(
    operation: (model: string) => Promise<T>,
    options?: {
      onRetry?: (model: string, attempt: number, error: Error) => void;
      onFallback?: (fromModel: string, toModel: string, error: Error) => void;
    }
  ): Promise<{ result: T; model: string; retries: number; usedFallback: boolean }> {
    const { primaryModel, fallbackModel, maxRetries } = this.config;
    let lastError: Error | null = null;
    let retryCount = 0;
    let currentModel = primaryModel;
    let usedFallback = false;

    // 尝试主模型
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation(currentModel);
        return {
          result,
          model: currentModel,
          retries: retryCount,
          usedFallback,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (this.isRetryable(error) && attempt < maxRetries) {
          const delay = this.getRetryDelay(attempt);

          if (options?.onRetry) {
            options.onRetry(currentModel, attempt + 1, lastError);
          }

          console.warn(
            `API error (${lastError.message}), retrying in ${delay}ms... ` +
            `(attempt ${attempt + 1}/${maxRetries})`
          );

          await this.sleep(delay);
          continue;
        }

        // 主模型失败，尝试回退模型
        if (currentModel === primaryModel && fallbackModel && this.isRetryable(error)) {
          currentModel = fallbackModel;
          usedFallback = true;

          if (options?.onFallback) {
            options.onFallback(primaryModel, fallbackModel, lastError);
          }

          // 记录切换事件
          this.recordSwitch({
            fromModel: primaryModel,
            toModel: fallbackModel,
            reason: 'fallback',
            timestamp: Date.now(),
            error: lastError.message,
          });

          console.warn(
            `Primary model ${primaryModel} failed, falling back to ${fallbackModel}`
          );

          // 重置重试计数，使用回退模型重试
          attempt = -1;
          continue;
        }

        break;
      }
    }

    // 所有尝试都失败
    throw new ModelFallbackError(lastError!, undefined, retryCount);
  }

  /**
   * 记录模型切换事件
   */
  private recordSwitch(event: ModelSwitchEvent): void {
    this.switchHistory.push(event);

    // 保留最近 100 条记录
    if (this.switchHistory.length > 100) {
      this.switchHistory = this.switchHistory.slice(-100);
    }

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.warn('Model switch listener error:', e);
      }
    }
  }

  /**
   * 获取切换历史
   */
  getSwitchHistory(): ModelSwitchEvent[] {
    return [...this.switchHistory];
  }

  /**
   * 添加切换事件监听器
   */
  onSwitch(listener: (event: ModelSwitchEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.switchHistory = [];
  }

  /**
   * 获取回退统计
   */
  getStats(): {
    totalSwitches: number;
    fallbackRate: number;
    mostRecentSwitch: ModelSwitchEvent | null;
    switchesByModel: Record<string, number>;
  } {
    const switchesByModel: Record<string, number> = {};

    for (const event of this.switchHistory) {
      switchesByModel[event.fromModel] = (switchesByModel[event.fromModel] || 0) + 1;
    }

    return {
      totalSwitches: this.switchHistory.length,
      fallbackRate: this.switchHistory.length > 0
        ? this.switchHistory.filter(e => e.reason === 'fallback').length / this.switchHistory.length
        : 0,
      mostRecentSwitch: this.switchHistory.length > 0
        ? this.switchHistory[this.switchHistory.length - 1]
        : null,
      switchesByModel,
    };
  }
}

/**
 * 全局模型回退实例
 */
export const modelFallback = new ModelFallback();
