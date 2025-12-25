# Action 生命周期对比分析 (T502-T511)

## 概述

本文档对比分析官方 `@anthropic-ai/claude-code` 与本项目在 Action 生命周期功能点上的实现差异。

**分析范围：** T502-T511
**官方版本：** 2.0.76
**分析日期：** 2025-12-25

---

## 生命周期事件总览

### 官方支持的生命周期事件

官方 CLI 通过 `x9()` 函数触发生命周期事件，共发现 **18 个**生命周期事件：

#### CLI 入口级别事件（9个）
1. `cli_entry` - CLI 入口
2. `cli_imports_loaded` - 导入加载完成
3. `cli_version_fast_path` - 版本快速路径（仅 --version）
4. `cli_ripgrep_path` - Ripgrep 路径（仅 --ripgrep）
5. `cli_claude_in_chrome_mcp_path` - Chrome MCP 路径
6. `cli_chrome_native_host_path` - Chrome 原生主机路径
7. `cli_before_main_import` - 主函数导入前
8. `cli_after_main_import` - 主函数导入后
9. `cli_after_main_complete` - 主函数完成后

#### Action 处理级别事件（9个）
1. `action_handler_start` - Action 处理器开始
2. `action_mcp_configs_loaded` - MCP 配置加载完成
3. `action_after_input_prompt` - 输入提示处理后
4. `action_tools_loaded` - 工具加载完成
5. `action_before_setup` - 设置前
6. `action_after_setup` - 设置后
7. `action_commands_loaded` - 命令加载完成
8. `action_after_plugins_init` - 插件初始化后
9. `action_after_hooks` - Hooks 执行后

---

## T502: action_before_setup 钩子

### 官方实现

**位置：** `cli.js:4986`

```javascript
x9("action_before_setup")
await QF1(TR0(), DA, V, QA, e, R ? J$(R) : void 0)
x9("action_after_setup")
```

**调用时机：**
- 在执行主要设置（QF1 函数）之前
- 在工具加载完成后
- 在命令加载之前

**功能：**
- 允许插件/钩子在系统设置前进行预处理
- 可用于环境验证、权限检查等

### 本项目实现

**状态：** ❌ 未实现

**位置：** `src/cli.ts`

本项目的 `cli.ts` 中没有实现生命周期钩子系统。虽然实现了 Hooks 系统（`src/hooks/index.ts`），但仅支持以下事件：
- PreToolUse / PostToolUse
- SessionStart / SessionEnd
- UserPromptSubmit
- 等工具相关事件

缺少 CLI 级别的生命周期钩子。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 本项目未实现 action_before_setup |
| **Hook 系统** | ✅ 完整 | ⚠️ 部分 | 仅支持工具级 Hook，缺少 CLI 级 Hook |
| **扩展性** | ✅ 高 | ⚠️ 中 | 无法在设置前插入自定义逻辑 |

---

## T503: action_after_setup 钩子

### 官方实现

**位置：** `cli.js:4986`

```javascript
x9("action_before_setup")
await QF1(TR0(), DA, V, QA, e, R ? J$(R) : void 0)
x9("action_after_setup")
```

**调用时机：**
- 在执行主要设置（QF1 函数）之后
- 在命令加载之前
- 在插件初始化之前

**功能：**
- 允许插件/钩子在设置完成后进行后处理
- 可用于验证设置结果、注册额外服务等

### 本项目实现

**状态：** ❌ 未实现

**原因：** 同 T502，本项目缺少 CLI 级别生命周期钩子系统。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 本项目未实现 action_after_setup |
| **Hook 系统** | ✅ 完整 | ⚠️ 部分 | 仅支持工具级 Hook |
| **设置验证** | ✅ 支持 | ❌ 不支持 | 无法验证设置结果 |

---

## T504: action_handler_start 事件

### 官方实现

**位置：** `cli.js:4972`

```javascript
.action(async(J, X) => {
  x9("action_handler_start")

  // 处理命令行参数
  if (J === "code") {
    n("tengu_code_prompt_ignored", {})
    console.warn(V1.yellow("Tip: You can launch Claude Code with just `claude`"))
    J = void 0
  }

  // ... 后续处理
})
```

**调用时机：**
- 在 Commander.js action 处理器的最开始
- 在任何参数处理之前
- 是整个 action 生命周期的起点

**功能：**
- 标记 action 处理开始
- 可用于性能监控、日志记录
- 允许插件在参数处理前介入

### 本项目实现

**状态：** ❌ 未实现

**位置：** `src/cli.ts:103`

```typescript
.action(async (prompt, options) => {
  // 调试模式
  if (options.debug) {
    process.env.CLAUDE_DEBUG = options.debug === true ? '*' : options.debug;
  }

  // Solo 模式 - 禁用后台进程和并行执行
  if (options.solo) {
    process.env.CLAUDE_SOLO_MODE = 'true';
  }

  // ... 无生命周期事件触发
})
```

本项目直接开始处理参数，没有生命周期事件触发机制。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_handler_start 事件 |
| **监控能力** | ✅ 支持 | ❌ 不支持 | 无法监控 action 启动 |
| **插件介入** | ✅ 支持 | ❌ 不支持 | 插件无法在参数处理前介入 |

---

## T505: action_commands_loaded 事件

### 官方实现

**位置：** `cli.js:4986`

```javascript
let XQ = t1()
let [k1, MQ] = await Promise.all([Lb(XQ), vy2(XQ)])
x9("action_commands_loaded")
```

**调用时机：**
- 在加载命令（Commands）和代理（Agents）之后
- 在 action_after_setup 之后
- 在插件初始化之前

**功能：**
- 通知插件命令已加载完成
- 可用于注册额外命令、验证命令等
- 允许插件修改或扩展命令集

### 本项目实现

**状态：** ❌ 未实现

**本项目命令加载：** `src/cli.ts:993-1041`

本项目实现了斜杠命令处理（`handleSlashCommand`），但没有生命周期事件通知机制：

```typescript
function handleSlashCommand(input: string, loop: ConversationLoop): void {
  const [cmd, ...args] = input.slice(1).split(' ');
  const memory = getMemoryManager();

  switch (cmd.toLowerCase()) {
    case 'help':
      // ... 显示帮助
      break;
    case 'clear':
      // ... 清除历史
      break;
    // ... 其他命令
  }
}
```

命令加载后没有触发任何事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_commands_loaded 事件 |
| **命令系统** | ✅ 完整 | ⚠️ 基础 | 有斜杠命令但无生命周期 |
| **扩展性** | ✅ 高 | ⚠️ 低 | 插件无法在命令加载后介入 |

---

## T506: action_tools_loaded 事件

### 官方实现

**位置：** `cli.js:4986`

```javascript
let m1 = await AV7(J || "", g ?? "text")
x9("action_after_input_prompt")

let _1 = Mz(kA)  // 加载工具
x9("action_tools_loaded")

// 检查 JSON Schema
let H0
if (Xd2({isNonInteractiveSession: RA}) && X.jsonSchema) {
  H0 = JSON.parse(X.jsonSchema)
}
```

**调用时机：**
- 在工具加载完成后（Mz 函数）
- 在 action_after_input_prompt 之后
- 在 action_before_setup 之前

**功能：**
- 通知插件工具已加载完成
- 可用于注册额外工具、验证工具配置
- 允许插件修改工具集

### 本项目实现

**状态：** ⚠️ 部分实现

**位置：** `src/tools/index.ts`

本项目有工具注册系统（ToolRegistry），但没有生命周期事件：

```typescript
// src/tools/index.ts
export const toolRegistry = new ToolRegistry();

// 注册所有工具
toolRegistry.register(new BashTool());
toolRegistry.register(new ReadTool());
toolRegistry.register(new WriteTool());
// ... 其他工具
```

工具在模块加载时注册，没有触发 `action_tools_loaded` 事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_tools_loaded 事件 |
| **工具系统** | ✅ 完整 | ✅ 完整 | 都有完整的工具注册系统 |
| **动态加载** | ✅ 支持 | ⚠️ 部分 | 工具静态注册，无动态加载通知 |

---

## T507: action_mcp_configs_loaded 事件

### 官方实现

**位置：** `cli.js:4986`

```javascript
let {servers: Q1} = $A ? {servers: {}} : await LP()
let W1 = {...Q1, ...AA}
let MA = {}, tA = {}

for (let [U0, iQ] of Object.entries(W1)) {
  let I1 = iQ
  if (I1.type === "sdk") {
    MA[U0] = I1
  } else {
    tA[U0] = I1
  }
}

x9("action_mcp_configs_loaded")
```

**调用时机：**
- 在 MCP 配置加载和分类完成后
- 在工具权限上下文创建之后
- 在输入格式验证之前

**功能：**
- 通知插件 MCP 配置已加载
- 可用于验证 MCP 配置、添加额外 MCP 服务器
- 允许插件修改 MCP 配置

### 本项目实现

**状态：** ⚠️ 部分实现

**位置：** `src/config/index.ts`

本项目有 MCP 配置管理：

```typescript
// src/config/index.ts
export class ConfigManager {
  getMcpServers(): Record<string, McpServerConfig> {
    return this.config.mcpServers || {};
  }

  addMcpServer(name: string, config: McpServerConfig): void {
    if (!this.config.mcpServers) {
      this.config.mcpServers = {};
    }
    this.config.mcpServers[name] = config;
    this.save();
  }
}
```

**CLI 中的 MCP 加载：** `src/cli.ts:122-124`

```typescript
// 加载 MCP 配置
if (options.mcpConfig) {
  loadMcpConfigs(options.mcpConfig);
}
```

但没有触发 `action_mcp_configs_loaded` 事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_mcp_configs_loaded 事件 |
| **MCP 系统** | ✅ 完整 | ✅ 完整 | 都支持 MCP 配置管理 |
| **配置验证** | ✅ 支持 | ⚠️ 部分 | 插件无法在加载后验证配置 |

---

## T508: action_after_plugins_init 事件

### 官方实现

**位置：** `cli.js:4986`

```javascript
dK7()        // 某个初始化函数
await zQ2()  // 可能是插件初始化
x9("action_after_plugins_init")
e62()        // 某个后续处理
```

**调用时机：**
- 在插件初始化完成后（zQ2 函数）
- 在所有配置加载完成后
- 在开始渲染 UI 之前

**功能：**
- 通知系统插件已初始化完成
- 允许插件进行最终配置
- 可用于验证插件加载状态

### 本项目实现

**状态：** ❌ 未实现

**本项目插件系统：** `src/plugins/`

本项目有插件系统的基础结构，但未完全实现：

```typescript
// src/cli.ts:451-462
pluginCommand
  .command('list')
  .description('List installed plugins')
  .action(() => {
    console.log(chalk.bold('\nInstalled Plugins:\n'));
    console.log(chalk.gray('  No plugins installed.'));
    console.log(chalk.gray('\n  Use "claude plugin install <path>" to install a plugin.\n'));
  });
```

插件系统显示为"开发中"，没有实际的插件加载和初始化逻辑。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_after_plugins_init 事件 |
| **插件系统** | ✅ 完整 | ⚠️ 开发中 | 插件系统未完成 |
| **扩展性** | ✅ 高 | ❌ 无 | 无法通知插件初始化完成 |

---

## T509: action_after_input_prompt 事件

### 官方实现

**位置：** `cli.js:4986`

```javascript
let m1 = await AV7(J || "", g ?? "text")
x9("action_after_input_prompt")
```

**调用时机：**
- 在处理输入提示（AV7 函数）之后
- 在工具加载之前
- 在 MCP 配置加载之后

**功能：**
- 通知系统输入提示已处理完成
- 可用于日志记录、审计
- 允许插件在工具加载前介入

### 本项目实现

**状态：** ❌ 未实现

**本项目输入处理：** `src/cli.ts:301-315`

```typescript
// 如果有初始 prompt
if (prompt) {
  console.log(chalk.blue('> ') + prompt);
  console.log();

  for await (const event of loop.processMessageStream(prompt)) {
    if (event.type === 'text') {
      process.stdout.write(event.content || '');
    } else if (event.type === 'tool_start') {
      console.log(chalk.cyan(`\n[Using tool: ${event.toolName}]`));
    } else if (event.type === 'tool_end') {
      console.log(chalk.gray(`[Result: ${(event.toolResult || '').substring(0, 100)}...]`));
    }
  }
  console.log('\n');
}
```

直接处理提示，没有触发生命周期事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_after_input_prompt 事件 |
| **输入处理** | ✅ 完整 | ✅ 完整 | 都支持输入提示处理 |
| **审计能力** | ✅ 支持 | ❌ 不支持 | 无法审计输入处理 |

---

## T510: action_after_hooks 处理

### 官方实现

**位置：** `cli.js:4994`

```javascript
let U0 = await KL("startup")  // 执行 startup hooks
x9("action_after_hooks")

await c3(
  b5.default.createElement(C5, {initialState: L0, onChangeAppState: Jp},
    b5.default.createElement(mDA, {
      // ... UI 组件属性
    })
  ),
  Y0
)
```

**调用时机：**
- 在执行 startup hooks 之后（KL 函数）
- 在渲染主 UI 之前
- 是 action 生命周期的最后一个事件

**功能：**
- 通知系统所有 hooks 已执行完成
- 标记 CLI 初始化完成
- 允许插件进行最终验证

### 本项目实现

**状态：** ❌ 未实现

**本项目 Hooks 系统：** `src/hooks/index.ts`

虽然本项目实现了 Hooks 系统，但仅支持工具级别的 hooks：

```typescript
// src/hooks/index.ts
export type HookEvent =
  | 'PreToolUse'           // 工具执行前
  | 'PostToolUse'          // 工具执行后
  | 'PostToolUseFailure'   // 工具执行失败后
  | 'Notification'         // 通知事件
  | 'UserPromptSubmit'     // 用户提交提示
  | 'SessionStart'         // 会话开始
  | 'SessionEnd'           // 会话结束
  | 'Stop'                 // 停止事件
  | 'SubagentStart'        // 子代理开始
  | 'SubagentStop'         // 子代理停止
  | 'PreCompact'           // 压缩前
  | 'PermissionRequest';   // 权限请求
```

没有 `action_after_hooks` 或类似的 CLI 级别事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 action_after_hooks 事件 |
| **Hook 系统** | ✅ 完整 | ⚠️ 部分 | 仅支持工具级 Hook |
| **启动流程** | ✅ 完整 | ⚠️ 简化 | 无 startup hooks 概念 |

---

## T511: cli_after_main_complete 事件

### 官方实现

**位置：** `cli.js:5038`

```javascript
async function ZV7() {
  // ... 命令行参数处理

  x9("cli_before_main_import")
  let {main: Q} = await Promise.resolve().then(() => (OF9(), LF9))
  x9("cli_after_main_import")

  await Q()
  x9("cli_after_main_complete")
}

ZV7()
```

**调用时机：**
- 在主函数（main）执行完成后
- 在整个 CLI 生命周期的最末尾
- 是所有事件的终点

**功能：**
- 标记 CLI 执行完成
- 可用于清理资源、收集统计
- 允许插件进行最终操作

### 本项目实现

**状态：** ❌ 未实现

**本项目入口：** `src/cli.ts:1122`

```typescript
// 错误处理
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
});

// 运行
program.parse();
```

本项目直接运行 Commander.js 程序，没有包装主函数，也没有完成事件。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异说明 |
|------|---------|-----------|---------|
| **事件触发** | ✅ 支持 | ❌ 不支持 | 无 cli_after_main_complete 事件 |
| **资源清理** | ✅ 支持 | ⚠️ 部分 | 只有错误处理，无正常完成处理 |
| **统计收集** | ✅ 支持 | ❌ 不支持 | 无法收集完整执行统计 |

---

## 生命周期事件调用顺序

### 官方完整流程

```
1. cli_entry                    # CLI 入口
2. cli_imports_loaded           # 导入加载
3. cli_before_main_import       # 主函数导入前
4. cli_after_main_import        # 主函数导入后
5. action_handler_start         # Action 处理开始
6. action_mcp_configs_loaded    # MCP 配置加载
7. action_after_input_prompt    # 输入提示处理后
8. action_tools_loaded          # 工具加载完成
9. action_before_setup          # 设置前
10. action_after_setup          # 设置后
11. action_commands_loaded      # 命令加载完成
12. action_after_plugins_init   # 插件初始化后
13. action_after_hooks          # Hooks 执行后
14. cli_after_main_complete     # CLI 完成
```

### 本项目流程

本项目没有生命周期事件系统，流程简化为：

```
1. 解析命令行参数
2. 加载 MCP 配置（如果提供）
3. 创建 ConversationLoop
4. 恢复会话（如果需要）
5. 处理初始提示（如果提供）
6. 进入交互循环
```

---

## 总体差异总结

### 功能完成度

| 功能点 | 官方实现 | 本项目实现 | 完成度 |
|--------|---------|-----------|--------|
| T502: action_before_setup | ✅ | ❌ | 0% |
| T503: action_after_setup | ✅ | ❌ | 0% |
| T504: action_handler_start | ✅ | ❌ | 0% |
| T505: action_commands_loaded | ✅ | ❌ | 0% |
| T506: action_tools_loaded | ✅ | ❌ | 0% |
| T507: action_mcp_configs_loaded | ✅ | ❌ | 0% |
| T508: action_after_plugins_init | ✅ | ❌ | 0% |
| T509: action_after_input_prompt | ✅ | ❌ | 0% |
| T510: action_after_hooks | ✅ | ❌ | 0% |
| T511: cli_after_main_complete | ✅ | ❌ | 0% |

**总体完成度：** 0/10 = **0%**

### 核心差异

1. **生命周期系统缺失**
   - 官方：完整的生命周期事件系统，18 个事件覆盖 CLI 和 Action 层
   - 本项目：无生命周期事件系统

2. **Hook 系统范围**
   - 官方：支持 CLI 级和工具级 Hooks
   - 本项目：仅支持工具级 Hooks（PreToolUse, PostToolUse 等）

3. **插件扩展性**
   - 官方：插件可在多个生命周期点介入
   - 本项目：插件系统未完成，无扩展点

4. **监控和审计**
   - 官方：通过生命周期事件支持完整监控
   - 本项目：无系统级监控机制

---

## 实现建议

### 1. 创建生命周期事件系统

**新文件：** `src/lifecycle/index.ts`

```typescript
/**
 * 生命周期事件管理器
 */
export type LifecycleEvent =
  // CLI 级别事件
  | 'cli_entry'
  | 'cli_imports_loaded'
  | 'cli_before_main_import'
  | 'cli_after_main_import'
  | 'cli_after_main_complete'
  // Action 级别事件
  | 'action_handler_start'
  | 'action_mcp_configs_loaded'
  | 'action_after_input_prompt'
  | 'action_tools_loaded'
  | 'action_before_setup'
  | 'action_after_setup'
  | 'action_commands_loaded'
  | 'action_after_plugins_init'
  | 'action_after_hooks';

export type LifecycleEventHandler = (event: LifecycleEvent, data?: unknown) => void | Promise<void>;

class LifecycleManager {
  private handlers: Map<LifecycleEvent, LifecycleEventHandler[]> = new Map();

  /**
   * 注册事件处理器
   */
  on(event: LifecycleEvent, handler: LifecycleEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  /**
   * 触发事件
   */
  async trigger(event: LifecycleEvent, data?: unknown): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      await handler(event, data);
    }
  }

  /**
   * 移除事件处理器
   */
  off(event: LifecycleEvent, handler: LifecycleEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

export const lifecycleManager = new LifecycleManager();

/**
 * 触发生命周期事件的辅助函数
 */
export async function emitLifecycleEvent(event: LifecycleEvent, data?: unknown): Promise<void> {
  await lifecycleManager.trigger(event, data);
}
```

### 2. 在 CLI 中集成生命周期事件

**修改：** `src/cli.ts`

```typescript
import { emitLifecycleEvent } from './lifecycle/index.js';

// 在适当位置触发事件
async function main() {
  await emitLifecycleEvent('cli_entry');

  // ... 导入模块
  await emitLifecycleEvent('cli_imports_loaded');

  // ... 执行主逻辑
  await emitLifecycleEvent('cli_after_main_complete');
}

// Action handler
.action(async (prompt, options) => {
  await emitLifecycleEvent('action_handler_start');

  // ... MCP 配置加载
  await emitLifecycleEvent('action_mcp_configs_loaded');

  // ... 输入提示处理
  await emitLifecycleEvent('action_after_input_prompt');

  // ... 工具加载
  await emitLifecycleEvent('action_tools_loaded');

  // ... 设置前
  await emitLifecycleEvent('action_before_setup');
  // 执行设置
  await emitLifecycleEvent('action_after_setup');

  // ... 命令加载
  await emitLifecycleEvent('action_commands_loaded');

  // ... 插件初始化
  await emitLifecycleEvent('action_after_plugins_init');

  // ... Hooks 执行
  await emitLifecycleEvent('action_after_hooks');
})
```

### 3. 扩展 Hooks 系统

**修改：** `src/hooks/index.ts`

```typescript
// 添加 CLI 级别的 Hook 事件
export type HookEvent =
  // 工具级别（已存在）
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'PermissionRequest'
  // CLI 级别（新增）
  | 'BeforeSetup'
  | 'AfterSetup'
  | 'CommandsLoaded'
  | 'ToolsLoaded'
  | 'McpConfigsLoaded'
  | 'PluginsInitialized'
  | 'AfterHooks';
```

### 4. 完善插件系统

创建完整的插件加载和初始化逻辑，使插件可以监听生命周期事件。

---

## 测试建议

### 单元测试

```typescript
// tests/lifecycle/lifecycle.test.ts
import { lifecycleManager, emitLifecycleEvent } from '../../src/lifecycle/index.js';

describe('Lifecycle Manager', () => {
  it('should trigger event handlers', async () => {
    let triggered = false;

    lifecycleManager.on('cli_entry', () => {
      triggered = true;
    });

    await emitLifecycleEvent('cli_entry');
    expect(triggered).toBe(true);
  });

  it('should support async handlers', async () => {
    let result = 0;

    lifecycleManager.on('action_handler_start', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      result = 42;
    });

    await emitLifecycleEvent('action_handler_start');
    expect(result).toBe(42);
  });
});
```

### 集成测试

```typescript
// tests/integration/lifecycle-flow.test.ts
describe('Lifecycle Flow', () => {
  it('should trigger events in correct order', async () => {
    const events: string[] = [];

    lifecycleManager.on('cli_entry', () => events.push('cli_entry'));
    lifecycleManager.on('action_handler_start', () => events.push('action_handler_start'));
    lifecycleManager.on('cli_after_main_complete', () => events.push('cli_after_main_complete'));

    // 模拟 CLI 执行
    await simulateCLIExecution();

    expect(events).toEqual([
      'cli_entry',
      'action_handler_start',
      'cli_after_main_complete'
    ]);
  });
});
```

---

## 参考资料

1. **官方源码位置：**
   - `/home/user/claude-code-open/node_modules/@anthropic-ai/claude-code/cli.js`
   - 第 4972-4994 行：Action handler 和生命周期事件
   - 第 5038 行：主函数包装和完成事件

2. **本项目源码位置：**
   - `/home/user/claude-code-open/src/cli.ts` - CLI 入口
   - `/home/user/claude-code-open/src/hooks/index.ts` - Hooks 系统

3. **相关文档：**
   - Hooks 系统文档（建议创建）
   - 插件开发指南（建议创建）

---

## 附录：生命周期事件完整列表

### CLI 级别事件

| 事件名 | 触发时机 | 用途 |
|--------|---------|------|
| cli_entry | CLI 入口 | 标记程序启动 |
| cli_imports_loaded | 导入加载完成 | 模块加载完成通知 |
| cli_version_fast_path | 版本快速路径 | 仅 --version 时触发 |
| cli_ripgrep_path | Ripgrep 路径 | 仅 --ripgrep 时触发 |
| cli_claude_in_chrome_mcp_path | Chrome MCP 路径 | Chrome 集成特殊路径 |
| cli_chrome_native_host_path | Chrome 原生主机路径 | Chrome 原生主机特殊路径 |
| cli_before_main_import | 主函数导入前 | 准备导入主模块 |
| cli_after_main_import | 主函数导入后 | 主模块加载完成 |
| cli_after_main_complete | CLI 完成 | 程序执行完成 |

### Action 级别事件

| 事件名 | 触发时机 | 用途 |
|--------|---------|------|
| action_handler_start | Action 处理开始 | 标记 action 启动 |
| action_mcp_configs_loaded | MCP 配置加载 | MCP 服务器配置完成 |
| action_after_input_prompt | 输入提示处理后 | 用户输入处理完成 |
| action_tools_loaded | 工具加载完成 | 工具注册完成 |
| action_before_setup | 设置前 | 准备执行设置 |
| action_after_setup | 设置后 | 设置执行完成 |
| action_commands_loaded | 命令加载完成 | 命令和代理加载完成 |
| action_after_plugins_init | 插件初始化后 | 插件系统初始化完成 |
| action_after_hooks | Hooks 执行后 | Startup hooks 执行完成 |

---

**文档版本：** 1.0
**最后更新：** 2025-12-25
**作者：** Claude Code 开源项目
