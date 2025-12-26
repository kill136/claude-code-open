# Claude Code Open - 任务认领看板

> 快速查看和认领任务，详细说明请看 [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)

---

## 🔴 P0 - 阻塞性 (必须优先)

| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-001 | Bash 沙箱集成 | ⭐⭐⭐ | `src/tools/bash.ts` | |
| T-015 | 权限规则解析器 | ⭐⭐⭐ | `src/permissions/` | |
| T-024 | 配置来源优先级 | ⭐⭐ | `src/config/index.ts` | |
| T-032 | Linux Bubblewrap | ⭐⭐⭐⭐ | `src/sandbox/bubblewrap.ts` | |
| T-035 | Windows 兼容性 | ⭐⭐⭐ | 多个 | |

---

## 🟠 P1 - 重要功能

### 工具系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-002 | Bash 后台执行增强 | ⭐⭐ | `src/tools/bash.ts` | |
| T-003 | Read 媒体文件支持 | ⭐⭐⭐ | `src/tools/file.ts` | |
| T-005 | Edit 策略验证 | ⭐⭐ | `src/tools/file.ts` | |
| T-007 | AskUser 多选支持 | ⭐⭐ | `src/tools/ask.ts` | |

### 命令系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-008 | /add-dir 命令 | ⭐ | `src/commands/config.ts` | |
| T-010 | /pr 命令 | ⭐⭐ | `src/commands/development.ts` | |

### Hooks 系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-012 | Hooks 事件完整性 | ⭐⭐ | `src/hooks/index.ts` | |
| T-013 | Hook 类型支持 | ⭐⭐ | `src/hooks/` | |

### 权限系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-016 | 权限持久化 | ⭐⭐ | `src/permissions/` | |

### MCP 系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-018 | MCP 自动发现 | ⭐⭐ | `src/mcp/` | |

### UI 组件
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-021 | Vim/Emacs 模式 | ⭐⭐⭐ | `src/ui/components/Input.tsx` | |
| T-023 | 快捷键增强 | ⭐⭐ | `src/ui/hooks/` | |

### 配置系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-025 | 环境变量完整性 | ⭐ | `src/config/` | |

### 认证系统
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-026 | OAuth 流程完善 | ⭐⭐⭐ | `src/auth/index.ts` | |

### 会话管理
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-029 | 会话自动保存 | ⭐⭐ | `src/session/index.ts` | |
| T-030 | 会话压缩 Compact | ⭐⭐⭐ | `src/session/`, `src/context/` | |
| T-031 | Checkpoint 系统 | ⭐⭐⭐ | `src/checkpoint/` | |

### 沙箱安全
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-033 | macOS Seatbelt | ⭐⭐⭐⭐ | `src/sandbox/seatbelt.ts` | |
| T-034 | 网络沙箱 | ⭐⭐⭐ | `src/sandbox/network.ts` | |

### 平台支持
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-036 | Ripgrep 多平台 | ⭐⭐ | `src/search/ripgrep.ts` | |

### 测试
| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-040 | 单元测试框架 | ⭐⭐ | `tests/unit/` | |
| T-041 | 集成测试 | ⭐⭐⭐ | `tests/integration/` | |

---

## 🟡 P2 - 一般功能

| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-004 | Grep 参数完整性 | ⭐ | `src/tools/search.ts` | |
| T-006 | WebFetch 重定向 | ⭐ | `src/tools/web.ts` | |
| T-009 | /deny 命令 | ⭐ | `src/commands/config.ts` | |
| T-011 | /cost 计算验证 | ⭐ | `src/commands/utility.ts` | |
| T-014 | Hook 返回码处理 | ⭐ | `src/hooks/` | |
| T-017 | 权限审计日志 | ⭐⭐ | `src/permissions/audit.ts` | |
| T-019 | MCP 采样功能 | ⭐⭐⭐ | `src/mcp/sampling.ts` | |
| T-020 | MCP 取消和进度 | ⭐⭐ | `src/mcp/` | |
| T-027 | Bedrock/Vertex 认证 | ⭐⭐⭐ | `src/providers/` | |
| T-028 | MFA 支持 | ⭐⭐⭐ | `src/auth/mfa.ts` | |
| T-037 | 启动时间优化 | ⭐⭐ | - | |
| T-038 | 内存使用优化 | ⭐⭐⭐ | - | |
| T-039 | 单文件打包 | ⭐⭐⭐ | - | |
| T-042 | E2E 测试 | ⭐⭐⭐ | `tests/e2e/` | |

---

## 🟢 P3 - 锦上添花

| ID | 任务 | 难度 | 文件 | 认领人 |
|----|------|------|------|--------|
| T-022 | 欢迎界面优化 | ⭐ | `src/ui/components/WelcomeScreen.tsx` | |

---

## 认领规则

1. **认领方式**:
   - Fork 项目
   - 在此文件对应任务行填写你的 GitHub ID
   - 提交 PR 更新此文件

2. **开发流程**:
   ```bash
   git checkout -b feature/T-XXX-描述
   # 开发...
   git commit -m "feat(T-XXX): 描述"
   git push origin feature/T-XXX-描述
   # 创建 PR
   ```

3. **注意事项**:
   - 一人同时最多认领 3 个任务
   - 超过 7 天未提交进度可被释放
   - PR 需要至少 1 人 review

---

## 统计

| 优先级 | 总数 | 已认领 | 已完成 |
|--------|------|--------|--------|
| P0 | 5 | 0 | 0 |
| P1 | 19 | 0 | 0 |
| P2 | 14 | 0 | 0 |
| P3 | 1 | 0 | 0 |
| **合计** | **39** | **0** | **0** |

---

## 难度分布

| 难度 | 数量 | 预估总工时 |
|------|------|-----------|
| ⭐ 简单 | 8 | 16-32h |
| ⭐⭐ 简单+ | 14 | 56-112h |
| ⭐⭐⭐ 中等 | 14 | 112-224h |
| ⭐⭐⭐⭐ 困难 | 3 | 48-120h |
| **合计** | **39** | **232-488h** |

---

> 最后更新: 2024-12-26
