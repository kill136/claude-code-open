# Tool Results Type Definitions

Quick reference guide for `/src/types/results.ts`

## Overview

This file provides comprehensive TypeScript type definitions for all Claude Code tool output types. All types extend from the base `ToolResult` interface and include full JSDoc documentation.

## Quick Import

```typescript
import type {
  // Base types
  ToolResult,
  ToolSuccess,
  ToolError,
  
  // Specific tool results
  BashToolResult,
  ReadToolResult,
  WriteToolResult,
  EditToolResult,
  GlobToolResult,
  GrepToolResult,
  WebFetchToolResult,
  WebSearchToolResult,
  AgentToolResult,
  TodoWriteToolResult,
  NotebookEditToolResult,
  
  // Type guards
  isToolSuccess,
  isToolError,
  isBashResult,
  
  // Helper functions
  createToolSuccess,
  createToolError,
  formatToolResult,
} from './results.js';
```

## Type Categories

### 1. Base Types (4)
- `ToolResult` - Base interface
- `ToolSuccess` - Success result
- `ToolError` - Error result  
- `ToolOutput` - Union type

### 2. Bash Tools (3)
- `BashToolResult`
- `BashOutputResult`
- `KillShellResult`

### 3. File Operations (4)
- `ReadToolResult`
- `WriteToolResult`
- `EditToolResult`
- `MultiEditToolResult`

### 4. Search Tools (2)
- `GlobToolResult`
- `GrepToolResult`

### 5. Web Tools (2)
- `WebFetchToolResult`
- `WebSearchToolResult`

### 6. Task/Agent Tools (3)
- `AgentToolResult`
- `TaskOutputToolResult`
- `ListAgentsToolResult`

### 7. Other Tools (11)
- `TodoWriteToolResult`
- `NotebookEditToolResult`
- `ListMcpResourcesToolResult`
- `ReadMcpResourceToolResult`
- `McpToolResult`
- `AskUserQuestionToolResult`
- `SkillToolResult`
- `SlashCommandToolResult`
- `EnterPlanModeToolResult`
- `ExitPlanModeToolResult`
- `TmuxToolResult`

## Utilities

### Type Guards (7)
```typescript
isToolSuccess(result: ToolResult): result is ToolSuccess
isToolError(result: ToolResult): result is ToolError
isBashResult(result: ToolResult): result is BashToolResult
isFileResult(result: ToolResult): result is ReadToolResult | WriteToolResult | EditToolResult
isGrepResult(result: ToolResult): result is GrepToolResult
isAgentResult(result: ToolResult): result is AgentToolResult | TaskOutputToolResult
isWebResult(result: ToolResult): result is WebFetchToolResult | WebSearchToolResult
```

### Helper Functions (6)
```typescript
createToolSuccess(output: string, additionalProps?: Partial<ToolResult>): ToolSuccess
createToolError(error: string, additionalProps?: Partial<ToolResult>): ToolError
formatToolResult(result: ToolResult): string
getErrorMessage(result: ToolResult): string | undefined
getOutput(result: ToolResult): string | undefined
hasProperty<K extends string>(result: ToolResult, property: K): result is ToolResult & Record<K, any>
```

## Usage Examples

### Creating Results
```typescript
const success = createToolSuccess('Operation completed');
const error = createToolError('Operation failed');
```

### Type Checking
```typescript
function handleBashResult(result: BashToolResult) {
  if (isToolSuccess(result)) {
    console.log('Exit code:', result.exitCode);
    console.log('Output:', result.stdout);
  } else if (isToolError(result)) {
    console.error('Error:', result.error);
  }
}
```

### Type-Safe Result Processing
```typescript
function processFileResult(result: ReadToolResult | WriteToolResult | EditToolResult) {
  if (isFileResult(result)) {
    if ('content' in result) {
      // ReadToolResult
      console.log('File content:', result.content);
    } else if ('bytesWritten' in result) {
      // WriteToolResult
      console.log('Bytes written:', result.bytesWritten);
    } else if ('replacements' in result) {
      // EditToolResult
      console.log('Replacements:', result.replacements);
    }
  }
}
```

## File Statistics

- **Total Lines**: 737
- **Exported Types**: 29 interfaces/types
- **Type Guards**: 7 functions
- **Helper Functions**: 6 functions
- **Backward Compatibility Aliases**: 3

## Integration

All types are automatically re-exported from `/src/types/index.ts`:

```typescript
export * from './results.js';
```

This allows importing from either location:
- `import { ... } from './types/results.js'` (direct)
- `import { ... } from './types/index.js'` (via barrel export)

## TypeScript Features Used

- Interface inheritance (`extends ToolResult`)
- Type unions (`ToolOutput = ToolSuccess | ToolError`)
- Literal types (`success: true`, `success: false`)
- Type guards with predicates (`result is ToolSuccess`)
- Generic type parameters (`<K extends string>`)
- Const assertions (`true as const`)
- Type assertions (`as ToolSuccess`)
- JSDoc annotations
- Optional properties (`property?:`)
- Record types (`Record<string, any>`)
- Tuple types in arrays

---

**Last Updated**: December 25, 2025
**Maintained By**: Claude Code Team
**TypeScript Version**: 5.x
