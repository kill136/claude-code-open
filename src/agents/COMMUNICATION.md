# 代理间通信系统 (Agent Communication System)

## 概述

代理间通信系统提供了一套完整的基础设施，用于实现多个代理之间的协作、通信和资源协调。

## 核心组件

### 1. AgentMessageBus（消息总线）

消息总线负责代理间的消息传递和路由。

**主要功能:**
- 点对点消息传递 (P2P)
- 发布/订阅模式 (Pub/Sub)
- 请求/响应模式 (Request/Response)
- 广播消息 (Broadcast)
- 消息队列管理
- 优先级处理
- 消息历史记录

**示例:**
```typescript
import { AgentMessageBus } from './communication.js';

const messageBus = new AgentMessageBus();

// 订阅消息
messageBus.subscribe('agent1', ['task', 'notification']);

// 发送消息
await messageBus.send({
  id: '1',
  from: 'coordinator',
  to: 'agent1',
  type: 'task',
  payload: { action: 'process' },
  timestamp: new Date(),
  priority: 5
});

// 广播消息
await messageBus.broadcast('notification', { message: 'Update available' });

// 请求-响应
const response = await messageBus.request(
  'agent2',
  'data:request',
  { query: 'SELECT * FROM users' },
  'agent1',
  5000 // timeout
);
```

### 2. SharedStateManager（共享状态管理器）

共享状态管理器实现代理间的状态共享和并发访问控制。

**主要功能:**
- 键值存储
- 状态监听 (Watch)
- 锁机制 (Lock)
- 原子操作 (CAS, Increment)
- 并发访问控制

**示例:**
```typescript
import { SharedStateManager } from './communication.js';

const sharedState = new SharedStateManager();

// 设置和获取值
sharedState.set('counter', 0);
const value = sharedState.get('counter');

// 监听变化
const unwatch = sharedState.watch('counter', (value) => {
  console.log(`Counter changed to: ${value}`);
});

// 原子操作
sharedState.increment('counter', 1);
const swapped = sharedState.compareAndSwap('counter', 1, 10);

// 锁机制
const lock = await sharedState.lock('resource1', 'agent1', 5000);
try {
  // 临界区代码
  sharedState.set('shared_resource', 'processing');
} finally {
  sharedState.unlock(lock);
}
```

### 3. AgentCoordinator（代理协调器）

代理协调器负责任务分配、负载均衡和死锁检测。

**主要功能:**
- 代理注册和管理
- 任务分配
- 负载均衡策略
  - 最少繁忙 (least-busy)
  - 轮询 (round-robin)
  - 随机 (random)
  - 能力匹配 (capability-match)
- 任务等待和同步
- 死锁检测
- 资源依赖管理

**示例:**
```typescript
import { AgentCoordinator, AgentCapabilities, Task } from './communication.js';

const coordinator = new AgentCoordinator(messageBus, sharedState);

// 注册代理
const agent: AgentCapabilities = {
  agentId: 'agent1',
  type: 'worker',
  capabilities: ['compute', 'data-processing'],
  currentLoad: 0,
  maxConcurrentTasks: 3,
  currentTasks: 0,
  status: 'idle',
  lastHeartbeat: new Date()
};

coordinator.registerAgent(agent);

// 分配任务
const task: Task = {
  id: 'task1',
  type: 'compute',
  data: { operation: 'sum', values: [1, 2, 3] },
  priority: 7,
  createdAt: new Date()
};

const assignedAgent = await coordinator.assignTask(task, {
  requiredCapabilities: ['compute'],
  loadBalanceStrategy: 'least-busy',
  priority: 7
});

// 等待任务完成
const results = await coordinator.waitForCompletion(['task1'], 10000);

// 代理同步
await coordinator.synchronize(['agent1', 'agent2', 'agent3']);

// 死锁检测
const deadlock = coordinator.detectDeadlock();
if (deadlock) {
  console.log('Deadlock detected:', deadlock.involvedAgents);
}
```

## 通信模式

### 1. 点对点 (Point-to-Point)

直接向特定代理发送消息。

```typescript
await messageBus.send({
  id: '1',
  from: 'agent1',
  to: 'agent2',
  type: 'data',
  payload: { value: 42 },
  timestamp: new Date(),
  priority: 5
});
```

### 2. 发布/订阅 (Publish/Subscribe)

代理订阅特定类型的消息，当消息发布时自动接收。

```typescript
// 订阅
messageBus.subscribe('agent1', ['update', 'notification'], (message) => {
  console.log('Received:', message);
});

// 发布
await messageBus.broadcast('update', { version: '2.0' });
```

### 3. 请求/响应 (Request/Response)

发送请求并等待响应。

```typescript
// 请求方
const response = await messageBus.request(
  'agent2',
  'query',
  { table: 'users' },
  'agent1',
  5000
);

// 响应方
messageBus.subscribe('agent2', ['query'], async (message) => {
  const result = await processQuery(message.payload);
  await messageBus.respond(message, result);
});
```

### 4. 广播 (Broadcast)

向所有订阅的代理发送消息。

```typescript
await messageBus.broadcast('system:shutdown', {
  reason: 'maintenance',
  timestamp: new Date()
});
```

## 使用场景

### 场景 1: 分布式任务处理

```typescript
// 创建通信系统
const { messageBus, sharedState, coordinator } = createCommunicationSystem();

// 注册工作代理
for (let i = 0; i < 5; i++) {
  coordinator.registerAgent({
    agentId: `worker-${i}`,
    type: 'worker',
    capabilities: ['compute', 'io'],
    currentLoad: 0,
    maxConcurrentTasks: 10,
    currentTasks: 0,
    status: 'idle',
    lastHeartbeat: new Date()
  });
}

// 分配任务
const tasks = [/* ... */];
const assignments = await Promise.all(
  tasks.map(task => coordinator.assignTask(task, {
    loadBalanceStrategy: 'least-busy'
  }))
);

// 等待所有任务完成
const results = await coordinator.waitForCompletion(
  tasks.map(t => t.id),
  30000
);
```

### 场景 2: 共享缓存

```typescript
// Agent 1: 写入缓存
await sharedState.lock('cache', 'agent1');
sharedState.set('cache:users', userData);
sharedState.unlock(lock);

// Agent 2: 读取缓存
const cachedUsers = sharedState.get('cache:users');
if (!cachedUsers) {
  // 缓存未命中，从数据库加载
}
```

### 场景 3: 协调多个代理

```typescript
// 创建协调任务
const task = {
  id: 'analyze-data',
  subtasks: ['collect', 'process', 'visualize']
};

// 分配子任务给不同的代理
const collectAgent = await coordinator.assignTask(subtask1, {
  requiredCapabilities: ['data-collection']
});

const processAgent = await coordinator.assignTask(subtask2, {
  requiredCapabilities: ['data-processing']
});

const visualizeAgent = await coordinator.assignTask(subtask3, {
  requiredCapabilities: ['visualization']
});

// 同步所有代理
await coordinator.synchronize([collectAgent, processAgent, visualizeAgent]);
```

## 性能考虑

1. **消息队列大小**: 默认最大 100 条消息，超过时会移除低优先级消息
2. **消息历史**: 默认保留最近 1000 条消息
3. **锁超时**: 建议设置合理的超时时间，避免死锁
4. **心跳间隔**: 代理应该每 5 秒发送一次心跳
5. **负载均衡**: 根据实际场景选择合适的策略

## 错误处理

```typescript
try {
  // 发送消息
  await messageBus.send(message);
} catch (error) {
  console.error('Message send failed:', error);
}

try {
  // 获取锁
  const lock = await sharedState.lock('resource', 'agent1', 5000);
  // ...
} catch (error) {
  console.error('Lock timeout:', error);
}

try {
  // 分配任务
  const agent = await coordinator.assignTask(task, criteria);
} catch (error) {
  console.error('No suitable agent:', error);
}
```

## 监控和调试

```typescript
// 消息总线统计
const busStats = messageBus.getStats();
console.log('Total messages:', busStats.totalMessages);
console.log('Active subscriptions:', busStats.activeSubscriptions);
console.log('Queue sizes:', busStats.queueSizes);

// 共享状态统计
const stateStats = sharedState.getStats();
console.log('State size:', stateStats.stateSize);
console.log('Watchers:', stateStats.watchersCount);
console.log('Locks:', stateStats.locksCount);

// 协调器统计
const coordStats = coordinator.getStats();
console.log('Total agents:', coordStats.totalAgents);
console.log('Active agents:', coordStats.activeAgents);
console.log('Total tasks:', coordStats.totalTasks);
console.log('Average load:', coordStats.averageLoad);

// 事件监听
messageBus.on('message:sent', (message) => {
  console.log('Message sent:', message.id);
});

sharedState.on('lock:acquired', (lock) => {
  console.log('Lock acquired:', lock.key);
});

coordinator.on('task:assigned', ({ task, agentId }) => {
  console.log(`Task ${task.id} assigned to ${agentId}`);
});

coordinator.on('deadlock:detected', (deadlock) => {
  console.error('DEADLOCK:', deadlock);
});
```

## 最佳实践

1. **使用工厂函数**: 使用 `createCommunicationSystem()` 创建完整的系统
2. **设置合理的优先级**: 紧急消息使用高优先级 (8-10)
3. **及时释放锁**: 使用 try-finally 确保锁被释放
4. **监控死锁**: 定期调用 `coordinator.detectDeadlock()`
5. **清理资源**: 任务完成后取消订阅和监听
6. **错误处理**: 捕获并处理所有异常
7. **超时设置**: 所有异步操作都应该设置超时
8. **心跳机制**: 定期发送心跳保持代理在线状态

## API 参考

详见代码中的 TypeScript 类型定义和注释。

## 示例代码

完整的使用示例请参考 `communication.example.ts` 文件。
