/**
 * 模型使用统计
 * 按模型分类记录使用情况
 */

import type { ModelUsageStats, ModelPricing } from './types.js';
import { modelConfig } from './config.js';

/**
 * 空统计对象
 */
function createEmptyStats(): ModelUsageStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    thinkingTokens: 0,
    webSearchRequests: 0,
    costUSD: 0,
    contextWindowUsage: 0,
    apiCalls: 0,
    apiDurationMs: 0,
    toolDurationMs: 0,
  };
}

/**
 * 模型统计管理器
 */
export class ModelStats {
  private statsPerModel: Map<string, ModelUsageStats> = new Map();
  private globalStats: ModelUsageStats = createEmptyStats();
  private startTime: number = Date.now();

  /**
   * 记录 API 调用
   */
  record(
    modelId: string,
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      thinkingTokens?: number;
      webSearchRequests?: number;
      apiDurationMs?: number;
      toolDurationMs?: number;
    }
  ): void {
    const resolvedModel = modelConfig.resolveAlias(modelId);

    // 获取或创建模型统计
    if (!this.statsPerModel.has(resolvedModel)) {
      this.statsPerModel.set(resolvedModel, createEmptyStats());
    }
    const modelStats = this.statsPerModel.get(resolvedModel)!;

    // 计算成本
    const cost = modelConfig.calculateCost(resolvedModel, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      thinkingTokens: usage.thinkingTokens,
    });

    // 更新模型统计
    modelStats.inputTokens += usage.inputTokens;
    modelStats.outputTokens += usage.outputTokens;
    modelStats.cacheReadTokens += usage.cacheReadTokens || 0;
    modelStats.cacheCreationTokens += usage.cacheCreationTokens || 0;
    modelStats.thinkingTokens += usage.thinkingTokens || 0;
    modelStats.webSearchRequests += usage.webSearchRequests || 0;
    modelStats.costUSD += cost;
    modelStats.apiCalls += 1;
    modelStats.apiDurationMs += usage.apiDurationMs || 0;
    modelStats.toolDurationMs += usage.toolDurationMs || 0;

    // 计算上下文窗口使用率
    const contextWindow = modelConfig.getContextWindow(resolvedModel);
    const totalInputTokens = usage.inputTokens + (usage.cacheReadTokens || 0);
    modelStats.contextWindowUsage = Math.max(
      modelStats.contextWindowUsage,
      totalInputTokens / contextWindow
    );

    // 更新全局统计
    this.globalStats.inputTokens += usage.inputTokens;
    this.globalStats.outputTokens += usage.outputTokens;
    this.globalStats.cacheReadTokens += usage.cacheReadTokens || 0;
    this.globalStats.cacheCreationTokens += usage.cacheCreationTokens || 0;
    this.globalStats.thinkingTokens += usage.thinkingTokens || 0;
    this.globalStats.webSearchRequests += usage.webSearchRequests || 0;
    this.globalStats.costUSD += cost;
    this.globalStats.apiCalls += 1;
    this.globalStats.apiDurationMs += usage.apiDurationMs || 0;
    this.globalStats.toolDurationMs += usage.toolDurationMs || 0;
  }

  /**
   * 获取特定模型的统计
   */
  getByModel(modelId: string): ModelUsageStats {
    const resolvedModel = modelConfig.resolveAlias(modelId);
    return { ...(this.statsPerModel.get(resolvedModel) || createEmptyStats()) };
  }

  /**
   * 获取全局统计
   */
  getGlobal(): ModelUsageStats {
    return { ...this.globalStats };
  }

  /**
   * 获取所有模型的统计
   */
  getAllByModel(): Map<string, ModelUsageStats> {
    return new Map(this.statsPerModel);
  }

  /**
   * 获取总成本
   */
  getTotalCost(): number {
    return this.globalStats.costUSD;
  }

  /**
   * 获取格式化的成本字符串
   */
  getFormattedCost(): string {
    const cost = this.globalStats.costUSD;
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(2)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * 获取总 tokens
   */
  getTotalTokens(): number {
    return (
      this.globalStats.inputTokens +
      this.globalStats.outputTokens +
      this.globalStats.cacheReadTokens +
      this.globalStats.thinkingTokens
    );
  }

  /**
   * 获取会话持续时间
   */
  getSessionDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): {
    averageApiLatency: number;
    averageToolLatency: number;
    tokensPerSecond: number;
    cacheHitRate: number;
  } {
    const apiCalls = this.globalStats.apiCalls;

    if (apiCalls === 0) {
      return {
        averageApiLatency: 0,
        averageToolLatency: 0,
        tokensPerSecond: 0,
        cacheHitRate: 0,
      };
    }

    const totalTokens = this.globalStats.inputTokens + this.globalStats.outputTokens;
    const totalApiTime = this.globalStats.apiDurationMs;
    const totalCacheTokens = this.globalStats.cacheReadTokens + this.globalStats.cacheCreationTokens;

    return {
      averageApiLatency: Math.round(totalApiTime / apiCalls),
      averageToolLatency: Math.round(this.globalStats.toolDurationMs / apiCalls),
      tokensPerSecond: totalApiTime > 0 ? Math.round((totalTokens / totalApiTime) * 1000) : 0,
      cacheHitRate: totalCacheTokens > 0
        ? this.globalStats.cacheReadTokens / totalCacheTokens
        : 0,
    };
  }

  /**
   * 获取模型使用分布
   */
  getModelDistribution(): Array<{
    model: string;
    displayName: string;
    percentage: number;
    tokens: number;
    cost: number;
    calls: number;
  }> {
    const totalTokens = this.getTotalTokens();
    const result: Array<{
      model: string;
      displayName: string;
      percentage: number;
      tokens: number;
      cost: number;
      calls: number;
    }> = [];

    for (const [model, stats] of this.statsPerModel) {
      const modelTokens = stats.inputTokens + stats.outputTokens + stats.cacheReadTokens;
      result.push({
        model,
        displayName: modelConfig.getDisplayName(model),
        percentage: totalTokens > 0 ? (modelTokens / totalTokens) * 100 : 0,
        tokens: modelTokens,
        cost: stats.costUSD,
        calls: stats.apiCalls,
      });
    }

    // 按使用量排序
    return result.sort((a, b) => b.tokens - a.tokens);
  }

  /**
   * 获取摘要
   */
  getSummary(): string {
    const lines: string[] = [
      '=== Usage Summary ===',
      `Total Cost: ${this.getFormattedCost()}`,
      `Total Tokens: ${this.getTotalTokens().toLocaleString()}`,
      `API Calls: ${this.globalStats.apiCalls}`,
      `Session Duration: ${Math.round(this.getSessionDuration() / 1000 / 60)} minutes`,
    ];

    const perf = this.getPerformanceMetrics();
    lines.push(`Average API Latency: ${perf.averageApiLatency}ms`);
    lines.push(`Tokens/Second: ${perf.tokensPerSecond}`);
    lines.push(`Cache Hit Rate: ${(perf.cacheHitRate * 100).toFixed(1)}%`);

    if (this.statsPerModel.size > 1) {
      lines.push('');
      lines.push('By Model:');
      for (const item of this.getModelDistribution()) {
        lines.push(`  ${item.displayName}: ${item.percentage.toFixed(1)}% (${item.tokens.toLocaleString()} tokens, ${item.calls} calls)`);
      }
    }

    lines.push('=====================');

    return lines.join('\n');
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.statsPerModel.clear();
    this.globalStats = createEmptyStats();
    this.startTime = Date.now();
  }

  /**
   * 导出统计数据
   */
  export(): {
    global: ModelUsageStats;
    byModel: Record<string, ModelUsageStats>;
    startTime: number;
    duration: number;
  } {
    const byModel: Record<string, ModelUsageStats> = {};
    for (const [model, stats] of this.statsPerModel) {
      byModel[model] = { ...stats };
    }

    return {
      global: { ...this.globalStats },
      byModel,
      startTime: this.startTime,
      duration: this.getSessionDuration(),
    };
  }
}

/**
 * 全局模型统计实例
 */
export const modelStats = new ModelStats();
