/**
 * Teleport 使用示例
 *
 * 演示如何使用 teleport 模块连接远程会话
 */

import { createRemoteSession, connectToRemoteSession } from './index.js';
import type { RemoteMessage } from './types.js';

/**
 * 示例 1: 基本连接
 */
async function example1_BasicConnection() {
  console.log('=== 示例 1: 基本连接 ===\n');

  try {
    // 创建远程会话
    const session = createRemoteSession({
      sessionId: 'your-session-uuid',
      ingressUrl: 'wss://your-server.com/teleport',
      authToken: 'your-auth-token',
    });

    // 监听连接事件
    session.on('connecting', () => {
      console.log('正在连接...');
    });

    session.on('connected', () => {
      console.log('已连接到远程会话');
    });

    session.on('disconnected', () => {
      console.log('连接已断开');
    });

    session.on('error', (error) => {
      console.error('错误:', error.message);
    });

    // 连接
    await session.connect();

    // 等待一段时间后断开
    setTimeout(async () => {
      await session.disconnect();
    }, 5000);

  } catch (error) {
    console.error('连接失败:', error);
  }
}

/**
 * 示例 2: 消息监听和发送
 */
async function example2_MessageHandling() {
  console.log('=== 示例 2: 消息处理 ===\n');

  const session = await connectToRemoteSession(
    'session-uuid',
    'wss://your-server.com/teleport',
    'your-token'
  );

  // 监听不同类型的消息
  session.on('message', (msg: RemoteMessage) => {
    console.log(`收到 ${msg.type} 消息:`, msg.payload);

    // 根据消息类型处理
    switch (msg.type) {
      case 'message':
        console.log('用户消息:', msg.payload);
        break;

      case 'assistant_message':
        console.log('助手回复:', msg.payload);
        break;

      case 'tool_result':
        console.log('工具执行结果:', msg.payload);
        break;
    }
  });

  // 发送消息
  await session.sendMessage({
    type: 'message',
    sessionId: 'session-uuid',
    timestamp: new Date().toISOString(),
    payload: {
      content: 'Hello from teleport!',
    },
  });
}

/**
 * 示例 3: 同步状态管理
 */
async function example3_SyncManagement() {
  console.log('=== 示例 3: 同步管理 ===\n');

  const session = createRemoteSession({
    sessionId: 'session-uuid',
    ingressUrl: 'wss://your-server.com/teleport',
  });

  // 监听同步事件
  session.on('sync_start', () => {
    console.log('开始同步会话数据...');
  });

  session.on('sync_complete', (data) => {
    console.log('同步完成:');
    console.log(`  总消息数: ${data.totalMessages}`);
    console.log(`  同步的消息: ${data.messages?.length || 0}`);
  });

  session.on('sync_error', (error) => {
    console.error('同步失败:', error);
  });

  await session.connect();

  // 手动触发同步
  await session.requestSync();
}

/**
 * 示例 4: 状态查询
 */
async function example4_StateInspection() {
  console.log('=== 示例 4: 状态查询 ===\n');

  const session = createRemoteSession({
    sessionId: 'session-uuid',
    ingressUrl: 'wss://your-server.com/teleport',
  });

  await session.connect();

  // 查询当前状态
  const state = session.getState();

  console.log('连接状态:', state.connectionState);
  console.log('同步状态:', {
    syncing: state.syncState.syncing,
    lastSyncTime: state.syncState.lastSyncTime,
    syncedMessages: state.syncState.syncedMessages,
    syncError: state.syncState.syncError,
  });

  console.log('配置:', {
    sessionId: state.config.sessionId,
    ingressUrl: state.config.ingressUrl,
    hasAuthToken: !!state.config.authToken,
  });

  // 检查连接状态
  if (session.isConnected()) {
    console.log('✓ 会话已连接');
  } else {
    console.log('✗ 会话未连接');
  }
}

/**
 * 示例 5: 错误处理
 */
async function example5_ErrorHandling() {
  console.log('=== 示例 5: 错误处理 ===\n');

  const session = createRemoteSession({
    sessionId: 'session-uuid',
    ingressUrl: 'wss://your-server.com/teleport',
  });

  // 监听各种错误
  session.on('error', (error) => {
    console.error('连接错误:', error.message);
    // 处理连接错误
  });

  session.on('remote_error', (error, code) => {
    console.error(`远程错误 (${code}):`, error.message);
    // 处理远程会话错误
  });

  session.on('sync_error', (error) => {
    console.error('同步错误:', error);
    // 处理同步错误，可能需要重试
  });

  session.on('parse_error', (error) => {
    console.error('消息解析错误:', error);
    // 处理消息格式错误
  });

  try {
    await session.connect();
  } catch (error) {
    console.error('连接失败:', error);
    // 处理连接失败的情况
  }
}

/**
 * 示例 6: 使用环境变量
 */
async function example6_EnvironmentVariables() {
  console.log('=== 示例 6: 环境变量配置 ===\n');

  // 设置环境变量（通常在 shell 中设置）
  // export CLAUDE_TELEPORT_URL="wss://your-server.com/teleport"
  // export CLAUDE_TELEPORT_TOKEN="your-auth-token"

  // 使用便捷函数，会自动从环境变量读取
  try {
    const session = await connectToRemoteSession('session-uuid');

    console.log('已连接，使用环境变量中的配置');

    const state = session.getState();
    console.log('URL:', state.config.ingressUrl);
    console.log('有认证令牌:', !!state.config.authToken);

  } catch (error) {
    console.error('连接失败:', error);
    console.log('\n提示: 请设置以下环境变量:');
    console.log('  export CLAUDE_TELEPORT_URL="wss://your-server.com/teleport"');
    console.log('  export CLAUDE_TELEPORT_TOKEN="your-auth-token"');
  }
}

/**
 * 示例 7: 完整的工作流
 */
async function example7_CompleteWorkflow() {
  console.log('=== 示例 7: 完整工作流 ===\n');

  const sessionId = 'your-session-uuid';

  // 1. 创建会话
  const session = createRemoteSession({
    sessionId,
    ingressUrl: 'wss://your-server.com/teleport',
    authToken: 'your-token',
  });

  // 2. 设置事件监听器
  session.on('connected', () => {
    console.log('✓ 连接成功');
  });

  session.on('sync_complete', (data) => {
    console.log(`✓ 同步完成 (${data.totalMessages} 条消息)`);
  });

  session.on('message', (msg: RemoteMessage) => {
    console.log(`← 收到消息 (${msg.type})`);
  });

  session.on('disconnected', () => {
    console.log('✗ 连接断开');
  });

  try {
    // 3. 连接到远程会话
    console.log('正在连接...');
    await session.connect();

    // 4. 等待同步完成
    await new Promise(resolve => {
      session.once('sync_complete', resolve);
    });

    // 5. 发送测试消息
    console.log('发送测试消息...');
    await session.sendMessage({
      type: 'message',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { content: 'Test message' },
    });

    // 6. 工作一段时间...
    console.log('会话运行中...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 7. 优雅退出
    console.log('正在断开连接...');
    await session.disconnect();
    console.log('✓ 已断开连接');

  } catch (error) {
    console.error('工作流错误:', error);
  }
}

// 导出示例
export {
  example1_BasicConnection,
  example2_MessageHandling,
  example3_SyncManagement,
  example4_StateInspection,
  example5_ErrorHandling,
  example6_EnvironmentVariables,
  example7_CompleteWorkflow,
};

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Teleport 使用示例\n');
  console.log('可用的示例:');
  console.log('  1. 基本连接');
  console.log('  2. 消息处理');
  console.log('  3. 同步管理');
  console.log('  4. 状态查询');
  console.log('  5. 错误处理');
  console.log('  6. 环境变量配置');
  console.log('  7. 完整工作流');
  console.log('\n运行示例: node dist/teleport/example.js');
}
