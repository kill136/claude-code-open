# `/plugin` 命令快速参考

## 命令总览

```
/plugin [marketplace|install|list|validate]
```

## 子命令

### 插件市场管理

| 命令 | 说明 |
|------|------|
| `/plugin marketplace list` | 列出已配置的插件市场 |
| `/plugin marketplace add <source>` | 添加新的插件市场 |
| `/plugin marketplace remove <name>` | 删除插件市场 |

### 插件管理

| 命令 | 说明 |
|------|------|
| `/plugin list` | 列出已安装的插件 |
| `/plugin install <name>[@marketplace]` | 安装插件 |
| `/plugin validate [path]` | 验证插件清单 |

## 来源格式

### 市场来源

```bash
# GitHub 简写
/plugin marketplace add anthropics/claude-code

# Git SSH URL
/plugin marketplace add git@github.com:owner/repo.git

# HTTPS URL
/plugin marketplace add https://example.com/marketplace.json

# 本地路径
/plugin marketplace add ./path/to/marketplace
```

## 安装示例

```bash
# 添加官方市场
/plugin marketplace add anthropics/claude-code

# 安装插件
/plugin install frontend-design@claude-code-plugins

# 查看已安装
/plugin list

# 验证插件
/plugin validate .claude-plugin/manifest.json
```

## 插件目录

- **全局**: `~/.claude/plugins/`
- **项目**: `./.claude/plugins/`

## manifest.json 最小示例

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My plugin"
}
```

## 官方文档

https://docs.anthropic.com/claude-code/plugins
