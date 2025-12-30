/**
 * 会话管理
 * 处理对话历史和状态
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Message, SessionState, TodoItem } from '../types/index.js';
import { GitUtils, type GitInfo } from '../git/index.js';

// 会话版本号
const SESSION_VERSION = '2.0';

export class Session {
  private state: SessionState;
  private messages: Message[] = [];
  private configDir: string;
  private originalCwd: string; // T153: 追踪原始工作目录
  private gitInfo?: GitInfo;
  private customTitle?: string;
  private isLocked: boolean = false; // T157: 会话锁定状态
  private lockFile?: string; // T157: 锁文件路径

  constructor(cwd: string = process.cwd()) {
    // T145: 支持 CLAUDE_CONFIG_DIR 环境变量
    this.configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    this.originalCwd = cwd; // T153: 保存原始工作目录

    // T144: 使用 crypto.randomUUID() 代替 uuid 包
    this.state = {
      sessionId: randomUUID(),
      cwd,
      originalCwd: cwd, // T153: 添加原始目录字段
      startTime: Date.now(),
      totalCostUSD: 0,
      totalAPIDuration: 0,
      totalAPIDurationWithoutRetries: 0, // T143: 区分重试前后的时间
      totalToolDuration: 0, // T143: 工具执行时间统计
      totalLinesAdded: 0, // 代码修改统计：添加的行数
      totalLinesRemoved: 0, // 代码修改统计：删除的行数
      modelUsage: {},
      todos: [],
    };

    // 确保配置目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 异步初始化 Git 信息
   * 应该在创建 Session 后立即调用
   */
  async initializeGitInfo(): Promise<void> {
    try {
      this.gitInfo = await GitUtils.getGitInfo(this.state.cwd) || undefined;
    } catch (error) {
      // Git 信息获取失败不影响 session 创建
      this.gitInfo = undefined;
    }
  }

  /**
   * 获取 Git 信息
   */
  getGitInfo(): GitInfo | undefined {
    return this.gitInfo;
  }

  /**
   * 获取 Git 分支名 (兼容旧代码)
   */
  getGitBranch(): string | undefined {
    return this.gitInfo?.branchName;
  }

  /**
   * 获取格式化的 Git 状态文本
   */
  getFormattedGitStatus(): string | undefined {
    if (!this.gitInfo) {
      return undefined;
    }
    return GitUtils.formatGitStatus(this.gitInfo);
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

  /**
   * T151/T152: 更新详细的使用统计
   */
  updateUsage(
    model: string,
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens?: number;
      cacheCreationInputTokens?: number;
      thinkingTokens?: number;
      webSearchRequests?: number;
    },
    cost: number,
    duration: number,
    durationWithoutRetries?: number
  ): void {
    // 初始化模型使用统计
    if (!this.state.modelUsage[model]) {
      this.state.modelUsage[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        thinkingTokens: 0,
        webSearchRequests: 0,
        requests: 0,
        costUSD: 0,
        contextWindow: this.getContextWindow(model),
      };
    }

    // 更新统计
    const stats = this.state.modelUsage[model];
    stats.inputTokens += usage.inputTokens;
    stats.outputTokens += usage.outputTokens;
    stats.cacheReadInputTokens = (stats.cacheReadInputTokens || 0) + (usage.cacheReadInputTokens || 0);
    stats.cacheCreationInputTokens = (stats.cacheCreationInputTokens || 0) + (usage.cacheCreationInputTokens || 0);
    stats.thinkingTokens = (stats.thinkingTokens || 0) + (usage.thinkingTokens || 0);
    stats.webSearchRequests = (stats.webSearchRequests || 0) + (usage.webSearchRequests || 0);
    stats.requests = (stats.requests || 0) + 1; // 增加请求计数
    stats.costUSD += cost;

    // 更新总计
    this.state.totalCostUSD += cost;
    this.state.totalAPIDuration += duration;
    if (durationWithoutRetries !== undefined) {
      this.state.totalAPIDurationWithoutRetries =
        (this.state.totalAPIDurationWithoutRetries || 0) + durationWithoutRetries;
    }
  }

  /**
   * T143: 更新工具执行时间
   */
  updateToolDuration(duration: number): void {
    this.state.totalToolDuration = (this.state.totalToolDuration || 0) + duration;
  }

  /**
   * 更新成本（对应官方的 MT0 函数）
   */
  updateCost(
    costUSD: number,
    modelUsage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      thinkingTokens?: number;
    },
    model: string
  ): void {
    // 初始化模型使用统计
    if (!this.state.modelUsage[model]) {
      this.state.modelUsage[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        thinkingTokens: 0,
        webSearchRequests: 0,
        requests: 0,
        costUSD: 0,
        contextWindow: this.getContextWindow(model),
      };
    }

    // 更新统计
    const stats = this.state.modelUsage[model];
    stats.inputTokens += modelUsage.inputTokens;
    stats.outputTokens += modelUsage.outputTokens;
    stats.cacheReadInputTokens = (stats.cacheReadInputTokens || 0) + (modelUsage.cacheReadTokens || 0);
    stats.cacheCreationInputTokens = (stats.cacheCreationInputTokens || 0) + (modelUsage.cacheWriteTokens || 0);
    stats.thinkingTokens = (stats.thinkingTokens || 0) + (modelUsage.thinkingTokens || 0);
    stats.requests = (stats.requests || 0) + 1;
    stats.costUSD += costUSD;

    // 更新总成本
    this.state.totalCostUSD += costUSD;
  }

  /**
   * 更新 API 时长（对应官方的 OT0 函数）
   */
  updateAPIDuration(duration: number, durationWithoutRetries?: number): void {
    this.state.totalAPIDuration += duration;
    if (durationWithoutRetries !== undefined) {
      this.state.totalAPIDurationWithoutRetries =
        (this.state.totalAPIDurationWithoutRetries || 0) + durationWithoutRetries;
    }
  }

  /**
   * 更新代码修改统计（对应官方的 mF1 函数）
   */
  updateCodeChanges(linesAdded: number, linesRemoved: number): void {
    this.state.totalLinesAdded = (this.state.totalLinesAdded || 0) + linesAdded;
    this.state.totalLinesRemoved = (this.state.totalLinesRemoved || 0) + linesRemoved;
  }

  /**
   * 追踪工具执行时长
   */
  async trackToolExecution<T>(
    toolName: string,
    execute: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      return await execute();
    } finally {
      const duration = Date.now() - start;
      this.updateToolDuration(duration);
    }
  }

  /**
   * 获取模型的上下文窗口大小
   */
  private getContextWindow(model: string): number {
    if (model.includes('opus-4')) return 200000;
    if (model.includes('sonnet-4')) return 200000;
    if (model.includes('haiku-4')) return 200000;
    if (model.includes('sonnet-3.7')) return 200000;
    if (model.includes('sonnet-3.5')) return 200000;
    if (model.includes('opus-3')) return 200000;
    if (model.includes('haiku')) return 200000;
    return 200000; // 默认值
  }

  /**
   * T151/T152: 获取详细统计信息
   */
  getStats(): {
    duration: number;
    totalCost: string;
    messageCount: number;
    modelUsage: Record<string, import('../types/index.js').ModelUsageStats>;
    totalTokens: number;
    totalToolDuration: number;
  } {
    // 计算总 token 数
    let totalTokens = 0;
    for (const stats of Object.values(this.state.modelUsage)) {
      totalTokens += stats.inputTokens + stats.outputTokens;
    }

    return {
      duration: Date.now() - this.state.startTime,
      totalCost: `$${this.state.totalCostUSD.toFixed(4)}`,
      messageCount: this.messages.length,
      modelUsage: { ...this.state.modelUsage },
      totalTokens,
      totalToolDuration: this.state.totalToolDuration || 0,
    };
  }

  /**
   * 获取会话摘要
   */
  getSessionSummary(): string {
    const duration = Date.now() - this.state.startTime;
    const durationSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;

    const linesAdded = this.state.totalLinesAdded || 0;
    const linesRemoved = this.state.totalLinesRemoved || 0;

    // 格式化模型使用统计
    let modelUsageStr = '';
    for (const [model, stats] of Object.entries(this.state.modelUsage)) {
      const totalTokens = stats.inputTokens + stats.outputTokens;
      modelUsageStr += `\n  ${model}:`;
      modelUsageStr += `\n    - Requests: ${stats.requests || 0}`;
      modelUsageStr += `\n    - Total Tokens: ${totalTokens.toLocaleString()}`;
      modelUsageStr += `\n    - Input: ${stats.inputTokens.toLocaleString()}`;
      modelUsageStr += `\n    - Output: ${stats.outputTokens.toLocaleString()}`;
      if (stats.thinkingTokens) {
        modelUsageStr += `\n    - Thinking: ${stats.thinkingTokens.toLocaleString()}`;
      }
      if (stats.cacheReadInputTokens) {
        modelUsageStr += `\n    - Cache Read: ${stats.cacheReadInputTokens.toLocaleString()}`;
      }
      if (stats.cacheCreationInputTokens) {
        modelUsageStr += `\n    - Cache Write: ${stats.cacheCreationInputTokens.toLocaleString()}`;
      }
      modelUsageStr += `\n    - Cost: $${stats.costUSD.toFixed(4)}`;
    }

    return `
会话摘要:
────────────────────────────────────────
总成本:            $${this.state.totalCostUSD.toFixed(4)}
API 总时长:        ${this.state.totalAPIDuration}ms
API 时长(无重试):  ${this.state.totalAPIDurationWithoutRetries || 0}ms
工具执行时长:      ${this.state.totalToolDuration || 0}ms
会话总时长:        ${minutes}m ${seconds}s
代码修改:          +${linesAdded} -${linesRemoved} (${linesAdded + linesRemoved} 行总变化)
消息数量:          ${this.messages.length}
${modelUsageStr ? '\n模型使用统计:' + modelUsageStr : ''}
────────────────────────────────────────
`;
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

  /**
   * T146: 保存会话到文件（带版本控制）
   */
  save(): string {
    const sessionFile = path.join(this.configDir, 'sessions', `${this.state.sessionId}.json`);
    const sessionDir = path.dirname(sessionFile);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // T157: 检查并获取锁
    this.acquireLock();

    try {
      // T146: 匹配官方格式，添加版本控制
      const data = {
        version: SESSION_VERSION, // T146: 添加版本号
        state: this.state,
        messages: this.messages,
        // 额外元数据 (官方风格)
        metadata: {
          // Git 信息 (完整)
          gitInfo: this.gitInfo,
          gitBranch: this.gitInfo?.branchName, // 兼容旧版
          gitStatus: this.gitInfo?.isClean ? 'clean' : 'dirty',
          gitDefaultBranch: this.gitInfo?.defaultBranch,
          gitCommitHash: this.gitInfo?.commitHash,
          // Session 信息
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
    } finally {
      // T157: 释放锁
      this.releaseLock();
    }
  }

  /**
   * T147: 从文件加载会话（修复元数据恢复 bug）
   */
  static load(sessionId: string): Session | null {
    // T145: 支持 CLAUDE_CONFIG_DIR 环境变量
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const sessionFile = path.join(configDir, 'sessions', `${sessionId}.json`);

    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));

      // T157: 版本兼容性检查
      if (data.version && data.version !== SESSION_VERSION) {
        console.warn(`Session ${sessionId} has version ${data.version}, current version is ${SESSION_VERSION}`);
        // 可以在这里进行版本迁移
      }

      const session = new Session(data.state.cwd);
      session.state = data.state;
      session.messages = data.messages || [];

      // T147: 修复 bug - 恢复元数据
      if (data.metadata) {
        session.gitInfo = data.metadata.gitInfo;
        session.customTitle = data.metadata.customTitle;
      }

      return session;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * T148: 列出所有会话
   */
  static listSessions(): Array<{ id: string; startTime: number; cwd: string }> {
    // T145: 支持 CLAUDE_CONFIG_DIR 环境变量
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
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

  /**
   * T149: 清理过期会话（默认 30 天）
   */
  static cleanupExpiredSessions(maxAgeDays: number = 30): number {
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const sessionsDir = path.join(configDir, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      return 0;
    }

    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(sessionsDir, file);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // 使用最后修改时间（metadata.modified 或文件的 mtime）
        const modifiedTime = data.metadata?.modified || fs.statSync(filePath).mtimeMs;

        if (modifiedTime < cutoffTime) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (error) {
        // 如果文件损坏，也删除它
        try {
          fs.unlinkSync(filePath);
          cleaned++;
        } catch {
          // 忽略删除失败
        }
      }
    }

    return cleaned;
  }

  /**
   * T157: 获取锁（防止并发修改）
   */
  private acquireLock(): void {
    if (this.isLocked) {
      return;
    }

    this.lockFile = path.join(this.configDir, 'sessions', `.${this.state.sessionId}.lock`);

    // 检查是否已有锁文件
    if (fs.existsSync(this.lockFile)) {
      const lockData = fs.readFileSync(this.lockFile, 'utf-8');
      const lockTime = parseInt(lockData, 10);

      // 如果锁超过 5 分钟，认为是僵尸锁，删除它
      if (Date.now() - lockTime > 5 * 60 * 1000) {
        fs.unlinkSync(this.lockFile);
      } else {
        throw new Error(`Session ${this.state.sessionId} is locked by another process`);
      }
    }

    // 创建锁文件
    fs.writeFileSync(this.lockFile, Date.now().toString());
    this.isLocked = true;
  }

  /**
   * T157: 释放锁
   */
  private releaseLock(): void {
    if (!this.isLocked || !this.lockFile) {
      return;
    }

    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      console.warn(`Failed to release lock for session ${this.state.sessionId}:`, error);
    }

    this.isLocked = false;
    this.lockFile = undefined;
  }

  /**
   * T153: 获取原始工作目录
   */
  getOriginalCwd(): string {
    return this.originalCwd;
  }
}
