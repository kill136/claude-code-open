# ToolCall 组件增强文档

## 概述

增强版 `ToolCall` 组件为 Claude Code CLI 提供了丰富的工具调用可视化功能，包括差异显示、语法高亮、输入/输出格式化等。

## 新增功能

### 1. 差异显示 (Diff View)

自动检测并高亮显示文件编辑的差异：

- ✅ **变更统计**: 显示添加/删除的行数 (e.g., `Changes: +5 -2`)
- ✅ **语法高亮**:
  - 绿色 (+) 表示新增行
  - 红色 (-) 表示删除行
  - 青色 (@@) 表示 hunk 标记
  - 灰色 (---/+++) 表示文件头
- ✅ **Unified Diff 格式**: 完整支持标准 diff 格式

### 2. 工具输入参数格式化

针对不同工具类型优化显示：

#### Edit / MultiEdit 工具
```
File: .../components/ToolCall.tsx
Replacing 42 chars...
```

#### Bash 工具
```
$ npm run build
```

#### Read / Write 工具
```
Reading: .../package.json
Writing 1024 chars to .../config.json
```

#### Grep / Glob 工具
```
Pattern: "TODO" in *.ts
```

### 3. 工具输出格式化

- **智能截断**: 超过 120 字符的行自动截断
- **分页显示**: 超过 10 行的输出支持展开/折叠
- **差异检测**: 自动识别并美化 diff 输出

### 4. 错误状态显示

- 红色高亮错误信息
- 多行错误信息自动格式化
- 清晰的错误堆栈显示

### 5. 执行时间显示

- 毫秒显示: `125ms`
- 秒级显示: `2.35s`
- 运行中状态: `running...`

### 6. 状态图标

- ⏳ **运行中**: 动画 Spinner
- ✓ **成功**: 绿色勾号
- ✗ **失败**: 红色叉号

## 使用示例

### 基础用法

```tsx
import { ToolCall } from './ui/components/ToolCall.js';

<ToolCall
  name="Read"
  status="success"
  input={{ file_path: "/path/to/file.ts" }}
  result="File content here..."
  duration={125}
/>
```

### 显示编辑差异

```tsx
<ToolCall
  name="Edit"
  status="success"
  input={{
    file_path: "/src/components/Button.tsx",
    old_string: "const x = 1",
    new_string: "const x = 2"
  }}
  result={`Changes: +1 -1
────────────────────────────────────────────────────────────
--- a/Button.tsx
+++ b/Button.tsx
@@ -10,1 +10,1 @@
-const x = 1
+const x = 2
────────────────────────────────────────────────────────────`}
  duration={45}
/>
```

### 显示错误

```tsx
<ToolCall
  name="Edit"
  status="error"
  input={{ file_path: "/src/app.ts" }}
  error="File not found: /src/app.ts"
  duration={12}
/>
```

### 运行中状态

```tsx
<ToolCall
  name="Bash"
  status="running"
  input={{ command: "npm install" }}
/>
```

## Props 接口

```typescript
interface ToolCallProps {
  name: string;                           // 工具名称
  status: 'running' | 'success' | 'error'; // 执行状态
  input?: Record<string, unknown>;         // 输入参数
  result?: string;                         // 输出结果
  error?: string;                          // 错误信息
  duration?: number;                       // 执行时间 (ms)
  expanded?: boolean;                      // 初始展开状态
}
```

## 内部组件

### DiffView

专门用于渲染 diff 输出的组件：

```tsx
const DiffView: React.FC<{ output: string }> = ({ output }) => {
  // 自动解析并高亮 diff 内容
  // 支持多个 hunk
  // 颜色编码的添加/删除行
}
```

### InputDisplay

智能格式化工具输入参数：

```tsx
const InputDisplay: React.FC<{
  input: Record<string, unknown>;
  toolName: string
}> = ({ input, toolName }) => {
  // 根据工具类型自定义显示格式
  // 支持 Edit, Read, Write, Bash, Grep, Glob 等
}
```

### OutputDisplay

格式化输出内容，支持展开/折叠：

```tsx
const OutputDisplay: React.FC<{
  output: string;
  expanded: boolean;
  onToggle: () => void
}> = ({ output, expanded, onToggle }) => {
  // 自动检测 diff
  // 智能截断长输出
  // 提供展开/折叠功能
}
```

### ErrorDisplay

专门用于显示错误信息：

```tsx
const ErrorDisplay: React.FC<{ error: string }> = ({ error }) => {
  // 红色高亮
  // 多行错误格式化
}
```

## 辅助函数

### containsDiff()

检测字符串是否包含 diff 内容：

```typescript
function containsDiff(output: string): boolean
```

### parseDiffLine()

解析单行 diff 并返回颜色信息：

```typescript
function parseDiffLine(line: string): { text: string; color: string }
```

### extractDiffSections()

将 diff 输出分解为结构化的部分：

```typescript
function extractDiffSections(output: string): DiffSection[]

interface DiffSection {
  type: 'header' | 'stats' | 'diff' | 'separator';
  content: string;
}
```

### formatFilePath()

格式化文件路径，对长路径进行截断：

```typescript
function formatFilePath(input: Record<string, unknown>): string | null
// "/very/long/path/to/file.tsx" => ".../to/file.tsx"
```

## 颜色方案

| 元素 | 颜色 | 用途 |
|------|------|------|
| 成功图标 | 绿色 | 工具执行成功 |
| 错误图标 | 红色 | 工具执行失败 |
| 运行中图标 | 青色 | 工具正在运行 |
| 工具名称 | 根据状态 | 动态颜色 |
| 执行时间 | 灰色 | 性能指标 |
| 文件路径 | 青色 | 文件引用 |
| Bash 命令 | 黄色 | 命令高亮 |
| Grep 模式 | 品红 | 搜索模式 |
| Diff (+) | 绿色 | 新增内容 |
| Diff (-) | 红色 | 删除内容 |
| Diff 统计 | 黄色 | 变更摘要 |

## 展开/折叠功能

组件内置展开/折叠状态管理：

- 超过 10 行的输出默认折叠
- 提供"... N more lines"提示
- 通过 `expanded` prop 控制初始状态
- 使用 `useState` 管理运行时状态

## 性能优化

- 使用 `React.FC` 类型提供类型安全
- 子组件拆分减少重渲染
- 智能截断避免渲染超长内容
- 条件渲染减少 DOM 节点

## 与官方 CLI 的差异

增强版相比官方 CLI 的改进：

1. ✅ **更智能的输入显示**: 针对每种工具类型定制显示
2. ✅ **完整的 diff 高亮**: 支持多 hunk、统计信息
3. ✅ **更好的错误处理**: 结构化错误显示
4. ✅ **性能指标**: 清晰的时间格式化
5. ✅ **模块化设计**: 子组件可独立复用

## 未来增强方向

- [ ] 复制到剪贴板功能 (需要终端支持)
- [ ] 更丰富的语法高亮 (集成 tree-sitter)
- [ ] 交互式 diff 浏览 (上下翻页)
- [ ] 工具调用历史记录
- [ ] 性能分析可视化

## 兼容性

- ✅ React 18+
- ✅ Ink 5.0+
- ✅ Node.js 18+
- ✅ 所有主流终端 (支持 ANSI 颜色)

## 相关文件

- 源代码: `/home/user/claude-code-open/src/ui/components/ToolCall.tsx`
- Spinner 组件: `/home/user/claude-code-open/src/ui/components/Spinner.tsx`
- 类型定义: `/home/user/claude-code-open/src/types/index.ts`
