# 工具系统 - 其他工具功能点对比分析 (T105-T115)

本文档对比分析本项目开源实现与官方 @anthropic-ai/claude-code 包在其他工具功能方面的差异。

分析基于：
- 本项目源码：`/home/user/claude-code-open/src/tools/` 和 `/home/user/claude-code-open/src/agents/`
- 官方包：`/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/`

---

## T105: TodoWrite 工具

### 功能概述
TodoWrite 工具用于创建和管理任务列表，帮助追踪复杂的多步骤任务执行进度。

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/todo.ts`

**核心特性**:
```typescript
export class TodoWriteTool extends BaseTool<TodoWriteInput, ToolResult> {
  name = 'TodoWrite';

  // 输入 schema
  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', minLength: 1 },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed']
              },
              activeForm: { type: 'string', minLength: 1 },
            },
            required: ['content', 'status', 'activeForm']
          }
        }
      }
    };
  }

  // 验证逻辑：只能有一个 in_progress 任务
  async execute(input: TodoWriteInput): Promise<ToolResult> {
    const inProgress = todos.filter(t => t.status === 'in_progress');
    if (inProgress.length > 1) {
      return { success: false, error: 'Only one task can be in_progress at a time.' };
    }
    // ...
  }
}
```

**全局状态管理**:
```typescript
let currentTodos: TodoItem[] = [];

export function getTodos(): TodoItem[] {
  return [...currentTodos];
}

export function setTodos(todos: TodoItem[]): void {
  currentTodos = [...todos];
}
```

**输出格式**:
```
Todos updated:
1. [○] Create feature
2. [●] Implement logic
3. [✓] Write tests
```

### 官方实现

**类型定义** (`sdk-tools.d.ts`):
```typescript
export interface TodoWriteInput {
  todos: {
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm: string;
  }[];
}
```

**使用指南** (从 `cli.js` 提取):
```
## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps
2. Non-trivial and complex tasks
3. User explicitly requests todo list
4. User provides multiple tasks
5. After receiving new instructions
6. When you start working on a task - Mark it as in_progress BEFORE beginning work
7. After completing a task - Mark it as completed and add follow-up tasks

## When NOT to Use This Tool
1. There is only a single, straightforward task
2. The task is trivial
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States:
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Task finished successfully

## Important Rules:
- Exactly ONE task must be in_progress at any time (not less, not more)
- Complete current tasks before starting new ones
- ONLY mark a task as completed when you have FULLY accomplished it
- Never mark a task as completed if tests are failing or implementation is partial
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **基本接口** | ✅ 完全实现 | ✅ 标准定义 | 接口定义完全一致 |
| **状态枚举** | ✅ 三种状态 | ✅ 三种状态 | pending/in_progress/completed |
| **activeForm 字段** | ✅ 必需字段 | ✅ 必需字段 | 现在进行时形式 |
| **验证逻辑** | ✅ 基本验证 | ✅ 严格验证 | 本项目只验证 in_progress 数量 |
| **使用指南** | ⚠️ 简单描述 | ✅ 详细文档 | 官方有完整的使用场景和示例 |
| **状态持久化** | ✅ 内存存储 | ❓ 未知 | 本项目使用全局变量 |
| **输出格式** | ✅ 美化输出 | ✅ 格式化输出 | 使用图标展示状态 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐ (4/5)
- 核心功能完整
- 状态验证正确
- 缺少详细的使用指南集成

**代码质量**: ⭐⭐⭐⭐ (4/5)
- 类型安全
- 逻辑清晰
- 可以添加更多验证规则

**与官方一致性**: ⭐⭐⭐⭐⭐ (5/5)
- 接口定义完全一致
- 行为符合预期

---

## T106: TodoWrite 状态管理

### 功能概述
管理任务的状态转换、验证规则和执行流程。

### 本项目实现

**状态管理逻辑**:
```typescript
// 验证只有一个 in_progress
const inProgress = todos.filter(t => t.status === 'in_progress');
if (inProgress.length > 1) {
  return {
    success: false,
    error: 'Only one task can be in_progress at a time.',
  };
}

// 保存状态
setTodos(todos);

// 生成状态图标
const statusIcons = {
  pending: '○',
  in_progress: '●',
  completed: '✓',
};
```

### 官方实现

**状态管理规则** (从 prompt 提取):
```
Task Management:
- Update task status in real-time as you work
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- Exactly ONE task must be in_progress at any time (not less, not more)
- Complete current tasks before starting new ones
- Remove tasks that are no longer relevant from the list entirely

Task Completion Requirements:
- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors, blockers, or cannot finish, keep the task as in_progress
- When blocked, create a new task describing what needs to be resolved
- Never mark a task as completed if:
  - Tests are failing
  - Implementation is partial
  - You encountered unresolved errors
  - You couldn't find necessary files or dependencies

Task Breakdown:
- Create specific, actionable items
- Break complex tasks into smaller, manageable steps
- Use clear, descriptive task names
- Always provide both forms:
  - content: "Fix authentication bug"
  - activeForm: "Fixing authentication bug"
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **单一 in_progress 限制** | ✅ 实现 | ✅ 强制要求 | 本项目在代码层面验证 |
| **状态转换验证** | ⚠️ 基本 | ✅ 严格规则 | 官方有更详细的转换规则 |
| **完成条件验证** | ❌ 未实现 | ✅ 详细规则 | 官方要求确保真正完成才标记 |
| **任务分解指导** | ❌ 未提供 | ✅ 提供指南 | 官方有任务分解建议 |
| **错误处理策略** | ⚠️ 简单 | ✅ 完善 | 官方有遇错处理指导 |
| **实时更新要求** | ❌ 未强调 | ✅ 明确要求 | 官方要求立即更新状态 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐ (3/5)
- 基本状态管理正确
- 缺少高级验证规则
- 缺少状态转换策略

**代码质量**: ⭐⭐⭐⭐ (4/5)
- 核心逻辑清晰
- 可扩展性好

**与官方一致性**: ⭐⭐⭐ (3/5)
- 基本规则一致
- 缺少官方的严格验证和指导

---

## T107: NotebookEdit 工具

### 功能概述
编辑 Jupyter Notebook (.ipynb) 文件的单元格内容，支持代码和 Markdown 单元格。

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/notebook.ts`

**核心特性**:
```typescript
export class NotebookEditTool extends BaseTool<NotebookEditInput, ToolResult> {
  name = 'NotebookEdit';

  // 完整的 notebook 格式验证
  private validateNotebookFormat(notebook: any): string | null {
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return 'Invalid notebook structure: missing or invalid cells array';
    }

    if (typeof notebook.nbformat !== 'number') {
      return 'Invalid notebook structure: missing or invalid nbformat';
    }

    // 验证 nbformat 版本（支持 v4.x）
    if (notebook.nbformat < 4) {
      return `Unsupported notebook format version`;
    }

    // 验证每个单元格
    for (let i = 0; i < notebook.cells.length; i++) {
      const cell = notebook.cells[i];
      if (!['code', 'markdown', 'raw'].includes(cell.cell_type)) {
        return `Invalid cell at index ${i}: unknown cell_type`;
      }
    }

    return null;
  }

  // 三种编辑模式
  async execute(input: NotebookEditInput): Promise<ToolResult> {
    switch (edit_mode) {
      case 'replace':
        // 替换单元格内容
        cell.source = this.formatSource(new_source);
        if (cell_type) cell.cell_type = cell_type;
        this.clearCellOutputs(cell);
        break;

      case 'insert':
        // 插入新单元格
        const newCell: NotebookCell = {
          cell_type,
          source: this.formatSource(new_source),
          metadata: {},
          id: this.generateCellId(),
        };
        notebook.cells.splice(insertIndex, 0, newCell);
        break;

      case 'delete':
        // 删除单元格
        notebook.cells.splice(cellIndex, 1);
        break;
    }
  }

  // 源代码格式化
  private formatSource(source: string): string[] {
    const lines = source.split('\n');
    return lines.map((line, i, arr) =>
      (i < arr.length - 1 ? line + '\n' : line)
    );
  }

  // 清除输出
  private clearCellOutputs(cell: NotebookCell): void {
    if (cell.cell_type === 'code') {
      cell.outputs = [];
      cell.execution_count = null;
    }
  }

  // 生成唯一 ID
  private generateCellId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
}
```

### 官方实现

**类型定义** (`sdk-tools.d.ts`):
```typescript
export interface NotebookEditInput {
  /**
   * The absolute path to the Jupyter notebook file to edit
   */
  notebook_path: string;

  /**
   * The ID of the cell to edit. When inserting, the new cell
   * will be inserted after this cell, or at the beginning if not specified.
   */
  cell_id?: string;

  /**
   * The new source for the cell
   */
  new_source: string;

  /**
   * The type of the cell (code or markdown)
   * If not specified, defaults to current cell type
   * Required for insert mode
   */
  cell_type?: "code" | "markdown";

  /**
   * The type of edit to make (replace, insert, delete)
   * Defaults to replace
   */
  edit_mode?: "replace" | "insert" | "delete";
}
```

**工具描述** (从 `cli.js` 提取):
```
Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source.

Jupyter notebooks are interactive documents that combine code, text, and visualizations,
commonly used for data analysis and scientific computing.

The notebook_path parameter must be an absolute path, not a relative path.
The cell_number is 0-indexed.
Use edit_mode=insert to add a new cell at the index specified by cell_number.
Use edit_mode=delete to delete the cell at the index specified by cell_number.
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **基本接口** | ✅ 完全实现 | ✅ 标准定义 | 接口定义完全一致 |
| **三种编辑模式** | ✅ 完整实现 | ✅ 支持 | replace/insert/delete 全支持 |
| **格式验证** | ✅ 严格验证 | ❓ 未知 | 本项目有完整的 nbformat 验证 |
| **路径验证** | ✅ 绝对路径检查 | ✅ 要求绝对路径 | 都强制绝对路径 |
| **单元格 ID** | ✅ 支持 ID 和索引 | ✅ 支持 | 灵活的单元格定位 |
| **单元格类型** | ✅ code/markdown/raw | ✅ code/markdown | 本项目还支持 raw 类型 |
| **输出清理** | ✅ 自动清理 | ✅ 自动清理 | code 单元格自动清理输出 |
| **源代码格式** | ✅ 数组格式 | ✅ 数组格式 | 符合 Jupyter 标准 |
| **单元格 ID 生成** | ✅ 随机生成 | ❓ 未知 | 本项目生成 8 位随机 ID |
| **错误处理** | ✅ 详细错误 | ✅ 错误处理 | 完善的错误信息 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 功能完整
- 验证严格
- 错误处理完善

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 类型安全
- 逻辑清晰
- 注释详细
- 边界情况处理完善

**与官方一致性**: ⭐⭐⭐⭐⭐ (5/5)
- 接口定义完全一致
- 功能行为符合预期
- 甚至有额外的验证和错误处理

---

## T108: NotebookEdit 模式

### 功能概述
NotebookEdit 工具的三种编辑模式：replace（替换）、insert（插入）、delete（删除）。

### 本项目实现

**Replace 模式**:
```typescript
case 'replace': {
  if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
    return {
      success: false,
      error: `Cell index out of range: ${cellIndex}`,
    };
  }

  const cell = notebook.cells[cellIndex];
  const oldType = cell.cell_type;

  // 更新源代码
  cell.source = this.formatSource(new_source);

  // 如果指定了 cell_type，更新类型
  if (cell_type) {
    cell.cell_type = cell_type;
  }

  // 清除输出（对于 code 单元格）
  this.clearCellOutputs(cell);

  resultMessage = `Replaced cell ${cellIndex}${
    oldType !== cell.cell_type
      ? ` (changed type from ${oldType} to ${cell.cell_type})`
      : ''
  }`;
  break;
}
```

**Insert 模式**:
```typescript
case 'insert': {
  if (!cell_type) {
    return {
      success: false,
      error: 'cell_type is required for insert mode',
    };
  }

  const newCell: NotebookCell = {
    cell_type,
    source: this.formatSource(new_source),
    metadata: {},
  };

  // 初始化 code 单元格的输出
  if (cell_type === 'code') {
    newCell.outputs = [];
    newCell.execution_count = null;
  }

  // 生成唯一 ID
  newCell.id = this.generateCellId();

  // 确定插入位置
  const insertIndex = cellIndex >= 0 ? cellIndex + 1 : notebook.cells.length;
  notebook.cells.splice(insertIndex, 0, newCell);

  resultMessage = `Inserted new ${cell_type} cell at position ${insertIndex}`;
  break;
}
```

**Delete 模式**:
```typescript
case 'delete': {
  if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
    return {
      success: false,
      error: `Cell index out of range: ${cellIndex}`,
    };
  }

  const deletedCell = notebook.cells[cellIndex];
  notebook.cells.splice(cellIndex, 1);

  resultMessage = `Deleted ${deletedCell.cell_type} cell at position ${cellIndex} (${notebook.cells.length} cells remaining)`;
  break;
}
```

### 官方实现

**模式定义**:
```typescript
edit_mode?: "replace" | "insert" | "delete";
```

**使用说明**:
- `replace`: 默认模式，替换单元格内容
- `insert`: 插入新单元格（需要指定 cell_type）
- `delete`: 删除单元格

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **Replace 模式** | ✅ 完整实现 | ✅ 支持 | 可替换内容和类型 |
| **Insert 模式** | ✅ 完整实现 | ✅ 支持 | 灵活的插入位置 |
| **Delete 模式** | ✅ 完整实现 | ✅ 支持 | 安全的删除操作 |
| **模式验证** | ✅ 严格验证 | ✅ 验证 | 参数验证完善 |
| **范围检查** | ✅ 实现 | ❓ 未知 | 索引范围验证 |
| **类型要求** | ✅ insert 必需 | ✅ insert 必需 | insert 模式要求 cell_type |
| **输出管理** | ✅ 自动处理 | ✅ 自动处理 | code 单元格输出清理 |
| **错误信息** | ✅ 详细 | ✅ 提供 | 清晰的错误提示 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 三种模式都完整实现
- 参数验证完善
- 错误处理周全

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 逻辑清晰
- 边界条件处理好
- 代码可维护性高

**与官方一致性**: ⭐⭐⭐⭐⭐ (5/5)
- 模式定义一致
- 行为符合预期

---

## T109: Task/Agent 工具

### 功能概述
Task 工具用于启动专门的代理（subagent）来自主处理复杂的多步骤任务。

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/agents/`

**代理工具过滤** (`src/agents/tools.ts`):
```typescript
export interface AgentToolConfig {
  agentType: string;
  allowedTools: string[] | '*';
  disallowedTools?: string[];
  toolAliases?: Record<string, string>;
  permissionLevel?: 'readonly' | 'standard' | 'elevated';
  customRestrictions?: ToolRestriction[];
}

// 预定义代理配置
export const AGENT_TOOL_CONFIGS: Record<string, AgentToolConfig> = {
  'general-purpose': {
    agentType: 'general-purpose',
    allowedTools: '*',
    permissionLevel: 'standard',
  },
  'Explore': {
    agentType: 'Explore',
    allowedTools: '*',
    permissionLevel: 'readonly',
    customRestrictions: [
      {
        toolName: 'Bash',
        type: 'scope',
        rule: {
          allowedCommands: [
            /^git\s+(status|diff|log|show)/,
            /^ls(\s|$)/,
            /^cat(\s|$)/,
          ],
        },
      },
    ],
  },
  'Plan': {
    agentType: 'Plan',
    allowedTools: '*',
    permissionLevel: 'elevated',
  },
  // ... 更多代理类型
};

export class AgentToolFilter {
  isAllowed(toolName: string): boolean {
    // 检查工具是否被允许
  }

  getAvailableTools(): ToolDefinition[] {
    // 获取可用工具列表
  }

  validateToolCall(toolName: string, params: any): ValidationResult {
    // 验证工具调用
  }
}
```

**使用跟踪** (`src/agents/tools.ts`):
```typescript
export class ToolUsageTracker {
  record(agentId: string, agentType: string, toolName: string,
         params: any, result: any, durationMs: number): void {
    // 记录工具调用
  }

  getUsageStats(agentId?: string, timeRange?: number): UsageStats {
    // 获取使用统计
  }

  detectAnomalies(): Anomaly[] {
    // 检测异常
  }
}
```

### 官方实现

**AgentInput 接口** (`sdk-tools.d.ts`):
```typescript
export interface AgentInput {
  /**
   * A short (3-5 word) description of the task
   */
  description: string;

  /**
   * The task for the agent to perform
   */
  prompt: string;

  /**
   * The type of specialized agent to use for this task
   */
  subagent_type: string;

  /**
   * Optional model to use. If not specified, inherits from parent.
   * Prefer haiku for quick, straightforward tasks to minimize cost and latency.
   */
  model?: "sonnet" | "opus" | "haiku";

  /**
   * Optional agent ID to resume from. If provided, the agent will
   * continue from the previous execution transcript.
   */
  resume?: string;

  /**
   * Set to true to run this agent in the background.
   * Use TaskOutput to read the output later.
   */
  run_in_background?: boolean;
}
```

**TaskOutput 接口** (`sdk-tools.d.ts`):
```typescript
export interface TaskOutputInput {
  /**
   * The task ID to get output from
   */
  task_id: string;

  /**
   * Whether to wait for completion
   */
  block?: boolean;

  /**
   * Max wait time in ms
   */
  timeout?: number;
}
```

**使用说明** (从 `cli.js` 提取):
```javascript
async function AY2(A) {
  let Q = A.map((B) => {
    let G = "";
    if (B?.forkContext)
      G = "Properties: " + (B?.forkContext ? "access to current context; " : "");
    let Z = B.tools ? B.tools.join(", ") : "All tools";
    return `- ${B.agentType}: ${B.whenToUse} (${G}Tools: ${Z})`;
  }).join('\n');

  return `Launch a new agent to handle complex, multi-step tasks autonomously.

The Task tool launches specialized agents (subprocesses) that autonomously handle complex tasks.
Each agent type has specific capabilities and tools available to it.

Available agent types and the tools they have access to:
${Q}

When NOT to use the Task tool:
- If you want to read a specific file path, use the Read or Grep tool instead
- If you are searching for a specific class definition like "class Foo", use the Grep tool instead
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead

Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do
- Launch multiple agents concurrently whenever possible, to maximize performance
- When the agent is done, it will return a single message back to you
- You can optionally run agents in the background using the run_in_background parameter
- Agents can be resumed using the 'resume' parameter by passing the agent ID
- Agents with "access to current context" can see the full conversation history
- Provide clear, detailed prompts so the agent can work autonomously`;
}
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **基本接口** | ⚠️ 部分实现 | ✅ 完整定义 | 本项目缺少统一的 Task 工具接口 |
| **AgentInput** | ❌ 未定义 | ✅ 标准接口 | 官方有明确的输入接口 |
| **subagent_type** | ✅ 有概念 | ✅ 必需参数 | 本项目有 agentType 配置 |
| **model 选择** | ⚠️ 部分支持 | ✅ 支持 | 官方支持 sonnet/opus/haiku |
| **resume 参数** | ✅ 完整实现 | ✅ 支持 | 本项目有完整的恢复机制 |
| **run_in_background** | ⚠️ 概念存在 | ✅ 支持 | 本项目实现不完整 |
| **TaskOutput 工具** | ❌ 未实现 | ✅ 完整实现 | 官方有专门工具获取后台任务输出 |
| **工具过滤** | ✅ 完整实现 | ✅ 实现 | 本项目有详细的工具过滤系统 |
| **权限级别** | ✅ 实现 | ❓ 未知 | 本项目有 readonly/standard/elevated |
| **工具限制** | ✅ 详细配置 | ❓ 未知 | 本项目有参数、速率、范围限制 |
| **使用跟踪** | ✅ 完整实现 | ❓ 未知 | 本项目有详细的使用统计 |
| **forkContext** | ⚠️ 概念存在 | ✅ 支持 | 官方支持上下文分叉 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐ (3/5)
- 有代理管理的基础框架
- 缺少统一的 Task 工具接口
- 缺少 TaskOutput 工具

**代码质量**: ⭐⭐⭐⭐ (4/5)
- 工具过滤系统设计良好
- 代码结构清晰
- 但缺少整合

**与官方一致性**: ⭐⭐⭐ (3/5)
- 概念基本一致
- 实现方式不同
- 缺少官方的统一接口

---

## T110: Agent 类型支持

### 功能概述
支持多种类型的专门代理，每种代理有特定的工具访问权限和使用场景。

### 本项目实现

**预定义代理配置** (`src/agents/tools.ts`):
```typescript
export const AGENT_TOOL_CONFIGS: Record<string, AgentToolConfig> = {
  'general-purpose': {
    agentType: 'general-purpose',
    allowedTools: '*',
    permissionLevel: 'standard',
  },

  'statusline-setup': {
    agentType: 'statusline-setup',
    allowedTools: ['Read', 'Edit'],
    permissionLevel: 'standard',
  },

  'Explore': {
    agentType: 'Explore',
    allowedTools: '*',
    permissionLevel: 'readonly',
    customRestrictions: [
      {
        toolName: 'Bash',
        type: 'scope',
        rule: {
          allowedCommands: [
            /^git\s+(status|diff|log|show)/,
            /^ls(\s|$)/,
            /^cat(\s|$)/,
          ],
        },
      },
    ],
  },

  'Plan': {
    agentType: 'Plan',
    allowedTools: '*',
    permissionLevel: 'elevated',
  },

  'claude-code-guide': {
    agentType: 'claude-code-guide',
    allowedTools: ['Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch'],
    permissionLevel: 'readonly',
  },

  'code-reviewer': {
    agentType: 'code-reviewer',
    allowedTools: ['Bash', 'Glob', 'Grep', 'Read', 'Task'],
    permissionLevel: 'readonly',
    customRestrictions: [
      {
        toolName: 'Bash',
        type: 'scope',
        rule: {
          allowedCommands: [/^git\s+(diff|status|log|show|remote\s+show)/],
        },
      },
    ],
  },
};
```

**代理属性**:
```typescript
export interface AgentToolConfig {
  agentType: string;              // 代理类型标识符
  allowedTools: string[] | '*';   // 允许的工具列表
  disallowedTools?: string[];     // 禁用的工具列表
  toolAliases?: Record<string, string>;  // 工具别名
  permissionLevel?: 'readonly' | 'standard' | 'elevated';  // 权限级别
  customRestrictions?: ToolRestriction[];  // 自定义限制
}
```

### 官方实现

**代理类型示例** (从 `cli.js` 提取):
```javascript
// statusline-setup agent
{
  agentType: "statusline-setup",
  whenToUse: "Use this agent to configure the user's Claude Code status line setting.",
  tools: ["Read", "Edit"],
  source: "built-in",
  model: "sonnet",
  color: "orange",
  getSystemPrompt: () => `You are a status line setup agent...`
}

// Explore agent (从 prompt 推断)
{
  agentType: "explore",
  whenToUse: "For code exploration and research tasks",
  tools: ["Glob", "Grep", "Read", "Bash"],  // 主要使用这些工具
  forkContext: true,  // 可访问当前上下文
}

// Plan agent (从 prompt 推断)
{
  agentType: "plan",
  whenToUse: "For designing implementation based on exploration results",
  tools: "*",  // 所有工具
  forkContext: false,
}
```

**代理属性** (从 `cli.js` 推断):
```javascript
{
  agentType: string,      // 代理类型
  whenToUse: string,      // 使用场景描述
  tools?: string[],       // 可用工具列表（undefined = 所有工具）
  source: string,         // 来源：built-in/user/project/plugin
  model?: string,         // 模型选择
  color?: string,         // UI 颜色
  forkContext?: boolean,  // 是否可访问当前上下文
  getSystemPrompt?: () => string,  // 系统提示词生成函数
}
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **代理类型定义** | ✅ 多种类型 | ✅ 多种类型 | 都支持多种代理类型 |
| **工具访问控制** | ✅ 详细配置 | ✅ 配置 | 本项目有更细粒度的控制 |
| **权限级别** | ✅ 三级权限 | ⚠️ 隐式 | 本项目有显式的权限级别 |
| **whenToUse 描述** | ❌ 未实现 | ✅ 必需 | 官方有使用场景描述 |
| **forkContext** | ❌ 未实现 | ✅ 支持 | 官方支持上下文访问控制 |
| **source 标识** | ❌ 未实现 | ✅ 支持 | 官方区分代理来源 |
| **model 指定** | ❌ 未实现 | ✅ 支持 | 官方可为代理指定模型 |
| **系统提示词** | ❌ 未实现 | ✅ 支持 | 官方可自定义提示词 |
| **自定义限制** | ✅ 完整实现 | ❓ 未知 | 本项目有详细的限制机制 |
| **工具别名** | ✅ 支持 | ❓ 未知 | 本项目支持工具别名 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐ (4/5)
- 工具访问控制完整
- 缺少代理描述和上下文配置
- 限制机制比官方更详细

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 类型定义清晰
- 配置灵活
- 扩展性好

**与官方一致性**: ⭐⭐⭐ (3/5)
- 核心概念一致
- 属性定义有差异
- 缺少官方的一些关键特性

---

## T111: Agent 后台运行

### 功能概述
允许代理在后台运行，主进程可以继续执行其他任务，之后通过 TaskOutput 工具获取结果。

### 本项目实现

**概念支持** (`src/agents/tools.ts`):
```typescript
// 工具使用跟踪支持后台运行的概念
export class ToolUsageTracker {
  private records: ToolUsageRecord[] = [];

  record(agentId: string, agentType: string, toolName: string,
         params: any, result: any, durationMs: number): void {
    const record: ToolUsageRecord = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      agentType,
      toolName,
      params,
      result,
      success: result?.success !== false,
      error: result?.error,
      timestamp: Date.now(),
      durationMs,
    };

    this.records.push(record);
  }
}
```

**注**: 本项目没有完整的后台运行实现，只有跟踪记录的基础设施。

### 官方实现

**run_in_background 参数** (`sdk-tools.d.ts`):
```typescript
export interface AgentInput {
  // ...
  /**
   * Set to true to run this agent in the background.
   * Use TaskOutput to read the output later.
   */
  run_in_background?: boolean;
}

export interface BashInput {
  // ...
  /**
   * Set to true to run this command in the background.
   * Use TaskOutput to read the output later.
   */
  run_in_background?: boolean;
}
```

**TaskOutput 工具**:
```typescript
export interface TaskOutputInput {
  /**
   * The task ID to get output from
   */
  task_id: string;

  /**
   * Whether to wait for completion
   */
  block?: boolean;

  /**
   * Max wait time in ms
   */
  timeout?: number;
}
```

**使用说明** (从 `cli.js` 提取):
```
- You can optionally run agents in the background using the run_in_background parameter.
- When an agent runs in the background, you will need to use TaskOutput to retrieve
  its results once it's done.
- You can continue to work while background agents run - When you need their results
  to continue you can use TaskOutput in blocking mode to pause and wait for their results.
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **run_in_background** | ❌ 未实现 | ✅ 完整支持 | 官方有完整的后台运行 |
| **TaskOutput 工具** | ❌ 未实现 | ✅ 完整实现 | 官方有专门工具获取输出 |
| **阻塞模式** | ❌ 未实现 | ✅ 支持 | 官方支持 blocking 等待 |
| **超时控制** | ❌ 未实现 | ✅ 支持 | 官方支持超时设置 |
| **任务 ID 管理** | ⚠️ 有记录 | ✅ 完整 | 本项目只有记录，无法获取输出 |
| **并发执行** | ❌ 未实现 | ✅ 支持 | 官方支持真正的后台并发 |
| **状态查询** | ❌ 未实现 | ✅ 支持 | 官方可查询后台任务状态 |

### 实现质量评估

**实现完整度**: ⭐ (1/5)
- 只有概念和基础设施
- 缺少核心功能实现

**代码质量**: N/A
- 功能未实现，无法评估

**与官方一致性**: ⭐ (1/5)
- 概念一致但未实现
- 缺少关键功能

---

## T112: Agent 恢复机制

### 功能概述
允许恢复之前暂停或失败的代理执行，保留完整的执行上下文和历史。

### 本项目实现

**完整的恢复系统** (`src/agents/resume.ts`):

```typescript
// 代理状态定义
export interface AgentState {
  id: string;
  type: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  prompt: string;
  description?: string;
  model?: string;

  // 执行历史
  messages: Message[];
  toolCalls: ToolCall[];
  results: any[];

  // 检查点系统
  checkpoint?: Checkpoint;
  checkpoints: Checkpoint[];

  // 执行上下文
  workingDirectory: string;
  environment?: Record<string, string>;

  // 进度跟踪
  currentStep: number;
  totalSteps?: number;

  // 错误处理
  errorCount: number;
  lastError?: string;
  retryCount: number;
  maxRetries: number;

  // 元数据
  metadata: Record<string, any>;
}

// 检查点定义
export interface Checkpoint {
  id: string;
  agentId: string;
  createdAt: Date;
  step: number;
  label?: string;
  messages: Message[];
  toolCalls: ToolCall[];
  results: any[];
  metadata: Record<string, any>;
}

// 状态管理器
export class AgentStateManager {
  async saveState(state: AgentState): Promise<void> {
    // 保存状态到 ~/.claude/agents/
  }

  async loadState(id: string): Promise<AgentState | null> {
    // 加载状态
  }

  async listStates(filter?: StateFilter): Promise<AgentState[]> {
    // 列出所有状态
  }

  async deleteState(id: string): Promise<boolean> {
    // 删除状态
  }

  async cleanupExpired(maxAge: number): Promise<number> {
    // 清理过期状态
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    // 保存检查点
  }

  async loadCheckpoint(agentId: string, checkpointId: string): Promise<Checkpoint | null> {
    // 加载检查点
  }
}

// 恢复器
export class AgentResumer {
  async canResume(id: string): Promise<boolean> {
    // 检查是否可以恢复
  }

  async getResumePoint(id: string): Promise<ResumePoint> {
    // 获取恢复点信息
  }

  async resume(options: ResumeOptions): Promise<AgentState> {
    const { agentId, continueFrom = 'last', resetErrors = false, additionalContext } = options;

    // 加载状态
    const state = await this.stateManager.loadState(agentId);

    // 根据 continueFrom 恢复到特定点
    if (continueFrom === 'checkpoint' && state.checkpoint) {
      await this.restoreFromCheckpoint(state, state.checkpoint);
    } else if (typeof continueFrom === 'number') {
      // 从特定步骤恢复
      const checkpoints = await this.stateManager.listCheckpoints(agentId);
      const targetCheckpoint = checkpoints.find(cp => cp.step === continueFrom);
      if (targetCheckpoint) {
        await this.restoreFromCheckpoint(state, targetCheckpoint);
      }
    }

    // 重置错误状态
    if (resetErrors) {
      state.errorCount = 0;
      state.lastError = undefined;
      state.retryCount = 0;
    }

    // 添加附加上下文
    if (additionalContext) {
      state.metadata.resumeContext = additionalContext;
    }

    // 更新状态为运行中
    state.status = 'running';
    await this.stateManager.saveState(state);

    return state;
  }

  async createResumeSummary(id: string): Promise<string> {
    // 创建恢复摘要
  }
}

// 便捷函数
export function createAgentCheckpoint(state: AgentState, label?: string): Checkpoint {
  // 创建检查点
}

export function createInitialAgentState(type: string, prompt: string, options?: any): AgentState {
  // 创建初始状态
}
```

### 官方实现

**resume 参数** (`sdk-tools.d.ts`):
```typescript
export interface AgentInput {
  // ...
  /**
   * Optional agent ID to resume from. If provided, the agent will
   * continue from the previous execution transcript.
   */
  resume?: string;
}
```

**使用说明** (从 `cli.js` 提取):
```
- Agents can be resumed using the 'resume' parameter by passing the agent ID
  from a previous invocation.
- When resumed, the agent continues with its full previous context preserved.
- When NOT resuming, each invocation starts fresh and you should provide
  a detailed task description with all necessary context.
- When the agent is done, it will return a single message back to you along
  with its agent ID. You can use this ID to resume the agent later if needed
  for follow-up work.
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **resume 参数** | ✅ 完整实现 | ✅ 支持 | 都支持通过 ID 恢复 |
| **状态持久化** | ✅ 文件系统 | ❓ 未知 | 本项目保存到 ~/.claude/agents/ |
| **检查点系统** | ✅ 完整实现 | ❓ 未知 | 本项目有完整的检查点机制 |
| **恢复点选择** | ✅ 灵活 | ⚠️ 最后位置 | 本项目支持恢复到任意检查点 |
| **状态管理** | ✅ 完善 | ❓ 未知 | 本项目有专门的状态管理器 |
| **错误恢复** | ✅ 支持 | ❓ 未知 | 本项目可重置错误状态 |
| **上下文保留** | ✅ 完整 | ✅ 完整 | 都保留完整上下文 |
| **进度跟踪** | ✅ 详细 | ❓ 未知 | 本项目跟踪步骤和进度 |
| **过期清理** | ✅ 支持 | ❓ 未知 | 本项目可清理过期状态 |
| **恢复验证** | ✅ 完善 | ❓ 未知 | 本项目有恢复前验证 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 功能非常完整
- 检查点系统完善
- 状态管理详细

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 架构设计优秀
- 类型定义清晰
- 错误处理完善
- 代码可维护性高

**与官方一致性**: ⭐⭐⭐⭐ (4/5)
- 核心功能一致
- 本项目实现更详细
- 官方可能有不同的内部实现

**亮点**:
本项目的恢复机制实现非常出色，比官方公开的接口更加完善：
- 完整的检查点系统
- 灵活的恢复点选择
- 详细的状态跟踪
- 完善的错误处理
- 过期清理机制

---

## T113: AskUserQuestion 工具

### 功能概述
向用户提出问题并获取选择，支持单选和多选，用于澄清需求或获取用户批准。

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/ask.ts`

**核心特性**:
```typescript
export class AskUserQuestionTool extends BaseTool<AskUserQuestionInput, ToolResult> {
  name = 'AskUserQuestion';

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'Questions to ask the user (1-4 questions)',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The complete question to ask the user',
              },
              header: {
                type: 'string',
                description: 'Short label displayed as a chip/tag (max 12 chars)',
              },
              options: {
                type: 'array',
                description: 'The available choices (2-4 options)',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['label', 'description'],
                },
              },
              multiSelect: {
                type: 'boolean',
                description: 'Allow multiple selections',
              },
            },
            required: ['question', 'header', 'options', 'multiSelect'],
          },
        },
      },
      required: ['questions'],
    };
  }

  // 交互式选择器 - 支持键盘导航
  private async interactiveSelect(
    question: Question,
    options: QuestionOption[],
    questionNum: number,
    totalQuestions: number
  ): Promise<string> {
    let currentIndex = 0;
    const selectedIndices = new Set<number>();

    // 设置原始模式
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);

    const render = () => {
      // 显示选项
      options.forEach((opt, idx) => {
        const isSelected = selectedIndices.has(idx);
        const isCurrent = idx === currentIndex;

        let prefix = '  ';
        if (question.multiSelect) {
          prefix = isSelected ? chalk.green('◉ ') : '◯ ';
        }

        const cursor = isCurrent ? chalk.cyan('❯ ') : '  ';
        const number = chalk.dim(`${idx + 1}.`);
        const label = isCurrent ? chalk.cyan.bold(opt.label) : opt.label;
        const desc = chalk.dim(`- ${opt.description}`);

        console.log(`${cursor}${prefix}${number} ${label} ${desc}`);
      });

      // 显示提示
      if (question.multiSelect) {
        console.log(chalk.dim('  ↑/↓: Navigate | Space: Toggle | Enter: Confirm | 1-9: Quick select'));
      } else {
        console.log(chalk.dim('  ↑/↓: Navigate | Enter: Select | 1-9: Quick select'));
      }
    };

    // 键盘事件处理
    process.stdin.on('keypress', async (str, key) => {
      if (key.name === 'up') {
        currentIndex = (currentIndex - 1 + options.length) % options.length;
        render();
      } else if (key.name === 'down') {
        currentIndex = (currentIndex + 1) % options.length;
        render();
      } else if (key.name === 'space' && question.multiSelect) {
        if (selectedIndices.has(currentIndex)) {
          selectedIndices.delete(currentIndex);
        } else {
          selectedIndices.add(currentIndex);
        }
        render();
      } else if (key.name === 'return') {
        await finishSelection();
      } else if (str && /^[1-9]$/.test(str)) {
        const idx = parseInt(str, 10) - 1;
        if (idx >= 0 && idx < options.length) {
          currentIndex = idx;
          if (question.multiSelect) {
            if (selectedIndices.has(idx)) {
              selectedIndices.delete(idx);
            } else {
              selectedIndices.add(idx);
            }
            render();
          } else {
            await finishSelection();
          }
        }
      }
    });

    // 初始渲染
    render();
  }

  // 简单选择模式 - 用于非 TTY 环境
  private async simpleSelect(...): Promise<string> {
    // 降级到简单的文本输入模式
  }
}
```

**特性**:
- ✅ 键盘导航（↑/↓ 箭头键）
- ✅ 多选模式（空格键切换）
- ✅ 数字快捷键（1-9）
- ✅ 自动添加 "Other" 选项
- ✅ 美化的终端 UI
- ✅ TTY/非TTY 自动检测
- ✅ 1-4 个问题支持
- ✅ 2-4 个选项支持

### 官方实现

**类型定义** (`sdk-tools.d.ts`):
```typescript
export interface AskUserQuestionInput {
  /**
   * Questions to ask the user (1-4 questions)
   */
  questions: [
    {
      /**
       * The complete question to ask the user. Should be clear, specific,
       * and end with a question mark. If multiSelect is true, phrase it accordingly.
       */
      question: string;

      /**
       * Very short label displayed as a chip/tag (max 12 chars).
       * Examples: "Auth method", "Library", "Approach".
       */
      header: string;

      /**
       * The available choices for this question. Must have 2-4 options.
       * Each option should be a distinct, mutually exclusive choice
       * (unless multiSelect is enabled). There should be no 'Other' option,
       * that will be provided automatically.
       */
      options: [
        {
          /**
           * The display text for this option that the user will see and select.
           * Should be concise (1-5 words) and clearly describe the choice.
           */
          label: string;

          /**
           * Explanation of what this option means or what will happen if chosen.
           * Useful for providing context about trade-offs or implications.
           */
          description: string;
        },
        // ... 2-4 options
      ];

      /**
       * Set to true to allow the user to select multiple options instead of just one.
       * Use when choices are not mutually exclusive.
       */
      multiSelect: boolean;
    }
    // ... 1-4 questions
  ];

  /**
   * User answers collected by the permission component
   */
  answers?: {
    [k: string]: string;
  };
}
```

**使用说明** (从 `cli.js` 提取):
```
Use this tool when you need to:
- Clarify ambiguous requirements
- Get user approval for a specific approach
- Ask about implementation preferences
- Confirm understanding of a task

- Use multiSelect: true to allow multiple answers to be selected for a question

Each question should have 2-4 options. An "Other" option allowing free-form
input is automatically provided.
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **基本接口** | ✅ 完全实现 | ✅ 标准定义 | 接口定义完全一致 |
| **问题数量** | ✅ 1-4 个 | ✅ 1-4 个 | 限制一致 |
| **选项数量** | ✅ 2-4 个 | ✅ 2-4 个 | 限制一致 |
| **multiSelect** | ✅ 完整支持 | ✅ 支持 | 多选功能完整 |
| **键盘导航** | ✅ 完整实现 | ❓ 未知 | 本项目有完整的交互式 UI |
| **箭头键支持** | ✅ ↑/↓ | ❓ 未知 | 本项目支持 |
| **空格切换** | ✅ 支持 | ❓ 未知 | 多选模式切换选择 |
| **数字快捷键** | ✅ 1-9 | ❓ 未知 | 本项目支持 |
| **自动 "Other"** | ✅ 自动添加 | ✅ 自动添加 | 都自动添加自定义选项 |
| **TTY 检测** | ✅ 自动检测 | ❓ 未知 | 本项目自动降级 |
| **美化 UI** | ✅ Chalk 美化 | ❓ 未知 | 本项目有彩色输出 |
| **header 字段** | ✅ 支持 | ✅ 支持 | 短标签展示 |
| **answers 字段** | ⚠️ 输出格式 | ✅ 输入/输出 | 官方可能用于权限组件 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 功能非常完整
- 交互体验优秀
- 降级处理完善

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 代码结构清晰
- 错误处理完善
- UI 实现优雅
- 可维护性高

**与官方一致性**: ⭐⭐⭐⭐⭐ (5/5)
- 接口定义完全一致
- 功能行为符合预期
- 可能有更好的交互体验

**亮点**:
本项目的 AskUserQuestion 实现非常出色：
- 完整的键盘导航支持
- 美观的终端 UI
- 自动环境检测和降级
- 清晰的用户提示

---

## T114: 多选问题支持

### 功能概述
在 AskUserQuestion 工具中支持多选模式，允许用户选择多个选项。

### 本项目实现

**多选逻辑**:
```typescript
private async interactiveSelect(question: Question, ...): Promise<string> {
  let currentIndex = 0;
  const selectedIndices = new Set<number>();  // 存储选中的索引

  const render = () => {
    options.forEach((opt, idx) => {
      const isSelected = selectedIndices.has(idx);
      const isCurrent = idx === currentIndex;

      let prefix = '  ';
      if (question.multiSelect) {
        // 多选模式：显示选中状态
        prefix = isSelected ? chalk.green('◉ ') : '◯ ';
      }

      console.log(`${cursor}${prefix}${number} ${label} ${desc}`);
    });

    // 提示信息
    if (question.multiSelect) {
      console.log(chalk.dim('  ↑/↓: Navigate | Space: Toggle | Enter: Confirm | 1-9: Quick select'));
    } else {
      console.log(chalk.dim('  ↑/↓: Navigate | Enter: Select | 1-9: Quick select'));
    }
  };

  // 键盘事件
  process.stdin.on('keypress', async (str, key) => {
    // 空格键切换选择
    if (key.name === 'space' && question.multiSelect) {
      if (selectedIndices.has(currentIndex)) {
        selectedIndices.delete(currentIndex);
      } else {
        selectedIndices.add(currentIndex);
      }
      render();
    }

    // 数字快捷键
    else if (str && /^[1-9]$/.test(str)) {
      const idx = parseInt(str, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        currentIndex = idx;
        if (question.multiSelect) {
          // 多选模式：切换选择
          if (selectedIndices.has(idx)) {
            selectedIndices.delete(idx);
          } else {
            selectedIndices.add(idx);
          }
          render();
        } else {
          // 单选模式：直接确认
          await finishSelection();
        }
      }
    }
  });

  const finishSelection = async () => {
    if (question.multiSelect) {
      // 如果没有选择任何项，使用当前项
      if (selectedIndices.size === 0) {
        selectedIndices.add(currentIndex);
      }

      // 收集所有选中的标签
      const selectedLabels: string[] = [];
      for (const idx of Array.from(selectedIndices).sort((a, b) => a - b)) {
        if (idx === options.length - 1) {
          // "Other" 选项
          const custom = await this.getCustomInput();
          selectedLabels.push(custom);
        } else {
          selectedLabels.push(options[idx].label);
        }
      }
      result = selectedLabels.join(', ');
    } else {
      // 单选模式
      if (currentIndex === options.length - 1) {
        result = await this.getCustomInput();
      } else {
        result = options[currentIndex].label;
      }
    }
  };
}

// 简单模式的多选
private async simpleSelect(question: Question, ...): Promise<string> {
  if (question.multiSelect) {
    const response = await askQuestion(
      chalk.blue('Enter choices (comma-separated numbers): ')
    );

    const indices = response.split(',').map((s) => parseInt(s.trim(), 10));
    const selected: string[] = [];

    for (const idx of indices) {
      if (idx >= 1 && idx < options.length) {
        selected.push(options[idx - 1].label);
      } else if (idx === options.length) {
        const custom = await askQuestion(chalk.blue('Enter custom response: '));
        selected.push(custom);
      }
    }

    return selected.length > 0 ? selected.join(', ') : response;
  } else {
    // 单选逻辑
  }
}
```

### 官方实现

**multiSelect 字段**:
```typescript
{
  /**
   * Set to true to allow the user to select multiple options instead of just one.
   * Use when choices are not mutually exclusive.
   */
  multiSelect: boolean;
}
```

**使用说明**:
```
- Use multiSelect: true to allow multiple answers to be selected for a question
```

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **multiSelect 字段** | ✅ 支持 | ✅ 支持 | 接口一致 |
| **空格切换** | ✅ 实现 | ❓ 未知 | 本项目支持空格键切换 |
| **视觉反馈** | ✅ ◉/◯ 图标 | ❓ 未知 | 本项目有清晰的选中状态 |
| **多选提示** | ✅ 不同提示 | ❓ 未知 | 单选/多选有不同的提示文本 |
| **结果格式** | ✅ 逗号分隔 | ❓ 未知 | 多个选项用逗号连接 |
| **最少选择** | ✅ 自动选择 | ❓ 未知 | 无选择时自动使用当前项 |
| **数字多选** | ✅ 切换模式 | ❓ 未知 | 数字键在多选模式下切换 |
| **简单模式** | ✅ 支持 | ❓ 未知 | 非 TTY 环境的多选支持 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 多选功能完整
- 交互逻辑清晰
- 两种模式都支持

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 状态管理清晰（Set 存储选中项）
- 视觉反馈明确
- 用户体验好

**与官方一致性**: ⭐⭐⭐⭐⭐ (5/5)
- 接口定义一致
- 功能行为符合预期

**亮点**:
- 优秀的多选交互体验
- 清晰的视觉反馈
- 完善的降级处理

---

## T115: Skill 工具

### 功能概述
Skill 和 SlashCommand 工具用于加载和执行自定义技能和命令，支持项目级、用户级和内置技能。

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/skill.ts`

**核心特性**:

```typescript
interface SkillDefinition {
  name: string;
  description: string;
  prompt: string;
  location: 'user' | 'project' | 'builtin';
  filePath?: string;
}

interface SlashCommandDefinition {
  name: string;
  description?: string;
  content: string;
  path: string;
}

// 技能注册表
const skillRegistry: Map<string, SkillDefinition> = new Map();
const slashCommandRegistry: Map<string, SlashCommandDefinition> = new Map();

// 缓存机制
let skillsLoaded = false;
let commandsLoaded = false;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 注册技能（支持优先级）
export function registerSkill(skill: SkillDefinition): void {
  const existing = skillRegistry.get(skill.name);
  if (existing) {
    const priority = { project: 3, user: 2, builtin: 1 };
    if (priority[skill.location] <= priority[existing.location]) {
      return; // 不覆盖更高优先级的 skill
    }
  }

  skillRegistry.set(skill.name, skill);
}

// 从目录加载技能
export function loadSkillsFromDirectory(
  dir: string,
  location: 'user' | 'project' | 'builtin',
  recursive = false
): void {
  if (!fs.existsSync(dir)) return;

  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) return;

  loadSkillsFromPath(skillsDir, location, recursive);
}

// 解析 YAML frontmatter
function parseFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const [, frontmatterText, body] = match;
  const metadata: SkillMetadata = {};

  // 简单的 YAML 解析（支持基本的 key: value 格式）
  const lines = frontmatterText.split(/\r?\n/);
  for (const line of lines) {
    const keyValueMatch = line.trim().match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyValueMatch) {
      metadata[keyValueMatch[1]] = keyValueMatch[2];
    }
  }

  return { metadata, body: body.trim() };
}

// 初始化：加载所有技能和命令
export function initializeSkillsAndCommands(force = false): void {
  if (!force && skillsLoaded && commandsLoaded && !isCacheExpired()) {
    return;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const claudeDir = path.join(homeDir, '.claude');
  const projectClaudeDir = path.join(process.cwd(), '.claude');

  // 加载顺序：builtin -> user -> project
  // 1. 加载内置 skills
  const builtinSkillsDir = getBuiltinSkillsDir();
  if (fs.existsSync(builtinSkillsDir)) {
    loadSkillsFromPath(builtinSkillsDir, 'builtin', true);
  }

  // 2. 加载用户级别 skills 和 commands
  loadSkillsFromDirectory(claudeDir, 'user', false);
  loadSlashCommandsFromDirectory(claudeDir);

  // 3. 加载项目级别 skills 和 commands（最高优先级）
  loadSkillsFromDirectory(projectClaudeDir, 'project', false);
  loadSlashCommandsFromDirectory(projectClaudeDir);

  skillsLoaded = true;
  commandsLoaded = true;
  lastLoadTime = Date.now();
}

// Skill 工具
export class SkillTool extends BaseTool<SkillInput, ToolResult> {
  name = 'Skill';
  description = `Execute a skill within the main conversation.

Available skills are loaded from (in priority order):
1. .claude/skills/*.md (project skills - highest priority)
2. ~/.claude/skills/*.md (user skills)
3. Built-in skills (lowest priority)`;

  async execute(input: SkillInput): Promise<ToolResult> {
    const { skill } = input;

    ensureSkillsLoaded();

    const skillDef = skillRegistry.get(skill);
    if (!skillDef) {
      const available = Array.from(skillRegistry.keys()).sort().join(', ');
      return {
        success: false,
        error: `Skill "${skill}" not found. Available skills: ${available || 'none'}`,
      };
    }

    return {
      success: true,
      output: `<command-message>The "${skillDef.name}" skill is loading</command-message>\n\n<skill name="${skillDef.name}" location="${skillDef.location}">\n${skillDef.prompt}\n</skill>`,
    };
  }
}

// SlashCommand 工具
export class SlashCommandTool extends BaseTool<SlashCommandInput, ToolResult> {
  name = 'SlashCommand';
  description = `Execute a slash command within the main conversation

Slash commands are loaded from:
- .claude/commands/*.md (project commands)
- ~/.claude/commands/*.md (user commands)`;

  async execute(input: SlashCommandInput): Promise<ToolResult> {
    const { command } = input;

    ensureCommandsLoaded();

    // 解析命令和参数
    const parts = command.startsWith('/')
      ? command.slice(1).split(' ')
      : command.split(' ');
    const cmdName = parts[0];
    const args = parts.slice(1);

    const cmdDef = slashCommandRegistry.get(cmdName);
    if (!cmdDef) {
      const available = Array.from(slashCommandRegistry.keys())
        .sort()
        .map((n) => `/${n}`)
        .join(', ');
      return {
        success: false,
        error: `Command "/${cmdName}" not found. Available commands: ${available || 'none'}`,
      };
    }

    // 替换参数占位符
    let content = cmdDef.content;
    args.forEach((arg, i) => {
      content = content.replace(new RegExp(`\\$${i + 1}`, 'g'), arg);
      content = content.replace(new RegExp(`\\{\\{\\s*arg${i + 1}\\s*\\}\\}`, 'g'), arg);
    });
    content = content.replace(/\$@/g, args.join(' '));

    return {
      success: true,
      output: `<command-message>/${cmdName} is running…</command-message>\n\n${content}`,
    };
  }
}

// 便捷函数
export function getAvailableSkills(): SkillDefinition[] {
  ensureSkillsLoaded();
  return Array.from(skillRegistry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableCommands(): SlashCommandDefinition[] {
  ensureCommandsLoaded();
  return Array.from(slashCommandRegistry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkillsByLocation(location: 'user' | 'project' | 'builtin'): SkillDefinition[] {
  ensureSkillsLoaded();
  return Array.from(skillRegistry.values())
    .filter((skill) => skill.location === location)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findSkill(name: string): SkillDefinition | undefined {
  ensureSkillsLoaded();

  // 精确匹配
  let skill = skillRegistry.get(name);
  if (skill) return skill;

  // 不区分大小写匹配
  const lowerName = name.toLowerCase();
  for (const [key, value] of Array.from(skillRegistry.entries())) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}
```

### 官方实现

**从 `cli.js` 推断**:

官方似乎有 Skill 和 SlashCommand 的概念，但在公开的类型定义中没有找到明确的 `Skill` 工具接口。可能是通过其他方式实现的。

**特征**:
- 支持从 `.claude/skills/` 和 `~/.claude/skills/` 加载
- 支持 frontmatter 元数据
- 支持命令参数替换

### 差异分析

| 功能点 | 本项目实现 | 官方实现 | 差异说明 |
|--------|-----------|----------|----------|
| **Skill 工具** | ✅ 完整实现 | ❓ 未明确 | 本项目有完整的实现 |
| **SlashCommand 工具** | ✅ 完整实现 | ❓ 未明确 | 本项目有完整的实现 |
| **加载路径** | ✅ 三级 | ❓ 未知 | builtin/user/project |
| **优先级系统** | ✅ 完善 | ❓ 未知 | project > user > builtin |
| **Frontmatter 解析** | ✅ 支持 | ❓ 未知 | YAML frontmatter |
| **缓存机制** | ✅ 5分钟 TTL | ❓ 未知 | 避免重复加载 |
| **参数替换** | ✅ 多种格式 | ❓ 未知 | $1, {{arg1}}, $@ |
| **递归加载** | ✅ 支持 | ❓ 未知 | 内置技能递归加载 |
| **注册表管理** | ✅ Map 存储 | ❓ 未知 | 高效的查找 |
| **不区分大小写** | ✅ 支持 | ❓ 未知 | 查找时不区分大小写 |
| **列表查询** | ✅ 完善 | ❓ 未知 | 按位置、名称查询 |

### 实现质量评估

**实现完整度**: ⭐⭐⭐⭐⭐ (5/5)
- 功能非常完整
- 加载机制完善
- 优先级系统清晰

**代码质量**: ⭐⭐⭐⭐⭐ (5/5)
- 架构设计优秀
- 缓存机制合理
- 代码可维护性高
- 错误处理完善

**与官方一致性**: ❓ (无法评估)
- 官方实现不明确
- 本项目实现完整且合理

**亮点**:
- 完整的三级优先级系统（project > user > builtin）
- 智能缓存机制（5分钟 TTL）
- Frontmatter 元数据支持
- 灵活的参数替换（$1, {{arg1}}, $@）
- 不区分大小写的查找
- 递归加载支持

---

## 总体评估

### 实现质量总结

| 工具功能 | 实现完整度 | 代码质量 | 与官方一致性 | 备注 |
|---------|-----------|---------|-------------|------|
| **T105: TodoWrite 工具** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐⭐ (5/5) | 核心功能完整 |
| **T106: TodoWrite 状态管理** | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | 缺少高级规则 |
| **T107: NotebookEdit 工具** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | 实现优秀 |
| **T108: NotebookEdit 模式** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | 三种模式完整 |
| **T109: Task/Agent 工具** | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | 缺少统一接口 |
| **T110: Agent 类型支持** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐ (3/5) | 工具过滤完善 |
| **T111: Agent 后台运行** | ⭐ (1/5) | N/A | ⭐ (1/5) | 未实现 |
| **T112: Agent 恢复机制** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) | 实现非常出色 |
| **T113: AskUserQuestion 工具** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | 交互体验优秀 |
| **T114: 多选问题支持** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | 多选功能完整 |
| **T115: Skill 工具** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐⭐ (5/5) | ❓ | 官方实现不明 |

**平均评分**:
- 实现完整度: ⭐⭐⭐⭐ (4.2/5)
- 代码质量: ⭐⭐⭐⭐ (4.5/5)
- 与官方一致性: ⭐⭐⭐⭐ (4.0/5)

### 优势亮点

1. **NotebookEdit 工具** (T107-T108)
   - 完整的 Jupyter notebook 格式验证
   - 严格的错误处理
   - 三种编辑模式都实现完善
   - 代码质量非常高

2. **Agent 恢复机制** (T112)
   - 完整的检查点系统
   - 灵活的恢复点选择
   - 详细的状态跟踪
   - 过期清理机制
   - 实现比官方公开的接口更完善

3. **AskUserQuestion 工具** (T113-T114)
   - 优秀的交互体验
   - 完整的键盘导航
   - 美观的终端 UI
   - TTY/非TTY 自动降级
   - 多选功能完整

4. **Skill 工具** (T115)
   - 完整的三级优先级系统
   - 智能缓存机制
   - Frontmatter 支持
   - 灵活的参数替换
   - 代码架构优秀

5. **Agent 工具过滤** (T110)
   - 详细的权限级别控制
   - 自定义限制机制
   - 速率限制支持
   - 范围限制支持
   - 工具别名支持

### 需要改进的方面

1. **Task/Agent 工具统一接口** (T109)
   - 缺少官方的 `AgentInput` 接口实现
   - 缺少 `TaskOutput` 工具
   - 需要整合现有的代理系统

2. **Agent 后台运行** (T111)
   - 完全未实现
   - 需要添加 `run_in_background` 支持
   - 需要实现 `TaskOutput` 工具

3. **TodoWrite 状态管理** (T106)
   - 缺少官方的严格验证规则
   - 缺少任务分解指导
   - 缺少完成条件验证

4. **Agent 类型支持** (T110)
   - 缺少 `whenToUse` 描述
   - 缺少 `forkContext` 支持
   - 缺少 `source` 标识
   - 缺少系统提示词配置

### 建议

1. **短期改进**:
   - 实现 `TaskOutput` 工具以支持后台运行
   - 添加 `AgentInput` 标准接口
   - 完善 TodoWrite 的状态验证规则
   - 为代理类型添加 `whenToUse` 描述

2. **中期改进**:
   - 实现完整的后台运行机制
   - 添加 `forkContext` 支持
   - 完善代理类型的元数据
   - 添加更多内置代理类型

3. **长期改进**:
   - 优化代理执行性能
   - 添加代理执行监控
   - 完善错误恢复策略
   - 添加代理执行分析工具

---

## 结论

本项目在其他工具功能方面的实现总体质量很高：

**优秀的方面**:
- NotebookEdit 工具实现完美（T107-T108）
- Agent 恢复机制非常出色（T112）
- AskUserQuestion 交互体验优秀（T113-T114）
- Skill 工具架构设计优秀（T115）
- Agent 工具过滤系统完善（T110）

**需要加强的方面**:
- Task/Agent 工具缺少统一接口（T109）
- Agent 后台运行完全未实现（T111）
- TodoWrite 状态管理规则需要完善（T106）

总体而言，本项目在这些工具功能的实现上展现了很高的代码质量和设计水平，部分实现（如 Agent 恢复机制、AskUserQuestion、Skill 工具）甚至比官方公开的接口更加完善和详细。主要的差距在于缺少 Task/Agent 的统一接口和后台运行支持，这些是需要优先完善的功能点。

---

**文档生成时间**: 2025-12-25
**分析版本**: v1.0
**官方包版本**: @anthropic-ai/claude-code (node_modules)
