# 模块2: 依赖问题修复

## 问题描述
测试文件使用了错误的测试框架导入 (`@jest/globals` 而不是 `vitest`)

## 受影响文件

1. `tests/tools/ask-enhanced.test.ts`
   - 错误: `Cannot find package '@jest/globals'`

## 修复方法

### 查找所有使用 jest 的文件
```bash
grep -r "@jest/globals" tests/
grep -r "from 'jest'" tests/
grep -r 'from "jest"' tests/
```

### 替换导入

```typescript
// 错误
import { describe, it, expect, jest } from '@jest/globals';

// 正确
import { describe, it, expect, vi } from 'vitest';
```

### Jest 到 Vitest 的常见转换

| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `jest.runAllTimers()` | `vi.runAllTimers()` |
| `jest.clearAllMocks()` | `vi.clearAllMocks()` |
| `@jest/globals` | `vitest` |

## 验证命令

```bash
npm test -- tests/tools/ask-enhanced.test.ts
```

## 修复完成标准
- [ ] 无 `@jest/globals` 导入错误
- [ ] 所有 mock 函数使用 `vi` 而不是 `jest`
