/**
 * Sandbox Configuration Manager
 * Enhanced sandbox configuration with validation, merging, and presets
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';

// ============ Zod Schema Definitions ============

const ResourceLimitsSchema = z.object({
  /** Maximum memory in bytes */
  maxMemory: z.number().int().positive().optional(),
  /** Maximum CPU usage (0-100) */
  maxCpu: z.number().min(0).max(100).optional(),
  /** Maximum number of processes */
  maxProcesses: z.number().int().positive().optional(),
  /** Maximum file size in bytes */
  maxFileSize: z.number().int().positive().optional(),
  /** Maximum execution time in milliseconds */
  maxExecutionTime: z.number().int().positive().optional(),
  /** Maximum number of file descriptors */
  maxFileDescriptors: z.number().int().positive().optional(),
});

const SandboxConfigSchema = z.object({
  /** Enable sandbox */
  enabled: z.boolean().default(true),

  /** Sandbox type */
  type: z.enum(['bubblewrap', 'docker', 'firejail', 'none']).default('bubblewrap'),

  /** Allowed paths for read/write */
  allowedPaths: z.array(z.string()).default([]),

  /** Denied paths (takes precedence) */
  deniedPaths: z.array(z.string()).default([]),

  /** Allow network access */
  networkAccess: z.boolean().default(false),

  /** Environment variables to pass through */
  environmentVariables: z.record(z.string()).default({}),

  /** Resource limits */
  resourceLimits: ResourceLimitsSchema.optional(),

  /** Read-only paths */
  readOnlyPaths: z.array(z.string()).default([
    '/usr',
    '/lib',
    '/lib64',
    '/bin',
    '/sbin',
    '/etc',
  ]),

  /** Writable paths */
  writablePaths: z.array(z.string()).default(['/tmp']),

  /** Allow /dev access */
  allowDevAccess: z.boolean().default(true),

  /** Allow /proc access */
  allowProcAccess: z.boolean().default(true),

  /** Allow /sys access */
  allowSysAccess: z.boolean().default(false),

  /** Environment variable whitelist */
  envWhitelist: z.array(z.string()).optional(),

  /** Tmpfs size (for bubblewrap) */
  tmpfsSize: z.string().default('100M'),

  /** Unshare all namespaces */
  unshareAll: z.boolean().default(true),

  /** Die with parent process */
  dieWithParent: z.boolean().default(true),

  /** Create new session */
  newSession: z.boolean().default(true),

  /** Docker-specific configuration */
  docker: z.object({
    image: z.string().optional(),
    containerName: z.string().optional(),
    volumes: z.array(z.string()).optional(),
    ports: z.array(z.string()).optional(),
    network: z.string().optional(),
    user: z.string().optional(),
    workdir: z.string().optional(),
    entrypoint: z.string().optional(),
    command: z.array(z.string()).optional(),
  }).optional(),

  /** Custom command-line arguments */
  customArgs: z.array(z.string()).optional(),

  /** Audit logging */
  auditLogging: z.object({
    enabled: z.boolean().default(false),
    logFile: z.string().optional(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }).optional(),
}).passthrough();

export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

// ============ Validation Result ============

export interface ValidationResult {
  valid: boolean;
  errors?: z.ZodError;
  warnings?: string[];
}

// ============ Sandbox Presets ============

export const SANDBOX_PRESETS: Record<string, SandboxConfig> = {
  // Strict isolation preset
  strict: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: [],
    deniedPaths: ['/home', '/root'],
    networkAccess: false,
    environmentVariables: {},
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
    writablePaths: ['/tmp'],
    allowDevAccess: false,
    allowProcAccess: false,
    allowSysAccess: false,
    tmpfsSize: '50M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 512 * 1024 * 1024, // 512MB
      maxCpu: 50,
      maxProcesses: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxExecutionTime: 60000, // 1 minute
      maxFileDescriptors: 100,
    },
  },

  // Development preset
  development: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: [process.cwd()],
    deniedPaths: [],
    networkAccess: true,
    environmentVariables: {
      NODE_ENV: 'development',
      PATH: process.env.PATH || '',
    },
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc', '/usr/local'],
    writablePaths: ['/tmp', process.cwd()],
    allowDevAccess: true,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '200M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 2 * 1024 * 1024 * 1024, // 2GB
      maxCpu: 80,
      maxProcesses: 50,
      maxExecutionTime: 300000, // 5 minutes
    },
  },

  // Testing preset
  testing: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: [process.cwd()],
    deniedPaths: [],
    networkAccess: true,
    environmentVariables: {
      NODE_ENV: 'test',
      PATH: process.env.PATH || '',
    },
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
    writablePaths: ['/tmp', process.cwd()],
    allowDevAccess: true,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '200M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxCpu: 75,
      maxProcesses: 30,
      maxExecutionTime: 120000, // 2 minutes
    },
  },

  // Production preset
  production: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: [],
    deniedPaths: ['/home', '/root'],
    networkAccess: false,
    environmentVariables: {
      NODE_ENV: 'production',
    },
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
    writablePaths: ['/tmp'],
    allowDevAccess: false,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '100M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 512 * 1024 * 1024, // 512MB
      maxCpu: 60,
      maxProcesses: 20,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxExecutionTime: 30000, // 30 seconds
      maxFileDescriptors: 50,
    },
    auditLogging: {
      enabled: true,
      logLevel: 'warn',
    },
  },

  // Docker preset
  docker: {
    enabled: true,
    type: 'docker',
    allowedPaths: [],
    deniedPaths: [],
    networkAccess: true,
    environmentVariables: {},
    readOnlyPaths: [],
    writablePaths: [],
    allowDevAccess: false,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '100M',
    unshareAll: false,
    dieWithParent: true,
    newSession: false,
    docker: {
      image: 'node:20-alpine',
      containerName: 'claude-sandbox',
      volumes: [`${process.cwd()}:/workspace`],
      workdir: '/workspace',
      network: 'bridge',
    },
    resourceLimits: {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxCpu: 50,
    },
  },

  // Unrestricted preset (for trusted operations)
  unrestricted: {
    enabled: false,
    type: 'none',
    allowedPaths: [],
    deniedPaths: [],
    networkAccess: true,
    environmentVariables: {},
    readOnlyPaths: [],
    writablePaths: [],
    allowDevAccess: true,
    allowProcAccess: true,
    allowSysAccess: true,
    tmpfsSize: '500M',
    unshareAll: false,
    dieWithParent: false,
    newSession: false,
  },

  // Custom web scraping preset
  webscraping: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: ['/tmp'],
    deniedPaths: [],
    networkAccess: true,
    environmentVariables: {
      HTTP_PROXY: process.env.HTTP_PROXY || '',
      HTTPS_PROXY: process.env.HTTPS_PROXY || '',
    },
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
    writablePaths: ['/tmp'],
    allowDevAccess: true,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '200M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 512 * 1024 * 1024, // 512MB
      maxCpu: 50,
      maxExecutionTime: 60000, // 1 minute
    },
  },

  // AI code execution preset
  aicode: {
    enabled: true,
    type: 'bubblewrap',
    allowedPaths: ['/tmp'],
    deniedPaths: ['/home', '/root'],
    networkAccess: false,
    environmentVariables: {
      PATH: '/usr/local/bin:/usr/bin:/bin',
    },
    readOnlyPaths: ['/usr', '/lib', '/lib64', '/bin', '/sbin', '/etc'],
    writablePaths: ['/tmp'],
    allowDevAccess: true,
    allowProcAccess: true,
    allowSysAccess: false,
    tmpfsSize: '100M',
    unshareAll: true,
    dieWithParent: true,
    newSession: true,
    resourceLimits: {
      maxMemory: 256 * 1024 * 1024, // 256MB
      maxCpu: 50,
      maxProcesses: 5,
      maxFileSize: 1024 * 1024, // 1MB
      maxExecutionTime: 10000, // 10 seconds
      maxFileDescriptors: 20,
    },
    auditLogging: {
      enabled: true,
      logLevel: 'info',
    },
  },
};

// ============ Default Configuration ============

const DEFAULT_CONFIG: SandboxConfig = SANDBOX_PRESETS.development;

// ============ Sandbox Config Manager ============

export class SandboxConfigManager {
  private configDir: string;
  private configFile: string;
  private currentConfig: SandboxConfig;
  private watchers: fs.FSWatcher[] = [];
  private reloadCallbacks: Array<(config: SandboxConfig) => void> = [];

  constructor(configDir?: string) {
    // Configuration directory
    this.configDir = configDir ||
      path.join(process.env.HOME || process.env.USERPROFILE || '~', '.claude', 'sandbox');
    this.configFile = path.join(this.configDir, 'config.json');

    // Load configuration
    this.currentConfig = this.loadConfigSync();
  }

  /**
   * Load configuration synchronously
   */
  private loadConfigSync(): SandboxConfig {
    try {
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf-8');
        const config = JSON.parse(content);
        return SandboxConfigSchema.parse(config);
      }
    } catch (error) {
      console.warn('Failed to load sandbox config, using defaults:', error);
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Load configuration asynchronously
   */
  async loadConfig(): Promise<SandboxConfig> {
    try {
      if (fs.existsSync(this.configFile)) {
        const content = await fs.promises.readFile(this.configFile, 'utf-8');
        const config = JSON.parse(content);
        this.currentConfig = SandboxConfigSchema.parse(config);
        return this.currentConfig;
      }
    } catch (error) {
      console.warn('Failed to load sandbox config, using defaults:', error);
    }
    this.currentConfig = DEFAULT_CONFIG;
    return this.currentConfig;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<SandboxConfig>): ValidationResult {
    const warnings: string[] = [];

    try {
      const validated = SandboxConfigSchema.parse(config);

      // Additional validation warnings
      if (validated.enabled && validated.type === 'bubblewrap') {
        const platform = os.platform();
        if (platform !== 'linux') {
          warnings.push('Bubblewrap is only available on Linux. Sandbox will be disabled.');
        }
      }

      if (validated.networkAccess && validated.type === 'bubblewrap' && !validated.unshareAll) {
        warnings.push('Network access with unshareAll=false may expose host network.');
      }

      if (validated.allowedPaths.length > 0 && validated.deniedPaths.length > 0) {
        // Check for conflicts
        for (const allowed of validated.allowedPaths) {
          for (const denied of validated.deniedPaths) {
            if (allowed.startsWith(denied) || denied.startsWith(allowed)) {
              warnings.push(`Path conflict: ${allowed} vs ${denied}`);
            }
          }
        }
      }

      if (validated.resourceLimits?.maxMemory) {
        if (validated.resourceLimits.maxMemory > 4 * 1024 * 1024 * 1024) {
          warnings.push('maxMemory > 4GB may cause issues on some systems');
        }
      }

      return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error, warnings };
      }
      return { valid: false, warnings };
    }
  }

  /**
   * Merge configurations (later configs override earlier ones)
   */
  mergeConfigs(base: SandboxConfig, override: Partial<SandboxConfig>): SandboxConfig {
    const merged = { ...base, ...override };

    // Deep merge for nested objects
    if (override.resourceLimits) {
      merged.resourceLimits = {
        ...base.resourceLimits,
        ...override.resourceLimits,
      };
    }

    if (override.docker) {
      merged.docker = {
        ...base.docker,
        ...override.docker,
      };
    }

    if (override.auditLogging) {
      merged.auditLogging = {
        ...base.auditLogging,
        ...override.auditLogging,
      };
    }

    // Array merging strategy: override replaces base
    if (override.allowedPaths !== undefined) {
      merged.allowedPaths = [...override.allowedPaths];
    }

    if (override.deniedPaths !== undefined) {
      merged.deniedPaths = [...override.deniedPaths];
    }

    if (override.readOnlyPaths !== undefined) {
      merged.readOnlyPaths = [...override.readOnlyPaths];
    }

    if (override.writablePaths !== undefined) {
      merged.writablePaths = [...override.writablePaths];
    }

    if (override.envWhitelist !== undefined) {
      merged.envWhitelist = [...override.envWhitelist];
    }

    if (override.environmentVariables !== undefined) {
      merged.environmentVariables = { ...override.environmentVariables };
    }

    return SandboxConfigSchema.parse(merged);
  }

  /**
   * Get preset configuration
   */
  getPreset(name: string): SandboxConfig {
    const preset = SANDBOX_PRESETS[name];
    if (!preset) {
      throw new Error(`Unknown preset: ${name}. Available: ${this.listPresets().join(', ')}`);
    }
    return { ...preset };
  }

  /**
   * List available presets
   */
  listPresets(): string[] {
    return Object.keys(SANDBOX_PRESETS);
  }

  /**
   * Get current configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.currentConfig };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<SandboxConfig>): Promise<void> {
    this.currentConfig = this.mergeConfigs(this.currentConfig, config);
    await this.saveConfig();
  }

  /**
   * Set configuration from preset
   */
  async setPreset(name: string): Promise<void> {
    const preset = this.getPreset(name);
    this.currentConfig = preset;
    await this.saveConfig();
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.configDir)) {
        await fs.promises.mkdir(this.configDir, { recursive: true });
      }

      // Write config file
      await fs.promises.writeFile(
        this.configFile,
        JSON.stringify(this.currentConfig, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save sandbox config: ${error}`);
    }
  }

  /**
   * Reset to default configuration
   */
  async reset(): Promise<void> {
    this.currentConfig = DEFAULT_CONFIG;
    await this.saveConfig();
  }

  /**
   * Reset to specific preset
   */
  async resetToPreset(name: string): Promise<void> {
    await this.setPreset(name);
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: SandboxConfig) => void): void {
    this.reloadCallbacks.push(callback);

    if (fs.existsSync(this.configFile)) {
      const watcher = fs.watch(this.configFile, async () => {
        try {
          await this.loadConfig();
          this.reloadCallbacks.forEach(cb => cb(this.currentConfig));
        } catch (error) {
          console.warn('Failed to reload sandbox config:', error);
        }
      });
      this.watchers.push(watcher);
    }
  }

  /**
   * Stop watching for changes
   */
  unwatch(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.reloadCallbacks = [];
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.currentConfig, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  async import(configJson: string): Promise<boolean> {
    try {
      const config = JSON.parse(configJson);
      const validation = this.validateConfig(config);

      if (!validation.valid) {
        console.error('Invalid configuration:', validation.errors);
        return false;
      }

      if (validation.warnings) {
        console.warn('Configuration warnings:', validation.warnings);
      }

      this.currentConfig = SandboxConfigSchema.parse(config);
      await this.saveConfig();
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Get configuration summary
   */
  getSummary(): {
    enabled: boolean;
    type: string;
    networkAccess: boolean;
    allowedPathsCount: number;
    deniedPathsCount: number;
    resourceLimits?: ResourceLimits;
  } {
    return {
      enabled: this.currentConfig.enabled,
      type: this.currentConfig.type,
      networkAccess: this.currentConfig.networkAccess,
      allowedPathsCount: this.currentConfig.allowedPaths.length,
      deniedPathsCount: this.currentConfig.deniedPaths.length,
      resourceLimits: this.currentConfig.resourceLimits,
    };
  }

  /**
   * Check if path is allowed
   */
  isPathAllowed(targetPath: string): boolean {
    // Denied paths take precedence
    for (const denied of this.currentConfig.deniedPaths) {
      if (targetPath.startsWith(denied)) {
        return false;
      }
    }

    // Check allowed paths
    if (this.currentConfig.allowedPaths.length === 0) {
      return true; // No restrictions
    }

    for (const allowed of this.currentConfig.allowedPaths) {
      if (targetPath.startsWith(allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if path is writable
   */
  isPathWritable(targetPath: string): boolean {
    if (!this.isPathAllowed(targetPath)) {
      return false;
    }

    for (const writable of this.currentConfig.writablePaths) {
      if (targetPath.startsWith(writable)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get effective environment variables
   */
  getEnvironmentVariables(): Record<string, string> {
    const env = { ...this.currentConfig.environmentVariables };

    // Add whitelisted environment variables
    if (this.currentConfig.envWhitelist) {
      for (const key of this.currentConfig.envWhitelist) {
        if (process.env[key]) {
          env[key] = process.env[key]!;
        }
      }
    }

    // Always include essential variables
    const essential = ['PATH', 'HOME', 'USER', 'LANG', 'TERM'];
    for (const key of essential) {
      if (process.env[key] && !env[key]) {
        env[key] = process.env[key]!;
      }
    }

    return env;
  }

  /**
   * Create a scoped configuration for specific operation
   */
  createScopedConfig(overrides: Partial<SandboxConfig>): SandboxConfig {
    return this.mergeConfigs(this.currentConfig, overrides);
  }
}

// ============ Global Instance ============

export const sandboxConfigManager = new SandboxConfigManager();

// ============ Utility Functions ============

/**
 * Get recommended preset for current environment
 */
export function getRecommendedPreset(): string {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') return 'production';
  if (env === 'test') return 'testing';
  if (env === 'development') return 'development';

  return 'development';
}

/**
 * Create configuration from preset with overrides
 */
export function createConfigFromPreset(
  presetName: string,
  overrides?: Partial<SandboxConfig>
): SandboxConfig {
  const preset = SANDBOX_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  if (!overrides) {
    return { ...preset };
  }

  const manager = new SandboxConfigManager();
  return manager.mergeConfigs(preset, overrides);
}

/**
 * Validate and sanitize paths
 */
export function sanitizePaths(paths: string[]): string[] {
  return paths
    .map(p => path.resolve(p))
    .filter(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
}
