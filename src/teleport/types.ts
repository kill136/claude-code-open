/**
 * Teleport 类型定义
 * 远程会话连接的数据结构
 */

/**
 * 远程会话配置
 */
export interface TeleportConfig {
  /** 会话 ID */
  sessionId: string;

  /** 远程服务器 URL (WebSocket) */
  ingressUrl?: string;

  /** 认证令牌 */
  authToken?: string;

  /** 会话元数据 */
  metadata?: {
    /** 会话仓库 */
    repo?: string;
    /** 会话分支 */
    branch?: string;
    /** 会话创建时间 */
    createdAt?: string;
    /** 最后更新时间 */
    updatedAt?: string;
  };
}

/**
 * 仓库验证状态
 */
export type RepoValidationStatus =
  | 'match'          // 仓库匹配
  | 'mismatch'       // 仓库不匹配
  | 'no_validation'  // 不需要验证
  | 'error';         // 验证错误

/**
 * 仓库验证结果
 */
export interface RepoValidationResult {
  /** 验证状态 */
  status: RepoValidationStatus;

  /** 会话仓库 */
  sessionRepo?: string;

  /** 当前仓库 */
  currentRepo?: string;

  /** 错误消息 */
  errorMessage?: string;
}

/**
 * 远程会话消息类型
 */
export type RemoteMessageType =
  | 'sync_request'      // 同步请求
  | 'sync_response'     // 同步响应
  | 'message'           // 用户消息
  | 'assistant_message' // 助手消息
  | 'tool_result'       // 工具执行结果
  | 'heartbeat'         // 心跳
  | 'error';            // 错误

/**
 * 远程会话消息
 */
export interface RemoteMessage {
  /** 消息类型 */
  type: RemoteMessageType;

  /** 消息 ID */
  id?: string;

  /** 会话 ID */
  sessionId: string;

  /** 消息内容 */
  payload: unknown;

  /** 时间戳 */
  timestamp: string;
}

/**
 * 同步状态
 */
export interface SyncState {
  /** 是否正在同步 */
  syncing: boolean;

  /** 最后同步时间 */
  lastSyncTime?: Date;

  /** 同步的消息数量 */
  syncedMessages: number;

  /** 同步错误 */
  syncError?: string;
}

/**
 * 连接状态
 */
export type ConnectionState =
  | 'disconnected'  // 未连接
  | 'connecting'    // 连接中
  | 'connected'     // 已连接
  | 'syncing'       // 同步中
  | 'error';        // 错误

/**
 * 远程会话状态
 */
export interface RemoteSessionState {
  /** 连接状态 */
  connectionState: ConnectionState;

  /** 同步状态 */
  syncState: SyncState;

  /** 会话配置 */
  config: TeleportConfig;

  /** 错误信息 */
  error?: Error;
}
