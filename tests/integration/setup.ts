/**
 * Integration Test Environment Setup
 * Provides utilities for setting up and tearing down test environments
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export interface TestEnvironment {
  /** Temporary directory for test files */
  tempDir: string;
  /** Test config directory */
  configDir: string;
  /** Test session directory */
  sessionDir: string;
  /** Test project directory */
  projectDir: string;
  /** Original environment variables */
  originalEnv: Record<string, string | undefined>;
  /** Original working directory */
  originalCwd: string;
}

let currentEnvironment: TestEnvironment | null = null;

/**
 * Setup a test environment with temporary directories
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const testId = randomUUID().slice(0, 8);
  const tempDir = path.join(os.tmpdir(), `claude-test-${testId}`);

  const env: TestEnvironment = {
    tempDir,
    configDir: path.join(tempDir, 'config'),
    sessionDir: path.join(tempDir, 'sessions'),
    projectDir: path.join(tempDir, 'project'),
    originalEnv: {
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,
      CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
    },
    originalCwd: process.cwd(),
  };

  // Create directories
  fs.mkdirSync(env.configDir, { recursive: true });
  fs.mkdirSync(env.sessionDir, { recursive: true });
  fs.mkdirSync(env.projectDir, { recursive: true });

  // Set test environment variables
  process.env.CLAUDE_CONFIG_DIR = env.configDir;
  process.env.ANTHROPIC_API_KEY = 'test-api-key-12345';

  currentEnvironment = env;
  return env;
}

/**
 * Cleanup test environment and restore original state
 */
export async function cleanupTestEnvironment(env?: TestEnvironment): Promise<void> {
  const envToClean = env || currentEnvironment;
  if (!envToClean) return;

  // Restore original environment variables
  for (const [key, value] of Object.entries(envToClean.originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // Restore working directory
  try {
    process.chdir(envToClean.originalCwd);
  } catch (error) {
    // Ignore errors if directory no longer exists
  }

  // Remove temporary directory
  if (fs.existsSync(envToClean.tempDir)) {
    fs.rmSync(envToClean.tempDir, { recursive: true, force: true });
  }

  if (envToClean === currentEnvironment) {
    currentEnvironment = null;
  }
}

/**
 * Create a test file with content
 */
export function createTestFile(env: TestEnvironment, relativePath: string, content: string): string {
  const filePath = path.join(env.projectDir, relativePath);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Create a test config file
 */
export function createTestConfig(env: TestEnvironment, config: any): string {
  const configPath = path.join(env.configDir, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

/**
 * Create a test session file
 */
export function createTestSession(env: TestEnvironment, sessionId: string, session: any): string {
  const sessionPath = path.join(env.sessionDir, `${sessionId}.json`);
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  return sessionPath;
}

/**
 * Read a file from the test environment
 */
export function readTestFile(env: TestEnvironment, relativePath: string): string {
  const filePath = path.join(env.projectDir, relativePath);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Check if a file exists in the test environment
 */
export function testFileExists(env: TestEnvironment, relativePath: string): boolean {
  const filePath = path.join(env.projectDir, relativePath);
  return fs.existsSync(filePath);
}

/**
 * Create a mock API response
 */
export function createMockApiResponse(content: string, stopReason: 'end_turn' | 'tool_use' = 'end_turn') {
  return {
    id: `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
}

/**
 * Create a mock tool use response
 */
export function createMockToolUseResponse(toolName: string, input: any) {
  return {
    id: `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: `toolu_${randomUUID()}`,
        name: toolName,
        input,
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
}

/**
 * Wait for a condition to be true
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
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Get the current test environment
 */
export function getCurrentEnvironment(): TestEnvironment | null {
  return currentEnvironment;
}
