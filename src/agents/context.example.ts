/**
 * 代理上下文继承使用示例
 * 演示如何使用 AgentContextManager 和 ContextIsolation
 */

import {
  contextManager,
  contextIsolation,
  createDefaultContext,
  createInheritedContext,
  filterSensitiveData,
  estimateContextTokens,
  type AgentContext,
  type ContextInheritanceConfig,
} from './context.js';

// ==================== 示例 1: 创建基础上下文 ====================

function example1_CreateBasicContext() {
  console.log('\n=== Example 1: Create Basic Context ===\n');

  // 创建一个新的代理上下文
  const context = createDefaultContext('agent-001');

  console.log('Context ID:', context.contextId);
  console.log('Agent ID:', context.agentId);
  console.log('Working Directory:', context.workingDirectory);
  console.log('Token Count:', estimateContextTokens(context));
}

// ==================== 示例 2: 上下文继承 ====================

function example2_InheritContext() {
  console.log('\n=== Example 2: Inherit Context ===\n');

  // 创建父上下文并添加一些数据
  const parentContext: AgentContext = {
    contextId: 'parent-001',
    agentId: 'parent-agent',
    conversationHistory: [
      {
        role: 'user',
        content: 'What is TypeScript?',
      },
      {
        role: 'assistant',
        content: 'TypeScript is a statically typed superset of JavaScript...',
      },
    ],
    fileContext: [
      {
        filePath: '/home/user/project/src/index.ts',
        content: 'console.log("Hello World");',
        size: 28,
      },
    ],
    toolResults: [
      {
        toolName: 'Read',
        toolUseId: 'tool-001',
        input: { file_path: '/home/user/project/src/index.ts' },
        output: 'File contents...',
        success: true,
        timestamp: new Date(),
      },
    ],
    workingDirectory: '/home/user/project',
    environment: {
      NODE_ENV: 'development',
      PATH: '/usr/bin',
    },
    metadata: {
      createdAt: new Date(),
    },
  };

  // 使用不同的继承类型
  const fullContext = createInheritedContext(parentContext, 'full');
  const summaryContext = createInheritedContext(parentContext, 'summary');
  const minimalContext = createInheritedContext(parentContext, 'minimal');
  const isolatedContext = createInheritedContext(parentContext, 'isolated');

  console.log('Parent Context Tokens:', estimateContextTokens(parentContext));
  console.log('Full Inheritance Tokens:', estimateContextTokens(fullContext));
  console.log('Summary Inheritance Tokens:', estimateContextTokens(summaryContext));
  console.log('Minimal Inheritance Tokens:', estimateContextTokens(minimalContext));
  console.log('Isolated Inheritance Tokens:', estimateContextTokens(isolatedContext));

  console.log('\nInheritance Types:');
  console.log('- Full: Inherits everything');
  console.log('- Summary: Inherits with compression');
  console.log('- Minimal: Minimal inheritance');
  console.log('- Isolated: No inheritance');
}

// ==================== 示例 3: 上下文压缩 ====================

function example3_CompressContext() {
  console.log('\n=== Example 3: Compress Context ===\n');

  // 创建一个大型上下文
  const largeContext = createDefaultContext('agent-large');

  // 添加大量对话历史
  for (let i = 0; i < 50; i++) {
    largeContext.conversationHistory.push(
      {
        role: 'user',
        content: `Question ${i}: Can you explain concept ${i}?`,
      },
      {
        role: 'assistant',
        content: `Answer ${i}: Here is a detailed explanation of concept ${i}. `.repeat(10),
      }
    );
  }

  const originalTokens = estimateContextTokens(largeContext);
  console.log('Original Tokens:', originalTokens);

  // 压缩上下文到目标大小
  const { context: compressed, compressionRatio, savedTokens } =
    contextManager.compress(largeContext, 10000);

  console.log('Compressed Tokens:', estimateContextTokens(compressed));
  console.log('Compression Ratio:', (compressionRatio * 100).toFixed(2) + '%');
  console.log('Saved Tokens:', savedTokens);
}

// ==================== 示例 4: 过滤敏感数据 ====================

function example4_FilterSensitiveData() {
  console.log('\n=== Example 4: Filter Sensitive Data ===\n');

  const contextWithSecrets: AgentContext = {
    contextId: 'context-001',
    conversationHistory: [
      {
        role: 'user',
        content: 'My API key is sk-1234567890abcdef',
      },
      {
        role: 'assistant',
        content: 'I can help you with that.',
      },
    ],
    fileContext: [
      {
        filePath: '/home/user/project/.env',
        content: 'API_KEY=secret123',
      },
      {
        filePath: '/home/user/project/config.json',
        content: '{"setting": "value"}',
      },
    ],
    toolResults: [],
    workingDirectory: '/home/user/project',
    environment: {
      PASSWORD: 'mysecret',
      NODE_ENV: 'development',
    },
    metadata: {
      createdAt: new Date(),
    },
  };

  console.log('Before filtering:');
  console.log('- Conversation messages:', contextWithSecrets.conversationHistory.length);
  console.log('- Files:', contextWithSecrets.fileContext.length);
  console.log('- Environment vars:', Object.keys(contextWithSecrets.environment).length);

  const filtered = filterSensitiveData(contextWithSecrets);

  console.log('\nAfter filtering:');
  console.log('- Conversation messages:', filtered.conversationHistory.length);
  console.log('- Files:', filtered.fileContext.length);
  console.log('- Environment vars:', Object.keys(filtered.environment).length);
  console.log('- First message content:', filtered.conversationHistory[0].content);
}

// ==================== 示例 5: 上下文隔离 ====================

function example5_ContextIsolation() {
  console.log('\n=== Example 5: Context Isolation ===\n');

  const context = createDefaultContext('agent-sandbox');

  // 创建沙箱
  const sandbox = contextIsolation.createSandbox(context, 'agent-sandbox', {
    maxTokens: 50000,
    maxFiles: 20,
    maxToolResults: 50,
    allowedTools: ['Read', 'Write', 'Glob'],
    deniedTools: ['Bash', 'WebFetch'],
  });

  console.log('Sandbox ID:', sandbox.sandboxId);
  console.log('Sandbox State:', sandbox.state);
  console.log('Token Usage:', sandbox.resources.tokenUsage);
  console.log('Max Tokens:', sandbox.restrictions.maxTokens);
  console.log('Allowed Tools:', sandbox.restrictions.allowedTools);

  // 检查工具是否允许
  console.log('\nTool permissions:');
  console.log('- Read allowed:', contextIsolation.isToolAllowed(sandbox.sandboxId, 'Read'));
  console.log('- Bash allowed:', contextIsolation.isToolAllowed(sandbox.sandboxId, 'Bash'));

  // 清理沙箱
  contextIsolation.cleanup(sandbox.sandboxId);
  console.log('\nSandbox cleaned up');
}

// ==================== 示例 6: 合并多个上下文 ====================

function example6_MergeContexts() {
  console.log('\n=== Example 6: Merge Contexts ===\n');

  const context1: AgentContext = {
    contextId: 'ctx-1',
    conversationHistory: [
      { role: 'user', content: 'Question from context 1' },
      { role: 'assistant', content: 'Answer from context 1' },
    ],
    fileContext: [
      { filePath: '/file1.ts', content: 'content1' },
    ],
    toolResults: [],
    workingDirectory: '/project',
    environment: { VAR1: 'value1' },
    metadata: { createdAt: new Date() },
  };

  const context2: AgentContext = {
    contextId: 'ctx-2',
    conversationHistory: [
      { role: 'user', content: 'Question from context 2' },
      { role: 'assistant', content: 'Answer from context 2' },
    ],
    fileContext: [
      { filePath: '/file2.ts', content: 'content2' },
    ],
    toolResults: [],
    workingDirectory: '/project',
    environment: { VAR2: 'value2' },
    metadata: { createdAt: new Date() },
  };

  const merged = contextManager.merge([context1, context2]);

  console.log('Merged Context ID:', merged.contextId);
  console.log('Total messages:', merged.conversationHistory.length);
  console.log('Total files:', merged.fileContext.length);
  console.log('Environment vars:', Object.keys(merged.environment));
}

// ==================== 示例 7: 自定义上下文过滤 ====================

function example7_CustomFilter() {
  console.log('\n=== Example 7: Custom Filter ===\n');

  const context = createDefaultContext('agent-filter');

  // 添加一些数据
  context.conversationHistory = [
    { role: 'user', content: 'Message 1' },
    { role: 'assistant', content: 'Response 1' },
    { role: 'user', content: 'Message 2' },
    { role: 'assistant', content: 'Response 2' },
  ];

  // 使用过滤器
  const filtered = contextManager.filter(context, {
    includeConversation: true,
    conversationFilter: (messages) => messages.slice(-2), // 只保留最后2条消息
    tokenLimit: 5000,
  });

  console.log('Original messages:', context.conversationHistory.length);
  console.log('Filtered messages:', filtered.conversationHistory.length);
}

// ==================== 示例 8: 上下文管理器统计 ====================

function example8_ContextStats() {
  console.log('\n=== Example 8: Context Stats ===\n');

  // 创建一些上下文
  for (let i = 0; i < 5; i++) {
    const ctx = contextManager.createContext();
    ctx.conversationHistory.push(
      { role: 'user', content: `Question ${i}` },
      { role: 'assistant', content: `Answer ${i}` }
    );
  }

  const stats = contextManager.getStats();

  console.log('Total Contexts:', stats.totalContexts);
  console.log('Total Tokens:', stats.totalTokens);
  console.log('Average Tokens:', stats.averageTokens.toFixed(0));
  console.log('Contexts by Type:', stats.contextsByType);

  const sandboxStats = contextIsolation.getStats();
  console.log('\nSandbox Stats:');
  console.log('Total Sandboxes:', sandboxStats.totalSandboxes);
  console.log('Active Sandboxes:', sandboxStats.activeSandboxes);
}

// ==================== 运行所有示例 ====================

export function runAllExamples() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('    Agent Context Inheritance Examples');
  console.log('='.repeat(60));

  example1_CreateBasicContext();
  example2_InheritContext();
  example3_CompressContext();
  example4_FilterSensitiveData();
  example5_ContextIsolation();
  example6_MergeContexts();
  example7_CustomFilter();
  example8_ContextStats();

  console.log('\n');
  console.log('='.repeat(60));
  console.log('    All Examples Completed');
  console.log('='.repeat(60));
  console.log('\n');
}

// 如果直接运行此文件，执行所有示例
// Uncomment to run examples:
// runAllExamples();
