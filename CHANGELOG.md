# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **macOS Keychain API Key 存储**
  - 使用 macOS 系统 Keychain 安全存储 Anthropic API Key
  - 自动平台检测（仅在 macOS 上启用）
  - 优先级：Keychain > 配置文件 > 环境变量
  - 与现有认证系统无缝集成
  - 支持从文件迁移到 Keychain
  - 新增函数：`saveToKeychain()`, `loadFromKeychain()`, `deleteFromKeychain()`, `migrateToKeychain()`
  - 详细文档位于 `docs/keychain.md`
  - 演示脚本位于 `examples/keychain-demo.ts`

- `/transcript` 命令：导出会话对话转录记录
  - 支持纯文本格式输出，优化了人类阅读体验
  - 可导出到文件或在终端中显示
  - 包含完整的会话元数据、消息历史和工具调用记录
  - 智能内容截断，避免文件过大
  - 命令别名 `/trans`
  - 详细文档位于 `docs/commands/transcript.md`

### Changed
- 更新认证系统优先级，添加 Keychain 作为凭证来源
- `setApiKey()` 函数新增 `useKeychain` 参数，默认启用

## [2.0.76] - 2024-12-30

### Added
- 完整的命令系统实现
  - 通用命令：help, clear, exit, status, doctor, bug, version, memory, plan
  - 会话管理：resume, context, compact, rewind, rename, export
  - 配置管理：config, set, get, reset
  - 认证相关：login, logout, whoami, billing
  - MFA 支持：mfa-status, mfa-enable, mfa-disable, mfa-codes
  - 工具管理：tools, allow-tool, disallow-tool, reset-tools
  - 实用工具：todos, files, dirs, weather, feedback
  - 开发调试：inspect, agents, test-streaming

### Documentation
- 添加了官方与本项目的提示词对比文档
- 添加了功能清单，覆盖所有 CHANGELOG 版本
- 完善了 MCP 工具修复总结文档

## [2.0.0] - 2024-12-01

### Added
- 初始版本发布
- 基于官方 Claude Code CLI v2.0.76 的教育性重构项目
- 完整的工具系统（25+ 工具）
- 会话管理和持久化
- TypeScript + Node.js 实现
- React + Ink 终端 UI

---

## 版本说明

- **[Unreleased]**: 未发布的开发中功能
- **[2.0.76]**: 当前稳定版本，与官方版本号对齐
- **[2.0.0]**: 初始发布版本
