/**
 * MCP (Model Context Protocol) 工具
 * 支持连接和调用 MCP 服务器
 */

import { spawn, ChildProcess } from 'child_process';
import { BaseTool } from './base.js';
import type {
  McpInput,
  ListMcpResourcesInput,
  ReadMcpResourceInput,
  MCPSearchInput,
  McpServerConfig,
  ToolResult,
  ToolDefinition,
} from '../types/index.js';
import type { MCPSearchToolResult } from '../types/results.js';

// MCP 服务器状态管理
interface McpServerState {
  config: McpServerConfig;
  process?: ChildProcess;
  connected: boolean;
  connecting: boolean;
  lastConnectAttempt?: number;
  reconnectAttempts: number;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  tools: McpToolDefinition[];
  resources: McpResource[];
  resourcesCache?: {
    data: McpResource[];
    timestamp: number;
  };
  lastHealthCheck?: number;
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

const mcpServers: Map<string, McpServerState> = new Map();
let messageId = 1;

// 配置常量
const MCP_TIMEOUT = parseInt(process.env.MCP_TIMEOUT || '30000', 10); // 默认 30 秒超时
const RESOURCE_CACHE_TTL = 60000; // 资源缓存 1 分钟
const HEALTH_CHECK_INTERVAL = 30000; // 健康检查间隔 30 秒
const MAX_RECONNECT_ATTEMPTS = 3; // 最大重连次数
const RECONNECT_DELAY_BASE = 1000; // 重连延迟基数（毫秒）

/**
 * 注册 MCP 服务器配置
 */
export function registerMcpServer(name: string, config: McpServerConfig): void {
  mcpServers.set(name, {
    config,
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
    capabilities: {},
    tools: [],
    resources: [],
  });
}

/**
 * 获取所有已注册的 MCP 服务器
 */
export function getMcpServers(): Map<string, McpServerState> {
  return mcpServers;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 断开 MCP 服务器连接
 */
async function disconnectMcpServer(name: string): Promise<void> {
  const server = mcpServers.get(name);
  if (!server) return;

  if (server.process) {
    try {
      server.process.kill();
      server.process = undefined;
    } catch (err) {
      console.error(`Failed to kill MCP server process ${name}:`, err);
    }
  }

  server.connected = false;
  server.connecting = false;
  server.reconnectAttempts = 0;
}

/**
 * 检查服务器健康状态
 */
async function checkServerHealth(name: string): Promise<boolean> {
  const server = mcpServers.get(name);
  if (!server || !server.connected) return false;

  const now = Date.now();
  if (server.lastHealthCheck && now - server.lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return true; // 最近检查过，认为是健康的
  }

  try {
    // 发送 ping 请求（如果服务器支持）
    const result = await sendMcpMessage(name, 'ping', {});
    server.lastHealthCheck = now;
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * 连接到 MCP 服务器（带重试机制）
 */
async function connectMcpServer(name: string, retry = true): Promise<boolean> {
  const server = mcpServers.get(name);
  if (!server) return false;

  // 如果已连接且健康，直接返回
  if (server.connected && server.process) {
    const healthy = await checkServerHealth(name);
    if (healthy) return true;

    // 不健康，需要重连
    await disconnectMcpServer(name);
  }

  // 防止并发连接
  if (server.connecting) {
    // 等待连接完成
    const maxWait = 10000; // 最多等待 10 秒
    const startTime = Date.now();
    while (server.connecting && Date.now() - startTime < maxWait) {
      await sleep(100);
    }
    return server.connected;
  }

  server.connecting = true;
  server.lastConnectAttempt = Date.now();

  const { config } = server;

  if (config.type === 'stdio' && config.command) {
    let attempt = 0;
    const maxAttempts = retry ? MAX_RECONNECT_ATTEMPTS : 1;

    while (attempt < maxAttempts) {
      try {
        // 如果不是第一次尝试，等待一段时间（指数退避）
        if (attempt > 0) {
          const delay = RECONNECT_DELAY_BASE * Math.pow(2, attempt - 1);
          console.log(`Retrying connection to ${name} in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})...`);
          await sleep(delay);
        }

        const proc = spawn(config.command, config.args || [], {
          env: { ...process.env, ...config.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        server.process = proc;

        // 监听进程错误和退出
        proc.on('error', (err) => {
          console.error(`MCP server ${name} process error:`, err);
          server.connected = false;
          server.connecting = false;
        });

        proc.on('exit', (code) => {
          console.log(`MCP server ${name} exited with code ${code}`);
          server.connected = false;
          server.connecting = false;
          server.process = undefined;
        });

        // 发送初始化消息
        const initResult = await sendMcpMessage(name, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'claude-code-restored',
            version: '2.0.76',
          },
        });

        if (initResult) {
          server.connected = true;
          server.connecting = false;
          server.reconnectAttempts = 0;
          const initResponse = initResult as { capabilities?: { tools?: boolean; resources?: boolean; prompts?: boolean } };
          server.capabilities = initResponse.capabilities || {};

          // 发送 initialized 通知
          await sendMcpNotification(name, 'notifications/initialized', {});

          // 获取工具列表
          if (server.capabilities.tools) {
            const toolsResult = await sendMcpMessage(name, 'tools/list', {}) as { tools?: McpToolDefinition[] } | null;
            if (toolsResult?.tools) {
              server.tools = toolsResult.tools;
            }
          }

          // 获取资源列表（使用缓存）
          if (server.capabilities.resources) {
            await refreshResourceCache(name);
          }

          console.log(`Successfully connected to MCP server: ${name}`);
          return true;
        }

        // 初始化失败，清理进程
        if (server.process) {
          server.process.kill();
          server.process = undefined;
        }
      } catch (err) {
        console.error(`Failed to connect to MCP server ${name} (attempt ${attempt + 1}/${maxAttempts}):`, err);

        // 清理失败的进程
        if (server.process) {
          try {
            server.process.kill();
          } catch {}
          server.process = undefined;
        }
      }

      attempt++;
      server.reconnectAttempts = attempt;
    }
  }

  server.connecting = false;
  return false;
}

/**
 * 刷新资源缓存
 */
async function refreshResourceCache(name: string): Promise<boolean> {
  const server = mcpServers.get(name);
  if (!server) return false;

  try {
    const resourcesResult = await sendMcpMessage(name, 'resources/list', {}) as { resources?: McpResource[] } | null;
    if (resourcesResult?.resources) {
      server.resources = resourcesResult.resources;
      server.resourcesCache = {
        data: resourcesResult.resources,
        timestamp: Date.now(),
      };
      return true;
    }
  } catch (err) {
    console.error(`Failed to refresh resource cache for ${name}:`, err);
  }

  return false;
}

/**
 * 获取资源列表（带缓存）
 */
async function getResources(name: string, forceRefresh = false): Promise<McpResource[]> {
  const server = mcpServers.get(name);
  if (!server) return [];

  // 检查缓存是否有效
  if (!forceRefresh && server.resourcesCache) {
    const cacheAge = Date.now() - server.resourcesCache.timestamp;
    if (cacheAge < RESOURCE_CACHE_TTL) {
      return server.resourcesCache.data;
    }
  }

  // 刷新缓存
  await refreshResourceCache(name);
  return server.resources;
}

/**
 * 发送 MCP 消息并等待响应（带重试机制）
 */
async function sendMcpMessage(
  serverName: string,
  method: string,
  params: unknown,
  timeout = MCP_TIMEOUT,
  retries = 2
): Promise<unknown | null> {
  const server = mcpServers.get(serverName);
  if (!server?.process?.stdin || !server.process.stdout) {
    return null;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const id = messageId++;
      const message: McpMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const result = await new Promise<unknown | null>((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          reject(new Error(`Timeout waiting for response to ${method}`));
        }, timeout);

        const onData = (data: Buffer) => {
          try {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              const response: McpMessage = JSON.parse(line);
              if (response.id === id) {
                clearTimeout(timeoutHandle);
                server.process?.stdout?.removeListener('data', onData);

                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
                return;
              }
            }
          } catch (err) {
            // Ignore parse errors for partial messages
          }
        };

        server.process!.stdout!.on('data', onData);

        try {
          server.process!.stdin!.write(JSON.stringify(message) + '\n');
        } catch (err) {
          clearTimeout(timeoutHandle);
          server.process?.stdout?.removeListener('data', onData);
          reject(err);
        }
      });

      return result;
    } catch (err) {
      lastError = err as Error;
      console.error(`MCP message ${method} failed (attempt ${attempt + 1}/${retries + 1}):`, err);

      // 如果不是最后一次尝试，等待一小段时间再重试
      if (attempt < retries) {
        await sleep(500 * Math.pow(2, attempt));
      }
    }
  }

  // 所有重试都失败了
  if (lastError) {
    console.error(`All retries failed for MCP message ${method}:`, lastError);
  }

  return null;
}

/**
 * 发送 MCP 通知（无响应）
 */
async function sendMcpNotification(
  serverName: string,
  method: string,
  params: unknown
): Promise<void> {
  const server = mcpServers.get(serverName);
  if (!server?.process?.stdin) {
    return;
  }

  const message: McpMessage = {
    jsonrpc: '2.0',
    method,
    params,
  };

  server.process.stdin.write(JSON.stringify(message) + '\n');
}

/**
 * 调用 MCP 工具（带重试和错误处理）
 */
export async function callMcpTool(
  serverName: string,
  toolName: string,
  args: unknown
): Promise<ToolResult> {
  const server = mcpServers.get(serverName);
  if (!server) {
    return {
      success: false,
      error: `MCP server not found: ${serverName}. Available servers: ${Array.from(mcpServers.keys()).join(', ') || 'none'}`
    };
  }

  // 确保连接
  if (!server.connected) {
    const connected = await connectMcpServer(serverName);
    if (!connected) {
      return {
        success: false,
        error: `Failed to connect to MCP server: ${serverName}. Please check server configuration.`
      };
    }
  }

  // 检查服务器是否支持工具
  if (!server.capabilities.tools) {
    return {
      success: false,
      error: `MCP server ${serverName} does not support tools.`
    };
  }

  // 验证工具是否存在
  const toolExists = server.tools.some((t) => t.name === toolName);
  if (!toolExists) {
    return {
      success: false,
      error: `Tool not found: ${toolName}. Available tools: ${server.tools.map((t) => t.name).join(', ') || 'none'}`
    };
  }

  try {
    // 调用工具，带重试
    const result = await sendMcpMessage(serverName, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    if (!result) {
      return {
        success: false,
        error: `MCP tool call failed: ${toolName}. Server did not respond or returned an error.`
      };
    }

    // 解析结果
    const content = (result as { content?: Array<{ type: string; text?: string; image?: string }> }).content;
    if (content && Array.isArray(content)) {
      const textContent = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n');

      return { success: true, output: textContent || JSON.stringify(result) };
    }

    return { success: true, output: JSON.stringify(result, null, 2) };
  } catch (err) {
    return {
      success: false,
      error: `Error calling MCP tool: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}

/**
 * 断开所有 MCP 服务器
 */
export async function disconnectAllMcpServers(): Promise<void> {
  for (const name of mcpServers.keys()) {
    await disconnectMcpServer(name);
  }
}

/**
 * 获取服务器连接状态
 */
export function getServerStatus(name: string): {
  connected: boolean;
  connecting: boolean;
  capabilities: string[];
  toolCount: number;
  resourceCount: number;
  lastConnectAttempt?: number;
  reconnectAttempts: number;
} | null {
  const server = mcpServers.get(name);
  if (!server) return null;

  return {
    connected: server.connected,
    connecting: server.connecting,
    capabilities: Object.keys(server.capabilities).filter((k) => server.capabilities[k as keyof typeof server.capabilities]),
    toolCount: server.tools.length,
    resourceCount: server.resources.length,
    lastConnectAttempt: server.lastConnectAttempt,
    reconnectAttempts: server.reconnectAttempts,
  };
}

// ============ MCP 工具类 ============

export class ListMcpResourcesTool extends BaseTool<ListMcpResourcesInput, ToolResult> {
  name = 'ListMcpResources';
  description = `Lists available resources from configured MCP servers.
Each resource object includes a 'server' field indicating which server it's from.

Usage examples:
- List all resources from all servers: \`listMcpResources\`
- List resources from a specific server: \`listMcpResources({ server: "myserver" })\``;

  getPrompt?(): string {
    return `List available resources from configured MCP servers.
Each returned resource will include all standard MCP resource fields plus a 'server' field
indicating which server the resource belongs to.

Parameters:
- server (optional): The name of a specific MCP server to get resources from. If not provided,
  resources from all servers will be returned.
- refresh (optional): Force refresh resource list from server, bypassing cache.`;
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Optional server name to filter resources by',
        },
        refresh: {
          type: 'boolean',
          description: 'Force refresh resource list from server (bypass cache)',
        },
      },
      required: [],
    };
  }

  async execute(input: ListMcpResourcesInput): Promise<ToolResult> {
    const { server, refresh = false } = input;

    const results: Array<{ server: string; resources: McpResource[]; cached: boolean }> = [];
    const errors: Array<{ server: string; error: string }> = [];

    for (const [name, state] of mcpServers) {
      if (server && name !== server) continue;

      try {
        // 确保连接
        if (!state.connected) {
          const connected = await connectMcpServer(name);
          if (!connected) {
            errors.push({ server: name, error: 'Failed to connect to server' });
            continue;
          }
        }

        // 检查服务器是否支持资源
        if (!state.capabilities.resources) {
          continue;
        }

        // 获取资源列表（使用缓存）
        const resources = await getResources(name, refresh);

        if (resources.length > 0) {
          const cached = !refresh && state.resourcesCache !== undefined &&
            Date.now() - state.resourcesCache.timestamp < RESOURCE_CACHE_TTL;
          results.push({ server: name, resources, cached });
        }
      } catch (err) {
        errors.push({
          server: name,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    if (results.length === 0 && errors.length === 0) {
      return { success: true, output: 'No MCP servers with resources configured.' };
    }

    let output = 'Available MCP Resources:\n\n';

    for (const { server: serverName, resources, cached } of results) {
      output += `Server: ${serverName}${cached ? ' (cached)' : ''}\n`;
      for (const resource of resources) {
        output += `  - ${resource.name} (${resource.uri})\n`;
        if (resource.description) {
          output += `    ${resource.description}\n`;
        }
        if (resource.mimeType) {
          output += `    MIME: ${resource.mimeType}\n`;
        }
      }
      output += '\n';
    }

    // 报告错误
    if (errors.length > 0) {
      output += 'Errors:\n';
      for (const { server: serverName, error } of errors) {
        output += `  - ${serverName}: ${error}\n`;
      }
      output += '\n';
    }

    return { success: true, output };
  }
}

export class ReadMcpResourceTool extends BaseTool<ReadMcpResourceInput, ToolResult> {
  name = 'ReadMcpResource';
  description = `Reads a specific resource from an MCP server.
- server: The name of the MCP server to read from
- uri: The URI of the resource to read

Usage examples:
- Read a resource from a server: \`readMcpResource({ server: "myserver", uri: "my-resource-uri" })\``;

  getPrompt?(): string {
    return `Reads a specific resource from an MCP server, identified by server name and resource URI.

Parameters:
- server (required): The name of the MCP server from which to read the resource
- uri (required): The URI of the resource to read`;
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'The MCP server name',
        },
        uri: {
          type: 'string',
          description: 'The resource URI to read',
        },
      },
      required: ['server', 'uri'],
    };
  }

  async execute(input: ReadMcpResourceInput): Promise<ToolResult> {
    const { server, uri } = input;

    const serverState = mcpServers.get(server);
    if (!serverState) {
      return {
        success: false,
        error: `MCP server not found: ${server}. Available servers: ${Array.from(mcpServers.keys()).join(', ') || 'none'}`
      };
    }

    // 确保连接
    if (!serverState.connected) {
      const connected = await connectMcpServer(server);
      if (!connected) {
        return {
          success: false,
          error: `Failed to connect to MCP server: ${server}. Please check server configuration and ensure it's running.`
        };
      }
    }

    // 检查服务器是否支持资源
    if (!serverState.capabilities.resources) {
      return {
        success: false,
        error: `MCP server ${server} does not support resources.`
      };
    }

    // 验证资源是否存在于列表中
    const resources = await getResources(server);
    const resourceExists = resources.some((r) => r.uri === uri);
    if (!resourceExists) {
      return {
        success: false,
        error: `Resource URI not found: ${uri}. Use ListMcpResources to see available resources.`
      };
    }

    try {
      // 读取资源，带重试
      const result = await sendMcpMessage(server, 'resources/read', { uri });

      if (!result) {
        return {
          success: false,
          error: `Failed to read MCP resource: ${uri}. Server did not respond or returned an error.`
        };
      }

      // 解析结果
      const contents = (result as { contents?: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }).contents;
      if (contents && Array.isArray(contents)) {
        let output = '';

        for (const content of contents) {
          if (content.uri) {
            output += `Resource: ${content.uri}\n`;
            if (content.mimeType) {
              output += `MIME Type: ${content.mimeType}\n`;
            }
            output += '\n';
          }

          if (content.text) {
            output += content.text;
          } else if (content.blob) {
            output += `[Binary data: ${content.blob.length} bytes]`;
          }

          output += '\n';
        }

        return { success: true, output: output.trim() };
      }

      // 如果格式不符合预期，返回原始 JSON
      return { success: true, output: JSON.stringify(result, null, 2) };
    } catch (err) {
      return {
        success: false,
        error: `Error reading MCP resource: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }
}

// ============ MCP Search 工具 ============

/**
 * MCP工具搜索工具 - 用于查找和加载MCP工具
 * 这是官方强制要求的工具，必须在调用MCP工具前使用
 */
export class MCPSearchTool extends BaseTool<MCPSearchInput, MCPSearchToolResult> {
  name = 'MCPSearch';

  description = `Search for or select MCP tools to make them available for use.

**MANDATORY PREREQUISITE - THIS IS A HARD REQUIREMENT**

You MUST use this tool to load MCP tools BEFORE calling them directly.

This is a BLOCKING REQUIREMENT - MCP tools listed below are NOT available until you load them using this tool.

**Why this is non-negotiable:**
- MCP tools are deferred and not loaded until discovered via this tool
- Calling an MCP tool without first loading it will fail

**Query modes:**

1. **Direct selection** - Use \`select:<tool_name>\` when you know exactly which tool you need:
   - "select:mcp__slack__read_channel"
   - "select:mcp__filesystem__list_directory"
   - Returns just that tool if it exists

2. **Keyword search** - Use keywords when you're unsure which tool to use:
   - "list directory" - find tools for listing directories
   - "read file" - find tools for reading files
   - "slack message" - find slack messaging tools
   - Returns up to 5 matching tools ranked by relevance

**CORRECT Usage Patterns:**

<example>
User: List files in the src directory
Assistant: I can see mcp__filesystem__list_directory in the available tools. Let me select it.
[Calls MCPSearch with query: "select:mcp__filesystem__list_directory"]
[Calls the MCP tool]
</example>

<example>
User: I need to work with slack somehow
Assistant: Let me search for slack tools.
[Calls MCPSearch with query: "slack"]
Assistant: Found several options including mcp__slack__read_channel.
[Calls the MCP tool]
</example>

**INCORRECT Usage Pattern - NEVER DO THIS:**

<bad-example>
User: Read my slack messages
Assistant: [Directly calls mcp__slack__read_channel without loading it first]
WRONG - You must load the tool FIRST using this tool
</bad-example>`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query to find MCP tools. Use "select:<tool_name>" for direct selection, or keywords to search.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    };
  }

  /**
   * 获取所有可用的MCP工具列表
   */
  private getAvailableMcpTools(): string {
    const tools: string[] = [];
    for (const [serverName, server] of mcpServers) {
      for (const tool of server.tools) {
        tools.push(`mcp__${serverName}__${tool.name}`);
      }
    }
    return tools.join('\n');
  }

  /**
   * 执行关键词搜索
   */
  private async keywordSearch(query: string, maxResults: number): Promise<string[]> {
    const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 0);
    const results: Array<{ name: string; score: number }> = [];

    for (const [serverName, server] of mcpServers) {
      for (const tool of server.tools) {
        const fullName = `mcp__${serverName}__${tool.name}`;
        const searchableName = fullName.toLowerCase().replace(/__/g, ' ');
        const searchableDesc = tool.description.toLowerCase();

        let score = 0;
        for (const keyword of keywords) {
          // 完全匹配工具名
          if (searchableName === keyword) {
            score += 10;
          }
          // 工具名包含关键词
          else if (searchableName.includes(keyword)) {
            score += 5;
          }
          // 描述包含关键词
          if (searchableDesc.includes(keyword)) {
            score += 2;
          }
        }

        if (score > 0) {
          results.push({ name: fullName, score });
        }
      }
    }

    // 按分数排序并返回前N个
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((r) => r.name);
  }

  async execute(input: MCPSearchInput): Promise<MCPSearchToolResult> {
    const { query, max_results = 5 } = input;

    // 获取所有MCP工具数量
    let totalMcpTools = 0;
    for (const server of mcpServers.values()) {
      totalMcpTools += server.tools.length;
    }

    // 检查是否是 select: 语法
    const selectMatch = query.match(/^select:(.+)$/i);
    if (selectMatch) {
      const toolName = selectMatch[1].trim();

      // 验证工具是否存在
      let found = false;
      for (const [serverName, server] of mcpServers) {
        for (const tool of server.tools) {
          const fullName = `mcp__${serverName}__${tool.name}`;
          if (fullName === toolName) {
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return {
          success: true,
          output: `Tool not found: ${toolName}\n\nAvailable tools:\n${this.getAvailableMcpTools()}`,
          matches: [],
          query,
          total_mcp_tools: totalMcpTools,
        };
      }

      return {
        success: true,
        output: `Selected and loaded MCP tool: ${toolName}\n\nYou can now call this tool directly.`,
        matches: [toolName],
        query,
        total_mcp_tools: totalMcpTools,
      };
    }

    // 关键词搜索
    const matches = await this.keywordSearch(query, max_results);

    if (matches.length === 0) {
      return {
        success: true,
        output: `No matching MCP tools found for query: "${query}"\n\nAvailable tools:\n${this.getAvailableMcpTools()}`,
        matches: [],
        query,
        total_mcp_tools: totalMcpTools,
      };
    }

    const output = `Found ${matches.length} MCP tool${matches.length === 1 ? '' : 's'} matching "${query}":\n\n${matches.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nThese tools are now loaded and ready to use.`;

    return {
      success: true,
      output,
      matches,
      query,
      total_mcp_tools: totalMcpTools,
    };
  }
}

// ============ MCP 工具类 ============

export class McpTool extends BaseTool<McpInput, ToolResult> {
  private serverName: string;
  private toolName: string;
  private toolDescription: string;
  private toolInputSchema: Record<string, unknown>;

  constructor(serverName: string, toolDef: McpToolDefinition) {
    // MCP 工具启用重试机制
    super({
      maxRetries: 3,
      baseTimeout: 300000, // 5分钟超时
      retryableErrors: [
        4000, // NETWORK_CONNECTION_FAILED
        4001, // NETWORK_TIMEOUT
        4005, // NETWORK_RATE_LIMITED
      ],
    });
    this.serverName = serverName;
    this.toolName = toolDef.name;
    this.toolDescription = toolDef.description;
    this.toolInputSchema = toolDef.inputSchema;
  }

  get name(): string {
    return `mcp__${this.serverName}__${this.toolName}`;
  }

  get description(): string {
    return this.toolDescription;
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return this.toolInputSchema as ToolDefinition['inputSchema'];
  }

  async execute(input: McpInput): Promise<ToolResult> {
    // 使用重试和超时包装器
    return this.executeWithRetryAndTimeout(async () => {
      return callMcpTool(this.serverName, this.toolName, input);
    });
  }
}

/**
 * 创建 MCP 服务器的所有工具
 */
export async function createMcpTools(serverName: string): Promise<McpTool[]> {
  const server = mcpServers.get(serverName);
  if (!server) return [];

  if (!server.connected) {
    await connectMcpServer(serverName);
  }

  return server.tools.map((tool) => new McpTool(serverName, tool));
}
