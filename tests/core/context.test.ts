/**
 * ContextManager 测试
 * 测试上下文管理和压缩功能
 */

import {
  ContextManager,
  estimateTokens,
  estimateMessageTokens,
  estimateTotalTokens,
  compressMessage,
  truncateMessages,
  optimizeContext,
  extractContextKeyInfo,
} from '../../src/context/index.js';
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

function assertGreaterThan(actual: number, min: number, message: string) {
  if (actual <= min) {
    throw new Error(`${message}\n  期望 > ${min}\n  实际: ${actual}`);
  }
}

function assertLessThan(actual: number, max: number, message: string) {
  if (actual >= max) {
    throw new Error(`${message}\n  期望 < ${max}\n  实际: ${actual}`);
  }
}

// ============ Token 估算测试 ============

const tokenEstimationTests = [
  test('应该估算简单英文文本的 token', () => {
    const text = 'Hello, world!';
    const tokens = estimateTokens(text);

    assertGreaterThan(tokens, 0, 'token 数应该大于 0');
    assertLessThan(tokens, 20, 'token 数应该合理');
  }),

  test('应该估算中文文本的 token', () => {
    const text = '你好，世界！';
    const tokens = estimateTokens(text);

    assertGreaterThan(tokens, 0, 'token 数应该大于 0');
    // 中文字符通常需要更多 token
    assertGreaterThan(tokens, 2, '中文应该需要多个 token');
  }),

  test('应该估算代码的 token', () => {
    const code = 'function hello() { return "world"; }';
    const tokens = estimateTokens(code);

    assertGreaterThan(tokens, 5, '代码应该产生多个 token');
  }),

  test('应该处理空字符串', () => {
    const tokens = estimateTokens('');
    assertEqual(tokens, 0, '空字符串应该是 0 token');
  }),

  test('应该估算包含换行符的文本', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const tokens = estimateTokens(text);

    assertGreaterThan(tokens, 5, '多行文本应该产生多个 token');
  }),

  test('应该估算包含特殊字符的文本', () => {
    const text = '{[(<>)]}!@#$%^&*';
    const tokens = estimateTokens(text);

    assertGreaterThan(tokens, 0, '特殊字符应该产生 token');
  }),

  test('应该估算消息的 token - 字符串内容', () => {
    const message: Message = {
      role: 'user',
      content: 'Hello, Claude!',
    };

    const tokens = estimateMessageTokens(message);
    assertGreaterThan(tokens, 10, '消息应该包含基础开销');
  }),

  test('应该估算消息的 token - 数组内容', () => {
    const message: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will use a tool' },
        { type: 'tool_use', id: 'tool_1', name: 'Read', input: { file_path: '/test.txt' } },
      ],
    };

    const tokens = estimateMessageTokens(message);
    assertGreaterThan(tokens, 15, '包含工具调用的消息应该产生更多 token');
  }),

  test('应该估算总 token 数', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer 1' },
      { role: 'user', content: 'Question 2' },
    ];

    const total = estimateTotalTokens(messages);
    assertGreaterThan(total, 30, '多条消息应该累积 token');
  }),
];

// ============ 消息压缩测试 ============

const compressionTests = [
  test('应该压缩长工具输出', () => {
    const longOutput = 'x'.repeat(5000);
    const message: Message = {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool_1',
          content: longOutput,
        },
      ],
    };

    const compressed = compressMessage(message);

    assert(Array.isArray(compressed.content), '压缩后内容应该是数组');
    const block = (compressed.content as ContentBlock[])[0];
    const compressedContent = block.type === 'tool_result' && typeof block.content === 'string'
      ? block.content
      : '';

    assertLessThan(
      compressedContent.length,
      longOutput.length,
      '压缩后内容应该更短'
    );
  }),

  test('应该保留短消息不变', () => {
    const message: Message = {
      role: 'user',
      content: 'Short message',
    };

    const compressed = compressMessage(message);
    assertEqual(compressed.content, message.content, '短消息应该保持不变');
  }),

  test('应该压缩代码块', () => {
    const longCode = Array(200).fill('  console.log("test");').join('\n');
    const message: Message = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '```javascript\n' + longCode + '\n```',
        },
      ],
    };

    const compressed = compressMessage(message);

    assert(Array.isArray(compressed.content), '压缩后内容应该是数组');
    const block = (compressed.content as ContentBlock[])[0];
    const compressedText = block.type === 'text' ? block.text || '' : '';

    assertLessThan(
      compressedText.length,
      message.content[0].text!.length,
      '长代码块应该被压缩'
    );
  }),

  test('应该截断消息数组', () => {
    const messages: Message[] = Array(30).fill(null).map((_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i}`,
    }));

    const truncated = truncateMessages(messages, 1000, 2, 5);

    assertLessThan(
      truncated.length,
      messages.length,
      '消息应该被截断'
    );
    assertGreaterThan(truncated.length, 7, '应该保留首尾消息');
  }),

  test('优化上下文应该返回压缩结果', () => {
    const messages: Message[] = Array(20).fill(null).map((_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: 'x'.repeat(1000),
    }));

    const result = optimizeContext(messages, 5000);

    assertDefined(result.messages, '应该返回消息');
    assertGreaterThan(result.compressionRatio, 0, '压缩比应该大于 0');
    assertGreaterThan(result.savedTokens, 0, '应该节省 token');
  }),
];

// ============ ContextManager 测试 ============

const contextManagerTests = [
  test('应该使用默认配置初始化', () => {
    const manager = new ContextManager();

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 0, '初始应该没有消息');
    assertEqual(stats.summarizedMessages, 0, '初始应该没有摘要');
  }),

  test('应该使用自定义配置初始化', () => {
    const manager = new ContextManager({
      maxTokens: 100000,
      keepRecentMessages: 20,
      enableAISummary: false,
    });

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 0, '初始应该没有消息');
  }),

  test('应该添加对话轮次', () => {
    const manager = new ContextManager();

    const user: Message = { role: 'user', content: 'Question' };
    const assistant: Message = { role: 'assistant', content: 'Answer' };

    manager.addTurn(user, assistant);

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 2, '应该有 2 条消息');
  }),

  test('应该获取消息列表', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' }
    );

    const messages = manager.getMessages();
    assertEqual(messages.length, 2, '应该返回 2 条消息');
    assertEqual(messages[0].role, 'user', '第一条应该是用户消息');
    assertEqual(messages[1].role, 'assistant', '第二条应该是助手消息');
  }),

  test('应该计算已使用的 token', () => {
    const manager = new ContextManager();

    manager.setSystemPrompt('You are a helpful assistant');
    manager.addTurn(
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    );

    const used = manager.getUsedTokens();
    assertGreaterThan(used, 0, '已使用 token 应该大于 0');
  }),

  test('应该计算可用的 token', () => {
    const manager = new ContextManager({ maxTokens: 10000 });

    manager.addTurn(
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Response' }
    );

    const available = manager.getAvailableTokens();
    assertGreaterThan(available, 0, '可用 token 应该大于 0');
    assertLessThan(available, 10000, '可用 token 应该小于最大值');
  }),

  test('应该清除历史', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' }
    );

    manager.clear();

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 0, '清除后应该没有消息');
  }),

  test('应该导出状态', () => {
    const manager = new ContextManager();

    manager.setSystemPrompt('Test prompt');
    manager.addTurn(
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' }
    );

    const exported = manager.export();

    assertEqual(exported.systemPrompt, 'Test prompt', '系统提示应该被导出');
    assertEqual(exported.turns.length, 1, '应该导出 1 个轮次');
    assertDefined(exported.config, '配置应该被导出');
  }),

  test('应该导入状态', () => {
    const manager1 = new ContextManager();
    manager1.setSystemPrompt('Test prompt');
    manager1.addTurn(
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' }
    );

    const exported = manager1.export();

    const manager2 = new ContextManager();
    manager2.import(exported);

    const messages = manager2.getMessages();
    assertEqual(messages.length, 2, '导入后应该有消息');
  }),

  test('应该分析压缩效果', () => {
    const manager = new ContextManager({
      enableIncrementalCompression: true,
    });

    // 添加长消息
    manager.addTurn(
      { role: 'user', content: 'x'.repeat(5000) },
      { role: 'assistant', content: 'y'.repeat(5000) }
    );

    const analysis = manager.analyzeCompression();

    assertGreaterThan(analysis.originalTokens, 0, '原始 token 应该大于 0');
    assertGreaterThan(analysis.compressedTokens, 0, '压缩后 token 应该大于 0');
  }),

  test('应该获取上下文使用率', () => {
    const manager = new ContextManager({ maxTokens: 10000 });

    manager.addTurn(
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Response' }
    );

    const usage = manager.getContextUsage();

    assertGreaterThan(usage.used, 0, '已使用应该大于 0');
    assertGreaterThan(usage.available, 0, '可用应该大于 0');
    assertGreaterThan(usage.percentage, 0, '使用百分比应该大于 0');
    assertLessThan(usage.percentage, 100, '使用百分比应该小于 100');
  }),

  test('应该检测是否接近限制', () => {
    const manager = new ContextManager({ maxTokens: 1000 });

    // 初始应该不接近限制
    assert(!manager.isNearLimit(), '初始不应该接近限制');

    // 添加大量消息
    for (let i = 0; i < 50; i++) {
      manager.addTurn(
        { role: 'user', content: 'x'.repeat(100) },
        { role: 'assistant', content: 'y'.repeat(100) }
      );
    }

    // 现在应该接近限制
    assert(manager.isNearLimit(), '添加大量消息后应该接近限制');
  }),

  test('应该生成格式化报告', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' }
    );

    const report = manager.getFormattedReport();

    assert(typeof report === 'string', '报告应该是字符串');
    assert(report.includes('Context Manager Report'), '报告应该包含标题');
    assert(report.includes('Total Messages'), '报告应该包含消息统计');
  }),

  test('应该获取压缩详情', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' }
    );

    const details = manager.getCompressionDetails();

    assertEqual(details.totalTurns, 1, '应该有 1 个轮次');
    assertEqual(details.summarizedTurns, 0, '初始应该没有摘要');
    assertGreaterThan(details.compressionRatio, 0, '压缩比应该大于 0');
  }),
];

// ============ 辅助函数测试 ============

const utilityTests = [
  test('应该提取上下文关键信息', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Please read /home/user/test.txt',
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read the file' },
          { type: 'tool_use', id: 'tool_1', name: 'Read', input: {} },
        ],
      },
    ];

    const info = extractContextKeyInfo(messages);

    assert(Array.isArray(info.files), '文件列表应该是数组');
    assert(Array.isArray(info.tools), '工具列表应该是数组');
    assert(Array.isArray(info.keywords), '关键词列表应该是数组');
    assertEqual(info.tools.length, 1, '应该提取到 1 个工具');
    assertEqual(info.tools[0], 'Read', '工具名应该正确');
  }),

  test('应该处理空消息列表', () => {
    const info = extractContextKeyInfo([]);

    assertEqual(info.files.length, 0, '空列表应该没有文件');
    assertEqual(info.tools.length, 0, '空列表应该没有工具');
    assertEqual(info.keywords.length, 0, '空列表应该没有关键词');
  }),

  test('应该处理包含图片的消息', () => {
    const message: Message = {
      role: 'user',
      content: [
        { type: 'text', text: 'Look at this image' },
        { type: 'image', source: { type: 'url', url: 'https://example.com/image.png' } },
      ],
    };

    const tokens = estimateMessageTokens(message);
    assertGreaterThan(tokens, 1000, '包含图片的消息应该有大量 token');
  }),
];

// ============ 边界条件测试 ============

const edgeCaseTests = [
  test('应该处理非常长的单条消息', () => {
    const manager = new ContextManager();

    const longContent = 'x'.repeat(100000);
    manager.addTurn(
      { role: 'user', content: longContent },
      { role: 'assistant', content: 'OK' }
    );

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 2, '应该正确处理长消息');
  }),

  test('应该处理空消息', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: '' },
      { role: 'assistant', content: '' }
    );

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 2, '应该处理空消息');
  }),

  test('应该处理复杂的嵌套内容', () => {
    const manager = new ContextManager();

    manager.addTurn(
      { role: 'user', content: 'Test' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'tool_use', id: 't1', name: 'Tool1', input: { nested: { deep: { value: 'test' } } } },
          { type: 'text', text: 'Part 2' },
          { type: 'tool_use', id: 't2', name: 'Tool2', input: {} },
        ],
      }
    );

    const messages = manager.getMessages();
    assert(Array.isArray(messages[1].content), '复杂内容应该被保留');
  }),

  test('应该处理 maxTokens 为 0', () => {
    const manager = new ContextManager({ maxTokens: 0 });

    const available = manager.getAvailableTokens();
    assertLessThan(available, 0, 'maxTokens 为 0 时可用 token 应该为负');
  }),

  test('应该处理 keepRecentMessages 为 0', () => {
    const manager = new ContextManager({ keepRecentMessages: 0 });

    manager.addTurn(
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' }
    );

    const stats = manager.getStats();
    assertEqual(stats.totalMessages, 2, '应该正常工作');
  }),
];

// ============ 运行测试 ============

async function runTests() {
  console.log('运行 ContextManager 测试...\n');

  const allTests = [
    ...tokenEstimationTests,
    ...compressionTests,
    ...contextManagerTests,
    ...utilityTests,
    ...edgeCaseTests,
  ];

  for (const testFn of allTests) {
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
