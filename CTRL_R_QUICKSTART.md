# Ctrl+R 快速开始指南

## 🚀 立即使用

### 1. 编译并运行
```bash
npm run build
npm run dev
```

### 2. 快速体验

#### 步骤 1：创建一些历史记录
在 CLI 中输入几条命令（任意文本都可以）：
```
Read /src/index.ts
Grep "function" src/
Edit /src/app.tsx
Bash ls -la
```

#### 步骤 2：按 `Ctrl+R`
你会看到搜索界面：
```
(reverse-i-search)`': Bash ls -la
[1/4 matches] (Ctrl+R: next, Ctrl+S: prev, Enter: select, Esc: cancel)
```

#### 步骤 3：输入搜索关键词
输入 `src`，会看到所有包含 "src" 的命令：
```
(reverse-i-search)`src': Grep "function" src/
[1/3 matches]

▶ Grep "function" src/
  Edit /src/app.tsx
  Read /src/index.ts
```

#### 步骤 4：导航和选择
- 按 `Ctrl+R` 切换到下一个匹配
- 按 `Ctrl+S` 切换到上一个匹配
- 按 `Enter` 选择当前命令
- 按 `Esc` 取消搜索

## 🎯 常用场景

### 场景 1：重复使用长命令
```
之前运行: Grep "async function" src/ -A 5 -B 2
现在: Ctrl+R → 输入 "async" → Enter
```

### 场景 2：查找文件操作
```
Ctrl+R → 输入 "Read" → 看到所有 Read 命令
```

### 场景 3：查找特定路径
```
Ctrl+R → 输入 "/src/components" → 看到该路径的所有操作
```

## 📁 历史记录位置

- **Linux/macOS**: `~/.claude/command_history.json`
- **Windows**: `%USERPROFILE%\.claude\command_history.json`

## 🔧 高级技巧

1. **空搜索浏览全部**: 按 `Ctrl+R` 后直接 `Ctrl+R` 可以浏览所有历史
2. **精确搜索**: 使用更具体的关键词减少匹配数量
3. **快速取消**: 连按 `Esc` 两次完全退出

## ❓ 遇到问题？

查看详细文档：
- 使用指南: `docs/CTRL_R_USAGE.md`
- 实现说明: `CTRL_R_IMPLEMENTATION.md`

## 📊 功能对比

| 功能 | 官方 Claude Code | 本实现 |
|------|-----------------|--------|
| Ctrl+R 搜索 | ✅ | ✅ |
| 持久化存储 | ✅ | ✅ |
| 增量搜索 | ✅ | ✅ |
| 高亮匹配 | ❌ | ✅ |
| 匹配列表 | ❌ | ✅ (最多5条) |
| Ctrl+S 反向 | ❓ | ✅ |

## 🎉 开始使用

现在你可以享受高效的命令历史搜索了！按 `Ctrl+R` 开始探索吧！

---

**Enjoy coding with Claude Code! 🚀**
