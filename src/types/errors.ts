/**
 * 统一错误类型定义
 * Claude Code 项目的标准错误处理系统
 *
 * 功能：
 * - 统一的错误类型层次结构
 * - 错误代码枚举
 * - 错误工厂函数
 * - 类型安全的错误处理
 */

// ============ 错误代码枚举 ============

/**
 * 错误代码枚举
 * 使用分段管理：
 * - 1000-1999: 工具相关错误
 * - 2000-2999: 权限相关错误
 * - 3000-3999: 配置相关错误
 * - 4000-4999: 网络相关错误
 * - 5000-5999: 认证相关错误
 * - 6000-6999: 验证相关错误
 * - 7000-7999: 会话相关错误
 * - 8000-8999: 沙箱相关错误
 * - 9000-9999: 系统相关错误
 */
export enum ErrorCode {
  // ========== 工具相关错误 (1000-1999) ==========
  TOOL_EXECUTION_FAILED = 1000,
  TOOL_NOT_FOUND = 1001,
  TOOL_TIMEOUT = 1002,
  TOOL_INVALID_INPUT = 1003,
  TOOL_INVALID_OUTPUT = 1004,
  TOOL_NOT_AVAILABLE = 1005,
  TOOL_DISABLED = 1006,
  TOOL_DEPENDENCY_MISSING = 1007,

  // ========== 权限相关错误 (2000-2999) ==========
  PERMISSION_DENIED = 2000,
  PERMISSION_PATH_DENIED = 2001,
  PERMISSION_COMMAND_DENIED = 2002,
  PERMISSION_NETWORK_DENIED = 2003,
  PERMISSION_TOOL_DENIED = 2004,
  PERMISSION_CONFIG_INVALID = 2005,
  PERMISSION_AUDIT_FAILED = 2006,

  // ========== 配置相关错误 (3000-3999) ==========
  CONFIG_NOT_FOUND = 3000,
  CONFIG_INVALID = 3001,
  CONFIG_PARSE_ERROR = 3002,
  CONFIG_VALIDATION_FAILED = 3003,
  CONFIG_WRITE_FAILED = 3004,
  CONFIG_MIGRATION_FAILED = 3005,
  CONFIG_SCHEMA_ERROR = 3006,
  CONFIG_MISSING_REQUIRED = 3007,

  // ========== 网络相关错误 (4000-4999) ==========
  NETWORK_CONNECTION_FAILED = 4000,
  NETWORK_TIMEOUT = 4001,
  NETWORK_DNS_FAILED = 4002,
  NETWORK_SSL_ERROR = 4003,
  NETWORK_PROXY_ERROR = 4004,
  NETWORK_RATE_LIMITED = 4005,
  NETWORK_OFFLINE = 4006,
  NETWORK_HOST_UNREACHABLE = 4007,

  // ========== 认证相关错误 (5000-5999) ==========
  AUTH_FAILED = 5000,
  AUTH_TOKEN_INVALID = 5001,
  AUTH_TOKEN_EXPIRED = 5002,
  AUTH_TOKEN_MISSING = 5003,
  AUTH_OAUTH_FAILED = 5004,
  AUTH_DEVICE_CODE_FAILED = 5005,
  AUTH_REFRESH_FAILED = 5006,
  AUTH_INSUFFICIENT_PERMISSIONS = 5007,
  AUTH_API_KEY_INVALID = 5008,
  AUTH_API_KEY_MISSING = 5009,

  // ========== 验证相关错误 (6000-6999) ==========
  VALIDATION_FAILED = 6000,
  VALIDATION_SCHEMA_ERROR = 6001,
  VALIDATION_TYPE_ERROR = 6002,
  VALIDATION_REQUIRED_FIELD = 6003,
  VALIDATION_FORMAT_ERROR = 6004,
  VALIDATION_RANGE_ERROR = 6005,
  VALIDATION_CONSTRAINT_VIOLATION = 6006,

  // ========== 会话相关错误 (7000-7999) ==========
  SESSION_NOT_FOUND = 7000,
  SESSION_INVALID = 7001,
  SESSION_EXPIRED = 7002,
  SESSION_SAVE_FAILED = 7003,
  SESSION_LOAD_FAILED = 7004,
  SESSION_CHECKPOINT_FAILED = 7005,
  SESSION_RESTORE_FAILED = 7006,
  SESSION_NO_ACTIVE = 7007,

  // ========== 沙箱相关错误 (8000-8999) ==========
  SANDBOX_INIT_FAILED = 8000,
  SANDBOX_EXEC_FAILED = 8001,
  SANDBOX_RESOURCE_LIMIT = 8002,
  SANDBOX_PATH_VIOLATION = 8003,
  SANDBOX_NETWORK_BLOCKED = 8004,
  SANDBOX_NOT_AVAILABLE = 8005,
  SANDBOX_CONFIG_INVALID = 8006,
  SANDBOX_ESCAPE_ATTEMPT = 8007,

  // ========== 系统相关错误 (9000-9999) ==========
  SYSTEM_ERROR = 9000,
  SYSTEM_FILE_NOT_FOUND = 9001,
  SYSTEM_FILE_READ_ERROR = 9002,
  SYSTEM_FILE_WRITE_ERROR = 9003,
  SYSTEM_DIRECTORY_NOT_FOUND = 9004,
  SYSTEM_PATH_INVALID = 9005,
  SYSTEM_PERMISSION_DENIED = 9006,
  SYSTEM_OUT_OF_MEMORY = 9007,
  SYSTEM_DISK_FULL = 9008,
  SYSTEM_PROCESS_FAILED = 9009,

  // ========== 插件相关错误 (10000-10999) ==========
  PLUGIN_NOT_FOUND = 10000,
  PLUGIN_LOAD_FAILED = 10001,
  PLUGIN_INIT_FAILED = 10002,
  PLUGIN_DEPENDENCY_MISSING = 10003,
  PLUGIN_CIRCULAR_DEPENDENCY = 10004,
  PLUGIN_VERSION_MISMATCH = 10005,
  PLUGIN_INVALID_MANIFEST = 10006,
  PLUGIN_SECURITY_VIOLATION = 10007,

  // ========== 未知错误 ==========
  UNKNOWN_ERROR = 99999,
}

// ============ 错误严重级别 ============

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 低级：不影响主要功能，可以继续运行 */
  LOW = 'low',
  /** 中级：部分功能受影响，可能需要用户干预 */
  MEDIUM = 'medium',
  /** 高级：主要功能受影响，需要立即处理 */
  HIGH = 'high',
  /** 严重：系统无法正常运行，必须停止 */
  CRITICAL = 'critical',
}

// ============ 基础错误类型 ============

/**
 * Claude 基础错误类型
 * 所有自定义错误的基类
 */
export interface ClaudeError extends Error {
  /** 错误代码 */
  code: ErrorCode;
  /** 错误严重级别 */
  severity: ErrorSeverity;
  /** 错误详细信息 */
  details?: Record<string, unknown>;
  /** 是否可恢复 */
  recoverable: boolean;
  /** 是否可重试 */
  retryable: boolean;
  /** 时间戳 */
  timestamp: number;
  /** 原因链 */
  cause?: Error;
  /** 上下文信息 */
  context?: Record<string, unknown>;
}

/**
 * 错误选项
 */
export interface ErrorOptions {
  /** 错误详细信息 */
  details?: Record<string, unknown>;
  /** 原因错误 */
  cause?: Error;
  /** 是否可恢复 */
  recoverable?: boolean;
  /** 是否可重试 */
  retryable?: boolean;
  /** 错误严重级别 */
  severity?: ErrorSeverity;
  /** 上下文信息 */
  context?: Record<string, unknown>;
}

// ============ 基础错误类 ============

/**
 * Claude 基础错误类
 */
export class BaseClaudeError extends Error implements ClaudeError {
  code: ErrorCode;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  recoverable: boolean;
  retryable: boolean;
  timestamp: number;
  cause?: Error;
  context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: ErrorOptions = {}
  ) {
    super(message);
    this.name = 'ClaudeError';
    this.code = code;
    this.severity = options.severity ?? this.determineSeverity(code);
    this.details = options.details;
    this.recoverable = options.recoverable ?? this.determineRecoverable(code);
    this.retryable = options.retryable ?? this.determineRetryable(code);
    this.timestamp = Date.now();
    this.cause = options.cause;
    this.context = options.context;

    // 保持错误堆栈
    if (options.cause && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }

    // 确保 instanceof 正常工作
    Object.setPrototypeOf(this, BaseClaudeError.prototype);
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      retryable: this.retryable,
      timestamp: this.timestamp,
      details: this.details,
      context: this.context,
    };
  }

  /**
   * 根据错误代码判断严重级别
   */
  private determineSeverity(code: ErrorCode): ErrorSeverity {
    // 认证错误
    if (code >= 5000 && code < 6000) {
      return ErrorSeverity.HIGH;
    }
    // 会话错误
    if (code >= 7000 && code < 8000) {
      return ErrorSeverity.MEDIUM;
    }
    // 配置错误
    if (code >= 3000 && code < 4000) {
      return ErrorSeverity.MEDIUM;
    }
    // 沙箱错误
    if (code >= 8000 && code < 9000) {
      return ErrorSeverity.HIGH;
    }
    // 系统错误
    if (code >= 9000 && code < 10000) {
      return ErrorSeverity.HIGH;
    }
    // 默认中级
    return ErrorSeverity.MEDIUM;
  }

  /**
   * 根据错误代码判断是否可恢复
   */
  private determineRecoverable(code: ErrorCode): boolean {
    const unrecoverableCodes = [
      ErrorCode.CONFIG_SCHEMA_ERROR,
      ErrorCode.VALIDATION_SCHEMA_ERROR,
      ErrorCode.PLUGIN_CIRCULAR_DEPENDENCY,
      ErrorCode.SANDBOX_ESCAPE_ATTEMPT,
      ErrorCode.SYSTEM_OUT_OF_MEMORY,
      ErrorCode.SYSTEM_DISK_FULL,
    ];
    return !unrecoverableCodes.includes(code);
  }

  /**
   * 根据错误代码判断是否可重试
   */
  private determineRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_RATE_LIMITED,
      ErrorCode.AUTH_REFRESH_FAILED,
      ErrorCode.SESSION_LOAD_FAILED,
      ErrorCode.SYSTEM_FILE_READ_ERROR,
      ErrorCode.TOOL_TIMEOUT,
    ];
    return retryableCodes.includes(code);
  }
}

// ============ 具体错误类型 ============

/**
 * 工具执行错误
 */
export class ToolExecutionError extends BaseClaudeError {
  toolName?: string;

  constructor(message: string, toolName?: string, options: ErrorOptions = {}) {
    super(ErrorCode.TOOL_EXECUTION_FAILED, message, {
      ...options,
      context: { ...options.context, toolName },
    });
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

/**
 * 权限拒绝错误
 */
export class PermissionDeniedError extends BaseClaudeError {
  resource?: string;
  permissionType?: string;

  constructor(
    message: string,
    resource?: string,
    permissionType?: string,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.PERMISSION_DENIED, message, {
      ...options,
      recoverable: false,
      context: { ...options.context, resource, permissionType },
    });
    this.name = 'PermissionDeniedError';
    this.resource = resource;
    this.permissionType = permissionType;
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends BaseClaudeError {
  configPath?: string;
  validationErrors?: string[];

  constructor(
    message: string,
    configPath?: string,
    validationErrors?: string[],
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.CONFIG_INVALID, message, {
      ...options,
      context: { ...options.context, configPath, validationErrors },
    });
    this.name = 'ConfigurationError';
    this.configPath = configPath;
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends BaseClaudeError {
  url?: string;
  statusCode?: number;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.NETWORK_CONNECTION_FAILED, message, {
      ...options,
      retryable: true,
      context: { ...options.context, url, statusCode },
    });
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends BaseClaudeError {
  authType?: string;

  constructor(message: string, authType?: string, options: ErrorOptions = {}) {
    super(ErrorCode.AUTH_FAILED, message, {
      ...options,
      severity: ErrorSeverity.HIGH,
      recoverable: false,
      context: { ...options.context, authType },
    });
    this.name = 'AuthenticationError';
    this.authType = authType;
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends BaseClaudeError {
  field?: string;
  validationErrors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    field?: string,
    validationErrors?: Array<{ field: string; message: string }>,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.VALIDATION_FAILED, message, {
      ...options,
      recoverable: false,
      context: { ...options.context, field, validationErrors },
    });
    this.name = 'ValidationError';
    this.field = field;
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 会话错误
 */
export class SessionError extends BaseClaudeError {
  sessionId?: string;

  constructor(message: string, sessionId?: string, options: ErrorOptions = {}) {
    super(ErrorCode.SESSION_NOT_FOUND, message, {
      ...options,
      context: { ...options.context, sessionId },
    });
    this.name = 'SessionError';
    this.sessionId = sessionId;
    Object.setPrototypeOf(this, SessionError.prototype);
  }
}

/**
 * 沙箱错误
 */
export class SandboxError extends BaseClaudeError {
  sandboxType?: string;
  resourceLimit?: string;

  constructor(
    message: string,
    sandboxType?: string,
    resourceLimit?: string,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.SANDBOX_INIT_FAILED, message, {
      ...options,
      severity: ErrorSeverity.HIGH,
      context: { ...options.context, sandboxType, resourceLimit },
    });
    this.name = 'SandboxError';
    this.sandboxType = sandboxType;
    this.resourceLimit = resourceLimit;
    Object.setPrototypeOf(this, SandboxError.prototype);
  }
}

/**
 * 插件错误
 */
export class PluginError extends BaseClaudeError {
  pluginName?: string;
  pluginVersion?: string;

  constructor(
    message: string,
    pluginName?: string,
    pluginVersion?: string,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.PLUGIN_LOAD_FAILED, message, {
      ...options,
      context: { ...options.context, pluginName, pluginVersion },
    });
    this.name = 'PluginError';
    this.pluginName = pluginName;
    this.pluginVersion = pluginVersion;
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

/**
 * 系统错误
 */
export class SystemError extends BaseClaudeError {
  systemCode?: string;
  systemMessage?: string;

  constructor(
    message: string,
    systemCode?: string,
    systemMessage?: string,
    options: ErrorOptions = {}
  ) {
    super(ErrorCode.SYSTEM_ERROR, message, {
      ...options,
      severity: ErrorSeverity.HIGH,
      context: { ...options.context, systemCode, systemMessage },
    });
    this.name = 'SystemError';
    this.systemCode = systemCode;
    this.systemMessage = systemMessage;
    Object.setPrototypeOf(this, SystemError.prototype);
  }
}

// ============ 错误工厂函数 ============

/**
 * 创建工具执行错误
 */
export function createToolExecutionError(
  toolName: string,
  message: string,
  options?: ErrorOptions
): ToolExecutionError {
  return new ToolExecutionError(message, toolName, options);
}

/**
 * 创建权限拒绝错误
 */
export function createPermissionDeniedError(
  resource: string,
  permissionType: string,
  message?: string,
  options?: ErrorOptions
): PermissionDeniedError {
  const defaultMessage = `Permission denied: ${permissionType} access to ${resource}`;
  return new PermissionDeniedError(
    message || defaultMessage,
    resource,
    permissionType,
    options
  );
}

/**
 * 创建配置错误
 */
export function createConfigurationError(
  message: string,
  configPath?: string,
  validationErrors?: string[],
  options?: ErrorOptions
): ConfigurationError {
  return new ConfigurationError(message, configPath, validationErrors, options);
}

/**
 * 创建网络错误
 */
export function createNetworkError(
  message: string,
  url?: string,
  statusCode?: number,
  options?: ErrorOptions
): NetworkError {
  return new NetworkError(message, url, statusCode, options);
}

/**
 * 创建认证错误
 */
export function createAuthenticationError(
  message: string,
  authType?: string,
  options?: ErrorOptions
): AuthenticationError {
  return new AuthenticationError(message, authType, options);
}

/**
 * 创建验证错误
 */
export function createValidationError(
  message: string,
  field?: string,
  validationErrors?: Array<{ field: string; message: string }>,
  options?: ErrorOptions
): ValidationError {
  return new ValidationError(message, field, validationErrors, options);
}

/**
 * 创建会话错误
 */
export function createSessionError(
  message: string,
  sessionId?: string,
  options?: ErrorOptions
): SessionError {
  return new SessionError(message, sessionId, options);
}

/**
 * 创建沙箱错误
 */
export function createSandboxError(
  message: string,
  sandboxType?: string,
  resourceLimit?: string,
  options?: ErrorOptions
): SandboxError {
  return new SandboxError(message, sandboxType, resourceLimit, options);
}

/**
 * 创建插件错误
 */
export function createPluginError(
  message: string,
  pluginName?: string,
  pluginVersion?: string,
  options?: ErrorOptions
): PluginError {
  return new PluginError(message, pluginName, pluginVersion, options);
}

/**
 * 创建系统错误
 */
export function createSystemError(
  message: string,
  systemCode?: string,
  systemMessage?: string,
  options?: ErrorOptions
): SystemError {
  return new SystemError(message, systemCode, systemMessage, options);
}

// ============ 错误转换函数 ============

/**
 * 从原生错误创建 Claude 错误
 */
export function fromNativeError(
  error: Error,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  options: ErrorOptions = {}
): BaseClaudeError {
  return new BaseClaudeError(code, error.message, {
    ...options,
    cause: error,
  });
}

/**
 * 判断是否为 Claude 错误
 */
export function isClaudeError(error: unknown): error is ClaudeError {
  return (
    error instanceof BaseClaudeError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'severity' in error &&
      'recoverable' in error &&
      'retryable' in error)
  );
}

/**
 * 判断错误是否可恢复
 */
export function isRecoverableError(error: unknown): boolean {
  if (isClaudeError(error)) {
    return error.recoverable;
  }
  return false;
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (isClaudeError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * 格式化错误为人类可读字符串
 */
export function formatError(error: unknown, verbose = false): string {
  if (isClaudeError(error)) {
    const parts: string[] = [];

    // 错误名称和消息
    parts.push(`${error.name}: ${error.message}`);

    // 错误代码
    parts.push(`  Code: ${error.code} (${ErrorCode[error.code] || 'Unknown'})`);

    // 严重级别
    parts.push(`  Severity: ${error.severity}`);

    // 可恢复性和重试性
    const flags: string[] = [];
    if (error.recoverable) flags.push('recoverable');
    if (error.retryable) flags.push('retryable');
    if (flags.length > 0) {
      parts.push(`  Flags: ${flags.join(', ')}`);
    }

    // 上下文信息
    if (error.context && Object.keys(error.context).length > 0) {
      parts.push(`  Context: ${JSON.stringify(error.context)}`);
    }

    // 详细信息
    if (verbose) {
      // 时间戳
      parts.push(`  Timestamp: ${new Date(error.timestamp).toISOString()}`);

      // 详细数据
      if (error.details) {
        parts.push(`  Details: ${JSON.stringify(error.details, null, 2)}`);
      }

      // 原因链
      if (error.cause) {
        parts.push(`  Caused by: ${error.cause.message}`);
        if (error.cause.stack) {
          parts.push(`    ${error.cause.stack.split('\n').slice(0, 3).join('\n    ')}`);
        }
      }

      // 堆栈跟踪
      if (error.stack) {
        parts.push(`  Stack: ${error.stack.split('\n').slice(1, 4).join('\n  ')}`);
      }
    }

    return parts.join('\n');
  }

  // 非 Claude 错误
  if (error instanceof Error) {
    return verbose
      ? `${error.name}: ${error.message}\n${error.stack}`
      : `${error.name}: ${error.message}`;
  }

  return String(error);
}

/**
 * 获取错误的严重级别
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isClaudeError(error)) {
    return error.severity;
  }
  return ErrorSeverity.MEDIUM;
}

/**
 * 获取错误代码
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isClaudeError(error)) {
    return error.code;
  }
  return ErrorCode.UNKNOWN_ERROR;
}

// ============ 错误处理辅助函数 ============

/**
 * 包装函数，自动捕获和转换错误
 */
export function wrapWithErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => T,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): (...args: Args) => T {
  return (...args: Args): T => {
    try {
      return fn(...args);
    } catch (error) {
      if (isClaudeError(error)) {
        throw error;
      }
      throw fromNativeError(error as Error, errorCode, { context });
    }
  };
}

/**
 * 包装异步函数，自动捕获和转换错误
 */
export function wrapAsyncWithErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isClaudeError(error)) {
        throw error;
      }
      throw fromNativeError(error as Error, errorCode, { context });
    }
  };
}
