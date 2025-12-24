# /init 命令文档

## 概述

`/init` 命令用于初始化 Claude Code 项目配置，基于官方 Claude Code v2.0.59 实现。

## 功能

### 新项目初始化

当项目中不存在 `CLAUDE.md` 或 `.claude/` 目录时，命令会：

1. **智能分析代码库**
   - 扫描项目结构
   - 读取 README.md
   - 检查 Cursor rules (.cursor/rules/, .cursorrules)
   - 检查 Copilot instructions (.github/copilot-instructions.md)
   - 识别技术栈和框架

2. **生成 CLAUDE.md**
   - 项目概述
   - 常用开发命令（构建、测试、运行等）
   - 高层次代码架构说明
   - 重要的开发注意事项
   - 标准文件头

3. **创建 .claude/ 目录结构**
   - `.claude/` - 配置目录
   - `.claude/commands/` - 自定义命令目录
   - 建议添加 `.claude/` 到 .gitignore

### 已有配置改进

当项目已存在配置时，命令会：

1. **检测现有配置**
   - 列出已存在的配置文件
   - 识别配置的覆盖范围

2. **分析并建议改进**
   - CLAUDE.md 是否完整？
   - 是否包含关键命令？
   - 架构说明是否充分？
   - .claude/ 目录是否有用？
   - 缺少哪些重要配置？

## 使用方法

```bash
/init
```

无需参数，命令会自动检测项目状态。

## 示例

### 场景 1: 新的 TypeScript 项目

```
用户: /init

Claude: Initializing Claude Code configuration for this project...

I'll analyze your codebase and create:
  • CLAUDE.md - Project documentation and guidance
  • .claude/ - Configuration directory
  • .claude/commands/ - Custom commands directory

This will help future Claude Code instances understand your project better.

[然后 Claude 会分析代码库并创建配置文件]
```

### 场景 2: 已有 CLAUDE.md 的项目

```
用户: /init

Claude: Claude Code is already initialized in this project.

Found existing configuration:
  • CLAUDE.md

I'll analyze your codebase and suggest improvements to your configuration.

[然后 Claude 会分析并提供改进建议]
```

## 生成的 CLAUDE.md 示例

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based terminal application that provides an AI assistant with 25+ tools for file operations, code analysis, web access, and system commands.

## Development Commands

### Building and Running
```bash
# Development mode (live TypeScript execution)
npm run dev

# Build TypeScript to dist/
npm run build

# Run compiled version
npm run start

# Type checking without compiling
npx tsc --noEmit
```

### Testing
```bash
npm test
```

## Architecture Overview

### Core Three-Layer Design

1. **Entry Layer** (`src/cli.ts`, `src/index.ts`)
   - CLI argument parsing with Commander.js
   - Main export barrel file

2. **Core Engine** (`src/core/`)
   - `client.ts` - Anthropic API wrapper
   - `session.ts` - Session state management
   - `loop.ts` - Main conversation orchestrator

3. **Tool System** (`src/tools/`)
   - All tools extend `BaseTool` and register in `ToolRegistry`
   - 25 tools including: Bash, Read, Write, Edit, etc.

## Important Notes

- This is an educational reverse-engineering project
- Use ES Modules (`import`/`export` syntax)
- Target: Node.js 18+, ES2022
- Strict TypeScript mode enabled
```

## 技术实现

### 官方源码对照

本实现基于官方 Claude Code v2.0.59 源码：

```typescript
// 官方实现（简化版）
{
  type: "prompt",
  name: "init",
  description: "Initialize a new CLAUDE.md file with codebase documentation",
  progressMessage: "analyzing your codebase",
  async getPromptForCommand() {
    return [{
      type: "text",
      text: `Please analyze this codebase and create a CLAUDE.md file...`
    }]
  }
}
```

### 当前项目实现

```typescript
export const initCommand: SlashCommand = {
  name: 'init',
  description: 'Initialize Claude Code configuration for this project',
  category: 'config',
  execute: (ctx: CommandContext): CommandResult => {
    // 检测现有配置
    const alreadyInitialized = fs.existsSync(claudeMdPath) || fs.existsSync(claudeDir);

    if (alreadyInitialized) {
      // 发送改进提示
      ctx.ui.addMessage('user', improvementPrompt);
    } else {
      // 发送初始化提示
      ctx.ui.addMessage('user', initPrompt);
    }

    return { success: true };
  }
}
```

## 核心提示词规则

命令遵循以下规则（来自官方源码）：

1. ✅ **包含什么**
   - 常用命令（构建、测试、运行）
   - 高层次架构（需要读多个文件才能理解的）
   - Cursor/Copilot 规则的重要部分
   - README.md 的重要部分

2. ❌ **不包含什么**
   - 明显的指令（"提供有用的错误消息"）
   - 每个组件的详细列表
   - 通用开发实践
   - 编造的信息

3. 📝 **格式要求**
   - 必须以标准头开始
   - 不要重复
   - 聚焦"大局"架构

## 与官方的差异

| 特性 | 官方实现 | 当前实现 |
|------|----------|----------|
| 命令类型 | `type: "prompt"` | `SlashCommand` |
| 执行方式 | 返回提示对象 | `ctx.ui.addMessage()` |
| 提示词 | ✅ 完全相同 | ✅ 完全相同 |
| 功能 | ✅ 智能分析 | ✅ 智能分析 |
| 改进建议 | ✅ 支持 | ✅ 支持 |

## 最佳实践

1. **首次使用**
   - 在新项目中尽早运行 `/init`
   - 让 Claude 充分分析代码库
   - 检查生成的 CLAUDE.md 是否准确

2. **定期更新**
   - 项目架构重大变更后运行 `/init`
   - 添加新的开发流程后更新
   - 定期检查配置是否还符合当前项目

3. **自定义命令**
   - 在 `.claude/commands/` 创建项目特定命令
   - 为常见工作流创建快捷命令
   - 记录在 CLAUDE.md 中

## 相关命令

- `/memory` - 查看或编辑 CLAUDE.md
- `/config` - 查看和修改配置
- `/help` - 查看所有可用命令

## 参考资料

- 官方文档: https://code.claude.com/docs
- CLAUDE.md 规范: https://code.claude.com/docs/en/memory
- 自定义命令: https://code.claude.com/docs/en/custom-commands
