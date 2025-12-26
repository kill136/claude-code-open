/**
 * Web 工具
 * WebFetch 和 WebSearch
 */

import axios, { AxiosProxyConfig } from 'axios';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
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
 * 缓存的搜索结果接口
 * T-012: WebSearch 缓存实现
 */
interface CachedSearchResults {
  query: string;
  results: SearchResult[];
  fetchedAt: number;
  filters?: {
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
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
 * WebSearch 缓存
 * T-012: WebSearch 缓存实现
 * - TTL: 1小时 (3,600,000ms) - 搜索结果时效性较长
 * - 最大条目: 500 个查询
 * - 缓存键: query + allowedDomains + blockedDomains
 */
const webSearchCache = new LRUCache<string, CachedSearchResults>({
  max: 500,                  // 最多缓存 500 个不同查询
  ttl: 60 * 60 * 1000,      // 1小时过期
  updateAgeOnGet: true,      // 访问时更新年龄
  updateAgeOnHas: false,
});

/**
 * 生成搜索缓存键
 * T-012: 缓存键生成逻辑
 * @param query 搜索查询
 * @param allowedDomains 允许的域名列表
 * @param blockedDomains 阻止的域名列表
 * @returns 缓存键字符串
 */
function generateSearchCacheKey(
  query: string,
  allowedDomains?: string[],
  blockedDomains?: string[]
): string {
  const normalizedQuery = query.trim().toLowerCase();
  const allowed = allowedDomains?.sort().join(',') || '';
  const blocked = blockedDomains?.sort().join(',') || '';

  return `${normalizedQuery}|${allowed}|${blocked}`;
}

/**
 * 创建增强的 Turndown 服务
 * T-011: 优化 Turndown 配置，支持 GFM 扩展和自定义规则
 */
function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    hr: '---',
    bulletListMarker: '-',
    fence: '```',
    br: '  ',
    preformattedCode: false,
  });

  // 启用 GFM 扩展（表格、删除线、任务列表等）
  service.use(gfm);

  // 自定义规则：删除 script 和 style 标签
  service.addRule('removeScripts', {
    filter: ['script', 'style', 'noscript'],
    replacement: () => '',
  });

  // 自定义规则：优化图片 alt 文本
  service.addRule('images', {
    filter: 'img',
    replacement: (content, node) => {
      const element = node as any;
      const alt = element.alt || '';
      const src = element.src || '';
      const title = element.title || '';

      if (!src) return '';

      const titlePart = title ? ` "${title}"` : '';
      return `![${alt}](${src}${titlePart})`;
    },
  });

  // 自定义规则：保留语义化标签
  service.addRule('semanticTags', {
    filter: ['mark', 'ins', 'kbd', 'sub', 'sup'],
    replacement: (content, node) => {
      const tagMap: Record<string, string> = {
        'mark': '==',
        'ins': '++',
        'kbd': '`',
        'sub': '~',
        'sup': '^',
      };
      const delimiter = tagMap[node.nodeName.toLowerCase()] || '';
      return delimiter + content + delimiter;
    },
  });

  // 自定义规则：优化代码块语言标识
  service.addRule('codeBlock', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild !== null &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement: (content, node) => {
      const codeNode = node.firstChild as any;
      const className = codeNode?.className || '';

      // 提取语言标识（从 language-xxx 或 lang-xxx）
      const langMatch = className.match(/(?:language|lang)-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      const codeContent = codeNode?.textContent || content;

      return '\n\n```' + lang + '\n' + codeContent + '\n```\n\n';
    },
  });

  return service;
}

/**
 * Turndown 服务实例（HTML 到 Markdown 转换）
 */
const turndownService = createTurndownService();

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
  private async fetchUrl(
    url: string,
    options: { originalUrl?: string; redirectCount?: number } = {}
  ): Promise<{
    content: string;
    contentType: string;
    statusCode: number;
    redirectUrl?: string;
    originalUrl?: string;
  }> {
    const { originalUrl, redirectCount = 0 } = options;
    const proxy = this.getProxyConfig();

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCode/2.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 0, // 手动处理重定向
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
        const baseUrl = originalUrl || url;

        // 检查是否同源（与原始 URL 比较）
        if (this.isSameOrigin(baseUrl, redirectUrl)) {
          // 同源，自动跟随重定向（最多5次）
          if (redirectCount >= 5) {
            throw new Error('Too many redirects (maximum 5)');
          }
          return this.fetchUrl(redirectUrl, {
            originalUrl: baseUrl,
            redirectCount: redirectCount + 1,
          });
        } else {
          // 跨域，返回重定向信息
          return {
            content: '',
            contentType: '',
            statusCode: err.response.status,
            redirectUrl,
            originalUrl: baseUrl,
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

Original URL: ${result.originalUrl || url}
Redirect URL: ${result.redirectUrl}
Status: ${result.statusCode} ${statusText}

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
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
   * 执行搜索
   * T-012: 集成 DuckDuckGo Instant Answer API（免费）
   *
   * 支持的搜索 API：
   * - DuckDuckGo Instant Answer API (当前实现 - 免费)
   * - Bing Search API (需要 BING_SEARCH_API_KEY 环境变量)
   * - Google Custom Search API (需要 GOOGLE_SEARCH_API_KEY 和 GOOGLE_SEARCH_ENGINE_ID)
   */
  private async performSearch(query: string): Promise<SearchResult[]> {
    // 优先使用 Bing Search API（如果配置）
    const bingApiKey = process.env.BING_SEARCH_API_KEY;
    if (bingApiKey) {
      return this.searchWithBing(query, bingApiKey);
    }

    // 优先使用 Google Custom Search API（如果配置）
    const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (googleApiKey && googleCx) {
      return this.searchWithGoogle(query, googleApiKey, googleCx);
    }

    // 回退到 DuckDuckGo（免费，无需 API 密钥）
    return this.searchWithDuckDuckGo(query);
  }

  /**
   * DuckDuckGo Instant Answer API 搜索
   * 免费，无需 API 密钥
   */
  private async searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCode/2.0)',
        },
      });

      const data = response.data;
      const results: SearchResult[] = [];

      // 提取相关主题
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 10)) {
          // 处理嵌套主题
          if (topic.Topics && Array.isArray(topic.Topics)) {
            for (const subTopic of topic.Topics.slice(0, 3)) {
              if (subTopic.Text && subTopic.FirstURL) {
                results.push({
                  title: subTopic.Text.split(' - ')[0] || subTopic.Text,
                  url: subTopic.FirstURL,
                  snippet: subTopic.Text,
                });
              }
            }
          } else if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      // 添加抽象答案（如果有）
      if (data.Abstract && data.AbstractURL) {
        results.unshift({
          title: data.Heading || 'DuckDuckGo Instant Answer',
          url: data.AbstractURL,
          snippet: data.Abstract,
        });
      }

      return results;
    } catch (err: any) {
      console.error('DuckDuckGo search error:', err.message);
      return [];
    }
  }

  /**
   * Bing Search API 搜索
   * 需要 Azure 订阅和 API 密钥
   */
  private async searchWithBing(query: string, apiKey: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get(
        'https://api.bing.microsoft.com/v7.0/search',
        {
          params: { q: query, count: 10 },
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
          },
          timeout: 10000,
        }
      );

      const webPages = response.data.webPages?.value || [];

      return webPages.map((page: any) => ({
        title: page.name || '',
        url: page.url || '',
        snippet: page.snippet || '',
        publishDate: page.dateLastCrawled,
      }));
    } catch (err: any) {
      console.error('Bing Search API error:', err.message);
      // 回退到 DuckDuckGo
      return this.searchWithDuckDuckGo(query);
    }
  }

  /**
   * Google Custom Search API 搜索
   * 需要 API 密钥和搜索引擎 ID
   */
  private async searchWithGoogle(
    query: string,
    apiKey: string,
    cx: string
  ): Promise<SearchResult[]> {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: { key: apiKey, cx, q: query, num: 10 },
          timeout: 10000,
        }
      );

      const items = response.data.items || [];

      return items.map((item: any) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
      }));
    } catch (err: any) {
      console.error('Google Search API error:', err.message);
      // 回退到 DuckDuckGo
      return this.searchWithDuckDuckGo(query);
    }
  }

  async execute(input: WebSearchInput): Promise<ToolResult> {
    const { query, allowed_domains, blocked_domains } = input;

    // 生成缓存键
    // T-012: 使用缓存优化搜索性能
    const cacheKey = generateSearchCacheKey(query, allowed_domains, blocked_domains);

    // 检查缓存
    const cached = webSearchCache.get(cacheKey);
    if (cached) {
      const cacheAge = Math.floor((Date.now() - cached.fetchedAt) / 1000 / 60); // 分钟
      return {
        success: true,
        output:
          this.formatSearchResults(cached.results, query) +
          `\n\n_[Cached results from ${cacheAge} minute(s) ago]_`,
      };
    }

    try {
      // 执行搜索
      const rawResults = await this.performSearch(query);

      // 应用域名过滤
      const filteredResults = this.applyDomainFilters(
        rawResults,
        allowed_domains,
        blocked_domains
      );

      // 缓存结果（即使为空也缓存，避免重复请求）
      webSearchCache.set(cacheKey, {
        query,
        results: filteredResults,
        fetchedAt: Date.now(),
        filters: {
          allowedDomains: allowed_domains,
          blockedDomains: blocked_domains,
        },
      });

      // 如果有真实结果，格式化并返回
      if (filteredResults.length > 0) {
        return {
          success: true,
          output: this.formatSearchResults(filteredResults, query),
        };
      }

      // 如果搜索返回了结果但被过滤器全部过滤掉了
      if (rawResults.length > 0 && filteredResults.length === 0) {
        return {
          success: true,
          output: `Web search for: "${query}"

No results found after applying domain filters.

Filters applied:
- Allowed domains: ${allowed_domains?.join(', ') || 'all'}
- Blocked domains: ${blocked_domains?.join(', ') || 'none'}

Try adjusting your domain filters or search query.`,
        };
      }

      // 如果搜索 API 没有返回结果
      return {
        success: true,
        output: `Web search for: "${query}"

No results found. This could be due to:
1. The search query is too specific or uncommon
2. DuckDuckGo Instant Answer API has limited coverage
3. Network or API issues

Suggestions:
- Try a different search query
- Configure Bing or Google Search API for better results:
  * Bing: Set BING_SEARCH_API_KEY environment variable
  * Google: Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID

Current search provider: DuckDuckGo Instant Answer API (free)`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Search error: ${err.message || String(err)}`,
      };
    }
  }
}

/**
 * 缓存统计信息
 * 用于监控和调试缓存使用情况
 */
export function getWebCacheStats() {
  return {
    fetch: {
      size: webFetchCache.size,
      calculatedSize: webFetchCache.calculatedSize,
      maxSize: webFetchCache.maxSize,
      ttl: webFetchCache.ttl,
      itemCount: webFetchCache.size,
    },
    search: {
      size: webSearchCache.size,
      max: webSearchCache.max,
      ttl: webSearchCache.ttl,
      itemCount: webSearchCache.size,
    },
  };
}

/**
 * 清除所有 Web 缓存
 * 用于调试或重置缓存状态
 */
export function clearWebCaches() {
  webFetchCache.clear();
  webSearchCache.clear();
}
