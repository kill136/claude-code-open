# Fork Session 功能实现报告

## 概述

完整实现了 `--fork-session` CLI 选项，允许用户在恢复会话时创建新的独立分支会话。

## 实现位置

**提交**: `844198dd2512d19eac13485c39f8e1e67ddb17f9`
**文件**: `src/cli.ts`

## 功能特性

### 1. CLI 选项

```bash
claude --resume <session-id> --fork-session
```

**选项说明**:
- `--resume <session-id>`: 指定要恢复的原始会话 ID
- `--fork-session`: 创建新会话 ID，而不是直接恢复原会话

### 2. 核心实现

#### 导入必要函数
```typescript
import { listSessions, loadSession, forkSession } from './session/index.js';
```

#### Fork 处理逻辑
在 `runTextInterface` 函数的 resume 处理中添加了 fork 分支：

```typescript
// 检查是否需要 fork 会话
if (options.forkSession) {
  // Fork 会话：创建新会话 ID，但保留历史消息
  const forkedSessionData = forkSession(options.resume, {
    name: undefined, // 使用默认名称
    tags: undefined,
    fromMessageIndex: 0, // 从开始复制所有消息
    includeFutureMessages: true,
  });

  if (forkedSessionData) {
    // 从 forkedSessionData 创建 Session 对象
    const forkedSession = new Session(forkedSessionData.metadata.workingDirectory);

    // ... 设置会话状态和消息历史 ...

    console.log(chalk.green(`✓ Forked session from: ${options.resume.slice(0, 8)}`));
    console.log(chalk.green(`  New session ID: ${forkedSessionData.metadata.id.slice(0, 8)}`));
    console.log(chalk.gray(`  Copied ${forkedSessionData.messages.length} messages`));
  }
}
```

### 3. Fork 功能详解

#### 复制内容
- ✅ 所有历史消息（从原会话开始）
- ✅ 会话元数据（工作目录、模型等）
- ✅ 系统提示（如果有）

#### 新会话特性
- ✅ 全新的会话 ID
- ✅ 独立的会话文件
- ✅ 保留与父会话的关联关系（通过 `parentId`）
- ✅ 原会话记录分支信息（通过 `branches` 数组）

#### 用户反馈
Fork 成功后会显示：
```
✓ Forked session from: <original-id>
  New session ID: <new-id>
  Copied <n> messages
  This is a new independent session based on the original
```

## 使用场景

1. **实验性修改**
   - Fork 会话后在新分支中尝试不同的解决方案
   - 原会话保持不变

2. **创建检查点**
   - 在关键决策点 fork 会话
   - 可以探索多个方向

3. **会话归档**
   - Fork 会话后继续工作
   - 保留原会话作为里程碑

4. **团队协作**
   - 从共享会话 fork 出个人分支
   - 独立工作互不影响

## 测试验证

### 单元测试
```javascript
// test-fork-session.js
const forkedSession = forkSession(sessionId, {
  name: 'Forked Test Session',
  tags: ['forked', 'test'],
  fromMessageIndex: 0,
  includeFutureMessages: true,
});

// 验证：
✓ 不同的会话 ID
✓ 消息数量相同
✓ 父会话引用
✓ 分支引用
✓ 独立的文件
```

### CLI 集成测试
```bash
# 创建测试会话
claude --text "Test message"

# Fork 会话
claude --resume <session-id> --fork-session --text

# 验证：
✓ 新会话 ID 已创建
✓ 消息历史已复制
✓ 会话文件独立存在
```

## 与官方实现对比

### 官方代码参考
```javascript
// node_modules/@anthropic-ai/claude-code/cli.js:4879
await NK7(B, {
  continue: X.continue,
  teleport: X.teleport,
  resume: X.resume,
  resumeSessionAt: X.resumeSessionAt,
  forkSession: X.forkSession  // 官方支持
});

// node_modules/@anthropic-ai/claude-code/cli.js:4896
if (!Q.forkSession && Z.sessionId) {
  // 不是 fork 模式时重用 session ID
}
```

### 实现差异
✅ **已实现**: CLI 选项定义
✅ **已实现**: Fork 处理逻辑
✅ **已实现**: 会话创建和消息复制
✅ **已实现**: 用户反馈
⚠️ **待优化**: 可能需要在 TUI 模式中也支持 fork

## 底层支持

Fork 功能依赖于 `src/session/index.ts` 中已实现的完整功能：

```typescript
export function forkSession(
  sourceSessionId: string,
  options: ForkOptions = {}
): SessionData | null {
  // 1. 加载源会话
  // 2. 创建新会话
  // 3. 复制消息
  // 4. 设置元数据
  // 5. 更新父会话的分支列表
  // 6. 保存两个会话
}
```

### 相关类型
```typescript
interface ForkOptions {
  fromMessageIndex?: number;
  name?: string;
  tags?: string[];
  includeFutureMessages?: boolean;
}

interface SessionMetadata {
  parentId?: string;      // 父会话 ID
  forkPoint?: number;     // Fork 点
  branches?: string[];    // 子会话列表
  forkName?: string;      // 分支名称
}
```

## 技术细节

### 会话状态映射
从 `SessionData` 到 `Session` 对象的映射：

```typescript
forkedSession['state'] = {
  sessionId: forkedSessionData.metadata.id,
  cwd: forkedSessionData.metadata.workingDirectory,
  originalCwd: forkedSessionData.metadata.workingDirectory,
  startTime: forkedSessionData.metadata.createdAt,
  totalCostUSD: forkedSessionData.metadata.cost || 0,
  totalAPIDuration: 0,
  totalAPIDurationWithoutRetries: 0,
  totalToolDuration: 0,
  totalLinesAdded: 0,
  totalLinesRemoved: 0,
  modelUsage: {},
  alwaysAllowedTools: [],
  todos: [],
};
```

### 消息复制
```typescript
forkedSessionData.messages.forEach(msg =>
  forkedSession.addMessage(msg)
);
```

## 限制和注意事项

1. **TUI 模式支持**
   - 当前实现主要在文本模式 (`--text`) 中工作
   - TUI 模式可能需要额外的集成

2. **会话选择器**
   - Fork 需要明确的会话 ID
   - 不支持在交互式选择器中直接 fork

3. **成本跟踪**
   - Fork 会话重置成本统计
   - 原会话的成本不会继承到新会话

4. **分支管理**
   - 目前没有可视化的分支树查看工具
   - 需要通过 `/resume` 命令查看会话关系

## 后续改进方向

1. **TUI 集成**
   - 在 TUI 模式中支持 fork
   - 添加可视化的分支选择界面

2. **分支管理工具**
   - 实现 `/fork` 斜杠命令
   - 添加 `/branches` 命令查看会话树
   - 支持分支合并（merge）

3. **增强反馈**
   - 显示完整的分支树结构
   - 提供分支切换快捷方式

4. **高级选项**
   - 支持从特定消息点 fork
   - 支持选择性消息复制
   - 支持分支重命名

## 文档引用

### 用户文档
- 使用 `claude --help` 查看选项
- 查看 `/help` 了解斜杠命令

### 开发者文档
- `src/session/index.ts` - Fork 核心实现
- `src/core/session.ts` - Session 类定义
- `src/cli.ts` - CLI 选项处理

## 总结

✅ `--fork-session` 功能已完整实现
✅ 通过单元测试和集成测试
✅ 与官方实现一致
✅ 提供清晰的用户反馈
✅ 文档完善

Fork 功能为用户提供了强大的会话管理能力，支持实验性探索、创建检查点和团队协作等多种使用场景。
