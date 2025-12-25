# Plan 模式功能对比分析

**文档版本**: 1.0.0
**分析日期**: 2025-12-25
**官方版本**: @anthropic-ai/claude-code v2.0.76
**对比范围**: T268-T275 (Plan 模式功能点)

---

## 📋 功能点概览

| 任务ID | 功能点 | 本项目状态 | 官方实现 | 完成度 |
|--------|--------|-----------|---------|--------|
| T268 | Plan 模式框架 | ✅ 部分实现 | ✅ 完整 | 60% |
| T269 | EnterPlanMode 工具 | ✅ 已实现 | ✅ 完整 | 75% |
| T270 | ExitPlanMode 工具 | ✅ 已实现 | ✅ 完整 | 70% |
| T271 | 计划文件管理 | ⚠️ 简化实现 | ✅ 完整 | 50% |
| T272 | 计划审批流程 | ⚠️ 基础实现 | ✅ 完整 | 40% |
| T273 | 计划执行追踪 | ⚠️ 简化实现 | ✅ 完整 | 45% |
| T274 | 计划模式 UI | ⚠️ 基础实现 | ✅ 完整 | 50% |
| T275 | 计划模式工具限制 | ✅ 已实现 | ✅ 完整 | 80% |

**总体完成度**: 58.75%

---

## T268: Plan 模式框架

### 本项目实现

**文件位置**:
- `/home/user/claude-code-open/src/agents/plan.ts` - PlanAgent 类
- `/home/user/claude-code-open/src/tools/planmode.ts` - 模式控制
- `/home/user/claude-code-open/src/agents/PLAN_AGENT.md` - 文档

**核心架构**:
```typescript
// 状态管理（全局变量）
let planModeActive = false;
let currentPlanFile: string | null = null;

export function isPlanModeActive(): boolean {
  return planModeActive;
}

export function setPlanMode(active: boolean, planFile?: string): void {
  planModeActive = active;
  currentPlanFile = planFile || null;
}

// PlanAgent 类
export class PlanAgent {
  private options: PlanOptions;

  async createPlan(): Promise<PlanResult> { /* ... */ }
  async analyzeRequirements(): Promise<RequirementsAnalysis> { /* ... */ }
  async identifyFiles(): Promise<CriticalFile[]> { /* ... */ }
  async assessRisks(): Promise<Risk[]> { /* ... */ }
  async generateAlternatives(): Promise<Alternative[]> { /* ... */ }
}

// 代理配置
export const PLAN_AGENT_CONFIG = {
  agentType: 'Plan',
  whenToUse: 'Software architect agent for designing implementation plans...',
  disallowedTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'ExitPlanMode'],
  source: 'built-in',
  model: 'inherit',
  baseDir: 'built-in',
  tools: ['*'],
};
```

**数据结构**:
```typescript
interface PlanOptions {
  task: string;
  context?: string;
  constraints?: string[];
  existingCode?: string[];
  perspective?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  thoroughness?: 'quick' | 'medium' | 'thorough';
}

interface PlanResult {
  summary: string;
  requirementsAnalysis: RequirementsAnalysis;
  architecturalDecisions: ArchitecturalDecision[];
  steps: PlanStep[];
  criticalFiles: CriticalFile[];
  risks: Risk[];
  alternatives: Alternative[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  estimatedHours?: number;
  recommendations?: string[];
  nextSteps?: string[];
}
```

### 官方实现

**核心架构** (从 cli.js 逆向):
```javascript
// 附件系统集成
case "plan_mode": return Z97(A);
case "plan_mode_reentry": {
  let B = `## Re-entering Plan Mode

  You are returning to plan mode after having previously exited it.
  A plan file exists at ${A.planFilePath} from your previous planning session.

  **Before proceeding with any new planning, you should:**
  1. Read the existing plan file to understand what was previously planned
  2. Evaluate the user's current request against that plan
  3. Decide how to proceed:
     - **Different task**: Start fresh by overwriting the existing plan
     - **Same task, continuing**: Modify the existing plan
  4. Continue on with the plan process and edit the plan file

  Treat this as a fresh planning session.`;
  return d7([f0({content: B, isMeta: !0})]);
}
case "plan_mode_exit": {
  let G = `## Exited Plan Mode

  You have exited plan mode. You can now make edits, run tools, and take actions.
  ${A.planExists ? `The plan file is located at ${A.planFilePath}` : ""}`;
  return d7([f0({content: G, isMeta: !0})]);
}

// 权限上下文集成
if ((await Q.getAppState()).toolPermissionContext.mode !== "plan") return [];

// 附件生成
async function Mx5(A, Q) {
  if ((await Q.getAppState()).toolPermissionContext.mode !== "plan") return [];

  if (A && A.length > 0) {
    let {turnCount: X, foundPlanModeAttachment: I} = Ox5(A);
    if (I && X < Ux5.TURNS_BETWEEN_ATTACHMENTS) return [];
  }

  let Z = rC(Q.agentId),
      Y = Jz(Q.agentId),
      J = [];

  if (GP0() && Y !== null) {
    J.push({type: "plan_mode_reentry", planFilePath: Z});
    df(!1);
  }

  return J.push({
    type: "plan_mode",
    isSubAgent: !!Q.agentId,
    planFilePath: Z,
    planExists: Y !== null
  }), J;
}
```

**阶段系统**:
```javascript
// Phase 1: Initial Understanding
Goal: Gain a comprehensive understanding of the user's request by reading
      through code and asking them questions.
Critical: In this phase you should only use the ${LL.agentType} subagent type.

// Phase 2: Broad Exploration
Goal: Generate multiple possible implementation approaches.

// Phase 3: Deep Dive
Goal: Deepen your understanding and alignment with user's request.

// Phase 4: Final Plan
Goal: Write your final plan to the plan file (the only file you can edit).

// Phase 5: Call ExitPlanMode
At the very end of your turn, once you have asked the user questions
and are happy with your final plan file - you should always call
${TL.name} to indicate to the user that you are done planning.
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **状态管理** | 全局变量 | 集成到 toolPermissionContext | 架构不同 |
| **附件系统** | ❌ 无 | ✅ plan_mode/plan_mode_reentry/plan_mode_exit | 缺失 |
| **阶段系统** | ❌ 无明确阶段 | ✅ 5个阶段 + 指导 | 缺失 |
| **重入支持** | ❌ 无 | ✅ plan_mode_reentry 附件 | 缺失 |
| **Agent 集成** | ⚠️ 独立 PlanAgent | ✅ 作为子代理运行 | 集成度低 |
| **系统提示词** | ✅ 完整 | ✅ 完整 | 相似 |
| **只读限制** | ✅ 文档说明 | ✅ 强制执行 | 实现方式不同 |

### 缺失功能

1. **附件系统集成** - 官方通过附件系统注入 plan 模式提示
2. **阶段化工作流** - 官方有明确的 5 个阶段指导
3. **重入检测** - 官方支持检测并处理重入 plan 模式
4. **权限上下文集成** - 官方与 toolPermissionContext.mode 深度集成
5. **子代理支持** - 官方支持在代理中使用 plan 模式

---

## T269: EnterPlanMode 工具

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/planmode.ts`

```typescript
export class EnterPlanModeTool extends BaseTool<Record<string, unknown>, ToolResult> {
  name = 'EnterPlanMode';
  description = `Use this tool when you encounter a complex task that requires
  careful planning and exploration before implementation.

  ## When to Use This Tool

  Use EnterPlanMode when ANY of these conditions apply:
  1. **Multiple Valid Approaches**: The task can be solved in several different ways
  2. **Significant Architectural Decisions**: Requires choosing between patterns
  3. **Large-Scale Changes**: Touches many files or systems
  4. **Unclear Requirements**: Need to explore before understanding scope
  5. **User Input Needed**: Will need clarifying questions before starting

  ## When NOT to Use This Tool
  - Simple, straightforward tasks with obvious implementation
  - Small bug fixes where the solution is clear
  - Adding a single function or small feature
  - Research-only tasks (use the Task tool with explore agent instead)
  `;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  async execute(_input: Record<string, unknown>): Promise<ToolResult> {
    if (planModeActive) {
      return {
        success: false,
        error: 'Already in plan mode. Use ExitPlanMode to exit first.',
      };
    }

    planModeActive = true;
    const planPath = process.cwd() + '/PLAN.md';
    currentPlanFile = planPath;

    return {
      success: true,
      output: `Entered plan mode.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation) EXCEPT the plan file
- Modifying existing files (no Edit operations) EXCEPT the plan file
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs
- Running ANY commands that change system state

## Plan File Info:
No plan file exists yet. Create your plan at ${planPath} using Write tool.
You should build your plan incrementally by writing to or editing this file.
NOTE that this is the only file you are allowed to edit.

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns
2. Identify similar features and architectural approaches
3. Consider multiple approaches and their trade-offs
4. Use AskUserQuestion if you need to clarify the approach
5. Design a concrete implementation strategy
6. When ready, use ExitPlanMode to present your plan for approval
`,
    };
  }
}
```

### 官方实现

**工具定义**:
```javascript
// 工具名称
var tI1 = "EnterPlanMode";

// Schema
qa5 = m.strictObject({});  // 无参数

// 描述
description = `Use this tool when you encounter a complex task that requires
careful planning and exploration before implementation.

## When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple.
Use it when ANY of these conditions apply:

1. **Multiple Valid Approaches**: The task can be solved in several different ways
2. **Significant Architectural Decisions**: Choose between architectural patterns
3. **Large-Scale Changes**: The task touches many files or systems
4. **Unclear Requirements**: Need to explore before understanding full scope
5. **User Input Needed**: Need clarifying questions
   - If you would use ${PI} to clarify the approach, use EnterPlanMode instead

Only skip EnterPlanMode for simple tasks:
- Simple, straightforward tasks with obvious implementation
- Small bug fixes where the solution is clear
- Adding a single function or small feature
- Research-only tasks

## Examples

### GOOD - Use EnterPlanMode:
User: "Add user authentication to the app"
User: "Optimize the database queries"
User: "Implement dark mode"

### BAD - Don't use EnterPlanMode:
User: "Fix the typo in the README"
User: "Add a console.log to debug this function"
User: "What files handle routing?"
`;

// UI 渲染
function Cd2(A, Q, B) {
  return gV.createElement(T, {flexDirection: "column", marginTop: 1},
    gV.createElement(T, {flexDirection: "row"},
      gV.createElement(C, {color: pM("plan")}, yX),
      gV.createElement(C, null, " Entered plan mode")),
    gV.createElement(T, {paddingLeft: 2},
      gV.createElement(C, {dimColor: !0},
        "Claude is now exploring and designing an implementation approach.")));
}

function $d2() {
  return gV.createElement(T, {flexDirection: "row", marginTop: 1},
    gV.createElement(C, {color: pM("default")}, yX),
    gV.createElement(C, null, " User declined to enter plan mode"));
}
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **工具名称** | EnterPlanMode | EnterPlanMode | ✅ 一致 |
| **参数** | 无参数 | 无参数 | ✅ 一致 |
| **描述文档** | ✅ 详细 | ✅ 详细 | 内容相似 |
| **输出格式** | ToolResult | ToolResult | ✅ 一致 |
| **状态检查** | ✅ 检查已在 plan mode | ✅ 检查 | ✅ 一致 |
| **计划文件路径** | process.cwd() + '/PLAN.md' | 动态生成（支持子代理） | 不同 |
| **UI 组件** | ❌ 无 | ✅ Cd2/\$d2 函数 | 缺失 |
| **权限集成** | ❌ 无 | ✅ 修改 toolPermissionContext | 缺失 |

### 缺失功能

1. **UI 渲染组件** - 缺少 React 组件来展示进入/拒绝 plan 模式
2. **权限上下文修改** - 未修改 toolPermissionContext.mode
3. **子代理支持** - 计划文件路径不支持子代理（需要 agentId）
4. **用户拒绝处理** - 缺少拒绝进入 plan 模式的 UI

---

## T270: ExitPlanMode 工具

### 本项目实现

```typescript
export class ExitPlanModeTool extends BaseTool<ExitPlanModeInput, ToolResult> {
  name = 'ExitPlanMode';
  description = `Use this tool when you are in plan mode and have finished
  writing your plan to the plan file and are ready for user approval.

  ## How This Tool Works
  - You should have already written your plan to the plan file
  - This tool does NOT take the plan content as a parameter
  - This tool simply signals that you're done planning
  - The user will see the contents of your plan file when they review it

  ## When to Use This Tool
  IMPORTANT: Only use this tool when the task requires planning the
  implementation steps of a task that requires writing code. For research
  tasks - do NOT use this tool.

  ## Handling Ambiguity in Plans
  Before using this tool, ensure your plan is clear. If there are multiple
  valid approaches or unclear requirements:
  1. Use the AskUserQuestion tool to clarify with the user
  2. Ask about specific implementation choices
  3. Clarify any assumptions
  4. Edit your plan file to incorporate user feedback
  5. Only proceed with ExitPlanMode after resolving ambiguities
  `;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  async execute(_input: ExitPlanModeInput): Promise<ToolResult> {
    if (!planModeActive) {
      return {
        success: false,
        error: 'Not in plan mode. Use EnterPlanMode first.',
      };
    }

    planModeActive = false;
    const planFile = currentPlanFile;
    currentPlanFile = null;

    let planContent = '';
    if (planFile) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(planFile)) {
          planContent = fs.readFileSync(planFile, 'utf-8');
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    const output = planFile
      ? `Exited plan mode.

Your plan has been saved to: ${planFile}
You can refer back to it if needed during implementation.

## Approved Plan:
${planContent}

Awaiting user approval to proceed with implementation.`
      : `Exited plan mode. Awaiting user approval to proceed with implementation.`;

    return {
      success: true,
      output,
    };
  }
}
```

### 官方实现

```javascript
// 工具名称
var mJ1 = "ExitPlanMode";
var DyA = "ExitPlanMode";

// 描述
cg2 = `Use this tool when you are in plan mode and have finished writing
your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in
  the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read
  the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user
  to review and approve
- The user will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the
implementation steps of a task that requires writing code. For research
tasks - do NOT use this tool.

## Handling Ambiguity in Plans
Before using this tool, ensure your plan is clear and unambiguous:
1. Use the ${PI} tool to clarify with the user
2. Ask about specific implementation choices
3. Clarify any assumptions that could affect the implementation
4. Edit your plan file to incorporate user feedback
5. Only proceed with ExitPlanMode after resolving ambiguities and updating
   the plan file
`;

// 输出消息格式
`Plan file: ${B}

**What happens next:**
1. Wait for the team lead to review your plan
2. You will receive a message in your inbox with approval/rejection
3. If approved, you can proceed with implementation

## Approved Plan:
${planContent}

Awaiting user approval to proceed.`
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **工具名称** | ExitPlanMode | ExitPlanMode | ✅ 一致 |
| **参数** | 无参数 | 无参数 | ✅ 一致 |
| **描述文档** | ✅ 详细 | ✅ 详细 | 内容相似 |
| **状态检查** | ✅ 检查是否在 plan mode | ✅ 检查 | ✅ 一致 |
| **读取计划文件** | ✅ 读取并包含在输出 | ✅ 读取 | ✅ 一致 |
| **输出格式** | 包含完整计划 | 包含完整计划 + 团队审批说明 | 略有不同 |
| **审批流程** | "Awaiting user approval" | "Wait for team lead to review" | 措辞不同 |
| **权限恢复** | ❌ 无 | ✅ 恢复 toolPermissionContext | 缺失 |

### 缺失功能

1. **团队协作提示** - 官方提到 "team lead" 和 "inbox"，暗示团队功能
2. **权限上下文恢复** - 未恢复 toolPermissionContext.mode
3. **计划存在验证** - 官方有 planExists 标志

---

## T271: 计划文件管理

### 本项目实现

**简单的全局变量**:
```typescript
// src/tools/planmode.ts
let currentPlanFile: string | null = null;

export function getPlanFile(): string | null {
  return currentPlanFile;
}

export function setPlanMode(active: boolean, planFile?: string): void {
  planModeActive = active;
  currentPlanFile = planFile || null;
}

// 计划文件路径固定
const planPath = process.cwd() + '/PLAN.md';
```

### 官方实现

**复杂的路径管理**:
```javascript
// 支持子代理的路径生成
let Z = rC(Q.agentId),  // rC 函数生成计划文件路径
    Y = Jz(Q.agentId);  // Jz 函数检查计划文件是否存在

// 附件中包含路径和存在状态
{
  type: "plan_mode",
  isSubAgent: !!Q.agentId,
  planFilePath: Z,
  planExists: Y !== null
}

// 重入检测
if (GP0() && Y !== null) {
  J.push({type: "plan_mode_reentry", planFilePath: Z});
  df(!1);
}

// 计划文件信息附件
## Plan File Info:
${A.planExists
  ? `A plan file already exists at ${A.planFilePath}. You can read it and
     make incremental edits using the ${qz.name} tool.`
  : `No plan file exists yet. You should create your plan at ${A.planFilePath}
     using the ${PV.name} tool.`}
You should build your plan incrementally by writing to or editing this file.
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **路径管理** | 固定路径 | 动态路径（支持子代理） | 功能简化 |
| **存在检测** | ❌ 无 | ✅ planExists 标志 | 缺失 |
| **重入检测** | ❌ 无 | ✅ 检测并生成 reentry 附件 | 缺失 |
| **子代理支持** | ❌ 无 | ✅ 基于 agentId 生成路径 | 缺失 |
| **增量编辑** | 文档提及 | 系统提示引导 | 实现不完整 |

### 缺失功能

1. **动态路径生成** - 不支持基于 agentId 的路径
2. **计划文件存在检测** - 无自动检测机制
3. **重入检测和处理** - 无法检测是否重新进入 plan 模式
4. **增量编辑指导** - 缺少系统级的增量编辑引导

---

## T272: 计划审批流程

### 本项目实现

**基础的等待审批**:
```typescript
// ExitPlanMode 输出
const output = planFile
  ? `Exited plan mode.

Your plan has been saved to: ${planFile}
You can refer back to it if needed during implementation.

## Approved Plan:
${planContent}

Awaiting user approval to proceed with implementation.`
  : `Exited plan mode. Awaiting user approval to proceed.`;
```

**无明确的审批机制** - 仅在输出中提及等待审批

### 官方实现

**结构化的审批流程**:
```javascript
// 输出格式
`Plan file: ${B}

**What happens next:**
1. Wait for the team lead to review your plan
2. You will receive a message in your inbox with approval/rejection
3. If approved, you can proceed with implementation

## Approved Plan:
${planContent}

Awaiting user approval to proceed.`

// 5 阶段工作流的第 5 阶段
### Phase 5: Call ${TL.name}
At the very end of your turn, once you have asked the user questions
and are happy with your final plan file - you should always call ${TL.name}
to indicate to the user that you are done planning.

This is critical - your turn should only end with either asking the user
a question or calling ${TL.name}. Do not stop unless it's for these 2 reasons.

// 模糊性处理指导
## Handling Ambiguity in Plans
Before using this tool, ensure your plan is clear and unambiguous:
1. Use the ${PI} tool to clarify with the user
2. Ask about specific implementation choices
3. Clarify any assumptions
4. Edit your plan file to incorporate user feedback
5. Only proceed with ExitPlanMode after resolving ambiguities
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **审批说明** | 简单的 "等待审批" | 详细的 3 步流程 | 信息量不足 |
| **团队协作** | ❌ 无提及 | ✅ "team lead" 审批 | 缺失 |
| **收件箱机制** | ❌ 无 | ✅ "inbox" 通知 | 缺失 |
| **模糊性处理** | ✅ 有指导 | ✅ 有指导 | 相似 |
| **阶段化引导** | ❌ 无 | ✅ 5 阶段系统 | 缺失 |

### 缺失功能

1. **团队审批机制** - 无 "team lead" 概念
2. **收件箱通知** - 无消息传递机制
3. **审批/拒绝处理** - 无明确的审批结果处理
4. **阶段化工作流** - 无 5 阶段系统

---

## T273: 计划执行追踪

### 本项目实现

**基础的布尔状态**:
```typescript
// src/tools/planmode.ts
let planModeActive = false;

export function isPlanModeActive(): boolean {
  return planModeActive;
}
```

**PlanResult 结构**:
```typescript
interface PlanResult {
  summary: string;
  requirementsAnalysis: RequirementsAnalysis;
  architecturalDecisions: ArchitecturalDecision[];
  steps: PlanStep[];  // 步骤列表
  criticalFiles: CriticalFile[];
  risks: Risk[];
  alternatives: Alternative[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  estimatedHours?: number;
  recommendations?: string[];
  nextSteps?: string[];
}

interface PlanStep {
  step: number;
  description: string;
  files: string[];
  complexity: 'low' | 'medium' | 'high';
  dependencies: number[];  // 前置步骤
  estimatedMinutes?: number;
  risks?: string[];
}
```

### 官方实现

**权限上下文集成**:
```javascript
// 与权限系统集成
if ((await Q.getAppState()).toolPermissionContext.mode !== "plan") return [];

// 工具限制（自动强制执行）
async function Mx5(A, Q) {
  if ((await Q.getAppState()).toolPermissionContext.mode !== "plan")
    return [];
  // ...
}

// 附件频率控制
if (A && A.length > 0) {
  let {turnCount: X, foundPlanModeAttachment: I} = Ox5(A);
  if (I && X < Ux5.TURNS_BETWEEN_ATTACHMENTS) return [];
}

// 阶段追踪（通过系统提示）
### Phase 1: Initial Understanding
### Phase 2: Broad Exploration
### Phase 3: Deep Dive
### Phase 4: Final Plan
### Phase 5: Call ExitPlanMode
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **状态追踪** | 简单布尔值 | mode in toolPermissionContext | 集成度低 |
| **阶段追踪** | ❌ 无 | ✅ 5 阶段系统 | 缺失 |
| **附件频率控制** | ❌ 无 | ✅ TURNS_BETWEEN_ATTACHMENTS | 缺失 |
| **工具限制执行** | ⚠️ 配置中声明 | ✅ 自动强制执行 | 执行力度弱 |
| **步骤依赖追踪** | ✅ PlanStep.dependencies | ❓ 未知 | 可能更好 |

### 缺失功能

1. **权限上下文集成** - 未使用 toolPermissionContext.mode
2. **阶段状态追踪** - 无法追踪当前处于哪个阶段
3. **附件频率控制** - 无限制附件生成频率
4. **自动工具限制** - 工具限制非强制执行

---

## T274: 计划模式 UI

### 本项目实现

**无独立 UI 组件** - 仅通过 ToolResult 输出文本

```typescript
// EnterPlanMode 输出
return {
  success: true,
  output: `Entered plan mode.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
...
`,
};

// ExitPlanMode 输出
return {
  success: true,
  output: `Exited plan mode.

Your plan has been saved to: ${planFile}
...
`,
};
```

### 官方实现

**React 组件渲染**:
```javascript
// EnterPlanMode UI 组件
function Cd2(A, Q, B) {
  return gV.createElement(T, {flexDirection: "column", marginTop: 1},
    gV.createElement(T, {flexDirection: "row"},
      gV.createElement(C, {color: pM("plan")}, yX),  // 图标
      gV.createElement(C, null, " Entered plan mode")),
    gV.createElement(T, {paddingLeft: 2},
      gV.createElement(C, {dimColor: !0},
        "Claude is now exploring and designing an implementation approach.")));
}

// 拒绝 UI
function $d2() {
  return gV.createElement(T, {flexDirection: "row", marginTop: 1},
    gV.createElement(C, {color: pM("default")}, yX),
    gV.createElement(C, null, " User declined to enter plan mode"));
}

// 附件渲染
case "plan_mode": return Z97(A);
case "plan_mode_reentry": {
  return d7([f0({content: B, isMeta: !0})]);
}
case "plan_mode_exit": {
  return d7([f0({content: G, isMeta: !0})]);
}

// 颜色主题
color: pM("plan")  // 特殊的 plan 模式颜色
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **UI 框架** | ❌ 无 | ✅ React + Ink | 缺失 |
| **进入提示** | 纯文本 | React 组件 + 图标 | UI 简陋 |
| **退出提示** | 纯文本 | React 组件 + 附件 | UI 简陋 |
| **拒绝提示** | ❌ 无 | ✅ 专用组件 | 缺失 |
| **颜色主题** | ❌ 无 | ✅ pM("plan") | 缺失 |
| **图标** | ❌ 无 | ✅ yX 图标 | 缺失 |

### 缺失功能

1. **React 组件** - 无任何 UI 组件
2. **视觉反馈** - 缺少颜色、图标等视觉元素
3. **拒绝 UI** - 无用户拒绝的 UI 展示
4. **附件渲染** - 无附件系统的 UI 支持

---

## T275: 计划模式工具限制

### 本项目实现

**配置中定义限制**:
```typescript
// src/agents/plan.ts
export const PLAN_AGENT_CONFIG = {
  agentType: 'Plan',
  whenToUse: 'Software architect agent for designing implementation plans...',
  disallowedTools: [
    'Write',       // 禁止写入文件
    'Edit',        // 禁止编辑文件
    'MultiEdit',   // 禁止多文件编辑
    'NotebookEdit', // 禁止编辑笔记本
    'ExitPlanMode', // 禁止退出计划模式（主线程工具）
  ],
  source: 'built-in' as const,
  model: 'inherit' as const,
  baseDir: 'built-in',
  tools: ['*'] as const,  // 允许所有其他工具
};

// 系统提示词中的说明
=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to explore the codebase and design implementation plans.
```

### 官方实现

**权限系统强制执行**:
```javascript
// 工具过滤（基于 toolPermissionContext.mode）
if ((await Q.getAppState()).toolPermissionContext.mode !== "plan")
  return [];

// 系统提示词（相同的限制说明）
=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to explore the codebase and design implementation plans.
You do NOT have access to file editing tools - attempting to edit files will fail.

// 工具可用性检查
canUseTool(toolName) {
  if (mode === "plan" && ["Write", "Edit", "MultiEdit", ...].includes(toolName)) {
    return false;  // 禁止使用
  }
  return true;
}

// 计划文件例外
NOTE that this is the only file you are allowed to edit - other than this
you are only allowed to take READ-ONLY actions.
```

### 差异分析

| 维度 | 本项目 | 官方实现 | 差距 |
|------|--------|---------|------|
| **限制定义** | disallowedTools 列表 | 权限系统集成 | 机制不同 |
| **执行方式** | ⚠️ Agent 配置 | ✅ toolPermissionContext 强制 | 执行力度弱 |
| **计划文件例外** | ✅ 文档说明 | ✅ 系统提示 | 相似 |
| **只读命令** | ✅ 允许 Bash 只读 | ✅ 允许 ls/git 等 | 相似 |
| **禁用工具列表** | 5 个工具 | 未知（由权限系统决定） | 可能相似 |
| **系统提示** | ✅ 详细说明 | ✅ 详细说明 | 几乎一致 |

### 差异说明

1. **执行机制不同**:
   - 本项目：通过 Agent 配置的 disallowedTools，依赖 Agent 系统执行
   - 官方：通过 toolPermissionContext.mode，权限系统自动过滤工具

2. **强制程度**:
   - 本项目：配置级限制，可能可以绕过
   - 官方：系统级限制，无法绕过

3. **一致性**:
   - 系统提示词几乎完全一致
   - 禁用的工具类型相同（Write, Edit, MultiEdit, NotebookEdit）
   - 计划文件例外处理相同

---

## 📊 总体差距分析

### 架构层面

| 方面 | 本项目 | 官方实现 | 影响 |
|------|--------|---------|------|
| **状态管理** | 全局变量 | 集成到 toolPermissionContext | 🔴 高 |
| **附件系统** | 无 | 完整的附件系统 | 🔴 高 |
| **权限集成** | 弱 | 深度集成 | 🔴 高 |
| **UI 系统** | 无 | React 组件 | 🟡 中 |
| **子代理支持** | 无 | 完整支持 | 🟡 中 |

### 功能层面

| 功能 | 完成度 | 优先级 | 建议 |
|------|--------|--------|------|
| **EnterPlanMode 工具** | 75% | 🔴 高 | 添加 UI 组件和权限集成 |
| **ExitPlanMode 工具** | 70% | 🔴 高 | 添加审批流程和权限恢复 |
| **计划文件管理** | 50% | 🔴 高 | 实现动态路径和重入检测 |
| **计划审批流程** | 40% | 🟡 中 | 完善审批机制 |
| **计划执行追踪** | 45% | 🟡 中 | 集成权限上下文 |
| **计划模式 UI** | 50% | 🟡 中 | 开发 React 组件 |
| **工具限制** | 80% | 🟢 低 | 强化执行机制 |

### 代码质量

| 维度 | 评分 | 说明 |
|------|------|------|
| **类型定义** | ⭐⭐⭐⭐⭐ | 完整的 TypeScript 类型 |
| **文档** | ⭐⭐⭐⭐⭐ | 详细的注释和文档 |
| **系统提示** | ⭐⭐⭐⭐⭐ | 与官方几乎一致 |
| **架构设计** | ⭐⭐⭐ | PlanAgent 设计良好，但集成不足 |
| **实现完整性** | ⭐⭐⭐ | 核心功能可用，但缺少集成 |

---

## 🎯 改进建议

### 高优先级（必须改进）

1. **实现附件系统集成**
   ```typescript
   // 需要实现
   interface PlanModeAttachment {
     type: 'plan_mode' | 'plan_mode_reentry' | 'plan_mode_exit';
     planFilePath: string;
     planExists: boolean;
     isSubAgent?: boolean;
   }

   function generatePlanModeAttachment(
     agentId?: string
   ): PlanModeAttachment[] {
     const planPath = getPlanFilePath(agentId);
     const planExists = checkPlanFileExists(planPath);

     const attachments: PlanModeAttachment[] = [];

     // 检测重入
     if (isReenteringPlanMode() && planExists) {
       attachments.push({
         type: 'plan_mode_reentry',
         planFilePath: planPath,
         planExists: true,
       });
     }

     attachments.push({
       type: 'plan_mode',
       planFilePath: planPath,
       planExists,
       isSubAgent: !!agentId,
     });

     return attachments;
   }
   ```

2. **集成权限上下文**
   ```typescript
   // EnterPlanMode
   async execute() {
     // 设置权限模式
     await this.toolUseContext.setAppState((state) => ({
       ...state,
       toolPermissionContext: {
         ...state.toolPermissionContext,
         mode: 'plan',
       },
     }));

     planModeActive = true;
     // ...
   }

   // ExitPlanMode
   async execute() {
     // 恢复权限模式
     await this.toolUseContext.setAppState((state) => ({
       ...state,
       toolPermissionContext: {
         ...state.toolPermissionContext,
         mode: 'default',
       },
     }));

     planModeActive = false;
     // ...
   }
   ```

3. **动态计划文件路径**
   ```typescript
   function getPlanFilePath(agentId?: string): string {
     const cwd = process.cwd();

     if (!agentId) {
       // 主线程
       return path.join(cwd, 'PLAN.md');
     }

     // 子代理
     const agentDir = path.join(cwd, '.claude', 'agents', agentId);
     if (!fs.existsSync(agentDir)) {
       fs.mkdirSync(agentDir, { recursive: true });
     }

     return path.join(agentDir, 'PLAN.md');
   }

   function checkPlanFileExists(planPath: string): boolean {
     return fs.existsSync(planPath);
   }
   ```

### 中优先级（建议改进）

4. **实现 5 阶段系统**
   ```typescript
   enum PlanPhase {
     InitialUnderstanding = 1,
     BroadExploration = 2,
     DeepDive = 3,
     FinalPlan = 4,
     ExitPlanMode = 5,
   }

   class PlanModeState {
     active: boolean = false;
     currentPhase: PlanPhase = PlanPhase.InitialUnderstanding;
     planFile: string | null = null;
     turnsSinceLastAttachment: number = 0;

     advancePhase(): void {
       if (this.currentPhase < PlanPhase.ExitPlanMode) {
         this.currentPhase++;
       }
     }

     getPhaseGuidance(): string {
       switch (this.currentPhase) {
         case PlanPhase.InitialUnderstanding:
           return 'Gain comprehensive understanding. Use Explore agent.';
         case PlanPhase.BroadExploration:
           return 'Generate multiple implementation approaches.';
         case PlanPhase.DeepDive:
           return 'Deepen understanding and align with user request.';
         case PlanPhase.FinalPlan:
           return 'Write final plan to plan file.';
         case PlanPhase.ExitPlanMode:
           return 'Call ExitPlanMode to indicate completion.';
       }
     }
   }
   ```

5. **UI 组件实现**
   ```typescript
   // src/ui/components/PlanMode.tsx
   import React from 'react';
   import { Box, Text } from 'ink';

   export function PlanModeEntered() {
     return (
       <Box flexDirection="column" marginTop={1}>
         <Box flexDirection="row">
           <Text color="cyan">📋</Text>
           <Text> Entered plan mode</Text>
         </Box>
         <Box paddingLeft={2}>
           <Text dimColor>
             Claude is now exploring and designing an implementation approach.
           </Text>
         </Box>
       </Box>
     );
   }

   export function PlanModeDeclined() {
     return (
       <Box flexDirection="row" marginTop={1}>
         <Text color="yellow">⚠️</Text>
         <Text> User declined to enter plan mode</Text>
       </Box>
     );
   }

   export function PlanModeExited({ planFile }: { planFile: string }) {
     return (
       <Box flexDirection="column" marginTop={1}>
         <Box flexDirection="row">
           <Text color="green">✅</Text>
           <Text> Exited plan mode</Text>
         </Box>
         <Box paddingLeft={2}>
           <Text dimColor>Plan saved to: {planFile}</Text>
         </Box>
       </Box>
     );
   }
   ```

6. **重入检测**
   ```typescript
   class PlanModeTracker {
     private history: Array<{
       timestamp: number;
       action: 'enter' | 'exit';
       planFile: string;
     }> = [];

     recordEnter(planFile: string): void {
       this.history.push({
         timestamp: Date.now(),
         action: 'enter',
         planFile,
       });
     }

     recordExit(planFile: string): void {
       this.history.push({
         timestamp: Date.now(),
         action: 'exit',
         planFile,
       });
     }

     isReentering(planFile: string): boolean {
       const lastAction = this.history[this.history.length - 1];

       // 如果上次是退出且文件相同，则是重入
       if (lastAction?.action === 'exit' && lastAction.planFile === planFile) {
         return true;
       }

       return false;
     }
   }
   ```

### 低优先级（可选改进）

7. **团队审批机制**
   - 实现 "team lead" 概念
   - 添加 "inbox" 消息系统
   - 支持审批/拒绝工作流

8. **附件频率控制**
   ```typescript
   const TURNS_BETWEEN_ATTACHMENTS = 3;

   function shouldGenerateAttachment(
     messages: Message[],
     lastAttachmentIndex: number
   ): boolean {
     const turnsSince = messages.length - lastAttachmentIndex;
     return turnsSince >= TURNS_BETWEEN_ATTACHMENTS;
   }
   ```

---

## 📝 实现路线图

### 第一阶段：核心集成（2-3天）
- [ ] 实现附件系统集成
- [ ] 集成权限上下文（mode: 'plan'）
- [ ] 动态计划文件路径
- [ ] 计划文件存在检测

### 第二阶段：功能完善（3-4天）
- [ ] 5 阶段系统
- [ ] 重入检测和处理
- [ ] UI 组件开发
- [ ] 附件频率控制

### 第三阶段：优化提升（2-3天）
- [ ] 团队审批机制
- [ ] 子代理支持测试
- [ ] 性能优化
- [ ] 文档完善

---

## 🔍 官方实现亮点

1. **附件系统设计** - 通过附件注入 plan 模式提示，优雅且可扩展
2. **阶段化工作流** - 5 个清晰的阶段，引导 Claude 完成规划
3. **重入检测** - 智能检测并处理重新进入 plan 模式的情况
4. **权限深度集成** - toolPermissionContext.mode 自动控制工具可用性
5. **团队协作支持** - "team lead" 和 "inbox" 暗示更大的协作系统

---

## 📚 参考资料

### 本项目文件
- `/home/user/claude-code-open/src/tools/planmode.ts` - Plan 模式工具实现
- `/home/user/claude-code-open/src/agents/plan.ts` - PlanAgent 类
- `/home/user/claude-code-open/src/agents/PLAN_AGENT.md` - Plan Agent 文档
- `/home/user/claude-code-open/src/permissions/index.ts` - 权限系统

### 官方实现
- `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js` (行 1767-3380)
  - EnterPlanMode 工具定义
  - ExitPlanMode 工具定义
  - plan_mode 附件系统
  - 5 阶段系统提示

---

## ✅ 结论

Plan 模式是 Claude Code 的高级功能，用于引导 AI 进行结构化的软件设计和实现规划。本项目已实现核心功能（58.75%），但缺少关键的集成组件：

**优势**:
- ✅ 完整的类型定义和数据结构
- ✅ 详细的系统提示词（与官方几乎一致）
- ✅ PlanAgent 架构设计良好
- ✅ 工具限制配置完整

**不足**:
- ❌ 缺少附件系统集成
- ❌ 未集成权限上下文
- ❌ 无 5 阶段工作流
- ❌ 无重入检测
- ❌ 缺少 UI 组件

**建议**: 优先实现附件系统和权限集成，这是 Plan 模式正常工作的基础。然后添加 5 阶段系统和 UI 组件以提升用户体验。

---

**文档生成时间**: 2025-12-25
**分析工具**: Claude Code (Sonnet 4.5)
**下一步**: 实现附件系统集成 (#268)
