/**
 * ProgressBar 组件
 * 支持多种样式的进度条显示
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';

export interface ProgressBarProps {
  /** 当前进度值 (0-100) */
  value?: number;
  /** 最大值 (默认 100) */
  max?: number;
  /** 进度条标签 */
  label?: string;
  /** 是否显示百分比 */
  showPercentage?: boolean;
  /** 是否显示预计剩余时间 */
  showETA?: boolean;
  /** 进度条样式 */
  style?: 'blocks' | 'dots' | 'arrows' | 'smooth';
  /** 进度条颜色 */
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan' | 'magenta' | 'white';
  /** 不确定进度模式（加载动画） */
  indeterminate?: boolean;
  /** 进度条宽度（字符数） */
  width?: number;
  /** 开始时间（用于计算 ETA） */
  startTime?: number;
  /** 完成状态 */
  complete?: boolean;
}

// 不同样式的字符集
const STYLE_CHARS = {
  blocks: {
    complete: '█',
    partial: ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'],
    incomplete: '░',
  },
  dots: {
    complete: '●',
    partial: ['○', '◔', '◐', '◕'],
    incomplete: '○',
  },
  arrows: {
    complete: '▶',
    partial: ['▷', '▷', '▶', '▶'],
    incomplete: '▷',
  },
  smooth: {
    complete: '━',
    partial: ['', '╸', '╸', '╸'],
    incomplete: '─',
  },
};

// 不确定模式的动画帧
const INDETERMINATE_FRAMES = [
  '    ●     ',
  '   ●●     ',
  '  ●●●     ',
  ' ●●●●     ',
  '●●●●●     ',
  '●●●●●●    ',
  ' ●●●●●●   ',
  '  ●●●●●●  ',
  '   ●●●●●● ',
  '    ●●●●●●',
  '     ●●●●●',
  '      ●●●●',
  '       ●●●',
  '        ●●',
  '         ●',
];

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  showETA = false,
  style = 'blocks',
  color = 'cyan',
  indeterminate = false,
  width = 40,
  startTime,
  complete = false,
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [completionAnimation, setCompletionAnimation] = useState(false);

  // 动画效果
  useEffect(() => {
    if (indeterminate || completionAnimation) {
      const interval = setInterval(() => {
        setAnimationFrame((prev) => (prev + 1) % INDETERMINATE_FRAMES.length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [indeterminate, completionAnimation]);

  // 完成动画
  useEffect(() => {
    if (complete) {
      setCompletionAnimation(true);
      const timeout = setTimeout(() => {
        setCompletionAnimation(false);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [complete]);

  // 计算百分比
  const percentage = useMemo(() => {
    if (indeterminate) return 0;
    return Math.min(100, Math.max(0, (value / max) * 100));
  }, [value, max, indeterminate]);

  // 计算 ETA
  const eta = useMemo(() => {
    if (!showETA || !startTime || indeterminate || percentage === 0) return null;

    const elapsed = Date.now() - startTime;
    const rate = percentage / elapsed;
    const remaining = (100 - percentage) / rate;

    if (!isFinite(remaining) || remaining < 0) return null;

    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }, [showETA, startTime, percentage, indeterminate]);

  // 渲染进度条
  const renderProgressBar = () => {
    if (indeterminate) {
      return renderIndeterminateBar();
    }

    const chars = STYLE_CHARS[style];
    const filledWidth = (width * percentage) / 100;
    const completeCount = Math.floor(filledWidth);
    const partialIndex = Math.floor((filledWidth - completeCount) * chars.partial.length);
    const incompleteCount = width - completeCount - (partialIndex > 0 ? 1 : 0);

    let bar = '';

    // 完整的部分
    bar += chars.complete.repeat(completeCount);

    // 部分完成的字符
    if (partialIndex > 0 && chars.partial[partialIndex]) {
      bar += chars.partial[partialIndex];
    }

    // 未完成的部分
    bar += chars.incomplete.repeat(Math.max(0, incompleteCount));

    return bar;
  };

  // 渲染不确定进度条
  const renderIndeterminateBar = () => {
    const frame = INDETERMINATE_FRAMES[animationFrame];
    const totalWidth = width;
    const frameWidth = frame.length;

    if (frameWidth >= totalWidth) {
      return frame.substring(0, totalWidth);
    }

    const padding = '─'.repeat(Math.max(0, totalWidth - frameWidth));
    return frame + padding;
  };

  // 渲染百分比文本
  const renderPercentage = () => {
    if (!showPercentage || indeterminate) return null;
    return ` ${percentage.toFixed(0)}%`;
  };

  // 渲染 ETA
  const renderETA = () => {
    if (!eta) return null;
    return ` (ETA: ${eta})`;
  };

  // 完成状态的特殊样式
  const barColor = complete ? 'green' : color;
  const completeSymbol = complete ? ' ✓' : '';

  return (
    <Box flexDirection="column" gap={0}>
      {label && (
        <Text>
          {label}
          {completeSymbol}
        </Text>
      )}
      <Box>
        <Text color={barColor}>
          [{renderProgressBar()}]
        </Text>
        <Text color="gray">
          {renderPercentage()}
          {renderETA()}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * MultiProgressBar 组件
 * 支持多个进度条同时显示
 */
export interface MultiProgressBarProps {
  bars: Array<{
    id: string;
    label: string;
    value: number;
    max?: number;
    color?: ProgressBarProps['color'];
    complete?: boolean;
  }>;
  width?: number;
  showPercentage?: boolean;
  style?: ProgressBarProps['style'];
}

export const MultiProgressBar: React.FC<MultiProgressBarProps> = ({
  bars,
  width = 30,
  showPercentage = true,
  style = 'blocks',
}) => {
  return (
    <Box flexDirection="column" gap={0}>
      {bars.map((bar) => (
        <ProgressBar
          key={bar.id}
          label={bar.label}
          value={bar.value}
          max={bar.max}
          color={bar.color}
          width={width}
          showPercentage={showPercentage}
          style={style}
          complete={bar.complete}
        />
      ))}
    </Box>
  );
};

/**
 * CompactProgressBar 组件
 * 精简版进度条，适合嵌入到其他组件中
 */
export interface CompactProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  color?: ProgressBarProps['color'];
}

export const CompactProgressBar: React.FC<CompactProgressBarProps> = ({
  value,
  max = 100,
  width = 20,
  color = 'cyan',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const chars = STYLE_CHARS.blocks;
  const filledWidth = (width * percentage) / 100;
  const completeCount = Math.floor(filledWidth);
  const partialIndex = Math.floor((filledWidth - completeCount) * chars.partial.length);
  const incompleteCount = width - completeCount - (partialIndex > 0 ? 1 : 0);

  let bar = chars.complete.repeat(completeCount);
  if (partialIndex > 0 && chars.partial[partialIndex]) {
    bar += chars.partial[partialIndex];
  }
  bar += chars.incomplete.repeat(Math.max(0, incompleteCount));

  return (
    <Text color={color}>
      {bar} {percentage.toFixed(0)}%
    </Text>
  );
};

export default ProgressBar;
