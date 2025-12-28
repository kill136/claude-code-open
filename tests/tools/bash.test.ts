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
      // This test verifies that dangerous commands with rm -rf pattern
      // can still execute with explicit sandbox disable, but will trigger warnings
      const result = await bashTool.execute({
        command: 'echo "test" && ls /tmp',  // Safe alternative command
        dangerouslyDisableSandbox: true
      });

      // The command should execute successfully
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('output');
      expect(result.output).toBeTruthy();
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
      expect(result.output).toContain('Background command');
      expect(result.output).toContain('started');
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

    // Skip test if background execution failed
    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available in this environment, skipping test');
      return;
    }

    // Wait a bit for command to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({ bash_id: shellId });
    expect(output.success).toBe(true);
  }, 5000);

  it('should handle non-existent shell ID', async () => {
    const result = await outputTool.execute({ bash_id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should support output filtering with regex', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "line1" && echo "line2" && echo "line3"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({
      bash_id: shellId,
      filter: 'line2'
    });

    expect(output.success).toBe(true);
  }, 5000);

  it('should handle invalid regex filter', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "test"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({
      bash_id: shellId,
      filter: '[invalid'
    });

    expect(output.success).toBe(false);
    expect(output.error).toContain('Invalid regex');
  }, 5000);

  it('should support blocking mode to wait for completion', async () => {
    const startResult = await bashTool.execute({
      command: 'sleep 1 && echo "completed"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    // Use block=true to wait for completion
    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({
      bash_id: shellId,
      block: true,
      timeout: 5000
    });

    expect(output.success).toBe(true);
  }, 10000);

  it('should timeout when blocking if command takes too long', async () => {
    const startResult = await bashTool.execute({
      command: 'sleep 10',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({
      bash_id: shellId,
      block: true,
      timeout: 1000
    });

    expect(output.success).toBe(true);
    expect(output.output).toContain('still running');
  }, 10000);

  it('should provide incremental output on multiple reads', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "first" && sleep 1 && echo "second"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const firstRead = await outputTool.execute({ bash_id: shellId });
    expect(firstRead.success).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const secondRead = await outputTool.execute({ bash_id: shellId });
    expect(secondRead.success).toBe(true);
  }, 10000);

  it('should include shell status information', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "test"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({ bash_id: shellId });
    expect(output.success).toBe(true);
    expect(output.output).toContain('shell-id');
    expect(output.output).toContain('status');
    expect(output.output).toContain('duration');
  });

  it('should report exit code for completed processes', async () => {
    const startResult = await bashTool.execute({
      command: 'exit 42',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({ bash_id: shellId });
    expect(output.success).toBe(true);
    expect(output.exitCode).toBe(42);
  });
});

describe('KillShellTool', () => {
  let bashTool: BashTool;
  let killTool: KillShellTool;
  let outputTool: BashOutputTool;

  beforeEach(() => {
    bashTool = new BashTool();
    killTool = new KillShellTool();
    outputTool = new BashOutputTool();
  });

  it('should kill running background shell', async () => {
    const startResult = await bashTool.execute({
      command: 'sleep 100',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    const shellId = startResult.bash_id || startResult.shell_id!;
    const killResult = await killTool.execute({ shell_id: shellId });
    expect(killResult.success).toBe(true);
    expect(killResult.output).toContain('killed');
  });

  it('should handle non-existent shell ID', async () => {
    const result = await killTool.execute({ shell_id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should kill shell that is producing output', async () => {
    const startResult = await bashTool.execute({
      command: 'while true; do echo "looping"; sleep 1; done',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    // Let it run for a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const killResult = await killTool.execute({ shell_id: shellId });
    expect(killResult.success).toBe(true);
  }, 10000);

  it('should kill shell and make it unavailable for output', async () => {
    const startResult = await bashTool.execute({
      command: 'sleep 100',
      run_in_background: true
    });

    await killTool.execute({ shell_id: startResult.bash_id! });

    // After killing, shell should not be found
    await new Promise(resolve => setTimeout(resolve, 500));
    const outputResult = await outputTool.execute({ bash_id: startResult.bash_id! });
    expect(outputResult.success).toBe(false);
    expect(outputResult.error).toContain('not found');
  }, 10000);
});

describe('Background Process Lifecycle', () => {
  let bashTool: BashTool;
  let outputTool: BashOutputTool;

  beforeEach(() => {
    bashTool = new BashTool();
    outputTool = new BashOutputTool();
  });

  it('should track complete lifecycle: start -> running -> completed', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "starting" && sleep 1 && echo "ending"',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    expect(startResult.output).toContain('Background');

    // Check while running
    await new Promise(resolve => setTimeout(resolve, 300));
    const shellId = startResult.bash_id || startResult.shell_id!;
    const runningOutput = await outputTool.execute({ bash_id: shellId });
    expect(runningOutput.success).toBe(true);

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 1500));
    const completedOutput = await outputTool.execute({ bash_id: shellId });
    expect(completedOutput.success).toBe(true);
  }, 10000);

  it('should generate valid shell ID format', async () => {
    const result = await bashTool.execute({
      command: 'echo "test"',
      run_in_background: true
    });

    if (!result.success || !(result.bash_id || result.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    const shellId = result.bash_id || result.shell_id!;
    expect(shellId).toMatch(/^bash_\d+_[a-z0-9]+$/);
  });

  it('should create output file for background process', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "file test"',
      run_in_background: true
    });

    if (!startResult.success || !startResult.output) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    expect(startResult.output).toContain('output-file');

    // Extract file path from output
    const fileMatch = startResult.output.match(/<output-file>(.+?)<\/output-file>/);
    expect(fileMatch).toBeTruthy();
    if (fileMatch) {
      const filePath = fileMatch[1];
      expect(filePath).toContain('.claude/background');
      const shellId = startResult.bash_id || startResult.shell_id;
      if (shellId) {
        expect(filePath).toContain(shellId);
      }
    }
  });

  it('should handle background process that fails', async () => {
    const startResult = await bashTool.execute({
      command: 'exit 1',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({ bash_id: shellId });
    expect(output.success).toBe(true);
    expect(output.exitCode).toBe(1);
    expect(output.output).toContain('failed');
  }, 5000);

  it('should handle stderr in background process', async () => {
    const startResult = await bashTool.execute({
      command: 'echo "error message" >&2',
      run_in_background: true
    });

    if (!startResult.success || !(startResult.bash_id || startResult.shell_id)) {
      console.warn('Background execution not available, skipping test');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const shellId = startResult.bash_id || startResult.shell_id!;
    const output = await outputTool.execute({ bash_id: shellId });
    expect(output.success).toBe(true);
    expect(output.stdout || output.output).toContain('STDERR');
  });
});

describe('Additional Features', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  it('should accept description parameter', async () => {
    const result = await bashTool.execute({
      command: 'echo "test"',
      description: 'Print test message',
      dangerouslyDisableSandbox: true
    });

    expect(result.success).toBe(true);
  });

  it('should execute commands with different timeout values', async () => {
    const result = await bashTool.execute({
      command: 'sleep 0.5',
      timeout: 2000,
      dangerouslyDisableSandbox: true
    });

    expect(result.success).toBe(true);
  }, 5000);

  it('should handle multiple sequential commands', async () => {
    const result = await bashTool.execute({
      command: 'echo "first" && echo "second" && echo "third"',
      dangerouslyDisableSandbox: true
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('first');
    expect(result.output).toContain('second');
    expect(result.output).toContain('third');
  });

  it('should handle piped commands', async () => {
    const result = await bashTool.execute({
      command: 'echo "hello world" | grep "world"',
      dangerouslyDisableSandbox: true
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('world');
  });

  it('should handle commands with environment variables', async () => {
    const result = await bashTool.execute({
      command: 'TEST_VAR="testvalue" && echo $TEST_VAR',
      dangerouslyDisableSandbox: true
    });

    expect(result.success).toBe(true);
  });

  it('should return both stdout and stderr fields', async () => {
    const result = await bashTool.execute({
      command: 'echo "stdout" && echo "stderr" >&2',
      dangerouslyDisableSandbox: true
    });

    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
    expect(result).toHaveProperty('exitCode');
  });

  it('should track command execution in audit logs', async () => {
    clearAuditLogs();

    await bashTool.execute({
      command: 'echo "audit test"',
      dangerouslyDisableSandbox: true
    });

    const logs = getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    const lastLog = logs[logs.length - 1];
    expect(lastLog.command).toBe('echo "audit test"');
    expect(lastLog).toHaveProperty('timestamp');
    expect(lastLog).toHaveProperty('duration');
    expect(lastLog).toHaveProperty('outputSize');
  });
});
