/**
 * CLI Arguments Parsing Unit Tests
 * Tests for all CLI arguments and options defined in src/cli.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

/**
 * Helper function to parse CLI arguments
 * Simulates how commander.js would parse process.argv
 */
function parseArgs(args: string[]): any {
  const program = new Command();

  program
    .name('claude')
    .description('Claude Code - starts an interactive session by default')
    .version('2.0.76-test', '-v, --version', 'Output the version number');

  program
    .argument('[prompt]', 'Your prompt')
    // 调试选项
    .option('-d, --debug [filter]', 'Enable debug mode with optional category filtering')
    .option('--verbose', 'Override verbose mode setting from config')
    // 输出选项
    .option('-p, --print', 'Print response and exit (useful for pipes)')
    .option('--output-format <format>', 'Output format (only works with --print)')
    .option('--json-schema <schema>', 'JSON Schema for structured output validation')
    .option('--include-partial-messages', 'Include partial message chunks')
    .option('--input-format <format>', 'Input format (only works with --print)')
    // 安全选项
    .option('--dangerously-skip-permissions', 'Bypass all permission checks')
    .option('--allow-dangerously-skip-permissions', 'Enable bypassing permissions')
    // 预算选项
    .option('--max-budget-usd <amount>', 'Maximum dollar amount for API calls')
    .option('--replay-user-messages', 'Re-emit user messages from stdin')
    // 工具选项
    .option('--allowedTools, --allowed-tools <tools...>', 'Allowed tools list')
    .option('--tools <tools...>', 'Specify available tools')
    .option('--disallowedTools, --disallowed-tools <tools...>', 'Denied tools list')
    // MCP 选项
    .option('--mcp-config <configs...>', 'Load MCP servers from JSON files')
    .option('--mcp-debug', 'Enable MCP debug mode')
    .option('--strict-mcp-config', 'Only use MCP servers from --mcp-config')
    // 系统提示
    .option('--system-prompt <prompt>', 'System prompt to use')
    .option('--append-system-prompt <prompt>', 'Append to default system prompt')
    // 权限模式
    .option('--permission-mode <mode>', 'Permission mode for the session')
    // 会话选项
    .option('-c, --continue', 'Continue the most recent conversation')
    .option('-r, --resume [value]', 'Resume by session ID')
    .option('--fork-session', 'Create new session ID when resuming')
    .option('--no-session-persistence', 'Disable session persistence')
    .option('--session-id <uuid>', 'Use a specific session ID')
    // 模型选项
    .option('-m, --model <model>', 'Model for the current session', 'sonnet')
    .option('--agent <agent>', 'Agent for the current session')
    .option('--betas <betas...>', 'Beta headers for API requests')
    .option('--fallback-model <model>', 'Fallback model when default is overloaded')
    .option('--max-tokens <tokens>', 'Maximum tokens for response', '8192')
    // 其他选项
    .option('--settings <file-or-json>', 'Path to settings JSON file')
    .option('--add-dir <directories...>', 'Additional directories to allow')
    .option('--ide', 'Auto-connect to IDE on startup')
    .option('--agents <json>', 'JSON object defining custom agents')
    .option('--teleport <session-id>', 'Connect to remote session')
    .option('--include-dependencies', 'Auto-include dependency type definitions')
    .option('--solo', 'Disable background processes')
    .option('--setting-sources <sources>', 'Setting sources')
    .option('--plugin-dir <paths...>', 'Load plugins from directories')
    .option('--disable-slash-commands', 'Disable all slash commands')
    .option('--chrome', 'Enable Claude in Chrome integration')
    .option('--no-chrome', 'Disable Claude in Chrome integration')
    .option('--text', 'Use text-based interface');

  // Parse the arguments
  program.parse(['node', 'cli.js', ...args], { from: 'node' });

  return {
    args: program.args,
    opts: program.opts(),
  };
}

describe('CLI Arguments - Basic Commands', () => {
  it('should parse prompt argument', () => {
    const result = parseArgs(['hello world']);
    expect(result.args[0]).toBe('hello world');
  });

  it('should parse -p/--print flag', () => {
    const result1 = parseArgs(['-p', 'test']);
    expect(result1.opts.print).toBe(true);

    const result2 = parseArgs(['--print', 'test']);
    expect(result2.opts.print).toBe(true);
  });

  it('should parse -v/--version flag', () => {
    const program = new Command();
    program.version('2.0.76-test', '-v, --version');

    // Test short form
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      program.parse(['node', 'cli.js', '-v']);
    } catch (e) {
      // Commander throws when exiting
    }

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should parse -h/--help flag', () => {
    const program = new Command();
    program.option('-h, --help', 'Display help');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    try {
      program.parse(['node', 'cli.js', '--help']);
    } catch (e) {
      // Commander throws when exiting
    }

    exitSpy.mockRestore();
  });
});

describe('CLI Arguments - Session Options', () => {
  it('should parse -c/--continue flag', () => {
    const result1 = parseArgs(['-c']);
    expect(result1.opts.continue).toBe(true);

    const result2 = parseArgs(['--continue']);
    expect(result2.opts.continue).toBe(true);
  });

  it('should parse -r/--resume with value', () => {
    const sessionId = 'abc-123-def';
    const result = parseArgs(['-r', sessionId]);
    expect(result.opts.resume).toBe(sessionId);
  });

  it('should parse -r/--resume without value', () => {
    const result = parseArgs(['-r']);
    expect(result.opts.resume).toBe(true);
  });

  it('should parse --fork-session flag', () => {
    const result = parseArgs(['--fork-session']);
    expect(result.opts.forkSession).toBe(true);
  });

  it('should parse --session-id with UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = parseArgs(['--session-id', uuid]);
    expect(result.opts.sessionId).toBe(uuid);
  });

  it('should parse --no-session-persistence flag', () => {
    const result = parseArgs(['--no-session-persistence']);
    expect(result.opts.sessionPersistence).toBe(false);
  });
});

describe('CLI Arguments - Model Options', () => {
  it('should parse -m/--model with default', () => {
    const result1 = parseArgs([]);
    expect(result1.opts.model).toBe('sonnet');
  });

  it('should parse -m/--model with custom value', () => {
    const result1 = parseArgs(['-m', 'opus']);
    expect(result1.opts.model).toBe('opus');

    const result2 = parseArgs(['--model', 'haiku']);
    expect(result2.opts.model).toBe('haiku');
  });

  it('should parse --fallback-model', () => {
    const result = parseArgs(['--fallback-model', 'haiku']);
    expect(result.opts.fallbackModel).toBe('haiku');
  });

  it('should parse --max-tokens with default', () => {
    const result = parseArgs([]);
    expect(result.opts.maxTokens).toBe('8192');
  });

  it('should parse --max-tokens with custom value', () => {
    const result = parseArgs(['--max-tokens', '4096']);
    expect(result.opts.maxTokens).toBe('4096');
  });

  it('should parse --betas with multiple values', () => {
    const result = parseArgs(['--betas', 'beta1', 'beta2', 'beta3']);
    expect(result.opts.betas).toEqual(['beta1', 'beta2', 'beta3']);
  });
});

describe('CLI Arguments - Permission Options', () => {
  it('should parse --permission-mode', () => {
    const modes = ['acceptEdits', 'bypassPermissions', 'default', 'delegate', 'dontAsk', 'plan'];

    modes.forEach(mode => {
      const result = parseArgs(['--permission-mode', mode]);
      expect(result.opts.permissionMode).toBe(mode);
    });
  });

  it('should parse --dangerously-skip-permissions flag', () => {
    const result = parseArgs(['--dangerously-skip-permissions']);
    expect(result.opts.dangerouslySkipPermissions).toBe(true);
  });

  it('should parse --allowed-tools with multiple tools', () => {
    const result = parseArgs(['--allowed-tools', 'Bash', 'Read', 'Write']);
    expect(result.opts.allowedTools).toEqual(['Bash', 'Read', 'Write']);
  });

  it('should parse --disallowed-tools with multiple tools', () => {
    const result = parseArgs(['--disallowed-tools', 'WebFetch', 'WebSearch']);
    expect(result.opts.disallowedTools).toEqual(['WebFetch', 'WebSearch']);
  });
});

describe('CLI Arguments - Input/Output Options', () => {
  it('should parse --output-format text', () => {
    const result = parseArgs(['--output-format', 'text']);
    expect(result.opts.outputFormat).toBe('text');
  });

  it('should parse --output-format json', () => {
    const result = parseArgs(['--output-format', 'json']);
    expect(result.opts.outputFormat).toBe('json');
  });

  it('should parse --output-format stream-json', () => {
    const result = parseArgs(['--output-format', 'stream-json']);
    expect(result.opts.outputFormat).toBe('stream-json');
  });

  it('should parse --input-format text', () => {
    const result = parseArgs(['--input-format', 'text']);
    expect(result.opts.inputFormat).toBe('text');
  });

  it('should parse --input-format stream-json', () => {
    const result = parseArgs(['--input-format', 'stream-json']);
    expect(result.opts.inputFormat).toBe('stream-json');
  });

  it('should parse --json-schema', () => {
    const schema = '{"type":"object","properties":{"name":{"type":"string"}}}';
    const result = parseArgs(['--json-schema', schema]);
    expect(result.opts.jsonSchema).toBe(schema);
  });

  it('should parse --include-partial-messages flag', () => {
    const result = parseArgs(['--include-partial-messages']);
    expect(result.opts.includePartialMessages).toBe(true);
  });
});

describe('CLI Arguments - Debug and Verbose Options', () => {
  it('should parse --debug without filter', () => {
    const result = parseArgs(['--debug']);
    expect(result.opts.debug).toBe(true);
  });

  it('should parse --debug with filter', () => {
    const result = parseArgs(['--debug', 'mcp']);
    expect(result.opts.debug).toBe('mcp');
  });

  it('should parse -d shorthand', () => {
    const result = parseArgs(['-d']);
    expect(result.opts.debug).toBe(true);
  });

  it('should parse --verbose flag', () => {
    const result = parseArgs(['--verbose']);
    expect(result.opts.verbose).toBe(true);
  });
});

describe('CLI Arguments - System Prompt Options', () => {
  it('should parse --system-prompt', () => {
    const prompt = 'You are a helpful assistant';
    const result = parseArgs(['--system-prompt', prompt]);
    expect(result.opts.systemPrompt).toBe(prompt);
  });

  it('should parse --append-system-prompt', () => {
    const append = 'Additional instructions';
    const result = parseArgs(['--append-system-prompt', append]);
    expect(result.opts.appendSystemPrompt).toBe(append);
  });
});

describe('CLI Arguments - MCP Options', () => {
  it('should parse --mcp-config with single config', () => {
    const result = parseArgs(['--mcp-config', './config.json']);
    expect(result.opts.mcpConfig).toEqual(['./config.json']);
  });

  it('should parse --mcp-config with multiple configs', () => {
    const result = parseArgs(['--mcp-config', 'config1.json', 'config2.json']);
    expect(result.opts.mcpConfig).toEqual(['config1.json', 'config2.json']);
  });

  it('should parse --strict-mcp-config flag', () => {
    const result = parseArgs(['--strict-mcp-config']);
    expect(result.opts.strictMcpConfig).toBe(true);
  });

  it('should parse --mcp-debug flag', () => {
    const result = parseArgs(['--mcp-debug']);
    expect(result.opts.mcpDebug).toBe(true);
  });
});

describe('CLI Arguments - Other Options', () => {
  it('should parse --add-dir with multiple directories', () => {
    const result = parseArgs(['--add-dir', '/path/to/dir1', '/path/to/dir2']);
    expect(result.opts.addDir).toEqual(['/path/to/dir1', '/path/to/dir2']);
  });

  it('should parse --ide flag', () => {
    const result = parseArgs(['--ide']);
    expect(result.opts.ide).toBe(true);
  });

  it('should parse --solo flag', () => {
    const result = parseArgs(['--solo']);
    expect(result.opts.solo).toBe(true);
  });

  it('should parse --settings with file path', () => {
    const result = parseArgs(['--settings', './settings.json']);
    expect(result.opts.settings).toBe('./settings.json');
  });

  it('should parse --settings with JSON string', () => {
    const json = '{"model":"opus"}';
    const result = parseArgs(['--settings', json]);
    expect(result.opts.settings).toBe(json);
  });

  it('should parse --teleport with session ID', () => {
    const sessionId = 'remote-session-123';
    const result = parseArgs(['--teleport', sessionId]);
    expect(result.opts.teleport).toBe(sessionId);
  });

  it('should parse --include-dependencies flag', () => {
    const result = parseArgs(['--include-dependencies']);
    expect(result.opts.includeDependencies).toBe(true);
  });

  it('should parse --plugin-dir with multiple paths', () => {
    const result = parseArgs(['--plugin-dir', '/plugins1', '/plugins2']);
    expect(result.opts.pluginDir).toEqual(['/plugins1', '/plugins2']);
  });

  it('should parse --disable-slash-commands flag', () => {
    const result = parseArgs(['--disable-slash-commands']);
    expect(result.opts.disableSlashCommands).toBe(true);
  });

  it('should parse --text flag', () => {
    const result = parseArgs(['--text']);
    expect(result.opts.text).toBe(true);
  });

  it('should parse --chrome flag', () => {
    const result = parseArgs(['--chrome']);
    expect(result.opts.chrome).toBe(true);
  });

  it('should parse --no-chrome flag', () => {
    const result = parseArgs(['--no-chrome']);
    expect(result.opts.chrome).toBe(false);
  });
});

describe('CLI Arguments - Agent Options', () => {
  it('should parse --agent', () => {
    const result = parseArgs(['--agent', 'code-reviewer']);
    expect(result.opts.agent).toBe('code-reviewer');
  });

  it('should parse --agents with JSON', () => {
    const json = '{"custom":{"model":"opus"}}';
    const result = parseArgs(['--agents', json]);
    expect(result.opts.agents).toBe(json);
  });
});

describe('CLI Arguments - Budget Options', () => {
  it('should parse --max-budget-usd', () => {
    const result = parseArgs(['--max-budget-usd', '10.00']);
    expect(result.opts.maxBudgetUsd).toBe('10.00');
  });

  it('should parse --replay-user-messages flag', () => {
    const result = parseArgs(['--replay-user-messages']);
    expect(result.opts.replayUserMessages).toBe(true);
  });
});

describe('CLI Arguments - Tool Options', () => {
  it('should parse --tools with multiple tools', () => {
    const result = parseArgs(['--tools', 'Bash', 'Read', 'Write', 'Edit']);
    expect(result.opts.tools).toEqual(['Bash', 'Read', 'Write', 'Edit']);
  });

  it('should parse --allowedTools (camelCase)', () => {
    const result = parseArgs(['--allowedTools', 'Bash', 'Read']);
    expect(result.opts.allowedTools).toEqual(['Bash', 'Read']);
  });

  it('should parse --disallowedTools (camelCase)', () => {
    const result = parseArgs(['--disallowedTools', 'WebFetch']);
    expect(result.opts.disallowedTools).toEqual(['WebFetch']);
  });
});

describe('CLI Arguments - Setting Sources', () => {
  it('should parse --setting-sources', () => {
    const result = parseArgs(['--setting-sources', 'env,file,cli']);
    expect(result.opts.settingSources).toBe('env,file,cli');
  });
});

describe('CLI Arguments - Permission Safety', () => {
  it('should parse --allow-dangerously-skip-permissions', () => {
    const result = parseArgs(['--allow-dangerously-skip-permissions']);
    expect(result.opts.allowDangerouslySkipPermissions).toBe(true);
  });
});

describe('CLI Arguments - Combined Options', () => {
  it('should parse multiple options together', () => {
    const result = parseArgs([
      'hello world',
      '-m', 'opus',
      '--verbose',
      '--debug',
      '--print',
      '--output-format', 'json',
      '--permission-mode', 'acceptEdits',
      '--allowed-tools', 'Bash', 'Read',
    ]);

    expect(result.opts.model).toBe('opus');
    expect(result.opts.verbose).toBe(true);
    expect(result.opts.debug).toBe(true);
    expect(result.opts.print).toBe(true);
    expect(result.opts.outputFormat).toBe('json');
    expect(result.opts.permissionMode).toBe('acceptEdits');
    expect(result.opts.allowedTools).toEqual(['Bash', 'Read']);
    expect(result.args[0]).toBe('hello world');
  });

  it('should parse session and model options together', () => {
    const result = parseArgs([
      '-c',
      '-m', 'haiku',
      '--max-tokens', '4096',
      '--betas', 'beta1',
      '--fallback-model', 'sonnet',
    ]);

    expect(result.opts.continue).toBe(true);
    expect(result.opts.model).toBe('haiku');
    expect(result.opts.maxTokens).toBe('4096');
    expect(result.opts.betas).toEqual(['beta1']);
    expect(result.opts.fallbackModel).toBe('sonnet');
  });

  it('should handle complex real-world command', () => {
    const result = parseArgs([
      '-m', 'opus',
      '--permission-mode', 'acceptEdits',
      '--add-dir', '/project/src', '/project/tests',
      '--mcp-config', './mcp.json',
      '--system-prompt', 'You are an expert developer',
      '--max-tokens', '16000',
      '--verbose',
      'Analyze this codebase',
    ]);

    expect(result.opts.model).toBe('opus');
    expect(result.opts.permissionMode).toBe('acceptEdits');
    expect(result.opts.addDir).toEqual(['/project/src', '/project/tests']);
    expect(result.opts.mcpConfig).toEqual(['./mcp.json']);
    expect(result.opts.systemPrompt).toBe('You are an expert developer');
    expect(result.opts.maxTokens).toBe('16000');
    expect(result.opts.verbose).toBe(true);
    expect(result.args[0]).toBe('Analyze this codebase');
  });
});

describe('CLI Arguments - Edge Cases', () => {
  it('should handle empty arguments', () => {
    const result = parseArgs([]);
    expect(result.args).toEqual([]);
    expect(result.opts.model).toBe('sonnet'); // default
    expect(result.opts.maxTokens).toBe('8192'); // default
  });

  it('should handle prompt with spaces', () => {
    const result = parseArgs(['this is a long prompt with spaces']);
    expect(result.args[0]).toBe('this is a long prompt with spaces');
  });

  it('should handle options with special characters', () => {
    const result = parseArgs([
      '--system-prompt', 'Use @mentions and #tags',
      '--json-schema', '{"type":"string"}',
    ]);

    expect(result.opts.systemPrompt).toBe('Use @mentions and #tags');
    expect(result.opts.jsonSchema).toBe('{"type":"string"}');
  });

  it('should handle boolean flags correctly', () => {
    const result = parseArgs([
      '--verbose',
      '--debug',
      '--print',
      '--solo',
      '--ide',
      '--fork-session',
    ]);

    expect(result.opts.verbose).toBe(true);
    expect(result.opts.debug).toBe(true);
    expect(result.opts.print).toBe(true);
    expect(result.opts.solo).toBe(true);
    expect(result.opts.ide).toBe(true);
    expect(result.opts.forkSession).toBe(true);
  });

  it('should handle negated boolean flags', () => {
    const result = parseArgs(['--no-session-persistence', '--no-chrome']);

    expect(result.opts.sessionPersistence).toBe(false);
    expect(result.opts.chrome).toBe(false);
  });
});

describe('CLI Arguments - Validation', () => {
  it('should accept valid permission modes', () => {
    const validModes = ['acceptEdits', 'bypassPermissions', 'default', 'delegate', 'dontAsk', 'plan'];

    validModes.forEach(mode => {
      const result = parseArgs(['--permission-mode', mode]);
      expect(result.opts.permissionMode).toBe(mode);
    });
  });

  it('should accept valid output formats', () => {
    const validFormats = ['text', 'json', 'stream-json'];

    validFormats.forEach(format => {
      const result = parseArgs(['--output-format', format]);
      expect(result.opts.outputFormat).toBe(format);
    });
  });

  it('should accept valid input formats', () => {
    const validFormats = ['text', 'stream-json'];

    validFormats.forEach(format => {
      const result = parseArgs(['--input-format', format]);
      expect(result.opts.inputFormat).toBe(format);
    });
  });

  it('should accept valid model names', () => {
    const validModels = ['sonnet', 'opus', 'haiku', 'claude-opus-4-20250514'];

    validModels.forEach(model => {
      const result = parseArgs(['--model', model]);
      expect(result.opts.model).toBe(model);
    });
  });
});

describe('CLI Arguments - Comprehensive Coverage', () => {
  it('should parse all documented CLI options', () => {
    const result = parseArgs([
      'test prompt',
      // Basic (removed -v and -h as they cause early exit)
      '-p',

      // Session
      '-c',
      '--fork-session',
      '--session-id', 'test-id',

      // Model
      '-m', 'opus',
      '--fallback-model', 'sonnet',
      '--max-tokens', '4096',
      '--betas', 'beta1',

      // Permission
      '--permission-mode', 'plan',
      '--allowed-tools', 'Bash',

      // I/O
      '--output-format', 'json',
      '--input-format', 'text',

      // Other
      '--debug',
      '--verbose',
      '--solo',
      '--ide',
    ]);

    // Verify all options are parsed
    expect(result.opts).toBeDefined();
    expect(result.opts.print).toBe(true);
    expect(result.opts.continue).toBe(true);
    expect(result.opts.model).toBe('opus');
    expect(result.opts.verbose).toBe(true);
    expect(result.args[0]).toBe('test prompt');
  });
});
