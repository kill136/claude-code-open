# AWS Bedrock 快速开始指南

## 5 分钟快速配置

### 1. 安装 Bedrock SDK（推荐）

```bash
npm install @anthropic-ai/bedrock-sdk
```

### 2. 配置环境变量

```bash
# AWS 凭证（必需）
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key

# 区域（必需）
export AWS_REGION=us-east-1

# 启用 Bedrock（必需）
export CLAUDE_CODE_USE_BEDROCK=true

# 模型选择（可选，默认为 Sonnet 3.5）
export AWS_BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 3. 运行

```bash
npm run dev
# 或
npm run build && npm start
```

## 常用模型别名

```bash
# 使用短名称（推荐）
export AWS_BEDROCK_MODEL=sonnet          # Claude 3.5 Sonnet V2
export AWS_BEDROCK_MODEL=sonnet-4        # Claude Sonnet 4
export AWS_BEDROCK_MODEL=opus            # Claude 3 Opus
export AWS_BEDROCK_MODEL=haiku           # Claude 3 Haiku
export AWS_BEDROCK_MODEL=haiku-3.5       # Claude 3.5 Haiku

# 使用完整 ID
export AWS_BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0

# 使用 ARN
export AWS_BEDROCK_MODEL="arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
```

## 验证配置

```bash
# 启用调试日志
export DEBUG=true

# 运行
npm run dev
```

查看日志输出：
```
[Bedrock] Initialized with region: us-east-1, model: anthropic.claude-3-5-sonnet-20241022-v2:0
[Bedrock] Using endpoint: https://bedrock-runtime.us-east-1.amazonaws.com
```

## 故障排查

### 错误：AWS credentials are required

**解决方案：**
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

### 错误：AWS region is required

**解决方案：**
```bash
export AWS_REGION=us-east-1
# 或
export AWS_DEFAULT_REGION=us-east-1
```

### 错误：Access Denied

**检查 IAM 权限：**
确保你的 IAM 用户/角色有以下权限：
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude*"
}
```

### 警告：Bedrock SDK not found

**解决方案：**
```bash
npm install @anthropic-ai/bedrock-sdk
```

不安装 SDK 也可以运行，但功能受限。

## 高级配置

### 临时凭证（Session Token）

```bash
export AWS_ACCESS_KEY_ID=ASIATEMP...
export AWS_SECRET_ACCESS_KEY=temp_secret
export AWS_SESSION_TOKEN=IQoJb3JpZ2luX...
```

### 跨区域推理

```bash
export AWS_BEDROCK_MODEL="arn:aws:bedrock:us-east-1::inference-profile/eu.anthropic.claude-3-5-sonnet-20241022-v2:0"
```

### 自定义端点

```bash
export ANTHROPIC_BEDROCK_BASE_URL=https://vpce-xxx.bedrock-runtime.us-east-1.vpce.amazonaws.com
```

### AWS Profile

```bash
export AWS_PROFILE=my-profile
```

## 推荐区域

**最低延迟：**
- 美国：`us-east-1` (N. Virginia)
- 欧洲：`eu-west-1` (Ireland)
- 亚太：`ap-northeast-1` (Tokyo)

**模型可用性最佳：**
- `us-east-1`
- `us-west-2`

## 一键配置脚本

创建 `setup-bedrock.sh`：

```bash
#!/bin/bash

# AWS 凭证配置
export AWS_ACCESS_KEY_ID="${1:-your_access_key}"
export AWS_SECRET_ACCESS_KEY="${2:-your_secret_key}"
export AWS_REGION="${3:-us-east-1}"

# Bedrock 配置
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_BEDROCK_MODEL="anthropic.claude-3-5-sonnet-20241022-v2:0"

# 启用调试（可选）
# export DEBUG=true

echo "✓ Bedrock 配置完成"
echo "  Region: $AWS_REGION"
echo "  Model: $AWS_BEDROCK_MODEL"

# 运行 Claude Code
npm run dev
```

使用：
```bash
chmod +x setup-bedrock.sh
./setup-bedrock.sh YOUR_ACCESS_KEY YOUR_SECRET_KEY us-east-1
```

## 成本估算

Claude 3.5 Sonnet 在 Bedrock 的定价（以 us-east-1 为例）：
- 输入：$3.00 / 百万 tokens
- 输出：$15.00 / 百万 tokens

示例对话成本：
- 1000 tokens 输入 + 500 tokens 输出 ≈ $0.01

## 下一步

- 阅读完整文档：[bedrock-enhancements.md](./bedrock-enhancements.md)
- 查看 IAM 策略示例
- 了解跨区域推理
- 探索 Provisioned Throughput 选项

## 快速检查清单

- [ ] AWS 凭证已配置
- [ ] AWS 区域已设置
- [ ] `CLAUDE_CODE_USE_BEDROCK=true` 已设置
- [ ] Bedrock SDK 已安装（推荐）
- [ ] IAM 权限已配置
- [ ] 选择了合适的模型
- [ ] 测试连接成功

## 获取帮助

如果遇到问题：
1. 检查环境变量是否正确设置
2. 启用 `DEBUG=true` 查看详细日志
3. 验证 IAM 权限
4. 确认模型在选择的区域可用
5. 查看 AWS Bedrock 控制台
