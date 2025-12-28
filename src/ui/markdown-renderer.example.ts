/**
 * Markdown 渲染器示例和测试
 * 展示各种 Markdown 元素的渲染效果
 */

import { renderMarkdown, renderSimpleMarkdown } from './markdown-renderer.js';

const exampleMarkdown = `
# 欢迎使用 Claude Code

这是一个**增强的 Markdown 渲染器**，支持多种特性：

## 代码块

以下是一个 TypeScript 示例：

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function greetUser(user: User): string {
  return \`Hello, \${user.name}!\`;
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com"
};

console.log(greetUser(user));
\`\`\`

Python 示例：

\`\`\`python
def fibonacci(n):
    """计算斐波那契数列"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# 计算前10项
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
\`\`\`

## 列表和格式

### 无序列表
- 支持代码高亮
- 支持表格渲染
- 支持链接和内联样式
- 支持多级标题

### 特性
- **粗体文本** 显示为加粗
- *斜体文本* 显示为斜体
- \`内联代码\` 有特殊样式
- [链接文本](https://example.com) 显示为下划线
- ~~删除线文本~~ 显示删除效果

## 内联代码

你可以使用 \`npm install\` 安装依赖，或者使用 \`git clone\` 克隆仓库。

## 引用

> 这是一个引用块
> 可以包含多行文本

---

## 表格示例

| 特性 | 状态 | 说明 |
|------|------|------|
| 代码高亮 | ✅ | 支持多种语言 |
| 表格 | ✅ | 美化的表格样式 |
| 链接 | ✅ | 支持 Markdown 链接 |
| 图片 | ❌ | 终端不支持 |

---

## JSON 示例

\`\`\`json
{
  "name": "claude-code-open",
  "version": "2.0.76",
  "description": "Open source Claude Code CLI",
  "dependencies": {
    "chalk": "^5.3.0",
    "marked": "^12.0.0",
    "ink": "^5.0.0"
  }
}
\`\`\`

## Shell 命令

\`\`\`bash
#!/bin/bash

# 构建项目
npm run build

# 运行开发服务器
npm run dev

# 查看帮助
claude --help
\`\`\`

---

这就是增强的 Markdown 渲染器的效果！
`;

// 运行示例（仅在直接运行此文件时）
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('='.repeat(80));
  console.log('完整 Markdown 渲染示例:');
  console.log('='.repeat(80));
  console.log();
  console.log(renderMarkdown(exampleMarkdown));
  console.log();
  console.log('='.repeat(80));
  console.log('简化 Markdown 渲染示例:');
  console.log('='.repeat(80));
  console.log();
  console.log(renderSimpleMarkdown(exampleMarkdown));
}

export { exampleMarkdown };
