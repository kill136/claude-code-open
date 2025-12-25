/**
 * 错误类型使用示例
 * Error Types Usage Examples
 *
 * 这个文件展示了如何使用统一的错误类型系统
 * This file demonstrates how to use the unified error type system
 */

import {
  ErrorCode,
  ErrorSeverity,
  createToolExecutionError,
  createPermissionDeniedError,
  createConfigurationError,
  createNetworkError,
  createAuthenticationError,
  createValidationError,
  createSessionError,
  createSandboxError,
  fromNativeError,
  isClaudeError,
  isRetryableError,
  formatError,
  wrapAsyncWithErrorHandling,
} from './errors.js';

// ============ 基础使用示例 ============

/**
 * 示例 1: 抛出工具执行错误
 */
function executeToolExample() {
  try {
    // 模拟工具执行失败
    throw createToolExecutionError('bash', 'Command execution failed', {
      details: { command: 'ls -la', exitCode: 1 },
      context: { cwd: '/home/user' },
    });
  } catch (error) {
    if (isClaudeError(error)) {
      console.error(formatError(error));
      console.log('Error is retryable:', isRetryableError(error));
    }
  }
}

/**
 * 示例 2: 权限拒绝错误
 */
function permissionExample() {
  const filePath = '/etc/passwd';
  throw createPermissionDeniedError(
    filePath,
    'file_write',
    `Cannot write to protected file: ${filePath}`
  );
}

/**
 * 示例 3: 配置验证错误
 */
function configValidationExample() {
  const configPath = '~/.claude/settings.json';
  const validationErrors = [
    'apiKey is required',
    'maxTokens must be a positive number',
  ];

  throw createConfigurationError(
    'Configuration validation failed',
    configPath,
    validationErrors,
    {
      severity: ErrorSeverity.HIGH,
    }
  );
}

/**
 * 示例 4: 网络错误（可重试）
 */
async function networkRequestExample() {
  const url = 'https://api.anthropic.com/v1/messages';

  try {
    // 模拟网络请求失败
    throw createNetworkError('Connection timeout', url, undefined, {
      details: { timeout: 30000 },
      retryable: true,
    });
  } catch (error) {
    if (isClaudeError(error) && error.retryable) {
      console.log('Network error is retryable, will retry...');
      // 实现重试逻辑
    }
  }
}

/**
 * 示例 5: 认证错误
 */
function authenticationExample() {
  throw createAuthenticationError(
    'API key is invalid or expired',
    'api_key',
    {
      details: { apiKeyPrefix: 'sk-ant-...' },
      severity: ErrorSeverity.CRITICAL,
    }
  );
}

/**
 * 示例 6: 验证错误（多个字段）
 */
function validationExample() {
  throw createValidationError(
    'Input validation failed',
    undefined,
    [
      { field: 'email', message: 'Invalid email format' },
      { field: 'age', message: 'Age must be between 0 and 120' },
    ]
  );
}

/**
 * 示例 7: 会话错误
 */
function sessionExample() {
  const sessionId = 'abc-123-def-456';
  throw createSessionError(
    `Session not found: ${sessionId}`,
    sessionId,
    {
      details: { lastSeen: new Date().toISOString() },
    }
  );
}

/**
 * 示例 8: 沙箱错误
 */
function sandboxExample() {
  throw createSandboxError(
    'Memory limit exceeded',
    'bubblewrap',
    'maxMemory',
    {
      details: { limit: 1024 * 1024 * 1024, used: 1200 * 1024 * 1024 },
      severity: ErrorSeverity.HIGH,
    }
  );
}

// ============ 高级使用示例 ============

/**
 * 示例 9: 从原生错误转换
 */
function fromNativeErrorExample() {
  try {
    // 模拟某个可能抛出原生错误的操作
    JSON.parse('invalid json');
  } catch (error) {
    // 将原生错误转换为 Claude 错误
    throw fromNativeError(
      error as Error,
      ErrorCode.VALIDATION_FAILED,
      {
        context: { operation: 'parseJSON' },
      }
    );
  }
}

/**
 * 示例 10: 使用错误包装函数
 */
const safeAsyncOperation = wrapAsyncWithErrorHandling(
  async (filePath: string) => {
    // 模拟文件读取操作
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  },
  ErrorCode.SYSTEM_FILE_READ_ERROR,
  { operation: 'readFile' }
);

/**
 * 示例 11: 错误处理中间件
 */
async function errorHandlingMiddleware<T>(
  operation: () => Promise<T>,
  errorCode: ErrorCode
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isClaudeError(error)) {
      // 已经是 Claude 错误，直接抛出
      throw error;
    }

    // 转换为 Claude 错误
    throw fromNativeError(error as Error, errorCode);
  }
}

/**
 * 示例 12: 错误恢复策略
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 只有可重试的错误才进行重试
      if (!isRetryableError(error)) {
        throw error;
      }

      // 指数退避
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 示例 13: 错误分类处理
 */
function handleError(error: unknown): void {
  if (!isClaudeError(error)) {
    console.error('Unknown error:', error);
    return;
  }

  // 根据错误严重级别处理
  switch (error.severity) {
    case ErrorSeverity.LOW:
      console.warn('Low severity error:', formatError(error));
      break;

    case ErrorSeverity.MEDIUM:
      console.error('Medium severity error:', formatError(error));
      break;

    case ErrorSeverity.HIGH:
      console.error('High severity error:', formatError(error, true));
      // 发送告警
      break;

    case ErrorSeverity.CRITICAL:
      console.error('CRITICAL ERROR:', formatError(error, true));
      // 立即停止并通知
      process.exit(1);
  }
}

/**
 * 示例 14: 错误聚合
 */
class ErrorAggregator {
  private errors: Map<ErrorCode, number> = new Map();

  record(error: unknown): void {
    if (isClaudeError(error)) {
      const count = this.errors.get(error.code) || 0;
      this.errors.set(error.code, count + 1);
    }
  }

  getStats(): { code: ErrorCode; count: number; name: string }[] {
    return Array.from(this.errors.entries()).map(([code, count]) => ({
      code,
      count,
      name: ErrorCode[code] || 'Unknown',
    }));
  }

  clear(): void {
    this.errors.clear();
  }
}

/**
 * 示例 15: 综合应用示例
 */
async function comprehensiveExample() {
  const errorAggregator = new ErrorAggregator();

  try {
    // 模拟多个可能失败的操作
    await withRetry(async () => {
      // 尝试网络请求
      throw createNetworkError('Timeout', 'https://api.example.com');
    });
  } catch (error) {
    errorAggregator.record(error);
    handleError(error);
  }

  try {
    // 模拟配置读取
    throw createConfigurationError('Invalid config');
  } catch (error) {
    errorAggregator.record(error);
    handleError(error);
  }

  // 输出错误统计
  console.log('Error Statistics:', errorAggregator.getStats());
}

// ============ 导出示例函数 ============

export {
  executeToolExample,
  permissionExample,
  configValidationExample,
  networkRequestExample,
  authenticationExample,
  validationExample,
  sessionExample,
  sandboxExample,
  fromNativeErrorExample,
  safeAsyncOperation,
  errorHandlingMiddleware,
  withRetry,
  handleError,
  ErrorAggregator,
  comprehensiveExample,
};
