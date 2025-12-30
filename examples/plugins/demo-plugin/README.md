# 演示插件 (Demo Plugin)

这是一个完整的演示插件，展示了 Claude Code 插件系统的所有功能。

## 功能特性

### 1. 工具 (Tools)

#### `demo_hello`
打印问候语的演示工具。

**参数**：
- `name` (string, 必需): 要问候的名字
- `formal` (boolean, 可选): 是否使用正式问候，默认 false

**示例**：
```json
{
  "name": "demo_hello",
  "input": {
    "name": "Alice",
    "formal": false
  }
}
```

#### `demo_counter`
递增计数器并返回当前值。

**参数**：
- `increment` (number, 可选): 递增的值，默认 1

### 2. 命令 (Commands)

#### `demo-status`
显示演示插件的状态信息。

```bash
claude demo-status
```

#### `demo-reset`
重置插件的计数器为 0。

```bash
claude demo-reset
```

### 3. 技能 (Skills/Prompts)

#### `/code-review`
代码审查技能，帮助审查代码质量。

**参数**：
- `language` (必需): 代码语言（如：JavaScript, Python）
- `code` (必需): 要审查的代码

**示例**：
```
/code-review language=JavaScript code="const x = 1; x = 2;"
```

#### `/explain-code`
代码解释技能，解释代码的功能。

**参数**：
- `language` (必需): 代码语言
- `code` (必需): 要解释的代码
- `level` (可选): 目标读者水平（初级/中级/高级）

#### `/write-tests`
测试编写技能，为代码生成单元测试。

**参数**：
- `language` (必需): 代码语言
- `framework` (必需): 测试框架（如：Jest, pytest）
- `code` (必需): 要测试的代码

### 4. 钩子 (Hooks)

插件注册了以下钩子：
- `beforeMessage`: 消息发送前
- `afterMessage`: 消息发送后
- `beforeToolCall`: 工具调用前
- `afterToolCall`: 工具调用后
- `onError`: 错误发生时

### 5. 配置 (Configuration)

插件使用以下配置项：
- `greeting`: 默认问候语
- `counter`: 计数器值

配置保存在 `~/.claude/plugins.json` 中。

## 安装

### 方法 1: 本地安装
```bash
claude plugin install /path/to/demo-plugin
```

### 方法 2: 手动复制
```bash
cp -r examples/plugins/demo-plugin ~/.claude/plugins/
```

## 使用

### 列出已安装插件
```bash
claude plugin list
```

### 查看插件信息
```bash
claude plugin info demo-plugin
```

### 启用/禁用插件
```bash
claude plugin enable demo-plugin
claude plugin disable demo-plugin
```

### 卸载插件
```bash
claude plugin remove demo-plugin
```

## 插件结构

```
demo-plugin/
├── package.json    # 插件元数据
├── index.js        # 插件主文件
└── README.md       # 说明文档
```

## 开发指南

### 插件生命周期

1. **发现 (Discovery)**: 插件管理器扫描插件目录
2. **加载 (Load)**: 动态导入插件模块
3. **初始化 (Init)**: 调用 `init()` 方法设置基本配置
4. **激活 (Activate)**: 调用 `activate()` 方法注册功能
5. **运行时**: 执行工具、命令、技能，触发钩子
6. **停用 (Deactivate)**: 调用 `deactivate()` 方法清理资源

### 插件 API

插件通过 `PluginContext` 访问以下 API：

- **config**: 配置管理（get, set, has, delete, getAll）
- **logger**: 日志记录（debug, info, warn, error）
- **fs**: 文件系统访问（限制在插件目录内）
- **tools**: 工具注册和管理
- **commands**: 命令注册和管理
- **skills**: 技能注册和管理
- **hooks**: 钩子注册和管理
- **events**: 事件发射器（EventEmitter）

### 最佳实践

1. **版本管理**: 使用 Semver 版本号
2. **依赖声明**: 在 `engines` 中声明兼容的 Node.js 和 Claude Code 版本
3. **错误处理**: 在工具和命令中妥善处理错误
4. **资源清理**: 在 `deactivate()` 中清理所有资源
5. **日志记录**: 使用 `context.logger` 而不是 `console`
6. **沙箱安全**: 只访问插件目录内的文件

## 示例代码

### 创建简单工具

```javascript
context.tools.register({
  name: 'my_tool',
  description: '我的工具',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    },
    required: ['input']
  }
});
```

### 创建命令

```javascript
context.commands.register({
  name: 'my-command',
  description: '我的命令',
  async execute(args, ctx) {
    ctx.logger.info('执行命令');
  }
});
```

### 创建技能

```javascript
context.skills.register({
  name: 'my-skill',
  description: '我的技能',
  prompt: '执行任务：{task}',
  parameters: [
    {
      name: 'task',
      description: '任务描述',
      required: true
    }
  ]
});
```

## 许可证

MIT License

## 作者

Claude Code Team
