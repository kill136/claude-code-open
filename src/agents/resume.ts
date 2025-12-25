/**
 * 代理恢复机制 (Agent Resume)
 * 实现代理状态持久化、恢复、检查点管理等功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types/index.js';

// ==================== 类型定义 ====================

/**
 * 工具调用记录
 */
export interface ToolCall {
  id: string;
  name: string;
  input: any;
  output?: any;
  error?: string;
  timestamp: Date;
  duration?: number;
}

/**
 * 代理执行检查点
 */
export interface Checkpoint {
  id: string;
  agentId: string;
  createdAt: Date;
  step: number;
  label?: string;
  messages: Message[];
  toolCalls: ToolCall[];
  results: any[];
  metadata: Record<string, any>;
}

/**
 * 代理状态
 */
export interface AgentState {
  id: string;
  type: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  prompt: string;
  description?: string;
  model?: string;

  // 执行历史
  messages: Message[];
  toolCalls: ToolCall[];
  results: any[];

  // 检查点系统
  checkpoint?: Checkpoint;
  checkpoints: Checkpoint[];

  // 执行上下文
  workingDirectory: string;
  environment?: Record<string, string>;

  // 进度跟踪
  currentStep: number;
  totalSteps?: number;

  // 错误处理
  errorCount: number;
  lastError?: string;
  retryCount: number;
  maxRetries: number;

  // 元数据
  metadata: Record<string, any>;
}

/**
 * 状态过滤器
 */
export interface StateFilter {
  status?: AgentState['status'];
  type?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  hasCheckpoint?: boolean;
}

/**
 * 恢复选项
 */
export interface ResumeOptions {
  agentId: string;
  continueFrom?: 'last' | 'checkpoint' | number;
  resetErrors?: boolean;
  additionalContext?: string;
}

/**
 * 恢复点信息
 */
export interface ResumePoint {
  canResume: boolean;
  agentId: string;
  status: AgentState['status'];
  step: number;
  totalSteps?: number;
  checkpointAvailable: boolean;
  lastCheckpoint?: Checkpoint;
  errorCount: number;
  suggestions?: string[];
}

// ==================== 状态管理器 ====================

/**
 * 代理状态管理器
 * 负责保存、加载、查询代理状态
 */
export class AgentStateManager {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(os.homedir(), '.claude', 'agents');
    this.ensureStorageDir();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * 获取代理状态文件路径
   */
  private getStatePath(agentId: string): string {
    return path.join(this.storageDir, `${agentId}.json`);
  }

  /**
   * 获取检查点目录路径
   */
  private getCheckpointDir(agentId: string): string {
    const dir = path.join(this.storageDir, 'checkpoints', agentId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * 序列化状态对象
   */
  private serializeState(state: AgentState): any {
    return {
      ...state,
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
      completedAt: state.completedAt?.toISOString(),
      toolCalls: state.toolCalls.map(tc => ({
        ...tc,
        timestamp: tc.timestamp.toISOString(),
      })),
      checkpoints: state.checkpoints.map(cp => this.serializeCheckpoint(cp)),
      checkpoint: state.checkpoint ? this.serializeCheckpoint(state.checkpoint) : undefined,
    };
  }

  /**
   * 反序列化状态对象
   */
  private deserializeState(data: any): AgentState {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      toolCalls: data.toolCalls.map((tc: any) => ({
        ...tc,
        timestamp: new Date(tc.timestamp),
      })),
      checkpoints: data.checkpoints.map((cp: any) => this.deserializeCheckpoint(cp)),
      checkpoint: data.checkpoint ? this.deserializeCheckpoint(data.checkpoint) : undefined,
    };
  }

  /**
   * 序列化检查点
   */
  private serializeCheckpoint(checkpoint: Checkpoint): any {
    return {
      ...checkpoint,
      createdAt: checkpoint.createdAt.toISOString(),
      toolCalls: checkpoint.toolCalls.map(tc => ({
        ...tc,
        timestamp: tc.timestamp.toISOString(),
      })),
    };
  }

  /**
   * 反序列化检查点
   */
  private deserializeCheckpoint(data: any): Checkpoint {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      toolCalls: data.toolCalls.map((tc: any) => ({
        ...tc,
        timestamp: new Date(tc.timestamp),
      })),
    };
  }

  /**
   * 保存代理状态
   */
  async saveState(state: AgentState): Promise<void> {
    try {
      state.updatedAt = new Date();
      const filePath = this.getStatePath(state.id);
      const data = this.serializeState(state);
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save agent state ${state.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载代理状态
   */
  async loadState(id: string): Promise<AgentState | null> {
    try {
      const filePath = this.getStatePath(id);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      return this.deserializeState(data);
    } catch (error) {
      console.error(`Failed to load agent state ${id}:`, error);
      return null;
    }
  }

  /**
   * 列出所有代理状态
   */
  async listStates(filter?: StateFilter): Promise<AgentState[]> {
    try {
      const files = await fs.promises.readdir(this.storageDir);
      const states: AgentState[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const agentId = file.replace('.json', '');
        const state = await this.loadState(agentId);

        if (!state) continue;

        // 应用过滤器
        if (filter) {
          if (filter.status && state.status !== filter.status) continue;
          if (filter.type && state.type !== filter.type) continue;
          if (filter.createdAfter && state.createdAt < filter.createdAfter) continue;
          if (filter.createdBefore && state.createdAt > filter.createdBefore) continue;
          if (filter.hasCheckpoint !== undefined && (!!state.checkpoint) !== filter.hasCheckpoint) continue;
        }

        states.push(state);
      }

      // 按更新时间倒序排序
      return states.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to list agent states:', error);
      return [];
    }
  }

  /**
   * 删除代理状态
   */
  async deleteState(id: string): Promise<boolean> {
    try {
      const filePath = this.getStatePath(id);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      // 删除检查点目录
      const checkpointDir = this.getCheckpointDir(id);
      if (fs.existsSync(checkpointDir)) {
        await fs.promises.rm(checkpointDir, { recursive: true });
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete agent state ${id}:`, error);
      return false;
    }
  }

  /**
   * 清理过期状态
   */
  async cleanupExpired(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const states = await this.listStates();
    let cleaned = 0;

    for (const state of states) {
      // 清理已完成或失败且过期的代理
      if (state.status === 'completed' || state.status === 'failed') {
        const age = now - state.updatedAt.getTime();
        if (age > maxAge) {
          const deleted = await this.deleteState(state.id);
          if (deleted) cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * 保存检查点
   */
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    try {
      const checkpointDir = this.getCheckpointDir(checkpoint.agentId);
      const filePath = path.join(checkpointDir, `${checkpoint.id}.json`);
      const data = this.serializeCheckpoint(checkpoint);
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save checkpoint ${checkpoint.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载检查点
   */
  async loadCheckpoint(agentId: string, checkpointId: string): Promise<Checkpoint | null> {
    try {
      const checkpointDir = this.getCheckpointDir(agentId);
      const filePath = path.join(checkpointDir, `${checkpointId}.json`);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      return this.deserializeCheckpoint(data);
    } catch (error) {
      console.error(`Failed to load checkpoint ${checkpointId}:`, error);
      return null;
    }
  }

  /**
   * 列出代理的所有检查点
   */
  async listCheckpoints(agentId: string): Promise<Checkpoint[]> {
    try {
      const checkpointDir = this.getCheckpointDir(agentId);
      const files = await fs.promises.readdir(checkpointDir);
      const checkpoints: Checkpoint[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const checkpointId = file.replace('.json', '');
        const checkpoint = await this.loadCheckpoint(agentId, checkpointId);

        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }

      // 按创建时间排序
      return checkpoints.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      console.error(`Failed to list checkpoints for agent ${agentId}:`, error);
      return [];
    }
  }
}

// ==================== 代理恢复器 ====================

/**
 * 代理恢复器
 * 负责恢复代理执行、检查点回滚等
 */
export class AgentResumer {
  private stateManager: AgentStateManager;

  constructor(stateManager: AgentStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * 检查是否可以恢复代理
   */
  async canResume(id: string): Promise<boolean> {
    const state = await this.stateManager.loadState(id);
    if (!state) return false;

    // 已完成的代理不能恢复
    if (state.status === 'completed') return false;

    // 其他状态都可以恢复
    return true;
  }

  /**
   * 获取恢复点信息
   */
  async getResumePoint(id: string): Promise<ResumePoint> {
    const state = await this.stateManager.loadState(id);

    if (!state) {
      return {
        canResume: false,
        agentId: id,
        status: 'failed',
        step: 0,
        checkpointAvailable: false,
        errorCount: 0,
        suggestions: ['Agent state not found. It may have been deleted or never existed.'],
      };
    }

    const canResume = state.status !== 'completed';
    const suggestions: string[] = [];

    if (state.status === 'failed') {
      suggestions.push('Agent failed previously. Consider using resetErrors option when resuming.');
      if (state.lastError) {
        suggestions.push(`Last error: ${state.lastError}`);
      }
    }

    if (state.status === 'paused') {
      suggestions.push('Agent is paused. Resume to continue execution.');
    }

    if (state.checkpoint) {
      suggestions.push('Checkpoint available. You can resume from the last checkpoint.');
    }

    if (state.errorCount > 0 && state.retryCount >= state.maxRetries) {
      suggestions.push('Max retries reached. Consider increasing maxRetries or fixing underlying issues.');
    }

    return {
      canResume,
      agentId: id,
      status: state.status,
      step: state.currentStep,
      totalSteps: state.totalSteps,
      checkpointAvailable: !!state.checkpoint,
      lastCheckpoint: state.checkpoint,
      errorCount: state.errorCount,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 恢复代理执行
   */
  async resume(options: ResumeOptions): Promise<AgentState> {
    const { agentId, continueFrom = 'last', resetErrors = false, additionalContext } = options;

    // 加载状态
    const state = await this.stateManager.loadState(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // 检查是否可以恢复
    if (state.status === 'completed') {
      throw new Error(`Agent ${agentId} has already completed. Cannot resume.`);
    }

    // 根据 continueFrom 恢复到特定点
    if (continueFrom === 'checkpoint' && state.checkpoint) {
      // 从检查点恢复
      await this.restoreFromCheckpoint(state, state.checkpoint);
    } else if (typeof continueFrom === 'number') {
      // 从特定步骤恢复
      const checkpoints = await this.stateManager.listCheckpoints(agentId);
      const targetCheckpoint = checkpoints.find(cp => cp.step === continueFrom);

      if (targetCheckpoint) {
        await this.restoreFromCheckpoint(state, targetCheckpoint);
      } else {
        // 如果没有精确的检查点,找最接近的
        const closestCheckpoint = checkpoints
          .filter(cp => cp.step <= continueFrom)
          .sort((a, b) => b.step - a.step)[0];

        if (closestCheckpoint) {
          await this.restoreFromCheckpoint(state, closestCheckpoint);
        }
      }
    }

    // 重置错误状态
    if (resetErrors) {
      state.errorCount = 0;
      state.lastError = undefined;
      state.retryCount = 0;
    }

    // 添加附加上下文
    if (additionalContext) {
      state.metadata.resumeContext = additionalContext;
      state.metadata.resumeTimestamp = new Date().toISOString();
    }

    // 更新状态为运行中
    state.status = 'running';
    state.updatedAt = new Date();

    // 保存状态
    await this.stateManager.saveState(state);

    return state;
  }

  /**
   * 从检查点恢复状态
   */
  private async restoreFromCheckpoint(state: AgentState, checkpoint: Checkpoint): Promise<void> {
    state.messages = [...checkpoint.messages];
    state.toolCalls = [...checkpoint.toolCalls];
    state.results = [...checkpoint.results];
    state.currentStep = checkpoint.step;
    state.metadata = { ...state.metadata, ...checkpoint.metadata };
  }

  /**
   * 创建恢复摘要
   */
  async createResumeSummary(id: string): Promise<string> {
    const state = await this.stateManager.loadState(id);
    if (!state) {
      return `Agent ${id} not found.`;
    }

    const lines: string[] = [];
    lines.push(`=== Agent Resume Summary ===`);
    lines.push(`Agent ID: ${state.id}`);
    lines.push(`Type: ${state.type}`);
    lines.push(`Status: ${state.status}`);
    lines.push(`Created: ${state.createdAt.toISOString()}`);
    lines.push(`Updated: ${state.updatedAt.toISOString()}`);

    if (state.description) {
      lines.push(`Description: ${state.description}`);
    }

    lines.push(`\nProgress: Step ${state.currentStep}${state.totalSteps ? `/${state.totalSteps}` : ''}`);
    lines.push(`Messages: ${state.messages.length}`);
    lines.push(`Tool Calls: ${state.toolCalls.length}`);

    if (state.checkpoint) {
      lines.push(`\nCheckpoint Available: Yes (Step ${state.checkpoint.step})`);
    }

    if (state.errorCount > 0) {
      lines.push(`\nErrors: ${state.errorCount} (${state.retryCount}/${state.maxRetries} retries)`);
      if (state.lastError) {
        lines.push(`Last Error: ${state.lastError}`);
      }
    }

    const resumePoint = await this.getResumePoint(id);
    if (resumePoint.suggestions && resumePoint.suggestions.length > 0) {
      lines.push(`\nSuggestions:`);
      resumePoint.suggestions.forEach(s => lines.push(`  - ${s}`));
    }

    return lines.join('\n');
  }
}

// ==================== 检查点工具函数 ====================

/**
 * 创建代理检查点
 */
export function createAgentCheckpoint(
  state: AgentState,
  label?: string
): Checkpoint {
  const checkpoint: Checkpoint = {
    id: uuidv4(),
    agentId: state.id,
    createdAt: new Date(),
    step: state.currentStep,
    label,
    messages: [...state.messages],
    toolCalls: [...state.toolCalls],
    results: [...state.results],
    metadata: { ...state.metadata },
  };

  // 将检查点添加到状态
  state.checkpoints.push(checkpoint);
  state.checkpoint = checkpoint;

  return checkpoint;
}

/**
 * 从检查点恢复状态
 */
export function restoreFromCheckpoint(checkpoint: Checkpoint): Partial<AgentState> {
  return {
    messages: [...checkpoint.messages],
    toolCalls: [...checkpoint.toolCalls],
    results: [...checkpoint.results],
    currentStep: checkpoint.step,
    metadata: { ...checkpoint.metadata },
  };
}

/**
 * 创建初始代理状态
 */
export function createInitialAgentState(
  type: string,
  prompt: string,
  options?: {
    description?: string;
    model?: string;
    workingDirectory?: string;
    maxRetries?: number;
    metadata?: Record<string, any>;
  }
): AgentState {
  return {
    id: uuidv4(),
    type,
    status: 'running',
    createdAt: new Date(),
    updatedAt: new Date(),
    prompt,
    description: options?.description,
    model: options?.model,
    messages: [],
    toolCalls: [],
    results: [],
    checkpoints: [],
    workingDirectory: options?.workingDirectory || process.cwd(),
    currentStep: 0,
    errorCount: 0,
    retryCount: 0,
    maxRetries: options?.maxRetries || 3,
    metadata: options?.metadata || {},
  };
}

// ==================== 导出便捷函数 ====================

/**
 * 获取默认的状态管理器实例
 */
let defaultStateManager: AgentStateManager | null = null;

export function getDefaultStateManager(): AgentStateManager {
  if (!defaultStateManager) {
    defaultStateManager = new AgentStateManager();
  }
  return defaultStateManager;
}

/**
 * 获取默认的恢复器实例
 */
let defaultResumer: AgentResumer | null = null;

export function getDefaultResumer(): AgentResumer {
  if (!defaultResumer) {
    defaultResumer = new AgentResumer(getDefaultStateManager());
  }
  return defaultResumer;
}
