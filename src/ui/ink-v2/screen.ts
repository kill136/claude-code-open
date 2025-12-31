/**
 * Screen - 屏幕缓冲区
 * 用于管理终端屏幕的字符和样式
 *
 * 从官方 Claude Code 源码逆向工程提取 (原名: dNA)
 */

import type { Cell, Region, ClipRegion, ScreenData, Position } from './types.js';
import type { StylePool } from './style-pool.js';
import stringWidth from 'string-width';

// 空单元格常量
const EMPTY_CELL: Cell = {
  char: ' ',
  styleId: 0,
  width: 0,
  hyperlink: undefined,
};

// 操作类型
type ScreenOp =
  | { type: 'blit'; src: ScreenData; region: Region }
  | { type: 'clear'; region: Region }
  | { type: 'write'; x: number; y: number; text: string }
  | { type: 'clip'; clip: ClipRegion }
  | { type: 'unclip' };

/**
 * 分割字符串为字符数组（正确处理 Unicode）
 */
function splitChars(str: string): Array<{ value: string; styles: number[] }> {
  const result: Array<{ value: string; styles: number[] }> = [];
  const chars = [...str];  // 使用展开运算符正确分割 Unicode
  for (const char of chars) {
    result.push({ value: char, styles: [] });
  }
  return result;
}

/**
 * 处理宽字符（CJK 等）
 */
function processWideChars(chars: Array<{ value: string; styles: number[] }>): Array<{ value: string; styles: number[]; isWide?: boolean }> {
  const result: Array<{ value: string; styles: number[]; isWide?: boolean }> = [];
  for (const char of chars) {
    const width = stringWidth(char.value);
    if (width === 2) {
      // 宽字符
      result.push({ ...char, isWide: true });
    } else if (width === 0) {
      // 零宽字符，跳过或合并
      continue;
    } else {
      result.push(char);
    }
  }
  return result;
}

export class Screen {
  readonly width: number;
  readonly height: number;
  readonly ink2: boolean;
  private stylePool: StylePool;
  private operations: ScreenOp[] = [];
  private charCache: Map<string, Array<{ value: string; styles: number[] }>> = new Map();

  constructor(options: {
    width: number;
    height: number;
    ink2?: boolean;
    stylePool: StylePool;
  }) {
    this.width = options.width;
    this.height = options.height;
    this.ink2 = options.ink2 ?? false;
    this.stylePool = options.stylePool;
  }

  /**
   * 从源屏幕复制区域（位块传输）
   */
  blit(src: ScreenData, region: Region): void {
    this.operations.push({ type: 'blit', src, region });
  }

  /**
   * 清除区域
   */
  clear(region: Region): void {
    this.operations.push({ type: 'clear', region });
  }

  /**
   * 在指定位置写入文本
   */
  write(x: number, y: number, text: string): void {
    if (!text) return;
    this.operations.push({ type: 'write', x, y, text });
  }

  /**
   * 设置裁剪区域
   */
  clip(clip: ClipRegion): void {
    this.operations.push({ type: 'clip', clip });
  }

  /**
   * 取消裁剪
   */
  unclip(): void {
    this.operations.push({ type: 'unclip' });
  }

  /**
   * 获取最终的屏幕数据
   */
  get(): ScreenData {
    // 初始化单元格数组
    const cells: (Cell | undefined)[][] = [];
    for (let y = 0; y < this.height; y++) {
      cells[y] = new Array(this.width).fill(undefined);
    }

    const emptyCell: Cell = {
      char: ' ',
      styleId: this.stylePool.none,
      width: 0,
      hyperlink: undefined,
    };

    // 用于追踪裁剪区域
    const clipStack: ClipRegion[] = [];

    // 应用所有操作
    for (const op of this.operations) {
      if (op.type === 'clip') {
        clipStack.push(op.clip);
        continue;
      }

      if (op.type === 'unclip') {
        clipStack.pop();
        continue;
      }

      if (op.type === 'blit') {
        const { src, region } = op;
        const maxY = Math.min(region.y + region.height, this.height, src.height);
        const maxX = Math.min(region.x + region.width, this.width, src.width);

        for (let y = region.y; y < maxY; y++) {
          for (let x = region.x; x < maxX; x++) {
            const srcCell = src.cells[y]?.[x];
            if (srcCell) {
              cells[y][x] = srcCell;
            }
          }
        }
        continue;
      }

      if (op.type === 'clear') {
        const { region } = op;
        const maxY = Math.min(region.y + region.height, this.height);
        const maxX = Math.min(region.x + region.width, this.width);

        for (let y = Math.max(0, region.y); y < maxY; y++) {
          for (let x = Math.max(0, region.x); x < maxX; x++) {
            cells[y][x] = emptyCell;
          }
        }
        continue;
      }

      if (op.type === 'write') {
        let { x, y, text } = op;
        const lines = text.split('\n');

        // 应用裁剪
        const clip = clipStack.at(-1);
        if (clip) {
          const hasXClip = typeof clip.x1 === 'number' && typeof clip.x2 === 'number';
          const hasYClip = typeof clip.y1 === 'number' && typeof clip.y2 === 'number';

          if (hasXClip) {
            const textWidth = stringWidth(text);
            if (x + textWidth < clip.x1! || x > clip.x2!) continue;
          }
          if (hasYClip) {
            if (y + lines.length < clip.y1! || y > clip.y2!) continue;
          }
        }

        let lineOffset = 0;
        for (const line of lines) {
          const row = cells[y + lineOffset];
          if (!row) {
            lineOffset++;
            continue;
          }

          // 获取缓存的字符分割
          let chars = this.charCache.get(line);
          if (!chars) {
            chars = splitChars(line);
            if (this.ink2) {
              chars = processWideChars(chars) as typeof chars;
            }
            this.charCache.set(line, chars);
          }

          let currentX = x;
          for (const char of chars) {
            if (currentX >= this.width) break;
            if (currentX >= 0) {
              const width = stringWidth(char.value);
              row[currentX] = {
                char: char.value,
                styleId: this.stylePool.none,
                width: width === 2 ? 2 : 0,
                hyperlink: undefined,
              };
              // 宽字符占用两列
              if (width === 2 && currentX + 1 < this.width) {
                row[currentX + 1] = {
                  char: '',
                  styleId: this.stylePool.none,
                  width: 3,  // 标记为宽字符的第二部分
                  hyperlink: undefined,
                };
                currentX++;
              }
            }
            currentX++;
          }
          lineOffset++;
        }
      }
    }

    return {
      width: this.width,
      height: this.height,
      cells,
      emptyCell,
    };
  }
}

/**
 * 创建空的屏幕数据
 */
export function createEmptyScreenData(
  rows: number,
  columns: number,
  stylePool: StylePool
): ScreenData {
  const cells: (Cell | undefined)[][] = [];
  for (let y = 0; y < rows; y++) {
    cells[y] = new Array(columns).fill(undefined);
  }

  return {
    width: columns,
    height: rows,
    cells,
    emptyCell: {
      char: ' ',
      styleId: stylePool.none,
      width: 0,
      hyperlink: undefined,
    },
  };
}

/**
 * 获取屏幕指定位置的单元格
 */
export function getCell(screen: ScreenData, pos: Position): Cell | undefined {
  return screen.cells[pos.y]?.[pos.x];
}

/**
 * 设置屏幕指定位置的单元格
 */
export function setCell(screen: ScreenData, pos: Position, cell: Cell): void {
  if (screen.cells[pos.y]) {
    screen.cells[pos.y][pos.x] = cell;
  }
}
