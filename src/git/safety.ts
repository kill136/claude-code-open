/**
 * Git 安全检查工具类
 * 实现 T297 (Git 安全检查)
 */

import { GitAnalysis } from './analysis.js';

/**
 * 安全检查结果接口
 */
export interface SafetyCheckResult {
  /** 是否安全 */
  safe: boolean;
  /** 危险原因 */
  reason?: string;
  /** 警告信息 */
  warning?: string;
  /** 建议操作 */
  suggestion?: string;
}

/**
 * 敏感文件检查结果
 */
export interface SensitiveFilesCheck {
  /** 是否有敏感文件 */
  hasSensitiveFiles: boolean;
  /** 敏感文件列表 */
  sensitiveFiles: string[];
  /** 警告信息 */
  warnings: string[];
}

/**
 * Git 安全检查工具类
 * 提供 Git 操作的安全检查功能
 */
export class GitSafety {
  /**
   * 危险的 Git 命令列表
   */
  private static readonly DANGEROUS_COMMANDS = [
    'push --force',
    'push -f',
    'reset --hard',
    'clean -fd',
    'clean -fdx',
    'clean -f',
    'filter-branch',
    'rebase --force',
  ];

  /**
   * 需要谨慎使用的命令模式
   */
  private static readonly CAUTION_PATTERNS = [
    /git\s+push.*--force/,
    /git\s+push.*-f\b/,
    /git\s+reset\s+--hard/,
    /git\s+clean\s+-[fdx]+/,
    /git\s+commit.*--amend/,
    /git\s+rebase.*-i/,
    /git\s+config/,
    /--no-verify/,
    /--no-gpg-sign/,
  ];

  /**
   * 敏感文件模式
   */
  private static readonly SENSITIVE_FILE_PATTERNS = [
    /\.env$/,
    /\.env\./,
    /credentials\.json$/,
    /secrets\.json$/,
    /\.pem$/,
    /\.key$/,
    /\.cert$/,
    /id_rsa$/,
    /id_ed25519$/,
    /\.aws\/credentials$/,
    /\.ssh\/id_/,
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
  ];

  /**
   * T297: 检查 Git 命令是否安全
   * @param command Git 命令
   * @returns 安全检查结果
   */
  static validateGitCommand(command: string): SafetyCheckResult {
    // 检查是否包含危险命令
    for (const dangerous of this.DANGEROUS_COMMANDS) {
      if (command.includes(dangerous)) {
        return {
          safe: false,
          reason: `Dangerous command detected: ${dangerous}`,
          suggestion:
            'This operation is destructive and irreversible. Please confirm explicitly if you want to proceed.',
        };
      }
    }

    // 检查是否匹配谨慎模式
    for (const pattern of this.CAUTION_PATTERNS) {
      if (pattern.test(command)) {
        return {
          safe: true,
          warning: `Potentially dangerous command pattern detected. Use with caution.`,
          suggestion: 'Make sure you understand the consequences of this operation.',
        };
      }
    }

    return { safe: true };
  }

  /**
   * T297: 检查是否是危险的 Git 命令
   * @param command Git 命令
   * @returns 是否危险
   */
  static isDangerousCommand(command: string): boolean {
    const result = this.validateGitCommand(command);
    return !result.safe;
  }

  /**
   * T297: 检查是否强制推送到 main/master
   * @param command Git 命令
   * @param currentBranch 当前分支
   * @returns 安全检查结果
   */
  static checkForcePushToMainBranch(command: string, currentBranch: string): SafetyCheckResult {
    const isForcePush = /push.*--force|push.*-f\b/.test(command);
    const isMainBranch = /^(main|master)$/.test(currentBranch);

    if (isForcePush && isMainBranch) {
      return {
        safe: false,
        reason: `Force push to ${currentBranch} branch is highly dangerous`,
        suggestion: 'NEVER force push to main/master. Create a new branch and submit a pull request instead.',
      };
    }

    if (isForcePush) {
      return {
        safe: true,
        warning: `Force push detected on branch: ${currentBranch}`,
        suggestion: 'Make sure no one else is working on this branch.',
      };
    }

    return { safe: true };
  }

  /**
   * T297: 检查 commit --amend 的安全性
   * @param cwd 工作目录
   * @returns 安全检查结果
   */
  static async validateAmend(cwd: string = process.cwd()): Promise<SafetyCheckResult> {
    try {
      // 检查最近一次提交的作者
      const author = await GitAnalysis.checkCommitAuthor(cwd);
      if (!author) {
        return {
          safe: false,
          reason: 'Cannot determine commit author',
          suggestion: 'Make sure you are in a git repository.',
        };
      }

      // 检查是否已经推送到远程
      // 这里简化处理,实际应该检查 git log origin/branch..HEAD
      const { execSync } = await import('child_process');
      try {
        const status = execSync('git status', {
          cwd,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (status.includes('Your branch is ahead')) {
          return {
            safe: true,
            warning: 'You are about to amend a commit that has not been pushed yet.',
            suggestion: 'Make sure this is your own commit.',
          };
        }

        if (status.includes('Your branch is up to date')) {
          return {
            safe: false,
            reason: 'The commit has already been pushed to remote',
            suggestion: 'NEVER amend commits that have been pushed. Create a new commit instead.',
          };
        }
      } catch {
        // 如果无法确定,允许但警告
        return {
          safe: true,
          warning: 'Cannot determine if the commit has been pushed',
          suggestion: 'Only amend commits that have not been pushed to remote.',
        };
      }

      return { safe: true };
    } catch (error) {
      return {
        safe: false,
        reason: 'Failed to validate amend operation',
      };
    }
  }

  /**
   * T297: 检查提交作者身份
   * @param cwd 工作目录
   * @returns 作者信息
   */
  static async checkCommitAuthor(cwd: string = process.cwd()): Promise<{ name: string; email: string } | null> {
    return GitAnalysis.checkCommitAuthor(cwd);
  }

  /**
   * T297: 检查敏感文件
   * @param files 文件列表
   * @returns 敏感文件检查结果
   */
  static checkSensitiveFiles(files: string[]): SensitiveFilesCheck {
    const sensitiveFiles: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      for (const pattern of this.SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(file)) {
          sensitiveFiles.push(file);
          warnings.push(`Sensitive file detected: ${file}`);
          break;
        }
      }
    }

    return {
      hasSensitiveFiles: sensitiveFiles.length > 0,
      sensitiveFiles,
      warnings,
    };
  }

  /**
   * T297: 检查是否跳过钩子
   * @param command Git 命令
   * @returns 安全检查结果
   */
  static checkSkipHooks(command: string): SafetyCheckResult {
    if (command.includes('--no-verify')) {
      return {
        safe: false,
        reason: 'Attempting to skip Git hooks with --no-verify',
        suggestion: 'Do not skip hooks unless explicitly requested by the user.',
      };
    }

    if (command.includes('--no-gpg-sign')) {
      return {
        safe: false,
        reason: 'Attempting to skip GPG signing with --no-gpg-sign',
        suggestion: 'Do not skip GPG signing unless explicitly requested by the user.',
      };
    }

    return { safe: true };
  }

  /**
   * T297: 检查 Git 配置修改
   * @param command Git 命令
   * @returns 安全检查结果
   */
  static checkConfigChange(command: string): SafetyCheckResult {
    if (/git\s+config/.test(command)) {
      return {
        safe: false,
        reason: 'Attempting to modify Git configuration',
        suggestion: 'NEVER update the git config unless explicitly requested by the user.',
      };
    }

    return { safe: true };
  }

  /**
   * 综合安全检查
   * @param command Git 命令
   * @param currentBranch 当前分支
   * @param files 涉及的文件列表
   * @returns 安全检查结果
   */
  static async comprehensiveCheck(
    command: string,
    currentBranch?: string,
    files?: string[]
  ): Promise<SafetyCheckResult> {
    // 1. 检查配置修改
    const configCheck = this.checkConfigChange(command);
    if (!configCheck.safe) {
      return configCheck;
    }

    // 2. 检查跳过钩子
    const hooksCheck = this.checkSkipHooks(command);
    if (!hooksCheck.safe) {
      return hooksCheck;
    }

    // 3. 检查危险命令
    const dangerCheck = this.validateGitCommand(command);
    if (!dangerCheck.safe) {
      return dangerCheck;
    }

    // 4. 检查强制推送
    if (currentBranch) {
      const forcePushCheck = this.checkForcePushToMainBranch(command, currentBranch);
      if (!forcePushCheck.safe) {
        return forcePushCheck;
      }
    }

    // 5. 检查敏感文件 (如果是 commit 或 add 命令)
    if (files && (command.includes('git add') || command.includes('git commit'))) {
      const sensitiveCheck = this.checkSensitiveFiles(files);
      if (sensitiveCheck.hasSensitiveFiles) {
        return {
          safe: true,
          warning: `Sensitive files detected: ${sensitiveCheck.sensitiveFiles.join(', ')}`,
          suggestion: 'Do not commit files that likely contain secrets (.env, credentials.json, etc).',
        };
      }
    }

    // 如果有警告,返回警告
    if (dangerCheck.warning) {
      return dangerCheck;
    }

    return { safe: true };
  }
}
