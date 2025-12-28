# AskUserQuestion 工具增强功能

## 概述

本文档描述了对 AskUserQuestion 工具的增强功能。这些增强功能基于官方 Claude Code v2.0.76 的实现，并在实现层面添加了额外的交互选项。

## 官方特性

AskUserQuestion 工具的官方特性包括：

- ✅ 键盘导航 (↑/↓ 箭头键)
- ✅ 多选模式 (空格键选择/取消，支持复选框 UI)
- ✅ 数字快捷键 (1-9)
- ✅ 自定义答案选项 ("Other" 选项自动添加)
- ✅ 美化的终端 UI
- ✅ 支持 1-4 个问题同时询问
- ✅ 每个问题支持 2-4 个选项
- ✅ 选项包含 label 和 description

## 增强特性

### 1. 默认值支持 (defaultIndex)

允许为问题设置默认选中的选项。

**特性：**
- 单选模式：光标默认定位在指定选项上
- 多选模式：默认选项自动被选中（显示为已勾选）
- 超时时自动使用默认值

**用法：**
```typescript
{
  question: "Which framework should we use?",
  header: "Framework",
  options: [
    { label: "React (Recommended)", description: "Popular UI library" },
    { label: "Vue", description: "Progressive framework" }
  ],
  multiSelect: false,
  defaultIndex: 0  // 默认选中第一个选项（React）
}
```

**显示效果：**
```
  [Up/Down]: Navigate | [Enter]: Select | [1-9]: Quick select | Default: React (Recommended)
```

### 2. 超时处理 (timeout)

为问题设置超时时间（毫秒），超时后自动使用当前选中项或默认值。

**特性：**
- 超时后自动完成选择，避免无限等待
- 显示剩余时间提示
- 单选模式：使用当前光标所在选项
- 多选模式：使用已选中的所有选项（如果没有选中，则使用默认值）

**用法：**
```typescript
{
  question: "Continue with default settings?",
  header: "Settings",
  options: [
    { label: "Yes", description: "Use default configuration" },
    { label: "No", description: "Customize settings" }
  ],
  multiSelect: false,
  defaultIndex: 0,
  timeout: 10000  // 10秒后自动选择
}
```

**超时行为：**
- 如果用户在 10 秒内没有做出选择，自动选择 defaultIndex 指定的选项
- 显示黄色提示信息：`Timeout after 10000ms. Using default selection.`

### 3. 输入验证 (validator)

为自定义输入（"Other" 选项）提供验证功能。

**特性：**
- 自动拒绝空输入
- 支持自定义验证函数
- 验证失败时显示错误信息并重新询问
- 验证通过后才接受输入

**用法：**
```typescript
{
  question: "Enter project name",
  header: "Project",
  options: [
    { label: "my-app", description: "Default name" },
    { label: "Other", description: "Custom name" }
  ],
  multiSelect: false,
  validator: (input: string) => {
    // 只允许小写字母、数字和连字符
    if (!/^[a-z0-9-]+$/.test(input)) {
      return {
        valid: false,
        message: "Only lowercase letters, numbers, and hyphens allowed"
      };
    }
    return { valid: true };
  }
}
```

**验证示例：**

```typescript
// 邮箱验证
validator: (input) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input)) {
    return {
      valid: false,
      message: 'Please enter a valid email address'
    };
  }
  return { valid: true };
}

// 长度验证
validator: (input) => {
  if (input.length < 3 || input.length > 50) {
    return {
      valid: false,
      message: 'Input must be between 3 and 50 characters'
    };
  }
  return { valid: true };
}

// URL 验证
validator: (input) => {
  try {
    new URL(input);
    return { valid: true };
  } catch {
    return {
      valid: false,
      message: 'Please enter a valid URL'
    };
  }
}
```

### 4. 空输入保护

自动功能，无需配置。

**特性：**
- 自动拒绝空的自定义输入
- 显示错误信息并重新询问
- 确保用户必须提供有效输入

## 组合使用

这些增强功能可以组合使用：

```typescript
{
  question: "Enter your email address:",
  header: "Email",
  options: [
    { label: "user@example.com", description: "Default email" },
    { label: "admin@example.com", description: "Admin email" }
  ],
  multiSelect: false,
  defaultIndex: 0,        // 默认选中第一个
  timeout: 15000,         // 15秒超时
  validator: (input) => { // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      return {
        valid: false,
        message: 'Please enter a valid email address'
      };
    }
    return { valid: true };
  }
}
```

## 实现细节

### 类型定义

增强功能通过扩展内部 `Question` 接口实现：

```typescript
interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
  // 增强功能（实现层面）
  defaultIndex?: number;
  timeout?: number;
  validator?: (input: string) => { valid: boolean; message?: string };
}
```

### 兼容性

- ✅ 完全兼容官方 AskUserQuestion schema
- ✅ 增强字段是可选的，不影响现有代码
- ✅ 在不支持的环境中优雅降级
- ✅ 非 TTY 环境（如 CI/CD）自动切换到简单模式

### 限制

1. **defaultIndex 范围**：必须在 0 到 options.length-1 之间
2. **timeout 最小值**：建议不小于 3000ms（3秒）
3. **validator 性能**：应该快速返回，避免阻塞 UI
4. **非交互环境**：在非 TTY 环境中，超时功能可能不可用

## 使用场景

### 场景 1: 快速确认

用户需要快速确认某个操作，如果没有响应则使用默认值：

```typescript
{
  question: "Continue with installation?",
  header: "Confirm",
  options: [
    { label: "Yes", description: "Proceed with installation" },
    { label: "No", description: "Cancel installation" }
  ],
  multiSelect: false,
  defaultIndex: 0,
  timeout: 5000  // 5秒自动继续
}
```

### 场景 2: 项目初始化

创建新项目时需要验证项目名称：

```typescript
{
  question: "What's your project name?",
  header: "Project",
  options: [
    { label: "my-project", description: "Default project name" }
  ],
  multiSelect: false,
  validator: (input) => {
    if (!/^[a-z][a-z0-9-]*$/.test(input)) {
      return {
        valid: false,
        message: "Project name must start with a letter and contain only lowercase letters, numbers, and hyphens"
      };
    }
    return { valid: true };
  }
}
```

### 场景 3: 功能选择

让用户选择要启用的功能，推荐某些选项：

```typescript
{
  question: "Which features do you want to enable?",
  header: "Features",
  options: [
    { label: "TypeScript", description: "Type-safe JavaScript (Recommended)" },
    { label: "ESLint", description: "Code linting" },
    { label: "Prettier", description: "Code formatting" }
  ],
  multiSelect: true,
  defaultIndex: 0  // 推荐 TypeScript
}
```

## 测试

示例代码位于 `examples/ask-user-question-enhanced.ts`：

```bash
# 运行示例
npm run dev examples/ask-user-question-enhanced.ts
```

## 参考

- 官方源码：`node_modules/@anthropic-ai/claude-code/sdk-tools.d.ts`
- 实现代码：`src/tools/ask.ts`
- 类型定义：`src/types/tools.ts`

## 贡献

如需添加更多验证器示例或使用场景，请提交 PR 到本仓库。

## 版本历史

- **v1.0.0** (2025-12-28): 初始版本，添加默认值、超时和验证功能
