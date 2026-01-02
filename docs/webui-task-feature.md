# WebUI Task 工具后台任务支持

## 概述

WebUI 已完整实现 Task 工具的后台任务支持，允许 AI 启动并管理后台子任务（Agent）。

## 功能特性

### 1. TaskManager (`src/web/server/task-manager.ts`)

后台任务管理器，负责创建、执行和管理 Agent 任务。

**主要功能：**
- ✅ 创建新任务（异步/同步）
- ✅ 获取任务状态和信息
- ✅ 列出所有任务
- ✅ 取消运行中的任务
- ✅ 获取任务输出
- ✅ 清理已完成的任务
- ✅ 实时 WebSocket 状态更新

**API：**
```typescript
class TaskManager {
  // 创建新任务
  async createTask(
    description: string,
    prompt: string,
    agentType: string,
    options?: {
      model?: string;
      runInBackground?: boolean;
      parentMessages?: Message[];
      workingDirectory?: string;
    }
  ): Promise<string>;

  // 获取任务信息
  getTask(taskId: string): TaskInfo | undefined;

  // 列出所有任务
  listTasks(): TaskInfo[];

  // 取消任务
  cancelTask(taskId: string): boolean;

  // 获取任务输出
  getTaskOutput(taskId: string): string | undefined;

  // 设置 WebSocket 连接
  setWebSocket(ws: WebSocket): void;

  // 清理已完成的任务
  clearCompletedTasks(): number;
}
```

### 2. 工具拦截 (`src/web/server/conversation.ts`)

在 ConversationManager 中拦截 Task 和 TaskOutput 工具调用。

**Task 工具拦截：**
- 解析工具输入参数
- 通过 TaskManager 创建后台任务
- 支持同步/异步执行
- 返回任务ID给 AI

**TaskOutput 工具拦截：**
- 获取任务状态和输出
- 支持阻塞等待任务完成
- 支持超时设置

### 3. WebSocket 消息类型 (`src/web/shared/types.ts`)

**客户端 → 服务端：**
```typescript
| { type: 'task_list'; payload?: TaskListRequestPayload }
| { type: 'task_cancel'; payload: { taskId: string } }
| { type: 'task_output'; payload: { taskId: string } }
```

**服务端 → 客户端：**
```typescript
| { type: 'task_list_response'; payload: TaskListPayload }
| { type: 'task_status'; payload: TaskStatusPayload }
| { type: 'task_cancelled'; payload: { taskId: string; success: boolean } }
| { type: 'task_output_response'; payload: TaskOutputPayload }
```

### 4. WebSocket 处理器 (`src/web/server/websocket.ts`)

已实现完整的任务管理 WebSocket 处理：

- ✅ `handleTaskList` - 列出任务
- ✅ `handleTaskCancel` - 取消任务
- ✅ `handleTaskOutput` - 获取任务输出
- ✅ 实时状态更新推送

### 5. 斜杠命令 (`src/web/server/slash-commands.ts`)

**`/tasks` 命令：**

```bash
# 列出所有后台任务
/tasks
/tasks list

# 取消任务
/tasks cancel <task-id>

# 查看任务输出
/tasks output <task-id>
```

**功能：**
- 显示任务列表（状态、描述、时长）
- 取消运行中的任务
- 查看任务详细输出和历史
- 支持进度显示

## 使用示例

### AI 启动后台任务

AI 可以使用 Task 工具启动后台 Agent：

```json
{
  "tool": "Task",
  "input": {
    "description": "搜索代码库中的API实现",
    "prompt": "查找所有API端点的实现，并总结它们的功能",
    "subagent_type": "Explore",
    "model": "haiku",
    "run_in_background": true
  }
}
```

系统会返回：
```
Agent started in background with ID: abc-123-def

Description: 搜索代码库中的API实现
Agent Type: Explore

Use the TaskOutput tool to check progress and retrieve results when complete.
```

### AI 检查任务状态

AI 可以使用 TaskOutput 工具检查任务：

```json
{
  "tool": "TaskOutput",
  "input": {
    "task_id": "abc-123-def",
    "block": true,
    "timeout": 60000
  }
}
```

### 用户管理任务

用户可以通过斜杠命令管理任务：

```bash
# 查看所有任务
/tasks

# 输出示例：
后台任务列表

1. ⏳ 搜索代码库中的API实现
   ID: abc-123
   类型: Explore
   状态: running
   时长: 运行中...

2. ✅ 分析组件依赖关系
   ID: def-456
   类型: general-purpose
   状态: completed
   时长: 12.5s

使用 /tasks output <id> 查看任务输出
使用 /tasks cancel <id> 取消运行中的任务

# 查看任务输出
/tasks output abc-123

# 取消任务
/tasks cancel abc-123
```

## Agent 类型支持

TaskManager 支持所有内置 Agent 类型：

1. **general-purpose** - 通用型 Agent（所有工具）
2. **Explore** - 快速代码探索 Agent（Glob, Grep, Read）
3. **Plan** - 计划模式 Agent（所有工具，计划模式）
4. **claude-code-guide** - Claude Code 文档 Agent

## 实时状态更新

TaskManager 通过 WebSocket 实时推送任务状态：

```typescript
{
  type: 'task_status',
  payload: {
    taskId: 'abc-123-def',
    status: 'completed',
    result: '找到 15 个 API 端点...',
    progress: {
      current: 15,
      total: 15,
      message: '已完成所有搜索'
    }
  }
}
```

前端可以监听这些更新，实时显示任务进度。

## 文件结构

```
src/web/
├── server/
│   ├── task-manager.ts          # 任务管理器核心
│   ├── conversation.ts           # Task/TaskOutput 工具拦截
│   ├── websocket.ts              # WebSocket 任务处理
│   └── slash-commands.ts         # /tasks 命令实现
└── shared/
    └── types.ts                  # 任务相关类型定义
```

## 集成检查清单

- ✅ TaskManager 已创建
- ✅ 类型定义已扩展
- ✅ Conversation 集成已完成
- ✅ WebSocket 处理已实现
- ✅ 斜杠命令已添加
- ✅ Task 工具拦截已实现
- ✅ TaskOutput 工具拦截已实现
- ✅ 实时状态更新已支持
- ✅ TypeScript 编译无错误

## 下一步

前端实现建议：

1. **任务列表 UI**
   - 显示所有后台任务
   - 实时状态更新
   - 进度条显示

2. **任务详情面板**
   - 显示任务输出
   - 支持取消任务
   - 查看任务历史

3. **通知系统**
   - 任务完成通知
   - 任务失败警告

## 注意事项

1. 任务会话独立，不共享父会话状态（除非 Agent 支持 forkContext）
2. 后台任务会消耗 API 额度，需要监控成本
3. 建议设置任务超时限制
4. 任务输出缓冲区需要定期清理
5. WebSocket 连接断开时，任务仍会继续执行

## 测试建议

```bash
# 1. 启动 WebUI 服务器
npm run dev:webui

# 2. 在浏览器中测试
- 发送消息让 AI 使用 Task 工具
- 使用 /tasks 命令查看任务列表
- 测试任务取消功能
- 验证实时状态更新

# 3. 检查日志
- 查看任务创建日志
- 验证任务状态变化
- 检查 WebSocket 消息
```
