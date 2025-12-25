/**
 * Authentication Commands Unit Tests
 * Tests for login, logout, upgrade, passes, and other auth-related commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandContext, CommandResult } from '../../src/commands/types.js';
import {
  loginCommand,
  logoutCommand,
  upgradeCommand,
  passesCommand,
  extraUsageCommand,
  rateLimitOptionsCommand,
  registerAuthCommands,
} from '../../src/commands/auth.js';
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

describe('Auth Commands Registration', () => {
  beforeEach(() => {
    // Clear registry before each test
    commandRegistry.commands.clear();
  });

  it('should register all auth commands', () => {
    registerAuthCommands();

    expect(commandRegistry.get('login')).toBeDefined();
    expect(commandRegistry.get('logout')).toBeDefined();
    expect(commandRegistry.get('upgrade')).toBeDefined();
    expect(commandRegistry.get('passes')).toBeDefined();
    expect(commandRegistry.get('extra-usage')).toBeDefined();
    expect(commandRegistry.get('rate-limit-options')).toBeDefined();
  });

  it('should register command aliases', () => {
    registerAuthCommands();

    expect(commandRegistry.get('guest-passes')).toBeDefined();
    expect(commandRegistry.get('guest-passes')?.name).toBe('passes');
  });
});

describe('Login Command', () => {
  it('should have correct metadata', () => {
    expect(loginCommand.name).toBe('login');
    expect(loginCommand.category).toBe('auth');
    expect(loginCommand.description).toBeTruthy();
  });

  it('should show login options when called without args', async () => {
    const ctx = createMockContext([]);
    const result = await loginCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Login Methods'));
  });

  it('should show API key setup guide for --api-key', async () => {
    const ctx = createMockContext(['--api-key']);
    const result = await loginCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('API Key Setup'));
    expect(ctx.ui.addActivity).toHaveBeenCalledWith('Showed API key setup guide');
  });

  it.skip('should handle --oauth flag', async () => {
    // This test is skipped because OAuth requires user interaction
    // and network requests that aren't suitable for unit testing.
    // OAuth flow should be tested in integration tests instead.
    const ctx = createMockContext(['--oauth']);
    const result = await loginCommand.execute(ctx);

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(ctx.ui.addMessage).toHaveBeenCalled();
  });

  it('should handle unknown login method', async () => {
    const ctx = createMockContext(['--unknown-method']);
    const result = await loginCommand.execute(ctx);

    expect(result.success).toBe(false);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Unknown login method'));
  });

  it('should check authentication status', async () => {
    const ctx = createMockContext([]);
    await loginCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/Current Status:/);
  });
});

describe('Logout Command', () => {
  it('should have correct metadata', () => {
    expect(logoutCommand.name).toBe('logout');
    expect(logoutCommand.category).toBe('auth');
  });

  it('should show not authenticated message when not logged in', async () => {
    // Clear environment variables
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;

    const ctx = createMockContext([]);
    const result = await logoutCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addActivity).toHaveBeenCalledWith('Logging out...');

    // Restore
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it('should handle logout with API key', async () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const ctx = createMockContext([]);
    const result = await logoutCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addActivity).toHaveBeenCalled();

    // Restore
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('should provide information when called', async () => {
    const ctx = createMockContext([]);
    const result = await logoutCommand.execute(ctx);

    // Logout command should always provide some message/information
    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalled();
    expect(ctx.ui.addActivity).toHaveBeenCalledWith('Logging out...');

    // The message can be either "not authenticated" or "logout successful"
    // depending on the authentication state
    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toBeTruthy();
    expect(typeof message).toBe('string');
  });
});

describe('Upgrade Command', () => {
  it('should have correct metadata', () => {
    expect(upgradeCommand.name).toBe('upgrade');
    expect(upgradeCommand.category).toBe('auth');
  });

  it('should display upgrade information', () => {
    const ctx = createMockContext([]);
    const result = upgradeCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Upgrade Claude Subscription'));
  });

  it('should show all plan tiers', () => {
    const ctx = createMockContext([]);
    upgradeCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/Free/);
    expect(message).toMatch(/Pro/);
    expect(message).toMatch(/Max/);
    expect(message).toMatch(/Enterprise/);
  });

  it('should include API pricing information', () => {
    const ctx = createMockContext([]);
    upgradeCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/API Pricing/);
    expect(message).toMatch(/Sonnet/);
    expect(message).toMatch(/Opus/);
    expect(message).toMatch(/Haiku/);
  });
});

describe('Passes Command', () => {
  it('should have correct metadata', () => {
    expect(passesCommand.name).toBe('passes');
    expect(passesCommand.aliases).toContain('guest-passes');
    expect(passesCommand.category).toBe('auth');
  });

  it('should display guest passes information', () => {
    const ctx = createMockContext([]);
    const result = passesCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Guest Passes'));
  });

  it('should explain pass limitations for educational project', () => {
    const ctx = createMockContext([]);
    passesCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/educational project/i);
  });
});

describe('Extra Usage Command', () => {
  it('should have correct metadata', () => {
    expect(extraUsageCommand.name).toBe('extra-usage');
    expect(extraUsageCommand.category).toBe('auth');
  });

  it('should show help by default', () => {
    const ctx = createMockContext([]);
    const result = extraUsageCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Extra Usage'));
  });

  it('should handle status subcommand', () => {
    const ctx = createMockContext(['status']);
    const result = extraUsageCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Extra Usage Status'));
  });

  it('should handle enable subcommand', () => {
    const ctx = createMockContext(['enable']);
    const result = extraUsageCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Enable Extra Usage'));
  });

  it('should handle disable subcommand', () => {
    const ctx = createMockContext(['disable']);
    const result = extraUsageCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Disable Extra Usage'));
  });

  it('should handle API users differently', () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const ctx = createMockContext(['status']);
    extraUsageCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/API Key Authentication/i);

    // Restore
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

describe('Rate Limit Options Command', () => {
  it('should have correct metadata', () => {
    expect(rateLimitOptionsCommand.name).toBe('rate-limit-options');
    expect(rateLimitOptionsCommand.category).toBe('auth');
  });

  it('should display rate limit options', () => {
    const ctx = createMockContext([]);
    const result = rateLimitOptionsCommand.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.ui.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('Rate Limit Options'));
  });

  it('should show all available options', () => {
    const ctx = createMockContext([]);
    rateLimitOptionsCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/Stop and Wait/);
    expect(message).toMatch(/Switch to a Lower-Cost Model/);
    expect(message).toMatch(/Add Extra Usage/);
    expect(message).toMatch(/Upgrade Your Plan/);
    expect(message).toMatch(/Use API Keys/);
  });

  it('should show current authentication status', () => {
    const ctx = createMockContext([]);
    rateLimitOptionsCommand.execute(ctx);

    const message = (ctx.ui.addMessage as any).mock.calls[0][1];
    expect(message).toMatch(/Current Status:/);
    expect(message).toMatch(/Authentication:/);
  });
});

describe('Error Handling', () => {
  it('should handle command execution errors gracefully', async () => {
    const ctx = createMockContext([]);
    // Force an error by passing invalid context
    ctx.ui.addMessage = vi.fn(() => {
      throw new Error('UI error');
    });

    try {
      await commandRegistry.execute('login', ctx);
    } catch (error) {
      // Should not throw - registry should catch errors
      expect(error).toBeUndefined();
    }
  });

  it('should validate command parameters', async () => {
    const ctx = createMockContext(['invalid', 'params', 'that', 'dont', 'make', 'sense']);
    const result = await loginCommand.execute(ctx);

    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });
});
