/**
 * 测试环境配置
 * 所有测试文件共享的设置和辅助功能
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 官方CLI路径
export const OFFICIAL_CLI_PATH = path.join(
  __dirname,
  '../node_modules/@anthropic-ai/claude-code/cli.js'
);

// 我们的CLI路径
export const OUR_CLI_PATH = path.join(__dirname, '../dist/cli.js');

// 测试临时目录
export const TEST_TEMP_DIR = path.join(os.tmpdir(), 'claude-code-tests');

// 测试用配置目录
export const TEST_CONFIG_DIR = path.join(TEST_TEMP_DIR, '.claude');

// 测试用会话目录
export const TEST_SESSION_DIR = path.join(TEST_CONFIG_DIR, 'sessions');

/**
 * 全局测试设置
 */
beforeAll(async () => {
  // 创建测试临时目录
  if (!fs.existsSync(TEST_TEMP_DIR)) {
    fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_CONFIG_DIR)) {
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_SESSION_DIR)) {
    fs.mkdirSync(TEST_SESSION_DIR, { recursive: true });
  }
});

/**
 * 全局测试清理
 */
afterAll(async () => {
  // 清理测试临时目录
  if (fs.existsSync(TEST_TEMP_DIR)) {
    fs.rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
  }
});

/**
 * CLI执行结果接口
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * 执行CLI命令并获取结果
 */
export async function runCLI(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    input?: string;
    timeout?: number;
    useOfficial?: boolean;
  } = {}
): Promise<CLIResult> {
  const {
    cwd = TEST_TEMP_DIR,
    env = {},
    input,
    timeout = 30000,
    useOfficial = false,
  } = options;

  const cliPath = useOfficial ? OFFICIAL_CLI_PATH : OUR_CLI_PATH;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('node', [cliPath, ...args], {
      cwd,
      env: {
        ...process.env,
        HOME: TEST_TEMP_DIR,
        CLAUDE_CONFIG_DIR: TEST_CONFIG_DIR,
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
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

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code,
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

/**
 * 比较官方和我们的CLI输出
 */
export async function compareCLIOutput(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    input?: string;
    timeout?: number;
  } = {}
): Promise<{
  official: CLIResult;
  ours: CLIResult;
  match: boolean;
}> {
  const [official, ours] = await Promise.all([
    runCLI(args, { ...options, useOfficial: true }),
    runCLI(args, { ...options, useOfficial: false }),
  ]);

  // 简单的输出比较（可以根据需要定制）
  const match =
    official.exitCode === ours.exitCode &&
    normalizeOutput(official.stdout) === normalizeOutput(ours.stdout);

  return { official, ours, match };
}

/**
 * 标准化输出以便比较
 */
function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/gm, '')
    .trim();
}

/**
 * 创建测试用的临时文件
 */
export function createTestFile(
  relativePath: string,
  content: string
): string {
  const fullPath = path.join(TEST_TEMP_DIR, relativePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content);
  return fullPath;
}

/**
 * 读取测试文件内容
 */
export function readTestFile(relativePath: string): string {
  const fullPath = path.join(TEST_TEMP_DIR, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * 检查测试文件是否存在
 */
export function testFileExists(relativePath: string): boolean {
  const fullPath = path.join(TEST_TEMP_DIR, relativePath);
  return fs.existsSync(fullPath);
}

/**
 * 删除测试文件
 */
export function deleteTestFile(relativePath: string): void {
  const fullPath = path.join(TEST_TEMP_DIR, relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * 创建测试用的配置文件
 */
export function createTestConfig(config: Record<string, unknown>): string {
  const configPath = path.join(TEST_CONFIG_DIR, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * 创建测试用的CLAUDE.md文件
 */
export function createTestClaudeMd(content: string): string {
  return createTestFile('CLAUDE.md', content);
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 模拟API响应
 */
export interface MockAPIResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 创建模拟API服务器（用于测试）
 */
export async function createMockAPIServer(
  responses: MockAPIResponse[]
): Promise<{ port: number; close: () => void }> {
  // TODO: 实现模拟API服务器
  // 这将用于测试API交互而不消耗真实API配额
  return {
    port: 0,
    close: () => {},
  };
}

/**
 * 测试用例分类
 */
export const TestCategory = {
  CLI: 'cli',
  TOOLS: 'tools',
  MCP: 'mcp',
  SESSION: 'session',
  PERMISSION: 'permission',
  HOOKS: 'hooks',
  CONFIG: 'config',
  IDE: 'ide',
  PLUGIN: 'plugin',
  UI: 'ui',
} as const;

/**
 * 测试优先级
 */
export const Priority = {
  P0: 'P0', // 核心功能
  P1: 'P1', // 重要功能
  P2: 'P2', // 增强功能
} as const;

/**
 * 标记测试元信息
 */
export interface TestMeta {
  id: string;
  category: keyof typeof TestCategory;
  priority: keyof typeof Priority;
  description: string;
  officialBehavior: string;
}

/**
 * 创建带元信息的测试描述
 */
export function describeFeature(meta: TestMeta, fn: () => void): void {
  const prefix = `[${meta.id}][${meta.priority}]`;
  describe(`${prefix} ${meta.description}`, fn);
}
