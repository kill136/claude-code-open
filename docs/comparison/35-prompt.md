# 35. 系统提示词功能对比 (T407-T416)

## 任务概述
对比分析本项目与官方 @anthropic-ai/claude-code 在系统提示词相关功能的实现差异。

**分析时间**: 2025-12-25
**官方版本**: v2.0.76
**本项目状态**: 开源复现版

---

## T407: 系统提示词模板 (system_prompt)

### 官方实现
**位置**: `node_modules/@anthropic-ai/claude-code/cli.js` (压缩代码)

**关键特性**:
- 动态生成复杂的系统提示词
- 包含多个模块化组件:
  - 核心 AI 身份和能力描述
  - 工具使用指南
  - 权限模式说明
  - CLAUDE.md 内容注入
  - 批判性系统提醒 (critical_system_reminder)
  - 输出风格指令
  - IDE 集成信息
  - 诊断和任务状态
- 支持模板变量替换 (`${T3}`, `${qV}`, `${OX}` 等)
- 根据不同上下文动态调整内容

### 本项目实现
**位置**:
- `src/core/loop.ts` (L26-L34)
- `src/cli.ts` (L70-L71, L126-L136)
- `src/rules/index.ts` (L362-L388)

**代码示例**:
```typescript
// src/core/loop.ts
const DEFAULT_SYSTEM_PROMPT = `You are Claude, an AI assistant made by Anthropic. You are an expert software engineer.

You have access to tools to help complete tasks. Use them as needed.

Guidelines:
- Be concise and direct
- Use tools to gather information before answering
- Prefer editing existing files over creating new ones
- Always verify your work`;

// src/rules/index.ts
export function generateSystemPromptAddition(rules: ProjectRules): string {
  const parts: string[] = [];

  if (rules.instructions) {
    parts.push('## Project Instructions\n');
    parts.push(rules.instructions);
    parts.push('');
  }

  if (rules.memory && Object.keys(rules.memory).length > 0) {
    parts.push('## Project Context\n');
    for (const [key, value] of Object.entries(rules.memory)) {
      parts.push(`- **${key}**: ${value}`);
    }
    parts.push('');
  }

  if (rules.customRules && rules.customRules.length > 0) {
    parts.push('## Custom Rules\n');
    for (const rule of rules.customRules) {
      parts.push(`- **${rule.name}** (${rule.action}): ${rule.message || 'No description'}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
```

**差异分析**:
| 维度 | 官方实现 | 本项目实现 | 差距 |
|------|---------|-----------|------|
| 模板复杂度 | 高度模块化，数千行 | 简单静态文本 | ⭐⭐⭐⭐⭐ |
| 动态生成 | 完整支持，根据上下文调整 | 仅支持基础拼接 | ⭐⭐⭐⭐⭐ |
| 模板变量 | 支持多种占位符 | 不支持 | ⭐⭐⭐⭐⭐ |
| 内容模块 | 15+ 模块 | 3 模块 | ⭐⭐⭐⭐⭐ |

**实现程度**: 10% ❌

---

## T408: 提示词动态生成

### 官方实现
**关键代码片段** (从搜索结果推断):
```javascript
// 动态附件生成
async function vX(A, Q) {
  let B = Date.now();
  try {
    let G = await Q(),
        Z = Date.now() - B,
        Y = G.reduce((J, X) => {
          return J + JSON.stringify(X).length
        }, 0);
    if (Math.random() < 0.05)
      n("tengu_attachment_compute_duration", {
        label: A,
        duration_ms: Z,
        attachment_size_bytes: Y,
        attachment_count: G.length
      });
    return G
  } catch (G) {
    // 错误处理
    return []
  }
}

// 附件类型
// - claudeMd (CLAUDE.md 内容)
// - critical_system_reminder
// - ide_selection (IDE 选择内容)
// - ide_opened_file (已打开文件)
// - output_style (输出风格)
// - diagnostics (诊断信息)
// - memory (记忆系统)
// - plan_mode (计划模式)
// - delegate_mode (委托模式)
```

### 本项目实现
**位置**: `src/rules/index.ts`

**代码示例**:
```typescript
// 仅支持 CLAUDE.md 的基础解析
export function loadProjectRules(projectDir?: string): ProjectRules {
  const dir = projectDir || process.cwd();
  let rules: ProjectRules = {};

  // Load CLAUDE.md
  const claudeMdPath = findClaudeMd(dir);
  if (claudeMdPath) {
    const sections = parseClaudeMd(claudeMdPath);
    rules = { ...rules, ...extractRules(sections) };
  }

  // Load settings files
  const settingsFiles = findSettingsFiles(dir);
  for (const settingsPath of settingsFiles) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      rules = mergeRules(rules, settings);
    } catch {
      // Ignore parse errors
    }
  }

  return rules;
}
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| 动态附件系统 | ✅ 支持 15+ 种附件类型 | ❌ 无 |
| 性能监控 | ✅ 附件生成耗时追踪 | ❌ 无 |
| IDE 集成信息 | ✅ 选择内容、打开文件 | ❌ 无 |
| 输出风格指令 | ✅ 动态生成 | ❌ 无 |
| 诊断信息注入 | ✅ LSP、任务状态等 | ❌ 无 |
| 异步 Hook 响应 | ✅ 支持 | ❌ 无 |

**实现程度**: 5% ❌

---

## T409: system_prompt_hash 计算

### 官方实现
**特性** (从代码推断):
- 计算系统提示词的哈希值用于缓存
- 用于提示上下文缓存 (prompt caching)
- 避免重复发送相同的系统提示词
- 优化 API 调用成本

### 本项目实现
**状态**: ❌ 未实现

**影响**:
- 无法利用 Anthropic API 的提示缓存功能
- 每次请求都发送完整系统提示词
- API 调用成本较高

**实现程度**: 0% ❌

---

## T410: system_prompt_length 限制

### 官方实现
**特性**:
- 动态计算系统提示词 token 长度
- 根据模型上下文窗口调整
- 超长时智能压缩或截断
- 错误提示: "Prompt is too long"

**代码片段** (从搜索结果):
```javascript
if (A instanceof Error && A.message.toLowerCase().includes("prompt is too long"))
  return eJ({content: uKA, error: "invalid_request"});

// uKA = "Prompt is too long"
```

### 本项目实现
**位置**: `src/context/index.ts`

**代码示例**:
```typescript
// Token 估算常量
const CHARS_PER_TOKEN = 3.5;
const MAX_CONTEXT_TOKENS = 180000; // Claude 3.5 的上下文窗口
const RESERVE_TOKENS = 8192; // 保留给输出

export function estimateTokens(text: string): number {
  if (!text) return 0;

  const hasAsian = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasCode = /^```|function |class |const |let |var |import |export /.test(text);

  let charsPerToken = CHARS_PER_TOKEN;

  if (hasAsian) {
    charsPerToken = 2.0; // 中日韩字符
  } else if (hasCode) {
    charsPerToken = 3.0; // 代码通常更密集
  }

  let tokens = text.length / charsPerToken;
  const specialChars = (text.match(/[{}[\]().,;:!?<>]/g) || []).length;
  tokens += specialChars * 0.1;

  const newlines = (text.match(/\n/g) || []).length;
  tokens += newlines * 0.5;

  return Math.ceil(tokens);
}
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| Token 计数 | ✅ 精确计算 | ✅ 启发式估算 |
| 长度限制检查 | ✅ 完整 | ⚠️ 部分 |
| 超长处理 | ✅ 自动压缩/截断 | ⚠️ 仅在上下文管理中 |
| 错误提示 | ✅ 用户友好 | ❌ 无专门提示 |

**实现程度**: 40% ⚠️

---

## T411: system_prompt_preview

### 官方实现
**特性**:
- 在调试模式下显示系统提示词预览
- 截取前 N 个字符显示
- 用于调试和验证提示词内容

### 本项目实现
**状态**: ❌ 未实现

**建议实现位置**:
- `src/cli.ts` 的 `--debug` 模式
- `src/core/loop.ts` 的 verbose 输出

**实现程度**: 0% ❌

---

## T412: critical_system_reminder

### 官方实现
**代码片段** (从搜索结果):
```javascript
function Tx5(Q) {
  let A = Q.criticalSystemReminder_EXPERIMENTAL;
  if (!A) return [];
  return [{
    type: "critical_system_reminder",
    content: A
  }]
}

// 在附件系统中注入
vX("critical_system_reminder", () => Promise.resolve(Tx5(Q)))
```

**特性**:
- 实验性功能
- 允许用户自定义批判性系统提醒
- 在每次请求时注入
- 用于强化特定行为规则

### 本项目实现
**状态**: ❌ 未实现

**用途示例**:
```typescript
// 官方用法 (推断)
{
  criticalSystemReminder_EXPERIMENTAL: `
    IMPORTANT: This is a critical reminder.
    - Always validate user input
    - Never expose sensitive data
    - Follow security best practices
  `
}
```

**实现程度**: 0% ❌

---

## T413: prompt_suggestion 生成

### 官方实现
**特性** (从代码推断):
- 根据当前上下文生成提示词建议
- 用于引导用户输入
- 可能基于历史对话、打开的文件等

**位置** (推断):
- UI 层的自动完成功能
- 快捷命令建议

### 本项目实现
**位置**: `src/cli.ts` (L323-L324)

**代码示例**:
```typescript
console.log(chalk.gray('> Try "how do I log an error?"'));
console.log(chalk.gray('? for shortcuts'));
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| 动态建议 | ✅ 根据上下文 | ❌ 静态文本 |
| 建议来源 | ✅ 文件、历史等 | ❌ 无 |
| UI 集成 | ✅ Ink TUI | ⚠️ 基础文本 |

**实现程度**: 5% ❌

---

## T414: prompt_too_long 处理

### 官方实现
**代码片段** (从搜索结果):
```javascript
var uKA = "Prompt is too long",
    Yy5 = "Conversation too long. Press esc twice to go up a few messages and try again.";

if (A instanceof Error && A.message.toLowerCase().includes("prompt is too long"))
  return eJ({content: uKA, error: "invalid_request"});

// 在压缩失败时
if (L.startsWith(uKA))
  throw n("tengu_compact_failed", {
    reason: "prompt_too_long",
    preCompactTokenCount: Y
  }), Error(Yy5);
```

**特性**:
- 检测提示过长错误
- 友好的错误提示
- 引导用户执行 compact 操作
- 遥测追踪 (`tengu_compact_failed`)

### 本项目实现
**位置**: `src/context/index.ts`

**代码示例**:
```typescript
export function truncateMessages(
  messages: Message[],
  maxTokens: number,
  keepFirst: number = 2,
  keepLast: number = 10
): Message[] {
  let totalTokens = estimateTotalTokens(messages);

  if (totalTokens <= maxTokens) {
    return messages;
  }

  // 保护首尾消息
  const firstMessages = messages.slice(0, keepFirst);
  const lastMessages = messages.slice(-keepLast);
  const middleMessages = messages.slice(keepFirst, -keepLast);

  // 逐步移除中间消息
  const result = [...firstMessages];
  let currentTokens = estimateTotalTokens(firstMessages) + estimateTotalTokens(lastMessages);

  for (const msg of middleMessages) {
    const msgTokens = estimateMessageTokens(msg);
    if (currentTokens + msgTokens <= maxTokens) {
      result.push(msg);
      currentTokens += msgTokens;
    }
  }

  result.push(...lastMessages);
  return result;
}
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| 错误检测 | ✅ API 错误捕获 | ❌ 无 |
| 用户提示 | ✅ 友好引导 | ❌ 无 |
| 自动压缩 | ✅ 智能触发 | ⚠️ 手动触发 |
| 遥测追踪 | ✅ 完整 | ❌ 无 |

**实现程度**: 30% ⚠️

---

## T415: 工具描述注入

### 官方实现
**特性**:
- 动态生成工具描述
- 根据权限模式过滤工具
- 注入工具使用示例
- 针对不同场景优化描述

**代码示例** (推断):
```javascript
// 工具描述模板
tools: jc([W3, ...I.mcp.tools], "name")

// 动态过滤
let D = [];
if (options.allowedTools && options.allowedTools.length > 0) {
  const allowed = new Set(options.allowedTools);
  tools = tools.filter(t => allowed.has(t.name));
}
```

### 本项目实现
**位置**: `src/core/loop.ts` (L51-L65)

**代码示例**:
```typescript
// 获取并过滤工具
let tools = toolRegistry.getDefinitions();

// 应用工具过滤
if (options.allowedTools && options.allowedTools.length > 0) {
  const allowed = new Set(options.allowedTools.flatMap(t => t.split(',')).map(t => t.trim()));
  tools = tools.filter(t => allowed.has(t.name));
}

if (options.disallowedTools && options.disallowedTools.length > 0) {
  const disallowed = new Set(options.disallowedTools.flatMap(t => t.split(',')).map(t => t.trim()));
  tools = tools.filter(t => !disallowed.has(t.name));
}

this.tools = tools;
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| 工具过滤 | ✅ 完整 | ✅ 完整 |
| 描述优化 | ✅ 动态生成 | ⚠️ 静态描述 |
| 使用示例 | ✅ 注入 | ❌ 无 |
| MCP 工具集成 | ✅ 完整 | ⚠️ 部分 |

**实现程度**: 60% ⚠️

---

## T416: 上下文指令注入 (CLAUDE.md)

### 官方实现
**代码片段** (从搜索结果):
```javascript
// CLAUDE.md 引用 23 次
// 示例:
"7. Reference local project files (CLAUDE.md, .claude/ directory) when relevant using ${T3}, ${qV}, and ${OX}"

"- Do not include information that's already in the CLAUDE.md files included in the context"

"Use the repository's CLAUDE.md for guidance on style and conventions."

// 附件类型
type: "claudeMd"
```

**特性**:
- 自动查找项目的 CLAUDE.md 文件
- 解析并注入到系统提示词
- 支持多级目录查找
- 缓存解析结果
- 模板变量引用 (`${T3}`, `${qV}`, `${OX}`)

### 本项目实现
**位置**: `src/rules/index.ts`

**代码示例**:
```typescript
// File names to look for
const CLAUDE_MD_FILES = [
  'CLAUDE.md',
  '.claude.md',
  'claude.md',
  '.claude/CLAUDE.md',
  '.claude/instructions.md',
];

/**
 * Find CLAUDE.md file in directory hierarchy
 */
export function findClaudeMd(startDir?: string): string | null {
  let dir = startDir || process.cwd();

  // Walk up directory tree
  while (dir !== path.dirname(dir)) {
    for (const filename of CLAUDE_MD_FILES) {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    dir = path.dirname(dir);
  }

  // Check home directory
  const homeClaudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  if (fs.existsSync(homeClaudeMd)) {
    return homeClaudeMd;
  }

  return null;
}

/**
 * Parse CLAUDE.md file
 */
export function parseClaudeMd(filePath: string): ClaudeMdSection[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const sections: ClaudeMdSection[] = [];
  const lines = content.split('\n');

  let currentSection: ClaudeMdSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        title: headingMatch[2].trim(),
        content: '',
        level: headingMatch[1].length,
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}
```

**差异分析**:
| 功能 | 官方实现 | 本项目实现 |
|------|---------|-----------|
| 文件查找 | ✅ 完整 | ✅ 完整 |
| 内容解析 | ✅ 完整 | ✅ 完整 |
| 模板变量 | ✅ 支持 | ❌ 无 |
| 缓存机制 | ✅ 有 | ❌ 无 |
| 附件系统 | ✅ 集成 | ❌ 独立 |
| 动态注入 | ✅ 每次请求 | ⚠️ 启动时一次 |

**实现程度**: 70% ⚠️

---

## 总结

### 整体实现程度

| 功能点 | 实现程度 | 状态 |
|--------|---------|------|
| T407: 系统提示词模板 | 10% | ❌ 严重不足 |
| T408: 提示词动态生成 | 5% | ❌ 严重不足 |
| T409: system_prompt_hash | 0% | ❌ 未实现 |
| T410: system_prompt_length | 40% | ⚠️ 部分实现 |
| T411: system_prompt_preview | 0% | ❌ 未实现 |
| T412: critical_system_reminder | 0% | ❌ 未实现 |
| T413: prompt_suggestion | 5% | ❌ 严重不足 |
| T414: prompt_too_long 处理 | 30% | ⚠️ 部分实现 |
| T415: 工具描述注入 | 60% | ⚠️ 部分实现 |
| T416: CLAUDE.md 注入 | 70% | ⚠️ 基本完成 |

**平均实现度**: 22% ❌

### 关键差距

#### 1. 系统提示词架构 (最严重)
官方实现了一个复杂的模块化系统提示词生成系统，而本项目仅有简单的静态模板。

**官方架构**:
```
SystemPrompt
├── Core Identity (核心身份)
├── Tool Descriptions (工具描述)
├── Permission Mode (权限模式)
├── Dynamic Attachments (动态附件)
│   ├── CLAUDE.md
│   ├── IDE Selection
│   ├── Opened Files
│   ├── Output Style
│   ├── Diagnostics
│   ├── Memory
│   ├── Plan Mode
│   └── ...
├── Critical Reminder (批判性提醒)
└── Template Variables (模板变量)
```

**本项目架构**:
```
SystemPrompt
├── Static Template (静态模板)
└── CLAUDE.md Rules (规则)
```

#### 2. 动态附件系统 (核心功能缺失)
官方实现了完整的附件系统，可以根据上下文动态注入各种信息：
- IDE 当前选择的内容
- 打开的文件列表
- 诊断信息 (LSP、错误等)
- 任务状态
- 记忆系统内容
- Hook 响应

本项目完全缺失这些功能。

#### 3. 提示缓存优化 (性能差距)
官方实现了 `system_prompt_hash` 用于 Anthropic 的提示缓存功能，可以显著降低 API 成本。本项目未实现。

#### 4. 错误处理和用户引导 (用户体验)
官方有完善的错误处理机制，特别是 "prompt too long" 的友好提示和自动压缩建议。本项目缺失。

### 优先改进建议

#### 第一阶段 (核心功能)
1. **实现动态附件系统** - 创建 `src/prompt/attachments/` 目录
2. **CLAUDE.md 动态注入** - 改为每次请求时注入
3. **提示缓存机制** - 实现 hash 计算

#### 第二阶段 (用户体验)
4. **错误处理优化** - 友好的 "prompt too long" 提示
5. **提示词预览** - 调试模式下显示
6. **批判性提醒** - 支持用户自定义

#### 第三阶段 (高级功能)
7. **IDE 集成信息** - 选择内容、打开文件
8. **诊断信息注入** - LSP、任务状态
9. **动态建议生成** - 上下文感知的提示建议

### 技术债务

1. **系统提示词模板需要重构** - 当前的静态字符串无法扩展
2. **缺少模板引擎** - 需要实现变量替换和模块化
3. **无性能监控** - 无法追踪附件生成耗时
4. **缺少遥测** - 无法分析提示词使用情况

### 参考资料

**官方代码位置**:
- `node_modules/@anthropic-ai/claude-code/cli.js` (压缩混淆)
- 关键函数: `vX`, `Tx5`, `Mx5`, `Rx5`, `_x5`, `jx5`
- 附件类型搜索: `critical_system_reminder`, `claudeMd`, `ide_selection`

**本项目相关文件**:
- `/home/user/claude-code-open/src/core/loop.ts`
- `/home/user/claude-code-open/src/rules/index.ts`
- `/home/user/claude-code-open/src/context/index.ts`
- `/home/user/claude-code-open/src/cli.ts`

**CLAUDE.md 在本项目中的示例**:
- `/home/user/claude-code-open/CLAUDE.md`

---

**生成时间**: 2025-12-25
**分析工具**: Claude Code Agent
**数据来源**: 源码对比 + 官方包反编译分析
