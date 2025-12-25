# 费用与配额功能对比分析 (T417-T424)

## 概述

本文档对比分析本项目与官方 @anthropic-ai/claude-code 包在费用计算、预算管理、配额控制等功能的实现差异。

**分析日期**: 2025-12-25
**官方版本**: 2.0.76
**对比范围**: T417-T424（费用与配额管理）

---

## T417: 费用计算引擎

### 本项目实现

**位置**: `/home/user/claude-code-open/src/core/client.ts`

```typescript
// 模型价格定义 (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
};

// 费用计算方法
private calculateCost(inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[this.model] || { input: 3, output: 15 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

// 使用统计接口
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// 获取格式化的费用字符串
getFormattedCost(): string {
  if (this.totalUsage.estimatedCost < 0.01) {
    return `$${(this.totalUsage.estimatedCost * 100).toFixed(2)}¢`;
  }
  return `$${this.totalUsage.estimatedCost.toFixed(4)}`;
}
```

**特点**:
- ✅ 硬编码的模型定价表
- ✅ 基于输入/输出 token 的费用计算
- ✅ 美元和美分格式化
- ✅ 会话级别的费用累计
- ❌ 不支持缓存 token 的费用计算
- ❌ 不支持批量定价
- ❌ 未知模型使用默认定价

### 官方实现

**位置**: `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js:231`

```javascript
// 混淆代码（简化表示）
function Mg1(){
  let A=EqA(mD())+(ST0()?" (costs may be inaccurate due to usage of unknown models)":""),
  Q=qD8();
  return V1.dim(`Total cost:            ${A}
Total duration (API):  ${SH(LO())}
Total duration (wall): ${SH(MEA())}
Total code changes:    ${R8A()} ${R8A()===1?"line":"lines"} added, ${_8A()} ${_8A()===1?"line":"lines"} removed
${Q}`)
}

// Token 使用统计（从 cli.js:1991）
"context_window": {
  "total_input_tokens": number,       // 会话累计输入 tokens
  "total_output_tokens": number,      // 会话累计输出 tokens
  "context_window_size": number,      // 当前模型的上下文窗口大小
  "current_usage": {                  // 最近一次 API 调用的使用情况
    "input_tokens": number,
    "output_tokens": number,
    "cache_creation_input_tokens": number,  // 写入缓存的 tokens
    "cache_read_input_tokens": number       // 从缓存读取的 tokens
  } | null
}
```

**特点**:
- ✅ 支持缓存 token 的跟踪（cache_creation/cache_read）
- ✅ 未知模型的费用警告提示
- ✅ 区分会话累计和当前使用
- ✅ 与代码更改统计集成
- ✅ API 调用时长和墙钟时长统计

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 基础费用计算 | ✅ 完整 | ✅ 完整 | 无 |
| 缓存 token 费用 | ❌ 缺失 | ✅ 支持 | **重要** |
| 未知模型警告 | ❌ 缺失 | ✅ 支持 | 中等 |
| 费用格式化 | ✅ 美元/美分 | ✅ 多格式 | 小 |
| 统计信息整合 | ⚠️ 部分 | ✅ 完整 | 中等 |
| 会话/当前分离 | ❌ 缺失 | ✅ 支持 | 中等 |

**实现建议**:
1. **紧急**: 添加缓存 token 的费用计算（Anthropic Prompt Caching 定价不同）
2. **重要**: 在模型定价表中添加未知模型检测和警告
3. **建议**: 区分会话累计费用和当前请求费用

---

## T418: budget_usd 限制

### 本项目实现

**状态**: ❌ **未实现**

在配置文件中未找到 `budget_usd`、`budgetLimit` 或相关的预算限制配置。

**搜索结果**:
- `/home/user/claude-code-open/src/types/config.ts`: 无预算相关配置
- `/home/user/claude-code-open/src/core/client.ts`: 无预算检查逻辑
- `/home/user/claude-code-open/src/session/index.ts`: 仅有 cost 字段，无限制逻辑

### 官方实现

**状态**: ❓ **无法确认**

在压缩混淆的代码中未发现明确的 `budget_usd` 配置或预算限制功能。可能的情况：
1. 该功能可能在官方服务端实现，而非客户端
2. 功能可能通过 API key 级别的配额控制，而非 CLI 配置
3. 该功能可能尚未公开发布

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 预算配置 | ❌ 无 | ❓ 未知 | 无法评估 |
| 预算检查 | ❌ 无 | ❓ 未知 | 无法评估 |
| 超预算警告 | ❌ 无 | ❓ 未知 | 无法评估 |
| 超预算阻止 | ❌ 无 | ❓ 未知 | 无法评估 |

**实现建议**:
1. **可选**: 在 `ClaudeConfig` 中添加 `budgetUSD?: number` 配置
2. **可选**: 在 `ClaudeClient` 中添加预算检查逻辑
3. **可选**: 实现超预算时的警告/阻止机制

**参考实现**:
```typescript
// 建议的配置类型
export interface BudgetSettings {
  /** 每日预算（美元） */
  dailyBudgetUSD?: number;

  /** 每月预算（美元） */
  monthlyBudgetUSD?: number;

  /** 会话预算（美元） */
  sessionBudgetUSD?: number;

  /** 超预算行为 */
  onBudgetExceeded?: 'warn' | 'block' | 'notify';

  /** 预算警告阈值（百分比） */
  warningThreshold?: number; // 默认 80%
}

// 建议的预算检查逻辑
class ClaudeClient {
  private checkBudget(estimatedCost: number): void {
    const config = this.budgetSettings;
    if (!config) return;

    const totalCost = this.totalUsage.estimatedCost + estimatedCost;

    if (config.sessionBudgetUSD && totalCost > config.sessionBudgetUSD) {
      if (config.onBudgetExceeded === 'block') {
        throw new Error(`Session budget exceeded: $${totalCost.toFixed(4)} > $${config.sessionBudgetUSD}`);
      } else if (config.onBudgetExceeded === 'warn') {
        console.warn(`⚠️  Session budget exceeded: $${totalCost.toFixed(4)} > $${config.sessionBudgetUSD}`);
      }
    }

    // 警告阈值检查
    const threshold = config.warningThreshold || 0.8;
    if (config.sessionBudgetUSD && totalCost > config.sessionBudgetUSD * threshold) {
      console.warn(`⚠️  Approaching session budget: ${((totalCost / config.sessionBudgetUSD) * 100).toFixed(1)}%`);
    }
  }
}
```

---

## T419: credit_balance_low 告警

### 本项目实现

**状态**: ❌ **未实现**

未实现余额查询和低余额告警功能。

### 官方实现

**状态**: ❓ **无法确认**

这是一个需要 Anthropic API 支持的功能，可能通过以下方式实现：
1. API 响应头中的余额信息
2. 专门的余额查询端点
3. Webhook 通知

在混淆代码中未找到明确的余额查询实现。

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 余额查询 | ❌ 无 | ❓ 未知 | 无法评估 |
| 低余额检测 | ❌ 无 | ❓ 未知 | 无法评估 |
| 告警通知 | ❌ 无 | ❓ 未知 | 无法评估 |

**实现建议**:
- 该功能依赖于 Anthropic API 的支持，建议优先级较低
- 如果 API 提供余额信息，可在每次请求后检查并警告

---

## T420: billing_error 处理

### 本项目实现

**位置**: `/home/user/claude-code-open/src/core/client.ts`

```typescript
// 可重试的错误类型
const RETRYABLE_ERRORS = [
  'overloaded_error',
  'rate_limit_error',
  'api_error',
  'timeout',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];

// 重试逻辑
private async withRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorType = error.type || error.code || error.message || '';
    const isRetryable = RETRYABLE_ERRORS.some(
      (e) => errorType.includes(e) || error.message?.includes(e)
    );

    if (isRetryable && retryCount < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, retryCount); // 指数退避
      console.error(
        `API error (${errorType}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
      );
      await this.sleep(delay);
      return this.withRetry(operation, retryCount + 1);
    }

    throw error;
  }
}
```

**特点**:
- ✅ 通用的 API 错误重试
- ⚠️ 未明确区分计费错误
- ❌ 未针对计费错误的特殊处理

### 官方实现

**状态**: ❓ **无法完全确认**

从代码中可以看到大量的错误处理逻辑，但由于混淆，无法确定是否有专门的 `billing_error` 处理。

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 基础错误处理 | ✅ 完整 | ✅ 完整 | 无 |
| 计费错误识别 | ❌ 缺失 | ❓ 未知 | 无法评估 |
| 支付方式更新 | ❌ 缺失 | ❓ 未知 | 无法评估 |
| 友好错误提示 | ⚠️ 基础 | ❓ 未知 | 无法评估 |

**实现建议**:
```typescript
// 建议的计费错误处理
const BILLING_ERRORS = [
  'insufficient_credits',
  'payment_required',
  'billing_error',
  'invalid_payment_method',
];

private handleBillingError(error: any): void {
  const errorType = error.type || error.code || '';

  if (BILLING_ERRORS.some(e => errorType.includes(e))) {
    console.error('\n❌ Billing Error:');
    console.error(`   ${error.message || 'A billing error occurred'}`);
    console.error('\n💡 Possible solutions:');
    console.error('   1. Check your account balance at https://console.anthropic.com');
    console.error('   2. Update your payment method');
    console.error('   3. Contact support if the issue persists\n');

    throw new Error(`Billing error: ${error.message}`);
  }
}
```

---

## T421: quota 管理

### 本项目实现

**状态**: ❌ **未实现**

未发现配额管理相关功能，包括：
- 速率限制跟踪
- TPM (Tokens Per Minute) 限制
- RPM (Requests Per Minute) 限制
- 配额重置时间

### 官方实现

**状态**: ⚠️ **部分支持**

从配置类型中发现速率限制配置（cli.js 代码中的高级设置）:

```typescript
// 从官方 CLI 推断的配置结构
rateLimit?: {
  enabled?: boolean;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
}
```

但未找到实际的配额跟踪和限制执行代码（可能在混淆代码中）。

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 速率限制配置 | ❌ 无 | ⚠️ 配置支持 | 中等 |
| 请求速率跟踪 | ❌ 无 | ❓ 未知 | 无法评估 |
| Token 速率跟踪 | ❌ 无 | ❓ 未知 | 无法评估 |
| 自动降速 | ❌ 无 | ❓ 未知 | 无法评估 |
| 配额重置提示 | ❌ 无 | ❓ 未知 | 无法评估 |

**实现建议**:
```typescript
// 建议的配额管理实现
export interface QuotaSettings {
  /** 启用速率限制 */
  enabled?: boolean;

  /** 每分钟最大请求数 */
  requestsPerMinute?: number;

  /** 每分钟最大 token 数 */
  tokensPerMinute?: number;

  /** 每天最大请求数 */
  requestsPerDay?: number;

  /** 每天最大 token 数 */
  tokensPerDay?: number;
}

class QuotaTracker {
  private requestTimestamps: number[] = [];
  private tokenUsage: { timestamp: number; tokens: number }[] = [];

  checkQuota(estimatedTokens: number): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // 清理过期数据
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    this.tokenUsage = this.tokenUsage.filter(u => u.timestamp > oneMinuteAgo);

    // 检查 RPM
    if (this.settings.requestsPerMinute &&
        this.requestTimestamps.length >= this.settings.requestsPerMinute) {
      throw new Error(`Rate limit exceeded: ${this.settings.requestsPerMinute} requests/minute`);
    }

    // 检查 TPM
    const totalTokens = this.tokenUsage.reduce((sum, u) => sum + u.tokens, 0);
    if (this.settings.tokensPerMinute &&
        totalTokens + estimatedTokens > this.settings.tokensPerMinute) {
      throw new Error(`Token rate limit exceeded: ${this.settings.tokensPerMinute} tokens/minute`);
    }

    // 记录使用
    this.requestTimestamps.push(now);
    this.tokenUsage.push({ timestamp: now, tokens: estimatedTokens });
  }
}
```

---

## T422: limit_increase 请求

### 本项目实现

**状态**: ❌ **未实现**

未实现任何配额/限制提升的请求功能。

### 官方实现

**状态**: ❌ **未发现**

在官方 CLI 中未发现自动化的限制提升请求功能。这可能是因为：
1. 限制提升通过 Anthropic Console 网页进行
2. 该功能可能通过其他渠道（邮件、支持工单）实现
3. 该功能可能尚未开发

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 限制查询 | ❌ 无 | ❌ 无 | 无 |
| 提升请求 | ❌ 无 | ❌ 无 | 无 |
| 请求状态跟踪 | ❌ 无 | ❌ 无 | 无 |

**实现建议**:
- 优先级低，建议引导用户通过官方渠道申请
- 可以添加一个便捷命令，打开 Anthropic Console 页面

```typescript
// 建议的便捷命令
function requestLimitIncrease() {
  console.log('\n📊 To request a limit increase:');
  console.log('   1. Visit https://console.anthropic.com/settings/limits');
  console.log('   2. Submit a limit increase request');
  console.log('   3. Provide usage justification\n');

  // 可选：自动打开浏览器
  // open('https://console.anthropic.com/settings/limits');
}
```

---

## T423: token_usage 统计

### 本项目实现

**位置**:
- `/home/user/claude-code-open/src/core/client.ts`
- `/home/user/claude-code-open/src/session/index.ts`

```typescript
// 客户端级别的使用统计
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

class ClaudeClient {
  private totalUsage: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };

  private updateUsage(inputTokens: number, outputTokens: number): void {
    this.totalUsage.inputTokens += inputTokens;
    this.totalUsage.outputTokens += outputTokens;
    this.totalUsage.totalTokens += inputTokens + outputTokens;
    this.totalUsage.estimatedCost += this.calculateCost(inputTokens, outputTokens);
  }
}

// 会话级别的使用统计
export interface SessionMetadata {
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
}

// 全局统计
export function getSessionStatistics(): SessionStatistics {
  return {
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    averageMessagesPerSession: number;
    averageTokensPerSession: number;
    modelUsage: Record<string, number>;
    // ...
  };
}
```

**特点**:
- ✅ 客户端级别统计
- ✅ 会话级别统计
- ✅ 全局统计（所有会话）
- ✅ 按模型分类统计
- ❌ 缺少缓存 token 统计
- ❌ 缺少时间维度统计（每日/每周/每月）

### 官方实现

**位置**: `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js:1991-2012`

```javascript
// 官方的 context_window 统计
{
  "context_window": {
    "total_input_tokens": number,       // 会话累计输入
    "total_output_tokens": number,      // 会话累计输出
    "context_window_size": number,      // 上下文窗口大小
    "current_usage": {                  // 当前请求使用
      "input_tokens": number,
      "output_tokens": number,
      "cache_creation_input_tokens": number,  // ⭐ 缓存创建
      "cache_read_input_tokens": number       // ⭐ 缓存读取
    } | null
  }
}

// 汇总统计（cli.js:231）
Total cost:            $X.XXXX
Total duration (API):  XX.XXs
Total duration (wall): XX.XXs
Total code changes:    XX lines added, XX lines removed
```

**特点**:
- ✅ 区分会话累计和当前使用
- ✅ 缓存 token 的详细跟踪
- ✅ 与代码更改集成
- ✅ API 时长和实际时长分离

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 基础 token 统计 | ✅ 完整 | ✅ 完整 | 无 |
| 缓存 token 统计 | ❌ 缺失 | ✅ 支持 | **重要** |
| 累计/当前分离 | ⚠️ 部分 | ✅ 完整 | 中等 |
| 模型维度统计 | ✅ 支持 | ✅ 支持 | 无 |
| 时间维度统计 | ❌ 缺失 | ❓ 未知 | 中等 |
| 代码更改统计 | ❌ 缺失 | ✅ 支持 | 低 |
| 时长统计 | ❌ 缺失 | ✅ 支持 | 低 |

**实现建议**:
```typescript
// 扩展 UsageStats 以支持缓存
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;      // ⭐ 新增
  cacheReadTokens: number;          // ⭐ 新增
  totalTokens: number;
  estimatedCost: number;
}

// 计算包含缓存的费用
private calculateCostWithCache(usage: {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}): number {
  const pricing = MODEL_PRICING[this.model];

  // 标准费用
  const inputCost = (usage.input / 1_000_000) * pricing.input;
  const outputCost = (usage.output / 1_000_000) * pricing.output;

  // 缓存费用（通常缓存创建比标准输入贵 25%，缓存读取便宜 90%）
  const cacheCreationCost = (usage.cacheCreation / 1_000_000) * pricing.input * 1.25;
  const cacheReadCost = (usage.cacheRead / 1_000_000) * pricing.input * 0.1;

  return inputCost + outputCost + cacheCreationCost + cacheReadCost;
}

// 时间维度统计
export interface TimeBasedUsageStats {
  today: UsageStats;
  thisWeek: UsageStats;
  thisMonth: UsageStats;
  allTime: UsageStats;
}
```

---

## T424: 费用报表导出

### 本项目实现

**状态**: ⚠️ **基础支持**

**位置**: `/home/user/claude-code-open/src/session/index.ts`

```typescript
// 会话导出功能（包含费用信息）
export function exportSessionToMarkdown(session: SessionData): string {
  const lines: string[] = [];

  lines.push(`# Claude Session: ${session.metadata.name || session.metadata.id}`);
  lines.push('');
  lines.push(`- **Created:** ${new Date(session.metadata.createdAt).toISOString()}`);
  lines.push(`- **Updated:** ${new Date(session.metadata.updatedAt).toISOString()}`);
  lines.push(`- **Model:** ${session.metadata.model}`);
  lines.push(`- **Messages:** ${session.metadata.messageCount}`);
  lines.push(
    `- **Tokens:** ${session.metadata.tokenUsage.total} (${session.metadata.tokenUsage.input} in / ${session.metadata.tokenUsage.output} out)`
  );
  // ⚠️ 费用信息未包含在导出中
  // ...
}

// JSON 导出
export function exportSessionToJSON(session: SessionData): string {
  return JSON.stringify(session, null, 2);
}

// 会话统计
export function getSessionStatistics(): SessionStatistics {
  return {
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;  // ⭐ 包含总费用
    // ...
  };
}
```

**特点**:
- ✅ 会话导出（Markdown/JSON）
- ⚠️ 导出中包含 token 统计，但费用信息不完整
- ❌ 无专门的费用报表格式
- ❌ 无按时间范围筛选
- ❌ 无 CSV/Excel 导出
- ❌ 无图表可视化

### 官方实现

**状态**: ❓ **无法确认**

在混淆代码中未发现专门的费用报表导出功能。可能的情况：
1. 该功能可能集成在会话导出中
2. 该功能可能在 Anthropic Console 网页端实现
3. 该功能可能尚未开发

### 差异总结

| 功能点 | 本项目 | 官方实现 | 差距 |
|--------|--------|---------|------|
| 会话导出 | ✅ 支持 | ✅ 支持 | 无 |
| 费用信息导出 | ⚠️ 部分 | ❓ 未知 | 无法评估 |
| 费用报表格式 | ❌ 无 | ❓ 未知 | 无法评估 |
| 时间范围筛选 | ❌ 无 | ❓ 未知 | 无法评估 |
| CSV 导出 | ❌ 无 | ❓ 未知 | 无法评估 |
| 图表可视化 | ❌ 无 | ❓ 未知 | 无法评估 |

**实现建议**:
```typescript
// 费用报表导出接口
export interface CostReportOptions {
  /** 起始日期 */
  startDate?: Date;

  /** 结束日期 */
  endDate?: Date;

  /** 按模型分组 */
  groupByModel?: boolean;

  /** 按日期分组 */
  groupByDate?: 'day' | 'week' | 'month';

  /** 导出格式 */
  format?: 'json' | 'csv' | 'markdown' | 'html';

  /** 包含详细信息 */
  includeDetails?: boolean;
}

export interface CostReportEntry {
  date: string;
  model: string;
  sessionId: string;
  sessionName?: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  cost: number;
  duration: number;
}

export function generateCostReport(options: CostReportOptions): string {
  const sessions = listSessions();
  const entries: CostReportEntry[] = [];

  // 筛选和处理会话
  for (const session of sessions) {
    const sessionData = loadSession(session.id);
    if (!sessionData) continue;

    // 时间范围筛选
    if (options.startDate && sessionData.metadata.createdAt < options.startDate.getTime()) continue;
    if (options.endDate && sessionData.metadata.createdAt > options.endDate.getTime()) continue;

    entries.push({
      date: new Date(sessionData.metadata.createdAt).toISOString().split('T')[0],
      model: sessionData.metadata.model,
      sessionId: sessionData.metadata.id,
      sessionName: sessionData.metadata.name,
      inputTokens: sessionData.metadata.tokenUsage.input,
      outputTokens: sessionData.metadata.tokenUsage.output,
      cacheCreationTokens: 0, // TODO: 添加缓存统计
      cacheReadTokens: 0,
      totalTokens: sessionData.metadata.tokenUsage.total,
      cost: sessionData.metadata.cost || 0,
      duration: sessionData.metadata.updatedAt - sessionData.metadata.createdAt,
    });
  }

  // 根据格式生成报表
  switch (options.format) {
    case 'csv':
      return generateCSVReport(entries, options);
    case 'markdown':
      return generateMarkdownReport(entries, options);
    case 'html':
      return generateHTMLReport(entries, options);
    default:
      return JSON.stringify(entries, null, 2);
  }
}

function generateCSVReport(entries: CostReportEntry[], options: CostReportOptions): string {
  const lines: string[] = [];

  // CSV 表头
  lines.push('Date,Model,Session ID,Session Name,Input Tokens,Output Tokens,Cache Creation,Cache Read,Total Tokens,Cost (USD),Duration (s)');

  // 数据行
  for (const entry of entries) {
    lines.push([
      entry.date,
      entry.model,
      entry.sessionId,
      entry.sessionName || '',
      entry.inputTokens,
      entry.outputTokens,
      entry.cacheCreationTokens,
      entry.cacheReadTokens,
      entry.totalTokens,
      entry.cost.toFixed(4),
      (entry.duration / 1000).toFixed(2),
    ].join(','));
  }

  // 汇总行
  if (entries.length > 0) {
    const total = entries.reduce((sum, e) => ({
      inputTokens: sum.inputTokens + e.inputTokens,
      outputTokens: sum.outputTokens + e.outputTokens,
      totalTokens: sum.totalTokens + e.totalTokens,
      cost: sum.cost + e.cost,
    }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 });

    lines.push('');
    lines.push(`TOTAL,,,,,${total.inputTokens},${total.outputTokens},0,0,${total.totalTokens},${total.cost.toFixed(4)},`);
  }

  return lines.join('\n');
}

function generateMarkdownReport(entries: CostReportEntry[], options: CostReportOptions): string {
  const lines: string[] = [];

  lines.push('# Cost Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Period:** ${options.startDate?.toISOString().split('T')[0] || 'All time'} - ${options.endDate?.toISOString().split('T')[0] || 'Present'}`);
  lines.push('');

  // 汇总统计
  const total = entries.reduce((sum, e) => ({
    sessions: sum.sessions + 1,
    tokens: sum.tokens + e.totalTokens,
    cost: sum.cost + e.cost,
  }), { sessions: 0, tokens: 0, cost: 0 });

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Sessions:** ${total.sessions}`);
  lines.push(`- **Total Tokens:** ${total.tokens.toLocaleString()}`);
  lines.push(`- **Total Cost:** $${total.cost.toFixed(4)}`);
  lines.push(`- **Average Cost per Session:** $${(total.cost / total.sessions).toFixed(4)}`);
  lines.push('');

  // 按模型分组（如果需要）
  if (options.groupByModel) {
    const byModel = new Map<string, typeof total>();
    for (const entry of entries) {
      const existing = byModel.get(entry.model) || { sessions: 0, tokens: 0, cost: 0 };
      byModel.set(entry.model, {
        sessions: existing.sessions + 1,
        tokens: existing.tokens + entry.totalTokens,
        cost: existing.cost + entry.cost,
      });
    }

    lines.push('## By Model');
    lines.push('');
    lines.push('| Model | Sessions | Tokens | Cost |');
    lines.push('|-------|----------|--------|------|');
    for (const [model, stats] of byModel) {
      lines.push(`| ${model} | ${stats.sessions} | ${stats.tokens.toLocaleString()} | $${stats.cost.toFixed(4)} |`);
    }
    lines.push('');
  }

  // 详细数据（如果需要）
  if (options.includeDetails) {
    lines.push('## Detailed Breakdown');
    lines.push('');
    lines.push('| Date | Model | Session | Tokens | Cost |');
    lines.push('|------|-------|---------|--------|------|');
    for (const entry of entries) {
      lines.push(`| ${entry.date} | ${entry.model} | ${entry.sessionName || entry.sessionId.slice(0, 8)} | ${entry.totalTokens.toLocaleString()} | $${entry.cost.toFixed(4)} |`);
    }
  }

  return lines.join('\n');
}
```

---

## 总体评估

### 功能完成度矩阵

| 任务 | 功能点 | 本项目 | 官方 | 优先级 |
|------|--------|--------|------|--------|
| T417 | 基础费用计算 | ✅ 80% | ✅ 100% | 高 |
| T417 | 缓存费用计算 | ❌ 0% | ✅ 100% | **紧急** |
| T418 | 预算限制 | ❌ 0% | ❓ 未知 | 中 |
| T419 | 余额告警 | ❌ 0% | ❓ 未知 | 低 |
| T420 | 计费错误处理 | ⚠️ 30% | ❓ 未知 | 中 |
| T421 | 配额管理 | ❌ 0% | ⚠️ 20% | 中 |
| T422 | 限制提升请求 | ❌ 0% | ❌ 0% | 低 |
| T423 | Token 统计 | ✅ 70% | ✅ 100% | 高 |
| T424 | 费用报表导出 | ⚠️ 40% | ❓ 未知 | 中 |

### 关键差距

#### 紧急 (P0)
1. **缓存 token 的费用计算** - 官方已支持，本项目缺失
   - Anthropic Prompt Caching 有独立的定价
   - 缓存创建通常比标准输入贵 25%
   - 缓存读取比标准输入便宜 90%

#### 重要 (P1)
2. **累计使用与当前使用分离** - 影响费用透明度
3. **未知模型警告** - 防止费用估算错误

#### 建议 (P2)
4. **预算限制功能** - 用户成本控制
5. **配额跟踪** - 避免触发 API 限制
6. **增强的费用报表** - 更好的费用分析

### 实现优先级建议

**第一阶段** (核心功能对齐):
1. 添加缓存 token 统计和费用计算
2. 实现累计/当前使用分离
3. 添加未知模型检测和警告

**第二阶段** (增强功能):
4. 实现预算限制和警告
5. 添加速率限制跟踪
6. 改进计费错误处理

**第三阶段** (高级功能):
7. 实现完整的费用报表导出
8. 添加时间维度统计
9. 可视化费用分析

---

## 附录：Anthropic Prompt Caching 定价参考

### 定价结构 (截至 2025 年)

| 模型 | 标准输入 | 缓存创建 | 缓存读取 | 输出 |
|------|----------|----------|----------|------|
| Claude Opus 4 | $15/1M | $18.75/1M | $1.50/1M | $75/1M |
| Claude Sonnet 4 | $3/1M | $3.75/1M | $0.30/1M | $15/1M |
| Claude Haiku 3.5 | $0.80/1M | $1.00/1M | $0.08/1M | $4/1M |

### 缓存费用计算示例

```typescript
// 示例：100k 输入 tokens，其中 50k 来自缓存，20k 输出 tokens
const usage = {
  input: 50_000,           // 标准输入
  cacheRead: 50_000,       // 缓存读取
  output: 20_000,
};

// Sonnet 4 费用计算
const cost =
  (50_000 / 1_000_000) * 3 +      // $0.15 标准输入
  (50_000 / 1_000_000) * 0.3 +    // $0.015 缓存读取
  (20_000 / 1_000_000) * 15;      // $0.30 输出

// 总计: $0.465

// 如果不使用缓存（所有 100k 为标准输入）
const costWithoutCache =
  (100_000 / 1_000_000) * 3 +     // $0.30 标准输入
  (20_000 / 1_000_000) * 15;      // $0.30 输出

// 总计: $0.60
// 节省: $0.135 (22.5%)
```

---

**文档版本**: 1.0
**最后更新**: 2025-12-25
**分析者**: Claude Code Agent
