/**
 * 遥测系统使用示例
 * 演示如何在 Claude Code CLI 中集成和使用遥测功能
 */

import {
  initTelemetry,
  startSession,
  endSession,
  trackEvent,
  trackMessage,
  trackToolCall,
  trackCommand,
  trackTokenUsage,
  trackError,
  trackErrorReport,
  trackPerformance,
  enableErrorReporting,
  configureBatchUpload,
  getMetrics,
  getCurrentSessionMetrics,
  getPerformanceStats,
  getErrorStats,
  isTelemetryEnabled,
  flushTelemetry,
  cleanup,
} from './index.js';

// ============================================================
// 示例 1: 基础会话跟踪
// ============================================================
export function exampleBasicSession() {
  console.log('=== 示例 1: 基础会话跟踪 ===\n');

  // 初始化遥测
  initTelemetry();

  // 检查是否启用
  if (!isTelemetryEnabled()) {
    console.log('遥测已禁用');
    return;
  }

  // 开始新会话
  const sessionId = `session-${Date.now()}`;
  startSession(sessionId, 'claude-sonnet-4');
  console.log('会话已开始:', sessionId);

  // 模拟用户消息
  trackMessage('user');
  console.log('跟踪用户消息');

  // 模拟助手消息
  trackMessage('assistant');
  console.log('跟踪助手消息');

  // 模拟 Token 使用
  trackTokenUsage(1000, 500, 0.015);
  console.log('跟踪 Token 使用: 输入=1000, 输出=500, 成本=$0.015');

  // 结束会话
  endSession();
  console.log('会话已结束\n');
}

// ============================================================
// 示例 2: 工具调用跟踪
// ============================================================
export async function exampleToolTracking() {
  console.log('=== 示例 2: 工具调用跟踪 ===\n');

  initTelemetry();
  startSession(`session-${Date.now()}`, 'claude-opus-4');

  // 模拟 Bash 工具调用
  const startTime = Date.now();
  try {
    // 模拟工具执行
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 跟踪成功的工具调用
    const duration = Date.now() - startTime;
    trackToolCall('Bash', true, duration);
    console.log(`Bash 工具调用成功: ${duration}ms`);
  } catch (error) {
    // 跟踪失败的工具调用
    const duration = Date.now() - startTime;
    trackToolCall('Bash', false, duration);
    console.log(`Bash 工具调用失败: ${duration}ms`);
  }

  // 模拟其他工具调用
  const tools = ['Read', 'Write', 'Edit', 'Grep', 'Glob'];
  for (const tool of tools) {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
    trackToolCall(tool, Math.random() > 0.1, Date.now() - start);
    console.log(`${tool} 工具调用完成`);
  }

  endSession();
  console.log('');
}

// ============================================================
// 示例 3: 命令使用跟踪
// ============================================================
export async function exampleCommandTracking() {
  console.log('=== 示例 3: 命令使用跟踪 ===\n');

  initTelemetry();
  startSession(`session-${Date.now()}`, 'claude-sonnet-4');

  // 模拟斜杠命令
  const commands = ['/test', '/review-pr', '/debug', '/optimize', '/refactor'];

  for (const command of commands) {
    const startTime = Date.now();

    try {
      // 模拟命令执行
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 150));

      // 跟踪成功的命令
      const duration = Date.now() - startTime;
      trackCommand(command, true, duration);
      console.log(`命令 ${command} 执行成功: ${duration}ms`);
    } catch (error) {
      // 跟踪失败的命令
      const duration = Date.now() - startTime;
      trackCommand(command, false, duration);
      console.log(`命令 ${command} 执行失败: ${duration}ms`);
    }
  }

  endSession();
  console.log('');
}

// ============================================================
// 示例 4: 错误跟踪
// ============================================================
export function exampleErrorTracking() {
  console.log('=== 示例 4: 错误跟踪 ===\n');

  initTelemetry();
  startSession(`session-${Date.now()}`, 'claude-sonnet-4');

  // 基础错误跟踪
  trackError('FileNotFoundError', { filePath: '/path/to/file.ts' });
  console.log('跟踪简单错误');

  // 启用详细错误报告（需要用户同意）
  enableErrorReporting();
  console.log('错误报告已启用');

  try {
    // 模拟抛出错误
    throw new Error('示例错误：无法解析文件');
  } catch (error) {
    if (error instanceof Error) {
      // 跟踪详细错误报告
      trackErrorReport(error, {
        operation: 'file_parse',
        filePath: '/path/to/file.ts',
        lineNumber: 42,
      });
      console.log('跟踪详细错误报告:', error.message);
    }
  }

  endSession();
  console.log('');
}

// ============================================================
// 示例 5: 性能追踪
// ============================================================
export async function examplePerformanceTracking() {
  console.log('=== 示例 5: 性能追踪 ===\n');

  initTelemetry();
  startSession(`session-${Date.now()}`, 'claude-opus-4');

  // 追踪各种操作的性能
  const operations = [
    { name: 'file_read', minMs: 10, maxMs: 50 },
    { name: 'code_parse', minMs: 100, maxMs: 300 },
    { name: 'api_call', minMs: 200, maxMs: 1000 },
    { name: 'cache_lookup', minMs: 1, maxMs: 10 },
  ];

  for (const op of operations) {
    const startTime = Date.now();

    // 模拟操作
    const delay = Math.random() * (op.maxMs - op.minMs) + op.minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const duration = Date.now() - startTime;
    const success = Math.random() > 0.05; // 95% 成功率

    trackPerformance(op.name, duration, success, {
      size: Math.floor(Math.random() * 10000),
    });

    console.log(
      `性能追踪: ${op.name} - ${duration.toFixed(2)}ms (${success ? '成功' : '失败'})`
    );
  }

  endSession();
  console.log('');
}

// ============================================================
// 示例 6: 批量上报配置
// ============================================================
export async function exampleBatchUpload() {
  console.log('=== 示例 6: 批量上报配置 ===\n');

  initTelemetry();

  // 配置批量上报
  configureBatchUpload(
    true, // 启用批量上报
    'https://telemetry.example.com/api/events', // 端点
    3600000, // 每小时上报一次
    100 // 每批最多 100 个事件
  );
  console.log('批量上报已配置');

  // 生成一些事件
  startSession(`session-${Date.now()}`, 'claude-sonnet-4');

  for (let i = 0; i < 10; i++) {
    trackEvent('test_event', { index: i, timestamp: Date.now() });
  }

  console.log('生成了 10 个测试事件');

  // 手动触发上报
  console.log('手动触发批量上报...');
  await flushTelemetry();
  console.log('批量上报完成');

  endSession();
  console.log('');
}

// ============================================================
// 示例 7: 查看统计数据
// ============================================================
export function exampleViewStats() {
  console.log('=== 示例 7: 查看统计数据 ===\n');

  // 获取聚合指标
  const metrics = getMetrics();
  if (metrics) {
    console.log('聚合指标:');
    console.log('  总会话数:', metrics.totalSessions);
    console.log('  总消息数:', metrics.totalMessages);
    console.log('  总 Token 数:', metrics.totalTokens);
    console.log('  总成本:', `$${metrics.totalCost.toFixed(4)}`);
    console.log('  总错误数:', metrics.totalErrors);
    console.log(
      '  平均会话时长:',
      `${(metrics.averageSessionDuration / 1000).toFixed(2)}s`
    );
    console.log('\n  工具使用:');
    for (const [tool, count] of Object.entries(metrics.toolUsage).slice(0, 5)) {
      console.log(`    ${tool}: ${count} 次`);
    }
    console.log('\n  模型使用:');
    for (const [model, count] of Object.entries(metrics.modelUsage)) {
      console.log(`    ${model}: ${count} 次`);
    }
  } else {
    console.log('暂无聚合指标');
  }

  console.log('');

  // 获取当前会话指标
  const session = getCurrentSessionMetrics();
  if (session) {
    console.log('当前会话:');
    console.log('  会话 ID:', session.sessionId);
    console.log('  消息数:', session.messageCount);
    console.log('  Token 使用:', session.tokenUsage);
    console.log('  工具调用:', session.toolCalls);
    console.log('  错误数:', session.errors);
  } else {
    console.log('当前无活跃会话');
  }

  console.log('');

  // 获取性能统计
  const perfStats = getPerformanceStats();
  if (perfStats) {
    console.log('性能统计:');
    console.log('  总操作数:', perfStats.overall.totalOperations);
    console.log('  平均时长:', `${perfStats.overall.avgDuration.toFixed(2)}ms`);
    console.log('  成功率:', `${perfStats.overall.successRate.toFixed(2)}%`);

    console.log('\n  各操作性能（前 5 个）:');
    const ops = Object.entries(perfStats.byOperation).slice(0, 5);
    for (const [op, statsRaw] of ops) {
      const stats = statsRaw as { count: number; avgDuration: number; successRate: number };
      console.log(`    ${op}:`);
      console.log(`      调用次数: ${stats.count}`);
      console.log(`      平均时长: ${stats.avgDuration.toFixed(2)}ms`);
      console.log(`      成功率: ${stats.successRate.toFixed(2)}%`);
    }
  } else {
    console.log('暂无性能统计');
  }

  console.log('');

  // 获取错误统计
  const errorStats = getErrorStats();
  if (errorStats) {
    console.log('错误统计:');
    console.log('  总错误数:', errorStats.total);
    console.log('\n  错误类型:');
    for (const [type, count] of Object.entries(errorStats.byType).slice(0, 5)) {
      console.log(`    ${type}: ${count} 次`);
    }

    if (errorStats.recent.length > 0) {
      console.log('\n  最近错误:');
      for (const error of errorStats.recent.slice(0, 3)) {
        console.log(`    [${error.errorType}] ${error.errorMessage}`);
      }
    }
  } else {
    console.log('暂无错误统计');
  }

  console.log('');
}

// ============================================================
// 示例 8: 完整工作流
// ============================================================
export async function exampleCompleteWorkflow() {
  console.log('=== 示例 8: 完整工作流 ===\n');

  // 1. 初始化
  initTelemetry();
  console.log('1. 遥测系统已初始化');

  // 2. 开始会话
  const sessionId = `session-${Date.now()}`;
  startSession(sessionId, 'claude-sonnet-4');
  console.log('2. 会话已开始:', sessionId);

  // 3. 模拟用户交互
  console.log('3. 模拟用户交互...');
  trackMessage('user');
  trackMessage('assistant');

  // 4. 执行工具调用
  console.log('4. 执行工具调用...');
  const tools = ['Read', 'Grep', 'Edit', 'Bash'];
  for (const tool of tools) {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    trackToolCall(tool, true, Date.now() - start);
  }

  // 5. 执行命令
  console.log('5. 执行命令...');
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 150));
  trackCommand('/test', true, Date.now() - start);

  // 6. 跟踪 Token 使用
  console.log('6. 跟踪 Token 使用...');
  trackTokenUsage(2000, 1000, 0.03);

  // 7. 模拟错误
  console.log('7. 模拟错误...');
  try {
    throw new Error('示例错误');
  } catch (error) {
    if (error instanceof Error) {
      trackError(error.name, { message: error.message });
    }
  }

  // 8. 结束会话
  console.log('8. 结束会话');
  endSession();

  // 9. 查看统计
  console.log('9. 查看统计数据:');
  const metrics = getMetrics();
  if (metrics) {
    console.log('   - 总会话数:', metrics.totalSessions);
    console.log('   - 总消息数:', metrics.totalMessages);
    console.log('   - 总成本:', `$${metrics.totalCost.toFixed(4)}`);
  }

  console.log('');
}

// ============================================================
// 主函数：运行所有示例
// ============================================================
export async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║    Claude Code CLI - 遥测系统使用示例        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    exampleBasicSession();
    await exampleToolTracking();
    await exampleCommandTracking();
    exampleErrorTracking();
    await examplePerformanceTracking();
    await exampleBatchUpload();
    exampleViewStats();
    await exampleCompleteWorkflow();

    console.log('✅ 所有示例执行完成\n');
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  } finally {
    // 清理
    cleanup();
    console.log('🧹 清理完成\n');
  }
}

// 如果直接运行此文件，取消下面的注释
// runAllExamples().catch(console.error);
