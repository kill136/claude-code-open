#!/usr/bin/env node
/**
 * Spinner 组件演示
 * 展示各种 Spinner 样式和功能
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import {
  Spinner,
  MultiSpinner,
  StatusIndicator,
  SPINNER_TYPES,
  type Task,
  type SpinnerStatus
} from '../src/ui/components/index.js';

const SpinnerDemo: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      label: 'Installing dependencies',
      status: 'loading',
      progress: 0,
      startTime: Date.now(),
      type: 'dots'
    },
    {
      id: '2',
      label: 'Building project',
      status: 'loading',
      progress: 0,
      startTime: Date.now(),
      type: 'arc'
    },
    {
      id: '3',
      label: 'Running tests',
      status: 'loading',
      progress: 0,
      startTime: Date.now(),
      type: 'circle'
    }
  ]);

  // 模拟进度更新
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1;
      });

      // 更新任务进度
      setTasks((prevTasks) =>
        prevTasks.map((task, index) => {
          const taskProgress = Math.min(100, progress + index * 10);
          let status: SpinnerStatus = 'loading';

          if (taskProgress >= 100) {
            status = 'success';
          }

          return {
            ...task,
            progress: taskProgress,
            status
          };
        })
      );
    }, 100);

    return () => clearInterval(timer);
  }, [progress]);

  const spinnerTypes = Object.keys(SPINNER_TYPES) as Array<keyof typeof SPINNER_TYPES>;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Spinner Component Demo</Text>
      <Text dimColor>Press Ctrl+C to exit</Text>
      <Box marginY={1} />

      {/* 基础 Spinner */}
      <Box flexDirection="column">
        <Text bold>1. Basic Spinners with Different Types:</Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          {spinnerTypes.slice(0, 8).map((type) => (
            <Spinner key={type} label={`Type: ${type}`} type={type} />
          ))}
        </Box>
      </Box>

      {/* 带进度的 Spinner */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>2. Spinner with Progress:</Text>
        <Box marginLeft={2} marginY={1}>
          <Spinner
            label="Downloading..."
            type="dots"
            progress={progress}
            showElapsed={true}
            startTime={Date.now() - 5000}
          />
        </Box>
      </Box>

      {/* 状态显示 */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>3. Status Indicators:</Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <StatusIndicator status="success" label="Task completed successfully" />
          <StatusIndicator status="error" label="Task failed with errors" />
          <StatusIndicator status="warning" label="Task completed with warnings" />
          <StatusIndicator status="info" label="Task information" />
        </Box>
      </Box>

      {/* 多任务 Spinner */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>4. Multi-Task Progress:</Text>
        <Box marginLeft={2} marginY={1}>
          <MultiSpinner tasks={tasks} showElapsed={true} />
        </Box>
      </Box>

      {/* 特殊动画 */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>5. Special Animations:</Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <Spinner label="Moon phases" type="moon" color="yellow" />
          <Spinner label="Earth rotation" type="earth" color="blue" />
          <Spinner label="Clock" type="clock" color="cyan" />
          <Spinner label="Bouncing ball" type="bouncingBall" color="green" />
        </Box>
      </Box>

      {/* 进度条 */}
      <Box flexDirection="column" marginY={1}>
        <Text bold>6. Progress: {progress}%</Text>
        <Box marginLeft={2}>
          <Text color="cyan">
            [{'█'.repeat(Math.floor(progress / 5))}{'░'.repeat(20 - Math.floor(progress / 5))}]
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

// 渲染组件
const { unmount } = render(<SpinnerDemo />);

// 自动退出
setTimeout(() => {
  unmount();
  process.exit(0);
}, 30000); // 30秒后退出
