/**
 * 增强的认证系统
 * 支持 API Key 和完整 OAuth 2.0 流程
 *
 * 功能特性:
 * - Device Code Flow (设备授权流程)
 * - Authorization Code Flow with PKCE (授权码流程)
 * - Token 自动刷新机制
 * - 多账户支持 (Claude.ai vs Console)
 * - Token 存储加密
 * - 会话过期处理
 * - 完整的登出清理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as crypto from 'crypto';

// ============ 类型定义 ============

export type AccountType = 'claude.ai' | 'console' | 'api';

export interface AuthConfig {
  type: 'api_key' | 'oauth';
  accountType?: AccountType;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
  userId?: string;
  email?: string;
  // 设备授权流程特有
  deviceCode?: string;
  userCode?: string;
  verificationUri?: string;
  interval?: number;
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

// ============ 常量配置 ============

// 认证配置文件路径
const AUTH_DIR = path.join(os.homedir(), '.claude');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');
const CREDENTIALS_FILE = path.join(AUTH_DIR, 'credentials.json');

// 加密密钥（基于机器特征生成）
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(os.hostname() + os.userInfo().username)
  .digest();

// OAuth 端点配置
const OAUTH_ENDPOINTS: Record<'claude.ai' | 'console', OAuthConfig> = {
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

// 当前认证状态
let currentAuth: AuthConfig | null = null;

// Token 刷新锁
let refreshPromise: Promise<AuthConfig | null> | null = null;

// ============ 加密工具函数 ============

/**
 * 加密数据
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密数据
 */
function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 安全地保存认证数据（加密）
 */
function saveAuthSecure(auth: AuthConfig): void {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 加密敏感字段
  const sensitiveFields = ['apiKey', 'accessToken', 'refreshToken'];
  const encryptedAuth: Record<string, unknown> = { ...auth };

  for (const field of sensitiveFields) {
    if (auth[field as keyof AuthConfig]) {
      encryptedAuth[field] = encrypt(auth[field as keyof AuthConfig] as string);
      encryptedAuth[`${field}_encrypted`] = true;
    }
  }

  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify(encryptedAuth, null, 2),
    { mode: 0o600 }
  );
}

/**
 * 安全地读取认证数据（解密）
 */
function loadAuthSecure(): AuthConfig | null {
  if (!fs.existsSync(AUTH_FILE)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

    // 解密敏感字段
    const sensitiveFields = ['apiKey', 'accessToken', 'refreshToken'];
    for (const field of sensitiveFields) {
      if (data[`${field}_encrypted`] && data[field]) {
        try {
          data[field] = decrypt(data[field]);
          delete data[`${field}_encrypted`];
        } catch (err) {
          console.error(`Failed to decrypt ${field}`);
          return null;
        }
      }
    }

    return data as AuthConfig;
  } catch (err) {
    console.error('Failed to load auth:', err);
    return null;
  }
}

// ============ 初始化和获取认证 ============

/**
 * 初始化认证系统
 */
export function initAuth(): AuthConfig | null {
  // 1. 检查环境变量 (最高优先级)
  const envApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (envApiKey) {
    currentAuth = {
      type: 'api_key',
      accountType: 'api',
      apiKey: envApiKey,
    };
    return currentAuth;
  }

  // 2. 检查凭证文件（未加密的 API Key）
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
      if (creds.apiKey) {
        currentAuth = {
          type: 'api_key',
          accountType: 'api',
          apiKey: creds.apiKey,
        };
        return currentAuth;
      }
    } catch (err) {
      // 忽略解析错误
    }
  }

  // 3. 检查 OAuth token（加密存储）
  const auth = loadAuthSecure();
  if (auth?.accessToken) {
    // 检查是否过期
    if (auth.expiresAt && auth.expiresAt < Date.now()) {
      // Token 已过期，尝试刷新
      console.log('Access token expired, attempting refresh...');
      // 异步刷新，暂时返回过期的认证
      refreshTokenAsync(auth).then((newAuth) => {
        if (newAuth) {
          currentAuth = newAuth;
        }
      });
    }
    currentAuth = auth;
    return currentAuth;
  }

  return null;
}

/**
 * 获取当前认证
 */
export function getAuth(): AuthConfig | null {
  return currentAuth;
}

/**
 * 获取 API Key（用于 SDK）
 */
export function getApiKey(): string | undefined {
  if (!currentAuth) {
    return undefined;
  }

  if (currentAuth.type === 'api_key') {
    return currentAuth.apiKey;
  }

  if (currentAuth.type === 'oauth') {
    // 检查 token 是否即将过期（提前 5 分钟刷新）
    if (currentAuth.expiresAt && currentAuth.expiresAt < Date.now() + 300000) {
      // 触发后台刷新
      ensureValidToken();
    }
    return currentAuth.accessToken;
  }

  return undefined;
}

/**
 * 设置 API Key
 */
export function setApiKey(apiKey: string, persist = false): void {
  currentAuth = {
    type: 'api_key',
    accountType: 'api',
    apiKey,
  };

  if (persist) {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify({ apiKey }, null, 2),
      { mode: 0o600 }
    );
  }
}

// ============ Authorization Code Flow with PKCE ============

/**
 * 启动 Authorization Code Flow OAuth 登录
 */
export async function startAuthorizationCodeFlow(
  accountType: 'claude.ai' | 'console' = 'console'
): Promise<AuthConfig> {
  const oauthConfig = OAUTH_ENDPOINTS[accountType];

  // 生成 state 和 PKCE
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // 构建授权 URL
  const authUrl = new URL(oauthConfig.authorizationEndpoint);
  authUrl.searchParams.set('client_id', oauthConfig.clientId);
  authUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', oauthConfig.scope.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('\n╭─────────────────────────────────────────╮');
  console.log(`│  OAuth Login - ${accountType.padEnd(25)}│`);
  console.log('╰─────────────────────────────────────────╯\n');
  console.log('Please open this URL in your browser:\n');
  console.log(authUrl.toString());
  console.log('\nWaiting for authorization...');

  // 启动本地服务器等待回调
  const authCode = await waitForCallback(oauthConfig.redirectUri, state);

  // 交换 token
  const tokenResponse = await exchangeAuthorizationCode(
    oauthConfig,
    authCode,
    codeVerifier
  );

  // 保存认证
  currentAuth = {
    type: 'oauth',
    accountType,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    scope: tokenResponse.scope?.split(' ') || oauthConfig.scope,
  };

  saveAuthSecure(currentAuth);

  console.log('\n✅ Authorization successful!');
  return currentAuth;
}

/**
 * 等待 OAuth 回调
 */
function waitForCallback(redirectUri: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(redirectUri);
    const port = parseInt(url.port) || 9876;

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '', `http://localhost:${port}`);

      if (reqUrl.pathname === '/callback') {
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');
        const error = reqUrl.searchParams.get('error');
        const errorDescription = reqUrl.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <style>
                  body { font-family: system-ui; text-align: center; padding: 50px; }
                  .error { color: #dc3545; }
                </style>
              </head>
              <body>
                <h1 class="error">✗ Authorization Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <style>
                  body { font-family: system-ui; text-align: center; padding: 50px; }
                  .error { color: #dc3545; }
                </style>
              </head>
              <body>
                <h1 class="error">✗ Invalid State</h1>
                <p>Security validation failed. Please try again.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('Invalid state parameter'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head>
                <style>
                  body { font-family: system-ui; text-align: center; padding: 50px; }
                  .error { color: #dc3545; }
                </style>
              </head>
              <body>
                <h1 class="error">✗ Missing Code</h1>
                <p>Authorization code not received. Please try again.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('Missing authorization code'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <style>
                body { font-family: system-ui; text-align: center; padding: 50px; }
                .success { color: #28a745; }
              </style>
            </head>
            <body>
              <h1 class="success">✓ Authorization Successful</h1>
              <p>You can close this window and return to Claude Code.</p>
            </body>
          </html>
        `);

        server.close();
        resolve(code);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, () => {
      console.log(`Listening for OAuth callback on port ${port}...`);
    });

    server.on('error', (err) => {
      reject(new Error(`Server error: ${err.message}`));
    });

    // 超时
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth login timed out (5 minutes)'));
    }, 300000); // 5 分钟
  });
}

/**
 * 交换授权码获取 token
 */
async function exchangeAuthorizationCode(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

// ============ Device Code Flow ============

/**
 * 启动 Device Code Flow OAuth 登录
 * 适用于无法打开浏览器或在远程服务器上运行的场景
 */
export async function startDeviceCodeFlow(
  accountType: 'claude.ai' | 'console' = 'console'
): Promise<AuthConfig> {
  const oauthConfig = OAUTH_ENDPOINTS[accountType];

  console.log('\n╭─────────────────────────────────────────╮');
  console.log(`│  Device Code Login - ${accountType.padEnd(17)}│`);
  console.log('╰─────────────────────────────────────────╯\n');

  // 请求设备码
  const deviceCodeResponse = await requestDeviceCode(oauthConfig);

  // 显示用户码和验证链接
  console.log('Please visit this URL on any device:');
  console.log(`\n  ${deviceCodeResponse.verification_uri}\n`);
  console.log('And enter this code:');
  console.log(`\n  ${deviceCodeResponse.user_code}\n`);

  if (deviceCodeResponse.verification_uri_complete) {
    console.log('Or scan/click this complete URL:');
    console.log(`\n  ${deviceCodeResponse.verification_uri_complete}\n`);
  }

  console.log('Waiting for authorization...');

  // 轮询 token 端点
  const tokenResponse = await pollForDeviceToken(
    oauthConfig,
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval
  );

  // 保存认证
  currentAuth = {
    type: 'oauth',
    accountType,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    scope: tokenResponse.scope?.split(' ') || oauthConfig.scope,
  };

  saveAuthSecure(currentAuth);

  console.log('\n✅ Device authorization successful!');
  return currentAuth;
}

/**
 * 请求设备码
 */
async function requestDeviceCode(config: OAuthConfig): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scope.join(' '),
  });

  const response = await fetch(config.deviceCodeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Device code request failed: ${error}`);
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

/**
 * 轮询设备 token
 */
async function pollForDeviceToken(
  config: OAuthConfig,
  deviceCode: string,
  interval: number
): Promise<TokenResponse> {
  const maxAttempts = 100; // 最多尝试 100 次
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    // 等待指定的间隔
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: config.clientId,
      device_code: deviceCode,
    });

    try {
      const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (response.ok) {
        return response.json() as Promise<TokenResponse>;
      }

      const errorData = await response.json().catch(() => ({})) as { error?: string };
      const error = errorData.error;

      if (error === 'authorization_pending') {
        // 用户还未授权，继续等待
        process.stdout.write('.');
        continue;
      } else if (error === 'slow_down') {
        // 需要减慢轮询速度
        interval = interval * 1.5;
        continue;
      } else if (error === 'expired_token') {
        throw new Error('Device code expired. Please try again.');
      } else if (error === 'access_denied') {
        throw new Error('User denied authorization.');
      } else {
        throw new Error(`Token polling failed: ${error || 'Unknown error'}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Token polling failed')) {
        throw err;
      }
      // 网络错误，继续尝试
      continue;
    }
  }

  throw new Error('Device authorization timed out.');
}

// ============ 统一 OAuth 登录入口 ============

/**
 * 启动 OAuth 登录流程
 * 自动选择最佳流程（Authorization Code 或 Device Code）
 */
export async function startOAuthLogin(
  config: Partial<{
    accountType: 'claude.ai' | 'console';
    useDeviceFlow: boolean;
  }> = {}
): Promise<AuthConfig> {
  const accountType = config.accountType || 'console';
  const useDeviceFlow = config.useDeviceFlow || false;

  if (useDeviceFlow) {
    return startDeviceCodeFlow(accountType);
  } else {
    return startAuthorizationCodeFlow(accountType);
  }
}

// ============ Token 刷新机制 ============

/**
 * 刷新访问 token
 */
export async function refreshTokenAsync(auth: AuthConfig): Promise<AuthConfig | null> {
  // 使用锁防止并发刷新
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    if (!auth.refreshToken) {
      console.log('No refresh token available, please login again.');
      return null;
    }

    const oauthConfig = OAUTH_ENDPOINTS[auth.accountType as 'claude.ai' | 'console'] || OAUTH_ENDPOINTS.console;

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: oauthConfig.clientId,
        refresh_token: auth.refreshToken,
      });

      if (oauthConfig.clientSecret) {
        body.set('client_secret', oauthConfig.clientSecret);
      }

      const response = await fetch(oauthConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        console.log('Token refresh failed, please login again.');
        return null;
      }

      const tokenResponse = await response.json() as TokenResponse;

      const newAuth: AuthConfig = {
        type: 'oauth',
        accountType: auth.accountType,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || auth.refreshToken,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope?.split(' ') || auth.scope,
        userId: auth.userId,
        email: auth.email,
      };

      saveAuthSecure(newAuth);
      currentAuth = newAuth;

      console.log('✅ Token refreshed successfully');
      return newAuth;
    } catch (err) {
      console.error('Token refresh error:', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * 确保 token 有效（自动刷新）
 */
async function ensureValidToken(): Promise<void> {
  if (!currentAuth || currentAuth.type !== 'oauth') {
    return;
  }

  // 如果 token 即将在 5 分钟内过期，刷新它
  if (currentAuth.expiresAt && currentAuth.expiresAt < Date.now() + 300000) {
    await refreshTokenAsync(currentAuth);
  }
}

// ============ 会话过期处理 ============

/**
 * 检查认证是否过期
 */
export function isAuthExpired(): boolean {
  if (!currentAuth) {
    return true;
  }

  if (currentAuth.type === 'api_key') {
    return false; // API Key 不会过期
  }

  if (currentAuth.expiresAt) {
    return currentAuth.expiresAt < Date.now();
  }

  return false;
}

/**
 * 获取认证过期时间
 */
export function getAuthExpiration(): Date | null {
  if (!currentAuth || currentAuth.type === 'api_key' || !currentAuth.expiresAt) {
    return null;
  }

  return new Date(currentAuth.expiresAt);
}

/**
 * 获取认证剩余时间（秒）
 */
export function getAuthTimeRemaining(): number | null {
  if (!currentAuth || currentAuth.type === 'api_key' || !currentAuth.expiresAt) {
    return null;
  }

  const remaining = Math.floor((currentAuth.expiresAt - Date.now()) / 1000);
  return Math.max(0, remaining);
}

// ============ API Key 验证 ============

/**
 * 验证 API Key
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    // 即使返回错误，只要不是 401/403 就说明 key 格式正确
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}

/**
 * 交互式设置 Token
 */
export async function setupToken(readline: {
  question: (prompt: string, callback: (answer: string) => void) => void;
  close: () => void;
}): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('\n╭─────────────────────────────────────────╮');
    console.log('│       Claude Code Token Setup           │');
    console.log('╰─────────────────────────────────────────╯\n');
    console.log('You can get your API key from:');
    console.log('  https://console.anthropic.com/settings/keys\n');

    readline.question('Enter your Anthropic API key: ', async (apiKey) => {
      apiKey = apiKey.trim();

      if (!apiKey) {
        console.log('\n❌ No API key provided.');
        readline.close();
        resolve(false);
        return;
      }

      // 验证 key 格式
      if (!apiKey.startsWith('sk-ant-')) {
        console.log('\n⚠️  Warning: API key should start with "sk-ant-"');
      }

      console.log('\nValidating API key...');

      const isValid = await validateApiKey(apiKey);

      if (isValid) {
        setApiKey(apiKey, true);
        console.log('\n✅ API key saved successfully!');
        console.log('   Stored in: ~/.claude/credentials.json');
        readline.close();
        resolve(true);
      } else {
        console.log('\n❌ API key validation failed.');
        console.log('   Please check your key and try again.');
        readline.close();
        resolve(false);
      }
    });
  });
}

// ============ 登出和清理 ============

/**
 * 完整登出并清理所有认证数据
 */
export function logout(): void {
  currentAuth = null;
  refreshPromise = null;

  // 删除 OAuth 认证文件
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (err) {
    console.error('Failed to delete auth file:', err);
  }
}

/**
 * 清除所有凭证（包括 API Key）
 */
export function clearCredentials(): void {
  logout();

  // 删除 API Key 凭证文件
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
    }
  } catch (err) {
    console.error('Failed to delete credentials file:', err);
  }
}

/**
 * 清除特定账户的认证
 */
export function clearAccountAuth(accountType: AccountType): void {
  if (currentAuth?.accountType === accountType) {
    logout();
  }

  // 可以扩展为支持多账户存储
  // 目前只保存单个账户
}

// ============ 认证状态查询 ============

/**
 * 检查是否已认证
 */
export function isAuthenticated(): boolean {
  if (!currentAuth) {
    return false;
  }

  if (currentAuth.type === 'api_key') {
    return !!currentAuth.apiKey;
  }

  if (currentAuth.type === 'oauth') {
    return !!currentAuth.accessToken && !isAuthExpired();
  }

  return false;
}

/**
 * 获取认证类型
 */
export function getAuthType(): 'api_key' | 'oauth' | null {
  return currentAuth?.type || null;
}

/**
 * 获取账户类型
 */
export function getAccountType(): AccountType | null {
  return currentAuth?.accountType || null;
}

/**
 * 获取用户信息
 */
export function getUserInfo(): { userId?: string; email?: string } | null {
  if (!currentAuth) {
    return null;
  }

  return {
    userId: currentAuth.userId,
    email: currentAuth.email,
  };
}

// ============ 导出的辅助函数 ============

/**
 * 保存认证信息（旧版兼容）
 */
function saveAuth(auth: AuthConfig): void {
  saveAuthSecure(auth);
}

/**
 * 同步包装的 Token 刷新（旧版兼容）
 */
function refreshToken(auth: AuthConfig): AuthConfig | null {
  console.log('Token expired, please login again using: claude setup-token');
  return null;
}
