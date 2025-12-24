/**
 * 会话管理
 * 处理对话历史和状态
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { Message, SessionState, TodoItem } from '../types/index.js';

// 获取当前 git 分支
function getGitBranch(cwd: string): string | undefined {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

export class Session {
  private state: SessionState;
  private messages: Message[] = [];
  private configDir: string;
  private gitBranch?: string;
  private customTitle?: string;

  constructor(cwd: string = process.cwd()) {
    this.configDir = path.join(process.env.HOME || '~', '.claude');
    this.gitBranch = getGitBranch(cwd);
    this.state = {
      sessionId: uuidv4(),
      cwd,
      startTime: Date.now(),
      totalCostUSD: 0,
      totalAPIDuration: 0,
      modelUsage: {},
      todos: [],
    };

    // 确保配置目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  get sessionId(): string {
    return this.state.sessionId;
  }

  get cwd(): string {
    return this.state.cwd;
  }

  setCwd(cwd: string): void {
    this.state.cwd = cwd;
    process.chdir(cwd);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  clearMessages(): void {
    this.messages = [];
  }

  getTodos(): TodoItem[] {
    return [...this.state.todos];
  }

  setTodos(todos: TodoItem[]): void {
    this.state.todos = [...todos];
  }

  updateUsage(model: string, tokens: number, cost: number, duration: number): void {
    this.state.modelUsage[model] = (this.state.modelUsage[model] || 0) + tokens;
    this.state.totalCostUSD += cost;
    this.state.totalAPIDuration += duration;
  }

  getStats(): {
    duration: number;
    totalCost: string;
    messageCount: number;
    modelUsage: Record<string, number>;
  } {
    return {
      duration: Date.now() - this.state.startTime,
      totalCost: `$${this.state.totalCostUSD.toFixed(4)}`,
      messageCount: this.messages.length,
      modelUsage: { ...this.state.modelUsage },
    };
  }

  // 设置自定义标题
  setCustomTitle(title: string): void {
    this.customTitle = title;
  }

  // 获取第一条用户消息作为摘要
  getFirstPrompt(): string | undefined {
    const firstUserMessage = this.messages.find(m => m.role === 'user');
    if (firstUserMessage && typeof firstUserMessage.content === 'string') {
      return firstUserMessage.content.slice(0, 100);
    }
    return undefined;
  }

  // 保存会话到文件
  save(): string {
    const sessionFile = path.join(this.configDir, 'sessions', `${this.state.sessionId}.json`);
    const sessionDir = path.dirname(sessionFile);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // 匹配官方格式，添加更多元数据
    const data = {
      state: this.state,
      messages: this.messages,
      // 额外元数据 (官方风格)
      metadata: {
        gitBranch: this.gitBranch,
        customTitle: this.customTitle,
        firstPrompt: this.getFirstPrompt(),
        projectPath: this.state.cwd,
        created: this.state.startTime,
        modified: Date.now(),
        messageCount: this.messages.length,
      },
    };

    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
    return sessionFile;
  }

  // 从文件加载会话
  static load(sessionId: string): Session | null {
    const configDir = path.join(process.env.HOME || '~', '.claude');
    const sessionFile = path.join(configDir, 'sessions', `${sessionId}.json`);

    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      const session = new Session(data.state.cwd);
      session.state = data.state;
      session.messages = data.messages;
      return session;
    } catch {
      return null;
    }
  }

  // 列出所有会话
  static listSessions(): Array<{ id: string; startTime: number; cwd: string }> {
    const configDir = path.join(process.env.HOME || '~', '.claude');
    const sessionsDir = path.join(configDir, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      return [];
    }

    return fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
          return {
            id: data.state.sessionId,
            startTime: data.state.startTime,
            cwd: data.state.cwd,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.startTime - a.startTime);
  }
}
