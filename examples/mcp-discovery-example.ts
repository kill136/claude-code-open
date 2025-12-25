/**
 * MCP Discovery 使用示例
 *
 * 演示如何使用 MCP Discovery API 来发现和管理 MCP 服务器
 */

import { McpDiscovery, createDiscovery, findMcpServers, validateMcpConfig } from '../src/mcp/index.js';
import type { McpServerInfo } from '../src/mcp/index.js';

async function main() {
  console.log('=== MCP Discovery Example ===\n');

  // 1. 创建 discovery 实例
  const discovery = createDiscovery();

  // 2. 发现所有服务器
  console.log('Discovering MCP servers...');
  const servers = await discovery.discover();

  console.log(`\nFound ${servers.length} servers:\n`);

  // 3. 显示每个服务器的信息
  for (const server of servers) {
    console.log(`Server: ${server.name}`);
    console.log(`  Type: ${server.type}`);
    console.log(`  Status: ${server.status}`);
    console.log(`  Source: ${server.source}`);

    if (server.command) {
      console.log(`  Command: ${server.command} ${server.args?.join(' ') || ''}`);
    }

    if (server.url) {
      console.log(`  URL: ${server.url}`);
    }

    console.log(`  Capabilities:`);
    console.log(`    Tools: ${server.capabilities.tools.length}`);
    console.log(`    Resources: ${server.capabilities.resources.length}`);
    console.log(`    Prompts: ${server.capabilities.prompts.length}`);

    if (server.error) {
      console.log(`  Error: ${server.error}`);
    }

    console.log();
  }

  // 4. 手动注册一个新服务器
  console.log('\n=== Registering a custom server ===\n');

  const customServer: McpServerInfo = {
    name: 'custom-server',
    type: 'stdio',
    command: 'node',
    args: ['./my-mcp-server.js'],
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
    status: 'unknown',
    source: 'manual',
  };

  // 验证配置
  if (validateMcpConfig(customServer)) {
    console.log('Configuration is valid');

    try {
      await discovery.register(customServer);
      console.log('Server registered successfully');
    } catch (err) {
      console.error('Failed to register server:', err);
    }
  } else {
    console.log('Invalid server configuration');
  }

  // 5. 在自定义路径搜索服务器
  console.log('\n=== Searching custom paths ===\n');

  const customPaths = [
    '/usr/local/lib/node_modules',
    './node_modules',
  ];

  const foundServers = await findMcpServers(customPaths);
  console.log(`Found ${foundServers.length} servers in custom paths`);

  for (const server of foundServers) {
    console.log(`  - ${server.name} (${server.type})`);
  }

  // 6. 获取所有已注册的服务器
  console.log('\n=== All registered servers ===\n');

  const allServers = discovery.getServers();
  console.log(`Total registered: ${allServers.length}`);

  for (const server of allServers) {
    console.log(`  - ${server.name} (${server.status})`);
  }

  // 7. 注销服务器
  console.log('\n=== Unregistering custom server ===\n');

  const unregistered = await discovery.unregister('custom-server');
  console.log(`Unregister result: ${unregistered ? 'success' : 'failed'}`);
}

// 运行示例
main().catch(console.error);
