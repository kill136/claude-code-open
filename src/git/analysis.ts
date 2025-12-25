/**
 * Git 分析工具类
 * 实现 T292 (Git diff 分析), T293 (Git log 查询)
 */

import { execSync } from 'child_process';

/**
 * Git diff 选项接口
 */
export interface GitDiffOptions {
  /** 基准分支/提交 */
  base?: string;
  /** 只显示 staged 的变更 */
  staged?: boolean;
  /** 只显示文件名 */
  nameOnly?: boolean;
  /** 使用 merge-base 比较 */
  mergeBase?: boolean;
}

/**
 * Git 提交信息接口
 */
export interface Commit {
  /** 提交哈希 */
  hash: string;
  /** 提交哈希 (短格式) */
  shortHash: string;
  /** 作者名 */
  author: string;
  /** 作者邮箱 */
  email: string;
  /** 提交日期 */
  date: string;
  /** 提交消息 */
  message: string;
}

/**
 * Diff 统计信息接口
 */
export interface DiffStats {
  /** 修改的文件数 */
  filesChanged: number;
  /** 添加的行数 */
  insertions: number;
  /** 删除的行数 */
  deletions: number;
  /** 修改的文件列表 */
  files: string[];
}

/**
 * Git 分析工具类
 * 提供 diff 和 log 分析功能
 */
export class GitAnalysis {
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
   * T292: 获取 Git diff
   * @param options Diff 选项
   * @param cwd 工作目录
   * @returns Diff 输出
   */
  static async getDiff(options: GitDiffOptions = {}, cwd: string = process.cwd()): Promise<string> {
    const args = ['diff'];

    if (options.staged) {
      args.push('--staged');
    }

    if (options.nameOnly) {
      args.push('--name-only');
    }

    if (options.base) {
      if (options.mergeBase) {
        args.push('--merge-base', options.base);
      } else {
        args.push(options.base);
      }
    }

    try {
      return this.execGit(args, cwd);
    } catch {
      return '';
    }
  }

  /**
   * T292: 获取修改的文件列表
   * @param base 基准分支/提交
   * @param cwd 工作目录
   * @returns 修改的文件列表
   */
  static async getModifiedFiles(base?: string, cwd: string = process.cwd()): Promise<string[]> {
    const diff = await this.getDiff({ base, nameOnly: true }, cwd);
    return diff ? diff.split('\n').filter(Boolean) : [];
  }

  /**
   * T292: 获取 diff 统计信息
   * @param base 基准分支/提交
   * @param cwd 工作目录
   * @returns Diff 统计信息
   */
  static async getDiffStats(base?: string, cwd: string = process.cwd()): Promise<DiffStats> {
    try {
      const args = ['diff', '--shortstat'];
      if (base) {
        args.push(base);
      }

      const output = this.execGit(args, cwd);
      const files = await this.getModifiedFiles(base, cwd);

      // 解析统计信息
      // 格式: " 3 files changed, 45 insertions(+), 12 deletions(-)"
      const filesMatch = output.match(/(\d+)\s+files?\s+changed/);
      const insertionsMatch = output.match(/(\d+)\s+insertions?\(/);
      const deletionsMatch = output.match(/(\d+)\s+deletions?\(/);

      return {
        filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
        insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
        deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
        files,
      };
    } catch {
      return {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        files: [],
      };
    }
  }

  /**
   * T292: 获取与默认分支的差异
   * @param defaultBranch 默认分支名
   * @param cwd 工作目录
   * @returns Diff 输出
   */
  static async getDiffFromDefaultBranch(defaultBranch: string, cwd: string = process.cwd()): Promise<string> {
    return this.getDiff({ base: `origin/${defaultBranch}...HEAD` }, cwd);
  }

  /**
   * T293: 获取最近的提交记录
   * @param count 提交数量
   * @param cwd 工作目录
   * @returns 提交记录数组
   */
  static async getRecentCommits(count: number = 5, cwd: string = process.cwd()): Promise<Commit[]> {
    try {
      // 使用 --format 获取结构化数据
      // 格式: hash|shortHash|author|email|date|message
      const format = '%H|%h|%an|%ae|%ai|%s';
      const output = this.execGit(['log', `--format=${format}`, '-n', String(count)], cwd);

      if (!output) {
        return [];
      }

      return output.split('\n').map((line) => {
        const [hash, shortHash, author, email, date, message] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          email,
          date,
          message,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * T293: 获取提交历史 (从分支分叉点开始)
   * @param base 基准分支/提交
   * @param cwd 工作目录
   * @returns 提交记录数组
   */
  static async getCommitHistory(base?: string, cwd: string = process.cwd()): Promise<Commit[]> {
    try {
      const format = '%H|%h|%an|%ae|%ai|%s';
      const args = ['log', `--format=${format}`];

      if (base) {
        args.push(`${base}..HEAD`);
      }

      const output = this.execGit(args, cwd);

      if (!output) {
        return [];
      }

      return output.split('\n').map((line) => {
        const [hash, shortHash, author, email, date, message] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          email,
          date,
          message,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * T293: 获取提交的详细信息
   * @param commitHash 提交哈希
   * @param cwd 工作目录
   * @returns 提交详细信息
   */
  static async getCommitDetails(commitHash: string, cwd: string = process.cwd()): Promise<Commit | null> {
    try {
      const format = '%H|%h|%an|%ae|%ai|%s';
      const output = this.execGit(['log', `--format=${format}`, '-n', '1', commitHash], cwd);

      if (!output) {
        return null;
      }

      const [hash, shortHash, author, email, date, message] = output.split('|');
      return {
        hash,
        shortHash,
        author,
        email,
        date,
        message,
      };
    } catch {
      return null;
    }
  }

  /**
   * T293: 检查提交作者
   * @param cwd 工作目录
   * @returns 最近一次提交的作者信息
   */
  static async checkCommitAuthor(cwd: string = process.cwd()): Promise<{ name: string; email: string } | null> {
    try {
      const output = this.execGit(['log', '-1', '--format=%an %ae'], cwd);
      const [name, email] = output.split(' ');
      return { name, email };
    } catch {
      return null;
    }
  }

  /**
   * 获取指定文件的修改历史
   * @param filePath 文件路径
   * @param count 提交数量
   * @param cwd 工作目录
   * @returns 提交记录数组
   */
  static async getFileHistory(
    filePath: string,
    count: number = 10,
    cwd: string = process.cwd()
  ): Promise<Commit[]> {
    try {
      const format = '%H|%h|%an|%ae|%ai|%s';
      const output = this.execGit(['log', `--format=${format}`, '-n', String(count), '--', filePath], cwd);

      if (!output) {
        return [];
      }

      return output.split('\n').map((line) => {
        const [hash, shortHash, author, email, date, message] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          email,
          date,
          message,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * 获取两个提交之间的差异
   * @param from 起始提交
   * @param to 结束提交
   * @param cwd 工作目录
   * @returns Diff 输出
   */
  static async getDiffBetween(from: string, to: string, cwd: string = process.cwd()): Promise<string> {
    return this.getDiff({ base: `${from}..${to}` }, cwd);
  }
}
