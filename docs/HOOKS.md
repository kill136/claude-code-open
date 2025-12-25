# Claude Code Hooks 系统

基于官方 Claude Code CLI v2.0.76 逆向分析的完整 Hook 系统实现。

## 概述

Hook 系统允许您在 Claude Code 的关键事件点执行自定义脚本或发送 HTTP 回调。支持 12 种事件类型和 2 种 Hook 类型。

## 支持的 Hook 事件

### 1. PreToolUse
**触发时机：** 工具执行之前
**用途：** 工具执行前的验证、日志记录、权限检查
**可阻塞：** 是

### 2. PostToolUse
**触发时机：** 工具执行成功之后
**用途：** 记录工具执行结果、触发后续操作
**可阻塞：** 否

### 3. PostToolUseFailure
**触发时机：** 工具执行失败之后
**用途：** 错误日志记录、告警通知
**可阻塞：** 否

### 4. UserPromptSubmit
**触发时机：** 用户提交提示之前
**用途：** 内容过滤、敏感信息检查
**可阻塞：** 是

### 5. SessionStart
**触发时机：** 会话开始时
**用途：** 初始化环境、发送会话启动通知
**可阻塞：** 否

### 6. SessionEnd
**触发时机：** 会话结束时
**用途：** 清理资源、保存会话摘要
**可阻塞：** 否

### 7. Notification
**触发时机：** 发送通知时
**用途：** 自定义通知处理、集成第三方通知服务
**可阻塞：** 否

### 8. PermissionRequest
**触发时机：** 请求权限时
**用途：** 自动化权限决策、审计日志
**可阻塞：** 是

### 9. SubagentStart
**触发时机：** 子代理启动时
**用途：** 子代理启动日志、资源分配
**可阻塞：** 否

### 10. SubagentStop
**触发时机：** 子代理停止时
**用途：** 子代理停止日志、资源回收
**可阻塞：** 否

### 11. PreCompact
**触发时机：** 会话压缩之前
**用途：** 备份原始会话、压缩前验证
**可阻塞：** 是

### 12. Stop
**触发时机：** 停止操作时
**用途：** 紧急停止日志、清理操作
**可阻塞：** 否

## Hook 类型

### Command Hook

执行本地命令或脚本。

**配置示例：**
```json
{
  "type": "command",
  "command": "./scripts/pre-tool.sh $TOOL_NAME",
  "args": ["--verbose"],
  "env": {
    "CUSTOM_VAR": "value"
  },
  "timeout": 5000,
  "blocking": true,
  "matcher": "Bash"
}
```

**字段说明：**
- `type`: 必须为 `"command"`
- `command`: 要执行的命令（支持环境变量替换）
- `args`: 命令参数（可选）
- `env`: 自定义环境变量（可选）
- `timeout`: 超时时间（毫秒，默认 30000）
- `blocking`: 是否阻塞（默认 true）
- `matcher`: 工具名匹配条件（可选，支持正则）

**环境变量替换：**
- `$TOOL_NAME`: 工具名称
- `$EVENT`: 事件类型
- `$SESSION_ID`: 会话 ID

**环境变量（自动注入）：**
- `CLAUDE_HOOK_EVENT`: 事件类型
- `CLAUDE_HOOK_TOOL_NAME`: 工具名称
- `CLAUDE_HOOK_SESSION_ID`: 会话 ID

**输入数据：**
通过 stdin 传递 JSON 格式的输入数据：
```json
{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": { "command": "ls -la" },
  "sessionId": "xxx"
}
```

**阻塞操作：**
返回非零退出码或输出包含 `{"blocked": true}` 的 JSON 即可阻塞操作：
```json
{
  "blocked": true,
  "message": "操作被阻止：原因说明"
}
```

### URL Hook

发送 HTTP 请求到指定 URL。

**配置示例：**
```json
{
  "type": "url",
  "url": "http://localhost:8080/hooks/pre-tool",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer your-token",
    "X-Hook-Type": "PreToolUse"
  },
  "timeout": 3000,
  "blocking": false,
  "matcher": "/Bash|Write/"
}
```

**字段说明：**
- `type`: 必须为 `"url"`
- `url`: 回调 URL
- `method`: HTTP 方法（GET/POST/PUT/PATCH，默认 POST）
- `headers`: 自定义请求头（可选）
- `timeout`: 超时时间（毫秒，默认 10000）
- `blocking`: 是否阻塞（默认 false）
- `matcher`: 工具名匹配条件（可选，支持正则）

**请求数据：**
自动发送 JSON 格式的 POST 请求：
```json
{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": { "command": "ls -la" },
  "toolOutput": "...",
  "message": "...",
  "sessionId": "xxx",
  "timestamp": "2025-12-24T10:00:00.000Z"
}
```

**响应格式（可选）：**
返回 JSON 响应可控制阻塞行为：
```json
{
  "blocked": true,
  "message": "操作被阻止：原因说明"
}
```

## 配置文件格式

### 新格式（推荐）

```json
{
  "hooks": {
    "PreToolUse": [
      { "type": "command", "command": "./pre-tool.sh" },
      { "type": "url", "url": "http://localhost:8080/hook" }
    ],
    "PostToolUse": [
      { "type": "url", "url": "http://localhost:8080/post-tool" }
    ]
  }
}
```

### 旧格式（兼容）

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "command": "./pre-tool.sh",
      "blocking": true
    }
  ]
}
```

## 配置文件位置

Hook 配置可以放在以下位置：

1. **全局配置：** `~/.claude/settings.json`
2. **项目配置：** `.claude/settings.json`
3. **Hook 目录：** `.claude/hooks/*.json`

优先级：项目配置 > Hook 目录 > 全局配置

## 使用示例

### 示例 1：工具执行前验证

**场景：** 阻止执行危险的 Bash 命令

**脚本：** `scripts/validate-bash.sh`
```bash
#!/bin/bash
read -r input
COMMAND=$(echo "$input" | jq -r '.toolInput.command')

if [[ "$COMMAND" == *"rm -rf"* ]]; then
  echo '{"blocked": true, "message": "危险命令被阻止"}'
  exit 1
fi

exit 0
```

**配置：**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./scripts/validate-bash.sh",
        "blocking": true,
        "matcher": "Bash"
      }
    ]
  }
}
```

### 示例 2：工具执行后发送通知

**场景：** 每次工具执行后发送 Slack 通知

**配置：**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "method": "POST",
        "blocking": false
      }
    ]
  }
}
```

### 示例 3：会话开始时初始化环境

**脚本：** `scripts/session-start.sh`
```bash
#!/bin/bash
read -r input
SESSION_ID=$(echo "$input" | jq -r '.sessionId')

echo "Session started: $SESSION_ID" >> /var/log/claude-sessions.log
mkdir -p "/tmp/claude-sessions/$SESSION_ID"

exit 0
```

**配置：**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "./scripts/session-start.sh",
        "blocking": false
      }
    ]
  }
}
```

### 示例 4：权限请求自动化

**场景：** 自动批准特定工具的权限请求

**脚本：** `scripts/auto-approve.sh`
```bash
#!/bin/bash
read -r input
TOOL_NAME=$(echo "$input" | jq -r '.toolName')

# 自动批准 Read 和 Glob 工具
if [[ "$TOOL_NAME" == "Read" || "$TOOL_NAME" == "Glob" ]]; then
  echo '{"decision": "allow", "message": "自动批准"}'
  exit 0
fi

# 拒绝其他工具
echo '{"decision": "deny", "message": "需要手动批准"}'
exit 1
```

**配置：**
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "type": "command",
        "command": "./scripts/auto-approve.sh",
        "blocking": true
      }
    ]
  }
}
```

## 编程 API

### 注册 Hook

```typescript
import { registerHook, HookEvent } from './hooks';

// 注册 Command Hook
registerHook('PreToolUse', {
  type: 'command',
  command: './pre-tool.sh',
  blocking: true,
});

// 注册 URL Hook
registerHook('PostToolUse', {
  type: 'url',
  url: 'http://localhost:8080/hook',
  method: 'POST',
});
```

### 运行 Hook

```typescript
import {
  runPreToolUseHooks,
  runPostToolUseHooks,
  runSessionStartHooks,
} from './hooks';

// 工具执行前
const result = await runPreToolUseHooks('Bash', { command: 'ls' }, sessionId);
if (!result.allowed) {
  console.error('操作被阻止:', result.message);
  return;
}

// 工具执行后
await runPostToolUseHooks('Bash', { command: 'ls' }, output, sessionId);

// 会话开始
await runSessionStartHooks(sessionId);
```

### 查询 Hook

```typescript
import {
  getRegisteredHooks,
  getHooksForEvent,
  getHookCount,
} from './hooks';

// 获取所有 Hooks（按事件分组）
const allHooks = getRegisteredHooks();

// 获取特定事件的 Hooks
const preToolHooks = getHooksForEvent('PreToolUse');

// 获取 Hook 数量
const count = getHookCount();
```

### 取消注册 Hook

```typescript
import { unregisterHook, clearEventHooks, clearHooks } from './hooks';

// 取消注册特定 Hook
unregisterHook('PreToolUse', {
  type: 'command',
  command: './pre-tool.sh',
});

// 清除特定事件的所有 Hooks
clearEventHooks('PreToolUse');

// 清除所有 Hooks
clearHooks();
```

## 最佳实践

1. **使用 blocking 谨慎：** 只在必要时使用阻塞 Hook，避免影响性能
2. **设置合理的超时：** 避免 Hook 执行时间过长
3. **处理错误：** Hook 应该优雅地处理错误，避免崩溃
4. **日志记录：** 在 Hook 中记录详细日志，便于调试
5. **安全性：** URL Hook 应使用 HTTPS 和身份验证
6. **幂等性：** Hook 应该设计为幂等的，避免重复执行产生副作用

## 调试

### 启用详细日志

```bash
CLAUDE_CODE_DEBUG_LOGS_DIR=/var/log/claude npm run dev
```

### 测试 Hook

使用 `curl` 测试 URL Hook：
```bash
curl -X POST http://localhost:8080/hook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PreToolUse",
    "toolName": "Bash",
    "toolInput": {"command": "ls"},
    "sessionId": "test-123"
  }'
```

使用 shell 测试 Command Hook：
```bash
echo '{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": {"command": "ls"}
}' | ./scripts/pre-tool.sh
```

## 故障排除

### Hook 未触发
- 检查配置文件位置和格式
- 验证事件名称是否正确
- 查看日志输出

### Command Hook 执行失败
- 检查脚本是否有执行权限（`chmod +x`）
- 验证脚本路径是否正确
- 检查环境变量是否正确设置

### URL Hook 超时
- 增加 timeout 值
- 检查网络连接
- 验证 URL 是否可访问

### 阻塞不生效
- 确保 `blocking: true`
- 检查返回格式是否正确
- 验证退出码（Command）或响应状态（URL）
