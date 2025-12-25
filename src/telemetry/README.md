# 遥测系统 (Telemetry System)

完整的遥测和分析系统，支持匿名使用统计、错误报告、性能追踪和批量上报。

## 功能特性

### 1. 匿名使用统计
- 自动生成匿名用户 ID（基于机器信息哈希）
- 不收集任何个人身份信息
- 本地存储在 `~/.claude/telemetry/anonymous_id`

### 2. 错误报告 (Opt-in)
- 详细的错误堆栈跟踪
- 上下文信息收集
- 错误类型统计
- 默认禁用，需要显式启用

### 3. 性能指标收集
- 工具调用性能追踪
- 命令执行时间统计
- 成功率分析
- 平均响应时间计算

### 4. 功能使用追踪
- 工具使用频率
- 命令使用频率
- 模型选择统计
- 会话时长分析

### 5. 隐私保护
- 自动清洗敏感数据（邮箱、IP、密钥等）
- 敏感字段自动屏蔽
- 路径信息匿名化
- 不收集用户代码内容

### 6. 本地存储 (离线模式)
- 所有数据本地存储在 `~/.claude/telemetry/`
- 支持离线工作
- 自动限制文件大小

### 7. 批量上报
- 可选的批量上报到服务器
- 离线队列支持
- 自动重试机制
- 可配置上报间隔和批次大小

### 8. 禁用选项
```bash
# 通过环境变量禁用
export CLAUDE_CODE_DISABLE_TELEMETRY=1
# 或
export DISABLE_TELEMETRY=true
```

## 数据存储

所有遥测数据存储在 `~/.claude/telemetry/` 目录：

```
~/.claude/telemetry/
├── anonymous_id         # 匿名用户 ID
├── config.json         # 遥测配置
├── metrics.json        # 聚合指标
├── events.jsonl        # 事件日志（JSONL 格式）
├── errors.jsonl        # 错误报告（JSONL 格式）
├── performance.jsonl   # 性能指标（JSONL 格式）
└── queue.jsonl         # 上报队列（JSONL 格式）
```

## 使用示例

### 基础使用

```typescript
import {
  initTelemetry,
  startSession,
  endSession,
  trackEvent,
  trackToolCall,
  trackCommand,
  trackTokenUsage,
  trackError,
} from './telemetry';

// 1. 初始化遥测系统
initTelemetry();

// 2. 开始会话
startSession('session-123', 'claude-sonnet-4');

// 3. 跟踪工具调用
const startTime = Date.now();
try {
  // 执行工具...
  trackToolCall('Bash', true, Date.now() - startTime);
} catch (error) {
  trackToolCall('Bash', false, Date.now() - startTime);
  trackError('BashError', { message: error.message });
}

// 4. 跟踪命令使用
trackCommand('/test', true, 1234);

// 5. 跟踪 Token 使用
trackTokenUsage(1000, 500, 0.015);

// 6. 跟踪自定义事件
trackEvent('feature_used', { feature: 'code_completion' });

// 7. 结束会话
endSession();
```

### 错误报告 (Opt-in)

```typescript
import {
  enableErrorReporting,
  trackErrorReport,
} from './telemetry';

// 启用错误报告
enableErrorReporting();

// 跟踪详细错误
try {
  // 可能抛出错误的代码
} catch (error) {
  if (error instanceof Error) {
    trackErrorReport(error, {
      operation: 'file_read',
      filePath: '/path/to/file',
      // 敏感信息会被自动清洗
    });
  }
}
```

### 性能追踪

```typescript
import { trackPerformance } from './telemetry';

const startTime = Date.now();
try {
  // 执行操作
  const result = await someOperation();

  // 记录成功的性能
  trackPerformance('someOperation', Date.now() - startTime, true, {
    itemCount: result.length,
  });
} catch (error) {
  // 记录失败的性能
  trackPerformance('someOperation', Date.now() - startTime, false);
}
```

### 配置管理

```typescript
import {
  enableTelemetry,
  disableTelemetry,
  enableErrorReporting,
  disableErrorReporting,
  enablePerformanceTracking,
  disablePerformanceTracking,
  configureBatchUpload,
  getTelemetryConfig,
} from './telemetry';

// 启用/禁用遥测
enableTelemetry();
disableTelemetry();

// 启用/禁用错误报告
enableErrorReporting();
disableErrorReporting();

// 启用/禁用性能追踪
enablePerformanceTracking();
disablePerformanceTracking();

// 配置批量上报
configureBatchUpload(
  true,                              // 启用批量上报
  'https://telemetry.example.com',   // 端点 URL
  3600000,                           // 上报间隔（1小时）
  100                                // 批次大小
);

// 获取当前配置
const config = getTelemetryConfig();
console.log(config);
```

### 查看统计数据

```typescript
import {
  getMetrics,
  getCurrentSessionMetrics,
  getPerformanceStats,
  getErrorStats,
  getAnonymousUserId,
} from './telemetry';

// 获取聚合指标
const metrics = getMetrics();
if (metrics) {
  console.log('总会话数:', metrics.totalSessions);
  console.log('总消息数:', metrics.totalMessages);
  console.log('总 Token 数:', metrics.totalTokens);
  console.log('总成本:', metrics.totalCost);
  console.log('工具使用:', metrics.toolUsage);
  console.log('命令使用:', metrics.commandUsage);
  console.log('模型使用:', metrics.modelUsage);
  console.log('平均会话时长:', metrics.averageSessionDuration);
}

// 获取当前会话指标
const session = getCurrentSessionMetrics();
if (session) {
  console.log('会话 ID:', session.sessionId);
  console.log('消息数:', session.messageCount);
  console.log('Token 使用:', session.tokenUsage);
  console.log('工具调用:', session.toolCalls);
}

// 获取性能统计
const perfStats = getPerformanceStats();
if (perfStats) {
  console.log('总操作数:', perfStats.overall.totalOperations);
  console.log('平均时长:', perfStats.overall.avgDuration);
  console.log('成功率:', perfStats.overall.successRate);

  // 按操作类型查看
  for (const [op, stats] of Object.entries(perfStats.byOperation)) {
    console.log(`${op}:`, stats);
  }
}

// 获取错误统计
const errorStats = getErrorStats();
if (errorStats) {
  console.log('总错误数:', errorStats.total);
  console.log('按类型:', errorStats.byType);
  console.log('最近错误:', errorStats.recent);
}

// 获取匿名 ID
console.log('匿名 ID:', getAnonymousUserId());
```

### 数据清理

```typescript
import { clearTelemetryData, flushTelemetry } from './telemetry';

// 手动触发批量上报
await flushTelemetry();

// 清除所有遥测数据
clearTelemetryData();
```

## 隐私保护机制

遥测系统会自动清洗以下敏感信息：

1. **邮箱地址**: `user@example.com` → `[REDACTED]`
2. **IP 地址**: `192.168.1.1` → `[REDACTED]`
3. **API 密钥**: `sk-ant-123456...` → `[REDACTED]`
4. **用户路径**: `/home/username/` → `[REDACTED]`
5. **敏感字段**: 包含 `password`, `secret`, `token`, `key`, `auth` 的字段自动屏蔽

## 收集的指标类型

### 会话指标
- 会话 ID
- 开始/结束时间
- 消息数量
- 工具调用统计
- Token 使用量
- 预估成本
- 使用的模型
- 错误次数

### 事件类型
- `session_start` - 会话开始
- `session_end` - 会话结束
- `message` - 消息发送
- `tool_call` - 工具调用
- `command_use` - 命令使用
- `token_usage` - Token 使用
- `error` - 错误发生

### 性能指标
- 操作名称
- 执行时长
- 成功/失败状态
- 元数据（可选）

### 错误报告
- 错误类型
- 错误消息
- 堆栈跟踪
- 上下文信息
- 时间戳

## 环境变量

```bash
# 禁用遥测
CLAUDE_CODE_DISABLE_TELEMETRY=1

# 或使用通用变量
DISABLE_TELEMETRY=true
```

## 配置文件示例

`~/.claude/telemetry/config.json`:

```json
{
  "enabled": true,
  "errorReporting": false,
  "performanceTracking": true,
  "batchUpload": false,
  "uploadInterval": 3600000,
  "maxBatchSize": 100,
  "endpoint": null
}
```

## 注意事项

1. **隐私优先**: 所有数据在记录前都会经过隐私清洗
2. **本地存储**: 默认情况下，所有数据仅存储在本地
3. **可选上报**: 批量上报功能默认禁用，需要显式配置
4. **错误报告**: 详细的错误报告需要用户明确同意
5. **随时禁用**: 可以通过环境变量或 API 随时禁用遥测
6. **自动清理**: 文件大小受到限制，自动清理旧数据
7. **进程退出**: 进程退出时自动保存队列和结束会话

## API 参考

### 初始化和生命周期
- `initTelemetry(enabled?: boolean): void`
- `startSession(sessionId: string, model: string): void`
- `endSession(): void`
- `cleanup(): void`

### 事件追踪
- `trackEvent(type: string, data?: Record<string, unknown>): void`
- `trackMessage(role: 'user' | 'assistant'): void`
- `trackToolCall(toolName: string, success: boolean, duration: number): void`
- `trackCommand(commandName: string, success: boolean, duration: number): void`
- `trackTokenUsage(input: number, output: number, cost: number): void`
- `trackError(error: string, context?: Record<string, unknown>): void`
- `trackErrorReport(error: Error, context?: Record<string, unknown>): void`
- `trackPerformance(operation: string, duration: number, success: boolean, metadata?: Record<string, unknown>): void`

### 配置管理
- `enableTelemetry(): void`
- `disableTelemetry(): void`
- `enableErrorReporting(): void`
- `disableErrorReporting(): void`
- `enablePerformanceTracking(): void`
- `disablePerformanceTracking(): void`
- `configureBatchUpload(enabled: boolean, endpoint?: string, interval?: number, batchSize?: number): void`
- `getTelemetryConfig(): Readonly<TelemetryConfig>`
- `isTelemetryEnabled(): boolean`

### 数据查询
- `getMetrics(): AggregateMetrics | null`
- `getCurrentSessionMetrics(): SessionMetrics | null`
- `getPerformanceStats(): {...} | null`
- `getErrorStats(): {...} | null`
- `getAnonymousUserId(): string`

### 数据管理
- `clearTelemetryData(): void`
- `flushTelemetry(): Promise<void>`

## 最佳实践

1. **及早初始化**: 在应用启动时立即调用 `initTelemetry()`
2. **会话管理**: 确保每个会话都有对应的 `startSession()` 和 `endSession()`
3. **性能追踪**: 为关键操作添加性能追踪，帮助识别瓶颈
4. **错误上下文**: 在跟踪错误时提供足够的上下文信息
5. **定期清理**: 考虑定期调用 `clearTelemetryData()` 清理旧数据
6. **尊重用户**: 明确告知用户遥测功能，提供禁用选项
7. **敏感数据**: 在传递给遥测系统前，确保不包含明显的敏感信息
8. **批量上报**: 仅在用户同意的情况下启用批量上报功能
