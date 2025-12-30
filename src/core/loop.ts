/**
 * 主对话循环
 * 处理用户输入、工具调用和响应
 */

import { ClaudeClient, type ClientConfig } from './client.js';
import { Session } from './session.js';
import { toolRegistry } from '../tools/index.js';
import type { Message, ContentBlock, ToolDefinition, PermissionMode } from '../types/index.js';
import chalk from 'chalk';
import {
  SystemPromptBuilder,
  systemPromptBuilder,
  type PromptContext,
  type SystemPromptOptions,
} from '../prompt/index.js';
import { modelConfig, type ThinkingConfig } from '../models/index.js';
import { initAuth, getAuth, ensureOAuthApiKey } from '../auth/index.js';
import { runPermissionRequestHooks } from '../hooks/index.js';
import * as readline from 'readline';

// ============================================================================
// 持久化输出常量
// ============================================================================

/** 持久化输出起始标签 */
const PERSISTED_OUTPUT_START = '<persisted-output>';

/** 持久化输出结束标签 */
const PERSISTED_OUTPUT_END = '</persisted-output>';

/** 最大输出行数限制 */
const MAX_OUTPUT_LINES = 2000;

/** 输出阈值（字符数），超过此值使用持久化标签 */
const OUTPUT_THRESHOLD = 50000;

/** 预览大小（字节） */
const PREVIEW_SIZE = 2000000; // 2MB

// ============================================================================
// 工具结果处理辅助函数
// ============================================================================

/**
 * 截断输出到指定行数
 * @param content 原始内容
 * @returns 截断后的内容
 */
function truncateOutput(content: string): string {
  const lines = content.split('\n');
  if (lines.length > MAX_OUTPUT_LINES) {
    const truncated = lines.slice(0, MAX_OUTPUT_LINES).join('\n');
    const remaining = lines.length - MAX_OUTPUT_LINES;
    return `${truncated}\n... (${remaining} more lines truncated)`;
  }
  return content;
}

/**
 * 使用持久化标签包装大型输出
 * @param content 输出内容
 * @param toolName 工具名称
 * @returns 包装后的内容
 */
function wrapPersistedOutput(content: string, toolName: string): string {
  // 如果输出超过阈值，使用持久化标签包装
  if (content.length > OUTPUT_THRESHOLD) {
    return `${PERSISTED_OUTPUT_START}\n${content}\n${PERSISTED_OUTPUT_END}`;
  }
  return content;
}

/**
 * 格式化工具结果
 * @param toolName 工具名称
 * @param result 工具执行结果
 * @returns 格式化后的内容
 */
function formatToolResult(
  toolName: string,
  result: { success: boolean; output?: string; error?: string }
): string {
  let content: string;

  if (!result.success) {
    content = `Error: ${result.error}`;
  } else {
    content = result.output || '';
  }

  // 先截断到最大行数
  content = truncateOutput(content);

  // 对于特定工具，应用特殊处理
  switch (toolName) {
    case 'Read':
      // 图片和二进制文件已经在工具内部处理
      // 这里只处理文本输出
      break;

    case 'Bash':
      // Bash 输出可能非常大，使用持久化
      content = wrapPersistedOutput(content, toolName);
      break;

    case 'Grep':
      // Grep 输出可能很长，使用持久化
      content = wrapPersistedOutput(content, toolName);
      break;

    case 'Glob':
      // 文件列表可能很长
      content = wrapPersistedOutput(content, toolName);
      break;

    default:
      // 对于其他工具，根据大小决定是否持久化
      content = wrapPersistedOutput(content, toolName);
      break;
  }

  return content;
}

/**
 * 清理消息历史中的旧持久化输出
 * 保留最近的 N 个持久化输出，清理更早的
 * @param messages 消息列表
 * @param keepRecent 保留最近的数量（默认 3）
 * @returns 清理后的消息列表
 */
function cleanOldPersistedOutputs(messages: Message[], keepRecent: number = 3): Message[] {
  const persistedOutputIndices: number[] = [];

  // 找到所有包含持久化输出的消息索引
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (
          typeof block === 'object' &&
          'type' in block &&
          block.type === 'tool_result' &&
          typeof block.content === 'string' &&
          block.content.includes(PERSISTED_OUTPUT_START)
        ) {
          persistedOutputIndices.push(i);
          break;
        }
      }
    }
  }

  // 如果持久化输出数量超过限制，清理旧的
  if (persistedOutputIndices.length > keepRecent) {
    const indicesToClean = persistedOutputIndices.slice(0, -keepRecent);

    return messages.map((msg, index) => {
      if (!indicesToClean.includes(index)) {
        return msg;
      }

      // 清理这条消息中的持久化标签
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((block) => {
            if (
              typeof block === 'object' &&
              'type' in block &&
              block.type === 'tool_result' &&
              typeof block.content === 'string'
            ) {
              // 移除持久化标签，只保留简要信息
              let content = block.content;
              if (content.includes(PERSISTED_OUTPUT_START)) {
                const start = content.indexOf(PERSISTED_OUTPUT_START);
                const end = content.indexOf(PERSISTED_OUTPUT_END);
                if (start !== -1 && end !== -1) {
                  const persistedContent = content.substring(
                    start + PERSISTED_OUTPUT_START.length,
                    end
                  );
                  const lines = persistedContent.trim().split('\n');
                  const preview = lines.slice(0, 10).join('\n');
                  content = `[Previous output truncated - ${lines.length} lines]\n${preview}\n...`;
                }
              }
              return { ...block, content };
            }
            return block;
          }),
        };
      }

      return msg;
    });
  }

  return messages;
}

export interface LoopOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  verbose?: boolean;
  maxTurns?: number;
  // 权限模式
  permissionMode?: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  dangerouslySkipPermissions?: boolean;
  maxBudgetUSD?: number;
  // 新增选项
  workingDir?: string;
  planMode?: boolean;
  delegateMode?: boolean;
  ideType?: 'vscode' | 'cursor' | 'windsurf' | 'zed' | 'terminal';
  fallbackModel?: string;
  thinking?: ThinkingConfig;
  debug?: boolean;
}

export class ConversationLoop {
  private client: ClaudeClient;
  private session: Session;
  private options: LoopOptions;
  private tools: ToolDefinition[];
  private totalCostUSD: number = 0;
  private promptBuilder: SystemPromptBuilder;
  private promptContext: PromptContext;

  /**
   * 处理权限请求（询问用户是否允许工具执行）
   * @param toolName 工具名称
   * @param toolInput 工具输入
   * @param message 权限请求消息
   * @returns 是否批准执行
   */
  private async handlePermissionRequest(
    toolName: string,
    toolInput: unknown,
    message?: string
  ): Promise<boolean> {
    // 1. 触发 PermissionRequest Hooks
    const hookResult = await runPermissionRequestHooks(
      toolName,
      toolInput,
      this.session.sessionId
    );

    // 如果 hook 返回了决策，使用 hook 的决策
    if (hookResult.decision === 'allow') {
      if (this.options.verbose) {
        console.log(chalk.green(`[Permission] Allowed by hook: ${hookResult.message || 'No reason provided'}`));
      }
      return true;
    } else if (hookResult.decision === 'deny') {
      if (this.options.verbose) {
        console.log(chalk.red(`[Permission] Denied by hook: ${hookResult.message || 'No reason provided'}`));
      }
      return false;
    }

    // 2. 检查权限模式
    if (this.options.permissionMode === 'bypassPermissions' || this.options.dangerouslySkipPermissions) {
      if (this.options.verbose) {
        console.log(chalk.yellow('[Permission] Bypassed due to permission mode'));
      }
      return true;
    }

    if (this.options.permissionMode === 'dontAsk') {
      // dontAsk 模式：自动拒绝需要询问的操作
      if (this.options.verbose) {
        console.log(chalk.red('[Permission] Auto-denied in dontAsk mode'));
      }
      return false;
    }

    // 3. 显示权限请求对话框
    console.log(chalk.yellow('\n┌─────────────────────────────────────────┐'));
    console.log(chalk.yellow('│          Permission Request             │'));
    console.log(chalk.yellow('├─────────────────────────────────────────┤'));
    console.log(chalk.yellow(`│ Tool: ${toolName.padEnd(33)}│`));
    if (message) {
      const displayMessage = message.length > 33 ? message.slice(0, 30) + '...' : message;
      console.log(chalk.yellow(`│ Reason: ${displayMessage.padEnd(31)}│`));
    }
    if (toolInput && typeof toolInput === 'object') {
      const inputStr = JSON.stringify(toolInput).slice(0, 30);
      console.log(chalk.yellow(`│ Input: ${inputStr.padEnd(32)}│`));
    }
    console.log(chalk.yellow('└─────────────────────────────────────────┘'));
    console.log('\nOptions:');
    console.log('  [y] Yes, allow once');
    console.log('  [n] No, deny');
    console.log('  [a] Always allow for this session');

    // 4. 等待用户输入
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('\nYour choice [y/n/a]: ', (answer) => {
        rl.close();

        const choice = answer.trim().toLowerCase();

        switch (choice) {
          case 'y':
            console.log(chalk.green('✓ Permission granted for this request'));
            resolve(true);
            break;

          case 'a':
            console.log(chalk.green('✓ Permission granted for all requests in this session'));
            // TODO: 实现会话级权限记忆
            resolve(true);
            break;

          case 'n':
          default:
            console.log(chalk.red('✗ Permission denied'));
            resolve(false);
            break;
        }
      });
    });
  }

  constructor(options: LoopOptions = {}) {
    // 解析模型别名
    const resolvedModel = modelConfig.resolveAlias(options.model || 'sonnet');

    // 初始化认证并获取凭据
    initAuth();
    const auth = getAuth();

    // 构建 ClaudeClient 配置
    const clientConfig: ClientConfig = {
      model: resolvedModel,
      maxTokens: options.maxTokens,
      fallbackModel: options.fallbackModel,
      thinking: options.thinking,
      debug: options.debug,
    };

    // 根据认证类型设置凭据
    if (auth) {
      if (auth.type === 'api_key' && auth.apiKey) {
        clientConfig.apiKey = auth.apiKey;
      } else if (auth.type === 'oauth') {
        // 检查是否有 user:inference scope (Claude.ai 订阅用户)
        // 注意：auth.scopes 是数组形式，auth.scope 是旧格式
        const scopes = auth.scopes || auth.scope || [];
        const hasInferenceScope = scopes.includes('user:inference');

        // 获取 OAuth token（可能是 authToken 或 accessToken）
        const oauthToken = auth.authToken || auth.accessToken;

        if (hasInferenceScope && oauthToken) {
          // Claude.ai 订阅用户可以直接使用 OAuth token
          clientConfig.authToken = oauthToken;
        } else if (auth.oauthApiKey) {
          // Console 用户使用创建的 API Key
          clientConfig.apiKey = auth.oauthApiKey;
        }
        // 如果两者都没有，ensureAuthenticated() 会处理
      }
    }

    this.client = new ClaudeClient(clientConfig);

    this.session = new Session();
    this.options = options;
    this.promptBuilder = systemPromptBuilder;

    // 初始化提示词上下文
    this.promptContext = {
      workingDir: options.workingDir || process.cwd(),
      model: resolvedModel,
      permissionMode: options.permissionMode,
      planMode: options.planMode,
      delegateMode: options.delegateMode,
      ideType: options.ideType,
      platform: process.platform,
      todayDate: new Date().toISOString().split('T')[0],
      isGitRepo: this.checkIsGitRepo(options.workingDir || process.cwd()),
      debug: options.debug,
    };

    // 获取并过滤工具
    let tools = toolRegistry.getDefinitions();

    // 应用工具过滤
    if (options.allowedTools && options.allowedTools.length > 0) {
      const allowed = new Set(options.allowedTools.flatMap(t => t.split(',')).map(t => t.trim()));
      tools = tools.filter(t => allowed.has(t.name));
    }

    if (options.disallowedTools && options.disallowedTools.length > 0) {
      const disallowed = new Set(options.disallowedTools.flatMap(t => t.split(',')).map(t => t.trim()));
      tools = tools.filter(t => !disallowed.has(t.name));
    }

    this.tools = tools;
  }

  /**
   * 重新初始化客户端（登录后调用）
   * 从当前认证状态重新创建 ClaudeClient
   */
  reinitializeClient(): boolean {
    // 重新初始化认证
    initAuth();
    const auth = getAuth();

    if (!auth) {
      console.warn('[Loop] No auth found after reinitialization');
      return false;
    }

    const resolvedModel = modelConfig.resolveAlias(this.options.model || 'sonnet');

    // 构建 ClaudeClient 配置
    const clientConfig: ClientConfig = {
      model: resolvedModel,
      maxTokens: this.options.maxTokens,
      fallbackModel: this.options.fallbackModel,
      thinking: this.options.thinking,
      debug: this.options.debug,
    };

    // 根据认证类型设置凭据
    if (auth.type === 'api_key' && auth.apiKey) {
      clientConfig.apiKey = auth.apiKey;
    } else if (auth.type === 'oauth') {
      // 检查是否有 user:inference scope (Claude.ai 订阅用户)
      const hasInferenceScope = auth.scope?.includes('user:inference');

      if (hasInferenceScope && auth.accessToken) {
        // Claude.ai 订阅用户可以直接使用 OAuth token
        clientConfig.authToken = auth.accessToken;
      } else if (auth.oauthApiKey) {
        // 使用创建的 OAuth API Key
        clientConfig.apiKey = auth.oauthApiKey;
      } else {
        console.warn('[Loop] OAuth auth without valid credentials');
        return false;
      }
    }

    // 重新创建客户端
    this.client = new ClaudeClient(clientConfig);
    console.log('[Loop] Client reinitialized with new credentials');
    return true;
  }

  /**
   * 确保认证已完成（处理 OAuth API Key 创建）
   * 在发送第一条消息前调用
   */
  async ensureAuthenticated(): Promise<boolean> {
    const auth = getAuth();

    if (!auth) {
      return false;
    }

    if (auth.type === 'api_key') {
      return !!auth.apiKey;
    }

    if (auth.type === 'oauth') {
      // 检查是否有 user:inference scope (Claude.ai 订阅用户)
      const hasInferenceScope = auth.scope?.includes('user:inference');

      if (hasInferenceScope) {
        // Claude.ai 订阅用户：尝试使用 authToken
        // 注意：Anthropic 服务器可能会限制非官方客户端使用 OAuth token
        if (auth.accessToken) {
          return true;
        }
        console.warn('[Auth] OAuth access token not found');
        return false;
      }

      // Console 用户需要创建 OAuth API Key
      const apiKey = await ensureOAuthApiKey();
      if (apiKey) {
        // 重新创建客户端使用新的 API Key
        const resolvedModel = modelConfig.resolveAlias(this.options.model || 'sonnet');
        this.client = new ClaudeClient({
          model: resolvedModel,
          maxTokens: this.options.maxTokens,
          fallbackModel: this.options.fallbackModel,
          thinking: this.options.thinking,
          debug: this.options.debug,
          apiKey: apiKey,
        });
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * 检查是否为 Git 仓库
   */
  private checkIsGitRepo(dir: string): boolean {
    try {
      const fs = require('fs');
      const path = require('path');
      let currentDir = dir;
      while (currentDir !== path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, '.git'))) {
          return true;
        }
        currentDir = path.dirname(currentDir);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 更新提示词上下文
   */
  updateContext(updates: Partial<PromptContext>): void {
    this.promptContext = { ...this.promptContext, ...updates };
  }

  async processMessage(userInput: string): Promise<string> {
    // 确保认证已完成（处理 OAuth API Key 创建）
    await this.ensureAuthenticated();

    // 添加用户消息
    this.session.addMessage({
      role: 'user',
      content: userInput,
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 50;
    let finalResponse = '';

    // 构建系统提示词
    let systemPrompt: string;
    if (this.options.systemPrompt) {
      // 如果提供了自定义系统提示词，直接使用
      systemPrompt = this.options.systemPrompt;
    } else {
      // 使用动态构建器生成
      try {
        const buildResult = await this.promptBuilder.build(this.promptContext);
        systemPrompt = buildResult.content;

        if (this.options.verbose) {
          console.log(chalk.gray(`[SystemPrompt] Built in ${buildResult.buildTimeMs}ms, ${buildResult.hashInfo.estimatedTokens} tokens`));
        }
      } catch (error) {
        console.warn('Failed to build system prompt, using default:', error);
        systemPrompt = this.getDefaultSystemPrompt();
      }
    }

    while (turns < maxTurns) {
      turns++;

      // 在发送请求前清理旧的持久化输出
      const messages = this.session.getMessages();
      const cleanedMessages = cleanOldPersistedOutputs(messages, 3);

      let response;
      try {
        response = await this.client.createMessage(
          cleanedMessages,
          this.tools,
          systemPrompt,
          {
            enableThinking: this.options.thinking?.enabled,
            thinkingBudget: this.options.thinking?.budgetTokens,
          }
        );
      } catch (apiError: any) {
        console.error(chalk.red(`[Loop] API call failed: ${apiError.message}`));
        if (this.options.debug || this.options.verbose) {
          console.error(chalk.red('[Loop] Full error:'), apiError);
        }
        throw apiError;
      }

      // 处理 Extended Thinking 结果
      if (response.thinking) {
        if (this.options.thinking?.showThinking || this.options.verbose) {
          console.log(chalk.gray('\n[Extended Thinking]'));
          console.log(chalk.gray(response.thinking.thinking));
          console.log(chalk.gray(`[Thinking tokens: ${response.thinking.thinkingTokens}, time: ${response.thinking.thinkingTimeMs}ms]`));
        }
      }

      // 处理响应内容
      const assistantContent: ContentBlock[] = [];
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantContent.push(block);
          finalResponse += block.text || '';
          if (this.options.verbose) {
            process.stdout.write(block.text || '');
          }
        } else if (block.type === 'tool_use') {
          assistantContent.push(block);

          // 执行工具
          const toolName = block.name || '';
          const toolInput = block.input || {};
          const toolId = block.id || '';

          if (this.options.verbose) {
            console.log(chalk.cyan(`\n[Tool: ${toolName}]`));
          }

          // 执行工具（带权限检查和回调）
          const result = await toolRegistry.execute(
            toolName,
            toolInput,
            // 权限请求回调函数
            async (name, input, message) => {
              return await this.handlePermissionRequest(name, input, message);
            }
          );

          if (this.options.verbose) {
            console.log(chalk.gray(result.output || result.error || ''));
          }

          // 使用格式化函数处理工具结果
          const formattedContent = formatToolResult(toolName, result);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolId,
            content: formattedContent,
          });
        }
      }

      // 添加助手消息
      this.session.addMessage({
        role: 'assistant',
        content: assistantContent,
      });

      // 如果有工具调用，添加结果并继续
      if (toolResults.length > 0) {
        this.session.addMessage({
          role: 'user',
          content: toolResults,
        });
      }

      // 检查是否应该停止
      if (response.stopReason === 'end_turn' && toolResults.length === 0) {
        break;
      }

      // 更新使用统计
      const resolvedModel = modelConfig.resolveAlias(this.options.model || 'sonnet');
      this.session.updateUsage(
        resolvedModel,
        {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          cacheReadInputTokens: response.usage.cacheReadTokens || 0,
          cacheCreationInputTokens: response.usage.cacheCreationTokens || 0,
          webSearchRequests: 0,
        },
        modelConfig.calculateCost(resolvedModel, {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          cacheReadTokens: response.usage.cacheReadTokens,
          cacheCreationTokens: response.usage.cacheCreationTokens,
          thinkingTokens: response.usage.thinkingTokens,
        }),
        0,
        0
      );
    }

    // 自动保存会话
    this.autoSave();

    return finalResponse;
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return `You are Claude, an AI assistant made by Anthropic. You are an expert software engineer.

You have access to tools to help complete tasks. Use them as needed.

Guidelines:
- Be concise and direct
- Use tools to gather information before answering
- Prefer editing existing files over creating new ones
- Always verify your work`;
  }

  // 自动保存会话
  private autoSave(): void {
    try {
      this.session.save();
    } catch (err) {
      // 静默失败，不影响对话
      if (this.options.verbose) {
        console.error('Failed to auto-save session:', err);
      }
    }
  }

  async *processMessageStream(userInput: string): AsyncGenerator<{
    type: 'text' | 'tool_start' | 'tool_end' | 'done';
    content?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: string;
    toolError?: string;
  }> {
    // 确保认证已完成（处理 OAuth API Key 创建）
    await this.ensureAuthenticated();

    this.session.addMessage({
      role: 'user',
      content: userInput,
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 50;

    // 构建系统提示词
    let systemPrompt: string;
    if (this.options.systemPrompt) {
      systemPrompt = this.options.systemPrompt;
    } else {
      try {
        const buildResult = await this.promptBuilder.build(this.promptContext);
        systemPrompt = buildResult.content;
      } catch {
        systemPrompt = this.getDefaultSystemPrompt();
      }
    }

    while (turns < maxTurns) {
      turns++;

      // 在发送请求前清理旧的持久化输出
      const messages = this.session.getMessages();
      const cleanedMessages = cleanOldPersistedOutputs(messages, 3);

      const assistantContent: ContentBlock[] = [];
      const toolCalls: Map<string, { name: string; input: string }> = new Map();
      let currentToolId = '';

      try {
        for await (const event of this.client.createMessageStream(
          cleanedMessages,
          this.tools,
          systemPrompt,
          {
            enableThinking: this.options.thinking?.enabled,
            thinkingBudget: this.options.thinking?.budgetTokens,
          }
        )) {
          if (event.type === 'text') {
            yield { type: 'text', content: event.text };
            assistantContent.push({ type: 'text', text: event.text });
          } else if (event.type === 'thinking') {
            // Extended Thinking content - can be yielded or logged
            if (this.options.thinking?.showThinking || this.options.verbose) {
              yield { type: 'text', content: `[Thinking: ${event.thinking}]` };
            }
          } else if (event.type === 'tool_use_start') {
            currentToolId = event.id || '';
            toolCalls.set(currentToolId, { name: event.name || '', input: '' });
            yield { type: 'tool_start', toolName: event.name, toolInput: undefined };
          } else if (event.type === 'tool_use_delta') {
            const tool = toolCalls.get(currentToolId);
            if (tool) {
              tool.input += event.input || '';
            }
          } else if (event.type === 'error') {
            console.error(chalk.red(`[Loop] Stream error: ${event.error}`));
            yield { type: 'tool_end', toolError: event.error };
            break;
          }
        }
      } catch (streamError: any) {
        console.error(chalk.red(`[Loop] Stream failed: ${streamError.message}`));
        if (this.options.debug) {
          console.error(chalk.red('[Loop] Full error:'), streamError);
        }
        yield { type: 'tool_end', toolError: streamError.message };
        break;
      }

      // 执行所有工具调用
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const [id, tool] of toolCalls) {
        try {
          const input = JSON.parse(tool.input || '{}');

          // 执行工具（带权限检查和回调）
          const result = await toolRegistry.execute(
            tool.name,
            input,
            // 权限请求回调函数
            async (name, toolInput, message) => {
              return await this.handlePermissionRequest(name, toolInput, message);
            }
          );

          yield {
            type: 'tool_end',
            toolName: tool.name,
            toolInput: input,
            toolResult: result.success ? result.output : undefined,
            toolError: result.success ? undefined : result.error,
          };

          assistantContent.push({
            type: 'tool_use',
            id,
            name: tool.name,
            input,
          });

          // 使用格式化函数处理工具结果
          const formattedContent = formatToolResult(tool.name, result);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            content: formattedContent,
          });
        } catch (err) {
          yield {
            type: 'tool_end',
            toolName: tool.name,
            toolInput: undefined,
            toolResult: undefined,
            toolError: `Parse error: ${err}`,
          };
        }
      }

      this.session.addMessage({
        role: 'assistant',
        content: assistantContent,
      });

      if (toolResults.length > 0) {
        this.session.addMessage({
          role: 'user',
          content: toolResults,
        });
      } else {
        break;
      }
    }

    // 自动保存会话
    this.autoSave();

    yield { type: 'done' };
  }

  getSession(): Session {
    return this.session;
  }

  setSession(session: Session): void {
    this.session = session;
  }
}
