/**
 * Agent 工具 (Task)
 * 子代理管理
 */

import { BaseTool } from './base.js';
import type { AgentInput, ToolResult, ToolDefinition } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 代理类型定义
export const AGENT_TYPES = {
  'general-purpose': {
    description: 'General-purpose agent for researching complex questions',
    tools: ['*'],
  },
  'Explore': {
    description: 'Fast agent for exploring codebases',
    tools: ['Glob', 'Grep', 'Read'],
  },
  'Plan': {
    description: 'Software architect agent for designing implementation plans',
    tools: ['*'],
  },
  'claude-code-guide': {
    description: 'Agent for Claude Code documentation',
    tools: ['Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch'],
  },
};

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

// 初始化时加载所有代理
loadAllAgents();

export class TaskTool extends BaseTool<AgentInput, ToolResult> {
  name = 'Task';
  description = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types:
- general-purpose: General-purpose agent for researching complex questions
- Explore: Fast agent for exploring codebases (quick/medium/very thorough)
- Plan: Software architect agent for designing implementation plans
- claude-code-guide: Agent for Claude Code documentation questions

Usage notes:
- Launch multiple agents concurrently for maximum performance
- Use resume parameter to continue a paused or failed agent
- Agent state is persisted to ~/.claude/agents/
- The agent's outputs should be trusted
- Use model parameter to specify haiku/sonnet/opus`;

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

    // Resume 模式
    if (resume) {
      const existingAgent = getBackgroundAgent(resume);

      if (!existingAgent) {
        return {
          success: false,
          error: `Agent ${resume} not found. Unable to resume.`,
        };
      }

      // 检查代理状态是否可以恢复
      if (existingAgent.status === 'completed') {
        return {
          success: false,
          error: `Agent ${resume} has already completed. Cannot resume.`,
          output: `Agent result:\n${JSON.stringify(existingAgent.result, null, 2)}`,
        };
      }

      if (existingAgent.status === 'running') {
        return {
          success: false,
          error: `Agent ${resume} is still running. Cannot resume.`,
        };
      }

      // 恢复代理执行
      existingAgent.status = 'running';
      addAgentHistory(existingAgent, 'resumed', `Agent resumed from step ${existingAgent.currentStep || 0}`);

      const resumeInfo = [
        `Resuming agent ${resume}`,
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

      if (run_in_background) {
        // 后台恢复执行
        this.executeAgentInBackground(existingAgent);

        return {
          success: true,
          output: resumeInfo.join('\n') + '\n\nAgent resumed in background.',
        };
      }

      // 同步恢复执行
      const result = await this.executeAgentSync(existingAgent);
      return result;
    }

    // 新建代理模式
    // 验证代理类型
    if (!AGENT_TYPES[subagent_type as keyof typeof AGENT_TYPES]) {
      return {
        success: false,
        error: `Unknown agent type: ${subagent_type}. Available types: ${Object.keys(AGENT_TYPES).join(', ')}`,
      };
    }

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
    };

    // 添加启动历史
    addAgentHistory(agent, 'started', `Agent started with type ${subagent_type}`);

    // 保存到内存和磁盘
    backgroundAgents.set(agentId, agent);
    saveAgentState(agent);

    if (run_in_background) {
      this.executeAgentInBackground(agent);

      return {
        success: true,
        output: `Agent started in background with ID: ${agentId}\nUse TaskOutput tool to check progress.`,
      };
    }

    // 同步执行
    const result = await this.executeAgentSync(agent);
    return result;
  }

  private executeAgentInBackground(agent: BackgroundAgent): void {
    // 模拟后台执行
    // 在实际实现中，这里会启动真实的子代理进程
    setTimeout(() => {
      const steps = agent.totalSteps || 5;
      let currentStep = agent.currentStep || 0;

      const executeStep = () => {
        if (currentStep >= steps) {
          agent.status = 'completed';
          agent.endTime = new Date();
          agent.currentStep = steps;
          agent.result = {
            success: true,
            output: `Agent ${agent.agentType} completed task: ${agent.description}\n\nExecuted ${steps} steps successfully.`,
          };
          addAgentHistory(agent, 'completed', `Agent completed all ${steps} steps`);
          return;
        }

        currentStep++;
        agent.currentStep = currentStep;
        agent.intermediateResults.push({
          step: currentStep,
          timestamp: new Date(),
          result: `Step ${currentStep} result`,
        });

        addAgentHistory(
          agent,
          'progress',
          `Completed step ${currentStep}/${steps}`,
          { step: currentStep }
        );

        // 继续下一步
        setTimeout(executeStep, 1000);
      };

      if (!agent.totalSteps) {
        agent.totalSteps = steps;
      }

      executeStep();
    }, 100);
  }

  private async executeAgentSync(agent: BackgroundAgent): Promise<ToolResult> {
    // 同步执行 - 在实际实现中，这里会启动子代理
    try {
      agent.currentStep = (agent.currentStep || 0) + 1;
      agent.totalSteps = agent.totalSteps || 1;

      addAgentHistory(agent, 'progress', `Executing step ${agent.currentStep}`);

      agent.status = 'completed';
      agent.endTime = new Date();
      agent.result = {
        success: true,
        output: `Agent ${agent.agentType} (${agent.model || 'default'}) executed: ${agent.description}\n\nPrompt: ${agent.prompt}\n\nNote: Full agent execution requires API integration.\n\nAgent ID: ${agent.id} (can be resumed if needed)`,
      };

      addAgentHistory(agent, 'completed', 'Agent execution completed');
      saveAgentState(agent);

      return agent.result;
    } catch (error) {
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : String(error);
      agent.endTime = new Date();

      addAgentHistory(agent, 'failed', `Agent failed: ${agent.error}`);

      return {
        success: false,
        error: `Agent execution failed: ${agent.error}`,
      };
    }
  }
}

export class TaskOutputTool extends BaseTool<{ task_id: string; block?: boolean; timeout?: number; show_history?: boolean }, ToolResult> {
  name = 'TaskOutput';
  description = `Get output and status from a background task.

Usage notes:
- Use block parameter to wait for task completion
- Use show_history to see detailed execution history
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
