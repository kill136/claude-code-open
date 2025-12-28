/**
 * 测试辅助函数
 */

export * from '../setup';

/**
 * 断言工具存在
 */
export function assertToolExists(toolName: string, tools: string[]): void {
  if (!tools.includes(toolName)) {
    throw new Error(`Tool "${toolName}" not found in available tools`);
  }
}

/**
 * 断言输出包含特定内容
 */
export function assertOutputContains(
  output: string,
  expected: string | RegExp
): void {
  if (typeof expected === 'string') {
    if (!output.includes(expected)) {
      throw new Error(
        `Output does not contain expected string.\nExpected: ${expected}\nActual: ${output}`
      );
    }
  } else {
    if (!expected.test(output)) {
      throw new Error(
        `Output does not match expected pattern.\nPattern: ${expected}\nActual: ${output}`
      );
    }
  }
}

/**
 * 断言输出不包含特定内容
 */
export function assertOutputNotContains(
  output: string,
  unexpected: string | RegExp
): void {
  if (typeof unexpected === 'string') {
    if (output.includes(unexpected)) {
      throw new Error(
        `Output unexpectedly contains string: ${unexpected}`
      );
    }
  } else {
    if (unexpected.test(output)) {
      throw new Error(
        `Output unexpectedly matches pattern: ${unexpected}`
      );
    }
  }
}

/**
 * 断言JSON输出格式
 */
export function assertValidJSON(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch (e) {
    throw new Error(`Invalid JSON output: ${output}`);
  }
}

/**
 * 断言退出码
 */
export function assertExitCode(
  actual: number | null,
  expected: number
): void {
  if (actual !== expected) {
    throw new Error(
      `Exit code mismatch. Expected: ${expected}, Actual: ${actual}`
    );
  }
}

/**
 * 创建模拟MCP服务器配置
 */
export function createMockMCPConfig(name: string): Record<string, unknown> {
  return {
    mcpServers: {
      [name]: {
        command: 'node',
        args: ['mock-mcp-server.js'],
        env: {},
      },
    },
  };
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * 捕获进程输出
 */
export interface ProcessCapture {
  stdout: string[];
  stderr: string[];
  combined: string[];
}

export function createProcessCapture(): ProcessCapture {
  return {
    stdout: [],
    stderr: [],
    combined: [],
  };
}

/**
 * 解析工具调用响应
 */
export interface ToolCallResult {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  success: boolean;
}

export function parseToolCallResult(response: string): ToolCallResult | null {
  // TODO: 实现工具调用结果解析
  return null;
}

/**
 * 生成随机会话ID
 */
export function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 计算token估算（简化版）
 */
export function estimateTokens(text: string): number {
  // 粗略估算：平均每4个字符一个token
  return Math.ceil(text.length / 4);
}

/**
 * 测试报告生成器
 */
export interface TestReport {
  taskId: string;
  passed: boolean;
  duration: number;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
}

export function createTestReport(taskId: string): TestReport {
  return {
    taskId,
    passed: true,
    duration: 0,
    checks: [],
  };
}

export function addCheck(
  report: TestReport,
  name: string,
  passed: boolean,
  message?: string
): void {
  report.checks.push({ name, passed, message });
  if (!passed) {
    report.passed = false;
  }
}

export function finalizeReport(report: TestReport, startTime: number): void {
  report.duration = Date.now() - startTime;
}
