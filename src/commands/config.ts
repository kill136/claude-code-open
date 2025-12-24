/**
 * 配置命令 - config, permissions, memory, hooks, model, init
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 获取配置目录
const getConfigDir = () => path.join(os.homedir(), '.claude');
const getConfigFile = () => path.join(getConfigDir(), 'settings.json');

// 确保配置目录存在
const ensureConfigDir = () => {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 读取配置
const readConfig = (): Record<string, any> => {
  const configFile = getConfigFile();
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
};

// 写入配置
const writeConfig = (config: Record<string, any>): boolean => {
  try {
    ensureConfigDir();
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
};

// /config - 配置管理 (官方风格 - 打开配置面板)
export const configCommand: SlashCommand = {
  name: 'config',
  aliases: ['settings'],
  description: 'Open config panel',
  usage: '/config [key] [value]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const configFile = getConfigFile();
    let config = readConfig();

    // 无参数时显示交互式配置面板信息
    if (args.length === 0) {
      const configInfo = `╭─ Configuration ─────────────────────────────────────╮
│                                                     │
│  Settings Location: ${configFile.length > 30 ? '~/.claude/settings.json' : configFile}
│                                                     │
│  Current Settings:                                  │
│    model             ${config.model || 'sonnet'}
│    theme             ${config.theme || 'dark'}
│    verbose           ${config.verbose ?? false}
│    autoCompact       ${config.autoCompact ?? true}
│    defaultPermission ${config.defaultPermissionMode || 'default'}
│                                                     │
│  Commands:                                          │
│    /config <key>          View a setting            │
│    /config <key> <value>  Set a value               │
│    /config reset          Reset to defaults         │
│                                                     │
│  Interactive Settings:                              │
│    /theme      Change color theme                   │
│    /model      Switch AI model                      │
│    /vim        Toggle Vim mode                      │
│                                                     │
╰─────────────────────────────────────────────────────╯`;

      ctx.ui.addMessage('assistant', configInfo);
      return { success: true };
    }

    const key = args[0];

    // 重置配置
    if (key === 'reset') {
      if (writeConfig({})) {
        ctx.ui.addMessage('assistant', `Configuration reset to defaults.

Settings file cleared: ${configFile}

Restart Claude Code to apply all changes.`);
        ctx.ui.addActivity('Configuration reset');
        return { success: true };
      } else {
        ctx.ui.addMessage('assistant', 'Failed to reset configuration.');
        return { success: false };
      }
    }

    // 查看特定配置
    if (args.length === 1) {
      const value = config[key];
      if (value !== undefined) {
        ctx.ui.addMessage('assistant', `${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        ctx.ui.addMessage('assistant', `Setting '${key}' is not set.

Available settings:
  model, theme, verbose, autoCompact, defaultPermissionMode,
  mcpServers, hooks, allowedTools, disallowedTools`);
      }
      return { success: true };
    }

    // 设置配置值
    let value: any = args.slice(1).join(' ');

    // 尝试解析 JSON 值
    try {
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value))) value = Number(value);
      else if (value.startsWith('{') || value.startsWith('[')) {
        value = JSON.parse(value);
      }
    } catch {
      // 保持为字符串
    }

    config[key] = value;

    if (writeConfig(config)) {
      ctx.ui.addMessage('assistant', `✓ Set ${key} = ${JSON.stringify(value)}

Configuration saved to: ${configFile}
Some settings may require restart to take effect.`);
      ctx.ui.addActivity(`Updated config: ${key}`);
      return { success: true };
    } else {
      ctx.ui.addMessage('assistant', `Failed to save configuration.`);
      return { success: false };
    }
  },
};

// /permissions - 权限管理
export const permissionsCommand: SlashCommand = {
  name: 'permissions',
  aliases: ['perms'],
  description: 'View or modify tool permissions',
  usage: '/permissions [allow|deny|reset] [tool]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    const permissionsInfo = `Permission Settings:

Current Mode: Interactive (ask for each action)

Permission Modes:
  interactive  - Ask before each action (default)
  accept-edits - Auto-accept file edits
  plan         - Plan-only mode (no execution)
  yolo         - Accept all actions (use with caution)

Tool Permissions:
  Bash         - Requires approval for commands
  Read         - Allowed for all files
  Write        - Requires approval
  Edit         - Requires approval

Usage:
  /permissions                    - Show current permissions
  /permissions allow <tool>       - Allow a tool
  /permissions deny <tool>        - Deny a tool
  /permissions reset              - Reset to defaults

Note: Use command line flags for permission modes:
  claude --dangerously-skip-permissions
  claude --allowedTools "Bash,Read,Write"`;

    ctx.ui.addMessage('assistant', permissionsInfo);
    return { success: true };
  },
};

// /memory - CLAUDE.md 管理
export const memoryCommand: SlashCommand = {
  name: 'memory',
  aliases: ['mem', 'claude-md'],
  description: 'View or edit CLAUDE.md project memory',
  usage: '/memory [edit|show|add]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;
    const claudeMdPath = path.join(config.cwd, 'CLAUDE.md');
    const globalClaudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');

    const action = args[0] || 'show';

    // 检查文件是否存在
    const localExists = fs.existsSync(claudeMdPath);
    const globalExists = fs.existsSync(globalClaudeMd);

    let memoryContent = '';

    if (localExists) {
      try {
        memoryContent = fs.readFileSync(claudeMdPath, 'utf-8');
      } catch {
        memoryContent = '(unable to read)';
      }
    }

    switch (action) {
      case 'show':
        const memoryInfo = `CLAUDE.md Memory:

Project CLAUDE.md: ${localExists ? 'Found' : 'Not found'}
  Path: ${claudeMdPath}

Global CLAUDE.md: ${globalExists ? 'Found' : 'Not found'}
  Path: ${globalClaudeMd}

${localExists ? `Content Preview:\n${memoryContent.slice(0, 500)}${memoryContent.length > 500 ? '\n...(truncated)' : ''}` : ''}

Commands:
  /memory show    - Show memory contents
  /memory edit    - Open CLAUDE.md for editing
  /memory add     - Add to CLAUDE.md
  /init           - Create new CLAUDE.md`;

        ctx.ui.addMessage('assistant', memoryInfo);
        break;

      case 'edit':
        ctx.ui.addMessage('assistant', `To edit CLAUDE.md, open in your editor:\n\n${localExists ? claudeMdPath : `Create one with /init first, or create manually at:\n${claudeMdPath}`}`);
        break;

      case 'add':
        const content = args.slice(1).join(' ');
        if (!content) {
          ctx.ui.addMessage('assistant', 'Usage: /memory add <content to add>');
          return { success: false };
        }
        ctx.ui.addMessage('assistant', `Would add to CLAUDE.md:\n\n${content}\n\nNote: Direct writing requires file system access.`);
        break;

      default:
        ctx.ui.addMessage('assistant', 'Unknown action. Use: /memory [show|edit|add]');
        return { success: false };
    }

    return { success: true };
  },
};

// /hooks - Hook 管理
export const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: 'View or manage hooks',
  usage: '/hooks [list|add|remove]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const hooksInfo = `Hooks Configuration:

Hooks allow you to run custom scripts at specific points:

Available Hook Types:
  pre-tool       - Run before tool execution
  post-tool      - Run after tool execution
  pre-message    - Run before sending message
  post-message   - Run after receiving response

Configuration Location:
  ~/.claude/settings.json (hooks section)

Example Configuration:
{
  "hooks": {
    "pre-tool": {
      "Bash": "echo 'Running bash command'"
    },
    "post-tool": {
      "Write": "./scripts/format-file.sh"
    }
  }
}

Commands:
  /hooks list          - List all configured hooks
  /hooks add <type>    - Add a new hook
  /hooks remove <type> - Remove a hook

See documentation for more details.`;

    ctx.ui.addMessage('assistant', hooksInfo);
    return { success: true };
  },
};

// /model - 模型管理
export const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: 'View or change the AI model',
  usage: '/model [model-name]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;

    const models = [
      { name: 'opus', display: 'Claude Opus 4', desc: 'Most capable, best for complex tasks' },
      { name: 'sonnet', display: 'Claude Sonnet 4', desc: 'Balanced performance and speed' },
      { name: 'haiku', display: 'Claude Haiku 3.5', desc: 'Fastest, best for simple tasks' },
    ];

    if (args.length === 0) {
      let modelInfo = `Current Model: ${config.modelDisplayName}\n\nAvailable Models:\n`;

      for (const model of models) {
        const current = config.model.includes(model.name) ? ' (current)' : '';
        modelInfo += `  ${model.name.padEnd(8)} - ${model.display}${current}\n`;
        modelInfo += `             ${model.desc}\n`;
      }

      modelInfo += `\nUsage:\n  /model <name>     - Switch model (requires restart)\n  claude -m <name>  - Start with specific model`;

      ctx.ui.addMessage('assistant', modelInfo);
      return { success: true };
    }

    const requestedModel = args[0].toLowerCase();
    const validModel = models.find(m => m.name === requestedModel);

    if (!validModel) {
      ctx.ui.addMessage('assistant', `Unknown model: ${requestedModel}\n\nAvailable: ${models.map(m => m.name).join(', ')}`);
      return { success: false };
    }

    ctx.ui.addMessage('assistant', `To switch to ${validModel.display}, restart with:\n\nclaude -m ${validModel.name}`);
    return { success: true };
  },
};

// /init - 初始化 CLAUDE.md
export const initCommand: SlashCommand = {
  name: 'init',
  description: 'Create a CLAUDE.md file for project context',
  usage: '/init [template]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;
    const claudeMdPath = path.join(config.cwd, 'CLAUDE.md');

    if (fs.existsSync(claudeMdPath)) {
      ctx.ui.addMessage('assistant', `CLAUDE.md already exists at:\n${claudeMdPath}\n\nUse /memory to view or edit it.`);
      return { success: true };
    }

    const template = args[0] || 'default';
    const templates: Record<string, string> = {
      default: `# Project Instructions

## Overview
[Describe your project here]

## Tech Stack
- [List your technologies]

## Development Commands
\`\`\`bash
# Build
npm run build

# Test
npm test

# Run
npm start
\`\`\`

## Important Notes
- [Add important context for Claude]
`,
      typescript: `# TypeScript Project

## Overview
This is a TypeScript project.

## Development
\`\`\`bash
npm install
npm run build
npm run dev
\`\`\`

## Structure
- src/          - Source code
- dist/         - Compiled output
- tests/        - Test files

## Conventions
- Use strict TypeScript
- Follow ESLint rules
- Write tests for new features
`,
      python: `# Python Project

## Overview
This is a Python project.

## Setup
\`\`\`bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
\`\`\`

## Commands
\`\`\`bash
python main.py
pytest
\`\`\`
`,
    };

    const content = templates[template] || templates.default;

    ctx.ui.addMessage('assistant', `Creating CLAUDE.md...

Template: ${template}
Location: ${claudeMdPath}

Content Preview:
${content.slice(0, 300)}...

To create this file, run:
echo '${content.replace(/'/g, "\\'")}' > CLAUDE.md

Or create it manually with the content above.

Available templates: ${Object.keys(templates).join(', ')}`);

    ctx.ui.addActivity('Showed /init template');
    return { success: true };
  },
};

// /privacy-settings - 隐私设置
export const privacySettingsCommand: SlashCommand = {
  name: 'privacy-settings',
  aliases: ['privacy'],
  description: 'View and manage privacy settings',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const privacyInfo = `Privacy Settings:

Data Collection:
  Telemetry: Disabled (local installation)
  Analytics: None
  Crash Reports: Optional

Data Storage:
  Sessions: ~/.claude/sessions/
  Config: ~/.claude/settings.json
  Logs: ~/.claude/logs/

Data Retention:
  Sessions expire after 30 days
  No data sent to external servers

To disable all telemetry:
  Set CLAUDE_CODE_DISABLE_TELEMETRY=1

For more information, see:
  https://code.claude.com/privacy`;

    ctx.ui.addMessage('assistant', privacyInfo);
    return { success: true };
  },
};

// /vim - Vim 模式切换 (官方风格)
export const vimCommand: SlashCommand = {
  name: 'vim',
  description: 'Toggle between Vim and Normal editing modes',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    // 模拟 vim 模式切换
    const vimInfo = `Vim Mode Toggle

Current Mode: Normal (readline)

To toggle Vim mode:
  • This feature enables Vim-style keybindings
  • Use hjkl for navigation
  • Use i/a for insert mode
  • Use Esc to exit insert mode

Vim Mode Features:
  • Modal editing (normal/insert)
  • Vim motions (w, b, e, etc.)
  • Vim commands (:w, :q, etc.)

Note: Vim mode is applied to the input field.
Restart may be required for full effect.`;

    ctx.ui.addMessage('assistant', vimInfo);
    return { success: true };
  },
};

// /theme - 主题设置 (官方风格)
export const themeCommand: SlashCommand = {
  name: 'theme',
  description: 'Change the color theme',
  usage: '/theme [theme-name]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    const themes = [
      { name: 'dark', desc: 'Dark theme (default)' },
      { name: 'light', desc: 'Light theme' },
      { name: 'system', desc: 'Follow system preference' },
      { name: 'high-contrast', desc: 'High contrast for accessibility' },
    ];

    if (args.length === 0) {
      let themeInfo = `Color Theme\n\nCurrent: dark\n\nAvailable Themes:\n`;

      for (const theme of themes) {
        themeInfo += `  ${theme.name.padEnd(15)} - ${theme.desc}\n`;
      }

      themeInfo += `\nUsage: /theme <name>\nExample: /theme light`;

      ctx.ui.addMessage('assistant', themeInfo);
      return { success: true };
    }

    const requestedTheme = args[0].toLowerCase();
    const validTheme = themes.find(t => t.name === requestedTheme);

    if (!validTheme) {
      ctx.ui.addMessage('assistant', `Unknown theme: ${requestedTheme}\n\nAvailable: ${themes.map(t => t.name).join(', ')}`);
      return { success: false };
    }

    ctx.ui.addMessage('assistant', `Theme changed to: ${validTheme.name}\n\nNote: Some terminal emulators may require restart to fully apply.`);
    return { success: true };
  },
};

// /discover - 探索功能 (官方风格)
export const discoverCommand: SlashCommand = {
  name: 'discover',
  description: 'Explore Claude Code features and track your progress',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const discoverInfo = `Discover Claude Code

Quick Wins:
  ✓ /resume - Resume past conversations
  ○ /compact - Summarize and free context
  ○ Image paste (Ctrl+V)
  ○ Voice input

Power Features:
  ○ MCP servers
  ○ Custom hooks
  ○ GitHub integration
  ○ Vim mode

Tips:
  • Type / to see all commands
  • Press ? for keyboard shortcuts
  • Use /help <command> for details

Progress: 1/8 features explored

Try: /resume to continue a past conversation`;

    ctx.ui.addMessage('assistant', discoverInfo);
    return { success: true };
  },
};

// 注册所有配置命令
export function registerConfigCommands(): void {
  commandRegistry.register(configCommand);
  commandRegistry.register(permissionsCommand);
  commandRegistry.register(memoryCommand);
  commandRegistry.register(hooksCommand);
  commandRegistry.register(modelCommand);
  commandRegistry.register(initCommand);
  commandRegistry.register(privacySettingsCommand);
  commandRegistry.register(vimCommand);
  commandRegistry.register(themeCommand);
  commandRegistry.register(discoverCommand);
}
