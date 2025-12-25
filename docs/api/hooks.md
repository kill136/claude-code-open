# Hooks API Documentation

Complete reference for the Claude Code hooks system.

## Table of Contents

- [Overview](#overview)
- [Hook Events](#hook-events)
- [Hook Types](#hook-types)
- [Hook Configuration](#hook-configuration)
- [Registering Hooks](#registering-hooks)
- [Hook Execution](#hook-execution)
- [Helper Functions](#helper-functions)
- [Configuration Formats](#configuration-formats)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)

---

## Overview

The hooks system allows you to execute custom scripts or HTTP callbacks at specific points in the Claude Code execution lifecycle. Hooks can be used for:

- **Validation**: Check preconditions before tool execution
- **Logging**: Record tool usage and outcomes
- **Integration**: Notify external systems of events
- **Security**: Audit and control tool execution
- **Workflow**: Trigger automated processes

### Key Features

- **12 hook event types** covering the entire lifecycle
- **2 hook types**: Command (local scripts) and URL (HTTP callbacks)
- **Pattern matching** for selective hook execution
- **Blocking/non-blocking** modes
- **Environment variable** substitution
- **JSON input/output** via stdin/stdout
- **Timeout control** with configurable limits
- **Backward compatibility** with legacy format

---

## Hook Events

### Event Types

```typescript
type HookEvent =
  | 'PreToolUse'           // Before tool execution
  | 'PostToolUse'          // After successful tool execution
  | 'PostToolUseFailure'   // After failed tool execution
  | 'Notification'         // When sending notifications
  | 'UserPromptSubmit'     // When user submits a prompt
  | 'SessionStart'         // When session begins
  | 'SessionEnd'           // When session ends
  | 'Stop'                 // When execution stops
  | 'SubagentStart'        // When sub-agent starts
  | 'SubagentStop'         // When sub-agent stops
  | 'PreCompact'           // Before context compression
  | 'PermissionRequest';   // When permissions are requested
```

### Event Lifecycle

```
User Input → UserPromptSubmit
    ↓
SessionStart (if new session)
    ↓
PreToolUse → Tool Execution → PostToolUse (success)
    ↓                             ↓
    └─────────────────→ PostToolUseFailure (failure)
    ↓
SubagentStart → Agent Execution → SubagentStop
    ↓
PreCompact → Context Compression
    ↓
PermissionRequest (if needed)
    ↓
Stop → SessionEnd
```

### Event Details

#### PreToolUse

Fired **before** a tool is executed.

**Use Cases:**
- Validate tool inputs
- Block dangerous operations
- Log tool execution attempts
- Modify tool behavior

**Hook Input:**
```typescript
{
  event: 'PreToolUse',
  toolName: string,        // Tool being executed
  toolInput: unknown,      // Tool input parameters
  sessionId?: string
}
```

**Blocking Capability:** Yes (return `{ blocked: true, message: '...' }`)

**Example:**
```json
{
  "hooks": {
    "PreToolUse": [{
      "type": "command",
      "command": "./validate-tool.sh",
      "blocking": true,
      "matcher": "Bash"
    }]
  }
}
```

#### PostToolUse

Fired **after** successful tool execution.

**Use Cases:**
- Log successful executions
- Send notifications
- Trigger follow-up actions
- Update metrics

**Hook Input:**
```typescript
{
  event: 'PostToolUse',
  toolName: string,
  toolInput: unknown,
  toolOutput: string,      // Tool execution result
  sessionId?: string
}
```

**Blocking Capability:** No

#### PostToolUseFailure

Fired **after** failed tool execution.

**Use Cases:**
- Log errors
- Alert on failures
- Trigger error recovery
- Update failure metrics

**Hook Input:**
```typescript
{
  event: 'PostToolUseFailure',
  toolName: string,
  toolInput: unknown,
  message: string,         // Error message
  sessionId?: string
}
```

#### UserPromptSubmit

Fired when user submits a prompt.

**Use Cases:**
- Validate user input
- Block inappropriate content
- Log user interactions
- Implement content filtering

**Hook Input:**
```typescript
{
  event: 'UserPromptSubmit',
  message: string,         // User's prompt
  sessionId?: string
}
```

**Blocking Capability:** Yes

#### SessionStart

Fired when a new session begins.

**Use Cases:**
- Initialize session resources
- Set up logging
- Validate environment
- Send session start notifications

**Hook Input:**
```typescript
{
  event: 'SessionStart',
  sessionId: string
}
```

#### SessionEnd

Fired when a session ends.

**Use Cases:**
- Clean up resources
- Save session data
- Generate session reports
- Send completion notifications

**Hook Input:**
```typescript
{
  event: 'SessionEnd',
  sessionId: string
}
```

#### PreCompact

Fired before context compression (when token limit is approaching).

**Use Cases:**
- Block compression
- Log compression events
- Trigger manual cleanup
- Save context before compression

**Hook Input:**
```typescript
{
  event: 'PreCompact',
  message?: string,        // e.g., "Current tokens: 95000"
  sessionId?: string
}
```

**Blocking Capability:** Yes

#### PermissionRequest

Fired when a permission decision is needed.

**Use Cases:**
- Auto-approve/deny based on policy
- Log permission requests
- Implement custom permission logic
- Integrate with external auth systems

**Hook Input:**
```typescript
{
  event: 'PermissionRequest',
  toolName: string,
  toolInput: unknown,
  sessionId?: string
}
```

**Hook Response:**
```json
{
  "decision": "allow" | "deny",
  "message": "Optional explanation"
}
```

#### SubagentStart / SubagentStop

Fired when sub-agents (background tasks/agents) start or stop.

**Use Cases:**
- Track agent lifecycle
- Limit concurrent agents
- Monitor resource usage
- Log agent execution

**Hook Input:**
```typescript
{
  event: 'SubagentStart' | 'SubagentStop',
  toolName: string,        // Agent type
  sessionId?: string
}
```

#### Notification / Stop

Generic events for notifications and stop signals.

---

## Hook Types

### Command Hooks

Execute local scripts or commands.

```typescript
interface CommandHookConfig {
  type: 'command';
  command: string;         // Command to execute
  args?: string[];         // Command arguments
  env?: Record<string, string>;  // Environment variables
  timeout?: number;        // Timeout in ms (default: 30000)
  blocking?: boolean;      // Wait for completion (default: true)
  matcher?: string;        // Tool name or regex pattern
}
```

**Features:**
- Executed via shell
- JSON input via stdin
- JSON output via stdout
- Environment variable substitution
- Configurable timeout
- Exit code handling

**Example:**
```json
{
  "hooks": {
    "PreToolUse": [{
      "type": "command",
      "command": "/usr/local/bin/validate-bash.sh",
      "args": ["--strict"],
      "env": {
        "ALLOW_SUDO": "false"
      },
      "timeout": 5000,
      "blocking": true,
      "matcher": "Bash"
    }]
  }
}
```

**Script Template:**
```bash
#!/bin/bash

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields
EVENT=$(echo "$INPUT" | jq -r '.event')
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName')

# Perform validation
if [[ "$TOOL_NAME" == "Bash" ]]; then
  COMMAND=$(echo "$INPUT" | jq -r '.toolInput.command')

  if [[ "$COMMAND" =~ "rm -rf /" ]]; then
    # Block the operation
    echo '{"blocked": true, "message": "Dangerous command blocked"}'
    exit 1
  fi
fi

# Allow the operation
exit 0
```

### URL Hooks

Send HTTP callbacks to external services.

```typescript
interface UrlHookConfig {
  type: 'url';
  url: string;             // Callback URL
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';  // Default: POST
  headers?: Record<string, string>;  // Custom headers
  timeout?: number;        // Timeout in ms (default: 10000)
  blocking?: boolean;      // Wait for response (default: false)
  matcher?: string;        // Tool name or regex pattern
}
```

**Features:**
- HTTP/HTTPS support
- Custom headers
- JSON payload
- Response parsing
- Timeout control
- Non-blocking by default

**Example:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "type": "url",
      "url": "https://analytics.example.com/api/events",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN",
        "X-Service": "claude-code"
      },
      "timeout": 5000,
      "blocking": false
    }]
  }
}
```

**Request Payload:**
```json
{
  "event": "PostToolUse",
  "toolName": "Bash",
  "toolInput": {
    "command": "git status"
  },
  "toolOutput": "On branch main...",
  "sessionId": "sess_abc123",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

**Response Format (Optional):**
```json
{
  "blocked": false,
  "message": "Event recorded"
}
```

---

## Hook Configuration

### Pattern Matching

Hooks can be configured to match specific tools using the `matcher` field:

#### Exact Match
```json
{
  "matcher": "Bash"  // Only matches Bash tool
}
```

#### Regex Match
```json
{
  "matcher": "/Bash|Read|Write/"  // Matches Bash, Read, or Write
}
```

#### Wildcard (Match All)
```json
{
  // No matcher = matches all tools
}
```

### Blocking vs Non-Blocking

#### Blocking Hooks
- Wait for hook to complete
- Can block the operation by returning `{ blocked: true }`
- Suitable for validation and permission checks
- Default for command hooks

```json
{
  "type": "command",
  "command": "./validate.sh",
  "blocking": true
}
```

#### Non-Blocking Hooks
- Execute asynchronously
- Cannot block the operation
- Suitable for logging and notifications
- Default for URL hooks

```json
{
  "type": "url",
  "url": "https://api.example.com/log",
  "blocking": false
}
```

### Environment Variables

Command hooks support variable substitution:

```json
{
  "type": "command",
  "command": "log-tool $TOOL_NAME",
  "env": {
    "LOG_LEVEL": "info",
    "SERVICE": "claude-code"
  }
}
```

**Available Variables:**
- `$TOOL_NAME` - Tool being executed
- `$EVENT` - Hook event type
- `$SESSION_ID` - Current session ID
- `CLAUDE_HOOK_EVENT` (env) - Event type
- `CLAUDE_HOOK_TOOL_NAME` (env) - Tool name
- `CLAUDE_HOOK_SESSION_ID` (env) - Session ID

---

## Registering Hooks

### Programmatic Registration

```typescript
import { registerHook } from './hooks/index.js';

// Register command hook
registerHook('PreToolUse', {
  type: 'command',
  command: './validate-tool.sh',
  blocking: true,
  matcher: 'Bash'
});

// Register URL hook
registerHook('PostToolUse', {
  type: 'url',
  url: 'https://api.example.com/events',
  method: 'POST',
  blocking: false
});
```

### File-Based Registration

Hooks are automatically loaded from:

1. **Global configuration**: `~/.claude/settings.json`
2. **Project configuration**: `.claude/settings.json`
3. **Hooks directory**: `.claude/hooks/*.json`

#### Global Configuration (`~/.claude/settings.json`)
```json
{
  "apiKey": "...",
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "/usr/local/bin/audit-tool.sh",
        "blocking": true
      }
    ],
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://analytics.example.com/api/log",
        "blocking": false
      }
    ]
  }
}
```

#### Project Configuration (`.claude/settings.json`)
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./scripts/validate-bash.sh",
        "blocking": true,
        "matcher": "Bash"
      }
    ]
  }
}
```

#### Hooks Directory (`.claude/hooks/audit.json`)
```json
{
  "hooks": {
    "PreToolUse": [
      { "type": "command", "command": "./audit.sh" }
    ],
    "PostToolUse": [
      { "type": "command", "command": "./log.sh" }
    ]
  }
}
```

### Legacy Format (Backward Compatibility)

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "command": "./validate.sh",
      "matcher": "Bash",
      "blocking": true
    }
  ]
}
```

This format is automatically converted to the new format internally.

---

## Hook Execution

### Execution Flow

```typescript
async function runHooks(input: HookInput): Promise<HookResult[]>;
```

**Example:**
```typescript
import { runHooks } from './hooks/index.js';

const results = await runHooks({
  event: 'PreToolUse',
  toolName: 'Bash',
  toolInput: { command: 'ls -la' },
  sessionId: 'sess_abc123'
});

// Check if any hook blocked the operation
const blocked = results.some(r => r.blocked);
if (blocked) {
  console.log('Operation blocked by hook');
}
```

### Hook Results

```typescript
interface HookResult {
  success: boolean;        // Whether hook executed successfully
  output?: string;         // Hook output
  error?: string;          // Error message if failed
  blocked?: boolean;       // Whether operation should be blocked
  blockMessage?: string;   // Reason for blocking
}
```

### Blocking Check

```typescript
import { isBlocked } from './hooks/index.js';

const results = await runHooks(input);
const blockCheck = isBlocked(results);

if (blockCheck.blocked) {
  throw new Error(blockCheck.message || 'Operation blocked');
}
```

---

## Helper Functions

### runPreToolUseHooks

Convenient wrapper for PreToolUse hooks.

```typescript
async function runPreToolUseHooks(
  toolName: string,
  toolInput: unknown,
  sessionId?: string
): Promise<{ allowed: boolean; message?: string }>;
```

**Example:**
```typescript
import { runPreToolUseHooks } from './hooks/index.js';

const result = await runPreToolUseHooks('Bash', {
  command: 'rm -rf /tmp/cache'
}, 'sess_abc123');

if (!result.allowed) {
  return { success: false, error: result.message };
}

// Proceed with tool execution
```

### runPostToolUseHooks

Convenient wrapper for PostToolUse hooks.

```typescript
async function runPostToolUseHooks(
  toolName: string,
  toolInput: unknown,
  toolOutput: string,
  sessionId?: string
): Promise<void>;
```

**Example:**
```typescript
import { runPostToolUseHooks } from './hooks/index.js';

const result = await tool.execute(input);

await runPostToolUseHooks(
  'Bash',
  input,
  result.output || '',
  'sess_abc123'
);
```

### runUserPromptSubmitHooks

```typescript
async function runUserPromptSubmitHooks(
  prompt: string,
  sessionId?: string
): Promise<{ allowed: boolean; message?: string }>;
```

### runSessionStartHooks

```typescript
async function runSessionStartHooks(sessionId: string): Promise<void>;
```

### runSessionEndHooks

```typescript
async function runSessionEndHooks(sessionId: string): Promise<void>;
```

### runPermissionRequestHooks

```typescript
async function runPermissionRequestHooks(
  toolName: string,
  toolInput: unknown,
  sessionId?: string
): Promise<{ decision?: 'allow' | 'deny'; message?: string }>;
```

**Example:**
```typescript
const result = await runPermissionRequestHooks(
  'Write',
  { file_path: '/etc/hosts', content: '...' },
  'sess_abc123'
);

if (result.decision === 'deny') {
  throw new Error(result.message || 'Permission denied');
}
```

### Hook Management

#### Get Registered Hooks

```typescript
import { getRegisteredHooks } from './hooks/index.js';

const hooks = getRegisteredHooks();
// Returns: { PreToolUse: [...], PostToolUse: [...], ... }
```

#### Get Hook Count

```typescript
import { getHookCount, getEventHookCount } from './hooks/index.js';

const totalHooks = getHookCount();
const preToolUseHooks = getEventHookCount('PreToolUse');
```

#### Clear Hooks

```typescript
import { clearHooks, clearEventHooks } from './hooks/index.js';

// Clear all hooks
clearHooks();

// Clear hooks for specific event
clearEventHooks('PreToolUse');
```

#### Unregister Hook

```typescript
import { unregisterHook } from './hooks/index.js';

const hookConfig = {
  type: 'command',
  command: './validate.sh'
};

const removed = unregisterHook('PreToolUse', hookConfig);
```

---

## Configuration Formats

### New Format (Recommended)

Organized by event type:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./validate.sh",
        "blocking": true
      },
      {
        "type": "url",
        "url": "https://api.example.com/validate",
        "blocking": true
      }
    ],
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://api.example.com/log",
        "blocking": false
      }
    ]
  }
}
```

### Legacy Format (Supported)

Flat array with event field:

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "command": "./validate.sh",
      "blocking": true
    },
    {
      "event": "PostToolUse",
      "command": "./log.sh",
      "blocking": false
    }
  ]
}
```

---

## Use Cases

### Use Case 1: Security Auditing

Log all tool executions to an audit database:

```json
{
  "hooks": {
    "PreToolUse": [{
      "type": "url",
      "url": "https://audit.company.com/api/log",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer ${AUDIT_TOKEN}",
        "X-Service": "claude-code"
      },
      "blocking": false
    }]
  }
}
```

### Use Case 2: Dangerous Command Prevention

Block dangerous bash commands:

```bash
#!/bin/bash
# validate-bash.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.toolInput.command')

# Block dangerous patterns
if echo "$COMMAND" | grep -qE "rm -rf /|sudo rm|mkfs|dd if=/dev/zero"; then
  echo '{"blocked": true, "message": "Dangerous command blocked"}'
  exit 1
fi

exit 0
```

```json
{
  "hooks": {
    "PreToolUse": [{
      "type": "command",
      "command": "./validate-bash.sh",
      "blocking": true,
      "matcher": "Bash"
    }]
  }
}
```

### Use Case 3: File Access Control

Restrict file access to specific directories:

```python
#!/usr/bin/env python3
# validate-file-access.py

import json
import sys
from pathlib import Path

# Read input
input_data = json.load(sys.stdin)
tool_name = input_data.get('toolName')
tool_input = input_data.get('toolInput', {})

# Get file path
file_path = tool_input.get('file_path', '')

# Define allowed directories
ALLOWED_DIRS = [
    '/home/user/projects',
    '/tmp'
]

# Check if path is in allowed directories
allowed = any(
    Path(file_path).is_relative_to(allowed_dir)
    for allowed_dir in ALLOWED_DIRS
)

if not allowed:
    print(json.dumps({
        'blocked': True,
        'message': f'Access denied: {file_path} is outside allowed directories'
    }))
    sys.exit(1)

sys.exit(0)
```

```json
{
  "hooks": {
    "PreToolUse": [{
      "type": "command",
      "command": "./validate-file-access.py",
      "blocking": true,
      "matcher": "/Read|Write|Edit/"
    }]
  }
}
```

### Use Case 4: Slack Notifications

Send notifications to Slack when important events occur:

```json
{
  "hooks": {
    "PostToolUseFailure": [{
      "type": "url",
      "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "method": "POST",
      "blocking": false
    }]
  }
}
```

### Use Case 5: Usage Metrics

Track tool usage for analytics:

```javascript
// log-metrics.js
const input = JSON.parse(require('fs').readFileSync(0, 'utf-8'));

// Send to analytics service
fetch('https://analytics.example.com/api/metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: input.event,
    tool: input.toolName,
    user: process.env.USER,
    timestamp: new Date().toISOString()
  })
});
```

```json
{
  "hooks": {
    "PostToolUse": [{
      "type": "command",
      "command": "node log-metrics.js",
      "blocking": false
    }]
  }
}
```

### Use Case 6: Cost Tracking

Track API usage and costs:

```json
{
  "hooks": {
    "SessionStart": [{
      "type": "url",
      "url": "https://billing.example.com/api/session/start",
      "blocking": false
    }],
    "SessionEnd": [{
      "type": "url",
      "url": "https://billing.example.com/api/session/end",
      "blocking": false
    }]
  }
}
```

### Use Case 7: Context Preservation

Save context before compression:

```bash
#!/bin/bash
# save-context.sh

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')

# Save current context to backup
cp ~/.claude/sessions/${SESSION_ID}.json \
   ~/.claude/sessions/${SESSION_ID}.backup.json

echo "Context backed up"
exit 0
```

```json
{
  "hooks": {
    "PreCompact": [{
      "type": "command",
      "command": "./save-context.sh",
      "blocking": false
    }]
  }
}
```

---

## Best Practices

### 1. Use Blocking Hooks Sparingly

Blocking hooks add latency. Only use `blocking: true` when necessary:

```json
// Good: Blocking for validation
{
  "event": "PreToolUse",
  "type": "command",
  "command": "./validate.sh",
  "blocking": true
}

// Good: Non-blocking for logging
{
  "event": "PostToolUse",
  "type": "url",
  "url": "https://logs.example.com",
  "blocking": false
}
```

### 2. Set Appropriate Timeouts

Prevent hooks from hanging:

```json
{
  "type": "command",
  "command": "./slow-validation.sh",
  "timeout": 5000,  // 5 seconds max
  "blocking": true
}
```

### 3. Handle Errors Gracefully

Hooks should fail safely:

```bash
#!/bin/bash
# Fail safely with proper exit codes

set -euo pipefail

# Your hook logic here

# Exit 0 on success (allow operation)
exit 0

# Exit 1 on validation failure (block operation)
# exit 1
```

### 4. Use Matchers to Reduce Overhead

Only run hooks when needed:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./validate-bash.sh",
        "matcher": "Bash"  // Only for Bash tool
      },
      {
        "type": "command",
        "command": "./validate-files.sh",
        "matcher": "/Read|Write|Edit/"  // Only for file tools
      }
    ]
  }
}
```

### 5. Separate Concerns

Use different hooks for different purposes:

```json
{
  "hooks": {
    "PreToolUse": [
      { "type": "command", "command": "./security-check.sh" }
    ],
    "PostToolUse": [
      { "type": "url", "url": "https://logs.example.com/log" }
    ],
    "PostToolUseFailure": [
      { "type": "url", "url": "https://alerts.example.com/alert" }
    ]
  }
}
```

### 6. Validate Hook Output

When using blocking hooks, validate the response:

```bash
#!/bin/bash

# ... validation logic ...

# Proper blocking response
if [ $SHOULD_BLOCK == "true" ]; then
  echo '{"blocked": true, "message": "Reason for blocking"}'
  exit 1
fi

# Allow operation
exit 0
```

### 7. Test Hooks Independently

Test hooks outside of Claude Code:

```bash
# Test command hook
echo '{"event":"PreToolUse","toolName":"Bash","toolInput":{"command":"ls"}}' | ./validate.sh

# Test with expected blocking
echo '{"event":"PreToolUse","toolName":"Bash","toolInput":{"command":"rm -rf /"}}' | ./validate.sh
# Should output: {"blocked": true, "message": "..."}
```

### 8. Document Hook Behavior

Add comments to hook configurations:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "// comment": "Validates bash commands before execution",
        "type": "command",
        "command": "./validate-bash.sh",
        "blocking": true,
        "matcher": "Bash"
      }
    ]
  }
}
```

### 9. Monitor Hook Performance

Log hook execution times:

```bash
#!/bin/bash
START=$(date +%s%N)

# Hook logic here

END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))  # milliseconds

echo "Hook execution time: ${DURATION}ms" >&2
```

### 10. Use Environment Variables for Configuration

Make hooks configurable:

```json
{
  "type": "command",
  "command": "./audit.sh",
  "env": {
    "AUDIT_LEVEL": "strict",
    "ALLOWED_TOOLS": "Bash,Read,Write",
    "LOG_FILE": "/var/log/claude-audit.log"
  }
}
```

---

For more information, see:
- [Tool API Documentation](./tools.md)
- [Type System Documentation](./types.md)
- [Error Handling](./errors.md)
- [Plugin Development](./plugins.md)
