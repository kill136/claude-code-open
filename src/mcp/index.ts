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

// Protocol Types and Utilities
export {
  // Protocol Classes
  McpProtocol,

  // Protocol Constants
  MCP_VERSION,
  SUPPORTED_VERSIONS,
  McpMethod,
  JsonRpcErrorCode,
  LogLevel,

  // Protocol Types
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type JsonRpcError,
  type JsonRpcMessage,
  type ClientInfo,
  type ServerInfo,
  type ClientCapabilities,
  type ServerCapabilities,
  type InitializeParams,
  type InitializeResult,
  type Tool,
  type ToolCallParams,
  type ToolResult,
  type Resource,
  type ResourceContent,
  type Prompt,
  type PromptGetParams,
  type PromptContent,
  type Root,
  type ProgressNotification,
  type CancelledNotification,
  type SetLevelParams,
  type ValidationResult,

  // Sampling Types (NEW)
  type SamplingMessageContent,
  type SamplingMessage,
  type ModelPreferences,
  type CreateMessageParams,
  type CreateMessageResult,

  // Protocol Helper Functions
  isRequest,
  isResponse,
  isNotification,
  createInitializeParams,
  isVersionSupported,
  formatError,
} from './protocol.js';

// Sampling Module (NEW)
export {
  // Sampling Manager
  McpSamplingManager,

  // Sampling Callback Type
  type SamplingCallback,

  // Sampling Helper Functions
  createSamplingCallback,
  createModelPreferences,
  createTextContent,
  createSamplingRequest,
} from './sampling.js';

// Re-export everything from connection module for convenience
export * from './connection.js';
