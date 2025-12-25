/**
 * 配置管理 - 增强版
 * 支持：Zod验证、配置合并、迁移、导出/导入、热重载
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { McpServerConfig } from '../types/index.js';

// Re-export McpServerConfig for backwards compatibility
export type { McpServerConfig };

// ============ Zod Schema 定义 ============

const McpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
}).refine(
  (data) => {
    // stdio 类型必须有 command
    if (data.type === 'stdio' && !data.command) return false;
    // http/sse 类型必须有 url
    if ((data.type === 'http' || data.type === 'sse') && !data.url) return false;
    return true;
  },
  {
    message: 'Invalid MCP server configuration',
  }
);

const UserConfigSchema = z.object({
  // 版本控制
  version: z.string().default('2.0.76'),

  // API 配置
  apiKey: z.string().optional(),
  model: z.enum(['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20250924', 'opus', 'sonnet', 'haiku']).default('sonnet'),
  maxTokens: z.number().int().positive().max(200000).default(8192),
  temperature: z.number().min(0).max(1).default(1),

  // 后端选择
  useBedrock: z.boolean().default(false),
  useVertex: z.boolean().default(false),
  oauthToken: z.string().optional(),

  // 功能配置
  maxRetries: z.number().int().min(0).max(10).default(3),
  debugLogsDir: z.string().optional(),

  // UI 配置
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
  verbose: z.boolean().default(false),

  // 功能开关
  enableTelemetry: z.boolean().default(false),
  disableFileCheckpointing: z.boolean().default(false),
  enableAutoSave: z.boolean().default(true),

  // 高级配置
  maxConcurrentTasks: z.number().int().positive().max(100).default(10),
  requestTimeout: z.number().int().positive().default(300000), // 5分钟

  // MCP 服务器
  mcpServers: z.record(McpServerConfigSchema).optional(),

  // 工具过滤
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),

  // 自定义提示词
  systemPrompt: z.string().optional(),

  // 工作目录
  defaultWorkingDir: z.string().optional(),

  // 权限配置
  permissions: z.object({
    tools: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
    paths: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
    commands: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
    network: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
    audit: z.object({
      enabled: z.boolean().optional(),
      logFile: z.string().optional(),
      maxSize: z.number().int().positive().optional(),
    }).optional(),
  }).optional(),
}).passthrough(); // 允许额外字段，便于扩展

export type UserConfig = z.infer<typeof UserConfigSchema>;

// ============ 默认配置 ============

const DEFAULT_CONFIG: Partial<UserConfig> = {
  version: '2.0.76',
  model: 'sonnet',
  maxTokens: 8192,
  temperature: 1,
  theme: 'auto',
  verbose: false,
  maxRetries: 3,
  enableTelemetry: false,
  disableFileCheckpointing: false,
  enableAutoSave: true,
  maxConcurrentTasks: 10,
  requestTimeout: 300000,
  useBedrock: false,
  useVertex: false,
};

// ============ 环境变量解析 ============

function parseEnvBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return undefined;
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return isNaN(parsed) ? undefined : parsed;
}

function getEnvConfig(): Partial<UserConfig> {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    useBedrock: parseEnvBoolean(process.env.CLAUDE_CODE_USE_BEDROCK),
    useVertex: parseEnvBoolean(process.env.CLAUDE_CODE_USE_VERTEX),
    maxTokens: parseEnvNumber(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS),
    maxRetries: parseEnvNumber(process.env.CLAUDE_CODE_MAX_RETRIES),
    debugLogsDir: process.env.CLAUDE_CODE_DEBUG_LOGS_DIR,
    enableTelemetry: parseEnvBoolean(process.env.CLAUDE_CODE_ENABLE_TELEMETRY),
    disableFileCheckpointing: parseEnvBoolean(process.env.CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING),
  };
}

// ============ 配置迁移 ============

interface ConfigMigration {
  version: string;
  migrate: (config: any) => any;
}

const MIGRATIONS: ConfigMigration[] = [
  {
    version: '2.0.0',
    migrate: (config) => {
      // 迁移旧的模型名称
      if (config.model === 'claude-3-opus') config.model = 'opus';
      if (config.model === 'claude-3-sonnet') config.model = 'sonnet';
      if (config.model === 'claude-3-haiku') config.model = 'haiku';
      return config;
    },
  },
  {
    version: '2.0.76',
    migrate: (config) => {
      // 添加新字段的默认值
      if (!config.version) config.version = '2.0.76';
      if (config.autoSave !== undefined) {
        config.enableAutoSave = config.autoSave;
        delete config.autoSave;
      }
      return config;
    },
  },
];

function migrateConfig(config: any): any {
  const currentVersion = config.version || '1.0.0';
  let migratedConfig = { ...config };

  for (const migration of MIGRATIONS) {
    if (compareVersions(currentVersion, migration.version) < 0) {
      migratedConfig = migration.migrate(migratedConfig);
    }
  }

  migratedConfig.version = '2.0.76';
  return migratedConfig;
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

// ============ ConfigManager 增强版 ============

export class ConfigManager {
  private globalConfigDir: string;
  private globalConfigFile: string;
  private projectConfigFile: string;
  private mergedConfig: UserConfig;
  private watchers: fs.FSWatcher[] = [];
  private reloadCallbacks: Array<(config: UserConfig) => void> = [];

  constructor() {
    // 全局配置目录
    this.globalConfigDir = process.env.CLAUDE_CONFIG_DIR ||
                           path.join(process.env.HOME || process.env.USERPROFILE || '~', '.claude');
    this.globalConfigFile = path.join(this.globalConfigDir, 'settings.json');

    // 项目配置文件
    this.projectConfigFile = path.join(process.cwd(), '.claude', 'settings.json');

    // 加载并合并配置
    this.mergedConfig = this.loadAndMergeConfig();
  }

  /**
   * 加载并合并所有配置源
   * 优先级：默认 < 全局 < 项目 < 环境变量 < 命令行参数
   */
  private loadAndMergeConfig(): UserConfig {
    // 1. 默认配置
    let config: any = { ...DEFAULT_CONFIG };

    // 2. 全局配置
    const globalConfig = this.loadConfigFile(this.globalConfigFile);
    if (globalConfig) {
      config = { ...config, ...globalConfig };
    }

    // 3. 项目配置
    const projectConfig = this.loadConfigFile(this.projectConfigFile);
    if (projectConfig) {
      config = { ...config, ...projectConfig };
    }

    // 4. 环境变量
    const envConfig = getEnvConfig();
    config = { ...config, ...envConfig };

    // 5. 迁移配置
    config = migrateConfig(config);

    // 6. 验证配置
    try {
      return UserConfigSchema.parse(config);
    } catch (error) {
      console.warn('配置验证失败，使用默认值:', error);
      return UserConfigSchema.parse(DEFAULT_CONFIG);
    }
  }

  /**
   * 从文件加载配置
   */
  private loadConfigFile(filePath: string): any | null {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`加载配置文件失败: ${filePath}`, error);
    }
    return null;
  }

  /**
   * 保存配置到全局配置文件
   */
  save(config?: Partial<UserConfig>): void {
    if (config) {
      this.mergedConfig = UserConfigSchema.parse({
        ...this.mergedConfig,
        ...config,
      });
    }

    if (!fs.existsSync(this.globalConfigDir)) {
      fs.mkdirSync(this.globalConfigDir, { recursive: true });
    }

    fs.writeFileSync(
      this.globalConfigFile,
      JSON.stringify(this.mergedConfig, null, 2),
      'utf-8'
    );
  }

  /**
   * 保存到项目配置文件
   */
  saveProject(config: Partial<UserConfig>): void {
    const projectDir = path.dirname(this.projectConfigFile);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const currentProjectConfig = this.loadConfigFile(this.projectConfigFile) || {};
    const newProjectConfig = { ...currentProjectConfig, ...config };

    fs.writeFileSync(
      this.projectConfigFile,
      JSON.stringify(newProjectConfig, null, 2),
      'utf-8'
    );

    this.reload();
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.mergedConfig = this.loadAndMergeConfig();
    this.reloadCallbacks.forEach(cb => cb(this.mergedConfig));
  }

  /**
   * 监听配置变化（热重载）
   */
  watch(callback: (config: UserConfig) => void): void {
    this.reloadCallbacks.push(callback);

    // 监听全局配置
    if (fs.existsSync(this.globalConfigFile)) {
      const globalWatcher = fs.watch(this.globalConfigFile, () => {
        this.reload();
      });
      this.watchers.push(globalWatcher);
    }

    // 监听项目配置
    if (fs.existsSync(this.projectConfigFile)) {
      const projectWatcher = fs.watch(this.projectConfigFile, () => {
        this.reload();
      });
      this.watchers.push(projectWatcher);
    }
  }

  /**
   * 停止监听
   */
  unwatch(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.reloadCallbacks = [];
  }

  /**
   * 获取配置项
   */
  get<K extends keyof UserConfig>(key: K): UserConfig[K] {
    return this.mergedConfig[key];
  }

  /**
   * 设置配置项
   */
  set<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void {
    this.mergedConfig[key] = value;
    this.save();
  }

  /**
   * 获取所有配置
   */
  getAll(): UserConfig {
    return { ...this.mergedConfig };
  }

  /**
   * 获取 API 密钥
   */
  getApiKey(): string | undefined {
    return this.mergedConfig.apiKey;
  }

  /**
   * 导出配置（掩码敏感信息）
   */
  export(maskSecrets = true): string {
    const config = { ...this.mergedConfig };

    if (maskSecrets) {
      // 掩码敏感信息
      if (config.apiKey) {
        config.apiKey = this.maskSecret(config.apiKey);
      }
      if (config.oauthToken) {
        config.oauthToken = this.maskSecret(config.oauthToken);
      }
      if (config.mcpServers) {
        for (const [name, server] of Object.entries(config.mcpServers)) {
          if (server.headers) {
            const maskedHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(server.headers)) {
              maskedHeaders[key] = this.maskSecret(value);
            }
            config.mcpServers[name] = { ...server, headers: maskedHeaders };
          }
          if (server.env) {
            const maskedEnv: Record<string, string> = {};
            for (const [key, value] of Object.entries(server.env)) {
              if (key.toLowerCase().includes('key') ||
                  key.toLowerCase().includes('token') ||
                  key.toLowerCase().includes('secret') ||
                  key.toLowerCase().includes('password')) {
                maskedEnv[key] = this.maskSecret(value);
              } else {
                maskedEnv[key] = value;
              }
            }
            config.mcpServers[name] = { ...server, env: maskedEnv };
          }
        }
      }
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入配置
   */
  import(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      const validated = UserConfigSchema.parse(config);
      this.mergedConfig = validated;
      this.save();
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }

  /**
   * 掩码敏感信息
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) return '***';
    return value.slice(0, 4) + '***' + value.slice(-4);
  }

  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors?: z.ZodError } {
    try {
      UserConfigSchema.parse(this.mergedConfig);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.mergedConfig = UserConfigSchema.parse(DEFAULT_CONFIG);
    this.save();
  }

  // ============ MCP 服务器管理 ============

  getMcpServers(): Record<string, McpServerConfig> {
    return (this.mergedConfig.mcpServers || {}) as Record<string, McpServerConfig>;
  }

  addMcpServer(name: string, config: McpServerConfig): void {
    try {
      // 验证 MCP 服务器配置
      McpServerConfigSchema.parse(config);

      if (!this.mergedConfig.mcpServers) {
        this.mergedConfig.mcpServers = {};
      }
      this.mergedConfig.mcpServers[name] = config;
      this.save();
    } catch (error) {
      throw new Error(`无效的 MCP 服务器配置: ${error}`);
    }
  }

  removeMcpServer(name: string): boolean {
    if (this.mergedConfig.mcpServers?.[name]) {
      delete this.mergedConfig.mcpServers[name];
      this.save();
      return true;
    }
    return false;
  }

  updateMcpServer(name: string, config: Partial<McpServerConfig>): boolean {
    if (this.mergedConfig.mcpServers?.[name]) {
      const updated = { ...this.mergedConfig.mcpServers[name], ...config };
      try {
        McpServerConfigSchema.parse(updated);
        this.mergedConfig.mcpServers[name] = updated as McpServerConfig;
        this.save();
        return true;
      } catch (error) {
        throw new Error(`无效的 MCP 服务器配置: ${error}`);
      }
    }
    return false;
  }
}

// ============ 全局实例 ============

export const configManager = new ConfigManager();

// ============ 环境变量配置（向后兼容） ============

export const ENV_VARS = {
  // API 配置
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,

  // 后端选择
  CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
  CLAUDE_CODE_USE_VERTEX: process.env.CLAUDE_CODE_USE_VERTEX,

  // 功能配置
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,
  CLAUDE_CODE_MAX_RETRIES: process.env.CLAUDE_CODE_MAX_RETRIES,
  CLAUDE_CODE_DEBUG_LOGS_DIR: process.env.CLAUDE_CODE_DEBUG_LOGS_DIR,

  // 开关
  CLAUDE_CODE_ENABLE_TELEMETRY: process.env.CLAUDE_CODE_ENABLE_TELEMETRY,
  CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING: process.env.CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING,
};
