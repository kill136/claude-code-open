/**
 * Agent Monitor - 代理执行监控系统
 * 提供执行跟踪、资源监控、性能分析和告警功能
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ==================== 类型定义 ====================

/** 工具调用指标 */
export interface ToolCallMetric {
  toolName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // 毫秒
  success: boolean;
  error?: string;
  inputSize?: number; // 输入数据大小（字节）
  outputSize?: number; // 输出数据大小（字节）
}

/** 代理指标 */
export interface AgentMetrics {
  agentId: string;
  type: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // 毫秒
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

  // Token 使用
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };

  // API 统计
  apiCalls: number;
  apiCallsSuccess: number;
  apiCallsFailed: number;

  // 工具调用
  toolCalls: ToolCallMetric[];
  toolCallCount: number;

  // 成本
  cost: number; // USD

  // 错误
  errors: Array<{
    timestamp: Date;
    message: string;
    stack?: string;
    phase?: string; // 发生错误的阶段
  }>;

  // 性能指标
  performance: {
    avgApiLatency?: number; // 平均 API 延迟（毫秒）
    avgToolLatency?: number; // 平均工具延迟（毫秒）
    totalWaitTime?: number; // 总等待时间（毫秒）
    throughput?: number; // tokens per second
  };

  // 元数据
  metadata?: Record<string, any>;
}

/** 监控配置 */
export interface MonitorConfig {
  collectMetrics: boolean;
  persistMetrics: boolean;
  metricsDir?: string;

  // 告警阈值
  alertOnTimeout: boolean;
  timeoutThreshold: number; // 毫秒

  alertOnCostThreshold: boolean;
  costThreshold: number; // USD

  alertOnErrorRate: boolean;
  errorRateThreshold: number; // 0-1

  alertOnHighLatency: boolean;
  latencyThreshold: number; // 毫秒

  // 性能分析
  enablePerformanceAnalysis: boolean;
  enableBottleneckDetection: boolean;
}

/** 告警类型 */
export type AlertType = 'timeout' | 'cost' | 'error_rate' | 'latency' | 'custom';

/** 告警严重性 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/** 告警 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  agentId: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

/** 聚合统计 */
export interface AggregatedStats {
  totalAgents: number;
  runningAgents: number;
  completedAgents: number;
  failedAgents: number;

  totalCost: number;
  totalTokens: number;
  totalApiCalls: number;
  totalToolCalls: number;

  avgDuration: number;
  avgCost: number;
  avgTokens: number;

  successRate: number;
  errorRate: number;

  mostUsedTools: Array<{ tool: string; count: number }>;
  slowestTools: Array<{ tool: string; avgDuration: number }>;

  costByAgent: Array<{ agentId: string; type: string; cost: number }>;

  timeRange: {
    start: Date;
    end: Date;
  };
}

/** 性能报告 */
export interface PerformanceReport {
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

/** 瓶颈 */
export interface Bottleneck {
  type: 'api' | 'tool' | 'network' | 'processing' | 'other';
  description: string;
  impact: 'low' | 'medium' | 'high';
  location?: string; // 具体工具名或阶段
  suggestedFix?: string;
}

/** 优化建议 */
export interface Suggestion {
  category: 'performance' | 'cost' | 'reliability' | 'efficiency';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedImpact?: string;
  actionItems?: string[];
}

/** 仪表板数据 */
export interface DashboardData {
  summary: {
    activeAgents: number;
    totalAgentsToday: number;
    totalCostToday: number;
    avgResponseTime: number;
    successRate: number;
  };

  recentAgents: Array<{
    id: string;
    type: string;
    status: string;
    duration: number;
    cost: number;
  }>;

  alerts: Alert[];

  charts: {
    costOverTime: Array<{ timestamp: number; cost: number }>;
    tokensOverTime: Array<{ timestamp: number; tokens: number }>;
    latencyOverTime: Array<{ timestamp: number; latency: number }>;
    errorRateOverTime: Array<{ timestamp: number; rate: number }>;
  };

  topMetrics: {
    mostExpensiveAgents: Array<{ id: string; type: string; cost: number }>;
    slowestAgents: Array<{ id: string; type: string; duration: number }>;
    mostActiveTools: Array<{ tool: string; count: number }>;
  };
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: MonitorConfig = {
  collectMetrics: true,
  persistMetrics: true,

  alertOnTimeout: true,
  timeoutThreshold: 300000, // 5分钟

  alertOnCostThreshold: true,
  costThreshold: 1.0, // $1

  alertOnErrorRate: true,
  errorRateThreshold: 0.3, // 30%

  alertOnHighLatency: true,
  latencyThreshold: 5000, // 5秒

  enablePerformanceAnalysis: true,
  enableBottleneckDetection: true,
};

// ==================== AgentMonitor ====================

export class AgentMonitor extends EventEmitter {
  private config: MonitorConfig;
  private metrics: Map<string, AgentMetrics> = new Map();
  private activeToolCalls: Map<string, ToolCallMetric> = new Map();
  private metricsDir: string;

  constructor(config?: Partial<MonitorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metricsDir = this.config.metricsDir ||
      path.join(os.homedir(), '.claude', 'agent-metrics');

    this.ensureMetricsDir();
  }

  private ensureMetricsDir(): void {
    if (this.config.persistMetrics && !fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  /**
   * 开始跟踪代理
   */
  startTracking(agentId: string, type: string, description?: string, metadata?: Record<string, any>): void {
    if (!this.config.collectMetrics) return;

    const metrics: AgentMetrics = {
      agentId,
      type,
      description,
      startTime: new Date(),
      status: 'running',
      tokensUsed: { input: 0, output: 0, total: 0 },
      apiCalls: 0,
      apiCallsSuccess: 0,
      apiCallsFailed: 0,
      toolCalls: [],
      toolCallCount: 0,
      cost: 0,
      errors: [],
      performance: {},
      metadata,
    };

    this.metrics.set(agentId, metrics);
    this.emit('agent:start', { agentId, type, timestamp: metrics.startTime });

    // 启动超时检查
    if (this.config.alertOnTimeout) {
      this.scheduleTimeoutCheck(agentId);
    }
  }

  /**
   * 记录工具调用开始
   */
  startToolCall(agentId: string, toolName: string, inputSize?: number): string {
    const toolCallId = `${agentId}:${toolName}:${Date.now()}`;
    const toolCall: ToolCallMetric = {
      toolName,
      startTime: new Date(),
      success: true,
      inputSize,
    };

    this.activeToolCalls.set(toolCallId, toolCall);
    return toolCallId;
  }

  /**
   * 记录工具调用结束
   */
  endToolCall(
    agentId: string,
    toolCallId: string,
    success: boolean = true,
    error?: string,
    outputSize?: number
  ): void {
    const toolCall = this.activeToolCalls.get(toolCallId);
    if (!toolCall) return;

    toolCall.endTime = new Date();
    toolCall.duration = toolCall.endTime.getTime() - toolCall.startTime.getTime();
    toolCall.success = success;
    toolCall.error = error;
    toolCall.outputSize = outputSize;

    this.activeToolCalls.delete(toolCallId);

    const metrics = this.metrics.get(agentId);
    if (metrics) {
      metrics.toolCalls.push(toolCall);
      metrics.toolCallCount++;
      this.updatePerformanceMetrics(metrics);
    }
  }

  /**
   * 记录工具调用（简化版本）
   */
  recordToolCall(agentId: string, tool: string, duration: number, success: boolean = true): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    const toolCall: ToolCallMetric = {
      toolName: tool,
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      duration,
      success,
    };

    metrics.toolCalls.push(toolCall);
    metrics.toolCallCount++;
    this.updatePerformanceMetrics(metrics);
  }

  /**
   * 记录 Token 使用
   */
  recordTokens(agentId: string, input: number, output: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.tokensUsed.input += input;
    metrics.tokensUsed.output += output;
    metrics.tokensUsed.total += input + output;

    this.updatePerformanceMetrics(metrics);
  }

  /**
   * 记录 API 调用
   */
  recordApiCall(agentId: string, success: boolean, latency?: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.apiCalls++;
    if (success) {
      metrics.apiCallsSuccess++;
    } else {
      metrics.apiCallsFailed++;
    }

    if (latency && this.config.alertOnHighLatency && latency > this.config.latencyThreshold) {
      this.emit('alert:latency', { agentId, latency });
    }
  }

  /**
   * 记录成本
   */
  recordCost(agentId: string, cost: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.cost += cost;

    // 检查成本告警
    if (this.config.alertOnCostThreshold && metrics.cost >= this.config.costThreshold) {
      this.emit('alert:cost', { agentId, cost: metrics.cost });
    }
  }

  /**
   * 记录错误
   */
  recordError(agentId: string, error: Error, phase?: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.errors.push({
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      phase,
    });

    this.emit('agent:error', { agentId, error, phase });

    // 检查错误率告警
    if (this.config.alertOnErrorRate) {
      const errorRate = metrics.errors.length / Math.max(metrics.apiCalls, 1);
      if (errorRate >= this.config.errorRateThreshold) {
        this.emit('alert:error_rate', { agentId, errorRate });
      }
    }
  }

  /**
   * 停止跟踪代理
   */
  stopTracking(agentId: string, status: 'completed' | 'failed' | 'cancelled' = 'completed'): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = status;

    this.updatePerformanceMetrics(metrics);
    this.emit('agent:complete', { agentId, status, duration: metrics.duration });

    // 持久化指标
    if (this.config.persistMetrics) {
      this.persistMetrics(agentId);
    }
  }

  /**
   * 取消代理跟踪
   */
  cancelTracking(agentId: string): void {
    this.stopTracking(agentId, 'cancelled');
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(metrics: AgentMetrics): void {
    // 计算平均工具延迟
    if (metrics.toolCalls.length > 0) {
      const totalToolTime = metrics.toolCalls.reduce(
        (sum, tc) => sum + (tc.duration || 0),
        0
      );
      metrics.performance.avgToolLatency = totalToolTime / metrics.toolCalls.length;
    }

    // 计算吞吐量（如果代理已完成）
    if (metrics.duration && metrics.duration > 0) {
      metrics.performance.throughput = (metrics.tokensUsed.total / metrics.duration) * 1000; // tokens per second
    }

    // 估算 API 延迟（基于工具调用和总时间）
    if (metrics.duration && metrics.toolCalls.length > 0) {
      const totalToolTime = metrics.toolCalls.reduce(
        (sum, tc) => sum + (tc.duration || 0),
        0
      );
      const estimatedApiTime = metrics.duration - totalToolTime;
      metrics.performance.avgApiLatency = estimatedApiTime / Math.max(metrics.apiCalls, 1);
    }
  }

  /**
   * 持久化指标
   */
  private persistMetrics(agentId: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    try {
      const filePath = path.join(this.metricsDir, `${agentId}.json`);
      const data = {
        ...metrics,
        startTime: metrics.startTime.toISOString(),
        endTime: metrics.endTime?.toISOString(),
        toolCalls: metrics.toolCalls.map(tc => ({
          ...tc,
          startTime: tc.startTime.toISOString(),
          endTime: tc.endTime?.toISOString(),
        })),
        errors: metrics.errors.map(e => ({
          ...e,
          timestamp: e.timestamp.toISOString(),
        })),
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to persist metrics for agent ${agentId}:`, error);
    }
  }

  /**
   * 加载持久化的指标
   */
  private loadMetrics(agentId: string): AgentMetrics | null {
    try {
      const filePath = path.join(this.metricsDir, `${agentId}.json`);
      if (!fs.existsSync(filePath)) return null;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...data,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        toolCalls: data.toolCalls.map((tc: any) => ({
          ...tc,
          startTime: new Date(tc.startTime),
          endTime: tc.endTime ? new Date(tc.endTime) : undefined,
        })),
        errors: data.errors.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })),
      };
    } catch (error) {
      console.error(`Failed to load metrics for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * 定时检查超时
   */
  private scheduleTimeoutCheck(agentId: string): void {
    setTimeout(() => {
      const metrics = this.metrics.get(agentId);
      if (!metrics || metrics.status !== 'running') return;

      const elapsed = Date.now() - metrics.startTime.getTime();
      if (elapsed >= this.config.timeoutThreshold) {
        metrics.status = 'timeout';
        this.emit('agent:timeout', { agentId, elapsed });
      }
    }, this.config.timeoutThreshold);
  }

  /**
   * 获取单个代理的指标
   */
  getMetrics(agentId: string): AgentMetrics | null {
    let metrics = this.metrics.get(agentId);

    // 如果内存中没有，尝试从磁盘加载
    if (!metrics && this.config.persistMetrics) {
      metrics = this.loadMetrics(agentId);
      if (metrics) {
        this.metrics.set(agentId, metrics);
      }
    }

    return metrics || null;
  }

  /**
   * 获取所有代理的指标
   */
  getAllMetrics(): AgentMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 获取聚合统计
   */
  getAggregatedStats(): AggregatedStats {
    const allMetrics = this.getAllMetrics();

    if (allMetrics.length === 0) {
      return {
        totalAgents: 0,
        runningAgents: 0,
        completedAgents: 0,
        failedAgents: 0,
        totalCost: 0,
        totalTokens: 0,
        totalApiCalls: 0,
        totalToolCalls: 0,
        avgDuration: 0,
        avgCost: 0,
        avgTokens: 0,
        successRate: 0,
        errorRate: 0,
        mostUsedTools: [],
        slowestTools: [],
        costByAgent: [],
        timeRange: { start: new Date(), end: new Date() },
      };
    }

    const runningAgents = allMetrics.filter(m => m.status === 'running').length;
    const completedAgents = allMetrics.filter(m => m.status === 'completed').length;
    const failedAgents = allMetrics.filter(m => m.status === 'failed').length;

    const totalCost = allMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.tokensUsed.total, 0);
    const totalApiCalls = allMetrics.reduce((sum, m) => sum + m.apiCalls, 0);
    const totalToolCalls = allMetrics.reduce((sum, m) => sum + m.toolCallCount, 0);

    const completedMetrics = allMetrics.filter(m => m.duration !== undefined);
    const avgDuration = completedMetrics.length > 0
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length
      : 0;

    const avgCost = totalCost / allMetrics.length;
    const avgTokens = totalTokens / allMetrics.length;

    const successRate = allMetrics.length > 0
      ? completedAgents / allMetrics.length
      : 0;

    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors.length, 0);
    const errorRate = totalApiCalls > 0 ? totalErrors / totalApiCalls : 0;

    // 统计工具使用
    const toolUsage = new Map<string, number>();
    const toolDurations = new Map<string, number[]>();

    allMetrics.forEach(m => {
      m.toolCalls.forEach(tc => {
        toolUsage.set(tc.toolName, (toolUsage.get(tc.toolName) || 0) + 1);

        if (tc.duration !== undefined) {
          if (!toolDurations.has(tc.toolName)) {
            toolDurations.set(tc.toolName, []);
          }
          toolDurations.get(tc.toolName)!.push(tc.duration);
        }
      });
    });

    const mostUsedTools = Array.from(toolUsage.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const slowestTools = Array.from(toolDurations.entries())
      .map(([tool, durations]) => ({
        tool,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    const costByAgent = allMetrics
      .map(m => ({ agentId: m.agentId, type: m.type, cost: m.cost }))
      .sort((a, b) => b.cost - a.cost);

    const timestamps = allMetrics.map(m => m.startTime.getTime());
    const timeRange = {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps.map((t, i) =>
        allMetrics[i].endTime?.getTime() || t
      ))),
    };

    return {
      totalAgents: allMetrics.length,
      runningAgents,
      completedAgents,
      failedAgents,
      totalCost,
      totalTokens,
      totalApiCalls,
      totalToolCalls,
      avgDuration,
      avgCost,
      avgTokens,
      successRate,
      errorRate,
      mostUsedTools,
      slowestTools,
      costByAgent,
      timeRange,
    };
  }

  /**
   * 清除指定代理的指标
   */
  clearMetrics(agentId: string): boolean {
    const deleted = this.metrics.delete(agentId);

    if (this.config.persistMetrics) {
      try {
        const filePath = path.join(this.metricsDir, `${agentId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Failed to delete metrics file for agent ${agentId}:`, error);
      }
    }

    return deleted;
  }

  /**
   * 清除所有指标
   */
  clearAllMetrics(): void {
    this.metrics.clear();

    if (this.config.persistMetrics) {
      try {
        const files = fs.readdirSync(this.metricsDir);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.metricsDir, file));
          }
        });
      } catch (error) {
        console.error('Failed to clear metrics directory:', error);
      }
    }
  }
}

// ==================== AlertManager ====================

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private monitor: AgentMonitor;

  constructor(monitor?: AgentMonitor) {
    this.monitor = monitor || new AgentMonitor();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.monitor.on('agent:timeout', (data) => {
      this.createAlert({
        type: 'timeout',
        severity: 'high',
        agentId: data.agentId,
        message: `Agent ${data.agentId} has exceeded timeout threshold (${data.elapsed}ms)`,
        metadata: data,
      });
    });

    this.monitor.on('alert:cost', (data) => {
      this.createAlert({
        type: 'cost',
        severity: 'medium',
        agentId: data.agentId,
        message: `Agent ${data.agentId} has exceeded cost threshold ($${data.cost.toFixed(4)})`,
        metadata: data,
      });
    });

    this.monitor.on('alert:error_rate', (data) => {
      this.createAlert({
        type: 'error_rate',
        severity: 'high',
        agentId: data.agentId,
        message: `Agent ${data.agentId} has high error rate (${(data.errorRate * 100).toFixed(1)}%)`,
        metadata: data,
      });
    });

    this.monitor.on('alert:latency', (data) => {
      this.createAlert({
        type: 'latency',
        severity: 'medium',
        agentId: data.agentId,
        message: `High API latency detected for agent ${data.agentId} (${data.latency}ms)`,
        metadata: data,
      });
    });
  }

  private createAlert(params: {
    type: AlertType;
    severity: AlertSeverity;
    agentId: string;
    message: string;
    metadata?: Record<string, any>;
  }): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      severity: params.severity,
      agentId: params.agentId,
      message: params.message,
      timestamp: new Date(),
      acknowledged: false,
      metadata: params.metadata,
    };

    this.alerts.set(alert.id, alert);
    this.monitor.emit('alert:triggered', alert);

    return alert;
  }

  checkTimeout(metrics: AgentMetrics): Alert | null {
    if (metrics.status === 'timeout') {
      return this.createAlert({
        type: 'timeout',
        severity: 'high',
        agentId: metrics.agentId,
        message: `Agent has timed out after ${metrics.duration}ms`,
        metadata: { duration: metrics.duration },
      });
    }
    return null;
  }

  checkCost(metrics: AgentMetrics, threshold: number = 1.0): Alert | null {
    if (metrics.cost >= threshold) {
      return this.createAlert({
        type: 'cost',
        severity: metrics.cost >= threshold * 2 ? 'high' : 'medium',
        agentId: metrics.agentId,
        message: `Agent cost ($${metrics.cost.toFixed(4)}) exceeds threshold ($${threshold.toFixed(2)})`,
        metadata: { cost: metrics.cost, threshold },
      });
    }
    return null;
  }

  checkErrors(metrics: AgentMetrics, threshold: number = 0.3): Alert | null {
    const errorRate = metrics.errors.length / Math.max(metrics.apiCalls, 1);
    if (errorRate >= threshold) {
      return this.createAlert({
        type: 'error_rate',
        severity: errorRate >= 0.5 ? 'critical' : 'high',
        agentId: metrics.agentId,
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        metadata: { errorRate, errorCount: metrics.errors.length, apiCalls: metrics.apiCalls },
      });
    }
    return null;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.acknowledged);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  acknowledgeAll(): void {
    this.alerts.forEach(alert => {
      alert.acknowledged = true;
    });
  }

  clearAcknowledged(): number {
    let cleared = 0;
    this.alerts.forEach((alert, id) => {
      if (alert.acknowledged) {
        this.alerts.delete(id);
        cleared++;
      }
    });
    return cleared;
  }
}

// ==================== PerformanceAnalyzer ====================

export class PerformanceAnalyzer {
  analyze(metrics: AgentMetrics[]): PerformanceReport[] {
    return metrics.map(m => this.analyzeAgent(m));
  }

  analyzeAgent(metrics: AgentMetrics): PerformanceReport {
    const scores = {
      executionTime: this.scoreExecutionTime(metrics),
      apiLatency: this.scoreApiLatency(metrics),
      toolLatency: this.scoreToolLatency(metrics),
      errorRate: this.scoreErrorRate(metrics),
      costEfficiency: this.scoreCostEfficiency(metrics),
    };

    const overallScore = Object.values(scores).reduce(
      (sum, s) => sum + s.score,
      0
    ) / Object.keys(scores).length;

    const bottlenecks = this.identifyBottlenecks(metrics);
    const suggestions = this.suggestOptimizations(metrics);

    return {
      agentId: metrics.agentId,
      overallScore,
      metrics: scores,
      bottlenecks,
      suggestions,
      timestamp: new Date(),
    };
  }

  private scoreExecutionTime(metrics: AgentMetrics): { value: number; score: number; rating: string } {
    const duration = metrics.duration || 0;
    let score = 100;

    if (duration > 60000) score -= 40; // > 1 min
    else if (duration > 30000) score -= 20; // > 30s
    else if (duration > 10000) score -= 10; // > 10s

    return {
      value: duration,
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    };
  }

  private scoreApiLatency(metrics: AgentMetrics): { value: number; score: number; rating: string } {
    const latency = metrics.performance.avgApiLatency || 0;
    let score = 100;

    if (latency > 5000) score -= 50; // > 5s
    else if (latency > 3000) score -= 30; // > 3s
    else if (latency > 1000) score -= 15; // > 1s

    return {
      value: latency,
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    };
  }

  private scoreToolLatency(metrics: AgentMetrics): { value: number; score: number; rating: string } {
    const latency = metrics.performance.avgToolLatency || 0;
    let score = 100;

    if (latency > 2000) score -= 40; // > 2s
    else if (latency > 1000) score -= 20; // > 1s
    else if (latency > 500) score -= 10; // > 500ms

    return {
      value: latency,
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    };
  }

  private scoreErrorRate(metrics: AgentMetrics): { value: number; score: number; rating: string } {
    const errorRate = metrics.errors.length / Math.max(metrics.apiCalls, 1);
    let score = 100;

    if (errorRate > 0.3) score -= 60; // > 30%
    else if (errorRate > 0.1) score -= 30; // > 10%
    else if (errorRate > 0.05) score -= 15; // > 5%

    return {
      value: errorRate,
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    };
  }

  private scoreCostEfficiency(metrics: AgentMetrics): { value: number; score: number; rating: string } {
    const costPerToken = metrics.tokensUsed.total > 0
      ? metrics.cost / metrics.tokensUsed.total
      : 0;

    let score = 100;

    // 基于每 1000 tokens 的成本评分
    const costPer1k = costPerToken * 1000;
    if (costPer1k > 0.05) score -= 40;
    else if (costPer1k > 0.03) score -= 20;
    else if (costPer1k > 0.01) score -= 10;

    return {
      value: costPerToken,
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    };
  }

  identifyBottlenecks(metrics: AgentMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // API 延迟瓶颈
    if (metrics.performance.avgApiLatency && metrics.performance.avgApiLatency > 3000) {
      bottlenecks.push({
        type: 'api',
        description: `High API latency (${metrics.performance.avgApiLatency.toFixed(0)}ms avg)`,
        impact: metrics.performance.avgApiLatency > 5000 ? 'high' : 'medium',
        suggestedFix: 'Consider using a faster model like Haiku for simpler tasks',
      });
    }

    // 工具执行瓶颈
    if (metrics.performance.avgToolLatency && metrics.performance.avgToolLatency > 1000) {
      bottlenecks.push({
        type: 'tool',
        description: `Slow tool execution (${metrics.performance.avgToolLatency.toFixed(0)}ms avg)`,
        impact: 'medium',
        suggestedFix: 'Optimize tool implementations or use parallel execution',
      });
    }

    // 识别最慢的工具
    const slowTools = metrics.toolCalls
      .filter(tc => tc.duration && tc.duration > 2000)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 3);

    slowTools.forEach(tc => {
      bottlenecks.push({
        type: 'tool',
        description: `Slow ${tc.toolName} execution (${tc.duration}ms)`,
        impact: 'medium',
        location: tc.toolName,
        suggestedFix: `Optimize ${tc.toolName} tool or reduce input size`,
      });
    });

    // 错误率瓶颈
    const errorRate = metrics.errors.length / Math.max(metrics.apiCalls, 1);
    if (errorRate > 0.2) {
      bottlenecks.push({
        type: 'other',
        description: `High error rate (${(errorRate * 100).toFixed(1)}%)`,
        impact: 'high',
        suggestedFix: 'Review error logs and improve error handling',
      });
    }

    return bottlenecks;
  }

  suggestOptimizations(metrics: AgentMetrics): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 性能建议
    if (metrics.duration && metrics.duration > 60000) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Long execution time detected',
        description: `Agent took ${(metrics.duration / 1000).toFixed(1)}s to complete. Consider breaking down into smaller sub-agents.`,
        estimatedImpact: '30-50% reduction in execution time',
        actionItems: [
          'Split complex tasks into parallel sub-agents',
          'Use background execution for long-running tasks',
          'Consider using faster model (Haiku) for simple operations',
        ],
      });
    }

    // 成本优化建议
    if (metrics.cost > 0.5) {
      suggestions.push({
        category: 'cost',
        priority: 'medium',
        title: 'High cost detected',
        description: `Agent cost ($${metrics.cost.toFixed(4)}) is significant. Consider optimization strategies.`,
        estimatedImpact: '20-40% cost reduction',
        actionItems: [
          'Use Haiku model for simple operations',
          'Reduce context size by summarizing earlier messages',
          'Cache frequently used results',
          'Optimize prompts to reduce output tokens',
        ],
      });
    }

    // 可靠性建议
    const errorRate = metrics.errors.length / Math.max(metrics.apiCalls, 1);
    if (errorRate > 0.1) {
      suggestions.push({
        category: 'reliability',
        priority: 'high',
        title: 'Improve error handling',
        description: `Error rate of ${(errorRate * 100).toFixed(1)}% indicates potential reliability issues.`,
        estimatedImpact: 'Improved success rate',
        actionItems: [
          'Add retry logic for transient errors',
          'Improve input validation',
          'Add error recovery mechanisms',
          'Review error logs for patterns',
        ],
      });
    }

    // 效率建议
    if (metrics.tokensUsed.total > 50000) {
      suggestions.push({
        category: 'efficiency',
        priority: 'medium',
        title: 'High token usage',
        description: `Agent used ${metrics.tokensUsed.total.toLocaleString()} tokens. Consider optimizing.`,
        estimatedImpact: '15-30% token reduction',
        actionItems: [
          'Summarize conversation history periodically',
          'Remove redundant context',
          'Use more concise prompts',
          'Implement context windowing',
        ],
      });
    }

    return suggestions;
  }
}

// ==================== Dashboard Functions ====================

export function generateDashboardData(metrics: AgentMetrics[]): DashboardData {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 今天的代理
  const todayMetrics = metrics.filter(m => m.startTime.getTime() >= oneDayAgo);
  const activeMetrics = metrics.filter(m => m.status === 'running');

  // 摘要
  const summary = {
    activeAgents: activeMetrics.length,
    totalAgentsToday: todayMetrics.length,
    totalCostToday: todayMetrics.reduce((sum, m) => sum + m.cost, 0),
    avgResponseTime: todayMetrics.length > 0
      ? todayMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / todayMetrics.length
      : 0,
    successRate: todayMetrics.length > 0
      ? todayMetrics.filter(m => m.status === 'completed').length / todayMetrics.length
      : 0,
  };

  // 最近的代理
  const recentAgents = metrics
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 10)
    .map(m => ({
      id: m.agentId,
      type: m.type,
      status: m.status,
      duration: m.duration || 0,
      cost: m.cost,
    }));

  // 图表数据（最近24小时）
  const timeSlots = 24;
  const slotDuration = (24 * 60 * 60 * 1000) / timeSlots;

  const chartData = {
    costOverTime: [] as Array<{ timestamp: number; cost: number }>,
    tokensOverTime: [] as Array<{ timestamp: number; tokens: number }>,
    latencyOverTime: [] as Array<{ timestamp: number; latency: number }>,
    errorRateOverTime: [] as Array<{ timestamp: number; rate: number }>,
  };

  for (let i = 0; i < timeSlots; i++) {
    const slotStart = oneDayAgo + i * slotDuration;
    const slotEnd = slotStart + slotDuration;

    const slotMetrics = todayMetrics.filter(
      m => m.startTime.getTime() >= slotStart && m.startTime.getTime() < slotEnd
    );

    chartData.costOverTime.push({
      timestamp: slotStart,
      cost: slotMetrics.reduce((sum, m) => sum + m.cost, 0),
    });

    chartData.tokensOverTime.push({
      timestamp: slotStart,
      tokens: slotMetrics.reduce((sum, m) => sum + m.tokensUsed.total, 0),
    });

    chartData.latencyOverTime.push({
      timestamp: slotStart,
      latency: slotMetrics.length > 0
        ? slotMetrics.reduce((sum, m) => sum + (m.performance.avgApiLatency || 0), 0) / slotMetrics.length
        : 0,
    });

    const totalApiCalls = slotMetrics.reduce((sum, m) => sum + m.apiCalls, 0);
    const totalErrors = slotMetrics.reduce((sum, m) => sum + m.errors.length, 0);
    chartData.errorRateOverTime.push({
      timestamp: slotStart,
      rate: totalApiCalls > 0 ? totalErrors / totalApiCalls : 0,
    });
  }

  // Top metrics
  const topMetrics = {
    mostExpensiveAgents: metrics
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)
      .map(m => ({ id: m.agentId, type: m.type, cost: m.cost })),

    slowestAgents: metrics
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5)
      .map(m => ({ id: m.agentId, type: m.type, duration: m.duration || 0 })),

    mostActiveTools: (() => {
      const toolCounts = new Map<string, number>();
      metrics.forEach(m => {
        m.toolCalls.forEach(tc => {
          toolCounts.set(tc.toolName, (toolCounts.get(tc.toolName) || 0) + 1);
        });
      });
      return Array.from(toolCounts.entries())
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })(),
  };

  return {
    summary,
    recentAgents,
    alerts: [], // Will be populated by AlertManager
    charts: chartData,
    topMetrics,
  };
}

export function exportMetrics(metrics: AgentMetrics[], format: 'json' | 'csv' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(metrics, null, 2);
  }

  // CSV export
  const headers = [
    'agentId',
    'type',
    'status',
    'startTime',
    'endTime',
    'duration',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'apiCalls',
    'toolCalls',
    'cost',
    'errorCount',
  ];

  const rows = metrics.map(m => [
    m.agentId,
    m.type,
    m.status,
    m.startTime.toISOString(),
    m.endTime?.toISOString() || '',
    m.duration || '',
    m.tokensUsed.input,
    m.tokensUsed.output,
    m.tokensUsed.total,
    m.apiCalls,
    m.toolCallCount,
    m.cost.toFixed(6),
    m.errors.length,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

// ==================== Convenience Functions ====================

/**
 * 创建一个完整的监控系统实例
 */
export function createMonitoringSystem(config?: Partial<MonitorConfig>): {
  monitor: AgentMonitor;
  alertManager: AlertManager;
  analyzer: PerformanceAnalyzer;
} {
  const monitor = new AgentMonitor(config);
  const alertManager = new AlertManager(monitor);
  const analyzer = new PerformanceAnalyzer();

  return { monitor, alertManager, analyzer };
}

/**
 * 生成性能报告
 */
export function generatePerformanceReport(
  metrics: AgentMetrics | AgentMetrics[]
): PerformanceReport | PerformanceReport[] {
  const analyzer = new PerformanceAnalyzer();

  if (Array.isArray(metrics)) {
    return analyzer.analyze(metrics);
  }

  return analyzer.analyzeAgent(metrics);
}
