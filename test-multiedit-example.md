# MultiEdit Tool - Transaction Rollback Test Examples

## Example 1: Successful Multi-Edit Transaction

### Input File (example.ts)
```typescript
const name = 'Alice';
const age = 25;
function greet() {
  console.log('Hello');
}
```

### MultiEdit Request
```json
{
  "file_path": "/path/to/example.ts",
  "edits": [
    {
      "old_string": "const name = 'Alice';",
      "new_string": "const name = 'Bob';"
    },
    {
      "old_string": "const age = 25;",
      "new_string": "const age = 30;"
    },
    {
      "old_string": "console.log('Hello');",
      "new_string": "console.log('Hello, World!');"
    }
  ]
}
```

### Expected Output
```
✓ Transaction successful: Applied 3 edit(s) to example.ts

Edit details:
  Edit 1: Replaced 23 chars with 21 chars (-2) at position 0
  Edit 2: Replaced 17 chars with 17 chars (+0) at position 24
  Edit 3: Replaced 22 chars with 31 chars (+9) at position 88

File statistics:
  Lines: 5 → 5 (+0)
  Characters: 110 → 117 (+7)
```

### Transaction Flow
1. ✓ Input validation passed
2. ✓ Backup created: example.ts.backup.1703123456789
3. ✓ No conflicts detected
4. ✓ All 3 edits validated
5. ✓ All 3 edits applied
6. ✓ File written successfully
7. ✓ Backup cleaned up

---

## Example 2: Transaction Rollback - Edit Not Found

### Input File (example.ts)
```typescript
const name = 'Alice';
const age = 25;
```

### MultiEdit Request
```json
{
  "file_path": "/path/to/example.ts",
  "edits": [
    {
      "old_string": "const name = 'Alice';",
      "new_string": "const name = 'Bob';"
    },
    {
      "old_string": "const city = 'NYC';",
      "new_string": "const city = 'LA';"
    }
  ]
}
```

### Expected Output (Error)
```
Edit 2: old_string not found in file

Transaction rolled back. No changes were made.
Previously validated: 1 edit(s)
```

### Transaction Flow
1. ✓ Input validation passed
2. ✓ Backup created
3. ✓ No conflicts detected
4. ✓ Edit 1 validated
5. ✗ Edit 2 validation failed (not found)
6. → File restored from backup
7. → Backup deleted
8. → No changes made to file

---

## Example 3: Conflict Detection - Overlapping Edits

### Input File (example.ts)
```typescript
const fullName = 'Alice Smith';
```

### MultiEdit Request
```json
{
  "file_path": "/path/to/example.ts",
  "edits": [
    {
      "old_string": "fullName = 'Alice Smith'",
      "new_string": "fullName = 'Bob Jones'"
    },
    {
      "old_string": "'Alice Smith'",
      "new_string": "'Alice Johnson'"
    }
  ]
}
```

### Expected Output (Error)
```
Detected 1 conflict(s) between edits:
- Edits 1 and 2 overlap in the file (positions 6-30 and 17-31)

No changes were made.
```

### Transaction Flow
1. ✓ Input validation passed
2. ✓ Backup created
3. ✗ Conflict detected between Edit 1 and Edit 2
4. → Backup deleted
5. → No changes made to file

---

## Example 4: Critical Error with Backup Preservation

### Scenario
File write fails due to permissions or disk full

### Expected Output (Error)
```
Failed to write file: EACCES: permission denied

Transaction rolled back from backup.
```

### If Rollback Also Fails
```
Critical error: EACCES: permission denied

Failed to rollback: ENOSPC: no space left on device

Backup file preserved at: /path/to/example.ts.backup.1703123456789
```

### Transaction Flow
1. ✓ Input validation passed
2. ✓ Backup created
3. ✓ No conflicts detected
4. ✓ All edits validated
5. ✓ All edits applied (in memory)
6. ✗ File write failed
7. → Attempted rollback from backup
8. → If rollback succeeds: file restored, backup deleted
9. → If rollback fails: backup preserved for manual recovery

---

## Key Features Demonstrated

### 1. **Atomic Transactions**
- All edits succeed together or fail together
- No partial edits left in the file

### 2. **Automatic Backup**
- Created before any changes: `file.backup.{timestamp}`
- Deleted on success
- Used for rollback on failure
- Preserved on critical errors

### 3. **Conflict Detection**
- Detects overlapping edit regions
- Identifies nested replacement issues
- Prevents edits from interfering with each other

### 4. **Comprehensive Validation**
- Validates all edits before applying any
- Checks for empty old_string
- Ensures old_string != new_string
- Verifies old_string exists and is unique

### 5. **Detailed Error Reporting**
- Indicates which edit failed (Edit 1, Edit 2, etc.)
- Shows exactly what went wrong
- Reports how many edits were validated before failure
- Provides file statistics on success

### 6. **Robust Error Handling**
- Handles validation errors
- Handles file I/O errors
- Handles unexpected exceptions
- Graceful degradation (preserves backup on critical errors)

---

## Comparison with Old Implementation

| Feature | Old Implementation | New Implementation |
|---------|-------------------|-------------------|
| Backup | In-memory only | Physical file backup |
| Rollback | Memory variable | File system restore |
| Conflict Detection | None | Full overlap detection |
| Error Detail | Basic | Comprehensive |
| Recovery | Manual | Automatic |
| Critical Error Handling | Lost data risk | Backup preserved |
| Transaction Phases | 3 | 8 distinct phases |
| Position Tracking | No | Yes (with char diff) |

