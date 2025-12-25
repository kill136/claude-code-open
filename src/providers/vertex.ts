/**
 * Google Vertex AI Provider
 *
 * Supports Claude models via Google Cloud Vertex AI with:
 * - Service Account authentication
 * - Application Default Credentials (ADC)
 * - Automatic token refresh
 * - Retry logic with exponential backoff
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';

/**
 * Google Service Account Credentials
 */
export interface GoogleServiceAccount {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Google Authorized User Credentials
 */
export interface GoogleAuthorizedUser {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

/**
 * Union of credential types
 */
export type GoogleCredentials = GoogleServiceAccount | GoogleAuthorizedUser;

/**
 * Vertex AI Configuration
 */
export interface VertexAIConfig {
  projectId: string;
  region: string;
  credentials?: GoogleCredentials;
  credentialsPath?: string;
}

/**
 * OAuth2 Access Token
 */
export interface AccessToken {
  access_token: string;
  expires_in: number;
  token_type: string;
  expires_at?: number;
}

/**
 * Vertex AI Client Error
 */
export class VertexAIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'VertexAIError';
  }
}

/**
 * Google Vertex AI Client
 */
export class VertexAIClient {
  private projectId: string;
  private region: string;
  private credentials?: GoogleCredentials;
  private accessToken?: AccessToken;
  private tokenRefreshTimer?: NodeJS.Timeout;

  constructor(config: VertexAIConfig) {
    this.projectId = config.projectId;
    this.region = config.region || 'us-central1';

    // Load credentials
    if (config.credentials) {
      this.credentials = config.credentials;
    } else if (config.credentialsPath) {
      this.credentials = this.loadCredentialsFromFile(config.credentialsPath);
    } else {
      // Try to load from environment
      this.credentials = this.loadCredentialsFromEnvironment();
    }

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Load credentials from file
   */
  private loadCredentialsFromFile(filePath: string): GoogleCredentials {
    try {
      const absolutePath = path.resolve(filePath);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new VertexAIError(
        `Failed to load credentials from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load credentials from environment
   */
  private loadCredentialsFromEnvironment(): GoogleCredentials | undefined {
    // Try GOOGLE_APPLICATION_CREDENTIALS
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath) {
      return this.loadCredentialsFromFile(credPath);
    }

    // Try inline credentials
    const credJson = process.env.GOOGLE_CREDENTIALS;
    if (credJson) {
      try {
        return JSON.parse(credJson);
      } catch {
        throw new VertexAIError('Invalid GOOGLE_CREDENTIALS JSON');
      }
    }

    return undefined;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.projectId) {
      throw new VertexAIError('Project ID is required');
    }
    if (!this.region) {
      throw new VertexAIError('Region is required');
    }
  }

  /**
   * Get access token (with caching)
   */
  public async getAccessToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.accessToken && this.isTokenValid(this.accessToken)) {
      return this.accessToken.access_token;
    }

    // Get new token
    const token = await this.fetchAccessToken();
    this.accessToken = token;

    // Schedule refresh before expiry
    this.scheduleTokenRefresh(token);

    return token.access_token;
  }

  /**
   * Check if token is still valid
   */
  private isTokenValid(token: AccessToken): boolean {
    if (!token.expires_at) {
      return false;
    }
    // Consider token invalid 5 minutes before actual expiry
    const bufferTime = 5 * 60 * 1000;
    return Date.now() < token.expires_at - bufferTime;
  }

  /**
   * Schedule token refresh
   */
  private scheduleTokenRefresh(token: AccessToken): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Refresh 5 minutes before expiry
    const refreshTime = (token.expires_in - 300) * 1000;
    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this.getAccessToken();
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
    }, refreshTime);
  }

  /**
   * Fetch new access token
   */
  private async fetchAccessToken(): Promise<AccessToken> {
    if (!this.credentials) {
      throw new VertexAIError(
        'No credentials available. Set GOOGLE_APPLICATION_CREDENTIALS or provide credentials.'
      );
    }

    if (this.credentials.type === 'service_account') {
      return this.fetchServiceAccountToken(this.credentials);
    } else if (this.credentials.type === 'authorized_user') {
      return this.fetchAuthorizedUserToken(this.credentials);
    } else {
      throw new VertexAIError(`Unsupported credential type: ${(this.credentials as any).type}`);
    }
  }

  /**
   * Fetch token using Service Account
   */
  private async fetchServiceAccountToken(
    credentials: GoogleServiceAccount
  ): Promise<AccessToken> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // Create JWT
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const claim = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
    };

    const jwt = this.createJWT(header, claim, credentials.private_key);

    // Exchange JWT for access token
    const tokenResponse = await this.requestToken(
      credentials.token_uri || 'https://oauth2.googleapis.com/token',
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }
    );

    tokenResponse.expires_at = Date.now() + tokenResponse.expires_in * 1000;
    return tokenResponse;
  }

  /**
   * Fetch token using Authorized User
   */
  private async fetchAuthorizedUserToken(
    credentials: GoogleAuthorizedUser
  ): Promise<AccessToken> {
    const tokenResponse = await this.requestToken('https://oauth2.googleapis.com/token', {
      grant_type: 'refresh_token',
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
    });

    tokenResponse.expires_at = Date.now() + tokenResponse.expires_in * 1000;
    return tokenResponse;
  }

  /**
   * Create JWT for Service Account
   */
  private createJWT(header: any, claim: any, privateKey: string): string {
    const encodeBase64Url = (data: string): string => {
      return Buffer.from(data)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    };

    const headerEncoded = encodeBase64Url(JSON.stringify(header));
    const claimEncoded = encodeBase64Url(JSON.stringify(claim));
    const signatureInput = `${headerEncoded}.${claimEncoded}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(privateKey, 'base64');
    const signatureEncoded = signature
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signatureInput}.${signatureEncoded}`;
  }

  /**
   * Request OAuth token
   */
  private async requestToken(tokenUri: string, params: Record<string, string>): Promise<AccessToken> {
    const body = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return new Promise((resolve, reject) => {
      const url = new URL(tokenUri);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(
              new VertexAIError(
                `Token request failed: ${data}`,
                'TOKEN_REQUEST_FAILED',
                res.statusCode
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new VertexAIError('Invalid token response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(new VertexAIError(`Token request failed: ${error.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Get Vertex AI endpoint URL
   */
  public getEndpoint(modelId: string): string {
    return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${modelId}:streamRawPredict`;
  }

  /**
   * Get non-streaming endpoint URL
   */
  public getRawPredictEndpoint(modelId: string): string {
    return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${modelId}:rawPredict`;
  }

  /**
   * Make API request to Vertex AI
   */
  public async request<T = any>(
    modelId: string,
    body: any,
    options: {
      stream?: boolean;
      signal?: AbortSignal;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const { stream = false, signal, maxRetries = 3 } = options;
    const endpoint = stream ? this.getEndpoint(modelId) : this.getRawPredictEndpoint(modelId);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();
        return await this.makeHttpRequest<T>(endpoint, token, body, signal);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx except 429)
        if (
          error instanceof VertexAIError &&
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 429
        ) {
          throw error;
        }

        // Don't retry on abort
        if (signal?.aborted) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new VertexAIError('Request failed after retries');
  }

  /**
   * Make HTTP request
   */
  private async makeHttpRequest<T>(
    endpoint: string,
    accessToken: string,
    body: any,
    signal?: AbortSignal
  ): Promise<T> {
    const bodyString = JSON.stringify(body);
    const url = new URL(endpoint);

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            let errorMessage = data;
            try {
              const errorData = JSON.parse(data);
              errorMessage = errorData.error?.message || errorData.message || data;
            } catch {
              // Use raw data if not JSON
            }

            reject(
              new VertexAIError(
                `Vertex AI request failed: ${errorMessage}`,
                'API_ERROR',
                res.statusCode,
                data
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new VertexAIError('Invalid response JSON'));
          }
        });
      });

      req.on('error', (error) => {
        reject(new VertexAIError(`Request failed: ${error.message}`));
      });

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          req.destroy();
          reject(new VertexAIError('Request aborted'));
        });
      }

      req.write(bodyString);
      req.end();
    });
  }

  /**
   * Stream API request
   */
  public async *streamRequest(
    modelId: string,
    body: any,
    signal?: AbortSignal
  ): AsyncGenerator<any, void, unknown> {
    const endpoint = this.getEndpoint(modelId);
    const token = await this.getAccessToken();
    const bodyString = JSON.stringify(body);
    const url = new URL(endpoint);

    const generator = await new Promise<AsyncGenerator<any, void, unknown>>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
        },
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            reject(
              new VertexAIError(
                `Vertex AI stream failed: ${data}`,
                'STREAM_ERROR',
                res.statusCode
              )
            );
          });
          return;
        }

        async function* generateChunks() {
          let buffer = '';
          for await (const chunk of res) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  return;
                }
                try {
                  yield JSON.parse(data);
                } catch (error) {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        resolve(generateChunks());
      });

      req.on('error', (error) => {
        reject(new VertexAIError(`Stream request failed: ${error.message}`));
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          req.destroy();
          reject(new VertexAIError('Stream aborted'));
        });
      }

      req.write(bodyString);
      req.end();
    });

    // Delegate to the generated async generator
    yield* generator;
  }

  /**
   * Get project ID
   */
  public getProjectId(): string {
    return this.projectId;
  }

  /**
   * Get region
   */
  public getRegion(): string {
    return this.region;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
    }
  }
}

/**
 * Create Vertex AI client from environment
 */
export function createVertexAIClient(config?: Partial<VertexAIConfig>): VertexAIClient {
  const projectId =
    config?.projectId ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID;

  const region =
    config?.region ||
    process.env.ANTHROPIC_VERTEX_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    process.env.CLOUD_ML_REGION ||
    'us-central1';

  if (!projectId) {
    throw new VertexAIError(
      'Project ID is required. Set ANTHROPIC_VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT'
    );
  }

  return new VertexAIClient({
    projectId,
    region,
    credentials: config?.credentials,
    credentialsPath: config?.credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
}

/**
 * Vertex AI model names
 */
export const VERTEX_MODELS = {
  'claude-sonnet-4': 'claude-sonnet-4@20250514',
  'claude-3-5-sonnet': 'claude-3-5-sonnet-v2@20241022',
  'claude-3-opus': 'claude-3-opus@20240229',
  'claude-3-haiku': 'claude-3-haiku@20240307',
  'claude-3-5-haiku': 'claude-3-5-haiku@20241022',
} as const;

/**
 * Get Vertex model ID
 */
export function getVertexModelId(model: string): string {
  return VERTEX_MODELS[model as keyof typeof VERTEX_MODELS] || model;
}
