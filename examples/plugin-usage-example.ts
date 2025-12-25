/**
 * Claude Code Plugin System Usage Example
 *
 * This file demonstrates how to use the enhanced plugin system.
 */

import {
  pluginManager,
  pluginToolExecutor,
  pluginCommandExecutor,
  createPluginManager,
  pluginHelper
} from '../src/plugins/index.js';

async function main() {
  console.log('=== Claude Code Plugin System Demo ===\n');

  // 1. 发现插件
  console.log('1. Discovering plugins...');
  const discovered = await pluginManager.discover();
  console.log(`Found ${discovered.length} plugins:`);
  for (const state of discovered) {
    console.log(`  - ${state.metadata.name}@${state.metadata.version}`);
    console.log(`    ${state.metadata.description || 'No description'}`);
    if (state.dependencies.length > 0) {
      console.log(`    Dependencies: ${state.dependencies.join(', ')}`);
    }
  }
  console.log();

  // 2. 加载所有插件
  console.log('2. Loading all plugins...');
  await pluginManager.loadAll({ enableHotReload: false });
  const loaded = pluginManager.getLoadedPlugins();
  console.log(`Loaded ${loaded.length} plugins`);
  console.log();

  // 3. 获取插件状态
  console.log('3. Plugin states:');
  const states = pluginManager.getPluginStates();
  for (const state of states) {
    console.log(`  - ${state.metadata.name}`);
    console.log(`    Enabled: ${state.enabled}`);
    console.log(`    Loaded: ${state.loaded}`);
    console.log(`    Initialized: ${state.initialized}`);
    console.log(`    Activated: ${state.activated}`);
    if (state.error) {
      console.log(`    Error: ${state.error}`);
    }
  }
  console.log();

  // 4. 获取所有工具
  console.log('4. Available tools:');
  const tools = pluginManager.getTools();
  console.log(`  Total: ${tools.length} tools`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }
  console.log();

  // 5. 获取所有命令
  console.log('5. Available commands:');
  const commands = pluginManager.getCommands();
  console.log(`  Total: ${commands.length} commands`);
  for (const command of commands) {
    console.log(`  - ${command.name}: ${command.description}`);
    if (command.usage) {
      console.log(`    Usage: ${command.usage}`);
    }
  }
  console.log();

  // 6. 执行工具（如果有 hello 工具）
  if (pluginToolExecutor.hasTool('hello')) {
    console.log('6. Executing hello tool...');
    const result = await pluginToolExecutor.execute('hello', {
      name: 'Claude',
      formal: false
    });
    if (result.success) {
      console.log(`  Result: ${result.output}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
    console.log();
  }

  // 7. 执行命令（如果有 hello 命令）
  const helloCommand = commands.find(c => c.name === 'hello');
  if (helloCommand) {
    console.log('7. Executing hello command...');
    try {
      await pluginCommandExecutor.execute('hello', ['World', '--formal']);
    } catch (err) {
      console.log(`  Error: ${err}`);
    }
    console.log();
  }

  // 8. 执行钩子
  console.log('8. Executing hooks...');
  const message = { role: 'user', content: 'Hello!' };
  const processed = await pluginManager.executeHook('beforeMessage', message);
  console.log(`  Message processed by ${pluginManager.getLoadedPlugins().length} plugins`);
  console.log();

  // 9. 获取插件配置
  console.log('9. Plugin configurations:');
  for (const plugin of loaded) {
    const context = pluginManager.getPluginContext(plugin.metadata.name);
    if (context) {
      const config = context.config.getAll();
      console.log(`  ${plugin.metadata.name}:`, config);
    }
  }
  console.log();

  // 10. 监听插件事件
  console.log('10. Setting up event listeners...');
  pluginManager.on('plugin:loaded', (name, plugin) => {
    console.log(`  Event: Plugin ${name} loaded`);
  });
  pluginManager.on('plugin:error', (name, error) => {
    console.log(`  Event: Plugin ${name} error: ${error}`);
  });
  pluginManager.on('tool:registered', (pluginName, tool) => {
    console.log(`  Event: Tool ${tool.name} registered by ${pluginName}`);
  });
  console.log('  Event listeners registered');
  console.log();

  // 11. 使用插件助手
  console.log('11. Using plugin helper...');
  const templateCode = pluginHelper.createTemplate('my-new-plugin', {
    author: 'John Doe',
    description: 'My awesome plugin',
    version: '1.0.0'
  });
  console.log('  Generated plugin template:');
  console.log(templateCode.split('\n').slice(0, 20).join('\n'));
  console.log('  ...(truncated)');
  console.log();

  // 12. 验证元数据
  console.log('12. Validating plugin metadata...');
  const validation = pluginHelper.validateMetadata({
    name: 'test-plugin',
    version: '1.0.0',
    engines: {
      node: '>=18.0.0',
      'claude-code': '^2.0.0'
    }
  });
  console.log(`  Valid: ${validation.valid}`);
  if (!validation.valid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  console.log();

  // 13. 创建独立的插件管理器实例
  console.log('13. Creating separate plugin manager...');
  const customManager = createPluginManager('2.0.76');
  console.log('  Custom manager created');
  console.log();

  // 14. 热重载示例（如果有插件）
  if (loaded.length > 0) {
    const firstPlugin = loaded[0].metadata.name;
    console.log(`14. Hot reload example for ${firstPlugin}...`);
    console.log('  Enabling hot reload...');
    pluginManager.enableHotReload(firstPlugin);
    console.log('  Hot reload enabled (will auto-reload on file changes)');
    console.log('  Disabling hot reload...');
    pluginManager.disableHotReload(firstPlugin);
    console.log('  Hot reload disabled');
    console.log();
  }

  // 15. 清理
  console.log('15. Cleanup...');
  await pluginManager.cleanup();
  console.log('  All plugins unloaded and resources cleaned up');
  console.log();

  console.log('=== Demo Complete ===');
}

// 错误处理
main().catch(err => {
  console.error('Error in demo:', err);
  process.exit(1);
});
