# 配置系统更新日志

## [2.0.76] - 2025-12-24

### 新增功能

#### 核心增强
- ✅ **Zod Schema 验证**: 完整的配置类型验证和约束
- ✅ **环境变量解析**: 智能布尔值和数字类型转换
- ✅ **配置文件加载**: 支持全局和项目级配置
- ✅ **配置合并**: 5级优先级系统（默认→全局→项目→环境变量→命令行）
- ✅ **配置迁移**: 自动版本升级和字段重命名
- ✅ **配置导出/导入**: 支持备份和恢复，可选敏感信息掩码
- ✅ **敏感信息掩码**: 自动识别和掩码 API 密钥、令牌等
- ✅ **配置热重载**: 文件监听和自动重载

#### 额外功能
- ✅ **配置验证 API**: `validate()` 方法提供详细错误报告
- ✅ **配置重置**: `reset()` 方法恢复默认配置
- ✅ **MCP 服务器管理增强**: 新增 `updateMcpServer()` 方法
- ✅ **权限配置支持**: 工具、路径、命令、网络权限控制

### API 变更

#### 新增方法
```typescript
configManager.saveProject(config)         // 保存到项目配置
configManager.reload()                    // 重新加载配置
configManager.watch(callback)             // 监听配置变化
configManager.unwatch()                   // 停止监听
configManager.export(maskSecrets)         // 导出配置
configManager.import(configJson)          // 导入配置
configManager.validate()                  // 验证配置
configManager.reset()                     // 重置配置
configManager.updateMcpServer(name, cfg)  // 更新 MCP 服务器
```

#### 保持兼容
所有现有 API 保持不变，完全向后兼容。

### 配置文件位置

- **全局配置**: `~/.claude/settings.json`
- **项目配置**: `.claude/settings.json`

### 环境变量

新增支持的环境变量：
- `CLAUDE_CODE_OAUTH_TOKEN`
- `CLAUDE_CODE_USE_BEDROCK`
- `CLAUDE_CODE_USE_VERTEX`
- `CLAUDE_CODE_MAX_RETRIES`
- `CLAUDE_CODE_DEBUG_LOGS_DIR`
- `CLAUDE_CODE_ENABLE_TELEMETRY`
- `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING`

### 配置 Schema

新增配置项：
```typescript
{
  version: string;              // 配置版本号
  useBedrock: boolean;          // 使用 AWS Bedrock
  useVertex: boolean;           // 使用 Google Vertex AI
  oauthToken: string;           // OAuth 令牌
  maxRetries: number;           // 最大重试次数
  debugLogsDir: string;         // 调试日志目录
  theme: 'dark'|'light'|'auto'; // 主题
  enableAutoSave: boolean;      // 自动保存
  maxConcurrentTasks: number;   // 最大并发任务数
  requestTimeout: number;       // 请求超时时间
  allowedTools: string[];       // 允许的工具列表
  disallowedTools: string[];    // 禁用的工具列表
  systemPrompt: string;         // 自定义系统提示词
  defaultWorkingDir: string;    // 默认工作目录
  permissions: {                // 权限配置
    tools: { allow, deny };
    paths: { allow, deny };
    commands: { allow, deny };
    network: { allow, deny };
    audit: { enabled, logFile, maxSize };
  };
}
```

### 文件变更

#### 修改的文件
- `/home/user/claude-code-open/src/config/index.ts` (564 行)
  - 完全重写配置管理器
  - 添加 Zod Schema 验证
  - 实现配置合并和迁移
  - 添加热重载功能

#### 新增文件
- `/home/user/claude-code-open/docs/config-enhanced.md` (400 行)
- `/home/user/claude-code-open/docs/config-system-summary.md` (402 行)
- `/home/user/claude-code-open/docs/config-quick-reference.md` (312 行)
- `/home/user/claude-code-open/docs/CONFIG-ENHANCEMENT-REPORT.md` (实施报告)
- `/home/user/claude-code-open/examples/config-usage.ts` (296 行)
- `/home/user/claude-code-open/tests/config.test.ts` (395 行)

### 迁移指南

#### 从旧版本升级

1. 配置会自动迁移，无需手动操作
2. 旧的模型名称会自动转换：
   - `claude-3-opus` → `opus`
   - `claude-3-sonnet` → `sonnet`
   - `claude-3-haiku` → `haiku`
3. `autoSave` 字段自动迁移为 `enableAutoSave`

#### 使用新功能

```typescript
import { configManager } from './src/config/index.js';

// 项目级配置
configManager.saveProject({
  model: 'opus',
  systemPrompt: '自定义提示词'
});

// 配置热重载
configManager.watch((config) => {
  console.log('配置已更新');
});

// 配置验证
const { valid, errors } = configManager.validate();

// 配置导出（掩码敏感信息）
const backup = configManager.export(true);
```

### 破坏性变更

无破坏性变更，完全向后兼容。

### 已知问题

无已知问题。

### 性能优化

- 配置在内存中缓存，避免重复读取
- 使用 `fs.watch` 而非轮询
- Zod 验证结果复用

### 安全性增强

- API 密钥自动掩码
- OAuth 令牌保护
- MCP 服务器认证信息掩码
- 权限配置支持

### 文档

- [完整使用文档](./docs/config-enhanced.md)
- [系统总结](./docs/config-system-summary.md)
- [快速参考](./docs/config-quick-reference.md)
- [实施报告](./docs/CONFIG-ENHANCEMENT-REPORT.md)
- [使用示例](./examples/config-usage.ts)
- [测试用例](./tests/config.test.ts)

### 贡献者

- Claude Code Development Team

### 致谢

感谢 Zod、Anthropic SDK 等开源项目的支持。

---

完整实施报告请查看: [CONFIG-ENHANCEMENT-REPORT.md](./docs/CONFIG-ENHANCEMENT-REPORT.md)
