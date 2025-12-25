/**
 * Task 工具与 Subagent 模型配置集成示例
 * 展示如何在创建 Task 时使用智能模型选择
 */

import { subagentModelConfig } from '../src/models/subagent-config.js';
import { modelConfig } from '../src/models/config.js';

/**
 * 增强的 Task 创建函数
 * 自动为不同类型的 agent 选择合适的模型
 */
function createTaskWithSmartModelSelection(input: {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: string;  // 可选的用户指定模型
  globalDefaultModel?: string;
}) {
  // 使用 subagentModelConfig 自动选择最优模型
  const selectedModel = subagentModelConfig.getModelForAgent(
    input.subagent_type,
    input.model,
    input.globalDefaultModel
  );

  // 获取模型详细信息
  const modelInfo = subagentModelConfig.getAgentModelInfo(
    input.subagent_type,
    input.model
  );

  // 估算成本（假设平均 token 使用量）
  const costEstimate = subagentModelConfig.estimateAgentCost(
    input.subagent_type,
    { input: 5000, output: 2000 },
    input.model
  );

  console.log('\n=== Task Configuration ===');
  console.log('Description:', input.description);
  console.log('Agent Type:', input.subagent_type);
  console.log('Selected Model:', selectedModel);
  console.log('Model Display Name:', modelInfo.displayName);
  console.log('Model Source:', modelInfo.source);
  console.log('Estimated Cost:', `$${costEstimate.estimatedCostUSD.toFixed(4)}`);
  console.log('Context Window:', modelInfo.capabilities.contextWindow);
  console.log('Supports Thinking:', modelInfo.capabilities.supportsThinking);

  // 返回完整的 Task 配置
  return {
    ...input,
    model: selectedModel,
    _metadata: {
      modelInfo,
      costEstimate,
      selectionSource: modelInfo.source,
    },
  };
}

// ============================================================================
// 使用示例
// ============================================================================

console.log('=== Example 1: Explore Task (使用默认模型) ===');
const exploreTask = createTaskWithSmartModelSelection({
  description: 'Explore codebase',
  prompt: 'Find all TypeScript files that use React hooks',
  subagent_type: 'Explore',
});

console.log('\n=== Example 2: Plan Task (用户指定使用 Opus) ===');
const planTask = createTaskWithSmartModelSelection({
  description: 'Design architecture',
  prompt: 'Design a scalable microservices architecture for an e-commerce platform',
  subagent_type: 'Plan',
  model: 'opus',  // 用户明确指定使用 opus
});

console.log('\n=== Example 3: General Purpose Task (使用全局默认) ===');
const generalTask = createTaskWithSmartModelSelection({
  description: 'Research question',
  prompt: 'Research best practices for TypeScript error handling',
  subagent_type: 'general-purpose',
  globalDefaultModel: 'sonnet',
});

console.log('\n=== Example 4: Claude Code Guide Task (成本优化) ===');
const guideTask = createTaskWithSmartModelSelection({
  description: 'Documentation query',
  prompt: 'How do I configure MCP servers in Claude Code?',
  subagent_type: 'claude-code-guide',
});

// ============================================================================
// 高级场景：根据任务复杂度自动选择
// ============================================================================

console.log('\n\n=== Advanced: Task Complexity-Based Selection ===');

function createTaskByComplexity(taskDescription: string, complexity: 'simple' | 'medium' | 'complex') {
  let agentType: string;
  let recommendedModel: string;

  switch (complexity) {
    case 'simple':
      // 简单任务：使用 Explore + haiku
      agentType = 'Explore';
      recommendedModel = 'haiku';
      break;
    case 'medium':
      // 中等任务：使用 general-purpose + sonnet
      agentType = 'general-purpose';
      recommendedModel = 'sonnet';
      break;
    case 'complex':
      // 复杂任务：使用 general-purpose + opus
      agentType = 'general-purpose';
      recommendedModel = 'opus';
      break;
  }

  return createTaskWithSmartModelSelection({
    description: taskDescription,
    prompt: taskDescription,
    subagent_type: agentType,
    model: recommendedModel,
  });
}

const simpleTask = createTaskByComplexity('Find all TODO comments', 'simple');
const mediumTask = createTaskByComplexity('Analyze code patterns and suggest improvements', 'medium');
const complexTask = createTaskByComplexity('Refactor entire module with architectural changes', 'complex');

// ============================================================================
// 策略模式：批量任务优化
// ============================================================================

console.log('\n\n=== Batch Tasks with Strategy ===');

// 成本优化策略：处理多个简单任务
console.log('\n--- Cost-Optimized Strategy ---');
subagentModelConfig.setStrategy('cost-optimized');

const batchTasks = [
  { desc: 'Find React components', type: 'Explore' },
  { desc: 'List all tests', type: 'Explore' },
  { desc: 'Check code style', type: 'general-purpose' },
];

for (const task of batchTasks) {
  const config = createTaskWithSmartModelSelection({
    description: task.desc,
    prompt: task.desc,
    subagent_type: task.type,
  });
  console.log(`\n${task.desc}: ${config.model} ($${config._metadata.costEstimate.estimatedCostUSD.toFixed(4)})`);
}

// 性能优化策略：处理关键任务
console.log('\n\n--- Performance-Optimized Strategy ---');
subagentModelConfig.setStrategy('performance-optimized');

const criticalTask = createTaskWithSmartModelSelection({
  description: 'Critical analysis',
  prompt: 'Perform comprehensive security audit',
  subagent_type: 'general-purpose',
});

// 恢复平衡策略
subagentModelConfig.setStrategy('balanced');

// ============================================================================
// 能力验证示例
// ============================================================================

console.log('\n\n=== Capability Validation ===');

function createTaskWithCapabilityCheck(
  taskConfig: {
    description: string;
    prompt: string;
    subagent_type: string;
    model?: string;
  },
  requiredCapabilities: {
    needsThinking?: boolean;
    needsVision?: boolean;
    needsPdf?: boolean;
    minContextWindow?: number;
  }
) {
  const validation = subagentModelConfig.validateAgentCapabilities(
    taskConfig.subagent_type,
    requiredCapabilities,
    taskConfig.model
  );

  if (!validation.valid) {
    console.log(`\n⚠️  Warning: Agent ${taskConfig.subagent_type} missing capabilities:`);
    console.log('   Missing:', validation.missingCapabilities.join(', '));
    if (validation.suggestions) {
      console.log('   Suggestions:', validation.suggestions.join('; '));
    }
    // 可以自动升级到支持所需能力的模型
    if (requiredCapabilities.needsThinking) {
      console.log('   Auto-upgrading to opus for thinking support...');
      taskConfig.model = 'opus';
    }
  }

  return createTaskWithSmartModelSelection(taskConfig);
}

const thinkingTask = createTaskWithCapabilityCheck(
  {
    description: 'Complex reasoning task',
    prompt: 'Solve a complex algorithmic problem with detailed reasoning',
    subagent_type: 'Explore',
  },
  { needsThinking: true }
);

// ============================================================================
// 成本预算管理
// ============================================================================

console.log('\n\n=== Cost Budget Management ===');

function createTasksWithBudget(
  tasks: Array<{ description: string; subagent_type: string }>,
  maxBudgetUSD: number
) {
  let totalCost = 0;
  const createdTasks: any[] = [];

  for (const task of tasks) {
    // 先用默认模型估算
    let estimate = subagentModelConfig.estimateAgentCost(
      task.subagent_type,
      { input: 5000, output: 2000 }
    );

    // 如果超预算，尝试降级到更便宜的模型
    let selectedModel: string | undefined;
    if (totalCost + estimate.estimatedCostUSD > maxBudgetUSD) {
      console.log(`\n💰 Budget constraint: downgrading ${task.subagent_type} to haiku`);
      selectedModel = 'haiku';
      estimate = subagentModelConfig.estimateAgentCost(
        task.subagent_type,
        { input: 5000, output: 2000 },
        selectedModel
      );
    }

    if (totalCost + estimate.estimatedCostUSD <= maxBudgetUSD) {
      const taskConfig = createTaskWithSmartModelSelection({
        description: task.description,
        prompt: task.description,
        subagent_type: task.subagent_type,
        model: selectedModel,
      });
      createdTasks.push(taskConfig);
      totalCost += estimate.estimatedCostUSD;
      console.log(`✓ Added task: $${estimate.estimatedCostUSD.toFixed(4)} (Total: $${totalCost.toFixed(4)})`);
    } else {
      console.log(`✗ Skipped task (would exceed budget): ${task.description}`);
    }
  }

  console.log(`\nTotal tasks created: ${createdTasks.length}/${tasks.length}`);
  console.log(`Total estimated cost: $${totalCost.toFixed(4)} / $${maxBudgetUSD.toFixed(2)}`);

  return createdTasks;
}

const budgetedTasks = createTasksWithBudget(
  [
    { description: 'Explore API endpoints', subagent_type: 'Explore' },
    { description: 'Plan refactoring', subagent_type: 'Plan' },
    { description: 'Research best practices', subagent_type: 'general-purpose' },
    { description: 'Check documentation', subagent_type: 'claude-code-guide' },
  ],
  0.05  // $0.05 budget
);
