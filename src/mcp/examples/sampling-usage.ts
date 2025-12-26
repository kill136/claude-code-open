/**
 * MCP Sampling Usage Examples
 *
 * This file demonstrates how to use the MCP Sampling feature,
 * which allows MCP servers to request LLM completions from the client.
 *
 * Based on MCP Specification 2024-11-05
 */

import {
  McpSamplingManager,
  CreateMessageParams,
  CreateMessageResult,
  createTextContent,
  createSamplingRequest,
  createModelPreferences,
} from '../sampling.js';

// ============ Example 1: Basic Sampling Setup ============

/**
 * Example: Setting up a sampling manager and registering a callback
 */
function example1_BasicSetup() {
  // Create a sampling manager
  const samplingManager = new McpSamplingManager({
    defaultTimeout: 60000, // 60 seconds
    maxConcurrentRequests: 5,
  });

  // Register a callback for a specific server
  samplingManager.registerCallback('my-mcp-server', async (params) => {
    console.log('Received sampling request:', params);

    // TODO: Implement actual LLM call here
    // This is where you would call your LLM (Claude, GPT, etc.)

    // For demonstration, return a mock response
    const result: CreateMessageResult = {
      role: 'assistant',
      content: {
        type: 'text',
        text: 'This is a mock response. Replace with actual LLM call.',
      },
      model: 'claude-3-sonnet-20240229',
      stopReason: 'endTurn',
    };

    return result;
  });

  // Listen to events
  samplingManager.on('request:start', ({ requestId, serverName }) => {
    console.log(`Sampling request started: ${requestId} from ${serverName}`);
  });

  samplingManager.on('request:complete', ({ requestId, result }) => {
    console.log(`Sampling request completed: ${requestId}`, result);
  });

  samplingManager.on('request:error', ({ requestId, error }) => {
    console.error(`Sampling request failed: ${requestId}`, error);
  });

  return samplingManager;
}

// ============ Example 2: Handling Sampling Requests ============

/**
 * Example: Handling a sampling request from an MCP server
 */
async function example2_HandleRequest() {
  const manager = example1_BasicSetup();

  // Simulate receiving a sampling request from the server
  const samplingRequest: CreateMessageParams = {
    messages: [
      createTextContent('What is the capital of France?'),
    ],
    maxTokens: 100,
    systemPrompt: 'You are a helpful geography assistant.',
    temperature: 0.7,
    modelPreferences: createModelPreferences({
      intelligencePriority: 0.8, // Prefer more capable models
      costPriority: 0.3, // Less concerned about cost
      speedPriority: 0.5, // Moderate speed preference
    }),
  };

  try {
    const result = await manager.handleSamplingRequest(
      'my-mcp-server',
      samplingRequest
    );
    console.log('Sampling result:', result);
  } catch (error) {
    console.error('Sampling failed:', error);
  }
}

// ============ Example 3: Creating Sampling Requests ============

/**
 * Example: Creating various types of sampling requests
 */
function example3_CreateRequests() {
  // Simple text request
  const simpleRequest = createSamplingRequest([
    createTextContent('Hello, how are you?'),
  ]);

  // Request with system prompt and options
  const detailedRequest = createSamplingRequest(
    [
      createTextContent('Explain quantum computing in simple terms.'),
    ],
    {
      systemPrompt: 'You are a physics teacher explaining concepts to beginners.',
      maxTokens: 500,
      temperature: 0.5,
      modelPreferences: {
        intelligencePriority: 0.9, // Need a smart model
        costPriority: 0.2,
        speedPriority: 0.3,
      },
      includeContext: 'thisServer',
    }
  );

  // Multi-turn conversation request
  const conversationRequest = createSamplingRequest([
    createTextContent('What is TypeScript?'),
    // In a real scenario, you might have previous assistant responses here
  ]);

  return {
    simpleRequest,
    detailedRequest,
    conversationRequest,
  };
}

// ============ Example 4: Integration with Anthropic Claude ============

/**
 * Example: Integrating sampling with Anthropic's Claude API
 */
async function example4_ClaudeIntegration() {
  const manager = new McpSamplingManager();

  // Register callback that calls Claude API
  manager.registerCallback('my-server', async (params) => {
    // NOTE: This is pseudo-code. You'll need to import @anthropic-ai/sdk
    // and set up authentication properly.

    /*
    import Anthropic from '@anthropic-ai/sdk';

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Convert MCP messages to Claude format
    const messages = params.messages.map(content => ({
      role: 'user', // You might need more sophisticated conversion logic
      content: content.text || '',
    }));

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229', // Choose based on modelPreferences
      max_tokens: params.maxTokens,
      messages: messages,
      system: params.systemPrompt,
      temperature: params.temperature,
    });

    // Convert Claude response to MCP format
    const result: CreateMessageResult = {
      role: 'assistant',
      content: {
        type: 'text',
        text: response.content[0].type === 'text'
          ? response.content[0].text
          : '',
      },
      model: response.model,
      stopReason: response.stop_reason === 'end_turn'
        ? 'endTurn'
        : response.stop_reason,
    };

    return result;
    */

    // Placeholder return for demonstration
    return {
      role: 'assistant' as const,
      content: {
        type: 'text',
        text: 'Replace with actual Claude API call',
      },
      model: 'claude-3-sonnet-20240229',
      stopReason: 'endTurn',
    };
  });
}

// ============ Example 5: Security and Human-in-the-Loop ============

/**
 * Example: Implementing security checks and human review
 */
async function example5_SecurityChecks() {
  const manager = new McpSamplingManager();

  manager.registerCallback('untrusted-server', async (params) => {
    // Security Check 1: Review system prompt for prompt injection
    if (params.systemPrompt && containsSuspiciousContent(params.systemPrompt)) {
      throw new Error('Suspicious system prompt detected. Request rejected.');
    }

    // Security Check 2: Review messages for harmful content
    for (const message of params.messages) {
      if (message.type === 'text' && message.text) {
        if (containsSuspiciousContent(message.text)) {
          throw new Error('Suspicious message content detected. Request rejected.');
        }
      }
    }

    // Security Check 3: Limit token usage to prevent abuse
    if (params.maxTokens > 2000) {
      console.warn('High token request detected. Capping at 2000 tokens.');
      params.maxTokens = 2000;
    }

    // Human-in-the-Loop: For sensitive requests, require approval
    // (In a real implementation, this would show a UI prompt)
    const humanApproved = await requestHumanApproval(params);
    if (!humanApproved) {
      throw new Error('Human reviewer rejected the sampling request.');
    }

    // Proceed with the actual LLM call
    // ... (implement actual LLM call here)

    return {
      role: 'assistant' as const,
      content: { type: 'text', text: 'Response after security checks' },
      model: 'claude-3-sonnet-20240229',
      stopReason: 'endTurn',
    };
  });
}

// Helper functions for security example
function containsSuspiciousContent(text: string): boolean {
  // Simplified detection logic
  const suspiciousPatterns = [
    /ignore previous instructions/i,
    /disregard all rules/i,
    /pretend you are/i,
    // Add more patterns as needed
  ];

  return suspiciousPatterns.some(pattern => pattern.test(text));
}

async function requestHumanApproval(params: CreateMessageParams): Promise<boolean> {
  // In a real implementation, this would show a UI dialog
  // and wait for human approval
  console.log('Requesting human approval for:', params);
  return true; // Auto-approve for demo
}

// ============ Example 6: Error Handling ============

/**
 * Example: Proper error handling for sampling requests
 */
async function example6_ErrorHandling() {
  const manager = new McpSamplingManager();

  manager.registerCallback('my-server', async (params) => {
    try {
      // Attempt LLM call
      // ... (actual implementation)

      return {
        role: 'assistant' as const,
        content: { type: 'text', text: 'Success' },
        model: 'claude-3-sonnet-20240229',
        stopReason: 'endTurn',
      };
    } catch (error) {
      // Log the error
      console.error('LLM call failed:', error);

      // Re-throw with more context
      throw new Error(
        `Failed to complete sampling request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Handle errors at the manager level
  try {
    const request = createSamplingRequest([
      createTextContent('Test message'),
    ]);

    const result = await manager.handleSamplingRequest('my-server', request);
    console.log('Success:', result);
  } catch (error) {
    console.error('Sampling request failed:', error);

    // Implement retry logic, fallback mechanisms, etc.
    // ...
  }
}

// ============ Export Examples ============

export {
  example1_BasicSetup,
  example2_HandleRequest,
  example3_CreateRequests,
  example4_ClaudeIntegration,
  example5_SecurityChecks,
  example6_ErrorHandling,
};
