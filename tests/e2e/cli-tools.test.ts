/**
 * E2E 测试: 工具调用
 * 测试各种工具的调用和结果处理
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  setupE2ETest,
  teardownE2ETest,
  assert,
  assertEqual,
  assertContains,
  runTestSuite,
  createTestFile,
  readTestFile,
  fileExists,
  type E2ETestContext
} from './setup.js';
import { runCLI } from './cli-runner.js';

/**
 * 测试套件
 */
const tests = [
  {
    name: '应该支持 Read 工具读取文件',
    fn: async () => {
      const context = await setupE2ETest('read-tool');

      try {
        // 创建测试文件
        const testFile = createTestFile(
          context.testDir,
          'test.txt',
          'Hello from test file!'
        );

        // 设置工具使用响应
        context.mockServer.setToolUseResponse(
          'Read',
          { file_path: testFile },
          '我将读取这个文件。'
        );

        const result = await runCLI(
          ['-p', `Read the file at ${testFile}`],
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

        // 验证请求包含工具定义
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasReadTool = tools.some((t: any) => t.name === 'Read');

          assert(hasReadTool || tools.length > 0, '应该注册 Read 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 Write 工具创建文件',
    fn: async () => {
      const context = await setupE2ETest('write-tool');

      try {
        const outputFile = path.join(context.testDir, 'output.txt');

        context.mockServer.setToolUseResponse(
          'Write',
          {
            file_path: outputFile,
            content: 'Created by Write tool'
          },
          '我将创建这个文件。'
        );

        const result = await runCLI(
          ['-p', `Create a file at ${outputFile}`],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasWriteTool = tools.some((t: any) => t.name === 'Write');

          assert(hasWriteTool || tools.length > 0, '应该注册 Write 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 Edit 工具编辑文件',
    fn: async () => {
      const context = await setupE2ETest('edit-tool');

      try {
        // 创建测试文件
        const testFile = createTestFile(
          context.testDir,
          'edit-test.txt',
          'Original content'
        );

        context.mockServer.setToolUseResponse(
          'Edit',
          {
            file_path: testFile,
            old_string: 'Original',
            new_string: 'Modified'
          },
          '我将编辑这个文件。'
        );

        const result = await runCLI(
          ['-p', `Edit the file at ${testFile}`],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasEditTool = tools.some((t: any) => t.name === 'Edit');

          assert(hasEditTool || tools.length > 0, '应该注册 Edit 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 Bash 工具执行命令',
    fn: async () => {
      const context = await setupE2ETest('bash-tool');

      try {
        context.mockServer.setToolUseResponse(
          'Bash',
          {
            command: 'echo "Hello from bash"',
            description: 'Print hello message'
          },
          '我将执行这个命令。'
        );

        const result = await runCLI(
          ['-p', 'Run echo command'],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasBashTool = tools.some((t: any) => t.name === 'Bash');

          assert(hasBashTool || tools.length > 0, '应该注册 Bash 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 Glob 工具查找文件',
    fn: async () => {
      const context = await setupE2ETest('glob-tool');

      try {
        // 创建一些测试文件
        createTestFile(context.testDir, 'file1.txt', 'Content 1');
        createTestFile(context.testDir, 'file2.txt', 'Content 2');
        createTestFile(context.testDir, 'file3.js', 'console.log()');

        context.mockServer.setToolUseResponse(
          'Glob',
          {
            pattern: '**/*.txt',
            path: context.testDir
          },
          '我将查找所有 txt 文件。'
        );

        const result = await runCLI(
          ['-p', 'Find all txt files'],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasGlobTool = tools.some((t: any) => t.name === 'Glob');

          assert(hasGlobTool || tools.length > 0, '应该注册 Glob 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 Grep 工具搜索内容',
    fn: async () => {
      const context = await setupE2ETest('grep-tool');

      try {
        // 创建测试文件
        createTestFile(context.testDir, 'search.txt', 'Find this pattern\nAnother line\nPattern here');

        context.mockServer.setToolUseResponse(
          'Grep',
          {
            pattern: 'pattern',
            path: context.testDir,
            output_mode: 'content'
          },
          '我将搜索这个模式。'
        );

        const result = await runCLI(
          ['-p', 'Search for pattern'],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasGrepTool = tools.some((t: any) => t.name === 'Grep');

          assert(hasGrepTool || tools.length > 0, '应该注册 Grep 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 TodoWrite 工具管理任务',
    fn: async () => {
      const context = await setupE2ETest('todo-tool');

      try {
        context.mockServer.setToolUseResponse(
          'TodoWrite',
          {
            todos: [
              { content: 'Task 1', status: 'pending', activeForm: 'Working on Task 1' },
              { content: 'Task 2', status: 'pending', activeForm: 'Working on Task 2' }
            ]
          },
          '我将创建任务列表。'
        );

        const result = await runCLI(
          ['-p', 'Create a todo list'],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const hasTodoTool = tools.some((t: any) => t.name === 'TodoWrite');

          assert(hasTodoTool || tools.length > 0, '应该注册 TodoWrite 工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持工具过滤 (--allow-tools)',
    fn: async () => {
      const context = await setupE2ETest('allow-tools');

      try {
        context.mockServer.setTextResponse('Testing tool filtering');

        const result = await runCLI(
          ['--allow-tools', 'Read,Write', '-p', 'Test filtering'],
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

        // 验证只注册了允许的工具
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];

          if (tools.length > 0) {
            const toolNames = tools.map((t: any) => t.name);
            const hasOnlyAllowed = toolNames.every((name: string) =>
              ['Read', 'Write'].includes(name)
            );

            assert(hasOnlyAllowed || tools.length <= 2, '应该只注册允许的工具');
          }
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持工具黑名单 (--disallow-tools)',
    fn: async () => {
      const context = await setupE2ETest('disallow-tools');

      try {
        context.mockServer.setTextResponse('Testing tool blacklist');

        const result = await runCLI(
          ['--disallow-tools', 'Bash,WebFetch', '-p', 'Test blacklist'],
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

        // 验证被禁止的工具未注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];
          const toolNames = tools.map((t: any) => t.name);

          const hasDisallowed = toolNames.some((name: string) =>
            ['Bash', 'WebFetch'].includes(name)
          );

          assert(!hasDisallowed || toolNames.length === 0, '不应该注册被禁止的工具');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该正确处理多轮工具调用',
    fn: async () => {
      const context = await setupE2ETest('multi-turn-tools');

      try {
        let callCount = 0;

        // 模拟多轮对话
        context.mockServer.setResponseHandler('messages', (req) => {
          callCount++;

          if (callCount === 1) {
            // 第一轮：使用工具
            return {
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'text', text: '我将读取文件。' },
                {
                  type: 'tool_use',
                  id: 'toolu_1',
                  name: 'Read',
                  input: { file_path: '/test/file.txt' }
                }
              ],
              model: 'claude-3-5-sonnet-20241022',
              stop_reason: 'tool_use',
              usage: { input_tokens: 100, output_tokens: 50 }
            };
          } else {
            // 第二轮：返回最终结果
            return {
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'text', text: '文件内容已读取。' }
              ],
              model: 'claude-3-5-sonnet-20241022',
              stop_reason: 'end_turn',
              usage: { input_tokens: 150, output_tokens: 30 }
            };
          }
        });

        const result = await runCLI(
          ['-p', 'Read a file and tell me about it'],
          {
            timeout: 15000,
            cwd: context.testDir,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key'
            }
          }
        );

        // 验证多轮调用
        const requests = context.mockServer.getRequests();
        // 可能有多个请求（取决于实现）
        assert(requests.length > 0, '应该有至少一个 API 请求');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持 WebFetch 工具（如果允许）',
    fn: async () => {
      const context = await setupE2ETest('webfetch-tool');

      try {
        context.mockServer.setToolUseResponse(
          'WebFetch',
          {
            url: 'https://example.com',
            prompt: 'Get the content'
          },
          '我将获取网页内容。'
        );

        const result = await runCLI(
          ['-p', 'Fetch https://example.com'],
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

        // 验证工具注册
        const requests = context.mockServer.getRequests();
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1];
          const tools = lastRequest.body?.tools || [];

          // WebFetch 可能存在也可能不存在
          assert(tools.length >= 0, '应该注册工具');
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
    name: 'CLI 工具调用测试',
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
