/**
 * Session 测试
 * 测试会话管理的核心功能
 */

import { Session } from '../../src/core/session.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Message } from '../../src/types/index.js';

// 测试配置目录
const TEST_SESSION_DIR = path.join(os.tmpdir(), 'claude-test-sessions');
const TEST_CWD = os.tmpdir();

// 清理测试环境
function cleanup() {
  if (fs.existsSync(TEST_SESSION_DIR)) {
    fs.rmSync(TEST_SESSION_DIR, { recursive: true, force: true });
  }
}

// 初始化测试环境
function setup() {
  cleanup();

  // Mock HOME 环境变量
  const originalHome = process.env.HOME;
  const testHome = os.tmpdir();
  process.env.HOME = testHome;

  const claudeDir = path.join(testHome, '.claude', 'sessions');
  fs.mkdirSync(claudeDir, { recursive: true });

  return () => {
    process.env.HOME = originalHome;
  };
}

// 测试结果统计
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    const restore = setup();
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
    } finally {
      restore();
      cleanup();
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

// ============ 测试用例 ============

const tests = [
  test('应该创建新会话', () => {
    const session = new Session(TEST_CWD);

    assertDefined(session, '会话应该被创建');
    assert(session.sessionId.length > 0, '会话 ID 应该存在');
    assertEqual(session.cwd, TEST_CWD, '工作目录应该正确');
  }),

  test('应该生成唯一的会话 ID', () => {
    const session1 = new Session(TEST_CWD);
    const session2 = new Session(TEST_CWD);

    assert(session1.sessionId !== session2.sessionId, '会话 ID 应该唯一');
  }),

  test('应该初始化空消息列表', () => {
    const session = new Session(TEST_CWD);
    const messages = session.getMessages();

    assert(Array.isArray(messages), '消息应该是数组');
    assertEqual(messages.length, 0, '初始消息数应为 0');
  }),

  test('应该添加用户消息', () => {
    const session = new Session(TEST_CWD);
    const message: Message = {
      role: 'user',
      content: 'Hello, Claude!',
    };

    session.addMessage(message);
    const messages = session.getMessages();

    assertEqual(messages.length, 1, '应该有 1 条消息');
    assertEqual(messages[0].role, 'user', '消息角色应该是 user');
    assertEqual(messages[0].content, 'Hello, Claude!', '消息内容应该正确');
  }),

  test('应该添加助手消息', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({
      role: 'user',
      content: 'Question',
    });

    session.addMessage({
      role: 'assistant',
      content: 'Answer',
    });

    const messages = session.getMessages();
    assertEqual(messages.length, 2, '应该有 2 条消息');
    assertEqual(messages[1].role, 'assistant', '第二条消息应该是 assistant');
  }),

  test('应该添加包含多个块的消息', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will read a file' },
        { type: 'tool_use', id: 'tool_1', name: 'Read', input: { file_path: '/test.txt' } },
      ],
    });

    const messages = session.getMessages();
    assertEqual(messages.length, 1, '应该有 1 条消息');
    assert(Array.isArray(messages[0].content), '消息内容应该是数组');
  }),

  test('应该清除所有消息', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Message 1' });
    session.addMessage({ role: 'assistant', content: 'Message 2' });
    session.addMessage({ role: 'user', content: 'Message 3' });

    assertEqual(session.getMessages().length, 3, '应该有 3 条消息');

    session.clearMessages();
    assertEqual(session.getMessages().length, 0, '清除后应该没有消息');
  }),

  test('应该正确管理 TODO 列表', () => {
    const session = new Session(TEST_CWD);

    const todos = [
      { content: 'Task 1', status: 'pending' as const, activeForm: 'Doing task 1' },
      { content: 'Task 2', status: 'in_progress' as const, activeForm: 'Doing task 2' },
    ];

    session.setTodos(todos);
    const retrieved = session.getTodos();

    assertEqual(retrieved.length, 2, '应该有 2 个 TODO');
    assertEqual(retrieved[0].content, 'Task 1', 'TODO 内容应该正确');
    assertEqual(retrieved[1].status, 'in_progress', 'TODO 状态应该正确');
  }),

  test('应该更新使用统计', () => {
    const session = new Session(TEST_CWD);

    session.updateUsage('claude-sonnet-4-20250514', 1000, 0.003, 2000);

    const stats = session.getStats();
    assert(stats.totalCost !== '$0.0000', '成本应该被更新');
    assert(stats.duration >= 0, '持续时间应该非负');
    assertEqual(stats.messageCount, 0, '消息计数应该为 0');
  }),

  test('应该累积多次使用统计', () => {
    const session = new Session(TEST_CWD);

    session.updateUsage('claude-sonnet-4-20250514', 1000, 0.003, 1000);
    session.updateUsage('claude-sonnet-4-20250514', 500, 0.0015, 500);

    const stats = session.getStats();
    assert(stats.modelUsage['claude-sonnet-4-20250514'] === 1500, 'token 使用应该累积');
  }),

  test('应该跟踪多个模型的使用', () => {
    const session = new Session(TEST_CWD);

    session.updateUsage('claude-sonnet-4-20250514', 1000, 0.003, 1000);
    session.updateUsage('claude-opus-4-20250514', 500, 0.005, 500);

    const stats = session.getStats();
    assert('claude-sonnet-4-20250514' in stats.modelUsage, '应该跟踪 Sonnet 使用');
    assert('claude-opus-4-20250514' in stats.modelUsage, '应该跟踪 Opus 使用');
  }),

  test('应该设置工作目录', () => {
    const session = new Session(TEST_CWD);
    const originalCwd = process.cwd();

    try {
      const newCwd = os.tmpdir();
      session.setCwd(newCwd);

      assertEqual(session.cwd, newCwd, '会话的 cwd 应该被更新');
      assertEqual(process.cwd(), newCwd, 'process.cwd() 应该被更新');
    } finally {
      process.chdir(originalCwd);
    }
  }),

  test('应该设置自定义标题', () => {
    const session = new Session(TEST_CWD);

    session.setCustomTitle('My Custom Session');

    // 由于 customTitle 是私有的，我们通过保存和加载来验证
    const filePath = session.save();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    assertEqual(data.metadata.customTitle, 'My Custom Session', '自定义标题应该被保存');
  }),

  test('应该获取第一条用户提示', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({
      role: 'user',
      content: 'This is my first prompt that should be used as a summary',
    });

    const firstPrompt = session.getFirstPrompt();
    assertDefined(firstPrompt, '应该返回第一条提示');
    assert(firstPrompt.length <= 100, '提示应该被截断到 100 字符');
  }),

  test('应该保存会话到文件', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Test message' });
    session.updateUsage('claude-sonnet-4-20250514', 100, 0.0003, 1000);

    const filePath = session.save();

    assert(fs.existsSync(filePath), '会话文件应该存在');

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assertEqual(data.messages.length, 1, '保存的消息数应该正确');
    assertEqual(data.state.sessionId, session.sessionId, '会话 ID 应该正确');
  }),

  test('应该包含完整的元数据', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Hello' });
    const filePath = session.save();

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    assertDefined(data.metadata, '应该包含元数据');
    assertDefined(data.metadata.created, '应该包含创建时间');
    assertDefined(data.metadata.modified, '应该包含修改时间');
    assertEqual(data.metadata.messageCount, 1, '消息计数应该正确');
  }),

  test('应该加载保存的会话', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Original message' });
    session.updateUsage('claude-sonnet-4-20250514', 100, 0.0003, 1000);
    session.save();

    const loadedSession = Session.load(session.sessionId);
    assertDefined(loadedSession, '应该能加载会话');
    assertEqual(loadedSession.sessionId, session.sessionId, '会话 ID 应该匹配');
    assertEqual(loadedSession.getMessages().length, 1, '消息应该被加载');
  }),

  test('加载不存在的会话应该返回 null', () => {
    const loaded = Session.load('non-existent-session-id');
    assertEqual(loaded, null, '不存在的会话应该返回 null');
  }),

  test('应该列出所有会话', () => {
    const session1 = new Session(TEST_CWD);
    const session2 = new Session(TEST_CWD);

    session1.save();
    session2.save();

    const sessions = Session.listSessions();

    assert(sessions.length >= 2, '应该至少有 2 个会话');
    assert(sessions.some(s => s.id === session1.sessionId), '应该包含 session1');
    assert(sessions.some(s => s.id === session2.sessionId), '应该包含 session2');
  }),

  test('会话列表应该按时间排序', () => {
    const session1 = new Session(TEST_CWD);
    session1.save();

    // 等待一小段时间确保时间戳不同
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    return sleep(10).then(() => {
      const session2 = new Session(TEST_CWD);
      session2.save();

      const sessions = Session.listSessions();

      if (sessions.length >= 2) {
        // 最新的会话应该在前面
        assert(
          sessions[0].startTime >= sessions[sessions.length - 1].startTime,
          '会话应该按时间降序排列'
        );
      }
    });
  }),

  test('应该处理无效的会话文件', () => {
    const claudeDir = path.join(process.env.HOME || '~', '.claude', 'sessions');
    const invalidFile = path.join(claudeDir, 'invalid.json');

    fs.writeFileSync(invalidFile, 'invalid json content');

    const sessions = Session.listSessions();

    // 应该忽略无效文件
    assert(
      !sessions.some(s => s.id === 'invalid'),
      '应该忽略无效的会话文件'
    );
  }),

  test('应该获取会话统计信息', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Message 1' });
    session.addMessage({ role: 'assistant', content: 'Message 2' });
    session.updateUsage('claude-sonnet-4-20250514', 1000, 0.003, 2000);

    const stats = session.getStats();

    assert(stats.duration >= 0, '持续时间应该非负');
    assertEqual(stats.messageCount, 2, '消息计数应该正确');
    assert(stats.totalCost.startsWith('$'), '成本应该包含货币符号');
    assert('claude-sonnet-4-20250514' in stats.modelUsage, '应该包含模型使用信息');
  }),

  test('应该处理空的 TODO 列表', () => {
    const session = new Session(TEST_CWD);

    const todos = session.getTodos();
    assertEqual(todos.length, 0, '初始 TODO 列表应该为空');
  }),

  test('应该返回消息的副本', () => {
    const session = new Session(TEST_CWD);

    session.addMessage({ role: 'user', content: 'Test' });

    const messages1 = session.getMessages();
    const messages2 = session.getMessages();

    assert(messages1 !== messages2, '应该返回消息的新副本');
    assertEqual(messages1.length, messages2.length, '副本内容应该相同');
  }),

  test('应该返回 TODO 的副本', () => {
    const session = new Session(TEST_CWD);

    const todos = [
      { content: 'Task', status: 'pending' as const, activeForm: 'Doing task' },
    ];
    session.setTodos(todos);

    const todos1 = session.getTodos();
    const todos2 = session.getTodos();

    assert(todos1 !== todos2, '应该返回 TODO 的新副本');
    assertEqual(todos1.length, todos2.length, '副本内容应该相同');
  }),

  test('应该处理非常长的消息', () => {
    const session = new Session(TEST_CWD);

    const longMessage = 'x'.repeat(100000);
    session.addMessage({ role: 'user', content: longMessage });

    const messages = session.getMessages();
    assertEqual(messages[0].content, longMessage, '应该保存完整的长消息');
  }),

  test('应该处理特殊字符', () => {
    const session = new Session(TEST_CWD);

    const specialContent = 'Hello 世界 🌍 \n\t "quotes" \'apostrophes\'';
    session.addMessage({ role: 'user', content: specialContent });

    session.save();
    const loaded = Session.load(session.sessionId);

    assertDefined(loaded, '应该能加载包含特殊字符的会话');
    assertEqual(loaded.getMessages()[0].content, specialContent, '特殊字符应该被保留');
  }),
];

// ============ 运行测试 ============

async function runTests() {
  console.log('运行 Session 测试...\n');

  for (const testFn of tests) {
    await testFn();
  }

  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

  cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('测试运行失败:', error);
  cleanup();
  process.exit(1);
});
