/**
 * Tmux 工具
 * 多终端会话管理
 */

import { spawn, execSync } from 'child_process';
import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

interface TmuxInput {
  action:
    | 'new'
    | 'send'
    | 'capture'
    | 'list'
    | 'kill'
    | 'new-window'
    | 'split-pane'
    | 'select-window'
    | 'select-pane'
    | 'list-windows'
    | 'list-panes'
    | 'send-keys'
    | 'has-session'
    | 'session-info';
  session_name?: string;
  command?: string;
  window?: number;
  pane?: number;
  keys?: string;
  direction?: 'horizontal' | 'vertical';
  lines?: number;
  window_name?: string;
}

// Tmux 会话状态
interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
}

// Tmux 窗口信息
interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

// Tmux 面板信息
interface TmuxPane {
  index: number;
  active: boolean;
  width: number;
  height: number;
}

export class TmuxTool extends BaseTool<TmuxInput, ToolResult> {
  name = 'Tmux';
  description = `Manage tmux terminal sessions for running multiple commands in parallel.

Session Actions:
- new: Create a new tmux session
- send: Send a command to a tmux session (deprecated, use send-keys)
- capture: Capture output from a tmux session
- list: List all tmux sessions
- kill: Kill a tmux session
- has-session: Check if a session exists
- session-info: Get detailed session information

Window Actions:
- new-window: Create a new window in a session
- select-window: Switch to a specific window
- list-windows: List all windows in a session

Pane Actions:
- split-pane: Split a pane horizontally or vertically
- select-pane: Switch to a specific pane
- list-panes: List all panes in a window

Advanced:
- send-keys: Send key sequences to a session (supports special keys)

This is useful for:
- Running long-running processes (servers, watchers)
- Managing multiple terminal sessions
- Running commands in the background with output capture
- Organizing work across multiple windows and panes

Note: Tmux is only available on Linux and macOS. Windows users need WSL.`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'new',
            'send',
            'capture',
            'list',
            'kill',
            'new-window',
            'split-pane',
            'select-window',
            'select-pane',
            'list-windows',
            'list-panes',
            'send-keys',
            'has-session',
            'session-info',
          ],
          description: 'The action to perform',
        },
        session_name: {
          type: 'string',
          description: 'Name of the tmux session',
        },
        command: {
          type: 'string',
          description: 'Command to send (for send action, deprecated)',
        },
        window: {
          type: 'number',
          description: 'Window number (optional, defaults to 0)',
        },
        pane: {
          type: 'number',
          description: 'Pane number (optional)',
        },
        keys: {
          type: 'string',
          description:
            'Key sequence to send (for send-keys action). Supports special keys like Enter, C-c, etc.',
        },
        direction: {
          type: 'string',
          enum: ['horizontal', 'vertical'],
          description: 'Split direction for split-pane action',
        },
        lines: {
          type: 'number',
          description: 'Number of lines to capture (for capture action, optional)',
        },
        window_name: {
          type: 'string',
          description: 'Name for the new window (for new-window action)',
        },
      },
      required: ['action'],
    };
  }

  private isTmuxAvailable(): boolean {
    // Check if running on Windows (tmux not supported natively)
    if (process.platform === 'win32') {
      return false;
    }

    try {
      execSync('which tmux 2>/dev/null || command -v tmux', { encoding: 'utf-8' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate session name to prevent command injection
   */
  private validateSessionName(name: string): boolean {
    // Session names should only contain alphanumeric, underscore, hyphen, and dot
    return /^[a-zA-Z0-9_.-]+$/.test(name);
  }

  /**
   * Check if a session exists
   */
  private sessionExists(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t "${this.escapeSessionName(sessionName)}" 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escape session name for safe command execution
   */
  private escapeSessionName(name: string): string {
    // Replace single quotes with escaped version
    return name.replace(/'/g, "'\\''");
  }

  /**
   * Get target string for tmux commands
   */
  private getTarget(sessionName: string, window?: number, pane?: number): string {
    let target = this.escapeSessionName(sessionName);
    if (window !== undefined) {
      target += `:${window}`;
      if (pane !== undefined) {
        target += `.${pane}`;
      }
    }
    return target;
  }

  async execute(input: TmuxInput): Promise<ToolResult> {
    const {
      action,
      session_name,
      command,
      window = 0,
      pane,
      keys,
      direction,
      lines,
      window_name,
    } = input;

    // Check platform compatibility
    if (process.platform === 'win32') {
      return {
        success: false,
        error:
          'tmux is not available on Windows. Please use WSL (Windows Subsystem for Linux) to run tmux.',
      };
    }

    if (!this.isTmuxAvailable()) {
      return {
        success: false,
        error:
          'tmux is not installed. Install it with:\n' +
          '  - Ubuntu/Debian: sudo apt install tmux\n' +
          '  - macOS: brew install tmux\n' +
          '  - Fedora: sudo dnf install tmux\n' +
          '  - Arch: sudo pacman -S tmux',
      };
    }

    // Validate session name if provided
    if (session_name && !this.validateSessionName(session_name)) {
      return {
        success: false,
        error: `Invalid session name "${session_name}". Session names can only contain letters, numbers, underscore, hyphen, and dot.`,
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
          return this.captureOutput(session_name, window, lines);

        case 'list':
          return this.listSessions();

        case 'kill':
          if (!session_name) {
            return { success: false, error: 'session_name is required for kill action' };
          }
          return this.killSession(session_name);

        case 'new-window':
          if (!session_name) {
            return { success: false, error: 'session_name is required for new-window action' };
          }
          return this.createWindow(session_name, window_name);

        case 'split-pane':
          if (!session_name) {
            return { success: false, error: 'session_name is required for split-pane action' };
          }
          return this.splitPane(session_name, window, direction || 'vertical');

        case 'select-window':
          if (!session_name) {
            return { success: false, error: 'session_name is required for select-window action' };
          }
          if (window === undefined) {
            return { success: false, error: 'window is required for select-window action' };
          }
          return this.selectWindow(session_name, window);

        case 'select-pane':
          if (!session_name) {
            return { success: false, error: 'session_name is required for select-pane action' };
          }
          if (pane === undefined) {
            return { success: false, error: 'pane is required for select-pane action' };
          }
          return this.selectPane(session_name, window, pane);

        case 'list-windows':
          if (!session_name) {
            return { success: false, error: 'session_name is required for list-windows action' };
          }
          return this.listWindows(session_name);

        case 'list-panes':
          if (!session_name) {
            return { success: false, error: 'session_name is required for list-panes action' };
          }
          return this.listPanes(session_name, window);

        case 'send-keys':
          if (!session_name) {
            return { success: false, error: 'session_name is required for send-keys action' };
          }
          if (!keys) {
            return { success: false, error: 'keys is required for send-keys action' };
          }
          return this.sendKeys(session_name, keys, window, pane);

        case 'has-session':
          if (!session_name) {
            return { success: false, error: 'session_name is required for has-session action' };
          }
          return this.hasSession(session_name);

        case 'session-info':
          if (!session_name) {
            return { success: false, error: 'session_name is required for session-info action' };
          }
          return this.getSessionInfo(session_name);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Tmux error: ${errorMessage}` };
    }
  }

  private createSession(name?: string): ToolResult {
    const sessionName = name || `claude_${Date.now()}`;

    try {
      // 检查会话是否已存在
      if (this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" already exists` };
      }

      // 创建新会话
      execSync(`tmux new-session -d -s "${this.escapeSessionName(sessionName)}"`, {
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: `Created tmux session: ${sessionName}\n\nUse the following commands to interact:\n- send-keys: Send commands to the session\n- capture: View session output\n- list-windows: List windows in the session\n- kill: Terminate the session`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to create session: ${errorMessage}` };
    }
  }

  private sendCommand(sessionName: string, command: string, window: number): ToolResult {
    try {
      // Check if session exists
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window);

      // 发送命令（deprecated, use sendKeys instead）
      execSync(`tmux send-keys -t "${target}" '${command.replace(/'/g, "'\\''")}' Enter`, {
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: `Sent command to ${sessionName}:${window}\n\nNote: This action is deprecated. Use send-keys instead for more control.`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to send command: ${errorMessage}` };
    }
  }

  private captureOutput(sessionName: string, window: number, lines?: number): ToolResult {
    try {
      // Check if session exists
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window);
      const linesArg = lines ? `-S -${lines}` : '';

      const output = execSync(`tmux capture-pane -t "${target}" ${linesArg} -p`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        success: true,
        output: output.trim() || '(empty)',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to capture output: ${errorMessage}` };
    }
  }

  private listSessions(): ToolResult {
    try {
      const output = execSync('tmux list-sessions -F "#{session_name}: #{session_windows} windows, created #{session_created}, #{?session_attached,attached,detached}" 2>/dev/null', {
        encoding: 'utf-8',
      });

      if (!output.trim()) {
        return {
          success: true,
          output: 'No tmux sessions running',
        };
      }

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
      // Check if session exists
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      execSync(`tmux kill-session -t "${this.escapeSessionName(sessionName)}"`, {
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: `Killed session: ${sessionName}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to kill session: ${errorMessage}` };
    }
  }

  /**
   * Create a new window in a session
   */
  private createWindow(sessionName: string, windowName?: string): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const nameArg = windowName ? `-n "${windowName}"` : '';
      const output = execSync(
        `tmux new-window -t "${this.escapeSessionName(sessionName)}" ${nameArg} -P -F "#{window_index}"`,
        { encoding: 'utf-8' }
      );

      const windowIndex = output.trim();
      const name = windowName || `window ${windowIndex}`;

      return {
        success: true,
        output: `Created new window in session "${sessionName}": ${name} (index: ${windowIndex})`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to create window: ${errorMessage}` };
    }
  }

  /**
   * Split a pane horizontally or vertically
   */
  private splitPane(
    sessionName: string,
    window: number,
    direction: 'horizontal' | 'vertical'
  ): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window);
      const flag = direction === 'horizontal' ? '-h' : '-v';

      execSync(`tmux split-window ${flag} -t "${target}"`, { encoding: 'utf-8' });

      return {
        success: true,
        output: `Split pane ${direction}ly in ${sessionName}:${window}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to split pane: ${errorMessage}` };
    }
  }

  /**
   * Select (switch to) a window
   */
  private selectWindow(sessionName: string, window: number): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      execSync(`tmux select-window -t "${this.escapeSessionName(sessionName)}:${window}"`, {
        encoding: 'utf-8',
      });

      return {
        success: true,
        output: `Selected window ${window} in session "${sessionName}"`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to select window: ${errorMessage}` };
    }
  }

  /**
   * Select (switch to) a pane
   */
  private selectPane(sessionName: string, window: number, pane: number): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window, pane);

      execSync(`tmux select-pane -t "${target}"`, { encoding: 'utf-8' });

      return {
        success: true,
        output: `Selected pane ${pane} in ${sessionName}:${window}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to select pane: ${errorMessage}` };
    }
  }

  /**
   * List all windows in a session
   */
  private listWindows(sessionName: string): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const output = execSync(
        `tmux list-windows -t "${this.escapeSessionName(sessionName)}" -F "#{window_index}: #{window_name} (#{window_panes} panes)#{?window_active, [active],}"`,
        { encoding: 'utf-8' }
      );

      return {
        success: true,
        output: output.trim() || 'No windows',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to list windows: ${errorMessage}` };
    }
  }

  /**
   * List all panes in a window
   */
  private listPanes(sessionName: string, window: number): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window);

      const output = execSync(
        `tmux list-panes -t "${target}" -F "#{pane_index}: #{pane_width}x#{pane_height}#{?pane_active, [active],}"`,
        { encoding: 'utf-8' }
      );

      return {
        success: true,
        output: output.trim() || 'No panes',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to list panes: ${errorMessage}` };
    }
  }

  /**
   * Send key sequences to a session (supports special keys)
   */
  private sendKeys(
    sessionName: string,
    keys: string,
    window?: number,
    pane?: number
  ): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const target = this.getTarget(sessionName, window, pane);

      // Escape keys for shell
      const escapedKeys = keys.replace(/'/g, "'\\''");

      execSync(`tmux send-keys -t "${target}" '${escapedKeys}'`, { encoding: 'utf-8' });

      return {
        success: true,
        output: `Sent keys to ${target}\n\nSpecial keys you can use:\n- Enter: Press Enter\n- C-c: Ctrl+C\n- C-d: Ctrl+D\n- Space: Space bar\n- BSpace: Backspace\n- Tab: Tab key`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to send keys: ${errorMessage}` };
    }
  }

  /**
   * Check if a session exists
   */
  private hasSession(sessionName: string): ToolResult {
    const exists = this.sessionExists(sessionName);
    return {
      success: true,
      output: exists
        ? `Session "${sessionName}" exists`
        : `Session "${sessionName}" does not exist`,
    };
  }

  /**
   * Get detailed session information
   */
  private getSessionInfo(sessionName: string): ToolResult {
    try {
      if (!this.sessionExists(sessionName)) {
        return { success: false, error: `Session "${sessionName}" does not exist` };
      }

      const output = execSync(
        `tmux display-message -t "${this.escapeSessionName(sessionName)}" -p "Session: #{session_name}\nWindows: #{session_windows}\nCreated: #{session_created_string}\nAttached: #{session_attached}\nLast attached: #{session_activity_string}\nDimensions: #{session_width}x#{session_height}"`,
        { encoding: 'utf-8' }
      );

      return {
        success: true,
        output: output.trim(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to get session info: ${errorMessage}` };
    }
  }
}
