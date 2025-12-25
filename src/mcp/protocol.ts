/**
 * MCP (Model Context Protocol) 协议实现
 *
 * 基于 MCP 规范 2024-11-05 版本
 * 使用 JSON-RPC 2.0 作为消息格式
 *
 * 参考:
 * - https://spec.modelcontextprotocol.io/
 * - https://www.jsonrpc.org/specification
 */

// ============ JSON-RPC 2.0 类型定义 ============

/**
 * JSON-RPC 2.0 请求
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 响应
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 通知 (无需响应的单向消息)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 错误对象
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 消息类型联合
 */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ============ JSON-RPC 标准错误代码 ============

export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  // 自定义错误代码范围: -32000 to -32099
  ServerError = -32000,
}

// ============ MCP 协议类型定义 ============

/**
 * 客户端信息
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * 服务器信息
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * 客户端能力
 */
export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  sampling?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
}

/**
 * 服务器能力
 */
export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

/**
 * Initialize 方法参数
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

/**
 * Initialize 方法结果
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
  instructions?: string;
}

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * 工具调用参数
 */
export interface ToolCallParams {
  name: string;
  arguments?: unknown;
}

/**
 * 工具调用结果
 */
export interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

/**
 * 资源定义
 */
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

/**
 * 资源内容
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * 提示词定义
 */
export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * 提示词获取参数
 */
export interface PromptGetParams {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * 提示词内容
 */
export interface PromptContent {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: string;
      text?: string;
      [key: string]: unknown;
    };
  }>;
}

// ============ 消息验证结果 ============

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// ============ MCP 传输层接口 ============

/**
 * MCP 传输层抽象接口
 */
export interface McpTransport {
  send(message: JsonRpcMessage): Promise<void>;
  receive(): Promise<JsonRpcMessage>;
  close(): Promise<void>;
}

// ============ MCP 协议常量 ============

/**
 * MCP 协议版本
 */
export const MCP_VERSION = '2024-11-05';

/**
 * 支持的协议版本列表
 */
export const SUPPORTED_VERSIONS = ['2024-11-05'];

/**
 * MCP 协议方法名
 */
export enum McpMethod {
  // 生命周期方法
  Initialize = 'initialize',
  Initialized = 'initialized',
  Shutdown = 'shutdown',

  // Ping
  Ping = 'ping',

  // 工具方法
  ToolsList = 'tools/list',
  ToolsCall = 'tools/call',

  // 资源方法
  ResourcesList = 'resources/list',
  ResourcesRead = 'resources/read',
  ResourcesSubscribe = 'resources/subscribe',
  ResourcesUnsubscribe = 'resources/unsubscribe',

  // 提示词方法
  PromptsList = 'prompts/list',
  PromptsGet = 'prompts/get',

  // 日志方法
  LoggingSetLevel = 'logging/setLevel',

  // 补全方法
  CompletionComplete = 'completion/complete',
}

// ============ MCP 协议类 ============

/**
 * MCP 协议处理器
 *
 * 负责:
 * - JSON-RPC 消息的构建和解析
 * - 协议握手和版本协商
 * - 消息验证
 * - ID 生成和管理
 */
export class McpProtocol {
  private nextId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }> = new Map();

  private requestTimeout: number = 30000; // 30秒超时

  constructor(options?: { requestTimeout?: number }) {
    if (options?.requestTimeout) {
      this.requestTimeout = options.requestTimeout;
    }
  }

  // ============ ID 管理 ============

  /**
   * 生成唯一的请求 ID
   */
  generateId(): string {
    return `mcp-${Date.now()}-${this.nextId++}`;
  }

  // ============ 消息构建 ============

  /**
   * 创建 JSON-RPC 请求
   */
  createRequest(method: string, params?: unknown): JsonRpcRequest {
    const id = this.generateId();
    return {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined && { params }),
    };
  }

  /**
   * 创建 JSON-RPC 通知
   */
  createNotification(method: string, params?: unknown): JsonRpcNotification {
    return {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    };
  }

  /**
   * 创建成功响应
   */
  createResponse(id: string | number, result: unknown): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * 创建错误响应
   */
  createErrorResponse(
    id: string | number,
    error: JsonRpcError
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }

  /**
   * 创建标准错误对象
   */
  createError(
    code: JsonRpcErrorCode | number,
    message: string,
    data?: unknown
  ): JsonRpcError {
    return {
      code,
      message,
      ...(data !== undefined && { data }),
    };
  }

  // ============ 消息解析和验证 ============

  /**
   * 解析 JSON-RPC 消息
   */
  parseMessage(data: string): JsonRpcMessage {
    try {
      const parsed = JSON.parse(data);
      const validation = this.validateMessage(parsed);

      if (!validation.valid) {
        throw new Error(`Invalid JSON-RPC message: ${validation.errors?.join(', ')}`);
      }

      return parsed as JsonRpcMessage;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON');
      }
      throw error;
    }
  }

  /**
   * 验证消息格式
   */
  validateMessage(message: unknown): ValidationResult {
    const errors: string[] = [];

    if (!message || typeof message !== 'object') {
      return { valid: false, errors: ['Message must be an object'] };
    }

    const msg = message as Record<string, unknown>;

    // 检查 jsonrpc 版本
    if (msg.jsonrpc !== '2.0') {
      errors.push('jsonrpc field must be "2.0"');
    }

    // 检查是否是请求、响应或通知
    const hasId = 'id' in msg;
    const hasMethod = 'method' in msg;
    const hasResult = 'result' in msg;
    const hasError = 'error' in msg;

    if (hasMethod) {
      // 请求或通知
      if (typeof msg.method !== 'string') {
        errors.push('method must be a string');
      }

      if (hasId) {
        // 请求: ID 不能为 null
        if (msg.id === null) {
          errors.push('Request ID must not be null');
        }
        if (typeof msg.id !== 'string' && typeof msg.id !== 'number') {
          errors.push('Request ID must be a string or number');
        }
      }
    } else if (hasId) {
      // 响应
      if (!hasResult && !hasError) {
        errors.push('Response must have either result or error');
      }
      if (hasResult && hasError) {
        errors.push('Response must not have both result and error');
      }
    } else {
      errors.push('Message must have either method or id field');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============ 请求/响应匹配 ============

  /**
   * 发送请求并等待响应
   */
  async sendRequest(
    transport: McpTransport,
    method: string,
    params?: unknown
  ): Promise<unknown> {
    const request = this.createRequest(method, params);

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request ${request.id} timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      // 保存待处理的请求
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout,
      });

      // 发送请求
      transport.send(request).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);
        reject(error);
      });
    });
  }

  /**
   * 处理收到的响应
   */
  handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      console.warn(`Received response for unknown request ID: ${response.id}`);
      return;
    }

    // 清理
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingRequests.delete(response.id);

    // 处理结果或错误
    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * 发送通知 (不等待响应)
   */
  async sendNotification(
    transport: McpTransport,
    method: string,
    params?: unknown
  ): Promise<void> {
    const notification = this.createNotification(method, params);
    await transport.send(notification);
  }

  // ============ MCP 协议方法 ============

  /**
   * Initialize - 初始化协议握手
   */
  async initialize(
    transport: McpTransport,
    params: InitializeParams
  ): Promise<InitializeResult> {
    // 验证协议版本
    if (!SUPPORTED_VERSIONS.includes(params.protocolVersion)) {
      throw new Error(
        `Unsupported protocol version: ${params.protocolVersion}. ` +
        `Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
      );
    }

    const result = await this.sendRequest(
      transport,
      McpMethod.Initialize,
      params
    );

    return result as InitializeResult;
  }

  /**
   * Initialized - 发送初始化完成通知
   */
  async initialized(transport: McpTransport): Promise<void> {
    await this.sendNotification(transport, McpMethod.Initialized);
  }

  /**
   * Ping - 检查连接
   */
  async ping(transport: McpTransport): Promise<void> {
    await this.sendRequest(transport, McpMethod.Ping);
  }

  /**
   * Tools/List - 获取可用工具列表
   */
  async listTools(transport: McpTransport): Promise<Tool[]> {
    const result = await this.sendRequest(transport, McpMethod.ToolsList);

    if (!result || typeof result !== 'object') {
      return [];
    }

    const data = result as { tools?: Tool[] };
    return data.tools || [];
  }

  /**
   * Tools/Call - 调用工具
   */
  async callTool(
    transport: McpTransport,
    name: string,
    args?: unknown
  ): Promise<ToolResult> {
    const params: ToolCallParams = {
      name,
      ...(args !== undefined && { arguments: args }),
    };

    const result = await this.sendRequest(transport, McpMethod.ToolsCall, params);
    return result as ToolResult;
  }

  /**
   * Resources/List - 获取资源列表
   */
  async listResources(transport: McpTransport): Promise<Resource[]> {
    const result = await this.sendRequest(transport, McpMethod.ResourcesList);

    if (!result || typeof result !== 'object') {
      return [];
    }

    const data = result as { resources?: Resource[] };
    return data.resources || [];
  }

  /**
   * Resources/Read - 读取资源内容
   */
  async readResource(
    transport: McpTransport,
    uri: string
  ): Promise<ResourceContent> {
    const result = await this.sendRequest(transport, McpMethod.ResourcesRead, {
      uri,
    });

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid resource content response');
    }

    const data = result as { contents?: ResourceContent[] };
    if (!data.contents || data.contents.length === 0) {
      throw new Error('No resource content returned');
    }

    return data.contents[0];
  }

  /**
   * Resources/Subscribe - 订阅资源变更
   */
  async subscribeResource(
    transport: McpTransport,
    uri: string
  ): Promise<void> {
    await this.sendRequest(transport, McpMethod.ResourcesSubscribe, { uri });
  }

  /**
   * Resources/Unsubscribe - 取消订阅资源变更
   */
  async unsubscribeResource(
    transport: McpTransport,
    uri: string
  ): Promise<void> {
    await this.sendRequest(transport, McpMethod.ResourcesUnsubscribe, { uri });
  }

  /**
   * Prompts/List - 获取提示词列表
   */
  async listPrompts(transport: McpTransport): Promise<Prompt[]> {
    const result = await this.sendRequest(transport, McpMethod.PromptsList);

    if (!result || typeof result !== 'object') {
      return [];
    }

    const data = result as { prompts?: Prompt[] };
    return data.prompts || [];
  }

  /**
   * Prompts/Get - 获取提示词内容
   */
  async getPrompt(
    transport: McpTransport,
    params: PromptGetParams
  ): Promise<PromptContent> {
    const result = await this.sendRequest(transport, McpMethod.PromptsGet, params);
    return result as PromptContent;
  }

  /**
   * Shutdown - 关闭连接
   */
  async shutdown(transport: McpTransport): Promise<void> {
    await this.sendRequest(transport, McpMethod.Shutdown);
  }

  /**
   * 设置请求超时时间
   */
  setRequestTimeout(timeout: number): void {
    this.requestTimeout = timeout;
  }

  /**
   * 清理所有待处理的请求
   */
  cleanup(): void {
    this.pendingRequests.forEach((pending, id) => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Protocol cleanup - request cancelled'));
    });
    this.pendingRequests.clear();
  }
}

// ============ 辅助函数 ============

/**
 * 检查是否为 JSON-RPC 请求
 */
export function isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return 'method' in message && 'id' in message;
}

/**
 * 检查是否为 JSON-RPC 响应
 */
export function isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
  return 'id' in message && !('method' in message);
}

/**
 * 检查是否为 JSON-RPC 通知
 */
export function isNotification(message: JsonRpcMessage): message is JsonRpcNotification {
  return 'method' in message && !('id' in message);
}

/**
 * 创建标准的协议握手参数
 */
export function createInitializeParams(
  clientInfo: ClientInfo,
  capabilities?: ClientCapabilities
): InitializeParams {
  return {
    protocolVersion: MCP_VERSION,
    clientInfo,
    capabilities: capabilities || {},
  };
}

/**
 * 验证协议版本兼容性
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * 格式化错误消息
 */
export function formatError(error: JsonRpcError): string {
  let message = `[${error.code}] ${error.message}`;
  if (error.data) {
    message += `\nData: ${JSON.stringify(error.data, null, 2)}`;
  }
  return message;
}
