/**
 * WebUI 共享类型定义
 * 前后端通用的类型
 */

// ============ WebSocket 消息类型 ============

/**
 * WebSocket 消息基础接口
 */
export interface WSMessage {
  type: string;
  payload?: unknown;
}

/**
 * 附件类型
 */
export interface Attachment {
  name: string;
  type: 'image' | 'text';
  mimeType: string;
  data: string; // base64 for images, text content for text files
}

/**
 * 客户端发送的消息类型
 */
export type ClientMessage =
  | { type: 'chat'; payload: { content: string; images?: string[]; attachments?: Attachment[] } }
  | { type: 'cancel' }
  | { type: 'ping' }
  | { type: 'get_history' }
  | { type: 'clear_history' }
  | { type: 'set_model'; payload: { model: string } }
  | { type: 'slash_command'; payload: { command: string } }
  | { type: 'permission_response'; payload: PermissionResponsePayload }
  | { type: 'permission_config'; payload: PermissionConfigPayload }
  | { type: 'user_answer'; payload: UserAnswerPayload }
  | { type: 'session_list'; payload?: SessionListRequestPayload }
  | { type: 'session_create'; payload: SessionCreatePayload }
  | { type: 'session_switch'; payload: { sessionId: string } }
  | { type: 'session_delete'; payload: { sessionId: string } }
  | { type: 'session_rename'; payload: { sessionId: string; name: string } }
  | { type: 'session_export'; payload: { sessionId: string; format?: 'json' | 'md' } }
  | { type: 'session_resume'; payload: { sessionId: string } }
  | { type: 'tool_filter_update'; payload: ToolFilterUpdatePayload }
  | { type: 'tool_list_get' }
  | { type: 'system_prompt_update'; payload: SystemPromptUpdatePayload }
  | { type: 'system_prompt_get' }
  | { type: 'task_list'; payload?: TaskListRequestPayload }
  | { type: 'task_cancel'; payload: { taskId: string } }
  | { type: 'task_output'; payload: { taskId: string } };

/**
 * 服务端发送的消息类型
 */
export type ServerMessage =
  | { type: 'connected'; payload: { sessionId: string; model: string } }
  | { type: 'pong' }
  | { type: 'history'; payload: { messages: ChatMessage[] } }
  | { type: 'message_start'; payload: { messageId: string } }
  | { type: 'text_delta'; payload: { messageId: string; text: string } }
  | { type: 'tool_use_start'; payload: ToolUseStartPayload }
  | { type: 'tool_use_delta'; payload: { toolUseId: string; partialJson: string } }
  | { type: 'tool_result'; payload: ToolResultPayload }
  | { type: 'message_complete'; payload: MessageCompletePayload }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'thinking_start'; payload: { messageId: string } }
  | { type: 'thinking_delta'; payload: { messageId: string; text: string } }
  | { type: 'thinking_complete'; payload: { messageId: string } }
  | { type: 'permission_request'; payload: PermissionRequestPayload }
  | { type: 'status'; payload: StatusPayload }
  | { type: 'user_question'; payload: UserQuestionPayload }
  | { type: 'slash_command_result'; payload: SlashCommandResultPayload }
  | { type: 'session_list_response'; payload: SessionListResponsePayload }
  | { type: 'session_created'; payload: SessionCreatedPayload }
  | { type: 'session_switched'; payload: { sessionId: string } }
  | { type: 'session_deleted'; payload: { sessionId: string; success: boolean } }
  | { type: 'session_renamed'; payload: { sessionId: string; name: string; success: boolean } }
  | { type: 'session_exported'; payload: { sessionId: string; content: string; format: 'json' | 'md' } }
  | { type: 'tool_list_response'; payload: ToolListPayload }
  | { type: 'tool_filter_updated'; payload: { success: boolean; config: ToolFilterConfig } }
  | { type: 'system_prompt_response'; payload: SystemPromptGetPayload }
  | { type: 'task_list_response'; payload: TaskListPayload }
  | { type: 'task_status'; payload: TaskStatusPayload }
  | { type: 'task_cancelled'; payload: { taskId: string; success: boolean } }
  | { type: 'task_output_response'; payload: TaskOutputPayload };

// ============ 消息负载类型 ============

export interface ToolUseStartPayload {
  messageId: string;
  toolUseId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultPayload {
  toolUseId: string;
  success: boolean;
  output?: string;
  error?: string;
  /** 工具特定的结构化数据 */
  data?: ToolResultData;
}

export interface MessageCompletePayload {
  messageId: string;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StatusPayload {
  status: 'idle' | 'thinking' | 'tool_executing' | 'streaming';
  message?: string;
}

/**
 * 权限请求负载（服务端发送给前端）
 */
export interface PermissionRequestPayload {
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * 权限响应负载（前端发送给服务端）
 */
export interface PermissionResponsePayload {
  requestId: string;
  approved: boolean;
  remember?: boolean;
  scope?: 'once' | 'session' | 'always';
}

/**
 * 权限配置负载（前端发送给服务端）
 */
export interface PermissionConfigPayload {
  mode?: 'default' | 'bypassPermissions' | 'acceptEdits' | 'plan' | 'dontAsk';
  timeout?: number;
  bypassTools?: string[];
  alwaysAllow?: string[];
  alwaysDeny?: string[];
}

/**
 * 用户问题负载（服务端发送给前端）
 */
export interface UserQuestionPayload {
  requestId: string;
  question: string;
  header: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  timeout?: number;
}

export interface QuestionOption {
  label: string;
  description: string;
}

/**
 * 用户回答负载（前端发送给服务端）
 */
export interface UserAnswerPayload {
  requestId: string;
  answer: string;
}

/**
 * 斜杠命令结果负载（服务端发送给前端）
 */
export interface SlashCommandResultPayload {
  command: string;
  success: boolean;
  message?: string;
  data?: any;
  action?: 'clear' | 'reload' | 'none';
}

// ============ 聊天消息类型 ============

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
  content: ChatContent[];
  /** 仅助手消息有 */
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * 聊天内容块
 */
export type ChatContent =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  mediaType: string;
  data: string; // base64
}

export interface ThinkingContent {
  type: 'thinking';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'error';
  /** 关联的结果 */
  result?: ToolResultContent;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  success: boolean;
  output?: string;
  error?: string;
  /** 结构化数据用于特殊渲染 */
  data?: ToolResultData;
}

// ============ 工具结果数据类型 ============

/**
 * 工具特定的结构化结果数据
 * 用于前端特殊渲染
 */
export type ToolResultData =
  | BashResultData
  | ReadResultData
  | WriteResultData
  | EditResultData
  | GlobResultData
  | GrepResultData
  | WebFetchResultData
  | WebSearchResultData
  | TodoResultData
  | DiffResultData
  | TaskResultData;

export interface BashResultData {
  tool: 'Bash';
  command: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration?: number;
}

export interface ReadResultData {
  tool: 'Read';
  filePath: string;
  content: string;
  lineCount: number;
  language?: string;
}

export interface WriteResultData {
  tool: 'Write';
  filePath: string;
  bytesWritten: number;
}

export interface EditResultData {
  tool: 'Edit';
  filePath: string;
  diff: DiffHunk[];
  linesAdded: number;
  linesRemoved: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface GlobResultData {
  tool: 'Glob';
  pattern: string;
  files: string[];
  totalCount: number;
}

export interface GrepResultData {
  tool: 'Grep';
  pattern: string;
  matches: GrepMatch[];
  totalCount: number;
}

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface WebFetchResultData {
  tool: 'WebFetch';
  url: string;
  title?: string;
  contentPreview?: string;
}

export interface WebSearchResultData {
  tool: 'WebSearch';
  query: string;
  results: SearchResult[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface TodoResultData {
  tool: 'TodoWrite';
  todos: TodoItem[];
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

export interface DiffResultData {
  tool: 'Diff';
  hunks: DiffHunk[];
}

export interface TaskResultData {
  tool: 'Task';
  agentType: string;
  description: string;
  status: 'running' | 'completed' | 'error';
  output?: string;
}

// ============ 会话信息 ============

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  model: string;
  messageCount: number;
  totalCost: number;
  cwd: string;
}

// ============ 会话相关 Payload ============

/**
 * 会话列表请求负载
 */
export interface SessionListRequestPayload {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'messageCount' | 'cost';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 会话列表响应负载
 */
export interface SessionListResponsePayload {
  sessions: SessionSummary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * 会话摘要信息
 */
export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model: string;
  cost?: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  tags?: string[];
  workingDirectory: string;
}

/**
 * 创建会话请求负载
 */
export interface SessionCreatePayload {
  name?: string;
  model: string;
  tags?: string[];
}

/**
 * 会话创建响应负载
 */
export interface SessionCreatedPayload {
  sessionId: string;
  name?: string;
  model: string;
  createdAt: number;
}

// ============ 任务相关 Payload ============

/**
 * 任务列表请求负载
 */
export interface TaskListRequestPayload {
  statusFilter?: 'running' | 'completed' | 'failed' | 'cancelled';
  includeCompleted?: boolean;
}

/**
 * 任务列表响应负载
 */
export interface TaskListPayload {
  tasks: TaskSummary[];
}

/**
 * 任务摘要信息
 */
export interface TaskSummary {
  id: string;
  description: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

/**
 * 任务状态更新负载
 */
export interface TaskStatusPayload {
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

/**
 * 任务输出响应负载
 */
export interface TaskOutputPayload {
  taskId: string;
  output?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

// ============ 工具名称映射 ============

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  Bash: '终端命令',
  BashOutput: '终端输出',
  KillShell: '终止进程',
  Read: '读取文件',
  Write: '写入文件',
  Edit: '编辑文件',
  MultiEdit: '批量编辑',
  Glob: '文件搜索',
  Grep: '内容搜索',
  WebFetch: '网页获取',
  WebSearch: '网页搜索',
  TodoWrite: '任务管理',
  Task: '子任务',
  TaskOutput: '任务输出',
  ListAgents: '代理列表',
  NotebookEdit: '笔记本编辑',
  EnterPlanMode: '进入计划模式',
  ExitPlanMode: '退出计划模式',
  ListMcpResources: 'MCP资源列表',
  ReadMcpResource: '读取MCP资源',
  MCPSearch: 'MCP搜索',
  AskUserQuestion: '询问用户',
  Tmux: '终端复用',
  Skill: '技能',
  SlashCommand: '斜杠命令',
  LSP: '语言服务',
  Chrome: 'Chrome调试',
};

// ============ 工具图标映射 ============

export const TOOL_ICONS: Record<string, string> = {
  Bash: '💻',
  BashOutput: '📤',
  KillShell: '🛑',
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  MultiEdit: '📝',
  Glob: '🔍',
  Grep: '🔎',
  WebFetch: '🌐',
  WebSearch: '🔍',
  TodoWrite: '✅',
  Task: '🤖',
  TaskOutput: '📋',
  ListAgents: '👥',
  NotebookEdit: '📓',
  EnterPlanMode: '📋',
  ExitPlanMode: '✅',
  ListMcpResources: '📦',
  ReadMcpResource: '📄',
  MCPSearch: '🔍',
  AskUserQuestion: '❓',
  Tmux: '🖥️',
  Skill: '⚡',
  SlashCommand: '/',
  LSP: '🔤',
  Chrome: '🌐',
};

// ============ 工具过滤配置 ============

/**
 * 工具过滤配置
 */
export interface ToolFilterConfig {
  /** 允许的工具列表（白名单） */
  allowedTools?: string[];
  /** 禁止的工具列表（黑名单） */
  disallowedTools?: string[];
  /** 过滤模式 */
  mode: 'whitelist' | 'blacklist' | 'all';
}

/**
 * 工具过滤更新负载
 */
export interface ToolFilterUpdatePayload {
  config: ToolFilterConfig;
}

/**
 * 工具列表负载
 */
export interface ToolListPayload {
  tools: ToolInfo[];
  config: ToolFilterConfig;
}

/**
 * 工具信息
 */
export interface ToolInfo {
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

// ============ 系统提示配置 ============

/**
 * 系统提示配置
 */
export interface SystemPromptConfig {
  /** 自定义系统提示（完全替换默认提示） */
  customPrompt?: string;
  /** 追加到默认提示后的内容 */
  appendPrompt?: string;
  /** 是否使用默认提示 */
  useDefault: boolean;
}

/**
 * 更新系统提示请求负载
 */
export interface SystemPromptUpdatePayload {
  config: SystemPromptConfig;
}

/**
 * 获取系统提示响应负载
 */
export interface SystemPromptGetPayload {
  /** 当前完整的系统提示 */
  current: string;
  /** 当前配置 */
  config: SystemPromptConfig;
}
