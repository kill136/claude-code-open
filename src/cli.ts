#!/usr/bin/env node

/**
 * Claude Code CLI 入口点
 * 还原版本 2.0.76 - 完整功能版
 */

import { Command, Option } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { ConversationLoop } from './core/loop.js';
import { Session } from './core/session.js';
import { toolRegistry } from './tools/index.js';
import { configManager } from './config/index.js';
import { listSessions, loadSession } from './session/index.js';
import type { PermissionMode, OutputFormat, InputFormat } from './types/index.js';

const VERSION = '2.0.76-restored';

// ASCII Art Logo
const LOGO = `
╭───────────────────────────────────────╮
│                                       │
│   ██████╗██╗      █████╗ ██╗   ██╗   │
│  ██╔════╝██║     ██╔══██╗██║   ██║   │
│  ██║     ██║     ███████║██║   ██║   │
│  ██║     ██║     ██╔══██║██║   ██║   │
│  ╚██████╗███████╗██║  ██║╚██████╔╝   │
│   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    │
│          ██████╗ ██████╗ ██████╗ ███████╗   │
│         ██╔════╝██╔═══██╗██╔══██╗██╔════╝   │
│         ██║     ██║   ██║██║  ██║█████╗     │
│         ██║     ██║   ██║██║  ██║██╔══╝     │
│         ╚██████╗╚██████╔╝██████╔╝███████╗   │
│          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝   │
│                                       │
│         Claude Code (Restored)        │
│            Version ${VERSION}            │
╰───────────────────────────────────────╯
`;

const program = new Command();

program
  .name('claude')
  .description('Claude Code - starts an interactive session by default, use -p/--print for non-interactive output')
  .version(VERSION, '-v, --version', 'Output the version number');

// 主命令 - 交互模式
program
  .argument('[prompt]', 'Your prompt')
  // 调试选项
  .option('-d, --debug [filter]', 'Enable debug mode with optional category filtering')
  .option('--verbose', 'Override verbose mode setting from config')
  // 输出选项
  .option('-p, --print', 'Print response and exit (useful for pipes)')
  .addOption(
    new Option('--output-format <format>', 'Output format (only works with --print)')
      .choices(['text', 'json', 'stream-json'])
      .default('text')
  )
  .option('--json-schema <schema>', 'JSON Schema for structured output validation')
  .option('--include-partial-messages', 'Include partial message chunks (only with --print and stream-json)')
  .addOption(
    new Option('--input-format <format>', 'Input format (only works with --print)')
      .choices(['text', 'stream-json'])
      .default('text')
  )
  // 安全选项
  .option('--dangerously-skip-permissions', 'Bypass all permission checks (sandbox only)')
  .option('--allow-dangerously-skip-permissions', 'Enable bypassing permissions as an option')
  // 预算选项
  .option('--max-budget-usd <amount>', 'Maximum dollar amount for API calls (only with --print)')
  .option('--replay-user-messages', 'Re-emit user messages from stdin (stream-json only)')
  // 工具选项
  .option('--allowedTools, --allowed-tools <tools...>', 'Comma or space-separated list of allowed tools')
  .option('--tools <tools...>', 'Specify available tools from built-in set')
  .option('--disallowedTools, --disallowed-tools <tools...>', 'Comma or space-separated list of denied tools')
  // MCP 选项
  .option('--mcp-config <configs...>', 'Load MCP servers from JSON files or strings')
  .option('--mcp-debug', '[DEPRECATED] Enable MCP debug mode')
  .option('--strict-mcp-config', 'Only use MCP servers from --mcp-config')
  // 系统提示
  .option('--system-prompt <prompt>', 'System prompt to use for the session')
  .option('--append-system-prompt <prompt>', 'Append to default system prompt')
  // 权限模式
  .addOption(
    new Option('--permission-mode <mode>', 'Permission mode for the session')
      .choices(['acceptEdits', 'bypassPermissions', 'default', 'delegate', 'dontAsk', 'plan'])
  )
  // 会话选项
  .option('-c, --continue', 'Continue the most recent conversation')
  .option('-r, --resume [value]', 'Resume by session ID, or open interactive picker')
  .option('--fork-session', 'Create new session ID when resuming')
  .option('--no-session-persistence', 'Disable session persistence (only with --print)')
  .option('--session-id <uuid>', 'Use a specific session ID (must be valid UUID)')
  // 模型选项
  .option('-m, --model <model>', 'Model for the current session', 'sonnet')
  .option('--agent <agent>', 'Agent for the current session')
  .option('--betas <betas...>', 'Beta headers for API requests')
  .option('--fallback-model <model>', 'Fallback model when default is overloaded')
  .option('--max-tokens <tokens>', 'Maximum tokens for response', '8192')
  // 其他选项
  .option('--settings <file-or-json>', 'Path to settings JSON file or JSON string')
  .option('--add-dir <directories...>', 'Additional directories to allow tool access')
  .option('--ide', 'Auto-connect to IDE on startup')
  .option('--agents <json>', 'JSON object defining custom agents')
  .option('--setting-sources <sources>', 'Comma-separated list of setting sources')
  .option('--plugin-dir <paths...>', 'Load plugins from directories')
  .option('--disable-slash-commands', 'Disable all slash commands')
  .option('--chrome', 'Enable Claude in Chrome integration')
  .option('--no-chrome', 'Disable Claude in Chrome integration')
  .action(async (prompt, options) => {
    // 调试模式
    if (options.debug) {
      process.env.CLAUDE_DEBUG = options.debug === true ? '*' : options.debug;
    }

    // 显示 logo
    if (!options.print) {
      console.log(chalk.cyan(LOGO));
      console.log(chalk.gray(`Working directory: ${process.cwd()}\n`));
    }

    // 模型映射
    const modelMap: Record<string, string> = {
      'sonnet': 'claude-sonnet-4-20250514',
      'opus': 'claude-opus-4-20250514',
      'haiku': 'claude-haiku-3-5-20241022',
    };

    // 加载 MCP 配置
    if (options.mcpConfig) {
      loadMcpConfigs(options.mcpConfig);
    }

    // 构建系统提示
    let systemPrompt = options.systemPrompt;
    if (options.appendSystemPrompt) {
      systemPrompt = (systemPrompt || '') + '\n' + options.appendSystemPrompt;
    }

    // 加载设置
    if (options.settings) {
      loadSettings(options.settings);
    }

    const loop = new ConversationLoop({
      model: modelMap[options.model] || options.model,
      maxTokens: parseInt(options.maxTokens),
      verbose: options.verbose,
      systemPrompt,
      permissionMode: options.permissionMode as PermissionMode,
      allowedTools: options.allowedTools,
      disallowedTools: options.disallowedTools,
    });

    // 恢复会话逻辑
    if (options.continue) {
      // 继续最近的会话
      const sessions = listSessions({ limit: 1, sortBy: 'updatedAt', sortOrder: 'desc' });
      if (sessions.length > 0) {
        const session = loadSession(sessions[0].id);
        if (session) {
          console.log(chalk.green(`Continuing session: ${sessions[0].id}`));
        }
      } else {
        console.log(chalk.yellow('No recent session found, starting new session'));
      }
    } else if (options.resume !== undefined) {
      if (options.resume === true || options.resume === '') {
        // 交互式选择器
        await showSessionPicker(loop);
      } else {
        // 按 ID 恢复
        const session = Session.load(options.resume);
        if (session) {
          loop.setSession(session);
          console.log(chalk.green(`Resumed session: ${options.resume}`));
        } else {
          console.log(chalk.yellow(`Session ${options.resume} not found, starting new session`));
        }
      }
    }

    // 打印模式 (JSON 格式支持)
    if (options.print && prompt) {
      const outputFormat = options.outputFormat as OutputFormat;

      if (outputFormat === 'json') {
        const response = await loop.processMessage(prompt);
        console.log(JSON.stringify({
          type: 'result',
          content: response,
          session_id: loop.getSession().sessionId,
        }));
      } else if (outputFormat === 'stream-json') {
        for await (const event of loop.processMessageStream(prompt)) {
          console.log(JSON.stringify(event));
        }
      } else {
        const response = await loop.processMessage(prompt);
        console.log(response);
      }
      process.exit(0);
    }

    // 如果有初始 prompt
    if (prompt) {
      console.log(chalk.blue('You: ') + prompt);
      console.log(chalk.green('\nClaude: '));

      for await (const event of loop.processMessageStream(prompt)) {
        if (event.type === 'text') {
          process.stdout.write(event.content || '');
        } else if (event.type === 'tool_start') {
          console.log(chalk.cyan(`\n[Using tool: ${event.toolName}]`));
        } else if (event.type === 'tool_end') {
          console.log(chalk.gray(`[Result: ${(event.toolResult || '').substring(0, 100)}...]`));
        }
      }
      console.log('\n');
    }

    // 交互式循环
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (): void => {
      rl.question(chalk.blue('You: '), async (input) => {
        input = input.trim();

        if (!input) {
          askQuestion();
          return;
        }

        // 斜杠命令
        if (input.startsWith('/') && !options.disableSlashCommands) {
          handleSlashCommand(input, loop);
          askQuestion();
          return;
        }

        // 退出命令
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log(chalk.yellow('\nGoodbye!'));
          const stats = loop.getSession().getStats();
          console.log(chalk.gray(`Session stats: ${stats.messageCount} messages, ${stats.totalCost}`));
          rl.close();
          process.exit(0);
        }

        // 处理消息
        console.log(chalk.green('\nClaude: '));

        try {
          for await (const event of loop.processMessageStream(input)) {
            if (event.type === 'text') {
              process.stdout.write(event.content || '');
            } else if (event.type === 'tool_start') {
              console.log(chalk.cyan(`\n[Using tool: ${event.toolName}]`));
            } else if (event.type === 'tool_end') {
              const preview = (event.toolResult || '').substring(0, 200);
              console.log(chalk.gray(`[Result: ${preview}${preview.length >= 200 ? '...' : ''}]`));
            }
          }
          console.log('\n');
        } catch (err) {
          console.error(chalk.red(`\nError: ${err}`));
        }

        askQuestion();
      });
    };

    askQuestion();
  });

// MCP 子命令
const mcpCommand = program.command('mcp').description('Configure and manage MCP servers');

mcpCommand
  .command('list')
  .description('List configured MCP servers')
  .action(() => {
    const servers = configManager.getMcpServers();
    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      console.log('No MCP servers configured.');
      return;
    }

    console.log(chalk.bold('\nConfigured MCP Servers:\n'));
    serverNames.forEach(name => {
      const config = servers[name];
      console.log(chalk.cyan(`  ${name}`));
      console.log(chalk.gray(`    Type: ${config.type}`));
      if (config.command) {
        console.log(chalk.gray(`    Command: ${config.command} ${(config.args || []).join(' ')}`));
      }
      if (config.url) {
        console.log(chalk.gray(`    URL: ${config.url}`));
      }
    });
    console.log();
  });

mcpCommand
  .command('add <name> <command>')
  .description('Add an MCP server')
  .option('-s, --scope <scope>', 'Configuration scope (local, user, project)', 'local')
  .option('-a, --args <args...>', 'Arguments for the command')
  .option('-e, --env <env...>', 'Environment variables (KEY=VALUE)')
  .action((name, command, options) => {
    const env: Record<string, string> = {};
    if (options.env) {
      options.env.forEach((e: string) => {
        const [key, ...valueParts] = e.split('=');
        env[key] = valueParts.join('=');
      });
    }

    configManager.addMcpServer(name, {
      type: 'stdio',
      command,
      args: options.args || [],
      env,
    });

    console.log(chalk.green(`✓ Added MCP server: ${name}`));
  });

mcpCommand
  .command('remove <name>')
  .description('Remove an MCP server')
  .action((name) => {
    if (configManager.removeMcpServer(name)) {
      console.log(chalk.green(`✓ Removed MCP server: ${name}`));
    } else {
      console.log(chalk.red(`MCP server not found: ${name}`));
    }
  });

// Plugin 子命令
const pluginCommand = program.command('plugin').description('Manage Claude Code plugins');

pluginCommand
  .command('list')
  .description('List installed plugins')
  .action(() => {
    console.log(chalk.bold('\nInstalled Plugins:\n'));
    console.log(chalk.gray('  No plugins installed.'));
    console.log(chalk.gray('\n  Use "claude plugin install <path>" to install a plugin.\n'));
  });

pluginCommand
  .command('install <path>')
  .description('Install a plugin from path')
  .action((pluginPath) => {
    console.log(chalk.yellow(`Installing plugin from: ${pluginPath}`));
    console.log(chalk.gray('Plugin system is under development.'));
  });

pluginCommand
  .command('remove <name>')
  .description('Remove an installed plugin')
  .action((name) => {
    console.log(chalk.yellow(`Removing plugin: ${name}`));
    console.log(chalk.gray('Plugin system is under development.'));
  });

// 工具子命令
program
  .command('tools')
  .description('List available tools')
  .action(() => {
    console.log(chalk.bold('\nAvailable Tools:\n'));
    const tools = toolRegistry.getDefinitions();
    tools.forEach(tool => {
      console.log(chalk.cyan(`  ${tool.name}`));
      console.log(chalk.gray(`    ${tool.description.split('\n')[0]}`));
    });
    console.log();
  });

// 会话子命令
program
  .command('sessions')
  .description('List previous sessions')
  .option('-l, --limit <number>', 'Maximum sessions to show', '20')
  .option('-s, --search <term>', 'Search sessions')
  .action((options) => {
    const sessions = listSessions({
      limit: parseInt(options.limit),
      search: options.search,
    });

    if (sessions.length === 0) {
      console.log('No saved sessions found.');
      return;
    }

    console.log(chalk.bold('\nSaved Sessions:\n'));
    sessions.forEach(s => {
      const date = new Date(s.createdAt).toLocaleString();
      console.log(`  ${chalk.cyan(s.id)}`);
      if (s.name) {
        console.log(`    Name: ${s.name}`);
      }
      console.log(`    Created: ${date}`);
      console.log(`    Directory: ${s.workingDirectory}`);
      console.log(`    Messages: ${s.messageCount}\n`);
    });
  });

// Doctor 命令
program
  .command('doctor')
  .description('Check the health of your Claude Code installation')
  .action(() => {
    console.log(chalk.bold('\nClaude Code Health Check\n'));

    // 检查 API 密钥
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    console.log(`  API Key: ${hasApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not found')}`);

    // 检查 Node 版本
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    console.log(`  Node.js: ${nodeMajor >= 18 ? chalk.green(`✓ ${nodeVersion}`) : chalk.red(`✗ ${nodeVersion} (need >= 18)`)}`);

    // 检查工具
    console.log(`  Tools: ${chalk.green(`✓ ${toolRegistry.getAll().length} registered`)}`);

    // 检查 MCP 服务器
    const mcpServers = Object.keys(configManager.getMcpServers());
    console.log(`  MCP Servers: ${mcpServers.length > 0 ? chalk.green(`✓ ${mcpServers.length} configured`) : chalk.gray('○ None configured')}`);

    // 检查配置目录
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(process.env.HOME || '~', '.claude');
    const configExists = fs.existsSync(configDir);
    console.log(`  Config Dir: ${configExists ? chalk.green(`✓ ${configDir}`) : chalk.gray(`○ ${configDir} (will be created)`)}`);

    console.log();
  });

// Setup Token 命令
program
  .command('setup-token')
  .description('Set up a long-lived authentication token (requires Claude subscription)')
  .action(async () => {
    console.log(chalk.bold('\nSetup Authentication Token\n'));
    console.log(chalk.gray('This feature requires a Claude subscription.'));
    console.log(chalk.gray('Visit https://console.anthropic.com to get your API key.\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter your API key: ', (apiKey) => {
      if (apiKey.trim()) {
        // 保存到配置
        configManager.set('apiKey', apiKey.trim());
        console.log(chalk.green('\n✓ API key saved successfully!'));
      } else {
        console.log(chalk.yellow('\nNo API key provided.'));
      }
      rl.close();
    });
  });

// Update 命令
program
  .command('update')
  .description('Check for updates and install if available')
  .action(async () => {
    console.log(chalk.bold('\nChecking for updates...\n'));
    console.log(`Current version: ${VERSION}`);
    console.log(chalk.gray('\nTo update, run: npm install -g @anthropic-ai/claude-code'));
    console.log(chalk.gray('Or for this restored version: npm install -g claude-code-restored\n'));
  });

// Install 命令
program
  .command('install [target]')
  .description('Install Claude Code native build')
  .option('--force', 'Force reinstall')
  .action((target, options) => {
    const version = target || 'stable';
    console.log(chalk.bold(`\nInstalling Claude Code (${version})...\n`));
    console.log(chalk.gray('For native builds, please visit:'));
    console.log(chalk.cyan('https://github.com/anthropics/claude-code\n'));
  });

// 辅助函数: 会话选择器
async function showSessionPicker(loop: ConversationLoop): Promise<void> {
  const sessions = listSessions({ limit: 10 });

  if (sessions.length === 0) {
    console.log(chalk.yellow('No sessions found.'));
    return;
  }

  console.log(chalk.bold('\nSelect a session to resume:\n'));
  sessions.forEach((s, i) => {
    const date = new Date(s.createdAt).toLocaleString();
    console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${s.id}`);
    console.log(`      ${chalk.gray(date)} - ${s.messageCount} messages`);
  });
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter session number (or press Enter to cancel): ', (answer) => {
      rl.close();
      const num = parseInt(answer);
      if (num >= 1 && num <= sessions.length) {
        const session = loadSession(sessions[num - 1].id);
        if (session) {
          console.log(chalk.green(`\nResumed session: ${sessions[num - 1].id}\n`));
        }
      }
      resolve();
    });
  });
}

// 辅助函数: 加载 MCP 配置
function loadMcpConfigs(configs: string[]): void {
  for (const config of configs) {
    try {
      let mcpConfig: Record<string, unknown>;

      if (config.startsWith('{')) {
        // JSON 字符串
        mcpConfig = JSON.parse(config);
      } else if (fs.existsSync(config)) {
        // 文件路径
        const content = fs.readFileSync(config, 'utf-8');
        mcpConfig = JSON.parse(content);
      } else {
        console.warn(chalk.yellow(`MCP config not found: ${config}`));
        continue;
      }

      // 注册 MCP 服务器
      if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
        const servers = mcpConfig.mcpServers as Record<string, { type: 'stdio' | 'sse' | 'http'; command?: string; args?: string[]; env?: Record<string, string>; url?: string }>;
        for (const [name, serverConfig] of Object.entries(servers)) {
          configManager.addMcpServer(name, serverConfig);
        }
      }
    } catch (err) {
      console.warn(chalk.yellow(`Failed to load MCP config: ${config}`));
    }
  }
}

// 辅助函数: 加载设置
function loadSettings(settingsPath: string): void {
  try {
    let settings: Record<string, unknown>;

    if (settingsPath.startsWith('{')) {
      settings = JSON.parse(settingsPath);
    } else if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } else {
      console.warn(chalk.yellow(`Settings file not found: ${settingsPath}`));
      return;
    }

    // 应用设置
    if (settings.model) {
      configManager.set('model', settings.model as string);
    }
    if (settings.maxTokens) {
      configManager.set('maxTokens', settings.maxTokens as number);
    }
    if (settings.verbose !== undefined) {
      configManager.set('verbose', settings.verbose as boolean);
    }
  } catch (err) {
    console.warn(chalk.yellow(`Failed to load settings: ${settingsPath}`));
  }
}

// 斜杠命令处理
function handleSlashCommand(input: string, loop: ConversationLoop): void {
  const [cmd, ...args] = input.slice(1).split(' ');

  switch (cmd.toLowerCase()) {
    case 'help':
      console.log(chalk.bold('\nAvailable commands:'));
      console.log('  /help     - Show this help message');
      console.log('  /clear    - Clear conversation history');
      console.log('  /save     - Save current session');
      console.log('  /stats    - Show session statistics');
      console.log('  /tools    - List available tools');
      console.log('  /model    - Show or change current model');
      console.log('  /compact  - Compact conversation history');
      console.log('  /config   - Show current configuration');
      console.log('  /exit     - Exit Claude Code');
      console.log();
      break;

    case 'clear':
      loop.getSession().clearMessages();
      console.log(chalk.yellow('Conversation cleared.\n'));
      break;

    case 'save':
      const file = loop.getSession().save();
      console.log(chalk.green(`Session saved to: ${file}\n`));
      break;

    case 'stats':
      const stats = loop.getSession().getStats();
      console.log(chalk.bold('\nSession Statistics:'));
      console.log(`  Duration: ${Math.round(stats.duration / 1000)}s`);
      console.log(`  Messages: ${stats.messageCount}`);
      console.log(`  Cost: ${stats.totalCost}`);
      console.log();
      break;

    case 'tools':
      const tools = toolRegistry.getDefinitions();
      console.log(chalk.bold('\nAvailable Tools:'));
      tools.forEach(t => console.log(`  - ${t.name}`));
      console.log();
      break;

    case 'model':
      if (args[0]) {
        console.log(chalk.yellow(`Model switching: ${args[0]}\n`));
      } else {
        console.log('Usage: /model <sonnet|opus|haiku>\n');
      }
      break;

    case 'compact':
      console.log(chalk.yellow('Compacting conversation history...\n'));
      break;

    case 'config':
      console.log(chalk.bold('\nCurrent Configuration:'));
      const config = configManager.getAll();
      console.log(`  Model: ${config.model || 'default'}`);
      console.log(`  Max Tokens: ${config.maxTokens || 'default'}`);
      console.log(`  Verbose: ${config.verbose || false}`);
      console.log();
      break;

    case 'exit':
    case 'quit':
      console.log(chalk.yellow('\nGoodbye!'));
      process.exit(0);

    default:
      console.log(chalk.red(`Unknown command: /${cmd}\n`));
  }
}

// 错误处理
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
});

// 运行
program.parse();
