# Spinner 组件使用示例

## 概述

增强版 Spinner 组件提供了丰富的加载动画、状态显示、进度跟踪和多任务管理功能。

## 功能特性

### 1. 多种动画样式

组件支持 15+ 种不同的动画类型：

- `dots` - 经典点旋转动画（默认）
- `line` - 直线旋转动画
- `arc` - 弧形动画
- `circle` - 圆形旋转
- `dots2` - 点阵动画 2
- `dots3` - 点阵动画 3
- `bounce` - 弹跳动画
- `box` - 方块动画
- `hamburger` - 汉堡包动画
- `moon` - 月相动画 🌑🌒🌓
- `earth` - 地球旋转 🌍🌎🌏
- `clock` - 时钟动画 🕐🕑🕒
- `arrow` - 箭头旋转
- `bouncingBar` - 弹跳条形
- `bouncingBall` - 弹跳球

### 2. 状态管理

支持 5 种状态类型：

- `loading` - 加载中（默认，青色）
- `success` - 成功完成（绿色，✓）
- `error` - 错误（红色，✗）
- `warning` - 警告（黄色，⚠）
- `info` - 信息（蓝色，ℹ）

### 3. 进度显示

- 百分比进度 (0-100)
- 自动计算进度百分比
- 内联显示进度信息

### 4. 计时器功能

- 显示经过时间
- 自动格式化（秒/分钟/小时）
- 实时更新

### 5. 多任务并行显示

使用 `MultiSpinner` 组件同时显示多个任务的进度。

## 基础用法

### 简单的加载动画

```tsx
import { Spinner } from './ui/components';

<Spinner label="Loading..." />
```

### 选择动画类型

```tsx
<Spinner
  label="Processing"
  type="arc"
  color="green"
/>
```

### 显示进度

```tsx
<Spinner
  label="Downloading"
  progress={65}
  showElapsed={true}
  startTime={Date.now()}
/>
```

输出示例：`⠸ Downloading (65%) [12s]`

### 显示状态

```tsx
// 成功状态
<Spinner
  label="Task completed"
  status="success"
/>

// 错误状态
<Spinner
  label="Task failed"
  status="error"
/>

// 警告状态
<Spinner
  label="Warning occurred"
  status="warning"
/>
```

## 高级用法

### 多任务并行显示

```tsx
import { MultiSpinner, Task } from './ui/components';

const tasks: Task[] = [
  {
    id: '1',
    label: 'Installing dependencies',
    status: 'success',
    progress: 100,
    startTime: Date.now() - 5000,
  },
  {
    id: '2',
    label: 'Building project',
    status: 'loading',
    progress: 45,
    startTime: Date.now() - 3000,
    type: 'dots2',
  },
  {
    id: '3',
    label: 'Running tests',
    status: 'loading',
    progress: 0,
    startTime: Date.now(),
  },
];

<MultiSpinner
  tasks={tasks}
  showElapsed={true}
  compact={false}
/>
```

输出示例：
```
✓ Installing dependencies (100%) [5s]
⣻ Building project (45%) [3s]
⠋ Running tests (0%) [0s]
```

### 状态指示器

```tsx
import { StatusIndicator } from './ui/components';

<StatusIndicator
  status="success"
  label="All tests passed"
/>

<StatusIndicator
  status="error"
  label="Build failed"
  showIcon={true}
/>
```

### 自定义颜色和样式

```tsx
<Spinner
  label="Custom spinner"
  type="moon"
  color="magenta"
  dimLabel={true}
/>
```

## 实际应用场景

### 1. 文件下载进度

```tsx
const [downloadProgress, setDownloadProgress] = useState(0);
const startTime = useRef(Date.now());

<Spinner
  label="Downloading file.zip"
  type="dots"
  progress={downloadProgress}
  showElapsed={true}
  startTime={startTime.current}
/>
```

### 2. 构建流程监控

```tsx
const buildSteps = [
  { id: '1', label: 'Clean', status: 'success' },
  { id: '2', label: 'Compile TypeScript', status: 'loading', progress: 60 },
  { id: '3', label: 'Bundle assets', status: 'loading', progress: 0 },
  { id: '4', label: 'Optimize', status: 'loading', progress: 0 },
];

<MultiSpinner
  tasks={buildSteps}
  type="arc"
  showElapsed={true}
/>
```

### 3. 测试运行状态

```tsx
const testSuites = [
  {
    id: 'unit',
    label: 'Unit tests (45/50)',
    status: 'loading',
    progress: 90,
    type: 'dots2'
  },
  {
    id: 'integration',
    label: 'Integration tests (12/15)',
    status: 'loading',
    progress: 80,
    type: 'dots2'
  },
  {
    id: 'e2e',
    label: 'E2E tests',
    status: 'loading',
    progress: 0,
    type: 'dots2'
  },
];

<MultiSpinner tasks={testSuites} compact={true} />
```

### 4. API 请求状态

```tsx
const [apiStatus, setApiStatus] = useState<SpinnerStatus>('loading');

<Spinner
  label="Fetching data from API"
  type="circle"
  status={apiStatus}
  showElapsed={true}
/>
```

## API 参考

### Spinner Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `label` | `string` | - | 显示的文本标签 |
| `type` | `keyof SPINNER_TYPES` | `'dots'` | 动画类型 |
| `color` | `string` | 根据状态 | 颜色（自动根据状态设置） |
| `status` | `SpinnerStatus` | `'loading'` | 状态类型 |
| `progress` | `number` | - | 进度值 (0-100) |
| `showElapsed` | `boolean` | `false` | 是否显示经过时间 |
| `startTime` | `number` | `Date.now()` | 开始时间戳 |
| `dimLabel` | `boolean` | `false` | 标签文字是否变暗 |

### MultiSpinner Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `tasks` | `Task[]` | - | 任务列表 |
| `type` | `keyof SPINNER_TYPES` | `'dots'` | 默认动画类型 |
| `showElapsed` | `boolean` | `false` | 是否显示经过时间 |
| `compact` | `boolean` | `false` | 紧凑模式 |

### Task 接口

```tsx
interface Task {
  id: string;           // 唯一标识符
  label: string;        // 任务描述
  status: SpinnerStatus; // 任务状态
  progress?: number;    // 进度 (0-100)
  startTime?: number;   // 开始时间戳
  type?: keyof typeof SPINNER_TYPES; // 动画类型（覆盖默认）
}
```

### StatusIndicator Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `status` | `SpinnerStatus` | - | 状态类型 |
| `label` | `string` | - | 显示的文本 |
| `color` | `string` | 根据状态 | 自定义颜色 |
| `showIcon` | `boolean` | `true` | 是否显示状态图标 |

## 性能优化

- 动画使用 80ms 间隔，平衡流畅度和性能
- 计时器使用 100ms 间隔更新
- 使用 React.memo 优化不必要的重渲染
- 状态变化时自动停止动画

## 最佳实践

1. **选择合适的动画类型**：简单任务用 `dots`，视觉吸引力用 `moon` 或 `earth`
2. **适时显示进度**：长时间操作显示进度和计时器
3. **使用状态指示**：任务完成后切换到 `success` 或 `error` 状态
4. **多任务管理**：使用 `MultiSpinner` 而不是多个独立的 `Spinner`
5. **紧凑模式**：在空间有限时使用 `compact={true}`

## 与 ProgressBar 组件配合

Spinner 组件专注于动画和状态，而独立的 ProgressBar 组件提供更详细的进度可视化。两者可以配合使用：

```tsx
import { Spinner } from './ui/components';
import { ProgressBar } from './ui/components';

<Box flexDirection="column">
  <Spinner
    label="Processing large file"
    progress={progress}
    showElapsed={true}
  />
  <Box marginLeft={2}>
    <ProgressBar
      value={progress}
      width={40}
      style="blocks"
      showETA={true}
      startTime={startTime}
    />
  </Box>
</Box>
```

## 总结

增强版 Spinner 组件提供了：

- ✅ 15+ 种动画样式
- ✅ 5 种状态类型（loading, success, error, warning, info）
- ✅ 进度百分比显示
- ✅ 计时器功能（elapsed time）
- ✅ 多任务并行显示
- ✅ 灵活的自定义选项
- ✅ TypeScript 类型安全
- ✅ 与 Ink 框架完美集成

适用于各种加载、进度跟踪和状态显示场景。
