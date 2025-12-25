# Git 安全集成模块

完整的 Git 操作和安全检查工具集,实现 T291-T298 所有功能。

## 快速开始

```typescript
import { Git, GitUtils, GitSafety } from './git/index.js';

// 快速检查
const isRepo = await Git.isRepository();
const gitInfo = await Git.getInfo();

// 安全检查
const check = Git.checkSafety('git push --force');
if (!check.safe) {
  console.error(check.reason);
}
```

## 模块结构

```
src/git/
├── core.ts         # Git 核心功能 (T291, T294, T295)
├── analysis.ts     # Diff 和 Log 分析 (T292, T293)
├── safety.ts       # 安全检查 (T297)
├── operations.ts   # 操作建议 (T298)
├── ignore.ts       # .gitignore 规则 (T296)
└── index.ts        # 统一导出
```

## 核心功能

### 仓库检测 (T294)

```typescript
import { GitUtils } from './git/index.js';

// 检查是否在 Git 仓库中
const isRepo = await GitUtils.isGitRepository('/path/to/project');

// 获取 Git 目录
const gitDir = await GitUtils.getGitDirectory();
```

### 状态检测 (T291)

```typescript
// 获取完整状态
const status = await GitUtils.getGitStatus();
console.log(status.tracked);    // 已修改的文件
console.log(status.untracked);  // 未追踪的文件
console.log(status.isClean);    // 是否干净

// 检查工作区
const isClean = await GitUtils.isWorkingTreeClean();
```

### 分支信息 (T295)

```typescript
// 获取当前分支
const branch = await GitUtils.getCurrentBranch();

// 获取默认分支 (智能检测 main/master)
const defaultBranch = await GitUtils.getDefaultBranch();

// 获取远程 URL
const url = await GitUtils.getRemoteUrl('origin');

// 获取完整信息
const gitInfo = await GitUtils.getGitInfo();
```

### Diff 分析 (T292)

```typescript
import { GitAnalysis } from './git/index.js';

// 获取 diff
const diff = await GitAnalysis.getDiff({
  base: 'origin/main',
  staged: true,
  nameOnly: false,
});

// 获取修改的文件
const files = await GitAnalysis.getModifiedFiles('origin/main');

// 获取统计信息
const stats = await GitAnalysis.getDiffStats('origin/main');
console.log(`${stats.filesChanged} files, +${stats.insertions} -${stats.deletions}`);
```

### Log 查询 (T293)

```typescript
// 获取最近提交
const commits = await GitAnalysis.getRecentCommits(5);
commits.forEach(commit => {
  console.log(`${commit.shortHash} ${commit.message} (${commit.author})`);
});

// 获取提交历史
const history = await GitAnalysis.getCommitHistory('origin/main');

// 获取文件历史
const fileHistory = await GitAnalysis.getFileHistory('src/index.ts', 10);
```

### 安全检查 (T297)

```typescript
import { GitSafety } from './git/index.js';

// 验证 Git 命令
const result = GitSafety.validateGitCommand('git push --force');
if (!result.safe) {
  console.error(result.reason);
  console.log(result.suggestion);
}

// 检查敏感文件
const check = GitSafety.checkSensitiveFiles([
  '.env',
  'credentials.json',
  'src/config.ts',
]);
if (check.hasSensitiveFiles) {
  console.warn(check.warnings);
}

// 综合检查
const comprehensive = await GitSafety.comprehensiveCheck(
  'git add .',
  'main',
  ['.env', 'src/index.ts']
);
```

### 操作建议 (T298)

```typescript
import { GitOperations } from './git/index.js';

// 检查推送状态
const pushStatus = await GitOperations.checkPushStatus();
if (pushStatus.needsPush) {
  console.log(`${pushStatus.commitsAhead} commits to push`);
}

// 生成提交消息
const message = GitOperations.generateCommitMessage({
  status: await GitUtils.getGitStatus(),
  type: 'feat',
});

// 提交并推送
const result = await GitOperations.commitAndPush(
  message,
  (stage) => console.log(`Current stage: ${stage}`)
);

if (result.success) {
  console.log(`Committed: ${result.commitHash}`);
}
```

### .gitignore 规则 (T296)

```typescript
import { GitIgnore } from './git/index.js';

// 解析 .gitignore
const rules = GitIgnore.parseGitignore('.gitignore');

// 检查文件是否被忽略
const ignored = GitIgnore.isIgnored('node_modules/package.json');

// 获取所有规则
const allRules = GitIgnore.getAllIgnoreRules();

// 检查目录是否应该跳过
const shouldSkip = GitIgnore.shouldSkipDirectory('node_modules');
```

## 安全保护

### 危险命令 (自动阻止)

- `git push --force` / `git push -f`
- `git reset --hard`
- `git clean -fd` / `git clean -fdx` / `git clean -f`
- `git filter-branch`
- `git rebase --force`
- `git config` (修改配置)
- 带 `--no-verify` 的命令
- 带 `--no-gpg-sign` 的命令

### 敏感文件检测

- `.env` 文件
- `credentials.json`
- 私钥文件 (`.pem`, `.key`, `id_rsa`)
- 证书文件
- 包含 `password`, `secret`, `token`, `api_key` 的文件

### 分支保护

- 阻止强制推送到 `main`/`master`
- 检查 `commit --amend` 的安全性
- 验证提交作者身份

## Session 集成

```typescript
import { Session } from '../core/session.js';

// 创建 session
const session = new Session(process.cwd());

// 初始化 Git 信息
await session.initializeGitInfo();

// 获取 Git 信息
const gitInfo = session.getGitInfo();
if (gitInfo) {
  console.log(`Branch: ${gitInfo.branchName}`);
  console.log(`Status: ${gitInfo.isClean ? 'clean' : 'dirty'}`);
  console.log(`Commits: ${gitInfo.recentCommits.length}`);
}

// 获取格式化状态
const status = session.getFormattedGitStatus();
console.log(status);
```

## 默认忽略模式

```typescript
import { DEFAULT_IGNORE_PATTERNS } from './git/index.js';

// 使用默认模式
console.log(DEFAULT_IGNORE_PATTERNS);
// [
//   '**/.git/**',
//   '**/node_modules/**',
//   '**/dist/**',
//   '**/build/**',
//   '**/.env',
//   ...
// ]
```

## 类型定义

```typescript
interface GitInfo {
  commitHash: string;
  branchName: string;
  remoteUrl: string | null;
  isClean: boolean;
  trackedFiles: string[];
  untrackedFiles: string[];
  defaultBranch: string;
  recentCommits: string[];
}

interface GitStatus {
  tracked: string[];
  untracked: string[];
  isClean: boolean;
}

interface Commit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  warning?: string;
  suggestion?: string;
}
```

## 完整示例

```typescript
import { Git, GitUtils, GitAnalysis, GitSafety, GitOperations } from './git/index.js';

async function main() {
  // 1. 检查是否在 Git 仓库中
  if (!await Git.isRepository()) {
    console.log('Not a Git repository');
    return;
  }

  // 2. 获取完整信息
  const gitInfo = await Git.getInfo();
  if (!gitInfo) return;

  console.log(`Branch: ${gitInfo.branchName}`);
  console.log(`Default: ${gitInfo.defaultBranch}`);
  console.log(`Status: ${gitInfo.isClean ? 'clean' : 'dirty'}`);

  // 3. 分析变更
  if (!gitInfo.isClean) {
    const stats = await GitAnalysis.getDiffStats();
    console.log(`${stats.filesChanged} files changed`);
    console.log(`+${stats.insertions} -${stats.deletions}`);
  }

  // 4. 安全检查
  const command = 'git push';
  const check = Git.checkSafety(command);

  if (!check.safe) {
    console.error(`❌ ${check.reason}`);
    return;
  }

  if (check.warning) {
    console.warn(`⚠️  ${check.warning}`);
  }

  // 5. 执行操作
  const pushStatus = await Git.checkPushStatus();
  if (pushStatus.needsPush) {
    console.log(`Ready to push ${pushStatus.commitsAhead} commits`);
  }
}

main().catch(console.error);
```

## 参考文档

- [官方对比分析](/home/user/claude-code-open/docs/comparison/26-git.md)
- [实现报告](/home/user/claude-code-open/docs/implementation/git-integration-report.md)
