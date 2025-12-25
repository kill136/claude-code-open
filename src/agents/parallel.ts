/**
 * 并行代理执行器
 * 支持多个代理的并发执行、依赖管理和结果合并
 */

import { EventEmitter } from 'events';
import { TaskTool, BackgroundAgent, getBackgroundAgent } from '../tools/agent.js';
import type { AgentInput, ToolResult } from '../types/index.js';

// ============ 配置接口 ============

/**
 * 并行代理执行配置
 */
export interface ParallelAgentConfig {
  /** 最大并发数量 */
  maxConcurrency: number;
  /** 超时时间(毫秒) */
  timeout: number;
  /** 失败时是否重试 */
  retryOnFailure: boolean;
  /** 首次错误时停止 */
  stopOnFirstError: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟(毫秒) */
  retryDelay?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ParallelAgentConfig = {
  maxConcurrency: 5,
  timeout: 300000, // 5分钟
  retryOnFailure: false,
  stopOnFirstError: false,
  maxRetries: 3,
  retryDelay: 1000,
};

// ============ 任务接口 ============

/**
 * 代理任务定义
 */
export interface AgentTask {
  /** 任务唯一标识 */
  id: string;
  /** 代理类型 */
  type: string;
  /** 任务提示 */
  prompt: string;
  /** 任务描述 */
  description?: string;
  /** 可选参数 */
  options?: Record<string, any>;
  /** 优先级(数字越大优先级越高) */
  priority?: number;
  /** 依赖的任务ID列表 */
  dependencies?: string[];
  /** 模型选择 */
  model?: 'sonnet' | 'opus' | 'haiku';
  /** 超时配置(覆盖全局配置) */
  timeout?: number;
}

/**
 * 任务执行状态
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';

/**
 * 任务执行信息
 */
export interface TaskExecutionInfo {
  task: AgentTask;
  status: TaskStatus;
  startTime?: Date;
  endTime?: Date;
  result?: AgentResult;
  error?: string;
  retryCount: number;
  agentId?: string;
}

// ============ 结果接口 ============

/**
 * 单个代理的执行结果
 */
export interface AgentResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * 失败的代理信息
 */
export interface FailedAgent {
  taskId: string;
  agentId?: string;
  error: string;
  retryCount: number;
}

/**
 * 并行执行结果
 */
export interface ParallelExecutionResult {
  /** 成功完成的任务 */
  completed: AgentResult[];
  /** 失败的任务 */
  failed: FailedAgent[];
  /** 被取消的任务ID */
  cancelled: string[];
  /** 总执行时间(毫秒) */
  duration: number;
  /** 总任务数 */
  totalTasks: number;
  /** 成功率 */
  successRate: number;
}

/**
 * 合并后的结果
 */
export interface MergedResult {
  /** 合并后的输出 */
  combinedOutput: string;
  /** 所有结果 */
  results: AgentResult[];
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
  /** 总耗时 */
  totalDuration: number;
  /** 平均耗时 */
  averageDuration: number;
  /** 元数据 */
  metadata: Record<string, any>;
}

// ============ 依赖图接口 ============

/**
 * 依赖图节点
 */
export interface DependencyNode {
  taskId: string;
  dependencies: string[];
  dependents: string[];
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  /** 拓扑排序后的层级 */
  levels: string[][];
  /** 是否有循环依赖 */
  hasCycle: boolean;
  /** 循环依赖路径 */
  cyclePath?: string[];
}

/**
 * 执行进度信息
 */
export interface ExecutionProgress {
  /** 总任务数 */
  total: number;
  /** 待执行 */
  pending: number;
  /** 等待依赖 */
  waiting: number;
  /** 执行中 */
  running: number;
  /** 已完成 */
  completed: number;
  /** 已失败 */
  failed: number;
  /** 已取消 */
  cancelled: number;
  /** 进度百分比 */
  percentage: number;
  /** 当前执行的任务ID */
  currentTasks: string[];
}

// ============ 代理池接口 ============

/**
 * 代理工作器
 */
export interface AgentWorker {
  id: string;
  busy: boolean;
  currentTask?: string;
  agentTool: TaskTool;
  createdAt: Date;
  lastUsed: Date;
}

// ============ 并行代理执行器 ============

/**
 * 并行代理执行器
 * 负责管理多个代理的并发执行
 */
export class ParallelAgentExecutor extends EventEmitter {
  private config: ParallelAgentConfig;
  private tasks: Map<string, TaskExecutionInfo> = new Map();
  private running = false;
  private cancelled = false;
  private pool?: AgentPool;

  constructor(config?: Partial<ParallelAgentConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行多个任务(无依赖)
   */
  async execute(tasks: AgentTask[]): Promise<ParallelExecutionResult> {
    if (this.running) {
      throw new Error('Executor is already running');
    }

    const startTime = Date.now();
    this.running = true;
    this.cancelled = false;

    // 初始化任务状态
    this.tasks.clear();
    for (const task of tasks) {
      this.tasks.set(task.id, {
        task,
        status: 'pending',
        retryCount: 0,
      });
    }

    // 创建代理池
    this.pool = new AgentPool(this.config.maxConcurrency);

    try {
      // 按优先级排序
      const sortedTasks = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // 并发执行
      await this.executeTasksConcurrently(sortedTasks);

      return this.buildResult(startTime);
    } finally {
      this.running = false;
      if (this.pool) {
        await this.pool.shutdown();
        this.pool = undefined;
      }
    }
  }

  /**
   * 执行带依赖的任务
   */
  async executeWithDependencies(
    tasks: AgentTask[],
    deps: DependencyGraph
  ): Promise<ParallelExecutionResult> {
    if (this.running) {
      throw new Error('Executor is already running');
    }

    // 检查循环依赖
    if (deps.hasCycle) {
      throw new Error(`Circular dependency detected: ${deps.cyclePath?.join(' -> ')}`);
    }

    const startTime = Date.now();
    this.running = true;
    this.cancelled = false;

    // 初始化任务状态
    this.tasks.clear();
    for (const task of tasks) {
      const node = deps.nodes.get(task.id);
      const status = node && node.dependencies.length > 0 ? 'waiting' : 'pending';
      this.tasks.set(task.id, {
        task,
        status,
        retryCount: 0,
      });
    }

    // 创建代理池
    this.pool = new AgentPool(this.config.maxConcurrency);

    try {
      // 按层级执行
      await this.executeByLevels(tasks, deps);

      return this.buildResult(startTime);
    } finally {
      this.running = false;
      if (this.pool) {
        await this.pool.shutdown();
        this.pool = undefined;
      }
    }
  }

  /**
   * 取消执行
   */
  cancel(taskId?: string): void {
    if (taskId) {
      const info = this.tasks.get(taskId);
      if (info && info.status === 'running') {
        info.status = 'cancelled';
        this.emit('task-cancelled', taskId);
      }
    } else {
      this.cancelled = true;
      this.emit('execution-cancelled');
    }
  }

  /**
   * 获取执行进度
   */
  getProgress(): ExecutionProgress {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      waiting: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      currentTasks: [] as string[],
    };

    for (const [taskId, info] of this.tasks.entries()) {
      stats[info.status]++;
      if (info.status === 'running') {
        stats.currentTasks.push(taskId);
      }
    }

    const finished = stats.completed + stats.failed + stats.cancelled;
    const percentage = stats.total > 0 ? (finished / stats.total) * 100 : 0;

    return {
      ...stats,
      percentage,
    };
  }

  /**
   * 并发执行任务(无依赖)
   */
  private async executeTasksConcurrently(tasks: AgentTask[]): Promise<void> {
    const queue = [...tasks];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      if (this.cancelled) break;

      // 启动新任务直到达到并发上限
      while (queue.length > 0 && executing.length < this.config.maxConcurrency) {
        const task = queue.shift()!;
        const promise = this.executeTask(task).finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });
        executing.push(promise);
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    // 等待所有任务完成
    await Promise.all(executing);
  }

  /**
   * 按层级执行任务(有依赖)
   */
  private async executeByLevels(tasks: AgentTask[], deps: DependencyGraph): Promise<void> {
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // 逐层执行
    for (const level of deps.levels) {
      if (this.cancelled) break;

      const levelTasks = level.map(id => taskMap.get(id)!).filter(Boolean);

      // 并发执行同一层级的任务
      await this.executeTasksConcurrently(levelTasks);

      // 检查是否需要提前终止
      if (this.config.stopOnFirstError) {
        const hasError = levelTasks.some(t => {
          const info = this.tasks.get(t.id);
          return info && info.status === 'failed';
        });
        if (hasError) break;
      }
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: AgentTask): Promise<void> {
    const info = this.tasks.get(task.id)!;
    const timeout = task.timeout || this.config.timeout;

    try {
      // 获取worker
      if (!this.pool) throw new Error('Agent pool not initialized');
      const worker = await this.pool.acquire();

      try {
        info.status = 'running';
        info.startTime = new Date();
        this.emit('task-started', task.id);

        // 执行任务(带超时)
        const result = await Promise.race([
          this.runAgentTask(worker, task),
          this.createTimeout(timeout),
        ]);

        info.endTime = new Date();
        info.result = result;
        info.status = result.success ? 'completed' : 'failed';

        if (result.success) {
          this.emit('task-completed', task.id, result);
        } else {
          info.error = result.error;
          this.emit('task-failed', task.id, result.error);

          // 重试逻辑
          if (this.config.retryOnFailure && info.retryCount < (this.config.maxRetries || 3)) {
            await this.retryTask(task, info);
          }
        }
      } finally {
        this.pool.release(worker);
      }
    } catch (error) {
      info.endTime = new Date();
      info.status = 'failed';
      info.error = error instanceof Error ? error.message : String(error);
      this.emit('task-error', task.id, info.error);

      // 重试逻辑
      if (this.config.retryOnFailure && info.retryCount < (this.config.maxRetries || 3)) {
        await this.retryTask(task, info);
      }
    }
  }

  /**
   * 重试任务
   */
  private async retryTask(task: AgentTask, info: TaskExecutionInfo): Promise<void> {
    info.retryCount++;
    this.emit('task-retry', task.id, info.retryCount);

    // 等待重试延迟
    if (this.config.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    }

    // 重置状态并重试
    info.status = 'pending';
    delete info.startTime;
    delete info.endTime;
    delete info.error;

    await this.executeTask(task);
  }

  /**
   * 运行代理任务
   */
  private async runAgentTask(worker: AgentWorker, task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    const input: AgentInput = {
      description: task.description || task.id,
      prompt: task.prompt,
      subagent_type: task.type,
      model: task.model,
      run_in_background: false,
      ...task.options,
    };

    const toolResult = await worker.agentTool.execute(input);

    const duration = Date.now() - startTime;

    // 提取agentId(如果有)
    let agentId = task.id;
    if (toolResult.output) {
      const match = toolResult.output.match(/Agent ID: ([a-f0-9-]+)/i);
      if (match) agentId = match[1];
    }

    const info = this.tasks.get(task.id);
    if (info) {
      info.agentId = agentId;
    }

    return {
      taskId: task.id,
      agentId,
      success: toolResult.success || false,
      output: toolResult.output,
      error: toolResult.error,
      duration,
      metadata: {
        type: task.type,
        model: task.model,
        retryCount: info?.retryCount || 0,
      },
    };
  }

  /**
   * 创建超时Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * 构建执行结果
   */
  private buildResult(startTime: number): ParallelExecutionResult {
    const completed: AgentResult[] = [];
    const failed: FailedAgent[] = [];
    const cancelled: string[] = [];

    for (const [taskId, info] of this.tasks.entries()) {
      if (info.status === 'completed' && info.result) {
        completed.push(info.result);
      } else if (info.status === 'failed') {
        failed.push({
          taskId,
          agentId: info.agentId,
          error: info.error || 'Unknown error',
          retryCount: info.retryCount,
        });
      } else if (info.status === 'cancelled') {
        cancelled.push(taskId);
      }
    }

    const duration = Date.now() - startTime;
    const totalTasks = this.tasks.size;
    const successRate = totalTasks > 0 ? (completed.length / totalTasks) * 100 : 0;

    return {
      completed,
      failed,
      cancelled,
      duration,
      totalTasks,
      successRate,
    };
  }
}

// ============ 代理池 ============

/**
 * 代理资源池
 * 管理代理工作器的生命周期和复用
 */
export class AgentPool {
  private workers: AgentWorker[] = [];
  private availableWorkers: AgentWorker[] = [];
  private waitQueue: Array<(worker: AgentWorker) => void> = [];
  private poolSize: number;
  private nextWorkerId = 1;

  constructor(poolSize: number) {
    this.poolSize = poolSize;
    this.initializePool();
  }

  /**
   * 初始化池
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker();
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * 创建工作器
   */
  private createWorker(): AgentWorker {
    const now = new Date();
    return {
      id: `worker-${this.nextWorkerId++}`,
      busy: false,
      agentTool: new TaskTool(),
      createdAt: now,
      lastUsed: now,
    };
  }

  /**
   * 获取工作器
   */
  async acquire(): Promise<AgentWorker> {
    // 如果有可用worker,直接返回
    const worker = this.availableWorkers.shift();
    if (worker) {
      worker.busy = true;
      worker.lastUsed = new Date();
      return worker;
    }

    // 否则等待
    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * 释放工作器
   */
  release(worker: AgentWorker): void {
    worker.busy = false;
    worker.lastUsed = new Date();
    delete worker.currentTask;

    // 如果有等待的请求,分配给它
    const waiting = this.waitQueue.shift();
    if (waiting) {
      worker.busy = true;
      waiting(worker);
    } else {
      this.availableWorkers.push(worker);
    }
  }

  /**
   * 调整池大小
   */
  resize(newSize: number): void {
    if (newSize < this.poolSize) {
      // 缩小池
      const toRemove = this.poolSize - newSize;
      for (let i = 0; i < toRemove; i++) {
        const idx = this.availableWorkers.findIndex(w => !w.busy);
        if (idx > -1) {
          const worker = this.availableWorkers.splice(idx, 1)[0];
          const workerIdx = this.workers.indexOf(worker);
          if (workerIdx > -1) {
            this.workers.splice(workerIdx, 1);
          }
        }
      }
    } else if (newSize > this.poolSize) {
      // 扩大池
      const toAdd = newSize - this.poolSize;
      for (let i = 0; i < toAdd; i++) {
        const worker = this.createWorker();
        this.workers.push(worker);
        this.availableWorkers.push(worker);
      }
    }
    this.poolSize = newSize;
  }

  /**
   * 关闭池
   */
  async shutdown(): Promise<void> {
    // 等待所有worker空闲
    while (this.availableWorkers.length < this.workers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.workers = [];
    this.availableWorkers = [];
    this.waitQueue = [];
  }

  /**
   * 获取池状态
   */
  getStatus(): {
    total: number;
    available: number;
    busy: number;
    waiting: number;
  } {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      busy: this.workers.filter(w => w.busy).length,
      waiting: this.waitQueue.length,
    };
  }
}

// ============ 辅助函数 ============

/**
 * 合并多个代理结果
 */
export function mergeAgentResults(results: AgentResult[]): MergedResult {
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  // 合并输出
  const outputSections: string[] = [];
  for (const result of results) {
    const header = `=== Task: ${result.taskId} (${result.success ? 'SUCCESS' : 'FAILED'}) ===`;
    const content = result.success ? result.output || '' : `Error: ${result.error}`;
    const duration = `Duration: ${(result.duration / 1000).toFixed(2)}s`;

    outputSections.push([header, content, duration, ''].join('\n'));
  }

  const combinedOutput = outputSections.join('\n');

  // 统计信息
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const averageDuration = results.length > 0 ? totalDuration / results.length : 0;

  // 收集元数据
  const metadata: Record<string, any> = {
    totalTasks: results.length,
    successfulTasks: successResults.length,
    failedTasks: failedResults.length,
    tasks: results.map(r => ({
      id: r.taskId,
      success: r.success,
      duration: r.duration,
    })),
  };

  return {
    combinedOutput,
    results,
    successCount: successResults.length,
    failureCount: failedResults.length,
    totalDuration,
    averageDuration,
    metadata,
  };
}

/**
 * 创建依赖图
 */
export function createDependencyGraph(tasks: AgentTask[]): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();

  // 创建节点
  for (const task of tasks) {
    nodes.set(task.id, {
      taskId: task.id,
      dependencies: task.dependencies || [],
      dependents: [],
    });
  }

  // 建立反向依赖关系
  for (const node of nodes.values()) {
    for (const depId of node.dependencies) {
      const depNode = nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(node.taskId);
      }
    }
  }

  // 检测循环依赖并进行拓扑排序
  const { levels, hasCycle, cyclePath } = topologicalSort(nodes);

  return {
    nodes,
    levels,
    hasCycle,
    cyclePath,
  };
}

/**
 * 拓扑排序
 */
function topologicalSort(nodes: Map<string, DependencyNode>): {
  levels: string[][];
  hasCycle: boolean;
  cyclePath?: string[];
} {
  const inDegree = new Map<string, number>();
  const levels: string[][] = [];

  // 初始化入度
  for (const [id, node] of nodes.entries()) {
    inDegree.set(id, node.dependencies.length);
  }

  // 使用Kahn算法进行拓扑排序
  let currentLevel = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([id]) => id);

  const visited = new Set<string>();

  while (currentLevel.length > 0) {
    levels.push([...currentLevel]);

    const nextLevel: string[] = [];

    for (const id of currentLevel) {
      visited.add(id);
      const node = nodes.get(id)!;

      // 减少依赖此节点的其他节点的入度
      for (const dependent of node.dependents) {
        const degree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, degree);

        if (degree === 0) {
          nextLevel.push(dependent);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // 检测循环依赖
  const hasCycle = visited.size !== nodes.size;
  let cyclePath: string[] | undefined;

  if (hasCycle) {
    // 查找循环路径
    const unvisited = Array.from(nodes.keys()).filter(id => !visited.has(id));
    cyclePath = findCycle(nodes, unvisited[0]);
  }

  return {
    levels,
    hasCycle,
    cyclePath,
  };
}

/**
 * 查找循环依赖路径(DFS)
 */
function findCycle(nodes: Map<string, DependencyNode>, startId: string): string[] {
  const path: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) {
      // 找到循环
      const cycleStart = path.indexOf(id);
      return true;
    }

    if (visited.has(id)) {
      return false;
    }

    visiting.add(id);
    path.push(id);

    const node = nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        if (dfs(depId)) {
          return true;
        }
      }
    }

    visiting.delete(id);
    visited.add(id);
    path.pop();

    return false;
  }

  dfs(startId);
  return path;
}

/**
 * 验证任务依赖
 */
export function validateTaskDependencies(tasks: AgentTask[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const taskIds = new Set(tasks.map(t => t.id));

  for (const task of tasks) {
    // 检查重复ID
    const duplicates = tasks.filter(t => t.id === task.id);
    if (duplicates.length > 1) {
      errors.push(`Duplicate task ID: ${task.id}`);
    }

    // 检查依赖是否存在
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          errors.push(`Task ${task.id} depends on non-existent task: ${depId}`);
        }
      }
    }
  }

  // 检查循环依赖
  const graph = createDependencyGraph(tasks);
  if (graph.hasCycle) {
    errors.push(`Circular dependency detected: ${graph.cyclePath?.join(' -> ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 估算执行时间
 */
export function estimateExecutionTime(
  tasks: AgentTask[],
  config: Partial<ParallelAgentConfig> = {}
): {
  sequential: number;
  parallel: number;
  speedup: number;
} {
  const avgTaskTime = 60000; // 假设平均任务时间为60秒
  const maxConcurrency = config.maxConcurrency || DEFAULT_CONFIG.maxConcurrency;

  const sequential = tasks.length * avgTaskTime;

  // 简单估算:考虑依赖关系
  const graph = createDependencyGraph(tasks);
  const maxLevel = graph.levels.reduce((max, level) => Math.max(max, level.length), 0);
  const avgLevelSize = tasks.length / graph.levels.length;

  const parallel = graph.levels.reduce((total, level) => {
    const batchCount = Math.ceil(level.length / maxConcurrency);
    return total + batchCount * avgTaskTime;
  }, 0);

  const speedup = sequential / parallel;

  return {
    sequential,
    parallel,
    speedup,
  };
}
