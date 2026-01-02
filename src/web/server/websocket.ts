/**
 * WebSocket 处理器
 * 处理实时双向通信
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { ConversationManager } from './conversation.js';
import { isSlashCommand, executeSlashCommand } from './slash-commands.js';
import { apiManager } from './api-manager.js';
import { authManager } from './auth-manager.js';
import { CheckpointManager } from './checkpoint-manager.js';
import type { ClientMessage, ServerMessage, Attachment } from '../shared/types.js';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  sessionId: string;
  model: string;
  isAlive: boolean;
}

// 全局检查点管理器实例
const checkpointManager = new CheckpointManager();

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

    case 'mcp_list':
      await handleMcpList(client, conversationManager);
      break;

    case 'mcp_add':
      await handleMcpAdd(client, message.payload, conversationManager);
      break;

    case 'mcp_remove':
      await handleMcpRemove(client, message.payload, conversationManager);
      break;

    case 'mcp_toggle':
      await handleMcpToggle(client, message.payload, conversationManager);
      break;

    case 'api_status':
      await handleApiStatus(client);
      break;

    case 'api_test':
      await handleApiTest(client);
      break;

    case 'api_models':
      await handleApiModels(client);
      break;

    case 'api_provider':
      await handleApiProvider(client);
      break;

    case 'api_token_status':
      await handleApiTokenStatus(client);
      break;

    case 'checkpoint_create':
      await handleCheckpointCreate(client, message.payload, conversationManager);
      break;

    case 'checkpoint_list':
      await handleCheckpointList(client, message.payload, conversationManager);
      break;

    case 'checkpoint_restore':
      await handleCheckpointRestore(client, message.payload.checkpointId, message.payload.dryRun, conversationManager);
      break;

    case 'checkpoint_delete':
      await handleCheckpointDelete(client, message.payload.checkpointId, conversationManager);
      break;

    case 'checkpoint_diff':
      await handleCheckpointDiff(client, message.payload.checkpointId, conversationManager);
      break;

    case 'checkpoint_clear':
      await handleCheckpointClear(client, conversationManager);
      break;

    case 'doctor_run':
      await handleDoctorRun(client, message.payload);
      break;

    case 'plugin_list':
      await handlePluginList(client, conversationManager);
      break;

    case 'plugin_info':
      await handlePluginInfo(client, message.payload.name, conversationManager);
      break;

    case 'plugin_enable':
      await handlePluginEnable(client, message.payload.name, conversationManager);
      break;

    case 'plugin_disable':
      await handlePluginDisable(client, message.payload.name, conversationManager);
      break;

    case 'plugin_uninstall':
      await handlePluginUninstall(client, message.payload.name, conversationManager);
      break;

    case 'auth_status':
      await handleAuthStatus(client);
      break;

    case 'auth_set_key':
      await handleAuthSetKey(client, message.payload);
      break;

    case 'auth_clear':
      await handleAuthClear(client);
      break;

    case 'auth_validate':
      await handleAuthValidate(client, message.payload);
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

/**
 * 处理获取API状态请求
 */
async function handleApiStatus(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const status = await apiManager.getStatus();

    sendMessage(ws, {
      type: 'api_status_response',
      payload: status,
    });
  } catch (error) {
    console.error('[WebSocket] 获取API状态失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取API状态失败',
      },
    });
  }
}

/**
 * 处理API连接测试请求
 */
async function handleApiTest(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const result = await apiManager.testConnection();

    sendMessage(ws, {
      type: 'api_test_response',
      payload: result,
    });
  } catch (error) {
    console.error('[WebSocket] API测试失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : 'API测试失败',
      },
    });
  }
}

/**
 * 处理获取模型列表请求
 */
async function handleApiModels(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const models = await apiManager.getAvailableModels();

    sendMessage(ws, {
      type: 'api_models_response',
      payload: { models },
    });
  } catch (error) {
    console.error('[WebSocket] 获取模型列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取模型列表失败',
      },
    });
  }
}

/**
 * 处理获取Provider信息请求
 */
async function handleApiProvider(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const info = apiManager.getProviderInfo();

    sendMessage(ws, {
      type: 'api_provider_response',
      payload: info,
    });
  } catch (error) {
    console.error('[WebSocket] 获取Provider信息失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取Provider信息失败',
      },
    });
  }
}

/**
 * 处理获取Token状态请求
 */
async function handleApiTokenStatus(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const status = apiManager.getTokenStatus();

    sendMessage(ws, {
      type: 'api_token_status_response',
      payload: status,
    });
  } catch (error) {
    console.error('[WebSocket] 获取Token状态失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取Token状态失败',
      },
    });
  }
}

/**
 * 处理 MCP 服务器列表请求
 */
async function handleMcpList(
  client: ClientConnection,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const servers = conversationManager.listMcpServers();

    sendMessage(ws, {
      type: 'mcp_list_response',
      payload: {
        servers,
        total: servers.length,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取 MCP 服务器列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取 MCP 服务器列表失败',
      },
    });
  }
}

/**
 * 处理 MCP 服务器添加请求
 */
async function handleMcpAdd(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const { server } = payload;

    if (!server || !server.name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '无效的 MCP 服务器配置：缺少名称',
        },
      });
      return;
    }

    const success = await conversationManager.addMcpServer(server.name, server);

    if (success) {
      sendMessage(ws, {
        type: 'mcp_server_added',
        payload: {
          success: true,
          name: server.name,
          server,
        },
      });

      // 同时发送更新后的列表
      const servers = conversationManager.listMcpServers();
      sendMessage(ws, {
        type: 'mcp_list_response',
        payload: {
          servers,
          total: servers.length,
        },
      });
    } else {
      sendMessage(ws, {
        type: 'mcp_server_added',
        payload: {
          success: false,
          name: server.name,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 添加 MCP 服务器失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '添加 MCP 服务器失败',
      },
    });
  }
}

/**
 * 处理 MCP 服务器删除请求
 */
async function handleMcpRemove(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const { name } = payload;

    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少服务器名称',
        },
      });
      return;
    }

    const success = await conversationManager.removeMcpServer(name);

    sendMessage(ws, {
      type: 'mcp_server_removed',
      payload: {
        success,
        name,
      },
    });

    if (success) {
      // 同时发送更新后的列表
      const servers = conversationManager.listMcpServers();
      sendMessage(ws, {
        type: 'mcp_list_response',
        payload: {
          servers,
          total: servers.length,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 删除 MCP 服务器失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '删除 MCP 服务器失败',
      },
    });
  }
}

/**
 * 处理 MCP 服务器切换请求
 */
async function handleMcpToggle(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const { name, enabled } = payload;

    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少服务器名称',
        },
      });
      return;
    }

    const result = await conversationManager.toggleMcpServer(name, enabled);

    sendMessage(ws, {
      type: 'mcp_server_toggled',
      payload: {
        success: result.success,
        name,
        enabled: result.enabled,
      },
    });

    if (result.success) {
      // 同时发送更新后的列表
      const servers = conversationManager.listMcpServers();
      sendMessage(ws, {
        type: 'mcp_list_response',
        payload: {
          servers,
          total: servers.length,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 切换 MCP 服务器失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '切换 MCP 服务器失败',
      },
    });
  }
}

/**
 * 处理系统诊断请求
 */
async function handleDoctorRun(
  client: ClientConnection,
  payload?: { verbose?: boolean; includeSystemInfo?: boolean }
): Promise<void> {
  const { ws } = client;

  try {
    const { runDiagnostics, formatDoctorReport } = await import('./doctor.js');

    const options = {
      verbose: payload?.verbose || false,
      includeSystemInfo: payload?.includeSystemInfo ?? true,
    };

    const report = await runDiagnostics(options);
    const formattedText = formatDoctorReport(report, options.verbose);

    sendMessage(ws, {
      type: 'doctor_result',
      payload: {
        report: {
          ...report,
          timestamp: report.timestamp.getTime(),
        },
        formattedText,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 运行诊断失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '运行诊断失败',
      },
    });
  }
}

// ============ 检查点相关处理函数 ============

/**
 * 处理创建检查点请求
 */
async function handleCheckpointCreate(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const { description, filePaths, workingDirectory, tags } = payload;

    if (!description || !filePaths || filePaths.length === 0) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '创建检查点需要提供描述和文件列表',
        },
      });
      return;
    }

    const checkpoint = await checkpointManager.createCheckpoint(
      description,
      filePaths,
      workingDirectory,
      { tags }
    );

    console.log(`[WebSocket] 创建检查点: ${checkpoint.id} (${checkpoint.files.length} 个文件)`);

    sendMessage(ws, {
      type: 'checkpoint_created',
      payload: {
        checkpointId: checkpoint.id,
        timestamp: checkpoint.timestamp.getTime(),
        description: checkpoint.description,
        fileCount: checkpoint.files.length,
        totalSize: checkpoint.files.reduce((sum, f) => sum + f.size, 0),
      },
    });
  } catch (error) {
    console.error('[WebSocket] 创建检查点失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '创建检查点失败',
      },
    });
  }
}

/**
 * 处理检查点列表请求
 */
async function handleCheckpointList(
  client: ClientConnection,
  payload: any,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const limit = payload?.limit;
    const sortBy = payload?.sortBy || 'timestamp';
    const sortOrder = payload?.sortOrder || 'desc';

    const checkpoints = checkpointManager.listCheckpoints({
      limit,
      sortBy,
      sortOrder,
    });

    const stats = checkpointManager.getStats();

    const checkpointSummaries = checkpoints.map(cp => ({
      id: cp.id,
      timestamp: cp.timestamp.getTime(),
      description: cp.description,
      fileCount: cp.files.length,
      totalSize: cp.files.reduce((sum, f) => sum + f.size, 0),
      workingDirectory: cp.workingDirectory,
      tags: cp.metadata?.tags,
    }));

    sendMessage(ws, {
      type: 'checkpoint_list_response',
      payload: {
        checkpoints: checkpointSummaries,
        total: checkpointSummaries.length,
        stats: {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          oldest: stats.oldest?.getTime(),
          newest: stats.newest?.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取检查点列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取检查点列表失败',
      },
    });
  }
}

/**
 * 处理恢复检查点请求
 */
async function handleCheckpointRestore(
  client: ClientConnection,
  checkpointId: string,
  dryRun: boolean | undefined,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!checkpointId) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少检查点 ID',
        },
      });
      return;
    }

    const result = await checkpointManager.restoreCheckpoint(checkpointId, {
      dryRun: dryRun || false,
      skipBackup: false,
    });

    console.log(
      `[WebSocket] ${dryRun ? '模拟' : ''}恢复检查点: ${checkpointId} ` +
      `(成功: ${result.restored.length}, 失败: ${result.failed.length})`
    );

    sendMessage(ws, {
      type: 'checkpoint_restored',
      payload: {
        checkpointId,
        success: result.success,
        restored: result.restored,
        failed: result.failed,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 恢复检查点失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '恢复检查点失败',
      },
    });
  }
}

/**
 * 处理删除检查点请求
 */
async function handleCheckpointDelete(
  client: ClientConnection,
  checkpointId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!checkpointId) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少检查点 ID',
        },
      });
      return;
    }

    const success = checkpointManager.deleteCheckpoint(checkpointId);

    console.log(`[WebSocket] 删除检查点: ${checkpointId} (${success ? '成功' : '失败'})`);

    sendMessage(ws, {
      type: 'checkpoint_deleted',
      payload: {
        checkpointId,
        success,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 删除检查点失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '删除检查点失败',
      },
    });
  }
}

/**
 * 处理检查点差异请求
 */
async function handleCheckpointDiff(
  client: ClientConnection,
  checkpointId: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!checkpointId) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少检查点 ID',
        },
      });
      return;
    }

    const diffs = await checkpointManager.diffCheckpoint(checkpointId);

    const stats = {
      added: diffs.filter(d => d.type === 'added').length,
      removed: diffs.filter(d => d.type === 'removed').length,
      modified: diffs.filter(d => d.type === 'modified').length,
      unchanged: diffs.filter(d => d.type === 'unchanged').length,
    };

    console.log(
      `[WebSocket] 比较检查点: ${checkpointId} ` +
      `(添加: ${stats.added}, 删除: ${stats.removed}, 修改: ${stats.modified}, 未变: ${stats.unchanged})`
    );

    sendMessage(ws, {
      type: 'checkpoint_diff_response',
      payload: {
        checkpointId,
        diffs,
        stats,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 比较检查点失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '比较检查点失败',
      },
    });
  }
}

/**
 * 处理清除所有检查点请求
 */
async function handleCheckpointClear(
  client: ClientConnection,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const count = checkpointManager.clearCheckpoints();

    console.log(`[WebSocket] 清除所有检查点: ${count} 个`);

    sendMessage(ws, {
      type: 'checkpoint_cleared',
      payload: {
        count,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 清除检查点失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '清除检查点失败',
      },
    });
  }
}

// ============ 插件相关处理函数 ============

/**
 * 处理插件列表请求
 */
async function handlePluginList(
  client: ClientConnection,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    const plugins = await conversationManager.listPlugins();

    sendMessage(ws, {
      type: 'plugin_list_response',
      payload: {
        plugins,
        total: plugins.length,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取插件列表失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取插件列表失败',
      },
    });
  }
}

/**
 * 处理插件详情请求
 */
async function handlePluginInfo(
  client: ClientConnection,
  name: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少插件名称',
        },
      });
      return;
    }

    const plugin = await conversationManager.getPluginInfo(name);

    sendMessage(ws, {
      type: 'plugin_info_response',
      payload: {
        plugin,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取插件详情失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取插件详情失败',
      },
    });
  }
}

/**
 * 处理启用插件请求
 */
async function handlePluginEnable(
  client: ClientConnection,
  name: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少插件名称',
        },
      });
      return;
    }

    const success = await conversationManager.enablePlugin(name);

    sendMessage(ws, {
      type: 'plugin_enabled',
      payload: {
        name,
        success,
      },
    });

    // 发送更新后的插件列表
    if (success) {
      const plugins = await conversationManager.listPlugins();
      sendMessage(ws, {
        type: 'plugin_list_response',
        payload: {
          plugins,
          total: plugins.length,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 启用插件失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '启用插件失败',
      },
    });
  }
}

/**
 * 处理禁用插件请求
 */
async function handlePluginDisable(
  client: ClientConnection,
  name: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少插件名称',
        },
      });
      return;
    }

    const success = await conversationManager.disablePlugin(name);

    sendMessage(ws, {
      type: 'plugin_disabled',
      payload: {
        name,
        success,
      },
    });

    // 发送更新后的插件列表
    if (success) {
      const plugins = await conversationManager.listPlugins();
      sendMessage(ws, {
        type: 'plugin_list_response',
        payload: {
          plugins,
          total: plugins.length,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 禁用插件失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '禁用插件失败',
      },
    });
  }
}

/**
 * 处理卸载插件请求
 */
async function handlePluginUninstall(
  client: ClientConnection,
  name: string,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws } = client;

  try {
    if (!name) {
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: '缺少插件名称',
        },
      });
      return;
    }

    const success = await conversationManager.uninstallPlugin(name);

    sendMessage(ws, {
      type: 'plugin_uninstalled',
      payload: {
        name,
        success,
      },
    });

    // 发送更新后的插件列表
    if (success) {
      const plugins = await conversationManager.listPlugins();
      sendMessage(ws, {
        type: 'plugin_list_response',
        payload: {
          plugins,
          total: plugins.length,
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 卸载插件失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '卸载插件失败',
      },
    });
  }
}

// ============ 认证相关处理函数 ============

/**
 * 处理获取认证状态请求
 */
async function handleAuthStatus(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    const status = authManager.getAuthStatus();

    sendMessage(ws, {
      type: 'auth_status_response',
      payload: {
        status,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 获取认证状态失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '获取认证状态失败',
      },
    });
  }
}

/**
 * 处理设置API密钥请求
 */
async function handleAuthSetKey(
  client: ClientConnection,
  payload: any
): Promise<void> {
  const { ws } = client;

  try {
    const { apiKey } = payload;

    if (!apiKey || typeof apiKey !== 'string') {
      sendMessage(ws, {
        type: 'auth_key_set',
        payload: {
          success: false,
          message: '无效的 API 密钥',
        },
      });
      return;
    }

    const success = authManager.setApiKey(apiKey);

    if (success) {
      sendMessage(ws, {
        type: 'auth_key_set',
        payload: {
          success: true,
          message: 'API 密钥已设置',
        },
      });

      // 同时发送更新后的状态
      const status = authManager.getAuthStatus();
      sendMessage(ws, {
        type: 'auth_status_response',
        payload: {
          status,
        },
      });
    } else {
      sendMessage(ws, {
        type: 'auth_key_set',
        payload: {
          success: false,
          message: '设置 API 密钥失败',
        },
      });
    }
  } catch (error) {
    console.error('[WebSocket] 设置 API 密钥失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '设置 API 密钥失败',
      },
    });
  }
}

/**
 * 处理清除认证请求
 */
async function handleAuthClear(
  client: ClientConnection
): Promise<void> {
  const { ws } = client;

  try {
    authManager.clearAuth();

    sendMessage(ws, {
      type: 'auth_cleared',
      payload: {
        success: true,
      },
    });

    // 同时发送更新后的状态
    const status = authManager.getAuthStatus();
    sendMessage(ws, {
      type: 'auth_status_response',
      payload: {
        status,
      },
    });
  } catch (error) {
    console.error('[WebSocket] 清除认证失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '清除认证失败',
      },
    });
  }
}

/**
 * 处理验证API密钥请求
 */
async function handleAuthValidate(
  client: ClientConnection,
  payload: any
): Promise<void> {
  const { ws } = client;

  try {
    const { apiKey } = payload;

    if (!apiKey || typeof apiKey !== 'string') {
      sendMessage(ws, {
        type: 'auth_validated',
        payload: {
          valid: false,
          message: '无效的 API 密钥格式',
        },
      });
      return;
    }

    const valid = await authManager.validateApiKey(apiKey);

    sendMessage(ws, {
      type: 'auth_validated',
      payload: {
        valid,
        message: valid ? 'API 密钥有效' : 'API 密钥无效',
      },
    });
  } catch (error) {
    console.error('[WebSocket] 验证 API 密钥失败:', error);
    sendMessage(ws, {
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : '验证 API 密钥失败',
      },
    });
  }
}
