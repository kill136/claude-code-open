/**
 * Chrome 集成模块
 *
 * 与官方 Claude Code 保持一致，使用 MCP + Native Messaging 模式
 * 通过 Chrome 插件控制用户的浏览器
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
 *
 * 用户需要安装官方 Chrome 扩展：
 * https://chrome.google.com/webstore/detail/fcoeoabgfenejglbffodgkkbkcdhcgfn
 */

// 从 chrome-mcp 模块导出官方集成
export {
  // 常量
  CHROME_EXTENSION_ID,
  NATIVE_HOST_NAME,
  CHROME_INSTALL_URL,
  CHROME_RECONNECT_URL,
  CHROME_PERMISSIONS_URL,
  CHROME_SYSTEM_PROMPT,
  // 功能函数
  getPlatform,
  getNativeHostsDirectory,
  getClaudeConfigDir,
  getSocketPath,
  isExtensionInstalled,
  setupChromeNativeHost,
  getMcpToolNames,
  // 检查函数
  isChromeIntegrationSupported,
  isChromeIntegrationConfigured,
  // 集成配置函数（新增）
  shouldEnableChromeIntegration,
  getChromeIntegrationConfig,
  enableChromeIntegration,
  disableChromeIntegration,
  // MCP 工具定义
  CHROME_MCP_TOOLS,
  getToolNamesWithPrefix,
} from '../chrome-mcp/index.js';

export type { McpTool, ChromeIntegrationConfig } from '../chrome-mcp/index.js';
