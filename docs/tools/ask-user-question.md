# AskUserQuestion 工具使用指南

## 概述

AskUserQuestion 工具允许 Claude 向用户提出交互式问题，支持单选和多选模式。该工具提供了美观的终端 UI 和键盘导航支持。

## 特性

- ✨ **键盘导航**: 使用 ↑/↓ 箭头键浏览选项
- 🎯 **多选模式**: 使用空格键选择/取消选择多个选项
- ⚡ **快捷键**: 数字键 1-9 快速选择
- 🎨 **美化 UI**: 使用彩色终端样式和 Unicode 图标
- 🔄 **自适应**: 自动检测 TTY 环境，降级到简单模式
- 📝 **自定义答案**: 自动提供 "Other" 选项支持自定义输入

## 使用示例

### 单选模式

```json
{
  "questions": [
    {
      "question": "Which testing framework should we use?",
      "header": "Framework",
      "options": [
        {
          "label": "Jest",
          "description": "Popular, full-featured testing framework with built-in mocking"
        },
        {
          "label": "Vitest",
          "description": "Fast, Vite-native testing framework with Jest compatibility"
        },
        {
          "label": "Mocha",
          "description": "Flexible, minimalist testing framework"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

### 多选模式

```json
{
  "questions": [
    {
      "question": "Which features should we implement?",
      "header": "Features",
      "options": [
        {
          "label": "Authentication",
          "description": "User login and registration system"
        },
        {
          "label": "Dashboard",
          "description": "Analytics and reporting dashboard"
        },
        {
          "label": "API",
          "description": "RESTful API endpoints"
        },
        {
          "label": "Admin Panel",
          "description": "Administrative interface"
        }
      ],
      "multiSelect": true
    }
  ]
}
```

### 多问题场景

```json
{
  "questions": [
    {
      "question": "What type of application are we building?",
      "header": "App Type",
      "options": [
        {
          "label": "Web App",
          "description": "Browser-based application"
        },
        {
          "label": "Mobile App",
          "description": "iOS/Android native application"
        },
        {
          "label": "Desktop App",
          "description": "Electron or native desktop application"
        }
      ],
      "multiSelect": false
    },
    {
      "question": "Which databases should we support?",
      "header": "Database",
      "options": [
        {
          "label": "PostgreSQL",
          "description": "Advanced open-source relational database"
        },
        {
          "label": "MongoDB",
          "description": "Flexible NoSQL document database"
        },
        {
          "label": "Redis",
          "description": "In-memory data structure store"
        }
      ],
      "multiSelect": true
    }
  ]
}
```

## 交互式 UI 说明

### 单选模式界面

```
┌────────────────────────────────────────────┐
│ Question 1/2                               │
└────────────────────────────────────────────┘

  Framework

  Which testing framework should we use?

  ❯ ◯ 1. Jest - Popular, full-featured testing framework
    ◯ 2. Vitest - Fast, Vite-native testing framework
    ◯ 3. Mocha - Flexible, minimalist testing framework
    ◯ 4. Other - Enter custom response

  ↑/↓: Navigate | Enter: Select | 1-9: Quick select
```

### 多选模式界面

```
┌────────────────────────────────────────────┐
│ Question 1/1                               │
└────────────────────────────────────────────┘

  Features

  Which features should we implement?

  ❯ ◉ 1. Authentication - User login and registration
    ◯ 2. Dashboard - Analytics and reporting dashboard
    ◉ 3. API - RESTful API endpoints
    ◯ 4. Admin Panel - Administrative interface
    ◯ 5. Other - Enter custom response

  ↑/↓: Navigate | Space: Toggle | Enter: Confirm | 1-9: Quick select
```

## 键盘快捷键

### 单选模式
- `↑` / `↓` - 上下移动光标
- `Enter` - 选择当前选项并确认
- `1-9` - 直接选择对应编号的选项并确认
- `Ctrl+C` - 取消并退出

### 多选模式
- `↑` / `↓` - 上下移动光标
- `Space` - 切换当前选项的选中状态
- `Enter` - 确认所有已选择的选项
- `1-9` - 切换对应编号选项的选中状态
- `Ctrl+C` - 取消并退出

## 输出格式

工具执行后返回格式化的答案：

```
✓ User Responses:

  Framework: Jest
  Features: Authentication, API, Dashboard
```

## 约束条件

- **问题数量**: 1-4 个问题
- **选项数量**: 每个问题 2-4 个选项
- **Header 长度**: 最多 12 个字符
- **Label 长度**: 1-5 个单词
- **自动添加**: "Other" 选项会自动添加，无需手动指定

## 环境兼容性

### TTY 环境（交互式）
- 完整的键盘导航支持
- 实时 UI 更新
- 彩色显示和图标

### 非 TTY 环境（简化模式）
- 基于文本的选项列表
- 数字输入选择
- 逗号分隔的多选输入

## 最佳实践

1. **清晰的问题描述**: 使用简洁明了的问题文本
2. **详细的选项说明**: 提供足够的上下文帮助用户做出选择
3. **合理的选项数量**: 保持 2-4 个选项，避免选项过多
4. **有意义的 Header**: 使用简短但描述性的标签
5. **逻辑分组**: 相关问题放在一起，按顺序提问

## 错误处理

工具会在以下情况返回错误：

- 未提供问题
- 问题数量超过 4 个
- 选项数量不在 2-4 范围内
- 用户输入处理失败

错误示例：

```json
{
  "success": false,
  "error": "Question \"Framework\" must have 2-4 options (has 1)"
}
```

## 使用场景

### 1. 技术栈选择
询问用户偏好的技术栈、框架或工具。

### 2. 实现方案确认
在多个实现方案中让用户选择。

### 3. 功能优先级
让用户选择优先实现的功能。

### 4. 配置选项
收集应用配置偏好。

### 5. 需求澄清
当需求不明确时，通过选项帮助用户明确需求。
