/**
 * Spinner 组件
 * 增强版加载动画组件 - 支持多种样式、状态、进度和计时器
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

// 定义多种动画类型的帧
const SPINNER_TYPES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  circle: ['◐', '◓', '◑', '◒'],
  dots2: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  dots3: ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  box: ['▖', '▘', '▝', '▗'],
  hamburger: ['☱', '☲', '☴'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  earth: ['🌍', '🌎', '🌏'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bouncingBar: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[ ===]', '[  ==]', '[   =]', '[    ]', '[   =]', '[  ==]', '[ ===]', '[====]'],
  bouncingBall: ['( ●    )', '(  ●   )', '(   ●  )', '(    ● )', '(     ●)', '(    ● )', '(   ●  )', '(  ●   )', '( ●    )', '(●     )'],
};

// 状态类型
export type SpinnerStatus = 'loading' | 'success' | 'error' | 'warning' | 'info';

// 状态图标
const STATUS_ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

// 状态颜色
const STATUS_COLORS = {
  loading: 'cyan',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
};

export interface SpinnerProps {
  label?: string;
  type?: keyof typeof SPINNER_TYPES;
  color?: string;
  status?: SpinnerStatus;
  progress?: number; // 0-100
  showElapsed?: boolean;
  startTime?: number;
  dimLabel?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({
  label,
  type = 'dots',
  color,
  status = 'loading',
  progress,
  showElapsed = false,
  startTime = Date.now(),
  dimLabel = false,
}) => {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const frames = SPINNER_TYPES[type] || SPINNER_TYPES.dots;
  const displayColor = color || STATUS_COLORS[status];

  // 动画更新
  useEffect(() => {
    if (status !== 'loading') return;

    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);

    return () => clearInterval(timer);
  }, [status, frames.length]);

  // 计时器更新
  useEffect(() => {
    if (!showElapsed) return;

    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timer);
  }, [showElapsed, startTime]);

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const icon = status === 'loading'
    ? frames[frame]
    : STATUS_ICONS[status] || frames[frame];

  return (
    <Box>
      <Text color={displayColor}>{icon}</Text>
      {label && (
        <Text dimColor={dimLabel}> {label}</Text>
      )}
      {progress !== undefined && (
        <Text dimColor> ({Math.round(progress)}%)</Text>
      )}
      {showElapsed && (
        <Text dimColor> [{formatElapsed(elapsed)}]</Text>
      )}
    </Box>
  );
};

// 多任务 Spinner 组件
export interface Task {
  id: string;
  label: string;
  status: SpinnerStatus;
  progress?: number;
  startTime?: number;
  type?: keyof typeof SPINNER_TYPES;
}

export interface MultiSpinnerProps {
  tasks: Task[];
  type?: keyof typeof SPINNER_TYPES;
  showElapsed?: boolean;
  compact?: boolean;
}

export const MultiSpinner: React.FC<MultiSpinnerProps> = ({
  tasks,
  type = 'dots',
  showElapsed = false,
  compact = false,
}) => {
  return (
    <Box flexDirection="column" paddingY={compact ? 0 : 1}>
      {tasks.map((task) => (
        <Box key={task.id} marginBottom={compact ? 0 : 0}>
          <Spinner
            label={task.label}
            type={task.type || type}
            status={task.status}
            progress={task.progress}
            showElapsed={showElapsed}
            startTime={task.startTime}
          />
        </Box>
      ))}
    </Box>
  );
};


// 状态指示器组件
export interface StatusIndicatorProps {
  status: SpinnerStatus;
  label?: string;
  color?: string;
  showIcon?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  color,
  showIcon = true,
}) => {
  const displayColor = color || STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];

  return (
    <Box>
      {showIcon && icon && (
        <Text color={displayColor}>{icon}</Text>
      )}
      {label && (
        <Text color={displayColor}> {label}</Text>
      )}
    </Box>
  );
};

// 导出所有类型和常量
export { SPINNER_TYPES, STATUS_ICONS, STATUS_COLORS };

export default Spinner;
