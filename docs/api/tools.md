# Tools API Reference

Complete API documentation for all Claude Code CLI tools.

## Table of Contents

- [Overview](#overview)
- [Base Tool Architecture](#base-tool-architecture)
- [File Operations](#file-operations)
  - [Read](#read-tool)
  - [Write](#write-tool)
  - [Edit](#edit-tool)
  - [MultiEdit](#multiedit-tool)
- [Search Tools](#search-tools)
  - [Glob](#glob-tool)
  - [Grep](#grep-tool)
- [Shell Operations](#shell-operations)
  - [Bash](#bash-tool)
  - [BashOutput](#bashoutput-tool)
  - [KillShell](#killshell-tool)
- [Web Tools](#web-tools)
  - [WebFetch](#webfetch-tool)
  - [WebSearch](#websearch-tool)
- [Agent Tools](#agent-tools)
  - [Task (Agent)](#task-agent-tool)
  - [TaskOutput](#taskoutput-tool)
  - [ListAgents](#listagents-tool)
- [Task Management](#task-management)
  - [TodoWrite](#todowrite-tool)
- [Notebook Operations](#notebook-operations)
  - [NotebookEdit](#notebookedit-tool)
- [MCP Integration](#mcp-integration)
  - [ListMcpResources](#listmcpresources-tool)
  - [ReadMcpResource](#readmcpresource-tool)
- [User Interaction](#user-interaction)
  - [AskUserQuestion](#askuserquestion-tool)
- [Plan Mode](#plan-mode)
  - [EnterPlanMode](#enterplanmode-tool)
  - [ExitPlanMode](#exitplanmode-tool)
- [Skills System](#skills-system)
  - [Skill](#skill-tool)
  - [SlashCommand](#slashcommand-tool)
- [Advanced Tools](#advanced-tools)
  - [Tmux](#tmux-tool)

---

## Overview

Claude Code provides 25+ specialized tools for file operations, web access, code analysis, and system commands. All tools follow a consistent API pattern and extend from the `BaseTool` class.

### Common Response Format

All tools return a `ToolResult` object with this structure:

```typescript
interface ToolResult {
  success: boolean;       // Whether the operation succeeded
  output?: string;        // Output message or data
  error?: string;         // Error message if failed
  // ... additional tool-specific fields
}
```

### Tool Registry

Tools are registered in the global `ToolRegistry` which provides:

```typescript
// Get a tool by name
const tool = toolRegistry.get('Bash');

// Execute a tool
const result = await toolRegistry.execute('Read', { file_path: '/path/to/file' });

// Get all tool definitions
const definitions = toolRegistry.getDefinitions();
```

---

## Base Tool Architecture

### BaseTool Class

All tools extend from this abstract base class:

```typescript
abstract class BaseTool<TInput = unknown, TOutput extends ToolResult = ToolResult> {
  abstract name: string;
  abstract description: string;

  abstract getInputSchema(): ToolDefinition['inputSchema'];
  abstract execute(input: TInput): Promise<TOutput>;

  getDefinition(): ToolDefinition;
  protected success(output: string): ToolResult;
  protected error(message: string): ToolResult;
}
```

### Creating a Custom Tool

```typescript
import { BaseTool } from './tools/base.js';
import type { ToolDefinition, ToolResult } from './types/index.js';

class MyCustomTool extends BaseTool<MyInput, MyOutput> {
  name = 'MyCustomTool';
  description = 'Description of what this tool does';

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        myParam: { type: 'string', description: 'Parameter description' }
      },
      required: ['myParam']
    };
  }

  async execute(input: MyInput): Promise<MyOutput> {
    // Tool implementation
    return this.success('Operation completed');
  }
}
```

---

## File Operations

### Read Tool

Reads files from the filesystem with support for text, images, PDFs, and Jupyter notebooks.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file to read |
| offset | number | No | Line number to start reading from (default: 0) |
| limit | number | No | Number of lines to read (default: 2000) |

#### Returns

```typescript
interface ReadToolResult extends ToolResult {
  content?: string;         // File content (for text files)
  lineCount?: number;       // Total number of lines in the file
  fileSize?: number;        // File size in bytes
  fileType?: string;        // File type/extension
  truncated?: boolean;      // Whether file was truncated
  offset?: number;          // Line offset where reading started
  limit?: number;           // Number of lines read
}
```

#### Example

```typescript
// Read entire file
const result = await toolRegistry.execute('Read', {
  file_path: '/home/user/project/src/index.ts'
});

// Read specific range
const result = await toolRegistry.execute('Read', {
  file_path: '/home/user/project/large-file.txt',
  offset: 100,
  limit: 50
});
```

#### Error Handling

- **File not found**: Returns `success: false` with error message
- **Directory path**: Returns error suggesting to use `ls` command instead
- **Binary files**: Attempts to read as image/PDF or returns appropriate error

#### Special Features

- **Image files** (.png, .jpg, .jpeg, .gif, .webp, .bmp): Returns base64-encoded content
- **PDF files** (.pdf): Returns structured PDF content (requires additional processing)
- **Jupyter notebooks** (.ipynb): Returns all cells with their content and type
- **Line truncation**: Lines longer than 2000 characters are truncated
- **Line numbers**: Output includes line numbers starting at 1

---

### Write Tool

Writes content to files, creating directories as needed.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file to write |
| content | string | Yes | Content to write to the file |

#### Returns

```typescript
interface WriteToolResult extends ToolResult {
  filePath?: string;        // Path to the file that was written
  bytesWritten?: number;    // Number of bytes written
  created?: boolean;        // Whether the file was created (vs overwritten)
  lineCount?: number;       // Number of lines written
}
```

#### Example

```typescript
const result = await toolRegistry.execute('Write', {
  file_path: '/home/user/project/src/config.json',
  content: JSON.stringify({ key: 'value' }, null, 2)
});
```

#### Error Handling

- **Permission denied**: Returns error if write permissions are insufficient
- **Disk full**: Returns error if disk space is insufficient
- **Invalid path**: Returns error if path contains invalid characters

#### Important Notes

- Creates parent directories automatically if they don't exist
- Overwrites existing files without warning
- Use `Read` tool first to check file contents before overwriting
- Prefer using `Edit` tool for modifying existing files

---

### Edit Tool

Performs exact string replacements in files with diff preview and atomic operations.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file to modify |
| old_string | string | No* | The text to replace |
| new_string | string | No* | The replacement text |
| replace_all | boolean | No | Replace all occurrences (default: false) |
| batch_edits | BatchEdit[] | No* | Array of edit operations for atomic batch editing |
| show_diff | boolean | No | Show unified diff preview (default: true) |
| require_confirmation | boolean | No | Require user confirmation before applying (default: false) |

*Either `old_string`/`new_string` OR `batch_edits` is required

```typescript
interface BatchEdit {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}
```

#### Returns

```typescript
interface EditToolResult extends ToolResult {
  filePath?: string;           // Path to the edited file
  replacements?: number;       // Number of replacements made
  modifiedLines?: number[];    // Lines that were modified
  diff?: string;               // Unified diff preview
  additions?: number;          // Number of additions
  deletions?: number;          // Number of deletions
  replaceAll?: boolean;        // Whether replace_all was used
}
```

#### Example

```typescript
// Single replacement
const result = await toolRegistry.execute('Edit', {
  file_path: '/home/user/project/src/config.ts',
  old_string: 'const PORT = 3000;',
  new_string: 'const PORT = 8080;'
});

// Replace all occurrences
const result = await toolRegistry.execute('Edit', {
  file_path: '/home/user/project/src/utils.ts',
  old_string: 'var ',
  new_string: 'let ',
  replace_all: true
});

// Batch edits (atomic)
const result = await toolRegistry.execute('Edit', {
  file_path: '/home/user/project/src/app.ts',
  batch_edits: [
    { old_string: 'import A', new_string: 'import B' },
    { old_string: 'function foo()', new_string: 'function bar()' },
    { old_string: 'oldValue', new_string: 'newValue', replace_all: true }
  ]
});
```

#### Error Handling

- **String not found**: Returns error if `old_string` is not in file
- **Non-unique match**: Returns error if `old_string` appears multiple times (use `replace_all: true`)
- **Batch edit failure**: All changes are rolled back if any edit fails
- **Write failure**: Automatically rolls back changes if file write fails

#### Important Notes

- Must use `Read` tool at least once before editing (validation check)
- Preserves exact indentation - do not modify whitespace in `old_string`
- Never include line number prefix in `old_string` or `new_string`
- Batch edits are atomic - all succeed or all fail
- Automatic backup and rollback on error
- Diff preview shows unified diff format by default

---

### MultiEdit Tool

Performs multiple file edits across different files in a single atomic operation.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| edits | FileEdit[] | Yes | List of edits to perform |
| description | string | No | Description of the changes being made |

```typescript
interface FileEdit {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}
```

#### Returns

```typescript
interface MultiEditToolResult extends ToolResult {
  filesModified?: number;           // Number of files modified
  totalEdits?: number;              // Total number of edits applied
  modifiedFiles?: string[];         // List of modified files
  editResults?: Array<{             // Detailed results for each edit
    filePath: string;
    success: boolean;
    replacements: number;
    error?: string;
  }>;
}
```

#### Example

```typescript
const result = await toolRegistry.execute('MultiEdit', {
  description: 'Rename function across codebase',
  edits: [
    {
      file_path: '/home/user/project/src/index.ts',
      old_string: 'function oldName(',
      new_string: 'function newName('
    },
    {
      file_path: '/home/user/project/src/utils.ts',
      old_string: 'oldName(',
      new_string: 'newName(',
      replace_all: true
    },
    {
      file_path: '/home/user/project/test/index.test.ts',
      old_string: 'oldName(',
      new_string: 'newName(',
      replace_all: true
    }
  ]
});
```

#### Error Handling

- **Partial failure**: If any edit fails, previously successful edits are NOT rolled back
- **File not found**: Skips edit and continues with next file
- **Edit validation**: Each edit is validated before execution

---

## Search Tools

### Glob Tool

Fast file pattern matching using glob patterns.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pattern | string | Yes | Glob pattern to match files against |
| path | string | No | Directory to search in (default: current directory) |

#### Returns

```typescript
interface GlobToolResult extends ToolResult {
  files?: string[];         // List of matching file paths
  count?: number;           // Number of files found
  pattern?: string;         // Pattern that was searched
  searchPath?: string;      // Directory that was searched
}
```

#### Example

```typescript
// Find all TypeScript files
const result = await toolRegistry.execute('Glob', {
  pattern: '**/*.ts'
});

// Find specific file types in a directory
const result = await toolRegistry.execute('Glob', {
  pattern: '*.{js,jsx,ts,tsx}',
  path: '/home/user/project/src'
});
```

#### Supported Patterns

- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/` (recursive)
- `?` - Matches single character
- `[abc]` - Matches any character in set
- `{a,b}` - Matches any alternative
- `!(pattern)` - Matches anything except pattern

---

### Grep Tool

Powerful content search built on ripgrep with full regex support.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pattern | string | Yes | Regular expression pattern to search for |
| path | string | No | File or directory to search (default: current directory) |
| glob | string | No | Glob pattern to filter files (e.g., "*.js") |
| output_mode | string | No | "content", "files_with_matches", or "count" (default: "files_with_matches") |
| -A | number | No | Lines to show after each match |
| -B | number | No | Lines to show before each match |
| -C | number | No | Lines to show before and after each match |
| -n | boolean | No | Show line numbers (default: true) |
| -i | boolean | No | Case insensitive search |
| type | string | No | File type filter (js, py, rust, go, java, etc.) |
| head_limit | number | No | Limit output to first N lines/entries (default: 0/unlimited) |
| offset | number | No | Skip first N lines/entries (default: 0) |
| multiline | boolean | No | Enable multiline mode (default: false) |

#### Returns

```typescript
interface GrepToolResult extends ToolResult {
  matches?: Array<{
    file: string;            // File path
    line?: number;           // Line number (if available)
    content?: string;        // Matching line content (if output_mode is 'content')
    count?: number;          // Match count (if output_mode is 'count')
  }>;
  totalMatches?: number;     // Total number of matches
  filesWithMatches?: number; // Number of files with matches
  outputMode?: string;       // Output mode used
  pattern?: string;          // Pattern that was searched
}
```

#### Example

```typescript
// Find all TODO comments
const result = await toolRegistry.execute('Grep', {
  pattern: 'TODO:',
  output_mode: 'content',
  '-C': 2  // Show 2 lines before and after
});

// Find function definitions in TypeScript files
const result = await toolRegistry.execute('Grep', {
  pattern: 'function\\s+\\w+',
  type: 'ts',
  output_mode: 'files_with_matches'
});

// Case-insensitive search with context
const result = await toolRegistry.execute('Grep', {
  pattern: 'error',
  '-i': true,
  '-A': 3,
  glob: '*.log'
});
```

#### Output Modes

1. **files_with_matches** (default): Returns list of file paths containing matches
2. **content**: Returns matching lines with context and line numbers
3. **count**: Returns match counts per file

---

## Shell Operations

### Bash Tool

Executes shell commands in a sandboxed environment with comprehensive safety features.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| command | string | Yes | The command to execute |
| timeout | number | No | Timeout in milliseconds (max: 600000, default: 120000) |
| description | string | No | Clear description of what command does (5-10 words) |
| run_in_background | boolean | No | Run command in background (default: false) |
| dangerouslyDisableSandbox | boolean | No | Disable sandbox mode (use with caution) |

#### Returns

```typescript
interface BashToolResult extends ToolResult {
  exitCode?: number;        // Exit code (0 = success)
  stdout?: string;          // Standard output
  stderr?: string;          // Standard error output
  bash_id?: string;         // Background shell ID (if run_in_background)
  duration?: number;        // Execution duration in milliseconds
  sandboxed?: boolean;      // Whether command was sandboxed
  cwd?: string;             // Working directory
}
```

#### Example

```typescript
// Simple command
const result = await toolRegistry.execute('Bash', {
  command: 'git status',
  description: 'Show working tree status'
});

// Command with timeout
const result = await toolRegistry.execute('Bash', {
  command: 'npm install',
  timeout: 300000,  // 5 minutes
  description: 'Install package dependencies'
});

// Background execution
const result = await toolRegistry.execute('Bash', {
  command: 'npm run build',
  run_in_background: true,
  description: 'Build the project'
});
// Returns: { success: true, bash_id: 'bash_1234567890_xyz', ... }
```

#### Security Features

1. **Dangerous Command Detection**: Blocks commands like:
   - `rm -rf /`
   - `mkfs`
   - `dd if=/dev/zero`
   - Fork bombs: `:(){ :|:& };:`
   - `chmod -R 777 /`

2. **Warning Patterns**: Warns about potentially dangerous patterns:
   - `rm -rf`
   - `sudo rm`
   - `chmod 777`
   - `eval`
   - `curl ... | bash`
   - `wget ... | sh`

3. **Sandboxing**: Uses bubblewrap for isolation (Linux only)
   - Restricted filesystem access
   - Limited network access
   - Resource limits

4. **Audit Logging**: Logs all command executions with:
   - Timestamp
   - Command
   - Working directory
   - Success/failure status
   - Exit code
   - Duration
   - Output size

#### Output Limits

- Maximum output length: 30,000 characters (configurable via `BASH_MAX_OUTPUT_LENGTH`)
- Output exceeding limit is truncated with `[output truncated]` message
- Background shells have 10MB output limit per shell

#### Background Execution

- Maximum 10 concurrent background shells (configurable via `BASH_MAX_BACKGROUND_SHELLS`)
- Maximum runtime per background shell: 1 hour (configurable via `BASH_BACKGROUND_MAX_RUNTIME`)
- Use `BashOutput` tool to retrieve output
- Use `KillShell` tool to terminate

#### Error Handling

- **Timeout**: Command exceeds timeout limit
- **Permission denied**: Insufficient permissions
- **Command not found**: Invalid command or path
- **Exit code non-zero**: Command failed

---

### BashOutput Tool

Retrieves output from background bash shells.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| bash_id | string | Yes | ID of the background shell |
| filter | string | No | Regex pattern to filter output lines |

#### Returns

```typescript
interface BashOutputResult extends BashToolResult {
  running?: boolean;         // Whether task is still running
  status?: string;           // 'running', 'completed', or 'failed'
  startTime?: number;        // Timestamp when shell started
  outputSize?: number;       // Total output size in bytes
}
```

#### Example

```typescript
const result = await toolRegistry.execute('BashOutput', {
  bash_id: 'bash_1234567890_xyz'
});

// With filter
const result = await toolRegistry.execute('BashOutput', {
  bash_id: 'bash_1234567890_xyz',
  filter: 'error|warning'  // Only show lines with error or warning
});
```

#### Important Notes

- Returns only **new** output since last check
- Output is cleared after retrieval
- Returns `(no new output)` if nothing new available

---

### KillShell Tool

Terminates a running background shell.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| shell_id | string | Yes | ID of the background shell to kill |

#### Returns

```typescript
interface KillShellResult extends ToolResult {
  shell_id?: string;         // ID of the killed shell
  signal?: string;           // Signal used to terminate
}
```

#### Example

```typescript
const result = await toolRegistry.execute('KillShell', {
  shell_id: 'bash_1234567890_xyz'
});
```

#### Termination Process

1. Sends `SIGTERM` signal
2. Waits 1 second
3. Sends `SIGKILL` if still running
4. Removes shell from background registry

---

## Web Tools

### WebFetch Tool

Fetches web content and processes it with an AI prompt.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL to fetch content from |
| prompt | string | Yes | Prompt to run on fetched content |

#### Returns

```typescript
interface WebFetchToolResult extends ToolResult {
  url?: string;              // URL that was fetched
  analysis?: string;         // Analyzed content from AI model
  statusCode?: number;       // HTTP status code
  contentType?: string;      // Content type of response
  redirected?: boolean;      // Whether URL redirected
  finalUrl?: string;         // Final URL after redirects
}
```

#### Example

```typescript
const result = await toolRegistry.execute('WebFetch', {
  url: 'https://docs.example.com/api',
  prompt: 'Summarize the main API endpoints and their purposes'
});
```

#### Features

- HTML to Markdown conversion
- AI-powered content analysis
- Redirect handling
- 15-minute self-cleaning cache
- HTTP → HTTPS auto-upgrade

#### Error Handling

- **Network timeout**: Request exceeds timeout limit
- **HTTP errors**: Non-200 status codes
- **Redirect to different host**: Returns redirect URL for manual approval
- **Content too large**: May summarize or truncate

---

### WebSearch Tool

Performs web searches with domain filtering (US only).

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| allowed_domains | string[] | No | Only include results from these domains |
| blocked_domains | string[] | No | Never include results from these domains |

#### Returns

```typescript
interface WebSearchToolResult extends ToolResult {
  query?: string;            // Search query used
  results?: Array<{
    title: string;           // Page title
    url: string;             // Result URL
    snippet: string;         // Description/snippet
    domain?: string;         // Domain name
  }>;
  resultCount?: number;      // Number of results returned
  allowedDomains?: string[]; // Domains that were allowed
  blockedDomains?: string[]; // Domains that were blocked
}
```

#### Example

```typescript
// Basic search
const result = await toolRegistry.execute('WebSearch', {
  query: 'TypeScript best practices 2025'
});

// Search with domain filtering
const result = await toolRegistry.execute('WebSearch', {
  query: 'React hooks tutorial',
  allowed_domains: ['reactjs.org', 'github.com'],
  blocked_domains: ['pinterest.com']
});
```

#### Important Notes

- **US only**: Web search is only available in the United States
- **Date in queries**: Use current year (2025) when searching for recent content
- **Sources required**: MUST include a "Sources:" section in response with all result URLs

---

## Agent Tools

### Task (Agent) Tool

Spawns specialized sub-agents to perform tasks in parallel or with different capabilities.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| description | string | Yes | Short (3-5 word) task description |
| prompt | string | Yes | Detailed task for agent to perform |
| subagent_type | string | Yes | Type of specialized agent |
| model | string | No | Model to use (sonnet, opus, haiku) |
| resume | string | No | Agent ID to resume from |
| run_in_background | boolean | No | Run agent in background |

#### Returns

```typescript
interface AgentToolResult extends ToolResult {
  agentId?: string;          // Agent/task ID
  task_id?: string;          // Task ID (alias)
  agentType?: string;        // Agent type used
  background?: boolean;      // Whether running in background
  status?: string;           // 'running', 'completed', 'failed', 'paused'
  result?: string;           // Final result from agent
  model?: string;            // Model used
  startTime?: number;        // Execution start time
  endTime?: number;          // Execution end time
  duration?: number;         // Duration in milliseconds
}
```

#### Example

```typescript
// Code search agent
const result = await toolRegistry.execute('Task', {
  description: 'Search for bugs',
  prompt: 'Find all TODO comments and potential bugs in the src/ directory',
  subagent_type: 'code-search',
  model: 'haiku'  // Fast, cost-effective for simple tasks
});

// Background agent
const result = await toolRegistry.execute('Task', {
  description: 'Generate tests',
  prompt: 'Create comprehensive unit tests for all components',
  subagent_type: 'test-generator',
  model: 'sonnet',
  run_in_background: true
});
```

#### Agent Types

Common specialized agent types:
- `code-search` - Code analysis and search
- `file-analyzer` - File and codebase analysis
- `test-generator` - Test generation
- `refactor` - Code refactoring
- `documentation` - Documentation generation

#### Model Selection

- **haiku**: Fast, cost-effective for simple tasks
- **sonnet**: Balanced performance and capability (default)
- **opus**: Most capable for complex tasks

---

### TaskOutput Tool

Retrieves output from background agents.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| task_id | string | Yes | Task ID to get output from |
| block | boolean | No | Wait for completion (default: false) |
| timeout | number | No | Max wait time in milliseconds |

#### Returns

```typescript
interface TaskOutputToolResult extends ToolResult {
  task_id: string;           // Task ID
  status: string;            // Current status
  completed?: boolean;       // Whether task completed
  result?: string;           // Task result (if completed)
  progress?: string;         // Current progress info
  history?: Array<{          // Execution history
    timestamp: string;
    type: string;
    message: string;
  }>;
  currentStep?: number;      // Current step number
  totalSteps?: number;       // Total number of steps
}
```

#### Example

```typescript
// Check task status
const result = await toolRegistry.execute('TaskOutput', {
  task_id: 'agent_1234567890_xyz'
});

// Wait for completion
const result = await toolRegistry.execute('TaskOutput', {
  task_id: 'agent_1234567890_xyz',
  block: true,
  timeout: 60000  // Wait up to 1 minute
});
```

---

### ListAgents Tool

Lists all agents and their status.

#### Returns

```typescript
interface ListAgentsToolResult extends ToolResult {
  agents?: Array<{
    id: string;
    agentType: string;
    description: string;
    status: string;
    startTime: string;
    endTime?: string;
  }>;
  count?: number;            // Number of agents
  statusFilter?: string;     // Filter applied
}
```

#### Example

```typescript
const result = await toolRegistry.execute('ListAgents', {});
```

---

## Task Management

### TodoWrite Tool

Manages a structured task list for tracking progress.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| todos | TodoItem[] | Yes | Updated todo list |

```typescript
interface TodoItem {
  content: string;           // Imperative form (e.g., "Run tests")
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;        // Present continuous (e.g., "Running tests")
}
```

#### Returns

```typescript
interface TodoWriteToolResult extends ToolResult {
  todos?: TodoItem[];        // Updated todo list
  totalTodos?: number;       // Total number of todos
  pendingCount?: number;     // Number of pending todos
  inProgressCount?: number;  // Number of in-progress todos
  completedCount?: number;   // Number of completed todos
}
```

#### Example

```typescript
const result = await toolRegistry.execute('TodoWrite', {
  todos: [
    {
      content: 'Read configuration file',
      status: 'completed',
      activeForm: 'Reading configuration file'
    },
    {
      content: 'Parse JSON data',
      status: 'in_progress',
      activeForm: 'Parsing JSON data'
    },
    {
      content: 'Validate schema',
      status: 'pending',
      activeForm: 'Validating schema'
    }
  ]
});
```

#### Best Practices

- Exactly ONE task should be `in_progress` at a time
- Mark tasks `completed` immediately after finishing
- Update status in real-time as you work
- Use clear, actionable task descriptions
- Both `content` and `activeForm` are required for each todo

---

## Notebook Operations

### NotebookEdit Tool

Edits Jupyter notebook cells with support for insert, replace, and delete operations.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| notebook_path | string | Yes | Absolute path to .ipynb file |
| new_source | string | Yes | New source code for the cell |
| cell_id | string | No | Cell ID to edit (required for replace/delete) |
| cell_type | 'code' \| 'markdown' | No | Cell type (required for insert) |
| edit_mode | 'replace' \| 'insert' \| 'delete' | No | Edit operation (default: 'replace') |

#### Returns

```typescript
interface NotebookEditToolResult extends ToolResult {
  notebookPath?: string;     // Path to notebook
  cellId?: string;           // Cell ID that was edited
  cellType?: string;         // Cell type
  editMode?: string;         // Edit mode used
  cellIndex?: number;        // Index of edited cell
  totalCells?: number;       // Total cells in notebook
}
```

#### Example

```typescript
// Replace cell content
const result = await toolRegistry.execute('NotebookEdit', {
  notebook_path: '/home/user/project/analysis.ipynb',
  cell_id: 'cell-abc123',
  new_source: 'import pandas as pd\ndf = pd.read_csv("data.csv")',
  cell_type: 'code'
});

// Insert new cell
const result = await toolRegistry.execute('NotebookEdit', {
  notebook_path: '/home/user/project/analysis.ipynb',
  new_source: '# Data Analysis\nThis section analyzes...',
  cell_type: 'markdown',
  edit_mode: 'insert'
});

// Delete cell
const result = await toolRegistry.execute('NotebookEdit', {
  notebook_path: '/home/user/project/analysis.ipynb',
  cell_id: 'cell-xyz789',
  edit_mode: 'delete',
  new_source: ''  // Required but ignored for delete
});
```

---

## MCP Integration

### ListMcpResources Tool

Lists available resources from MCP servers.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| server | string | No | Filter by server name |
| refresh | boolean | No | Refresh resource list from server |

#### Returns

```typescript
interface ListMcpResourcesToolResult extends ToolResult {
  resources?: Array<{
    uri: string;             // Resource URI
    name: string;            // Resource name
    description?: string;    // Resource description
    mimeType?: string;       // MIME type
    server: string;          // Server providing resource
  }>;
  count?: number;            // Number of resources
  server?: string;           // Server filter applied
}
```

#### Example

```typescript
// List all resources
const result = await toolRegistry.execute('ListMcpResources', {});

// List resources from specific server
const result = await toolRegistry.execute('ListMcpResources', {
  server: 'github',
  refresh: true
});
```

---

### ReadMcpResource Tool

Reads content from an MCP resource.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| server | string | Yes | MCP server name |
| uri | string | Yes | Resource URI to read |

#### Returns

```typescript
interface ReadMcpResourceToolResult extends ToolResult {
  uri?: string;              // Resource URI
  server?: string;           // Server name
  content?: string;          // Resource content
  mimeType?: string;         // Content MIME type
  metadata?: Record<string, any>; // Resource metadata
}
```

#### Example

```typescript
const result = await toolRegistry.execute('ReadMcpResource', {
  server: 'github',
  uri: 'git://repo/commit/abc123'
});
```

---

## User Interaction

### AskUserQuestion Tool

Prompts the user with multiple choice questions.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| questions | AskUserQuestion[] | Yes | Questions to ask (1-4 questions) |

```typescript
interface AskUserQuestion {
  question: string;          // Complete question text
  header: string;            // Short label (max 12 chars)
  options: Array<{
    label: string;           // Option display text (1-5 words)
    description: string;     // Explanation of option
  }>;
  multiSelect: boolean;      // Allow multiple selections
}
```

#### Returns

```typescript
interface AskUserQuestionToolResult extends ToolResult {
  answers?: Record<string, string | string[]>; // User's answers
  questions?: Array<{
    question: string;
    header: string;
    answer: string | string[];
  }>;
  questionCount?: number;    // Number of questions asked
}
```

#### Example

```typescript
const result = await toolRegistry.execute('AskUserQuestion', {
  questions: [
    {
      question: 'Which web framework should we use?',
      header: 'Framework',
      multiSelect: false,
      options: [
        {
          label: 'Express.js',
          description: 'Minimalist web framework for Node.js with middleware support'
        },
        {
          label: 'Fastify',
          description: 'Fast and low overhead web framework with schema validation'
        },
        {
          label: 'Koa',
          description: 'Next generation framework by Express team, async/await based'
        }
      ]
    },
    {
      question: 'Which features do you want to enable?',
      header: 'Features',
      multiSelect: true,
      options: [
        { label: 'Authentication', description: 'JWT-based authentication' },
        { label: 'Logging', description: 'Structured logging with Winston' },
        { label: 'Caching', description: 'Redis-based caching layer' }
      ]
    }
  ]
});
```

#### Guidelines

- 1-4 questions per call
- 2-4 options per question
- No "Other" option needed (provided automatically)
- Clear, specific question phrasing
- Concise option labels
- Detailed option descriptions

---

## Plan Mode

### EnterPlanMode Tool

Activates plan mode for planning workflows.

#### Returns

```typescript
interface EnterPlanModeToolResult extends ToolResult {
  planModeActive?: boolean;  // Whether plan mode activated
  instructions?: string;     // Plan mode instructions
}
```

---

### ExitPlanMode Tool

Deactivates plan mode and returns to normal execution.

#### Returns

```typescript
interface ExitPlanModeToolResult extends ToolResult {
  planModeActive?: boolean;  // Whether plan mode deactivated
  summary?: string;          // Summary of actions in plan mode
}
```

---

## Skills System

### Skill Tool

Invokes custom skills defined in `.claude/commands/` or `.claude/skills/`.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| skill | string | Yes | Skill name to invoke |
| args | string | No | Arguments to pass to skill |

#### Returns

```typescript
interface SkillToolResult extends ToolResult {
  skillName?: string;        // Skill name executed
  skillType?: 'local' | 'user'; // Skill type
  args?: string;             // Arguments passed
  skillOutput?: string;      // Skill execution output
  exitCode?: number;         // Exit code
}
```

#### Example

```typescript
// Invoke commit skill
const result = await toolRegistry.execute('Skill', {
  skill: 'commit',
  args: '-m "Fix authentication bug"'
});

// Invoke review-pr skill
const result = await toolRegistry.execute('Skill', {
  skill: 'review-pr',
  args: '123'
});
```

---

### SlashCommand Tool

Executes slash commands.

#### Parameters

Similar to Skill tool - both invoke the same underlying system.

---

## Advanced Tools

### Tmux Tool

Manages tmux terminal multiplexer sessions (Linux/macOS only).

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| operation | string | Yes | 'create', 'send', 'capture', 'kill', or 'list' |
| session | string | No | Session name |
| window | string | No | Window name or index |
| pane | string | No | Pane index |
| command | string | No | Command or text to send |

#### Returns

```typescript
interface TmuxToolResult extends ToolResult {
  command?: string;          // Tmux command executed
  sessionName?: string;      // Session name
  windowName?: string;       // Window name
  paneId?: string;           // Pane ID
  tmuxOutput?: string;       // Command output
}
```

#### Example

```typescript
// Create new session
const result = await toolRegistry.execute('Tmux', {
  operation: 'create',
  session: 'dev'
});

// Send command to session
const result = await toolRegistry.execute('Tmux', {
  operation: 'send',
  session: 'dev',
  command: 'npm run dev'
});

// Capture pane output
const result = await toolRegistry.execute('Tmux', {
  operation: 'capture',
  session: 'dev',
  pane: '0'
});
```

#### Platform Support

- **Linux/macOS**: Full support
- **Windows**: Not available (use Windows Terminal or WSL)

---

## Tool Execution Best Practices

### 1. Error Handling

Always check the `success` field before processing results:

```typescript
const result = await toolRegistry.execute('Read', { file_path: '/path/to/file' });
if (!result.success) {
  console.error('Tool execution failed:', result.error);
  // Handle error appropriately
  return;
}
// Process successful result
console.log(result.output);
```

### 2. Hooks Integration

Tools support pre and post execution hooks:

```typescript
import { runPreToolUseHooks, runPostToolUseHooks } from './hooks/index.js';

// Before tool execution
const preHookResult = await runPreToolUseHooks('Bash', input);
if (!preHookResult.allowed) {
  return { success: false, error: preHookResult.message };
}

// Execute tool
const result = await tool.execute(input);

// After tool execution
await runPostToolUseHooks('Bash', input, result.output);
```

### 3. Type Safety

Use TypeScript types for tool inputs and outputs:

```typescript
import type { FileReadInput, ReadToolResult } from './types/index.js';

const input: FileReadInput = {
  file_path: '/home/user/project/src/index.ts',
  offset: 0,
  limit: 100
};

const result = await toolRegistry.execute('Read', input) as ReadToolResult;
```

### 4. Tool Filtering

Control which tools are available:

```typescript
// Allow only specific tools
const allowedTools = ['Read', 'Write', 'Grep'];
const filteredDefinitions = toolRegistry.getDefinitions()
  .filter(def => allowedTools.includes(def.name));

// Disallow dangerous tools
const disallowedTools = ['Bash', 'Write'];
const safeDefinitions = toolRegistry.getDefinitions()
  .filter(def => !disallowedTools.includes(def.name));
```

### 5. Timeout Management

Set appropriate timeouts for long-running operations:

```typescript
// Short timeout for quick operations
const result = await toolRegistry.execute('Bash', {
  command: 'ls',
  timeout: 5000  // 5 seconds
});

// Long timeout for build operations
const result = await toolRegistry.execute('Bash', {
  command: 'npm run build',
  timeout: 300000  // 5 minutes
});
```

### 6. Background Tasks

Use background execution for long-running tasks:

```typescript
// Start background task
const startResult = await toolRegistry.execute('Bash', {
  command: 'npm run test',
  run_in_background: true
});

const taskId = startResult.bash_id;

// Check progress periodically
const checkProgress = async () => {
  const result = await toolRegistry.execute('BashOutput', {
    bash_id: taskId
  });

  if (result.status === 'completed') {
    console.log('Task completed:', result.output);
  } else if (result.status === 'running') {
    setTimeout(checkProgress, 1000);  // Check again in 1 second
  }
};

checkProgress();
```

---

## Tool Development Guide

### Creating a New Tool

1. **Define Input/Output Types**:

```typescript
// types/tools.ts
export interface MyToolInput {
  param1: string;
  param2?: number;
}

// types/results.ts
export interface MyToolResult extends ToolResult {
  customField?: string;
}
```

2. **Implement Tool Class**:

```typescript
// tools/mytool.ts
import { BaseTool } from './base.js';
import type { ToolDefinition } from '../types/index.js';
import type { MyToolInput, MyToolResult } from '../types/index.js';

export class MyTool extends BaseTool<MyToolInput, MyToolResult> {
  name = 'MyTool';
  description = 'Description of what this tool does';

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'Description of param1'
        },
        param2: {
          type: 'number',
          description: 'Optional parameter'
        }
      },
      required: ['param1']
    };
  }

  async execute(input: MyToolInput): Promise<MyToolResult> {
    try {
      // Tool implementation
      const result = await this.performOperation(input);

      return {
        success: true,
        output: 'Operation completed successfully',
        customField: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async performOperation(input: MyToolInput): Promise<string> {
    // Implementation details
    return 'result';
  }
}
```

3. **Register Tool**:

```typescript
// tools/index.ts
import { MyTool } from './mytool.js';

export function registerAllTools(): void {
  // ... existing tools
  toolRegistry.register(new MyTool());
}
```

4. **Export Types**:

```typescript
// types/index.ts
export type { MyToolInput, MyToolResult } from './tools.js';
```

### Testing Your Tool

```typescript
import { toolRegistry } from './tools/index.js';

// Test successful execution
const successResult = await toolRegistry.execute('MyTool', {
  param1: 'test',
  param2: 42
});

console.assert(successResult.success === true);
console.assert(successResult.customField !== undefined);

// Test error handling
const errorResult = await toolRegistry.execute('MyTool', {
  param1: ''  // Invalid input
});

console.assert(errorResult.success === false);
console.assert(errorResult.error !== undefined);
```

---

## API Reference Summary

| Tool | Primary Use | Background Support |
|------|-------------|-------------------|
| **Read** | Read files | No |
| **Write** | Write files | No |
| **Edit** | Modify files | No |
| **MultiEdit** | Batch file edits | No |
| **Glob** | Find files by pattern | No |
| **Grep** | Search file contents | No |
| **Bash** | Execute commands | Yes |
| **BashOutput** | Get background shell output | N/A |
| **KillShell** | Terminate background shell | N/A |
| **WebFetch** | Fetch and analyze web pages | No |
| **WebSearch** | Search the web | No |
| **Task** | Run sub-agents | Yes |
| **TaskOutput** | Get agent output | N/A |
| **ListAgents** | List all agents | N/A |
| **TodoWrite** | Manage task list | No |
| **NotebookEdit** | Edit Jupyter notebooks | No |
| **ListMcpResources** | List MCP resources | No |
| **ReadMcpResource** | Read MCP resource | No |
| **AskUserQuestion** | Interactive questions | No |
| **EnterPlanMode** | Enter planning mode | No |
| **ExitPlanMode** | Exit planning mode | No |
| **Skill** | Execute custom skills | No |
| **Tmux** | Manage tmux sessions | No |

---

## Common Patterns

### Sequential File Operations

```typescript
// 1. Read file
const readResult = await toolRegistry.execute('Read', {
  file_path: '/home/user/config.json'
});

if (!readResult.success) {
  throw new Error(readResult.error);
}

// 2. Modify content
const config = JSON.parse(readResult.content);
config.newSetting = 'value';

// 3. Write back
const writeResult = await toolRegistry.execute('Write', {
  file_path: '/home/user/config.json',
  content: JSON.stringify(config, null, 2)
});
```

### Code Search and Replace

```typescript
// 1. Find files
const globResult = await toolRegistry.execute('Glob', {
  pattern: '**/*.ts'
});

// 2. Search for pattern
const grepResult = await toolRegistry.execute('Grep', {
  pattern: 'oldFunction',
  type: 'ts',
  output_mode: 'files_with_matches'
});

// 3. Batch edit
const editResult = await toolRegistry.execute('MultiEdit', {
  description: 'Rename oldFunction to newFunction',
  edits: grepResult.matches.map(match => ({
    file_path: match.file,
    old_string: 'oldFunction',
    new_string: 'newFunction',
    replace_all: true
  }))
});
```

### Build and Test Workflow

```typescript
// 1. Run build in background
const buildResult = await toolRegistry.execute('Bash', {
  command: 'npm run build',
  run_in_background: true
});

const buildId = buildResult.bash_id;

// 2. Monitor build
const checkBuild = async () => {
  const output = await toolRegistry.execute('BashOutput', {
    bash_id: buildId
  });

  if (output.status === 'completed') {
    // 3. Run tests
    return await toolRegistry.execute('Bash', {
      command: 'npm test'
    });
  } else if (output.status === 'running') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return checkBuild();
  } else {
    throw new Error('Build failed');
  }
};

const testResult = await checkBuild();
```

---

For more information, see:
- [Type System Documentation](./types.md)
- [Error Handling](./errors.md)
- [Hooks System](./hooks.md)
- [Plugin Development](./plugins.md)
