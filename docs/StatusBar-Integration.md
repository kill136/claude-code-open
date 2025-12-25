# StatusBar 集成指南

## 将增强的 StatusBar 组件集成到 App.tsx

本文档说明如何在 `/home/user/claude-code-open/src/ui/App.tsx` 中集成增强的 StatusBar 组件。

---

## 步骤 1: 导入 StatusBar 组件

在文件顶部的导入部分添加：

```typescript
// 在第 15 行后添加
import { StatusBar } from './components/StatusBar.js';
```

完整的导入部分应该是：

```typescript
import { Header } from './components/Header.js';
import { Message } from './components/Message.js';
import { Input } from './components/Input.js';
import { ToolCall } from './components/ToolCall.js';
import { TodoList } from './components/TodoList.js';
import { Spinner } from './components/Spinner.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { ShortcutHelp } from './components/ShortcutHelp.js';
import { StatusBar } from './components/StatusBar.js';  // 新增
```

---

## 步骤 2: 添加状态变量

在组件内部（约第 93 行 `const sessionId = useRef(uuidv4());` 之后）添加：

```typescript
  // StatusBar 状态
  const [sessionStartTime] = useState(Date.now());
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'error'>('online');
  const [gitBranch, setGitBranch] = useState<string | undefined>();
  const [permissionMode, setPermissionMode] = useState<string>('default');
```

---

## 步骤 3: 获取 Git 分支信息

在现有的 `useEffect` hooks 后添加（约第 162 行之后）：

```typescript
  // 获取 Git 分支信息
  useEffect(() => {
    import('child_process').then(({ execSync }) => {
      try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        setGitBranch(branch);
      } catch {
        setGitBranch(undefined);
      }
    });
  }, []);
```

---

## 步骤 4: 更新消息处理逻辑

在 `handleSubmit` 函数中的 try-catch 块内（约第 273-310 行），添加 Token 和费用统计：

**在 `try` 块开始后添加：**
```typescript
      try {
        // 设置网络状态为在线
        setNetworkStatus('online');

        // ... 现有的 for await 循环 ...
```

**在 `addMessage('assistant', currentResponse);` 之后（约第 303 行后）添加：**
```typescript
        addMessage('assistant', currentResponse);
        addActivity(`Conversation: ${input.slice(0, 30)}...`);

        // 新增：Token 和费用统计
        const estimatedInputTokens = Math.floor(input.length / 4);
        const estimatedOutputTokens = Math.floor(currentResponse.length / 4);
        setTotalInputTokens((prev) => prev + estimatedInputTokens);
        setTotalOutputTokens((prev) => prev + estimatedOutputTokens);

        // 费用计算（根据模型调整价格）
        const inputCost = (estimatedInputTokens / 1000000) * 3.0; // $3/MTok
        const outputCost = (estimatedOutputTokens / 1000000) * 15.0; // $15/MTok
        setTotalCost((prev) => prev + inputCost + outputCost);

        setConnectionStatus('connected');
```

**在 catch 块中添加：**
```typescript
      } catch (err) {
        addMessage('assistant', `Error: ${err}`);
        addActivity(`Error occurred`);
        setNetworkStatus('error');  // 新增
        setConnectionStatus('error');
      }
```

---

## 步骤 5: 替换底部状态栏

将原有的简单状态栏（约第 416-424 行）：

```typescript
      {/* Status Bar - 底部状态栏 */}
      <Box justifyContent="space-between" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          ? for shortcuts
        </Text>
        <Text color="gray" dimColor>
          {isProcessing ? 'Processing...' : 'Auto-updating...'}
        </Text>
      </Box>
```

替换为：

```typescript
      {/* Status Bar - 增强版底部状态栏 */}
      <Box marginTop={1}>
        <StatusBar
          messageCount={messages.length}
          inputTokens={totalInputTokens}
          outputTokens={totalOutputTokens}
          cost={`$${totalCost.toFixed(4)}`}
          duration={Date.now() - sessionStartTime}
          isProcessing={isProcessing}
          model={modelMap[model] || model}
          modelDisplayName={modelDisplayName[model] || model}
          contextUsed={totalInputTokens + totalOutputTokens}
          contextMax={200000}
          contextPercentage={((totalInputTokens + totalOutputTokens) / 200000) * 100}
          networkStatus={networkStatus}
          permissionMode={planMode ? 'plan' : permissionMode}
          gitBranch={gitBranch}
          cwd={process.cwd()}
        />
      </Box>

      {/* 快捷键提示 */}
      <Box justifyContent="center" paddingX={1}>
        <Text color="gray" dimColor>
          Press ? for shortcuts
        </Text>
      </Box>
```

---

## 完整的补丁文件

为了方便，以下是完整的更改摘要：

### 文件：`/home/user/claude-code-open/src/ui/App.tsx`

**1. 导入语句（第 8-16 行）：**
```diff
 import { WelcomeScreen } from './components/WelcomeScreen.js';
 import { ShortcutHelp } from './components/ShortcutHelp.js';
+import { StatusBar } from './components/StatusBar.js';
 import { ConversationLoop } from '../core/loop.js';
```

**2. 状态变量（约第 93 行后）：**
```diff
   const sessionId = useRef(uuidv4());
+
+  // StatusBar 状态
+  const [sessionStartTime] = useState(Date.now());
+  const [totalInputTokens, setTotalInputTokens] = useState(0);
+  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
+  const [totalCost, setTotalCost] = useState(0);
+  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'error'>('online');
+  const [gitBranch, setGitBranch] = useState<string | undefined>();
+  const [permissionMode, setPermissionMode] = useState<string>('default');
```

**3. Git 分支 Hook（约第 162 行后）：**
```diff
     return () => clearInterval(interval);
   }, []);
+
+  // 获取 Git 分支信息
+  useEffect(() => {
+    import('child_process').then(({ execSync }) => {
+      try {
+        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
+          cwd: process.cwd(),
+          encoding: 'utf-8',
+          stdio: ['pipe', 'pipe', 'pipe'],
+        }).trim();
+        setGitBranch(branch);
+      } catch {
+        setGitBranch(undefined);
+      }
+    });
+  }, []);
```

**4. 消息处理（try 块开始）：**
```diff
       try {
+        setNetworkStatus('online');
+
         for await (const event of loop.processMessageStream(input)) {
```

**5. Token 统计（约第 303-305 行后）：**
```diff
         addMessage('assistant', currentResponse);
         addActivity(`Conversation: ${input.slice(0, 30)}...`);
+
+        // Token 和费用统计
+        const estimatedInputTokens = Math.floor(input.length / 4);
+        const estimatedOutputTokens = Math.floor(currentResponse.length / 4);
+        setTotalInputTokens((prev) => prev + estimatedInputTokens);
+        setTotalOutputTokens((prev) => prev + estimatedOutputTokens);
+
+        const inputCost = (estimatedInputTokens / 1000000) * 3.0;
+        const outputCost = (estimatedOutputTokens / 1000000) * 15.0;
+        setTotalCost((prev) => prev + inputCost + outputCost);
+
         setConnectionStatus('connected');
```

**6. 错误处理：**
```diff
       } catch (err) {
         addMessage('assistant', `Error: ${err}`);
         addActivity(`Error occurred`);
+        setNetworkStatus('error');
         setConnectionStatus('error');
       }
```

**7. StatusBar 组件（替换第 416-424 行）：**
```diff
-      {/* Status Bar - 底部状态栏 */}
-      <Box justifyContent="space-between" paddingX={1} marginTop={1}>
-        <Text color="gray" dimColor>
-          ? for shortcuts
-        </Text>
-        <Text color="gray" dimColor>
-          {isProcessing ? 'Processing...' : 'Auto-updating...'}
-        </Text>
-      </Box>
+      {/* Status Bar - 增强版底部状态栏 */}
+      <Box marginTop={1}>
+        <StatusBar
+          messageCount={messages.length}
+          inputTokens={totalInputTokens}
+          outputTokens={totalOutputTokens}
+          cost={`$${totalCost.toFixed(4)}`}
+          duration={Date.now() - sessionStartTime}
+          isProcessing={isProcessing}
+          model={modelMap[model] || model}
+          modelDisplayName={modelDisplayName[model] || model}
+          contextUsed={totalInputTokens + totalOutputTokens}
+          contextMax={200000}
+          contextPercentage={((totalInputTokens + totalOutputTokens) / 200000) * 100}
+          networkStatus={networkStatus}
+          permissionMode={planMode ? 'plan' : permissionMode}
+          gitBranch={gitBranch}
+          cwd={process.cwd()}
+        />
+      </Box>
+
+      {/* 快捷键提示 */}
+      <Box justifyContent="center" paddingX={1}>
+        <Text color="gray" dimColor>
+          Press ? for shortcuts
+        </Text>
+      </Box>
     </Box>
```

---

## 测试

完成集成后，运行：

```bash
npm run build
npm run dev
```

你应该看到增强的 StatusBar，显示：
- 模型名称（如 `sonnet-4.5`）
- 消息数量
- Token 使用（输入/输出）
- 费用估算
- 会话时长
- 上下文使用百分比
- 网络状态指示器
- 权限模式（如果非 default）
- Git 分支（如果在 Git 仓库中）
- 工作目录

---

## 注意事项

1. **Token 估算**：当前实现使用简单的字符数 / 4 估算法。在生产环境中，应该使用实际的 API 响应中的 usage 信息。

2. **费用计算**：价格基于 Claude Sonnet 4.5（$3/MTok 输入，$15/MTok 输出）。需要根据实际使用的模型调整。

3. **上下文限制**：当前设置为 200,000 tokens（Claude 4 系列）。根据模型调整 `contextMax` 值。

4. **实时 Token 统计**：如果 `ConversationLoop` 返回 usage 信息，应该使用那些准确值而不是估算。

---

## 进一步优化

### 使用实际的 API Usage 数据

如果 API 响应包含 usage 信息，修改 `handleSubmit`：

```typescript
// 在 event.type === 'done' 时
} else if (event.type === 'done') {
  if (event.usage) {
    setTotalInputTokens((prev) => prev + event.usage.input_tokens);
    setTotalOutputTokens((prev) => prev + event.usage.output_tokens);

    // 使用实际价格计算
    const modelPricing = getModelPricing(model);
    const cost =
      (event.usage.input_tokens / 1000000) * modelPricing.input +
      (event.usage.output_tokens / 1000000) * modelPricing.output;
    setTotalCost((prev) => prev + cost);
  }
}
```

### 动态价格表

```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};

function getModelPricing(model: string) {
  return MODEL_PRICING[model] || { input: 3, output: 15 };
}
```

---

## 故障排查

### 问题：StatusBar 不显示

**解决方案：** 检查导入语句和组件是否正确渲染。

### 问题：Token 计数不准确

**解决方案：** 这是正常的，因为使用的是估算。等待集成实际 API usage 数据。

### 问题：Git 分支不显示

**解决方案：** 确保在 Git 仓库中运行，并且 `git` 命令可用。

### 问题：TypeScript 错误

**解决方案：** 运行 `npm run build` 查看详细错误，确保所有类型正确导入。

---

完成！现在你的 Claude Code CLI 有了一个功能完整的增强状态栏。
