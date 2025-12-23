/**
 * Claude Code 类型定义
 * 基于 sdk-tools.d.ts 还原
 */

// ============ 工具输入类型 ============

export interface AgentInput {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: "sonnet" | "opus" | "haiku";
  resume?: string;
  run_in_background?: boolean;
}

export interface BashInput {
  command: string;
  timeout?: number;
  description?: string;
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;
}

export interface BashOutputInput {
  bash_id: string;
  filter?: string;
}

// TaskOutputInput - 官方 API 兼容
export interface TaskOutputInput {
  task_id: string;
  block?: boolean;
  timeout?: number;
}

export interface KillShellInput {
  shell_id: string;
}

export interface FileReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface FileWriteInput {
  file_path: string;
  content: string;
}

export interface FileEditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface GlobInput {
  pattern: string;
  path?: string;
}

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  "-B"?: number;
  "-A"?: number;
  "-C"?: number;
  "-n"?: boolean;
  "-i"?: boolean;
  type?: string;
  head_limit?: number;
  offset?: number;
  multiline?: boolean;
}

export interface WebFetchInput {
  url: string;
  prompt: string;
}

export interface WebSearchInput {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

export interface TodoWriteInput {
  todos: TodoItem[];
}

export interface NotebookEditInput {
  notebook_path: string;
  cell_id?: string;
  new_source: string;
  cell_type?: "code" | "markdown";
  edit_mode?: "replace" | "insert" | "delete";
}

export interface McpInput {
  [k: string]: unknown;
}

export interface ListMcpResourcesInput {
  server?: string;
}

export interface ReadMcpResourceInput {
  server: string;
  uri: string;
}

export interface AskUserQuestionOption {
  label: string;
  description: string;
}

export interface AskUserQuestion {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect: boolean;
}

export interface AskUserQuestionInput {
  questions: AskUserQuestion[];
}

export interface ExitPlanModeInput {
  [k: string]: unknown;
}

// ============ 工具结果类型 ============

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface BashResult extends ToolResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  bash_id?: string;
}

export interface FileResult extends ToolResult {
  content?: string;
  lineCount?: number;
}

export interface GrepResult extends ToolResult {
  matches?: Array<{
    file: string;
    line?: number;
    content?: string;
  }>;
}

// ============ 会话和配置类型 ============

export interface SessionState {
  sessionId: string;
  cwd: string;
  startTime: number;
  totalCostUSD: number;
  totalAPIDuration: number;
  modelUsage: Record<string, number>;
  todos: TodoItem[];
}

export interface Config {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface McpServerConfig {
  type: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// ============ 消息类型 ============

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

// ============ 工具定义 ============

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type ToolInputSchemas =
  | AgentInput
  | BashInput
  | BashOutputInput
  | TaskOutputInput
  | KillShellInput
  | FileReadInput
  | FileWriteInput
  | FileEditInput
  | GlobInput
  | GrepInput
  | WebFetchInput
  | WebSearchInput
  | TodoWriteInput
  | NotebookEditInput
  | McpInput
  | ListMcpResourcesInput
  | ReadMcpResourceInput
  | AskUserQuestionInput
  | ExitPlanModeInput;

// ============ 权限模式 ============
export type PermissionMode =
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'default'
  | 'delegate'
  | 'dontAsk'
  | 'plan';

// ============ 输出格式 ============
export type OutputFormat = 'text' | 'json' | 'stream-json';
export type InputFormat = 'text' | 'stream-json';
