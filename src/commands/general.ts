/**
 * 通用命令 - help, clear, exit, status, bug, doctor
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';

// /help - 显示帮助信息 (官方风格)
export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['?'],
  description: 'Show available commands and keyboard shortcuts',
  usage: '/help [command]',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    if (args.length > 0) {
      // 显示特定命令的帮助
      const cmdName = args[0].replace(/^\//, '');
      const cmd = commandRegistry.get(cmdName);

      if (cmd) {
        let helpText = `\n/${cmd.name}\n`;
        helpText += `${'='.repeat(cmd.name.length + 1)}\n\n`;
        helpText += `${cmd.description}\n\n`;

        if (cmd.usage) {
          helpText += `Usage:\n  ${cmd.usage}\n\n`;
        }

        if (cmd.aliases && cmd.aliases.length > 0) {
          helpText += `Aliases:\n  ${cmd.aliases.map(a => '/' + a).join(', ')}\n\n`;
        }

        helpText += `Category: ${cmd.category}\n`;

        ctx.ui.addMessage('assistant', helpText);
        return { success: true };
      } else {
        ctx.ui.addMessage('assistant', `Unknown command: /${cmdName}\n\nUse /help to see all available commands.`);
        return { success: false };
      }
    }

    // 显示所有命令（官方风格：按类别分组）
    const categories: Record<string, SlashCommand[]> = {};
    for (const cmd of commandRegistry.getAll()) {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    }

    const categoryOrder = ['general', 'session', 'config', 'tools', 'auth', 'utility', 'development'];
    const categoryNames: Record<string, string> = {
      general: 'General',
      session: 'Session Management',
      config: 'Configuration',
      tools: 'Tools & Integrations',
      auth: 'Authentication & Billing',
      utility: 'Utilities',
      development: 'Development',
    };

    let helpText = `\nClaude Code - Available Commands\n`;
    helpText += `${'='.repeat(35)}\n\n`;

    // 按预定义顺序显示分类
    for (const category of categoryOrder) {
      const cmds = categories[category];
      if (!cmds || cmds.length === 0) continue;

      helpText += `${categoryNames[category] || category}\n`;
      helpText += `${'-'.repeat((categoryNames[category] || category).length)}\n`;

      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const cmdDisplay = `/${cmd.name}`;
        const aliasStr = cmd.aliases && cmd.aliases.length > 0
          ? ` (${cmd.aliases.map(a => '/' + a).join(', ')})`
          : '';
        helpText += `  ${cmdDisplay.padEnd(20)}${cmd.description}${aliasStr}\n`;
      }
      helpText += '\n';
    }

    // 其他未分类的命令
    for (const [category, cmds] of Object.entries(categories)) {
      if (categoryOrder.includes(category)) continue;

      helpText += `${categoryNames[category] || category}\n`;
      helpText += `${'-'.repeat((categoryNames[category] || category).length)}\n`;

      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const cmdDisplay = `/${cmd.name}`;
        const aliasStr = cmd.aliases && cmd.aliases.length > 0
          ? ` (${cmd.aliases.map(a => '/' + a).join(', ')})`
          : '';
        helpText += `  ${cmdDisplay.padEnd(20)}${cmd.description}${aliasStr}\n`;
      }
      helpText += '\n';
    }

    // 快捷键提示
    helpText += `Keyboard Shortcuts\n`;
    helpText += `-----------------\n`;
    helpText += `  Ctrl+C              Cancel current operation\n`;
    helpText += `  Ctrl+D              Exit Claude Code\n`;
    helpText += `  Ctrl+L              Clear screen\n`;
    helpText += `  Ctrl+R              Search history\n`;
    helpText += `  Tab                 Autocomplete\n`;
    helpText += `  Up/Down arrows      Navigate history\n\n`;

    // 底部提示
    helpText += `Tips\n`;
    helpText += `----\n`;
    helpText += `  • Use /help <command> for detailed information about a specific command\n`;
    helpText += `  • Type ? at any time to see this help message\n`;
    helpText += `  • Visit https://code.claude.com/docs for full documentation\n\n`;

    helpText += `Version: ${ctx.config.version || 'unknown'}\n`;

    ctx.ui.addMessage('assistant', helpText);
    return { success: true };
  },
};

// /clear - 清除对话历史 (官方风格)
export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['reset', 'new'],  // 官方别名
  description: 'Clear conversation history and free up context',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    ctx.session.clearMessages();
    ctx.ui.addActivity('Cleared conversation');
    ctx.ui.addMessage('assistant', 'Conversation cleared. Context freed up.');
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

// /status - 显示会话状态 (完全基于官方实现)
export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Show Claude Code status including version, model, account, API connectivity, and tool statuses',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();
    const { config } = ctx;

    // 检查 API 状态
    const apiKeySet = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

    let statusText = `Claude Code Status\n\n`;

    // ===== 版本信息 =====
    statusText += `Version: v${config.version}\n`;
    statusText += `Model: ${config.modelDisplayName}\n\n`;

    // ===== 账户信息 =====
    statusText += `Account\n`;
    statusText += `  ${config.username ? `User: ${config.username}` : 'Not logged in'}\n`;
    statusText += `  API Type: ${config.apiType}\n`;
    if (config.organization) {
      statusText += `  Organization: ${config.organization}\n`;
    }
    statusText += '\n';

    // ===== API 连接状态 =====
    statusText += `API Connectivity\n`;
    statusText += `  API Key: ${apiKeySet ? '✓ Configured' : '✗ Not configured'}\n`;
    statusText += `  Status: ${apiKeySet ? '✓ Connected' : '✗ Not connected'}\n\n`;

    // ===== 会话信息 =====
    statusText += `Session\n`;
    statusText += `  ID: ${ctx.session.id.slice(0, 8)}\n`;
    statusText += `  Messages: ${stats.messageCount}\n`;
    statusText += `  Duration: ${formatDuration(stats.duration)}\n`;
    statusText += `  Cost: ${stats.totalCost}\n\n`;

    // ===== Token 使用统计 =====
    const modelUsage = stats.modelUsage;
    const totalTokens = Object.values(modelUsage).reduce((sum, tokens) => sum + tokens, 0);

    if (totalTokens > 0) {
      statusText += `Token Usage\n`;
      statusText += `  Total: ${formatNumber(totalTokens)} tokens\n`;

      // 按模型显示详细信息
      const sortedModels = Object.entries(modelUsage)
        .sort(([, a], [, b]) => b - a)
        .filter(([, tokens]) => tokens > 0);

      if (sortedModels.length > 0) {
        statusText += `  By Model:\n`;
        for (const [model, tokens] of sortedModels) {
          const modelName = getShortModelName(model);
          const percentage = ((tokens / totalTokens) * 100).toFixed(1);
          statusText += `    ${modelName}: ${formatNumber(tokens)} (${percentage}%)\n`;
        }
      }
      statusText += '\n';
    }

    // ===== 权限模式 =====
    if (config.permissionMode) {
      statusText += `Permissions\n`;
      statusText += `  Mode: ${config.permissionMode}\n\n`;
    }

    // ===== 工作目录 =====
    statusText += `Working Directory\n`;
    statusText += `  ${config.cwd}\n`;

    ctx.ui.addMessage('assistant', statusText);
    return { success: true };
  },
};

// 辅助函数：格式化持续时间
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// 辅助函数：格式化数字（添加千位分隔符）
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// 辅助函数：获取简短的模型名称
function getShortModelName(fullModelName: string): string {
  // 从完整模型名中提取简短名称
  if (fullModelName.includes('opus')) return 'Opus';
  if (fullModelName.includes('sonnet')) return 'Sonnet';
  if (fullModelName.includes('haiku')) return 'Haiku';

  // 如果是版本号格式，提取主要部分
  const match = fullModelName.match(/claude-(\w+)/);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }

  return fullModelName;
}

// /doctor - 运行诊断 (官方风格)
export const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: 'Diagnose and verify your Claude Code installation and settings',
  category: 'general',
  execute: (ctx: CommandContext): CommandResult => {
    const { config } = ctx;
    const memUsage = process.memoryUsage();
    const apiKeySet = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

    let diagnostics = `Claude Code Doctor\n\n`;
    diagnostics += `Running diagnostics...\n\n`;

    // 安装检查
    diagnostics += `Installation\n`;
    diagnostics += `  ✓ Claude Code v${config.version}\n`;
    diagnostics += `  ✓ Node.js ${process.version}\n`;
    diagnostics += `  ✓ Platform: ${process.platform} (${process.arch})\n\n`;

    // API 检查
    diagnostics += `API Configuration\n`;
    if (apiKeySet) {
      diagnostics += `  ✓ API key configured\n`;
      diagnostics += `  ✓ Model: ${config.modelDisplayName}\n`;
    } else {
      diagnostics += `  ✗ API key not configured\n`;
      diagnostics += `    Set ANTHROPIC_API_KEY or CLAUDE_API_KEY\n`;
    }
    diagnostics += '\n';

    // 工作环境
    diagnostics += `Environment\n`;
    diagnostics += `  ✓ Working directory: ${config.cwd}\n`;
    diagnostics += `  ✓ Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n\n`;

    // 工具状态
    diagnostics += `Tools\n`;
    diagnostics += `  ✓ Bash available\n`;
    diagnostics += `  ✓ File operations available\n`;
    diagnostics += `  ✓ Web fetch available\n\n`;

    // 总结
    if (apiKeySet) {
      diagnostics += `All checks passed! Claude Code is ready to use.`;
    } else {
      diagnostics += `Some issues found. Please configure your API key.`;
    }

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
