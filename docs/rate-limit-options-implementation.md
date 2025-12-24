# Rate Limit Options 命令实现文档

## 概述

成功从官方源码复制并实现了 `/rate-limit-options` 命令。

## 官方源码分析

### 源码位置
- 官方源码: `/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 实现位置: 项目中 `/home/user/claude-code-open/src/commands/auth.ts`

### 官方实现特点

```javascript
JE9={
  type:"local-jsx",
  name:"rate-limit-options",
  userFacingName(){return"rate-limit-options"},
  description:"Show options when rate limit is reached",
  isEnabled:()=>{
    let A=f4();
    return A==="pro"||A==="max"
  },
  isHidden:!0,
  async call(A,Q){
    return Au.default.createElement(Tv3,{onDone:A,context:Q})
  }
}
```

**核心功能组件 Tv3:**
```javascript
function Tv3({onDone:A,context:Q}){
  // 功能：
  // 1. 检测用户订阅类型 (pro/max)
  // 2. 检测是否有额外使用量
  // 3. 根据条件显示不同选项：
  //    - Stop and wait for limit to reset
  //    - Switch to Sonnet (如果是 Pro 用户使用 Opus)
  //    - Add/Switch to extra usage
  //    - Upgrade your plan
  // 4. 提供交互式菜单选择
}
```

## 项目实现

### 实现文件
- `/home/user/claude-code-open/src/commands/auth.ts` (第217-287行)

### 命令详情

**命令名称:** `rate-limit-options`

**类别:** `auth` (认证相关)

**描述:** Show options when rate limit is reached

**功能:**
当用户达到 API 速率限制时，显示可用的解决方案选项。

### 实现的功能

#### 1. 速率限制信息
- 说明不同层级的速率限制
- 显示当前认证状态
- 提供速率限制重置时间信息

#### 2. 可用选项

**选项 1: 停止并等待限制重置**
- API 速率限制通常按小时或天重置
- 检查 API 仪表板获取准确重置时间
- 免费层：更低限制，更长重置周期
- 付费层：更高限制，更短重置周期

**选项 2: 切换到低成本模型**
- 从 Opus 切换到 Sonnet 或 Haiku
- Sonnet: 性能和成本的平衡
- Haiku: 最快且最经济
- 使用 /model 命令切换模型

**选项 3: 添加额外使用量** (claude.ai 用户)
- 适用于 Pro 和 Max 订阅用户
- 购买超出计划限制的额外令牌
- 访问 https://claude.ai/settings 添加额外使用量
- 超出限制时自动计费

**选项 4: 升级计划**
- Free → Pro: 更高限制，优先访问
- Pro → Max: 最大限制，20倍更高速率限制
- 访问 /upgrade 查看升级选项
- API 用户: 在 console.anthropic.com 提高支出限制

**选项 5: 使用基于使用量的 API 密钥计费**
- 从 claude.ai 切换到 API 密钥
- 只为实际使用付费
- 无需订阅
- 设置自定义支出限制
- 获取 API 密钥: https://console.anthropic.com

#### 3. 速率限制层级对比

- **Free:** 每天有限请求
- **Pro:** ~10倍于 Free 的请求量
- **Max:** ~20倍于 Pro 的请求量 (default_claude_max_20x)
- **API:** 基于支出限制的自定义限制

#### 4. 最佳实践

- 使用 /usage 和 /cost 命令监控使用情况
- 尽可能批量处理相似请求
- 为每个任务使用适当的模型
- 设置支出限制以避免意外
- 考虑缓存重复查询的响应

#### 5. 快速帮助命令

- `/usage` - 检查当前使用情况
- `/cost` - 查看成本详情
- `/model` - 切换到不同模型
- `/upgrade` - 升级您的计划

### 技术实现

```typescript
export const rateLimitOptionsCommand: SlashCommand = {
  name: 'rate-limit-options',
  description: 'Show options when rate limit is reached',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    // 检测认证状态
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

    // 构建详细的选项信息
    const optionsInfo = `...`;

    // 显示信息给用户
    ctx.ui.addMessage('assistant', optionsInfo);
    return { success: true };
  },
};
```

### 注册流程

命令在 `registerAuthCommands()` 函数中注册:

```typescript
export function registerAuthCommands(): void {
  commandRegistry.register(loginCommand);
  commandRegistry.register(logoutCommand);
  commandRegistry.register(upgradeCommand);
  commandRegistry.register(passesCommand);
  commandRegistry.register(extraUsageCommand);
  commandRegistry.register(rateLimitOptionsCommand); // ← 新增
}
```

## 与官方版本的差异

### 官方版本特点:
1. 使用 React JSX 组件渲染交互式 UI
2. 根据用户订阅类型动态显示/隐藏选项
3. 仅在 Pro/Max 用户时启用
4. 隐藏命令 (isHidden: true)
5. 提供实时的选项选择和执行

### 我们的实现:
1. 使用纯文本输出，提供所有信息
2. 显示所有可用选项及其详细说明
3. 对所有用户可用
4. 可见命令（可手动调用查看选项）
5. 提供指导性信息，需要用户手动执行后续命令

### 选择文本实现的原因:
1. 项目是教育性质的反向工程项目
2. 简化实现，专注于核心功能
3. 更容易理解和维护
4. 提供完整信息而不需要复杂的 UI 交互
5. 适合非交互式环境和脚本使用

## 编译验证

### 编译状态
✅ TypeScript 编译成功
✅ 无类型错误
✅ 命令已正确导出和注册

### 编译输出
- 源文件: `src/commands/auth.ts`
- 编译输出: `dist/commands/auth.js`
- 命令已包含在编译后的代码中

## 使用方法

```bash
# 在 Claude Code 中使用
/rate-limit-options

# 或通过 CLI 直接调用
node dist/cli.js "/rate-limit-options"
```

## 相关命令

- `/login` - 登录到 Claude API
- `/logout` - 登出
- `/upgrade` - 升级订阅
- `/extra-usage` - 购买额外使用量
- `/passes` - 查看/分享访客通行证
- `/usage` - 查看使用情况
- `/cost` - 查看成本详情
- `/model` - 切换模型

## 总结

成功从官方源码复制并改编实现了 `/rate-limit-options` 命令。该实现：

1. ✅ 保持了核心功能：提供速率限制解决方案
2. ✅ 适应了项目架构：使用文本输出而非交互式 UI
3. ✅ 提供了全面信息：包含所有5个主要选项
4. ✅ 编译成功：无类型错误
5. ✅ 正确注册：已添加到命令注册表

该命令为用户在遇到速率限制时提供了清晰、全面的解决方案指南。
