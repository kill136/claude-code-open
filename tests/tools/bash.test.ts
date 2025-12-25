/**
 * Unit tests for Bash tool
 * Tests command execution, sandboxing, background processes, and security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BashTool, BashOutputTool, KillShellTool, getAuditLogs, clearAuditLogs } from '../../src/tools/bash.js';
import type { BashInput, BashResult } from '../../src/types/index.js';

describe('BashTool', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
    clearAuditLogs();
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = bashTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('command');
      expect(schema.properties).toHaveProperty('timeout');
      expect(schema.properties).toHaveProperty('run_in_background');
      expect(schema.required).toContain('command');
    });
  });

  describe('Simple Command Execution', () => {
    it('should execute simple echo command', async () => {
      const result = await bashTool.execute({ command: 'echo "Hello World"' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
    });

    it('should execute pwd command', async () => {
      const result = await bashTool.execute({ command: 'pwd' });
      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
      expect(result.exitCode).toBe(0);
    });

    it('should execute ls command', async () => {
      const result = await bashTool.execute({ command: 'ls -la' });
      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });

    it('should handle command with stderr', async () => {
      const result = await bashTool.execute({ 
        command: 'echo "error" >&2',
        dangerouslyDisableSandbox: true 
      });
      expect(result.success).toBe(true);
      expect(result.stderr || result.output).toContain('error');
    });
  });

  describe('Error Handling', () => {
    it('should fail on non-existent command', async () => {
      const result = await bashTool.execute({ 
        command: 'nonexistentcommand123456',
        dangerouslyDisableSandbox: true 
      });
      expect(result.success).toBe(false);
      expect(result.error || result.stderr).toBeTruthy();
    });

    it('should handle command timeout', async () => {
      const result = await bashTool.execute({
        command: 'sleep 10',
        timeout: 100,
        dangerouslyDisableSandbox: true
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 10000);

    it('should respect max timeout limit', async () => {
      const result = await bashTool.execute({
        command: 'echo "test"',
        timeout: 999999999, // Should be capped at MAX_TIMEOUT
        dangerouslyDisableSandbox: true
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should block dangerous rm -rf / command', async () => {
      const result = await bashTool.execute({ command: 'rm -rf /' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('security');
    });

    it('should block fork bomb', async () => {
      const result = await bashTool.execute({ command: ':(){ :|:& };:' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('security');
    });

    it('should block mkfs command', async () => {
      const result = await bashTool.execute({ command: 'mkfs.ext4 /dev/sda' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('security');
    });

    it('should warn on potentially dangerous rm -rf command', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await bashTool.execute({ 
        command: 'rm -rf /tmp/test',
        dangerouslyDisableSandbox: true 
      });
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Background Execution', () => {
    it('should start background process', async () => {
      const result = await bashTool.execute({
        command: 'sleep 1 && echo "done"',
        run_in_background: true
      });
      expect(result.success).toBe(true);
      expect(result.bash_id).toBeTruthy();
      expect(result.output).toContain('Background process started');
    });

    it('should limit number of background shells', async () => {
      const processes: BashResult[] = [];
      
      // Start max number of background processes
      for (let i = 0; i < 12; i++) {
        const result = await bashTool.execute({
          command: `sleep 10`,
          run_in_background: true
        });
        if (result.success) {
          processes.push(result);
        }
      }

      // Next one should fail
      const result = await bashTool.execute({
        command: 'sleep 10',
        run_in_background: true
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum number of background shells');
    }, 15000);
  });

  describe('Audit Logging', () => {
    it('should log successful commands', async () => {
      clearAuditLogs();
      await bashTool.execute({ command: 'echo "test"', dangerouslyDisableSandbox: true });
      
      const logs = getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].command).toBe('echo "test"');
      expect(logs[0].success).toBe(true);
    });

    it('should log failed commands', async () => {
      clearAuditLogs();
      await bashTool.execute({ command: 'rm -rf /' });
      
      const logs = getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].success).toBe(false);
    });

    it('should track command duration', async () => {
      clearAuditLogs();
      await bashTool.execute({ command: 'echo "test"', dangerouslyDisableSandbox: true });
      
      const logs = getAuditLogs();
      expect(logs[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should track output size', async () => {
      clearAuditLogs();
      await bashTool.execute({ command: 'echo "Hello World"', dangerouslyDisableSandbox: true });
      
      const logs = getAuditLogs();
      expect(logs[0].outputSize).toBeGreaterThan(0);
    });
  });

  describe('Output Truncation', () => {
    it('should truncate large outputs', async () => {
      // Generate large output
      const result = await bashTool.execute({
        command: 'for i in {1..10000}; do echo "line $i"; done',
        dangerouslyDisableSandbox: true
      });
      
      expect(result.success).toBe(true);
      if (result.output && result.output.length > 30000) {
        expect(result.output).toContain('truncated');
      }
    });
  });
});

describe('BashOutputTool', () => {
  let bashTool: BashTool;
  let outputTool: BashOutputTool;

  beforeEach(() => {
    bashTool = new BashTool();
    outputTool = new BashOutputTool();
  });

  it('should retrieve output from background shell', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "test output"',
      run_in_background: true
    });

    expect(startResult.success).toBe(true);
    expect(startResult.bash_id).toBeTruthy();

    // Wait a bit for command to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const output = await outputTool.execute({ bash_id: startResult.bash_id! });
    expect(output.success).toBe(true);
  });

  it('should handle non-existent shell ID', async () => {
    const result = await outputTool.execute({ bash_id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should support output filtering', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "line1\nline2\nline3"',
      run_in_background: true
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const output = await outputTool.execute({
      bash_id: startResult.bash_id!,
      filter: 'line2'
    });

    expect(output.success).toBe(true);
  });

  it('should handle invalid regex filter', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "test"',
      run_in_background: true
    });

    const output = await outputTool.execute({
      bash_id: startResult.bash_id!,
      filter: '[invalid'
    });

    expect(output.success).toBe(false);
    expect(output.error).toContain('Invalid regex');
  });
});

describe('KillShellTool', () => {
  let bashTool: BashTool;
  let killTool: KillShellTool;

  beforeEach(() => {
    bashTool = new BashTool();
    killTool = new KillShellTool();
  });

  it('should kill running background shell', async () => {
    const startResult = await bashTool.execute({
      command: 'sleep 100',
      run_in_background: true
    });

    expect(startResult.bash_id).toBeTruthy();

    const killResult = await killTool.execute({ shell_id: startResult.bash_id! });
    expect(killResult.success).toBe(true);
    expect(killResult.output).toContain('killed');
  });

  it('should handle non-existent shell ID', async () => {
    const result = await killTool.execute({ shell_id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
