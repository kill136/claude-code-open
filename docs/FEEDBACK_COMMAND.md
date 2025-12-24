# /feedback 命令实现文档

## 概述

基于官方 Claude Code v2.0.59 源码完善了 `/feedback` 命令,实现了完整的反馈收集和 GitHub issue 生成功能。

## 官方源码参考

- **源文件**: `/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- **关键函数**:
  - `EV9()` - 反馈收集界面
  - `Cy3()` - GitHub issue URL 生成
  - `zy3()` - 提交到 Anthropic API
  - `Ey3()` - 使用 LLM 生成 issue 标题

## 实现功能

### 1. 环境信息收集
```typescript
{
  platform: process.platform,        // 操作系统平台
  nodeVersion: process.version,      // Node.js 版本
  version: config.version,            // Claude Code 版本
  terminal: process.env.TERM,         // 终端类型
  datetime: new Date().toISOString()  // 时间戳
}
```

### 2. GitHub Issue URL 生成

生成预填充的 GitHub issue URL,包含:
- **标题**: `[Feedback] <用户反馈前60字符>`
- **正文**:
  - 反馈描述
  - 环境信息
  - 来源标注
- **标签**: `user-feedback`

### 3. Issue 标题优化

基于官方实现的标题生成逻辑:
```typescript
// 取第一行作为标题
let issueTitle = feedbackMessage.split('\n')[0] || '';

// 截断过长标题(保留到最后一个空格)
if (issueTitle.length > 60) {
  const truncated = issueTitle.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');
  issueTitle = (lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

// 如果标题太短,使用默认标题
if (issueTitle.length < 10) {
  issueTitle = 'Feedback / Bug Report';
}
```

## 使用方式

### 带参数使用
```bash
/feedback The new feature works great!
/feedback Found a bug with file editing
/feedback Feature request: add support for TypeScript 5.3
```

生成包含 GitHub issue URL 的响应,用户可以直接访问提交。

### 无参数使用
```bash
/feedback
```

显示详细的使用说明和功能介绍。

## 官方 API 端点

```typescript
// GitHub Issues
const ISSUES_URL = 'https://github.com/anthropics/claude-code/issues';

// Anthropic Feedback API (需要 API key)
const FEEDBACK_API = 'https://api.anthropic.com/api/claude_cli_feedback';
```

## 生成的 GitHub Issue 示例

**标题:**
```
[Feedback] The new feature works great!
```

**正文:**
```markdown
**Feedback / Bug Description**
The new feature works great!

**Environment Info**
- Platform: linux
- Node: v22.21.1
- Version: 2.0.76
- Terminal: xterm-256color
- Date: 2025-12-24T10:30:00.000Z

**Source**
Submitted via /feedback command in Claude Code CLI

---
*This issue was auto-generated from the /feedback command*
```

## 与官方实现的差异

### 简化处理

1. **Issue 标题生成**:
   - 官方使用 LLM (Anthropic API) 生成技术性标题
   - 本实现使用简化的字符串处理逻辑
   - 原因: 避免额外 API 调用,保持轻量

2. **错误日志收集**:
   - 官方会收集完整的会话记录、错误日志、Git 状态等
   - 本实现仅收集基本环境信息
   - 原因: 简化实现,用户可手动补充详细信息

3. **直接提交**:
   - 官方可直接提交到 Anthropic API 并返回 Feedback ID
   - 本实现生成 GitHub issue URL,需用户手动提交
   - 原因: 避免需要 API 认证

### 保留功能

✓ 环境信息收集
✓ GitHub issue URL 生成
✓ 预填充 issue 模板
✓ 标题智能截断
✓ 用户反馈引导

## 测试验证

测试代码: `/tmp/test_feedback.js`

```bash
node /tmp/test_feedback.js

# 输出:
✓ Feedback command logic test passed!
✓ Generated GitHub Issue URL:
https://github.com/anthropics/claude-code/issues/new?title=...
✓ Issue title: [Feedback] This is a test feedback message
✓ Platform: linux
✓ Node version: v22.21.1
```

## 代码位置

- **实现文件**: `/home/user/claude-code-open/src/commands/development.ts`
- **函数**: `feedbackCommand`
- **行号**: 111-244

## 编译状态

✅ development.ts 独立编译通过
✅ 逻辑测试通过
✅ GitHub URL 生成正常

## 未来改进

1. **集成 Anthropic API**:
   - 直接提交到官方反馈 API
   - 返回 Feedback ID

2. **高级标题生成**:
   - 使用 LLM 生成更专业的 issue 标题
   - 自动识别 bug/feature/question 类型

3. **会话记录**:
   - 收集当前会话的关键消息
   - 包含错误日志和堆栈跟踪

4. **Git 信息**:
   - 收集仓库状态
   - 包含分支、commit 信息

## 参考资料

- 官方源码: `/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Feedback API: https://api.anthropic.com/api/claude_cli_feedback

---

**文档版本**: 1.0
**更新日期**: 2025-12-24
**基于**: Claude Code v2.0.59 官方源码
