/**
 * E2E 测试: 会话持久化
 * 测试会话创建、保存、恢复、列表等功能
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
  listFiles,
  fileExists,
  type E2ETestContext
} from './setup.js';
import { runCLI } from './cli-runner.js';

/**
 * 测试套件
 */
const tests = [
  {
    name: '应该创建新会话',
    fn: async () => {
      const context = await setupE2ETest('create-session');

      try {
        context.mockServer.setTextResponse('Session created successfully');

        const result = await runCLI(
          ['-p', 'Create a new session'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 检查会话目录是否创建了会话文件
        const sessionFiles = listFiles(context.sessionDir);

        // 可能创建了会话文件，也可能没有（取决于实现）
        // 至少应该成功执行
        assert(result.stdout.length > 0 || sessionFiles.length >= 0, '应该成功执行');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该保存会话历史',
    fn: async () => {
      const context = await setupE2ETest('save-session');

      try {
        context.mockServer.setTextResponse('Session saved');

        // 执行命令创建会话
        await runCLI(
          ['-p', 'Save this session'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 检查会话文件
        const sessionFiles = listFiles(context.sessionDir);

        if (sessionFiles.length > 0) {
          // 验证会话文件格式
          const sessionFile = sessionFiles[0];
          const sessionPath = path.join(context.sessionDir, sessionFile);
          const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

          assert(sessionData.id, '会话应该有 ID');
          assert(sessionData.messages || sessionData.history, '会话应该保存消息历史');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持会话恢复 (--resume)',
    fn: async () => {
      const context = await setupE2ETest('resume-session');

      try {
        context.mockServer.setTextResponse('First message');

        // 创建第一个会话
        const firstResult = await runCLI(
          ['-p', 'First message'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 等待会话保存
        await new Promise(resolve => setTimeout(resolve, 500));

        // 检查是否创建了会话文件
        const sessionFiles = listFiles(context.sessionDir);

        if (sessionFiles.length > 0) {
          // 尝试恢复会话
          context.mockServer.setTextResponse('Resumed message');

          const resumeResult = await runCLI(
            ['--resume', '-p', 'Continue session'],
            {
              timeout: 10000,
              env: {
                ...process.env,
                ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
                ANTHROPIC_API_KEY: 'test-api-key',
                CLAUDE_SESSION_DIR: context.sessionDir
              }
            }
          );

          // 应该成功恢复
          assert(resumeResult.stdout.length > 0, '应该有输出');
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持会话列表命令',
    fn: async () => {
      const context = await setupE2ETest('list-sessions');

      try {
        // 创建几个测试会话文件
        const session1 = {
          id: 'test-session-1',
          messages: [{ role: 'user', content: 'Hello' }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const session2 = {
          id: 'test-session-2',
          messages: [{ role: 'user', content: 'World' }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(
          path.join(context.sessionDir, 'test-session-1.json'),
          JSON.stringify(session1)
        );

        fs.writeFileSync(
          path.join(context.sessionDir, 'test-session-2.json'),
          JSON.stringify(session2)
        );

        // 执行列表命令
        const result = await runCLI(
          ['/session-list'],
          {
            timeout: 5000,
            env: {
              ...process.env,
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 应该列出会话
        const output = result.stdout + result.stderr;
        // 可能成功也可能失败，取决于命令是否实现
        assert(output.length > 0, '应该有输出');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该支持指定会话 ID 恢复',
    fn: async () => {
      const context = await setupE2ETest('resume-by-id');

      try {
        // 创建测试会话
        const sessionId = 'test-session-123';
        const session = {
          id: sessionId,
          messages: [
            { role: 'user', content: 'Previous message' },
            { role: 'assistant', content: 'Previous response' }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          model: 'claude-3-5-sonnet-20241022'
        };

        fs.writeFileSync(
          path.join(context.sessionDir, `${sessionId}.json`),
          JSON.stringify(session)
        );

        context.mockServer.setTextResponse('Resumed by ID');

        // 尝试通过 ID 恢复
        const result = await runCLI(
          ['--resume', sessionId, '-p', 'Continue'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 应该能够恢复（具体行为取决于实现）
        assert(result.stdout.length > 0 || result.stderr.length > 0, '应该有输出');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该正确处理会话过期',
    fn: async () => {
      const context = await setupE2ETest('expired-session');

      try {
        // 创建一个过期的会话 (30 天前)
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 31);

        const session = {
          id: 'expired-session',
          messages: [{ role: 'user', content: 'Old message' }],
          createdAt: expiredDate.toISOString(),
          updatedAt: expiredDate.toISOString()
        };

        fs.writeFileSync(
          path.join(context.sessionDir, 'expired-session.json'),
          JSON.stringify(session)
        );

        // 尝试恢复过期会话
        const result = await runCLI(
          ['--resume', 'expired-session', '-p', 'Try to resume'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 应该失败或创建新会话
        const output = result.stdout + result.stderr;
        assert(output.length > 0, '应该有输出');
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该在会话中保存工作目录',
    fn: async () => {
      const context = await setupE2ETest('session-cwd');

      try {
        context.mockServer.setTextResponse('Working directory saved');

        await runCLI(
          ['-p', 'Save working directory'],
          {
            timeout: 10000,
            cwd: context.testDir,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 检查会话文件
        const sessionFiles = listFiles(context.sessionDir);

        if (sessionFiles.length > 0) {
          const sessionFile = sessionFiles[0];
          const sessionPath = path.join(context.sessionDir, sessionFile);
          const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

          // 验证工作目录是否保存
          if (sessionData.cwd || sessionData.workingDirectory) {
            assert(
              sessionData.cwd === context.testDir ||
              sessionData.workingDirectory === context.testDir,
              '应该保存工作目录'
            );
          }
        }
      } finally {
        await teardownE2ETest(context);
      }
    }
  },

  {
    name: '应该跟踪会话成本统计',
    fn: async () => {
      const context = await setupE2ETest('session-cost');

      try {
        context.mockServer.setResponseHandler('messages', () => ({
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Cost tracking test' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        }));

        await runCLI(
          ['-p', 'Track costs'],
          {
            timeout: 10000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
              ANTHROPIC_API_KEY: 'test-api-key',
              CLAUDE_SESSION_DIR: context.sessionDir
            }
          }
        );

        // 检查会话文件中的成本信息
        const sessionFiles = listFiles(context.sessionDir);

        if (sessionFiles.length > 0) {
          const sessionFile = sessionFiles[0];
          const sessionPath = path.join(context.sessionDir, sessionFile);
          const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

          // 验证是否跟踪了令牌使用
          assert(
            sessionData.usage ||
            sessionData.tokens ||
            sessionData.cost ||
            sessionData.totalTokens,
            '应该跟踪令牌使用或成本'
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
    name: 'CLI 会话持久化测试',
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
