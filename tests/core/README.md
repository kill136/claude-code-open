# Core Module Unit Tests

This directory contains unit tests for the core modules of Claude Code CLI.

## Test Files

### 1. `loop.test.ts` - ConversationLoop Tests
Tests the main conversation loop that handles user input, tool calls, and responses.

**Coverage:**
- Initialization with default and custom options
- Tool filtering (allowed/disallowed tools)
- Session management (get/set session)
- Message processing and turn management
- Usage statistics tracking
- Permission modes and budget limits
- Edge cases (maxTurns boundaries, empty prompts)

**Test Count:** 20 tests

### 2. `session.test.ts` - Session Management Tests
Tests the lightweight session manager that handles conversation state.

**Coverage:**
- Session creation and unique ID generation
- Message management (add, clear, retrieve)
- TODO list management
- Usage statistics tracking (tokens, cost, duration)
- Working directory management
- Session persistence (save/load)
- Session listing and metadata
- Edge cases (long messages, special characters, invalid files)

**Test Count:** 30 tests

### 3. `context.test.ts` - Context Management Tests
Tests the context manager that handles token estimation, compression, and optimization.

**Coverage:**
- Token estimation (English, Chinese, code, special characters)
- Message compression and truncation
- Context optimization
- ContextManager initialization and configuration
- Turn management and message retrieval
- Token usage tracking (used/available)
- Compression analysis and reporting
- Context key info extraction
- Edge cases (empty messages, nested content, zero limits)

**Test Count:** 40 tests

### 4. `config.test.ts` - Configuration Management Tests
Tests the configuration manager that handles settings from multiple sources.

**Coverage:**
- Initialization with defaults
- Configuration loading (global, project, environment)
- Configuration merging and priority
- Configuration saving (global and project)
- Validation and error handling
- Configuration migration (old versions)
- Import/export functionality (with/without masking)
- MCP server management (add, update, remove)
- Edge cases (invalid files, broken JSON)

**Test Count:** 25 tests

## Running Tests

### Run All Core Tests
```bash
# Loop tests
npm run dev tests/core/loop.test.ts

# Session tests
npm run dev tests/core/session.test.ts

# Context tests
npm run dev tests/core/context.test.ts

# Config tests
npm run dev tests/core/config.test.ts
```

### Run Individual Test Files
```bash
tsx tests/core/loop.test.ts
tsx tests/core/session.test.ts
tsx tests/core/context.test.ts
tsx tests/core/config.test.ts
```

## Test Framework

This project uses a custom testing framework with:
- `test(name, fn)` - Define a test case
- `assert(condition, message)` - Basic assertion
- `assertEqual(actual, expected, message)` - Equality assertion
- `assertDefined(value, message)` - Non-null/undefined assertion
- `assertGreaterThan(actual, min, message)` - Greater than assertion
- `assertLessThan(actual, max, message)` - Less than assertion

## Test Structure

Each test file follows this pattern:

```typescript
import { ModuleUnderTest } from '../../src/module/index.js';

// Test utilities
function test(name: string, fn: () => void | Promise<void>) { ... }
function assert(condition: boolean, message: string) { ... }
function assertEqual<T>(actual: T, expected: T, message: string) { ... }

// Test cases
const tests = [
  test('should do something', () => {
    // Arrange
    const instance = new ModuleUnderTest();

    // Act
    const result = instance.method();

    // Assert
    assertEqual(result, expected, 'Result should match');
  }),
];

// Test runner
async function runTests() {
  for (const testFn of tests) {
    await testFn();
  }
  console.log(`Tests: ${passed} passed, ${failed} failed`);
}

runTests();
```

## Mocking Strategy

### External Dependencies
Tests mock external dependencies to avoid:
- Actual API calls (ClaudeClient uses mock responses)
- File system operations (use temporary directories)
- Network requests (mock HTTP calls)
- Environment pollution (restore env vars after tests)

### Test Isolation
Each test:
- Sets up its own test environment
- Cleans up after execution
- Restores original state (cwd, env vars)
- Uses temporary directories for file operations

## Coverage Goals

- **Module Initialization:** Default and custom configurations
- **State Management:** Add, update, retrieve, clear
- **Error Handling:** Invalid inputs, missing files, network errors
- **Edge Cases:** Boundary conditions, empty values, large inputs
- **Integration:** Module interactions and data flow

## Best Practices

1. **Descriptive Test Names:** Use "should" statements
2. **Arrange-Act-Assert:** Follow AAA pattern
3. **Isolation:** Each test is independent
4. **Cleanup:** Always clean up resources
5. **Clear Errors:** Provide helpful assertion messages
6. **Mock Smartly:** Mock only what's necessary
7. **Test Boundaries:** Include edge cases

## Debugging Tests

To debug a failing test:

```bash
# Run with verbose output
tsx tests/core/loop.test.ts

# Check error stack traces
# Each test shows file:line for failures

# Add debug logging
console.log('Debug:', variableToInspect);
```

## Adding New Tests

When adding new tests:

1. Follow the existing pattern
2. Add to the appropriate test file
3. Use descriptive test names
4. Include setup/teardown if needed
5. Test both success and failure paths
6. Document complex test scenarios

## CI/CD Integration

These tests are designed to run in CI/CD environments:
- No external dependencies required
- Self-contained with mocking
- Clear pass/fail reporting
- Exit code indicates success (0) or failure (1)

## Known Limitations

1. **No Actual API Calls:** Tests use mocks instead of real Anthropic API
2. **File System:** Tests use temporary directories, may fail if permissions are restricted
3. **Timing:** Some tests may be timing-sensitive (session timestamps)
4. **Platform:** Some tests assume Unix-like file paths

## Future Improvements

- [ ] Add code coverage reporting
- [ ] Integrate with proper test framework (vitest/jest)
- [ ] Add performance benchmarks
- [ ] Add integration tests
- [ ] Add visual regression tests for UI components
- [ ] Improve async test handling
- [ ] Add parallel test execution
