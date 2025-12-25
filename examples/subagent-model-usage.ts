/**
 * Subagent 模型配置使用示例
 * 展示如何为不同类型的 agent 配置和使用模型
 */

import { subagentModelConfig } from '../src/models/subagent-config.js';

// 示例 1: 获取不同 agent 类型的推荐模型
console.log('=== Agent 类型默认模型 ===');
console.log('Explore agent:', subagentModelConfig.getModelForAgent('Explore'));
console.log('Plan agent:', subagentModelConfig.getModelForAgent('Plan'));
console.log('General-purpose agent:', subagentModelConfig.getModelForAgent('general-purpose'));
console.log('Claude Code Guide agent:', subagentModelConfig.getModelForAgent('claude-code-guide'));

// 示例 2: 用户指定模型（优先级最高）
console.log('\n=== 用户指定模型 ===');
const userModel = subagentModelConfig.getModelForAgent('Explore', 'opus');
console.log('Explore with user-specified opus:', userModel);

// 示例 3: 设置模型覆盖
console.log('\n=== 模型覆盖 ===');
subagentModelConfig.setModelOverride('Explore', 'sonnet');
console.log('After override, Explore uses:', subagentModelConfig.getModelForAgent('Explore'));

// 示例 4: 获取完整的 agent 模型信息
console.log('\n=== Agent 模型详细信息 ===');
const modelInfo = subagentModelConfig.getAgentModelInfo('Plan');
console.log('Plan agent model info:');
console.log('  Model ID:', modelInfo.modelId);
console.log('  Display Name:', modelInfo.displayName);
console.log('  Source:', modelInfo.source);
console.log('  Context Window:', modelInfo.capabilities.contextWindow);
console.log('  Supports Thinking:', modelInfo.capabilities.supportsThinking);

// 示例 5: 成本估算
console.log('\n=== 成本估算 ===');
const costEstimate = subagentModelConfig.estimateAgentCost(
  'general-purpose',
  { input: 10000, output: 5000 }
);
console.log('General-purpose agent cost estimate:');
console.log('  Model:', costEstimate.modelId);
console.log('  Estimated cost:', `$${costEstimate.estimatedCostUSD.toFixed(4)}`);
console.log('  Input cost:', `$${costEstimate.breakdown.inputCost.toFixed(4)}`);
console.log('  Output cost:', `$${costEstimate.breakdown.outputCost.toFixed(4)}`);

// 示例 6: 任务类型推荐
console.log('\n=== 任务类型推荐 ===');
const quickLookup = subagentModelConfig.recommendAgentAndModel('quick-lookup');
console.log('Quick lookup task:');
console.log('  Agent:', quickLookup.agentType);
console.log('  Model:', quickLookup.model);
console.log('  Reason:', quickLookup.reason);

const complexTask = subagentModelConfig.recommendAgentAndModel('complex-task');
console.log('\nComplex task:');
console.log('  Agent:', complexTask.agentType);
console.log('  Model:', complexTask.model);
console.log('  Reason:', complexTask.reason);

// 示例 7: 能力验证
console.log('\n=== 能力验证 ===');
const validation = subagentModelConfig.validateAgentCapabilities(
  'Explore',
  { needsThinking: true, minContextWindow: 500000 }
);
console.log('Explore agent with thinking requirement:');
console.log('  Valid:', validation.valid);
if (!validation.valid) {
  console.log('  Missing:', validation.missingCapabilities.join(', '));
  console.log('  Suggestions:', validation.suggestions?.join('; '));
}

// 示例 8: 策略切换
console.log('\n=== 策略切换 ===');
console.log('Current strategy:', subagentModelConfig.getStrategy());

subagentModelConfig.setStrategy('cost-optimized');
console.log('\nAfter cost-optimized strategy:');
console.log('  General-purpose:', subagentModelConfig.getModelForAgent('general-purpose'));
console.log('  Plan:', subagentModelConfig.getModelForAgent('Plan'));

subagentModelConfig.setStrategy('performance-optimized');
console.log('\nAfter performance-optimized strategy:');
console.log('  General-purpose:', subagentModelConfig.getModelForAgent('general-purpose'));
console.log('  Explore:', subagentModelConfig.getModelForAgent('Explore'));

// 恢复默认策略
subagentModelConfig.setStrategy('balanced');

// 示例 9: 列出所有 agent 类型及其模型
console.log('\n=== 所有 Agent 类型模型映射 ===');
const allModels = subagentModelConfig.getAllAgentTypeModels();
for (const [agentType, model] of Object.entries(allModels)) {
  console.log(`  ${agentType}: ${model}`);
}
