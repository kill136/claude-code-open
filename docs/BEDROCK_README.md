# AWS Bedrock 客户端文档中心

## 📚 文档导航

### 快速开始
- **[快速开始指南](./bedrock-quick-start.md)** - 5 分钟快速配置 Bedrock
  - 环境变量配置
  - 模型选择
  - 故障排查
  - 一键配置脚本

### 完整功能文档
- **[功能增强文档](./bedrock-enhancements.md)** - 完整功能说明
  - 所有新增功能详解
  - 配置示例
  - API 参考
  - 权限设置
  - 使用建议

### 实现总结
- **[实现总结](./bedrock-implementation-summary.md)** - 开发者参考
  - 任务完成情况
  - 测试结果
  - 代码质量评估
  - 新增函数列表
  - 未来改进建议

### 代码示例
- **[使用示例](./examples/bedrock-usage.ts)** - 实际代码示例
  - 12 个完整示例
  - 最佳实践演示
  - 错误处理示例
  - 配置检查工具

## 🎯 根据场景选择文档

### 我是新用户，想快速开始
👉 阅读 [快速开始指南](./bedrock-quick-start.md)

### 我想了解所有功能
👉 阅读 [功能增强文档](./bedrock-enhancements.md)

### 我是开发者，想了解实现细节
👉 阅读 [实现总结](./bedrock-implementation-summary.md)

### 我想看代码示例
👉 查看 [使用示例](./examples/bedrock-usage.ts)

## 📖 核心功能概览

### ✅ 已实现的 7 大功能

1. **AWS 凭证配置**
   - ACCESS_KEY_ID, SECRET_ACCESS_KEY, SESSION_TOKEN
   - 自动检测和验证

2. **区域配置**
   - 8 个可用区域
   - 区域验证和建议

3. **Model ARN 解析**
   - Foundation Model
   - Provisioned Model
   - Inference Profile

4. **跨区域推理**
   - 自动检测
   - 端点切换

5. **API 调用**
   - 官方 SDK 优先
   - Fallback 机制

6. **错误处理**
   - 友好错误消息
   - 8 种常见错误识别

7. **模型映射**
   - 别名支持（sonnet, opus, haiku）
   - 5 个 Claude 模型

## 🚀 快速链接

### 配置
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=true
```

### 运行
```bash
npm run dev
```

### 调试
```bash
export DEBUG=true
```

## 📊 支持的模型

| 模型 | 别名 | Bedrock ID |
|------|------|-----------|
| Claude Sonnet 4 | `sonnet-4` | `anthropic.claude-sonnet-4-20250514-v1:0` |
| Claude 3.5 Sonnet | `sonnet` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Claude 3.5 Haiku | `haiku-3.5` | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| Claude 3 Opus | `opus` | `anthropic.claude-3-opus-20240229-v1:0` |
| Claude 3 Haiku | `haiku` | `anthropic.claude-3-haiku-20240307-v1:0` |

## 🌍 支持的区域

- 🇺🇸 us-east-1 (N. Virginia) - 推荐
- 🇺🇸 us-west-2 (Oregon)
- 🇮🇪 eu-west-1 (Ireland)
- 🇫🇷 eu-west-3 (Paris)
- 🇩🇪 eu-central-1 (Frankfurt)
- 🇯🇵 ap-northeast-1 (Tokyo)
- 🇸🇬 ap-southeast-1 (Singapore)
- 🇦🇺 ap-southeast-2 (Sydney)

## 🔧 新增 API

### 核心函数
- `parseBedrockModelArn(input)` - 解析 ARN
- `getBedrockModelId(alias)` - 模型别名映射
- `createBedrockClient(config)` - 创建客户端
- `validateProviderConfig(config)` - 验证配置

### 辅助函数
- `getBedrockRegions()` - 获取区域列表
- `formatBedrockConfig(config)` - 格式化配置
- `handleBedrockError(error)` - 错误处理
- `createBedrockModelArn(...)` - 创建 ARN
- `getAvailableBedrockModels()` - 可用模型列表
- `testBedrockCredentials(config)` - 测试凭证

## 📝 示例代码

### 基础使用
```typescript
import { detectProvider, createClient } from './src/providers/index.js';

const config = detectProvider();
const client = createClient(config);
```

### ARN 解析
```typescript
import { parseBedrockModelArn } from './src/providers/index.js';

const arn = 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0';
const info = parseBedrockModelArn(arn);
console.log(info.modelId); // anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 配置验证
```typescript
import { validateProviderConfig } from './src/providers/index.js';

const validation = validateProviderConfig(config);
if (!validation.valid) {
  console.error(validation.errors);
}
```

## ⚠️ 常见问题

### Q: 如何获取 AWS 凭证？
**A:** 在 AWS IAM 控制台创建用户并生成访问密钥。

### Q: 需要什么 IAM 权限？
**A:** `bedrock:InvokeModel` 和 `bedrock:InvokeModelWithResponseStream`

### Q: 必须安装 Bedrock SDK 吗？
**A:** 不是必须，但强烈推荐。不安装会使用 fallback 机制，功能受限。

### Q: 如何启用跨区域推理？
**A:** 使用 inference-profile ARN，系统会自动检测。

### Q: 支持临时凭证吗？
**A:** 支持，设置 `AWS_SESSION_TOKEN` 即可。

## 🔐 安全最佳实践

1. ✅ 使用环境变量，不要硬编码凭证
2. ✅ 使用最小权限原则配置 IAM
3. ✅ 定期轮换访问密钥
4. ✅ 使用临时凭证（Session Token）
5. ✅ 不要在日志中输出敏感信息

## 📞 获取帮助

### 文档
- [AWS Bedrock 官方文档](https://docs.aws.amazon.com/bedrock/)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)

### 调试
```bash
# 启用详细日志
export DEBUG=true

# 检查配置
npm run dev -- --help
```

### 常见错误
参考 [功能增强文档](./bedrock-enhancements.md) 中的错误处理章节

## 🎓 学习路径

### 初级
1. 阅读快速开始指南
2. 配置环境变量
3. 运行第一个示例
4. 尝试不同模型

### 中级
1. 理解 ARN 格式
2. 配置跨区域推理
3. 自定义错误处理
4. 优化 IAM 权限

### 高级
1. 实现自动重试
2. 成本跟踪
3. 性能优化
4. 集成 CI/CD

## 📈 版本信息

- **实现版本**: 2.0.76
- **完成日期**: 2025-12-24
- **状态**: ✅ 生产就绪

## 🎉 总结

AWS Bedrock 客户端已完全完善，包括：
- 7 个核心功能
- 11 个新增函数
- 完整的文档
- 实用的示例
- 全面的错误处理

立即开始使用：[快速开始指南](./bedrock-quick-start.md)

---

**需要帮助？** 查看 [功能增强文档](./bedrock-enhancements.md) 或 [使用示例](./examples/bedrock-usage.ts)
