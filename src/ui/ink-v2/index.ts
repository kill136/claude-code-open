/**
 * Ink V2 渲染引擎
 *
 * 从官方 Claude Code 源码逆向工程提取
 *
 * 主要特性：
 * 1. ink2 模式 - 增量渲染，只更新变化的部分
 * 2. blit 技术 - 从上一帧复制未变化的区域
 * 3. 样式池 - 缓存和复用 ANSI 样式代码
 * 4. 智能 resize 处理 - 正确处理终端尺寸变化
 *
 * 使用方法：
 * ```typescript
 * import { InkV2App } from './ink-v2';
 *
 * const app = new InkV2App({
 *   stdout: process.stdout,
 *   stdin: process.stdin,
 *   stderr: process.stderr,
 *   ink2: true,  // 启用增量渲染
 * });
 *
 * // 渲染 React 组件
 * app.render(<MyApp />);
 *
 * // 卸载
 * app.unmount();
 * ```
 */

export * from './types.js';
export { StylePool } from './style-pool.js';
export { Screen, createEmptyScreenData, getCell, setCell } from './screen.js';
export { Renderer } from './renderer.js';
export { createEmptyFrame, cloneFrame, createFrameFromOutput, resizeFrame } from './frame.js';
export {
  opsToString,
  writeToTerminal,
  clearLines,
  moveCursor,
  hideCursor,
  showCursor,
  saveCursor,
  restoreCursor,
} from './output.js';

// 导入依赖
import type { InkV2Options, FrameData } from './types.js';
import { StylePool } from './style-pool.js';
import { Renderer } from './renderer.js';
import { createEmptyFrame, resizeFrame } from './frame.js';
import { writeToTerminal } from './output.js';

/**
 * Ink V2 应用实例
 *
 * 这是一个简化的 Ink 渲染引擎，专注于：
 * - 正确处理终端 resize
 * - 增量渲染优化
 * - 与官方 Claude Code 兼容的渲染行为
 */
export class InkV2App {
  private options: InkV2Options;
  private stylePool: StylePool;
  private renderer: Renderer;
  private prevFrame: FrameData;
  private terminalColumns: number;
  private terminalRows: number;
  private isUnmounted: boolean = false;
  private unsubscribeResize?: () => void;

  constructor(options: InkV2Options) {
    this.options = {
      ...options,
      ink2: options.ink2 ?? true,  // 默认启用 ink2 模式
    };

    // 初始化终端尺寸
    this.terminalColumns = options.stdout.columns || 80;
    this.terminalRows = options.stdout.rows || 24;

    // 初始化样式池
    this.stylePool = new StylePool();

    // 初始化渲染器
    this.renderer = new Renderer({
      debug: options.debug,
      isTTY: options.stdout.isTTY || false,
      ink2: this.options.ink2!,
      stylePool: this.stylePool,
      onFlicker: options.onFlicker,
    });

    // 初始化空帧
    this.prevFrame = createEmptyFrame(
      this.terminalRows,
      this.terminalColumns,
      this.stylePool
    );

    // 监听 resize 事件
    if (options.stdout.isTTY) {
      const handleResize = this.handleResize.bind(this);
      options.stdout.on('resize', handleResize);

      this.unsubscribeResize = () => {
        options.stdout.off('resize', handleResize);
      };
    }
  }

  /**
   * 处理终端 resize
   */
  private handleResize(): void {
    this.terminalColumns = this.options.stdout.columns || 80;
    this.terminalRows = this.options.stdout.rows || 24;

    // 调整上一帧的尺寸
    this.prevFrame = resizeFrame(
      this.prevFrame,
      this.terminalRows,
      this.terminalColumns,
      this.stylePool
    );
  }

  /**
   * 获取当前终端尺寸
   */
  getTerminalSize(): { columns: number; rows: number } {
    return {
      columns: this.terminalColumns,
      rows: this.terminalRows,
    };
  }

  /**
   * 渲染帧
   */
  renderFrame(output: string, staticOutput: string = ''): void {
    if (this.isUnmounted) return;

    // 创建新帧
    const nextFrame: FrameData = {
      rows: this.terminalRows,
      columns: this.terminalColumns,
      screen: {
        width: this.terminalColumns,
        height: this.terminalRows,
        cells: [],
        emptyCell: {
          char: ' ',
          styleId: this.stylePool.none,
          width: 0,
          hyperlink: undefined,
        },
      },
      viewport: { width: this.terminalColumns, height: this.terminalRows },
      cursor: { x: 0, y: 0 },
      cursorVisible: true,
      output,
      staticOutput,
      outputHeight: output.split('\n').length,
    };

    // 渲染
    const ops = this.renderer.render(this.prevFrame, nextFrame);
    writeToTerminal(
      { stdout: this.options.stdout, stderr: this.options.stderr },
      ops
    );

    // 更新上一帧
    this.prevFrame = nextFrame;
  }

  /**
   * 清除屏幕
   */
  clear(): void {
    if (this.isUnmounted) return;
    this.options.stdout.write('\x1b[2J\x1b[H');
    this.prevFrame = createEmptyFrame(
      this.terminalRows,
      this.terminalColumns,
      this.stylePool
    );
  }

  /**
   * 重置渲染状态
   */
  reset(): void {
    this.renderer.reset();
    this.prevFrame = createEmptyFrame(
      this.terminalRows,
      this.terminalColumns,
      this.stylePool
    );
  }

  /**
   * 卸载
   */
  unmount(): void {
    if (this.isUnmounted) return;
    this.isUnmounted = true;

    if (this.unsubscribeResize) {
      this.unsubscribeResize();
    }
  }

  /**
   * 是否已卸载
   */
  get unmounted(): boolean {
    return this.isUnmounted;
  }
}

/**
 * 创建 Ink V2 应用实例的便捷函数
 */
export function createInkV2App(options?: Partial<InkV2Options>): InkV2App {
  return new InkV2App({
    stdout: process.stdout,
    stdin: process.stdin,
    stderr: process.stderr,
    ink2: true,
    ...options,
  });
}
