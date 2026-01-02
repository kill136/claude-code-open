# 模块5: Commands 测试问题修复

## 问题描述
Commands 相关测试失败

## 受影响文件

### 5.1 Transcript Command (8个全部失败)
**文件**: `tests/commands/transcript.test.ts`

### 5.2 Auth Command (2个失败)
**文件**: `tests/commands/auth.test.ts`
- `should show login options when called without args`
- `should check authentication status`

### 5.3 Session Command (1个失败)
**文件**: `tests/commands/session.test.ts`
- `should handle no previous sessions`

## 排查步骤

### 1. 查看详细错误
```bash
npm test -- --reporter=verbose tests/commands/transcript.test.ts
npm test -- --reporter=verbose tests/commands/auth.test.ts
npm test -- --reporter=verbose tests/commands/session.test.ts
```

### 2. Transcript Command 问题分析

```bash
# 查看 transcript 命令实现
cat src/commands/transcript.ts
```

### 3. Auth Command 问题

错误信息: `expected "vi.fn()" to be called with arguments`

这通常意味着:
1. Mock 函数没有被正确调用
2. 调用参数不匹配

```typescript
// 检查 mock 设置
const mockOutput = vi.fn();

// 确保被测代码确实调用了这个函数
expect(mockOutput).toHaveBeenCalledWith('assistant', expect.any(String));
```

### 4. Session Command 问题

错误: `expected true to be false`

检查条件逻辑是否正确。

## 验证命令

```bash
npm test -- tests/commands/
```

## 修复完成标准
- [ ] transcript.test.ts 全部通过
- [ ] auth.test.ts 全部通过
- [ ] session.test.ts 全部通过
