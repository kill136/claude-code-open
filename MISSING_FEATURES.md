# Claude Code 缺失功能清单

**基于 13,971 个官方函数的深度对比分析**
**生成时间**: 2026-01-02

---

## 📊 总体覆盖率

| 模块 | 官方函数 | 覆盖率 | 状态 |
|------|---------|--------|------|
| Bash | 478 | 60% | ⚠️ 需改进 |
| File | 249 | 40% | ⚠️ 需改进 |
| Search | 328 | 90% | ✅ 优秀 |
| MCP | 159 | 60% | ⚠️ 需改进 |
| Session | 718 | 90% | ✅ 优秀 |
| Hook | 47 | 23% | ❌ 需大量工作 |

---

## 🔴 P0 - 关键缺失（影响核心功能）

### 1. Bash 工具

| 功能 | 说明 | 工作量 |
|------|------|--------|
| **stdin 输入处理** | 管道输入到命令 | 1-2天 |
| **Windows Jobber** | 后台进程隔离 | 3-5天 |
| **时间字符串解析** | "2h", "30m" 格式 | 1天 |
| **实时输出回显** | echoOutput 选项 | 1天 |

### 2. File 工具

| 功能 | 说明 | 工作量 |
|------|------|--------|
| **文件锁定系统** | 防并发修改 | 2-3周 |
| **EMFILE 处理** | 文件描述符用尽 | 1周 |
| **性能监控** | 慢操作告警 | 1周 |

### 3. MCP 模块

| 功能 | 说明 | 工作量 |
|------|------|--------|
| **MCPB 文件支持** | 官方扩展包 | 2-3周 |
| **输出限制** | MAX_MCP_OUTPUT_TOKENS | 1天 |
| **完整配置验证** | 环境变量展开 | 1周 |

### 4. Hook 系统

| 功能 | 说明 | 工作量 |
|------|------|--------|
| **异步 Hook 执行** | 后台运行 | 1-2周 |
| **Hook 进度消息** | 实时反馈 | 1周 |
| **策略管理** | policySettings | 1周 |

---

## 🟡 P1 - 重要缺失（影响用户体验）

### Bash
- 自定义编码支持 (latin1 等)
- 内存/CPU 限制
- 自动重试机制
- 环境变量白名单

### File
- 图片优化压缩 (400x400, JPEG 20%)
- 历史持久化 (JSONL)
- 编辑器配置管理

### Session
- **Teleport 会话迁移** ⭐ 跨设备同步
- 权限模式控制 (bypassPermissions)
- Session Token 认证
- Session 计数器

### MCP
- 企业权限管理
- 用户配置持久化
- 浏览器桥接

### Hook
- Hook UI 管理界面
- Hook 热重载
- Hook 状态跟踪

---

## 🟢 P2 - 可选功能

- 编辑器集成 (VSCode, Zed, WezTerm)
- 分布式追踪 (OpenTelemetry)
- LSP 推荐跟踪
- React 前端 Hooks

---

## 📈 实施路线图

### Phase 1: 快速胜利 (1-2周)
```
✓ stdin 输入处理
✓ 时间字符串解析
✓ 输出限制
✓ 实时回显
```

### Phase 2: 核心功能 (3-4周)
```
✓ 文件锁定系统
✓ 异步 Hook 执行
✓ Teleport 会话迁移
✓ MCPB 支持
```

### Phase 3: 增强功能 (4-6周)
```
✓ Windows Jobber
✓ 企业权限管理
✓ Hook UI
✓ 图片优化
```

---

## 🎯 代码实现建议

### 1. stdin 支持 (Bash)
```typescript
interface BashInput {
  command: string;
  stdin?: string | Buffer;  // 新增
  // ...
}

// 实现
const proc = spawn(shell, args);
if (input.stdin) {
  proc.stdin.write(input.stdin);
  proc.stdin.end();
}
```

### 2. 文件锁定 (File)
```typescript
class FileLockManager {
  private locks = new Map<string, { mtime: number; timeout: NodeJS.Timeout }>();

  async acquire(path: string, timeout = 10000): Promise<boolean> {
    const lockPath = `${path}.lock`;
    // 创建 .lock 目录
    // 检查 mtime
    // 设置超时清理
  }

  release(path: string): void {
    // 删除 .lock
    // 清理超时
  }
}
```

### 3. 异步 Hook
```typescript
interface HookProcess {
  processId: string;
  status: 'running' | 'completed' | 'failed';
  stdout: string;
  stderr: string;
}

const hookProcesses = new Map<string, HookProcess>();

async function executeAsyncHook(hook: HookConfig): Promise<string> {
  const processId = uuid();
  // 后台执行
  executeInBackground(hook, processId);
  return processId;
}
```

### 4. Teleport 会话
```typescript
interface TeleportedSessionInfo {
  isTeleported: boolean;
  sessionId: string;
  hasLoggedFirstMessage: boolean;
  teleportedAt: number;
}

function teleportSession(sessionId: string, targetDevice: string): Promise<void> {
  // 1. 保存当前状态
  // 2. 生成迁移 token
  // 3. 通过 API 同步
}
```

---

## 📁 文件位置

| 功能 | 需修改文件 |
|------|-----------|
| stdin | src/tools/bash.ts |
| 文件锁 | src/tools/file.ts (新增 FileLockManager) |
| 异步 Hook | src/hooks/index.ts |
| Teleport | src/session/index.ts (新增) |
| MCPB | src/mcp/mcpb.ts (新建) |

---

## 📊 工作量估算

| 优先级 | 功能数 | 工作量 | 建议周期 |
|--------|--------|--------|----------|
| P0 | 12 | 8-12周 | 立即开始 |
| P1 | 15 | 6-10周 | 下一阶段 |
| P2 | 8 | 4-6周 | 可选 |
| **总计** | **35** | **18-28周** | - |

---

## ✅ 已完成的优秀实现

项目在以下方面**超越官方**：

1. **Search**: 双层架构、多种 fallback、结果排序
2. **Session**: Fork/Merge、多格式导出、自动清理
3. **File**: 智能引号匹配、批量编辑、11种错误码
4. **安全**: 命令黑名单、私有IP过滤、审计日志
