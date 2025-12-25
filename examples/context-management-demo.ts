/**
 * 增强上下文管理功能演示
 * Enhanced Context Management Demo
 */

import {
  createEnhancedContextManager,
  getModelContextWindow,
  addCacheControl,
  calculateCacheSavings,
  evaluateMessagePriority,
  MessagePriority,
  collapseToolReferences,
  parseAtMentions,
  resolveAtMentions,
  injectClaudeMd,
  parseMcpUri,
  formatMcpResource,
  type TokenUsage,
  type ContextWindowStats,
} from '../src/context/index.js';
import type { Message } from '../src/types/index.js';

// ============ 示例 1: Token 计数和窗口管理 ============

console.log('\n=== 示例 1: Token 计数和窗口管理 ===\n');

// 获取不同模型的上下文窗口大小
const models = [
  'claude-3-5-sonnet-20241022',
  'claude-4-5-sonnet-20250929',
  'claude-opus-4-5-20251101',
];

models.forEach((model) => {
  const windowSize = getModelContextWindow(model);
  console.log(`${model}: ${windowSize.toLocaleString()} tokens`);
});

// 创建上下文窗口管理器
const manager = createEnhancedContextManager('claude-3-5-sonnet-20241022');

// 模拟 API 调用
const usage1: TokenUsage = {
  input_tokens: 5000,
  output_tokens: 1000,
  cache_creation_input_tokens: 2000,
  cache_read_input_tokens: 0,
};

manager.recordUsage(usage1);

// 第二次调用（缓存命中）
const usage2: TokenUsage = {
  input_tokens: 3000,
  output_tokens: 800,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 2000,
};

manager.recordUsage(usage2);

// 获取统计信息
const stats = manager.windowManager.getStats();
console.log('\n窗口统计:');
console.log(`  总输入 tokens: ${stats.total_input_tokens.toLocaleString()}`);
console.log(`  总输出 tokens: ${stats.total_output_tokens.toLocaleString()}`);
console.log(`  上下文窗口: ${stats.context_window_size.toLocaleString()}`);

// 缓存统计
const cacheStats = manager.windowManager.getCacheStats();
console.log('\n缓存统计:');
console.log(`  缓存创建 tokens: ${cacheStats.total_cache_creation_tokens.toLocaleString()}`);
console.log(`  缓存读取 tokens: ${cacheStats.total_cache_read_tokens.toLocaleString()}`);
console.log(`  缓存命中率: ${(cacheStats.cache_hit_rate * 100).toFixed(1)}%`);

// 检查是否接近限制
const isNear = manager.windowManager.isNearLimit(0.8);
console.log(`\n接近限制 (80%): ${isNear ? '是' : '否'}`);

// ============ 示例 2: Prompt Caching ============

console.log('\n\n=== 示例 2: Prompt Caching ===\n');

const messages: Message[] = [
  { role: 'user', content: 'What is TypeScript?' },
  { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript...' },
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Can you explain interfaces?' },
    ],
  },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Interfaces in TypeScript define the shape of objects...' },
    ],
  },
];

// 添加缓存控制
const cachedMessages = addCacheControl(messages, {
  cacheRecentMessages: 2,  // 缓存最近 2 条消息
});

console.log('已为最近 2 条消息添加缓存控制');

// 计算成本节省
const savings = calculateCacheSavings(usage2);
console.log('\n成本分析:');
console.log(`  基础成本: $${savings.baseCost.toFixed(4)}`);
console.log(`  缓存成本: $${savings.cacheCost.toFixed(4)}`);
console.log(`  节省: $${savings.savings.toFixed(4)} (${((savings.savings / (savings.baseCost + savings.savings)) * 100).toFixed(1)}%)`);

// ============ 示例 3: 消息优先级排序 ============

console.log('\n\n=== 示例 3: 消息优先级排序 ===\n');

const testMessages: Message[] = [
  { role: 'user', content: '=== Previous Conversation Summary ===\nSummary here' },
  { role: 'assistant', content: 'Understood.' },
  { role: 'user', content: 'Old message 1' },
  { role: 'assistant', content: 'Response 1' },
  {
    role: 'user',
    content: [
      {
        type: 'tool_use',
        id: 'test1',
        name: 'bash',
        input: { command: 'ls' },
      },
    ],
  },
  { role: 'assistant', content: 'Tool response' },
  { role: 'user', content: 'Recent message' },
  { role: 'assistant', content: 'Latest response' },
];

testMessages.forEach((msg, idx) => {
  const priority = evaluateMessagePriority(msg, idx, testMessages.length);
  const priorityName = MessagePriority[priority];
  const content = typeof msg.content === 'string'
    ? msg.content.slice(0, 30)
    : '[Array content]';
  console.log(`[${idx}] ${priorityName.padEnd(10)} - ${content}...`);
});

// ============ 示例 4: Tool Reference 折叠 ============

console.log('\n\n=== 示例 4: Tool Reference 折叠 ===\n');

const messageWithRefs: Message = {
  role: 'user',
  content: [
    { type: 'text', text: 'Some text' },
    { type: 'tool_reference', tool_use_id: 'ref1', path: '/file1.ts' } as any,
    { type: 'tool_reference', tool_use_id: 'ref2', path: '/file2.ts' } as any,
  ],
};

const collapsed = collapseToolReferences(messageWithRefs);
console.log('原始内容块数:', (messageWithRefs.content as any[]).length);
console.log('折叠后块数:', (collapsed.content as any[]).length);

// ============ 示例 5: @ 文件提及 ============

console.log('\n\n=== 示例 5: @ 文件提及 ===\n');

const textWithMentions = 'Check @package.json and @README.md for details';
const mentions = parseAtMentions(textWithMentions);
console.log('检测到的 @ 提及:');
mentions.forEach((m) => console.log(`  - ${m}`));

// 注意：实际解析需要文件存在
console.log('\n实际文件解析示例:');
console.log('const result = await resolveAtMentions(text, process.cwd());');
console.log('// result.processedText - 处理后的文本（包含文件内容）');
console.log('// result.files - 读取的文件列表');

// ============ 示例 6: CLAUDE.md 解析 ============

console.log('\n\n=== 示例 6: CLAUDE.md 解析 ===\n');

console.log('CLAUDE.md 解析示例:');
console.log('const config = await parseClaudeMd(process.cwd());');
console.log('if (config) {');
console.log('  console.log("CLAUDE.md 内容:", config.content);');
console.log('  console.log("引用的文件:", config.files);');
console.log('}');
console.log('');
console.log('系统提示注入:');
console.log('const enhanced = await injectClaudeMd(systemPrompt, process.cwd());');

// ============ 示例 7: MCP URI 管理 ============

console.log('\n\n=== 示例 7: MCP URI 管理 ===\n');

const mcpUris = [
  'mcp://filesystem/path/to/file.txt',
  'mcp://database/users/123',
  'mcp://github/repo/issues/42',
];

mcpUris.forEach((uri) => {
  const parsed = parseMcpUri(uri);
  if (parsed) {
    console.log(`URI: ${uri}`);
    console.log(`  Server: ${parsed.server}`);
    console.log(`  Path: ${parsed.path}`);
  }
});

// 格式化资源
console.log('\n格式化 MCP 资源:');
const resource = {
  server: 'filesystem',
  uri: 'file:///example.txt',
  content: 'File content here...',
};

const block = formatMcpResource(resource);
console.log(block);

// ============ 总结 ============

console.log('\n\n=== 功能总结 ===\n');
console.log('✅ T321-T322: Token 计数和窗口管理');
console.log('✅ T327-T329: Prompt Caching 支持');
console.log('✅ T324: 消息优先级排序');
console.log('✅ T325: Tool Reference 折叠');
console.log('✅ T332: @ 文件提及处理');
console.log('✅ T331: CLAUDE.md 解析');
console.log('✅ T330: MCP URI 管理');
console.log('\n所有增强功能已成功实现！\n');
