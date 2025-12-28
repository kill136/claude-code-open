#!/usr/bin/env tsx
/**
 * 测试 Markdown 渲染效果
 */

import { renderMarkdown } from './src/ui/markdown-renderer.js';

const testMarkdown = `
# 测试 Markdown 渲染

## 代码块测试

TypeScript 示例：

\`\`\`typescript
interface Config {
  apiKey: string;
  model: string;
}

const config: Config = {
  apiKey: "sk-xxx",
  model: "claude-sonnet-4-5"
};
\`\`\`

## 列表测试

功能特性：
- **代码高亮** - 支持 40+ 种语言
- **表格渲染** - 美化的表格边框
- **内联样式** - 粗体、斜体、代码等
- [链接支持](https://claude.ai)

## 表格测试

| 工具 | 版本 | 状态 |
|------|------|------|
| marked | 12.0.0 | ✅ |
| chalk | 5.3.0 | ✅ |
| cli-highlight | 2.1.11 | ✅ |

## 内联样式测试

这是一段包含 **粗体**、*斜体*、\`代码\` 和 ~~删除线~~ 的文本。

---

渲染完成！
`;

console.log('='.repeat(80));
console.log('Markdown 渲染测试');
console.log('='.repeat(80));
console.log();
console.log(renderMarkdown(testMarkdown));
console.log();
console.log('='.repeat(80));
