# Claude Code 类型系统

这个目录包含 Claude Code 项目的所有 TypeScript 类型定义。

## 文件结构

```
src/types/
├── index.ts        # 统一入口文件
├── tools.ts        # 工具输入类型
├── results.ts      # 工具结果类型
├── messages.ts     # 消息和内容块类型
├── config.ts       # 配置类型
└── errors.ts       # 错误类型系统
```

## 导入示例

### 1. 工具类型

```typescript
// 方式 A: 使用原始名称（向后兼容）
import type { BashInput, FileReadInput } from './types/index.js';

// 方式 B: 使用新别名（推荐）
import type { BashToolInput, ReadToolInput } from './types/index.js';

// 方式 C: 直接从模块导入
import type { BashInput } from './types/tools.js';

// 方式 D: 使用统一别名
import type { ToolInput } from './types/index.js';
```

### 2. 消息类型

```typescript
import type { Message, ContentBlock, MessageParam } from './types/index.js';
```

### 3. 配置类型

```typescript
import type { 
  ClaudeConfig, 
  PermissionMode,
  MCPServerConfig 
} from './types/index.js';
```

### 4. 错误类型

```typescript
// 类型
import type { ClaudeError, ErrorCode } from './types/index.js';

// 类和函数（需要使用常规导入）
import { 
  BaseClaudeError,
  createToolExecutionError,
  isClaudeError 
} from './types/index.js';
```

### 5. 结果类型

```typescript
import type { ToolResult, BashResult } from './types/index.js';
```

## 类型别名

为方便使用，我们提供了多种别名：

### 工具输入别名

| 原始名称 | 别名 | 用途 |
|---------|------|------|
| `BashInput` | `BashToolInput` | Bash 工具 |
| `FileReadInput` | `ReadToolInput` | Read 工具 |
| `FileWriteInput` | `WriteToolInput` | Write 工具 |
| `FileEditInput` | `EditToolInput` | Edit 工具 |
| `GlobInput` | `GlobToolInput` | Glob 工具 |
| `GrepInput` | `GrepToolInput` | Grep 工具 |
| `WebFetchInput` | `WebFetchToolInput` | WebFetch 工具 |
| `WebSearchInput` | `WebSearchToolInput` | WebSearch 工具 |
| `TodoWriteInput` | `TodoWriteToolInput` | TodoWrite 工具 |
| `NotebookEditInput` | `NotebookEditToolInput` | NotebookEdit 工具 |
| `ToolInputSchemas` | `ToolInput` | 所有工具输入的联合类型 |

### 配置别名

| 原始名称 | 别名 |
|---------|------|
| `Config` | `ClaudeConfig`, `Settings` |

## 类型类别

### tools.ts - 工具输入类型

包含所有工具的输入参数类型定义：

- **Agent 工具**: `AgentInput`
- **Bash 工具**: `BashInput`, `BashOutputInput`, `TaskOutputInput`, `KillShellInput`
- **文件工具**: `FileReadInput`, `FileWriteInput`, `FileEditInput`
- **搜索工具**: `GlobInput`, `GrepInput`
- **Web 工具**: `WebFetchInput`, `WebSearchInput`
- **Todo 工具**: `TodoItem`, `TodoWriteInput`
- **Notebook 工具**: `NotebookEditInput`
- **MCP 工具**: `McpInput`, `ListMcpResourcesInput`, `ReadMcpResourceInput`
- **交互工具**: `AskUserQuestionInput`, `ExitPlanModeInput`
- **其他**: `SkillInput`, `LSPInput`, `MultiEditInput`, `SandboxInput`, `TmuxInput`

### results.ts - 工具结果类型

工具执行后返回的结果类型：

- `ToolResult` - 基础结果接口
- `BashResult` - Bash 执行结果
- `FileResult` - 文件操作结果
- `GrepResult` - 搜索结果
- 等等...

### messages.ts - 消息类型

Claude API 消息相关的类型：

- **角色**: `MessageRole` (`'user' | 'assistant'`)
- **内容块**: `TextBlock`, `ImageBlockParam`, `ToolUseBlock`, `ToolResultBlockParam`
- **消息**: `Message`, `MessageParam`, `SessionMessage`
- **流式事件**: `MessageStreamEvent`, `ContentBlockDeltaEvent`
- **工具定义**: `Tool`, `ToolDefinition`, `ToolChoice`

### config.ts - 配置类型

完整的配置系统类型定义：

- **API 配置**: `APIConfig`, `APIBackend`
- **模型配置**: `ModelConfig`, `ModelName`
- **权限配置**: `PermissionSettings`, `PermissionMode`
- **Hook 配置**: `HookSettings`, `HookEvent`, `HookConfig`
- **MCP 配置**: `MCPSettings`, `MCPServerConfig`
- **插件配置**: `PluginSettings`, `PluginConfig`
- **UI 配置**: `UISettings`, `ThemeType`, `ColorScheme`
- **其他配置**: 遥测、上下文、沙箱、会话等

### errors.ts - 错误类型系统

统一的错误处理系统：

- **错误代码**: `ErrorCode` 枚举（100+ 错误代码）
- **错误严重级别**: `ErrorSeverity` (`low`, `medium`, `high`, `critical`)
- **基础错误类**: `BaseClaudeError`
- **具体错误类**: 
  - `ToolExecutionError`
  - `PermissionDeniedError`
  - `ConfigurationError`
  - `NetworkError`
  - `AuthenticationError`
  - `ValidationError`
  - `SessionError`
  - `SandboxError`
  - `PluginError`
  - `SystemError`
- **工厂函数**: `createToolExecutionError()`, `createPermissionDeniedError()` 等
- **工具函数**: `isClaudeError()`, `formatError()`, `wrapWithErrorHandling()` 等

## 统计信息

- **总文件数**: 6 个
- **总代码行数**: 4,617 行
- **总导出数**: 228 个
- **工具类型**: 25+ 个
- **错误代码**: 100+ 个
- **配置选项**: 50+ 个

## 最佳实践

1. **优先从 index.ts 导入** - 统一的入口点
2. **使用类型别名** - 使代码更清晰（如 `ReadToolInput` 而不是 `FileReadInput`）
3. **使用错误工厂函数** - 而不是直接实例化错误类
4. **类型导入使用 `type`** - 使用 `import type` 进行类型导入
5. **保持向后兼容** - 原始类型名称仍然可用

## 示例代码

```typescript
// ✅ 好的实践
import type { BashToolInput, ReadToolInput } from '../types/index.js';
import { createToolExecutionError, isClaudeError } from '../types/index.js';

async function executeBash(input: BashToolInput): Promise<void> {
  try {
    // ... 执行逻辑
  } catch (error) {
    if (isClaudeError(error)) {
      throw error;
    }
    throw createToolExecutionError('Bash', error.message);
  }
}

// ❌ 避免
import { BashInput } from '../types/tools.js'; // 不一致
const error = new BaseClaudeError(...); // 应使用工厂函数
```

## 迁移指南

如果你的代码使用了旧的类型导入，无需修改 - 所有原有类型名称仍然可用。但建议逐步迁移到新的别名：

```typescript
// 旧代码（仍然有效）
import type { BashInput } from './types/index.js';

// 新代码（推荐）
import type { BashToolInput } from './types/index.js';
```

## 版本

当前版本: 2.0.76
