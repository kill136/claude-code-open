# Claude Code 插件系统文档

## 概述

Claude Code 插件系统提供了强大且安全的插件架构，支持：

- **插件发现** - 自动发现 `~/.claude/plugins/` 和 `.claude/plugins/` 目录中的插件
- **生命周期管理** - 完整的 `init`、`activate`、`deactivate` 生命周期
- **依赖管理** - 支持插件间依赖和版本检查（semver）
- **配置管理** - 每个插件独立的配置存储
- **版本检查** - Node.js 和 Claude Code 版本兼容性验证
- **沙箱隔离** - 受限的文件系统和 API 访问
- **插件 API** - 丰富的上下文 API（配置、日志、文件系统、工具、命令、钩子）
- **热重载** - 开发时自动重载插件

## 插件结构

### 基本文件结构

```
~/.claude/plugins/my-plugin/
├── package.json          # 插件元数据
├── index.js             # 插件主文件
└── README.md            # 插件说明（可选）
```

### package.json 示例

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome Claude Code plugin",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "claude-code": "^2.0.0"
  },
  "claudePluginDependencies": {
    "another-plugin": "^1.0.0"
  }
}
```

## 插件 API

### 插件接口

```typescript
interface Plugin {
  metadata: PluginMetadata;

  // 生命周期钩子
  init?(context: PluginContext): Promise<void>;
  activate?(context: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;

  // 插件功能
  tools?: ToolDefinition[];
  commands?: CommandDefinition[];
  hooks?: HookDefinition[];

  // 工具执行器（可选）
  executeTool?(toolName: string, input: unknown): Promise<ToolResult>;
}
```

### 插件上下文 (PluginContext)

插件上下文提供了丰富的 API 供插件使用：

```typescript
interface PluginContext {
  // 插件信息
  pluginName: string;
  pluginPath: string;

  // 配置管理
  config: {
    get<T>(key: string, defaultValue?: T): T | undefined;
    set(key: string, value: unknown): Promise<void>;
    getAll(): Record<string, unknown>;
    has(key: string): boolean;
    delete(key: string): Promise<void>;
  };

  // 日志 API
  logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };

  // 文件系统访问（限制在插件目录内）
  fs: {
    readFile(relativePath: string): Promise<string>;
    writeFile(relativePath: string, content: string): Promise<void>;
    exists(relativePath: string): Promise<boolean>;
    readdir(relativePath?: string): Promise<string[]>;
  };

  // 工具注册
  tools: {
    register(tool: ToolDefinition): void;
    unregister(toolName: string): void;
    getRegistered(): ToolDefinition[];
  };

  // 命令注册
  commands: {
    register(command: CommandDefinition): void;
    unregister(commandName: string): void;
    getRegistered(): CommandDefinition[];
  };

  // 钩子注册
  hooks: {
    on(hookType: HookType, handler: HookHandler): void;
    off(hookType: HookType, handler: HookHandler): void;
    getRegistered(): Array<{ type: HookType; handler: HookHandler }>;
  };

  // 事件系统
  events: EventEmitter;
}
```

## 创建插件

### 方法 1: 使用模板生成器

```javascript
import { pluginHelper } from 'claude-code/plugins';

const template = pluginHelper.createTemplate('my-plugin', {
  author: 'Your Name',
  description: 'My awesome plugin',
  version: '1.0.0'
});

console.log(template);
```

### 方法 2: 手动创建

**index.js:**

```javascript
// my-plugin - Claude Code Plugin

export default {
  metadata: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'A sample plugin',
    author: 'Your Name',
    engines: {
      'claude-code': '^2.0.0',
      'node': '>=18.0.0'
    }
  },

  async init(context) {
    context.logger.info('Initializing my-plugin');

    // 初始化配置
    if (!context.config.has('initialized')) {
      await context.config.set('initialized', true);
      await context.config.set('counter', 0);
    }
  },

  async activate(context) {
    context.logger.info('Activating my-plugin');

    // 注册工具
    context.tools.register({
      name: 'my-tool',
      description: 'My custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    });

    // 注册命令
    context.commands.register({
      name: 'greet',
      description: 'Greet the user',
      usage: 'greet [name]',
      examples: ['greet Alice', 'greet Bob'],
      async execute(args, ctx) {
        const name = args[0] || 'World';
        ctx.logger.info(`Hello, ${name}!`);
      }
    });

    // 注册钩子
    context.hooks.on('beforeMessage', async (message) => {
      context.logger.debug('Processing message:', message);
      return message;
    });

    // 监听事件
    context.events.on('custom-event', (data) => {
      context.logger.info('Received custom event:', data);
    });
  },

  async deactivate() {
    console.log('Deactivating my-plugin');
  },

  // 工具执行器
  async executeTool(toolName, input) {
    if (toolName === 'my-tool') {
      return {
        success: true,
        output: `Processed: ${input.message}`
      };
    }
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }
};
```

## 使用插件系统

### 基本使用

```javascript
import { pluginManager } from 'claude-code/plugins';

// 发现所有插件
await pluginManager.discover();

// 加载所有插件
await pluginManager.loadAll();

// 加载特定插件
await pluginManager.load('my-plugin');

// 获取已加载的插件
const plugins = pluginManager.getLoadedPlugins();

// 获取所有注册的工具
const tools = pluginManager.getTools();

// 获取所有注册的命令
const commands = pluginManager.getCommands();

// 执行钩子
const result = await pluginManager.executeHook('beforeMessage', messageContext);
```

### 插件安装和卸载

```javascript
// 安装插件
const state = await pluginManager.install('/path/to/plugin', {
  autoLoad: true,
  enableHotReload: true
});

// 卸载插件
await pluginManager.uninstall('my-plugin');

// 启用/禁用插件
await pluginManager.setEnabled('my-plugin', false);
await pluginManager.setEnabled('my-plugin', true);
```

### 热重载

```javascript
// 启用热重载
pluginManager.enableHotReload('my-plugin');

// 手动重载
await pluginManager.reload('my-plugin');

// 禁用热重载
pluginManager.disableHotReload('my-plugin');
```

### 执行插件工具

```javascript
import { pluginToolExecutor } from 'claude-code/plugins';

const result = await pluginToolExecutor.execute('my-tool', {
  message: 'Hello, Plugin!'
});

console.log(result.output);
```

### 执行插件命令

```javascript
import { pluginCommandExecutor } from 'claude-code/plugins';

await pluginCommandExecutor.execute('greet', ['Alice']);

// 获取命令帮助
const help = pluginCommandExecutor.getCommandHelp('greet');
console.log(help);
```

## 钩子类型

插件可以注册以下钩子：

- `beforeMessage` - 在处理用户消息之前
- `afterMessage` - 在处理用户消息之后
- `beforeToolCall` - 在调用工具之前
- `afterToolCall` - 在调用工具之后
- `onError` - 发生错误时
- `onSessionStart` - 会话开始时
- `onSessionEnd` - 会话结束时
- `onPluginLoad` - 插件加载时
- `onPluginUnload` - 插件卸载时

钩子定义：

```javascript
{
  type: 'beforeMessage',
  handler: async (context) => {
    // 处理上下文
    return context; // 可选：返回修改后的上下文
  },
  priority: 10 // 可选：优先级（数字越小越先执行）
}
```

## 依赖管理

### 声明依赖

在 `package.json` 中：

```json
{
  "claudePluginDependencies": {
    "base-plugin": "^1.0.0",
    "utils-plugin": "~2.1.0"
  },
  "peerDependencies": {
    "optional-plugin": ">=1.0.0"
  }
}
```

支持的版本范围：
- `^1.0.0` - 兼容主版本
- `~1.0.0` - 兼容次版本
- `>=1.0.0` - 大于等于
- `1.0.0` - 精确版本
- `*` - 任意版本

### 加载顺序

插件管理器会自动按依赖顺序加载插件（拓扑排序）。如果存在循环依赖，会抛出错误。

## 配置管理

### 读写配置

```javascript
async activate(context) {
  // 读取配置
  const apiKey = context.config.get('apiKey', 'default-key');

  // 写入配置
  await context.config.set('lastUsed', Date.now());

  // 检查配置是否存在
  if (context.config.has('apiKey')) {
    // ...
  }

  // 获取所有配置
  const allConfig = context.config.getAll();

  // 删除配置
  await context.config.delete('oldKey');
}
```

配置保存在 `~/.claude/plugins.json` 中。

## 沙箱隔离

### 文件系统限制

插件的文件系统访问被限制在其自身目录内：

```javascript
async activate(context) {
  // ✅ 允许：插件目录内
  await context.fs.writeFile('data.json', '{}');
  await context.fs.readFile('config.txt');

  // ❌ 禁止：插件目录外
  await context.fs.readFile('../../../etc/passwd'); // 抛出错误
}
```

### 安全建议

1. 不要执行来自不可信源的插件
2. 定期审查已安装的插件
3. 使用版本锁定避免意外更新
4. 为敏感操作使用配置管理
5. 不在插件中硬编码密钥

## 事件系统

插件可以使用事件系统进行通信：

```javascript
// 插件 A - 发送事件
context.events.emit('data-ready', { data: [...] });

// 插件 B - 监听事件
context.events.on('data-ready', (payload) => {
  console.log('Received data:', payload.data);
});
```

## 验证插件

使用 `pluginHelper` 验证插件元数据：

```javascript
import { pluginHelper } from 'claude-code/plugins';

const { valid, errors } = pluginHelper.validateMetadata({
  name: 'my-plugin',
  version: '1.0.0',
  // ...
});

if (!valid) {
  console.error('Invalid metadata:', errors);
}
```

## 调试

### 启用详细日志

```javascript
async activate(context) {
  context.logger.debug('Debug information');
  context.logger.info('General information');
  context.logger.warn('Warning message');
  context.logger.error('Error message');
}
```

日志会自动添加插件名称前缀：`[Plugin:my-plugin]`

### 监听插件事件

```javascript
pluginManager.on('plugin:loaded', (name, plugin) => {
  console.log(`Plugin ${name} loaded`);
});

pluginManager.on('plugin:error', (name, error) => {
  console.error(`Plugin ${name} error:`, error);
});

pluginManager.on('tool:registered', (pluginName, tool) => {
  console.log(`Tool ${tool.name} registered by ${pluginName}`);
});
```

## 最佳实践

1. **使用语义化版本** - 遵循 semver 规范
2. **文档化 API** - 提供清晰的 README 和示例
3. **错误处理** - 始终捕获和处理错误
4. **资源清理** - 在 `deactivate` 中清理资源
5. **测试** - 编写单元测试和集成测试
6. **最小权限** - 只请求必要的权限和依赖
7. **性能优化** - 避免阻塞操作，使用异步 API
8. **版本兼容** - 明确声明引擎要求

## 示例插件

### 1. 计数器插件

```javascript
export default {
  metadata: {
    name: 'counter-plugin',
    version: '1.0.0',
    description: 'A simple counter plugin'
  },

  async init(context) {
    if (!context.config.has('count')) {
      await context.config.set('count', 0);
    }
  },

  async activate(context) {
    context.commands.register({
      name: 'count',
      description: 'Show and increment counter',
      async execute(args, ctx) {
        let count = ctx.config.get('count', 0);
        count++;
        await ctx.config.set('count', count);
        ctx.logger.info(`Count: ${count}`);
      }
    });
  }
};
```

### 2. 文件统计插件

```javascript
export default {
  metadata: {
    name: 'file-stats',
    version: '1.0.0',
    description: 'File statistics plugin'
  },

  async activate(context) {
    context.tools.register({
      name: 'file-stats',
      description: 'Get file statistics',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    });
  },

  async executeTool(toolName, input) {
    if (toolName === 'file-stats') {
      // 实现文件统计逻辑
      return {
        success: true,
        output: JSON.stringify({
          lines: 100,
          chars: 5000,
          words: 800
        })
      };
    }
  }
};
```

## 故障排除

### 插件未加载

1. 检查 `package.json` 是否存在且有效
2. 验证 `engines` 字段是否匹配
3. 检查依赖是否满足
4. 查看错误日志

### 配置未保存

确保使用 `await context.config.set()` 而不是同步调用。

### 热重载不工作

1. 确保已调用 `enableHotReload()`
2. 检查文件是否在插件目录内
3. 验证文件扩展名（.js, .ts, .mjs, .cjs）

## 完整 API 参考

完整的类型定义请参考：`/home/user/claude-code-open/src/plugins/index.ts`

主要导出：
- `PluginManager` - 插件管理器类
- `pluginManager` - 默认管理器实例
- `PluginToolExecutor` - 工具执行器类
- `pluginToolExecutor` - 默认工具执行器实例
- `PluginCommandExecutor` - 命令执行器类
- `pluginCommandExecutor` - 默认命令执行器实例
- `createPluginManager()` - 创建新的管理器实例
- `pluginHelper` - 插件开发助手

## 许可证

MIT License
