/**
 * 上下文压缩系统示例
 * 演示如何使用各种压缩功能
 */

import {
  ContextManager,
  estimateTokens,
  estimateMessageTokens,
  compressMessage,
  optimizeContext,
  extractContextKeyInfo,
  batchCompressToolResults,
  calculateCompressionRatio,
} from '../src/context/index.js';
import type { Message } from '../src/types/index.js';

// ============================================================================
// 示例 1: 基础 Token 估算
// ============================================================================

function example1_tokenEstimation() {
  console.log('=== 示例 1: Token 估算 ===\n');

  const texts = [
    'Hello, world!',
    '这是一段中文文本，用于测试 token 估算。',
    'function calculateSum(a: number, b: number) { return a + b; }',
    `
    const longCode = \`
      // This is a long code block
      class Example {
        constructor() {
          this.value = 0;
        }
      }
    \`;
    `,
  ];

  for (const text of texts) {
    const tokens = estimateTokens(text);
    console.log(`文本: ${text.slice(0, 50)}...`);
    console.log(`估算 Token: ${tokens}`);
    console.log(`字符数: ${text.length}`);
    console.log(`比例: ${(text.length / tokens).toFixed(2)} chars/token\n`);
  }
}

// ============================================================================
// 示例 2: 消息压缩
// ============================================================================

function example2_messageCompression() {
  console.log('=== 示例 2: 消息压缩 ===\n');

  // 创建一个包含长工具输出的消息
  const longOutput = `
    File: /home/user/example.ts
    ${'Line '.repeat(100)}
    This is a very long tool output that should be compressed.
    ${'More content '.repeat(200)}
  `.repeat(10);

  const message: Message = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'Here is the file content:',
      },
      {
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: longOutput,
      },
    ],
  };

  const originalTokens = estimateMessageTokens(message);
  console.log(`原始消息 Token: ${originalTokens}`);

  const compressed = compressMessage(message, {
    toolOutputMaxChars: 2000,
  });

  const compressedTokens = estimateMessageTokens(compressed);
  console.log(`压缩后 Token: ${compressedTokens}`);
  console.log(`压缩比: ${((compressedTokens / originalTokens) * 100).toFixed(1)}%`);
  console.log(`节省 Token: ${originalTokens - compressedTokens}\n`);
}

// ============================================================================
// 示例 3: 代码块压缩
// ============================================================================

function example3_codeBlockCompression() {
  console.log('=== 示例 3: 代码块压缩 ===\n');

  const longCode = Array.from({ length: 100 }, (_, i) => `  line ${i + 1}: code`).join('\n');

  const message: Message = {
    role: 'assistant',
    content: `Here is the code:\n\`\`\`typescript\n${longCode}\n\`\`\``,
  };

  const originalTokens = estimateMessageTokens(message);
  console.log(`原始代码块 Token: ${originalTokens}`);

  const compressed = compressMessage(message, {
    codeBlockMaxLines: 20,
  });

  const compressedTokens = estimateMessageTokens(compressed);
  console.log(`压缩后 Token: ${compressedTokens}`);
  console.log(`压缩比: ${((compressedTokens / originalTokens) * 100).toFixed(1)}%\n`);

  if (typeof compressed.content === 'string') {
    console.log('压缩后的内容:');
    console.log(compressed.content.slice(0, 500) + '...\n');
  }
}

// ============================================================================
// 示例 4: 上下文管理器
// ============================================================================

function example4_contextManager() {
  console.log('=== 示例 4: 上下文管理器 ===\n');

  const manager = new ContextManager({
    maxTokens: 100000,
    keepRecentMessages: 5,
    enableIncrementalCompression: true,
    toolOutputMaxChars: 1000,
  });

  // 模拟多轮对话
  for (let i = 0; i < 20; i++) {
    const userMsg: Message = {
      role: 'user',
      content: `这是第 ${i + 1} 轮对话的用户消息。${'Some padding text. '.repeat(50)}`,
    };

    const assistantMsg: Message = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `这是第 ${i + 1} 轮的回复。`,
        },
        {
          type: 'tool_result',
          tool_use_id: `tool_${i}`,
          content: `工具输出结果... ${'Long output content. '.repeat(100)}`,
        },
      ],
    };

    manager.addTurn(userMsg, assistantMsg);
  }

  // 获取统计信息
  const stats = manager.getStats();
  console.log('统计信息:');
  console.log(`  总消息数: ${stats.totalMessages}`);
  console.log(`  估算 Token: ${stats.estimatedTokens.toLocaleString()}`);
  console.log(`  压缩比: ${(stats.compressionRatio * 100).toFixed(1)}%`);
  console.log(`  节省 Token: ${stats.savedTokens.toLocaleString()}`);
  console.log(`  压缩次数: ${stats.compressionCount}\n`);

  // 获取详细报告
  console.log(manager.getFormattedReport());
}

// ============================================================================
// 示例 5: 批量压缩工具输出
// ============================================================================

function example5_batchCompression() {
  console.log('=== 示例 5: 批量压缩 ===\n');

  // 创建多个包含工具输出的消息
  const messages: Message[] = [];

  for (let i = 0; i < 10; i++) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: `tool_${i}`,
          content: `这是工具 ${i} 的输出。${'Very long output. '.repeat(200)}`,
        },
      ],
    });
  }

  const originalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  console.log(`批量压缩前 Token: ${originalTokens.toLocaleString()}`);

  const compressed = batchCompressToolResults(messages, 500);
  const compressedTokens = compressed.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

  console.log(`批量压缩后 Token: ${compressedTokens.toLocaleString()}`);
  console.log(`压缩比: ${((compressedTokens / originalTokens) * 100).toFixed(1)}%`);
  console.log(`节省 Token: ${(originalTokens - compressedTokens).toLocaleString()}\n`);
}

// ============================================================================
// 示例 6: 上下文优化
// ============================================================================

function example6_contextOptimization() {
  console.log('=== 示例 6: 上下文优化 ===\n');

  // 创建大量消息
  const messages: Message[] = [];

  for (let i = 0; i < 50; i++) {
    messages.push({
      role: 'user',
      content: `消息 ${i}: ${'Some content. '.repeat(100)}`,
    });

    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `回复 ${i}`,
        },
        {
          type: 'tool_result',
          tool_use_id: `tool_${i}`,
          content: `输出 ${i}: ${'Long output. '.repeat(150)}`,
        },
      ],
    });
  }

  const originalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
  console.log(`优化前总 Token: ${originalTokens.toLocaleString()}`);

  // 优化到 50000 token 以内
  const result = optimizeContext(messages, 50000, {
    toolOutputMaxChars: 800,
    codeBlockMaxLines: 30,
  });

  console.log(`优化后总 Token: ${result.messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0).toLocaleString()}`);
  console.log(`压缩比: ${(result.compressionRatio * 100).toFixed(1)}%`);
  console.log(`节省 Token: ${result.savedTokens.toLocaleString()}`);
  console.log(`保留消息数: ${result.messages.length} / ${messages.length}\n`);
}

// ============================================================================
// 示例 7: 提取关键信息
// ============================================================================

function example7_extractKeyInfo() {
  console.log('=== 示例 7: 提取关键信息 ===\n');

  const messages: Message[] = [
    {
      role: 'user',
      content: '请分析 /home/user/project/src/index.ts 文件',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '我将使用 Read 工具读取文件内容',
        },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'Read',
          input: { file_path: '/home/user/project/src/index.ts' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool_1',
          content: 'File content here... analyzing TypeScript implementation patterns',
        },
      ],
    },
  ];

  const keyInfo = extractContextKeyInfo(messages);

  console.log('提取的关键信息:');
  console.log(`  文件: ${keyInfo.files.join(', ')}`);
  console.log(`  工具: ${keyInfo.tools.join(', ')}`);
  console.log(`  关键词: ${keyInfo.keywords.slice(0, 10).join(', ')}\n`);
}

// ============================================================================
// 运行所有示例
// ============================================================================

function runAllExamples() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        上下文压缩系统示例 - Claude Code v2.0.76          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    example1_tokenEstimation();
    example2_messageCompression();
    example3_codeBlockCompression();
    example4_contextManager();
    example5_batchCompression();
    example6_contextOptimization();
    example7_extractKeyInfo();

    console.log('✓ 所有示例运行成功！\n');
  } catch (error) {
    console.error('✗ 示例运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件（取消注释以运行）
// runAllExamples();

export {
  example1_tokenEstimation,
  example2_messageCompression,
  example3_codeBlockCompression,
  example4_contextManager,
  example5_batchCompression,
  example6_contextOptimization,
  example7_extractKeyInfo,
  runAllExamples,
};
