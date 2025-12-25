# Provider CLI Documentation

增强的Provider管理命令行工具,用于管理不同的API提供商配置。

## 文件位置

`/home/user/claude-code-open/src/providers/cli.ts`

## 代码统计

- **总行数**: 579 行
- **语言**: TypeScript
- **依赖**: Commander.js, chalk, 现有Provider系统

## 功能列表

### 1. Provider 列表 (list)

```bash
claude provider list
```

显示所有支持的Provider:
- Anthropic API (官方API)
- AWS Bedrock (AWS托管服务)
- Google Vertex AI (GCP托管服务)
- Anthropic Foundry (实验性)

### 2. Provider 状态 (status)

```bash
claude provider status
```

显示当前Provider的:
- 提供商类型和名称
- 使用的模型
- 区域信息
- 端点URL
- 配置验证结果
- 警告信息

### 3. Provider 切换 (use)

```bash
# 切换到AWS Bedrock
claude provider use bedrock

# 切换到Vertex AI并指定区域
claude provider use vertex --region us-central1 --project my-project

# 切换到Anthropic API并指定模型
claude provider use anthropic --model sonnet
```

### 4. Provider 测试 (test)

```bash
# 测试当前Provider
claude provider test

# 测试特定Provider
claude provider test bedrock
claude provider test vertex
```

执行以下检查:
- 配置验证
- 凭证验证
- 连接测试
- 令牌获取(对于Vertex AI)

### 5. Provider 配置 (config)

```bash
# 显示当前Provider配置
claude provider config

# 显示特定Provider配置
claude provider config bedrock
```

### 6. AWS Bedrock 管理

#### 设置向导 (bedrock setup)

```bash
claude provider bedrock setup
```

显示交互式设置指南,说明需要配置的环境变量。

#### 区域列表 (bedrock regions)

```bash
claude provider bedrock regions
```

显示所有可用的AWS Bedrock区域:
- us-east-1 (N. Virginia)
- us-west-2 (Oregon)
- eu-west-1 (Ireland)
- ap-northeast-1 (Tokyo)
- 等等...

#### 模型列表 (bedrock models)

```bash
claude provider bedrock models
claude provider bedrock models us-east-1
```

显示可用的Claude模型:
- anthropic.claude-sonnet-4-20250514-v1:0
- anthropic.claude-3-5-sonnet-20241022-v2:0
- anthropic.claude-3-5-haiku-20241022-v1:0
- 等等...

### 7. Google Vertex AI 管理

#### 设置向导 (vertex setup)

```bash
claude provider vertex setup
```

显示Vertex AI设置指南。

#### 项目列表 (vertex projects)

```bash
claude provider vertex projects
```

显示已配置的GCP项目。

#### 区域列表 (vertex regions)

```bash
claude provider vertex regions
```

显示可用的Vertex AI区域:
- us-central1 (Iowa)
- us-east4 (Northern Virginia)
- europe-west1 (Belgium)
- asia-southeast1 (Singapore)
- 等等...

#### 模型列表 (vertex models)

```bash
claude provider vertex models
```

显示Vertex AI上可用的Claude模型。

### 8. Provider 诊断 (diagnose)

```bash
claude provider diagnose
```

运行完整诊断检查:
- Provider自动检测
- 环境变量检查
- 配置验证
- 警告和错误信息

## 环境变量配置

### Anthropic API

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### AWS Bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0  # 可选
```

### Google Vertex AI

```bash
export CLAUDE_CODE_USE_VERTEX=true
export ANTHROPIC_VERTEX_PROJECT_ID=my-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export ANTHROPIC_VERTEX_REGION=us-central1  # 可选
```

### Anthropic Foundry

```bash
export CLAUDE_CODE_USE_FOUNDRY=true
export ANTHROPIC_FOUNDRY_API_KEY=xxx
```

## 配置文件

Provider配置存储在 `~/.claude/settings.json`:

```json
{
  "provider": "bedrock",
  "providerRegion": "us-east-1",
  "model": "claude-3-5-sonnet",
  "CLAUDE_CODE_USE_BEDROCK": "true"
}
```

## 使用示例

### 场景1: 设置AWS Bedrock

```bash
# 1. 配置环境变量
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=xxx

# 2. 查看可用区域和模型
claude provider bedrock regions
claude provider bedrock models

# 3. 切换到Bedrock
claude provider use bedrock --region us-east-1

# 4. 测试连接
claude provider test bedrock

# 5. 查看状态
claude provider status
```

### 场景2: 设置Google Vertex AI

```bash
# 1. 配置环境变量
export ANTHROPIC_VERTEX_PROJECT_ID=my-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=~/service-account.json

# 2. 查看可用区域
claude provider vertex regions

# 3. 切换到Vertex AI
claude provider use vertex --region us-central1 --project my-gcp-project

# 4. 测试连接
claude provider test vertex

# 5. 查看状态
claude provider status
```

### 场景3: 诊断问题

```bash
# 运行完整诊断
claude provider diagnose

# 查看当前配置
claude provider config

# 查看详细状态
claude provider status
```

## 集成到主CLI

要将Provider命令集成到主CLI程序中,在 `src/cli.ts` 中添加:

```typescript
import { createProviderCommand } from './providers/cli.js';

// 在program.addCommand()部分添加
program.addCommand(createProviderCommand());
```

## 实现特点

1. **完整的Provider支持**: 支持所有4种Provider类型
2. **交互式体验**: 彩色输出,清晰的状态展示
3. **配置验证**: 自动验证配置并提供详细错误信息
4. **环境变量集成**: 自动检测环境变量配置
5. **配置持久化**: 保存到 ~/.claude/settings.json
6. **诊断工具**: 全面的诊断和故障排查
7. **区域/模型管理**: 列出可用的区域和模型
8. **连接测试**: 验证凭证和连接

## 技术实现

- 使用 Commander.js 构建子命令结构
- 集成现有的Provider系统 (`src/providers/index.ts`)
- 使用 chalk 提供彩色终端输出
- 配置文件使用JSON格式存储
- 完整的TypeScript类型支持
- 异步操作支持(测试连接等)

## 未来扩展

可能的增强功能:
- [ ] 延迟测试和性能基准
- [ ] 配额使用情况检查
- [ ] 成本估算工具
- [ ] 批量Provider配置
- [ ] Provider切换历史
- [ ] 配置导入/导出
- [ ] 交互式配置向导(使用inquirer)
