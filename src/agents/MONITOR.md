# Agent Monitor - 代理执行监控系统

完整的代理执行监控、性能分析和告警系统。

## 📋 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [核心组件](#核心组件)
- [使用示例](#使用示例)
- [API 文档](#api-文档)
- [事件系统](#事件系统)
- [最佳实践](#最佳实践)

## 功能特性

### 1. 执行跟踪
- ✅ 开始/结束时间记录
- ✅ 执行状态管理（running, completed, failed, cancelled, timeout）
- ✅ 详细的步骤记录
- ✅ 自动持久化到磁盘

### 2. 资源监控
- ✅ Token 使用量统计（输入/输出/总计）
- ✅ API 调用次数跟踪
- ✅ 成本自动计算
- ✅ 工具调用详细记录

### 3. 性能分析
- ✅ 响应时间测量
- ✅ 工具执行时间分析
- ✅ 瓶颈自动识别
- ✅ 性能评分（0-100）
- ✅ 优化建议生成

### 4. 告警系统
- ✅ 超时告警
- ✅ 成本阈值告警
- ✅ 错误率告警
- ✅ 高延迟告警
- ✅ 可配置的阈值

### 5. 数据导出
- ✅ JSON 格式导出
- ✅ CSV 格式导出
- ✅ 仪表板数据生成
- ✅ 性能报告生成

## 快速开始

### 基础使用

```typescript
import { AgentMonitor } from './agents/monitor.js';

// 创建监控器
const monitor = new AgentMonitor({
  collectMetrics: true,
  persistMetrics: true,
  alertOnTimeout: true,
  timeoutThreshold: 60000, // 60秒
});

// 开始跟踪
const agentId = 'my-agent-123';
monitor.startTracking(agentId, 'general-purpose', 'Research task');

// 记录执行过程
monitor.recordApiCall(agentId, true, 1200);
monitor.recordTokens(agentId, 500, 300);
monitor.recordCost(agentId, 0.015);

// 记录工具调用
const toolCallId = monitor.startToolCall(agentId, 'Read');
// ... 执行工具 ...
monitor.endToolCall(agentId, toolCallId, true);

// 停止跟踪
monitor.stopTracking(agentId, 'completed');

// 获取指标
const metrics = monitor.getMetrics(agentId);
console.log(metrics);
```

### 完整监控系统

```typescript
import { createMonitoringSystem } from './agents/monitor.js';

// 创建完整的监控系统
const { monitor, alertManager, analyzer } = createMonitoringSystem({
  alertOnCostThreshold: true,
  costThreshold: 1.0, // $1
  alertOnErrorRate: true,
  errorRateThreshold: 0.3, // 30%
});

// 监听告警
monitor.on('alert:triggered', (alert) => {
  console.log(`⚠ [${alert.severity}] ${alert.message}`);
});

// ... 执行代理 ...

// 生成性能报告
const metrics = monitor.getAllMetrics();
const reports = analyzer.analyze(metrics);
reports.forEach(report => {
  console.log(`Score: ${report.overallScore}/100`);
  console.log(`Bottlenecks: ${report.bottlenecks.length}`);
  console.log(`Suggestions: ${report.suggestions.length}`);
});
```

## 核心组件

### 1. AgentMonitor

主监控类，负责收集和管理代理执行指标。

**主要方法：**

```typescript
class AgentMonitor {
  // 跟踪管理
  startTracking(agentId: string, type: string, description?: string): void;
  stopTracking(agentId: string, status: 'completed' | 'failed' | 'cancelled'): void;
  cancelTracking(agentId: string): void;

  // 指标记录
  recordApiCall(agentId: string, success: boolean, latency?: number): void;
  recordTokens(agentId: string, input: number, output: number): void;
  recordCost(agentId: string, cost: number): void;
  recordError(agentId: string, error: Error, phase?: string): void;

  // 工具调用
  startToolCall(agentId: string, toolName: string, inputSize?: number): string;
  endToolCall(agentId: string, toolCallId: string, success: boolean, error?: string, outputSize?: number): void;
  recordToolCall(agentId: string, tool: string, duration: number, success?: boolean): void;

  // 查询
  getMetrics(agentId: string): AgentMetrics | null;
  getAllMetrics(): AgentMetrics[];
  getAggregatedStats(): AggregatedStats;

  // 清理
  clearMetrics(agentId: string): boolean;
  clearAllMetrics(): void;
}
```

### 2. AlertManager

告警管理器，自动检测异常情况并发出告警。

**主要方法：**

```typescript
class AlertManager {
  // 检查告警
  checkTimeout(metrics: AgentMetrics): Alert | null;
  checkCost(metrics: AgentMetrics, threshold?: number): Alert | null;
  checkErrors(metrics: AgentMetrics, threshold?: number): Alert | null;

  // 管理告警
  getActiveAlerts(): Alert[];
  getAllAlerts(): Alert[];
  acknowledge(alertId: string): boolean;
  acknowledgeAll(): void;
  clearAcknowledged(): number;
}
```

### 3. PerformanceAnalyzer

性能分析器，评估代理性能并提供优化建议。

**主要方法：**

```typescript
class PerformanceAnalyzer {
  // 分析
  analyze(metrics: AgentMetrics[]): PerformanceReport[];
  analyzeAgent(metrics: AgentMetrics): PerformanceReport;

  // 识别问题
  identifyBottlenecks(metrics: AgentMetrics): Bottleneck[];
  suggestOptimizations(metrics: AgentMetrics): Suggestion[];
}
```

## 使用示例

### 示例 1: 集成到代理工具

```typescript
import { AgentMonitor } from './agents/monitor.js';

class MyAgentTool {
  private monitor: AgentMonitor;

  constructor() {
    this.monitor = new AgentMonitor();
  }

  async execute(input: AgentInput): Promise<ToolResult> {
    const agentId = generateAgentId();

    try {
      // 开始监控
      this.monitor.startTracking(agentId, input.subagent_type, input.description);

      // 执行代理逻辑
      const result = await this.runAgent(agentId, input);

      // 成功完成
      this.monitor.stopTracking(agentId, 'completed');

      return result;
    } catch (error) {
      // 记录错误
      this.monitor.recordError(agentId, error as Error);
      this.monitor.stopTracking(agentId, 'failed');

      throw error;
    }
  }

  private async runAgent(agentId: string, input: AgentInput): Promise<ToolResult> {
    // 记录 API 调用
    const startTime = Date.now();
    const response = await this.callClaudeAPI(input.prompt);
    const latency = Date.now() - startTime;

    this.monitor.recordApiCall(agentId, true, latency);
    this.monitor.recordTokens(
      agentId,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // 计算成本并记录
    const cost = this.calculateCost(response.usage);
    this.monitor.recordCost(agentId, cost);

    // 执行工具
    const toolCallId = this.monitor.startToolCall(agentId, 'Grep');
    try {
      const toolResult = await this.executeTool('Grep', {});
      this.monitor.endToolCall(agentId, toolCallId, true);
    } catch (error) {
      this.monitor.endToolCall(agentId, toolCallId, false, (error as Error).message);
    }

    return { success: true, output: 'Done' };
  }
}
```

### 示例 2: 实时监控仪表板

```typescript
import { generateDashboardData, AgentMonitor } from './agents/monitor.js';

class MonitoringDashboard {
  private monitor: AgentMonitor;
  private updateInterval: NodeJS.Timeout;

  constructor() {
    this.monitor = new AgentMonitor();
    this.startLiveUpdates();
  }

  private startLiveUpdates() {
    this.updateInterval = setInterval(() => {
      const dashboard = generateDashboardData(this.monitor.getAllMetrics());

      console.clear();
      console.log('=== Agent Monitoring Dashboard ===');
      console.log(`Active Agents: ${dashboard.summary.activeAgents}`);
      console.log(`Total Cost Today: $${dashboard.summary.totalCostToday.toFixed(4)}`);
      console.log(`Success Rate: ${(dashboard.summary.successRate * 100).toFixed(1)}%`);
      console.log(`Avg Response Time: ${dashboard.summary.avgResponseTime.toFixed(0)}ms`);

      if (dashboard.alerts.length > 0) {
        console.log(`\n⚠ Active Alerts: ${dashboard.alerts.length}`);
        dashboard.alerts.forEach(alert => {
          console.log(`  - [${alert.severity}] ${alert.message}`);
        });
      }

      console.log('\nMost Active Tools:');
      dashboard.topMetrics.mostActiveTools.slice(0, 5).forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.tool}: ${tool.count} calls`);
      });
    }, 5000); // 每 5 秒更新
  }

  stop() {
    clearInterval(this.updateInterval);
  }
}
```

### 示例 3: 自定义告警处理

```typescript
import { AgentMonitor, AlertManager } from './agents/monitor.js';

const monitor = new AgentMonitor();
const alertManager = new AlertManager(monitor);

// 自定义告警处理
monitor.on('alert:triggered', (alert) => {
  switch (alert.severity) {
    case 'critical':
      // 发送紧急通知
      sendSlackAlert(`🚨 CRITICAL: ${alert.message}`);
      // 自动暂停所有代理
      pauseAllAgents();
      break;

    case 'high':
      // 发送邮件通知
      sendEmailAlert(alert);
      break;

    case 'medium':
      // 记录到日志
      logger.warn(`Alert: ${alert.message}`);
      break;

    case 'low':
      // 仅记录
      logger.info(`Alert: ${alert.message}`);
      break;
  }
});

// 定期检查并清理已确认的告警
setInterval(() => {
  const cleared = alertManager.clearAcknowledged();
  if (cleared > 0) {
    console.log(`Cleared ${cleared} acknowledged alerts`);
  }
}, 60000); // 每分钟
```

### 示例 4: 性能优化工作流

```typescript
import { AgentMonitor, PerformanceAnalyzer } from './agents/monitor.js';

async function optimizeAgentPerformance() {
  const monitor = new AgentMonitor();
  const analyzer = new PerformanceAnalyzer();

  // 运行基准测试
  await runBenchmarkAgents(monitor);

  // 分析性能
  const metrics = monitor.getAllMetrics();
  const reports = analyzer.analyze(metrics);

  // 生成优化报告
  console.log('=== Performance Optimization Report ===\n');

  reports.forEach(report => {
    console.log(`Agent: ${report.agentId}`);
    console.log(`Overall Score: ${report.overallScore.toFixed(1)}/100\n`);

    if (report.bottlenecks.length > 0) {
      console.log('Bottlenecks Identified:');
      report.bottlenecks.forEach((b, i) => {
        console.log(`  ${i + 1}. [${b.impact}] ${b.description}`);
        if (b.suggestedFix) {
          console.log(`     → Fix: ${b.suggestedFix}`);
        }
      });
      console.log();
    }

    if (report.suggestions.length > 0) {
      console.log('Optimization Suggestions:');
      report.suggestions
        .filter(s => s.priority === 'high')
        .forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.title}`);
          console.log(`     ${s.description}`);
          if (s.estimatedImpact) {
            console.log(`     Impact: ${s.estimatedImpact}`);
          }
        });
      console.log();
    }
  });
}
```

## API 文档

### 配置选项

```typescript
interface MonitorConfig {
  // 基础设置
  collectMetrics: boolean;        // 是否收集指标（默认: true）
  persistMetrics: boolean;        // 是否持久化到磁盘（默认: true）
  metricsDir?: string;           // 指标存储目录（默认: ~/.claude/agent-metrics）

  // 告警配置
  alertOnTimeout: boolean;        // 超时告警（默认: true）
  timeoutThreshold: number;       // 超时阈值（毫秒，默认: 300000）

  alertOnCostThreshold: boolean;  // 成本告警（默认: true）
  costThreshold: number;          // 成本阈值（USD，默认: 1.0）

  alertOnErrorRate: boolean;      // 错误率告警（默认: true）
  errorRateThreshold: number;     // 错误率阈值（0-1，默认: 0.3）

  alertOnHighLatency: boolean;    // 延迟告警（默认: true）
  latencyThreshold: number;       // 延迟阈值（毫秒，默认: 5000）

  // 分析配置
  enablePerformanceAnalysis: boolean;  // 性能分析（默认: true）
  enableBottleneckDetection: boolean;  // 瓶颈检测（默认: true）
}
```

### 数据类型

```typescript
// 代理指标
interface AgentMetrics {
  agentId: string;
  type: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

  tokensUsed: { input: number; output: number; total: number };
  apiCalls: number;
  apiCallsSuccess: number;
  apiCallsFailed: number;
  toolCalls: ToolCallMetric[];
  toolCallCount: number;
  cost: number;
  errors: Array<{ timestamp: Date; message: string; stack?: string; phase?: string }>;

  performance: {
    avgApiLatency?: number;
    avgToolLatency?: number;
    totalWaitTime?: number;
    throughput?: number;
  };

  metadata?: Record<string, any>;
}

// 工具调用指标
interface ToolCallMetric {
  toolName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  inputSize?: number;
  outputSize?: number;
}

// 性能报告
interface PerformanceReport {
  agentId: string;
  overallScore: number; // 0-100
  metrics: {
    executionTime: { value: number; score: number; rating: string };
    apiLatency: { value: number; score: number; rating: string };
    toolLatency: { value: number; score: number; rating: string };
    errorRate: { value: number; score: number; rating: string };
    costEfficiency: { value: number; score: number; rating: string };
  };
  bottlenecks: Bottleneck[];
  suggestions: Suggestion[];
  timestamp: Date;
}
```

## 事件系统

AgentMonitor 继承自 EventEmitter，支持以下事件：

| 事件名 | 参数 | 描述 |
|--------|------|------|
| `agent:start` | `{ agentId, type, timestamp }` | 代理开始执行 |
| `agent:complete` | `{ agentId, status, duration }` | 代理完成执行 |
| `agent:error` | `{ agentId, error, phase }` | 代理执行错误 |
| `agent:timeout` | `{ agentId, elapsed }` | 代理执行超时 |
| `alert:triggered` | `Alert` | 告警触发 |
| `alert:cost` | `{ agentId, cost }` | 成本告警 |
| `alert:error_rate` | `{ agentId, errorRate }` | 错误率告警 |
| `alert:latency` | `{ agentId, latency }` | 延迟告警 |

### 事件监听示例

```typescript
monitor.on('agent:start', (data) => {
  console.log(`Agent ${data.agentId} started`);
});

monitor.on('agent:complete', (data) => {
  console.log(`Agent ${data.agentId} completed in ${data.duration}ms`);
});

monitor.on('alert:triggered', (alert) => {
  if (alert.severity === 'critical') {
    notifyOperators(alert);
  }
});
```

## 最佳实践

### 1. 适当的粒度

```typescript
// ✅ 推荐：跟踪整个代理执行
monitor.startTracking(agentId, type);
// ... 代理执行 ...
monitor.stopTracking(agentId, 'completed');

// ❌ 避免：过于细粒度的跟踪
monitor.startTracking(stepId, 'step1');
monitor.stopTracking(stepId, 'completed');
```

### 2. 及时记录指标

```typescript
// ✅ 推荐：API 调用后立即记录
const response = await api.call();
monitor.recordApiCall(agentId, true, latency);
monitor.recordTokens(agentId, input, output);

// ❌ 避免：延迟记录导致指标不准确
// ... 很多其他操作 ...
monitor.recordApiCall(agentId, true); // 延迟太久
```

### 3. 错误处理

```typescript
// ✅ 推荐：捕获并记录所有错误
try {
  await executeAgent();
  monitor.stopTracking(agentId, 'completed');
} catch (error) {
  monitor.recordError(agentId, error as Error, 'execution');
  monitor.stopTracking(agentId, 'failed');
  throw error;
}
```

### 4. 定期清理

```typescript
// ✅ 推荐：定期清理旧指标
setInterval(() => {
  const metrics = monitor.getAllMetrics();
  const oldMetrics = metrics.filter(m =>
    m.endTime && Date.now() - m.endTime.getTime() > 7 * 24 * 60 * 60 * 1000
  );

  oldMetrics.forEach(m => monitor.clearMetrics(m.agentId));
}, 24 * 60 * 60 * 1000); // 每天
```

### 5. 合理的告警阈值

```typescript
// ✅ 推荐：根据实际情况调整阈值
const monitor = new AgentMonitor({
  timeoutThreshold: 300000,      // 5分钟（长任务）
  costThreshold: 0.5,            // $0.50（合理预算）
  errorRateThreshold: 0.1,       // 10%（可接受范围）
  latencyThreshold: 3000,        // 3秒（合理延迟）
});

// ❌ 避免：过于严格或宽松的阈值
const monitor = new AgentMonitor({
  timeoutThreshold: 1000,        // 1秒（太短）
  costThreshold: 10,             // $10（太高）
  errorRateThreshold: 0.9,       // 90%（太宽松）
});
```

### 6. 性能分析工作流

```typescript
// ✅ 推荐：定期生成性能报告
async function weeklyPerformanceReview() {
  const metrics = monitor.getAllMetrics();
  const reports = analyzer.analyze(metrics);

  // 识别问题代理
  const problematicAgents = reports.filter(r => r.overallScore < 60);

  // 生成优化计划
  problematicAgents.forEach(report => {
    console.log(`Agent ${report.agentId} needs optimization`);
    report.suggestions
      .filter(s => s.priority === 'high')
      .forEach(s => console.log(`- ${s.title}`));
  });
}
```

## 性能影响

监控系统设计为轻量级，对代理执行的影响最小：

- **内存开销**: 每个代理约 1-5KB
- **CPU 开销**: < 1% 的额外计算
- **磁盘 I/O**: 异步写入，不阻塞主流程

### 优化建议

1. **批量操作**: 使用 `recordToolCall` 代替 `startToolCall` + `endToolCall`
2. **选择性持久化**: 对于临时代理可以禁用 `persistMetrics`
3. **定期清理**: 删除不需要的旧指标

## 故障排查

### 问题：指标未被记录

**可能原因**：
- `collectMetrics` 设置为 `false`
- Agent ID 不匹配

**解决方案**：
```typescript
// 检查配置
const config = monitor.config;
console.log('Collect metrics:', config.collectMetrics);

// 验证 agent ID
const metrics = monitor.getMetrics(agentId);
console.log('Metrics found:', metrics !== null);
```

### 问题：告警未触发

**可能原因**：
- 告警功能未启用
- 阈值设置不当

**解决方案**：
```typescript
// 检查告警配置
console.log('Alert on timeout:', monitor.config.alertOnTimeout);
console.log('Timeout threshold:', monitor.config.timeoutThreshold);

// 手动触发告警检查
const alert = alertManager.checkCost(metrics, 0.1);
if (alert) {
  console.log('Alert would be triggered:', alert);
}
```

## 许可证

MIT License - 详见 LICENSE 文件

## 相关链接

- [Agent Tool 文档](./agent.ts)
- [完整示例](./monitor.example.ts)
- [项目主页](../../README.md)
