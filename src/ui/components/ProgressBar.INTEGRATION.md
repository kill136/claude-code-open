# ProgressBar 组件集成指南

## 在 Claude Code CLI 中使用 ProgressBar

### 1. 导入组件

```typescript
// 方式 1: 从组件目录导入
import { ProgressBar, MultiProgressBar, CompactProgressBar } from './ui/components/ProgressBar.js';

// 方式 2: 从统一导出导入
import { ProgressBar, MultiProgressBar, CompactProgressBar } from './ui/components/index.js';

// 导入类型
import type { ProgressBarProps, MultiProgressBarProps, CompactProgressBarProps } from './ui/components/index.js';
```

---

## 2. 在工具中使用

### 示例：Bash 工具的命令执行进度

```typescript
// src/tools/bash.ts
import React, { useState, useEffect } from 'react';
import { ProgressBar } from '../ui/components/index.js';

export const BashToolUI: React.FC<{ command: string }> = ({ command }) => {
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // 模拟命令执行进度
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setComplete(true);
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <ProgressBar
      label={`执行: ${command}`}
      value={progress}
      showPercentage
      color={complete ? 'green' : 'cyan'}
      complete={complete}
      style="smooth"
    />
  );
};
```

---

## 3. 在会话管理中使用

### 示例：显示多文件处理进度

```typescript
// src/session/processor.tsx
import React from 'react';
import { MultiProgressBar } from '../ui/components/index.js';

interface FileProcessStatus {
  id: string;
  filename: string;
  progress: number;
  complete: boolean;
}

export const FileProcessorUI: React.FC<{ files: FileProcessStatus[] }> = ({ files }) => {
  return (
    <MultiProgressBar
      bars={files.map(file => ({
        id: file.id,
        label: file.filename,
        value: file.progress,
        complete: file.complete,
        color: file.complete ? 'green' : 'cyan',
      }))}
      width={40}
      showPercentage
      style="blocks"
    />
  );
};
```

---

## 4. 在主 UI 中使用

### 示例：集成到 StatusBar

```typescript
// src/ui/components/StatusBar.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { CompactProgressBar } from './ProgressBar.js';

export const EnhancedStatusBar: React.FC<{
  messageCount: number;
  tokenCount?: number;
  tokenLimit?: number;
  cost?: string;
}> = ({ messageCount, tokenCount, tokenLimit = 100000, cost }) => {
  const tokenPercentage = tokenCount ? (tokenCount / tokenLimit) * 100 : 0;

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={2}>
        <Text color="gray">Messages: {messageCount}</Text>

        {tokenCount !== undefined && (
          <Box gap={1}>
            <Text color="gray">Tokens:</Text>
            <CompactProgressBar
              value={tokenPercentage}
              width={20}
              color={tokenPercentage > 80 ? 'yellow' : 'cyan'}
            />
            <Text color="gray">
              {tokenCount.toLocaleString()}/{tokenLimit.toLocaleString()}
            </Text>
          </Box>
        )}

        {cost && <Text color="green">Cost: {cost}</Text>}
      </Box>
    </Box>
  );
};
```

---

## 5. 实际工具集成案例

### A. WebFetch 工具 - 下载进度

```typescript
// src/tools/webfetch.ts
import { ProgressBar } from '../ui/components/index.js';

export class WebFetchTool extends BaseTool {
  async execute(params: WebFetchParams) {
    const startTime = Date.now();
    let progress = 0;

    // 显示进度
    this.renderProgress(
      <ProgressBar
        label={`下载 ${params.url}`}
        value={progress}
        showETA
        startTime={startTime}
        style="arrows"
      />
    );

    // 执行下载...
    const response = await fetch(params.url);

    // 更新进度
    progress = 100;
    this.renderProgress(
      <ProgressBar
        label={`下载完成`}
        value={progress}
        complete
        color="green"
      />
    );

    return response;
  }
}
```

### B. Task 工具 - 多步骤任务

```typescript
// src/tools/task.ts
import { MultiProgressBar } from '../ui/components/index.js';

export class TaskTool extends BaseTool {
  async execute(params: TaskParams) {
    const steps = [
      { id: '1', name: '分析任务', progress: 0, complete: false },
      { id: '2', name: '执行操作', progress: 0, complete: false },
      { id: '3', name: '验证结果', progress: 0, complete: false },
      { id: '4', name: '生成报告', progress: 0, complete: false },
    ];

    // 显示多步骤进度
    this.renderProgress(
      <MultiProgressBar
        bars={steps.map(s => ({
          id: s.id,
          label: s.name,
          value: s.progress,
          complete: s.complete,
        }))}
      />
    );

    // 执行各个步骤...
    for (const step of steps) {
      await this.executeStep(step);
      step.progress = 100;
      step.complete = true;

      // 更新进度显示
      this.renderProgress(
        <MultiProgressBar
          bars={steps.map(s => ({
            id: s.id,
            label: s.name,
            value: s.progress,
            complete: s.complete,
            color: s.complete ? 'green' : 'cyan',
          }))}
        />
      );
    }
  }
}
```

### C. NotebookEdit 工具 - 单元格处理

```typescript
// src/tools/notebook-edit.ts
import { ProgressBar } from '../ui/components/index.js';

export class NotebookEditTool extends BaseTool {
  async execute(params: NotebookEditParams) {
    const totalCells = await this.getCellCount(params.notebook_path);
    let processedCells = 0;

    // 不确定进度 - 加载笔记本
    this.renderProgress(
      <ProgressBar
        label="加载笔记本..."
        indeterminate
      />
    );

    const notebook = await this.loadNotebook(params.notebook_path);

    // 确定进度 - 处理单元格
    for (const cell of notebook.cells) {
      processedCells++;

      this.renderProgress(
        <ProgressBar
          label={`处理单元格 ${processedCells}/${totalCells}`}
          value={(processedCells / totalCells) * 100}
          showPercentage
          color="cyan"
        />
      );

      await this.processCell(cell);
    }

    // 完成
    this.renderProgress(
      <ProgressBar
        label="笔记本处理完成"
        value={100}
        complete
        color="green"
      />
    );
  }
}
```

---

## 6. 最佳实践

### 渐进式增强

```typescript
// 初始状态 - 不确定进度
<ProgressBar label="初始化..." indeterminate />

// 获得进度信息后 - 确定进度
<ProgressBar label="处理中" value={45} showPercentage />

// 长时间任务 - 添加 ETA
<ProgressBar label="处理中" value={45} showETA startTime={startTime} />

// 完成 - 显示成功
<ProgressBar label="完成" value={100} complete color="green" />
```

### 错误处理

```typescript
const [error, setError] = useState<string | null>(null);
const [progress, setProgress] = useState(0);

if (error) {
  return (
    <Box flexDirection="column">
      <ProgressBar
        label="任务失败"
        value={progress}
        color="red"
      />
      <Text color="red">{error}</Text>
    </Box>
  );
}

return (
  <ProgressBar
    label="处理中"
    value={progress}
    color="cyan"
  />
);
```

### 性能优化

```typescript
import React, { memo } from 'react';

// 使用 memo 避免不必要的重渲染
const MemoizedProgressBar = memo(ProgressBar);

// 限制更新频率
const updateProgress = useMemo(() => {
  let lastUpdate = 0;
  return (newProgress: number) => {
    const now = Date.now();
    if (now - lastUpdate > 100) { // 最多每 100ms 更新一次
      setProgress(newProgress);
      lastUpdate = now;
    }
  };
}, []);
```

---

## 7. 样式自定义

### 扩展样式字符集

如果需要添加新样式，可以修改 `STYLE_CHARS` 常量：

```typescript
const CUSTOM_STYLE_CHARS = {
  ...STYLE_CHARS,
  star: {
    complete: '★',
    partial: ['☆', '⯪', '⯪', '★'],
    incomplete: '☆',
  },
};
```

### 自定义颜色主题

```typescript
// 根据不同场景使用不同颜色
const getProgressColor = (percentage: number): ProgressBarProps['color'] => {
  if (percentage >= 100) return 'green';
  if (percentage >= 80) return 'cyan';
  if (percentage >= 50) return 'yellow';
  return 'red';
};

<ProgressBar
  value={progress}
  color={getProgressColor(progress)}
/>
```

---

## 8. 测试建议

### 单元测试示例

```typescript
import { render } from 'ink-testing-library';
import { ProgressBar } from './ProgressBar.js';

describe('ProgressBar', () => {
  it('显示正确的百分比', () => {
    const { lastFrame } = render(
      <ProgressBar value={50} showPercentage />
    );

    expect(lastFrame()).toContain('50%');
  });

  it('完成时显示勾号', () => {
    const { lastFrame } = render(
      <ProgressBar value={100} complete label="Done" />
    );

    expect(lastFrame()).toContain('✓');
  });
});
```

---

## 9. 故障排查

### 问题：进度条显示乱码

**原因：** 终端不支持 Unicode 字符
**解决：** 使用支持 Unicode 的终端，或切换到 `smooth` 样式

### 问题：进度条更新卡顿

**原因：** 更新频率过高
**解决：** 限制更新频率到 100-200ms 间隔

### 问题：ETA 显示不准确

**原因：** 任务速度波动大，或 startTime 设置不正确
**解决：** 确保 startTime 在任务开始时设置，或禁用 ETA 显示

---

## 10. 下一步

- 阅读完整文档：`ProgressBar.README.md`
- 查看示例代码：`ProgressBar.example.tsx`
- 快速参考：`ProgressBar.QUICKSTART.md`

---

## 支持

如有问题或建议，请参考项目 GitHub Issues。
