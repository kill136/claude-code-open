/**
 * 网络模块使用示例
 */

import { ClaudeClient } from '../core/client.js';
import {
  createProxyAgent,
  getProxyInfo,
  withRetry,
  createTimeoutSignal,
  combineSignals,
} from './index.js';

/**
 * 示例 1: 使用环境变量配置代理
 */
export function example1_EnvProxy() {
  // 设置环境变量
  process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
  process.env.NO_PROXY = 'localhost,127.0.0.1';

  // 创建客户端（自动使用环境变量）
  const client = new ClaudeClient({
    apiKey: 'your-api-key',
    proxy: {
      useSystemProxy: true,
    },
  });

  console.log('Client created with env proxy configuration');
}

/**
 * 示例 2: 显式配置 HTTP/HTTPS 代理
 */
export function example2_ExplicitProxy() {
  const client = new ClaudeClient({
    apiKey: 'your-api-key',
    proxy: {
      https: 'http://proxy.example.com:8080',
      noProxy: ['localhost', '*.internal.com'],
    },
    timeout: 30000,
    debug: true,
  });

  console.log('Client created with explicit proxy');
}

/**
 * 示例 3: SOCKS5 代理
 */
export function example3_SocksProxy() {
  const client = new ClaudeClient({
    apiKey: 'your-api-key',
    proxy: {
      socks: 'socks5://127.0.0.1:1080',
    },
  });

  console.log('Client created with SOCKS5 proxy');
}

/**
 * 示例 4: 带认证的代理
 */
export function example4_AuthenticatedProxy() {
  // 方式 1: URL 中包含认证
  const client1 = new ClaudeClient({
    apiKey: 'your-api-key',
    proxy: {
      https: 'http://user:pass@proxy.example.com:8080',
    },
  });

  // 方式 2: 单独配置认证
  const client2 = new ClaudeClient({
    apiKey: 'your-api-key',
    proxy: {
      https: 'http://proxy.example.com:8080',
      username: 'user',
      password: 'pass',
    },
  });

  console.log('Clients created with proxy authentication');
}

/**
 * 示例 5: 直接创建代理 Agent
 */
export function example5_DirectProxyAgent() {
  const targetUrl = 'https://api.anthropic.com';

  const agent = createProxyAgent(
    targetUrl,
    {
      https: 'http://proxy.example.com:8080',
      noProxy: ['localhost'],
    },
    {
      timeout: 30000,
      keepAlive: true,
      maxSockets: 50,
    }
  );

  if (agent) {
    console.log('Proxy agent created');
  } else {
    console.log('No proxy needed (bypassed or not configured)');
  }
}

/**
 * 示例 6: 检查代理信息
 */
export function example6_ProxyInfo() {
  const targetUrl = 'https://api.anthropic.com';

  const info = getProxyInfo(targetUrl, {
    https: 'http://proxy.example.com:8080',
    noProxy: ['localhost'],
  });

  console.log('Proxy info:', info);
  // {
  //   enabled: true,
  //   proxyUrl: 'http://proxy.example.com:8080',
  //   bypassed: false
  // }
}

/**
 * 示例 7: 使用重试策略
 */
export async function example7_RetryStrategy() {
  const result = await withRetry(
    async () => {
      // 模拟可能失败的操作
      const random = Math.random();
      if (random < 0.7) {
        throw new Error('ETIMEDOUT');
      }
      return 'success';
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      exponentialBackoff: true,
      jitter: 0.1,
    },
    (attempt, error, delay) => {
      console.log(`Retry attempt ${attempt}, error: ${error.message}, waiting ${delay}ms`);
    }
  );

  console.log('Result:', result);
}

/**
 * 示例 8: 超时控制
 */
export async function example8_TimeoutControl() {
  // 创建 5 秒超时信号
  const timeoutSignal = createTimeoutSignal(5000);

  try {
    // 模拟长时间运行的操作
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 10000);

      timeoutSignal.addEventListener('abort', () => {
        clearTimeout(timer);
      });
    });
  } catch (error) {
    console.log('Operation timed out:', error);
  }
}

/**
 * 示例 9: 合并多个取消信号
 */
export async function example9_CombineSignals() {
  const timeoutSignal = createTimeoutSignal(5000);
  const userController = new AbortController();

  // 合并超时信号和用户取消信号
  const combinedSignal = combineSignals(timeoutSignal, userController.signal);

  // 用户可以主动取消
  setTimeout(() => {
    userController.abort();
  }, 2000);

  try {
    await new Promise((resolve, reject) => {
      combinedSignal.addEventListener('abort', () => {
        reject(new Error('Aborted'));
      });

      setTimeout(resolve, 10000);
    });
  } catch (error) {
    console.log('Operation aborted:', error);
  }
}

/**
 * 示例 10: 完整配置示例
 */
export function example10_FullConfiguration() {
  const client = new ClaudeClient({
    apiKey: 'your-api-key',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,

    // 代理配置
    proxy: {
      https: 'http://proxy.example.com:8080',
      noProxy: ['localhost', '127.0.0.1', '*.internal.com'],
      username: 'user',
      password: 'pass',
      useSystemProxy: false,
    },

    // 代理 Agent 选项
    proxyOptions: {
      timeout: 30000,
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      rejectUnauthorized: true,
    },

    // 超时配置
    timeout: {
      connect: 30000,
      request: 120000,
      response: 120000,
      idle: 60000,
    },

    // 重试配置
    maxRetries: 4,
    retryDelay: 1000,

    // 调试模式
    debug: true,
  });

  console.log('Client created with full configuration');
}

// 导出所有示例
export const examples = {
  example1_EnvProxy,
  example2_ExplicitProxy,
  example3_SocksProxy,
  example4_AuthenticatedProxy,
  example5_DirectProxyAgent,
  example6_ProxyInfo,
  example7_RetryStrategy,
  example8_TimeoutControl,
  example9_CombineSignals,
  example10_FullConfiguration,
};

// 如果直接运行此文件，执行所有示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n=== Network Module Examples ===\n');

  // 执行同步示例
  Object.entries(examples).forEach(([name, fn]) => {
    if (fn.constructor.name !== 'AsyncFunction') {
      console.log(`\n--- ${name} ---`);
      try {
        fn();
      } catch (error) {
        console.error(`Error in ${name}:`, error);
      }
    }
  });

  // 执行异步示例
  (async () => {
    for (const [name, fn] of Object.entries(examples)) {
      if (fn.constructor.name === 'AsyncFunction') {
        console.log(`\n--- ${name} ---`);
        try {
          await fn();
        } catch (error) {
          console.error(`Error in ${name}:`, error);
        }
      }
    }
  })();
}
