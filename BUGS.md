# Bug 清单 - 按模块分类

> 生成时间: 2026-01-02
> 测试统计: 28 个测试文件失败 | 61 个测试失败 | 730 个测试通过

## 修复优先级说明
- **P0**: 阻塞性问题，必须立即修复
- **P1**: 核心功能问题
- **P2**: 次要功能问题
- **P3**: 低优先级 / 可延后

---

## 模块 1: 测试文件结构问题 (P0)

**问题描述**: 多个测试文件报 "No test suite found"，说明测试没有正确定义或导出

**受影响文件**:
- [ ] `tests/config.test.ts`
- [ ] `tests/core/config.test.ts`
- [ ] `tests/core/context.test.ts`
- [ ] `tests/core/loop.test.ts`
- [ ] `tests/core/session.test.ts`
- [ ] `tests/e2e/cli-basic.test.ts`
- [ ] `tests/e2e/cli-session.test.ts`
- [ ] `tests/e2e/cli-tools.test.ts`
- [ ] `tests/e2e/example.test.ts`
- [ ] `src/agents/communication.test.ts`
- [ ] `src/hooks/index.test.ts`
- [ ] `src/permissions/policy.test.ts`
- [ ] `src/permissions/rule-parser.test.ts`
- [ ] `src/permissions/tools.test.ts`
- [ ] `src/context/__tests__/enhanced.test.ts`

**修复建议**:
1. 检查这些文件是否使用了正确的 vitest 语法 (`describe`, `it`, `test`)
2. 移除 `process.exit()` 调用
3. 确保测试函数被正确导出

---

## 模块 2: 依赖问题 (P0)

**问题描述**: 使用了错误的测试框架导入

**受影响文件**:
- [ ] `tests/tools/ask-enhanced.test.ts` - 导入了 `@jest/globals` 应该用 vitest

**修复方法**:
```typescript
// 错误
import { describe, it, expect } from '@jest/globals';

// 正确
import { describe, it, expect } from 'vitest';
```

---

## 模块 3: 构造函数/导出问题 (P0)

**问题描述**: `TaskTool is not a constructor`

**受影响文件**:
- [ ] `tests/tools/agent.test.ts`
- [ ] `src/tools/agent.ts` (或相关导出文件)

**修复建议**:
1. 检查 TaskTool 的导出方式
2. 确保使用 `export class TaskTool` 或正确的默认导出

---

## 模块 4: Integration 测试问题 (P1)

### 4.1 Session Flow Tests (15个全部失败)
**文件**: `tests/integration/session-flow.test.ts`

**修复建议**:
1. 检查 Session 模拟是否正确
2. 检查异步处理

### 4.2 Config Load Tests (7个失败)
**文件**: `tests/integration/config-load.test.ts`

**问题**: ZodError - 配置验证失败

---

## 模块 5: Commands 测试问题 (P1)

### 5.1 Transcript Command (8个全部失败)
**文件**: `tests/commands/transcript.test.ts`

### 5.2 Auth Command (2个失败)
**文件**: `tests/commands/auth.test.ts`
- `should show login options when called without args`
- `should check authentication status`

### 5.3 Session Command (1个失败)
**文件**: `tests/commands/session.test.ts`
- `should handle no previous sessions`

---

## 模块 6: Tools 测试问题 (P1)

### 6.1 Todo Tool (11个失败)
**文件**: `tests/tools/todo.test.ts`

### 6.2 Web Tools (3+3个失败)
**文件**:
- `tests/tools/web.test.ts` (3个失败)
- `tests/tools/web-tools.test.ts` (3个失败)

**问题**: 超时和域名过滤

### 6.3 Search Tool (5个失败)
**文件**: `tests/tools/search.test.ts`

### 6.4 Bash Tool (5个失败)
**文件**: `tests/tools/bash.test.ts`
- 超时处理问题
- 不存在命令处理

---

## 模块 7: Config 问题 (P2)

### 7.1 Config Loader (1个失败)
**文件**: `tests/config/loader.test.ts`
- `应该正确处理无效的环境变量值` - 期望 8192 但得到 32000

---

## 模块 8: Session Manager (P2)

**文件**: `tests/session/manager.test.ts`
- 1个失败, 4个跳过

---

## 分模块修复指南

每个模块可以独立修复，按以下步骤操作：

### 修复模块 X 的命令模板:

```bash
# 1. 只运行该模块的测试
npm test -- --reporter=verbose tests/[模块路径]

# 2. 查看详细错误
npm test -- tests/[文件名] 2>&1 | less

# 3. 修复后验证
npm test -- tests/[文件名]
```

### 快速命令:

```bash
# 模块 1: 测试结构问题
npm test -- tests/config.test.ts tests/core/*.test.ts tests/e2e/*.test.ts

# 模块 4: Integration
npm test -- tests/integration/

# 模块 5: Commands
npm test -- tests/commands/

# 模块 6: Tools
npm test -- tests/tools/

# 模块 7-8: Config & Session
npm test -- tests/config/ tests/session/
```

---

## 修复进度追踪

| 模块 | 状态 | 修复人 | 完成时间 |
|------|------|--------|----------|
| 模块1: 测试结构 | ⏳ 待修复 | - | - |
| 模块2: 依赖问题 | ⏳ 待修复 | - | - |
| 模块3: 构造函数 | ⏳ 待修复 | - | - |
| 模块4: Integration | ⏳ 待修复 | - | - |
| 模块5: Commands | ⏳ 待修复 | - | - |
| 模块6: Tools | ⏳ 待修复 | - | - |
| 模块7: Config | ⏳ 待修复 | - | - |
| 模块8: Session | ⏳ 待修复 | - | - |
