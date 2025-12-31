/**
 * 终端尺寸钩子 - 仿照官方 Claude Code 实现
 *
 * 监听终端 resize 事件，提供实时的终端尺寸信息
 *
 * 官方实现要点：
 * 1. 使用 stdout.on("resize") 监听尺寸变化
 * 2. 更新 terminalColumns 和 terminalRows
 * 3. 触发重新渲染
 */

import { useState, useEffect, useCallback } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

/**
 * 获取终端尺寸的钩子
 *
 * 使用方法：
 * ```tsx
 * const { columns, rows } = useTerminalSize();
 * ```
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();

  const getSize = useCallback((): TerminalSize => {
    return {
      columns: stdout?.columns || process.stdout.columns || 80,
      rows: stdout?.rows || process.stdout.rows || 24,
    };
  }, [stdout]);

  const [size, setSize] = useState<TerminalSize>(getSize);

  useEffect(() => {
    // 如果没有 stdout，使用 process.stdout
    const targetStdout = stdout || process.stdout;

    const handleResize = () => {
      const newSize = getSize();
      setSize(prevSize => {
        // 只有当尺寸真正变化时才更新状态
        if (prevSize.columns !== newSize.columns || prevSize.rows !== newSize.rows) {
          return newSize;
        }
        return prevSize;
      });
    };

    // 监听 resize 事件
    if (targetStdout.isTTY) {
      targetStdout.on('resize', handleResize);
    }

    // 清理
    return () => {
      if (targetStdout.isTTY) {
        targetStdout.off('resize', handleResize);
      }
    };
  }, [stdout, getSize]);

  return size;
}

/**
 * 仅获取终端宽度
 */
export function useTerminalWidth(): number {
  const { columns } = useTerminalSize();
  return columns;
}

/**
 * 仅获取终端高度
 */
export function useTerminalHeight(): number {
  const { rows } = useTerminalSize();
  return rows;
}
