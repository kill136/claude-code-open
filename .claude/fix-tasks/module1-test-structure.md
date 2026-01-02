# 模块1: 测试文件结构问题修复

## 问题描述
多个测试文件报 "No test suite found in file"，说明测试没有正确定义或导出。

## 受影响文件 (15个)

### 优先处理 - tests/ 目录
1. `tests/config.test.ts`
2. `tests/core/config.test.ts`
3. `tests/core/context.test.ts`
4. `tests/core/loop.test.ts`
5. `tests/core/session.test.ts`
6. `tests/e2e/cli-basic.test.ts`
7. `tests/e2e/cli-session.test.ts`
8. `tests/e2e/cli-tools.test.ts`
9. `tests/e2e/example.test.ts`

### 次要 - src/ 目录 (可能是示例文件)
10. `src/agents/communication.test.ts`
11. `src/hooks/index.test.ts`
12. `src/permissions/policy.test.ts`
13. `src/permissions/rule-parser.test.ts`
14. `src/permissions/tools.test.ts`
15. `src/context/__tests__/enhanced.test.ts`

## 常见问题和修复方法

### 问题1: 使用了 process.exit()
```typescript
// 错误写法
runTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);  // 这会导致 vitest 报错
});

// 正确写法 - 删除这段代码，或改为:
// 在 vitest 中不需要手动运行测试
```

### 问题2: 测试没有用 describe/it 包裹
```typescript
// 错误写法
async function runTests() {
  // 测试代码...
}
runTests();

// 正确写法
import { describe, it, expect } from 'vitest';

describe('MyTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

### 问题3: 文件只是空壳或占位符
如果文件确实没有测试内容，可以：
1. 添加至少一个测试
2. 或者重命名为 `.example.ts`
3. 或者在 vitest.config.ts 中排除

## 验证命令

```bash
# 检查单个文件
npm test -- tests/config.test.ts

# 检查所有 core 测试
npm test -- tests/core/

# 检查所有 e2e 测试
npm test -- tests/e2e/

# 检查 src 内的测试
npm test -- src/**/*.test.ts
```

## 修复完成标准
- [ ] 所有文件不再报 "No test suite found"
- [ ] 测试可以正常运行
- [ ] 无 process.exit() 相关错误
