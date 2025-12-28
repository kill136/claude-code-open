# 钩子系统实现完成报告

## 概述

本次任务完成了 Claude Code 项目中 prompt、agent 和 mcp 钩子的完整实现，使钩子系统功能更加完善。

## 修改的文件

### `/home/user/claude-code-open/src/hooks/index.ts`

## 完成的工作

### 1. Prompt 钩子实现（第 475-579 行）

**功能**：使用 LLM（Claude API）评估钩子条件

**实现要点**：
- 使用动态导入避免循环依赖
- 调用 Claude API（通过 ClaudeClient）评估用户自定义的提示词
- 支持变量替换：`{EVENT}`, `{TOOL_NAME}`, `{TOOL_INPUT}`, `{TOOL_OUTPUT}`, `{MESSAGE}`, `{SESSION_ID}`
- 返回 JSON 格式的决策结果：`{"ok": true}` 或 `{"ok": false, "reason": "..."}`
- 支持超时控制（默认 30 秒）
- 可配置使用的模型（默认 claude-3-5-sonnet-20241022）

**使用示例**：
```json
{
  "type": "prompt",
  "prompt": "Check if the tool {TOOL_NAME} with input {TOOL_INPUT} is safe to execute. Return {\"ok\": true} if safe, or {\"ok\": false, \"reason\": \"explanation\"} if not.",
  "model": "claude-3-5-sonnet-20241022",
  "timeout": 30000
}
```

### 2. Agent 钩子实现（第 584-695 行）

**功能**：创建专门的验证代理来评估操作是否应被允许

**实现要点**：
- 基于 agentType 创建专门角色的验证代理
- 构建详细的代理提示词，包含事件、工具信息和代理配置
- 返回决策结果：`{"decision": "allow"|"deny", "reason": "..."}`
- 支持超时控制（默认 60 秒）
- 可传递自定义的 agentConfig 参数

**使用示例**：
```json
{
  "type": "agent",
  "agentType": "security-validator",
  "agentConfig": {
    "allowedCommands": ["ls", "pwd", "cat"],
    "securityLevel": "high"
  },
  "timeout": 60000
}
```

### 3. MCP 钩子实现（第 700-825 行）

**功能**：调用 MCP（Model Context Protocol）服务器的工具来处理钩子逻辑

**实现要点**：
- 验证 MCP 服务器和工具的存在性
- 检查服务器连接状态
- 合并钩子配置参数和运行时输入参数
- 调用 `callMcpTool` 函数执行工具
- 解析返回结果，支持 `blocked` 和 `decision` 字段
- 支持超时控制（默认 30 秒）

**使用示例**：
```json
{
  "type": "mcp",
  "server": "security-server",
  "tool": "validate-operation",
  "toolArgs": {
    "maxFileSize": 10485760
  },
  "timeout": 30000
}
```

### 4. 钩子类型验证增强（第 293-309 行）

在 `isValidHookConfig` 函数中添加了 MCP 类型的验证：
```typescript
else if (config.type === 'mcp') {
  return typeof config.server === 'string' && typeof config.tool === 'string';
}
```

### 5. 钩子执行路由更新（第 914-931 行）

在 `executeHook` 函数中添加了 MCP 钩子的路由：
```typescript
else if (hook.type === 'mcp') {
  return executeMcpHook(hook, input);
}
```

## 钩子类型对比

| 钩子类型 | 执行方式 | 主要用途 | 默认超时 |
|---------|---------|---------|---------|
| **command** | 执行 Shell 命令 | 运行自定义脚本、通知外部系统 | 30s |
| **prompt** | 调用 Claude API 评估 | 使用 AI 判断操作安全性、合规性 | 30s |
| **agent** | 创建验证代理 | 复杂的业务逻辑验证、安全审查 | 60s |
| **mcp** | 调用 MCP 服务器工具 | 集成外部验证服务、扩展能力 | 30s |
| **url** | HTTP 回调 | 远程集成、WebHook 通知 | 10s |

## 配置示例

### 完整的 hooks 配置文件示例

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "prompt",
        "prompt": "Verify that executing {TOOL_NAME} with these parameters is safe: {TOOL_INPUT}. Return {\"ok\": true} if safe.",
        "matcher": "Bash"
      },
      {
        "type": "agent",
        "agentType": "security-validator",
        "agentConfig": {
          "securityLevel": "high"
        }
      }
    ],
    "PostToolUse": [
      {
        "type": "mcp",
        "server": "audit-server",
        "tool": "log-operation",
        "toolArgs": {
          "category": "tool-execution"
        }
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "prompt",
        "prompt": "Check if this user prompt contains any sensitive information: {MESSAGE}",
        "blocking": true
      }
    ]
  }
}
```

## 技术特性

### 1. 动态导入避免循环依赖
使用 `await import()` 动态加载依赖模块，避免在模块初始化时产生循环依赖问题。

### 2. 错误处理
- 超时控制：使用 AbortController 和 setTimeout
- API 错误：捕获并返回详细的错误信息
- 类型验证：在注册和执行时验证配置的有效性

### 3. 灵活的决策机制
- 支持 `blocked` 和 `decision` 两种阻塞方式
- 可返回阻塞原因 `blockMessage` 或 `reason`
- 允许非阻塞的通知型钩子

### 4. 变量替换
Prompt 钩子支持以下变量：
- `{EVENT}` - 钩子事件名称
- `{TOOL_NAME}` - 工具名称
- `{TOOL_INPUT}` - 工具输入（JSON）
- `{TOOL_OUTPUT}` - 工具输出
- `{MESSAGE}` - 消息内容
- `{SESSION_ID}` - 会话ID

## 环境要求

### Prompt 和 Agent 钩子
需要设置 API 密钥：
- `ANTHROPIC_API_KEY` 或
- `CLAUDE_API_KEY`

### MCP 钩子
需要先配置和启动 MCP 服务器，并注册到系统中。

## 测试建议

### 1. Prompt 钩子测试
```json
{
  "type": "prompt",
  "prompt": "Always return {\"ok\": true}",
  "timeout": 5000
}
```

### 2. Agent 钩子测试
```json
{
  "type": "agent",
  "agentType": "test-validator",
  "agentConfig": {"mode": "permissive"}
}
```

### 3. MCP 钩子测试
需要先配置一个测试 MCP 服务器。

## 后续改进建议

1. **缓存机制**：对于相同的 prompt/agent 评估，可以添加缓存避免重复调用
2. **批量评估**：支持一次性评估多个钩子，提高效率
3. **钩子模板**：预定义常用的钩子配置模板
4. **监控和日志**：添加钩子执行的监控指标和详细日志
5. **钩子编辑器**：提供可视化的钩子配置界面

## 总结

本次实现完成了 prompt、agent 和 mcp 三种钩子类型的完整功能，使 Claude Code 的钩子系统更加强大和灵活。用户现在可以：

1. 使用 AI 智能评估操作安全性（prompt 钩子）
2. 创建专门的验证代理处理复杂逻辑（agent 钩子）
3. 集成外部 MCP 服务扩展验证能力（mcp 钩子）

所有钩子都支持超时控制、错误处理、阻塞/非阻塞模式，并可通过 matcher 精确匹配特定工具，为系统提供了强大的扩展性和安全性保障。
