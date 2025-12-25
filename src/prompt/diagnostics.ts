/**
 * IDE 诊断信息收集器
 * 从 TypeScript、ESLint 和 LSP 收集代码诊断信息
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { DiagnosticInfo } from './types.js';

/**
 * 诊断缓存条目
 */
interface DiagnosticCacheEntry {
  diagnostics: DiagnosticInfo[];
  timestamp: number;
}

/**
 * 收集器选项
 */
export interface DiagnosticsCollectorOptions {
  /** 工作目录 */
  workingDir: string;
  /** 缓存过期时间(毫秒) */
  cacheTtl?: number;
  /** 最大诊断信息数量 */
  maxDiagnostics?: number;
  /** 是否启用 TypeScript 检查 */
  enableTypeScript?: boolean;
  /** 是否启用 ESLint 检查 */
  enableESLint?: boolean;
  /** 是否启用 LSP 模拟 */
  enableLSP?: boolean;
}

/**
 * 诊断信息收集器
 */
export class DiagnosticsCollector {
  private workingDir: string;
  private cacheTtl: number;
  private maxDiagnostics: number;
  private enableTypeScript: boolean;
  private enableESLint: boolean;
  private enableLSP: boolean;

  // 诊断缓存
  private cache: Map<string, DiagnosticCacheEntry> = new Map();

  constructor(options: DiagnosticsCollectorOptions) {
    this.workingDir = options.workingDir;
    this.cacheTtl = options.cacheTtl ?? 30000; // 默认30秒
    this.maxDiagnostics = options.maxDiagnostics ?? 50;
    this.enableTypeScript = options.enableTypeScript ?? true;
    this.enableESLint = options.enableESLint ?? true;
    this.enableLSP = options.enableLSP ?? false; // LSP 默认禁用
  }

  /**
   * 收集所有诊断信息
   */
  async collectAll(): Promise<DiagnosticInfo[]> {
    const allDiagnostics: DiagnosticInfo[] = [];

    // 并行收集所有诊断信息
    const promises: Promise<DiagnosticInfo[]>[] = [];

    if (this.enableTypeScript) {
      promises.push(this.collectFromTypeScript());
    }

    if (this.enableESLint) {
      promises.push(this.collectFromESLint());
    }

    if (this.enableLSP) {
      promises.push(this.collectFromLSP());
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allDiagnostics.push(...result.value);
      } else {
        console.warn('Failed to collect diagnostics:', result.reason);
      }
    }

    // 去重和排序
    return this.deduplicateAndSort(allDiagnostics);
  }

  /**
   * 从 TypeScript 编译器收集诊断信息
   */
  async collectFromTypeScript(): Promise<DiagnosticInfo[]> {
    const cacheKey = 'typescript';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const diagnostics: DiagnosticInfo[] = [];

    try {
      // 检查是否有 tsconfig.json
      const tsconfigPath = path.join(this.workingDir, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        return [];
      }

      // 运行 tsc --noEmit
      const output = execSync('npx tsc --noEmit --pretty false', {
        cwd: this.workingDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // TypeScript 成功时不会输出任何内容
      this.setCache(cacheKey, []);
      return [];
    } catch (error: any) {
      // tsc 失败时会输出错误信息
      const output = error.stdout || error.stderr || '';
      const lines = output.split('\n');

      for (const line of lines) {
        // 解析 TypeScript 错误格式: file.ts(line,col): error TS1234: message
        const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/);
        if (match) {
          const [, file, lineStr, colStr, severity, message] = match;
          diagnostics.push({
            file: this.normalizeFilePath(file),
            line: parseInt(lineStr, 10),
            column: parseInt(colStr, 10),
            severity: severity === 'error' ? 'error' : 'warning',
            message: message.trim(),
            source: 'typescript',
          });
        }
      }

      this.setCache(cacheKey, diagnostics);
      return diagnostics;
    }
  }

  /**
   * 从 ESLint 收集诊断信息
   */
  async collectFromESLint(): Promise<DiagnosticInfo[]> {
    const cacheKey = 'eslint';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const diagnostics: DiagnosticInfo[] = [];

    try {
      // 检查是否有 ESLint 配置文件
      const configFiles = [
        '.eslintrc.js',
        '.eslintrc.cjs',
        '.eslintrc.json',
        '.eslintrc.yml',
        '.eslintrc.yaml',
        'eslint.config.js',
      ];

      const hasConfig = configFiles.some(file =>
        fs.existsSync(path.join(this.workingDir, file))
      );

      // 检查 package.json 中的 eslintConfig
      const packageJsonPath = path.join(this.workingDir, 'package.json');
      if (!hasConfig && fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (!packageJson.eslintConfig) {
          return [];
        }
      } else if (!hasConfig) {
        return [];
      }

      // 运行 ESLint with JSON format
      const output = execSync(
        'npx eslint . --format json --no-color',
        {
          cwd: this.workingDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // 解析 JSON 输出
      const results = JSON.parse(output);

      for (const result of results) {
        if (!result.messages || result.messages.length === 0) {
          continue;
        }

        for (const message of result.messages) {
          diagnostics.push({
            file: this.normalizeFilePath(result.filePath),
            line: message.line || 1,
            column: message.column || 1,
            severity: this.mapESLintSeverity(message.severity),
            message: `${message.message} (${message.ruleId || 'unknown'})`,
            source: 'eslint',
          });
        }
      }

      this.setCache(cacheKey, diagnostics);
      return diagnostics;
    } catch (error: any) {
      // ESLint 可能输出 JSON 即使有错误
      try {
        const output = error.stdout || '';
        if (output) {
          const results = JSON.parse(output);

          for (const result of results) {
            if (!result.messages || result.messages.length === 0) {
              continue;
            }

            for (const message of result.messages) {
              diagnostics.push({
                file: this.normalizeFilePath(result.filePath),
                line: message.line || 1,
                column: message.column || 1,
                severity: this.mapESLintSeverity(message.severity),
                message: `${message.message} (${message.ruleId || 'unknown'})`,
                source: 'eslint',
              });
            }
          }
        }
      } catch {
        // 解析失败，返回空数组
      }

      this.setCache(cacheKey, diagnostics);
      return diagnostics;
    }
  }

  /**
   * 从 LSP 服务器收集诊断信息 (模拟)
   */
  async collectFromLSP(): Promise<DiagnosticInfo[]> {
    const cacheKey = 'lsp';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 这是一个模拟实现
    // 在真实的 IDE 集成中，这会连接到实际的 LSP 服务器
    // 目前返回空数组
    const diagnostics: DiagnosticInfo[] = [];

    // TODO: 在未来的版本中实现真实的 LSP 集成
    // 可能的实现方式:
    // 1. 启动 TypeScript LSP 服务器
    // 2. 通过 LSP 协议请求诊断信息
    // 3. 解析响应并转换为 DiagnosticInfo 格式

    this.setCache(cacheKey, diagnostics);
    return diagnostics;
  }

  /**
   * 从缓存获取诊断信息
   */
  private getFromCache(key: string): DiagnosticInfo[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return entry.diagnostics;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, diagnostics: DiagnosticInfo[]): void {
    this.cache.set(key, {
      diagnostics,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 去重和排序诊断信息
   */
  private deduplicateAndSort(diagnostics: DiagnosticInfo[]): DiagnosticInfo[] {
    // 去重 - 使用文件、行、列和消息作为唯一标识
    const seen = new Set<string>();
    const unique: DiagnosticInfo[] = [];

    for (const diag of diagnostics) {
      const key = `${diag.file}:${diag.line}:${diag.column}:${diag.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(diag);
      }
    }

    // 按严重性排序 (error > warning > info > hint)
    const severityOrder: Record<string, number> = {
      error: 0,
      warning: 1,
      info: 2,
      hint: 3,
    };

    unique.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // 同样严重性，按文件路径排序
      const fileDiff = a.file.localeCompare(b.file);
      if (fileDiff !== 0) {
        return fileDiff;
      }

      // 同样文件，按行号排序
      return a.line - b.line;
    });

    // 限制数量
    return unique.slice(0, this.maxDiagnostics);
  }

  /**
   * 标准化文件路径
   */
  private normalizeFilePath(filePath: string): string {
    // 如果是绝对路径，转换为相对路径
    if (path.isAbsolute(filePath)) {
      const relative = path.relative(this.workingDir, filePath);
      // 如果相对路径在工作目录内，使用相对路径，否则使用绝对路径
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return relative;
      }
    }

    return filePath;
  }

  /**
   * 映射 ESLint 严重性到标准严重性
   */
  private mapESLintSeverity(severity: number): DiagnosticInfo['severity'] {
    switch (severity) {
      case 2:
        return 'error';
      case 1:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * 按严重性分组
   */
  groupBySeverity(diagnostics: DiagnosticInfo[]): {
    errors: DiagnosticInfo[];
    warnings: DiagnosticInfo[];
    infos: DiagnosticInfo[];
    hints: DiagnosticInfo[];
  } {
    return {
      errors: diagnostics.filter(d => d.severity === 'error'),
      warnings: diagnostics.filter(d => d.severity === 'warning'),
      infos: diagnostics.filter(d => d.severity === 'info'),
      hints: diagnostics.filter(d => d.severity === 'hint'),
    };
  }

  /**
   * 生成友好的显示格式
   */
  formatDiagnostics(diagnostics: DiagnosticInfo[], maxPerSeverity?: number): string {
    const grouped = this.groupBySeverity(diagnostics);
    const parts: string[] = [];

    const maxCount = maxPerSeverity ?? 10;

    if (grouped.errors.length > 0) {
      parts.push(`Errors (${grouped.errors.length}):`);
      for (const diag of grouped.errors.slice(0, maxCount)) {
        const source = diag.source ? ` [${diag.source}]` : '';
        parts.push(`  • ${diag.file}:${diag.line}:${diag.column}${source}`);
        parts.push(`    ${diag.message}`);
      }
      if (grouped.errors.length > maxCount) {
        parts.push(`  ... and ${grouped.errors.length - maxCount} more errors`);
      }
      parts.push('');
    }

    if (grouped.warnings.length > 0) {
      parts.push(`Warnings (${grouped.warnings.length}):`);
      for (const diag of grouped.warnings.slice(0, maxCount)) {
        const source = diag.source ? ` [${diag.source}]` : '';
        parts.push(`  • ${diag.file}:${diag.line}:${diag.column}${source}`);
        parts.push(`    ${diag.message}`);
      }
      if (grouped.warnings.length > maxCount) {
        parts.push(`  ... and ${grouped.warnings.length - maxCount} more warnings`);
      }
      parts.push('');
    }

    if (grouped.infos.length > 0) {
      parts.push(`Info (${grouped.infos.length}):`);
      for (const diag of grouped.infos.slice(0, Math.min(maxCount, 5))) {
        const source = diag.source ? ` [${diag.source}]` : '';
        parts.push(`  • ${diag.file}:${diag.line}:${diag.column}${source} - ${diag.message}`);
      }
      if (grouped.infos.length > 5) {
        parts.push(`  ... and ${grouped.infos.length - 5} more info messages`);
      }
      parts.push('');
    }

    if (grouped.hints.length > 0) {
      parts.push(`Hints (${grouped.hints.length}):`);
      for (const diag of grouped.hints.slice(0, Math.min(maxCount, 3))) {
        const source = diag.source ? ` [${diag.source}]` : '';
        parts.push(`  • ${diag.file}:${diag.line}:${diag.column}${source} - ${diag.message}`);
      }
      if (grouped.hints.length > 3) {
        parts.push(`  ... and ${grouped.hints.length - 3} more hints`);
      }
    }

    return parts.join('\n').trim();
  }

  /**
   * 获取诊断摘要
   */
  getSummary(diagnostics: DiagnosticInfo[]): string {
    const grouped = this.groupBySeverity(diagnostics);
    const parts: string[] = [];

    if (grouped.errors.length > 0) {
      parts.push(`${grouped.errors.length} error${grouped.errors.length > 1 ? 's' : ''}`);
    }

    if (grouped.warnings.length > 0) {
      parts.push(`${grouped.warnings.length} warning${grouped.warnings.length > 1 ? 's' : ''}`);
    }

    if (grouped.infos.length > 0) {
      parts.push(`${grouped.infos.length} info message${grouped.infos.length > 1 ? 's' : ''}`);
    }

    if (grouped.hints.length > 0) {
      parts.push(`${grouped.hints.length} hint${grouped.hints.length > 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No diagnostics';
  }
}

/**
 * 创建默认的诊断收集器
 */
export function createDiagnosticsCollector(
  workingDir: string,
  options?: Partial<DiagnosticsCollectorOptions>
): DiagnosticsCollector {
  return new DiagnosticsCollector({
    workingDir,
    ...options,
  });
}

/**
 * 全局诊断收集器实例 (用于当前工作目录)
 */
let defaultCollector: DiagnosticsCollector | null = null;

/**
 * 获取或创建默认诊断收集器
 */
export function getDefaultCollector(workingDir?: string): DiagnosticsCollector {
  const cwd = workingDir || process.cwd();

  if (!defaultCollector || defaultCollector['workingDir'] !== cwd) {
    defaultCollector = createDiagnosticsCollector(cwd);
  }

  return defaultCollector;
}
