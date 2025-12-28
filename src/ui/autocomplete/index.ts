/**
 * 自动完成主模块
 * 整合命令、文件路径、@mention 等补全功能
 */

import type { CompletionContext, CompletionResult, CompletionItem } from './types.js';
import {
  getCommandCompletions,
  isTypingCommand,
  extractCommandQuery,
} from './commands.js';
import {
  getFileCompletions,
  isTypingFilePath,
  extractFileQuery,
} from './files.js';
import {
  getMentionCompletions,
  isTypingMention,
  extractMentionQuery,
} from './mentions.js';

/**
 * 获取自动补全建议
 * @param context 补全上下文
 */
export async function getCompletions(
  context: CompletionContext
): Promise<CompletionResult> {
  const { fullText, cursorPosition, cwd, enableFileCompletion, enableMentionCompletion } = context;

  // 1. 检查是否正在输入命令 (最高优先级)
  if (isTypingCommand(fullText, cursorPosition)) {
    const query = extractCommandQuery(fullText, cursorPosition);
    const items = getCommandCompletions(query);

    return {
      items,
      startPosition: 1, // 跳过前导斜杠
      query,
      type: 'command',
    };
  }

  // 2. 检查是否正在输入 @mention
  if (enableMentionCompletion !== false && isTypingMention(fullText, cursorPosition)) {
    const { query, startPosition } = extractMentionQuery(fullText, cursorPosition);
    const items = await getMentionCompletions(query, cwd);

    return {
      items,
      startPosition,
      query,
      type: 'mention',
    };
  }

  // 3. 检查是否正在输入文件路径
  if (enableFileCompletion !== false && isTypingFilePath(fullText, cursorPosition)) {
    const { query, startPosition } = extractFileQuery(fullText, cursorPosition);
    const items = await getFileCompletions(query, cwd);

    return {
      items,
      startPosition,
      query,
      type: 'file',
    };
  }

  // 无匹配
  return {
    items: [],
    startPosition: -1,
    query: '',
    type: 'none',
  };
}

/**
 * 应用补全到文本
 * @param text 原始文本
 * @param completion 补全项
 * @param startPosition 补全的起始位置
 */
export function applyCompletion(
  text: string,
  completion: CompletionItem,
  startPosition: number,
  cursorPosition: number
): { newText: string; newCursor: number } {
  const before = text.slice(0, startPosition);
  const after = text.slice(cursorPosition);
  const newText = before + completion.value + after;
  const newCursor = before.length + completion.value.length;

  return { newText, newCursor };
}

// 重新导出类型
export type {
  CompletionItem,
  CompletionContext,
  CompletionResult,
} from './types.js';

// 重新导出命令列表
export { ALL_COMMANDS } from './commands.js';
