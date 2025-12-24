/**
 * 斜杠命令类型定义
 */

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
    };
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
  };

  // UI 相关
  ui: {
    addMessage: (role: 'user' | 'assistant', content: string) => void;
    addActivity: (description: string) => void;
    setShowWelcome: (show: boolean) => void;
    exit: () => void;
  };

  // 参数
  args: string[];
  rawInput: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'exit' | 'clear' | 'reload' | 'none';
  data?: any;
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
