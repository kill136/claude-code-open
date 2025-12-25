/**
 * MCP 资源管理器
 * 提供资源发现、读取、缓存和订阅功能
 */

import { EventEmitter } from 'events';

// ============ 接口定义 ============

/**
 * MCP 资源定义
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

/**
 * 资源内容
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: Uint8Array;
}

/**
 * 资源模板定义
 */
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * 解析后的 URI
 */
export interface ParsedUri {
  scheme: string;
  authority?: string;
  path: string;
  query?: Record<string, string>;
  fragment?: string;
}

/**
 * 资源变更回调
 */
export type ResourceCallback = (content: ResourceContent) => void;

/**
 * 订阅对象
 */
export interface Subscription {
  id: string;
  serverName: string;
  uri: string;
  callback: ResourceCallback;
  unsubscribe: () => void;
}

/**
 * 缓存项
 */
interface CacheEntry {
  content: ResourceContent;
  timestamp: number;
  ttl: number;
}

/**
 * MCP 连接管理器接口（简化版）
 */
export interface McpConnectionManager {
  sendMessage(serverName: string, method: string, params: unknown): Promise<unknown | null>;
  isConnected(serverName: string): boolean;
  connect(serverName: string): Promise<boolean>;
  getServerNames(): string[];
}

// ============ 辅助函数 ============

/**
 * 解析资源 URI
 * 支持标准 URI 格式: scheme://authority/path?query#fragment
 */
export function parseResourceUri(uri: string): ParsedUri {
  const uriPattern = /^([a-z][a-z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i;
  const match = uri.match(uriPattern);

  if (!match) {
    // 如果不匹配标准 URI，将整个字符串作为 path
    return {
      scheme: 'unknown',
      path: uri,
    };
  }

  const [, scheme, authority, path, queryString, fragment] = match;

  // 解析查询参数
  const query: Record<string, string> = {};
  if (queryString) {
    queryString.split('&').forEach((param) => {
      const [key, value] = param.split('=');
      if (key) {
        query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
  }

  return {
    scheme,
    authority,
    path,
    query: Object.keys(query).length > 0 ? query : undefined,
    fragment,
  };
}

/**
 * 匹配资源模板
 * 支持变量替换，例如: file:///{path} 可以匹配 file:///example.txt
 * 返回匹配的变量值，如果不匹配返回 null
 */
export function matchResourceTemplate(
  uri: string,
  template: string
): Record<string, string> | null {
  // 将模板转换为正则表达式
  // 替换 {varName} 为捕获组
  const variablePattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const variables: string[] = [];

  let regexPattern = template.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
    // 保留 {} 用于变量匹配
    if (match === '{' || match === '}') return match;
    return '\\' + match;
  });

  regexPattern = regexPattern.replace(variablePattern, (match, varName) => {
    variables.push(varName);
    return '([^/?#]+)'; // 匹配除路径分隔符外的任何字符
  });

  const regex = new RegExp('^' + regexPattern + '$');
  const match = uri.match(regex);

  if (!match) {
    return null;
  }

  // 提取变量值
  const result: Record<string, string> = {};
  variables.forEach((varName, index) => {
    result[varName] = match[index + 1];
  });

  return result;
}

// ============ MCP 资源管理器 ============

/**
 * MCP 资源管理器
 * 管理 MCP 资源的发现、读取、缓存和订阅
 */
export class McpResourceManager {
  private connectionManager: McpConnectionManager;
  private cache: Map<string, CacheEntry>;
  private defaultTTL: number;
  private subscriptions: Map<string, Subscription>;
  private subscriptionId: number;
  private eventEmitter: EventEmitter;

  constructor(connectionManager: McpConnectionManager, defaultTTL = 60000) {
    this.connectionManager = connectionManager;
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.subscriptions = new Map();
    this.subscriptionId = 0;
    this.eventEmitter = new EventEmitter();
  }

  // ============ 资源发现 ============

  /**
   * 列出服务器的所有资源
   */
  async listResources(serverName: string): Promise<McpResource[]> {
    if (!this.connectionManager.isConnected(serverName)) {
      const connected = await this.connectionManager.connect(serverName);
      if (!connected) {
        throw new Error(`Failed to connect to MCP server: ${serverName}`);
      }
    }

    const result = await this.connectionManager.sendMessage(
      serverName,
      'resources/list',
      {}
    );

    if (!result) {
      return [];
    }

    const response = result as { resources?: McpResource[] };
    return response.resources || [];
  }

  /**
   * 列出服务器的资源模板
   */
  async listResourceTemplates(serverName: string): Promise<ResourceTemplate[]> {
    if (!this.connectionManager.isConnected(serverName)) {
      const connected = await this.connectionManager.connect(serverName);
      if (!connected) {
        throw new Error(`Failed to connect to MCP server: ${serverName}`);
      }
    }

    const result = await this.connectionManager.sendMessage(
      serverName,
      'resources/templates/list',
      {}
    );

    if (!result) {
      return [];
    }

    const response = result as { resourceTemplates?: ResourceTemplate[] };
    return response.resourceTemplates || [];
  }

  // ============ 资源读取 ============

  /**
   * 读取资源内容（同步方式）
   */
  async readResource(serverName: string, uri: string): Promise<ResourceContent> {
    // 检查缓存
    const cached = this.getCached(uri);
    if (cached) {
      return cached;
    }

    if (!this.connectionManager.isConnected(serverName)) {
      const connected = await this.connectionManager.connect(serverName);
      if (!connected) {
        throw new Error(`Failed to connect to MCP server: ${serverName}`);
      }
    }

    const result = await this.connectionManager.sendMessage(
      serverName,
      'resources/read',
      { uri }
    );

    if (!result) {
      throw new Error(`Failed to read resource: ${uri}`);
    }

    const response = result as {
      contents?: Array<{
        uri: string;
        text?: string;
        blob?: string;
        mimeType?: string;
      }>;
    };

    if (!response.contents || response.contents.length === 0) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const content = response.contents[0];
    const resourceContent: ResourceContent = {
      uri: content.uri,
      mimeType: content.mimeType || 'application/octet-stream',
      text: content.text,
      blob: content.blob ? this.base64ToUint8Array(content.blob) : undefined,
    };

    // 缓存结果
    this.cache.set(uri, {
      content: resourceContent,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    });

    return resourceContent;
  }

  /**
   * 流式读取资源内容
   * 支持大文件分块读取
   */
  async *readResourceStream(
    serverName: string,
    uri: string
  ): AsyncGenerator<ResourceContent> {
    if (!this.connectionManager.isConnected(serverName)) {
      const connected = await this.connectionManager.connect(serverName);
      if (!connected) {
        throw new Error(`Failed to connect to MCP server: ${serverName}`);
      }
    }

    // 检查服务器是否支持流式读取
    const result = await this.connectionManager.sendMessage(
      serverName,
      'resources/read',
      { uri, stream: true }
    );

    if (!result) {
      throw new Error(`Failed to read resource: ${uri}`);
    }

    const response = result as {
      contents?: Array<{
        uri: string;
        text?: string;
        blob?: string;
        mimeType?: string;
      }>;
      streaming?: boolean;
    };

    if (!response.contents) {
      throw new Error(`Resource not found: ${uri}`);
    }

    // 如果不支持流式读取，一次性返回所有内容
    if (!response.streaming) {
      for (const content of response.contents) {
        yield {
          uri: content.uri,
          mimeType: content.mimeType || 'application/octet-stream',
          text: content.text,
          blob: content.blob ? this.base64ToUint8Array(content.blob) : undefined,
        };
      }
      return;
    }

    // 流式读取（如果服务器支持）
    // 这里简化实现，实际应该使用 streaming API
    for (const content of response.contents) {
      yield {
        uri: content.uri,
        mimeType: content.mimeType || 'application/octet-stream',
        text: content.text,
        blob: content.blob ? this.base64ToUint8Array(content.blob) : undefined,
      };
    }
  }

  // ============ 缓存管理 ============

  /**
   * 获取缓存的资源内容
   */
  getCached(uri: string): ResourceContent | null {
    const entry = this.cache.get(uri);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // 缓存已过期
      this.cache.delete(uri);
      return null;
    }

    return entry.content;
  }

  /**
   * 使指定 URI 的缓存失效
   */
  invalidateCache(uri: string): void {
    this.cache.delete(uri);
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 设置默认缓存 TTL
   */
  setCacheTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ uri: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([uri, entry]) => ({
      uri,
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  // ============ 资源订阅 ============

  /**
   * 订阅资源变更通知
   */
  async subscribe(
    serverName: string,
    uri: string,
    callback: ResourceCallback
  ): Promise<Subscription> {
    if (!this.connectionManager.isConnected(serverName)) {
      const connected = await this.connectionManager.connect(serverName);
      if (!connected) {
        throw new Error(`Failed to connect to MCP server: ${serverName}`);
      }
    }

    // 创建订阅 ID
    const id = `sub_${++this.subscriptionId}`;

    // 向服务器发送订阅请求
    try {
      await this.connectionManager.sendMessage(serverName, 'resources/subscribe', {
        uri,
      });
    } catch (err) {
      // 如果服务器不支持订阅，我们仍然创建本地订阅
      console.warn(`Server ${serverName} may not support resource subscriptions:`, err);
    }

    // 创建订阅对象
    const subscription: Subscription = {
      id,
      serverName,
      uri,
      callback,
      unsubscribe: () => this.unsubscribe(subscription),
    };

    this.subscriptions.set(id, subscription);

    // 监听资源变更事件
    const eventKey = `${serverName}:${uri}`;
    this.eventEmitter.on(eventKey, callback);

    return subscription;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscription: Subscription): void {
    const { id, serverName, uri, callback } = subscription;

    // 从本地移除订阅
    this.subscriptions.delete(id);

    // 移除事件监听
    const eventKey = `${serverName}:${uri}`;
    this.eventEmitter.removeListener(eventKey, callback);

    // 通知服务器取消订阅
    if (this.connectionManager.isConnected(serverName)) {
      this.connectionManager
        .sendMessage(serverName, 'resources/unsubscribe', { uri })
        .catch((err) => {
          console.warn(`Failed to unsubscribe from ${uri}:`, err);
        });
    }
  }

  /**
   * 处理资源变更通知（从 MCP 服务器接收）
   * 这个方法应该由连接管理器在收到 resources/updated 通知时调用
   */
  handleResourceUpdate(serverName: string, uri: string, content: ResourceContent): void {
    // 使缓存失效
    this.invalidateCache(uri);

    // 触发订阅回调
    const eventKey = `${serverName}:${uri}`;
    this.eventEmitter.emit(eventKey, content);
  }

  /**
   * 获取所有活动订阅
   */
  getActiveSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    const subscriptions = Array.from(this.subscriptions.values());
    subscriptions.forEach((sub) => this.unsubscribe(sub));
  }

  // ============ 辅助方法 ============

  /**
   * 将 Base64 字符串转换为 Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 将 Uint8Array 转换为 Base64 字符串
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  /**
   * 检查 URI 是否匹配某个模板
   */
  matchesTemplate(uri: string, template: ResourceTemplate): Record<string, string> | null {
    return matchResourceTemplate(uri, template.uriTemplate);
  }

  /**
   * 根据模板和参数构建 URI
   */
  buildUriFromTemplate(
    template: ResourceTemplate,
    params: Record<string, string>
  ): string {
    let uri = template.uriTemplate;
    Object.entries(params).forEach(([key, value]) => {
      uri = uri.replace(`{${key}}`, encodeURIComponent(value));
    });
    return uri;
  }

  /**
   * 预加载资源到缓存
   */
  async preloadResources(
    serverName: string,
    uris: string[]
  ): Promise<Array<{ uri: string; success: boolean; error?: string }>> {
    const results = await Promise.allSettled(
      uris.map((uri) => this.readResource(serverName, uri))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { uri: uris[index], success: true };
      } else {
        return {
          uri: uris[index],
          success: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });
  }

  /**
   * 批量读取资源
   */
  async readResourcesBatch(
    serverName: string,
    uris: string[]
  ): Promise<Map<string, ResourceContent>> {
    const results = new Map<string, ResourceContent>();

    await Promise.all(
      uris.map(async (uri) => {
        try {
          const content = await this.readResource(serverName, uri);
          results.set(uri, content);
        } catch (err) {
          console.error(`Failed to read resource ${uri}:`, err);
        }
      })
    );

    return results;
  }

  /**
   * 刷新缓存（重新读取资源）
   */
  async refreshCache(serverName: string, uri: string): Promise<ResourceContent> {
    this.invalidateCache(uri);
    return this.readResource(serverName, uri);
  }
}

/**
 * 创建简化的连接管理器适配器
 * 用于从现有的 MCP 工具适配到 McpResourceManager
 */
export function createConnectionManagerAdapter(options: {
  sendMessage: (serverName: string, method: string, params: unknown) => Promise<unknown | null>;
  isConnected: (serverName: string) => boolean;
  connect: (serverName: string) => Promise<boolean>;
  getServerNames: () => string[];
}): McpConnectionManager {
  return {
    sendMessage: options.sendMessage,
    isConnected: options.isConnected,
    connect: options.connect,
    getServerNames: options.getServerNames,
  };
}
