/**
 * Agent Monitor 使用示例
 * 展示如何使用监控系统跟踪代理执行
 */

import {
  AgentMonitor,
  AlertManager,
  PerformanceAnalyzer,
  createMonitoringSystem,
  generateDashboardData,
  exportMetrics,
  type MonitorConfig,
} from './monitor.js';

// ==================== 示例 1: 基础监控 ====================

async function basicMonitoringExample() {
  console.log('=== Basic Monitoring Example ===\n');

  // 创建监控器
  const monitor = new AgentMonitor({
    collectMetrics: true,
    persistMetrics: true,
    alertOnTimeout: true,
    timeoutThreshold: 60000, // 60秒
    alertOnCostThreshold: true,
    costThreshold: 0.5, // $0.50
  });

  // 监听事件
  monitor.on('agent:start', (data) => {
    console.log(`✓ Agent started: ${data.agentId} (${data.type})`);
  });

  monitor.on('agent:complete', (data) => {
    console.log(`✓ Agent completed: ${data.agentId} (${data.status}) - ${data.duration}ms`);
  });

  monitor.on('agent:error', (data) => {
    console.log(`✗ Agent error: ${data.agentId} - ${data.error.message}`);
  });

  monitor.on('alert:triggered', (alert) => {
    console.log(`⚠ Alert: [${alert.severity}] ${alert.message}`);
  });

  // 开始跟踪代理
  const agentId = 'agent-123';
  monitor.startTracking(agentId, 'general-purpose', 'Research task');

  // 模拟执行过程
  await new Promise(resolve => setTimeout(resolve, 100));

  // 记录 API 调用
  monitor.recordApiCall(agentId, true, 1200);

  // 记录 Token 使用
  monitor.recordTokens(agentId, 500, 300);

  // 记录成本
  monitor.recordCost(agentId, 0.015);

  // 记录工具调用
  const toolCallId = monitor.startToolCall(agentId, 'Read', 1024);
  await new Promise(resolve => setTimeout(resolve, 50));
  monitor.endToolCall(agentId, toolCallId, true, undefined, 2048);

  // 另一个工具调用
  monitor.recordToolCall(agentId, 'Bash', 500, true);

  // 停止跟踪
  monitor.stopTracking(agentId, 'completed');

  // 获取指标
  const metrics = monitor.getMetrics(agentId);
  console.log('\nMetrics:', JSON.stringify(metrics, null, 2));

  // 获取聚合统计
  const stats = monitor.getAggregatedStats();
  console.log('\nAggregated Stats:', {
    totalAgents: stats.totalAgents,
    totalCost: `$${stats.totalCost.toFixed(4)}`,
    avgDuration: `${stats.avgDuration.toFixed(0)}ms`,
    successRate: `${(stats.successRate * 100).toFixed(1)}%`,
  });
}

// ==================== 示例 2: 告警管理 ====================

async function alertManagementExample() {
  console.log('\n\n=== Alert Management Example ===\n');

  const { monitor, alertManager } = createMonitoringSystem({
    alertOnTimeout: true,
    timeoutThreshold: 5000, // 5秒
    alertOnCostThreshold: true,
    costThreshold: 0.1, // $0.10
    alertOnErrorRate: true,
    errorRateThreshold: 0.2, // 20%
  });

  // 监听告警
  monitor.on('alert:triggered', (alert) => {
    console.log(`\n🚨 ALERT [${alert.severity.toUpperCase()}]`);
    console.log(`   Type: ${alert.type}`);
    console.log(`   Message: ${alert.message}`);
    console.log(`   Agent: ${alert.agentId}`);
    console.log(`   Time: ${alert.timestamp.toISOString()}`);
  });

  // 模拟代理执行并触发告警
  const agentId = 'alert-test-agent';
  monitor.startTracking(agentId, 'Explore', 'Test alert triggers');

  // 触发成本告警
  monitor.recordCost(agentId, 0.15);

  // 触发错误率告警
  monitor.recordApiCall(agentId, false);
  monitor.recordError(agentId, new Error('Test error 1'), 'execution');
  monitor.recordApiCall(agentId, false);
  monitor.recordError(agentId, new Error('Test error 2'), 'execution');
  monitor.recordApiCall(agentId, true);

  monitor.stopTracking(agentId, 'failed');

  // 获取活跃告警
  const activeAlerts = alertManager.getActiveAlerts();
  console.log(`\n📊 Active Alerts: ${activeAlerts.length}`);
  activeAlerts.forEach((alert, idx) => {
    console.log(`  ${idx + 1}. [${alert.type}] ${alert.message}`);
  });

  // 确认告警
  if (activeAlerts.length > 0) {
    alertManager.acknowledge(activeAlerts[0].id);
    console.log(`\n✓ Acknowledged alert: ${activeAlerts[0].id}`);
  }

  // 清除已确认的告警
  const cleared = alertManager.clearAcknowledged();
  console.log(`✓ Cleared ${cleared} acknowledged alerts`);
}

// ==================== 示例 3: 性能分析 ====================

async function performanceAnalysisExample() {
  console.log('\n\n=== Performance Analysis Example ===\n');

  const monitor = new AgentMonitor();
  const analyzer = new PerformanceAnalyzer();

  // 创建多个代理用于分析
  const agentIds = ['fast-agent', 'slow-agent', 'error-prone-agent'];

  // Fast agent
  monitor.startTracking(agentIds[0], 'Explore', 'Fast execution');
  monitor.recordApiCall(agentIds[0], true, 800);
  monitor.recordTokens(agentIds[0], 200, 150);
  monitor.recordCost(agentIds[0], 0.005);
  monitor.recordToolCall(agentIds[0], 'Grep', 100, true);
  await new Promise(resolve => setTimeout(resolve, 50));
  monitor.stopTracking(agentIds[0], 'completed');

  // Slow agent
  monitor.startTracking(agentIds[1], 'general-purpose', 'Slow execution');
  monitor.recordApiCall(agentIds[1], true, 5000);
  monitor.recordTokens(agentIds[1], 1000, 800);
  monitor.recordCost(agentIds[1], 0.08);
  monitor.recordToolCall(agentIds[1], 'Bash', 3000, true);
  monitor.recordToolCall(agentIds[1], 'Read', 2500, true);
  await new Promise(resolve => setTimeout(resolve, 200));
  monitor.stopTracking(agentIds[1], 'completed');

  // Error-prone agent
  monitor.startTracking(agentIds[2], 'Plan', 'Unreliable execution');
  for (let i = 0; i < 5; i++) {
    monitor.recordApiCall(agentIds[2], i % 3 !== 0); // 33% error rate
    if (i % 3 === 0) {
      monitor.recordError(agentIds[2], new Error(`Error ${i}`), 'api');
    }
  }
  monitor.recordTokens(agentIds[2], 500, 400);
  monitor.recordCost(agentIds[2], 0.04);
  monitor.stopTracking(agentIds[2], 'failed');

  // 分析性能
  const allMetrics = monitor.getAllMetrics();
  const reports = analyzer.analyze(allMetrics);

  reports.forEach((report, idx) => {
    console.log(`\n📊 Performance Report - ${agentIds[idx]}`);
    console.log(`   Overall Score: ${report.overallScore.toFixed(1)}/100`);
    console.log(`\n   Metrics:`);
    Object.entries(report.metrics).forEach(([key, value]) => {
      console.log(`     ${key}: ${value.rating} (score: ${value.score}/100)`);
    });

    if (report.bottlenecks.length > 0) {
      console.log(`\n   🔴 Bottlenecks (${report.bottlenecks.length}):`);
      report.bottlenecks.forEach((b, i) => {
        console.log(`     ${i + 1}. [${b.type}] ${b.description} (${b.impact} impact)`);
        if (b.suggestedFix) {
          console.log(`        → ${b.suggestedFix}`);
        }
      });
    }

    if (report.suggestions.length > 0) {
      console.log(`\n   💡 Suggestions (${report.suggestions.length}):`);
      report.suggestions.forEach((s, i) => {
        console.log(`     ${i + 1}. [${s.priority}] ${s.title}`);
        console.log(`        ${s.description}`);
        if (s.estimatedImpact) {
          console.log(`        Impact: ${s.estimatedImpact}`);
        }
      });
    }
  });
}

// ==================== 示例 4: 仪表板数据 ====================

async function dashboardExample() {
  console.log('\n\n=== Dashboard Data Example ===\n');

  const monitor = new AgentMonitor();

  // 创建多个代理模拟真实使用场景
  for (let i = 0; i < 10; i++) {
    const agentId = `agent-${i}`;
    const type = ['Explore', 'general-purpose', 'Plan'][i % 3];

    monitor.startTracking(agentId, type, `Task ${i}`);
    monitor.recordApiCall(agentId, true, 1000 + Math.random() * 2000);
    monitor.recordTokens(agentId, 300 + Math.random() * 500, 200 + Math.random() * 400);
    monitor.recordCost(agentId, 0.01 + Math.random() * 0.05);

    const toolCount = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < toolCount; j++) {
      const tools = ['Read', 'Write', 'Bash', 'Grep', 'Glob'];
      const tool = tools[Math.floor(Math.random() * tools.length)];
      monitor.recordToolCall(agentId, tool, 100 + Math.random() * 1000, true);
    }

    const status = Math.random() > 0.1 ? 'completed' : 'failed';
    monitor.stopTracking(agentId, status);

    // 部分代理添加错误
    if (Math.random() > 0.7) {
      monitor.recordError(agentId, new Error('Random error'), 'test');
    }
  }

  // 生成仪表板数据
  const dashboard = generateDashboardData(monitor.getAllMetrics());

  console.log('📊 Dashboard Summary:');
  console.log(`   Active Agents: ${dashboard.summary.activeAgents}`);
  console.log(`   Total Agents Today: ${dashboard.summary.totalAgentsToday}`);
  console.log(`   Total Cost Today: $${dashboard.summary.totalCostToday.toFixed(4)}`);
  console.log(`   Avg Response Time: ${dashboard.summary.avgResponseTime.toFixed(0)}ms`);
  console.log(`   Success Rate: ${(dashboard.summary.successRate * 100).toFixed(1)}%`);

  console.log('\n📈 Top Metrics:');
  console.log('   Most Expensive Agents:');
  dashboard.topMetrics.mostExpensiveAgents.slice(0, 3).forEach((a, i) => {
    console.log(`     ${i + 1}. ${a.id} (${a.type}): $${a.cost.toFixed(4)}`);
  });

  console.log('   Most Active Tools:');
  dashboard.topMetrics.mostActiveTools.slice(0, 3).forEach((t, i) => {
    console.log(`     ${i + 1}. ${t.tool}: ${t.count} calls`);
  });

  console.log('\n   Recent Agents:');
  dashboard.recentAgents.slice(0, 5).forEach((a, i) => {
    console.log(`     ${i + 1}. ${a.id} - ${a.status} (${a.duration}ms, $${a.cost.toFixed(4)})`);
  });
}

// ==================== 示例 5: 导出指标 ====================

async function exportExample() {
  console.log('\n\n=== Export Metrics Example ===\n');

  const monitor = new AgentMonitor();

  // 创建一些测试数据
  for (let i = 0; i < 3; i++) {
    const agentId = `export-agent-${i}`;
    monitor.startTracking(agentId, 'Explore', `Export test ${i}`);
    monitor.recordTokens(agentId, 100 * (i + 1), 80 * (i + 1));
    monitor.recordCost(agentId, 0.01 * (i + 1));
    monitor.stopTracking(agentId, 'completed');
  }

  // JSON 导出
  console.log('📄 JSON Export:');
  const jsonExport = exportMetrics(monitor.getAllMetrics(), 'json');
  console.log(jsonExport.substring(0, 500) + '...\n');

  // CSV 导出
  console.log('📊 CSV Export:');
  const csvExport = exportMetrics(monitor.getAllMetrics(), 'csv');
  console.log(csvExport);
}

// ==================== 示例 6: 集成到代理工具 ====================

async function integrationExample() {
  console.log('\n\n=== Integration with Agent Tool Example ===\n');

  const { monitor, alertManager, analyzer } = createMonitoringSystem();

  // 模拟代理工具执行流程
  class MockAgentExecution {
    private agentId: string;
    private monitor: AgentMonitor;

    constructor(agentId: string, type: string, monitor: AgentMonitor) {
      this.agentId = agentId;
      this.monitor = monitor;

      // 开始跟踪
      this.monitor.startTracking(agentId, type, 'Mock execution');
    }

    async executeStep(stepName: string) {
      console.log(`  Executing step: ${stepName}`);

      // 记录工具调用
      const toolCallId = this.monitor.startToolCall(this.agentId, stepName);

      // 模拟工具执行
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      this.monitor.endToolCall(this.agentId, toolCallId, true);

      // 记录 API 调用
      this.monitor.recordApiCall(this.agentId, true, 800 + Math.random() * 400);
      this.monitor.recordTokens(this.agentId, 50 + Math.random() * 100, 40 + Math.random() * 80);
      this.monitor.recordCost(this.agentId, 0.002 + Math.random() * 0.003);
    }

    async complete() {
      this.monitor.stopTracking(this.agentId, 'completed');

      // 生成性能报告
      const metrics = this.monitor.getMetrics(this.agentId);
      if (metrics) {
        const report = analyzer.analyzeAgent(metrics);
        console.log(`\n  ✓ Execution completed`);
        console.log(`    Overall Score: ${report.overallScore.toFixed(1)}/100`);
        console.log(`    Duration: ${metrics.duration}ms`);
        console.log(`    Cost: $${metrics.cost.toFixed(6)}`);
        console.log(`    Tokens: ${metrics.tokensUsed.total}`);
      }
    }
  }

  // 执行代理
  console.log('Starting agent execution...\n');
  const agent = new MockAgentExecution('integration-test', 'general-purpose', monitor);

  await agent.executeStep('Read');
  await agent.executeStep('Grep');
  await agent.executeStep('Write');
  await agent.complete();

  // 显示告警
  const alerts = alertManager.getActiveAlerts();
  if (alerts.length > 0) {
    console.log(`\n⚠ Active Alerts: ${alerts.length}`);
  } else {
    console.log('\n✓ No active alerts');
  }
}

// ==================== 运行所有示例 ====================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Agent Monitor - Usage Examples                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await basicMonitoringExample();
    await alertManagementExample();
    await performanceAnalysisExample();
    await dashboardExample();
    await exportExample();
    await integrationExample();

    console.log('\n\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  basicMonitoringExample,
  alertManagementExample,
  performanceAnalysisExample,
  dashboardExample,
  exportExample,
  integrationExample,
  runAllExamples,
};
