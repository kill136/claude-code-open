/**
 * MCP Cancellation Module
 *
 * Implements request cancellation for MCP operations. Provides:
 * - Request tracking and cancellation
 * - Timeout-based cancellation
 * - Cancellation token pattern
 * - Integration with AbortController
 *
 * Based on MCP Specification 2024-11-05
 */

import { EventEmitter } from 'events';
import { CancelledNotification } from './protocol.js';

// ============ Type Definitions ============

/**
 * Cancellation reason
 */
export enum CancellationReason {
  UserCancelled = 'user_cancelled',
  Timeout = 'timeout',
  ServerRequest = 'server_request',
  Shutdown = 'shutdown',
  Error = 'error',
}

/**
 * Cancellable request
 */
export interface CancellableRequest {
  id: string | number;
  serverName: string;
  method: string;
  startTime: Date;
  timeout?: number;
  abortController?: AbortController;
  onCancel?: (reason: CancellationReason) => void;
}

/**
 * Cancellation result
 */
export interface CancellationResult {
  success: boolean;
  reason: CancellationReason;
  requestId: string | number;
  serverName: string;
  duration: number;
}

// ============ Cancellation Token ============

/**
 * Cancellation token for request tracking
 *
 * Provides a way to check if a request has been cancelled
 * and to register callbacks for cancellation events.
 */
export class CancellationToken extends EventEmitter {
  private _cancelled: boolean = false;
  private _reason: CancellationReason | null = null;
  private _timestamp: Date | null = null;

  /**
   * Check if cancellation has been requested
   */
  get isCancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Get cancellation reason
   */
  get reason(): CancellationReason | null {
    return this._reason;
  }

  /**
   * Get cancellation timestamp
   */
  get timestamp(): Date | null {
    return this._timestamp;
  }

  /**
   * Request cancellation
   */
  cancel(reason: CancellationReason = CancellationReason.UserCancelled): void {
    if (this._cancelled) {
      return;
    }

    this._cancelled = true;
    this._reason = reason;
    this._timestamp = new Date();

    this.emit('cancelled', { reason, timestamp: this._timestamp });
  }

  /**
   * Throw if cancelled
   */
  throwIfCancelled(): void {
    if (this._cancelled) {
      throw new CancellationError(this._reason || CancellationReason.UserCancelled);
    }
  }

  /**
   * Register a cancellation callback
   */
  onCancelled(callback: (reason: CancellationReason) => void): void {
    if (this._cancelled && this._reason) {
      callback(this._reason);
    } else {
      this.once('cancelled', ({ reason }) => callback(reason));
    }
  }
}

/**
 * Cancellation error
 */
export class CancellationError extends Error {
  constructor(public reason: CancellationReason) {
    super(`Request cancelled: ${reason}`);
    this.name = 'CancellationError';
  }
}

// ============ Cancellation Manager ============

/**
 * Manages request cancellation for MCP operations
 *
 * Features:
 * - Request registration and tracking
 * - Manual and timeout-based cancellation
 * - AbortController integration
 * - Cancellation notification
 * - Event emission for monitoring
 */
export class McpCancellationManager extends EventEmitter {
  private requests: Map<string | number, CancellableRequest> = new Map();
  private timeouts: Map<string | number, NodeJS.Timeout> = new Map();

  // ============ Request Registration ============

  /**
   * Register a cancellable request
   *
   * Returns a cancellation token that can be used to track
   * and trigger cancellation.
   *
   * Options:
   * - timeout: Automatically cancel after this many ms
   * - abortController: Link to an AbortController
   * - onCancel: Callback when cancelled
   * - onTimeout: Callback specifically for timeout (called in addition to onCancel)
   */
  registerRequest(
    id: string | number,
    serverName: string,
    method: string,
    options?: {
      timeout?: number;
      abortController?: AbortController;
      onCancel?: (reason: CancellationReason) => void;
      onTimeout?: () => void;
    }
  ): CancellationToken {
    const request: CancellableRequest = {
      id,
      serverName,
      method,
      startTime: new Date(),
      timeout: options?.timeout,
      abortController: options?.abortController,
      onCancel: options?.onCancel,
    };

    this.requests.set(id, request);

    // Set up timeout if specified
    if (options?.timeout) {
      this.setupTimeout(id, options.timeout, options.onTimeout);
    }

    // Create cancellation token
    const token = new CancellationToken();

    // Link AbortController if provided
    if (options?.abortController) {
      options.abortController.signal.addEventListener('abort', () => {
        if (!token.isCancelled) {
          token.cancel(CancellationReason.UserCancelled);
        }
      });
    }

    // When token is cancelled, cancel the request
    token.onCancelled((reason) => {
      this.cancelRequest(id, reason);
    });

    this.emit('request:registered', { id, serverName, method });

    return token;
  }

  /**
   * Unregister a request (called when completed successfully)
   */
  unregisterRequest(id: string | number): boolean {
    const request = this.requests.get(id);
    if (!request) {
      return false;
    }

    // Clear timeout
    this.clearTimeout(id);

    // Remove request
    this.requests.delete(id);

    this.emit('request:unregistered', { id, serverName: request.serverName });

    return true;
  }

  /**
   * Check if a request is registered
   */
  hasRequest(id: string | number): boolean {
    return this.requests.has(id);
  }

  /**
   * Get a registered request
   */
  getRequest(id: string | number): CancellableRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Get all registered requests
   */
  getAllRequests(): CancellableRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get requests for a specific server
   */
  getServerRequests(serverName: string): CancellableRequest[] {
    return this.getAllRequests().filter(r => r.serverName === serverName);
  }

  // ============ Cancellation ============

  /**
   * Cancel a request
   */
  cancelRequest(
    id: string | number,
    reason: CancellationReason = CancellationReason.UserCancelled
  ): CancellationResult | null {
    const request = this.requests.get(id);
    if (!request) {
      return null;
    }

    const startTime = request.startTime.getTime();
    const duration = Date.now() - startTime;

    // Clear timeout
    this.clearTimeout(id);

    // Abort if AbortController is available
    if (request.abortController && !request.abortController.signal.aborted) {
      request.abortController.abort();
    }

    // Call onCancel callback
    if (request.onCancel) {
      try {
        request.onCancel(reason);
      } catch (error) {
        this.emit('cancel:error', { id, error });
      }
    }

    // Remove request
    this.requests.delete(id);

    const result: CancellationResult = {
      success: true,
      reason,
      requestId: id,
      serverName: request.serverName,
      duration,
    };

    this.emit('request:cancelled', result);

    return result;
  }

  /**
   * Cancel all requests for a server
   */
  cancelServerRequests(
    serverName: string,
    reason: CancellationReason = CancellationReason.Shutdown
  ): CancellationResult[] {
    const requests = this.getServerRequests(serverName);
    const results: CancellationResult[] = [];

    for (const request of requests) {
      const result = this.cancelRequest(request.id, reason);
      if (result) {
        results.push(result);
      }
    }

    this.emit('server:cancelled', { serverName, count: results.length });

    return results;
  }

  /**
   * Cancel all requests
   */
  cancelAll(reason: CancellationReason = CancellationReason.Shutdown): CancellationResult[] {
    const requests = this.getAllRequests();
    const results: CancellationResult[] = [];

    for (const request of requests) {
      const result = this.cancelRequest(request.id, reason);
      if (result) {
        results.push(result);
      }
    }

    this.emit('all:cancelled', { count: results.length });

    return results;
  }

  // ============ Timeout Management ============

  /**
   * Set up a timeout for a request
   */
  private setupTimeout(
    id: string | number,
    timeout: number,
    onTimeout?: () => void
  ): void {
    const timer = setTimeout(() => {
      // Call timeout callback first if provided
      if (onTimeout) {
        try {
          onTimeout();
        } catch (error) {
          this.emit('timeout:error', { id, error });
        }
      }

      // Then cancel the request
      this.cancelRequest(id, CancellationReason.Timeout);
    }, timeout);

    this.timeouts.set(id, timer);
  }

  /**
   * Clear a timeout
   */
  private clearTimeout(id: string | number): void {
    const timer = this.timeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(id);
    }
  }

  // ============ Notifications ============

  /**
   * Create a cancellation notification for a request
   *
   * This can be sent to the server to notify it of cancellation.
   */
  createCancellationNotification(
    requestId: string | number,
    reason?: string
  ): CancelledNotification {
    return {
      requestId,
      ...(reason && { reason }),
    };
  }

  /**
   * Cancel a request and send cancellation notification
   *
   * This is the main method to cancel a request. It:
   * 1. Cancels the request locally
   * 2. Returns the notification that should be sent to the server
   *
   * The caller is responsible for actually sending the notification.
   */
  cancelRequestWithNotification(
    id: string | number,
    reason: CancellationReason = CancellationReason.UserCancelled
  ): { result: CancellationResult | null; notification: CancelledNotification | null } {
    const result = this.cancelRequest(id, reason);

    if (!result) {
      return { result: null, notification: null };
    }

    const notification = this.createCancellationNotification(
      id,
      this.getCancellationReasonString(reason)
    );

    return { result, notification };
  }

  /**
   * Convert CancellationReason to string for notification
   */
  private getCancellationReasonString(reason: CancellationReason): string {
    switch (reason) {
      case CancellationReason.UserCancelled:
        return 'Request cancelled by user';
      case CancellationReason.Timeout:
        return 'Request timed out';
      case CancellationReason.ServerRequest:
        return 'Cancelled at server request';
      case CancellationReason.Shutdown:
        return 'Cancelled due to shutdown';
      case CancellationReason.Error:
        return 'Cancelled due to error';
      default:
        return 'Request cancelled';
    }
  }

  // ============ Statistics ============

  /**
   * Get statistics about cancellations
   */
  getStats() {
    const requests = this.getAllRequests();

    const byServer: Record<string, number> = {};
    requests.forEach(request => {
      byServer[request.serverName] = (byServer[request.serverName] || 0) + 1;
    });

    const withTimeout = requests.filter(r => r.timeout !== undefined).length;
    const withAbort = requests.filter(r => r.abortController !== undefined).length;

    return {
      activeRequests: requests.length,
      byServer,
      withTimeout,
      withAbort,
    };
  }

  /**
   * Get request durations
   */
  getRequestDurations(): Array<{
    id: string | number;
    serverName: string;
    method: string;
    duration: number;
  }> {
    const now = Date.now();

    return this.getAllRequests().map(request => ({
      id: request.id,
      serverName: request.serverName,
      method: request.method,
      duration: now - request.startTime.getTime(),
    }));
  }

  /**
   * Find requests exceeding a duration threshold
   */
  findLongRunningRequests(thresholdMs: number): CancellableRequest[] {
    const now = Date.now();

    return this.getAllRequests().filter(request => {
      const duration = now - request.startTime.getTime();
      return duration > thresholdMs;
    });
  }

  // ============ Cleanup ============

  /**
   * Clean up all requests and timeouts
   */
  cleanup(): void {
    // Clear all timeouts
    this.timeouts.forEach((timer) => clearTimeout(timer));
    this.timeouts.clear();

    // Clear all requests
    this.requests.clear();

    this.emit('cleanup');
  }

  // ============ Utility Methods ============

  /**
   * Create a managed cancellable request
   *
   * This is a high-level helper that:
   * 1. Registers the request
   * 2. Returns token and notification sender
   * 3. Automatically handles cleanup
   *
   * Example usage:
   * ```ts
   * const { token, sendNotification } = manager.createCancellableRequest(
   *   requestId,
   *   'myServer',
   *   'tools/call',
   *   { timeout: 30000 }
   * );
   *
   * // Later, if cancelled:
   * token.cancel(CancellationReason.UserCancelled);
   * const notification = sendNotification();
   * // Send notification to server...
   * ```
   */
  createCancellableRequest(
    id: string | number,
    serverName: string,
    method: string,
    options?: {
      timeout?: number;
      abortController?: AbortController;
      onCancel?: (reason: CancellationReason) => void;
      onTimeout?: () => void;
    }
  ): {
    token: CancellationToken;
    sendNotification: () => CancelledNotification | null;
    cleanup: () => void;
  } {
    const token = this.registerRequest(id, serverName, method, options);

    return {
      token,
      sendNotification: () => {
        if (!token.isCancelled || !token.reason) {
          return null;
        }
        return this.createCancellationNotification(
          id,
          this.getCancellationReasonString(token.reason)
        );
      },
      cleanup: () => {
        this.unregisterRequest(id);
      },
    };
  }
}

// ============ Helper Functions ============

/**
 * Create a cancellation token linked to an AbortController
 */
export function createTokenFromAbortController(
  controller: AbortController
): CancellationToken {
  const token = new CancellationToken();

  controller.signal.addEventListener('abort', () => {
    token.cancel(CancellationReason.UserCancelled);
  });

  return token;
}

/**
 * Create an AbortController that cancels after a timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();

  setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return controller;
}

/**
 * Combine multiple cancellation tokens
 */
export function combineTokens(...tokens: CancellationToken[]): CancellationToken {
  const combined = new CancellationToken();

  for (const token of tokens) {
    if (token.isCancelled) {
      combined.cancel(token.reason || CancellationReason.UserCancelled);
      break;
    }

    token.onCancelled((reason) => {
      combined.cancel(reason);
    });
  }

  return combined;
}

/**
 * Check if an error is a cancellation error
 */
export function isCancellationError(error: unknown): error is CancellationError {
  return error instanceof CancellationError ||
         (error instanceof Error && error.name === 'CancellationError');
}
