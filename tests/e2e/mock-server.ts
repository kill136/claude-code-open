/**
 * Mock API 服务器
 * 模拟 Anthropic API 用于 E2E 测试
 */

import * as http from 'http';
import { URL } from 'url';

export interface MockResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  } | {
    type: 'tool_use';
    id: string;
    name: string;
    input: any;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface MockServerOptions {
  /** 服务器端口（0 表示随机端口） */
  port?: number;
  /** 默认响应延迟（毫秒） */
  delay?: number;
  /** 是否记录请求日志 */
  logRequests?: boolean;
}

export class MockApiServer {
  private server: http.Server | null = null;
  public port: number;
  private delay: number;
  private logRequests: boolean;
  private requestCount = 0;
  private requests: any[] = [];

  // 自定义响应处理器
  private responseHandlers: Map<string, (req: any) => MockResponse | Promise<MockResponse>> = new Map();

  constructor(options: MockServerOptions = {}) {
    this.port = options.port || 0;
    this.delay = options.delay || 0;
    this.logRequests = options.logRequests || false;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        const address = this.server!.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
        }
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  /**
   * 处理请求
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // 添加延迟
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // 读取请求体
    const body = await this.readRequestBody(req);
    let requestData: any = {};

    try {
      if (body) {
        requestData = JSON.parse(body);
      }
    } catch {
      // 忽略解析错误
    }

    // 记录请求
    this.requestCount++;
    const requestLog = {
      index: this.requestCount,
      method: req.method,
      path,
      headers: req.headers,
      body: requestData,
      timestamp: new Date().toISOString()
    };
    this.requests.push(requestLog);

    if (this.logRequests) {
      console.log(`[Mock API] ${req.method} ${path}`, requestData);
    }

    // 路由请求
    if (path === '/v1/messages' && req.method === 'POST') {
      await this.handleMessagesRequest(requestData, res);
    } else if (path === '/v1/models' && req.method === 'GET') {
      await this.handleModelsRequest(res);
    } else {
      this.sendError(res, 404, 'Not Found');
    }
  }

  /**
   * 处理消息 API 请求
   */
  private async handleMessagesRequest(requestData: any, res: http.ServerResponse): Promise<void> {
    // 检查是否有自定义处理器
    if (this.responseHandlers.has('messages')) {
      const handler = this.responseHandlers.get('messages')!;
      const response = await handler(requestData);
      this.sendJson(res, response);
      return;
    }

    // 生成默认响应
    const response = this.generateDefaultResponse(requestData);
    this.sendJson(res, response);
  }

  /**
   * 处理模型列表请求
   */
  private async handleModelsRequest(res: http.ServerResponse): Promise<void> {
    const models = {
      data: [
        { id: 'claude-opus-4-5-20251101', type: 'model' },
        { id: 'claude-3-5-sonnet-20241022', type: 'model' },
        { id: 'claude-3-5-haiku-20241022', type: 'model' }
      ]
    };
    this.sendJson(res, models);
  }

  /**
   * 生成默认响应
   */
  private generateDefaultResponse(requestData: any): MockResponse {
    const messages = requestData.messages || [];
    const lastMessage = messages[messages.length - 1];
    const userPrompt = lastMessage?.content || 'Hello';

    // 检查是否请求工具使用
    const tools = requestData.tools || [];
    const shouldUseTool = tools.length > 0 && Math.random() > 0.5;

    const content: any[] = [];

    if (shouldUseTool) {
      // 随机选择一个工具
      const tool = tools[Math.floor(Math.random() * tools.length)];
      content.push({
        type: 'text',
        text: `我将使用 ${tool.name} 工具来帮助你。`
      });
      content.push({
        type: 'tool_use',
        id: `toolu_${Date.now()}`,
        name: tool.name,
        input: this.generateToolInput(tool)
      });
    } else {
      content.push({
        type: 'text',
        text: `这是对 "${userPrompt}" 的模拟响应。`
      });
    }

    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content,
      model: requestData.model || 'claude-3-5-sonnet-20241022',
      stop_reason: shouldUseTool ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    };
  }

  /**
   * 生成工具输入
   */
  private generateToolInput(tool: any): any {
    // 根据工具 schema 生成合理的输入
    const inputSchema = tool.input_schema || { properties: {} };
    const input: any = {};

    for (const [key, schema] of Object.entries(inputSchema.properties || {})) {
      const propSchema = schema as any;
      if (propSchema.type === 'string') {
        input[key] = 'test-value';
      } else if (propSchema.type === 'number') {
        input[key] = 42;
      } else if (propSchema.type === 'boolean') {
        input[key] = true;
      }
    }

    return input;
  }

  /**
   * 设置自定义响应处理器
   */
  setResponseHandler(
    endpoint: string,
    handler: (req: any) => MockResponse | Promise<MockResponse>
  ): void {
    this.responseHandlers.set(endpoint, handler);
  }

  /**
   * 设置简单文本响应
   */
  setTextResponse(text: string): void {
    this.setResponseHandler('messages', () => ({
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 }
    }));
  }

  /**
   * 设置工具使用响应
   */
  setToolUseResponse(toolName: string, toolInput: any, responseText?: string): void {
    this.setResponseHandler('messages', () => {
      const content: any[] = [];

      if (responseText) {
        content.push({ type: 'text', text: responseText });
      }

      content.push({
        type: 'tool_use',
        id: `toolu_${Date.now()}`,
        name: toolName,
        input: toolInput
      });

      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content,
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 }
      };
    });
  }

  /**
   * 清除响应处理器
   */
  clearResponseHandlers(): void {
    this.responseHandlers.clear();
  }

  /**
   * 获取请求历史
   */
  getRequests(): any[] {
    return [...this.requests];
  }

  /**
   * 获取最后一个请求
   */
  getLastRequest(): any {
    return this.requests[this.requests.length - 1];
  }

  /**
   * 清除请求历史
   */
  clearRequests(): void {
    this.requests = [];
    this.requestCount = 0;
  }

  /**
   * 读取请求体
   */
  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
    });
  }

  /**
   * 发送 JSON 响应
   */
  private sendJson(res: http.ServerResponse, data: any): void {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  }

  /**
   * 发送错误响应
   */
  private sendError(res: http.ServerResponse, status: number, message: string): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message
      }
    }));
  }
}
