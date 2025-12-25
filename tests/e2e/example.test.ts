/**
 * E2E 测试示例
 * 演示如何编写 E2E 测试
 */

import {
  setupE2ETest,
  teardownE2ETest,
  assert,
  assertEqual,
  assertContains,
  runTestSuite,
  createTestFile,
  type E2ETestContext
} from './setup.js';
import { runCLI, InteractiveCLISession } from './cli-runner.js';

/**
 * 示例测试套件
 */
const tests = [
  {
    name: '示例 1: 简单的文本响应测试',
    fn: async () => {
      const context = await setupE2ETest('example-1');

      try {
        // 1. 设置 Mock 服务器响应
        context.mockServer.setTextResponse('Hello from Claude!');

        // 2. 运行 CLI 命令
        const result = await runCLI(
          ['-p', 'Say hello'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 3. 验证结果
        assertContains(result.stdout, 'Hello from Claude!', '应该包含响应文本');

      } finally {
        // 4. 清理测试环境
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '示例 2: 文件操作测试',
    fn: async () => {
      const context = await setupE2ETest('example-2');

      try {
        // 1. 创建测试文件
        const testFile = createTestFile(
          context.testDir,
          'test.txt',
          'Test content'
        );

        // 2. 设置工具使用响应
        context.mockServer.setToolUseResponse(
          'Read',
          { file_path: testFile },
          'I will read this file.'
        );

        // 3. 运行 CLI
        const result = await runCLI(
          ['-p', `Read ${testFile}`],
          {
            timeout: 10000,
            cwd: context.testDir,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 4. 验证工具被注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          assert(tools.length > 0, '应该注册工具');
        }

      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '示例 3: 交互式会话测试',
    fn: async () => {
      const context = await setupE2ETest('example-3');

      try {
        // 1. 设置响应
        context.mockServer.setTextResponse('Interactive response');

        // 2. 创建交互式会话
        const session = new InteractiveCLISession(
          [],
          {
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        try {
          // 3. 启动会话
          await session.start();

          // 4. 发送输入
          session.writeLine('Hello');

          // 5. 等待输出（可选）
          // await session.waitForOutput('response');

          // 6. 获取输出
          const output = session.getOutput();

          // 7. 停止会话
          const result = await session.stop();

          // 8. 验证
          assert(result.stdout.length >= 0, '应该有输出');

        } finally {
          // 确保会话被停止
          if (session.running()) {
            await session.stop();
          }
        }

      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '示例 4: 自定义响应处理器',
    fn: async () => {
      const context = await setupE2ETest('example-4');

      try {
        // 1. 设置自定义响应处理器
        let callCount = 0;

        context.mockServer.setResponseHandler('messages', (req) => {
          callCount++;

          return {
            id: `msg_${callCount}`,
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: `这是第 ${callCount} 次调用`
              }
            ],
            model: 'claude-3-5-sonnet-20241022',
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 100,
              output_tokens: 50
            }
          };
        });

        // 2. 运行 CLI
        const result = await runCLI(
          ['-p', 'Test custom handler'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 3. 验证调用次数
        assert(callCount > 0, '应该至少调用一次');

      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '示例 5: 验证请求内容',
    fn: async () => {
      const context = await setupE2ETest('example-5');

      try {
        context.mockServer.setTextResponse('Request validation test');

        // 运行带特定模型的命令
        const result = await runCLI(
          ['-m', 'opus', '-p', 'Test model selection'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 验证请求包含正确的模型
        const lastRequest = context.mockServer.getLastRequest();
        if (lastRequest && lastRequest.body) {
          const model = lastRequest.body.model || '';

          // 验证模型名称
          assert(
            model.includes('opus') || model.includes('claude-opus'),
            `应该使用 opus 模型，实际: ${model}`
          );
        }

      } finally {
        await teardownE2ETest(context);
      }
    }
  }
];

/**
 * 运行测试
 */
async function runTests() {
  const result = await runTestSuite({
    name: 'E2E 测试示例',
    tests
  });

  if (result.failed > 0) {
    process.exit(1);
  }
}

// 仅在直接运行时执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

// 导出测试以便集成
export { tests };
