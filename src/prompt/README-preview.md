# System Prompt Preview & Debug

提示词预览和调试工具，用于分析、比较和优化系统提示词。

## 功能概览

### 1. 提示词预览 (Preview)

生成格式化的提示词预览，包含：
- Token 数量统计
- 各部分占比分析
- 可视化进度条
- 内容预览
- 警告和建议

### 2. 差异比较 (Diff)

比较两个提示词版本的差异：
- Token 变化统计
- 逐行差异对比
- 添加/删除/修改统计
- 彩色高亮显示

### 3. 结构分析 (Analyze)

深度分析提示词结构：
- 自动识别各个部分
- 计算 token 占比
- 检测潜在问题
- 提供优化建议

## 使用方法

### 基础用法

```typescript
import { promptPreview } from './src/prompt/preview.js';

// 1. 预览提示词
const preview = promptPreview.preview(content, {
  maxLength: 500,
  showTokenCount: true,
  showSections: true,
  format: 'plain', // 'plain' | 'markdown' | 'json'
});
console.log(preview);

// 2. 分析提示词
const analysis = promptPreview.analyze(content);
console.log(`Total tokens: ${analysis.totalTokens}`);
console.log(`Sections: ${analysis.sections.length}`);
console.log(`Warnings: ${analysis.warnings.length}`);

// 3. 比较差异
const diff = promptPreview.diff(oldPrompt, newPrompt, {
  showTokenCount: true,
  highlightChanges: true,
});
console.log(diff);
```

### 与 SystemPromptBuilder 集成

```typescript
import { systemPromptBuilder } from './src/prompt/builder.js';
import { promptPreview } from './src/prompt/preview.js';
import type { PromptContext } from './src/prompt/types.js';

const context: PromptContext = {
  workingDir: '/home/user/project',
  model: 'claude-sonnet-4-5',
  permissionMode: 'default',
};

// 构建提示词
const result = await systemPromptBuilder.build(context);

// 预览分析
const preview = promptPreview.preview(result.content);
console.log(preview);

// 检查警告
const analysis = promptPreview.analyze(result.content);
if (analysis.warnings.length > 0) {
  console.log('Warnings found:');
  analysis.warnings.forEach(w => console.log(`- ${w}`));
}
```

## 预览选项

```typescript
interface PreviewOptions {
  /** 最大显示长度，0 表示不限制 */
  maxLength?: number; // 默认: 500

  /** 显示 token 数量统计 */
  showTokenCount?: boolean; // 默认: true

  /** 显示各部分标题和占比 */
  showSections?: boolean; // 默认: true

  /** 高亮变化（用于 diff） */
  highlightChanges?: boolean; // 默认: false

  /** 输出格式 */
  format?: 'plain' | 'markdown' | 'json'; // 默认: 'plain'
}
```

## 输出示例

### 预览输出

```
=============================
   System Prompt Preview
=============================
Total: 5,234 tokens (estimated)
Chars: 18,456

Sections:
  ● Core Identity: 234 tokens (4.5%) [█░░░░░░░░░░░░░░░░░░░]
  ● Tool Guidelines: 1,523 tokens (29.1%) [██████░░░░░░░░░░░░░░]
  ● CLAUDE.md: 890 tokens (17.0%) [███░░░░░░░░░░░░░░░░░░]
  ● Attachments: 2,587 tokens (49.4%) [██████████░░░░░░░░░░]

Preview:
---
You are Claude Code, Anthropic's official CLI...
---

Warnings:
  ⚠ Section "Attachments" is large (49.4%), consider trimming
  ⚠ Total tokens (5,234) is high, consider optimization

Statistics:
  Largest section: Attachments (2,587 tokens)
  Smallest section: Core Identity (234 tokens)
  Average per section: 1,309 tokens
========================================
```

### Diff 输出

```
==========================
   System Prompt Diff
==========================
Old: 4,123 tokens
New: 5,234 tokens
Diff: +1,111 tokens

Changes:
  + 15 additions (1,234 chars, ~411 tokens)
  - 3 deletions (89 chars, ~29 tokens)
  ~ 8 modifications
  = 145 unchanged lines

Details:
- [23] Old content removed
+ [24] New content added
+ [25] Another new line
========================================
```

### JSON 输出

```json
{
  "totalTokens": 5234,
  "totalChars": 18456,
  "sections": [
    {
      "name": "Core Identity",
      "tokens": 234,
      "percentage": "4.47"
    },
    {
      "name": "Tool Guidelines",
      "tokens": 1523,
      "percentage": "29.10"
    }
  ],
  "preview": "You are Claude Code...",
  "warnings": [
    "Section \"Attachments\" is large (49.4%), consider trimming"
  ],
  "stats": {
    "avgTokensPerSection": 1308.5,
    "largestSection": "Attachments",
    "smallestSection": "Core Identity"
  }
}
```

## 识别的提示词部分

预览工具会自动识别以下标准部分：

- **Core Identity** - 核心身份描述
- **Tool Guidelines** - 工具使用指南
- **Permission Mode** - 权限模式说明
- **Output Style** - 输出风格指令
- **Task Management** - 任务管理
- **Coding Guidelines** - 代码编写指南
- **Git Operations** - Git 操作
- **Subagent System** - 子代理系统
- **Environment Info** - 环境信息
- **CLAUDE.md** - 项目文档
- **Attachments** - 附件内容
- **System Reminder** - 系统提醒

## 警告检测

工具会自动检测以下问题：

1. **部分过大** - 单个部分占比超过 40%
2. **总长度过长** - 超过 100,000 tokens
3. **重复内容** - 重复行占比超过 30%

## API 参考

### PromptPreview 类

```typescript
class PromptPreview {
  /** 生成预览 */
  preview(content: string, options?: PreviewOptions): string;

  /** 比较差异 */
  diff(oldPrompt: string, newPrompt: string, options?: PreviewOptions): string;

  /** 分析结构 */
  analyze(content: string): AnalysisResult;
}
```

### 导出实例

```typescript
import { promptPreview } from './src/prompt/preview.js';

// 使用全局实例
const preview = promptPreview.preview(content);

// 或创建新实例
import { PromptPreview } from './src/prompt/preview.js';
const customPreview = new PromptPreview();
```

## 实际应用场景

### 1. 调试提示词构建

```typescript
const result = await systemPromptBuilder.build(context);
const analysis = promptPreview.analyze(result.content);

// 检查是否有警告
if (analysis.warnings.length > 0) {
  console.error('Prompt has issues:', analysis.warnings);
}

// 检查特定部分
const attachments = analysis.sections.find(s => s.name === 'Attachments');
if (attachments && attachments.tokens > 50000) {
  console.warn('Attachments section is too large!');
}
```

### 2. 版本对比

```typescript
const v1 = await buildPromptV1(context);
const v2 = await buildPromptV2(context);

const diff = promptPreview.diff(v1.content, v2.content);
console.log(diff);

// 确保没有意外删除
const diffResult = promptPreview.computeDiff(v1.content, v2.content);
if (diffResult.deletions.length > 10) {
  console.warn('Too many deletions, review changes!');
}
```

### 3. 性能优化

```typescript
const analysis = promptPreview.analyze(content);

// 找出最大的部分进行优化
const sorted = analysis.sections.sort((a, b) => b.tokens - a.tokens);
console.log('Top 3 largest sections:');
sorted.slice(0, 3).forEach(s => {
  console.log(`- ${s.name}: ${s.tokens} tokens`);
});
```

## 相关模块

- `/home/user/claude-code-open/src/prompt/builder.ts` - 系统提示词构建器
- `/home/user/claude-code-open/src/prompt/types.ts` - 类型定义
- `/home/user/claude-code-open/src/prompt/templates.ts` - 提示词模板
- `/home/user/claude-code-open/examples/prompt-preview-example.ts` - 使用示例
