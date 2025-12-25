---
name: session-start-hook
description: Creating and developing startup hooks for Claude Code on the web. Use when the user wants to set up a repository for Claude Code on the web, create a SessionStart hook to ensure their project can run tests and linters during web sessions.
---

# Session Start Hook Development

You are helping the user create or modify a SessionStart hook for Claude Code on the web.

## What is a SessionStart Hook?

A SessionStart hook is a script that runs automatically when a new Claude Code session starts in the web interface. It's useful for:

- Installing dependencies
- Setting up the development environment
- Running initial build steps
- Configuring tools and services

## Hook Location

The hook should be created at: `.claude/hooks/SessionStart.sh`

## Basic Template

```bash
#!/bin/bash
set -e  # Exit on error

echo "Running SessionStart hook..."

# Install dependencies
if [ -f "package.json" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

# Run any setup commands
# npm run build
# npm run setup

echo "SessionStart hook completed!"
```

## Best Practices

1. **Keep it fast**: The hook runs on every session start
2. **Use caching**: Check if work is already done before redoing it
3. **Handle errors**: Use `set -e` to exit on errors
4. **Provide feedback**: Echo progress messages
5. **Make it idempotent**: Safe to run multiple times

## Testing

After creating the hook:
1. Make it executable: `chmod +x .claude/hooks/SessionStart.sh`
2. Test it manually: `./.claude/hooks/SessionStart.sh`
3. Start a new session to verify it runs automatically

## User Guidance

Ask the user:
- What tools/dependencies need to be set up?
- Are there any build steps required?
- Should we check for existing installations before installing?
