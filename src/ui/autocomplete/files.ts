/**
 * 文件路径自动完成提供器
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CompletionItem } from './types.js';

/**
 * 获取文件路径补全建议
 * @param query 查询路径
 * @param cwd 当前工作目录
 * @param maxResults 最大返回数量
 */
export async function getFileCompletions(
  query: string,
  cwd: string,
  maxResults: number = 10
): Promise<CompletionItem[]> {
  try {
    // 规范化查询路径
    let searchPath = query;
    let searchDir: string;
    let searchPrefix: string;

    // 处理绝对路径和相对路径
    if (path.isAbsolute(query)) {
      searchDir = path.dirname(query);
      searchPrefix = path.basename(query);
    } else {
      const fullPath = path.join(cwd, query);
      searchDir = path.dirname(fullPath);
      searchPrefix = path.basename(fullPath);

      // 如果查询以 ./ 或 ../ 开头,保留它
      if (!query.startsWith('./') && !query.startsWith('../') && query.length > 0) {
        // 相对于当前目录
        searchDir = cwd;
        searchPrefix = query;
      }
    }

    // 检查目录是否存在
    if (!fs.existsSync(searchDir)) {
      return [];
    }

    // 读取目录内容
    const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });

    // 过滤和映射结果
    const completions: CompletionItem[] = entries
      .filter(entry => {
        // 过滤掉隐藏文件(除非明确查询)
        if (entry.name.startsWith('.') && !searchPrefix.startsWith('.')) {
          return false;
        }
        // 匹配前缀
        return entry.name.toLowerCase().startsWith(searchPrefix.toLowerCase());
      })
      .map(entry => {
        const isDir = entry.isDirectory();
        const fullPath = path.join(searchDir, entry.name);

        // 计算相对路径
        let displayPath: string;
        if (path.isAbsolute(query)) {
          displayPath = fullPath;
        } else if (query.startsWith('./') || query.startsWith('../')) {
          displayPath = path.join(path.dirname(query), entry.name);
        } else {
          displayPath = path.relative(cwd, fullPath);
        }

        // 目录添加斜杠后缀
        const valueWithSlash = isDir ? displayPath + path.sep : displayPath;

        return {
          value: valueWithSlash,
          label: entry.name,
          description: isDir ? 'Directory' : 'File',
          type: isDir ? 'directory' as const : 'file' as const,
          priority: isDir ? 1 : 2, // 目录优先
        };
      })
      .sort((a, b) => {
        // 先按类型排序(目录优先),再按名称排序
        if (a.priority !== b.priority) {
          return (a.priority || 0) - (b.priority || 0);
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, maxResults);

    return completions;
  } catch (error) {
    // 如果出错,返回空数组
    return [];
  }
}

/**
 * 检查文本是否正在输入文件路径
 * @param text 输入文本
 * @param cursorPosition 光标位置
 */
export function isTypingFilePath(text: string, cursorPosition: number): boolean {
  const beforeCursor = text.slice(0, cursorPosition);

  // 检查是否包含路径分隔符或以 . 开头(相对路径)
  const pathPatterns = [
    /\s([./~])/, // 空格后跟路径开始符号
    /^([./~])/, // 行首路径开始符号
    /\s([a-zA-Z]:)/, // Windows 盘符 (如 C:)
  ];

  return pathPatterns.some(pattern => pattern.test(beforeCursor));
}

/**
 * 提取文件路径查询文本
 * @param text 输入文本
 * @param cursorPosition 光标位置
 */
export function extractFileQuery(text: string, cursorPosition: number): {
  query: string;
  startPosition: number;
} {
  const beforeCursor = text.slice(0, cursorPosition);

  // 查找路径的起始位置(从最后一个空格或行首开始)
  const lastSpace = beforeCursor.lastIndexOf(' ');
  const startPosition = lastSpace + 1;
  const query = beforeCursor.slice(startPosition);

  return { query, startPosition };
}
