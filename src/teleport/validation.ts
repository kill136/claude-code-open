/**
 * Teleport 仓库验证
 * 确保远程会话在正确的 Git 仓库中运行
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { RepoValidationResult, RepoValidationStatus } from './types.js';

const execAsync = promisify(exec);

/**
 * 获取当前 Git 仓库远程 URL
 */
export async function getCurrentRepoUrl(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git config --get remote.origin.url', {
      cwd: process.cwd(),
    });
    return stdout.trim() || null;
  } catch (error) {
    // 不是 git 仓库或没有 origin
    return null;
  }
}

/**
 * 规范化仓库 URL（去除 .git 后缀，统一协议）
 */
export function normalizeRepoUrl(url: string): string {
  let normalized = url.trim();

  // 移除 .git 后缀
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4);
  }

  // 转换 SSH 格式为 HTTPS
  // git@github.com:user/repo -> https://github.com/user/repo
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    normalized = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  // 移除尾部斜杠
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.toLowerCase();
}

/**
 * 比较两个仓库 URL 是否相同
 */
export function compareRepoUrls(url1: string, url2: string): boolean {
  return normalizeRepoUrl(url1) === normalizeRepoUrl(url2);
}

/**
 * 验证会话仓库是否匹配当前仓库
 */
export async function validateSessionRepository(
  sessionRepo?: string
): Promise<RepoValidationResult> {
  // 如果会话没有仓库信息，不需要验证
  if (!sessionRepo) {
    return {
      status: 'no_validation',
    };
  }

  try {
    // 获取当前仓库
    const currentRepo = await getCurrentRepoUrl();

    if (!currentRepo) {
      // 当前目录不是 git 仓库
      return {
        status: 'error',
        sessionRepo,
        errorMessage: 'Current directory is not a git repository',
      };
    }

    // 比较仓库
    const isMatch = compareRepoUrls(sessionRepo, currentRepo);

    if (isMatch) {
      return {
        status: 'match',
        sessionRepo,
        currentRepo,
      };
    } else {
      return {
        status: 'mismatch',
        sessionRepo,
        currentRepo,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      sessionRepo,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 获取当前分支名
 */
export async function getCurrentBranch(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: process.cwd(),
    });
    return stdout.trim() || null;
  } catch (error) {
    return null;
  }
}

/**
 * 检查工作目录是否干净
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: process.cwd(),
    });
    return stdout.trim().length === 0;
  } catch (error) {
    return false;
  }
}
