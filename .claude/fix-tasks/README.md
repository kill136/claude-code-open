# 分模块 Bug 修复指南

## 概述

本项目有 **61 个测试失败**，分布在 **28 个测试文件**中。为了解决上下文限制问题，我们将修复任务分成 **8 个独立模块**，可以并行处理。

## 快速开始

### 选择一个模块开始修复

| 模块 | 难度 | 预计时间 | 文件 |
|------|------|----------|------|
| [模块2: 依赖问题](./module2-dependencies.md) | 🟢 简单 | 5分钟 | 1个文件 |
| [模块3: 构造函数](./module3-constructor.md) | 🟢 简单 | 10分钟 | 1-2个文件 |
| [模块7: Config](./module7-config.md) | 🟢 简单 | 10分钟 | 1个文件 |
| [模块8: Session](./module8-session.md) | 🟡 中等 | 15分钟 | 1个文件 |
| [模块1: 测试结构](./module1-test-structure.md) | 🟡 中等 | 30分钟 | 15个文件 |
| [模块5: Commands](./module5-commands.md) | 🟡 中等 | 30分钟 | 3个文件 |
| [模块6: Tools](./module6-tools.md) | 🔴 复杂 | 45分钟 | 5个文件 |
| [模块4: Integration](./module4-integration.md) | 🔴 复杂 | 45分钟 | 2个文件 |

### 推荐修复顺序

1. **先修复简单的** (模块2、3、7、8) - 快速减少失败数
2. **再处理结构问题** (模块1) - 消除大量 "No test suite found" 错误
3. **最后处理复杂的** (模块4、5、6) - 需要理解业务逻辑

## 并行处理策略

### 方式1: 多个 Claude Code 实例

```bash
# 终端1: 处理模块1-2
claude "请阅读 .claude/fix-tasks/module1-test-structure.md 和 module2-dependencies.md，然后修复这些问题"

# 终端2: 处理模块3-4
claude "请阅读 .claude/fix-tasks/module3-constructor.md 和 module4-integration.md，然后修复这些问题"

# 终端3: 处理模块5-6
claude "请阅读 .claude/fix-tasks/module5-commands.md 和 module6-tools.md，然后修复这些问题"

# 终端4: 处理模块7-8
claude "请阅读 .claude/fix-tasks/module7-config.md 和 module8-session.md，然后修复这些问题"
```

### 方式2: 使用 Task 子代理

```
请使用 Task 工具并行启动多个 agent 来修复不同的模块，
每个 agent 负责一个模块：

Agent 1: 读取并修复 module1-test-structure.md 的问题
Agent 2: 读取并修复 module2-dependencies.md 的问题
...
```

### 方式3: 顺序处理 (上下文受限时)

每次新对话只处理一个模块：

```
对话1: "请修复 .claude/fix-tasks/module2-dependencies.md 中的问题"
对话2: "请修复 .claude/fix-tasks/module3-constructor.md 中的问题"
...
```

## 验证修复

### 单模块验证
```bash
# 检查特定模块
npm test -- tests/tools/

# 检查是否有新的失败
npm test 2>&1 | grep -E "passed|failed"
```

### 全量验证
```bash
# 运行所有测试
npm test

# 期望看到
# Test Files  0 failed | 39 passed
# Tests       0 failed | 796 passed
```

## 修复进度

在 BUGS.md 中更新修复进度：

| 模块 | 状态 | 修复人 | 完成时间 |
|------|------|--------|----------|
| 模块1 | ⏳ 待修复 | - | - |
| 模块2 | ⏳ 待修复 | - | - |
| ... | ... | ... | ... |

## 注意事项

1. **不要跨模块修改** - 每个模块独立修复，避免冲突
2. **先读后改** - 先理解测试意图，再修改代码
3. **保持测试通过** - 修复后确保不引入新的失败
4. **及时提交** - 每修复一个模块就 commit 一次
5. **参考官方源码** - 如遇困难，查看 `node_modules/@anthropic-ai/claude-code`
