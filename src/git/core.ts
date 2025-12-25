/**
 * Git 核心工具类
 * 实现 T291 (Git 状态检测), T294 (Git 仓库检测), T295 (Git 分支信息)
 */

import { execSync } from 'child_process';

/**
 * Git 状态接口
 */
export interface GitStatus {
  /** 已追踪的修改文件 */
  tracked: string[];
  /** 未追踪的文件 */
  untracked: string[];
  /** 工作区是否干净 */
  isClean: boolean;
}

/**
 * Git 完整信息接口
 */
export interface GitInfo {
  /** 当前提交哈希 */
  commitHash: string;
  /** 当前分支名 */
  branchName: string;
  /** 远程 URL */
  remoteUrl: string | null;
  /** 工作区是否干净 */
  isClean: boolean;
  /** 已追踪的修改文件 */
  trackedFiles: string[];
  /** 未追踪的文件 */
  untrackedFiles: string[];
  /** 默认分支 (main/master) */
  defaultBranch: string;
  /** 最近的提交记录 */
  recentCommits: string[];
}

/**
 * Git 推送状态接口
 */
export interface PushStatus {
  /** 是否有上游分支 */
  hasUpstream: boolean;
  /** 是否需要推送 */
  needsPush: boolean;
  /** 领先上游的提交数 */
  commitsAhead: number;
  /** 相对默认分支的提交数 */
  commitsAheadOfDefaultBranch: number;
}

/**
 * Git 核心工具类
 * 提供基础的 Git 操作功能
 */
export class GitUtils {
  /**
   * 执行 Git 命令并返回结果
   * @param args Git 命令参数
   * @param cwd 工作目录
   * @returns 命令输出
   */
  private static execGit(args: string[], cwd: string = process.cwd()): string {
    try {
      return execSync(`git ${args.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (error) {
      throw new Error(`Git command failed: git ${args.join(' ')}`);
    }
  }

  /**
   * 执行 Git 命令并返回退出码
   * @param args Git 命令参数
   * @param cwd 工作目录
   * @returns 退出码
   */
  private static execGitWithCode(args: string[], cwd: string = process.cwd()): number {
    try {
      execSync(`git ${args.join(' ')}`, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return 0;
    } catch {
      return 1;
    }
  }

  /**
   * T294: 检查是否在 Git 仓库中
   * @param cwd 工作目录
   * @returns 是否在 Git 仓库中
   */
  static async isGitRepository(cwd: string = process.cwd()): Promise<boolean> {
    return this.execGitWithCode(['rev-parse', '--is-inside-work-tree'], cwd) === 0;
  }

  /**
   * T294: 获取 Git 目录路径
   * @param cwd 工作目录
   * @returns Git 目录路径,如果不在仓库中则返回 null
   */
  static async getGitDirectory(cwd: string = process.cwd()): Promise<string | null> {
    try {
      return this.execGit(['rev-parse', '--git-dir'], cwd);
    } catch {
      return null;
    }
  }

  /**
   * T295: 获取当前分支名
   * @param cwd 工作目录
   * @returns 当前分支名
   */
  static async getCurrentBranch(cwd: string = process.cwd()): Promise<string> {
    return this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  }

  /**
   * T295: 获取默认分支名 (智能检测 main/master)
   * @param cwd 工作目录
   * @returns 默认分支名
   */
  static async getDefaultBranch(cwd: string = process.cwd()): Promise<string> {
    try {
      // 方法1: 从 origin/HEAD 获取
      const head = this.execGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd);
      const match = head.match(/refs\/remotes\/origin\/(.+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch {
      // Fallback to method 2
    }

    try {
      // 方法2: 从远程分支列表查找
      const branches = this.execGit(['branch', '-r'], cwd)
        .split('\n')
        .map((b) => b.trim());

      for (const name of ['main', 'master']) {
        if (branches.some((b) => b.includes(`origin/${name}`))) {
          return name;
        }
      }
    } catch {
      // Fallback to default
    }

    return 'main';
  }

  /**
   * T295: 获取远程 URL
   * @param remote 远程名称 (默认 origin)
   * @param cwd 工作目录
   * @returns 远程 URL,如果不存在则返回 null
   */
  static async getRemoteUrl(remote: string = 'origin', cwd: string = process.cwd()): Promise<string | null> {
    try {
      return this.execGit(['remote', 'get-url', remote], cwd);
    } catch {
      return null;
    }
  }

  /**
   * T295: 获取当前提交哈希
   * @param cwd 工作目录
   * @returns 提交哈希
   */
  static async getCurrentCommit(cwd: string = process.cwd()): Promise<string> {
    return this.execGit(['rev-parse', 'HEAD'], cwd);
  }

  /**
   * T295: 检查 HEAD 是否在远程分支上
   * @param cwd 工作目录
   * @returns 是否在远程分支上
   */
  static async hasUpstream(cwd: string = process.cwd()): Promise<boolean> {
    return this.execGitWithCode(['rev-parse', '@{u}'], cwd) === 0;
  }

  /**
   * T291: 获取 Git 状态 (解析 porcelain 格式)
   * @param cwd 工作目录
   * @returns Git 状态
   */
  static async getGitStatus(cwd: string = process.cwd()): Promise<GitStatus> {
    try {
      const output = this.execGit(['status', '--porcelain'], cwd);

      const tracked: string[] = [];
      const untracked: string[] = [];

      if (output) {
        const lines = output.split('\n');
        for (const line of lines) {
          if (!line) continue;

          const status = line.substring(0, 2);
          const file = line.substring(3).trim();

          if (status === '??') {
            untracked.push(file);
          } else if (file) {
            tracked.push(file);
          }
        }
      }

      return {
        tracked,
        untracked,
        isClean: tracked.length === 0 && untracked.length === 0,
      };
    } catch (error) {
      throw new Error('Failed to get git status');
    }
  }

  /**
   * T291: 检查工作区是否干净
   * @param cwd 工作目录
   * @returns 工作区是否干净
   */
  static async isWorkingTreeClean(cwd: string = process.cwd()): Promise<boolean> {
    const status = await this.getGitStatus(cwd);
    return status.isClean;
  }

  /**
   * T291: 获取未追踪的文件列表
   * @param cwd 工作目录
   * @returns 未追踪文件列表
   */
  static async getUntrackedFiles(cwd: string = process.cwd()): Promise<string[]> {
    const status = await this.getGitStatus(cwd);
    return status.untracked;
  }

  /**
   * T291: 获取已修改的文件列表
   * @param cwd 工作目录
   * @returns 已修改文件列表
   */
  static async getModifiedFiles(cwd: string = process.cwd()): Promise<string[]> {
    const status = await this.getGitStatus(cwd);
    return status.tracked;
  }

  /**
   * 获取最近的提交记录
   * @param count 提交数量
   * @param cwd 工作目录
   * @returns 提交记录数组
   */
  static async getRecentCommits(count: number = 5, cwd: string = process.cwd()): Promise<string[]> {
    try {
      const output = this.execGit(['log', '--oneline', '-n', String(count)], cwd);
      return output ? output.split('\n').filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * 获取领先上游的提交数
   * @param cwd 工作目录
   * @returns 提交数,如果没有上游则返回 0
   */
  static async getCommitsAheadOfUpstream(cwd: string = process.cwd()): Promise<number> {
    try {
      const output = this.execGit(['rev-list', '--count', '@{u}..HEAD'], cwd);
      return parseInt(output, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 获取领先默认分支的提交数
   * @param cwd 工作目录
   * @returns 提交数
   */
  static async getCommitsAheadOfDefaultBranch(cwd: string = process.cwd()): Promise<number> {
    try {
      const defaultBranch = await this.getDefaultBranch(cwd);
      const output = this.execGit(['rev-list', '--count', `origin/${defaultBranch}..HEAD`], cwd);
      return parseInt(output, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 获取推送状态
   * @param cwd 工作目录
   * @returns 推送状态
   */
  static async getPushStatus(cwd: string = process.cwd()): Promise<PushStatus> {
    const hasUpstream = await this.hasUpstream(cwd);
    const commitsAheadOfDefaultBranch = await this.getCommitsAheadOfDefaultBranch(cwd);

    if (!hasUpstream) {
      return {
        hasUpstream: false,
        needsPush: true,
        commitsAhead: 0,
        commitsAheadOfDefaultBranch,
      };
    }

    const commitsAhead = await this.getCommitsAheadOfUpstream(cwd);

    return {
      hasUpstream: true,
      needsPush: commitsAhead > 0,
      commitsAhead,
      commitsAheadOfDefaultBranch,
    };
  }

  /**
   * 获取完整的 Git 信息
   * @param cwd 工作目录
   * @returns Git 信息,如果不在仓库中则返回 null
   */
  static async getGitInfo(cwd: string = process.cwd()): Promise<GitInfo | null> {
    try {
      if (!(await this.isGitRepository(cwd))) {
        return null;
      }

      const [commitHash, branchName, remoteUrl, status, defaultBranch, recentCommits] = await Promise.all([
        this.getCurrentCommit(cwd),
        this.getCurrentBranch(cwd),
        this.getRemoteUrl('origin', cwd),
        this.getGitStatus(cwd),
        this.getDefaultBranch(cwd),
        this.getRecentCommits(5, cwd),
      ]);

      return {
        commitHash,
        branchName,
        remoteUrl,
        isClean: status.isClean,
        trackedFiles: status.tracked,
        untrackedFiles: status.untracked,
        defaultBranch,
        recentCommits,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 格式化 Git 状态用于显示
   * @param gitInfo Git 信息
   * @param maxStatusLength 状态文本最大长度 (默认 40000)
   * @returns 格式化的状态文本
   */
  static formatGitStatus(gitInfo: GitInfo, maxStatusLength: number = 40000): string {
    try {
      // 获取完整的 git status 输出
      const statusOutput = execSync('git status', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      // 如果超过最大长度,截断并添加提示
      let statusText = statusOutput;
      if (statusText.length > maxStatusLength) {
        statusText =
          statusText.substring(0, maxStatusLength) +
          `\n... (truncated because it exceeds 40k characters. If you need more information, run "git status" using BashTool)`;
      }

      // 格式化输出
      return `This is the git status at the start of the conversation.
Current branch: ${gitInfo.branchName}

Main branch (you will usually use this for PRs): ${gitInfo.defaultBranch}

Status:
${statusText || '(clean)'}

Recent commits:
${gitInfo.recentCommits.join('\n')}`;
    } catch {
      return `This is the git status at the start of the conversation.
Current branch: ${gitInfo.branchName}

Main branch (you will usually use this for PRs): ${gitInfo.defaultBranch}

Status:
${gitInfo.isClean ? '(clean)' : 'Working directory has changes'}

Recent commits:
${gitInfo.recentCommits.join('\n')}`;
    }
  }
}
