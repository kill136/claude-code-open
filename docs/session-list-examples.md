# Session List 功能使用示例

增强的会话列表功能提供了强大的会话管理、搜索、过滤和导出能力。

## 基础使用

### 1. 列出所有会话

```typescript
import { listSessionsEnhanced } from './src/session/index.js';

// 获取最近20个会话
const result = listSessionsEnhanced();
console.log(`共有 ${result.total} 个会话`);
console.log(`当前显示: ${result.sessions.length}`);

for (const session of result.sessions) {
  console.log(`${session.name || session.id}: ${session.messageCount} 条消息`);
}
```

### 2. 分页查询

```typescript
// 获取第二页，每页10条
const page2 = listSessionsEnhanced({
  limit: 10,
  offset: 10,
});

console.log(`是否还有更多: ${page2.hasMore}`);
```

### 3. 搜索会话

```typescript
import { searchSessions } from './src/session/index.js';

// 搜索包含 "bug" 的会话
const bugSessions = searchSessions('bug');

// 搜索并排序
const results = listSessionsEnhanced({
  search: 'refactor',
  sortBy: 'messageCount',
  sortOrder: 'desc',
});
```

## 高级过滤

### 4. 按日期范围过滤

```typescript
// 查找最近7天的会话
const lastWeek = listSessionsEnhanced({
  filter: {
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
});

// 查找特定时间段的会话
const dateRange = listSessionsEnhanced({
  filter: {
    dateFrom: new Date('2024-01-01'),
    dateTo: new Date('2024-12-31'),
  },
});
```

### 5. 按模型过滤

```typescript
// 查找使用 Sonnet 的会话
const sonnetSessions = listSessionsEnhanced({
  filter: {
    model: 'sonnet',
  },
});

// 查找使用多个模型的会话
const multiModel = listSessionsEnhanced({
  filter: {
    model: ['opus', 'sonnet'],
  },
});
```

### 6. 按消息数量过滤

```typescript
// 查找长对话（超过50条消息）
const longConversations = listSessionsEnhanced({
  filter: {
    minMessages: 50,
  },
  sortBy: 'messageCount',
  sortOrder: 'desc',
});

// 查找短对话
const shortConversations = listSessionsEnhanced({
  filter: {
    maxMessages: 10,
  },
});
```

### 7. 按成本过滤

```typescript
// 查找高成本会话
const expensiveSessions = listSessionsEnhanced({
  filter: {
    minCost: 1.0, // 超过$1
  },
  sortBy: 'cost',
  sortOrder: 'desc',
});
```

### 8. 按标签过滤

```typescript
// 查找带有特定标签的会话
const taggedSessions = listSessionsEnhanced({
  filter: {
    tags: ['important', 'production'],
  },
});
```

### 9. 按分支状态过滤

```typescript
// 查找所有分支会话
const forkedSessions = listSessionsEnhanced({
  filter: {
    hasParent: true,
  },
});

// 查找有子分支的会话
const sessionsWithBranches = listSessionsEnhanced({
  filter: {
    hasBranches: true,
  },
});
```

### 10. 组合过滤条件

```typescript
// 复杂查询示例
const complexQuery = listSessionsEnhanced({
  search: 'authentication',
  filter: {
    model: 'opus',
    dateFrom: new Date('2024-11-01'),
    minMessages: 20,
    tags: ['backend'],
    hasParent: false,
  },
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  limit: 50,
});
```

## 会话详情

### 11. 获取详细信息

```typescript
import { getSessionDetails } from './src/session/index.js';

const details = getSessionDetails('session-id');

if (details) {
  console.log('会话详情:');
  console.log(`  名称: ${details.name}`);
  console.log(`  消息数: ${details.messageCount}`);
  console.log(`  成本: $${details.cost?.toFixed(4)}`);
  console.log(`  持续时间: ${(details.duration / 1000 / 60).toFixed(1)} 分钟`);

  console.log('\n工具使用统计:');
  for (const [tool, count] of Object.entries(details.toolUsageStats)) {
    console.log(`  ${tool}: ${count} 次`);
  }

  console.log('\n消息统计:');
  console.log(`  用户消息: ${details.messageRoleStats.user}`);
  console.log(`  助手消息: ${details.messageRoleStats.assistant}`);

  console.log(`\n平均消息长度: ${details.averageMessageLength.toFixed(0)} 字符`);

  if (details.firstMessagePreview) {
    console.log(`\n第一条消息预览: ${details.firstMessagePreview.substring(0, 100)}...`);
  }
}
```

## 批量操作

### 12. 批量删除

```typescript
import { bulkDeleteSessions } from './src/session/index.js';

// 先查找要删除的会话
const oldSessions = listSessionsEnhanced({
  filter: {
    dateTo: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90天前
  },
  limit: 1000,
});

const idsToDelete = oldSessions.sessions.map(s => s.id);

// 批量删除
const deleteResult = bulkDeleteSessionsEnhanced(idsToDelete);
console.log(`成功删除: ${deleteResult.deleted.length}`);
console.log(`失败: ${deleteResult.failed.length}`);
```

### 13. 批量归档

```typescript
import { bulkArchiveSessions } from './src/session/index.js';

// 归档旧会话
const toArchive = listSessionsEnhanced({
  filter: {
    dateTo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  limit: 1000,
});

const archiveResult = bulkArchiveSessions(toArchive.sessions.map(s => s.id));
console.log(`归档成功: ${archiveResult.archived.length}`);
console.log(`归档失败: ${archiveResult.failed.length}`);
```

### 14. 批量导出

```typescript
import { bulkExportSessions } from './src/session/index.js';

// 导出特定会话
const sessionIds = ['session-1', 'session-2', 'session-3'];
const exports = bulkExportSessions(sessionIds, 'json');

for (const [id, content] of exports) {
  console.log(`导出 ${id}: ${content.length} 字节`);
  // 保存到文件
  fs.writeFileSync(`exports/${id}.json`, content);
}
```

## 导出功能

### 15. 导出为 JSON

```typescript
import { exportSession } from './src/session/index.js';

const json = exportSession('session-id', 'json', {
  includeMessages: true,
  includeMetadata: true,
  prettyPrint: true,
});

if (json) {
  fs.writeFileSync('session-export.json', json);
}
```

### 16. 导出为 Markdown

```typescript
const markdown = exportSession('session-id', 'md', {
  includeMessages: true,
  includeMetadata: true,
});

if (markdown) {
  fs.writeFileSync('session-export.md', markdown);
}
```

### 17. 导出为 HTML

```typescript
const html = exportSession('session-id', 'html', {
  includeMessages: true,
  includeMetadata: true,
});

if (html) {
  fs.writeFileSync('session-export.html', html);
}
```

### 18. 导出多个会话

```typescript
import { exportMultipleSessions } from './src/session/index.js';

const sessionIds = ['session-1', 'session-2', 'session-3'];

// 导出为单个 JSON 文件
const jsonExport = exportMultipleSessions(sessionIds, 'json');
fs.writeFileSync('sessions-bundle.json', jsonExport);

// 导出为单个 HTML 文件
const htmlExport = exportMultipleSessions(sessionIds, 'html');
fs.writeFileSync('sessions-bundle.html', htmlExport);
```

## 统计和报告

### 19. 获取统计信息

```typescript
import { getListStatistics } from './src/session/index.js';

// 所有会话的统计
const stats = getListStatistics();

console.log('会话统计:');
console.log(`  总会话数: ${stats.totalSessions}`);
console.log(`  总消息数: ${stats.totalMessages}`);
console.log(`  总Token数: ${stats.totalTokens.toLocaleString()}`);
console.log(`  总成本: $${stats.totalCost.toFixed(2)}`);
console.log(`  平均成本: $${stats.averageCost.toFixed(4)}`);
console.log(`  平均消息数: ${stats.averageMessages.toFixed(1)}`);

console.log('\n模型分布:');
for (const [model, count] of Object.entries(stats.modelDistribution)) {
  const percentage = ((count / stats.totalSessions) * 100).toFixed(1);
  console.log(`  ${model}: ${count} (${percentage}%)`);
}

console.log('\n标签分布:');
for (const [tag, count] of Object.entries(stats.tagDistribution)) {
  console.log(`  ${tag}: ${count}`);
}

if (stats.mostActiveSession) {
  console.log(`\n最活跃会话: ${stats.mostActiveSession.name || stats.mostActiveSession.id}`);
  console.log(`  消息数: ${stats.mostActiveSession.messageCount}`);
}
```

### 20. 生成报告

```typescript
import { generateSessionReport } from './src/session/index.js';

// 生成文本格式报告
const textReport = generateSessionReport({
  filter: {
    dateFrom: new Date('2024-01-01'),
  },
  format: 'text',
});

console.log(textReport);
// 或保存到文件
fs.writeFileSync('session-report.txt', textReport);

// 生成 JSON 格式报告
const jsonReport = generateSessionReport({
  filter: {
    model: 'opus',
    minCost: 0.1,
  },
  format: 'json',
});

fs.writeFileSync('session-report.json', jsonReport);
```

## 缓存管理

### 21. 清除缓存

```typescript
import { clearSessionCache } from './src/session/index.js';

// 在创建、删除或修改会话后清除缓存
clearSessionCache();

// 缓存会自动在1分钟后过期
```

## CLI 集成示例

### 22. 命令行工具示例

```typescript
// 示例 CLI 命令: claude sessions list

async function listCommand(options: {
  limit?: number;
  search?: string;
  model?: string;
  from?: string;
  to?: string;
  sort?: string;
}) {
  const filter: SessionFilter = {};

  if (options.model) filter.model = options.model;
  if (options.from) filter.dateFrom = new Date(options.from);
  if (options.to) filter.dateTo = new Date(options.to);

  const result = listSessionsEnhanced({
    limit: options.limit || 20,
    search: options.search,
    filter,
    sortBy: (options.sort as any) || 'updatedAt',
  });

  console.log(`\n找到 ${result.total} 个会话:\n`);

  for (const session of result.sessions) {
    const created = new Date(session.createdAt).toLocaleString();
    const cost = session.cost ? `$${session.cost.toFixed(4)}` : 'N/A';

    console.log(`ID: ${session.id}`);
    console.log(`  名称: ${session.name || '(未命名)'}`);
    console.log(`  模型: ${session.model}`);
    console.log(`  消息: ${session.messageCount}`);
    console.log(`  成本: ${cost}`);
    console.log(`  创建: ${created}`);
    if (session.tags && session.tags.length > 0) {
      console.log(`  标签: ${session.tags.join(', ')}`);
    }
    console.log('');
  }

  if (result.hasMore) {
    console.log(`... 还有 ${result.total - result.offset - result.sessions.length} 个会话`);
  }
}

// 使用示例
listCommand({
  limit: 10,
  search: 'refactor',
  model: 'sonnet',
  sort: 'cost',
});
```

### 23. 导出命令示例

```typescript
// 示例 CLI 命令: claude sessions export

async function exportCommand(options: {
  ids?: string[];
  all?: boolean;
  format: 'json' | 'md' | 'html';
  output: string;
}) {
  let sessionIds: string[];

  if (options.all) {
    const all = listSessionsEnhanced({ limit: 10000 });
    sessionIds = all.sessions.map(s => s.id);
  } else if (options.ids) {
    sessionIds = options.ids;
  } else {
    console.error('请指定 --ids 或 --all');
    return;
  }

  console.log(`正在导出 ${sessionIds.length} 个会话...`);

  const content = exportMultipleSessions(sessionIds, options.format);
  if (content) {
    fs.writeFileSync(options.output, content);
    console.log(`成功导出到: ${options.output}`);
  } else {
    console.error('导出失败');
  }
}

// 使用示例
exportCommand({
  ids: ['session-1', 'session-2'],
  format: 'html',
  output: 'export.html',
});
```

### 24. 清理命令示例

```typescript
// 示例 CLI 命令: claude sessions clean

async function cleanCommand(options: {
  older?: number; // 天数
  dryRun?: boolean;
}) {
  const cutoffDate = new Date(Date.now() - (options.older || 90) * 24 * 60 * 60 * 1000);

  const oldSessions = listSessionsEnhanced({
    filter: {
      dateTo: cutoffDate,
    },
    limit: 10000,
  });

  console.log(`找到 ${oldSessions.total} 个超过 ${options.older || 90} 天的会话`);

  if (options.dryRun) {
    console.log('\n预览将要删除的会话:');
    for (const session of oldSessions.sessions) {
      console.log(`  ${session.id} - ${new Date(session.createdAt).toLocaleDateString()}`);
    }
    console.log('\n使用 --no-dry-run 执行实际删除');
  } else {
    const result = bulkDeleteSessionsEnhanced(oldSessions.sessions.map(s => s.id));
    console.log(`\n删除完成:`);
    console.log(`  成功: ${result.deleted.length}`);
    console.log(`  失败: ${result.failed.length}`);
  }
}

// 使用示例
cleanCommand({
  older: 90,
  dryRun: true,
});
```

## 最佳实践

1. **使用缓存**: 列表操作会自动缓存1分钟，重复查询会很快
2. **分页查询**: 大量会话时使用 limit 和 offset 避免内存问题
3. **定期清理**: 使用批量删除或归档功能管理旧会话
4. **导出备份**: 定期导出重要会话进行备份
5. **标签管理**: 使用标签组织会话，便于过滤和搜索
6. **成本追踪**: 定期查看统计报告，监控 API 使用成本

## 性能提示

- 会话列表功能支持处理数千个会话
- 缓存机制可以显著提高重复查询性能
- 过滤和搜索在内存中进行，速度很快
- 批量操作一次性处理多个会话，比循环调用单个操作更高效
