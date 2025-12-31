/**
 * 对话管理器
 * 封装核心对话逻辑，提供 WebUI 专用接口
 */

import { ClaudeClient } from '../../core/client.js';
import { Session } from '../../core/session.js';
import { toolRegistry } from '../../tools/index.js';
import { systemPromptBuilder } from '../../prompt/index.js';
import { modelConfig } from '../../models/index.js';
import type { Message, ContentBlock, ToolUseBlock, TextBlock } from '../../types/index.js';
import type { ChatMessage, ChatContent, ToolResultData } from '../shared/types.js';

/**
 * 流式回调接口
 */
export interface StreamCallbacks {
  onThinkingStart?: () => void;
  onThinkingDelta?: (text: string) => void;
  onThinkingComplete?: () => void;
  onTextDelta?: (text: string) => void;
  onToolUseStart?: (toolUseId: string, toolName: string, input: unknown) => void;
  onToolUseDelta?: (toolUseId: string, partialJson: string) => void;
  onToolResult?: (toolUseId: string, success: boolean, output?: string, error?: string, data?: ToolResultData) => void;
  onComplete?: (stopReason: string | null, usage?: { inputTokens: number; outputTokens: number }) => void;
  onError?: (error: Error) => void;
}

/**
 * 会话状态
 */
interface SessionState {
  session: Session;
  client: ClaudeClient;
  messages: Message[];
  model: string;
  cancelled: boolean;
  chatHistory: ChatMessage[];
}

/**
 * 对话管理器
 */
export class ConversationManager {
  private sessions = new Map<string, SessionState>();
  private cwd: string;
  private defaultModel: string;

  constructor(cwd: string, defaultModel: string = 'sonnet') {
    this.cwd = cwd;
    this.defaultModel = defaultModel;
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 确保工具已注册
    console.log(`[ConversationManager] 已注册 ${toolRegistry.getAll().length} 个工具`);
  }

  /**
   * 获取或创建会话
   */
  private async getOrCreateSession(sessionId: string, model?: string): Promise<SessionState> {
    let state = this.sessions.get(sessionId);

    if (!state) {
      const session = new Session(this.cwd);
      await session.initializeGitInfo();

      const client = new ClaudeClient({
        model: this.getModelId(model || this.defaultModel),
      });

      state = {
        session,
        client,
        messages: [],
        model: model || this.defaultModel,
        cancelled: false,
        chatHistory: [],
      };

      this.sessions.set(sessionId, state);
    }

    return state;
  }

  /**
   * 获取完整模型 ID
   */
  private getModelId(shortName: string): string {
    const modelMap: Record<string, string> = {
      opus: 'claude-opus-4-20250514',
      sonnet: 'claude-sonnet-4-20250514',
      haiku: 'claude-3-5-haiku-20241022',
    };
    return modelMap[shortName] || shortName;
  }

  /**
   * 设置模型
   */
  setModel(sessionId: string, model: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.model = model;
      state.client = new ClaudeClient({
        model: this.getModelId(model),
      });
    }
  }

  /**
   * 获取历史记录
   */
  getHistory(sessionId: string): ChatMessage[] {
    const state = this.sessions.get(sessionId);
    return state?.chatHistory || [];
  }

  /**
   * 清除历史
   */
  clearHistory(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.messages = [];
      state.chatHistory = [];
    }
  }

  /**
   * 取消当前操作
   */
  cancel(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.cancelled = true;
    }
  }

  /**
   * 发送聊天消息
   */
  async chat(
    sessionId: string,
    content: string,
    images: string[] | undefined,
    model: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const state = await this.getOrCreateSession(sessionId, model);
    state.cancelled = false;

    try {
      // 构建用户消息
      const userMessage: Message = {
        role: 'user',
        content: content,
      };

      // 如果有图片，转换为多内容块格式
      if (images && images.length > 0) {
        const contentBlocks: any[] = [{ type: 'text', text: content }];
        for (const imageData of images) {
          // 假设是 base64 格式
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageData,
            },
          });
        }
        userMessage.content = contentBlocks;
      }

      state.messages.push(userMessage);

      // 添加到聊天历史
      state.chatHistory.push({
        id: `user-${Date.now()}`,
        role: 'user',
        timestamp: Date.now(),
        content: [{ type: 'text', text: content }],
      });

      // 开始对话循环
      await this.conversationLoop(state, callbacks);

    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 对话循环
   */
  private async conversationLoop(
    state: SessionState,
    callbacks: StreamCallbacks
  ): Promise<void> {
    let continueLoop = true;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (continueLoop && !state.cancelled) {
      // 构建系统提示
      const systemPrompt = await this.buildSystemPrompt(state);

      // 获取工具定义（使用旧格式兼容 createMessageStream）
      const tools = toolRegistry.getAll().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.getInputSchema(),
      }));

      try {
        // 调用 Claude API（使用 createMessageStream）
        const stream = state.client.createMessageStream(
          state.messages,
          tools,
          systemPrompt
        );

        // 处理流式响应
        const assistantContent: ContentBlock[] = [];
        let currentTextContent = '';
        let currentToolUse: { id: string; name: string; inputJson: string } | null = null;
        let stopReason: string | null = null;
        let thinkingStarted = false;

        for await (const event of stream) {
          if (state.cancelled) break;

          switch (event.type) {
            case 'thinking':
              if (!thinkingStarted) {
                callbacks.onThinkingStart?.();
                thinkingStarted = true;
              }
              if (event.thinking) {
                callbacks.onThinkingDelta?.(event.thinking);
              }
              break;

            case 'text':
              if (thinkingStarted) {
                callbacks.onThinkingComplete?.();
                thinkingStarted = false;
              }
              if (event.text) {
                currentTextContent += event.text;
                callbacks.onTextDelta?.(event.text);
              }
              break;

            case 'tool_use_start':
              // 保存之前的文本内容
              if (currentTextContent) {
                assistantContent.push({ type: 'text', text: currentTextContent } as TextBlock);
                currentTextContent = '';
              }
              // 开始新的工具调用
              currentToolUse = {
                id: event.id || '',
                name: event.name || '',
                inputJson: '',
              };
              callbacks.onToolUseStart?.(currentToolUse.id, currentToolUse.name, {});
              break;

            case 'tool_use_delta':
              if (currentToolUse && event.input) {
                currentToolUse.inputJson += event.input;
                callbacks.onToolUseDelta?.(currentToolUse.id, event.input);
              }
              break;

            case 'stop':
              // 完成当前文本块
              if (currentTextContent) {
                assistantContent.push({ type: 'text', text: currentTextContent } as TextBlock);
                currentTextContent = '';
              }
              // 完成当前工具调用
              if (currentToolUse) {
                let parsedInput = {};
                try {
                  parsedInput = JSON.parse(currentToolUse.inputJson || '{}');
                } catch (e) {
                  // 解析失败使用空对象
                }
                assistantContent.push({
                  type: 'tool_use',
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: parsedInput,
                } as ToolUseBlock);
                currentToolUse = null;
              }
              stopReason = event.stopReason || null;
              break;

            case 'usage':
              if (event.usage) {
                totalInputTokens = event.usage.inputTokens || 0;
                totalOutputTokens = event.usage.outputTokens || 0;
              }
              break;

            case 'error':
              throw new Error(event.error || 'Unknown stream error');
          }
        }

        // 保存助手响应
        if (assistantContent.length > 0) {
          state.messages.push({
            role: 'assistant',
            content: assistantContent,
          });
        }

        // 处理工具调用
        const toolUseBlocks = assistantContent.filter(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length > 0 && stopReason === 'tool_use') {
          // 执行工具并收集结果
          const toolResults: any[] = [];

          for (const toolUse of toolUseBlocks) {
            if (state.cancelled) break;

            const result = await this.executeTool(toolUse, state, callbacks);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result.success ? result.output : `Error: ${result.error}`,
              is_error: !result.success,
            });
          }

          // 添加工具结果到消息
          if (toolResults.length > 0) {
            state.messages.push({
              role: 'user',
              content: toolResults,
            });
          }

          // 继续循环
          continueLoop = true;
        } else {
          // 对话结束
          continueLoop = false;

          // 添加到聊天历史
          const chatContent: ChatContent[] = assistantContent.map(block => {
            if (block.type === 'text') {
              return { type: 'text', text: (block as TextBlock).text };
            } else if (block.type === 'tool_use') {
              const toolBlock = block as ToolUseBlock;
              return {
                type: 'tool_use',
                id: toolBlock.id,
                name: toolBlock.name,
                input: toolBlock.input,
                status: 'completed' as const,
              };
            }
            return { type: 'text', text: '' };
          });

          state.chatHistory.push({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            timestamp: Date.now(),
            content: chatContent,
            model: state.model,
            usage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
            },
          });

          callbacks.onComplete?.(stopReason, {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          });
        }

      } catch (error) {
        console.error('[ConversationManager] API 错误:', error);
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
        continueLoop = false;
      }
    }
  }

  /**
   * 执行工具
   */
  private async executeTool(
    toolUse: ToolUseBlock,
    state: SessionState,
    callbacks: StreamCallbacks
  ): Promise<{ success: boolean; output?: string; error?: string; data?: ToolResultData }> {
    const tool = toolRegistry.get(toolUse.name);

    if (!tool) {
      const error = `未知工具: ${toolUse.name}`;
      callbacks.onToolResult?.(toolUse.id, false, undefined, error);
      return { success: false, error };
    }

    try {
      console.log(`[Tool] 执行 ${toolUse.name}:`, JSON.stringify(toolUse.input).slice(0, 200));

      // 执行工具
      const result = await tool.execute(toolUse.input);

      // 构建结构化数据
      const data = this.buildToolResultData(toolUse.name, toolUse.input, result);

      // 格式化输出
      let output: string;
      if (typeof result === 'string') {
        output = result;
      } else if (result && typeof result === 'object') {
        if ('output' in result) {
          output = result.output as string;
        } else if ('content' in result) {
          output = result.content as string;
        } else {
          output = JSON.stringify(result, null, 2);
        }
      } else {
        output = String(result);
      }

      // 截断过长输出
      const maxOutputLength = 50000;
      if (output.length > maxOutputLength) {
        output = output.slice(0, maxOutputLength) + '\n... (输出已截断)';
      }

      callbacks.onToolResult?.(toolUse.id, true, output, undefined, data);
      return { success: true, output, data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Tool] ${toolUse.name} 执行失败:`, errorMessage);
      callbacks.onToolResult?.(toolUse.id, false, undefined, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 构建工具结果的结构化数据
   */
  private buildToolResultData(
    toolName: string,
    input: unknown,
    result: unknown
  ): ToolResultData | undefined {
    const inputObj = input as Record<string, unknown>;

    switch (toolName) {
      case 'Bash':
        return {
          tool: 'Bash',
          command: (inputObj.command as string) || '',
          exitCode: (result as any)?.exitCode,
          stdout: (result as any)?.stdout || (result as any)?.output,
          stderr: (result as any)?.stderr,
          duration: (result as any)?.duration,
        };

      case 'Read':
        const content = typeof result === 'string' ? result : (result as any)?.content || '';
        return {
          tool: 'Read',
          filePath: (inputObj.file_path as string) || '',
          content: content.slice(0, 10000), // 限制长度
          lineCount: content.split('\n').length,
          language: this.detectLanguage((inputObj.file_path as string) || ''),
        };

      case 'Write':
        return {
          tool: 'Write',
          filePath: (inputObj.file_path as string) || '',
          bytesWritten: (inputObj.content as string)?.length || 0,
        };

      case 'Edit':
        return {
          tool: 'Edit',
          filePath: (inputObj.file_path as string) || '',
          diff: [], // 需要解析 diff
          linesAdded: 0,
          linesRemoved: 0,
        };

      case 'Glob':
        const files = Array.isArray(result) ? result :
          typeof result === 'string' ? result.split('\n').filter(Boolean) :
          (result as any)?.files || [];
        return {
          tool: 'Glob',
          pattern: (inputObj.pattern as string) || '',
          files: files.slice(0, 100),
          totalCount: files.length,
        };

      case 'Grep':
        return {
          tool: 'Grep',
          pattern: (inputObj.pattern as string) || '',
          matches: [],
          totalCount: 0,
        };

      case 'WebFetch':
        return {
          tool: 'WebFetch',
          url: (inputObj.url as string) || '',
          title: (result as any)?.title,
          contentPreview: typeof result === 'string' ? result.slice(0, 500) : undefined,
        };

      case 'WebSearch':
        return {
          tool: 'WebSearch',
          query: (inputObj.query as string) || '',
          results: (result as any)?.results || [],
        };

      case 'TodoWrite':
        return {
          tool: 'TodoWrite',
          todos: (inputObj.todos as any[]) || [],
        };

      case 'Task':
        return {
          tool: 'Task',
          agentType: (inputObj.subagent_type as string) || 'general-purpose',
          description: (inputObj.description as string) || '',
          status: 'completed',
          output: typeof result === 'string' ? result : JSON.stringify(result),
        };

      default:
        return undefined;
    }
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      sql: 'sql',
      md: 'markdown',
      txt: 'text',
    };
    return langMap[ext || ''] || 'text';
  }

  /**
   * 构建系统提示
   */
  private async buildSystemPrompt(state: SessionState): Promise<string> {
    const gitInfo = state.session.getGitInfo();

    const context = {
      cwd: state.session.cwd,
      platform: process.platform,
      date: new Date().toISOString().split('T')[0],
      gitBranch: gitInfo?.branchName,
      gitStatus: state.session.getFormattedGitStatus(),
    };

    // 使用简化的系统提示
    let prompt = `You are Claude, an AI assistant created by Anthropic to help with programming tasks.

## Environment
- Working Directory: ${context.cwd}
- Platform: ${context.platform}
- Date: ${context.date}`;

    if (context.gitBranch) {
      prompt += `\n- Git Branch: ${context.gitBranch}`;
    }

    prompt += `

## Guidelines
1. Use the available tools to help users with their tasks
2. Read files before editing them
3. Be concise and helpful
4. When using Bash, quote paths with spaces
5. Use appropriate tools for each task:
   - Read/Write/Edit for file operations
   - Glob/Grep for searching
   - Bash for system commands
   - Task for complex multi-step operations
   - TodoWrite for tracking progress

## Available Tools
You have access to the following tools:
${toolRegistry.getAll().map(t => `- ${t.name}: ${t.description.slice(0, 100)}...`).join('\n')}

Respond in Chinese when the user writes in Chinese.`;

    return prompt;
  }
}
