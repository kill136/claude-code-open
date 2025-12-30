/**
 * 重试机制工具
 * 提供指数退避重试、超时控制等功能
 */

import {
  ErrorCode,
  ToolTimeoutError,
  isRetryableError,
  type ClaudeError,
} from '../types/errors.js';

/**
 * 重试选项
 */
export interface RetryOptions {
  /** 最大重试次数 (默认: 3) */
  maxRetries?: number;
  /** 初始延迟时间 (毫秒, 默认: 1000) */
  initialDelay?: number;
  /** 最大延迟时间 (毫秒, 默认: 30000) */
  maxDelay?: number;
  /** 退避因子 (默认: 2) */
  backoffFactor?: number;
  /** 可重试的错误代码列表 */
  retryableErrors?: ErrorCode[];
  /** 重试前的回调函数 */
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
  /** 是否使用抖动 (默认: true) */
  useJitter?: boolean;
}

/**
 * 超时选项
 */
export interface TimeoutOptions {
  /** 超时时间 (毫秒) */
  timeout: number;
  /** 超时回调函数 (可选) */
  onTimeout?: () => void | Promise<void>;
  /** 工具名称 (用于错误消息) */
  toolName?: string;
}

/**
 * 计算重试延迟时间 (指数退避 + 抖动)
 */
export function calculateRetryDelay(
  attempt: number,
  options: Required<Pick<RetryOptions, 'initialDelay' | 'maxDelay' | 'backoffFactor' | 'useJitter'>>
): number {
  const { initialDelay, maxDelay, backoffFactor, useJitter } = options;

  // 指数退避: delay = initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelay * Math.pow(backoffFactor, attempt - 1);

  // 限制最大延迟
  delay = Math.min(delay, maxDelay);

  // 添加抖动 (±25%)
  if (useJitter) {
    const jitter = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitter;
  }

  return Math.max(0, Math.floor(delay));
}

/**
 * 判断错误是否可重试
 */
export function isErrorRetryable(
  error: unknown,
  retryableErrors?: ErrorCode[]
): boolean {
  // 1. 检查是否为 ClaudeError 并具有 retryable 标志
  if (isRetryableError(error)) {
    return true;
  }

  // 2. 检查是否在自定义可重试错误列表中
  if (retryableErrors && retryableErrors.length > 0) {
    const claudeError = error as ClaudeError;
    if (claudeError.code && retryableErrors.includes(claudeError.code)) {
      return true;
    }
  }

  // 3. 检查特定的 Node.js 错误
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    const retryableNodeErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'EAGAIN',
      'EBUSY',
    ];
    if (nodeError.code && retryableNodeErrors.includes(nodeError.code)) {
      return true;
    }
  }

  return false;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的函数执行装饰器
 */
export async function withRetry<T>(
  execute: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryableErrors,
    onRetry,
    useJitter = true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await execute();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果是最后一次尝试,直接抛出错误
      if (attempt > maxRetries) {
        throw lastError;
      }

      // 检查错误是否可重试
      if (!isErrorRetryable(error, retryableErrors)) {
        throw lastError;
      }

      // 计算重试延迟
      const retryDelay = calculateRetryDelay(attempt, {
        initialDelay,
        maxDelay,
        backoffFactor,
        useJitter,
      });

      // 调用重试回调
      if (onRetry) {
        await onRetry(attempt, lastError);
      }

      // 等待后重试
      await delay(retryDelay);
    }
  }

  // 这行代码理论上不会执行到,但为了类型安全
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * 带超时的函数执行装饰器
 */
export async function withTimeout<T>(
  execute: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeout, onTimeout, toolName } = options;

  return new Promise<T>((resolve, reject) => {
    let isResolved = false;
    let timeoutId: NodeJS.Timeout | undefined;

    // 设置超时计时器
    timeoutId = setTimeout(async () => {
      if (!isResolved) {
        isResolved = true;

        // 调用超时回调
        if (onTimeout) {
          try {
            await onTimeout();
          } catch (err) {
            // 忽略回调错误
          }
        }

        reject(
          new ToolTimeoutError(
            `Operation timed out after ${timeout}ms`,
            toolName,
            timeout
          )
        );
      }
    }, timeout);

    // 执行主函数
    execute()
      .then((result) => {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        }
      });
  });
}

/**
 * 同时支持重试和超时的函数执行装饰器
 */
export async function withRetryAndTimeout<T>(
  execute: () => Promise<T>,
  retryOptions: RetryOptions = {},
  timeoutOptions?: TimeoutOptions
): Promise<T> {
  // 如果没有超时选项,只使用重试
  if (!timeoutOptions) {
    return withRetry(execute, retryOptions);
  }

  // 同时使用重试和超时
  return withRetry(
    () => withTimeout(execute, timeoutOptions),
    retryOptions
  );
}

/**
 * 动态超时调整器
 * 根据历史执行时间动态调整超时时间
 */
export class DynamicTimeoutAdjuster {
  private executionTimes: number[] = [];
  private readonly maxHistorySize: number;
  private readonly baseTimeout: number;
  private readonly multiplier: number;

  constructor(
    baseTimeout: number,
    options: {
      maxHistorySize?: number;
      multiplier?: number;
    } = {}
  ) {
    this.baseTimeout = baseTimeout;
    this.maxHistorySize = options.maxHistorySize ?? 10;
    this.multiplier = options.multiplier ?? 2.0;
  }

  /**
   * 记录执行时间
   */
  recordExecutionTime(time: number): void {
    this.executionTimes.push(time);
    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
    }
  }

  /**
   * 获取当前建议的超时时间
   */
  getTimeout(): number {
    if (this.executionTimes.length === 0) {
      return this.baseTimeout;
    }

    // 计算平均执行时间
    const avgTime =
      this.executionTimes.reduce((sum, time) => sum + time, 0) /
      this.executionTimes.length;

    // 计算最大执行时间
    const maxTime = Math.max(...this.executionTimes);

    // 使用最大值和平均值的加权平均,再乘以倍数
    const weightedAvg = maxTime * 0.6 + avgTime * 0.4;
    const adjustedTimeout = Math.ceil(weightedAvg * this.multiplier);

    // 至少使用基础超时时间
    return Math.max(adjustedTimeout, this.baseTimeout);
  }

  /**
   * 重置历史记录
   */
  reset(): void {
    this.executionTimes = [];
  }
}
