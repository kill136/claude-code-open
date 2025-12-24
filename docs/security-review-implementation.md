# Security-Review 命令完善文档

## 概述

根据官方源码 (`@anthropic-ai/claude-code` v2.0.59) 完善了 `/security-review` 命令，使其具备完整的安全审查功能。

## 官方源码位置

- 文件：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 行号：约 3311-3500 行
- 类型：`prompt` 类型命令

## 实现细节

### 1. 命令基本信息

```typescript
name: 'security-review'
aliases: ['security', 'sec']
description: 'Complete a security review of the pending changes on the current branch'
usage: '/security-review'
category: 'development'
```

### 2. 核心功能

该命令基于官方 prompt 模板，执行以下安全审查：

#### Git 分支变更分析
- `git status` - 查看当前状态
- `git diff --name-only origin/HEAD...` - 列出修改文件
- `git log --no-decorate origin/HEAD...` - 查看提交历史
- `git diff --merge-base origin/HEAD` - 获取完整 diff

#### 安全类别检查

1. **输入验证漏洞**
   - SQL 注入
   - 命令注入
   - XXE 注入
   - 模板注入
   - NoSQL 注入
   - 路径遍历

2. **认证与授权问题**
   - 认证绕过
   - 权限提升
   - 会话管理缺陷
   - JWT 令牌漏洞
   - 授权逻辑绕过

3. **加密和密钥管理**
   - 硬编码的 API 密钥、密码或令牌
   - 弱加密算法
   - 密钥存储不当
   - 加密随机性问题
   - 证书验证绕过

4. **注入和代码执行**
   - 反序列化远程代码执行
   - Python Pickle 注入
   - YAML 反序列化漏洞
   - Eval 注入
   - XSS 漏洞（反射型、存储型、DOM型）

5. **数据暴露**
   - 敏感数据日志记录或存储
   - PII 处理违规
   - API 端点数据泄露
   - 调试信息暴露

### 3. 分析方法论

#### Phase 1 - 仓库上下文研究
- 识别现有的安全框架和库
- 查找已建立的安全编码模式
- 检查现有的清理和验证模式
- 理解项目的安全模型和威胁模型

#### Phase 2 - 对比分析
- 将新代码变更与现有安全模式对比
- 识别与已建立安全实践的偏差
- 查找不一致的安全实现
- 标记引入新攻击面的代码

#### Phase 3 - 漏洞评估
- 检查每个修改文件的安全影响
- 追踪从用户输入到敏感操作的数据流
- 查找不安全地跨越权限边界的情况
- 识别注入点和不安全的反序列化

### 4. 输出格式要求

每个发现必须包含：
- 文件路径和行号
- 严重性级别（HIGH/MEDIUM/LOW）
- 漏洞类别（如 `sql_injection`, `xss`）
- 详细描述
- 利用场景
- 修复建议

示例：
```markdown
# Vuln 1: XSS: `foo.py:42`

* Severity: High
* Description: User input from `username` parameter is directly interpolated into HTML without escaping
* Exploit Scenario: Attacker crafts URL like /bar?q=<script>alert(document.cookie)</script> to execute JavaScript
* Recommendation: Use Flask's escape() function or Jinja2 templates with auto-escaping enabled
```

### 5. 严重性等级指南

- **HIGH**: 可直接利用的漏洞，导致 RCE、数据泄露或认证绕过
- **MEDIUM**: 需要特定条件但有重大影响的漏洞
- **LOW**: 纵深防御问题或影响较小的漏洞

### 6. 置信度评分

- 0.9-1.0：确定的利用路径，如可能已测试
- 0.8-0.9：清晰的漏洞模式，具有已知的利用方法
- 0.7-0.8：需要特定条件才能利用的可疑模式
- 低于 0.7：不报告（过于推测）

### 7. 假阳性过滤

#### 硬排除（HARD EXCLUSIONS）

以下类型不报告：
1. 拒绝服务 (DOS) 漏洞
2. 安全存储在磁盘上的密钥或凭据
3. 速率限制问题
4. 内存消耗或 CPU 耗尽问题
5. 非安全关键字段缺少输入验证
6. GitHub Action 工作流的输入清理问题
7. 缺乏加固措施
8. 理论性的竞态条件或时序攻击
9. 过时的第三方库漏洞
10. Rust 等内存安全语言的内存安全问题
11. 仅用于单元测试的文件
12. 日志伪造问题
13. 仅控制路径的 SSRF 漏洞
14. AI 系统提示中包含用户控制内容
15. 正则表达式注入
16. 正则表达式 DOS
17. 不安全的文档
18. 缺少审计日志

#### 判例（PRECEDENTS）

重要的判断标准：
1. 明文记录高价值密钥是漏洞，记录 URL 被认为是安全的
2. UUID 可以假定为不可猜测的
3. 环境变量和 CLI 标志是可信值
4. 资源管理问题（内存泄漏等）无效
5. React/Angular 通常对 XSS 是安全的
6. 大多数 GitHub Action 工作流漏洞实际上不可利用
7. 客户端 JS/TS 代码缺少权限检查不是漏洞
8. 仅在明显且具体的情况下包含 MEDIUM 级发现
9. Jupyter notebook 中的大多数漏洞实际上不可利用
10. 记录非 PII 数据不是漏洞
11. Shell 脚本中的命令注入通常不可利用

### 8. 分析流程

命令执行时会按以下 3 个步骤进行：

1. **识别漏洞**: 使用 Task 工具创建子任务，利用仓库探索工具理解代码库上下文，然后分析 PR 变更的安全影响

2. **过滤假阳性**: 对每个识别的漏洞创建新的子任务进行假阳性过滤，这些子任务并行启动

3. **最终筛选**: 过滤掉置信度小于 8 的所有漏洞

### 9. 最终输出

最终回复必须仅包含 Markdown 格式的安全报告，不包含其他内容。

## 与官方实现的差异

### 官方实现特点
- 类型：`prompt` 类型命令
- 自动执行 git 命令获取变更
- 使用 Task 工具创建子任务进行分析
- 限制工具使用：`Bash(git diff:*)`, `Bash(git status:*)`, `Bash(git log:*)`, `Bash(git show:*)`, `Bash(git remote show:*)`, `Read`, `Glob`, `Grep`, `LS`, `Task`

### 当前实现
- 类型：标准 `SlashCommand`
- 提供完整的 prompt 模板给 Claude
- 由 Claude 自行决定如何执行分析
- 完全复制了官方的 prompt 内容

## 测试建议

1. 在有 git 仓库的项目中测试
2. 确保有 origin/HEAD 分支或主分支
3. 在有代码变更的分支上运行
4. 观察 Claude 是否正确执行 git 命令和安全分析

## 使用示例

```bash
# 在项目分支中
/security-review

# Claude 会自动:
# 1. 运行 git status, git diff, git log 等命令
# 2. 分析所有代码变更
# 3. 根据 OWASP Top 10 和其他安全类别检查
# 4. 生成详细的安全审查报告
```

## 相关文件

- 实现文件：`/home/user/claude-code-open/src/commands/development.ts`
- 官方源码：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js` (行 3311-3500)

## 更新日期

2025-12-24

## 验证状态

✅ TypeScript 编译通过
✅ 代码格式正确
✅ 与官方实现一致
✅ 包含完整的安全审查功能
