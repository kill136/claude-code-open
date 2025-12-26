# 权限系统更新说明

## 概述
本次更新完善了权限系统，使其与官方 @anthropic-ai/claude-code v2.0.76 的权限结构保持一致。

## 主要更新内容

### 1. 新增数据结构

#### 1.1 额外允许的工作目录（`additionalDirectories`）
- **官方对应**: `additionalWorkingDirectories`
- **类型**: `Map<string, { path: string; source: string }>`
- **功能**: 存储额外允许访问的目录及其来源
- **API**:
  - `addAllowedDir(dir: string, source: string)`: 添加目录
  - `removeAllowedDir(dir: string)`: 移除目录
  - `getAdditionalDirectories()`: 获取所有额外目录

#### 1.2 权限规则存储（`alwaysAllowRules`, `alwaysDenyRules`, `alwaysAskRules`）
- **官方对应**: `alwaysAllowRules`, `alwaysDenyRules`, `alwaysAskRules`
- **类型**: `Map<string, string[]>`
- **功能**: 分别存储 allow/deny/ask 三种行为的权限规则
- **Key**: 规则来源（如 'userSettings', 'projectSettings'）
- **Value**: 规则值数组

### 2. 新增 API 方法

#### 2.1 规则管理
```typescript
// 添加规则
addPermissionRule(behavior: 'allow' | 'deny' | 'ask', destination: string, ruleValues: string[]): void

// 替换规则（匹配官方 replaceRules）
replacePermissionRules(behavior: 'allow' | 'deny' | 'ask', destination: string, ruleValues: string[]): void

// 移除规则（匹配官方 removeRules）
removePermissionRule(behavior: 'allow' | 'deny' | 'ask', destination: string, ruleValues: string[]): void

// 获取所有规则
getAllPermissionRules(): {
  allow: Map<string, string[]>;
  deny: Map<string, string[]>;
  ask: Map<string, string[]>;
}
```

### 3. 配置文件结构更新

#### 3.1 `settings.json` 权限配置（`/home/user/.claude/settings.json`）

```json
{
  "permissions": {
    // 默认权限模式（新增，匹配官方 defaultMode）
    "defaultMode": "default",  // 可选值: default, bypassPermissions, dontAsk, acceptEdits, plan, delegate

    // 根级别 allow/deny/ask 规则（新增）
    "allow": ["Read", "Glob", "Grep"],
    "deny": ["Bash:rm*", "Write:/etc/*"],
    "ask": ["WebFetch", "WebSearch"],

    // 额外允许的目录（新增）
    "additionalDirectories": [
      "/home/user/projects",
      "/home/user/workspace"
    ],

    // 工具级权限（已有，保持兼容）
    "tools": {
      "allow": ["Read", "Write"],
      "deny": ["Bash"]
    },

    // 路径级权限（已有，保持兼容）
    "paths": {
      "allow": ["/home/user/**"],
      "deny": ["/etc/**", "/sys/**"]
    },

    // 命令级权限（已有，保持兼容）
    "commands": {
      "allow": ["git*", "npm*"],
      "deny": ["rm -rf*", "sudo*"]
    },

    // 网络权限（已有，保持兼容）
    "network": {
      "allow": ["*.github.com", "*.npmjs.com"],
      "deny": []
    },

    // 审计日志（已有，保持兼容）
    "audit": {
      "enabled": true,
      "logFile": "~/.claude/permissions-audit.log",
      "maxSize": 10485760
    }
  }
}
```

### 4. 权限规则优先级

权限检查的优先级顺序（从高到低）：
1. **工具级黑名单** (`tools.deny`)
2. **工具级白名单** (`tools.allow`)
3. **路径级黑名单** (`paths.deny`)
4. **路径级白名单** (`paths.allow`)
5. **命令级黑名单** (`commands.deny`)
6. **命令级白名单** (`commands.allow`)
7. **网络级黑名单** (`network.deny`)
8. **网络级白名单** (`network.allow`)
9. **已记住的权限**
10. **会话权限**
11. **预定义规则**
12. **交互式询问**

### 5. 权限模式说明

| 模式 | 说明 |
|------|------|
| `default` | 默认模式，按照规则检查权限 |
| `bypassPermissions` | 绕过所有权限检查（需要特殊标志） |
| `dontAsk` | 不询问，安全操作自动允许，危险操作自动拒绝 |
| `acceptEdits` | 自动接受文件编辑操作 |
| `plan` | 计划模式，不执行任何实际操作 |
| `delegate` | 委托模式，使用更复杂的逻辑 |

### 6. 规则匹配逻辑

#### 6.1 模式匹配
- **精确匹配**: 直接字符串比较
- **通配符匹配**: 支持 `*` 和 `?` 通配符（使用 minimatch）
- **包含匹配**: 部分字符串匹配

#### 6.2 路径匹配
- **Glob patterns**: 完整的 glob 语法支持
- **路径前缀**: 非 glob 模式时视为路径前缀

#### 6.3 命令匹配
- 提取命令主体（第一个单词）
- 同时匹配完整命令和命令主体

### 7. 导出格式更新

`export()` 方法现在返回匹配官方结构的对象：

```typescript
{
  mode: string,
  rules: PermissionRule[],
  rememberedPermissions: RememberedPermission[],
  allowedDirs: string[],
  additionalWorkingDirectories: Array<{key: string, path: string, source: string}>,
  alwaysAllowRules: Record<string, string[]>,
  alwaysDenyRules: Record<string, string[]>,
  alwaysAskRules: Record<string, string[]>,
  permissionConfig: PermissionConfig,
  auditEnabled: boolean,
  isBypassPermissionsModeAvailable: boolean
}
```

## 向后兼容性

- 所有原有的 API 方法仍然可用
- 原有的配置格式仍然受支持
- 新增的字段都是可选的，不会影响现有配置

## 使用示例

### 示例 1: 添加额外允许的目录

```typescript
import { permissionManager } from './permissions/index.js';

// 添加项目目录
permissionManager.addAllowedDir('/home/user/my-project', 'userSettings');

// 检查路径是否允许
const isAllowed = permissionManager.isPathAllowed('/home/user/my-project/src/main.ts');
console.log(isAllowed); // true
```

### 示例 2: 管理 allow/deny/ask 规则

```typescript
// 添加允许规则
permissionManager.addPermissionRule('allow', 'userSettings', ['Read', 'Glob', 'Grep']);

// 添加拒绝规则
permissionManager.addPermissionRule('deny', 'userSettings', ['Bash:rm*', 'Write:/etc/*']);

// 添加询问规则
permissionManager.addPermissionRule('ask', 'userSettings', ['WebFetch', 'WebSearch']);

// 获取所有规则
const rules = permissionManager.getAllPermissionRules();
console.log(rules);
// {
//   allow: Map { 'userSettings' => ['Read', 'Glob', 'Grep'] },
//   deny: Map { 'userSettings' => ['Bash:rm*', 'Write:/etc/*'] },
//   ask: Map { 'userSettings' => ['WebFetch', 'WebSearch'] }
// }
```

### 示例 3: 设置权限模式

```typescript
// 通过 API 设置
permissionManager.setMode('acceptEdits');

// 或在 settings.json 中配置
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

## 测试建议

1. **测试 additionalDirectories**:
   - 配置额外目录后，验证路径检查逻辑
   - 测试目录的添加、移除和查询

2. **测试 allow/deny/ask 规则**:
   - 验证规则的添加、替换、移除功能
   - 测试规则的匹配逻辑（精确、通配符、glob）

3. **测试权限模式**:
   - 每种模式下的权限检查行为
   - 模式切换的正确性

4. **测试配置加载**:
   - 从 settings.json 正确加载所有字段
   - 配置文件不存在时的降级行为

5. **测试向后兼容性**:
   - 旧格式配置文件仍能正常工作
   - 新旧 API 混合使用的场景

## 相关文件

- `/home/user/claude-code-open/src/permissions/index.ts` - 核心权限管理器
- `/home/user/claude-code-open/src/permissions/tools.ts` - 工具级权限控制
- `/home/user/claude-code-open/src/config/index.ts` - 配置 Schema 定义
- `/home/user/claude-code-open/src/types/index.ts` - 类型定义

## 参考

- 官方包: `@anthropic-ai/claude-code` v2.0.76
- 官方文档: 参考解压后的 `/tmp/package/cli.js`
