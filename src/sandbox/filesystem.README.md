# Filesystem Sandbox

A comprehensive path-based access control system for filesystem operations, providing security through policy-based sandboxing.

## Features

### 1. Path Validation
- Rule-based access control with allow/deny lists
- Pattern matching with wildcards (`*`, `**`, `?`)
- Operation-specific permissions (read, write, execute)
- Case-sensitive and case-insensitive matching

### 2. Path Normalization
- Resolves symbolic links
- Handles relative paths (`.`, `..`)
- Converts to absolute paths
- Cross-platform path handling

### 3. Access Control
- Three levels: read, write, execute
- Deny rules take precedence over allow rules
- Configurable default action (allow/deny)
- Dynamic policy modification

### 4. Temporary Directory Management
- Isolated temporary directories
- Automatic cleanup on exit
- Multiple temp directories per sandbox
- Graceful error handling

## Installation

```typescript
import {
  FilesystemSandbox,
  createDefaultPolicy,
  createStrictPolicy,
  createPermissivePolicy,
} from '@/sandbox/filesystem.js';
```

## Quick Start

### Basic Usage

```typescript
// Create sandbox with default policy
const policy = createDefaultPolicy('/home/user/projects');
const sandbox = new FilesystemSandbox(policy);

// Check access
if (sandbox.isPathAllowed('/home/user/projects/file.txt', 'read')) {
  // Access is allowed
}

// Wrap filesystem
const fs = sandbox.wrapFs();
await fs.readFile('/home/user/projects/file.txt', 'utf-8');
```

### Custom Policy

```typescript
const policy: FilesystemPolicy = {
  allowedPaths: [
    {
      pattern: '/home/user/projects/**',
      operations: ['read', 'write'],
      description: 'Project directory',
    },
    {
      pattern: '/tmp/**',
      description: 'Temp directory',
    },
  ],
  deniedPaths: [
    {
      pattern: '/home/user/.ssh/**',
      description: 'SSH keys',
    },
  ],
  defaultAction: 'deny',
};

const sandbox = new FilesystemSandbox(policy);
```

## API Reference

### FilesystemSandbox Class

#### Constructor

```typescript
constructor(policy: FilesystemPolicy)
```

Creates a new sandbox with the specified policy.

#### Methods

##### isPathAllowed()

```typescript
isPathAllowed(path: string, operation: 'read' | 'write' | 'execute'): boolean
```

Checks if a path is allowed for the specified operation.

**Example:**
```typescript
const allowed = sandbox.isPathAllowed('/home/user/file.txt', 'read');
```

##### normalizePath()

```typescript
normalizePath(path: string): string
```

Normalizes a path by resolving `.`, `..`, and symbolic links.

**Example:**
```typescript
const normalized = sandbox.normalizePath('../file.txt');
// Returns: /home/user/file.txt
```

##### resolvePath()

```typescript
resolvePath(path: string, base?: string): string
```

Resolves a path relative to a base directory.

**Example:**
```typescript
const resolved = sandbox.resolvePath('src/main.ts', '/home/user/project');
// Returns: /home/user/project/src/main.ts
```

##### createTempDir()

```typescript
async createTempDir(prefix = 'claude-sandbox-'): Promise<string>
```

Creates an isolated temporary directory.

**Example:**
```typescript
const tempDir = await sandbox.createTempDir('my-project-');
// Returns: /tmp/my-project-abc123
```

##### cleanupTempDirs()

```typescript
async cleanupTempDirs(): Promise<void>
```

Cleans up all temporary directories created by this sandbox.

**Example:**
```typescript
await sandbox.cleanupTempDirs();
```

##### wrapFs()

```typescript
wrapFs(): SandboxedFs
```

Returns a wrapped filesystem interface with sandbox checks.

**Example:**
```typescript
const fs = sandbox.wrapFs();
await fs.writeFile('/tmp/test.txt', 'Hello!');
```

##### addAllowedPath()

```typescript
addAllowedPath(rule: PathRule): void
```

Adds a new allowed path rule.

**Example:**
```typescript
sandbox.addAllowedPath({
  pattern: '/opt/data/**',
  operations: ['read'],
  description: 'Read-only data',
});
```

##### addDeniedPath()

```typescript
addDeniedPath(rule: PathRule): void
```

Adds a new denied path rule.

**Example:**
```typescript
sandbox.addDeniedPath({
  pattern: '/etc/shadow',
  description: 'System passwords',
});
```

##### removePathRule()

```typescript
removePathRule(pattern: string, listType: 'allowed' | 'denied'): boolean
```

Removes a path rule from the specified list.

**Example:**
```typescript
const removed = sandbox.removePathRule('/tmp/**', 'allowed');
```

### Helper Functions

#### matchPathPattern()

```typescript
matchPathPattern(path: string, pattern: string, caseSensitive = true): boolean
```

Matches a path against a pattern with wildcard support.

**Pattern Syntax:**
- `*` - Matches any characters except path separator
- `**` - Matches any characters including path separator
- `?` - Matches single character except path separator

**Examples:**
```typescript
matchPathPattern('/home/user/file.txt', '/home/user/*.txt');     // true
matchPathPattern('/home/user/a/b/c.ts', '/home/user/**/*.ts');   // true
matchPathPattern('/home/user/test.js', '/home/user/*.ts');       // false
```

#### isPathInside()

```typescript
isPathInside(childPath: string, parentPath: string): boolean
```

Checks if a child path is inside a parent path.

**Example:**
```typescript
isPathInside('/home/user/projects/file.txt', '/home/user/projects');  // true
isPathInside('/etc/passwd', '/home/user');                             // false
```

### Policy Factory Functions

#### createDefaultPolicy()

```typescript
createDefaultPolicy(cwd?: string): FilesystemPolicy
```

Creates a balanced policy with common allowed/denied paths.

**Allowed:**
- Working directory
- System temp directory
- `~/.claude/` directory

**Denied:**
- `~/.ssh/` (SSH keys)
- `~/.aws/` (AWS credentials)
- `~/.gnupg/` (GPG keys)
- `/etc/shadow` (system passwords)

#### createPermissivePolicy()

```typescript
createPermissivePolicy(): FilesystemPolicy
```

Creates a permissive policy that allows most operations.

**Allowed:**
- All paths (`/**`)

**Denied:**
- `~/.ssh/` (SSH keys)
- `/etc/shadow` (system passwords)

#### createStrictPolicy()

```typescript
createStrictPolicy(workDir?: string): FilesystemPolicy
```

Creates a strict policy with minimal access.

**Allowed:**
- Working directory only
- Sandbox temp directories only

**Denied:**
- Everything else

### Utility Functions

#### validatePolicy()

```typescript
validatePolicy(policy: FilesystemPolicy): { valid: boolean; errors: string[] }
```

Validates a filesystem policy.

**Example:**
```typescript
const result = validatePolicy(myPolicy);
if (!result.valid) {
  console.error('Policy errors:', result.errors);
}
```

#### mergePolicies()

```typescript
mergePolicies(...policies: FilesystemPolicy[]): FilesystemPolicy
```

Merges multiple policies (later policies override earlier ones).

**Example:**
```typescript
const merged = mergePolicies(basePolicy, customPolicy);
```

#### getSandboxStats()

```typescript
getSandboxStats(sandbox: FilesystemSandbox): SandboxStats
```

Gets statistics about a sandbox instance.

**Example:**
```typescript
const stats = getSandboxStats(sandbox);
console.log('Temp directories:', stats.tempDirsCount);
console.log('Allowed rules:', stats.allowedRulesCount);
```

## Types

### PathRule

```typescript
interface PathRule {
  pattern: string;
  operations?: Array<'read' | 'write' | 'execute'>;
  description?: string;
}
```

### FilesystemPolicy

```typescript
interface FilesystemPolicy {
  allowedPaths: PathRule[];
  deniedPaths: PathRule[];
  defaultAction: 'allow' | 'deny';
  caseSensitive?: boolean;
}
```

### SandboxedFs

```typescript
interface SandboxedFs {
  readFile: typeof fs.promises.readFile;
  writeFile: typeof fs.promises.writeFile;
  readdir: typeof fs.promises.readdir;
  stat: typeof fs.promises.stat;
  mkdir: typeof fs.promises.mkdir;
  rm: typeof fs.promises.rm;
  exists: (path: string) => Promise<boolean>;
  realpath: (path: string) => Promise<string>;
}
```

### SandboxStats

```typescript
interface SandboxStats {
  tempDirsCount: number;
  allowedRulesCount: number;
  deniedRulesCount: number;
  defaultAction: 'allow' | 'deny';
}
```

## Pattern Matching Examples

### Basic Wildcards

```typescript
// Single directory level
'/home/user/*.txt'         // Matches: /home/user/file.txt
                          // Not: /home/user/dir/file.txt

// Multiple directory levels
'/home/user/**/*.txt'      // Matches: /home/user/a/b/c/file.txt

// Single character
'/home/user/file?.txt'     // Matches: /home/user/file1.txt, file2.txt
```

### Common Patterns

```typescript
// All TypeScript files in project
'/home/user/project/**/*.ts'

// All files in home directory
'/home/user/**'

// Specific directory tree
'/opt/app/**'

// Temp files
'/tmp/claude-*/**'
```

## Use Cases

### 1. Development Environment

```typescript
const policy = createDefaultPolicy('/home/user/workspace');
policy.allowedPaths.push({
  pattern: '/usr/local/lib/**',
  operations: ['read'],
  description: 'System libraries',
});

const sandbox = new FilesystemSandbox(policy);
```

### 2. CI/CD Pipeline

```typescript
const policy = createStrictPolicy('/build');
const sandbox = new FilesystemSandbox(policy);
const fs = sandbox.wrapFs();

// Only build directory is accessible
await fs.writeFile('/build/output.js', code);
```

### 3. Plugin System

```typescript
const policy = {
  allowedPaths: [
    { pattern: '/plugins/*/data/**', operations: ['read', 'write'] },
    { pattern: '/plugins/*/config.json', operations: ['read'] },
  ],
  deniedPaths: [],
  defaultAction: 'deny',
};
```

### 4. Multi-Tenant System

```typescript
function createTenantSandbox(tenantId: string) {
  const policy = {
    allowedPaths: [
      { pattern: `/tenants/${tenantId}/**` },
      { pattern: '/shared/readonly/**', operations: ['read'] },
    ],
    deniedPaths: [
      { pattern: `/tenants/${tenantId}/private/**` },
    ],
    defaultAction: 'deny',
  };

  return new FilesystemSandbox(policy);
}
```

## Security Considerations

### 1. Symbolic Links
The sandbox resolves symbolic links during normalization. This prevents escaping the sandbox via symlinks.

### 2. Relative Paths
All paths are normalized to absolute paths, preventing `..` traversal attacks.

### 3. Deny Precedence
Deny rules always take precedence over allow rules, ensuring critical paths remain protected.

### 4. Default Deny
Use `defaultAction: 'deny'` for security-critical applications.

### 5. Operation Granularity
Specify operations (`read`, `write`, `execute`) to limit what can be done with allowed paths.

## Performance

### Path Resolution
- Path normalization is cached where possible
- Pattern matching uses optimized regex
- Minimal filesystem operations

### Memory
- Policies are lightweight (just rules in memory)
- Temp directories are tracked but not loaded into memory
- Automatic cleanup prevents leaks

## Troubleshooting

### Access Denied Errors

```typescript
try {
  await fs.readFile('/some/path');
} catch (error) {
  if (error.message.includes('Access denied')) {
    // Check policy
    console.log('Allowed?', sandbox.isPathAllowed('/some/path', 'read'));
    console.log('Policy:', sandbox.getPolicy());
  }
}
```

### Debugging Policies

```typescript
// Log all rules
const policy = sandbox.getPolicy();
console.log('Allowed:', policy.allowedPaths);
console.log('Denied:', policy.deniedPaths);
console.log('Default:', policy.defaultAction);

// Validate policy
const validation = validatePolicy(policy);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}
```

### Temp Directory Cleanup

```typescript
// Manual cleanup
await sandbox.cleanupTempDirs();

// Check cleanup
const stats = getSandboxStats(sandbox);
console.log('Remaining temp dirs:', stats.tempDirsCount);
```

## Integration Examples

### With Express.js

```typescript
app.post('/upload', async (req, res) => {
  const sandbox = new FilesystemSandbox(
    createStrictPolicy('/uploads')
  );
  const fs = sandbox.wrapFs();

  try {
    await fs.writeFile(`/uploads/${req.file.name}`, req.file.data);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: 'Access denied' });
  } finally {
    await sandbox.cleanupTempDirs();
  }
});
```

### With Worker Threads

```typescript
// main.ts
const sandbox = new FilesystemSandbox(createDefaultPolicy());
const policy = sandbox.getPolicy();

const worker = new Worker('./worker.js', {
  workerData: { policy },
});

// worker.ts
import { workerData } from 'worker_threads';
const sandbox = new FilesystemSandbox(workerData.policy);
```

## Best Practices

1. **Start Strict**: Begin with `createStrictPolicy()` and add rules as needed
2. **Validate Policies**: Always validate custom policies with `validatePolicy()`
3. **Use Operations**: Specify read/write/execute for fine-grained control
4. **Cleanup**: Always cleanup temp directories, especially in long-running processes
5. **Test Patterns**: Test path patterns thoroughly before deployment
6. **Document Rules**: Add descriptions to all path rules for maintainability
7. **Merge Carefully**: When merging policies, later rules override earlier ones

## Implementation Details

### Line Count
- Total: **649 lines**
- Interfaces: ~60 lines
- Core class: ~250 lines
- Utilities: ~340 lines

### Dependencies
- Node.js built-in modules only: `fs`, `path`, `os`, `util`
- Zero external dependencies
- Cross-platform compatible

### Browser Support
Not applicable (requires Node.js filesystem access)

### Node.js Versions
- Minimum: Node.js 16+
- Recommended: Node.js 18+
- Uses ES Modules

## License

Part of the Claude Code CLI project.
