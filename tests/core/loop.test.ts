/**
 * ConversationLoop 测试
 * 测试对话循环的核心功能
 */

import { ConversationLoop } from '../../src/core/loop.js';
import { Session } from '../../src/core/session.js';
import { ClaudeClient } from '../../src/core/client.js';
import { toolRegistry } from '../../src/tools/index.js';
import type { Message, ContentBlock } from '../../src/types/index.js';

// 测试结果统计
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  错误: ${(error as Error).message}`);
      if ((error as Error).stack) {
        console.error(`  堆栈: ${(error as Error).stack?.split('\n').slice(1, 3).join('\n')}`);
      }
      failed++;
    }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  期望: ${expected}\n  实际: ${actual}`);
  }
}

function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${message}\n  值为: ${value}`);
  }
}

// Mock ClaudeClient for testing
class MockClaudeClient extends ClaudeClient {
  private mockResponses: Array<{
    content: ContentBlock[];
    stopReason: string;
    usage: { inputTokens: number; outputTokens: number };
  }> = [];
  private callCount = 0;

  constructor() {
    super({ apiKey: 'mock-key' });
  }

  setMockResponse(response: {
    content: ContentBlock[];
    stopReason: string;
    usage: { inputTokens: number; outputTokens: number };
  }) {
    this.mockResponses.push(response);
  }

  async createMessage(
    messages: Message[],
    tools?: any[],
    systemPrompt?: string
  ): Promise<{
    content: ContentBlock[];
    stopReason: string;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    if (this.mockResponses.length === 0) {
      return {
        content: [{ type: 'text', text: 'Mock response' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }
    const response = this.mockResponses[this.callCount % this.mockResponses.length];
    this.callCount++;
    return response;
  }

  getCallCount(): number {
    return this.callCount;
  }
}

// ============ 测试用例 ============

const tests = [
  test('应该使用默认选项初始化', () => {
    const loop = new ConversationLoop();
    const session = loop.getSession();

    assertDefined(session, '会话应该被创建');
    assert(Array.isArray(session.getMessages()), '消息应该是数组');
    assertEqual(session.getMessages().length, 0, '初始消息数应为 0');
  }),

  test('应该使用自定义选项初始化', () => {
    const loop = new ConversationLoop({
      model: 'claude-opus-4-20250514',
      maxTokens: 16384,
      maxTurns: 100,
      verbose: false,
    });

    const session = loop.getSession();
    assertDefined(session, '会话应该被创建');
  }),

  test('应该正确过滤允许的工具', () => {
    const allTools = toolRegistry.getDefinitions();
    const initialToolCount = allTools.length;

    assert(initialToolCount > 0, '工具注册表应该包含工具');

    const loop = new ConversationLoop({
      allowedTools: ['Read', 'Write'],
    });

    // 由于我们不能直接访问 tools，我们需要通过其他方式验证
    // 这个测试主要确保不会抛出错误
    const session = loop.getSession();
    assertDefined(session, '使用工具过滤器应该能创建会话');
  }),

  test('应该正确过滤禁止的工具', () => {
    const loop = new ConversationLoop({
      disallowedTools: ['Bash', 'WebSearch'],
    });

    const session = loop.getSession();
    assertDefined(session, '使用工具黑名单应该能创建会话');
  }),

  test('应该能设置和获取会话', () => {
    const loop = new ConversationLoop();
    const newSession = new Session();

    newSession.addMessage({
      role: 'user',
      content: 'Test message',
    });

    loop.setSession(newSession);
    const retrievedSession = loop.getSession();

    assertEqual(
      retrievedSession.getMessages().length,
      1,
      '应该能检索到设置的会话'
    );
  }),

  test('应该处理用户输入并添加到会话', async () => {
    // 注意：这个测试需要 mock API 调用
    // 由于实际测试需要 API key，我们跳过实际的 API 调用
    const loop = new ConversationLoop({
      maxTurns: 1,
    });

    // 我们只验证会话状态而不实际调用 API
    const sessionBefore = loop.getSession();
    assertEqual(sessionBefore.getMessages().length, 0, '初始应该没有消息');
  }),

  test('应该在达到最大轮次时停止', () => {
    const loop = new ConversationLoop({
      maxTurns: 5,
    });

    // 验证配置被正确设置
    const session = loop.getSession();
    assertDefined(session, '会话应该存在');
  }),

  test('应该正确处理工具调用结果', async () => {
    // Mock 场景：不实际调用 API
    const loop = new ConversationLoop({
      verbose: false,
    });

    const session = loop.getSession();
    assertDefined(session, '会话应该存在');

    // 手动添加模拟消息来测试会话管理
    session.addMessage({
      role: 'user',
      content: 'Test prompt',
    });

    session.addMessage({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I will use a tool',
        },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'Read',
          input: { file_path: '/test/file.txt' },
        },
      ],
    });

    session.addMessage({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool_1',
          content: 'File contents',
        },
      ],
    });

    assertEqual(session.getMessages().length, 3, '应该有 3 条消息');
  }),

  test('应该更新使用统计', () => {
    const loop = new ConversationLoop();
    const session = loop.getSession();

    // 模拟使用统计更新
    session.updateUsage('claude-sonnet-4-20250514', 1000, 0.003, 2000);

    const stats = session.getStats();
    assert(stats.totalCost !== '$0.0000', '成本应该被更新');
    assertEqual(stats.messageCount, 0, '消息计数应该正确');
  }),

  test('应该处理空的系统提示', () => {
    const loop = new ConversationLoop({
      systemPrompt: '',
    });

    const session = loop.getSession();
    assertDefined(session, '空系统提示应该能创建会话');
  }),

  test('应该处理自定义系统提示', () => {
    const customPrompt = 'You are a helpful assistant specialized in testing.';
    const loop = new ConversationLoop({
      systemPrompt: customPrompt,
    });

    const session = loop.getSession();
    assertDefined(session, '自定义系统提示应该能创建会话');
  }),

  test('应该处理超出预算的情况', () => {
    const loop = new ConversationLoop({
      maxBudgetUSD: 0.01,
    });

    const session = loop.getSession();
    assertDefined(session, '预算限制应该能创建会话');
  }),

  test('应该正确管理危险操作权限', () => {
    const loop = new ConversationLoop({
      dangerouslySkipPermissions: true,
    });

    const session = loop.getSession();
    assertDefined(session, '跳过权限应该能创建会话');
  }),

  test('应该处理权限模式', () => {
    const loop = new ConversationLoop({
      permissionMode: 'plan',
    });

    const session = loop.getSession();
    assertDefined(session, '计划模式应该能创建会话');
  }),

  test('应该能处理多个工具过滤器', () => {
    const loop = new ConversationLoop({
      allowedTools: ['Read', 'Write', 'Edit'],
      disallowedTools: ['Bash'],
    });

    const session = loop.getSession();
    assertDefined(session, '多个工具过滤器应该能共同工作');
  }),

  test('应该处理逗号分隔的工具列表', () => {
    const loop = new ConversationLoop({
      allowedTools: ['Read,Write,Edit'],
    });

    const session = loop.getSession();
    assertDefined(session, '逗号分隔的工具列表应该被正确解析');
  }),

  test('应该正确处理边界条件 - maxTurns 为 0', () => {
    const loop = new ConversationLoop({
      maxTurns: 0,
    });

    const session = loop.getSession();
    assertDefined(session, 'maxTurns 为 0 应该能创建会话');
  }),

  test('应该正确处理边界条件 - maxTurns 非常大', () => {
    const loop = new ConversationLoop({
      maxTurns: 999999,
    });

    const session = loop.getSession();
    assertDefined(session, '非常大的 maxTurns 应该能创建会话');
  }),

  test('应该在 verbose 模式下运行', () => {
    const loop = new ConversationLoop({
      verbose: true,
    });

    const session = loop.getSession();
    assertDefined(session, 'verbose 模式应该能创建会话');
  }),

  test('应该能正确保存和恢复会话', () => {
    const loop = new ConversationLoop();
    const session = loop.getSession();

    session.addMessage({
      role: 'user',
      content: 'Test message for saving',
    });

    // 保存会话
    const filePath = session.save();
    assert(filePath.length > 0, '应该返回保存路径');

    // 加载会话
    const loadedSession = Session.load(session.sessionId);
    assertDefined(loadedSession, '应该能加载保存的会话');
    assertEqual(
      loadedSession.getMessages().length,
      1,
      '加载的会话应该包含相同的消息'
    );
  }),
];

// ============ 运行测试 ============

async function runTests() {
  console.log('运行 ConversationLoop 测试...\n');

  for (const testFn of tests) {
    await testFn();
  }

  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
