/**
 * Agent 工具 (Task)
 * 子代理管理 - 参照官方 Claude Code CLI v2.0.76 实现
 */

import { BaseTool } from './base.js';
import type { AgentInput, ToolResult, ToolDefinition } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getBackgroundShell, isShellId } from './bash.js';
import { ConversationLoop, type LoopOptions } from '../core/loop.js';
import {
  runSubagentStartHooks,
  runSubagentStopHooks,
  type HookInput
} from '../hooks/index.js';
import type { Message } from '../types/index.js';

// 代理类型定义（参照官方）
export interface AgentTypeDefinition {
  agentType: string;
  whenToUse: string;
  tools?: string[];
  forkContext?: boolean;  // 是否访问父对话上下文
  permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';
  model?: string;
  description?: string;
}

// 内置代理类型
export const BUILT_IN_AGENT_TYPES: AgentTypeDefinition[] = [
  {
    agentType: 'general-purpose',
    whenToUse: 'Use this for researching complex questions that require exploring multiple files',
    tools: ['*'],  // 所有工具
    forkContext: false,
  },
  {
    agentType: 'Explore',
    whenToUse: 'Fast agent for exploring codebases and finding specific code patterns',
    tools: ['Glob', 'Grep', 'Read'],
    forkContext: false,
  },
  {
    agentType: 'Plan',
    whenToUse: 'Software architect agent for designing implementation plans',
    tools: ['*'],
    forkContext: false,
    permissionMode: 'plan',
  },
  {
    agentType: 'claude-code-guide',
    whenToUse: 'Agent for Claude Code documentation and API questions',
    tools: ['Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch'],
    forkContext: false,
  },
];

// 代理执行历史条目
export interface AgentHistoryEntry {
  timestamp: Date;
  type: 'started' | 'progress' | 'completed' | 'failed' | 'resumed';
  message: string;
  data?: any;
}

// 后台代理管理
export interface BackgroundAgent {
  id: string;
  agentType: string;
  description: string;
  prompt: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  endTime?: Date;
  result?: ToolResult;
  error?: string;
  // 持久化状态
  history: AgentHistoryEntry[];
  intermediateResults: any[];
  currentStep?: number;
  totalSteps?: number;
  workingDirectory?: string;
  metadata?: Record<string, any>;
  // 新增：对话历史
  messages?: Message[];
}

const backgroundAgents: Map<string, BackgroundAgent> = new Map();

// 代理持久化目录
const getAgentsDir = (): string => {
  const agentsDir = path.join(os.homedir(), '.claude', 'agents');
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }
  return agentsDir;
};

const getAgentFilePath = (agentId: string): string => {
  return path.join(getAgentsDir(), `${agentId}.json`);
};

// 持久化函数
const saveAgentState = (agent: BackgroundAgent): void => {
  try {
    const filePath = getAgentFilePath(agent.id);
    const data = {
      ...agent,
      startTime: agent.startTime.toISOString(),
      endTime: agent.endTime?.toISOString(),
      history: agent.history.map(h => ({
        ...h,
        timestamp: h.timestamp.toISOString(),
      })),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to save agent state ${agent.id}:`, error);
  }
};

const loadAgentState = (agentId: string): BackgroundAgent | null => {
  try {
    const filePath = getAgentFilePath(agentId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const agent: BackgroundAgent = {
      ...data,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      history: data.history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      })),
    };
    return agent;
  } catch (error) {
    console.error(`Failed to load agent state ${agentId}:`, error);
    return null;
  }
};

const deleteAgentState = (agentId: string): void => {
  try {
    const filePath = getAgentFilePath(agentId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to delete agent state ${agentId}:`, error);
  }
};

// 加载所有已保存的代理
const loadAllAgents = (): void => {
  try {
    const agentsDir = getAgentsDir();
    const files = fs.readdirSync(agentsDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const agentId = file.replace('.json', '');
        const agent = loadAgentState(agentId);
        if (agent) {
          backgroundAgents.set(agentId, agent);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load agents:', error);
  }
};

// 添加历史记录
const addAgentHistory = (
  agent: BackgroundAgent,
  type: AgentHistoryEntry['type'],
  message: string,
  data?: any
): void => {
  agent.history.push({
    timestamp: new Date(),
    type,
    message,
    data,
  });
  saveAgentState(agent);
};

// 导出代理管理函数
export function getBackgroundAgents(): BackgroundAgent[] {
  return Array.from(backgroundAgents.values());
}

export function getBackgroundAgent(id: string): BackgroundAgent | undefined {
  let agent = backgroundAgents.get(id);

  // 如果内存中没有，尝试从磁盘加载
  if (!agent) {
    const loaded = loadAgentState(id);
    if (loaded) {
      backgroundAgents.set(id, loaded);
      agent = loaded;
    }
  }

  return agent;
}

export function killBackgroundAgent(id: string): boolean {
  const agent = backgroundAgents.get(id);
  if (!agent) return false;

  if (agent.status === 'running') {
    agent.status = 'failed';
    agent.error = 'Killed by user';
    agent.endTime = new Date();
    addAgentHistory(agent, 'failed', 'Agent killed by user');
  }
  return true;
}

export function clearCompletedAgents(): number {
  let cleared = 0;
  const entries = Array.from(backgroundAgents.entries());
  for (const [id, agent] of entries) {
    if (agent.status === 'completed' || agent.status === 'failed') {
      backgroundAgents.delete(id);
      deleteAgentState(id);
      cleared++;
    }
  }
  return cleared;
}

export function pauseBackgroundAgent(id: string): boolean {
  const agent = backgroundAgents.get(id);
  if (!agent) return false;

  if (agent.status === 'running') {
    agent.status = 'paused';
    addAgentHistory(agent, 'progress', 'Agent paused');
    return true;
  }
  return false;
}

// 获取代理类型定义
export function getAgentTypeDefinition(agentType: string): AgentTypeDefinition | null {
  return BUILT_IN_AGENT_TYPES.find(def => def.agentType === agentType) || null;
}

// 初始化时加载所有代理
loadAllAgents();

export class TaskTool extends BaseTool<AgentInput, ToolResult> {
  name = 'Task';
  description = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types:
${BUILT_IN_AGENT_TYPES.map(def => `- ${def.agentType}: ${def.whenToUse}${def.forkContext ? ' (has access to current context)' : ''}`).join('\n')}

Usage notes:
- Launch multiple agents concurrently for maximum performance
- Use resume parameter to continue a paused or failed agent
- Agent state is persisted to ~/.claude/agents/
- The agent's outputs should be trusted
- Use model parameter to specify haiku/sonnet/opus
- Agents with "access to current context" can see the full conversation history`;

  // 父对话上下文（用于 forkContext）
  private parentMessages: Message[] = [];

  /**
   * 设置父对话上下文（在 Loop 中调用）
   */
  setParentContext(messages: Message[]): void {
    this.parentMessages = messages;
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'A short (3-5 word) description of the task',
        },
        prompt: {
          type: 'string',
          description: 'The task for the agent to perform',
        },
        subagent_type: {
          type: 'string',
          description: 'The type of specialized agent to use for this task',
        },
        model: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku'],
          description: 'Optional model to use for this agent. If not specified, inherits from parent. Prefer haiku for quick, straightforward tasks to minimize cost and latency.',
        },
        resume: {
          type: 'string',
          description: 'Optional agent ID to resume from. If provided, the agent will continue from the previous execution transcript.',
        },
        run_in_background: {
          type: 'boolean',
          description: 'Set to true to run this agent in the background. Use TaskOutput to read the output later.',
        },
      },
      required: ['description', 'prompt', 'subagent_type'],
    };
  }

  async execute(input: AgentInput): Promise<ToolResult> {
    const { description, prompt, subagent_type, model, resume, run_in_background } = input;

    // 验证代理类型
    const agentDef = getAgentTypeDefinition(subagent_type);
    if (!agentDef) {
      return {
        success: false,
        error: `Unknown agent type: ${subagent_type}. Available types: ${BUILT_IN_AGENT_TYPES.map(d => d.agentType).join(', ')}`,
      };
    }

    // Resume 模式
    if (resume) {
      return this.resumeAgent(resume, run_in_background);
    }

    // 新建代理模式
    const agentId = uuidv4();
    const agent: BackgroundAgent = {
      id: agentId,
      agentType: subagent_type,
      description,
      prompt,
      model,
      status: 'running',
      startTime: new Date(),
      history: [],
      intermediateResults: [],
      currentStep: 0,
      workingDirectory: process.cwd(),
      metadata: {},
      messages: [],
    };

    // 添加启动历史
    addAgentHistory(agent, 'started', `Agent started with type ${subagent_type}`);

    // 保存到内存和磁盘
    backgroundAgents.set(agentId, agent);
    saveAgentState(agent);

    if (run_in_background) {
      // 后台执行 - 不阻塞，立即返回
      this.executeAgentInBackground(agent, agentDef);

      return {
        success: true,
        output: `Agent started in background with ID: ${agentId}\nUse TaskOutput tool to check progress.`,
      };
    }

    // 同步执行 - 阻塞直到完成
    const result = await this.executeAgentSync(agent, agentDef);
    return result;
  }

  /**
   * 恢复已有代理
   */
  private async resumeAgent(agentId: string, runInBackground?: boolean): Promise<ToolResult> {
    const existingAgent = getBackgroundAgent(agentId);

    if (!existingAgent) {
      return {
        success: false,
        error: `Agent ${agentId} not found. Unable to resume.`,
      };
    }

    // 检查代理状态是否可以恢复
    if (existingAgent.status === 'completed') {
      return {
        success: false,
        error: `Agent ${agentId} has already completed. Cannot resume.`,
        output: `Agent result:\n${JSON.stringify(existingAgent.result, null, 2)}`,
      };
    }

    if (existingAgent.status === 'running') {
      return {
        success: false,
        error: `Agent ${agentId} is still running. Cannot resume.`,
      };
    }

    // 恢复代理执行
    existingAgent.status = 'running';
    addAgentHistory(existingAgent, 'resumed', `Agent resumed from step ${existingAgent.currentStep || 0}`);

    const agentDef = getAgentTypeDefinition(existingAgent.agentType);
    if (!agentDef) {
      return {
        success: false,
        error: `Agent type ${existingAgent.agentType} not found`,
      };
    }

    const resumeInfo = [
      `Resuming agent ${agentId}`,
      `Type: ${existingAgent.agentType}`,
      `Description: ${existingAgent.description}`,
      `Original prompt: ${existingAgent.prompt}`,
      `Current step: ${existingAgent.currentStep || 0}/${existingAgent.totalSteps || 'unknown'}`,
      `\nExecution history:`,
      ...existingAgent.history.map(h =>
        `  [${h.timestamp.toISOString()}] ${h.type}: ${h.message}`
      ),
    ];

    if (existingAgent.intermediateResults.length > 0) {
      resumeInfo.push('\nIntermediate results:');
      existingAgent.intermediateResults.forEach((result, idx) => {
        resumeInfo.push(`  Step ${idx + 1}: ${JSON.stringify(result).substring(0, 100)}...`);
      });
    }

    if (runInBackground) {
      // 后台恢复执行
      this.executeAgentInBackground(existingAgent, agentDef);

      return {
        success: true,
        output: resumeInfo.join('\n') + '\n\nAgent resumed in background.',
      };
    }

    // 同步恢复执行
    const result = await this.executeAgentSync(existingAgent, agentDef);
    return result;
  }

  /**
   * 后台执行代理（异步，不阻塞）
   */
  private executeAgentInBackground(agent: BackgroundAgent, agentDef: AgentTypeDefinition): void {
    // 使用 Promise 在后台执行，捕获错误
    this.executeAgentLoop(agent, agentDef)
      .then(() => {
        // 执行完成
        agent.status = 'completed';
        agent.endTime = new Date();
        addAgentHistory(agent, 'completed', 'Agent completed successfully');
        saveAgentState(agent);
      })
      .catch((error) => {
        // 执行失败
        agent.status = 'failed';
        agent.error = error instanceof Error ? error.message : String(error);
        agent.endTime = new Date();
        addAgentHistory(agent, 'failed', `Agent failed: ${agent.error}`);
        saveAgentState(agent);
      });
  }

  /**
   * 同步执行代理（阻塞直到完成）
   */
  private async executeAgentSync(agent: BackgroundAgent, agentDef: AgentTypeDefinition): Promise<ToolResult> {
    try {
      await this.executeAgentLoop(agent, agentDef);

      agent.status = 'completed';
      agent.endTime = new Date();

      // 构建结果输出
      const duration = (agent.endTime.getTime() - agent.startTime.getTime()) / 1000;
      const output = agent.result?.output || `Agent ${agent.agentType} completed: ${agent.description}`;

      agent.result = {
        success: true,
        output: `${output}\n\n[Agent completed in ${duration.toFixed(1)}s]`,
      };

      addAgentHistory(agent, 'completed', 'Agent execution completed');
      saveAgentState(agent);

      return agent.result;
    } catch (error) {
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : String(error);
      agent.endTime = new Date();

      addAgentHistory(agent, 'failed', `Agent failed: ${agent.error}`);
      saveAgentState(agent);

      return {
        success: false,
        error: `Agent execution failed: ${agent.error}`,
      };
    }
  }

  /**
   * 真实的代理执行循环（核心逻辑）
   * 参照官方 B4A 函数实现
   */
  private async executeAgentLoop(agent: BackgroundAgent, agentDef: AgentTypeDefinition): Promise<void> {
    // 调用 SubagentStart Hook
    await runSubagentStartHooks(agent.agentType, agent.id);

    try {
      // 构建代理的初始消息
      let initialMessages: Message[] = [];

      // 如果代理支持 forkContext，添加父对话历史
      if (agentDef.forkContext && this.parentMessages.length > 0) {
        // 只包含用户和助手的消息，过滤掉工具调用相关内容
        initialMessages = this.parentMessages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content :
                     Array.isArray(msg.content) ? msg.content.filter(block => block.type === 'text') : [],
          }));
      }

      // 如果是恢复模式，使用已有的消息历史
      if (agent.messages && agent.messages.length > 0) {
        initialMessages = agent.messages;
      }

      // 添加当前任务提示
      initialMessages.push({
        role: 'user',
        content: agent.prompt,
      });

      // 构建 LoopOptions
      const loopOptions: LoopOptions = {
        model: agent.model,
        maxTurns: 30,  // 限制最大轮次以避免无限循环
        verbose: process.env.CLAUDE_VERBOSE === 'true',
        permissionMode: agentDef.permissionMode || 'default',
        // 根据代理定义限制工具访问
        allowedTools: agentDef.tools,
        workingDir: agent.workingDirectory,
      };

      // 创建子对话循环
      const loop = new ConversationLoop(loopOptions);

      // 执行代理任务
      const response = await loop.processMessage(agent.prompt);

      // 保存结果
      agent.result = {
        success: true,
        output: response,
      };

      // 保存对话历史以支持恢复
      agent.messages = initialMessages;

      // 调用 SubagentStop Hook
      await runSubagentStopHooks(agent.agentType, agent.id);

    } catch (error) {
      // 即使失败也要调用 SubagentStop Hook
      await runSubagentStopHooks(agent.agentType, agent.id);

      throw error;
    }
  }
}

export class TaskOutputTool extends BaseTool<{ task_id: string; block?: boolean; timeout?: number; show_history?: boolean }, ToolResult> {
  name = 'TaskOutput';
  description = `Get output and status from a background task (Agent or Bash).

Usage notes:
- Supports both Agent tasks and Bash background shells
- Use block parameter to wait for task completion
- Use show_history to see detailed execution history (Agent only)
- Agent state is automatically persisted and can be resumed`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to get output from',
        },
        block: {
          type: 'boolean',
          description: 'Whether to wait for completion',
        },
        timeout: {
          type: 'number',
          description: 'Max wait time in ms',
        },
        show_history: {
          type: 'boolean',
          description: 'Show detailed execution history (extension: not in official SDK)',
        },
      },
      required: ['task_id'],
    };
  }

  async execute(input: { task_id: string; block?: boolean; timeout?: number; show_history?: boolean }): Promise<ToolResult> {
    // 检查是否是 Bash shell ID
    if (isShellId(input.task_id)) {
      const shell = getBackgroundShell(input.task_id);
      if (!shell) {
        return { success: false, error: `Task ${input.task_id} not found` };
      }

      // 委托给 Bash shell 处理逻辑
      return this.handleBashTask(input.task_id, shell, input.block, input.timeout);
    }

    // 处理 Agent 任务
    const agent = getBackgroundAgent(input.task_id);
    if (!agent) {
      return { success: false, error: `Task ${input.task_id} not found` };
    }

    if (input.block && agent.status === 'running') {
      // 等待完成
      const timeout = input.timeout || 5000;
      const startTime = Date.now();

      while (agent.status === 'running' && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
        // 重新加载代理状态以获取最新进度
        const updatedAgent = getBackgroundAgent(input.task_id);
        if (updatedAgent && updatedAgent.status !== 'running') {
          break;
        }
      }
    }

    // 构建输出信息
    const output = [];
    output.push(`=== Agent ${input.task_id} ===`);
    output.push(`Type: ${agent.agentType}`);
    output.push(`Status: ${agent.status}`);
    output.push(`Description: ${agent.description}`);
    output.push(`Started: ${agent.startTime.toISOString()}`);

    if (agent.endTime) {
      const duration = agent.endTime.getTime() - agent.startTime.getTime();
      output.push(`Ended: ${agent.endTime.toISOString()}`);
      output.push(`Duration: ${(duration / 1000).toFixed(2)}s`);
    }

    if (agent.currentStep !== undefined && agent.totalSteps !== undefined) {
      output.push(`Progress: ${agent.currentStep}/${agent.totalSteps} steps`);
    }

    if (agent.workingDirectory) {
      output.push(`Working Directory: ${agent.workingDirectory}`);
    }

    // 显示执行历史
    if (input.show_history && agent.history.length > 0) {
      output.push('\n=== Execution History ===');
      agent.history.forEach((entry, idx) => {
        const timestamp = entry.timestamp.toISOString();
        output.push(`${idx + 1}. [${timestamp}] ${entry.type.toUpperCase()}: ${entry.message}`);
        if (entry.data) {
          output.push(`   Data: ${JSON.stringify(entry.data)}`);
        }
      });
    }

    // 显示中间结果
    if (agent.intermediateResults.length > 0) {
      output.push('\n=== Intermediate Results ===');
      agent.intermediateResults.forEach((result, idx) => {
        output.push(`Step ${idx + 1}:`);
        output.push(`  ${JSON.stringify(result, null, 2)}`);
      });
    }

    // 显示最终结果或错误
    if (agent.status === 'completed' && agent.result) {
      output.push('\n=== Final Result ===');
      output.push(agent.result.output || 'No output');
    } else if (agent.status === 'failed' && agent.error) {
      output.push('\n=== Error ===');
      output.push(agent.error);
    } else if (agent.status === 'running') {
      output.push('\n=== Status ===');
      output.push('Agent is still running. Use block=true to wait for completion.');
      output.push(`Use resume parameter with agent ID ${agent.id} to continue if interrupted.`);
    } else if (agent.status === 'paused') {
      output.push('\n=== Status ===');
      output.push('Agent is paused.');
      output.push(`Use resume parameter with agent ID ${agent.id} to continue execution.`);
    }

    return {
      success: true,
      output: output.join('\n'),
    };
  }

  /**
   * 处理 Bash 后台任务
   */
  private async handleBashTask(
    taskId: string,
    shell: any,
    block?: boolean,
    timeout?: number
  ): Promise<ToolResult> {
    // 如果需要阻塞等待完成
    if (block && shell.status === 'running') {
      const maxTimeout = timeout || 30000;
      const startTime = Date.now();

      while (shell.status === 'running' && Date.now() - startTime < maxTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        // 重新获取 shell 状态
        const updatedShell = getBackgroundShell(taskId);
        if (updatedShell && updatedShell.status !== 'running') {
          break;
        }
      }

      if (shell.status === 'running') {
        // 超时但仍在运行
        return {
          success: true,
          output: `Bash task ${taskId} is still running after ${maxTimeout}ms timeout.\nUse block=false to check current output without waiting.`,
        };
      }
    }

    // 构建输出信息
    const output = [];
    output.push(`=== Bash Task ${taskId} ===`);
    output.push(`Command: ${shell.command}`);
    output.push(`Status: ${shell.status}`);
    output.push(`Started: ${new Date(shell.startTime).toISOString()}`);

    const duration = Date.now() - shell.startTime;
    if (shell.endTime) {
      output.push(`Ended: ${new Date(shell.endTime).toISOString()}`);
      output.push(`Duration: ${((shell.endTime - shell.startTime) / 1000).toFixed(2)}s`);
    } else {
      output.push(`Duration: ${(duration / 1000).toFixed(2)}s (running)`);
    }

    if (shell.exitCode !== undefined) {
      output.push(`Exit Code: ${shell.exitCode}`);
    }

    output.push(`Output File: ${shell.outputFile}`);

    // 读取输出
    const shellOutput = shell.output.join('');
    if (shellOutput.trim()) {
      output.push('\n=== Output ===');
      output.push(shellOutput);
    } else {
      output.push('\n=== Output ===');
      output.push('(no output yet)');
    }

    if (shell.status === 'completed') {
      output.push('\n=== Status ===');
      output.push('Command completed successfully.');
    } else if (shell.status === 'failed') {
      output.push('\n=== Status ===');
      output.push(`Command failed with exit code ${shell.exitCode}.`);
    } else if (shell.status === 'running') {
      output.push('\n=== Status ===');
      output.push('Command is still running. Use block=true to wait for completion.');
    }

    return {
      success: true,
      output: output.join('\n'),
    };
  }
}

export class ListAgentsTool extends BaseTool<{ status_filter?: string; include_completed?: boolean }, ToolResult> {
  name = 'ListAgents';
  description = `List all background agents with their current status.

Usage notes:
- Filter by status: running, completed, failed, paused
- By default, excludes completed agents
- Shows agent IDs that can be used with resume parameter`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        status_filter: {
          type: 'string',
          enum: ['running', 'completed', 'failed', 'paused'],
          description: 'Filter agents by status',
        },
        include_completed: {
          type: 'boolean',
          description: 'Include completed agents (default: false)',
        },
      },
    };
  }

  async execute(input: { status_filter?: string; include_completed?: boolean }): Promise<ToolResult> {
    const agents = getBackgroundAgents();

    if (agents.length === 0) {
      return {
        success: true,
        output: 'No background agents found.',
      };
    }

    // 过滤代理
    let filteredAgents = agents;

    if (input.status_filter) {
      filteredAgents = filteredAgents.filter(a => a.status === input.status_filter);
    }

    if (!input.include_completed) {
      filteredAgents = filteredAgents.filter(a => a.status !== 'completed');
    }

    if (filteredAgents.length === 0) {
      return {
        success: true,
        output: 'No agents match the specified criteria.',
      };
    }

    // 构建输出
    const output = [];
    output.push(`=== Background Agents (${filteredAgents.length}) ===\n`);

    filteredAgents.forEach((agent, idx) => {
      output.push(`${idx + 1}. Agent ID: ${agent.id}`);
      output.push(`   Type: ${agent.agentType}`);
      output.push(`   Status: ${agent.status}`);
      output.push(`   Description: ${agent.description}`);
      output.push(`   Started: ${agent.startTime.toISOString()}`);

      if (agent.currentStep !== undefined && agent.totalSteps !== undefined) {
        output.push(`   Progress: ${agent.currentStep}/${agent.totalSteps} steps`);
      }

      if (agent.endTime) {
        const duration = agent.endTime.getTime() - agent.startTime.getTime();
        output.push(`   Duration: ${(duration / 1000).toFixed(2)}s`);
      }

      if (agent.status === 'paused' || agent.status === 'failed') {
        output.push(`   → Can be resumed with: resume="${agent.id}"`);
      }

      output.push('');
    });

    output.push('Use TaskOutput tool to get detailed information about a specific agent.');
    output.push('Use Task tool with resume parameter to continue paused or failed agents.');

    return {
      success: true,
      output: output.join('\n'),
    };
  }
}
