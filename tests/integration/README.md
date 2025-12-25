# Integration Test Framework

This directory contains the integration testing framework for Claude Code CLI. Integration tests verify that multiple components work together correctly.

## Directory Structure

```
tests/integration/
├── setup.ts              # Test environment setup and teardown utilities
├── helpers.ts            # Test helper functions and utilities
├── fixtures/             # Test data and sample files
│   ├── sample-code.ts
│   ├── sample-config.json
│   └── sample-session.json
├── tool-chain.test.ts    # Tool chain integration tests
├── session-flow.test.ts  # Session lifecycle tests
└── config-load.test.ts   # Configuration loading tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run only integration tests
npm run test:integration

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npx vitest tests/integration/tool-chain.test.ts
```

## Test Environment

The integration tests use a temporary test environment that includes:

- **Temporary directories**: Isolated from your real configuration
- **Mock API calls**: No actual API requests are made
- **Real file system**: Uses actual file operations in temp directories
- **Clean state**: Each test suite gets a fresh environment

### Setup and Teardown

```typescript
import { setupTestEnvironment, cleanupTestEnvironment } from './setup.js';

describe('My Integration Test', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
  });

  it('should test something', async () => {
    // Test code here
  });
});
```

## Test Utilities

### Setup Functions

- `setupTestEnvironment()`: Creates a fresh test environment with temporary directories
- `cleanupTestEnvironment(env)`: Removes temporary directories and restores environment
- `createTestFile(env, path, content)`: Creates a test file
- `createTestConfig(env, config)`: Creates a test configuration file
- `createTestSession(env, id, session)`: Creates a test session file

### Helper Functions

- `createMinimalConfig()`: Creates a valid minimal configuration
- `createTestSessionObject()`: Creates a test session object
- `createTestMessage()`: Creates a test message
- `assertFileContains()`: Asserts file contains expected content
- `assertFileEquals()`: Asserts file matches exactly
- `assertDirectoryContains()`: Asserts directory contains specific files

### Mock Utilities

- `MockApiClient`: Mock Anthropic API client for testing
- `MockInput`: Simulates user input for interactive tests
- `createMockApiResponse()`: Creates mock API responses
- `createMockToolUseResponse()`: Creates mock tool use responses

## Test Coverage

### Tool Chain Tests (`tool-chain.test.ts`)

Tests multiple tools working together:

- **Read → Edit → Write chain**: Sequential file operations
- **Glob → Read chain**: File discovery and reading
- **Grep → Edit chain**: Search and modify patterns
- **Complex workflows**: Multi-step refactoring scenarios

### Session Flow Tests (`session-flow.test.ts`)

Tests session lifecycle and state management:

- **Session creation**: Creating new sessions
- **Session persistence**: Saving and loading from disk
- **Message management**: Adding and tracking messages
- **Cost tracking**: Token usage and cost calculation
- **Session listing**: Finding and filtering sessions
- **Session cleanup**: Removing old sessions

### Config Load Tests (`config-load.test.ts`)

Tests configuration loading and merging:

- **Configuration sources**: Default, global, project, and environment variables
- **Priority handling**: Correct precedence of configuration sources
- **Validation**: Configuration value validation
- **MCP servers**: MCP server configuration management
- **Migration**: Upgrading from old configuration formats
- **Export/Import**: Configuration backup and restore

## Writing New Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment } from './setup.js';
import type { TestEnvironment } from './setup.js';

describe('New Integration Test', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
  });

  it('should do something', async () => {
    // Arrange: Set up test data
    createTestFile(env, 'test.ts', 'console.log("test");');

    // Act: Perform action
    const result = await someFunction();

    // Assert: Verify results
    expect(result).toBe(expected);
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in `afterAll`
3. **Descriptive names**: Use clear, descriptive test names
4. **AAA pattern**: Arrange, Act, Assert
5. **Real scenarios**: Test realistic user workflows
6. **Error cases**: Include negative test cases
7. **Documentation**: Comment complex test logic

### Testing with Real Tools

```typescript
import { ReadTool, WriteTool, EditTool } from '../../src/tools/file.js';

it('should execute tool chain', async () => {
  const writeTool = new WriteTool();
  await writeTool.execute({
    file_path: `${env.projectDir}/test.ts`,
    content: 'const x = 1;',
  });

  const readTool = new ReadTool();
  const content = await readTool.execute({
    file_path: `${env.projectDir}/test.ts`,
  });

  expect(content).toContain('const x = 1');
});
```

### Testing with Mocks

```typescript
import { MockApiClient } from './helpers.js';

it('should handle API response', async () => {
  const mockClient = new MockApiClient();
  mockClient.addResponse({
    role: 'assistant',
    content: 'Test response',
  });

  const response = mockClient.getNextResponse();
  expect(response.content).toBe('Test response');
});
```

## Debugging Tests

### Running Single Test

```bash
npx vitest tests/integration/tool-chain.test.ts -t "should execute Read"
```

### Verbose Output

```bash
npx vitest --reporter=verbose
```

### Debugging in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Integration Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:integration"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Patterns

### Testing File Operations

```typescript
it('should create and modify files', async () => {
  createTestFile(env, 'app.ts', 'export const app = "v1";');

  const editTool = new EditTool();
  await editTool.execute({
    file_path: `${env.projectDir}/app.ts`,
    old_string: 'v1',
    new_string: 'v2',
  });

  assertFileContains(env, 'app.ts', 'v2');
});
```

### Testing Configuration

```typescript
it('should load and merge config', () => {
  createTestConfig(env, {
    model: 'opus',
    maxTokens: 16384,
  });

  const config = new ConfigManager(env.configDir);
  const loaded = config.getAll();

  expect(loaded.model).toBe('opus');
});
```

### Testing Sessions

```typescript
it('should create and persist session', async () => {
  const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
  sessionManager.addMessage(session, 'user', 'Hello');

  await sessionManager.saveSession(session);

  const loaded = await sessionManager.loadSession(session.id);
  expect(loaded?.messages).toHaveLength(1);
});
```

## Troubleshooting

### Tests Failing to Clean Up

If tests leave artifacts:

```bash
rm -rf /tmp/claude-test-*
```

### Permission Issues

Ensure temp directory is writable:

```bash
chmod 755 /tmp
```

### Timeout Errors

Increase timeout in test:

```typescript
it('long running test', async () => {
  // test code
}, 30000); // 30 second timeout
```

## Contributing

When adding new integration tests:

1. Add tests to appropriate file or create new test file
2. Use existing setup and helper utilities
3. Follow naming conventions
4. Add documentation for complex tests
5. Ensure tests are isolated and clean up properly
6. Run full test suite before committing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Integration Testing Guide](https://martinfowler.com/bliki/IntegrationTest.html)
