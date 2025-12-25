# Google Vertex AI Client Usage

这个文档说明如何使用新创建的 Google Vertex AI 客户端。

## 文件位置

- **主客户端**: `/home/user/claude-code-open/src/providers/vertex.ts`
- **导出位置**: `/home/user/claude-code-open/src/providers/index.ts`

## 功能特性

### 1. 多种认证方式

- **Service Account**: 通过 JSON 密钥文件认证
- **Authorized User**: 通过 OAuth2 refresh token 认证
- **Application Default Credentials (ADC)**: 自动从环境加载凭证

### 2. 自动 Token 管理

- Token 自动获取和缓存
- Token 过期前自动刷新
- 线程安全的 Token 管理

### 3. 完整的 API 支持

- 同步 API 调用 (`request`)
- 流式 API 调用 (`streamRequest`)
- 自动重试和指数退避
- 请求取消支持 (AbortSignal)

### 4. 错误处理

- 详细的错误信息
- 错误代码和状态码
- 智能重试策略（跳过 4xx 客户端错误）

## 配置方式

### 方式 1: 环境变量

```bash
# 必需
export ANTHROPIC_VERTEX_PROJECT_ID="your-gcp-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# 可选
export ANTHROPIC_VERTEX_REGION="us-central1"
export CLOUD_ML_REGION="us-central1"

# 启用 Vertex AI
export CLAUDE_CODE_USE_VERTEX="true"
```

### 方式 2: 代码配置

```typescript
import { VertexAIClient, createVertexAIClient } from './providers/vertex.js';

// 使用工厂函数（从环境加载）
const client = createVertexAIClient();

// 手动配置
const client = new VertexAIClient({
  projectId: 'your-gcp-project-id',
  region: 'us-central1',
  credentialsPath: '/path/to/service-account.json'
});

// 使用内联凭证
const client = new VertexAIClient({
  projectId: 'your-gcp-project-id',
  region: 'us-central1',
  credentials: {
    type: 'service_account',
    project_id: 'your-project',
    private_key_id: 'key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\n...',
    client_email: 'sa@project.iam.gserviceaccount.com',
    // ... 其他字段
  }
});
```

## 使用示例

### 基本用法

```typescript
import { createVertexAIClient, getVertexModelId } from './providers/vertex.js';

// 创建客户端
const client = createVertexAIClient({
  projectId: 'my-gcp-project',
  region: 'us-central1'
});

// 获取 Vertex 格式的模型 ID
const modelId = getVertexModelId('claude-3-5-sonnet'); // 'claude-3-5-sonnet-v2@20241022'

// 发送请求
const response = await client.request(modelId, {
  anthropic_version: 'vertex-2023-10-16',
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
  max_tokens: 1024
});

console.log(response);
```

### 流式请求

```typescript
// 使用流式 API
for await (const chunk of client.streamRequest(modelId, {
  anthropic_version: 'vertex-2023-10-16',
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
  max_tokens: 1024,
  stream: true
})) {
  console.log(chunk);
}
```

### 带重试的请求

```typescript
// 自动重试（最多 5 次）
const response = await client.request(
  modelId,
  requestBody,
  { maxRetries: 5 }
);
```

### 可取消的请求

```typescript
// 使用 AbortController 取消请求
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000); // 5秒后取消

try {
  const response = await client.request(
    modelId,
    requestBody,
    { signal: controller.signal }
  );
} catch (error) {
  if (error.message === 'Request aborted') {
    console.log('Request was cancelled');
  }
}
```

### Token 管理

```typescript
// 手动获取 access token
const token = await client.getAccessToken();
console.log('Access token:', token);

// 获取配置信息
console.log('Project ID:', client.getProjectId());
console.log('Region:', client.getRegion());

// 清理资源（取消 token 刷新定时器）
client.cleanup();
```

## 集成到现有代码

现有的 `providers/index.ts` 已经支持通过 `@anthropic-ai/vertex-sdk` 创建 Vertex AI 客户端：

```typescript
import { createClient, detectProvider } from './providers/index.js';

// 自动检测 provider
const provider = detectProvider();
if (provider.type === 'vertex') {
  console.log('Using Vertex AI');
}

// 创建客户端（自动使用 Vertex SDK 如果可用）
const anthropicClient = createClient(provider);
```

如果需要直接使用底层的 Vertex AI 客户端（不通过 Anthropic SDK）：

```typescript
import { createVertexAIClient } from './providers/vertex.js';

const vertexClient = createVertexAIClient();

// 使用原生 Vertex AI API
const response = await vertexClient.request('claude-3-5-sonnet-v2@20241022', {
  anthropic_version: 'vertex-2023-10-16',
  messages: [...],
  max_tokens: 1024
});
```

## 支持的模型

```typescript
import { VERTEX_MODELS, getVertexModelId } from './providers/vertex.js';

// 可用模型
console.log(VERTEX_MODELS);
// {
//   'claude-sonnet-4': 'claude-sonnet-4@20250514',
//   'claude-3-5-sonnet': 'claude-3-5-sonnet-v2@20241022',
//   'claude-3-opus': 'claude-3-opus@20240229',
//   'claude-3-haiku': 'claude-3-haiku@20240307',
//   'claude-3-5-haiku': 'claude-3-5-haiku@20241022'
// }

// 转换模型名称
const modelId = getVertexModelId('claude-3-5-sonnet');
console.log(modelId); // 'claude-3-5-sonnet-v2@20241022'
```

## 错误处理

```typescript
import { VertexAIError } from './providers/vertex.js';

try {
  const response = await client.request(modelId, body);
} catch (error) {
  if (error instanceof VertexAIError) {
    console.error('Vertex AI Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details
    });
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Service Account JSON 示例

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account%40project.iam.gserviceaccount.com"
}
```

## 注意事项

1. **认证**: 确保 Service Account 有足够的权限访问 Vertex AI API
2. **配额**: 注意 GCP 项目的 API 配额限制
3. **区域**: 不是所有区域都支持所有模型，常用区域：
   - `us-central1`
   - `us-east4`
   - `europe-west1`
   - `asia-southeast1`
4. **Token 过期**: Token 自动刷新，但建议在长时间运行的应用中监控错误
5. **资源清理**: 应用退出时调用 `client.cleanup()` 清理定时器

## 调试

启用详细日志：

```typescript
// 在代码中添加日志
const client = createVertexAIClient();

// 获取并打印 token（用于调试）
const token = await client.getAccessToken();
console.log('Token expires at:', new Date(Date.now() + 3600 * 1000));

// 检查端点 URL
const endpoint = client.getEndpoint('claude-3-5-sonnet-v2@20241022');
console.log('API Endpoint:', endpoint);
```

## 性能优化

1. **Token 缓存**: Token 会自动缓存和复用，避免频繁请求
2. **连接复用**: 考虑使用 HTTP keep-alive（未来可能添加）
3. **并发控制**: 根据配额限制控制并发请求数
4. **重试策略**: 根据实际情况调整 `maxRetries` 参数

## 故障排除

### 常见错误

1. **"No credentials available"**
   - 解决：设置 `GOOGLE_APPLICATION_CREDENTIALS` 环境变量

2. **"Project ID is required"**
   - 解决：设置 `ANTHROPIC_VERTEX_PROJECT_ID` 或 `GOOGLE_CLOUD_PROJECT`

3. **"Token request failed"**
   - 检查 Service Account JSON 格式
   - 确认 private_key 包含完整的 PEM 格式

4. **403 Forbidden**
   - 确认 Service Account 有 Vertex AI 权限
   - 检查项目是否启用了 Vertex AI API

5. **404 Not Found**
   - 确认区域支持所选模型
   - 检查模型 ID 格式是否正确
