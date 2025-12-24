# 官方 Claude Code 斜杠命令完整列表

基于官方 cli.js (v2.0.59) 提取，共 **52 个命令**。

**核查日期**: 2024-12-24
**详细报告**: [COMMAND_AUDIT_REPORT.md](./COMMAND_AUDIT_REPORT.md)

## 命令分类

### 1. 通用命令 (General) - 平均完成度: 40%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/help` | local-jsx | 30% | ⚠️ 无交互式UI |
| `/clear` | local | 40% | ⚠️ 缺少缓存清理 |
| `/exit` | local-jsx | 60% | ⚠️ 缺少随机告别语 |
| `/status` | local-jsx | 25% | ⚠️ 缺少详细面板 |

### 2. 会话命令 (Session) - 平均完成度: 35%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/resume` | local-jsx | 60% | ⚠️ 缺少title搜索 |
| `/compact` | local | 20% | ⚠️ 未实现摘要生成 |
| `/export` | local-jsx | 15% | ⚠️ 未实际导出 |
| `/rename` | local | 10% | ⚠️ 未实际重命名 |
| `/context` | local-jsx | 70% | ✅ 基本完整 |

### 3. 配置命令 (Config) - 平均完成度: 15%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/config` | local-jsx | 50% | ✅ 已修复读写 |
| `/permissions` | local-jsx | 15% | ⚠️ 无交互编辑器 |
| `/model` | local-jsx | 25% | ⚠️ 不支持即时切换 |
| `/init` | prompt | 10% | ⚠️ 无AI分析 |
| `/hooks` | local-jsx | 5% | ⚠️ 只有4/12事件 |
| `/privacy-settings` | local-jsx | 0% | ⚠️ 隐私模型不同 |
| `/output-style` | local-jsx | 0% | ❌ **完全缺失** |
| `/statusline` | prompt | 0% | ❌ **完全缺失** |
| `/terminal-setup` | local-jsx | 0% | ❌ **完全缺失** |

### 4. 工具命令 (Tools) - 平均完成度: 15%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/mcp` | local-jsx | 20% | ⚠️ 无状态管理 |
| `/agents` | local-jsx | 10% | ⚠️ 无CRUD操作 |
| `/ide` | local-jsx | 8% | ⚠️ 无IDE检测 |
| `/plugin` | local-jsx | 15% | ⚠️ 无marketplace |
| `/install-github-app` | local-jsx | 7% | ⚠️ 无安装向导 |
| `/pr-comments` | prompt | 20% | ⚠️ 缺少详细提示词 |
| `/remote-env` | local-jsx | 0% | ❌ **完全缺失** (Web专用) |

### 5. 实用命令 (Utility) - 平均完成度: 40%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/cost` | local-jsx | 80% | ✅ 基本完整 |
| `/usage` | local-jsx | 30% | ⚠️ 定位不同 |
| `/files` | local-jsx | 40% | ⚠️ 功能混合 |
| `/tasks` | local-jsx | 50% | ⚠️ 需细节核查 |
| `/todos` | local-jsx | 50% | ⚠️ 需细节核查 |
| `/add-dir` | local-jsx | 70% | ✅ 基本一致 |
| `/stickers` | local | 10% | ❌ **功能错误** |
| `/passes` | local-jsx | 0% | ❌ **完全缺失** |
| `/context` | local-jsx | 70% | ✅ 基本完整 |

### 6. 认证命令 (Auth) - 平均完成度: 10%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/login` | local-jsx | 5% | ⚠️ 无OAuth流程 |
| `/logout` | local | 10% | ⚠️ 无实际登出 |
| `/extra-usage` | local-jsx | 10% | ⚠️ 无购买流程 |
| `/rate-limit-options` | local-jsx | 0% | ❌ **完全缺失** |

### 7. 开发命令 (Development) - 平均完成度: 8%
| 命令 | 官方类型 | 完成度 | 状态 |
|------|---------|--------|------|
| `/review` | prompt | 5% | ⚠️ 无AI代码审查 |
| `/security-review` | prompt | 5% | ⚠️ 无AI安全扫描 |
| `/plan` | local-jsx | 5% | ⚠️ 无计划编辑器 |
| `/feedback` | local-jsx | 10% | ⚠️ 假提交 |
| `/doctor` | local-jsx | 0% | ❌ **完全缺失** |
| `/upgrade` | local-jsx | 0% | ❌ **完全缺失** |
| `/release-notes` | local | 20% | ⚠️ 硬编码文本 |

### 8. 内置工具 (Built-in Tools)
| 工具 | 描述 | 状态 |
|------|------|------|
| `BashOutput` | Bash 输出 | ✅ 已实现 |
| `Edit Notebook` | 编辑笔记本 | ✅ 已实现 |
| `Fetch` | 网页获取 | ✅ 已实现 |
| `Search` | 搜索 | ✅ 已实现 |
| `Web Search` | 网页搜索 | ✅ 已实现 |
| `TaskCreate` | 创建任务 | ✅ 已实现 |
| `TaskGet` | 获取任务 | ✅ 已实现 |
| `TaskList` | 任务列表 | ✅ 已实现 |
| `TaskUpdate` | 更新任务 | ✅ 已实现 |

---

## 核查任务分配

每个子代理负责核查一组命令，需要检查：

1. **命令是否存在于我们的实现中**
2. **功能是否与官方一致**
3. **输出格式是否接近官方风格**
4. **是否有缺失的功能**

### 核查模板

```
## 命令: /xxx

### 官方行为
- 执行效果: ...
- 输出格式: ...
- 参数支持: ...

### 当前实现
- 文件位置: src/commands/xxx.ts
- 功能完整度: 0-100%
- 缺失功能: ...

### 修复建议
- ...
```

---

## 已完成修复的命令

- [x] `/config` - 支持实际读写配置
- [x] `/skills` - 扫描实际目录
- [x] `/stats` - 显示真实统计
- [x] `/think-back` - 年度回顾
- [x] `/thinkback-play` - 动画效果
- [x] `/chrome` - 检查配置状态
- [x] `/install-slack-app` - 检查 webhook

---

## 待实现的命令

根据核查结果更新此列表。
