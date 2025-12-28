/**
 * Teleport - 远程会话连接模块
 *
 * 功能：
 * - 连接到远程 Claude Code 会话
 * - 实时同步消息和状态
 * - 断线重连
 * - 仓库验证
 *
 * 使用示例：
 * ```typescript
 * import { createRemoteSession } from './teleport/index.js';
 *
 * const session = createRemoteSession({
 *   sessionId: 'uuid-here',
 *   ingressUrl: 'wss://example.com/teleport',
 *   authToken: 'token-here',
 * });
 *
 * await session.connect();
 * session.on('message', (msg) => console.log(msg));
 * ```
 */

// 类型定义
export type {
  TeleportConfig,
  RepoValidationResult,
  RepoValidationStatus,
  RemoteMessage,
  RemoteMessageType,
  RemoteSessionState,
  ConnectionState,
  SyncState,
} from './types.js';

// 远程会话
export { RemoteSession, createRemoteSession } from './session.js';

// 仓库验证
export {
  validateSessionRepository,
  getCurrentRepoUrl,
  normalizeRepoUrl,
  compareRepoUrls,
  getCurrentBranch,
  isWorkingDirectoryClean,
} from './validation.js';

/**
 * 从会话 ID 连接到远程会话
 *
 * @param sessionId 会话 ID
 * @param ingressUrl 远程服务器 URL（可选，会尝试从配置或发现服务获取）
 * @param authToken 认证令牌（可选）
 * @returns RemoteSession 实例
 */
export async function connectToRemoteSession(
  sessionId: string,
  ingressUrl?: string,
  authToken?: string
): Promise<import('./session.js').RemoteSession> {
  const { createRemoteSession } = await import('./session.js');

  // 如果没有提供 ingressUrl，尝试从环境变量获取
  const url = ingressUrl || process.env.CLAUDE_TELEPORT_URL;

  if (!url) {
    throw new Error(
      'No ingress URL provided. Set CLAUDE_TELEPORT_URL environment variable or pass it as parameter.'
    );
  }

  const session = createRemoteSession({
    sessionId,
    ingressUrl: url,
    authToken: authToken || process.env.CLAUDE_TELEPORT_TOKEN,
  });

  await session.connect();
  return session;
}

/**
 * 检查会话是否可以进行 teleport
 *
 * @param sessionId 会话 ID
 * @returns 是否可以 teleport
 */
export async function canTeleportToSession(sessionId: string): Promise<boolean> {
  try {
    // 检查会话是否存在（这里简化处理，实际应该查询远程服务）
    // 检查当前是否在 git 仓库中
    const { getCurrentRepoUrl } = await import('./validation.js');
    const currentRepo = await getCurrentRepoUrl();

    // 如果不在 git 仓库中，仍然允许 teleport（某些会话可能不需要仓库验证）
    return true;
  } catch (error) {
    console.warn('Failed to check teleport availability:', error);
    return false;
  }
}
