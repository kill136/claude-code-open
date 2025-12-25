/**
 * 网络超时和取消控制
 * 支持 AbortController 和超时配置
 */

/**
 * 超时配置接口
 */
export interface TimeoutConfig {
  /** 连接超时（毫秒） */
  connect?: number;
  /** 请求超时（毫秒） */
  request?: number;
  /** 响应超时（毫秒） */
  response?: number;
  /** Socket 空闲超时（毫秒） */
  idle?: number;
}

/**
 * 默认超时配置
 */
export const DEFAULT_TIMEOUTS: Required<TimeoutConfig> = {
  connect: 30000, // 30秒
  request: 120000, // 2分钟
  response: 120000, // 2分钟
  idle: 60000, // 1分钟
};

/**
 * 创建带超时的 AbortSignal
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    // Node.js 17.3+ 支持 AbortSignal.timeout
    return AbortSignal.timeout(timeoutMs);
  } else {
    // 降级实现
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}

/**
 * 合并多个 AbortSignal
 */
export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);

  // 检查是否有已经中止的信号
  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
  }

  // 监听所有信号的中止事件
  const abortHandler = () => {
    controller.abort();
  };

  for (const signal of validSignals) {
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  return controller.signal;
}

/**
 * 创建带超时的 Promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * 创建可取消的延迟
 */
export function cancelableDelay(
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    const abortHandler = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });
  });
}

/**
 * 超时错误类
 */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out', public readonly timeoutMs?: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * 取消错误类
 */
export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * 检查错误是否为超时错误
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || (error instanceof Error && error.name === 'TimeoutError');
}

/**
 * 检查错误是否为取消错误
 */
export function isAbortError(error: unknown): error is AbortError {
  return (
    error instanceof AbortError ||
    (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort')))
  );
}
