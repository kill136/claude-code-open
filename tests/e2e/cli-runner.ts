/**
 * CLI 执行器
 * 提供编程方式运行 CLI 命令并捕获输出
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CLIRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
  duration: number;
  error?: Error;
}

export interface CLIRunOptions {
  /** 输入数据（用于交互模式） */
  input?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: NodeJS.ProcessEnv;
  /** 是否捕获 stderr */
  captureStderr?: boolean;
  /** 终止信号 */
  killSignal?: NodeJS.Signals;
}

/**
 * 运行 CLI 命令
 */
export async function runCLI(
  args: string[] = [],
  options: CLIRunOptions = {}
): Promise<CLIRunResult> {
  const {
    input,
    timeout = 10000,
    cwd = process.cwd(),
    env = process.env,
    captureStderr = true,
    killSignal = 'SIGTERM'
  } = options;

  // 查找 CLI 入口点
  const cliPath = findCLIPath();

  const startTime = Date.now();
  let stdout = '';
  let stderr = '';
  let timeoutId: NodeJS.Timeout | null = null;

  return new Promise((resolve) => {
    // 启动子进程
    const child = spawn('node', [cliPath, ...args], {
      cwd,
      env: {
        ...env,
        // 禁用颜色输出以便于测试
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        // 禁用 TTY 检测
        CI: 'true'
      },
      stdio: ['pipe', 'pipe', captureStderr ? 'pipe' : 'inherit']
    });

    // 捕获 stdout
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    // 捕获 stderr
    if (captureStderr) {
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    // 如果提供了输入，写入 stdin
    if (input) {
      child.stdin?.write(input);
      child.stdin?.end();
    }

    // 设置超时
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill(killSignal);
      }, timeout);
    }

    // 处理进程退出
    child.on('close', (code, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;

      resolve({
        exitCode: code,
        stdout,
        stderr,
        signal,
        duration
      });
    });

    // 处理错误
    child.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;

      resolve({
        exitCode: null,
        stdout,
        stderr,
        signal: null,
        duration,
        error
      });
    });
  });
}

/**
 * 运行交互式 CLI 会话
 */
export class InteractiveCLISession {
  private process: ChildProcess | null = null;
  private stdout = '';
  private stderr = '';
  private exitCode: number | null = null;
  private isRunning = false;

  constructor(
    private args: string[] = [],
    private options: CLIRunOptions = {}
  ) {}

  /**
   * 启动会话
   */
  async start(): Promise<void> {
    const cliPath = findCLIPath();
    const { cwd = process.cwd(), env = process.env, timeout = 30000 } = this.options;

    this.process = spawn('node', [cliPath, ...this.args], {
      cwd,
      env: {
        ...env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        CI: 'true'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.isRunning = true;

    // 捕获输出
    this.process.stdout?.on('data', (data) => {
      this.stdout += data.toString();
    });

    this.process.stderr?.on('data', (data) => {
      this.stderr += data.toString();
    });

    this.process.on('close', (code) => {
      this.exitCode = code;
      this.isRunning = false;
    });

    // 等待进程启动
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * 发送输入
   */
  write(input: string): void {
    if (!this.process || !this.isRunning) {
      throw new Error('会话未运行');
    }
    this.process.stdin?.write(input);
  }

  /**
   * 发送输入并换行
   */
  writeLine(input: string): void {
    this.write(input + '\n');
  }

  /**
   * 等待输出包含指定文本
   */
  async waitForOutput(text: string, timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.stdout.includes(text) || this.stderr.includes(text)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`等待输出超时: "${text}"\n当前输出:\n${this.getOutput()}`);
  }

  /**
   * 等待输出匹配正则表达式
   */
  async waitForPattern(pattern: RegExp, timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (pattern.test(this.stdout) || pattern.test(this.stderr)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`等待输出模式超时: ${pattern}\n当前输出:\n${this.getOutput()}`);
  }

  /**
   * 获取当前输出
   */
  getOutput(): string {
    return this.stdout;
  }

  /**
   * 获取当前错误输出
   */
  getErrorOutput(): string {
    return this.stderr;
  }

  /**
   * 清空输出缓冲区
   */
  clearOutput(): void {
    this.stdout = '';
    this.stderr = '';
  }

  /**
   * 停止会话
   */
  async stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<CLIRunResult> {
    if (!this.process) {
      throw new Error('会话未启动');
    }

    return new Promise((resolve) => {
      const exitHandler = () => {
        resolve({
          exitCode: this.exitCode,
          stdout: this.stdout,
          stderr: this.stderr,
          signal: null,
          duration: 0
        });
      };

      if (!this.isRunning) {
        exitHandler();
        return;
      }

      this.process!.on('close', exitHandler);
      this.process!.kill(signal);
    });
  }

  /**
   * 检查会话是否正在运行
   */
  running(): boolean {
    return this.isRunning;
  }
}

/**
 * 查找 CLI 入口点
 */
function findCLIPath(): string {
  // 优先使用编译后的版本
  const distPath = path.join(__dirname, '../../dist/cli.js');
  const srcPath = path.join(__dirname, '../../src/cli.ts');

  // 检查是否存在编译后的版本
  try {
    const fs = require('fs');
    if (fs.existsSync(distPath)) {
      return distPath;
    }
  } catch {
    // 忽略错误
  }

  // 使用 tsx 运行 TypeScript 源码
  return srcPath;
}

/**
 * 运行简单命令并返回输出
 */
export async function runSimpleCommand(
  command: string,
  options: CLIRunOptions = {}
): Promise<string> {
  const args = command.split(' ').filter(Boolean);
  const result = await runCLI(args, options);

  if (result.exitCode !== 0) {
    throw new Error(
      `命令失败 (退出码 ${result.exitCode}):\n${result.stderr || result.stdout}`
    );
  }

  return result.stdout;
}

/**
 * 运行带打印输出的命令
 */
export async function runPrintCommand(
  prompt: string,
  options: CLIRunOptions = {}
): Promise<string> {
  const result = await runCLI(['-p', prompt], options);

  if (result.exitCode !== 0) {
    throw new Error(
      `命令失败 (退出码 ${result.exitCode}):\n${result.stderr || result.stdout}`
    );
  }

  return result.stdout;
}

/**
 * 模拟用户交互
 */
export async function simulateInteraction(
  inputs: string[],
  options: CLIRunOptions = {}
): Promise<CLIRunResult> {
  const session = new InteractiveCLISession([], options);

  try {
    await session.start();

    // 发送每个输入
    for (const input of inputs) {
      session.writeLine(input);
      // 等待一小段时间让输出稳定
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 等待一段时间让命令完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    return await session.stop();
  } catch (error) {
    await session.stop();
    throw error;
  }
}
