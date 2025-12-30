/**
 * 系统提示词构建器
 * 组装完整的模块化系统提示词
 */

import type {
  PromptContext,
  SystemPromptOptions,
  BuildResult,
  Attachment,
} from './types.js';
import { PromptTooLongError } from './types.js';
import {
  CORE_IDENTITY,
  TOOL_GUIDELINES,
  PERMISSION_MODES,
  OUTPUT_STYLE,
  GIT_GUIDELINES,
  TASK_MANAGEMENT,
  CODING_GUIDELINES,
  SUBAGENT_SYSTEM,
  getEnvironmentInfo,
} from './templates.js';
import { AttachmentManager, attachmentManager as defaultAttachmentManager } from './attachments.js';
import { PromptCache, promptCache, generateCacheKey } from './cache.js';

/**
 * 估算 tokens
 */
function estimateTokens(text: string): number {
  if (!text) return 0;

  const hasAsian = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasCode = /^```|function |class |const |let |var |import |export /.test(text);

  let charsPerToken = 3.5;

  if (hasAsian) {
    charsPerToken = 2.0;
  } else if (hasCode) {
    charsPerToken = 3.0;
  }

  let tokens = text.length / charsPerToken;
  const specialChars = (text.match(/[{}[\]().,;:!?<>]/g) || []).length;
  tokens += specialChars * 0.1;

  const newlines = (text.match(/\n/g) || []).length;
  tokens += newlines * 0.5;

  return Math.ceil(tokens);
}

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: SystemPromptOptions = {
  includeIdentity: true,
  includeToolGuidelines: true,
  includePermissionMode: true,
  includeClaudeMd: true,
  includeIdeInfo: true,
  includeDiagnostics: true,
  maxTokens: 180000,
  enableCache: true,
};

/**
 * 系统提示词构建器
 */
export class SystemPromptBuilder {
  private attachmentManager: AttachmentManager;
  private cache: PromptCache;
  private debug: boolean;

  constructor(options?: {
    attachmentManager?: AttachmentManager;
    cache?: PromptCache;
    debug?: boolean;
  }) {
    this.attachmentManager = options?.attachmentManager ?? defaultAttachmentManager;
    this.cache = options?.cache ?? promptCache;
    this.debug = options?.debug ?? false;
  }

  /**
   * 构建完整的系统提示词
   */
  async build(
    context: PromptContext,
    options: SystemPromptOptions = {}
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 检查缓存
    if (opts.enableCache) {
      const cacheKey = generateCacheKey(context);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (this.debug) {
          console.debug('[SystemPromptBuilder] Cache hit');
        }
        return {
          content: cached.content,
          hashInfo: cached.hashInfo,
          attachments: [],
          truncated: false,
          buildTimeMs: Date.now() - startTime,
        };
      }
    }

    // 生成附件
    const attachments = await this.attachmentManager.generateAttachments(context);

    // 构建各个部分
    const parts: string[] = [];

    // 1. 核心身份
    if (opts.includeIdentity) {
      parts.push(CORE_IDENTITY);
    }

    // 2. 帮助信息
    parts.push(`If the user asks for help or wants to give feedback inform them of the following:
- /help: Get help with using Claude Code
- To give feedback, users should report the issue at https://github.com/anthropics/claude-code/issues`);

    // 3. 输出风格
    parts.push(OUTPUT_STYLE);

    // 4. 任务管理
    parts.push(TASK_MANAGEMENT);

    // 6. 代码编写指南
    parts.push(CODING_GUIDELINES);

    // 7. 工具使用指南
    if (opts.includeToolGuidelines) {
      parts.push(TOOL_GUIDELINES);
    }

    // 8. Git 操作指南
    parts.push(GIT_GUIDELINES);

    // 9. 子代理系统
    parts.push(SUBAGENT_SYSTEM);

    // 10. 权限模式
    if (opts.includePermissionMode && context.permissionMode) {
      const modeDescription = PERMISSION_MODES[context.permissionMode] || PERMISSION_MODES.default;
      parts.push(modeDescription);
    }

    // 11. 环境信息
    parts.push(
      getEnvironmentInfo({
        workingDir: context.workingDir,
        isGitRepo: context.isGitRepo ?? false,
        platform: context.platform ?? process.platform,
        todayDate: context.todayDate ?? new Date().toISOString().split('T')[0],
        model: context.model,
      })
    );

    // 12. 附件内容
    for (const attachment of attachments) {
      if (attachment.content) {
        parts.push(attachment.content);
      }
    }

    // 组装完整提示词
    let content = parts.join('\n\n');

    // 检查长度限制
    let truncated = false;
    const estimatedTokens = estimateTokens(content);

    if (opts.maxTokens && estimatedTokens > opts.maxTokens) {
      // 尝试截断附件
      content = this.truncateToLimit(parts, attachments, opts.maxTokens);
      truncated = true;

      // 再次检查
      const finalTokens = estimateTokens(content);
      if (finalTokens > opts.maxTokens) {
        throw new PromptTooLongError(finalTokens, opts.maxTokens);
      }
    }

    // 计算哈希
    const hashInfo = this.cache.computeHash(content);

    // 缓存结果
    if (opts.enableCache) {
      const cacheKey = generateCacheKey(context);
      this.cache.set(cacheKey, content, hashInfo);
    }

    const buildTimeMs = Date.now() - startTime;

    if (this.debug) {
      console.debug(`[SystemPromptBuilder] Built in ${buildTimeMs}ms, ${hashInfo.estimatedTokens} tokens`);
    }

    return {
      content,
      hashInfo,
      attachments,
      truncated,
      buildTimeMs,
    };
  }

  /**
   * 截断到限制
   */
  private truncateToLimit(
    parts: string[],
    attachments: Attachment[],
    maxTokens: number
  ): string {
    // 优先保留核心部分
    const coreParts = parts.slice(0, 7); // 身份、帮助、风格、代码引用、任务、代码、工具
    const remainingParts = parts.slice(7);

    // 计算核心部分的 tokens
    let content = coreParts.join('\n\n');
    let currentTokens = estimateTokens(content);

    // 添加剩余部分直到接近限制
    const reserveTokens = Math.floor(maxTokens * 0.1); // 保留 10% 空间
    const targetTokens = maxTokens - reserveTokens;

    for (const part of remainingParts) {
      const partTokens = estimateTokens(part);
      if (currentTokens + partTokens < targetTokens) {
        content += '\n\n' + part;
        currentTokens += partTokens;
      }
    }

    // 添加截断提示
    content += '\n\n<system-reminder>\nSome context was truncated due to length limits. Use tools to gather additional information as needed.\n</system-reminder>';

    return content;
  }

  /**
   * 获取提示词预览
   */
  preview(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.slice(0, maxLength) + `\n... [truncated, total ${content.length} chars]`;
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(result: BuildResult): string {
    const lines: string[] = [
      '=== System Prompt Debug Info ===',
      `Hash: ${result.hashInfo.hash}`,
      `Length: ${result.hashInfo.length} chars`,
      `Estimated Tokens: ${result.hashInfo.estimatedTokens}`,
      `Build Time: ${result.buildTimeMs}ms`,
      `Truncated: ${result.truncated}`,
      `Attachments: ${result.attachments.length}`,
    ];

    if (result.attachments.length > 0) {
      lines.push('Attachment Details:');
      for (const att of result.attachments) {
        lines.push(`  - ${att.type}: ${att.label || 'no label'} (${att.content?.length || 0} chars)`);
      }
    }

    lines.push('=================================');

    return lines.join('\n');
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 全局构建器实例
 */
export const systemPromptBuilder = new SystemPromptBuilder();
