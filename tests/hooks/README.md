# Hooks System Test Suite

## Overview

This directory contains comprehensive unit tests for the Claude Code hooks system. The hooks system allows users to execute custom logic at various points during tool execution and session lifecycle.

## Test File

- **hooks.test.ts** - Main test suite covering all hook functionality

## Test Coverage

### 1. Hook Registration and Management (9 tests)
- ✅ Register command hooks
- ✅ Register multiple hooks for same event
- ✅ Register hooks for different events
- ✅ Retrieve hooks for specific event
- ✅ Clear all hooks
- ✅ Clear hooks for specific event
- ✅ Unregister specific hooks
- ✅ Get all registered hooks (object format)
- ✅ Get all registered hooks (flat array format)

### 2. Command Hook Execution (6 tests)
- ✅ Execute simple command hooks
- ✅ Pass environment variables to commands
- ✅ Custom environment variables
- ✅ Handle command timeouts
- ✅ Handle command failures
- ✅ Execute multiple hooks in order

### 3. Hook Matchers (4 tests)
- ✅ Match exact tool names
- ✅ Match regex patterns
- ✅ Match complex regex patterns
- ✅ Run all hooks when no matcher specified

### 4. Blocking and Non-Blocking Hooks (4 tests)
- ✅ Block operations when hook returns blocked status
- ✅ Stop executing hooks after blocking hook
- ✅ Check if results are blocked using isBlocked()
- ✅ Return not blocked when no hooks block

### 5. All Hook Event Types (15 tests)
- ✅ Support all 19 event types
- ✅ PreToolUse hooks
- ✅ PostToolUse hooks
- ✅ SessionStart hooks
- ✅ SessionEnd hooks
- ✅ UserPromptSubmit hooks
- ✅ Stop hooks
- ✅ SubagentStart hooks
- ✅ SubagentStop hooks
- ✅ PreCompact hooks
- ✅ PostToolUseFailure hooks
- ✅ PermissionRequest hooks
- ✅ Notification hooks

### 6. URL Hooks (3 tests)
- ✅ Register URL hooks
- ✅ Default method as POST
- ✅ Support custom headers

### 7. Configuration Loading (7 tests)
- ✅ Load hooks from JSON file (new format)
- ✅ Load hooks from JSON file (legacy format)
- ✅ Handle non-existent config files gracefully
- ✅ Handle invalid JSON gracefully
- ✅ Validate hook configs when loading
- ✅ Load project hooks from .claude directory
- ✅ Support multiple hook types in config

### 8. Error Handling (3 tests)
- ✅ Handle hook execution errors gracefully
- ✅ Continue execution after non-blocking hook fails
- ✅ Handle missing events gracefully

### 9. Hook Types (3 tests)
- ✅ Support Prompt hook type
- ✅ Support Agent hook type
- ✅ Support MCP hook type

### 10. Advanced Scenarios (3 tests)
- ✅ Handle mixed blocking and non-blocking hooks
- ✅ Pass correct tool input to hooks
- ✅ Handle hooks with custom timeouts

## Total Test Count: 55 tests

## Supported Hook Types

1. **Command** - Execute shell commands
2. **URL** - HTTP callbacks to remote services
3. **Prompt** - LLM-based evaluation (registration tested)
4. **Agent** - Validator agents (registration tested)
5. **MCP** - Model Context Protocol tools (registration tested)

## Supported Event Types (19 total)

### Tool-Level Events
- PreToolUse
- PostToolUse
- PostToolUseFailure
- Notification
- UserPromptSubmit
- SessionStart
- SessionEnd
- Stop
- SubagentStart
- SubagentStop
- PreCompact
- PermissionRequest

### CLI-Level Events
- BeforeSetup
- AfterSetup
- CommandsLoaded
- ToolsLoaded
- McpConfigsLoaded
- PluginsInitialized
- AfterHooks

## Running Tests

```bash
# Run all hooks tests
npm run test tests/hooks/hooks.test.ts

# Run with verbose output
npm run test tests/hooks/hooks.test.ts -- --reporter=verbose

# Run in watch mode
npm run test:watch tests/hooks/hooks.test.ts

# Run specific test
npm run test tests/hooks/hooks.test.ts -- -t "should execute simple command hook"
```

## Test Results

```
✅ Test Files: 1 passed (1)
✅ Tests: 55 passed (55)
⏱️  Duration: ~1.2s
```

## Key Features Tested

### Hook Lifecycle
- Registration and unregistration
- Event-based triggering
- Sequential execution
- Blocking vs non-blocking behavior

### Hook Configuration
- JSON file loading (new format)
- Legacy format support
- Project-level hooks (.claude directory)
- Multiple hook files

### Hook Matching
- Exact tool name matching
- Regex pattern matching
- Global hooks (no matcher)

### Environment Variables
- Built-in variables ($TOOL_NAME, $EVENT, $SESSION_ID)
- Custom environment variables
- Variable substitution in commands

### Error Handling
- Command execution failures
- Timeouts
- Invalid configurations
- Missing dependencies

### Blocking Mechanism
- Hook-based blocking
- Block message propagation
- Early termination on block

## Notes

- EPIPE errors may appear in test output when child processes exit early - these are harmless
- Some advanced hook types (Prompt, Agent, MCP) test registration only; full execution would require external dependencies
- Tests use temporary directories for file operations, cleaned up automatically

## Future Enhancements

Potential areas for additional testing:
- Integration tests with real MCP servers
- Integration tests with Claude API for Prompt/Agent hooks
- Performance tests with many hooks
- Concurrent hook execution tests
- Hook result transformation tests
