# 语法高亮功能说明

## 概述

本项目集成了强大的代码语法高亮功能，使用 `cli-highlight` 库为终端输出提供丰富的颜色高亮。

## 功能特性

### 1. 支持的编程语言

- **前端**: TypeScript, JavaScript, JSX, TSX, HTML, CSS, SCSS, LESS
- **后端**: Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, Scala
- **数据**: JSON, YAML, XML, TOML, INI
- **脚本**: Bash, Shell, PowerShell
- **其他**: SQL, Markdown, GraphQL, Protocol Buffers, Dockerfile, Makefile

总计支持 **40+ 种编程语言**。

### 2. 核心功能

#### 基础高亮
```typescript
import { highlightCode } from './ui/utils/syntaxHighlight.js';

const code = `
function hello(name: string) {
  console.log(\`Hello, \${name}!\`);
}
`;

const highlighted = highlightCode(code, { language: 'typescript' });
console.log(highlighted);
```

#### 带行号的代码块
```typescript
import { highlightBlock } from './ui/utils/syntaxHighlight.js';

const highlighted = highlightBlock(code, 'typescript', 1);
// 输出:
//  1 │ function hello(name: string) {
//  2 │   console.log(`Hello, ${name}!`);
//  3 │ }
```

#### JSON 高亮
```typescript
import { highlightJSON } from './ui/utils/syntaxHighlight.js';

const data = { name: 'Claude', version: '2.0.76' };
const highlighted = highlightJSON(data, true); // true = 美化输出
console.log(highlighted);
```

#### 智能语言检测
```typescript
import { smartHighlight, detectLanguageFromFilename } from './ui/utils/syntaxHighlight.js';

// 从文件名检测语言
const lang = detectLanguageFromFilename('app.py'); // 'python'

// 自动检测并高亮
const highlighted = smartHighlight(code, 'main.ts');
```

### 3. 颜色主题

自定义终端优化主题，支持以下语法元素：

- **关键字** (cyan): `function`, `class`, `if`, `for`, etc.
- **字符串** (green): `"hello"`, `'world'`
- **数字** (magenta): `42`, `3.14`
- **注释** (gray): `// comment`, `/* block */`
- **函数名** (yellow): `myFunction()`
- **类型** (cyan): `string`, `number`, `boolean`
- **运算符** (white): `+`, `-`, `*`, `=`

## 集成位置

### 1. Message 组件

位置: `src/ui/components/Message.tsx`

自动对消息中的代码块进行语法高亮：

```markdown
\`\`\`typescript
const hello = () => console.log('Hello!');
\`\`\`
```

### 2. ToolCall 组件

位置: `src/ui/components/ToolCall.tsx`

工具调用输出中的代码自动高亮：
- JSON 输出
- 代码片段
- 配置文件

### 3. Markdown 渲染器

位置: `src/ui/markdown-renderer.ts`

完整的 Markdown 渲染支持，包括：
- 代码块高亮
- 表格渲染
- 标题样式
- 列表格式
- 引用块
- 内联代码

## 使用示例

### 在 UI 组件中使用

```typescript
import { highlightCode } from '../utils/syntaxHighlight.js';

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const highlighted = React.useMemo(
    () => highlightCode(code, { language: lang }),
    [code, lang]
  );

  return (
    <Box>
      {highlighted.split('\n').map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
};
```

### 在工具中使用

```typescript
import { highlightJSON, smartHighlight } from '../ui/utils/syntaxHighlight.js';

// 高亮 JSON 结果
const result = { success: true, data: [...] };
console.log(highlightJSON(result));

// 高亮代码文件内容
const fileContent = readFileSync('app.ts', 'utf-8');
console.log(smartHighlight(fileContent, 'app.ts'));
```

## API 参考

### highlightCode(code, options?)

高亮代码字符串。

**参数:**
- `code: string` - 要高亮的代码
- `options?: HighlightOptions` - 高亮选项
  - `language?: string` - 语言类型
  - `ignoreIllegals?: boolean` - 忽略非法语法 (默认: true)
  - `lineNumbers?: boolean` - 显示行号 (默认: false)
  - `startLine?: number` - 起始行号 (默认: 1)

**返回:** `string` - 高亮后的代码

### highlightBlock(code, language?, startLine?)

高亮代码块（带行号）。

**参数:**
- `code: string` - 要高亮的代码
- `language?: string` - 语言类型
- `startLine?: number` - 起始行号 (默认: 1)

**返回:** `string` - 高亮后的代码（带行号）

### highlightJSON(data, pretty?)

高亮 JSON 数据。

**参数:**
- `data: unknown` - JSON 数据
- `pretty?: boolean` - 是否美化输出 (默认: true)

**返回:** `string` - 高亮后的 JSON 字符串

### smartHighlight(code, hint?)

智能高亮（自动检测语言）。

**参数:**
- `code: string` - 要高亮的代码
- `hint?: string` - 语言提示（文件名或语言名）

**返回:** `string` - 高亮后的代码

### detectLanguageFromFilename(filename)

从文件名检测编程语言。

**参数:**
- `filename: string` - 文件名

**返回:** `string` - 检测到的语言类型

### normalizeLanguage(lang?)

规范化语言名称（处理别名）。

**参数:**
- `lang?: string` - 语言名称或别名

**返回:** `string` - 规范化的语言名称

### stripAnsiColors(text)

移除 ANSI 颜色代码。

**参数:**
- `text: string` - 包含 ANSI 代码的文本

**返回:** `string` - 纯文本

### hasAnsiColors(text)

检测文本是否包含 ANSI 颜色代码。

**参数:**
- `text: string` - 要检测的文本

**返回:** `boolean` - 是否包含 ANSI 代码

## 性能优化

1. **缓存高亮结果**: 使用 `React.useMemo` 缓存高亮结果，避免重复计算
2. **按需加载**: 只在需要时才进行语法高亮
3. **错误容错**: 高亮失败时返回原始代码，不影响显示

## 扩展语言支持

要添加新的语言支持：

1. 在 `SUPPORTED_LANGUAGES` 数组中添加语言名称
2. 在 `LANGUAGE_ALIASES` 中添加常见别名
3. 在 `detectLanguageFromFilename` 的 `extensionMap` 中添加文件扩展名映射
4. 在 `detectLanguageFromContent` 中添加语法特征检测（可选）

示例：

```typescript
// 1. 添加语言
export const SUPPORTED_LANGUAGES = [
  // ...
  'dart',
] as const;

// 2. 添加别名
const LANGUAGE_ALIASES: Record<string, string> = {
  // ...
  'd': 'dart',
};

// 3. 添加扩展名映射
const extensionMap: Record<string, string> = {
  // ...
  'dart': 'dart',
};
```

## 测试

运行语法高亮示例：

```bash
npx tsx src/ui/utils/syntaxHighlight.example.ts
```

## 相关文件

- `src/ui/utils/syntaxHighlight.ts` - 核心语法高亮模块
- `src/ui/utils/syntaxHighlight.example.ts` - 使用示例
- `src/ui/markdown-renderer.ts` - Markdown 渲染器（集成语法高亮）
- `src/ui/components/Message.tsx` - 消息组件（使用语法高亮）
- `src/ui/components/ToolCall.tsx` - 工具调用组件（使用语法高亮）

## 依赖

- `cli-highlight` ^4.0.0 - 终端代码高亮库
- `chalk` ^5.3.0 - 终端颜色库

## 常见问题

### Q: 如何禁用语法高亮？

A: 使用 `highlightCode` 时不传 `language` 参数，或传入 `'text'`。

### Q: 如何自定义颜色主题？

A: 修改 `syntaxHighlight.ts` 中的 `THEME_COLORS` 对象。

### Q: 某种语言没有正确高亮怎么办？

A: 检查语言名称是否正确，参考 `SUPPORTED_LANGUAGES` 列表。如果语言不支持，可以提交 issue。

### Q: 如何在非 React 环境中使用？

A: 直接导入并调用 `highlightCode` 等函数即可，不依赖 React。

## 更新日志

### v2.0.76
- ✅ 集成 cli-highlight 库
- ✅ 创建语法高亮工具模块
- ✅ 支持 40+ 种编程语言
- ✅ 更新 Message 组件
- ✅ 更新 ToolCall 组件
- ✅ 更新 Markdown 渲染器
- ✅ 添加智能语言检测
- ✅ 添加完整的文档和示例
