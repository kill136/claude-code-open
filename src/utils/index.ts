/**
 * 工具函数
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 生成 UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * 检查路径是否安全（防止目录遍历）
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);
  return resolvedTarget.startsWith(resolvedBase);
}

/**
 * 递归获取目录下所有文件
 */
export function getAllFiles(dir: string, pattern?: RegExp): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // 跳过常见的忽略目录
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!pattern || pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir);
  }

  return files;
}

/**
 * 计算字符串的行数
 */
export function countLines(str: string): number {
  return str.split('\n').length;
}

/**
 * 比较两个字符串并返回差异
 */
export function diffStrings(oldStr: string, newStr: string): {
  added: number;
  removed: number;
} {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let added = 0;
  let removed = 0;

  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }

  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }

  return { added, removed };
}

/**
 * 环境变量解析
 */
export function parseEnvBool(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase().trim());
}

/**
 * 获取项目根目录（通过查找 package.json 或 .git）
 */
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

/**
 * 打开浏览器URL
 * @param url - 要打开的URL
 * @returns Promise<boolean> - 成功返回true，失败返回false
 */
export async function openUrl(url: string): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin': // macOS
        command = `open "${url}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${url}"`;
        break;
    }

    await execAsync(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 解析时间字符串为毫秒
 * 支持的格式：
 * - 纯数字: 直接作为毫秒处理
 * - Ns/S: 秒
 * - Nm/M: 分钟
 * - Nh/H: 小时
 * - Nd/D: 天
 * - 组合格式: "1h30m", "2d12h" 等
 *
 * 示例：
 * - "1000" -> 1000ms
 * - "30s" -> 30000ms
 * - "5m" -> 300000ms
 * - "2h" -> 7200000ms
 * - "1d" -> 86400000ms
 * - "1h30m" -> 5400000ms
 * - "2d12h30m" -> 217800000ms
 *
 * @param timeString 时间字符串
 * @returns 毫秒数，如果解析失败返回 null
 */
export function parseDuration(timeString: string | undefined): number | null {
  if (!timeString) return null;

  const trimmed = timeString.trim();

  // 纯数字直接返回（视为毫秒）
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // 定义时间单位映射（毫秒）
  const unitToMs: Record<string, number> = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
  };

  // 匹配所有时间组件（如 "2h", "30m" 等）
  const pattern = /(\d+(?:\.\d+)?)(s|m|h|d)/gi;
  const matches = trimmed.matchAll(pattern);

  let totalMs = 0;
  let hasMatch = false;

  for (const match of matches) {
    hasMatch = true;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = unitToMs[unit];

    if (multiplier) {
      totalMs += value * multiplier;
    }
  }

  // 如果没有匹配到任何时间单位，返回 null
  if (!hasMatch) {
    return null;
  }

  return Math.round(totalMs);
}

/**
 * 解析超时时间字符串
 * 与 parseDuration 类似，但有最大值限制
 *
 * @param timeString 时间字符串
 * @param defaultMs 默认值（毫秒）
 * @param maxMs 最大值（毫秒），默认 10 分钟
 * @returns 毫秒数
 */
export function parseTimeout(
  timeString: string | undefined,
  defaultMs: number = 120000,
  maxMs: number = 600000
): number {
  const parsed = parseDuration(timeString);

  if (parsed === null) {
    return defaultMs;
  }

  return Math.min(parsed, maxMs);
}

/**
 * MCP 输出 Token 限制
 * 从环境变量读取或使用默认值
 */
export const MAX_MCP_OUTPUT_TOKENS = (): number => {
  const envValue = process.env.MAX_MCP_OUTPUT_TOKENS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 25000; // 官方默认值
};

/**
 * 计算 MCP 输出的最大字符数
 * 大约每个 token 对应 4 个字符
 */
export const getMaxMcpOutputChars = (): number => {
  return MAX_MCP_OUTPUT_TOKENS() * 4;
};

/**
 * 截断 MCP 输出以符合 token 限制
 *
 * @param output 原始输出
 * @param maxTokens 最大 token 数（可选，默认使用环境变量或 25000）
 * @returns 截断后的输出
 */
export function truncateMcpOutput(output: string, maxTokens?: number): string {
  const limit = maxTokens ?? MAX_MCP_OUTPUT_TOKENS();
  const maxChars = limit * 4;

  if (output.length <= maxChars) {
    return output;
  }

  // 保留开头和结尾，中间用省略号
  const keepStart = Math.floor(maxChars * 0.7);
  const keepEnd = Math.floor(maxChars * 0.25);

  const start = output.substring(0, keepStart);
  const end = output.substring(output.length - keepEnd);

  const omittedChars = output.length - keepStart - keepEnd;
  const omittedTokens = Math.ceil(omittedChars / 4);

  return `${start}\n\n... [${omittedChars} characters / ~${omittedTokens} tokens omitted] ...\n\n${end}`;
}

// Re-export attribution utilities
export { getAttribution, getCommitAttribution, getPRAttribution, isAttributionEnabled } from './attribution.js';

// Re-export git helper utilities
export { addCommitAttribution, isGitCommitCommand, processGitCommitCommand, hasCommitAttribution } from './git-helper.js';
