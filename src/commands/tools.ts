/**
 * 工具命令 - mcp, agents, ide, vim, plugin, install
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// /mcp - MCP 服务器管理
export const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: 'Manage MCP (Model Context Protocol) servers',
  usage: '/mcp [list|add|remove|status]',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const action = args[0] || 'list';

    const configFile = path.join(os.homedir(), '.claude', 'settings.json');
    let config: any = {};

    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      } catch {
        // ignore
      }
    }

    const mcpServers = config.mcpServers || {};

    switch (action) {
      case 'list':
        let listInfo = `MCP Servers:\n\n`;

        if (Object.keys(mcpServers).length === 0) {
          listInfo += `No MCP servers configured.\n`;
        } else {
          for (const [name, server] of Object.entries(mcpServers)) {
            const s = server as any;
            listInfo += `  ${name}\n`;
            listInfo += `    Command: ${s.command} ${(s.args || []).join(' ')}\n`;
            if (s.env) {
              listInfo += `    Env: ${Object.keys(s.env).join(', ')}\n`;
            }
            listInfo += `\n`;
          }
        }

        listInfo += `Commands:
  /mcp list          - List configured servers
  /mcp add <name>    - Add a new server
  /mcp remove <name> - Remove a server
  /mcp status        - Check server status

Configuration: ${configFile}

For more info: https://modelcontextprotocol.io`;

        ctx.ui.addMessage('assistant', listInfo);
        break;

      case 'add':
        const serverName = args[1];
        if (!serverName) {
          ctx.ui.addMessage('assistant', `Usage: /mcp add <server-name>

Example MCP server configuration in settings.json:

{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/dir"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "your-token"
      }
    }
  }
}`);
          return { success: false };
        }
        ctx.ui.addMessage('assistant', `To add MCP server "${serverName}", edit:\n${configFile}\n\nAdd the server configuration to the "mcpServers" section.`);
        break;

      case 'remove':
        const removeName = args[1];
        if (!removeName) {
          ctx.ui.addMessage('assistant', 'Usage: /mcp remove <server-name>');
          return { success: false };
        }
        ctx.ui.addMessage('assistant', `To remove MCP server "${removeName}", edit:\n${configFile}\n\nRemove the server from the "mcpServers" section.`);
        break;

      case 'status':
        ctx.ui.addMessage('assistant', `MCP Server Status:

${Object.keys(mcpServers).length === 0 ? 'No servers configured' : Object.keys(mcpServers).map(name => `  ${name}: Configured`).join('\n')}

Note: Server health checks require runtime connection.
Restart Claude Code to connect to configured servers.`);
        break;

      default:
        ctx.ui.addMessage('assistant', 'Unknown action. Use: /mcp [list|add|remove|status]');
        return { success: false };
    }

    return { success: true };
  },
};

// /agents - Agent 管理
export const agentsCommand: SlashCommand = {
  name: 'agents',
  description: 'View and manage custom agents',
  usage: '/agents [list|info]',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    const builtInAgents = [
      { name: 'general-purpose', desc: 'General-purpose agent for complex tasks' },
      { name: 'Explore', desc: 'Fast agent for exploring codebases' },
      { name: 'Plan', desc: 'Software architect agent for planning' },
      { name: 'claude-code-guide', desc: 'Agent for Claude Code documentation' },
    ];

    const agentsInfo = `Agents:

Built-in Agents:
${builtInAgents.map(a => `  ${a.name.padEnd(20)} - ${a.desc}`).join('\n')}

Custom Agents:
  Configure in ~/.claude/settings.json under "agents"

Agent Configuration Example:
{
  "agents": {
    "my-agent": {
      "description": "Custom agent description",
      "whenToUse": "When to trigger this agent",
      "tools": ["Read", "Write", "Bash"]
    }
  }
}

Usage:
  /agents list       - List all agents
  /agents info <n>   - Show agent details

Agents can be invoked via the Task tool during conversations.`;

    ctx.ui.addMessage('assistant', agentsInfo);
    return { success: true };
  },
};

// /ide - IDE 集成
export const ideCommand: SlashCommand = {
  name: 'ide',
  description: 'IDE integration settings',
  usage: '/ide [vscode|jetbrains|status]',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const ide = args[0] || 'status';

    const ideInfo: Record<string, string> = {
      status: `IDE Integration Status:

Supported IDEs:
  - VS Code (via extension)
  - JetBrains IDEs (via plugin)
  - Vim/Neovim (via /vim command)
  - Terminal (native)

To enable IDE integration:

VS Code:
  1. Install "Claude Code" extension from marketplace
  2. Open command palette: Ctrl+Shift+P
  3. Run "Claude: Start"

JetBrains:
  1. Install "Claude Code" plugin from marketplace
  2. Open: Tools > Claude Code
  3. Or use the sidebar panel

Use /ide <name> for specific IDE setup instructions.`,

      vscode: `VS Code Integration:

Installation:
  1. Open VS Code
  2. Go to Extensions (Ctrl+Shift+X)
  3. Search "Claude Code"
  4. Click Install

Features:
  - Inline code suggestions
  - Chat sidebar
  - Code actions
  - Terminal integration

Configuration:
  Settings > Extensions > Claude Code

Documentation:
  https://code.claude.com/docs/vscode`,

      jetbrains: `JetBrains Integration:

Supported IDEs:
  - IntelliJ IDEA
  - PyCharm
  - WebStorm
  - All JetBrains IDEs

Installation:
  1. Open Settings > Plugins
  2. Search "Claude Code"
  3. Install and restart

Features:
  - Tool window panel
  - Code actions
  - Context menu integration

Documentation:
  https://code.claude.com/docs/jetbrains`,
    };

    ctx.ui.addMessage('assistant', ideInfo[ide] || ideInfo['status']);
    return { success: true };
  },
};

// /chrome - Chrome 集成 (官方风格)
export const chromeCommand: SlashCommand = {
  name: 'chrome',
  description: 'Claude in Chrome (Beta) settings',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const chromeInfo = `Claude in Chrome (Beta)

Status: Not connected

Claude in Chrome allows you to:
  • Use Claude directly in your browser
  • Interact with web pages
  • Automate browser tasks
  • Take screenshots and analyze content

Setup:
  1. Install the Claude Chrome extension
  2. Sign in with your Claude account
  3. Enable browser automation in settings

Features:
  • Page interaction
  • Form filling
  • Screenshot capture
  • DOM analysis
  • Tab management

Browser Automation Commands:
  navigate       - Go to a URL
  click          - Click elements
  type           - Enter text
  screenshot     - Capture page

Note: This feature is in Beta.
Some functionality may be limited.

Documentation: https://claude.ai/chrome`;

    ctx.ui.addMessage('assistant', chromeInfo);
    return { success: true };
  },
};

// /plugin - 插件管理
export const pluginCommand: SlashCommand = {
  name: 'plugin',
  aliases: ['plugins'],
  description: 'Manage Claude Code plugins',
  usage: '/plugin [list|install|remove]',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const action = args[0] || 'list';

    const pluginDir = path.join(os.homedir(), '.claude', 'plugins');
    const projectPluginDir = path.join(ctx.config.cwd, '.claude', 'plugins');

    const pluginInfo = `Plugin Management:

Plugin Directories:
  Global: ${pluginDir}
  Project: ${projectPluginDir}

Commands:
  /plugin list            - List installed plugins
  /plugin install <name>  - Install a plugin
  /plugin remove <name>   - Remove a plugin
  /plugin info <name>     - Plugin details

Plugin Structure:
  plugin-name/
    manifest.json    - Plugin metadata
    commands/        - Custom slash commands
    skills/          - Custom skills
    hooks/           - Hook scripts

Creating Plugins:
  1. Create plugin directory
  2. Add manifest.json with metadata
  3. Add commands or skills as .md files
  4. Restart Claude Code

Example manifest.json:
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin"
}

Documentation: https://code.claude.com/docs/plugins`;

    ctx.ui.addMessage('assistant', pluginInfo);
    return { success: true };
  },
};

// /install - 安装工具
export const installCommand: SlashCommand = {
  name: 'install',
  description: 'Install Claude Code extensions or tools',
  usage: '/install <tool>',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const tool = args[0];

    if (!tool) {
      const installInfo = `Install Extensions:

Available:
  vscode           - VS Code extension
  jetbrains        - JetBrains plugin
  github-app       - GitHub App integration
  mcp-filesystem   - MCP filesystem server
  mcp-github       - MCP GitHub server

Usage:
  /install <tool>
  /install-github-app  - Special GitHub App setup

Example:
  /install vscode
  /install mcp-filesystem`;

      ctx.ui.addMessage('assistant', installInfo);
      return { success: true };
    }

    const installInstructions: Record<string, string> = {
      vscode: `VS Code Extension:

Install via:
  1. VS Code Marketplace
  2. Or: code --install-extension anthropic.claude-code

After installation, restart VS Code.`,

      jetbrains: `JetBrains Plugin:

Install via:
  1. IDE Settings > Plugins > Marketplace
  2. Search "Claude Code"
  3. Install and restart IDE`,

      'mcp-filesystem': `MCP Filesystem Server:

Install:
  npm install -g @anthropic/mcp-server-filesystem

Configure in ~/.claude/settings.json:
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/dir"]
    }
  }
}`,

      'mcp-github': `MCP GitHub Server:

Install:
  npm install -g @anthropic/mcp-server-github

Configure in ~/.claude/settings.json:
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}`,
    };

    ctx.ui.addMessage('assistant', installInstructions[tool] || `Unknown tool: ${tool}\n\nUse /install to see available tools.`);
    return { success: true };
  },
};

// /install-github-app - 安装 GitHub App
export const installGithubAppCommand: SlashCommand = {
  name: 'install-github-app',
  description: 'Install Claude Code GitHub App',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const githubAppInfo = `Claude Code GitHub App:

The GitHub App provides:
  - PR review comments
  - Issue integration
  - Repository access
  - Automated workflows

Installation:
  1. Visit: https://github.com/apps/claude-code
  2. Click "Install"
  3. Select repositories
  4. Authorize access

Configuration:
  After installation, Claude Code can:
  - Read repository contents
  - Comment on PRs and issues
  - Access private repos (if permitted)

Use /pr-comments to interact with PR comments.`;

    ctx.ui.addMessage('assistant', githubAppInfo);
    return { success: true };
  },
};

// /install-slack-app - 安装 Slack App (官方风格)
export const installSlackAppCommand: SlashCommand = {
  name: 'install-slack-app',
  description: 'Install the Claude Slack app',
  category: 'tools',
  execute: (ctx: CommandContext): CommandResult => {
    const slackAppInfo = `Claude Slack App

Get notified in Slack when Claude Code needs attention.

Features:
  • Receive notifications for long-running tasks
  • Get alerts when Claude needs input
  • Share session summaries
  • Team collaboration

Installation:
  1. Visit: https://slack.com/apps/claude-code
  2. Click "Add to Slack"
  3. Select your workspace
  4. Authorize the app
  5. Link with Claude Code: /config slack-webhook <url>

Configuration:
  After installation, configure in settings:
  {
    "slack": {
      "webhook": "https://hooks.slack.com/...",
      "notifications": {
        "taskComplete": true,
        "needsInput": true,
        "errors": true
      }
    }
  }

Usage:
  Once configured, you'll receive Slack messages when:
  • Long-running commands complete
  • Claude needs your approval
  • Errors occur during execution`;

    ctx.ui.addMessage('assistant', slackAppInfo);
    return { success: true };
  },
};

// 注册所有工具命令
export function registerToolsCommands(): void {
  commandRegistry.register(mcpCommand);
  commandRegistry.register(agentsCommand);
  commandRegistry.register(ideCommand);
  commandRegistry.register(chromeCommand);
  commandRegistry.register(pluginCommand);
  commandRegistry.register(installCommand);
  commandRegistry.register(installGithubAppCommand);
  commandRegistry.register(installSlackAppCommand);
}
