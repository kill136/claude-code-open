# 官方 Claude Code 包差异核查报告

> 对比版本: 官方 `@anthropic-ai/claude-code@2.0.59` vs 本项目 `claude-code-open@2.0.76`
> 生成日期: 2024-12-24

---

## 目录

1. [概述](#概述)
2. [工具系统差异](#工具系统差异)
3. [CLI 命令差异](#cli-命令差异)
4. [核心架构差异](#核心架构差异)
5. [功能模块差异](#功能模块差异)
6. [优先级开发建议](#优先级开发建议)

---

## 概述

### 官方包特点
- **单文件打包**: 使用 esbuild/webpack 打包成单个 `cli.js` (约 10.9MB)
- **混淆压缩**: 代码经过混淆和压缩，变量名无法直接阅读
- **完整功能**: 包含 AWS Bedrock、Google Vertex、OAuth 认证等企业级功能
- **原生依赖**: 使用 Sharp 进行图片处理，Ripgrep 进行搜索

### 本项目现状
- **源码形式**: TypeScript 源码，易于理解和修改
- **基础功能**: 实现了核心工具和基本对话循环
- **缺失功能**: 多个高级功能尚未实现或实现不完整

---

## 工具系统差异

### 工具名称对照表

| 官方工具名 | 本项目工具名 | 状态 | 备注 |
|-----------|-------------|------|------|
| `Read` | `FileReadTool` | ✅ 已实现 | 命名不同，官方叫 Read |
| `Write` | `FileWriteTool` | ✅ 已实现 | 命名不同，官方叫 Write |
| `Edit` | `FileEditTool` | ✅ 已实现 | 命名不同，官方叫 Edit |
| `MultiEdit` | `MultiEditTool` | ✅ 已实现 | - |
| `Bash` | `BashTool` | ✅ 已实现 | - |
| `BashOutput` | `BashOutputTool` | ✅ 已实现 | - |
| `KillShell` | `KillShellTool` | ✅ 已实现 | - |
| `Glob` | `GlobTool` | ✅ 已实现 | - |
| `Grep` | `GrepTool` | ✅ 已实现 | - |
| `WebFetch` | `WebFetchTool` | ✅ 已实现 | - |
| `WebSearch` | `WebSearchTool` | ✅ 已实现 | - |
| `TodoWrite` | `TodoWriteTool` | ✅ 已实现 | - |
| `Task` | `AgentTool` | ⚠️ 部分实现 | 官方叫 Task，且有复杂的 subagent 系统 |
| `NotebookEdit` | `NotebookEditTool` | ✅ 已实现 | - |
| `Skill` | `SkillTool` | ⚠️ 部分实现 | 需要完善 skill 加载机制 |
| `SlashCommand` | `SlashCommandTool` | ⚠️ 部分实现 | - |
| `EnterPlanMode` | `EnterPlanModeTool` | ✅ 已实现 | - |
| `ExitPlanMode` | `ExitPlanModeTool` | ✅ 已实现 | - |
| `AskUserQuestion` | `AskUserQuestionTool` | ⚠️ 部分实现 | 官方有复杂的选项 UI |
| `ListMcpResources` | `ListMcpResourcesTool` | ⚠️ 部分实现 | MCP 集成需完善 |
| `ReadMcpResource` | `ReadMcpResourceTool` | ⚠️ 部分实现 | MCP 集成需完善 |
| `Tmux` | `TmuxTool` | ⚠️ 部分实现 | 需要更多测试 |

### 官方工具参数详情 (sdk-tools.d.ts)

#### 1. Bash 工具参数对比

**官方 BashInput:**
```typescript
interface BashInput {
  command: string;                      // ✅ 本项目已有
  timeout?: number;                     // ✅ 本项目已有
  description?: string;                 // ✅ 本项目已有
  run_in_background?: boolean;          // ✅ 本项目已有
  dangerouslyDisableSandbox?: boolean;  // ✅ 本项目已有
}
```
**状态: 完全匹配**

#### 2. File Edit 工具参数对比

**官方 FileEditInput:**
```typescript
interface FileEditInput {
  file_path: string;          // ✅ 本项目已有
  old_string: string;         // ✅ 本项目已有
  new_string: string;         // ✅ 本项目已有
  replace_all?: boolean;      // ✅ 本项目已有
}
```
**状态: 完全匹配**

#### 3. Grep 工具参数对比

**官方 GrepInput:**
```typescript
interface GrepInput {
  pattern: string;                                                    // ✅ 本项目已有
  path?: string;                                                      // ✅ 本项目已有
  glob?: string;                                                      // ⚠️ 需要验证
  output_mode?: "content" | "files_with_matches" | "count";           // ⚠️ 需要完善
  "-B"?: number;                                                      // ⚠️ 需要验证
  "-A"?: number;                                                      // ⚠️ 需要验证
  "-C"?: number;                                                      // ⚠️ 需要验证
  "-n"?: boolean;                                                     // ⚠️ 需要验证
  "-i"?: boolean;                                                     // ⚠️ 需要验证
  type?: string;                                                      // ⚠️ 需要验证
  head_limit?: number;                                                // ⚠️ 需要添加
  offset?: number;                                                    // ⚠️ 需要添加
  multiline?: boolean;                                                // ⚠️ 需要添加
}
```
**状态: 需要补充 head_limit, offset, multiline 参数**

#### 4. Task (Agent) 工具参数对比

**官方 AgentInput:**
```typescript
interface AgentInput {
  description: string;                  // ✅ 本项目已有
  prompt: string;                       // ✅ 本项目已有
  subagent_type: string;                // ⚠️ 本项目使用不同的实现
  model?: "sonnet" | "opus" | "haiku";  // ⚠️ 需要验证
  resume?: string;                      // ❌ 本项目缺失
}
```
**状态: 缺少 resume 参数，subagent_type 实现可能不完整**

#### 5. AskUserQuestion 工具参数对比

**官方 AskUserQuestionInput:**
```typescript
interface AskUserQuestionInput {
  questions: Array<{
    question: string;          // 问题文本
    header: string;            // 标签 (max 12 chars)
    options: Array<{
      label: string;           // 选项标签 (1-5 words)
      description: string;     // 选项描述
    }>;                        // 2-4 个选项
    multiSelect: boolean;      // 是否多选
  }>;                          // 1-4 个问题
  answers?: Record<string, string>;
}
```
**状态: 本项目的实现可能过于简单，需要支持复杂的多问题、多选项 UI**

#### 6. NotebookEdit 工具参数对比

**官方 NotebookEditInput:**
```typescript
interface NotebookEditInput {
  notebook_path: string;                           // ✅ 本项目已有
  cell_id?: string;                                // ✅ 本项目已有
  new_source: string;                              // ✅ 本项目已有
  cell_type?: "code" | "markdown";                 // ✅ 本项目已有
  edit_mode?: "replace" | "insert" | "delete";     // ✅ 本项目已有
}
```
**状态: 完全匹配**

---

## CLI 命令差异

### 主命令选项对比

| 选项 | 官方 | 本项目 | 状态 |
|------|------|--------|------|
| `-p, --print` | ✅ | ✅ | 已实现 |
| `-d, --debug` | ✅ | ✅ | 已实现 |
| `--verbose` | ✅ | ✅ | 已实现 |
| `--output-format` | ✅ | ✅ | 已实现 |
| `--input-format` | ✅ | ✅ | 已实现 |
| `--json-schema` | ✅ | ✅ | 已实现 |
| `-c, --continue` | ✅ | ✅ | 已实现 |
| `-r, --resume` | ✅ | ✅ | 已实现 |
| `-m, --model` | ✅ | ✅ | 已实现 |
| `--system-prompt` | ✅ | ✅ | 已实现 |
| `--append-system-prompt` | ✅ | ✅ | 已实现 |
| `--permission-mode` | ✅ | ✅ | 已实现 |
| `--allowed-tools` | ✅ | ✅ | 已实现 |
| `--disallowed-tools` | ✅ | ✅ | 已实现 |
| `--mcp-config` | ✅ | ✅ | 已实现 |
| `--dangerously-skip-permissions` | ✅ | ✅ | 已实现 |
| `--max-budget-usd` | ✅ | ✅ | 已实现 |
| `--settings` | ✅ | ✅ | 已实现 |
| `--add-dir` | ✅ | ✅ | 已实现 |
| `--ide` | ✅ | ✅ | 已实现 |
| `--session-id` | ✅ | ✅ | 已实现 |
| `--fork-session` | ✅ | ✅ | 已实现 |
| `--agent` | ✅ | ✅ | 已实现 |
| `--betas` | ✅ | ✅ | 已实现 |
| `--fallback-model` | ✅ | ✅ | 已实现 |
| `--max-tokens` | ✅ | ✅ | 已实现 |
| `--teleport` | ✅ | ❌ | **缺失** |
| `--include-dependencies` | ✅ | ❌ | **缺失** |
| `--solo` | ✅ | ❌ | **缺失** |

### 子命令对比

| 子命令 | 官方 | 本项目 | 状态 |
|--------|------|--------|------|
| `mcp list` | ✅ | ✅ | 已实现 |
| `mcp add` | ✅ | ✅ | 已实现 |
| `mcp remove` | ✅ | ✅ | 已实现 |
| `plugin list` | ✅ | ✅ | 已实现 |
| `plugin install` | ✅ | ⚠️ | 框架存在，功能不完整 |
| `plugin remove` | ✅ | ⚠️ | 框架存在，功能不完整 |
| `tools` | ✅ | ✅ | 已实现 |
| `sessions` | ✅ | ✅ | 已实现 |
| `doctor` | ✅ | ✅ | 已实现 |
| `update` | ✅ | ✅ | 已实现 |
| `install` | ✅ | ✅ | 已实现 |
| `setup-token` | ✅ | ✅ | 已实现 |
| `github-setup` | ✅ | ✅ | 已实现 |
| `review-pr` | ✅ | ✅ | 已实现 |
| `provider` | ✅ | ✅ | 已实现 |
| `checkpoint` | ✅ | ✅ | 已实现 |
| `api` | ✅ | ❌ | **缺失** - API 服务器模式 |
| `config` | ✅ | ❌ | **缺失** - 配置管理子命令 |
| `login` | ✅ | ❌ | **缺失** - OAuth 登录 |
| `logout` | ✅ | ❌ | **缺失** - OAuth 登出 |

---

## 核心架构差异

### 1. API 提供商支持

| 功能 | 官方 | 本项目 | 优先级 |
|------|------|--------|--------|
| Anthropic API | ✅ | ✅ | - |
| AWS Bedrock | ✅ | ❌ | 高 |
| Google Vertex AI | ✅ | ❌ | 高 |
| Azure OpenAI | ✅ | ❌ | 中 |
| OAuth 认证 | ✅ | ❌ | 中 |
| API Key 认证 | ✅ | ✅ | - |

### 2. 会话管理

| 功能 | 官方 | 本项目 | 优先级 |
|------|------|--------|--------|
| 会话持久化 | ✅ | ✅ | - |
| 会话恢复 | ✅ | ✅ | - |
| 会话 Fork | ✅ | ⚠️ | 中 |
| 会话压缩/摘要 | ✅ | ⚠️ | 高 |
| 多会话管理 | ✅ | ✅ | - |

### 3. 工具系统

| 功能 | 官方 | 本项目 | 优先级 |
|------|------|--------|--------|
| 工具注册表 | ✅ | ✅ | - |
| 工具过滤 | ✅ | ✅ | - |
| 权限控制 | ✅ | ⚠️ | 高 |
| 沙箱执行 | ✅ | ⚠️ | 高 |
| MCP 集成 | ✅ | ⚠️ | 高 |
| 工具使用计量 | ✅ | ⚠️ | 中 |

### 4. UI 系统

| 功能 | 官方 | 本项目 | 优先级 |
|------|------|--------|--------|
| Ink TUI | ✅ | ⚠️ | 高 |
| 文本模式 | ✅ | ✅ | - |
| 进度指示器 | ✅ | ⚠️ | 中 |
| 文件差异显示 | ✅ | ⚠️ | 中 |
| 权限确认 UI | ✅ | ⚠️ | 高 |
| Todo 列表 UI | ✅ | ⚠️ | 中 |

### 5. Subagent 系统

官方支持的 subagent 类型:
- `general-purpose` - 通用代理
- `statusline-setup` - 状态行设置
- `Explore` - 代码探索代理
- `Plan` - 计划代理
- `claude-code-guide` - Claude Code 指南代理

| 功能 | 官方 | 本项目 | 优先级 |
|------|------|--------|--------|
| 多种代理类型 | ✅ | ⚠️ | 高 |
| 代理恢复 | ✅ | ❌ | 高 |
| 代理并行执行 | ✅ | ⚠️ | 中 |
| 代理间通信 | ✅ | ❌ | 中 |

---

## 功能模块差异

### 1. 认证与授权

```
官方实现:
├── OAuth 2.0 流程
├── API Key 管理
├── Token 刷新
├── 多账户支持
└── 组织级权限

本项目实现:
├── API Key 管理 ✅
└── 基本认证 ✅
```

### 2. 遥测与监控

```
官方实现:
├── Statsig 事件追踪
├── OpenTelemetry 集成
├── 使用量计量
├── 错误报告
└── 性能监控

本项目实现:
├── 基本日志 ✅
└── 使用统计 ⚠️
```

### 3. 配置系统

```
官方实现:
├── 多级配置 (user/project/local/flag/policy)
├── 配置校验
├── 环境变量覆盖
├── 配置迁移
└── 敏感数据加密

本项目实现:
├── 用户配置 ✅
├── 项目配置 ✅
└── 环境变量 ✅
```

### 4. Hook 系统

| Hook 类型 | 官方 | 本项目 | 状态 |
|-----------|------|--------|------|
| PreToolUse | ✅ | ✅ | 已实现 |
| PostToolUse | ✅ | ✅ | 已实现 |
| PostToolUseFailure | ✅ | ✅ | 已实现 |
| PrePromptSubmit | ✅ | ✅ | 已实现 |
| PostPromptSubmit | ✅ | ✅ | 已实现 |
| Notification | ✅ | ✅ | 已实现 |
| Stop | ✅ | ✅ | 已实现 |
| SessionStart | ✅ | ✅ | 已实现 |
| SessionEnd | ✅ | ✅ | 已实现 |
| SubagentStart | ✅ | ✅ | 已实现 |
| SubagentStop | ✅ | ✅ | 已实现 |
| PreCompact | ✅ | ✅ | 已实现 |
| PermissionRequest | ✅ | ✅ | 已实现 |

**Hook 系统状态: 框架完整，需要更多测试**

### 5. 斜杠命令系统

已实现的斜杠命令:
- `/help` - 帮助信息 ✅
- `/clear` - 清除对话 ✅
- `/exit` - 退出 ✅
- `/status` - 会话状态 ✅
- `/save` - 保存会话 ✅
- `/stats` - 统计信息 ✅
- `/tools` - 工具列表 ✅
- `/model` - 模型切换 ✅
- `/compact` - 压缩历史 ⚠️
- `/resume` - 恢复会话 ✅
- `/context` - 上下文使用 ⚠️
- `/config` - 配置 ⚠️
- `/permissions` - 权限 ⚠️
- `/memory` - 记忆 ⚠️
- `/add-dir` - 添加目录 ✅
- `/init` - 创建 CLAUDE.md ⚠️
- `/files` - 文件列表 ⚠️
- `/mcp` - MCP 管理 ⚠️
- `/agents` - 代理管理 ⚠️
- `/hooks` - Hook 管理 ⚠️
- `/ide` - IDE 集成 ⚠️
- `/vim` - Vim 模式 ⚠️
- `/login` - 登录 ❌
- `/logout` - 登出 ❌
- `/review` - 代码审查 ⚠️
- `/plan` - 计划模式 ⚠️
- `/feedback` - 反馈 ⚠️
- `/doctor` - 诊断 ✅
- `/bug` - 报告 Bug ⚠️

---

## 优先级开发建议

### P0 - 关键功能 (必须实现)

1. **完善 Ink TUI 界面**
   - 实现完整的权限确认 UI
   - 实现进度指示和状态显示
   - 实现文件差异预览

2. **完善权限系统**
   - 实现 `--dangerously-skip-permissions` 的完整逻辑
   - 实现权限白名单/黑名单
   - 实现细粒度的工具权限控制

3. **完善 Subagent 系统**
   - 实现 `resume` 参数支持
   - 实现多种代理类型
   - 实现代理恢复机制

4. **完善会话压缩**
   - 实现自动上下文压缩
   - 实现 `/compact` 命令

### P1 - 重要功能 (应该实现)

1. **AWS Bedrock 支持**
   - 实现 Bedrock API 调用
   - 实现区域选择
   - 实现 IAM 认证

2. **Google Vertex AI 支持**
   - 实现 Vertex API 调用
   - 实现项目/区域配置
   - 实现 GCP 认证

3. **完善 MCP 集成**
   - 实现 MCP 服务器连接
   - 实现资源读取
   - 实现工具调用

4. **完善 Grep 工具**
   - 添加 `head_limit` 参数
   - 添加 `offset` 参数
   - 添加 `multiline` 参数

### P2 - 增强功能 (可以实现)

1. **OAuth 认证**
   - 实现 OAuth 流程
   - 实现 Token 管理

2. **遥测系统**
   - 实现使用量追踪
   - 实现错误报告

3. **更多斜杠命令**
   - 实现 `/vim` 模式
   - 实现 `/ide` 集成
   - 实现 `/memory` 管理

4. **配置增强**
   - 实现配置迁移
   - 实现敏感数据加密

### P3 - 可选功能 (有时间再做)

1. **`--teleport` 选项**
2. **`--include-dependencies` 选项**
3. **`--solo` 选项**
4. **API 服务器模式**

---

## 代码结构对比

### 官方包结构 (推测)
```
cli.js (单文件打包)
├── 核心引擎
│   ├── 对话循环
│   ├── API 客户端 (多提供商)
│   ├── 会话管理
│   └── 上下文管理
├── 工具系统
│   ├── 工具注册表
│   ├── 权限管理
│   └── 沙箱执行
├── UI 系统
│   ├── Ink 组件
│   └── 权限 UI
├── 配置系统
│   ├── 多级配置
│   └── 配置校验
├── 认证系统
│   ├── OAuth
│   └── API Key
└── 遥测系统
```

### 本项目结构
```
src/
├── cli.ts                 # 入口
├── core/
│   ├── client.ts         # API 客户端
│   ├── loop.ts           # 对话循环
│   └── session.ts        # 会话管理
├── tools/                 # 工具系统
├── commands/              # 斜杠命令
├── hooks/                 # Hook 系统
├── config/                # 配置管理
├── session/               # 会话持久化
├── ui/                    # UI 组件
├── providers/             # API 提供商
├── permissions/           # 权限管理
├── context/               # 上下文管理
├── memory/                # 记忆管理
├── plugins/               # 插件系统
├── mcp/                   # MCP 集成
├── search/                # 搜索 (ripgrep)
├── parser/                # 代码解析
└── ...
```

---

## 技术债务

1. **工具命名不一致**
   - 应该将 `FileReadTool` 重命名为 `ReadTool`
   - 应该将 `FileWriteTool` 重命名为 `WriteTool`
   - 应该将 `FileEditTool` 重命名为 `EditTool`
   - 应该将 `AgentTool` 重命名为 `TaskTool`

2. **类型定义不完整**
   - 需要完善所有工具的输入/输出类型

3. **测试覆盖不足**
   - 需要添加单元测试
   - 需要添加集成测试

4. **文档不完整**
   - 需要添加 API 文档
   - 需要添加开发者指南

---

## 总结

本项目已经实现了 Claude Code 的核心功能框架，但与官方版本相比还有以下主要差距:

1. **功能完整性**: 约 70% 完成
2. **代码质量**: 需要更多测试和优化
3. **用户体验**: TUI 界面需要完善
4. **企业功能**: 缺少 Bedrock/Vertex 支持

建议按照 P0 → P1 → P2 → P3 的优先级逐步完善功能。

---

*本报告由自动化分析生成，可能存在遗漏，请结合实际测试验证。*
