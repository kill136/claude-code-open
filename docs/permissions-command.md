# `/permissions` 命令使用说明

## 概述

`/permissions` 命令用于查看和修改 Claude Code 的工具权限设置。该命令基于官方 Claude Code v2.0.59 的实现进行了完善。

## 基本用法

### 查看当前权限设置

```bash
/permissions
```

显示当前的权限模式、允许的工具列表和禁止的工具列表。

## 权限模式

### 可用模式

1. **default** - 默认交互模式
   - 每次工具执行前都会询问用户
   - 最安全的模式

2. **acceptEdits** - 自动接受文件编辑
   - 自动批准 Write、Edit、MultiEdit 工具
   - 其他工具仍需要确认
   - 适合频繁修改文件的场景

3. **bypassPermissions** - 跳过所有权限检查
   - 自动批准所有工具调用
   - ⚠️ 危险模式，仅在受信任环境使用
   - 适合沙箱或测试环境

4. **plan** - 计划模式
   - 仅规划不执行
   - Claude 会制定计划但不实际执行工具
   - 适合查看 AI 的思路

5. **dontAsk** - 不询问模式
   - 等同于 bypassPermissions
   - 自动批准所有操作

### 设置权限模式

```bash
# 设置为自动接受编辑模式
/permissions mode acceptEdits

# 设置为计划模式
/permissions mode plan

# 设置为跳过权限（危险！）
/permissions mode bypassPermissions
```

## 工具管理

### 允许特定工具

```bash
# 允许 Bash 工具
/permissions allow Bash

# 允许多个工具（需要分别执行）
/permissions allow Write
/permissions allow Edit

# 使用模式允许特定命令
/permissions allow Bash(git:*)
/permissions allow Bash(npm:*)
```

### 禁止特定工具

```bash
# 禁止 WebSearch 工具
/permissions deny WebSearch

# 禁止 Bash 工具
/permissions deny Bash
```

### 重置权限设置

```bash
# 重置所有权限设置为默认值
/permissions reset
```

## 命令行参数

除了使用 `/permissions` 命令，你也可以在启动 Claude Code 时使用命令行参数：

```bash
# 设置权限模式
claude --permission-mode acceptEdits

# 指定允许的工具
claude --allowedTools "Bash,Read,Write,Edit"

# 指定禁止的工具
claude --disallowedTools "WebSearch,WebFetch"

# 跳过所有权限检查（危险！）
claude --dangerously-skip-permissions
```

## 配置文件

权限设置会保存到 `~/.claude/settings.json`：

```json
{
  "permissionMode": "acceptEdits",
  "allowedTools": ["Bash", "Read", "Write", "Edit"],
  "disallowedTools": ["WebSearch"]
}
```

## 常见用例

### 场景 1: 代码审查模式

只查看和分析代码，不允许修改：

```bash
/permissions deny Write
/permissions deny Edit
/permissions deny MultiEdit
/permissions deny Bash
```

### 场景 2: 快速开发模式

自动批准所有文件编辑，提高效率：

```bash
/permissions mode acceptEdits
```

### 场景 3: 限制网络访问

允许本地操作，但禁止网络请求：

```bash
/permissions deny WebSearch
/permissions deny WebFetch
/permissions allow Bash
/permissions allow Read
/permissions allow Write
/permissions allow Edit
```

### 场景 4: 沙箱测试环境

完全跳过权限检查（仅在隔离环境使用）：

```bash
/permissions mode bypassPermissions
```

### 场景 5: 计划和设计阶段

只让 AI 制定计划，不实际执行：

```bash
/permissions mode plan
```

## 注意事项

1. **配置生效**: 大多数权限设置需要重启 Claude Code 才能生效
2. **安全性**: `bypassPermissions` 和 `dontAsk` 模式会跳过所有安全检查，仅在受信任环境使用
3. **优先级**: 命令行参数 > 配置文件 > 默认设置
4. **工具模式**: 可以使用 `Bash(git:*)` 这样的模式来限制 Bash 工具只能执行特定命令

## 工具列表

常见的可配置工具：

- **文件操作**: Read, Write, Edit, MultiEdit
- **搜索**: Glob, Grep
- **执行**: Bash
- **网络**: WebFetch, WebSearch
- **任务管理**: TodoWrite, Task
- **其他**: NotebookEdit, MCP 工具

## 故障排除

### 权限设置不生效

1. 检查配置文件格式是否正确：`cat ~/.claude/settings.json`
2. 重启 Claude Code
3. 使用 `/config` 命令查看当前配置

### 重置到默认状态

```bash
/permissions reset
# 或者
/config reset
```

### 查看帮助

```bash
/permissions
/permissions mode
/permissions allow
/permissions deny
```

## 参考

- 官方文档: https://code.claude.com/docs
- 配置位置: `~/.claude/settings.json`
- 权限模式对应的官方 CLI 参数: `--permission-mode`
