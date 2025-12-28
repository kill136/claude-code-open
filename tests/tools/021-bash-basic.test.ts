/**
 * 任务 021: Bash 工具 - 基础命令执行
 * 负责人: 工程师 #021
 * 优先级: P0
 *
 * 官方行为: 执行shell命令，返回stdout/stderr和退出码
 *
 * 验收标准:
 * - [ ] 执行单个命令
 * - [ ] 返回stdout/stderr
 * - [ ] 正确处理退出码
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  TEST_TEMP_DIR,
  createTestFile,
  describeFeature,
} from '../setup';

// 模拟 Bash 工具的输入类型
interface BashToolInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
}

// 模拟 Bash 工具的输出类型
interface BashToolOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * 模拟 Bash 工具执行
 * 注意：这是测试用的模拟，实际应该导入真正的工具实现
 */
async function executeBashTool(input: BashToolInput): Promise<BashToolOutput> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const timeout = input.timeout || 120000;
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('bash', ['-c', input.command], {
      cwd: TEST_TEMP_DIR,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: stderr + err.message,
        exitCode: 1,
        timedOut,
      });
    });
  });
}

describeFeature(
  {
    id: '021',
    category: 'TOOLS',
    priority: 'P0',
    description: 'Bash 工具 - 基础命令执行',
    officialBehavior: '执行shell命令，返回stdout/stderr和退出码',
  },
  () => {
    describe('基础命令执行', () => {
      it('应该执行简单的 echo 命令', async () => {
        const result = await executeBashTool({
          command: 'echo "Hello World"',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('Hello World');
        expect(result.stderr).toBe('');
      });

      it('应该执行 ls 命令', async () => {
        const result = await executeBashTool({
          command: 'ls -la',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBeDefined();
      });

      it('应该执行 pwd 命令并返回工作目录', async () => {
        const result = await executeBashTool({
          command: 'pwd',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(TEST_TEMP_DIR);
      });
    });

    describe('标准输出和错误输出', () => {
      it('应该正确捕获 stdout', async () => {
        const result = await executeBashTool({
          command: 'echo "stdout message"',
        });

        expect(result.stdout).toContain('stdout message');
        expect(result.stderr).toBe('');
      });

      it('应该正确捕获 stderr', async () => {
        const result = await executeBashTool({
          command: 'echo "stderr message" >&2',
        });

        expect(result.stderr).toContain('stderr message');
      });

      it('应该同时捕获 stdout 和 stderr', async () => {
        const result = await executeBashTool({
          command: 'echo "out" && echo "err" >&2',
        });

        expect(result.stdout).toContain('out');
        expect(result.stderr).toContain('err');
      });
    });

    describe('退出码处理', () => {
      it('成功命令应该返回退出码 0', async () => {
        const result = await executeBashTool({
          command: 'true',
        });

        expect(result.exitCode).toBe(0);
      });

      it('失败命令应该返回非零退出码', async () => {
        const result = await executeBashTool({
          command: 'false',
        });

        expect(result.exitCode).not.toBe(0);
      });

      it('应该返回自定义退出码', async () => {
        const result = await executeBashTool({
          command: 'exit 42',
        });

        expect(result.exitCode).toBe(42);
      });

      it('命令不存在时应该返回错误', async () => {
        const result = await executeBashTool({
          command: 'nonexistent_command_xyz',
        });

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('not found');
      });
    });

    describe('文件操作', () => {
      it('应该能够创建文件', async () => {
        const testFile = path.join(TEST_TEMP_DIR, 'bash-test-file.txt');

        const result = await executeBashTool({
          command: `echo "test content" > "${testFile}"`,
        });

        expect(result.exitCode).toBe(0);
        expect(fs.existsSync(testFile)).toBe(true);

        // 清理
        fs.unlinkSync(testFile);
      });

      it('应该能够读取文件', async () => {
        const testFile = createTestFile('read-test.txt', 'file content');

        const result = await executeBashTool({
          command: `cat "${testFile}"`,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('file content');
      });
    });

    describe('管道和重定向', () => {
      it('应该支持管道操作', async () => {
        const result = await executeBashTool({
          command: 'echo "hello world" | tr "a-z" "A-Z"',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('HELLO WORLD');
      });

      it('应该支持命令替换', async () => {
        const result = await executeBashTool({
          command: 'echo "current dir: $(pwd)"',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(TEST_TEMP_DIR);
      });
    });

    describe('环境变量', () => {
      it('应该能够访问环境变量', async () => {
        const result = await executeBashTool({
          command: 'echo $HOME',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBeTruthy();
      });

      it('应该能够设置和使用环境变量', async () => {
        const result = await executeBashTool({
          command: 'export TEST_VAR="test_value" && echo $TEST_VAR',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('test_value');
      });
    });

    describe('特殊字符处理', () => {
      it('应该正确处理空格', async () => {
        const result = await executeBashTool({
          command: 'echo "hello    world"',
        });

        expect(result.stdout.trim()).toBe('hello    world');
      });

      it('应该正确处理引号', async () => {
        const result = await executeBashTool({
          command: "echo 'single' \"double\"",
        });

        expect(result.stdout.trim()).toBe('single double');
      });

      it('应该正确处理特殊字符', async () => {
        const result = await executeBashTool({
          command: 'echo "a$b&c|d"',
        });

        expect(result.exitCode).toBe(0);
      });
    });
  }
);
