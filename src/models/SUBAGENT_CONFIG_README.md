# Subagent 模型配置系统

## 概述

`subagent-config.ts` 模块为 Claude Code 的子代理（Task 工具）系统提供智能模型选择和配置管理功能。它允许不同类型的 agent 使用最适合其任务的模型，同时支持用户覆盖和策略优化。

## 核心功能

### 1. 智能模型选择

根据 agent 类型自动选择最优模型：

```typescript
import { subagentModelConfig } from './models/subagent-config.js';

// 获取 Explore agent 的推荐模型（默认: haiku）
const model = subagentModelConfig.getModelForAgent('Explore');

// 用户指定模型（优先级最高）
const customModel = subagentModelConfig.getModelForAgent('Explore', 'opus');
```

### 2. Agent 类型默认映射

| Agent 类型 | 默认模型 | 原因 |
|-----------|---------|------|
| `general-purpose` | sonnet | 通用任务需要中等能力 |
| `Explore` | haiku | 快速代码探索，轻量级即可 |
| `Plan` | sonnet | 架构规划需要中等推理能力 |
| `claude-code-guide` | haiku | 文档查询，轻量级足够 |
| `statusline-setup` | haiku | 简单配置任务 |

### 3. 模型继承逻辑

模型选择遵循优先级顺序：

1. **用户指定模型** - 最高优先级
2. **Agent 类型覆盖** - 通过 `setModelOverride()` 设置
3. **Agent 类型默认** - AGENT_MODEL_DEFAULTS 中定义
4. **全局默认模型** - 系统配置的默认值
5. **系统默认** - claude-sonnet-4-5-20250929

```typescript
// 优先级示例
subagentModelConfig.setModelOverride('Explore', 'sonnet');

// 情况 1: 用户指定 - 返回 opus
const model1 = subagentModelConfig.getModelForAgent('Explore', 'opus');

// 情况 2: 使用覆盖 - 返回 sonnet
const model2 = subagentModelConfig.getModelForAgent('Explore');

// 情况 3: 移除覆盖后，使用默认 - 返回 haiku
subagentModelConfig.removeModelOverride('Explore');
const model3 = subagentModelConfig.getModelForAgent('Explore');
```

## 主要 API

### SubagentModelConfig 类

#### getModelForAgent()

获取指定 agent 应使用的模型：

```typescript
getModelForAgent(
  agentType: string,
  userSpecifiedModel?: string,
  globalDefault?: string
): string
```

#### setModelOverride()

为特定 agent 类型设置模型覆盖：

```typescript
setModelOverride(agentType: string, model: string): void

// 示例
subagentModelConfig.setModelOverride('Plan', 'opus');
```

#### getDefaultModel()

获取 agent 类型的默认模型（不考虑覆盖）：

```typescript
getDefaultModel(agentType: string): string | null

// 示例
const defaultModel = subagentModelConfig.getDefaultModel('Explore');
// 返回: 'claude-haiku-4-5-20250924'
```

#### getAgentModelInfo()

获取完整的模型信息：

```typescript
const info = subagentModelConfig.getAgentModelInfo('Plan', 'opus');
console.log(info.modelId);        // claude-opus-4-5-20251101
console.log(info.displayName);    // Opus 4.5
console.log(info.source);         // 'user' | 'override' | 'agent-default' | 'global-default'
console.log(info.capabilities);   // { contextWindow: 1000000, ... }
console.log(info.pricing);        // { input: 15, output: 75, ... }
```

### 策略模式

支持三种全局策略：

#### 1. balanced（默认）

使用预定义的默认模型映射，平衡成本和性能：

```typescript
subagentModelConfig.setStrategy('balanced');
```

#### 2. cost-optimized

成本优化，尽可能使用 haiku：

```typescript
subagentModelConfig.setStrategy('cost-optimized');
// general-purpose: haiku
// Plan: haiku
// 其他保持默认
```

#### 3. performance-optimized

性能优化，使用更强大的模型：

```typescript
subagentModelConfig.setStrategy('performance-optimized');
// general-purpose: opus
// Explore: sonnet
// Plan: opus
// claude-code-guide: sonnet
// statusline-setup: sonnet
```

### 成本估算

估算 agent 执行的成本：

```typescript
const estimate = subagentModelConfig.estimateAgentCost(
  'general-purpose',
  { input: 10000, output: 5000 }
);

console.log(estimate.modelId);              // claude-sonnet-4-5-20250929
console.log(estimate.estimatedCostUSD);     // 0.105
console.log(estimate.breakdown.inputCost);  // 0.03
console.log(estimate.breakdown.outputCost); // 0.075
```

### 任务推荐

根据任务类型获取推荐的 agent 和模型组合：

```typescript
const recommendation = subagentModelConfig.recommendAgentAndModel('quick-lookup');
console.log(recommendation.agentType);  // 'claude-code-guide'
console.log(recommendation.model);      // 'claude-haiku-4-5-20250924'
console.log(recommendation.reason);     // 'Fast documentation queries...'

// 支持的任务类型：
// - 'quick-lookup'    -> claude-code-guide + haiku
// - 'exploration'     -> Explore + haiku
// - 'planning'        -> Plan + sonnet
// - 'complex-task'    -> general-purpose + sonnet
```

### 能力验证

验证 agent 是否满足所需能力：

```typescript
const validation = subagentModelConfig.validateAgentCapabilities(
  'Explore',
  {
    needsThinking: true,
    needsVision: false,
    minContextWindow: 500000
  }
);

if (!validation.valid) {
  console.log('Missing:', validation.missingCapabilities);
  console.log('Suggestions:', validation.suggestions);
}
```

## 使用场景

### 场景 1: Task 工具集成

在创建 Task 时自动选择合适的模型：

```typescript
function createTask(input: {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: string;
}) {
  // 使用智能模型选择
  const selectedModel = subagentModelConfig.getModelForAgent(
    input.subagent_type,
    input.model
  );

  return {
    ...input,
    model: selectedModel,  // 传递给 API
  };
}
```

### 场景 2: 批量任务成本优化

处理多个任务时优化总成本：

```typescript
subagentModelConfig.setStrategy('cost-optimized');

const tasks = [
  createTask({ description: 'Task 1', subagent_type: 'Explore', ... }),
  createTask({ description: 'Task 2', subagent_type: 'Plan', ... }),
  createTask({ description: 'Task 3', subagent_type: 'general-purpose', ... }),
];

// 所有任务使用成本优化的模型选择
```

### 场景 3: 动态能力调整

根据任务需求动态调整模型：

```typescript
function createTaskWithRequirements(config, requirements) {
  const validation = subagentModelConfig.validateAgentCapabilities(
    config.subagent_type,
    requirements
  );

  if (!validation.valid && requirements.needsThinking) {
    // 自动升级到支持 thinking 的模型
    config.model = 'opus';
  }

  return createTask(config);
}
```

### 场景 4: 预算管理

在预算约束下创建任务：

```typescript
let totalCost = 0;
const budget = 0.10; // $0.10

for (const taskConfig of taskConfigs) {
  const estimate = subagentModelConfig.estimateAgentCost(
    taskConfig.subagent_type,
    { input: 5000, output: 2000 }
  );

  if (totalCost + estimate.estimatedCostUSD <= budget) {
    createTask(taskConfig);
    totalCost += estimate.estimatedCostUSD;
  } else {
    // 尝试使用更便宜的模型
    const cheapEstimate = subagentModelConfig.estimateAgentCost(
      taskConfig.subagent_type,
      { input: 5000, output: 2000 },
      'haiku'  // 降级到 haiku
    );

    if (totalCost + cheapEstimate.estimatedCostUSD <= budget) {
      taskConfig.model = 'haiku';
      createTask(taskConfig);
      totalCost += cheapEstimate.estimatedCostUSD;
    }
  }
}
```

## 配置持久化

模型覆盖可以持久化到配置文件：

```typescript
// 获取当前所有覆盖
const overrides = subagentModelConfig.getAllOverrides();
// { "Explore": "claude-sonnet-4-5-20250929", ... }

// 保存到配置文件
fs.writeFileSync('~/.claude/subagent-models.json', JSON.stringify(overrides));

// 加载配置
const saved = JSON.parse(fs.readFileSync('~/.claude/subagent-models.json'));
for (const [agentType, model] of Object.entries(saved)) {
  subagentModelConfig.setModelOverride(agentType, model);
}
```

## 类型定义

```typescript
type ModelSelectionStrategy = 'cost-optimized' | 'performance-optimized' | 'balanced';

interface AgentModelInfo {
  modelId: string;
  displayName: string;
  agentType: string;
  source: 'user' | 'override' | 'agent-default' | 'global-default';
  info: ModelInfo | null;
  pricing: ModelPricing;
  capabilities: ModelCapabilities;
}

interface CostEstimate {
  modelId: string;
  estimatedCostUSD: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
  };
}

interface TaskRecommendation {
  agentType: string;
  model: string;
  reason: string;
}
```

## 最佳实践

1. **默认配置优先**: 只在必要时覆盖默认配置
2. **成本意识**: 使用 `estimateAgentCost()` 预估成本
3. **能力验证**: 对关键任务使用 `validateAgentCapabilities()`
4. **策略灵活**: 根据场景选择合适的策略
5. **用户优先**: 始终尊重用户明确指定的模型

## 示例代码

完整示例请参考：
- `/examples/subagent-model-usage.ts` - 基础功能示例
- `/examples/task-integration-example.ts` - Task 工具集成示例

## 与现有代码集成

该模块已集成到 `/src/models/index.ts`：

```typescript
import {
  SubagentModelConfig,
  subagentModelConfig,
  AGENT_TYPES,
  type ModelSelectionStrategy,
} from './models/subagent-config.js';
```

## 未来扩展

计划中的功能：
- [ ] 基于历史性能的自动模型优化
- [ ] 成本跟踪和报告
- [ ] A/B 测试不同模型配置
- [ ] 用户偏好学习
- [ ] 多模型并行执行和结果对比
