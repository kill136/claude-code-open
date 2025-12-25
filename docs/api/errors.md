# Error Handling Documentation

Complete reference for the Claude Code error handling system.

## Table of Contents

- [Overview](#overview)
- [Error Codes](#error-codes)
- [Error Severity Levels](#error-severity-levels)
- [Error Classes](#error-classes)
- [Error Factory Functions](#error-factory-functions)
- [Error Type Guards](#error-type-guards)
- [Error Formatting](#error-formatting)
- [Best Practices](#best-practices)
- [Error Recovery Patterns](#error-recovery-patterns)

---

## Overview

The Claude Code error system provides a comprehensive, type-safe approach to error handling with:

- **Structured error codes** - Organized by category (1000-10999)
- **Severity levels** - Low, Medium, High, Critical
- **Recovery information** - Recoverable/non-recoverable, retryable/non-retryable
- **Error chaining** - Track cause chains for debugging
- **Context preservation** - Attach contextual data to errors
- **Type safety** - Full TypeScript support with type guards

### Key Features

1. **Automatic severity determination** based on error code
2. **Automatic recoverability** classification
3. **Automatic retryability** classification
4. **Stack trace preservation** with cause chains
5. **JSON serialization** for logging and transmission
6. **Rich metadata** support

---

## Error Codes

Error codes are organized into ranges by category:

### Code Ranges

| Range | Category | Description |
|-------|----------|-------------|
| 1000-1999 | Tool Errors | Tool execution failures |
| 2000-2999 | Permission Errors | Permission and access control |
| 3000-3999 | Configuration Errors | Configuration and settings |
| 4000-4999 | Network Errors | Network and connectivity |
| 5000-5999 | Authentication Errors | Authentication and authorization |
| 6000-6999 | Validation Errors | Input validation |
| 7000-7999 | Session Errors | Session management |
| 8000-8999 | Sandbox Errors | Sandbox and isolation |
| 9000-9999 | System Errors | System and filesystem |
| 10000-10999 | Plugin Errors | Plugin system |
| 99999 | Unknown Error | Unclassified errors |

### Tool Errors (1000-1999)

```typescript
enum ErrorCode {
  TOOL_EXECUTION_FAILED = 1000,    // General tool execution failure
  TOOL_NOT_FOUND = 1001,            // Tool not registered
  TOOL_TIMEOUT = 1002,              // Tool execution timeout
  TOOL_INVALID_INPUT = 1003,        // Invalid input parameters
  TOOL_INVALID_OUTPUT = 1004,       // Invalid output format
  TOOL_NOT_AVAILABLE = 1005,        // Tool not available
  TOOL_DISABLED = 1006,             // Tool is disabled
  TOOL_DEPENDENCY_MISSING = 1007,   // Tool dependency missing
}
```

**Example Usage:**
```typescript
import { ErrorCode, ToolExecutionError } from './types/index.js';

throw new ToolExecutionError(
  'Failed to execute grep command',
  'Grep',
  { code: ErrorCode.TOOL_EXECUTION_FAILED }
);
```

### Permission Errors (2000-2999)

```typescript
enum ErrorCode {
  PERMISSION_DENIED = 2000,           // General permission denied
  PERMISSION_PATH_DENIED = 2001,      // File path access denied
  PERMISSION_COMMAND_DENIED = 2002,   // Command execution denied
  PERMISSION_NETWORK_DENIED = 2003,   // Network access denied
  PERMISSION_TOOL_DENIED = 2004,      // Tool usage denied
  PERMISSION_CONFIG_INVALID = 2005,   // Invalid permission config
  PERMISSION_AUDIT_FAILED = 2006,     // Permission audit failed
}
```

**Example Usage:**
```typescript
import { createPermissionDeniedError } from './types/index.js';

throw createPermissionDeniedError(
  '/etc/passwd',
  'read',
  'Access to system files is restricted'
);
```

### Configuration Errors (3000-3999)

```typescript
enum ErrorCode {
  CONFIG_NOT_FOUND = 3000,            // Config file not found
  CONFIG_INVALID = 3001,              // Invalid configuration
  CONFIG_PARSE_ERROR = 3002,          // Failed to parse config
  CONFIG_VALIDATION_FAILED = 3003,    // Config validation failed
  CONFIG_WRITE_FAILED = 3004,         // Failed to write config
  CONFIG_MIGRATION_FAILED = 3005,     // Config migration failed
  CONFIG_SCHEMA_ERROR = 3006,         // Config schema error
  CONFIG_MISSING_REQUIRED = 3007,     // Required config missing
}
```

**Example Usage:**
```typescript
import { createConfigurationError } from './types/index.js';

throw createConfigurationError(
  'Invalid API key format',
  '~/.claude/settings.json',
  ['apiKey must be a non-empty string']
);
```

### Network Errors (4000-4999)

```typescript
enum ErrorCode {
  NETWORK_CONNECTION_FAILED = 4000,   // Connection failed
  NETWORK_TIMEOUT = 4001,             // Request timeout
  NETWORK_DNS_FAILED = 4002,          // DNS resolution failed
  NETWORK_SSL_ERROR = 4003,           // SSL/TLS error
  NETWORK_PROXY_ERROR = 4004,         // Proxy error
  NETWORK_RATE_LIMITED = 4005,        // Rate limit exceeded
  NETWORK_OFFLINE = 4006,             // Network offline
  NETWORK_HOST_UNREACHABLE = 4007,    // Host unreachable
}
```

**Example Usage:**
```typescript
import { createNetworkError } from './types/index.js';

throw createNetworkError(
  'Connection timeout',
  'https://api.anthropic.com',
  408
);
```

### Authentication Errors (5000-5999)

```typescript
enum ErrorCode {
  AUTH_FAILED = 5000,                  // Authentication failed
  AUTH_TOKEN_INVALID = 5001,           // Invalid token
  AUTH_TOKEN_EXPIRED = 5002,           // Token expired
  AUTH_TOKEN_MISSING = 5003,           // Token missing
  AUTH_OAUTH_FAILED = 5004,            // OAuth flow failed
  AUTH_DEVICE_CODE_FAILED = 5005,      // Device code flow failed
  AUTH_REFRESH_FAILED = 5006,          // Token refresh failed
  AUTH_INSUFFICIENT_PERMISSIONS = 5007,// Insufficient permissions
  AUTH_API_KEY_INVALID = 5008,         // Invalid API key
  AUTH_API_KEY_MISSING = 5009,         // API key missing
}
```

**Example Usage:**
```typescript
import { createAuthenticationError } from './types/index.js';

throw createAuthenticationError(
  'API key is invalid or expired',
  'api_key'
);
```

### Validation Errors (6000-6999)

```typescript
enum ErrorCode {
  VALIDATION_FAILED = 6000,            // General validation failure
  VALIDATION_SCHEMA_ERROR = 6001,      // Schema validation error
  VALIDATION_TYPE_ERROR = 6002,        // Type validation error
  VALIDATION_REQUIRED_FIELD = 6003,    // Required field missing
  VALIDATION_FORMAT_ERROR = 6004,      // Format validation error
  VALIDATION_RANGE_ERROR = 6005,       // Range validation error
  VALIDATION_CONSTRAINT_VIOLATION = 6006, // Constraint violation
}
```

**Example Usage:**
```typescript
import { createValidationError } from './types/index.js';

throw createValidationError(
  'Input validation failed',
  'file_path',
  [
    { field: 'file_path', message: 'Must be an absolute path' },
    { field: 'file_path', message: 'Cannot contain .. segments' }
  ]
);
```

### Session Errors (7000-7999)

```typescript
enum ErrorCode {
  SESSION_NOT_FOUND = 7000,            // Session not found
  SESSION_INVALID = 7001,              // Invalid session
  SESSION_EXPIRED = 7002,              // Session expired
  SESSION_SAVE_FAILED = 7003,          // Failed to save session
  SESSION_LOAD_FAILED = 7004,          // Failed to load session
  SESSION_CHECKPOINT_FAILED = 7005,    // Checkpoint failed
  SESSION_RESTORE_FAILED = 7006,       // Restore failed
  SESSION_NO_ACTIVE = 7007,            // No active session
}
```

**Example Usage:**
```typescript
import { createSessionError } from './types/index.js';

throw createSessionError(
  'Session has expired after 30 days',
  'sess_abc123'
);
```

### Sandbox Errors (8000-8999)

```typescript
enum ErrorCode {
  SANDBOX_INIT_FAILED = 8000,          // Sandbox initialization failed
  SANDBOX_EXEC_FAILED = 8001,          // Sandbox execution failed
  SANDBOX_RESOURCE_LIMIT = 8002,       // Resource limit exceeded
  SANDBOX_PATH_VIOLATION = 8003,       // Path access violation
  SANDBOX_NETWORK_BLOCKED = 8004,      // Network access blocked
  SANDBOX_NOT_AVAILABLE = 8005,        // Sandbox not available
  SANDBOX_CONFIG_INVALID = 8006,       // Invalid sandbox config
  SANDBOX_ESCAPE_ATTEMPT = 8007,       // Sandbox escape attempt
}
```

**Example Usage:**
```typescript
import { createSandboxError } from './types/index.js';

throw createSandboxError(
  'Memory limit exceeded',
  'bubblewrap',
  '512MB'
);
```

### System Errors (9000-9999)

```typescript
enum ErrorCode {
  SYSTEM_ERROR = 9000,                 // General system error
  SYSTEM_FILE_NOT_FOUND = 9001,        // File not found
  SYSTEM_FILE_READ_ERROR = 9002,       // File read error
  SYSTEM_FILE_WRITE_ERROR = 9003,      // File write error
  SYSTEM_DIRECTORY_NOT_FOUND = 9004,   // Directory not found
  SYSTEM_PATH_INVALID = 9005,          // Invalid path
  SYSTEM_PERMISSION_DENIED = 9006,     // System permission denied
  SYSTEM_OUT_OF_MEMORY = 9007,         // Out of memory
  SYSTEM_DISK_FULL = 9008,             // Disk full
  SYSTEM_PROCESS_FAILED = 9009,        // Process execution failed
}
```

**Example Usage:**
```typescript
import { createSystemError } from './types/index.js';

throw createSystemError(
  'Disk is full',
  'ENOSPC',
  'No space left on device'
);
```

### Plugin Errors (10000-10999)

```typescript
enum ErrorCode {
  PLUGIN_NOT_FOUND = 10000,            // Plugin not found
  PLUGIN_LOAD_FAILED = 10001,          // Failed to load plugin
  PLUGIN_INIT_FAILED = 10002,          // Plugin initialization failed
  PLUGIN_DEPENDENCY_MISSING = 10003,   // Plugin dependency missing
  PLUGIN_CIRCULAR_DEPENDENCY = 10004,  // Circular dependency detected
  PLUGIN_VERSION_MISMATCH = 10005,     // Version mismatch
  PLUGIN_INVALID_MANIFEST = 10006,     // Invalid plugin manifest
  PLUGIN_SECURITY_VIOLATION = 10007,   // Security violation
}
```

**Example Usage:**
```typescript
import { createPluginError } from './types/index.js';

throw createPluginError(
  'Plugin version mismatch',
  'my-plugin',
  '1.0.0'
);
```

---

## Error Severity Levels

```typescript
enum ErrorSeverity {
  LOW = 'low',          // Does not affect main functionality
  MEDIUM = 'medium',    // Partial functionality affected
  HIGH = 'high',        // Main functionality affected
  CRITICAL = 'critical',// System cannot operate
}
```

### Automatic Severity Assignment

Severity is automatically determined based on error code:

| Code Range | Default Severity | Examples |
|------------|-----------------|----------|
| 5000-5999 | HIGH | Authentication errors |
| 8000-8999 | HIGH | Sandbox errors |
| 9000-9999 | HIGH | System errors |
| 7000-7999 | MEDIUM | Session errors |
| 3000-3999 | MEDIUM | Configuration errors |
| Others | MEDIUM | Default |

### Override Severity

```typescript
const error = new BaseClaudeError(
  ErrorCode.TOOL_EXECUTION_FAILED,
  'Tool failed',
  { severity: ErrorSeverity.CRITICAL }  // Override default
);
```

---

## Error Classes

### BaseClaudeError

The base class for all Claude errors.

```typescript
class BaseClaudeError extends Error implements ClaudeError {
  code: ErrorCode;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  recoverable: boolean;
  retryable: boolean;
  timestamp: number;
  cause?: Error;
  context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: ErrorOptions
  );

  toJSON(): object;
}
```

**Example:**
```typescript
const error = new BaseClaudeError(
  ErrorCode.TOOL_EXECUTION_FAILED,
  'Failed to execute tool',
  {
    details: { toolName: 'Bash', command: 'ls' },
    context: { userId: '123', sessionId: 'abc' },
    cause: originalError
  }
);

console.log(error.code);        // 1000
console.log(error.severity);    // 'medium'
console.log(error.recoverable); // true
console.log(error.retryable);   // false
console.log(error.timestamp);   // 1703001234567
```

### Specialized Error Classes

#### ToolExecutionError

```typescript
class ToolExecutionError extends BaseClaudeError {
  toolName?: string;

  constructor(
    message: string,
    toolName?: string,
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new ToolExecutionError(
  'Grep command failed',
  'Grep',
  { details: { pattern: '.*', exitCode: 1 } }
);
```

#### PermissionDeniedError

```typescript
class PermissionDeniedError extends BaseClaudeError {
  resource?: string;
  permissionType?: string;

  constructor(
    message: string,
    resource?: string,
    permissionType?: string,
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new PermissionDeniedError(
  'Write access denied',
  '/etc/hosts',
  'write'
);
```

#### ConfigurationError

```typescript
class ConfigurationError extends BaseClaudeError {
  configPath?: string;
  validationErrors?: string[];

  constructor(
    message: string,
    configPath?: string,
    validationErrors?: string[],
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new ConfigurationError(
  'Invalid configuration',
  '~/.claude/settings.json',
  ['apiKey is required', 'model must be one of: sonnet, opus, haiku']
);
```

#### NetworkError

```typescript
class NetworkError extends BaseClaudeError {
  url?: string;
  statusCode?: number;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new NetworkError(
  'API request failed',
  'https://api.anthropic.com/v1/messages',
  503,
  { retryable: true }
);
```

#### AuthenticationError

```typescript
class AuthenticationError extends BaseClaudeError {
  authType?: string;

  constructor(
    message: string,
    authType?: string,
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new AuthenticationError(
  'Invalid API key',
  'api_key',
  { recoverable: false }
);
```

#### ValidationError

```typescript
class ValidationError extends BaseClaudeError {
  field?: string;
  validationErrors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    field?: string,
    validationErrors?: Array<{ field: string; message: string }>,
    options?: ErrorOptions
  );
}
```

**Example:**
```typescript
const error = new ValidationError(
  'Input validation failed',
  'file_path',
  [
    { field: 'file_path', message: 'Must be absolute path' },
    { field: 'content', message: 'Cannot be empty' }
  ]
);
```

#### SessionError

```typescript
class SessionError extends BaseClaudeError {
  sessionId?: string;

  constructor(
    message: string,
    sessionId?: string,
    options?: ErrorOptions
  );
}
```

#### SandboxError

```typescript
class SandboxError extends BaseClaudeError {
  sandboxType?: string;
  resourceLimit?: string;

  constructor(
    message: string,
    sandboxType?: string,
    resourceLimit?: string,
    options?: ErrorOptions
  );
}
```

#### PluginError

```typescript
class PluginError extends BaseClaudeError {
  pluginName?: string;
  pluginVersion?: string;

  constructor(
    message: string,
    pluginName?: string,
    pluginVersion?: string,
    options?: ErrorOptions
  );
}
```

#### SystemError

```typescript
class SystemError extends BaseClaudeError {
  systemCode?: string;
  systemMessage?: string;

  constructor(
    message: string,
    systemCode?: string,
    systemMessage?: string,
    options?: ErrorOptions
  );
}
```

---

## Error Factory Functions

Convenient functions for creating specific error types:

### createToolExecutionError

```typescript
function createToolExecutionError(
  toolName: string,
  message: string,
  options?: ErrorOptions
): ToolExecutionError;
```

**Example:**
```typescript
import { createToolExecutionError } from './types/index.js';

throw createToolExecutionError(
  'Bash',
  'Command execution timeout',
  { details: { command: 'npm install', timeout: 120000 } }
);
```

### createPermissionDeniedError

```typescript
function createPermissionDeniedError(
  resource: string,
  permissionType: string,
  message?: string,
  options?: ErrorOptions
): PermissionDeniedError;
```

**Example:**
```typescript
throw createPermissionDeniedError(
  '/root/.ssh/id_rsa',
  'read'
);
// Message defaults to: "Permission denied: read access to /root/.ssh/id_rsa"
```

### createConfigurationError

```typescript
function createConfigurationError(
  message: string,
  configPath?: string,
  validationErrors?: string[],
  options?: ErrorOptions
): ConfigurationError;
```

### createNetworkError

```typescript
function createNetworkError(
  message: string,
  url?: string,
  statusCode?: number,
  options?: ErrorOptions
): NetworkError;
```

### createAuthenticationError

```typescript
function createAuthenticationError(
  message: string,
  authType?: string,
  options?: ErrorOptions
): AuthenticationError;
```

### createValidationError

```typescript
function createValidationError(
  message: string,
  field?: string,
  validationErrors?: Array<{ field: string; message: string }>,
  options?: ErrorOptions
): ValidationError;
```

### createSessionError

```typescript
function createSessionError(
  message: string,
  sessionId?: string,
  options?: ErrorOptions
): SessionError;
```

### createSandboxError

```typescript
function createSandboxError(
  message: string,
  sandboxType?: string,
  resourceLimit?: string,
  options?: ErrorOptions
): SandboxError;
```

### createPluginError

```typescript
function createPluginError(
  message: string,
  pluginName?: string,
  pluginVersion?: string,
  options?: ErrorOptions
): PluginError;
```

### createSystemError

```typescript
function createSystemError(
  message: string,
  systemCode?: string,
  systemMessage?: string,
  options?: ErrorOptions
): SystemError;
```

---

## Error Type Guards

### isClaudeError

```typescript
function isClaudeError(error: unknown): error is ClaudeError;
```

**Example:**
```typescript
try {
  await someOperation();
} catch (error) {
  if (isClaudeError(error)) {
    console.log('Error code:', error.code);
    console.log('Severity:', error.severity);
    console.log('Recoverable:', error.recoverable);
  } else {
    console.log('Unknown error:', error);
  }
}
```

### isRecoverableError

```typescript
function isRecoverableError(error: unknown): boolean;
```

**Example:**
```typescript
try {
  await performOperation();
} catch (error) {
  if (isRecoverableError(error)) {
    // Attempt recovery
    await recoverFromError();
  } else {
    // Cannot recover, propagate error
    throw error;
  }
}
```

### isRetryableError

```typescript
function isRetryableError(error: unknown): boolean;
```

**Example:**
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isRetryableError(error) && attempt < maxRetries) {
        await delay(1000 * attempt);  // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Error Formatting

### formatError

```typescript
function formatError(error: unknown, verbose?: boolean): string;
```

**Basic Format:**
```typescript
const error = createToolExecutionError('Bash', 'Command failed');
console.log(formatError(error));

// Output:
// ToolExecutionError: Command failed
//   Code: 1000 (TOOL_EXECUTION_FAILED)
//   Severity: medium
//   Flags: recoverable
//   Context: {"toolName":"Bash"}
```

**Verbose Format:**
```typescript
console.log(formatError(error, true));

// Output:
// ToolExecutionError: Command failed
//   Code: 1000 (TOOL_EXECUTION_FAILED)
//   Severity: medium
//   Flags: recoverable
//   Context: {"toolName":"Bash"}
//   Timestamp: 2025-01-15T10:30:45.123Z
//   Stack: ToolExecutionError: Command failed
//     at Object.<anonymous> (/path/to/file.ts:10:11)
//     at Module._compile (node:internal/modules/cjs/loader:1254:14)
```

### getErrorSeverity

```typescript
function getErrorSeverity(error: unknown): ErrorSeverity;
```

**Example:**
```typescript
const severity = getErrorSeverity(error);
if (severity === ErrorSeverity.CRITICAL) {
  await emergencyShutdown();
}
```

### getErrorCode

```typescript
function getErrorCode(error: unknown): ErrorCode;
```

**Example:**
```typescript
const code = getErrorCode(error);
if (code === ErrorCode.NETWORK_TIMEOUT) {
  await increaseTimeout();
}
```

---

## Best Practices

### 1. Always Use Specific Error Types

```typescript
// Good
throw createToolExecutionError('Bash', 'Command timeout');

// Avoid
throw new Error('Bash command timeout');
```

### 2. Provide Context

```typescript
// Good
throw createToolExecutionError('Bash', 'Command failed', {
  details: {
    command: 'npm install',
    exitCode: 1,
    stderr: 'Package not found'
  },
  context: {
    cwd: process.cwd(),
    userId: currentUser.id
  }
});

// Avoid
throw createToolExecutionError('Bash', 'Command failed');
```

### 3. Chain Errors

```typescript
try {
  await performLowLevelOperation();
} catch (originalError) {
  throw createSystemError(
    'High-level operation failed',
    undefined,
    undefined,
    { cause: originalError }  // Preserve error chain
  );
}
```

### 4. Use Type Guards

```typescript
async function handleOperation() {
  try {
    await operation();
  } catch (error) {
    if (isClaudeError(error)) {
      // Type-safe access to error properties
      logError(error.code, error.severity, error.details);
    } else {
      // Handle unknown errors
      console.error('Unknown error:', error);
    }
  }
}
```

### 5. Implement Retry Logic

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number; backoff: number } = { maxRetries: 3, backoff: 1000 }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableError(error)) {
        throw error;  // Not retryable, fail immediately
      }

      if (attempt === options.maxRetries) {
        throw error;  // Max retries reached
      }

      // Exponential backoff
      const delay = options.backoff * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
```

### 6. Log Errors Appropriately

```typescript
function logError(error: unknown) {
  if (isClaudeError(error)) {
    const logLevel = error.severity === ErrorSeverity.CRITICAL ? 'error' :
                     error.severity === ErrorSeverity.HIGH ? 'error' :
                     error.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info';

    console[logLevel](formatError(error, true));

    // Send to monitoring service
    if (error.severity === ErrorSeverity.CRITICAL) {
      await alertOncall(error);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Error Recovery Patterns

### Pattern 1: Automatic Retry

```typescript
async function fetchWithRetry(url: string): Promise<string> {
  return executeWithRetry(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw createNetworkError(
        `HTTP ${response.status}`,
        url,
        response.status,
        { retryable: response.status >= 500 }  // Retry on server errors
      );
    }
    return response.text();
  });
}
```

### Pattern 2: Fallback Mechanism

```typescript
async function readConfigWithFallback(): Promise<Config> {
  const paths = [
    '~/.claude/settings.json',
    '/etc/claude/config.json',
    './claude.config.json'
  ];

  for (const path of paths) {
    try {
      return await readConfig(path);
    } catch (error) {
      if (isRecoverableError(error)) {
        continue;  // Try next path
      }
      throw error;  // Non-recoverable, fail
    }
  }

  // Use default config as last resort
  return getDefaultConfig();
}
```

### Pattern 3: Graceful Degradation

```typescript
async function performOperationWithDegradation() {
  try {
    return await performFullOperation();
  } catch (error) {
    if (isClaudeError(error) && error.severity !== ErrorSeverity.CRITICAL) {
      console.warn('Falling back to degraded mode:', error.message);
      return await performDegradedOperation();
    }
    throw error;
  }
}
```

### Pattern 4: Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > 60000) {  // 1 minute
        this.state = 'half-open';
      } else {
        throw createSystemError('Circuit breaker open');
      }
    }

    try {
      const result = await operation();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();

      if (this.failures >= 5) {
        this.state = 'open';
      }

      throw error;
    }
  }
}
```

### Pattern 5: Error Transformation

```typescript
function transformNativeError(error: unknown): ClaudeError {
  if (isClaudeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Map Node.js errors to Claude errors
    if ('code' in error) {
      const code = error.code as string;
      switch (code) {
        case 'ENOENT':
          return createSystemError(
            'File not found',
            code,
            error.message,
            { cause: error }
          );
        case 'EACCES':
          return createPermissionDeniedError(
            'unknown',
            'filesystem',
            'Permission denied',
            { cause: error }
          );
        case 'ETIMEDOUT':
          return createNetworkError(
            'Connection timeout',
            undefined,
            undefined,
            { cause: error, retryable: true }
          );
        default:
          return fromNativeError(error);
      }
    }

    return fromNativeError(error);
  }

  return new BaseClaudeError(
    ErrorCode.UNKNOWN_ERROR,
    String(error)
  );
}
```

---

## Error Wrapper Functions

### wrapWithErrorHandling

Wraps synchronous functions with automatic error transformation:

```typescript
function wrapWithErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => T,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): (...args: Args) => T;
```

**Example:**
```typescript
const safeReadFile = wrapWithErrorHandling(
  fs.readFileSync,
  ErrorCode.SYSTEM_FILE_READ_ERROR,
  { operation: 'readFile' }
);

// Automatically catches and transforms errors
try {
  const content = safeReadFile('/path/to/file', 'utf-8');
} catch (error) {
  // error is now a ClaudeError
  console.log(isClaudeError(error));  // true
}
```

### wrapAsyncWithErrorHandling

Wraps asynchronous functions with automatic error transformation:

```typescript
function wrapAsyncWithErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): (...args: Args) => Promise<T>;
```

**Example:**
```typescript
const safeApiCall = wrapAsyncWithErrorHandling(
  fetch,
  ErrorCode.NETWORK_CONNECTION_FAILED,
  { service: 'anthropic-api' }
);

try {
  const response = await safeApiCall('https://api.anthropic.com/v1/messages');
} catch (error) {
  // error is now a ClaudeError
  if (isRetryableError(error)) {
    // Implement retry logic
  }
}
```

---

## Error Code Reference Table

| Code | Name | Severity | Recoverable | Retryable | Category |
|------|------|----------|-------------|-----------|----------|
| 1000 | TOOL_EXECUTION_FAILED | Medium | Yes | No | Tool |
| 1001 | TOOL_NOT_FOUND | Medium | Yes | No | Tool |
| 1002 | TOOL_TIMEOUT | Medium | Yes | Yes | Tool |
| 2000 | PERMISSION_DENIED | High | No | No | Permission |
| 3000 | CONFIG_NOT_FOUND | Medium | Yes | No | Config |
| 3001 | CONFIG_INVALID | Medium | Yes | No | Config |
| 4000 | NETWORK_CONNECTION_FAILED | Medium | Yes | Yes | Network |
| 4001 | NETWORK_TIMEOUT | Medium | Yes | Yes | Network |
| 4005 | NETWORK_RATE_LIMITED | Medium | Yes | Yes | Network |
| 5000 | AUTH_FAILED | High | No | No | Auth |
| 5001 | AUTH_TOKEN_INVALID | High | No | No | Auth |
| 5002 | AUTH_TOKEN_EXPIRED | High | Yes | Yes | Auth |
| 6000 | VALIDATION_FAILED | Medium | No | No | Validation |
| 7000 | SESSION_NOT_FOUND | Medium | Yes | No | Session |
| 7002 | SESSION_EXPIRED | Medium | Yes | No | Session |
| 7004 | SESSION_LOAD_FAILED | Medium | Yes | Yes | Session |
| 8000 | SANDBOX_INIT_FAILED | High | Yes | No | Sandbox |
| 8007 | SANDBOX_ESCAPE_ATTEMPT | Critical | No | No | Sandbox |
| 9000 | SYSTEM_ERROR | High | Depends | No | System |
| 9002 | SYSTEM_FILE_READ_ERROR | Medium | Yes | Yes | System |
| 9007 | SYSTEM_OUT_OF_MEMORY | Critical | No | No | System |
| 10000 | PLUGIN_NOT_FOUND | Medium | Yes | No | Plugin |
| 10004 | PLUGIN_CIRCULAR_DEPENDENCY | High | No | No | Plugin |
| 99999 | UNKNOWN_ERROR | Medium | Depends | No | Unknown |

---

For more information, see:
- [Tool API Documentation](./tools.md)
- [Type System Documentation](./types.md)
- [Hooks API](./hooks.md)
- [Plugin Development](./plugins.md)
