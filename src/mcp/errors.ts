/**
 * MCP (Model Context Protocol) 错误处理
 *
 * 提供完整的错误分类、转换、恢复和报告功能
 * 遵循 JSON-RPC 2.0 规范和 MCP 协议标准
 */

/**
 * MCP 错误代码枚举
 * 包含 JSON-RPC 标准错误代码和 MCP 自定义错误代码
 */
export enum McpErrorCode {
  // JSON-RPC 2.0 标准错误代码 (-32xxx)
  PARSE_ERROR = -32700,        // 解析错误：无效的 JSON
  INVALID_REQUEST = -32600,    // 无效请求：请求对象不是有效的 JSON-RPC
  METHOD_NOT_FOUND = -32601,   // 方法未找到：请求的方法不存在
  INVALID_PARAMS = -32602,     // 无效参数：方法参数无效
  INTERNAL_ERROR = -32603,     // 内部错误：服务器内部错误
  SERVER_ERROR = -32000,       // 服务器错误：通用服务器错误（-32000 到 -32099）

  // MCP 自定义错误代码
  CONNECTION_FAILED = -1001,   // 连接失败：无法连接到服务器
  CONNECTION_TIMEOUT = -1002,  // 连接超时：连接或请求超时
  CONNECTION_CLOSED = -1003,   // 连接关闭：连接意外关闭
  SERVER_NOT_FOUND = -1004,    // 服务器未找到：指定的 MCP 服务器不存在
  TOOL_NOT_FOUND = -1005,      // 工具未找到：请求的工具不存在
  RESOURCE_NOT_FOUND = -1006,  // 资源未找到：请求的资源不存在
  PERMISSION_DENIED = -1007,   // 权限拒绝：没有执行操作的权限
  RATE_LIMITED = -1008,        // 限流：请求频率超过限制
  INITIALIZATION_FAILED = -1009, // 初始化失败：服务器初始化失败
  NOT_INITIALIZED = -1010,     // 未初始化：服务器尚未初始化
  CAPABILITY_NOT_SUPPORTED = -1011, // 能力不支持：服务器不支持请求的能力
  PROTOCOL_VERSION_MISMATCH = -1012, // 协议版本不匹配
}

/**
 * 错误严重级别
 */
export enum McpErrorSeverity {
  LOW = 'low',           // 低级：不影响主要功能
  MEDIUM = 'medium',     // 中级：部分功能受影响
  HIGH = 'high',         // 高级：主要功能受影响
  CRITICAL = 'critical', // 严重：系统无法运行
}

/**
 * JSON-RPC 错误对象
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP 错误选项
 */
export interface McpErrorOptions {
  data?: unknown;
  serverName?: string;
  recoverable?: boolean;
  severity?: McpErrorSeverity;
  cause?: Error;
  retryable?: boolean;
  timestamp?: number;
}

/**
 * MCP 错误基类
 *
 * 所有 MCP 相关错误的基类，提供统一的错误处理接口
 */
export class McpError extends Error {
  code: McpErrorCode;
  data?: unknown;
  serverName?: string;
  recoverable: boolean;
  severity: McpErrorSeverity;
  retryable: boolean;
  timestamp: number;
  cause?: Error;

  constructor(
    code: McpErrorCode,
    message: string,
    options: McpErrorOptions = {}
  ) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = options.data;
    this.serverName = options.serverName;
    this.recoverable = options.recoverable ?? this.determineRecoverable(code);
    this.severity = options.severity ?? this.determineSeverity(code);
    this.retryable = options.retryable ?? this.determineRetryable(code);
    this.timestamp = options.timestamp ?? Date.now();
    this.cause = options.cause;

    // 保持错误堆栈
    if (options.cause && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }

    // 确保 instanceof 正常工作
    Object.setPrototypeOf(this, McpError.prototype);
  }

  /**
   * 从 JSON-RPC 错误创建 McpError
   */
  static fromJsonRpc(error: JsonRpcError, serverName?: string): McpError {
    const code = error.code as McpErrorCode;
    const message = error.message || 'Unknown JSON-RPC error';

    return new McpError(code, message, {
      data: error.data,
      serverName,
    });
  }

  /**
   * 从原生错误创建 McpError
   */
  static fromNative(error: Error, code?: McpErrorCode, serverName?: string): McpError {
    const errorCode = code ?? McpErrorCode.INTERNAL_ERROR;
    const message = error.message || 'Unknown error';

    return new McpError(errorCode, message, {
      data: { originalError: error.name },
      serverName,
      cause: error,
    });
  }

  /**
   * 转换为 JSON-RPC 错误格式
   */
  toJsonRpc(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      serverName: this.serverName,
      recoverable: this.recoverable,
      severity: this.severity,
      retryable: this.retryable,
      timestamp: this.timestamp,
      data: this.data,
    };
  }

  /**
   * 根据错误代码判断是否可恢复
   */
  private determineRecoverable(code: McpErrorCode): boolean {
    const unrecoverableCodes = [
      McpErrorCode.PARSE_ERROR,
      McpErrorCode.INVALID_REQUEST,
      McpErrorCode.METHOD_NOT_FOUND,
      McpErrorCode.INVALID_PARAMS,
      McpErrorCode.PERMISSION_DENIED,
      McpErrorCode.PROTOCOL_VERSION_MISMATCH,
      McpErrorCode.CAPABILITY_NOT_SUPPORTED,
    ];
    return !unrecoverableCodes.includes(code);
  }

  /**
   * 根据错误代码判断严重级别
   */
  private determineSeverity(code: McpErrorCode): McpErrorSeverity {
    switch (code) {
      case McpErrorCode.PARSE_ERROR:
      case McpErrorCode.INVALID_REQUEST:
      case McpErrorCode.PROTOCOL_VERSION_MISMATCH:
      case McpErrorCode.INITIALIZATION_FAILED:
        return McpErrorSeverity.CRITICAL;

      case McpErrorCode.CONNECTION_FAILED:
      case McpErrorCode.CONNECTION_CLOSED:
      case McpErrorCode.SERVER_NOT_FOUND:
      case McpErrorCode.NOT_INITIALIZED:
        return McpErrorSeverity.HIGH;

      case McpErrorCode.METHOD_NOT_FOUND:
      case McpErrorCode.TOOL_NOT_FOUND:
      case McpErrorCode.RESOURCE_NOT_FOUND:
      case McpErrorCode.PERMISSION_DENIED:
      case McpErrorCode.CAPABILITY_NOT_SUPPORTED:
        return McpErrorSeverity.MEDIUM;

      default:
        return McpErrorSeverity.LOW;
    }
  }

  /**
   * 根据错误代码判断是否可重试
   */
  private determineRetryable(code: McpErrorCode): boolean {
    const retryableCodes = [
      McpErrorCode.CONNECTION_TIMEOUT,
      McpErrorCode.CONNECTION_FAILED,
      McpErrorCode.RATE_LIMITED,
      McpErrorCode.INTERNAL_ERROR,
      McpErrorCode.SERVER_ERROR,
    ];
    return retryableCodes.includes(code);
  }
}

/**
 * MCP 连接错误
 *
 * 表示与 MCP 服务器连接相关的错误
 */
export class McpConnectionError extends McpError {
  constructor(message: string, options: McpErrorOptions = {}) {
    super(
      options.cause?.message?.includes('timeout')
        ? McpErrorCode.CONNECTION_TIMEOUT
        : McpErrorCode.CONNECTION_FAILED,
      message,
      { ...options, severity: McpErrorSeverity.HIGH }
    );
    this.name = 'McpConnectionError';
    Object.setPrototypeOf(this, McpConnectionError.prototype);
  }
}

/**
 * MCP 超时错误
 *
 * 表示请求或连接超时
 */
export class McpTimeoutError extends McpError {
  timeout: number;

  constructor(message: string, timeout: number, options: McpErrorOptions = {}) {
    super(McpErrorCode.CONNECTION_TIMEOUT, message, {
      ...options,
      data: { timeout, ...(options.data as object || {}) },
      severity: McpErrorSeverity.MEDIUM,
      retryable: true,
    });
    this.name = 'McpTimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, McpTimeoutError.prototype);
  }
}

/**
 * MCP 协议错误
 *
 * 表示协议层面的错误（解析、格式等）
 */
export class McpProtocolError extends McpError {
  constructor(message: string, code?: McpErrorCode, options: McpErrorOptions = {}) {
    super(
      code ?? McpErrorCode.INVALID_REQUEST,
      message,
      { ...options, severity: McpErrorSeverity.CRITICAL, recoverable: false }
    );
    this.name = 'McpProtocolError';
    Object.setPrototypeOf(this, McpProtocolError.prototype);
  }
}

/**
 * MCP 服务器错误
 *
 * 表示服务器返回的错误
 */
export class McpServerError extends McpError {
  constructor(message: string, code?: McpErrorCode, options: McpErrorOptions = {}) {
    super(
      code ?? McpErrorCode.SERVER_ERROR,
      message,
      options
    );
    this.name = 'McpServerError';
    Object.setPrototypeOf(this, McpServerError.prototype);
  }
}

/**
 * 错误处理动作
 */
export enum ErrorAction {
  RETRY = 'retry',           // 重试请求
  RECONNECT = 'reconnect',   // 重新连接
  FAIL = 'fail',             // 失败，不重试
  IGNORE = 'ignore',         // 忽略错误
}

/**
 * 错误回调类型
 */
export type ErrorCallback = (error: McpError) => void;

/**
 * 错误统计
 */
export interface ErrorStats {
  total: number;
  byCode: Map<McpErrorCode, number>;
  bySeverity: Map<McpErrorSeverity, number>;
  byServer: Map<string, number>;
  recoverable: number;
  unrecoverable: number;
  retried: number;
  firstError?: McpError;
  lastError?: McpError;
}

/**
 * 错误处理器选项
 */
export interface ErrorHandlerOptions {
  maxRetries?: number;          // 最大重试次数
  baseDelay?: number;           // 基础延迟（毫秒）
  maxDelay?: number;            // 最大延迟（毫秒）
  exponentialBackoff?: boolean; // 是否使用指数退避
  jitter?: boolean;             // 是否添加抖动
  onError?: ErrorCallback;      // 错误回调
}

/**
 * MCP 错误处理器
 *
 * 提供统一的错误处理、重试策略和错误统计功能
 */
export class McpErrorHandler {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;
  private exponentialBackoff: boolean;
  private jitter: boolean;
  private errorCallbacks: ErrorCallback[];
  private stats: ErrorStats;

  constructor(options: ErrorHandlerOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.exponentialBackoff = options.exponentialBackoff ?? true;
    this.jitter = options.jitter ?? true;
    this.errorCallbacks = options.onError ? [options.onError] : [];
    this.stats = this.createEmptyStats();
  }

  /**
   * 处理错误
   *
   * @param error MCP 错误
   * @returns 建议的处理动作
   */
  handle(error: McpError): ErrorAction {
    // 更新统计
    this.updateStats(error);

    // 触发回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });

    // 确定处理动作
    if (!error.recoverable) {
      return ErrorAction.FAIL;
    }

    if (error.retryable) {
      // 连接相关的错误，尝试重连
      if (
        error.code === McpErrorCode.CONNECTION_FAILED ||
        error.code === McpErrorCode.CONNECTION_CLOSED ||
        error.code === McpErrorCode.CONNECTION_TIMEOUT
      ) {
        return ErrorAction.RECONNECT;
      }

      return ErrorAction.RETRY;
    }

    // 低严重级别的错误可以忽略
    if (error.severity === McpErrorSeverity.LOW) {
      return ErrorAction.IGNORE;
    }

    return ErrorAction.FAIL;
  }

  /**
   * 判断是否应该重试
   *
   * @param error MCP 错误
   * @param attempt 当前尝试次数（从 0 开始）
   * @returns 是否应该重试
   */
  shouldRetry(error: McpError, attempt: number): boolean {
    // 检查是否超过最大重试次数
    if (attempt >= this.maxRetries) {
      return false;
    }

    // 检查错误是否可重试
    if (!error.retryable) {
      return false;
    }

    // 特定错误代码的重试逻辑
    switch (error.code) {
      case McpErrorCode.RATE_LIMITED:
        // 限流错误，总是重试（在合理范围内）
        return attempt < Math.max(this.maxRetries, 5);

      case McpErrorCode.CONNECTION_TIMEOUT:
        // 超时错误，允许更多重试
        return attempt < Math.max(this.maxRetries, 3);

      case McpErrorCode.PARSE_ERROR:
      case McpErrorCode.INVALID_REQUEST:
      case McpErrorCode.INVALID_PARAMS:
        // 客户端错误，不重试
        return false;

      default:
        return true;
    }
  }

  /**
   * 获取重试延迟
   *
   * @param error MCP 错误
   * @param attempt 当前尝试次数（从 0 开始）
   * @returns 延迟时间（毫秒）
   */
  getRetryDelay(error: McpError, attempt: number): number {
    let delay: number;

    // 限流错误的特殊处理
    if (error.code === McpErrorCode.RATE_LIMITED) {
      // 如果错误数据中包含 retry-after，使用它
      const retryAfter = (error.data as { retryAfter?: number })?.retryAfter;
      if (retryAfter && typeof retryAfter === 'number') {
        return Math.min(retryAfter * 1000, this.maxDelay);
      }
      // 否则使用较长的延迟
      delay = this.baseDelay * 5;
    } else {
      delay = this.baseDelay;
    }

    // 指数退避
    if (this.exponentialBackoff) {
      delay *= Math.pow(2, attempt);
    } else {
      delay *= (attempt + 1);
    }

    // 限制最大延迟
    delay = Math.min(delay, this.maxDelay);

    // 添加抖动（随机化）
    if (this.jitter) {
      const jitterAmount = delay * 0.3; // ±30% 抖动
      delay += (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.max(Math.floor(delay), 0);
  }

  /**
   * 注册错误回调
   *
   * @param callback 错误回调函数
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): ErrorStats {
    return {
      ...this.stats,
      byCode: new Map(this.stats.byCode),
      bySeverity: new Map(this.stats.bySeverity),
      byServer: new Map(this.stats.byServer),
    };
  }

  /**
   * 清除错误统计
   */
  clearStats(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * 更新统计信息
   */
  private updateStats(error: McpError): void {
    this.stats.total++;

    // 按错误代码统计
    const codeCount = this.stats.byCode.get(error.code) ?? 0;
    this.stats.byCode.set(error.code, codeCount + 1);

    // 按严重级别统计
    const severityCount = this.stats.bySeverity.get(error.severity) ?? 0;
    this.stats.bySeverity.set(error.severity, severityCount + 1);

    // 按服务器统计
    if (error.serverName) {
      const serverCount = this.stats.byServer.get(error.serverName) ?? 0;
      this.stats.byServer.set(error.serverName, serverCount + 1);
    }

    // 可恢复/不可恢复统计
    if (error.recoverable) {
      this.stats.recoverable++;
    } else {
      this.stats.unrecoverable++;
    }

    // 重试统计
    if (error.retryable) {
      this.stats.retried++;
    }

    // 记录第一个和最后一个错误
    if (!this.stats.firstError) {
      this.stats.firstError = error;
    }
    this.stats.lastError = error;
  }

  /**
   * 创建空的统计对象
   */
  private createEmptyStats(): ErrorStats {
    return {
      total: 0,
      byCode: new Map(),
      bySeverity: new Map(),
      byServer: new Map(),
      recoverable: 0,
      unrecoverable: 0,
      retried: 0,
    };
  }
}

/**
 * 判断错误是否可恢复
 *
 * @param error MCP 错误
 * @returns 是否可恢复
 */
export function isRecoverableError(error: McpError): boolean {
  return error.recoverable;
}

/**
 * 判断错误是否可重试
 *
 * @param error MCP 错误
 * @returns 是否可重试
 */
export function isRetryableError(error: McpError): boolean {
  return error.retryable;
}

/**
 * 格式化 MCP 错误为人类可读的字符串
 *
 * @param error MCP 错误
 * @param verbose 是否显示详细信息
 * @returns 格式化后的错误字符串
 */
export function formatMcpError(error: McpError, verbose = false): string {
  const parts: string[] = [];

  // 错误名称和消息
  parts.push(`${error.name}: ${error.message}`);

  // 服务器名称
  if (error.serverName) {
    parts.push(`  Server: ${error.serverName}`);
  }

  // 错误代码
  parts.push(`  Code: ${error.code} (${McpErrorCode[error.code] || 'Unknown'})`);

  // 严重级别
  parts.push(`  Severity: ${error.severity}`);

  // 可恢复性和重试性
  const flags: string[] = [];
  if (error.recoverable) flags.push('recoverable');
  if (error.retryable) flags.push('retryable');
  if (flags.length > 0) {
    parts.push(`  Flags: ${flags.join(', ')}`);
  }

  // 详细信息
  if (verbose) {
    // 时间戳
    parts.push(`  Timestamp: ${new Date(error.timestamp).toISOString()}`);

    // 附加数据
    if (error.data) {
      parts.push(`  Data: ${JSON.stringify(error.data, null, 2)}`);
    }

    // 原因链
    if (error.cause) {
      parts.push(`  Caused by: ${error.cause.message}`);
      if (error.cause.stack) {
        parts.push(`    Stack: ${error.cause.stack.split('\n').slice(0, 3).join('\n    ')}`);
      }
    }

    // 堆栈跟踪
    if (error.stack) {
      parts.push(`  Stack: ${error.stack.split('\n').slice(1, 4).join('\n  ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * 创建默认的错误处理器
 *
 * @param options 错误处理器选项
 * @returns 错误处理器实例
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}): McpErrorHandler {
  return new McpErrorHandler(options);
}

/**
 * 包装异步函数，自动处理 MCP 错误和重试
 *
 * @param fn 要包装的异步函数
 * @param handler 错误处理器
 * @param serverName 服务器名称（用于错误报告）
 * @returns 包装后的函数
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  handler: McpErrorHandler,
  serverName?: string
): () => Promise<T> {
  return async (): Promise<T> => {
    let lastError: McpError | null = null;
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        // 转换为 McpError
        const mcpError = error instanceof McpError
          ? error
          : McpError.fromNative(error as Error, undefined, serverName);

        lastError = mcpError;

        // 处理错误
        const action = handler.handle(mcpError);

        // 判断是否应该重试
        if (action === ErrorAction.RETRY || action === ErrorAction.RECONNECT) {
          if (handler.shouldRetry(mcpError, attempt)) {
            const delay = handler.getRetryDelay(mcpError, attempt);
            console.log(`Retrying after ${delay}ms (attempt ${attempt + 1})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
        }

        // 不重试，抛出错误
        throw mcpError;
      }
    }
  };
}
