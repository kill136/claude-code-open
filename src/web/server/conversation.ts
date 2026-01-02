/**
 * 对话管理器
 * 封装核心对话逻辑，提供 WebUI 专用接口
 */

import { ClaudeClient } from '../../core/client.js';
import { Session } from '../../core/session.js';
import { toolRegistry } from '../../tools/index.js';
import { systemPromptBuilder } from '../../prompt/index.js';
import { modelConfig } from '../../models/index.js';
import { initAuth, getAuth } from '../../auth/index.js';
import type { Message, ContentBlock, ToolUseBlock, TextBlock } from '../../types/index.js';
import type { ChatMessage, ChatContent, ToolResultData, PermissionConfigPayload, PermissionRequestPayload, SystemPromptConfig, SystemPromptGetPayload } from '../shared/types.js';
import { UserInteractionHandler } from './user-interaction.js';
import type { WebSocket } from 'ws';
import { WebSessionManager, type WebSessionData } from './session-manager.js';
import type { SessionMetadata, SessionListOptions } from '../../session/index.js';
import { TaskManager } from './task-manager.js';
import { McpConfigManager } from '../../mcp/config.js';
import type { ExtendedMcpServerConfig } from '../../mcp/config.js';

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
  onPermissionRequest?: (request: any) => void;
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
  userInteractionHandler: UserInteractionHandler;
  taskManager: TaskManager;
  ws?: WebSocket;
  toolFilterConfig: import('../shared/types.js').ToolFilterConfig;
  systemPromptConfig: SystemPromptConfig;
}

/**
 * 对话管理器
 */
export class ConversationManager {
  private sessions = new Map<string, SessionState>();
  private sessionManager: WebSessionManager;
  private cwd: string;
  private defaultModel: string;
  private mcpConfigManager: McpConfigManager;

  constructor(cwd: string, defaultModel: string = 'sonnet') {
    this.cwd = cwd;
    this.defaultModel = defaultModel;
    this.sessionManager = new WebSessionManager(cwd);
    this.mcpConfigManager = new McpConfigManager({
      validateCommands: true,
      autoSave: true,
    });
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 初始化认证系统（加载 OAuth token 或 API key）
    const auth = initAuth();
    if (auth) {
      console.log(`[ConversationManager] 认证类型: ${auth.type}${auth.accountType ? ` (${auth.accountType})` : ''}`);
    } else {
      console.warn('[ConversationManager] 警告: 未找到认证信息，请先运行 /login 登录');
    }

    // 确保工具已注册
    console.log(`[ConversationManager] 已注册 ${toolRegistry.getAll().length} 个工具`);
  }

  /**
   * 根据认证信息构建 ClaudeClient 配置
   * 与核心 loop.ts 逻辑保持一致
   */
  private buildClientConfig(model: string): { model: string; apiKey?: string; authToken?: string } {
    const auth = getAuth();
    const config: { model: string; apiKey?: string; authToken?: string } = {
      model: this.getModelId(model),
    };

    if (auth) {
      if (auth.type === 'api_key' && auth.apiKey) {
        config.apiKey = auth.apiKey;
      } else if (auth.type === 'oauth') {
        // 检查是否有 user:inference scope (Claude.ai 订阅用户)
        // 注意：auth.scopes 是数组形式，auth.scope 是旧格式
        const scopes = auth.scopes || auth.scope || [];
        const hasInferenceScope = scopes.includes('user:inference');

        // 获取 OAuth token（可能是 authToken 或 accessToken）
        const oauthToken = auth.authToken || auth.accessToken;

        if (hasInferenceScope && oauthToken) {
          // Claude.ai 订阅用户可以直接使用 OAuth token
          config.authToken = oauthToken;
        } else if (auth.oauthApiKey) {
          // Console 用户使用创建的 API Key
          config.apiKey = auth.oauthApiKey;
        }
      }
    }

    return config;
  }

  /**
   * 获取或创建会话
   */
  private async getOrCreateSession(sessionId: string, model?: string): Promise<SessionState> {
    let state = this.sessions.get(sessionId);

    if (!state) {
      const session = new Session(this.cwd);
      await session.initializeGitInfo();

      // 使用与核心 loop.ts 一致的认证逻辑
      const clientConfig = this.buildClientConfig(model || this.defaultModel);
      const client = new ClaudeClient(clientConfig);

      // 创建用户交互处理器
      const userInteractionHandler = new UserInteractionHandler();

      // 创建任务管理器
      const taskManager = new TaskManager();

      state = {
        session,
        client,
        messages: [],
        model: model || this.defaultModel,
        cancelled: false,
        chatHistory: [],
        userInteractionHandler,
        taskManager,
        toolFilterConfig: {
          mode: 'all', // 默认允许所有工具
        },
        systemPromptConfig: {
          useDefault: true, // 默认使用默认提示
        },
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
      // 使用与核心 loop.ts 一致的认证逻辑
      const clientConfig = this.buildClientConfig(model);
      state.client = new ClaudeClient(clientConfig);
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
      // 取消所有待处理的用户问题
      state.userInteractionHandler?.cancelAll();
    }
  }

  /**
   * 设置会话的 WebSocket 连接
   */
  setWebSocket(sessionId: string, ws: WebSocket): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.ws = ws;
      state.userInteractionHandler.setWebSocket(ws);
      state.taskManager.setWebSocket(ws);
    }
  }

  /**
   * 处理用户回答
   */
  handleUserAnswer(sessionId: string, requestId: string, answer: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.userInteractionHandler.handleAnswer(requestId, answer);
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
      await this.conversationLoop(state, callbacks, sessionId);

    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 对话循环
   */
  private async conversationLoop(
    state: SessionState,
    callbacks: StreamCallbacks,
    sessionId?: string
  ): Promise<void> {
    let continueLoop = true;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (continueLoop && !state.cancelled) {
      // 构建系统提示
      const systemPrompt = await this.buildSystemPrompt(state);

      // 获取工具定义（使用过滤后的工具列表）
      const tools = this.getFilteredTools(sessionId || '');

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

    // 检查工具是否被过滤
    if (!this.isToolEnabled(toolUse.name, state.toolFilterConfig)) {
      const error = `工具 ${toolUse.name} 已被禁用`;
      callbacks.onToolResult?.(toolUse.id, false, undefined, error);
      return { success: false, error };
    }

    try {
      console.log(`[Tool] 执行 ${toolUse.name}:`, JSON.stringify(toolUse.input).slice(0, 200));

      // 拦截 Task 工具 - 通过 TaskManager 执行后台任务
      if (toolUse.name === 'Task') {
        const input = toolUse.input as any;
        const description = input.description || 'Background task';
        const prompt = input.prompt || '';
        const agentType = input.subagent_type || 'general-purpose';
        const runInBackground = input.run_in_background !== false;

        // 验证必需参数
        if (!prompt) {
          const error = 'Task prompt is required';
          callbacks.onToolResult?.(toolUse.id, false, undefined, error);
          return { success: false, error };
        }

        try {
          // 创建任务
          const taskId = await state.taskManager.createTask(
            description,
            prompt,
            agentType,
            {
              model: input.model || state.model,
              runInBackground,
              parentMessages: state.messages,
              workingDirectory: state.session.cwd,
            }
          );

          let output: string;
          if (runInBackground) {
            output = `Agent started in background with ID: ${taskId}\n\nDescription: ${description}\nAgent Type: ${agentType}\n\nUse the TaskOutput tool to check progress and retrieve results when complete.`;
          } else {
            // 同步执行 - 等待完成
            const task = state.taskManager.getTask(taskId);
            if (task) {
              // 等待任务完成
              while (task.status === 'running') {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              if (task.status === 'completed') {
                output = task.result || 'Task completed successfully';
              } else {
                output = `Task failed: ${task.error || 'Unknown error'}`;
              }
            } else {
              output = 'Task execution completed';
            }
          }

          callbacks.onToolResult?.(toolUse.id, true, output, undefined, {
            tool: 'Task',
            agentType,
            description,
            status: runInBackground ? 'running' : 'completed',
            output,
          });

          return { success: true, output };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Tool] Task 执行失败:`, errorMessage);
          callbacks.onToolResult?.(toolUse.id, false, undefined, errorMessage);
          return { success: false, error: errorMessage };
        }
      }

      // 拦截 TaskOutput 工具 - 从 TaskManager 获取任务输出
      if (toolUse.name === 'TaskOutput') {
        const input = toolUse.input as any;
        const taskId = input.task_id;
        const block = input.block !== false;
        const timeout = input.timeout || 300000; // 默认5分钟超时
        const showHistory = input.show_history || false;

        if (!taskId) {
          const error = 'task_id is required';
          callbacks.onToolResult?.(toolUse.id, false, undefined, error);
          return { success: false, error };
        }

        try {
          const task = state.taskManager.getTask(taskId);

          if (!task) {
            const error = `Task ${taskId} not found`;
            callbacks.onToolResult?.(toolUse.id, false, undefined, error);
            return { success: false, error };
          }

          // 如果需要阻塞等待完成
          if (block && task.status === 'running') {
            const startTime = Date.now();
            while (task.status === 'running' && (Date.now() - startTime) < timeout) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (task.status === 'running') {
              const output = `Task ${taskId} is still running (timeout reached).\n\nStatus: ${task.status}\nDescription: ${task.description}`;
              callbacks.onToolResult?.(toolUse.id, true, output);
              return { success: true, output };
            }
          }

          // 构建输出
          let output = `Task: ${task.description}\n`;
          output += `ID: ${taskId}\n`;
          output += `Agent Type: ${task.agentType}\n`;
          output += `Status: ${task.status}\n`;
          output += `Started: ${task.startTime.toLocaleString('zh-CN')}\n`;

          if (task.endTime) {
            const duration = ((task.endTime.getTime() - task.startTime.getTime()) / 1000).toFixed(1);
            output += `Ended: ${task.endTime.toLocaleString('zh-CN')}\n`;
            output += `Duration: ${duration}s\n`;
          }

          if (task.progress) {
            output += `\nProgress: ${task.progress.current}/${task.progress.total}`;
            if (task.progress.message) {
              output += ` - ${task.progress.message}`;
            }
            output += '\n';
          }

          // 获取任务输出
          const taskOutput = state.taskManager.getTaskOutput(taskId);
          if (taskOutput) {
            output += `\n${'='.repeat(50)}\nOutput:\n${'='.repeat(50)}\n${taskOutput}`;
          } else if (task.status === 'running') {
            output += '\nTask is still running. No output available yet.';
          } else if (task.error) {
            output += `\nError: ${task.error}`;
          }

          callbacks.onToolResult?.(toolUse.id, true, output);
          return { success: true, output };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Tool] TaskOutput 执行失败:`, errorMessage);
          callbacks.onToolResult?.(toolUse.id, false, undefined, errorMessage);
          return { success: false, error: errorMessage };
        }
      }

      // 拦截 AskUserQuestion 工具 - 通过 WebSocket 向前端发送问题
      if (toolUse.name === 'AskUserQuestion') {
        const input = toolUse.input as any;
        const questions = input.questions || [];

        if (questions.length === 0) {
          const error = 'No questions provided';
          callbacks.onToolResult?.(toolUse.id, false, undefined, error);
          return { success: false, error };
        }

        const answers: Record<string, string> = {};

        try {
          // 逐个发送问题并等待回答
          for (const question of questions) {
            const answer = await state.userInteractionHandler.askQuestion({
              question: question.question,
              header: question.header,
              options: question.options,
              multiSelect: question.multiSelect,
              timeout: 300000, // 5分钟超时
            });
            answers[question.header] = answer;
          }

          // 格式化答案输出（使用官方格式）
          const formattedAnswers = Object.entries(answers)
            .map(([header, answer]) => `"${header}"="${answer}"`)
            .join(', ');
          const output = `User has answered your questions: ${formattedAnswers}. You can now continue with the user's answers in mind.`;

          callbacks.onToolResult?.(toolUse.id, true, output);
          return { success: true, output };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Tool] AskUserQuestion 失败:`, errorMessage);
          callbacks.onToolResult?.(toolUse.id, false, undefined, errorMessage);
          return { success: false, error: errorMessage };
        }
      }

      // 执行其他工具
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
    const config = state.systemPromptConfig;

    // 如果使用自定义提示（完全替换）
    if (!config.useDefault && config.customPrompt) {
      return config.customPrompt;
    }

    // 构建默认提示
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

    // 如果有追加提示，添加到默认提示后
    if (config.useDefault && config.appendPrompt) {
      prompt += '\n\n' + config.appendPrompt;
    }

    return prompt;
  }

  /**
   * 处理权限响应
   */
  handlePermissionResponse(
    sessionId: string,
    requestId: string,
    approved: boolean,
    remember?: boolean,
    scope?: 'once' | 'session' | 'always'
  ): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      console.warn(`[ConversationManager] 未找到会话: ${sessionId}`);
      return;
    }

    // UserInteractionHandler 目前不支持权限响应
    console.log(`[ConversationManager] 权限响应: ${requestId}, approved: ${approved}`);
  }

  /**
   * 更新权限配置
   */
  updatePermissionConfig(sessionId: string, config: PermissionConfigPayload): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      console.warn(`[ConversationManager] 未找到会话: ${sessionId}`);
      return;
    }

    // UserInteractionHandler 目前不支持权限配置更新
    console.log(`[ConversationManager] 已更新会话 ${sessionId} 的权限配置:`, config);
  }

  // ============ 工具过滤方法 ============

  /**
   * 更新工具过滤配置
   */
  updateToolFilter(sessionId: string, config: import('../shared/types.js').ToolFilterConfig): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      console.warn(`[ConversationManager] 未找到会话: ${sessionId}`);
      return;
    }

    state.toolFilterConfig = config;
    console.log(`[ConversationManager] 已更新会话 ${sessionId} 的工具过滤配置:`, config);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(sessionId: string): import('../shared/types.js').ToolInfo[] {
    const state = this.sessions.get(sessionId);
    const config = state?.toolFilterConfig || { mode: 'all' };

    const allTools = toolRegistry.getAll();

    return allTools.map(tool => {
      const enabled = this.isToolEnabled(tool.name, config);
      return {
        name: tool.name,
        description: tool.description,
        enabled,
        category: this.getToolCategory(tool.name),
      };
    });
  }

  /**
   * 检查工具是否启用
   */
  private isToolEnabled(toolName: string, config: import('../shared/types.js').ToolFilterConfig): boolean {
    if (config.mode === 'all') {
      return true;
    }

    if (config.mode === 'whitelist') {
      return config.allowedTools?.includes(toolName) || false;
    }

    if (config.mode === 'blacklist') {
      return !(config.disallowedTools?.includes(toolName) || false);
    }

    return true;
  }

  /**
   * 获取工具分类
   */
  private getToolCategory(toolName: string): string {
    const categoryMap: Record<string, string> = {
      // Bash 工具
      Bash: 'system',
      BashOutput: 'system',
      KillShell: 'system',

      // 文件工具
      Read: 'file',
      Write: 'file',
      Edit: 'file',
      MultiEdit: 'file',

      // 搜索工具
      Glob: 'search',
      Grep: 'search',

      // Web 工具
      WebFetch: 'web',
      WebSearch: 'web',

      // 任务管理
      TodoWrite: 'task',
      Task: 'task',
      TaskOutput: 'task',
      ListAgents: 'task',

      // 其他
      NotebookEdit: 'notebook',
      EnterPlanMode: 'plan',
      ExitPlanMode: 'plan',
      ListMcpResources: 'mcp',
      ReadMcpResource: 'mcp',
      MCPSearch: 'mcp',
      AskUserQuestion: 'interaction',
      Tmux: 'system',
      Skill: 'skill',
      SlashCommand: 'skill',
      LSP: 'lsp',
      Chrome: 'browser',
    };

    return categoryMap[toolName] || 'other';
  }

  /**
   * 获取过滤后的工具列表
   */
  private getFilteredTools(sessionId: string): any[] {
    const state = this.sessions.get(sessionId);
    const config = state?.toolFilterConfig || { mode: 'all' };

    const allTools = toolRegistry.getAll();

    // 根据配置过滤工具
    const filteredTools = allTools.filter(tool =>
      this.isToolEnabled(tool.name, config)
    );

    return filteredTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.getInputSchema(),
    }));
  }

  // ============ 会话持久化方法 ============

  /**
   * 获取会话管理器
   */
  getSessionManager(): WebSessionManager {
    return this.sessionManager;
  }

  /**
   * 持久化会话
   */
  async persistSession(sessionId: string): Promise<boolean> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return false;
    }

    try {
      // 先检查会话是否存在于 sessionManager
      let sessionData = this.sessionManager.loadSessionById(sessionId);

      if (!sessionData) {
        // 如果不存在，创建新会话
        sessionData = this.sessionManager.createSession({
          name: `WebUI 会话 - ${new Date().toLocaleString('zh-CN')}`,
          model: state.model,
          tags: ['webui'],
        });
      }

      // 更新会话数据
      sessionData.messages = state.messages;
      sessionData.chatHistory = state.chatHistory;
      sessionData.currentModel = state.model;
      (sessionData as any).toolFilterConfig = state.toolFilterConfig;
      (sessionData as any).systemPromptConfig = state.systemPromptConfig;

      // 保存到磁盘
      const success = this.sessionManager.saveSession(sessionId);
      if (success) {
        console.log(`[ConversationManager] 会话已持久化: ${sessionId}`);
      }
      return success;
    } catch (error) {
      console.error(`[ConversationManager] 持久化会话失败:`, error);
      return false;
    }
  }

  /**
   * 恢复会话
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    try {
      const sessionData = this.sessionManager.loadSessionById(sessionId);
      if (!sessionData) {
        console.warn(`[ConversationManager] 会话不存在: ${sessionId}`);
        return false;
      }

      // 从持久化数据恢复会话状态
      const session = new Session(sessionData.metadata.workingDirectory || this.cwd);
      await session.initializeGitInfo();

      const clientConfig = this.buildClientConfig(sessionData.currentModel || this.defaultModel);
      const client = new ClaudeClient(clientConfig);

      const state: SessionState = {
        session,
        client,
        messages: sessionData.messages,
        model: sessionData.currentModel || sessionData.metadata.model,
        cancelled: false,
        chatHistory: sessionData.chatHistory || [],
        userInteractionHandler: new UserInteractionHandler(),
        taskManager: new TaskManager(),
        toolFilterConfig: (sessionData as any).toolFilterConfig || {
          mode: 'all', // 默认允许所有工具
        },
        systemPromptConfig: (sessionData as any).systemPromptConfig || {
          useDefault: true,
        },
      };

      this.sessions.set(sessionId, state);
      console.log(`[ConversationManager] 会话已恢复: ${sessionId}, 消息数: ${sessionData.messages.length}`);
      return true;
    } catch (error) {
      console.error(`[ConversationManager] 恢复会话失败:`, error);
      return false;
    }
  }

  /**
   * 列出持久化会话
   */
  listPersistedSessions(options?: SessionListOptions): SessionMetadata[] {
    return this.sessionManager.listSessions(options);
  }

  /**
   * 删除持久化会话
   */
  deletePersistedSession(sessionId: string): boolean {
    // 从内存中删除
    this.sessions.delete(sessionId);
    // 从磁盘删除
    return this.sessionManager.deleteSession(sessionId);
  }

  /**
   * 重命名持久化会话
   */
  renamePersistedSession(sessionId: string, name: string): boolean {
    return this.sessionManager.renameSession(sessionId, name);
  }

  /**
   * 导出持久化会话
   */
  exportPersistedSession(sessionId: string, format: 'json' | 'md' = 'json'): string | null {
    if (format === 'json') {
      return this.sessionManager.exportSessionJSON(sessionId);
    } else {
      return this.sessionManager.exportSessionMarkdown(sessionId);
    }
  }

  // ============ 系统提示配置方法 ============

  /**
   * 更新系统提示配置
   */
  updateSystemPrompt(sessionId: string, config: SystemPromptConfig): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) {
      console.warn(`[ConversationManager] 未找到会话: ${sessionId}`);
      return false;
    }

    state.systemPromptConfig = config;
    console.log(`[ConversationManager] 已更新会话 ${sessionId} 的系统提示配置`);
    return true;
  }

  /**
   * 获取系统提示配置和当前完整提示
   */
  async getSystemPrompt(sessionId: string): Promise<SystemPromptGetPayload> {
    const state = await this.getOrCreateSession(sessionId);

    // 构建当前完整的系统提示
    const currentPrompt = await this.buildSystemPrompt(state);

    return {
      current: currentPrompt,
      config: state.systemPromptConfig,
    };
  }

  /**
   * 获取任务管理器
   */
  getTaskManager(sessionId: string): TaskManager | undefined {
    const state = this.sessions.get(sessionId);
    return state?.taskManager;
  }

  /**
   * 获取工具过滤配置
   */
  getToolFilterConfig(sessionId: string): import('../shared/types.js').ToolFilterConfig {
    const state = this.sessions.get(sessionId);
    return state?.toolFilterConfig || { mode: 'all' };
  }

  // ============ MCP 服务器管理方法 ============

  /**
   * 列出所有 MCP 服务器
   */
  listMcpServers(): import('../shared/types.js').McpServerConfig[] {
    const servers = this.mcpConfigManager.getServers();

    return Object.entries(servers).map(([name, config]) => ({
      name,
      type: config.type,
      command: config.command,
      args: config.args,
      env: config.env,
      url: config.url,
      headers: config.headers,
      enabled: config.enabled !== false,
      timeout: config.timeout,
      retries: config.retries,
    }));
  }

  /**
   * 添加 MCP 服务器
   */
  async addMcpServer(name: string, config: Omit<import('../shared/types.js').McpServerConfig, 'name'>): Promise<boolean> {
    try {
      const serverConfig: ExtendedMcpServerConfig = {
        type: config.type,
        command: config.command,
        args: config.args,
        env: config.env,
        url: config.url,
        headers: config.headers,
        enabled: config.enabled !== false,
        timeout: config.timeout || 30000,
        retries: config.retries || 3,
      };

      await this.mcpConfigManager.addServer(name, serverConfig);
      console.log(`[ConversationManager] 已添加 MCP 服务器: ${name}`);
      return true;
    } catch (error) {
      console.error(`[ConversationManager] 添加 MCP 服务器失败:`, error);
      return false;
    }
  }

  /**
   * 删除 MCP 服务器
   */
  async removeMcpServer(name: string): Promise<boolean> {
    try {
      const success = await this.mcpConfigManager.removeServer(name);
      if (success) {
        console.log(`[ConversationManager] 已删除 MCP 服务器: ${name}`);
      }
      return success;
    } catch (error) {
      console.error(`[ConversationManager] 删除 MCP 服务器失败:`, error);
      return false;
    }
  }

  /**
   * 切换 MCP 服务器启用状态
   */
  async toggleMcpServer(name: string, enabled?: boolean): Promise<{ success: boolean; enabled: boolean }> {
    try {
      const server = this.mcpConfigManager.getServer(name);

      if (!server) {
        console.warn(`[ConversationManager] MCP 服务器不存在: ${name}`);
        return { success: false, enabled: false };
      }

      // 如果未指定 enabled，则切换当前状态
      const newEnabled = enabled !== undefined ? enabled : !(server.enabled !== false);

      if (newEnabled) {
        await this.mcpConfigManager.enableServer(name);
      } else {
        await this.mcpConfigManager.disableServer(name);
      }

      console.log(`[ConversationManager] MCP 服务器 ${name} ${newEnabled ? '已启用' : '已禁用'}`);
      return { success: true, enabled: newEnabled };
    } catch (error) {
      console.error(`[ConversationManager] 切换 MCP 服务器失败:`, error);
      return { success: false, enabled: false };
    }
  }

  /**
   * 获取 MCP 配置管理器（供其他模块使用）
   */
  getMcpConfigManager(): McpConfigManager {
    return this.mcpConfigManager;
  }

  // ============ 插件管理方法 ============

  /**
   * 列出所有插件
   */
  async listPlugins(): Promise<import('../shared/types.js').PluginInfo[]> {
    const { pluginManager } = await import('../../plugins/index.js');

    // 发现所有插件
    await pluginManager.discover();

    const pluginStates = pluginManager.getPluginStates();

    return pluginStates.map(state => {
      const tools = pluginManager.getPluginTools(state.metadata.name);
      const commands = pluginManager.getPluginCommands(state.metadata.name);
      const skills = pluginManager.getPluginSkills(state.metadata.name);
      const hooks = pluginManager.getPluginHooks(state.metadata.name);

      return {
        name: state.metadata.name,
        version: state.metadata.version,
        description: state.metadata.description,
        author: state.metadata.author,
        enabled: state.enabled,
        loaded: state.loaded,
        path: state.path,
        commands: commands.map(c => c.name),
        skills: skills.map(s => s.name),
        hooks: hooks.map(h => h.type),
        tools: tools.map(t => t.name),
        error: state.error,
      };
    });
  }

  /**
   * 获取插件详情
   */
  async getPluginInfo(name: string): Promise<import('../shared/types.js').PluginInfo | null> {
    const { pluginManager } = await import('../../plugins/index.js');

    const state = pluginManager.getPluginState(name);
    if (!state) {
      return null;
    }

    const tools = pluginManager.getPluginTools(name);
    const commands = pluginManager.getPluginCommands(name);
    const skills = pluginManager.getPluginSkills(name);
    const hooks = pluginManager.getPluginHooks(name);

    return {
      name: state.metadata.name,
      version: state.metadata.version,
      description: state.metadata.description,
      author: state.metadata.author,
      enabled: state.enabled,
      loaded: state.loaded,
      path: state.path,
      commands: commands.map(c => c.name),
      skills: skills.map(s => s.name),
      hooks: hooks.map(h => h.type),
      tools: tools.map(t => t.name),
      error: state.error,
    };
  }

  /**
   * 启用插件
   */
  async enablePlugin(name: string): Promise<boolean> {
    try {
      const { pluginManager } = await import('../../plugins/index.js');

      const success = await pluginManager.setEnabled(name, true);
      if (success) {
        console.log(`[ConversationManager] 插件已启用: ${name}`);
      }
      return success;
    } catch (error) {
      console.error(`[ConversationManager] 启用插件失败:`, error);
      return false;
    }
  }

  /**
   * 禁用插件
   */
  async disablePlugin(name: string): Promise<boolean> {
    try {
      const { pluginManager } = await import('../../plugins/index.js');

      const success = await pluginManager.setEnabled(name, false);
      if (success) {
        console.log(`[ConversationManager] 插件已禁用: ${name}`);
      }
      return success;
    } catch (error) {
      console.error(`[ConversationManager] 禁用插件失败:`, error);
      return false;
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(name: string): Promise<boolean> {
    try {
      const { pluginManager } = await import('../../plugins/index.js');

      const success = await pluginManager.uninstall(name);
      if (success) {
        console.log(`[ConversationManager] 插件已卸载: ${name}`);
      }
      return success;
    } catch (error) {
      console.error(`[ConversationManager] 卸载插件失败:`, error);
      return false;
    }
  }
}
