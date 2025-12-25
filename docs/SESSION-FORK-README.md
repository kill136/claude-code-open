# 会话 Fork 功能增强 - 快速入门

## 概述

本次更新为 Claude Code 添加了完整的会话分支（Fork）、合并、搜索和统计功能，使其能够更好地管理复杂的对话流程。

## 核心功能

### 1. 会话分支（Fork）
从任意对话点创建新分支，支持实验性开发工作流。

```typescript
import { sessionManager } from './src/session/index.js';

// 从第 10 条消息创建分支
const fork = sessionManager.fork({
  fromMessageIndex: 10,
  name: 'Alternative Solution',
  tags: ['experiment']
});
```

### 2. 会话合并
将多个会话分支合并为一个。

```typescript
// 合并另一个会话到当前会话
sessionManager.merge('other-session-id', {
  strategy: 'append',
  keepMetadata: 'merge'
});
```

### 3. 会话搜索
在所有会话中搜索特定内容。

```typescript
import { searchSessionMessages } from './src/session/index.js';

// 搜索包含 "error" 的消息
const results = searchSessionMessages('error', {
  caseSensitive: false,
  regex: false
});
```

### 4. 会话统计
获取全局或单个会话的统计信息。

```typescript
import { getSessionStatistics } from './src/session/index.js';

const stats = getSessionStatistics();
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
```

### 5. 导入/导出
支持 JSON 和 Markdown 格式。

```typescript
// 导出为 JSON
sessionManager.exportToFile('./backup.json', 'json');

// 导出为 Markdown
sessionManager.exportToFile('./report.md', 'markdown');
```

### 6. 标签管理
为会话添加、删除、查询标签。

```typescript
// 添加标签
sessionManager.updateTags(['bug-fix', 'urgent'], 'add');

// 重命名会话
sessionManager.rename('Critical Bug Fix Session');
```

### 7. 会话清理
自动清理过期和无效会话。

```typescript
import { cleanupSessions } from './src/session/index.js';

// 清理过期会话（dry run）
const preview = cleanupSessions({
  deleteExpired: true,
  dryRun: true
});
```

## 新增 API

### 函数级 API
- `forkSession(sessionId, options)` - Fork 会话
- `mergeSessions(targetId, sourceId, options)` - 合并会话
- `getSessionBranchTree(sessionId)` - 获取分支树
- `getSessionStatistics()` - 获取统计信息
- `searchSessionMessages(query, options)` - 搜索消息
- `renameSession(sessionId, name)` - 重命名
- `updateSessionTags(sessionId, tags, mode)` - 更新标签
- `exportSessionToFile(sessionId, path, format)` - 导出
- `importSessionFromFile(path, model)` - 导入
- `cleanupSessions(options)` - 清理会话

### SessionManager 方法
- `fork(options)` - Fork 当前会话
- `merge(sourceId, options)` - 合并到当前会话
- `getBranchTree()` - 获取分支树
- `rename(name)` - 重命名
- `updateTags(tags, mode)` - 更新标签
- `searchMessages(query, options)` - 搜索消息
- `getSummary()` - 获取摘要
- `updateCost(input, output, model)` - 更新成本
- `exportToFile(path, format)` - 导出到文件

## 新增数据字段

SessionMetadata 新增字段：
- `parentId` - 父会话 ID
- `forkPoint` - Fork 点（消息索引）
- `branches` - 子会话 ID 列表
- `forkName` - 分支名称
- `mergedFrom` - 合并来源
- `cost` - 累计成本（美元）

## 文件结构

```
/home/user/claude-code-open/
├── src/session/index.ts              # 核心实现（新增 ~600 行）
├── docs/
│   ├── session-fork-guide.md         # 完整使用指南（8000+ 字）
│   ├── CHANGELOG-session-fork.md     # 详细变更日志
│   └── SESSION-FORK-README.md        # 本文件
└── examples/
    └── session-fork-example.ts       # 完整示例代码
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 运行示例
```bash
npm run dev examples/session-fork-example.ts
```

### 3. 在代码中使用
```typescript
import { sessionManager } from './src/session/index.js';

// 开始新会话
sessionManager.start({
  name: 'My Project',
  model: 'claude-sonnet-4'
});

// 添加消息
sessionManager.addMessage({
  role: 'user',
  content: 'Hello!'
});

// 创建分支
const fork = sessionManager.fork({
  fromMessageIndex: 5,
  name: 'Experiment'
});

// 查看统计
const summary = sessionManager.getSummary();
console.log(summary);
```

## 典型使用场景

### 场景 1: 探索不同实现方案
```typescript
// 主分支：使用 REST API
sessionManager.start({ model: 'claude-sonnet-4', name: 'REST API Implementation' });
// ... 进行一些讨论 ...

// 创建分支：尝试 GraphQL
const graphqlBranch = sessionManager.fork({
  fromMessageIndex: 10,
  name: 'GraphQL Alternative'
});
// ... 探索 GraphQL 方案 ...

// 对比两个方案后决定
const tree = sessionManager.getBranchTree();
console.log(`Main: ${tree.session.messageCount} messages`);
console.log(`GraphQL: ${tree.branches[0]?.messageCount} messages`);
```

### 场景 2: 会话备份和分析
```typescript
import { listSessions, exportSessionToFile } from './src/session/index.js';

// 备份所有生产会话
const prodSessions = listSessions({ tags: ['production'] });
prodSessions.forEach(session => {
  exportSessionToFile(
    session.id,
    `./backups/${session.name}.json`,
    'json'
  );
});

// 分析错误模式
const errors = searchSessionMessages('error', { regex: false });
console.log(`Found ${errors.length} error messages across ${
  new Set(errors.map(e => e.sessionId)).size
} sessions`);
```

### 场景 3: 成本追踪
```typescript
import { getSessionStatistics } from './src/session/index.js';

const stats = getSessionStatistics();

console.log('Usage Statistics:');
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
console.log(`Average cost per session: $${(stats.totalCost / stats.totalSessions).toFixed(4)}`);

// 找出最贵的会话
const allSessions = listSessions({ limit: 1000 });
const topExpensive = allSessions
  .filter(s => s.cost)
  .sort((a, b) => (b.cost || 0) - (a.cost || 0))
  .slice(0, 5);

console.log('\nTop 5 Most Expensive Sessions:');
topExpensive.forEach(s => {
  console.log(`  ${s.name}: $${s.cost?.toFixed(4)}`);
});
```

## 向后兼容性

✅ **100% 向后兼容**
- 所有新字段都是可选的
- 现有代码无需修改
- 现有会话文件自动兼容

## 性能考虑

- ✅ 增量保存：只保存修改的会话
- ✅ 懒加载：分支树按需加载
- ✅ 批量操作：减少 I/O 操作
- ⚠️ 全会话搜索在大量会话时可能较慢

## 下一步

1. 📖 阅读[完整使用指南](./session-fork-guide.md)
2. 🔍 查看[示例代码](../examples/session-fork-example.ts)
3. 📝 阅读[详细变更日志](./CHANGELOG-session-fork.md)
4. 💻 开始在项目中使用！

## 问题反馈

如有问题或建议，请参考：
- [项目架构文档](../CLAUDE.md)
- [源码注释](../src/session/index.ts)

---

**版本**: 2.1.0
**更新日期**: 2025-12-24
**作者**: Claude Code Development Team
