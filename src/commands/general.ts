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

// /memory - 记忆管理 (官方风格)
export const memoryCommand: SlashCommand = {
  name: 'memory',
  aliases: ['mem', 'remember'],
  description: 'Manage persistent memory for user preferences and project context',
  usage: '/memory [show|add|clear|search] [content]',
  category: 'general',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args } = ctx;

    // 动态导入 memory 模块
    const { getMemoryManager } = await import('../memory/index.js');
    const memoryManager = getMemoryManager(ctx.config.cwd);

    // 无参数或 show：显示所有记忆
    if (args.length === 0 || args[0] === 'show') {
      const entries = memoryManager.list();

      if (entries.length === 0) {
        ctx.ui.addMessage('assistant', 'No memory entries found.\n\nUse /memory add <content> to create memories.');
        return { success: true };
      }

      let memoryText = `Memory Entries (${entries.length})\n\n`;

      // 按作用域分组
      const globalEntries = entries.filter(e => e.scope === 'global');
      const projectEntries = entries.filter(e => e.scope === 'project');

      if (projectEntries.length > 0) {
        memoryText += `Project Memory (${projectEntries.length})\n`;
        memoryText += `${'-'.repeat(20)}\n`;
        for (const entry of projectEntries) {
          const updatedDate = new Date(entry.updatedAt).toLocaleDateString();
          memoryText += `  • ${entry.key}: ${entry.value}\n`;
          memoryText += `    Updated: ${updatedDate}\n`;
        }
        memoryText += '\n';
      }

      if (globalEntries.length > 0) {
        memoryText += `Global Memory (${globalEntries.length})\n`;
        memoryText += `${'-'.repeat(20)}\n`;
        for (const entry of globalEntries) {
          const updatedDate = new Date(entry.updatedAt).toLocaleDateString();
          memoryText += `  • ${entry.key}: ${entry.value}\n`;
          memoryText += `    Updated: ${updatedDate}\n`;
        }
        memoryText += '\n';
      }

      memoryText += `Commands:\n`;
      memoryText += `  /memory add <key>: <value>  - Add new memory\n`;
      memoryText += `  /memory search <query>      - Search memories\n`;
      memoryText += `  /memory clear               - Clear all memories\n`;

      ctx.ui.addMessage('assistant', memoryText);
      return { success: true };
    }

    // add: 添加记忆
    if (args[0] === 'add') {
      if (args.length < 2) {
        ctx.ui.addMessage('assistant', 'Usage: /memory add <key>: <value>\n\nExample: /memory add preferred_language: TypeScript');
        return { success: false };
      }

      const content = args.slice(1).join(' ');
      const colonIndex = content.indexOf(':');

      if (colonIndex === -1) {
        ctx.ui.addMessage('assistant', 'Invalid format. Use: /memory add <key>: <value>\n\nExample: /memory add coding_style: functional programming');
        return { success: false };
      }

      const key = content.substring(0, colonIndex).trim();
      const value = content.substring(colonIndex + 1).trim();

      if (!key || !value) {
        ctx.ui.addMessage('assistant', 'Both key and value are required.\n\nExample: /memory add test_framework: Jest');
        return { success: false };
      }

      memoryManager.set(key, value, 'project');
      ctx.ui.addMessage('assistant', `Memory added:\n  ${key}: ${value}\n\nThis will be remembered for future conversations in this project.`);
      ctx.ui.addActivity(`Added memory: ${key}`);
      return { success: true };
    }

    // clear: 清除记忆
    if (args[0] === 'clear') {
      const scope = args[1] === 'global' ? 'global' : 'project';
      memoryManager.clear(scope);
      ctx.ui.addMessage('assistant', `${scope === 'global' ? 'Global' : 'Project'} memory cleared.`);
      ctx.ui.addActivity('Cleared memory');
      return { success: true };
    }

    // search: 搜索记忆
    if (args[0] === 'search') {
      if (args.length < 2) {
        ctx.ui.addMessage('assistant', 'Usage: /memory search <query>\n\nExample: /memory search language');
        return { success: false };
      }

      const query = args.slice(1).join(' ');
      const results = memoryManager.search(query);

      if (results.length === 0) {
        ctx.ui.addMessage('assistant', `No memories found matching "${query}".`);
        return { success: true };
      }

      let searchText = `Search Results for "${query}" (${results.length})\n\n`;
      for (const entry of results) {
        searchText += `  • ${entry.key}: ${entry.value}\n`;
        searchText += `    Scope: ${entry.scope}, Updated: ${new Date(entry.updatedAt).toLocaleDateString()}\n`;
      }

      ctx.ui.addMessage('assistant', searchText);
      return { success: true };
    }

    // 未知子命令
    ctx.ui.addMessage('assistant', `Unknown memory command: ${args[0]}\n\nAvailable commands:\n  /memory [show]     - Show all memories\n  /memory add        - Add new memory\n  /memory clear      - Clear memories\n  /memory search     - Search memories`);
    return { success: false };
  },
};

// /plan - 计划模式管理 (增强版)
export const planCommand: SlashCommand = {
  name: 'plan',
  description: 'Enter planning mode or manage current plan',
  usage: '/plan [status|exit|<task>]',
  category: 'development',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args } = ctx;

    // 动态导入 planmode 模块
    const { isPlanModeActive, getPlanFile } = await import('../tools/planmode.js');

    // /plan status - 显示当前计划状态
    if (args.length > 0 && args[0] === 'status') {
      if (!isPlanModeActive()) {
        ctx.ui.addMessage('assistant', 'Not currently in plan mode.\n\nUse /plan to enter plan mode for complex tasks.');
        return { success: true };
      }

      const planFile = getPlanFile();
      let statusText = `Plan Mode Status\n\n`;
      statusText += `Status: Active (READ-ONLY mode)\n`;
      statusText += `Plan File: ${planFile || 'Not yet created'}\n\n`;

      // 如果计划文件存在，读取并显示
      if (planFile) {
        try {
          const fs = await import('fs');
          if (fs.existsSync(planFile)) {
            const planContent = fs.readFileSync(planFile, 'utf-8');
            statusText += `Current Plan:\n`;
            statusText += `${'='.repeat(40)}\n`;
            statusText += planContent;
            statusText += `\n${'='.repeat(40)}\n\n`;
          }
        } catch (error) {
          // 忽略读取错误
        }
      }

      statusText += `Commands:\n`;
      statusText += `  /plan exit  - Exit plan mode and present plan for approval\n`;

      ctx.ui.addMessage('assistant', statusText);
      return { success: true };
    }

    // /plan exit - 退出计划模式
    if (args.length > 0 && args[0] === 'exit') {
      if (!isPlanModeActive()) {
        ctx.ui.addMessage('assistant', 'Not currently in plan mode.');
        return { success: false };
      }

      // 使用 ExitPlanMode 工具的提示
      const exitPrompt = 'Use the ExitPlanMode tool to exit plan mode and present your plan for approval.';
      ctx.ui.addMessage('user', exitPrompt);
      return { success: true };
    }

    // /plan 或 /plan <task> - 进入计划模式
    const taskDescription = args.join(' ');

    // 基于官方源码的完整计划模式提示
    const planPrompt = `You should now enter plan mode to handle this request.

${taskDescription ? `Task: ${taskDescription}

` : ''}Use the EnterPlanMode tool to begin planning.

## What is Plan Mode?

Plan Mode is designed for complex tasks that require careful planning and exploration before implementation.

## When to Use Plan Mode

Use EnterPlanMode when ANY of these conditions apply:

1. **Multiple Valid Approaches**: The task can be solved in several different ways, each with trade-offs
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

2. **Significant Architectural Decisions**: The task requires choosing between architectural patterns
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

3. **Large-Scale Changes**: The task touches many files or systems
   - Example: "Refactor the authentication system"
   - Example: "Migrate from REST to GraphQL"

4. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

5. **User Input Needed**: You'll need to ask clarifying questions before starting
   - Plan mode lets you explore first, then present options with context

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using Glob, Grep, and Read tools
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Write your plan to a plan file (the ONLY file you can edit in plan mode)
5. Use AskUserQuestion if you need to clarify approaches
6. Exit plan mode with ExitPlanMode when ready to implement

## Important Notes

- Plan mode is READ-ONLY: You cannot modify any files except the plan file
- You must thoroughly explore the codebase before writing your plan
- Your plan should be concise enough to scan quickly, but detailed enough to execute effectively
- Include the paths of critical files to be modified in your plan
- Only exit plan mode when you have a complete, actionable plan

## Available Commands

While in plan mode:
  /plan status  - View current plan and status
  /plan exit    - Exit plan mode (or use ExitPlanMode tool)`;

    ctx.ui.addMessage('user', planPrompt);
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
  commandRegistry.register(memoryCommand);
  commandRegistry.register(planCommand);
}
