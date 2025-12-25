#!/bin/bash
# Post-Tool 日志记录脚本示例
# 用于记录工具执行后的结果

# 读取来自 stdin 的 JSON 输入
read -r input

# 提取信息
TOOL_NAME=$(echo "$input" | jq -r '.toolName')
EVENT=$(echo "$input" | jq -r '.event')
SESSION_ID=$(echo "$input" | jq -r '.sessionId')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 日志文件路径
LOG_DIR="/tmp/claude-hooks-logs"
LOG_FILE="$LOG_DIR/tools.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 记录日志
echo "[$TIMESTAMP] Session: $SESSION_ID | Event: $EVENT | Tool: $TOOL_NAME" >> "$LOG_FILE"

# 如果有输出，记录输出摘要
if [ "$(echo "$input" | jq -r '.toolOutput')" != "null" ]; then
  OUTPUT_LENGTH=$(echo "$input" | jq -r '.toolOutput | length')
  echo "  └─ Output length: $OUTPUT_LENGTH bytes" >> "$LOG_FILE"
fi

# 成功返回
exit 0
