# Claude Code Configuration Reference

Complete guide to configuring Claude Code CLI v2.0.76.

## Table of Contents

- [Configuration File Locations](#configuration-file-locations)
- [Environment Variables](#environment-variables)
- [Configuration Options](#configuration-options)
- [Complete Configuration Examples](#complete-configuration-examples)
- [Configuration Validation](#configuration-validation)
- [Migration Guide](#migration-guide)

---

## Configuration File Locations

Claude Code uses a layered configuration system with the following priority order:

```
Command-line arguments > Environment variables > Project config > Global config > Defaults
```

### Global Configuration

**Location:** `~/.claude/settings.json`

**Windows:** `%USERPROFILE%\.claude\settings.json`

The global configuration applies to all Claude Code sessions system-wide.

```bash
# Create global config directory
mkdir -p ~/.claude

# Create settings file
cat > ~/.claude/settings.json << 'EOF'
{
  "apiKey": "sk-ant-api03-xxx",
  "model": "sonnet",
  "maxTokens": 8192
}
EOF
```

### Project Configuration

**Location:** `.claude/settings.json` (in project root)

Project-specific settings override global configuration for that directory.

```bash
# Create project config directory
mkdir -p .claude

# Create project settings
cat > .claude/settings.json << 'EOF'
{
  "model": "opus",
  "systemPrompt": "You are a specialized assistant for this project"
}
EOF
```

### Configuration Directory Override

You can override the default configuration directory using the `CLAUDE_CONFIG_DIR` environment variable:

```bash
export CLAUDE_CONFIG_DIR="/custom/path/to/config"
```

### Priority Rules

When the same configuration option is set in multiple places:

1. **Command-line flags** (highest priority)
   ```bash
   claude -m opus --max-tokens 16384
   ```

2. **Environment variables**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-xxx"
   ```

3. **Project configuration** (`.claude/settings.json`)

4. **Global configuration** (`~/.claude/settings.json`)

5. **Default values** (lowest priority)

---

## Environment Variables

### API Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Primary API key variable | `sk-ant-api03-xxx` |
| `CLAUDE_API_KEY` | Alternative API key variable | `sk-ant-api03-xxx` |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for authentication | `eyJhbGc...` |

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"

# Or use alternative variable
export CLAUDE_API_KEY="sk-ant-api03-xxx"

# OAuth token (for subscription users)
export CLAUDE_CODE_OAUTH_TOKEN="eyJhbGc..."
```

### Backend Selection

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock backend | `false` |
| `CLAUDE_CODE_USE_VERTEX` | Use Google Vertex AI backend | `false` |
| `AWS_REGION` | AWS region for Bedrock | `us-east-1` |
| `ANTHROPIC_VERTEX_PROJECT_ID` | Google Cloud project ID | - |

```bash
# Use AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_REGION=us-west-2

# Use Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=true
export ANTHROPIC_VERTEX_PROJECT_ID=my-project-123
```

### Feature Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum tokens in response | `8192` |
| `CLAUDE_CODE_MAX_RETRIES` | Max API retry attempts | `3` |
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | Debug logs directory | - |
| `CLAUDE_CONFIG_DIR` | Config directory override | `~/.claude` |

```bash
# Increase token limit
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=16384

# Set retry limit
export CLAUDE_CODE_MAX_RETRIES=5

# Enable debug logging
export CLAUDE_CODE_DEBUG_LOGS_DIR=/var/log/claude
```

### Feature Toggles

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable usage telemetry | `false` |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | Disable file checkpoints | `false` |
| `CLAUDE_DEBUG` | Enable debug mode | - |
| `CLAUDE_SOLO_MODE` | Disable parallel execution | `false` |

```bash
# Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=true

# Disable file checkpointing
export CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING=true

# Debug mode with filtering
export CLAUDE_DEBUG="*"
export CLAUDE_DEBUG="mcp:*"  # Only MCP debug logs
```

---

## Configuration Options

### Core API Settings

```json
{
  "version": "2.0.76",
  "apiKey": "sk-ant-api03-xxx",
  "oauthToken": "eyJhbGc...",
  "useBedrock": false,
  "useVertex": false
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `"2.0.76"` | Configuration version (auto-managed) |
| `apiKey` | string | - | Anthropic API key |
| `oauthToken` | string | - | OAuth token for authenticated sessions |
| `useBedrock` | boolean | `false` | Use AWS Bedrock backend |
| `useVertex` | boolean | `false` | Use Google Vertex AI backend |

### Model Configuration

```json
{
  "model": "sonnet",
  "maxTokens": 8192,
  "temperature": 1,
  "fallbackModel": "haiku"
}
```

| Option | Type | Default | Values | Description |
|--------|------|---------|--------|-------------|
| `model` | string | `"sonnet"` | `opus`, `sonnet`, `haiku`, or full model ID | Default model to use |
| `maxTokens` | number | `8192` | `1`-`200000` | Maximum tokens in response |
| `temperature` | number | `1` | `0`-`1` | Sampling temperature |

**Supported Models:**
- `opus` → `claude-opus-4-5-20251101` (most capable)
- `sonnet` → `claude-sonnet-4-5-20250929` (balanced)
- `haiku` → `claude-haiku-4-5-20250924` (fastest)

You can also use full model IDs directly:
```json
{
  "model": "claude-sonnet-4-5-20250929"
}
```

### UI Settings

```json
{
  "theme": "auto",
  "verbose": false
}
```

| Option | Type | Default | Values | Description |
|--------|------|---------|--------|-------------|
| `theme` | string | `"auto"` | `dark`, `light`, `auto` | Terminal UI theme |
| `verbose` | boolean | `false` | - | Enable verbose output |

### Feature Flags

```json
{
  "enableTelemetry": false,
  "disableFileCheckpointing": false,
  "enableAutoSave": true
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableTelemetry` | boolean | `false` | Send anonymous usage telemetry |
| `disableFileCheckpointing` | boolean | `false` | Disable automatic file backups |
| `enableAutoSave` | boolean | `true` | Auto-save sessions |

### Advanced Settings

```json
{
  "maxRetries": 3,
  "requestTimeout": 300000,
  "maxConcurrentTasks": 10,
  "debugLogsDir": "/var/log/claude"
}
```

| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `maxRetries` | number | `3` | `0`-`10` | API request retry attempts |
| `requestTimeout` | number | `300000` | - | Request timeout (milliseconds) |
| `maxConcurrentTasks` | number | `10` | `1`-`100` | Max parallel operations |
| `debugLogsDir` | string | - | - | Debug log directory path |

### System Prompts

```json
{
  "systemPrompt": "Custom system prompt for all sessions",
  "defaultWorkingDir": "/home/user/projects"
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `systemPrompt` | string | - | Custom system prompt override |
| `defaultWorkingDir` | string | `process.cwd()` | Default working directory |

### Tool Filtering

```json
{
  "allowedTools": ["Bash", "Read", "Write", "Edit"],
  "disallowedTools": ["WebFetch", "WebSearch"]
}
```

| Option | Type | Description |
|--------|------|-------------|
| `allowedTools` | string[] | Whitelist of tool names (if set, only these tools are available) |
| `disallowedTools` | string[] | Blacklist of tool names (these tools are disabled) |

**Available Tools:**
- File Operations: `Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`
- Execution: `Bash`, `Sandbox`, `Tmux`
- Web: `WebFetch`, `WebSearch`
- Notebooks: `NotebookEdit`
- Organization: `TodoWrite`, `Task`, `Agent`
- Integration: `MCP`, `Skill`
- Search: `AskUser`

### Permissions Configuration

```json
{
  "permissions": {
    "tools": {
      "allow": ["Bash", "Read", "Write"],
      "deny": ["WebFetch"]
    },
    "paths": {
      "allow": ["/home/user/projects/**", "/tmp/**"],
      "deny": ["/etc/**", "/var/**", "~/.ssh/**"]
    },
    "commands": {
      "allow": ["git*", "npm*", "node*", "python*"],
      "deny": ["rm -rf*", "sudo*", "chmod*"]
    },
    "network": {
      "allow": ["*.github.com", "*.npmjs.com", "anthropic.com"],
      "deny": ["*"]
    },
    "audit": {
      "enabled": true,
      "logFile": "~/.claude/permissions-audit.log",
      "maxSize": 10485760
    }
  }
}
```

#### Tool Permissions

Control which tools can be executed:

```json
{
  "permissions": {
    "tools": {
      "allow": ["Bash", "Read", "Write", "Edit"],
      "deny": ["WebFetch", "WebSearch"]
    }
  }
}
```

- If `allow` is specified, only those tools are permitted
- `deny` takes precedence over `allow`
- Supports glob patterns: `"Web*"` matches `WebFetch` and `WebSearch`

#### Path Permissions

Control file system access with glob patterns:

```json
{
  "permissions": {
    "paths": {
      "allow": [
        "/home/user/projects/**",
        "~/Documents/**",
        "/tmp/**"
      ],
      "deny": [
        "/etc/**",
        "/var/**",
        "~/.ssh/**",
        "**/node_modules/**"
      ]
    }
  }
}
```

Pattern syntax:
- `**` matches any number of directories
- `*` matches any characters except `/`
- `?` matches a single character
- `[abc]` matches any character in the set

#### Command Permissions

Control Bash command execution:

```json
{
  "permissions": {
    "commands": {
      "allow": [
        "git*",
        "npm*",
        "node*",
        "python*",
        "ls",
        "cat",
        "grep"
      ],
      "deny": [
        "rm -rf*",
        "sudo*",
        "chmod*",
        "chown*",
        "dd*"
      ]
    }
  }
}
```

Commands are matched against both the full command and the command name.

#### Network Permissions

Control web requests:

```json
{
  "permissions": {
    "network": {
      "allow": [
        "*.github.com",
        "*.npmjs.com",
        "api.anthropic.com"
      ],
      "deny": ["*"]
    }
  }
}
```

Patterns match against domain names and full URLs.

#### Audit Logging

Track all permission decisions:

```json
{
  "permissions": {
    "audit": {
      "enabled": true,
      "logFile": "~/.claude/permissions-audit.log",
      "maxSize": 10485760
    }
  }
}
```

Audit log format (JSON Lines):
```json
{"timestamp":"2025-01-15T10:30:00Z","type":"file_write","tool":"Write","resource":"/home/user/file.txt","decision":"allow","reason":"Path allowed by config","scope":"always"}
```

### MCP Server Configuration

Model Context Protocol (MCP) servers extend Claude's capabilities.

#### stdio Server

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "env": {
        "DEBUG": "mcp:*"
      }
    }
  }
}
```

#### HTTP Server

```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-token",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

#### SSE Server

```json
{
  "mcpServers": {
    "events": {
      "type": "sse",
      "url": "http://localhost:3000/events",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**Common MCP Servers:**

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "postgresql": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      }
    },
    "google-drive": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"]
    }
  }
}
```

### Hooks Configuration

Hooks allow you to execute custom scripts or HTTP callbacks at specific lifecycle events.

#### Supported Events

- `PreToolUse` - Before tool execution
- `PostToolUse` - After successful tool execution
- `PostToolUseFailure` - After failed tool execution
- `SessionStart` - When session begins
- `SessionEnd` - When session ends
- `UserPromptSubmit` - When user submits a prompt
- `PreCompact` - Before context compression
- `PermissionRequest` - When permission is requested
- `Notification` - When notification is sent
- `Stop` - When stop signal is received
- `SubagentStart` - When sub-agent starts
- `SubagentStop` - When sub-agent stops

#### Command Hooks

Execute shell commands:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "echo",
        "args": ["Running tool: $TOOL_NAME"],
        "timeout": 5000,
        "blocking": false
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "/path/to/script.sh",
        "env": {
          "CUSTOM_VAR": "value"
        },
        "timeout": 30000,
        "blocking": true,
        "matcher": "Bash"
      }
    ]
  }
}
```

**Command Hook Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | - | Must be `"command"` |
| `command` | string | - | Command to execute |
| `args` | string[] | `[]` | Command arguments |
| `env` | object | `{}` | Environment variables |
| `timeout` | number | `30000` | Timeout in milliseconds |
| `blocking` | boolean | `true` | Wait for completion |
| `matcher` | string | - | Tool name or regex pattern to match |

**Environment Variables:**

Hooks receive event data via stdin (JSON) and environment variables:
- `CLAUDE_HOOK_EVENT` - Event name
- `CLAUDE_HOOK_TOOL_NAME` - Tool name (if applicable)
- `CLAUDE_HOOK_SESSION_ID` - Session ID

Variable substitution in command string:
- `$TOOL_NAME` - Tool name
- `$EVENT` - Event name
- `$SESSION_ID` - Session ID

#### URL Hooks

Send HTTP requests:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://example.com/webhook",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer your-token",
          "Content-Type": "application/json"
        },
        "timeout": 10000,
        "blocking": false
      }
    ]
  }
}
```

**URL Hook Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | - | Must be `"url"` |
| `url` | string | - | HTTP endpoint URL |
| `method` | string | `"POST"` | HTTP method (GET, POST, PUT, PATCH) |
| `headers` | object | `{}` | HTTP headers |
| `timeout` | number | `10000` | Timeout in milliseconds |
| `blocking` | boolean | `false` | Wait for response |
| `matcher` | string | - | Tool name or regex pattern |

**Payload Format:**

```json
{
  "event": "PostToolUse",
  "toolName": "Bash",
  "toolInput": {"command": "ls -la"},
  "toolOutput": "total 48...",
  "sessionId": "abc-123",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### Hook Blocking

Hooks can block operations by returning specific responses:

**Command Hook:**
```bash
#!/bin/bash
# Exit with non-zero and output JSON to block
echo '{"blocked": true, "message": "Operation not allowed"}'
exit 1
```

**URL Hook:**
```json
{
  "blocked": true,
  "message": "Policy violation detected"
}
```

#### Example: Git Commit Hook

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "git",
        "args": ["diff", "--check"],
        "matcher": "/git.*commit/",
        "blocking": true
      }
    ]
  }
}
```

#### Example: Audit Webhook

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://audit.company.com/api/log",
        "method": "POST",
        "headers": {
          "X-API-Key": "secret"
        },
        "blocking": false
      }
    ]
  }
}
```

---

## Complete Configuration Examples

### Minimal Configuration

```json
{
  "apiKey": "sk-ant-api03-xxx"
}
```

### Typical Development Setup

```json
{
  "apiKey": "sk-ant-api03-xxx",
  "model": "sonnet",
  "maxTokens": 8192,
  "verbose": true,
  "theme": "dark",
  "enableAutoSave": true,
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    }
  }
}
```

### Production Setup with Security

```json
{
  "apiKey": "sk-ant-api03-xxx",
  "model": "sonnet",
  "maxTokens": 8192,
  "maxRetries": 5,
  "requestTimeout": 300000,
  "permissions": {
    "tools": {
      "allow": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
      "deny": ["WebFetch", "WebSearch"]
    },
    "paths": {
      "allow": ["/home/user/projects/**"],
      "deny": ["/etc/**", "/var/**", "~/.ssh/**"]
    },
    "commands": {
      "allow": ["git*", "npm*", "node*"],
      "deny": ["rm -rf*", "sudo*"]
    },
    "audit": {
      "enabled": true,
      "logFile": "/var/log/claude-audit.log",
      "maxSize": 10485760
    }
  },
  "hooks": {
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://audit.company.com/api/log",
        "method": "POST",
        "headers": {
          "X-API-Key": "secret"
        }
      }
    ]
  }
}
```

### AWS Bedrock Configuration

```json
{
  "useBedrock": true,
  "model": "anthropic.claude-sonnet-4-20250514-v1:0",
  "maxTokens": 8192,
  "mcpServers": {
    "s3": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-s3"],
      "env": {
        "AWS_REGION": "us-west-2"
      }
    }
  }
}
```

Environment variables:
```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-west-2"
```

### Google Vertex AI Configuration

```json
{
  "useVertex": true,
  "model": "claude-sonnet-4@20250514",
  "maxTokens": 8192
}
```

Environment variables:
```bash
export ANTHROPIC_VERTEX_PROJECT_ID="my-project-123"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

### Team Project Configuration

```json
{
  "model": "opus",
  "systemPrompt": "You are a specialized assistant for this React project. Follow our coding standards in CONTRIBUTING.md.",
  "maxTokens": 16384,
  "allowedTools": [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "NotebookEdit"
  ],
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  },
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "npm",
        "args": ["run", "lint-staged"],
        "matcher": "/Write|Edit/",
        "blocking": true
      }
    ]
  }
}
```

### Multi-MCP Server Setup

```json
{
  "apiKey": "sk-ant-api03-xxx",
  "model": "sonnet",
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://localhost/mydb"
      }
    },
    "api": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

---

## Configuration Validation

### Using the CLI

Check configuration validity:

```bash
# Using the doctor command
claude doctor

# Using the provider command
claude provider
```

### Programmatic Validation

```typescript
import { configManager } from './src/config/index.js';

// Validate current configuration
const { valid, errors } = configManager.validate();

if (!valid) {
  console.error('Configuration errors:');
  errors?.issues.forEach(issue => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
} else {
  console.log('Configuration is valid!');
}
```

### Common Validation Errors

#### Invalid Model Name

```json
{
  "model": "invalid-model"  // ❌ Error
}
```

**Fix:**
```json
{
  "model": "sonnet"  // ✓ Valid
}
```

#### maxTokens Out of Range

```json
{
  "maxTokens": 300000  // ❌ Error: exceeds 200000
}
```

**Fix:**
```json
{
  "maxTokens": 16384  // ✓ Valid
}
```

#### Invalid MCP Server Config

```json
{
  "mcpServers": {
    "invalid": {
      "type": "stdio"
      // ❌ Missing required 'command' field
    }
  }
}
```

**Fix:**
```json
{
  "mcpServers": {
    "valid": {
      "type": "stdio",
      "command": "npx"  // ✓ Valid
    }
  }
}
```

#### Invalid Temperature

```json
{
  "temperature": 2  // ❌ Error: must be 0-1
}
```

**Fix:**
```json
{
  "temperature": 0.7  // ✓ Valid
}
```

### Schema Reference

The configuration uses Zod schema validation. Key constraints:

- `model`: Must be one of: `opus`, `sonnet`, `haiku`, or full model ID
- `maxTokens`: Integer, 1-200000
- `temperature`: Float, 0-1
- `maxRetries`: Integer, 0-10
- `maxConcurrentTasks`: Integer, 1-100
- `theme`: Must be `dark`, `light`, or `auto`

---

## Migration Guide

### Automatic Migration

Claude Code automatically migrates older configuration formats when loading.

### Version 1.x to 2.0

**Old format:**
```json
{
  "model": "claude-3-opus",
  "autoSave": true
}
```

**Automatically migrated to:**
```json
{
  "version": "2.0.76",
  "model": "opus",
  "enableAutoSave": true
}
```

### Model Name Changes

| Old Name | New Name |
|----------|----------|
| `claude-3-opus` | `opus` |
| `claude-3-sonnet` | `sonnet` |
| `claude-3-haiku` | `haiku` |
| `claude-opus-4-20250514` | `opus` or use full ID |

### Configuration Field Renames

| Old Field | New Field |
|-----------|-----------|
| `autoSave` | `enableAutoSave` |
| `telemetry` | `enableTelemetry` |
| `fileCheckpointing` | `disableFileCheckpointing` (inverted) |

### Hook Configuration Format

**Old format (deprecated):**
```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "command": "echo",
      "args": ["test"]
    }
  ]
}
```

**New format:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "echo",
        "args": ["test"]
      }
    ]
  }
}
```

### Manual Migration Steps

1. **Backup current configuration:**
   ```bash
   cp ~/.claude/settings.json ~/.claude/settings.json.backup
   ```

2. **Export current settings:**
   ```typescript
   import { configManager } from './src/config/index.js';
   const backup = configManager.export(false);
   fs.writeFileSync('config-backup.json', backup);
   ```

3. **Update configuration:**
   - Replace old model names
   - Rename changed fields
   - Update hook format
   - Add version field

4. **Validate new configuration:**
   ```bash
   claude doctor
   ```

5. **Test configuration:**
   ```bash
   claude -p "test message"
   ```

### Rollback

If migration causes issues:

```bash
# Restore backup
cp ~/.claude/settings.json.backup ~/.claude/settings.json

# Or reset to defaults
rm ~/.claude/settings.json
claude doctor
```

### Configuration Import/Export

**Export configuration (with secrets masked):**
```typescript
import { configManager } from './src/config/index.js';
const exportData = configManager.export(true);  // Masks secrets
fs.writeFileSync('config-export.json', exportData);
```

**Import configuration:**
```typescript
import { configManager } from './src/config/index.js';
const configData = fs.readFileSync('config-export.json', 'utf-8');
const success = configManager.import(configData);
```

---

## Troubleshooting

### Configuration Not Loading

**Symptoms:** Changes to `settings.json` don't take effect

**Solutions:**
1. Check file path: `~/.claude/settings.json`
2. Verify JSON syntax: `jq . ~/.claude/settings.json`
3. Check file permissions: `ls -la ~/.claude/settings.json`
4. Reload manually:
   ```typescript
   configManager.reload();
   ```

### API Key Not Found

**Symptoms:** "API key not configured" error

**Solutions:**
1. Check environment variable: `echo $ANTHROPIC_API_KEY`
2. Check config file: `cat ~/.claude/settings.json | jq .apiKey`
3. Set via command: `claude setup-token`

### MCP Server Not Starting

**Symptoms:** MCP server connection failures

**Solutions:**
1. Verify command exists: `which npx`
2. Test command manually:
   ```bash
   npx -y @modelcontextprotocol/server-filesystem /path
   ```
3. Check environment variables
4. Enable debug logging:
   ```bash
   export CLAUDE_DEBUG="mcp:*"
   ```

### Permission Denied Errors

**Symptoms:** Operations blocked by permission system

**Solutions:**
1. Check permission config in `settings.json`
2. Review audit log: `~/.claude/permissions-audit.log`
3. Use bypass mode for testing:
   ```bash
   claude --dangerously-skip-permissions
   ```
4. Adjust permission rules:
   ```json
   {
     "permissions": {
       "paths": {
         "allow": ["/your/project/path/**"]
       }
     }
   }
   ```

### Debug Mode

Enable comprehensive debug output:

```bash
# All debug logs
export CLAUDE_DEBUG="*"

# Specific categories
export CLAUDE_DEBUG="config:*,mcp:*"
export CLAUDE_DEBUG="hooks:*,permissions:*"
```

---

## Related Documentation

- [Quick Reference](./config-quick-reference.md) - Common tasks and examples
- [Hooks System](./HOOKS.md) - Detailed hook documentation
- [Permissions Guide](./permissions-guide.md) - Permission system guide
- [MCP Integration](../src/mcp/README.md) - MCP server documentation
- [CLAUDE.md](../CLAUDE.md) - Project overview

---

## Configuration Schema (TypeScript)

For reference, the complete TypeScript configuration interface:

```typescript
interface UserConfig {
  // Version
  version?: string;

  // API Configuration
  apiKey?: string;
  model?: 'opus' | 'sonnet' | 'haiku' | string;
  maxTokens?: number;
  temperature?: number;
  oauthToken?: string;
  useBedrock?: boolean;
  useVertex?: boolean;

  // Feature Flags
  enableTelemetry?: boolean;
  disableFileCheckpointing?: boolean;
  enableAutoSave?: boolean;
  verbose?: boolean;

  // UI Settings
  theme?: 'dark' | 'light' | 'auto';

  // Advanced Settings
  maxRetries?: number;
  requestTimeout?: number;
  maxConcurrentTasks?: number;
  debugLogsDir?: string;
  defaultWorkingDir?: string;
  systemPrompt?: string;

  // Tool Filtering
  allowedTools?: string[];
  disallowedTools?: string[];

  // MCP Servers
  mcpServers?: Record<string, McpServerConfig>;

  // Permissions
  permissions?: PermissionConfig;
}
```

---

**Last Updated:** 2025-01-15
**Version:** 2.0.76
**File:** `/home/user/claude-code-open/docs/config.md`
