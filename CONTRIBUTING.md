# Contributing to Claude Code Open

Welcome! Thank you for your interest in contributing to Claude Code Open, an educational reverse-engineering project that recreates Claude Code CLI functionality.

We appreciate all forms of contribution - whether it's fixing bugs, adding features, improving documentation, or sharing ideas. This guide will help you get started.

---

## Table of Contents

- [Welcome Contributors](#welcome-contributors)
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Requirements](#documentation-requirements)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Project Architecture](#project-architecture)
- [Contact and Support](#contact-and-support)

---

## Welcome Contributors

### About This Project

Claude Code Open is an **educational reverse-engineering project** that recreates the Claude Code CLI (v2.0.76). This is NOT the official Claude Code source code - it's a learning project built by analyzing public APIs, type definitions, and observed behavior.

**Project Goals:**
- Provide a functional TypeScript-based terminal AI assistant
- Demonstrate advanced CLI architecture patterns
- Serve as a learning resource for developers
- Explore AI agent capabilities and tool integration

### Ways to Contribute

- **Code Contributions**: Bug fixes, new features, performance improvements
- **Documentation**: Improve guides, add examples, fix typos
- **Testing**: Write tests, report bugs, verify fixes
- **Design**: UI/UX improvements for terminal interface
- **Ideas**: Share feature suggestions and architectural improvements
- **Community**: Help other users, answer questions

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone, regardless of experience level, background, or identity.

### Expected Behavior

- **Be Respectful**: Treat all contributors with respect and kindness
- **Be Constructive**: Provide helpful, actionable feedback
- **Be Collaborative**: Work together to solve problems
- **Be Patient**: Remember that everyone is learning
- **Be Professional**: Keep discussions focused and productive

### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling, insulting comments, or inflammatory language
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

### Enforcement

Violations of this code of conduct may result in temporary or permanent exclusion from the project. Please report issues to the project maintainers.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **Git** for version control
- **TypeScript** knowledge (this is a TypeScript project)
- **Anthropic API Key** for testing (get one at console.anthropic.com)

### Fork and Clone

1. **Fork the repository** on GitHub by clicking the "Fork" button

2. **Clone your fork** to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/claude-code-open.git
   cd claude-code-open
   ```

3. **Add upstream remote** to keep your fork in sync:
   ```bash
   git remote add upstream https://github.com/kill136/claude-code-open.git
   ```

4. **Verify remotes**:
   ```bash
   git remote -v
   # origin    https://github.com/YOUR-USERNAME/claude-code-open.git (fetch)
   # origin    https://github.com/YOUR-USERNAME/claude-code-open.git (push)
   # upstream  https://github.com/kill136/claude-code-open.git (fetch)
   # upstream  https://github.com/kill136/claude-code-open.git (push)
   ```

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Configure API Key

You need an Anthropic API key to test the CLI. Set it up using one of these methods:

**Option 1: Environment Variable**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Option 2: Configuration File**
Create `~/.claude/settings.json`:
```json
{
  "apiKey": "sk-ant-...",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

### Development Commands

```bash
# Run in development mode (live TypeScript execution)
npm run dev

# Build TypeScript to dist/
npm run build

# Run compiled version
npm run start
# or
node dist/cli.js

# Type checking without compiling
npx tsc --noEmit

# Clean build artifacts
rm -rf dist/
```

### Create a Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

**Branch Naming Conventions:**
- `feature/add-new-tool` - New features
- `fix/broken-command` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/improve-session` - Code refactoring
- `test/add-unit-tests` - Testing additions
- `perf/optimize-parser` - Performance improvements

---

## Commit Message Guidelines

We follow the **Conventional Commits** specification for clear, structured commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Changes to build process or auxiliary tools
- **revert**: Reverts a previous commit

### Scope (Optional)

The scope should specify the area of change:
- `tools` - Tool system changes
- `session` - Session management
- `ui` - User interface components
- `core` - Core engine changes
- `config` - Configuration system
- `cli` - CLI argument parsing
- `hooks` - Hook system
- `plugins` - Plugin system
- `mcp` - MCP integration

### Subject

- Use imperative, present tense: "add" not "added" or "adds"
- Don't capitalize first letter
- No period at the end
- Limit to 50 characters

### Body (Optional)

- Provide additional context
- Explain what and why, not how
- Wrap at 72 characters

### Footer (Optional)

- Reference issues: `Closes #123` or `Fixes #456`
- Breaking changes: `BREAKING CHANGE: description`

### Examples

**Good Commit Messages:**

```
feat(tools): add WebSearch tool with domain filtering

Implements new WebSearch tool that allows Claude to search the web
and retrieve current information. Includes support for allowed/blocked
domain lists.

Closes #45
```

```
fix(session): prevent session corruption on interrupt

Fixed race condition where Ctrl+C during save could corrupt session
files. Now uses atomic writes with temp file + rename.

Fixes #67
```

```
docs: update CLAUDE.md with Windows-specific notes

Added section covering Windows compatibility issues including path
handling, environment variables, and platform-specific features.
```

```
refactor(core): simplify conversation loop error handling

Consolidated error handling logic in ConversationLoop to reduce
duplication and improve readability. No functional changes.
```

**Bad Commit Messages:**

```
❌ Updated stuff
❌ fix bug
❌ Added new feature to tools (WIP)
❌ Fixed the thing that was broken yesterday
```

---

## Pull Request Process

### Before Submitting

1. **Ensure your code builds**:
   ```bash
   npm run build
   ```

2. **Run type checking**:
   ```bash
   npx tsc --noEmit
   ```

3. **Test your changes manually**:
   ```bash
   npm run dev
   ```

4. **Update documentation** if needed (README.md, CLAUDE.md, etc.)

5. **Commit your changes** following commit guidelines

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Creating the PR

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template (see below)
5. Submit the PR

### PR Template

```markdown
## Description
<!-- Provide a clear description of what this PR does -->

## Type of Change
<!-- Mark the relevant option with an [x] -->
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement

## Related Issues
<!-- Link related issues: Closes #123, Fixes #456 -->

## Changes Made
<!-- List the specific changes in bullet points -->
-
-
-

## Testing
<!-- Describe how you tested these changes -->
- [ ] Tested manually with `npm run dev`
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Verified on platform: (Windows/macOS/Linux)

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Checklist
- [ ] My code follows the project's code standards
- [ ] I have updated documentation as needed
- [ ] My commit messages follow the commit guidelines
- [ ] I have added comments for complex logic
- [ ] My changes generate no new warnings
```

### Code Review Process

1. **Automated Checks**: CI will run type checking and build verification
2. **Maintainer Review**: A project maintainer will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

### Merge Conditions

Your PR will be merged when:
- All CI checks pass
- Code review is approved by a maintainer
- No merge conflicts exist
- Commit messages follow guidelines
- Documentation is updated (if needed)

---

## Code Standards

### TypeScript Guidelines

**Use Strict TypeScript:**
```typescript
// Good: Explicit types
function processTool(tool: BaseTool, input: ToolInput): Promise<ToolResult> {
  // ...
}

// Bad: Implicit any
function processTool(tool, input) {
  // ...
}
```

**Prefer Interfaces for Objects:**
```typescript
// Good
interface SessionMetadata {
  id: string;
  model: string;
  createdAt: number;
}

// Avoid (use type for unions/primitives)
type SessionMetadata = {
  id: string;
  model: string;
  createdAt: number;
}
```

**Use Zod for Runtime Validation:**
```typescript
import { z } from 'zod';

const ToolInputSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
});

type ToolInput = z.infer<typeof ToolInputSchema>;
```

**Follow ES Module Syntax:**
```typescript
// Good: Named imports
import { ToolRegistry } from './tools/index.js';

// Good: Default imports
import chalk from 'chalk';

// Bad: CommonJS
const chalk = require('chalk');
```

### Code Style

- **Indentation**: 2 spaces (not tabs)
- **Line Length**: 100 characters max (flexible for readability)
- **Semicolons**: Use them
- **Quotes**: Single quotes for strings, double for JSX
- **Trailing Commas**: Use them in multiline arrays/objects
- **Async/Await**: Prefer over raw Promises

**Example:**
```typescript
export class MyTool extends BaseTool {
  constructor() {
    super({
      name: 'my_tool',
      description: 'Description here',
    });
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const result = await someAsyncOperation(input);

    return {
      success: true,
      output: result,
    };
  }
}
```

### File Organization

```
src/
├── cli.ts              # Entry point
├── index.ts            # Main export barrel
├── core/               # Core engine
│   ├── client.ts
│   ├── session.ts
│   └── loop.ts
├── tools/              # Tool implementations
│   ├── bash.ts
│   ├── file.ts
│   └── index.ts
├── ui/                 # React + Ink UI
│   └── components/
├── config/             # Configuration
├── session/            # Session management
└── types/              # TypeScript types
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (no `I` prefix)
- **Types**: `PascalCase`

---

## Testing Guidelines

### Manual Testing

Currently, the project relies on manual testing:

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Test your changes**:
   ```bash
   npm run dev "Test prompt"
   ```

3. **Test different scenarios**:
   - Different tools
   - Different models
   - Session persistence
   - Error handling

### Testing Checklist

When testing your changes:
- [ ] Basic functionality works
- [ ] Error cases are handled gracefully
- [ ] UI renders correctly in terminal
- [ ] No TypeScript compilation errors
- [ ] No runtime warnings or errors
- [ ] Works on your platform (Windows/macOS/Linux)
- [ ] Session persistence works (if applicable)
- [ ] Tool integration works (if applicable)

### Future: Automated Tests

We welcome contributions to add automated testing:
- Unit tests with Jest or Vitest
- Integration tests for tool execution
- E2E tests for CLI flows

---

## Documentation Requirements

### When to Update Documentation

Update documentation when you:
- Add a new feature
- Change existing behavior
- Add new configuration options
- Add new tools
- Change CLI commands or flags
- Fix bugs that users should know about

### Documentation Files

- **README.md**: User-facing project overview and quick start
- **CLAUDE.md**: Project instructions for Claude Code
- **CONTRIBUTING.md**: This file (contribution guidelines)
- **docs/**: Detailed documentation for specific features
- **Code Comments**: Inline documentation for complex logic

### Documentation Style

**Use Clear Headings:**
```markdown
## Main Section

### Subsection

#### Detail
```

**Provide Code Examples:**
```markdown
Example usage:
​```typescript
const session = new Session({ id: 'test' });
​```
```

**Include Screenshots for UI Changes:**
Use terminal screenshots for UI component changes.

**Keep It Up-to-Date:**
Documentation should match the actual implementation.

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Update to latest version** to see if it's already fixed
3. **Gather information** about your environment

### Bug Report Template

When reporting bugs, include:

```markdown
## Bug Description
<!-- Clear description of the bug -->

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
<!-- What should happen -->

## Actual Behavior
<!-- What actually happens -->

## Environment
- OS: [e.g., macOS 14.0, Windows 11, Ubuntu 22.04]
- Node.js version: [e.g., 20.10.0]
- npm version: [e.g., 10.2.3]
- Project version: [e.g., 2.0.76]

## Additional Context
<!-- Screenshots, logs, error messages -->

## Possible Solution
<!-- If you have ideas on how to fix it -->
```

### What Makes a Good Bug Report?

- **Specific**: Detailed steps to reproduce
- **Complete**: All relevant information included
- **Concise**: No unnecessary details
- **Tested**: Verified on latest version
- **Respectful**: Remember maintainers are volunteers

---

## Feature Requests

### Feature Request Template

```markdown
## Feature Description
<!-- Clear description of the proposed feature -->

## Problem it Solves
<!-- What problem does this feature address? -->

## Proposed Solution
<!-- How would this feature work? -->

## Alternatives Considered
<!-- What other approaches did you consider? -->

## Implementation Ideas
<!-- If you have technical ideas on how to implement this -->

## Additional Context
<!-- Screenshots, mockups, examples from other projects -->
```

### Evaluating Feature Requests

We consider:
- **Alignment**: Does it fit the project goals?
- **Value**: Will it benefit many users?
- **Complexity**: Is it feasible to implement?
- **Maintenance**: Can it be maintained long-term?

---

## Project Architecture

Understanding the architecture helps you contribute effectively.

### Core Components

1. **Entry Layer** (`src/cli.ts`, `src/index.ts`)
   - CLI argument parsing with Commander.js
   - Application initialization

2. **Core Engine** (`src/core/`)
   - `client.ts`: Anthropic API wrapper
   - `session.ts`: Session state management
   - `loop.ts`: Conversation orchestrator

3. **Tool System** (`src/tools/`)
   - 25+ tools extending `BaseTool`
   - `ToolRegistry` for dynamic management

4. **UI Layer** (`src/ui/`)
   - React + Ink terminal interface
   - Reusable components

5. **Supporting Systems**
   - Session persistence (`src/session/`)
   - Configuration (`src/config/`)
   - Context management (`src/context/`)
   - Hooks (`src/hooks/`)
   - Plugins (`src/plugins/`)

### Key Design Patterns

- **Registry Pattern**: `ToolRegistry` for tool management
- **Plugin Pattern**: `PluginManager` with lifecycle hooks
- **Strategy Pattern**: Multiple permission modes
- **Observer Pattern**: Event-driven hook system
- **Factory Pattern**: Tool instantiation

### Adding a New Tool

Example structure:
```typescript
import { BaseTool } from './base.js';
import { z } from 'zod';

const InputSchema = z.object({
  // Define input schema
});

export class MyTool extends BaseTool {
  constructor() {
    super({
      name: 'my_tool',
      description: 'Tool description',
      inputSchema: InputSchema,
    });
  }

  async execute(input: z.infer<typeof InputSchema>) {
    // Implementation
    return {
      success: true,
      output: 'Result',
    };
  }
}

// Register in src/tools/index.ts
```

---

## Contact and Support

### Project Maintainers

- **Primary Maintainer**: kill136 (GitHub)

### Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community discussion
- **Pull Requests**: For code contributions

### Getting Help

1. **Check Documentation**: README.md and CLAUDE.md
2. **Search Issues**: Someone may have asked already
3. **Ask in Discussions**: Community can help
4. **Open an Issue**: If you found a bug or need a feature

### Response Times

This is a community project maintained by volunteers. Please be patient:
- Issues: Typically reviewed within a week
- Pull Requests: Reviewed as time permits
- Questions: Community-driven responses

---

## Thank You!

Thank you for contributing to Claude Code Open! Every contribution, no matter how small, helps make this project better.

**Remember:**
- Be respectful and collaborative
- Follow the guidelines
- Ask questions when unsure
- Have fun learning!

Happy coding! 🚀
