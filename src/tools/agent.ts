/**
 * Agent 工具 (Task)
 * 子代理管理
 */

import { BaseTool } from './base.js';
import type { AgentInput, ToolResult, ToolDefinition } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

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

// 后台代理管理
export interface BackgroundAgent {
  id: string;
  agentType: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: ToolResult;
  error?: string;
}

const backgroundAgents: Map<string, BackgroundAgent> = new Map();

// 导出代理管理函数
export function getBackgroundAgents(): BackgroundAgent[] {
  return Array.from(backgroundAgents.values());
}

export function getBackgroundAgent(id: string): BackgroundAgent | undefined {
  return backgroundAgents.get(id);
}

export function killBackgroundAgent(id: string): boolean {
  const agent = backgroundAgents.get(id);
  if (!agent) return false;

  if (agent.status === 'running') {
    agent.status = 'failed';
    agent.error = 'Killed by user';
    agent.endTime = new Date();
  }
  return true;
}

export function clearCompletedAgents(): number {
  let cleared = 0;
  for (const [id, agent] of backgroundAgents.entries()) {
    if (agent.status === 'completed' || agent.status === 'failed') {
      backgroundAgents.delete(id);
      cleared++;
    }
  }
  return cleared;
}

export class AgentTool extends BaseTool<AgentInput, ToolResult> {
  name = 'Task';
  description = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types:
- general-purpose: General-purpose agent for researching complex questions
- Explore: Fast agent for exploring codebases (quick/medium/very thorough)
- Plan: Software architect agent for designing implementation plans
- claude-code-guide: Agent for Claude Code documentation questions

Usage notes:
- Launch multiple agents concurrently for maximum performance
- Each agent invocation is stateless
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
          description: 'The type of specialized agent to use',
        },
        model: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku'],
          description: 'Optional model to use for this agent',
        },
        resume: {
          type: 'string',
          description: 'Optional agent ID to resume from',
        },
        run_in_background: {
          type: 'boolean',
          description: 'Run agent in the background',
        },
      },
      required: ['description', 'prompt', 'subagent_type'],
    };
  }

  async execute(input: AgentInput): Promise<ToolResult> {
    const { description, prompt, subagent_type, model, resume, run_in_background } = input;

    // 验证代理类型
    if (!AGENT_TYPES[subagent_type as keyof typeof AGENT_TYPES]) {
      return {
        success: false,
        error: `Unknown agent type: ${subagent_type}. Available types: ${Object.keys(AGENT_TYPES).join(', ')}`,
      };
    }

    const agentId = resume || uuidv4();

    if (run_in_background) {
      backgroundAgents.set(agentId, {
        id: agentId,
        agentType: subagent_type,
        description,
        status: 'running',
        startTime: new Date(),
      });

      // 模拟后台执行
      setTimeout(() => {
        const agent = backgroundAgents.get(agentId);
        if (agent) {
          agent.status = 'completed';
          agent.endTime = new Date();
          agent.result = {
            success: true,
            output: `Agent ${subagent_type} completed task: ${description}`,
          };
        }
      }, 1000);

      return {
        success: true,
        output: `Agent started in background with ID: ${agentId}`,
      };
    }

    // 同步执行 - 在实际实现中，这里会启动子代理
    return {
      success: true,
      output: `Agent ${subagent_type} (${model || 'default'}) executing: ${description}\n\nPrompt: ${prompt}\n\nNote: Full agent execution requires API integration.`,
    };
  }
}

export class TaskOutputTool extends BaseTool<{ task_id: string; block?: boolean; timeout?: number }, ToolResult> {
  name = 'TaskOutput';
  description = 'Get output from a background task';

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
      },
      required: ['task_id'],
    };
  }

  async execute(input: { task_id: string; block?: boolean; timeout?: number }): Promise<ToolResult> {
    const agent = backgroundAgents.get(input.task_id);
    if (!agent) {
      return { success: false, error: `Task ${input.task_id} not found` };
    }

    if (input.block && agent.status === 'running') {
      // 等待完成
      await new Promise(resolve => setTimeout(resolve, input.timeout || 5000));
    }

    if (agent.result) {
      return agent.result;
    }

    return {
      success: true,
      output: `Task ${input.task_id} status: ${agent.status}`,
    };
  }
}
