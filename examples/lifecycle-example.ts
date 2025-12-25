/**
 * 生命周期事件系统使用示例
 * 展示如何监听和响应 CLI 生命周期事件
 */

import { onLifecycleEvent, emitLifecycleEvent, getLifecycleHistory } from '../src/lifecycle/index.js';

// 示例 1: 监听单个生命周期事件
onLifecycleEvent('cli_entry', (event, data) => {
  console.log(`[Lifecycle] CLI 启动: ${event}`);
});

// 示例 2: 监听 Action 级别事件并执行自定义逻辑
onLifecycleEvent('action_handler_start', async (event, data) => {
  console.log(`[Lifecycle] Action 处理开始: ${event}`);
  // 可以在这里添加自定义逻辑，例如：
  // - 性能监控
  // - 日志记录
  // - 统计收集
});

// 示例 3: 监听工具加载事件
onLifecycleEvent('action_tools_loaded', (event, data) => {
  console.log(`[Lifecycle] 工具已加载:`, data);
  // data 包含 { toolCount: number }
});

// 示例 4: 监听多个相关事件
const setupEvents = [
  'action_before_setup',
  'action_after_setup',
  'action_commands_loaded',
  'action_after_plugins_init',
] as const;

setupEvents.forEach(eventName => {
  onLifecycleEvent(eventName, (event) => {
    console.log(`[Setup Phase] ${event} 已触发`);
  });
});

// 示例 5: 监听 CLI 完成事件并执行清理
onLifecycleEvent('cli_after_main_complete', async (event) => {
  console.log(`[Lifecycle] CLI 执行完成: ${event}`);

  // 获取事件历史
  const history = getLifecycleHistory();
  console.log(`\n生命周期事件统计:`);
  console.log(`  总事件数: ${history.length}`);

  // 统计各类事件
  const eventCounts = new Map<string, number>();
  history.forEach(({ event }) => {
    eventCounts.set(event, (eventCounts.get(event) || 0) + 1);
  });

  console.log(`\n事件详情:`);
  eventCounts.forEach((count, event) => {
    console.log(`  ${event}: ${count}次`);
  });

  // 计算执行时间
  if (history.length >= 2) {
    const firstEvent = history[0];
    const lastEvent = history[history.length - 1];
    const duration = lastEvent.timestamp - firstEvent.timestamp;
    console.log(`\n总执行时间: ${duration}ms`);
  }
});

// 示例 6: 异步事件处理器
onLifecycleEvent('action_mcp_configs_loaded', async (event, data) => {
  console.log(`[Lifecycle] MCP 配置已加载`);

  // 可以执行异步操作，例如：
  // await validateMcpServers();
  // await warmupConnections();

  // 事件处理器会等待异步操作完成
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`[Lifecycle] MCP 异步初始化完成`);
});

// 示例 7: 事件处理器中的错误处理
onLifecycleEvent('action_after_hooks', async (event) => {
  try {
    // 某些可能失败的操作
    console.log(`[Lifecycle] Hooks 已执行完成`);
  } catch (error) {
    // 生命周期管理器会捕获错误并记录
    // 但不会中断其他处理器的执行
    console.error(`[Lifecycle] 错误:`, error);
  }
});

/**
 * 在实际应用中，你可以将这些监听器放在：
 *
 * 1. 插件系统中 - 允许插件响应生命周期事件
 * 2. 配置文件中 - 通过配置注册自定义处理器
 * 3. Hooks 系统中 - 与现有 Hook 系统集成
 * 4. 监控系统中 - 收集性能和使用统计
 */

// 示例 8: 与 Hooks 系统集成
import { registerHook } from '../src/hooks/index.js';

// 当工具加载完成时，可以注册额外的 Hook
onLifecycleEvent('action_tools_loaded', () => {
  // 注册一个 PreToolUse Hook
  registerHook('PreToolUse', {
    type: 'command',
    command: 'echo',
    args: ['Tool about to execute: $TOOL_NAME'],
    blocking: false,
  });
});

console.log('生命周期事件监听器已注册');
console.log('运行 CLI 命令以查看事件触发');
