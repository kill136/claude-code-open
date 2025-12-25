# ProgressBar 组件文档

完整的进度条组件系列，适用于 Claude Code CLI 的终端界面。

## 组件列表

### 1. ProgressBar（主组件）
功能完整的进度条，支持多种样式和配置选项。

### 2. MultiProgressBar
同时显示多个进度条，适合并行任务追踪。

### 3. CompactProgressBar
精简版进度条，适合嵌入其他组件或空间有限的场景。

---

## ProgressBar 组件

### 基础用法

```typescript
import { ProgressBar } from './ui/components/ProgressBar.js';

// 简单进度条
<ProgressBar
  label="下载文件"
  value={45}
  showPercentage={true}
/>

// 完整配置
<ProgressBar
  label="处理任务"
  value={75}
  max={100}
  showPercentage={true}
  showETA={true}
  style="blocks"
  color="cyan"
  width={50}
  startTime={Date.now() - 5000}
/>
```

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `number` | `0` | 当前进度值（0-100） |
| `max` | `number` | `100` | 最大值 |
| `label` | `string` | - | 进度条标签 |
| `showPercentage` | `boolean` | `true` | 是否显示百分比 |
| `showETA` | `boolean` | `false` | 是否显示预计剩余时间 |
| `style` | `'blocks' \| 'dots' \| 'arrows' \| 'smooth'` | `'blocks'` | 进度条样式 |
| `color` | `'blue' \| 'green' \| 'yellow' \| 'red' \| 'cyan' \| 'magenta' \| 'white'` | `'cyan'` | 进度条颜色 |
| `indeterminate` | `boolean` | `false` | 不确定进度模式（显示加载动画） |
| `width` | `number` | `40` | 进度条宽度（字符数） |
| `startTime` | `number` | - | 开始时间（用于计算 ETA，毫秒时间戳） |
| `complete` | `boolean` | `false` | 是否已完成（显示完成动画和✓标记） |

### 样式示例

#### Blocks（默认）
```
下载文件
[████████████████░░░░░░░░░░░░░░░░░░░░░░░░] 40%
```

#### Dots
```
处理中
[●●●●●●●●●●●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○] 40%
```

#### Arrows
```
上传中
[▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷▷] 40%
```

#### Smooth
```
构建中
[━━━━━━━━━━━━━━━━─────────────────────────] 40%
```

### 高级功能

#### 1. 不确定进度（加载动画）
用于不知道具体进度的情况，显示动画效果：

```typescript
<ProgressBar
  label="正在连接服务器..."
  indeterminate={true}
  color="cyan"
/>
```

#### 2. ETA（预计剩余时间）
自动计算并显示预计完成时间：

```typescript
const startTime = Date.now();

<ProgressBar
  label="处理大文件"
  value={progress}
  showETA={true}
  startTime={startTime}
/>
```

输出示例：
```
处理大文件
[████████████░░░░░░░░░░░░░░░░] 45% (ETA: 2m 15s)
```

#### 3. 完成状态动画
当任务完成时，自动显示完成标记和动画：

```typescript
<ProgressBar
  label="任务完成"
  value={100}
  complete={true}
  color="green"
/>
```

输出：
```
任务完成 ✓
[████████████████████████████████████████] 100%
```

---

## MultiProgressBar 组件

显示多个进度条，适合并行任务追踪。

### 用法

```typescript
import { MultiProgressBar } from './ui/components/ProgressBar.js';

<MultiProgressBar
  bars={[
    { id: '1', label: '下载文件 1', value: 100, complete: true, color: 'green' },
    { id: '2', label: '下载文件 2', value: 75, color: 'cyan' },
    { id: '3', label: '下载文件 3', value: 45, color: 'cyan' },
    { id: '4', label: '下载文件 4', value: 10, color: 'cyan' },
  ]}
  width={35}
  showPercentage={true}
  style="blocks"
/>
```

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `bars` | `Array<BarConfig>` | - | 进度条配置数组 |
| `width` | `number` | `30` | 每个进度条的宽度 |
| `showPercentage` | `boolean` | `true` | 是否显示百分比 |
| `style` | `ProgressBarStyle` | `'blocks'` | 进度条样式 |

### BarConfig 接口

```typescript
interface BarConfig {
  id: string;           // 唯一标识
  label: string;        // 标签
  value: number;        // 进度值
  max?: number;         // 最大值（默认 100）
  color?: string;       // 颜色
  complete?: boolean;   // 是否完成
}
```

### 输出示例

```
下载文件 1 ✓
[███████████████████████████████████] 100%
下载文件 2
[██████████████████████████░░░░░░░░░] 75%
下载文件 3
[████████████████░░░░░░░░░░░░░░░░░░░] 45%
下载文件 4
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10%
```

---

## CompactProgressBar 组件

精简版进度条，单行显示，不带标签。

### 用法

```typescript
import { CompactProgressBar } from './ui/components/ProgressBar.js';

<Box gap={1}>
  <Text>CPU:</Text>
  <CompactProgressBar value={45} width={15} color="cyan" />
</Box>

<Box gap={1}>
  <Text>内存:</Text>
  <CompactProgressBar value={78} width={15} color="yellow" />
</Box>

<Box gap={1}>
  <Text>磁盘:</Text>
  <CompactProgressBar value={92} width={15} color="red" />
</Box>
```

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `number` | - | 当前进度值 |
| `max` | `number` | `100` | 最大值 |
| `width` | `number` | `20` | 进度条宽度 |
| `color` | `string` | `'cyan'` | 颜色 |

### 输出示例

```
CPU:  ███████░░░░░░░░ 45%
内存: ████████████░░░ 78%
磁盘: ██████████████░ 92%
```

---

## 实际应用场景

### 1. 文件下载进度

```typescript
const [progress, setProgress] = useState(0);
const startTime = Date.now();

// 模拟下载
useEffect(() => {
  const interval = setInterval(() => {
    setProgress(prev => {
      if (prev >= 100) {
        clearInterval(interval);
        return 100;
      }
      return prev + Math.random() * 5;
    });
  }, 200);
  return () => clearInterval(interval);
}, []);

<ProgressBar
  label="下载 model.bin"
  value={progress}
  showPercentage={true}
  showETA={true}
  startTime={startTime}
  color={progress >= 100 ? 'green' : 'cyan'}
  complete={progress >= 100}
/>
```

### 2. 构建过程追踪

```typescript
<MultiProgressBar
  bars={[
    { id: 'ts', label: 'TypeScript 编译', value: 100, complete: true, color: 'green' },
    { id: 'lint', label: 'ESLint 检查', value: 100, complete: true, color: 'green' },
    { id: 'test', label: '运行测试', value: 65, color: 'cyan' },
    { id: 'bundle', label: '打包资源', value: 20, color: 'cyan' },
  ]}
  style="smooth"
/>
```

### 3. 系统资源监控

```typescript
<Box flexDirection="column" gap={0}>
  <Text bold>系统资源</Text>
  <Box gap={1}>
    <Text>CPU:  </Text>
    <CompactProgressBar value={cpuUsage} color={cpuUsage > 80 ? 'red' : 'cyan'} />
  </Box>
  <Box gap={1}>
    <Text>内存: </Text>
    <CompactProgressBar value={memUsage} color={memUsage > 80 ? 'yellow' : 'cyan'} />
  </Box>
  <Box gap={1}>
    <Text>磁盘: </Text>
    <CompactProgressBar value={diskUsage} color={diskUsage > 90 ? 'red' : 'green'} />
  </Box>
</Box>
```

### 4. 长时间任务状态

```typescript
<ProgressBar
  label="正在分析代码库..."
  indeterminate={!hasStarted}
  value={hasStarted ? progress : 0}
  showPercentage={hasStarted}
  showETA={hasStarted}
  startTime={startTime}
/>
```

---

## 技术细节

### 字符选择

组件使用 Unicode 字符来绘制进度条，确保跨平台兼容性：

- **Blocks**: `█` (完整) `▏▎▍▌▋▊▉` (部分) `░` (空白)
- **Dots**: `●` (完整) `○◔◐◕` (部分) `○` (空白)
- **Arrows**: `▶` (完整) `▷` (空白)
- **Smooth**: `━` (完整) `╸` (部分) `─` (空白)

### 动画实现

不确定进度条使用 `useEffect` 实现 100ms 间隔的帧动画：

```typescript
useEffect(() => {
  if (indeterminate) {
    const interval = setInterval(() => {
      setAnimationFrame((prev) => (prev + 1) % FRAMES.length);
    }, 100);
    return () => clearInterval(interval);
  }
}, [indeterminate]);
```

### ETA 计算

基于已用时间和当前进度自动计算：

```typescript
const elapsed = Date.now() - startTime;
const rate = percentage / elapsed;
const remaining = (100 - percentage) / rate;
```

---

## 最佳实践

### 1. 颜色语义化
- 🔵 `blue` - 信息提示
- 🟢 `green` - 成功/完成
- 🟡 `yellow` - 警告
- 🔴 `red` - 错误/危险
- 🔵 `cyan` - 进行中（默认）

### 2. 合理的宽度
- 小型终端: 20-30 字符
- 标准终端: 40-50 字符
- 宽屏终端: 60-80 字符

### 3. 性能考虑
- 避免过高的更新频率（建议 100-200ms 间隔）
- 使用 `React.memo` 优化多进度条渲染
- 完成后及时清理定时器

### 4. 用户体验
- 长时间任务（>5秒）应显示 ETA
- 不确定进度时使用 `indeterminate` 模式
- 完成时显示 `complete` 状态和动画

---

## 常见问题

### Q: 进度条显示不正常？
A: 检查终端字体是否支持 Unicode 字符，建议使用 Nerd Font 或 Fira Code。

### Q: 如何自定义样式？
A: 可以修改 `STYLE_CHARS` 常量来自定义字符集。

### Q: ETA 计算不准确？
A: ETA 基于线性预测，如果任务速度波动大，可能不准确。建议在稳定速率的任务中使用。

### Q: 如何集成到现有组件？
A: 使用 `CompactProgressBar` 可以轻松嵌入到其他 Ink 组件中。

---

## 贡献者

基于 Claude Code CLI v2.0.76 官方实现，增强了功能和可配置性。

## 许可证

MIT
