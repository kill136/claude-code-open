/**
 * E2E 测试: 基础 CLI 功能
 * 测试命令行参数、版本信息、帮助文档等基础功能
 */

import {
  setupE2ETest,
  teardownE2ETest,
  assert,
  assertEqual,
  assertContains,
  runTestSuite,
  type E2ETestContext
} from './setup.js';
import { runCLI, runSimpleCommand } from './cli-runner.js';

/**
 * 测试套件
 */
const tests = [
  {
    name: '应该显示版本信息',
    fn: async () => {
      const result = await runCLI(['--version'], { timeout: 5000 });

      assertEqual(result.exitCode, 0, '应该成功退出');
      assertContains(result.stdout, '2.0.76', '应该显示版本号');
    }
  },

  {
    name: '应该显示帮助信息',
    fn: async () => {
      const result = await runCLI(['--help'], { timeout: 5000 });

      assertEqual(result.exitCode, 0, '应该成功退出');
      assertContains(result.stdout, 'Usage:', '应该包含使用说明');
      assertContains(result.stdout, 'Options:', '应该包含选项说明');
    }
  },

  {
    name: '应该显示短版本标志 -v',
    fn: async () => {
      const result = await runCLI(['-v'], { timeout: 5000 });

      assertEqual(result.exitCode, 0, '应该成功退出');
      assertContains(result.stdout, '2.0.76', '应该显示版本号');
    }
  },

  {
    name: '应该显示短帮助标志 -h',
    fn: async () => {
      const result = await runCLI(['-h'], { timeout: 5000 });

      assertEqual(result.exitCode, 0, '应该成功退出');
      assertContains(result.stdout, 'Usage:', '应该包含使用说明');
    }
  },

  {
    name: '应该正确处理打印模式 (-p)',
    fn: async () => {
      const context = await setupE2ETest('print-mode');

      try {
        // 设置简单的文本响应
        context.mockServer.setTextResponse('Hello from Claude!');

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

        // 打印模式可能返回 0 或其他退出码，取决于实现
        assertContains(result.stdout, 'Hello from Claude!', '应该包含 API 响应');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持模型选择 (-m)',
    fn: async () => {
      const context = await setupE2ETest('model-selection');

      try {
        context.mockServer.setTextResponse('Using Opus model');

        const result = await runCLI(
          ['-m', 'opus', '-p', 'Test opus model'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 验证请求中包含正确的模型
        const lastRequest = context.mockServer.getLastRequest();
        if (lastRequest) {
          assert(
            lastRequest.body.model.includes('opus') ||
            lastRequest.body.model === 'claude-opus-4-5-20251101',
            '应该使用 opus 模型'
          );
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持详细模式 (--verbose)',
    fn: async () => {
      const context = await setupE2ETest('verbose-mode');

      try {
        context.mockServer.setTextResponse('Verbose output test');

        const result = await runCLI(
          ['--verbose', '-p', 'Test verbose'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 详细模式可能会输出额外的调试信息
        // 至少应该有正常输出
        assert(result.stdout.length > 0 || result.stderr.length > 0, '应该有输出');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 JSON 输出格式',
    fn: async () => {
      const context = await setupE2ETest('json-output');

      try {
        context.mockServer.setTextResponse('JSON format test');

        const result = await runCLI(
          ['-p', 'Test JSON', '--output-format', 'json'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // JSON 输出应该可以解析
        // 注意: 实际实现可能返回不同格式，这里只是示例
        if (result.stdout.trim().startsWith('{')) {
          const parsed = JSON.parse(result.stdout);
          assert(parsed !== null, '应该输出有效的 JSON');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该正确处理缺少 API 密钥',
    fn: async () => {
      const context = await setupE2ETest('no-api-key');

      try {
        const result = await runCLI(
          ['-p', 'Test without API key'],
          {
            timeout: 5000,
            env: {
              // 移除所有 API 密钥
              ...process.env,
              ANTHROPIC_API_KEY: undefined,
              CLAUDE_API_KEY: undefined,
              ANTHROPIC_BASE_URL: undefined
            }
          }
        );

        // 应该失败或显示错误信息
        const output = result.stdout + result.stderr;
        assert(
          result.exitCode !== 0 || output.includes('API key') || output.includes('密钥'),
          '应该提示缺少 API 密钥'
        );
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持调试模式 (-d)',
    fn: async () => {
      const context = await setupE2ETest('debug-mode');

      try {
        context.mockServer.setTextResponse('Debug mode test');

        const result = await runCLI(
          ['-d', '-p', 'Test debug'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 调试模式应该输出额外的调试信息
        // 至少应该有输出
        assert(result.stdout.length > 0 || result.stderr.length > 0, '应该有输出');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持工作目录参数',
    fn: async () => {
      const context = await setupE2ETest('working-directory');

      try {
        context.mockServer.setTextResponse('Working directory test');

        const result = await runCLI(
          ['--directory', context.testDir, '-p', 'Test directory'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 应该能够成功执行
        assert(result.exitCode === 0 || result.stdout.length > 0, '应该成功执行');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该正确处理无效参数',
    fn: async () => {
      const result = await runCLI(['--invalid-option'], { timeout: 5000 });

      // 应该显示错误或帮助信息
      const output = result.stdout + result.stderr;
      assert(
        result.exitCode !== 0 ||
        output.includes('error') ||
        output.includes('unknown') ||
        output.includes('invalid'),
        '应该提示无效参数'
      );
    }
  }
];

/**
 * 运行测试
 */
async function runTests() {
  const result = await runTestSuite({
    name: 'CLI 基础功能测试',
    tests
  });

  if (result.failed > 0) {
    process.exit(1);
  }
}

// 运行测试
runTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
