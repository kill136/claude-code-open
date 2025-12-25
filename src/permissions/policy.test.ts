/**
 * 策略引擎快速测试
 * 验证核心功能是否正常工作
 */

import {
  PolicyEngine,
  PolicyBuilder,
  RuleBuilder,
  createReadOnlyPolicy,
  type PolicyDecision,
} from './policy.js';
import type { PermissionRequest } from './index.js';

// 简单测试函数
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// 测试 1: 基本策略评估
function test1_BasicEvaluation() {
  console.log('\n[Test 1] Basic Policy Evaluation');

  const engine = new PolicyEngine();
  const policy = new PolicyBuilder('test', 'Test Policy')
    .priority(100)
    .defaultEffect('deny')
    .addRule(
      new RuleBuilder('allow-read', 'allow')
        .type('file_read')
        .build()
    )
    .build();

  engine.addPolicy(policy);

  const readRequest: PermissionRequest = {
    type: 'file_read',
    tool: 'Read',
    description: 'Test read',
    resource: '/test.txt',
  };

  const writeRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Test write',
    resource: '/test.txt',
  };

  const readDecision = engine.evaluate(readRequest);
  const writeDecision = engine.evaluate(writeRequest);

  assert(readDecision.allowed === true, 'Read should be allowed');
  assert(writeDecision.allowed === false, 'Write should be denied');
}

// 测试 2: 冲突解决
function test2_ConflictResolution() {
  console.log('\n[Test 2] Conflict Resolution');

  const engine = new PolicyEngine();

  const allowPolicy = new PolicyBuilder('allow', 'Allow Policy')
    .priority(100)
    .defaultEffect('allow')
    .addRule(new RuleBuilder('allow-all', 'allow').build())
    .build();

  const denyPolicy = new PolicyBuilder('deny', 'Deny Policy')
    .priority(200) // Higher priority
    .defaultEffect('deny')
    .addRule(
      new RuleBuilder('deny-write', 'deny')
        .type('file_write')
        .build()
    )
    .build();

  engine.addPolicy(allowPolicy);
  engine.addPolicy(denyPolicy);

  const request: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Test',
    resource: '/test.txt',
  };

  const decision = engine.evaluate(request);
  assert(decision.allowed === false, 'Deny should win (higher priority)');
  assert(decision.policy === 'deny', 'Deny policy should be used');
}

// 测试 3: 策略验证
function test3_PolicyValidation() {
  console.log('\n[Test 3] Policy Validation');

  const engine = new PolicyEngine();

  const validPolicy = new PolicyBuilder('valid', 'Valid')
    .priority(100)
    .defaultEffect('allow')
    .addRule(new RuleBuilder('r1', 'allow').build())
    .build();

  const invalidPolicy: any = {
    id: 'invalid',
    // Missing name
    priority: 'wrong', // Wrong type
    effect: 'maybe', // Invalid value
  };

  const validResult = engine.validatePolicy(validPolicy);
  const invalidResult = engine.validatePolicy(invalidPolicy);

  assert(validResult.valid === true, 'Valid policy should pass validation');
  assert(invalidResult.valid === false, 'Invalid policy should fail validation');
  assert(invalidResult.errors.length > 0, 'Invalid policy should have errors');
}

// 测试 4: 模板策略
function test4_PolicyTemplates() {
  console.log('\n[Test 4] Policy Templates');

  const engine = new PolicyEngine();
  const readOnlyPolicy = createReadOnlyPolicy();

  engine.addPolicy(readOnlyPolicy);

  const readRequest: PermissionRequest = {
    type: 'file_read',
    tool: 'Read',
    description: 'Read',
    resource: '/test.txt',
  };

  const writeRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write',
    resource: '/test.txt',
  };

  const bashRequest: PermissionRequest = {
    type: 'bash_command',
    tool: 'Bash',
    description: 'Bash',
    resource: 'ls',
  };

  const readDecision = engine.evaluate(readRequest);
  const writeDecision = engine.evaluate(writeRequest);
  const bashDecision = engine.evaluate(bashRequest);

  assert(readDecision.allowed === true, 'Read-only: read should be allowed');
  assert(writeDecision.allowed === false, 'Read-only: write should be denied');
  assert(bashDecision.allowed === false, 'Read-only: bash should be denied');
}

// 测试 5: 策略管理
function test5_PolicyManagement() {
  console.log('\n[Test 5] Policy Management');

  const engine = new PolicyEngine();

  const policy1 = new PolicyBuilder('p1', 'Policy 1')
    .priority(100)
    .defaultEffect('allow')
    .build();

  const policy2 = new PolicyBuilder('p2', 'Policy 2')
    .priority(200)
    .defaultEffect('deny')
    .build();

  // Add
  engine.addPolicy(policy1);
  engine.addPolicy(policy2);
  assert(engine.listPolicies().length === 2, 'Should have 2 policies');

  // Get
  const retrieved = engine.getPolicy('p1');
  assert(retrieved?.id === 'p1', 'Should retrieve correct policy');

  // Update
  engine.updatePolicy('p1', { priority: 300 });
  const updated = engine.getPolicy('p1');
  assert(updated?.priority === 300, 'Should update policy');

  // Disable
  engine.disablePolicy('p1');
  const disabled = engine.getPolicy('p1');
  assert(disabled?.enabled === false, 'Should disable policy');

  // Enable
  engine.enablePolicy('p1');
  const enabled = engine.getPolicy('p1');
  assert(enabled?.enabled === true, 'Should enable policy');

  // Remove
  engine.removePolicy('p1');
  assert(engine.listPolicies().length === 1, 'Should have 1 policy after removal');

  // Stats
  const stats = engine.getStats();
  assert(stats.totalPolicies === 1, 'Stats should reflect current state');
}

// 运行所有测试
function runTests() {
  console.log('\n========================================');
  console.log('  Policy Engine Tests');
  console.log('========================================');

  try {
    test1_BasicEvaluation();
    test2_ConflictResolution();
    test3_PolicyValidation();
    test4_PolicyTemplates();
    test5_PolicyManagement();

    console.log('\n========================================');
    console.log('  ✓ All Tests Passed');
    console.log('========================================\n');
    return true;
  } catch (error) {
    console.error('\n========================================');
    console.error('  ✗ Test Failed');
    console.error('========================================');
    console.error(error);
    console.error('');
    return false;
  }
}

// 运行测试（如果直接执行此文件）
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };
