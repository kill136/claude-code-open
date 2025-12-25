# ToolCall 组件快速参考

## 快速开始

```tsx
import { ToolCall } from './ui/components/ToolCall.js';

// 基础用法
<ToolCall
  name="Read"
  status="success"
  result="File content..."
  duration={125}
/>

// 完整功能
<ToolCall
  name="Edit"
  status="success"
  input={{ file_path: "/path/to/file.ts", old_string: "old", new_string: "new" }}
  result={diffOutput}
  duration={45}
/>

// 错误处理
<ToolCall
  name="Edit"
  status="error"
  input={{ file_path: "/missing.ts" }}
  error="File not found"
  duration={12}
/>
```

## Props 快速参考

| Prop | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 工具名称 |
| `status` | 'running' \| 'success' \| 'error' | ✅ | 执行状态 |
| `input` | Record<string, unknown> | ❌ | 工具输入参数 |
| `result` | string | ❌ | 成功时的输出 |
| `error` | string | ❌ | 失败时的错误信息 |
| `duration` | number | ❌ | 执行时间（毫秒） |
| `expanded` | boolean | ❌ | 初始展开状态 |

## 支持的工具特定格式

### Edit / MultiEdit
显示文件路径和替换内容长度
```
File: .../components/Button.tsx
Replacing: "const x = 1"
```

### Bash
高亮命令
```
$ npm run build
```

### Grep
显示搜索模式
```
Pattern: "TODO" in *.ts
```

### Read / Write
显示文件操作信息
```
Reading: .../package.json
Writing 1024 chars to .../config.json
```

### Glob
显示匹配模式
```
Pattern: **/*.tsx
```

## Diff 高亮颜色

- `+` 新增行 → 🟢 绿色
- `-` 删除行 → 🔴 红色
- `@@` Hunk 标记 → 🔵 青色
- `---/+++` 文件头 → ⚪ 灰色
- `Changes` 统计 → 🟡 黄色

## 自动功能

✅ **自动 Diff 检测** - 包含 `---`, `+++`, `@@` 的输出自动渲染为 diff
✅ **自动折叠** - 超过 10 行的输出自动折叠（可展开）
✅ **自动截断** - 超过 120 字符的行自动截断
✅ **自动格式化** - 根据工具类型自动选择最佳显示格式

## 常见场景

### 场景 1: 文件编辑成功（带 diff）
```tsx
<ToolCall
  name="Edit"
  status="success"
  input={{
    file_path: "/src/config.ts",
    old_string: 'const PORT = 3000',
    new_string: 'const PORT = 8080'
  }}
  result={`Changes: +1 -1
────────────────────────────────────────────────────────────
--- a/config.ts
+++ b/config.ts
@@ -5,1 +5,1 @@
-const PORT = 3000
+const PORT = 8080
────────────────────────────────────────────────────────────`}
  duration={45}
/>
```

### 场景 2: Bash 命令执行中
```tsx
<ToolCall
  name="Bash"
  status="running"
  input={{ command: "npm install" }}
/>
```

### 场景 3: 工具执行失败
```tsx
<ToolCall
  name="Read"
  status="error"
  input={{ file_path: "/nonexistent.ts" }}
  error="File not found: /nonexistent.ts"
  duration={8}
/>
```

### 场景 4: 长输出自动折叠
```tsx
<ToolCall
  name="Grep"
  status="success"
  input={{ pattern: "export", glob: "*.ts" }}
  result={longMultiLineOutput}
  expanded={false}  // 初始折叠
  duration={234}
/>
```

## 集成到 App

```tsx
// 1. 定义状态
const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);

// 2. 监听事件
for await (const event of loop.processMessageStream(input)) {
  if (event.type === 'tool_start') {
    setToolCalls(prev => [...prev, {
      id: `tool_${Date.now()}`,
      name: event.toolName || '',
      status: 'running',
      input: event.toolInput as Record<string, unknown>,
    }]);
  } else if (event.type === 'tool_end') {
    setToolCalls(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last) {
        last.status = event.toolError ? 'error' : 'success';
        last.result = event.toolResult;
        last.error = event.toolError;
        last.duration = Date.now() - startTime;
      }
      return updated;
    });
  }
}

// 3. 渲染
{toolCalls.map(tool => (
  <ToolCall
    key={tool.id}
    name={tool.name}
    status={tool.status}
    input={tool.input}
    result={tool.result}
    error={tool.error}
    duration={tool.duration}
  />
))}
```

## 性能提示

💡 **大输出**: 自动截断和折叠确保性能
💡 **长路径**: 自动缩短为 `.../file.ext`
💡 **JSON**: 只显示前 3 个键值对
💡 **状态管理**: 使用 useState 管理展开状态

## 调试技巧

### 检查 Props
```tsx
console.log('ToolCall props:', { name, status, input, result, error, duration });
```

### 测试 Diff 检测
```tsx
const testOutput = `---
+++
@@`;
console.log('Contains diff:', containsDiff(testOutput)); // true
```

### 预览格式化
```tsx
console.log('Formatted path:', formatFilePath({ file_path: "/very/long/path/to/file.ts" }));
// Output: ".../to/file.ts"
```

## 相关链接

- 📖 [完整文档](./ToolCall-Enhancement.md)
- 🎨 [演示示例](../examples/ToolCallDemo.tsx)
- 📝 [增强总结](../ENHANCEMENT_SUMMARY.md)
- 💻 [源代码](../src/ui/components/ToolCall.tsx)

## 常见问题

**Q: 如何强制展开所有输出？**
```tsx
<ToolCall {...props} expanded={true} />
```

**Q: 如何自定义折叠阈值？**
修改 `OutputDisplay` 组件中的 `isTruncated` 逻辑（当前为 20 行）

**Q: 支持其他 diff 格式吗？**
目前只支持 unified diff 格式（---、+++、@@）

**Q: 可以禁用颜色吗？**
Ink 组件的颜色由终端环境控制，设置 `NO_COLOR=1` 环境变量可禁用

**Q: 如何添加新的工具特定格式？**
在 `InputDisplay` 组件的 `formatSpecialInput()` 函数中添加新的 case

## 版本历史

- **v2.0.76-enhanced** (2025-12-24)
  - ✨ 新增 diff 高亮
  - ✨ 新增输入/输出格式化
  - ✨ 新增折叠/展开功能
  - ✨ 新增错误分离显示
  - 🐛 修复长输出性能问题
  - 📝 完善文档和示例

---

**提示**: 按 `?` 键查看更多快捷键
