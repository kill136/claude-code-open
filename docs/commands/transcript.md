# /transcript 命令

## 概述

`/transcript` 命令用于导出 Claude Code 会话的对话转录记录，以清晰易读的纯文本格式呈现完整的对话历史。

## 基本用法

```bash
/transcript                    # 在终端中显示转录内容
/transcript <output-path>      # 将转录保存到指定文件
```

## 命令别名

- `/trans` - `/transcript` 的简短别名

## 功能特点

### 1. 清晰的格式化输出

转录文件包含：
- 会话元数据（ID、模型、时间、成本等）
- 完整的对话历史，按时间顺序排列
- 用户和助手消息的清晰标识
- 工具调用和结果的详细记录
- 会话统计摘要

### 2. 灵活的输出方式

- **终端显示**：不带参数时在终端中显示（长内容会被截断）
- **文件导出**：指定路径时保存为文本文件
- **自动文件命名**：使用格式 `transcript-<session-id>-<date>.txt`

### 3. 智能内容处理

- 自动处理简单文本和复杂消息结构
- 工具调用和结果的友好格式化
- 长内容自动截断，避免文件过大
- 支持多种消息类型（文本、工具使用、工具结果）

## 使用示例

### 示例 1：查看当前会话转录

```bash
/transcript
```

**输出示例：**
```
================================================================================
CLAUDE CODE CONVERSATION TRANSCRIPT
================================================================================

Session ID:    a1b2c3d4-e5f6-7890-abcd-ef1234567890
Exported:      2025-12-30T10:30:00.000Z
Model:         claude-sonnet-4.5-20250929
Messages:      12
Duration:      15m 30s
Total Cost:    $0.0450

--------------------------------------------------------------------------------

[USER] at 2025-12-30T10:15:00.000Z

实现一个 /transcript 命令

[ASSISTANT] at 2025-12-30T10:15:30.000Z

我来帮你实现 /transcript 命令...

--------------------------------------------------------------------------------

... (更多消息)

================================================================================
END OF TRANSCRIPT
================================================================================

Total Messages:  12
Session Cost:    $0.0450
Export Time:     2025-12-30T10:30:00.000Z
```

### 示例 2：导出到文件

```bash
/transcript ./conversation-log.txt
```

**输出：**
```
✓ Transcript exported successfully!

File: /home/user/project/conversation-log.txt
Size: 15.2 KB
Messages: 12

The transcript contains a clean, readable record of the entire conversation.

You can:
  • Share this transcript with others
  • Archive it for documentation
  • Use it for review or analysis
  • Search through conversation history

Tip: Use '/transcript <path>' to specify a custom output location.
```

### 示例 3：指定完整路径

```bash
/transcript ~/Documents/claude-sessions/session-2025-12-30.txt
```

## 输出格式说明

### 文件结构

```
================================================================================
CLAUDE CODE CONVERSATION TRANSCRIPT
================================================================================

<会话元数据>

--------------------------------------------------------------------------------

<消息 1>

--------------------------------------------------------------------------------

<消息 2>

--------------------------------------------------------------------------------

...

================================================================================
END OF TRANSCRIPT
================================================================================

<会话总结>
```

### 消息格式

每条消息包含：

1. **消息头**：角色标识和时间戳
   ```
   [USER] at 2025-12-30T10:15:00.000Z
   ```
   或
   ```
   [ASSISTANT] at 2025-12-30T10:15:30.000Z
   ```

2. **消息内容**：
   - 纯文本消息直接显示
   - 工具调用显示工具名称和输入参数
   - 工具结果显示（长内容会被截断）

3. **分隔线**：消息之间用 80 个短横线分隔

## 与 /export 命令的区别

| 特性 | /transcript | /export |
|------|------------|---------|
| 输出格式 | 纯文本 (TXT) | Markdown 或 JSON |
| 用途 | 快速阅读和分享 | 结构化存档和处理 |
| 文件大小 | 较小（工具结果被截断） | 完整（包含所有数据） |
| 可读性 | 高（优化了人类阅读） | 中等（Markdown）/ 低（JSON） |
| 机器处理 | 不适合 | 适合（特别是 JSON） |

## 适用场景

### 1. 对话归档
- 保存重要的技术讨论
- 记录问题解决过程
- 建立知识库

### 2. 团队协作
- 与同事分享对话内容
- 代码审查时提供上下文
- 文档化设计决策

### 3. 学习和回顾
- 复习复杂的技术讨论
- 追踪项目演进过程
- 学习最佳实践

### 4. 问题报告
- 附加完整的对话历史到 bug 报告
- 向支持团队提供上下文
- 记录错误复现步骤

## 技术细节

### 文件大小控制

- 工具结果自动截断到 500 字符
- 终端显示限制为 3000 字符
- 文件导出无大小限制（但工具结果仍会截断）

### 会话数据来源

转录数据从以下位置读取：
- 会话文件：`~/.claude/sessions/<session-id>.json`
- 包含完整的消息历史和元数据

### 支持的消息类型

- `text` - 普通文本消息
- `tool_use` - 工具调用请求
- `tool_result` - 工具执行结果

## 错误处理

如果遇到问题，命令会提供详细的错误信息和建议：

```
Error generating transcript: Session file not found

Please check:
  • Session file exists and is readable
  • You have permission to access the session
  • The session has been saved at least once

You can try:
  • /export markdown - Export in Markdown format
  • /export json - Export complete session data
```

## 最佳实践

1. **定期导出**：重要会话及时导出，避免数据丢失
2. **命名规范**：使用描述性的文件名（如 `bugfix-login-2025-12-30.txt`）
3. **版本管理**：将转录文件加入版本控制（如 Git）
4. **隐私注意**：导出前确保不包含敏感信息
5. **存储组织**：按项目或主题分类存储转录文件

## 相关命令

- `/export` - 导出会话为 Markdown 或 JSON 格式
- `/resume` - 查看和恢复历史会话
- `/rename` - 为会话设置自定义名称
- `/context` - 查看会话上下文使用情况

## 版本历史

- v2.0.76 - 初始实现 `/transcript` 命令
  - 支持纯文本格式导出
  - 智能内容截断
  - 清晰的格式化输出
  - 别名 `/trans`

## 示例转录文件

完整的转录文件示例请参见：[示例转录文件](../examples/transcript-example.txt)
