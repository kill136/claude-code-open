/**
 * 权限 UI 使用示例
 * 展示如何使用 PermissionUI 类
 */

import { PermissionUI } from './ui.js';
import type { ToolPermission, PermissionHistoryEntry } from './ui.js';
import type { PermissionRequest } from './index.js';

// ============ 示例 1: 基本权限提示 ============

async function example1_BasicPrompt() {
  console.log('\n===== Example 1: Basic Permission Prompt =====\n');

  const ui = new PermissionUI();

  // 简单的文件写入权限请求
  const response = await ui.promptUser({
    tool: 'Write',
    action: 'Write content to file',
    resource: '/home/user/config.json',
    details: 'Writing configuration to file',
  });

  console.log('Response:', response);
  // { allowed: true, remember: false, scope: 'once' }
}

// ============ 示例 2: 带超时的权限提示 ============

async function example2_PromptWithTimeout() {
  console.log('\n===== Example 2: Permission Prompt with Timeout =====\n');

  const ui = new PermissionUI();

  // 10秒超时，超时后自动拒绝
  const response = await ui.promptUser({
    tool: 'Bash',
    action: 'Execute bash command',
    resource: 'rm -rf /tmp/cache',
    details: 'Removing temporary cache files',
    timeout: 10000,
    defaultAction: 'deny',
  });

  if (response.timedOut) {
    console.log('Permission request timed out, automatically denied');
  }
}

// ============ 示例 3: 显示权限状态 ============

function example3_ShowPermissionStatus() {
  console.log('\n===== Example 3: Show Permission Status =====\n');

  const ui = new PermissionUI();

  // 模拟一些记住的权限
  const permissions: ToolPermission[] = [
    {
      tool: 'Read',
      type: 'file_read',
      allowed: true,
      scope: 'always',
      pattern: '/home/user/projects/**/*',
      timestamp: Date.now() - 86400000, // 1天前
    },
    {
      tool: 'Write',
      type: 'file_write',
      allowed: true,
      scope: 'session',
      pattern: '/tmp/*',
      timestamp: Date.now() - 3600000, // 1小时前
    },
    {
      tool: 'Bash',
      type: 'bash_command',
      allowed: false,
      scope: 'always',
      pattern: 'rm -rf *',
      timestamp: Date.now() - 7200000, // 2小时前
    },
  ];

  ui.showPermissionStatus(permissions);
}

// ============ 示例 4: 显示权限历史 ============

function example4_ShowPermissionHistory() {
  console.log('\n===== Example 4: Show Permission History =====\n');

  const ui = new PermissionUI();

  // 模拟历史记录
  const history: PermissionHistoryEntry[] = [
    {
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: 'file_write',
      tool: 'Write',
      resource: '/home/user/config.json',
      decision: 'allow',
      scope: 'once',
      reason: 'User approved',
      user: true,
    },
    {
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'bash_command',
      tool: 'Bash',
      resource: 'git status',
      decision: 'allow',
      reason: 'Auto-allowed safe command',
      user: false,
    },
    {
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      type: 'file_delete',
      tool: 'Bash',
      resource: 'rm important.txt',
      decision: 'deny',
      scope: 'once',
      reason: 'User denied',
      user: true,
    },
  ];

  ui.showPermissionHistory(history, 10);
}

// ============ 示例 5: 快捷操作 ============

function example5_QuickActions() {
  console.log('\n===== Example 5: Quick Actions =====\n');

  const ui = new PermissionUI();

  // 创建快捷操作（不需要真实的 PermissionManager）
  const actions = ui.createQuickActions();

  console.log('Available Quick Actions:');
  actions.forEach((action, index) => {
    const danger = action.dangerous ? ' ⚠️  DANGEROUS' : '';
    console.log(`  ${index + 1}. ${action.label}${danger}`);
    console.log(`     ${action.description}`);
  });

  // 执行某个操作（例如查看审计日志）
  const viewAuditAction = actions.find(a => a.id === 'view-audit');
  if (viewAuditAction) {
    console.log('\nExecuting: View Audit Log');
    viewAuditAction.action();
  }
}

// ============ 示例 6: 格式化工具函数 ============

function example6_FormatHelpers() {
  console.log('\n===== Example 6: Format Helper Functions =====\n');

  const { formatPermissionRequest, createPermissionBanner, createPermissionSummary } = require('./ui.js');

  // 格式化权限请求
  const request: PermissionRequest = {
    type: 'file_write',
    tool: 'Edit',
    description: 'Update configuration file',
    resource: '/home/user/claude-code-open/src/config/settings.json',
    details: {
      size: '2.5 KB',
      lines: 85,
    },
  };

  console.log(formatPermissionRequest(request));

  // 创建权限横幅
  console.log('\n');
  const banner = createPermissionBanner({
    mode: 'default',
    totalRemembered: 12,
    sessionPermissions: 5,
    alwaysPermissions: 7,
    deniedPermissions: 2,
    auditEnabled: true,
  });
  console.log(banner);

  // 创建权限摘要
  const permissions: ToolPermission[] = [
    { tool: 'Read', type: 'file_read', allowed: true, scope: 'always', timestamp: Date.now() },
    { tool: 'Read', type: 'file_read', allowed: true, scope: 'always', timestamp: Date.now() },
    { tool: 'Write', type: 'file_write', allowed: true, scope: 'session', timestamp: Date.now() },
    { tool: 'Bash', type: 'bash_command', allowed: false, scope: 'always', timestamp: Date.now() },
  ];

  console.log('\n');
  console.log(createPermissionSummary(permissions));
}

// ============ 示例 7: 集成到 PermissionManager ============

async function example7_IntegrationWithManager() {
  console.log('\n===== Example 7: Integration with PermissionManager =====\n');

  const { PermissionManager } = await import('./index.js');
  const ui = new PermissionUI();

  // 创建权限管理器
  const manager = new PermissionManager('default');

  // 模拟权限请求
  const request: PermissionRequest = {
    type: 'bash_command',
    tool: 'Bash',
    description: 'Install npm packages',
    resource: 'npm install --save express',
  };

  // 使用 UI 询问用户
  const response = await ui.promptUser({
    tool: request.tool,
    action: request.description,
    resource: request.resource,
  });

  console.log('User decision:', response);

  // 根据决策执行操作
  if (response.allowed) {
    console.log('✓ Permission granted, executing command...');
    // 这里可以执行实际的命令
  } else {
    console.log('✗ Permission denied');
  }
}

// ============ 示例 8: 加载和显示审计日志 ============

function example8_AuditLog() {
  console.log('\n===== Example 8: Load and Display Audit Log =====\n');

  const ui = new PermissionUI();

  // 加载审计日志
  const history = ui.loadAuditLog();

  if (history.length > 0) {
    console.log(`Found ${history.length} audit log entries`);
    ui.showPermissionHistory(history, 20);
  } else {
    console.log('No audit log found or log is empty');
    console.log('Audit logs are saved to: ~/.claude/permissions-audit.log');
  }
}

// ============ 运行所有示例 ============

async function runAllExamples() {
  try {
    // 非交互式示例
    example3_ShowPermissionStatus();
    example4_ShowPermissionHistory();
    example5_QuickActions();
    example6_FormatHelpers();
    example8_AuditLog();

    // 交互式示例（需要用户输入）
    // await example1_BasicPrompt();
    // await example2_PromptWithTimeout();
    // await example7_IntegrationWithManager();

    console.log('\n✓ All examples completed\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// 主函数入口
if (require.main === module) {
  runAllExamples();
}

export {
  example1_BasicPrompt,
  example2_PromptWithTimeout,
  example3_ShowPermissionStatus,
  example4_ShowPermissionHistory,
  example5_QuickActions,
  example6_FormatHelpers,
  example7_IntegrationWithManager,
  example8_AuditLog,
};
