# Hooks Test Migration Note

## Overview

The hooks system now has two test files:

1. **src/hooks/index.test.ts** - Original custom test runner (6 tests)
2. **tests/hooks/hooks.test.ts** - New Vitest-based comprehensive test suite (55 tests)

## Comparison

### Original Test File (src/hooks/index.test.ts)
- Uses custom test runner
- 6 test functions
- Can be run standalone with: `tsx src/hooks/index.test.ts`
- Tests basic functionality:
  - Hook registration
  - Command hook execution
  - Hook matcher
  - Environment variables
  - Helper functions
  - All 12 event types

### New Test Suite (tests/hooks/hooks.test.ts)
- Uses Vitest framework
- 55 comprehensive tests
- Integrated with project test infrastructure
- Tests all functionality of original PLUS:
  - Advanced hook types (URL, Prompt, Agent, MCP)
  - Configuration loading (new and legacy formats)
  - Project-level hooks
  - Blocking/non-blocking behavior
  - Error handling and timeouts
  - Hook lifecycle management
  - All 19 event types (including CLI-level events)

## Running Tests

### Original Test File
```bash
# Run as standalone script
tsx src/hooks/index.test.ts

# Or with Node
node --loader tsx src/hooks/index.test.ts
```

### New Test Suite
```bash
# Run with Vitest
npm run test tests/hooks/hooks.test.ts

# Run with coverage (requires @vitest/coverage-v8)
npm run test:coverage tests/hooks/hooks.test.ts

# Run in watch mode
npm run test:watch tests/hooks/hooks.test.ts
```

## Recommendations

1. **For CI/CD**: Use the new Vitest suite (`tests/hooks/hooks.test.ts`)
   - Better integration with test infrastructure
   - More comprehensive coverage
   - Standard test output format

2. **For Quick Manual Testing**: Either can be used
   - Original file is faster to run standalone
   - New suite provides more detailed feedback

3. **For Development**: Use Vitest suite in watch mode
   - Automatic re-run on file changes
   - Better error reporting
   - IDE integration

## Feature Coverage Comparison

| Feature | Original | New Suite |
|---------|----------|-----------|
| Hook Registration | ✅ | ✅ |
| Command Hooks | ✅ | ✅ |
| Hook Matchers | ✅ | ✅ |
| Environment Variables | ✅ | ✅ |
| URL Hooks | ❌ | ✅ |
| Prompt Hooks | ❌ | ✅ |
| Agent Hooks | ❌ | ✅ |
| MCP Hooks | ❌ | ✅ |
| Configuration Loading | ❌ | ✅ |
| Error Handling | ❌ | ✅ |
| Timeouts | ❌ | ✅ |
| Blocking Behavior | ❌ | ✅ |
| CLI-level Events | ❌ | ✅ |

## Conclusion

The new Vitest-based test suite provides **9x more test coverage** (55 vs 6 tests) and should be the primary test suite going forward. The original test file can be kept for quick manual verification but is superseded by the new comprehensive suite.
