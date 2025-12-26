/**
 * MCP Sampling Module
 *
 * Implements the MCP sampling protocol, which allows servers to request
 * LLM completions from the client. This enables MCP servers to access
 * AI capabilities through the client application.
 *
 * Based on MCP Specification 2024-11-05
 *
 * ## Overview
 *
 * Sampling allows MCP servers to request LLM capabilities from the client.
 * This is a "reverse" request flow where the server initiates the request
 * and the client fulfills it by calling an LLM.
 *
 * ## Security
 *
 * Sampling requests SHOULD always involve human-in-the-loop review for:
 * - Trust and safety considerations
 * - Prompt injection attack prevention
 * - Cost control
 *
 * ## Workflow
 *
 * 1. Server sends `sampling/createMessage` request to client
 * 2. Client reviews request (can modify messages, system prompt, etc.)
 * 3. Client executes LLM sampling
 * 4. Client reviews completion before returning
 * 5. Client returns result to server
 */

import { EventEmitter } from 'events';
import type {
  CreateMessageParams,
  CreateMessageResult,
  ModelPreferences,
  SamplingMessageContent,
} from './protocol.js';

// Re-export types for convenience
export type {
  CreateMessageParams,
  CreateMessageResult,
  ModelPreferences,
  SamplingMessageContent,
};

/**
 * Sampling callback handler
 */
export type SamplingCallback = (
  params: CreateMessageParams
) => Promise<CreateMessageResult>;

// ============ Sampling Manager ============

/**
 * Manages sampling requests from MCP servers
 *
 * Features:
 * - Handles sampling/createMessage requests
 * - Callback-based architecture for client integration
 * - Request tracking and timeout
 * - Event emission for monitoring
 */
export class McpSamplingManager extends EventEmitter {
  private callbacks: Map<string, SamplingCallback> = new Map();
  private pendingRequests: Map<string, {
    params: CreateMessageParams;
    timestamp: number;
    timeout?: NodeJS.Timeout;
  }> = new Map();

  private options: {
    defaultTimeout: number;
    maxConcurrentRequests: number;
  };

  constructor(options?: {
    defaultTimeout?: number;
    maxConcurrentRequests?: number;
  }) {
    super();
    this.options = {
      defaultTimeout: options?.defaultTimeout ?? 60000, // 60s default
      maxConcurrentRequests: options?.maxConcurrentRequests ?? 5,
    };
  }

  // ============ Callback Registration ============

  /**
   * Register a sampling callback for a server
   *
   * The callback will be invoked when the server requests sampling.
   * Multiple servers can have different callbacks.
   *
   * @param serverName - Name of the MCP server
   * @param callback - Function to handle sampling requests
   */
  registerCallback(serverName: string, callback: SamplingCallback): void {
    this.callbacks.set(serverName, callback);
    this.emit('callback:registered', { serverName });
  }

  /**
   * Unregister a sampling callback
   */
  unregisterCallback(serverName: string): void {
    this.callbacks.delete(serverName);
    this.emit('callback:unregistered', { serverName });
  }

  /**
   * Check if a server has a registered callback
   */
  hasCallback(serverName: string): boolean {
    return this.callbacks.has(serverName);
  }

  // ============ Request Handling ============

  /**
   * Handle a sampling request from a server
   *
   * This is called when a server sends a sampling/createMessage request.
   * The request will be forwarded to the registered callback.
   *
   * @param serverName - Name of the requesting server
   * @param params - Sampling parameters
   * @param timeout - Optional timeout override
   * @returns Sampling result
   */
  async handleSamplingRequest(
    serverName: string,
    params: CreateMessageParams,
    timeout?: number
  ): Promise<CreateMessageResult> {
    // Check if we have a callback
    const callback = this.callbacks.get(serverName);
    if (!callback) {
      throw new Error(
        `No sampling callback registered for server: ${serverName}`
      );
    }

    // Check concurrent request limit
    if (this.pendingRequests.size >= this.options.maxConcurrentRequests) {
      throw new Error(
        `Maximum concurrent sampling requests (${this.options.maxConcurrentRequests}) exceeded`
      );
    }

    // Validate parameters
    this.validateSamplingParams(params);

    // Generate request ID
    const requestId = `${serverName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.emit('request:start', { requestId, serverName, params });

    try {
      // Set up timeout
      const timeoutMs = timeout ?? this.options.defaultTimeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Sampling request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        this.pendingRequests.set(requestId, {
          params,
          timestamp: Date.now(),
          timeout: timer,
        });
      });

      // Execute callback with timeout
      const result = await Promise.race([
        callback(params),
        timeoutPromise,
      ]);

      // Clean up
      const pending = this.pendingRequests.get(requestId);
      if (pending?.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pendingRequests.delete(requestId);

      // Validate result
      this.validateSamplingResult(result);

      this.emit('request:complete', { requestId, serverName, result });

      return result;
    } catch (error) {
      // Clean up on error
      const pending = this.pendingRequests.get(requestId);
      if (pending?.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pendingRequests.delete(requestId);

      this.emit('request:error', { requestId, serverName, error });
      throw error;
    }
  }

  // ============ Validation ============

  /**
   * Validate sampling parameters
   *
   * Validates according to MCP specification:
   * - messages must be an array of message content objects
   * - maxTokens is required and must be positive
   * - model preferences must be in valid range (0-1)
   * - includeContext must be one of the allowed values
   */
  private validateSamplingParams(params: CreateMessageParams): void {
    if (!params.messages || !Array.isArray(params.messages)) {
      throw new Error('Sampling params must include messages array');
    }

    if (params.messages.length === 0) {
      throw new Error('Sampling params must include at least one message');
    }

    if (!params.maxTokens || params.maxTokens <= 0) {
      throw new Error('Sampling params must include positive maxTokens');
    }

    // Validate messages (note: in MCP spec, messages is an array of content, not message objects)
    for (const content of params.messages) {
      if (!content || typeof content !== 'object') {
        throw new Error('Message content must be an object');
      }

      if (!content.type || typeof content.type !== 'string') {
        throw new Error('Message content must have a type field');
      }
    }

    // Validate includeContext if present
    if (params.includeContext) {
      const validContexts = ['none', 'thisServer', 'allServers'];
      if (!validContexts.includes(params.includeContext)) {
        throw new Error(
          `includeContext must be one of: ${validContexts.join(', ')}`
        );
      }
    }

    // Validate model preferences if present
    if (params.modelPreferences) {
      const { costPriority, speedPriority, intelligencePriority } = params.modelPreferences;

      const validatePriority = (value: number | undefined, name: string) => {
        if (value !== undefined && (value < 0 || value > 1)) {
          throw new Error(`${name} must be between 0 and 1`);
        }
      };

      validatePriority(costPriority, 'costPriority');
      validatePriority(speedPriority, 'speedPriority');
      validatePriority(intelligencePriority, 'intelligencePriority');
    }

    // Validate temperature if present
    if (params.temperature !== undefined) {
      if (params.temperature < 0 || params.temperature > 1) {
        throw new Error('temperature must be between 0 and 1');
      }
    }
  }

  /**
   * Validate sampling result
   *
   * Ensures the result conforms to MCP specification:
   * - role must be 'assistant'
   * - content must be a valid content object with type field
   * - model must be a non-empty string
   * - stopReason (if present) should be a known value
   */
  private validateSamplingResult(result: CreateMessageResult): void {
    if (!result || typeof result !== 'object') {
      throw new Error('Sampling result must be an object');
    }

    if (result.role !== 'assistant') {
      throw new Error('Sampling result must have role "assistant"');
    }

    if (!result.content || typeof result.content !== 'object') {
      throw new Error('Sampling result must have content object');
    }

    if (!result.content.type || typeof result.content.type !== 'string') {
      throw new Error('Sampling result content must have a type field');
    }

    if (!result.model || typeof result.model !== 'string') {
      throw new Error('Sampling result must include model string');
    }

    // Validate stopReason if present
    if (result.stopReason) {
      const knownReasons = ['endTurn', 'stopSequence', 'maxTokens'];
      if (!knownReasons.includes(result.stopReason)) {
        // Warning only - spec allows custom stop reasons
        this.emit('warning', {
          message: `Unknown stopReason: ${result.stopReason}. Known values: ${knownReasons.join(', ')}`,
          result,
        });
      }
    }
  }

  // ============ Request Management ============

  /**
   * Cancel a pending sampling request
   */
  cancelRequest(requestId: string): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return false;
    }

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    this.pendingRequests.delete(requestId);
    this.emit('request:cancelled', { requestId });

    return true;
  }

  /**
   * Cancel all pending requests for a server
   */
  cancelServerRequests(serverName: string): number {
    let cancelled = 0;

    for (const [requestId] of this.pendingRequests) {
      if (requestId.startsWith(`${serverName}-`)) {
        if (this.cancelRequest(requestId)) {
          cancelled++;
        }
      }
    }

    return cancelled;
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get pending requests for a server
   */
  getServerPendingRequests(serverName: string): CreateMessageParams[] {
    const requests: CreateMessageParams[] = [];

    for (const [requestId, pending] of this.pendingRequests) {
      if (requestId.startsWith(`${serverName}-`)) {
        requests.push(pending.params);
      }
    }

    return requests;
  }

  // ============ Cleanup ============

  /**
   * Cleanup all pending requests and callbacks
   */
  cleanup(): void {
    // Cancel all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    }
    this.pendingRequests.clear();

    // Clear all callbacks
    this.callbacks.clear();

    this.emit('cleanup');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      registeredCallbacks: this.callbacks.size,
      pendingRequests: this.pendingRequests.size,
      maxConcurrentRequests: this.options.maxConcurrentRequests,
    };
  }
}

// ============ Helper Functions ============

/**
 * Create a default sampling callback that delegates to a function
 */
export function createSamplingCallback(
  handler: (params: CreateMessageParams) => Promise<CreateMessageResult>
): SamplingCallback {
  return async (params: CreateMessageParams) => {
    return handler(params);
  };
}

/**
 * Create a model preferences object with defaults
 *
 * Default values (0.5 for all) represent balanced preferences.
 * Adjust based on your application's needs:
 * - Higher costPriority: Prefer more expensive, capable models
 * - Higher speedPriority: Prefer faster models
 * - Higher intelligencePriority: Prefer more capable models
 */
export function createModelPreferences(
  overrides?: Partial<ModelPreferences>
): ModelPreferences {
  return {
    costPriority: 0.5,
    speedPriority: 0.5,
    intelligencePriority: 0.5,
    ...overrides,
  };
}

/**
 * Create a text message content object
 *
 * Helper for creating the most common content type
 */
export function createTextContent(text: string): SamplingMessageContent {
  return {
    type: 'text',
    text,
  };
}

/**
 * Create a sampling request with sensible defaults
 *
 * @param messages - Array of message contents
 * @param options - Optional configuration
 * @returns CreateMessageParams ready to send
 */
export function createSamplingRequest(
  messages: SamplingMessageContent[],
  options?: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    modelPreferences?: Partial<ModelPreferences>;
    includeContext?: 'none' | 'thisServer' | 'allServers';
    stopSequences?: string[];
    metadata?: Record<string, unknown>;
  }
): CreateMessageParams {
  return {
    messages,
    maxTokens: options?.maxTokens ?? 1024,
    systemPrompt: options?.systemPrompt,
    temperature: options?.temperature,
    modelPreferences: options?.modelPreferences
      ? createModelPreferences(options.modelPreferences)
      : undefined,
    includeContext: options?.includeContext ?? 'thisServer',
    stopSequences: options?.stopSequences,
    metadata: options?.metadata,
  };
}
