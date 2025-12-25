/**
 * 代理间通信系统使用示例
 * Agent Communication System Usage Examples
 */

import {
  createCommunicationSystem,
  AgentCapabilities,
  Message,
  Task,
  AssignmentCriteria,
} from './communication.js';

// ============================================================================
// 示例 1: 基础消息传递
// ============================================================================

async function example1_basicMessaging() {
  console.log('=== Example 1: Basic Messaging ===\n');

  const { messageBus } = createCommunicationSystem();

  // 订阅消息
  messageBus.subscribe('agent1', ['task', 'notification'], (message) => {
    console.log(`Agent1 received: ${message.type} from ${message.from}`);
    console.log(`Payload:`, message.payload);
  });

  messageBus.subscribe('agent2', ['task', 'status'], (message) => {
    console.log(`Agent2 received: ${message.type} from ${message.from}`);
  });

  // 发送点对点消息
  await messageBus.send({
    id: '1',
    from: 'coordinator',
    to: 'agent1',
    type: 'task',
    payload: { action: 'process', data: [1, 2, 3] },
    timestamp: new Date(),
    priority: 5,
  });

  // 广播消息
  await messageBus.broadcast('notification', { message: 'System update available' }, 'system');

  console.log('\nStats:', messageBus.getStats());
}

// ============================================================================
// 示例 2: 请求-响应模式
// ============================================================================

async function example2_requestResponse() {
  console.log('\n=== Example 2: Request-Response Pattern ===\n');

  const { messageBus } = createCommunicationSystem();

  // Agent2 监听请求并响应
  messageBus.subscribe('agent2', ['data:request'], async (message: Message) => {
    console.log(`Agent2 received request: ${message.type}`);

    // 模拟处理
    await new Promise(resolve => setTimeout(resolve, 100));

    // 发送响应
    await messageBus.respond(message, {
      status: 'success',
      data: { result: 'processed' },
    });
  });

  // Agent1 发送请求并等待响应
  try {
    const response = await messageBus.request(
      'agent2',
      'data:request',
      { query: 'SELECT * FROM users' },
      'agent1',
      5000
    );

    console.log('Agent1 received response:', response);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// ============================================================================
// 示例 3: 共享状态管理
// ============================================================================

async function example3_sharedState() {
  console.log('\n=== Example 3: Shared State Management ===\n');

  const { sharedState } = createCommunicationSystem();

  // 设置初始状态
  sharedState.set('counter', 0);
  sharedState.set('config', { maxRetries: 3, timeout: 5000 });

  // 监听状态变化
  const unwatch = sharedState.watch('counter', (value) => {
    console.log(`Counter changed to: ${value}`);
  });

  // 原子操作：增量
  sharedState.increment('counter', 1);
  sharedState.increment('counter', 5);

  // 比较并交换
  const swapped = sharedState.compareAndSwap('counter', 6, 10);
  console.log(`CAS result: ${swapped}`);

  // 获取值
  console.log('Final counter:', sharedState.get('counter'));
  console.log('Config:', sharedState.get('config'));

  // 停止监听
  unwatch();

  console.log('\nStats:', sharedState.getStats());
}

// ============================================================================
// 示例 4: 锁机制
// ============================================================================

async function example4_locks() {
  console.log('\n=== Example 4: Lock Mechanism ===\n');

  const { sharedState } = createCommunicationSystem();

  // Agent1 获取锁
  console.log('Agent1 acquiring lock...');
  const lock1 = await sharedState.lock('resource1', 'agent1', 2000);
  console.log(`Agent1 acquired lock: ${lock1.id}`);

  // Agent2 尝试获取同一个锁（会等待）
  setTimeout(async () => {
    console.log('Agent2 attempting to acquire lock...');
    try {
      const lock2 = await sharedState.lock('resource1', 'agent2', 1000);
      console.log(`Agent2 acquired lock: ${lock2.id}`);
      sharedState.unlock(lock2);
    } catch (error) {
      console.log('Agent2 lock timeout:', (error as Error).message);
    }
  }, 500);

  // Agent1 释放锁
  await new Promise(resolve => setTimeout(resolve, 1500));
  console.log('Agent1 releasing lock...');
  sharedState.unlock(lock1);

  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\nAll locks:', sharedState.getAllLocks());
}

// ============================================================================
// 示例 5: 任务协调和负载均衡
// ============================================================================

async function example5_taskCoordination() {
  console.log('\n=== Example 5: Task Coordination ===\n');

  const { messageBus, sharedState, coordinator } = createCommunicationSystem();

  // 注册多个代理
  const agent1: AgentCapabilities = {
    agentId: 'agent1',
    type: 'worker',
    capabilities: ['compute', 'data-processing'],
    currentLoad: 0,
    maxConcurrentTasks: 3,
    currentTasks: 0,
    status: 'idle',
    lastHeartbeat: new Date(),
  };

  const agent2: AgentCapabilities = {
    agentId: 'agent2',
    type: 'worker',
    capabilities: ['compute', 'analytics'],
    currentLoad: 0,
    maxConcurrentTasks: 5,
    currentTasks: 0,
    status: 'idle',
    lastHeartbeat: new Date(),
  };

  coordinator.registerAgent(agent1);
  coordinator.registerAgent(agent2);

  // 创建任务
  const task1: Task = {
    id: 'task1',
    type: 'compute',
    data: { operation: 'sum', values: [1, 2, 3] },
    priority: 7,
    createdAt: new Date(),
  };

  const task2: Task = {
    id: 'task2',
    type: 'analytics',
    data: { operation: 'analyze', dataset: 'sales' },
    priority: 5,
    createdAt: new Date(),
  };

  // 分配任务
  const criteria1: AssignmentCriteria = {
    requiredCapabilities: ['compute'],
    loadBalanceStrategy: 'least-busy',
    priority: 7,
  };

  const criteria2: AssignmentCriteria = {
    requiredCapabilities: ['analytics'],
    loadBalanceStrategy: 'round-robin',
    priority: 5,
  };

  const assignedAgent1 = await coordinator.assignTask(task1, criteria1);
  const assignedAgent2 = await coordinator.assignTask(task2, criteria2);

  console.log(`Task1 assigned to: ${assignedAgent1}`);
  console.log(`Task2 assigned to: ${assignedAgent2}`);

  console.log('\nCoordinator stats:', coordinator.getStats());
}

// ============================================================================
// 示例 6: 死锁检测
// ============================================================================

async function example6_deadlockDetection() {
  console.log('\n=== Example 6: Deadlock Detection ===\n');

  const { coordinator, sharedState } = createCommunicationSystem();

  // 模拟资源依赖
  coordinator.recordResourceDependency('agent1', 'resource_A');
  coordinator.recordResourceDependency('agent1', 'resource_B');
  coordinator.recordResourceDependency('agent2', 'resource_B');
  coordinator.recordResourceDependency('agent2', 'resource_A');

  // 创建循环依赖的锁
  const lock1 = await sharedState.lock('resource_A', 'agent1');
  const lock2 = await sharedState.lock('resource_B', 'agent2');

  // 检测死锁
  const deadlock = coordinator.detectDeadlock();

  if (deadlock) {
    console.log('Deadlock detected!');
    console.log('Involved agents:', deadlock.involvedAgents);
    console.log('Involved resources:', deadlock.involvedResources);
    console.log('Dependency chain:', deadlock.dependencyChain);
  } else {
    console.log('No deadlock detected');
  }

  // 清理
  sharedState.unlock(lock1);
  sharedState.unlock(lock2);
}

// ============================================================================
// 示例 7: 代理同步
// ============================================================================

async function example7_agentSync() {
  console.log('\n=== Example 7: Agent Synchronization ===\n');

  const { coordinator, sharedState } = createCommunicationSystem();

  const agentIds = ['agent1', 'agent2', 'agent3'];

  // 模拟代理到达屏障
  setTimeout(() => {
    const barrier = sharedState.get<any>('barrier:test');
    if (barrier) {
      sharedState.set(barrier.barrierKey, { ...barrier, arrived: 1 });
    }
  }, 500);

  setTimeout(() => {
    const barrier = sharedState.get<any>('barrier:test');
    if (barrier) {
      sharedState.set(barrier.barrierKey, { ...barrier, arrived: 2 });
    }
  }, 1000);

  setTimeout(() => {
    const barrier = sharedState.get<any>('barrier:test');
    if (barrier) {
      sharedState.set(barrier.barrierKey, { ...barrier, arrived: 3 });
    }
  }, 1500);

  console.log('Waiting for all agents to synchronize...');
  // Note: coordinator.synchronize() would be used in real implementation
  console.log('All agents synchronized!');
}

// ============================================================================
// 运行所有示例
// ============================================================================

async function runAllExamples() {
  try {
    await example1_basicMessaging();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example2_requestResponse();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example3_sharedState();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example4_locks();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example5_taskCoordination();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example6_deadlockDetection();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example7_agentSync();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// 只在直接运行时执行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export {
  example1_basicMessaging,
  example2_requestResponse,
  example3_sharedState,
  example4_locks,
  example5_taskCoordination,
  example6_deadlockDetection,
  example7_agentSync,
};
