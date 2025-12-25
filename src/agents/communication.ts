/**
 * 代理间通信机制
 * Agent Inter-Communication System
 *
 * 实现代理间的消息传递、共享状态、事件系统和协调机制
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息接口
 */
export interface Message {
  /** 消息ID */
  id: string;
  /** 发送者代理ID */
  from: string;
  /** 接收者代理ID（字符串表示单个接收者，数组表示多个接收者） */
  to: string | string[];
  /** 消息类型 */
  type: string;
  /** 消息载荷 */
  payload: any;
  /** 时间戳 */
  timestamp: Date;
  /** 优先级 (0-10, 数字越大优先级越高) */
  priority: number;
  /** 是否需要响应 */
  requiresResponse?: boolean;
  /** 响应目标消息ID */
  responseToId?: string;
  /** 过期时间 */
  expiresAt?: Date;
}

/**
 * 共享状态接口
 */
export interface SharedState {
  /** 获取值 */
  get<T>(key: string): T | undefined;
  /** 设置值 */
  set<T>(key: string, value: T): void;
  /** 删除值 */
  delete(key: string): boolean;
  /** 监听值变化 */
  watch(key: string, callback: (value: any) => void): () => void;
}

/**
 * 锁接口
 */
export interface Lock {
  /** 锁ID */
  id: string;
  /** 锁持有者 */
  holder: string;
  /** 锁定的键 */
  key: string;
  /** 获取时间 */
  acquiredAt: Date;
  /** 过期时间 */
  expiresAt?: Date;
}

/**
 * 任务分配标准
 */
export interface AssignmentCriteria {
  /** 必需的代理类型 */
  requiredAgentType?: string;
  /** 必需的能力 */
  requiredCapabilities?: string[];
  /** 负载权重策略 */
  loadBalanceStrategy?: 'round-robin' | 'least-busy' | 'random' | 'capability-match';
  /** 优先级 */
  priority?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 任务结果
 */
export interface TaskResult {
  /** 任务ID */
  taskId: string;
  /** 执行代理ID */
  agentId: string;
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
  /** 执行时长（毫秒） */
  duration: number;
}

/**
 * 任务定义
 */
export interface Task {
  /** 任务ID */
  id: string;
  /** 任务类型 */
  type: string;
  /** 任务数据 */
  data: any;
  /** 优先级 */
  priority: number;
  /** 创建时间 */
  createdAt: Date;
  /** 超时时间 */
  timeout?: number;
}

/**
 * 死锁信息
 */
export interface DeadlockInfo {
  /** 检测时间 */
  detectedAt: Date;
  /** 涉及的代理 */
  involvedAgents: string[];
  /** 涉及的资源 */
  involvedResources: string[];
  /** 依赖链 */
  dependencyChain: Array<{
    agent: string;
    waitingFor: string;
    resource: string;
  }>;
}

/**
 * 代理能力
 */
export interface AgentCapabilities {
  /** 代理ID */
  agentId: string;
  /** 代理类型 */
  type: string;
  /** 能力列表 */
  capabilities: string[];
  /** 当前负载 (0-1) */
  currentLoad: number;
  /** 最大并发任务数 */
  maxConcurrentTasks: number;
  /** 当前任务数 */
  currentTasks: number;
  /** 状态 */
  status: 'idle' | 'busy' | 'offline';
  /** 最后心跳时间 */
  lastHeartbeat: Date;
}

/**
 * 消息订阅
 */
interface MessageSubscription {
  agentId: string;
  types: string[];
  callback?: (message: Message) => void;
}

// ============================================================================
// 消息总线
// ============================================================================

/**
 * 代理消息总线
 * 负责代理间的消息传递和路由
 */
export class AgentMessageBus extends EventEmitter {
  private messageQueues: Map<string, Message[]> = new Map();
  private subscriptions: Map<string, MessageSubscription> = new Map();
  private messageHistory: Message[] = [];
  private maxHistorySize: number = 1000;
  private maxQueueSize: number = 100;

  constructor() {
    super();
    this.setMaxListeners(100); // 允许更多的监听器
  }

  /**
   * 发送消息
   */
  async send(message: Message): Promise<void> {
    // 验证消息
    if (!message.id) {
      message.id = uuidv4();
    }
    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    // 检查消息是否过期
    if (message.expiresAt && message.expiresAt < new Date()) {
      throw new Error(`Message ${message.id} has expired`);
    }

    // 记录到历史
    this.addToHistory(message);

    // 发送到接收者
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const recipient of recipients) {
      await this.deliverToAgent(recipient, message);
    }

    // 触发事件
    this.emit('message:sent', message);
  }

  /**
   * 广播消息到所有订阅的代理
   */
  async broadcast(type: string, payload: any, sender: string = 'system'): Promise<void> {
    const message: Message = {
      id: uuidv4(),
      from: sender,
      to: '*',
      type,
      payload,
      timestamp: new Date(),
      priority: 5,
    };

    // 发送给所有订阅该类型的代理
    for (const [agentId, subscription] of Array.from(this.subscriptions.entries())) {
      if (subscription.types.includes(type) || subscription.types.includes('*')) {
        const agentMessage = { ...message, to: agentId };
        await this.deliverToAgent(agentId, agentMessage);
      }
    }

    this.emit('message:broadcast', message);
  }

  /**
   * 订阅消息类型
   */
  subscribe(agentId: string, types: string[], callback?: (message: Message) => void): void {
    this.subscriptions.set(agentId, {
      agentId,
      types,
      callback,
    });

    // 确保队列存在
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, []);
    }

    this.emit('agent:subscribed', { agentId, types });
  }

  /**
   * 取消订阅
   */
  unsubscribe(agentId: string): void {
    this.subscriptions.delete(agentId);
    this.emit('agent:unsubscribed', { agentId });
  }

  /**
   * 获取代理的消息队列
   */
  getQueue(agentId: string): Message[] {
    return this.messageQueues.get(agentId) || [];
  }

  /**
   * 清空代理的消息队列
   */
  clearQueue(agentId: string): void {
    this.messageQueues.set(agentId, []);
  }

  /**
   * 从队列中取出消息
   */
  dequeue(agentId: string, count: number = 1): Message[] {
    const queue = this.messageQueues.get(agentId) || [];
    const messages = queue.splice(0, count);
    return messages;
  }

  /**
   * 获取消息历史
   */
  getHistory(limit?: number): Message[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * 清空消息历史
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * 请求-响应模式
   */
  async request(to: string, type: string, payload: any, from: string, timeout: number = 5000): Promise<any> {
    const requestId = uuidv4();
    const message: Message = {
      id: requestId,
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      priority: 7,
      requiresResponse: true,
    };

    // 等待响应
    const responsePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(`response:${requestId}`, handler);
        reject(new Error(`Request timeout: ${timeout}ms`));
      }, timeout);

      const handler = (response: Message) => {
        clearTimeout(timer);
        resolve(response.payload);
      };

      this.once(`response:${requestId}`, handler);
    });

    // 发送请求
    await this.send(message);

    return responsePromise;
  }

  /**
   * 发送响应
   */
  async respond(requestMessage: Message, payload: any): Promise<void> {
    const responseMessage: Message = {
      id: uuidv4(),
      from: requestMessage.to as string,
      to: requestMessage.from,
      type: `${requestMessage.type}:response`,
      payload,
      timestamp: new Date(),
      priority: requestMessage.priority,
      responseToId: requestMessage.id,
    };

    await this.send(responseMessage);

    // 触发响应事件
    this.emit(`response:${requestMessage.id}`, responseMessage);
  }

  /**
   * 投递消息到代理
   */
  private async deliverToAgent(agentId: string, message: Message): Promise<void> {
    const queue = this.messageQueues.get(agentId) || [];

    // 检查队列大小
    if (queue.length >= this.maxQueueSize) {
      // 移除优先级最低的消息
      queue.sort((a, b) => b.priority - a.priority);
      queue.pop();
    }

    // 按优先级插入
    const insertIndex = queue.findIndex(m => m.priority < message.priority);
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }

    this.messageQueues.set(agentId, queue);

    // 如果有回调，立即调用
    const subscription = this.subscriptions.get(agentId);
    if (subscription?.callback) {
      try {
        subscription.callback(message);
      } catch (error) {
        this.emit('error', error);
      }
    }

    this.emit('message:delivered', { agentId, message });
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(message: Message): void {
    this.messageHistory.push(message);

    // 限制历史大小
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalMessages: number;
    activeSubscriptions: number;
    queueSizes: Map<string, number>;
  } {
    const queueSizes = new Map<string, number>();
    for (const [agentId, queue] of Array.from(this.messageQueues.entries())) {
      queueSizes.set(agentId, queue.length);
    }

    return {
      totalMessages: this.messageHistory.length,
      activeSubscriptions: this.subscriptions.size,
      queueSizes,
    };
  }
}

// ============================================================================
// 共享状态管理器
// ============================================================================

/**
 * 共享状态管理器
 * 实现代理间的状态共享和同步
 */
export class SharedStateManager extends EventEmitter implements SharedState {
  private state: Map<string, any> = new Map();
  private watchers: Map<string, Set<(value: any) => void>> = new Map();
  private locks: Map<string, Lock> = new Map();
  private lockWaitQueue: Map<string, Array<{ resolve: () => void; reject: (error: Error) => void }>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);

    // 定期清理过期的锁
    setInterval(() => {
      this.cleanupExpiredLocks();
    }, 1000);
  }

  /**
   * 获取值
   */
  get<T>(key: string): T | undefined {
    return this.state.get(key);
  }

  /**
   * 设置值
   */
  set<T>(key: string, value: T): void {
    const oldValue = this.state.get(key);
    this.state.set(key, value);

    // 触发 watchers
    this.notifyWatchers(key, value);

    // 触发事件
    this.emit('state:changed', { key, value, oldValue });
  }

  /**
   * 删除值
   */
  delete(key: string): boolean {
    const existed = this.state.has(key);
    if (existed) {
      const oldValue = this.state.get(key);
      this.state.delete(key);
      this.notifyWatchers(key, undefined);
      this.emit('state:deleted', { key, oldValue });
    }
    return existed;
  }

  /**
   * 监听值变化
   */
  watch(key: string, callback: (value: any) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }

    const watcherSet = this.watchers.get(key)!;
    watcherSet.add(callback);

    // 返回取消监听的函数
    return () => {
      watcherSet.delete(callback);
      if (watcherSet.size === 0) {
        this.watchers.delete(key);
      }
    };
  }

  /**
   * 获取锁
   */
  async lock(key: string, holder: string, timeout: number = 5000): Promise<Lock> {
    // 检查是否已经有锁
    const existingLock = this.locks.get(key);
    if (existingLock) {
      // 等待锁释放
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const queue = this.lockWaitQueue.get(key);
          if (queue) {
            const index = queue.findIndex(item => item.reject === reject);
            if (index !== -1) {
              queue.splice(index, 1);
            }
          }
          reject(new Error(`Lock timeout for key: ${key}`));
        }, timeout);

        const waitItem = {
          resolve: () => {
            clearTimeout(timer);
            const lock = this.createLock(key, holder, timeout);
            resolve(lock);
          },
          reject: (error: Error) => {
            clearTimeout(timer);
            reject(error);
          },
        };

        if (!this.lockWaitQueue.has(key)) {
          this.lockWaitQueue.set(key, []);
        }
        this.lockWaitQueue.get(key)!.push(waitItem);
      });
    }

    // 创建新锁
    return this.createLock(key, holder, timeout);
  }

  /**
   * 释放锁
   */
  unlock(lock: Lock): void {
    const currentLock = this.locks.get(lock.key);
    if (!currentLock || currentLock.id !== lock.id) {
      throw new Error(`Invalid lock or lock not held: ${lock.key}`);
    }

    this.locks.delete(lock.key);
    this.emit('lock:released', lock);

    // 处理等待队列
    const waitQueue = this.lockWaitQueue.get(lock.key);
    if (waitQueue && waitQueue.length > 0) {
      const nextWaiter = waitQueue.shift()!;
      nextWaiter.resolve();
    }
  }

  /**
   * 检查锁状态
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * 获取所有锁
   */
  getAllLocks(): Lock[] {
    return Array.from(this.locks.values());
  }

  /**
   * 原子操作：比较并交换
   */
  compareAndSwap<T>(key: string, expected: T, newValue: T): boolean {
    const current = this.state.get(key);
    if (current === expected) {
      this.set(key, newValue);
      return true;
    }
    return false;
  }

  /**
   * 原子操作：增量
   */
  increment(key: string, delta: number = 1): number {
    const current = this.state.get(key) || 0;
    const newValue = current + delta;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * 清空状态
   */
  clear(): void {
    this.state.clear();
    this.emit('state:cleared');
  }

  /**
   * 创建锁
   */
  private createLock(key: string, holder: string, timeout?: number): Lock {
    const lock: Lock = {
      id: uuidv4(),
      holder,
      key,
      acquiredAt: new Date(),
      expiresAt: timeout ? new Date(Date.now() + timeout) : undefined,
    };

    this.locks.set(key, lock);
    this.emit('lock:acquired', lock);

    return lock;
  }

  /**
   * 清理过期的锁
   */
  private cleanupExpiredLocks(): void {
    const now = new Date();
    for (const [key, lock] of Array.from(this.locks.entries())) {
      if (lock.expiresAt && lock.expiresAt < now) {
        this.unlock(lock);
      }
    }
  }

  /**
   * 通知 watchers
   */
  private notifyWatchers(key: string, value: any): void {
    const watcherSet = this.watchers.get(key);
    if (watcherSet) {
      for (const callback of Array.from(watcherSet)) {
        try {
          callback(value);
        } catch (error) {
          this.emit('error', error);
        }
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    stateSize: number;
    watchersCount: number;
    locksCount: number;
    waitQueueSize: number;
  } {
    let totalWaitQueue = 0;
    for (const queue of Array.from(this.lockWaitQueue.values())) {
      totalWaitQueue += queue.length;
    }

    return {
      stateSize: this.state.size,
      watchersCount: this.watchers.size,
      locksCount: this.locks.size,
      waitQueueSize: totalWaitQueue,
    };
  }
}

// ============================================================================
// 代理协调器
// ============================================================================

/**
 * 代理协调器
 * 负责任务分配、负载均衡、死锁检测等
 */
export class AgentCoordinator extends EventEmitter {
  private messageBus: AgentMessageBus;
  private sharedState: SharedStateManager;
  private agents: Map<string, AgentCapabilities> = new Map();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> agentId
  private taskResults: Map<string, TaskResult> = new Map();
  private resourceDependencies: Map<string, Set<string>> = new Map(); // agentId -> resources
  private roundRobinIndex: number = 0;

  constructor(messageBus: AgentMessageBus, sharedState?: SharedStateManager) {
    super();
    this.messageBus = messageBus;
    this.sharedState = sharedState || new SharedStateManager();
    this.setMaxListeners(100);

    // 监听心跳消息
    this.messageBus.subscribe('coordinator', ['agent:heartbeat', 'agent:register', 'agent:unregister']);

    // 定期检查代理健康状态
    setInterval(() => {
      this.checkAgentHealth();
    }, 5000);
  }

  /**
   * 注册代理
   */
  registerAgent(capabilities: AgentCapabilities): void {
    this.agents.set(capabilities.agentId, capabilities);
    this.emit('agent:registered', capabilities);
  }

  /**
   * 注销代理
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.resourceDependencies.delete(agentId);
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * 更新代理状态
   */
  updateAgentStatus(agentId: string, status: Partial<AgentCapabilities>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, status);
      agent.lastHeartbeat = new Date();
      this.emit('agent:updated', agent);
    }
  }

  /**
   * 分配任务
   */
  async assignTask(task: Task, criteria: AssignmentCriteria): Promise<string> {
    // 选择合适的代理
    const selectedAgent = this.selectAgent(criteria);

    if (!selectedAgent) {
      throw new Error('No suitable agent available for task');
    }

    // 记录任务分配
    this.taskAssignments.set(task.id, selectedAgent.agentId);

    // 更新代理负载
    selectedAgent.currentTasks++;
    selectedAgent.currentLoad = selectedAgent.currentTasks / selectedAgent.maxConcurrentTasks;

    if (selectedAgent.currentTasks >= selectedAgent.maxConcurrentTasks) {
      selectedAgent.status = 'busy';
    }

    // 发送任务到代理
    await this.messageBus.send({
      id: uuidv4(),
      from: 'coordinator',
      to: selectedAgent.agentId,
      type: 'task:assigned',
      payload: task,
      timestamp: new Date(),
      priority: criteria.priority || 5,
    });

    this.emit('task:assigned', { task, agentId: selectedAgent.agentId });

    return selectedAgent.agentId;
  }

  /**
   * 等待任务完成
   */
  async waitForCompletion(taskIds: string[], timeout?: number): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const startTime = Date.now();

    for (const taskId of taskIds) {
      const elapsed = Date.now() - startTime;
      const remainingTimeout = timeout ? timeout - elapsed : undefined;

      if (remainingTimeout !== undefined && remainingTimeout <= 0) {
        throw new Error('Timeout waiting for task completion');
      }

      const result = await this.waitForSingleTask(taskId, remainingTimeout);
      results.push(result);
    }

    return results;
  }

  /**
   * 同步代理
   */
  async synchronize(agentIds: string[]): Promise<void> {
    const barrierKey = `barrier:${uuidv4()}`;
    let arrivedCount = 0;

    // 创建屏障
    this.sharedState.set(barrierKey, {
      total: agentIds.length,
      arrived: 0,
      agentIds,
    });

    // 通知所有代理到达屏障
    await this.messageBus.broadcast('sync:barrier', {
      barrierKey,
      agentIds,
    });

    // 等待所有代理到达
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unwatch();
        reject(new Error('Synchronization timeout'));
      }, 30000); // 30秒超时

      const unwatch = this.sharedState.watch(barrierKey, (value) => {
        if (value && value.arrived >= value.total) {
          clearTimeout(timeout);
          unwatch();
          this.sharedState.delete(barrierKey);
          resolve();
        }
      });
    });
  }

  /**
   * 检测死锁
   */
  detectDeadlock(): DeadlockInfo | null {
    // 构建资源依赖图
    const dependencyGraph = new Map<string, string[]>();

    // 获取所有锁
    const locks = this.sharedState.getAllLocks();

    // 构建依赖关系
    for (const lock of locks) {
      const holder = lock.holder;
      const resources = this.resourceDependencies.get(holder) || new Set();

      if (!dependencyGraph.has(holder)) {
        dependencyGraph.set(holder, []);
      }

      // 查找等待该资源的代理
      for (const [agentId, agentResources] of Array.from(this.resourceDependencies.entries())) {
        if (agentId !== holder && agentResources.has(lock.key)) {
          dependencyGraph.get(holder)!.push(agentId);
        }
      }
    }

    // 检测环路（死锁）
    const cycle = this.detectCycle(dependencyGraph);

    if (cycle.length > 0) {
      // 构建死锁信息
      const involvedResources = new Set<string>();
      for (const agentId of cycle) {
        const resources = this.resourceDependencies.get(agentId);
        if (resources) {
          resources.forEach(r => involvedResources.add(r));
        }
      }

      const dependencyChain = cycle.map((agentId, index) => {
        const nextAgent = cycle[(index + 1) % cycle.length];
        const resources = this.resourceDependencies.get(agentId) || new Set();
        return {
          agent: agentId,
          waitingFor: nextAgent,
          resource: Array.from(resources)[0] || 'unknown',
        };
      });

      const deadlockInfo: DeadlockInfo = {
        detectedAt: new Date(),
        involvedAgents: cycle,
        involvedResources: Array.from(involvedResources),
        dependencyChain,
      };

      this.emit('deadlock:detected', deadlockInfo);

      return deadlockInfo;
    }

    return null;
  }

  /**
   * 记录资源依赖
   */
  recordResourceDependency(agentId: string, resource: string): void {
    if (!this.resourceDependencies.has(agentId)) {
      this.resourceDependencies.set(agentId, new Set());
    }
    this.resourceDependencies.get(agentId)!.add(resource);
  }

  /**
   * 移除资源依赖
   */
  removeResourceDependency(agentId: string, resource: string): void {
    const resources = this.resourceDependencies.get(agentId);
    if (resources) {
      resources.delete(resource);
    }
  }

  /**
   * 获取代理列表
   */
  getAgents(): AgentCapabilities[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取代理信息
   */
  getAgent(agentId: string): AgentCapabilities | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 选择代理
   */
  private selectAgent(criteria: AssignmentCriteria): AgentCapabilities | null {
    let candidates = Array.from(this.agents.values()).filter(
      agent => agent.status !== 'offline' && agent.currentTasks < agent.maxConcurrentTasks
    );

    // 过滤代理类型
    if (criteria.requiredAgentType) {
      candidates = candidates.filter(agent => agent.type === criteria.requiredAgentType);
    }

    // 过滤能力
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      candidates = candidates.filter(agent =>
        criteria.requiredCapabilities!.every(cap => agent.capabilities.includes(cap))
      );
    }

    if (candidates.length === 0) {
      return null;
    }

    // 应用负载均衡策略
    const strategy = criteria.loadBalanceStrategy || 'least-busy';

    switch (strategy) {
      case 'least-busy':
        candidates.sort((a, b) => a.currentLoad - b.currentLoad);
        return candidates[0];

      case 'round-robin':
        this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length;
        return candidates[this.roundRobinIndex];

      case 'random':
        return candidates[Math.floor(Math.random() * candidates.length)];

      case 'capability-match':
        // 选择能力最匹配的
        const requiredCaps = criteria.requiredCapabilities || [];
        candidates.sort((a, b) => {
          const aMatch = a.capabilities.filter(cap => requiredCaps.includes(cap)).length;
          const bMatch = b.capabilities.filter(cap => requiredCaps.includes(cap)).length;
          return bMatch - aMatch;
        });
        return candidates[0];

      default:
        return candidates[0];
    }
  }

  /**
   * 等待单个任务完成
   */
  private async waitForSingleTask(taskId: string, timeout?: number): Promise<TaskResult> {
    // 检查是否已经完成
    const existingResult = this.taskResults.get(taskId);
    if (existingResult) {
      return existingResult;
    }

    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            this.removeListener(`task:completed:${taskId}`, handler);
            reject(new Error(`Task ${taskId} timeout`));
          }, timeout)
        : null;

      const handler = (result: TaskResult) => {
        if (timer) clearTimeout(timer);
        resolve(result);
      };

      this.once(`task:completed:${taskId}`, handler);
    });
  }

  /**
   * 记录任务完成
   */
  completeTask(taskId: string, result: TaskResult): void {
    this.taskResults.set(taskId, result);

    // 更新代理负载
    const agentId = this.taskAssignments.get(taskId);
    if (agentId) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.currentTasks = Math.max(0, agent.currentTasks - 1);
        agent.currentLoad = agent.currentTasks / agent.maxConcurrentTasks;

        if (agent.currentTasks < agent.maxConcurrentTasks) {
          agent.status = agent.currentTasks === 0 ? 'idle' : 'busy';
        }
      }
    }

    this.emit(`task:completed:${taskId}`, result);
    this.emit('task:completed', result);
  }

  /**
   * 检测环路（用于死锁检测）
   */
  private detectCycle(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // 发现环路
          const cycleStart = path.indexOf(neighbor);
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of Array.from(graph.keys())) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          return path;
        }
      }
    }

    return [];
  }

  /**
   * 检查代理健康状态
   */
  private checkAgentHealth(): void {
    const now = new Date();
    const timeout = 15000; // 15秒心跳超时

    for (const [agentId, agent] of Array.from(this.agents.entries())) {
      const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > timeout && agent.status !== 'offline') {
        agent.status = 'offline';
        this.emit('agent:offline', { agentId });
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    averageLoad: number;
  } {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter(a => a.status !== 'offline').length;
    const totalLoad = agents.reduce((sum, a) => sum + a.currentLoad, 0);

    return {
      totalAgents: this.agents.size,
      activeAgents,
      totalTasks: this.taskAssignments.size,
      completedTasks: this.taskResults.size,
      averageLoad: agents.length > 0 ? totalLoad / agents.length : 0,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建完整的通信系统
 */
export function createCommunicationSystem(): {
  messageBus: AgentMessageBus;
  sharedState: SharedStateManager;
  coordinator: AgentCoordinator;
} {
  const messageBus = new AgentMessageBus();
  const sharedState = new SharedStateManager();
  const coordinator = new AgentCoordinator(messageBus, sharedState);

  return {
    messageBus,
    sharedState,
    coordinator,
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  AgentMessageBus,
  SharedStateManager,
  AgentCoordinator,
  createCommunicationSystem,
};
