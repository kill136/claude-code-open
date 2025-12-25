# Message Component - 使用指南

## 概述

增强的 `Message` 组件提供了流式渲染、Markdown 支持、代码高亮等功能，用于在终端中显示用户和助手的消息。

## 功能特性

### 1. 流式文本渲染
支持逐字符/逐词显示文本，模拟真实的打字效果。

```tsx
<Message
  role="assistant"
  content="这是一条流式渲染的消息"
  streaming={true}
  streamSpeed={20}  // 每个字符间隔 20ms
  onComplete={() => console.log('渲染完成')}
/>
```

### 2. Markdown 渲染
自动解析和渲染 Markdown 语法。

```tsx
<Message
  role="assistant"
  content={`
# 标题

这是一段**粗体**文本。

## 子标题

- 列表项 1
- 列表项 2
- 列表项 3

\`\`\`javascript
function hello() {
  console.log("Hello World");
}
\`\`\`
  `}
/>
```

### 3. 代码块语法高亮
代码块会以带边框的黄色文本显示，并显示语言标签。

```tsx
<Message
  role="assistant"
  content={`
\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\`
  `}
/>
```

### 4. 工具调用内联显示
支持 ContentBlock 数组，可以显示工具调用和结果。

```tsx
<Message
  role="assistant"
  content={[
    {
      type: 'text',
      text: '我将使用 Read 工具来读取文件。'
    },
    {
      type: 'tool_use',
      id: 'tool_123',
      name: 'Read',
      input: { file_path: '/path/to/file.ts' }
    },
    {
      type: 'tool_result',
      tool_use_id: 'tool_123',
      content: 'File contents...'
    }
  ]}
/>
```

### 5. 多种消息类型
支持不同角色的消息，每种都有独特的样式。

```tsx
// 用户消息（蓝色）
<Message role="user" content="用户输入的问题" />

// 助手消息（绿色）
<Message role="assistant" content="Claude 的回复" />

// 系统消息（青色）
<Message role="system" content="系统通知" />

// 错误消息（红色）
<Message role="error" content="错误信息" />
```

### 6. 时间戳显示
自动显示消息的时间戳。

```tsx
<Message
  role="assistant"
  content="带时间戳的消息"
  timestamp={new Date()}
/>
```

### 7. 模型信息显示
在助手消息中显示使用的模型。

```tsx
<Message
  role="assistant"
  content="来自 Sonnet 4 的回复"
  model="claude-sonnet-4-20250514"
/>
```

### 8. 复制提示
显示复制消息的提示。

```tsx
<Message
  role="assistant"
  content="可以复制的消息"
  showCopyHint={true}
/>
```

## API 参考

### MessageProps

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `role` | `'user' \| 'assistant' \| 'system' \| 'error'` | 必需 | 消息角色 |
| `content` | `string \| ContentBlock[]` | 必需 | 消息内容 |
| `timestamp` | `Date` | 可选 | 消息时间戳 |
| `streaming` | `boolean` | `false` | 是否启用流式渲染 |
| `streamSpeed` | `number` | `20` | 流式渲染速度（ms/字符） |
| `showCopyHint` | `boolean` | `false` | 显示复制提示 |
| `model` | `string` | 可选 | 使用的模型名称 |
| `onComplete` | `() => void` | 可选 | 流式渲染完成回调 |

### ContentBlock

```typescript
interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;          // type='text' 时使用
  id?: string;            // type='tool_use' 时使用
  name?: string;          // type='tool_use' 时使用
  input?: unknown;        // type='tool_use' 时使用
  tool_use_id?: string;   // type='tool_result' 时使用
  content?: string;       // type='tool_result' 时使用
}
```

## 样式说明

### 颜色方案

- **用户消息**: 蓝色标签
- **助手消息**: 绿色标签
- **系统消息**: 青色标签
- **错误消息**: 红色标签
- **代码块**: 黄色文本，灰色边框
- **标题**: 青色加粗，一级标题带下划线
- **列表**: 黄色项目符号
- **工具调用**: 品红色标签
- **工具结果**: 绿色（成功）/红色（错误）

### 布局

- 消息之间有垂直间距（marginY={1}）
- 消息内容左缩进 2 个单位
- 代码块有边框和内边距
- 工具调用和结果有额外的间距

## 实际应用示例

### 在 App.tsx 中使用

```tsx
import { Message } from './components/Message';

// 渲染消息列表
{messages.map((msg, index) => (
  <Message
    key={index}
    role={msg.role}
    content={msg.content}
    timestamp={msg.timestamp}
    streaming={index === messages.length - 1 && isProcessing}
    model={model}
  />
))}
```

### 流式渲染实时消息

```tsx
const [currentMessage, setCurrentMessage] = useState('');

// 从 API 流式接收数据
stream.on('data', (chunk) => {
  setCurrentMessage(prev => prev + chunk);
});

// 渲染
<Message
  role="assistant"
  content={currentMessage}
  streaming={true}
  streamSpeed={10}
  onComplete={() => {
    console.log('消息完成');
    // 将消息添加到历史记录
    addToHistory(currentMessage);
    setCurrentMessage('');
  }}
/>
```

## 性能优化

1. **流式渲染优化**: 使用 `streamSpeed` 参数控制渲染速度，避免过快导致的性能问题。
2. **长消息处理**: 工具结果和输入自动截断到 200 字符，避免终端溢出。
3. **React.memo**: 考虑使用 `React.memo` 包装组件以避免不必要的重新渲染。

```tsx
export const Message = React.memo<MessageProps>(({ ... }) => {
  // 组件实现
});
```

## 已知限制

1. **语法高亮**: 由于 Ink 的限制，代码高亮仅使用单一颜色（黄色），不支持详细的语法高亮。
2. **图片渲染**: 终端环境无法直接显示图片，仅显示占位符。
3. **复制功能**: 复制功能依赖终端模拟器的选择和复制功能。
4. **Markdown 限制**: 仅支持常见的 Markdown 语法（标题、列表、代码块），不支持表格、链接等复杂格式。

## 未来改进

- [ ] 添加更详细的语法高亮（如果 Ink 支持）
- [ ] 支持更多 Markdown 语法（表格、链接、引用）
- [ ] 添加消息折叠/展开功能（长消息）
- [ ] 支持消息搜索和过滤
- [ ] 添加消息导出功能
