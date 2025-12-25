/**
 * MCP Connection Management Module - Main Export File
 *
 * This file exports all public APIs from the connection management module.
 */

export {
  // Main Manager Class
  McpConnectionManager,
  createConnectionManager,

  // Transport Classes
  StdioConnection,
  SseConnection,
  HttpConnection,

  // Transport Factory Functions
  createStdioTransport,
  createHttpTransport,
  createSseTransport,

  // Type Definitions
  type ConnectionOptions,
  type McpServerInfo,
  type McpConnection,
  type McpMessage,
  type McpResponse,
  type McpTransport,
  type QueuedMessage,
} from './connection.js';

// Re-export everything from connection module for convenience
export * from './connection.js';
