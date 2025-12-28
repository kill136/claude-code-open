/**
 * Autocomplete 使用示例
 */

import { getCompletions, applyCompletion, type CompletionItem } from './index.js';

// ============================================
// 示例 1: 斜杠命令补全
// ============================================
async function exampleCommandCompletion() {
  console.log('=== Example 1: Slash Command Completion ===\n');

  const context = {
    fullText: '/hel',
    cursorPosition: 4,
    cwd: process.cwd(),
  };

  const result = await getCompletions(context);

  console.log('Input:', context.fullText);
  console.log('Type:', result.type);
  console.log('Suggestions:');
  result.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.label} - ${item.description}`);
  });

  // 选择第一个建议并应用
  if (result.items.length > 0) {
    const applied = applyCompletion(
      context.fullText,
      result.items[0],
      result.startPosition,
      context.cursorPosition
    );
    console.log('\nApplied completion:', applied.newText);
  }

  console.log('\n');
}

// ============================================
// 示例 2: 文件路径补全
// ============================================
async function exampleFileCompletion() {
  console.log('=== Example 2: File Path Completion ===\n');

  const context = {
    fullText: 'read ./src/ui/',
    cursorPosition: 14,
    cwd: process.cwd(),
    enableFileCompletion: true,
  };

  const result = await getCompletions(context);

  console.log('Input:', context.fullText);
  console.log('Type:', result.type);
  console.log('Suggestions:');
  result.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.label} (${item.description})`);
  });

  console.log('\n');
}

// ============================================
// 示例 3: @mention 补全
// ============================================
async function exampleMentionCompletion() {
  console.log('=== Example 3: @mention Completion ===\n');

  const context = {
    fullText: 'check @config',
    cursorPosition: 13,
    cwd: process.cwd(),
    enableMentionCompletion: true,
  };

  const result = await getCompletions(context);

  console.log('Input:', context.fullText);
  console.log('Type:', result.type);
  console.log('Suggestions:');
  result.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.label} - ${item.description}`);
  });

  console.log('\n');
}

// ============================================
// 示例 4: 无补全情况
// ============================================
async function exampleNoCompletion() {
  console.log('=== Example 4: No Completion ===\n');

  const context = {
    fullText: 'just some regular text',
    cursorPosition: 22,
    cwd: process.cwd(),
  };

  const result = await getCompletions(context);

  console.log('Input:', context.fullText);
  console.log('Type:', result.type);
  console.log('Has suggestions:', result.items.length > 0);

  console.log('\n');
}

// ============================================
// 示例 5: 命令别名补全
// ============================================
async function exampleCommandAlias() {
  console.log('=== Example 5: Command Alias Completion ===\n');

  const context = {
    fullText: '/q',
    cursorPosition: 2,
    cwd: process.cwd(),
  };

  const result = await getCompletions(context);

  console.log('Input:', context.fullText);
  console.log('Type:', result.type);
  console.log('Suggestions (including aliases):');
  result.items.forEach((item, i) => {
    const aliases = item.aliases ? ` (${item.aliases.join(', ')})` : '';
    console.log(`  ${i + 1}. ${item.label}${aliases} - ${item.description}`);
  });

  console.log('\n');
}

// 运行所有示例
async function runExamples() {
  await exampleCommandCompletion();
  await exampleFileCompletion();
  await exampleMentionCompletion();
  await exampleNoCompletion();
  await exampleCommandAlias();
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  exampleCommandCompletion,
  exampleFileCompletion,
  exampleMentionCompletion,
  exampleNoCompletion,
  exampleCommandAlias,
};
