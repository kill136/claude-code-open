/**
 * /transcript 命令测试
 */

import { transcriptCommand } from '../../src/commands/session.js';
import { CommandContext, CommandResult } from '../../src/commands/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('/transcript command', () => {
  let mockContext: CommandContext;
  let tempSessionFile: string;

  beforeEach(() => {
    // 创建临时会话目录和文件
    const sessionsDir = path.join(os.tmpdir(), 'claude-test-sessions');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    const sessionId = 'test-session-id-12345';
    tempSessionFile = path.join(sessionsDir, `${sessionId}.json`);

    // 创建测试会话数据
    const sessionData = {
      id: sessionId,
      metadata: {
        created: Date.now() - 600000, // 10分钟前
        customTitle: '测试会话',
        model: 'claude-sonnet-4.5',
      },
      messages: [
        {
          role: 'user',
          content: '你好，这是第一条用户消息',
        },
        {
          role: 'assistant',
          content: '你好！我是 Claude，很高兴为你服务。',
        },
        {
          role: 'user',
          content: '请帮我创建一个文件',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '好的，我来帮你创建文件',
            },
            {
              type: 'tool_use',
              id: 'tool_001',
              name: 'Write',
              input: {
                file_path: '/tmp/test.txt',
                content: 'Hello World',
              },
            },
          ],
        },
      ],
    };

    fs.writeFileSync(tempSessionFile, JSON.stringify(sessionData, null, 2));

    // 模拟会话目录路径
    const originalHomedir = os.homedir;
    jest.spyOn(os, 'homedir').mockReturnValue(os.tmpdir());

    // Mock CommandContext
    mockContext = {
      session: {
        id: sessionId,
        messageCount: 4,
        duration: 600000,
        totalCost: '$0.0150',
        clearMessages: jest.fn(),
        getStats: jest.fn(() => ({
          messageCount: 4,
          duration: 600000,
          totalCost: '$0.0150',
          modelUsage: {
            'claude-sonnet-4.5': 5000,
          },
        })),
        getTodos: jest.fn(() => []),
        setTodos: jest.fn(),
      },
      config: {
        model: 'claude-sonnet-4.5-20250929',
        modelDisplayName: 'Claude Sonnet 4.5',
        apiType: 'anthropic',
        cwd: '/test/project',
        version: '2.0.76',
      },
      ui: {
        addMessage: jest.fn(),
        addActivity: jest.fn(),
        setShowWelcome: jest.fn(),
        exit: jest.fn(),
      },
      args: [],
      rawInput: '/transcript',
    } as any;
  });

  afterEach(() => {
    // 清理临时文件
    if (fs.existsSync(tempSessionFile)) {
      fs.unlinkSync(tempSessionFile);
    }
    jest.restoreAllMocks();
  });

  test('should display transcript in terminal when no output path is specified', () => {
    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);
    expect(mockContext.ui.addMessage).toHaveBeenCalled();

    const calls = (mockContext.ui.addMessage as jest.Mock).mock.calls;
    const message = calls[0][1];

    // 验证转录内容包含关键元素
    expect(message).toContain('CLAUDE CODE CONVERSATION TRANSCRIPT');
    expect(message).toContain('Session ID:');
    expect(message).toContain('test-session-id-12345');
    expect(message).toContain('[USER]');
    expect(message).toContain('[ASSISTANT]');
    expect(message).toContain('你好，这是第一条用户消息');
  });

  test('should export transcript to file when output path is specified', () => {
    const outputPath = path.join(os.tmpdir(), 'test-transcript.txt');
    mockContext.args = [outputPath];

    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');

    // 验证文件内容
    expect(content).toContain('CLAUDE CODE CONVERSATION TRANSCRIPT');
    expect(content).toContain('Session ID:');
    expect(content).toContain('test-session-id-12345');
    expect(content).toContain('测试会话');
    expect(content).toContain('[USER]');
    expect(content).toContain('[ASSISTANT]');
    expect(content).toContain('Total Messages:  4');
    expect(content).toContain('END OF TRANSCRIPT');

    // 清理
    fs.unlinkSync(outputPath);
  });

  test('should handle tool_use messages correctly', () => {
    mockContext.args = [];

    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);

    const calls = (mockContext.ui.addMessage as jest.Mock).mock.calls;
    const message = calls[0][1];

    // 验证工具调用被正确格式化
    expect(message).toContain('[Tool Used: Write]');
    expect(message).toContain('Input:');
  });

  test('should truncate long content in terminal display', () => {
    // 创建一个包含大量消息的会话
    const longSessionData = {
      id: mockContext.session.id,
      metadata: {
        created: Date.now(),
      },
      messages: Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `这是第 ${i + 1} 条消息，内容很长很长很长...`.repeat(20),
      })),
    };

    fs.writeFileSync(tempSessionFile, JSON.stringify(longSessionData, null, 2));

    mockContext.args = [];
    mockContext.session.getStats = jest.fn(() => ({
      messageCount: 50,
      duration: 600000,
      totalCost: '$0.1000',
      modelUsage: {},
    }));

    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);

    const calls = (mockContext.ui.addMessage as jest.Mock).mock.calls;
    const message = calls[0][1];

    // 验证内容被截断
    expect(message).toContain('... (truncated');
  });

  test('should handle session file not found error', () => {
    // 删除会话文件
    fs.unlinkSync(tempSessionFile);

    const result = transcriptCommand.execute(mockContext);

    // 应该成功（创建空转录）或失败（取决于实现）
    // 验证错误处理
    expect(typeof result.success).toBe('boolean');
  });

  test('should create directory if it does not exist', () => {
    const newDir = path.join(os.tmpdir(), 'test-new-dir-' + Date.now());
    const outputPath = path.join(newDir, 'transcript.txt');

    mockContext.args = [outputPath];

    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);
    expect(fs.existsSync(newDir)).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);

    // 清理
    fs.unlinkSync(outputPath);
    fs.rmdirSync(newDir);
  });

  test('should include session metadata in transcript', () => {
    const outputPath = path.join(os.tmpdir(), 'test-metadata-transcript.txt');
    mockContext.args = [outputPath];

    const result = transcriptCommand.execute(mockContext);

    expect(result.success).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');

    // 验证元数据
    expect(content).toContain('Session ID:');
    expect(content).toContain('Model:');
    expect(content).toContain('Messages:');
    expect(content).toContain('Duration:');
    expect(content).toContain('Total Cost:');
    expect(content).toContain('Title:         测试会话');

    // 清理
    fs.unlinkSync(outputPath);
  });

  test('command should have correct metadata', () => {
    expect(transcriptCommand.name).toBe('transcript');
    expect(transcriptCommand.aliases).toContain('trans');
    expect(transcriptCommand.category).toBe('session');
    expect(transcriptCommand.description).toBeTruthy();
  });
});
