# Claude Code Hooks 示例

本目录包含了 Claude Code Hooks 系统的完整示例和脚本。

## 目录结构

```
examples/
├── hooks-config-example.json       # 完整的 Hook 配置示例（展示所有事件类型）
├── hooks-complete-example.json     # 实用的 Hook 配置（使用本地脚本）
├── hooks-scripts/                  # Hook 脚本示例
│   ├── pre-tool-validator.sh      # 工具执行前验证
│   ├── post-tool-logger.sh        # 工具执行后日志记录
│   ├── session-manager.sh         # 会话管理（开始/结束）
│   └── permission-handler.sh      # 权限自动化处理
└── HOOKS_EXAMPLES.md              # 本文件
```

## 快速开始

### 1. 查看配置示例

```bash
# 查看完整配置示例（包含所有事件类型）
cat examples/hooks-config-example.json

# 查看实用配置示例（使用本地脚本）
cat examples/hooks-complete-example.json
```

### 2. 测试 Hook 脚本

所有脚本都可以单独测试：

```bash
# 测试 Pre-Tool 验证器
echo '{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": {"command": "ls -la"},
  "sessionId": "test-123"
}' | ./examples/hooks-scripts/pre-tool-validator.sh

# 测试危险命令拦截
echo '{
  "event": "PreToolUse",
  "toolName": "Bash",
  "toolInput": {"command": "rm -rf /"},
  "sessionId": "test-123"
}' | ./examples/hooks-scripts/pre-tool-validator.sh

# 测试日志记录器
echo '{
  "event": "PostToolUse",
  "toolName": "Read",
  "toolInput": {"file_path": "/tmp/test.txt"},
  "toolOutput": "file contents here",
  "sessionId": "test-123"
}' | ./examples/hooks-scripts/post-tool-logger.sh

# 测试会话管理（开始）
echo '{
  "event": "SessionStart",
  "sessionId": "test-session-001"
}' | ./examples/hooks-scripts/session-manager.sh

# 测试会话管理（结束）
echo '{
  "event": "SessionEnd",
  "sessionId": "test-session-001"
}' | ./examples/hooks-scripts/session-manager.sh

# 测试权限处理器
echo '{
  "event": "PermissionRequest",
  "toolName": "Read",
  "toolInput": {"file_path": "/tmp/test.txt"},
  "sessionId": "test-123"
}' | ./examples/hooks-scripts/permission-handler.sh
```

### 3. 在项目中使用

#### 方法 1：全局配置

```bash
# 复制配置到全局配置目录
cp examples/hooks-complete-example.json ~/.claude/settings.json

# 或者合并到现有配置
# 编辑 ~/.claude/settings.json，添加 hooks 部分
```

#### 方法 2：项目配置

```bash
# 在项目根目录创建配置
mkdir -p .claude
cp examples/hooks-complete-example.json .claude/settings.json

# 启动 Claude Code
npm run dev
```

#### 方法 3：独立 Hook 文件

```bash
# 创建 hooks 目录
mkdir -p .claude/hooks

# 复制单个 hook 配置
cat > .claude/hooks/security.json << 'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./examples/hooks-scripts/pre-tool-validator.sh",
        "blocking": true
      }
    ]
  }
}
EOF
```

## 脚本说明

### pre-tool-validator.sh

**功能：** 在工具执行前进行安全验证

**验证规则：**
- Bash 工具：阻止危险命令（rm -rf /、mkfs、dd 等）
- Write 工具：阻止写入系统目录（/etc、/sys、/proc）

**输出格式：**
- 验证通过：`{"allowed": true, "message": "验证通过"}`
- 验证失败：`{"blocked": true, "message": "原因"}`

**使用场景：**
- 防止意外执行危险命令
- 保护系统目录不被修改
- 实施安全策略

### post-tool-logger.sh

**功能：** 记录工具执行日志

**日志内容：**
- 时间戳
- 会话 ID
- 事件类型
- 工具名称
- 输出长度

**日志位置：** `/tmp/claude-hooks-logs/tools.log`

**使用场景：**
- 审计工具使用情况
- 调试问题
- 性能分析

### session-manager.sh

**功能：** 管理会话生命周期

**SessionStart 处理：**
- 创建会话目录：`/tmp/claude-sessions/{SESSION_ID}`
- 记录开始时间
- 初始化会话日志

**SessionEnd 处理：**
- 记录结束时间
- 计算会话持续时间
- 可选：压缩和归档会话数据

**使用场景：**
- 会话数据管理
- 会话统计
- 资源清理

### permission-handler.sh

**功能：** 自动化权限决策

**自动批准规则：**
- Read、Glob、Grep 工具：自动批准
- Write、Edit 工具：检查文件路径
  - 允许：项目目录（/home/*、./*）
  - 拒绝：系统目录
- Bash 工具：检查命令安全性
  - 拒绝：rm -rf、sudo、shutdown 等

**输出格式：**
- 批准：`{"decision": "allow", "message": "原因"}`
- 拒绝：`{"decision": "deny", "message": "原因"}`

**使用场景：**
- 自动化工作流程
- 减少手动确认
- 实施访问控制策略

## 高级用法

### 组合多个 Hook

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./scripts/validate.sh",
        "blocking": true,
        "matcher": "Bash"
      },
      {
        "type": "command",
        "command": "./scripts/log-pre.sh",
        "blocking": false
      },
      {
        "type": "url",
        "url": "http://localhost:8080/pre-tool",
        "blocking": false
      }
    ]
  }
}
```

### 使用正则匹配

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "./scripts/log-write-tools.sh",
        "matcher": "/Write|Edit|MultiEdit/"
      }
    ]
  }
}
```

### 环境变量替换

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "echo 'Tool: $TOOL_NAME, Event: $EVENT' >> /tmp/hooks.log",
        "blocking": false
      }
    ]
  }
}
```

### URL Hook 示例

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "url",
        "url": "https://your-server.com/api/hooks/tool-execution",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN",
          "X-Claude-Session": "$SESSION_ID"
        },
        "timeout": 5000,
        "blocking": false
      }
    ]
  }
}
```

## 自定义脚本模板

### 基础模板

```bash
#!/bin/bash
# Hook 脚本模板

# 读取 JSON 输入
read -r input

# 提取字段
EVENT=$(echo "$input" | jq -r '.event')
TOOL_NAME=$(echo "$input" | jq -r '.toolName')
SESSION_ID=$(echo "$input" | jq -r '.sessionId')

# 你的逻辑
echo "Processing hook for $TOOL_NAME" >&2

# 返回结果
echo '{"status": "success"}'
exit 0
```

### 阻塞操作模板

```bash
#!/bin/bash
# 阻塞操作模板

read -r input

# 检查条件
if [ 某个条件 ]; then
  # 阻塞操作
  echo '{"blocked": true, "message": "操作被阻止"}'
  exit 1
fi

# 允许操作
echo '{"allowed": true}'
exit 0
```

### 权限决策模板

```bash
#!/bin/bash
# 权限决策模板

read -r input
TOOL_NAME=$(echo "$input" | jq -r '.toolName')

# 决策逻辑
if [ 允许条件 ]; then
  echo '{"decision": "allow", "message": "批准原因"}'
  exit 0
else
  echo '{"decision": "deny", "message": "拒绝原因"}'
  exit 1
fi
```

## 调试技巧

### 启用详细日志

```bash
# 在脚本中添加调试输出（发送到 stderr）
echo "[DEBUG] Input: $input" >&2
echo "[DEBUG] Tool: $TOOL_NAME" >&2
```

### 测试脚本

```bash
# 使用 set -x 跟踪执行
#!/bin/bash
set -x  # 启用调试
# ... 你的代码
```

### 检查 JSON 格式

```bash
# 验证 JSON 输出
echo '{"blocked": true, "message": "test"}' | jq .
```

### 查看日志

```bash
# 查看工具执行日志
tail -f /tmp/claude-hooks-logs/tools.log

# 查看会话日志
ls -la /tmp/claude-sessions/
```

## 常见问题

### Q: Hook 没有执行？
A: 检查：
1. 脚本是否有执行权限（chmod +x）
2. 配置文件路径是否正确
3. 事件名称是否匹配
4. matcher 是否匹配工具名称

### Q: 脚本执行超时？
A: 增加 timeout 值或优化脚本性能

### Q: 如何调试脚本？
A: 使用 stderr 输出调试信息，或将日志写入文件

### Q: 可以用其他语言写 Hook 吗？
A: 可以！只要能读取 stdin 的 JSON 并输出 JSON 即可。示例：

**Python:**
```python
#!/usr/bin/env python3
import sys
import json

input_data = json.load(sys.stdin)
tool_name = input_data.get('toolName')

# 你的逻辑
result = {"allowed": True, "message": "OK"}
print(json.dumps(result))
```

**Node.js:**
```javascript
#!/usr/bin/env node
const input = require('fs').readFileSync(0, 'utf-8');
const data = JSON.parse(input);

// 你的逻辑
const result = { allowed: true, message: 'OK' };
console.log(JSON.stringify(result));
```

## 更多资源

- [完整 Hook 文档](../docs/HOOKS.md)
- [Hook 系统源码](../src/hooks/index.ts)
- [配置管理](../src/config/index.ts)
