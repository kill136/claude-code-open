/**
 * Subagent 模型配置管理
 * 为不同类型的 agent 提供智能模型选择和覆盖功能
 */

import { modelConfig } from './config.js';

/**
 * Agent 类型到默认模型的映射
 * 根据任务复杂度和性能需求选择合适的模型
 */
const AGENT_MODEL_DEFAULTS: Record<string, string> = {
  'general-purpose': 'sonnet',      // 通用任务使用中等能力模型
  'Explore': 'haiku',               // 快速探索用轻量模型
  'Plan': 'sonnet',                 // 计划需要中等能力模型
  'claude-code-guide': 'haiku',     // 文档查询用轻量模型
  'statusline-setup': 'haiku',      // 简单配置任务用轻量模型
};

/**
 * 模型选择策略
 */
export type ModelSelectionStrategy = 'cost-optimized' | 'performance-optimized' | 'balanced';

/**
 * Subagent 模型配置类
 * 管理不同 agent 类型的模型选择和覆盖
 */
export class SubagentModelConfig {
  private modelOverrides: Map<string, string> = new Map();
  private strategy: ModelSelectionStrategy = 'balanced';

  /**
   * 获取指定 agent 类型应该使用的模型
   * 实现模型继承逻辑：用户指定 > agent 类型默认 > 全局默认
   */
  getModelForAgent(
    agentType: string,
    userSpecifiedModel?: string,
    globalDefault?: string
  ): string {
    // 1. 优先使用用户明确指定的模型
    if (userSpecifiedModel) {
      // 解析别名为完整模型 ID
      return modelConfig.resolveAlias(userSpecifiedModel);
    }

    // 2. 检查是否有该 agent 类型的覆盖配置
    const override = this.modelOverrides.get(agentType);
    if (override) {
      return modelConfig.resolveAlias(override);
    }

    // 3. 使用 agent 类型的默认模型
    const agentDefault = this.getDefaultModel(agentType);
    if (agentDefault) {
      return modelConfig.resolveAlias(agentDefault);
    }

    // 4. 使用全局默认模型
    if (globalDefault) {
      return modelConfig.resolveAlias(globalDefault);
    }

    // 5. 最后使用系统默认模型
    return modelConfig.getDefaultModel();
  }

  /**
   * 获取 agent 类型的默认模型（不考虑覆盖）
   */
  getDefaultModel(agentType: string): string | null {
    const defaultModel = AGENT_MODEL_DEFAULTS[agentType];
    if (!defaultModel) {
      return null;
    }
    return modelConfig.resolveAlias(defaultModel);
  }

  /**
   * 设置特定 agent 类型的模型覆盖
   * 用于临时或持久化地修改某个 agent 类型的默认模型
   */
  setModelOverride(agentType: string, model: string): void {
    // 验证模型是否有效
    const resolvedModel = modelConfig.resolveAlias(model);
    if (!modelConfig.isValidModel(resolvedModel)) {
      throw new Error(`Invalid model: ${model}. Model not recognized.`);
    }

    this.modelOverrides.set(agentType, resolvedModel);
  }

  /**
   * 移除特定 agent 类型的模型覆盖
   */
  removeModelOverride(agentType: string): boolean {
    return this.modelOverrides.delete(agentType);
  }

  /**
   * 清除所有模型覆盖
   */
  clearAllOverrides(): void {
    this.modelOverrides.clear();
  }

  /**
   * 获取所有模型覆盖配置
   */
  getAllOverrides(): Record<string, string> {
    return Object.fromEntries(this.modelOverrides);
  }

  /**
   * 获取某个 agent 类型的完整模型信息
   */
  getAgentModelInfo(agentType: string, userSpecifiedModel?: string) {
    const modelId = this.getModelForAgent(agentType, userSpecifiedModel);
    const modelInfo = modelConfig.getModelInfo(modelId);
    const pricing = modelConfig.getPricing(modelId);
    const capabilities = modelConfig.getCapabilities(modelId);

    return {
      modelId,
      displayName: modelConfig.getDisplayName(modelId),
      agentType,
      source: this.getModelSource(agentType, userSpecifiedModel),
      info: modelInfo,
      pricing,
      capabilities,
    };
  }

  /**
   * 获取模型来源（用于调试和日志）
   */
  private getModelSource(
    agentType: string,
    userSpecifiedModel?: string
  ): 'user' | 'override' | 'agent-default' | 'global-default' {
    if (userSpecifiedModel) {
      return 'user';
    }
    if (this.modelOverrides.has(agentType)) {
      return 'override';
    }
    if (AGENT_MODEL_DEFAULTS[agentType]) {
      return 'agent-default';
    }
    return 'global-default';
  }

  /**
   * 设置模型选择策略
   */
  setStrategy(strategy: ModelSelectionStrategy): void {
    this.strategy = strategy;
    this.applyStrategy();
  }

  /**
   * 获取当前模型选择策略
   */
  getStrategy(): ModelSelectionStrategy {
    return this.strategy;
  }

  /**
   * 应用模型选择策略
   * 根据策略自动调整 agent 类型的默认模型
   */
  private applyStrategy(): void {
    this.clearAllOverrides();

    switch (this.strategy) {
      case 'cost-optimized':
        // 所有 agent 尽可能使用 haiku
        this.setModelOverride('general-purpose', 'haiku');
        this.setModelOverride('Plan', 'haiku');
        break;

      case 'performance-optimized':
        // 所有 agent 使用最强模型
        this.setModelOverride('general-purpose', 'opus');
        this.setModelOverride('Explore', 'sonnet');
        this.setModelOverride('Plan', 'opus');
        this.setModelOverride('claude-code-guide', 'sonnet');
        this.setModelOverride('statusline-setup', 'sonnet');
        break;

      case 'balanced':
        // 使用默认配置，不设置覆盖
        break;
    }
  }

  /**
   * 获取所有已知 agent 类型及其推荐模型
   */
  getAllAgentTypeModels(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const agentType of Object.keys(AGENT_MODEL_DEFAULTS)) {
      result[agentType] = this.getModelForAgent(agentType);
    }
    return result;
  }

  /**
   * 推荐适合特定任务类型的 agent 和模型组合
   */
  recommendAgentAndModel(taskType: 'quick-lookup' | 'exploration' | 'planning' | 'complex-task'): {
    agentType: string;
    model: string;
    reason: string;
  } {
    switch (taskType) {
      case 'quick-lookup':
        return {
          agentType: 'claude-code-guide',
          model: this.getModelForAgent('claude-code-guide'),
          reason: 'Fast documentation queries with lightweight model',
        };

      case 'exploration':
        return {
          agentType: 'Explore',
          model: this.getModelForAgent('Explore'),
          reason: 'Code exploration optimized with quick response times',
        };

      case 'planning':
        return {
          agentType: 'Plan',
          model: this.getModelForAgent('Plan'),
          reason: 'Architectural planning with balanced capability',
        };

      case 'complex-task':
        return {
          agentType: 'general-purpose',
          model: this.getModelForAgent('general-purpose'),
          reason: 'General-purpose agent with comprehensive toolset',
        };

      default:
        return {
          agentType: 'general-purpose',
          model: modelConfig.getDefaultModel(),
          reason: 'Default configuration for unknown task type',
        };
    }
  }

  /**
   * 估算 agent 执行的成本
   */
  estimateAgentCost(
    agentType: string,
    estimatedTokens: { input: number; output: number },
    userSpecifiedModel?: string
  ): {
    modelId: string;
    estimatedCostUSD: number;
    breakdown: {
      inputCost: number;
      outputCost: number;
    };
  } {
    const modelId = this.getModelForAgent(agentType, userSpecifiedModel);
    const pricing = modelConfig.getPricing(modelId);

    const inputCost = (estimatedTokens.input / 1_000_000) * pricing.input;
    const outputCost = (estimatedTokens.output / 1_000_000) * pricing.output;
    const estimatedCostUSD = inputCost + outputCost;

    return {
      modelId,
      estimatedCostUSD,
      breakdown: {
        inputCost,
        outputCost,
      },
    };
  }

  /**
   * 验证 agent 类型是否支持指定的功能
   */
  validateAgentCapabilities(
    agentType: string,
    requiredCapabilities: {
      needsThinking?: boolean;
      needsVision?: boolean;
      needsPdf?: boolean;
      minContextWindow?: number;
    },
    userSpecifiedModel?: string
  ): {
    valid: boolean;
    missingCapabilities: string[];
    suggestions?: string[];
  } {
    const modelId = this.getModelForAgent(agentType, userSpecifiedModel);
    const capabilities = modelConfig.getCapabilities(modelId);
    const missingCapabilities: string[] = [];
    const suggestions: string[] = [];

    if (requiredCapabilities.needsThinking && !capabilities.supportsThinking) {
      missingCapabilities.push('Extended Thinking');
      suggestions.push('Consider using Opus 4.5 or Sonnet 4.5 for thinking support');
    }

    if (requiredCapabilities.needsVision && !capabilities.supportsVision) {
      missingCapabilities.push('Vision support');
      suggestions.push('Use a Claude 3.5+ model for vision capabilities');
    }

    if (requiredCapabilities.needsPdf && !capabilities.supportsPdf) {
      missingCapabilities.push('PDF support');
      suggestions.push('Use a Claude 4+ model for PDF support');
    }

    if (requiredCapabilities.minContextWindow &&
        capabilities.contextWindow < requiredCapabilities.minContextWindow) {
      missingCapabilities.push(`Context window (need ${requiredCapabilities.minContextWindow}, have ${capabilities.contextWindow})`);
      suggestions.push('Consider using Opus 4.5 or Sonnet 4.5 for larger context');
    }

    return {
      valid: missingCapabilities.length === 0,
      missingCapabilities,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }
}

/**
 * 全局 subagent 模型配置实例
 */
export const subagentModelConfig = new SubagentModelConfig();

/**
 * 导出 agent 类型常量供外部使用
 */
export const AGENT_TYPES = Object.keys(AGENT_MODEL_DEFAULTS);
