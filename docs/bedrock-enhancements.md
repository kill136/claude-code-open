# AWS Bedrock 客户端增强完成

## 概述

已成功完善 `/home/user/claude-code-open/src/providers/index.ts` 中的 AWS Bedrock 客户端支持。

## 增强功能清单

### 1. ✅ AWS 凭证配置
- 支持 `AWS_ACCESS_KEY_ID`
- 支持 `AWS_SECRET_ACCESS_KEY`
- 支持 `AWS_SESSION_TOKEN` (用于临时凭证)
- 支持 `AWS_PROFILE` (AWS CLI 配置文件)
- 自动从环境变量读取凭证
- 凭证验证和错误提示

### 2. ✅ 区域配置
- 支持 `AWS_REGION` 环境变量
- 支持 `AWS_DEFAULT_REGION` 环境变量
- 默认区域：`us-east-1`
- 区域格式验证
- 提供所有可用 Bedrock 区域列表

### 3. ✅ Model ARN 解析
新增 `parseBedrockModelArn()` 函数，支持解析：
- Foundation Model ARN: `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`
- Provisioned Model ARN: `arn:aws:bedrock:us-west-2:123456789012:provisioned-model/my-model`
- Inference Profile ARN: `arn:aws:bedrock:us-east-1::inference-profile/profile-id`
- 纯模型 ID: `anthropic.claude-3-5-sonnet-20241022-v2:0`

解析结果包含：
```typescript
interface BedrockModelArn {
  region: string;
  accountId?: string;
  modelId: string;
  isFoundationModel: boolean;
  isCrossRegion: boolean;
}
```

### 4. ✅ 跨区域推理支持
- 新增 `crossRegionInference` 配置选项
- 自动检测 inference-profile ARN
- 跨区域端点构建：`https://bedrock-runtime.{region}.amazonaws.com/v1/inference-profiles`
- 在提供者信息中显示 "(Cross-Region)" 标识

### 5. ✅ 完整的 Bedrock Runtime API 调用
增强的 `createBedrockClient()` 函数：
- 优先使用官方 `@anthropic-ai/bedrock-sdk`
- 凭证验证（必须有 AccessKey 和 SecretKey）
- 区域验证
- Session Token 支持
- 自定义端点支持
- 详细的调试日志（通过 `DEBUG=true` 启用）
- 优雅降级（SDK 不可用时的 fallback）

### 6. ✅ 错误处理和重试机制
新增 `handleBedrockError()` 函数，提供友好的错误消息：
- `InvalidSignatureException` - 凭证无效
- `UnrecognizedClientException` - Access Key 不正确
- `AccessDeniedException` - 权限不足（需要 bedrock:InvokeModel）
- `ResourceNotFoundException` - 模型未找到
- `ThrottlingException` - 速率限制
- `ServiceUnavailableException` - 服务不可用
- `ValidationException` - 请求参数错误
- `ExpiredTokenException` - Session Token 过期

### 7. ✅ 模型 ID 映射
新增 `getBedrockModelId()` 函数，支持别名映射：

```typescript
// 短名称映射
'sonnet' → 'anthropic.claude-3-5-sonnet-20241022-v2:0'
'opus' → 'anthropic.claude-3-opus-20240229-v1:0'
'haiku' → 'anthropic.claude-3-haiku-20240307-v1:0'
'sonnet-4' → 'anthropic.claude-sonnet-4-20250514-v1:0'
'haiku-3.5' → 'anthropic.claude-3-5-haiku-20241022-v1:0'
```

## 新增函数列表

### 核心功能
1. **parseBedrockModelArn(input: string)**: 解析 Bedrock 模型 ARN
2. **getAwsCredentials()**: 从环境获取 AWS 凭证
3. **buildBedrockEndpoint(config)**: 构建 Bedrock API 端点
4. **createBedrockClient(config)**: 创建增强的 Bedrock 客户端

### 辅助功能
5. **getBedrockModelId(alias)**: 模型别名映射
6. **getAvailableBedrockModels(region?)**: 列出可用模型
7. **createBedrockModelArn(modelId, region, accountId?, isProvisioned?)**: 创建 ARN
8. **testBedrockCredentials(config)**: 测试凭证
9. **handleBedrockError(error)**: 错误处理
10. **getBedrockRegions()**: 获取所有可用区域
11. **formatBedrockConfig(config)**: 格式化配置信息用于显示

## 配置示例

### 基础配置（Foundation Model）
```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 使用 ARN
```bash
export AWS_BEDROCK_MODEL="arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
```

### 跨区域推理
```bash
export AWS_BEDROCK_MODEL="arn:aws:bedrock:us-east-1::inference-profile/eu.anthropic.claude-3-5-sonnet-20241022-v2:0"
```

### 使用 Session Token (临时凭证)
```bash
export AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEDo...
```

### 自定义端点
```bash
export ANTHROPIC_BEDROCK_BASE_URL=https://my-custom-endpoint.example.com
```

## 验证配置

使用增强的验证功能：

```typescript
import { validateProviderConfig, detectProvider } from './providers/index.js';

const config = detectProvider();
const validation = validateProviderConfig(config);

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

if (validation.warnings) {
  console.warn('Configuration warnings:', validation.warnings);
}
```

## 调试

启用调试日志：

```bash
export DEBUG=true
```

日志输出示例：
```
[Bedrock] Initialized with region: us-east-1, model: anthropic.claude-3-5-sonnet-20241022-v2:0
[Bedrock] Cross-region inference enabled
[Bedrock] Using endpoint: https://bedrock-runtime.us-east-1.amazonaws.com
```

## 配置信息显示

```typescript
import { formatBedrockConfig, detectProvider } from './providers/index.js';

const config = detectProvider();
console.log(formatBedrockConfig(config));
```

输出示例：
```
Provider: AWS Bedrock
Region: us-east-1
Model: anthropic.claude-3-5-sonnet-20241022-v2:0
Type: Foundation Model
Credentials: Configured
Session Token: Present
```

## 权限要求

IAM 策略示例：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude*",
        "arn:aws:bedrock:*:*:provisioned-model/*",
        "arn:aws:bedrock:*::inference-profile/*"
      ]
    }
  ]
}
```

## 支持的 Bedrock 区域

- us-east-1 (US East - N. Virginia)
- us-west-2 (US West - Oregon)
- eu-west-1 (Europe - Ireland)
- eu-west-3 (Europe - Paris)
- eu-central-1 (Europe - Frankfurt)
- ap-northeast-1 (Asia Pacific - Tokyo)
- ap-southeast-1 (Asia Pacific - Singapore)
- ap-southeast-2 (Asia Pacific - Sydney)

## 可用的 Claude 模型

1. **Claude Sonnet 4** (最新)
   - `anthropic.claude-sonnet-4-20250514-v1:0`

2. **Claude 3.5 Sonnet V2** (推荐)
   - `anthropic.claude-3-5-sonnet-20241022-v2:0`

3. **Claude 3.5 Haiku**
   - `anthropic.claude-3-5-haiku-20241022-v1:0`

4. **Claude 3 Opus**
   - `anthropic.claude-3-opus-20240229-v1:0`

5. **Claude 3 Haiku**
   - `anthropic.claude-3-haiku-20240307-v1:0`

## 注意事项

1. **SDK 安装**: 强烈建议安装官方 SDK 以获得完整功能
   ```bash
   npm install @anthropic-ai/bedrock-sdk
   ```

2. **凭证安全**: 切勿在代码中硬编码凭证，使用环境变量或 AWS 配置文件

3. **区域可用性**: 并非所有模型在所有区域都可用，请查阅 AWS Bedrock 文档

4. **速率限制**: Bedrock 有不同的速率限制，建议实现重试逻辑

5. **成本**: Bedrock 按使用量计费，跨区域推理可能产生额外费用

## 迁移指南

### 从 Anthropic API 迁移到 Bedrock

```bash
# 之前
export ANTHROPIC_API_KEY=sk-ant-...

# 之后
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

代码无需修改，自动检测并切换到 Bedrock。

## 相关文件

- `/home/user/claude-code-open/src/providers/index.ts` - 主实现文件
- `/home/user/claude-code-open/src/config/index.ts` - 配置系统
- `/home/user/claude-code-open/src/diagnostics/index.ts` - 诊断工具

## 测试建议

1. 验证凭证配置
2. 测试不同区域
3. 测试不同模型
4. 测试 ARN 解析
5. 测试错误处理
6. 测试跨区域推理
7. 测试 Session Token

## 未来改进

- [ ] 添加 AWS STS AssumeRole 支持
- [ ] 添加 Bedrock 模型列表 API 调用
- [ ] 实现自动重试机制
- [ ] 添加成本跟踪
- [ ] 支持 Bedrock Agent Runtime
- [ ] 支持 Provisioned Throughput
