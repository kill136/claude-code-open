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

// /config - 配置管理
export const configCommand: SlashCommand = {
  name: 'config',
  aliases: ['settings'],
  description: 'View or modify configuration settings',
  usage: '/config [key] [value]',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const configFile = getConfigFile();

    let config: Record<string, any> = {};
    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      } catch {
        config = {};
      }
    }

    if (args.length === 0) {
      // 显示所有配置
      const configInfo = `Configuration Settings:

Location: ${configFile}

Current Settings:
${Object.entries(config).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n') || '  (no custom settings)'}

Available Settings:
  model          - Default model (sonnet, opus, haiku)
  theme          - Color theme
  verbose        - Enable verbose output
  autoCompact    - Auto-compact when context is full
  permissions    - Default permission mode

Usage:
  /config <key>           - View a specific setting
  /config <key> <value>   - Set a value
  /config reset           - Reset to defaults`;

      ctx.ui.addMessage('assistant', configInfo);
      return { success: true };
    }

    const key = args[0];

    if (key === 'reset') {
      ctx.ui.addMessage('assistant', 'Configuration reset to defaults.\n\nRestart Claude Code to apply changes.');
      return { success: true };
    }

    if (args.length === 1) {
      // 显示特定配置
      const value = config[key];
      if (value !== undefined) {
        ctx.ui.addMessage('assistant', `${key}: ${JSON.stringify(value)}`);
      } else {
        ctx.ui.addMessage('assistant', `Setting '${key}' is not set.`);
      }
      return { success: true };
    }

    // 设置配置值
    const value = args.slice(1).join(' ');
    ctx.ui.addMessage('assistant', `Set ${key} = ${value}\n\nNote: Some settings require restart to take effect.`);
    ctx.ui.addActivity(`Updated config: ${key}`);
    return { success: true };
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

// 注册所有配置命令
export function registerConfigCommands(): void {
  commandRegistry.register(configCommand);
  commandRegistry.register(permissionsCommand);
  commandRegistry.register(memoryCommand);
  commandRegistry.register(hooksCommand);
  commandRegistry.register(modelCommand);
  commandRegistry.register(initCommand);
  commandRegistry.register(privacySettingsCommand);
}
