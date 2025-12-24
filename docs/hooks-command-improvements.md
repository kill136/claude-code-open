# Hooks 命令完善说明

## 概述

从官方 Claude Code CLI v2.0.76 源码中提取并完善了 `/hooks` 命令，使其功能完整可用。

## 变更内容

### 1. 新增所有官方钩子类型

基于官方源码，添加了完整的 12 种钩子类型：

- **PreToolUse** - 工具执行前运行
- **PostToolUse** - 工具执行成功后运行
- **PostToolUseFailure** - 工具执行失败后运行
- **Notification** - 处理系统通知
- **UserPromptSubmit** - 用户提交提示时运行
- **SessionStart** - 会话开始时运行
- **SessionEnd** - 会话结束时运行
- **Stop** - 操作停止时运行
- **SubagentStart** - 子代理启动时运行
- **SubagentStop** - 子代理停止时运行
- **PreCompact** - 上下文压缩前运行
- **PermissionRequest** - 权限请求时运行

### 2. 钩子实现类型

支持三种钩子实现方式（官方源码定义）：

#### Command Hook（命令钩子）
```json
{
  "type": "command",
  "command": "echo 'Running command'",
  "timeout": 5,
  "statusMessage": "Executing..."
}
```

#### Prompt Hook（LLM 提示钩子）
```json
{
  "type": "prompt",
  "prompt": "Check if output contains errors. Context: $ARGUMENTS",
  "model": "claude-haiku-4-20250514",
  "timeout": 30,
  "statusMessage": "Analyzing..."
}
```

#### Agent Hook（代理验证钩子）
```json
{
  "type": "agent",
  "prompt": "Verify tests passed. Context: $ARGUMENTS",
  "model": "claude-haiku-4-20250514",
  "timeout": 60,
  "statusMessage": "Verifying..."
}
```

### 3. 新增命令功能

#### `/hooks` 或 `/hooks list`
显示当前配置的钩子，包括：
- 钩子状态（已配置/未配置/已禁用）
- 配置文件位置
- 已配置钩子的详细信息
- 可用命令列表

#### `/hooks types`
显示所有可用的钩子类型和实现方式：
- 12种钩子类型的详细说明
- 每种类型的应用场景示例
- 3种钩子实现方式及其字段说明

#### `/hooks examples`
显示详细的配置示例：
- 命令钩子示例
- LLM 提示钩子示例
- 代理验证钩子示例
- SessionStart 钩子示例
- 多个匹配器和钩子组合示例

#### `/hooks disable`
禁用所有钩子：
- 设置 `disableAllHooks: true`
- 保留钩子配置但不执行
- 提供重新启用说明

#### `/hooks enable`
重新启用钩子：
- 移除 `disableAllHooks` 设置
- 恢复钩子执行

## 配置示例

### 基本配置结构

```json
{
  "hooks": {
    "HookType": [
      {
        "matcher": "ToolName",  // 可选，匹配特定工具
        "hooks": [
          {
            "type": "command|prompt|agent",
            // 其他配置...
          }
        ]
      }
    ]
  }
}
```

### 实际配置示例

#### 1. 文件写入前记录日志

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Writing file at' $(date) | tee -a ~/claude-operations.log",
            "timeout": 5,
            "statusMessage": "Logging file write operation..."
          }
        ]
      }
    ]
  }
}
```

#### 2. Bash 命令执行后检查错误

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Analyze the command output in $ARGUMENTS. If there are errors or warnings, explain what they mean and suggest fixes.",
            "model": "claude-haiku-4-20250514",
            "timeout": 30,
            "statusMessage": "Analyzing command output..."
          }
        ]
      }
    ]
  }
}
```

#### 3. 会话启动时初始化环境

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "git status && npm install && echo 'Environment ready'",
            "timeout": 120,
            "statusMessage": "Initializing development environment..."
          }
        ]
      }
    ]
  }
}
```

#### 4. 测试后验证结果

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests passed successfully. If any tests failed, analyze the failures and suggest fixes. Test results: $ARGUMENTS",
            "model": "claude-sonnet-4-5-20250929",
            "timeout": 60,
            "statusMessage": "Verifying test results..."
          }
        ]
      }
    ]
  }
}
```

## 配置说明

### Matcher（匹配器）
- **可选字段**：省略表示应用于所有工具
- **工具名称**：如 "Write", "Edit", "Bash" 等
- **示例**：`"matcher": "Bash"` 仅匹配 Bash 工具

### 占位符
- **$ARGUMENTS**：在 prompt 和 agent 类型中，会被替换为钩子输入的 JSON 数据
- 包含工具调用的完整上下文信息

### Timeout（超时）
- 单位：秒
- 默认值：根据钩子类型不同而不同
- 建议：command (5-30s), prompt (30-60s), agent (60-120s)

### StatusMessage（状态消息）
- 在钩子执行时显示的自定义消息
- 帮助用户了解当前正在执行的操作

## 使用场景

### 1. 开发流程自动化
- 代码提交前自动运行 linter
- 文件修改后自动格式化
- 测试运行后自动分析结果

### 2. 安全和合规
- 敏感操作前的权限检查
- 文件写入的审计日志
- 危险命令的二次确认

### 3. 质量保证
- 代码变更后自动运行测试
- 构建失败时的智能分析
- 性能指标的自动收集

### 4. 团队协作
- 操作通知到团队频道
- 自动更新项目文档
- 生成变更日志

## 技术实现

### 源码位置
- 文件：`/home/user/claude-code-open/src/commands/config.ts`
- 行数：599-932（完善后的 hooks 命令）

### 参考来源
- 官方 CLI：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 钩子类型定义：官方源码第 1511 行附近
- 配置 schema：官方源码 Zod 验证逻辑

### 编译验证
```bash
npm run build
# ✓ 编译成功，无错误
```

## 后续可能改进

1. **交互式配置向导**：通过命令行交互式创建钩子配置
2. **钩子模板库**：提供常用场景的预设钩子模板
3. **钩子执行日志**：记录钩子执行历史和结果
4. **钩子性能监控**：跟踪钩子执行时间和资源消耗
5. **钩子调试模式**：详细输出钩子执行过程

## 相关文档

- [官方 Hooks 文档](https://code.claude.com/docs/hooks)
- [配置文件说明](https://code.claude.com/docs/settings)
- [安全最佳实践](https://code.claude.com/docs/security)

## 总结

通过从官方源码中提取完整的钩子系统定义，`/hooks` 命令现在完全实现了以下功能：

✅ 显示所有 12 种官方钩子类型
✅ 支持 3 种钩子实现方式（command, prompt, agent）
✅ 提供详细的配置示例和说明
✅ 支持启用/禁用钩子功能
✅ 完整的类型安全和编译通过

用户现在可以通过 `/hooks` 命令完整了解和管理 Claude Code 的钩子系统。
