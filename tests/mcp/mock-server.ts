/**
 * Mock MCP Server for Testing
 * Provides a simple MCP server implementation for integration tests
 */

import { EventEmitter } from 'events';
import type { McpMessage } from '../../src/mcp/connection.js';

export interface MockServerOptions {
  name: string;
  supportsTools?: boolean;
  supportsResources?: boolean;
  supportsPrompts?: boolean;
  supportsRoots?: boolean;
  supportsSampling?: boolean;
  responseDelay?: number;
  failOnMethod?: string;
}

export class MockMcpServer extends EventEmitter {
  public name: string;
  public capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    roots?: boolean;
    sampling?: boolean;
  };
  public responseDelay: number;
  public failOnMethod?: string;
  private initialized: boolean = false;
  private messageIdCounter: number = 1;

  // Mock data
  private tools = [
    {
      name: 'test_tool',
      description: 'A test tool for MCP integration testing',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Test message' },
        },
        required: ['message'],
      },
    },
    {
      name: 'echo',
      description: 'Echo back the input',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    },
  ];

  private resources = [
    {
      uri: 'test://resource/1',
      name: 'Test Resource 1',
      description: 'First test resource',
      mimeType: 'text/plain',
    },
    {
      uri: 'test://resource/2',
      name: 'Test Resource 2',
      description: 'Second test resource',
      mimeType: 'application/json',
    },
  ];

  private prompts = [
    {
      name: 'test_prompt',
      description: 'A test prompt',
      arguments: [
        {
          name: 'topic',
          description: 'The topic to discuss',
          required: true,
        },
      ],
    },
  ];

  private roots = [
    {
      uri: 'file:///test/root1',
      name: 'Test Root 1',
    },
    {
      uri: 'file:///test/root2',
      name: 'Test Root 2',
    },
  ];

  constructor(options: MockServerOptions) {
    super();
    this.name = options.name;
    this.capabilities = {
      tools: options.supportsTools ?? true,
      resources: options.supportsResources ?? true,
      prompts: options.supportsPrompts ?? true,
      roots: options.supportsRoots ?? true,
      sampling: options.supportsSampling ?? true,
    };
    this.responseDelay = options.responseDelay ?? 0;
    this.failOnMethod = options.failOnMethod;
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: McpMessage): Promise<McpMessage> {
    // Simulate response delay
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    // Check if we should fail for this method
    if (this.failOnMethod && message.method === this.failOnMethod) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: `Simulated failure for method: ${this.failOnMethod}`,
        },
      };
    }

    // Handle different methods
    switch (message.method) {
      case 'initialize':
        return this.handleInitialize(message);
      case 'tools/list':
        return this.handleToolsList(message);
      case 'tools/call':
        return this.handleToolsCall(message);
      case 'resources/list':
        return this.handleResourcesList(message);
      case 'resources/read':
        return this.handleResourcesRead(message);
      case 'prompts/list':
        return this.handlePromptsList(message);
      case 'prompts/get':
        return this.handlePromptsGet(message);
      case 'roots/list':
        return this.handleRootsList(message);
      case 'ping':
        return this.handlePing(message);
      case 'sampling/createMessage':
        return this.handleSamplingCreateMessage(message);
      default:
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          },
        };
    }
  }

  private handleInitialize(message: McpMessage): McpMessage {
    this.initialized = true;

    const capabilities: Record<string, unknown> = {};
    if (this.capabilities.tools) {
      capabilities.tools = {};
    }
    if (this.capabilities.resources) {
      capabilities.resources = {};
    }
    if (this.capabilities.prompts) {
      capabilities.prompts = {};
    }
    if (this.capabilities.roots) {
      capabilities.roots = { listChanged: true };
    }
    if (this.capabilities.sampling) {
      capabilities.sampling = {};
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities,
        serverInfo: {
          name: this.name,
          version: '1.0.0-test',
        },
      },
    };
  }

  private handleToolsList(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: this.tools,
      },
    };
  }

  private handleToolsCall(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    const params = message.params as any;
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === 'test_tool') {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Tool executed with message: ${args.message}`,
            },
          ],
        },
      };
    }

    if (toolName === 'echo') {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: args.text || '',
            },
          ],
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32602,
        message: `Unknown tool: ${toolName}`,
      },
    };
  }

  private handleResourcesList(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        resources: this.resources,
      },
    };
  }

  private handleResourcesRead(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    const params = message.params as any;
    const uri = params?.uri;

    const resource = this.resources.find((r) => r.uri === uri);
    if (!resource) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: `Resource not found: ${uri}`,
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: `Content of ${resource.name}`,
          },
        ],
      },
    };
  }

  private handlePromptsList(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        prompts: this.prompts,
      },
    };
  }

  private handlePromptsGet(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    const params = message.params as any;
    const name = params?.name;
    const args = params?.arguments || {};

    const prompt = this.prompts.find((p) => p.name === name);
    if (!prompt) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: `Prompt not found: ${name}`,
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Test prompt about: ${args.topic || 'unknown'}`,
            },
          },
        ],
      },
    };
  }

  private handleRootsList(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        roots: this.roots,
      },
    };
  }

  private handlePing(message: McpMessage): McpMessage {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {},
    };
  }

  private handleSamplingCreateMessage(message: McpMessage): McpMessage {
    if (!this.initialized) {
      return this.createNotInitializedError(message.id);
    }

    const params = message.params as any;
    const messages = params?.messages || [];

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        role: 'assistant',
        content: {
          type: 'text',
          text: `Mock sampling response to: ${messages.length} messages`,
        },
        model: 'mock-model',
        stopReason: 'end_turn',
      },
    };
  }

  private createNotInitializedError(id?: string | number): McpMessage {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32002,
        message: 'Server not initialized. Call initialize first.',
      },
    };
  }

  /**
   * Reset server state
   */
  reset(): void {
    this.initialized = false;
    this.messageIdCounter = 1;
  }

  /**
   * Add custom tool for testing
   */
  addTool(tool: any): void {
    this.tools.push(tool);
  }

  /**
   * Add custom resource for testing
   */
  addResource(resource: any): void {
    this.resources.push(resource);
  }
}

/**
 * Create a mock stdio MCP server (for subprocess communication)
 */
export class MockStdioServer extends MockMcpServer {
  constructor(options: MockServerOptions) {
    super(options);
  }

  /**
   * Start stdio server (simulates subprocess)
   */
  start(): void {
    // Listen to stdin
    process.stdin.on('data', async (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const message: McpMessage = JSON.parse(line);
          const response = await this.handleMessage(message);
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (err) {
          const errorResponse: McpMessage = {
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error',
            },
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });
  }
}
