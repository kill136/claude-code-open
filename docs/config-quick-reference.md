# 配置系统快速参考

## 核心 API

### 基本操作
```typescript
import { configManager } from './src/config/index.js';

// 获取配置
const model = configManager.get('model');
const apiKey = configManager.getApiKey();
const all = configManager.getAll();

// 设置配置
configManager.set('verbose', true);
configManager.set('model', 'opus');
```

### 项目配置
```typescript
// 保存到项目配置 (.claude/settings.json)
configManager.saveProject({
  model: 'opus',
  maxTokens: 16384,
  systemPrompt: 'Custom prompt'
});
```

### 配置验证
```typescript
const { valid, errors } = configManager.validate();
if (!valid) {
  console.error('配置错误:', errors);
}
```

### 导出/导入
```typescript
// 导出（掩码敏感信息）
const backup = configManager.export(true);

// 导出（完整）
const full = configManager.export(false);

// 导入
const success = configManager.import(configJson);
```

### 热重载
```typescript
// 监听配置变化
configManager.watch((newConfig) => {
  console.log('配置已更新:', newConfig);
});

// 停止监听
configManager.unwatch();

// 手动重新加载
configManager.reload();
```

### MCP 服务器
```typescript
// 添加
configManager.addMcpServer('fs', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path']
});

// 更新
configManager.updateMcpServer('fs', {
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path']
});

// 删除
configManager.removeMcpServer('fs');

// 获取所有
const servers = configManager.getMcpServers();
```

### 配置重置
```typescript
configManager.reset(); // 重置为默认值
```

## 配置优先级

```
命令行参数 > 环境变量 > 项目配置 > 全局配置 > 默认值
```

## 配置文件位置

- **全局**: `~/.claude/settings.json`
- **项目**: `.claude/settings.json`

## 环境变量

```bash
# API 配置
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"
export CLAUDE_API_KEY="sk-ant-api03-xxx"

# 功能配置
export CLAUDE_CODE_MAX_OUTPUT_TOKENS="16384"
export CLAUDE_CODE_MAX_RETRIES="5"

# 开关
export CLAUDE_CODE_ENABLE_TELEMETRY="false"
export CLAUDE_CODE_USE_BEDROCK="true"
```

## 核心配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `version` | string | "2.0.76" | 配置版本 |
| `apiKey` | string? | - | API 密钥 |
| `model` | string | "sonnet" | 模型名称 |
| `maxTokens` | number | 8192 | 最大令牌数 |
| `temperature` | number | 1 | 温度 (0-1) |
| `theme` | string | "auto" | 主题 |
| `verbose` | boolean | false | 详细输出 |
| `enableTelemetry` | boolean | false | 启用遥测 |
| `useBedrock` | boolean | false | 使用 Bedrock |
| `useVertex` | boolean | false | 使用 Vertex |

## 常见场景

### 配置 API 密钥
```bash
# 方式 1: 环境变量（推荐）
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"

# 方式 2: 配置文件
echo '{"apiKey":"sk-ant-api03-xxx"}' > ~/.claude/settings.json

# 方式 3: 代码设置
configManager.set('apiKey', 'sk-ant-api03-xxx');
```

### 配置项目特定设置
```typescript
// 在项目根目录创建 .claude/settings.json
configManager.saveProject({
  model: 'opus',
  systemPrompt: '你是这个项目的专属助手',
  allowedTools: ['Bash', 'Read', 'Write', 'Edit']
});
```

### 备份和恢复配置
```typescript
// 备份
const backup = configManager.export(false);
fs.writeFileSync('config-backup.json', backup);

// 恢复
const backup = fs.readFileSync('config-backup.json', 'utf-8');
configManager.import(backup);
```

### 配置验证和调试
```typescript
// 验证配置
const validation = configManager.validate();
if (!validation.valid) {
  validation.errors?.issues.forEach(issue => {
    console.error(`${issue.path}: ${issue.message}`);
  });
}

// 查看当前配置
console.log(JSON.stringify(configManager.getAll(), null, 2));
```

## MCP 服务器配置示例

### stdio 类型
```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

### HTTP 类型
```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### SSE 类型
```json
{
  "mcpServers": {
    "stream": {
      "type": "sse",
      "url": "http://localhost:3000/events"
    }
  }
}
```

## 权限配置示例

```json
{
  "permissions": {
    "tools": {
      "allow": ["Bash", "Read", "Write", "Edit"],
      "deny": ["WebFetch", "WebSearch"]
    },
    "paths": {
      "allow": ["/home/user/projects"],
      "deny": ["/etc", "/var"]
    },
    "commands": {
      "allow": ["git", "npm", "node"],
      "deny": ["rm -rf", "sudo"]
    },
    "network": {
      "allow": ["github.com", "npmjs.com"],
      "deny": ["*"]
    },
    "audit": {
      "enabled": true,
      "logFile": "/var/log/claude-audit.log",
      "maxSize": 10485760
    }
  }
}
```

## 配置迁移

系统会自动处理版本升级：

```typescript
// 旧配置
{
  "model": "claude-3-opus",
  "autoSave": true
}

// 自动迁移为
{
  "version": "2.0.76",
  "model": "opus",
  "enableAutoSave": true
}
```

## 故障排查

### 配置未生效
```typescript
// 检查配置来源
const config = configManager.getAll();
console.log('当前配置:', config);

// 重新加载
configManager.reload();
```

### 验证失败
```typescript
const { valid, errors } = configManager.validate();
if (!valid) {
  console.error('验证错误:');
  errors?.issues.forEach(issue => {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`);
  });
}
```

### 环境变量未生效
```bash
# 检查环境变量
env | grep CLAUDE

# 验证解析
node -e "console.log(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS)"
```

## 相关文档

- [完整使用文档](./config-enhanced.md)
- [系统总结](./config-system-summary.md)
- [使用示例](../examples/config-usage.ts)
- [测试用例](../tests/config.test.ts)

## 核心文件

- `/home/user/claude-code-open/src/config/index.ts` - 配置管理器实现
