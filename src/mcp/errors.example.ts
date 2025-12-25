/**
 * MCP 错误处理使用示例
 *
 * 展示如何使用 MCP 错误处理模块的各种功能
 */

import {
  McpError,
  McpErrorCode,
  McpConnectionError,
  McpTimeoutError,
  McpProtocolError,
  McpServerError,
  McpErrorHandler,
  createErrorHandler,
  formatMcpError,
  isRecoverableError,
  isRetryableError,
  withErrorHandling,
  ErrorAction,
} from './errors.js';

/**
 * 示例 1: 创建和使用基本错误
 */
function example1_BasicError(): void {
  console.log('=== 示例 1: 基本错误 ===\n');

  // 创建一个简单的 MCP 错误
  const error = new McpError(
    McpErrorCode.CONNECTION_FAILED,
    'Failed to connect to MCP server',
    {
      serverName: 'example-server',
      data: { host: 'localhost', port: 8080 },
    }
  );

  console.log(formatMcpError(error, true));
  console.log('\nIs recoverable?', isRecoverableError(error));
  console.log('Is retryable?', isRetryableError(error));
  console.log('\n');
}

/**
 * 示例 2: 使用特定错误类型
 */
function example2_SpecificErrors(): void {
  console.log('=== 示例 2: 特定错误类型 ===\n');

  // 连接错误
  const connError = new McpConnectionError('Connection refused', {
    serverName: 'example-server',
  });
  console.log('Connection Error:', formatMcpError(connError));
  console.log('');

  // 超时错误
  const timeoutError = new McpTimeoutError('Request timed out', 5000, {
    serverName: 'example-server',
  });
  console.log('Timeout Error:', formatMcpError(timeoutError));
  console.log('');

  // 协议错误
  const protocolError = new McpProtocolError('Invalid JSON-RPC format');
  console.log('Protocol Error:', formatMcpError(protocolError));
  console.log('');

  // 服务器错误
  const serverError = new McpServerError('Internal server error');
  console.log('Server Error:', formatMcpError(serverError));
  console.log('\n');
}

/**
 * 示例 3: JSON-RPC 错误转换
 */
function example3_JsonRpcConversion(): void {
  console.log('=== 示例 3: JSON-RPC 错误转换 ===\n');

  // 从 JSON-RPC 错误创建
  const jsonRpcError = {
    code: -32601,
    message: 'Method not found',
    data: { method: 'unknown_method' },
  };

  const error = McpError.fromJsonRpc(jsonRpcError, 'example-server');
  console.log('From JSON-RPC:', formatMcpError(error));
  console.log('');

  // 转换回 JSON-RPC
  const backToJsonRpc = error.toJsonRpc();
  console.log('Back to JSON-RPC:', JSON.stringify(backToJsonRpc, null, 2));
  console.log('\n');
}

/**
 * 示例 4: 原生错误转换
 */
function example4_NativeErrorConversion(): void {
  console.log('=== 示例 4: 原生错误转换 ===\n');

  try {
    throw new Error('Something went wrong');
  } catch (err) {
    const mcpError = McpError.fromNative(
      err as Error,
      McpErrorCode.INTERNAL_ERROR,
      'example-server'
    );
    console.log(formatMcpError(mcpError, true));
  }
  console.log('\n');
}

/**
 * 示例 5: 错误处理器基本使用
 */
function example5_ErrorHandler(): void {
  console.log('=== 示例 5: 错误处理器 ===\n');

  const handler = createErrorHandler({
    maxRetries: 3,
    baseDelay: 1000,
    exponentialBackoff: true,
    onError: (error) => {
      console.log('[Handler] Error occurred:', error.message);
    },
  });

  // 测试不同的错误
  const errors = [
    new McpError(McpErrorCode.CONNECTION_TIMEOUT, 'Timeout'),
    new McpError(McpErrorCode.RATE_LIMITED, 'Rate limited'),
    new McpError(McpErrorCode.INVALID_PARAMS, 'Invalid params'),
  ];

  errors.forEach((error) => {
    const action = handler.handle(error);
    console.log('Error:', error.message);
    console.log('  Action:', action);
    console.log('  Should retry (attempt 0)?', handler.shouldRetry(error, 0));
    console.log('  Retry delay:', handler.getRetryDelay(error, 0), 'ms');
    console.log('');
  });

  // 获取统计信息
  const stats = handler.getErrorStats();
  console.log('Error Statistics:');
  console.log('  Total:', stats.total);
  console.log('  Recoverable:', stats.recoverable);
  console.log('  Unrecoverable:', stats.unrecoverable);
  console.log('  Retried:', stats.retried);
  console.log('\n');
}

/**
 * 示例 6: 重试逻辑
 */
async function example6_RetryLogic(): Promise<void> {
  console.log('=== 示例 6: 重试逻辑 ===\n');

  const handler = createErrorHandler({
    maxRetries: 3,
    baseDelay: 100,
  });

  let attempt = 0;
  const simulateFailingOperation = async (): Promise<string> => {
    attempt++;
    console.log('Attempt', attempt, '...');
    if (attempt < 3) {
      throw new McpError(
        McpErrorCode.CONNECTION_TIMEOUT,
        'Timeout on attempt ' + attempt
      );
    }
    return 'Success!';
  };

  try {
    const result = await withErrorHandling(
      simulateFailingOperation,
      handler,
      'example-server'
    )();
    console.log('Result:', result);
  } catch (err) {
    console.log('Failed after retries:', err);
  }
  console.log('\n');
}

/**
 * 示例 7: 错误严重级别和可恢复性
 */
function example7_ErrorSeverityAndRecovery(): void {
  console.log('=== 示例 7: 错误严重级别 ===\n');

  const errorCodes = [
    McpErrorCode.PARSE_ERROR,
    McpErrorCode.CONNECTION_TIMEOUT,
    McpErrorCode.TOOL_NOT_FOUND,
    McpErrorCode.RATE_LIMITED,
  ];

  errorCodes.forEach((code) => {
    const error = new McpError(code, 'Error code ' + code);
    console.log('Code:', McpErrorCode[code]);
    console.log('  Severity:', error.severity);
    console.log('  Recoverable:', error.recoverable);
    console.log('  Retryable:', error.retryable);
    console.log('');
  });
}

/**
 * 运行所有示例
 */
async function runAllExamples(): Promise<void> {
  console.log('MCP 错误处理示例\n');
  console.log('==================================================');
  console.log('');

  example1_BasicError();
  example2_SpecificErrors();
  example3_JsonRpcConversion();
  example4_NativeErrorConversion();
  example5_ErrorHandler();
  await example6_RetryLogic();
  example7_ErrorSeverityAndRecovery();

  console.log('所有示例运行完成！');
}

// 如果直接运行此文件
if (import.meta.url === 'file://' + process.argv[1]) {
  runAllExamples().catch(console.error);
}

export { runAllExamples };
