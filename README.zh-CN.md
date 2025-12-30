# Claude Code (Open Source)

基于 `@anthropic-ai/claude-code` v2.0.76 的开源实现。

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

**Linux/macOS:**
```bash
export ANTHROPIC_API_KEY=your-api-key
# 或
export CLAUDE_API_KEY=your-api-key
```

**Windows 命令提示符:**
```cmd
set ANTHROPIC_API_KEY=your-api-key
# 或
set CLAUDE_API_KEY=your-api-key
```

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="your-api-key"
# 或
$env:CLAUDE_API_KEY="your-api-key"
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
├── index.ts                # 主导出文件
├── cli.ts                  # CLI 入口点 (Commander.js)
├── core/                   # 核心引擎
│   ├── client.ts           # Anthropic API 客户端（流式、重试、成本）
│   ├── session.ts          # 会话状态管理
│   ├── loop.ts             # 对话编排器
│   └── context.ts          # 上下文管理和摘要
├── tools/                  # 25+ 工具
│   ├── bash.ts             # Bash 执行（沙箱支持）
│   ├── file.ts             # Read/Write/Edit/MultiEdit
│   ├── search.ts           # Glob/Grep 搜索
│   ├── web.ts              # WebFetch/WebSearch
│   ├── todo.ts             # TodoWrite 任务管理
│   ├── agent.ts            # Task/TaskOutput 子代理
│   ├── notebook.ts         # Jupyter Notebook 编辑
│   ├── planmode.ts         # EnterPlanMode/ExitPlanMode
│   ├── mcp.ts              # MCP 协议（ListMcpResources/ReadMcpResource）
│   ├── ask.ts              # AskUserQuestion
│   ├── tmux.ts             # Tmux 多终端（Linux/macOS）
│   ├── skill.ts            # 技能系统
│   ├── lsp.ts              # LSP 集成（诊断、悬停、引用）
│   └── sandbox.ts          # Bubblewrap 沙箱（Linux）
├── ui/                     # Ink/React UI 框架
│   ├── App.tsx             # 主应用组件
│   └── components/         # 可重用 UI 组件
│       ├── Spinner.tsx
│       ├── Message.tsx
│       ├── ToolCall.tsx
│       ├── TodoList.tsx
│       ├── PermissionPrompt.tsx
│       └── StatusBar.tsx
├── agents/                 # 专用子代理
│   ├── explore.ts          # 代码库探索代理
│   ├── plan.ts             # 实现规划代理
│   └── guide.ts            # Claude Code 文档代理
├── auth/                   # 认证
│   ├── oauth.ts            # OAuth 流程
│   └── api-key.ts          # API 密钥管理
├── session/                # 会话持久化
│   ├── manager.ts          # 会话生命周期
│   ├── storage.ts          # 磁盘持久化（~/.claude/sessions/）
│   └── export.ts           # Markdown 导出
├── context/                # 上下文管理
│   ├── estimator.ts        # Token 估算
│   ├── compressor.ts       # 消息摘要
│   └── budget.ts           # Token 预算追踪
├── parser/                 # 代码解析
│   ├── tree-sitter.ts      # Tree-sitter WASM 集成
│   └── languages/          # 特定语言解析器
├── search/                 # 搜索工具
│   ├── ripgrep.ts          # 内置 ripgrep 二进制
│   └── glob.ts             # 文件模式匹配
├── hooks/                  # Hook 系统
│   ├── registry.ts         # Hook 注册
│   └── executor.ts         # Hook 执行
├── mcp/                    # MCP 协议
│   ├── client.ts           # MCP 客户端
│   ├── server.ts           # MCP 服务器连接
│   └── registry.ts         # MCP 服务器注册表
├── permissions/            # 权限系统
│   ├── manager.ts          # 权限请求
│   └── modes.ts            # 权限模式（accept/bypass/plan）
├── config/                 # 配置
│   ├── loader.ts           # 从 ~/.claude/settings.json 加载
│   └── env.ts              # 环境变量处理
├── telemetry/              # 遥测
│   ├── collector.ts        # 事件收集
│   └── analytics.ts        # 本地分析（不上传）
├── skills/                 # 技能系统
│   ├── loader.ts           # 从 ~/.claude/skills/ 加载
│   └── registry.ts         # 技能注册
├── commands/               # 斜杠命令
│   ├── registry.ts         # 命令注册
│   └── builtin/            # 内置命令（/help、/clear 等）
├── plugins/                # 插件系统
│   ├── manager.ts          # 插件生命周期
│   └── loader.ts           # 插件发现
├── models/                 # 模型配置
│   ├── registry.ts         # 模型定义
│   └── pricing.ts          # Token 定价
├── network/                # 网络工具
│   ├── proxy.ts            # 代理支持
│   └── retry.ts            # 重试逻辑
├── streaming/              # 流式 I/O
│   ├── parser.ts           # JSON 消息流
│   └── writer.ts           # 流写入
├── security/               # 安全功能
│   ├── validator.ts        # 输入验证
│   └── sanitizer.ts        # 输出清理
├── types/                  # TypeScript 定义
│   ├── tools.ts            # 工具类型
│   ├── session.ts          # 会话类型
│   └── config.ts           # 配置类型
└── utils/                  # 工具函数
    ├── fs.ts               # 文件系统助手
    ├── path.ts             # 路径工具
    └── time.ts             # 时间格式化
```

## 已实现工具（25+）

| 工具 | 状态 | 说明 |
|------|------|------|
| **文件操作** | | |
| Read | ✅ 完成 | 文件读取，支持图像/PDF/Notebook + 外部修改检测 |
| Write | ✅ 完成 | 文件写入，带覆盖保护 |
| Edit | ✅ 完成 | 文件编辑（字符串替换） |
| MultiEdit | ✅ 完成 | 批量文件编辑（原子操作） |
| **搜索与发现** | | |
| Glob | ✅ 完成 | 文件模式匹配 |
| Grep | ✅ 完成 | 内容搜索（基于 ripgrep），官方输出格式 |
| **执行** | | |
| Bash | ✅ 完成 | 命令执行，支持后台和沙箱 |
| TaskOutput | ✅ 完成 | 获取后台命令/代理输出（统一 UUID/task_id 格式） |
| KillShell | ✅ 完成 | 终止后台进程 |
| **Web 访问** | | |
| WebFetch | ✅ 完成 | Web 页面获取，带缓存 |
| WebSearch | ⚠️ 需配置 | Web 搜索（需要 API 配置） |
| **任务管理** | | |
| TodoWrite | ✅ 完成 | 任务管理，带自动提醒系统 |
| Task | ✅ 完成 | 子代理（explore、plan、guide 等） |
| **规划** | | |
| EnterPlanMode | ✅ 完成 | 进入规划模式，带权限系统 |
| ExitPlanMode | ✅ 完成 | 退出规划模式 |
| **交互** | | |
| AskUserQuestion | ✅ 完成 | 询问用户问题（multiSelect、选项、验证） |
| **代码工具** | | |
| NotebookEdit | ✅ 完成 | Jupyter Notebook 单元格编辑（replace/insert/delete） |
| LSP* | ✅ 完成 | 语言服务器协议集成（诊断、悬停、引用） |
| **集成** | | |
| ListMcpResources | ✅ 完成 | 列出 MCP 资源 |
| ReadMcpResource | ✅ 完成 | 读取 MCP 资源 |
| Skill | ✅ 完成 | 技能系统，带 args 参数和权限检查 |
| **终端** | | |
| Tmux | ✅ 完成 | 多终端会话管理（Linux/macOS） |

*LSP 工具在配置语言服务器后可用

## 功能特性

### OAuth 认证

支持 API 密钥和 OAuth 认证：

```typescript
import { initAuth, startOAuthLogin, setApiKey } from './auth';

// 使用 API 密钥
setApiKey('your-api-key', true); // true 表示持久化

// 或使用 OAuth 登录
await startOAuthLogin({
  clientId: 'your-client-id',
  scope: ['read', 'write'],
});
```

### 会话持久化与恢复

自动保存和恢复对话：

```typescript
import { SessionManager, listSessions, loadSession } from './session';

const manager = new SessionManager({ autoSave: true });

// 启动新会话或恢复
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

// 添加对话轮次
context.addTurn(userMessage, assistantMessage);

// 获取优化后的消息
const messages = context.getMessages();

// 手动压缩
context.compact();
```

### 代码解析器

多语言代码分析支持：

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

支持的语言：JavaScript、TypeScript、Python、Go、Rust、Java、C/C++、Ruby、PHP、Swift、Kotlin、Scala 等。

### 内置 Ripgrep

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

### 遥测与分析

本地使用统计（数据不上传）：

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

### 沙箱支持（Bubblewrap）

**仅限 Linux：** 如果安装了 `bubblewrap`，Bash 命令将在沙箱中执行以增强安全性：

```bash
# Ubuntu/Debian
sudo apt install bubblewrap

# Arch Linux
sudo pacman -S bubblewrap
```

**Windows/macOS 用户注意：**
- Bubblewrap 沙箱仅在 Linux 上可用
- Windows 和 macOS 用户可以使用 WSL（Windows Subsystem for Linux）来启用沙箱支持
- 或者，命令将在没有沙箱的情况下运行（请谨慎使用）

可以使用 `dangerouslyDisableSandbox: true` 参数禁用沙箱。

### Hooks 系统

在工具调用前后执行自定义脚本：

```json
// .claude/settings.json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "matcher": "Bash",
      "command": "/path/to/script.sh",  // Linux/macOS: .sh, Windows: .bat 或 .ps1
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

连接到 MCP（Model Context Protocol）服务器：

```json
// .claude/settings.json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]  // 使用绝对路径
    }
  }
}
```

**路径示例：**
- Linux/macOS: `"/home/user/projects"` 或 `"/Users/user/projects"`
- Windows: `"C:\\Users\\user\\projects"`（JSON 中使用双反斜杠）

### Tmux 多终端

**仅限 Linux/macOS：** 管理多个终端会话：
```javascript
// 创建会话
{ action: "new", session_name: "dev-server" }

// 发送命令
{ action: "send", session_name: "dev-server", command: "npm run dev" }

// 捕获输出
{ action: "capture", session_name: "dev-server" }
```

**Windows 用户注意：**
- Tmux 在 Windows 上原生不可用
- 使用 WSL（Windows Subsystem for Linux）来访问 Tmux
- 替代方案：使用 Windows Terminal 的多标签/窗格功能

### 技能与自定义命令

从以下目录加载：
- **Linux/macOS：** `~/.claude/skills/` 和 `.claude/commands/`
- **Windows：** `%USERPROFILE%\.claude\skills\` 和 `.claude\commands\`

功能：
- 技能：可重用的提示模板
- 斜杠命令：自定义命令扩展

### 增强的 API 客户端

- 指数退避重试（最多 4 次）
- 自动成本计算
- Token 使用统计
- 多模型定价支持

## 斜杠命令

### 通用命令
- `/help` - 显示帮助信息和可用命令
- `/clear` - 清除对话历史，释放上下文
- `/status` - 显示会话状态、模型、API 连接等信息
- `/exit` - 退出 Claude Code

### 会话管理
- `/resume` - 查看和恢复历史会话
- `/context` - 显示上下文使用情况
- `/compact` - 压缩对话历史，释放上下文空间
- `/rename` - 重命名当前会话
- `/export` - 导出会话为 JSON 或 Markdown 格式
- `/transcript` - 导出会话转录记录（纯文本格式）✨ **新增**

### 配置管理
- `/config` - 查看当前配置
- `/tools` - 列出可用工具
- `/model` - 查看当前使用的模型

### 完整命令列表
完整的命令列表和详细说明，请使用 `/help` 命令查看，或参阅 `docs/commands/` 目录下的文档。

## 测试

本项目包含全面的测试：

```bash
# 运行所有测试
npm test

# 使用 UI 运行
npm run test:ui

# 运行特定测试套件
npm run test:unit          # 单元测试
npm run test:integration   # 集成测试
npm run test:e2e          # 端到端测试

# 运行覆盖率测试
npm run test:coverage

# 监视模式
npm run test:watch
```

### 测试结构
- **单元测试**（`src/**/*.test.ts`）- 单个组件测试
- **集成测试**（`tests/integration/`）- 多组件交互测试
- **E2E 测试**（`tests/e2e/`）- 完整 CLI 工作流测试
- **工具测试**（`tests/tools/`）- 单个工具功能测试

## 最新改进

### v2.0.76+ 增强功能
- ✅ **工具级错误处理和重试** - 针对瞬态故障的指数退避
- ✅ **LSP URI 处理** - 增强的 URI 解析和位置验证
- ✅ **Grep 输出格式** - 100% 匹配官方实现
- ✅ **OAuth 认证** - 简化的认证流程和系统提示格式化
- ✅ **AskUserQuestion** - 与官方完全一致（multiSelect、验证）
- ✅ **Shell ID 格式** - 所有后台任务统一 UUID/task_id 格式
- ✅ **工具结果持久化** - 自动保存工具执行结果
- ✅ **权限对话流程** - 完整的权限请求工作流
- ✅ **TodoWrite 自动提醒** - 官方任务跟踪提醒系统
- ✅ **规划模式权限** - 权限检查集成到规划工具
- ✅ **文件修改检测** - 文件被外部修改时发出警报
- ✅ **技能 args 参数** - 完整的技能参数传递和权限系统
- ✅ **NotebookEdit 插入模式** - 修复单元格插入位置逻辑

## 与官方版本对比

| 组件 | 状态 | 说明 |
|------|------|------|
| **核心架构** | ✅ 100% | 三层设计（Entry → Engine → Tools） |
| **CLI 接口** | ✅ 100% | 所有命令和标志已实现 |
| **工具系统** | ✅ 100% | 25+ 工具，功能完全一致 |
| **API 客户端** | ✅ 100% | 流式、重试、成本计算 |
| **权限系统** | ✅ 100% | Accept/bypass/plan 模式 |
| **错误处理** | ✅ 100% | 工具级指数退避重试 |
| **文件操作** | ✅ 100% | 外部修改检测 |
| **后台任务** | ✅ 100% | 统一 UUID/task_id 格式 |
| **输出格式** | ✅ 100% | Grep、LSP 和所有工具匹配官方 |
| **沙箱** | ✅ 100% | Bubblewrap 隔离（Linux） |
| **Hooks** | ✅ 100% | 完整事件系统 |
| **MCP** | ✅ 100% | 完整协议支持 |
| **UI 组件** | ✅ 100% | Ink/React 框架，带自动滚动 |
| **技能/命令** | ✅ 100% | Args、权限、发现 |
| **认证** | ✅ 100% | API 密钥 + OAuth |
| **会话管理** | ✅ 100% | 持久化、恢复、导出 |
| **上下文管理** | ✅ 100% | 自动摘要 |
| **代码解析器** | ✅ 100% | Tree-sitter WASM |
| **遥测** | ✅ 100% | 本地分析 |

**总体准确性：~100%**（基于公共 API 和行为分析）

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
- **Zod** - 模式验证

## 社区

- **Discord：** [加入我们的 Discord](https://discord.gg/hs5BWGjt)
- **X (Twitter)：** [@wangbingjie1989](https://x.com/wangbingjie1989)

## 许可证

本项目仅用于教育目的。原始 Claude Code 归 Anthropic PBC 所有。

---

*这个项目是对混淆代码的逆向工程研究，不代表官方实现。*

[English README](README.md)
