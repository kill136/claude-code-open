# ModelSelector 集成指南

本指南说明如何将 ModelSelector 组件集成到 Claude Code CLI 主应用中。

## 快速开始

### 1. 导入组件

```typescript
import { ModelSelector } from './ui/components/ModelSelector.js';
import type { ModelSelectorProps } from './ui/components/ModelSelector.js';
```

或从 UI 组件索引导入：

```typescript
import { ModelSelector } from './ui/components/index.js';
```

### 2. 基本集成

在会话管理器或主应用中添加模型选择功能：

```typescript
import { useState } from 'react';
import { Box, Text } from 'ink';
import { ModelSelector } from './ui/components/ModelSelector.js';

function SessionManager() {
  const [currentModel, setCurrentModel] = useState('claude-sonnet-4-5-20250929');
  const [showModelSelector, setShowModelSelector] = useState(false);

  const handleModelChange = (newModel: string) => {
    setCurrentModel(newModel);
    setShowModelSelector(false);
    // 可选：保存到会话配置
    session.updateModel(newModel);
  };

  if (showModelSelector) {
    return (
      <ModelSelector
        currentModel={currentModel}
        onSelect={handleModelChange}
        onCancel={() => setShowModelSelector(false)}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Current model: {currentModel}</Text>
      <Text dimColor>Press /model to change</Text>
    </Box>
  );
}
```

## 集成场景

### 场景 1: CLI 启动时选择模型

在用户启动 CLI 时提供模型选择：

```typescript
// src/cli.ts
import { render } from 'ink';
import { ModelSelector } from './ui/components/ModelSelector.js';

async function selectModel(): Promise<string> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ModelSelector
        currentModel="claude-sonnet-4-5-20250929"
        onSelect={(model) => {
          unmount();
          resolve(model);
        }}
      />
    );
  });
}

// 在主流程中使用
const selectedModel = await selectModel();
const session = new Session({ model: selectedModel });
```

### 场景 2: 运行时切换模型

在会话进行中允许用户切换模型：

```typescript
// 在主对话循环中
function ConversationLoop({ session }: { session: Session }) {
  const [mode, setMode] = useState<'chat' | 'model-selector'>('chat');

  useInput((input, key) => {
    if (input === 'm' && !key.ctrl && !key.shift) {
      setMode('model-selector');
    }
  });

  if (mode === 'model-selector') {
    return (
      <ModelSelector
        currentModel={session.model}
        onSelect={(model) => {
          session.switchModel(model);
          setMode('chat');
        }}
        onCancel={() => setMode('chat')}
      />
    );
  }

  return <ChatInterface session={session} />;
}
```

### 场景 3: 斜杠命令集成

添加 `/model` 命令来打开模型选择器：

```typescript
// 在命令处理器中
const commands = {
  '/model': () => {
    setShowModelSelector(true);
  },
  // 其他命令...
};

// 在 UI 中
if (showModelSelector) {
  return (
    <ModelSelector
      currentModel={session.model}
      onSelect={(model) => {
        session.updateModel(model);
        setShowModelSelector(false);
        console.log(`Switched to ${model}`);
      }}
      onCancel={() => setShowModelSelector(false)}
    />
  );
}
```

### 场景 4: 配置保存

选择模型后保存到配置文件：

```typescript
import { saveConfig } from './config/index.js';

const handleModelSelect = async (model: string) => {
  // 更新当前会话
  session.updateModel(model);

  // 保存到配置文件
  await saveConfig({
    ...currentConfig,
    defaultModel: model,
  });

  // 关闭选择器
  setShowModelSelector(false);

  // 通知用户
  console.log(`Model changed to ${modelConfig.getDisplayName(model)}`);
};

<ModelSelector
  currentModel={currentModel}
  onSelect={handleModelSelect}
/>
```

## 与现有系统集成

### Session 类集成

在 `src/core/session.ts` 中添加模型切换支持：

```typescript
export class Session {
  private model: string;

  // 添加模型切换方法
  switchModel(newModel: string): void {
    const oldModel = this.model;
    this.model = newModel;

    // 记录模型切换
    this.addSystemMessage({
      type: 'model_switch',
      content: `Switched from ${oldModel} to ${newModel}`,
      timestamp: Date.now(),
    });

    // 触发事件
    this.emit('model_changed', { from: oldModel, to: newModel });
  }

  getModel(): string {
    return this.model;
  }
}
```

### ClaudeClient 集成

确保 Claude API 客户端支持动态模型切换：

```typescript
// src/core/client.ts
export class ClaudeClient {
  async sendMessage(
    messages: Message[],
    options: {
      model?: string;
      // 其他选项...
    } = {}
  ): Promise<Response> {
    const model = options.model || this.defaultModel;

    // 验证模型
    if (!modelConfig.isValidModel(model)) {
      throw new Error(`Invalid model: ${model}`);
    }

    // 调用 API
    return this.anthropic.messages.create({
      model,
      messages,
      // ...
    });
  }
}
```

## UI 状态管理

### 使用 React Context

```typescript
// src/ui/context/ModelContext.tsx
import { createContext, useContext, useState } from 'react';

interface ModelContextType {
  currentModel: string;
  setModel: (model: string) => void;
  showSelector: boolean;
  openSelector: () => void;
  closeSelector: () => void;
}

const ModelContext = createContext<ModelContextType | null>(null);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [currentModel, setCurrentModel] = useState('claude-sonnet-4-5-20250929');
  const [showSelector, setShowSelector] = useState(false);

  return (
    <ModelContext.Provider
      value={{
        currentModel,
        setModel: setCurrentModel,
        showSelector,
        openSelector: () => setShowSelector(true),
        closeSelector: () => setShowSelector(false),
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used within ModelProvider');
  return context;
}

// 使用示例
function App() {
  const { currentModel, showSelector, setModel, closeSelector } = useModel();

  if (showSelector) {
    return (
      <ModelSelector
        currentModel={currentModel}
        onSelect={(model) => {
          setModel(model);
          closeSelector();
        }}
        onCancel={closeSelector}
      />
    );
  }

  return <MainApp />;
}
```

## 快捷键绑定

添加全局快捷键打开模型选择器：

```typescript
import { useInput } from 'ink';

function GlobalKeyHandler() {
  const { openSelector } = useModel();

  useInput((input, key) => {
    // Ctrl+M 打开模型选择器
    if (input === 'm' && key.ctrl) {
      openSelector();
    }
  });

  return null;
}
```

## 测试集成

### 单元测试

```typescript
import { render } from 'ink-testing-library';
import { ModelSelector } from './ModelSelector.js';

test('selects model on enter', () => {
  const onSelect = vi.fn();
  const { stdin } = render(
    <ModelSelector
      currentModel="claude-sonnet-4-5-20250929"
      onSelect={onSelect}
    />
  );

  stdin.write('\r'); // Enter key
  expect(onSelect).toHaveBeenCalledWith('claude-sonnet-4-5-20250929');
});
```

### 集成测试

```typescript
import { render } from 'ink';

async function testModelSelection() {
  const result = await new Promise<string>((resolve) => {
    const { unmount } = render(
      <ModelSelector
        currentModel="claude-sonnet-4-5-20250929"
        onSelect={(model) => {
          unmount();
          resolve(model);
        }}
      />
    );
  });

  console.log('Selected model:', result);
  return result;
}
```

## 性能优化

### 1. 懒加载

只在需要时加载组件：

```typescript
import { lazy, Suspense } from 'react';
const ModelSelector = lazy(() => import('./ui/components/ModelSelector.js'));

function App() {
  if (showSelector) {
    return (
      <Suspense fallback={<Spinner />}>
        <ModelSelector {...props} />
      </Suspense>
    );
  }
  return <MainApp />;
}
```

### 2. 缓存模型列表

```typescript
const models = useMemo(() => modelConfig.getAllModels(), []);
```

## 错误处理

```typescript
const handleModelSelect = (model: string) => {
  try {
    // 验证模型
    if (!modelConfig.isValidModel(model)) {
      throw new Error(`Invalid model: ${model}`);
    }

    // 更新会话
    session.updateModel(model);
    setShowModelSelector(false);
  } catch (error) {
    console.error('Failed to switch model:', error);
    // 显示错误消息
    setError(error.message);
  }
};
```

## 最佳实践

1. **始终提供 onCancel** - 让用户可以退出选择
2. **保存用户选择** - 将选择保存到配置文件
3. **验证模型** - 在切换前验证模型有效性
4. **提供反馈** - 切换后显示确认消息
5. **处理错误** - 优雅处理 API 错误和无效模型
6. **记录切换** - 在会话历史中记录模型切换

## 相关文件

- `src/ui/components/ModelSelector.tsx` - 主组件
- `src/models/config.ts` - 模型配置
- `src/core/session.ts` - 会话管理
- `src/core/client.ts` - API 客户端
