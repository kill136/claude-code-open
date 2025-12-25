#!/bin/bash
# 权限处理脚本示例
# 用于自动化权限决策

# 读取来自 stdin 的 JSON 输入
read -r input

# 提取信息
TOOL_NAME=$(echo "$input" | jq -r '.toolName')
SESSION_ID=$(echo "$input" | jq -r '.sessionId')

# 日志记录
echo "[PermissionRequest] Tool: $TOOL_NAME, Session: $SESSION_ID" >&2

# 定义自动批准的工具列表
AUTO_APPROVE_TOOLS=("Read" "Glob" "Grep")

# 检查是否在自动批准列表中
for tool in "${AUTO_APPROVE_TOOLS[@]}"; do
  if [ "$TOOL_NAME" = "$tool" ]; then
    echo '{"decision": "allow", "message": "工具 '"$TOOL_NAME"' 已自动批准"}'
    exit 0
  fi
done

# 对于写操作，需要检查目标路径
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
  FILE_PATH=$(echo "$input" | jq -r '.toolInput.file_path')

  # 允许写入项目目录
  if [[ "$FILE_PATH" == /home/* ]] || [[ "$FILE_PATH" == ./* ]]; then
    echo '{"decision": "allow", "message": "允许写入项目文件: '"$FILE_PATH"'"}'
    exit 0
  fi

  # 拒绝写入其他位置
  echo '{"decision": "deny", "message": "拒绝写入系统文件: '"$FILE_PATH"'"}'
  exit 1
fi

# 对于 Bash 命令，进行额外检查
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$input" | jq -r '.toolInput.command')

  # 拒绝危险命令
  if [[ "$COMMAND" == *"rm -rf"* ]] || \
     [[ "$COMMAND" == *"sudo"* ]] || \
     [[ "$COMMAND" == *"shutdown"* ]]; then
    echo '{"decision": "deny", "message": "拒绝执行危险命令: '"$COMMAND"'"}'
    exit 1
  fi

  # 允许安全命令
  echo '{"decision": "allow", "message": "允许执行命令"}'
  exit 0
fi

# 默认：需要手动批准
echo '{"decision": "deny", "message": "工具 '"$TOOL_NAME"' 需要手动批准"}'
exit 1
