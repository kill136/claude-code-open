/**
 * 网络模块
 * 提供代理、超时、重试等网络功能
 */

// 代理支持
export type { ProxyConfig, ProxyAgentOptions } from './proxy.js';
export {
  getProxyFromEnv,
  parseProxyUrl,
  shouldBypassProxy,
  createProxyAgent,
  getProxyInfo,
} from './proxy.js';

// 超时和取消
export type { TimeoutConfig } from './timeout.js';
export {
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
export type { RetryConfig } from './retry.js';
export {
  DEFAULT_RETRY_CONFIG,
  calculateRetryDelay,
  isRetryableError,
  withRetry,
  retry,
} from './retry.js';
