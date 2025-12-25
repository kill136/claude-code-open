# TodoList Component - Quick Reference Card

## Basic Import
```tsx
import { TodoList } from './ui/components/TodoList';
import type { TodoItem } from './types';
```

## Minimal Usage
```tsx
<TodoList todos={todos} />
```

## Props Quick Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `todos` | `TodoItem[]` | **Required** | Array of todo items |
| `showCompleted` | `boolean` | `false` | Show completed tasks |
| `enableKeyboardNav` | `boolean` | `true` | Enable ↑↓ navigation |
| `showProgressBar` | `boolean` | `true` | Show progress bar |
| `groupByStatus` | `boolean` | `true` | Group by status |
| `animationDelay` | `number` | `50` | Animation delay (ms) |

## TodoItem Interface
```tsx
interface TodoItem {
  content: string;      // Task description
  activeForm: string;   // Present continuous form
  status: 'pending' | 'in_progress' | 'completed';
}
```

## Status Icons & Colors

| Status | Icon | Color | Usage |
|--------|------|-------|-------|
| `pending` | ○ | Gray | Not started |
| `in_progress` | ◐ | Yellow | Currently working |
| `completed` | ● | Green | Finished |

## Common Patterns

### Show All Tasks
```tsx
<TodoList todos={todos} showCompleted={true} />
```

### Simple List (No Grouping)
```tsx
<TodoList todos={todos} groupByStatus={false} />
```

### Minimal Display
```tsx
<TodoList
  todos={todos}
  showProgressBar={false}
  enableKeyboardNav={false}
/>
```

### Fast Animation
```tsx
<TodoList todos={todos} animationDelay={20} />
```

### No Animation
```tsx
<TodoList todos={todos} animationDelay={0} />
```

## Task Example
```tsx
const todos: TodoItem[] = [
  {
    content: 'Run tests',
    activeForm: 'Running tests',
    status: 'in_progress'
  },
  {
    content: 'Build project',
    activeForm: 'Building project',
    status: 'pending'
  }
];
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| ↑ | Move up |
| ↓ | Move down |

## Visual Output Example

```
┌─────────────────────────────────┐
│ Tasks                           │
│                                 │
│ Progress: 2/5 (40%)             │
│ ████████████████░░░░░░░░░░░░░░░│
│                                 │
│ ⚡ In Progress (1)              │
│   ▶ ◐ Running tests             │
│                                 │
│ 📋 Pending (2)                 │
│     ○ Build project            │
│     ○ Deploy to staging        │
│                                 │
│ Use ↑↓ to navigate             │
└─────────────────────────────────┘
```

## Tips

✅ **DO:**
- Use present continuous for `activeForm` ("Running tests")
- Use imperative for `content` ("Run tests")
- Include completed tasks in array for accurate progress
- Set `animationDelay={0}` for large lists

❌ **DON'T:**
- Mix tenses in activeForm/content
- Remove completed tasks (use `showCompleted` instead)
- Use very long delays (>200ms)

## More Info

- Full Docs: `docs/TodoList-Component-Enhancement.md`
- Examples: `examples/TodoList-Usage-Example.tsx`
- Summary: `docs/TodoList-Enhancement-Summary.md`
