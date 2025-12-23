/**
 * 主对话循环
 * 处理用户输入、工具调用和响应
 */

import { ClaudeClient } from './client.js';
import { Session } from './session.js';
import { toolRegistry } from '../tools/index.js';
import type { Message, ContentBlock, ToolDefinition, PermissionMode } from '../types/index.js';
import chalk from 'chalk';

export interface LoopOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  verbose?: boolean;
  maxTurns?: number;
  // 新增选项
  permissionMode?: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  dangerouslySkipPermissions?: boolean;
  maxBudgetUSD?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are Claude, an AI assistant made by Anthropic. You are an expert software engineer.

You have access to tools to help complete tasks. Use them as needed.

Guidelines:
- Be concise and direct
- Use tools to gather information before answering
- Prefer editing existing files over creating new ones
- Always verify your work`;

export class ConversationLoop {
  private client: ClaudeClient;
  private session: Session;
  private options: LoopOptions;
  private tools: ToolDefinition[];
  private totalCostUSD: number = 0;

  constructor(options: LoopOptions = {}) {
    this.client = new ClaudeClient({
      model: options.model,
      maxTokens: options.maxTokens,
    });
    this.session = new Session();
    this.options = options;

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

  async processMessage(userInput: string): Promise<string> {
    // 添加用户消息
    this.session.addMessage({
      role: 'user',
      content: userInput,
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 50;
    let finalResponse = '';

    while (turns < maxTurns) {
      turns++;

      const response = await this.client.createMessage(
        this.session.getMessages(),
        this.tools,
        this.options.systemPrompt || DEFAULT_SYSTEM_PROMPT
      );

      // 处理响应内容
      const assistantContent: ContentBlock[] = [];
      const toolResults: ContentBlock[] = [];

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

          const result = await toolRegistry.execute(toolName, toolInput);

          if (this.options.verbose) {
            console.log(chalk.gray(result.output || result.error || ''));
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolId,
            content: result.success ? (result.output || '') : `Error: ${result.error}`,
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
      this.session.updateUsage(
        this.options.model || 'claude-sonnet-4-20250514',
        response.usage.inputTokens + response.usage.outputTokens,
        0, // 成本计算需要模型价格
        0
      );
    }

    return finalResponse;
  }

  async *processMessageStream(userInput: string): AsyncGenerator<{
    type: 'text' | 'tool_start' | 'tool_end' | 'done';
    content?: string;
    toolName?: string;
    toolResult?: string;
  }> {
    this.session.addMessage({
      role: 'user',
      content: userInput,
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 50;

    while (turns < maxTurns) {
      turns++;

      const assistantContent: ContentBlock[] = [];
      const toolCalls: Map<string, { name: string; input: string }> = new Map();
      let currentToolId = '';

      for await (const event of this.client.createMessageStream(
        this.session.getMessages(),
        this.tools,
        this.options.systemPrompt || DEFAULT_SYSTEM_PROMPT
      )) {
        if (event.type === 'text') {
          yield { type: 'text', content: event.text };
          assistantContent.push({ type: 'text', text: event.text });
        } else if (event.type === 'tool_use_start') {
          currentToolId = event.id || '';
          toolCalls.set(currentToolId, { name: event.name || '', input: '' });
          yield { type: 'tool_start', toolName: event.name };
        } else if (event.type === 'tool_use_delta') {
          const tool = toolCalls.get(currentToolId);
          if (tool) {
            tool.input += event.input || '';
          }
        }
      }

      // 执行所有工具调用
      const toolResults: ContentBlock[] = [];

      for (const [id, tool] of toolCalls) {
        try {
          const input = JSON.parse(tool.input || '{}');
          const result = await toolRegistry.execute(tool.name, input);

          yield {
            type: 'tool_end',
            toolName: tool.name,
            toolResult: result.output || result.error,
          };

          assistantContent.push({
            type: 'tool_use',
            id,
            name: tool.name,
            input,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            content: result.success ? (result.output || '') : `Error: ${result.error}`,
          });
        } catch (err) {
          yield {
            type: 'tool_end',
            toolName: tool.name,
            toolResult: `Parse error: ${err}`,
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

    yield { type: 'done' };
  }

  getSession(): Session {
    return this.session;
  }

  setSession(session: Session): void {
    this.session = session;
  }
}
