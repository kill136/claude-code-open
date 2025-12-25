# 会话 Fork 和分支管理指南

本指南介绍如何使用 Claude Code 的增强会话管理功能，包括会话分支、合并、搜索和统计。

## 目录

1. [会话分支 (Fork)](#会话分支-fork)
2. [会话合并](#会话合并)
3. [会话标签和命名](#会话标签和命名)
4. [会话搜索](#会话搜索)
5. [会话统计](#会话统计)
6. [会话导入导出](#会话导入导出)
7. [会话清理](#会话清理)
8. [SessionManager API](#sessionmanager-api)

---

## 会话分支 (Fork)

### 从任意点创建会话分支

```typescript
import { forkSession, loadSession } from './session/index.js';

// 从会话的第 5 条消息开始创建分支
const forkedSession = forkSession('source-session-id', {
  fromMessageIndex: 5,
  name: 'Experiment with different approach',
  tags: ['experiment', 'feature-x'],
  includeFutureMessages: true, // 包含第 5 条之后的所有消息
});

if (forkedSession) {
  console.log(`Created fork: ${forkedSession.metadata.id}`);
  console.log(`Parent session: ${forkedSession.metadata.parentId}`);
  console.log(`Fork point: message ${forkedSession.metadata.forkPoint}`);
}
```

### 使用 SessionManager 创建分支

```typescript
import { sessionManager } from './session/index.js';

// 当前会话创建分支
const fork = sessionManager.fork({
  fromMessageIndex: 10,
  name: 'Alternative solution',
  tags: ['branch-a'],
});

// SessionManager 会自动切换到新的 fork
console.log('Now working on fork:', sessionManager.getCurrent()?.metadata.id);
```

### 查看会话分支树

```typescript
import { getSessionBranchTree } from './session/index.js';

const tree = getSessionBranchTree('session-id');
if (tree) {
  console.log('Current session:', tree.session.name);

  if (tree.parent) {
    console.log('Parent session:', tree.parent.name);
    console.log('Forked from message:', tree.session.forkPoint);
  }

  console.log('Branches:');
  tree.branches.forEach(branch => {
    console.log(`  - ${branch.name} (${branch.id})`);
  });
}
```

---

## 会话合并

### 合并两个会话

```typescript
import { mergeSessions } from './session/index.js';

// 将源会话的消息追加到目标会话
const merged = mergeSessions('target-session-id', 'source-session-id', {
  strategy: 'append', // 'append' | 'interleave' | 'replace'
  keepMetadata: 'target', // 'source' | 'target' | 'merge'
  conflictResolution: 'target', // 'source' | 'target'
});

if (merged) {
  console.log(`Merged ${merged.metadata.messageCount} messages`);
  console.log(`Merged from: ${merged.metadata.mergedFrom}`);
}
```

### 合并策略说明

- **append**: 将源会话的消息追加到目标会话末尾
- **interleave**: 按时间交错合并（保持时间顺序）
- **replace**: 用源会话完全替换目标会话

### 使用 SessionManager 合并

```typescript
// 将另一个会话合并到当前会话
sessionManager.merge('other-session-id', {
  strategy: 'append',
  keepMetadata: 'merge', // 合并元数据（标签、成本等）
});
```

---

## 会话标签和命名

### 重命名会话

```typescript
import { renameSession } from './session/index.js';

renameSession('session-id', 'My Important Project Session');

// 使用 SessionManager
sessionManager.rename('New Session Name');
```

### 管理会话标签

```typescript
import { updateSessionTags } from './session/index.js';

// 替换所有标签
updateSessionTags('session-id', ['production', 'critical'], 'replace');

// 添加标签
updateSessionTags('session-id', ['reviewed', 'approved'], 'add');

// 移除标签
updateSessionTags('session-id', ['draft', 'wip'], 'remove');

// 使用 SessionManager
sessionManager.updateTags(['bug-fix', 'urgent'], 'add');
```

### 按标签查询会话

```typescript
import { listSessions } from './session/index.js';

const sessions = listSessions({
  tags: ['production', 'critical'],
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  limit: 10,
});

sessions.forEach(session => {
  console.log(`${session.name} - Tags: ${session.tags?.join(', ')}`);
});
```

---

## 会话搜索

### 搜索会话消息内容

```typescript
import { searchSessionMessages } from './session/index.js';

// 在所有会话中搜索
const results = searchSessionMessages('authentication error', {
  caseSensitive: false,
  regex: false,
});

results.forEach(result => {
  console.log(`Found in ${result.sessionName || result.sessionId}`);
  console.log(`  Message ${result.messageIndex}: ${result.matches.join(', ')}`);
});

// 只搜索特定会话
const sessionResults = searchSessionMessages('function.*Error', {
  sessionId: 'specific-session-id',
  regex: true,
  caseSensitive: true,
});

// 使用 SessionManager 搜索当前会话
const currentResults = sessionManager.searchMessages('TODO', {
  caseSensitive: false,
});
```

### 高级搜索示例

```typescript
// 使用正则表达式搜索代码模式
const codeResults = searchSessionMessages('class\\s+\\w+\\s*{', {
  regex: true,
});

// 搜索特定标签的会话中的内容
const productionSessions = listSessions({ tags: ['production'] });
productionSessions.forEach(session => {
  const errors = searchSessionMessages('error', {
    sessionId: session.id,
    caseSensitive: false,
  });
  if (errors.length > 0) {
    console.log(`Found ${errors.length} errors in ${session.name}`);
  }
});
```

---

## 会话统计

### 获取全局统计信息

```typescript
import { getSessionStatistics } from './session/index.js';

const stats = getSessionStatistics();

console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Total messages: ${stats.totalMessages}`);
console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
console.log(`Average messages per session: ${stats.averageMessagesPerSession.toFixed(1)}`);
console.log(`Average tokens per session: ${stats.averageTokensPerSession.toFixed(0)}`);

console.log('\nModel usage:');
Object.entries(stats.modelUsage).forEach(([model, count]) => {
  console.log(`  ${model}: ${count} sessions`);
});

console.log('\nTag usage:');
Object.entries(stats.tagUsage).forEach(([tag, count]) => {
  console.log(`  ${tag}: ${count} sessions`);
});

if (stats.mostActiveSession) {
  console.log(`\nMost active: ${stats.mostActiveSession.name} (${stats.mostActiveSession.messageCount} messages)`);
}
```

### 获取当前会话摘要

```typescript
const summary = sessionManager.getSummary();
if (summary) {
  console.log(`Session: ${summary.name}`);
  console.log(`Messages: ${summary.messageCount}`);
  console.log(`Tokens: ${summary.tokenUsage.total.toLocaleString()}`);
  console.log(`Cost: $${summary.cost?.toFixed(4) || '0.0000'}`);
  console.log(`Has ${summary.branchCount} branch(es)`);
}
```

---

## 会话导入导出

### 导出会话

```typescript
import {
  exportSessionToJSON,
  exportSessionToMarkdown,
  exportSessionToFile
} from './session/index.js';

const session = loadSession('session-id');

// 导出为 JSON 字符串
const json = exportSessionToJSON(session);
console.log(json);

// 导出为 Markdown 字符串
const markdown = exportSessionToMarkdown(session);
console.log(markdown);

// 导出到文件
exportSessionToFile('session-id', '/path/to/backup.json', 'json');
exportSessionToFile('session-id', '/path/to/report.md', 'markdown');

// 使用 SessionManager
sessionManager.exportToFile('./my-session.json', 'json');
sessionManager.exportToFile('./my-session.md', 'markdown');
```

### 导入会话

```typescript
import {
  importSessionFromJSON,
  importSessionFromMarkdown,
  importSessionFromFile,
  saveSession
} from './session/index.js';

// 从 JSON 字符串导入
const jsonString = fs.readFileSync('./session.json', 'utf-8');
const session = importSessionFromJSON(jsonString);
saveSession(session);

// 从 Markdown 导入
const markdownString = fs.readFileSync('./session.md', 'utf-8');
const mdSession = importSessionFromMarkdown(markdownString, 'claude-sonnet-4');
saveSession(mdSession);

// 从文件导入（自动检测格式）
const imported = importSessionFromFile('./session.json');
if (imported) {
  saveSession(imported);
  console.log(`Imported session: ${imported.metadata.id}`);
}
```

---

## 会话清理

### 清理过期和无效会话

```typescript
import { cleanupSessions } from './session/index.js';

// 预览将要清理的会话（dry run）
const preview = cleanupSessions({
  deleteExpired: true,
  deleteOrphaned: true,
  dryRun: true,
});

console.log(`Will delete ${preview.expired.length} expired sessions`);
console.log(`Will fix ${preview.orphaned.length} orphaned sessions`);
console.log(`Will delete ${preview.invalid.length} invalid files`);

// 执行清理
const result = cleanupSessions({
  deleteExpired: true,
  deleteOrphaned: true,
  dryRun: false,
});

console.log(`Cleaned up:`);
console.log(`  - ${result.expired.length} expired`);
console.log(`  - ${result.orphaned.length} orphaned`);
console.log(`  - ${result.invalid.length} invalid`);
```

### 批量删除会话

```typescript
import { bulkDeleteSessions } from './session/index.js';

const sessionIds = ['session-1', 'session-2', 'session-3'];

// 删除会话（有分支的会话会跳过）
const result = bulkDeleteSessions(sessionIds);
console.log(`Deleted: ${result.deleted.length}`);
console.log(`Failed: ${result.failed.length}`);

// 强制删除（包括有分支的会话）
const forceResult = bulkDeleteSessions(sessionIds, { force: true });
console.log(`Force deleted: ${forceResult.deleted.length}`);
```

---

## SessionManager API

### 完整的 SessionManager 方法

```typescript
import { sessionManager } from './session/index.js';

// 创建和管理会话
sessionManager.start({ model: 'claude-sonnet-4', name: 'My Session' });
sessionManager.resume('session-id');
sessionManager.getCurrent();
sessionManager.save();
sessionManager.end();

// Fork 和合并
sessionManager.fork({ fromMessageIndex: 5, name: 'Branch A' });
sessionManager.merge('other-session-id', { strategy: 'append' });
sessionManager.getBranchTree();

// 元数据管理
sessionManager.rename('New Name');
sessionManager.updateTags(['tag1', 'tag2'], 'add');

// 消息管理
sessionManager.addMessage(message, { input: 1000, output: 500 });
sessionManager.searchMessages('query');

// 导出和统计
sessionManager.export('json');
sessionManager.exportToFile('./backup.json', 'json');
sessionManager.getSummary();
sessionManager.updateCost(inputTokens, outputTokens, model);
```

---

## 完整工作流示例

### 实验性开发工作流

```typescript
import { sessionManager } from './session/index.js';

// 1. 开始主会话
sessionManager.start({
  model: 'claude-sonnet-4',
  name: 'Feature Development',
  tags: ['feature-x', 'development'],
});

// 2. 进行一些开发工作
sessionManager.addMessage({
  role: 'user',
  content: 'Implement feature X',
});

// 3. 在关键点创建实验分支
const experimentBranch = sessionManager.fork({
  fromMessageIndex: 5,
  name: 'Experiment: Alternative Approach',
  tags: ['experiment', 'feature-x'],
});

// 4. 尝试不同方案...
// 如果实验成功，可以继续
// 如果失败，切换回主分支

// 5. 查看分支结构
const tree = sessionManager.getBranchTree();
console.log(`Working on: ${tree?.session.name}`);
console.log(`Parent: ${tree?.parent?.name}`);

// 6. 如果实验成功，可以标记并继续
sessionManager.updateTags(['success', 'approved'], 'add');

// 7. 导出实验结果
sessionManager.exportToFile('./experiment-results.md', 'markdown');

// 8. 最终保存
sessionManager.save();
```

### 会话分析工作流

```typescript
import {
  listSessions,
  searchSessionMessages,
  getSessionStatistics
} from './session/index.js';

// 1. 找出所有包含错误的会话
const errorSessions = new Set();
const errors = searchSessionMessages('error', { regex: false });

errors.forEach(result => {
  errorSessions.add(result.sessionId);
  console.log(`Error in ${result.sessionName}: ${result.matches[0]}`);
});

// 2. 为这些会话添加标签
import { updateSessionTags } from './session/index.js';
errorSessions.forEach(sessionId => {
  updateSessionTags(sessionId, ['has-errors'], 'add');
});

// 3. 生成统计报告
const stats = getSessionStatistics();
console.log(`\n=== Session Statistics ===`);
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);

// 4. 找出成本最高的会话
const allSessions = listSessions({ limit: 1000 });
const sortedByCost = allSessions
  .filter(s => s.cost)
  .sort((a, b) => (b.cost || 0) - (a.cost || 0));

console.log(`\nTop 5 Most Expensive Sessions:`);
sortedByCost.slice(0, 5).forEach(session => {
  console.log(`  ${session.name}: $${session.cost?.toFixed(4)}`);
});
```

---

## 元数据字段参考

### SessionMetadata 扩展字段

```typescript
interface SessionMetadata {
  // 基础字段
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  model: string;
  messageCount: number;
  tokenUsage: { input: number; output: number; total: number };
  tags?: string[];
  summary?: string;

  // Fork 相关字段（新增）
  parentId?: string;           // 父会话 ID
  forkPoint?: number;          // Fork 点（消息索引）
  branches?: string[];         // 子会话 ID 列表
  forkName?: string;           // 分支名称
  mergedFrom?: string[];       // 合并来源会话列表
  cost?: number;               // 累计成本（美元）
}
```

---

## 最佳实践

1. **命名规范**: 为会话和分支使用描述性名称
2. **标签使用**: 使用一致的标签体系（如：环境、项目、状态）
3. **定期清理**: 定期运行 `cleanupSessions` 清理过期会话
4. **备份重要会话**: 使用 `exportSessionToFile` 备份关键会话
5. **分支策略**: 在重大决策点创建分支，保留替代方案
6. **成本追踪**: 使用 `updateCost` 跟踪 API 使用成本
7. **搜索优化**: 使用标签而非内容搜索来快速定位会话

---

## 故障排查

### 无法加载会话
```typescript
const session = loadSession('session-id');
if (!session) {
  console.error('Session not found or corrupted');
  // 尝试列出所有会话
  const sessions = listSessions({ limit: 10 });
  console.log('Available sessions:', sessions.map(s => s.id));
}
```

### Fork 失败
```typescript
const fork = forkSession('source-id', options);
if (!fork) {
  console.error('Fork failed - check source session exists');
  const source = loadSession('source-id');
  console.log('Source valid:', !!source);
}
```

### 合并冲突
```typescript
const merged = mergeSessions('target', 'source', {
  strategy: 'append',
  conflictResolution: 'target', // 优先保留目标会话数据
});
```

---

## 参考资料

- [会话持久化设计](/docs/session-persistence.md)
- [API 完整文档](/docs/api-reference.md)
- [Claude Code 架构](/CLAUDE.md)
