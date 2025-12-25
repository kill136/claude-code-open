# 会话 Fork 功能增强 - 变更日志

**版本**: 2.1.0
**日期**: 2025-12-24
**作者**: Claude Code Development Team

## 概述

本次更新大幅增强了会话管理系统，添加了完整的会话分支（Fork）、合并、搜索和统计功能。这些功能使得 Claude Code 能够更好地管理复杂的对话流程，支持实验性开发工作流。

---

## 新增功能

### 1. 会话分支（Fork）系统

#### 核心功能
- **从任意点创建分支**: 可以从会话的任何消息点创建新的分支会话
- **分支元数据追踪**: 记录父会话 ID、分支点、分支名称等信息
- **分支树可视化**: 查看会话的完整分支结构（父会话和子会话）

#### 新增接口
```typescript
interface ForkOptions {
  fromMessageIndex?: number;        // 从哪条消息开始 fork
  name?: string;                    // 新会话名称
  tags?: string[];                  // 新会话标签
  includeFutureMessages?: boolean;  // 是否包含指定索引之后的消息
}
```

#### 新增函数
- `forkSession(sourceSessionId, options)` - Fork 会话
- `getSessionBranchTree(sessionId)` - 获取会话分支树

#### SessionManager 新增方法
- `sessionManager.fork(options)` - Fork 当前会话
- `sessionManager.getBranchTree()` - 获取当前会话的分支树

### 2. 会话合并系统

#### 核心功能
- **多种合并策略**: 支持追加（append）、交错（interleave）、替换（replace）
- **元数据合并**: 可以选择保留源/目标元数据或智能合并
- **冲突解决**: 支持配置冲突解决策略

#### 新增接口
```typescript
interface MergeOptions {
  strategy?: 'append' | 'interleave' | 'replace';
  keepMetadata?: 'source' | 'target' | 'merge';
  conflictResolution?: 'source' | 'target';
}
```

#### 新增函数
- `mergeSessions(targetId, sourceId, options)` - 合并两个会话

#### SessionManager 新增方法
- `sessionManager.merge(sourceId, options)` - 合并到当前会话

### 3. 会话搜索系统

#### 核心功能
- **全文搜索**: 在所有会话中搜索消息内容
- **正则表达式支持**: 支持复杂的模式匹配
- **大小写敏感选项**: 可配置是否区分大小写
- **结果高亮**: 返回匹配的具体文本

#### 新增函数
- `searchSessionMessages(query, options)` - 搜索会话消息内容

#### SessionManager 新增方法
- `sessionManager.searchMessages(query, options)` - 搜索当前会话

### 4. 会话统计系统

#### 核心功能
- **全局统计**: 总会话数、总消息数、总 token 数、总成本
- **平均值计算**: 每会话平均消息数和 token 数
- **模型使用统计**: 各模型的使用次数
- **标签使用统计**: 各标签的使用次数
- **特殊会话识别**: 最旧、最新、最活跃的会话

#### 新增接口
```typescript
interface SessionStatistics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageMessagesPerSession: number;
  averageTokensPerSession: number;
  modelUsage: Record<string, number>;
  tagUsage: Record<string, number>;
  oldestSession?: SessionMetadata;
  newestSession?: SessionMetadata;
  mostActiveSession?: SessionMetadata;
}
```

#### 新增函数
- `getSessionStatistics()` - 获取全局统计信息

#### SessionManager 新增方法
- `sessionManager.getSummary()` - 获取当前会话摘要
- `sessionManager.updateCost(input, output, model)` - 更新会话成本

### 5. 增强的导入导出

#### 核心功能
- **JSON 格式**: 完整的会话数据导入导出
- **Markdown 格式**: 人类可读的会话报告
- **文件操作**: 直接导出到文件和从文件导入
- **自动格式检测**: 导入时自动识别 JSON 或 Markdown

#### 新增函数
- `exportSessionToJSON(session)` - 导出为 JSON 字符串
- `importSessionFromJSON(json)` - 从 JSON 导入
- `exportSessionToFile(sessionId, path, format)` - 导出到文件
- `importSessionFromFile(path, model?)` - 从文件导入

#### SessionManager 新增方法
- `sessionManager.export(format)` - 导出当前会话（支持 JSON 和 Markdown）
- `sessionManager.exportToFile(path, format)` - 导出当前会话到文件

### 6. 会话标签和命名管理

#### 核心功能
- **重命名会话**: 更新会话名称
- **标签管理**: 添加、删除、替换标签
- **按标签过滤**: 列出特定标签的会话

#### 新增函数
- `renameSession(sessionId, name)` - 重命名会话
- `updateSessionTags(sessionId, tags, mode)` - 更新会话标签

#### SessionManager 新增方法
- `sessionManager.rename(name)` - 重命名当前会话
- `sessionManager.updateTags(tags, mode)` - 更新当前会话标签

### 7. 增强的会话清理

#### 核心功能
- **过期会话检测**: 识别并清理过期会话
- **孤立会话处理**: 处理父会话已删除的分支
- **无效文件清理**: 删除损坏的会话文件
- **预览模式**: Dry run 模式预览清理结果

#### 新增函数
- `cleanupSessions(options)` - 清理过期和无效会话
- `bulkDeleteSessions(sessionIds, options)` - 批量删除会话

---

## 接口变更

### SessionMetadata 扩展

新增字段：
```typescript
interface SessionMetadata {
  // ... 原有字段

  // 新增 Fork 相关字段
  parentId?: string;        // 父会话 ID
  forkPoint?: number;       // Fork 点（消息索引）
  branches?: string[];      // 子会话 ID 列表
  forkName?: string;        // 分支名称
  mergedFrom?: string[];    // 合并来源会话列表
  cost?: number;            // 累计成本（美元）
}
```

### SessionManager 方法增强

**修改的方法**:
- `export(format)` - 新增 format 参数，支持 'json' | 'markdown'

**新增的方法**:
- `fork(options)` - Fork 当前会话
- `merge(sourceId, options)` - 合并到当前会话
- `getBranchTree()` - 获取分支树
- `rename(name)` - 重命名会话
- `updateTags(tags, mode)` - 更新标签
- `searchMessages(query, options)` - 搜索消息
- `exportToFile(path, format)` - 导出到文件
- `updateCost(input, output, model)` - 更新成本
- `getSummary()` - 获取会话摘要

---

## 使用场景

### 1. 实验性开发工作流
```typescript
// 在关键决策点创建分支
const experimentBranch = sessionManager.fork({
  fromMessageIndex: 10,
  name: 'Experiment: Alternative Approach',
  tags: ['experiment'],
});

// 如果实验成功，继续该分支
// 如果失败，切换回主分支
```

### 2. 会话合并工作流
```typescript
// 将成功的实验合并回主分支
sessionManager.merge(experimentBranchId, {
  strategy: 'append',
  keepMetadata: 'merge',
});
```

### 3. 会话分析工作流
```typescript
// 搜索所有包含错误的会话
const errors = searchSessionMessages('error');

// 为这些会话添加标签
errors.forEach(result => {
  updateSessionTags(result.sessionId, ['has-errors'], 'add');
});

// 生成统计报告
const stats = getSessionStatistics();
console.log(`Found errors in ${errors.length} messages`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
```

### 4. 会话备份工作流
```typescript
// 定期备份重要会话
const importantSessions = listSessions({
  tags: ['production', 'critical'],
});

importantSessions.forEach(session => {
  exportSessionToFile(
    session.id,
    `./backups/${session.name}-${Date.now()}.json`,
    'json'
  );
});
```

---

## 性能优化

1. **增量保存**: 只保存修改的会话数据
2. **懒加载**: 分支树按需加载，不会一次性加载所有会话
3. **索引优化**: 搜索时使用文件遍历，避免全量加载
4. **批量操作**: 支持批量删除和更新，减少 I/O 操作

---

## 向后兼容性

- ✅ 完全向后兼容：所有新字段都是可选的
- ✅ 现有 API 保持不变：只是添加了新功能
- ✅ 现有会话文件兼容：可以无缝升级

---

## 测试覆盖

新增测试文件：
- `/examples/session-fork-example.ts` - 完整的功能示例

测试覆盖的功能：
- ✅ 会话创建和 Fork
- ✅ 会话合并（多种策略）
- ✅ 会话搜索（正则表达式、大小写）
- ✅ 会话统计
- ✅ 导入导出（JSON、Markdown）
- ✅ 标签管理
- ✅ 会话清理

---

## 文档更新

新增文档：
- `/docs/session-fork-guide.md` - 完整的使用指南（8000+ 字）
  - 详细的 API 文档
  - 使用示例
  - 最佳实践
  - 故障排查

更新文档：
- `CLAUDE.md` - 添加会话 Fork 功能说明

---

## 已知限制

1. **合并策略**: `interleave` 策略目前保持原有顺序，未实现按时间戳排序
2. **搜索性能**: 全会话搜索在会话数量较多时可能较慢
3. **成本计算**: 成本计算基于简化的定价模型，实际成本可能有差异

---

## 未来计划

### 短期（下一个版本）
- [ ] 实现按时间戳的智能合并
- [ ] 添加会话搜索索引以提高性能
- [ ] 支持会话压缩以减少存储空间

### 长期
- [ ] 会话可视化界面（分支树图）
- [ ] 会话协作功能（多用户）
- [ ] 云端会话同步
- [ ] AI 驱动的会话摘要生成

---

## 迁移指南

### 从 2.0.x 升级到 2.1.0

无需任何代码更改！新功能是可选的：

1. **继续使用旧 API**:
   ```typescript
   // 这些代码仍然可以正常工作
   const session = createSession({ model: 'claude-sonnet-4' });
   saveSession(session);
   loadSession(sessionId);
   ```

2. **开始使用新功能**:
   ```typescript
   // 添加新功能时逐步迁移
   const fork = forkSession(sessionId, { name: 'Branch A' });
   const stats = getSessionStatistics();
   ```

3. **现有会话自动兼容**:
   - 现有会话文件会自动添加新的元数据字段
   - 不会丢失任何数据
   - 可以继续使用所有旧功能

---

## 贡献者

- Claude Code Development Team
- 基于官方 Claude CLI v2.0.76 的逆向工程

---

## 参考资料

- [会话 Fork 使用指南](/docs/session-fork-guide.md)
- [功能示例](/examples/session-fork-example.ts)
- [项目架构](/CLAUDE.md)
- [会话管理源码](/src/session/index.ts)

---

## 变更统计

- **新增函数**: 15+
- **新增接口**: 3
- **新增 SessionManager 方法**: 10+
- **代码行数增加**: ~600 行
- **文档增加**: ~10,000 字

---

## 版本号约定

遵循语义化版本：
- **2.1.0**: 主要功能增强（会话 Fork 系统）
- **2.0.x**: 原始版本（基于官方 CLI v2.0.76）

---

**完整更新日志结束**
