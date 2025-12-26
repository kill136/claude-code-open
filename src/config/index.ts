/**
 * 配置管理 - 增强版
 * 支持：Zod验证、配置合并、迁移、导出/导入、热重载
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { McpServerConfig } from '../types/index.js';
import { envManager, maskSensitiveFields, getValidatedEnv } from '../env/index.js';

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

  // 后端选择（新增 apiProvider 枚举，保留向后兼容）
  apiProvider: z.enum(['anthropic', 'bedrock', 'vertex']).default('anthropic').optional(),
  useBedrock: z.boolean().default(false),
  useVertex: z.boolean().default(false),
  oauthToken: z.string().optional(),

  // 功能配置
  maxRetries: z.number().int().min(0).max(10).default(3),
  debugLogsDir: z.string().optional(),
  agentId: z.string().optional(), // 新增：Agent ID

  // UI 配置
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
  verbose: z.boolean().default(false),

  // 终端配置（新增）
  terminal: z.object({
    type: z.enum(['auto', 'vscode', 'cursor', 'windsurf', 'zed', 'ghostty', 'wezterm', 'kitty', 'alacritty', 'warp']).optional(),
    statusLine: z.object({
      type: z.enum(['command', 'text', 'disabled']).default('disabled'),
      command: z.string().optional(),
      text: z.string().optional(),
    }).optional(),
    keybindings: z.record(z.string()).optional(),
  }).optional(),

  // 功能开关
  enableTelemetry: z.boolean().default(false),
  disableFileCheckpointing: z.boolean().default(false),
  enableAutoSave: z.boolean().default(true),

  // 高级配置
  maxConcurrentTasks: z.number().int().positive().max(100).default(10),
  requestTimeout: z.number().int().positive().default(300000), // 5分钟

  // 遥测配置（新增）
  telemetry: z.object({
    otelShutdownTimeoutMs: z.number().int().positive().optional(),
  }).optional(),

  // 代理配置（新增）
  proxy: z.object({
    http: z.string().url().optional(),
    https: z.string().url().optional(),
    auth: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }).optional(),

  // 日志配置（新增）
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    logPath: z.string().optional(),
    maxSize: z.number().int().positive().optional(),
    maxFiles: z.number().int().positive().optional(),
  }).optional(),

  // 缓存配置（新增）
  cache: z.object({
    enabled: z.boolean().default(true),
    location: z.string().optional(),
    maxSize: z.number().int().positive().optional(), // MB
    ttl: z.number().int().positive().optional(), // 秒
  }).optional(),

  // 安全配置（新增）
  security: z.object({
    sensitiveFiles: z.array(z.string()).optional(),
    dangerousCommands: z.array(z.string()).optional(),
    allowSandboxEscape: z.boolean().default(false),
  }).optional(),

  // MCP 服务器
  mcpServers: z.record(McpServerConfigSchema).optional(),

  // 工具过滤
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),

  // 自定义提示词
  systemPrompt: z.string().optional(),

  // 工作目录
  defaultWorkingDir: z.string().optional(),

  // 权限配置（匹配官方结构）
  permissions: z.object({
    // 默认权限模式（匹配官方 defaultMode）
    defaultMode: z.enum(['default', 'bypassPermissions', 'dontAsk', 'acceptEdits', 'plan', 'delegate']).default('default').optional(),

    // 向后兼容字段
    defaultLevel: z.enum(['accept', 'reject', 'ask']).default('ask').optional(),
    autoApprove: z.array(z.string()).optional(),

    // allow/deny/ask 规则（匹配官方）
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),

    // 工具级权限
    tools: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),

    // 路径级权限（支持 glob patterns）
    paths: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),

    // 命令级权限（支持 glob patterns）
    commands: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),

    // 网络权限
    network: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),

    // 额外允许的目录
    additionalDirectories: z.array(z.string()).optional(),

    // 审计日志
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
  const config: Partial<UserConfig> = {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    useBedrock: parseEnvBoolean(process.env.CLAUDE_CODE_USE_BEDROCK),
    useVertex: parseEnvBoolean(process.env.CLAUDE_CODE_USE_VERTEX),
    maxTokens: parseEnvNumber(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS),
    maxRetries: parseEnvNumber(process.env.CLAUDE_CODE_MAX_RETRIES),
    debugLogsDir: process.env.CLAUDE_CODE_DEBUG_LOGS_DIR,
    enableTelemetry: parseEnvBoolean(process.env.CLAUDE_CODE_ENABLE_TELEMETRY),
    disableFileCheckpointing: parseEnvBoolean(process.env.CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING),
    agentId: process.env.CLAUDE_CODE_AGENT_ID,
  };

  // 处理 apiProvider（从布尔标志推导）
  if (parseEnvBoolean(process.env.CLAUDE_CODE_USE_BEDROCK)) {
    config.apiProvider = 'bedrock';
  } else if (parseEnvBoolean(process.env.CLAUDE_CODE_USE_VERTEX)) {
    config.apiProvider = 'vertex';
  }

  // 遥测配置
  if (process.env.CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS) {
    config.telemetry = {
      otelShutdownTimeoutMs: parseEnvNumber(process.env.CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS),
    };
  }

  // 代理配置
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    config.proxy = {
      http: process.env.HTTP_PROXY,
      https: process.env.HTTPS_PROXY,
    };
  }

  return config;
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

// ============ 配置来源类型 ============

export type ConfigSource =
  | 'default'
  | 'userSettings'      // 用户全局配置 (~/.claude/settings.json)
  | 'projectSettings'   // 项目配置 (./.claude/settings.json)
  | 'localSettings'     // 本地配置 (./.claude/local.json, 机器特定, git忽略)
  | 'policySettings'    // 策略配置 (组织策略, 最高优先级)
  | 'envSettings'       // 环境变量
  | 'flagSettings';     // 命令行标志

export interface ConfigSourceInfo {
  source: ConfigSource;
  path?: string;
  priority: number;
}

export interface ConfigWithSource<T = any> {
  value: T;
  source: ConfigSource;
}

// ============ ConfigManager 增强版 ============

export class ConfigManager {
  private globalConfigDir: string;
  private userConfigFile: string;        // 用户配置 (~/.claude/settings.json)
  private projectConfigFile: string;      // 项目配置 (./.claude/settings.json)
  private localConfigFile: string;        // 本地配置 (./.claude/local.json)
  private policyConfigFile: string;       // 策略配置 (~/.claude/policy.json)
  private flagConfigFile?: string;        // 标志配置 (命令行指定)

  private mergedConfig: UserConfig;
  private configSources: Map<string, ConfigSource> = new Map(); // 记录每个配置项的来源
  private watchers: fs.FSWatcher[] = [];
  private reloadCallbacks: Array<(config: UserConfig) => void> = [];

  constructor(options?: { flagSettingsPath?: string }) {
    // 全局配置目录
    this.globalConfigDir = process.env.CLAUDE_CONFIG_DIR ||
                           path.join(process.env.HOME || process.env.USERPROFILE || '~', '.claude');

    // 用户配置文件 (旧名 globalConfigFile，现改为 userConfigFile)
    this.userConfigFile = path.join(this.globalConfigDir, 'settings.json');

    // 策略配置文件 (组织策略，最高优先级)
    this.policyConfigFile = path.join(this.globalConfigDir, 'policy.json');

    // 项目配置文件
    this.projectConfigFile = path.join(process.cwd(), '.claude', 'settings.json');

    // 本地配置文件 (机器特定，应添加到 .gitignore)
    this.localConfigFile = path.join(process.cwd(), '.claude', 'local.json');

    // 标志配置文件 (通过命令行指定)
    this.flagConfigFile = options?.flagSettingsPath;

    // 验证环境变量
    this.validateEnvironmentVariables();

    // 加载并合并配置
    this.mergedConfig = this.loadAndMergeConfig();
  }

  /**
   * 验证所有环境变量
   */
  private validateEnvironmentVariables(): void {
    // 验证环境变量并记录结果
    const results = envManager.validateAll();

    // 输出验证警告
    for (const [name, result] of results) {
      if (result.status === 'invalid') {
        console.warn(`[Config] Invalid environment variable ${name}: ${result.message}`);
      } else if (result.status === 'capped') {
        console.warn(`[Config] Environment variable ${name} capped: ${result.message}`);
      }
    }
  }

  /**
   * 加载并合并所有配置源
   * 优先级：默认 < policySettings < userSettings < projectSettings < localSettings < envSettings < flagSettings
   */
  private loadAndMergeConfig(): UserConfig {
    this.configSources.clear();

    // 1. 默认配置
    let config: any = { ...DEFAULT_CONFIG };
    this.trackConfigSource(config, 'default');

    // 2. 策略配置 (组织策略，第二优先级)
    const policyConfig = this.loadConfigFile(this.policyConfigFile);
    if (policyConfig) {
      config = this.mergeConfig(config, policyConfig, 'policySettings');
    }

    // 3. 用户配置 (全局配置)
    const userConfig = this.loadConfigFile(this.userConfigFile);
    if (userConfig) {
      config = this.mergeConfig(config, userConfig, 'userSettings');
    }

    // 4. 项目配置
    const projectConfig = this.loadConfigFile(this.projectConfigFile);
    if (projectConfig) {
      config = this.mergeConfig(config, projectConfig, 'projectSettings');
    }

    // 5. 本地配置 (机器特定)
    const localConfig = this.loadConfigFile(this.localConfigFile);
    if (localConfig) {
      config = this.mergeConfig(config, localConfig, 'localSettings');
    }

    // 6. 环境变量
    const envConfig = getEnvConfig();
    config = this.mergeConfig(config, envConfig, 'envSettings');

    // 7. 标志配置 (命令行指定，最高优先级)
    if (this.flagConfigFile) {
      const flagConfig = this.loadConfigFile(this.flagConfigFile);
      if (flagConfig) {
        config = this.mergeConfig(config, flagConfig, 'flagSettings');
      }
    }

    // 8. 迁移配置
    config = migrateConfig(config);

    // 9. 验证配置
    try {
      return UserConfigSchema.parse(config);
    } catch (error) {
      console.warn('配置验证失败，使用默认值:', error);
      return UserConfigSchema.parse(DEFAULT_CONFIG);
    }
  }

  /**
   * 合并配置并追踪来源
   */
  private mergeConfig(base: any, override: any, source: ConfigSource): any {
    const merged = { ...base, ...override };
    this.trackConfigSource(override, source);
    return merged;
  }

  /**
   * 追踪配置项来源
   */
  private trackConfigSource(config: any, source: ConfigSource): void {
    for (const key of Object.keys(config)) {
      if (config[key] !== undefined) {
        this.configSources.set(key, source);
      }
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
   * 保存配置到用户配置文件 (旧名: 全局配置)
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

    // 备份现有配置
    this.backupConfig(this.userConfigFile);

    fs.writeFileSync(
      this.userConfigFile,
      JSON.stringify(this.mergedConfig, null, 2),
      'utf-8'
    );
  }

  /**
   * 保存到本地配置文件 (机器特定)
   */
  saveLocal(config: Partial<UserConfig>): void {
    const localDir = path.dirname(this.localConfigFile);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const currentLocalConfig = this.loadConfigFile(this.localConfigFile) || {};
    const newLocalConfig = { ...currentLocalConfig, ...config };

    this.backupConfig(this.localConfigFile);

    fs.writeFileSync(
      this.localConfigFile,
      JSON.stringify(newLocalConfig, null, 2),
      'utf-8'
    );

    this.reload();
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

    // 要监听的配置文件列表
    const filesToWatch = [
      this.userConfigFile,
      this.projectConfigFile,
      this.localConfigFile,
      this.policyConfigFile,
    ];

    if (this.flagConfigFile) {
      filesToWatch.push(this.flagConfigFile);
    }

    // 监听所有配置文件
    for (const file of filesToWatch) {
      if (fs.existsSync(file)) {
        const watcher = fs.watch(file, () => {
          this.reload();
        });
        this.watchers.push(watcher);
      }
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
   * 获取验证后的环境变量值
   */
  getValidatedEnv<T = any>(name: string): T | undefined {
    return getValidatedEnv<T>(name);
  }

  /**
   * 获取环境变量管理器
   */
  getEnvManager() {
    return envManager;
  }

  /**
   * 导出配置（掩码敏感信息）
   */
  export(maskSecrets = true): string {
    const config = { ...this.mergedConfig };

    if (maskSecrets) {
      // 使用统一的敏感字段掩码函数
      const masked = maskSensitiveFields(config);
      return JSON.stringify(masked, null, 2);
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

  // ============ 配置来源查询 ============

  /**
   * 获取配置项的来源
   */
  getConfigSource(key: keyof UserConfig): ConfigSource | undefined {
    return this.configSources.get(String(key));
  }

  /**
   * 获取所有配置来源
   */
  getAllConfigSources(): Map<string, ConfigSource> {
    return new Map(this.configSources);
  }

  /**
   * 获取配置来源信息
   */
  getConfigSourceInfo(): ConfigSourceInfo[] {
    const sources: ConfigSourceInfo[] = [
      { source: 'default', priority: 0 },
      { source: 'policySettings', path: this.policyConfigFile, priority: 1 },
      { source: 'userSettings', path: this.userConfigFile, priority: 2 },
      { source: 'projectSettings', path: this.projectConfigFile, priority: 3 },
      { source: 'localSettings', path: this.localConfigFile, priority: 4 },
      { source: 'envSettings', priority: 5 },
    ];

    if (this.flagConfigFile) {
      sources.push({ source: 'flagSettings', path: this.flagConfigFile, priority: 6 });
    }

    return sources;
  }

  /**
   * 获取配置项及其来源
   */
  getWithSource<K extends keyof UserConfig>(key: K): ConfigWithSource<UserConfig[K]> {
    return {
      value: this.mergedConfig[key],
      source: this.configSources.get(String(key)) || 'default',
    };
  }

  // ============ 配置备份和恢复 ============

  /**
   * 备份配置文件
   */
  private backupConfig(filePath: string): void {
    if (!fs.existsSync(filePath)) return;

    const backupDir = path.join(path.dirname(filePath), '.backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.basename(filePath, '.json');
    const backupPath = path.join(backupDir, `${filename}.${timestamp}.json`);

    try {
      fs.copyFileSync(filePath, backupPath);
      this.cleanOldBackups(backupDir, filename);
    } catch (error) {
      console.warn(`备份配置失败: ${error}`);
    }
  }

  /**
   * 清理旧的备份文件（保留最近10个）
   */
  private cleanOldBackups(backupDir: string, filename: string): void {
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(filename))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          mtime: fs.statSync(path.join(backupDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 保留最近10个备份
      files.slice(10).forEach(file => {
        fs.unlinkSync(file.path);
      });
    } catch (error) {
      console.warn(`清理备份失败: ${error}`);
    }
  }

  /**
   * 列出可用的备份
   */
  listBackups(configType: 'user' | 'project' | 'local' = 'user'): string[] {
    const configFile = configType === 'user' ? this.userConfigFile :
                      configType === 'project' ? this.projectConfigFile :
                      this.localConfigFile;

    const backupDir = path.join(path.dirname(configFile), '.backups');
    if (!fs.existsSync(backupDir)) return [];

    const filename = path.basename(configFile, '.json');
    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith(filename))
      .sort()
      .reverse();
  }

  /**
   * 从备份恢复配置
   */
  restoreFromBackup(backupFilename: string, configType: 'user' | 'project' | 'local' = 'user'): boolean {
    const configFile = configType === 'user' ? this.userConfigFile :
                      configType === 'project' ? this.projectConfigFile :
                      this.localConfigFile;

    const backupDir = path.join(path.dirname(configFile), '.backups');
    const backupPath = path.join(backupDir, backupFilename);

    if (!fs.existsSync(backupPath)) {
      console.error(`备份文件不存在: ${backupPath}`);
      return false;
    }

    try {
      // 备份当前配置
      this.backupConfig(configFile);

      // 恢复备份
      fs.copyFileSync(backupPath, configFile);

      // 重新加载配置
      this.reload();

      return true;
    } catch (error) {
      console.error(`恢复备份失败: ${error}`);
      return false;
    }
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

// ============ 导出其他模块 ============

export { ClaudeMdParser, claudeMdParser } from './claude-md-parser.js';
export { ConfigCommand, createConfigCommand } from './config-command.js';

// ============ 重新导出环境变量模块 ============

export {
  // 验证器
  type ValidationStatus,
  type ValidationResult,
  type EnvVarValidator,
  envValidatorRegistry,
  validateEnvVar,
  getValidatedEnvValue,
  validateAllEnvVars,

  // 内置验证器
  BASH_MAX_OUTPUT_LENGTH,
  CLAUDE_CODE_MAX_OUTPUT_TOKENS,
  createBooleanValidator,
  createNumberRangeValidator,
  createEnumValidator,

  // 敏感变量
  isSensitiveVar,
  maskSensitive,
  maskSensitiveFields,
  getSensitiveEnvVars,
  getMaskedSensitiveEnvVars,
  getSafeEnvVars,

  // 管理器
  envManager,
  getValidatedEnv,
  validateAllEnv,
  exportSafeEnv,
} from '../env/index.js';

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
