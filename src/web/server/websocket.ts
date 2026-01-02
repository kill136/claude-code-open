/**
 * WebSocket 处理器
 * 处理实时双向通信
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { ConversationManager } from './conversation.js';
import { isSlashCommand, executeSlashCommand } from './slash-commands.js';
import type { ClientMessage, ServerMessage, Attachment } from '../shared/types.js';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  sessionId: string;
  model: string;
  isAlive: boolean;
}

export function setupWebSocket(
  wss: WebSocketServer,
  conversationManager: ConversationManager
): void {
  const clients = new Map<string, ClientConnection>();

  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, id) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(id);
        return;
      }
      client.isAlive = false;
      client.ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = randomUUID();
    const sessionId = randomUUID();

    const client: ClientConnection = {
      id: clientId,
      ws,
      sessionId,
      model: 'sonnet',
      isAlive: true,
    };

    clients.set(clientId, client);

    console.log(`[WebSocket] 客户端连接: ${clientId}`);

    // 发送连接确认
    sendMessage(ws, {
      type: 'connected',
      payload: {
        sessionId,
        model: client.model,
      },
    });

    // 处理心跳
    ws.on('pong', () => {
      client.isAlive = true;
    });

    // 处理消息
    ws.on('message', async (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        await handleClientMessage(client, message, conversationManager);
      } catch (error) {
        console.error('[WebSocket] 消息处理错误:', error);
        sendMessage(ws, {
          type: 'error',
          payload: {
            message: error instanceof Error ? error.message : '未知错误',
          },
        });
      }
    });

    // 处理关闭
    ws.on('close', () => {
      console.log(`[WebSocket] 客户端断开: ${clientId}`);
      clients.delete(clientId);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error(`[WebSocket] 客户端错误 ${clientId}:`, error);
      clients.delete(clientId);
    });
  });
}

/**
 * 发送消息到客户端
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 处理客户端消息
 */
async function handleClientMessage(
  client: ClientConnection,
  message: ClientMessage,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  switch (message.type) {
    case 'ping':
      sendMessage(ws, { type: 'pong' });
      break;

    case 'chat':
      // 确保会话关联 WebSocket
      conversationManager.setWebSocket(client.sessionId, ws);
      await handleChatMessage(client, message.payload.content, message.payload.attachments || message.payload.images, conversationManager);
      break;

    case 'cancel':
      conversationManager.cancel(client.sessionId);
      sendMessage(ws, {
        type: 'status',
        payload: { status: 'idle', message: '已取消' },
      });
      break;

    case 'get_history':
      const history = conversationManager.getHistory(client.sessionId);
      sendMessage(ws, {
        type: 'history',
        payload: { messages: history },
      });
      break;

    case 'clear_history':
      conversationManager.clearHistory(client.sessionId);
      sendMessage(ws, {
        type: 'history',
        payload: { messages: [] },
      });
      break;

    case 'set_model':
      client.model = message.payload.model;
      conversationManager.setModel(client.sessionId, message.payload.model);
      break;

    case 'permission_response':
      conversationManager.handlePermissionResponse(
        client.sessionId,
        message.payload.requestId,
        message.payload.approved,
        message.payload.remember,
        message.payload.scope
      );
      break;

    case 'permission_config':
      conversationManager.updatePermissionConfig(client.sessionId, message.payload);
      break;

    case 'user_answer':
      conversationManager.handleUserAnswer(
        client.sessionId,
        message.payload.requestId,
        message.payload.answer
      );
      break;

    case 'slash_command':
      await handleSlashCommand(client, message.payload.command, conversationManager);
      break;

    case 'session_list':
      await handleSessionList(client, message.payload, conversationManager);
      break;

    case 'session_create':
      await handleSessionCreate(client, message.payload, conversationManager);
      break;

    case 'session_switch':
      await handleSessionSwitch(client, message.payload.sessionId, conversationManager);
      break;

    case 'session_delete':
      await handleSessionDelete(client, message.payload.sessionId, conversationManager);
      break;

    case 'session_rename':
      await handleSessionRename(client, message.payload.sessionId, message.payload.name, conversationManager);
      break;

    case 'session_export':
      await handleSessionExport(client, message.payload.sessionId, message.payload.format, conversationManager);
      break;

    case 'session_resume':
      await handleSessionResume(client, message.payload.sessionId, conversationManager);
      break;

    case 'task_list':
      await handleTaskList(client, message.payload, conversationManager);
      break;

    case 'task_cancel':
      await handleTaskCancel(client, message.payload.taskId, conversationManager);
      break;

    case 'task_output':
      await handleTaskOutput(client, message.payload.taskId, conversationManager);
      break;

    case 'tool_filter_update':
      await handleToolFilterUpdate(client, message.payload, conversationManager);
      break;

    case 'tool_list_get':
      await handleToolListGet(client, conversationManager);
      break;

    case 'system_prompt_update':
      await handleSystemPromptUpdate(client, message.payload.config, conversationManager);
      break;

    case 'system_prompt_get':
      await handleSystemPromptGet(client, conversationManager);
      break;

    default:
      console.warn('[WebSocket] 未知消息类型:', (message as any).type);
  }
}

/**
 * 处理聊天消息
 */
async function handleChatMessage(
  client: ClientConnection,
  content: string,
  attachments: Attachment[] | string[] | undefined,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId, model } = client;

  // 检查是否为斜杠命令
  if (isSlashCommand(content)) {
    await handleSlashCommand(client, content, conversationManager);
    return;
  }

  const messageId = randomUUID();

  // 处理附件：转换为 images 数组（向后兼容）或增强内容
  let images: string[] | undefined;
  let enhancedContent = content;

  if (attachments && Array.isArray(attachments)) {
    // 检查是否是新格式的附件
    if (attachments.length > 0 && typeof attachments[0] === 'object') {
      const typedAttachments = attachments as Attachment[];
      images = typedAttachments
        .filter(att => att.type === 'image')
        .map(att => att.data); // 已经是 base64

      // 将文本附件添加到内容中
      const textAttachments = typedAttachments.filter(att => att.type === 'text');
      if (textAttachments.length > 0) {
        const textParts = textAttachments.map(
          att => `[文件: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\``
        );
        enhancedContent = textParts.join('\n\n') + (content ? '\n\n' + content : '');
      }
    } else {
      // 旧格式：直接是 base64 字符串数组
      images = attachments as string[];
    }
  }

  // 发送消息开始
  sendMessage(ws, {
    type: 'message_start',
    payload: { messageId },
  });

  // 发送状态更新
  sendMessage(ws, {
    type: 'status',
    payload: { status: 'thinking' },
  });

  try {
    // 调用对话管理器，传入流式回调
    await conversationManager.chat(sessionId, enhancedContent, images, model, {
      onThinkingStart: () => {
        sendMessage(ws, {
          type: 'thinking_start',
          payload: { messageId },
        });
      },

      onThinkingDelta: (text: string) => {
        sendMessage(ws, {
          type: 'thinking_delta',
          payload: { messageId, text },
        });
      },

      onThinkingComplete: () => {
        sendMessage(ws, {
          type: 'thinking_complete',
          payload: { messageId },
        });
      },

      onTextDelta: (text: string) => {
        sendMessage(ws, {
          type: 'text_delta',
          payload: { messageId, text },
        });
      },

      onToolUseStart: (toolUseId: string, toolName: string, input: unknown) => {
        sendMessage(ws, {
          type: 'tool_use_start',
          payload: { messageId, toolUseId, toolName, input },
        });
        sendMessage(ws, {
          type: 'status',
          payload: { status: 'tool_executing', message: `执行 ${toolName}...` },
        });
      },

      onToolUseDelta: (toolUseId: string, partialJson: string) => {
        sendMessage(ws, {
          type: 'tool_use_delta',
          payload: { toolUseId, partialJson },
        });
      },

      onToolResult: (toolUseId: string, success: boolean, output?: string, error?: string, data?: unknown) => {
        sendMessage(ws, {
          type: 'tool_result',
          payload: {
            toolUseId,
            success,
            output,
            error,
            data: data as any, // 工具特定的结构化数据
          },
        });
      },

      onPermissionRequest: (request: any) => {
        sendMessage(ws, {
          type: 'permission_request',
          payload: request,
        });
      },

      onComplete: (stopReason: string | null, usage?: { inputTokens: number; outputTokens: number }) => {
        sendMessage(ws, {
          type: 'message_complete',
          payload: {
            messageId,
            stopReason: (stopReason || 'end_turn') as 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use',
            usage,
          },
        });
        sendMessage(ws, {
          type: 'status',
          payload: { status: 'idle' },
        });
      },

      onError: (error: Error) => {
        sendMessage(ws, {
          type: 'error',
          payload: { message: error.message },
        });
        sendMessage(ws, {
          type: 'status',
          payload: { status: 'idle' },
        });
      },
    });
  } catch (error) {
    console.error('[WebSocket] 聊天处理错误:', error);
    sendMessage(ws, {
      type: 'error',
      payload: { message: error instanceof Error ? error.message : '处理失败' },
    });
    sendMessage(ws, {
      type: 'status',
      payload: { status: 'idle' },
    });
  }
}

/**
 * 处理斜杠命令
 */
async function handleSlashCommand(
  client: ClientConnection,
  command: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId, model } = client;

  try {
    // 获取当前工作目录
    const cwd = process.cwd();

    // 执行斜杠命令
    const result = await executeSlashCommand(command, {
      conversationManager,
      ws,
      sessionId,
      cwd,
      model,
    });

    // 发送命令执行结果
    sendMessage(ws, {
      type: 'slash_command_result',
      payload: {
        command,
        success: result.success,
        message: result.message,
        data: result.data,
        action: result.action,
      },
    });

    // 如果命令要求清除历史
    if (result.action === 'clear') {
      sendMessage(ws, {
        type: 'history',
        payload: { messages: [] },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 斜杠命令执行错误:', error);
    sendMessage(ws, {
      type: 'slash_command_result',
      payload: {
        command,
        success: false,
        message: error instanceof Error ? error.message : '命令执行失败',
      },
    });
  }
}

/**
 * 处理会话列表请求
 */
async function handleSessionList(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const limit = payload?.limit || 20;
    const offset = payload?.offset || 0;
    const search = payload?.search;

    const sessions = conversationManager.listPersistedSessions({
      limit,
      offset,
      search,
    });

    sendMessage(ws, {
      type: 'session_list_response',
      payload: {
        sessions: sessions.map(s => ({
          id: s.id,
          name: s.name,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messageCount: s.messageCount,
          model: s.model,
          cost: s.cost,
          tokenUsage: s.tokenUsage,
          tags: s.tags,
          workingDirectory: s.workingDirectory,
        })),
        total: sessions.length,
        offset,
        limit,
        hasMore: false,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取会话列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取会话列表失败',
      },
    });
  }
}

/**
 * 处理创建会话请求
 */
async function handleSessionCreate(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const { name, model, tags } = payload;
    const sessionManager = conversationManager.getSessionManager();

    const newSession = sessionManager.createSession({
      name: name || `WebUI 会话 - ${new Date().toLocaleString('zh-CN')}`,
      model: model || 'sonnet',
      tags: tags || ['webui'],
    });

    sendMessage(ws, {
      type: 'session_created',
      payload: {
        sessionId: newSession.metadata.id,
        name: newSession.metadata.name,
        model: newSession.metadata.model,
        createdAt: newSession.metadata.createdAt,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 创建会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '创建会话失败',
      },
    });
  }
}

/**
 * 处理切换会话请求
 */
async function handleSessionSwitch(
  client: ClientConnection,
  sessionId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    // 保存当前会话
    await conversationManager.persistSession(client.sessionId);

    // 恢复目标会话
    const success = await conversationManager.resumeSession(sessionId);

    if (success) {
      // 更新客户端会话ID
      client.sessionId = sessionId;

      // 获取会话历史
      const history = conversationManager.getHistory(sessionId);

      sendMessage(ws, {
        type: 'session_switched',
        payload: { sessionId },
      });

      sendMessage(ws, {
        type: 'history',
        payload: { messages: history },
      });
    } else {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '会话不存在或加载失败',
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 切换会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '切换会话失败',
      },
    });
  }
}

/**
 * 处理删除会话请求
 */
async function handleSessionDelete(
  client: ClientConnection,
  sessionId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const success = conversationManager.deletePersistedSession(sessionId);

    sendMessage(ws, {
      type: 'session_deleted',
      payload: {
        sessionId,
        success,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 删除会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '删除会话失败',
      },
    });
  }
}

/**
 * 处理重命名会话请求
 */
async function handleSessionRename(
  client: ClientConnection,
  sessionId: string,
  name: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const success = conversationManager.renamePersistedSession(sessionId, name);

    sendMessage(ws, {
      type: 'session_renamed',
      payload: {
        sessionId,
        name,
        success,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 重命名会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '重命名会话失败',
      },
    });
  }
}

/**
 * 处理导出会话请求
 */
async function handleSessionExport(
  client: ClientConnection,
  sessionId: string,
  format: 'json' | 'md' | undefined,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const exportFormat = format || 'json';
    const content = conversationManager.exportPersistedSession(sessionId, exportFormat);

    if (content) {
      sendMessage(ws, {
        type: 'session_exported',
        payload: {
          sessionId,
          content,
          format: exportFormat,
        },
      });
    } else {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '会话不存在或导出失败',
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 导出会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '导出会话失败',
      },
    });
  }
}

/**
 * 处理恢复会话请求
 */
async function handleSessionResume(
  client: ClientConnection,
  sessionId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const success = await conversationManager.resumeSession(sessionId);

    if (success) {
      client.sessionId = sessionId;
      const history = conversationManager.getHistory(sessionId);

      sendMessage(ws, {
        type: 'session_switched',
        payload: { sessionId },
      });

      sendMessage(ws, {
        type: 'history',
        payload: { messages: history },
      });
    } else {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '会话不存在或恢复失败',
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 恢复会话失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '恢复会话失败',
      },
    });
  }
}

/**
 * 处理工具过滤更新请求
 */
async function handleToolFilterUpdate(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId } = client;

  try {
    const { config } = payload;

    if (!config || !config.mode) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '无效的工具过滤配置',
        },
      });
      return;
    }

    conversationManager.updateToolFilter(sessionId, config);

    sendMessage(ws, {
      type: 'tool_filter_updated',
      payload: {
        success: true,
        config,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 更新工具过滤配置失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '更新工具过滤配置失败',
      },
    });
  }
}

/**
 * 处理获取工具列表请求
 */
async function handleToolListGet(
  client: ClientConnection,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId } = client;

  try {
    const tools = conversationManager.getAvailableTools(sessionId);

    // 获取当前会话的工具过滤配置
    const config = conversationManager.getToolFilterConfig(sessionId);

    sendMessage(ws, {
      type: 'tool_list_response',
      payload: {
        tools,
        config,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取工具列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取工具列表失败',
      },
    });
  }
}

/**
 * 处理系统提示更新请求
 */
async function handleSystemPromptUpdate(
  client: ClientConnection,
  config: import('../shared/types.js').SystemPromptConfig,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const success = conversationManager.updateSystemPrompt(client.sessionId, config);

    if (success) {
      // 获取更新后的完整提示
      const result = await conversationManager.getSystemPrompt(client.sessionId);
      sendMessage(ws, {
        type: 'system_prompt_response',
        payload: result,
      });
    } else {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '更新系统提示失败',
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 更新系统提示失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '更新系统提示失败',
      },
    });
  }
}

/**
 * 处理获取系统提示请求
 */
async function handleSystemPromptGet(
  client: ClientConnection,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const result = await conversationManager.getSystemPrompt(client.sessionId);

    sendMessage(ws, {
      type: 'system_prompt_response',
      payload: result,
    });
  } catch (error) {
    console.error('[WebSocket] 获取系统提示失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取系统提示失败',
      },
    });
  }
}


/**
 * 处理任务列表请求
 */
async function handleTaskList(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId } = client;

  try {
    const taskManager = conversationManager.getTaskManager(sessionId);
    if (!taskManager) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '任务管理器未初始化',
        },
      });
      return;
    }

    const statusFilter = payload?.statusFilter;
    const includeCompleted = payload?.includeCompleted !== false;

    let tasks = taskManager.listTasks();

    // 过滤任务
    if (statusFilter) {
      tasks = tasks.filter(t => t.status === statusFilter);
    }

    if (!includeCompleted) {
      tasks = tasks.filter(t => t.status !== 'completed');
    }

    // 转换为任务摘要
    const taskSummaries = tasks.map(task => ({
      id: task.id,
      description: task.description,
      agentType: task.agentType,
      status: task.status,
      startTime: task.startTime.getTime(),
      endTime: task.endTime?.getTime(),
      progress: task.progress,
    }));

    sendMessage(ws, {
      type: 'task_list_response',
      payload: {
        tasks: taskSummaries,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取任务列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取任务列表失败',
      },
    });
  }
}

/**
 * 处理取消任务请求
 */
async function handleTaskCancel(
  client: ClientConnection,
  taskId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId } = client;

  try {
    const taskManager = conversationManager.getTaskManager(sessionId);
    if (!taskManager) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '任务管理器未初始化',
        },
      });
      return;
    }

    const success = taskManager.cancelTask(taskId);

    sendMessage(ws, {
      type: 'task_cancelled',
      payload: {
        taskId,
        success,
      },
    });

    // 如果成功取消，发送状态更新
    if (success) {
      const task = taskManager.getTask(taskId);
      if (task) {
        sendMessage(ws, {
          type: 'task_status',
          payload: {
            taskId: task.id,
            status: task.status,
            error: task.error,
          },
        });
      }
    }
  } catch (error) {
    console.error('[WebSocket] 取消任务失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '取消任务失败',
      },
    });
  }
}

/**
 * 处理任务输出请求
 */
async function handleTaskOutput(
  client: ClientConnection,
  taskId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId } = client;

  try {
    const taskManager = conversationManager.getTaskManager(sessionId);
    if (!taskManager) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '任务管理器未初始化',
        },
      });
      return;
    }

    const task = taskManager.getTask(taskId);
    if (!task) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: `任务 ${taskId} 不存在`,
        },
      });
      return;
    }

    const output = taskManager.getTaskOutput(taskId);

    sendMessage(ws, {
      type: 'task_output_response',
      payload: {
        taskId: task.id,
        output,
        status: task.status,
        error: task.error,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取任务输出失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取任务输出失败',
      },
    });
  }
}
