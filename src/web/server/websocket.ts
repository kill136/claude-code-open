/**
 * WebSocket 处理器
 * 处理实时双向通信
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { ConversationManager } from './conversation.js';
import type { ClientMessage, ServerMessage } from '../shared/types.js';

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
      await handleChatMessage(client, message.payload.content, message.payload.images, conversationManager);
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
  images: string[] | undefined,
  conversationManager: ConversationManager
): Promise<void> {
  const { ws, sessionId, model } = client;
  const messageId = randomUUID();

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
    await conversationManager.chat(sessionId, content, images, model, {
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
          payload: { toolUseId, success, output, error, data } as any,
        });
      },

      onComplete: (stopReason: string | null, usage?: { inputTokens: number; outputTokens: number }) => {
        sendMessage(ws, {
          type: 'message_complete',
          payload: {
            messageId,
            stopReason: stopReason as any,
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
