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
 * 客户端发送的消息类型
 */
export type ClientMessage =
  | { type: 'chat'; payload: { content: string; images?: string[] } }
  | { type: 'cancel' }
  | { type: 'ping' }
  | { type: 'get_history' }
  | { type: 'clear_history' }
  | { type: 'set_model'; payload: { model: string } };

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
  | { type: 'status'; payload: StatusPayload };

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
