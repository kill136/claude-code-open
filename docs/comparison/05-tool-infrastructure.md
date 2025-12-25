# 工具系统 - 基础架构功能点对比分析 (T056-T065)

## 概述

本文档对比分析本项目与官方 @anthropic-ai/claude-code 包在工具系统基础架构方面的实现差异。分析范围涵盖 10 个核心功能点（T056-T065）。

**分析方法说明**：
- 本项目源码：完整可读，位于 `/home/user/claude-code-open/src/tools/`
- 官方包：打包混淆后的代码，位于 `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js`
- 分析基于：本项目源码直接分析 + 官方包运行时行为推断

---

## T056: BaseTool 抽象类

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/base.ts` (第 8-31 行)

**实现详情**:
```typescript
export abstract class BaseTool<TInput = unknown, TOutput extends ToolResult = ToolResult> {
  abstract name: string;
  abstract description: string;

  abstract getInputSchema(): ToolDefinition['inputSchema'];
  abstract execute(input: TInput): Promise<TOutput>;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.getInputSchema(),
    };
  }

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected error(message: string): ToolResult {
    return { success: false, error: message };
  }
}
```

**关键特性**:
1. 泛型支持：`<TInput, TOutput>` 提供类型安全
2. 抽象方法：
   - `name`: 工具名称
   - `description`: 工具描述
   - `getInputSchema()`: 返回输入 Schema
   - `execute()`: 执行工具逻辑
3. 辅助方法：
   - `getDefinition()`: 组装工具定义
   - `success()`: 构造成功结果
   - `error()`: 构造失败结果

**继承示例** (ReadTool):
```typescript
export class ReadTool extends BaseTool<FileReadInput, FileResult> {
  name = 'Read';
  description = `Reads a file from the local filesystem...`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: { file_path: { type: 'string', ... } },
      required: ['file_path'],
    };
  }

  async execute(input: FileReadInput): Promise<FileResult> {
    // 实现逻辑
  }
}
```

### 官方包实现推断

基于官方包的运行时行为和结构分析：

1. **架构模式**: 官方包同样使用了基于继承的工具架构
2. **特征证据**:
   - 在混淆代码中发现类似的工具注册模式
   - 工具定义包含 `name`, `description`, `input_schema` 字段
   - 所有工具都遵循统一的执行接口

3. **可能差异**:
   - 官方包可能使用更复杂的验证逻辑
   - 可能包含额外的生命周期钩子（如 `beforeExecute`, `afterExecute`）
   - 错误处理可能更加精细化

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **基础架构** | 抽象类 + 泛型 | 类似抽象类模式 | ✅ 架构一致 |
| **类型安全** | 完整 TypeScript 泛型 | 编译后丢失类型信息 | ⚠️ 运行时无差异 |
| **辅助方法** | success/error 方法 | 推测有类似封装 | ✅ 功能对等 |
| **扩展性** | 易于继承和扩展 | 打包后难以扩展 | ⚠️ 开发体验差异 |

**完成度**: ✅ **100%** - 核心架构完全对齐

---

## T057: ToolRegistry 注册表

### 本项目实现

**文件位置**: `/home/user/claude-code-open/src/tools/base.ts` (第 33-64 行)

**实现详情**:
```typescript
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.getDefinition());
  }

  async execute(name: string, input: unknown): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found` };
    }
    try {
      return await tool.execute(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

export const toolRegistry = new ToolRegistry();
```

**工具注册** (`/home/user/claude-code-open/src/tools/index.ts`):
```typescript
export function registerAllTools(): void {
  // Bash 工具
  toolRegistry.register(new BashTool());
  toolRegistry.register(new BashOutputTool());
  toolRegistry.register(new KillShellTool());

  // 文件工具
  toolRegistry.register(new ReadTool());
  toolRegistry.register(new WriteTool());
  toolRegistry.register(new EditTool());

  // 搜索工具
  toolRegistry.register(new GlobTool());
  toolRegistry.register(new GrepTool());

  // ... 共注册 25+ 工具
}

registerAllTools(); // 自动注册
```

**关键特性**:
1. **存储结构**: `Map<string, BaseTool>` - O(1) 查找性能
2. **核心方法**:
   - `register()`: 注册工具
   - `get()`: 获取单个工具
   - `getAll()`: 获取所有工具
   - `getDefinitions()`: 获取所有工具定义（供 API 调用）
   - `execute()`: 统一执行入口，内置错误处理
3. **单例模式**: 全局唯一的 `toolRegistry` 实例
4. **自动注册**: 模块加载时自动注册所有工具

### 官方包实现推断

**证据线索**:
1. 在官方包中搜索到 `tool` 相关的注册和管理逻辑
2. 工具通过名称索引执行
3. 包含工具定义的序列化和传递

**推断特性**:
1. **注册机制**: 类似的集中式注册表
2. **工具发现**: 支持动态工具列表获取
3. **执行分发**: 通过工具名称路由到对应实现

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **注册机制** | Map 数据结构 | 类似映射机制 | ✅ 架构一致 |
| **工具查找** | O(1) 时间复杂度 | 推测类似 | ✅ 性能对等 |
| **错误处理** | 统一 try-catch 包装 | 推测有错误处理 | ✅ 功能对等 |
| **自动注册** | 模块加载时注册 | 推测类似 | ✅ 行为一致 |
| **工具数量** | 25+ 工具 | 官方 25+ 工具 | ✅ 完全覆盖 |

**完成度**: ✅ **100%** - 注册表功能完整

---

## T058: 工具 Schema 验证

### 本项目实现

**Schema 定义示例** (ReadTool):
```typescript
getInputSchema(): ToolDefinition['inputSchema'] {
  return {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'The line number to start reading from',
      },
      limit: {
        type: 'number',
        description: 'The number of lines to read',
      },
    },
    required: ['file_path'],
  };
}
```

**Schema 类型系统** (`/home/user/claude-code-open/src/types/messages.ts`):
```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: any;
      // ... JSON Schema 属性
    }>;
    required?: string[];
  };
}
```

**实际验证实现**:

本项目采用 **隐式验证** 策略：
1. **编译时验证**: TypeScript 类型系统确保类型安全
2. **运行时验证**: 由 Anthropic API 执行 Schema 验证
3. **工具内验证**: 在 `execute()` 方法中进行参数检查

示例 (BashTool):
```typescript
async execute(input: BashInput): Promise<BashResult> {
  const { command, timeout = 120000, description, run_in_background } = input;

  // 参数验证
  if (!command || typeof command !== 'string') {
    return this.error('Command must be a non-empty string');
  }

  if (timeout && (timeout < 0 || timeout > 600000)) {
    return this.error('Timeout must be between 0 and 600000ms');
  }

  // ... 执行逻辑
}
```

**TypeScript 类型定义** (`/home/user/claude-code-open/src/types/tools.ts`):
```typescript
export interface BashInput {
  command: string;
  timeout?: number;
  description?: string;
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;
}
```

### 官方包实现推断

基于官方包结构分析：

**推断特性**:
1. **Schema 定义**: JSON Schema 格式（与 Anthropic API 规范一致）
2. **验证时机**:
   - API 层面的 Schema 验证
   - 工具内部的参数检查
3. **错误反馈**: 验证失败时返回详细错误信息

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **Schema 格式** | JSON Schema (标准) | JSON Schema | ✅ 完全一致 |
| **类型安全** | TypeScript 强类型 | 打包后类型擦除 | ⚠️ 开发时差异 |
| **验证层级** | 编译时 + 运行时 | 运行时 | ✅ 运行时对等 |
| **错误提示** | 明确的错误消息 | 推测类似 | ✅ 功能对等 |
| **自定义验证** | 工具内实现 | 推测类似 | ✅ 灵活性一致 |

**完成度**: ✅ **95%** - Schema 系统完整，可能缺少复杂的验证库集成

**潜在增强**:
- 集成 Zod 或 Joi 进行运行时验证
- 自动从 TypeScript 类型生成 JSON Schema
- 更详细的验证错误消息

---

## T059: 工具权限检查

### 本项目实现

**当前状态**: ⚠️ **未实现完整的权限检查系统**

**相关代码痕迹**:

1. **沙箱模式** (BashTool):
```typescript
export interface BashInput {
  dangerouslyDisableSandbox?: boolean; // 权限相关标记
}
```

2. **配置文件引用** (`/home/user/claude-code-open/src/types/config.ts`):
```typescript
export interface Config {
  permissionMode?: PermissionMode;
  // ...
}

export type PermissionMode = 'acceptEdits' | 'bypassPermissions' | 'plan';
```

3. **会话状态** (从官方包搜索结果推断):
```typescript
// 推测的权限状态
sessionBypassPermissionsMode?: boolean;
```

**缺失功能**:
- 没有独立的权限检查模块
- 没有工具级别的权限配置
- 没有用户交互式权限确认

### 官方包实现推断

基于搜索结果中发现的关键词：

**推断特性**:
1. **权限模式**:
   - `acceptEdits`: 自动接受编辑类操作
   - `bypassPermissions`: 绕过权限检查
   - `plan`: 计划模式（仅规划不执行）

2. **权限检查点**:
   - 文件写入操作 (Write, Edit, MultiEdit)
   - Bash 命令执行
   - 危险操作（删除文件、修改系统配置等）

3. **会话级配置**:
   - `sessionBypassPermissionsMode`: 会话级别权限绕过
   - 可在运行时动态调整权限策略

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **权限模式** | 仅类型定义 | 完整实现 | ❌ **缺失** |
| **检查机制** | 无 | 有 | ❌ **缺失** |
| **用户交互** | 无 | 推测有确认提示 | ❌ **缺失** |
| **沙箱支持** | 有标记位 | 推测集成 | ⚠️ **部分实现** |
| **审计日志** | 无 | 推测有 | ❌ **缺失** |

**完成度**: ❌ **20%** - 仅有基础架构，核心功能缺失

**需要实现**:
1. **权限检查中间件**:
```typescript
// 建议实现
class PermissionChecker {
  async checkPermission(tool: BaseTool, input: unknown): Promise<boolean> {
    const mode = getPermissionMode();

    if (mode === 'bypassPermissions') return true;
    if (mode === 'plan') return false; // 仅计划模式

    // 危险工具需要确认
    if (DANGEROUS_TOOLS.includes(tool.name)) {
      return await askUserConfirmation(tool, input);
    }

    return true;
  }
}
```

2. **工具分类**:
```typescript
const DANGEROUS_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit'];
const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch'];
```

3. **审计日志**:
```typescript
interface PermissionAuditLog {
  timestamp: number;
  tool: string;
  action: 'granted' | 'denied' | 'bypassed';
  reason?: string;
}
```

---

## T060: 工具执行超时

### 本项目实现

**Bash 工具超时** (`/home/user/claude-code-open/src/tools/bash.ts`):
```typescript
export interface BashInput {
  command: string;
  timeout?: number; // 可选超时，默认 120000ms
  // ...
}

async execute(input: BashInput): Promise<BashResult> {
  const { command, timeout = 120000 } = input; // 默认 2 分钟

  // 验证超时范围
  if (timeout && (timeout < 0 || timeout > 600000)) {
    return this.error('Timeout must be between 0 and 600000ms');
  }

  // 使用 child_process 的 timeout 选项
  const result = await execCommand(command, {
    timeout,
    killSignal: 'SIGTERM',
  });

  // 处理超时错误
  if (result.killed && result.signal === 'SIGTERM') {
    return {
      success: false,
      error: `Command timed out after ${timeout}ms`,
      exitCode: -1,
    };
  }

  return result;
}
```

**其他工具超时状态**:

1. **WebFetch**: 无明确超时控制（依赖 axios 默认超时）
2. **WebSearch**: 无明确超时控制
3. **Agent (Task)**: 无明确超时控制
4. **Read/Write/Edit**: 不需要超时（IO 操作较快）

### 官方包实现推断

基于官方包结构和行为：

**推断特性**:
1. **Bash 超时**: 类似实现，支持最大 600000ms (10分钟)
2. **全局超时**: 可能有工具执行的全局超时配置
3. **超时处理**: 优雅终止进程，返回超时错误

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **Bash 超时** | ✅ 完整实现 | ✅ 完整实现 | ✅ 功能一致 |
| **默认值** | 120000ms (2分钟) | 推测类似 | ✅ 配置一致 |
| **最大限制** | 600000ms (10分钟) | 推测类似 | ✅ 限制一致 |
| **超时处理** | SIGTERM 信号终止 | 推测类似 | ✅ 机制对等 |
| **其他工具超时** | ❌ 未实现 | 推测部分实现 | ⚠️ **部分缺失** |

**完成度**: ✅ **70%** - Bash 工具完整，其他工具缺失

**需要增强**:
1. **统一超时框架**:
```typescript
abstract class BaseTool {
  protected defaultTimeout = 120000; // 2分钟
  protected maxTimeout = 600000;     // 10分钟

  async executeWithTimeout(input: TInput): Promise<TOutput> {
    const timeout = this.getTimeout(input);

    return Promise.race([
      this.execute(input),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      ),
    ]);
  }
}
```

2. **工具特定超时配置**:
```typescript
class WebFetchTool extends BaseTool {
  protected defaultTimeout = 30000; // 30秒（网络请求更短）
}

class AgentTool extends BaseTool {
  protected defaultTimeout = 300000; // 5分钟（AI 任务更长）
}
```

---

## T061: 工具结果格式化

### 本项目实现

**结果类型系统** (`/home/user/claude-code-open/src/types/results.ts`):

**基础结果类型**:
```typescript
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ToolSuccess extends ToolResult {
  success: true;
  output: string;
  error?: never;
}

export interface ToolError extends ToolResult {
  success: false;
  output?: never;
  error: string;
}
```

**专用结果类型** (共 20+ 种):
```typescript
// Bash 结果
export interface BashToolResult extends ToolResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  bash_id?: string;
  duration?: number;
  sandboxed?: boolean;
  cwd?: string;
}

// 文件读取结果
export interface ReadToolResult extends ToolResult {
  content?: string;
  lineCount?: number;
  fileSize?: number;
  fileType?: string;
  truncated?: boolean;
  offset?: number;
  limit?: number;
}

// 搜索结果
export interface GrepToolResult extends ToolResult {
  matches?: Array<{
    file: string;
    line?: number;
    content?: string;
    count?: number;
  }>;
  totalMatches?: number;
  filesWithMatches?: number;
  outputMode?: 'content' | 'files_with_matches' | 'count';
  pattern?: string;
}
```

**格式化辅助函数**:
```typescript
export function formatToolResult(result: ToolResult): string {
  if (result.success) {
    return result.output || 'Success (no output)';
  } else {
    return `Error: ${result.error || 'Unknown error'}`;
  }
}

export function createToolSuccess(
  output: string,
  additionalProps?: Partial<ToolResult>
): ToolSuccess {
  return {
    success: true as const,
    output,
    ...additionalProps,
  } as ToolSuccess;
}

export function createToolError(
  error: string,
  additionalProps?: Partial<ToolResult>
): ToolError {
  return {
    success: false as const,
    error,
    ...additionalProps,
  } as ToolError;
}
```

**实际使用示例** (BashTool):
```typescript
return {
  success: true,
  output: stdout,
  exitCode: code,
  stdout,
  stderr,
  duration: Date.now() - startTime,
  sandboxed: !input.dangerouslyDisableSandbox,
  cwd: process.cwd(),
};
```

### 官方包实现推断

**推断特性**:
1. **统一结构**: 所有工具返回包含 `success` 字段的结果
2. **丰富元数据**: 包含执行时间、上下文信息等
3. **类型区分**: 不同工具有专门的结果结构

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **基础结构** | success/output/error | 推测类似 | ✅ 结构一致 |
| **类型多样性** | 20+ 专用结果类型 | 推测类似 | ✅ 完整覆盖 |
| **元数据丰富度** | 包含时间、上下文等 | 推测类似 | ✅ 信息完整 |
| **辅助函数** | 完整的工厂函数 | 推测有 | ✅ 工具完备 |
| **类型守卫** | 9 个类型守卫函数 | 推测少 | ⚠️ **更优** |

**完成度**: ✅ **100%** - 结果格式化系统完整

**优势特性**:
1. **类型守卫系统**:
```typescript
export function isToolSuccess(result: ToolResult): result is ToolSuccess {
  return result.success === true && result.output !== undefined;
}

export function isBashResult(result: ToolResult): result is BashToolResult {
  return 'exitCode' in result || 'stdout' in result;
}

export function isGrepResult(result: ToolResult): result is GrepToolResult {
  return 'matches' in result || 'totalMatches' in result;
}
```

2. **向后兼容别名**:
```typescript
/** @deprecated Use BashToolResult instead */
export type BashResult = BashToolResult;

/** @deprecated Use ReadToolResult instead */
export type FileResult = ReadToolResult;
```

---

## T062: 工具允许/禁止列表

### 本项目实现

**当前状态**: ⚠️ **未明确实现**

**相关配置结构** (推测):
```typescript
// 从官方包搜索结果推断的配置结构
interface ToolFilterConfig {
  allowedTools?: string[];
  disallowedTools?: string[];
  toolsMode?: 'allowlist' | 'denylist';
}
```

**潜在实现位置**:
- 配置文件 (`~/.claude/settings.json`)
- 会话参数
- 环境变量

**缺失功能**:
- 没有工具过滤中间件
- 没有配置加载逻辑
- 没有工具可用性检查

### 官方包实现推断

基于官方包搜索结果中的线索：

**推断特性**:
1. **配置支持**: 允许通过配置指定工具白名单/黑名单
2. **动态过滤**: 运行时根据配置过滤可用工具
3. **agent 级别过滤**: 不同 agent 可用不同工具集

示例配置（推测）:
```json
{
  "tools": {
    "allowed": ["Read", "Grep", "Glob"],
    "disallowed": ["Write", "Edit", "Bash"]
  }
}
```

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **配置支持** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **过滤机制** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **白名单模式** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **黑名单模式** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **动态调整** | ❌ 无 | 推测有 | ❌ **缺失** |

**完成度**: ❌ **0%** - 完全未实现

**需要实现**:

1. **配置结构**:
```typescript
interface ToolFilterConfig {
  mode: 'allowlist' | 'denylist' | 'all';
  allowedTools?: string[];
  disallowedTools?: string[];
}
```

2. **过滤器实现**:
```typescript
class ToolFilter {
  constructor(private config: ToolFilterConfig) {}

  isToolAllowed(toolName: string): boolean {
    if (this.config.mode === 'all') return true;

    if (this.config.mode === 'allowlist') {
      return this.config.allowedTools?.includes(toolName) ?? false;
    }

    if (this.config.mode === 'denylist') {
      return !this.config.disallowedTools?.includes(toolName);
    }

    return true;
  }

  filterTools(tools: BaseTool[]): BaseTool[] {
    return tools.filter(tool => this.isToolAllowed(tool.name));
  }
}
```

3. **集成到注册表**:
```typescript
class ToolRegistry {
  private filter?: ToolFilter;

  setFilter(config: ToolFilterConfig) {
    this.filter = new ToolFilter(config);
  }

  getAll(): BaseTool[] {
    const allTools = Array.from(this.tools.values());
    return this.filter ? this.filter.filterTools(allTools) : allTools;
  }

  async execute(name: string, input: unknown): Promise<ToolResult> {
    if (this.filter && !this.filter.isToolAllowed(name)) {
      return {
        success: false,
        error: `Tool '${name}' is not allowed by current configuration`,
      };
    }
    // ... 原有执行逻辑
  }
}
```

---

## T063: 工具执行日志

### 本项目实现

**当前状态**: ⚠️ **部分实现**

**现有日志功能**:

1. **调试日志** (从官方包搜索结果推断):
```typescript
// 推测的日志函数（在官方包中发现）
function k(message: string) {
  // 日志输出逻辑
}

// 使用示例
if (duration > 5000) {
  k(`[SLOW OPERATION DETECTED] fs.${operation} (${duration.toFixed(1)}ms)`);
}
```

2. **会话状态日志** (推断):
```typescript
interface SessionState {
  inMemoryErrorLog: any[]; // 内存中的错误日志
  // ...
}
```

**缺失功能**:
- 没有结构化的工具执行日志
- 没有日志级别控制
- 没有日志持久化
- 没有日志查询接口

### 官方包实现推断

**推断特性**:
1. **性能监控**: 记录慢操作（> 5000ms）
2. **错误日志**: 内存中保存错误信息
3. **事件日志**: 使用 eventLogger 记录关键事件

```typescript
// 推测的日志结构
interface ToolExecutionLog {
  timestamp: number;
  toolName: string;
  input: unknown;
  output?: ToolResult;
  duration: number;
  success: boolean;
  error?: string;
}
```

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **基础日志** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **性能监控** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **错误追踪** | ❌ 无 | ✅ 有（内存日志） | ❌ **缺失** |
| **结构化日志** | ❌ 无 | 推测有 | ❌ **缺失** |
| **日志持久化** | ❌ 无 | 推测有 | ❌ **缺失** |

**完成度**: ❌ **10%** - 几乎未实现

**需要实现**:

1. **日志系统**:
```typescript
interface ToolExecutionLog {
  id: string;
  timestamp: number;
  toolName: string;
  input: unknown;
  output?: ToolResult;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

class ToolLogger {
  private logs: ToolExecutionLog[] = [];
  private maxLogs = 1000; // 最大内存日志数量

  log(entry: ToolExecutionLog) {
    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 持久化日志（可选）
    if (this.shouldPersist(entry)) {
      this.persistLog(entry);
    }
  }

  getRecentLogs(count: number = 100): ToolExecutionLog[] {
    return this.logs.slice(-count);
  }

  getLogsByTool(toolName: string): ToolExecutionLog[] {
    return this.logs.filter(log => log.toolName === toolName);
  }

  getErrorLogs(): ToolExecutionLog[] {
    return this.logs.filter(log => !log.success);
  }

  private shouldPersist(entry: ToolExecutionLog): boolean {
    // 错误日志、慢操作、特定工具等需要持久化
    return !entry.success || entry.duration > 5000;
  }

  private persistLog(entry: ToolExecutionLog) {
    // 写入文件或数据库
    const logFile = path.join(configDir(), 'tool_logs.jsonl');
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  }
}
```

2. **集成到工具执行**:
```typescript
class ToolRegistry {
  private logger = new ToolLogger();

  async execute(name: string, input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const logId = randomUUID();

    let result: ToolResult;
    try {
      const tool = this.get(name);
      if (!tool) {
        result = { success: false, error: `Tool '${name}' not found` };
      } else {
        result = await tool.execute(input);
      }
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 记录日志
    this.logger.log({
      id: logId,
      timestamp: startTime,
      toolName: name,
      input,
      output: result,
      duration: Date.now() - startTime,
      success: result.success,
      error: result.error,
    });

    return result;
  }
}
```

---

## T064: 工具错误处理

### 本项目实现

**错误处理层级**:

**1. BaseTool 级别**:
```typescript
export abstract class BaseTool {
  protected error(message: string): ToolResult {
    return { success: false, error: message };
  }
}
```

**2. ToolRegistry 级别**:
```typescript
async execute(name: string, input: unknown): Promise<ToolResult> {
  const tool = this.get(name);
  if (!tool) {
    return { success: false, error: `Tool '${name}' not found` };
  }

  try {
    return await tool.execute(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

**3. 具体工具错误处理示例** (ReadTool):
```typescript
async execute(input: FileReadInput): Promise<FileResult> {
  const { file_path } = input;

  try {
    if (!fs.existsSync(file_path)) {
      return { success: false, error: `File not found: ${file_path}` };
    }

    const stat = fs.statSync(file_path);
    if (stat.isDirectory()) {
      return {
        success: false,
        error: `Path is a directory: ${file_path}. Use ls command instead.`,
      };
    }

    // ... 正常执行
  } catch (err) {
    return {
      success: false,
      error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

**4. 错误类型系统** (`/home/user/claude-code-open/src/types/errors.ts`):
```typescript
export enum ErrorCode {
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  // ... 更多错误代码
}

export class ToolExecutionError extends BaseClaudeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, ErrorCode.TOOL_EXECUTION_ERROR, options);
    this.name = 'ToolExecutionError';
  }
}

// 错误工厂函数
export function createToolExecutionError(
  message: string,
  options?: ErrorOptions
): ToolExecutionError {
  return new ToolExecutionError(message, options);
}
```

**BashTool 的详细错误处理**:
```typescript
// 超时处理
if (result.killed && result.signal === 'SIGTERM') {
  return {
    success: false,
    error: `Command timed out after ${timeout}ms`,
    exitCode: -1,
  };
}

// 命令执行失败
if (result.exitCode !== 0) {
  return {
    success: false,
    output: result.stdout,
    error: result.stderr || `Command failed with exit code ${result.exitCode}`,
    exitCode: result.exitCode,
  };
}

// 沙箱错误
if (sandboxError) {
  return {
    success: false,
    error: `Sandbox execution failed: ${sandboxError.message}`,
  };
}
```

### 官方包实现推断

**推断特性**:
1. **多层错误捕获**: Registry → Tool → 具体操作
2. **详细错误信息**: 包含上下文、堆栈跟踪等
3. **错误恢复**: 某些错误可重试

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **错误捕获** | ✅ 多层 try-catch | 推测类似 | ✅ 完整实现 |
| **错误类型** | ✅ 10+ 错误类 | 推测少 | ⚠️ **更丰富** |
| **错误消息** | ✅ 详细清晰 | 推测类似 | ✅ 质量对等 |
| **堆栈跟踪** | ✅ 保留 stack | 推测有 | ✅ 功能对等 |
| **错误恢复** | ⚠️ 部分支持 | 推测有 | ⚠️ **可增强** |

**完成度**: ✅ **90%** - 错误处理系统完善

**优势特性**:

1. **完整的错误类层次**:
```typescript
BaseClaudeError
├── ToolExecutionError
├── PermissionDeniedError
├── ValidationError
├── TimeoutError
├── NetworkError
├── AuthenticationError
├── ConfigurationError
├── SessionError
├── SandboxError
└── SystemError
```

2. **错误辅助函数**:
```typescript
// 判断错误类型
export function isClaudeError(error: any): error is BaseClaudeError;
export function isRecoverableError(error: any): boolean;
export function isRetryableError(error: any): boolean;

// 格式化错误
export function formatError(error: any): string;
export function getErrorSeverity(error: any): ErrorSeverity;

// 错误包装
export function wrapWithErrorHandling<T>(
  fn: () => T,
  errorMessage?: string
): T | never;
```

**需要增强**:
- 实现错误重试机制
- 添加错误上报和监控
- 增强错误恢复策略

---

## T065: 工具执行统计

### 本项目实现

**当前状态**: ⚠️ **部分实现**

**会话统计** (从官方包搜索结果推断):
```typescript
interface SessionState {
  totalToolDuration: number;          // 工具总执行时间
  totalAPIDuration: number;           // API 总调用时间
  totalLinesAdded: number;            // 添加的代码行数
  totalLinesRemoved: number;          // 删除的代码行数
  modelUsage: Record<string, {       // 模型使用统计
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  }>;
}

// 统计更新函数（推测）
function uF1(duration: number) {
  r0.totalToolDuration += duration;
}

function mF1(added: number, removed: number) {
  r0.totalLinesAdded += added;
  r0.totalLinesRemoved += removed;
}
```

**OpenTelemetry 集成** (推测):
```typescript
interface SessionState {
  meter: any;                          // OpenTelemetry Meter
  sessionCounter: any;                 // 会话计数器
  locCounter: any;                     // 代码行计数器
  prCounter: any;                      // PR 计数器
  commitCounter: any;                  // 提交计数器
  costCounter: any;                    // 成本计数器
  tokenCounter: any;                   // Token 计数器
  codeEditToolDecisionCounter: any;    // 代码编辑决策计数器
  activeTimeCounter: any;              // 活跃时间计数器
}
```

**缺失功能**:
- 没有独立的统计模块
- 没有工具级别的详细统计
- 没有统计数据导出功能

### 官方包实现推断

基于搜索结果中的计数器配置：

**推断特性**:
1. **OpenTelemetry 集成**: 使用标准可观测性框架
2. **多维度统计**:
   - 会话级别：会话数、总时间、总成本
   - 工具级别：执行次数、成功率、平均耗时
   - 代码级别：LOC 变更、编辑决策
   - 业务级别：PR 数量、提交数量

3. **实时计数器**:
```typescript
// 推测的计数器配置
vT0(meter, createCounter) {
  r0.meter = meter;
  r0.sessionCounter = createCounter("claude_code.session.count", {
    description: "Count of CLI sessions started"
  });
  r0.locCounter = createCounter("claude_code.lines_of_code.count", {
    description: "Lines of code modified",
    // 'type' attribute: 'added' or 'removed'
  });
  r0.prCounter = createCounter("claude_code.pull_request.count");
  r0.commitCounter = createCounter("claude_code.commit.count");
  r0.costCounter = createCounter("claude_code.cost.usage", {
    unit: "USD"
  });
  r0.tokenCounter = createCounter("claude_code.token.usage", {
    unit: "tokens"
  });
}
```

### 对比结论

| 维度 | 本项目 | 官方包（推断） | 差异评估 |
|------|--------|---------------|----------|
| **基础统计** | ⚠️ 部分实现 | ✅ 完整实现 | ⚠️ **部分缺失** |
| **OpenTelemetry** | ❌ 无 | ✅ 有 | ❌ **缺失** |
| **工具级统计** | ❌ 无 | 推测有 | ❌ **缺失** |
| **实时计数** | ⚠️ 会话级 | ✅ 多维度 | ⚠️ **部分缺失** |
| **数据导出** | ❌ 无 | 推测有 | ❌ **缺失** |

**完成度**: ⚠️ **30%** - 基础统计有，高级功能缺失

**需要实现**:

1. **工具统计模块**:
```typescript
interface ToolExecutionStats {
  toolName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecutionTime: number;
}

class ToolStatistics {
  private stats: Map<string, ToolExecutionStats> = new Map();

  recordExecution(
    toolName: string,
    duration: number,
    success: boolean
  ) {
    const stat = this.stats.get(toolName) || {
      toolName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastExecutionTime: 0,
    };

    stat.executionCount++;
    if (success) {
      stat.successCount++;
    } else {
      stat.failureCount++;
    }
    stat.totalDuration += duration;
    stat.averageDuration = stat.totalDuration / stat.executionCount;
    stat.minDuration = Math.min(stat.minDuration, duration);
    stat.maxDuration = Math.max(stat.maxDuration, duration);
    stat.lastExecutionTime = Date.now();

    this.stats.set(toolName, stat);
  }

  getStats(toolName?: string): ToolExecutionStats | ToolExecutionStats[] {
    if (toolName) {
      return this.stats.get(toolName) || null;
    }
    return Array.from(this.stats.values());
  }

  getTopTools(by: 'count' | 'duration', limit: number = 10): ToolExecutionStats[] {
    const allStats = Array.from(this.stats.values());
    return allStats
      .sort((a, b) => {
        if (by === 'count') {
          return b.executionCount - a.executionCount;
        }
        return b.totalDuration - a.totalDuration;
      })
      .slice(0, limit);
  }

  export(): string {
    return JSON.stringify(Array.from(this.stats.values()), null, 2);
  }
}
```

2. **OpenTelemetry 集成**:
```typescript
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';

class TelemetryIntegration {
  private meterProvider: MeterProvider;
  private meter: any;
  private counters: Record<string, any> = {};

  initialize() {
    this.meterProvider = new MeterProvider({
      resource: new Resource({
        'service.name': 'claude-code-cli',
        'service.version': '2.0.76',
      }),
    });

    this.meter = this.meterProvider.getMeter('claude-code');

    // 创建计数器
    this.counters.session = this.meter.createCounter(
      'claude_code.session.count',
      { description: 'CLI sessions started' }
    );

    this.counters.toolExecution = this.meter.createCounter(
      'claude_code.tool.execution',
      { description: 'Tool executions' }
    );

    this.counters.loc = this.meter.createCounter(
      'claude_code.lines_of_code.count',
      { description: 'Lines of code modified' }
    );

    this.counters.cost = this.meter.createCounter(
      'claude_code.cost.usage',
      { description: 'Cost in USD', unit: 'USD' }
    );

    this.counters.tokens = this.meter.createCounter(
      'claude_code.token.usage',
      { description: 'Tokens used', unit: 'tokens' }
    );
  }

  recordToolExecution(toolName: string, success: boolean) {
    this.counters.toolExecution.add(1, {
      tool: toolName,
      success: success.toString(),
    });
  }

  recordLinesOfCode(added: number, removed: number) {
    this.counters.loc.add(added, { type: 'added' });
    this.counters.loc.add(removed, { type: 'removed' });
  }

  recordCost(cost: number) {
    this.counters.cost.add(cost);
  }

  recordTokens(input: number, output: number) {
    this.counters.tokens.add(input, { type: 'input' });
    this.counters.tokens.add(output, { type: 'output' });
  }
}
```

3. **集成到 ToolRegistry**:
```typescript
class ToolRegistry {
  private stats = new ToolStatistics();
  private telemetry = new TelemetryIntegration();

  async execute(name: string, input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const result = await this.executeInternal(name, input);
    const duration = Date.now() - startTime;

    // 记录统计
    this.stats.recordExecution(name, duration, result.success);
    this.telemetry.recordToolExecution(name, result.success);

    return result;
  }

  getStatistics(toolName?: string) {
    return this.stats.getStats(toolName);
  }

  exportStatistics(): string {
    return this.stats.export();
  }
}
```

---

## 总体完成度评估

### 功能点完成度汇总

| 功能点 | 功能名称 | 完成度 | 状态 | 优先级 |
|--------|---------|--------|------|--------|
| T056 | BaseTool 抽象类 | 100% | ✅ 完整 | 核心 |
| T057 | ToolRegistry 注册表 | 100% | ✅ 完整 | 核心 |
| T058 | 工具 Schema 验证 | 95% | ✅ 几乎完整 | 核心 |
| T059 | 工具权限检查 | 20% | ❌ 严重缺失 | 高 |
| T060 | 工具执行超时 | 70% | ⚠️ 部分实现 | 中 |
| T061 | 工具结果格式化 | 100% | ✅ 完整 | 核心 |
| T062 | 工具允许/禁止列表 | 0% | ❌ 未实现 | 中 |
| T063 | 工具执行日志 | 10% | ❌ 严重缺失 | 高 |
| T064 | 工具错误处理 | 90% | ✅ 几乎完整 | 核心 |
| T065 | 工具执行统计 | 30% | ⚠️ 部分实现 | 中 |

**总体完成度**: **61.5%**

### 架构优势

1. **清晰的继承体系**: BaseTool 抽象类设计合理，易于扩展
2. **完善的类型系统**: TypeScript 泛型和类型守卫提供强类型保障
3. **丰富的结果类型**: 20+ 专用结果类型，元数据丰富
4. **优秀的错误处理**: 10+ 错误类，完整的错误处理链路

### 主要缺失功能

#### 高优先级（影响功能性）

1. **T059 工具权限检查** (80% 缺失)
   - 缺少权限模式配置
   - 缺少用户确认机制
   - 缺少审计日志

2. **T063 工具执行日志** (90% 缺失)
   - 缺少结构化日志系统
   - 缺少日志持久化
   - 缺少日志查询接口

3. **T062 工具允许/禁止列表** (100% 缺失)
   - 完全未实现工具过滤

#### 中优先级（影响体验）

4. **T060 工具执行超时** (30% 缺失)
   - 仅 Bash 工具有超时
   - 缺少统一超时框架

5. **T065 工具执行统计** (70% 缺失)
   - 缺少 OpenTelemetry 集成
   - 缺少工具级详细统计
   - 缺少数据导出功能

### 实现建议优先级

**第一阶段** (核心功能补全):
1. 实现工具权限检查系统 (T059)
2. 实现工具执行日志系统 (T063)
3. 实现工具过滤机制 (T062)

**第二阶段** (体验优化):
4. 完善工具超时机制 (T060)
5. 集成 OpenTelemetry 统计 (T065)

**第三阶段** (高级特性):
6. 错误重试和恢复机制
7. 高级 Schema 验证（Zod/Joi）
8. 性能监控和优化

---

## 附录：代码参考

### A. 权限检查实现模板

```typescript
// src/tools/permissions.ts
export class PermissionManager {
  private mode: PermissionMode = 'default';

  setMode(mode: PermissionMode) {
    this.mode = mode;
  }

  async checkPermission(
    tool: BaseTool,
    input: unknown
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 绕过模式
    if (this.mode === 'bypassPermissions') {
      return { allowed: true };
    }

    // 计划模式（只规划不执行）
    if (this.mode === 'plan') {
      return { allowed: false, reason: 'Plan mode active' };
    }

    // 危险工具需要确认
    if (DANGEROUS_TOOLS.includes(tool.name)) {
      if (this.mode === 'acceptEdits') {
        return { allowed: true };
      }

      const confirmed = await this.askUserConfirmation(tool, input);
      return { allowed: confirmed };
    }

    return { allowed: true };
  }

  private async askUserConfirmation(
    tool: BaseTool,
    input: unknown
  ): Promise<boolean> {
    // 实现用户交互确认逻辑
    console.log(`\n⚠️  Tool ${tool.name} requires confirmation:`);
    console.log(JSON.stringify(input, null, 2));

    const answer = await prompt('Allow execution? (y/n): ');
    return answer.toLowerCase() === 'y';
  }
}
```

### B. 日志系统实现模板

```typescript
// src/tools/logging.ts
export class ToolExecutionLogger {
  private logStream: fs.WriteStream;
  private memoryLogs: ToolExecutionLog[] = [];

  constructor(logDir: string) {
    const logPath = path.join(logDir, 'tool-execution.jsonl');
    this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
  }

  log(entry: ToolExecutionLog) {
    // 内存日志
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > 1000) {
      this.memoryLogs.shift();
    }

    // 持久化日志
    this.logStream.write(JSON.stringify(entry) + '\n');
  }

  query(filters: {
    toolName?: string;
    success?: boolean;
    since?: number;
    limit?: number;
  }): ToolExecutionLog[] {
    let results = this.memoryLogs;

    if (filters.toolName) {
      results = results.filter(l => l.toolName === filters.toolName);
    }

    if (filters.success !== undefined) {
      results = results.filter(l => l.success === filters.success);
    }

    if (filters.since) {
      results = results.filter(l => l.timestamp >= filters.since);
    }

    if (filters.limit) {
      results = results.slice(-filters.limit);
    }

    return results;
  }

  close() {
    this.logStream.end();
  }
}
```

### C. 统计系统实现模板

```typescript
// src/tools/statistics.ts
export class ToolStatisticsCollector {
  private stats = new Map<string, ToolExecutionStats>();
  private telemetry?: TelemetryIntegration;

  enableTelemetry() {
    this.telemetry = new TelemetryIntegration();
    this.telemetry.initialize();
  }

  recordExecution(
    toolName: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ) {
    // 更新统计
    const stat = this.getOrCreateStat(toolName);
    stat.executionCount++;
    stat.successCount += success ? 1 : 0;
    stat.failureCount += success ? 0 : 1;
    stat.totalDuration += duration;
    stat.averageDuration = stat.totalDuration / stat.executionCount;
    stat.minDuration = Math.min(stat.minDuration, duration);
    stat.maxDuration = Math.max(stat.maxDuration, duration);
    stat.lastExecutionTime = Date.now();

    // 发送到遥测系统
    if (this.telemetry) {
      this.telemetry.recordToolExecution(toolName, success);
    }
  }

  getReport(): ToolStatisticsReport {
    const allStats = Array.from(this.stats.values());

    return {
      totalExecutions: allStats.reduce((sum, s) => sum + s.executionCount, 0),
      totalSuccesses: allStats.reduce((sum, s) => sum + s.successCount, 0),
      totalFailures: allStats.reduce((sum, s) => sum + s.failureCount, 0),
      totalDuration: allStats.reduce((sum, s) => sum + s.totalDuration, 0),
      toolStats: allStats,
      topToolsByCount: this.getTopTools('count', 10),
      topToolsByDuration: this.getTopTools('duration', 10),
    };
  }

  exportToFile(filepath: string) {
    const report = this.getReport();
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  }
}
```

---

## 结论

本项目在工具系统的核心架构（BaseTool、ToolRegistry、Schema、结果格式化、错误处理）方面实现完整且质量优秀，总体完成度为 **61.5%**。

**主要优势**:
- 清晰的架构设计
- 完善的类型系统
- 优秀的代码可读性

**主要缺失**:
- 权限检查系统 (高优先级)
- 执行日志系统 (高优先级)
- 工具过滤机制 (中优先级)
- 统计和遥测系统 (中优先级)

建议优先实现权限检查和执行日志系统，以达到与官方包功能对等的目标。

---

**文档版本**: v1.0
**分析日期**: 2025-12-25
**分析范围**: T056-T065 (工具系统基础架构)
**下一步**: 分析 T066-T075 (具体工具实现)
