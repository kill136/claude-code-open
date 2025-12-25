/**
 * Hooks 系统单元测试
 * 基于官方 Claude Code CLI v2.0.76 逆向分析
 */

import * as assert from 'assert';
import {
  registerHook,
  clearHooks,
  getHookCount,
  getEventHookCount,
  getHooksForEvent,
  runHooks,
  runPreToolUseHooks,
  runPostToolUseHooks,
  runSessionStartHooks,
  runUserPromptSubmitHooks,
  type HookEvent,
  type CommandHookConfig,
  type UrlHookConfig,
} from './index.js';

/**
 * 测试 Hook 注册
 */
export async function testHookRegistration(): Promise<void> {
  clearHooks();

  const commandHook: CommandHookConfig = {
    type: 'command',
    command: 'echo test',
    blocking: true,
  };

  const urlHook: UrlHookConfig = {
    type: 'url',
    url: 'http://localhost:8080/hook',
    method: 'POST',
  };

  registerHook('PreToolUse', commandHook);
  registerHook('PreToolUse', urlHook);
  registerHook('PostToolUse', commandHook);

  assert.strictEqual(getHookCount(), 3, 'Should have 3 hooks registered');
  assert.strictEqual(getEventHookCount('PreToolUse'), 2, 'Should have 2 PreToolUse hooks');
  assert.strictEqual(getEventHookCount('PostToolUse'), 1, 'Should have 1 PostToolUse hook');

  const preToolHooks = getHooksForEvent('PreToolUse');
  assert.strictEqual(preToolHooks.length, 2, 'Should retrieve 2 PreToolUse hooks');
  assert.strictEqual(preToolHooks[0].type, 'command');
  assert.strictEqual(preToolHooks[1].type, 'url');

  console.log('✓ Hook registration test passed');
}

/**
 * 测试 Command Hook 执行
 */
export async function testCommandHookExecution(): Promise<void> {
  clearHooks();

  const hook: CommandHookConfig = {
    type: 'command',
    command: 'echo "Hook executed"',
    blocking: false,
    timeout: 5000,
  };

  registerHook('PreToolUse', hook);

  const results = await runHooks({
    event: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'ls' },
    sessionId: 'test-session',
  });

  assert.strictEqual(results.length, 1, 'Should have 1 result');
  assert.strictEqual(results[0].success, true, 'Hook should succeed');
  assert.ok(results[0].output?.includes('Hook executed'), 'Output should contain expected text');

  console.log('✓ Command hook execution test passed');
}

/**
 * 测试 Hook Matcher
 */
export async function testHookMatcher(): Promise<void> {
  clearHooks();

  const bashHook: CommandHookConfig = {
    type: 'command',
    command: 'echo "Bash hook"',
    matcher: 'Bash',
  };

  const writeHook: CommandHookConfig = {
    type: 'command',
    command: 'echo "Write hook"',
    matcher: '/Write|Edit/',
  };

  registerHook('PreToolUse', bashHook);
  registerHook('PreToolUse', writeHook);

  // 测试精确匹配
  const bashResults = await runHooks({
    event: 'PreToolUse',
    toolName: 'Bash',
  });
  assert.strictEqual(bashResults.length, 1, 'Should match Bash hook only');

  // 测试正则匹配
  const writeResults = await runHooks({
    event: 'PreToolUse',
    toolName: 'Write',
  });
  assert.strictEqual(writeResults.length, 1, 'Should match Write hook only');

  const editResults = await runHooks({
    event: 'PreToolUse',
    toolName: 'Edit',
  });
  assert.strictEqual(editResults.length, 1, 'Should match Edit hook via regex');

  // 测试无匹配
  const readResults = await runHooks({
    event: 'PreToolUse',
    toolName: 'Read',
  });
  assert.strictEqual(readResults.length, 0, 'Should not match any hooks');

  console.log('✓ Hook matcher test passed');
}

/**
 * 测试环境变量替换
 */
export async function testEnvironmentVariables(): Promise<void> {
  clearHooks();

  const hook: CommandHookConfig = {
    type: 'command',
    command: 'echo "Tool: $TOOL_NAME, Event: $EVENT"',
  };

  registerHook('PreToolUse', hook);

  const results = await runHooks({
    event: 'PreToolUse',
    toolName: 'TestTool',
    sessionId: 'test-123',
  });

  assert.strictEqual(results.length, 1);
  assert.ok(results[0].output?.includes('Tool: TestTool'));
  assert.ok(results[0].output?.includes('Event: PreToolUse'));

  console.log('✓ Environment variables test passed');
}

/**
 * 测试辅助函数
 */
export async function testHelperFunctions(): Promise<void> {
  clearHooks();

  const hook: CommandHookConfig = {
    type: 'command',
    command: 'echo "test"',
  };

  registerHook('PreToolUse', hook);
  registerHook('PostToolUse', hook);
  registerHook('SessionStart', hook);
  registerHook('UserPromptSubmit', hook);

  // 测试各个辅助函数
  const preToolResult = await runPreToolUseHooks('Bash', { command: 'ls' }, 'test-session');
  assert.strictEqual(preToolResult.allowed, true, 'PreToolUse should be allowed');

  await runPostToolUseHooks('Bash', { command: 'ls' }, 'output', 'test-session');
  await runSessionStartHooks('test-session');

  const promptResult = await runUserPromptSubmitHooks('test prompt', 'test-session');
  assert.strictEqual(promptResult.allowed, true, 'UserPromptSubmit should be allowed');

  console.log('✓ Helper functions test passed');
}

/**
 * 测试所有 12 种事件类型
 */
export async function testAllEventTypes(): Promise<void> {
  clearHooks();

  const events: HookEvent[] = [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Notification',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'PreCompact',
    'PermissionRequest',
  ];

  const hook: CommandHookConfig = {
    type: 'command',
    command: 'echo "test"',
  };

  // 为每个事件注册 Hook
  for (const event of events) {
    registerHook(event, hook);
  }

  assert.strictEqual(getHookCount(), 12, 'Should have 12 hooks registered (one for each event)');

  // 验证每个事件都有对应的 Hook
  for (const event of events) {
    assert.strictEqual(getEventHookCount(event), 1, `Should have 1 hook for ${event}`);
  }

  console.log('✓ All 12 event types test passed');
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  console.log('\n=== Running Hooks System Tests ===\n');

  try {
    await testHookRegistration();
    await testCommandHookExecution();
    await testHookMatcher();
    await testEnvironmentVariables();
    await testHelperFunctions();
    await testAllEventTypes();

    console.log('\n=== All Tests Passed ✓ ===\n');
  } catch (error) {
    console.error('\n=== Test Failed ✗ ===');
    console.error(error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
