# 上下文压缩快速参考

## 快速开始

```typescript
import { ContextManager } from './src/context/index.js';

// 1. 创建管理器
const manager = new ContextManager({
  enableIncrementalCompression: true,
  keepRecentMessages: 10,
});

// 2. 添加对话
manager.addTurn(userMessage, assistantMessage);

// 3. 获取消息
const messages = manager.getMessages();

// 4. 查看统计
console.log(manager.getFormattedReport());
```

## 常用配置

### 默认配置（推荐）
```typescript
{
  maxTokens: 180000,
  reserveTokens: 8192,
  summarizeThreshold: 0.7,
  keepRecentMessages: 10,
  enableIncrementalCompression: true,
  toolOutputMaxChars: 2000,
  codeBlockMaxLines: 50,
}
```

### 长期会话
```typescript
{
  keepRecentMessages: 20,
  enableAISummary: true,
  summarizeThreshold: 0.6,
}
```

### 代码密集型
```typescript
{
  codeBlockMaxLines: 30,
  toolOutputMaxChars: 1500,
}
```

### 性能优先
```typescript
{
  enableIncrementalCompression: true,
  enableAISummary: false,
  keepRecentMessages: 5,
}
```

## 核心 API

### Token 估算
```typescript
import { estimateTokens, estimateMessageTokens } from './context/index.js';

estimateTokens('text')           // 估算文本
estimateMessageTokens(message)   // 估算消息
```

### 消息压缩
```typescript
import { compressMessage, compressMessages } from './context/index.js';

compressMessage(msg, config)     // 单个消息
compressMessages(msgs, config)   // 批量压缩
```

### 工具输出压缩
```typescript
import { batchCompressToolResults } from './context/index.js';

batchCompressToolResults(messages, 2000)  // 批量压缩
```

### 上下文优化
```typescript
import { optimizeContext } from './context/index.js';

const result = optimizeContext(messages, 100000, config);
// result: { messages, compressionRatio, savedTokens }
```

### 摘要生成
```typescript
import { createSummary, createAISummary } from './context/index.js';

createSummary(turns)              // 简单摘要
await createAISummary(turns, api) // AI 摘要
```

## 管理器方法

### 基础操作
```typescript
manager.setSystemPrompt(prompt)   // 设置系统提示
manager.addTurn(user, assistant)  // 添加对话
manager.getMessages()             // 获取消息
manager.clear()                   // 清除历史
```

### 统计信息
```typescript
manager.getStats()                // 基础统计
manager.getCompressionDetails()   // 压缩详情
manager.getContextUsage()         // 使用率
manager.isNearLimit()             // 是否接近限制
manager.getFormattedReport()      // 格式化报告
```

### 压缩控制
```typescript
await manager.compact()           // 强制压缩
manager.analyzeCompression()      // 分析效果
```

### 数据持久化
```typescript
const data = manager.export()     // 导出数据
manager.import(data)              // 导入数据
```

## 压缩策略

### 三级压缩
```
Level 1: 增量压缩（实时）
  ↓ 工具输出 > 2000 字符
  ↓ 代码块 > 50 行

Level 2: 摘要压缩（阈值触发）
  ↓ 使用率 > 70%
  ↓ 保留最近 10 轮

Level 3: 裁剪压缩（紧急）
  ↓ 摘要后仍超限
  ↓ 移除中间消息
```

### 压缩优先级
```
高优先级（保护）
  - 最近 N 轮对话
  - 系统提示
  - 关键决策

中优先级（压缩）
  - 长工具输出
  - 大代码块
  - 文件内容

低优先级（移除）
  - 旧对话轮次
  - 重复信息
```

## 性能指标

### Token 估算
- 精度: ±3-8%
- 速度: ~0.1ms/message

### 压缩效果
- 工具输出: 30-50%
- 代码块: 40-60%
- AI 摘要: 20-35%
- 综合: 50-70%

### 时间开销
- 增量压缩: ~1ms/message
- 简单摘要: ~0.5ms/turn
- AI 摘要: ~2-5s/batch

## 故障排除

### 问题: 压缩效果不理想
```typescript
// 解决: 降低阈值
{
  toolOutputMaxChars: 1000,
  codeBlockMaxLines: 30,
}
```

### 问题: AI 摘要失败
```typescript
// 解决: 设置客户端或禁用
manager.setApiClient(apiClient);
// 或
config.enableAISummary = false;
```

### 问题: Token 估算不准
```typescript
// 解决: 添加余量
const tokens = estimateTokens(text);
const adjusted = Math.ceil(tokens * 1.2);
```

## 最佳实践

### ✅ 推荐
- 启用增量压缩
- 保留 10-20 轮最近对话
- 监控上下文使用率
- 定期检查压缩效果

### ❌ 避免
- 在短会话中启用 AI 摘要
- 设置过小的 `keepRecentMessages`
- 频繁调用 `compact()`
- 忽略压缩统计

## 示例代码

### 完整示例
```typescript
import { ContextManager } from './src/context/index.js';

// 创建
const manager = new ContextManager({
  enableIncrementalCompression: true,
  keepRecentMessages: 10,
});

// 使用
for (const turn of conversation) {
  manager.addTurn(turn.user, turn.assistant);

  // 监控
  if (manager.isNearLimit()) {
    console.log('⚠️ 接近上下文限制');
    await manager.compact();
  }
}

// 报告
console.log(manager.getFormattedReport());
```

### 批量优化
```typescript
import { optimizeContext } from './src/context/index.js';

const result = optimizeContext(
  messages,
  50000,  // 目标 token
  { toolOutputMaxChars: 1000 }
);

console.log(`压缩至 ${result.compressionRatio * 100}%`);
console.log(`节省 ${result.savedTokens} tokens`);
```

## 配置速查表

| 参数 | 默认值 | 说明 | 范围 |
|------|--------|------|------|
| `maxTokens` | 180000 | 最大 token | 10K-200K |
| `reserveTokens` | 8192 | 预留输出 | 4K-16K |
| `summarizeThreshold` | 0.7 | 压缩阈值 | 0.5-0.9 |
| `keepRecentMessages` | 10 | 保留轮数 | 5-30 |
| `toolOutputMaxChars` | 2000 | 工具输出 | 500-5000 |
| `codeBlockMaxLines` | 50 | 代码行数 | 20-100 |
| `enableAISummary` | false | AI 摘要 | true/false |
| `enableIncrementalCompression` | true | 增量压缩 | true/false |

## 监控命令

```typescript
// 上下文使用情况
const usage = manager.getContextUsage();
console.log(`${usage.percentage.toFixed(1)}% (${usage.used}/${usage.total})`);

// 压缩详情
const details = manager.getCompressionDetails();
console.log(`压缩: ${details.compressedTurns}/${details.totalTurns}`);

// 完整报告
console.log(manager.getFormattedReport());
```

## 相关文档

- 📖 [完整使用指南](./context-compression-guide.md)
- 📝 [更新日志](./CONTEXT_COMPRESSION_CHANGELOG.md)
- 💻 [示例代码](../examples/context-compression-example.ts)
- 🏗️ [架构说明](../CLAUDE.md)

---

**快速参考 v1.0** | 更新于 2025-12-24
