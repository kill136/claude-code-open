# Plan 代理 - 软件架构师

Plan 代理是 Claude Code 的内置代理之一，专门用于设计软件实现计划。它充当软件架构师的角色，帮助用户规划复杂功能的实现策略。

## 核心特点

### 🎯 核心职责
- **需求分析** - 分解功能和非功能需求
- **架构设计** - 做出关键架构决策并解释权衡
- **实现规划** - 生成详细的步骤化实现计划
- **风险评估** - 识别技术、架构和其他风险
- **方案对比** - 提供替代实现方案的优劣分析

### 🔒 只读模式
Plan 代理运行在**严格的只读模式**下：
- ❌ 不能创建、修改或删除任何文件
- ❌ 不能运行改变系统状态的命令
- ✅ 只能探索代码库和设计计划
- ✅ 可以使用 Glob、Grep、Read、Bash (只读) 等工具

### 🛠️ 允许的工具
- **Glob** - 文件模式匹配
- **Grep** - 代码搜索
- **Read** - 读取文件内容
- **Bash** - 只读命令 (ls, git status, git log, git diff 等)
- **所有其他非修改工具**

### 🚫 禁用的工具
- Write - 写入文件
- Edit - 编辑文件
- MultiEdit - 批量编辑
- NotebookEdit - 编辑笔记本
- ExitPlanMode - 退出计划模式

## 数据结构

### PlanOptions - 代理选项
```typescript
interface PlanOptions {
  task: string;              // 任务描述
  context?: string;          // 额外上下文
  constraints?: string[];    // 技术约束
  existingCode?: string[];   // 现有代码参考
  perspective?: string;      // 设计视角
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  thoroughness?: 'quick' | 'medium' | 'thorough';
}
```

### PlanResult - 计划结果
```typescript
interface PlanResult {
  summary: string;                          // 计划摘要
  requirementsAnalysis: RequirementsAnalysis; // 需求分析
  architecturalDecisions: ArchitecturalDecision[]; // 架构决策
  steps: PlanStep[];                        // 实现步骤
  criticalFiles: CriticalFile[];            // 关键文件 (3-5个)
  risks: Risk[];                            // 风险评估
  alternatives: Alternative[];              // 替代方案
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  estimatedHours?: number;                  // 预计耗时
  recommendations?: string[];               // 建议
  nextSteps?: string[];                     // 后续步骤
}
```

### PlanStep - 实现步骤
```typescript
interface PlanStep {
  step: number;              // 步骤编号
  description: string;       // 步骤描述
  files: string[];           // 涉及的文件
  complexity: 'low' | 'medium' | 'high';
  dependencies: number[];    // 依赖的前置步骤
  estimatedMinutes?: number; // 预计耗时
  risks?: string[];          // 潜在风险
}
```

### CriticalFile - 关键文件
```typescript
interface CriticalFile {
  path: string;      // 文件路径
  reason: string;    // 为什么关键
  importance: number; // 重要程度 (1-5)
  isNew?: boolean;   // 是否需要新建
}
```

### Risk - 风险评估
```typescript
interface Risk {
  category: 'technical' | 'architectural' | 'compatibility' |
            'performance' | 'security' | 'maintainability';
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;  // 缓解措施
  impact?: string[];    // 影响范围
}
```

### Alternative - 替代方案
```typescript
interface Alternative {
  name: string;
  description: string;
  pros: string[];      // 优势
  cons: string[];      // 劣势
  bestFor?: string;    // 适用场景
  recommended?: boolean;
}
```

### ArchitecturalDecision - 架构决策
```typescript
interface ArchitecturalDecision {
  decision: string;              // 决策点
  chosen: string;                // 选择的方案
  alternatives: string[];        // 其他考虑过的方案
  rationale: string;             // 选择理由
  tradeoffs?: {
    benefits: string[];
    drawbacks: string[];
  };
}
```

### RequirementsAnalysis - 需求分析
```typescript
interface RequirementsAnalysis {
  functionalRequirements: string[];      // 功能需求
  nonFunctionalRequirements: string[];   // 非功能需求
  technicalConstraints: string[];        // 技术约束
  successCriteria: string[];             // 成功标准
  outOfScope?: string[];                 // 范围外事项
  assumptions?: string[];                // 假设条件
}
```

## 使用示例

### 基本使用
```typescript
import { createPlanAgent } from './agents';

// 创建 Plan 代理
const planAgent = createPlanAgent({
  task: 'Add user authentication to the application',
  context: 'We are building a Node.js web application with Express',
  constraints: [
    'Must use JWT for token management',
    'Must be compatible with existing user database schema',
    'Must support social login (Google, GitHub)',
  ],
  existingCode: [
    'src/routes/auth.ts',
    'src/models/user.ts',
  ],
  thoroughness: 'thorough',
});

// 生成完整计划
const plan = await planAgent.createPlan();

console.log('Plan Summary:', plan.summary);
console.log('Steps:', plan.steps);
console.log('Critical Files:', plan.criticalFiles);
console.log('Risks:', plan.risks);
```

### 分步使用
```typescript
// 1. 分析需求
const requirements = await planAgent.analyzeRequirements();
console.log('Requirements:', requirements);

// 2. 识别关键文件
const files = await planAgent.identifyFiles();
console.log('Critical Files:', files);

// 3. 评估风险
const risks = await planAgent.assessRisks();
console.log('Risks:', risks);

// 4. 生成替代方案
const alternatives = await planAgent.generateAlternatives();
console.log('Alternatives:', alternatives);
```

## 工作流程

Plan 代理遵循以下工作流程：

### 1. 理解需求 (Understand Requirements)
- 解析用户提供的任务描述
- 识别功能和非功能需求
- 确定技术约束和成功标准

### 2. 彻底探索 (Explore Thoroughly)
- 使用 Glob 查找相关文件
- 使用 Grep 搜索现有模式和约定
- 使用 Read 阅读关键文件
- 使用 Bash 执行只读命令 (git log, git diff 等)
- 理解当前架构
- 识别相似功能作为参考
- 追踪相关代码路径

### 3. 设计解决方案 (Design Solution)
- 基于探索结果创建实现方案
- 考虑架构权衡
- 遵循现有模式和约定
- 做出关键架构决策

### 4. 详细规划 (Detail the Plan)
- 生成步骤化实现策略
- 识别依赖关系和执行顺序
- 估算复杂度和时间
- 预见潜在挑战
- 列出 3-5 个最关键的文件

## 系统提示词

Plan 代理使用专门的系统提示词，强调：
- 只读模式和禁止文件修改
- 彻底探索代码库的重要性
- 架构决策的权衡分析
- 必须输出关键文件列表

## 代理配置

```typescript
export const PLAN_AGENT_CONFIG = {
  agentType: 'Plan',
  whenToUse: 'Software architect agent for designing implementation plans...',
  disallowedTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'ExitPlanMode'],
  source: 'built-in',
  model: 'inherit',
  baseDir: 'built-in',
  tools: ['*'],  // 允许所有工具（除了禁用的）
};
```

## 最佳实践

### ✅ 推荐做法
1. **提供详细的任务描述** - 包含背景、目标、限制条件
2. **列出技术约束** - 明确必须遵守的技术要求
3. **指定现有代码参考** - 帮助代理理解现有架构
4. **选择合适的详细程度** - quick/medium/thorough
5. **审查架构决策** - 仔细评估代理提出的权衡分析
6. **验证关键文件列表** - 确保涵盖了所有重要文件

### ❌ 避免事项
1. 不要期望代理修改文件 - 它只能规划
2. 不要提供模糊的需求 - 越具体越好
3. 不要忽略风险评估 - 提前识别问题
4. 不要跳过替代方案分析 - 可能有更好的方法

## 与其他代理的对比

| 特性 | Plan 代理 | Explore 代理 | general-purpose 代理 |
|------|---------|------------|---------------------|
| 主要用途 | 架构设计和规划 | 快速代码探索 | 通用研究任务 |
| 允许修改文件 | ❌ 否 | ❌ 否 | ✅ 是 |
| 输出格式 | 结构化计划 | 搜索结果 | 自由格式 |
| 推荐模型 | inherit (Sonnet) | Haiku | 根据任务选择 |
| 典型用时 | 中-长 | 短-中 | 变化大 |

## 实现细节

### 当前状态
- ✅ 完整的类型定义
- ✅ 系统提示词（基于官方实现）
- ✅ 核心接口和方法
- ⚠️ 简化的执行逻辑（待完善）

### 待完善功能
- [ ] 完整的 Claude API 集成
- [ ] 真实的工具调用
- [ ] 响应解析和结构化提取
- [ ] 持久化和恢复机制
- [ ] 进度跟踪和中间结果

## 文件信息

- **文件路径**: `/home/user/claude-code-open/src/agents/plan.ts`
- **代码行数**: 530 行
- **导出位置**: `src/agents/index.ts`
- **依赖**: Node.js 标准库 (fs, path)

## 相关资源

- 官方 Plan 代理说明: 见 `docs/official-sdk-tools.d.ts`
- Agent 工具实现: `src/tools/agent.ts`
- Explore 代理参考: `src/agents/explore.ts`

## 版本历史

### v1.0.0 (2025-12-24)
- ✨ 初始实现
- 📝 完整的类型定义
- 🎯 基于官方 Plan 代理的系统提示词
- 🔒 严格的只读模式
- 📊 结构化的计划输出格式
