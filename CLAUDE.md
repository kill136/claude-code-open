# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
你的编程搭子是中国人，记得用中文回复
## Project Overview

This is an educational reverse-engineering project that recreates Claude Code CLI v2.0.76. It's a TypeScript-based terminal application that provides an AI assistant with 25+ tools for file operations, code analysis, web access, and system commands.
官方源码路径：\node_modules\@anthropic-ai\claude-code
**Important:** This is NOT the official Claude Code source - it's a learning project based on public APIs and type definitions.

## Development Commands

### Building and Running
```bash
# Development mode (live TypeScript execution)
npm run dev

# Build TypeScript to dist/
npm run build

# Run compiled version
npm run start
# or
node dist/cli.js

# Type checking without compiling
npx tsc --noEmit

# Install globally (optional)
npm link
```

### CLI Usage
```bash
# Interactive mode
node dist/cli.js

# With initial prompt
node dist/cli.js "Analyze this codebase"

# Print mode (non-interactive)
node dist/cli.js -p "Explain this code"

# Specify model
node dist/cli.js -m opus "Complex task"
node dist/cli.js -m haiku "Simple task"

# Resume last session
node dist/cli.js --resume
```

## Architecture Overview

### Core Three-Layer Design

1. **Entry Layer** (`src/cli.ts`, `src/index.ts`)
   - CLI argument parsing with Commander.js
   - Main export barrel file

2. **Core Engine** (`src/core/`)
   - `client.ts` - Anthropic API wrapper with retry logic, token counting, cost calculation
   - `session.ts` - Session state management, message history, cost tracking
   - `loop.ts` - Main conversation orchestrator, handles tool filtering and multi-turn dialogues

3. **Tool System** (`src/tools/`)
   - All tools extend `BaseTool` and register in `ToolRegistry`
   - 25 tools including: Bash, Read, Write, Edit, MultiEdit, Glob, Grep, WebFetch, WebSearch, TodoWrite, Task, NotebookEdit, MCP integration, Tmux, Skills, etc.

### Key Data Flow

```
CLI Input → ConversationLoop → ClaudeClient (Anthropic API)
                ↓                      ↓
           ToolRegistry           Session State
                ↓                      ↓
          Tool Execution    Session Persistence (~/.claude/sessions/)
```

### Important Subsystems

- **Session Management** (`src/session/`) - Persists conversations to `~/.claude/sessions/` with 30-day expiry
- **Configuration** (`src/config/`) - Loads from `~/.claude/settings.json` and environment variables
- **Context Management** (`src/context/`) - Token estimation, auto-summarization when hitting limits
- **Hooks System** (`src/hooks/`) - Pre/post tool execution hooks for customization
- **Plugin System** (`src/plugins/`) - Extensible plugin architecture
- **UI Components** (`src/ui/`) - React + Ink terminal UI framework
- **Code Parser** (`src/parser/`) - Tree-sitter WASM for multi-language parsing
- **Ripgrep** (`src/search/ripgrep.ts`) - Vendored ripgrep binary support
- **Streaming I/O** (`src/streaming/`) - JSON message streaming for Claude API

## TypeScript Configuration Notes

- **Target:** ES2022
- **Module System:** NodeNext (ES Modules with `import`/`export`)
- **Strict Mode:** Enabled
- **JSX:** React (for Ink UI components)
- **Output:** `dist/` directory with source maps and declaration files

## Configuration Locations

- **API Key:** Environment variables (`ANTHROPIC_API_KEY` or `CLAUDE_API_KEY`) or `~/.claude/settings.json`
- **Sessions:** `~/.claude/sessions/` (JSON files)
- **MCP Servers:** Defined in `~/.claude/settings.json`
- **Skills:** `~/.claude/skills/` and `./.claude/commands/`
- **Plugins:** `~/.claude/plugins/` and `./.claude/plugins/`

### Environment Variables

- **`ANTHROPIC_API_KEY` / `CLAUDE_API_KEY`** - API key for Claude
- **`USE_BUILTIN_RIPGREP`** - Control ripgrep selection behavior:
  - When set to `1`, `true`, `yes`, or `on`: Use system ripgrep (from PATH)
  - When unset or set to other values: Use vendored (built-in) ripgrep (default)
  - Fallback: If preferred version is unavailable, automatically fall back to the alternative

### Windows-Specific Notes

- Config path: `%USERPROFILE%\.claude\` instead of `~/.claude/`
- Environment variables: Use `set` (CMD) or `$env:` (PowerShell) instead of `export`
- Bubblewrap sandbox: Linux-only (Windows users need WSL or run without sandboxing)
- Tmux: Linux/macOS only (Windows alternative: Windows Terminal with tabs/panes)
- Hook scripts: Use `.bat` or `.ps1` instead of `.sh`
- JSON paths: Use double backslashes (e.g., `"C:\\Users\\user\\projects"`)

## Key Design Patterns

- **Registry Pattern** - `ToolRegistry` for dynamic tool management
- **Plugin Pattern** - `PluginManager` with lifecycle hooks
- **Strategy Pattern** - Multiple permission modes (acceptEdits, bypassPermissions, plan)
- **Observer Pattern** - Event-driven hook system
- **Factory Pattern** - Tool instantiation and registration

## Tool System Architecture

Tools are the core of the application. Each tool:
1. Extends `BaseTool` class
2. Defines input schema with Zod
3. Implements `execute()` method
4. Registers in `ToolRegistry`
5. Can be filtered via allow/disallow lists

Tools communicate results back to the conversation loop, which feeds them to the Claude API for the next turn.

## Session Persistence

Sessions are automatically saved to disk with:
- Unique UUID identifiers
- Complete message history
- Token and cost tracking
- Working directory context
- Metadata (model, timestamps)
- 30-day expiration

Sessions can be resumed via `--resume` flag or session ID.

## Platform Compatibility

The codebase targets Node.js 18+ and has been designed with cross-platform support:
- Core functionality works on Windows, macOS, and Linux
- Some features (Bubblewrap sandbox, Tmux) are platform-specific
- Use WASM fallbacks for native modules when unavailable
- Path handling should be cross-platform aware

## Dependencies to Know

**Critical:**
- `@anthropic-ai/sdk` - Claude API client
- `commander` - CLI framework
- `react` + `ink` - Terminal UI
- `tree-sitter` + `tree-sitter-wasms` - Code parsing
- `zod` - Schema validation

**Supporting:**
- `axios` - HTTP requests (WebFetch)
- `cheerio` - HTML parsing
- `glob` - File pattern matching
- `chalk` - Terminal colors
- `marked` - Markdown rendering
- `uuid` - Session IDs

## Module Resolution

This project uses ES Modules (`"type": "module"` in package.json):
- Use `import`/`export` syntax
- File extensions in imports follow Node.js ESM rules
- `tsconfig.json` uses `"module": "NodeNext"` for proper resolution

## Testing Notes

Currently, there's no formal test suite. When testing manually:
- Use `npm run dev` for quick iteration
- Test tools individually through the CLI
- Check session persistence in `~/.claude/sessions/`
- Verify API key configuration before running
- Test with different models (opus, sonnet, haiku)
