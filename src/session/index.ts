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
  // Fork 相关元数据
  parentId?: string; // 父会话 ID（如果是 fork）
  forkPoint?: number; // 从父会话的哪个消息索引 fork
  branches?: string[]; // 子会话 ID 列表
  forkName?: string; // 分支名称
  mergedFrom?: string[]; // 合并自哪些会话
  cost?: number; // 会话成本（美元）
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

export interface SessionStatistics {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageMessagesPerSession: number;
  averageTokensPerSession: number;
  modelUsage: Record<string, number>;
  tagUsage: Record<string, number>;
  oldestSession?: SessionMetadata;
  newestSession?: SessionMetadata;
  mostActiveSession?: SessionMetadata;
}

export interface ForkOptions {
  fromMessageIndex?: number; // 从哪条消息开始 fork（默认：全部）
  name?: string; // 新会话名称
  tags?: string[]; // 新会话标签
  includeFutureMessages?: boolean; // 是否包含指定索引之后的消息（默认：true）
}

export interface MergeOptions {
  strategy?: 'append' | 'interleave' | 'replace'; // 合并策略
  keepMetadata?: 'source' | 'target' | 'merge'; // 元数据保留策略
  conflictResolution?: 'source' | 'target'; // 冲突解决策略
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
          lines.push(block.text || '');
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
 * Fork 会话（创建分支）
 */
export function forkSession(
  sourceSessionId: string,
  options: ForkOptions = {}
): SessionData | null {
  const sourceSession = loadSession(sourceSessionId);
  if (!sourceSession) {
    return null;
  }

  const {
    fromMessageIndex = 0,
    name,
    tags,
    includeFutureMessages = true,
  } = options;

  // 计算实际的消息索引
  const actualIndex = Math.max(0, Math.min(fromMessageIndex, sourceSession.messages.length));

  // 创建新会话
  const forkedSession = createSession({
    name: name || `${sourceSession.metadata.name || 'Session'} (fork)`,
    model: sourceSession.metadata.model,
    workingDirectory: sourceSession.metadata.workingDirectory,
    systemPrompt: sourceSession.systemPrompt,
    tags: tags || sourceSession.metadata.tags,
  });

  // 设置 fork 元数据
  forkedSession.metadata.parentId = sourceSessionId;
  forkedSession.metadata.forkPoint = actualIndex;
  forkedSession.metadata.forkName = name;

  // 复制消息
  if (includeFutureMessages) {
    forkedSession.messages = sourceSession.messages.slice(actualIndex);
  } else {
    forkedSession.messages = sourceSession.messages.slice(0, actualIndex);
  }

  forkedSession.metadata.messageCount = forkedSession.messages.length;

  // 更新源会话的分支列表
  if (!sourceSession.metadata.branches) {
    sourceSession.metadata.branches = [];
  }
  sourceSession.metadata.branches.push(forkedSession.metadata.id);
  saveSession(sourceSession);

  // 保存 fork 会话
  saveSession(forkedSession);

  return forkedSession;
}

/**
 * 合并会话
 */
export function mergeSessions(
  targetSessionId: string,
  sourceSessionId: string,
  options: MergeOptions = {}
): SessionData | null {
  const targetSession = loadSession(targetSessionId);
  const sourceSession = loadSession(sourceSessionId);

  if (!targetSession || !sourceSession) {
    return null;
  }

  const {
    strategy = 'append',
    keepMetadata = 'target',
    conflictResolution = 'target',
  } = options;

  // 合并消息
  let mergedMessages: Message[] = [];

  switch (strategy) {
    case 'append':
      // 将源会话的消息追加到目标会话
      mergedMessages = [...targetSession.messages, ...sourceSession.messages];
      break;

    case 'interleave':
      // 按时间戳交错合并（如果消息有时间戳的话）
      mergedMessages = [...targetSession.messages, ...sourceSession.messages].sort((a, b) => {
        // 简单实现：保持原有顺序
        return 0;
      });
      break;

    case 'replace':
      // 用源会话替换目标会话
      mergedMessages = sourceSession.messages;
      break;
  }

  targetSession.messages = mergedMessages;

  // 合并元数据
  if (keepMetadata === 'source') {
    targetSession.metadata = { ...sourceSession.metadata, id: targetSession.metadata.id };
  } else if (keepMetadata === 'merge') {
    // 合并标签
    const mergedTags = [
      ...(targetSession.metadata.tags || []),
      ...(sourceSession.metadata.tags || []),
    ];
    targetSession.metadata.tags = Array.from(new Set(mergedTags));

    // 合并 token 使用
    targetSession.metadata.tokenUsage.input +=
      sourceSession.metadata.tokenUsage.input;
    targetSession.metadata.tokenUsage.output +=
      sourceSession.metadata.tokenUsage.output;
    targetSession.metadata.tokenUsage.total +=
      sourceSession.metadata.tokenUsage.total;

    // 合并成本
    if (sourceSession.metadata.cost) {
      targetSession.metadata.cost =
        (targetSession.metadata.cost || 0) + sourceSession.metadata.cost;
    }
  }

  // 记录合并来源
  if (!targetSession.metadata.mergedFrom) {
    targetSession.metadata.mergedFrom = [];
  }
  targetSession.metadata.mergedFrom.push(sourceSessionId);

  // 更新消息计数和时间戳
  targetSession.metadata.messageCount = targetSession.messages.length;
  targetSession.metadata.updatedAt = Date.now();

  // 保存合并后的会话
  saveSession(targetSession);

  return targetSession;
}

/**
 * 获取会话分支树
 */
export function getSessionBranchTree(sessionId: string): {
  session: SessionMetadata;
  parent?: SessionMetadata;
  branches: SessionMetadata[];
} | null {
  const session = loadSession(sessionId);
  if (!session) {
    return null;
  }

  const result: {
    session: SessionMetadata;
    parent?: SessionMetadata;
    branches: SessionMetadata[];
  } = {
    session: session.metadata,
    branches: [],
  };

  // 加载父会话
  if (session.metadata.parentId) {
    const parent = loadSession(session.metadata.parentId);
    if (parent) {
      result.parent = parent.metadata;
    }
  }

  // 加载子会话
  if (session.metadata.branches) {
    for (const branchId of session.metadata.branches) {
      const branch = loadSession(branchId);
      if (branch) {
        result.branches.push(branch.metadata);
      }
    }
  }

  return result;
}

/**
 * 获取会话统计信息
 */
export function getSessionStatistics(): SessionStatistics {
  ensureSessionDir();

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

  const stats: SessionStatistics = {
    totalSessions: sessions.length,
    totalMessages: 0,
    totalTokens: 0,
    totalCost: 0,
    averageMessagesPerSession: 0,
    averageTokensPerSession: 0,
    modelUsage: {},
    tagUsage: {},
  };

  if (sessions.length === 0) {
    return stats;
  }

  let oldestTime = Infinity;
  let newestTime = 0;
  let mostMessages = 0;

  for (const session of sessions) {
    // 累计统计
    stats.totalMessages += session.messageCount;
    stats.totalTokens += session.tokenUsage.total;
    stats.totalCost += session.cost || 0;

    // 模型使用统计
    stats.modelUsage[session.model] = (stats.modelUsage[session.model] || 0) + 1;

    // 标签使用统计
    if (session.tags) {
      for (const tag of session.tags) {
        stats.tagUsage[tag] = (stats.tagUsage[tag] || 0) + 1;
      }
    }

    // 最旧会话
    if (session.createdAt < oldestTime) {
      oldestTime = session.createdAt;
      stats.oldestSession = session;
    }

    // 最新会话
    if (session.updatedAt > newestTime) {
      newestTime = session.updatedAt;
      stats.newestSession = session;
    }

    // 最活跃会话
    if (session.messageCount > mostMessages) {
      mostMessages = session.messageCount;
      stats.mostActiveSession = session;
    }
  }

  // 计算平均值
  stats.averageMessagesPerSession = stats.totalMessages / sessions.length;
  stats.averageTokensPerSession = stats.totalTokens / sessions.length;

  return stats;
}

/**
 * 导出会话为 JSON
 */
export function exportSessionToJSON(session: SessionData): string {
  return JSON.stringify(session, null, 2);
}

/**
 * 从 JSON 导入会话
 */
export function importSessionFromJSON(json: string): SessionData {
  const session = JSON.parse(json) as SessionData;

  // 生成新的会话 ID
  const oldId = session.metadata.id;
  session.metadata.id = generateSessionId();
  session.metadata.createdAt = Date.now();
  session.metadata.updatedAt = Date.now();

  // 清除分支信息（因为是新会话）
  delete session.metadata.branches;

  // 如果有父会话引用，保留它
  // session.metadata.parentId 保持不变（如果存在）

  return session;
}

/**
 * 导出会话为文件
 */
export function exportSessionToFile(
  sessionId: string,
  filePath: string,
  format: 'json' | 'markdown' = 'json'
): boolean {
  const session = loadSession(sessionId);
  if (!session) {
    return false;
  }

  try {
    const content =
      format === 'json'
        ? exportSessionToJSON(session)
        : exportSessionToMarkdown(session);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error(`Failed to export session to ${filePath}:`, err);
    return false;
  }
}

/**
 * 从文件导入会话
 */
export function importSessionFromFile(
  filePath: string,
  model?: string
): SessionData | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 尝试 JSON 格式
    try {
      const session = importSessionFromJSON(content);
      return session;
    } catch {
      // 尝试 Markdown 格式
      if (!model) {
        console.error('Model must be specified for Markdown import');
        return null;
      }
      return importSessionFromMarkdown(content, model);
    }
  } catch (err) {
    console.error(`Failed to import session from ${filePath}:`, err);
    return null;
  }
}

/**
 * 重命名会话
 */
export function renameSession(sessionId: string, newName: string): boolean {
  const session = loadSession(sessionId);
  if (!session) {
    return false;
  }

  session.metadata.name = newName;
  session.metadata.updatedAt = Date.now();
  saveSession(session);
  return true;
}

/**
 * 更新会话标签
 */
export function updateSessionTags(
  sessionId: string,
  tags: string[],
  mode: 'replace' | 'add' | 'remove' = 'replace'
): boolean {
  const session = loadSession(sessionId);
  if (!session) {
    return false;
  }

  const currentTags = session.metadata.tags || [];

  switch (mode) {
    case 'replace':
      session.metadata.tags = tags;
      break;
    case 'add':
      session.metadata.tags = Array.from(new Set([...currentTags, ...tags]));
      break;
    case 'remove':
      session.metadata.tags = currentTags.filter((t) => !tags.includes(t));
      break;
  }

  session.metadata.updatedAt = Date.now();
  saveSession(session);
  return true;
}

/**
 * 搜索会话消息内容
 */
export function searchSessionMessages(
  query: string,
  options: {
    sessionId?: string;
    caseSensitive?: boolean;
    regex?: boolean;
  } = {}
): Array<{
  sessionId: string;
  sessionName?: string;
  messageIndex: number;
  message: Message;
  matches: string[];
}> {
  const results: Array<{
    sessionId: string;
    sessionName?: string;
    messageIndex: number;
    message: Message;
    matches: string[];
  }> = [];

  ensureSessionDir();

  // 如果指定了会话 ID，只搜索该会话
  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;

      // 如果指定了会话 ID，跳过其他会话
      if (options.sessionId && session.metadata.id !== options.sessionId) {
        continue;
      }

      // 搜索消息
      session.messages.forEach((message, index) => {
        const messageText =
          typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);

        let isMatch = false;
        const matches: string[] = [];

        if (options.regex) {
          const pattern = new RegExp(
            query,
            options.caseSensitive ? 'g' : 'gi'
          );
          const regexMatches = messageText.match(pattern);
          if (regexMatches) {
            isMatch = true;
            matches.push(...regexMatches);
          }
        } else {
          const searchText = options.caseSensitive
            ? messageText
            : messageText.toLowerCase();
          const searchQuery = options.caseSensitive
            ? query
            : query.toLowerCase();

          if (searchText.includes(searchQuery)) {
            isMatch = true;
            matches.push(query);
          }
        }

        if (isMatch) {
          results.push({
            sessionId: session.metadata.id,
            sessionName: session.metadata.name,
            messageIndex: index,
            message,
            matches,
          });
        }
      });
    } catch {
      // 忽略无法解析的文件
    }
  }

  return results;
}

/**
 * 批量删除会话
 */
export function bulkDeleteSessions(
  sessionIds: string[],
  options: { force?: boolean } = {}
): { deleted: string[]; failed: string[] } {
  const result = { deleted: [] as string[], failed: [] as string[] };

  for (const sessionId of sessionIds) {
    // 如果不是强制删除，检查是否有分支
    if (!options.force) {
      const session = loadSession(sessionId);
      if (session?.metadata.branches && session.metadata.branches.length > 0) {
        result.failed.push(sessionId);
        console.warn(
          `Session ${sessionId} has branches. Use force option to delete.`
        );
        continue;
      }
    }

    if (deleteSession(sessionId)) {
      result.deleted.push(sessionId);
    } else {
      result.failed.push(sessionId);
    }
  }

  return result;
}

/**
 * 清理过期和无效会话
 */
export function cleanupSessions(options: {
  deleteExpired?: boolean;
  deleteOrphaned?: boolean;
  dryRun?: boolean;
} = {}): {
  expired: string[];
  orphaned: string[];
  invalid: string[];
} {
  ensureSessionDir();

  const result = {
    expired: [] as string[],
    orphaned: [] as string[],
    invalid: [] as string[],
  };

  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
  const expiryTime = Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const allSessionIds = new Set<string>();

  // 第一遍：收集所有有效的会话 ID
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;
      allSessionIds.add(session.metadata.id);
    } catch {
      // 无效文件
    }
  }

  // 第二遍：检查过期、孤立和无效的会话
  for (const file of files) {
    const sessionPath = path.join(SESSION_DIR, file);

    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      const session = JSON.parse(content) as SessionData;

      // 检查过期
      if (
        options.deleteExpired &&
        session.metadata.updatedAt < expiryTime
      ) {
        result.expired.push(session.metadata.id);
        if (!options.dryRun) {
          fs.unlinkSync(sessionPath);
        }
        continue;
      }

      // 检查孤立（父会话不存在）
      if (
        options.deleteOrphaned &&
        session.metadata.parentId &&
        !allSessionIds.has(session.metadata.parentId)
      ) {
        result.orphaned.push(session.metadata.id);
        if (!options.dryRun) {
          // 清除父会话引用而不是删除会话
          session.metadata.parentId = undefined;
          session.metadata.forkPoint = undefined;
          fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
        }
      }
    } catch {
      // 无效文件
      result.invalid.push(file);
      if (!options.dryRun) {
        fs.unlinkSync(sessionPath);
      }
    }
  }

  return result;
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
  export(format: 'json' | 'markdown' = 'markdown'): string | null {
    if (!this.currentSession) {
      return null;
    }
    return format === 'json'
      ? exportSessionToJSON(this.currentSession)
      : exportSessionToMarkdown(this.currentSession);
  }

  /**
   * Fork 当前会话
   */
  fork(options: ForkOptions = {}): SessionData | null {
    if (!this.currentSession) {
      return null;
    }

    const forkedSession = forkSession(this.currentSession.metadata.id, options);
    if (forkedSession) {
      // 切换到新的 fork 会话
      this.currentSession = forkedSession;
    }
    return forkedSession;
  }

  /**
   * 合并会话到当前会话
   */
  merge(sourceSessionId: string, options: MergeOptions = {}): boolean {
    if (!this.currentSession) {
      return false;
    }

    const merged = mergeSessions(
      this.currentSession.metadata.id,
      sourceSessionId,
      options
    );

    if (merged) {
      this.currentSession = merged;
      return true;
    }

    return false;
  }

  /**
   * 获取当前会话的分支树
   */
  getBranchTree(): {
    session: SessionMetadata;
    parent?: SessionMetadata;
    branches: SessionMetadata[];
  } | null {
    if (!this.currentSession) {
      return null;
    }
    return getSessionBranchTree(this.currentSession.metadata.id);
  }

  /**
   * 重命名当前会话
   */
  rename(newName: string): boolean {
    if (!this.currentSession) {
      return false;
    }

    this.currentSession.metadata.name = newName;
    this.currentSession.metadata.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * 更新当前会话的标签
   */
  updateTags(tags: string[], mode: 'replace' | 'add' | 'remove' = 'replace'): boolean {
    if (!this.currentSession) {
      return false;
    }

    const currentTags = this.currentSession.metadata.tags || [];

    switch (mode) {
      case 'replace':
        this.currentSession.metadata.tags = tags;
        break;
      case 'add':
        this.currentSession.metadata.tags = Array.from(new Set([...currentTags, ...tags]));
        break;
      case 'remove':
        this.currentSession.metadata.tags = currentTags.filter((t) => !tags.includes(t));
        break;
    }

    this.currentSession.metadata.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * 搜索当前会话的消息
   */
  searchMessages(
    query: string,
    options: {
      caseSensitive?: boolean;
      regex?: boolean;
    } = {}
  ): Array<{
    sessionId: string;
    sessionName?: string;
    messageIndex: number;
    message: Message;
    matches: string[];
  }> {
    if (!this.currentSession) {
      return [];
    }

    return searchSessionMessages(query, {
      ...options,
      sessionId: this.currentSession.metadata.id,
    });
  }

  /**
   * 导出当前会话到文件
   */
  exportToFile(filePath: string, format: 'json' | 'markdown' = 'json'): boolean {
    if (!this.currentSession) {
      return false;
    }

    return exportSessionToFile(
      this.currentSession.metadata.id,
      filePath,
      format
    );
  }

  /**
   * 更新会话成本
   */
  updateCost(inputTokens: number, outputTokens: number, model?: string): void {
    if (!this.currentSession) {
      return;
    }

    // 简化的成本计算（实际应该根据模型定价）
    const modelName = model || this.currentSession.metadata.model;
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

    this.currentSession.metadata.cost =
      (this.currentSession.metadata.cost || 0) + cost;
  }

  /**
   * 获取会话摘要
   */
  getSummary(): {
    id: string;
    name?: string;
    messageCount: number;
    tokenUsage: { input: number; output: number; total: number };
    cost?: number;
    createdAt: Date;
    updatedAt: Date;
    model: string;
    tags?: string[];
    hasBranches: boolean;
    branchCount: number;
  } | null {
    if (!this.currentSession) {
      return null;
    }

    const metadata = this.currentSession.metadata;

    return {
      id: metadata.id,
      name: metadata.name,
      messageCount: metadata.messageCount,
      tokenUsage: metadata.tokenUsage,
      cost: metadata.cost,
      createdAt: new Date(metadata.createdAt),
      updatedAt: new Date(metadata.updatedAt),
      model: metadata.model,
      tags: metadata.tags,
      hasBranches: !!metadata.branches && metadata.branches.length > 0,
      branchCount: metadata.branches?.length || 0,
    };
  }
}

// 默认实例
export const sessionManager = new SessionManager();

// 导出增强的列表功能
export {
  listSessionsEnhanced,
  getSessionDetails,
  searchSessions,
  bulkDeleteSessionsEnhanced,
  bulkExportSessions,
  bulkArchiveSessions,
  exportSession,
  exportMultipleSessions,
  getListStatistics,
  generateSessionReport,
  archiveSession,
  clearSessionCache,
} from './list.js';

export type {
  SessionFilter,
  SessionSummary,
  SessionDetails,
  ListSessionsResult,
  ExportOptions,
} from './list.js';
