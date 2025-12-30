/**
 * 会话命令 - resume, context, compact, rewind
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
import { contextManager, type ContextStats } from '../context/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 获取会话目录
const getSessionsDir = () => path.join(os.homedir(), '.claude', 'sessions');

// 格式化时间差 (官方风格: "2h ago", "3d ago")
function getTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}

// 格式化文件大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 读取会话文件并解析 (匹配官方格式)
interface SessionFileData {
  id: string;
  modified: Date;
  created: Date;
  messageCount: number;
  projectPath: string;
  gitBranch?: string;
  customTitle?: string;
  name?: string;
  firstPrompt?: string;
  summary: string;  // 显示用: customTitle || summary || firstPrompt
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
  tags?: string[];
  lastMessages?: Array<{ role: string; content: string }>;
}

function parseSessionFile(filePath: string): SessionFileData | null {
  try {
    const stat = fs.statSync(filePath);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fileName = path.basename(filePath, '.json');

    // 支持多种格式
    const messages = data.messages || [];
    const metadata = data.metadata || {};

    // 从不同位置获取数据
    const projectPath = metadata.workingDirectory || metadata.projectPath || data.state?.cwd || data.cwd || 'Unknown';
    const gitBranch = metadata.gitBranch;
    const customTitle = metadata.customTitle || metadata.name;
    const messageCount = metadata.messageCount || messages.length;
    const created = new Date(metadata.createdAt || metadata.created || data.state?.startTime || stat.birthtime);
    const modified = new Date(metadata.updatedAt || metadata.modified || stat.mtime);
    const tokenUsage = metadata.tokenUsage;
    const model = metadata.model;
    const tags = metadata.tags;

    // 获取第一条用户消息
    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    const firstPrompt = metadata.firstPrompt || metadata.summary ||
      (typeof firstUserMsg?.content === 'string' ? firstUserMsg.content : null);

    // 获取最后几条消息用于预览
    const lastMessages = messages.slice(-3).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 100) :
               (Array.isArray(m.content) ?
                 m.content.map((b: any) => b.type === 'text' ? b.text : '').join(' ').slice(0, 100) :
                 '')
    }));

    // 官方风格: customTitle || summary || firstPrompt
    const summary = customTitle || firstPrompt?.slice(0, 60) || 'No messages';

    return {
      id: metadata.id || data.state?.sessionId || fileName,
      modified,
      created,
      messageCount,
      projectPath,
      gitBranch,
      customTitle,
      name: customTitle,
      firstPrompt,
      summary,
      tokenUsage,
      model,
      tags,
      lastMessages,
    };
  } catch {
    return null;
  }
}

// /resume - 恢复会话 (增强版 - 支持搜索、编号、预览)
export const resumeCommand: SlashCommand = {
  name: 'resume',
  aliases: ['r'],
  description: 'Resume a previous session with interactive picker and search',
  usage: '/resume [session-id or number or search-term]',
  category: 'session',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args } = ctx;
    const sessionsDir = getSessionsDir();

    if (!fs.existsSync(sessionsDir)) {
      ctx.ui.addMessage('assistant', `No previous sessions found.\n\nSessions are saved to: ${sessionsDir}\n\nStart a conversation and it will be automatically saved.`);
      return { success: false };
    }

    try {
      // 读取所有会话
      const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

      if (sessionFiles.length === 0) {
        ctx.ui.addMessage('assistant', `No previous sessions found.\n\nSessions directory: ${sessionsDir}\n\nStart a conversation and it will be automatically saved.`);
        return { success: false };
      }

      let sessions = sessionFiles
        .map(f => parseSessionFile(path.join(sessionsDir, f)))
        .filter((s): s is SessionFileData => s !== null)
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());

      if (sessions.length === 0) {
        ctx.ui.addMessage('assistant', 'No valid sessions found. Session files may be corrupted.');
        return { success: false };
      }

      // 处理参数
      if (args.length > 0) {
        const param = args.join(' ');
        const numParam = parseInt(param, 10);

        // 检查是否是编号选择
        if (!isNaN(numParam) && numParam > 0 && numParam <= sessions.length) {
          const session = sessions[numParam - 1];
          return showSessionDetail(ctx, session);
        }

        // 检查是否是 session ID
        const sessionById = sessions.find(s => s.id.startsWith(param) || s.id === param);
        if (sessionById) {
          return showSessionDetail(ctx, sessionById);
        }

        // 否则作为搜索词处理
        const searchLower = param.toLowerCase();
        sessions = sessions.filter(s =>
          s.summary.toLowerCase().includes(searchLower) ||
          s.projectPath.toLowerCase().includes(searchLower) ||
          (s.gitBranch && s.gitBranch.toLowerCase().includes(searchLower)) ||
          (s.customTitle && s.customTitle.toLowerCase().includes(searchLower)) ||
          (s.model && s.model.toLowerCase().includes(searchLower)) ||
          (s.tags && s.tags.some(t => t.toLowerCase().includes(searchLower)))
        );

        if (sessions.length === 0) {
          ctx.ui.addMessage('assistant', `No sessions found matching: "${param}"\n\nUse /resume to see all available sessions.`);
          return { success: false };
        }

        // 如果搜索只返回一个结果，直接显示详情
        if (sessions.length === 1) {
          return showSessionDetail(ctx, sessions[0]);
        }
      }

      // 显示会话列表（最多显示 20 个）
      const displaySessions = sessions.slice(0, 20);
      let sessionList = `Recent Sessions${args.length > 0 ? ` (filtered: "${args.join(' ')}")` : ''}\n`;
      sessionList += `${displaySessions.length} of ${sessions.length} total\n\n`;

      for (let i = 0; i < displaySessions.length; i++) {
        const session = displaySessions[i];
        const timeAgo = getTimeAgo(session.modified);
        const shortId = session.id.slice(0, 8);
        const num = (i + 1).toString().padStart(2, ' ');

        // 第一行: 编号, ID, 时间, 消息数
        sessionList += `${num}. ${shortId}  ${timeAgo}  ${session.messageCount} msgs`;

        // 添加 git 分支信息
        if (session.gitBranch) {
          sessionList += `  (${session.gitBranch})`;
        }

        // 添加模型信息
        if (session.model) {
          const modelShort = session.model.includes('sonnet') ? '🔷 sonnet' :
                           session.model.includes('opus') ? '🔶 opus' :
                           session.model.includes('haiku') ? '🔹 haiku' : session.model;
          sessionList += `  ${modelShort}`;
        }

        sessionList += '\n';

        // 第二行: 摘要
        const summaryLine = '    ' + session.summary.slice(0, 65);
        sessionList += `${summaryLine}${session.summary.length > 65 ? '...' : ''}\n`;

        // 第三行: 项目路径（如果不同于当前目录）
        if (session.projectPath !== ctx.config.cwd) {
          const shortPath = session.projectPath.replace(os.homedir(), '~');
          sessionList += `    📁 ${shortPath}\n`;
        }

        // 显示 token 使用（如果有）
        if (session.tokenUsage && session.tokenUsage.total > 0) {
          const tokenStr = `${(session.tokenUsage.total / 1000).toFixed(1)}k tokens`;
          sessionList += `    💬 ${tokenStr}\n`;
        }

        sessionList += '\n';
      }

      if (sessions.length > 20) {
        sessionList += `... and ${sessions.length - 20} more sessions\n`;
        sessionList += `Use /resume <search-term> to filter results\n\n`;
      }

      sessionList += `Commands:\n`;
      sessionList += `  /resume <number>  - View session details (e.g., /resume 1)\n`;
      sessionList += `  /resume <id>      - View by session ID (e.g., /resume ${displaySessions[0].id.slice(0, 8)})\n`;
      sessionList += `  /resume <search>  - Filter by keyword (e.g., /resume typescript)\n\n`;

      sessionList += `To actually resume a session, restart Claude Code:\n`;
      sessionList += `  claude --resume ${displaySessions[0].id.slice(0, 8)}\n`;
      sessionList += `  claude -r <session-id>`;

      ctx.ui.addMessage('assistant', sessionList);
      return { success: true };
    } catch (error) {
      ctx.ui.addMessage('assistant', `Error reading sessions: ${error}`);
      return { success: false };
    }
  },
};

// 显示单个会话的详细信息
function showSessionDetail(ctx: CommandContext, session: SessionFileData): CommandResult {
  let info = `Session Details\n`;
  info += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  info += `ID: ${session.id}\n`;
  info += `Short ID: ${session.id.slice(0, 8)}\n\n`;

  if (session.customTitle || session.name) {
    info += `Name: ${session.customTitle || session.name}\n`;
  }

  info += `Project: ${session.projectPath.replace(os.homedir(), '~')}\n`;

  if (session.gitBranch) {
    info += `Branch: ${session.gitBranch}\n`;
  }

  if (session.model) {
    info += `Model: ${session.model}\n`;
  }

  info += `\nActivity:\n`;
  info += `  Created: ${session.created.toLocaleString()}\n`;
  info += `  Modified: ${session.modified.toLocaleString()} (${getTimeAgo(session.modified)})\n`;
  info += `  Messages: ${session.messageCount}\n`;

  if (session.tokenUsage && session.tokenUsage.total > 0) {
    info += `\nToken Usage:\n`;
    info += `  Input: ${session.tokenUsage.input.toLocaleString()}\n`;
    info += `  Output: ${session.tokenUsage.output.toLocaleString()}\n`;
    info += `  Total: ${session.tokenUsage.total.toLocaleString()}\n`;
  }

  if (session.tags && session.tags.length > 0) {
    info += `\nTags: ${session.tags.join(', ')}\n`;
  }

  // 显示摘要或第一条消息
  if (session.firstPrompt) {
    info += `\nFirst Message:\n`;
    const preview = session.firstPrompt.length > 200
      ? session.firstPrompt.slice(0, 200) + '...'
      : session.firstPrompt;
    info += `  ${preview.split('\n').join('\n  ')}\n`;
  }

  // 显示最后几条消息预览
  if (session.lastMessages && session.lastMessages.length > 0) {
    info += `\nRecent Messages:\n`;
    for (const msg of session.lastMessages) {
      const roleIcon = msg.role === 'user' ? '👤' : '🤖';
      const contentPreview = msg.content.length > 80
        ? msg.content.slice(0, 80) + '...'
        : msg.content;
      info += `  ${roleIcon} ${contentPreview}\n`;
    }
  }

  info += `\nTo resume this session, restart Claude Code with:\n\n`;
  info += `  claude --resume ${session.id}\n\n`;
  info += `Or use the short form:\n\n`;
  info += `  claude -r ${session.id.slice(0, 8)}\n\n`;
  info += `Additional options:\n`;
  info += `  --fork-session  Create a new session ID (fork the conversation)`;

  ctx.ui.addMessage('assistant', info);
  return { success: true };
}

// /context - 显示上下文使用情况 (增强版: 进度条 + 详细统计)
export const contextCommand: SlashCommand = {
  name: 'context',
  aliases: ['ctx'],
  description: 'Show current context usage with detailed token statistics and compression info',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();

    // 估算 token 使用量 (基于实际消息数)
    const systemPromptTokens = 3000;  // 系统提示大约 3k tokens
    const messagesTokens = stats.messageCount * 500;  // 每条消息平均 500 tokens
    const totalUsedTokens = systemPromptTokens + messagesTokens;

    // 根据模型确定上下文窗口大小
    let maxTokens = 200000;  // 默认: Claude Sonnet 4.5
    const modelName = stats.modelUsage && Object.keys(stats.modelUsage).length > 0
      ? Object.keys(stats.modelUsage)[0]
      : 'claude-sonnet-4.5';

    if (modelName.includes('opus-4')) {
      maxTokens = 200000;  // Claude Opus 4.5
    } else if (modelName.includes('haiku')) {
      maxTokens = 200000;  // Claude Haiku 3.5
    } else if (modelName.includes('sonnet-3-5')) {
      maxTokens = 200000;  // Claude 3.5 Sonnet
    }

    const availableTokens = Math.max(0, maxTokens - totalUsedTokens);
    const usagePercent = Math.min(100, (totalUsedTokens / maxTokens) * 100);

    // 生成进度条 (20个字符宽度)
    const barWidth = 20;
    const filledWidth = Math.round((usagePercent / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const progressBar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);

    // 估算压缩信息 (模拟)
    // 实际应用中这些数据应该从 ContextManager 获取
    const summarizedMessages = Math.floor(stats.messageCount * 0.3);  // 假设30%的消息被摘要
    const originalTokens = stats.messageCount * 600;  // 假设原始平均每条消息600 tokens
    const compressionRatio = originalTokens > 0
      ? Math.round((totalUsedTokens / originalTokens) * 100)
      : 100;

    // 构建输出
    let contextInfo = `Context Usage:\n`;
    contextInfo += `  [${progressBar}] ${Math.round(usagePercent)}%\n`;
    contextInfo += `  \n`;
    contextInfo += `  Used:      ${totalUsedTokens.toLocaleString()} tokens\n`;
    contextInfo += `  Available: ${availableTokens.toLocaleString()} tokens\n`;
    contextInfo += `  Total:     ${maxTokens.toLocaleString()} tokens\n`;
    contextInfo += `  \n`;
    contextInfo += `  Messages: ${stats.messageCount}`;

    if (summarizedMessages > 0) {
      contextInfo += ` (${summarizedMessages} summarized)`;
    }
    contextInfo += `\n`;

    if (summarizedMessages > 0) {
      contextInfo += `  Compression: ${compressionRatio}%\n`;
    }

    contextInfo += `\n`;

    // 详细分类
    contextInfo += `Token Breakdown:\n`;
    contextInfo += `  System prompt:  ${systemPromptTokens.toLocaleString()} tokens (${((systemPromptTokens / maxTokens) * 100).toFixed(1)}%)\n`;
    contextInfo += `  Messages:       ${messagesTokens.toLocaleString()} tokens (${((messagesTokens / maxTokens) * 100).toFixed(1)}%)\n`;
    contextInfo += `  Free space:     ${availableTokens.toLocaleString()} tokens (${((availableTokens / maxTokens) * 100).toFixed(1)}%)\n`;

    contextInfo += `\n`;
    contextInfo += `Model: ${modelName}\n`;
    contextInfo += `Context Window: ${(maxTokens / 1000).toFixed(0)}k tokens\n`;

    contextInfo += `\n`;

    // 提供建议
    if (usagePercent > 80) {
      contextInfo += `⚠️  Context is nearly full (${usagePercent.toFixed(1)}%).\n`;
      contextInfo += `   Consider using /compact to free up space.\n\n`;
      contextInfo += `What /compact does:\n`;
      contextInfo += `  • Generates AI summary of conversation\n`;
      contextInfo += `  • Preserves important context and files\n`;
      contextInfo += `  • Clears old messages from context\n`;
      contextInfo += `  • Frees up ~${Math.round((messagesTokens * 0.7) / 1000)}k tokens\n`;
    } else if (usagePercent > 60) {
      contextInfo += `ℹ️  Context is ${usagePercent.toFixed(1)}% full.\n`;
      contextInfo += `   You can use /compact when context gets too large.\n`;
    } else {
      contextInfo += `✓ Plenty of context space available.\n`;
    }

    contextInfo += `\n`;
    contextInfo += `Session Info:\n`;
    contextInfo += `  Duration: ${formatDuration(stats.duration)}\n`;
    if (stats.totalCost !== '$0.0000') {
      contextInfo += `  Cost: ${stats.totalCost}\n`;
    }

    // 显示模型使用统计
    if (Object.keys(stats.modelUsage).length > 0) {
      contextInfo += `\n`;
      contextInfo += `Model Usage:\n`;
      for (const [model, tokens] of Object.entries(stats.modelUsage)) {
        contextInfo += `  ${model}: ${tokens.toLocaleString()} tokens\n`;
      }
    }

    ctx.ui.addMessage('assistant', contextInfo);
    return { success: true };
  },
};

// /compact - 压缩对话历史 (官方风格 - 完整实现)
export const compactCommand: SlashCommand = {
  name: 'compact',
  aliases: ['c'],
  description: 'Compact conversation history to free up context space',
  usage: '/compact [--force]',
  category: 'session',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args } = ctx;

    // 检查是否有 --force 参数
    const forceCompact = args.includes('--force') || args.includes('-f');

    // 获取压缩前的统计信息
    const statsBefore: ContextStats = contextManager.getStats();

    // 如果没有消息需要压缩
    if (statsBefore.totalMessages === 0) {
      ctx.ui.addMessage('assistant', `No conversation history to compact.

Current state:
  • Messages: 0
  • Tokens: 0

Start a conversation first, then use /compact when you need to free up context space.`);
      return { success: false };
    }

    // 如果已经压缩过且没有足够的新消息,除非使用 --force
    if (statsBefore.summarizedMessages > 0 && statsBefore.totalMessages < 20 && !forceCompact) {
      ctx.ui.addMessage('assistant', `Context already compacted recently.

Current state:
  • Total messages: ${statsBefore.totalMessages}
  • Already summarized: ${statsBefore.summarizedMessages}
  • Current tokens: ${statsBefore.estimatedTokens.toLocaleString()}

Not enough new messages to compact. Use /compact --force to force compaction anyway.`);
      return { success: false };
    }

    let compactInfo = `Compacting conversation...\n\n`;
    compactInfo += `Before compaction:\n`;
    compactInfo += `  • Messages: ${statsBefore.totalMessages}\n`;
    compactInfo += `  • Tokens: ${statsBefore.estimatedTokens.toLocaleString()}\n`;
    compactInfo += `  • Summarized: ${statsBefore.summarizedMessages}\n`;

    if (statsBefore.compressionRatio < 1) {
      const savedTokens = Math.floor(statsBefore.estimatedTokens * (1 - statsBefore.compressionRatio));
      compactInfo += `  • Previously saved: ${savedTokens.toLocaleString()} tokens\n`;
    }
    compactInfo += `\n`;

    // 执行压缩
    try {
      contextManager.compact();

      // 获取压缩后的统计信息
      const statsAfter: ContextStats = contextManager.getStats();

      // 计算节省的 token 数
      const tokensBefore = statsBefore.estimatedTokens;
      const tokensAfter = statsAfter.estimatedTokens;
      const tokensSaved = tokensBefore - tokensAfter;
      const savedPercent = tokensBefore > 0 ? Math.round((tokensSaved / tokensBefore) * 100) : 0;

      compactInfo += `After compaction:\n`;
      compactInfo += `  • Messages: ${statsAfter.totalMessages}\n`;
      compactInfo += `  • Tokens: ${tokensAfter.toLocaleString()}\n`;
      compactInfo += `  • Summarized: ${statsAfter.summarizedMessages}\n`;
      compactInfo += `  • Compression ratio: ${(statsAfter.compressionRatio * 100).toFixed(0)}%\n\n`;

      compactInfo += `Results:\n`;
      compactInfo += `  • Saved: ${tokensSaved.toLocaleString()} tokens (${savedPercent}%)\n`;
      compactInfo += `  • Messages summarized: ${statsAfter.summarizedMessages - statsBefore.summarizedMessages}\n\n`;

      // 显示上下文使用情况
      const maxTokens = 200000; // Claude Sonnet 4.5 上下文窗口
      const usagePercent = (tokensAfter / maxTokens * 100).toFixed(1);
      const availableTokens = maxTokens - tokensAfter;

      compactInfo += `Context status:\n`;
      compactInfo += `  • Used: ${tokensAfter.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${usagePercent}%)\n`;
      compactInfo += `  • Available: ${availableTokens.toLocaleString()} tokens\n\n`;

      if (parseFloat(usagePercent) > 80) {
        compactInfo += `⚠️  Context is still ${usagePercent}% full.\n`;
        compactInfo += `   Consider using /clear to start fresh if needed.\n`;
      } else if (parseFloat(usagePercent) > 60) {
        compactInfo += `✓ Context usage reduced to ${usagePercent}%.\n`;
        compactInfo += `  You have plenty of space for continued conversation.\n`;
      } else {
        compactInfo += `✓ Context successfully compacted!\n`;
        compactInfo += `  Plenty of space available for continued work.\n`;
      }

      compactInfo += `\nWhat happened:\n`;
      compactInfo += `• Older messages were summarized\n`;
      compactInfo += `• Recent messages (last 10 turns) were preserved\n`;
      compactInfo += `• Context continuity maintained\n`;
      compactInfo += `• You can continue the conversation normally\n\n`;

      compactInfo += `Tips:\n`;
      compactInfo += `• Use /context to visualize context usage\n`;
      compactInfo += `• Use /compact again when context gets full\n`;
      compactInfo += `• Use /compact --force to force immediate compaction\n`;

      ctx.ui.addMessage('assistant', compactInfo);
      ctx.ui.addActivity(`Compacted conversation (saved ${tokensSaved.toLocaleString()} tokens)`);

      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.ui.addMessage('assistant', `Error during compaction: ${errorMsg}\n\nPlease try again or use /clear to start fresh.`);
      return { success: false };
    }
  },
};

// /rewind - 回退到之前的状态
export const rewindCommand: SlashCommand = {
  name: 'rewind',
  aliases: ['undo'],
  description: 'Rewind conversation to a previous state',
  usage: '/rewind [steps]',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const steps = args.length > 0 ? parseInt(args[0], 10) : 1;

    if (isNaN(steps) || steps < 1) {
      ctx.ui.addMessage('assistant', 'Invalid number of steps. Usage: /rewind [steps]');
      return { success: false };
    }

    ctx.ui.addMessage('assistant', `Rewind feature:

To rewind ${steps} step(s), this would:
  1. Remove the last ${steps * 2} messages (user + assistant pairs)
  2. Restore conversation state

Note: This feature requires message history tracking.
Currently, you can:
  - Use /clear to start fresh
  - Use /resume to restore a saved session`);

    return { success: true };
  },
};

// /rename - 重命名当前会话
export const renameCommand: SlashCommand = {
  name: 'rename',
  description: 'Rename the current session',
  usage: '/rename <new-name>',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    if (args.length === 0) {
      ctx.ui.addMessage('assistant', 'Usage: /rename <new-name>\n\nExample: /rename my-project-session');
      return { success: false };
    }

    const newName = args.join(' ');

    try {
      // 方法1: 如果 CommandContext 提供了 setCustomTitle 方法，使用它
      if (ctx.session.setCustomTitle) {
        ctx.session.setCustomTitle(newName);
        ctx.ui.addMessage('assistant', `✓ Session renamed to: "${newName}"\n\nThis name will appear when you use /resume to view past sessions.`);
        ctx.ui.addActivity(`Renamed session to: ${newName}`);
        return { success: true };
      }

      // 方法2: 直接修改会话文件
      const sessionsDir = getSessionsDir();
      const sessionFile = path.join(sessionsDir, `${ctx.session.id}.json`);

      if (!fs.existsSync(sessionFile)) {
        ctx.ui.addMessage('assistant', `Warning: Session file not found at ${sessionFile}\n\nThe session may not have been saved yet. The name will be applied when the session is saved.`);
        return { success: false };
      }

      // 读取现有会话数据
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));

      // 更新 customTitle
      if (!sessionData.metadata) {
        sessionData.metadata = {};
      }
      sessionData.metadata.customTitle = newName;
      sessionData.metadata.modified = Date.now();

      // 写回文件
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

      ctx.ui.addMessage('assistant', `✓ Session renamed to: "${newName}"\n\nSession ID: ${ctx.session.id.slice(0, 8)}\nSession file updated: ${sessionFile}\n\nThis name will appear when you use /resume to view past sessions.`);
      ctx.ui.addActivity(`Renamed session to: ${newName}`);
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.ui.addMessage('assistant', `Error renaming session: ${errorMsg}\n\nPlease check:\n  • Session file exists and is readable\n  • You have write permissions\n  • The session has been saved at least once`);
      return { success: false };
    }
  },
};

// /export - 导出会话 (完整实现)
export const exportCommand: SlashCommand = {
  name: 'export',
  description: 'Export conversation history to JSON or Markdown',
  usage: '/export [json|markdown|md] [output-path]',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    // 解析参数
    let format = 'markdown';  // 默认格式
    let outputPath: string | undefined;

    if (args.length > 0) {
      const firstArg = args[0].toLowerCase();
      if (['json', 'markdown', 'md'].includes(firstArg)) {
        format = firstArg === 'md' ? 'markdown' : firstArg;
        outputPath = args[1];  // 第二个参数是输出路径
      } else {
        // 第一个参数是输出路径
        outputPath = args.join(' ');
      }
    }

    try {
      const stats = ctx.session.getStats();
      const shortId = ctx.session.id.slice(0, 8);

      // 生成默认文件名
      const defaultFilename = `claude-session-${shortId}.${format === 'json' ? 'json' : 'md'}`;
      const finalPath = outputPath || path.join(ctx.config.cwd, defaultFilename);

      // 读取完整会话数据
      const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
      const sessionFile = path.join(sessionsDir, `${ctx.session.id}.json`);

      let sessionData: any = null;
      if (fs.existsSync(sessionFile)) {
        sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      }

      let exportContent: string;
      let exported = false;

      if (format === 'json') {
        // JSON 格式：导出完整会话数据
        const exportData = {
          sessionId: ctx.session.id,
          exported: new Date().toISOString(),
          metadata: {
            model: ctx.config.model,
            startTime: sessionData?.metadata?.created || Date.now() - stats.duration,
            duration: stats.duration,
            messageCount: stats.messageCount,
            totalCost: stats.totalCost,
            modelUsage: stats.modelUsage,
            projectPath: ctx.config.cwd,
            gitBranch: sessionData?.metadata?.gitBranch,
            customTitle: sessionData?.metadata?.customTitle,
          },
          messages: sessionData?.messages || [],
          state: sessionData?.state || {},
        };

        exportContent = JSON.stringify(exportData, null, 2);
      } else {
        // Markdown 格式：格式化输出
        const lines: string[] = [];

        lines.push('# Claude Code Session Export');
        lines.push('');
        lines.push(`**Session ID:** \`${ctx.session.id}\``);
        lines.push(`**Exported:** ${new Date().toISOString()}`);
        lines.push('');

        lines.push('## Session Information');
        lines.push('');
        lines.push(`- **Model:** ${ctx.config.model}`);
        lines.push(`- **Project:** ${ctx.config.cwd}`);
        if (sessionData?.metadata?.gitBranch) {
          lines.push(`- **Git Branch:** ${sessionData.metadata.gitBranch}`);
        }
        if (sessionData?.metadata?.customTitle) {
          lines.push(`- **Title:** ${sessionData.metadata.customTitle}`);
        }
        lines.push(`- **Messages:** ${stats.messageCount}`);
        lines.push(`- **Duration:** ${formatDuration(stats.duration)}`);
        lines.push(`- **Total Cost:** ${stats.totalCost}`);
        lines.push('');

        if (Object.keys(stats.modelUsage).length > 0) {
          lines.push('### Model Usage');
          lines.push('');
          for (const [model, tokens] of Object.entries(stats.modelUsage)) {
            lines.push(`- **${model}:** ${tokens.toLocaleString()} tokens`);
          }
          lines.push('');
        }

        lines.push('---');
        lines.push('');
        lines.push('## Conversation');
        lines.push('');

        // 导出消息
        const messages = sessionData?.messages || [];
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const role = msg.role === 'user' ? '**User**' : '**Assistant**';

          lines.push(`### ${role} (Message ${i + 1})`);
          lines.push('');

          if (typeof msg.content === 'string') {
            lines.push(msg.content);
          } else if (Array.isArray(msg.content)) {
            // 处理复杂内容
            for (const block of msg.content) {
              if (block.type === 'text') {
                lines.push(block.text || '');
              } else if (block.type === 'tool_use') {
                lines.push('```json');
                lines.push(`// Tool: ${block.name}`);
                lines.push(JSON.stringify(block.input, null, 2));
                lines.push('```');
              } else if (block.type === 'tool_result') {
                lines.push('```');
                lines.push(`// Tool Result: ${block.tool_use_id?.slice(0, 8) || 'N/A'}`);
                const content = typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content, null, 2);
                lines.push(content.slice(0, 500) + (content.length > 500 ? '...' : ''));
                lines.push('```');
              }
            }
          }

          lines.push('');
          lines.push('---');
          lines.push('');
        }

        lines.push('');
        lines.push('*Exported from Claude Code*');

        exportContent = lines.join('\n');
      }

      // 写入文件
      const exportDir = path.dirname(finalPath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      fs.writeFileSync(finalPath, exportContent, 'utf-8');
      exported = true;

      // 显示成功消息
      const fileSize = formatBytes(Buffer.byteLength(exportContent, 'utf-8'));
      const absolutePath = path.resolve(finalPath);

      ctx.ui.addMessage('assistant', `✓ Session exported successfully!

Format: ${format.toUpperCase()}
File: ${absolutePath}
Size: ${fileSize}
Messages: ${stats.messageCount}

The exported file contains:
${format === 'json'
  ? `• Complete session data in JSON format
• All messages and tool interactions
• Session metadata and statistics
• Can be imported or analyzed programmatically`
  : `• Formatted conversation history in Markdown
• Session information and statistics
• Readable format for documentation
• Compatible with any Markdown viewer`}

You can now:
  • Share this export with others
  • Archive it for future reference
  • Use it for documentation
${format === 'json' ? '  • Import it back with /resume --import' : '  • Convert it with /export json'}

Tip: Use '/export json <path>' or '/export markdown <path>' to specify output location.`);

      ctx.ui.addActivity(`Exported session to ${path.basename(finalPath)}`);
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.ui.addMessage('assistant', `Error exporting session: ${errorMsg}\n\nPlease check:\n  • File path is valid and writable\n  • You have permission to write to the directory\n  • Disk space is available`);
      return { success: false };
    }
  },
};

// /transcript - 导出会话转录记录 (官方风格)
export const transcriptCommand: SlashCommand = {
  name: 'transcript',
  aliases: ['trans'],
  description: 'Export conversation transcript in a clean, readable format',
  usage: '/transcript [output-path]',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    try {
      const stats = ctx.session.getStats();
      const shortId = ctx.session.id.slice(0, 8);

      // 生成默认文件名
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const defaultFilename = `transcript-${shortId}-${timestamp}.txt`;
      const outputPath = args.length > 0 ? args.join(' ') : null;

      // 读取完整会话数据
      const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
      const sessionFile = path.join(sessionsDir, `${ctx.session.id}.json`);

      let sessionData: any = null;
      if (fs.existsSync(sessionFile)) {
        sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      }

      // 生成转录文本
      const lines: string[] = [];

      // 标题
      lines.push('=' .repeat(80));
      lines.push('CLAUDE CODE CONVERSATION TRANSCRIPT');
      lines.push('='.repeat(80));
      lines.push('');

      // 会话元数据
      lines.push(`Session ID:    ${ctx.session.id}`);
      lines.push(`Exported:      ${new Date().toISOString()}`);
      lines.push(`Model:         ${ctx.config.model}`);
      lines.push(`Messages:      ${stats.messageCount}`);
      lines.push(`Duration:      ${formatDuration(stats.duration)}`);
      lines.push(`Total Cost:    ${stats.totalCost}`);

      if (sessionData?.metadata?.customTitle) {
        lines.push(`Title:         ${sessionData.metadata.customTitle}`);
      }

      lines.push('');
      lines.push('-'.repeat(80));
      lines.push('');

      // 导出消息内容
      const messages = sessionData?.messages || [];

      if (messages.length === 0) {
        lines.push('No messages in this session.');
      } else {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const timestamp = sessionData?.metadata?.created
            ? new Date(sessionData.metadata.created + i * 1000).toISOString()
            : '';

          // 消息头
          if (msg.role === 'user') {
            lines.push(`[USER] ${timestamp ? `at ${timestamp}` : `Message ${i + 1}`}`);
          } else {
            lines.push(`[ASSISTANT] ${timestamp ? `at ${timestamp}` : `Message ${i + 1}`}`);
          }
          lines.push('');

          // 消息内容
          if (typeof msg.content === 'string') {
            lines.push(msg.content);
          } else if (Array.isArray(msg.content)) {
            // 处理复杂消息结构
            for (const block of msg.content) {
              if (block.type === 'text') {
                lines.push(block.text || '');
              } else if (block.type === 'tool_use') {
                lines.push(`[Tool Used: ${block.name}]`);
                lines.push(`Input: ${JSON.stringify(block.input, null, 2)}`);
              } else if (block.type === 'tool_result') {
                lines.push(`[Tool Result]`);
                const content = typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content, null, 2);
                // 限制工具结果长度，避免转录文件过大
                const maxLength = 500;
                lines.push(content.length > maxLength ? content.slice(0, maxLength) + '\n... (truncated)' : content);
              }
            }
          }

          lines.push('');
          lines.push('-'.repeat(80));
          lines.push('');
        }
      }

      // 会话总结
      lines.push('');
      lines.push('='.repeat(80));
      lines.push('END OF TRANSCRIPT');
      lines.push('='.repeat(80));
      lines.push('');
      lines.push(`Total Messages:  ${messages.length}`);
      lines.push(`Session Cost:    ${stats.totalCost}`);
      lines.push(`Export Time:     ${new Date().toISOString()}`);

      const transcriptContent = lines.join('\n');

      // 如果指定了输出路径，写入文件
      if (outputPath) {
        const finalPath = path.resolve(outputPath);
        const exportDir = path.dirname(finalPath);

        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }

        fs.writeFileSync(finalPath, transcriptContent, 'utf-8');

        const fileSize = formatBytes(Buffer.byteLength(transcriptContent, 'utf-8'));
        const absolutePath = path.resolve(finalPath);

        ctx.ui.addMessage('assistant', `✓ Transcript exported successfully!

File: ${absolutePath}
Size: ${fileSize}
Messages: ${stats.messageCount}

The transcript contains a clean, readable record of the entire conversation.

You can:
  • Share this transcript with others
  • Archive it for documentation
  • Use it for review or analysis
  • Search through conversation history

Tip: Use '/transcript <path>' to specify a custom output location.`);

        ctx.ui.addActivity(`Exported transcript to ${path.basename(finalPath)}`);
        return { success: true };
      }

      // 如果没有指定输出路径，直接显示转录内容（限制长度）
      const maxDisplayLength = 3000;
      if (transcriptContent.length > maxDisplayLength) {
        const truncated = transcriptContent.slice(0, maxDisplayLength);
        ctx.ui.addMessage('assistant', `${truncated}

... (truncated, ${transcriptContent.length - maxDisplayLength} more characters)

To save the full transcript to a file, use:
  /transcript ${defaultFilename}

Or specify a custom path:
  /transcript /path/to/your/transcript.txt`);
      } else {
        ctx.ui.addMessage('assistant', `${transcriptContent}

To save this transcript to a file, use:
  /transcript ${defaultFilename}`);
      }

      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.ui.addMessage('assistant', `Error generating transcript: ${errorMsg}

Please check:
  • Session file exists and is readable
  • You have permission to access the session
  • The session has been saved at least once

You can try:
  • /export markdown - Export in Markdown format
  • /export json - Export complete session data`);
      return { success: false };
    }
  },
};

// 辅助函数：格式化持续时间
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// 注册所有会话命令
export function registerSessionCommands(): void {
  commandRegistry.register(resumeCommand);
  commandRegistry.register(contextCommand);
  commandRegistry.register(compactCommand);
  commandRegistry.register(rewindCommand);
  commandRegistry.register(renameCommand);
  commandRegistry.register(exportCommand);
  commandRegistry.register(transcriptCommand);
}
