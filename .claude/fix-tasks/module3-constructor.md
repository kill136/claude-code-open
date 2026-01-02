# 模块3: 构造函数/导出问题修复

## 问题描述
`TypeError: __vite_ssr_import_23__.TaskTool is not a constructor`

## 受影响文件
1. `tests/tools/agent.test.ts`
2. 源文件: `src/tools/agent.ts` 或相关工具导出

## 排查步骤

### 1. 检查 TaskTool 的导出方式
```bash
# 查找 TaskTool 定义
grep -r "class TaskTool" src/
grep -r "export.*TaskTool" src/
```

### 2. 常见问题

#### 问题A: 默认导出 vs 命名导出不匹配
```typescript
// 源文件 (src/tools/agent.ts)
export default class TaskTool {}  // 默认导出

// 测试文件 (错误)
import { TaskTool } from '../src/tools/agent';  // 命名导入

// 测试文件 (正确)
import TaskTool from '../src/tools/agent';  // 默认导入
```

#### 问题B: 导出的是实例而不是类
```typescript
// 错误的源文件
export const TaskTool = new SomeClass();  // 导出实例

// 正确的源文件
export class TaskTool extends BaseTool {}  // 导出类
```

#### 问题C: 循环依赖
检查是否存在循环依赖导致类在导入时未定义

### 3. 检查 index.ts 导出桶
```bash
cat src/tools/index.ts
```

## 验证命令

```bash
npm test -- tests/tools/agent.test.ts
```

## 修复完成标准
- [ ] TaskTool 可以正常实例化
- [ ] agent.test.ts 测试通过
