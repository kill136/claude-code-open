/**
 * 会话 Fork 功能使用示例
 * 演示如何使用增强的会话管理功能
 */

import {
  createSession,
  saveSession,
  loadSession,
  forkSession,
  mergeSessions,
  getSessionBranchTree,
  getSessionStatistics,
  searchSessionMessages,
  renameSession,
  updateSessionTags,
  exportSessionToFile,
  importSessionFromFile,
  cleanupSessions,
  sessionManager,
  type SessionData,
} from '../src/session/index.js';

import type { Message } from '../src/types/index.js';

// 示例 1: 创建和 Fork 会话
async function example1_CreateAndFork() {
  console.log('\n=== Example 1: Create and Fork Session ===\n');

  // 创建主会话
  const mainSession = createSession({
    name: 'Main Development Session',
    model: 'claude-sonnet-4',
    tags: ['development', 'feature-x'],
  });

  // 添加一些消息
  const messages: Message[] = [
    { role: 'user', content: 'How do I implement authentication?' },
    { role: 'assistant', content: 'Here are several approaches to authentication...' },
    { role: 'user', content: 'Let me try JWT tokens first' },
    { role: 'assistant', content: 'JWT implementation steps...' },
    { role: 'user', content: 'Actually, maybe OAuth would be better?' },
  ];

  messages.forEach((msg) => {
    mainSession.messages.push(msg);
  });

  mainSession.metadata.messageCount = messages.length;
  saveSession(mainSession);

  console.log(`Created main session: ${mainSession.metadata.id}`);
  console.log(`Messages: ${mainSession.metadata.messageCount}`);

  // 在第 3 条消息处创建分支（探索 OAuth 方案）
  const oauthBranch = forkSession(mainSession.metadata.id, {
    fromMessageIndex: 3,
    name: 'OAuth Implementation Branch',
    tags: ['experiment', 'oauth'],
  });

  if (oauthBranch) {
    console.log(`\nCreated OAuth branch: ${oauthBranch.metadata.id}`);
    console.log(`Forked from message: ${oauthBranch.metadata.forkPoint}`);
    console.log(`Messages in branch: ${oauthBranch.metadata.messageCount}`);
  }

  // 创建另一个分支（探索 JWT 方案）
  const jwtBranch = forkSession(mainSession.metadata.id, {
    fromMessageIndex: 3,
    name: 'JWT Implementation Branch',
    tags: ['experiment', 'jwt'],
  });

  if (jwtBranch) {
    console.log(`\nCreated JWT branch: ${jwtBranch.metadata.id}`);
  }

  // 查看分支树
  const tree = getSessionBranchTree(mainSession.metadata.id);
  if (tree) {
    console.log(`\nMain session has ${tree.branches.length} branches:`);
    tree.branches.forEach((branch) => {
      console.log(`  - ${branch.name} (${branch.id})`);
    });
  }

  return { mainSession, oauthBranch, jwtBranch };
}

// 示例 2: 合并会话
async function example2_MergeSessions(
  mainSessionId: string,
  branchSessionId: string
) {
  console.log('\n=== Example 2: Merge Sessions ===\n');

  const mainSession = loadSession(mainSessionId);
  const branchSession = loadSession(branchSessionId);

  if (!mainSession || !branchSession) {
    console.error('Sessions not found');
    return;
  }

  console.log(`Main session: ${mainSession.metadata.name}`);
  console.log(`  Messages before merge: ${mainSession.metadata.messageCount}`);

  console.log(`\nBranch session: ${branchSession.metadata.name}`);
  console.log(`  Messages: ${branchSession.metadata.messageCount}`);

  // 合并分支到主会话
  const merged = mergeSessions(mainSessionId, branchSessionId, {
    strategy: 'append',
    keepMetadata: 'merge', // 合并标签和成本
  });

  if (merged) {
    console.log(`\nMerge successful!`);
    console.log(`  Messages after merge: ${merged.metadata.messageCount}`);
    console.log(`  Merged from: ${merged.metadata.mergedFrom}`);
    console.log(`  Tags: ${merged.metadata.tags?.join(', ')}`);
  }
}

// 示例 3: 会话搜索和标签管理
async function example3_SearchAndTags() {
  console.log('\n=== Example 3: Search and Tag Management ===\n');

  // 搜索包含 "authentication" 的会话
  const results = searchSessionMessages('authentication', {
    caseSensitive: false,
  });

  console.log(`Found ${results.length} messages containing "authentication":`);
  results.slice(0, 3).forEach((result) => {
    console.log(
      `  - ${result.sessionName || result.sessionId}: Message ${result.messageIndex}`
    );
  });

  // 为搜索结果添加标签
  const sessionIds = new Set(results.map((r) => r.sessionId));
  sessionIds.forEach((sessionId) => {
    updateSessionTags(sessionId, ['auth-related'], 'add');
  });

  console.log(`\nAdded "auth-related" tag to ${sessionIds.size} sessions`);

  // 重命名会话
  const firstSessionId = Array.from(sessionIds)[0];
  if (firstSessionId) {
    renameSession(firstSessionId, 'Authentication Research Session');
    console.log(`Renamed session: ${firstSessionId}`);
  }
}

// 示例 4: 会话统计
async function example4_Statistics() {
  console.log('\n=== Example 4: Session Statistics ===\n');

  const stats = getSessionStatistics();

  console.log(`Total Sessions: ${stats.totalSessions}`);
  console.log(`Total Messages: ${stats.totalMessages.toLocaleString()}`);
  console.log(`Total Tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(`Total Cost: $${stats.totalCost.toFixed(4)}`);
  console.log(
    `Avg Messages/Session: ${stats.averageMessagesPerSession.toFixed(1)}`
  );
  console.log(
    `Avg Tokens/Session: ${stats.averageTokensPerSession.toLocaleString()}`
  );

  console.log('\nModel Usage:');
  Object.entries(stats.modelUsage).forEach(([model, count]) => {
    console.log(`  ${model}: ${count} sessions`);
  });

  console.log('\nTag Usage:');
  Object.entries(stats.tagUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count} sessions`);
    });

  if (stats.mostActiveSession) {
    console.log(
      `\nMost Active Session: ${stats.mostActiveSession.name || stats.mostActiveSession.id}`
    );
    console.log(`  Messages: ${stats.mostActiveSession.messageCount}`);
    console.log(
      `  Tokens: ${stats.mostActiveSession.tokenUsage.total.toLocaleString()}`
    );
  }
}

// 示例 5: 导入导出
async function example5_ImportExport(sessionId: string) {
  console.log('\n=== Example 5: Import/Export ===\n');

  // 导出为 JSON
  const jsonPath = `/tmp/session-${sessionId}.json`;
  const jsonExported = exportSessionToFile(sessionId, jsonPath, 'json');
  console.log(`Exported to JSON: ${jsonExported ? 'Success' : 'Failed'}`);

  // 导出为 Markdown
  const mdPath = `/tmp/session-${sessionId}.md`;
  const mdExported = exportSessionToFile(sessionId, mdPath, 'markdown');
  console.log(`Exported to Markdown: ${mdExported ? 'Success' : 'Failed'}`);

  // 导入会话
  const imported = importSessionFromFile(jsonPath);
  if (imported) {
    console.log(`\nImported session: ${imported.metadata.id}`);
    console.log(`  Original ID was: ${sessionId}`);
    console.log(`  Messages: ${imported.metadata.messageCount}`);

    // 保存导入的会话
    saveSession(imported);
  }

  console.log(`\nExported files:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);
}

// 示例 6: 使用 SessionManager
async function example6_SessionManager() {
  console.log('\n=== Example 6: SessionManager API ===\n');

  // 开始新会话
  sessionManager.start({
    name: 'SessionManager Example',
    model: 'claude-sonnet-4',
  });

  // 添加标签
  sessionManager.updateTags(['example', 'tutorial'], 'add');

  console.log('Started new session');

  // 添加消息
  sessionManager.addMessage(
    {
      role: 'user',
      content: 'Hello, Claude!',
    },
    { input: 10, output: 0 }
  );

  sessionManager.addMessage(
    {
      role: 'assistant',
      content: 'Hello! How can I help you today?',
    },
    { input: 0, output: 20 }
  );

  // 更新成本
  sessionManager.updateCost(10, 20, 'claude-sonnet-4');

  // 获取摘要
  const summary = sessionManager.getSummary();
  if (summary) {
    console.log(`\nSession Summary:`);
    console.log(`  Name: ${summary.name}`);
    console.log(`  Messages: ${summary.messageCount}`);
    console.log(`  Tokens: ${summary.tokenUsage.total}`);
    console.log(`  Cost: $${summary.cost?.toFixed(6) || '0.000000'}`);
  }

  // 创建 Fork
  const fork = sessionManager.fork({
    fromMessageIndex: 1,
    name: 'Fork Example',
    tags: ['fork', 'example'],
  });

  if (fork) {
    console.log(`\nCreated fork: ${fork.metadata.id}`);

    // 查看分支树
    const tree = sessionManager.getBranchTree();
    if (tree) {
      console.log(`Current session: ${tree.session.name}`);
      if (tree.parent) {
        console.log(`Parent session: ${tree.parent.name}`);
      }
    }
  }

  // 搜索消息
  const searchResults = sessionManager.searchMessages('Claude');
  console.log(`\nFound ${searchResults.length} messages containing "Claude"`);

  // 导出
  const exported = sessionManager.export('json');
  if (exported) {
    console.log(
      `\nExported session (${exported.split('\n').length} lines of JSON)`
    );
  }

  // 保存和结束
  sessionManager.save();
  console.log('\nSession saved');
}

// 示例 7: 会话清理
async function example7_Cleanup() {
  console.log('\n=== Example 7: Session Cleanup ===\n');

  // 预览清理（dry run）
  const preview = cleanupSessions({
    deleteExpired: true,
    deleteOrphaned: true,
    dryRun: true,
  });

  console.log('Cleanup Preview (dry run):');
  console.log(`  Expired sessions: ${preview.expired.length}`);
  console.log(`  Orphaned sessions: ${preview.orphaned.length}`);
  console.log(`  Invalid files: ${preview.invalid.length}`);

  if (preview.expired.length > 0) {
    console.log('\nExpired session IDs:');
    preview.expired.forEach((id) => {
      console.log(`  - ${id}`);
    });
  }

  // 实际清理（注释掉以避免意外删除）
  // const result = cleanupSessions({
  //   deleteExpired: true,
  //   deleteOrphaned: true,
  //   dryRun: false,
  // });
  // console.log('\nCleaned up:');
  // console.log(`  Expired: ${result.expired.length}`);
  // console.log(`  Orphaned: ${result.orphaned.length}`);
  // console.log(`  Invalid: ${result.invalid.length}`);
}

// 运行所有示例
async function runAllExamples() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Claude Code Session Fork Examples     ║');
  console.log('╚═══════════════════════════════════════════╝');

  try {
    // 示例 1: 创建和 Fork
    const { mainSession, oauthBranch, jwtBranch } = await example1_CreateAndFork();

    // 示例 2: 合并会话
    if (mainSession && oauthBranch) {
      await example2_MergeSessions(
        mainSession.metadata.id,
        oauthBranch.metadata.id
      );
    }

    // 示例 3: 搜索和标签
    await example3_SearchAndTags();

    // 示例 4: 统计
    await example4_Statistics();

    // 示例 5: 导入导出
    if (mainSession) {
      await example5_ImportExport(mainSession.metadata.id);
    }

    // 示例 6: SessionManager
    await example6_SessionManager();

    // 示例 7: 清理
    await example7_Cleanup();

    console.log('\n✓ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n✗ Error running examples:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export {
  example1_CreateAndFork,
  example2_MergeSessions,
  example3_SearchAndTags,
  example4_Statistics,
  example5_ImportExport,
  example6_SessionManager,
  example7_Cleanup,
  runAllExamples,
};
