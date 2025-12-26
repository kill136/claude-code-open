# Bash 后台执行功能改进

## 修改概述

参考官方 @anthropic-ai/claude-code 源码，完善了 Bash 工具的后台执行功能，使其与官方实现保持一致。

## 主要修改

### 1. 输出文件持久化（`src/tools/bash.ts`）

**改进前：**
- 后台 shell 输出仅存储在内存中（`output` 数组）
- 使用专门的 BashOutput 工具读取输出

**改进后：**
- 后台 shell 输出同时写入文件和内存
- 输出文件路径：`~/.claude/background/<shell-id>.log`
- 支持两种读取方式：
  1. 使用 Read 工具读取输出文件（官方推荐方式）
  2. 使用 BashOutput 工具实时增量读取（本项目特色）

### 2. 返回消息格式

**改进前：**
```
Background process started with ID: bash_xxx
Max runtime: 600000ms
Use BashOutput tool to retrieve output.
```

**改进后（匹配官方格式）：**
```xml
<shell-id>bash_xxx</shell-id>
<output-file>/home/user/.claude/background/bash_xxx.log</output-file>
<status>running</status>
<summary>Background command "your command..." started.</summary>
Read the output file to retrieve the output. You can also use BashOutput tool with bash_id="bash_xxx" for real-time incremental updates.
```

### 3. 字段名称兼容性（`src/types/results.ts`）

添加了 `shell_id` 字段以匹配官方字段名，同时保留 `bash_id` 向后兼容：

```typescript
export interface BashToolResult extends ToolResult {
  bash_id?: string;   // 向后兼容
  shell_id?: string;  // 官方字段名
  // ... 其他字段
}
```

### 4. 资源管理改进

所有清理函数现在都会正确关闭输出文件流：
- `cleanupCompletedShells()` - 清理已完成的 shell
- `cleanupTimedOutShells()` - 清理超时的 shell
- `killAllBackgroundShells()` - 强制终止所有后台 shell
- `KillShellTool.execute()` - 终止指定的 shell

### 5. 新增功能

添加了 `getBackgroundOutputPath(shellId)` 函数来统一管理输出文件路径：
```typescript
function getBackgroundOutputPath(shellId: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const claudeDir = path.join(homeDir, '.claude', 'background');

  // 自动创建目录
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  return path.join(claudeDir, `${shellId}.log`);
}
```

## 官方实现对比

### 官方工具
根据类型定义 (`/tmp/package/sdk-tools.d.ts`)，官方提供：
- `BashInput` - 支持 `run_in_background` 参数
- `KillShellInput` - 使用 `shell_id` 终止后台进程
- `TaskOutputInput` - 主要用于 Agent，可能也用于 Bash

**官方没有** 专门的 BashOutput 工具！

### 本项目优势

保留了 `BashOutputTool`，提供以下优势：
1. **实时增量读取** - 无需重复读取整个文件
2. **过滤功能** - 支持 regex 过滤输出行
3. **内存缓存** - 读取后清空缓存，节省内存

## 使用示例

### 方式 1：官方风格（使用 Read 工具）

```typescript
// 1. 启动后台命令
const result = await bashTool.execute({
  command: 'npm test',
  run_in_background: true
});

// 2. 从返回消息中提取 shell-id 和 output-file
// <shell-id>bash_123</shell-id>
// <output-file>/home/user/.claude/background/bash_123.log</output-file>

// 3. 使用 Read 工具读取输出文件
const output = await readTool.execute({
  file_path: '/home/user/.claude/background/bash_123.log'
});
```

### 方式 2：本项目特色（使用 BashOutput 工具）

```typescript
// 1. 启动后台命令
const result = await bashTool.execute({
  command: 'npm test',
  run_in_background: true
});

// 2. 使用 BashOutput 实时读取（只返回新输出）
const output1 = await bashOutputTool.execute({
  bash_id: 'bash_123'
});

// 3. 再次读取只会返回新的输出（增量）
const output2 = await bashOutputTool.execute({
  bash_id: 'bash_123',
  filter: 'ERROR|WARN'  // 可选：过滤输出
});
```

## 兼容性

- ✅ 向后兼容 - `bash_id` 字段仍然可用
- ✅ 官方兼容 - 支持 `shell_id` 字段和输出文件
- ✅ 工具兼容 - BashOutput 工具继续提供增强功能

## 文件变更

1. `/home/user/claude-code-open/src/tools/bash.ts`
   - 添加 `getBackgroundOutputPath()` 函数
   - 修改 `ShellState` 接口添加 `outputFile` 和 `outputStream`
   - 更新 `executeBackground()` 方法实现文件输出
   - 更新所有清理函数关闭文件流

2. `/home/user/claude-code-open/src/types/results.ts`
   - 在 `BashToolResult` 接口添加 `shell_id` 字段

## 测试建议

```bash
# 1. 编译项目
npm run build

# 2. 测试后台执行
node dist/cli.js

# 在 Claude 对话中：
# "Run 'sleep 5 && echo done' in the background"

# 3. 检查输出文件
ls -la ~/.claude/background/
cat ~/.claude/background/bash_*.log

# 4. 测试 BashOutput 工具
# "Use BashOutput to check the status of bash_xxx"

# 5. 测试 KillShell 工具
# "Kill the background shell bash_xxx"
```

## 参考资料

- 官方类型定义：`/tmp/package/sdk-tools.d.ts`
- 官方源码：`/tmp/package/cli.js`（混淆代码，搜索关键词：`shell-id`, `output-file`, `Background command`）
