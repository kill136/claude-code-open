/**
 * MCP 适配器使用示例
 * 展示如何使用 MCP 适配器将 MCP 服务器集成到 Claude Code
 */

import { createMcpAdapter, McpAdapter } from './adapter.js';
import { toolRegistry } from '../tools/base.js';
import { registerMcpServer } from '../tools/mcp.js';
import type { McpServerConfig } from '../types/index.js';

// ============ 示例 1: 基本设置 ============

async function example1_BasicSetup() {
  console.log('=== Example 1: Basic Setup ===\n');

  // 1. 注册 MCP 服务器
  const serverConfig: McpServerConfig = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  };

  registerMcpServer('filesystem', serverConfig);

  // 2. 创建适配器
  const adapter = createMcpAdapter(toolRegistry);

  // 3. 同步服务器（注册工具、资源等）
  await adapter.syncServer('filesystem');

  console.log('MCP server synchronized successfully\n');
}

// ============ 示例 2: 注册工具 ============

async function example2_RegisterTools() {
  console.log('=== Example 2: Register Tools ===\n');

  const adapter = createMcpAdapter(toolRegistry);

  // 监听工具注册事件
  adapter.onToolsChanged((serverName, tools) => {
    console.log(`Tools registered from ${serverName}:`);
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
  });

  // 注册多个服务器的工具
  await adapter.registerMcpTools('filesystem');

  // 查看所有适配的工具
  const allTools = adapter.getAllAdaptedTools();
  console.log(`\nTotal adapted tools: ${allTools.length}\n`);
}

// ============ 示例 3: 使用资源 ============

async function example3_UseResources() {
  console.log('=== Example 3: Use Resources ===\n');

  const adapter = createMcpAdapter(toolRegistry);

  // 适配资源
  const resources = await adapter.adaptResources('filesystem');

  console.log('Available resources:');
  for (const resource of resources) {
    console.log(`  - ${resource.mcpResource.name}: ${resource.mcpResource.uri}`);
  }

  // 获取资源上下文
  if (resources.length > 0) {
    const firstResource = resources[0];
    const context = await adapter.getResourceContext(
      'filesystem',
      firstResource.mcpResource.uri
    );
    console.log(`\nResource content preview: ${context.content.slice(0, 100)}...\n`);
  }
}

// ============ 示例 4: 执行工具 ============

async function example4_ExecuteTools() {
  console.log('=== Example 4: Execute Tools ===\n');

  const adapter = createMcpAdapter(toolRegistry);

  // 注册工具
  await adapter.registerMcpTools('filesystem');

  // 执行 MCP 工具
  const result = await adapter.executeToolProxy('mcp__filesystem__list_directory', {
    path: '/tmp',
  });

  if (result.success) {
    console.log('Tool execution result:');
    console.log(result.output);
  } else {
    console.error('Tool execution failed:', result.error);
  }

  console.log('');
}

// ============ 示例 5: 批量同步 ============

async function example5_SyncMultipleServers() {
  console.log('=== Example 5: Sync Multiple Servers ===\n');

  // 注册多个 MCP 服务器
  registerMcpServer('filesystem', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  });

  registerMcpServer('github', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  });

  const adapter = createMcpAdapter(toolRegistry);

  // 监听同步事件
  adapter.on('server:synced', (serverName) => {
    console.log(`✓ Server synced: ${serverName}`);
  });

  adapter.on('sync:error', (serverName, error) => {
    console.error(`✗ Sync error for ${serverName}:`, error);
  });

  // 同步所有服务器
  await adapter.syncAll();

  console.log('\nAll servers synchronized\n');
}

// ============ 示例 6: 事件监听 ============

async function example6_EventListening() {
  console.log('=== Example 6: Event Listening ===\n');

  const adapter = createMcpAdapter(toolRegistry);

  // 监听工具变化
  const unsubscribeTools = adapter.onToolsChanged((serverName, tools) => {
    console.log(`[Event] Tools changed for ${serverName}: ${tools.length} tools`);
  });

  // 监听资源变化
  const unsubscribeResources = adapter.onResourcesChanged((serverName, resources) => {
    console.log(`[Event] Resources changed for ${serverName}: ${resources.length} resources`);
  });

  // 同步服务器（会触发事件）
  await adapter.syncServer('filesystem');

  // 清理监听器
  unsubscribeTools();
  unsubscribeResources();

  console.log('\nEvent listeners cleaned up\n');
}

// ============ 示例 7: 查询适配器状态 ============

async function example7_QueryAdapterState() {
  console.log('=== Example 7: Query Adapter State ===\n');

  const adapter = createMcpAdapter(toolRegistry);

  // 同步服务器
  await adapter.syncServer('filesystem');

  // 查询工具适配器
  const toolAdapters = adapter.getServerToolAdapters('filesystem');
  console.log(`Tool adapters for filesystem: ${toolAdapters.length}`);

  for (const adapter of toolAdapters) {
    console.log(`  - MCP: ${adapter.mcpTool.name} → Claude: ${adapter.claudeTool.name}`);
  }

  // 查询资源适配器
  const resourceAdapters = adapter.getServerResourceAdapters('filesystem');
  console.log(`\nResource adapters for filesystem: ${resourceAdapters.length}`);

  for (const adapter of resourceAdapters) {
    console.log(`  - ${adapter.mcpResource.name} (${adapter.mcpResource.uri})`);
  }

  console.log('');
}

// ============ 示例 8: 与插件系统集成 ============

async function example8_PluginIntegration() {
  console.log('=== Example 8: Plugin Integration ===\n');

  // MCP 适配器可以作为插件的一部分使用
  // 插件可以在 activate 时注册 MCP 服务器

  const adapter = createMcpAdapter(toolRegistry);

  // 模拟插件激活
  const pluginActivate = async () => {
    // 注册插件特定的 MCP 服务器
    registerMcpServer('my-plugin-server', {
      type: 'stdio',
      command: 'my-mcp-server',
    });

    // 同步到 Claude Code
    await adapter.syncServer('my-plugin-server');

    console.log('Plugin MCP server activated');
  };

  // 模拟插件停用
  const pluginDeactivate = async () => {
    // 注销工具
    await adapter.unregisterMcpTools('my-plugin-server');

    console.log('Plugin MCP server deactivated');
  };

  // 注意：实际使用时需要处理错误
  try {
    // await pluginActivate();
    // await pluginDeactivate();
  } catch (err) {
    console.error('Plugin integration error:', err);
  }

  console.log('');
}

// ============ 运行所有示例 ============

async function runAllExamples() {
  try {
    await example1_BasicSetup();
    await example2_RegisterTools();
    await example3_UseResources();
    await example4_ExecuteTools();
    await example5_SyncMultipleServers();
    await example6_EventListening();
    await example7_QueryAdapterState();
    await example8_PluginIntegration();

    console.log('=== All examples completed ===');
  } catch (err) {
    console.error('Error running examples:', err);
  }
}

// 如果直接运行此文件，执行所有示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_BasicSetup,
  example2_RegisterTools,
  example3_UseResources,
  example4_ExecuteTools,
  example5_SyncMultipleServers,
  example6_EventListening,
  example7_QueryAdapterState,
  example8_PluginIntegration,
  runAllExamples,
};
