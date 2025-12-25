/**
 * Git ignore 规则处理
 * 实现 T296 (.gitignore 规则)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 默认忽略的目录和文件模式
 */
export const DEFAULT_IGNORE_PATTERNS = [
  // 版本控制
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',

  // 依赖
  '**/node_modules/**',
  '**/vendor/**',
  '**/.pnp/**',
  '**/.pnp.js',

  // 构建输出
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/target/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.cache/**',
  '**/.parcel-cache/**',

  // IDE 和编辑器
  '**/.vscode/**',
  '**/.idea/**',
  '**/*.swp',
  '**/*.swo',
  '**/*~',
  '**/.DS_Store',

  // 临时文件
  '**/.temp/**',
  '**/.tmp/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.pyo',
  '**/.pytest_cache/**',
  '**/.coverage',

  // 日志文件
  '**/*.log',
  '**/logs/**',

  // 环境和配置
  '**/.env',
  '**/.env.local',
  '**/.env.*.local',
];

/**
 * Git ignore 工具类
 */
export class GitIgnore {
  private static ignoreCache = new Map<string, string[]>();

  /**
   * T296: 解析 .gitignore 文件
   * @param gitignorePath .gitignore 文件路径
   * @returns 忽略规则数组
   */
  static parseGitignore(gitignorePath: string): string[] {
    // 检查缓存
    if (this.ignoreCache.has(gitignorePath)) {
      return this.ignoreCache.get(gitignorePath)!;
    }

    try {
      if (!fs.existsSync(gitignorePath)) {
        return [];
      }

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      const lines = content.split('\n');

      const rules: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        rules.push(trimmed);
      }

      // 缓存结果
      this.ignoreCache.set(gitignorePath, rules);

      return rules;
    } catch (error) {
      return [];
    }
  }

  /**
   * T296: 检查文件是否被忽略
   * @param filePath 文件路径
   * @param cwd 工作目录
   * @returns 是否被忽略
   */
  static isIgnored(filePath: string, cwd: string = process.cwd()): boolean {
    try {
      // 使用 git check-ignore 命令
      execSync(`git check-ignore -q "${filePath}"`, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * T296: 检查文件是否匹配默认忽略模式
   * @param filePath 文件路径
   * @returns 是否匹配
   */
  static matchesDefaultIgnorePatterns(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of DEFAULT_IGNORE_PATTERNS) {
      if (this.matchPattern(normalizedPath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 简单的 glob 模式匹配
   * @param filePath 文件路径
   * @param pattern 匹配模式
   * @returns 是否匹配
   */
  private static matchPattern(filePath: string, pattern: string): boolean {
    // 移除 **/
    pattern = pattern.replace(/^\*\*\//, '');
    pattern = pattern.replace(/\/\*\*\//, '/');
    pattern = pattern.replace(/\/\*\*$/, '');

    // 转换为正则表达式
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern);

    return regex.test(filePath);
  }

  /**
   * T296: 获取项目的所有 .gitignore 文件
   * @param cwd 工作目录
   * @returns .gitignore 文件路径列表
   */
  static findGitignoreFiles(cwd: string = process.cwd()): string[] {
    const gitignoreFiles: string[] = [];

    try {
      // 根目录的 .gitignore
      const rootGitignore = path.join(cwd, '.gitignore');
      if (fs.existsSync(rootGitignore)) {
        gitignoreFiles.push(rootGitignore);
      }

      // 查找子目录中的 .gitignore (最多 3 层)
      const searchDirs = (dir: string, depth: number = 0) => {
        if (depth > 3) return;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name === '.gitignore') {
              const gitignorePath = path.join(dir, entry.name);
              gitignoreFiles.push(gitignorePath);
            } else if (entry.isDirectory() && !this.matchesDefaultIgnorePatterns(entry.name)) {
              searchDirs(path.join(dir, entry.name), depth + 1);
            }
          }
        } catch {
          // 忽略权限错误等
        }
      };

      searchDirs(cwd);

      return gitignoreFiles;
    } catch {
      return gitignoreFiles;
    }
  }

  /**
   * T296: 获取项目的所有忽略规则
   * @param cwd 工作目录
   * @returns 忽略规则数组
   */
  static getAllIgnoreRules(cwd: string = process.cwd()): string[] {
    const gitignoreFiles = this.findGitignoreFiles(cwd);
    const allRules: string[] = [...DEFAULT_IGNORE_PATTERNS];

    for (const gitignorePath of gitignoreFiles) {
      const rules = this.parseGitignore(gitignorePath);
      allRules.push(...rules);
    }

    return Array.from(new Set(allRules)); // 去重
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.ignoreCache.clear();
  }

  /**
   * 检查目录是否应该被跳过
   * @param dirName 目录名
   * @returns 是否应该被跳过
   */
  static shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'target', '.next', '.cache'];
    return skipDirs.includes(dirName);
  }

  /**
   * 建议添加到 .gitignore 的规则
   * @returns 建议规则数组
   */
  static getSuggestedRules(): string[] {
    return [
      '# Claude Code',
      '.claude/',
      '.claude/sessions/',
      '',
      '# Keep CLAUDE.md tracked',
      '!CLAUDE.md',
      '',
      '# Environment variables',
      '.env',
      '.env.local',
      '.env.*.local',
      '',
      '# Dependencies',
      'node_modules/',
      '',
      '# Build output',
      'dist/',
      'build/',
      '',
      '# IDE',
      '.vscode/',
      '.idea/',
      '',
      '# OS',
      '.DS_Store',
      'Thumbs.db',
    ];
  }

  /**
   * 生成 .gitignore 文件内容
   * @param additionalRules 额外的规则
   * @returns .gitignore 文件内容
   */
  static generateGitignoreContent(additionalRules: string[] = []): string {
    const suggested = this.getSuggestedRules();
    const all = [...suggested, '', ...additionalRules];
    return all.join('\n') + '\n';
  }
}
