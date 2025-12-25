# DiffView Component

一个功能完整的文件差异对比组件，用于在终端中显示文件的变更。支持统一视图（unified）和并排视图（side-by-side）两种显示模式。

## 特性

- ✅ **两种显示模式**: 统一视图（类似 git diff）和并排视图（左右对比）
- ✅ **行号显示**: 可选的行号显示功能
- ✅ **智能差异算法**: 基于 LCS（最长公共子序列）的 Myers diff 算法
- ✅ **上下文控制**: 可配置的上下文行数
- ✅ **颜色高亮**:
  - 🟢 绿色表示新增行
  - 🔴 红色表示删除行
  - 🔵 蓝色/青色表示修改行
- ✅ **Hunk 分组**: 自动将变更分组为 hunks（变更块）
- ✅ **性能优化**: 支持大文件，带行截断功能
- ✅ **TypeScript**: 完整的类型定义

## 安装

组件已集成在项目中，无需额外安装。

```typescript
import { DiffView } from './ui/components/DiffView';
```

## 基本用法

### 统一视图（Unified Diff）

```typescript
import React from 'react';
import { DiffView } from './ui/components/DiffView';

function MyComponent() {
  const oldContent = `function hello() {
  console.log('Hello World');
}`;

  const newContent = `function hello(name) {
  console.log('Hello ' + name);
}`;

  return (
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName="hello.js"
      mode="unified"
    />
  );
}
```

### 并排视图（Side-by-Side）

```typescript
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  fileName="example.js"
  mode="side-by-side"
  maxWidth={140}
/>
```

## API 文档

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `oldContent` | `string` | **必需** | 原始内容 |
| `newContent` | `string` | **必需** | 修改后的内容 |
| `fileName` | `string` | `undefined` | 文件名（显示在顶部） |
| `mode` | `'unified' \| 'side-by-side'` | `'unified'` | 显示模式 |
| `contextLines` | `number` | `3` | 显示的上下文行数 |
| `showLineNumbers` | `boolean` | `true` | 是否显示行号 |
| `language` | `string` | `undefined` | 编程语言（预留，用于语法高亮） |
| `maxWidth` | `number` | `120` | 最大显示宽度（字符数） |

### 类型定义

```typescript
export interface DiffViewProps {
  oldContent: string;
  newContent: string;
  fileName?: string;
  mode?: 'side-by-side' | 'unified';
  contextLines?: number;
  showLineNumbers?: boolean;
  language?: string;
  maxWidth?: number;
}
```

## 显示模式对比

### Unified Mode（统一视图）

```
File: example.js
+3 -1 (2 changes)

@@ -1,3 +1,5 @@
   1    1  function hello() {
-  2        console.log('Hello World');
+       2  console.log('Hello ' + name);
+       3  console.log('Welcome!');
   3    4  }
```

**优点:**
- 节省垂直空间
- 更接近传统的 git diff 格式
- 适合在窄终端中显示

**缺点:**
- 修改的行需要显示两次（删除+新增）
- 对比不如并排视图直观

### Side-by-Side Mode（并排视图）

```
File: example.js
+3 -1 (2 changes)

Original                          │ Modified
─────────────────────────────────────────────────────────

@@ -1,3 +1,5 @@

   1  function hello() {          │    1  function hello() {
   2  console.log('Hello World'); │    2  console.log('Hello ' + name);
                                   │    3  console.log('Welcome!');
   3  }                            │    4  }
```

**优点:**
- 直观的左右对比
- 容易看出修改的具体位置
- 修改的行在同一行显示

**缺点:**
- 需要更宽的终端
- 占用更多垂直空间

## 高级用法

### 配置上下文行数

```typescript
// 显示更多上下文（适合大文件）
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  contextLines={10}
/>

// 只显示变更行，不显示上下文
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  contextLines={0}
/>
```

### 隐藏行号

```typescript
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  showLineNumbers={false}
/>
```

### 控制显示宽度

```typescript
// 适应小终端
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  maxWidth={80}
/>

// 宽终端显示更多内容
<DiffView
  oldContent={oldContent}
  newContent={newContent}
  maxWidth={160}
  mode="side-by-side"
/>
```

## 使用场景

### 1. 文件编辑预览

在 Edit 工具中使用，让用户在应用编辑前查看差异：

```typescript
import { DiffView } from '../ui/components/DiffView';
import { render } from 'ink';

async function previewEdit(filePath: string, oldContent: string, newContent: string) {
  // 显示差异
  const { waitUntilExit } = render(
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName={filePath}
      mode="unified"
    />
  );

  await waitUntilExit();

  // 询问用户是否应用
  const shouldApply = await confirm('Apply these changes?');
  return shouldApply;
}
```

### 2. Git 差异展示

```typescript
import { execSync } from 'child_process';

function showGitDiff(filePath: string) {
  const oldContent = execSync(`git show HEAD:${filePath}`).toString();
  const newContent = fs.readFileSync(filePath, 'utf-8');

  return (
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName={filePath}
      mode="unified"
    />
  );
}
```

### 3. 配置文件对比

```typescript
function compareConfigs() {
  const devConfig = fs.readFileSync('config/dev.json', 'utf-8');
  const prodConfig = fs.readFileSync('config/prod.json', 'utf-8');

  return (
    <DiffView
      oldContent={devConfig}
      newContent={prodConfig}
      fileName="Configuration Diff: dev vs prod"
      mode="side-by-side"
      language="json"
    />
  );
}
```

### 4. 代码重构对比

```typescript
function showRefactoringDiff(className: string, oldCode: string, newCode: string) {
  return (
    <DiffView
      oldContent={oldCode}
      newContent={newCode}
      fileName={`Refactoring: ${className}`}
      mode="side-by-side"
      language="typescript"
      contextLines={5}
    />
  );
}
```

## 实现细节

### Diff 算法

组件使用基于动态规划的最长公共子序列（LCS）算法来计算差异：

1. **LCS 计算**: 使用二维 DP 表找出两个文件的最长公共子序列
2. **回溯构建**: 从 DP 表中回溯构建实际的 LCS
3. **差异识别**: 通过比较原文件、新文件和 LCS，识别出：
   - 删除的行（在旧文件中但不在 LCS 中）
   - 新增的行（在新文件中但不在 LCS 中）
   - 修改的行（位置对应但内容不同）
   - 上下文行（未改变的行）

### Hunk 分组

为了提高可读性，相邻的变更会被分组为 hunks：

- 变更之间的上下文行少于 `contextLines * 2` 时，会被合并到同一个 hunk
- 每个 hunk 显示头部信息：`@@ -oldStart,oldLines +newStart,newLines @@`
- Hunk 之间用空行分隔

### 性能优化

- **行截断**: 超过 `maxWidth` 的行会被截断并添加 `...`
- **懒加载**: 使用 React 的 `useMemo` 缓存计算结果
- **智能上下文**: 只显示必要的上下文行，减少输出

## 颜色方案

组件使用以下颜色方案（基于 Ink 和 Chalk）：

- **新增行**: `color="green"` + `backgroundColor="rgb(20,70,20)"`
- **删除行**: `color="red"` + `backgroundColor="rgb(70,20,20)"`
- **行号**: `color="gray"` + `dimColor`
- **Hunk 头**: `color="cyan"` + `bold`
- **上下文**: 默认颜色

## 限制和已知问题

1. **语法高亮**:
   - 当前版本的 `language` 属性是预留的
   - 未来版本将集成 tree-sitter 进行语法高亮

2. **大文件性能**:
   - 对于超过 10,000 行的文件，diff 计算可能较慢
   - 建议增加 `contextLines` 来减少显示的内容

3. **Unicode 字符**:
   - 宽字符（如中文、emoji）可能影响对齐
   - `maxWidth` 计算基于字符数而非显示宽度

4. **终端兼容性**:
   - 背景色在某些终端中可能不显示
   - 建议使用支持 24-bit 颜色的现代终端

## 未来改进

- [ ] 集成 tree-sitter 实现语法高亮
- [ ] 支持字符级（word-level）diff
- [ ] 添加展开/折叠功能
- [ ] 支持搜索和高亮
- [ ] 添加复制功能（复制到剪贴板）
- [ ] 支持主题自定义
- [ ] 优化大文件性能（虚拟滚动）
- [ ] 支持分页显示

## 贡献

如需改进此组件，请：

1. 查看 `/home/user/claude-code-open/src/ui/components/DiffView.tsx` 源代码
2. 参考 `/home/user/claude-code-open/src/ui/components/DiffView.example.tsx` 中的示例
3. 运行 `npm run build` 确保类型检查通过
4. 测试不同的内容和配置

## 许可

MIT License - 与项目主许可协议相同
