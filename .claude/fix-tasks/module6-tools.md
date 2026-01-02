# 模块6: Tools 测试问题修复

## 问题描述
多个工具测试失败

## 受影响文件

### 6.1 Todo Tool (11个失败)
**文件**: `tests/tools/todo.test.ts`

### 6.2 Web Tools (6个失败)
**文件**:
- `tests/tools/web.test.ts` (3个失败)
- `tests/tools/web-tools.test.ts` (3个失败)

**问题**: 超时和域名过滤

### 6.3 Search Tool (5个失败)
**文件**: `tests/tools/search.test.ts`

### 6.4 Bash Tool (5个失败)
**文件**: `tests/tools/bash.test.ts`

## 排查步骤

### 1. Todo Tool
```bash
npm test -- --reporter=verbose tests/tools/todo.test.ts
```

### 2. Web Tools 问题

#### 超时问题
```typescript
// 增加测试超时
it('should fetch content', async () => {
  // ...
}, { timeout: 60000 });  // 60秒超时
```

#### 域名过滤问题
```bash
# 查看 web 工具实现
cat src/tools/web.ts
```

检查域名过滤逻辑是否正确实现。

### 3. Search Tool
```bash
npm test -- --reporter=verbose tests/tools/search.test.ts
```

可能需要 mock ripgrep 或确保系统有 ripgrep。

### 4. Bash Tool 问题

常见问题:
1. 超时处理 - 确保超时逻辑正确
2. 不存在命令处理 - 检查错误处理逻辑

```bash
npm test -- --reporter=verbose tests/tools/bash.test.ts
```

## 验证命令

```bash
# 分别测试
npm test -- tests/tools/todo.test.ts
npm test -- tests/tools/web.test.ts tests/tools/web-tools.test.ts
npm test -- tests/tools/search.test.ts
npm test -- tests/tools/bash.test.ts

# 一起测试
npm test -- tests/tools/
```

## 修复完成标准
- [ ] todo.test.ts 全部通过
- [ ] web.test.ts 全部通过
- [ ] web-tools.test.ts 全部通过
- [ ] search.test.ts 全部通过
- [ ] bash.test.ts 全部通过
