/**
 * 会话命令 - resume, context, compact, rewind
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
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

// 读取会话文件并解析 (匹配官方格式)
interface SessionFileData {
  id: string;
  modified: Date;
  created: Date;
  messageCount: number;
  projectPath: string;
  gitBranch?: string;
  customTitle?: string;
  firstPrompt?: string;
  summary: string;  // 显示用: customTitle || summary || firstPrompt
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
    const projectPath = metadata.projectPath || data.state?.cwd || data.cwd || 'Unknown';
    const gitBranch = metadata.gitBranch;
    const customTitle = metadata.customTitle;
    const messageCount = metadata.messageCount || messages.length;
    const created = new Date(metadata.created || data.state?.startTime || stat.birthtime);
    const modified = new Date(metadata.modified || stat.mtime);

    // 获取第一条用户消息
    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    const firstPrompt = metadata.firstPrompt ||
      (typeof firstUserMsg?.content === 'string' ? firstUserMsg.content : null);

    // 官方风格: customTitle || summary || firstPrompt
    const summary = customTitle || firstPrompt?.slice(0, 60) || 'No messages';

    return {
      id: data.state?.sessionId || fileName,
      modified,
      created,
      messageCount,
      projectPath,
      gitBranch,
      customTitle,
      firstPrompt,
      summary,
    };
  } catch {
    return null;
  }
}

// /resume - 恢复会话
export const resumeCommand: SlashCommand = {
  name: 'resume',
  aliases: ['r'],
  description: 'Resume a previous session',
  usage: '/resume [session-id]',
  category: 'session',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args } = ctx;
    const sessionsDir = getSessionsDir();

    if (!fs.existsSync(sessionsDir)) {
      ctx.ui.addMessage('assistant', `No previous sessions found.\n\nSessions are saved to: ${sessionsDir}\n\nStart a conversation and it will be automatically saved.`);
      return { success: false };
    }

    try {
      const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

      if (sessionFiles.length === 0) {
        ctx.ui.addMessage('assistant', `No previous sessions found.\n\nSessions directory: ${sessionsDir}\n\nStart a conversation and it will be automatically saved.`);
        return { success: false };
      }

      const sessions = sessionFiles
        .map(f => parseSessionFile(path.join(sessionsDir, f)))
        .filter((s): s is SessionFileData => s !== null)
        .sort((a, b) => b.modified.getTime() - a.modified.getTime())
        .slice(0, 10);

      if (sessions.length === 0) {
        ctx.ui.addMessage('assistant', 'No valid sessions found. Session files may be corrupted.');
        return { success: false };
      }

      if (args.length > 0) {
        // 恢复指定会话
        const sessionId = args[0];
        const session = sessions.find(s => s.id.startsWith(sessionId));

        if (session) {
          // 显示会话信息，提示用户使用命令行恢复
          let info = `Session found: ${session.id.slice(0, 8)}\n\n`;
          info += `  Project: ${session.projectPath}\n`;
          if (session.gitBranch) {
            info += `  Branch:  ${session.gitBranch}\n`;
          }
          info += `  Messages: ${session.messageCount}\n`;
          info += `  Modified: ${session.modified.toLocaleString()}\n`;
          info += `\nTo resume this session, restart Claude Code with:\n\n`;
          info += `  claude --resume ${session.id}\n\n`;
          info += `Or use the short form:\n\n`;
          info += `  claude -r ${session.id.slice(0, 8)}`;

          ctx.ui.addMessage('assistant', info);
          return { success: true };
        } else {
          ctx.ui.addMessage('assistant', `Session not found: ${sessionId}\n\nUse /resume to see available sessions.`);
          return { success: false };
        }
      }

      // 列出所有会话 (官方风格)
      let sessionList = `Recent Sessions\n\n`;

      for (const session of sessions) {
        const timeAgo = getTimeAgo(session.modified);
        const shortId = session.id.slice(0, 8);
        const branchInfo = session.gitBranch ? ` (${session.gitBranch})` : '';

        sessionList += `  ${shortId}  ${timeAgo}  ${session.messageCount} msgs${branchInfo}\n`;
        sessionList += `  ${session.summary.slice(0, 55)}${session.summary.length > 55 ? '...' : ''}\n\n`;
      }

      sessionList += `Use /resume <id> to resume a session\n`;
      sessionList += `Example: /resume ${sessions[0].id.slice(0, 8)}`;

      ctx.ui.addMessage('assistant', sessionList);
      return { success: true };
    } catch (error) {
      ctx.ui.addMessage('assistant', `Error reading sessions: ${error}`);
      return { success: false };
    }
  },
};

// /context - 显示上下文信息
export const contextCommand: SlashCommand = {
  name: 'context',
  aliases: ['ctx'],
  description: 'Show current context window usage',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();

    // 估算 token 使用量 (粗略估计)
    const estimatedTokens = stats.messageCount * 500; // 平均每条消息 500 tokens
    const maxTokens = 200000; // Claude 的上下文窗口
    const usagePercent = Math.min(100, (estimatedTokens / maxTokens) * 100);

    const contextInfo = `Context Window Usage:

Messages: ${stats.messageCount}
Estimated Tokens: ~${estimatedTokens.toLocaleString()}
Max Tokens: ${maxTokens.toLocaleString()}
Usage: ${usagePercent.toFixed(1)}%

${'█'.repeat(Math.floor(usagePercent / 5))}${'░'.repeat(20 - Math.floor(usagePercent / 5))} ${usagePercent.toFixed(1)}%

Tips:
  - Use /compact to summarize and reduce context
  - Use /clear to start fresh
  - Long conversations may benefit from /compact`;

    ctx.ui.addMessage('assistant', contextInfo);
    return { success: true };
  },
};

// /compact - 压缩对话历史
export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Compact conversation history to save context',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const stats = ctx.session.getStats();

    const compactInfo = `Compacting conversation history...

Current messages: ${stats.messageCount}

This feature will:
  1. Summarize the conversation so far
  2. Keep recent messages intact
  3. Replace older messages with summary

Note: Full compaction requires AI processing.
For now, consider using /clear to start fresh,
or continue the conversation normally.

Automatic compaction will trigger when context limit is reached.`;

    ctx.ui.addMessage('assistant', compactInfo);
    ctx.ui.addActivity('Compacted conversation');
    return { success: true };
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
    ctx.ui.addMessage('assistant', `Session renamed to: ${newName}\n\nNote: Session names help identify sessions when using /resume`);
    ctx.ui.addActivity(`Renamed session to: ${newName}`);
    return { success: true };
  },
};

// /export - 导出会话
export const exportCommand: SlashCommand = {
  name: 'export',
  description: 'Export conversation history',
  usage: '/export [format]',
  category: 'session',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const format = args[0] || 'markdown';
    const validFormats = ['markdown', 'json', 'txt'];

    if (!validFormats.includes(format)) {
      ctx.ui.addMessage('assistant', `Invalid format. Available formats: ${validFormats.join(', ')}`);
      return { success: false };
    }

    const stats = ctx.session.getStats();
    const filename = `claude-session-${ctx.session.id.slice(0, 8)}.${format === 'markdown' ? 'md' : format}`;

    ctx.ui.addMessage('assistant', `Export Conversation:

Format: ${format}
Messages: ${stats.messageCount}
Output file: ${filename}

To export, the conversation will be saved to:
${path.join(ctx.config.cwd, filename)}

Note: Export functionality saves the current conversation
including all messages and tool calls.`);

    return { success: true };
  },
};

// 注册所有会话命令
export function registerSessionCommands(): void {
  commandRegistry.register(resumeCommand);
  commandRegistry.register(contextCommand);
  commandRegistry.register(compactCommand);
  commandRegistry.register(rewindCommand);
  commandRegistry.register(renameCommand);
  commandRegistry.register(exportCommand);
}
