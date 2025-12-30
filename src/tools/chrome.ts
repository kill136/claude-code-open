/**
 * Chrome DevTools 工具
 * 支持浏览器自动化和页面交互
 */

import { BaseTool } from './base.js';
import { ChromeTools, ChromeLauncher, type ChromeLaunchOptions } from '../chrome/index.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

// Chrome 工具输入类型
interface ChromeToolInput {
  action: 'launch' | 'close' | 'screenshot' | 'navigate' | 'execute' | 'getContent' |
          'getHTML' | 'click' | 'type' | 'listTabs' | 'getConsoleLogs' | 'enableConsoleLogs';
  headless?: boolean;
  port?: number;
  url?: string;
  script?: string;
  selector?: string;
  text?: string;
}

/**
 * Chrome DevTools Tool
 */
export class ChromeTool extends BaseTool<ChromeToolInput, ToolResult> {
  name = 'Chrome';
  description = `与 Chrome 浏览器交互，支持：
- 启动/关闭 Chrome (headless 或 GUI 模式)
- 网页截图
- 页面导航
- 执行 JavaScript
- DOM 操作（点击、输入）
- 获取控制台日志
- 管理标签页`;

  private chromeTools: ChromeTools;
  private launcher: ChromeLauncher | null = null;

  constructor() {
    super();
    this.chromeTools = new ChromeTools();
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['launch', 'close', 'screenshot', 'navigate', 'execute', 'getContent',
                 'getHTML', 'click', 'type', 'listTabs', 'getConsoleLogs', 'enableConsoleLogs'],
          description: '要执行的操作',
        },
        headless: {
          type: 'boolean',
          description: '是否以无头模式启动 Chrome',
        },
        port: {
          type: 'number',
          description: 'Chrome 调试端口',
        },
        url: {
          type: 'string',
          description: '要导航到的 URL',
        },
        script: {
          type: 'string',
          description: '要执行的 JavaScript 代码',
        },
        selector: {
          type: 'string',
          description: 'CSS 选择器',
        },
        text: {
          type: 'string',
          description: '要输入的文本',
        },
      },
      required: ['action'],
    };
  }

  async execute(input: ChromeToolInput): Promise<ToolResult> {
    try {
      switch (input.action) {
        case 'launch':
          return await this.launchChrome(input);

        case 'close':
          return await this.closeChrome();

        case 'screenshot':
          return await this.takeScreenshot();

        case 'navigate':
          if (!input.url) {
            throw new Error('URL is required for navigate action');
          }
          return await this.navigate(input.url);

        case 'execute':
          if (!input.script) {
            throw new Error('Script is required for execute action');
          }
          return await this.executeScript(input.script);

        case 'getContent':
          return await this.getPageContent(input.url);

        case 'getHTML':
          return await this.getHTML();

        case 'click':
          if (!input.selector) {
            throw new Error('Selector is required for click action');
          }
          return await this.click(input.selector);

        case 'type':
          if (!input.selector || !input.text) {
            throw new Error('Selector and text are required for type action');
          }
          return await this.type(input.selector, input.text);

        case 'listTabs':
          return await this.listTabs();

        case 'getConsoleLogs':
          return await this.getConsoleLogs();

        case 'enableConsoleLogs':
          return await this.enableConsoleLogs();

        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
          };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  private async launchChrome(input: ChromeToolInput): Promise<ToolResult> {
    try {
      const options: ChromeLaunchOptions = {
        headless: input.headless ?? true,
        port: input.port,
      };

      const result = await this.chromeTools.launchChrome(options);

      return {
        success: true,
        output: `Chrome launched successfully on port ${result.port}\nWebSocket endpoint: ${result.wsEndpoint}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to launch Chrome',
      };
    }
  }

  private async closeChrome(): Promise<ToolResult> {
    try {
      await this.chromeTools.closeChrome();
      return {
        success: true,
        output: 'Chrome closed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close Chrome',
      };
    }
  }

  private async takeScreenshot(): Promise<ToolResult> {
    try {
      const buffer = await this.chromeTools.screenshot();
      const base64 = buffer.toString('base64');

      return {
        success: true,
        output: `Screenshot captured (${buffer.length} bytes)`,
        newMessages: [{
          role: 'user' as const,
          content: [{
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: base64,
            },
          }],
        }],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture screenshot',
      };
    }
  }

  private async navigate(url: string): Promise<ToolResult> {
    try {
      const client = await this.chromeTools['manager'].getClient();
      if (!client) {
        return {
          success: false,
          error: 'Chrome not available. Please launch Chrome first.',
        };
      }

      await client.navigate(url);
      await client.waitForPageLoad().catch(() => {
        // 忽略超时错误，某些页面可能不会触发 load 事件
      });

      return {
        success: true,
        output: `Navigated to ${url}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed',
      };
    }
  }

  private async executeScript(script: string): Promise<ToolResult> {
    try {
      const result = await this.chromeTools.executeScript(script);
      return {
        success: true,
        output: `Script executed. Result: ${JSON.stringify(result, null, 2)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Script execution failed',
      };
    }
  }

  private async getPageContent(url?: string): Promise<ToolResult> {
    try {
      const content = await this.chromeTools.getPageContent(url);

      return {
        success: true,
        output: `Page: ${content.title}\nURL: ${content.url}\n\nContent:\n${content.content}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get page content',
      };
    }
  }

  private async getHTML(): Promise<ToolResult> {
    try {
      const html = await this.chromeTools.getHTML();
      return {
        success: true,
        output: html,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get HTML',
      };
    }
  }

  private async click(selector: string): Promise<ToolResult> {
    try {
      const success = await this.chromeTools.click(selector);

      if (success) {
        return {
          success: true,
          output: `Clicked element: ${selector}`,
        };
      } else {
        return {
          success: false,
          error: `Failed to click element: ${selector}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Click operation failed',
      };
    }
  }

  private async type(selector: string, text: string): Promise<ToolResult> {
    try {
      const success = await this.chromeTools.type(selector, text);

      if (success) {
        return {
          success: true,
          output: `Typed "${text}" into element: ${selector}`,
        };
      } else {
        return {
          success: false,
          error: `Failed to type into element: ${selector}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Type operation failed',
      };
    }
  }

  private async listTabs(): Promise<ToolResult> {
    try {
      const tabs = await this.chromeTools.listTabs();

      if (tabs.length === 0) {
        return {
          success: true,
          output: 'No tabs found',
        };
      }

      return {
        success: true,
        output: `Found ${tabs.length} tab(s):\n\n` +
          tabs.map((tab, index) =>
            `${index + 1}. ${tab.title}\n   URL: ${tab.url}\n   Type: ${tab.type}\n   ID: ${tab.id}`
          ).join('\n\n'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tabs',
      };
    }
  }

  private async getConsoleLogs(): Promise<ToolResult> {
    try {
      const logs = this.chromeTools.getConsoleLogs();

      if (logs.length === 0) {
        return {
          success: true,
          output: 'No console logs recorded',
        };
      }

      return {
        success: true,
        output: `Console logs (${logs.length} messages):\n\n` +
          logs.map((log, index) =>
            `${index + 1}. [${log.type}] ${log.text}`
          ).join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get console logs',
      };
    }
  }

  private async enableConsoleLogs(): Promise<ToolResult> {
    try {
      await this.chromeTools.enableConsoleLogs();
      return {
        success: true,
        output: 'Console logging enabled',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable console logging',
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.chromeTools.closeChrome();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
