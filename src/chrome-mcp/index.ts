/**
 * Chrome MCP 模块 - 与官方 Claude Code Chrome 扩展集成
 *
 * 完全对齐官方实现，复用官方 Chrome 扩展
 *
 * 架构：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        通信架构图                                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  Chrome 扩展 (官方)                                              │
 * │      ↕ Native Messaging (stdin/stdout, 4字节长度头+JSON)         │
 * │  Native Host (chrome-native-host 脚本)                          │
 * │      ↕ 启动                                                      │
 * │  Socket Server ←────────────────────────────────┐               │
 * │      ↕ Unix Socket / Named Pipe                 │               │
 * │  Socket Client                                  │ 同一进程       │
 * │      ↕                                          │               │
 * │  MCP Server ←───────────────────────────────────┘               │
 * │      ↕ stdio                                                    │
 * │  Claude Code CLI (主进程)                                        │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

// Native Host 管理
export {
  CHROME_EXTENSION_ID,
  NATIVE_HOST_NAME,
  CHROME_INSTALL_URL,
  CHROME_RECONNECT_URL,
  CHROME_PERMISSIONS_URL,
  CHROME_SYSTEM_PROMPT,
  getPlatform,
  getNativeHostsDirectory,
  getClaudeConfigDir,
  getSocketPath,
  generateNativeHostManifest,
  generateWrapperScript,
  installWrapperScript,
  installNativeHostManifest,
  isExtensionInstalled,
  setupChromeNativeHost,
  getMcpToolNames
} from './native-host.js';

// Socket Server (Native Host 进程)
export {
  SocketServer,
  NativeMessageReader,
  runNativeHost
} from './socket-server.js';

// Socket Client (MCP Server 进程)
export {
  SocketClient,
  SocketConnectionError,
  createSocketClient
} from './socket-client.js';
export type { ToolCallResult } from './socket-client.js';

// MCP Server
export {
  McpServer,
  DefaultMcpLogger,
  runMcpServer
} from './mcp-server.js';
export type { McpServerConfig, McpLogger, McpToolResult } from './mcp-server.js';

// MCP 工具定义
export {
  CHROME_MCP_TOOLS,
  getToolNamesWithPrefix
} from './tools.js';
export type { McpTool } from './tools.js';

/**
 * 检查 Chrome 集成是否可用
 */
export function isChromeIntegrationSupported(): boolean {
  const platform = getPlatform();
  return platform === 'macos' || platform === 'linux' || platform === 'windows';
}

/**
 * 检查 Chrome 集成是否已配置
 */
export async function isChromeIntegrationConfigured(): Promise<boolean> {
  const { getNativeHostsDirectory } = await import('./native-host.js');
  const fs = await import('fs/promises');
  const path = await import('path');

  const hostsDir = getNativeHostsDirectory();
  if (!hostsDir) return false;

  const manifestPath = path.join(hostsDir, `${NATIVE_HOST_NAME}.json`);

  try {
    await fs.access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

// 重新导出 getPlatform 以避免循环导入问题
import { getPlatform, NATIVE_HOST_NAME, setupChromeNativeHost, getMcpToolNames, CHROME_SYSTEM_PROMPT } from './native-host.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Chrome 集成配置结果
 */
export interface ChromeIntegrationConfig {
  mcpConfig: Record<string, {
    type: 'stdio';
    command: string;
    args: string[];
    scope: 'dynamic';
  }>;
  allowedTools: string[];
  systemPrompt: string;
}

/**
 * 检查是否应该启用 Chrome 集成
 *
 * 与官方实现一致，检查以下条件：
 * 1. --chrome 命令行参数
 * 2. CLAUDE_CODE_ENABLE_CFC 环境变量
 * 3. claudeInChromeDefaultEnabled 配置
 *
 * @param cliChromeFlag 命令行 --chrome 参数值
 */
export function shouldEnableChromeIntegration(cliChromeFlag?: boolean): boolean {
  // 如果明确通过 --no-chrome 禁用
  if (cliChromeFlag === false) {
    return false;
  }

  // 如果通过 --chrome 明确启用
  if (cliChromeFlag === true) {
    return true;
  }

  // 检查环境变量
  const envValue = process.env.CLAUDE_CODE_ENABLE_CFC;
  if (envValue === '1' || envValue === 'true') {
    return true;
  }
  if (envValue === '0' || envValue === 'false') {
    return false;
  }

  // 检查配置文件
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (typeof settings.claudeInChromeDefaultEnabled === 'boolean') {
        return settings.claudeInChromeDefaultEnabled;
      }
    }
  } catch {
    // 忽略配置读取错误
  }

  return false;
}

/**
 * 获取 Chrome 集成配置
 *
 * 在 CLI 启动时调用，如果 Chrome 集成已启用，返回 MCP 配置
 * 这样 MCP 工具可以立即可用，无需重启
 *
 * @param cliChromeFlag 命令行 --chrome 参数值
 */
export async function getChromeIntegrationConfig(cliChromeFlag?: boolean): Promise<ChromeIntegrationConfig | null> {
  // 检查是否应该启用
  if (!shouldEnableChromeIntegration(cliChromeFlag)) {
    return null;
  }

  // 检查平台支持
  if (!isChromeIntegrationSupported()) {
    console.warn('[Claude in Chrome] Platform not supported');
    return null;
  }

  try {
    // 设置 Native Host 并获取配置
    const config = await setupChromeNativeHost();

    console.log('[Claude in Chrome] Integration enabled');

    return {
      mcpConfig: config.mcpConfig as ChromeIntegrationConfig['mcpConfig'],
      allowedTools: config.allowedTools,
      systemPrompt: config.systemPrompt,
    };
  } catch (error) {
    console.error('[Claude in Chrome] Failed to initialize:', error);
    return null;
  }
}

/**
 * 启用 Chrome 集成
 *
 * 保存配置并返回 MCP 配置，调用者可以动态添加到 MCP 服务器列表
 */
export async function enableChromeIntegration(): Promise<ChromeIntegrationConfig | null> {
  // 保存配置
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    let settings: Record<string, unknown> = {};

    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch {}

    settings.claudeInChromeDefaultEnabled = true;

    // 确保目录存在
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('[Claude in Chrome] Failed to save settings:', error);
  }

  // 返回配置
  return getChromeIntegrationConfig(true);
}

/**
 * 禁用 Chrome 集成
 */
export function disableChromeIntegration(): void {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    let settings: Record<string, unknown> = {};

    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch {}

    settings.claudeInChromeDefaultEnabled = false;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    console.log('[Claude in Chrome] Integration disabled');
  } catch (error) {
    console.error('[Claude in Chrome] Failed to save settings:', error);
  }
}
