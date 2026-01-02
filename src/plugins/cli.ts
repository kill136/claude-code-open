/**
 * 插件系统 CLI 命令
 * 提供插件的安装、卸载、启用、禁用、列表等功能
 */

import { Command } from 'commander';
import { pluginManager } from './index.js';

/**
 * 创建插件 CLI 命令
 */
export function createPluginCommand(): Command {
  const pluginCommand = new Command('plugin');
  pluginCommand.description('Manage Claude Code plugins');

  // claude plugin validate <path> - 官方命令，验证插件清单
  pluginCommand
    .command('validate <path>')
    .description('Validate a plugin or marketplace manifest')
    .action(async (pluginPath) => {
      await validatePlugin(pluginPath);
    });

  // claude plugin marketplace - 官方命令，管理市场
  pluginCommand
    .command('marketplace')
    .description('Manage Claude Code marketplaces')
    .action(async () => {
      await manageMarketplace();
    });

  // claude plugin list - 额外命令，保留（虽然官方没有，但很有用）
  pluginCommand
    .command('list')
    .alias('ls')
    .description('List all installed plugins')
    .option('-a, --all', 'Show all plugins including disabled ones')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      await listPlugins(options);
    });

  // claude plugin install <plugin> - 官方命令
  pluginCommand
    .command('install <plugin>')
    .alias('i')
    .description('Install a plugin from available marketplaces')
    .option('--no-auto-load', 'Do not automatically load the plugin after installation')
    .option('--enable-hot-reload', 'Enable hot reload for the plugin')
    .action(async (plugin, options) => {
      await installPlugin(plugin, options);
    });

  // claude plugin uninstall <plugin> - 官方命令（主命令是 uninstall，别名是 remove）
  pluginCommand
    .command('uninstall <plugin>')
    .alias('remove')
    .description('Uninstall an installed plugin')
    .action(async (plugin) => {
      await removePlugin(plugin);
    });

  // claude plugin enable <plugin> - 官方命令
  pluginCommand
    .command('enable <plugin>')
    .description('Enable a disabled plugin')
    .action(async (plugin) => {
      await enablePlugin(plugin);
    });

  // claude plugin disable <plugin> - 官方命令
  pluginCommand
    .command('disable <plugin>')
    .description('Disable an enabled plugin')
    .action(async (plugin) => {
      await disablePlugin(plugin);
    });

  // claude plugin update <plugin> - 官方命令
  pluginCommand
    .command('update <plugin>')
    .description('Update a plugin to the latest version')
    .action(async (plugin) => {
      await updatePlugin(plugin);
    });

  // claude plugin info <plugin> - 额外命令，保留（虽然官方没有，但很有用）
  pluginCommand
    .command('info <plugin>')
    .description('Show detailed information about a plugin')
    .action(async (plugin) => {
      await showPluginInfo(plugin);
    });

  return pluginCommand;
}

/**
 * 列出所有插件
 */
async function listPlugins(options: { all?: boolean; verbose?: boolean }): Promise<void> {
  await pluginManager.discover();
  const plugins = pluginManager.getPluginStates();

  const filteredPlugins = options.all
    ? plugins
    : plugins.filter(p => p.enabled);

  if (filteredPlugins.length === 0) {
    console.log('No plugins found.');
    return;
  }

  console.log(`\n${'Name'.padEnd(30)} ${'Version'.padEnd(12)} ${'Status'.padEnd(10)} ${'Type'.padEnd(10)}`);
  console.log('─'.repeat(70));

  for (const plugin of filteredPlugins) {
    const name = plugin.metadata.name.padEnd(30);
    const version = plugin.metadata.version.padEnd(12);
    const status = plugin.loaded
      ? '✓ Loaded'.padEnd(10)
      : plugin.enabled
      ? '○ Enabled'.padEnd(10)
      : '✗ Disabled'.padEnd(10);
    const type = (plugin.path === '<inline>' ? 'Inline' : 'File').padEnd(10);

    console.log(`${name} ${version} ${status} ${type}`);

    if (options.verbose) {
      if (plugin.metadata.description) {
        console.log(`  Description: ${plugin.metadata.description}`);
      }
      if (plugin.path !== '<inline>') {
        console.log(`  Path: ${plugin.path}`);
      }
      if (plugin.dependencies.length > 0) {
        console.log(`  Dependencies: ${plugin.dependencies.join(', ')}`);
      }
      if (plugin.error) {
        console.log(`  Error: ${plugin.error}`);
      }
      console.log('');
    }
  }

  console.log(`\nTotal: ${filteredPlugins.length} plugin(s)`);
}

/**
 * 安装插件
 */
async function installPlugin(
  pluginPath: string,
  options: { autoLoad?: boolean; enableHotReload?: boolean }
): Promise<void> {
  try {
    console.log(`Installing plugin from ${pluginPath}...`);

    const state = await pluginManager.install(pluginPath, {
      autoLoad: options.autoLoad,
      enableHotReload: options.enableHotReload,
    });

    console.log(`✓ Successfully installed plugin: ${state.metadata.name}@${state.metadata.version}`);

    if (state.loaded) {
      console.log(`  Plugin is loaded and ready to use.`);
    }

    if (options.enableHotReload) {
      console.log(`  Hot reload is enabled.`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to install plugin: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 移除插件
 */
async function removePlugin(pluginName: string): Promise<void> {
  try {
    console.log(`Removing plugin ${pluginName}...`);

    const success = await pluginManager.uninstall(pluginName);

    if (success) {
      console.log(`✓ Successfully removed plugin: ${pluginName}`);
    } else {
      console.error(`✗ Plugin not found: ${pluginName}`);
      process.exit(1);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to remove plugin: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 启用插件
 */
async function enablePlugin(pluginName: string): Promise<void> {
  try {
    console.log(`Enabling plugin ${pluginName}...`);

    const success = await pluginManager.setEnabled(pluginName, true);

    if (success) {
      console.log(`✓ Successfully enabled plugin: ${pluginName}`);
    } else {
      console.error(`✗ Plugin not found: ${pluginName}`);
      process.exit(1);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to enable plugin: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 禁用插件
 */
async function disablePlugin(pluginName: string): Promise<void> {
  try {
    console.log(`Disabling plugin ${pluginName}...`);

    const success = await pluginManager.setEnabled(pluginName, false);

    if (success) {
      console.log(`✓ Successfully disabled plugin: ${pluginName}`);
    } else {
      console.error(`✗ Plugin not found: ${pluginName}`);
      process.exit(1);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to disable plugin: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 更新插件
 */
async function updatePlugin(pluginName: string): Promise<void> {
  try {
    console.log(`Updating plugin ${pluginName}...`);

    const state = pluginManager.getPluginState(pluginName);
    if (!state) {
      console.error(`✗ Plugin not found: ${pluginName}`);
      process.exit(1);
      return;
    }

    if (state.path === '<inline>') {
      console.error(`✗ Cannot update inline plugin: ${pluginName}`);
      process.exit(1);
      return;
    }

    // TODO: 实现从远程源更新插件的逻辑
    // 目前只能重新加载本地插件
    const success = await pluginManager.reload(pluginName);

    if (success) {
      console.log(`✓ Plugin reloaded: ${pluginName}`);
      console.log(`  Note: To update from remote source, please use 'claude plugin install <source>' to reinstall.`);
    } else {
      console.error(`✗ Failed to reload plugin: ${pluginName}`);
      process.exit(1);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to update plugin: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 显示插件详细信息
 */
async function showPluginInfo(pluginName: string): Promise<void> {
  await pluginManager.discover();
  const state = pluginManager.getPluginState(pluginName);

  if (!state) {
    console.error(`✗ Plugin not found: ${pluginName}`);
    process.exit(1);
    return;
  }

  const metadata = state.metadata;

  console.log(`\nPlugin: ${metadata.name}`);
  console.log('─'.repeat(60));
  console.log(`Version:      ${metadata.version}`);
  console.log(`Description:  ${metadata.description || 'N/A'}`);
  console.log(`Author:       ${metadata.author || 'N/A'}`);
  console.log(`License:      ${metadata.license || 'N/A'}`);
  console.log(`Homepage:     ${metadata.homepage || 'N/A'}`);
  console.log(`Status:       ${state.loaded ? 'Loaded' : state.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Type:         ${state.path === '<inline>' ? 'Inline' : 'File'}`);

  if (state.path !== '<inline>') {
    console.log(`Path:         ${state.path}`);
  }

  if (metadata.engines) {
    console.log(`\nEngines:`);
    if (metadata.engines.node) {
      console.log(`  Node.js:    ${metadata.engines.node}`);
    }
    if (metadata.engines['claude-code']) {
      console.log(`  Claude Code: ${metadata.engines['claude-code']}`);
    }
  }

  if (metadata.dependencies && Object.keys(metadata.dependencies).length > 0) {
    console.log(`\nDependencies:`);
    for (const [name, version] of Object.entries(metadata.dependencies)) {
      console.log(`  ${name}: ${version}`);
    }
  }

  if (state.loaded) {
    const tools = pluginManager.getPluginTools(pluginName);
    const commands = pluginManager.getPluginCommands(pluginName);
    const skills = pluginManager.getPluginSkills(pluginName);
    const hooks = pluginManager.getPluginHooks(pluginName);

    if (tools.length > 0) {
      console.log(`\nTools (${tools.length}):`);
      for (const tool of tools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    if (commands.length > 0) {
      console.log(`\nCommands (${commands.length}):`);
      for (const cmd of commands) {
        console.log(`  - ${cmd.name}: ${cmd.description}`);
      }
    }

    if (skills.length > 0) {
      console.log(`\nSkills (${skills.length}):`);
      for (const skill of skills) {
        console.log(`  - /${skill.name}: ${skill.description}`);
      }
    }

    if (hooks.length > 0) {
      console.log(`\nHooks (${hooks.length}):`);
      const hookTypes = new Set(hooks.map(h => h.type));
      for (const type of Array.from(hookTypes)) {
        const count = hooks.filter(h => h.type === type).length;
        console.log(`  - ${type}: ${count} handler(s)`);
      }
    }
  }

  if (state.error) {
    console.log(`\n✗ Error: ${state.error}`);
  }

  console.log('');
}

/**
 * 管理市场（Marketplace）
 */
async function manageMarketplace(): Promise<void> {
  console.log('\n📦 Claude Code Plugin Marketplace\n');
  console.log('The plugin marketplace allows you to discover and install plugins from');
  console.log('official and community sources.\n');
  console.log('Available commands:\n');
  console.log('  claude plugin marketplace add <url>      Add a marketplace source');
  console.log('  claude plugin marketplace list           List configured marketplaces');
  console.log('  claude plugin marketplace remove <name>  Remove a marketplace source');
  console.log('  claude plugin marketplace search <term>  Search for plugins');
  console.log('  claude plugin marketplace sync           Sync marketplace catalog\n');
  console.log('Note: This is an educational implementation. Full marketplace');
  console.log('functionality requires official Anthropic infrastructure.\n');
  console.log('Current status: Framework implemented, awaiting official marketplace API.\n');
}

/**
 * 验证插件
 */
async function validatePlugin(pluginPath: string): Promise<void> {
  try {
    console.log(`Validating plugin at ${pluginPath}...`);

    const fs = await import('fs');
    const path = await import('path');

    // 检查路径是否存在
    if (!fs.existsSync(pluginPath)) {
      console.error(`✗ Path does not exist: ${pluginPath}`);
      process.exit(1);
      return;
    }

    // 如果是文件，检查是否是 JSON
    const stats = fs.statSync(pluginPath);
    let manifestPath: string;

    if (stats.isFile()) {
      manifestPath = pluginPath;
    } else if (stats.isDirectory()) {
      // 在目录中查找 package.json
      manifestPath = path.join(pluginPath, 'package.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(`✗ package.json not found in directory: ${pluginPath}`);
        process.exit(1);
        return;
      }
    } else {
      console.error(`✗ Invalid path: ${pluginPath}`);
      process.exit(1);
      return;
    }

    // 读取并解析 manifest
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    let manifest: any;

    try {
      manifest = JSON.parse(manifestContent);
    } catch (err) {
      console.error(`✗ Invalid JSON in manifest file`);
      process.exit(1);
      return;
    }

    // 验证必需字段
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Missing or invalid "name" field');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Missing or invalid "version" field');
    }

    if (!manifest.description) {
      warnings.push('Missing "description" field');
    }

    if (!manifest.main) {
      warnings.push('Missing "main" field (defaults to "index.js")');
    }

    if (!manifest.engines) {
      warnings.push('Missing "engines" field (recommended)');
    }

    // 检查主文件是否存在
    if (stats.isDirectory()) {
      const mainFile = path.join(pluginPath, manifest.main || 'index.js');
      if (!fs.existsSync(mainFile)) {
        errors.push(`Main file not found: ${manifest.main || 'index.js'}`);
      }
    }

    // 输出结果
    if (errors.length > 0) {
      console.log(`\n✗ Validation failed with ${errors.length} error(s):\n`);
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
      if (warnings.length > 0) {
        console.log(`\n⚠ Warnings (${warnings.length}):\n`);
        for (const warning of warnings) {
          console.log(`  - ${warning}`);
        }
      }
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log(`\n✓ Validation passed with ${warnings.length} warning(s):\n`);
      for (const warning of warnings) {
        console.log(`  - ${warning}`);
      }
    } else {
      console.log(`\n✓ Validation passed: Plugin is valid`);
      console.log(`  Name:    ${manifest.name}`);
      console.log(`  Version: ${manifest.version}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Validation error: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * 默认导出
 */
export default createPluginCommand;
