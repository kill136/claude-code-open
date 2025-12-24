# /rename 命令功能说明

## 概述

`/rename` 命令用于设置当前会话的自定义标题（customTitle），该标题会在使用 `/resume` 命令查看会话列表时显示。

## 功能改进

### 从官方源码分析
通过分析官方 Claude Code 源码（v2.0.59），我们了解到：
- 会话元数据包含 `customTitle` 字段
- 该字段用于在会话列表中显示自定义名称
- 优先级：`customTitle` > `summary` > `firstPrompt`

### 实现方式

命令采用双重实现策略，确保在不同环境下都能正常工作：

1. **优先方式**：通过 `ctx.session.setCustomTitle()` 方法
   - 如果 CommandContext 提供了此方法，直接调用
   - 立即生效，无需手动保存

2. **备用方式**：直接修改会话文件
   - 读取 `~/.claude/sessions/<session-id>.json`
   - 更新 `metadata.customTitle` 字段
   - 更新 `metadata.modified` 时间戳
   - 写回文件

## 使用方法

### 基本用法

```bash
/rename my-project-session
```

### 带空格的名称

```bash
/rename Fix authentication bug
```

### 使用场景示例

```bash
# 项目相关
/rename React Dashboard Redesign
/rename Backend API Migration

# 功能相关
/rename Add dark mode feature
/rename Fix memory leak issue

# 日期标记
/rename 2025-12-24 Sprint Planning
```

## 命令输出

### 成功时

```
✓ Session renamed to: "my-project-session"

This name will appear when you use /resume to view past sessions.
```

### 使用文件方式时（显示更多信息）

```
✓ Session renamed to: "my-project-session"

Session ID: a1b2c3d4
Session file updated: /home/user/.claude/sessions/a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6.json

This name will appear when you use /resume to view past sessions.
```

### 错误情况

```
Error renaming session: Session file not found

Please check:
  • Session file exists and is readable
  • You have write permissions
  • The session has been saved at least once
```

## 会话文件格式

命令会更新会话文件中的以下字段：

```json
{
  "state": { ... },
  "messages": [ ... ],
  "metadata": {
    "customTitle": "my-project-session",
    "modified": 1735027200000,
    "gitBranch": "main",
    "firstPrompt": "Help me build a web app",
    "projectPath": "/home/user/projects/my-app",
    "created": 1735020000000,
    "messageCount": 42
  }
}
```

## 与其他命令的集成

### /resume 命令显示

使用 `/rename` 设置的标题会在 `/resume` 命令中显示：

```
Recent Sessions
20 of 45 total

 1. a1b2c3d4  2h ago  42 msgs  (main)  🔷 sonnet
    my-project-session
    📁 ~/projects/my-app
    💬 85.3k tokens

 2. b2c3d4e5  1d ago  15 msgs  🔹 haiku
    Fix authentication bug
```

### /export 命令

导出的会话文件也会包含自定义标题：

**JSON 格式**：
```json
{
  "metadata": {
    "customTitle": "my-project-session",
    ...
  }
}
```

**Markdown 格式**：
```markdown
## Session Information

- **Title:** my-project-session
- **Model:** claude-sonnet-4.5
...
```

## 技术实现细节

### CommandContext 接口扩展

```typescript
export interface CommandContext {
  session: {
    id: string;
    // ... 其他字段
    setCustomTitle?: (title: string) => void;  // 新增
  };
}
```

### Session 类方法

```typescript
class Session {
  private customTitle?: string;

  setCustomTitle(title: string): void {
    this.customTitle = title;
  }

  save(): string {
    const data = {
      // ...
      metadata: {
        customTitle: this.customTitle,
        // ...
      }
    };
    // 保存到文件
  }
}
```

## 最佳实践

1. **使用描述性名称**
   - ✅ "Implement user authentication"
   - ❌ "Session 1"

2. **包含上下文信息**
   - ✅ "Bug fix: Login redirect issue"
   - ❌ "Fix"

3. **保持简洁**
   - ✅ "Add payment integration" (25 字符)
   - ❌ "Add complete payment processing system with Stripe integration and webhook handlers" (80+ 字符)

4. **使用一致的命名约定**
   ```
   feat: Add dark mode
   fix: Memory leak in dashboard
   docs: Update API documentation
   ```

## 故障排除

### 问题：会话文件未找到

**原因**：会话尚未保存到磁盘

**解决**：先与 Claude 进行一些对话，触发会话自动保存

### 问题：权限错误

**原因**：无法写入 `~/.claude/sessions/` 目录

**解决**：
```bash
chmod 755 ~/.claude/sessions
```

### 问题：名称未在 /resume 中显示

**原因**：会话文件缓存或未重新加载

**解决**：重启 Claude Code 或使用新的会话

## 相关命令

- `/resume` - 查看和恢复过往会话
- `/export` - 导出会话到文件
- `/context` - 查看当前会话的上下文使用情况

## 版本历史

- **v2.0.76** - 完善实现，支持双重策略（方法调用 + 文件修改）
- **官方 v2.0.59** - 官方版本包含基本的 rename 功能

## 参考

- Session 类实现: `src/core/session.ts`
- 命令实现: `src/commands/session.ts`
- 类型定义: `src/commands/types.ts`
