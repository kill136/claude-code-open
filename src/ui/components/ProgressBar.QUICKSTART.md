# ProgressBar 快速开始

## 30 秒快速上手

### 1. 基础进度条

```typescript
import { ProgressBar } from './ui/components';

<ProgressBar
  label="下载中"
  value={45}
/>
```

输出：
```
下载中
[████████████████░░░░░░░░░░░░░░░░░░░░░░░░] 45%
```

---

### 2. 加载动画（不确定进度）

```typescript
<ProgressBar
  label="连接中..."
  indeterminate
/>
```

输出：
```
连接中...
[    ●     ─────────────────────────────]
```

---

### 3. 多进度条

```typescript
import { MultiProgressBar } from './ui/components';

<MultiProgressBar
  bars={[
    { id: '1', label: '任务 1', value: 100, complete: true },
    { id: '2', label: '任务 2', value: 60 },
    { id: '3', label: '任务 3', value: 20 },
  ]}
/>
```

输出：
```
任务 1 ✓
[███████████████████████████████] 100%
任务 2
[███████████████████░░░░░░░░░░░░] 60%
任务 3
[██████░░░░░░░░░░░░░░░░░░░░░░░░░] 20%
```

---

### 4. 紧凑型进度条

```typescript
import { CompactProgressBar } from './ui/components';

<Box gap={1}>
  <Text>CPU:</Text>
  <CompactProgressBar value={75} color="yellow" />
</Box>
```

输出：
```
CPU: ███████████░░░░░ 75%
```

---

## 常用配置

### 样式对照表

| style | 效果 | 适用场景 |
|-------|------|---------|
| `blocks` (默认) | `█░` | 通用，最清晰 |
| `dots` | `●○` | 温和，适合多进度条 |
| `arrows` | `▶▷` | 动感，适合传输任务 |
| `smooth` | `━─` | 简洁，适合嵌入式 |

### 颜色语义

| color | 用途 |
|-------|------|
| `cyan` (默认) | 进行中 |
| `green` | 成功/完成 |
| `yellow` | 警告 |
| `red` | 错误/高负载 |
| `blue` | 信息 |

---

## 实战示例

### 文件下载

```typescript
const [progress, setProgress] = useState(0);
const startTime = Date.now();

<ProgressBar
  label="下载 model.bin"
  value={progress}
  showETA
  startTime={startTime}
  complete={progress >= 100}
/>
```

### 构建流程

```typescript
<MultiProgressBar
  bars={buildSteps.map(step => ({
    id: step.id,
    label: step.name,
    value: step.progress,
    complete: step.done,
    color: step.done ? 'green' : 'cyan'
  }))}
  style="smooth"
/>
```

### 资源监控

```typescript
const resources = [
  { name: 'CPU', value: cpuUsage, threshold: 80 },
  { name: 'RAM', value: ramUsage, threshold: 80 },
  { name: 'DISK', value: diskUsage, threshold: 90 },
];

{resources.map(r => (
  <Box key={r.name} gap={1}>
    <Text>{r.name}:</Text>
    <CompactProgressBar
      value={r.value}
      color={r.value > r.threshold ? 'red' : 'cyan'}
    />
  </Box>
))}
```

---

## Props 速查

### ProgressBar

```typescript
{
  value: number;        // 进度 0-100
  label?: string;       // 标签
  showPercentage?: boolean; // 显示百分比
  showETA?: boolean;    // 显示剩余时间
  style?: 'blocks' | 'dots' | 'arrows' | 'smooth';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan';
  indeterminate?: boolean; // 加载动画
  width?: number;       // 宽度（字符数）
  startTime?: number;   // 开始时间戳
  complete?: boolean;   // 完成状态
}
```

### MultiProgressBar

```typescript
{
  bars: Array<{
    id: string;
    label: string;
    value: number;
    color?: string;
    complete?: boolean;
  }>;
  width?: number;
  showPercentage?: boolean;
  style?: 'blocks' | 'dots' | 'arrows' | 'smooth';
}
```

### CompactProgressBar

```typescript
{
  value: number;
  max?: number;
  width?: number;
  color?: string;
}
```

---

## 小贴士

✅ **推荐做法**
- 使用 `showETA` 让用户知道还要等多久
- 完成时设置 `complete={true}` 提供视觉反馈
- 不知道进度时使用 `indeterminate`
- 多任务用 `MultiProgressBar`
- 嵌入式场景用 `CompactProgressBar`

❌ **避免**
- 过高的更新频率（建议 100-200ms 间隔）
- 在窄终端使用过宽的进度条
- 同时使用 `indeterminate` 和 `value`

---

## 更多信息

完整文档请参阅 `ProgressBar.README.md`
示例代码请参阅 `ProgressBar.example.tsx`
