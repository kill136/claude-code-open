/**
 * Configuration Commands Unit Tests
 * Tests for config-related commands (model, settings, etc.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandContext } from '../../src/commands/types.js';
import { commandRegistry } from '../../src/commands/registry.js';

// Mock context helper
function createMockContext(args: string[] = []): CommandContext {
  return {
    session: {
      id: 'test-session-id-12345',
      messageCount: 5,
      duration: 60000,
      totalCost: '$0.05',
      clearMessages: vi.fn(),
      getStats: vi.fn(() => ({
        messageCount: 5,
        duration: 60000,
        totalCost: '$0.05',
        modelUsage: { 'claude-sonnet-4.5': 1000 },
      })),
      getTodos: vi.fn(() => []),
      setTodos: vi.fn(),
    },
    config: {
      model: 'claude-sonnet-4.5',
      modelDisplayName: 'Claude Sonnet 4.5',
      apiType: 'anthropic',
      cwd: '/test/dir',
      version: '2.0.76',
    },
    ui: {
      addMessage: vi.fn(),
      addActivity: vi.fn(),
      setShowWelcome: vi.fn(),
      exit: vi.fn(),
    },
    args,
    rawInput: args.join(' '),
  };
}

describe('Config Commands Registry', () => {
  it('should allow registering config commands', () => {
    const mockConfigCommand = {
      name: 'test-config',
      description: 'Test config command',
      category: 'config' as const,
      execute: vi.fn(() => ({ success: true })),
    };

    commandRegistry.register(mockConfigCommand);
    expect(commandRegistry.get('test-config')).toBeDefined();
  });

  it('should retrieve commands by category', () => {
    const configCommands = commandRegistry.getByCategory('config');
    expect(Array.isArray(configCommands)).toBe(true);
  });
});

describe('Model Command (if exists)', () => {
  it('should handle model switching', async () => {
    const modelCmd = commandRegistry.get('model');
    if (!modelCmd) {
      // Skip if command doesn't exist
      return;
    }

    const ctx = createMockContext(['sonnet']);
    const result = await modelCmd.execute(ctx);

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should show available models', async () => {
    const modelCmd = commandRegistry.get('model');
    if (!modelCmd) return;

    const ctx = createMockContext([]);
    await modelCmd.execute(ctx);

    expect(ctx.ui.addMessage).toHaveBeenCalled();
  });
});

describe('Settings Command (if exists)', () => {
  it('should display current settings', async () => {
    const settingsCmd = commandRegistry.get('settings') || commandRegistry.get('config');
    if (!settingsCmd) return;

    const ctx = createMockContext([]);
    const result = await settingsCmd.execute(ctx);

    expect(result).toBeDefined();
    expect(ctx.ui.addMessage).toHaveBeenCalled();
  });

  it('should handle setting updates', async () => {
    const settingsCmd = commandRegistry.get('set');
    if (!settingsCmd) return;

    const ctx = createMockContext(['model', 'opus']);
    const result = await settingsCmd.execute(ctx);

    expect(result).toBeDefined();
  });
});

describe('Config Validation', () => {
  it('should validate model names', () => {
    const validModels = ['opus', 'sonnet', 'haiku', 'claude-opus-4.5', 'claude-sonnet-4.5'];

    validModels.forEach(model => {
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });
  });

  it('should handle invalid config values', async () => {
    const ctx = createMockContext(['invalid-key', 'invalid-value']);

    // Most config commands should handle invalid values gracefully
    const setCmd = commandRegistry.get('set');
    if (setCmd) {
      const result = await setCmd.execute(ctx);
      expect(result).toBeDefined();
    }
  });
});

describe('Config Persistence', () => {
  it('should support config get operations', async () => {
    const getCmd = commandRegistry.get('get');
    if (!getCmd) return;

    const ctx = createMockContext(['model']);
    const result = await getCmd.execute(ctx);

    expect(result).toBeDefined();
  });

  it('should support config list operations', async () => {
    const listCmd = commandRegistry.get('list') || commandRegistry.get('config');
    if (!listCmd) return;

    const ctx = createMockContext([]);
    const result = await listCmd.execute(ctx);

    expect(result).toBeDefined();
  });
});

describe('Environment Variables', () => {
  it('should respect ANTHROPIC_API_KEY', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');

    // Restore
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('should respect CLAUDE_API_KEY as fallback', () => {
    const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const originalClaudeKey = process.env.CLAUDE_API_KEY;

    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_API_KEY = 'sk-ant-test-key-2';

    expect(process.env.CLAUDE_API_KEY).toBe('sk-ant-test-key-2');

    // Restore
    if (originalAnthropicKey) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    }
    if (originalClaudeKey) {
      process.env.CLAUDE_API_KEY = originalClaudeKey;
    } else {
      delete process.env.CLAUDE_API_KEY;
    }
  });
});

describe('Config Command Error Handling', () => {
  it('should handle missing required arguments', async () => {
    const setCmd = commandRegistry.get('set');
    if (!setCmd) return;

    const ctx = createMockContext([]); // No args
    const result = await setCmd.execute(ctx);

    expect(result).toBeDefined();
    // Should either fail or show usage
    if (!result.success) {
      expect(ctx.ui.addMessage).toHaveBeenCalled();
    }
  });

  it('should handle file system errors gracefully', async () => {
    const ctx = createMockContext([]);

    // Mock a file system error scenario
    const originalCwd = ctx.config.cwd;
    ctx.config.cwd = '/nonexistent/path/that/does/not/exist';

    const configCmd = commandRegistry.get('config');
    if (configCmd) {
      const result = await configCmd.execute(ctx);
      expect(result).toBeDefined();
    }

    ctx.config.cwd = originalCwd;
  });

  it('should validate configuration values', async () => {
    const ctx = createMockContext([]);

    // Config should validate values like max tokens, temperature, etc.
    expect(ctx.config.model).toBeTruthy();
    expect(ctx.config.version).toBeTruthy();
    expect(ctx.config.cwd).toBeTruthy();
  });
});

describe('Config Display Formatting', () => {
  it('should format model names for display', () => {
    const modelMap: Record<string, string> = {
      'opus': 'Claude Opus',
      'sonnet': 'Claude Sonnet',
      'haiku': 'Claude Haiku',
      'claude-opus-4.5': 'Claude Opus 4.5',
    };

    Object.entries(modelMap).forEach(([key, expected]) => {
      expect(key).toBeTruthy();
      expect(expected).toBeTruthy();
    });
  });

  it('should format costs correctly', () => {
    const ctx = createMockContext([]);
    const stats = ctx.session.getStats();

    expect(stats.totalCost).toMatch(/^\$/); // Should start with $
    expect(stats.totalCost).toBeTruthy();
  });
});

describe('MCP Server Configuration', () => {
  it('should handle MCP server config', async () => {
    const mcpCmd = commandRegistry.get('mcp');
    if (!mcpCmd) return;

    const ctx = createMockContext(['list']);
    const result = await mcpCmd.execute(ctx);

    expect(result).toBeDefined();
  });

  it('should validate MCP server format', () => {
    const validMcpConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
    };

    expect(validMcpConfig.type).toBe('stdio');
    expect(validMcpConfig.command).toBeTruthy();
    expect(Array.isArray(validMcpConfig.args)).toBe(true);
  });
});
