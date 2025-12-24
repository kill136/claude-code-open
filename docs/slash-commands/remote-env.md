# /remote-env 命令

## 概述

`/remote-env` 命令用于配置和管理远程开发环境。这是从官方 Claude Code 源码实现的功能，用于支持远程开发场景。

## 功能

- 查看当前远程环境配置
- 列出所有可用的远程环境
- 设置默认远程环境
- 清除远程环境配置

## 用法

### 查看当前配置

```bash
/remote-env
/remote-env show
/remote-env status
```

显示当前配置的远程环境信息，包括：
- 环境名称
- 环境 ID
- 环境类型（docker、ssh、remote）
- 环境状态

### 列出所有可用环境

```bash
/remote-env list
```

显示所有可用的远程环境列表，包括环境名称、ID、类型和状态。当前选中的环境会用箭头标记。

### 设置默认环境

```bash
/remote-env set <environment-id>
```

设置默认的远程环境。例如：

```bash
/remote-env set env-1
```

这会将配置保存到 `~/.claude/settings.json` 文件中的 `remote.defaultEnvironmentId` 字段。

### 清除配置

```bash
/remote-env clear
```

清除当前的远程环境配置。

## 官方功能对应

本实现基于官方 Claude Code CLI v2.0.76 的 `/remote-env` 命令，提供以下核心功能：

1. **环境管理**: 支持多个远程环境的配置和切换
2. **配置持久化**: 设置保存到本地配置文件
3. **环境信息展示**: 显示环境的详细信息（名称、ID、类型、状态）

## 配置文件

远程环境配置存储在 `~/.claude/settings.json` 中：

```json
{
  "remote": {
    "defaultEnvironmentId": "env-1"
  }
}
```

## 支持的环境类型

- **docker**: Docker 容器环境
- **ssh**: SSH 远程服务器
- **remote**: 其他远程工作空间

## 注意事项

1. 当前实现使用模拟的环境列表作为示例
2. 在实际的官方版本中，环境列表会从 Claude AI API 获取
3. 配置更改后建议重启 Claude Code 以使设置生效

## 示例

### 查看当前环境

```bash
/remote-env
```

输出：
```
╭─ Remote Environment Configuration ────────────────╮
│                                                    │
│  Current Environment:                              │
│    Name:   Development Container                   │
│    ID:     env-1                                   │
│    Type:   docker                                  │
│    Status: active                                  │
│                                                    │
│  Commands:                                         │
│    /remote-env list       - List all environments  │
│    /remote-env set <id>   - Set default environment│
│    /remote-env clear      - Clear configuration    │
│                                                    │
│  Remote Development Features:                      │
│    • SSH connection support                        │
│    • Docker container environments                 │
│    • Remote workspace synchronization              │
│                                                    │
│  Configuration:                                    │
│    Location: ~/.claude/settings.json               │
│    Key: remote.defaultEnvironmentId                │
│                                                    │
│  Web Console:                                      │
│    https://claude.ai/code                          │
│                                                    │
╰────────────────────────────────────────────────────╯
```

### 列出所有环境

```bash
/remote-env list
```

输出：
```
Available Remote Environments:

→ Development Container (current)
    ID:     env-1
    Type:   docker
    Status: active

  SSH Server
    ID:     env-2
    Type:   ssh
    Status: active

  Remote Workspace
    ID:     env-3
    Type:   remote
    Status: inactive

To set default environment:
  /remote-env set <environment-id>

Example:
  /remote-env set env-1
```

### 设置环境

```bash
/remote-env set env-2
```

输出：
```
✓ Set default remote environment to: SSH Server

Environment ID: env-2
Type: ssh
Status: active

Configuration saved to: ~/.claude/settings.json

This environment will be used for:
  • Remote development sessions
  • SSH connections
  • Container-based workflows

Restart Claude Code to apply changes.
```

## 相关命令

- `/config` - 查看和修改全局配置
- `/init` - 初始化项目配置

## 官方源码参考

本实现基于 `/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js` 中的 `remote-env` 命令实现。

核心实现对应官方源码中的：
- `IE9` 对象：命令定义
- `BE9` 函数：主要 UI 逻辑
- `AE9` 函数：环境数据获取
- `nJA` 函数：API 调用（在本实现中使用模拟数据）
