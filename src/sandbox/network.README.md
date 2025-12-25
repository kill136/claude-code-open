# Network Sandbox

网络沙箱模块，提供网络请求的过滤、监控和限制功能。

## 功能特性

### 1. 域名过滤
- 支持白名单（allowedDomains）和黑名单（deniedDomains）
- 支持通配符模式匹配：
  - `example.com` - 精确匹配
  - `*.example.com` - 匹配所有子域名
  - `**.example.com` - 匹配域名本身及所有子域名
  - `*` - 匹配所有域名

### 2. 端口限制
- 允许端口白名单（allowedPorts）
- 拒绝端口黑名单（deniedPorts）
- 默认允许：80, 443, 8080, 8443

### 3. 协议限制
- 支持协议过滤（allowedProtocols）
- 默认允许：http:, https:

### 4. 流量监控
- 记录所有网络请求（可配置）
- 统计请求数量、域名访问、端口使用
- 支持导出日志为 JSON

### 5. 速率限制
- 可配置每分钟最大请求数（maxRequestsPerMinute）
- 自动清理过期的时间戳

## 使用示例

### 基本使用

```typescript
import { NetworkSandbox } from './sandbox/network.js';

// 创建沙箱实例
const sandbox = new NetworkSandbox({
  allowedDomains: ['api.github.com', '*.anthropic.com'],
  allowedPorts: [80, 443],
  allowedProtocols: ['http:', 'https:'],
  maxRequestsPerMinute: 60,
  enableLogging: true,
});

// 检查请求是否允许
const allowed = sandbox.isRequestAllowed('https://api.github.com/users');
console.log('Request allowed:', allowed);
```

### 使用预设配置

```typescript
import {
  createRestrictiveSandbox,
  createPermissiveSandbox,
  createUnrestrictedSandbox,
} from './sandbox/network.js';

// 1. 严格沙箱（白名单模式）
const restrictive = createRestrictiveSandbox([
  'api.github.com',
  '*.anthropic.com',
]);

// 2. 宽松沙箱（黑名单模式）
const permissive = createPermissiveSandbox([
  '*.malicious.com',
  'dangerous.net',
]);

// 3. 无限制沙箱（用于测试）
const unrestricted = createUnrestrictedSandbox();
```

### 包装 Fetch API

```typescript
const sandbox = new NetworkSandbox({
  allowedDomains: ['api.github.com'],
});

// 包装原生 fetch
const safeFetch = sandbox.wrapFetch();

// 使用包装后的 fetch（会自动检查权限）
try {
  const response = await safeFetch('https://api.github.com/users');
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Request denied:', error.message);
}
```

### 包装 HTTP/HTTPS 模块

```typescript
const sandbox = new NetworkSandbox({
  allowedDomains: ['example.com'],
});

// 包装 http 模块
const { request, get } = sandbox.wrapHttp();

// 使用包装后的 request
const req = request('https://example.com/api', (res) => {
  console.log('Status:', res.statusCode);
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
});

req.end();
```

### 查看统计信息

```typescript
const sandbox = new NetworkSandbox({
  enableLogging: true,
});

// 发送一些请求...
// ...

// 获取统计信息
const stats = sandbox.getStats();
console.log('Total requests:', stats.totalRequests);
console.log('Allowed:', stats.allowedRequests);
console.log('Denied:', stats.deniedRequests);
console.log('Requests per minute:', stats.requestsPerMinute);
console.log('Top domains:', stats.topDomains);
console.log('Top ports:', stats.topPorts);
console.log('Protocol breakdown:', stats.protocolBreakdown);
```

### 导出日志

```typescript
const sandbox = new NetworkSandbox({
  enableLogging: true,
});

// 导出所有日志和统计信息
const logs = sandbox.exportLogs();
console.log(logs);

// 或者获取特定数量的请求日志
const recentLogs = sandbox.getRequestLog(100); // 最近 100 条
```

### 域名匹配工具

```typescript
import { matchDomainPattern } from './sandbox/network.js';

// 精确匹配
matchDomainPattern('example.com', 'example.com'); // true
matchDomainPattern('api.example.com', 'example.com'); // false

// 子域名匹配
matchDomainPattern('api.example.com', '*.example.com'); // true
matchDomainPattern('example.com', '*.example.com'); // false

// 域名及子域名匹配
matchDomainPattern('example.com', '**.example.com'); // true
matchDomainPattern('api.example.com', '**.example.com'); // true

// 匹配所有
matchDomainPattern('anything.com', '*'); // true
```

### URL 解析

```typescript
import { parseUrl } from './sandbox/network.js';

const parsed = parseUrl('https://api.example.com:8443/v1/users?page=1#top');
console.log(parsed);
// {
//   protocol: 'https:',
//   hostname: 'api.example.com',
//   port: 8443,
//   pathname: '/v1/users',
//   search: '?page=1',
//   hash: '#top',
//   href: 'https://api.example.com:8443/v1/users?page=1#top'
// }
```

### 动态更新策略

```typescript
const sandbox = new NetworkSandbox({
  allowedDomains: ['example.com'],
});

// 更新策略
sandbox.updatePolicy({
  allowedDomains: ['example.com', 'api.github.com'],
  maxRequestsPerMinute: 120,
});

// 获取当前策略
const currentPolicy = sandbox.getPolicy();
console.log(currentPolicy);
```

### 清除日志

```typescript
const sandbox = new NetworkSandbox({
  enableLogging: true,
});

// 清除所有日志和统计信息
sandbox.clearLogs();
```

## API 参考

### NetworkPolicy

```typescript
interface NetworkPolicy {
  allowedDomains: string[];      // 允许的域名列表（支持通配符）
  deniedDomains: string[];       // 拒绝的域名列表（支持通配符）
  allowedPorts: number[];        // 允许的端口列表
  deniedPorts: number[];         // 拒绝的端口列表
  allowedProtocols: string[];    // 允许的协议列表
  maxRequestsPerMinute?: number; // 每分钟最大请求数
  enableLogging?: boolean;       // 是否启用日志记录
}
```

### NetworkSandbox

```typescript
class NetworkSandbox {
  constructor(policy: Partial<NetworkPolicy>);

  // 策略管理
  updatePolicy(policy: Partial<NetworkPolicy>): void;
  getPolicy(): NetworkPolicy;

  // 权限检查
  isRequestAllowed(url: string): boolean;
  isDomainAllowed(domain: string): boolean;
  isPortAllowed(port: number): boolean;
  isProtocolAllowed(protocol: string): boolean;

  // 包装网络 API
  wrapFetch(): typeof fetch;
  wrapHttp(): SandboxedHttp;

  // 日志和统计
  getRequestLog(limit?: number): NetworkRequest[];
  getStats(): NetworkStats;
  clearLogs(): void;
  exportLogs(): string;
}
```

### 辅助函数

```typescript
// URL 解析
function parseUrl(urlString: string): ParsedUrl;

// 域名模式匹配
function matchDomainPattern(domain: string, pattern: string): boolean;

// 创建预设沙箱
function createRestrictiveSandbox(allowedDomains: string[]): NetworkSandbox;
function createPermissiveSandbox(deniedDomains?: string[]): NetworkSandbox;
function createUnrestrictedSandbox(): NetworkSandbox;
```

## 使用场景

### 1. API 网关场景

```typescript
// 只允许访问特定的 API 服务
const apiGateway = new NetworkSandbox({
  allowedDomains: [
    'api.github.com',
    'api.anthropic.com',
    '*.googleapis.com',
  ],
  allowedPorts: [443],
  allowedProtocols: ['https:'],
  maxRequestsPerMinute: 100,
});
```

### 2. 开发环境隔离

```typescript
// 防止本地开发访问生产环境
const devSandbox = new NetworkSandbox({
  deniedDomains: [
    '*.production.com',
    'prod-api.example.com',
  ],
  allowedPorts: [80, 443, 3000, 8080],
});
```

### 3. 安全测试环境

```typescript
// 严格限制所有外部访问
const testSandbox = createRestrictiveSandbox([
  'localhost',
  '127.0.0.1',
  '*.test.local',
]);
```

### 4. 速率限制

```typescript
// 防止 API 滥用
const rateLimiter = new NetworkSandbox({
  maxRequestsPerMinute: 30,
  enableLogging: true,
});
```

## 注意事项

1. **性能影响**：启用日志记录会占用内存，建议在生产环境中定期清理日志或关闭日志记录。

2. **通配符优先级**：拒绝列表（deniedDomains）的检查优先于允许列表（allowedDomains）。

3. **端口默认值**：如果 URL 中没有指定端口，会使用协议的默认端口（http: 80, https: 443）。

4. **日志限制**：请求日志最多保存 10000 条，超过后会自动删除最旧的记录。

5. **速率限制**：速率限制基于时间窗口（1分钟），使用滑动窗口算法。

## 性能优化建议

1. 使用具体的域名而不是通配符可以提高匹配速度
2. 定期调用 `clearLogs()` 清理日志以减少内存占用
3. 在不需要统计时设置 `enableLogging: false`
4. 使用黑名单模式比白名单模式更灵活但安全性较低

## 测试

运行示例代码：

```bash
npx tsx src/sandbox/network.example.ts
```

## 许可证

本模块是 Claude Code 项目的一部分。
