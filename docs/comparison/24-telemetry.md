# 遥测与监控功能对比分析 (T276-T285)

## 概述

本文档对比分析了本项目与官方 @anthropic-ai/claude-code (v2.0.76) 在遥测与监控功能方面的实现差异。

**分析日期**: 2025-12-25
**官方版本**: 2.0.76
**对比范围**: T276-T285 (遥测与监控功能点)

---

## 功能点对比总览

| 功能点 | 任务ID | 本项目实现 | 官方实现 | 实现方式差异 |
|--------|--------|------------|----------|-------------|
| 遥测框架 | T276 | ✅ 自研 | ✅ OpenTelemetry | **架构不同** |
| 事件日志 | T277 | ✅ JSONL | ✅ OTEL Logs | **格式不同** |
| 指标收集 | T278 | ✅ 自研 | ✅ OTEL Metrics | **系统不同** |
| OpenTelemetry 集成 | T279 | ❌ 未实现 | ✅ 完整集成 | **重大差异** |
| 性能追踪 | T280 | ✅ 简单实现 | ✅ OTEL Traces | **能力不同** |
| 错误追踪 | T281 | ✅ opt-in | ✅ 集成 | **实现类似** |
| 使用统计 | T282 | ✅ 完整 | ✅ 完整 | **存储不同** |
| 隐私控制 | T283 | ✅ 强隐私 | ✅ 配置化 | **实现类似** |
| 本地日志 | T284 | ✅ JSONL | ✅ 可配置 | **格式不同** |
| 日志轮转 | T285 | ✅ 行数限制 | ✅ 未明确 | **实现简单** |

**核心差异**: 官方使用标准的 OpenTelemetry 生态，本项目使用自研轻量级遥测系统。

---

## T276: 遥测框架 TelemetryManager

### 本项目实现

**位置**: `/home/user/claude-code-open/src/telemetry/index.ts` (966行)

**架构**:
```typescript
// 自研遥测系统
export function initTelemetry(enabled?: boolean): void {
  // 创建遥测目录
  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }

  // 加载配置
  loadConfig();

  // 获取匿名 ID
  anonymousId = getAnonymousId();

  // 启动批量上报
  if (telemetryConfig.batchUpload && telemetryConfig.endpoint) {
    startUploadTimer();
  }
}
```

**特点**:
- 轻量级、无外部依赖
- 本地 JSONL 文件存储
- 简单的批量上报机制
- 自动隐私数据清洗

### 官方实现

**位置**: `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js:1700`

**架构**:
```javascript
function rO2() {
  x9("telemetry_init_start");
  GP5();
  U9A.diag.setLogger(new rK0, U9A.DiagLogLevel.ERROR);

  let A = [];
  if (XV0()) A.push(...ZP5());  // 添加 metrics exporters
  if (IP5()) A.push(XP5());     // 添加内部 exporter

  // 创建资源属性
  let B = {
    [Xr.ATTR_SERVICE_NAME]: "claude-code",
    [Xr.ATTR_SERVICE_VERSION]: "2.0.76"
  };

  // 创建 MeterProvider
  let K = new vxA.MeterProvider({
    resource: W,
    views: [],
    readers: A
  });

  // 配置 LoggerProvider
  if (XV0()) {
    let H = YP5();  // 获取 log exporters
    if (H.length > 0) {
      let D = new Ir.LoggerProvider({
        resource: W,
        processors: H.map(E =>
          new Ir.BatchLogRecordProcessor(E, {
            scheduledDelayMillis: parseInt(
              process.env.OTEL_LOGS_EXPORT_INTERVAL || "5000"
            )
          })
        )
      });
      yxA.logs.setGlobalLoggerProvider(D);
    }
  }

  // 配置 TracerProvider
  if (XV0() && F0(process.env.ENABLE_ENHANCED_TELEMETRY_BETA)) {
    let H = JP5();  // 获取 trace exporters
    if (H.length > 0) {
      let F = new Wr.BasicTracerProvider({
        resource: W,
        spanProcessors: H.map(E =>
          new Wr.BatchSpanProcessor(E, {
            scheduledDelayMillis: parseInt(
              process.env.OTEL_TRACES_EXPORT_INTERVAL || "5000"
            )
          })
        )
      });
      U9A.trace.setGlobalTracerProvider(F);
    }
  }
}

function XV0() {
  return F0(process.env.CLAUDE_CODE_ENABLE_TELEMETRY);
}
```

**特点**:
- 完整的 OpenTelemetry SDK
- 三大支柱：Metrics, Logs, Traces
- 标准化的资源属性
- 可插拔的 Exporter 系统

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **遥测框架** | 自研轻量级 | OpenTelemetry 标准 |
| **依赖** | 0 外部依赖 | @opentelemetry/* (多个包) |
| **复杂度** | 低 (966行) | 高 (标准SDK) |
| **可扩展性** | 有限 | 极强 (标准生态) |
| **标准化** | 非标准 | OTEL 标准 |
| **生态集成** | 无 | 完整 (Prometheus, Grafana, etc.) |

**差异评估**: ⭐⭐⭐⭐⭐ (重大差异)

---

## T277: 事件日志 EventLogger

### 本项目实现

**格式**: JSONL (JSON Lines)

```typescript
// 存储路径
const EVENTS_FILE = path.join(TELEMETRY_DIR, 'events.jsonl');

// 事件结构
export interface TelemetryEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  anonymousId: string;
  data: Record<string, unknown>;
  version?: string;
  platform?: string;
}

// 记录事件
export function trackEvent(type: string, data: Record<string, unknown> = {}): void {
  const sanitizedData = sanitizeData(data) as Record<string, unknown>;

  const event: TelemetryEvent = {
    type,
    timestamp: Date.now(),
    sessionId: currentSession?.sessionId || 'unknown',
    anonymousId,
    data: sanitizedData,
    version: getVersion(),
    platform: os.platform(),
  };

  // 追加到文件
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n');
  trimEventsFile();
}
```

### 官方实现

**格式**: OpenTelemetry Logs

```javascript
// 配置 LoggerProvider
function YP5() {
  let A = (process.env.OTEL_LOGS_EXPORTER || "").trim().split(",").filter(Boolean);
  let Q = [];

  for (let B of A) {
    if (B === "console") {
      Q.push(new Ir.ConsoleLogRecordExporter);
    } else if (B === "otlp") {
      let G = process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL?.trim() ||
              process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.trim();
      let Z = HV0();

      switch (G) {
        case "grpc":
          Q.push(new lO2.OTLPLogExporter);
          break;
        case "http/json":
          Q.push(new KV0.OTLPLogExporter(Z));
          break;
        case "http/protobuf":
          Q.push(new cO2.OTLPLogExporter(Z));
          break;
      }
    }
  }

  return Q;
}

// 使用 Logger
let W = yxA.logs.getLogger("com.anthropic.claude_code.events", "2.0.76");
aF1(W);  // 初始化 logger

// 刷新日志
process.on("beforeExit", async () => {
  await I?.forceFlush();
});
```

**支持的导出器**:
- Console (控制台输出)
- OTLP/gRPC (OpenTelemetry Protocol over gRPC)
- OTLP/HTTP JSON
- OTLP/HTTP Protobuf

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **格式** | JSONL | OTEL LogRecord |
| **导出器** | 文件 | Console/OTLP (多协议) |
| **批处理** | 简单队列 | BatchLogRecordProcessor |
| **结构化** | 自定义 | OTEL 标准 |
| **可查询** | grep/jq | OTEL 工具链 |
| **远程上报** | 自定义 HTTP | OTLP 标准协议 |

**差异评估**: ⭐⭐⭐⭐ (显著差异)

---

## T278: 指标收集 MetricCollector

### 本项目实现

**聚合指标**:
```typescript
export interface AggregateMetrics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  toolUsage: Record<string, number>;
  commandUsage: Record<string, number>;
  modelUsage: Record<string, number>;
  averageSessionDuration: number;
  totalErrors: number;
  errorTypes: Record<string, number>;
  lastUpdated: number;
}

// 性能指标
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// 更新指标
function updateAggregateMetrics(): void {
  metrics.totalSessions++;
  metrics.totalMessages += currentSession.messageCount;
  metrics.totalTokens += currentSession.tokenUsage.total;
  metrics.totalCost += currentSession.estimatedCost;
  metrics.totalErrors += currentSession.errors;

  // 工具使用统计
  for (const [tool, count] of Object.entries(currentSession.toolCalls)) {
    metrics.toolUsage[tool] = (metrics.toolUsage[tool] || 0) + count;
  }

  // 保存到文件
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
}
```

**存储**: 单一 JSON 文件 (`metrics.json`)

### 官方实现

**OpenTelemetry Metrics**:

```javascript
// 配置 Metrics Exporters
function ZP5() {
  let A = (process.env.OTEL_METRICS_EXPORTER || "").trim().split(",").filter(Boolean);
  let Q = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || "60000");
  let B = [];

  for (let G of A) {
    if (G === "console") {
      B.push(new WV0.ConsoleMetricExporter);
    } else if (G === "otlp") {
      let Z = process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL?.trim() ||
              process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.trim();

      switch (Z) {
        case "grpc":
          B.push(new mO2.OTLPMetricExporter);
          break;
        case "http/json":
          B.push(new dO2.OTLPMetricExporter(HV0()));
          break;
        case "http/protobuf":
          B.push(new uO2.OTLPMetricExporter(HV0()));
          break;
      }
    } else if (G === "prometheus") {
      B.push(new pO2.PrometheusExporter);
    }
  }

  return B.map(G => {
    if ("export" in G) {
      return new WV0.PeriodicExportingMetricReader({
        exporter: G,
        exportIntervalMillis: Q
      });
    }
    return G;
  });
}

// 创建 MeterProvider
let K = new vxA.MeterProvider({
  resource: W,
  views: [],
  readers: A
});

// 获取 Meter
K.getMeter("com.anthropic.claude_code", "2.0.76");
```

**支持的导出器**:
- Console
- OTLP (gRPC, HTTP/JSON, HTTP/Protobuf)
- Prometheus

**指标类型** (OTEL 标准):
- Counter (计数器)
- UpDownCounter (可增减计数器)
- Histogram (直方图)
- Gauge (仪表盘)
- ObservableGauge/Counter

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **指标系统** | 自研聚合 | OTEL Metrics API |
| **指标类型** | 简单计数 | Counter/Histogram/Gauge |
| **导出格式** | JSON | Console/OTLP/Prometheus |
| **实时性** | 批量更新 | 周期导出 (可配置) |
| **监控集成** | 无 | Prometheus/Grafana 等 |
| **查询能力** | 读文件 | PromQL/OTEL 查询 |

**差异评估**: ⭐⭐⭐⭐⭐ (重大差异)

---

## T279: OpenTelemetry 集成

### 本项目实现

❌ **未实现 OpenTelemetry 集成**

本项目使用自研遥测系统，不依赖 OpenTelemetry。

### 官方实现

✅ **完整的 OpenTelemetry 集成**

**依赖包** (从 cli.js 推断):
```javascript
U9A = require("@opentelemetry/api");           // OTEL API
yxA = require("@opentelemetry/api-logs");      // Logs API
vxA = require("@opentelemetry/sdk-metrics");   // Metrics SDK

// Exporters
uO2 = require("@opentelemetry/exporter-otlp-http-protobuf");
mO2 = require("@opentelemetry/exporter-otlp-grpc");
dO2 = require("@opentelemetry/exporter-otlp-http-json");
pO2 = require("@opentelemetry/exporter-prometheus");

cO2 = require("@opentelemetry/exporter-otlp-http-logs-protobuf");
lO2 = require("@opentelemetry/exporter-otlp-grpc-logs");
KV0 = require("@opentelemetry/exporter-otlp-http-logs-json");

iO2 = require("@opentelemetry/exporter-otlp-http-traces-protobuf");
nO2 = require("@opentelemetry/exporter-otlp-grpc-traces");
VV0 = require("@opentelemetry/exporter-otlp-http-traces-json");

// Resources
oP = require("@opentelemetry/resources");
Xr = require("@opentelemetry/semantic-conventions");

// SDK
Ir = require("@opentelemetry/sdk-logs");
Wr = require("@opentelemetry/sdk-trace-base");
WV0 = require("@opentelemetry/sdk-metrics");
```

**环境变量支持**:
```bash
# 遥测开关
CLAUDE_CODE_ENABLE_TELEMETRY=1

# Metrics
OTEL_METRICS_EXPORTER=otlp,prometheus
OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=grpc|http/json|http/protobuf
OTEL_METRIC_EXPORT_INTERVAL=60000

# Logs
OTEL_LOGS_EXPORTER=otlp,console
OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=grpc|http/json|http/protobuf
OTEL_LOGS_EXPORT_INTERVAL=5000

# Traces
OTEL_TRACES_EXPORTER=otlp,console
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=grpc|http/json|http/protobuf
OTEL_TRACES_EXPORT_INTERVAL=5000

# OTLP Endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com
OTEL_EXPORTER_OTLP_HEADERS=key1=value1,key2=value2

# Resource Attributes
OTEL_RESOURCE_ATTRIBUTES=service.name=claude-code,deployment.environment=production

# Shutdown
CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS=2000
CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS=5000
```

**三大支柱集成**:

1. **Metrics** (指标)
   - MeterProvider
   - PeriodicExportingMetricReader
   - Multiple exporters (OTLP, Prometheus)

2. **Logs** (日志)
   - LoggerProvider
   - BatchLogRecordProcessor
   - Multiple exporters (OTLP, Console)

3. **Traces** (追踪) - Beta
   - TracerProvider
   - BatchSpanProcessor
   - Distributed tracing support

### 对比分析

| 功能 | 本项目 | 官方 |
|------|--------|------|
| **OTEL SDK** | ❌ | ✅ |
| **Metrics** | 自研 | ✅ OTEL Metrics |
| **Logs** | JSONL | ✅ OTEL Logs |
| **Traces** | ❌ | ✅ (Beta) |
| **Exporters** | 自定义 | OTLP/Prometheus/Console |
| **协议支持** | HTTP | gRPC/HTTP/JSON/Protobuf |
| **生态兼容** | ❌ | ✅ (完整OTEL生态) |

**差异评估**: ⭐⭐⭐⭐⭐ (本项目缺失核心功能)

---

## T280: 性能追踪

### 本项目实现

**简单性能指标**:
```typescript
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export function trackPerformance(
  operation: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  if (!telemetryConfig.enabled || !telemetryConfig.performanceTracking) return;

  const metric: PerformanceMetric = {
    operation,
    duration,
    timestamp: Date.now(),
    success,
    metadata: sanitizeData(metadata),
  };

  // 保存到 JSONL 文件
  fs.appendFileSync(PERFORMANCE_FILE, JSON.stringify(metric) + '\n');
  trimFile(PERFORMANCE_FILE, MAX_EVENTS);
}

// 性能统计
export function getPerformanceStats(): {
  byOperation: Record<string, {
    count: number;
    avgDuration: number;
    successRate: number;
  }>;
  overall: {
    totalOperations: number;
    avgDuration: number;
    successRate: number;
  };
} | null {
  // 读取并聚合 performance.jsonl
  // ...
}
```

**特点**:
- 简单的时长和成功率统计
- 按操作分组
- 本地 JSONL 存储

### 官方实现

**OpenTelemetry Traces** (Beta):

```javascript
// Trace Exporters
function JP5() {
  let A = (process.env.OTEL_TRACES_EXPORTER || "").trim().split(",").filter(Boolean);
  let Q = [];

  for (let B of A) {
    if (B === "console") {
      Q.push(new Wr.ConsoleSpanExporter);
    } else if (B === "otlp") {
      let G = process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL?.trim();
      let Z = HV0();

      switch (G) {
        case "grpc":
          Q.push(new nO2.OTLPTraceExporter);
          break;
        case "http/json":
          Q.push(new VV0.OTLPTraceExporter(Z));
          break;
        case "http/protobuf":
          Q.push(new iO2.OTLPTraceExporter(Z));
          break;
      }
    }
  }

  return Q;
}

// TracerProvider (需要 ENABLE_ENHANCED_TELEMETRY_BETA)
if (XV0() && F0(process.env.ENABLE_ENHANCED_TELEMETRY_BETA)) {
  let H = JP5();
  if (H.length > 0) {
    let D = H.map(E =>
      new Wr.BatchSpanProcessor(E, {
        scheduledDelayMillis: parseInt(
          process.env.OTEL_TRACES_EXPORT_INTERVAL || "5000"
        )
      })
    );

    let F = new Wr.BasicTracerProvider({
      resource: W,
      spanProcessors: D
    });

    U9A.trace.setGlobalTracerProvider(F);
    rF1(F);  // 注册 tracer
  }
}
```

**Span 特性** (OTEL标准):
- Span 树形结构
- Parent-Child 关系
- Span Attributes
- Span Events
- Span Status
- 分布式追踪上下文传播

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **追踪系统** | 简单指标 | OTEL Distributed Tracing |
| **层级关系** | 无 | Span 树 (Parent-Child) |
| **上下文传播** | ❌ | ✅ (W3C Trace Context) |
| **可视化** | 手动分析 | Jaeger/Zipkin |
| **分布式追踪** | ❌ | ✅ |
| **详细程度** | 基础 | 丰富 (Attributes, Events) |

**差异评估**: ⭐⭐⭐⭐ (显著差异)

---

## T281: 错误追踪

### 本项目实现

**opt-in 错误报告**:
```typescript
export interface ErrorReport {
  errorType: string;
  errorMessage: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  anonymousId: string;
}

export function trackErrorReport(
  error: Error,
  context: Record<string, unknown> = {}
): void {
  if (!telemetryConfig.enabled || !telemetryConfig.errorReporting) return;

  const sanitizedContext = sanitizeData(context) as Record<string, unknown>;

  const report: ErrorReport = {
    errorType: error.name,
    errorMessage: error.message,
    stack: error.stack,
    context: sanitizedContext,
    timestamp: Date.now(),
    sessionId: currentSession?.sessionId || 'unknown',
    anonymousId,
  };

  // 保存到 errors.jsonl
  fs.appendFileSync(ERRORS_FILE, JSON.stringify(report) + '\n');
  trimFile(ERRORS_FILE, MAX_EVENTS);

  // 同时记录简单错误事件
  trackError(error.name, { message: error.message });
}

// 配置
export function enableErrorReporting(): void {
  telemetryConfig.errorReporting = true;
  saveConfig();
}

export function disableErrorReporting(): void {
  telemetryConfig.errorReporting = false;
  saveConfig();
}
```

**特点**:
- 默认禁用（需显式启用）
- 完整堆栈信息
- 上下文信息收集
- 隐私数据清洗

### 官方实现

**集成到 OTEL Logs**:

```javascript
// 错误作为 Log Records 记录
let W = yxA.logs.getLogger("com.anthropic.claude_code.events", "2.0.76");

// 错误日志会通过 LoggerProvider 的 Processors 处理
// 可以配置为发送到不同的后端

// 刷新错误日志
process.on("beforeExit", async () => {
  await I?.forceFlush();
});

process.on("exit", () => {
  I?.forceFlush();
});
```

**错误级别** (OTEL标准):
- TRACE (9)
- DEBUG (5)
- INFO (9)
- WARN (13)
- ERROR (17)
- FATAL (21)

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **错误收集** | opt-in | 默认启用 |
| **存储格式** | JSONL | OTEL LogRecords |
| **错误级别** | 单一 | OTEL 标准级别 |
| **堆栈信息** | ✅ | ✅ |
| **上下文** | ✅ | ✅ (Attributes) |
| **聚合分析** | 简单统计 | 后端聚合 |

**差异评估**: ⭐⭐⭐ (中等差异)

---

## T282: 使用统计

### 本项目实现

**完整的使用统计**:
```typescript
export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  messageCount: number;
  toolCalls: Record<string, number>;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  estimatedCost: number;
  model: string;
  errors: number;
}

export interface AggregateMetrics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  toolUsage: Record<string, number>;
  commandUsage: Record<string, number>;
  modelUsage: Record<string, number>;
  averageSessionDuration: number;
  totalErrors: number;
  errorTypes: Record<string, number>;
  lastUpdated: number;
}

// 会话跟踪
export function startSession(sessionId: string, model: string): void {
  currentSession = {
    sessionId,
    startTime: Date.now(),
    messageCount: 0,
    toolCalls: {},
    tokenUsage: { input: 0, output: 0, total: 0 },
    estimatedCost: 0,
    model,
    errors: 0,
  };

  trackEvent('session_start', { model });
}

export function endSession(): void {
  currentSession.endTime = Date.now();

  trackEvent('session_end', {
    duration: currentSession.endTime - currentSession.startTime,
    messageCount: currentSession.messageCount,
    tokenUsage: currentSession.tokenUsage,
    estimatedCost: currentSession.estimatedCost,
  });

  updateAggregateMetrics();
}
```

**跟踪的统计**:
- 会话数量和时长
- 消息数量
- Token 使用量和成本
- 工具调用频率
- 命令使用频率
- 模型选择分布
- 错误统计

### 官方实现

**OTEL Metrics + Custom Metrics**:

```javascript
// 通过 MeterProvider 收集指标
let K = new vxA.MeterProvider({
  resource: W,
  views: [],
  readers: A
});

// 获取 Meter
let meter = K.getMeter("com.anthropic.claude_code", "2.0.76");

// 可能的指标 (从配置推断):
// - session.count
// - message.count
// - token.usage
// - tool.calls
// - command.usage
// - errors.count

// 配置选项
// OTEL_METRICS_INCLUDE_ACCOUNT_UUID
// OTEL_METRICS_INCLUDE_SESSION_ID
// OTEL_METRICS_INCLUDE_VERSION
```

**导出频率**:
- 默认 60秒 (`OTEL_METRIC_EXPORT_INTERVAL`)
- 可配置

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **统计粒度** | 详细 | 详细 |
| **会话跟踪** | ✅ | ✅ |
| **Token统计** | ✅ | ✅ (推测) |
| **成本追踪** | ✅ | ✅ (推测) |
| **存储方式** | JSON文件 | OTEL Metrics |
| **实时性** | 会话结束更新 | 周期导出 |
| **查询能力** | 读文件 | Prometheus查询 |

**差异评估**: ⭐⭐ (较小差异，主要是存储方式)

---

## T283: 隐私控制

### 本项目实现

**强隐私保护机制**:

```typescript
// 敏感数据正则模式
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

// 自动清洗函数
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // 跳过敏感字段
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('auth')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }

  return data;
}

// 匿名 ID 生成
function getAnonymousId(): string {
  const machineInfo = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.homedir(),
  ].join('|');

  const hash = createHash('sha256').update(machineInfo).digest('hex');
  return `anon_${hash.substring(0, 32)}`;
}

// 禁用控制
export function disableTelemetry(): void {
  telemetryConfig.enabled = false;
  saveConfig();

  if (uploadTimer) {
    clearInterval(uploadTimer);
    uploadTimer = null;
  }
}

export function enableTelemetry(): void {
  if (TELEMETRY_DISABLED) {
    console.warn('Telemetry is disabled via environment variable');
    return;
  }

  telemetryConfig.enabled = true;
  saveConfig();
  initTelemetry();
}

// 环境变量
const TELEMETRY_DISABLED =
  process.env.CLAUDE_CODE_DISABLE_TELEMETRY === '1' ||
  process.env.CLAUDE_CODE_DISABLE_TELEMETRY === 'true' ||
  process.env.DISABLE_TELEMETRY === '1' ||
  process.env.DISABLE_TELEMETRY === 'true';
```

**隐私特性**:
- 自动清洗敏感数据
- 匿名用户 ID（机器信息哈希）
- 敏感字段自动屏蔽
- 路径信息匿名化
- 环境变量一键禁用

### 官方实现

**配置化隐私控制**:

```javascript
// 遥测开关
function XV0() {
  return F0(process.env.CLAUDE_CODE_ENABLE_TELEMETRY);
}

// 可选的用户信息包含
// OTEL_METRICS_INCLUDE_ACCOUNT_UUID
// OTEL_METRICS_INCLUDE_SESSION_ID
// OTEL_METRICS_INCLUDE_VERSION

// Resource Attributes 可配置
// OTEL_RESOURCE_ATTRIBUTES=service.name=claude-code,key=value

// OTLP Headers (可能包含认证信息)
function KP5() {
  let A = {};
  let Q = process.env.OTEL_EXPORTER_OTLP_HEADERS;
  if (Q) {
    for (let B of Q.split(",")) {
      let [G, ...Z] = B.split("=");
      if (G && Z.length > 0) {
        A[G.trim()] = Z.join("=").trim();
      }
    }
  }
  return A;
}

// 禁用遥测
// CLAUDE_CODE_ENABLE_TELEMETRY=0 或不设置
```

**隐私特性**:
- 默认禁用（需显式启用）
- 可配置包含的用户信息
- OTLP 支持认证头
- 资源属性可配置

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **默认状态** | 启用（可禁用） | 禁用（需启用） |
| **自动清洗** | ✅ 主动清洗 | 依赖配置 |
| **匿名化** | ✅ 机器哈希 | 配置控制 |
| **敏感字段** | ✅ 自动屏蔽 | 手动控制 |
| **禁用方式** | 环境变量 | 环境变量 |
| **数据本地性** | ✅ 默认本地 | 可配置上报 |

**差异评估**: ⭐⭐ (较小差异，本项目更主动保护隐私)

---

## T284: 本地日志

### 本项目实现

**JSONL 格式存储**:

```typescript
const TELEMETRY_DIR = path.join(os.homedir(), '.claude', 'telemetry');
const METRICS_FILE = path.join(TELEMETRY_DIR, 'metrics.json');
const EVENTS_FILE = path.join(TELEMETRY_DIR, 'events.jsonl');
const ERRORS_FILE = path.join(TELEMETRY_DIR, 'errors.jsonl');
const PERFORMANCE_FILE = path.join(TELEMETRY_DIR, 'performance.jsonl');
const QUEUE_FILE = path.join(TELEMETRY_DIR, 'queue.jsonl');

// 目录结构:
// ~/.claude/telemetry/
// ├── anonymous_id
// ├── config.json
// ├── metrics.json
// ├── events.jsonl
// ├── errors.jsonl
// ├── performance.jsonl
// └── queue.jsonl
```

**特点**:
- 纯文本 JSONL 格式
- 易于查询（grep, jq）
- 每行一个 JSON 对象
- 追加写入

### 官方实现

**可配置导出**:

```javascript
// 可以配置为本地文件（console exporter）
if (B === "console") {
  Q.push(new Ir.ConsoleLogRecordExporter);
  Q.push(new WV0.ConsoleMetricExporter);
  Q.push(new Wr.ConsoleSpanExporter);
}

// 或者 OTLP 远程上报
// OTEL_LOGS_EXPORTER=console      -> 本地控制台
// OTEL_LOGS_EXPORTER=otlp         -> 远程上报
// OTEL_METRICS_EXPORTER=console   -> 本地控制台
// OTEL_METRICS_EXPORTER=otlp      -> 远程上报
```

**特点**:
- 默认不写本地文件
- 可配置 Console Exporter
- 主要设计为远程上报
- 支持多种后端

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **本地存储** | ✅ 默认 | 可选（Console） |
| **文件格式** | JSONL | 标准输出 |
| **持久化** | ✅ | Console无持久化 |
| **查询** | grep/jq | 需重定向 |
| **设计目标** | 本地优先 | 远程优先 |

**差异评估**: ⭐⭐⭐ (中等差异，设计理念不同)

---

## T285: 日志轮转

### 本项目实现

**基于行数的轮转**:

```typescript
const MAX_EVENTS = 10000;  // 最大行数

function trimFile(filePath: string, maxLines: number): void {
  try {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length > maxLines) {
      const trimmed = lines.slice(-maxLines).join('\n') + '\n';
      fs.writeFileSync(filePath, trimmed);
    }
  } catch (err) {
    // 静默失败
  }
}

function trimEventsFile(): void {
  trimFile(EVENTS_FILE, MAX_EVENTS);
}

// 应用于所有 JSONL 文件:
// - events.jsonl (10,000 行)
// - errors.jsonl (10,000 行)
// - performance.jsonl (10,000 行)
```

**特点**:
- 保留最新 N 行
- 丢弃旧记录
- 写入时自动检查
- 简单有效

### 官方实现

**未明确实现日志轮转**

从代码分析，官方实现：
- 使用 BatchLogRecordProcessor (批处理)
- 批处理后导出到后端
- 不在本地持久化存储
- 依赖后端系统的轮转策略

**后端轮转**（推测）:
- OTLP Collector 负责
- Prometheus 自带轮转
- 云服务提供商管理

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **本地轮转** | ✅ 行数限制 | ❌ (不存本地) |
| **轮转策略** | 保留最新N行 | 后端决定 |
| **存储限制** | 10,000行/文件 | 无本地限制 |
| **实现复杂度** | 简单 | 依赖后端 |

**差异评估**: ⭐⭐ (较小差异，设计目标不同)

---

## 诊断系统对比

### 本项目实现

**位置**: `/home/user/claude-code-open/src/diagnostics/index.ts` (1095行)

**功能**:
```typescript
export async function runDiagnostics(options: DiagnosticOptions = {}): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];

  // 环境检查
  checks.push(await checkNodeVersion());
  checks.push(await checkNpmVersion());
  checks.push(await checkGitAvailability());
  checks.push(await checkRipgrepAvailability());
  checks.push(await checkTreeSitterAvailability());

  // 配置检查
  checks.push(await checkAuthConfiguration());
  checks.push(await checkConfigurationFiles());
  checks.push(await checkMCPServers());
  checks.push(await checkEnvironmentVariables());
  checks.push(await checkPermissionSettings());

  // 网络检查
  checks.push(await checkApiConnectivity());
  checks.push(await checkNetworkConnectivity());
  checks.push(await checkProxyConfiguration());
  checks.push(await checkSSLCertificates());

  // 文件系统检查
  checks.push(await checkFilePermissions());
  checks.push(await checkDiskSpace());
  checks.push(await checkSessionDirectory());
  checks.push(await checkCacheDirectory());

  // 性能检查
  checks.push(await checkMemoryUsage());
  checks.push(await checkCPULoad());

  return { /* DiagnosticReport */ };
}

// 健康检查
export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
}>

// 自动修复
export async function autoFixIssues(report: DiagnosticReport): Promise<{
  fixed: string[];
  failed: string[];
}>

// 系统健康评分
export async function getSystemHealthSummary(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  criticalIssues: string[];
}>
```

**诊断项** (20个):
1. Node.js 版本
2. npm 版本
3. Yarn 版本
4. Git 可用性
5. Ripgrep 可用性
6. Tree-sitter 可用性
7. 认证配置
8. API 连通性
9. 文件权限
10. 配置文件
11. MCP 服务器
12. 网络连通性
13. 环境变量
14. 权限设置
15. 代理配置
16. SSL 证书
17. 会话目录
18. 缓存目录
19. 内存使用
20. CPU 负载

### 官方实现

**诊断集成到遥测系统**:

```javascript
// 通过 OTEL Metrics 自动收集系统指标

// Resource Detectors
oP.osDetector.detect()      // 操作系统信息
oP.hostDetector.detect()    // 主机信息
oP.envDetector.detect()     // 环境变量

// 资源属性示例:
{
  [Xr.ATTR_SERVICE_NAME]: "claude-code",
  [Xr.ATTR_SERVICE_VERSION]: "2.0.76",
  [Xr.SEMRESATTRS_HOST_ARCH]: "x64",
  "wsl.version": "2",
  // ... 更多属性
}
```

**健康检查**（推测基于代码）:
- 通过 OTEL Health Check API
- 服务状态报告
- 自动上报到监控后端

### 对比分析

| 维度 | 本项目 | 官方 |
|------|--------|------|
| **诊断工具** | ✅ 完整 (20项) | 基础（资源检测） |
| **健康检查** | ✅ 详细 | OTEL 标准 |
| **自动修复** | ✅ | ❌ |
| **评分系统** | ✅ | ❌ |
| **格式化输出** | ✅ (表格/JSON) | OTEL格式 |
| **独立性** | ✅ 独立模块 | 集成到遥测 |

**差异评估**: 本项目诊断系统更完善

---

## 环境变量对比

### 本项目

```bash
# 遥测控制
CLAUDE_CODE_DISABLE_TELEMETRY=1     # 禁用遥测
DISABLE_TELEMETRY=true              # 通用禁用

# 配置（通过 config.json）
# {
#   "enabled": true,
#   "errorReporting": false,
#   "performanceTracking": true,
#   "batchUpload": false,
#   "uploadInterval": 3600000,
#   "maxBatchSize": 100,
#   "endpoint": "https://telemetry.example.com"
# }
```

### 官方

```bash
# 遥测总开关
CLAUDE_CODE_ENABLE_TELEMETRY=1

# Metrics
OTEL_METRICS_EXPORTER=otlp,prometheus
OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=grpc|http/json|http/protobuf
OTEL_EXPORTER_OTLP_METRICS_HEADERS=key1=value1,key2=value2
OTEL_METRIC_EXPORT_INTERVAL=60000
OTEL_METRICS_INCLUDE_ACCOUNT_UUID=true
OTEL_METRICS_INCLUDE_SESSION_ID=true
OTEL_METRICS_INCLUDE_VERSION=true

# Logs
OTEL_LOGS_EXPORTER=otlp,console
OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=grpc|http/json|http/protobuf
OTEL_EXPORTER_OTLP_LOGS_HEADERS=key1=value1
OTEL_LOGS_EXPORT_INTERVAL=5000

# Traces (Beta)
ENABLE_ENHANCED_TELEMETRY_BETA=1
OTEL_TRACES_EXPORTER=otlp,console
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=grpc|http/json|http/protobuf
OTEL_TRACES_EXPORT_INTERVAL=5000

# OTLP 通用配置
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc|http/json|http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer token

# 资源属性
OTEL_RESOURCE_ATTRIBUTES=service.name=claude-code,deployment.environment=production

# 超时控制
CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS=2000
CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS=5000

# 错误报告 (通用)
DISABLE_ERROR_REPORTING=1

# 日志用户提示词
OTEL_LOG_USER_PROMPTS=true

# Beta 功能
BETA_TRACING_ENDPOINT=https://traces.example.com
```

**配置复杂度**:
- 本项目: 2个环境变量 + 简单 JSON
- 官方: 20+ 个环境变量（完整 OTEL 配置）

---

## 实现复杂度对比

### 代码行数

| 组件 | 本项目 | 官方 |
|------|--------|------|
| **遥测系统** | 966行 (telemetry/index.ts) | 未知 (打包后) |
| **诊断系统** | 1095行 (diagnostics/index.ts) | 未知 |
| **总计** | ~2061行 | 依赖多个OTEL包 |

### 外部依赖

**本项目**:
```json
{
  "telemetry": "0 外部依赖",
  "diagnostics": "0 外部依赖"
}
```

**官方** (从 cli.js 推断):
```json
{
  "dependencies": [
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/exporter-otlp-grpc",
    "@opentelemetry/exporter-otlp-http-json",
    "@opentelemetry/exporter-otlp-http-protobuf",
    "@opentelemetry/exporter-prometheus",
    "@opentelemetry/resources",
    "@opentelemetry/semantic-conventions"
  ],
  "count": "10+ 包"
}
```

---

## 优劣势对比

### 本项目优势 ✅

1. **零依赖**: 不需要任何 OTEL 包
2. **简单易懂**: 966行代码，易于理解和维护
3. **本地优先**: 默认本地存储，易于调试
4. **隐私保护**: 主动清洗敏感数据
5. **即开即用**: 默认启用，无需复杂配置
6. **诊断完善**: 20项诊断检查，自动修复
7. **查询简单**: grep/jq 即可分析
8. **离线友好**: 完全本地工作

### 本项目劣势 ❌

1. **非标准**: 不符合 OpenTelemetry 标准
2. **生态隔离**: 无法与 OTEL 工具链集成
3. **功能有限**: 缺少分布式追踪
4. **可视化弱**: 需要手动分析，无图形界面
5. **扩展性差**: 难以添加新的导出器
6. **企业级**: 不适合大规模监控

### 官方优势 ✅

1. **工业标准**: OpenTelemetry 是行业标准
2. **生态丰富**: 与 Prometheus, Grafana, Jaeger 等集成
3. **分布式追踪**: 支持完整的 Distributed Tracing
4. **可扩展**: 易于添加新的 Exporter
5. **企业级**: 适合大规模监控部署
6. **可视化**: 丰富的可视化工具
7. **标准化**: 数据格式标准，易于集成
8. **云原生**: 与云服务无缝集成

### 官方劣势 ❌

1. **复杂配置**: 需要配置大量环境变量
2. **依赖多**: 10+ 个 npm 包
3. **体积大**: OTEL SDK 体积较大
4. **学习曲线**: 需要理解 OTEL 概念
5. **默认禁用**: 需要显式启用
6. **本地存储弱**: 主要设计为远程上报

---

## 使用场景建议

### 适合本项目实现的场景

1. **个人开发者**: 简单的使用统计
2. **离线环境**: 无法访问外部监控服务
3. **快速调试**: 本地 JSONL 文件易于查看
4. **隐私敏感**: 需要完全本地存储
5. **轻量部署**: 不想引入 OTEL 依赖

### 适合官方实现的场景

1. **企业部署**: 需要集中监控
2. **云原生**: 在 Kubernetes 等环境运行
3. **大规模**: 需要 Prometheus/Grafana 可视化
4. **分布式系统**: 需要追踪跨服务调用
5. **SRE 团队**: 专业监控和运维
6. **合规要求**: 需要标准化的遥测格式

---

## 迁移建议

### 从本项目迁移到官方 OTEL

如果希望从本项目的遥测系统迁移到 OpenTelemetry:

**步骤**:

1. **安装 OTEL 包**:
```bash
npm install @opentelemetry/api \
            @opentelemetry/sdk-metrics \
            @opentelemetry/sdk-logs \
            @opentelemetry/sdk-trace-base \
            @opentelemetry/exporter-prometheus
```

2. **配置环境变量**:
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=prometheus
export OTEL_LOGS_EXPORTER=console
```

3. **数据迁移**:
   - 现有 JSONL 数据可以通过脚本转换为 OTEL 格式
   - 使用 OTEL Collector 导入历史数据

4. **保留诊断系统**:
   - `diagnostics/index.ts` 可以独立保留
   - 与 OTEL 遥测并存

### 从官方 OTEL 迁移到本项目

**不建议迁移**，因为会失去：
- 标准化的遥测格式
- 丰富的生态工具
- 企业级监控能力

**适合降级的场景**:
- 简化部署
- 减少依赖
- 离线环境

---

## 总结

### 核心差异

1. **架构选择**:
   - 本项目: 自研轻量级系统
   - 官方: OpenTelemetry 标准

2. **设计理念**:
   - 本项目: 本地优先、隐私优先、简单易用
   - 官方: 企业级、可扩展、标准化

3. **适用场景**:
   - 本项目: 个人开发、快速调试、隐私敏感
   - 官方: 企业部署、大规模监控、云原生

### 功能完整性

| 类别 | 本项目 | 官方 |
|------|--------|------|
| **基础遥测** | ✅ 完整 | ✅ 完整 |
| **性能追踪** | ✅ 简单 | ✅ 完整（Traces） |
| **错误追踪** | ✅ opt-in | ✅ 集成 |
| **使用统计** | ✅ 完整 | ✅ 完整 |
| **隐私控制** | ✅ 主动 | ✅ 配置化 |
| **OpenTelemetry** | ❌ 无 | ✅ 完整 |
| **诊断系统** | ✅ 详细 | ⚠️ 基础 |

### 推荐方向

**如果你是...**

- **个人开发者**: 本项目实现足够
- **小团队**: 本项目实现 + 考虑未来迁移
- **企业团队**: 建议使用官方 OTEL 实现
- **开源项目**: 建议使用官方 OTEL 实现（生态兼容）

**升级路径**:

```
本项目实现 (当前)
    ↓
保留诊断系统 + 添加 OTEL SDK
    ↓
逐步迁移到完整 OTEL 生态
    ↓
企业级监控方案
```

---

## 附录

### A. 本项目遥测文件结构

```
~/.claude/telemetry/
├── anonymous_id              # 匿名用户 ID
├── config.json              # 遥测配置
├── metrics.json             # 聚合指标
├── events.jsonl             # 事件日志
├── errors.jsonl             # 错误报告
├── performance.jsonl        # 性能指标
└── queue.jsonl              # 上报队列
```

### B. 官方 OTEL 导出器列表

**Metrics**:
- ConsoleMetricExporter
- OTLPMetricExporter (gRPC)
- OTLPMetricExporter (HTTP/JSON)
- OTLPMetricExporter (HTTP/Protobuf)
- PrometheusExporter

**Logs**:
- ConsoleLogRecordExporter
- OTLPLogExporter (gRPC)
- OTLPLogExporter (HTTP/JSON)
- OTLPLogExporter (HTTP/Protobuf)

**Traces**:
- ConsoleSpanExporter
- OTLPTraceExporter (gRPC)
- OTLPTraceExporter (HTTP/JSON)
- OTLPTraceExporter (HTTP/Protobuf)

### C. OTEL 协议对比

| 协议 | 性能 | 复杂度 | 兼容性 |
|------|------|--------|--------|
| **gRPC** | 最高 | 高 | 需要 gRPC 支持 |
| **HTTP/Protobuf** | 高 | 中 | 广泛支持 |
| **HTTP/JSON** | 中 | 低 | 最广泛 |

### D. 参考资料

- OpenTelemetry 官方文档: https://opentelemetry.io/
- OTEL JS SDK: https://github.com/open-telemetry/opentelemetry-js
- 本项目遥测文档: `/home/user/claude-code-open/src/telemetry/README.md`
- 本项目遥测特性: `/home/user/claude-code-open/src/telemetry/FEATURES.md`
- 本项目诊断系统: `/home/user/claude-code-open/src/diagnostics/index.ts`

---

**文档生成时间**: 2025-12-25
**分析人员**: Claude Code Comparison Tool
**版本**: 1.0
