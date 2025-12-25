# Spinner Component - Quick Reference

## 🎯 Overview

Enhanced Spinner component with 15+ animation types, status management, progress tracking, and multi-task support.

**File**: `/home/user/claude-code-open/src/ui/components/Spinner.tsx`
**Lines**: 205 (expanded from 36)
**Version**: 2.0 Enhanced

## ⚡ Quick Start

```tsx
import { Spinner, MultiSpinner, StatusIndicator } from './ui/components';

// Basic loading
<Spinner label="Loading..." />

// With progress
<Spinner label="Downloading" progress={65} showElapsed={true} />

// Multi-task
<MultiSpinner tasks={[
  { id: '1', label: 'Install', status: 'success', progress: 100 },
  { id: '2', label: 'Build', status: 'loading', progress: 45 }
]} />
```

## 🎨 Animation Types (15+)

```tsx
type SpinnerType =
  | 'dots'          // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ (default)
  | 'line'          // -\|/
  | 'arc'           // ◜◠◝◞◡◟
  | 'circle'        // ◐◓◑◒
  | 'dots2'         // ⣾⣽⣻⢿⡿⣟⣯⣷
  | 'dots3'         // ⠋⠙⠚⠞⠖⠦⠴⠲⠳⠓
  | 'bounce'        // ⠁⠂⠄⠂
  | 'box'           // ▖▘▝▗
  | 'hamburger'     // ☱☲☴
  | 'moon'          // 🌑🌒🌓🌔🌕🌖🌗🌘
  | 'earth'         // 🌍🌎🌏
  | 'clock'         // 🕐🕑🕒...🕛
  | 'arrow'         // ←↖↑↗→↘↓↙
  | 'bouncingBar'   // [    ] [=   ] [==  ]...
  | 'bouncingBall'; // ( ●    ) (  ●   )...
```

## 📊 Status Types (5)

```tsx
type SpinnerStatus =
  | 'loading'   // ⠋ (cyan)   - In progress
  | 'success'   // ✓ (green)  - Completed successfully
  | 'error'     // ✗ (red)    - Failed with error
  | 'warning'   // ⚠ (yellow) - Completed with warning
  | 'info';     // ℹ (blue)   - Information
```

## 🎁 Components

### 1. Spinner (Main Component)

```tsx
interface SpinnerProps {
  label?: string;                    // Text label
  type?: keyof typeof SPINNER_TYPES; // Animation type (default: 'dots')
  color?: string;                    // Custom color (overrides status color)
  status?: SpinnerStatus;            // Status (default: 'loading')
  progress?: number;                 // Progress 0-100
  showElapsed?: boolean;             // Show elapsed time (default: false)
  startTime?: number;                // Start timestamp (default: Date.now())
  dimLabel?: boolean;                // Dim the label text (default: false)
}
```

**Examples**:

```tsx
// Basic
<Spinner label="Loading..." />

// With progress
<Spinner label="Processing" progress={75} />

// With timer
<Spinner
  label="Building"
  showElapsed={true}
  startTime={Date.now() - 5000}
/>

// Custom animation
<Spinner label="Waiting" type="moon" color="yellow" />

// Status indicator
<Spinner label="Completed" status="success" />
```

### 2. MultiSpinner (Multi-Task Component)

```tsx
interface MultiSpinnerProps {
  tasks: Task[];                     // Array of tasks
  type?: keyof typeof SPINNER_TYPES; // Default animation type
  showElapsed?: boolean;             // Show elapsed time for all
  compact?: boolean;                 // Compact mode (less padding)
}

interface Task {
  id: string;                        // Unique task ID
  label: string;                     // Task description
  status: SpinnerStatus;             // Task status
  progress?: number;                 // Progress 0-100
  startTime?: number;                // Start timestamp
  type?: keyof typeof SPINNER_TYPES; // Override animation type
}
```

**Example**:

```tsx
<MultiSpinner
  tasks={[
    {
      id: '1',
      label: 'Installing dependencies',
      status: 'success',
      progress: 100
    },
    {
      id: '2',
      label: 'Building project',
      status: 'loading',
      progress: 45,
      type: 'arc'
    },
    {
      id: '3',
      label: 'Running tests',
      status: 'loading',
      progress: 0
    }
  ]}
  showElapsed={true}
/>
```

Output:
```
✓ Installing dependencies (100%)
◜ Building project (45%) [3s]
⠋ Running tests (0%) [1s]
```

### 3. StatusIndicator (Status Display)

```tsx
interface StatusIndicatorProps {
  status: SpinnerStatus;  // Status type
  label?: string;         // Optional label
  color?: string;         // Custom color (overrides status color)
  showIcon?: boolean;     // Show status icon (default: true)
}
```

**Examples**:

```tsx
<StatusIndicator status="success" label="All tests passed" />
<StatusIndicator status="error" label="Build failed" />
<StatusIndicator status="warning" label="3 warnings" showIcon={true} />
```

## 📖 Common Use Cases

### File Download Progress

```tsx
const [progress, setProgress] = useState(0);
const startTime = useRef(Date.now());

<Spinner
  label="Downloading file.zip"
  type="dots"
  progress={progress}
  showElapsed={true}
  startTime={startTime.current}
/>
```

### Build Pipeline

```tsx
const steps = [
  { id: '1', label: 'Clean', status: 'success', progress: 100 },
  { id: '2', label: 'TypeScript', status: 'loading', progress: 60 },
  { id: '3', label: 'Bundle', status: 'loading', progress: 0 },
];

<MultiSpinner tasks={steps} showElapsed={true} />
```

### API Request

```tsx
const [status, setStatus] = useState<SpinnerStatus>('loading');

useEffect(() => {
  fetch('/api/data')
    .then(() => setStatus('success'))
    .catch(() => setStatus('error'));
}, []);

<Spinner label="Fetching data" status={status} type="circle" />
```

## 🎯 Best Practices

1. **Choose appropriate animation**: Use `dots` for simple tasks, `moon`/`earth` for visual appeal
2. **Show progress for long tasks**: Enable `showElapsed` and `progress` for operations > 3s
3. **Use status transitions**: Update status to `success`/`error` when task completes
4. **Multi-task management**: Use `MultiSpinner` instead of multiple `Spinner` instances
5. **Compact mode**: Use `compact={true}` when space is limited

## 🔧 Exports

```tsx
// Components
export { Spinner, MultiSpinner, StatusIndicator }

// Types
export type {
  SpinnerProps,
  SpinnerStatus,
  Task,
  MultiSpinnerProps,
  StatusIndicatorProps
}

// Constants
export { SPINNER_TYPES, STATUS_ICONS, STATUS_COLORS }
```

## 📚 Related Components

- **ProgressBar**: For detailed progress visualization with ETA
  - Use with Spinner for combined status + progress display
- **StatusBar**: For application-wide status display
- **TodoList**: For task management with status indicators

## ⚙️ Performance

- **Animation**: 80ms interval (~12.5 FPS)
- **Timer**: 100ms interval (10 updates/sec)
- **Auto-cleanup**: Timers cleared on unmount
- **Conditional rendering**: Animation stops when status != 'loading'

## 🐛 Troubleshooting

**Q: Animation not showing?**
- Check that `status` is set to `'loading'`
- Verify `type` is a valid spinner type

**Q: Timer not updating?**
- Ensure `showElapsed={true}`
- Check `startTime` is a valid timestamp

**Q: Colors not working?**
- Custom `color` overrides status colors
- Use status colors by omitting `color` prop

## 📄 Documentation

- **Full Guide**: `/home/user/claude-code-open/docs/examples/spinner-usage.md`
- **Demo**: `/home/user/claude-code-open/examples/spinner-demo.tsx`
- **Summary**: `/home/user/claude-code-open/docs/components/Spinner-Enhancement-Summary.md`

---

**Last Updated**: 2025-12-24
**Component Version**: 2.0 (Enhanced)
**Compatibility**: Claude Code CLI v2.0.76+
