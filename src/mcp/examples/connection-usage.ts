/**
 * Example usage of MCP Connection Manager
 *
 * This file demonstrates how to use the McpConnectionManager to manage
 * connections to MCP servers with various transport types.
 */

import {
  McpConnectionManager,
  createConnectionManager,
  McpServerInfo,
  McpConnection,
  McpMessage,
} from '../connection.js';

// ============ Example 1: Stdio Connection ============

async function exampleStdioConnection() {
  console.log('Example 1: Stdio Connection');

  const manager = createConnectionManager({
    timeout: 30000,
    maxRetries: 3,
    heartbeatInterval: 30000,
  });

  // Define server info
  const server: McpServerInfo = {
    name: 'my-stdio-server',
    type: 'stdio',
    command: 'node',
    args: ['./mcp-server.js'],
    env: {
      NODE_ENV: 'production',
    },
  };

  try {
    // Connect to server
    const connection = await manager.connect(server);
    console.log('Connected:', connection.id);

    // Listen to events
    manager.on('message:received', (connectionId, message) => {
      console.log('Received message:', message);
    });

    manager.on('connection:error', (connection, error) => {
      console.error('Connection error:', error);
    });

    // Send a message
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const response = await manager.send(connection.id, message);
    console.log('Response:', response);

    // Disconnect
    await manager.disconnect(connection.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.dispose();
  }
}

// ============ Example 2: HTTP Connection ============

async function exampleHttpConnection() {
  console.log('Example 2: HTTP Connection');

  const manager = createConnectionManager();

  const server: McpServerInfo = {
    name: 'my-http-server',
    type: 'http',
    url: 'http://localhost:3000',
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      type: 'bearer',
      token: 'your-api-token',
    },
  };

  try {
    const connection = await manager.connect(server);
    console.log('Connected:', connection.id);

    // Send with retry
    const message: McpMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/list',
      params: {},
    };

    const response = await manager.sendWithRetry(connection.id, message);
    console.log('Response:', response);

    await manager.disconnect(connection.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.dispose();
  }
}

// ============ Example 3: Multiple Connections ============

async function exampleMultipleConnections() {
  console.log('Example 3: Multiple Connections');

  const manager = createConnectionManager({
    poolSize: 10,
  });

  const servers: McpServerInfo[] = [
    {
      name: 'server-1',
      type: 'stdio',
      command: 'python',
      args: ['server1.py'],
    },
    {
      name: 'server-2',
      type: 'http',
      url: 'http://localhost:3001',
    },
    {
      name: 'server-3',
      type: 'sse',
      url: 'http://localhost:3002',
    },
  ];

  try {
    // Connect to all servers
    const connections = await Promise.all(
      servers.map((server) => manager.connect(server))
    );

    console.log(`Connected to ${connections.length} servers`);

    // Get all connections
    const allConnections = manager.getAllConnections();
    console.log('Total connections:', allConnections.length);

    // Send messages to each connection
    for (const connection of connections) {
      const message: McpMessage = {
        jsonrpc: '2.0',
        id: Math.random(),
        method: 'ping',
        params: {},
      };

      try {
        await manager.send(connection.id, message);
        console.log(`Pinged ${connection.serverName}`);
      } catch (error) {
        console.error(`Failed to ping ${connection.serverName}:`, error);
      }
    }

    // Disconnect all
    await manager.disconnectAll();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.dispose();
  }
}

// ============ Example 4: Event Handling ============

async function exampleEventHandling() {
  console.log('Example 4: Event Handling');

  const manager = createConnectionManager();

  // Set up event listeners
  manager.on('connection:established', (connection: McpConnection) => {
    console.log(`✓ Connection established: ${connection.serverName}`);
  });

  manager.on('connection:closed', (connection: McpConnection) => {
    console.log(`✗ Connection closed: ${connection.serverName}`);
  });

  manager.on('connection:error', (connection: McpConnection, error: Error) => {
    console.error(`✗ Connection error for ${connection.serverName}:`, error.message);
  });

  manager.on('connection:reconnecting', (connection: McpConnection) => {
    console.log(`↻ Reconnecting to ${connection.serverName}...`);
  });

  manager.on('heartbeat:failed', (connectionId: string, error: Error) => {
    console.warn(`♥ Heartbeat failed for ${connectionId}:`, error.message);
  });

  manager.on('message:sent', (connectionId: string, message: McpMessage) => {
    console.log(`→ Sent message (${message.method}) to ${connectionId}`);
  });

  manager.on('message:received', (connectionId: string, message: McpMessage) => {
    console.log(`← Received message from ${connectionId}`);
  });

  const server: McpServerInfo = {
    name: 'event-demo-server',
    type: 'stdio',
    command: 'node',
    args: ['./server.js'],
  };

  try {
    const connection = await manager.connect(server);

    // Send some messages to trigger events
    await manager.send(connection.id, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    // Wait a bit for events
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await manager.disconnect(connection.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.dispose();
  }
}

// ============ Example 5: Retry and Error Handling ============

async function exampleRetryAndErrorHandling() {
  console.log('Example 5: Retry and Error Handling');

  const manager = createConnectionManager({
    maxRetries: 5,
    reconnectDelayBase: 500,
    timeout: 10000,
  });

  const server: McpServerInfo = {
    name: 'unreliable-server',
    type: 'http',
    url: 'http://localhost:9999', // Server might not exist
  };

  try {
    // This will retry multiple times before failing
    const connection = await manager.connect(server);
    console.log('Connected successfully');

    // Send with retry
    const response = await manager.sendWithRetry(connection.id, {
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
      params: {},
    });

    console.log('Response:', response);
  } catch (error) {
    console.error('Failed after retries:', error);
  } finally {
    await manager.dispose();
  }
}

// ============ Main ============

async function main() {
  console.log('='.repeat(60));
  console.log('MCP Connection Manager Examples');
  console.log('='.repeat(60));
  console.log();

  // Uncomment the example you want to run:

  // await exampleStdioConnection();
  // await exampleHttpConnection();
  // await exampleMultipleConnections();
  // await exampleEventHandling();
  // await exampleRetryAndErrorHandling();

  console.log();
  console.log('Examples completed!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleStdioConnection,
  exampleHttpConnection,
  exampleMultipleConnections,
  exampleEventHandling,
  exampleRetryAndErrorHandling,
};
