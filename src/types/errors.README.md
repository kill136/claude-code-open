# 统一错误类型系统 (Unified Error Type System)

## 概述 (Overview)

这个模块提供了 Claude Code 项目的统一错误处理系统，包括：

- **错误代码枚举** - 结构化的错误代码分段管理
- **错误类层次** - 继承自 `BaseClaudeError` 的特定错误类型
- **错误工厂函数** - 便捷的错误创建函数
- **错误处理工具** - 判断、格式化、包装等辅助函数

## 文件位置

- **主文件**: `/home/user/claude-code-open/src/types/errors.ts`
- **示例**: `/home/user/claude-code-open/src/types/errors.example.ts`
- **导出**: 通过 `/home/user/claude-code-open/src/types/index.ts` 统一导出

## 错误代码分段 (Error Code Segments)

错误代码使用数字枚举，按功能模块分段：

| 段范围 | 类别 | 说明 |
|--------|------|------|
| 1000-1999 | 工具相关 (Tool) | 工具执行、超时、不可用等 |
| 2000-2999 | 权限相关 (Permission) | 权限拒绝、路径访问等 |
| 3000-3999 | 配置相关 (Configuration) | 配置加载、验证、解析等 |
| 4000-4999 | 网络相关 (Network) | 连接失败、超时、SSL错误等 |
| 5000-5999 | 认证相关 (Authentication) | API密钥、OAuth、令牌等 |
| 6000-6999 | 验证相关 (Validation) | 输入验证、模式验证等 |
| 7000-7999 | 会话相关 (Session) | 会话管理、检查点等 |
| 8000-8999 | 沙箱相关 (Sandbox) | 沙箱初始化、资源限制等 |
| 9000-9999 | 系统相关 (System) | 文件系统、进程管理等 |
| 10000-10999 | 插件相关 (Plugin) | 插件加载、依赖等 |
| 99999 | 未知错误 | 无法分类的错误 |

## 错误严重级别 (Error Severity)

```typescript
enum ErrorSeverity {
  LOW = 'low',          // 低级：不影响主要功能
  MEDIUM = 'medium',    // 中级：部分功能受影响
  HIGH = 'high',        // 高级：主要功能受影响
  CRITICAL = 'critical' // 严重：系统无法运行
}
```

## 基础接口 (Base Interface)

```typescript
interface ClaudeError extends Error {
  code: ErrorCode;           // 错误代码
  severity: ErrorSeverity;   // 严重级别
  details?: Record<string, unknown>;  // 详细信息
  recoverable: boolean;      // 是否可恢复
  retryable: boolean;        // 是否可重试
  timestamp: number;         // 时间戳
  cause?: Error;             // 原因链
  context?: Record<string, unknown>;  // 上下文
}
```

## 错误类型 (Error Classes)

### 1. 工具执行错误 (ToolExecutionError)

```typescript
import { createToolExecutionError } from '../types/index.js';

throw createToolExecutionError('bash', 'Command execution failed', {
  details: { command: 'ls -la', exitCode: 1 },
  context: { cwd: '/home/user' }
});
```

**使用场景**: 工具执行失败、工具超时、工具不可用

### 2. 权限拒绝错误 (PermissionDeniedError)

```typescript
import { createPermissionDeniedError } from '../types/index.js';

throw createPermissionDeniedError(
  '/etc/passwd',
  'file_write',
  'Cannot write to protected file'
);
```

**使用场景**: 文件访问被拒绝、命令执行被拒绝、网络访问被拒绝

### 3. 配置错误 (ConfigurationError)

```typescript
import { createConfigurationError } from '../types/index.js';

throw createConfigurationError(
  'Configuration validation failed',
  '~/.claude/settings.json',
  ['apiKey is required', 'maxTokens must be positive']
);
```

**使用场景**: 配置文件缺失、配置格式错误、配置验证失败

### 4. 网络错误 (NetworkError)

```typescript
import { createNetworkError } from '../types/index.js';

throw createNetworkError(
  'Connection timeout',
  'https://api.anthropic.com',
  undefined,
  { retryable: true }
);
```

**使用场景**: 网络连接失败、请求超时、DNS解析失败

### 5. 认证错误 (AuthenticationError)

```typescript
import { createAuthenticationError } from '../types/index.js';

throw createAuthenticationError(
  'API key is invalid or expired',
  'api_key',
  { severity: ErrorSeverity.CRITICAL }
);
```

**使用场景**: API密钥无效、OAuth失败、令牌过期

### 6. 验证错误 (ValidationError)

```typescript
import { createValidationError } from '../types/index.js';

throw createValidationError(
  'Input validation failed',
  undefined,
  [
    { field: 'email', message: 'Invalid email format' },
    { field: 'age', message: 'Age must be between 0 and 120' }
  ]
);
```

**使用场景**: 输入验证失败、模式验证失败、类型错误

### 7. 会话错误 (SessionError)

```typescript
import { createSessionError } from '../types/index.js';

throw createSessionError(
  'Session not found',
  'abc-123-def-456',
  { details: { lastSeen: new Date().toISOString() } }
);
```

**使用场景**: 会话未找到、会话过期、检查点失败

### 8. 沙箱错误 (SandboxError)

```typescript
import { createSandboxError } from '../types/index.js';

throw createSandboxError(
  'Memory limit exceeded',
  'bubblewrap',
  'maxMemory',
  {
    details: { limit: 1073741824, used: 1258291200 },
    severity: ErrorSeverity.HIGH
  }
);
```

**使用场景**: 沙箱初始化失败、资源限制、路径违规

### 9. 插件错误 (PluginError)

```typescript
import { createPluginError } from '../types/index.js';

throw createPluginError(
  'Plugin dependency missing',
  'my-plugin',
  '1.0.0',
  { details: { missingDeps: ['lodash', 'axios'] } }
);
```

**使用场景**: 插件加载失败、依赖缺失、循环依赖

### 10. 系统错误 (SystemError)

```typescript
import { createSystemError } from '../types/index.js';

throw createSystemError(
  'File not found',
  'ENOENT',
  'No such file or directory',
  { context: { path: '/path/to/file' } }
);
```

**使用场景**: 文件系统错误、进程失败、磁盘空间不足

## 工具函数 (Utility Functions)

### 1. 错误判断

```typescript
import { isClaudeError, isRetryableError, isRecoverableError } from '../types/index.js';

try {
  // 某些操作
} catch (error) {
  if (isClaudeError(error)) {
    console.log('Error code:', error.code);
    console.log('Is retryable:', isRetryableError(error));
    console.log('Is recoverable:', isRecoverableError(error));
  }
}
```

### 2. 错误格式化

```typescript
import { formatError } from '../types/index.js';

try {
  // 某些操作
} catch (error) {
  // 简要格式
  console.error(formatError(error));

  // 详细格式（包含堆栈跟踪）
  console.error(formatError(error, true));
}
```

### 3. 错误转换

```typescript
import { fromNativeError, ErrorCode } from '../types/index.js';

try {
  JSON.parse('invalid json');
} catch (error) {
  throw fromNativeError(
    error as Error,
    ErrorCode.VALIDATION_FAILED,
    { context: { operation: 'parseJSON' } }
  );
}
```

### 4. 函数包装

```typescript
import { wrapAsyncWithErrorHandling, ErrorCode } from '../types/index.js';

const safeReadFile = wrapAsyncWithErrorHandling(
  async (filePath: string) => {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  },
  ErrorCode.SYSTEM_FILE_READ_ERROR,
  { operation: 'readFile' }
);
```

## 最佳实践 (Best Practices)

### 1. 使用工厂函数

✅ **推荐**:
```typescript
throw createNetworkError('Connection failed', url);
```

❌ **不推荐**:
```typescript
throw new NetworkError('Connection failed', url);
```

### 2. 提供上下文信息

✅ **推荐**:
```typescript
throw createToolExecutionError('bash', 'Command failed', {
  details: { command: 'ls -la', exitCode: 1 },
  context: { cwd: '/home/user', user: 'root' }
});
```

❌ **不推荐**:
```typescript
throw createToolExecutionError('bash', 'Command failed');
```

### 3. 正确设置严重级别

```typescript
// 关键操作失败 - 使用 CRITICAL
throw createAuthenticationError('API key invalid', 'api_key', {
  severity: ErrorSeverity.CRITICAL
});

// 可选功能失败 - 使用 MEDIUM 或 LOW
throw createToolExecutionError('optional-tool', 'Tool unavailable', {
  severity: ErrorSeverity.LOW
});
```

### 4. 利用错误链

```typescript
try {
  // 内部操作
} catch (originalError) {
  throw createConfigurationError(
    'Failed to load config',
    configPath,
    undefined,
    { cause: originalError as Error }
  );
}
```

### 5. 实现重试逻辑

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxRetries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 错误处理模式 (Error Handling Patterns)

### 1. 基础错误处理

```typescript
try {
  await someOperation();
} catch (error) {
  if (isClaudeError(error)) {
    console.error(formatError(error));
    // 处理 Claude 错误
  } else {
    console.error('Unknown error:', error);
    // 处理未知错误
  }
}
```

### 2. 分级错误处理

```typescript
function handleError(error: unknown): void {
  if (!isClaudeError(error)) return;

  switch (error.severity) {
    case ErrorSeverity.LOW:
      console.warn(formatError(error));
      break;
    case ErrorSeverity.MEDIUM:
      console.error(formatError(error));
      break;
    case ErrorSeverity.HIGH:
      console.error(formatError(error, true));
      notifyAdmin(error);
      break;
    case ErrorSeverity.CRITICAL:
      console.error('CRITICAL:', formatError(error, true));
      process.exit(1);
  }
}
```

### 3. 错误恢复

```typescript
async function resilientOperation() {
  try {
    return await primaryMethod();
  } catch (error) {
    if (isClaudeError(error) && error.recoverable) {
      console.warn('Primary method failed, trying fallback');
      return await fallbackMethod();
    }
    throw error;
  }
}
```

### 4. 错误统计

```typescript
class ErrorTracker {
  private errors: Map<ErrorCode, number> = new Map();

  record(error: unknown): void {
    if (isClaudeError(error)) {
      const count = this.errors.get(error.code) || 0;
      this.errors.set(error.code, count + 1);
    }
  }

  getStats() {
    return Array.from(this.errors.entries()).map(([code, count]) => ({
      code,
      count,
      name: ErrorCode[code]
    }));
  }
}
```

## 迁移指南 (Migration Guide)

### 从旧错误到新错误系统

**旧方式**:
```typescript
throw new Error('Tool execution failed');
```

**新方式**:
```typescript
import { createToolExecutionError } from '../types/index.js';

throw createToolExecutionError('bash', 'Tool execution failed', {
  details: { reason: 'timeout' },
  retryable: true
});
```

### 批量替换

1. **查找所有 `throw new Error`**:
   ```bash
   grep -r "throw new Error" src/
   ```

2. **根据错误上下文选择合适的错误类型**

3. **添加必要的导入**:
   ```typescript
   import { create*Error } from '../types/index.js';
   ```

4. **替换错误创建代码**

## 常见问题 (FAQ)

### Q1: 何时使用 `createError` vs `new Error`?

**A**: 总是使用 `createError` 工厂函数。工厂函数会自动设置错误代码、严重级别、可恢复性等属性。

### Q2: 如何选择正确的错误类型?

**A**: 根据错误的根本原因选择：
- 工具执行问题 → `ToolExecutionError`
- 权限问题 → `PermissionDeniedError`
- 配置问题 → `ConfigurationError`
- 网络问题 → `NetworkError`
- 等等...

### Q3: 错误是否应该记录日志?

**A**: 是的，但根据严重级别使用不同的日志级别：
- `LOW` → `console.warn`
- `MEDIUM` → `console.error`
- `HIGH` → `console.error` + 告警
- `CRITICAL` → `console.error` + 立即通知

### Q4: 如何处理第三方库的错误?

**A**: 使用 `fromNativeError` 转换：
```typescript
try {
  thirdPartyLib.doSomething();
} catch (error) {
  throw fromNativeError(error as Error, ErrorCode.SYSTEM_ERROR);
}
```

### Q5: 错误是否应该包含敏感信息?

**A**: 不应该。避免在错误消息或详情中包含：
- API密钥
- 密码
- 令牌
- 个人身份信息

## 参考资料 (References)

- **主文件**: `src/types/errors.ts`
- **示例代码**: `src/types/errors.example.ts`
- **类型导出**: `src/types/index.ts`
- **MCP错误**: `src/mcp/errors.ts` (MCP特定的错误处理)

## 版本历史 (Version History)

- **v1.0.0** (2024-12-25): 初始版本
  - 完整的错误类型层次结构
  - 10个错误代码段，80+错误代码
  - 10个具体错误类
  - 15+工具函数
  - 完整的TypeScript类型支持

## 贡献 (Contributing)

添加新错误类型时：

1. 选择合适的错误代码段
2. 在 `ErrorCode` 枚举中添加新代码
3. 创建新的错误类（如果需要）
4. 添加工厂函数
5. 更新文档
6. 添加示例代码

---

**注意**: 这个错误系统与 `src/mcp/errors.ts` 中的 MCP 特定错误系统是互补的。MCP错误专门处理 Model Context Protocol 相关的错误，而这个系统处理整个 Claude Code 项目的通用错误。
