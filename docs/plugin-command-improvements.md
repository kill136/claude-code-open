# `/plugin` 命令完善文档

## 概述

基于官方 Claude Code CLI v2.0.76 源码，完善了 `/plugin` 命令，使其支持完整的插件和插件市场管理功能。

## 官方源码分析

官方源码位置：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`

### 发现的官方子命令

通过分析官方源码，发现以下子命令：

1. **`/plugin marketplace add`** - 添加插件市场
2. **`/plugin marketplace remove`** - 删除插件市场
3. **`/plugin marketplace list`** - 列出插件市场
4. **`/plugin install`** - 安装插件
5. **`/plugin list`** - 列出已安装插件
6. **`/plugin validate`** - 验证插件清单文件

## 实现的功能

### 1. 插件市场管理 (`/plugin marketplace`)

#### `/plugin marketplace list`
- 列出所有已配置的插件市场
- 显示官方市场 (anthropics/claude-code)
- 显示社区市场
- 提供市场来源信息

#### `/plugin marketplace add <source>`
支持多种来源格式：
- `owner/repo` - GitHub 仓库简写
- `git@github.com:owner/repo.git` - Git SSH URL
- `https://...` - 直接 URL 到 marketplace.json
- `./path` 或 `/absolute` - 本地文件系统路径

示例：
```bash
/plugin marketplace add anthropics/claude-code
/plugin marketplace add git@github.com:owner/repo.git
/plugin marketplace add https://example.com/marketplace.json
/plugin marketplace add ./path/to/marketplace
```

#### `/plugin marketplace remove <name>`
- 删除指定的插件市场
- 同时卸载该市场中的所有插件
- 提供警告信息

### 2. 插件安装 (`/plugin install`)

#### `/plugin install <plugin-name>[@marketplace]`
- 从已配置的市场安装插件
- 支持市场指定语法（如 `plugin@marketplace`）
- 自动验证插件清单
- 安装到全局或项目目录

示例：
```bash
/plugin install frontend-design@claude-code-plugins
/plugin install code-review@anthropics
/plugin install my-plugin
```

### 3. 插件列表 (`/plugin list`)

功能：
- 列出所有已安装的插件
- 显示插件版本和描述
- 分别显示全局和项目插件
- 读取并解析 manifest.json
- 提供安装指导

输出示例：
```
Installed Plugins

Global Plugins (~/.claude/plugins):
  • my-plugin v1.0.0
    A custom plugin for testing

Project Plugins (./.claude/plugins):
  • project-specific v0.1.0
    Project-specific utilities
```

### 4. 插件验证 (`/plugin validate`)

#### `/plugin validate [path]`
验证插件或市场清单文件：
- 检查 JSON 语法有效性
- 验证必需字段（name, version）
- 检查字段类型和值
- 验证源配置
- 检查命令/代理/钩子定义

示例：
```bash
/plugin validate .claude-plugin/manifest.json
/plugin validate ./my-plugin/manifest.json
/plugin validate .
```

### 5. 默认帮助信息

运行 `/plugin` 或 `/plugin help` 显示：
- 所有可用命令列表
- 插件结构说明
- manifest.json 示例
- 插件目录位置
- 快速开始指南

## 插件目录结构

### 标准插件结构
```
plugin-name/
  ├── manifest.json       # 插件元数据和配置
  ├── commands/           # 自定义斜杠命令 (.md 文件)
  ├── agents/             # 自定义代理定义 (.md 文件)
  ├── hooks/              # 生命周期钩子 (.sh, .js, .ts)
  └── mcpServers/         # MCP 服务器配置
```

### manifest.json 示例
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "commands": {
    "my-command": "./commands/my-command.md"
  },
  "agents": {
    "my-agent": "./agents/my-agent.md"
  }
}
```

## 插件位置

- **全局插件**: `~/.claude/plugins/`
- **项目插件**: `./.claude/plugins/`

## 市场清单格式 (marketplace.json)

```json
{
  "name": "My Marketplace",
  "plugins": [
    {
      "name": "example-plugin",
      "description": "An example plugin",
      "source": {
        "github": "owner/repo"
      }
    }
  ]
}
```

## 与官方版本的区别

### 教育项目限制
本项目作为教育逆向工程项目，以下功能为模拟实现：
- 实际的插件市场获取
- 插件文件下载和安装
- 运行时插件加载

### 完整功能在官方版本
官方 Claude Code 提供：
- 完整的市场集成
- 自动插件下载和安装
- 运行时动态加载
- 插件更新机制
- 依赖管理

## 使用示例

### 添加官方市场并安装插件
```bash
# 1. 添加官方市场
/plugin marketplace add anthropics/claude-code

# 2. 列出市场
/plugin marketplace list

# 3. 安装插件
/plugin install frontend-design@claude-code-plugins

# 4. 查看已安装插件
/plugin list

# 5. 重启 Claude Code 加载插件
```

### 验证自定义插件
```bash
# 创建插件目录
mkdir -p my-plugin
cd my-plugin

# 创建 manifest.json
cat > manifest.json <<EOF
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin"
}
EOF

# 验证清单
/plugin validate manifest.json
```

## 代码实现亮点

### 1. 模块化设计
- 清晰的子命令分离
- 每个功能独立处理
- 易于扩展和维护

### 2. 错误处理
- 参数验证
- 文件系统错误处理
- 用户友好的错误信息

### 3. 帮助信息
- 详细的使用说明
- 丰富的示例
- 文档链接

### 4. 兼容性
- 支持多种市场来源格式
- 全局和项目级插件
- 跨平台路径处理

## 测试验证

### TypeScript 编译
```bash
npx tsc --noEmit
# ✓ 编译通过，无错误
```

### 运行时测试
```bash
npm run dev
# 在 REPL 中测试：
# > /plugin
# > /plugin list
# > /plugin marketplace list
# > /plugin install example
# > /plugin validate .
```

## 文档资源

- 官方插件文档: https://docs.anthropic.com/claude-code/plugins
- 插件市场: https://github.com/anthropics/claude-code
- 清单规范: https://docs.anthropic.com/claude-code/plugins/manifest

## 总结

成功基于官方源码完善了 `/plugin` 命令，实现了：
- ✅ 完整的插件市场管理 (add/remove/list)
- ✅ 插件安装功能
- ✅ 插件列表显示
- ✅ 插件清单验证
- ✅ 详细的帮助和文档
- ✅ TypeScript 类型安全
- ✅ 代码可编译运行

该实现为教育目的，展示了官方 Claude Code 插件系统的架构和使用方式。
