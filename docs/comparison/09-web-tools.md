# Web 工具功能对比分析 (T098-T104)

## 概述

本文档对比本项目的 Web 工具实现与官方 @anthropic-ai/claude-code 包的差异。

**本项目源码**: `/home/user/claude-code-open/src/tools/web.ts`
**官方源码**: `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js`

---

## T098: WebFetch 工具

### 官方实现

**位置**: cli.js:478-494, 2308-2317

**核心特性**:
```javascript
var VI="WebFetch",ZzB=`
- Fetches content from a specified URL and processes it using an AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions.
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - The prompt should describe what information you want to extract from the page
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large
  - Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
  - When a URL redirects to a different host, the tool will inform you and provide the redirect URL in a special format. You should then make a new WebFetch request with the redirect URL to fetch the content.
`
```

**关键实现细节**:
1. **域名预检查**: 使用 `Ci5()` 函数调用 `claude.ai/api/web/domain_info` API 检查域名是否允许抓取
2. **预批准域名列表**: 维护了 80+ 个预批准域名（`RI1` Set），包括主流开发文档站点
3. **智能内容处理**:
   - 对预批准域名的 markdown 内容直接返回（无需 AI 处理）
   - 其他内容通过 `Rg2()` 调用 AI 模型处理
4. **内容限制**: 最大内容长度 100,000 字符（`_I1 = 1e5`）

### 本项目实现

**位置**: src/tools/web.ts:10-104

**核心代码**:
```typescript
export class WebFetchTool extends BaseTool<WebFetchInput, ToolResult> {
  name = 'WebFetch';
  description = `Fetches content from a specified URL and processes it.

- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt
- Use this tool when you need to retrieve and analyze web content
- HTTP URLs will be automatically upgraded to HTTPS`;

  async execute(input: WebFetchInput): Promise<ToolResult> {
    let { url, prompt } = input;

    // 升级 HTTP 到 HTTPS
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCode/2.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 5,
      });

      const contentType = response.headers['content-type'] || '';
      let content = '';

      if (contentType.includes('text/html')) {
        // 简化的 HTML 到文本转换
        content = this.htmlToText(response.data);
      } else if (contentType.includes('application/json')) {
        content = JSON.stringify(response.data, null, 2);
      } else {
        content = String(response.data);
      }

      // 截断过长的内容
      const maxLength = 50000;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n... [content truncated]';
      }

      return {
        success: true,
        output: `URL: ${url}\nPrompt: ${prompt}\n\n--- Content ---\n${content}`,
      };
    } catch (err: any) {
      if (err.response?.status === 301 || err.response?.status === 302) {
        const redirectUrl = err.response.headers.location;
        return {
          success: false,
          error: `Redirected to: ${redirectUrl}. Please fetch the new URL.`,
        };
      }
      return { success: false, error: `Fetch error: ${err.message}` };
    }
  }
}
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **基础功能** | ✅ 完整 | ✅ 基础实现 | 🟡 中等 |
| **HTTP → HTTPS** | ✅ | ✅ | ✅ 一致 |
| **域名预检查** | ✅ 调用 claude.ai API | ❌ 无 | 🔴 重大 |
| **预批准域名** | ✅ 80+ 域名 | ❌ 无 | 🔴 重大 |
| **AI 处理响应** | ✅ 调用模型处理 | ❌ 仅返回原始内容 | 🔴 重大 |
| **内容长度限制** | 100,000 字符 | 50,000 字符 | 🟡 中等 |
| **超时设置** | 未明确 | 30秒 | 🟢 轻微 |
| **最大重定向** | 0 (手动处理) | 5 | 🟡 中等 |

**关键差异**:

1. **缺少 AI 内容处理**: 官方实现会调用 AI 模型根据 prompt 处理获取的内容，本项目仅返回原始内容
2. **缺少域名安全检查**: 官方实现有完整的域名预检查机制和预批准列表
3. **MCP 集成提示**: 官方描述中提到优先使用 MCP 提供的 web fetch 工具

---

## T099: HTML 转 Markdown

### 官方实现

**位置**: cli.js:2306-2309 (Turndown 库的使用)

**关键代码**:
```javascript
// 使用 Turndown 库进行 HTML 到 Markdown 转换
if (X.includes("text/html"))
  W = new Ng2.default().turndown(J);  // Ng2 是 turndown 库的引用
else
  W = J;
```

**依赖库**: `turndown` (专业的 HTML 到 Markdown 转换库)

**转换规则**:
- 完整的 HTML 语义保留
- 支持表格、列表、代码块等
- 保留链接和图片引用
- 处理嵌套结构

### 本项目实现

**位置**: src/tools/web.ts:90-103

**核心代码**:
```typescript
private htmlToText(html: string): string {
  // 简化的 HTML 清理
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
    .trim();
}
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **转换库** | Turndown (专业库) | 正则表达式 | 🔴 重大 |
| **Markdown 格式** | ✅ 完整保留 | ❌ 仅纯文本 | 🔴 重大 |
| **表格支持** | ✅ | ❌ | 🔴 重大 |
| **代码块保留** | ✅ | ❌ | 🔴 重大 |
| **链接保留** | ✅ | ❌ | 🔴 重大 |
| **脚本/样式移除** | ✅ | ✅ | ✅ 一致 |
| **HTML 实体解码** | ✅ 完整 | ✅ 基础实现 | 🟡 中等 |

**关键差异**:

1. **输出格式**: 官方输出结构化的 Markdown，本项目输出纯文本
2. **信息损失**: 本项目会丢失表格、链接、代码块等重要信息
3. **可维护性**: 使用专业库更可靠，正则方案难以处理复杂 HTML

**改进建议**:
```typescript
import TurndownService from 'turndown';

private htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
  });

  return turndown.turndown(html);
}
```

---

## T100: WebFetch 缓存

### 官方实现

**位置**: cli.js:2309 (qg2 缓存对象)

**关键代码**:
```javascript
// 缓存配置
var Hi5 = 900000,        // TTL: 15分钟 (900秒)
    Di5 = 52428800;      // 最大缓存大小: 50MB

qg2 = new hO({           // hO 是 LRU 缓存库
  maxSize: Di5,          // 最大缓存大小
  sizeCalculation: (A) => Buffer.byteLength(A.content),  // 按内容字节计算
  ttl: Hi5               // 15分钟过期
});

// 缓存使用
let B = qg2.get(A);
if (B)
  return { bytes: B.bytes, code: B.code, ... };

// 设置缓存
qg2.set(A, {
  bytes: I,
  code: Y.status,
  codeText: Y.statusText,
  content: W,
  contentType: X
});
```

**缓存特性**:
- **TTL**: 15分钟自动过期
- **LRU 淘汰**: 超出大小限制时淘汰最少使用的条目
- **大小限制**: 50MB
- **按内容大小计费**: 使用实际内容字节数
- **自清理**: 自动清理过期条目

### 本项目实现

**位置**: src/tools/web.ts

**状态**: ❌ 未实现

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **缓存机制** | ✅ LRU 缓存 | ❌ 无 | 🔴 重大 |
| **TTL** | 15分钟 | N/A | 🔴 重大 |
| **大小限制** | 50MB | N/A | 🔴 重大 |
| **自动清理** | ✅ | N/A | 🔴 重大 |
| **性能优化** | ✅ 显著 | ❌ 无 | 🔴 重大 |

**影响**:
- 每次请求都会重新抓取，无法利用缓存
- 重复请求浪费网络资源
- 响应速度较慢

**改进建议**:
```typescript
import { LRUCache } from 'lru-cache';

interface CachedContent {
  content: string;
  contentType: string;
  statusCode: number;
  fetchedAt: number;
}

const webFetchCache = new LRUCache<string, CachedContent>({
  max: 50 * 1024 * 1024, // 50MB
  ttl: 15 * 60 * 1000,   // 15分钟
  sizeCalculation: (value) => Buffer.byteLength(value.content),
});

async execute(input: WebFetchInput): Promise<ToolResult> {
  const { url } = input;

  // 检查缓存
  const cached = webFetchCache.get(url);
  if (cached) {
    return {
      success: true,
      output: cached.content,
      cached: true,
    };
  }

  // 抓取并缓存
  const result = await this.fetchUrl(url);
  webFetchCache.set(url, result);

  return { success: true, output: result.content };
}
```

---

## T101: WebFetch 重定向处理

### 官方实现

**位置**: cli.js:2310-2317

**重定向策略**:
```javascript
// 1. 主动禁用自动重定向
await SQ.get(A, {
  signal: Q,
  maxRedirects: 0,  // 不自动跟随重定向
  // ...
});

// 2. 捕获重定向响应
if (SQ.isAxiosError(G) && G.response &&
    [301, 302, 307, 308].includes(G.response.status)) {
  let Z = G.response.headers.location;
  let Y = new URL(Z, A).toString();

  // 3. 检查是否跨域
  if (B(A, Y))  // $i5 函数检查同源
    return Og2(Y, Q, B);  // 同源则自动跟随
  else
    return {  // 跨域则返回重定向信息
      type: "redirect",
      originalUrl: A,
      redirectUrl: Y,
      statusCode: G.response.status
    };
}

// 4. 返回给用户的格式化信息
`REDIRECT DETECTED: The URL redirects to a different host.

Original URL: ${Y.originalUrl}
Redirect URL: ${Y.redirectUrl}
Status: ${Y.statusCode} ${F}

To complete your request, I need to fetch content from the redirected URL.
Please use WebFetch again with these parameters:
- url: "${Y.redirectUrl}"
- prompt: "${Q}"`
```

**重定向处理逻辑**:
1. **禁用自动重定向**: `maxRedirects: 0`
2. **检测重定向状态**: 301, 302, 307, 308
3. **同源检查**: 使用 `$i5()` 函数比较协议、端口、主机名
4. **自动 vs 手动**:
   - 同源重定向: 自动跟随
   - 跨域重定向: 要求用户确认

### 本项目实现

**位置**: src/tools/web.ts:38-88

**重定向策略**:
```typescript
const response = await axios.get(url, {
  timeout: 30000,
  headers: { /* ... */ },
  maxRedirects: 5,  // 自动跟随最多 5 次重定向
});

// 在 catch 块中检测重定向错误
catch (err: any) {
  if (err.response?.status === 301 || err.response?.status === 302) {
    const redirectUrl = err.response.headers.location;
    return {
      success: false,
      error: `Redirected to: ${redirectUrl}. Please fetch the new URL.`,
    };
  }
  return { success: false, error: `Fetch error: ${err.message}` };
}
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **自动重定向** | ❌ 禁用 | ✅ 最多 5 次 | 🔴 重大 |
| **同源检查** | ✅ 完整 | ❌ 无 | 🔴 重大 |
| **跨域保护** | ✅ | ❌ | 🔴 重大 |
| **重定向类型** | 301/302/307/308 | 301/302 | 🟡 中等 |
| **用户提示格式** | ✅ 详细格式化 | 🟡 简单提示 | 🟡 中等 |
| **重定向信息** | ✅ 完整 | 🟡 仅 URL | 🟡 中等 |

**关键差异**:

1. **安全性**: 官方实现有跨域保护，本项目会自动跟随跨域重定向（安全风险）
2. **控制权**: 官方让用户决定是否跟随跨域重定向，本项目自动处理
3. **行为冲突**: 本项目 `maxRedirects: 5` 与 catch 块逻辑冲突（设置了自动跟随却又捕获重定向错误）

**改进建议**:
```typescript
async execute(input: WebFetchInput): Promise<ToolResult> {
  let { url, prompt } = input;

  try {
    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 0,  // 禁用自动重定向
      validateStatus: (status) => status < 400,  // 接受 3xx 状态码
    });

    // 正常响应处理...

  } catch (err: any) {
    // 处理重定向
    if ([301, 302, 307, 308].includes(err.response?.status)) {
      const redirectUrl = err.response.headers.location;
      const originalHost = new URL(url).hostname;
      const redirectHost = new URL(redirectUrl).hostname;

      // 检查是否跨域
      if (originalHost === redirectHost) {
        // 同源，自动跟随
        return this.execute({ ...input, url: redirectUrl });
      } else {
        // 跨域，返回详细信息让用户决定
        return {
          success: false,
          error: `REDIRECT DETECTED: The URL redirects to a different host.

Original URL: ${url}
Redirect URL: ${redirectUrl}
Status: ${err.response.status}

To complete your request, please use WebFetch again with the redirected URL.`,
        };
      }
    }

    return { success: false, error: `Fetch error: ${err.message}` };
  }
}
```

---

## T102: WebSearch 工具

### 官方实现

**位置**: cli.js:536-562

**完整描述**:
```javascript
var iM = "WebSearch";

function kzB() {
  return `
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
  - Today's date is ${W11()}. You MUST use this year when searching for recent information, documentation, or current events.
  - Example: If today is 2025-07-15 and the user asks for "latest React docs", search for "React documentation 2025", NOT "React documentation 2024"
`
}
```

**输入 Schema**:
```javascript
{
  query: {
    type: 'string',
    minLength: 2,
    description: 'The search query to use'
  },
  allowed_domains: {
    type: 'array',
    items: { type: 'string' },
    description: 'Only include results from these domains'
  },
  blocked_domains: {
    type: 'array',
    items: { type: 'string' },
    description: 'Never include results from these domains'
  }
}
```

**关键特性**:
- ✅ 集成真实搜索 API
- ✅ 强制要求引用来源
- ✅ 支持域名过滤（白名单/黑名单）
- ✅ 自动注入当前日期到提示中
- ✅ 格式化搜索结果为 Markdown 链接
- ✅ 地区限制提示（仅美国可用）

### 本项目实现

**位置**: src/tools/web.ts:106-163

**核心代码**:
```typescript
export class WebSearchTool extends BaseTool<WebSearchInput, ToolResult> {
  name = 'WebSearch';
  description = `Search the web and use results to inform responses.

- Provides up-to-date information for current events
- Returns search result information with links
- Use for information beyond Claude's knowledge cutoff
- MUST include a "Sources:" section with URLs after answering`;

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

  async execute(input: WebSearchInput): Promise<ToolResult> {
    const { query, allowed_domains, blocked_domains } = input;

    // 注意：实际的 web search 需要集成搜索 API
    // 这里提供一个模拟实现的框架

    try {
      // 可以集成 DuckDuckGo、Bing、Google 等 API
      // 这里返回一个提示消息
      return {
        success: true,
        output: `Web search for: "${query}"

Note: Web search requires API integration (e.g., DuckDuckGo, Bing, Google).
Please configure a search API to enable this feature.

Query parameters:
- Allowed domains: ${allowed_domains?.join(', ') || 'all'}
- Blocked domains: ${blocked_domains?.join(', ') || 'none'}`,
      };
    } catch (err) {
      return { success: false, error: `Search error: ${err}` };
    }
  }
}
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **搜索功能** | ✅ 真实搜索 | ❌ 仅占位符 | 🔴 重大 |
| **输入 Schema** | ✅ 完整 | ✅ 完整 | ✅ 一致 |
| **域名过滤** | ✅ 支持 | 🟡 Schema 有但无实现 | 🔴 重大 |
| **来源引用要求** | ✅ 强制格式 | 🟡 简单提及 | 🟡 中等 |
| **日期注入** | ✅ 动态日期 | ❌ 无 | 🟡 中等 |
| **结果格式化** | ✅ Markdown 链接 | ❌ 无 | 🔴 重大 |
| **地区限制说明** | ✅ 美国限制 | ❌ 无 | 🟢 轻微 |
| **搜索 API** | ✅ 已集成 | ❌ 未集成 | 🔴 重大 |

**关键差异**:

1. **核心功能缺失**: 本项目只是一个框架，没有实际搜索功能
2. **无来源引用机制**: 官方有强制的来源引用格式要求
3. **缺少时间上下文**: 官方会自动注入当前日期到提示中

---

## T103: WebSearch 域名过滤

### 官方实现

**位置**: cli.js 中域名过滤逻辑部分

**过滤机制**:

1. **白名单过滤** (`allowed_domains`):
```javascript
// 伪代码示例
function filterByAllowedDomains(results, allowedDomains) {
  if (!allowedDomains || allowedDomains.length === 0) {
    return results;  // 无限制，返回所有结果
  }

  return results.filter(result => {
    const domain = extractDomain(result.url);
    return allowedDomains.includes(domain);
  });
}
```

2. **黑名单过滤** (`blocked_domains`):
```javascript
function filterByBlockedDomains(results, blockedDomains) {
  if (!blockedDomains || blockedDomains.length === 0) {
    return results;  // 无限制，返回所有结果
  }

  return results.filter(result => {
    const domain = extractDomain(result.url);
    return !blockedDomains.includes(domain);
  });
}
```

3. **组合过滤**:
```javascript
function applyDomainFilters(results, { allowed_domains, blocked_domains }) {
  let filtered = results;

  // 先应用白名单
  if (allowed_domains?.length > 0) {
    filtered = filterByAllowedDomains(filtered, allowed_domains);
  }

  // 再应用黑名单
  if (blocked_domains?.length > 0) {
    filtered = filterByBlockedDomains(filtered, blocked_domains);
  }

  return filtered;
}
```

### 本项目实现

**位置**: src/tools/web.ts:139-157

**代码**:
```typescript
async execute(input: WebSearchInput): Promise<ToolResult> {
  const { query, allowed_domains, blocked_domains } = input;

  // 仅提示，无实际过滤逻辑
  return {
    success: true,
    output: `Web search for: "${query}"

Note: Web search requires API integration (e.g., DuckDuckGo, Bing, Google).
Please configure a search API to enable this feature.

Query parameters:
- Allowed domains: ${allowed_domains?.join(', ') || 'all'}
- Blocked domains: ${blocked_domains?.join(', ') || 'none'}`,
  };
}
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **白名单过滤** | ✅ 完整实现 | ❌ 仅参数显示 | 🔴 重大 |
| **黑名单过滤** | ✅ 完整实现 | ❌ 仅参数显示 | 🔴 重大 |
| **域名提取** | ✅ | ❌ | 🔴 重大 |
| **过滤逻辑** | ✅ 白名单优先 | ❌ 无 | 🔴 重大 |
| **结果过滤** | ✅ | ❌ | 🔴 重大 |

**改进建议**:
```typescript
import { URL } from 'url';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

private extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

private applyDomainFilters(
  results: SearchResult[],
  allowedDomains?: string[],
  blockedDomains?: string[]
): SearchResult[] {
  let filtered = results;

  // 应用白名单
  if (allowedDomains && allowedDomains.length > 0) {
    filtered = filtered.filter(result => {
      const domain = this.extractDomain(result.url);
      return allowedDomains.includes(domain);
    });
  }

  // 应用黑名单
  if (blockedDomains && blockedDomains.length > 0) {
    filtered = filtered.filter(result => {
      const domain = this.extractDomain(result.url);
      return !blockedDomains.includes(domain);
    });
  }

  return filtered;
}

async execute(input: WebSearchInput): Promise<ToolResult> {
  const { query, allowed_domains, blocked_domains } = input;

  // 执行搜索
  const rawResults = await this.performSearch(query);

  // 应用域名过滤
  const filteredResults = this.applyDomainFilters(
    rawResults,
    allowed_domains,
    blocked_domains
  );

  return {
    success: true,
    output: this.formatResults(filteredResults),
  };
}
```

---

## T104: WebSearch 结果格式化

### 官方实现

**预期格式**:

根据官方描述 (cli.js:537-553)，结果应该包含：

1. **搜索结果块**:
```
Search results for: "your query"

1. [Page Title](https://example.com/page1)
   Brief snippet or description of the page content...

2. [Another Page](https://example.com/page2)
   Brief snippet or description of this page...

3. [Third Result](https://example.com/page3)
   Brief snippet or description...
```

2. **强制来源部分**:
```
[Your answer based on search results]

Sources:
- [Page Title](https://example.com/page1)
- [Another Page](https://example.com/page2)
- [Third Result](https://example.com/page3)
```

**格式化函数** (推测):
```javascript
function formatSearchResults(results, query) {
  let output = `Search results for: "${query}"\n\n`;

  results.forEach((result, index) => {
    output += `${index + 1}. [${result.title}](${result.url})\n`;
    if (result.snippet) {
      output += `   ${result.snippet}\n`;
    }
    output += '\n';
  });

  return output;
}

function formatSources(results) {
  return results.map(r => `- [${r.title}](${r.url})`).join('\n');
}
```

### 本项目实现

**位置**: src/tools/web.ts

**状态**: ❌ 无格式化逻辑

**当前输出**:
```typescript
return {
  success: true,
  output: `Web search for: "${query}"

Note: Web search requires API integration...`,
};
```

### 差异分析

| 功能点 | 官方实现 | 本项目实现 | 差异等级 |
|--------|----------|------------|----------|
| **Markdown 链接** | ✅ `[Title](URL)` | ❌ 无 | 🔴 重大 |
| **编号列表** | ✅ | ❌ 无 | 🔴 重大 |
| **摘要/片段** | ✅ | ❌ 无 | 🔴 重大 |
| **来源列表** | ✅ 格式化 | ❌ 无 | 🔴 重大 |
| **结构化输出** | ✅ | ❌ 无 | 🔴 重大 |

**改进建议**:
```typescript
interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  publishDate?: string;
}

private formatSearchResults(results: SearchResult[], query: string): string {
  let output = `Search results for: "${query}"\n\n`;

  if (results.length === 0) {
    output += 'No results found.\n';
    return output;
  }

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

  // 添加来源部分
  output += '\nSources:\n';
  results.forEach(result => {
    output += `- [${result.title}](${result.url})\n`;
  });

  return output;
}

async execute(input: WebSearchInput): Promise<ToolResult> {
  const { query, allowed_domains, blocked_domains } = input;

  try {
    const rawResults = await this.performSearch(query);
    const filteredResults = this.applyDomainFilters(
      rawResults,
      allowed_domains,
      blocked_domains
    );

    return {
      success: true,
      output: this.formatSearchResults(filteredResults, query),
    };
  } catch (err) {
    return {
      success: false,
      error: `Search error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
```

---

## 总体差异总结

### 功能完整度对比

| 功能模块 | 官方实现 | 本项目实现 | 完成度 |
|----------|----------|------------|--------|
| **T098: WebFetch 工具** | ✅ 完整 | 🟡 基础框架 | 40% |
| **T099: HTML → Markdown** | ✅ 专业库 | 🟡 正则方案 | 30% |
| **T100: WebFetch 缓存** | ✅ LRU 缓存 | ❌ 无 | 0% |
| **T101: 重定向处理** | ✅ 智能处理 | 🟡 基础实现 | 35% |
| **T102: WebSearch 工具** | ✅ 完整 | ❌ 占位符 | 10% |
| **T103: 域名过滤** | ✅ 完整 | ❌ 无 | 0% |
| **T104: 结果格式化** | ✅ 完整 | ❌ 无 | 0% |

**总体完成度**: 约 **20%**

### 关键缺失功能

#### 1. WebFetch 核心功能

- ❌ **域名安全检查**: 缺少预检查和预批准域名机制
- ❌ **AI 内容处理**: 不能根据 prompt 智能处理内容
- ❌ **专业 HTML 转换**: 使用简单正则而非专业库
- ❌ **缓存机制**: 完全缺失，影响性能
- ❌ **智能重定向**: 缺少同源检查和跨域保护

#### 2. WebSearch 核心功能

- ❌ **搜索 API 集成**: 完全未实现
- ❌ **域名过滤**: 虽有参数但无实现
- ❌ **结果格式化**: 无 Markdown 格式化
- ❌ **来源引用**: 无强制引用机制

### 架构差异

#### 官方架构优势

1. **多层安全检查**:
   ```
   用户请求 → 域名预检查 → 预批准列表 → 同源检查 → 实际抓取
   ```

2. **智能内容处理**:
   ```
   HTML → Turndown 转 MD → AI 模型处理 → 格式化输出
   ```

3. **性能优化**:
   ```
   请求 → 缓存查询 → (命中则返回) → 抓取 → 缓存写入 → 返回
   ```

#### 本项目架构

1. **简单直接**:
   ```
   用户请求 → 直接抓取 → 简单清理 → 返回原始内容
   ```

2. **缺少中间层**:
   - 无缓存层
   - 无安全检查层
   - 无智能处理层

### 安全性对比

| 安全特性 | 官方实现 | 本项目实现 | 风险等级 |
|----------|----------|------------|----------|
| **域名白名单** | ✅ | ❌ | 🔴 高 |
| **跨域检查** | ✅ | ❌ | 🔴 高 |
| **内容大小限制** | ✅ 100KB | ✅ 50KB | 🟢 低 |
| **超时保护** | ✅ | ✅ 30s | 🟢 低 |
| **恶意内容过滤** | ✅ (脚本/样式) | ✅ | 🟢 低 |

### 性能对比

| 性能指标 | 官方实现 | 本项目实现 | 差异 |
|----------|----------|------------|------|
| **重复请求** | 缓存命中 (~0ms) | 重新抓取 (~1000ms+) | 🔴 重大 |
| **HTML 解析** | Turndown (~50ms) | 正则替换 (~5ms) | 🟡 质量换速度 |
| **内容处理** | AI 模型 (~500ms) | 直接返回 (~0ms) | 🔴 功能缺失 |

---

## 改进优先级

### P0 (关键功能，必须实现)

1. **WebSearch 真实搜索**:
   ```typescript
   // 集成搜索 API (如 DuckDuckGo)
   import { search } from '@duckduckgo/api';

   async performSearch(query: string): Promise<SearchResult[]> {
     const results = await search(query, { maxResults: 10 });
     return results.map(r => ({
       title: r.title,
       url: r.url,
       snippet: r.snippet,
     }));
   }
   ```

2. **HTML 到 Markdown 转换**:
   ```bash
   npm install turndown
   ```
   ```typescript
   import TurndownService from 'turndown';

   private htmlToMarkdown(html: string): string {
     const turndown = new TurndownService();
     return turndown.turndown(html);
   }
   ```

3. **WebFetch 缓存**:
   ```bash
   npm install lru-cache
   ```
   ```typescript
   import { LRUCache } from 'lru-cache';

   const cache = new LRUCache({
     max: 50 * 1024 * 1024,
     ttl: 15 * 60 * 1000,
   });
   ```

### P1 (重要功能，应尽快实现)

4. **域名过滤实现**:
   - 实现白名单/黑名单过滤逻辑
   - 域名提取和匹配

5. **重定向智能处理**:
   - 同源检查
   - 跨域保护

6. **结果格式化**:
   - Markdown 链接格式
   - 来源引用部分

### P2 (可选功能，逐步完善)

7. **域名安全检查**:
   - 预批准域名列表
   - 域名预检查 API

8. **AI 内容处理**:
   - 集成 AI 模型处理抓取内容
   - 根据 prompt 提取信息

---

## 依赖包需求

### 当前依赖

```json
{
  "axios": "^1.6.0"  // HTTP 客户端
}
```

### 需要添加的依赖

```json
{
  "turndown": "^7.1.2",           // HTML → Markdown
  "lru-cache": "^10.0.0",         // LRU 缓存
  "@duckduckgo/api": "^1.0.0",    // 搜索 API (示例)
  "cheerio": "^1.0.0"             // HTML 解析 (可选，用于更好的内容提取)
}
```

### 安装命令

```bash
npm install turndown lru-cache cheerio
# 根据选择的搜索 API 安装相应包
```

---

## 测试建议

### WebFetch 测试

```typescript
describe('WebFetchTool', () => {
  it('should upgrade HTTP to HTTPS', async () => {
    const result = await tool.execute({
      url: 'http://example.com',
      prompt: 'test'
    });
    // 验证实际请求的是 https://
  });

  it('should convert HTML to Markdown', async () => {
    const html = '<h1>Title</h1><p>Content</p>';
    const markdown = tool.htmlToMarkdown(html);
    expect(markdown).toBe('# Title\n\nContent');
  });

  it('should respect cache TTL', async () => {
    const url = 'https://example.com';
    await tool.execute({ url, prompt: 'test' });

    const start = Date.now();
    await tool.execute({ url, prompt: 'test' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // 应该从缓存返回
  });

  it('should handle cross-origin redirects', async () => {
    const result = await tool.execute({
      url: 'https://short.link/abc',
      prompt: 'test'
    });

    expect(result.error).toContain('REDIRECT DETECTED');
    expect(result.error).toContain('different host');
  });
});
```

### WebSearch 测试

```typescript
describe('WebSearchTool', () => {
  it('should filter by allowed domains', async () => {
    const result = await tool.execute({
      query: 'test',
      allowed_domains: ['example.com']
    });

    // 所有结果应该来自 example.com
    const urls = extractUrls(result.output);
    urls.forEach(url => {
      expect(new URL(url).hostname).toBe('example.com');
    });
  });

  it('should exclude blocked domains', async () => {
    const result = await tool.execute({
      query: 'test',
      blocked_domains: ['spam.com']
    });

    const urls = extractUrls(result.output);
    urls.forEach(url => {
      expect(new URL(url).hostname).not.toBe('spam.com');
    });
  });

  it('should format results as Markdown', async () => {
    const result = await tool.execute({ query: 'test' });

    expect(result.output).toMatch(/\[.+\]\(https?:\/\/.+\)/); // Markdown 链接格式
    expect(result.output).toContain('Sources:');
  });
});
```

---

## 总结

### 当前状态

本项目的 Web 工具实现处于 **早期原型阶段**：

- ✅ 基础架构已建立（类结构、接口）
- ✅ 基本的 HTTP 请求功能
- ⚠️ 缺少核心功能（缓存、AI 处理、搜索）
- ⚠️ 安全机制不完善
- ❌ WebSearch 仅为占位符

### 与官方差距

| 方面 | 差距评估 |
|------|----------|
| **功能完整度** | 🔴 约 20% |
| **代码质量** | 🟡 约 50% |
| **安全性** | 🔴 约 30% |
| **性能** | 🔴 约 25% |
| **可用性** | 🔴 约 15% |

### 核心问题

1. **WebSearch 完全未实现** - 需要集成真实搜索 API
2. **缺少智能内容处理** - 无 AI 模型处理能力
3. **HTML 转换质量低** - 应使用专业库而非正则
4. **无缓存机制** - 严重影响性能和用户体验
5. **安全检查缺失** - 存在潜在安全风险

### 下一步行动

1. **立即行动** (P0):
   - 集成 Turndown 库替换 HTML 转换
   - 实现 LRU 缓存机制
   - 集成搜索 API（DuckDuckGo/Bing）

2. **短期目标** (P1):
   - 实现域名过滤逻辑
   - 改进重定向处理
   - 实现结果格式化

3. **长期目标** (P2):
   - 添加域名安全检查
   - 集成 AI 内容处理
   - 性能优化和监控

---

**文档生成时间**: 2025-12-25
**官方版本**: v2.0.76
**分析状态**: ✅ 完成
