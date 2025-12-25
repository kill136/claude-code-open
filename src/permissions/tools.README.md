# T071: 细粒度工具权限控制系统

完整的工具级权限管理系统，支持参数限制、上下文条件和权限继承。

## 功能特性

### 1. 工具级权限
每个工具可以独立设置允许/禁止状态：

```typescript
manager.addPermission({
  tool: 'Write',
  allowed: false,
  reason: 'Read-only mode enabled'
});
```

### 2. 参数级限制
对工具参数进行细粒度控制：

```typescript
manager.addPermission({
  tool: 'Bash',
  allowed: true,
  parameterRestrictions: [
    {
      parameter: 'command',
      type: 'blacklist',
      values: ['rm -rf', 'sudo', 'chmod 777'],
      description: 'Dangerous commands not allowed'
    }
  ]
});
```

支持的限制类型：
- **whitelist**: 白名单值
- **blacklist**: 黑名单值
- **pattern**: 正则表达式匹配
- **validator**: 自定义验证函数
- **range**: 数值范围限制

### 3. 上下文权限
基于执行上下文的动态权限检查：

```typescript
manager.addPermission({
  tool: 'Bash',
  allowed: true,
  conditions: [
    {
      type: 'context',
      field: 'workingDirectory',
      operator: 'contains',
      value: '/home/user/safe-project',
      description: 'Only allowed in safe-project directory'
    }
  ]
});
```

支持的条件类型：
- **context**: 上下文字段检查
- **time**: 时间条件
- **user**: 用户条件
- **session**: 会话条件
- **custom**: 自定义验证器

### 4. 权限继承
三层权限体系：全局 -> 项目 -> 会话

```typescript
// 全局权限（所有项目）
manager.addPermission(permission, 'global');

// 项目权限（当前项目）
manager.addPermission(permission, 'project');

// 会话权限（仅当前会话）
manager.addPermission(permission, 'session');
```

继承配置：

```typescript
manager.setInheritance({
  inheritGlobal: true,      // 是否继承全局权限
  inheritProject: true,     // 是否继承项目权限
  overrideGlobal: true,     // 是否覆盖全局权限
  mergeStrategy: 'override' // 合并策略: 'override' | 'merge' | 'union'
});
```

## 核心 API

### ToolPermissionManager

#### 权限检查

```typescript
isAllowed(
  tool: string,
  params: Record<string, unknown>,
  context: PermissionContext
): PermissionResult
```

检查工具是否允许执行，返回详细的权限结果。

**示例**:
```typescript
const result = manager.isAllowed('Bash',
  { command: 'npm test' },
  {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now()
  }
);

if (!result.allowed) {
  console.log('Denied:', result.reason);
  console.log('Suggestions:', result.suggestions);
}
```

#### 权限管理

```typescript
// 添加权限
addPermission(permission: ToolPermission, scope?: 'global' | 'project' | 'session'): void

// 移除权限
removePermission(tool: string, scope?: 'global' | 'project' | 'session'): void

// 更新权限
updatePermission(tool: string, updates: Partial<ToolPermission>, scope?: 'global' | 'project' | 'session'): boolean

// 获取权限
getPermissions(scope?: 'global' | 'project' | 'session'): ToolPermission[]

// 获取特定工具权限
getToolPermission(tool: string): ToolPermission | undefined

// 清空权限
clearPermissions(scope?: 'global' | 'project' | 'session'): void
```

#### 查询和统计

```typescript
// 获取统计信息
getStats(): PermissionStats

// 查询权限
queryPermissions(filter: {
  allowed?: boolean;
  scope?: 'global' | 'project' | 'session';
  hasConditions?: boolean;
  hasRestrictions?: boolean;
  toolPattern?: string;
}): ToolPermission[]
```

#### 导入/导出

```typescript
// 导出配置
export(scope?: 'global' | 'project' | 'session'): string

// 导入配置
import(configJson: string, scope?: 'global' | 'project' | 'session'): boolean
```

## 使用场景

### 场景 1: 只读模式

```typescript
import { PERMISSION_TEMPLATES } from './tools.js';

const manager = new ToolPermissionManager();
const readOnlyPerms = PERMISSION_TEMPLATES.readOnly();
readOnlyPerms.forEach(perm => manager.addPermission(perm));
```

### 场景 2: 安全模式

```typescript
const safePerms = PERMISSION_TEMPLATES.safe();
safePerms.forEach(perm => manager.addPermission(perm));
```

### 场景 3: 项目限制

```typescript
const projectPerms = PERMISSION_TEMPLATES.projectOnly('/home/user/my-project');
projectPerms.forEach(perm => manager.addPermission(perm));
```

### 场景 4: 工作时间限制

```typescript
const timePerms = PERMISSION_TEMPLATES.timeRestricted(9, 18); // 9:00-18:00
timePerms.forEach(perm => manager.addPermission(perm));
```

### 场景 5: 自定义验证

```typescript
manager.addPermission({
  tool: 'Write',
  allowed: true,
  parameterRestrictions: [
    {
      parameter: 'file_path',
      type: 'validator',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        // 仅允许特定扩展名
        return ['.ts', '.js', '.json'].some(ext => value.endsWith(ext));
      },
      description: 'Only TypeScript, JavaScript, and JSON files allowed'
    }
  ]
});
```

### 场景 6: 多条件组合

```typescript
manager.addPermission({
  tool: 'Bash',
  allowed: true,
  priority: 10,
  conditions: [
    // 仅在特定目录
    {
      type: 'context',
      field: 'workingDirectory',
      operator: 'contains',
      value: '/home/user/approved-projects'
    },
    // 仅在工作时间
    {
      type: 'time',
      operator: 'custom',
      value: null,
      validator: (context) => {
        const hour = new Date(context.timestamp).getHours();
        return hour >= 9 && hour < 18;
      }
    }
  ],
  parameterRestrictions: [
    // 禁止危险命令
    {
      parameter: 'command',
      type: 'blacklist',
      values: ['rm', 'sudo', 'chmod', 'chown']
    }
  ]
});
```

## 权限配置文件

权限自动持久化到配置文件：

- **全局**: `~/.claude/tool-permissions.json`
- **项目**: `./.claude/tool-permissions.json`

配置文件格式：

```json
{
  "version": "1.0.0",
  "inheritance": {
    "inheritGlobal": true,
    "inheritProject": true,
    "overrideGlobal": true,
    "mergeStrategy": "override"
  },
  "permissions": [
    {
      "tool": "Read",
      "allowed": true,
      "scope": "global",
      "priority": 0,
      "reason": "Reading is always safe"
    },
    {
      "tool": "Bash",
      "allowed": true,
      "scope": "project",
      "priority": 5,
      "conditions": [
        {
          "type": "context",
          "field": "workingDirectory",
          "operator": "contains",
          "value": "/home/user/safe-project"
        }
      ],
      "parameterRestrictions": [
        {
          "parameter": "command",
          "type": "blacklist",
          "values": ["rm", "sudo"]
        }
      ]
    }
  ]
}
```

## 优先级规则

权限检查按以下优先级进行：

1. **会话权限** (最高优先级)
2. **项目权限**
3. **全局权限** (最低优先级)

在同一级别中，按 `priority` 字段排序（数值越大优先级越高）。

## 条件运算符

支持的运算符：

- `equals`: 精确匹配
- `notEquals`: 不等于
- `contains`: 包含（字符串或数组）
- `notContains`: 不包含
- `matches`: 正则表达式匹配
- `notMatches`: 正则表达式不匹配
- `range`: 范围检查（数字、日期）
- `in`: 在列表中
- `notIn`: 不在列表中
- `custom`: 自定义验证函数

## 集成示例

### 与 ToolRegistry 集成

```typescript
import { toolRegistry } from '../tools/index.js';
import { toolPermissionManager } from './tools.js';

// 在工具执行前检查权限
async function executeToolWithPermission(
  toolName: string,
  params: Record<string, unknown>,
  context: PermissionContext
) {
  // 检查权限
  const permResult = toolPermissionManager.isAllowed(toolName, params, context);

  if (!permResult.allowed) {
    throw new Error(`Permission denied: ${permResult.reason}`);
  }

  // 执行工具
  return await toolRegistry.execute(toolName, params);
}
```

### 与 ConversationLoop 集成

```typescript
import { toolPermissionManager, PermissionContext } from '../permissions/tools.js';

class ConversationLoop {
  async processTool(toolUse: ToolUse) {
    const context: PermissionContext = {
      workingDirectory: process.cwd(),
      sessionId: this.session.id,
      timestamp: Date.now()
    };

    // 检查工具权限
    const permResult = toolPermissionManager.isAllowed(
      toolUse.name,
      toolUse.input,
      context
    );

    if (!permResult.allowed) {
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `Permission denied: ${permResult.reason}\n\nSuggestions:\n${permResult.suggestions?.join('\n')}`
      };
    }

    // 执行工具...
  }
}
```

## 性能考虑

- 权限检查是内存操作，性能开销极小
- 配置文件仅在启动和保存时读写
- 会话权限不持久化，重启后丢失
- 支持通配符匹配（使用 minimatch）

## 安全最佳实践

1. **默认拒绝**: 对敏感操作默认设置为拒绝
2. **最小权限**: 仅授予必要的权限
3. **参数验证**: 使用参数限制防止注入攻击
4. **审计日志**: 结合 PermissionManager 的审计功能
5. **定期审查**: 定期检查和清理权限配置

## 故障排查

### 权限未生效

检查权限优先级和继承配置：

```typescript
const stats = manager.getStats();
console.log('Total permissions:', stats.totalPermissions);

const toolPerm = manager.getToolPermission('Bash');
console.log('Bash permission:', toolPerm);
```

### 条件总是失败

验证上下文字段和值：

```typescript
const result = manager.isAllowed('Bash', params, context);
console.log('Matched rule:', result.matchedRule);
console.log('Reason:', result.reason);
```

### 参数限制不工作

检查参数名称是否匹配：

```typescript
const hasRestriction = manager.checkParameterRestriction('Bash', 'command', 'rm -rf');
console.log('Has restriction:', hasRestriction);
```

## 相关文件

- `/src/permissions/tools.ts` - 核心实现
- `/src/permissions/tools.example.ts` - 使用示例
- `/src/permissions/index.ts` - 权限模块入口
- `~/.claude/tool-permissions.json` - 全局配置
- `./.claude/tool-permissions.json` - 项目配置

## 更新历史

- **v1.0.0** (T071): 初始实现
  - 工具级权限控制
  - 参数级限制
  - 上下文条件
  - 权限继承
  - 预设模板
  - 导入/导出功能
