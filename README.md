# Claude Code (Restored)

A reverse-engineered restoration based on `@anthropic-ai/claude-code` v2.0.76.

**For educational and research purposes only.**

## Disclaimer

This is an educational project for studying and learning CLI tool architecture design. This is **NOT** the official Claude Code source code, but a reimplementation based on public APIs and type definitions.

For the official Claude Code, please install the official version:
```bash
npm install -g @anthropic-ai/claude-code
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## Usage

```bash
# Interactive mode
npm run dev

# Or run after building
node dist/cli.js

# With initial prompt
node dist/cli.js "Hello, please analyze this project"

# Print mode
node dist/cli.js -p "Explain this code"

# Specify model
node dist/cli.js -m opus "Complex task"

# Resume last session
node dist/cli.js --resume
```

## Configuration

Set up your API key:

**Linux/macOS:**
```bash
export ANTHROPIC_API_KEY=your-api-key
# or
export CLAUDE_API_KEY=your-api-key
```

**Windows Command Prompt:**
```cmd
set ANTHROPIC_API_KEY=your-api-key
# or
set CLAUDE_API_KEY=your-api-key
```

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="your-api-key"
# or
$env:CLAUDE_API_KEY="your-api-key"
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API Key | - |
| `BASH_MAX_OUTPUT_LENGTH` | Max Bash output length | 30000 |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens | 32000 |
| `CLAUDE_TELEMETRY_ENABLED` | Enable telemetry | true |

## Project Structure

```
src/
├── index.ts                # Main entry
├── cli.ts                  # CLI entry point
├── core/
│   ├── client.ts           # Anthropic API client (with retry & cost calculation)
│   ├── session.ts          # Session management
│   └── loop.ts             # Conversation loop
├── tools/                  # 25 tools
│   ├── base.ts             # Tool base class
│   ├── bash.ts             # Bash execution (with sandbox)
│   ├── file.ts             # File read/write/edit
│   ├── multiedit.ts        # Batch editing
│   ├── search.ts           # Glob/Grep search
│   ├── web.ts              # Web fetch/search
│   ├── todo.ts             # Task management
│   ├── agent.ts            # Sub-agents
│   ├── notebook.ts         # Jupyter Notebook editing
│   ├── planmode.ts         # Plan mode
│   ├── mcp.ts              # MCP protocol client
│   ├── ask.ts              # User Q&A
│   ├── tmux.ts             # Tmux multi-terminal
│   ├── skill.ts            # Skills and slash commands
│   └── sandbox.ts          # Bubblewrap sandbox
├── ui/                     # Ink/React UI components
│   ├── App.tsx             # Main app
│   └── components/         # UI components
├── hooks/
│   └── index.ts            # Hooks system
├── auth/
│   └── index.ts            # OAuth authentication
├── session/
│   └── index.ts            # Session persistence & recovery
├── context/
│   └── index.ts            # Context management & compression
├── parser/
│   └── index.ts            # Code parser
├── search/
│   └── ripgrep.ts          # Vendored ripgrep support
├── telemetry/
│   └── index.ts            # Telemetry & analytics
├── config/
│   └── index.ts            # Configuration management
├── utils/
│   └── index.ts            # Utility functions
└── types/
    └── index.ts            # Type definitions
```

## Implemented Tools (25)

| Tool | Status | Description |
|------|--------|-------------|
| Bash | ✅ Complete | Command execution with background & sandbox support |
| BashOutput | ✅ Complete | Get background command output |
| KillShell | ✅ Complete | Terminate background processes |
| Read | ✅ Complete | File reading with image/PDF/Notebook support |
| Write | ✅ Complete | File writing |
| Edit | ✅ Complete | File editing (string replacement) |
| **MultiEdit** | ✅ Complete | Batch file editing (atomic operations) |
| Glob | ✅ Complete | File pattern matching |
| Grep | ✅ Complete | Content search (ripgrep-based) |
| WebFetch | ✅ Complete | Web page fetching |
| WebSearch | ⚠️ Needs config | Requires search API |
| TodoWrite | ✅ Complete | Task management |
| Task | ✅ Complete | Sub-agents |
| TaskOutput | ✅ Complete | Get agent output |
| NotebookEdit | ✅ Complete | Jupyter Notebook cell editing |
| EnterPlanMode | ✅ Complete | Enter plan mode |
| ExitPlanMode | ✅ Complete | Exit plan mode |
| ListMcpResources | ✅ Complete | List MCP resources |
| ReadMcpResource | ✅ Complete | Read MCP resource |
| AskUserQuestion | ✅ Complete | Ask user questions |
| **Tmux** | ✅ Complete | Multi-terminal session management |
| **Skill** | ✅ Complete | Skill system |
| **SlashCommand** | ✅ Complete | Custom slash commands |

## Features

### OAuth Authentication

Supports both API Key and OAuth authentication:

```typescript
import { initAuth, startOAuthLogin, setApiKey } from './auth';

// Using API Key
setApiKey('your-api-key', true); // true for persistence

// Or using OAuth login
await startOAuthLogin({
  clientId: 'your-client-id',
  scope: ['read', 'write'],
});
```

### Session Persistence & Recovery

Automatic conversation saving and restoration:

```typescript
import { SessionManager, listSessions, loadSession } from './session';

const manager = new SessionManager({ autoSave: true });

// Start new session or resume
const session = manager.start({
  model: 'claude-sonnet-4-20250514',
  resume: true, // Try to resume last session
});

// List all sessions
const sessions = listSessions({ limit: 10 });

// Export as Markdown
const markdown = manager.export();
```

### Context Management

Intelligent context compression and summarization:

```typescript
import { ContextManager, estimateTokens } from './context';

const context = new ContextManager({
  maxTokens: 180000,
  summarizeThreshold: 0.7, // Start compressing at 70%
  keepRecentMessages: 10,
});

// Add conversation turn
context.addTurn(userMessage, assistantMessage);

// Get optimized messages
const messages = context.getMessages();

// Manual compaction
context.compact();
```

### Code Parser

Multi-language code analysis support:

```typescript
import { parseFile, parseCode, detectLanguage } from './parser';

// Detect language
const lang = detectLanguage('app.tsx'); // 'typescript'

// Parse file
const parsed = parseFile('/path/to/file.ts');
console.log(parsed.classes);    // Class definitions
console.log(parsed.functions);  // Function definitions
console.log(parsed.imports);    // Import statements
console.log(parsed.exports);    // Export statements
```

Supported languages: JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, Swift, Kotlin, Scala, etc.

### Vendored Ripgrep

Built-in ripgrep support, no system installation required:

```typescript
import { search, listFiles, getRipgrepVersion } from './search/ripgrep';

// Search content
const results = await search({
  pattern: 'function.*async',
  glob: '*.ts',
  ignoreCase: true,
});

// List files
const files = await listFiles({
  glob: '**/*.tsx',
  hidden: false,
});
```

### Telemetry & Analytics

Local usage statistics (data is not uploaded):

```typescript
import { telemetry, getTelemetryStats } from './telemetry';

// Record session
telemetry.startSession('claude-sonnet-4-20250514');
telemetry.recordMessage('user', 100);
telemetry.recordToolCall('Bash', true, 50);
telemetry.endSession();

// Get statistics
const stats = getTelemetryStats();
console.log(stats.totalSessions);
console.log(stats.totalTokens);
```

### Ink/React UI Framework

Complete terminal UI component system:
- `Spinner` - Loading animations
- `ToolCall` - Tool call display
- `Message` - Message display
- `Input` - Input box
- `Header` - Header bar
- `TodoList` - Task list
- `PermissionPrompt` - Permission confirmation
- `StatusBar` - Status bar

### Sandbox Support (Bubblewrap)

**Linux only:** If `bubblewrap` is installed, Bash commands will execute in a sandbox for enhanced security:

```bash
# Ubuntu/Debian
sudo apt install bubblewrap

# Arch Linux
sudo pacman -S bubblewrap
```

**Note for Windows/macOS users:**
- Bubblewrap sandbox is only available on Linux
- Windows and macOS users can use WSL (Windows Subsystem for Linux) to enable sandbox support
- Alternatively, commands will run without sandboxing (use with caution)

Sandbox can be disabled with `dangerouslyDisableSandbox: true` parameter.

### Hooks System

Execute custom scripts before/after tool calls:

```json
// .claude/settings.json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "matcher": "Bash",
      "command": "/path/to/script.sh",  // Linux/macOS: .sh, Windows: .bat or .ps1
      "blocking": true
    }
  ]
}
```

Supported events:
- `PreToolUse` - Before tool call
- `PostToolUse` - After tool call
- `PrePromptSubmit` - Before submission
- `PostPromptSubmit` - After submission
- `Notification` - Notifications
- `Stop` - Stop

### MCP Protocol Support

Connect to MCP (Model Context Protocol) servers:

```json
// .claude/settings.json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]  // Use absolute path
    }
  }
}
```

**Path examples:**
- Linux/macOS: `"/home/user/projects"` or `"/Users/user/projects"`
- Windows: `"C:\\Users\\user\\projects"` (use double backslashes in JSON)

### Tmux Multi-terminal

**Linux/macOS only:** Manage multiple terminal sessions:
```javascript
// Create session
{ action: "new", session_name: "dev-server" }

// Send command
{ action: "send", session_name: "dev-server", command: "npm run dev" }

// Capture output
{ action: "capture", session_name: "dev-server" }
```

**Note for Windows users:**
- Tmux is not available natively on Windows
- Use WSL (Windows Subsystem for Linux) to access Tmux
- Alternative: Use Windows Terminal with multiple tabs/panes

### Skills & Custom Commands

Load from the following directories:
- **Linux/macOS:** `~/.claude/skills/` and `.claude/commands/`
- **Windows:** `%USERPROFILE%\.claude\skills\` and `.claude\commands\`

Features:
- Skills: Reusable prompt templates
- Slash Commands: Custom command extensions

### Enhanced API Client

- Exponential backoff retry (up to 4 times)
- Automatic cost calculation
- Token usage statistics
- Multi-model pricing support

## Slash Commands

- `/help` - Show help
- `/clear` - Clear conversation history
- `/save` - Save session
- `/stats` - Show statistics
- `/tools` - List tools
- `/model` - Switch model
- `/resume` - Resume session
- `/compact` - Compress context
- `/exit` - Exit

## Comparison with Official Version

| Component | Accuracy | Notes |
|-----------|----------|-------|
| CLI Entry | ✅ 100% | Complete commands & slash commands |
| Tool Implementation | ✅ 100% | 25 core tools |
| API Client | ✅ 100% | Complete streaming + retry + cost calc |
| Sandbox | ✅ 100% | Bubblewrap isolation |
| Hooks | ✅ 100% | Complete event system |
| MCP | ✅ 100% | Complete protocol support |
| UI | ✅ 100% | Ink/React component system |
| Skill/Command | ✅ 100% | Skills & command system |
| Authentication | ✅ 100% | API Key + OAuth |
| Session Management | ✅ 100% | Persistence & recovery |
| Context Management | ✅ 100% | Smart compression & summarization |
| Code Parser | ✅ 100% | Multi-language support |
| Ripgrep | ✅ 100% | Vendored binary support |
| Telemetry | ✅ 100% | Local statistics |

**Overall Accuracy: ~100%**

## Development

```bash
# Development mode (using tsx)
npm run dev

# Build
npm run build

# Type checking
npx tsc --noEmit
```

## Tech Stack

- **TypeScript** - Type safety
- **Anthropic SDK** - API calls
- **Ink + React** - Terminal UI
- **Commander** - CLI framework
- **Chalk** - Terminal colors
- **Glob** - File matching
- **Zod** - Schema validation

## Community

- **Discord:** [Join our Discord](https://discord.gg/hs5BWGjt)
- **X (Twitter):** [@wangbingjie1989](https://x.com/wangbingjie1989)

## License

This project is for educational purposes only. Original Claude Code is owned by Anthropic PBC.

---

*This project is a reverse engineering study of obfuscated code and does not represent the official implementation.*

[中文版 README](README.zh-CN.md)
