# WebUI 权限系统文档

## 概述

WebUI 权限系统为敏感工具操作提供了用户确认机制，确保用户能够控制 AI 助手对系统的修改。

## 架构

### 核心组件

1. **PermissionHandler** (`src/web/server/permission-handler.ts`)
   - 判断工具是否需要权限
   - 创建和管理权限请求
   - 等待用户响应（异步）
   - 管理会话级别的权限记忆

2. **类型定义** (`src/web/shared/types.ts`)
   - `PermissionRequestPayload` - 权限请求消息
   - `PermissionResponsePayload` - 权限响应消息
   - `PermissionConfigPayload` - 权限配置消息

3. **WebSocket 集成** (`src/web/server/websocket.ts`)
   - 处理前端发送的权限响应
   - 处理权限配置更新

4. **对话管理器集成** (`src/web/server/conversation.ts`)
   - 在工具执行前检查权限
   - 发送权限请求到前端
   - 等待用户响应后继续执行

## 消息流程

### 权限请求流程

```
1. 工具执行前检查
   ConversationManager.executeTool()
   └─> PermissionHandler.needsPermission()

2. 创建权限请求
   PermissionHandler.createRequest()
   └─> 生成 PermissionRequest

3. 发送到前端
   callbacks.onPermissionRequest()
   └─> WebSocket: permission_request

4. 等待用户响应
   PermissionHandler.waitForResponse()
   └─> Promise (等待)

5. 前端用户决定
   用户点击批准/拒绝
   └─> WebSocket: permission_response

6. 处理响应
   ConversationManager.handlePermissionResponse()
   └─> PermissionHandler.handleResponse()
   └─> 解析 Promise

7. 继续或中止执行
   如果批准: 执行工具
   如果拒绝: 返回错误
```

## 需要权限的工具

以下工具需要权限确认：

- **Write** - 创建/覆盖文件
- **Edit** - 编辑文件
- **MultiEdit** - 批量编辑文件
- **Bash** - 执行 shell 命令（部分危险命令）
- **NotebookEdit** - 编辑 Jupyter Notebook
- **KillShell** - 终止后台进程

### Bash 命令风险评估

危险命令模式（需要权限）：
- `rm` - 删除文件
- `sudo` - 超级用户权限
- `chmod`/`chown` - 修改权限
- `mv` - 移动文件到其他目录
- `dd`/`mkfs`/`format` - 磁盘操作
- 包含 `> /dev/` 的命令

## 权限模式

### 1. default（默认模式）
- 敏感操作需要用户确认
- 安全操作自动允许

### 2. bypassPermissions
- **绕过所有权限检查**
- 所有工具直接执行
- 适合完全信任的场景

### 3. acceptEdits
- 自动允许文件编辑（Write、Edit、MultiEdit）
- 其他操作仍需确认
- 适合频繁编辑代码的场景

### 4. plan（计划模式）
- 所有操作都需要确认
- 不执行任何操作
- 适合审查 AI 计划

### 5. dontAsk
- 自动决策（安全操作允许，危险操作拒绝）
- 不询问用户

## 前端集成指南

### 1. 监听权限请求

```typescript
ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'permission_request') {
    const request: PermissionRequestPayload = message.payload;

    // 显示权限确认对话框
    showPermissionDialog({
      requestId: request.requestId,
      tool: request.tool,
      description: request.description,
      riskLevel: request.riskLevel,
      args: request.args,
    });
  }
});
```

### 2. 发送权限响应

```typescript
function approvePermission(requestId: string, remember: boolean = false) {
  ws.send(JSON.stringify({
    type: 'permission_response',
    payload: {
      requestId: requestId,
      approved: true,
      remember: remember,
      scope: remember ? 'session' : 'once'
    }
  }));
}

function denyPermission(requestId: string) {
  ws.send(JSON.stringify({
    type: 'permission_response',
    payload: {
      requestId: requestId,
      approved: false
    }
  }));
}
```

### 3. 更新权限配置

```typescript
function setPermissionMode(mode: 'default' | 'bypassPermissions' | 'acceptEdits') {
  ws.send(JSON.stringify({
    type: 'permission_config',
    payload: {
      mode: mode
    }
  }));
}
```

## UI 设计建议

### 权限确认对话框应包含：

1. **工具名称** - 显示正在请求的工具
2. **操作描述** - 清晰说明要执行的操作
3. **风险级别指示器**
   - 低风险：绿色
   - 中风险：黄色
   - 高风险：红色
4. **详细参数**（可折叠）- 显示完整的工具参数
5. **操作按钮**
   - "批准" - 允许此次操作
   - "拒绝" - 拒绝此次操作
   - "记住此决定"（复选框）- 会话期间记住

### 示例 UI 代码

```tsx
function PermissionDialog({ request, onResponse }) {
  const [remember, setRemember] = useState(false);

  const riskColor = {
    low: 'green',
    medium: 'yellow',
    high: 'red'
  }[request.riskLevel];

  return (
    <Dialog open>
      <DialogTitle>
        权限请求
        <Badge color={riskColor}>{request.riskLevel}</Badge>
      </DialogTitle>

      <DialogContent>
        <Typography variant="h6">{request.tool}</Typography>
        <Typography>{request.description}</Typography>

        <Accordion>
          <AccordionSummary>查看详细参数</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(request.args, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>

        <FormControlLabel
          control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
          label="记住此次决定（本次会话）"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onResponse(request.requestId, false)}>
          拒绝
        </Button>
        <Button
          onClick={() => onResponse(request.requestId, true, remember)}
          variant="contained"
        >
          批准
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## 测试

运行测试脚本：

```bash
npm run dev test-permission.ts
```

测试覆盖：
- 敏感工具检测
- 权限请求创建
- 用户响应处理
- 会话记忆
- 不同权限模式

## 安全考虑

1. **超时机制** - 权限请求默认 60 秒超时
2. **会话隔离** - 每个会话有独立的权限状态
3. **记忆范围**
   - `once` - 仅本次有效
   - `session` - 会话期间有效
   - `always` - 永久记住（待实现持久化）
4. **风险评估** - 自动评估操作风险级别

## 未来改进

1. **持久化权限** - 支持 `always` 范围的权限持久化
2. **规则引擎** - 支持更复杂的权限规则
3. **路径白名单** - 允许特定路径自动批准
4. **审计日志** - 记录所有权限决策
5. **批量操作** - 批量批准多个权限请求

## 参考

- CLI 权限系统: `src/permissions/index.ts`
- 工具注册表: `src/tools/index.ts`
- WebSocket 协议: `src/web/shared/types.ts`
