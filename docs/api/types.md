# Type System Documentation

Complete reference for the Claude Code CLI TypeScript type system.

## Table of Contents

- [Overview](#overview)
- [Tool Input Types](#tool-input-types)
- [Tool Result Types](#tool-result-types)
- [Message Types](#message-types)
- [Configuration Types](#configuration-types)
- [Error Types](#error-types)
- [Type Guards](#type-guards)
- [Utility Types](#utility-types)
- [Type Aliases](#type-aliases)

---

## Overview

The Claude Code type system is organized into modular files for better maintainability:

```
src/types/
├── index.ts         # Main entry point, re-exports all types
├── tools.ts         # Tool input schemas
├── results.ts       # Tool result/output types
├── messages.ts      # Message and content block types
├── config.ts        # Configuration types
└── errors.ts        # Error types and error handling
```

All types are exported from the main `index.ts` file:

```typescript
import type {
  // Tool inputs
  BashInput,
  FileReadInput,
  GrepInput,

  // Tool results
  BashToolResult,
  ReadToolResult,
  GrepToolResult,

  // Common types
  ToolDefinition,
  ToolResult,
  Message,
  Config,
  ClaudeError
} from './types/index.js';
```

---

## Tool Input Types

### Base Input Pattern

All tool inputs follow JSON Schema format and are validated using Zod:

```typescript
interface ToolInput {
  // Tool-specific parameters defined in JSON Schema format
  [key: string]: unknown;
}
```

### File Operation Inputs

#### FileReadInput

```typescript
interface FileReadInput {
  /** Absolute path to the file to read */
  file_path: string;

  /** Line number to start reading from (optional) */
  offset?: number;

  /** Number of lines to read (optional, default: 2000) */
  limit?: number;
}
```

**Example:**
```typescript
const input: FileReadInput = {
  file_path: '/home/user/project/src/index.ts',
  offset: 10,
  limit: 50
};
```

#### FileWriteInput

```typescript
interface FileWriteInput {
  /** Absolute path to the file to write */
  file_path: string;

  /** Content to write to the file */
  content: string;
}
```

#### FileEditInput

```typescript
interface FileEditInput {
  /** Absolute path to the file to modify */
  file_path: string;

  /** The text to replace */
  old_string: string;

  /** The replacement text */
  new_string: string;

  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}
```

#### MultiEditInput

```typescript
interface FileEdit {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

interface MultiEditInput {
  /** List of edits to perform */
  edits: FileEdit[];

  /** Description of the changes being made */
  description?: string;
}
```

### Search Inputs

#### GlobInput

```typescript
interface GlobInput {
  /** Glob pattern to match files against */
  pattern: string;

  /** Directory to search in (optional, defaults to cwd) */
  path?: string;
}
```

**Pattern Examples:**
- `**/*.ts` - All TypeScript files recursively
- `src/**/*.{js,jsx}` - All JS/JSX files in src/
- `*.json` - All JSON files in current directory

#### GrepInput

```typescript
interface GrepInput {
  /** Regular expression pattern to search for */
  pattern: string;

  /** File or directory to search (optional) */
  path?: string;

  /** Glob pattern to filter files (optional) */
  glob?: string;

  /** Output mode: "content", "files_with_matches", or "count" */
  output_mode?: 'content' | 'files_with_matches' | 'count';

  /** Lines to show before each match */
  '-B'?: number;

  /** Lines to show after each match */
  '-A'?: number;

  /** Lines to show before and after each match */
  '-C'?: number;

  /** Show line numbers (default: true) */
  '-n'?: boolean;

  /** Case insensitive search */
  '-i'?: boolean;

  /** File type filter (js, py, rust, go, etc.) */
  type?: string;

  /** Limit output to first N results */
  head_limit?: number;

  /** Skip first N results */
  offset?: number;

  /** Enable multiline mode */
  multiline?: boolean;
}
```

### Shell Operation Inputs

#### BashInput

```typescript
interface BashInput {
  /** The command to execute */
  command: string;

  /** Timeout in milliseconds (max: 600000, default: 120000) */
  timeout?: number;

  /** Clear description of what command does (5-10 words) */
  description?: string;

  /** Run command in the background */
  run_in_background?: boolean;

  /** Disable sandbox mode (dangerous) */
  dangerouslyDisableSandbox?: boolean;
}
```

#### BashOutputInput

```typescript
interface BashOutputInput {
  /** Background shell ID */
  bash_id: string;

  /** Optional regex filter for output lines */
  filter?: string;
}
```

#### KillShellInput

```typescript
interface KillShellInput {
  /** ID of the background shell to kill */
  shell_id: string;
}
```

### Web Tool Inputs

#### WebFetchInput

```typescript
interface WebFetchInput {
  /** URL to fetch content from */
  url: string;

  /** Prompt to run on fetched content */
  prompt: string;
}
```

#### WebSearchInput

```typescript
interface WebSearchInput {
  /** Search query */
  query: string;

  /** Only include results from these domains */
  allowed_domains?: string[];

  /** Never include results from these domains */
  blocked_domains?: string[];
}
```

### Agent Inputs

#### AgentInput

```typescript
interface AgentInput {
  /** Short (3-5 word) description of the task */
  description: string;

  /** Detailed task for agent to perform */
  prompt: string;

  /** Type of specialized agent to use */
  subagent_type: string;

  /** Model to use (sonnet, opus, haiku) */
  model?: 'sonnet' | 'opus' | 'haiku';

  /** Agent ID to resume from */
  resume?: string;

  /** Run agent in background */
  run_in_background?: boolean;
}
```

#### TaskOutputInput

```typescript
interface TaskOutputInput {
  /** Task ID to get output from */
  task_id: string;

  /** Wait for completion */
  block?: boolean;

  /** Max wait time in milliseconds */
  timeout?: number;
}
```

### Todo Management

#### TodoItem

```typescript
interface TodoItem {
  /** Imperative form (e.g., "Run tests") */
  content: string;

  /** Current status */
  status: 'pending' | 'in_progress' | 'completed';

  /** Present continuous form (e.g., "Running tests") */
  activeForm: string;
}
```

#### TodoWriteInput

```typescript
interface TodoWriteInput {
  /** Updated todo list */
  todos: TodoItem[];
}
```

### Notebook Operations

#### NotebookEditInput

```typescript
interface NotebookEditInput {
  /** Absolute path to .ipynb file */
  notebook_path: string;

  /** New source code for the cell */
  new_source: string;

  /** Cell ID to edit (for replace/delete) */
  cell_id?: string;

  /** Cell type (code or markdown) */
  cell_type?: 'code' | 'markdown';

  /** Edit operation (replace, insert, delete) */
  edit_mode?: 'replace' | 'insert' | 'delete';
}
```

### MCP Inputs

#### ListMcpResourcesInput

```typescript
interface ListMcpResourcesInput {
  /** Optional server name filter */
  server?: string;

  /** Refresh resource list from server */
  refresh?: boolean;
}
```

#### ReadMcpResourceInput

```typescript
interface ReadMcpResourceInput {
  /** MCP server name */
  server: string;

  /** Resource URI to read */
  uri: string;
}
```

### User Interaction

#### AskUserQuestionOption

```typescript
interface AskUserQuestionOption {
  /** Display text for this option (1-5 words) */
  label: string;

  /** Explanation of what this option means */
  description: string;
}
```

#### AskUserQuestion

```typescript
interface AskUserQuestion {
  /** Complete question to ask the user */
  question: string;

  /** Short label (max 12 chars) */
  header: string;

  /** Available choices (2-4 options) */
  options: AskUserQuestionOption[];

  /** Allow multiple selections */
  multiSelect: boolean;
}
```

#### AskUserQuestionInput

```typescript
interface AskUserQuestionInput {
  /** Questions to ask (1-4 questions) */
  questions: AskUserQuestion[];

  /** User answers (collected by permission component) */
  answers?: {
    [k: string]: string | string[];
  };
}
```

### Skill System

#### SkillInput

```typescript
interface SkillInput {
  /** Skill name to invoke */
  skill: string;

  /** Optional arguments to pass to skill */
  args?: string;
}
```

### Advanced Tool Inputs

#### TmuxInput

```typescript
interface TmuxInput {
  /** Tmux operation to perform */
  operation: 'create' | 'send' | 'capture' | 'kill' | 'list';

  /** Session name */
  session?: string;

  /** Window name or index */
  window?: string;

  /** Pane index */
  pane?: string;

  /** Command or text to send */
  command?: string;
}
```

### Union Type

```typescript
type ToolInputSchemas =
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
  | SkillInput
  | ExitPlanModeInput
  | LSPInput
  | MultiEditInput
  | SandboxInput
  | TmuxInput;
```

---

## Tool Result Types

### Base Result Types

#### ToolResult

```typescript
interface ToolResult {
  /** Whether the tool execution was successful */
  success: boolean;

  /** Output message or data from the tool */
  output?: string;

  /** Error message if the tool execution failed */
  error?: string;
}
```

#### ToolSuccess

```typescript
interface ToolSuccess extends ToolResult {
  success: true;
  output: string;
  error?: never;
}
```

#### ToolError

```typescript
interface ToolError extends ToolResult {
  success: false;
  output?: never;
  error: string;
}
```

### File Operation Results

#### ReadToolResult

```typescript
interface ReadToolResult extends ToolResult {
  /** File content (for text files) */
  content?: string;

  /** Total number of lines in the file */
  lineCount?: number;

  /** File size in bytes */
  fileSize?: number;

  /** File type/extension */
  fileType?: string;

  /** Whether file was truncated */
  truncated?: boolean;

  /** Line offset where reading started */
  offset?: number;

  /** Number of lines read */
  limit?: number;
}
```

#### WriteToolResult

```typescript
interface WriteToolResult extends ToolResult {
  /** Path to the file that was written */
  filePath?: string;

  /** Number of bytes written */
  bytesWritten?: number;

  /** Whether file was created (vs overwritten) */
  created?: boolean;

  /** Previous file size (if file existed) */
  previousSize?: number;
}
```

#### EditToolResult

```typescript
interface EditToolResult extends ToolResult {
  /** Path to the file that was edited */
  filePath?: string;

  /** Number of replacements made */
  replacements?: number;

  /** Lines that were modified */
  modifiedLines?: number[];

  /** Diff preview of the changes */
  diff?: string;

  /** Number of additions */
  additions?: number;

  /** Number of deletions */
  deletions?: number;

  /** Whether replace_all was used */
  replaceAll?: boolean;
}
```

#### MultiEditToolResult

```typescript
interface MultiEditToolResult extends ToolResult {
  /** Number of files modified */
  filesModified?: number;

  /** Total number of edits applied */
  totalEdits?: number;

  /** List of modified files */
  modifiedFiles?: string[];

  /** Detailed results for each edit */
  editResults?: Array<{
    filePath: string;
    success: boolean;
    replacements: number;
    error?: string;
  }>;
}
```

### Search Results

#### GlobToolResult

```typescript
interface GlobToolResult extends ToolResult {
  /** List of matching file paths */
  files?: string[];

  /** Number of files found */
  count?: number;

  /** Pattern that was searched */
  pattern?: string;

  /** Directory that was searched */
  searchPath?: string;
}
```

#### GrepToolResult

```typescript
interface GrepToolResult extends ToolResult {
  /** List of matches */
  matches?: Array<{
    file: string;
    line?: number;
    content?: string;
    count?: number;
  }>;

  /** Total number of matches */
  totalMatches?: number;

  /** Number of files with matches */
  filesWithMatches?: number;

  /** Output mode used */
  outputMode?: 'content' | 'files_with_matches' | 'count';

  /** Pattern that was searched */
  pattern?: string;
}
```

### Shell Operation Results

#### BashToolResult

```typescript
interface BashToolResult extends ToolResult {
  /** Exit code (0 = success) */
  exitCode?: number;

  /** Standard output */
  stdout?: string;

  /** Standard error output */
  stderr?: string;

  /** Background shell ID (if run_in_background) */
  bash_id?: string;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Whether command was sandboxed */
  sandboxed?: boolean;

  /** Working directory */
  cwd?: string;
}
```

#### BashOutputResult

```typescript
interface BashOutputResult extends BashToolResult {
  /** Whether task is still running */
  running?: boolean;

  /** Status of background shell */
  status?: 'running' | 'completed' | 'failed';

  /** Timestamp when shell started */
  startTime?: number;

  /** Total output size in bytes */
  outputSize?: number;
}
```

### Web Results

#### WebFetchToolResult

```typescript
interface WebFetchToolResult extends ToolResult {
  /** URL that was fetched */
  url?: string;

  /** Analyzed content from AI model */
  analysis?: string;

  /** HTTP status code */
  statusCode?: number;

  /** Content type of response */
  contentType?: string;

  /** Whether URL redirected */
  redirected?: boolean;

  /** Final URL after redirects */
  finalUrl?: string;
}
```

#### WebSearchToolResult

```typescript
interface WebSearchToolResult extends ToolResult {
  /** Search query used */
  query?: string;

  /** List of search results */
  results?: Array<{
    title: string;
    url: string;
    snippet: string;
    domain?: string;
  }>;

  /** Number of results returned */
  resultCount?: number;

  /** Domains that were allowed */
  allowedDomains?: string[];

  /** Domains that were blocked */
  blockedDomains?: string[];
}
```

### Agent Results

#### AgentToolResult

```typescript
interface AgentToolResult extends ToolResult {
  /** Agent/task ID */
  agentId?: string;

  /** Task ID (alias) */
  task_id?: string;

  /** Agent type used */
  agentType?: string;

  /** Whether running in background */
  background?: boolean;

  /** Agent execution status */
  status?: 'running' | 'completed' | 'failed' | 'paused';

  /** Final result from agent */
  result?: string;

  /** Model used */
  model?: string;

  /** Execution start time */
  startTime?: number;

  /** Execution end time */
  endTime?: number;

  /** Duration in milliseconds */
  duration?: number;
}
```

#### TaskOutputToolResult

```typescript
interface TaskOutputToolResult extends ToolResult {
  /** Task ID */
  task_id: string;

  /** Current status */
  status: 'running' | 'completed' | 'failed' | 'paused';

  /** Whether task completed */
  completed?: boolean;

  /** Task result (if completed) */
  result?: string;

  /** Current progress info */
  progress?: string;

  /** Execution history */
  history?: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;

  /** Intermediate results */
  intermediateResults?: any[];

  /** Current step number */
  currentStep?: number;

  /** Total number of steps */
  totalSteps?: number;
}
```

### Backward Compatibility Aliases

```typescript
/** @deprecated Use BashToolResult instead */
type BashResult = BashToolResult;

/** @deprecated Use ReadToolResult, WriteToolResult, or EditToolResult instead */
type FileResult = ReadToolResult;

/** @deprecated Use GrepToolResult instead */
type GrepResult = GrepToolResult;
```

---

## Message Types

### Message

```typescript
interface Message {
  /** Role of the message sender */
  role: 'user' | 'assistant';

  /** Array of content blocks */
  content: ContentBlock[];

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
```

### ContentBlock

```typescript
type ContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}
```

### ToolDefinition

```typescript
interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** JSON Schema for tool input */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

---

## Configuration Types

### Config

```typescript
interface Config {
  /** Anthropic API key */
  apiKey?: string;

  /** Default model to use */
  model?: 'sonnet' | 'opus' | 'haiku';

  /** Working directory */
  workingDirectory?: string;

  /** Permission mode */
  permissionMode?: PermissionMode;

  /** Output format */
  outputFormat?: OutputFormat;

  /** Input format */
  inputFormat?: InputFormat;

  /** MCP server configurations */
  mcpServers?: Record<string, McpServerConfig>;

  /** Session configuration */
  session?: {
    persist?: boolean;
    directory?: string;
    expiryDays?: number;
  };

  /** Tool allow/disallow lists */
  tools?: {
    allow?: string[];
    disallow?: string[];
  };

  /** Custom configuration */
  [key: string]: unknown;
}
```

### PermissionMode

```typescript
type PermissionMode =
  | 'default'         // Ask for permission on write operations
  | 'acceptEdits'     // Auto-approve file edits
  | 'bypassPermissions'  // Auto-approve all operations
  | 'plan';           // Plan mode (no execution)
```

### OutputFormat

```typescript
type OutputFormat =
  | 'text'            // Plain text output
  | 'json'            // JSON formatted output
  | 'markdown';       // Markdown formatted output
```

### InputFormat

```typescript
type InputFormat =
  | 'text'            // Plain text input
  | 'json';           // JSON formatted input
```

### McpServerConfig

```typescript
interface McpServerConfig {
  /** Server command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Working directory for server */
  cwd?: string;

  /** Whether server is enabled */
  enabled?: boolean;

  /** Server-specific configuration */
  config?: Record<string, unknown>;
}
```

### SessionState

```typescript
interface SessionState {
  /** Unique session ID */
  id: string;

  /** Session creation timestamp */
  createdAt: number;

  /** Last accessed timestamp */
  lastAccessedAt: number;

  /** Working directory */
  workingDirectory: string;

  /** Model being used */
  model: string;

  /** Message history */
  messages: Message[];

  /** Session metadata */
  metadata: {
    tokenCount?: number;
    cost?: number;
    turnCount?: number;
    [key: string]: unknown;
  };
}
```

---

## Error Types

See [Error Handling Documentation](./errors.md) for complete error type reference.

### ClaudeError

```typescript
interface ClaudeError extends Error {
  /** Error code */
  code: ErrorCode;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Error details */
  details?: Record<string, unknown>;

  /** Whether error is recoverable */
  recoverable: boolean;

  /** Whether operation can be retried */
  retryable: boolean;

  /** Timestamp */
  timestamp: number;

  /** Cause chain */
  cause?: Error;

  /** Context information */
  context?: Record<string, unknown>;
}
```

### ErrorOptions

```typescript
interface ErrorOptions {
  /** Error details */
  details?: Record<string, unknown>;

  /** Cause error */
  cause?: Error;

  /** Whether error is recoverable */
  recoverable?: boolean;

  /** Whether operation can be retried */
  retryable?: boolean;

  /** Error severity */
  severity?: ErrorSeverity;

  /** Context information */
  context?: Record<string, unknown>;
}
```

---

## Type Guards

### Result Type Guards

```typescript
/** Check if result is successful */
function isToolSuccess(result: ToolResult): result is ToolSuccess {
  return result.success === true && result.output !== undefined;
}

/** Check if result is an error */
function isToolError(result: ToolResult): result is ToolError {
  return result.success === false && result.error !== undefined;
}

/** Check if result is a Bash result */
function isBashResult(result: ToolResult): result is BashToolResult {
  return 'exitCode' in result || 'stdout' in result || 'stderr' in result;
}

/** Check if result is a File result */
function isFileResult(
  result: ToolResult
): result is ReadToolResult | WriteToolResult | EditToolResult {
  return 'content' in result || 'filePath' in result || 'bytesWritten' in result;
}

/** Check if result is a Grep result */
function isGrepResult(result: ToolResult): result is GrepToolResult {
  return 'matches' in result || 'totalMatches' in result;
}

/** Check if result is an Agent/Task result */
function isAgentResult(
  result: ToolResult
): result is AgentToolResult | TaskOutputToolResult {
  return 'agentId' in result || 'task_id' in result || 'agentType' in result;
}

/** Check if result is a Web result */
function isWebResult(
  result: ToolResult
): result is WebFetchToolResult | WebSearchToolResult {
  return 'url' in result || 'query' in result || 'results' in result;
}
```

### Error Type Guards

```typescript
/** Check if error is a Claude error */
function isClaudeError(error: unknown): error is ClaudeError {
  return (
    error instanceof BaseClaudeError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'severity' in error &&
      'recoverable' in error &&
      'retryable' in error)
  );
}

/** Check if error is recoverable */
function isRecoverableError(error: unknown): boolean {
  if (isClaudeError(error)) {
    return error.recoverable;
  }
  return false;
}

/** Check if error is retryable */
function isRetryableError(error: unknown): boolean {
  if (isClaudeError(error)) {
    return error.retryable;
  }
  return false;
}
```

---

## Utility Types

### Helper Functions

#### Create Tool Results

```typescript
/** Create successful tool result */
function createToolSuccess(
  output: string,
  additionalProps?: Partial<ToolResult>
): ToolSuccess {
  return {
    success: true as const,
    output,
    ...additionalProps,
  } as ToolSuccess;
}

/** Create failed tool result */
function createToolError(
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

#### Format Tool Results

```typescript
/** Format tool result for display */
function formatToolResult(result: ToolResult): string {
  if (result.success) {
    return result.output || 'Success (no output)';
  } else {
    return `Error: ${result.error || 'Unknown error'}`;
  }
}

/** Extract error message from result */
function getErrorMessage(result: ToolResult): string | undefined {
  return result.error;
}

/** Extract output from result */
function getOutput(result: ToolResult): string | undefined {
  return result.output;
}

/** Check if result has specific property */
function hasProperty<K extends string>(
  result: ToolResult,
  property: K
): result is ToolResult & Record<K, any> {
  return property in result;
}
```

---

## Type Aliases

### Convenience Aliases

```typescript
// Tool-related
export type ToolInput = ToolInputSchemas;

// Message-related
export type {
  Message,
  ContentBlock,
  ToolDefinition,
};

// Configuration-related
export type ClaudeConfig = Config;
export type Settings = Config;

// Tool-specific aliases
export type BashToolInput = BashInput;
export type ReadToolInput = FileReadInput;
export type WriteToolInput = FileWriteInput;
export type EditToolInput = FileEditInput;
export type GlobToolInput = GlobInput;
export type GrepToolInput = GrepInput;
export type WebFetchToolInput = WebFetchInput;
export type WebSearchToolInput = WebSearchInput;
export type TodoWriteToolInput = TodoWriteInput;
export type NotebookEditToolInput = NotebookEditInput;
export type AskUserQuestionToolInput = AskUserQuestionInput;
```

---

## Best Practices

### 1. Always Use Type Annotations

```typescript
// Good
const input: BashInput = {
  command: 'ls -la',
  timeout: 5000
};

// Avoid
const input = {
  command: 'ls -la',
  timeout: 5000
};
```

### 2. Use Type Guards for Runtime Checks

```typescript
const result = await toolRegistry.execute('Bash', input);

if (isToolSuccess(result)) {
  // TypeScript knows result.output is defined
  console.log(result.output);
} else if (isToolError(result)) {
  // TypeScript knows result.error is defined
  console.error(result.error);
}
```

### 3. Narrow Types When Possible

```typescript
async function executeBashCommand(input: BashInput): Promise<BashToolResult> {
  // Return type is narrowed to BashToolResult
  const result = await toolRegistry.execute('Bash', input);
  return result as BashToolResult;
}
```

### 4. Use Discriminated Unions

```typescript
type CommandResult =
  | { success: true; output: string }
  | { success: false; error: string };

function handleResult(result: CommandResult) {
  if (result.success) {
    // TypeScript knows result.output exists
    console.log(result.output);
  } else {
    // TypeScript knows result.error exists
    console.error(result.error);
  }
}
```

### 5. Leverage Type Inference

```typescript
// TypeScript infers the return type
function createReadInput(path: string, options?: Partial<FileReadInput>) {
  return {
    file_path: path,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? 2000
  } satisfies FileReadInput;
}
```

### 6. Use Utility Types

```typescript
// Make all properties optional
type PartialConfig = Partial<Config>;

// Pick specific properties
type ToolFilters = Pick<Config, 'tools'>;

// Omit specific properties
type ConfigWithoutApiKey = Omit<Config, 'apiKey'>;

// Make properties readonly
type ReadonlyToolResult = Readonly<ToolResult>;
```

---

## Advanced Type Patterns

### Generic Tool Execution

```typescript
async function executeTypedTool<TInput, TResult extends ToolResult>(
  toolName: string,
  input: TInput
): Promise<TResult> {
  const result = await toolRegistry.execute(toolName, input);
  return result as TResult;
}

// Usage
const result = await executeTypedTool<BashInput, BashToolResult>('Bash', {
  command: 'git status'
});
```

### Tool Result Mapping

```typescript
function mapToolResult<T>(
  result: ToolResult,
  onSuccess: (output: string) => T,
  onError: (error: string) => T
): T {
  if (result.success && result.output) {
    return onSuccess(result.output);
  } else if (!result.success && result.error) {
    return onError(result.error);
  }
  throw new Error('Invalid tool result');
}

// Usage
const lines = mapToolResult(
  result,
  output => output.split('\n'),
  error => [`Error: ${error}`]
);
```

### Type-Safe Tool Registry

```typescript
interface TypedToolRegistry {
  execute<K extends keyof ToolInputMap>(
    toolName: K,
    input: ToolInputMap[K]
  ): Promise<ToolResultMap[K]>;
}

interface ToolInputMap {
  Bash: BashInput;
  Read: FileReadInput;
  Write: FileWriteInput;
  Edit: FileEditInput;
  Glob: GlobInput;
  Grep: GrepInput;
  // ... other tools
}

interface ToolResultMap {
  Bash: BashToolResult;
  Read: ReadToolResult;
  Write: WriteToolResult;
  Edit: EditToolResult;
  Glob: GlobToolResult;
  Grep: GrepToolResult;
  // ... other tools
}
```

---

## Type System Versioning

The type system follows semantic versioning:

- **Major version**: Breaking changes to type definitions
- **Minor version**: New types added, backward compatible
- **Patch version**: Type fixes, documentation updates

Current version: **2.0.76**

---

## Migration Guide

### From v1.x to v2.x

1. **Result Type Changes**:
   ```typescript
   // Old (v1.x)
   type BashResult = {
     success: boolean;
     output: string;
     error: string;
   };

   // New (v2.x)
   interface BashToolResult extends ToolResult {
     success: boolean;
     output?: string;
     error?: string;
     exitCode?: number;
     stdout?: string;
     stderr?: string;
   }
   ```

2. **Input Type Consolidation**:
   ```typescript
   // Old (v1.x)
   type FileInput = {
     path: string;
     content?: string;
   };

   // New (v2.x)
   interface FileReadInput {
     file_path: string;
     offset?: number;
     limit?: number;
   }

   interface FileWriteInput {
     file_path: string;
     content: string;
   }
   ```

3. **Error Type System**:
   ```typescript
   // Old (v1.x)
   throw new Error('Something went wrong');

   // New (v2.x)
   import { createToolExecutionError } from './types/index.js';
   throw createToolExecutionError('Bash', 'Something went wrong');
   ```

---

For more information, see:
- [Tool API Documentation](./tools.md)
- [Error Handling](./errors.md)
- [Hooks System](./hooks.md)
- [Plugin Development](./plugins.md)
