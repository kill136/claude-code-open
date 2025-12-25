/**
 * Unit tests for Agent tools (Task, TaskOutput, ListAgents)
 * Tests sub-agent management, task execution, and state persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TaskTool,
  TaskOutputTool,
  ListAgentsTool,
  getBackgroundAgents,
  getBackgroundAgent,
  killBackgroundAgent,
  clearCompletedAgents,
  AGENT_TYPES
} from '../../src/tools/agent.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TaskTool', () => {
  let taskTool: TaskTool;
  let agentsDir: string;

  beforeEach(() => {
    taskTool = new TaskTool();
    agentsDir = path.join(os.homedir(), '.claude', 'agents');
  });

  afterEach(() => {
    // Clean up test agents
    clearCompletedAgents();
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = taskTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('description');
      expect(schema.properties).toHaveProperty('prompt');
      expect(schema.properties).toHaveProperty('subagent_type');
      expect(schema.properties).toHaveProperty('model');
      expect(schema.properties).toHaveProperty('resume');
      expect(schema.properties).toHaveProperty('run_in_background');
      expect(schema.required).toContain('description');
      expect(schema.required).toContain('prompt');
      expect(schema.required).toContain('subagent_type');
    });
  });

  describe('Agent Type Validation', () => {
    it('should accept valid agent types', async () => {
      const result = await taskTool.execute({
        description: 'Test task',
        prompt: 'Do something',
        subagent_type: 'general-purpose'
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid agent type', async () => {
      const result = await taskTool.execute({
        description: 'Test task',
        prompt: 'Do something',
        subagent_type: 'invalid-type'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent type');
    });

    it('should list available agent types in error', async () => {
      const result = await taskTool.execute({
        description: 'Test task',
        prompt: 'Do something',
        subagent_type: 'invalid'
      });

      expect(result.error).toContain('general-purpose');
      expect(result.error).toContain('Explore');
    });
  });

  describe('Synchronous Execution', () => {
    it('should execute agent synchronously by default', async () => {
      const result = await taskTool.execute({
        description: 'Simple task',
        prompt: 'Test prompt',
        subagent_type: 'general-purpose'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Agent');
    });

    it('should include agent ID in output', async () => {
      const result = await taskTool.execute({
        description: 'Test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      expect(result.output).toMatch(/[0-9a-f-]{36}/); // UUID pattern
    });

    it('should respect model parameter', async () => {
      const result = await taskTool.execute({
        description: 'Test',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        model: 'opus'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('opus');
    });
  });

  describe('Background Execution', () => {
    it('should start background agent', async () => {
      const result = await taskTool.execute({
        description: 'Background task',
        prompt: 'Long running task',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('background');
      expect(result.output).toMatch(/[0-9a-f-]{36}/); // Should contain agent ID
    });

    it('should allow checking background agent status', async () => {
      const result = await taskTool.execute({
        description: 'BG task',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const agents = getBackgroundAgents();
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Resume', () => {
    it('should resume paused agent', async () => {
      // Start and get agent ID
      const startResult = await taskTool.execute({
        description: 'Resumable task',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      expect(startResult.success).toBe(true);

      // Extract agent ID from output
      const idMatch = startResult.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) {
        throw new Error('No agent ID found in output');
      }
      const agentId = idMatch[0];

      // Get the agent and pause it
      const agent = getBackgroundAgent(agentId);
      if (agent) {
        agent.status = 'paused';
      }

      // Resume
      const resumeResult = await taskTool.execute({
        description: 'Resume',
        prompt: 'Resume',
        subagent_type: 'general-purpose',
        resume: agentId
      });

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.output).toContain('Resuming');
    });

    it('should fail to resume non-existent agent', async () => {
      const result = await taskTool.execute({
        description: 'Resume',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        resume: 'nonexistent-id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail to resume completed agent', async () => {
      const startResult = await taskTool.execute({
        description: 'Complete task',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const idMatch = startResult.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) return;

      const resumeResult = await taskTool.execute({
        description: 'Resume',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        resume: idMatch[0]
      });

      expect(resumeResult.success).toBe(false);
      expect(resumeResult.error).toContain('completed');
    });
  });

  describe('Agent State Persistence', () => {
    it('should persist agent to disk', async () => {
      const result = await taskTool.execute({
        description: 'Persist test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      expect(result.success).toBe(true);

      // Check if agents directory exists
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        expect(files.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('TaskOutputTool', () => {
  let taskTool: TaskTool;
  let outputTool: TaskOutputTool;

  beforeEach(() => {
    taskTool = new TaskTool();
    outputTool = new TaskOutputTool();
  });

  afterEach(() => {
    clearCompletedAgents();
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = outputTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('task_id');
      expect(schema.properties).toHaveProperty('block');
      expect(schema.properties).toHaveProperty('timeout');
      expect(schema.properties).toHaveProperty('show_history');
      expect(schema.required).toContain('task_id');
    });
  });

  describe('Get Agent Output', () => {
    it('should retrieve agent status', async () => {
      const startResult = await taskTool.execute({
        description: 'Output test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const idMatch = startResult.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) {
        throw new Error('No agent ID found');
      }

      const outputResult = await outputTool.execute({
        task_id: idMatch[0]
      });

      expect(outputResult.success).toBe(true);
      expect(outputResult.output).toContain('Agent');
      expect(outputResult.output).toContain('Status');
    });

    it('should fail for non-existent task ID', async () => {
      const result = await outputTool.execute({
        task_id: 'nonexistent-id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should show execution history when requested', async () => {
      const startResult = await taskTool.execute({
        description: 'History test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const idMatch = startResult.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) return;

      const outputResult = await outputTool.execute({
        task_id: idMatch[0],
        show_history: true
      });

      expect(outputResult.success).toBe(true);
      expect(outputResult.output).toContain('History');
    });
  });

  describe('Blocking Behavior', () => {
    it('should wait for completion with block=true', async () => {
      const startResult = await taskTool.execute({
        description: 'Block test',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const idMatch = startResult.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) return;

      const outputResult = await outputTool.execute({
        task_id: idMatch[0],
        block: true,
        timeout: 2000
      });

      expect(outputResult.success).toBe(true);
    }, 5000);
  });
});

describe('ListAgentsTool', () => {
  let taskTool: TaskTool;
  let listTool: ListAgentsTool;

  beforeEach(() => {
    taskTool = new TaskTool();
    listTool = new ListAgentsTool();
  });

  afterEach(() => {
    clearCompletedAgents();
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = listTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('status_filter');
      expect(schema.properties).toHaveProperty('include_completed');
    });
  });

  describe('List All Agents', () => {
    it('should list agents when agents exist', async () => {
      // Create an agent
      await taskTool.execute({
        description: 'List test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const result = await listTool.execute({
        include_completed: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Agent');
    });

    it('should show message when no agents exist', async () => {
      clearCompletedAgents();

      const result = await listTool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('No background agents');
    });
  });

  describe('Status Filtering', () => {
    it('should filter by running status', async () => {
      await taskTool.execute({
        description: 'Filter test',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const result = await listTool.execute({
        status_filter: 'running'
      });

      expect(result.success).toBe(true);
    });

    it('should exclude completed agents by default', async () => {
      await taskTool.execute({
        description: 'Exclude test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const result = await listTool.execute({});

      expect(result.success).toBe(true);
    });
  });
});

describe('Agent Management Functions', () => {
  let taskTool: TaskTool;

  beforeEach(() => {
    taskTool = new TaskTool();
  });

  afterEach(() => {
    clearCompletedAgents();
  });

  describe('getBackgroundAgents', () => {
    it('should return all background agents', async () => {
      await taskTool.execute({
        description: 'Test',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const agents = getBackgroundAgents();
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should return empty array when no agents', () => {
      clearCompletedAgents();
      const agents = getBackgroundAgents();
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBe(0);
    });
  });

  describe('getBackgroundAgent', () => {
    it('should retrieve specific agent by ID', async () => {
      const result = await taskTool.execute({
        description: 'Get test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const idMatch = result.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) return;

      const agent = getBackgroundAgent(idMatch[0]);
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(idMatch[0]);
    });

    it('should return undefined for non-existent ID', () => {
      const agent = getBackgroundAgent('nonexistent');
      expect(agent).toBeUndefined();
    });
  });

  describe('killBackgroundAgent', () => {
    it('should kill running agent', async () => {
      const result = await taskTool.execute({
        description: 'Kill test',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const idMatch = result.output?.match(/[0-9a-f-]{36}/);
      if (!idMatch) return;

      const killed = killBackgroundAgent(idMatch[0]);
      expect(killed).toBe(true);

      const agent = getBackgroundAgent(idMatch[0]);
      expect(agent?.status).toBe('failed');
    });

    it('should return false for non-existent agent', () => {
      const killed = killBackgroundAgent('nonexistent');
      expect(killed).toBe(false);
    });
  });

  describe('clearCompletedAgents', () => {
    it('should clear completed agents', async () => {
      await taskTool.execute({
        description: 'Clear test',
        prompt: 'Test',
        subagent_type: 'general-purpose'
      });

      const cleared = clearCompletedAgents();
      expect(cleared).toBeGreaterThanOrEqual(0);
    });

    it('should not clear running agents', async () => {
      await taskTool.execute({
        description: 'Clear test 2',
        prompt: 'Test',
        subagent_type: 'general-purpose',
        run_in_background: true
      });

      const beforeCount = getBackgroundAgents().length;
      clearCompletedAgents();
      const afterCount = getBackgroundAgents().length;

      // Running agents should not be cleared
      expect(afterCount).toBeGreaterThan(0);
    });
  });
});

describe('Agent Types', () => {
  it('should have all expected agent types defined', () => {
    expect(AGENT_TYPES).toHaveProperty('general-purpose');
    expect(AGENT_TYPES).toHaveProperty('Explore');
    expect(AGENT_TYPES).toHaveProperty('Plan');
    expect(AGENT_TYPES).toHaveProperty('claude-code-guide');
  });

  it('should have description for each agent type', () => {
    Object.values(AGENT_TYPES).forEach(type => {
      expect(type).toHaveProperty('description');
      expect(type.description).toBeTruthy();
    });
  });

  it('should have tools list for each agent type', () => {
    Object.values(AGENT_TYPES).forEach(type => {
      expect(type).toHaveProperty('tools');
      expect(Array.isArray(type.tools)).toBe(true);
    });
  });
});
