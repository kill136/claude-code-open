/**
 * 远程会话管理
 * 通过 WebSocket 连接到远程 Claude Code 会话
 */

import { EventEmitter } from 'events';
import { WebSocketConnection } from '../mcp/websocket-connection.js';
import type {
  TeleportConfig,
  RemoteMessage,
  RemoteSessionState,
  ConnectionState,
  SyncState,
} from './types.js';
import { validateSessionRepository } from './validation.js';

/**
 * 远程会话类
 *
 * 功能：
 * - 通过 WebSocket 连接到远程会话
 * - 同步会话消息和状态
 * - 断线重连
 * - 仓库验证
 */
export class RemoteSession extends EventEmitter {
  private config: TeleportConfig;
  private connection: WebSocketConnection | null = null;
  private state: RemoteSessionState;

  constructor(config: TeleportConfig) {
    super();
    this.config = config;
    this.state = {
      connectionState: 'disconnected',
      syncState: {
        syncing: false,
        syncedMessages: 0,
      },
      config,
    };
  }

  /**
   * 连接到远程会话
   */
  async connect(): Promise<void> {
    // 验证仓库
    const validation = await validateSessionRepository(
      this.config.metadata?.repo
    );

    if (validation.status === 'mismatch') {
      const error = new Error(
        `Repository mismatch: session is for ${validation.sessionRepo}, ` +
        `but current repo is ${validation.currentRepo}`
      );
      this.state.connectionState = 'error';
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }

    if (validation.status === 'error') {
      const error = new Error(validation.errorMessage || 'Repository validation failed');
      this.state.connectionState = 'error';
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }

    // 构建 WebSocket URL
    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) {
      const error = new Error('No ingress URL provided for remote session');
      this.state.connectionState = 'error';
      this.state.error = error;
      this.emit('error', error);
      throw error;
    }

    // 创建 WebSocket 连接
    this.state.connectionState = 'connecting';
    this.emit('connecting');

    const headers: Record<string, string> = {};

    // 添加认证令牌
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    // 添加会话 ID
    headers['X-Session-ID'] = this.config.sessionId;

    this.connection = new WebSocketConnection(wsUrl, {
      headers,
      sessionId: this.config.sessionId,
      onData: this.handleMessage.bind(this),
      onClose: this.handleDisconnect.bind(this),
    });

    // 监听连接事件
    this.connection.on('connect', this.handleConnect.bind(this));
    this.connection.on('error', this.handleError.bind(this));
    this.connection.on('message', this.handleMessage.bind(this));

    // 建立连接
    try {
      await this.connection.connect();
    } catch (error) {
      this.state.connectionState = 'error';
      this.state.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
    this.state.connectionState = 'disconnected';
    this.emit('disconnected');
  }

  /**
   * 发送消息到远程会话
   */
  async sendMessage(message: RemoteMessage): Promise<void> {
    if (!this.connection || !this.connection.isConnected()) {
      throw new Error('Not connected to remote session');
    }

    await this.connection.send({
      jsonrpc: '2.0',
      method: 'remote_message',
      params: message,
    });
  }

  /**
   * 请求同步会话数据
   */
  async requestSync(): Promise<void> {
    if (!this.connection || !this.connection.isConnected()) {
      throw new Error('Not connected to remote session');
    }

    this.state.connectionState = 'syncing';
    this.state.syncState.syncing = true;
    this.emit('sync_start');

    const syncRequest: RemoteMessage = {
      type: 'sync_request',
      sessionId: this.config.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        lastSyncTime: this.state.syncState.lastSyncTime?.toISOString(),
        syncedMessages: this.state.syncState.syncedMessages,
      },
    };

    await this.sendMessage(syncRequest);
  }

  /**
   * 获取当前状态
   */
  getState(): RemoteSessionState {
    return { ...this.state };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connection?.isConnected() ?? false;
  }

  /**
   * 处理连接建立
   */
  private handleConnect(): void {
    this.state.connectionState = 'connected';
    this.state.error = undefined;
    this.emit('connected');

    // 自动请求同步
    this.requestSync().catch((error) => {
      console.error('Failed to request sync:', error);
    });
  }

  /**
   * 处理连接断开
   */
  private handleDisconnect(): void {
    this.state.connectionState = 'disconnected';
    this.emit('disconnected');
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    this.state.connectionState = 'error';
    this.state.error = error;
    this.emit('error', error);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string | object): void {
    try {
      let message: RemoteMessage;

      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        message = data as RemoteMessage;
      }

      // 处理不同类型的消息
      switch (message.type) {
        case 'sync_response':
          this.handleSyncResponse(message);
          break;

        case 'message':
        case 'assistant_message':
        case 'tool_result':
          this.emit('message', message);
          break;

        case 'heartbeat':
          // 心跳消息，无需处理
          break;

        case 'error':
          this.handleRemoteError(message);
          break;

        default:
          console.warn('Unknown remote message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.emit('parse_error', error);
    }
  }

  /**
   * 处理同步响应
   */
  private handleSyncResponse(message: RemoteMessage): void {
    const payload = message.payload as {
      messages?: unknown[];
      totalMessages?: number;
      error?: string;
    };

    if (payload.error) {
      this.state.syncState.syncing = false;
      this.state.syncState.syncError = payload.error;
      this.emit('sync_error', payload.error);
      return;
    }

    this.state.syncState.syncing = false;
    this.state.syncState.lastSyncTime = new Date();
    this.state.syncState.syncedMessages = payload.totalMessages || 0;
    this.state.syncState.syncError = undefined;
    this.state.connectionState = 'connected';

    this.emit('sync_complete', payload);
  }

  /**
   * 处理远程错误
   */
  private handleRemoteError(message: RemoteMessage): void {
    const payload = message.payload as {
      error?: string;
      code?: string;
    };

    const error = new Error(payload.error || 'Remote session error');
    this.state.error = error;
    this.emit('remote_error', error, payload.code);
  }

  /**
   * 获取 WebSocket URL
   */
  private getWebSocketUrl(): string | null {
    if (!this.config.ingressUrl) {
      return null;
    }

    let url = this.config.ingressUrl;

    // 确保是 WebSocket URL
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      // 默认使用 wss://
      url = 'wss://' + url;
    }

    // 添加会话路径
    if (!url.includes('/teleport/')) {
      url = url.replace(/\/$/, '') + `/teleport/${this.config.sessionId}`;
    }

    return url;
  }
}

/**
 * 创建远程会话
 */
export function createRemoteSession(config: TeleportConfig): RemoteSession {
  return new RemoteSession(config);
}
