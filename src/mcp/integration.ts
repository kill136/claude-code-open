/**
 * MCP 资源管理器集成示例
 * 展示如何将 McpResourceManager 与现有 MCP 工具集成
 */

import {
  McpResourceManager,
  createConnectionManagerAdapter,
  type McpResource,
  type ResourceContent,
  type ResourceTemplate,
} from './resources.js';
import {
  getMcpServers,
  callMcpTool,
  getServerStatus,
} from '../tools/mcp.js';

/**
 * 创建全局资源管理器实例
 */
export function createMcpResourceManager(): McpResourceManager {
  // 从现有的 MCP 工具创建连接管理器适配器
  const connectionManager = createConnectionManagerAdapter({
    sendMessage: async (serverName: string, method: string, params: unknown) => {
      // 使用现有的 MCP 消息发送机制
      const { sendMcpMessage } = await import('../tools/mcp.js');
      return sendMcpMessage(serverName, method, params);
    },

    isConnected: (serverName: string) => {
      const status = getServerStatus(serverName);
      return status?.connected || false;
    },

    connect: async (serverName: string) => {
      const { connectMcpServer } = await import('../tools/mcp.js');
      return connectMcpServer(serverName);
    },

    getServerNames: () => {
      return Array.from(getMcpServers().keys());
    },
  });

  // 创建资源管理器，默认 TTL 60 秒
  return new McpResourceManager(connectionManager, 60000);
}

/**
 * 全局资源管理器单例
 */
let globalResourceManager: McpResourceManager | null = null;

/**
 * 获取全局资源管理器实例
 */
export function getResourceManager(): McpResourceManager {
  if (!globalResourceManager) {
    globalResourceManager = createMcpResourceManager();
  }
  return globalResourceManager;
}

/**
 * 列出所有服务器的资源
 */
export async function listAllResources(): Promise<
  Map<string, McpResource[]>
> {
  const manager = getResourceManager();
  const servers = getMcpServers();
  const results = new Map<string, McpResource[]>();

  for (const serverName of servers.keys()) {
    try {
      const resources = await manager.listResources(serverName);
      if (resources.length > 0) {
        results.set(serverName, resources);
      }
    } catch (err) {
      console.error(`Failed to list resources for ${serverName}:`, err);
    }
  }

  return results;
}

/**
 * 列出所有服务器的资源模板
 */
export async function listAllResourceTemplates(): Promise<
  Map<string, ResourceTemplate[]>
> {
  const manager = getResourceManager();
  const servers = getMcpServers();
  const results = new Map<string, ResourceTemplate[]>();

  for (const serverName of servers.keys()) {
    try {
      const templates = await manager.listResourceTemplates(serverName);
      if (templates.length > 0) {
        results.set(serverName, templates);
      }
    } catch (err) {
      console.error(`Failed to list resource templates for ${serverName}:`, err);
    }
  }

  return results;
}

/**
 * 搜索资源（通过名称或 URI）
 */
export async function searchResources(
  query: string
): Promise<Array<{ server: string; resource: McpResource }>> {
  const allResources = await listAllResources();
  const results: Array<{ server: string; resource: McpResource }> = [];

  const lowerQuery = query.toLowerCase();

  for (const [server, resources] of allResources) {
    for (const resource of resources) {
      if (
        resource.name.toLowerCase().includes(lowerQuery) ||
        resource.uri.toLowerCase().includes(lowerQuery) ||
        resource.description?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ server, resource });
      }
    }
  }

  return results;
}

/**
 * 读取资源并自动检测服务器
 */
export async function readResourceAuto(uri: string): Promise<{
  server: string;
  content: ResourceContent;
} | null> {
  const allResources = await listAllResources();

  for (const [server, resources] of allResources) {
    const resource = resources.find((r) => r.uri === uri);
    if (resource) {
      const manager = getResourceManager();
      const content = await manager.readResource(server, uri);
      return { server, content };
    }
  }

  return null;
}

/**
 * 批量预加载常用资源
 */
export async function preloadCommonResources(): Promise<void> {
  const manager = getResourceManager();
  const allResources = await listAllResources();

  for (const [server, resources] of allResources) {
    // 只预加载小于 100KB 的资源
    const smallResources = resources
      .filter((r) => !r.size || r.size < 100 * 1024)
      .map((r) => r.uri);

    if (smallResources.length > 0) {
      await manager.preloadResources(server, smallResources);
    }
  }
}

/**
 * 清理过期缓存
 */
export function cleanupCache(): void {
  const manager = getResourceManager();
  const stats = manager.getCacheStats();

  console.log(`Cache cleanup: ${stats.size} entries`);

  // 清空缓存（让 TTL 机制自动处理过期）
  manager.clearCache();
}

/**
 * 获取缓存统计信息
 */
export function getCacheInfo(): {
  totalEntries: number;
  entries: Array<{ uri: string; age: number; ttl: number }>;
} {
  const manager = getResourceManager();
  const stats = manager.getCacheStats();

  return {
    totalEntries: stats.size,
    entries: stats.entries,
  };
}

/**
 * 订阅资源变更示例
 */
export async function subscribeToResource(
  serverName: string,
  uri: string,
  callback: (content: ResourceContent) => void
) {
  const manager = getResourceManager();
  return manager.subscribe(serverName, uri, callback);
}

/**
 * 使用资源模板查找资源
 */
export async function findResourcesByTemplate(
  serverName: string,
  templateUri: string
): Promise<McpResource[]> {
  const manager = getResourceManager();
  const templates = await manager.listResourceTemplates(serverName);
  const resources = await manager.listResources(serverName);

  // 找到匹配的模板
  const template = templates.find((t) => t.uriTemplate === templateUri);
  if (!template) {
    return [];
  }

  // 找到匹配模板的资源
  return resources.filter((resource) => {
    const match = manager.matchesTemplate(resource.uri, template);
    return match !== null;
  });
}

/**
 * 根据模板构建资源 URI
 */
export async function buildResourceUri(
  serverName: string,
  templateUri: string,
  params: Record<string, string>
): Promise<string | null> {
  const manager = getResourceManager();
  const templates = await manager.listResourceTemplates(serverName);

  const template = templates.find((t) => t.uriTemplate === templateUri);
  if (!template) {
    return null;
  }

  return manager.buildUriFromTemplate(template, params);
}

/**
 * 导出资源管理器实例（用于其他模块）
 */
export { McpResourceManager, type McpResource, type ResourceContent, type ResourceTemplate };
