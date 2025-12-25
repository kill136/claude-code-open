# Claude Code - Developer Guide

> Complete development guide for contributing to Claude Code CLI

**Version:** 2.0.76
**Last Updated:** 2025-12-25

---

## Table of Contents

1. [Development Environment Setup](#1-development-environment-setup)
2. [Project Structure](#2-project-structure)
3. [Build and Run](#3-build-and-run)
4. [Adding New Tools](#4-adding-new-tools)
5. [Adding New Commands](#5-adding-new-commands)
6. [Adding New Hooks](#6-adding-new-hooks)
7. [Debugging Techniques](#7-debugging-techniques)
8. [Code Standards](#8-code-standards)

---

## 1. Development Environment Setup

### 1.1 Node.js Version Requirements

Claude Code requires **Node.js 18.0.0 or higher**.

```bash
# Check your Node.js version
node --version

# Should output v18.0.0 or higher
```

**Recommended versions:**
- Node.js 18.x LTS
- Node.js 20.x LTS (current)

### 1.2 Dependencies Installation

```bash
# Clone the repository
git clone https://github.com/kill136/claude-code-open.git
cd claude-code-open

# Install dependencies
npm install

# Verify installation
npm run build
```

**Key dependencies:**
- `@anthropic-ai/sdk` - Claude API client
- `commander` - CLI framework
- `react` + `ink` - Terminal UI
- `tree-sitter` + `tree-sitter-wasms` - Code parsing
- `zod` - Schema validation
- `axios` - HTTP requests
- `cheerio` - HTML parsing
- `glob` - File pattern matching
- `chalk` - Terminal colors
- `marked` - Markdown rendering
- `uuid` - Session IDs

### 1.3 IDE Configuration

#### Visual Studio Code

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

#### Recommended Extensions

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **TypeScript and JavaScript** (built-in)
- **Error Lens** (`usernamehw.errorlens`) - Inline error messages
- **GitLens** (`eamodio.gitlens`) - Git integration

### 1.4 Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Configuration
CLAUDE_CONFIG_DIR=~/.claude
CLAUDE_LOG_LEVEL=info
CLAUDE_MAX_TOKENS=4096

# Optional: Bash tool configuration
BASH_MAX_OUTPUT_LENGTH=30000
BASH_MAX_BACKGROUND_SHELLS=10
BASH_BACKGROUND_MAX_RUNTIME=3600000
BASH_AUDIT_LOG_FILE=/tmp/claude-bash-audit.log

# Optional: Sandbox configuration
CLAUDE_SANDBOX_ENABLED=true
CLAUDE_SANDBOX_TMPDIR=/tmp/claude-sandbox

# Optional: Hook configuration
CLAUDE_HOOKS_ENABLED=true

# Optional: Debug mode
DEBUG=claude:*
NODE_ENV=development
```

**Environment variable sources (priority order):**
1. Command line arguments
2. `.env` file
3. Environment variables
4. `~/.claude/settings.json`
5. Default values

### 1.5 Configuration Files

#### Global Configuration

`~/.claude/settings.json`:

```json
{
  "apiKey": "sk-ant-api03-...",
  "defaultModel": "claude-sonnet-4",
  "maxTokens": 4096,
  "temperature": 1.0,
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    }
  },
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "echo",
        "args": ["Pre-tool hook executed"]
      }
    ]
  }
}
```

#### Project Configuration

`.claude/settings.json` (project-specific):

```json
{
  "projectName": "my-project",
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "./.claude/hooks/session-start.sh"
      }
    ]
  },
  "skills": {
    "customSkill": {
      "description": "Custom project skill",
      "command": "./.claude/skills/custom.sh"
    }
  }
}
```

---

## 2. Project Structure

### 2.1 Directory Overview

```
claude-code-open/
├── src/                    # Source code
│   ├── cli.ts             # CLI entry point
│   ├── index.ts           # Main export barrel file
│   ├── core/              # Core engine
│   │   ├── client.ts      # Anthropic API wrapper
│   │   ├── session.ts     # Session state management
│   │   └── loop.ts        # Main conversation orchestrator
│   ├── tools/             # Tool system (25+ tools)
│   │   ├── base.ts        # BaseTool class & ToolRegistry
│   │   ├── index.ts       # Tool registration
│   │   ├── bash.ts        # Bash execution
│   │   ├── file.ts        # Read, Write, Edit
│   │   ├── search.ts      # Glob, Grep
│   │   ├── web.ts         # WebFetch, WebSearch
│   │   ├── todo.ts        # TodoWrite
│   │   ├── agent.ts       # Task, TaskOutput, ListAgents
│   │   ├── notebook.ts    # NotebookEdit
│   │   ├── mcp.ts         # MCP integration
│   │   ├── multiedit.ts   # MultiEdit
│   │   ├── tmux.ts        # Tmux integration
│   │   ├── skill.ts       # Skill & SlashCommand
│   │   └── ...            # More tools
│   ├── commands/          # Slash command system
│   │   ├── index.ts       # Command registration
│   │   ├── registry.ts    # CommandRegistry
│   │   ├── types.ts       # Command types
│   │   ├── general.ts     # help, clear, exit, status
│   │   ├── session.ts     # resume, list, fork, delete
│   │   ├── config.ts      # config set/get/list
│   │   ├── auth.ts        # auth login/logout/status
│   │   ├── tools.ts       # tools list/enable/disable
│   │   ├── utility.ts     # doctor, bug
│   │   └── development.ts # debug commands
│   ├── session/           # Session management
│   │   ├── index.ts       # Session class
│   │   └── list.ts        # Session listing
│   ├── config/            # Configuration management
│   │   └── index.ts       # Config loading/saving
│   ├── context/           # Context management
│   │   └── index.ts       # Token estimation, auto-summarization
│   ├── hooks/             # Hook system
│   │   └── index.ts       # Pre/post tool execution hooks
│   ├── plugins/           # Plugin system
│   │   └── index.ts       # Plugin manager
│   ├── providers/         # Provider implementations
│   │   ├── cli.ts         # CLI provider
│   │   └── vertex.ts      # Vertex AI provider
│   ├── ui/                # Terminal UI (React + Ink)
│   │   ├── App.tsx        # Main UI component
│   │   └── components/    # UI components
│   │       ├── Header.tsx
│   │       ├── Input.tsx
│   │       ├── Message.tsx
│   │       ├── StatusBar.tsx
│   │       ├── TodoList.tsx
│   │       ├── ToolCall.tsx
│   │       ├── Spinner.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── DiffView.tsx
│   │       └── PermissionPrompt.tsx
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Core types
│   ├── parser/            # Code parser (tree-sitter)
│   ├── search/            # Search utilities (ripgrep)
│   ├── streaming/         # JSON message streaming
│   ├── auth/              # Authentication
│   ├── checkpoint/        # Checkpoint system
│   ├── diagnostics/       # Diagnostics
│   ├── permissions/       # Permission system
│   ├── telemetry/         # Telemetry
│   ├── updater/           # Auto-updater
│   ├── sandbox/           # Sandbox execution
│   ├── security/          # Security utilities
│   ├── skills/            # Skills system
│   └── utils/             # Utilities
├── dist/                  # Compiled JavaScript (generated)
├── docs/                  # Documentation
├── examples/              # Example configurations
├── scripts/               # Build/dev scripts
├── tests/                 # Test files
├── package.json           # NPM package configuration
├── tsconfig.json          # TypeScript configuration
├── CLAUDE.md              # Project instructions for Claude
└── README.md              # Project README
```

### 2.2 Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point, argument parsing with Commander.js |
| `src/index.ts` | Main export barrel file |
| `src/core/client.ts` | Anthropic API wrapper with retry logic, token counting |
| `src/core/session.ts` | Session state management, message history |
| `src/core/loop.ts` | Main conversation orchestrator |
| `src/tools/base.ts` | BaseTool class & ToolRegistry |
| `src/tools/index.ts` | Tool registration |
| `src/commands/index.ts` | Command registration |
| `src/hooks/index.ts` | Hook system implementation |
| `src/types/index.ts` | Core TypeScript types |
| `src/ui/App.tsx` | Main UI component (React + Ink) |

### 2.3 Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Entry Point                          │
│                      (src/cli.ts)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Conversation Loop                           │
│                   (src/core/loop.ts)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - Manages conversation flow                         │  │
│  │  - Handles tool filtering (allow/disallow lists)     │  │
│  │  - Multi-turn dialogue orchestration                 │  │
│  │  - Budget tracking                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────┬───────┘
     │                                                 │
     ▼                                                 ▼
┌─────────────────┐                         ┌──────────────────┐
│  Claude Client  │                         │  Tool Registry   │
│ (core/client.ts)│                         │(tools/base.ts)   │
│                 │                         │                  │
│ - API calls     │                         │ - 25+ tools      │
│ - Retry logic   │                         │ - Tool execution │
│ - Token count   │                         │ - Hook support   │
│ - Cost tracking │                         │                  │
└─────────────────┘                         └──────────────────┘
     │                                                 │
     ▼                                                 ▼
┌─────────────────┐                         ┌──────────────────┐
│  Session Store  │                         │   Tool Hooks     │
│(session/index.ts│                         │(hooks/index.ts)  │
│                 │                         │                  │
│ - Persist state │                         │ - Pre-tool hooks │
│ - ~/.claude/    │                         │ - Post-tool hooks│
│   sessions/     │                         │ - Event system   │
│ - 30-day expiry │                         │                  │
└─────────────────┘                         └──────────────────┘
```

### 2.4 Data Flow

```
User Input
    │
    ▼
┌──────────────────────┐
│  CLI / UI Component  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Conversation Loop   │ ◄──┐
└──────────┬───────────┘    │
           │                 │
           ▼                 │
┌──────────────────────┐    │
│   Claude API Call    │    │
│  (ClaudeClient)      │    │
└──────────┬───────────┘    │
           │                 │
           ▼                 │
    ┌──────────┐            │
    │ Response │            │
    └──────┬───┘            │
           │                 │
    ┌──────▼──────────┐     │
    │  Text Block?    │     │
    └──────┬──────────┘     │
           │                 │
           │ Yes             │
           ▼                 │
    Display to User          │
                             │
    ┌────────────────┐       │
    │ Tool Use Block?│       │
    └──────┬─────────┘       │
           │                 │
           │ Yes             │
           ▼                 │
    ┌────────────────┐       │
    │  Pre-Tool Hook │       │
    └──────┬─────────┘       │
           │                 │
           ▼                 │
    ┌────────────────┐       │
    │  Tool Execution│       │
    │  (ToolRegistry)│       │
    └──────┬─────────┘       │
           │                 │
           ▼                 │
    ┌────────────────┐       │
    │ Post-Tool Hook │       │
    └──────┬─────────┘       │
           │                 │
           ▼                 │
    ┌────────────────┐       │
    │  Tool Result   │       │
    └──────┬─────────┘       │
           │                 │
           └─────────────────┘
           (Loop continues)
```

---

## 3. Build and Run

### 3.1 Development Mode

**Quick iteration with live TypeScript execution:**

```bash
# Run in development mode (uses tsx)
npm run dev

# With initial prompt
npm run dev "Analyze this codebase"

# With arguments
npm run dev -- -m opus "Complex task"
npm run dev -- -p "Simple query"
```

**Development mode features:**
- No compilation needed
- Fast iteration cycle
- Full TypeScript support via `tsx`
- Source maps enabled
- Auto-reload on file changes (use `nodemon` + `tsx` for watch mode)

### 3.2 Production Build

```bash
# Compile TypeScript to JavaScript
npm run build

# Output location: dist/
# - dist/cli.js (main entry point)
# - dist/**/*.js (all modules)
# - dist/**/*.d.ts (type definitions)
# - dist/**/*.js.map (source maps)
```

**Build configuration:**
- **Target:** ES2022
- **Module:** NodeNext (ES Modules)
- **Source maps:** Enabled
- **Declaration files:** Enabled
- **Output directory:** `dist/`

### 3.3 Running Compiled Version

```bash
# Run the compiled version
npm run start

# Or directly
node dist/cli.js

# With arguments
node dist/cli.js "Analyze this codebase"
node dist/cli.js -m opus "Complex task"
node dist/cli.js -p "Print mode query"
node dist/cli.js --resume
```

### 3.4 Type Checking

```bash
# Type check without compiling
npx tsc --noEmit

# Watch mode for type checking
npx tsc --noEmit --watch
```

### 3.5 Install Globally

```bash
# Link for local development
npm link

# Now you can use 'claude' anywhere
claude "Analyze this file"
claude -m haiku "Simple task"

# Unlink when done
npm unlink -g claude-code-open
```

### 3.6 CLI Usage Examples

```bash
# Interactive mode (default)
claude

# With initial prompt
claude "Help me refactor this code"

# Print mode (non-interactive)
claude -p "What is this code doing?"

# Specify model
claude -m opus "Complex architectural analysis"
claude -m haiku "Quick code review"
claude -m sonnet "Standard task"

# Resume last session
claude --resume
claude -r

# Resume specific session
claude --resume <session-id>

# Set max tokens
claude --max-tokens 8192

# Tool filtering
claude --allow-tools "Read,Write,Glob,Grep"
claude --disallow-tools "Bash,WebFetch"

# Permission modes
claude --accept-edits              # Auto-accept file edits
claude --bypass-permissions        # Skip all permission prompts
claude --plan                      # Enable plan mode

# Budget limit
claude --max-budget-usd 5.0       # Stop at $5 spend

# Verbose output
claude -v

# Debug mode
DEBUG=claude:* claude
```

### 3.7 Common Development Tasks

```bash
# Start fresh development session
npm run dev

# Build and test compiled version
npm run build && npm run start

# Type check entire codebase
npx tsc --noEmit

# Clean build artifacts
rm -rf dist/

# Reinstall dependencies (clean slate)
rm -rf node_modules package-lock.json
npm install

# Check for outdated dependencies
npm outdated

# Update dependencies
npm update
```

---

## 4. Adding New Tools

### 4.1 Tool Architecture

All tools extend the `BaseTool` abstract class and register with the `ToolRegistry`.

**Key components:**
1. **Tool class** - Extends `BaseTool<TInput, TOutput>`
2. **Input schema** - JSON Schema for parameter validation
3. **Execute method** - Async function that implements the tool logic
4. **Registration** - Add to `ToolRegistry` in `src/tools/index.ts`

### 4.2 BaseTool Class

Located in `src/tools/base.ts`:

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

### 4.3 Step-by-Step: Create a New Tool

**Example: Creating a `JsonFormatter` tool**

#### Step 1: Create tool file

Create `src/tools/json-formatter.ts`:

```typescript
import { BaseTool } from './base.js';
import type { ToolDefinition, ToolResult } from '../types/index.js';

/**
 * Input type for JsonFormatter tool
 */
interface JsonFormatterInput {
  json: string;
  indent?: number;
  sortKeys?: boolean;
}

/**
 * JsonFormatter Tool
 * Formats and validates JSON strings
 */
export class JsonFormatterTool extends BaseTool<JsonFormatterInput, ToolResult> {
  name = 'JsonFormatter';

  description = `Formats and validates JSON strings.

Usage:
  - Takes a JSON string and formats it with proper indentation
  - Optionally sorts object keys alphabetically
  - Validates JSON syntax and reports errors

Parameters:
  - json: The JSON string to format (required)
  - indent: Number of spaces for indentation (default: 2)
  - sortKeys: Sort object keys alphabetically (default: false)

Returns formatted JSON or validation error.`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        json: {
          type: 'string',
          description: 'The JSON string to format',
        },
        indent: {
          type: 'number',
          description: 'Number of spaces for indentation (default: 2)',
        },
        sortKeys: {
          type: 'boolean',
          description: 'Sort object keys alphabetically (default: false)',
        },
      },
      required: ['json'],
    };
  }

  async execute(input: JsonFormatterInput): Promise<ToolResult> {
    const { json, indent = 2, sortKeys = false } = input;

    try {
      // Parse JSON to validate
      let parsed = JSON.parse(json);

      // Sort keys if requested
      if (sortKeys) {
        parsed = this.sortObjectKeys(parsed);
      }

      // Format with indentation
      const formatted = JSON.stringify(parsed, null, indent);

      return this.success(formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Invalid JSON: ${message}`);
    }
  }

  /**
   * Recursively sort object keys
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = this.sortObjectKeys(obj[key]);
    }

    return sorted;
  }
}
```

#### Step 2: Export from module

Add to `src/tools/index.ts`:

```typescript
// Add export at the top
export * from './json-formatter.js';

// Add import with other tools
import { JsonFormatterTool } from './json-formatter.js';

// Register in registerAllTools() function
export function registerAllTools(): void {
  // ... existing registrations ...

  // JSON formatter
  toolRegistry.register(new JsonFormatterTool());

  // ... rest of registrations ...
}
```

#### Step 3: Add types (optional)

If you need custom types, add to `src/types/index.ts`:

```typescript
export interface JsonFormatterInput {
  json: string;
  indent?: number;
  sortKeys?: boolean;
}
```

#### Step 4: Test your tool

```bash
# Development mode
npm run dev

# Then in Claude:
User: Use the JsonFormatter tool to format this JSON: {"name":"test","age":30}

# Claude will call your tool:
# Tool: JsonFormatter
# Input: { "json": "{\"name\":\"test\",\"age\":30}", "indent": 2 }
# Output:
# {
#   "name": "test",
#   "age": 30
# }
```

### 4.4 Tool Best Practices

#### Input Validation

```typescript
async execute(input: MyToolInput): Promise<ToolResult> {
  // Validate required fields
  if (!input.requiredField) {
    return this.error('requiredField is required');
  }

  // Validate field types
  if (typeof input.number !== 'number') {
    return this.error('number must be a number');
  }

  // Validate ranges
  if (input.number < 0 || input.number > 100) {
    return this.error('number must be between 0 and 100');
  }

  // Continue with execution...
}
```

#### Error Handling

```typescript
async execute(input: MyToolInput): Promise<ToolResult> {
  try {
    const result = await this.doWork(input);
    return this.success(result);
  } catch (err) {
    // Provide helpful error messages
    if (err instanceof FileNotFoundError) {
      return this.error(`File not found: ${input.path}`);
    }

    if (err instanceof PermissionError) {
      return this.error(`Permission denied: ${input.path}`);
    }

    // Generic error fallback
    const message = err instanceof Error ? err.message : String(err);
    return this.error(`Operation failed: ${message}`);
  }
}
```

#### Hook Integration

```typescript
import { runPreToolUseHooks, runPostToolUseHooks } from '../hooks/index.js';

async execute(input: MyToolInput): Promise<ToolResult> {
  // Run pre-tool hooks
  const hookResult = await runPreToolUseHooks(this.name, input);
  if (!hookResult.allowed) {
    return this.error(`Blocked by hook: ${hookResult.message || 'Operation not allowed'}`);
  }

  // Execute tool logic
  const result = await this.doWork(input);

  // Run post-tool hooks
  await runPostToolUseHooks(this.name, input, result.output || '');

  return result;
}
```

#### Async Operations

```typescript
async execute(input: MyToolInput): Promise<ToolResult> {
  // Use async/await for I/O operations
  const data = await fs.promises.readFile(input.path, 'utf-8');

  // Use Promise.all for parallel operations
  const results = await Promise.all([
    this.operation1(),
    this.operation2(),
    this.operation3(),
  ]);

  // Handle timeouts
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), 30000)
  );

  const result = await Promise.race([
    this.longRunningOperation(),
    timeoutPromise,
  ]);

  return this.success(result);
}
```

#### Large Output Handling

```typescript
async execute(input: MyToolInput): Promise<ToolResult> {
  const MAX_OUTPUT_LENGTH = 30000; // 30KB limit

  let output = await this.generateOutput(input);

  // Truncate if too long
  if (output.length > MAX_OUTPUT_LENGTH) {
    output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... [output truncated]';
  }

  return this.success(output);
}
```

### 4.5 Testing Requirements

#### Manual Testing

```bash
# Start development mode
npm run dev

# Test tool with various inputs
User: Test the tool with valid input
User: Test the tool with invalid input
User: Test the tool with edge cases
```

#### Unit Testing (future)

Create `src/tools/json-formatter.test.ts`:

```typescript
import { JsonFormatterTool } from './json-formatter.js';

describe('JsonFormatterTool', () => {
  const tool = new JsonFormatterTool();

  it('should format valid JSON', async () => {
    const result = await tool.execute({
      json: '{"name":"test","age":30}',
      indent: 2,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('"name": "test"');
  });

  it('should handle invalid JSON', async () => {
    const result = await tool.execute({
      json: '{invalid}',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('should sort keys when requested', async () => {
    const result = await tool.execute({
      json: '{"z":1,"a":2}',
      sortKeys: true,
    });

    expect(result.success).toBe(true);
    const lines = result.output!.split('\n');
    const aIndex = lines.findIndex(l => l.includes('"a"'));
    const zIndex = lines.findIndex(l => l.includes('"z"'));
    expect(aIndex).toBeLessThan(zIndex);
  });
});
```

### 4.6 Tool Examples

See existing tools for reference:

- **Simple tool:** `src/tools/todo.ts` (TodoWriteTool)
- **File I/O:** `src/tools/file.ts` (ReadTool, WriteTool, EditTool)
- **Process execution:** `src/tools/bash.ts` (BashTool)
- **HTTP requests:** `src/tools/web.ts` (WebFetchTool, WebSearchTool)
- **Complex logic:** `src/tools/multiedit.ts` (MultiEditTool)

---

## 5. Adding New Commands

### 5.1 Command Architecture

Commands are slash commands (e.g., `/help`, `/clear`, `/exit`) that provide built-in functionality.

**Key components:**
1. **Command definition** - Implements `SlashCommand` interface
2. **Registration** - Add to `CommandRegistry`
3. **Categorization** - Group by category (general, session, config, etc.)
4. **Execution** - Sync or async handler function

### 5.2 SlashCommand Interface

Located in `src/commands/types.ts`:

```typescript
export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: 'general' | 'session' | 'config' | 'tools' | 'auth' | 'utility' | 'development';
  execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;
}

export interface CommandContext {
  session: any;
  config: any;
  ui: any;
  args: string[];
  rawInput: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  action?: string;
}
```

### 5.3 Step-by-Step: Create a New Command

**Example: Creating a `/stats` command**

#### Step 1: Choose category

Determine which category file to add your command to:

- `general.ts` - help, clear, exit, status
- `session.ts` - resume, list, fork, delete
- `config.ts` - config set/get/list
- `auth.ts` - auth login/logout/status
- `tools.ts` - tools list/enable/disable
- `utility.ts` - doctor, bug
- `development.ts` - debug commands

For this example, we'll add to `utility.ts`.

#### Step 2: Define command

Edit `src/commands/utility.ts`:

```typescript
import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';

// Add new command definition
export const statsCommand: SlashCommand = {
  name: 'stats',
  aliases: ['statistics', 'info'],
  description: 'Show session statistics and usage',
  usage: '/stats [--detailed]',
  category: 'utility',

  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, session } = ctx;
    const detailed = args.includes('--detailed');

    // Gather statistics
    const stats = {
      messages: session.getMessages().length,
      totalTokens: session.getTotalTokens(),
      totalCost: session.getTotalCost(),
      duration: Date.now() - session.getStartTime(),
    };

    // Format output
    let output = '\nSession Statistics\n';
    output += '==================\n\n';
    output += `Messages: ${stats.messages}\n`;
    output += `Total tokens: ${stats.totalTokens}\n`;
    output += `Total cost: $${stats.totalCost.toFixed(4)}\n`;
    output += `Duration: ${formatDuration(stats.duration)}\n`;

    if (detailed) {
      output += '\nDetailed Breakdown\n';
      output += '------------------\n';
      output += `Input tokens: ${session.getInputTokens()}\n`;
      output += `Output tokens: ${session.getOutputTokens()}\n`;
      output += `Tool calls: ${session.getToolCallCount()}\n`;
      output += `Average tokens/message: ${Math.round(stats.totalTokens / stats.messages)}\n`;
    }

    ctx.ui.addMessage('assistant', output);
    return { success: true };
  },
};

// Helper function
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
```

#### Step 3: Register command

In `src/commands/utility.ts`, add to registration function:

```typescript
export function registerUtilityCommands(): void {
  // ... existing registrations ...

  // Register stats command
  commandRegistry.register(statsCommand);
}
```

#### Step 4: Test command

```bash
npm run dev

# In Claude:
User: /stats
User: /stats --detailed
User: /statistics  # Test alias
```

### 5.4 Command Best Practices

#### Argument Parsing

```typescript
execute: (ctx: CommandContext): CommandResult => {
  const { args } = ctx;

  // Boolean flags
  const verbose = args.includes('--verbose') || args.includes('-v');
  const quiet = args.includes('--quiet') || args.includes('-q');

  // Value flags
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 10;

  // Positional arguments
  const [action, target, ...rest] = args;

  // Validation
  if (!action) {
    ctx.ui.addMessage('assistant', 'Error: action required\nUsage: /mycommand <action> [target]');
    return { success: false };
  }

  // Continue...
}
```

#### Error Handling

```typescript
execute: async (ctx: CommandContext): Promise<CommandResult> => {
  try {
    const result = await someAsyncOperation();
    ctx.ui.addMessage('assistant', `Success: ${result}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.ui.addMessage('assistant', `Error: ${message}`);
    return { success: false, message };
  }
}
```

#### UI Integration

```typescript
execute: (ctx: CommandContext): CommandResult => {
  const { ui } = ctx;

  // Add message
  ui.addMessage('assistant', 'Hello from command!');

  // Add activity (status bar)
  ui.addActivity('Processing...');

  // Clear screen
  ui.clear();

  // Exit
  ui.exit();

  return { success: true };
}
```

#### Return Actions

```typescript
execute: (ctx: CommandContext): CommandResult => {
  // Return action to trigger UI behavior
  return {
    success: true,
    action: 'clear',    // or 'exit', 'resume', etc.
  };
}
```

### 5.5 Command Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `general` | Core functionality | help, clear, exit, status |
| `session` | Session management | resume, list, fork, delete |
| `config` | Configuration | config set/get/list |
| `auth` | Authentication | auth login/logout/status |
| `tools` | Tool management | tools list/enable/disable |
| `utility` | Utilities | doctor, bug, stats |
| `development` | Debug commands | debug, trace, profile |

### 5.6 Command Examples

See existing commands for reference:

- **Simple command:** `src/commands/general.ts` (clearCommand, exitCommand)
- **Complex command:** `src/commands/session.ts` (resumeCommand, listCommand)
- **Config command:** `src/commands/config.ts` (configSetCommand)
- **Async command:** `src/commands/auth.ts` (authLoginCommand)

---

## 6. Adding New Hooks

### 6.1 Hook System Overview

Hooks allow you to execute custom scripts or URL callbacks before/after tool execution or on specific events.

**12 supported hook events:**
1. `PreToolUse` - Before tool execution
2. `PostToolUse` - After successful tool execution
3. `PostToolUseFailure` - After failed tool execution
4. `Notification` - On notification events
5. `UserPromptSubmit` - When user submits a prompt
6. `SessionStart` - When session begins
7. `SessionEnd` - When session ends
8. `Stop` - On stop events
9. `SubagentStart` - When subagent starts
10. `SubagentStop` - When subagent stops
11. `PreCompact` - Before context compression
12. `PermissionRequest` - On permission requests

### 6.2 Hook Types

#### Command Hook

Executes a shell command:

```json
{
  "type": "command",
  "command": "/path/to/script.sh",
  "args": ["arg1", "arg2"],
  "env": {
    "CUSTOM_VAR": "value"
  },
  "timeout": 30000,
  "blocking": true,
  "matcher": "Bash"
}
```

#### URL Hook

Sends HTTP request:

```json
{
  "type": "url",
  "url": "https://example.com/webhook",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token"
  },
  "timeout": 10000,
  "blocking": false
}
```

### 6.3 Step-by-Step: Create a Hook

#### Example 1: SessionStart Hook (Command)

**Goal:** Run a setup script when a session starts.

**Step 1:** Create hook script

Create `.claude/hooks/session-start.sh`:

```bash
#!/bin/bash
# Session start hook - runs when Claude session begins

# Read JSON input from stdin
INPUT=$(cat)

# Extract session ID
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')

echo "Session started: $SESSION_ID"

# Run setup tasks
echo "Running pre-session setup..."

# Example: Start a local development server
# cd /path/to/project && npm run dev &

# Example: Set environment variables
export CLAUDE_SESSION_ID="$SESSION_ID"

# Example: Log session start
echo "$(date): Session $SESSION_ID started" >> ~/.claude/session.log

# Exit with 0 for success
exit 0
```

Make it executable:

```bash
chmod +x .claude/hooks/session-start.sh
```

**Step 2:** Register hook in configuration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "./.claude/hooks/session-start.sh",
        "timeout": 30000,
        "blocking": true
      }
    ]
  }
}
```

**Step 3:** Test hook

```bash
npm run dev

# Hook will run automatically when session starts
# Check output in terminal or ~/.claude/session.log
```

#### Example 2: PreToolUse Hook (URL)

**Goal:** Send notification to webhook before Bash tool execution.

**Step 1:** Create webhook endpoint

Set up a webhook endpoint (e.g., Discord, Slack, custom server).

**Step 2:** Register hook

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "url",
        "url": "https://discord.com/api/webhooks/...",
        "method": "POST",
        "matcher": "Bash",
        "blocking": false,
        "timeout": 5000
      }
    ]
  }
}
```

**Step 3:** Test hook

```bash
npm run dev

# In Claude:
User: Run ls command

# Hook will send HTTP request before Bash tool executes
```

#### Example 3: PostToolUse Hook (Command)

**Goal:** Log all tool executions to a file.

**Step 1:** Create logging script

Create `~/.claude/hooks/log-tool-use.sh`:

```bash
#!/bin/bash
# Log tool usage

# Read JSON input
INPUT=$(cat)

# Extract fields
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log to file
LOG_FILE="$HOME/.claude/tool-usage.log"
echo "$TIMESTAMP - Tool: $TOOL_NAME" >> "$LOG_FILE"

# Optionally, log full input/output
echo "$INPUT" | jq '.' >> "$LOG_FILE"

exit 0
```

Make executable:

```bash
chmod +x ~/.claude/hooks/log-tool-use.sh
```

**Step 2:** Register hook

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "/Users/username/.claude/hooks/log-tool-use.sh",
        "blocking": false
      }
    ]
  }
}
```

### 6.4 Hook Input Format

Hooks receive JSON input via stdin (command hooks) or request body (URL hooks):

```json
{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": {
    "command": "ls -la",
    "timeout": 120000
  },
  "toolOutput": null,
  "message": null,
  "sessionId": "abc123",
  "timestamp": "2025-12-25T10:30:00Z"
}
```

### 6.5 Hook Output Format

**To block an operation**, return JSON with `blocked: true`:

```json
{
  "blocked": true,
  "message": "Operation not allowed"
}
```

**Normal output:**

```json
{
  "success": true,
  "message": "Hook executed successfully"
}
```

### 6.6 Programmatic Hook Registration

Register hooks in code:

```typescript
import { registerHook, registerLegacyHook } from '../hooks/index.js';

// New format
registerHook('PreToolUse', {
  type: 'command',
  command: '/path/to/script.sh',
  matcher: 'Bash',
  blocking: true,
});

// URL hook
registerHook('PostToolUse', {
  type: 'url',
  url: 'https://example.com/webhook',
  method: 'POST',
  blocking: false,
});

// Legacy format (compatibility)
registerLegacyHook({
  event: 'SessionStart',
  command: '/path/to/script.sh',
  blocking: true,
});
```

### 6.7 Hook Best Practices

#### Security

```bash
#!/bin/bash
# Validate input before processing

INPUT=$(cat)

# Validate JSON
if ! echo "$INPUT" | jq '.' > /dev/null 2>&1; then
  echo "Invalid JSON input"
  exit 1
fi

# Sanitize values
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName' | sed 's/[^a-zA-Z0-9_-]//g')

# Continue processing...
```

#### Error Handling

```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Your hook logic here...

# Exit codes:
# 0 = success
# 1 = error (non-blocking)
# Exit with JSON for blocking:
# echo '{"blocked": true, "message": "Reason"}' && exit 1
```

#### Performance

- Keep hooks fast (< 1 second preferred)
- Use `blocking: false` for non-critical hooks
- Set appropriate timeouts
- Avoid network calls in blocking hooks

#### Matchers

```json
{
  "matcher": "Bash"           // Exact match
}

{
  "matcher": "/Bash|Read/"    // Regex match (multiple tools)
}

{
  "matcher": "/^Write.*/"     // Regex match (pattern)
}
```

### 6.8 Hook Examples

**Example: Block dangerous Bash commands**

`.claude/hooks/validate-bash.sh`:

```bash
#!/bin/bash
INPUT=$(cat)

# Extract command
COMMAND=$(echo "$INPUT" | jq -r '.toolInput.command')

# Block dangerous patterns
if echo "$COMMAND" | grep -qE '(rm -rf /|mkfs|dd if=/dev/zero)'; then
  echo '{"blocked": true, "message": "Dangerous command blocked"}'
  exit 1
fi

# Allow
exit 0
```

Configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./.claude/hooks/validate-bash.sh",
        "matcher": "Bash",
        "blocking": true
      }
    ]
  }
}
```

**Example: Send Slack notification on session end**

Configuration:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "type": "url",
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "method": "POST",
        "blocking": false
      }
    ]
  }
}
```

---

## 7. Debugging Techniques

### 7.1 Debug Mode

#### Enable Debug Logging

```bash
# Full debug output
DEBUG=claude:* npm run dev

# Specific modules
DEBUG=claude:client npm run dev
DEBUG=claude:session npm run dev
DEBUG=claude:tools npm run dev

# Multiple modules
DEBUG=claude:client,claude:session npm run dev
```

#### Add Debug Statements

```typescript
import debug from 'debug';

const log = debug('claude:mymodule');

export class MyClass {
  doSomething() {
    log('Starting operation...');
    log('Input: %O', input);  // %O = pretty print object

    try {
      const result = this.process();
      log('Result: %s', result);
      return result;
    } catch (err) {
      log('Error: %O', err);
      throw err;
    }
  }
}
```

### 7.2 Logging Levels

Set via `CLAUDE_LOG_LEVEL` environment variable:

```bash
# Error only
CLAUDE_LOG_LEVEL=error npm run dev

# Warnings and errors
CLAUDE_LOG_LEVEL=warn npm run dev

# Info, warnings, and errors (default)
CLAUDE_LOG_LEVEL=info npm run dev

# Verbose output
CLAUDE_LOG_LEVEL=debug npm run dev

# Everything
CLAUDE_LOG_LEVEL=trace npm run dev
```

### 7.3 Inspecting Sessions

```bash
# View session files
ls -la ~/.claude/sessions/

# Pretty-print session JSON
cat ~/.claude/sessions/<session-id>.json | jq '.'

# View recent sessions
ls -lt ~/.claude/sessions/ | head -10

# Search sessions
grep -r "search term" ~/.claude/sessions/

# Count messages in session
cat ~/.claude/sessions/<session-id>.json | jq '.messages | length'

# Extract tool calls
cat ~/.claude/sessions/<session-id>.json | jq '.messages[].content[] | select(.type == "tool_use")'
```

### 7.4 Debugging Tools

#### Bash Tool Audit Logs

```bash
# Enable audit logging
export BASH_AUDIT_LOG_FILE=/tmp/claude-bash-audit.log

npm run dev

# View audit logs
tail -f /tmp/claude-bash-audit.log

# Pretty print
cat /tmp/claude-bash-audit.log | jq '.'

# Filter successful commands
cat /tmp/claude-bash-audit.log | jq 'select(.success == true)'

# Filter by command pattern
cat /tmp/claude-bash-audit.log | jq 'select(.command | contains("git"))'
```

#### Hook Debugging

```bash
# Enable hook debugging
DEBUG=claude:hooks npm run dev

# Test hooks individually
echo '{"event":"SessionStart","sessionId":"test"}' | ./.claude/hooks/test.sh

# Check hook registration
# Add to code:
import { getRegisteredHooks } from '../hooks/index.js';
console.log('Registered hooks:', getRegisteredHooks());
```

### 7.5 API Debugging

#### Request/Response Logging

```typescript
// In src/core/client.ts
import debug from 'debug';

const log = debug('claude:api');

async createMessage(...) {
  log('API Request: %O', {
    model: this.model,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.substring(0, 100) : 'complex'
    })),
    tools: tools.map(t => t.name),
  });

  const response = await this.client.messages.create({...});

  log('API Response: %O', {
    id: response.id,
    model: response.model,
    stopReason: response.stop_reason,
    usage: response.usage,
  });

  return response;
}
```

#### Network Debugging

```bash
# Use HTTP proxy for inspection (e.g., Charles, mitmproxy)
export HTTP_PROXY=http://localhost:8888
export HTTPS_PROXY=http://localhost:8888

npm run dev
```

### 7.6 Common Issues

#### Issue: Module not found

```
Error: Cannot find module './some-file.js'
```

**Solution:**
- Check import path includes `.js` extension (ES modules requirement)
- Verify file exists
- Check `tsconfig.json` module resolution

```typescript
// Wrong
import { foo } from './bar';

// Correct
import { foo } from './bar.js';
```

#### Issue: Type errors

```
error TS2322: Type 'string' is not assignable to type 'number'
```

**Solution:**
- Run `npx tsc --noEmit` to see all type errors
- Check type definitions in `src/types/index.ts`
- Use type assertions when necessary: `value as MyType`

#### Issue: Tool not registering

```
Tool 'MyTool' not found
```

**Solution:**
- Check tool is registered in `src/tools/index.ts`
- Verify `registerAllTools()` is called
- Check tool name matches exactly (case-sensitive)

```typescript
// In src/tools/index.ts
import { MyTool } from './my-tool.js';

export function registerAllTools(): void {
  // ...
  toolRegistry.register(new MyTool());
  // ...
}
```

#### Issue: Session not persisting

```
Session lost after restart
```

**Solution:**
- Check `~/.claude/sessions/` directory exists
- Verify write permissions
- Check for errors in session save logic
- Ensure session ID is being set

```bash
# Check permissions
ls -la ~/.claude/sessions/

# Create directory if missing
mkdir -p ~/.claude/sessions

# Fix permissions
chmod 755 ~/.claude/sessions
```

### 7.7 Profiling Performance

#### Time Tool Execution

```typescript
async execute(input: MyInput): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const result = await this.doWork(input);
    const duration = Date.now() - startTime;

    console.log(`[${this.name}] Execution time: ${duration}ms`);

    return result;
  } catch (err) {
    // ...
  }
}
```

#### Memory Profiling

```bash
# Run with memory inspection
node --inspect dist/cli.js

# Open Chrome DevTools
# Navigate to chrome://inspect
# Click "Open dedicated DevTools for Node"

# Take heap snapshots
# Compare memory usage over time
```

#### CPU Profiling

```bash
# Generate CPU profile
node --cpu-prof dist/cli.js "Run some tasks"

# Analyze with speedscope
npm install -g speedscope
speedscope CPU.*.cpuprofile
```

---

## 8. Code Standards

### 8.1 TypeScript Configuration

**Target:** ES2022
**Module:** NodeNext (ES Modules)
**Strict Mode:** Disabled (for flexibility)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react",
    "noImplicitAny": false
  }
}
```

### 8.2 Naming Conventions

#### Files

```
kebab-case.ts        ✅ Correct
PascalCase.ts        ❌ Wrong
snake_case.ts        ❌ Wrong
```

Examples:
- `bash-tool.ts` ❌ Use `bash.ts` instead
- `file-operations.ts` ✅
- `ClaudeClient.ts` ❌ Use `client.ts` instead

#### Classes

```typescript
// PascalCase for classes
class BashTool extends BaseTool { }        ✅
class CommandRegistry { }                  ✅
class bashTool { }                         ❌
class BASH_TOOL { }                        ❌
```

#### Interfaces & Types

```typescript
// PascalCase for interfaces and types
interface ToolDefinition { }               ✅
type HookEvent = 'PreToolUse' | ...;      ✅
interface toolInput { }                    ❌
type hook_config = { };                    ❌
```

#### Variables & Functions

```typescript
// camelCase for variables and functions
const toolRegistry = new ToolRegistry();   ✅
function executeHook(...) { }              ✅

const ToolRegistry = new ToolRegistry();   ❌ (wrong casing)
function ExecuteHook(...) { }              ❌ (wrong casing)
```

#### Constants

```typescript
// UPPER_SNAKE_CASE for constants
const MAX_OUTPUT_LENGTH = 30000;           ✅
const DEFAULT_TIMEOUT = 120000;            ✅

const maxOutputLength = 30000;             ❌
const defaultTimeout = 120000;             ❌
```

### 8.3 Import/Export Style

#### ES Modules (Always)

```typescript
// ✅ Correct - ES modules with .js extension
import { BaseTool } from './base.js';
import type { ToolDefinition } from '../types/index.js';
export { BashTool } from './bash.js';

// ❌ Wrong - CommonJS
const { BaseTool } = require('./base');
module.exports = { BashTool };

// ❌ Wrong - Missing .js extension
import { BaseTool } from './base';
```

#### Barrel Exports

```typescript
// src/tools/index.ts
export * from './base.js';
export * from './bash.js';
export * from './file.js';

// Other files can import from barrel
import { BashTool, ReadTool } from './tools/index.js';
```

#### Type Imports

```typescript
// Prefer type imports for types
import type { ToolDefinition, ToolResult } from '../types/index.js';

// Can also use inline type import
import { type ToolDefinition, BaseTool } from './base.js';
```

### 8.4 Comment Style

#### File Headers

```typescript
/**
 * Bash Tool
 * Executes shell commands with sandbox support
 */

import { spawn } from 'child_process';
// ...
```

#### Class Documentation

```typescript
/**
 * BaseTool abstract class
 * All tools extend this base class and implement execute()
 *
 * @template TInput - Input parameter type
 * @template TOutput - Output result type
 */
export abstract class BaseTool<TInput = unknown, TOutput extends ToolResult = ToolResult> {
  // ...
}
```

#### Function Documentation

```typescript
/**
 * Execute a hook with the given input
 *
 * @param hook - Hook configuration
 * @param input - Hook input data
 * @returns Promise resolving to hook result
 */
async function executeHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
  // ...
}
```

#### Inline Comments

```typescript
// Good: Explain WHY, not WHAT
// Use async/await to prevent blocking the event loop
const result = await fs.promises.readFile(path);

// Bad: Stating the obvious
// Read file
const result = await fs.promises.readFile(path);
```

#### TODOs

```typescript
// TODO: Add caching support
// FIXME: Handle edge case where input is undefined
// HACK: Temporary workaround until API is fixed
// NOTE: This is intentionally synchronous for consistency
```

### 8.5 Code Organization

#### Function Order

```typescript
export class MyClass {
  // 1. Static properties
  static readonly VERSION = '1.0.0';

  // 2. Instance properties
  private client: Client;
  public name: string;

  // 3. Constructor
  constructor(name: string) {
    this.name = name;
  }

  // 4. Public methods
  public doSomething() { }

  // 5. Private methods
  private helper() { }
}
```

#### File Size

- Keep files under 1000 lines
- Split large files into modules
- Use barrel exports to maintain simple imports

### 8.6 Error Handling

#### Async Functions

```typescript
// ✅ Correct - Always use try/catch
async function execute(input: Input): Promise<Result> {
  try {
    const result = await operation();
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ❌ Wrong - Unhandled promise rejection
async function execute(input: Input): Promise<Result> {
  const result = await operation();  // Can throw!
  return { success: true, result };
}
```

#### Error Messages

```typescript
// ✅ Helpful error messages
throw new Error(`File not found: ${path}\nPlease check the path and try again.`);

// ❌ Vague error messages
throw new Error('Error');
throw new Error('Something went wrong');
```

### 8.7 Testing Guidelines

#### Manual Testing Checklist

Before committing:

- [ ] Run `npm run build` successfully
- [ ] Run `npx tsc --noEmit` with no errors
- [ ] Test in development mode (`npm run dev`)
- [ ] Test compiled version (`npm run start`)
- [ ] Test with different models (opus, sonnet, haiku)
- [ ] Test error cases
- [ ] Test edge cases

#### Future: Automated Tests

```typescript
// Unit test structure (when implemented)
describe('BashTool', () => {
  describe('execute', () => {
    it('should execute valid commands', async () => {
      // Arrange
      const tool = new BashTool();
      const input = { command: 'echo test' };

      // Act
      const result = await tool.execute(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('should handle errors gracefully', async () => {
      // ...
    });
  });
});
```

### 8.8 Git Commit Messages

**Format:**

```
type(scope): short description

Longer explanation if needed.

Closes #123
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test changes
- `chore` - Build/tooling changes

**Examples:**

```
feat(tools): add JsonFormatter tool

Add new tool for formatting and validating JSON strings.
Supports custom indentation and key sorting.

Closes #456
```

```
fix(bash): handle timeout correctly

Fix issue where background processes weren't being
killed after timeout.
```

```
docs(development): add debugging section

Add comprehensive debugging guide including:
- Debug logging
- Session inspection
- API debugging
```

### 8.9 Code Review Checklist

Before submitting PR:

- [ ] Code follows naming conventions
- [ ] Imports use `.js` extensions
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Functions have JSDoc comments
- [ ] Error handling is comprehensive
- [ ] No console.log (use debug logger instead)
- [ ] No hardcoded paths or credentials
- [ ] Tests pass (when implemented)
- [ ] Documentation updated
- [ ] CLAUDE.md updated if needed
- [ ] Commit messages follow format

### 8.10 Performance Guidelines

#### Avoid Blocking Operations

```typescript
// ❌ Wrong - Blocks event loop
const data = fs.readFileSync(path);

// ✅ Correct - Non-blocking
const data = await fs.promises.readFile(path);
```

#### Use Appropriate Data Structures

```typescript
// ✅ Fast lookup - O(1)
const tools = new Map<string, Tool>();
const tool = tools.get(name);

// ❌ Slow lookup - O(n)
const tools = Array<Tool>();
const tool = tools.find(t => t.name === name);
```

#### Limit Output Size

```typescript
// ✅ Truncate large outputs
if (output.length > MAX_LENGTH) {
  output = output.substring(0, MAX_LENGTH) + '\n... [truncated]';
}

// ❌ Can cause memory issues
return { output: massiveString };
```

#### Cache When Appropriate

```typescript
// ✅ Cache expensive operations
private cache = new Map<string, Result>();

async compute(key: string): Promise<Result> {
  if (this.cache.has(key)) {
    return this.cache.get(key)!;
  }

  const result = await expensiveOperation(key);
  this.cache.set(key, result);
  return result;
}
```

---

## Appendix A: Quick Reference

### Common Commands

```bash
# Development
npm run dev                      # Run in dev mode
npm run build                    # Build TypeScript
npm run start                    # Run compiled version
npx tsc --noEmit                # Type check

# Debugging
DEBUG=claude:* npm run dev       # Full debug output
CLAUDE_LOG_LEVEL=debug npm run dev

# Installation
npm install                      # Install dependencies
npm link                         # Install globally
npm unlink -g claude-code-open  # Uninstall globally

# Session Management
cat ~/.claude/sessions/*.json   # View sessions
rm ~/.claude/sessions/*         # Clear all sessions
```

### File Locations

```
~/.claude/settings.json          # Global config
~/.claude/sessions/              # Session storage
.claude/settings.json            # Project config
.claude/hooks/                   # Project hooks
.claude/skills/                  # Project skills
```

### Environment Variables

```bash
ANTHROPIC_API_KEY               # API key (required)
CLAUDE_CONFIG_DIR               # Config directory
CLAUDE_LOG_LEVEL                # Logging level
DEBUG                           # Debug output
NODE_ENV                        # Environment
```

---

## Appendix B: Resources

### Documentation

- **Official Anthropic Docs:** https://docs.anthropic.com/
- **Claude API Reference:** https://docs.anthropic.com/en/api/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Node.js ESM:** https://nodejs.org/api/esm.html

### Tools & Libraries

- **Commander.js:** https://github.com/tj/commander.js
- **Ink (React for CLI):** https://github.com/vadimdemedes/ink
- **Tree-sitter:** https://tree-sitter.github.io/tree-sitter/
- **Zod (Schema Validation):** https://zod.dev/

### Community

- **GitHub Repository:** https://github.com/kill136/claude-code-open
- **Issues:** https://github.com/kill136/claude-code-open/issues
- **Discussions:** https://github.com/kill136/claude-code-open/discussions

---

## Appendix C: Glossary

**BaseTool** - Abstract class that all tools extend
**Barrel Export** - Re-exporting modules from index.ts
**Command** - Slash command like /help or /clear
**Context** - Conversation history and state
**Hook** - Script/URL callback triggered by events
**MCP** - Model Context Protocol for server integration
**Permission Mode** - Controls how file operations are approved
**Registry** - Central storage for tools/commands
**Session** - Persistent conversation state
**Skill** - Custom executable command
**Tool** - AI-callable function for specific tasks
**ToolRegistry** - Singleton managing all tools

---

**End of Developer Guide**

For questions or contributions, please visit:
https://github.com/kill136/claude-code-open

**Version:** 2.0.76
**Last Updated:** 2025-12-25
