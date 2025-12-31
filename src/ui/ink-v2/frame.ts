/**
 * Frame - 帧管理
 * 用于创建和管理渲染帧数据
 *
 * 从官方 Claude Code 源码逆向工程提取 (原名: ptA)
 */

import type { FrameData, ScreenData, Position } from './types.js';
import type { StylePool } from './style-pool.js';
import { createEmptyScreenData } from './screen.js';

/**
 * 创建空帧
 */
export function createEmptyFrame(
  rows: number,
  columns: number,
  stylePool: StylePool
): FrameData {
  return {
    rows,
    columns,
    screen: createEmptyScreenData(rows, columns, stylePool),
    viewport: { width: columns, height: rows },
    cursor: { x: 0, y: 0 },
    cursorVisible: true,
    output: '',
    staticOutput: '',
    outputHeight: 0,
  };
}

/**
 * 复制帧（用于比较）
 */
export function cloneFrame(frame: FrameData): FrameData {
  return {
    ...frame,
    screen: cloneScreenData(frame.screen),
    viewport: { ...frame.viewport },
    cursor: { ...frame.cursor },
  };
}

/**
 * 复制屏幕数据
 */
function cloneScreenData(screen: ScreenData): ScreenData {
  const cells = screen.cells.map(row => [...row]);
  return {
    ...screen,
    cells,
  };
}

/**
 * 从输出创建帧
 */
export function createFrameFromOutput(
  output: string,
  staticOutput: string,
  rows: number,
  columns: number,
  stylePool: StylePool
): FrameData {
  const screen = createEmptyScreenData(rows, columns, stylePool);

  // 计算输出高度
  const outputLines = output.split('\n');
  const staticLines = staticOutput.split('\n');
  const outputHeight = outputLines.length + staticLines.length;

  // 将输出写入屏幕
  let y = 0;
  for (const line of [...staticLines, ...outputLines]) {
    if (y >= rows) break;

    const chars = [...line];
    let x = 0;
    for (const char of chars) {
      if (x >= columns) break;
      if (screen.cells[y]) {
        screen.cells[y][x] = {
          char,
          styleId: stylePool.none,
          width: 0,
          hyperlink: undefined,
        };
      }
      x++;
    }
    y++;
  }

  return {
    rows,
    columns,
    screen,
    viewport: { width: columns, height: rows },
    cursor: { x: 0, y: Math.min(outputHeight, rows - 1) },
    cursorVisible: true,
    output,
    staticOutput,
    outputHeight,
  };
}

/**
 * 更新帧尺寸
 */
export function resizeFrame(
  frame: FrameData,
  newRows: number,
  newColumns: number,
  stylePool: StylePool
): FrameData {
  if (frame.rows === newRows && frame.columns === newColumns) {
    return frame;
  }

  // 创建新的屏幕
  const newScreen = createEmptyScreenData(newRows, newColumns, stylePool);

  // 复制旧内容（尽可能多地保留）
  const copyRows = Math.min(frame.screen.height, newRows);
  const copyCols = Math.min(frame.screen.width, newColumns);

  for (let y = 0; y < copyRows; y++) {
    for (let x = 0; x < copyCols; x++) {
      const cell = frame.screen.cells[y]?.[x];
      if (cell && newScreen.cells[y]) {
        newScreen.cells[y][x] = cell;
      }
    }
  }

  return {
    ...frame,
    rows: newRows,
    columns: newColumns,
    screen: newScreen,
    viewport: { width: newColumns, height: newRows },
    cursor: {
      x: Math.min(frame.cursor.x, newColumns - 1),
      y: Math.min(frame.cursor.y, newRows - 1),
    },
  };
}
