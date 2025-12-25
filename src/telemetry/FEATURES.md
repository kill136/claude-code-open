# 遥测系统增强功能总览

## 概述

遥测系统已完全增强，从原来的基础统计系统升级为功能完整、隐私安全的企业级遥测平台。

## 新增功能

### 1. 匿名使用统计 ✅

**实现细节:**
- 基于机器信息（hostname、platform、arch、homedir）生成 SHA-256 哈希
- 生成格式: `anon_<32位哈希>`
- 持久化存储在 `~/.claude/telemetry/anonymous_id`
- 如果无法创建持久 ID，使用临时随机 ID

**API:**
```typescript
getAnonymousUserId(): string
```

### 2. 错误报告 (Opt-in) ✅

**实现细节:**
- 默认禁用，需要显式启用
- 收集错误类型、消息、堆栈跟踪和上下文
- 自动清洗敏感信息
- 存储在 `~/.claude/telemetry/errors.jsonl`

**API:**
```typescript
enableErrorReporting(): void
disableErrorReporting(): void
trackErrorReport(error: Error, context?: Record<string, unknown>): void
getErrorStats(): { byType, total, recent } | null
```

**数据结构:**
```typescript
interface ErrorReport {
  errorType: string;
  errorMessage: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  anonymousId: string;
}
```

### 3. 性能指标收集 ✅

**实现细节:**
- 追踪操作名称、执行时长、成功状态
- 支持可选元数据
- 存储在 `~/.claude/telemetry/performance.jsonl`
- 提供统计分析（按操作、平均时长、成功率）

**API:**
```typescript
enablePerformanceTracking(): void
disablePerformanceTracking(): void
trackPerformance(operation: string, duration: number, success: boolean, metadata?: Record<string, unknown>): void
getPerformanceStats(): { byOperation, overall } | null
```

**数据结构:**
```typescript
interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}
```

### 4. 功能使用追踪 ✅

**增强内容:**
- **工具使用**: 已有，增强了性能追踪集成
- **命令使用**: 新增命令使用追踪
- **模型选择**: 已有，增强了统计
- **会话时长**: 已有，增强了计算精度

**新增 API:**
```typescript
trackCommand(commandName: string, success: boolean, duration: number): void
```

**聚合指标增强:**
```typescript
interface AggregateMetrics {
  // ... 原有字段
  commandUsage: Record<string, number>;  // 新增
  totalErrors: number;                    // 新增
  errorTypes: Record<string, number>;     // 新增
}
```

### 5. 隐私保护 ✅

**实现机制:**
- 自动清洗敏感数据的正则模式匹配
- 敏感字段名称检测（password, secret, token, key, auth）
- 递归清洗嵌套对象和数组

**清洗模式:**
```typescript
const SENSITIVE_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // Email
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                           // IP address
  /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,         // IPv6
  /\bsk-[a-zA-Z0-9]{32,}\b/g,                              // API keys
  /\b[A-Za-z0-9_-]{20,}\b/g,                               // Generic tokens
  /\/home\/[a-zA-Z0-9_-]+/g,                               // Home paths
  /\/Users\/[a-zA-Z0-9_-]+/g,                              // Mac paths
  /C:\\Users\\[a-zA-Z0-9_-]+/g,                            // Windows paths
];
```

**API:**
```typescript
sanitizeData(data: unknown): unknown  // 内部函数
```

### 6. 本地存储 (离线模式) ✅

**已实现:**
- 所有数据本地存储在 `~/.claude/telemetry/`
- JSONL 格式（每行一个 JSON 对象）
- 自动文件大小管理（默认最多 10,000 条记录）
- 支持完全离线工作

**存储文件:**
```
~/.claude/telemetry/
├── anonymous_id         # 匿名用户 ID
├── config.json         # 遥测配置
├── metrics.json        # 聚合指标（JSON）
├── events.jsonl        # 事件日志（JSONL）
├── errors.jsonl        # 错误报告（JSONL）- 新增
├── performance.jsonl   # 性能指标（JSONL）- 新增
└── queue.jsonl         # 上报队列（JSONL）- 新增
```

### 7. 批量上报 ✅

**实现细节:**
- 事件队列（最大 1000 个事件）
- 可配置上报间隔（默认 1 小时）
- 可配置批次大小（默认 100 个事件）
- 自动重试机制（失败时放回队列）
- 队列持久化（进程重启后恢复）
- 定时器自动上报
- 支持手动触发上报

**API:**
```typescript
configureBatchUpload(enabled: boolean, endpoint?: string, interval?: number, batchSize?: number): void
flushTelemetry(): Promise<void>
```

**配置结构:**
```typescript
interface TelemetryConfig {
  enabled: boolean;
  errorReporting: boolean;
  performanceTracking: boolean;
  batchUpload: boolean;              // 新增
  uploadInterval: number;            // 新增
  maxBatchSize: number;              // 新增
  endpoint?: string;                 // 新增
}
```

### 8. 禁用选项 ✅

**环境变量支持:**
```bash
# 方式 1
export CLAUDE_CODE_DISABLE_TELEMETRY=1

# 方式 2
export CLAUDE_CODE_DISABLE_TELEMETRY=true

# 方式 3（通用）
export DISABLE_TELEMETRY=1

# 方式 4（通用）
export DISABLE_TELEMETRY=true
```

**实现细节:**
```typescript
const TELEMETRY_DISABLED =
  process.env.CLAUDE_CODE_DISABLE_TELEMETRY === '1' ||
  process.env.CLAUDE_CODE_DISABLE_TELEMETRY === 'true' ||
  process.env.DISABLE_TELEMETRY === '1' ||
  process.env.DISABLE_TELEMETRY === 'true';
```

**API:**
```typescript
enableTelemetry(): void   // 检查环境变量
disableTelemetry(): void  // 运行时禁用
isTelemetryEnabled(): boolean
```

## 增强的事件结构

### 原有事件
```typescript
interface TelemetryEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  data: Record<string, unknown>;
}
```

### 增强后的事件
```typescript
interface TelemetryEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  anonymousId: string;                    // 新增
  data: Record<string, unknown>;
  version?: string;                       // 新增
  platform?: string;                      // 新增
}
```

## 新增事件类型

- `command_use` - 命令使用（新增）
- 性能指标自动附加到工具调用和命令使用

## 配置管理

### 配置文件示例
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

### 配置 API
```typescript
getTelemetryConfig(): Readonly<TelemetryConfig>
loadConfig(): void          // 内部函数
saveConfig(): void          // 内部函数
```

## 生命周期管理

### 初始化增强
```typescript
initTelemetry(enabled?: boolean): void
```

**新增功能:**
1. 加载持久化配置
2. 检查环境变量
3. 生成/加载匿名 ID
4. 恢复上报队列
5. 启动批量上报定时器

### 清理机制
```typescript
cleanup(): void
```

**功能:**
1. 结束当前会话
2. 停止上报定时器
3. 保存队列到磁盘

**自动触发:**
```typescript
process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

## 统计查询增强

### 原有查询
```typescript
getMetrics(): AggregateMetrics | null
getCurrentSessionMetrics(): SessionMetrics | null
```

### 新增查询
```typescript
getPerformanceStats(): { byOperation, overall } | null
getErrorStats(): { byType, total, recent } | null
getAnonymousUserId(): string
getTelemetryConfig(): Readonly<TelemetryConfig>
```

## 文件大小管理

### 通用文件修剪
```typescript
trimFile(filePath: string, maxLines: number): void
```

**应用于:**
- `events.jsonl` (10,000 行)
- `errors.jsonl` (10,000 行)
- `performance.jsonl` (10,000 行)

### 队列大小限制
- 内存队列: 最大 1,000 个事件
- 磁盘队列: 自动持久化

## 常量配置

```typescript
const MAX_EVENTS = 10000;              // 文件最大行数
const MAX_QUEUE_SIZE = 1000;           // 队列最大大小
const DEFAULT_UPLOAD_INTERVAL = 3600000; // 1 小时
const DEFAULT_BATCH_SIZE = 100;        // 批次大小
```

## 完整 API 列表

### 生命周期
- `initTelemetry(enabled?: boolean): void`
- `startSession(sessionId: string, model: string): void`
- `endSession(): void`
- `cleanup(): void`

### 事件追踪
- `trackEvent(type: string, data?: Record<string, unknown>): void`
- `trackMessage(role: 'user' | 'assistant'): void`
- `trackToolCall(toolName: string, success: boolean, duration: number): void`
- `trackCommand(commandName: string, success: boolean, duration: number): void` - **新增**
- `trackTokenUsage(input: number, output: number, cost: number): void`
- `trackError(error: string, context?: Record<string, unknown>): void`
- `trackErrorReport(error: Error, context?: Record<string, unknown>): void` - **新增**
- `trackPerformance(operation: string, duration: number, success: boolean, metadata?: Record<string, unknown>): void` - **新增**

### 配置管理
- `enableTelemetry(): void`
- `disableTelemetry(): void`
- `enableErrorReporting(): void` - **新增**
- `disableErrorReporting(): void` - **新增**
- `enablePerformanceTracking(): void` - **新增**
- `disablePerformanceTracking(): void` - **新增**
- `configureBatchUpload(enabled: boolean, endpoint?: string, interval?: number, batchSize?: number): void` - **新增**
- `getTelemetryConfig(): Readonly<TelemetryConfig>` - **新增**
- `isTelemetryEnabled(): boolean`

### 数据查询
- `getMetrics(): AggregateMetrics | null`
- `getCurrentSessionMetrics(): SessionMetrics | null`
- `getPerformanceStats(): {...} | null` - **新增**
- `getErrorStats(): {...} | null` - **新增**
- `getAnonymousUserId(): string` - **新增**

### 数据管理
- `clearTelemetryData(): void`
- `flushTelemetry(): Promise<void>` - **新增**

## 代码统计

- **总行数**: 965 行
- **新增接口**: 5 个（`PerformanceMetric`, `ErrorReport`, `TelemetryConfig` 等）
- **新增 API**: 15+ 个
- **新增文件**: 3 个（`errors.jsonl`, `performance.jsonl`, `queue.jsonl`）

## 与官方 CLI 的兼容性

所有功能均基于官方 Claude Code CLI 的遥测系统设计：

✅ 匿名使用统计
✅ 错误报告 (opt-in)
✅ 性能指标收集
✅ 功能使用追踪
✅ 隐私保护
✅ 本地存储
✅ 批量上报
✅ 禁用选项
✅ 环境变量支持
✅ 配置持久化

## 使用建议

1. **开发环境**: 禁用批量上报，仅本地收集
2. **生产环境**: 启用批量上报，定期分析数据
3. **隐私敏感**: 仅启用基础统计，禁用错误报告
4. **性能调优**: 启用性能追踪，分析瓶颈
5. **用户反馈**: 提供清晰的禁用选项和数据透明度

## 测试建议

查看 `src/telemetry/example.ts` 了解 8 个完整的使用示例：

1. 基础会话跟踪
2. 工具调用跟踪
3. 命令使用跟踪
4. 错误跟踪
5. 性能追踪
6. 批量上报配置
7. 查看统计数据
8. 完整工作流

## 未来扩展

可能的增强方向：

- [ ] 实际的 HTTP 上报实现（目前仅框架）
- [ ] 数据可视化仪表板
- [ ] 更详细的性能分析（P50/P95/P99）
- [ ] 异常检测和告警
- [ ] A/B 测试支持
- [ ] 用户行为分析
- [ ] 导出功能（CSV/JSON）
- [ ] 数据压缩和归档
