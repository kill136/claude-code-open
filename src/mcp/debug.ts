/**
 * MCP 调试和日志系统
 * 提供完整的 MCP 消息追踪、日志记录和性能分析功能
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============ 类型定义 ============

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  serverName?: string;
  requestId?: string;
}

export interface DebugOptions {
  enabled: boolean;
  level: LogLevel;
  logToFile?: string;
  logToConsole?: boolean;
  filterServers?: string[];
  filterMethods?: string[];
  maskSecrets?: boolean;
  maxMessageSize?: number;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

export interface TimelineEntry {
  timestamp: number;
  type: 'request' | 'response' | 'error';
  message: string;
  data?: unknown;
}

export interface PerformanceStats {
  totalRequests: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  requestsByMethod: Map<string, number>;
  durationsByMethod: Map<string, number[]>;
}

export interface LogFilter {
  level?: LogLevel;
  category?: string;
  serverName?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface FormatOptions {
  colors?: boolean;
  indent?: number;
  maxDepth?: number;
  includeMetadata?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AnalysisResult {
  totalMessages: number;
  requestCount: number;
  responseCount: number;
  errorCount: number;
  methodFrequency: Map<string, number>;
  averageResponseTime?: number;
  errors: Array<{ message: string; count: number }>;
}

export interface McpConnection {
  serverName: string;
  connected: boolean;
  uptime: number;
  messageCount: number;
  errorCount: number;
}

export interface McpMiddleware {
  name: string;
  onRequest?: (serverName: string, request: JsonRpcRequest) => void | Promise<void>;
  onResponse?: (serverName: string, response: JsonRpcResponse, duration: number) => void | Promise<void>;
  onError?: (serverName: string, error: Error) => void | Promise<void>;
}

// ============ 常量 ============

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /bearer/i,
  /credential/i,
];

const DEFAULT_MAX_MESSAGE_SIZE = 10000;

// ============ 辅助函数 ============

/**
 * 屏蔽敏感信息
 */
export function maskSecrets(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // 检查是否包含敏感关键词
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(data)) {
        return '***REDACTED***';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSecrets(item));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // 检查键名是否包含敏感关键词
      const shouldMask = SECRET_PATTERNS.some(pattern => pattern.test(key));
      result[key] = shouldMask ? '***REDACTED***' : maskSecrets(value);
    }
    return result;
  }

  return data;
}

/**
 * 截断过大的消息
 */
function truncateMessage(data: unknown, maxSize: number): unknown {
  const str = JSON.stringify(data);
  if (str.length <= maxSize) {
    return data;
  }

  return {
    _truncated: true,
    _originalSize: str.length,
    _preview: str.substring(0, maxSize),
  };
}

/**
 * 格式化时间戳
 */
function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ McpDebugger 类 ============

export class McpDebugger {
  private options: DebugOptions;
  private logs: LogEntry[] = [];
  private timers: Map<string, number> = new Map();
  private requestTimelines: Map<string, TimelineEntry[]> = new Map();
  private performanceData: Array<{ method: string; duration: number }> = [];
  private fileHandle?: string;

  constructor(options?: Partial<DebugOptions>) {
    this.options = {
      enabled: options?.enabled ?? false,
      level: options?.level ?? 'debug',
      logToFile: options?.logToFile,
      logToConsole: options?.logToConsole ?? true,
      filterServers: options?.filterServers,
      filterMethods: options?.filterMethods,
      maskSecrets: options?.maskSecrets ?? true,
      maxMessageSize: options?.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
    };

    if (this.options.logToFile) {
      this.initFileLogging();
    }
  }

  /**
   * 初始化文件日志
   */
  private initFileLogging(): void {
    if (!this.options.logToFile) return;

    try {
      const logDir = join(homedir(), '.claude', 'mcp-logs');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }

      this.fileHandle = this.options.logToFile.startsWith('/')
        ? this.options.logToFile
        : join(logDir, this.options.logToFile);

      // 写入日志头
      const header = `=== MCP Debug Log Started at ${new Date().toISOString()} ===\n`;
      writeFileSync(this.fileHandle, header);
    } catch (err) {
      console.error('Failed to initialize file logging:', err);
    }
  }

  /**
   * 写入日志
   */
  private writeLog(entry: LogEntry): void {
    if (!this.options.enabled) return;

    // 检查日志级别
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.options.level]) {
      return;
    }

    // 检查服务器过滤
    if (this.options.filterServers && entry.serverName) {
      if (!this.options.filterServers.includes(entry.serverName)) {
        return;
      }
    }

    this.logs.push(entry);

    // 输出到控制台
    if (this.options.logToConsole) {
      this.logToConsole(entry);
    }

    // 输出到文件
    if (this.fileHandle) {
      this.logToFile(entry);
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = formatTimestamp(entry.timestamp);
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const message = entry.serverName
      ? `${prefix} [${entry.serverName}] ${entry.message}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'error':
        console.error(message, entry.data || '');
        break;
      case 'warn':
        console.warn(message, entry.data || '');
        break;
      case 'info':
        console.info(message, entry.data || '');
        break;
      case 'debug':
      default:
        console.log(message, entry.data || '');
        break;
    }
  }

  /**
   * 输出到文件
   */
  private logToFile(entry: LogEntry): void {
    if (!this.fileHandle) return;

    try {
      const timestamp = formatTimestamp(entry.timestamp);
      const level = entry.level.toUpperCase().padEnd(5);
      const category = entry.category.padEnd(15);
      const serverName = entry.serverName ? `[${entry.serverName}]`.padEnd(20) : ''.padEnd(20);

      let line = `${timestamp} ${level} ${category} ${serverName} ${entry.message}\n`;

      if (entry.data) {
        const dataStr = typeof entry.data === 'string'
          ? entry.data
          : JSON.stringify(entry.data, null, 2);
        line += `  Data: ${dataStr}\n`;
      }

      appendFileSync(this.fileHandle, line);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  /**
   * 调试日志
   */
  debug(category: string, message: string, data?: unknown): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'debug',
      category,
      message,
      data,
    });
  }

  /**
   * 信息日志
   */
  info(category: string, message: string, data?: unknown): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'info',
      category,
      message,
      data,
    });
  }

  /**
   * 警告日志
   */
  warn(category: string, message: string, data?: unknown): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'warn',
      category,
      message,
      data,
    });
  }

  /**
   * 错误日志
   */
  error(category: string, message: string, data?: unknown): void {
    this.writeLog({
      timestamp: new Date(),
      level: 'error',
      category,
      message,
      data,
    });
  }

  /**
   * 追踪请求
   */
  traceRequest(serverName: string, request: JsonRpcRequest): void {
    if (!this.options.enabled) return;

    // 检查方法过滤
    if (this.options.filterMethods && !this.options.filterMethods.includes(request.method)) {
      return;
    }

    const requestId = request.id?.toString() || generateRequestId();

    // 处理消息
    let processedRequest = request;
    if (this.options.maskSecrets) {
      processedRequest = maskSecrets(request) as JsonRpcRequest;
    }
    if (this.options.maxMessageSize) {
      processedRequest = truncateMessage(processedRequest, this.options.maxMessageSize) as JsonRpcRequest;
    }

    // 记录日志
    this.writeLog({
      timestamp: new Date(),
      level: 'debug',
      category: 'MCP_REQUEST',
      message: `${request.method}`,
      data: processedRequest,
      serverName,
      requestId,
    });

    // 添加到时间线
    if (!this.requestTimelines.has(requestId)) {
      this.requestTimelines.set(requestId, []);
    }
    this.requestTimelines.get(requestId)!.push({
      timestamp: Date.now(),
      type: 'request',
      message: `Request: ${request.method}`,
      data: processedRequest,
    });
  }

  /**
   * 追踪响应
   */
  traceResponse(serverName: string, response: JsonRpcResponse, duration: number): void {
    if (!this.options.enabled) return;

    const requestId = response.id?.toString() || 'unknown';

    // 处理消息
    let processedResponse = response;
    if (this.options.maskSecrets) {
      processedResponse = maskSecrets(response) as JsonRpcResponse;
    }
    if (this.options.maxMessageSize) {
      processedResponse = truncateMessage(processedResponse, this.options.maxMessageSize) as JsonRpcResponse;
    }

    // 记录日志
    this.writeLog({
      timestamp: new Date(),
      level: response.error ? 'error' : 'debug',
      category: 'MCP_RESPONSE',
      message: `Response in ${duration}ms`,
      data: processedResponse,
      serverName,
      requestId,
    });

    // 添加到时间线
    const timeline = this.requestTimelines.get(requestId);
    if (timeline) {
      timeline.push({
        timestamp: Date.now(),
        type: 'response',
        message: `Response in ${duration}ms`,
        data: processedResponse,
      });
    }

    // 记录性能数据
    // 从时间线中查找对应的请求方法
    const requestEntry = timeline?.find(e => e.type === 'request');
    if (requestEntry && typeof requestEntry.data === 'object' && requestEntry.data !== null) {
      const method = (requestEntry.data as JsonRpcRequest).method;
      this.performanceData.push({ method, duration });
    }
  }

  /**
   * 追踪错误
   */
  traceError(serverName: string, error: Error): void {
    if (!this.options.enabled) return;

    this.writeLog({
      timestamp: new Date(),
      level: 'error',
      category: 'MCP_ERROR',
      message: error.message,
      data: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      serverName,
    });
  }

  /**
   * 检查消息
   */
  inspectMessage(message: JsonRpcMessage): string {
    const inspector = new McpMessageInspector();
    return inspector.format(message, { colors: false, indent: 2 });
  }

  /**
   * 检查连接
   */
  inspectConnection(connection: McpConnection): string {
    const uptime = connection.uptime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    return [
      `Server: ${connection.serverName}`,
      `Status: ${connection.connected ? 'Connected' : 'Disconnected'}`,
      `Uptime: ${hours}h ${minutes}m ${seconds}s`,
      `Messages: ${connection.messageCount}`,
      `Errors: ${connection.errorCount}`,
    ].join('\n');
  }

  /**
   * 获取请求时间线
   */
  getRequestTimeline(requestId: string): TimelineEntry[] {
    return this.requestTimelines.get(requestId) || [];
  }

  /**
   * 启动计时器
   */
  startTimer(label: string): () => number {
    const startTime = Date.now();
    this.timers.set(label, startTime);

    return (): number => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timers.delete(label);

      this.debug('TIMER', `${label}: ${duration}ms`);
      return duration;
    };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): PerformanceStats {
    if (this.performanceData.length === 0) {
      return {
        totalRequests: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        requestsByMethod: new Map(),
        durationsByMethod: new Map(),
      };
    }

    const durations = this.performanceData.map(d => d.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const requestsByMethod = new Map<string, number>();
    const durationsByMethod = new Map<string, number[]>();

    for (const { method, duration } of this.performanceData) {
      requestsByMethod.set(method, (requestsByMethod.get(method) || 0) + 1);

      if (!durationsByMethod.has(method)) {
        durationsByMethod.set(method, []);
      }
      durationsByMethod.get(method)!.push(duration);
    }

    return {
      totalRequests: this.performanceData.length,
      totalDuration,
      averageDuration: totalDuration / this.performanceData.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      requestsByMethod,
      durationsByMethod,
    };
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * 启用调试
   */
  enable(): void {
    this.options.enabled = true;
  }

  /**
   * 禁用调试
   */
  disable(): void {
    this.options.enabled = false;
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
    this.requestTimelines.clear();
    this.performanceData = [];
  }

  /**
   * 获取日志
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level) {
        const minLevel = LOG_LEVELS[filter.level];
        filtered = filtered.filter(log => LOG_LEVELS[log.level] >= minLevel);
      }

      if (filter.category) {
        filtered = filtered.filter(log => log.category === filter.category);
      }

      if (filter.serverName) {
        filtered = filtered.filter(log => log.serverName === filter.serverName);
      }

      if (filter.startTime) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * 导出日志
   */
  exportLogs(format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    return this.logs.map(log => {
      const timestamp = formatTimestamp(log.timestamp);
      const level = log.level.toUpperCase().padEnd(5);
      const category = log.category.padEnd(15);
      const server = log.serverName ? `[${log.serverName}]` : '';
      const data = log.data ? `\n  ${JSON.stringify(log.data, null, 2)}` : '';

      return `${timestamp} ${level} ${category} ${server} ${log.message}${data}`;
    }).join('\n');
  }
}

// ============ McpMessageInspector 类 ============

export class McpMessageInspector {
  constructor() {}

  /**
   * 格式化消息
   */
  format(message: JsonRpcMessage, options?: FormatOptions): string {
    const opts = {
      colors: options?.colors ?? false,
      indent: options?.indent ?? 2,
      maxDepth: options?.maxDepth ?? 10,
      includeMetadata: options?.includeMetadata ?? true,
    };

    const lines: string[] = [];

    // 添加元数据
    if (opts.includeMetadata) {
      lines.push('=== JSON-RPC Message ===');
      lines.push(`Version: ${message.jsonrpc}`);

      if ('id' in message && message.id !== undefined) {
        lines.push(`ID: ${message.id}`);
      }

      if ('method' in message) {
        lines.push(`Type: Request`);
        lines.push(`Method: ${message.method}`);
      } else if ('result' in message || 'error' in message) {
        lines.push(`Type: Response`);
      }

      lines.push('');
    }

    // 格式化内容
    lines.push(JSON.stringify(message, null, opts.indent));

    return lines.join('\n');
  }

  /**
   * 比较两个消息
   */
  diff(message1: JsonRpcMessage, message2: JsonRpcMessage): string {
    const str1 = JSON.stringify(message1, null, 2);
    const str2 = JSON.stringify(message2, null, 2);

    if (str1 === str2) {
      return 'Messages are identical';
    }

    const lines1 = str1.split('\n');
    const lines2 = str2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    const diff: string[] = ['=== Message Diff ===', ''];

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 !== line2) {
        diff.push(`Line ${i + 1}:`);
        diff.push(`< ${line1}`);
        diff.push(`> ${line2}`);
        diff.push('');
      }
    }

    return diff.join('\n');
  }

  /**
   * 验证消息
   */
  validate(message: JsonRpcMessage): ValidationResult {
    const errors: string[] = [];

    // 检查 jsonrpc 版本
    if (message.jsonrpc !== '2.0') {
      errors.push('Invalid jsonrpc version (must be "2.0")');
    }

    // 检查请求消息
    if ('method' in message) {
      if (!message.method || typeof message.method !== 'string') {
        errors.push('Request must have a valid method string');
      }
    }

    // 检查响应消息
    if (!('method' in message)) {
      if (!('result' in message) && !('error' in message)) {
        errors.push('Response must have either result or error');
      }

      if ('result' in message && 'error' in message) {
        errors.push('Response cannot have both result and error');
      }
    }

    // 检查错误格式
    if ('error' in message && message.error) {
      if (typeof message.error !== 'object') {
        errors.push('Error must be an object');
      } else {
        if (typeof message.error.code !== 'number') {
          errors.push('Error code must be a number');
        }
        if (typeof message.error.message !== 'string') {
          errors.push('Error message must be a string');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 分析消息集合
   */
  analyze(messages: JsonRpcMessage[]): AnalysisResult {
    const methodFrequency = new Map<string, number>();
    const errors: Map<string, number> = new Map();
    let requestCount = 0;
    let responseCount = 0;
    let errorCount = 0;
    const responseTimes: number[] = [];

    // 创建请求-响应映射
    const requestMap = new Map<string | number, { method: string; timestamp: number }>();

    for (const message of messages) {
      if ('method' in message) {
        // 请求消息
        requestCount++;
        methodFrequency.set(message.method, (methodFrequency.get(message.method) || 0) + 1);

        if (message.id !== undefined) {
          requestMap.set(message.id, {
            method: message.method,
            timestamp: Date.now(),
          });
        }
      } else {
        // 响应消息
        responseCount++;

        if ('error' in message && message.error) {
          errorCount++;
          const errorMsg = message.error.message;
          errors.set(errorMsg, (errors.get(errorMsg) || 0) + 1);
        }

        // 计算响应时间（如果有对应的请求）
        if (message.id !== undefined) {
          const request = requestMap.get(message.id);
          if (request) {
            const duration = Date.now() - request.timestamp;
            responseTimes.push(duration);
          }
        }
      }
    }

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : undefined;

    return {
      totalMessages: messages.length,
      requestCount,
      responseCount,
      errorCount,
      methodFrequency,
      averageResponseTime,
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
    };
  }
}

// ============ 中间件支持 ============

/**
 * 创建调试中间件
 */
export function createDebugMiddleware(mcpDebugger: McpDebugger): McpMiddleware {
  return {
    name: 'debug-middleware',

    onRequest: (serverName: string, request: JsonRpcRequest) => {
      mcpDebugger.traceRequest(serverName, request);
    },

    onResponse: (serverName: string, response: JsonRpcResponse, duration: number) => {
      mcpDebugger.traceResponse(serverName, response, duration);
    },

    onError: (serverName: string, error: Error) => {
      mcpDebugger.traceError(serverName, error);
    },
  };
}

/**
 * 创建默认调试器实例
 */
let defaultDebugger: McpDebugger | null = null;

export function getDefaultDebugger(): McpDebugger {
  if (!defaultDebugger) {
    defaultDebugger = new McpDebugger({
      enabled: process.env.MCP_DEBUG === 'true' || process.argv.includes('--mcp-debug'),
      level: 'debug',
      logToConsole: true,
      maskSecrets: true,
    });
  }
  return defaultDebugger;
}

export function setDefaultDebugger(mcpDebugger: McpDebugger): void {
  defaultDebugger = mcpDebugger;
}
