/**
 * 网络请求重试策略
 * 支持指数退避和抖动
 */

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 基础延迟（毫秒） */
  baseDelay?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 是否使用指数退避 */
  exponentialBackoff?: boolean;
  /** 抖动因子 (0-1) */
  jitter?: number;
  /** 可重试的错误类型 */
  retryableErrors?: string[];
  /** 可重试的状态码 */
  retryableStatusCodes?: number[];
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 4,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBackoff: true,
  jitter: 0.1,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EAI_AGAIN',
    'overloaded_error',
    'rate_limit_error',
    'api_error',
    'timeout',
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * 计算重试延迟
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = {}
): number {
  const {
    baseDelay = DEFAULT_RETRY_CONFIG.baseDelay,
    maxDelay = DEFAULT_RETRY_CONFIG.maxDelay,
    exponentialBackoff = DEFAULT_RETRY_CONFIG.exponentialBackoff,
    jitter = DEFAULT_RETRY_CONFIG.jitter,
  } = config;

  let delay = baseDelay;

  if (exponentialBackoff) {
    delay = baseDelay * Math.pow(2, attempt);
  }

  // 应用抖动 (避免惊群效应)
  if (jitter > 0) {
    const jitterAmount = delay * jitter;
    const randomJitter = Math.random() * jitterAmount * 2 - jitterAmount;
    delay += randomJitter;
  }

  // 限制最大延迟
  return Math.min(delay, maxDelay);
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(
  error: any,
  config: RetryConfig = {}
): boolean {
  const {
    retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors,
    retryableStatusCodes = DEFAULT_RETRY_CONFIG.retryableStatusCodes,
  } = config;

  // 检查错误码
  const errorCode = error?.code || error?.type || '';
  if (retryableErrors.some((code) => errorCode.includes(code))) {
    return true;
  }

  // 检查错误消息
  const errorMessage = error?.message || '';
  if (retryableErrors.some((code) => errorMessage.includes(code))) {
    return true;
  }

  // 检查 HTTP 状态码
  const statusCode = error?.status || error?.statusCode;
  if (statusCode && retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  return false;
}

/**
 * 执行带重试的操作
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {},
  onRetry?: (attempt: number, error: any, delay: number) => void
): Promise<T> {
  const { maxRetries = DEFAULT_RETRY_CONFIG.maxRetries } = config;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 最后一次尝试失败，直接抛出错误
      if (attempt === maxRetries) {
        break;
      }

      // 检查是否可重试
      if (!isRetryableError(error, config)) {
        throw error;
      }

      // 计算延迟
      const delay = calculateRetryDelay(attempt, config);

      // 调用回调
      onRetry?.(attempt + 1, error, delay);

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 创建重试装饰器
 */
export function retry(config: RetryConfig = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        config
      );
    } as T;

    return descriptor;
  };
}
