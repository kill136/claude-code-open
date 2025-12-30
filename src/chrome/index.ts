/**
 * Chrome 集成模块
 * 支持通过 Chrome DevTools Protocol 与浏览器交互
 */

import * as http from 'http';
import * as https from 'https';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Chrome 连接配置
export interface ChromeConfig {
  host?: string;
  port?: number;
  secure?: boolean;
}

// Chrome 标签页信息
export interface ChromeTab {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

// CDP 命令
export interface CDPCommand {
  method: string;
  params?: Record<string, unknown>;
}

// CDP 响应
export interface CDPResponse {
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// CDP 事件
export interface CDPEvent {
  method: string;
  params: Record<string, unknown>;
}

// Chrome 启动选项
export interface ChromeLaunchOptions {
  headless?: boolean;
  userDataDir?: string;
  port?: number;
  args?: string[];
  executablePath?: string;
}

// 控制台消息
export interface ConsoleMessage {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
  text: string;
  timestamp: number;
}

// Chrome DevTools Protocol 客户端
export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId: number = 0;
  private pendingRequests: Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }> = new Map();
  private connected: boolean = false;

  constructor(private wsUrl: string) {
    super();
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.emit('connected');
          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (err: Error) => {
          this.emit('error', err);
          resolve(false);
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });
      } catch (err) {
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // 检查是否是响应
      if ('id' in message) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
      } else if ('method' in message) {
        // 这是一个事件
        this.emit('event', message as CDPEvent);
        this.emit(message.method, message.params);
      }
    } catch (err) {
      this.emit('parse_error', err);
    }
  }

  async send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      const message = JSON.stringify({
        id,
        method,
        params: params || {},
      });

      this.pendingRequests.set(id, {
        resolve: resolve as (r: unknown) => void,
        reject,
      });

      this.ws!.send(message);
      // 错误通过事件处理

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // 便捷方法
  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send<{ result: { value: unknown } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    return result.result.value;
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  async getDocument(): Promise<unknown> {
    return this.send('DOM.getDocument');
  }

  async captureScreenshot(): Promise<string> {
    const result = await this.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
    });
    return result.data;
  }

  async setUserAgent(userAgent: string): Promise<void> {
    await this.send('Network.setUserAgentOverride', { userAgent });
  }

  // 启用页面事件监听
  async enablePageEvents(): Promise<void> {
    await this.send('Page.enable');
  }

  // 启用 DOM 事件监听
  async enableDOMEvents(): Promise<void> {
    await this.send('DOM.enable');
  }

  // 启用控制台日志监听
  async enableConsole(): Promise<void> {
    await this.send('Runtime.enable');
    await this.send('Log.enable');
  }

  // 启用网络事件监听
  async enableNetwork(): Promise<void> {
    await this.send('Network.enable');
  }

  // 等待页面加载完成
  async waitForPageLoad(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('Page.loadEventFired', onLoad);
        reject(new Error('Page load timeout'));
      }, timeout);

      const onLoad = () => {
        clearTimeout(timer);
        resolve();
      };

      this.once('Page.loadEventFired', onLoad);
    });
  }

  // 获取控制台消息
  getConsoleMessages(): ConsoleMessage[] {
    const messages: ConsoleMessage[] = [];

    this.on('Runtime.consoleAPICalled', (params: unknown) => {
      const p = params as { type: string; args: unknown[]; timestamp: number };
      messages.push({
        type: p.type as ConsoleMessage['type'],
        args: p.args,
        text: JSON.stringify(p.args),
        timestamp: p.timestamp,
      });
    });

    return messages;
  }
}

// Chrome 浏览器管理器
export class ChromeManager extends EventEmitter {
  private config: Required<ChromeConfig>;
  private clients: Map<string, CDPClient> = new Map();

  constructor(config: ChromeConfig = {}) {
    super();
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 9222,
      secure: config.secure || false,
    };
  }

  // 获取可用标签页
  async getTabs(): Promise<ChromeTab[]> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.secure ? 'https' : 'http';
      const url = `${protocol}://${this.config.host}:${this.config.port}/json`;

      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as ChromeTab[]);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  // 获取新标签页
  async newTab(url?: string): Promise<ChromeTab> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.secure ? 'https' : 'http';
      const endpoint = url
        ? `/json/new?${encodeURIComponent(url)}`
        : '/json/new';
      const requestUrl = `${protocol}://${this.config.host}:${this.config.port}${endpoint}`;

      http.get(requestUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as ChromeTab);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  // 关闭标签页
  async closeTab(tabId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const protocol = this.config.secure ? 'https' : 'http';
      const url = `${protocol}://${this.config.host}:${this.config.port}/json/close/${tabId}`;

      http.get(url, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', () => resolve(false));
    });
  }

  // 连接到标签页
  async connect(tab: ChromeTab): Promise<CDPClient | null> {
    if (!tab.webSocketDebuggerUrl) {
      return null;
    }

    const client = new CDPClient(tab.webSocketDebuggerUrl);
    const connected = await client.connect();

    if (connected) {
      this.clients.set(tab.id, client);
      return client;
    }

    return null;
  }

  // 获取或创建客户端
  async getClient(tabId?: string): Promise<CDPClient | null> {
    if (tabId && this.clients.has(tabId)) {
      return this.clients.get(tabId)!;
    }

    const tabs = await this.getTabs();
    const tab = tabId
      ? tabs.find(t => t.id === tabId)
      : tabs.find(t => t.type === 'page');

    if (!tab) {
      return null;
    }

    return this.connect(tab);
  }

  // 断开所有连接
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }

  // 检查 Chrome 是否可用
  async isAvailable(): Promise<boolean> {
    try {
      const tabs = await this.getTabs();
      return Array.isArray(tabs);
    } catch {
      return false;
    }
  }
}

// Chrome 工具集成
export class ChromeTools {
  private manager: ChromeManager;
  private launcher: ChromeLauncher | null = null;
  private consoleLogs: ConsoleMessage[] = [];

  constructor(config?: ChromeConfig) {
    this.manager = new ChromeManager(config);
  }

  // 启动 Chrome
  async launchChrome(options?: ChromeLaunchOptions): Promise<{ port: number; wsEndpoint: string }> {
    if (!this.launcher) {
      this.launcher = new ChromeLauncher();
    }
    return this.launcher.launch(options);
  }

  // 关闭 Chrome
  async closeChrome(): Promise<void> {
    if (this.launcher) {
      await this.launcher.kill();
      this.launcher = null;
    }
  }

  // 启用控制台监听
  async enableConsoleLogs(): Promise<void> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    await client.enableConsole();

    // 监听控制台消息
    client.on('Runtime.consoleAPICalled', (params: unknown) => {
      const p = params as { type: string; args: { value: unknown }[]; timestamp: number };
      this.consoleLogs.push({
        type: p.type as ConsoleMessage['type'],
        args: p.args.map(arg => arg.value),
        text: p.args.map(arg => JSON.stringify(arg.value)).join(' '),
        timestamp: p.timestamp,
      });
    });
  }

  // 获取控制台日志
  getConsoleLogs(): ConsoleMessage[] {
    return [...this.consoleLogs];
  }

  // 清空控制台日志
  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  // 获取页面内容
  async getPageContent(url?: string): Promise<{ title: string; content: string; url: string }> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    if (url) {
      await client.navigate(url);
      await new Promise(r => setTimeout(r, 2000)); // 等待页面加载
    }

    const title = await client.evaluate('document.title') as string;
    const content = await client.evaluate('document.body.innerText') as string;
    const currentUrl = await client.evaluate('window.location.href') as string;

    return { title, content, url: currentUrl };
  }

  // 执行 JavaScript
  async executeScript(script: string): Promise<unknown> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    return client.evaluate(script);
  }

  // 截图
  async screenshot(): Promise<Buffer> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    const base64 = await client.captureScreenshot();
    return Buffer.from(base64, 'base64');
  }

  // 获取页面 HTML
  async getHTML(): Promise<string> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    return await client.evaluate('document.documentElement.outerHTML') as string;
  }

  // 点击元素
  async click(selector: string): Promise<boolean> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    try {
      await client.evaluate(`document.querySelector('${selector}').click()`);
      return true;
    } catch {
      return false;
    }
  }

  // 输入文本
  async type(selector: string, text: string): Promise<boolean> {
    const client = await this.manager.getClient();
    if (!client) {
      throw new Error('Chrome not available');
    }

    try {
      await client.evaluate(`
        const el = document.querySelector('${selector}');
        el.value = '${text.replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      `);
      return true;
    } catch {
      return false;
    }
  }

  // 列出可用标签页
  async listTabs(): Promise<ChromeTab[]> {
    return this.manager.getTabs();
  }

  // 检查是否可用
  async isAvailable(): Promise<boolean> {
    return this.manager.isAvailable();
  }
}

// Chrome 启动器
export class ChromeLauncher {
  private process: childProcess.ChildProcess | null = null;
  private port: number;
  private userDataDir: string | null = null;
  private shouldCleanup: boolean = false;

  constructor() {
    this.port = 9222; // 默认端口
  }

  // 查找 Chrome 可执行文件路径
  private findChromePath(): string {
    const platform = os.platform();
    const paths: string[] = [];

    if (platform === 'darwin') {
      // macOS
      paths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      );
    } else if (platform === 'win32') {
      // Windows
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData = process.env['LOCALAPPDATA'] || '';

      paths.push(
        path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(programFiles, 'Chromium\\Application\\chrome.exe')
      );
    } else {
      // Linux
      paths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      );
    }

    for (const chromePath of paths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    throw new Error('Chrome executable not found');
  }

  // 启动 Chrome
  async launch(options: ChromeLaunchOptions = {}): Promise<{ port: number; wsEndpoint: string }> {
    if (this.process) {
      throw new Error('Chrome is already running');
    }

    const executablePath = options.executablePath || this.findChromePath();
    this.port = options.port || 9222;

    // 创建临时用户数据目录
    if (!options.userDataDir) {
      this.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
      this.shouldCleanup = true;
    } else {
      this.userDataDir = options.userDataDir;
      this.shouldCleanup = false;
    }

    const args = [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-service-autorun',
      '--password-store=basic',
      '--use-mock-keychain',
      ...(options.headless ? ['--headless=new'] : []),
      ...(options.args || []),
    ];

    return new Promise((resolve, reject) => {
      this.process = childProcess.spawn(executablePath, args, {
        stdio: 'ignore',
        detached: false,
      });

      if (!this.process) {
        reject(new Error('Failed to spawn Chrome process'));
        return;
      }

      this.process.on('error', (err) => {
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.process = null;
      });

      // 等待 Chrome 启动并获取 WebSocket 端点
      const maxRetries = 50;
      let retries = 0;

      const checkReady = async () => {
        try {
          const response = await this.getVersion();
          resolve({
            port: this.port,
            wsEndpoint: response.webSocketDebuggerUrl,
          });
        } catch (err) {
          retries++;
          if (retries >= maxRetries) {
            this.kill();
            reject(new Error('Chrome failed to start within timeout'));
          } else {
            setTimeout(checkReady, 100);
          }
        }
      };

      setTimeout(checkReady, 100);
    });
  }

  // 获取版本信息
  private async getVersion(): Promise<{ webSocketDebuggerUrl: string }> {
    return new Promise((resolve, reject) => {
      const url = `http://localhost:${this.port}/json/version`;

      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  // 关闭 Chrome
  async kill(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');

      // 等待进程退出
      await new Promise<void>((resolve) => {
        if (!this.process) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }

    // 清理临时目录
    if (this.shouldCleanup && this.userDataDir && fs.existsSync(this.userDataDir)) {
      try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
      } catch (err) {
        // 忽略清理错误
      }
      this.userDataDir = null;
    }
  }

  // 检查 Chrome 是否正在运行
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  // 获取端口
  getPort(): number {
    return this.port;
  }
}

// 默认实例
export const chromeLauncher = new ChromeLauncher();
export const chromeManager = new ChromeManager();
export const chromeTools = new ChromeTools();
