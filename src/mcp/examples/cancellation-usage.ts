/**
 * MCP Cancellation Usage Examples
 *
 * This file demonstrates how to integrate the McpCancellationManager
 * with connection management and MCP protocol operations.
 */

import { McpCancellationManager, CancellationReason } from '../cancellation.js';
import { McpConnectionManager } from '../connection.js';
import { McpProtocol } from '../protocol.js';

// ============ Example 1: Basic Request Cancellation ============

async function basicRequestCancellation() {
  const cancellationManager = new McpCancellationManager();
  const connectionManager = new McpConnectionManager();
  const protocol = new McpProtocol();

  // Register a cancellable request
  const requestId = 'req-123';
  const { token, sendNotification, cleanup } = cancellationManager.createCancellableRequest(
    requestId,
    'myServer',
    'tools/call',
    {
      timeout: 30000, // 30 second timeout
      onCancel: (reason) => {
        console.log(`Request ${requestId} cancelled:`, reason);
      },
      onTimeout: () => {
        console.log(`Request ${requestId} timed out`);
      },
    }
  );

  try {
    // Send the request
    const connection = connectionManager.getConnectionByServer('myServer');
    if (!connection?.transport) {
      throw new Error('Server not connected');
    }

    await connection.transport.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: { name: 'myTool', arguments: {} },
    });

    // ... wait for response or cancellation
    token.onCancelled(async (reason) => {
      // Send cancellation notification to server
      const notification = sendNotification();
      if (notification && connection.transport) {
        await protocol.sendCancelledNotification(connection.transport, notification);
      }
    });

    // Manually cancel if needed
    // token.cancel(CancellationReason.UserCancelled);
  } finally {
    // Clean up when done (success or error)
    cleanup();
  }
}

// ============ Example 2: With AbortController ============

async function withAbortController() {
  const cancellationManager = new McpCancellationManager();
  const abortController = new AbortController();

  const requestId = 'req-456';
  const { token, cleanup } = cancellationManager.createCancellableRequest(
    requestId,
    'myServer',
    'tools/call',
    {
      timeout: 30000,
      abortController, // Link to AbortController
      onCancel: (reason) => {
        console.log('Request cancelled:', reason);
      },
    }
  );

  // External code can abort
  // abortController.abort();
  // This will trigger token.cancel(CancellationReason.UserCancelled)

  // Or use the token directly
  // token.cancel(CancellationReason.UserCancelled);
  // This will NOT trigger abortController.abort()

  cleanup();
}

// ============ Example 3: Batch Cancellation ============

async function batchCancellation() {
  const cancellationManager = new McpCancellationManager();
  const protocol = new McpProtocol();
  const connectionManager = new McpConnectionManager();

  // Register multiple requests
  for (let i = 0; i < 10; i++) {
    cancellationManager.registerRequest(`req-${i}`, 'myServer', 'tools/call', {
      timeout: 30000,
    });
  }

  // Cancel all requests for a server
  const results = cancellationManager.cancelServerRequests(
    'myServer',
    CancellationReason.Shutdown
  );

  console.log(`Cancelled ${results.length} requests`);

  // Send notifications for all cancelled requests
  const connection = connectionManager.getConnectionByServer('myServer');
  if (connection?.transport) {
    for (const result of results) {
      const notification = cancellationManager.createCancellationNotification(
        result.requestId,
        'Server shutdown'
      );
      await protocol.sendCancelledNotification(connection.transport, notification);
    }
  }
}

// ============ Example 4: Integration with Connection Manager ============

/**
 * Enhanced connection manager with cancellation support
 */
class CancellableConnectionManager extends McpConnectionManager {
  private cancellationManager = new McpCancellationManager();

  async sendCancellable(
    connectionId: string,
    message: any,
    options?: {
      timeout?: number;
      abortController?: AbortController;
    }
  ): Promise<any> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const requestId = message.id || `req-${Date.now()}`;
    const { token, sendNotification, cleanup } = this.cancellationManager.createCancellableRequest(
      requestId,
      connection.serverName,
      message.method || 'unknown',
      {
        timeout: options?.timeout,
        abortController: options?.abortController,
        onCancel: async (reason) => {
          console.log(`Request ${requestId} cancelled:`, reason);

          // Send cancellation notification
          const notification = sendNotification();
          if (notification && connection.transport) {
            const protocol = new McpProtocol();
            await protocol.sendCancelledNotification(connection.transport, notification);
          }
        },
      }
    );

    try {
      // Register a listener for the token
      const cancelPromise = new Promise<never>((_, reject) => {
        token.onCancelled((reason) => {
          reject(new Error(`Request cancelled: ${reason}`));
        });
      });

      // Race between request and cancellation
      const result = await Promise.race([
        this.send(connectionId, { ...message, id: requestId }),
        cancelPromise,
      ]);

      return result;
    } finally {
      cleanup();
    }
  }

  /**
   * Shutdown with cancellation support
   */
  async shutdownWithCancellation(connectionId: string): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return;
    }

    // Cancel all pending requests for this server
    const results = this.cancellationManager.cancelServerRequests(
      connection.serverName,
      CancellationReason.Shutdown
    );

    console.log(`Cancelled ${results.length} pending requests during shutdown`);

    // Then disconnect
    await this.disconnect(connectionId);
  }

  /**
   * Get cancellation statistics
   */
  getCancellationStats() {
    return this.cancellationManager.getStats();
  }
}

// ============ Example 5: Monitoring and Debugging ============

function setupCancellationMonitoring() {
  const cancellationManager = new McpCancellationManager();

  // Listen to cancellation events
  cancellationManager.on('request:registered', ({ id, serverName, method }) => {
    console.log(`[REGISTER] ${id}: ${serverName}.${method}`);
  });

  cancellationManager.on('request:cancelled', (result) => {
    console.log(
      `[CANCEL] ${result.requestId}: ${result.reason} (duration: ${result.duration}ms)`
    );
  });

  cancellationManager.on('request:unregistered', ({ id, serverName }) => {
    console.log(`[UNREGISTER] ${id}: ${serverName}`);
  });

  cancellationManager.on('timeout:error', ({ id, error }) => {
    console.error(`[TIMEOUT ERROR] ${id}:`, error);
  });

  // Periodic stats
  setInterval(() => {
    const stats = cancellationManager.getStats();
    console.log('[STATS]', stats);

    // Find long-running requests
    const longRunning = cancellationManager.findLongRunningRequests(60000); // 60s
    if (longRunning.length > 0) {
      console.warn(`[WARNING] ${longRunning.length} requests running >60s`);
    }
  }, 10000);

  return cancellationManager;
}

// Export examples
export {
  basicRequestCancellation,
  withAbortController,
  batchCancellation,
  CancellableConnectionManager,
  setupCancellationMonitoring,
};
