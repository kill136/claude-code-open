/**
 * Tmux 工具
 * 多终端会话管理
 */

import { spawn, execSync } from 'child_process';
import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

interface TmuxInput {
  action: 'new' | 'send' | 'capture' | 'list' | 'kill';
  session_name?: string;
  command?: string;
  window?: number;
}

// Tmux 会话状态
interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
}

export class TmuxTool extends BaseTool<TmuxInput, ToolResult> {
  name = 'Tmux';
  description = `Manage tmux terminal sessions for running multiple commands in parallel.

Actions:
- new: Create a new tmux session
- send: Send a command to a tmux session
- capture: Capture output from a tmux session
- list: List all tmux sessions
- kill: Kill a tmux session

This is useful for:
- Running long-running processes (servers, watchers)
- Managing multiple terminal sessions
- Running commands in the background with output capture`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['new', 'send', 'capture', 'list', 'kill'],
          description: 'The action to perform',
        },
        session_name: {
          type: 'string',
          description: 'Name of the tmux session',
        },
        command: {
          type: 'string',
          description: 'Command to send (for send action)',
        },
        window: {
          type: 'number',
          description: 'Window number (optional, defaults to 0)',
        },
      },
      required: ['action'],
    };
  }

  private isTmuxAvailable(): boolean {
    try {
      execSync('which tmux', { encoding: 'utf-8' });
      return true;
    } catch {
      return false;
    }
  }

  async execute(input: TmuxInput): Promise<ToolResult> {
    const { action, session_name, command, window = 0 } = input;

    if (!this.isTmuxAvailable()) {
      return {
        success: false,
        error: 'tmux is not installed. Install it with: apt install tmux (Ubuntu) or brew install tmux (macOS)',
      };
    }

    try {
      switch (action) {
        case 'new':
          return this.createSession(session_name);

        case 'send':
          if (!session_name) {
            return { success: false, error: 'session_name is required for send action' };
          }
          if (!command) {
            return { success: false, error: 'command is required for send action' };
          }
          return this.sendCommand(session_name, command, window);

        case 'capture':
          if (!session_name) {
            return { success: false, error: 'session_name is required for capture action' };
          }
          return this.captureOutput(session_name, window);

        case 'list':
          return this.listSessions();

        case 'kill':
          if (!session_name) {
            return { success: false, error: 'session_name is required for kill action' };
          }
          return this.killSession(session_name);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      return { success: false, error: `Tmux error: ${err}` };
    }
  }

  private createSession(name?: string): ToolResult {
    const sessionName = name || `claude_${Date.now()}`;

    try {
      // 检查会话是否已存在
      try {
        execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
        return { success: false, error: `Session ${sessionName} already exists` };
      } catch {
        // 会话不存在，可以创建
      }

      // 创建新会话
      execSync(`tmux new-session -d -s ${sessionName}`, { encoding: 'utf-8' });

      return {
        success: true,
        output: `Created tmux session: ${sessionName}`,
      };
    } catch (err) {
      return { success: false, error: `Failed to create session: ${err}` };
    }
  }

  private sendCommand(sessionName: string, command: string, window: number): ToolResult {
    try {
      // 发送命令
      execSync(
        `tmux send-keys -t ${sessionName}:${window} '${command.replace(/'/g, "'\\''")}' Enter`,
        { encoding: 'utf-8' }
      );

      return {
        success: true,
        output: `Sent command to ${sessionName}:${window}`,
      };
    } catch (err) {
      return { success: false, error: `Failed to send command: ${err}` };
    }
  }

  private captureOutput(sessionName: string, window: number): ToolResult {
    try {
      const output = execSync(
        `tmux capture-pane -t ${sessionName}:${window} -p`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );

      return {
        success: true,
        output: output.trim() || '(empty)',
      };
    } catch (err) {
      return { success: false, error: `Failed to capture output: ${err}` };
    }
  }

  private listSessions(): ToolResult {
    try {
      const output = execSync('tmux list-sessions 2>/dev/null || echo "No sessions"', {
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: output.trim(),
      };
    } catch (err) {
      return { success: true, output: 'No tmux sessions running' };
    }
  }

  private killSession(sessionName: string): ToolResult {
    try {
      execSync(`tmux kill-session -t ${sessionName}`, { encoding: 'utf-8' });

      return {
        success: true,
        output: `Killed session: ${sessionName}`,
      };
    } catch (err) {
      return { success: false, error: `Failed to kill session: ${err}` };
    }
  }
}
