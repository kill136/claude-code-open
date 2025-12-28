# Markdown 渲染改进文档

## 概述

本次更新显著增强了 Claude Code CLI 的终端 Markdown 渲染效果，参考了官方 @anthropic-ai/claude-code 的实现，提供了更加美观和功能丰富的显示效果。

## 改进内容

### 1. 新增增强的 Markdown 渲染器 (`src/ui/markdown-renderer.ts`)

#### 主要特性：

- **代码块渲染**
  - 使用 `cli-highlight` 进行语法高亮
  - 支持 40+ 种编程语言
  - 美化的边框和语言标签
  - 自定义颜色主题，优化终端显示

- **表格渲染**
  - 使用 Unicode 字符绘制表格边框（┌ ┬ ┐ ├ ┼ ┤ └ ┴ ┘）
  - 支持左对齐、右对齐、居中对齐
  - 自动计算列宽
  - 表头加粗显示

- **标题渲染**
  - 一级标题：加粗 + 下划线
  - 二级标题：彩色加粗
  - 三级及以下：加粗

- **列表渲染**
  - 使用彩色项目符号（•）
  - 支持内联 Markdown 样式

- **内联样式**
  - **粗体** - 使用 chalk.bold
  - *斜体* - 使用 chalk.italic
  - `代码` - 黄色高亮背景
  - [链接](url) - 蓝色下划线 + 灰色 URL
  - ~~删除线~~ - 使用 chalk.strikethrough

- **引用块**
  - 灰色侧边框（│）
  - 斜体文本

- **分隔线**
  - 使用 ─ 字符绘制

### 2. 更新 Message 组件 (`src/ui/components/Message.tsx`)

- 集成新的 Markdown 渲染器
- 使用 `parseMarkdown()` 解析 Markdown 内容
- 使用 `renderBlock()` 渲染各种 Markdown 元素
- 保持了原有的流式渲染和时间戳功能

### 3. 已有的语法高亮工具 (`src/ui/utils/syntaxHighlight.ts`)

项目已经包含了完善的语法高亮工具：

- 支持 40+ 种编程语言
- 语言别名映射（如 ts → typescript）
- 文件扩展名检测
- 内容智能检测
- 自定义颜色主题
- 行号支持
- ANSI 颜色处理

## 使用示例

### 基础用法

```typescript
import { renderMarkdown } from './ui/markdown-renderer.js';

const markdown = `
# 标题

这是一段文本，包含 **粗体** 和 *斜体*。

\`\`\`typescript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

- 列表项 1
- 列表项 2
`;

console.log(renderMarkdown(markdown));
```

### 在 Message 组件中使用

```typescript
<Message
  role="assistant"
  content="# Hello\n\nThis is **formatted** text."
  timestamp={new Date()}
/>
```

## 渲染效果示例

### 代码块

```
  typescript
  ┌──────────────────────────────────────┐
  │ interface User {                     │
  │   id: number;                        │
  │   name: string;                      │
  │ }                                    │
  └──────────────────────────────────────┘
```

### 表格

```
  ┌──────────┬────────┬──────────────┐
  │ 特性     │ 状态   │ 说明         │
  ├──────────┼────────┼──────────────┤
  │ 代码高亮 │ ✅     │ 支持多种语言 │
  │ 表格     │ ✅     │ 美化的样式   │
  └──────────┴────────┴──────────────┘
```

### 列表

```
  • 第一项
  • 第二项
  • 第三项
```

## 技术栈

- **marked** (v12.0.0) - Markdown 解析
- **chalk** (v5.3.0) - 终端颜色
- **cli-highlight** (v2.1.11) - 代码语法高亮
- **ink** (v5.0.0) - React 终端 UI

## 对比官方实现

### 相同点
- 使用 `marked` 库解析 Markdown
- 使用 `chalk` 处理终端颜色
- 支持代码高亮、表格、列表等元素

### 增强点
- 更美观的代码块边框（使用 Unicode 字符）
- 更丰富的颜色主题
- 更完善的内联样式支持
- 独立的渲染器模块，易于测试和维护

## 文件清单

### 新增文件
- `/home/user/claude-code-open/src/ui/markdown-renderer.ts` - 增强的 Markdown 渲染器
- `/home/user/claude-code-open/src/ui/markdown-renderer.example.ts` - 渲染示例

### 修改文件
- `/home/user/claude-code-open/src/ui/components/Message.tsx` - 集成新渲染器

### 已存在文件（未修改）
- `/home/user/claude-code-open/src/ui/utils/syntaxHighlight.ts` - 语法高亮工具

## 测试

运行示例查看渲染效果：

```bash
# 构建项目
npm run build

# 运行 Markdown 渲染示例
tsx src/ui/markdown-renderer.example.ts
```

## 未来改进方向

1. **性能优化**
   - 缓存解析结果
   - 懒加载大型代码块

2. **功能增强**
   - 支持任务列表（- [ ] Todo）
   - 支持脚注
   - 支持数学公式（有限支持）

3. **可配置性**
   - 允许用户自定义颜色主题
   - 允许调整表格样式
   - 代码块行号可选

4. **测试覆盖**
   - 单元测试
   - 视觉回归测试

## 兼容性

- Node.js >= 18.0.0
- 支持的终端：
  - macOS Terminal
  - iTerm2
  - Windows Terminal
  - Linux 终端（支持 Unicode）

## 参考资料

- [marked 文档](https://marked.js.org/)
- [chalk 文档](https://github.com/chalk/chalk)
- [cli-highlight 文档](https://github.com/felixfbecker/cli-highlight)
- [官方 Claude Code](https://github.com/anthropics/claude-code)
