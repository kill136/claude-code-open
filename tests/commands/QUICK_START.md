# Command Tests - Quick Start Guide

## Running Tests

### Quick Commands
```bash
# Run all command tests
npm test tests/commands/

# Run specific test file
npm test tests/commands/auth.test.ts

# Run with watch mode (auto-rerun on changes)
npm run test:watch

# Run with UI dashboard
npm run test:ui

# Run with coverage report
npm run test:coverage
```

## Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `auth.test.ts` | 31 | Authentication, billing, login/logout |
| `config.test.ts` | 19 | Configuration, model selection, MCP |
| `session.test.ts` | 38 | Sessions, context, export, resume |
| `general.test.ts` | 51 | Help, status, doctor, memory, plan |
| **TOTAL** | **139** | **All major commands** |

## Test Results

```
✓ tests/commands/config.test.ts (19 tests)
✓ tests/commands/general.test.ts (51 tests)
✓ tests/commands/session.test.ts (38 tests)
✓ tests/commands/auth.test.ts (31 tests | 1 skipped)

Test Files  4 passed (4)
Tests      138 passed | 1 skipped (139)
Duration   ~850ms
```

## What's Tested

### ✅ Command Registration
- All commands properly registered
- Aliases work correctly
- Category grouping

### ✅ Command Execution
- Success paths
- Error handling
- Parameter validation

### ✅ UI Interaction
- Message display
- Activity logging
- Exit handling

### ✅ Edge Cases
- Invalid parameters
- Missing files
- Authentication states
- Environment variables

## Adding New Tests

1. Create test file in `tests/commands/`
2. Import command from `src/commands/`
3. Use `createMockContext()` helper
4. Follow existing patterns
5. Run tests to verify

Example:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { myCommand } from '../../src/commands/my-command.js';

describe('My Command', () => {
  it('should work correctly', () => {
    const ctx = createMockContext(['arg1', 'arg2']);
    const result = myCommand.execute(ctx);
    expect(result.success).toBe(true);
  });
});
```

## Common Issues

### Tests Timeout
Increase timeout in test:
```typescript
it('long running test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock Not Working
Reset mocks in beforeEach:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### File System Errors
Use temp directories:
```typescript
const testDir = path.join(os.tmpdir(), 'test-xyz');
```

## Documentation

- **Full Guide**: See `README.md` in this directory
- **Summary**: See `TEST_SUMMARY.md` for implementation details
- **Vitest Docs**: https://vitest.dev/

## CI/CD Integration

Tests are ready for CI/CD:
- No interactive prompts
- No external dependencies
- Fast execution (~850ms)
- Deterministic results
- Proper cleanup

Add to CI pipeline:
```yaml
- name: Run tests
  run: npm test
```
