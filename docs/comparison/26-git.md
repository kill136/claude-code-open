# Git 集成功能对比分析 (T291-T298)

## 功能对比总览

| 功能点 | 任务编号 | 本项目实现 | 官方实现 | 完成度 |
|--------|----------|------------|----------|--------|
| Git 状态检测 | T291 | ⚠️ 部分实现 | ✅ 完整实现 | 30% |
| Git diff 分析 | T292 | ❌ 未实现 | ✅ 完整实现 | 0% |
| Git log 查询 | T293 | ❌ 未实现 | ✅ 完整实现 | 0% |
| Git 仓库检测 | T294 | ✅ 基础实现 | ✅ 完整实现 | 50% |
| Git 分支信息 | T295 | ✅ 基础实现 | ✅ 完整实现 | 40% |
| Git 忽略规则 | T296 | ⚠️ 部分实现 | ✅ 完整实现 | 20% |
| Git 安全检查 | T297 | ❌ 未实现 | ✅ 完整实现 | 0% |
| Git 操作建议 | T298 | ❌ 未实现 | ✅ 完整实现 | 0% |

**总体完成度：18.75%**

---

## T291: Git 状态检测

### 官方实现

**文件位置：** `cli.js` (Line 563-566, 1917-1926)

**核心功能：**

1. **检查 Git 仓库：** `nzB` 函数
```javascript
// 检查是否在 git 工作树内
nzB=async(A)=>{
  let{code:Q}=await g6("git",["rev-parse","--is-inside-work-tree"],
    {preserveOutputOnError:!1,cwd:A});
  return Q===0
}
```

2. **解析 Git 状态：** `pn1` 函数
```javascript
// 解析 git status --porcelain 输出
pn1=async()=>{
  let{stdout:A}=await WQ("git",["status","--porcelain"],{preserveOutputOnError:!1}),
  Q=[],B=[];
  return A.trim().split('\n').filter((G)=>G.length>0).forEach((G)=>{
    let Z=G.substring(0,2),Y=G.substring(2).trim();
    if(Z==="??")B.push(Y);      // untracked files
    else if(Y)Q.push(Y)          // tracked files
  }),{tracked:Q,untracked:B}
}
```

3. **检查是否 clean：** `T0A` 函数
```javascript
// 检查工作区是否干净
T0A=async()=>{
  let{stdout:A}=await WQ("git",["status","--porcelain"],{preserveOutputOnError:!1});
  return A.trim().length===0
}
```

4. **会话启动时显示状态：** (Line 1917-1926)
```javascript
// 在会话开始时显示 git status
let Z=B.length>jy2?B.substring(0,jy2)+
  '... (truncated because it exceeds 40k characters. If you need more information, run "git status" using BashTool)'
  :B;
return `This is the git status at the start of the conversation.
Current branch: ${A}

Main branch (you will usually use this for PRs): ${Q}

Status:
${Z||"(clean)"}

Recent commits:
${G}`
```

### 本项目实现

**文件位置：** `src/core/session.ts` (Line 13-23)

**实现内容：**

```typescript
// 获取当前 git 分支
function getGitBranch(cwd: string): string | undefined {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}
```

**实现说明：**
- 仅实现了获取分支名的功能
- 在 Session 构造函数中调用，保存到 metadata
- 没有实现完整的 git status 解析
- 没有区分 tracked/untracked 文件
- 没有检查工作区是否 clean

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| 仓库检测 | ✅ 完整 | ❌ 缺失 | 官方有独立函数检测 git 仓库 |
| 状态解析 | ✅ 完整 | ❌ 缺失 | 官方完整解析 porcelain 输出 |
| 文件分类 | ✅ 完整 | ❌ 缺失 | 官方区分 tracked/untracked |
| Clean 检查 | ✅ 完整 | ❌ 缺失 | 官方检查工作区是否干净 |
| 会话集成 | ✅ 完整 | ⚠️ 部分 | 官方在会话启动时显示详细状态 |
| 错误处理 | ✅ 完整 | ⚠️ 简单 | 官方有 preserveOutputOnError 选项 |

### 功能差距

**缺失功能：**
1. ❌ 完整的 git status 解析器
2. ❌ Tracked/untracked 文件分类
3. ❌ 工作区 clean 状态检查
4. ❌ Git 仓库检测函数
5. ❌ 会话启动时的状态展示
6. ❌ 40k 字符截断保护

**需要实现：**
- 完整的 `parseGitStatus()` 函数
- `isGitRepository()` 检测函数
- `isWorkingTreeClean()` 检查函数
- Session 启动时的 git status 展示
- Porcelain 格式的完整解析

---

## T292: Git diff 分析

### 官方实现

**文件位置：** `cli.js` (Line 3906-3921)

**核心功能：**

1. **安全审查中的 diff 命令：**
```javascript
// 在 security review 技能中使用
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*),
               Bash(git show:*), Bash(git remote show:*), Read, Glob, Grep, LS, Task

// 使用示例
GIT STATUS:
```
!`git status`
```

FILES MODIFIED:
```
!`git diff --name-only origin/HEAD...`
```

FULL CHANGES:
```
!`git diff --merge-base origin/HEAD`
```
```

2. **在会话启动时获取最近提交：**
```javascript
// Line 1917-1926
await WQ("git",["log","--oneline","-n","5"],{preserveOutputOnError:!1})
  .then(({stdout:Y})=>Y.trim())
```

### 本项目实现

**状态：** ❌ 未实现

**缺失内容：**
- 没有 git diff 相关的专用函数
- 没有在 Session 启动时执行 git diff
- 没有 diff 结果的解析器
- 只能通过 Bash 工具手动执行

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| Diff 命令支持 | ✅ 完整 | ⚠️ 通过 Bash | 官方在技能中内置支持 |
| Diff 解析 | ✅ 完整 | ❌ 缺失 | 官方可能有解析器 |
| 会话集成 | ✅ 完整 | ❌ 缺失 | 官方在会话启动时可展示 |
| 安全审查 | ✅ 完整 | ❌ 缺失 | 官方有专门的安全审查技能 |

### 功能差距

**缺失功能：**
1. ❌ Git diff 命令封装
2. ❌ Diff 结果解析器
3. ❌ 文件修改列表提取
4. ❌ 与默认分支的对比
5. ❌ Security review 技能
6. ❌ Diff 统计信息（添加/删除行数）

**需要实现：**
- `getGitDiff()` 函数系列
- `parseGitDiff()` 解析器
- `getModifiedFiles()` 提取修改文件
- 与 Session 的集成
- Security review 技能模板

---

## T293: Git log 查询

### 官方实现

**文件位置：** `cli.js` (Line 563, 1917-1926)

**核心功能：**

1. **获取最近提交：**
```javascript
// 在会话启动时获取最近 5 次提交
await WQ("git",["log","--oneline","-n","5"],{preserveOutputOnError:!1})
  .then(({stdout:Y})=>Y.trim())
```

2. **显示在会话状态中：**
```javascript
return `This is the git status at the start of the conversation.
Current branch: ${A}

Main branch (you will usually use this for PRs): ${Q}

Status:
${Z||"(clean)"}

Recent commits:
${G}` // G 是 log 输出
```

3. **支持在 Bash 中使用：**
```javascript
// 在安全审查技能中
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), ...
```

### 本项目实现

**状态：** ❌ 未实现

**缺失内容：**
- 没有 git log 相关函数
- 没有在 Session 启动时获取 log
- 没有 log 的解析和展示
- 只能通过 Bash 工具手动执行

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| Log 查询 | ✅ 完整 | ❌ 缺失 | 官方自动获取最近提交 |
| 会话集成 | ✅ 完整 | ❌ 缺失 | 官方在启动时显示 |
| 格式化 | ✅ 完整 | ❌ 缺失 | 官方使用 --oneline 格式 |
| 数量控制 | ✅ 完整 | ❌ 缺失 | 官方限制 5 条记录 |

### 功能差距

**缺失功能：**
1. ❌ `getRecentCommits()` 函数
2. ❌ Git log 格式化选项
3. ❌ 提交历史解析
4. ❌ Session 启动时的集成
5. ❌ Commit 信息结构化

**需要实现：**
- `getGitLog(options)` 函数
- 提交信息的类型定义
- Log 解析器
- 与 Session 的集成

---

## T294: Git 仓库检测

### 官方实现

**文件位置：** `cli.js` (Line 563)

**核心功能：**

1. **仓库检测函数：** `nzB`
```javascript
// 检查是否在 git 工作树内
nzB=async(A)=>{
  let{code:Q}=await g6("git",["rev-parse","--is-inside-work-tree"],
    {preserveOutputOnError:!1,cwd:A});
  return Q===0
}
```

2. **获取 Git 目录：** `izB`
```javascript
async function izB(){
  let{stdout:A,code:Q}=await WQ("git",["rev-parse","--git-dir"]);
  return Q===0?A.trim():null
}
```

3. **GitHub Actions 集成：** (Line 100-107 in github/index.ts)
```javascript
// 检查是否是 git 仓库
const gitDir = path.join(projectDir, '.git');
if (!fs.existsSync(gitDir)) {
  return {
    success: false,
    message: 'Not a git repository. Run "git init" first.',
  };
}
```

### 本项目实现

**文件位置：**
- `src/utils/index.ts` (Line 153-167)
- `src/github/index.ts` (Line 100-107)

**实现内容：**

```typescript
// 1. 查找项目根目录（包含 .git）
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'package.json')) ||
        fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

// 2. GitHub Actions 中的检查
const gitDir = path.join(projectDir, '.git');
if (!fs.existsSync(gitDir)) {
  return {
    success: false,
    message: 'Not a git repository. Run "git init" first.',
  };
}
```

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| 检测方法 | ✅ git 命令 | ⚠️ 文件系统 | 官方用 git rev-parse，更可靠 |
| 工作树检测 | ✅ 完整 | ❌ 缺失 | 官方有 --is-inside-work-tree |
| Git 目录获取 | ✅ 完整 | ⚠️ 简单 | 官方用 git rev-parse --git-dir |
| CWD 参数 | ✅ 支持 | ❌ 缺失 | 官方可指定目录检测 |
| 错误处理 | ✅ 完整 | ⚠️ 简单 | 官方有 preserveOutputOnError |

### 功能差距

**缺失功能：**
1. ❌ 基于 git 命令的仓库检测
2. ❌ 工作树检测（区分 .git 目录和工作树）
3. ❌ Git 目录路径获取
4. ❌ 指定目录的检测支持
5. ❌ 更健壮的错误处理

**需要实现：**
- `isGitRepository(cwd?)` 函数
- `getGitDirectory(cwd?)` 函数
- `isInsideWorkTree(cwd?)` 函数
- 统一的 Git 检测 API

---

## T295: Git 分支信息

### 官方实现

**文件位置：** `cli.js` (Line 563)

**核心功能：**

1. **获取当前分支：** `dg`
```javascript
dg=async()=>{
  let{stdout:A}=await WQ("git",["rev-parse","--abbrev-ref","HEAD"],
    {preserveOutputOnError:!1});
  return A.trim()
}
```

2. **获取默认分支：** `dn1`
```javascript
dn1=async()=>{
  // 方法1: 从 origin/HEAD 获取
  let{stdout:A,code:Q}=await WQ("git",["symbolic-ref","refs/remotes/origin/HEAD"],
    {preserveOutputOnError:!1});
  if(Q===0){
    let Z=A.trim().match(/refs\/remotes\/origin\/(.+)/);
    if(Z&&Z[1])return Z[1]
  }

  // 方法2: 从远程分支列表查找
  let{stdout:B,code:G}=await WQ("git",["branch","-r"],{preserveOutputOnError:!1});
  if(G===0){
    let Z=B.trim().split('\n').map((Y)=>Y.trim());
    for(let Y of["main","master"])
      if(Z.some((J)=>J.includes(`origin/${Y}`)))
        return Y
  }
  return"main"
}
```

3. **获取远程 URL：** `H11`
```javascript
H11=async()=>{
  let{stdout:A,code:Q}=await WQ("git",["remote","get-url","origin"],
    {preserveOutputOnError:!1});
  return Q===0?A.trim():null
}
```

4. **检查 HEAD 是否在远程：** `ozB`
```javascript
ozB=async()=>{
  let{code:A}=await WQ("git",["rev-parse","@{u}"],{preserveOutputOnError:!1});
  return A===0
}
```

5. **获取提交哈希：** `O63`
```javascript
O63=async()=>{
  let{stdout:A}=await WQ("git",["rev-parse","HEAD"]);
  return A.trim()
}
```

6. **综合 Git 信息：** `cn1`
```javascript
cn1=async()=>{
  try{
    let[A,Q,B,G,Z,Y]=await Promise.all([
      O63(),      // commitHash
      dg(),       // branchName
      H11(),      // remoteUrl
      ozB(),      // isHeadOnRemote
      T0A(),      // isClean
      sLA()       // worktreeCount
    ]);
    return{commitHash:A,branchName:Q,remoteUrl:B,
           isHeadOnRemote:G,isClean:Z,worktreeCount:Y}
  }catch(A){
    return null
  }
}
```

### 本项目实现

**文件位置：** `src/core/session.ts` (Line 13-23, 34)

**实现内容：**

```typescript
// 获取当前 git 分支
function getGitBranch(cwd: string): string | undefined {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

// 在 Session 中使用
constructor(cwd: string = process.cwd()) {
  this.configDir = path.join(process.env.HOME || '~', '.claude');
  this.gitBranch = getGitBranch(cwd);  // 保存到实例变量
  // ...
}
```

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| 当前分支 | ✅ 完整 | ✅ 基础 | 命令相同，功能类似 |
| 默认分支 | ✅ 完整 | ❌ 缺失 | 官方有智能检测 |
| 远程 URL | ✅ 完整 | ❌ 缺失 | 官方可获取 origin URL |
| HEAD 状态 | ✅ 完整 | ❌ 缺失 | 官方检查是否在远程 |
| 提交哈希 | ✅ 完整 | ❌ 缺失 | 官方获取当前 commit |
| Worktree 数量 | ✅ 完整 | ❌ 缺失 | 官方支持多工作树 |
| 综合信息 | ✅ 完整 | ❌ 缺失 | 官方一次性获取所有信息 |

### 功能差距

**缺失功能：**
1. ❌ 默认分支智能检测（main/master）
2. ❌ 远程仓库 URL 获取
3. ❌ HEAD upstream 检查
4. ❌ 提交哈希获取
5. ❌ Worktree 支持
6. ❌ 综合信息接口
7. ❌ 并行获取优化

**需要实现：**
- `getCurrentBranch()` - 当前分支
- `getDefaultBranch()` - 默认分支（智能检测）
- `getRemoteUrl(remote='origin')` - 远程 URL
- `getCurrentCommit()` - 当前提交哈希
- `hasUpstream()` - 检查上游分支
- `getWorktreeCount()` - 工作树数量
- `getGitInfo()` - 综合信息接口

---

## T296: Git 忽略规则 (.gitignore)

### 官方实现

**文件位置：** 推测在文件搜索和操作中

**核心功能：**

1. **文件搜索中跳过 .git：**
```typescript
// src/utils/index.ts (Line 91)
if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
  continue;
}

// src/agents/explore.ts (Line 239, 283)
ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
args.push('--hidden', '--glob', '!.git')

// src/parser/index.ts (Line 506)
if (!['node_modules', '.git', 'dist', 'build', '__pycache__', 'target'].includes(entry.name))
```

2. **安全扫描中排除 .git：**
```typescript
// src/security/sensitive.ts (Line 355, 567)
'**/.git/**',  // glob 模式
/\.git/,       // 正则模式
```

3. **建议添加到 .gitignore：**
```typescript
// src/commands/config.ts (Line 1516)
'2. Suggest adding .claude/ to .gitignore (but keep CLAUDE.md tracked)'
```

### 本项目实现

**文件位置：** 多个文件中硬编码

**实现内容：**

```typescript
// 1. 文件遍历中跳过 (src/utils/index.ts)
if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
  continue;
}

// 2. Agent 搜索中排除 (src/agents/explore.ts)
ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']

// 3. 安全扫描排除 (src/security/sensitive.ts)
'**/.git/**',
/\.git/,
```

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| .gitignore 读取 | ❓ 推测有 | ❌ 缺失 | 官方可能读取 .gitignore |
| 硬编码排除 | ✅ 有 | ✅ 有 | 两者都硬编码排除 .git |
| 动态忽略规则 | ❓ 推测有 | ❌ 缺失 | 官方可能支持动态规则 |
| 建议功能 | ✅ 有 | ✅ 有 | 都建议添加 .claude/ |

### 功能差距

**缺失功能：**
1. ❌ .gitignore 文件解析
2. ❌ Git ignore 规则应用
3. ❌ 动态忽略文件列表
4. ❌ Glob 模式匹配器
5. ❌ 与 git check-ignore 集成

**需要实现：**
- `parseGitignore(path)` 解析器
- `isIgnored(file)` 检查函数
- 与文件搜索工具的集成
- Git ignore 规则匹配引擎

---

## T297: Git 安全检查

### 官方实现

**文件位置：** `cli.js` 推测在 Git 操作中

**核心功能（从系统提示推测）：**

1. **Git 提交安全协议：**
```
Git Safety Protocol:
- NEVER update the git config
- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc)
  unless the user explicitly requests them
- NEVER skip hooks (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests it
- NEVER run force push to main/master, warn the user if they request it
- Avoid git commit --amend. ONLY use --amend when either:
  (1) user explicitly requested amend OR
  (2) adding edits from pre-commit hook
- Before amending: ALWAYS check authorship (git log -1 --format='%an %ae')
- NEVER commit changes unless the user explicitly asks you to
```

2. **Pre-commit Hook 处理：**
```
If the commit fails due to pre-commit hook changes, retry ONCE.
If it succeeds but files were modified by the hook, verify it's safe to amend:
- Check HEAD commit: git log -1 --format='[%h] (%an <%ae>) %s'
- Check not pushed: git status shows "Your branch is ahead"
- If both true: amend your commit
- Otherwise: create NEW commit (never amend other developers' commits)
```

3. **敏感文件检查：**
```
Do not commit files that likely contain secrets (.env, credentials.json, etc).
Warn the user if they specifically request to commit those files
```

4. **Security Review 技能：** (Line 3906-3921)
```javascript
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*),
               Bash(git show:*), Bash(git remote show:*), Read, Glob, Grep, LS, Task
description: Complete a security review of the pending changes on the current branch

You are a senior security engineer conducting a focused security review...
```

### 本项目实现

**状态：** ❌ 未实现

**部分相关实现：**
```typescript
// src/security/sensitive.ts 中有敏感文件检测
// 但没有 Git 操作的安全检查
```

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| Git 安全协议 | ✅ 完整 | ❌ 缺失 | 官方有完整的安全规则 |
| 危险命令拦截 | ✅ 完整 | ❌ 缺失 | 官方阻止 force push 等 |
| Hook 保护 | ✅ 完整 | ❌ 缺失 | 官方禁止跳过 hooks |
| Amend 检查 | ✅ 完整 | ❌ 缺失 | 官方检查作者身份 |
| 敏感文件警告 | ⚠️ 部分 | ⚠️ 部分 | 都有敏感文件检测 |
| Security Review | ✅ 完整 | ❌ 缺失 | 官方有专门技能 |

### 功能差距

**缺失功能：**
1. ❌ Git 安全策略引擎
2. ❌ 危险命令检测与拦截
3. ❌ Force push 保护
4. ❌ Hook 跳过检测
5. ❌ Commit amend 验证
6. ❌ 作者身份检查
7. ❌ Security review 技能
8. ❌ 提交前的安全扫描

**需要实现：**
- `GitSafetyChecker` 类
- `isDangerousGitCommand(cmd)` 检测函数
- `validateGitAmend()` 验证函数
- `checkCommitAuthor()` 作者检查
- Security review 技能模板
- Git 操作的 Hook 系统

---

## T298: Git 操作建议

### 官方实现

**文件位置：** `cli.js` 系统提示中

**核心功能：**

1. **提交流程建议：**
```
When the user asks you to create a new git commit, follow these steps:

1. Run parallel bash commands:
   - git status to see all untracked files
   - git diff to see both staged and unstaged changes
   - git log to see recent commit messages (follow the repository's style)

2. Analyze all staged changes and draft a commit message:
   - Summarize the nature of changes (new feature, enhancement, bug fix, etc.)
   - Ensure message accurately reflects changes and purpose
   - Focus on "why" rather than "what"
   - Concise (1-2 sentences)

3. Run commands:
   - Add relevant untracked files
   - Create commit with message
   - Run git status after commit to verify success
```

2. **PR 创建建议：**
```
When the user asks you to create a pull request:

1. Run parallel bash commands:
   - git status to see all untracked files
   - git diff to see both staged and unstaged changes
   - Check if current branch tracks remote and is up to date
   - git log and git diff [base-branch]...HEAD for full commit history

2. Analyze all changes and draft PR summary:
   - Look at ALL commits (not just latest)
   - Summarize changes

3. Run commands in parallel:
   - Create new branch if needed
   - Push to remote with -u flag if needed
   - Create PR using gh pr create
```

3. **提交消息格式：**
```
Draft a concise (1-2 sentences) commit message that focuses on
the "why" rather than the "what"

Ensure it accurately reflects the changes and their purpose
(i.e. "add" means a wholly new feature, "update" means an enhancement,
"fix" means a bug fix, etc.)
```

4. **推送状态检查：**
```javascript
// Line 563
rzB=async()=>{
  let A=await ozB(),Q=await R63();  // hasUpstream, commitsAheadOfDefaultBranch
  if(!A)return{hasUpstream:!1,needsPush:!0,commitsAhead:0,commitsAheadOfDefaultBranch:Q};

  let{stdout:B,code:G}=await WQ("git",["rev-list","--count","@{u}..HEAD"],
    {preserveOutputOnError:!1});
  if(G!==0)return{hasUpstream:!0,needsPush:!1,commitsAhead:0,commitsAheadOfDefaultBranch:Q};

  let Z=parseInt(B.trim(),10)||0;
  return{hasUpstream:!0,needsPush:Z>0,commitsAhead:Z,commitsAheadOfDefaultBranch:Q}
}
```

5. **提交和推送函数：**
```javascript
// Line 563
tzB=async(A,Q)=>{
  if(!await T0A()){  // 如果不 clean
    Q?.("committing");
    let{code:I,stderr:W}=await WQ("git",["add","-A"],{preserveOutputOnError:!0});
    if(I!==0)return{success:!1,error:`Failed to stage changes: ${W}`};

    let{code:K,stderr:V}=await WQ("git",["commit","-m",A],{preserveOutputOnError:!0});
    if(K!==0)return{success:!1,error:`Failed to commit: ${V}`}
  }

  Q?.("pushing");
  let G=await rzB(),Z=await dg(),
      Y=G.hasUpstream?["push"]:["push","-u","origin",Z],
      {code:J,stderr:X}=await WQ("git",Y,{preserveOutputOnError:!0});

  if(J!==0)return{success:!1,error:`Failed to push: ${X}`};
  return{success:!0}
}
```

### 本项目实现

**状态：** ❌ 未实现

**部分相关：**
- `src/github/index.ts` 有 GitHub PR 相关功能
- 但没有完整的 Git 操作建议系统

### 差异对比

| 对比项 | 官方实现 | 本项目实现 | 差异说明 |
|--------|----------|------------|----------|
| 提交流程 | ✅ 完整 | ❌ 缺失 | 官方有详细的步骤指导 |
| PR 创建流程 | ✅ 完整 | ⚠️ 部分 | 官方更完整，本项目仅 gh 命令 |
| 消息规范 | ✅ 完整 | ❌ 缺失 | 官方有消息格式规范 |
| 推送状态检查 | ✅ 完整 | ❌ 缺失 | 官方检查 upstream 和提交数 |
| 自动提交推送 | ✅ 完整 | ❌ 缺失 | 官方有封装函数 |
| 进度回调 | ✅ 完整 | ❌ 缺失 | 官方支持进度通知 |

### 功能差距

**缺失功能：**
1. ❌ 提交流程指导系统
2. ❌ PR 创建完整流程
3. ❌ 提交消息智能生成
4. ❌ 推送状态检查函数
5. ❌ 自动提交推送函数
6. ❌ 进度回调支持
7. ❌ Upstream 分支检测
8. ❌ 与默认分支的提交对比

**需要实现：**
- `checkPushStatus()` 推送状态检查
- `commitAndPush(message, progress?)` 提交推送
- `generateCommitMessage(changes)` 消息生成
- `createPullRequest(options)` PR 创建流程
- Git 操作的系统提示优化

---

## 实现建议

### 优先级排序

**P0 - 核心功能（必须实现）：**
1. Git 仓库检测 (T294)
2. 分支信息获取 (T295)
3. Git 状态检测 (T291)

**P1 - 重要功能（应该实现）：**
4. Git diff 分析 (T292)
5. Git log 查询 (T293)
6. Git 忽略规则 (T296)

**P2 - 增强功能（可以实现）：**
7. Git 安全检查 (T297)
8. Git 操作建议 (T298)

### 实现路线图

**阶段一：基础 Git 工具类**
```typescript
// src/git/core.ts
export class GitUtils {
  // T294: 仓库检测
  static async isGitRepository(cwd?: string): Promise<boolean>
  static async getGitDirectory(cwd?: string): Promise<string | null>

  // T295: 分支信息
  static async getCurrentBranch(cwd?: string): Promise<string>
  static async getDefaultBranch(cwd?: string): Promise<string>
  static async getRemoteUrl(remote?: string, cwd?: string): Promise<string | null>
  static async getCurrentCommit(cwd?: string): Promise<string>

  // T291: 状态检测
  static async getGitStatus(cwd?: string): Promise<GitStatus>
  static async isWorkingTreeClean(cwd?: string): Promise<boolean>
  static async getUntrackedFiles(cwd?: string): Promise<string[]>
  static async getModifiedFiles(cwd?: string): Promise<string[]>
}

interface GitStatus {
  tracked: string[]
  untracked: string[]
  isClean: boolean
}
```

**阶段二：高级 Git 功能**
```typescript
// src/git/analysis.ts
export class GitAnalysis {
  // T292: Diff 分析
  static async getDiff(options?: GitDiffOptions): Promise<string>
  static async getModifiedFiles(base?: string): Promise<string[]>
  static async parseDiff(diff: string): Promise<DiffResult>

  // T293: Log 查询
  static async getRecentCommits(count?: number): Promise<Commit[]>
  static async getCommitHistory(base?: string): Promise<Commit[]>
}

interface GitDiffOptions {
  base?: string
  staged?: boolean
  nameOnly?: boolean
}

interface Commit {
  hash: string
  author: string
  date: string
  message: string
}
```

**阶段三：安全和规范**
```typescript
// src/git/safety.ts
export class GitSafety {
  // T297: 安全检查
  static validateGitCommand(command: string): SafetyCheckResult
  static isDangerousCommand(command: string): boolean
  static checkCommitAuthor(): Promise<Author>
  static validateAmend(): Promise<boolean>

  // 敏感文件检查
  static checkSensitiveFiles(files: string[]): string[]
}

// src/git/operations.ts
export class GitOperations {
  // T298: 操作建议
  static async checkPushStatus(): Promise<PushStatus>
  static async commitAndPush(message: string, progress?: ProgressCallback): Promise<Result>
  static generateCommitMessage(changes: GitStatus): string
}
```

**阶段四：Session 集成**
```typescript
// 修改 src/core/session.ts
export class Session {
  private gitInfo?: GitInfo

  constructor(cwd: string = process.cwd()) {
    // 初始化时获取完整 Git 信息
    this.gitInfo = await GitUtils.getGitInfo(cwd)
  }

  // 在 save() 中包含 Git 信息
  save(): string {
    const data = {
      state: this.state,
      messages: this.messages,
      metadata: {
        gitInfo: this.gitInfo,
        gitBranch: this.gitInfo?.branchName,
        // ...
      },
    }
  }
}

interface GitInfo {
  commitHash: string
  branchName: string
  remoteUrl: string | null
  isHeadOnRemote: boolean
  isClean: boolean
  worktreeCount: number
  recentCommits: string[]
  defaultBranch: string
}
```

### 代码示例

**基础实现示例：**

```typescript
// src/git/core.ts
import { execSync } from 'child_process'
import * as path from 'path'

export class GitUtils {
  /**
   * 检查是否在 Git 仓库中
   */
  static async isGitRepository(cwd: string = process.cwd()): Promise<boolean> {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取当前分支名
   */
  static async getCurrentBranch(cwd: string = process.cwd()): Promise<string> {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      return branch
    } catch (error) {
      throw new Error('Failed to get current branch')
    }
  }

  /**
   * 获取默认分支（智能检测 main/master）
   */
  static async getDefaultBranch(cwd: string = process.cwd()): Promise<string> {
    try {
      // 方法1: 从 origin/HEAD 获取
      const head = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()

      const match = head.match(/refs\/remotes\/origin\/(.+)/)
      if (match && match[1]) {
        return match[1]
      }
    } catch {
      // Fallback to method 2
    }

    try {
      // 方法2: 从远程分支列表查找
      const branches = execSync('git branch -r', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim().split('\n').map(b => b.trim())

      for (const name of ['main', 'master']) {
        if (branches.some(b => b.includes(`origin/${name}`))) {
          return name
        }
      }
    } catch {
      // Fallback to default
    }

    return 'main'
  }

  /**
   * 获取 Git 状态
   */
  static async getGitStatus(cwd: string = process.cwd()): Promise<GitStatus> {
    try {
      const output = execSync('git status --porcelain', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()

      const tracked: string[] = []
      const untracked: string[] = []

      if (output) {
        const lines = output.split('\n')
        for (const line of lines) {
          if (!line) continue

          const status = line.substring(0, 2)
          const file = line.substring(3).trim()

          if (status === '??') {
            untracked.push(file)
          } else if (file) {
            tracked.push(file)
          }
        }
      }

      return {
        tracked,
        untracked,
        isClean: tracked.length === 0 && untracked.length === 0,
      }
    } catch (error) {
      throw new Error('Failed to get git status')
    }
  }

  /**
   * 获取完整的 Git 信息
   */
  static async getGitInfo(cwd: string = process.cwd()): Promise<GitInfo | null> {
    try {
      if (!await this.isGitRepository(cwd)) {
        return null
      }

      const [commitHash, branchName, remoteUrl, status] = await Promise.all([
        this.getCurrentCommit(cwd),
        this.getCurrentBranch(cwd),
        this.getRemoteUrl('origin', cwd),
        this.getGitStatus(cwd),
      ])

      return {
        commitHash,
        branchName,
        remoteUrl,
        isClean: status.isClean,
        trackedFiles: status.tracked,
        untrackedFiles: status.untracked,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * 获取当前提交哈希
   */
  static async getCurrentCommit(cwd: string = process.cwd()): Promise<string> {
    try {
      return execSync('git rev-parse HEAD', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    } catch (error) {
      throw new Error('Failed to get current commit')
    }
  }

  /**
   * 获取远程 URL
   */
  static async getRemoteUrl(
    remote: string = 'origin',
    cwd: string = process.cwd()
  ): Promise<string | null> {
    try {
      return execSync(`git remote get-url ${remote}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    } catch {
      return null
    }
  }

  /**
   * 检查工作区是否干净
   */
  static async isWorkingTreeClean(cwd: string = process.cwd()): Promise<boolean> {
    const status = await this.getGitStatus(cwd)
    return status.isClean
  }
}

export interface GitStatus {
  tracked: string[]
  untracked: string[]
  isClean: boolean
}

export interface GitInfo {
  commitHash: string
  branchName: string
  remoteUrl: string | null
  isClean: boolean
  trackedFiles: string[]
  untrackedFiles: string[]
}
```

---

## 总结

### 完成情况

| 类别 | 已实现 | 部分实现 | 未实现 | 完成度 |
|------|--------|----------|--------|--------|
| 基础检测 | 1/4 | 2/4 | 1/4 | 37.5% |
| 信息获取 | 1/4 | 1/4 | 2/4 | 25% |
| 安全规范 | 0/2 | 0/2 | 2/2 | 0% |
| **总计** | **2/10** | **3/10** | **5/10** | **18.75%** |

### 技术债务

1. **缺少统一的 Git 工具类**
   - 当前功能分散在多个文件中
   - 没有统一的错误处理
   - 缺少类型定义

2. **Session 集成不完整**
   - 仅保存分支名，没有完整的 Git 信息
   - 没有在启动时展示 Git 状态
   - 缺少与 Git 状态的联动

3. **缺少安全机制**
   - 没有危险命令检测
   - 没有敏感文件提交警告
   - 缺少 Git 操作的审计

4. **功能覆盖不足**
   - 缺少 diff 和 log 支持
   - 没有 worktree 支持
   - 缺少推送状态检查

### 改进建议

**立即行动（P0）：**
1. 创建 `src/git/` 目录和核心工具类
2. 实现基础的仓库检测和状态获取
3. 完善 Session 中的 Git 信息集成

**短期目标（P1）：**
4. 实现 diff 和 log 功能
5. 添加 .gitignore 规则支持
6. 完善错误处理和类型定义

**长期规划（P2）：**
7. 实现完整的安全检查系统
8. 添加 Git 操作建议功能
9. 创建 Security Review 技能
