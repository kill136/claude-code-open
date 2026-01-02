/**
 * 斜杠命令类型定义
 */

import type React from 'react';

export interface CommandContext {
  // 会话相关
  session: {
    id: string;
    messageCount: number;
    duration: number;
    totalCost: string;
    clearMessages: () => void;
    getStats: () => {
      messageCount: number;
      duration: number;
      totalCost: string;
      modelUsage: Record<string, number>;
    };
    setCustomTitle?: (title: string) => void;
    getAdditionalDirectories?: () => string[];
    addDirectory?: (dir: string) => void;
    removeDirectory?: (dir: string) => void;
    // Todo 列表管理 (官方实现 - 用于 /todos 命令和 TodoWrite 工具)
    getTodos: () => Array<{
      content: string;
      status: 'pending' | 'in_progress' | 'completed';
      activeForm: string;
    }>;
    setTodos: (todos: Array<{
      content: string;
      status: 'pending' | 'in_progress' | 'completed';
      activeForm: string;
    }>) => void;
    // 标签管理 (用于 /tag 命令)
    getTags?: () => string[];
    setTags?: (tags: string[]) => void;
    // 文件状态跟踪 (官方实现 - 用于 /files 命令)
    readFileState?: Map<string, any> | Record<string, any> | string[];
  };

  // 配置相关
  config: {
    model: string;
    modelDisplayName: string;
    apiType: string;
    organization?: string;
    username?: string;
    cwd: string;
    version: string;
    permissionMode?: string;
  };

  // UI 相关
  ui: {
    addMessage: (role: 'user' | 'assistant', content: string) => void;
    addActivity: (description: string) => void;
    setShowWelcome: (show: boolean) => void;
    setShowLoginScreen?: (show: boolean) => void;
    setLoginPreselect?: (method: 'claudeai' | 'console' | null) => void;
    exit: () => void;
  };

  // 参数
  args: string[];
  rawInput: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'exit' | 'clear' | 'reload' | 'login' | 'logout' | 'reinitClient' | 'showJsx' | 'none';
  data?: any;
  // 官方 local-jsx 类型支持：命令可以返回一个 JSX 组件在主 UI 中显示
  jsx?: React.ReactElement;
  // 是否隐藏输入框（显示 JSX 时通常需要）
  shouldHidePromptInput?: boolean;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: CommandCategory;
  execute: (ctx: CommandContext) => Promise<CommandResult> | CommandResult;
}

export type CommandCategory =
  | 'general'
  | 'session'
  | 'config'
  | 'tools'
  | 'auth'
  | 'utility'
  | 'development';

export interface CommandRegistry {
  commands: Map<string, SlashCommand>;
  register: (command: SlashCommand) => void;
  get: (name: string) => SlashCommand | undefined;
  getAll: () => SlashCommand[];
  getByCategory: (category: CommandCategory) => SlashCommand[];
  execute: (name: string, ctx: CommandContext) => Promise<CommandResult>;
}
