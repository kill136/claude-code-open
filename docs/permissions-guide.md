# 权限系统使用指南

Claude Code 的权限系统提供了强大的白名单/黑名单机制，让你精确控制 AI 助手可以执行的操作。

## 目录
- [功能概览](#功能概览)
- [配置文件](#配置文件)
- [工具级权限](#工具级权限)
- [路径级权限](#路径级权限)
- [命令级权限](#命令级权限)
- [网络权限](#网络权限)
- [审计日志](#审计日志)
- [模式匹配规则](#模式匹配规则)
- [权限优先级](#权限优先级)
- [使用示例](#使用示例)

## 功能概览

权限系统支持以下功能：

1. **工具级控制** - 允许或禁止特定工具的使用
2. **路径级控制** - 基于 glob patterns 控制文件访问
3. **命令级控制** - 精确控制可执行的 Bash 命令
4. **网络控制** - 限制网络请求的目标
5. **审计日志** - 记录所有权限决策
6. **永久/会话记忆** - 保存权限决策以避免重复询问

## 配置文件

权限配置位于 `~/.claude/settings.json` 文件的 `permissions` 字段：

```json
{
  "apiKey": "your-api-key",
  "permissions": {
    "tools": { ... },
    "paths": { ... },
    "commands": { ... },
    "network": { ... },
    "audit": { ... }
  }
}
```

## 工具级权限

控制哪些工具可以被使用：

```json
{
  "permissions": {
    "tools": {
      "allow": [
        "Read",
        "Glob",
        "Grep",
        "WebFetch"
      ],
      "deny": [
        "Bash",
        "Write",
        "Edit"
      ]
    }
  }
}
```

**规则：**
- `deny` 优先级高于 `allow`
- 如果定义了 `allow` 列表，则只有列表中的工具被允许
- 如果未定义 `allow`，则除了 `deny` 列表中的工具外，其他都允许
- 支持通配符：`"Bash*"` 匹配所有以 Bash 开头的工具

## 路径级权限

使用 glob patterns 控制文件系统访问：

```json
{
  "permissions": {
    "paths": {
      "allow": [
        "/home/user/project/**",
        "/tmp/**",
        "~/.claude/**"
      ],
      "deny": [
        "/etc/**",
        "/root/**",
        "/sys/**",
        "**/.env",
        "**/node_modules/**",
        "**/.git/config"
      ]
    }
  }
}
```

**Glob 模式：**
- `*` - 匹配任意字符（不包括路径分隔符）
- `**` - 匹配任意层级的目录
- `?` - 匹配单个字符
- `[abc]` - 匹配 a、b 或 c 中的任意一个
- `~` - 展开为用户主目录

**示例：**
- `/home/user/**/*.js` - 用户目录下所有 JS 文件
- `**/.env` - 任何目录下的 .env 文件
- `/etc/*` - /etc 目录下的直接子文件（不包括子目录）

## 命令级权限

控制可执行的 Bash 命令：

```json
{
  "permissions": {
    "commands": {
      "allow": [
        "ls*",
        "pwd",
        "cat*",
        "git status",
        "git log*",
        "npm install",
        "node --version"
      ],
      "deny": [
        "rm -rf *",
        "sudo *",
        "chmod 777 *",
        "dd *",
        "> /dev/sd*"
      ]
    }
  }
}
```

**匹配逻辑：**
- 同时匹配完整命令和命令名称
- `"git*"` - 允许所有 git 命令
- `"rm -rf *"` - 禁止危险的 rm 命令
- `"sudo *"` - 禁止所有 sudo 命令

## 网络权限

控制网络请求：

```json
{
  "permissions": {
    "network": {
      "allow": [
        "*.anthropic.com",
        "api.github.com",
        "*.npmjs.org"
      ],
      "deny": [
        "*.internal.company.com",
        "192.168.*",
        "10.*"
      ]
    }
  }
}
```

**匹配规则：**
- 匹配域名或完整 URL
- 支持通配符：`*.example.com`
- 私有 IP 地址：`192.168.*`、`10.*`

## 审计日志

记录所有权限决策到日志文件：

```json
{
  "permissions": {
    "audit": {
      "enabled": true,
      "logFile": "~/.claude/permissions-audit.log",
      "maxSize": 10485760
    }
  }
}
```

**配置项：**
- `enabled` - 是否启用审计日志
- `logFile` - 日志文件路径（默认：`~/.claude/permissions-audit.log`）
- `maxSize` - 最大日志文件大小（字节），超过后自动归档

**日志格式：**

每条日志为一行 JSON：

```json
{
  "timestamp": "2025-12-24T10:30:00.000Z",
  "type": "bash_command",
  "tool": "Bash",
  "resource": "rm -rf /tmp/test",
  "decision": "deny",
  "reason": "Command denied by config",
  "scope": "always",
  "user": false
}
```

## 模式匹配规则

### 通配符规则

1. **精确匹配** - 最高优先级
   ```
   "Read" -> 只匹配 Read 工具
   ```

2. **通配符匹配** - 使用 `*` 和 `?`
   ```
   "Bash*" -> 匹配 Bash, BashOutput 等
   "git*" -> 匹配 git status, git log 等
   ```

3. **包含匹配** - 如果没有通配符，则检查是否包含
   ```
   "rm" -> 匹配包含 "rm" 的命令
   ```

### Glob 路径规则

```javascript
// 示例匹配
/home/user/project/src/file.ts  ✓  /home/user/project/**
/home/user/project/file.ts      ✓  /home/user/project/**/*.ts
/etc/passwd                     ✗  /home/user/**
/tmp/secret.env                 ✓  **/.env
```

## 权限优先级

权限检查按以下顺序进行（优先级从高到低）：

1. **工具级权限** - 工具黑名单/白名单
2. **路径级权限** - 文件路径黑名单/白名单
3. **命令级权限** - Bash 命令黑名单/白名单
4. **网络权限** - 网络请求黑名单/白名单
5. **已记住的权限** - 用户之前的决策（永久）
6. **会话权限** - 当前会话的决策
7. **预定义规则** - 系统默认规则
8. **交互式询问** - 询问用户

**在每个层级内：**
- `deny` 优先于 `allow`
- 如果定义了 `allow` 列表，则采用白名单模式（默认拒绝）

## 使用示例

### 示例 1：严格的开发环境

只允许读取和搜索，禁止所有写入：

```json
{
  "permissions": {
    "tools": {
      "allow": ["Read", "Glob", "Grep", "WebFetch", "WebSearch"]
    },
    "paths": {
      "allow": ["/home/user/workspace/**"]
    },
    "audit": {
      "enabled": true
    }
  }
}
```

### 示例 2：安全的自动化脚本

允许特定项目的写入，但禁止危险命令：

```json
{
  "permissions": {
    "paths": {
      "allow": ["/home/user/project/**"],
      "deny": ["/home/user/project/.git/**", "**/.env"]
    },
    "commands": {
      "allow": ["git*", "npm*", "node*", "ls*", "cat*"],
      "deny": ["rm -rf *", "sudo *"]
    },
    "audit": {
      "enabled": true
    }
  }
}
```

### 示例 3：受限的网络访问

只允许访问特定 API：

```json
{
  "permissions": {
    "network": {
      "allow": [
        "api.anthropic.com",
        "api.github.com"
      ],
      "deny": ["*"]
    },
    "audit": {
      "enabled": true
    }
  }
}
```

### 示例 4：保护敏感文件

禁止访问所有配置和凭证文件：

```json
{
  "permissions": {
    "paths": {
      "deny": [
        "**/.env",
        "**/.env.*",
        "**/credentials.json",
        "**/secrets.yaml",
        "~/.ssh/**",
        "~/.aws/**",
        "/etc/**"
      ]
    },
    "audit": {
      "enabled": true
    }
  }
}
```

## 交互式权限提示

当权限配置无法自动决定时，系统会询问用户：

```
┌─────────────────────────────────────────┐
│          Permission Request             │
├─────────────────────────────────────────┤
│ Tool: Bash                              │
│ Type: bash_command                      │
│ Resource: rm /tmp/test.txt              │
│ Description: Execute Bash command       │
└─────────────────────────────────────────┘

Options:
  [y] Yes, allow once
  [n] No, deny
  [a] Always allow for this session
  [A] Always allow (remember)
  [N] Never allow (remember)

Your choice [y/n/a/A/N]:
```

**选项说明：**
- `y` - 仅本次允许
- `n` - 仅本次拒绝
- `a` - 本会话内总是允许
- `A` - 永久允许（保存到 `~/.claude/permissions.json`）
- `N` - 永久拒绝（保存到 `~/.claude/permissions.json`）

## 最佳实践

1. **最小权限原则** - 只授予必要的权限
2. **使用白名单** - 在 `allow` 列表中明确列出允许的操作
3. **保护敏感路径** - 始终在 `deny` 列表中包含 `.env`、凭证文件等
4. **启用审计** - 开启审计日志以跟踪所有权限决策
5. **定期审查** - 定期检查审计日志和权限配置
6. **分层配置** - 为不同项目使用不同的权限配置

## 故障排查

### 无法访问文件

检查：
1. 文件路径是否在 `paths.allow` 列表中
2. 文件路径是否在 `paths.deny` 列表中
3. Glob pattern 是否正确匹配

### 命令被拒绝

检查：
1. 命令是否在 `commands.deny` 列表中
2. 如果定义了 `commands.allow`，命令是否在列表中
3. 命令模式是否正确

### 审计日志未生成

检查：
1. `audit.enabled` 是否为 `true`
2. 日志文件路径是否有写入权限
3. 配置文件格式是否正确

## API 编程接口

### 使用 PermissionManager

```typescript
import { PermissionManager, PermissionConfig } from './permissions/index.js';

// 创建权限管理器
const manager = new PermissionManager('default');

// 设置权限配置
const config: PermissionConfig = {
  tools: {
    allow: ['Read', 'Grep'],
    deny: ['Bash']
  },
  paths: {
    deny: ['**/.env']
  },
  audit: {
    enabled: true
  }
};

manager.setPermissionConfig(config);

// 检查权限
const decision = await manager.check({
  type: 'file_read',
  tool: 'Read',
  description: 'Read file',
  resource: '/home/user/project/file.ts'
});

console.log(decision.allowed); // true/false
console.log(decision.reason);  // 决策原因
```

### 获取审计日志

```bash
# 查看最近的权限决策
tail -n 20 ~/.claude/permissions-audit.log | jq

# 查找所有拒绝的操作
grep '"decision":"deny"' ~/.claude/permissions-audit.log | jq

# 统计各类型权限请求
cat ~/.claude/permissions-audit.log | jq -r '.type' | sort | uniq -c
```

## 相关文件

- **配置文件**: `~/.claude/settings.json`
- **权限记忆**: `~/.claude/permissions.json`
- **审计日志**: `~/.claude/permissions-audit.log`
- **源代码**: `src/permissions/index.ts`
- **示例配置**: `examples/permissions-config.example.json`

## 参考链接

- [minimatch 文档](https://github.com/isaacs/minimatch) - Glob pattern 匹配
- [Claude Code 文档](../README.md)
- [安全最佳实践](./security-best-practices.md)
