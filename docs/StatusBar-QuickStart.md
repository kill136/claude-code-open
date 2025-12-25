# StatusBar 组件增强 - 快速开始

## 🚀 30 秒快速了解

StatusBar 组件已从基础状态栏升级为功能完整的增强版，显示：

```
┌────────────────────────────────────────────────────────────┐
│ sonnet-4.5  42 msgs  125K/45K  $0.15  ctx:67%  1h15m  ●   │
└────────────────────────────────────────────────────────────┘
  ⎇ main  📁 ~/my-project
```

**包含 9 大功能**：模型 | Token | 费用 | 时长 | 上下文 | 网络 | 权限 | Git | 目录

---

## 📦 文件位置

- **组件**: `/home/user/claude-code-open/src/ui/components/StatusBar.tsx`
- **文档**: `/home/user/claude-code-open/docs/StatusBar-Enhancement.md`
- **集成指南**: `/home/user/claude-code-open/docs/StatusBar-Integration.md`
- **示例**: `/home/user/claude-code-open/src/ui/components/StatusBar.example.tsx`

---

## 💡 基础用法

```typescript
import { StatusBar } from './ui/components/StatusBar';

<StatusBar
  messageCount={42}              // 必需
  inputTokens={125000}           // 可选：输入 Token
  outputTokens={45000}           // 可选：输出 Token
  cost="$0.1523"                 // 可选：费用
  duration={3600000}             // 可选：会话时长（毫秒）
  model="claude-sonnet-4.5"      // 可选：模型名称
  contextPercentage={67}         // 可选：上下文使用率
  networkStatus="online"         // 可选：网络状态
  permissionMode="acceptEdits"   // 可选：权限模式
  gitBranch="main"               // 可选：Git 分支
  cwd="/home/user/project"       // 可选：工作目录
/>
```

---

## 🎨 主要特性

### 1. 智能格式化
- **Token**: `125000` → `125.0K`
- **时长**: `3600000ms` → `1h 0m`
- **路径**: `/home/user/very/long/path` → `~/very/long/path`

### 2. 颜色警告
- **上下文 < 70%**: 🟢 绿色（安全）
- **上下文 70-89%**: 🟡 黄色（警告）
- **上下文 ≥ 90%**: 🔴 红色（危险）

### 3. 网络状态
- **在线**: ● 绿色
- **离线**: ● 灰色
- **错误**: ● 红色

---

## 📖 深入阅读

| 需求 | 文档 |
|------|------|
| 详细功能说明 | `StatusBar-Enhancement.md` |
| 如何集成到 App | `StatusBar-Integration.md` |
| 项目总结报告 | `StatusBar-Enhancement-Summary.md` |
| 代码示例 | `StatusBar.example.tsx` |
| 测试运行 | `StatusBar.test.tsx` |

---

## ⚡ 快速测试

```bash
# 编译项目
npm run build

# 运行开发模式
npm run dev

# 运行测试（如果配置）
node src/ui/components/StatusBar.test.tsx
```

---

## 🔧 集成到现有代码

### 最小集成（3 步）

**1. 导入**
```typescript
import { StatusBar } from './ui/components/StatusBar';
```

**2. 添加状态**
```typescript
const [sessionStartTime] = useState(Date.now());
const [totalTokens, setTotalTokens] = useState(0);
```

**3. 使用组件**
```typescript
<StatusBar
  messageCount={messages.length}
  tokenCount={totalTokens}
  duration={Date.now() - sessionStartTime}
/>
```

完整集成请参考 `StatusBar-Integration.md`。

---

## 🆕 新增 Props

| Prop | 类型 | 描述 |
|------|------|------|
| `inputTokens` | `number` | 输入 Token 数 |
| `outputTokens` | `number` | 输出 Token 数 |
| `model` | `string` | 模型名称 |
| `modelDisplayName` | `string` | 简短模型名 |
| `contextUsed` | `number` | 已用上下文 |
| `contextMax` | `number` | 最大上下文 |
| `contextPercentage` | `number` | 上下文百分比 |
| `networkStatus` | `'online' \| 'offline' \| 'error'` | 网络状态 |
| `lastApiCall` | `number` | 最后 API 调用时间 |
| `permissionMode` | `string` | 权限模式 |
| `gitBranch` | `string` | Git 分支 |
| `cwd` | `string` | 工作目录 |

**向后兼容**：所有旧 props 继续工作！

---

## 💰 费用计算示例

```typescript
// Token 统计
const inputTokens = 125000;
const outputTokens = 45000;

// 价格（根据模型）
const inputPrice = 3.0;   // $3/MTok (Sonnet)
const outputPrice = 15.0; // $15/MTok

// 计算费用
const cost =
  (inputTokens / 1_000_000) * inputPrice +
  (outputTokens / 1_000_000) * outputPrice;

// 显示
<StatusBar
  inputTokens={inputTokens}
  outputTokens={outputTokens}
  cost={`$${cost.toFixed(4)}`}
/>
```

---

## 🎯 常见场景

### 场景 1: 基础显示（向后兼容）

```typescript
<StatusBar
  messageCount={10}
  tokenCount={5234}
  cost="$0.0234"
/>
```

### 场景 2: 完整功能

```typescript
<StatusBar
  messageCount={messages.length}
  inputTokens={totalInputTokens}
  outputTokens={totalOutputTokens}
  cost={formatCost(totalCost)}
  duration={Date.now() - sessionStart}
  model="claude-sonnet-4.5"
  contextPercentage={getContextPercentage()}
  networkStatus={isOnline ? 'online' : 'error'}
  gitBranch={currentBranch}
  cwd={process.cwd()}
/>
```

### 场景 3: 最小配置

```typescript
<StatusBar messageCount={0} />
```

---

## 🐛 故障排查

### 问题：StatusBar 不显示

**解决**：检查导入和 messageCount prop

```typescript
import { StatusBar } from './ui/components/StatusBar';

<StatusBar messageCount={messages.length} />
```

### 问题：Git 分支不显示

**解决**：确保在 Git 仓库中运行

```bash
cd /path/to/your/git/repo
git rev-parse --abbrev-ref HEAD
```

### 问题：上下文百分比不正确

**解决**：检查 contextMax 是否匹配模型

```typescript
// Claude 4 系列
contextMax={200000}

// Claude 3.5 系列
contextMax={180000}
```

---

## 📞 获取帮助

- **详细文档**: 查看 `StatusBar-Enhancement.md`
- **集成问题**: 参考 `StatusBar-Integration.md`
- **代码示例**: 运行 `StatusBar.example.tsx`
- **测试验证**: 运行 `StatusBar.test.tsx`

---

**开始使用增强的 StatusBar，让你的 CLI 更专业！** 🚀
