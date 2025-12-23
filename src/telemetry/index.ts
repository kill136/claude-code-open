/**
 * 遥测系统
 * 跟踪使用统计和事件（本地存储，不上传）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  data: Record<string, unknown>;
}

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
  modelUsage: Record<string, number>;
  averageSessionDuration: number;
  lastUpdated: number;
}

// 遥测配置
const TELEMETRY_DIR = path.join(os.homedir(), '.claude', 'telemetry');
const METRICS_FILE = path.join(TELEMETRY_DIR, 'metrics.json');
const EVENTS_FILE = path.join(TELEMETRY_DIR, 'events.jsonl');
const MAX_EVENTS = 10000;

// 是否启用遥测
let telemetryEnabled = true;

// 当前会话指标
let currentSession: SessionMetrics | null = null;

/**
 * 初始化遥测系统
 */
export function initTelemetry(enabled = true): void {
  telemetryEnabled = enabled;

  if (!enabled) return;

  // 创建目录
  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }

  // 初始化指标文件
  if (!fs.existsSync(METRICS_FILE)) {
    const initialMetrics: AggregateMetrics = {
      totalSessions: 0,
      totalMessages: 0,
      totalTokens: 0,
      totalCost: 0,
      toolUsage: {},
      modelUsage: {},
      averageSessionDuration: 0,
      lastUpdated: Date.now(),
    };
    fs.writeFileSync(METRICS_FILE, JSON.stringify(initialMetrics, null, 2));
  }
}

/**
 * 开始新会话
 */
export function startSession(sessionId: string, model: string): void {
  if (!telemetryEnabled) return;

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

/**
 * 结束会话
 */
export function endSession(): void {
  if (!telemetryEnabled || !currentSession) return;

  currentSession.endTime = Date.now();

  trackEvent('session_end', {
    duration: currentSession.endTime - currentSession.startTime,
    messageCount: currentSession.messageCount,
    tokenUsage: currentSession.tokenUsage,
    estimatedCost: currentSession.estimatedCost,
  });

  // 更新聚合指标
  updateAggregateMetrics();

  currentSession = null;
}

/**
 * 跟踪事件
 */
export function trackEvent(type: string, data: Record<string, unknown> = {}): void {
  if (!telemetryEnabled) return;

  const event: TelemetryEvent = {
    type,
    timestamp: Date.now(),
    sessionId: currentSession?.sessionId || 'unknown',
    data,
  };

  // 追加到事件文件
  try {
    fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n');

    // 限制事件文件大小
    trimEventsFile();
  } catch (err) {
    // 静默失败
  }
}

/**
 * 跟踪消息
 */
export function trackMessage(role: 'user' | 'assistant'): void {
  if (!telemetryEnabled || !currentSession) return;

  currentSession.messageCount++;
  trackEvent('message', { role });
}

/**
 * 跟踪工具调用
 */
export function trackToolCall(
  toolName: string,
  success: boolean,
  duration: number
): void {
  if (!telemetryEnabled || !currentSession) return;

  currentSession.toolCalls[toolName] = (currentSession.toolCalls[toolName] || 0) + 1;

  if (!success) {
    currentSession.errors++;
  }

  trackEvent('tool_call', { toolName, success, duration });
}

/**
 * 跟踪 token 使用
 */
export function trackTokenUsage(input: number, output: number, cost: number): void {
  if (!telemetryEnabled || !currentSession) return;

  currentSession.tokenUsage.input += input;
  currentSession.tokenUsage.output += output;
  currentSession.tokenUsage.total += input + output;
  currentSession.estimatedCost += cost;

  trackEvent('token_usage', { input, output, cost });
}

/**
 * 跟踪错误
 */
export function trackError(error: string, context?: Record<string, unknown>): void {
  if (!telemetryEnabled) return;

  if (currentSession) {
    currentSession.errors++;
  }

  trackEvent('error', { error, ...context });
}

/**
 * 更新聚合指标
 */
function updateAggregateMetrics(): void {
  if (!currentSession) return;

  try {
    let metrics: AggregateMetrics;

    if (fs.existsSync(METRICS_FILE)) {
      metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
    } else {
      metrics = {
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
        toolUsage: {},
        modelUsage: {},
        averageSessionDuration: 0,
        lastUpdated: Date.now(),
      };
    }

    // 更新指标
    metrics.totalSessions++;
    metrics.totalMessages += currentSession.messageCount;
    metrics.totalTokens += currentSession.tokenUsage.total;
    metrics.totalCost += currentSession.estimatedCost;

    // 工具使用
    for (const [tool, count] of Object.entries(currentSession.toolCalls)) {
      metrics.toolUsage[tool] = (metrics.toolUsage[tool] || 0) + count;
    }

    // 模型使用
    metrics.modelUsage[currentSession.model] =
      (metrics.modelUsage[currentSession.model] || 0) + 1;

    // 平均会话时长
    const sessionDuration =
      (currentSession.endTime || Date.now()) - currentSession.startTime;
    metrics.averageSessionDuration =
      (metrics.averageSessionDuration * (metrics.totalSessions - 1) + sessionDuration) /
      metrics.totalSessions;

    metrics.lastUpdated = Date.now();

    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (err) {
    // 静默失败
  }
}

/**
 * 限制事件文件大小
 */
function trimEventsFile(): void {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return;

    const content = fs.readFileSync(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length > MAX_EVENTS) {
      const trimmed = lines.slice(-MAX_EVENTS).join('\n') + '\n';
      fs.writeFileSync(EVENTS_FILE, trimmed);
    }
  } catch (err) {
    // 静默失败
  }
}

/**
 * 获取聚合指标
 */
export function getMetrics(): AggregateMetrics | null {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
    }
  } catch (err) {
    // 静默失败
  }
  return null;
}

/**
 * 获取当前会话指标
 */
export function getCurrentSessionMetrics(): SessionMetrics | null {
  return currentSession;
}

/**
 * 清除所有遥测数据
 */
export function clearTelemetryData(): void {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      fs.unlinkSync(METRICS_FILE);
    }
    if (fs.existsSync(EVENTS_FILE)) {
      fs.unlinkSync(EVENTS_FILE);
    }
  } catch (err) {
    // 静默失败
  }
}

/**
 * 禁用遥测
 */
export function disableTelemetry(): void {
  telemetryEnabled = false;
}

/**
 * 启用遥测
 */
export function enableTelemetry(): void {
  telemetryEnabled = true;
  initTelemetry();
}

/**
 * 检查遥测是否启用
 */
export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}
