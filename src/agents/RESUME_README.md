# Agent Resume Mechanism

代理恢复机制 (Agent Resume) 提供了完整的代理状态持久化、恢复和检查点管理功能。

## 概述

代理恢复机制允许:
- 保存代理执行状态到磁盘 (`~/.claude/agents/`)
- 从中断点恢复代理执行
- 创建和管理执行检查点
- 处理执行失败和重试
- 清理过期的代理状态

## 核心组件

### 1. AgentStateManager

状态管理器负责代理状态的持久化操作。

```typescript
import { AgentStateManager } from './agents/resume.js';

const stateManager = new AgentStateManager();

// 保存状态
await stateManager.saveState(agentState);

// 加载状态
const state = await stateManager.loadState(agentId);

// 列出所有代理
const states = await stateManager.listStates();

// 删除状态
await stateManager.deleteState(agentId);

// 清理过期状态 (30天)
const cleaned = await stateManager.cleanupExpired();
```

### 2. AgentResumer

恢复器负责代理的恢复和检查点管理。

```typescript
import { AgentResumer } from './agents/resume.js';

const resumer = new AgentResumer(stateManager);

// 检查是否可以恢复
const canResume = await resumer.canResume(agentId);

// 恢复代理执行
const state = await resumer.resume({
  agentId,
  continueFrom: 'last',
  resetErrors: true,
});
```

### 3. 检查点系统

```typescript
import { createAgentCheckpoint } from './agents/resume.js';

// 创建检查点
const checkpoint = createAgentCheckpoint(agentState, 'After phase 1');

// 保存检查点
await stateManager.saveCheckpoint(checkpoint);
```

## 使用示例

```typescript
import {
  getDefaultStateManager,
  getDefaultResumer,
  createInitialAgentState,
  createAgentCheckpoint,
} from './agents/resume.js';

// 创建代理状态
const state = createInitialAgentState(
  'general-purpose',
  'Analyze codebase',
  {
    description: 'Code analysis',
    maxRetries: 5,
  }
);

// 保存状态
const stateManager = getDefaultStateManager();
await stateManager.saveState(state);

// 恢复代理
const resumer = getDefaultResumer();
const resumedState = await resumer.resume({
  agentId: state.id,
  continueFrom: 'last',
});
```

## 存储位置

- **代理状态**: `~/.claude/agents/{agentId}.json`
- **检查点**: `~/.claude/agents/checkpoints/{agentId}/{checkpointId}.json`

## API 文档

详细API文档请参考源代码中的 TypeScript 类型定义。

