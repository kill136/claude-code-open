/**
 * Web 工具
 * WebFetch 和 WebSearch
 */

import axios, { AxiosProxyConfig } from 'axios';
import TurndownService from 'turndown';
import { LRUCache } from 'lru-cache';
import { BaseTool } from './base.js';
import type { WebFetchInput, WebSearchInput, ToolResult, ToolDefinition } from '../types/index.js';

/**
 * 缓存接口
 */
interface CachedContent {
  content: string;
  contentType: string;
  statusCode: number;
  fetchedAt: number;
}

/**
 * 搜索结果接口
 */
interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  publishDate?: string;
}

/**
 * WebFetch 缓存
 * - TTL: 15分钟 (900,000ms)
 * - 最大大小: 50MB
 * - LRU 淘汰策略
 */
const webFetchCache = new LRUCache<string, CachedContent>({
  maxSize: 50 * 1024 * 1024, // 50MB
  ttl: 15 * 60 * 1000,       // 15分钟
  sizeCalculation: (value) => {
    return Buffer.byteLength(value.content, 'utf8');
  },
});

/**
 * Turndown 服务实例（HTML 到 Markdown 转换）
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

export class WebFetchTool extends BaseTool<WebFetchInput, ToolResult> {
  name = 'WebFetch';
  description = `
- Fetches content from a specified URL and processes it using an AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions. All MCP-provided tools start with "mcp__".
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - The prompt should describe what information you want to extract from the page
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large
  - Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
  - When a URL redirects to a different host, the tool will inform you and provide the redirect URL in a special format. You should then make a new WebFetch request with the redirect URL to fetch the content.
`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'The URL to fetch content from',
        },
        prompt: {
          type: 'string',
          description: 'The prompt to run on the fetched content',
        },
      },
      required: ['url', 'prompt'],
    };
  }

  /**
   * 获取代理配置（从环境变量）
   */
  private getProxyConfig(): AxiosProxyConfig | undefined {
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const proxyUrl = httpsProxy || httpProxy;

    if (!proxyUrl) {
      return undefined;
    }

    try {
      const url = new URL(proxyUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '80', 10),
        protocol: url.protocol.replace(':', ''),
        ...(url.username && {
          auth: {
            username: url.username,
            password: url.password,
          },
        }),
      };
    } catch (err) {
      return undefined;
    }
  }

  /**
   * 检查两个 URL 是否同源
   */
  private isSameOrigin(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return (
        u1.protocol === u2.protocol &&
        u1.hostname === u2.hostname &&
        u1.port === u2.port
      );
    } catch {
      return false;
    }
  }

  /**
   * 解析相对重定向 URL
   */
  private resolveRedirectUrl(baseUrl: string, location: string): string {
    try {
      // 如果 location 是绝对 URL，直接返回
      if (location.startsWith('http://') || location.startsWith('https://')) {
        return location;
      }
      // 否则相对于 baseUrl 解析
      return new URL(location, baseUrl).toString();
    } catch {
      return location;
    }
  }

  /**
   * HTML 到 Markdown 转换
   */
  private htmlToMarkdown(html: string): string {
    try {
      return turndownService.turndown(html);
    } catch (err) {
      // 如果转换失败，回退到简单的文本清理
      return this.htmlToText(html);
    }
  }

  /**
   * 简单的 HTML 到文本转换（回退方案）
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .trim();
  }

  /**
   * 实际的 URL 抓取逻辑
   */
  private async fetchUrl(url: string, followRedirect: boolean = false): Promise<{
    content: string;
    contentType: string;
    statusCode: number;
    redirectUrl?: string;
  }> {
    const proxy = this.getProxyConfig();

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCode/2.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: followRedirect ? 5 : 0,
        validateStatus: (status) => status < 400 || (status >= 300 && status < 400),
        proxy: proxy ? proxy : false,
      });

      const contentType = response.headers['content-type'] || '';
      let content = '';

      if (contentType.includes('text/html')) {
        content = this.htmlToMarkdown(response.data);
      } else if (contentType.includes('application/json')) {
        content = JSON.stringify(response.data, null, 2);
      } else {
        content = String(response.data);
      }

      return {
        content,
        contentType,
        statusCode: response.status,
      };
    } catch (err: any) {
      // 处理重定向
      if (err.response && [301, 302, 307, 308].includes(err.response.status)) {
        const location = err.response.headers.location;
        if (!location) {
          throw new Error(`Redirect detected but no location header provided`);
        }

        const redirectUrl = this.resolveRedirectUrl(url, location);

        // 检查是否同源
        if (this.isSameOrigin(url, redirectUrl)) {
          // 同源，自动跟随
          return this.fetchUrl(redirectUrl, true);
        } else {
          // 跨域，返回重定向信息
          return {
            content: '',
            contentType: '',
            statusCode: err.response.status,
            redirectUrl,
          };
        }
      }

      throw err;
    }
  }

  async execute(input: WebFetchInput): Promise<ToolResult> {
    let { url, prompt } = input;

    // URL 验证和规范化
    try {
      const parsedUrl = new URL(url);

      // HTTP 到 HTTPS 自动升级
      if (parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:';
        url = parsedUrl.toString();
      }
    } catch (err) {
      return {
        success: false,
        error: `Invalid URL: ${url}`,
      };
    }

    // 检查缓存
    const cached = webFetchCache.get(url);
    if (cached) {
      const maxLength = 100000;
      let content = cached.content;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n... [content truncated]';
      }

      return {
        success: true,
        output: `URL: ${url}\nPrompt: ${prompt}\n\n--- Content (Cached) ---\n${content}`,
      };
    }

    try {
      const result = await this.fetchUrl(url);

      // 处理跨域重定向
      if (result.redirectUrl) {
        const statusText = {
          301: 'Moved Permanently',
          302: 'Found',
          307: 'Temporary Redirect',
          308: 'Permanent Redirect',
        }[result.statusCode] || 'Redirect';

        return {
          success: false,
          error: `REDIRECT DETECTED: The URL redirects to a different host.

Original URL: ${url}
Redirect URL: ${result.redirectUrl}
Status: ${result.statusCode} ${statusText}

To complete your request, I need to fetch content from the redirected URL.
Please use WebFetch again with these parameters:
- url: "${result.redirectUrl}"
- prompt: "${prompt}"`,
        };
      }

      // 截断过长的内容
      const maxLength = 100000;
      let { content } = result;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n... [content truncated]';
      }

      // 缓存结果
      webFetchCache.set(url, {
        content: result.content,
        contentType: result.contentType,
        statusCode: result.statusCode,
        fetchedAt: Date.now(),
      });

      return {
        success: true,
        output: `URL: ${url}\nPrompt: ${prompt}\n\n--- Content ---\n${content}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Fetch error: ${err.message || String(err)}`,
      };
    }
  }
}

export class WebSearchTool extends BaseTool<WebSearchInput, ToolResult> {
  name = 'WebSearch';
  description = `
- Allows Claude to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks, including links as markdown hyperlinks
- Use this tool for accessing information beyond Claude's knowledge cutoff
- Searches are performed automatically within a single API call

CRITICAL REQUIREMENT - You MUST follow this:
  - After answering the user's question, you MUST include a "Sources:" section at the end of your response
  - In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
  - This is MANDATORY - never skip including sources in your response
  - Example format:

    [Your answer here]

    Sources:
    - [Source Title 1](https://example.com/1)
    - [Source Title 2](https://example.com/2)

Usage notes:
  - Domain filtering is supported to include or block specific websites
  - Web search is only available in the US

IMPORTANT - Use the correct year in search queries:
  - Today's date is ${new Date().toISOString().split('T')[0]}. You MUST use this year when searching for recent information, documentation, or current events.
  - Example: If today is 2025-07-15 and the user asks for "latest React docs", search for "React documentation 2025", NOT "React documentation 2024"
`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 2,
          description: 'The search query to use',
        },
        allowed_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only include results from these domains',
        },
        blocked_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Never include results from these domains',
        },
      },
      required: ['query'],
    };
  }

  /**
   * 从 URL 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      // 移除 www. 前缀
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * 应用域名过滤
   */
  private applyDomainFilters(
    results: SearchResult[],
    allowedDomains?: string[],
    blockedDomains?: string[]
  ): SearchResult[] {
    let filtered = results;

    // 应用白名单
    if (allowedDomains && allowedDomains.length > 0) {
      const normalizedAllowed = allowedDomains.map((d) => d.toLowerCase());
      filtered = filtered.filter((result) => {
        const domain = this.extractDomain(result.url).toLowerCase();
        return normalizedAllowed.includes(domain);
      });
    }

    // 应用黑名单
    if (blockedDomains && blockedDomains.length > 0) {
      const normalizedBlocked = blockedDomains.map((d) => d.toLowerCase());
      filtered = filtered.filter((result) => {
        const domain = this.extractDomain(result.url).toLowerCase();
        return !normalizedBlocked.includes(domain);
      });
    }

    return filtered;
  }

  /**
   * 格式化搜索结果为 Markdown
   */
  private formatSearchResults(results: SearchResult[], query: string): string {
    let output = `Search results for: "${query}"\n\n`;

    if (results.length === 0) {
      output += 'No results found.\n';
      return output;
    }

    // 结果列表
    results.forEach((result, index) => {
      output += `${index + 1}. [${result.title}](${result.url})\n`;
      if (result.snippet) {
        output += `   ${result.snippet}\n`;
      }
      if (result.publishDate) {
        output += `   Published: ${result.publishDate}\n`;
      }
      output += '\n';
    });

    // 来源部分
    output += '\nSources:\n';
    results.forEach((result) => {
      output += `- [${result.title}](${result.url})\n`;
    });

    return output;
  }

  /**
   * 执行搜索（占位符实现）
   *
   * 注意：实际的搜索需要集成第三方搜索 API，例如：
   * - DuckDuckGo API
   * - Bing Search API
   * - Google Custom Search API
   * - SerpAPI
   */
  private async performSearch(query: string): Promise<SearchResult[]> {
    // 这是一个占位符实现
    // 在真实环境中，这里应该调用实际的搜索 API

    // 示例：如果集成了 DuckDuckGo API
    // const results = await duckduckgo.search(query);
    // return results.map(r => ({
    //   title: r.title,
    //   url: r.url,
    //   snippet: r.snippet,
    // }));

    // 占位符返回
    return [];
  }

  async execute(input: WebSearchInput): Promise<ToolResult> {
    const { query, allowed_domains, blocked_domains } = input;

    try {
      // 执行搜索
      const rawResults = await this.performSearch(query);

      // 应用域名过滤
      const filteredResults = this.applyDomainFilters(
        rawResults,
        allowed_domains,
        blocked_domains
      );

      // 如果有真实结果，格式化并返回
      if (rawResults.length > 0) {
        return {
          success: true,
          output: this.formatSearchResults(filteredResults, query),
        };
      }

      // 占位符消息（当未集成搜索 API 时）
      return {
        success: true,
        output: `Web search for: "${query}"

Note: Web search requires API integration (e.g., DuckDuckGo, Bing, Google).
Please configure a search API to enable this feature.

To integrate a search API:
1. Choose a search provider (DuckDuckGo, Bing, Google Custom Search, SerpAPI)
2. Obtain API credentials
3. Install the corresponding npm package
4. Implement the performSearch() method in WebSearchTool
5. Update the formatSearchResults() to display actual results

Query parameters:
- Allowed domains: ${allowed_domains?.join(', ') || 'all'}
- Blocked domains: ${blocked_domains?.join(', ') || 'none'}

Example search result format:
1. [Example Result](https://example.com)
   This is a snippet of the search result...

Sources:
- [Example Result](https://example.com)`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Search error: ${err.message || String(err)}`,
      };
    }
  }
}
