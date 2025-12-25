# 工具权限控制 - 快速参考

## 导入

```typescript
import {
  ToolPermissionManager,
  toolPermissionManager,  // 全局单例
  ToolPermission,
  PermissionContext,
  PermissionResult,
  PERMISSION_TEMPLATES,
} from './permissions/tools.js';
```

## 基本用法

### 1. 检查权限

```typescript
const context: PermissionContext = {
  workingDirectory: process.cwd(),
  sessionId: 'session-123',
  timestamp: Date.now()
};

const result = toolPermissionManager.isAllowed(
  'Bash',
  { command: 'npm test' },
  context
);

if (!result.allowed) {
  console.error(result.reason);
}
```

### 2. 添加权限

```typescript
// 基本权限
toolPermissionManager.addPermission({
  tool: 'Write',
  allowed: false
});

// 带参数限制
toolPermissionManager.addPermission({
  tool: 'Bash',
  allowed: true,
  parameterRestrictions: [
    {
      parameter: 'command',
      type: 'blacklist',
      values: ['rm', 'sudo']
    }
  ]
});

// 带上下文条件
toolPermissionManager.addPermission({
  tool: 'Write',
  allowed: true,
  conditions: [
    {
      type: 'context',
      field: 'workingDirectory',
      operator: 'contains',
      value: '/safe-project'
    }
  ]
});
```

### 3. 使用模板

```typescript
// 只读模式
PERMISSION_TEMPLATES.readOnly()
  .forEach(p => toolPermissionManager.addPermission(p));

// 安全模式
PERMISSION_TEMPLATES.safe()
  .forEach(p => toolPermissionManager.addPermission(p));

// 项目限制
PERMISSION_TEMPLATES.projectOnly('/home/user/my-project')
  .forEach(p => toolPermissionManager.addPermission(p));

// 时间限制（9:00-18:00）
PERMISSION_TEMPLATES.timeRestricted(9, 18)
  .forEach(p => toolPermissionManager.addPermission(p));
```

## 限制类型

### 参数限制

```typescript
// 1. 黑名单
{
  parameter: 'command',
  type: 'blacklist',
  values: ['rm', 'sudo']
}

// 2. 白名单
{
  parameter: 'model',
  type: 'whitelist',
  values: ['opus', 'sonnet', 'haiku']
}

// 3. 正则表达式
{
  parameter: 'file_path',
  type: 'pattern',
  pattern: /^\/home\/user\/.*\.ts$/
}

// 4. 自定义验证器
{
  parameter: 'value',
  type: 'validator',
  validator: (val) => typeof val === 'number' && val > 0
}

// 5. 范围限制
{
  parameter: 'port',
  type: 'range',
  min: 1024,
  max: 65535
}
```

### 上下文条件

```typescript
// 1. 字符串包含
{
  type: 'context',
  field: 'workingDirectory',
  operator: 'contains',
  value: '/safe-project'
}

// 2. 精确匹配
{
  type: 'context',
  field: 'sessionId',
  operator: 'equals',
  value: 'special-session'
}

// 3. 正则匹配
{
  type: 'context',
  field: 'workingDirectory',
  operator: 'matches',
  value: /^\/home\/user\/approved-/
}

// 4. 时间范围
{
  type: 'time',
  operator: 'range',
  value: [startTime, endTime]
}

// 5. 自定义验证
{
  type: 'custom',
  operator: 'custom',
  value: null,
  validator: (ctx) => ctx.workingDirectory.includes('approved')
}
```

## 权限范围

```typescript
// 全局权限（所有项目）
toolPermissionManager.addPermission(permission, 'global');

// 项目权限（当前项目）
toolPermissionManager.addPermission(permission, 'project');

// 会话权限（仅当前会话，不持久化）
toolPermissionManager.addPermission(permission, 'session');
```

## 优先级

```typescript
// 优先级：数值越大越优先（默认 0）
toolPermissionManager.addPermission({
  tool: 'Bash',
  allowed: false,
  priority: 0  // 低优先级
}, 'global');

toolPermissionManager.addPermission({
  tool: 'Bash',
  allowed: true,
  priority: 10  // 高优先级，会覆盖上面的规则
}, 'project');
```

## 查询和统计

```typescript
// 获取统计
const stats = toolPermissionManager.getStats();
console.log(stats);
// {
//   totalPermissions: 10,
//   allowedTools: 7,
//   deniedTools: 3,
//   conditionalTools: 2,
//   restrictedParameters: 5,
//   activeContexts: 3
// }

// 查询允许的工具
const allowed = toolPermissionManager.queryPermissions({ allowed: true });

// 查询有条件的工具
const conditional = toolPermissionManager.queryPermissions({ hasConditions: true });

// 查询有限制的工具
const restricted = toolPermissionManager.queryPermissions({ hasRestrictions: true });

// 模式匹配查询
const fileTools = toolPermissionManager.queryPermissions({ toolPattern: 'File*' });
```

## 管理操作

```typescript
// 获取权限
const permissions = toolPermissionManager.getPermissions();
const globalPerms = toolPermissionManager.getPermissions('global');

// 获取特定工具权限
const bashPerm = toolPermissionManager.getToolPermission('Bash');

// 更新权限
toolPermissionManager.updatePermission('Bash', { allowed: true }, 'session');

// 移除权限
toolPermissionManager.removePermission('Bash');
toolPermissionManager.removePermission('Bash', 'global');  // 仅移除全局

// 清空权限
toolPermissionManager.clearPermissions();
toolPermissionManager.clearPermissions('session');  // 仅清空会话
```

## 导入/导出

```typescript
// 导出
const config = toolPermissionManager.export();
const globalConfig = toolPermissionManager.export('global');

// 导入
toolPermissionManager.import(config);
toolPermissionManager.import(config, 'project');
```

## 继承配置

```typescript
// 设置继承
toolPermissionManager.setInheritance({
  inheritGlobal: true,      // 继承全局权限
  inheritProject: true,     // 继承项目权限
  overrideGlobal: true,     // 允许覆盖全局权限
  mergeStrategy: 'override' // 合并策略: override/merge/union
});

// 获取继承配置
const inheritance = toolPermissionManager.getInheritance();
```

## 通配符

```typescript
// 匹配特定前缀
toolPermissionManager.addPermission({
  tool: 'File*',    // 匹配 FileRead, FileWrite 等
  allowed: false
});

// 匹配所有工具
toolPermissionManager.addPermission({
  tool: '*',
  allowed: true
});
```

## 常用模式

### 只读模式

```typescript
toolPermissionManager.addPermission({ tool: 'Read', allowed: true });
toolPermissionManager.addPermission({ tool: 'Glob', allowed: true });
toolPermissionManager.addPermission({ tool: 'Grep', allowed: true });
toolPermissionManager.addPermission({ tool: 'Write', allowed: false });
toolPermissionManager.addPermission({ tool: 'Edit', allowed: false });
toolPermissionManager.addPermission({ tool: 'Bash', allowed: false });
```

### 安全 Bash

```typescript
toolPermissionManager.addPermission({
  tool: 'Bash',
  allowed: true,
  parameterRestrictions: [
    {
      parameter: 'command',
      type: 'blacklist',
      values: ['rm', 'sudo', 'chmod', 'chown', 'dd', 'mkfs'],
      description: 'Dangerous commands not allowed'
    }
  ]
});
```

### 项目目录限制

```typescript
const projectDir = '/home/user/my-project';

toolPermissionManager.addPermission({
  tool: 'Write',
  allowed: true,
  parameterRestrictions: [
    {
      parameter: 'file_path',
      type: 'validator',
      validator: (path) => String(path).startsWith(projectDir)
    }
  ]
});
```

### 工作时间限制

```typescript
toolPermissionManager.addPermission({
  tool: '*',
  allowed: true,
  conditions: [
    {
      type: 'time',
      operator: 'custom',
      value: null,
      validator: (ctx) => {
        const hour = new Date(ctx.timestamp).getHours();
        return hour >= 9 && hour < 18;
      }
    }
  ]
});
```

## 运算符速查

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `equals` | 精确匹配 | `value === 'test'` |
| `notEquals` | 不等于 | `value !== 'test'` |
| `contains` | 包含 | `value.includes('test')` |
| `notContains` | 不包含 | `!value.includes('test')` |
| `matches` | 正则匹配 | `/pattern/.test(value)` |
| `notMatches` | 正则不匹配 | `!/pattern/.test(value)` |
| `range` | 范围检查 | `min <= value <= max` |
| `in` | 在列表中 | `list.includes(value)` |
| `notIn` | 不在列表中 | `!list.includes(value)` |
| `custom` | 自定义验证 | `validator(context)` |

## 配置文件位置

- **全局**: `~/.claude/tool-permissions.json`
- **项目**: `./.claude/tool-permissions.json`

## 注意事项

1. **优先级**: 会话 > 项目 > 全局
2. **默认行为**: 无规则时默认允许
3. **条件关系**: 同一规则内的多个条件是 AND 关系
4. **会话权限**: 不会持久化，重启后丢失
5. **通配符**: 使用 minimatch 语法
6. **性能**: 权限检查是内存操作，开销极小
