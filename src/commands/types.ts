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
