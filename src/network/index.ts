/**
 * 网络模块
 * 提供代理、超时、重试等网络功能
 */

// 代理支持
export {
  ProxyConfig,
  ProxyAgentOptions,
  getProxyFromEnv,
  parseProxyUrl,
  shouldBypassProxy,
  createProxyAgent,
  getProxyInfo,
} from './proxy.js';

// 超时和取消
export {
  TimeoutConfig,
  DEFAULT_TIMEOUTS,
  createTimeoutSignal,
  combineSignals,
  withTimeout,
  cancelableDelay,
  TimeoutError,
  AbortError,
  isTimeoutError,
  isAbortError,
} from './timeout.js';

// 重试策略
export {
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateRetryDelay,
  isRetryableError,
  withRetry,
  retry,
} from './retry.js';
