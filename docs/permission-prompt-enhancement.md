# PermissionPrompt 组件增强文档

## 概述

增强版的 `PermissionPrompt` 组件提供了一个功能丰富的权限确认界面，用于在 Claude Code CLI 中请求用户授权。

## 新增功能

### 1. 多种工具类型支持

组件现在支持以下权限类型，每种类型都有专门的图标和颜色：

- **📖 File Read** (cyan) - 文件读取
- **✏️ File Write** (yellow) - 文件写入
- **🗑️ File Delete** (red) - 文件删除
- **⚡ Bash Command** (magenta) - Bash 命令执行
- **🌐 Network Request** (blue) - 网络请求
- **🔌 MCP Server** (green) - MCP 服务器连接
- **📦 Plugin Install** (yellow) - 插件安装
- **⚙️ System Config** (red) - 系统配置修改

### 2. 智能资源显示

根据不同的权限类型，资源会以不同方式显示：

- **文件操作**: 自动转换为相对路径（如果在当前目录内）
- **Bash 命令**: 显示完整命令
- **网络请求**: 显示 URL
- **长路径**: 自动截断并显示省略号

### 3. 权限作用域选项

提供 5 种权限决策选项：

1. **[y] Yes, allow once** - 仅允许本次操作
2. **[n] No, deny** - 拒绝本次操作
3. **[s] Allow for this session** - 会话期间记住（程序退出后失效）
4. **[A] Always allow (remember)** - 永久记住（写入配置文件）
5. **[N] Never allow (remember)** - 永久拒绝（写入配置文件）

### 4. 危险操作警告

自动检测危险操作并显示红色警告框：

- 文件删除操作
- 危险的 Bash 命令（rm, sudo, chmod, chown, mv, dd, mkfs, fdisk）
- 系统配置修改

危险操作会：
- 使用红色边框
- 显示警告标题
- 显示额外的警告框

### 5. 已记住模式提示

如果有相似的模式已被记住，会显示提示信息：

```
ℹ  Similar patterns already remembered: *.json, *.config.js
```

### 6. 增强的用户交互

- **快捷键支持**: y/n/s/A/N（大小写不敏感）
- **方向键导航**: ↑/↓ 或 ←/→ 选择选项
- **回车确认**: Enter 键确认当前选中的选项
- **实时描述**: 选中选项时显示详细说明

### 7. 详细信息显示

支持显示额外的详细信息（details 对象）：

```typescript
details={{
  size: '1.2 KB',
  encoding: 'utf-8',
  timeout: '120000ms'
}}
```

## 使用示例

### 基础用法

```typescript
import { PermissionPrompt } from './ui/components/PermissionPrompt.js';

<PermissionPrompt
  toolName="Write"
  type="file_write"
  description="Write content to file"
  resource="/home/user/project/config.json"
  onDecision={(decision) => {
    if (decision.allowed) {
      // 执行操作
      console.log(`Allowed with scope: ${decision.scope}`);
      console.log(`Remember: ${decision.remember}`);
    } else {
      console.log('Permission denied');
    }
  }}
/>
```

### 带详细信息

```typescript
<PermissionPrompt
  toolName="Bash"
  type="bash_command"
  description="Execute shell command"
  resource="npm install axios"
  details={{
    timeout: '120000ms',
    sandbox: false,
  }}
  onDecision={handleDecision}
/>
```

### 带记忆模式提示

```typescript
<PermissionPrompt
  toolName="Edit"
  type="file_write"
  description="Edit configuration file"
  resource="/home/user/.eslintrc.json"
  rememberedPatterns={['*.json', '*.config.js']}
  onDecision={handleDecision}
/>
```

## 集成到 PermissionManager

使用 `ui-integration.tsx` 提供的助手函数：

```typescript
import { UIPermissionManager } from './permissions/ui-integration.js';

const uiManager = new UIPermissionManager();

const request = {
  type: 'file_write',
  tool: 'Write',
  description: 'Write content to file',
  resource: '/home/user/config.json',
  details: { size: '1.2 KB' }
};

const decision = await uiManager.askUser(request);

if (decision.allowed) {
  // 执行操作
  await executeFileWrite();

  // 如果用户选择记住，保存权限
  if (decision.remember) {
    uiManager.rememberPermission(request, decision);
  }
}
```

## 替换现有的 readline 交互

在 `src/permissions/index.ts` 中，可以将现有的 `askUser` 方法替换为使用 React UI：

```typescript
import { askUserWithUI } from './ui-integration.js';

// 在 PermissionManager 类中
private async askUser(request: PermissionRequest): Promise<PermissionDecision> {
  // 替代原来的 readline 实现
  return askUserWithUI(request, this.rememberedPermissions);
}
```

## 类型定义

### PermissionType

```typescript
type PermissionType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'bash_command'
  | 'network_request'
  | 'mcp_server'
  | 'plugin_install'
  | 'system_config';
```

### PermissionScope

```typescript
type PermissionScope = 'once' | 'session' | 'always' | 'never';
```

### PermissionDecision

```typescript
interface PermissionDecision {
  allowed: boolean;      // 是否允许
  scope: PermissionScope; // 作用域
  remember: boolean;      // 是否记住
}
```

### PermissionPromptProps

```typescript
interface PermissionPromptProps {
  toolName: string;                    // 工具名称
  type: PermissionType;                // 权限类型
  description: string;                 // 操作描述
  resource?: string;                   // 资源路径
  details?: Record<string, unknown>;   // 额外详情
  onDecision: (decision: PermissionDecision) => void; // 决策回调
  rememberedPatterns?: string[];       // 已记住的模式
}
```

## 测试示例

运行示例文件查看不同场景：

```bash
# 文件写入示例
tsx src/ui/components/PermissionPrompt.example.tsx file-write

# Bash 命令示例
tsx src/ui/components/PermissionPrompt.example.tsx bash

# 危险操作示例
tsx src/ui/components/PermissionPrompt.example.tsx delete

# 危险 Bash 命令示例
tsx src/ui/components/PermissionPrompt.example.tsx dangerous-bash

# 网络请求示例
tsx src/ui/components/PermissionPrompt.example.tsx network

# MCP 服务器示例
tsx src/ui/components/PermissionPrompt.example.tsx mcp

# 系统配置示例
tsx src/ui/components/PermissionPrompt.example.tsx config

# 带记忆模式示例
tsx src/ui/components/PermissionPrompt.example.tsx remembered
```

## 视觉效果

### 普通权限请求

```
╭─────────────────────────────────────────╮
│ 🔐 Permission Required                  │
│                                         │
│ ✏️  Write (File Write)                  │
│   Write content to file                 │
│ File: ./src/config.json                 │
│                                         │
│ ❯ [y] Yes, allow once                   │
│   [n] No, deny                          │
│   [s] Allow for this session            │
│   [A] Always allow (remember)           │
│   [N] Never allow (remember)            │
│                                         │
│ ↑/↓ to navigate · enter to select      │
╰─────────────────────────────────────────╯
```

### 危险操作警告

```
╭─────────────────────────────────────────╮ (红色边框)
│ ⚠️  DANGEROUS OPERATION - Permission    │
│     Required                            │
│                                         │
│ 🗑️  Delete (File Delete)                │
│   Delete file permanently               │
│ File: /home/user/important-data.db      │
│                                         │
│ ┌───────────────────────────────────┐   │ (红色警告框)
│ │ ⚠️  WARNING: This operation could │   │
│ │     be destructive!               │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ❯ [y] Yes, allow once                   │
│   ...                                   │
╰─────────────────────────────────────────╯
```

## 最佳实践

1. **始终提供清晰的描述**: description 应该简洁说明操作意图
2. **包含资源路径**: 让用户知道操作的具体目标
3. **使用 details 补充信息**: 提供额外上下文帮助用户决策
4. **处理所有决策情况**: 确保正确处理 allowed/denied 和各种 scope
5. **记住用户选择**: 如果 remember=true，保存到配置文件

## 与官方 CLI 的兼容性

此实现基于官方 Claude Code CLI v2.0.76 的行为模式：

- ✅ 支持所有官方权限类型
- ✅ 兼容权限模式系统
- ✅ 支持会话和永久记忆
- ✅ 提供与官方类似的视觉效果
- ✅ 使用 Ink 框架保持一致的 UI 风格

## 后续改进建议

1. 添加权限历史记录查看
2. 支持批量权限决策
3. 添加权限预设配置文件
4. 实现权限审计日志
5. 支持自定义危险操作规则
6. 添加权限撤销功能

## 相关文件

- `/src/ui/components/PermissionPrompt.tsx` - 主组件实现
- `/src/ui/components/PermissionPrompt.example.tsx` - 使用示例
- `/src/permissions/ui-integration.tsx` - 集成助手
- `/src/permissions/index.ts` - 权限管理器
- `/src/types/index.ts` - 类型定义
