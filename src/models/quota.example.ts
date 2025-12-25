/**
 * 配额管理系统使用示例
 * 展示如何使用 QuotaManager 进行成本控制和预警
 */

import { quotaManager } from './quota.js';
import type { CostAlert, BudgetStatus, QuotaType } from './types.js';

// ============================================
// 示例 1: 设置成本限制
// ============================================

// 设置 $5.00 的成本限制
quotaManager.setLimit('cost', 5.0);

// 设置 100,000 tokens 限制
quotaManager.setLimit('tokens', 100000);

// 设置 50 次请求限制
quotaManager.setLimit('requests', 50);

// ============================================
// 示例 2: 检查使用情况
// ============================================

// 获取当前使用情况
const usage = quotaManager.getCurrentUsage();
console.log('当前成本:', usage.currentCost);
console.log('当前 tokens:', usage.currentTokens);
console.log('当前请求数:', usage.currentRequests);

// 检查是否超出限制
const limitCheck = quotaManager.checkLimit();
if (!limitCheck.withinLimit) {
  console.log('已超出限制:', limitCheck.exceeded);
  console.log('预警信息:', limitCheck.warnings);
}

// ============================================
// 示例 3: 获取使用百分比和剩余预算
// ============================================

// 获取特定类型的使用百分比
const costPercentage = quotaManager.getUsagePercentage('cost');
console.log(`成本使用率: ${costPercentage}%`);

// 获取所有类型的使用百分比
const allPercentages = quotaManager.getUsagePercentage();
console.log('所有使用率:', allPercentages);

// 获取剩余预算
const remainingCost = quotaManager.getRemainingBudget('cost');
console.log(`剩余预算: $${remainingCost}`);

// ============================================
// 示例 4: 注册预警回调
// ============================================

// 当达到阈值时触发
quotaManager.onThresholdReached((alert: CostAlert, status: BudgetStatus) => {
  console.log(`⚠️ 预警: ${alert.message}`);
  console.log(`  级别: ${alert.level}`);
  console.log(`  使用率: ${status.percentage.toFixed(1)}%`);
  console.log(`  剩余: ${status.remaining}`);

  // 根据预警级别采取不同行动
  switch (alert.level) {
    case 'info':
      console.log('  提示: 使用量达到 50%');
      break;
    case 'warning':
      console.log('  警告: 使用量达到 80%，请注意控制');
      break;
    case 'critical':
      console.log('  严重: 使用量达到 95%，建议暂停');
      break;
    case 'exceeded':
      console.log('  超限: 已达到限制，停止请求');
      break;
  }
});

// 当超出限制时触发
quotaManager.onLimitExceeded((type: QuotaType, status: BudgetStatus) => {
  console.log(`❌ 超出限制: ${type}`);
  console.log(`  当前: ${status.current}`);
  console.log(`  限制: ${status.limit}`);

  // 可以在这里实现自动暂停或停止逻辑
  throw new Error(`${type} limit exceeded. Please increase quota or wait.`);
});

// ============================================
// 示例 5: 添加自定义预警
// ============================================

// 添加自定义的 $2.50 预警
quotaManager.addAlert({
  threshold: 2.5,
  action: 'warn',
  level: 'warning',
  message: 'Custom alert: Cost reached $2.50',
});

// ============================================
// 示例 6: 获取预算状态
// ============================================

// 获取特定类型的详细状态
const costStatus = quotaManager.getBudgetStatus('cost');
console.log('成本状态:');
console.log('  当前:', costStatus.current);
console.log('  限制:', costStatus.limit);
console.log('  使用率:', `${costStatus.percentage}%`);
console.log('  剩余:', costStatus.remaining);
console.log('  预警级别:', costStatus.alertLevel);
console.log('  是否超限:', costStatus.exceeded);

// ============================================
// 示例 7: 显示配额摘要
// ============================================

// 打印配额摘要
console.log(quotaManager.getSummary());

// ============================================
// 示例 8: 导出和导入配置
// ============================================

// 导出当前配置
const config = quotaManager.exportConfig();
console.log('导出的配置:', JSON.stringify(config, null, 2));

// 导入配置
quotaManager.importConfig({
  limits: {
    maxCost: 10.0,
    maxTokens: 200000,
    maxRequests: 100,
  },
  enabled: true,
});

// ============================================
// 示例 9: 在 API 调用前检查配额
// ============================================

async function makeApiCall() {
  // 在调用 API 前检查配额
  const check = quotaManager.checkLimit();

  if (!check.withinLimit) {
    throw new Error(
      `Cannot make API call: ${check.exceeded.join(', ')} limit(s) exceeded`
    );
  }

  // 检查是否接近限制（95%）
  const costStatus = quotaManager.getBudgetStatus('cost');
  if (costStatus.percentage >= 95) {
    console.warn(
      '⚠️ Warning: Cost usage is at 95%. Consider pausing or increasing limit.'
    );
  }

  // 继续进行 API 调用...
  console.log('Making API call...');
}

// ============================================
// 示例 10: 重置配额管理器
// ============================================

// 重置所有配置和状态
quotaManager.reset();

// 或者只禁用配额管理
quotaManager.setEnabled(false);

// 检查是否启用
console.log('配额管理已启用:', quotaManager.isEnabled());
