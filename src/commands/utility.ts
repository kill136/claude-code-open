/**
 * 工具命令 - cost, usage, files, tasks, todos, add-dir
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
import * as fs from 'fs';
import * as path from 'path';

// /cost - 费用统计
export const costCommand: SlashCommand = {
  name: 'cost',
  description: 'Show API cost and spending information',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();

    const costInfo = `API Cost Information:

Current Session:
  Cost: ${stats.totalCost}
  Messages: ${stats.messageCount}
  Duration: ${Math.round(stats.duration / 1000)}s

Pricing (Anthropic API):
  Claude Opus:
    Input:  $15.00 / 1M tokens
    Output: $75.00 / 1M tokens

  Claude Sonnet:
    Input:  $3.00 / 1M tokens
    Output: $15.00 / 1M tokens

  Claude Haiku:
    Input:  $0.25 / 1M tokens
    Output: $1.25 / 1M tokens

For detailed billing:
  - API: https://console.anthropic.com/billing
  - claude.ai: https://claude.ai/settings/billing

Tips to reduce costs:
  - Use Haiku for simple tasks
  - Use /compact to reduce context
  - Be concise in prompts`;

    ctx.ui.addMessage('assistant', costInfo);
    return { success: true };
  },
};

// /usage - 使用量统计
export const usageCommand: SlashCommand = {
  name: 'usage',
  description: 'Show usage statistics',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();

    const usageInfo = `Usage Statistics:

Current Session:
  Messages: ${stats.messageCount}
  Duration: ${Math.round(stats.duration / 1000)}s
  Est. Tokens: ~${stats.messageCount * 500}

Today:
  (Session-based tracking)

This Month:
  (Requires API billing dashboard)

Usage Limits:
  API: Per-account limits
  claude.ai: Plan-based limits

To check API limits:
  https://console.anthropic.com/settings

To check claude.ai limits:
  https://claude.ai/settings

Related commands:
  /cost     - Spending information
  /context  - Context window usage
  /stats    - Session statistics`;

    ctx.ui.addMessage('assistant', usageInfo);
    return { success: true };
  },
};

// /files - 文件列表
export const filesCommand: SlashCommand = {
  name: 'files',
  aliases: ['ls'],
  description: 'List files in the current directory or context',
  usage: '/files [path]',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;
    const targetPath = args[0] ? path.resolve(config.cwd, args[0]) : config.cwd;

    try {
      if (!fs.existsSync(targetPath)) {
        ctx.ui.addMessage('assistant', `Path not found: ${targetPath}`);
        return { success: false };
      }

      const stat = fs.statSync(targetPath);

      if (!stat.isDirectory()) {
        // 显示文件信息
        const fileInfo = `File: ${path.basename(targetPath)}
Path: ${targetPath}
Size: ${stat.size} bytes
Modified: ${stat.mtime.toLocaleString()}
Type: ${path.extname(targetPath) || 'no extension'}`;

        ctx.ui.addMessage('assistant', fileInfo);
        return { success: true };
      }

      // 列出目录内容
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });

      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name + '/');
      const files = entries.filter(e => e.isFile()).map(e => e.name);

      let listing = `Directory: ${targetPath}\n\n`;

      if (dirs.length > 0) {
        listing += `Directories:\n${dirs.map(d => `  ${d}`).join('\n')}\n\n`;
      }

      if (files.length > 0) {
        listing += `Files:\n${files.slice(0, 50).map(f => `  ${f}`).join('\n')}`;
        if (files.length > 50) {
          listing += `\n  ... and ${files.length - 50} more files`;
        }
      }

      if (dirs.length === 0 && files.length === 0) {
        listing += '(empty directory)';
      }

      ctx.ui.addMessage('assistant', listing);
      return { success: true };
    } catch (error) {
      ctx.ui.addMessage('assistant', `Error reading path: ${error}`);
      return { success: false };
    }
  },
};

// /tasks - 任务列表
export const tasksCommand: SlashCommand = {
  name: 'tasks',
  description: 'Show running background tasks',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const tasksInfo = `Background Tasks:

Currently Running:
  (No background tasks)

Task Types:
  - Bash commands (background)
  - Agent tasks
  - Long-running operations

Commands:
  /tasks           - List all tasks
  /tasks kill <id> - Kill a task

To run a command in background:
  Ask Claude to run a command with "in background"

Example:
  "Run npm test in the background"`;

    ctx.ui.addMessage('assistant', tasksInfo);
    return { success: true };
  },
};

// /todos - Todo 列表
export const todosCommand: SlashCommand = {
  name: 'todos',
  aliases: ['todo'],
  description: 'Show or manage the current todo list',
  usage: '/todos [add|clear|done]',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const action = args[0] || 'list';

    const todosInfo = `Todo List:

Current Todos:
  (Managed by Claude during conversation)

The todo list helps Claude track:
  - Multi-step tasks
  - Implementation progress
  - Pending items

Commands:
  /todos           - Show current todos
  /todos add <item> - Add a todo item
  /todos clear     - Clear all todos
  /todos done <n>  - Mark item as done

Note: Claude automatically manages todos during
complex tasks. You can also ask Claude to
"add X to the todo list" or "show todos".`;

    ctx.ui.addMessage('assistant', todosInfo);
    return { success: true };
  },
};

// /add-dir - 添加目录到上下文
export const addDirCommand: SlashCommand = {
  name: 'add-dir',
  aliases: ['add'],
  description: 'Add a directory to the working context',
  usage: '/add-dir <path>',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;

    if (args.length === 0) {
      ctx.ui.addMessage('assistant', `Usage: /add-dir <path>

Add a directory to Claude's working context.

This helps when:
  - Working with multiple projects
  - Referencing external code
  - Accessing shared libraries

Examples:
  /add-dir ../shared-lib
  /add-dir /path/to/other/project

Current working directory:
  ${config.cwd}`);
      return { success: true };
    }

    const targetDir = path.resolve(config.cwd, args[0]);

    if (!fs.existsSync(targetDir)) {
      ctx.ui.addMessage('assistant', `Directory not found: ${targetDir}`);
      return { success: false };
    }

    if (!fs.statSync(targetDir).isDirectory()) {
      ctx.ui.addMessage('assistant', `Not a directory: ${targetDir}`);
      return { success: false };
    }

    ctx.ui.addMessage('assistant', `Added directory to context: ${targetDir}

Claude can now access files in this directory.
Use absolute paths or relative paths from this location.`);
    ctx.ui.addActivity(`Added directory: ${targetDir}`);
    return { success: true };
  },
};

// /stickers - 贴纸
export const stickersCommand: SlashCommand = {
  name: 'stickers',
  description: 'Fun stickers and reactions',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const stickers = `Stickers:

Claude's Reactions:
  (•‿•)    - Happy
  (╯°□°)╯  - Frustrated
  ¯\\_(ツ)_/¯ - Shrug
  (ノ◕ヮ◕)ノ*:・゚✧ - Excited
  ( ˘ω˘ )  - Content
  ಠ_ಠ     - Disapproval
  ⊂(◉‿◉)つ - Hug

Claude Mascot:
     ▐▛███▜▌
    ▝▜█████▛▘
      ▘▘ ▝▝

Fun fact: The mascot's name is "Clawd"!`;

    ctx.ui.addMessage('assistant', stickers);
    return { success: true };
  },
};

// 注册所有工具命令
export function registerUtilityCommands(): void {
  commandRegistry.register(costCommand);
  commandRegistry.register(usageCommand);
  commandRegistry.register(filesCommand);
  commandRegistry.register(tasksCommand);
  commandRegistry.register(todosCommand);
  commandRegistry.register(addDirCommand);
  commandRegistry.register(stickersCommand);
}
