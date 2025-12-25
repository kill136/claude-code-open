/**
 * Integration Test Framework - Main Export
 * Exports all utilities for easy importing in test files
 */

// Setup utilities
export {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createTestFile,
  createTestConfig,
  createTestSession,
  readTestFile,
  testFileExists,
  createMockApiResponse,
  createMockToolUseResponse,
  waitFor,
  getCurrentEnvironment,
  type TestEnvironment,
} from './setup.js';

// Helper utilities
export {
  createMinimalConfig,
  createTestSessionObject,
  createTestMessage,
  createMockToolResult,
  assertFileContains,
  assertFileEquals,
  assertDirectoryContains,
  countFilesInDirectory,
  createProjectStructure,
  parseToolUse,
  createToolResultMessage,
  MockApiClient,
  MockInput,
  type MockToolResult,
} from './helpers.js';
