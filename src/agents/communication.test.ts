/**
 * 代理间通信系统测试
 */

import {
  AgentMessageBus,
  SharedStateManager,
  AgentCoordinator,
  createCommunicationSystem,
  Message,
  AgentCapabilities,
  Task,
} from './communication.js';

// ============================================================================
// 单元测试
// ============================================================================

/**
 * 测试消息总线基本功能
 */
async function testMessageBusBasics() {
  console.log('\n=== Test: Message Bus Basics ===');

  const messageBus = new AgentMessageBus();
  let receivedMessage: Message | null = null;

  // 订阅消息
  messageBus.subscribe('agent1', ['test'], (message) => {
    receivedMessage = message;
  });

  // 发送消息
  await messageBus.send({
    id: 'msg1',
    from: 'sender',
    to: 'agent1',
    type: 'test',
    payload: { value: 42 },
    timestamp: new Date(),
    priority: 5,
  });

  // 验证
  console.assert(receivedMessage !== null, 'Message should be received');
  console.assert(receivedMessage?.payload.value === 42, 'Payload value should match');

  console.log('✓ Message bus basics test passed');
}

/**
 * 测试消息广播
 */
async function testBroadcast() {
  console.log('\n=== Test: Message Broadcast ===');

  const messageBus = new AgentMessageBus();
  const received: string[] = [];

  // 多个代理订阅
  messageBus.subscribe('agent1', ['broadcast'], () => received.push('agent1'));
  messageBus.subscribe('agent2', ['broadcast'], () => received.push('agent2'));
  messageBus.subscribe('agent3', ['broadcast'], () => received.push('agent3'));

  // 广播
  await messageBus.broadcast('broadcast', { message: 'Hello all' });

  // 等待异步处理
  await new Promise(resolve => setTimeout(resolve, 100));

  // 验证
  console.assert(received.length === 3, 'All agents should receive broadcast');
  console.assert(received.includes('agent1'), 'Agent1 should receive');
  console.assert(received.includes('agent2'), 'Agent2 should receive');
  console.assert(received.includes('agent3'), 'Agent3 should receive');

  console.log('✓ Broadcast test passed');
}

/**
 * 测试共享状态
 */
async function testSharedState() {
  console.log('\n=== Test: Shared State ===');

  const sharedState = new SharedStateManager();

  // 设置和获取
  sharedState.set('key1', 'value1');
  const value = sharedState.get<string>('key1');
  console.assert(value === 'value1', 'Should get set value');

  // 增量操作
  sharedState.set('counter', 0);
  sharedState.increment('counter', 5);
  sharedState.increment('counter', 3);
  const counter = sharedState.get<number>('counter');
  console.assert(counter === 8, 'Counter should be 8');

  // CAS 操作
  const swapped = sharedState.compareAndSwap('counter', 8, 100);
  console.assert(swapped === true, 'CAS should succeed');
  console.assert(sharedState.get('counter') === 100, 'Value should be updated');

  // 删除
  const deleted = sharedState.delete('key1');
  console.assert(deleted === true, 'Should delete successfully');
  console.assert(sharedState.get('key1') === undefined, 'Value should be undefined');

  console.log('✓ Shared state test passed');
}

/**
 * 测试状态监听
 */
async function testStateWatcher() {
  console.log('\n=== Test: State Watcher ===');

  const sharedState = new SharedStateManager();
  const changes: any[] = [];

  // 监听变化
  const unwatch = sharedState.watch('watched', (value) => {
    changes.push(value);
  });

  // 多次设置
  sharedState.set('watched', 1);
  sharedState.set('watched', 2);
  sharedState.set('watched', 3);

  // 验证
  console.assert(changes.length === 3, 'Should receive 3 changes');
  console.assert(changes[0] === 1, 'First change should be 1');
  console.assert(changes[2] === 3, 'Last change should be 3');

  // 取消监听
  unwatch();
  sharedState.set('watched', 4);

  // 验证取消后不再接收
  console.assert(changes.length === 3, 'Should not receive changes after unwatch');

  console.log('✓ State watcher test passed');
}

/**
 * 测试锁机制
 */
async function testLocks() {
  console.log('\n=== Test: Lock Mechanism ===');

  const sharedState = new SharedStateManager();

  // 获取锁
  const lock1 = await sharedState.lock('resource', 'agent1', 5000);
  console.assert(lock1.holder === 'agent1', 'Lock holder should be agent1');
  console.assert(sharedState.isLocked('resource'), 'Resource should be locked');

  // 尝试获取同一资源的锁（应该超时）
  let timeoutOccurred = false;
  try {
    await sharedState.lock('resource', 'agent2', 500);
  } catch (error) {
    timeoutOccurred = true;
  }
  console.assert(timeoutOccurred, 'Second lock should timeout');

  // 释放锁
  sharedState.unlock(lock1);
  console.assert(!sharedState.isLocked('resource'), 'Resource should be unlocked');

  console.log('✓ Lock mechanism test passed');
}

/**
 * 测试代理注册和任务分配
 */
async function testAgentCoordination() {
  console.log('\n=== Test: Agent Coordination ===');

  const { messageBus, sharedState, coordinator } = createCommunicationSystem();

  // 注册代理
  const agent1: AgentCapabilities = {
    agentId: 'worker1',
    type: 'worker',
    capabilities: ['compute', 'io'],
    currentLoad: 0,
    maxConcurrentTasks: 3,
    currentTasks: 0,
    status: 'idle',
    lastHeartbeat: new Date(),
  };

  const agent2: AgentCapabilities = {
    agentId: 'worker2',
    type: 'worker',
    capabilities: ['analytics', 'compute'],
    currentLoad: 0.5,
    maxConcurrentTasks: 2,
    currentTasks: 1,
    status: 'busy',
    lastHeartbeat: new Date(),
  };

  coordinator.registerAgent(agent1);
  coordinator.registerAgent(agent2);

  // 创建任务
  const task: Task = {
    id: 'task1',
    type: 'compute',
    data: { operation: 'sum' },
    priority: 5,
    createdAt: new Date(),
  };

  // 分配任务（应该分配给负载较低的 agent1）
  const assignedAgent = await coordinator.assignTask(task, {
    requiredCapabilities: ['compute'],
    loadBalanceStrategy: 'least-busy',
  });

  console.assert(assignedAgent === 'worker1', 'Task should be assigned to worker1');

  const stats = coordinator.getStats();
  console.assert(stats.totalAgents === 2, 'Should have 2 agents');
  console.assert(stats.totalTasks === 1, 'Should have 1 task');

  console.log('✓ Agent coordination test passed');
}

/**
 * 测试请求-响应模式
 */
async function testRequestResponse() {
  console.log('\n=== Test: Request-Response ===');

  const messageBus = new AgentMessageBus();

  // 响应方监听
  messageBus.subscribe('responder', ['request'], async (message: Message) => {
    await messageBus.respond(message, { result: 'success', data: 42 });
  });

  // 请求方发送请求
  const response = await messageBus.request(
    'responder',
    'request',
    { query: 'test' },
    'requester',
    5000
  );

  console.assert(response.result === 'success', 'Response should indicate success');
  console.assert(response.data === 42, 'Response data should match');

  console.log('✓ Request-response test passed');
}

/**
 * 测试消息优先级
 */
async function testMessagePriority() {
  console.log('\n=== Test: Message Priority ===');

  const messageBus = new AgentMessageBus();
  messageBus.subscribe('agent1', ['task']);

  // 发送不同优先级的消息
  await messageBus.send({
    id: 'low',
    from: 'sender',
    to: 'agent1',
    type: 'task',
    payload: { priority: 'low' },
    timestamp: new Date(),
    priority: 1,
  });

  await messageBus.send({
    id: 'high',
    from: 'sender',
    to: 'agent1',
    type: 'task',
    payload: { priority: 'high' },
    timestamp: new Date(),
    priority: 10,
  });

  await messageBus.send({
    id: 'medium',
    from: 'sender',
    to: 'agent1',
    type: 'task',
    payload: { priority: 'medium' },
    timestamp: new Date(),
    priority: 5,
  });

  // 获取队列
  const queue = messageBus.getQueue('agent1');

  // 验证优先级排序
  console.assert(queue[0].id === 'high', 'First message should be high priority');
  console.assert(queue[1].id === 'medium', 'Second message should be medium priority');
  console.assert(queue[2].id === 'low', 'Third message should be low priority');

  console.log('✓ Message priority test passed');
}

/**
 * 测试统计功能
 */
async function testStats() {
  console.log('\n=== Test: Statistics ===');

  const { messageBus, sharedState, coordinator } = createCommunicationSystem();

  // 添加一些数据
  messageBus.subscribe('agent1', ['test']);
  messageBus.subscribe('agent2', ['test']);

  await messageBus.send({
    id: '1',
    from: 'sender',
    to: 'agent1',
    type: 'test',
    payload: {},
    timestamp: new Date(),
    priority: 5,
  });

  sharedState.set('key1', 'value1');
  sharedState.set('key2', 'value2');

  // 获取统计信息
  const busStats = messageBus.getStats();
  const stateStats = sharedState.getStats();

  console.assert(busStats.activeSubscriptions === 2, 'Should have 2 subscriptions');
  console.assert(busStats.totalMessages === 1, 'Should have 1 message in history');
  console.assert(stateStats.stateSize === 2, 'Should have 2 state entries');

  console.log('✓ Statistics test passed');
}

// ============================================================================
// 运行所有测试
// ============================================================================

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  Agent Communication System Tests         ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await testMessageBusBasics();
    await testBroadcast();
    await testSharedState();
    await testStateWatcher();
    await testLocks();
    await testAgentCoordination();
    await testRequestResponse();
    await testMessagePriority();
    await testStats();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ✓ All tests passed!                      ║');
    console.log('╚════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export {
  testMessageBusBasics,
  testBroadcast,
  testSharedState,
  testStateWatcher,
  testLocks,
  testAgentCoordination,
  testRequestResponse,
  testMessagePriority,
  testStats,
};
