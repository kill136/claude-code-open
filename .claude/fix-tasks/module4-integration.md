# 模块4: Integration 测试问题修复

## 问题描述
Integration 测试批量失败

## 受影响文件

### 4.1 Session Flow Tests (15个全部失败)
**文件**: `tests/integration/session-flow.test.ts`

### 4.2 Config Load Tests (7个失败)
**文件**: `tests/integration/config-load.test.ts`
**问题**: ZodError - 配置验证失败

## 排查步骤

### 1. 查看详细错误
```bash
npm test -- --reporter=verbose tests/integration/session-flow.test.ts 2>&1 | head -200
npm test -- --reporter=verbose tests/integration/config-load.test.ts 2>&1 | head -200
```

### 2. Session Flow 常见问题

#### 问题A: Mock 不正确
```typescript
// 确保正确 mock 依赖
vi.mock('../src/core/session', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    save: vi.fn(),
    // ... 其他方法
  }))
}));
```

#### 问题B: 异步处理问题
```typescript
// 确保等待异步操作
await expect(someAsyncOperation()).resolves.toBe(expected);
```

### 3. Config Load 常见问题

#### ZodError 解决方案
检查测试配置是否符合 Zod schema:
```typescript
// 查看配置 schema
// src/types/config.ts 或 src/config/schema.ts

// 测试中使用正确的配置结构
const testConfig = {
  // 确保所有必填字段都有值
  // 确保类型正确
};
```

## 验证命令

```bash
npm test -- tests/integration/
```

## 修复完成标准
- [ ] session-flow.test.ts 全部通过
- [ ] config-load.test.ts 全部通过
- [ ] 无 ZodError
