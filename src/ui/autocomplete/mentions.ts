/**
 * @mention 自动完成提供器
 * 支持 @file、@folder、@url 等提及语法
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { CompletionItem } from './types.js';

/**
 * 获取 @mention 补全建议
 * @param query 查询文本 (包含 @)
 * @param cwd 当前工作目录
 * @param maxResults 最大返回数量
 */
export async function getMentionCompletions(
  query: string,
  cwd: string,
  maxResults: number = 10
): Promise<CompletionItem[]> {
  try {
    // 移除 @ 符号
    const mentionQuery = query.slice(1).toLowerCase();

    // 如果查询为空,返回常用的 mention 类型
    if (!mentionQuery) {
      return [
        {
          value: '@file ',
          label: '@file',
          description: 'Mention a file in the conversation',
          type: 'mention',
          priority: 1,
        },
        {
          value: '@folder ',
          label: '@folder',
          description: 'Mention a folder in the conversation',
          type: 'mention',
          priority: 2,
        },
        {
          value: '@url ',
          label: '@url',
          description: 'Mention a URL in the conversation',
          type: 'mention',
          priority: 3,
        },
      ];
    }

    const completions: CompletionItem[] = [];

    // 尝试匹配文件和文件夹
    const fileMatches = await findMatchingFiles(mentionQuery, cwd, maxResults);
    completions.push(...fileMatches);

    // 如果结果不足,添加一些建议
    if (completions.length < 3) {
      const suggestions = [
        {
          value: '@file ',
          label: '@file',
          description: 'Mention a file in the conversation',
          type: 'mention' as const,
          priority: 10,
        },
        {
          value: '@folder ',
          label: '@folder',
          description: 'Mention a folder in the conversation',
          type: 'mention' as const,
          priority: 11,
        },
      ];

      completions.push(...suggestions.filter(s =>
        s.label.toLowerCase().includes(mentionQuery)
      ));
    }

    return completions.slice(0, maxResults);
  } catch (error) {
    return [];
  }
}

/**
 * 查找匹配的文件
 */
async function findMatchingFiles(
  query: string,
  cwd: string,
  maxResults: number
): Promise<CompletionItem[]> {
  try {
    // 使用 glob 查找匹配的文件
    const pattern = `**/*${query}*`;
    const files = await glob(pattern, {
      cwd,
      nodir: false,
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
      ],
      matchBase: true,
    });

    // 转换为补全项
    const completions: CompletionItem[] = await Promise.all(
      files.slice(0, maxResults * 2).map(async (file) => {
        const fullPath = path.join(cwd, file);
        let isDir = false;
        try {
          const stat = await fs.promises.stat(fullPath);
          isDir = stat.isDirectory();
        } catch {
          // 忽略错误
        }

        return {
          value: `@${file} `,
          label: `@${path.basename(file)}`,
          description: isDir ? `Folder: ${file}` : `File: ${file}`,
          type: 'mention' as const,
          priority: isDir ? 1 : 2,
        };
      })
    );

    // 按优先级和名称排序
    return completions
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return (a.priority || 0) - (b.priority || 0);
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, maxResults);
  } catch (error) {
    return [];
  }
}

/**
 * 检查文本是否正在输入 @mention
 * @param text 输入文本
 * @param cursorPosition 光标位置
 */
export function isTypingMention(text: string, cursorPosition: number): boolean {
  const beforeCursor = text.slice(0, cursorPosition);

  // 查找最后一个 @ 符号
  const lastAtIndex = beforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    return false;
  }

  // 检查 @ 之后是否有空格
  const afterAt = beforeCursor.slice(lastAtIndex + 1);
  return !afterAt.includes(' ');
}

/**
 * 提取 @mention 查询文本
 * @param text 输入文本
 * @param cursorPosition 光标位置
 */
export function extractMentionQuery(text: string, cursorPosition: number): {
  query: string;
  startPosition: number;
} {
  const beforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = beforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    return { query: '', startPosition: -1 };
  }

  const query = beforeCursor.slice(lastAtIndex);
  return { query, startPosition: lastAtIndex };
}
