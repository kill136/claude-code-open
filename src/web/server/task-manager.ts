/**
 * WebUI 后台任务管理器
 * 管理 Task 工具启动的后台 Agent 任务
 */

import { randomUUID } from 'crypto';
import { ConversationLoop, type LoopOptions } from '../../core/loop.js';
import type { Message } from '../../types/index.js';
import type { WebSocket } from 'ws';
import {
  getAgentTypeDefinition,
  type AgentTypeDefinition,
  BUILT_IN_AGENT_TYPES,
} from '../../tools/agent.js';
import {
  runSubagentStartHooks,
  runSubagentStopHooks,
} from '../../hooks/index.js';

/**
 * 任务信息
 */
export interface TaskInfo {
  id: string;
  description: string;
  agentType: string;
  prompt: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  result?: string;
  error?: string;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  workingDirectory?: string;
  metadata?: Record<string, any>;
}

/**
 * 任务执行上下文
 */
interface TaskExecutionContext {
  task: TaskInfo;
  agentDef: AgentTypeDefinition;
  messages: Message[];
  loop?: ConversationLoop;
  abortController?: AbortController;
}

/**
 * 任务管理器
 */
export class TaskManager {
  private tasks = new Map<string, TaskExecutionContext>();
  private outputBuffers = new Map<string, string>();
  private ws?: WebSocket;

  /**
   * 设置 WebSocket 连接以发送状态更新
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  /**
   * 发送任务状态更新到前端
   */
  private sendTaskStatus(task: TaskInfo): void {
    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      try {
        this.ws.send(JSON.stringify({
          type: 'task_status',
          payload: {
            taskId: task.id,
            status: task.status,
            result: task.result,
            error: task.error,
            progress: task.progress,
          },
        }));
      } catch (error) {
        console.error('[TaskManager] 发送任务状态失败:', error);
      }
    }
  }

  /**
   * 创建新任务
   */
  async createTask(
    description: string,
    prompt: string,
    agentType: string,
    options?: {
      model?: string;
      runInBackground?: boolean;
      parentMessages?: Message[];
      workingDirectory?: string;
    }
  ): Promise<string> {
    // 验证代理类型
    const agentDef = getAgentTypeDefinition(agentType);
    if (!agentDef) {
      throw new Error(
        `Unknown agent type: ${agentType}. Available: ${BUILT_IN_AGENT_TYPES.map(d => d.agentType).join(', ')}`
      );
    }

    const taskId = randomUUID();

    // 创建任务信息
    const task: TaskInfo = {
      id: taskId,
      description,
      agentType,
      prompt,
      model: options?.model,
      status: 'running',
      startTime: new Date(),
      workingDirectory: options?.workingDirectory || process.cwd(),
      metadata: {},
    };

    // 构建初始消息
    let initialMessages: Message[] = [];

    // 如果代理支持 forkContext，添加父对话历史
    if (agentDef.forkContext && options?.parentMessages && options.parentMessages.length > 0) {
      initialMessages = options.parentMessages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content :
                   Array.isArray(msg.content) ? msg.content.filter(block => block.type === 'text') : [],
        }));
    }

    // 添加当前任务提示
    initialMessages.push({
      role: 'user',
      content: prompt,
    });

    // 创建执行上下文
    const context: TaskExecutionContext = {
      task,
      agentDef,
      messages: initialMessages,
      abortController: new AbortController(),
    };

    this.tasks.set(taskId, context);

    // 发送任务创建通知
    this.sendTaskStatus(task);

    // 启动任务执行（异步，不阻塞）
    if (options?.runInBackground !== false) {
      this.executeTaskInBackground(context);
    }

    return taskId;
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): TaskInfo | undefined {
    const context = this.tasks.get(taskId);
    return context?.task;
  }

  /**
   * 获取所有任务
   */
  listTasks(): TaskInfo[] {
    return Array.from(this.tasks.values()).map(ctx => ctx.task);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const context = this.tasks.get(taskId);
    if (!context) return false;

    if (context.task.status === 'running') {
      context.task.status = 'cancelled';
      context.task.endTime = new Date();
      context.task.error = 'Cancelled by user';
      context.abortController?.abort();

      // 发送状态更新
      this.sendTaskStatus(context.task);

      return true;
    }

    return false;
  }

  /**
   * 获取任务输出
   */
  getTaskOutput(taskId: string): string | undefined {
    const context = this.tasks.get(taskId);
    if (!context) return undefined;

    const buffer = this.outputBuffers.get(taskId);
    if (buffer) return buffer;

    if (context.task.status === 'completed') {
      return context.task.result;
    } else if (context.task.status === 'failed') {
      return context.task.error;
    }

    return undefined;
  }

  /**
   * 清理已完成的任务
   */
  clearCompletedTasks(): number {
    let cleared = 0;
    for (const [taskId, context] of this.tasks.entries()) {
      if (context.task.status === 'completed' || context.task.status === 'failed' || context.task.status === 'cancelled') {
        this.tasks.delete(taskId);
        this.outputBuffers.delete(taskId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * 后台执行任务
   */
  private async executeTaskInBackground(context: TaskExecutionContext): Promise<void> {
    const { task, agentDef, messages } = context;

    try {
      // 调用 SubagentStart Hook
      await runSubagentStartHooks(task.id, task.agentType);

      // 构建 LoopOptions
      const loopOptions: LoopOptions = {
        model: task.model,
        maxTurns: 30,
        verbose: process.env.CLAUDE_VERBOSE === 'true',
        permissionMode: agentDef.permissionMode || 'default',
        allowedTools: agentDef.tools,
        workingDir: task.workingDirectory,
        systemPrompt: agentDef.getSystemPrompt?.(),
      };

      // 创建对话循环
      const loop = new ConversationLoop(loopOptions);
      context.loop = loop;

      // 如果有初始上下文消息，注入到 session 中
      if (messages.length > 1) {
        const session = loop.getSession();
        const contextMessages = messages.slice(0, -1);
        for (const msg of contextMessages) {
          session.addMessage(msg);
        }
      }

      // 执行任务（传入最后一条消息即当前任务提示）
      const response = await loop.processMessage(task.prompt);

      // 任务完成
      task.status = 'completed';
      task.endTime = new Date();
      task.result = response;

      // 保存输出到缓冲区
      this.outputBuffers.set(task.id, response);

      // 发送状态更新
      this.sendTaskStatus(task);

      // 调用 SubagentStop Hook
      await runSubagentStopHooks(task.id, task.agentType);

    } catch (error) {
      // 任务失败
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error instanceof Error ? error.message : String(error);

      // 发送状态更新
      this.sendTaskStatus(task);

      // 调用 SubagentStop Hook（即使失败也要调用）
      await runSubagentStopHooks(task.id, task.agentType);
    }
  }

  /**
   * 同步执行任务（阻塞直到完成）
   */
  async executeTaskSync(
    description: string,
    prompt: string,
    agentType: string,
    options?: {
      model?: string;
      parentMessages?: Message[];
      workingDirectory?: string;
    }
  ): Promise<{ success: boolean; output?: string; error?: string; taskId: string }> {
    const taskId = await this.createTask(description, prompt, agentType, {
      ...options,
      runInBackground: false,
    });

    const context = this.tasks.get(taskId);
    if (!context) {
      return {
        success: false,
        error: 'Failed to create task',
        taskId,
      };
    }

    // 执行任务
    await this.executeTaskInBackground(context);

    const task = context.task;

    if (task.status === 'completed') {
      return {
        success: true,
        output: task.result,
        taskId,
      };
    } else {
      return {
        success: false,
        error: task.error || 'Task failed',
        taskId,
      };
    }
  }
}
