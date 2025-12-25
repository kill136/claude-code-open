/**
 * Configuration Type Definitions for Claude Code CLI
 *
 * This file provides comprehensive type definitions for all configuration
 * aspects of the Claude Code CLI, including API settings, permissions,
 * hooks, MCP servers, plugins, UI preferences, and more.
 *
 * @module types/config
 * @version 2.0.76
 */

// ============================================================================
// Model Types
// ============================================================================

/**
 * Supported Claude model identifiers
 */
export type ModelName =
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20250924'
  | 'opus'
  | 'sonnet'
  | 'haiku';

/**
 * Model display name mapping
 */
export type ModelDisplayName =
  | 'Claude Opus 4.5'
  | 'Claude Sonnet 4.5'
  | 'Claude Haiku 4.5';

// ============================================================================
// API Backend Types
// ============================================================================

/**
 * API backend provider type
 */
export type APIBackend = 'anthropic' | 'bedrock' | 'vertex';

/**
 * API configuration
 */
export interface APIConfig {
  /** Anthropic API key */
  apiKey?: string;

  /** OAuth token for authenticated sessions */
  oauthToken?: string;

  /** Use AWS Bedrock backend */
  useBedrock?: boolean;

  /** Use Google Cloud Vertex AI backend */
  useVertex?: boolean;

  /** Maximum number of retry attempts for API calls */
  maxRetries?: number;

  /** Request timeout in milliseconds */
  requestTimeout?: number;

  /** Base URL for API requests (for custom endpoints) */
  baseURL?: string;

  /** Additional headers to include in API requests */
  headers?: Record<string, string>;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Model generation parameters
 */
export interface ModelConfig {
  /** Model identifier */
  model?: ModelName;

  /** Maximum tokens to generate in response */
  maxTokens?: number;

  /** Temperature for response generation (0-1) */
  temperature?: number;

  /** Top-p sampling parameter */
  topP?: number;

  /** Top-k sampling parameter */
  topK?: number;

  /** Custom system prompt override */
  systemPrompt?: string;

  /** Stop sequences */
  stopSequences?: string[];
}

// ============================================================================
// Permission Settings
// ============================================================================

/**
 * Permission mode for tool execution
 */
export type PermissionMode =
  | 'acceptEdits'        // Auto-accept file edits
  | 'bypassPermissions'  // Bypass all permission checks
  | 'default'            // Ask for each permission
  | 'delegate'           // Delegate to external system
  | 'dontAsk'            // Don't ask, use rules
  | 'plan';              // Plan mode (no execution)

/**
 * Permission action type
 */
export type PermissionAction = 'allow' | 'deny' | 'ask';

/**
 * Permission scope
 */
export type PermissionScope = 'once' | 'session' | 'always';

/**
 * Tool-level permission settings
 */
export interface ToolPermissionSettings {
  /** List of allowed tool names */
  allow?: string[];

  /** List of denied tool names */
  deny?: string[];
}

/**
 * Path-level permission settings (supports glob patterns)
 */
export interface PathPermissionSettings {
  /** List of allowed path patterns */
  allow?: string[];

  /** List of denied path patterns */
  deny?: string[];
}

/**
 * Command-level permission settings for Bash tool
 */
export interface CommandPermissionSettings {
  /** List of allowed command patterns */
  allow?: string[];

  /** List of denied command patterns */
  deny?: string[];
}

/**
 * Network permission settings
 */
export interface NetworkPermissionSettings {
  /** List of allowed domain/URL patterns */
  allow?: string[];

  /** List of denied domain/URL patterns */
  deny?: string[];
}

/**
 * Audit logging configuration
 */
export interface AuditSettings {
  /** Enable audit logging */
  enabled?: boolean;

  /** Path to audit log file */
  logFile?: string;

  /** Maximum log file size in bytes */
  maxSize?: number;

  /** Log rotation count */
  rotationCount?: number;

  /** Include sensitive data in logs */
  includeSensitiveData?: boolean;
}

/**
 * Complete permission configuration
 */
export interface PermissionSettings {
  /** Default permission mode */
  mode?: PermissionMode;

  /** Tool-level permissions */
  tools?: ToolPermissionSettings;

  /** Path-level permissions */
  paths?: PathPermissionSettings;

  /** Command-level permissions */
  commands?: CommandPermissionSettings;

  /** Network permissions */
  network?: NetworkPermissionSettings;

  /** Audit logging settings */
  audit?: AuditSettings;

  /** Remember permission decisions */
  rememberDecisions?: boolean;

  /** Default permission scope for remembered decisions */
  defaultScope?: PermissionScope;
}

// ============================================================================
// Hook Settings
// ============================================================================

/**
 * Hook event types (12 official events)
 */
export type HookEvent =
  | 'PreToolUse'           // Before tool execution
  | 'PostToolUse'          // After successful tool execution
  | 'PostToolUseFailure'   // After failed tool execution
  | 'Notification'         // Notification events
  | 'UserPromptSubmit'     // User submits a prompt
  | 'SessionStart'         // Session starts
  | 'SessionEnd'           // Session ends
  | 'Stop'                 // Stop/interrupt event
  | 'SubagentStart'        // Subagent starts
  | 'SubagentStop'         // Subagent stops
  | 'PreCompact'           // Before context compression
  | 'PermissionRequest';   // Permission requested

/**
 * Hook type
 */
export type HookType = 'command' | 'url';

/**
 * Command hook configuration
 */
export interface CommandHookConfig {
  /** Hook type */
  type: 'command';

  /** Command to execute (supports env var substitution like $TOOL_NAME) */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Blocking mode - wait for completion (default: true) */
  blocking?: boolean;

  /** Matcher for filtering events (tool name or regex) */
  matcher?: string;

  /** Working directory for command execution */
  cwd?: string;
}

/**
 * URL hook configuration
 */
export interface UrlHookConfig {
  /** Hook type */
  type: 'url';

  /** Callback URL */
  url: string;

  /** HTTP method (default: POST) */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Request headers */
  headers?: Record<string, string>;

  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Blocking mode - wait for response (default: false) */
  blocking?: boolean;

  /** Matcher for filtering events */
  matcher?: string;

  /** Retry configuration */
  retry?: {
    attempts?: number;
    backoff?: number;
  };
}

/**
 * Hook configuration (union type)
 */
export type HookConfig = CommandHookConfig | UrlHookConfig;

/**
 * Hook settings - map of events to hook configs
 */
export interface HookSettings {
  /** Map of hook events to their configurations */
  [event: string]: HookConfig | HookConfig[] | boolean | number | undefined;

  /** Enable/disable all hooks */
  enabled?: boolean;

  /** Global timeout for all hooks */
  globalTimeout?: number;

  /** Maximum concurrent hook executions */
  maxConcurrent?: number;
}

// ============================================================================
// MCP (Model Context Protocol) Settings
// ============================================================================

/**
 * MCP server transport type
 */
export type MCPTransportType = 'stdio' | 'sse' | 'http';

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Transport type */
  type: MCPTransportType;

  /** Command to execute (for stdio transport) */
  command?: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Server URL (for http/sse transport) */
  url?: string;

  /** HTTP headers (for http/sse transport) */
  headers?: Record<string, string>;

  /** Timeout for server initialization (ms) */
  timeout?: number;

  /** Enable/disable this server */
  enabled?: boolean;

  /** Auto-restart on failure */
  autoRestart?: boolean;

  /** Maximum restart attempts */
  maxRestarts?: number;
}

/**
 * MCP settings
 */
export interface MCPSettings {
  /** Map of server name to configuration */
  servers?: Record<string, MCPServerConfig>;

  /** Enable/disable MCP system */
  enabled?: boolean;

  /** Auto-discover MCP servers */
  autoDiscover?: boolean;

  /** Search paths for auto-discovery */
  discoveryPaths?: string[];

  /** Global timeout for MCP operations (ms) */
  globalTimeout?: number;

  /** Maximum concurrent MCP requests */
  maxConcurrentRequests?: number;
}

// ============================================================================
// Plugin Settings
// ============================================================================

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description?: string;

  /** Plugin author */
  author?: string;

  /** Plugin homepage */
  homepage?: string;

  /** Plugin license */
  license?: string;

  /** Main entry point */
  main?: string;

  /** Engine requirements */
  engines?: {
    node?: string;
    'claude-code'?: string;
  };

  /** Plugin dependencies */
  dependencies?: Record<string, string>;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Enable/disable this plugin */
  enabled?: boolean;

  /** Plugin-specific settings */
  settings?: Record<string, unknown>;

  /** Plugin priority (lower = higher priority) */
  priority?: number;

  /** Auto-load on startup */
  autoLoad?: boolean;
}

/**
 * Plugin settings
 */
export interface PluginSettings {
  /** Map of plugin name to configuration */
  plugins?: Record<string, PluginConfig>;

  /** Enable/disable plugin system */
  enabled?: boolean;

  /** Plugin search paths */
  searchPaths?: string[];

  /** Auto-load plugins from search paths */
  autoLoad?: boolean;

  /** Sandbox plugins (restrict capabilities) */
  sandboxed?: boolean;

  /** Maximum memory per plugin (bytes) */
  maxMemoryPerPlugin?: number;

  /** Plugin timeout (ms) */
  timeout?: number;
}

// ============================================================================
// UI Settings
// ============================================================================

/**
 * Theme type
 */
export type ThemeType = 'dark' | 'light' | 'auto';

/**
 * Color scheme
 */
export interface ColorScheme {
  /** Primary color */
  primary?: string;

  /** Secondary color */
  secondary?: string;

  /** Success color */
  success?: string;

  /** Warning color */
  warning?: string;

  /** Error color */
  error?: string;

  /** Info color */
  info?: string;

  /** Background color */
  background?: string;

  /** Foreground/text color */
  foreground?: string;

  /** Border color */
  border?: string;
}

/**
 * UI component visibility settings
 */
export interface UIComponentSettings {
  /** Show header */
  showHeader?: boolean;

  /** Show status bar */
  showStatusBar?: boolean;

  /** Show todo list */
  showTodoList?: boolean;

  /** Show spinner */
  showSpinner?: boolean;

  /** Show diff view for file edits */
  showDiffView?: boolean;

  /** Show progress bar */
  showProgressBar?: boolean;
}

/**
 * UI formatting settings
 */
export interface UIFormattingSettings {
  /** Enable syntax highlighting */
  syntaxHighlighting?: boolean;

  /** Enable markdown rendering */
  markdownRendering?: boolean;

  /** Code block theme */
  codeBlockTheme?: string;

  /** Line wrapping */
  lineWrapping?: boolean;

  /** Maximum line length before wrapping */
  maxLineLength?: number;

  /** Show line numbers in code blocks */
  showLineNumbers?: boolean;
}

/**
 * UI settings
 */
export interface UISettings {
  /** Theme preference */
  theme?: ThemeType;

  /** Custom color scheme */
  colors?: ColorScheme;

  /** Component visibility */
  components?: UIComponentSettings;

  /** Formatting preferences */
  formatting?: UIFormattingSettings;

  /** Verbose output */
  verbose?: boolean;

  /** Compact mode (minimal UI) */
  compact?: boolean;

  /** Animation settings */
  animations?: {
    enabled?: boolean;
    speed?: 'slow' | 'normal' | 'fast';
  };

  /** Terminal width override */
  terminalWidth?: number;

  /** Enable unicode symbols */
  useUnicode?: boolean;
}

// ============================================================================
// Telemetry Settings
// ============================================================================

/**
 * Telemetry level
 */
export type TelemetryLevel = 'off' | 'error' | 'minimal' | 'full';

/**
 * Telemetry settings
 */
export interface TelemetrySettings {
  /** Enable telemetry */
  enabled?: boolean;

  /** Telemetry level */
  level?: TelemetryLevel;

  /** Anonymize user data */
  anonymize?: boolean;

  /** Include performance metrics */
  includePerformance?: boolean;

  /** Include error reports */
  includeErrors?: boolean;

  /** Include usage statistics */
  includeUsage?: boolean;

  /** Custom telemetry endpoint */
  endpoint?: string;

  /** Telemetry batch size */
  batchSize?: number;

  /** Telemetry flush interval (ms) */
  flushInterval?: number;
}

// ============================================================================
// Context Management Settings
// ============================================================================

/**
 * Context compression strategy
 */
export type CompressionStrategy =
  | 'summarize'        // Summarize old messages
  | 'truncate'         // Remove oldest messages
  | 'selective'        // Selectively remove less important content
  | 'hybrid';          // Combination of strategies

/**
 * Context settings
 */
export interface ContextSettings {
  /** Maximum context size (tokens) */
  maxTokens?: number;

  /** Context compression threshold (percentage) */
  compressionThreshold?: number;

  /** Compression strategy */
  compressionStrategy?: CompressionStrategy;

  /** Preserve important messages during compression */
  preserveImportant?: boolean;

  /** Include system information in context */
  includeSystemInfo?: boolean;

  /** Include file tree in context */
  includeFileTree?: boolean;

  /** Maximum file tree depth */
  fileTreeDepth?: number;

  /** Auto-summarization */
  autoSummarize?: boolean;

  /** Summarization model */
  summarizationModel?: ModelName;
}

// ============================================================================
// Sandbox Settings
// ============================================================================

/**
 * Sandbox type
 */
export type SandboxType = 'none' | 'bubblewrap' | 'docker' | 'vm';

/**
 * Sandbox settings
 */
export interface SandboxSettings {
  /** Sandbox type */
  type?: SandboxType;

  /** Enable sandboxing */
  enabled?: boolean;

  /** Allowed directories (bind mounts) */
  allowedPaths?: string[];

  /** Network access in sandbox */
  allowNetwork?: boolean;

  /** Sandbox timeout (ms) */
  timeout?: number;

  /** Resource limits */
  limits?: {
    /** Maximum CPU usage (cores) */
    cpu?: number;

    /** Maximum memory (bytes) */
    memory?: number;

    /** Maximum disk usage (bytes) */
    disk?: number;

    /** Maximum processes */
    processes?: number;
  };

  /** Docker-specific settings */
  docker?: {
    /** Docker image */
    image?: string;

    /** Container name prefix */
    containerPrefix?: string;

    /** Remove container after execution */
    autoRemove?: boolean;
  };
}

// ============================================================================
// Session Settings
// ============================================================================

/**
 * Session settings
 */
export interface SessionSettings {
  /** Auto-save session */
  autoSave?: boolean;

  /** Save interval (ms) */
  saveInterval?: number;

  /** Session expiration time (ms) */
  expirationTime?: number;

  /** Maximum session count */
  maxSessions?: number;

  /** Session directory */
  sessionDir?: string;

  /** Compress old sessions */
  compressOld?: boolean;

  /** Include environment in session */
  includeEnvironment?: boolean;

  /** Encryption for sensitive data */
  encryption?: {
    enabled?: boolean;
    algorithm?: string;
  };
}

// ============================================================================
// Checkpoint Settings
// ============================================================================

/**
 * Checkpoint settings
 */
export interface CheckpointSettings {
  /** Enable file checkpointing */
  enabled?: boolean;

  /** Checkpoint directory */
  checkpointDir?: string;

  /** Maximum checkpoints per file */
  maxCheckpointsPerFile?: number;

  /** Checkpoint retention period (ms) */
  retentionPeriod?: number;

  /** Auto-cleanup old checkpoints */
  autoCleanup?: boolean;

  /** Compression for checkpoints */
  compression?: boolean;
}

// ============================================================================
// Tool Settings
// ============================================================================

/**
 * Tool-specific settings
 */
export interface ToolSettings {
  /** List of allowed tools (whitelist) */
  allowedTools?: string[];

  /** List of disallowed tools (blacklist) */
  disallowedTools?: string[];

  /** Maximum concurrent tool executions */
  maxConcurrentTasks?: number;

  /** Default tool timeout (ms) */
  defaultTimeout?: number;

  /** Tool-specific configurations */
  toolConfig?: {
    /** Bash tool settings */
    bash?: {
      /** Default shell */
      shell?: string;

      /** Shell arguments */
      shellArgs?: string[];

      /** Default timeout */
      timeout?: number;

      /** Enable background execution */
      allowBackground?: boolean;
    };

    /** Grep tool settings */
    grep?: {
      /** Default context lines */
      contextLines?: number;

      /** Case sensitive by default */
      caseSensitive?: boolean;

      /** Max results */
      maxResults?: number;
    };

    /** WebFetch tool settings */
    webFetch?: {
      /** User agent */
      userAgent?: string;

      /** Follow redirects */
      followRedirects?: boolean;

      /** Maximum redirects */
      maxRedirects?: number;

      /** Timeout */
      timeout?: number;
    };

    /** WebSearch tool settings */
    webSearch?: {
      /** Default search engine */
      engine?: string;

      /** Results per page */
      resultsPerPage?: number;

      /** Safe search */
      safeSearch?: boolean;
    };
  };
}

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Enable notifications */
  enabled?: boolean;

  /** Notification types to enable */
  types?: {
    /** Session events */
    session?: boolean;

    /** Tool execution */
    tools?: boolean;

    /** Errors */
    errors?: boolean;

    /** Warnings */
    warnings?: boolean;

    /** Completion */
    completion?: boolean;
  };

  /** Desktop notifications */
  desktop?: boolean;

  /** Sound notifications */
  sound?: boolean;

  /** Webhook for notifications */
  webhook?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

// ============================================================================
// Update Settings
// ============================================================================

/**
 * Update settings
 */
export interface UpdateSettings {
  /** Enable auto-update checks */
  autoCheck?: boolean;

  /** Check interval (ms) */
  checkInterval?: number;

  /** Auto-install updates */
  autoInstall?: boolean;

  /** Update channel */
  channel?: 'stable' | 'beta' | 'canary';

  /** Notify about updates */
  notify?: boolean;

  /** Custom update server */
  updateServer?: string;
}

// ============================================================================
// Advanced Settings
// ============================================================================

/**
 * Advanced/experimental settings
 */
export interface AdvancedSettings {
  /** Default working directory */
  defaultWorkingDir?: string;

  /** Debug logs directory */
  debugLogsDir?: string;

  /** Enable experimental features */
  experimentalFeatures?: boolean;

  /** Feature flags */
  features?: Record<string, boolean>;

  /** Custom API endpoint */
  customEndpoint?: string;

  /** Proxy configuration */
  proxy?: {
    http?: string;
    https?: string;
    no?: string[];
  };

  /** Certificate settings */
  certificates?: {
    ca?: string[];
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  };

  /** Rate limiting */
  rateLimit?: {
    enabled?: boolean;
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
}

// ============================================================================
// Main Configuration Types
// ============================================================================

/**
 * Complete Claude Code configuration
 *
 * This is the main configuration object that combines all settings.
 * It can be loaded from settings.json files and environment variables.
 */
export interface ClaudeConfig {
  /** Configuration version */
  version?: string;

  // Core API settings
  /** API key */
  apiKey?: string;

  /** OAuth token */
  oauthToken?: string;

  /** Model selection */
  model?: ModelName;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Top-p sampling */
  topP?: number;

  /** Top-k sampling */
  topK?: number;

  // Backend selection
  /** Use AWS Bedrock */
  useBedrock?: boolean;

  /** Use Google Vertex AI */
  useVertex?: boolean;

  // Feature toggles
  /** Enable telemetry */
  enableTelemetry?: boolean;

  /** Disable file checkpointing */
  disableFileCheckpointing?: boolean;

  /** Enable auto-save */
  enableAutoSave?: boolean;

  // Performance settings
  /** Maximum retry attempts */
  maxRetries?: number;

  /** Request timeout (ms) */
  requestTimeout?: number;

  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;

  // UI preferences
  /** UI theme */
  theme?: ThemeType;

  /** Verbose output */
  verbose?: boolean;

  // Tool filtering
  /** Allowed tools */
  allowedTools?: string[];

  /** Disallowed tools */
  disallowedTools?: string[];

  // System settings
  /** Custom system prompt */
  systemPrompt?: string;

  /** Default working directory */
  defaultWorkingDir?: string;

  /** Debug logs directory */
  debugLogsDir?: string;

  // ===== Nested Configuration Objects =====

  /** API configuration */
  api?: APIConfig;

  /** Model configuration */
  modelConfig?: ModelConfig;

  /** Permission settings */
  permissions?: PermissionSettings;

  /** Hook settings */
  hooks?: HookSettings;

  /** MCP server settings */
  mcpServers?: Record<string, MCPServerConfig>;

  /** MCP global settings */
  mcp?: MCPSettings;

  /** Plugin settings */
  plugins?: PluginSettings;

  /** UI settings */
  ui?: UISettings;

  /** Telemetry settings */
  telemetry?: TelemetrySettings;

  /** Context management settings */
  context?: ContextSettings;

  /** Sandbox settings */
  sandbox?: SandboxSettings;

  /** Session settings */
  session?: SessionSettings;

  /** Checkpoint settings */
  checkpoint?: CheckpointSettings;

  /** Tool settings */
  tools?: ToolSettings;

  /** Notification settings */
  notifications?: NotificationSettings;

  /** Update settings */
  updates?: UpdateSettings;

  /** Advanced settings */
  advanced?: AdvancedSettings;
}

/**
 * User configuration (alias for ClaudeConfig)
 *
 * This is the configuration format stored in ~/.claude/settings.json
 */
export type UserConfig = ClaudeConfig;

/**
 * Settings (alias for ClaudeConfig)
 *
 * Alternative name for the configuration object
 */
export type Settings = ClaudeConfig;

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

/**
 * Legacy Config interface (for backward compatibility)
 */
export interface Config {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Legacy McpServerConfig (exported from index.ts)
 */
export interface McpServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

/**
 * Session state
 */
export interface SessionState {
  sessionId: string;
  cwd: string;
  startTime: number;
  totalCostUSD: number;
  totalAPIDuration: number;
  modelUsage: Record<string, number>;
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
}

/**
 * Output format
 */
export type OutputFormat = 'text' | 'json' | 'stream-json';

/**
 * Input format
 */
export type InputFormat = 'text' | 'stream-json';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment variable configuration
 *
 * Maps environment variables to configuration options
 */
export interface EnvironmentConfig {
  /** ANTHROPIC_API_KEY or CLAUDE_API_KEY */
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string;

  /** CLAUDE_CODE_OAUTH_TOKEN */
  CLAUDE_CODE_OAUTH_TOKEN?: string;

  /** CLAUDE_CODE_USE_BEDROCK */
  CLAUDE_CODE_USE_BEDROCK?: string;

  /** CLAUDE_CODE_USE_VERTEX */
  CLAUDE_CODE_USE_VERTEX?: string;

  /** CLAUDE_CODE_MAX_OUTPUT_TOKENS */
  CLAUDE_CODE_MAX_OUTPUT_TOKENS?: string;

  /** CLAUDE_CODE_MAX_RETRIES */
  CLAUDE_CODE_MAX_RETRIES?: string;

  /** CLAUDE_CODE_DEBUG_LOGS_DIR */
  CLAUDE_CODE_DEBUG_LOGS_DIR?: string;

  /** CLAUDE_CODE_ENABLE_TELEMETRY */
  CLAUDE_CODE_ENABLE_TELEMETRY?: string;

  /** CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING */
  CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING?: string;

  /** CLAUDE_CONFIG_DIR */
  CLAUDE_CONFIG_DIR?: string;

  /** HTTP_PROXY */
  HTTP_PROXY?: string;

  /** HTTPS_PROXY */
  HTTPS_PROXY?: string;

  /** NO_PROXY */
  NO_PROXY?: string;
}

// ============================================================================
// Runtime Configuration
// ============================================================================

/**
 * Runtime configuration (CLI arguments + environment + config files)
 *
 * This represents the final merged configuration at runtime
 */
export interface RuntimeConfig extends ClaudeConfig {
  /** Current working directory */
  cwd: string;

  /** Session ID (if resuming) */
  sessionId?: string;

  /** Initial prompt */
  initialPrompt?: string;

  /** Print mode (non-interactive) */
  printMode?: boolean;

  /** Resume last session */
  resume?: boolean;

  /** Accept all edits without prompting */
  acceptEdits?: boolean;

  /** Bypass all permissions */
  bypassPermissions?: boolean;

  /** Plan mode (no execution) */
  planMode?: boolean;

  /** Input format */
  inputFormat?: 'text' | 'stream-json';

  /** Output format */
  outputFormat?: 'text' | 'json' | 'stream-json';

  /** Compute start time */
  startTime?: number;
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Validation successful */
  valid: boolean;

  /** Validation errors */
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;

  /** Validation warnings */
  warnings?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}

// ============================================================================
// Configuration Migration
// ============================================================================

/**
 * Configuration migration
 */
export interface ConfigMigration {
  /** Source version */
  fromVersion: string;

  /** Target version */
  toVersion: string;

  /** Migration function */
  migrate: (config: Partial<ClaudeConfig>) => Partial<ClaudeConfig>;

  /** Migration description */
  description?: string;
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<ClaudeConfig> = {
  version: '2.0.76',
  model: 'sonnet',
  maxTokens: 8192,
  temperature: 1,
  maxRetries: 3,
  requestTimeout: 300000,
  theme: 'auto',
  verbose: false,
  enableTelemetry: false,
  disableFileCheckpointing: false,
  enableAutoSave: true,
  maxConcurrentTasks: 10,
  useBedrock: false,
  useVertex: false,
};

/**
 * Environment variable names
 */
export const ENV_VAR_NAMES = {
  API_KEY: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  OAUTH_TOKEN: 'CLAUDE_CODE_OAUTH_TOKEN',
  USE_BEDROCK: 'CLAUDE_CODE_USE_BEDROCK',
  USE_VERTEX: 'CLAUDE_CODE_USE_VERTEX',
  MAX_TOKENS: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  MAX_RETRIES: 'CLAUDE_CODE_MAX_RETRIES',
  DEBUG_LOGS_DIR: 'CLAUDE_CODE_DEBUG_LOGS_DIR',
  ENABLE_TELEMETRY: 'CLAUDE_CODE_ENABLE_TELEMETRY',
  DISABLE_CHECKPOINTING: 'CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING',
  CONFIG_DIR: 'CLAUDE_CONFIG_DIR',
} as const;

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  /** Global config directory */
  GLOBAL_DIR: '~/.claude',

  /** Global config file */
  GLOBAL_FILE: '~/.claude/settings.json',

  /** Project config directory */
  PROJECT_DIR: '.claude',

  /** Project config file */
  PROJECT_FILE: '.claude/settings.json',

  /** Session directory */
  SESSION_DIR: '~/.claude/sessions',

  /** Plugin directory */
  PLUGIN_DIR: '~/.claude/plugins',

  /** Hook directory */
  HOOK_DIR: '~/.claude/hooks',

  /** Skills directory */
  SKILLS_DIR: '~/.claude/skills',
} as const;
