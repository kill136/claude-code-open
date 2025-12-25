/**
 * OAuth 认证系统使用示例
 * 演示如何使用增强的认证功能
 */

import {
  // OAuth 流程
  startOAuthLogin,
  startAuthorizationCodeFlow,
  startDeviceCodeFlow,

  // Token 管理
  refreshTokenAsync,

  // 认证状态
  initAuth,
  getAuth,
  getApiKey,
  isAuthenticated,
  isAuthExpired,
  getAuthType,
  getAccountType,
  getAuthExpiration,
  getAuthTimeRemaining,
  getUserInfo,

  // 登出
  logout,
  clearCredentials,

  // API Key
  setApiKey,
  validateApiKey,
} from '../src/auth/index.js';

// ============ 示例 1: 基本 OAuth 登录 ============

async function example1_BasicOAuthLogin() {
  console.log('\n=== 示例 1: 基本 OAuth 登录 ===\n');

  try {
    // 使用默认的 Authorization Code Flow
    const auth = await startOAuthLogin({
      accountType: 'console'
    });

    console.log('✅ 登录成功!');
    console.log('访问令牌:', auth.accessToken?.substring(0, 20) + '...');
    console.log('过期时间:', new Date(auth.expiresAt!).toLocaleString());
    console.log('作用域:', auth.scope?.join(', '));
  } catch (error) {
    console.error('❌ 登录失败:', error);
  }
}

// ============ 示例 2: Device Code Flow（远程服务器） ============

async function example2_DeviceCodeFlow() {
  console.log('\n=== 示例 2: Device Code Flow ===\n');

  try {
    // 适用于 SSH、远程服务器等无浏览器环境
    const auth = await startOAuthLogin({
      accountType: 'console',
      useDeviceFlow: true
    });

    console.log('✅ 设备授权成功!');
    console.log('访问令牌:', auth.accessToken?.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ 设备授权失败:', error);
  }
}

// ============ 示例 3: 多账户切换 ============

async function example3_AccountSwitching() {
  console.log('\n=== 示例 3: 多账户切换 ===\n');

  // 登录 Console 账户
  console.log('登录 Console 账户...');
  await startAuthorizationCodeFlow('console');
  console.log('当前账户:', getAccountType());

  // 切换到 Claude.ai 账户
  console.log('\n切换到 Claude.ai 账户...');
  logout(); // 先登出
  await startAuthorizationCodeFlow('claude.ai');
  console.log('当前账户:', getAccountType());
}

// ============ 示例 4: 自动 Token 刷新 ============

async function example4_AutoTokenRefresh() {
  console.log('\n=== 示例 4: 自动 Token 刷新 ===\n');

  // 初始化认证
  const auth = initAuth();

  if (!auth) {
    console.log('未认证，请先登录');
    return;
  }

  console.log('当前认证类型:', getAuthType());
  console.log('账户类型:', getAccountType());

  // 检查过期状态
  if (isAuthExpired()) {
    console.log('Token 已过期，正在刷新...');

    const newAuth = await refreshTokenAsync(auth);
    if (newAuth) {
      console.log('✅ Token 刷新成功!');
      console.log('新的过期时间:', getAuthExpiration()?.toLocaleString());
    } else {
      console.log('❌ Token 刷新失败，请重新登录');
    }
  } else {
    const remaining = getAuthTimeRemaining();
    console.log(`✅ Token 有效，剩余时间: ${remaining} 秒`);

    // getApiKey() 会自动检查并刷新即将过期的 Token
    const apiKey = getApiKey();
    console.log('API Key:', apiKey?.substring(0, 20) + '...');
  }
}

// ============ 示例 5: 完整的认证流程 ============

async function example5_CompleteAuthFlow() {
  console.log('\n=== 示例 5: 完整的认证流程 ===\n');

  // 步骤 1: 检查现有认证
  console.log('步骤 1: 检查现有认证...');
  let auth = initAuth();

  if (!auth) {
    // 步骤 2: 未认证，启动登录
    console.log('步骤 2: 未认证，启动登录...');
    auth = await startOAuthLogin({ accountType: 'console' });
  } else {
    console.log('步骤 2: 已认证');

    // 步骤 3: 检查过期
    console.log('步骤 3: 检查 Token 是否过期...');
    if (isAuthExpired()) {
      console.log('Token 已过期，刷新中...');
      const newAuth = await refreshTokenAsync(auth);

      if (!newAuth) {
        console.log('刷新失败，重新登录...');
        auth = await startOAuthLogin({ accountType: 'console' });
      }
    }
  }

  // 步骤 4: 使用认证
  console.log('步骤 4: 使用认证...');
  const apiKey = getApiKey();
  console.log('✅ 可以使用 API Key:', apiKey?.substring(0, 20) + '...');

  // 步骤 5: 显示认证信息
  console.log('\n步骤 5: 认证信息:');
  console.log('  认证类型:', getAuthType());
  console.log('  账户类型:', getAccountType());
  console.log('  过期时间:', getAuthExpiration()?.toLocaleString());
  console.log('  剩余时间:', getAuthTimeRemaining(), '秒');

  const userInfo = getUserInfo();
  if (userInfo?.userId) {
    console.log('  用户 ID:', userInfo.userId);
  }
  if (userInfo?.email) {
    console.log('  邮箱:', userInfo.email);
  }
}

// ============ 示例 6: API Key 认证 ============

async function example6_ApiKeyAuth() {
  console.log('\n=== 示例 6: API Key 认证 ===\n');

  const apiKey = 'sk-ant-api03-xxx...'; // 替换为真实的 API Key

  // 验证 API Key
  console.log('验证 API Key...');
  const isValid = await validateApiKey(apiKey);

  if (isValid) {
    console.log('✅ API Key 有效');

    // 设置并保存
    setApiKey(apiKey, true);
    console.log('API Key 已保存到 ~/.claude/credentials.json');

    // 验证认证状态
    console.log('认证状态:', isAuthenticated() ? '已认证' : '未认证');
    console.log('认证类型:', getAuthType());
  } else {
    console.log('❌ API Key 无效');
  }
}

// ============ 示例 7: 认证状态监控 ============

async function example7_AuthMonitoring() {
  console.log('\n=== 示例 7: 认证状态监控 ===\n');

  // 初始化
  const auth = initAuth();

  if (!auth) {
    console.log('未认证');
    return;
  }

  console.log('=== 认证状态 ===');
  console.log('已认证:', isAuthenticated());
  console.log('认证类型:', getAuthType());
  console.log('账户类型:', getAccountType());

  if (auth.type === 'oauth') {
    console.log('\n=== OAuth 详情 ===');
    console.log('已过期:', isAuthExpired());
    console.log('过期时间:', getAuthExpiration()?.toLocaleString());

    const remaining = getAuthTimeRemaining();
    if (remaining !== null) {
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      console.log('剩余时间:', `${hours}小时 ${minutes}分钟`);
    }

    // 显示作用域
    const currentAuth = getAuth();
    if (currentAuth?.scope) {
      console.log('权限范围:', currentAuth.scope.join(', '));
    }
  }

  // 显示用户信息
  const userInfo = getUserInfo();
  if (userInfo) {
    console.log('\n=== 用户信息 ===');
    if (userInfo.userId) console.log('用户 ID:', userInfo.userId);
    if (userInfo.email) console.log('邮箱:', userInfo.email);
  }
}

// ============ 示例 8: 登出和清理 ============

async function example8_LogoutAndCleanup() {
  console.log('\n=== 示例 8: 登出和清理 ===\n');

  console.log('当前认证状态:', isAuthenticated() ? '已认证' : '未认证');

  if (isAuthenticated()) {
    console.log('认证类型:', getAuthType());
    console.log('账户类型:', getAccountType());

    // 仅清除 OAuth Token
    console.log('\n执行登出...');
    logout();
    console.log('✅ OAuth Token 已清除');
    console.log('认证状态:', isAuthenticated() ? '已认证' : '未认证');

    // 或者清除所有凭证（包括 API Key）
    // clearCredentials();
    // console.log('✅ 所有凭证已清除');
  } else {
    console.log('当前未认证，无需登出');
  }
}

// ============ 示例 9: 错误处理 ============

async function example9_ErrorHandling() {
  console.log('\n=== 示例 9: 错误处理 ===\n');

  try {
    // 尝试登录
    const auth = await startOAuthLogin({
      accountType: 'console'
    });

    console.log('✅ 登录成功');

  } catch (error) {
    // 处理不同类型的错误
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('❌ 登录超时，请重试');
      } else if (error.message.includes('denied')) {
        console.error('❌ 用户拒绝授权');
      } else if (error.message.includes('network')) {
        console.error('❌ 网络错误，请检查连接');
      } else {
        console.error('❌ 登录失败:', error.message);
      }
    }
  }
}

// ============ 示例 10: 实际应用场景 ============

async function example10_RealWorldUsage() {
  console.log('\n=== 示例 10: 实际应用场景 ===\n');

  /**
   * 确保有效认证的辅助函数
   */
  async function ensureAuthenticated(): Promise<string> {
    // 1. 尝试初始化现有认证
    let auth = initAuth();

    // 2. 如果未认证，启动登录
    if (!auth || !isAuthenticated()) {
      console.log('未认证，启动登录流程...');
      auth = await startOAuthLogin({ accountType: 'console' });
    }

    // 3. 检查 OAuth Token 是否过期
    if (auth.type === 'oauth' && isAuthExpired()) {
      console.log('Token 已过期，尝试刷新...');
      const newAuth = await refreshTokenAsync(auth);

      if (!newAuth) {
        console.log('刷新失败，重新登录...');
        auth = await startOAuthLogin({ accountType: 'console' });
      }
    }

    // 4. 获取并返回 API Key
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('无法获取 API Key');
    }

    return apiKey;
  }

  /**
   * 使用 Claude API 的示例
   */
  async function callClaudeAPI() {
    try {
      // 确保认证有效
      const apiKey = await ensureAuthenticated();

      console.log('✅ 认证有效，调用 API...');
      console.log('使用 API Key:', apiKey.substring(0, 20) + '...');

      // 这里可以调用实际的 Claude API
      // const response = await fetch('https://api.anthropic.com/v1/messages', {
      //   method: 'POST',
      //   headers: {
      //     'x-api-key': apiKey,
      //     'anthropic-version': '2023-06-01',
      //     'content-type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     model: 'claude-3-5-sonnet-20241022',
      //     max_tokens: 1024,
      //     messages: [{ role: 'user', content: 'Hello!' }]
      //   })
      // });

      console.log('✅ API 调用完成');

    } catch (error) {
      console.error('❌ API 调用失败:', error);
    }
  }

  // 执行示例
  await callClaudeAPI();
}

// ============ 主函数 ============

async function main() {
  console.log('╭─────────────────────────────────────────╮');
  console.log('│   OAuth 认证系统使用示例                 │');
  console.log('╰─────────────────────────────────────────╯');

  // 选择要运行的示例
  const examples = [
    { name: '基本 OAuth 登录', fn: example1_BasicOAuthLogin },
    { name: 'Device Code Flow', fn: example2_DeviceCodeFlow },
    { name: '多账户切换', fn: example3_AccountSwitching },
    { name: '自动 Token 刷新', fn: example4_AutoTokenRefresh },
    { name: '完整的认证流程', fn: example5_CompleteAuthFlow },
    { name: 'API Key 认证', fn: example6_ApiKeyAuth },
    { name: '认证状态监控', fn: example7_AuthMonitoring },
    { name: '登出和清理', fn: example8_LogoutAndCleanup },
    { name: '错误处理', fn: example9_ErrorHandling },
    { name: '实际应用场景', fn: example10_RealWorldUsage },
  ];

  // 运行示例 7（认证状态监控）- 安全的示例
  const exampleIndex = 6; // 索引从 0 开始

  console.log(`\n运行示例: ${examples[exampleIndex].name}\n`);
  await examples[exampleIndex].fn();

  console.log('\n╭─────────────────────────────────────────╮');
  console.log('│   示例运行完成                           │');
  console.log('╰─────────────────────────────────────────╯\n');
}

// 运行主函数
// 仅在直接运行此文件时执行
// if (import.meta.url === `file://${process.argv[1]}`) {
//   main().catch(console.error);
// }

export {
  example1_BasicOAuthLogin,
  example2_DeviceCodeFlow,
  example3_AccountSwitching,
  example4_AutoTokenRefresh,
  example5_CompleteAuthFlow,
  example6_ApiKeyAuth,
  example7_AuthMonitoring,
  example8_LogoutAndCleanup,
  example9_ErrorHandling,
  example10_RealWorldUsage,
};
