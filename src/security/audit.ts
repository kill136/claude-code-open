/**
 * 审计日志系统
 * 记录所有安全相关事件，支持查询、过滤和合规报告
 *
 * 功能:
 * - 事件记录: 工具使用、权限检查、文件访问、网络请求等
 * - 日志存储: 持久化到 JSONL 文件，支持自动轮转
 * - 日志查询: 强大的搜索和过滤功能
 * - 合规报告: 生成审计报告（JSON、CSV、HTML格式）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';

// ============ 类型定义 ============

export type AuditEventType =
  | 'tool_use'          // 工具使用
  | 'permission'        // 权限检查
  | 'file_access'       // 文件访问
  | 'network'           // 网络请求
  | 'auth'              // 身份验证
  | 'config'            // 配置变更
  | 'session'           // 会话操作
  | 'error'             // 错误事件
  | 'security';         // 安全事件

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  actor: string;              // 执行者（用户ID或匿名ID）
  action: string;             // 具体操作
  resource?: string;          // 涉及的资源
  details?: Record<string, unknown>;  // 详细信息
  result: 'success' | 'failure' | 'denied';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  sessionId?: string;         // 会话ID
  duration?: number;          // 操作耗时（毫秒）
  ipAddress?: string;         // IP地址（如果适用）
  userAgent?: string;         // 用户代理（如果适用）
}

export interface AuditFilter {
  // 时间范围
  startTime?: Date;
  endTime?: Date;

  // 事件类型
  types?: AuditEventType[];

  // 结果筛选
  results?: Array<'success' | 'failure' | 'denied'>;

  // 执行者筛选
  actors?: string[];

  // 资源筛选（支持正则）
  resourcePattern?: string | RegExp;

  // 操作筛选
  actions?: string[];

  // 严重程度筛选
  severities?: Array<'low' | 'medium' | 'high' | 'critical'>;

  // 会话筛选
  sessionIds?: string[];

  // 文本搜索（搜索所有字段）
  search?: string;

  // 分页
  limit?: number;
  offset?: number;
}

export interface ReportOptions {
  format?: 'json' | 'csv' | 'html' | 'markdown';
  filter?: AuditFilter;
  includeStatistics?: boolean;
  groupBy?: 'type' | 'actor' | 'result' | 'severity' | 'date';
  outputPath?: string;
}

export interface AuditStatistics {
  totalEvents: number;
  byType: Record<AuditEventType, number>;
  byResult: Record<string, number>;
  bySeverity: Record<string, number>;
  uniqueActors: number;
  uniqueSessions: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  topActors: Array<{ actor: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  failureRate: number;
  denialRate: number;
}

export interface AuditOptions {
  enabled?: boolean;
  logDir?: string;
  logFile?: string;
  maxFileSize?: number;       // 单个日志文件最大大小（字节）
  maxFiles?: number;          // 最多保留的日志文件数
  rotationInterval?: number;  // 自动轮转间隔（毫秒）
  compression?: boolean;      // 是否压缩归档的日志
  anonymizeActors?: boolean;  // 是否匿名化执行者
  retention?: number;         // 日志保留天数（0=永久）
}

// ============ 默认配置 ============

const DEFAULT_OPTIONS: Required<AuditOptions> = {
  enabled: true,
  logDir: path.join(os.homedir(), '.claude', 'security'),
  logFile: 'audit.log',
  maxFileSize: 10 * 1024 * 1024,    // 10MB
  maxFiles: 10,
  rotationInterval: 0,               // 禁用自动轮转
  compression: false,
  anonymizeActors: false,
  retention: 90,                     // 90天
};

// ============ 审计日志管理器 ============

export class AuditLogger {
  private options: Required<AuditOptions>;
  private logPath: string;
  private rotationTimer?: NodeJS.Timeout;
  private writeQueue: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private currentActor: string = 'system';
  private currentSessionId?: string;

  constructor(options: AuditOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logPath = path.join(this.options.logDir, this.options.logFile);

    // 确保日志目录存在
    this.ensureLogDir();

    // 启动自动轮转（如果配置）
    if (this.options.rotationInterval > 0) {
      this.startRotationTimer();
    }

    // 启动自动刷新队列
    this.startFlushTimer();

    // 进程退出时清理
    this.registerCleanup();
  }

  // ============ 核心方法 ============

  /**
   * 记录审计事件
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    if (!this.options.enabled) return;

    // 生成完整事件
    const fullEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      actor: this.options.anonymizeActors
        ? this.anonymizeActor(event.actor)
        : event.actor,
      sessionId: event.sessionId || this.currentSessionId,
      ...event,
    };

    // 清洗敏感数据
    if (fullEvent.details) {
      fullEvent.details = this.sanitizeDetails(fullEvent.details) as Record<string, unknown>;
    }

    // 添加到写入队列
    this.writeQueue.push(fullEvent);

    // 如果队列过大，立即刷新
    if (this.writeQueue.length >= 100) {
      this.flush();
    }
  }

  /**
   * 记录工具使用
   */
  logToolUse(tool: string, params: unknown, result: 'success' | 'failure'): void {
    this.log({
      type: 'tool_use',
      actor: this.currentActor,
      action: `use_tool:${tool}`,
      resource: tool,
      details: {
        tool,
        params: this.sanitizeDetails(params),
        timestamp: new Date().toISOString(),
      },
      result,
      severity: result === 'failure' ? 'medium' : 'low',
    });
  }

  /**
   * 记录权限检查
   */
  logPermissionCheck(tool: string, allowed: boolean, reason?: string): void {
    this.log({
      type: 'permission',
      actor: this.currentActor,
      action: allowed ? 'permission_granted' : 'permission_denied',
      resource: tool,
      details: {
        tool,
        reason: reason || 'No reason provided',
      },
      result: allowed ? 'success' : 'denied',
      severity: allowed ? 'low' : 'medium',
    });
  }

  /**
   * 记录文件访问
   */
  logFileAccess(filePath: string, operation: 'read' | 'write' | 'delete' | 'execute', result: 'success' | 'failure' = 'success'): void {
    this.log({
      type: 'file_access',
      actor: this.currentActor,
      action: `file_${operation}`,
      resource: filePath,
      details: {
        path: filePath,
        operation,
        absolutePath: path.resolve(filePath),
      },
      result,
      severity: operation === 'delete' ? 'high' : operation === 'write' ? 'medium' : 'low',
    });
  }

  /**
   * 记录网络请求
   */
  logNetworkRequest(url: string, method: string, result: 'success' | 'failure' = 'success'): void {
    this.log({
      type: 'network',
      actor: this.currentActor,
      action: `network_${method.toLowerCase()}`,
      resource: url,
      details: {
        url,
        method,
        domain: this.extractDomain(url),
      },
      result,
      severity: 'medium',
    });
  }

  /**
   * 记录身份验证事件
   */
  logAuth(action: string, result: 'success' | 'failure', details?: Record<string, unknown>): void {
    this.log({
      type: 'auth',
      actor: this.currentActor,
      action,
      details,
      result,
      severity: result === 'failure' ? 'high' : 'low',
    });
  }

  /**
   * 记录配置变更
   */
  logConfigChange(key: string, oldValue: unknown, newValue: unknown): void {
    this.log({
      type: 'config',
      actor: this.currentActor,
      action: 'config_change',
      resource: key,
      details: {
        key,
        oldValue: this.sanitizeDetails(oldValue),
        newValue: this.sanitizeDetails(newValue),
      },
      result: 'success',
      severity: 'medium',
    });
  }

  /**
   * 记录会话操作
   */
  logSessionEvent(action: 'start' | 'end' | 'resume' | 'fork' | 'merge', sessionId: string, details?: Record<string, unknown>): void {
    this.log({
      type: 'session',
      actor: this.currentActor,
      action: `session_${action}`,
      resource: sessionId,
      sessionId,
      details,
      result: 'success',
      severity: 'low',
    });
  }

  /**
   * 记录错误事件
   */
  logError(error: string, details?: Record<string, unknown>): void {
    this.log({
      type: 'error',
      actor: this.currentActor,
      action: 'error_occurred',
      details: {
        error,
        ...details,
      },
      result: 'failure',
      severity: 'high',
    });
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(action: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, unknown>): void {
    this.log({
      type: 'security',
      actor: this.currentActor,
      action,
      details,
      result: 'success',
      severity,
    });
  }

  // ============ 查询方法 ============

  /**
   * 查询审计日志
   */
  async query(filter: AuditFilter = {}): Promise<AuditEvent[]> {
    // 先刷新队列
    this.flush();

    // 读取所有日志文件
    const events = await this.readAllLogs();

    // 应用过滤器
    return this.applyFilter(events, filter);
  }

  /**
   * 获取统计信息
   */
  async getStatistics(filter?: AuditFilter): Promise<AuditStatistics> {
    const events = await this.query(filter);

    if (events.length === 0) {
      return this.emptyStatistics();
    }

    const stats: AuditStatistics = {
      totalEvents: events.length,
      byType: {} as Record<AuditEventType, number>,
      byResult: {},
      bySeverity: {},
      uniqueActors: 0,
      uniqueSessions: 0,
      timeRange: {
        start: events[0].timestamp,
        end: events[events.length - 1].timestamp,
      },
      topActors: [],
      topActions: [],
      topResources: [],
      failureRate: 0,
      denialRate: 0,
    };

    // 统计计数器
    const actorCount = new Map<string, number>();
    const actionCount = new Map<string, number>();
    const resourceCount = new Map<string, number>();
    const actors = new Set<string>();
    const sessions = new Set<string>();

    let failures = 0;
    let denials = 0;

    for (const event of events) {
      // 按类型统计
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

      // 按结果统计
      stats.byResult[event.result] = (stats.byResult[event.result] || 0) + 1;
      if (event.result === 'failure') failures++;
      if (event.result === 'denied') denials++;

      // 按严重程度统计
      if (event.severity) {
        stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      }

      // 执行者统计
      actors.add(event.actor);
      actorCount.set(event.actor, (actorCount.get(event.actor) || 0) + 1);

      // 会话统计
      if (event.sessionId) {
        sessions.add(event.sessionId);
      }

      // 操作统计
      actionCount.set(event.action, (actionCount.get(event.action) || 0) + 1);

      // 资源统计
      if (event.resource) {
        resourceCount.set(event.resource, (resourceCount.get(event.resource) || 0) + 1);
      }

      // 时间范围
      if (event.timestamp < stats.timeRange.start) {
        stats.timeRange.start = event.timestamp;
      }
      if (event.timestamp > stats.timeRange.end) {
        stats.timeRange.end = event.timestamp;
      }
    }

    stats.uniqueActors = actors.size;
    stats.uniqueSessions = sessions.size;
    stats.failureRate = (failures / events.length) * 100;
    stats.denialRate = (denials / events.length) * 100;

    // Top 执行者
    stats.topActors = Array.from(actorCount.entries())
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 操作
    stats.topActions = Array.from(actionCount.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 资源
    stats.topResources = Array.from(resourceCount.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * 导出审计报告
   */
  async exportReport(options: ReportOptions = {}): Promise<string> {
    const {
      format = 'json',
      filter,
      includeStatistics = true,
      groupBy,
      outputPath,
    } = options;

    const events = await this.query(filter);
    const statistics = includeStatistics ? await this.getStatistics(filter) : undefined;

    let report: string;

    switch (format) {
      case 'json':
        report = this.generateJsonReport(events, statistics, groupBy);
        break;
      case 'csv':
        report = this.generateCsvReport(events);
        break;
      case 'html':
        report = this.generateHtmlReport(events, statistics, groupBy);
        break;
      case 'markdown':
        report = this.generateMarkdownReport(events, statistics, groupBy);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // 保存到文件（如果指定）
    if (outputPath) {
      fs.writeFileSync(outputPath, report, 'utf-8');
    }

    return report;
  }

  // ============ 日志轮转和清理 ============

  /**
   * 手动轮转日志
   */
  async rotate(): Promise<void> {
    if (!fs.existsSync(this.logPath)) {
      return;
    }

    // 刷新队列
    this.flush();

    const stats = fs.statSync(this.logPath);
    if (stats.size === 0) {
      return;
    }

    // 生成归档文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(
      this.options.logDir,
      `${path.basename(this.options.logFile, '.log')}.${timestamp}.log`
    );

    // 重命名当前日志
    fs.renameSync(this.logPath, archivePath);

    // 压缩（如果启用）
    if (this.options.compression) {
      await this.compressLog(archivePath);
    }

    // 清理旧日志
    await this.cleanupOldLogs();
  }

  /**
   * 清理过期日志
   */
  async cleanup(maxAge: number = this.options.retention): Promise<number> {
    if (maxAge === 0) return 0; // 永久保留

    const now = Date.now();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    const files = this.getLogFiles();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.options.logDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // ============ 配置方法 ============

  /**
   * 设置当前执行者
   */
  setActor(actor: string): void {
    this.currentActor = actor;
  }

  /**
   * 设置当前会话ID
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * 启用审计
   */
  enable(): void {
    this.options.enabled = true;
  }

  /**
   * 禁用审计
   */
  disable(): void {
    this.options.enabled = false;
    this.flush();
  }

  /**
   * 获取配置
   */
  getOptions(): Readonly<Required<AuditOptions>> {
    return { ...this.options };
  }

  /**
   * 清空所有日志
   */
  async clear(): Promise<void> {
    this.writeQueue = [];
    const files = this.getLogFiles();
    for (const file of files) {
      fs.unlinkSync(path.join(this.options.logDir, file));
    }
  }

  // ============ 私有方法 ============

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * 匿名化执行者
   */
  private anonymizeActor(actor: string): string {
    const hash = createHash('sha256').update(actor).digest('hex');
    return `anon_${hash.substring(0, 16)}`;
  }

  /**
   * 清洗敏感数据
   */
  private sanitizeDetails(data: unknown): unknown {
    if (typeof data === 'string') {
      // 移除可能的敏感信息
      return data
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
        .replace(/\bsk-[a-zA-Z0-9]{32,}\b/g, '[API_KEY]')
        .replace(/\bpassword["\s:=]+[^\s"]+/gi, 'password=[REDACTED]')
        .replace(/\btoken["\s:=]+[^\s"]+/gi, 'token=[REDACTED]');
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeDetails(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key') && key !== 'key' // 避免误删普通的 'key' 字段
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeDetails(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * 刷新写入队列
   */
  private flush(): void {
    if (this.writeQueue.length === 0) return;

    const events = [...this.writeQueue];
    this.writeQueue = [];

    // 写入日志文件（JSONL格式）
    const lines = events.map(event => this.serializeEvent(event)).join('\n') + '\n';

    try {
      fs.appendFileSync(this.logPath, lines, 'utf-8');

      // 检查文件大小，必要时轮转
      const stats = fs.statSync(this.logPath);
      if (stats.size >= this.options.maxFileSize) {
        this.rotate().catch(err => {
          console.error('Failed to rotate audit log:', err);
        });
      }
    } catch (err) {
      console.error('Failed to write audit log:', err);
      // 将事件放回队列
      this.writeQueue.unshift(...events);
    }
  }

  /**
   * 序列化事件
   */
  private serializeEvent(event: AuditEvent): string {
    return JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * 反序列化事件
   */
  private deserializeEvent(line: string): AuditEvent | null {
    try {
      const data = JSON.parse(line);
      return {
        ...data,
        timestamp: new Date(data.timestamp),
      };
    } catch {
      return null;
    }
  }

  /**
   * 读取所有日志文件
   */
  private async readAllLogs(): Promise<AuditEvent[]> {
    const files = this.getLogFiles();
    const events: AuditEvent[] = [];

    for (const file of files) {
      const filePath = path.join(this.options.logDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const event = this.deserializeEvent(line);
        if (event) {
          events.push(event);
        }
      }
    }

    // 按时间戳排序
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }

  /**
   * 获取所有日志文件
   */
  private getLogFiles(): string[] {
    if (!fs.existsSync(this.options.logDir)) {
      return [];
    }

    return fs
      .readdirSync(this.options.logDir)
      .filter(file => file.endsWith('.log'))
      .sort();
  }

  /**
   * 应用过滤器
   */
  private applyFilter(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
    let filtered = events;

    // 时间范围
    if (filter.startTime) {
      filtered = filtered.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      filtered = filtered.filter(e => e.timestamp <= filter.endTime!);
    }

    // 事件类型
    if (filter.types?.length) {
      filtered = filtered.filter(e => filter.types!.includes(e.type));
    }

    // 结果
    if (filter.results?.length) {
      filtered = filtered.filter(e => filter.results!.includes(e.result));
    }

    // 执行者
    if (filter.actors?.length) {
      filtered = filtered.filter(e => filter.actors!.includes(e.actor));
    }

    // 资源模式
    if (filter.resourcePattern) {
      const pattern = typeof filter.resourcePattern === 'string'
        ? new RegExp(filter.resourcePattern)
        : filter.resourcePattern;
      filtered = filtered.filter(e => e.resource && pattern.test(e.resource));
    }

    // 操作
    if (filter.actions?.length) {
      filtered = filtered.filter(e => filter.actions!.includes(e.action));
    }

    // 严重程度
    if (filter.severities?.length) {
      filtered = filtered.filter(e => e.severity && filter.severities!.includes(e.severity));
    }

    // 会话
    if (filter.sessionIds?.length) {
      filtered = filtered.filter(e => e.sessionId && filter.sessionIds!.includes(e.sessionId));
    }

    // 文本搜索
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(e => {
        const searchableText = JSON.stringify(e).toLowerCase();
        return searchableText.includes(searchLower);
      });
    }

    // 分页
    if (filter.offset !== undefined) {
      filtered = filtered.slice(filter.offset);
    }
    if (filter.limit !== undefined) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * 生成空统计
   */
  private emptyStatistics(): AuditStatistics {
    return {
      totalEvents: 0,
      byType: {} as Record<AuditEventType, number>,
      byResult: {},
      bySeverity: {},
      uniqueActors: 0,
      uniqueSessions: 0,
      timeRange: {
        start: new Date(),
        end: new Date(),
      },
      topActors: [],
      topActions: [],
      topResources: [],
      failureRate: 0,
      denialRate: 0,
    };
  }

  /**
   * 生成 JSON 报告
   */
  private generateJsonReport(
    events: AuditEvent[],
    statistics?: AuditStatistics,
    groupBy?: string
  ): string {
    const report: {
      events: AuditEvent[] | Record<string, AuditEvent[]>;
      statistics?: AuditStatistics;
      metadata: {
        generatedAt: string;
        totalEvents: number;
        groupBy?: string;
      };
    } = {
      events: groupBy ? this.groupEvents(events, groupBy) : events,
      statistics,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalEvents: events.length,
        groupBy,
      },
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * 生成 CSV 报告
   */
  private generateCsvReport(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'Type',
      'Actor',
      'Action',
      'Resource',
      'Result',
      'Severity',
      'Session ID',
      'Duration',
    ];

    const rows = events.map(e => [
      e.id,
      e.timestamp.toISOString(),
      e.type,
      e.actor,
      e.action,
      e.resource || '',
      e.result,
      e.severity || '',
      e.sessionId || '',
      e.duration?.toString() || '',
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * 生成 HTML 报告
   */
  private generateHtmlReport(
    events: AuditEvent[],
    statistics?: AuditStatistics,
    groupBy?: string
  ): string {
    const grouped = groupBy ? this.groupEvents(events, groupBy) : null;

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1, h2 { color: #333; }
    table { width: 100%; border-collapse: collapse; background: white; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #4CAF50; color: white; }
    tr:hover { background: #f5f5f5; }
    .success { color: #4CAF50; }
    .failure { color: #f44336; }
    .denied { color: #ff9800; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #4CAF50; }
  </style>
</head>
<body>
  <h1>Security Audit Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Total Events: ${events.length}</p>
`;

    // 统计信息
    if (statistics) {
      html += `
  <h2>Statistics</h2>
  <div class="stats">
    <div class="stat-card">
      <h3>Total Events</h3>
      <div class="value">${statistics.totalEvents}</div>
    </div>
    <div class="stat-card">
      <h3>Unique Actors</h3>
      <div class="value">${statistics.uniqueActors}</div>
    </div>
    <div class="stat-card">
      <h3>Failure Rate</h3>
      <div class="value">${statistics.failureRate.toFixed(2)}%</div>
    </div>
    <div class="stat-card">
      <h3>Denial Rate</h3>
      <div class="value">${statistics.denialRate.toFixed(2)}%</div>
    </div>
  </div>
`;
    }

    // 事件表格
    html += `
  <h2>Events</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Actor</th>
        <th>Action</th>
        <th>Resource</th>
        <th>Result</th>
        <th>Severity</th>
      </tr>
    </thead>
    <tbody>
`;

    for (const event of events) {
      html += `
      <tr>
        <td>${event.timestamp.toISOString()}</td>
        <td>${event.type}</td>
        <td>${event.actor}</td>
        <td>${event.action}</td>
        <td>${event.resource || '-'}</td>
        <td class="${event.result}">${event.result}</td>
        <td>${event.severity || '-'}</td>
      </tr>
`;
    }

    html += `
    </tbody>
  </table>
</body>
</html>
`;

    return html;
  }

  /**
   * 生成 Markdown 报告
   */
  private generateMarkdownReport(
    events: AuditEvent[],
    statistics?: AuditStatistics,
    groupBy?: string
  ): string {
    let md = `# Security Audit Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Total Events:** ${events.length}\n\n`;

    // 统计信息
    if (statistics) {
      md += `## Statistics\n\n`;
      md += `- **Total Events:** ${statistics.totalEvents}\n`;
      md += `- **Unique Actors:** ${statistics.uniqueActors}\n`;
      md += `- **Unique Sessions:** ${statistics.uniqueSessions}\n`;
      md += `- **Failure Rate:** ${statistics.failureRate.toFixed(2)}%\n`;
      md += `- **Denial Rate:** ${statistics.denialRate.toFixed(2)}%\n\n`;

      md += `### Top Actors\n\n`;
      md += `| Actor | Count |\n`;
      md += `|-------|-------|\n`;
      for (const { actor, count } of statistics.topActors.slice(0, 5)) {
        md += `| ${actor} | ${count} |\n`;
      }
      md += `\n`;

      md += `### Top Actions\n\n`;
      md += `| Action | Count |\n`;
      md += `|--------|-------|\n`;
      for (const { action, count } of statistics.topActions.slice(0, 5)) {
        md += `| ${action} | ${count} |\n`;
      }
      md += `\n`;
    }

    // 事件列表
    md += `## Events\n\n`;
    md += `| Timestamp | Type | Actor | Action | Resource | Result | Severity |\n`;
    md += `|-----------|------|-------|--------|----------|--------|----------|\n`;

    for (const event of events.slice(0, 100)) { // 限制显示数量
      md += `| ${event.timestamp.toISOString()} | ${event.type} | ${event.actor} | ${event.action} | ${event.resource || '-'} | ${event.result} | ${event.severity || '-'} |\n`;
    }

    if (events.length > 100) {
      md += `\n*Showing first 100 events out of ${events.length} total*\n`;
    }

    return md;
  }

  /**
   * 分组事件
   */
  private groupEvents(events: AuditEvent[], groupBy: string): Record<string, AuditEvent[]> {
    const groups: Record<string, AuditEvent[]> = {};

    for (const event of events) {
      let key: string;

      switch (groupBy) {
        case 'type':
          key = event.type;
          break;
        case 'actor':
          key = event.actor;
          break;
        case 'result':
          key = event.result;
          break;
        case 'severity':
          key = event.severity || 'none';
          break;
        case 'date':
          key = event.timestamp.toISOString().split('T')[0];
          break;
        default:
          key = 'ungrouped';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    }

    return groups;
  }

  /**
   * 清理旧日志
   */
  private async cleanupOldLogs(): Promise<void> {
    const files = this.getLogFiles();

    // 按时间排序（最新的在前）
    const sortedFiles = files
      .map(file => ({
        file,
        path: path.join(this.options.logDir, file),
        mtime: fs.statSync(path.join(this.options.logDir, file)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // 保留最新的 N 个文件
    const filesToDelete = sortedFiles.slice(this.options.maxFiles);

    for (const { path: filePath } of filesToDelete) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete old log file ${filePath}:`, err);
      }
    }
  }

  /**
   * 压缩日志（占位符 - 实际实现需要 zlib）
   */
  private async compressLog(filePath: string): Promise<void> {
    // TODO: 实现日志压缩
    // 可以使用 zlib.gzip 或第三方库
    console.log(`Log compression not implemented: ${filePath}`);
  }

  /**
   * 启动自动轮转定时器
   */
  private startRotationTimer(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(() => {
      this.rotate().catch(err => {
        console.error('Auto-rotation failed:', err);
      });
    }, this.options.rotationInterval);
  }

  /**
   * 启动自动刷新定时器
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 每5秒刷新一次队列
    this.flushTimer = setInterval(() => {
      this.flush();
    }, 5000);
  }

  /**
   * 注册清理函数
   */
  private registerCleanup(): void {
    const cleanup = () => {
      this.flush();
      if (this.rotationTimer) clearInterval(this.rotationTimer);
      if (this.flushTimer) clearInterval(this.flushTimer);
    };

    process.on('beforeExit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// ============ 全局实例 ============

let globalLogger: AuditLogger | null = null;

/**
 * 获取全局审计日志实例
 */
export function getAuditLogger(options?: AuditOptions): AuditLogger {
  if (!globalLogger) {
    globalLogger = new AuditLogger(options);
  }
  return globalLogger;
}

/**
 * 初始化全局审计日志
 */
export function initAuditLogger(options?: AuditOptions): AuditLogger {
  globalLogger = new AuditLogger(options);
  return globalLogger;
}

// 默认导出
export default AuditLogger;
