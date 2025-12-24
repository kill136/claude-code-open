# /mcp 命令完善报告

## 官方源码位置
`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`

## 官方 MCP 命令功能

官方的 `claude mcp` CLI 命令（非斜杠命令）包含以下功能：

### 1. **servers** - 列出所有连接的 MCP 服务器
```bash
claude mcp servers [--json]
```
- 显示所有已连接的 MCP 服务器
- 显示每个服务器的连接状态（connected, failed, needs-auth）
- 显示服务器支持的功能（tools, resources, prompts）

### 2. **tools** - 列出所有可用工具
```bash
claude mcp tools [server] [--json]
```
- 列出所有 MCP 工具
- 可按服务器名称过滤
- 格式：`<server>/<tool>`

### 3. **info** - 获取工具详细信息
```bash
claude mcp info <server>/<tool> [--json]
```
- 显示工具的详细信息
- 包括输入 schema、描述等

### 4. **call** - 调用 MCP 工具
```bash
claude mcp call <server>/<tool> <args> [--timeout <ms>] [--json]
```
- 执行 MCP 工具
- 支持 JSON 参数
- 可设置超时时间

### 5. **grep** - 搜索工具
```bash
claude mcp grep <pattern> [-i] [--json]
```
- 使用正则表达式搜索工具名称和描述
- 支持大小写不敏感搜索

### 6. **resources** - 列出 MCP 资源
```bash
claude mcp resources [server] [--json]
```
- 列出所有 MCP 资源
- 可按服务器过滤

### 7. **read** - 读取 MCP 资源
```bash
claude mcp read <server>/<resource> [uri] [--timeout <ms>] [--json]
```
- 读取特定资源内容
- 支持直接 URI（file://, https://）

### 8. **add** - 添加 MCP 服务器
```bash
# stdio 服务器
claude mcp add <name> <command> [args...] --transport stdio [-s scope] [--env KEY=VALUE]

# HTTP 服务器
claude mcp add <name> <url> --transport http [-s scope] [--header KEY:VALUE]

# SSE 服务器
claude mcp add <name> <url> --transport sse [-s scope] [--header KEY:VALUE]

# 从 JSON 添加
claude mcp add-json <name> <json> [-s scope]
```

**支持的传输类型**:
- **stdio**: 本地命令执行（最常用）
  - 需要 `command` 和 `args`
  - 可设置环境变量 `--env`
- **http**: HTTP 协议
  - 需要 `url`
  - 可设置 headers `--header`
- **sse**: Server-Sent Events
  - 需要 `url`
  - 可设置 headers `--header`

**作用域 (scope)**:
- `local`: `~/.claude/local.json`
- `user`: `~/.claude/settings.json`（默认）
- `project`: `./.claude/settings.json`

### 9. **remove** - 移除 MCP 服务器
```bash
claude mcp remove <name> [-s scope]
```
- 如果不指定 scope，自动检测并让用户选择
- 支持从多个作用域移除

### 10. **list** - 列出配置的服务器
```bash
claude mcp list
```
- 检查服务器健康状态
- 显示连接状态（✓ Connected, ✗ Failed, ⚠ Needs authentication）
- 显示服务器类型和配置信息

### 11. **get** - 获取服务器详情
```bash
claude mcp get <name>
```
- 显示服务器完整配置
- 包括 scope、类型、URL/命令、环境变量等

### 12. **add-from-claude-desktop** - 从 Claude Desktop 导入
```bash
claude mcp add-from-claude-desktop [-s scope]
```
- 从 Claude Desktop 配置导入 MCP 服务器（仅 Mac 和 WSL）

### 13. **reset-project-choices** - 重置项目选择
```bash
claude mcp reset-project-choices
```
- 重置所有项目级 (.mcp.json) 服务器的批准/拒绝状态

## 本次完善的 /mcp 斜杠命令

基于官方源码，完善了以下功能：

### 1. **list** - 列出所有配置的服务器
- ✅ 支持多作用域读取（local, project, user）
- ✅ 显示服务器类型（stdio, http, sse）
- ✅ 显示配置信息（命令/URL）
- ✅ 显示环境变量列表
- ✅ 显示配置文件位置

**示例输出**:
```
MCP Servers:

Checking MCP server health...

  filesystem: npx -y @anthropic-ai/mcp-server-filesystem /path/to/dir - Configured
    Environment: PATH

  github: npx -y @anthropic-ai/mcp-server-github - Configured
    Environment: GITHUB_TOKEN

Commands:
  /mcp list              - List all configured servers
  /mcp add <name>        - Add a new server (shows examples)
  /mcp remove <name>     - Remove a server
  /mcp get <name>        - Get details about a server
  /mcp test <name>       - Test server connection

Configuration files:
  User:    /home/user/.claude/settings.json
  Project: /workspace/.claude/settings.json
  Local:   /home/user/.claude/local.json
```

### 2. **add** - 添加服务器指南
- ✅ 显示三种传输类型的配置示例
- ✅ stdio、http、sse 的完整配置示例
- ✅ 包含环境变量和 headers 示例

**示例输出**:
```
Add an MCP server

Usage:
  /mcp add <name>          - Show configuration examples

Examples:

  # Add stdio server (most common):
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path/to/dir"]
      }
    }
  }

  # Add HTTP server:
  {
    "mcpServers": {
      "sentry": {
        "type": "http",
        "url": "https://mcp.sentry.dev/mcp"
      }
    }
  }
```

### 3. **remove** - 移除服务器
- ✅ 检查服务器是否存在
- ✅ 显示所有可能的配置文件位置
- ✅ 提供明确的操作步骤

### 4. **get** - 获取服务器详情
- ✅ 显示服务器类型
- ✅ 根据类型显示相应配置（命令/URL）
- ✅ 显示环境变量（敏感信息掩码）
- ✅ 显示 HTTP headers

**示例输出**:
```
MCP Server Details: github

Type: stdio
Command: npx
Args: -y @anthropic-ai/mcp-server-github
Environment Variables:
  GITHUB_TOKEN=***
```

### 5. **test/status** - 测试连接/查看状态
- ✅ 支持测试单个服务器
- ✅ 显示所有服务器的配置状态
- ✅ 说明运行时连接检查的限制

## 实现细节

### 配置文件读取
```typescript
// 支持三个作用域的配置文件
const userConfigFile = path.join(homeDir, '.claude', 'settings.json');
const projectConfigFile = path.join(ctx.config.cwd, '.claude', 'settings.json');
const localConfigFile = path.join(homeDir, '.claude', 'local.json');

// 合并优先级：user > project > local
const allServers = {
  ...localConfig.mcpServers || {},
  ...projectConfig.mcpServers || {},
  ...userConfig.mcpServers || {},
};
```

### 服务器类型识别
```typescript
const type = s.type || 'stdio';

if (type === 'stdio') {
  // 显示 command + args
} else if (type === 'http') {
  // 显示 URL (HTTP)
} else if (type === 'sse') {
  // 显示 URL (SSE)
}
```

### 敏感信息保护
```typescript
const displayValue = key.toLowerCase().includes('token') ||
                     key.toLowerCase().includes('key') ||
                     key.toLowerCase().includes('secret')
  ? '***'
  : value;
```

## 与官方命令的差异

| 功能 | 官方 CLI (`claude mcp`) | 斜杠命令 (`/mcp`) |
|------|------------------------|------------------|
| 列出服务器 | ✅ 运行时连接状态 | ✅ 配置状态 |
| 添加服务器 | ✅ 直接修改配置 | ℹ️ 显示配置示例 |
| 移除服务器 | ✅ 直接修改配置 | ℹ️ 显示移除指南 |
| 获取详情 | ✅ | ✅ |
| 测试连接 | ✅ 实时测试 | ℹ️ 配置检查 |
| 调用工具 | ✅ | ❌ 需运行时 |
| 搜索工具 | ✅ | ❌ 需运行时 |
| 读取资源 | ✅ | ❌ 需运行时 |

**说明**:
- 官方 CLI 命令有完整的运行时访问权限，可以直接操作 MCP 客户端
- 斜杠命令主要用于配置管理和信息查询，受限于当前会话环境
- 动态功能（工具调用、资源读取）需要运行时 MCP 客户端支持

## 健康检查机制

官方实现的健康检查函数 `aw9`:
```typescript
async function aw9(serverName, serverConfig) {
  try {
    const client = await ZYA(serverName, serverConfig);
    if (client.type === "connected") return "✓ Connected";
    else if (client.type === "needs-auth") return "⚠ Needs authentication";
    else return "✗ Failed to connect";
  } catch (error) {
    return "✗ Connection error";
  }
}
```

当前实现使用静态配置检查，避免运行时依赖。

## 配置文件结构

### stdio 服务器
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### HTTP 服务器
```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### SSE 服务器
```json
{
  "mcpServers": {
    "server-name": {
      "type": "sse",
      "url": "https://example.com/sse",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

## 改进建议

未来可能的增强：

1. **运行时集成**: 如果能访问当前会话的 MCP 客户端，可以实现：
   - 实时健康检查
   - 工具调用
   - 资源读取

2. **交互式配置**:
   - 交互式添加服务器向导
   - 配置验证和测试

3. **工具发现**:
   - 列出每个服务器提供的工具
   - 工具搜索和筛选

4. **资源管理**:
   - 列出可用资源
   - 资源浏览和预览

## 总结

本次完善基于官方源码 `claude-code@2.0.59`，实现了：

✅ 多作用域配置文件支持
✅ 三种传输类型识别（stdio, http, sse）
✅ 详细的配置信息显示
✅ 敏感信息保护
✅ 清晰的使用示例和文档
✅ TypeScript 类型安全
✅ 编译通过

代码位置: `/home/user/claude-code-open/src/commands/tools.ts`

编译状态: ✅ 成功
