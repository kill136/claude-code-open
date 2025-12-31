/**
 * Output - 终端输出工具
 * 将渲染操作转换为 ANSI 转义序列
 *
 * 从官方 Claude Code 源码逆向工程提取
 */

import type { RenderOp } from './types.js';

// ANSI 转义序列
const ESC = '\x1b';
const CSI = `${ESC}[`;
const OSC = `${ESC}]`;
const BEL = '\x07';

/**
 * 将渲染操作转换为终端输出字符串
 */
export function opsToString(ops: RenderOp[]): string {
  let result = '';

  for (const op of ops) {
    switch (op.type) {
      case 'stdout':
        result += op.content;
        break;

      case 'stderr':
        // stderr 单独处理
        break;

      case 'clear':
        // 清除 N 行
        if (op.count > 0) {
          // 移动光标到行首
          result += '\r';
          // 向上移动并清除每一行
          for (let i = 0; i < op.count; i++) {
            result += `${CSI}2K`;  // 清除整行
            result += `${CSI}1A`;  // 光标上移一行
          }
          result += `${CSI}2K`;  // 清除当前行
        }
        break;

      case 'clearTerminal':
        // 清除整个终端
        result += `${CSI}2J`;  // 清除整个屏幕
        result += `${CSI}H`;   // 移动光标到左上角
        break;

      case 'cursorHide':
        result += `${CSI}?25l`;
        break;

      case 'cursorShow':
        result += `${CSI}?25h`;
        break;

      case 'cursorMove':
        // 移动光标到指定位置（1-indexed）
        result += `${CSI}${op.y + 1};${op.x + 1}H`;
        break;

      case 'carriageReturn':
        result += '\r';
        break;

      case 'style':
        // 应用 ANSI 样式
        if (op.codes.length > 0) {
          result += `${CSI}${op.codes.join(';')}m`;
        }
        break;

      case 'hyperlink':
        // OSC 8 超链接
        if (op.uri) {
          result += `${OSC}8;;${op.uri}${BEL}`;
        } else {
          result += `${OSC}8;;${BEL}`;
        }
        break;
    }
  }

  return result;
}

/**
 * 将渲染操作写入终端
 */
export function writeToTerminal(
  terminal: { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream },
  ops: RenderOp[]
): void {
  const stdoutContent: string[] = [];
  const stderrContent: string[] = [];

  for (const op of ops) {
    if (op.type === 'stderr') {
      stderrContent.push(op.content);
    } else {
      stdoutContent.push(opsToString([op]));
    }
  }

  if (stdoutContent.length > 0) {
    terminal.stdout.write(stdoutContent.join(''));
  }

  if (stderrContent.length > 0) {
    terminal.stderr.write(stderrContent.join(''));
  }
}

/**
 * 清除 N 行（从当前位置向上）
 */
export function clearLines(count: number): string {
  if (count <= 0) return '';

  let result = '\r';  // 回到行首
  for (let i = 0; i < count; i++) {
    result += `${CSI}2K`;  // 清除整行
    if (i < count - 1) {
      result += `${CSI}1A`;  // 光标上移
    }
  }
  return result;
}

/**
 * 移动光标
 */
export function moveCursor(dx: number, dy: number): string {
  let result = '';

  if (dy < 0) {
    result += `${CSI}${-dy}A`;  // 上移
  } else if (dy > 0) {
    result += `${CSI}${dy}B`;   // 下移
  }

  if (dx < 0) {
    result += `${CSI}${-dx}D`;  // 左移
  } else if (dx > 0) {
    result += `${CSI}${dx}C`;   // 右移
  }

  return result;
}

/**
 * 隐藏光标
 */
export function hideCursor(): string {
  return `${CSI}?25l`;
}

/**
 * 显示光标
 */
export function showCursor(): string {
  return `${CSI}?25h`;
}

/**
 * 保存光标位置
 */
export function saveCursor(): string {
  return `${ESC}7`;
}

/**
 * 恢复光标位置
 */
export function restoreCursor(): string {
  return `${ESC}8`;
}
