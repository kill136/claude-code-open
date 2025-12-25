# Agent Resume 功能使用指南

## 概述

Agent 工具现已支持完整的状态持久化和恢复功能。当代理执行被中断、失败或暂停时，可以使用 `resume` 参数从中断点继续执行。

## 功能特性

### 1. 状态持久化
- 所有代理状态自动保存到 `~/.claude/agents/` 目录
- 保存内容包括：
  - 代理 ID、类型、描述
  - 原始 prompt 和模型配置
  - 执行历史记录
  - 中间结果
  - 当前步骤和进度
  - 工作目录和元数据

### 2. 执行历史
每个代理维护完整的执行历史，包括：
- `started`: 代理启动
- `progress`: 执行进度更新
- `completed`: 执行完成
- `failed`: 执行失败
- `resumed`: 从中断点恢复

### 3. 状态管理
代理支持四种状态：
- `running`: 正在执行
- `completed`: 已完成
- `failed`: 执行失败
- `paused`: 已暂停

## 使用示例

### 启动一个后台代理

```typescript
{
  "name": "Task",
  "input": {
    "description": "代码库分析",
    "prompt": "分析整个代码库的架构和设计模式",
    "subagent_type": "Explore",
    "model": "sonnet",
    "run_in_background": true
  }
}
```

返回结果：
```
Agent started in background with ID: abc-123-def-456
Use TaskOutput tool to check progress.
```

### 查看代理状态

```typescript
{
  "name": "TaskOutput",
  "input": {
    "task_id": "abc-123-def-456",
    "show_history": true
  }
}
```

### 恢复失败或暂停的代理

```typescript
{
  "name": "Task",
  "input": {
    "description": "继续分析",
    "prompt": "继续之前的分析任务",
    "subagent_type": "Explore",
    "resume": "abc-123-def-456"
  }
}
```

恢复时会显示：
```
Resuming agent abc-123-def-456
Type: Explore
Description: 代码库分析
Original prompt: 分析整个代码库的架构和设计模式
Current step: 3/5

Execution history:
  [2025-01-15T10:00:00Z] STARTED: Agent started with type Explore
  [2025-01-15T10:00:05Z] PROGRESS: Completed step 1/5
  [2025-01-15T10:00:10Z] PROGRESS: Completed step 2/5
  [2025-01-15T10:00:15Z] FAILED: Connection timeout
```

### 列出所有代理

```typescript
{
  "name": "ListAgents",
  "input": {
    "status_filter": "paused",
    "include_completed": false
  }
}
```

返回结果：
```
=== Background Agents (2) ===

1. Agent ID: abc-123-def-456
   Type: Explore
   Status: paused
   Description: 代码库分析
   Started: 2025-01-15T10:00:00.000Z
   Progress: 3/5 steps
   → Can be resumed with: resume="abc-123-def-456"

2. Agent ID: xyz-789-ghi-012
   Type: Plan
   Status: failed
   Description: 架构设计
   Started: 2025-01-15T09:30:00.000Z
   Progress: 2/10 steps
   Duration: 45.23s
   → Can be resumed with: resume="xyz-789-ghi-012"
```

### 暂停运行中的代理

```typescript
import { pauseBackgroundAgent } from './tools/agent.js';

pauseBackgroundAgent('abc-123-def-456');
```

### 清理已完成的代理

```typescript
import { clearCompletedAgents } from './tools/agent.js';

const cleared = clearCompletedAgents();
console.log(`Cleared ${cleared} completed agents`);
```

## API 参考

### AgentTool

**输入参数：**
- `description` (必需): 任务简短描述 (3-5 词)
- `prompt` (必需): 代理执行的任务详细说明
- `subagent_type` (必需): 代理类型 (general-purpose, Explore, Plan, claude-code-guide)
- `model` (可选): 使用的模型 (sonnet, opus, haiku)
- `resume` (可选): 要恢复的代理 ID
- `run_in_background` (可选): 是否在后台运行

**Resume 行为：**
- 验证代理是否存在
- 检查状态是否可恢复（不能恢复正在运行或已完成的代理）
- 显示执行历史和中间结果
- 从中断点继续执行

### TaskOutputTool

**输入参数：**
- `task_id` (必需): 代理 ID
- `block` (可选): 是否等待完成
- `timeout` (可选): 最大等待时间（毫秒，默认 5000）
- `show_history` (可选): 是否显示详细历史

**输出内容：**
- 代理基本信息
- 执行状态和进度
- 执行历史（如果 show_history=true）
- 中间结果
- 最终结果或错误信息

### ListAgentsTool

**输入参数：**
- `status_filter` (可选): 按状态过滤 (running, completed, failed, paused)
- `include_completed` (可选): 是否包含已完成的代理（默认 false）

**输出内容：**
- 所有匹配的代理列表
- 每个代理的基本信息和状态
- 可恢复代理的提示

## 持久化存储

### 存储位置
- Linux/macOS: `~/.claude/agents/`
- Windows: `%USERPROFILE%\.claude\agents\`

### 文件格式
每个代理保存为单独的 JSON 文件：`{agent-id}.json`

```json
{
  "id": "abc-123-def-456",
  "agentType": "Explore",
  "description": "代码库分析",
  "prompt": "分析整个代码库的架构和设计模式",
  "model": "sonnet",
  "status": "paused",
  "startTime": "2025-01-15T10:00:00.000Z",
  "history": [
    {
      "timestamp": "2025-01-15T10:00:00.000Z",
      "type": "started",
      "message": "Agent started with type Explore"
    }
  ],
  "intermediateResults": [],
  "currentStep": 3,
  "totalSteps": 5,
  "workingDirectory": "/home/user/project",
  "metadata": {}
}
```

### 自动加载
应用启动时自动加载 `~/.claude/agents/` 目录中的所有代理状态。

## 最佳实践

1. **后台执行长任务**: 对于耗时较长的任务，使用 `run_in_background: true`
2. **定期检查进度**: 使用 `TaskOutput` 工具监控后台代理的执行状态
3. **保存代理 ID**: 记录代理 ID 以便需要时恢复
4. **使用 show_history**: 恢复前查看执行历史了解失败原因
5. **清理旧代理**: 定期使用 `clearCompletedAgents()` 清理已完成的代理

## 错误处理

### 代理不存在
```
Error: Agent abc-123-def-456 not found. Unable to resume.
```

### 代理已完成
```
Error: Agent abc-123-def-456 has already completed. Cannot resume.
Agent result:
{
  "success": true,
  "output": "..."
}
```

### 代理正在运行
```
Error: Agent abc-123-def-456 is still running. Cannot resume.
```

## 注意事项

1. 代理状态文件不会自动过期，需要手动清理
2. Resume 功能目前为模拟实现，完整的代理执行需要 API 集成
3. 后台执行使用 setTimeout 模拟，实际实现应使用子进程
4. 中间结果的存储大小可能需要限制以避免文件过大
