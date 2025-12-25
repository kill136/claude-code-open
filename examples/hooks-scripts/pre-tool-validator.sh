#!/bin/bash
# Pre-Tool 验证脚本示例
# 用于在工具执行前进行验证

# 读取来自 stdin 的 JSON 输入
read -r input

# 提取工具名称和输入参数
TOOL_NAME=$(echo "$input" | jq -r '.toolName')
EVENT=$(echo "$input" | jq -r '.event')

# 日志记录
echo "[Hook] Event: $EVENT, Tool: $TOOL_NAME" >&2

# 如果是 Bash 工具，检查命令是否安全
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$input" | jq -r '.toolInput.command')

  # 检查危险命令
  if [[ "$COMMAND" == *"rm -rf /"* ]] || \
     [[ "$COMMAND" == *"mkfs"* ]] || \
     [[ "$COMMAND" == *"dd if="* ]]; then
    echo '{"blocked": true, "message": "危险命令被阻止: '"$COMMAND"'"}'
    exit 1
  fi
fi

# 如果是 Write 工具，检查文件路径
if [ "$TOOL_NAME" = "Write" ]; then
  FILE_PATH=$(echo "$input" | jq -r '.toolInput.file_path')

  # 阻止写入系统目录
  if [[ "$FILE_PATH" == /etc/* ]] || \
     [[ "$FILE_PATH" == /sys/* ]] || \
     [[ "$FILE_PATH" == /proc/* ]]; then
    echo '{"blocked": true, "message": "不允许写入系统目录: '"$FILE_PATH"'"}'
    exit 1
  fi
fi

# 验证通过
echo '{"allowed": true, "message": "验证通过"}'
exit 0
