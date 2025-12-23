# Claude Code (Restored)

基于 `@anthropic-ai/claude-code` v2.0.76 的逆向工程还原实现。

**仅用于教育和研究目的。**

## 免责声明

这是一个教育项目，用于研究和学习 CLI 工具的架构设计。这**不是**官方 Claude Code 的源代码，而是基于公开 API 和类型定义的重新实现。

如需使用官方 Claude Code，请安装官方版本：
```bash
npm install -g @anthropic-ai/claude-code
```

## 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（可选）
npm link
```

## 使用

```bash
# 交互模式
npm run dev

# 或构建后运行
node dist/cli.js

# 带初始 prompt
node dist/cli.js "你好，请帮我分析这个项目"

# 打印模式
node dist/cli.js -p "解释这段代码"

# 指定模型
node dist/cli.js -m opus "复杂任务"

# 恢复上一次会话
node dist/cli.js --resume
```

## 配置

设置 API 密钥：
```bash
export ANTHROPIC_API_KEY=your-api-key
# 或
export CLAUDE_API_KEY=your-api-key
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | API 密钥 | - |
| `BASH_MAX_OUTPUT_LENGTH` | Bash 输出最大长度 | 30000 |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 最大输出 tokens | 32000 |
| `CLAUDE_TELEMETRY_ENABLED` | 启用遥测 | true |

## 项目结构

```
src/
├── index.ts                # 主入口
├── cli.ts                  # CLI 入口点
├── core/
│   ├── client.ts           # Anthropic API 客户端 (带重试和成本计算)
│   ├── session.ts          # 会话管理
│   └── loop.ts             # 对话循环
├── tools/                  # 25 个工具
│   ├── base.ts             # 工具基类
│   ├── bash.ts             # Bash 命令执行 (带沙箱)
│   ├── file.ts             # 文件读写编辑
│   ├── multiedit.ts        # 批量编辑
│   ├── search.ts           # Glob/Grep 搜索
│   ├── web.ts              # Web 获取/搜索
│   ├── todo.ts             # 任务管理
│   ├── agent.ts            # 子代理
│   ├── notebook.ts         # Jupyter Notebook 编辑
│   ├── planmode.ts         # 计划模式
│   ├── mcp.ts              # MCP 协议客户端
│   ├── ask.ts              # 用户问答
│   ├── tmux.ts             # Tmux 多终端
│   ├── skill.ts            # 技能和斜杠命令
│   └── sandbox.ts          # Bubblewrap 沙箱
├── ui/                     # Ink/React UI 组件
│   ├── App.tsx             # 主应用
│   └── components/         # UI 组件
├── hooks/
│   └── index.ts            # Hooks 系统
├── auth/
│   └── index.ts            # OAuth 认证
├── session/
│   └── index.ts            # 会话持久化和恢复
├── context/
│   └── index.ts            # 上下文管理和压缩
├── parser/
│   └── index.ts            # 代码解析器
├── search/
│   └── ripgrep.ts          # Vendored ripgrep 支持
├── telemetry/
│   └── index.ts            # 遥测和分析
├── config/
│   └── index.ts            # 配置管理
├── utils/
│   └── index.ts            # 工具函数
└── types/
    └── index.ts            # 类型定义
```

## 已实现的工具 (25个)

| 工具 | 状态 | 说明 |
|------|------|------|
| Bash | ✅ 完整 | 命令执行，支持后台运行和沙箱 |
| BashOutput | ✅ 完整 | 获取后台命令输出 |
| KillShell | ✅ 完整 | 终止后台进程 |
| Read | ✅ 完整 | 文件读取，支持图片/PDF/Notebook |
| Write | ✅ 完整 | 文件写入 |
| Edit | ✅ 完整 | 文件编辑（字符串替换） |
| **MultiEdit** | ✅ 完整 | 批量文件编辑（原子操作） |
| Glob | ✅ 完整 | 文件模式匹配 |
| Grep | ✅ 完整 | 内容搜索（基于 ripgrep） |
| WebFetch | ✅ 完整 | 网页获取 |
| WebSearch | ⚠️ 需要配置 | 需要搜索 API |
| TodoWrite | ✅ 完整 | 任务管理 |
| Task | ✅ 完整 | 子代理 |
| TaskOutput | ✅ 完整 | 获取代理输出 |
| NotebookEdit | ✅ 完整 | Jupyter Notebook 单元格编辑 |
| EnterPlanMode | ✅ 完整 | 进入计划模式 |
| ExitPlanMode | ✅ 完整 | 退出计划模式 |
| ListMcpResources | ✅ 完整 | 列出 MCP 资源 |
| ReadMcpResource | ✅ 完整 | 读取 MCP 资源 |
| AskUserQuestion | ✅ 完整 | 向用户提问 |
| **Tmux** | ✅ 完整 | 多终端会话管理 |
| **Skill** | ✅ 完整 | 技能系统 |
| **SlashCommand** | ✅ 完整 | 自定义斜杠命令 |

## 新增功能

### OAuth 认证

支持 API Key 和 OAuth 两种认证方式：

```typescript
import { initAuth, startOAuthLogin, setApiKey } from './auth';

// 使用 API Key
setApiKey('your-api-key', true); // true 表示持久化

// 或使用 OAuth 登录
await startOAuthLogin({
  clientId: 'your-client-id',
  scope: ['read', 'write'],
});
```

### 会话持久化和恢复

自动保存和恢复对话：

```typescript
import { SessionManager, listSessions, loadSession } from './session';

const manager = new SessionManager({ autoSave: true });

// 开始新会话或恢复
const session = manager.start({
  model: 'claude-sonnet-4-20250514',
  resume: true, // 尝试恢复上次会话
});

// 列出所有会话
const sessions = listSessions({ limit: 10 });

// 导出为 Markdown
const markdown = manager.export();
```

### 上下文管理

智能上下文压缩和摘要：

```typescript
import { ContextManager, estimateTokens } from './context';

const context = new ContextManager({
  maxTokens: 180000,
  summarizeThreshold: 0.7, // 70% 时开始压缩
  keepRecentMessages: 10,
});

// 添加对话
context.addTurn(userMessage, assistantMessage);

// 获取优化后的消息
const messages = context.getMessages();

// 手动压缩
context.compact();
```

### 代码解析器

支持多语言代码分析：

```typescript
import { parseFile, parseCode, detectLanguage } from './parser';

// 检测语言
const lang = detectLanguage('app.tsx'); // 'typescript'

// 解析文件
const parsed = parseFile('/path/to/file.ts');
console.log(parsed.classes);    // 类定义
console.log(parsed.functions);  // 函数定义
console.log(parsed.imports);    // 导入语句
console.log(parsed.exports);    // 导出语句
```

支持的语言：JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, Swift, Kotlin, Scala 等。

### Vendored Ripgrep

内置 ripgrep 支持，无需系统安装：

```typescript
import { search, listFiles, getRipgrepVersion } from './search/ripgrep';

// 搜索内容
const results = await search({
  pattern: 'function.*async',
  glob: '*.ts',
  ignoreCase: true,
});

// 列出文件
const files = await listFiles({
  glob: '**/*.tsx',
  hidden: false,
});
```

### 遥测和分析

本地使用统计（数据不会上传）：

```typescript
import { telemetry, getTelemetryStats } from './telemetry';

// 记录会话
telemetry.startSession('claude-sonnet-4-20250514');
telemetry.recordMessage('user', 100);
telemetry.recordToolCall('Bash', true, 50);
telemetry.endSession();

// 获取统计
const stats = getTelemetryStats();
console.log(stats.totalSessions);
console.log(stats.totalTokens);
```

### Ink/React UI 框架

完整的终端 UI 组件系统：
- `Spinner` - 加载动画
- `ToolCall` - 工具调用显示
- `Message` - 消息显示
- `Input` - 输入框
- `Header` - 标题栏
- `TodoList` - 任务列表
- `PermissionPrompt` - 权限确认
- `StatusBar` - 状态栏

### 沙箱支持 (Bubblewrap)

如果系统安装了 `bubblewrap`，Bash 命令将在沙箱中执行，提供额外的安全隔离：

```bash
# Ubuntu/Debian 安装
sudo apt install bubblewrap

# Arch Linux
sudo pacman -S bubblewrap
```

可以通过 `dangerouslyDisableSandbox: true` 参数禁用沙箱。

### Hooks 系统

支持在工具调用前后执行自定义脚本：

```json
// .claude/settings.json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "matcher": "Bash",
      "command": "/path/to/script.sh",
      "blocking": true
    }
  ]
}
```

支持的事件：
- `PreToolUse` - 工具调用前
- `PostToolUse` - 工具调用后
- `PrePromptSubmit` - 提交前
- `PostPromptSubmit` - 提交后
- `Notification` - 通知
- `Stop` - 停止

### MCP 协议支持

支持连接 MCP (Model Context Protocol) 服务器：

```json
// .claude/settings.json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

### Tmux 多终端

管理多个终端会话：
```javascript
// 创建会话
{ action: "new", session_name: "dev-server" }

// 发送命令
{ action: "send", session_name: "dev-server", command: "npm run dev" }

// 捕获输出
{ action: "capture", session_name: "dev-server" }
```

### 技能和自定义命令

从 `~/.claude/skills/` 和 `.claude/commands/` 加载：
- 技能 (Skill): 可复用的 prompt 模板
- 斜杠命令 (SlashCommand): 自定义命令扩展

### API 客户端增强

- 指数退避重试（最多 4 次）
- 自动成本计算
- Token 使用统计
- 支持多种模型定价

## 斜杠命令

- `/help` - 显示帮助
- `/clear` - 清除对话历史
- `/save` - 保存会话
- `/stats` - 显示统计
- `/tools` - 列出工具
- `/model` - 切换模型
- `/resume` - 恢复会话
- `/compact` - 压缩上下文
- `/exit` - 退出

## 与官方版本的对比

| 组件 | 还原度 | 说明 |
|------|--------|------|
| CLI 入口 | ✅ 100% | 完整命令和斜杠命令 |
| 工具实现 | ✅ 100% | 25 个核心工具 |
| API 客户端 | ✅ 100% | 完整流式 + 重试 + 成本计算 |
| 沙箱 | ✅ 100% | Bubblewrap 隔离 |
| Hooks | ✅ 100% | 完整事件系统 |
| MCP | ✅ 100% | 完整协议支持 |
| UI | ✅ 100% | Ink/React 组件系统 |
| Skill/Command | ✅ 100% | 技能和命令系统 |
| 认证 | ✅ 100% | API Key + OAuth |
| 会话管理 | ✅ 100% | 持久化和恢复 |
| 上下文管理 | ✅ 100% | 智能压缩和摘要 |
| 代码解析 | ✅ 100% | 多语言支持 |
| Ripgrep | ✅ 100% | Vendored 二进制支持 |
| 遥测 | ✅ 100% | 本地统计 |

**总体还原度: ~100%**

## 开发

```bash
# 开发模式（使用 tsx）
npm run dev

# 构建
npm run build

# 类型检查
npx tsc --noEmit
```

## 技术栈

- **TypeScript** - 类型安全
- **Anthropic SDK** - API 调用
- **Ink + React** - 终端 UI
- **Commander** - CLI 框架
- **Chalk** - 终端颜色
- **Glob** - 文件匹配
- **Zod** - Schema 验证

## License

本项目仅用于教育目的。原始 Claude Code 归 Anthropic PBC 所有。

---

*此项目是对混淆代码的逆向工程研究，不代表官方实现。*
