# 配置系统增强文档

## 概述

增强版配置系统提供了以下功能：

1. **Zod Schema 验证** - 严格的类型验证和数据校验
2. **环境变量解析** - 支持布尔值和数字类型的智能转换
3. **配置文件加载** - 支持全局和项目级配置
4. **配置合并** - 正确的优先级处理
5. **配置迁移** - 自动版本升级
6. **配置导出/导入** - 支持备份和恢复
7. **敏感信息掩码** - 导出时自动掩码
8. **配置热重载** - 监听文件变化

## 配置优先级

从低到高：

1. **默认配置** - 内置的默认值
2. **全局配置** - `~/.claude/settings.json`
3. **项目配置** - `.claude/settings.json`
4. **环境变量** - 系统环境变量
5. **命令行参数** - CLI 参数（最高）

## 配置文件示例

### 全局配置 (~/.claude/settings.json)

```json
{
  "version": "2.0.76",
  "apiKey": "sk-ant-api03-xxx",
  "model": "sonnet",
  "maxTokens": 8192,
  "temperature": 1,
  "theme": "dark",
  "verbose": false,
  "enableTelemetry": false,
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    }
  }
}
```

### 项目配置 (.claude/settings.json)

```json
{
  "model": "opus",
  "maxTokens": 16384,
  "verbose": true,
  "defaultWorkingDir": "/home/user/my-project",
  "allowedTools": ["Bash", "Read", "Write", "Edit"],
  "systemPrompt": "You are a helpful coding assistant for this React project."
}
```

## 环境变量

支持的环境变量：

```bash
# API 配置
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"
export CLAUDE_API_KEY="sk-ant-api03-xxx"
export CLAUDE_CODE_OAUTH_TOKEN="oauth_token_xxx"

# 后端选择
export CLAUDE_CODE_USE_BEDROCK="true"
export CLAUDE_CODE_USE_VERTEX="false"

# 功能配置
export CLAUDE_CODE_MAX_OUTPUT_TOKENS="16384"
export CLAUDE_CODE_MAX_RETRIES="5"
export CLAUDE_CODE_DEBUG_LOGS_DIR="/var/log/claude"

# 功能开关
export CLAUDE_CODE_ENABLE_TELEMETRY="false"
export CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING="true"
```

### 布尔值解析

环境变量中的布尔值支持以下格式：
- `true`, `1`, `yes` → `true`
- `false`, `0`, `no` → `false`

## 使用示例

### 基本使用

```typescript
import { configManager } from './config/index.js';

// 获取配置项
const apiKey = configManager.getApiKey();
const model = configManager.get('model');
const maxTokens = configManager.get('maxTokens');

// 设置配置项
configManager.set('verbose', true);
configManager.set('theme', 'dark');

// 获取所有配置
const allConfig = configManager.getAll();
console.log(allConfig);
```

### 项目级配置

```typescript
// 保存到项目配置
configManager.saveProject({
  model: 'opus',
  maxTokens: 16384,
  systemPrompt: 'Custom prompt for this project'
});
```

### 配置验证

```typescript
// 验证当前配置
const validation = configManager.validate();
if (!validation.valid) {
  console.error('配置验证失败:', validation.errors);
}
```

### 配置导出/导入

```typescript
// 导出配置（掩码敏感信息）
const maskedConfig = configManager.export(true);
console.log(maskedConfig);
// 输出: { "apiKey": "sk-a***-03", ... }

// 导出配置（不掩码）
const fullConfig = configManager.export(false);

// 导入配置
const success = configManager.import(fullConfig);
if (success) {
  console.log('配置导入成功');
}
```

### 配置热重载

```typescript
// 监听配置变化
configManager.watch((newConfig) => {
  console.log('配置已更新:', newConfig);
  // 在这里重新初始化依赖配置的组件
});

// 停止监听
configManager.unwatch();

// 手动重新加载
configManager.reload();
```

### MCP 服务器管理

```typescript
// 添加 MCP 服务器
configManager.addMcpServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir']
});

// 更新 MCP 服务器
configManager.updateMcpServer('filesystem', {
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path']
});

// 获取所有 MCP 服务器
const mcpServers = configManager.getMcpServers();

// 删除 MCP 服务器
configManager.removeMcpServer('filesystem');
```

## 配置迁移

系统会自动处理版本升级时的配置迁移：

### 示例：从旧版本迁移

```typescript
// 旧配置格式
{
  "model": "claude-3-opus",
  "autoSave": true
}

// 迁移后的新格式
{
  "version": "2.0.76",
  "model": "opus",
  "enableAutoSave": true
}
```

迁移规则在 `MIGRATIONS` 数组中定义，新增迁移只需添加新的迁移对象。

## 完整配置 Schema

```typescript
{
  // 版本控制
  version: string;                    // 配置版本号

  // API 配置
  apiKey?: string;                    // Anthropic API 密钥
  model: 'opus' | 'sonnet' | 'haiku' | string; // 模型名称
  maxTokens: number;                  // 最大输出令牌数 (1-200000)
  temperature: number;                // 温度 (0-1)

  // 后端选择
  useBedrock: boolean;                // 使用 AWS Bedrock
  useVertex: boolean;                 // 使用 Google Vertex AI
  oauthToken?: string;                // OAuth 令牌

  // 功能配置
  maxRetries: number;                 // 最大重试次数 (0-10)
  debugLogsDir?: string;              // 调试日志目录

  // UI 配置
  theme: 'dark' | 'light' | 'auto';   // 主题
  verbose: boolean;                   // 详细输出

  // 功能开关
  enableTelemetry: boolean;           // 启用遥测
  disableFileCheckpointing: boolean;  // 禁用文件检查点
  enableAutoSave: boolean;            // 启用自动保存

  // 高级配置
  maxConcurrentTasks: number;         // 最大并发任务数 (1-100)
  requestTimeout: number;             // 请求超时时间（毫秒）

  // MCP 服务器
  mcpServers?: Record<string, {
    type: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  }>;

  // 工具过滤
  allowedTools?: string[];            // 允许的工具列表
  disallowedTools?: string[];         // 禁用的工具列表

  // 自定义提示词
  systemPrompt?: string;              // 系统提示词

  // 工作目录
  defaultWorkingDir?: string;         // 默认工作目录
}
```

## 最佳实践

### 1. 分层配置

- **全局配置**: 存放通用设置（API 密钥、默认模型等）
- **项目配置**: 存放项目特定设置（系统提示词、工具过滤等）
- **环境变量**: 用于敏感信息和部署配置

### 2. 敏感信息管理

```bash
# 推荐：使用环境变量
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"

# 不推荐：在配置文件中明文存储
```

### 3. 配置备份

```typescript
// 定期备份配置
const backupConfig = configManager.export(false);
fs.writeFileSync('config-backup.json', backupConfig);
```

### 4. 配置验证

```typescript
// 在启动时验证配置
const validation = configManager.validate();
if (!validation.valid) {
  console.error('配置错误:', validation.errors?.issues);
  process.exit(1);
}
```

## 故障排查

### 配置加载失败

```typescript
// 检查配置文件路径
console.log('全局配置:', '~/.claude/settings.json');
console.log('项目配置:', './.claude/settings.json');

// 重置为默认配置
configManager.reset();
```

### 配置验证错误

```typescript
const validation = configManager.validate();
if (!validation.valid) {
  console.error('验证错误:');
  validation.errors?.issues.forEach(issue => {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`);
  });
}
```

### 环境变量未生效

```bash
# 检查环境变量是否设置
env | grep CLAUDE

# 重新导出环境变量
export CLAUDE_CODE_MAX_OUTPUT_TOKENS="16384"

# 验证解析结果
node -e "console.log(Number(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS))"
```

## 高级用法

### 自定义配置路径

```typescript
// 设置自定义配置目录
process.env.CLAUDE_CONFIG_DIR = '/custom/path/.claude';

// 重新创建 ConfigManager 实例
const customConfigManager = new ConfigManager();
```

### 配置变更监听

```typescript
let currentModel = configManager.get('model');

configManager.watch((newConfig) => {
  if (newConfig.model !== currentModel) {
    console.log(`模型已更改: ${currentModel} → ${newConfig.model}`);
    currentModel = newConfig.model;
    // 重新初始化 Claude 客户端
  }
});
```

### 条件配置合并

```typescript
// 根据环境加载不同配置
if (process.env.NODE_ENV === 'production') {
  configManager.saveProject({
    enableTelemetry: true,
    verbose: false,
    maxRetries: 5
  });
} else {
  configManager.saveProject({
    enableTelemetry: false,
    verbose: true,
    maxRetries: 1
  });
}
```

## 相关文件

- `/home/user/claude-code-open/src/config/index.ts` - 配置管理实现
- `~/.claude/settings.json` - 全局配置文件
- `.claude/settings.json` - 项目配置文件

## 参考资源

- [Zod Documentation](https://zod.dev/)
- [Claude API Documentation](https://docs.anthropic.com/)
- [MCP Documentation](https://modelcontextprotocol.io/)
