# 后台任务功能对比分析 (T445-T452)

## 概述

本文档对比分析本项目与官方 @anthropic-ai/claude-code v2.0.76 在后台任务管理功能方面的实现差异。

**分析范围**: T445-T452 后台任务相关功能点
**官方版本**: @anthropic-ai/claude-code v2.0.76
**分析日期**: 2025-12-25

---

## T445: 后台任务管理器

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

官方通过多个函数实现任务管理：

```javascript
// 任务状态更新
function UW(A,Q,B){Q((G)=>{let Z=G.tasks?.[A];if(!Z)return G;return{...G,tasks:{...G.tasks,[A]:B(Z)}}})}

// 任务创建
function gm(A,Q){Q((B)=>({...B,tasks:{...B.tasks,[A.id]:A}}))}

// 任务状态报告更新
function Oj2(A){
  if(A.type==="local_bash"){
    let Q=A;
    return{...Q,lastReportedStdoutLines:Q.stdoutLineCount,
           lastReportedStderrLines:Q.stderrLineCount}
  }
  if(A.type==="local_agent"){
    let Q=A;
    return{...Q,lastReportedToolCount:Q.progress?.toolUseCount??0,
           lastReportedTokenCount:Q.progress?.tokenCount??0}
  }
  return A
}

// 任务状态收集
function Mj2(A){
  let Q=[],B=[],G={},Z=A.tasks??{};
  for(let Y of Object.values(Z)){
    if(Y.notified&&Y.status!=="running")continue;
    let J=null;
    if(Y.status==="running"){
      let X=s00(Y.id,Y.outputOffset);
      if(X.content)J=X.content,G[Y.id]={...Y,outputOffset:X.newOffset};
      let W=Nj2(Y.type)?.getProgressMessage(Y)??null;
      if(W)B.push({type:"task_progress",taskId:Y.id,taskType:Y.type,message:W})
    }
    if(Y.status!=="running"&&Y.status!=="pending"&&!Y.notified){
      let X=s00(Y.id,Y.outputOffset);
      if(X.content)J=X.content;
      Q.push({type:"task_status",taskId:Y.id,taskType:Y.type,status:Y.status,
              description:Y.description,deltaSummary:J}),
      G[Y.id]={...G[Y.id]??Y,notified:!0,outputOffset:X.newOffset}
    }
  }
  return{attachments:Q,progressAttachments:B,updatedTasks:G}
}
```

**核心特性**：
- 使用函数式状态更新模式
- 支持多种任务类型（local_bash, local_agent, remote_agent）
- 任务状态包含：running, pending, completed, failed, killed
- 输出增量跟踪（outputOffset）
- 通知状态管理（notified 标志）
- 进度消息生成

### 本项目实现

**位置**: `/src/tools/agent.ts` + `/src/agents/parallel.ts`

```typescript
// BackgroundAgent 接口
export interface BackgroundAgent {
  id: string;
  agentType: string;
  description: string;
  prompt: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  endTime?: Date;
  result?: ToolResult;
  error?: string;
  // 持久化状态
  history: AgentHistoryEntry[];
  intermediateResults: any[];
  currentStep?: number;
  totalSteps?: number;
  workingDirectory?: string;
  metadata?: Record<string, any>;
}

// 代理管理
const backgroundAgents: Map<string, BackgroundAgent> = new Map();

export function getBackgroundAgents(): BackgroundAgent[] {
  return Array.from(backgroundAgents.values());
}

export function getBackgroundAgent(id: string): BackgroundAgent | undefined {
  let agent = backgroundAgents.get(id);
  if (!agent) {
    const loaded = loadAgentState(id);
    if (loaded) {
      backgroundAgents.set(id, loaded);
      agent = loaded;
    }
  }
  return agent;
}

export function killBackgroundAgent(id: string): boolean {
  const agent = backgroundAgents.get(id);
  if (!agent) return false;
  if (agent.status === 'running') {
    agent.status = 'failed';
    agent.error = 'Killed by user';
    agent.endTime = new Date();
    addAgentHistory(agent, 'failed', 'Agent killed by user');
  }
  return true;
}
```

**核心特性**：
- 使用 Map 数据结构管理代理
- 支持状态持久化到 `~/.claude/agents/`
- 包含详细的历史记录
- 支持 pause 状态
- 工作目录跟踪
- 自定义元数据支持

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 数据结构 | 纯函数式状态更新 | Map + 持久化 | ⭐⭐⭐ |
| 任务类型 | 3种（bash/agent/remote） | 1种（agent） | ⭐⭐⭐ |
| 状态管理 | 集中在 AppState | 独立 Map 管理 | ⭐⭐⭐ |
| 持久化 | 未明确实现 | 完整文件持久化 | ⭐⭐⭐⭐ |
| 历史记录 | 无详细历史 | 完整历史追踪 | ⭐⭐⭐⭐ |
| 中间结果 | 简单增量 | 结构化中间结果 | ⭐⭐⭐ |

**优势**：
- ✅ 完善的持久化机制
- ✅ 详细的历史记录
- ✅ 更好的状态恢复能力

**劣势**：
- ❌ 任务类型支持较少
- ❌ 与主状态管理分离
- ❌ 缺少输出增量跟踪

---

## T446: background_task_status

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
// 任务状态监控 - Dx5 函数
function Dx5(A,Q){
  let B=!0,G=1000,Z=async()=>{
    if(!B)return;
    try{
      let J=(await Q.getAppState()).tasks?.[A];
      if(!J||J.status!=="running")return;
      let X=await Fj2(J.sessionId),  // 获取会话日志
          I=X.log.find((H)=>H.type==="result"),
          W=I?I.subtype==="success"?"completed":"failed"
             :X.log.length>0?"running":"starting",
          K=X.log.slice(J.log.length),  // 获取新日志
          V=null;

      if(K.length>0){
        let H=J.deltaSummarySinceLastFlushToAttachment;
        V=await Hx5(K,H);  // 生成增量摘要
        let D=K.map((F)=>{
          if(F.type==="assistant")
            return F.message.content.filter((E)=>E.type==="text")
                    .map((E)=>("text"in E)?E.text:"").join('\n');
          return JSON.stringify(F)
        }).join('\n');
        if(D)ku(A,D+'\n')
      }

      if(UW(A,Q.setAppState,(H)=>({
        ...H,
        status:W==="starting"?"running":W,
        log:X.log,
        todoList:Vx5(X.log),
        deltaSummarySinceLastFlushToAttachment:V,
        endTime:I?Date.now():void 0
      })),I){
        let H=I.subtype==="success"?"completed":"failed";
        Kx5(A,J.title,H,Q.setAppState);
        return
      }
    }catch(Y){
      t(Y instanceof Error?Y:Error(String(Y)))
    }
    if(B)setTimeout(Z,G)
  };
  return Z(),()=>{B=!1}
}

// 任务附件生成
async function sx5(A,Q){
  let B=await A.getAppState(),
      {attachments:G,progressAttachments:Z,updatedTasks:Y}=Mj2(B),
      J=rx5(Q),  // 获取上次报告时间
      X=Z.filter((K)=>{
        return(J.get(K.taskId)??1/0)>=qx5  // 3轮间隔
      });

  for(let K of X){
    let V=Y[K.taskId]??B.tasks?.[K.taskId];
    if(V)Y[K.taskId]=Oj2(V)  // 更新报告状态
  }

  if(Object.keys(Y).length>0)
    A.setAppState((K)=>({...K,tasks:{...K.tasks,...Y}}));

  let I=G.map((K)=>({
    type:"task_status",
    taskId:K.taskId,
    taskType:K.taskType,
    status:K.status,
    description:K.description,
    deltaSummary:K.deltaSummary
  })),
  W=X.map((K)=>({
    type:"task_progress",
    taskId:K.taskId,
    taskType:K.taskType,
    message:K.message
  }));

  return[...I,...W]
}

// 最小报告间隔
var qx5=3;  // 3 turns between task progress attachments
```

**核心特性**：
- 定期轮询（1秒间隔）
- 自动状态更新
- 增量日志提取
- 进度报告节流（3轮间隔）
- 清理函数返回

### 本项目实现

**位置**: `/src/tools/agent.ts`

```typescript
export class TaskOutputTool extends BaseTool<{...}, ToolResult> {
  name = 'TaskOutput';
  description = `Get output and status from a background task.`;

  async execute(input: {
    task_id: string;
    block?: boolean;
    timeout?: number;
    show_history?: boolean
  }): Promise<ToolResult> {
    const agent = getBackgroundAgent(input.task_id);
    if (!agent) {
      return { success: false, error: `Task ${input.task_id} not found` };
    }

    // 阻塞等待
    if (input.block && agent.status === 'running') {
      const timeout = input.timeout || 5000;
      const startTime = Date.now();

      while (agent.status === 'running' && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const updatedAgent = getBackgroundAgent(input.task_id);
        if (updatedAgent && updatedAgent.status !== 'running') {
          break;
        }
      }
    }

    // 构建输出信息
    const output = [];
    output.push(`=== Agent ${input.task_id} ===`);
    output.push(`Type: ${agent.agentType}`);
    output.push(`Status: ${agent.status}`);
    output.push(`Description: ${agent.description}`);
    output.push(`Started: ${agent.startTime.toISOString()}`);

    if (agent.endTime) {
      const duration = agent.endTime.getTime() - agent.startTime.getTime();
      output.push(`Ended: ${agent.endTime.toISOString()}`);
      output.push(`Duration: ${(duration / 1000).toFixed(2)}s`);
    }

    if (agent.currentStep !== undefined && agent.totalSteps !== undefined) {
      output.push(`Progress: ${agent.currentStep}/${agent.totalSteps} steps`);
    }

    // 显示执行历史
    if (input.show_history && agent.history.length > 0) {
      output.push('\n=== Execution History ===');
      agent.history.forEach((entry, idx) => {
        const timestamp = entry.timestamp.toISOString();
        output.push(`${idx + 1}. [${timestamp}] ${entry.type.toUpperCase()}: ${entry.message}`);
        if (entry.data) {
          output.push(`   Data: ${JSON.stringify(entry.data)}`);
        }
      });
    }

    // 显示中间结果
    if (agent.intermediateResults.length > 0) {
      output.push('\n=== Intermediate Results ===');
      agent.intermediateResults.forEach((result, idx) => {
        output.push(`Step ${idx + 1}:`);
        output.push(`  ${JSON.stringify(result, null, 2)}`);
      });
    }

    return {
      success: true,
      output: output.join('\n'),
    };
  }
}
```

**核心特性**：
- 同步轮询（block模式）
- 灵活的超时控制
- 可选历史记录显示
- 详细的格式化输出
- 中间结果展示

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 监控方式 | 后台自动轮询 | 手动查询 | ⭐⭐⭐⭐ |
| 更新频率 | 1秒固定 | 按需查询 | ⭐⭐⭐⭐ |
| 状态自动更新 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |
| 历史记录 | ❌ | ✅ | ⭐⭐⭐ |
| 节流机制 | ✅ (3轮) | ❌ | ⭐⭐⭐ |

**优势**：
- ✅ 详细的历史和进度展示
- ✅ 灵活的查询控制

**劣势**：
- ❌ 无自动后台监控
- ❌ 需手动轮询
- ❌ 缺少节流机制

---

## T447: background_task_summarize_delta

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
// 增量摘要生成
async function Hx5(A,Q){
  try{
    let B=await jK({
      systemPrompt:[
        "You are given a few messages from a conversation, as well as a "+
        "summary of the conversation so far. Your task is to summarize the "+
        "new messages in the conversation based on the summary so far. "+
        "Aim for 1-2 sentences at most, focusing on the most important details. "+
        "The summary MUST be in <summary>summary goes here</summary> tags. "+
        "If there is no new information, return an empty string: <summary></summary>."
      ],
      userPrompt:`Summary so far: ${Q}\n\nNew messages: ${JSON.stringify(A)}`,
      signal:new AbortController().signal,
      options:{
        querySource:"background_task_summarize_delta",
        agents:[],
        isNonInteractiveSession:!1,
        hasAppendSystemPrompt:!1,
        mcpTools:[]
      }
    }),
    G=_9A(B);
    if(!G)return null;
    return Q9(G,"summary")  // 提取 <summary> 标签内容
  }catch(B){
    return t(B instanceof Error?B:Error(String(B))),null
  }
}

// 提取 TodoList
function Vx5(A){
  return A.findLast((Z)=>Z.type==="assistant"&&
    Z.message.content.some((Y)=>Y.type==="tool_use"&&Y.name===MX.name));
  // ... 解析 TodoWrite 工具调用
}
```

**核心特性**：
- 使用 LLM 生成增量摘要
- 基于之前摘要的递增式总结
- 1-2句简洁输出
- XML 标签包裹
- 空值处理
- 异步生成

### 本项目实现

**状态**: ❌ 未实现

本项目没有实现增量摘要功能。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 增量摘要 | ✅ LLM生成 | ❌ 未实现 | ⭐⭐⭐⭐⭐ |
| 历史压缩 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |
| TodoList提取 | ✅ | ❌ | ⭐⭐⭐⭐ |

**缺失功能**：
- ❌ 无增量摘要生成
- ❌ 无历史压缩
- ❌ 无 TodoList 提取

---

## T448: 任务队列

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
// 工具执行队列类
class _F0{
  toolDefinitions;
  canUseTool;
  tools=[];
  toolUseContext;
  hasErrored=!1;
  progressAvailableResolve;

  constructor(A,Q,B){
    this.toolDefinitions=A;
    this.canUseTool=Q;
    this.toolUseContext=B
  }

  // 添加工具到队列
  addTool(A,Q){
    let B=this.toolDefinitions.find((Y)=>Y.name===A.name);
    if(!B){
      // 工具未找到，直接标记完成并返回错误
      this.tools.push({
        id:A.id,
        block:A,
        assistantMessage:Q,
        status:"completed",
        isConcurrencySafe:!0,
        pendingProgress:[],
        results:[/* 错误消息 */]
      });
      return
    }

    let G=B.inputSchema.safeParse(A.input),
        Z=G?.success?B.isConcurrencySafe(G.data):!1;

    this.tools.push({
      id:A.id,
      block:A,
      assistantMessage:Q,
      status:"queued",
      isConcurrencySafe:Z,
      pendingProgress:[]
    }),
    this.processQueue()
  }

  // 检查是否可以执行工具
  canExecuteTool(A){
    let Q=this.tools.filter((B)=>B.status==="executing");
    return Q.length===0||A&&Q.every((B)=>B.isConcurrencySafe)
  }

  // 处理队列
  async processQueue(){
    for(let A of this.tools){
      if(A.status!=="queued")continue;
      if(this.canExecuteTool(A.isConcurrencySafe))
        await this.executeTool(A);
      else if(!A.isConcurrencySafe)
        break  // 遇到非并发安全工具，停止处理
    }
  }

  // 执行工具
  async executeTool(A){
    A.status="executing",
    this.toolUseContext.setInProgressToolUseIDs((Y)=>new Set([...Y,A.id]));

    let Q=[],B=[],Z=(async()=>{
      let Y=this.getAbortReason();
      if(Y){
        Q.push(this.createSyntheticErrorMessage(A.id,Y)),
        A.results=Q,
        A.contextModifiers=B,
        A.status="completed";
        return
      }

      // 执行工具并收集结果
      let J=CX1(A.block,A.assistantMessage,this.canUseTool,this.toolUseContext),
          X=!1;
      for await(let I of J){
        let W=this.getAbortReason();
        if(W&&!X){
          Q.push(this.createSyntheticErrorMessage(A.id,W));
          break
        }

        if(I.message.type==="user"&&/* 检查错误 */){
          this.hasErrored=!0,X=!0
        }

        if(I.message){
          if(I.message.type==="progress"){
            A.pendingProgress.push(I.message),
            this.progressAvailableResolve?.()
          }else Q.push(I.message)
        }

        if(I.contextModifier)
          B.push(I.contextModifier.modifyContext)
      }

      A.results=Q,
      A.contextModifiers=B,
      A.status="completed"
    })();

    A.promise=Z,
    Z.finally(()=>{this.processQueue()})
  }

  // 获取已完成的结果
  *getCompletedResults(){
    for(let A of this.tools){
      while(A.pendingProgress.length>0)
        yield{message:A.pendingProgress.shift()};

      if(A.status==="yielded")continue;

      if(A.status==="completed"&&A.results){
        A.status="yielded";
        for(let Q of A.results)yield{message:Q};
        jg5(this.toolUseContext,A.id)
      }else if(A.status==="executing"&&!A.isConcurrencySafe)
        break
    }
  }

  // 获取剩余结果（异步）
  async*getRemainingResults(){
    while(this.hasUnfinishedTools()){
      await this.processQueue();
      for(let A of this.getCompletedResults())yield A;

      if(this.hasExecutingTools()&&!this.hasCompletedResults()&&
         !this.hasPendingProgress()){
        let A=this.tools.filter((B)=>B.status==="executing"&&B.promise)
                         .map((B)=>B.promise),
            Q=new Promise((B)=>{this.progressAvailableResolve=B});
        if(A.length>0)await Promise.race([...A,Q])
      }
    }
    for(let A of this.getCompletedResults())yield A
  }
}

// 分组工具（按并发安全性）
function og5(A,Q){
  return A.reduce((B,G)=>{
    let Z=Q.options.tools.find((X)=>X.name===G.name),
        Y=Z?.inputSchema.safeParse(G.input),
        J=Y?.success?Boolean(Z?.isConcurrencySafe(Y.data)):!1;

    if(J&&B[B.length-1]?.isConcurrencySafe)
      B[B.length-1].blocks.push(G);
    else
      B.push({isConcurrencySafe:J,blocks:[G]});

    return B
  },[])
}

// 并发执行工具
async function*sg5(A,Q,B,G){
  yield*xHA(A.map(async function*(Z){
    G.setInProgressToolUseIDs((Y)=>new Set([...Y,Z.id])),
    yield*CX1(Z,Q.find((Y)=>/*匹配*/),B,G),
    zv2(G,Z.id)
  }),ig5())  // ig5() 返回 MAX_TOOL_USE_CONCURRENCY
}
```

**核心特性**：
- 工具状态：queued → executing → completed → yielded
- 并发安全性检查
- 非并发安全工具顺序执行
- 错误处理和传播
- 进度消息缓冲
- 上下文修改器收集
- Promise 协调

### 本项目实现

**位置**: `/src/agents/parallel.ts`

```typescript
export class ParallelAgentExecutor extends EventEmitter {
  private config: ParallelAgentConfig;
  private tasks: Map<string, TaskExecutionInfo> = new Map();
  private running = false;
  private cancelled = false;
  private pool?: AgentPool;

  /**
   * 执行多个任务(无依赖)
   */
  async execute(tasks: AgentTask[]): Promise<ParallelExecutionResult> {
    if (this.running) {
      throw new Error('Executor is already running');
    }

    const startTime = Date.now();
    this.running = true;
    this.cancelled = false;

    // 初始化任务状态
    this.tasks.clear();
    for (const task of tasks) {
      this.tasks.set(task.id, {
        task,
        status: 'pending',
        retryCount: 0,
      });
    }

    // 创建代理池
    this.pool = new AgentPool(this.config.maxConcurrency);

    try {
      // 按优先级排序
      const sortedTasks = [...tasks].sort((a, b) =>
        (b.priority || 0) - (a.priority || 0)
      );

      // 并发执行
      await this.executeTasksConcurrently(sortedTasks);

      return this.buildResult(startTime);
    } finally {
      this.running = false;
      if (this.pool) {
        await this.pool.shutdown();
        this.pool = undefined;
      }
    }
  }

  /**
   * 并发执行任务(无依赖)
   */
  private async executeTasksConcurrently(tasks: AgentTask[]): Promise<void> {
    const queue = [...tasks];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      if (this.cancelled) break;

      // 启动新任务直到达到并发上限
      while (queue.length > 0 && executing.length < this.config.maxConcurrency) {
        const task = queue.shift()!;
        const promise = this.executeTask(task).finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });
        executing.push(promise);
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    // 等待所有任务完成
    await Promise.all(executing);
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: AgentTask): Promise<void> {
    const info = this.tasks.get(task.id)!;
    const timeout = task.timeout || this.config.timeout;

    try {
      // 获取worker
      if (!this.pool) throw new Error('Agent pool not initialized');
      const worker = await this.pool.acquire();

      try {
        info.status = 'running';
        info.startTime = new Date();
        this.emit('task-started', task.id);

        // 执行任务(带超时)
        const result = await Promise.race([
          this.runAgentTask(worker, task),
          this.createTimeout(timeout),
        ]);

        info.endTime = new Date();
        info.result = result;
        info.status = result.success ? 'completed' : 'failed';

        if (result.success) {
          this.emit('task-completed', task.id, result);
        } else {
          info.error = result.error;
          this.emit('task-failed', task.id, result.error);

          // 重试逻辑
          if (this.config.retryOnFailure &&
              info.retryCount < (this.config.maxRetries || 3)) {
            await this.retryTask(task, info);
          }
        }
      } finally {
        this.pool.release(worker);
      }
    } catch (error) {
      info.endTime = new Date();
      info.status = 'failed';
      info.error = error instanceof Error ? error.message : String(error);
      this.emit('task-error', task.id, info.error);

      // 重试逻辑
      if (this.config.retryOnFailure &&
          info.retryCount < (this.config.maxRetries || 3)) {
        await this.retryTask(task, info);
      }
    }
  }
}

// 代理资源池
export class AgentPool {
  private workers: AgentWorker[] = [];
  private availableWorkers: AgentWorker[] = [];
  private waitQueue: Array<(worker: AgentWorker) => void> = [];
  private poolSize: number;

  constructor(poolSize: number) {
    this.poolSize = poolSize;
    this.initializePool();
  }

  /**
   * 获取工作器
   */
  async acquire(): Promise<AgentWorker> {
    const worker = this.availableWorkers.shift();
    if (worker) {
      worker.busy = true;
      worker.lastUsed = new Date();
      return worker;
    }

    // 否则等待
    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * 释放工作器
   */
  release(worker: AgentWorker): void {
    worker.busy = false;
    worker.lastUsed = new Date();
    delete worker.currentTask;

    // 如果有等待的请求,分配给它
    const waiting = this.waitQueue.shift();
    if (waiting) {
      worker.busy = true;
      waiting(worker);
    } else {
      this.availableWorkers.push(worker);
    }
  }
}
```

**核心特性**：
- Promise.race 控制并发
- AgentPool 资源池管理
- 优先级队列
- 重试机制
- 事件发射器
- 超时控制

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 队列类型 | 工具执行队列 | 代理任务队列 | ⭐⭐⭐⭐ |
| 并发控制 | isConcurrencySafe标志 | maxConcurrency数值 | ⭐⭐⭐⭐ |
| 资源池 | ❌ | ✅ AgentPool | ⭐⭐⭐⭐ |
| 状态管理 | 4状态 | 6状态 | ⭐⭐ |
| 进度处理 | pendingProgress缓冲 | 事件发射 | ⭐⭐⭐ |
| 错误传播 | hasErrored标志 | 独立错误处理 | ⭐⭐⭐ |

**优势**：
- ✅ 显式资源池管理
- ✅ 优先级支持
- ✅ 重试机制
- ✅ 事件驱动

**劣势**：
- ❌ 无工具级并发控制
- ❌ 无进度消息缓冲
- ❌ 无上下文修改器

---

## T449: queued_command 处理

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
// 队列命令附件生成
function Lx5(A){
  if(!A)return[];
  return A.filter((Q)=>Q.mode==="prompt")
          .map((Q)=>({
            type:"queued_command",
            prompt:Q.value,
            source_uuid:Q.uuid
          }))
}

// 在主循环中处理队列命令
async function*ew({...}){
  // ...
  let QA=[...(await d.getAppState()).queuedCommands],TA=[];

  // 生成附件
  for await(let SA of FHA(null,d,null,QA,[...F,...L,...N],W))
    if(yield SA,N.push(SA),UJ1(SA))  // UJ1检查是否为queued_command
      TA.push(SA);

  // 清除已处理的队列命令
  eY2(QA,d.setAppState);

  // 如果有排队的命令附件，重新发送
  if(TA.length>0){
    let V={...J,pendingSteeringAttachments:TA};
    yield*ew({...})  // 递归处理
  }
}

// 检查是否为队列命令附件
function UJ1(A){
  return A.attachment.type==="queued_command"
}

// 处理待处理的引导附件
async function*ng5(A,Q,B,G,Z,Y,J,X,I,W){
  if(J.pendingSteeringAttachments&&J.pendingSteeringAttachments.length>0){
    let K=[];
    for(let V of J.pendingSteeringAttachments){
      let H=V.attachment;
      if(H.type==="queued_command"){
        let D=f0({content:H.prompt,isMeta:!0});
        K.push(D)
      }
    }
    if(K.length>0){
      let V={...J,pendingSteeringAttachments:void 0};
      n("tengu_steering_attachment_resending",{
        queryChainId:J.queryTracking?.chainId,
        queryDepth:J.queryTracking?.depth
      }),
      yield*ew({messages:[...A,...Q,...K],...})  // 重新进入循环
    }
    return
  }
}
```

**核心特性**：
- 从 AppState 获取队列命令
- 转换为附件格式
- 使用 pendingSteeringAttachments 传递
- 递归重入主循环
- 自动清除已处理命令
- UUID 跟踪

### 本项目实现

**状态**: ❌ 未实现

本项目没有实现队列命令处理机制。

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 队列命令 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |
| 附件转换 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |
| 递归处理 | ✅ | ❌ | ⭐⭐⭐⭐⭐ |

**缺失功能**：
- ❌ 无队列命令支持
- ❌ 无引导附件机制
- ❌ 无自动重入逻辑

---

## T450: 并发限制 MAX_TOOL_USE_CONCURRENCY

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
// 获取最大并发数
function ig5(){
  return parseInt(process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY||"",10)||10
}

// 在并发执行中使用
async function*sg5(A,Q,B,G){
  yield*xHA(
    A.map(async function*(Z){
      G.setInProgressToolUseIDs((Y)=>new Set([...Y,Z.id])),
      yield*CX1(Z,Q.find((Y)=>/*...*/),B,G),
      zv2(G,Z.id)
    }),
    ig5()  // 传入最大并发数
  )
}

// 通用异步迭代器并发执行
async function*xHA(A,Q=1/0){
  let B=(Y)=>{
    let J=Y.next().then(({done:X,value:I})=>
      ({done:X,value:I,generator:Y,promise:J}));
    return J
  },
  G=[...A],
  Z=new Set;

  // 启动初始并发任务
  while(Z.size<Q&&G.length>0){
    let Y=G.shift();
    Z.add(B(Y))
  }

  // 处理完成的任务并启动新任务
  while(Z.size>0){
    let{done:Y,value:J,generator:X,promise:I}=await Promise.race(Z);
    if(Z.delete(I),!Y){
      if(Z.add(B(X)),J!==void 0)yield J
    }else if(G.length>0){
      let W=G.shift();
      Z.add(B(W))
    }
  }
}
```

**核心特性**：
- 环境变量配置
- 默认值 10
- 动态并发控制
- Promise.race 协调
- Set 跟踪执行中的任务

### 本项目实现

**位置**: `/src/agents/parallel.ts`

```typescript
export interface ParallelAgentConfig {
  /** 最大并发数量 */
  maxConcurrency: number;
  /** 超时时间(毫秒) */
  timeout: number;
  /** 失败时是否重试 */
  retryOnFailure: boolean;
  /** 首次错误时停止 */
  stopOnFirstError: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟(毫秒) */
  retryDelay?: number;
}

const DEFAULT_CONFIG: ParallelAgentConfig = {
  maxConcurrency: 5,  // 默认 5
  timeout: 300000,
  retryOnFailure: false,
  stopOnFirstError: false,
  maxRetries: 3,
  retryDelay: 1000,
};

export class ParallelAgentExecutor extends EventEmitter {
  private config: ParallelAgentConfig;

  constructor(config?: Partial<ParallelAgentConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async executeTasksConcurrently(tasks: AgentTask[]): Promise<void> {
    const queue = [...tasks];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      if (this.cancelled) break;

      // 启动新任务直到达到并发上限
      while (queue.length > 0 &&
             executing.length < this.config.maxConcurrency) {
        const task = queue.shift()!;
        const promise = this.executeTask(task).finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });
        executing.push(promise);
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }
}

// AgentPool 也有大小限制
export class AgentPool {
  private poolSize: number;

  constructor(poolSize: number) {
    this.poolSize = poolSize;
    this.initializePool();
  }

  /**
   * 调整池大小
   */
  resize(newSize: number): void {
    if (newSize < this.poolSize) {
      // 缩小池...
    } else if (newSize > this.poolSize) {
      // 扩大池...
    }
    this.poolSize = newSize;
  }
}
```

**核心特性**：
- 配置对象管理
- 默认值 5（vs 官方 10）
- 运行时可调整
- Promise 数组追踪
- AgentPool 大小限制

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 配置方式 | 环境变量 | 构造参数 | ⭐⭐⭐ |
| 默认值 | 10 | 5 | ⭐⭐ |
| 动态调整 | ❌ | ✅ (resize) | ⭐⭐⭐ |
| 应用范围 | 工具执行 | 代理任务 | ⭐⭐⭐⭐ |
| 实现方式 | 通用迭代器 | Promise数组 | ⭐⭐⭐ |

**优势**：
- ✅ 运行时可调整
- ✅ 更灵活的配置

**劣势**：
- ❌ 无环境变量支持
- ❌ 默认值较低
- ❌ 仅适用于代理任务

---

## T451: 任务优先级

### 官方实现

**状态**: ❌ 未实现

官方实现没有显式的任务优先级机制。任务按照以下顺序执行：

1. 按并发安全性分组
2. 组内按添加顺序执行
3. 非并发安全任务严格顺序执行

### 本项目实现

**位置**: `/src/agents/parallel.ts`

```typescript
export interface AgentTask {
  /** 任务唯一标识 */
  id: string;
  /** 代理类型 */
  type: string;
  /** 任务提示 */
  prompt: string;
  /** 任务描述 */
  description?: string;
  /** 可选参数 */
  options?: Record<string, any>;
  /** 优先级(数字越大优先级越高) */
  priority?: number;
  /** 依赖的任务ID列表 */
  dependencies?: string[];
  /** 模型选择 */
  model?: 'sonnet' | 'opus' | 'haiku';
  /** 超时配置(覆盖全局配置) */
  timeout?: number;
}

export class ParallelAgentExecutor extends EventEmitter {
  async execute(tasks: AgentTask[]): Promise<ParallelExecutionResult> {
    // ...

    // 按优先级排序
    const sortedTasks = [...tasks].sort((a, b) =>
      (b.priority || 0) - (a.priority || 0)
    );

    // 并发执行
    await this.executeTasksConcurrently(sortedTasks);

    // ...
  }
}
```

**核心特性**：
- priority 字段（数字）
- 降序排序（大优先）
- 在队列执行前排序
- 可选字段（默认0）

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 优先级支持 | ❌ | ✅ | ⭐⭐⭐⭐ |
| 排序机制 | 固定顺序 | 数值优先级 | ⭐⭐⭐⭐ |
| 依赖支持 | ❌ | ✅ | ⭐⭐⭐⭐ |

**优势**：
- ✅ 灵活的优先级控制
- ✅ 依赖关系支持
- ✅ 拓扑排序

**劣势**：
- ❌ 无动态优先级调整
- ❌ 无基于负载的调度

---

## T452: 任务取消

### 官方实现

**位置**: `/node_modules/@anthropic-ai/claude-code/cli.js`

```javascript
class _F0{
  // ...

  getAbortReason(){
    if(this.hasErrored)return"sibling_error";
    if(this.toolUseContext.abortController.signal.aborted)
      return"user_interrupted";
    return null
  }

  async executeTool(A){
    // ...
    let Z=(async()=>{
      let Y=this.getAbortReason();
      if(Y){
        Q.push(this.createSyntheticErrorMessage(A.id,Y)),
        A.results=Q,
        A.contextModifiers=B,
        A.status="completed";
        return
      }
      // ...
      for await(let I of J){
        let W=this.getAbortReason();
        if(W&&!X){
          Q.push(this.createSyntheticErrorMessage(A.id,W));
          break
        }
        // ...
      }
    })();
  }

  createSyntheticErrorMessage(A,Q){
    if(Q==="user_interrupted")
      return f0({
        content:[{
          type:"tool_result",
          content:b9A,  // "User rejected tool use"
          is_error:!0,
          tool_use_id:A
        }],
        toolUseResult:"User rejected tool use"
      });
    return f0({
      content:[{
        type:"tool_result",
        content:"<tool_use_error>Sibling tool call errored</tool_use_error>",
        is_error:!0,
        tool_use_id:A
      }],
      toolUseResult:"Sibling tool call errored"
    })
  }
}

// 主循环中的中断处理
async function*ew({...}){
  // ...
  if(Y.abortController.signal.aborted){
    if(R){
      for await(let SA of R.getRemainingResults())
        if(SA.message)yield SA.message
    }else yield*kF0(L,"Interrupted by user");
    yield myA({toolUse:!1});
    return
  }
}
```

**核心特性**：
- AbortController 信号
- 两种中止原因：
  - user_interrupted（用户中断）
  - sibling_error（同级错误）
- 错误消息生成
- 级联取消

### 本项目实现

**位置**: `/src/agents/parallel.ts`

```typescript
export class ParallelAgentExecutor extends EventEmitter {
  private running = false;
  private cancelled = false;

  /**
   * 取消执行
   */
  cancel(taskId?: string): void {
    if (taskId) {
      const info = this.tasks.get(taskId);
      if (info && info.status === 'running') {
        info.status = 'cancelled';
        this.emit('task-cancelled', taskId);
      }
    } else {
      this.cancelled = true;
      this.emit('execution-cancelled');
    }
  }

  private async executeTasksConcurrently(tasks: AgentTask[]): Promise<void> {
    const queue = [...tasks];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      if (this.cancelled) break;  // 检查全局取消

      // ...
    }

    await Promise.all(executing);
  }

  private buildResult(startTime: number): ParallelExecutionResult {
    const completed: AgentResult[] = [];
    const failed: FailedAgent[] = [];
    const cancelled: string[] = [];

    for (const [taskId, info] of this.tasks.entries()) {
      if (info.status === 'completed' && info.result) {
        completed.push(info.result);
      } else if (info.status === 'failed') {
        failed.push({
          taskId,
          agentId: info.agentId,
          error: info.error || 'Unknown error',
          retryCount: info.retryCount,
        });
      } else if (info.status === 'cancelled') {
        cancelled.push(taskId);
      }
    }

    return {
      completed,
      failed,
      cancelled,
      duration,
      totalTasks,
      successRate,
    };
  }
}

// 代理级别的取消
export function killBackgroundAgent(id: string): boolean {
  const agent = backgroundAgents.get(id);
  if (!agent) return false;

  if (agent.status === 'running') {
    agent.status = 'failed';
    agent.error = 'Killed by user';
    agent.endTime = new Date();
    addAgentHistory(agent, 'failed', 'Agent killed by user');
  }
  return true;
}
```

**核心特性**：
- 全局取消标志
- 单任务取消
- 事件发射
- 取消结果跟踪
- 历史记录更新

### 差异分析

| 维度 | 官方实现 | 本项目实现 | 差异程度 |
|------|----------|------------|----------|
| 取消机制 | AbortController | 布尔标志 | ⭐⭐⭐⭐ |
| 取消粒度 | 工具级 | 任务级 + 全局 | ⭐⭐⭐ |
| 错误消息 | 合成错误消息 | 错误字符串 | ⭐⭐⭐ |
| 级联取消 | sibling_error | ❌ | ⭐⭐⭐⭐ |
| 事件通知 | ❌ | ✅ | ⭐⭐⭐ |

**优势**：
- ✅ 灵活的取消粒度
- ✅ 事件驱动通知
- ✅ 详细的历史记录

**劣势**：
- ❌ 无 AbortController
- ❌ 无级联取消
- ❌ 无标准错误格式

---

## 总体评估

### 实现完整度

| 功能点 | 官方 | 本项目 | 实现度 |
|-------|------|--------|--------|
| T445 后台任务管理器 | ✅ | ✅ | 70% |
| T446 background_task_status | ✅ | ⚠️ | 40% |
| T447 background_task_summarize_delta | ✅ | ❌ | 0% |
| T448 任务队列 | ✅ | ✅ | 65% |
| T449 queued_command 处理 | ✅ | ❌ | 0% |
| T450 并发限制 | ✅ | ✅ | 80% |
| T451 任务优先级 | ❌ | ✅ | 120% |
| T452 任务取消 | ✅ | ✅ | 75% |

**总体实现度**: 56.25%

### 架构差异

#### 官方架构
```
AppState.tasks
├── 任务状态管理（函数式）
├── 自动后台监控（Dx5轮询）
├── 工具执行队列（_F0类）
│   ├── 并发安全性检查
│   ├── 进度消息缓冲
│   └── 上下文修改器
├── 增量摘要生成（LLM）
└── 队列命令处理
```

#### 本项目架构
```
BackgroundAgent (Map)
├── 持久化状态管理
├── 历史记录追踪
├── ParallelAgentExecutor
│   ├── AgentPool资源池
│   ├── 优先级队列
│   ├── 重试机制
│   └── 事件发射器
└── 手动状态查询（TaskOutput工具）
```

### 核心差异

1. **状态管理**
   - 官方：集中式 AppState，函数式更新
   - 本项目：分布式 Map，面向对象

2. **监控方式**
   - 官方：自动后台轮询（1秒）
   - 本项目：手动查询（按需）

3. **队列类型**
   - 官方：工具执行队列
   - 本项目：代理任务队列

4. **并发控制**
   - 官方：工具级并发安全性
   - 本项目：数值并发限制

5. **智能功能**
   - 官方：LLM增量摘要、TodoList提取
   - 本项目：无

### 建议改进

#### 高优先级

1. **实现自动后台监控**
   ```typescript
   class BackgroundTaskMonitor {
     private interval: NodeJS.Timer;

     start() {
       this.interval = setInterval(async () => {
         for (const agent of getBackgroundAgents()) {
           if (agent.status === 'running') {
             await this.checkAndUpdate(agent);
           }
         }
       }, 1000);
     }
   }
   ```

2. **添加增量摘要功能**
   ```typescript
   async function summarizeDelta(
     newMessages: any[],
     previousSummary: string
   ): Promise<string> {
     // 使用 LLM 生成增量摘要
   }
   ```

3. **实现队列命令处理**
   ```typescript
   interface QueuedCommand {
     mode: 'prompt';
     value: string;
     uuid: string;
   }

   function processQueuedCommands(
     commands: QueuedCommand[]
   ): Attachment[] {
     return commands.map(cmd => ({
       type: 'queued_command',
       prompt: cmd.value,
       source_uuid: cmd.uuid
     }));
   }
   ```

#### 中优先级

4. **统一状态管理**
   - 将 BackgroundAgent 集成到 AppState
   - 使用函数式状态更新

5. **添加工具级并发控制**
   - isConcurrencySafe 检查
   - 智能分组执行

6. **实现进度消息缓冲**
   ```typescript
   class ToolExecutionQueue {
     private pendingProgress: ProgressMessage[] = [];

     *getCompletedResults() {
       while (this.pendingProgress.length > 0) {
         yield this.pendingProgress.shift();
       }
       // ...
     }
   }
   ```

#### 低优先级

7. **完善错误处理**
   - 级联取消（sibling_error）
   - 标准错误消息格式

8. **优化配置管理**
   - 支持环境变量
   - 运行时调整

---

## 参考资料

- 官方包: `@anthropic-ai/claude-code` v2.0.76
- 官方源码: `/node_modules/@anthropic-ai/claude-code/cli.js`
- 本项目源码:
  - `/src/tools/agent.ts`
  - `/src/agents/parallel.ts`
  - `/src/types/tools.ts`

---

## 附录：关键代码片段

### 官方 MAX_TOOL_USE_CONCURRENCY 实现

```javascript
// 获取最大并发数（默认10）
function ig5(){
  return parseInt(
    process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY||"",
    10
  )||10
}

// 通用异步迭代器并发执行
async function*xHA(A,Q=1/0){
  let B=(Y)=>{
    let J=Y.next().then(({done:X,value:I})=>
      ({done:X,value:I,generator:Y,promise:J}));
    return J
  },
  G=[...A],
  Z=new Set;

  while(Z.size<Q&&G.length>0){
    let Y=G.shift();
    Z.add(B(Y))
  }

  while(Z.size>0){
    let{done:Y,value:J,generator:X,promise:I}=
      await Promise.race(Z);
    if(Z.delete(I),!Y){
      if(Z.add(B(X)),J!==void 0)yield J
    }else if(G.length>0){
      let W=G.shift();
      Z.add(B(W))
    }
  }
}

// 在并发执行中使用
async function*sg5(A,Q,B,G){
  yield*xHA(
    A.map(async function*(Z){
      G.setInProgressToolUseIDs((Y)=>new Set([...Y,Z.id])),
      yield*CX1(Z,Q.find((Y)=>/*...*/),B,G),
      zv2(G,Z.id)
    }),
    ig5()  // 使用 MAX_TOOL_USE_CONCURRENCY
  )
}
```

### 官方任务状态更新机制

```javascript
// 更新任务状态
function UW(A,Q,B){
  Q((G)=>{
    let Z=G.tasks?.[A];
    if(!Z)return G;
    return{
      ...G,
      tasks:{
        ...G.tasks,
        [A]:B(Z)
      }
    }
  })
}

// 收集任务附件和进度
function Mj2(A){
  let Q=[],B=[],G={},Z=A.tasks??{};

  for(let Y of Object.values(Z)){
    if(Y.notified&&Y.status!=="running")continue;

    let J=null;
    if(Y.status==="running"){
      let X=s00(Y.id,Y.outputOffset);
      if(X.content)J=X.content,
        G[Y.id]={...Y,outputOffset:X.newOffset};

      let W=Nj2(Y.type)?.getProgressMessage(Y)??null;
      if(W)B.push({
        type:"task_progress",
        taskId:Y.id,
        taskType:Y.type,
        message:W
      })
    }

    if(Y.status!=="running"&&Y.status!=="pending"&&!Y.notified){
      let X=s00(Y.id,Y.outputOffset);
      if(X.content)J=X.content;

      Q.push({
        type:"task_status",
        taskId:Y.id,
        taskType:Y.type,
        status:Y.status,
        description:Y.description,
        deltaSummary:J
      }),
      G[Y.id]={...G[Y.id]??Y,notified:!0,outputOffset:X.newOffset}
    }
  }

  return{
    attachments:Q,
    progressAttachments:B,
    updatedTasks:G
  }
}
```

---

**文档版本**: 1.0
**生成时间**: 2025-12-25
**分析工具**: Claude Code Analysis
