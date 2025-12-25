# Command System Unit Tests

This directory contains comprehensive unit tests for the Claude Code command system.

## Test Files

### 1. `auth.test.ts` - Authentication Commands
Tests for authentication-related commands:
- `/login` - Login command with multiple authentication methods
- `/logout` - Logout and cleanup
- `/upgrade` - Subscription upgrade information
- `/passes` - Guest passes management
- `/extra-usage` - Extra usage management
- `/rate-limit-options` - Rate limit handling options

**Test Coverage:**
- Command registration and aliases
- Parameter parsing
- Authentication status detection
- OAuth flow handling
- Error scenarios
- Environment variable handling

### 2. `config.test.ts` - Configuration Commands
Tests for configuration management commands:
- Model selection and switching
- Settings display and updates
- Configuration persistence
- MCP server configuration
- Environment variable integration

**Test Coverage:**
- Config validation
- Model name validation
- Setting get/set operations
- Environment variable precedence
- Error handling for invalid values

### 3. `session.test.ts` - Session Management Commands
Tests for session-related commands:
- `/resume` - Session resumption with search and filtering
- `/context` - Context usage display
- `/compact` - Conversation compaction
- `/rewind` - Conversation rollback
- `/rename` - Session renaming
- `/export` - Session export (JSON/Markdown)

**Test Coverage:**
- Session file parsing
- Search and filtering logic
- Token usage calculation
- Export format validation
- File system operations
- Error handling for corrupted data

### 4. `general.test.ts` - General Commands
Tests for general utility commands:
- `/help` - Help system with category grouping
- `/clear` - Conversation clearing
- `/exit` - Application exit
- `/status` - Comprehensive status display
- `/doctor` - Diagnostics runner
- `/bug` - Bug reporting guide
- `/version` - Version information
- `/memory` - Persistent memory management
- `/plan` - Planning mode management

**Test Coverage:**
- Help text generation
- Status information gathering
- Diagnostics checks
- Memory CRUD operations
- Plan mode state management
- Command registry integration

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npx vitest run tests/commands/auth.test.ts
```

### Run tests matching a pattern
```bash
npx vitest run -t "Login Command"
```

## Test Structure

Each test file follows this structure:

1. **Registration Tests**: Verify commands are properly registered
2. **Metadata Tests**: Validate command name, aliases, category
3. **Execution Tests**: Test command behavior with various inputs
4. **Parameter Tests**: Validate argument parsing
5. **Error Handling Tests**: Test error scenarios
6. **Integration Tests**: Test command registry integration

## Mock Context

All tests use a standardized mock context that simulates:
- Session state (ID, message count, duration, cost)
- Configuration (model, API type, working directory)
- UI interface (message display, activity logging, exit)
- Command arguments

Example:
```typescript
function createMockContext(args: string[] = []): CommandContext {
  return {
    session: {
      id: 'test-session-id-12345',
      messageCount: 5,
      duration: 60000,
      totalCost: '$0.05',
      clearMessages: vi.fn(),
      getStats: vi.fn(() => ({ /* ... */ })),
      getTodos: vi.fn(() => []),
      setTodos: vi.fn(),
    },
    config: {
      model: 'claude-sonnet-4.5',
      modelDisplayName: 'Claude Sonnet 4.5',
      apiType: 'anthropic',
      cwd: '/test/dir',
      version: '2.0.76',
    },
    ui: {
      addMessage: vi.fn(),
      addActivity: vi.fn(),
      setShowWelcome: vi.fn(),
      exit: vi.fn(),
    },
    args,
    rawInput: args.join(' '),
  };
}
```

## Test Coverage Goals

Target coverage metrics:
- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## Adding New Tests

When adding new command tests:

1. Create test file in `tests/commands/`
2. Import command functions from `src/commands/`
3. Use `createMockContext()` helper
4. Follow existing test structure
5. Test both success and error paths
6. Verify UI interaction (messages, activities)
7. Test parameter validation
8. Add registration tests

## CI/CD Integration

Tests are designed to run in CI environments:
- No external dependencies required
- Use temporary directories for file operations
- Clean up after each test
- Mock all external services
- Support headless execution

## Debugging Tests

### View test output
```bash
npx vitest --reporter=verbose
```

### Debug specific test
```bash
npx vitest --reporter=verbose -t "should show login options"
```

### Run with Node debugger
```bash
node --inspect-brk node_modules/.bin/vitest run
```

## Common Issues

### Test Timeouts
If tests timeout, increase the timeout in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

### File System Permissions
Tests use temporary directories. Ensure write permissions:
- Linux/macOS: `/tmp/`
- Windows: `%TEMP%`

### Environment Variables
Some tests modify environment variables. They restore original values after completion.

## Contributing

When contributing command tests:
1. Maintain 100% test coverage for new commands
2. Follow existing naming conventions
3. Add descriptive test names
4. Test edge cases and error conditions
5. Update this README with new test information

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://vitest.dev/guide/best-practices.html)
- [Claude Code Architecture](../../CLAUDE.md)
