# Claude Code 官方源码同步策略

**创建时间**: 2026-01-02
**官方版本**: 2.0.76
**项目目标**: 与官方功能保持一致

## 问题分析

官方源码 (`node_modules/@anthropic-ai/claude-code/cli.js`) 的特点：
- 约 11MB 的压缩/混淆代码
- 单文件约 5039 行（压缩后）
- 约 15 万行原始代码（估算）
- 上下文限制使得完整对比困难

## 解决方案

### 方案一：分模块增量对比（推荐）

将官方功能按模块拆分，逐一对比和同步：

```
┌─────────────────────────────────────────────────┐
│                  官方源码                         │
│  ┌──────────────────────────────────────────┐   │
│  │ cli.js (11MB)                             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                      ↓ 分析
┌─────────────────────────────────────────────────┐
│                  分析器                          │
│  scripts/sync-analyzer-v2.ts                    │
│  scripts/schema-comparator.ts                   │
└─────────────────────────────────────────────────┘
                      ↓ 生成
┌─────────────────────────────────────────────────┐
│               同步任务列表                        │
│  - 工具 Schema 对比                              │
│  - 模块功能对比                                   │
│  - 缺失功能识别                                   │
└─────────────────────────────────────────────────┘
```

### 方案二：类型定义驱动

利用官方的 `sdk-tools.d.ts` 类型定义文件作为参考：

```typescript
// 官方类型定义 (sdk-tools.d.ts)
export interface BashInput {
  command: string;
  timeout?: number;
  description?: string;
  run_in_background?: boolean;
  dangerouslyDisableSandbox?: boolean;
}
```

### 方案三：功能模块拆分

按功能模块创建独立的对比任务：

| 模块 | 优先级 | 复杂度 | 状态 |
|------|--------|--------|------|
| 核心工具 | P0 | 高 | ✅ 已实现 |
| 搜索工具 | P0 | 中 | ✅ 已实现 |
| 网络工具 | P1 | 中 | ✅ 已实现 |
| 代理工具 | P1 | 高 | ✅ 已实现 |
| UI 组件 | P2 | 高 | ✅ 已实现 |
| 配置系统 | P2 | 中 | ✅ 已实现 |
| 权限系统 | P2 | 中 | ✅ 已实现 |
| Hook 系统 | P3 | 中 | ✅ 已实现 |
| MCP 系统 | P3 | 高 | ✅ 已实现 |

## 当前同步状态

### 工具实现状态

| 工具名称 | 官方 | 项目 | 项目文件 | 状态 |
|----------|------|------|----------|------|
| Bash | ✓ | ✓ | src/tools/bash.ts | ✅ |
| BashOutput | ✓ | ✓ | src/tools/bash.ts | ✅ |
| Read | ✓ | ✓ | src/tools/file.ts | ✅ |
| Write | ✓ | ✓ | src/tools/file.ts | ✅ |
| Edit | ✓ | ✓ | src/tools/file.ts | ✅ |
| MultiEdit | ✓ | ✓ | src/tools/multiedit.ts | ✅ |
| Glob | ✓ | ✓ | src/tools/search.ts | ✅ |
| Grep | ✓ | ✓ | src/tools/search.ts | ✅ |
| Task | ✓ | ✓ | src/tools/agent.ts | ✅ |
| WebFetch | ✓ | ✓ | src/tools/web.ts | ✅ |
| WebSearch | ✓ | ✓ | src/tools/web.ts | ✅ |
| TodoWrite | ✓ | ✓ | src/tools/todo.ts | ✅ |
| NotebookEdit | ✓ | ✓ | src/tools/notebook.ts | ✅ |
| Mcp | ✓ | ✓ | src/tools/mcp.ts | ✅ |
| KillShell | ✓ | ✓ | src/tools/bash.ts | ✅ |
| ExitPlanMode | ✓ | ✓ | src/tools/planmode.ts | ✅ |
| EnterPlanMode | ✓ | ✓ | src/tools/planmode.ts | ✅ |
| AskUserQuestion | ✓ | ✓ | src/tools/ask.ts | ✅ |
| Skill | ✓ | ✓ | src/tools/skill.ts | ✅ |
| SlashCommand | ✓ | ✓ | src/tools/skill.ts | ✅ |
| Tmux | ✓ | ✓ | src/tools/tmux.ts | ✅ |

### 模块实现状态

| 模块 | 目录 | 文件数 | 状态 |
|------|------|--------|------|
| core | src/core | 6 | ✅ |
| tools | src/tools | 18 | ✅ |
| ui | src/ui | 82 | ✅ |
| auth | src/auth | 3 | ✅ |
| config | src/config | 3 | ✅ |
| context | src/context | 5 | ✅ |
| hooks | src/hooks | 2 | ✅ |
| mcp | src/mcp | 25 | ✅ |
| permissions | src/permissions | 13 | ✅ |
| session | src/session | 4 | ✅ |
| streaming | src/streaming | 4 | ✅ |
| agents | src/agents | 18 | ✅ |
| git | src/git | 6 | ✅ |
| search | src/search | 1 | ✅ |
| parser | src/parser | 5 | ✅ |
| telemetry | src/telemetry | 2 | ✅ |
| web | src/web | 15 | ✅ |
| plan | src/plan | 4 | ✅ |
| skills | src/skills | 0 | ⚠️ |
| plugins | src/plugins | 2 | ✅ |
| updater | src/updater | 1 | ✅ |

## 同步任务分解

### 第一阶段：工具 Schema 精确对比

对每个工具进行参数 schema 的精确对比：

```bash
# 运行 Schema 对比器
npx tsx scripts/schema-comparator.ts
```

### 第二阶段：官方特性提取

从官方源码中提取关键特性：

1. **Subagent 类型**
   - statusline-setup
   - 其他待发现...

2. **权限模式**
   - bypassPermissions
   - acceptEdits
   - plan

3. **Hook 类型**
   - PreToolUse
   - PostToolUse
   - Notification
   - Stop
   - SessionStart

4. **CLI 选项**
   - 已发现的完整列表见 `SYNC_ANALYSIS.json`

5. **环境变量**
   - CLAUDE_API_KEY
   - CLAUDE_CODE_*
   - 完整列表见分析报告

### 第三阶段：功能逐项验证

对每个功能模块进行测试验证：

```bash
# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e
```

### 第四阶段：持续同步机制

1. **版本监控**: 定期检查官方版本更新
2. **差异分析**: 对新版本进行差异分析
3. **增量同步**: 同步新增功能

## 分析工具使用指南

### 1. 运行完整分析

```bash
npx tsx scripts/sync-analyzer-v2.ts
```

输出文件：
- `SYNC_ANALYSIS.json` - 详细 JSON 报告
- `SYNC_ANALYSIS.md` - Markdown 格式报告

### 2. 运行 Schema 对比

```bash
npx tsx scripts/schema-comparator.ts
```

输出文件：
- `SCHEMA_COMPARISON.md` - Schema 对比报告

### 3. 提取特定功能代码

从官方源码中提取特定功能的实现：

```javascript
// 示例：搜索 WebFetch 相关代码
const content = fs.readFileSync('node_modules/@anthropic-ai/claude-code/cli.js', 'utf8');
const regex = /WebFetch[\s\S]{0,2000}/g;
const matches = content.match(regex);
```

## 下一步行动

### 近期任务

1. [ ] 完善 Schema 对比器，支持更精确的类型匹配
2. [ ] 对比每个工具的 prompt 描述
3. [ ] 验证工具返回格式一致性
4. [ ] 检查错误处理逻辑一致性

### 中期任务

1. [ ] 同步新版本的 subagent 类型
2. [ ] 更新 CLI 选项和环境变量
3. [ ] 完善 Hook 系统
4. [ ] 增强 MCP 支持

### 长期任务

1. [ ] 建立自动化同步管道
2. [ ] 创建版本变更日志
3. [ ] 建立功能回归测试套件

## 团队协作指南

### 分工建议

由于上下文限制，建议按模块分工：

| 模块范围 | 任务描述 |
|----------|----------|
| 工具层 (src/tools) | 对比和同步所有工具实现 |
| 核心层 (src/core) | 对比 API 客户端和会话管理 |
| UI 层 (src/ui) | 对比 React/Ink 组件 |
| 系统层 (src/mcp, src/hooks) | 对比高级功能系统 |

### 协作流程

1. 领取模块任务
2. 使用分析工具生成该模块的对比报告
3. 识别差异并创建同步 PR
4. 代码评审和合并

## 附录

### A. 官方环境变量列表

```
CLAUDE_AGENT_SDK_VERSION
CLAUDE_AI_AUTHORIZE_URL
CLAUDE_API_KEY
CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR
CLAUDE_BASH_NO_LOGIN
CLAUDE_CODE_ACTION
CLAUDE_CODE_ADDITIONAL_PROTECTION
CLAUDE_CODE_AGENT_ID
CLAUDE_CODE_AGENT_NAME
CLAUDE_CODE_AGENT_TYPE
CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR
CLAUDE_CODE_API_KEY_HELPER_TTL_MS
CLAUDE_CODE_AUTO_CONNECT_IDE
CLAUDE_CODE_BASH_SANDBOX_SHOW_INDICATOR
... (更多见 SYNC_ANALYSIS.json)
```

### B. 分析脚本位置

- `scripts/sync-analyzer.ts` - 初版分析器
- `scripts/sync-analyzer-v2.ts` - 增强版分析器
- `scripts/schema-comparator.ts` - Schema 对比器

### C. 报告文件位置

- `SYNC_REPORT.md` - 初版同步报告
- `SYNC_ANALYSIS.md` - 详细分析报告
- `SYNC_ANALYSIS.json` - 完整 JSON 数据
- `SCHEMA_COMPARISON.md` - Schema 对比报告
