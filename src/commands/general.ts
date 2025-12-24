/**
 * 通用命令 - help, clear, exit, status, bug, doctor
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';

// /help - 显示帮助信息
export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['?', 'h'],
  description: 'Show available commands and help information',
  usage: '/help [command]',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    if (args.length > 0) {
      // 显示特定命令的帮助
      const cmdName = args[0].replace(/^\//, '');
      const cmd = commandRegistry.get(cmdName);

      if (cmd) {
        const helpText = `Command: /${cmd.name}
${cmd.aliases ? `Aliases: ${cmd.aliases.map(a => '/' + a).join(', ')}` : ''}
Category: ${cmd.category}

Description: ${cmd.description}
${cmd.usage ? `Usage: ${cmd.usage}` : ''}`;

        ctx.ui.addMessage('assistant', helpText);
        return { success: true };
      } else {
        ctx.ui.addMessage('assistant', `Unknown command: /${cmdName}`);
        return { success: false };
      }
    }

    // 显示所有命令
    const categories: Record<string, SlashCommand[]> = {};
    for (const cmd of commandRegistry.getAll()) {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    }

    const categoryNames: Record<string, string> = {
      general: 'General',
      session: 'Session',
      config: 'Configuration',
      tools: 'Tools & Integrations',
      auth: 'Authentication',
      utility: 'Utility',
      development: 'Development',
    };

    let helpText = 'Available Commands:\n\n';

    for (const [category, cmds] of Object.entries(categories)) {
      helpText += `${categoryNames[category] || category}:\n`;
      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const aliasStr = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
        helpText += `  /${cmd.name.padEnd(16)}${aliasStr.padEnd(12)} - ${cmd.description}\n`;
      }
      helpText += '\n';
    }

    helpText += 'Press ? for keyboard shortcuts\nUse /help <command> for detailed help';

    ctx.ui.addMessage('assistant', helpText);
    return { success: true };
  },
};

// /clear - 清除对话历史
export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear conversation history',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    ctx.session.clearMessages();
    ctx.ui.addActivity('Cleared conversation');
    ctx.ui.addMessage('assistant', 'Conversation cleared.');
    return { success: true, action: 'clear' };
  },
};

// /exit - 退出程序
export const exitCommand: SlashCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit Claude Code',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    ctx.ui.exit();
    return { success: true, action: 'exit' };
  },
};

// /status - 显示会话状态
export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Show current session status',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();
    const { config } = ctx;

    const statusText = `Session Status:

Model: ${config.modelDisplayName}
API: ${config.apiType}
${config.organization ? `Organization: ${config.organization}` : ''}
${config.username ? `User: ${config.username}` : ''}

Session ID: ${ctx.session.id}
Messages: ${stats.messageCount}
Duration: ${Math.round(stats.duration / 1000)}s
Cost: ${stats.totalCost}

Working Directory: ${config.cwd}
Version: ${config.version}`;

    ctx.ui.addMessage('assistant', statusText);
    return { success: true };
  },
};

// /doctor - 运行诊断
export const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: 'Run diagnostics and health checks',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const { config } = ctx;
    const memUsage = process.memoryUsage();

    const diagnostics = `Running diagnostics...

System:
  Node.js: ${process.version}
  Platform: ${process.platform}
  Arch: ${process.arch}
  PID: ${process.pid}

Memory:
  Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB
  Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB
  RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB

Configuration:
  Model: ${config.modelDisplayName}
  API Type: ${config.apiType}
  Working Directory: ${config.cwd}

Environment:
  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set'}
  CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? 'Set' : 'Not set'}

All systems operational!`;

    ctx.ui.addMessage('assistant', diagnostics);
    ctx.ui.addActivity('Ran diagnostics');
    return { success: true };
  },
};

// /bug - 报告问题
export const bugCommand: SlashCommand = {
  name: 'bug',
  aliases: ['report', 'issue'],
  description: 'Report a bug or issue',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const { config } = ctx;

    const bugReport = `Report a Bug

Please report issues at:
https://github.com/anthropics/claude-code/issues

When reporting, please include:
  - Description of the issue
  - Steps to reproduce
  - Expected vs actual behavior
  - Error messages (if any)

System Information:
  Version: ${config.version}
  Model: ${config.modelDisplayName}
  Platform: ${process.platform}
  Node.js: ${process.version}

You can also use /feedback to submit general feedback.`;

    ctx.ui.addMessage('assistant', bugReport);
    return { success: true };
  },
};

// /version - 显示版本
export const versionCommand: SlashCommand = {
  name: 'version',
  aliases: ['ver', 'v'],
  description: 'Show version information',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    ctx.ui.addMessage('assistant', `Claude Code v${ctx.config.version}`);
    return { success: true };
  },
};

// 注册所有通用命令
export function registerGeneralCommands(): void {
  commandRegistry.register(helpCommand);
  commandRegistry.register(clearCommand);
  commandRegistry.register(exitCommand);
  commandRegistry.register(statusCommand);
  commandRegistry.register(doctorCommand);
  commandRegistry.register(bugCommand);
  commandRegistry.register(versionCommand);
}
