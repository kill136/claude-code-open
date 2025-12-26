# Claude Code Open - 功能完善路线图

> 本文档详细列出了与官方 Claude Code v2.0.76 的功能差距及完善任务
>
> **目标**: 实现 100% 功能对等
>
> **协作方式**: 每个任务标注难度、优先级、预估工作量，方便团队分工

---

## 目录

1. [项目现状总览](#1-项目现状总览)
2. [工具系统 (Tools)](#2-工具系统-tools)
3. [斜杠命令 (Slash Commands)](#3-斜杠命令-slash-commands)
4. [Hooks 事件系统](#4-hooks-事件系统)
5. [权限系统 (Permissions)](#5-权限系统-permissions)
6. [MCP 协议](#6-mcp-协议)
7. [UI 组件](#7-ui-组件)
8. [配置系统](#8-配置系统)
9. [认证系统](#9-认证系统)
10. [会话管理](#10-会话管理)
11. [沙箱安全](#11-沙箱安全)
12. [平台兼容性](#12-平台兼容性)
13. [性能优化](#13-性能优化)
14. [测试覆盖](#14-测试覆盖)

---

## 1. 项目现状总览

### 已实现模块统计

| 模块 | 官方数量 | 本项目数量 | 完成度 |
|------|----------|------------|--------|
| 工具 (Tools) | 18 | 26 | ✅ 100%+ |
| 斜杠命令 | ~25 | 40+ | ✅ 100%+ |
| Hooks 事件 | 12 | 18 | ✅ 100%+ |
| 权限模式 | 6 | 6 | ✅ 100% |
| MCP 传输 | 3 | 3 | ✅ 100% |
| UI 组件 | ~15 | 16 | ⚠️ 90% |

### 主要差距领域

| 领域 | 差距程度 | 说明 |
|------|----------|------|
| 功能深度 | ⚠️ 中等 | 骨架完整，细节实现需验证 |
| 错误处理 | ⚠️ 中等 | 边缘情况处理不足 |
| 平台兼容 | ⚠️ 中等 | Windows 支持需加强 |
| 测试覆盖 | ❌ 较大 | 缺少系统性测试 |
| 文档完善 | ❌ 较大 | 需要补充使用文档 |

---

## 2. 工具系统 (Tools)

### 2.1 官方工具清单 (18个)

| 工具名 | 本项目文件 | 状态 | 需完善项 |
|--------|-----------|------|----------|
| Agent/Task | `src/tools/agent.ts` | ✅ 已实现 | 验证子代理类型完整性 |
| Bash | `src/tools/bash.ts` | ✅ 已实现 | 沙箱集成、超时处理 |
| TaskOutput | `src/tools/agent.ts` | ✅ 已实现 | - |
| ExitPlanMode | `src/tools/planmode.ts` | ✅ 已实现 | - |
| FileEdit (Edit) | `src/tools/file.ts` | ✅ 已实现 | 验证所有编辑模式 |
| FileRead (Read) | `src/tools/file.ts` | ✅ 已实现 | 图片/PDF 支持 |
| FileWrite (Write) | `src/tools/file.ts` | ✅ 已实现 | - |
| Glob | `src/tools/search.ts` | ✅ 已实现 | - |
| Grep | `src/tools/search.ts` | ✅ 已实现 | 验证所有参数 |
| KillShell | `src/tools/bash.ts` | ✅ 已实现 | - |
| ListMcpResources | `src/tools/mcp.ts` | ✅ 已实现 | - |
| Mcp | `src/tools/mcp.ts` | ✅ 已实现 | 动态工具调用 |
| NotebookEdit | `src/tools/notebook.ts` | ✅ 已实现 | - |
| ReadMcpResource | `src/tools/mcp.ts` | ✅ 已实现 | - |
| TodoWrite | `src/tools/todo.ts` | ✅ 已实现 | - |
| WebFetch | `src/tools/web.ts` | ✅ 已实现 | 重定向处理 |
| WebSearch | `src/tools/web.ts` | ✅ 已实现 | - |
| AskUserQuestion | `src/tools/ask.ts` | ✅ 已实现 | 多选支持 |

### 2.2 工具完善任务

#### T-001: Bash 工具沙箱集成
- **文件**: `src/tools/bash.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P0 高
- **描述**:
  - 集成 Bubblewrap (Linux) / Seatbelt (macOS) 沙箱
  - 实现 `dangerouslyDisableSandbox` 参数
  - 网络隔离配置
- **验收标准**:
  - [ ] Linux 下使用 bwrap 隔离
  - [ ] macOS 下使用 sandbox-exec
  - [ ] Windows 提示不支持沙箱
  - [ ] 危险命令拦截

#### T-002: Bash 后台执行增强
- **文件**: `src/tools/bash.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**:
  - 最大 10 个并发后台 shell
  - 1 小时最大运行时间
  - 10MB 输出限制
- **验收标准**:
  - [ ] 并发数限制生效
  - [ ] 超时自动终止
  - [ ] 输出截断处理

#### T-003: Read 工具媒体文件支持
- **文件**: `src/tools/file.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**:
  - 图片文件读取 (PNG, JPG, GIF, WebP)
  - PDF 文件解析
  - Jupyter Notebook 渲染
- **验收标准**:
  - [ ] 图片转 base64 传给 Claude
  - [ ] PDF 提取文本和图片
  - [ ] ipynb 显示所有 cell

#### T-004: Grep 工具参数完整性
- **文件**: `src/tools/search.ts`
- **难度**: ⭐ 简单
- **优先级**: P2 低
- **描述**: 验证并补全所有 ripgrep 参数映射
- **官方参数**:
  ```typescript
  {
    pattern: string;          // 搜索模式
    path?: string;            // 搜索路径
    glob?: string;            // 文件过滤
    type?: string;            // 文件类型
    output_mode?: "content" | "files_with_matches" | "count";
    "-A"?: number;            // 后置行数
    "-B"?: number;            // 前置行数
    "-C"?: number;            // 上下文行数
    "-i"?: boolean;           // 忽略大小写
    "-n"?: boolean;           // 显示行号
    multiline?: boolean;      // 多行模式
    head_limit?: number;      // 结果限制
    offset?: number;          // 结果偏移
  }
  ```
- **验收标准**:
  - [ ] 所有参数可用
  - [ ] 输出格式正确

#### T-005: Edit 工具策略验证
- **文件**: `src/tools/file.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 验证 Edit 工具的所有编辑模式
- **官方参数**:
  ```typescript
  {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;    // 替换所有匹配
  }
  ```
- **验收标准**:
  - [ ] 唯一性检查正确
  - [ ] replace_all 模式工作
  - [ ] 保留文件权限和换行符

#### T-006: WebFetch 重定向处理
- **文件**: `src/tools/web.ts`
- **难度**: ⭐ 简单
- **优先级**: P2 低
- **描述**: 跨域重定向时返回提示让 Claude 重新请求
- **验收标准**:
  - [ ] 检测跨域重定向
  - [ ] 返回格式化提示

#### T-007: AskUserQuestion 多选支持
- **文件**: `src/tools/ask.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 实现 `multiSelect: true` 参数
- **验收标准**:
  - [ ] 单选模式
  - [ ] 多选模式
  - [ ] 用户可输入 "Other"

---

## 3. 斜杠命令 (Slash Commands)

### 3.1 官方命令清单

| 命令 | 本项目文件 | 状态 | 说明 |
|------|-----------|------|------|
| `/help` | `general.ts` | ✅ 完成 | - |
| `/clear` | `general.ts` | ✅ 完成 | - |
| `/exit` | `general.ts` | ✅ 完成 | - |
| `/status` | `general.ts` | ✅ 完成 | - |
| `/config` | `config.ts` | ✅ 完成 | - |
| `/model` | `config.ts` | ✅ 完成 | - |
| `/cost` | `utility.ts` | ⚠️ 验证 | 验证计算准确性 |
| `/compact` | `session.ts` | ✅ 完成 | - |
| `/memory` | `config.ts` | ✅ 完成 | - |
| `/resume` | `session.ts` | ✅ 完成 | - |
| `/init` | `config.ts` | ✅ 完成 | - |
| `/permissions` | `config.ts` | ✅ 完成 | - |
| `/add-dir` | - | ❌ 缺失 | 添加允许目录 |
| `/terminal` | `config.ts` | ✅ 完成 | terminal-setup |
| `/theme` | `config.ts` | ✅ 完成 | - |
| `/pr` | - | ❌ 缺失 | PR 相关 Skill |
| `/review` | `development.ts` | ✅ 完成 | - |
| `/commit` | - | ⚠️ Skill | 通过 Skill 实现 |
| `/login` | `auth.ts` | ✅ 完成 | - |
| `/logout` | `auth.ts` | ✅ 完成 | - |
| `/feedback` | `development.ts` | ✅ 完成 | - |
| `/mcp` | `tools.ts` | ✅ 完成 | - |
| `/deny` | - | ❌ 缺失 | 拒绝权限 |
| `/doctor` | `general.ts` | ✅ 完成 | - |
| `/bug` | `general.ts` | ✅ 完成 | - |

### 3.2 命令完善任务

#### T-008: /add-dir 命令实现
- **文件**: `src/commands/config.ts`
- **难度**: ⭐ 简单
- **优先级**: P1 中
- **描述**: 添加目录到权限白名单
- **功能**:
  ```
  /add-dir <path>  - 添加目录到允许列表
  /add-dir --list  - 列出当前允许目录
  /add-dir --remove <path> - 移除目录
  ```
- **验收标准**:
  - [ ] 路径验证（必须存在）
  - [ ] 持久化到配置
  - [ ] 立即生效

#### T-009: /deny 命令实现
- **文件**: `src/commands/config.ts`
- **难度**: ⭐ 简单
- **优先级**: P2 低
- **描述**: 快速拒绝当前权限请求
- **验收标准**:
  - [ ] 拒绝当前待处理权限
  - [ ] 可选永久拒绝

#### T-010: /pr 命令实现
- **文件**: `src/commands/development.ts` 或 `src/skills/`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: Pull Request 相关功能
- **功能**:
  ```
  /pr create  - 创建 PR
  /pr review  - 审查 PR
  /pr list    - 列出 PR
  ```
- **验收标准**:
  - [ ] 集成 gh CLI
  - [ ] 支持 GitHub/GitLab

#### T-011: /cost 计算准确性验证
- **文件**: `src/commands/utility.ts`
- **难度**: ⭐ 简单
- **优先级**: P2 低
- **描述**: 验证 token 计算和成本估算
- **官方定价** (2024):
  | 模型 | 输入 ($/1M) | 输出 ($/1M) |
  |------|------------|------------|
  | Opus | $15 | $75 |
  | Sonnet | $3 | $15 |
  | Haiku | $0.25 | $1.25 |
- **验收标准**:
  - [ ] Token 计数准确
  - [ ] 成本计算正确
  - [ ] 累计统计

---

## 4. Hooks 事件系统

### 4.1 官方 Hooks 事件清单

| 事件 | 本项目支持 | 状态 |
|------|-----------|------|
| `PreToolUse` | ✅ | 验证 |
| `PostToolUse` | ✅ | 验证 |
| `PostToolUseFailure` | ⚠️ | 需实现 |
| `PermissionRequest` | ✅ | 验证 |
| `UserPromptSubmit` | ✅ | 验证 |
| `SessionStart` | ✅ | 验证 |
| `SessionEnd` | ✅ | 验证 |
| `Stop` | ⚠️ | 需验证 |
| `SubagentStart` | ⚠️ | 需验证 |
| `SubagentStop` | ⚠️ | 需验证 |
| `Notification` | ⚠️ | 需验证 |
| `PreCompact` | ⚠️ | 需验证 |

### 4.2 Hooks 完善任务

#### T-012: Hooks 事件完整性验证
- **文件**: `src/hooks/index.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 验证所有 12 个官方事件都已实现
- **验收标准**:
  - [ ] 所有事件可触发
  - [ ] 参数格式正确
  - [ ] 返回值处理正确

#### T-013: Hook 类型支持完整性
- **文件**: `src/hooks/`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 支持 4 种 Hook 类型
- **类型**:
  ```yaml
  - type: command    # Shell 命令
    command: "script.sh"
  - type: prompt     # LLM 评估
    prompt: "验证..."
  - type: agent      # 代理验证
    prompt: "检查..."
  - type: url        # HTTP 回调
    url: "https://..."
  ```
- **验收标准**:
  - [ ] command 类型工作
  - [ ] prompt 类型工作
  - [ ] agent 类型工作
  - [ ] url 类型工作 (如果官方支持)

#### T-014: Hook 返回码处理
- **文件**: `src/hooks/`
- **难度**: ⭐ 简单
- **优先级**: P2 低
- **描述**: 正确处理 Hook 返回码
- **官方约定**:
  - `Exit 0`: 成功，继续执行
  - `Exit 2`: 错误，显示 stderr
  - 其他: 仅显示 stderr 给用户
- **验收标准**:
  - [ ] 返回码正确解析
  - [ ] stderr 正确显示

---

## 5. 权限系统 (Permissions)

### 5.1 权限模式清单

| 模式 | 本项目支持 | 说明 |
|------|-----------|------|
| `default` | ✅ | 逐个询问 |
| `acceptEdits` | ✅ | 自动接受编辑 |
| `bypassPermissions` | ✅ | 跳过所有检查 |
| `plan` | ✅ | 计划模式 |
| `delegate` | ⚠️ | 需验证 |
| `dontAsk` | ⚠️ | 需验证 |

### 5.2 权限完善任务

#### T-015: 权限规则解析器
- **文件**: `src/permissions/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P0 高
- **描述**: 实现完整的权限规则解析
- **规则格式**:
  ```json
  {
    "permissions": {
      "allow": [
        "Bash(npm test:*)",
        "Read(src/**)",
        "Edit(src/**/*.ts)"
      ],
      "deny": [
        "Bash(rm -rf:*)",
        "Write(.env)"
      ],
      "ask": [
        "Bash(git push:*)"
      ]
    }
  }
  ```
- **验收标准**:
  - [ ] Glob 模式匹配
  - [ ] 工具+参数匹配
  - [ ] 优先级正确 (deny > ask > allow)

#### T-016: 权限持久化
- **文件**: `src/permissions/`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 权限决策持久化
- **存储位置**:
  - 会话级: 内存
  - 永久级: `~/.claude/permissions.json`
- **验收标准**:
  - [ ] "Always allow" 持久化
  - [ ] "Always deny" 持久化
  - [ ] 会话重启后生效

#### T-017: 权限审计日志
- **文件**: `src/permissions/audit.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P2 低
- **描述**: 记录所有权限决策
- **验收标准**:
  - [ ] 记录请求时间
  - [ ] 记录工具和参数
  - [ ] 记录用户决策
  - [ ] 可导出日志

---

## 6. MCP 协议

### 6.1 MCP 功能清单

| 功能 | 本项目支持 | 状态 |
|------|-----------|------|
| Stdio 传输 | ✅ | 验证 |
| SSE 传输 | ✅ | 验证 |
| HTTP 传输 | ✅ | 验证 |
| 工具调用 | ✅ | 验证 |
| 资源访问 | ✅ | 验证 |
| 提示词管理 | ⚠️ | 需验证 |
| 采样功能 | ⚠️ | 需验证 |
| 取消操作 | ⚠️ | 需验证 |
| 进度通知 | ⚠️ | 需验证 |

### 6.2 MCP 完善任务

#### T-018: MCP 服务器自动发现
- **文件**: `src/mcp/`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 自动发现和连接 MCP 服务器
- **发现位置**:
  - `~/.claude/mcp.json`
  - `./.claude/mcp.json`
  - `./mcp.json`
- **验收标准**:
  - [ ] 多配置文件合并
  - [ ] 优先级正确

#### T-019: MCP 采样功能
- **文件**: `src/mcp/sampling.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: 实现 MCP 采样协议
- **验收标准**:
  - [ ] createMessage 接口
  - [ ] 模型偏好设置
  - [ ] 回调系统

#### T-020: MCP 取消和进度
- **文件**: `src/mcp/`
- **难度**: ⭐⭐ 简单
- **优先级**: P2 低
- **描述**: 实现取消操作和进度通知
- **验收标准**:
  - [ ] 取消长时间操作
  - [ ] 进度条显示

---

## 7. UI 组件

### 7.1 UI 组件清单

| 组件 | 文件 | 状态 | 需完善 |
|------|------|------|--------|
| App | `App.tsx` | ✅ | - |
| Header | `Header.tsx` | ✅ | Logo 颜色 |
| Message | `Message.tsx` | ✅ | - |
| Input | `Input.tsx` | ✅ | Vim 模式 |
| ToolCall | `ToolCall.tsx` | ✅ | - |
| TodoList | `TodoList.tsx` | ✅ | - |
| Spinner | `Spinner.tsx` | ✅ | - |
| WelcomeScreen | `WelcomeScreen.tsx` | ⚠️ | 布局调整 |
| ShortcutHelp | `ShortcutHelp.tsx` | ✅ | - |
| DiffView | `DiffView.tsx` | ✅ | - |
| PermissionPrompt | `PermissionPrompt.tsx` | ✅ | - |
| ProgressBar | `ProgressBar.tsx` | ✅ | - |
| StatusBar | `StatusBar.tsx` | ✅ | - |
| ModelSelector | `ModelSelector.tsx` | ✅ | - |
| SelectInput | `SelectInput.tsx` | ✅ | - |
| UpdateNotification | `UpdateNotification.tsx` | ✅ | - |

### 7.2 UI 完善任务

#### T-021: Vim/Emacs 编辑模式
- **文件**: `src/ui/components/Input.tsx`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 完整的 Vim/Emacs 键绑定
- **Vim 模式**:
  - Normal/Insert/Visual 模式
  - 基本移动 (h/j/k/l)
  - 编辑命令 (d/y/p/c)
  - 搜索 (/?)
- **验收标准**:
  - [ ] 模式切换
  - [ ] 基本编辑
  - [ ] 状态显示

#### T-022: 欢迎界面优化
- **文件**: `src/ui/components/WelcomeScreen.tsx`
- **难度**: ⭐ 简单
- **优先级**: P3 低
- **描述**: 与官方 UI 对齐
- **改动**:
  - Logo 改为蓝色
  - 右侧改为 "Tips for getting started"
  - 移除 "What's new"
- **验收标准**:
  - [ ] 视觉一致

#### T-023: 快捷键系统增强
- **文件**: `src/ui/hooks/useGlobalKeybindings.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 完善全局快捷键
- **官方快捷键**:
  | 快捷键 | 功能 |
  |--------|------|
  | Ctrl+O | 切换详细输出 |
  | Ctrl+T | 显示待办事项 |
  | Ctrl+S | 缓存提示词 |
  | Ctrl+M | 切换模型 |
  | Shift+Enter | 多行输入 |
  | Ctrl+C | 中断 |
- **验收标准**:
  - [ ] 所有快捷键可用
  - [ ] 可自定义

---

## 8. 配置系统

### 8.1 配置完善任务

#### T-024: 配置来源优先级
- **文件**: `src/config/index.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P0 高
- **描述**: 实现完整的配置优先级链
- **优先级** (低→高):
  1. 默认值
  2. `~/.claude/policy.json` (组织策略)
  3. `~/.claude/settings.json` (用户设置)
  4. `./.claude/settings.json` (项目设置)
  5. `./.claude/local.json` (本地设置, gitignore)
  6. 环境变量
  7. 命令行参数
- **验收标准**:
  - [ ] 所有来源加载
  - [ ] 优先级正确
  - [ ] 深度合并

#### T-025: 环境变量完整性
- **文件**: `src/config/`
- **难度**: ⭐ 简单
- **优先级**: P1 中
- **描述**: 支持所有官方环境变量
- **环境变量清单**:
  ```bash
  ANTHROPIC_API_KEY / CLAUDE_API_KEY
  CLAUDE_CONFIG_DIR
  CLAUDE_CODE_MAX_OUTPUT_TOKENS  # 默认 32000, 上限 64000
  BASH_MAX_OUTPUT_LENGTH         # 默认 30000, 上限 150000
  CLAUDE_CODE_USE_BEDROCK
  CLAUDE_CODE_USE_VERTEX
  CLAUDE_CODE_ENABLE_TELEMETRY
  CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING
  HTTP_PROXY / HTTPS_PROXY
  ```
- **验收标准**:
  - [ ] 所有变量可用
  - [ ] 验证和默认值

---

## 9. 认证系统

### 9.1 认证完善任务

#### T-026: OAuth 流程完善
- **文件**: `src/auth/index.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 完整的 OAuth 认证流程
- **流程**:
  1. 打开浏览器授权
  2. 本地服务器接收回调
  3. 交换 token
  4. 安全存储 token
  5. 自动刷新
- **验收标准**:
  - [ ] 登录流程完整
  - [ ] Token 安全存储
  - [ ] 自动刷新

#### T-027: Bedrock/Vertex 认证
- **文件**: `src/providers/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: AWS Bedrock 和 Google Vertex 认证
- **验收标准**:
  - [ ] AWS 凭证链
  - [ ] GCP 凭证链
  - [ ] 区域配置

#### T-028: MFA 支持
- **文件**: `src/auth/mfa.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: 多因素认证支持
- **验收标准**:
  - [ ] TOTP 验证
  - [ ] 恢复码

---

## 10. 会话管理

### 10.1 会话完善任务

#### T-029: 会话自动保存
- **文件**: `src/session/index.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 会话自动持久化
- **存储位置**: `~/.claude/sessions/<uuid>.json`
- **验收标准**:
  - [ ] 定期自动保存
  - [ ] 崩溃恢复
  - [ ] 30 天过期清理

#### T-030: 会话压缩 (Compact)
- **文件**: `src/session/`, `src/context/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 智能压缩长会话
- **策略**:
  - 保留最近 N 轮对话
  - 生成前文摘要
  - 触发 PreCompact Hook
- **验收标准**:
  - [ ] 压缩后可继续对话
  - [ ] 上下文不丢失关键信息

#### T-031: Checkpoint/快照系统
- **文件**: `src/checkpoint/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 文件修改检查点
- **功能**:
  - 修改前自动备份
  - 支持回滚
  - `/rewind` 命令集成
- **验收标准**:
  - [ ] 自动创建检查点
  - [ ] 可回滚到任意点
  - [ ] 检查点清理

---

## 11. 沙箱安全

### 11.1 沙箱完善任务

#### T-032: Linux Bubblewrap 集成
- **文件**: `src/sandbox/bubblewrap.ts`
- **难度**: ⭐⭐⭐⭐ 困难
- **优先级**: P0 高
- **描述**: Linux 下使用 bwrap 隔离命令执行
- **隔离项**:
  - 文件系统 (只读挂载)
  - 网络 (可选隔离)
  - 进程 (PID 命名空间)
- **验收标准**:
  - [ ] bwrap 可用检测
  - [ ] 白名单目录可写
  - [ ] 网络策略可配

#### T-033: macOS Seatbelt 集成
- **文件**: `src/sandbox/seatbelt.ts`
- **难度**: ⭐⭐⭐⭐ 困难
- **优先级**: P1 中
- **描述**: macOS 下使用 sandbox-exec
- **验收标准**:
  - [ ] sandbox-exec 可用
  - [ ] 配置文件生成
  - [ ] 权限正确

#### T-034: 网络沙箱
- **文件**: `src/sandbox/network.ts`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 网络访问控制
- **配置**:
  ```json
  {
    "sandbox": {
      "network": {
        "allowedDomains": ["github.com", "npmjs.org"],
        "allowLocalBinding": false,
        "httpProxyPort": 8080
      }
    }
  }
  ```
- **验收标准**:
  - [ ] 域名白名单
  - [ ] 代理支持

---

## 12. 平台兼容性

### 12.1 平台完善任务

#### T-035: Windows 兼容性增强
- **文件**: 多个
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P0 高
- **描述**: 确保 Windows 完全可用
- **检查项**:
  - [ ] 路径分隔符处理
  - [ ] 命令行转义
  - [ ] 终端颜色
  - [ ] 配置文件路径
  - [ ] 进程管理
- **验收标准**:
  - [ ] Windows 10/11 测试通过

#### T-036: Ripgrep 多平台分发
- **文件**: `src/search/ripgrep.ts`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 内置多平台 ripgrep 二进制
- **平台**:
  - `x64-win32`
  - `x64-darwin`
  - `arm64-darwin`
  - `x64-linux`
  - `arm64-linux`
- **验收标准**:
  - [ ] 自动选择正确版本
  - [ ] 回退到系统 rg

---

## 13. 性能优化

### 13.1 性能完善任务

#### T-037: 启动时间优化
- **难度**: ⭐⭐ 简单
- **优先级**: P2 低
- **描述**: 减少冷启动时间
- **策略**:
  - 延迟加载模块
  - 配置缓存
  - Tree-sitter WASM 预热
- **验收标准**:
  - [ ] 启动 < 1s

#### T-038: 内存使用优化
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: 减少内存占用
- **策略**:
  - 流式处理大文件
  - 及时释放缓存
  - 会话压缩
- **验收标准**:
  - [ ] 长会话内存稳定

#### T-039: 打包优化
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: 单文件打包
- **工具**: esbuild / rollup
- **目标**:
  - 单文件 cli.js
  - 代码压缩
  - Tree-shaking
- **验收标准**:
  - [ ] 包体积 < 5MB
  - [ ] 无运行时依赖问题

---

## 14. 测试覆盖

### 14.1 测试完善任务

#### T-040: 单元测试框架
- **文件**: `tests/unit/`
- **难度**: ⭐⭐ 简单
- **优先级**: P1 中
- **描述**: 建立单元测试基础设施
- **覆盖**:
  - 工具函数
  - 配置解析
  - 权限规则
- **验收标准**:
  - [ ] 覆盖率 > 60%

#### T-041: 集成测试
- **文件**: `tests/integration/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P1 中
- **描述**: 端到端功能测试
- **覆盖**:
  - CLI 命令
  - 工具执行
  - 会话管理
- **验收标准**:
  - [ ] 核心流程测试

#### T-042: E2E 测试
- **文件**: `tests/e2e/`
- **难度**: ⭐⭐⭐ 中等
- **优先级**: P2 低
- **描述**: 真实 API 测试 (需 API Key)
- **验收标准**:
  - [ ] CI 可选运行

---

## 附录

### A. 任务难度说明

| 等级 | 符号 | 预估工时 | 说明 |
|------|------|----------|------|
| 简单 | ⭐ | 2-4h | 修改现有代码 |
| 简单+ | ⭐⭐ | 4-8h | 新增小功能 |
| 中等 | ⭐⭐⭐ | 1-2d | 新增模块 |
| 困难 | ⭐⭐⭐⭐ | 2-5d | 复杂系统 |
| 极难 | ⭐⭐⭐⭐⭐ | 5d+ | 核心架构 |

### B. 优先级说明

| 等级 | 说明 |
|------|------|
| P0 | 阻塞性问题，必须优先处理 |
| P1 | 重要功能，尽快完成 |
| P2 | 一般功能，正常排期 |
| P3 | 锦上添花，有空再做 |

### C. 任务认领方式

1. 在 GitHub Issues 创建对应任务
2. 认领时在 Issue 评论
3. 创建 `feature/T-XXX-描述` 分支
4. PR 关联 Issue

### D. 代码规范

- TypeScript strict 模式
- ESLint + Prettier
- 提交信息格式: `feat(T-XXX): 描述`
- PR 需要至少 1 人 review

---

## 任务总览

| 任务ID | 名称 | 难度 | 优先级 | 状态 |
|--------|------|------|--------|------|
| T-001 | Bash 沙箱集成 | ⭐⭐⭐ | P0 | 待认领 |
| T-002 | Bash 后台增强 | ⭐⭐ | P1 | 待认领 |
| T-003 | Read 媒体支持 | ⭐⭐⭐ | P1 | 待认领 |
| T-004 | Grep 参数完整 | ⭐ | P2 | 待认领 |
| T-005 | Edit 策略验证 | ⭐⭐ | P1 | 待认领 |
| T-006 | WebFetch 重定向 | ⭐ | P2 | 待认领 |
| T-007 | Ask 多选支持 | ⭐⭐ | P1 | 待认领 |
| T-008 | /add-dir 命令 | ⭐ | P1 | 待认领 |
| T-009 | /deny 命令 | ⭐ | P2 | 待认领 |
| T-010 | /pr 命令 | ⭐⭐ | P1 | 待认领 |
| T-011 | /cost 验证 | ⭐ | P2 | 待认领 |
| T-012 | Hooks 事件验证 | ⭐⭐ | P1 | 待认领 |
| T-013 | Hook 类型支持 | ⭐⭐ | P1 | 待认领 |
| T-014 | Hook 返回码 | ⭐ | P2 | 待认领 |
| T-015 | 权限规则解析 | ⭐⭐⭐ | P0 | 待认领 |
| T-016 | 权限持久化 | ⭐⭐ | P1 | 待认领 |
| T-017 | 权限审计日志 | ⭐⭐ | P2 | 待认领 |
| T-018 | MCP 自动发现 | ⭐⭐ | P1 | 待认领 |
| T-019 | MCP 采样功能 | ⭐⭐⭐ | P2 | 待认领 |
| T-020 | MCP 取消进度 | ⭐⭐ | P2 | 待认领 |
| T-021 | Vim/Emacs 模式 | ⭐⭐⭐ | P1 | 待认领 |
| T-022 | 欢迎界面优化 | ⭐ | P3 | 待认领 |
| T-023 | 快捷键增强 | ⭐⭐ | P1 | 待认领 |
| T-024 | 配置优先级 | ⭐⭐ | P0 | 待认领 |
| T-025 | 环境变量完整 | ⭐ | P1 | 待认领 |
| T-026 | OAuth 流程 | ⭐⭐⭐ | P1 | 待认领 |
| T-027 | Bedrock/Vertex | ⭐⭐⭐ | P2 | 待认领 |
| T-028 | MFA 支持 | ⭐⭐⭐ | P2 | 待认领 |
| T-029 | 会话自动保存 | ⭐⭐ | P1 | 待认领 |
| T-030 | 会话压缩 | ⭐⭐⭐ | P1 | 待认领 |
| T-031 | Checkpoint 系统 | ⭐⭐⭐ | P1 | 待认领 |
| T-032 | Linux Bubblewrap | ⭐⭐⭐⭐ | P0 | 待认领 |
| T-033 | macOS Seatbelt | ⭐⭐⭐⭐ | P1 | 待认领 |
| T-034 | 网络沙箱 | ⭐⭐⭐ | P1 | 待认领 |
| T-035 | Windows 兼容 | ⭐⭐⭐ | P0 | 待认领 |
| T-036 | Ripgrep 多平台 | ⭐⭐ | P1 | 待认领 |
| T-037 | 启动优化 | ⭐⭐ | P2 | 待认领 |
| T-038 | 内存优化 | ⭐⭐⭐ | P2 | 待认领 |
| T-039 | 打包优化 | ⭐⭐⭐ | P2 | 待认领 |
| T-040 | 单元测试 | ⭐⭐ | P1 | 待认领 |
| T-041 | 集成测试 | ⭐⭐⭐ | P1 | 待认领 |
| T-042 | E2E 测试 | ⭐⭐⭐ | P2 | 待认领 |

---

> 文档版本: 1.0.0
>
> 最后更新: 2024-12-26
>
> 维护者: Claude Code Open 团队
