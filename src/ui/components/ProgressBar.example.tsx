/**
 * ProgressBar 组件使用示例
 *
 * 展示了 ProgressBar 组件的各种用法
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ProgressBar, MultiProgressBar, CompactProgressBar } from './ProgressBar.js';

/**
 * 基础进度条示例
 */
export const BasicProgressBarExample: React.FC = () => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>基础进度条示例</Text>

      {/* 默认样式 */}
      <ProgressBar
        label="下载文件"
        value={45}
        showPercentage={true}
      />

      {/* 不同颜色 */}
      <ProgressBar
        label="处理中（蓝色）"
        value={60}
        color="blue"
      />

      <ProgressBar
        label="成功（绿色）"
        value={100}
        color="green"
        complete={true}
      />

      <ProgressBar
        label="警告（黄色）"
        value={75}
        color="yellow"
      />

      <ProgressBar
        label="错误（红色）"
        value={30}
        color="red"
      />
    </Box>
  );
};

/**
 * 不同样式的进度条
 */
export const StyledProgressBarExample: React.FC = () => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>不同样式的进度条</Text>

      <ProgressBar
        label="Blocks 样式"
        value={65}
        style="blocks"
      />

      <ProgressBar
        label="Dots 样式"
        value={65}
        style="dots"
      />

      <ProgressBar
        label="Arrows 样式"
        value={65}
        style="arrows"
      />

      <ProgressBar
        label="Smooth 样式"
        value={65}
        style="smooth"
      />
    </Box>
  );
};

/**
 * 动画进度条示例
 */
export const AnimatedProgressBarExample: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>动画进度条</Text>

      <ProgressBar
        label="自动增长"
        value={progress}
        showPercentage={true}
        color="cyan"
      />

      <ProgressBar
        label="带 ETA"
        value={progress}
        showPercentage={true}
        showETA={true}
        startTime={Date.now() - progress * 100}
        color="green"
      />
    </Box>
  );
};

/**
 * 不确定进度条示例
 */
export const IndeterminateProgressBarExample: React.FC = () => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>不确定进度条（加载中）</Text>

      <ProgressBar
        label="正在连接服务器..."
        indeterminate={true}
        color="cyan"
      />

      <ProgressBar
        label="正在处理..."
        indeterminate={true}
        color="yellow"
        width={50}
      />
    </Box>
  );
};

/**
 * 多进度条示例
 */
export const MultiProgressBarExample: React.FC = () => {
  const [bars, setBars] = useState([
    { id: '1', label: '任务 1', value: 100, complete: true, color: 'green' as const },
    { id: '2', label: '任务 2', value: 75, complete: false, color: 'cyan' as const },
    { id: '3', label: '任务 3', value: 45, complete: false, color: 'cyan' as const },
    { id: '4', label: '任务 4', value: 10, complete: false, color: 'cyan' as const },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBars((prevBars) =>
        prevBars.map((bar) => {
          if (bar.complete) return bar;
          const newValue = Math.min(100, bar.value + Math.random() * 5);
          const isComplete = newValue >= 100;
          return {
            ...bar,
            value: newValue,
            complete: isComplete,
            color: isComplete ? ('green' as const) : ('cyan' as const),
          };
        })
      );
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>多进度条</Text>
      <MultiProgressBar
        bars={bars}
        width={35}
        showPercentage={true}
        style="blocks"
      />
    </Box>
  );
};

/**
 * 紧凑型进度条示例
 */
export const CompactProgressBarExample: React.FC = () => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>紧凑型进度条</Text>

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
    </Box>
  );
};

/**
 * 完整示例应用
 */
export const ProgressBarDemo: React.FC = () => {
  return (
    <Box flexDirection="column" gap={2} padding={1}>
      <Text bold color="cyan">━━━ ProgressBar 组件演示 ━━━</Text>

      <BasicProgressBarExample />
      <StyledProgressBarExample />
      <AnimatedProgressBarExample />
      <IndeterminateProgressBarExample />
      <MultiProgressBarExample />
      <CompactProgressBarExample />
    </Box>
  );
};

export default ProgressBarDemo;
