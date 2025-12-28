/**
 * 自动完成类型定义
 */

export interface CompletionItem {
  /** 补全后的完整文本 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 描述 */
  description?: string;
  /** 补全类型 */
  type: 'command' | 'file' | 'mention' | 'directory';
  /** 排序优先级 (数字越小越靠前) */
  priority?: number;
  /** 别名列表 */
  aliases?: string[];
}

export interface CompletionContext {
  /** 当前输入的完整文本 */
  fullText: string;
  /** 光标位置 */
  cursorPosition: number;
  /** 当前工作目录 */
  cwd: string;
  /** 是否启用文件补全 */
  enableFileCompletion?: boolean;
  /** 是否启用 @mention 补全 */
  enableMentionCompletion?: boolean;
}

export interface CompletionResult {
  /** 补全项列表 */
  items: CompletionItem[];
  /** 补全触发的起始位置 */
  startPosition: number;
  /** 补全的查询文本 */
  query: string;
  /** 补全类型 */
  type: 'command' | 'file' | 'mention' | 'none';
}
