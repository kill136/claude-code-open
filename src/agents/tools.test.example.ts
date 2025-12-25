/**
 * 代理工具过滤示例
 * 演示如何使用工具过滤、验证和统计功能
 */

import {
  AgentToolFilter,
  ToolUsageTracker,
  createToolFilter,
  mergeToolConfigs,
  AGENT_TOOL_CONFIGS,
  globalUsageTracker,
} from './tools.js';

// ============ 示例 1: 创建工具过滤器 ============

console.log('=== 示例 1: 创建工具过滤器 ===\n');

// 使用预定义配置创建过滤器
const exploreFilter = createToolFilter('Explore');

console.log('Explore 代理允许的工具:');
const availableTools = exploreFilter.getAvailableTools();
console.log(availableTools.map(t => t.name).join(', '));
console.log();

// 检查工具是否允许
console.log('Read 工具是否允许:', exploreFilter.isAllowed('Read'));
console.log('Write 工具是否允许:', exploreFilter.isAllowed('Write'));
console.log();

// ============ 示例 2: 工具调用验证 ============

console.log('=== 示例 2: 工具调用验证 ===\n');

// 验证只读命令
const readCommand = { command: 'git status' };
const readValidation = exploreFilter.validateToolCall('Bash', readCommand);
console.log('验证只读命令:', readValidation);
console.log();

// 验证写入命令（应该失败）
const writeCommand = { command: 'git commit -m "test"' };
const writeValidation = exploreFilter.validateToolCall('Bash', writeCommand);
console.log('验证写入命令:', writeValidation);
console.log();

// ============ 示例 3: 自定义配置 ============

console.log('=== 示例 3: 自定义配置 ===\n');

// 创建自定义工具过滤器
const customFilter = createToolFilter('general-purpose', {
  // 只允许部分工具
  allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'],
  // 添加工具别名
  toolAliases: {
    'search': 'Grep',
    'list': 'Glob',
  },
  // 设置权限级别
  permissionLevel: 'readonly',
});

console.log('自定义过滤器允许的工具:');
console.log(customFilter.getAvailableTools().map(t => t.name).join(', '));
console.log();

// 测试别名解析
console.log('解析别名 "search":', customFilter.resolveToolAlias('search'));
console.log('解析别名 "list":', customFilter.resolveToolAlias('list'));
console.log();

// ============ 示例 4: 配置合并 ============

console.log('=== 示例 4: 配置合并 ===\n');

const baseConfig = AGENT_TOOL_CONFIGS['claude-code-guide'];
const overrideConfig = {
  allowedTools: ['Read', 'Grep'] as string[],
  disallowedTools: ['WebFetch'],
};

const mergedConfig = mergeToolConfigs(baseConfig, overrideConfig);
console.log('基础配置允许的工具:', baseConfig.allowedTools);
console.log('合并后允许的工具:', mergedConfig.allowedTools);
console.log('合并后禁用的工具:', mergedConfig.disallowedTools);
console.log();

// ============ 示例 5: 工具使用跟踪 ============

console.log('=== 示例 5: 工具使用跟踪 ===\n');

const tracker = new ToolUsageTracker();

// 模拟一些工具调用
tracker.record('agent-1', 'Explore', 'Read', { file_path: '/test.ts' }, { success: true, output: 'file content' }, 150);
tracker.record('agent-1', 'Explore', 'Grep', { pattern: 'test' }, { success: true, output: '5 matches' }, 250);
tracker.record('agent-2', 'Plan', 'Bash', { command: 'npm test' }, { success: false, error: 'Tests failed' }, 3000);
tracker.record('agent-1', 'Explore', 'Read', { file_path: '/other.ts' }, { success: true, output: 'other content' }, 120);

// 获取统计信息
const stats = tracker.getUsageStats();
console.log('总调用次数:', stats.totalCalls);
console.log('成功调用:', stats.successfulCalls);
console.log('失败调用:', stats.failedCalls);
console.log('按工具统计:', stats.callsByTool);
console.log('按代理统计:', stats.callsByAgent);
console.log('平均执行时间:', stats.averageDurationMs.toFixed(2) + 'ms');
console.log();

// 获取特定代理的统计
const agent1Stats = tracker.getUsageStats('agent-1');
console.log('agent-1 的调用次数:', agent1Stats.totalCalls);
console.log();

// ============ 示例 6: 异常检测 ============

console.log('=== 示例 6: 异常检测 ===\n');

// 模拟大量错误调用来触发异常检测
for (let i = 0; i < 20; i++) {
  tracker.record('agent-3', 'Plan', 'Bash', { command: 'failing-cmd' }, { success: false, error: 'Command failed' }, 100);
}

const anomalies = tracker.detectAnomalies();
console.log('检测到的异常:', anomalies.length);
for (const anomaly of anomalies) {
  console.log(`- [${anomaly.severity.toUpperCase()}] ${anomaly.type}: ${anomaly.description}`);
}
console.log();

// ============ 示例 7: 生成报告 ============

console.log('=== 示例 7: 生成报告 ===\n');

// 生成文本格式报告
console.log('--- 文本格式报告 ---');
const textReport = tracker.generateReport({
  format: 'text',
  groupByTool: true,
  groupByAgent: true,
});
console.log(textReport);
console.log();

// 生成 Markdown 格式报告
console.log('--- Markdown 格式报告 ---');
const markdownReport = tracker.generateReport({
  format: 'markdown',
  groupByTool: true,
  includeDetails: false,
});
console.log(markdownReport);
console.log();

// 生成 JSON 格式报告
console.log('--- JSON 格式报告（截断） ---');
const jsonReport = tracker.generateReport({
  format: 'json',
  includeDetails: true,
});
console.log(jsonReport.substring(0, 500) + '...');
console.log();

// ============ 示例 8: 全局跟踪器 ============

console.log('=== 示例 8: 全局跟踪器 ===\n');

// 使用全局跟踪器
globalUsageTracker.record('global-agent', 'general-purpose', 'WebSearch', { query: 'test' }, { success: true, output: 'results' }, 500);

const globalStats = globalUsageTracker.getUsageStats();
console.log('全局跟踪器记录数:', globalStats.totalCalls);
console.log();

// ============ 示例 9: 代码审查代理配置 ============

console.log('=== 示例 9: 代码审查代理配置 ===\n');

const reviewerFilter = createToolFilter('code-reviewer');

// 验证允许的 git 命令
const gitDiff = reviewerFilter.validateToolCall('Bash', { command: 'git diff HEAD' });
console.log('git diff 验证:', gitDiff);

// 验证不允许的 git 命令
const gitCommit = reviewerFilter.validateToolCall('Bash', { command: 'git commit -m "fix"' });
console.log('git commit 验证:', gitCommit);
console.log();

// ============ 示例 10: 清理旧记录 ============

console.log('=== 示例 10: 清理旧记录 ===\n');

const beforeCount = tracker.getAllRecords().length;
const cleared = tracker.clearOldRecords(3600000); // 清除1小时以前的记录
const afterCount = tracker.getAllRecords().length;

console.log('清理前记录数:', beforeCount);
console.log('清除的记录数:', cleared);
console.log('清理后记录数:', afterCount);
console.log();

console.log('=== 所有示例完成 ===');
