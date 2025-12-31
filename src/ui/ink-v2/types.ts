/**
 * Ink V2 渲染引擎类型定义
 * 从官方 Claude Code 源码逆向工程提取
 */

// 渲染操作类型
export type RenderOp =
  | { type: 'stdout'; content: string }
  | { type: 'stderr'; content: string }
  | { type: 'clear'; count: number }
  | { type: 'clearTerminal'; reason: string }
  | { type: 'cursorHide' }
  | { type: 'cursorShow' }
  | { type: 'cursorMove'; x: number; y: number }
  | { type: 'carriageReturn' }
  | { type: 'style'; codes: number[] }
  | { type: 'hyperlink'; uri: string };

// 单元格信息
export interface Cell {
  char: string;
  styleId: number;
  width: number;  // 0 = normal, 2 = wide char first half, 3 = wide char second half
  hyperlink?: string;
}

// 位置
export interface Position {
  x: number;
  y: number;
}

// 区域
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 裁剪区域
export interface ClipRegion {
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
}

// 屏幕数据
export interface ScreenData {
  width: number;
  height: number;
  cells: (Cell | undefined)[][];
  emptyCell: Cell;
}

// 帧数据
export interface FrameData {
  rows: number;
  columns: number;
  screen: ScreenData;
  viewport: { width: number; height: number };
  cursor: Position;
  cursorVisible: boolean;
  output: string;
  staticOutput: string;
  outputHeight: number;
}

// 样式池接口
export interface IStylePool {
  readonly none: number;
  get(id: number): number[];
  add(styles: number[]): number;
  reset(): void;
}

// 渲染器选项
export interface RendererOptions {
  debug?: boolean;
  isTTY: boolean;
  ink2: boolean;
  stylePool: IStylePool;
  onFlicker?: (height: number, rows: number, ink2: boolean, reason: string) => void;
}

// Ink V2 选项
export interface InkV2Options {
  stdout: NodeJS.WriteStream;
  stdin: NodeJS.ReadStream;
  stderr: NodeJS.WriteStream;
  debug?: boolean;
  exitOnCtrlC?: boolean;
  patchConsole?: boolean;
  ink2?: boolean;
  onFlicker?: (height: number, rows: number, ink2: boolean, reason: string) => void;
}