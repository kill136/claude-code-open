# `/permissions` 命令测试指南

## 快速测试步骤

### 1. 启动 Claude Code

```bash
cd /home/user/claude-code-open
npm run dev
# 或
node dist/cli.js
```

### 2. 基本功能测试

#### 2.1 查看当前权限设置

```
/permissions
```

**期望输出**:
```
╭─ Permission Settings ──────────────────────────────╮
│                                                     │
│  Current Mode: default                              │
│                                                     │
│  Permission Modes:                                  │
│    default           - Interactive (ask each time)  │
│    acceptEdits       - Auto-accept file edits       │
│    bypassPermissions - Skip all permission checks   │
│    plan              - Plan-only (no execution)     │
│    dontAsk           - Auto-accept all actions      │
│                                                     │
│  Allowed Tools:                                     │
│    (none)                                           │
│                                                     │
│  Disallowed Tools:                                  │
│    (none)                                           │
│                                                     │
│  Commands:                                          │
│    /permissions mode <name>  - Set permission mode  │
│    /permissions allow <tool> - Allow a tool         │
│    /permissions deny <tool>  - Deny a tool          │
│    /permissions reset        - Reset to defaults    │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

#### 2.2 设置权限模式

```
/permissions mode acceptEdits
```

**期望输出**:
```
✓ Permission mode changed to: acceptedits

Settings saved to: ~/.claude/settings.json
Restart Claude Code to apply the new permission mode.
```

#### 2.3 允许工具

```
/permissions allow Bash
```

**期望输出**:
```
✓ Tool allowed: Bash

Current allowed tools: Bash

Settings saved to: ~/.claude/settings.json
Restart Claude Code to apply changes.
```

#### 2.4 禁止工具

```
/permissions deny WebSearch
```

**期望输出**:
```
✓ Tool denied: WebSearch

Current disallowed tools: WebSearch

Settings saved to: ~/.claude/settings.json
Restart Claude Code to apply changes.
```

#### 2.5 重新查看设置

```
/permissions
```

**期望输出**:
```
╭─ Permission Settings ──────────────────────────────╮
│                                                     │
│  Current Mode: acceptedits                          │
│                                                     │
│  ...                                                │
│                                                     │
│  Allowed Tools:                                     │
│    Bash                                             │
│                                                     │
│  Disallowed Tools:                                  │
│    WebSearch                                        │
│                                                     │
│  ...                                                │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

#### 2.6 重置权限

```
/permissions reset
```

**期望输出**:
```
✓ Permission settings reset to defaults

Permission mode: default (interactive)
Allowed tools: (all)
Disallowed tools: (none)

Settings saved to: ~/.claude/settings.json
Restart Claude Code to apply changes.
```

### 3. 错误处理测试

#### 3.1 无效的权限模式

```
/permissions mode invalid
```

**期望输出**:
```
Invalid permission mode: invalid

Valid modes: default, acceptEdits, bypassPermissions, plan, dontAsk
```

#### 3.2 缺少参数

```
/permissions mode
```

**期望输出**:
```
Usage: /permissions mode <mode-name>

Available modes:
  default           - Interactive mode (ask before each action)
  acceptEdits       - Auto-accept file edits (Write, Edit, MultiEdit)
  bypassPermissions - Bypass all permission checks (use with caution!)
  plan              - Plan-only mode (no tool execution)
  dontAsk           - Auto-accept all actions (same as bypassPermissions)

Current mode: default

Example: /permissions mode acceptEdits
```

#### 3.3 未知操作

```
/permissions unknown
```

**期望输出**:
```
Unknown action: unknown

Available actions:
  /permissions           - Show current settings
  /permissions mode      - Set permission mode
  /permissions allow     - Allow a tool
  /permissions deny      - Deny a tool
  /permissions reset     - Reset to defaults

Use /permissions <action> for detailed help on each action.
```

### 4. 配置文件验证

检查配置文件是否正确更新：

```bash
cat ~/.claude/settings.json
```

**期望内容**（示例）:
```json
{
  "permissionMode": "acceptEdits",
  "allowedTools": ["Bash", "Read", "Write"],
  "disallowedTools": ["WebSearch"]
}
```

### 5. 别名测试

测试 `/perms` 别名：

```
/perms
```

**期望**: 应该显示与 `/permissions` 相同的输出

### 6. 集成测试场景

#### 场景 1: 开发模式设置

```
/permissions mode acceptEdits
/permissions allow Bash
/permissions allow Read
/permissions allow Write
/permissions allow Edit
```

#### 场景 2: 安全模式设置

```
/permissions mode default
/permissions deny Bash
/permissions deny Write
/permissions deny Edit
```

#### 场景 3: 计划模式

```
/permissions mode plan
```

### 7. 帮助信息测试

```
/permissions allow
/permissions deny
/permissions mode
```

每个命令都应该显示详细的帮助信息。

## 自动化测试脚本

创建一个测试脚本 `test-permissions.sh`:

```bash
#!/bin/bash

echo "Testing /permissions command..."

# 测试 1: 查看当前设置
echo "Test 1: View current settings"
echo "/permissions" | node dist/cli.js

# 测试 2: 设置模式
echo "Test 2: Set permission mode"
echo "/permissions mode acceptEdits" | node dist/cli.js

# 测试 3: 允许工具
echo "Test 3: Allow tool"
echo "/permissions allow Bash" | node dist/cli.js

# 测试 4: 禁止工具
echo "Test 4: Deny tool"
echo "/permissions deny WebSearch" | node dist/cli.js

# 测试 5: 重置
echo "Test 5: Reset permissions"
echo "/permissions reset" | node dist/cli.js

echo "All tests completed!"
```

## 验证清单

- [ ] `/permissions` 显示当前设置
- [ ] `/permissions mode <mode>` 设置权限模式
- [ ] `/permissions allow <tool>` 添加允许的工具
- [ ] `/permissions deny <tool>` 添加禁止的工具
- [ ] `/permissions reset` 重置所有设置
- [ ] `/perms` 别名正常工作
- [ ] 配置正确保存到 `~/.claude/settings.json`
- [ ] 错误处理正确（无效模式、缺少参数等）
- [ ] 帮助信息完整且准确
- [ ] UI 界面格式正确
- [ ] 安全警告显示正确

## 已知限制

1. **需要重启**: 大多数权限设置需要重启 Claude Code 才能生效
2. **配置格式**: 工具列表可以是数组或逗号分隔的字符串
3. **大小写**: 权限模式名称不区分大小写（会自动转为小写）
4. **重复项**: 重复添加相同工具会被友好提示，不会报错

## 故障排除

### 配置文件损坏

如果配置文件损坏，可以手动删除：

```bash
rm ~/.claude/settings.json
```

然后使用 `/permissions reset` 或 `/config reset` 重新初始化。

### 权限不生效

1. 确保已重启 Claude Code
2. 检查配置文件格式
3. 使用 `/config` 查看当前配置
4. 查看日志文件（如果有）

## 性能测试

测试大量工具的性能：

```bash
# 添加多个工具
/permissions allow Bash
/permissions allow Read
/permissions allow Write
/permissions allow Edit
/permissions allow MultiEdit
/permissions allow Glob
/permissions allow Grep
/permissions allow WebFetch
/permissions allow WebSearch
/permissions allow TodoWrite
```

检查配置文件大小和读写性能。
