/**
 * 系统提示词模块
 * 实现动态生成、模块化组装、缓存优化
 */

export { SystemPromptBuilder, systemPromptBuilder } from './builder.js';
export { AttachmentManager, attachmentManager } from './attachments.js';
export { PromptTemplates, CORE_IDENTITY, TOOL_GUIDELINES, PERMISSION_MODES } from './templates.js';
export { PromptCache, promptCache } from './cache.js';
export { PromptPreview, promptPreview } from './preview.js';
export type {
  PromptContext,
  Attachment,
  AttachmentType,
  SystemPromptOptions,
  PromptHashInfo,
} from './types.js';
export type {
  PreviewOptions,
  PromptSection,
  AnalysisResult,
  DiffResult,
  DiffLine,
} from './preview.js';
