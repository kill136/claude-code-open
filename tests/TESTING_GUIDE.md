# Claude Code Testing Guide

## Overview

This guide covers the testing infrastructure for Claude Code CLI, focusing on the core module unit tests.

## Directory Structure

```
tests/
├── core/                    # Core module tests
│   ├── loop.test.ts         # ConversationLoop tests
│   ├── session.test.ts      # Session management tests
│   ├── context.test.ts      # Context management tests
│   ├── config.test.ts       # Configuration tests
│   └── README.md            # Core tests documentation
├── config.test.ts           # Legacy config tests (root level)
├── run-tests.sh             # Test runner script
└── TESTING_GUIDE.md         # This file
```

## Running Tests

### Option 1: Using Test Runner Script (Recommended)

```bash
# Run all core tests
./tests/run-tests.sh

# Run a specific test
./tests/run-tests.sh loop      # Run loop tests
./tests/run-tests.sh session   # Run session tests
./tests/run-tests.sh context   # Run context tests
./tests/run-tests.sh config    # Run config tests
```

### Option 2: Direct Execution

```bash
# Using npx tsx
npx tsx tests/core/loop.test.ts
npx tsx tests/core/session.test.ts
npx tsx tests/core/context.test.ts
npx tsx tests/core/config.test.ts

# If tsx is installed globally
tsx tests/core/loop.test.ts
```

### Option 3: After Building

```bash
# Build the project
npm run build

# Run compiled tests
node dist/tests/core/loop.test.js
# (Note: Tests may need adjustment for this approach)
```

## Test Categories

### 1. ConversationLoop Tests (`loop.test.ts`)

**Purpose:** Test the main conversation orchestrator

**Key Test Areas:**
- Initialization (default/custom options)
- Tool filtering and management
- Session lifecycle
- Message processing
- Usage tracking
- Permission modes
- Edge cases

**Example:**
```bash
./tests/run-tests.sh loop
```

### 2. Session Tests (`session.test.ts`)

**Purpose:** Test session state management

**Key Test Areas:**
- Session creation and ID generation
- Message CRUD operations
- TODO management
- Usage statistics
- Persistence (save/load)
- Metadata handling
- Edge cases (special characters, long messages)

**Example:**
```bash
./tests/run-tests.sh session
```

### 3. Context Tests (`context.test.ts`)

**Purpose:** Test context window management and compression

**Key Test Areas:**
- Token estimation
- Message compression
- Context optimization
- Turn management
- Compression analysis
- Key info extraction
- Edge cases (empty messages, large inputs)

**Example:**
```bash
./tests/run-tests.sh context
```

### 4. Configuration Tests (`config.test.ts`)

**Purpose:** Test configuration loading and management

**Key Test Areas:**
- Config initialization
- Multi-source loading (global, project, env)
- Priority and merging
- Validation
- Migration
- Import/export
- MCP server management

**Example:**
```bash
./tests/run-tests.sh config
```

## Test Output

### Success Output
```
=== Claude Code Core Module Tests ===

Running: loop
✓ should initialize with default options
✓ should initialize with custom options
...
Test completed: 20 passed, 0 failed

Running: session
✓ should create new session
...
Test completed: 30 passed, 0 failed

=== Test Summary ===
Total: 4
Passed: 4
Failed: 0

All tests passed!
```

### Failure Output
```
Running: config
✗ should load from global config
  Error: Expected 'opus', got 'sonnet'

Test completed: 24 passed, 1 failed

=== Test Summary ===
Total: 4
Passed: 3
Failed: 1

Some tests failed!
```

## Writing New Tests

### Test File Template

```typescript
/**
 * ModuleName 测试
 * 测试描述
 */

import { ModuleToTest } from '../../src/module/index.js';

// Test utilities
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  错误: ${(error as Error).message}`);
      failed++;
    }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  期望: ${expected}\n  实际: ${actual}`);
  }
}

// Test cases
const tests = [
  test('should do something', () => {
    const instance = new ModuleToTest();
    const result = instance.method();
    assertEqual(result, expected, 'Result should match');
  }),

  // More tests...
];

// Test runner
async function runTests() {
  console.log('运行 ModuleName 测试...\n');

  for (const testFn of tests) {
    await testFn();
  }

  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
```

### Assertion Helpers

```typescript
// Basic assertion
assert(value === true, 'Value should be true');

// Equality
assertEqual(actual, expected, 'Values should match');

// Defined check
assertDefined(value, 'Value should be defined');

// Greater than
assertGreaterThan(value, 0, 'Value should be positive');

// Less than
assertLessThan(value, 100, 'Value should be under 100');
```

### Setup and Teardown

```typescript
function setup() {
  // Create test environment
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
  // Clean up test artifacts
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

// Use in tests
test('should do something', () => {
  setup();
  try {
    // Test code
  } finally {
    cleanup();
  }
});
```

## Mocking Guidelines

### Mock External Dependencies

```typescript
// Mock API client
class MockClaudeClient extends ClaudeClient {
  async createMessage() {
    return {
      content: [{ type: 'text', text: 'Mock response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

// Mock file system operations
const originalEnv = process.env.HOME;
process.env.HOME = '/tmp/test-home';
// ... run tests
process.env.HOME = originalEnv;
```

### Isolate Tests

```typescript
test('should be isolated', () => {
  const originalCwd = process.cwd();
  try {
    // Test code
    process.chdir('/tmp');
    // ...
  } finally {
    process.chdir(originalCwd);
  }
});
```

## Best Practices

1. **One Assertion Per Test:** Focus each test on a single behavior
2. **Descriptive Names:** Use "should..." format for test names
3. **Arrange-Act-Assert:** Structure tests clearly
4. **Clean Up:** Always restore state after tests
5. **Avoid Flaky Tests:** Don't rely on timing or external state
6. **Test Edge Cases:** Include boundary conditions
7. **Mock Wisely:** Only mock what's necessary

## Debugging Tests

### Enable Verbose Output

```typescript
// Add debug logging
console.log('Debug:', variable);
console.dir(object, { depth: null });
```

### Run Single Test

Modify the test file to run only one test:

```typescript
const tests = [
  test('specific test to debug', () => {
    // ...
  }),
];
```

### Check Stack Traces

The test framework prints stack traces for failures:

```
✗ should load config
  错误: Expected 'opus', got 'sonnet'
  堆栈: at tests/core/config.test.ts:45:3
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: ./tests/run-tests.sh
```

### Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Coverage Goals

Current test coverage by module:

- **ConversationLoop:** 20 tests
- **Session:** 30 tests
- **Context:** 40 tests
- **Config:** 25 tests

**Total:** 115 core module tests

## Future Improvements

- [ ] Add code coverage reporting (nyc/istanbul)
- [ ] Integrate proper test framework (vitest/jest)
- [ ] Add integration tests
- [ ] Add performance benchmarks
- [ ] Parallel test execution
- [ ] Watch mode for development
- [ ] Snapshot testing for complex objects

## Troubleshooting

### Tests Won't Run

**Problem:** `tsx: command not found`

**Solution:**
```bash
npm install  # Ensure dependencies are installed
npx tsx tests/core/loop.test.ts  # Use npx
```

### Tests Fail Unexpectedly

**Problem:** Environment pollution from previous tests

**Solution:**
- Ensure cleanup() is called
- Restore environment variables
- Use isolated test directories

### Permission Errors

**Problem:** Cannot write to test directories

**Solution:**
- Use `os.tmpdir()` for test files
- Check directory permissions
- Run with appropriate user

## Support

For questions or issues:
1. Check test output for error messages
2. Review test code and assertions
3. Check that dependencies are installed
4. Verify Node.js version (18+)

## Contributing

When adding new tests:
1. Follow existing patterns
2. Add to appropriate test file
3. Update test counts in README
4. Ensure cleanup is implemented
5. Test both success and failure paths
