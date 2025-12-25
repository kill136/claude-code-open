# StatusBar 组件增强文档

## 概述

StatusBar 组件已从基础状态栏升级为功能完整的状态指示器，提供全面的会话、系统和环境信息。

## 新增功能

### 1. 模型显示

显示当前使用的 Claude 模型：

```tsx
<StatusBar
  model="claude-sonnet-4.5-20241022"
  modelDisplayName="sonnet-4.5"  // 可选的简短显示名称
/>
```

**显示效果：** `sonnet-4.5` (青色加粗)

支持的模型自动识别：
- `claude-opus-*` → `opus-4.5`
- `claude-sonnet-*` → `sonnet-4.5`
- `claude-haiku-*` → `haiku-4.0`

### 2. Token 使用量详细统计

分别显示输入和输出 Token：

```tsx
<StatusBar
  inputTokens={125000}
  outputTokens={45000}
/>
```

**显示效果：** `125.0K/45.0K tokens`

格式化规则：
- < 1,000: 显示原始数字
- 1,000 - 999,999: 以 K 为单位（如 `45.2K`）
- ≥ 1,000,000: 以 M 为单位（如 `1.5M`）

向后兼容旧的 `tokenCount` prop。

### 3. 费用估算

显示会话总费用：

```tsx
<StatusBar
  cost="$0.1523"
/>
```

**显示效果：** `$0.1523` (绿色)

### 4. 会话时长

自动格式化显示时长：

```tsx
<StatusBar
  duration={3600000}  // 毫秒
/>
```

**显示格式：**
- < 1 秒: `500ms`
- < 1 分钟: `5.2s`
- < 1 小时: `15m 30s`
- ≥ 1 小时: `2h 15m`

### 5. 上下文使用百分比

显示上下文窗口使用情况，带颜色警告：

```tsx
<StatusBar
  contextUsed={120000}
  contextMax={180000}
  contextPercentage={66.67}
/>
```

**显示效果：** `ctx: 67%`

颜色指示：
- < 70%: 绿色（安全）
- 70% - 89%: 黄色（警告）
- ≥ 90%: 红色（危险）

可选显示详细信息：`(120.0K/180.0K)`

### 6. 网络状态指示

实时网络连接状态：

```tsx
<StatusBar
  networkStatus="online"  // 'online' | 'offline' | 'error'
  lastApiCall={Date.now()}
/>
```

**显示效果：**
- 在线: `●` (绿色圆点)
- 离线: `●` (灰色圆点)
- 错误: `●` (红色圆点)

### 7. 权限模式显示

当前权限模式（非 default 时显示）：

```tsx
<StatusBar
  permissionMode="acceptEdits"
/>
```

**显示效果：** `[acceptEdits]` (品红色)

支持的模式：
- `acceptEdits` - 自动接受编辑
- `bypassPermissions` - 绕过权限检查
- `plan` - 计划模式
- `delegate` - 委托模式
- `dontAsk` - 不询问模式
- `default` - 默认模式（不显示）

### 8. Git 分支显示

显示当前 Git 分支（第二行）：

```tsx
<StatusBar
  gitBranch="feature/status-bar-enhancement"
/>
```

**显示效果：** `⎇ feature/status-bar-enhancement` (蓝色分支图标)

### 9. 工作目录显示

显示当前工作目录（第二行，自动缩短）：

```tsx
<StatusBar
  cwd="/home/user/claude-code-open"
/>
```

**显示效果：** `📁 ~/claude-code-open`

路径格式化规则：
- 用户主目录替换为 `~`
- 超过 3 层的路径显示为 `.../最后两层`
- 示例: `/very/long/path/to/project` → `.../to/project`

## 完整接口定义

```typescript
interface StatusBarProps {
  // 基础信息
  messageCount: number;           // 必需：消息数量
  tokenCount?: number;            // 可选：总 Token 数（旧版兼容）
  inputTokens?: number;           // 可选：输入 Token 数
  outputTokens?: number;          // 可选：输出 Token 数
  cost?: string;                  // 可选：费用（格式化字符串）
  duration?: number;              // 可选：会话时长（毫秒）
  isProcessing?: boolean;         // 可选：是否正在处理

  // 模型信息
  model?: string;                 // 可选：完整模型名称
  modelDisplayName?: string;      // 可选：简短显示名称

  // 上下文使用
  contextUsed?: number;           // 可选：已使用上下文 Token
  contextMax?: number;            // 可选：最大上下文 Token
  contextPercentage?: number;     // 可选：使用百分比

  // 网络状态
  networkStatus?: 'online' | 'offline' | 'error';  // 可选：网络状态
  lastApiCall?: number;           // 可选：最后 API 调用时间戳

  // 权限模式
  permissionMode?: string;        // 可选：权限模式

  // Git 信息
  gitBranch?: string;             // 可选：Git 分支名

  // 工作目录
  cwd?: string;                   // 可选：当前工作目录
}
```

## 使用示例

### 基础使用（向后兼容）

```tsx
import { StatusBar } from './ui/components/StatusBar';

<StatusBar
  messageCount={10}
  tokenCount={5234}
  cost="$0.0234"
  duration={125000}
/>
```

### 完整功能示例

```tsx
<StatusBar
  // 会话统计
  messageCount={42}
  inputTokens={125000}
  outputTokens={45000}
  cost="$0.1523"
  duration={3600000}
  isProcessing={true}

  // 模型和配置
  model="claude-sonnet-4.5-20241022"
  permissionMode="acceptEdits"

  // 上下文监控
  contextUsed={120000}
  contextMax={180000}
  contextPercentage={66.67}

  // 网络和环境
  networkStatus="online"
  gitBranch="feature/awesome-feature"
  cwd="/home/user/my-project"
/>
```

### 集成到 Session 对象

```tsx
import { Session } from '../core/session';
import { estimateTotalTokens } from '../context';

const MyApp = () => {
  const session = new Session();
  const stats = session.getStats();
  const messages = session.getMessages();
  const contextUsed = estimateTotalTokens(messages);

  return (
    <StatusBar
      messageCount={stats.messageCount}
      cost={stats.totalCost}
      duration={stats.duration}
      contextUsed={contextUsed}
      contextMax={180000}
      contextPercentage={(contextUsed / 180000) * 100}
      cwd={session.cwd}
      gitBranch={session.getGitBranch?.()}
    />
  );
};
```

## 布局结构

StatusBar 采用双行布局：

```
┌─────────────────────────────────────────────────────────────────┐
│ sonnet-4.5  10 msgs  125.0K/45.0K tokens  $0.1523  ctx: 67%    │
│                                             1h 15m  ●  [plan]   │
└─────────────────────────────────────────────────────────────────┘
  ⎇ feature/awesome  📁 ~/my-project
```

- **第一行（主要信息）**：模型、消息数、Token、费用、上下文、时长、网络、权限
- **第二行（环境信息）**：Git 分支、工作目录（仅在提供时显示）

## 性能优化

所有格式化函数都是纯函数，不会触发额外渲染：

- `formatDuration()` - 时长格式化
- `formatTokens()` - Token 数量格式化
- `formatCwd()` - 路径格式化
- `getModelDisplay()` - 模型名称提取
- `getNetworkIndicator()` - 网络状态映射
- `getContextColor()` - 上下文颜色选择

## 颜色主题

组件使用统一的颜色方案：

- **青色 (cyan)**: 模型名称、文件夹图标
- **白色 (white)**: 数值、时长
- **灰色 (gray)**: 标签、次要信息
- **绿色 (green)**: 费用、安全状态、在线
- **黄色 (yellow)**: 警告、处理中
- **红色 (red)**: 危险、错误
- **蓝色 (blue)**: Git 分支
- **品红 (magenta)**: 权限模式

## 迁移指南

### 从旧版本升级

旧的 StatusBar 仍然完全兼容：

```tsx
// 旧版本（继续工作）
<StatusBar
  messageCount={10}
  tokenCount={5234}
  cost="$0.0234"
  duration={125000}
  isProcessing={false}
/>
```

### 逐步添加新功能

可以渐进式添加新 props：

```tsx
// 第一步：添加模型信息
<StatusBar
  {...oldProps}
  model="claude-sonnet-4.5"
/>

// 第二步：添加上下文监控
<StatusBar
  {...oldProps}
  model="claude-sonnet-4.5"
  contextPercentage={67}
/>

// 第三步：添加环境信息
<StatusBar
  {...oldProps}
  model="claude-sonnet-4.5"
  contextPercentage={67}
  gitBranch="main"
  cwd={process.cwd()}
/>
```

## 最佳实践

1. **始终提供 messageCount**：这是唯一必需的 prop
2. **使用 inputTokens/outputTokens 而不是 tokenCount**：提供更详细的信息
3. **计算 contextPercentage**：自动颜色警告帮助用户了解上下文使用情况
4. **动态更新 networkStatus**：基于 API 调用成功/失败状态
5. **显示 Git 分支在开发环境**：帮助用户了解当前工作分支
6. **简化 modelDisplayName**：使用简短名称如 `opus-4.5` 而不是完整 ID

## 参考资料

- [Ink 文档](https://github.com/vadimdemedes/ink)
- [Claude Models](https://docs.anthropic.com/claude/docs/models-overview)
- [Session 管理](/src/core/session.ts)
- [Context 管理](/src/context/index.ts)
