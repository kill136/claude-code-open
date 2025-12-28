# Autocomplete System

This module provides intelligent autocomplete functionality for the Claude Code CLI input system.

## Features

### 1. Slash Command Completion
Autocomplete for all available slash commands with the following features:
- 40+ commands with descriptions
- Command aliases support (e.g., `/help`, `/h`, `/?`)
- Priority-based sorting (most commonly used commands appear first)
- Smart filtering based on command names and aliases

**Usage:**
- Type `/` to see all available commands
- Type `/hel` to filter to commands starting with "hel"
- Use arrow keys to navigate suggestions
- Press `Tab` to accept the selected completion

**Example:**
```
> /he
/help (?, h) - Show help and available commands
/hooks - Manage hook configurations
```

### 2. File Path Completion
Intelligent file and directory path completion:
- Supports absolute and relative paths
- Automatically filters hidden files (unless explicitly typed)
- Directories appear before files
- Shows file/directory type in description
- Works with `.`, `..`, and `~/` prefixes

**Usage:**
- Type a path separator or `.` to trigger file completion
- Navigate suggestions with arrow keys
- Directories show with a trailing `/`
- Press `Tab` to accept

**Example:**
```
> ./src/
src/ui/ - Directory
src/tools/ - Directory
src/core/ - Directory
```

### 3. @mention Completion
Support for @file and @folder mentions in conversations:
- @file - Mention a specific file
- @folder - Mention a directory
- Smart file search across the project
- Ignores common build/dependency directories

**Usage:**
- Type `@` to see mention types
- Type `@config` to search for files matching "config"
- Use arrow keys and `Tab` to select

**Example:**
```
> @conf
@config.ts (File: src/config/index.ts)
@config.json (File: package.json)
```

## Architecture

### Modules

#### `types.ts`
Core type definitions:
- `CompletionItem` - Individual completion suggestion
- `CompletionContext` - Input context for completion
- `CompletionResult` - Completion query results

#### `commands.ts`
Command completion provider:
- `ALL_COMMANDS` - Complete list of 40+ slash commands
- `getCommandCompletions()` - Get matching command suggestions
- `isTypingCommand()` - Detect command input
- `extractCommandQuery()` - Extract command query text

#### `files.ts`
File path completion provider:
- `getFileCompletions()` - Get file/directory suggestions
- `isTypingFilePath()` - Detect path input
- `extractFileQuery()` - Extract path query text

#### `mentions.ts`
@mention completion provider:
- `getMentionCompletions()` - Get @mention suggestions
- `isTypingMention()` - Detect @mention input
- `extractMentionQuery()` - Extract mention query text

#### `index.ts`
Main autocomplete orchestrator:
- `getCompletions()` - Unified completion API
- `applyCompletion()` - Apply selected completion to text

## Usage in Components

```typescript
import { getCompletions, applyCompletion } from '../autocomplete/index.js';

// Get completions
const result = await getCompletions({
  fullText: value,
  cursorPosition: cursor,
  cwd: process.cwd(),
  enableFileCompletion: true,
  enableMentionCompletion: true,
});

// Apply selected completion
const { newText, newCursor } = applyCompletion(
  value,
  selectedItem,
  startPosition,
  cursorPosition
);
```

## Keyboard Controls

- **Arrow Up/Down**: Navigate suggestions
- **Tab**: Accept selected completion
- **Escape**: Close completion list
- **Continue typing**: Filter suggestions

## Performance

- Async file system operations for non-blocking UI
- Smart filtering to limit results (max 10 items by default)
- Debounced completion fetching on input change
- Ignores common directories (node_modules, .git, dist, etc.)

## Future Enhancements

- [ ] Fuzzy matching for better search
- [ ] MRU (Most Recently Used) sorting
- [ ] Custom completion providers via plugins
- [ ] Syntax-aware completions (e.g., npm package names)
- [ ] URL autocomplete for @url mentions
- [ ] Git branch/tag autocomplete
