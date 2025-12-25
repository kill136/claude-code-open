# File Edit Tool - 差异预览功能文档

## 概述

FileEditTool 已经增强，现在支持差异预览、批量编辑和原子性回滚等高级功能。

## 新增功能

### 1. 差异预览（Diff Preview）

编辑文件时自动生成 unified diff 格式的差异预览，清晰显示修改前后的变化。

```typescript
await fileEditTool.execute({
  file_path: '/path/to/file.ts',
  old_string: 'const foo = "old"',
  new_string: 'const foo = "new"',
  show_diff: true, // 默认为 true
});
```

**输出示例：**
```diff
Successfully edited /path/to/file.ts

Changes: +1 -1
────────────────────────────────────────────────────────────
--- a/file.ts
+++ b/file.ts
@@ -10,5 +10,5 @@
 unchanged line
-const foo = "old"
+const foo = "new"
 unchanged line
────────────────────────────────────────────────────────────
```

### 2. 批量编辑（Batch Edits）

支持原子性批量编辑操作。所有编辑要么全部成功，要么全部回滚。

```typescript
await fileEditTool.execute({
  file_path: '/path/to/file.ts',
  batch_edits: [
    { old_string: 'foo', new_string: 'bar' },
    { old_string: 'hello', new_string: 'world', replace_all: true },
    { old_string: 'old_name', new_string: 'new_name' },
  ],
  show_diff: true,
});
```

**特性：**
- 原子性保证：如果任何一个编辑失败，所有更改都会回滚
- 验证优先：在写入文件前验证所有编辑操作
- 自动备份：执行前自动备份原始内容

### 3. 编辑确认机制（Confirmation）

支持在应用更改前要求确认。

```typescript
await fileEditTool.execute({
  file_path: '/path/to/file.ts',
  old_string: 'dangerous_code',
  new_string: 'safe_code',
  require_confirmation: true, // 需要确认才能应用
});
```

### 4. 自动回滚（Auto Rollback）

当编辑操作失败时，自动回滚到原始状态。

**触发回滚的情况：**
- old_string 在文件中不存在
- old_string 出现多次但未设置 replace_all
- 文件写入失败
- 批量编辑中任何一个操作验证失败

## API 参数

### FileEditInput

```typescript
interface FileEditInput {
  // 必需参数
  file_path: string;              // 要编辑的文件路径（绝对路径）

  // 单个编辑模式
  old_string?: string;            // 要替换的文本
  new_string?: string;            // 替换后的文本
  replace_all?: boolean;          // 是否替换所有出现（默认 false）

  // 批量编辑模式
  batch_edits?: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;

  // 选项
  show_diff?: boolean;            // 显示差异预览（默认 true）
  require_confirmation?: boolean; // 需要确认（默认 false）
}
```

## 内部实现

### Diff 算法

使用自定义的 line-by-line diff 算法，生成 unified diff 格式输出：

- 逐行比较原始内容和修改后内容
- 智能检测插入、删除和修改操作
- 包含上下文行（默认 3 行）以提供更好的可读性
- 生成标准的 unified diff 格式（@@ -line,count +line,count @@）

### 备份与回滚机制

```typescript
class FileBackup {
  backup(filePath: string, content: string): void;
  restore(filePath: string): boolean;
  clear(): void;
  has(filePath: string): boolean;
}
```

- 在执行编辑前自动备份原始内容
- 发生错误时自动调用 restore() 回滚
- 成功后清除备份释放内存

### 验证流程

1. **文件存在性检查**：验证文件路径存在且不是目录
2. **编辑操作验证**：
   - 检查 old_string 是否存在
   - 检查唯一性（除非 replace_all=true）
   - 模拟执行所有编辑以验证兼容性
3. **应用编辑**：只有所有验证通过才执行实际写入
4. **错误处理**：任何失败都会触发回滚

## 使用示例

### 示例 1：单个编辑并查看 diff

```typescript
const result = await tool.execute({
  file_path: '/home/user/config.ts',
  old_string: 'debug: false',
  new_string: 'debug: true',
  show_diff: true,
});
```

### 示例 2：批量重命名变量

```typescript
const result = await tool.execute({
  file_path: '/home/user/app.ts',
  batch_edits: [
    { old_string: 'oldVarName', new_string: 'newVarName', replace_all: true },
    { old_string: 'OldClassName', new_string: 'NewClassName', replace_all: true },
    { old_string: 'old_function()', new_string: 'new_function()' },
  ],
  show_diff: true,
});
```

### 示例 3：安全编辑（需要确认）

```typescript
const result = await tool.execute({
  file_path: '/home/user/production.config',
  old_string: 'production: false',
  new_string: 'production: true',
  require_confirmation: true,
  show_diff: true,
});

if (!result.success && result.error.includes('Confirmation required')) {
  console.log('Preview:', result.output);
  // 用户确认后再次执行，设置 require_confirmation: false
}
```

## 输出格式

成功的编辑操作返回：

```typescript
{
  success: true,
  output: string,      // 包含成功消息和 diff 预览
  content: string,     // 修改后的完整内容
}
```

失败的编辑操作返回：

```typescript
{
  success: false,
  error: string,       // 错误消息
  output?: string,     // 可能包含 diff 预览（确认模式）
}
```

## 注意事项

1. **备份建议**：虽然工具内置了回滚机制，但建议对重要文件使用版本控制系统
2. **性能考虑**：对于大文件（>10000 行），diff 生成可能需要较长时间
3. **编码支持**：当前仅支持 UTF-8 编码的文本文件
4. **行结束符**：保持原文件的行结束符格式（LF/CRLF）

## 技术细节

### Diff 格式说明

unified diff 格式包含：

- **文件头**：`--- a/file` 和 `+++ b/file`
- **Hunk 头**：`@@ -oldStart,oldCount +newStart,newCount @@`
- **内容行**：
  - ` ` 开头：未修改的上下文行
  - `-` 开头：删除的行
  - `+` 开头：添加的行

### 性能优化

- 使用增量式 diff 算法，避免全量比较
- 仅在需要时生成 diff（show_diff=true）
- 批量操作时只生成一次最终 diff
- 验证通过后才执行实际文件 I/O

## 未来增强

可能的未来改进方向：

- [ ] 支持更复杂的 diff 算法（如 Myers diff）
- [ ] 支持跨文件批量编辑
- [ ] 添加 diff 高亮显示（彩色输出）
- [ ] 支持正则表达式替换
- [ ] 添加编辑历史记录功能
- [ ] 支持部分应用批量编辑（非原子性模式）
