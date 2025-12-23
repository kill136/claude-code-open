/**
 * 会话管理系统
 * 支持会话持久化和恢复
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { Message, ContentBlock } from '../types/index.js';

// 会话存储目录
const SESSION_DIR = path.join(os.homedir(), '.claude', 'sessions');
const MAX_SESSIONS = 100; // 最多保存的会话数
const SESSION_EXPIRY_DAYS = 30; // 会话过期天数

export interface SessionMetadata {
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  model: string;
  messageCount: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  tags?: string[];
  summary?: string;
}

export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
  systemPrompt?: string;
  context?: Record<string, unknown>;
}

export interface SessionListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

/**
 * 确保会话目录存在
 */
function ensureSessionDir(): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * 获取会话文件路径
 */
function getSessionPath(sessionId: string): string {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

/**
 * 保存会话
 */
export function saveSession(session: SessionData): void {
  ensureSessionDir();

  const sessionPath = getSessionPath(session.metadata.id);
  session.metadata.updatedAt = Date.now();
  session.metadata.messageCount = session.messages.length;

  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });

  // 清理过期会话
  cleanupOldSessions();
}

/**
 * 加载会话
 */
export function loadSession(sessionId: string): SessionData | null {
  const sessionPath = getSessionPath(sessionId);

  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sessionPath, 'utf-8');
    return JSON.parse(content) as SessionData;
  } catch (err) {
    console.error(`Failed to load session ${sessionId}:`, err);
    return null;
  }
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  const sessionPath = getSessionPath(sessionId);

  if (!fs.existsSync(sessionPath)) {
    return false;
  }

  try {
    fs.unlinkSync(sessionPath);
    return true;
  } catch (err) {
    console.error(`Failed to delete session ${sessionId}:`, err);
    return false;
  }
}

/**
 * 列出所有会话
 */
export function listSessions(options: SessionListOptions = {}): SessionMetadata[] {
  ensureSessionDir();

  const {
    limit = 20,
    offset = 0,
    search,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    tags,
  } = options;

  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
  const sessions: SessionMetadata[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;
      sessions.push(session.metadata);
    } catch {
      // 忽略无法解析的文件
    }
  }

  // 过滤
  let filtered = sessions;

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name?.toLowerCase().includes(searchLower) ||
        s.summary?.toLowerCase().includes(searchLower) ||
        s.id.includes(searchLower)
    );
  }

  if (tags && tags.length > 0) {
    filtered = filtered.filter((s) => s.tags?.some((t) => tags.includes(t)));
  }

  // 排序
  filtered.sort((a, b) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  // 分页
  return filtered.slice(offset, offset + limit);
}

/**
 * 获取最近的会话
 */
export function getRecentSession(): SessionData | null {
  const sessions = listSessions({ limit: 1, sortBy: 'updatedAt', sortOrder: 'desc' });

  if (sessions.length === 0) {
    return null;
  }

  return loadSession(sessions[0].id);
}

/**
 * 获取特定目录的最近会话
 */
export function getSessionForDirectory(directory: string): SessionData | null {
  ensureSessionDir();

  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
  let latestSession: SessionData | null = null;
  let latestTime = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;

      if (
        session.metadata.workingDirectory === directory &&
        session.metadata.updatedAt > latestTime
      ) {
        latestSession = session;
        latestTime = session.metadata.updatedAt;
      }
    } catch {
      // 忽略
    }
  }

  return latestSession;
}

/**
 * 创建新会话
 */
export function createSession(options: {
  name?: string;
  model: string;
  workingDirectory?: string;
  systemPrompt?: string;
  tags?: string[];
}): SessionData {
  const now = Date.now();

  const session: SessionData = {
    metadata: {
      id: generateSessionId(),
      name: options.name,
      createdAt: now,
      updatedAt: now,
      workingDirectory: options.workingDirectory || process.cwd(),
      model: options.model,
      messageCount: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      tags: options.tags,
    },
    messages: [],
    systemPrompt: options.systemPrompt,
    context: {},
  };

  return session;
}

/**
 * 添加消息到会话
 */
export function addMessageToSession(
  session: SessionData,
  message: Message,
  tokenUsage?: { input: number; output: number }
): void {
  session.messages.push(message);
  session.metadata.messageCount = session.messages.length;
  session.metadata.updatedAt = Date.now();

  if (tokenUsage) {
    session.metadata.tokenUsage.input += tokenUsage.input;
    session.metadata.tokenUsage.output += tokenUsage.output;
    session.metadata.tokenUsage.total += tokenUsage.input + tokenUsage.output;
  }
}

/**
 * 更新会话摘要
 */
export function updateSessionSummary(session: SessionData, summary: string): void {
  session.metadata.summary = summary;
  session.metadata.updatedAt = Date.now();
}

/**
 * 清理过期会话
 */
function cleanupOldSessions(): void {
  ensureSessionDir();

  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
  const sessions: { file: string; updatedAt: number }[] = [];

  const expiryTime = Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;

      // 删除过期会话
      if (session.metadata.updatedAt < expiryTime) {
        fs.unlinkSync(path.join(SESSION_DIR, file));
        continue;
      }

      sessions.push({ file, updatedAt: session.metadata.updatedAt });
    } catch {
      // 删除无法解析的文件
      try {
        fs.unlinkSync(path.join(SESSION_DIR, file));
      } catch {}
    }
  }

  // 如果超过最大数量，删除最旧的
  if (sessions.length > MAX_SESSIONS) {
    sessions.sort((a, b) => a.updatedAt - b.updatedAt);
    const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS);

    for (const { file } of toDelete) {
      try {
        fs.unlinkSync(path.join(SESSION_DIR, file));
      } catch {}
    }
  }
}

/**
 * 导出会话为 Markdown
 */
export function exportSessionToMarkdown(session: SessionData): string {
  const lines: string[] = [];

  lines.push(`# Claude Session: ${session.metadata.name || session.metadata.id}`);
  lines.push('');
  lines.push(`- **Created:** ${new Date(session.metadata.createdAt).toISOString()}`);
  lines.push(`- **Updated:** ${new Date(session.metadata.updatedAt).toISOString()}`);
  lines.push(`- **Model:** ${session.metadata.model}`);
  lines.push(`- **Messages:** ${session.metadata.messageCount}`);
  lines.push(
    `- **Tokens:** ${session.metadata.tokenUsage.total} (${session.metadata.tokenUsage.input} in / ${session.metadata.tokenUsage.output} out)`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const message of session.messages) {
    const role = message.role === 'user' ? '👤 User' : '🤖 Assistant';
    lines.push(`## ${role}`);
    lines.push('');

    if (typeof message.content === 'string') {
      lines.push(message.content);
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text') {
          lines.push(block.text);
        } else if (block.type === 'tool_use') {
          lines.push(`\`\`\`json`);
          lines.push(`// Tool: ${block.name}`);
          lines.push(JSON.stringify(block.input, null, 2));
          lines.push('```');
        } else if (block.type === 'tool_result') {
          lines.push('**Tool Result:**');
          lines.push('```');
          lines.push(typeof block.content === 'string' ? block.content : JSON.stringify(block.content));
          lines.push('```');
        }
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 导入 Markdown 为会话（简化版）
 */
export function importSessionFromMarkdown(
  markdown: string,
  model: string
): SessionData {
  const session = createSession({ model });

  // 简单解析：按 "## 👤 User" 和 "## 🤖 Assistant" 分割
  const sections = markdown.split(/## (👤 User|🤖 Assistant)\n/);

  for (let i = 1; i < sections.length; i += 2) {
    const role = sections[i].includes('User') ? 'user' : 'assistant';
    const content = sections[i + 1]?.split('---')[0]?.trim() || '';

    if (content) {
      session.messages.push({
        role: role as 'user' | 'assistant',
        content,
      });
    }
  }

  session.metadata.messageCount = session.messages.length;
  return session;
}

/**
 * 压缩会话历史（用于 context 管理）
 */
export function compactSession(
  session: SessionData,
  maxMessages: number = 20
): SessionData {
  if (session.messages.length <= maxMessages) {
    return session;
  }

  // 保留最近的消息
  const recentMessages = session.messages.slice(-maxMessages);

  // 创建摘要消息（如果有之前的消息）
  const oldMessages = session.messages.slice(0, -maxMessages);
  const summaryText = `[Previous conversation compacted: ${oldMessages.length} messages omitted]`;

  const compactedSession: SessionData = {
    ...session,
    messages: [
      {
        role: 'user' as const,
        content: summaryText,
      },
      ...recentMessages,
    ],
  };

  return compactedSession;
}

/**
 * 会话管理器类
 */
export class SessionManager {
  private currentSession: SessionData | null = null;
  private autoSave: boolean;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(options: { autoSave?: boolean; autoSaveIntervalMs?: number } = {}) {
    this.autoSave = options.autoSave ?? true;

    if (this.autoSave) {
      const interval = options.autoSaveIntervalMs ?? 30000; // 30 秒
      this.autoSaveInterval = setInterval(() => {
        this.save();
      }, interval);
    }
  }

  /**
   * 开始新会话
   */
  start(options: {
    name?: string;
    model: string;
    workingDirectory?: string;
    systemPrompt?: string;
    resume?: boolean;
  }): SessionData {
    // 如果要恢复，尝试加载最近的会话
    if (options.resume) {
      const recent = getSessionForDirectory(options.workingDirectory || process.cwd());
      if (recent) {
        this.currentSession = recent;
        return this.currentSession;
      }
    }

    this.currentSession = createSession(options);
    return this.currentSession;
  }

  /**
   * 恢复会话
   */
  resume(sessionId: string): SessionData | null {
    const session = loadSession(sessionId);
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  /**
   * 获取当前会话
   */
  getCurrent(): SessionData | null {
    return this.currentSession;
  }

  /**
   * 添加消息
   */
  addMessage(
    message: Message,
    tokenUsage?: { input: number; output: number }
  ): void {
    if (this.currentSession) {
      addMessageToSession(this.currentSession, message, tokenUsage);
    }
  }

  /**
   * 保存当前会话
   */
  save(): void {
    if (this.currentSession) {
      saveSession(this.currentSession);
    }
  }

  /**
   * 结束会话
   */
  end(): void {
    this.save();
    this.currentSession = null;

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * 导出当前会话
   */
  export(): string | null {
    if (!this.currentSession) {
      return null;
    }
    return exportSessionToMarkdown(this.currentSession);
  }
}

// 默认实例
export const sessionManager = new SessionManager();
