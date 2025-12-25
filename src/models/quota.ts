/**
 * 配额管理和成本预警系统
 * 提供使用限制、成本预警和事件通知功能
 */

import { modelStats } from './stats.js';
import { modelConfig } from './config.js';
import type {
  QuotaType,
  AlertLevel,
  CostAlert,
  QuotaLimit,
  UsageInfo,
  BudgetStatus,
  ThresholdCallback,
  LimitExceededCallback,
} from './types.js';

/**
 * 配额管理器
 */
export class QuotaManager {
  private limits: QuotaLimit = {};
  private alerts: CostAlert[] = [];
  private triggeredAlerts: Set<string> = new Set();
  private thresholdCallbacks: ThresholdCallback[] = [];
  private limitExceededCallbacks: LimitExceededCallback[] = [];
  private enabled: boolean = false;

  /**
   * 设置配额限制
   */
  setLimit(type: QuotaType, limit: number): void {
    if (limit < 0) {
      throw new Error(`Limit must be non-negative, got ${limit}`);
    }

    switch (type) {
      case 'cost':
        this.limits.maxCost = limit;
        break;
      case 'tokens':
        this.limits.maxTokens = limit;
        break;
      case 'requests':
        this.limits.maxRequests = limit;
        break;
    }

    // 设置限制后自动启用配额管理
    this.enabled = true;

    // 清除已触发的预警（允许重新触发）
    this.triggeredAlerts.clear();

    // 自动设置默认预警
    this.setupDefaultAlerts(type, limit);
  }

  /**
   * 设置自动预警阈值
   */
  private setupDefaultAlerts(type: QuotaType, limit: number): void {
    // 清除该类型的现有预警
    this.alerts = this.alerts.filter(
      (alert) => !alert.message.includes(this.getTypeName(type))
    );

    const typeName = this.getTypeName(type);
    const formatter = type === 'cost' ? (v: number) => `$${v.toFixed(2)}` : (v: number) => v.toLocaleString();

    // 50% - 信息提示
    this.alerts.push({
      threshold: limit * 0.5,
      action: 'warn',
      level: 'info',
      message: `${typeName} usage reached 50% (${formatter(limit * 0.5)} of ${formatter(limit)})`,
    });

    // 80% - 警告
    this.alerts.push({
      threshold: limit * 0.8,
      action: 'warn',
      level: 'warning',
      message: `${typeName} usage reached 80% (${formatter(limit * 0.8)} of ${formatter(limit)})`,
    });

    // 95% - 严重警告
    this.alerts.push({
      threshold: limit * 0.95,
      action: 'pause',
      level: 'critical',
      message: `${typeName} usage reached 95% (${formatter(limit * 0.95)} of ${formatter(limit)}). Consider pausing.`,
    });

    // 100% - 超出限制
    this.alerts.push({
      threshold: limit,
      action: 'stop',
      level: 'exceeded',
      message: `${typeName} limit exceeded! Reached ${formatter(limit)}.`,
    });
  }

  /**
   * 获取类型名称
   */
  private getTypeName(type: QuotaType): string {
    switch (type) {
      case 'cost':
        return 'Cost';
      case 'tokens':
        return 'Token';
      case 'requests':
        return 'Request';
    }
  }

  /**
   * 获取当前使用情况
   */
  getCurrentUsage(): UsageInfo {
    const stats = modelStats.getGlobal();

    return {
      currentCost: stats.costUSD,
      currentTokens: modelStats.getTotalTokens(),
      currentRequests: stats.apiCalls,
      maxCost: this.limits.maxCost,
      maxTokens: this.limits.maxTokens,
      maxRequests: this.limits.maxRequests,
    };
  }

  /**
   * 检查是否超出限制
   */
  checkLimit(): {
    withinLimit: boolean;
    exceeded: QuotaType[];
    warnings: CostAlert[];
  } {
    if (!this.enabled) {
      return { withinLimit: true, exceeded: [], warnings: [] };
    }

    const usage = this.getCurrentUsage();
    const exceeded: QuotaType[] = [];
    const warnings: CostAlert[] = [];

    // 检查成本限制
    if (this.limits.maxCost !== undefined) {
      const status = this.getBudgetStatus('cost');
      this.checkThresholds('cost', usage.currentCost, this.limits.maxCost, warnings);

      if (status.exceeded) {
        exceeded.push('cost');
        this.notifyLimitExceeded('cost', status);
      }
    }

    // 检查 Token 限制
    if (this.limits.maxTokens !== undefined) {
      const status = this.getBudgetStatus('tokens');
      this.checkThresholds('tokens', usage.currentTokens, this.limits.maxTokens, warnings);

      if (status.exceeded) {
        exceeded.push('tokens');
        this.notifyLimitExceeded('tokens', status);
      }
    }

    // 检查请求次数限制
    if (this.limits.maxRequests !== undefined) {
      const status = this.getBudgetStatus('requests');
      this.checkThresholds('requests', usage.currentRequests, this.limits.maxRequests, warnings);

      if (status.exceeded) {
        exceeded.push('requests');
        this.notifyLimitExceeded('requests', status);
      }
    }

    return {
      withinLimit: exceeded.length === 0,
      exceeded,
      warnings,
    };
  }

  /**
   * 检查阈值并触发预警
   */
  private checkThresholds(
    type: QuotaType,
    current: number,
    limit: number,
    warnings: CostAlert[]
  ): void {
    for (const alert of this.alerts) {
      const alertKey = `${type}:${alert.threshold}`;

      // 如果当前值超过阈值且未触发过
      if (current >= alert.threshold && !this.triggeredAlerts.has(alertKey)) {
        warnings.push(alert);
        this.triggeredAlerts.add(alertKey);

        // 触发阈值回调
        const status = this.getBudgetStatus(type);
        this.notifyThresholdReached(alert, status);
      }
    }
  }

  /**
   * 获取使用百分比
   */
  getUsagePercentage(type?: QuotaType): number | Record<QuotaType, number> {
    if (type) {
      const status = this.getBudgetStatus(type);
      return status.percentage;
    }

    // 返回所有类型的百分比
    return {
      cost: this.getBudgetStatus('cost').percentage,
      tokens: this.getBudgetStatus('tokens').percentage,
      requests: this.getBudgetStatus('requests').percentage,
    };
  }

  /**
   * 获取剩余预算
   */
  getRemainingBudget(type?: QuotaType): number | Record<QuotaType, number> {
    if (type) {
      const status = this.getBudgetStatus(type);
      return status.remaining;
    }

    // 返回所有类型的剩余预算
    return {
      cost: this.getBudgetStatus('cost').remaining,
      tokens: this.getBudgetStatus('tokens').remaining,
      requests: this.getBudgetStatus('requests').remaining,
    };
  }

  /**
   * 获取预算状态
   */
  getBudgetStatus(type: QuotaType): BudgetStatus {
    const usage = this.getCurrentUsage();
    let current = 0;
    let limit = 0;

    switch (type) {
      case 'cost':
        current = usage.currentCost;
        limit = this.limits.maxCost || 0;
        break;
      case 'tokens':
        current = usage.currentTokens;
        limit = this.limits.maxTokens || 0;
        break;
      case 'requests':
        current = usage.currentRequests;
        limit = this.limits.maxRequests || 0;
        break;
    }

    // 如果未设置限制，返回无限制状态
    if (limit === 0) {
      return {
        type,
        current,
        limit: 0,
        percentage: 0,
        remaining: Infinity,
        alertLevel: 'info',
        exceeded: false,
      };
    }

    const percentage = Math.min((current / limit) * 100, 100);
    const remaining = Math.max(limit - current, 0);
    const exceeded = current >= limit;

    // 确定预警级别
    let alertLevel: AlertLevel = 'info';
    if (exceeded) {
      alertLevel = 'exceeded';
    } else if (percentage >= 95) {
      alertLevel = 'critical';
    } else if (percentage >= 80) {
      alertLevel = 'warning';
    }

    return {
      type,
      current,
      limit,
      percentage,
      remaining,
      alertLevel,
      exceeded,
    };
  }

  /**
   * 添加自定义预警
   */
  addAlert(alert: CostAlert): void {
    this.alerts.push(alert);
  }

  /**
   * 清除所有预警
   */
  clearAlerts(): void {
    this.alerts = [];
    this.triggeredAlerts.clear();
  }

  /**
   * 注册阈值达到回调
   */
  onThresholdReached(callback: ThresholdCallback): void {
    this.thresholdCallbacks.push(callback);
  }

  /**
   * 注册限制超出回调
   */
  onLimitExceeded(callback: LimitExceededCallback): void {
    this.limitExceededCallbacks.push(callback);
  }

  /**
   * 触发阈值达到通知
   */
  private notifyThresholdReached(alert: CostAlert, status: BudgetStatus): void {
    for (const callback of this.thresholdCallbacks) {
      try {
        callback(alert, status);
      } catch (error) {
        console.error('Error in threshold callback:', error);
      }
    }
  }

  /**
   * 触发限制超出通知
   */
  private notifyLimitExceeded(type: QuotaType, status: BudgetStatus): void {
    for (const callback of this.limitExceededCallbacks) {
      try {
        callback(type, status);
      } catch (error) {
        console.error('Error in limit exceeded callback:', error);
      }
    }
  }

  /**
   * 获取配额摘要
   */
  getSummary(): string {
    if (!this.enabled) {
      return 'Quota management disabled';
    }

    const lines: string[] = ['=== Quota Status ==='];
    const usage = this.getCurrentUsage();

    // 成本状态
    if (this.limits.maxCost !== undefined) {
      const status = this.getBudgetStatus('cost');
      const icon = this.getAlertIcon(status.alertLevel);
      lines.push(
        `${icon} Cost: $${status.current.toFixed(4)} / $${status.limit.toFixed(2)} (${status.percentage.toFixed(1)}%)`
      );
    }

    // Token 状态
    if (this.limits.maxTokens !== undefined) {
      const status = this.getBudgetStatus('tokens');
      const icon = this.getAlertIcon(status.alertLevel);
      lines.push(
        `${icon} Tokens: ${status.current.toLocaleString()} / ${status.limit.toLocaleString()} (${status.percentage.toFixed(1)}%)`
      );
    }

    // 请求状态
    if (this.limits.maxRequests !== undefined) {
      const status = this.getBudgetStatus('requests');
      const icon = this.getAlertIcon(status.alertLevel);
      lines.push(
        `${icon} Requests: ${status.current} / ${status.limit} (${status.percentage.toFixed(1)}%)`
      );
    }

    lines.push('====================');
    return lines.join('\n');
  }

  /**
   * 获取预警图标
   */
  private getAlertIcon(level: AlertLevel): string {
    switch (level) {
      case 'info':
        return '✓';
      case 'warning':
        return '⚠';
      case 'critical':
        return '🔴';
      case 'exceeded':
        return '❌';
    }
  }

  /**
   * 重置配额管理器
   */
  reset(): void {
    this.limits = {};
    this.alerts = [];
    this.triggeredAlerts.clear();
    this.enabled = false;
  }

  /**
   * 启用/禁用配额管理
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 导出配置
   */
  exportConfig(): {
    limits: QuotaLimit;
    alerts: CostAlert[];
    enabled: boolean;
  } {
    return {
      limits: { ...this.limits },
      alerts: [...this.alerts],
      enabled: this.enabled,
    };
  }

  /**
   * 导入配置
   */
  importConfig(config: {
    limits?: QuotaLimit;
    alerts?: CostAlert[];
    enabled?: boolean;
  }): void {
    if (config.limits) {
      this.limits = { ...config.limits };
    }
    if (config.alerts) {
      this.alerts = [...config.alerts];
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
  }
}

/**
 * 全局配额管理器实例
 */
export const quotaManager = new QuotaManager();
