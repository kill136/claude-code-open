/**
 * Git 操作工具类
 * 实现 T298 (Git 操作建议)
 */

import { execSync } from 'child_process';
import { GitUtils, GitStatus, PushStatus } from './core.js';
import { GitAnalysis } from './analysis.js';
import { GitSafety } from './safety.js';

/**
 * 提交和推送结果接口
 */
export interface CommitAndPushResult {
  /** 操作是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 提交哈希 */
  commitHash?: string;
  /** 是否已推送 */
  pushed?: boolean;
}

/**
 * 提交消息生成选项
 */
export interface CommitMessageOptions {
  /** Git 状态 */
  status: GitStatus;
  /** 包含的文件列表 */
  files?: string[];
  /** 更倾向的类型 (feat, fix, refactor, etc.) */
  type?: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore' | 'style' | 'perf';
}

/**
 * 进度回调类型
 */
export type ProgressCallback = (stage: 'staging' | 'committing' | 'pushing') => void;

/**
 * Git 操作工具类
 * 提供 Git 操作建议和自动化功能
 */
export class GitOperations {
  /**
   * 执行 Git 命令
   * @param args Git 命令参数
   * @param cwd 工作目录
   * @returns 命令结果
   */
  private static execGitSafe(
    args: string[],
    cwd: string = process.cwd()
  ): { code: number; stdout: string; stderr: string } {
    try {
      const stdout = execSync(`git ${args.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { code: 0, stdout, stderr: '' };
    } catch (error: any) {
      return {
        code: error.status || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      };
    }
  }

  /**
   * T298: 检查推送状态
   * @param cwd 工作目录
   * @returns 推送状态
   */
  static async checkPushStatus(cwd: string = process.cwd()): Promise<PushStatus> {
    return GitUtils.getPushStatus(cwd);
  }

  /**
   * T298: 生成提交消息
   * @param options 提交消息选项
   * @returns 生成的提交消息
   */
  static generateCommitMessage(options: CommitMessageOptions): string {
    const { status, files, type } = options;

    // 简单的提交消息生成逻辑
    // 实际应该根据变更内容智能生成

    const fileCount = (files || status.tracked).length;
    const hasUntracked = status.untracked.length > 0;

    let prefix = type || 'chore';
    let subject = 'update project files';

    // 根据文件数量和类型调整消息
    if (fileCount === 1) {
      const file = (files || status.tracked)[0];
      if (file.endsWith('.md')) {
        prefix = 'docs';
        subject = `update ${file}`;
      } else if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
        prefix = 'test';
        subject = `update tests`;
      } else {
        subject = `update ${file}`;
      }
    } else if (fileCount > 5) {
      subject = `update multiple files (${fileCount} files)`;
    }

    // 生成符合 Conventional Commits 格式的消息
    let message = `${prefix}: ${subject}`;

    // 添加详细信息
    if (hasUntracked) {
      message += `\n\nIncludes ${status.untracked.length} untracked file(s)`;
    }

    return message;
  }

  /**
   * T298: 提交并推送
   * @param message 提交消息
   * @param progress 进度回调
   * @param cwd 工作目录
   * @returns 操作结果
   */
  static async commitAndPush(
    message: string,
    progress?: ProgressCallback,
    cwd: string = process.cwd()
  ): Promise<CommitAndPushResult> {
    try {
      // 1. 检查工作区是否干净
      const isClean = await GitUtils.isWorkingTreeClean(cwd);

      if (!isClean) {
        // 2. 暂存所有变更
        progress?.('staging');
        const addResult = this.execGitSafe(['add', '-A'], cwd);
        if (addResult.code !== 0) {
          return {
            success: false,
            error: `Failed to stage changes: ${addResult.stderr}`,
          };
        }

        // 3. 提交变更
        progress?.('committing');
        const commitResult = this.execGitSafe(['commit', '-m', message], cwd);
        if (commitResult.code !== 0) {
          return {
            success: false,
            error: `Failed to commit: ${commitResult.stderr}`,
          };
        }
      }

      // 4. 推送到远程
      progress?.('pushing');
      const pushStatus = await this.checkPushStatus(cwd);
      const currentBranch = await GitUtils.getCurrentBranch(cwd);

      const pushArgs = pushStatus.hasUpstream ? ['push'] : ['push', '-u', 'origin', currentBranch];

      const pushResult = this.execGitSafe(pushArgs, cwd);
      if (pushResult.code !== 0) {
        return {
          success: false,
          error: `Failed to push: ${pushResult.stderr}`,
          pushed: false,
        };
      }

      // 5. 获取提交哈希
      const commitHash = await GitUtils.getCurrentCommit(cwd);

      return {
        success: true,
        commitHash,
        pushed: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取提交工作流程建议
   * @param cwd 工作目录
   * @returns 工作流程建议文本
   */
  static async getCommitWorkflow(cwd: string = process.cwd()): Promise<string> {
    const workflow = `
When creating a new git commit, follow these steps:

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

Safety Guidelines:
- NEVER update the git config
- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc)
- NEVER skip hooks (--no-verify, --no-gpg-sign, etc)
- NEVER force push to main/master
- Avoid git commit --amend unless explicitly requested
- NEVER commit changes unless the user explicitly asks you to
`;

    return workflow;
  }

  /**
   * 获取 PR 创建工作流程建议
   * @param cwd 工作目录
   * @returns PR 工作流程建议文本
   */
  static async getPRWorkflow(cwd: string = process.cwd()): Promise<string> {
    const workflow = `
When creating a pull request:

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

Important:
- DO NOT use the TodoWrite or Task tools
- Return the PR URL when done
`;

    return workflow;
  }

  /**
   * 验证提交消息格式
   * @param message 提交消息
   * @returns 验证结果
   */
  static validateCommitMessage(message: string): { valid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { valid: false, error: 'Commit message cannot be empty' };
    }

    if (message.length < 10) {
      return { valid: false, error: 'Commit message is too short (minimum 10 characters)' };
    }

    if (message.length > 500) {
      return { valid: false, error: 'Commit message is too long (maximum 500 characters)' };
    }

    // 检查是否包含 fixup 或 squash
    if (message.startsWith('fixup!') || message.startsWith('squash!')) {
      return { valid: false, error: 'Fixup and squash commits should be used with caution' };
    }

    return { valid: true };
  }

  /**
   * 分析提交历史并生成 PR 描述
   * @param baseBranch 基准分支
   * @param cwd 工作目录
   * @returns PR 描述
   */
  static async generatePRDescription(baseBranch: string, cwd: string = process.cwd()): Promise<string> {
    try {
      // 获取提交历史
      const commits = await GitAnalysis.getCommitHistory(`origin/${baseBranch}`, cwd);

      // 获取变更统计
      const stats = await GitAnalysis.getDiffStats(`origin/${baseBranch}`, cwd);

      // 生成描述
      let description = '## Summary\n\n';

      if (commits.length === 1) {
        description += `- ${commits[0].message}\n\n`;
      } else if (commits.length > 0) {
        description += commits.map((c) => `- ${c.message}`).join('\n') + '\n\n';
      }

      description += '## Changes\n\n';
      description += `- ${stats.filesChanged} file(s) changed\n`;
      description += `- ${stats.insertions} insertion(s)\n`;
      description += `- ${stats.deletions} deletion(s)\n\n`;

      description += '## Test plan\n\n';
      description += '- [ ] Tested locally\n';
      description += '- [ ] Added/updated tests\n';
      description += '- [ ] Documentation updated\n';

      return description;
    } catch (error) {
      return '## Summary\n\nPlease describe your changes here.\n\n## Test plan\n\nPlease describe how you tested your changes.';
    }
  }
}
