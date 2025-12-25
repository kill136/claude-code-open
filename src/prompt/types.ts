/**
 * 系统提示词类型定义
 */

import type { PermissionMode } from '../types/index.js';

/**
 * 附件类型枚举
 */
export type AttachmentType =
  | 'claudeMd'
  | 'critical_system_reminder'
  | 'ide_selection'
  | 'ide_opened_file'
  | 'output_style'
  | 'diagnostics'
  | 'memory'
  | 'plan_mode'
  | 'delegate_mode'
  | 'git_status'
  | 'todo_list'
  | 'custom';

/**
 * 附件结构
 */
export interface Attachment {
  type: AttachmentType;
  content: string;
  label?: string;
  priority?: number;
  computeTimeMs?: number;
}

/**
 * 提示词上下文
 */
export interface PromptContext {
  /** 工作目录 */
  workingDir: string;
  /** 当前模型 */
  model?: string;
  /** 权限模式 */
  permissionMode?: PermissionMode;
  /** 是否为调试模式 */
  debug?: boolean;
  /** 是否为 plan 模式 */
  planMode?: boolean;
  /** 是否为 delegate 模式 */
  delegateMode?: boolean;
  /** IDE 类型 */
  ideType?: 'vscode' | 'cursor' | 'windsurf' | 'zed' | 'terminal';
  /** IDE 选择内容 */
  ideSelection?: string;
  /** IDE 打开的文件 */
  ideOpenedFiles?: string[];
  /** 诊断信息 */
  diagnostics?: DiagnosticInfo[];
  /** 记忆系统内容 */
  memory?: Record<string, string>;
  /** 任务列表 */
  todoList?: TodoItem[];
  /** Git 状态 */
  gitStatus?: GitStatusInfo;
  /** 自定义附件 */
  customAttachments?: Attachment[];
  /** critical_system_reminder */
  criticalSystemReminder?: string;
  /** 今天日期 */
  todayDate?: string;
  /** 平台 */
  platform?: string;
  /** 是否为 git 仓库 */
  isGitRepo?: boolean;
}

/**
 * 诊断信息
 */
export interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
}

/**
 * 任务项
 */
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Git 状态信息
 */
export interface GitStatusInfo {
  branch: string;
  isClean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

/**
 * 系统提示词构建选项
 */
export interface SystemPromptOptions {
  /** 包含核心身份描述 */
  includeIdentity?: boolean;
  /** 包含工具使用指南 */
  includeToolGuidelines?: boolean;
  /** 包含权限模式说明 */
  includePermissionMode?: boolean;
  /** 包含 CLAUDE.md 内容 */
  includeClaudeMd?: boolean;
  /** 包含 IDE 集成信息 */
  includeIdeInfo?: boolean;
  /** 包含诊断信息 */
  includeDiagnostics?: boolean;
  /** 最大长度限制 (tokens) */
  maxTokens?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
}

/**
 * 提示词哈希信息
 */
export interface PromptHashInfo {
  /** 哈希值 */
  hash: string;
  /** 计算时间 */
  computedAt: number;
  /** 原始长度 */
  length: number;
  /** 估算 tokens */
  estimatedTokens: number;
}

/**
 * 提示词构建结果
 */
export interface BuildResult {
  /** 完整的系统提示词 */
  content: string;
  /** 哈希信息 */
  hashInfo: PromptHashInfo;
  /** 附件列表 */
  attachments: Attachment[];
  /** 是否被截断 */
  truncated: boolean;
  /** 构建耗时 */
  buildTimeMs: number;
}

/**
 * 长度限制错误
 */
export class PromptTooLongError extends Error {
  constructor(
    public readonly estimatedTokens: number,
    public readonly maxTokens: number,
    message?: string
  ) {
    super(
      message ||
        `Prompt is too long. Estimated ${estimatedTokens} tokens, max ${maxTokens}. ` +
        `Press esc twice to go up a few messages and try again, or use /compact to reduce context.`
    );
    this.name = 'PromptTooLongError';
  }
}
