#!/bin/bash
# 会话管理脚本示例
# 用于处理会话开始和结束事件

# 读取来自 stdin 的 JSON 输入
read -r input

# 提取信息
EVENT=$(echo "$input" | jq -r '.event')
SESSION_ID=$(echo "$input" | jq -r '.sessionId')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 会话目录
SESSION_DIR="/tmp/claude-sessions/$SESSION_ID"

case "$EVENT" in
  SessionStart)
    echo "[SessionStart] Creating session directory: $SESSION_DIR" >&2

    # 创建会话目录
    mkdir -p "$SESSION_DIR"

    # 记录会话开始时间
    echo "$TIMESTAMP" > "$SESSION_DIR/start_time.txt"

    # 初始化会话日志
    echo "Session $SESSION_ID started at $TIMESTAMP" > "$SESSION_DIR/session.log"

    echo '{"status": "session_initialized"}'
    ;;

  SessionEnd)
    echo "[SessionEnd] Cleaning up session: $SESSION_ID" >&2

    if [ -d "$SESSION_DIR" ]; then
      # 记录会话结束时间
      echo "$TIMESTAMP" > "$SESSION_DIR/end_time.txt"

      # 计算会话持续时间
      START_TIME=$(cat "$SESSION_DIR/start_time.txt" 2>/dev/null)
      if [ -n "$START_TIME" ]; then
        echo "Session ended at $TIMESTAMP" >> "$SESSION_DIR/session.log"
        echo "Started: $START_TIME" >> "$SESSION_DIR/session.log"
      fi

      # 可选：压缩会话目录
      # tar -czf "$SESSION_DIR.tar.gz" -C /tmp/claude-sessions "$SESSION_ID"
      # rm -rf "$SESSION_DIR"
    fi

    echo '{"status": "session_cleaned"}'
    ;;

  *)
    echo '{"error": "Unknown event: '"$EVENT"'"}'
    exit 1
    ;;
esac

exit 0
