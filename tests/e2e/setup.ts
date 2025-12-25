/**
 * E2E 测试环境设置
 * 提供测试前的初始化和测试后的清理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MockApiServer } from './mock-server.js';

export interface E2ETestContext {
  testDir: string;
  configDir: string;
  sessionDir: string;
  homeDir: string;
  mockServer: MockApiServer;
  originalEnv: NodeJS.ProcessEnv;
  originalCwd: string;
}

/**
 * 创建临时测试目录
 */
export function createTestDirectory(testName: string): string {
  const testDir = path.join(os.tmpdir(), `claude-e2e-${testName}-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * 设置 E2E 测试环境
 */
export async function setupE2ETest(testName: string): Promise<E2ETestContext> {
  // 创建测试目录
  const testDir = createTestDirectory(testName);
  const configDir = path.join(testDir, '.claude');
  const sessionDir = path.join(configDir, 'sessions');
  const homeDir = testDir;

  // 创建必要的目录
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });

  // 保存原始环境
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  // 设置测试环境变量
  process.env.CLAUDE_CONFIG_DIR = configDir;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir; // Windows 支持
  process.env.CLAUDE_SESSION_DIR = sessionDir;

  // 禁用真实 API 调用
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CLAUDE_API_KEY;

  // 启动 Mock API 服务器
  const mockServer = new MockApiServer();
  await mockServer.start();

  // 设置 Mock API 端点
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${mockServer.port}`;
  process.env.ANTHROPIC_API_KEY = 'test-api-key';

  // 切换到测试目录
  process.chdir(testDir);

  return {
    testDir,
    configDir,
    sessionDir,
    homeDir,
    mockServer,
    originalEnv,
    originalCwd
  };
}

/**
 * 清理 E2E 测试环境
 */
export async function teardownE2ETest(context: E2ETestContext): Promise<void> {
  // 恢复原始目录
  process.chdir(context.originalCwd);

  // 恢复原始环境变量
  process.env = context.originalEnv;

  // 停止 Mock 服务器
  await context.mockServer.stop();

  // 清理测试目录
  try {
    if (fs.existsSync(context.testDir)) {
      fs.rmSync(context.testDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`清理测试目录失败: ${(error as Error).message}`);
  }
}

/**
 * 创建测试配置文件
 */
export function createTestConfig(configDir: string, config: any): void {
  const configPath = path.join(configDir, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * 创建测试文件
 */
export function createTestFile(testDir: string, relativePath: string, content: string): string {
  const filePath = path.join(testDir, relativePath);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * 读取测试文件
 */
export function readTestFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 列出目录中的文件
 */
export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir);
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`等待超时 (${timeout}ms)`);
}

/**
 * 断言辅助函数
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\n  期望: ${JSON.stringify(expected)}\n  实际: ${JSON.stringify(actual)}`);
  }
}

export function assertContains(text: string, substring: string, message?: string): void {
  if (!text.includes(substring)) {
    throw new Error(
      message || `期望文本包含 "${substring}"\n  实际文本: ${text.substring(0, 200)}...`
    );
  }
}

export function assertNotContains(text: string, substring: string, message?: string): void {
  if (text.includes(substring)) {
    throw new Error(
      message || `期望文本不包含 "${substring}"\n  实际文本: ${text.substring(0, 200)}...`
    );
  }
}

export function assertMatch(text: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(text)) {
    throw new Error(
      message || `期望文本匹配模式 ${pattern}\n  实际文本: ${text.substring(0, 200)}...`
    );
  }
}

/**
 * 测试运行器
 */
export interface TestSuite {
  name: string;
  tests: Array<{ name: string; fn: () => void | Promise<void> }>;
}

export async function runTestSuite(suite: TestSuite): Promise<{ passed: number; failed: number }> {
  console.log(`\n运行测试套件: ${suite.name}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of suite.tests) {
    try {
      await test.fn();
      console.log(`  ✓ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`  ✗ ${test.name}`);
      console.error(`    错误: ${(error as Error).message}`);
      if ((error as Error).stack) {
        const stack = (error as Error).stack!;
        const relevantStack = stack
          .split('\n')
          .slice(1, 4)
          .join('\n');
        console.error(`    ${relevantStack}`);
      }
      failed++;
    }
  }

  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败\n`);

  return { passed, failed };
}
