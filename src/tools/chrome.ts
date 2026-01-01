/**
 * Chrome 浏览器工具
 *
 * 与官方 Claude Code 保持一致，使用 MCP + Native Messaging 模式
 * 通过 Chrome 插件控制用户的浏览器
 *
 * 官方实现方式：
 * Chrome 扩展 ↔ Native Messaging ↔ Native Host ↔ MCP Server ↔ Claude CLI
 *
 * 用户需要安装官方 Chrome 扩展：
 * https://chrome.google.com/webstore/detail/fcoeoabgfenejglbffodgkkbkcdhcgfn
 */

import { BaseTool } from './base.js';
import {
  isChromeIntegrationSupported,
  isChromeIntegrationConfigured,
  isExtensionInstalled,
  CHROME_INSTALL_URL,
  getMcpToolNames,
  shouldEnableChromeIntegration,
  enableChromeIntegration,
  disableChromeIntegration,
} from '../chrome/index.js';
import { configManager } from '../config/index.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

// Chrome 工具输入类型
interface ChromeToolInput {
  action: 'status' | 'enable' | 'disable';
}

/**
 * Chrome 工具
 * 管理 Claude in Chrome 集成状态
 *
 * 实际的浏览器操作通过 mcp__claude-in-chrome__* 工具完成
 */
export class ChromeTool extends BaseTool<ChromeToolInput, ToolResult> {
  name = 'Chrome';
  description = `管理 Claude in Chrome 浏览器集成。

这个工具用于检查和管理 Claude in Chrome 功能。
启用后，可以使用 mcp__claude-in-chrome__* 工具进行浏览器操作。

**可用操作：**
- status: 检查 Claude in Chrome 状态
- enable: 启用 Claude in Chrome（立即生效，无需重启）
- disable: 禁用 Claude in Chrome

**浏览器操作工具（启用后可用）：**
- mcp__claude-in-chrome__tabs_context_mcp - 获取当前标签页信息
- mcp__claude-in-chrome__tabs_create_mcp - 创建新标签页
- mcp__claude-in-chrome__navigate - 导航到 URL
- mcp__claude-in-chrome__computer - 鼠标、键盘操作和截图
- mcp__claude-in-chrome__javascript_tool - 执行 JavaScript
- mcp__claude-in-chrome__read_page - 读取页面内容
- mcp__claude-in-chrome__find - 查找页面元素
- mcp__claude-in-chrome__form_input - 填写表单
- mcp__claude-in-chrome__get_page_text - 获取页面文本
- mcp__claude-in-chrome__read_console_messages - 读取控制台日志
- mcp__claude-in-chrome__read_network_requests - 读取网络请求
- mcp__claude-in-chrome__gif_creator - 录制 GIF
- mcp__claude-in-chrome__resize_window - 调整窗口大小`;

  constructor() {
    super();
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'enable', 'disable'],
          description: '要执行的操作：status（检查状态）、enable（启用）、disable（禁用）',
        },
      },
      required: ['action'],
    };
  }

  async execute(input: ChromeToolInput): Promise<ToolResult> {
    try {
      switch (input.action) {
        case 'status':
          return await this.getStatus();

        case 'enable':
          return await this.handleEnable();

        case 'disable':
          return await this.handleDisable();

        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}. Use 'status', 'enable', or 'disable'.`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getStatus(): Promise<ToolResult> {
    const supported = isChromeIntegrationSupported();
    const configured = await isChromeIntegrationConfigured();
    const extensionInstalled = await isExtensionInstalled();
    const enabled = shouldEnableChromeIntegration();
    const ready = enabled && configured && extensionInstalled;

    let output = `Claude in Chrome Status:\n\n`;
    output += `Platform Supported: ${supported ? '✓ Yes' : '✗ No'}\n`;
    output += `Enabled: ${enabled ? '✓ Yes' : '○ No'}\n`;
    output += `Native Host Configured: ${configured ? '✓ Yes' : '○ No'}\n`;
    output += `Chrome Extension Installed: ${extensionInstalled ? '✓ Yes' : '○ No'}\n`;
    output += `Ready: ${ready ? '✓ Yes' : '○ No'}\n`;

    if (!supported) {
      output += `\n⚠ Your platform does not support Claude in Chrome.\n`;
      output += `Supported platforms: macOS, Linux, Windows\n`;
    } else if (!enabled) {
      output += `\nTo enable Claude in Chrome:\n`;
      output += `  Use Chrome({ action: 'enable' })\n`;
      output += `  Or start Claude Code with --chrome flag\n`;
    } else if (!extensionInstalled) {
      output += `\n⚠ Chrome extension not detected.\n`;
      output += `Please install the Claude Chrome extension:\n`;
      output += `  ${CHROME_INSTALL_URL}\n`;
    } else if (ready) {
      output += `\n✓ Claude in Chrome is ready!\n`;
      output += `\nAvailable browser tools:\n`;
      const tools = getMcpToolNames().slice(0, 5);
      tools.forEach(tool => {
        output += `  - ${tool}\n`;
      });
      output += `  ... and more\n`;
      output += `\nUse mcp__claude-in-chrome__tabs_context_mcp to get started.\n`;
    }

    return {
      success: true,
      output,
    };
  }

  private async handleEnable(): Promise<ToolResult> {
    try {
      // 检查平台支持
      if (!isChromeIntegrationSupported()) {
        return {
          success: false,
          error: 'Claude in Chrome is not supported on this platform.',
        };
      }

      // 启用 Chrome 集成并获取配置
      const chromeConfig = await enableChromeIntegration();

      if (!chromeConfig) {
        return {
          success: false,
          error: 'Failed to enable Chrome integration.',
        };
      }

      // 动态添加 MCP 服务器配置
      for (const [name, config] of Object.entries(chromeConfig.mcpConfig)) {
        try {
          configManager.addMcpServer(name, config as any);
        } catch {
          // 服务器可能已存在
        }
      }

      // 检查扩展
      const extensionInstalled = await isExtensionInstalled();

      if (extensionInstalled) {
        return {
          success: true,
          output: `✓ Claude in Chrome enabled successfully!\n\nBrowser tools are now available. Use mcp__claude-in-chrome__tabs_context_mcp to get started.\n\nAvailable tools:\n${getMcpToolNames().slice(0, 5).map(t => `  - ${t}`).join('\n')}\n  ... and more`,
        };
      } else {
        return {
          success: true,
          output: `✓ Claude in Chrome enabled. Native Host installed.\n\n⚠ Chrome extension not detected.\nPlease install the extension:\n${CHROME_INSTALL_URL}\n\nAfter installing, the browser tools will be ready to use.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to enable Claude in Chrome: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async handleDisable(): Promise<ToolResult> {
    try {
      disableChromeIntegration();

      // 尝试移除 MCP 服务器配置
      try {
        configManager.removeMcpServer('claude-in-chrome');
      } catch {
        // 服务器可能不存在
      }

      return {
        success: true,
        output: 'Claude in Chrome disabled.\n\nBrowser tools are no longer available.',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to disable Claude in Chrome: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for MCP mode
  }
}
