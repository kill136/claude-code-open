# /release-notes 命令实现文档

基于官方 Claude Code v2.0.59 源码完善的 `/release-notes` 命令。

## 实现概述

此命令基于官方源码中的以下函数实现：
- `eW0()` - 异步获取 CHANGELOG.md
- `SQA()` - 从缓存获取 changelog
- `wI1()` - 解析 changelog 文本
- `AX0()` - 获取所有版本说明
- `vK9()` - 格式化输出

## 核心功能

### 1. Changelog 获取 (`fetchChangelog`)

从 GitHub 官方仓库异步获取 CHANGELOG.md：

```typescript
const CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md';
```

**特性：**
- 使用 fetch API 获取最新 changelog
- 遵守 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 环境变量
- 静默失败，不干扰用户体验
- 正确的 User-Agent 头

### 2. Changelog 解析 (`parseChangelog`)

解析 CHANGELOG.md 格式：

**支持格式：**
```markdown
## 2.0.76 - 2024-01-15

- Feature 1
- Feature 2
- Bug fix

## 2.0.75 - 2024-01-10

- Feature 3
- Improvement
```

**解析逻辑：**
1. 按 `## ` 分割版本段落
2. 提取版本号（分割 ` - ` 前的部分）
3. 提取更新条目（以 `- ` 开头的行）
4. 版本排序（最新在前）
5. 限制显示最近 5 个版本

### 3. 版本比较 (`compareVersions`)

简单但有效的语义版本比较：

```typescript
compareVersions("2.0.76", "2.0.75") // 返回 1 (2.0.76 > 2.0.75)
compareVersions("2.0.75", "2.0.76") // 返回 -1 (2.0.75 < 2.0.76)
compareVersions("2.0.76", "2.0.76") // 返回 0 (相等)
```

**特性：**
- 支持多段版本号（如 2.0.76.1）
- 正确处理不同长度的版本号
- 缺失段视为 0

### 4. 格式化输出 (`formatReleaseNotes`)

基于官方 `vK9()` 函数的格式：

```
Claude Code Release Notes

Version 2.0.76:
• Feature 1
• Feature 2
• Bug fix

Version 2.0.75:
• Feature 3
• Improvement

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
```

## 错误处理

实现了多层错误处理：

### 1. 网络错误
如果无法获取 changelog，返回空字符串，使用备用显示

### 2. 解析错误
如果解析失败，返回空数组，显示基本版本信息

### 3. 备用信息
```
Claude Code Release Notes

Version: 2.0.76

Recent updates and features have been added.

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
```

## 使用示例

### 命令别名
```bash
/release-notes
/changelog
/whats-new
```

### 预期输出

**成功获取时：**
```
Claude Code Release Notes

Version 2.0.76:
• Improved UI matching official Claude Code style
• Added all slash commands
• Better error handling
• Performance improvements

Version 2.0.75:
• Enhanced MCP support
• New agent capabilities
• Bug fixes

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
```

**网络失败时：**
```
Claude Code - Version 2.0.76

Unable to fetch latest release notes at this time.

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
```

## 技术细节

### 异步实现
命令的 `execute` 函数是异步的：
```typescript
execute: async (ctx: CommandContext): Promise<CommandResult>
```

这符合 `SlashCommand` 接口定义：
```typescript
execute: (ctx: CommandContext) => Promise<CommandResult> | CommandResult;
```

### 环境变量支持
遵守官方的环境变量：
```typescript
if (process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
  return '';
}
```

### TypeScript 类型安全
- 完整的类型注解
- 严格的 null 检查
- 正确的 Promise 类型

## 与官方实现的对比

| 功能 | 官方实现 | 本实现 | 状态 |
|------|---------|--------|------|
| 获取 changelog | ✅ | ✅ | 完全兼容 |
| 解析版本 | ✅ | ✅ | 完全兼容 |
| 格式化输出 | ✅ | ✅ | 完全兼容 |
| 版本排序 | ✅ | ✅ | 完全兼容 |
| 错误处理 | ✅ | ✅ | 完全兼容 |
| 缓存机制 | ✅ | ❌ | 未实现* |

*注：缓存机制需要持久化存储支持，在当前架构中可作为未来优化项。

## 代码位置

文件：`/home/user/claude-code-open/src/commands/development.ts`

相关函数：
- `releaseNotesCommand` (第 342-385 行)
- `fetchChangelog` (第 387-418 行)
- `parseChangelog` (第 420-465 行)
- `compareVersions` (第 467-483 行)
- `formatReleaseNotes` (第 485-502 行)

## 测试建议

1. **正常流程测试**
   ```bash
   /release-notes
   ```

2. **网络错误测试**
   ```bash
   export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
   /release-notes
   ```

3. **别名测试**
   ```bash
   /changelog
   /whats-new
   ```

## 未来改进

1. **缓存机制**
   - 实现本地缓存以减少网络请求
   - 缓存过期策略（如 24 小时）

2. **版本过滤**
   - 支持 `/release-notes --since 2.0.70`
   - 支持 `/release-notes --latest` 只显示最新版本

3. **格式选项**
   - JSON 输出格式
   - Markdown 输出格式
   - 简洁模式

## 参考

- 官方源码：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 官方 CHANGELOG：https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
- 相关行号：2783-2791, 3283-3287 (官方 cli.js)
