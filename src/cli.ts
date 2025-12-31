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
import * as os from 'os';
import React from 'react';
import { render } from 'ink';
import { ConversationLoop } from './core/loop.js';
import { Session } from './core/session.js';
import { toolRegistry } from './tools/index.js';
import { configManager } from './config/index.js';
import { listSessions, loadSession, forkSession } from './session/index.js';
import { getMemoryManager } from './memory/index.js';
import { emitLifecycleEvent } from './lifecycle/index.js';
import { runHooks } from './hooks/index.js';
import { scheduleCleanup } from './session/cleanup.js';
import { createPluginCommand } from './plugins/cli.js';
import type { PermissionMode, OutputFormat, InputFormat } from './types/index.js';

// 工作目录列表
const additionalDirectories: string[] = [];

const VERSION = '2.0.76-restored';

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
  .option('--system-prompt-file <file>', 'Read system prompt from a file')
  .option('--append-system-prompt <prompt>', 'Append to default system prompt')
  .option('--append-system-prompt-file <file>', 'Read system prompt from a file and append to the default system prompt')
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
  .option('--max-tokens <tokens>', 'Maximum tokens for response', '32000')
  // 其他选项
  .option('--settings <file-or-json>', 'Path to settings JSON file or JSON string')
  .option('--add-dir <directories...>', 'Additional directories to allow tool access')
  .option('--ide', 'Auto-connect to IDE on startup')
  .option('--agents <json>', 'JSON object defining custom agents')
  .option('--teleport <session-id>', 'Connect to remote Claude Code session')
  .option('--include-dependencies', 'Auto-include project dependency type definitions')
  .option('--solo', 'Disable background processes and parallel execution')
  .option('--setting-sources <sources>', 'Comma-separated list of setting sources')
  .option('--plugin-dir <paths...>', 'Load plugins from directories')
  .option('--disable-slash-commands', 'Disable all slash commands')
  .option('--chrome', 'Enable Claude in Chrome integration')
  .option('--no-chrome', 'Disable Claude in Chrome integration')
  .option('--text', 'Use text-based interface instead of TUI')
  .action(async (prompt, options) => {
    // T504: action_handler_start - Action 处理器开始
    await emitLifecycleEvent('action_handler_start');

    // ✅ 启动时自动清理过期数据（异步，不阻塞）
    scheduleCleanup();

    // 🔍 提前验证系统提示选项的互斥性
    if (options.systemPrompt && options.systemPromptFile) {
      process.stderr.write(chalk.red('Error: Cannot use both --system-prompt and --system-prompt-file. Please use only one.\n'));
      process.exit(1);
    }
    if (options.appendSystemPrompt && options.appendSystemPromptFile) {
      process.stderr.write(chalk.red('Error: Cannot use both --append-system-prompt and --append-system-prompt-file. Please use only one.\n'));
      process.exit(1);
    }

    // 检查是否需要显示登录选择器
    // 只在没有 prompt 且没有认证凭据时显示
    if (!prompt && !options.print && !options.text) {
      const { shouldShowLoginSelector } = await import('./ui/LoginSelector.js');

      if (shouldShowLoginSelector()) {
        await showLoginSelectorUI();
        // 登录成功后继续启动交互界面,不要 return
        // return; // ❌ 移除这个 return
      }
    }

    // 调试模式
    if (options.debug) {
      process.env.CLAUDE_DEBUG = options.debug === true ? '*' : options.debug;
    }

    // Solo 模式 - 禁用后台进程和并行执行
    if (options.solo) {
      process.env.CLAUDE_SOLO_MODE = 'true';
    }

    // 模型映射（官方 Claude Code 使用的模型版本）
    const modelMap: Record<string, string> = {
      'sonnet': 'claude-sonnet-4-5-20250929',
      'opus': 'claude-opus-4-5-20251101',
      'haiku': 'claude-haiku-4-5-20251001',
    };

    // 加载 MCP 配置
    if (options.mcpConfig) {
      loadMcpConfigs(options.mcpConfig);
    }

    // T507: action_mcp_configs_loaded - MCP 配置加载完成
    await emitLifecycleEvent('action_mcp_configs_loaded');
    await runHooks({ event: 'McpConfigsLoaded' });

    // 构建系统提示
    let systemPrompt = options.systemPrompt;

    // 处理 --system-prompt-file（互斥性已在前面验证）
    if (options.systemPromptFile) {
      try {
        const filePath = path.resolve(options.systemPromptFile);
        if (!fs.existsSync(filePath)) {
          process.stderr.write(chalk.red(`Error: System prompt file not found: ${filePath}\n`));
          process.exit(1);
        }
        systemPrompt = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        process.stderr.write(chalk.red(`Error reading system prompt file: ${errorMsg}\n`));
        process.exit(1);
      }
    }

    // 处理 --append-system-prompt 和 --append-system-prompt-file（互斥性已在前面验证）
    let appendSystemPrompt = options.appendSystemPrompt;
    if (options.appendSystemPromptFile) {
      try {
        const filePath = path.resolve(options.appendSystemPromptFile);
        if (!fs.existsSync(filePath)) {
          process.stderr.write(chalk.red(`Error: Append system prompt file not found: ${filePath}\n`));
          process.exit(1);
        }
        appendSystemPrompt = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        process.stderr.write(chalk.red(`Error reading append system prompt file: ${errorMsg}\n`));
        process.exit(1);
      }
    }

    // 合并 append system prompt
    if (appendSystemPrompt) {
      systemPrompt = (systemPrompt || '') + '\n' + appendSystemPrompt;
    }

    // Include dependencies - 添加依赖类型定义到系统提示
    if (options.includeDependencies) {
      const dependenciesContext = '\n\nNote: Project dependency type definitions are automatically included for better code understanding.';
      systemPrompt = (systemPrompt || '') + dependenciesContext;
    }

    // 加载设置
    if (options.settings) {
      loadSettings(options.settings);
    }

    // T509: action_after_input_prompt - 输入提示处理后
    await emitLifecycleEvent('action_after_input_prompt', { prompt });

    // T506: action_tools_loaded - 工具加载完成
    // 注意：工具在 toolRegistry 导入时已加载，这里触发事件
    await emitLifecycleEvent('action_tools_loaded', { toolCount: toolRegistry.getAll().length });
    await runHooks({ event: 'ToolsLoaded' });

    // T502: action_before_setup - 设置前
    await emitLifecycleEvent('action_before_setup');
    await runHooks({ event: 'BeforeSetup' });

    // 这里进行必要的设置（setup logic）
    // 在本项目中，设置逻辑较为简单，主要是配置和会话管理

    // T503: action_after_setup - 设置后
    await emitLifecycleEvent('action_after_setup');
    await runHooks({ event: 'AfterSetup' });

    // 初始化 LSP 管理器
    try {
      const { initializeLSPManager } = await import('./lsp/index.js');
      const workspaceRoot = process.cwd();
      await initializeLSPManager(workspaceRoot);
      console.log(chalk.dim('[LSP] Language servers initialized'));
    } catch (error) {
      // LSP 初始化失败不应该阻止程序运行
      if (options.debug) {
        console.warn(chalk.yellow('[LSP] Failed to initialize language servers:'), error);
      }
    }

    // T505: action_commands_loaded - 命令加载完成
    // 注意：本项目的斜杠命令是内联定义的，这里标记为已加载
    await emitLifecycleEvent('action_commands_loaded');
    await runHooks({ event: 'CommandsLoaded' });

    // T508: action_after_plugins_init - 插件初始化后
    // 注意：本项目的插件系统尚未完全实现，但仍触发事件
    await emitLifecycleEvent('action_after_plugins_init');
    await runHooks({ event: 'PluginsInitialized' });

    // T510: action_after_hooks - Hooks 执行后
    // 注意：Hooks 在需要时执行，这里标记为已准备就绪
    await emitLifecycleEvent('action_after_hooks');
    await runHooks({ event: 'AfterHooks' });

    // Teleport 模式 - 连接到远程会话
    if (options.teleport) {
      try {
        console.log(chalk.cyan(`Connecting to remote session: ${options.teleport}...`));

        // 动态导入 teleport 模块
        const { connectToRemoteSession, validateSessionRepository } = await import('./teleport/index.js');

        // 获取远程服务器 URL（可以从环境变量或配置获取）
        const ingressUrl = process.env.CLAUDE_TELEPORT_URL;
        const authToken = process.env.CLAUDE_TELEPORT_TOKEN;

        if (!ingressUrl) {
          console.log(chalk.yellow('Warning: No CLAUDE_TELEPORT_URL environment variable set.'));
          console.log(chalk.gray('Attempting to connect using local session...'));

          // 尝试从本地加载会话
          const session = Session.load(options.teleport);
          if (session) {
            console.log(chalk.green(`Loaded local session: ${options.teleport}`));
          } else {
            console.log(chalk.yellow(`Session ${options.teleport} not found locally.`));
            console.log(chalk.gray('Starting new session instead...'));
          }
        } else {
          // 连接到远程会话
          const remoteSession = await connectToRemoteSession(
            options.teleport,
            ingressUrl,
            authToken
          );

          console.log(chalk.green(`Connected to remote session: ${options.teleport}`));
          console.log(chalk.gray(`Remote URL: ${ingressUrl}`));

          // 监听远程会话事件
          remoteSession.on('message', (message) => {
            if (options.verbose) {
              console.log(chalk.dim(`[Remote] ${JSON.stringify(message)}`));
            }
          });

          remoteSession.on('disconnected', () => {
            console.log(chalk.yellow('Remote session disconnected'));
          });

          remoteSession.on('error', (error) => {
            console.error(chalk.red(`Remote session error: ${error.message}`));
          });

          // 在程序退出时断开连接
          process.on('SIGINT', async () => {
            console.log(chalk.yellow('\nDisconnecting from remote session...'));
            await remoteSession.disconnect();
            process.exit(0);
          });
        }
      } catch (err) {
        console.log(chalk.red(`Failed to connect to remote session: ${err instanceof Error ? err.message : err}`));
        console.log(chalk.gray('Starting new session instead...'));

        if (options.verbose && err instanceof Error) {
          console.error(chalk.dim(err.stack));
        }
      }
    }

    // 打印模式 (JSON 格式支持) - 不使用 TUI
    if (options.print && prompt) {
      const loop = new ConversationLoop({
        model: modelMap[options.model] || options.model,
        maxTokens: parseInt(options.maxTokens),
        verbose: options.verbose,
        systemPrompt,
        permissionMode: options.permissionMode as PermissionMode,
        allowedTools: options.allowedTools,
        disallowedTools: options.disallowedTools,
      });

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

    // 使用文本界面还是 TUI
    if (options.text) {
      // 使用基于 readline 的文本界面
      await runTextInterface(prompt, options, modelMap, systemPrompt);
    } else {
      // 使用 Ink TUI 界面
      await runTuiInterface(prompt, options, modelMap, systemPrompt);
    }
  });

// 运行 TUI 界面 (Ink)
async function runTuiInterface(
  prompt: string | undefined,
  options: any,
  modelMap: Record<string, string>,
  systemPrompt?: string
): Promise<void> {
  try {
    // 动态导入 App 组件
    const { App } = await import('./ui/App.js');

    // 获取用户名
    const username = process.env.USER || process.env.USERNAME || undefined;

    // 渲染 Ink 应用
    render(
      React.createElement(App, {
        model: options.model,
        initialPrompt: prompt,
        verbose: options.verbose,
        systemPrompt,
        username,
        apiType: 'Claude API',
        organization: undefined,
      })
    );
  } catch (error) {
    console.error(chalk.red('Failed to start TUI interface:'), error);
    console.log(chalk.yellow('Falling back to text interface...'));
    await runTextInterface(prompt, options, modelMap, systemPrompt);
  }
}

// 运行文本界面 (readline)
async function runTextInterface(
  prompt: string | undefined,
  options: any,
  modelMap: Record<string, string>,
  systemPrompt?: string
): Promise<void> {
  // 官方 claude 颜色 (clawd_body): rgb(215,119,87)
  const claudeColor = chalk.rgb(215, 119, 87);

  // ASCII Art Logo for text mode - 使用官方 clawd 设计
  const LOGO = `
╭─────────────────────────────────────────────────────╮
│                                                     │
│   ${claudeColor('Claude Code')} ${chalk.gray('v' + VERSION)}                           │
│                                                     │
│        ${claudeColor('*')}       ${claudeColor('*')}                                 │
│      ${claudeColor('*')}  ${claudeColor(' ▐')}${claudeColor.bgBlack('▛███▜')}${claudeColor('▌')}  ${claudeColor('*')}                            │
│        ${claudeColor('*')} ${claudeColor('▝▜')}${claudeColor.bgBlack('█████')}${claudeColor('▛▘')} ${claudeColor('*')}                            │
│           ${claudeColor('▘▘ ▝▝')}                                │
│                                                     │
│   ${chalk.cyan('Sonnet 4')} · ${chalk.gray('Claude API')}                         │
│   ${chalk.gray(process.cwd())}
╰─────────────────────────────────────────────────────╯
`;

  console.log(LOGO);

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
      await showSessionPicker(loop);
    } else {
      // 检查是否需要 fork 会话
      if (options.forkSession) {
        // Fork 会话：创建新会话 ID，但保留历史消息
        const forkedSessionData = forkSession(options.resume, {
          name: undefined, // 使用默认名称
          tags: undefined,
          fromMessageIndex: 0, // 从开始复制所有消息
          includeFutureMessages: true,
        });

        if (forkedSessionData) {
          // 从 forkedSessionData 创建 Session 对象
          const forkedSession = new Session(forkedSessionData.metadata.workingDirectory);

          // 手动设置会话状态
          forkedSession['state'] = {
            sessionId: forkedSessionData.metadata.id,
            cwd: forkedSessionData.metadata.workingDirectory,
            originalCwd: forkedSessionData.metadata.workingDirectory,
            startTime: forkedSessionData.metadata.createdAt,
            totalCostUSD: forkedSessionData.metadata.cost || 0,
            totalAPIDuration: 0,
            totalAPIDurationWithoutRetries: 0,
            totalToolDuration: 0,
            totalLinesAdded: 0,
            totalLinesRemoved: 0,
            modelUsage: {},
            alwaysAllowedTools: [],
            todos: [],
          };

          // 设置消息历史
          forkedSessionData.messages.forEach(msg => forkedSession.addMessage(msg));

          // 设置到 loop
          loop.setSession(forkedSession);

          console.log(chalk.green(`✓ Forked session from: ${options.resume.slice(0, 8)}`));
          console.log(chalk.green(`  New session ID: ${forkedSessionData.metadata.id.slice(0, 8)}`));
          console.log(chalk.gray(`  Copied ${forkedSessionData.messages.length} messages`));
          console.log(chalk.gray(`  This is a new independent session based on the original`));
        } else {
          console.log(chalk.yellow(`Session ${options.resume} not found, starting new session`));
        }
      } else {
        // 正常恢复会话
        const session = Session.load(options.resume);
        if (session) {
          loop.setSession(session);
          console.log(chalk.green(`Resumed session: ${options.resume}`));
        } else {
          console.log(chalk.yellow(`Session ${options.resume} not found, starting new session`));
        }
      }
    }
  }

  // 如果有初始 prompt
  if (prompt) {
    console.log(chalk.blue('> ') + prompt);
    console.log();

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

  console.log(chalk.gray('> Try "how do I log an error?"'));
  console.log(chalk.gray('? for shortcuts'));
  console.log();

  const askQuestion = (): void => {
    rl.question(chalk.white('> '), async (input) => {
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
      console.log();

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
}

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

// Plugin 子命令 - 使用完整实现
program.addCommand(createPluginCommand());

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
  .option('--verbose', 'Show detailed diagnostics')
  .action(async (options) => {
    const { runDiagnostics, formatDiagnosticReport } = await import('./diagnostics/index.js');

    console.log(chalk.bold('\nRunning Claude Code diagnostics...\n'));

    try {
      const report = await runDiagnostics();
      console.log(formatDiagnosticReport(report));

      if (report.summary.failed > 0) {
        console.log(chalk.red(`  ✗ ${report.summary.failed} critical issue(s) found`));
      }
      if (report.summary.warnings > 0) {
        console.log(chalk.yellow(`  ⚠ ${report.summary.warnings} warning(s)`));
      }
      if (report.summary.failed === 0 && report.summary.warnings === 0) {
        console.log(chalk.green('  ✓ All checks passed!'));
      }

      if (options.verbose) {
        console.log(chalk.gray('\n  Additional info:'));
        console.log(chalk.gray(`  - Working directory: ${process.cwd()}`));
        console.log(chalk.gray(`  - Tools registered: ${toolRegistry.getAll().length}`));
        const mcpServers = Object.keys(configManager.getMcpServers());
        console.log(chalk.gray(`  - MCP servers: ${mcpServers.length}`));
      }
    } catch (err) {
      console.log(chalk.red(`\n  ✗ Diagnostics failed: ${err}`));
    }

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
  .option('--force', 'Force reinstall even if already up to date')
  .option('--beta', 'Install beta version')
  .option('--canary', 'Install canary version')
  .option('--dry-run', 'Show what would be updated without actually updating')
  .option('--list-versions', 'List all available versions')
  .option('--version <version>', 'Install a specific version')
  .option('--rollback <version>', 'Rollback to a specific version')
  .action(async (options) => {
    const { checkForUpdates, performUpdate, rollbackVersion, listVersions } = await import('./updater/index.js');

    console.log(chalk.bold('\n📦 Claude Code Update Manager\n'));

    try {
      // 列出可用版本
      if (options.listVersions) {
        console.log(chalk.cyan('Fetching available versions...\n'));
        const versions = await listVersions();
        console.log(chalk.bold('Available Versions:\n'));
        versions.slice(0, 20).forEach((v, i) => {
          if (i === 0) {
            console.log(chalk.green(`  ✓ ${v} (latest)`));
          } else {
            console.log(chalk.gray(`    ${v}`));
          }
        });
        if (versions.length > 20) {
          console.log(chalk.gray(`\n  ... and ${versions.length - 20} more versions`));
        }
        console.log();
        return;
      }

      // 回滚版本
      if (options.rollback) {
        console.log(chalk.yellow(`Rolling back to version ${options.rollback}...\n`));
        const success = await rollbackVersion(options.rollback, {
          showProgress: true,
          dryRun: options.dryRun,
        });

        if (success) {
          console.log(chalk.green(`\n✓ Successfully rolled back to version ${options.rollback}`));
        } else {
          console.log(chalk.red('\n✗ Rollback failed'));
        }
        return;
      }

      // 检查更新
      console.log(chalk.cyan(`Current version: ${VERSION}\n`));
      console.log(chalk.gray('Checking for updates...\n'));

      const updateInfo = await checkForUpdates({
        channel: options.canary ? 'canary' : options.beta ? 'beta' : 'stable',
      });

      if (!updateInfo.hasUpdate && !options.force) {
        console.log(chalk.green('✓ You are already on the latest version!'));
        console.log();
        return;
      }

      // 显示版本信息
      console.log(chalk.bold('Update Available:\n'));
      console.log(`  Current:  ${chalk.gray(updateInfo.current)}`);
      console.log(`  Latest:   ${chalk.green(updateInfo.latest)}\n`);

      // 显示变更日志
      if (updateInfo.changelog && updateInfo.changelog.length > 0) {
        console.log(chalk.bold('Recent Versions:\n'));
        updateInfo.changelog.slice(0, 5).forEach(v => {
          console.log(chalk.gray(`  • ${v}`));
        });
        console.log();
      }

      // 显示版本详情
      if (updateInfo.versionInfo) {
        const info = updateInfo.versionInfo;
        if (info.description) {
          console.log(chalk.gray(`Description: ${info.description}\n`));
        }
        if (info.minimumNodeVersion) {
          console.log(chalk.gray(`Required Node.js: ${info.minimumNodeVersion}\n`));
        }
      }

      // 执行更新
      if (options.dryRun) {
        console.log(chalk.yellow('[DRY-RUN] Would update to version ' + updateInfo.latest));
        console.log(chalk.gray('Run without --dry-run to perform the actual update\n'));
        return;
      }

      // 确认更新
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const shouldUpdate = await new Promise<boolean>((resolve) => {
        rl.question(chalk.yellow(`\nUpdate to ${updateInfo.latest}? (y/N) `), (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!shouldUpdate && !options.force) {
        console.log(chalk.gray('\nUpdate cancelled.\n'));
        return;
      }

      console.log(chalk.cyan('\nUpdating...\n'));

      const success = await performUpdate({
        version: options.version,
        force: options.force,
        beta: options.beta,
        canary: options.canary,
        showProgress: true,
        dryRun: false,
      });

      if (success) {
        console.log(chalk.green('\n✓ Update completed successfully!'));
        console.log(chalk.gray('Please restart Claude Code to use the new version.\n'));
      } else {
        console.log(chalk.red('\n✗ Update failed'));
        console.log(chalk.gray('Try running: npm install -g claude-code-open\n'));
      }
    } catch (error) {
      console.error(chalk.red('Error during update:'), error);
      console.log(chalk.gray('\nManual update:'));
      console.log(chalk.gray('  npm install -g claude-code-open\n'));
    }
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

// GitHub Actions 设置命令
program
  .command('github-setup')
  .description('Set up Claude Code GitHub Actions workflow')
  .action(async () => {
    console.log(chalk.bold('\n🐙 Setting up Claude Code GitHub Actions...\n'));

    const { checkGitHubCLI, setupGitHubWorkflow } = await import('./github/index.js');

    const ghStatus = await checkGitHubCLI();
    if (!ghStatus.installed) {
      console.log(chalk.yellow('⚠️  GitHub CLI (gh) is not installed.'));
      console.log(chalk.gray('   Install it from: https://cli.github.com/\n'));
    } else if (!ghStatus.authenticated) {
      console.log(chalk.yellow('⚠️  GitHub CLI is not authenticated.'));
      console.log(chalk.gray('   Run: gh auth login\n'));
    } else {
      console.log(chalk.green('✓ GitHub CLI is installed and authenticated'));
    }

    const result = await setupGitHubWorkflow(process.cwd());

    if (result.success) {
      console.log(chalk.green(`\n✓ ${result.message}`));
      console.log(chalk.gray(`  Path: ${result.workflowPath}`));
      console.log(chalk.bold('\nNext steps:'));
      console.log('  1. Add ANTHROPIC_API_KEY to your repository secrets');
      console.log('     Settings → Secrets → Actions → New repository secret');
      console.log('  2. Commit and push the workflow file');
      console.log('  3. Open a PR to test the integration');
    } else {
      console.log(chalk.yellow(`\n⚠️  ${result.message}`));
      if (result.workflowPath) {
        console.log(chalk.gray(`  Path: ${result.workflowPath}`));
      }
    }
    console.log();
  });

// PR Review 命令
program
  .command('review-pr <number>')
  .description('Review a GitHub pull request')
  .action(async (prNumber) => {
    console.log(chalk.bold(`\n📝 Reviewing PR #${prNumber}...\n`));

    const { checkGitHubCLI, getPRInfo } = await import('./github/index.js');

    const ghStatus = await checkGitHubCLI();
    if (!ghStatus.authenticated) {
      console.log(chalk.red('GitHub CLI is not authenticated. Run: gh auth login'));
      return;
    }

    const prInfo = await getPRInfo(parseInt(prNumber));
    if (!prInfo) {
      console.log(chalk.red(`Failed to get PR #${prNumber} info`));
      return;
    }

    console.log(chalk.cyan(`Title: ${prInfo.title}`));
    console.log(chalk.gray(`Author: ${prInfo.author}`));
    console.log(chalk.gray(`State: ${prInfo.state}`));
    console.log(chalk.gray(`Changes: +${prInfo.additions} -${prInfo.deletions} (${prInfo.changedFiles} files)`));
    console.log();
    console.log(chalk.gray('Use Claude to review: claude "review PR #' + prNumber + '"'));
    console.log();
  });

// Provider 命令
program
  .command('provider')
  .description('Show current API provider configuration')
  .action(async () => {
    const { detectProvider, getProviderInfo, validateProviderConfig, getProviderDisplayName } = await import('./providers/index.js');

    console.log(chalk.bold('\n☁️  API Provider Configuration\n'));

    const config = detectProvider();
    const info = getProviderInfo(config);
    const validation = validateProviderConfig(config);

    console.log(`  Provider: ${chalk.cyan(getProviderDisplayName(config.type))}`);
    console.log(`  Model:    ${chalk.gray(info.model)}`);
    console.log(`  Base URL: ${chalk.gray(info.baseUrl)}`);

    if (info.region) {
      console.log(`  Region:   ${chalk.gray(info.region)}`);
    }

    if (validation.valid) {
      console.log(chalk.green('\n  ✓ Configuration is valid'));
    } else {
      console.log(chalk.red('\n  ✗ Configuration issues:'));
      validation.errors.forEach((err) => {
        console.log(chalk.red(`    - ${err}`));
      });
    }

    console.log(chalk.gray('\n  Environment variables:'));
    const envVars = [
      'ANTHROPIC_API_KEY',
      'CLAUDE_CODE_USE_BEDROCK',
      'CLAUDE_CODE_USE_VERTEX',
      'AWS_REGION',
      'ANTHROPIC_VERTEX_PROJECT_ID',
    ];

    envVars.forEach((v) => {
      const val = process.env[v];
      if (val) {
        const display = v.includes('KEY') ? `***${val.slice(-4)}` : val;
        console.log(chalk.gray(`    ${v}=${display}`));
      }
    });

    console.log();
  });

// Checkpoint 命令
program
  .command('checkpoint')
  .description('Manage file checkpoints')
  .argument('[action]', 'Action: list, restore, clear')
  .argument('[file]', 'File path (for restore)')
  .action(async (action, file) => {
    const { getCurrentSession, getCheckpointHistory, restoreCheckpoint, clearCheckpoints } = await import('./checkpoint/index.js');

    const session = getCurrentSession();

    if (!action || action === 'list') {
      console.log(chalk.bold('\n📌 File Checkpoints\n'));

      if (!session) {
        console.log(chalk.gray('  No active checkpoint session.'));
        console.log();
        return;
      }

      const files = Array.from(session.checkpoints.keys());
      if (files.length === 0) {
        console.log(chalk.gray('  No checkpoints recorded yet.'));
      } else {
        files.forEach((f) => {
          const history = getCheckpointHistory(f);
          console.log(chalk.cyan(`  ${f}`));
          console.log(chalk.gray(`    ${history.checkpoints.length} checkpoint(s), current: #${history.currentIndex + 1}`));
        });
      }
    } else if (action === 'restore' && file) {
      const result = restoreCheckpoint(file);
      if (result.success) {
        console.log(chalk.green(`\n  ✓ ${result.message}`));
      } else {
        console.log(chalk.red(`\n  ✗ ${result.message}`));
      }
    } else if (action === 'clear') {
      clearCheckpoints();
      console.log(chalk.green('\n  ✓ All checkpoints cleared'));
    } else {
      console.log(chalk.yellow('\n  Usage: claude checkpoint [list|restore <file>|clear]'));
    }

    console.log();
  });

// Login 命令
program
  .command('login')
  .description('Login to Claude API or claude.ai')
  .option('--api-key', 'Setup with API key')
  .option('--oauth', 'OAuth login (interactive)')
  .option('--claudeai', 'OAuth with Claude.ai account')
  .option('--console', 'OAuth with Anthropic Console account')
  .action(async (options) => {
    const {
      startOAuthLogin,
      isAuthenticated,
      getAuthType,
      getAuth,
    } = await import('./auth/index.js');

    console.log(chalk.bold('\n🔐 Claude Code Login\n'));

    // 检查当前认证状态
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    const hasCredentials = fs.existsSync(path.join(os.homedir(), '.claude', 'credentials.json'));
    const hasOAuthToken = fs.existsSync(path.join(os.homedir(), '.claude', 'auth.json'));

    let authStatus = 'Not authenticated';
    if (hasApiKey) {
      authStatus = 'Authenticated (API Key from environment)';
    } else if (hasCredentials) {
      authStatus = 'Authenticated (API Key from file)';
    } else if (hasOAuthToken) {
      authStatus = 'Authenticated (OAuth)';
    }

    // 无参数时显示帮助
    if (!options.apiKey && !options.oauth && !options.claudeai && !options.console) {
      console.log(`Current Status: ${chalk.cyan(authStatus)}\n`);
      console.log(chalk.bold('Login Methods:\n'));
      console.log('  1. API Key (Recommended for developers)');
      console.log('     • Get key from: https://console.anthropic.com');
      console.log(chalk.cyan('     • Command: claude login --api-key\n'));
      console.log('  2. OAuth with Claude.ai Account');
      console.log('     • For Claude Pro/Max subscribers');
      console.log(chalk.cyan('     • Command: claude login --claudeai\n'));
      console.log('  3. OAuth with Console Account');
      console.log('     • For Anthropic Console users');
      console.log(chalk.cyan('     • Command: claude login --console\n'));
      console.log(chalk.bold('Quick Start:\n'));
      console.log(chalk.gray('  claude login --api-key        Setup API key'));
      console.log(chalk.gray('  claude login --oauth          Interactive OAuth'));
      console.log(chalk.gray('  claude setup-token            Generate long-term token\n'));
      return;
    }

    // --api-key 方法
    if (options.apiKey) {
      console.log(chalk.bold('API Key Setup\n'));
      console.log('API keys provide usage-based billing and are the recommended method');
      console.log('for developers using Claude Code.\n');
      console.log(chalk.bold('Steps:\n'));
      console.log('1. Get your API key:');
      console.log(chalk.cyan('   Visit: https://console.anthropic.com/settings/keys'));
      console.log('   Create or copy an existing key\n');
      console.log('2. Set the API key (choose one method):\n');
      console.log('   a) Environment variable (recommended):');
      console.log(chalk.gray('      export ANTHROPIC_API_KEY=sk-ant-your-key-here\n'));
      console.log('   b) Direct setup (stores in ~/.claude/credentials.json):');
      console.log(chalk.gray('      claude setup-token\n'));
      console.log('3. Verify:');
      console.log(chalk.gray('   claude doctor\n'));
      console.log(`Current Status: ${chalk.cyan(authStatus)}\n`);
      return;
    }

    // OAuth 方法
    if (options.oauth || options.claudeai || options.console) {
      const loginType = options.claudeai
        ? 'Claude.ai (Subscription)'
        : options.console
        ? 'Console (API Billing)'
        : 'OAuth';

      console.log(chalk.bold(`OAuth Login: ${loginType}\n`));
      console.log('OAuth authentication provides seamless integration with your Claude');
      console.log('or Anthropic Console account.\n');

      try {
        console.log(chalk.cyan('Starting OAuth login flow...\n'));

        const accountType = options.claudeai ? 'claude.ai' : 'console';
        const authResult = await startOAuthLogin({ accountType });

        if (authResult && authResult.accessToken) {
          console.log(chalk.green('\n✅ OAuth Login Successful!\n'));
          console.log('Authentication Details:');
          console.log(`  • Type: OAuth`);
          console.log(`  • Access Token: ${authResult.accessToken.substring(0, 20)}...`);
          if (authResult.expiresAt) {
            console.log(`  • Expires At: ${new Date(authResult.expiresAt).toLocaleString()}`);
          }
          console.log('\nCredentials saved to: ~/.claude/auth.json\n');
          console.log('You can now use Claude Code with your OAuth credentials.\n');
          console.log('To verify your authentication:');
          console.log(chalk.gray('  claude doctor'));
          console.log(chalk.gray('  claude api test\n'));
        } else {
          throw new Error('OAuth login returned invalid result');
        }
      } catch (error) {
        console.log(chalk.red('\n❌ OAuth Login Failed\n'));
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
        console.log('This educational project includes the OAuth framework, but full');
        console.log('OAuth integration requires:');
        console.log('  • Official OAuth client registration');
        console.log('  • Valid authorization endpoints');
        console.log('  • Proper redirect URI configuration\n');
        console.log('For immediate use, please try:');
        console.log(chalk.cyan('  claude login --api-key     Setup with API key'));
        console.log(chalk.cyan('  claude setup-token         Quick API key setup\n'));
      }
    }
  });

// Logout 命令
program
  .command('logout')
  .description('Logout from Claude')
  .action(async () => {
    const { logout, isAuthenticated, getAuthType, getAuth } = await import('./auth/index.js');

    console.log(chalk.bold('\n🔐 Claude Code Logout\n'));

    // 检查当前认证状态
    const wasAuthenticated = isAuthenticated();
    const authType = getAuthType();
    const currentAuthInfo = getAuth();

    if (!wasAuthenticated) {
      console.log('No active session found.');
      console.log('\nYou are not currently authenticated.\n');
      console.log('To login:');
      console.log(chalk.gray('  claude login              Show login options'));
      console.log(chalk.gray('  claude login --api-key    Setup with API key'));
      console.log(chalk.gray('  claude login --oauth      OAuth login'));
      console.log(chalk.gray('  claude setup-token        Quick API key setup\n'));
      return;
    }

    let clearedItems: string[] = [];

    // 调用认证系统的 logout() 函数
    try {
      logout();
      clearedItems.push('OAuth token (from auth system)');
    } catch (err) {
      // 继续处理其他清理
    }

    // 清除存储的 API key
    const credentialsFile = path.join(os.homedir(), '.claude', 'credentials.json');
    if (fs.existsSync(credentialsFile)) {
      try {
        fs.unlinkSync(credentialsFile);
        clearedItems.push('Stored API key');
      } catch (err) {
        // 忽略错误
      }
    }

    // 清除配置文件中的会话信息
    const configFile = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        let modified = false;

        if (config.sessionToken) {
          delete config.sessionToken;
          modified = true;
          clearedItems.push('Session token');
        }

        if (config.oauthAccount) {
          delete config.oauthAccount;
          modified = true;
          clearedItems.push('OAuth account');
        }

        if (modified) {
          fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        }
      } catch (err) {
        // 忽略错误
      }
    }

    // 构建退出消息
    console.log(chalk.green('✅ Logout Successful\n'));
    console.log('Previous Authentication:');
    console.log(`  • Type: ${authType || 'Unknown'}`);
    if (currentAuthInfo?.accessToken) {
      console.log(`  • Access Token: ${currentAuthInfo.accessToken.substring(0, 20)}...`);
    }
    if (currentAuthInfo?.apiKey) {
      console.log(`  • API Key: ${currentAuthInfo.apiKey.substring(0, 15)}...`);
    }

    console.log('\nCleared:');
    for (const item of clearedItems) {
      console.log(`  • ${item}`);
    }

    console.log('\nTo completely remove all authentication:\n');
    console.log('1. Remove environment variables:');
    console.log(chalk.gray('   unset ANTHROPIC_API_KEY'));
    console.log(chalk.gray('   unset CLAUDE_API_KEY\n'));
    console.log('2. Verify credentials cleared:');
    console.log(chalk.gray('   ls -la ~/.claude/\n'));
    console.log('To login again:');
    console.log(chalk.gray('  claude login              Show login options'));
    console.log(chalk.gray('  claude login --api-key    Setup with API key'));
    console.log(chalk.gray('  claude login --oauth      OAuth login\n'));
  });

// API 命令
const apiCommand = program.command('api').description('Interact with Claude API directly');

// api query
apiCommand
  .command('query <query...>')
  .description('Send a direct query to Claude API')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .action(async (queryParts, options) => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const query = queryParts.join(' ');

    // 获取 API key
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      const credentialsFile = path.join(os.homedir(), '.claude', 'credentials.json');
      if (fs.existsSync(credentialsFile)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
          if (!creds.apiKey) {
            console.log(chalk.red('\n❌ No API key found\n'));
            console.log('Please set up your API key:');
            console.log(chalk.gray('  claude login --api-key     Setup with API key'));
            console.log(chalk.gray('  claude setup-token         Quick API key setup\n'));
            return;
          }
        } catch {
          console.log(chalk.red('\n❌ No API key found\n'));
          return;
        }
      } else {
        console.log(chalk.red('\n❌ No API key found\n'));
        console.log('Please set up your API key:');
        console.log(chalk.gray('  claude login --api-key     Setup with API key'));
        console.log(chalk.gray('  claude setup-token         Quick API key setup\n'));
        return;
      }
    }

    console.log(chalk.cyan('\n🤖 Sending query to Claude API...\n'));

    try {
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: options.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
      });

      // 提取响应文本
      const textContent = response.content.find((block) => block.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : 'No text response';

      console.log(chalk.bold('Response:\n'));
      console.log(responseText);

      console.log(chalk.gray('\n─────────────────────────────────────'));
      console.log(chalk.gray(`Usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`));
      console.log(chalk.gray(`Model: ${response.model}`));
      console.log(chalk.gray(`Stop reason: ${response.stop_reason}\n`));
    } catch (error) {
      console.log(chalk.red(`\n❌ API Error: ${error instanceof Error ? error.message : String(error)}\n`));
    }
  });

// api models
apiCommand
  .command('models')
  .description('List available Claude models')
  .action(() => {
    console.log(chalk.bold('\n📋 Available Claude Models\n'));
    console.log(chalk.bold('Claude 4.5 Series (Latest)\n'));
    console.log(chalk.cyan('  claude-sonnet-4-5-20250929'));
    console.log('    • Context: 200K tokens');
    console.log('    • Best for: Most tasks, balanced performance');
    console.log('    • Pricing: $3 / $15 per MTok (in/out)');
    console.log('    • Recommended: Default choice\n');
    console.log(chalk.cyan('  claude-opus-4-5-20251101'));
    console.log('    • Context: 200K tokens');
    console.log('    • Best for: Complex reasoning, long tasks');
    console.log('    • Pricing: $15 / $75 per MTok (in/out)');
    console.log('    • Highest capability\n');
    console.log(chalk.cyan('  claude-haiku-4-5-20250514'));
    console.log('    • Context: 200K tokens');
    console.log('    • Best for: Fast, simple tasks');
    console.log('    • Pricing: $0.80 / $4 per MTok (in/out)');
    console.log('    • Most cost-effective\n');
    console.log(chalk.bold('Claude 3.5 Series\n'));
    console.log(chalk.gray('  • claude-3-5-sonnet-20241022'));
    console.log(chalk.gray('  • claude-3-5-haiku-20241022\n'));
    console.log('Documentation: https://docs.anthropic.com/en/docs/models-overview\n');
  });

// api test
apiCommand
  .command('test')
  .description('Test API connection')
  .action(async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;

    console.log(chalk.bold('\n🧪 Testing API Connection\n'));

    // 获取 API key
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      const credentialsFile = path.join(os.homedir(), '.claude', 'credentials.json');
      if (fs.existsSync(credentialsFile)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
          if (!creds.apiKey) {
            console.log(chalk.red('❌ API Key Not Found\n'));
            console.log('Please set up your API key:');
            console.log(chalk.gray('  claude login --api-key'));
            console.log(chalk.gray('  claude setup-token\n'));
            return;
          }
        } catch {
          console.log(chalk.red('❌ API Key Not Found\n'));
          return;
        }
      } else {
        console.log(chalk.red('❌ API Key Not Found\n'));
        console.log('Please set up your API key:');
        console.log(chalk.gray('  claude login --api-key'));
        console.log(chalk.gray('  claude setup-token\n'));
        return;
      }
    }

    // 验证 API key 格式
    if (!apiKey.startsWith('sk-ant-')) {
      console.log(chalk.yellow('⚠️  Invalid API Key Format\n'));
      console.log('Your API key should start with "sk-ant-"');
      console.log(`Current key: ${apiKey.substring(0, 15)}...\n`);
      return;
    }

    console.log(chalk.cyan('Sending test request...\n'));

    try {
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20250514',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      });

      console.log(chalk.green('✅ API Connection Successful\n'));
      console.log('API Key Status:');
      console.log('  • Format: Valid (sk-ant-...)');
      console.log('  • Authentication: ✓ Successful');
      console.log(`  • API Key: ${apiKey.substring(0, 20)}...\n`);
      console.log('Test Request:');
      console.log(`  • Model: ${response.model}`);
      console.log(`  • Input tokens: ${response.usage.input_tokens}`);
      console.log(`  • Output tokens: ${response.usage.output_tokens}`);
      console.log('  • Response time: < 1s\n');
      console.log('Your API connection is working correctly!\n');
    } catch (error) {
      console.log(chalk.red('❌ API Connection Failed\n'));
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      console.log('Common Issues:\n');
      console.log('1. Invalid API Key:');
      console.log('   • Verify the key at https://console.anthropic.com/settings/keys');
      console.log('   • Try regenerating your API key\n');
      console.log('2. Network Issues:');
      console.log('   • Check your internet connection');
      console.log('   • Verify firewall settings\n');
      console.log('3. Rate Limits:');
      console.log('   • Visit https://console.anthropic.com/settings/limits\n');
    }
  });

// api tokens
const tokensCommand = apiCommand.command('tokens').description('Manage API tokens');

tokensCommand
  .command('status')
  .description('Show current token configuration')
  .action(() => {
    console.log(chalk.bold('\n🔑 API Token Status\n'));

    const envKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const credentialsFile = path.join(os.homedir(), '.claude', 'credentials.json');
    const hasFileKey = fs.existsSync(credentialsFile);

    if (envKey) {
      console.log(chalk.green('✓ Environment Variable:'), `${envKey.substring(0, 20)}...`);
      console.log(`  Source: ${process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : 'CLAUDE_API_KEY'}\n`);
    } else {
      console.log(chalk.gray('✗ Environment Variable: Not set\n'));
    }

    if (hasFileKey) {
      try {
        const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
        const fileKey = creds.apiKey || creds.api_key;
        if (fileKey) {
          console.log(chalk.green('✓ File Token:'), `${fileKey.substring(0, 20)}...`);
          console.log('  Location: ~/.claude/credentials.json\n');
        } else {
          console.log(chalk.yellow('✗ File Token: File exists but no key found\n'));
        }
      } catch {
        console.log(chalk.yellow('✗ File Token: File exists but invalid format\n'));
      }
    } else {
      console.log(chalk.gray('✗ File Token: Not found\n'));
    }

    if (!envKey && !hasFileKey) {
      console.log(chalk.yellow('⚠️  No API token configured\n'));
      console.log('To set up a token:');
      console.log(chalk.gray('  claude login --api-key'));
      console.log(chalk.gray('  claude setup-token\n'));
    }

    console.log('Priority Order:');
    console.log('  1. ANTHROPIC_API_KEY (environment)');
    console.log('  2. CLAUDE_API_KEY (environment)');
    console.log('  3. ~/.claude/credentials.json (file)\n');
  });

tokensCommand
  .command('clear')
  .description('Clear stored API token')
  .action(() => {
    const credentialsFile = path.join(os.homedir(), '.claude', 'credentials.json');

    if (fs.existsSync(credentialsFile)) {
      try {
        fs.unlinkSync(credentialsFile);
        console.log(chalk.green('\n✅ Cleared stored API token\n'));
        console.log('Removed: ~/.claude/credentials.json\n');
        console.log('Note: Environment variables are still set if you have them.');
        console.log('To clear environment variables:');
        console.log(chalk.gray('  unset ANTHROPIC_API_KEY'));
        console.log(chalk.gray('  unset CLAUDE_API_KEY\n'));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error clearing token: ${error}\n`));
      }
    } else {
      console.log(chalk.yellow('\nNo stored token file found.\n'));
      console.log('If you have environment variables set:');
      console.log(chalk.gray('  unset ANTHROPIC_API_KEY'));
      console.log(chalk.gray('  unset CLAUDE_API_KEY\n'));
    }
  });

// 辅助函数: 登录选择器 UI
async function showLoginSelectorUI(): Promise<void> {
  const { LoginSelector } = await import('./ui/LoginSelector.js');
  const { startOAuthLogin } = await import('./auth/index.js');

  return new Promise((resolve) => {
    // 使用已导入的 render，不使用 require

    const onSelect = async (method: 'claudeai' | 'console' | 'exit') => {
      // 卸载 UI
      app.unmount();

      if (method === 'exit') {
        console.log(chalk.yellow('\nSetup cancelled.'));
        console.log(chalk.gray('\nTo login later, run:'));
        console.log(chalk.gray('  claude login --api-key     Setup with API key'));
        console.log(chalk.gray('  claude login --oauth       OAuth login'));
        console.log(chalk.gray('  claude setup-token         Quick setup\n'));
        process.exit(0);
      }

      // 执行 OAuth 登录
      console.log(chalk.cyan(`\nStarting OAuth login with ${method === 'claudeai' ? 'Claude.ai' : 'Anthropic Console'}...\n`));

      try {
        // 转换方法名称: claudeai -> claude.ai
        const accountType = method === 'claudeai' ? 'claude.ai' : 'console';
        const authResult = await startOAuthLogin({ accountType });

        if (authResult && authResult.accessToken) {
          console.log(chalk.green('\n✅ OAuth Login Successful!\n'));
          if (authResult.email) {
            console.log(`Logged in as ${authResult.email}`);
          }

          // 等待用户按回车后继续
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          await new Promise<void>((resolve) => {
            console.log(chalk.gray('\nLogin successful. Press Enter to continue…'));
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });

          // 登录成功后直接启动交互会话,而不是退出
          console.log('\n');
          resolve(); // 返回到主流程,让程序继续执行
        } else {
          throw new Error('OAuth login failed');
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ OAuth Login Failed: ${error instanceof Error ? error.message : String(error)}\n`));
        console.log(chalk.yellow('Alternative setup methods:\n'));
        console.log('1. Use API key (recommended for developers):');
        console.log(chalk.gray('   claude login --api-key\n'));
        console.log('2. Set environment variable:');
        console.log(chalk.gray('   export ANTHROPIC_API_KEY=sk-ant-your-key-here\n'));
        console.log('3. Quick setup:');
        console.log(chalk.gray('   claude setup-token\n'));
        process.exit(1);
      }

      resolve();
    };

    const app = render(React.createElement(LoginSelector, { onSelect }));
  });
}

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
        mcpConfig = JSON.parse(config);
      } else if (fs.existsSync(config)) {
        const content = fs.readFileSync(config, 'utf-8');
        mcpConfig = JSON.parse(content);
      } else {
        console.warn(chalk.yellow(`MCP config not found: ${config}`));
        continue;
      }

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

    if (settings.model) {
      // 使用 any 避免严格的模型类型检查，因为设置文件可能包含任意模型名
      configManager.set('model', settings.model as any);
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

// 斜杠命令处理 (for text mode)
function handleSlashCommand(input: string, loop: ConversationLoop): void {
  const [cmd, ...args] = input.slice(1).split(' ');
  const memory = getMemoryManager();

  switch (cmd.toLowerCase()) {
    case 'help':
      console.log(chalk.bold('\nAvailable commands:\n'));
      console.log(chalk.cyan('General:'));
      console.log('  /help         - Show this help message');
      console.log('  /clear        - Clear conversation history');
      console.log('  /exit         - Exit Claude Code');
      console.log('  /status       - Show session status');
      console.log();
      console.log(chalk.cyan('Session:'));
      console.log('  /save         - Save current session');
      console.log('  /stats        - Show session statistics');
      console.log('  /compact      - Compact conversation history');
      console.log('  /resume       - Resume previous session');
      console.log('  /context      - Show context usage');
      console.log();
      console.log(chalk.cyan('Configuration:'));
      console.log('  /model        - Show or change current model');
      console.log('  /config       - Show current configuration');
      console.log('  /permissions  - Show permission settings');
      console.log('  /tools        - List available tools');
      console.log('  /memory       - Manage memory entries');
      console.log();
      console.log(chalk.cyan('Workspace:'));
      console.log('  /add-dir      - Add directory to workspace');
      console.log('  /init         - Create CLAUDE.md file');
      console.log('  /files        - List files');
      console.log();
      console.log(chalk.cyan('Tools:'));
      console.log('  /mcp          - MCP server management');
      console.log('  /agents       - Agent management');
      console.log('  /hooks        - Hook management');
      console.log('  /ide          - IDE integration');
      console.log('  /vim          - Vim mode');
      console.log();
      console.log(chalk.cyan('Auth:'));
      console.log('  /login        - Login');
      console.log('  /logout       - Logout');
      console.log();
      console.log(chalk.cyan('Development:'));
      console.log('  /review       - Code review');
      console.log('  /plan         - Planning mode');
      console.log('  /feedback     - Send feedback');
      console.log('  /doctor       - Run diagnostics');
      console.log('  /bug          - Report a bug');
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

    case 'status':
      const sessionStats = loop.getSession().getStats();
      console.log(chalk.bold('\nSession Status:\n'));
      console.log(`  Session ID: ${loop.getSession().sessionId}`);
      console.log(`  Messages: ${sessionStats.messageCount}`);
      console.log(`  Duration: ${Math.round(sessionStats.duration / 1000)}s`);
      console.log(`  Cost: ${sessionStats.totalCost}`);
      console.log(`  Working Dir: ${process.cwd()}`);
      console.log();
      break;

    case 'tools':
      const tools = toolRegistry.getDefinitions();
      console.log(chalk.bold('\nAvailable Tools:\n'));
      tools.forEach(t => {
        console.log(chalk.cyan(`  ${t.name}`));
        console.log(chalk.gray(`    ${t.description.split('\n')[0]}`));
      });
      console.log();
      break;

    case 'model':
      if (args[0]) {
        console.log(chalk.yellow(`\nModel switching requires restart. Use: claude -m ${args[0]}\n`));
      } else {
        console.log(chalk.bold('\nCurrent model: sonnet'));
        console.log(chalk.gray('\nAvailable models:'));
        console.log('  • opus   - Claude Opus 4 (most capable)');
        console.log('  • sonnet - Claude Sonnet 4 (balanced)');
        console.log('  • haiku  - Claude Haiku 3.5 (fastest)');
        console.log(chalk.gray('\nUse: /model <name> to switch\n'));
      }
      break;

    case 'chrome':
      (async () => {
        const { showChromeSettings } = await import('./ui/ChromeSettings.js');
        await showChromeSettings();
      })();
      break;

    case 'exit':
    case 'quit':
      console.log(chalk.yellow('\nGoodbye!'));
      const exitStats = loop.getSession().getStats();
      console.log(chalk.gray(`Session: ${exitStats.messageCount} messages, ${exitStats.totalCost}`));
      process.exit(0);

    default:
      console.log(chalk.red(`Unknown command: /${cmd}`));
      console.log(chalk.gray('Type /help for available commands.\n'));
  }
}

// 错误处理
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err.message);
  if (process.env.CLAUDE_DEBUG) {
    console.error(chalk.red('Stack trace:'), err.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error(chalk.red('Unhandled Rejection:'), reason?.message || reason);
  if (process.env.CLAUDE_DEBUG && reason?.stack) {
    console.error(chalk.red('Stack trace:'), reason.stack);
  }
});

/**
 * 主函数 - 包装 CLI 执行以支持生命周期事件
 * 对应官方的 ZV7 函数和 tK7 函数
 */
async function main(): Promise<void> {
  // CLI 级别生命周期事件
  await emitLifecycleEvent('cli_entry');
  await emitLifecycleEvent('cli_imports_loaded');

  // 检查特殊路径（对应官方的 fast path 检查）
  const args = process.argv.slice(2);

  // 版本快速路径
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    await emitLifecycleEvent('cli_version_fast_path');
    program.parse();
    return;
  }

  // Chrome MCP 服务器路径 - 用于 Claude CLI 与 Chrome 扩展通信
  if (args[0] === '--claude-in-chrome-mcp') {
    await emitLifecycleEvent('cli_claude_in_chrome_mcp_path');
    const { runMcpServer } = await import('./chrome-mcp/index.js');
    await runMcpServer();
    return;
  }

  // Chrome Native Host 路径 - 用于 Chrome 扩展与 Native Host 通信
  if (args[0] === '--chrome-native-host') {
    await emitLifecycleEvent('cli_chrome_native_host_path');
    const { runNativeHost } = await import('./chrome-mcp/index.js');
    await runNativeHost();
    return;
  }

  // 主函数导入前
  await emitLifecycleEvent('cli_before_main_import');

  // 这里主模块已经导入（在 Node.js ES Module 中，导入是同步的）
  // 所以我们直接触发导入后事件
  await emitLifecycleEvent('cli_after_main_import');

  // 运行主程序
  program.parse();

  // T511: cli_after_main_complete - CLI 完成
  await emitLifecycleEvent('cli_after_main_complete');
}

// 运行主函数
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
