# ModelSelector 组件

交互式终端模型选择器，显示可用的 Claude 模型及其能力和定价信息。

## 功能特性

- **模型列表显示** - 展示所有可用的 Claude 4.5 系列模型
- **能力标签** - 显示每个模型的能力（thinking、vision、1M context、pdf）
- **定价信息** - 显示输入/输出定价（可选）
- **键盘导航** - 支持上下箭头和回车键选择
- **当前模型标记** - 高亮显示当前使用的模型
- **Esc 取消** - 支持取消选择操作

## 基本用法

```tsx
import { ModelSelector } from './ui/components/ModelSelector';

function App() {
  const [model, setModel] = useState('claude-sonnet-4-5-20250929');

  return (
    <ModelSelector
      currentModel={model}
      onSelect={(newModel) => setModel(newModel)}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## Props

### ModelSelectorProps

| 属性 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `currentModel` | `string` | ✓ | - | 当前选中的模型 ID |
| `onSelect` | `(model: string) => void` | ✓ | - | 模型选择回调 |
| `onCancel` | `() => void` | - | - | 取消回调 |
| `showPricing` | `boolean` | - | `true` | 是否显示定价信息 |
| `showCapabilities` | `boolean` | - | `true` | 是否显示能力标签 |
| `title` | `string` | - | `'Select a model:'` | 标题文本 |
| `hint` | `string` | - | `'↑/↓ to navigate · enter to select · esc to cancel'` | 提示文本 |

## 键盘快捷键

- `↑` / `↓` - 上下选择模型
- `Enter` - 确认选择
- `Esc` - 取消（需要提供 `onCancel` 回调）

## UI 示例

```
Select a model:

> [x] Sonnet 4.5    [$3/15 per 1M]  [thinking] [vision] [1M] [pdf]
  [ ] Opus 4.5      [$15/75 per 1M] [thinking] [vision] [1M] [pdf]
  [ ] Haiku 4.5     [$0.8/4 per 1M] [vision] [pdf]

↑/↓ to navigate · enter to select · esc to cancel
```

## 使用场景

### 1. 简单模型切换

```tsx
<ModelSelector
  currentModel={currentModel}
  onSelect={(model) => {
    console.log('Switching to:', model);
    setCurrentModel(model);
  }}
/>
```

### 2. 不显示定价

```tsx
<ModelSelector
  currentModel={currentModel}
  onSelect={handleSelect}
  showPricing={false}
/>
```

### 3. 仅显示模型名称

```tsx
<ModelSelector
  currentModel={currentModel}
  onSelect={handleSelect}
  showPricing={false}
  showCapabilities={false}
  title="Choose a model:"
/>
```

### 4. 自定义提示文本

```tsx
<ModelSelector
  currentModel={currentModel}
  onSelect={handleSelect}
  title="Switch to a different model"
  hint="Use arrow keys to select, press Enter to confirm"
/>
```

### 5. 带取消处理

```tsx
<ModelSelector
  currentModel={currentModel}
  onSelect={handleSelect}
  onCancel={() => {
    console.log('Model selection cancelled');
    // 返回到主界面
    setShowSelector(false);
  }}
/>
```

## 模型信息

组件会自动从 `modelConfig` 获取以下信息：

- **模型 ID** - 完整的模型标识符
- **显示名称** - 用户友好的名称（如 "Sonnet 4.5"）
- **能力** - thinking、vision、pdf 支持等
- **上下文窗口** - 200K 或 1M tokens
- **定价** - 输入/输出价格（每百万 tokens）

### 支持的模型

- **Opus 4.5** - 最强大的模型，支持 Extended Thinking
- **Sonnet 4.5** - 平衡性能和成本，支持 Extended Thinking
- **Haiku 4.5** - 快速且经济，不支持 Extended Thinking

所有 4.5 系列模型都支持：
- Vision（图像理解）
- PDF 处理
- 工具调用
- 提示缓存

## 能力标签说明

- `[thinking]` - 支持 Extended Thinking（深度推理）
- `[vision]` - 支持图像输入和分析
- `[1M]` - 1M token 上下文窗口（默认 200K）
- `[pdf]` - 支持 PDF 文件处理

## 定价格式

定价显示为 `[$input/$output per 1M]`，例如：
- `[$3/15 per 1M]` = 输入 $3/百万 tokens，输出 $15/百万 tokens

## 运行示例

```bash
# 基本示例
tsx src/ui/components/ModelSelector.example.tsx

# 不显示定价
tsx src/ui/components/ModelSelector.example.tsx no-pricing

# 不显示能力
tsx src/ui/components/ModelSelector.example.tsx no-capabilities

# 最简版本
tsx src/ui/components/ModelSelector.example.tsx minimal
```

## 集成到主应用

```tsx
import { useState } from 'react';
import { Box } from 'ink';
import { ModelSelector } from './ui/components/ModelSelector';

function MainApp() {
  const [showSelector, setShowSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState('claude-sonnet-4-5-20250929');

  if (showSelector) {
    return (
      <ModelSelector
        currentModel={currentModel}
        onSelect={(model) => {
          setCurrentModel(model);
          setShowSelector(false);
        }}
        onCancel={() => setShowSelector(false)}
      />
    );
  }

  return (
    <Box>
      {/* 主应用界面 */}
      <Text>Current model: {currentModel}</Text>
      <Text>Press M to change model</Text>
    </Box>
  );
}
```

## 技术细节

- **框架**: React + Ink
- **数据源**: `src/models/config.ts` 中的 `modelConfig`
- **类型**: `src/models/types.ts` 中的 `ModelInfo`
- **样式**: Ink 的 Box 和 Text 组件
- **输入**: Ink 的 `useInput` hook

## 相关文件

- `src/ui/components/ModelSelector.tsx` - 主组件
- `src/ui/components/ModelSelector.example.tsx` - 使用示例
- `src/models/config.ts` - 模型配置和定价
- `src/models/types.ts` - 类型定义
