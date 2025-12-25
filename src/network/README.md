# 网络模块

本模块提供网络功能支持，包括代理、超时控制和重试策略。

## 功能特性

### 代理支持 (T368-T371)

- ✅ **HTTP 代理** - 支持 HTTP_PROXY 环境变量
- ✅ **HTTPS 代理** - 支持 HTTPS_PROXY 环境变量
- ✅ **SOCKS 代理** - 支持 SOCKS4/SOCKS5 协议
- ✅ **NO_PROXY** - 支持绕过代理的域名列表
- ✅ **代理认证** - 支持用户名/密码认证（Basic Auth）
- ✅ **自动检测** - 使用 `proxy-from-env` 自动检测系统代理

### 超时控制 (T374, T376)

- ✅ **连接超时** - 配置连接建立的超时时间
- ✅ **请求超时** - 配置完整请求的超时时间
- ✅ **AbortSignal** - 支持标准的请求取消机制

### 重试策略 (T375, T377)

- ✅ **指数退避** - 自动增加重试延迟
- ✅ **抖动** - 避免惊群效应
- ✅ **错误识别** - 自动判断错误是否可重试
- ✅ **可配置** - 灵活的重试配置选项

## 使用示例

### 1. 使用环境变量配置代理

```bash
# 设置代理环境变量
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1,*.local

# 启动应用（自动使用代理）
node dist/cli.js
```

### 2. 在 ClaudeClient 中使用代理

```typescript
import { ClaudeClient } from './core/client.js';

const client = new ClaudeClient({
  apiKey: 'your-api-key',
  // 代理配置
  proxy: {
    https: 'http://proxy.example.com:8080',
    noProxy: ['localhost', '*.internal.com'],
  },
  // 超时配置
  timeout: {
    connect: 30000,
    request: 120000,
  },
  debug: true, // 启用调试日志
});
```

### 3. SOCKS 代理

```typescript
const client = new ClaudeClient({
  apiKey: 'your-api-key',
  proxy: {
    socks: 'socks5://127.0.0.1:1080',
  },
});
```

### 4. 带认证的代理

```typescript
// 方式1：在 URL 中包含认证信息
const client = new ClaudeClient({
  proxy: {
    https: 'http://user:pass@proxy.example.com:8080',
  },
});

// 方式2：单独配置认证
const client = new ClaudeClient({
  proxy: {
    https: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass',
  },
});
```

### 5. 直接使用代理工具

```typescript
import { createProxyAgent, getProxyInfo } from './network/index.js';

// 创建代理 Agent
const targetUrl = 'https://api.anthropic.com';
const agent = createProxyAgent(
  targetUrl,
  {
    https: 'http://proxy.example.com:8080',
    noProxy: ['localhost'],
  },
  {
    timeout: 30000,
    keepAlive: true,
  }
);

// 获取代理信息（调试）
const proxyInfo = getProxyInfo(targetUrl, {
  https: 'http://proxy.example.com:8080',
});
console.log(proxyInfo);
// { enabled: true, proxyUrl: 'http://proxy.example.com:8080', bypassed: false }
```

### 6. 使用重试策略

```typescript
import { withRetry } from './network/index.js';

const result = await withRetry(
  async () => {
    // 你的异步操作
    return await fetchData();
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    exponentialBackoff: true,
    jitter: 0.1,
  },
  (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt}, waiting ${delay}ms`);
  }
);
```

### 7. 超时控制

```typescript
import { createTimeoutSignal, withTimeout } from './network/index.js';

// 方式1：使用 AbortSignal
const signal = createTimeoutSignal(5000);
const response = await fetch('https://api.example.com', { signal });

// 方式2：使用 withTimeout 包装
const result = await withTimeout(
  fetchData(),
  5000,
  'Fetch timed out after 5 seconds'
);
```

## 环境变量

支持以下环境变量：

| 变量名 | 说明 | 示例 |
|-------|------|------|
| `HTTP_PROXY` / `http_proxy` | HTTP 代理 URL | `http://proxy:8080` |
| `HTTPS_PROXY` / `https_proxy` | HTTPS 代理 URL | `https://proxy:8080` |
| `ALL_PROXY` / `all_proxy` | 所有协议的代理（通常是 SOCKS） | `socks5://127.0.0.1:1080` |
| `NO_PROXY` / `no_proxy` | 绕过代理的域名列表（逗号分隔） | `localhost,*.local` |

## 与官方对齐

本实现参考了官方 `@anthropic-ai/claude-code` v2.0.76 的代理实现：

| 功能 | 本项目 | 官方 |
|------|--------|------|
| HTTP/HTTPS 代理 | ✅ | ✅ |
| SOCKS 代理 | ✅ | ✅ |
| 代理认证 | ✅ | ✅ |
| NO_PROXY | ✅ | ✅ |
| 环境变量支持 | ✅ | ✅ |
| 超时配置 | ✅ | ✅ |
| 重试策略 | ✅ | ✅ |

## 依赖包

本模块使用以下 npm 包：

- `https-proxy-agent` - HTTPS 代理支持
- `http-proxy-agent` - HTTP 代理支持
- `socks-proxy-agent` - SOCKS 代理支持
- `proxy-from-env` - 自动检测环境变量中的代理配置

## 实现细节

### 代理选择逻辑

1. 检查是否应该绕过代理（NO_PROXY）
2. 如果启用了 `useSystemProxy`，使用 `proxy-from-env` 自动检测
3. 否则根据目标 URL 选择合适的代理：
   - HTTPS URL → 使用 `https` 或 `http` 代理
   - HTTP URL → 使用 `http` 代理
   - SOCKS 优先级最高

### 认证处理

- 从代理 URL 中解析用户名和密码（`http://user:pass@proxy:port`）
- 支持单独配置 `username` 和 `password`
- 自动进行 URL 编码/解码
- 生成 `Proxy-Authorization` 头（Basic Auth）

### NO_PROXY 匹配规则

- `*` - 匹配所有域名
- `example.com` - 精确匹配
- `*.example.com` - 通配符匹配
- `.example.com` - 后缀匹配

## 未来扩展

以下功能可在后续版本中实现：

- **连接池管理** (T376) - Keep-alive 和最大连接数控制
- **网络诊断** (T378) - 连接测试和延迟检测
- **带宽限制** (T379) - 速率限制
- **PAC 文件支持** (T373) - 自动代理配置
- **NTLM 认证** - Windows 代理认证

## 类型定义

完整的类型定义请参考：
- `./proxy.ts` - 代理相关类型
- `./timeout.ts` - 超时相关类型
- `./retry.ts` - 重试相关类型
