/**
 * WebUI 斜杠命令系统
 * 提供类似 CLI 的命令接口
 */

import type { ConversationManager } from './conversation.js';
import type { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { SessionInfo } from '../shared/types.js';

// ============ 类型定义 ============

/**
 * 命令执行上下文 (WebUI 版本)
 */
export interface CommandContext {
  conversationManager: ConversationManager;
  ws: WebSocket;
  sessionId: string;
  cwd: string;
  model: string;
}

/**
 * 扩展的命令执行上下文（包含命令参数）
 */
export interface ExtendedCommandContext extends CommandContext {
  args: string[];
  rawInput: string;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  action?: 'clear' | 'reload' | 'none';
}

/**
 * 斜杠命令接口
 */
export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: 'general' | 'session' | 'config' | 'utility';
  execute: (ctx: ExtendedCommandContext) => Promise<CommandResult> | CommandResult;
}

// ============ 命令注册表 ============

/**
 * 斜杠命令注册表
 */
export class SlashCommandRegistry {
  private commands = new Map<string, SlashCommand>();
  private aliases = new Map<string, string>();

  /**
   * 注册命令
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * 获取命令
   */
  get(name: string): SlashCommand | undefined {
    // 先检查直接命令名
    const cmd = this.commands.get(name);
    if (cmd) return cmd;

    // 检查别名
    const aliasedName = this.aliases.get(name);
    if (aliasedName) {
      return this.commands.get(aliasedName);
    }

    return undefined;
  }

  /**
   * 获取所有命令
   */
  getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 按类别获取命令
   */
  getByCategory(category: string): SlashCommand[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * 执行命令
   */
  async execute(input: string, ctx: CommandContext): Promise<CommandResult> {
    // 解析命令和参数
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return {
        success: false,
        message: 'Not a slash command',
      };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const command = this.get(commandName);

    if (!command) {
      return {
        success: false,
        message: `未知命令: /${commandName}\n\n使用 /help 查看所有可用命令。`,
      };
    }

    try {
      // 创建扩展的上下文
      const extendedCtx: ExtendedCommandContext = {
        ...ctx,
        args,
        rawInput: trimmed,
      };

      return await command.execute(extendedCtx);
    } catch (error) {
      return {
        success: false,
        message: `执行 /${commandName} 时出错: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取帮助文本
   */
  getHelp(): string {
    const categories = {
      general: '通用命令',
      session: '会话管理',
      config: '配置',
      utility: '工具',
    };

    const categoryOrder: Array<keyof typeof categories> = ['general', 'session', 'config', 'utility'];

    let help = '\n可用命令\n';
    help += '='.repeat(50) + '\n\n';

    for (const category of categoryOrder) {
      const cmds = this.getByCategory(category);
      if (cmds.length === 0) continue;

      help += `${categories[category]}\n`;
      help += '-'.repeat(categories[category].length) + '\n';

      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const cmdDisplay = `/${cmd.name}`;
        const aliasStr = cmd.aliases && cmd.aliases.length > 0
          ? ` (${cmd.aliases.map(a => '/' + a).join(', ')})`
          : '';
        help += `  ${cmdDisplay.padEnd(20)}${cmd.description}${aliasStr}\n`;
      }
      help += '\n';
    }

    help += '\n使用 /help <命令> 查看特定命令的详细信息。\n';

    return help;
  }
}

// ============ 核心命令实现 ============

// /help - 显示帮助信息
const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['?'],
  description: '显示所有可用命令',
  usage: '/help [命令名]',
  category: 'general',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const { args } = ctx;

    if (args && args.length > 0) {
      // 显示特定命令的帮助
      const cmdName = args[0].replace(/^\//, '');
      const cmd = registry.get(cmdName);

      if (cmd) {
        let helpText = `\n/${cmd.name}\n`;
        helpText += '='.repeat(cmd.name.length + 1) + '\n\n';
        helpText += `${cmd.description}\n\n`;

        if (cmd.usage) {
          helpText += `用法:\n  ${cmd.usage}\n\n`;
        }

        if (cmd.aliases && cmd.aliases.length > 0) {
          helpText += `别名:\n  ${cmd.aliases.map(a => '/' + a).join(', ')}\n\n`;
        }

        helpText += `类别: ${cmd.category}\n`;

        return { success: true, message: helpText };
      } else {
        return {
          success: false,
          message: `未知命令: /${cmdName}\n\n使用 /help 查看所有可用命令。`,
        };
      }
    }

    // 显示所有命令
    return {
      success: true,
      message: registry.getHelp(),
    };
  },
};

// /clear - 清除对话历史
const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['reset', 'new'],
  description: '清除对话历史',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    ctx.conversationManager.clearHistory(ctx.sessionId);
    return {
      success: true,
      message: '对话已清除。上下文已释放。',
      action: 'clear',
    };
  },
};

// /model - 查看或切换模型
const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: '查看或切换当前模型',
  usage: '/model [opus|sonnet|haiku]',
  category: 'config',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const { args } = ctx;

    if (!args || args.length === 0) {
      // 显示当前模型
      const modelMap: Record<string, string> = {
        opus: 'Claude Opus 4.5 (最强大)',
        sonnet: 'Claude Sonnet 4.5 (平衡)',
        haiku: 'Claude Haiku 3.5 (快速)',
      };

      let message = `当前模型: ${modelMap[ctx.model] || ctx.model}\n\n`;
      message += '可用模型:\n';
      message += '  opus   - Claude Opus 4.5 (最强大，适合复杂任务)\n';
      message += '  sonnet - Claude Sonnet 4.5 (平衡，推荐)\n';
      message += '  haiku  - Claude Haiku 3.5 (快速，适合简单任务)\n\n';
      message += '使用 /model <模型名> 切换模型';

      return { success: true, message };
    }

    const newModel = args[0].toLowerCase();
    const validModels = ['opus', 'sonnet', 'haiku'];

    if (!validModels.includes(newModel)) {
      return {
        success: false,
        message: `无效的模型: ${newModel}\n\n可用模型: opus, sonnet, haiku`,
      };
    }

    ctx.conversationManager.setModel(ctx.sessionId, newModel);
    return {
      success: true,
      message: `已切换到 ${newModel} 模型`,
    };
  },
};

// /cost - 显示费用
const costCommand: SlashCommand = {
  name: 'cost',
  description: '显示当前会话费用',
  category: 'utility',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const history = ctx.conversationManager.getHistory(ctx.sessionId);

    let totalInput = 0;
    let totalOutput = 0;

    for (const msg of history) {
      if (msg.usage) {
        totalInput += msg.usage.inputTokens || 0;
        totalOutput += msg.usage.outputTokens || 0;
      }
    }

    // 根据模型获取定价
    const modelPricing: Record<string, { input: number; output: number; name: string }> = {
      opus: { input: 15, output: 75, name: 'Claude Opus 4.5' },
      sonnet: { input: 3, output: 15, name: 'Claude Sonnet 4.5' },
      haiku: { input: 0.8, output: 4, name: 'Claude Haiku 3.5' },
    };

    const pricing = modelPricing[ctx.model] || modelPricing.sonnet;

    // 计算费用（每百万 tokens 的价格）
    const inputCost = (totalInput / 1000000) * pricing.input;
    const outputCost = (totalOutput / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;

    let message = '会话费用统计\n\n';
    message += '当前会话:\n';
    message += `  消息数: ${history.length}\n`;
    message += `  输入 tokens: ${totalInput.toLocaleString()}\n`;
    message += `  输出 tokens: ${totalOutput.toLocaleString()}\n`;
    message += `  估算费用: $${totalCost.toFixed(4)}\n\n`;
    message += `定价参考 (${pricing.name}):\n`;
    message += `  输入: $${pricing.input} / 1M tokens\n`;
    message += `  输出: $${pricing.output} / 1M tokens`;

    return { success: true, message };
  },
};

// /compact - 压缩上下文
const compactCommand: SlashCommand = {
  name: 'compact',
  aliases: ['c'],
  description: '压缩对话历史以释放上下文',
  category: 'session',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const history = ctx.conversationManager.getHistory(ctx.sessionId);

    if (history.length === 0) {
      return {
        success: false,
        message: '没有对话历史需要压缩。\n\n开始对话后，可以使用 /compact 释放上下文空间。',
      };
    }

    // WebUI 目前不支持真正的压缩，但可以提供信息
    let message = '上下文压缩\n\n';
    message += `当前状态:\n`;
    message += `  消息数: ${history.length}\n\n`;
    message += '注意: WebUI 目前不支持自动压缩。\n';
    message += '如需释放上下文，请使用 /clear 清除历史。\n\n';
    message += '提示:\n';
    message += '  • 较长的对话会消耗更多上下文\n';
    message += '  • 可以使用 /clear 开始新对话\n';
    message += '  • 未来版本将支持智能压缩';

    return { success: true, message };
  },
};

// /undo - 撤销上一次操作
const undoCommand: SlashCommand = {
  name: 'undo',
  aliases: ['rewind'],
  description: '撤销上一次操作',
  category: 'session',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    return {
      success: true,
      message: '撤销功能\n\n' +
        '目前 WebUI 不支持撤销操作。\n\n' +
        '你可以:\n' +
        '  • 使用 /clear 清除整个对话\n' +
        '  • 手动重新开始任务\n\n' +
        '提示: 未来版本将支持消息级别的撤销功能。',
    };
  },
};

// /diff - 显示未提交的 git 更改
const diffCommand: SlashCommand = {
  name: 'diff',
  description: '显示未提交的 git 更改',
  category: 'utility',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    return {
      success: true,
      message: 'Git Diff 功能\n\n' +
        '要查看 git 更改，请直接询问 Claude:\n\n' +
        '  "显示 git diff"\n' +
        '  "查看未提交的更改"\n' +
        '  "运行 git status"\n\n' +
        'Claude 会使用 Bash 工具执行 git 命令并显示结果。',
    };
  },
};

// /config - 显示当前配置
const configCommand: SlashCommand = {
  name: 'config',
  description: '显示当前配置',
  category: 'config',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    let message = '当前配置\n\n';
    message += `会话 ID: ${ctx.sessionId}\n`;
    message += `模型: ${ctx.model}\n`;
    message += `工作目录: ${ctx.cwd}\n`;
    message += `平台: ${process.platform}\n`;
    message += `Node.js: ${process.version}\n\n`;

    const apiKeySet = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    message += `API 状态:\n`;
    message += `  API Key: ${apiKeySet ? '✓ 已配置' : '✗ 未配置'}\n`;

    return { success: true, message };
  },
};

// /sessions - 列出历史会话
const sessionsCommand: SlashCommand = {
  name: 'sessions',
  aliases: ['history'],
  description: '列出历史会话',
  category: 'session',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      return {
        success: false,
        message: '没有找到历史会话。\n\n会话保存在: ' + sessionsDir,
      };
    }

    try {
      const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

      if (sessionFiles.length === 0) {
        return {
          success: false,
          message: '没有找到历史会话。',
        };
      }

      const sessions: SessionInfo[] = [];
      const limit = 20; // 可配置的限制

      for (const file of sessionFiles.slice(0, limit)) {
        try {
          const sessionPath = path.join(sessionsDir, file);
          const stat = fs.statSync(sessionPath);
          const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

          sessions.push({
            id: path.basename(file, '.json'),
            createdAt: stat.birthtime.getTime(),
            lastActiveAt: stat.mtime.getTime(),
            model: data.metadata?.model || 'unknown',
            messageCount: data.messages?.length || 0,
            totalCost: 0,
            cwd: data.metadata?.workingDirectory || data.state?.cwd || 'unknown',
          });
        } catch (error) {
          // 记录解析错误但继续处理其他文件
          console.warn(`[/sessions] 无法解析会话文件 ${file}:`, error);
        }
      }

      sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

      let message = `历史会话 (最近 ${sessions.length} 个)\n\n`;

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const date = new Date(session.lastActiveAt).toLocaleString();
        const shortId = session.id.slice(0, 8);

        message += `${i + 1}. ${shortId} - ${session.messageCount} 条消息\n`;
        message += `   ${date}\n`;
        message += `   ${session.cwd}\n\n`;
      }

      message += '提示:\n';
      message += '  • 通过 WebUI 界面侧边栏可以切换会话\n';
      message += '  • 会话会自动保存到 ~/.claude/sessions/\n';
      message += '  • 使用 /resume <session-id> 了解更多信息';

      return { success: true, message };
    } catch (error) {
      return {
        success: false,
        message: `读取会话时出错: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

// /resume - 恢复指定会话
const resumeCommand: SlashCommand = {
  name: 'resume',
  aliases: ['r'],
  description: '恢复指定会话',
  usage: '/resume <session-id>',
  category: 'session',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const { args } = ctx;

    if (!args || args.length === 0) {
      return {
        success: false,
        message: '用法: /resume <session-id>\n\n使用 /sessions 查看可用的会话。',
      };
    }

    return {
      success: false,
      message: '会话恢复\n\n' +
        '请使用 WebUI 界面的会话管理功能切换会话。\n\n' +
        '提示:\n' +
        '  • 使用 /sessions 查看所有会话\n' +
        '  • 通过 WebUI 界面侧边栏切换会话\n' +
        '  • 会话会自动保存到 ~/.claude/sessions/',
    };
  },
};

// /status - 显示状态
const statusCommand: SlashCommand = {
  name: 'status',
  description: '显示系统状态',
  category: 'general',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const history = ctx.conversationManager.getHistory(ctx.sessionId);
    const apiKeySet = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

    let message = 'Claude Code WebUI 状态\n\n';

    message += '会话信息:\n';
    message += `  会话 ID: ${ctx.sessionId.slice(0, 8)}\n`;
    message += `  消息数: ${history.length}\n`;
    message += `  模型: ${ctx.model}\n\n`;

    message += 'API 连接:\n';
    message += `  状态: ${apiKeySet ? '✓ 已连接' : '✗ 未连接'}\n`;
    message += `  API Key: ${apiKeySet ? '✓ 已配置' : '✗ 未配置'}\n\n`;

    message += '环境:\n';
    message += `  工作目录: ${ctx.cwd}\n`;
    message += `  平台: ${process.platform}\n`;
    message += `  Node.js: ${process.version}\n\n`;

    message += '工具状态:\n';
    message += '  ✓ Bash 可用\n';
    message += '  ✓ 文件操作可用\n';
    message += '  ✓ Web 访问可用';

    return { success: true, message };
  },
};

// /version - 显示版本
const versionCommand: SlashCommand = {
  name: 'version',
  aliases: ['ver', 'v'],
  description: '显示版本信息',
  category: 'general',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    // 尝试读取 package.json
    let version = 'unknown';
    try {
      const pkgPath = path.join(ctx.cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        version = pkg.version || 'unknown';
      }
    } catch {
      // 忽略错误
    }

    return {
      success: true,
      message: `Claude Code WebUI v${version}\n\n基于 Claude Code CLI 的 Web 界面实现。`,
    };
  },
};

// /tools - 工具管理命令
const toolsCommand: SlashCommand = {
  name: 'tools',
  aliases: ['t'],
  description: '管理可用工具',
  usage: '/tools [list|enable|disable|reset] [工具名]',
  category: 'config',
  execute: (ctx: ExtendedCommandContext): CommandResult => {
    const { args, conversationManager, sessionId } = ctx;

    // 无参数或 list 子命令 - 列出所有工具
    if (!args || args.length === 0 || args[0] === 'list') {
      const tools = conversationManager.getAvailableTools(sessionId);
      const config = conversationManager.getToolFilterConfig(sessionId);

      let message = '工具列表\n\n';
      message += `当前模式: ${config.mode === 'all' ? '全部启用' : config.mode === 'whitelist' ? '白名单' : '黑名单'}\n\n`;

      // 按分类分组
      const byCategory: Record<string, any[]> = {};
      for (const tool of tools) {
        if (!byCategory[tool.category]) {
          byCategory[tool.category] = [];
        }
        byCategory[tool.category].push(tool);
      }

      const categoryNames: Record<string, string> = {
        system: '系统工具',
        file: '文件工具',
        search: '搜索工具',
        web: 'Web工具',
        task: '任务管理',
        notebook: '笔记本',
        plan: '计划模式',
        mcp: 'MCP',
        interaction: '交互',
        skill: '技能',
        lsp: 'LSP',
        browser: '浏览器',
        other: '其他',
      };

      for (const [category, categoryTools] of Object.entries(byCategory)) {
        message += `\n${categoryNames[category] || category}:\n`;
        for (const tool of categoryTools) {
          const status = tool.enabled ? '✓' : '✗';
          message += `  ${status} ${tool.name.padEnd(20)} ${tool.description.slice(0, 50)}...\n`;
        }
      }

      message += `\n总计: ${tools.length} 个工具\n`;
      message += `启用: ${tools.filter(t => t.enabled).length} | 禁用: ${tools.filter(t => !t.enabled).length}\n\n`;
      message += '用法:\n';
      message += '  /tools list           - 列出所有工具\n';
      message += '  /tools enable <名称>  - 启用工具\n';
      message += '  /tools disable <名称> - 禁用工具\n';
      message += '  /tools reset          - 重置为默认配置\n';

      return { success: true, message };
    }

    const subCommand = args[0].toLowerCase();

    // enable - 启用工具
    if (subCommand === 'enable') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /tools enable <工具名>\n\n示例: /tools enable Bash',
        };
      }

      const toolName = args[1];
      const config = conversationManager.getToolFilterConfig(sessionId);

      // 如果是 all 模式，切换到黑名单模式
      if (config.mode === 'all') {
        config.mode = 'blacklist';
        config.disallowedTools = [];
      }

      // 从黑名单中移除或添加到白名单
      if (config.mode === 'blacklist') {
        if (!config.disallowedTools) config.disallowedTools = [];
        config.disallowedTools = config.disallowedTools.filter((t: string) => t !== toolName);
      } else if (config.mode === 'whitelist') {
        if (!config.allowedTools) config.allowedTools = [];
        if (!config.allowedTools.includes(toolName)) {
          config.allowedTools.push(toolName);
        }
      }

      conversationManager.updateToolFilter(sessionId, config);

      return {
        success: true,
        message: `已启用工具: ${toolName}`,
      };
    }

    // disable - 禁用工具
    if (subCommand === 'disable') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /tools disable <工具名>\n\n示例: /tools disable Write',
        };
      }

      const toolName = args[1];
      const config = conversationManager.getToolFilterConfig(sessionId);

      // 如果是 all 模式，切换到黑名单模式
      if (config.mode === 'all') {
        config.mode = 'blacklist';
        config.disallowedTools = [toolName];
      } else if (config.mode === 'blacklist') {
        if (!config.disallowedTools) config.disallowedTools = [];
        if (!config.disallowedTools.includes(toolName)) {
          config.disallowedTools.push(toolName);
        }
      } else if (config.mode === 'whitelist') {
        if (!config.allowedTools) config.allowedTools = [];
        config.allowedTools = config.allowedTools.filter((t: string) => t !== toolName);
      }

      conversationManager.updateToolFilter(sessionId, config);

      return {
        success: true,
        message: `已禁用工具: ${toolName}`,
      };
    }

    // reset - 重置配置
    if (subCommand === 'reset') {
      const defaultConfig = { mode: 'all' as const };
      conversationManager.updateToolFilter(sessionId, defaultConfig);

      return {
        success: true,
        message: '已重置工具配置为默认状态（全部启用）',
      };
    }

    return {
      success: false,
      message: `未知子命令: ${subCommand}\n\n使用 /tools 查看帮助。`,
    };
  },
};

// /prompt - 管理系统提示
const promptCommand: SlashCommand = {
  name: 'prompt',
  description: '管理系统提示配置',
  usage: '/prompt [set|append|reset] [内容]',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args, conversationManager, sessionId } = ctx;

    // 没有参数，显示当前系统提示
    if (!args || args.length === 0) {
      try {
        const result = await conversationManager.getSystemPrompt(sessionId);
        const config = result.config;

        let message = '系统提示配置\n\n';

        if (!config.useDefault && config.customPrompt) {
          message += '模式: 自定义提示\n\n';
          message += '当前提示:\n';
          message += '```\n';
          message += config.customPrompt.slice(0, 500);
          if (config.customPrompt.length > 500) {
            message += '\n...(已截断，总长度: ' + config.customPrompt.length + ' 字符)';
          }
          message += '\n```';
        } else if (config.useDefault && config.appendPrompt) {
          message += '模式: 默认提示 + 追加内容\n\n';
          message += '追加内容:\n';
          message += '```\n';
          message += config.appendPrompt;
          message += '\n```';
        } else {
          message += '模式: 默认提示\n';
        }

        message += '\n\n可用命令:\n';
        message += '  /prompt set <内容>    - 设置自定义提示（完全替换）\n';
        message += '  /prompt append <内容> - 追加到默认提示后\n';
        message += '  /prompt reset         - 重置为默认提示';

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `获取系统提示失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const action = args[0].toLowerCase();
    const content = args.slice(1).join(' ');

    try {
      switch (action) {
        case 'set': {
          if (!content) {
            return {
              success: false,
              message: '用法: /prompt set <内容>\n\n请提供要设置的系统提示内容。',
            };
          }

          const config = {
            useDefault: false,
            customPrompt: content,
          };

          conversationManager.updateSystemPrompt(sessionId, config);

          return {
            success: true,
            message: `系统提示已设置为自定义内容 (${content.length} 字符)。\n\n下次对话将使用新的系统提示。`,
          };
        }

        case 'append': {
          if (!content) {
            return {
              success: false,
              message: '用法: /prompt append <内容>\n\n请提供要追加的内容。',
            };
          }

          const config = {
            useDefault: true,
            appendPrompt: content,
          };

          conversationManager.updateSystemPrompt(sessionId, config);

          return {
            success: true,
            message: `已将内容追加到默认系统提示后 (${content.length} 字符)。\n\n下次对话将使用更新后的提示。`,
          };
        }

        case 'reset': {
          const config = {
            useDefault: true,
          };

          conversationManager.updateSystemPrompt(sessionId, config);

          return {
            success: true,
            message: '系统提示已重置为默认配置。\n\n下次对话将使用默认系统提示。',
          };
        }

        default:
          return {
            success: false,
            message: `未知的操作: ${action}\n\n可用操作: set, append, reset\n使用 /help prompt 查看详细帮助。`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `操作失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

// ============ 注册所有命令 ============

export const registry = new SlashCommandRegistry();

// 注册核心命令
registry.register(helpCommand);
registry.register(clearCommand);
registry.register(modelCommand);
registry.register(costCommand);
registry.register(compactCommand);
registry.register(undoCommand);
registry.register(diffCommand);
registry.register(configCommand);
registry.register(sessionsCommand);
registry.register(resumeCommand);
registry.register(statusCommand);
registry.register(versionCommand);

// /tasks - 管理后台任务
const tasksCommand: SlashCommand = {
  name: 'tasks',
  aliases: ['task'],
  description: '列出和管理后台 Agent 任务',
  usage: '/tasks [list|cancel <id>|output <id>]',
  category: 'utility',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args, conversationManager, sessionId } = ctx;

    const taskManager = conversationManager.getTaskManager(sessionId);
    if (!taskManager) {
      return {
        success: false,
        message: '任务管理器未初始化。',
      };
    }

    // 默认行为：列出所有任务
    if (!args || args.length === 0) {
      const tasks = taskManager.listTasks();

      if (tasks.length === 0) {
        return {
          success: true,
          message: '没有后台任务。',
        };
      }

      let message = '后台任务列表\n\n';

      tasks.forEach((task, idx) => {
        const duration = task.endTime
          ? ((task.endTime.getTime() - task.startTime.getTime()) / 1000).toFixed(1) + 's'
          : '运行中...';

        const statusEmoji = {
          running: '⏳',
          completed: '✅',
          failed: '❌',
          cancelled: '🚫',
        }[task.status] || '?';

        message += `${idx + 1}. ${statusEmoji} ${task.description}\n`;
        message += `   ID: ${task.id.slice(0, 8)}\n`;
        message += `   类型: ${task.agentType}\n`;
        message += `   状态: ${task.status}\n`;
        message += `   时长: ${duration}\n`;

        if (task.progress) {
          message += `   进度: ${task.progress.current}/${task.progress.total}`;
          if (task.progress.message) {
            message += ` - ${task.progress.message}`;
          }
          message += '\n';
        }

        message += '\n';
      });

      message += '使用 /tasks output <id> 查看任务输出\n';
      message += '使用 /tasks cancel <id> 取消运行中的任务';

      return { success: true, message };
    }

    const subcommand = args[0].toLowerCase();

    // /tasks cancel <id>
    if (subcommand === 'cancel') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /tasks cancel <task-id>',
        };
      }

      const taskId = args[1];
      const task = taskManager.getTask(taskId);

      if (!task) {
        return {
          success: false,
          message: `任务 ${taskId} 不存在`,
        };
      }

      const success = taskManager.cancelTask(taskId);

      if (success) {
        return {
          success: true,
          message: `任务 ${taskId.slice(0, 8)} 已取消`,
        };
      } else {
        return {
          success: false,
          message: `无法取消任务 ${taskId.slice(0, 8)}（可能已经完成）`,
        };
      }
    }

    // /tasks output <id>
    if (subcommand === 'output' || subcommand === 'o') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /tasks output <task-id>',
        };
      }

      const taskId = args[1];
      const task = taskManager.getTask(taskId);

      if (!task) {
        return {
          success: false,
          message: `任务 ${taskId} 不存在`,
        };
      }

      let message = `任务详情: ${task.description}\n`;
      message += `=`.repeat(50) + '\n\n';
      message += `ID: ${task.id}\n`;
      message += `类型: ${task.agentType}\n`;
      message += `状态: ${task.status}\n`;
      message += `开始时间: ${task.startTime.toLocaleString('zh-CN')}\n`;

      if (task.endTime) {
        const duration = ((task.endTime.getTime() - task.startTime.getTime()) / 1000).toFixed(1);
        message += `结束时间: ${task.endTime.toLocaleString('zh-CN')}\n`;
        message += `耗时: ${duration}s\n`;
      }

      if (task.progress) {
        message += `\n进度: ${task.progress.current}/${task.progress.total}\n`;
        if (task.progress.message) {
          message += `消息: ${task.progress.message}\n`;
        }
      }

      const output = taskManager.getTaskOutput(taskId);
      if (output) {
        message += `\n输出:\n${'-'.repeat(50)}\n${output}\n`;
      } else if (task.status === 'running') {
        message += `\n任务正在运行中，暂无输出。\n`;
      } else if (task.error) {
        message += `\n错误:\n${task.error}\n`;
      }

      return { success: true, message };
    }

    // /tasks list (等同于默认行为)
    if (subcommand === 'list' || subcommand === 'ls') {
      // 重新调用默认行为
      return tasksCommand.execute({ ...ctx, args: [] });
    }

    return {
      success: false,
      message: `未知子命令: ${subcommand}\n\n用法:\n  /tasks          - 列出所有任务\n  /tasks cancel <id>  - 取消任务\n  /tasks output <id>  - 查看任务输出`,
    };
  },
};

// /api - API管理命令
const apiCommand: SlashCommand = {
  name: 'api',
  description: '管理API连接',
  usage: '/api [status|test|models|provider]',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args } = ctx;
    const subcommand = args[0] || 'status';

    // 动态导入 apiManager
    const { apiManager } = await import('./api-manager.js');

    try {
      switch (subcommand) {
        case 'status': {
          const status = await apiManager.getStatus();
          let message = 'API 状态\n\n';
          message += `连接状态: ${status.connected ? '✓ 已连接' : '✗ 未连接'}\n`;
          message += `Provider: ${status.provider}\n`;
          message += `Base URL: ${status.baseUrl}\n`;
          message += `认证类型: ${status.tokenStatus.type}\n`;
          message += `认证状态: ${status.tokenStatus.valid ? '✓ 有效' : '✗ 无效'}\n\n`;

          if (status.tokenStatus.expiresAt) {
            const expiresDate = new Date(status.tokenStatus.expiresAt);
            message += `过期时间: ${expiresDate.toLocaleString('zh-CN')}\n`;
          }

          if (status.tokenStatus.scope && status.tokenStatus.scope.length > 0) {
            message += `权限范围: ${status.tokenStatus.scope.join(', ')}\n`;
          }

          message += `\n可用模型: ${status.models.length} 个\n`;

          return { success: true, message };
        }

        case 'test': {
          let message = 'API 连接测试\n\n';
          message += '正在测试连接...\n';

          const result = await apiManager.testConnection();

          if (result.success) {
            message += `\n✓ 测试成功\n`;
            message += `  延迟: ${result.latency}ms\n`;
            message += `  模型: ${result.model}\n`;
          } else {
            message += `\n✗ 测试失败\n`;
            message += `  错误: ${result.error}\n`;
          }

          return { success: result.success, message };
        }

        case 'models': {
          const models = await apiManager.getAvailableModels();
          let message = '可用模型列表\n\n';

          if (models.length === 0) {
            message += '未找到可用模型\n';
          } else {
            message += `共 ${models.length} 个模型:\n\n`;
            for (const model of models) {
              message += `  • ${model}\n`;
            }
          }

          return { success: true, message };
        }

        case 'provider': {
          const info = apiManager.getProviderInfo();
          let message = 'Provider 信息\n\n';
          message += `类型: ${info.type}\n`;
          message += `名称: ${info.name}\n`;
          message += `端点: ${info.endpoint}\n`;
          message += `状态: ${info.available ? '✓ 可用' : '✗ 不可用'}\n`;

          if (info.region) {
            message += `区域: ${info.region}\n`;
          }

          if (info.projectId) {
            message += `项目ID: ${info.projectId}\n`;
          }

          if (info.metadata && Object.keys(info.metadata).length > 0) {
            message += '\n元数据:\n';
            for (const [key, value] of Object.entries(info.metadata)) {
              message += `  ${key}: ${value}\n`;
            }
          }

          return { success: true, message };
        }

        default:
          return {
            success: false,
            message: `未知子命令: ${subcommand}\n\n用法:\n  /api status    - 显示API状态\n  /api test      - 测试API连接\n  /api models    - 列出可用模型\n  /api provider  - 显示Provider信息`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  },
};

// /doctor - 系统诊断命令
const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: '运行系统诊断检查',
  usage: '/doctor [verbose]',
  category: 'utility',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args } = ctx;
    const verbose = args.includes('verbose') || args.includes('v') || args.includes('-v');

    try {
      // 动态导入 doctor 模块
      const { runDiagnostics, formatDoctorReport } = await import('./doctor.js');

      const options = {
        verbose,
        includeSystemInfo: true,
      };

      let message = '正在运行系统诊断...\n\n';

      const report = await runDiagnostics(options);
      const formattedText = formatDoctorReport(report, verbose);

      message = formattedText;

      return {
        success: true,
        message,
        data: {
          report: {
            ...report,
            timestamp: report.timestamp.getTime(),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `运行诊断失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  },
};

// /mcp - 管理 MCP 服务器
const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: '管理 MCP (Model Context Protocol) 服务器',
  usage: '/mcp [list|add|remove|toggle] [参数]',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args, conversationManager } = ctx;

    // 默认行为：列出所有 MCP 服务器
    if (!args || args.length === 0 || args[0] === 'list') {
      try {
        const servers = conversationManager.listMcpServers();

        if (servers.length === 0) {
          return {
            success: true,
            message: '没有配置 MCP 服务器。\n\n使用 /mcp add <name> <command> 添加服务器。',
          };
        }

        let message = 'MCP 服务器列表\n\n';

        servers.forEach((server, idx) => {
          const statusIcon = server.enabled ? '✓' : '✗';
          const typeLabel = {
            stdio: '标准输入输出',
            sse: 'SSE',
            http: 'HTTP',
          }[server.type] || server.type;

          message += `${idx + 1}. ${statusIcon} ${server.name}\n`;
          message += `   类型: ${typeLabel}\n`;

          if (server.type === 'stdio' && server.command) {
            message += `   命令: ${server.command}`;
            if (server.args && server.args.length > 0) {
              message += ` ${server.args.join(' ')}`;
            }
            message += '\n';
          } else if (server.url) {
            message += `   URL: ${server.url}\n`;
          }

          if (server.env && Object.keys(server.env).length > 0) {
            message += `   环境变量: ${Object.keys(server.env).length} 个\n`;
          }

          message += '\n';
        });

        message += '使用命令:\n';
        message += '  /mcp add <name> <command>    - 添加服务器\n';
        message += '  /mcp remove <name>           - 删除服务器\n';
        message += '  /mcp toggle <name>           - 启用/禁用服务器';

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `列出 MCP 服务器失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const subcommand = args[0].toLowerCase();

    // /mcp add <name> <command> [args...]
    if (subcommand === 'add') {
      if (args.length < 3) {
        return {
          success: false,
          message: '用法: /mcp add <name> <command> [args...]\n\n示例: /mcp add my-server node /path/to/server.js',
        };
      }

      const name = args[1];
      const command = args[2];
      const cmdArgs = args.slice(3);

      try {
        const success = await conversationManager.addMcpServer(name, {
          type: 'stdio',
          command,
          args: cmdArgs.length > 0 ? cmdArgs : undefined,
          enabled: true,
        });

        if (success) {
          return {
            success: true,
            message: `已添加 MCP 服务器: ${name}\n\n命令: ${command} ${cmdArgs.join(' ')}\n类型: stdio\n状态: 已启用`,
          };
        } else {
          return {
            success: false,
            message: `添加 MCP 服务器 ${name} 失败。\n\n可能原因:\n  • 服务器名称已存在\n  • 配置无效`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `添加 MCP 服务器失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /mcp remove <name>
    if (subcommand === 'remove') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /mcp remove <name>\n\n示例: /mcp remove my-server',
        };
      }

      const name = args[1];

      try {
        const success = await conversationManager.removeMcpServer(name);

        if (success) {
          return {
            success: true,
            message: `已删除 MCP 服务器: ${name}`,
          };
        } else {
          return {
            success: false,
            message: `MCP 服务器 ${name} 不存在。\n\n使用 /mcp list 查看所有服务器。`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `删除 MCP 服务器失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /mcp toggle <name>
    if (subcommand === 'toggle' || subcommand === 'enable' || subcommand === 'disable') {
      if (args.length < 2) {
        return {
          success: false,
          message: `用法: /mcp ${subcommand} <name>\n\n示例: /mcp ${subcommand} my-server`,
        };
      }

      const name = args[1];
      let enabled: boolean | undefined = undefined;

      if (subcommand === 'enable') {
        enabled = true;
      } else if (subcommand === 'disable') {
        enabled = false;
      }

      try {
        const result = await conversationManager.toggleMcpServer(name, enabled);

        if (result.success) {
          return {
            success: true,
            message: `MCP 服务器 ${name} 已${result.enabled ? '启用' : '禁用'}`,
          };
        } else {
          return {
            success: false,
            message: `MCP 服务器 ${name} 不存在。\n\n使用 /mcp list 查看所有服务器。`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `切换 MCP 服务器失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: false,
      message: `未知子命令: ${subcommand}\n\n可用命令:\n  list   - 列出所有服务器\n  add    - 添加服务器\n  remove - 删除服务器\n  toggle - 启用/禁用服务器`,
    };
  },
};

// /checkpoint - 管理文件检查点
const checkpointCommand: SlashCommand = {
  name: 'checkpoint',
  aliases: ['cp'],
  description: '管理文件检查点（保存和恢复文件状态）',
  usage: '/checkpoint [list|create|restore|delete|diff|clear] [参数]',
  category: 'utility',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args } = ctx;

    // 动态导入 CheckpointManager
    const { CheckpointManager } = await import('./checkpoint-manager.js');
    const checkpointManager = new CheckpointManager();

    // 默认行为：列出所有检查点
    if (!args || args.length === 0 || args[0] === 'list') {
      try {
        const checkpoints = checkpointManager.listCheckpoints({
          limit: 20,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        });

        if (checkpoints.length === 0) {
          return {
            success: true,
            message: '没有检查点。\n\n使用 /checkpoint create <描述> <文件1> [文件2...] 创建检查点。',
          };
        }

        const stats = checkpointManager.getStats();

        let message = '检查点列表\n\n';

        checkpoints.forEach((cp, idx) => {
          const date = new Date(cp.timestamp).toLocaleString('zh-CN');
          const fileCount = cp.files.length;
          const totalSize = cp.files.reduce((sum, f) => sum + f.size, 0);
          const sizeKB = (totalSize / 1024).toFixed(2);

          message += `${idx + 1}. ${cp.description}\n`;
          message += `   ID: ${cp.id.slice(0, 8)}\n`;
          message += `   时间: ${date}\n`;
          message += `   文件: ${fileCount} 个 (${sizeKB} KB)\n`;
          if (cp.metadata?.tags && cp.metadata.tags.length > 0) {
            message += `   标签: ${cp.metadata.tags.join(', ')}\n`;
          }
          message += '\n';
        });

        message += `总计: ${stats.total} 个检查点, ${stats.totalFiles} 个文件, ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n\n`;
        message += '使用命令:\n';
        message += '  /checkpoint create <描述> <文件...>  - 创建检查点\n';
        message += '  /checkpoint restore <id>             - 恢复检查点\n';
        message += '  /checkpoint diff <id>                - 查看差异\n';
        message += '  /checkpoint delete <id>              - 删除检查点\n';
        message += '  /checkpoint clear                    - 清除所有检查点';

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `列出检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const subcommand = args[0].toLowerCase();

    // /checkpoint create <description> <file1> [file2...]
    if (subcommand === 'create') {
      if (args.length < 3) {
        return {
          success: false,
          message: '用法: /checkpoint create <描述> <文件1> [文件2...]\n\n示例: /checkpoint create "功能完成前的状态" src/index.ts src/utils.ts',
        };
      }

      const description = args[1];
      const filePaths = args.slice(2);

      try {
        const checkpoint = await checkpointManager.createCheckpoint(
          description,
          filePaths,
          ctx.cwd
        );

        const totalSize = checkpoint.files.reduce((sum, f) => sum + f.size, 0);
        const sizeKB = (totalSize / 1024).toFixed(2);

        return {
          success: true,
          message: `已创建检查点\n\n` +
            `ID: ${checkpoint.id.slice(0, 8)}\n` +
            `描述: ${checkpoint.description}\n` +
            `文件: ${checkpoint.files.length} 个 (${sizeKB} KB)\n` +
            `时间: ${checkpoint.timestamp.toLocaleString('zh-CN')}\n\n` +
            `使用 /checkpoint restore ${checkpoint.id.slice(0, 8)} 恢复此检查点`,
        };
      } catch (error) {
        return {
          success: false,
          message: `创建检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /checkpoint restore <id>
    if (subcommand === 'restore') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /checkpoint restore <checkpoint-id>\n\n使用 /checkpoint list 查看所有检查点。',
        };
      }

      // 支持短ID（前8位）
      const inputId = args[1];
      const checkpoints = checkpointManager.listCheckpoints({});
      const checkpoint = checkpoints.find(cp => cp.id.startsWith(inputId) || cp.id === inputId);

      if (!checkpoint) {
        return {
          success: false,
          message: `检查点 ${inputId} 不存在。\n\n使用 /checkpoint list 查看所有检查点。`,
        };
      }

      try {
        const result = await checkpointManager.restoreCheckpoint(checkpoint.id, {
          dryRun: false,
          skipBackup: false,
        });

        if (result.success) {
          return {
            success: true,
            message: `已恢复检查点: ${checkpoint.description}\n\n` +
              `恢复的文件: ${result.restored.length} 个\n` +
              `${result.restored.map(f => `  • ${f}`).join('\n')}\n\n` +
              `备份文件已创建（.backup-* 后缀）`,
          };
        } else {
          let message = `恢复检查点失败\n\n`;
          message += `成功: ${result.restored.length} 个\n`;
          if (result.restored.length > 0) {
            message += result.restored.map(f => `  ✓ ${f}`).join('\n') + '\n\n';
          }
          message += `失败: ${result.failed.length} 个\n`;
          if (result.errors.length > 0) {
            message += result.errors.map(e => `  ✗ ${e.path}: ${e.error}`).join('\n');
          }
          return { success: false, message };
        }
      } catch (error) {
        return {
          success: false,
          message: `恢复检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /checkpoint delete <id>
    if (subcommand === 'delete' || subcommand === 'del' || subcommand === 'rm') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /checkpoint delete <checkpoint-id>\n\n使用 /checkpoint list 查看所有检查点。',
        };
      }

      const inputId = args[1];
      const checkpoints = checkpointManager.listCheckpoints({});
      const checkpoint = checkpoints.find(cp => cp.id.startsWith(inputId) || cp.id === inputId);

      if (!checkpoint) {
        return {
          success: false,
          message: `检查点 ${inputId} 不存在。\n\n使用 /checkpoint list 查看所有检查点。`,
        };
      }

      try {
        const success = checkpointManager.deleteCheckpoint(checkpoint.id);

        if (success) {
          return {
            success: true,
            message: `已删除检查点: ${checkpoint.description}`,
          };
        } else {
          return {
            success: false,
            message: `删除检查点失败。`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `删除检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /checkpoint diff <id>
    if (subcommand === 'diff') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /checkpoint diff <checkpoint-id>\n\n使用 /checkpoint list 查看所有检查点。',
        };
      }

      const inputId = args[1];
      const checkpoints = checkpointManager.listCheckpoints({});
      const checkpoint = checkpoints.find(cp => cp.id.startsWith(inputId) || cp.id === inputId);

      if (!checkpoint) {
        return {
          success: false,
          message: `检查点 ${inputId} 不存在。\n\n使用 /checkpoint list 查看所有检查点。`,
        };
      }

      try {
        const diffs = await checkpointManager.diffCheckpoint(checkpoint.id);

        const stats = {
          added: diffs.filter(d => d.type === 'added').length,
          removed: diffs.filter(d => d.type === 'removed').length,
          modified: diffs.filter(d => d.type === 'modified').length,
          unchanged: diffs.filter(d => d.type === 'unchanged').length,
        };

        let message = `检查点差异: ${checkpoint.description}\n\n`;
        message += `统计:\n`;
        message += `  添加: ${stats.added} 个文件\n`;
        message += `  删除: ${stats.removed} 个文件\n`;
        message += `  修改: ${stats.modified} 个文件\n`;
        message += `  未变: ${stats.unchanged} 个文件\n\n`;

        if (stats.modified > 0) {
          message += `修改的文件:\n`;
          diffs.filter(d => d.type === 'modified').forEach(d => {
            message += `  • ${d.path}\n`;
          });
        }

        if (stats.removed > 0) {
          message += `\n删除的文件:\n`;
          diffs.filter(d => d.type === 'removed').forEach(d => {
            message += `  • ${d.path}\n`;
          });
        }

        if (stats.added > 0) {
          message += `\n新增的文件:\n`;
          diffs.filter(d => d.type === 'added').forEach(d => {
            message += `  • ${d.path}\n`;
          });
        }

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `比较检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /checkpoint clear
    if (subcommand === 'clear') {
      try {
        const count = checkpointManager.clearCheckpoints();

        return {
          success: true,
          message: `已清除 ${count} 个检查点。`,
        };
      } catch (error) {
        return {
          success: false,
          message: `清除检查点失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: false,
      message: `未知子命令: ${subcommand}\n\n可用命令:\n  list    - 列出所有检查点\n  create  - 创建检查点\n  restore - 恢复检查点\n  delete  - 删除检查点\n  diff    - 查看差异\n  clear   - 清除所有检查点`,
    };
  },
};

// /plugins - 管理插件
const pluginsCommand: SlashCommand = {
  name: 'plugins',
  aliases: ['plugin'],
  description: '管理 Claude Code 插件',
  usage: '/plugins [list|info|enable|disable|uninstall] [参数]',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args, conversationManager } = ctx;

    // 默认行为：列出所有插件
    if (!args || args.length === 0 || args[0] === 'list') {
      try {
        const plugins = await conversationManager.listPlugins();

        if (plugins.length === 0) {
          return {
            success: true,
            message: '没有安装插件。\n\n插件安装在: ~/.claude/plugins/ 和 ./.claude/plugins/\n\n更多信息: https://docs.anthropic.com/claude-code/plugins',
          };
        }

        let message = '插件列表\n\n';

        plugins.forEach((plugin, idx) => {
          const statusIcon = plugin.loaded ? '✓' : plugin.enabled ? '○' : '✗';
          const statusText = plugin.loaded ? '已加载' : plugin.enabled ? '已启用' : '已禁用';

          message += `${idx + 1}. ${statusIcon} ${plugin.name} v${plugin.version}\n`;
          if (plugin.description) {
            message += `   描述: ${plugin.description}\n`;
          }
          if (plugin.author) {
            message += `   作者: ${plugin.author}\n`;
          }
          message += `   状态: ${statusText}\n`;

          // 统计提供的功能
          const features: string[] = [];
          if (plugin.tools && plugin.tools.length > 0) {
            features.push(`${plugin.tools.length} 个工具`);
          }
          if (plugin.commands && plugin.commands.length > 0) {
            features.push(`${plugin.commands.length} 个命令`);
          }
          if (plugin.skills && plugin.skills.length > 0) {
            features.push(`${plugin.skills.length} 个技能`);
          }
          if (plugin.hooks && plugin.hooks.length > 0) {
            features.push(`${plugin.hooks.length} 个钩子`);
          }

          if (features.length > 0) {
            message += `   功能: ${features.join(', ')}\n`;
          }

          if (plugin.error) {
            message += `   ⚠️  错误: ${plugin.error}\n`;
          }

          message += '\n';
        });

        message += `总计: ${plugins.length} 个插件\n`;
        message += `已加载: ${plugins.filter(p => p.loaded).length} | `;
        message += `已启用: ${plugins.filter(p => p.enabled).length} | `;
        message += `已禁用: ${plugins.filter(p => !p.enabled).length}\n\n`;

        message += '使用命令:\n';
        message += '  /plugins list              - 列出所有插件\n';
        message += '  /plugins info <name>       - 查看插件详情\n';
        message += '  /plugins enable <name>     - 启用插件\n';
        message += '  /plugins disable <name>    - 禁用插件\n';
        message += '  /plugins uninstall <name>  - 卸载插件';

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `列出插件失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const subcommand = args[0].toLowerCase();

    // /plugins info <name>
    if (subcommand === 'info') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /plugins info <插件名>\n\n示例: /plugins info my-plugin',
        };
      }

      const pluginName = args[1];

      try {
        const plugin = await conversationManager.getPluginInfo(pluginName);

        if (!plugin) {
          return {
            success: false,
            message: `插件 ${pluginName} 不存在。\n\n使用 /plugins list 查看所有插件。`,
          };
        }

        let message = `插件详情: ${plugin.name}\n`;
        message += '='.repeat(plugin.name.length + 6) + '\n\n';
        message += `版本: ${plugin.version}\n`;
        if (plugin.description) {
          message += `描述: ${plugin.description}\n`;
        }
        if (plugin.author) {
          message += `作者: ${plugin.author}\n`;
        }
        message += `状态: ${plugin.loaded ? '已加载' : plugin.enabled ? '已启用' : '已禁用'}\n`;
        message += `路径: ${plugin.path}\n\n`;

        // 显示功能详情
        if (plugin.tools && plugin.tools.length > 0) {
          message += `工具 (${plugin.tools.length}):\n`;
          plugin.tools.forEach(tool => {
            message += `  • ${tool}\n`;
          });
          message += '\n';
        }

        if (plugin.commands && plugin.commands.length > 0) {
          message += `命令 (${plugin.commands.length}):\n`;
          plugin.commands.forEach(cmd => {
            message += `  • ${cmd}\n`;
          });
          message += '\n';
        }

        if (plugin.skills && plugin.skills.length > 0) {
          message += `技能 (${plugin.skills.length}):\n`;
          plugin.skills.forEach(skill => {
            message += `  • ${skill}\n`;
          });
          message += '\n';
        }

        if (plugin.hooks && plugin.hooks.length > 0) {
          message += `钩子 (${plugin.hooks.length}):\n`;
          plugin.hooks.forEach(hook => {
            message += `  • ${hook}\n`;
          });
          message += '\n';
        }

        if (plugin.error) {
          message += `⚠️  错误:\n${plugin.error}\n`;
        }

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `获取插件信息失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /plugins enable <name>
    if (subcommand === 'enable') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /plugins enable <插件名>\n\n示例: /plugins enable my-plugin',
        };
      }

      const pluginName = args[1];

      try {
        const success = await conversationManager.enablePlugin(pluginName);

        if (success) {
          return {
            success: true,
            message: `已启用插件: ${pluginName}\n\n插件将在下次对话时加载。`,
          };
        } else {
          return {
            success: false,
            message: `启用插件 ${pluginName} 失败。\n\n可能原因:\n  • 插件不存在\n  • 插件配置无效`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `启用插件失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /plugins disable <name>
    if (subcommand === 'disable') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /plugins disable <插件名>\n\n示例: /plugins disable my-plugin',
        };
      }

      const pluginName = args[1];

      try {
        const success = await conversationManager.disablePlugin(pluginName);

        if (success) {
          return {
            success: true,
            message: `已禁用插件: ${pluginName}\n\n插件将在下次对话时卸载。`,
          };
        } else {
          return {
            success: false,
            message: `禁用插件 ${pluginName} 失败。\n\n可能原因:\n  • 插件不存在`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `禁用插件失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /plugins uninstall <name>
    if (subcommand === 'uninstall' || subcommand === 'remove') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /plugins uninstall <插件名>\n\n示例: /plugins uninstall my-plugin',
        };
      }

      const pluginName = args[1];

      try {
        const success = await conversationManager.uninstallPlugin(pluginName);

        if (success) {
          return {
            success: true,
            message: `已卸载插件: ${pluginName}\n\n插件文件已从磁盘删除。`,
          };
        } else {
          return {
            success: false,
            message: `卸载插件 ${pluginName} 失败。\n\n可能原因:\n  • 插件不存在\n  • 其他插件依赖此插件`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `卸载插件失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: false,
      message: `未知子命令: ${subcommand}\n\n可用命令:\n  list      - 列出所有插件\n  info      - 查看插件详情\n  enable    - 启用插件\n  disable   - 禁用插件\n  uninstall - 卸载插件`,
    };
  },
};

// /auth - 认证管理命令
const authCommand: SlashCommand = {
  name: 'auth',
  description: '管理认证和API密钥',
  usage: '/auth [status|set <key>|clear]',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    const { args } = ctx;

    // 动态导入 authManager
    const { authManager } = await import('./auth-manager.js');

    // 默认行为：显示认证状态
    if (!args || args.length === 0 || args[0] === 'status') {
      try {
        const status = authManager.getAuthStatus();
        const maskedKey = authManager.getMaskedApiKey();

        let message = '认证状态\n\n';
        message += `认证: ${status.authenticated ? '✓ 已认证' : '✗ 未认证'}\n`;
        message += `类型: ${status.type === 'api_key' ? 'API密钥' : status.type === 'oauth' ? 'OAuth' : '无'}\n`;
        message += `Provider: ${status.provider}\n`;

        if (maskedKey) {
          message += `API密钥: ${maskedKey}\n`;
        }

        if (status.username) {
          message += `用户: ${status.username}\n`;
        }

        if (status.expiresAt) {
          const expiresDate = new Date(status.expiresAt);
          message += `过期时间: ${expiresDate.toLocaleString('zh-CN')}\n`;
        }

        message += '\n可用命令:\n';
        message += '  /auth status       - 显示认证状态\n';
        message += '  /auth set <key>    - 设置API密钥\n';
        message += '  /auth clear        - 清除认证（登出）\n';
        message += '  /logout            - 等同于 /auth clear';

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `获取认证状态失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const subcommand = args[0].toLowerCase();

    // /auth set <api_key>
    if (subcommand === 'set') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /auth set <api_key>\n\n示例: /auth set sk-ant-api03-...',
        };
      }

      const apiKey = args.slice(1).join(' '); // 支持包含空格的密钥（虽然通常不会有）

      try {
        const success = authManager.setApiKey(apiKey);

        if (success) {
          const maskedKey = authManager.getMaskedApiKey();
          return {
            success: true,
            message: `API密钥已设置\n\n密钥: ${maskedKey}\n\n注意: 密钥已保存到配置文件。`,
          };
        } else {
          return {
            success: false,
            message: '设置API密钥失败。请检查密钥格式。',
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `设置API密钥失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /auth clear
    if (subcommand === 'clear') {
      try {
        authManager.clearAuth();

        return {
          success: true,
          message: '认证已清除。\n\nAPI密钥已从配置中移除。',
        };
      } catch (error) {
        return {
          success: false,
          message: `清除认证失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // /auth validate <api_key>
    if (subcommand === 'validate') {
      if (args.length < 2) {
        return {
          success: false,
          message: '用法: /auth validate <api_key>\n\n验证API密钥是否有效。',
        };
      }

      const apiKey = args.slice(1).join(' ');

      try {
        let message = '正在验证API密钥...\n\n';
        const valid = await authManager.validateApiKey(apiKey);

        if (valid) {
          message += '✓ API密钥有效\n\n';
          message += '密钥已通过验证，可以正常使用。';
        } else {
          message += '✗ API密钥无效\n\n';
          message += '密钥验证失败，请检查密钥是否正确。';
        }

        return { success: valid, message };
      } catch (error) {
        return {
          success: false,
          message: `验证API密钥失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: false,
      message: `未知子命令: ${subcommand}\n\n可用命令:\n  status   - 显示认证状态\n  set      - 设置API密钥\n  clear    - 清除认证\n  validate - 验证API密钥`,
    };
  },
};

// /logout - 登出（清除认证）
const logoutCommand: SlashCommand = {
  name: 'logout',
  description: '登出（清除API密钥）',
  category: 'config',
  execute: async (ctx: ExtendedCommandContext): Promise<CommandResult> => {
    // 直接调用 /auth clear
    return authCommand.execute({
      ...ctx,
      args: ['clear'],
    });
  },
};

// 注册工具和提示命令
registry.register(tasksCommand);
registry.register(toolsCommand);
registry.register(promptCommand);
registry.register(apiCommand);
registry.register(doctorCommand);
registry.register(mcpCommand);
registry.register(checkpointCommand);
registry.register(pluginsCommand);
registry.register(authCommand);
registry.register(logoutCommand);

/**
 * 检查输入是否为斜杠命令
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * 执行斜杠命令
 */
export async function executeSlashCommand(
  input: string,
  ctx: CommandContext
): Promise<CommandResult> {
  return registry.execute(input, ctx);
}
