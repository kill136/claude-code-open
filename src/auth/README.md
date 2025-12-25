# OAuth 认证系统完整实现

## 概述

这是一个完整的 OAuth 2.0 认证系统实现，基于官方 Claude Code CLI 的逆向工程，支持所有标准 OAuth 流程。

## 功能特性

### ✅ 已实现的功能

1. **双流程支持**
   - Authorization Code Flow with PKCE（授权码流程）
   - Device Code Flow（设备授权流程）

2. **多账户支持**
   - Claude.ai 账户（订阅用户）
   - Console 账户（API 用户）
   - API Key 认证

3. **Token 管理**
   - 自动 Token 刷新机制
   - Token 加密存储（AES-256-CBC）
   - 防并发刷新锁
   - 过期时间检测和处理

4. **安全性**
   - PKCE (Proof Key for Code Exchange)
   - State 参数验证
   - 加密存储敏感数据
   - 文件权限保护（0600）

5. **会话管理**
   - 认证状态持久化
   - 过期时间追踪
   - 自动刷新触发

## 使用方法

### 1. Authorization Code Flow（推荐）

适用于有浏览器环境的场景：

```typescript
import { startAuthorizationCodeFlow } from './auth/index.js';

// 使用 Console 账户登录
const auth = await startAuthorizationCodeFlow('console');

// 或使用 Claude.ai 账户登录
const auth = await startAuthorizationCodeFlow('claude.ai');
```

流程：
1. 生成授权 URL 并打开浏览器
2. 用户在浏览器中授权
3. 回调到本地服务器（localhost:9876）
4. 交换授权码获取 Token
5. 加密保存到 ~/.claude/auth.json

### 2. Device Code Flow

适用于无浏览器环境（SSH、远程服务器等）：

```typescript
import { startDeviceCodeFlow } from './auth/index.js';

// 启动设备授权流程
const auth = await startDeviceCodeFlow('console');
```

流程：
1. 请求设备码
2. 显示验证 URL 和用户码
3. 用户在任何设备上访问 URL 并输入码
4. 轮询 Token 端点直到授权完成
5. 保存 Token

### 3. 统一 OAuth 入口

自动选择最佳流程：

```typescript
import { startOAuthLogin } from './auth/index.js';

// 默认使用 Authorization Code Flow
const auth = await startOAuthLogin({
  accountType: 'console'
});

// 强制使用 Device Code Flow
const auth = await startOAuthLogin({
  accountType: 'claude.ai',
  useDeviceFlow: true
});
```

### 4. API Key 认证

```typescript
import { setApiKey, initAuth } from './auth/index.js';

// 设置 API Key（不持久化）
setApiKey('sk-ant-xxx');

// 设置并保存到文件
setApiKey('sk-ant-xxx', true);

// 初始化认证（按优先级检查）
const auth = initAuth();
```

### 5. Token 刷新

```typescript
import { refreshTokenAsync, getAuth } from './auth/index.js';

const currentAuth = getAuth();
if (currentAuth) {
  const newAuth = await refreshTokenAsync(currentAuth);
}

// 自动刷新（在 getApiKey() 中自动触发）
import { getApiKey } from './auth/index.js';
const apiKey = getApiKey(); // 自动检查过期并刷新
```

### 6. 认证状态查询

```typescript
import {
  isAuthenticated,
  isAuthExpired,
  getAuthType,
  getAccountType,
  getAuthExpiration,
  getAuthTimeRemaining,
  getUserInfo
} from './auth/index.js';

// 检查是否已认证
if (isAuthenticated()) {
  console.log('已认证');
}

// 检查是否过期
if (isAuthExpired()) {
  console.log('认证已过期');
}

// 获取认证类型
const authType = getAuthType(); // 'api_key' | 'oauth' | null

// 获取账户类型
const accountType = getAccountType(); // 'claude.ai' | 'console' | 'api' | null

// 获取过期时间
const expiration = getAuthExpiration(); // Date | null

// 获取剩余时间（秒）
const remaining = getAuthTimeRemaining(); // number | null

// 获取用户信息
const userInfo = getUserInfo(); // { userId?: string, email?: string } | null
```

### 7. 登出和清理

```typescript
import { logout, clearCredentials, clearAccountAuth } from './auth/index.js';

// 仅清除 OAuth Token
logout();

// 清除所有凭证（包括 API Key）
clearCredentials();

// 清除特定账户的认证
clearAccountAuth('console');
```

## 配置

### OAuth 端点配置

```typescript
const OAUTH_ENDPOINTS = {
  'claude.ai': {
    clientId: 'claude-code-cli',
    authorizationEndpoint: 'https://claude.ai/oauth/authorize',
    deviceCodeEndpoint: 'https://claude.ai/oauth/device/code',
    tokenEndpoint: 'https://claude.ai/oauth/token',
    redirectUri: 'http://localhost:9876/callback',
    scope: ['read', 'write', 'chat'],
  },
  console: {
    clientId: 'claude-code-cli',
    authorizationEndpoint: 'https://console.anthropic.com/oauth/authorize',
    deviceCodeEndpoint: 'https://console.anthropic.com/oauth/device/code',
    tokenEndpoint: 'https://console.anthropic.com/oauth/token',
    redirectUri: 'http://localhost:9876/callback',
    scope: ['api.read', 'api.write'],
  },
};
```

### 文件存储位置

- **OAuth Token**: `~/.claude/auth.json`（加密存储）
- **API Key**: `~/.claude/credentials.json`（明文存储，仅用于向后兼容）
- **加密密钥**: 基于主机名和用户名生成（`os.hostname() + os.userInfo().username`）

### 加密机制

使用 AES-256-CBC 加密敏感字段：
- `apiKey`
- `accessToken`
- `refreshToken`

加密格式：`IV:加密数据`（均为十六进制）

## 安全最佳实践

1. **Token 存储**
   - 文件权限设置为 0600（仅所有者可读写）
   - 敏感字段使用 AES-256-CBC 加密
   - 加密密钥基于机器特征生成

2. **PKCE 实现**
   - 使用 32 字节随机 code_verifier
   - SHA-256 哈希生成 code_challenge
   - base64url 编码

3. **State 参数**
   - 使用 32 字节随机 state
   - 防止 CSRF 攻击

4. **Token 刷新**
   - 使用锁防止并发刷新
   - 提前 5 分钟自动刷新
   - 刷新失败时提示重新登录

5. **错误处理**
   - 网络错误自动重试
   - 明确的错误消息
   - 超时保护

## 认证优先级

`initAuth()` 按以下优先级检查认证：

1. 环境变量（`ANTHROPIC_API_KEY` 或 `CLAUDE_API_KEY`）
2. 凭证文件（`~/.claude/credentials.json`）
3. OAuth Token（`~/.claude/auth.json`，加密存储）

## 类型定义

```typescript
export interface AuthConfig {
  type: 'api_key' | 'oauth';
  accountType?: 'claude.ai' | 'console' | 'api';
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
  userId?: string;
  email?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  deviceCodeEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope: string[];
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}
```

## 完整示例

### 示例 1：交互式登录

```typescript
import {
  startOAuthLogin,
  isAuthenticated,
  getApiKey
} from './auth/index.js';

async function login() {
  console.log('Starting OAuth login...');

  try {
    const auth = await startOAuthLogin({
      accountType: 'console',
      useDeviceFlow: false
    });

    console.log('Login successful!');
    console.log('Access Token:', auth.accessToken?.substring(0, 20) + '...');
    console.log('Expires At:', new Date(auth.expiresAt!).toLocaleString());

    // 使用 API Key
    const apiKey = getApiKey();
    console.log('API Key:', apiKey);

  } catch (error) {
    console.error('Login failed:', error);
  }
}

login();
```

### 示例 2：自动刷新 Token

```typescript
import {
  initAuth,
  getApiKey,
  isAuthExpired,
  refreshTokenAsync
} from './auth/index.js';

async function ensureAuth() {
  // 初始化认证
  const auth = initAuth();

  if (!auth) {
    throw new Error('Not authenticated');
  }

  // 检查是否过期
  if (isAuthExpired()) {
    console.log('Token expired, refreshing...');
    const newAuth = await refreshTokenAsync(auth);

    if (!newAuth) {
      throw new Error('Token refresh failed');
    }
  }

  // 获取有效的 API Key
  const apiKey = getApiKey(); // 自动触发刷新
  return apiKey;
}

// 使用
ensureAuth().then(apiKey => {
  console.log('Using API Key:', apiKey);
});
```

### 示例 3：多账户支持

```typescript
import {
  startOAuthLogin,
  logout,
  getAccountType
} from './auth/index.js';

async function switchAccount(accountType: 'claude.ai' | 'console') {
  // 登出当前账户
  logout();

  // 登录新账户
  const auth = await startOAuthLogin({ accountType });

  console.log('Switched to:', getAccountType());
  return auth;
}

// 使用
await switchAccount('claude.ai');
```

## 故障排除

### Token 刷新失败

如果 Token 刷新失败：
1. 检查网络连接
2. 验证 refresh_token 是否有效
3. 重新登录：`logout()` 然后 `startOAuthLogin()`

### 加密错误

如果解密失败（例如更换机器）：
1. 删除 `~/.claude/auth.json`
2. 重新登录

### 端口占用

如果端口 9876 被占用：
1. 修改 `OAUTH_ENDPOINTS` 中的 `redirectUri`
2. 或使用 Device Code Flow

## 与官方 CLI 的差异

这是一个教育性的逆向工程项目：

- ✅ 实现了完整的 OAuth 2.0 流程
- ✅ 支持 PKCE 和 Device Code Flow
- ✅ Token 加密存储
- ⚠️ OAuth 端点可能不是官方端点（需要官方授权）
- ⚠️ clientId 可能不同于官方值

如需使用官方 OAuth，请：
1. 使用官方 Claude Code CLI
2. 或从官方 CLI 复制 `~/.claude/auth.json`

## 贡献

欢迎贡献！主要改进方向：

- [ ] 添加 OAuth token 撤销支持
- [ ] 支持多账户同时存储
- [ ] 添加 token 自动续期定时器
- [ ] 实现更安全的密钥存储（如 Keychain）
- [ ] 添加 OAuth scope 动态选择
- [ ] 支持自定义 OAuth 端点

## 许可证

本项目遵循 MIT 许可证。这是一个教育性项目，用于学习和理解 OAuth 2.0 流程。
