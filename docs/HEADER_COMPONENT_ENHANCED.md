# Header 组件增强文档

## 概述

Header 组件已经过全面增强，支持更多官方 Claude Code CLI 的功能，包括计划模式指示器、连接状态、快捷键提示和更新通知。

## 文件位置

- **组件文件**: `/home/user/claude-code-open/src/ui/components/Header.tsx`
- **集成文件**: `/home/user/claude-code-open/src/ui/App.tsx`

## 新增功能

### 1. 计划模式指示器 (Plan Mode Indicator)

显示当前是否处于计划模式：
- **紧凑模式**: 显示 "📋 PLAN MODE" 徽章
- **完整模式**: 显示带边框的计划模式横幅
- **边框颜色**: 计划模式下边框变为 magenta（洋红色）

```tsx
isPlanMode={true}
```

**视觉效果**:
- 紧凑模式: `Claude Code v2.0.76 · Sonnet 4 · 📋 PLAN MODE`
- 完整模式:
  ```
  ┌─ 📋 PLAN MODE ACTIVE ────────────────────┐
  │ Read-only exploration mode.              │
  │ Use /plan exit to submit plan.           │
  └──────────────────────────────────────────┘
  ```

### 2. 连接状态 (Connection Status)

实时显示 API 连接状态：
- **connected** (已连接): 绿色圆点 ● Connected
- **connecting** (连接中): 黄色圆点 ● Connecting...
- **disconnected** (已断开): 灰色圆点 ● Disconnected
- **error** (错误): 红色圆点 ● Connection Error

```tsx
connectionStatus="connected"
```

### 3. 快捷键提示 (Keyboard Shortcuts Hint)

在完整模式下显示快捷键提示：
- 显示 "Press ? for shortcuts" 提示
- 可通过 `showShortcutHint` 控制显示/隐藏

```tsx
showShortcutHint={true}
```

### 4. 更新通知 (Update Notification)

显示可用的更新：
- **紧凑模式**: 在右侧显示 "🎉 v2.0.77 available"
- **完整模式**: 显示带边框的更新通知，包含安装命令

```tsx
hasUpdate={true}
latestVersion="2.0.77"
```

**视觉效果** (完整模式):
```
┌─ Update Notification ────────────────────┐
│ 🎉 New version available! Run:           │
│ npm install -g claude-code-open          │
└──────────────────────────────────────────┘
```

## 组件 Props 定义

```typescript
interface HeaderProps {
  // 基础信息
  version: string;                    // 当前版本号
  model: string;                      // 模型名称
  cwd?: string;                       // 当前工作目录
  username?: string;                  // 用户名
  apiType?: string;                   // API 类型 (默认: 'Claude API')
  organization?: string;              // 组织名称

  // 显示模式
  isCompact?: boolean;                // 是否紧凑模式 (默认: false)

  // 新增功能
  isPlanMode?: boolean;               // 是否处于计划模式 (默认: false)
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';  // 连接状态
  showShortcutHint?: boolean;         // 是否显示快捷键提示 (默认: true)
  hasUpdate?: boolean;                // 是否有可用更新 (默认: false)
  latestVersion?: string;             // 最新版本号
}
```

## 使用示例

### 基本使用（原有功能）

```tsx
<Header
  version="2.0.76"
  model="Sonnet 4"
  cwd="/home/user/project"
  username="Claude User"
  apiType="Claude API"
  isCompact={false}
/>
```

### 完整功能使用（包含所有增强）

```tsx
<Header
  version="2.0.76"
  model="Sonnet 4"
  cwd="/home/user/project"
  username="Claude User"
  apiType="Claude API"
  isCompact={false}
  isPlanMode={true}
  connectionStatus="connected"
  showShortcutHint={true}
  hasUpdate={true}
  latestVersion="2.0.77"
/>
```

### 紧凑模式（对话中显示）

```tsx
<Header
  version="2.0.76"
  model="Sonnet 4"
  cwd="/home/user/project"
  isCompact={true}
  isPlanMode={false}
  connectionStatus="connected"
  hasUpdate={false}
/>
```

## App.tsx 集成

Header 组件已集成到主应用中，自动监听并显示状态变化：

### 状态管理

```typescript
// 连接状态
const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('connected');

// 更新信息
const [hasUpdate, setHasUpdate] = useState(false);
const [latestVersion, setLatestVersion] = useState<string | undefined>();

// 计划模式
const [planMode, setPlanMode] = useState(false);
```

### 自动更新监听

```typescript
// 监听更新通知
useEffect(() => {
  const handleUpdateAvailable = (info: { currentVersion: string; latestVersion: string }) => {
    setHasUpdate(true);
    setLatestVersion(info.latestVersion);
  };

  updateManager.on('update-available', handleUpdateAvailable);
  updateManager.checkForUpdates().catch(() => {});

  return () => {
    updateManager.off('update-available', handleUpdateAvailable);
  };
}, []);
```

### Plan Mode 监听

```typescript
// 监听 Plan Mode 状态变化（轮询）
useEffect(() => {
  const checkPlanMode = () => {
    setPlanMode(isPlanModeActive());
  };

  checkPlanMode();
  const interval = setInterval(checkPlanMode, 1000);

  return () => clearInterval(interval);
}, []);
```

### 连接状态更新

```typescript
// 在消息处理中更新连接状态
const handleSubmit = async (input: string) => {
  setConnectionStatus('connecting');  // 开始连接

  try {
    // 处理消息...
    setConnectionStatus('connected');  // 成功连接
  } catch (err) {
    setConnectionStatus('error');      // 连接错误
  }
};
```

## 视觉设计

### 颜色方案

- **Claude 品牌色**: `#D77757` (橙褐色)
- **计划模式**: `magenta` (洋红色)
- **连接成功**: `green` (绿色)
- **连接中**: `yellow` (黄色)
- **错误**: `red` (红色)
- **更新通知**: `green` (绿色)

### 图标使用

- 📋 - 计划模式
- ● - 连接状态指示器
- 📁 - 工作目录
- 🎉 - 更新可用

## 响应式行为

### 紧凑模式切换

```typescript
isCompact={messages.length > 0}
```

当有消息时，Header 自动切换到紧凑模式，节省屏幕空间。

### 计划模式边框变色

```typescript
borderColor={isPlanMode ? 'magenta' : CLAUDE_COLOR}
```

进入计划模式时，整个 Header 的边框颜色会从 Claude 品牌色变为洋红色，提供明显的视觉反馈。

## 最佳实践

1. **连接状态**: 在发起 API 请求时立即更新为 'connecting'，成功后设为 'connected'，失败时设为 'error'
2. **更新检查**: 应用启动时静默检查更新，不阻塞用户操作
3. **Plan Mode**: 每秒轮询一次状态变化，确保及时更新 UI
4. **快捷键提示**: 在完整模式下默认显示，帮助新用户发现功能
5. **紧凑模式**: 对话开始后自动切换，优化屏幕空间利用

## 兼容性

- **Ink 版本**: 5.0.0+
- **React 版本**: 18.2.0+
- **TypeScript**: 5.3.0+
- **Node.js**: 18.0.0+

## 未来扩展建议

1. **网络速度指示**: 显示当前 API 响应速度
2. **Token 使用量**: 实时显示当前会话的 token 使用情况
3. **多账户支持**: 显示当前登录的账户和快速切换
4. **主题切换**: 支持亮色/暗色主题指示器
5. **通知徽章**: 显示未读通知数量

## 相关文件

- `/home/user/claude-code-open/src/ui/components/Header.tsx` - Header 组件
- `/home/user/claude-code-open/src/ui/App.tsx` - 主应用集成
- `/home/user/claude-code-open/src/tools/planmode.ts` - Plan Mode 工具
- `/home/user/claude-code-open/src/updater/index.ts` - 更新管理器
- `/home/user/claude-code-open/src/ui/components/UpdateNotification.tsx` - 更新通知组件
- `/home/user/claude-code-open/src/ui/components/ShortcutHelp.tsx` - 快捷键帮助组件

## 测试建议

1. **计划模式测试**:
   ```bash
   # 进入计划模式
   /plan
   # 观察 Header 变化（边框变色、显示计划模式横幅）
   ```

2. **连接状态测试**:
   ```bash
   # 断网状态下发送消息
   # 观察状态变化: connected → connecting → error
   ```

3. **更新通知测试**:
   ```bash
   # 模拟更新可用
   # 观察紧凑模式和完整模式的显示差异
   ```

4. **紧凑模式切换**:
   ```bash
   # 观察发送第一条消息后 Header 的变化
   ```

## 总结

增强后的 Header 组件提供了更丰富的信息显示和更好的用户体验：
- ✅ 实时显示计划模式状态
- ✅ 动态更新连接状态
- ✅ 友好的快捷键提示
- ✅ 及时的更新通知
- ✅ 响应式的显示模式切换
- ✅ 符合官方 Claude Code CLI 的设计理念
