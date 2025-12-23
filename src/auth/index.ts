/**
 * 认证系统
 * 支持 API Key 和 OAuth 认证
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as crypto from 'crypto';

export interface AuthConfig {
  type: 'api_key' | 'oauth';
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
}

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope: string[];
}

// 认证配置文件路径
const AUTH_DIR = path.join(os.homedir(), '.claude');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');
const CREDENTIALS_FILE = path.join(AUTH_DIR, 'credentials.json');

// 默认 OAuth 配置（占位符）
const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  clientId: 'claude-code-cli',
  authorizationEndpoint: 'https://console.anthropic.com/oauth/authorize',
  tokenEndpoint: 'https://console.anthropic.com/oauth/token',
  redirectUri: 'http://localhost:9876/callback',
  scope: ['read', 'write'],
};

// 当前认证状态
let currentAuth: AuthConfig | null = null;

/**
 * 初始化认证系统
 */
export function initAuth(): AuthConfig | null {
  // 检查环境变量
  const envApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (envApiKey) {
    currentAuth = {
      type: 'api_key',
      apiKey: envApiKey,
    };
    return currentAuth;
  }

  // 检查凭证文件
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
      if (creds.apiKey) {
        currentAuth = {
          type: 'api_key',
          apiKey: creds.apiKey,
        };
        return currentAuth;
      }
    } catch (err) {
      // 忽略解析错误
    }
  }

  // 检查 OAuth token
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      if (auth.accessToken) {
        // 检查是否过期
        if (auth.expiresAt && auth.expiresAt < Date.now()) {
          // 尝试刷新
          return refreshToken(auth);
        }
        currentAuth = auth;
        return currentAuth;
      }
    } catch (err) {
      // 忽略解析错误
    }
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
  if (currentAuth?.type === 'api_key') {
    return currentAuth.apiKey;
  }
  if (currentAuth?.type === 'oauth') {
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

/**
 * 启动 OAuth 登录流程
 */
export async function startOAuthLogin(
  config: Partial<OAuthConfig> = {}
): Promise<AuthConfig> {
  const oauthConfig = { ...DEFAULT_OAUTH_CONFIG, ...config };

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

  console.log('\nPlease open this URL in your browser to login:');
  console.log(authUrl.toString());
  console.log('\nWaiting for authorization...');

  // 启动本地服务器等待回调
  const authCode = await waitForCallback(oauthConfig.redirectUri, state);

  // 交换 token
  const tokenResponse = await exchangeToken(
    oauthConfig,
    authCode,
    codeVerifier
  );

  // 保存认证
  currentAuth = {
    type: 'oauth',
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    scope: oauthConfig.scope,
  };

  saveAuth(currentAuth);

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

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization Failed</h1><p>You can close this window.</p>');
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Invalid State</h1><p>Please try again.</p>');
          server.close();
          reject(new Error('Invalid state parameter'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Missing Code</h1><p>Please try again.</p>');
          server.close();
          reject(new Error('Missing authorization code'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>✓ Authorization Successful</h1>
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

    // 超时
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth login timed out'));
    }, 300000); // 5 分钟
  });
}

/**
 * 交换 token
 */
async function exchangeToken(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
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

  return response.json();
}

/**
 * 刷新 token
 */
function refreshToken(auth: AuthConfig): AuthConfig | null {
  // TODO: 实现 token 刷新
  // 目前只是返回 null 表示需要重新登录
  console.log('Token expired, please login again.');
  return null;
}

/**
 * 保存认证信息
 */
function saveAuth(auth: AuthConfig): void {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

/**
 * 登出
 */
export function logout(): void {
  currentAuth = null;

  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (err) {
    // 忽略错误
  }
}

/**
 * 检查是否已认证
 */
export function isAuthenticated(): boolean {
  return currentAuth !== null;
}

/**
 * 获取认证类型
 */
export function getAuthType(): 'api_key' | 'oauth' | null {
  return currentAuth?.type || null;
}
