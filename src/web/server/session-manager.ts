/**
 * WebUI 会话管理器
 * 复用 CLI 会话管理功能,为 WebUI 提供持久化支持
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Message } from '../../types/index.js';
import type { ChatMessage } from '../shared/types.js';
import {
  SessionData,
  SessionMetadata,
  createSession,
  saveSession,
  loadSession,
  deleteSession,
  listSessions,
  generateSessionId,
  addMessageToSession,
  SessionListOptions,
} from '../../session/index.js';

// 会话存储目录
const SESSION_DIR = path.join(os.homedir(), '.claude', 'sessions');

/**
 * WebUI 会话扩展数据
 */
export interface WebSessionData extends SessionData {
  chatHistory?: ChatMessage[]; // WebUI 聊天历史
  currentModel?: string; // 当前使用的模型
}

/**
 * WebUI 会话元数据扩展
 */
export interface WebSessionMetadata extends SessionMetadata {
  lastModel?: string; // 最后使用的模型
  isActive?: boolean; // 是否是活跃会话
}

/**
 * WebUI 会话管理器
 */
export class WebSessionManager {
  private sessions = new Map<string, WebSessionData>();
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.ensureSessionDir();
  }

  /**
   * 确保会话目录存在
   */
  private ensureSessionDir(): void {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
  }

  /**
   * 创建新会话
   */
  createSession(options: {
    name?: string;
    model: string;
    systemPrompt?: string;
    tags?: string[];
  }): WebSessionData {
    const session = createSession({
      name: options.name,
      model: options.model,
      workingDirectory: this.cwd,
      systemPrompt: options.systemPrompt,
      tags: options.tags,
    }) as WebSessionData;

    // 添加 WebUI 扩展字段
    session.chatHistory = [];
    session.currentModel = options.model;

    // 缓存到内存
    this.sessions.set(session.metadata.id, session);

    // 立即保存
    this.saveSession(session.metadata.id);

    return session;
  }

  /**
   * 加载会话
   */
  loadSessionById(sessionId: string): WebSessionData | null {
    // 先从内存缓存查找
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // 从磁盘加载
    const session = loadSession(sessionId) as WebSessionData | null;
    if (session) {
      // 初始化 WebUI 扩展字段
      if (!session.chatHistory) {
        session.chatHistory = [];
      }
      if (!session.currentModel) {
        session.currentModel = session.metadata.model;
      }

      // 缓存到内存
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * 保存会话
   */
  saveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      saveSession(session);
      return true;
    } catch (error) {
      console.error(`保存会话失败 ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    // 从内存删除
    this.sessions.delete(sessionId);

    // 从磁盘删除
    return deleteSession(sessionId);
  }

  /**
   * 列出所有会话
   */
  listSessions(options?: SessionListOptions): SessionMetadata[] {
    return listSessions(options);
  }

  /**
   * 添加消息到会话
   */
  addMessage(
    sessionId: string,
    message: Message,
    tokenUsage?: { input: number; output: number }
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    addMessageToSession(session, message, tokenUsage);

    // 更新成本
    if (tokenUsage) {
      this.updateCost(sessionId, tokenUsage.input, tokenUsage.output, session.currentModel);
    }

    // 自动保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 添加聊天消息到会话
   */
  addChatMessage(sessionId: string, chatMessage: ChatMessage): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (!session.chatHistory) {
      session.chatHistory = [];
    }

    session.chatHistory.push(chatMessage);

    // 自动保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 获取会话的聊天历史
   */
  getChatHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session?.chatHistory || [];
  }

  /**
   * 清除会话的聊天历史
   */
  clearChatHistory(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.messages = [];
    session.chatHistory = [];
    session.metadata.messageCount = 0;
    session.metadata.tokenUsage = { input: 0, output: 0, total: 0 };
    session.metadata.cost = 0;

    // 保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 获取会话的核心消息列表（用于 API 调用）
   */
  getMessages(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  /**
   * 设置会话模型
   */
  setModel(sessionId: string, model: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.currentModel = model;
    session.metadata.model = model;

    // 保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 获取会话元数据
   */
  getMetadata(sessionId: string): SessionMetadata | null {
    const session = this.sessions.get(sessionId);
    return session?.metadata || null;
  }

  /**
   * 重命名会话
   */
  renameSession(sessionId: string, newName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.metadata.name = newName;
    session.metadata.updatedAt = Date.now();

    // 保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 更新会话标签
   */
  updateTags(sessionId: string, tags: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.metadata.tags = tags;
    session.metadata.updatedAt = Date.now();

    // 保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 更新会话摘要
   */
  updateSummary(sessionId: string, summary: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.metadata.summary = summary;
    session.metadata.updatedAt = Date.now();

    // 保存
    this.saveSession(sessionId);

    return true;
  }

  /**
   * 更新会话成本
   */
  private updateCost(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    model?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 简化的成本计算（每百万 token 的美元价格）
    const modelName = model || session.metadata.model;
    let costPerMillion = { input: 3, output: 15 }; // 默认 Sonnet 定价

    // 根据模型调整定价
    if (modelName.includes('opus')) {
      costPerMillion = { input: 15, output: 75 };
    } else if (modelName.includes('haiku')) {
      costPerMillion = { input: 0.25, output: 1.25 };
    }

    const cost =
      (inputTokens / 1_000_000) * costPerMillion.input +
      (outputTokens / 1_000_000) * costPerMillion.output;

    session.metadata.cost = (session.metadata.cost || 0) + cost;
  }

  /**
   * 获取或创建默认会话
   */
  getOrCreateDefaultSession(model: string = 'sonnet'): WebSessionData {
    // 尝试加载最近的会话
    const recentSessions = this.listSessions({ limit: 1, sortBy: 'updatedAt', sortOrder: 'desc' });

    if (recentSessions.length > 0) {
      const sessionId = recentSessions[0].id;
      const session = this.loadSessionById(sessionId);
      if (session) {
        return session;
      }
    }

    // 创建新会话
    return this.createSession({
      name: `WebUI 会话 - ${new Date().toLocaleString('zh-CN')}`,
      model,
      tags: ['webui'],
    });
  }

  /**
   * 导出会话为 JSON
   */
  exportSessionJSON(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * 导出会话为 Markdown
   */
  exportSessionMarkdown(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const lines: string[] = [];

    // 标题
    lines.push(`# ${session.metadata.name || session.metadata.id}`);
    lines.push('');

    // 元数据
    lines.push('## 会话信息');
    lines.push('');
    lines.push(`- **ID:** ${session.metadata.id}`);
    lines.push(`- **创建时间:** ${new Date(session.metadata.createdAt).toLocaleString('zh-CN')}`);
    lines.push(`- **更新时间:** ${new Date(session.metadata.updatedAt).toLocaleString('zh-CN')}`);
    lines.push(`- **模型:** ${session.metadata.model}`);
    lines.push(`- **消息数:** ${session.metadata.messageCount}`);

    if (session.metadata.cost) {
      lines.push(`- **成本:** $${session.metadata.cost.toFixed(4)}`);
    }

    lines.push(
      `- **Token 使用:** ${session.metadata.tokenUsage.total} (输入: ${session.metadata.tokenUsage.input} / 输出: ${session.metadata.tokenUsage.output})`
    );

    if (session.metadata.tags && session.metadata.tags.length > 0) {
      lines.push(`- **标签:** ${session.metadata.tags.join(', ')}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    // 对话内容
    lines.push('## 对话内容');
    lines.push('');

    if (session.chatHistory && session.chatHistory.length > 0) {
      for (const msg of session.chatHistory) {
        const role = msg.role === 'user' ? '👤 用户' : '🤖 助手';
        lines.push(`### ${role}`);
        lines.push('');

        for (const content of msg.content) {
          if (content.type === 'text') {
            lines.push(content.text);
          } else if (content.type === 'tool_use') {
            lines.push(`**工具调用:** ${content.name}`);
            lines.push('```json');
            lines.push(JSON.stringify(content.input, null, 2));
            lines.push('```');
          } else if (content.type === 'tool_result') {
            lines.push('**工具结果:**');
            lines.push('```');
            lines.push(content.output || content.error || '');
            lines.push('```');
          }
        }

        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取会话统计信息
   */
  getSessionStats(sessionId: string): {
    messageCount: number;
    tokenUsage: { input: number; output: number; total: number };
    cost: number;
    duration: number;
    createdAt: number;
    updatedAt: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      messageCount: session.metadata.messageCount,
      tokenUsage: session.metadata.tokenUsage,
      cost: session.metadata.cost || 0,
      duration: session.metadata.updatedAt - session.metadata.createdAt,
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt,
    };
  }

  /**
   * 清理过期会话（从内存中）
   */
  cleanupMemoryCache(): void {
    const maxAge = 30 * 60 * 1000; // 30 分钟
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.metadata.updatedAt > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

/**
 * 生成新的会话 ID
 */
export { generateSessionId };
