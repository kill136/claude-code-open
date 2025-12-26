# 上下文管理模块分析报告

## 目录

1. [官方源码分析](#官方源码分析)
2. [本项目差距分析](#本项目差距分析)
3. [具体实现建议](#具体实现建议)
4. [参考行号](#参考行号)

---

## 官方源码分析

### 1. Token 估算系统

#### 1.1 核心函数

**`gK()` 函数** - 消息 token 估算
- **位置**: cli.js (用于估算整个消息数组的 tokens)
- **算法**: 通过遍历消息数组，找到最后一条带 usage 信息的 assistant 消息
- **关键特性**:
  - 包含 input_tokens、cache_creation_input_tokens、cache_read_input_tokens、output_tokens
  - 计算公式: `GSA(usage)` = input + cache_creation + cache_read + output

```javascript
// 伪代码示例（基于官方源码）
function gK(messages) {
  let index = messages.length - 1;
  while (index >= 0) {
    const msg = messages[index];
    const usage = msg?.type === 'assistant' ? jo(msg) : undefined;
    if (usage) {
      return GSA(usage); // 累加所有 token 类型
    }
    index--;
  }
  return 0;
}

function GSA(usage) {
  return (
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    usage.output_tokens
  );
}
```

#### 1.2 辅助函数

- **`FY2()`**: 获取输出 tokens
- **`EY2()`**: 获取完整 usage 对象
- **`c71()`**: 检查是否超过 200k tokens

### 2. 上下文窗口管理

#### 2.1 窗口大小计算

**`NO()` 函数** - 获取模型上下文窗口
```javascript
function NO(model) {
  if (model.includes("[1m]")) {
    return 1000000; // 1M token 实验模型
  }
  return 200000; // 默认 200k tokens
}
```

**`kW7()` 函数** - 计算可用上下文
```javascript
function kW7() {
  const model = UK(); // 获取当前模型
  const contextWindow = NO(model);
  if (contextWindow <= 50000) { // rH9 = 50000
    return Math.floor(contextWindow * 0.8);
  }
  return contextWindow - 50000; // 保留 50k 作为输出空间
}
```

**关键设计**:
- 小模型 (≤50k): 使用 80% 作为输入上下文
- 大模型 (>50k): 保留固定 50k 作为输出空间
- Claude 3.5 (200k): 可用输入 = 200k - 50k = 150k tokens

#### 2.2 上下文压缩策略

**`fW7()` 函数** - 自动摘要生成
- **位置**: cli.js:4858-4950
- **触发条件**: 当需要为 session resume 生成标题时
- **策略**:
  1. 计算可用 token 预算 (通过 `kW7()`)
  2. 从最后一条消息开始倒序收集
  3. 估算每条消息的 tokens (通过 `gK([message])`)
  4. 确保总 tokens 不超过预算

```javascript
// 关键代码逻辑 (cli.js:4858)
async function fW7(messages, isNonInteractive) {
  if (!messages.length) {
    throw Error("Can't summarize empty conversation");
  }

  let collected = [];
  let totalTokens = 0;
  const budget = kW7(); // 计算可用预算
  let prevTokens = null;

  // 倒序遍历消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;

    const msgTokens = gK([msg]);
    let delta = 0;

    // 如果有前一条消息的 tokens，计算增量
    if (prevTokens !== null && msgTokens > 0 && msgTokens < prevTokens) {
      delta = prevTokens - msgTokens;
    }

    // 检查是否超出预算
    if (totalTokens + delta > budget) {
      break;
    }

    collected.unshift(msg);
    totalTokens += delta;

    if (msgTokens > 0) {
      prevTokens = msgTokens;
    }
  }

  const isTruncated = collected.length < messages.length;

  // 生成摘要
  const conversationText = bW7(collected); // 格式化为文本
  const prompt = [
    `Please write a 5-10 word title for the following conversation:`,
    `${isTruncated ? `[Last ${collected.length} of ${messages.length} messages]\n\n` : ""}${conversationText}`,
    "Respond with the title for the conversation and nothing else."
  ];

  // 调用 API 生成摘要
  const response = await jK({
    systemPrompt: [vW7],
    userPrompt: prompt.join('\n'),
    enablePromptCaching: true,
    signal: new AbortController().signal,
    options: {
      querySource: "summarize_for_resume",
      agents: [],
      isNonInteractiveSession: isNonInteractive,
      hasAppendSystemPrompt: false,
      mcpTools: []
    }
  });

  return response.message.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");
}
```

**系统提示词** (vW7):
```
Summarize this coding conversation in under 50 characters.
Capture the main task, key files, problems addressed, and current status.
```

#### 2.3 消息格式化

**`bW7()` 函数** - 格式化消息为文本
```javascript
function bW7(messages) {
  return GX(messages)
    .map(msg => {
      if (msg.type === "user") {
        if (typeof msg.message.content === "string") {
          return `User: ${msg.message.content}`;
        } else if (Array.isArray(msg.message.content)) {
          return `User: ${msg.message.content
            .filter(block => block.type === "text")
            .map(block => block.type === "text" ? block.text : "")
            .join('\n')
            .trim()}`;
        }
      } else if (msg.type === "assistant") {
        const textBlock = _9A(msg);
        if (textBlock) {
          return `Claude: ${_vA(textBlock).trim()}`;
        }
      }
      return null;
    })
    .filter(msg => msg !== null)
    .join('\n\n');
}
```

### 3. 消息历史管理

#### 3.1 存储结构

官方源码使用以下结构存储消息历史：

**Session 文件** (`.jsonl` 格式):
- 每行一条记录
- 包含完整的消息对象
- 自动压缩工具输出

**关键函数**:
- `dW7()`: 检查 session 是否已有摘要
- `gW7()`: 列出所有 session 文件
- `uW7()`: 构建完整对话链（包括 sidechain）
- `mW7()`: 获取顶层对话（非 sidechain）

#### 3.2 清理策略

**自动清理** (cli.js:1688+):
- **时间阈值**: 30 天 (可通过 `cleanupPeriodDays` 配置)
- **清理对象**:
  - Session 文件 (.jsonl)
  - Bash 输出缓存
  - MCP 日志
  - 文件历史快照
  - Session 环境缓存

```javascript
// 清理逻辑伪代码
function yfA() {
  const cleanupPeriod = (zQ()?.cleanupPeriodDays ?? 30) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - cleanupPeriod);
}

async function _W7() {
  // 清理错误日志
  const cutoffDate = yfA();
  const stats = { messages: 0, errors: 0 };

  // 清理各目录
  nH9(errorsDir, cutoffDate, false); // 错误日志不删除目录
  nH9(logsDir, cutoffDate, true);    // 日志可以删除空目录

  return stats;
}
```

### 4. 上下文压缩优化

#### 4.1 工具输出压缩

官方实现了多种压缩策略：

**代码块压缩**:
- 保留开头 60%，结尾 40%
- 最大行数限制 (通常 50 行)
- 添加 `[N lines omitted]` 标记

**文件内容压缩**:
- 检测文件列表格式 (包含 `→` 或行号)
- 保留前 20 行，后 10 行
- 其他内容简单截断

**二进制/大文件处理**:
- 对超大输出使用引用而非全文
- 最大字符数限制 (默认 2000)

#### 4.2 缓存策略

**Prompt Caching**:
- 官方未在明确代码中实现完整的 Prompt Caching
- 但在 API 调用时启用: `enablePromptCaching: true`
- 缓存控制在 API 层面处理

#### 4.3 Token 预算管理

**保留空间** (cli.js):
```javascript
const RESERVE_TOKENS = 50000; // 保留 50k 给输出
const rH9 = 50000;

function kW7() {
  const contextWindow = NO(currentModel);
  if (contextWindow <= rH9) {
    return Math.floor(contextWindow * 0.8);
  }
  return contextWindow - rH9;
}
```

### 5. 上下文溢出处理

#### 5.1 自动调整 max_tokens

**`VY2()` 函数** - 解析上下文溢出错误
```javascript
// cli.js (重试逻辑中)
function VY2(error) {
  if (error.status !== 400 || !error.message) return;

  const pattern = /input length and `max_tokens` exceed context limit: (\d+) \+ (\d+) > (\d+)/;
  const match = error.message.match(pattern);

  if (!match || match.length !== 4) return;

  const inputTokens = parseInt(match[1], 10);
  const maxTokens = parseInt(match[2], 10);
  const contextLimit = parseInt(match[3], 10);

  if (isNaN(inputTokens) || isNaN(maxTokens) || isNaN(contextLimit)) {
    return;
  }

  return {
    inputTokens,
    maxTokens,
    contextLimit
  };
}
```

#### 5.2 动态调整策略

在重试循环中：
```javascript
async function* d71(getClient, executeRequest, options) {
  let retryContext = {
    model: options.model,
    maxThinkingTokens: options.maxThinkingTokens
  };

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // ...
    } catch (error) {
      if (error instanceof F9) { // APIError
        const overflow = VY2(error);
        if (overflow) {
          const { inputTokens, contextLimit } = overflow;
          const reserve = 1000;
          const available = Math.max(0, contextLimit - inputTokens - reserve);

          if (available < 3000) {
            throw error; // 空间不足，放弃
          }

          const thinking = (retryContext.maxThinkingTokens || 0) + 1;
          const adjusted = Math.max(3000, available, thinking);

          retryContext.maxTokensOverride = adjusted;

          n("tengu_max_tokens_context_overflow_adjustment", {
            inputTokens,
            contextLimit,
            adjustedMaxTokens: adjusted,
            attempt
          });

          continue; // 重试
        }
      }

      // ...
    }
  }
}
```

### 6. Session Resume 支持

#### 6.1 摘要缓存

**存储位置**: `~/.claude/sessions/{sessionId}/summaries.json`

**缓存结构**:
```javascript
{
  "uuid": "session-uuid",
  "summary": "Brief conversation title"
}
```

#### 6.2 恢复流程

```javascript
// cli.js:1543
function l71(summaries, isNonInteractive) {
  let text = `This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:\n${summaries}.`;

  if (isNonInteractive) {
    return text; // 非交互模式，仅添加摘要
  }

  return `${text}\nPlease continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.`;
}
```

---

## 本项目差距分析

### 已实现功能

#### ✅ 基础 Token 估算 (`src/context/index.ts`)

```typescript
export function estimateTokens(text: string): number {
  const CHARS_PER_TOKEN = 3.5;

  // 检测文本类型
  const hasAsian = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasCode = /^```|function |class |const /.test(text);

  let charsPerToken = CHARS_PER_TOKEN;

  if (hasAsian) {
    charsPerToken = 2.0;
  } else if (hasCode) {
    charsPerToken = 3.0;
  }

  let tokens = text.length / charsPerToken;

  // 特殊字符权重
  const specialChars = (text.match(/[{}[\]().,;:!?<>]/g) || []).length;
  tokens += specialChars * 0.1;

  const newlines = (text.match(/\n/g) || []).length;
  tokens += newlines * 0.5;

  return Math.ceil(tokens);
}
```

**对比官方**:
- ✅ 支持多语言检测 (中文、日文)
- ✅ 代码内容特殊处理
- ❌ 缺少从 API response 提取真实 token 数

#### ✅ 上下文管理器 (`src/context/index.ts:446-840`)

```typescript
export class ContextManager {
  private config: Required<ContextConfig>;
  private turns: ConversationTurn[] = [];
  private compressionCount: number = 0;
  private savedTokens: number = 0;

  // ✅ 已实现
  addTurn(user: Message, assistant: Message): void
  getMessages(): Message[]
  getUsedTokens(): number
  getAvailableTokens(): number

  // ✅ 已实现
  private async maybeCompress(): Promise<void>
  async compact(): Promise<void>

  // ✅ 已实现
  getStats(): ContextStats
  getCompressionDetails(): {...}
  analyzeCompression(): CompressionResult
}
```

**对比官方**:
- ✅ 基础压缩逻辑
- ✅ Token 估算
- ❌ 缺少自动摘要生成 (使用 Claude API)
- ❌ 缺少 session resume 支持

#### ✅ 工具输出压缩 (`src/context/index.ts:184-233`)

```typescript
function compressToolOutput(content: string, maxChars = 2000): string {
  if (content.length <= maxChars) {
    return content;
  }

  // 检测代码块
  const codeBlocks = extractCodeBlocks(content);

  if (codeBlocks.length > 0) {
    // 压缩代码块
    let result = content;
    for (const block of codeBlocks) {
      const compressed = compressCodeBlock(block.code);
      // ...
    }
    if (result.length <= maxChars) {
      return result;
    }
  }

  // 检测文件内容
  if (content.includes('→') || /^\s*\d+\s*[│|]/.test(content)) {
    const lines = content.split('\n');
    const keepHead = 20;
    const keepTail = 10;
    // ...
  }

  // 默认截断
  return `${head}\n\n... [~${omitted} chars omitted] ...\n\n${tail}`;
}
```

**对比官方**:
- ✅ 代码块压缩
- ✅ 文件内容压缩
- ✅ 智能截断策略
- ⚠️ 压缩比例略有不同

#### ✅ 增强功能 (`src/context/enhanced.ts`)

```typescript
// T321: 精确 Token 计数
export const MODEL_CONTEXT_WINDOWS = {
  'claude-3-5-sonnet-20241022': 200000,
  'claude-4-5-sonnet-20250929': 200000,
  // ...
};

export function getModelContextWindow(modelId: string): number {
  // 精确匹配或模糊匹配
}

// T322: 动态上下文窗口管理
export class ContextWindowManager {
  recordUsage(usage: TokenUsage): void
  getUsagePercentage(): number
  isNearLimit(threshold = 0.8): boolean
  getStats(): ContextWindowStats
  getCacheStats(): {...}
}

// T327-T329: Prompt Caching 支持
export function addCacheControl(messages: Message[], options): Message[]
export function calculateCacheSavings(usage: TokenUsage): {...}
```

**对比官方**:
- ✅ 模型上下文窗口配置完整
- ✅ 缓存统计功能
- ❌ 未完全集成到主流程

### 缺失功能 (T-013: 自动压缩策略)

#### ❌ 1. 基于真实 API 返回的 Token 估算

**官方实现**:
```javascript
function jo(message) {
  if (message?.type === "assistant" && "usage" in message.message) {
    return message.message.usage; // 直接使用 API 返回
  }
  return undefined;
}

function gK(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = jo(messages[i]);
    if (usage) {
      return GSA(usage); // 累加所有 tokens
    }
  }
  return 0;
}
```

**本项目**:
- 仅使用启发式估算 (`estimateTokens()`)
- 未从 API response 提取真实 usage

#### ❌ 2. 自动摘要生成

**官方实现**:
- 使用 Claude API 生成简短摘要 (5-10 字)
- 专用系统提示词
- 支持 Prompt Caching

**本项目**:
```typescript
// 仅有简单版本
export function createSummary(turns: ConversationTurn[]): string {
  const summaryParts = ['=== Previous Conversation Summary ===\n'];

  for (const turn of turns) {
    const userContent = extractMessageCore(turn.user);
    const assistantContent = extractMessageCore(turn.assistant);

    // 简单截断
    const userSummary = userContent.slice(0, 300);
    const assistantSummary = assistantContent.slice(0, 400);

    summaryParts.push(`[${timestamp}]`);
    summaryParts.push(`User: ${userSummary}...`);
    summaryParts.push(`Assistant: ${assistantSummary}...`);
  }

  return summaryParts.join('\n');
}
```

**差距**:
- ❌ 未使用 AI 生成智能摘要
- ❌ 摘要质量较低
- ❌ 未集成到 session resume 流程

#### ❌ 3. 动态上下文窗口调整

**官方实现**:
```javascript
function kW7() {
  const model = UK();
  const contextWindow = NO(model);

  if (contextWindow <= 50000) {
    return Math.floor(contextWindow * 0.8);
  }

  return contextWindow - 50000;
}
```

**本项目**:
```typescript
getAvailableTokens(): number {
  const used = this.getUsedTokens();
  return this.config.maxTokens - this.config.reserveTokens - used;
}
```

**差距**:
- ⚠️ 保留空间固定 (8192)，官方根据模型动态调整
- ❌ 未考虑小模型的特殊处理

#### ❌ 4. 上下文溢出自动恢复

**官方实现**:
- 解析 `max_tokens exceed context limit` 错误
- 动态调整 max_tokens
- 自动重试

**本项目**:
- ❌ 完全缺失此功能

#### ❌ 5. Session Resume 支持

**官方实现**:
- 自动生成对话摘要
- 保存到 `.jsonl` 文件
- 恢复时注入摘要

**本项目**:
- ❌ 未实现

#### ❌ 6. 消息历史清理

**官方实现**:
- 30 天自动清理
- 清理错误日志、bash 输出、MCP 日志等
- 空目录自动删除

**本项目**:
- ❌ 未实现

---

## 具体实现建议

### T-013: 自动压缩策略实现

#### 步骤 1: 从 API Response 提取真实 Token 数

**文件**: `src/client/client.ts`

```typescript
// 1. 在 API response 处理中提取 usage
export interface APIResponse {
  message: Message;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

// 2. 修改 createMessage 方法
async createMessage(
  messages: Message[],
  maxTokens?: number,
  systemPrompt?: string
): Promise<APIResponse> {
  const response = await this.anthropic.messages.create({
    // ...
  });

  return {
    message: this.convertToMessage(response),
    usage: response.usage, // ✅ 提取真实 usage
  };
}
```

#### 步骤 2: 在 ConversationTurn 中保存真实 Usage

**文件**: `src/context/index.ts`

```typescript
export interface ConversationTurn {
  user: Message;
  assistant: Message;
  timestamp: number;

  // ✅ 添加真实 usage
  apiUsage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  tokenEstimate: number; // 保留估算值作为后备
  originalTokens: number;
  summarized?: boolean;
  summary?: string;
}

// ✅ 修改 addTurn 方法
addTurn(user: Message, assistant: Message, apiUsage?: TokenUsage): void {
  const turn: ConversationTurn = {
    user,
    assistant,
    timestamp: Date.now(),
    apiUsage,
    tokenEstimate: this.estimateTurnTokens(user, assistant),
    originalTokens: this.estimateTurnTokens(user, assistant),
  };

  this.turns.push(turn);
  this.maybeCompress();
}

// ✅ 使用真实 tokens
getUsedTokens(): number {
  let total = estimateTokens(this.systemPrompt);

  for (const turn of this.turns) {
    if (turn.summarized && turn.summary) {
      total += estimateTokens(turn.summary);
    } else if (turn.apiUsage) {
      // 优先使用真实 tokens
      total +=
        turn.apiUsage.input_tokens +
        (turn.apiUsage.cache_creation_input_tokens ?? 0) +
        (turn.apiUsage.cache_read_input_tokens ?? 0) +
        turn.apiUsage.output_tokens;
    } else {
      // 后备估算
      total += turn.tokenEstimate;
    }
  }

  return total;
}
```

#### 步骤 3: 实现基于 Claude API 的智能摘要

**文件**: `src/context/summarizer.ts` (新建)

```typescript
import { ClaudeClient } from '../client/client.js';
import type { ConversationTurn } from './index.js';

const SUMMARY_SYSTEM_PROMPT = `
Summarize this coding conversation in under 50 characters.
Capture the main task, key files, problems addressed, and current status.
`.trim();

/**
 * 使用 Claude API 生成智能摘要
 */
export async function generateAISummary(
  turns: ConversationTurn[],
  client: ClaudeClient,
  contextBudget: number
): Promise<string> {
  // 1. 收集消息，确保不超预算
  const collected = collectWithinBudget(turns, contextBudget);

  // 2. 格式化为对话文本
  const conversationText = formatTurnsAsText(collected.turns);

  // 3. 构建摘要请求
  const isTruncated = collected.turns.length < turns.length;
  const prompt = [
    `Please write a 5-10 word title for the following conversation:`,
    ``,
    isTruncated ? `[Last ${collected.turns.length} of ${turns.length} messages]` : '',
    ``,
    conversationText,
    ``,
    `Respond with the title for the conversation and nothing else.`,
  ]
    .filter(Boolean)
    .join('\n');

  // 4. 调用 API
  const response = await client.createMessage(
    [
      {
        role: 'user',
        content: prompt,
      },
    ],
    1024, // 摘要最多 1k tokens
    SUMMARY_SYSTEM_PROMPT
  );

  // 5. 提取文本
  const summaryText = extractTextContent(response.message);

  return summaryText;
}

/**
 * 在预算内收集消息
 */
function collectWithinBudget(
  turns: ConversationTurn[],
  budget: number
): {
  turns: ConversationTurn[];
  totalTokens: number;
} {
  const collected: ConversationTurn[] = [];
  let totalTokens = 0;
  let prevTokens: number | null = null;

  // 倒序遍历
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];

    // 获取真实 tokens 或估算
    const turnTokens = getTurnTokens(turn);

    // 计算增量
    let delta = 0;
    if (prevTokens !== null && turnTokens > 0 && turnTokens < prevTokens) {
      delta = prevTokens - turnTokens;
    }

    // 检查预算
    if (totalTokens + delta > budget) {
      break;
    }

    collected.unshift(turn);
    totalTokens += delta;

    if (turnTokens > 0) {
      prevTokens = turnTokens;
    }
  }

  return { turns: collected, totalTokens };
}

/**
 * 获取 turn 的 token 数
 */
function getTurnTokens(turn: ConversationTurn): number {
  if (turn.apiUsage) {
    return (
      turn.apiUsage.input_tokens +
      (turn.apiUsage.cache_creation_input_tokens ?? 0) +
      (turn.apiUsage.cache_read_input_tokens ?? 0) +
      turn.apiUsage.output_tokens
    );
  }

  return turn.tokenEstimate;
}

/**
 * 格式化为文本
 */
function formatTurnsAsText(turns: ConversationTurn[]): string {
  const parts: string[] = [];

  for (const turn of turns) {
    const userText = extractMessageText(turn.user);
    const assistantText = extractMessageText(turn.assistant);

    parts.push(`User: ${userText}`);
    parts.push('');
    parts.push(`Claude: ${assistantText}`);
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * 提取消息文本
 */
function extractMessageText(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  const textBlocks = message.content.filter(block => block.type === 'text');
  return textBlocks
    .map(block => (block as { text: string }).text)
    .join('\n')
    .trim();
}

/**
 * 提取响应文本
 */
function extractTextContent(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  const textBlocks = message.content.filter(block => block.type === 'text');
  return textBlocks
    .map(block => (block as { text: string }).text)
    .join('\n')
    .trim();
}
```

#### 步骤 4: 实现动态上下文窗口计算

**文件**: `src/context/window.ts` (新建)

```typescript
import { getModelContextWindow } from './enhanced.js';

const SMALL_MODEL_THRESHOLD = 50000;
const RESERVE_TOKENS_LARGE = 50000;
const RESERVE_RATIO_SMALL = 0.2; // 小模型保留 20%

/**
 * 计算可用输入上下文大小
 *
 * 策略:
 * - 小模型 (≤50k): 使用 80% 作为输入空间
 * - 大模型 (>50k): 保留固定 50k 作为输出空间
 */
export function calculateAvailableContext(modelId: string): number {
  const contextWindow = getModelContextWindow(modelId);

  if (contextWindow <= SMALL_MODEL_THRESHOLD) {
    // 小模型: 80% 输入, 20% 输出
    return Math.floor(contextWindow * (1 - RESERVE_RATIO_SMALL));
  }

  // 大模型: 总大小 - 50k 输出空间
  return contextWindow - RESERVE_TOKENS_LARGE;
}

/**
 * 计算输出空间大小
 */
export function calculateOutputSpace(modelId: string): number {
  const contextWindow = getModelContextWindow(modelId);

  if (contextWindow <= SMALL_MODEL_THRESHOLD) {
    return Math.floor(contextWindow * RESERVE_RATIO_SMALL);
  }

  return RESERVE_TOKENS_LARGE;
}

/**
 * 示例:
 *
 * Claude 3.5 Sonnet (200k):
 *   - 可用输入: 200k - 50k = 150k
 *   - 输出空间: 50k
 *
 * Claude 3 Haiku (200k):
 *   - 可用输入: 200k - 50k = 150k
 *   - 输出空间: 50k
 *
 * 小模型 (48k):
 *   - 可用输入: 48k * 0.8 = 38.4k
 *   - 输出空间: 48k * 0.2 = 9.6k
 */
```

#### 步骤 5: 集成到 ContextManager

**文件**: `src/context/index.ts`

```typescript
import { generateAISummary } from './summarizer.js';
import { calculateAvailableContext } from './window.js';
import type { ClaudeClient } from '../client/client.js';

export class ContextManager {
  private client?: ClaudeClient;
  private modelId: string;

  constructor(config: ContextConfig = {}, modelId: string = 'claude-3-5-sonnet-20241022') {
    this.config = {
      maxTokens: config.maxTokens ?? calculateAvailableContext(modelId),
      reserveTokens: config.reserveTokens ?? calculateOutputSpace(modelId),
      // ...
    };
    this.modelId = modelId;
  }

  /**
   * 设置 Claude 客户端（用于 AI 摘要）
   */
  setClient(client: ClaudeClient): void {
    this.client = client;
  }

  /**
   * 添加对话轮次（带真实 usage）
   */
  addTurn(user: Message, assistant: Message, apiUsage?: TokenUsage): void {
    // 应用增量压缩
    let processedUser = user;
    let processedAssistant = assistant;

    if (this.config.enableIncrementalCompression) {
      processedUser = compressMessage(user, this.config);
      processedAssistant = compressMessage(assistant, this.config);
    }

    const turn: ConversationTurn = {
      user: processedUser,
      assistant: processedAssistant,
      timestamp: Date.now(),
      apiUsage,
      tokenEstimate: this.estimateTurnTokens(processedUser, processedAssistant),
      originalTokens: this.estimateTurnTokens(user, assistant),
    };

    this.turns.push(turn);

    // 检查是否需要压缩
    this.maybeCompress();
  }

  /**
   * 自动压缩检查（使用 AI 摘要）
   */
  private async maybeCompress(): Promise<void> {
    const threshold = this.config.maxTokens * this.config.summarizeThreshold;
    const used = this.getUsedTokens();

    if (used < threshold) {
      return;
    }

    // 标记旧消息为需要摘要
    const recentCount = this.config.keepRecentMessages;
    const toSummarize = this.turns.slice(0, -recentCount).filter(t => !t.summarized);

    if (toSummarize.length === 0) {
      return;
    }

    const beforeTokens = toSummarize.reduce((sum, t) => {
      if (t.apiUsage) {
        return sum + getTurnTokens(t);
      }
      return sum + t.tokenEstimate;
    }, 0);

    // 生成摘要
    let summary: string;
    if (this.config.enableAISummary && this.client) {
      try {
        const budget = calculateAvailableContext(this.modelId);
        summary = await generateAISummary(toSummarize, this.client, budget);
      } catch (error) {
        console.warn('AI summary failed, using simple summary:', error);
        summary = createSummary(toSummarize);
      }
    } else {
      summary = createSummary(toSummarize);
    }

    // 标记为已摘要
    for (const turn of toSummarize) {
      turn.summarized = true;
      turn.summary = summary;
    }

    const afterTokens = estimateTokens(summary);
    this.savedTokens += beforeTokens - afterTokens;
    this.compressionCount++;
  }
}

function getTurnTokens(turn: ConversationTurn): number {
  if (turn.apiUsage) {
    return (
      turn.apiUsage.input_tokens +
      (turn.apiUsage.cache_creation_input_tokens ?? 0) +
      (turn.apiUsage.cache_read_input_tokens ?? 0) +
      turn.apiUsage.output_tokens
    );
  }
  return turn.tokenEstimate;
}
```

#### 步骤 6: 集成到主循环

**文件**: `src/loop/conversationLoop.ts`

```typescript
import { ContextManager } from '../context/index.js';
import { ClaudeClient } from '../client/client.js';

export class ConversationLoop {
  private contextManager: ContextManager;
  private client: ClaudeClient;

  constructor(/* ... */) {
    const modelId = this.options.mainLoopModel || 'claude-3-5-sonnet-20241022';

    this.contextManager = new ContextManager(
      {
        enableAISummary: true,
        keepRecentMessages: 10,
        summarizeThreshold: 0.7,
        enableIncrementalCompression: true,
      },
      modelId
    );

    // ✅ 设置 client
    this.contextManager.setClient(this.client);
  }

  async run(): Promise<void> {
    // ...

    while (true) {
      // 1. 发送请求
      const response = await this.client.createMessage(
        messages,
        maxTokens,
        systemPrompt
      );

      // 2. 添加到上下文管理器（带真实 usage）
      this.contextManager.addTurn(
        userMessage,
        response.message,
        response.usage // ✅ 传入真实 usage
      );

      // 3. 检查上下文使用情况
      const usage = this.contextManager.getContextUsage();
      if (usage.percentage >= 90) {
        console.warn(`Context usage: ${usage.percentage.toFixed(1)}%`);
      }

      // ...
    }
  }
}
```

#### 步骤 7: 实现上下文溢出自动恢复

**文件**: `src/client/retryLogic.ts` (新建或添加到 client.ts)

```typescript
import { APIError } from '@anthropic-ai/sdk';

interface ContextOverflowError {
  inputTokens: number;
  maxTokens: number;
  contextLimit: number;
}

const MIN_OUTPUT_TOKENS = 3000;

/**
 * 解析上下文溢出错误
 */
export function parseContextOverflowError(error: APIError): ContextOverflowError | null {
  if (error.status !== 400 || !error.message) {
    return null;
  }

  const pattern = /input length and `max_tokens` exceed context limit: (\d+) \+ (\d+) > (\d+)/;
  const match = error.message.match(pattern);

  if (!match || match.length !== 4) {
    return null;
  }

  const inputTokens = parseInt(match[1], 10);
  const maxTokens = parseInt(match[2], 10);
  const contextLimit = parseInt(match[3], 10);

  if (isNaN(inputTokens) || isNaN(maxTokens) || isNaN(contextLimit)) {
    return null;
  }

  return {
    inputTokens,
    maxTokens,
    contextLimit,
  };
}

/**
 * 计算调整后的 max_tokens
 */
export function calculateAdjustedMaxTokens(
  overflow: ContextOverflowError,
  maxThinkingTokens: number = 0
): number | null {
  const { inputTokens, contextLimit } = overflow;

  const reserve = 1000;
  const available = Math.max(0, contextLimit - inputTokens - reserve);

  if (available < MIN_OUTPUT_TOKENS) {
    // 可用空间不足，无法恢复
    return null;
  }

  const thinking = maxThinkingTokens + 1;
  const adjusted = Math.max(MIN_OUTPUT_TOKENS, available, thinking);

  return adjusted;
}

/**
 * 在 createMessage 中使用
 */
export async function createMessageWithRetry(
  client: ClaudeClient,
  messages: Message[],
  options: {
    maxTokens?: number;
    systemPrompt?: string;
    maxThinkingTokens?: number;
    maxRetries?: number;
  }
): Promise<APIResponse> {
  const maxRetries = options.maxRetries ?? 3;
  let adjustedMaxTokens = options.maxTokens;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.createMessage(
        messages,
        adjustedMaxTokens,
        options.systemPrompt
      );
    } catch (error) {
      if (error instanceof APIError) {
        const overflow = parseContextOverflowError(error);

        if (overflow) {
          const adjusted = calculateAdjustedMaxTokens(
            overflow,
            options.maxThinkingTokens
          );

          if (adjusted === null) {
            // 无法恢复，抛出错误
            throw error;
          }

          console.warn(
            `Context overflow detected. Adjusting max_tokens from ${adjustedMaxTokens} to ${adjusted}`
          );

          adjustedMaxTokens = adjusted;

          // 重试
          continue;
        }
      }

      // 其他错误，直接抛出
      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
}
```

#### 步骤 8: 实现 Session Resume 支持

**文件**: `src/session/resume.ts` (新建)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { ConversationTurn } from '../context/index.js';
import { generateAISummary } from '../context/summarizer.js';
import type { ClaudeClient } from '../client/client.js';

const SUMMARIES_DIR = path.join(process.env.HOME || '', '.claude', 'sessions', 'summaries');

/**
 * 保存摘要到缓存
 */
export function saveSummary(sessionId: string, summary: string): void {
  if (!fs.existsSync(SUMMARIES_DIR)) {
    fs.mkdirSync(SUMMARIES_DIR, { recursive: true });
  }

  const filePath = path.join(SUMMARIES_DIR, `${sessionId}.json`);
  const data = {
    uuid: sessionId,
    summary,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 加载摘要
 */
export function loadSummary(sessionId: string): string | null {
  const filePath = path.join(SUMMARIES_DIR, `${sessionId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.summary;
  } catch {
    return null;
  }
}

/**
 * 生成并保存摘要
 */
export async function generateAndSaveSummary(
  sessionId: string,
  turns: ConversationTurn[],
  client: ClaudeClient,
  contextBudget: number
): Promise<string> {
  const summary = await generateAISummary(turns, client, contextBudget);
  saveSummary(sessionId, summary);
  return summary;
}

/**
 * 构建 resume 消息
 */
export function buildResumeMessage(summary: string, isNonInteractive: boolean = false): string {
  const base = `This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:\n${summary}.`;

  if (isNonInteractive) {
    return base;
  }

  return `${base}\nPlease continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.`;
}
```

#### 步骤 9: 实现消息历史清理

**文件**: `src/session/cleanup.ts` (新建)

```typescript
import * as fs from 'fs';
import * as path from 'path';

const CLEANUP_PERIOD_DAYS = 30;
const SESSIONS_DIR = path.join(process.env.HOME || '', '.claude', 'sessions');

/**
 * 获取清理截止日期
 */
function getCutoffDate(): Date {
  const cleanupPeriod = CLEANUP_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - cleanupPeriod);
}

/**
 * 清理目录中的过期文件
 */
function cleanDirectory(
  dir: string,
  cutoffDate: Date,
  extension: string,
  removeEmptyDir: boolean = false
): { cleaned: number; errors: number } {
  const stats = { cleaned: 0, errors: 0 };

  if (!fs.existsSync(dir)) {
    return stats;
  }

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      try {
        const stat = fs.statSync(filePath);

        if (stat.isFile() && file.endsWith(extension)) {
          if (stat.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            stats.cleaned++;
          }
        }
      } catch {
        stats.errors++;
      }
    }

    // 如果目录为空，删除目录
    if (removeEmptyDir) {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
      }
    }
  } catch {
    stats.errors++;
  }

  return stats;
}

/**
 * 清理所有过期数据
 */
export function cleanupExpiredData(): void {
  const cutoffDate = getCutoffDate();
  const stats = {
    sessions: 0,
    summaries: 0,
    errors: 0,
  };

  // 清理 session 文件
  if (fs.existsSync(SESSIONS_DIR)) {
    const sessionDirs = fs.readdirSync(SESSIONS_DIR);

    for (const sessionDir of sessionDirs) {
      const sessionPath = path.join(SESSIONS_DIR, sessionDir);

      if (!fs.statSync(sessionPath).isDirectory()) {
        continue;
      }

      const result = cleanDirectory(sessionPath, cutoffDate, '.jsonl', true);
      stats.sessions += result.cleaned;
      stats.errors += result.errors;
    }
  }

  // 清理摘要文件
  const summariesDir = path.join(SESSIONS_DIR, 'summaries');
  const summaryResult = cleanDirectory(summariesDir, cutoffDate, '.json', true);
  stats.summaries += summaryResult.cleaned;
  stats.errors += summaryResult.errors;

  console.log(
    `Cleanup complete: ${stats.sessions} sessions, ${stats.summaries} summaries removed. ${stats.errors} errors.`
  );
}

/**
 * 启动时自动清理（异步）
 */
export function scheduleCleanup(): void {
  // 延迟执行，避免影响启动速度
  setImmediate(() => {
    try {
      cleanupExpiredData();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }).unref();
}
```

#### 步骤 10: 在入口文件中启用清理

**文件**: `src/cli.ts`

```typescript
import { scheduleCleanup } from './session/cleanup.js';

async function main() {
  // 启动时自动清理过期数据
  scheduleCleanup();

  // ... 其他初始化代码
}
```

### 完整集成示例

**文件**: `src/main.ts` (示例)

```typescript
import { ConversationLoop } from './loop/conversationLoop.js';
import { ClaudeClient } from './client/client.js';
import { ContextManager } from './context/index.js';
import { calculateAvailableContext } from './context/window.js';
import { scheduleCleanup } from './session/cleanup.js';

async function main() {
  // 1. 启动时清理
  scheduleCleanup();

  // 2. 创建 client
  const client = new ClaudeClient({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  // 3. 创建上下文管理器
  const modelId = 'claude-3-5-sonnet-20241022';
  const contextManager = new ContextManager(
    {
      maxTokens: calculateAvailableContext(modelId),
      enableAISummary: true,
      keepRecentMessages: 10,
      summarizeThreshold: 0.7,
      enableIncrementalCompression: true,
    },
    modelId
  );

  // 4. 设置 client
  contextManager.setClient(client);

  // 5. 创建对话循环
  const loop = new ConversationLoop({
    client,
    contextManager,
    // ...
  });

  // 6. 运行
  await loop.run();
}

main().catch(console.error);
```

---

## 参考行号

### 官方源码 (cli.js)

#### Token 估算
- **gK()**: 累加 tokens (搜索结果中多次出现)
- **GSA()**: 计算总 tokens (input + cache + output)
- **jo()**: 提取 API usage
- **FY2()**: 获取输出 tokens
- **EY2()**: 获取完整 usage
- **c71()**: 检查是否超 200k

#### 上下文窗口
- **NO()**: 获取模型上下文窗口
- **kW7()**: 计算可用上下文 (约 4858 行附近)
- **rH9 = 50000**: 保留空间常量

#### 摘要生成
- **fW7()**: 生成对话摘要 (cli.js:4858-4950)
- **bW7()**: 格式化消息为文本
- **vW7**: 摘要系统提示词

#### Session Resume
- **l71()**: 构建 resume 消息 (cli.js:1543)
- **dW7()**: 检查是否有摘要
- **gW7()**: 列出 session 文件
- **uW7()**: 构建对话链
- **mW7()**: 获取顶层对话

#### 清理逻辑
- **yfA()**: 获取清理截止日期
- **_W7()**: 清理错误日志
- **jW7()**: 清理 session 文件
- **nH9()**: 清理目录 (cli.js:1688+)

#### 上下文溢出
- **VY2()**: 解析溢出错误
- **d71()**: 重试循环（包含动态调整）
- **lY0 = 3000**: 最小输出 tokens

### 本项目

#### 已实现
- `src/context/index.ts:74-102`: estimateTokens()
- `src/context/index.ts:446-840`: ContextManager
- `src/context/index.ts:184-233`: compressToolOutput()
- `src/context/enhanced.ts:31-77`: MODEL_CONTEXT_WINDOWS
- `src/context/enhanced.ts:102-202`: ContextWindowManager

#### 需要新建
- `src/context/summarizer.ts`: AI 摘要生成
- `src/context/window.ts`: 动态窗口计算
- `src/client/retryLogic.ts`: 溢出恢复
- `src/session/resume.ts`: Session resume
- `src/session/cleanup.ts`: 自动清理

---

## 总结

### 核心差距

1. **Token 估算**: 本项目仅使用启发式估算，官方从 API response 提取真实 usage
2. **智能摘要**: 本项目缺少基于 Claude API 的摘要生成
3. **动态窗口**: 本项目未根据模型动态调整保留空间
4. **溢出恢复**: 本项目完全缺失自动调整 max_tokens 的逻辑
5. **Session Resume**: 本项目未实现摘要缓存和恢复
6. **自动清理**: 本项目未实现 30 天自动清理

### 实现优先级

1. **高优先级**:
   - 从 API response 提取真实 token 数
   - 实现动态上下文窗口计算
   - 实现上下文溢出自动恢复

2. **中优先级**:
   - 基于 Claude API 的智能摘要
   - Session Resume 支持

3. **低优先级**:
   - 自动清理逻辑

### 预计工作量

- **T-013 完整实现**: 约 8-12 小时
- **核心功能** (高优先级): 4-6 小时
- **增强功能** (中优先级): 3-4 小时
- **维护功能** (低优先级): 1-2 小时
