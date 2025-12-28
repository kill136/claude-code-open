/**
 * SessionManager 单元测试
 * 测试会话管理的所有核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Session } from '../../src/core/session.js';
import {
  SessionManager,
  generateSessionId,
  createSession,
  saveSession,
  loadSession,
  deleteSession,
  listSessions,
  getRecentSession,
  addMessageToSession,
  forkSession,
  mergeSessions,
  getSessionStatistics,
  cleanupSessions,
  type SessionData,
  type SessionMetadata,
} from '../../src/session/index.js';
import {
  saveSummary,
  loadSummary,
  hasSummary,
  buildResumeMessage,
  deleteSummary,
  listSummaries,
} from '../../src/session/resume.js';
import {
  cleanupExpiredData,
  getCutoffDate,
} from '../../src/session/cleanup.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Message } from '../../src/types/index.js';

// 测试环境配置
const TEST_HOME = path.join(os.tmpdir(), 'claude-test-' + Date.now());
const TEST_SESSIONS_DIR = path.join(TEST_HOME, '.claude', 'sessions');
const TEST_CWD = os.tmpdir();

// 保存原始环境
let originalHome: string | undefined;

// 设置测试环境
beforeEach(() => {
  // Mock HOME 环境变量
  originalHome = process.env.HOME;
  process.env.HOME = TEST_HOME;

  // 创建测试目录
  if (!fs.existsSync(TEST_SESSIONS_DIR)) {
    fs.mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
  }
});

// 清理测试环境
afterEach(() => {
  // 恢复环境变量
  if (originalHome !== undefined) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }

  // 清理测试目录
  if (fs.existsSync(TEST_HOME)) {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  }
});

// ============ Session 类测试 ============

describe('Session 类', () => {
  describe('会话创建和初始化', () => {
    it('应该创建新会话并生成 UUID', () => {
      const session = new Session(TEST_CWD);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.sessionId.length).toBeGreaterThan(0);
      expect(session.cwd).toBe(TEST_CWD);
    });

    it('应该生成唯一的会话 ID', () => {
      const session1 = new Session(TEST_CWD);
      const session2 = new Session(TEST_CWD);

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('应该初始化空消息列表', () => {
      const session = new Session(TEST_CWD);
      const messages = session.getMessages();

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(0);
    });

    it('应该初始化空 TODO 列表', () => {
      const session = new Session(TEST_CWD);
      const todos = session.getTodos();

      expect(Array.isArray(todos)).toBe(true);
      expect(todos.length).toBe(0);
    });
  });

  describe('消息管理', () => {
    it('应该添加用户消息', () => {
      const session = new Session(TEST_CWD);
      const message: Message = {
        role: 'user',
        content: 'Hello, Claude!',
      };

      session.addMessage(message);
      const messages = session.getMessages();

      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello, Claude!');
    });

    it('应该添加助手消息', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({ role: 'user', content: 'Question' });
      session.addMessage({ role: 'assistant', content: 'Answer' });

      const messages = session.getMessages();
      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe('assistant');
    });

    it('应该添加包含工具使用的消息', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read a file' },
          { type: 'tool_use', id: 'tool_1', name: 'Read', input: { file_path: '/test.txt' } },
        ],
      });

      const messages = session.getMessages();
      expect(messages.length).toBe(1);
      expect(Array.isArray(messages[0].content)).toBe(true);
    });

    it('应该清除所有消息', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({ role: 'user', content: 'Message 1' });
      session.addMessage({ role: 'assistant', content: 'Message 2' });
      session.addMessage({ role: 'user', content: 'Message 3' });

      expect(session.getMessages().length).toBe(3);

      session.clearMessages();
      expect(session.getMessages().length).toBe(0);
    });

    it('应该返回消息的副本（防止外部修改）', () => {
      const session = new Session(TEST_CWD);
      session.addMessage({ role: 'user', content: 'Test' });

      const messages1 = session.getMessages();
      const messages2 = session.getMessages();

      expect(messages1).not.toBe(messages2); // 不是同一个引用
      expect(messages1.length).toBe(messages2.length);
    });

    it('应该处理非常长的消息', () => {
      const session = new Session(TEST_CWD);
      const longMessage = 'x'.repeat(100000);

      session.addMessage({ role: 'user', content: longMessage });

      const messages = session.getMessages();
      expect(messages[0].content).toBe(longMessage);
    });
  });

  describe('TODO 管理', () => {
    it('应该设置和获取 TODO 列表', () => {
      const session = new Session(TEST_CWD);

      const todos = [
        { content: 'Task 1', status: 'pending' as const, activeForm: 'Doing task 1' },
        { content: 'Task 2', status: 'in_progress' as const, activeForm: 'Doing task 2' },
      ];

      session.setTodos(todos);
      const retrieved = session.getTodos();

      expect(retrieved.length).toBe(2);
      expect(retrieved[0].content).toBe('Task 1');
      expect(retrieved[1].status).toBe('in_progress');
    });

    it('应该返回 TODO 的副本', () => {
      const session = new Session(TEST_CWD);

      const todos = [{ content: 'Task', status: 'pending' as const, activeForm: 'Doing task' }];
      session.setTodos(todos);

      const todos1 = session.getTodos();
      const todos2 = session.getTodos();

      expect(todos1).not.toBe(todos2);
      expect(todos1.length).toBe(todos2.length);
    });
  });

  describe('使用统计和成本追踪', () => {
    it('应该更新使用统计', () => {
      const session = new Session(TEST_CWD);

      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 1000, outputTokens: 500 },
        0.003,
        2000
      );

      const stats = session.getStats();
      expect(stats.totalCost).not.toBe('$0.0000');
      expect(stats.duration).toBeGreaterThanOrEqual(0);
      expect(stats.totalTokens).toBe(1500);
    });

    it('应该累积多次使用统计', () => {
      const session = new Session(TEST_CWD);

      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 1000, outputTokens: 500 },
        0.003,
        1000
      );
      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 500, outputTokens: 250 },
        0.0015,
        500
      );

      const stats = session.getStats();
      expect(stats.modelUsage['claude-sonnet-4-20250514'].inputTokens).toBe(1500);
      expect(stats.modelUsage['claude-sonnet-4-20250514'].outputTokens).toBe(750);
      expect(stats.totalTokens).toBe(2250);
    });

    it('应该跟踪多个模型的使用', () => {
      const session = new Session(TEST_CWD);

      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 1000, outputTokens: 500 },
        0.003,
        1000
      );
      session.updateUsage(
        'claude-opus-4-20250514',
        { inputTokens: 500, outputTokens: 250 },
        0.005,
        500
      );

      const stats = session.getStats();
      expect('claude-sonnet-4-20250514' in stats.modelUsage).toBe(true);
      expect('claude-opus-4-20250514' in stats.modelUsage).toBe(true);
    });

    it('应该跟踪缓存读取和创建 token', () => {
      const session = new Session(TEST_CWD);

      session.updateUsage(
        'claude-sonnet-4-20250514',
        {
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadInputTokens: 200,
          cacheCreationInputTokens: 100,
        },
        0.003,
        1000
      );

      const stats = session.getStats();
      expect(stats.modelUsage['claude-sonnet-4-20250514'].cacheReadInputTokens).toBe(200);
      expect(stats.modelUsage['claude-sonnet-4-20250514'].cacheCreationInputTokens).toBe(100);
    });

    it('应该跟踪工具执行时间', () => {
      const session = new Session(TEST_CWD);

      session.updateToolDuration(1000);
      session.updateToolDuration(500);

      const stats = session.getStats();
      expect(stats.totalToolDuration).toBe(1500);
    });
  });

  describe('会话持久化', () => {
    it('应该保存会话到文件', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({ role: 'user', content: 'Test message' });
      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 100, outputTokens: 50 },
        0.0003,
        1000
      );

      const filePath = session.save();

      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.messages.length).toBe(1);
      expect(data.state.sessionId).toBe(session.sessionId);
      expect(data.version).toBeDefined();
    });

    it('应该包含完整的元数据', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({ role: 'user', content: 'Hello' });
      session.setCustomTitle('My Custom Session');
      const filePath = session.save();

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      expect(data.metadata).toBeDefined();
      expect(data.metadata.created).toBeDefined();
      expect(data.metadata.modified).toBeDefined();
      expect(data.metadata.messageCount).toBe(1);
      expect(data.metadata.customTitle).toBe('My Custom Session');
    });

    it('应该加载保存的会话', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({ role: 'user', content: 'Original message' });
      session.updateUsage(
        'claude-sonnet-4-20250514',
        { inputTokens: 100, outputTokens: 50 },
        0.0003,
        1000
      );
      session.save();

      const loadedSession = Session.load(session.sessionId);
      expect(loadedSession).not.toBeNull();
      expect(loadedSession!.sessionId).toBe(session.sessionId);
      expect(loadedSession!.getMessages().length).toBe(1);
      expect(loadedSession!.getMessages()[0].content).toBe('Original message');
    });

    it('加载不存在的会话应该返回 null', () => {
      const loaded = Session.load('non-existent-session-id');
      expect(loaded).toBeNull();
    });

    it('应该处理特殊字符的保存和加载', () => {
      const session = new Session(TEST_CWD);

      const specialContent = 'Hello 世界 🌍 \n\t "quotes" \'apostrophes\'';
      session.addMessage({ role: 'user', content: specialContent });

      session.save();
      const loaded = Session.load(session.sessionId);

      expect(loaded).not.toBeNull();
      expect(loaded!.getMessages()[0].content).toBe(specialContent);
    });
  });

  describe('会话列表', () => {
    it('应该列出所有会话', () => {
      const session1 = new Session(TEST_CWD);
      const session2 = new Session(TEST_CWD);

      session1.save();
      session2.save();

      const sessions = Session.listSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some(s => s.id === session1.sessionId)).toBe(true);
      expect(sessions.some(s => s.id === session2.sessionId)).toBe(true);
    });

    it('会话列表应该按时间降序排序', async () => {
      const session1 = new Session(TEST_CWD);
      session1.save();

      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      const session2 = new Session(TEST_CWD);
      session2.save();

      const sessions = Session.listSessions();

      if (sessions.length >= 2) {
        expect(sessions[0].startTime).toBeGreaterThanOrEqual(sessions[sessions.length - 1].startTime);
      }
    });

    it('应该忽略无效的会话文件', () => {
      const invalidFile = path.join(TEST_SESSIONS_DIR, 'invalid.json');
      fs.writeFileSync(invalidFile, 'invalid json content');

      const sessions = Session.listSessions();

      // 应该不包含无效文件
      expect(sessions.every(s => s.id !== 'invalid')).toBe(true);
    });
  });

  describe('会话过期清理', () => {
    it('应该清理过期的会话', () => {
      const session = new Session(TEST_CWD);
      const filePath = session.save();

      // 修改会话的 metadata.modified 为 31 天前
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.metadata.modified = Date.now() - (31 * 24 * 60 * 60 * 1000);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      const cleaned = Session.cleanupExpiredSessions(30);

      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('应该保留未过期的会话', () => {
      const session = new Session(TEST_CWD);
      session.save();

      const cleaned = Session.cleanupExpiredSessions(30);

      const filePath = path.join(TEST_SESSIONS_DIR, `${session.sessionId}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('应该删除损坏的会话文件', () => {
      const corruptedFile = path.join(TEST_SESSIONS_DIR, 'corrupted.json');
      fs.writeFileSync(corruptedFile, '{ invalid json }');

      const cleaned = Session.cleanupExpiredSessions(30);

      expect(fs.existsSync(corruptedFile)).toBe(false);
    });
  });

  describe('工作目录管理', () => {
    it('应该设置工作目录', () => {
      const session = new Session(TEST_CWD);
      const originalCwd = process.cwd();

      try {
        const newCwd = os.tmpdir();
        session.setCwd(newCwd);

        expect(session.cwd).toBe(newCwd);
        expect(process.cwd()).toBe(newCwd);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('应该获取原始工作目录', () => {
      const session = new Session(TEST_CWD);

      expect(session.getOriginalCwd()).toBe(TEST_CWD);

      session.setCwd(os.tmpdir());
      expect(session.getOriginalCwd()).toBe(TEST_CWD); // 原始目录不变
    });
  });

  describe('其他功能', () => {
    it('应该设置自定义标题', () => {
      const session = new Session(TEST_CWD);
      session.setCustomTitle('My Custom Session');

      const filePath = session.save();
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      expect(data.metadata.customTitle).toBe('My Custom Session');
    });

    it('应该获取第一条用户提示', () => {
      const session = new Session(TEST_CWD);

      session.addMessage({
        role: 'user',
        content: 'This is my first prompt that should be used as a summary',
      });

      const firstPrompt = session.getFirstPrompt();
      expect(firstPrompt).toBeDefined();
      expect(firstPrompt!.length).toBeLessThanOrEqual(100);
    });

    it('当没有用户消息时返回 undefined', () => {
      const session = new Session(TEST_CWD);
      session.addMessage({ role: 'assistant', content: 'Assistant message' });

      const firstPrompt = session.getFirstPrompt();
      expect(firstPrompt).toBeUndefined();
    });
  });
});

// ============ SessionManager 类测试 ============

describe('SessionManager 类', () => {
  describe('会话管理器初始化', () => {
    it('应该创建 SessionManager 实例', () => {
      const manager = new SessionManager();
      expect(manager).toBeDefined();
    });

    it('应该支持自动保存选项', () => {
      const manager = new SessionManager({ autoSave: true });
      expect(manager).toBeDefined();
    });

    it('应该支持禁用自动保存', () => {
      const manager = new SessionManager({ autoSave: false });
      expect(manager).toBeDefined();
    });
  });

  describe('会话创建和启动', () => {
    it('应该启动新会话', () => {
      const manager = new SessionManager({ autoSave: false });

      const session = manager.start({
        model: 'claude-sonnet-4-20250514',
        name: 'Test Session',
      });

      expect(session).toBeDefined();
      expect(session.metadata.model).toBe('claude-sonnet-4-20250514');
      expect(session.metadata.name).toBe('Test Session');
    });

    it('应该生成唯一的会话 ID', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe('消息添加', () => {
    it('应该添加消息到当前会话', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage(
        { role: 'user', content: 'Hello' },
        { input: 100, output: 50 }
      );

      const session = manager.getCurrent();
      expect(session).not.toBeNull();
      expect(session!.messages.length).toBe(1);
      expect(session!.metadata.tokenUsage.input).toBe(100);
      expect(session!.metadata.tokenUsage.output).toBe(50);
    });

    it('当没有当前会话时不应该抛出错误', () => {
      const manager = new SessionManager({ autoSave: false });

      expect(() => {
        manager.addMessage({ role: 'user', content: 'Hello' });
      }).not.toThrow();
    });
  });

  describe('会话恢复', () => {
    it('应该恢复已保存的会话', () => {
      const manager = new SessionManager({ autoSave: false });

      const session = manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage({ role: 'user', content: 'Test' });
      manager.save();

      const newManager = new SessionManager({ autoSave: false });
      const resumed = newManager.resume(session.metadata.id);

      expect(resumed).not.toBeNull();
      expect(resumed!.metadata.id).toBe(session.metadata.id);
      expect(resumed!.messages.length).toBe(1);
    });

    it('恢复不存在的会话应该返回 null', () => {
      const manager = new SessionManager({ autoSave: false });
      const resumed = manager.resume('non-existent-id');

      expect(resumed).toBeNull();
    });
  });

  describe('会话 Fork 和 Merge', () => {
    it('应该 fork 当前会话', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage({ role: 'user', content: 'Message 1' });
      manager.addMessage({ role: 'assistant', content: 'Response 1' });
      manager.save();

      const forked = manager.fork({ name: 'Forked Session' });

      expect(forked).not.toBeNull();
      expect(forked!.metadata.name).toBe('Forked Session');
      expect(forked!.metadata.parentId).toBeDefined();
      expect(forked!.messages.length).toBe(2);
    });

    it('应该合并会话', () => {
      const manager1 = new SessionManager({ autoSave: false });
      const session1 = manager1.start({ model: 'claude-sonnet-4-20250514' });
      manager1.addMessage({ role: 'user', content: 'Session 1' });
      manager1.save();

      const manager2 = new SessionManager({ autoSave: false });
      const session2 = manager2.start({ model: 'claude-sonnet-4-20250514' });
      manager2.addMessage({ role: 'user', content: 'Session 2' });
      manager2.save();

      const merged = manager1.merge(session2.metadata.id);

      expect(merged).toBe(true);
      const current = manager1.getCurrent();
      expect(current!.messages.length).toBe(2);
    });
  });

  describe('会话导出', () => {
    it('应该导出为 JSON 格式', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage({ role: 'user', content: 'Hello' });

      const exported = manager.export('json');

      expect(exported).not.toBeNull();
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported!)).not.toThrow();
    });

    it('应该导出为 Markdown 格式', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage({ role: 'user', content: 'Hello' });

      const exported = manager.export('markdown');

      expect(exported).not.toBeNull();
      expect(typeof exported).toBe('string');
      expect(exported).toContain('Hello');
    });
  });

  describe('会话统计', () => {
    it('应该返回会话摘要', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514', name: 'Test' });
      manager.addMessage({ role: 'user', content: 'Hello' }, { input: 10, output: 5 });

      const summary = manager.getSummary();

      expect(summary).not.toBeNull();
      expect(summary!.name).toBe('Test');
      expect(summary!.messageCount).toBe(1);
      expect(summary!.tokenUsage.input).toBe(10);
      expect(summary!.tokenUsage.output).toBe(5);
    });

    it('应该计算成本', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.updateCost(1000000, 500000);

      const summary = manager.getSummary();
      expect(summary!.cost).toBeGreaterThan(0);
    });
  });

  describe('会话结束', () => {
    it('应该结束会话并清理', () => {
      const manager = new SessionManager({ autoSave: false });

      manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.end();

      const current = manager.getCurrent();
      expect(current).toBeNull();
    });
  });
});

// ============ Resume 功能测试 ============

describe('Resume 功能', () => {
  // 在所有 resume 测试后清理摘要文件
  const testSummaryIds: string[] = [];

  afterEach(() => {
    // 清理测试创建的摘要文件
    for (const id of testSummaryIds) {
      try {
        deleteSummary(id);
      } catch {
        // 忽略错误
      }
    }
    testSummaryIds.length = 0;
  });

  it('应该保存摘要', () => {
    const sessionId = generateSessionId();
    testSummaryIds.push(sessionId);

    const summary = 'This is a test summary';
    saveSummary(sessionId, summary);

    expect(hasSummary(sessionId)).toBe(true);
  });

  it('应该加载摘要', () => {
    const sessionId = generateSessionId();
    testSummaryIds.push(sessionId);

    const summary = 'This is a test summary';
    saveSummary(sessionId, summary);

    const loaded = loadSummary(sessionId);
    expect(loaded).toBe(summary);
  });

  it('加载不存在的摘要应该返回 null', () => {
    const loaded = loadSummary('non-existent-id-12345678');
    expect(loaded).toBeNull();
  });

  it('应该检查摘要是否存在', () => {
    const sessionId = generateSessionId();
    testSummaryIds.push(sessionId);

    expect(hasSummary(sessionId)).toBe(false);

    saveSummary(sessionId, 'Summary');
    expect(hasSummary(sessionId)).toBe(true);
  });

  it('应该删除摘要', () => {
    const sessionId = generateSessionId();
    testSummaryIds.push(sessionId);

    saveSummary(sessionId, 'Summary');
    expect(hasSummary(sessionId)).toBe(true);

    deleteSummary(sessionId);
    expect(hasSummary(sessionId)).toBe(false);
  });

  it('应该构建 resume 消息', () => {
    const summary = 'Previous conversation summary';
    const message = buildResumeMessage(summary, false);

    expect(message).toContain(summary);
    expect(message).toContain('continued from a previous conversation');
  });

  it('应该为非交互模式构建 resume 消息', () => {
    const summary = 'Previous conversation summary';
    const message = buildResumeMessage(summary, true);

    expect(message).toContain(summary);
    expect(message).not.toContain('Please continue');
  });

  it('应该列出所有摘要', () => {
    const sessionId1 = generateSessionId();
    const sessionId2 = generateSessionId();

    saveSummary(sessionId1, 'Summary 1');
    saveSummary(sessionId2, 'Summary 2');

    const summaries = listSummaries();

    expect(summaries.length).toBeGreaterThanOrEqual(2);
    expect(summaries.some(s => s.uuid === sessionId1)).toBe(true);
    expect(summaries.some(s => s.uuid === sessionId2)).toBe(true);
  });
});

// ============ Cleanup 功能测试 ============

describe('Cleanup 功能', () => {
  it('应该计算清理截止日期', () => {
    const cutoff = getCutoffDate(30);
    const expected = Date.now() - (30 * 24 * 60 * 60 * 1000);

    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1000);
  });

  it.skip('应该清理过期数据 (集成测试)', () => {
    // 此测试依赖真实文件系统路径，跳过以避免环境问题
    // 在集成测试环境中测试此功能
  });

  it.skip('应该保留未过期的数据 (集成测试)', () => {
    // 此测试依赖真实文件系统路径，跳过以避免环境问题
    // 在集成测试环境中测试此功能
  });
});

// ============ 并发会话测试 ============

describe('并发会话处理', () => {
  it('应该支持多个并发会话', () => {
    const manager1 = new SessionManager({ autoSave: false });
    const manager2 = new SessionManager({ autoSave: false });

    const session1 = manager1.start({ model: 'claude-sonnet-4-20250514' });
    const session2 = manager2.start({ model: 'claude-opus-4-20250514' });

    expect(session1.metadata.id).not.toBe(session2.metadata.id);

    manager1.addMessage({ role: 'user', content: 'Session 1 message' });
    manager2.addMessage({ role: 'user', content: 'Session 2 message' });

    expect(manager1.getCurrent()!.messages.length).toBe(1);
    expect(manager2.getCurrent()!.messages.length).toBe(1);
  });

  it('应该并发保存多个会话', () => {
    const sessions = [];

    for (let i = 0; i < 5; i++) {
      const manager = new SessionManager({ autoSave: false });
      const session = manager.start({ model: 'claude-sonnet-4-20250514' });
      manager.addMessage({ role: 'user', content: `Message ${i}` });
      manager.save();
      sessions.push(session.metadata.id);
    }

    const allSessions = listSessions();

    for (const id of sessions) {
      expect(allSessions.some(s => s.id === id)).toBe(true);
    }
  });
});

// ============ 高级会话功能测试 ============

describe('高级会话功能', () => {
  describe('会话 Fork', () => {
    it('应该 fork 会话并保持消息历史', () => {
      const session = createSession({
        model: 'claude-sonnet-4-20250514',
        name: 'Original',
      });

      addMessageToSession(session, { role: 'user', content: 'Message 1' });
      addMessageToSession(session, { role: 'assistant', content: 'Response 1' });
      saveSession(session);

      const forked = forkSession(session.metadata.id, { name: 'Forked' });

      expect(forked).not.toBeNull();
      expect(forked!.metadata.name).toBe('Forked');
      expect(forked!.metadata.parentId).toBe(session.metadata.id);
      expect(forked!.messages.length).toBe(2);
    });

    it('应该从特定消息索引 fork', () => {
      const session = createSession({ model: 'claude-sonnet-4-20250514' });

      addMessageToSession(session, { role: 'user', content: 'Message 1' });
      addMessageToSession(session, { role: 'assistant', content: 'Response 1' });
      addMessageToSession(session, { role: 'user', content: 'Message 2' });
      saveSession(session);

      const forked = forkSession(session.metadata.id, {
        fromMessageIndex: 1,
        includeFutureMessages: true,
      });

      expect(forked).not.toBeNull();
      expect(forked!.messages.length).toBe(2); // 从索引 1 开始
    });
  });

  describe('会话 Merge', () => {
    it('应该合并两个会话', () => {
      const session1 = createSession({ model: 'claude-sonnet-4-20250514' });
      const session2 = createSession({ model: 'claude-sonnet-4-20250514' });

      addMessageToSession(session1, { role: 'user', content: 'Session 1' });
      addMessageToSession(session2, { role: 'user', content: 'Session 2' });

      saveSession(session1);
      saveSession(session2);

      const merged = mergeSessions(session1.metadata.id, session2.metadata.id);

      expect(merged).not.toBeNull();
      expect(merged!.messages.length).toBe(2);
    });

    it('应该合并 token 使用统计', () => {
      const session1 = createSession({ model: 'claude-sonnet-4-20250514' });
      const session2 = createSession({ model: 'claude-sonnet-4-20250514' });

      session1.metadata.tokenUsage = { input: 100, output: 50, total: 150 };
      session2.metadata.tokenUsage = { input: 200, output: 100, total: 300 };

      saveSession(session1);
      saveSession(session2);

      const merged = mergeSessions(session1.metadata.id, session2.metadata.id, {
        keepMetadata: 'merge',
      });

      expect(merged!.metadata.tokenUsage.input).toBe(300);
      expect(merged!.metadata.tokenUsage.output).toBe(150);
      expect(merged!.metadata.tokenUsage.total).toBe(450);
    });
  });

  describe('会话统计', () => {
    it('应该获取全局会话统计', () => {
      const session1 = createSession({ model: 'claude-sonnet-4-20250514', tags: ['test'] });
      const session2 = createSession({ model: 'claude-opus-4-20250514', tags: ['test'] });

      addMessageToSession(session1, { role: 'user', content: 'Message' });
      addMessageToSession(session2, { role: 'user', content: 'Message' });

      session1.metadata.cost = 0.01;
      session2.metadata.cost = 0.02;

      saveSession(session1);
      saveSession(session2);

      const stats = getSessionStatistics();

      expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
      expect(stats.totalCost).toBeGreaterThanOrEqual(0.03);
    });
  });

  describe('会话清理', () => {
    it.skip('应该清理无效会话 (集成测试)', () => {
      // 此测试依赖真实文件系统路径，跳过以避免环境问题
      // 在集成测试环境中测试此功能
    });

    it.skip('应该支持 dry-run 模式 (集成测试)', () => {
      // 此测试依赖真实文件系统路径，跳过以避免环境问题
      // 在集成测试环境中测试此功能
    });
  });
});
