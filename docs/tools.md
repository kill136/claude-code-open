# Claude Code Tools Reference

Complete guide to all tools available in Claude Code CLI v2.0.76.

## Table of Contents

- [File Operations](#file-operations)
  - [Read](#read)
  - [Write](#write)
  - [Edit](#edit)
  - [MultiEdit](#multiedit)
- [File Search](#file-search)
  - [Glob](#glob)
  - [Grep](#grep)
- [Command Execution](#command-execution)
  - [Bash](#bash)
  - [BashOutput](#bashoutput)
  - [KillShell](#killshell)
  - [Tmux](#tmux)
- [Web Operations](#web-operations)
  - [WebFetch](#webfetch)
  - [WebSearch](#websearch)
- [Agent System](#agent-system)
  - [Task](#task)
  - [TaskOutput](#taskoutput)
  - [ListAgents](#listagents)
- [Interactive Tools](#interactive-tools)
  - [TodoWrite](#todowrite)
  - [AskUserQuestion](#askuserquestion)
- [Specialized Tools](#specialized-tools)
  - [NotebookEdit](#notebookedit)
  - [Skill](#skill)
  - [SlashCommand](#slashcommand)
- [MCP Integration](#mcp-integration)
  - [ListMcpResources](#listmcpresources)
  - [ReadMcpResource](#readmcpresource)
- [Planning Mode](#planning-mode)
  - [EnterPlanMode](#enterplanmode)
  - [ExitPlanMode](#exitplanmode)

---

## File Operations

### Read

**Purpose**: Read files from the local filesystem with support for multiple file types.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| offset | number | No | Line number to start reading from (default: 0) |
| limit | number | No | Number of lines to read (default: 2000) |

**Supported File Types**:
- Text files (with line numbers)
- Images: PNG, JPG, JPEG, GIF, WebP, BMP
- PDFs (basic support)
- Jupyter notebooks (.ipynb)

**Example**:
```javascript
{
  "file_path": "/home/user/project/src/index.ts",
  "offset": 0,
  "limit": 100
}
```

**Output Format**:
```
  1	import { foo } from './bar';
  2	import { baz } from './qux';
  3
  4	export function main() {
  5	  console.log('Hello, world!');
  6	}
```

**Best Practices**:
- Always use absolute paths
- For large files, use offset and limit parameters
- Lines longer than 2000 characters are truncated
- MUST read file before editing it

**Common Issues**:
- **Path not found**: Ensure the file exists and path is absolute
- **Directory error**: Use `ls` command instead for directories
- **Large files**: Use offset/limit to read in chunks

---

### Write

**Purpose**: Write content to files, creating new files or overwriting existing ones.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| content | string | Yes | Content to write |

**Example**:
```javascript
{
  "file_path": "/home/user/project/src/newfile.ts",
  "content": "export const foo = 'bar';\n"
}
```

**Best Practices**:
- ALWAYS read existing files before writing
- Prefer Edit over Write for existing files
- Automatically creates parent directories
- NEVER proactively create documentation files

**Common Issues**:
- **Permission denied**: Check file/directory permissions
- **Overwrite warning**: This tool WILL overwrite existing files

---

### Edit

**Purpose**: Perform exact string replacements with unified diff preview.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| old_string | string | Yes* | Text to replace |
| new_string | string | Yes* | Replacement text |
| replace_all | boolean | No | Replace all occurrences (default: false) |
| batch_edits | array | No | Array of edit operations |
| show_diff | boolean | No | Show diff preview (default: true) |
| require_confirmation | boolean | No | Require user confirmation (default: false) |

*Either old_string/new_string OR batch_edits is required

**Example - Single Edit**:
```javascript
{
  "file_path": "/home/user/project/src/index.ts",
  "old_string": "const x = 1",
  "new_string": "const x = 2",
  "show_diff": true
}
```

**Example - Batch Edits**:
```javascript
{
  "file_path": "/home/user/project/src/index.ts",
  "batch_edits": [
    {
      "old_string": "function foo()",
      "new_string": "function bar()"
    },
    {
      "old_string": "const x = 1",
      "new_string": "const x = 2"
    }
  ]
}
```

**Output Example**:
```
Successfully edited /home/user/project/src/index.ts

Changes: +1 -1
────────────────────────────────────────────────────────────
--- a/index.ts
+++ b/index.ts
@@ -1,3 +1,3 @@
 import { foo } from './bar';
-const x = 1;
+const x = 2;
 export default x;
────────────────────────────────────────────────────────────
```

**Best Practices**:
- Preserve exact indentation from the file
- old_string must be unique unless using replace_all
- Use Read tool before editing
- Check diff output before confirming
- Automatic rollback on failure

**Common Issues**:
- **Not unique**: old_string appears multiple times - use replace_all or add more context
- **Not found**: old_string doesn't exist in file - verify with Read first
- **Indentation mismatch**: Preserve exact spacing as shown in Read output

---

### MultiEdit

**Purpose**: Perform multiple exact string replacements atomically with full transaction support.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| edits | array | Yes | Array of edit operations |

**Edit Operation Schema**:
```javascript
{
  "old_string": "string",  // Required
  "new_string": "string"   // Required
}
```

**Example**:
```javascript
{
  "file_path": "/home/user/project/src/index.ts",
  "edits": [
    {
      "old_string": "const x = 1",
      "new_string": "const x = 2"
    },
    {
      "old_string": "function foo()",
      "new_string": "function bar()"
    }
  ]
}
```

**Transaction Guarantees**:
- All edits succeed together or fail together (atomic)
- Automatic backup before any changes
- Automatic rollback on any failure
- Conflict detection between edits
- File restored from backup on write errors

**Output Example**:
```
✓ Transaction successful: Applied 2 edit(s) to index.ts

Edit details:
  Edit 1: Replaced 11 chars with 11 chars (+0) at position 45
  Edit 2: Replaced 14 chars with 14 chars (+0) at position 120

File statistics:
  Lines: 50 → 50 (+0)
  Characters: 1234 → 1234 (+0)
```

**Best Practices**:
- More efficient than multiple Edit calls
- Use for related changes that should succeed/fail together
- Each old_string must be unique
- Automatic conflict detection prevents overlapping edits

**Common Issues**:
- **Conflict detected**: Edits overlap - separate into multiple operations
- **Transaction rolled back**: One edit failed - check error message for which edit
- **Nested replacement**: Edit's new_string contains another edit's old_string

---

## File Search

### Glob

**Purpose**: Fast file pattern matching for finding files by name.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pattern | string | Yes | Glob pattern to match |
| path | string | No | Directory to search in (default: cwd) |

**Pattern Syntax**:
- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/`
- `?` - Matches any single character
- `[abc]` - Matches any character in set
- `{a,b}` - Matches any alternative

**Examples**:
```javascript
// Find all TypeScript files
{ "pattern": "**/*.ts" }

// Find all test files
{ "pattern": "**/*.test.{js,ts}" }

// Find files in specific directory
{
  "pattern": "*.json",
  "path": "/home/user/project/config"
}
```

**Output**: Newline-separated list of absolute file paths, sorted by modification time (newest first).

**Best Practices**:
- Use specific patterns to reduce results
- Results sorted by modification time
- Includes hidden files (dot files)
- Excludes directories

**Common Issues**:
- **Too many results**: Use more specific patterns
- **No matches**: Check pattern syntax and path

---

### Grep

**Purpose**: Powerful content search using ripgrep (rg) with regex support.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pattern | string | Yes | Regex pattern to search for |
| path | string | No | File or directory to search (default: cwd) |
| glob | string | No | Glob pattern to filter files |
| type | string | No | File type filter (js, py, rust, etc.) |
| output_mode | string | No | Output format (default: files_with_matches) |
| -i | boolean | No | Case insensitive search |
| -n | boolean | No | Show line numbers (default: true for content mode) |
| -B | number | No | Lines of context before match |
| -A | number | No | Lines of context after match |
| -C | number | No | Lines of context before and after |
| multiline | boolean | No | Enable multiline matching (default: false) |
| head_limit | number | No | Limit output lines/entries |
| offset | number | No | Skip first N lines/entries |

**Output Modes**:
- `files_with_matches` - Show only file paths (default)
- `content` - Show matching lines with context
- `count` - Show match counts per file

**Examples**:

```javascript
// Find files containing "TODO"
{
  "pattern": "TODO",
  "output_mode": "files_with_matches"
}

// Search in TypeScript files only
{
  "pattern": "function\\s+\\w+",
  "type": "ts",
  "output_mode": "content"
}

// Case-insensitive search with context
{
  "pattern": "error",
  "-i": true,
  "-C": 3,
  "output_mode": "content"
}

// Search with glob filter
{
  "pattern": "import.*react",
  "glob": "**/*.{ts,tsx}",
  "output_mode": "content"
}

// Multiline search
{
  "pattern": "interface\\s+\\{[\\s\\S]*?name",
  "multiline": true,
  "output_mode": "content"
}
```

**Pattern Syntax**:
- Uses ripgrep (not grep) - Rust regex syntax
- Literal braces need escaping: `interface\\{\\}` to find `interface{}`
- Use `\\s` for whitespace, `\\w` for word characters
- Use `.*` for any characters within a line
- Use `[\\s\\S]*?` for any characters across lines (requires multiline: true)

**Best Practices**:
- ALWAYS use Grep tool, NEVER invoke `grep` or `rg` as Bash command
- Use `type` parameter for common file types (more efficient than glob)
- Use head_limit to prevent overwhelming output
- Use context flags (-A/-B/-C) only with output_mode: "content"

**Common Issues**:
- **Regex error**: Check pattern syntax (ripgrep uses Rust regex)
- **No matches**: Try case-insensitive search with `-i`
- **Too many results**: Use head_limit or more specific patterns
- **Context requires content mode**: -A/-B/-C only work with output_mode: "content"

---

## Command Execution

### Bash

**Purpose**: Execute shell commands in a persistent session with optional sandboxing.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| command | string | Yes | Shell command to execute |
| timeout | number | No | Timeout in milliseconds (default: 120000, max: 600000) |
| description | string | No | 5-10 word description of what command does |
| run_in_background | boolean | No | Run command in background |
| dangerouslyDisableSandbox | boolean | No | Disable sandbox mode (use with caution) |

**Example**:
```javascript
{
  "command": "npm test",
  "timeout": 300000,
  "description": "Run test suite"
}
```

**Background Execution**:
```javascript
{
  "command": "npm run dev",
  "run_in_background": true,
  "description": "Start development server"
}
```

**Security Features**:
- Automatic sandbox using bubblewrap (Linux only)
- Dangerous command detection
- Command audit logging
- Output size limits (30,000 chars)
- Timeout protection

**Dangerous Command Patterns**:
- `rm -rf /` - Blocked
- `chmod -R 777 /` - Warning
- `curl ... | bash` - Warning
- Eval/exec patterns - Warning

**Best Practices**:
- ONLY use for terminal operations (git, npm, docker, etc.)
- DO NOT use for file operations - use Read/Write/Edit instead
- Quote file paths with spaces: `cd "path with spaces"`
- Use description parameter for clarity
- Sandbox is automatically enabled on Linux with bubblewrap

**Output Format**:
```
stdout output here

STDERR:
stderr output here
```

**Common Issues**:
- **Command blocked**: Security check failed - avoid dangerous patterns
- **Timeout**: Increase timeout parameter or use background mode
- **Output truncated**: Output exceeds 30,000 characters
- **Sandbox unavailable**: Install bubblewrap or use dangerouslyDisableSandbox

---

### BashOutput

**Purpose**: Retrieve output from background bash shells.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| bash_id | string | Yes | Background shell ID |
| filter | string | No | Regex to filter output lines |

**Example**:
```javascript
{
  "bash_id": "bash_1234567890_abc123def"
}
```

**With Filter**:
```javascript
{
  "bash_id": "bash_1234567890_abc123def",
  "filter": "error|warning"
}
```

**Output Example**:
```
Status: running, Duration: 5432ms

[server output here]
```

**Best Practices**:
- Always returns only NEW output since last check
- Output buffer is cleared after each read
- Use filter to show only relevant lines
- Check status field to know if shell is still running

---

### KillShell

**Purpose**: Terminate a background bash shell.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shell_id | string | Yes | Background shell ID to kill |

**Example**:
```javascript
{
  "shell_id": "bash_1234567890_abc123def"
}
```

**Process**:
1. Sends SIGTERM to shell
2. Waits 1 second
3. Sends SIGKILL if still running
4. Removes shell from background registry

**Best Practices**:
- Always kill background shells when done
- Check BashOutput before killing to see final output
- Graceful shutdown with SIGTERM before SIGKILL

---

### Tmux

**Purpose**: Manage tmux terminal sessions for running multiple commands in parallel.

**Platform Support**: Linux and macOS only (Windows users need WSL)

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Action to perform (see below) |
| session_name | string | Varies | Name of tmux session |
| command | string | No | Command to send (deprecated) |
| window | number | No | Window number (default: 0) |
| pane | number | No | Pane number |
| keys | string | No | Key sequence for send-keys |
| direction | string | No | Split direction (horizontal/vertical) |
| lines | number | No | Lines to capture |
| window_name | string | No | Name for new window |

**Actions**:

#### Session Actions
- `new` - Create new session
- `kill` - Kill session
- `list` - List all sessions
- `has-session` - Check if session exists
- `session-info` - Get detailed session info

#### Window Actions
- `new-window` - Create new window
- `select-window` - Switch to window
- `list-windows` - List windows

#### Pane Actions
- `split-pane` - Split pane horizontally or vertically
- `select-pane` - Switch to pane
- `list-panes` - List panes

#### Command Actions
- `send-keys` - Send key sequences (recommended)
- `send` - Send command (deprecated)
- `capture` - Capture output

**Examples**:

```javascript
// Create new session
{
  "action": "new",
  "session_name": "dev"
}

// Send keys to session
{
  "action": "send-keys",
  "session_name": "dev",
  "keys": "npm run dev",
  "window": 0
}

// Send Enter key
{
  "action": "send-keys",
  "session_name": "dev",
  "keys": "Enter"
}

// Capture output
{
  "action": "capture",
  "session_name": "dev",
  "window": 0,
  "lines": 50
}

// Split pane vertically
{
  "action": "split-pane",
  "session_name": "dev",
  "direction": "vertical"
}

// Create new window
{
  "action": "new-window",
  "session_name": "dev",
  "window_name": "tests"
}
```

**Special Keys**:
- `Enter` - Press Enter
- `C-c` - Ctrl+C
- `C-d` - Ctrl+D
- `Space` - Space bar
- `BSpace` - Backspace
- `Tab` - Tab key

**Best Practices**:
- Use for long-running processes (servers, watchers)
- Organize work across multiple windows and panes
- Use send-keys instead of deprecated send action
- Session names: alphanumeric, underscore, hyphen, dot only

**Common Issues**:
- **Not available on Windows**: Use WSL
- **Tmux not installed**: Install with package manager
- **Invalid session name**: Use only alphanumeric, _, -, . characters
- **Session already exists**: Use different name or kill existing session

---

## Web Operations

### WebFetch

**Purpose**: Fetch and process web content from URLs.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | URL to fetch (will upgrade HTTP to HTTPS) |
| prompt | string | Yes | Prompt to run on the fetched content |

**Example**:
```javascript
{
  "url": "https://example.com/api/docs",
  "prompt": "Summarize the API endpoints"
}
```

**Features**:
- Automatic HTTP to HTTPS upgrade
- HTML to text conversion
- JSON formatting
- Content truncation at 50,000 chars
- 30-second timeout
- Up to 5 redirects

**Output Format**:
```
URL: https://example.com/api/docs
Prompt: Summarize the API endpoints

--- Content ---
[converted content here]
```

**Best Practices**:
- Use for documentation, API responses, web pages
- Content automatically cleaned of scripts/styles
- Large content is truncated with warning

**Common Issues**:
- **Redirect**: Some sites redirect - use the new URL shown in error
- **Timeout**: Site took too long to respond
- **Content truncated**: Page exceeds 50,000 characters

---

### WebSearch

**Purpose**: Search the web for current information (requires API integration).

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search query (min 2 chars) |
| allowed_domains | array | No | Only include results from these domains |
| blocked_domains | array | No | Exclude results from these domains |

**Example**:
```javascript
{
  "query": "Claude Code CLI documentation 2025",
  "allowed_domains": ["github.com", "anthropic.com"]
}
```

**Note**: This tool requires integration with a search API (DuckDuckGo, Bing, Google). The current implementation is a placeholder.

**Best Practices**:
- Use for information beyond knowledge cutoff
- Always include "Sources:" section with URLs in response
- Filter domains to get relevant results

---

## Agent System

### Task

**Purpose**: Launch specialized sub-agents for complex, multi-step tasks.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Short 3-5 word task description |
| prompt | string | Yes | Detailed task for agent |
| subagent_type | string | Yes | Type of agent to use |
| model | string | No | Model to use (sonnet/opus/haiku) |
| resume | string | No | Agent ID to resume |
| run_in_background | boolean | No | Run agent in background |

**Agent Types**:

| Type | Description | Available Tools |
|------|-------------|-----------------|
| general-purpose | Research complex questions | All tools |
| Explore | Fast codebase exploration | Glob, Grep, Read |
| Plan | Software architecture design | All tools |
| claude-code-guide | Claude Code documentation | Glob, Grep, Read, WebFetch, WebSearch |

**Example - New Agent**:
```javascript
{
  "description": "Find auth implementation",
  "prompt": "Search the codebase for authentication and authorization implementations, identify all entry points and middleware",
  "subagent_type": "Explore",
  "model": "haiku"
}
```

**Example - Resume Agent**:
```javascript
{
  "description": "Continue analysis",
  "prompt": "Continue the previous analysis",
  "subagent_type": "Explore",
  "resume": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example - Background Execution**:
```javascript
{
  "description": "Analyze test coverage",
  "prompt": "Analyze test coverage across the entire codebase and identify gaps",
  "subagent_type": "general-purpose",
  "run_in_background": true
}
```

**Persistence**:
- Agent state saved to `~/.claude/agents/`
- Can resume from paused or failed agents
- Execution history preserved
- Intermediate results stored

**Best Practices**:
- Launch multiple agents concurrently for parallel work
- Use appropriate agent type for the task
- Choose haiku for simple tasks, opus for complex ones
- Trust agent outputs - they are thorough
- Resume failed agents to continue from last checkpoint

**Common Issues**:
- **Agent not found**: Check agent ID or list agents
- **Already completed**: Cannot resume completed agents
- **Still running**: Wait or check output with TaskOutput

---

### TaskOutput

**Purpose**: Get output and status from background agents.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| task_id | string | Yes | Agent ID |
| block | boolean | No | Wait for completion |
| timeout | number | No | Max wait time in ms (default: 5000) |
| show_history | boolean | No | Show execution history |

**Example**:
```javascript
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "block": true,
  "timeout": 10000,
  "show_history": true
}
```

**Output Example**:
```
=== Agent 550e8400-e29b-41d4-a716-446655440000 ===
Type: Explore
Status: completed
Description: Find auth implementation
Started: 2025-01-15T10:30:00.000Z
Ended: 2025-01-15T10:32:15.123Z
Duration: 135.12s
Progress: 5/5 steps
Working Directory: /home/user/project

=== Execution History ===
1. [2025-01-15T10:30:00.000Z] STARTED: Agent started with type Explore
2. [2025-01-15T10:30:05.000Z] PROGRESS: Completed step 1/5
...

=== Final Result ===
[Agent's findings here]
```

**Best Practices**:
- Use block=true to wait for completion
- Use show_history to see detailed progress
- State automatically persisted and can be resumed

---

### ListAgents

**Purpose**: List all background agents with their status.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status_filter | string | No | Filter by status (running/completed/failed/paused) |
| include_completed | boolean | No | Include completed agents (default: false) |

**Example**:
```javascript
{
  "status_filter": "running",
  "include_completed": false
}
```

**Output Example**:
```
=== Background Agents (2) ===

1. Agent ID: 550e8400-e29b-41d4-a716-446655440000
   Type: Explore
   Status: running
   Description: Find auth implementation
   Started: 2025-01-15T10:30:00.000Z
   Progress: 3/5 steps

2. Agent ID: 660e8400-e29b-41d4-a716-446655440001
   Type: general-purpose
   Status: paused
   Description: Analyze dependencies
   Started: 2025-01-15T09:00:00.000Z
   Progress: 10/15 steps
   → Can be resumed with: resume="660e8400-e29b-41d4-a716-446655440001"

Use TaskOutput tool to get detailed information about a specific agent.
Use Task tool with resume parameter to continue paused or failed agents.
```

**Best Practices**:
- Check periodically to monitor agent progress
- Resume paused or failed agents
- Completed agents excluded by default to reduce clutter

---

## Interactive Tools

### TodoWrite

**Purpose**: Create and manage a structured task list for tracking progress.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| todos | array | Yes | Array of todo items |

**Todo Item Schema**:
```javascript
{
  "content": "string",      // Required: Task description (imperative form)
  "status": "string",       // Required: pending/in_progress/completed
  "activeForm": "string"    // Required: Present continuous form
}
```

**Example**:
```javascript
{
  "todos": [
    {
      "content": "Read authentication files",
      "status": "completed",
      "activeForm": "Reading authentication files"
    },
    {
      "content": "Implement OAuth flow",
      "status": "in_progress",
      "activeForm": "Implementing OAuth flow"
    },
    {
      "content": "Add unit tests",
      "status": "pending",
      "activeForm": "Adding unit tests"
    }
  ]
}
```

**Output Example**:
```
Todos updated:
1. [✓] Read authentication files
2. [●] Implement OAuth flow
3. [○] Add unit tests
```

**Task States**:
- `pending` (○) - Not yet started
- `in_progress` (●) - Currently working (LIMIT TO ONE)
- `completed` (✓) - Finished successfully

**When to Use**:
1. Complex multi-step tasks (3+ steps)
2. Non-trivial and complex tasks
3. User explicitly requests todo list
4. User provides multiple tasks
5. After receiving new instructions

**When NOT to Use**:
1. Single, straightforward task
2. Trivial tasks
3. Less than 3 trivial steps
4. Purely conversational/informational

**Rules**:
- EXACTLY ONE task can be in_progress at a time
- Update status in real-time as you work
- Mark completed IMMEDIATELY after finishing
- ONLY mark completed when FULLY accomplished
- If blocked/failed, keep as in_progress and create new task

**Best Practices**:
- Break complex tasks into specific, actionable items
- Use clear, descriptive task names
- Always provide both content (imperative) and activeForm (continuous)
- Remove tasks no longer relevant

**Common Issues**:
- **Multiple in_progress**: Only one task can be in_progress
- **Marked complete prematurely**: Keep in_progress if tests fail or errors occur

---

### AskUserQuestion

**Purpose**: Ask the user questions with predefined options to clarify requirements.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| questions | array | Yes | Array of questions (1-4 max) |

**Question Schema**:
```javascript
{
  "question": "string",     // Required: Complete question
  "header": "string",       // Required: Short label (max 12 chars)
  "options": [              // Required: 2-4 options
    {
      "label": "string",    // Required: Display text (1-5 words)
      "description": "string" // Required: Explanation
    }
  ],
  "multiSelect": boolean    // Required: Allow multiple selections
}
```

**Example - Single Select**:
```javascript
{
  "questions": [
    {
      "question": "Which authentication method should we use?",
      "header": "Auth Method",
      "options": [
        {
          "label": "JWT",
          "description": "JSON Web Tokens for stateless authentication"
        },
        {
          "label": "Session",
          "description": "Traditional server-side sessions"
        },
        {
          "label": "OAuth 2.0",
          "description": "Third-party authentication provider"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

**Example - Multi Select**:
```javascript
{
  "questions": [
    {
      "question": "Which features should we implement first?",
      "header": "Features",
      "options": [
        {
          "label": "User registration",
          "description": "Allow new users to sign up"
        },
        {
          "label": "Password reset",
          "description": "Email-based password recovery"
        },
        {
          "label": "Two-factor auth",
          "description": "Additional security layer"
        }
      ],
      "multiSelect": true
    }
  ]
}
```

**Interactive Features**:
- Keyboard navigation (↑/↓ arrows)
- Number quick-select (1-9)
- Space to toggle (multi-select)
- Enter to confirm
- Automatic "Other" option for custom input

**Output Example**:
```
✓ User Responses:

  Auth Method: JWT
  Features: User registration, Two-factor auth
```

**When to Use**:
- Clarify ambiguous requirements
- Get user approval for approach
- Ask about implementation preferences
- Confirm understanding of task

**Best Practices**:
- Ask 1-4 questions maximum
- Provide 2-4 options per question
- Options should be clear and concise
- Automatic "Other" option always provided
- Works in both TTY and non-TTY environments

**Common Issues**:
- **Too many questions**: Maximum 4 questions allowed
- **Wrong option count**: Each question needs 2-4 options
- **Non-interactive mode**: Falls back to simple text input

---

## Specialized Tools

### NotebookEdit

**Purpose**: Edit Jupyter notebook (.ipynb) cells with format preservation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| notebook_path | string | Yes | Absolute path to .ipynb file |
| cell_id | string | No | Cell ID or index (0-based) |
| new_source | string | Yes | New cell source code/text |
| cell_type | string | No | "code" or "markdown" |
| edit_mode | string | No | "replace", "insert", or "delete" (default: replace) |

**Edit Modes**:
- `replace` - Replace existing cell (default)
- `insert` - Insert new cell after specified cell
- `delete` - Delete specified cell

**Example - Replace Cell**:
```javascript
{
  "notebook_path": "/home/user/project/analysis.ipynb",
  "cell_id": "0",
  "new_source": "import pandas as pd\nimport numpy as np\n\nprint('Hello!')",
  "cell_type": "code"
}
```

**Example - Insert Cell**:
```javascript
{
  "notebook_path": "/home/user/project/analysis.ipynb",
  "cell_id": "2",
  "new_source": "# New Analysis Section\n\nThis section performs...",
  "cell_type": "markdown",
  "edit_mode": "insert"
}
```

**Example - Delete Cell**:
```javascript
{
  "notebook_path": "/home/user/project/analysis.ipynb",
  "cell_id": "5",
  "new_source": "",
  "edit_mode": "delete"
}
```

**Features**:
- Automatically clears outputs for code cells
- Validates Jupyter notebook format
- Preserves cell metadata
- Generates unique cell IDs
- Supports negative indexing (-1 for last cell)
- Format preservation (nbformat v4.x)

**Output Example**:
```
Replaced cell 0 (changed type from markdown to code) in analysis.ipynb
```

**Best Practices**:
- Always use absolute paths
- Cell IDs can be string IDs or numeric indices
- Code cells have outputs automatically cleared
- Use insert to add new cells
- Notebook format validated before editing

**Common Issues**:
- **Not absolute path**: Must use absolute path to notebook
- **Cell not found**: Verify cell ID/index exists
- **Invalid format**: Notebook must be valid Jupyter format (v4.x)
- **cell_type required**: Must specify for insert mode

---

### Skill

**Purpose**: Execute specialized skills loaded from markdown files.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| skill | string | Yes | Skill name (no arguments) |

**Example**:
```javascript
{
  "skill": "pdf"
}
```

**Skill Locations** (priority order):
1. `.claude/skills/*.md` (project skills - highest priority)
2. `~/.claude/skills/*.md` (user skills)
3. Built-in skills (lowest priority)

**Skill File Format** (Markdown with YAML frontmatter):
```markdown
---
name: pdf
description: Analyze PDF documents
---

[Skill prompt content here...]
```

**Output Example**:
```
<command-message>The "pdf" skill is loading</command-message>

<skill name="pdf" location="project">
[Skill prompt expands here with detailed instructions...]
</skill>
```

**How Skills Work**:
1. Invoke skill using this tool
2. See loading message
3. Skill's prompt expands with instructions
4. Follow the expanded instructions

**Best Practices**:
- Only use skills listed in available skills
- Don't invoke a skill already running
- Skills expand to provide detailed instructions
- Project skills override user skills override built-in

**Common Issues**:
- **Skill not found**: Check available skills list
- **Already running**: Don't invoke same skill twice

---

### SlashCommand

**Purpose**: Execute custom slash commands from markdown files.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| command | string | Yes | Slash command with arguments |

**Example**:
```javascript
{
  "command": "/review-pr 123"
}
```

**Command Locations**:
- `.claude/commands/*.md` (project commands)
- `~/.claude/commands/*.md` (user commands)

**Command File Format**:
```markdown
<!-- Review a pull request -->
Review pull request #$1

Check the following:
- Code quality
- Test coverage
- Documentation

Provide detailed feedback.
```

**Parameter Substitution**:
- `$1`, `$2`, ... - Positional arguments
- `{{arg1}}`, `{{arg2}}` - Named arguments
- `$@` - All arguments

**Example Command File** (`review-pr.md`):
```markdown
<!-- Review pull request -->
Review pull request #$1

Analyze:
1. Code changes
2. Test coverage for changes
3. Documentation updates
4. Breaking changes

Provide summary and recommendations.
```

**Usage**:
```javascript
{
  "command": "/review-pr 456"
}
// Expands to:
// Review pull request #456
// [rest of template...]
```

**Output Example**:
```
<command-message>/review-pr is running…</command-message>

Review pull request #456

Analyze:
1. Code changes
2. Test coverage for changes
...
```

**Best Practices**:
- Only use for custom commands (not built-in CLI commands)
- Check available commands list first
- Don't invoke command already running
- Commands expand with parameter substitution

**Common Issues**:
- **Command not found**: Not in available commands list
- **Wrong arguments**: Check command's expected parameters

---

## MCP Integration

### ListMcpResources

**Purpose**: List available resources from MCP (Model Context Protocol) servers.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| server | string | No | Filter by server name |
| refresh | boolean | No | Force refresh (bypass cache) |

**Example**:
```javascript
{
  "server": "filesystem",
  "refresh": true
}
```

**Output Example**:
```
Available MCP Resources:

Server: filesystem
  - Project Files (file:///home/user/project)
    All files in the project directory
    MIME: application/octet-stream
  - Config (file:///home/user/project/config)
    Configuration files
    MIME: application/json

Server: database
  - Users Table (db://localhost/users)
    User database records
  - Products Table (db://localhost/products)
    Product catalog
```

**Features**:
- Lists resources from all or specific MCP servers
- 1-minute resource cache (configurable)
- Force refresh with refresh parameter
- Automatic connection handling

**Best Practices**:
- Use refresh=true for up-to-date resource list
- Resources cached for 1 minute by default
- Check before using ReadMcpResource

**Common Issues**:
- **Server not found**: Check MCP server configuration
- **Connection failed**: Ensure MCP server is running
- **No resources**: Server may not support resources capability

---

### ReadMcpResource

**Purpose**: Read a resource from an MCP server.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| server | string | Yes | MCP server name |
| uri | string | Yes | Resource URI to read |

**Example**:
```javascript
{
  "server": "filesystem",
  "uri": "file:///home/user/project/config/settings.json"
}
```

**Output Example**:
```
Resource: file:///home/user/project/config/settings.json
MIME Type: application/json

{
  "api_key": "...",
  "database_url": "...",
  "port": 3000
}
```

**Features**:
- Reads text and binary resources
- Automatic MIME type detection
- Connection retry mechanism
- Resource existence validation

**Best Practices**:
- Use ListMcpResources first to find URIs
- Binary data shown as byte count
- Automatic connection to MCP server
- Resource validated before reading

**Common Issues**:
- **Resource not found**: Use ListMcpResources to find valid URIs
- **Server not connected**: Server will auto-connect if needed
- **Read failed**: Check server logs for errors

---

## Planning Mode

### EnterPlanMode

**Purpose**: Enter planning mode for complex tasks requiring exploration before implementation.

**Parameters**: None

**Example**:
```javascript
{
  // No parameters
}
```

**When to Use**:
1. **Multiple Valid Approaches**: Task can be solved in different ways with trade-offs
2. **Significant Architectural Decisions**: Choosing between patterns (WebSockets vs SSE, Redux vs Context)
3. **Large-Scale Changes**: Touches many files/systems (refactor auth, migrate to GraphQL)
4. **Unclear Requirements**: Need to explore before understanding scope
5. **User Input Needed**: Will need AskUserQuestion to clarify approach

**When NOT to Use**:
- Simple, straightforward tasks
- Small bug fixes with clear solution
- Adding single function or small feature
- Tasks with obvious implementation
- Research-only tasks (use Task tool with explore agent)

**What Happens in Plan Mode**:
1. Enter READ-ONLY mode - NO file modifications except plan file
2. Explore codebase using Glob, Grep, Read
3. Understand existing patterns and architecture
4. Design implementation approach
5. Use AskUserQuestion for clarifications
6. Write plan to `PLAN.md`
7. Exit with ExitPlanMode when ready

**Output Example**:
```
Entered plan mode.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (except the plan file)
- Modifying existing files (except the plan file)
- Deleting files
- Moving or copying files
...

## Plan File Info:
No plan file exists yet. Create your plan at /home/user/project/PLAN.md
```

**Best Practices**:
- Requires user approval - they must consent
- Be thoughtful - unnecessary planning slows simple tasks
- Focus on understanding before proposing
- Build plan incrementally in PLAN.md
- ONLY edit plan file - all other operations READ-ONLY

**Examples**:

**GOOD - Use EnterPlanMode**:
- "Add user authentication to the app" - Architectural decisions needed
- "Optimize database queries" - Multiple approaches, need profiling
- "Implement dark mode" - Theme system affects many components

**BAD - Don't Use**:
- "Fix typo in README" - Straightforward
- "Add console.log for debugging" - Simple
- "What files handle routing?" - Research, not planning

---

### ExitPlanMode

**Purpose**: Exit planning mode and present plan for approval.

**Parameters**: None

**Example**:
```javascript
{
  // No parameters
}
```

**When to Use**:
- ONLY when task requires planning IMPLEMENTATION STEPS
- After writing plan to PLAN.md
- After resolving all ambiguities with AskUserQuestion
- Ready for user approval to proceed

**When NOT to Use**:
- Research tasks (gathering info, searching files)
- Tasks focused on understanding codebase
- Before clarifying ambiguities

**Handling Ambiguity**:
Before using this tool:
1. Use AskUserQuestion to clarify unclear requirements
2. Ask about specific choices (libraries, patterns, approaches)
3. Clarify assumptions affecting implementation
4. Edit plan file to incorporate feedback
5. Only exit after resolving all ambiguities

**Output Example**:
```
Exited plan mode.

Your plan has been saved to: /home/user/project/PLAN.md
You can refer back to it during implementation.

## Approved Plan:
# Implementation Plan: User Authentication

## Overview
Add JWT-based authentication system to the application.

## Steps
1. Install dependencies (jsonwebtoken, bcrypt)
2. Create auth middleware
3. Add user model with password hashing
...

Awaiting user approval to proceed with implementation.
```

**Plan File**:
- Plan automatically read from PLAN.md
- User sees complete plan content
- Plan preserved for reference during implementation

**Best Practices**:
- Plan should be clear and unambiguous
- Resolve questions before exiting
- Include concrete implementation steps
- List dependencies and trade-offs

**Common Issues**:
- **Not in plan mode**: Use EnterPlanMode first
- **Plan incomplete**: Continue planning before exiting
- **Ambiguous approach**: Use AskUserQuestion first

---

## Tool Combinations

### Common Workflows

**Workflow 1: Exploring Codebase**
```
1. Glob - Find relevant files
2. Grep - Search for patterns
3. Read - Read specific files
4. Task (Explore agent) - Deep analysis
```

**Workflow 2: Making Changes**
```
1. Read - Read file to edit
2. Edit or MultiEdit - Make changes
3. Bash - Run tests
4. TodoWrite - Track progress
```

**Workflow 3: Complex Implementation**
```
1. EnterPlanMode - Start planning
2. Glob/Grep/Read - Explore codebase
3. AskUserQuestion - Clarify approach
4. Write - Create plan file
5. ExitPlanMode - Present plan
6. [After approval] Edit/Write - Implement
7. Bash - Test changes
```

**Workflow 4: Background Tasks**
```
1. Task (background) - Start analysis
2. Bash (background) - Start dev server
3. TaskOutput - Check agent progress
4. BashOutput - Check server logs
5. KillShell - Stop server when done
```

**Workflow 5: MCP Integration**
```
1. ListMcpResources - Find available resources
2. ReadMcpResource - Read specific resource
3. Process and use data
```

---

## Best Practices Summary

### General
- Read before Edit/Write
- Use absolute paths
- Handle errors gracefully
- Check tool output before proceeding

### File Operations
- Preserve exact indentation
- Use Edit for existing files, Write for new files
- MultiEdit for atomic multi-file changes
- Always show diff before applying

### Search
- Glob for finding files
- Grep for searching content
- Use specific patterns to reduce results
- Prefer type parameter over glob for common file types

### Commands
- Use Bash for terminal operations only
- Use dedicated tools for file operations
- Quote paths with spaces
- Set appropriate timeouts

### Agents
- Choose appropriate agent type
- Use background mode for long tasks
- Resume failed agents
- Check output periodically

### Planning
- Use for complex architectural decisions
- Clarify with AskUserQuestion
- Build plan incrementally
- Only edit plan file in plan mode

---

## Troubleshooting

### File Not Found
- Verify path is absolute
- Check file exists with Glob or Bash ls
- Ensure no typos in path

### Permission Denied
- Check file/directory permissions
- May need sudo for system files
- Sandbox may block certain operations

### Command Timeout
- Increase timeout parameter
- Use background mode for long commands
- Consider breaking into smaller commands

### Edit Failed - Not Unique
- old_string appears multiple times
- Use replace_all parameter
- Add more context to old_string

### Connection Failed
- Check MCP server running
- Verify server configuration
- Check network/firewall settings

### Agent Not Responding
- Check TaskOutput for status
- May still be running - wait or use block
- Resume if paused or failed

---

## Configuration

### Tool Settings

**Bash Tool**:
- `BASH_MAX_OUTPUT_LENGTH` - Max output chars (default: 30000)
- `BASH_MAX_BACKGROUND_SHELLS` - Max background shells (default: 10)
- `BASH_BACKGROUND_MAX_RUNTIME` - Max runtime ms (default: 3600000)
- `BASH_AUDIT_LOG_FILE` - Audit log file path (optional)

**MCP**:
- Configure servers in `~/.claude/settings.json`
- Resource cache TTL: 60 seconds
- Connection timeout: 30 seconds
- Max reconnect attempts: 3

**Skills/Commands**:
- User skills: `~/.claude/skills/*.md`
- User commands: `~/.claude/commands/*.md`
- Project skills: `.claude/skills/*.md`
- Project commands: `.claude/commands/*.md`

**Agents**:
- Agent state: `~/.claude/agents/`
- Auto-persisted on every update
- 30-day retention

---

## Quick Reference

| Task | Tools to Use |
|------|-------------|
| Find files | Glob |
| Search content | Grep |
| Read file | Read |
| Edit file | Edit |
| Batch edits | MultiEdit |
| Create file | Write |
| Run command | Bash |
| Long-running command | Bash (background) or Tmux |
| Fetch web page | WebFetch |
| Search web | WebSearch |
| Complex analysis | Task (Explore/general-purpose) |
| Track progress | TodoWrite |
| Ask user | AskUserQuestion |
| Edit notebook | NotebookEdit |
| Plan complex task | EnterPlanMode → ExitPlanMode |
| MCP resources | ListMcpResources → ReadMcpResource |

---

## Platform-Specific Notes

### Linux
- Full sandbox support (bubblewrap)
- Tmux available
- All tools supported

### macOS
- Tmux available
- No sandbox (bubblewrap unavailable)
- All other tools supported

### Windows
- Use WSL for Tmux
- No sandbox support
- Bash may have limitations
- File paths: Use forward slashes or double backslashes
- Config path: `%USERPROFILE%\.claude\`

---

## Additional Resources

- Main README: `/home/user/claude-code-open/README.md`
- Architecture: `/home/user/claude-code-open/CLAUDE.md`
- Type Definitions: `/home/user/claude-code-open/src/types/index.ts`
- Tool Implementations: `/home/user/claude-code-open/src/tools/`

---

**Last Updated**: 2025-01-15
**Version**: 2.0.76
**Total Tools**: 27
