/**
 * 重试机制使用示例
 * 展示如何在工具中使用重试和超时功能
 */

import { BaseTool, type ToolOptions } from '../tools/base.js';
import type { ToolDefinition, ToolResult } from '../types/index.js';
import { ErrorCode } from '../types/errors.js';

/**
 * 示例工具: 带重试的网络请求工具
 */
class NetworkRequestTool extends BaseTool<{ url: string }, ToolResult> {
  name = 'network_request';
  description = 'Make a network request with retry support';

  constructor() {
    // 配置重试选项
    super({
      maxRetries: 3, // 最多重试3次
      baseTimeout: 30000, // 30秒超时
      enableDynamicTimeout: true, // 启用动态超时调整
      retryableErrors: [
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCode.NETWORK_TIMEOUT,
        ErrorCode.NETWORK_RATE_LIMITED,
      ],
    });
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
      required: ['url'],
    };
  }

  async execute(input: { url: string }): Promise<ToolResult> {
    // 使用重试和超时包装器
    return this.executeWithRetryAndTimeout(async () => {
      // 实际的网络请求逻辑
      const response = await fetch(input.url);
      const data = await response.text();
      return this.success(data);
    });
  }
}

/**
 * 示例工具: 不使用重试的简单工具
 */
class SimpleCalculatorTool extends BaseTool<
  { a: number; b: number },
  ToolResult
> {
  name = 'calculator';
  description = 'Simple calculator without retry';

  constructor() {
    // 不需要重试,使用默认配置
    super();
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    };
  }

  async execute(input: { a: number; b: number }): Promise<ToolResult> {
    // 简单的计算,不需要重试
    const result = input.a + input.b;
    return this.success(String(result));
  }
}

/**
 * 示例: 直接使用重试工具函数
 */
import { withRetry, withTimeout } from '../utils/retry.js';

async function exampleDirectRetryUsage() {
  // 示例1: 使用重试装饰器
  const result1 = await withRetry(
    async () => {
      // 可能失败的操作
      return await fetch('https://api.example.com/data');
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`);
      },
    }
  );

  // 示例2: 使用超时装饰器
  const result2 = await withTimeout(
    async () => {
      // 可能超时的操作
      return await fetch('https://api.example.com/slow-endpoint');
    },
    {
      timeout: 5000, // 5秒超时
      toolName: 'example_fetch',
    }
  );

  // 示例3: 同时使用重试和超时
  const result3 = await withRetry(
    () =>
      withTimeout(
        async () => {
          return await fetch('https://api.example.com/unreliable');
        },
        {
          timeout: 5000,
          toolName: 'unreliable_fetch',
        }
      ),
    {
      maxRetries: 3,
    }
  );
}

export { NetworkRequestTool, SimpleCalculatorTool, exampleDirectRetryUsage };
