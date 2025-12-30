/**
 * 历史记录管理器
 * 负责持久化和加载命令历史
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const HISTORY_FILE = path.join(os.homedir(), '.claude', 'command_history.json');
const MAX_HISTORY_SIZE = 1000;

export interface HistoryEntry {
  command: string;
  timestamp: number;
}

export class HistoryManager {
  private history: string[] = [];
  private historyFilePath: string;

  constructor(customPath?: string) {
    this.historyFilePath = customPath || HISTORY_FILE;
    this.loadHistory();
  }

  /**
   * 从文件加载历史记录
   */
  private loadHistory(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.historyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 加载历史记录
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf-8');
        const entries: HistoryEntry[] = JSON.parse(data);
        // 只保留命令文本，按时间倒序排列
        this.history = entries
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(e => e.command)
          .filter((cmd, idx, arr) => arr.indexOf(cmd) === idx) // 去重
          .slice(0, MAX_HISTORY_SIZE);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      this.history = [];
    }
  }

  /**
   * 保存历史记录到文件
   */
  private saveHistory(): void {
    try {
      const entries: HistoryEntry[] = this.history.map(command => ({
        command,
        timestamp: Date.now(),
      }));
      fs.writeFileSync(this.historyFilePath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  /**
   * 添加一条命令到历史记录
   */
  addCommand(command: string): void {
    if (!command || !command.trim()) return;

    const trimmed = command.trim();

    // 移除之前的重复项
    this.history = this.history.filter(cmd => cmd !== trimmed);

    // 添加到开头
    this.history.unshift(trimmed);

    // 限制大小
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, MAX_HISTORY_SIZE);
    }

    this.saveHistory();
  }

  /**
   * 获取所有历史记录
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * 搜索历史记录
   * @param query 搜索关键词
   * @returns 匹配的历史记录（按相关度排序）
   */
  search(query: string): string[] {
    if (!query) return this.history;

    const lowerQuery = query.toLowerCase();

    return this.history.filter(cmd =>
      cmd.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = [];
    this.saveHistory();
  }
}

// 单例实例
let instance: HistoryManager | null = null;

export function getHistoryManager(): HistoryManager {
  if (!instance) {
    instance = new HistoryManager();
  }
  return instance;
}
