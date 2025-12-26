/**
 * 搜索工具
 * Glob 和 Grep
 */

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { BaseTool } from './base.js';
import type { GlobInput, GrepInput, ToolResult, ToolDefinition } from '../types/index.js';

export class GlobTool extends BaseTool<GlobInput, ToolResult> {
  name = 'Glob';
  description = `Fast file pattern matching tool that works with any codebase size.

- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern to match files against',
        },
        path: {
          type: 'string',
          description: 'The directory to search in. Defaults to current working directory.',
        },
      },
      required: ['pattern'],
    };
  }

  async execute(input: GlobInput): Promise<ToolResult> {
    const { pattern, path: searchPath = process.cwd() } = input;

    try {
      const files = await glob(pattern, {
        cwd: searchPath,
        absolute: true,
        nodir: true,
        dot: true,
      });

      // 按修改时间排序
      const sortedFiles = files
        .map(file => ({
          file,
          mtime: fs.existsSync(file) ? fs.statSync(file).mtime.getTime() : 0,
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .map(item => item.file);

      if (sortedFiles.length === 0) {
        return { success: true, output: 'No files found matching the pattern.' };
      }

      const output = sortedFiles.join('\n');
      return { success: true, output };
    } catch (err) {
      return { success: false, error: `Glob error: ${err}` };
    }
  }
}

export class GrepTool extends BaseTool<GrepInput, ToolResult> {
  name = 'Grep';
  description = `A powerful search tool built on ripgrep

Usage:
  - ALWAYS use Grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a Bash command. The Grep tool has been optimized for correct permissions and access.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Use Task tool for open-ended searches requiring multiple rounds
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\`
`;

  // Directories to exclude from search
  private excludedDirs = ['.git', '.svn', '.hg', '.bzr'];

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regular expression pattern to search for in file contents',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in (rg PATH). Defaults to current working directory.',
        },
        glob: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
        },
        type: {
          type: 'string',
          description: 'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
        },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
        },
        '-i': {
          type: 'boolean',
          description: 'Case insensitive search (rg -i)',
        },
        '-n': {
          type: 'boolean',
          description: 'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
        },
        '-B': {
          type: 'number',
          description: 'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
        },
        '-A': {
          type: 'number',
          description: 'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
        },
        '-C': {
          type: 'number',
          description: 'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
        },
        multiline: {
          type: 'boolean',
          description: 'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
        },
        head_limit: {
          type: 'number',
          description: 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 0 (unlimited).',
        },
        offset: {
          type: 'number',
          description: 'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
        },
      },
      required: ['pattern'],
    };
  }

  async execute(input: GrepInput): Promise<ToolResult> {
    const {
      pattern,
      path: searchPath = process.cwd(),
      glob: globPattern,
      output_mode = 'files_with_matches',
      '-B': beforeContext,
      '-A': afterContext,
      '-C': context,
      '-n': showLineNumbers = true,
      '-i': ignoreCase,
      type: fileType,
      head_limit,
      offset = 0,
      multiline,
    } = input;

    try {
      // 构建 ripgrep 命令
      const args: string[] = ['--hidden'];

      // 排除特定目录
      for (const dir of this.excludedDirs) {
        args.push('--glob', `!${dir}`);
      }

      // 限制每行最大列数
      args.push('--max-columns', '500');

      // 多行模式
      if (multiline) {
        args.push('-U', '--multiline-dotall');
      }

      // 大小写不敏感
      if (ignoreCase) {
        args.push('-i');
      }

      // 输出模式
      if (output_mode === 'files_with_matches') {
        args.push('-l');
      } else if (output_mode === 'count') {
        args.push('-c');
      }

      // 行号 (仅在 content 模式下)
      if (showLineNumbers && output_mode === 'content') {
        args.push('-n');
      }

      // 上下文行 (仅在 content 模式下)
      if (output_mode === 'content') {
        if (context !== undefined) {
          args.push('-C', String(context));
        } else {
          if (beforeContext !== undefined) {
            args.push('-B', String(beforeContext));
          }
          if (afterContext !== undefined) {
            args.push('-A', String(afterContext));
          }
        }
      }

      // Pattern (如果以 - 开头，需要使用 -e 前缀)
      if (pattern.startsWith('-')) {
        args.push('-e', pattern);
      } else {
        args.push(pattern);
      }

      // 文件类型
      if (fileType) {
        args.push('--type', fileType);
      }

      // Glob 模式 - 需要处理空格和逗号分割
      if (globPattern) {
        const globs: string[] = [];
        const parts = globPattern.split(/\s+/);

        for (const part of parts) {
          if (part.includes('{') && part.includes('}')) {
            // 保留 brace expansion 格式，如 "*.{ts,tsx}"
            globs.push(part);
          } else {
            // 按逗号分割
            globs.push(...part.split(',').filter(Boolean));
          }
        }

        for (const g of globs.filter(Boolean)) {
          args.push('--glob', g);
        }
      }

      // 搜索路径
      args.push(searchPath);

      const cmd = `rg ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')} 2>/dev/null || true`;

      let output = execSync(cmd, {
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
      });

      let lines = output.split('\n').filter(line => line.length > 0);

      // 对于 files_with_matches 模式，按修改时间排序
      if (output_mode === 'files_with_matches' && lines.length > 0) {
        const filesWithStats = await Promise.all(
          lines.map(async file => {
            try {
              const stats = await fs.promises.stat(file);
              return { file, mtime: stats.mtimeMs };
            } catch {
              return { file, mtime: 0 };
            }
          })
        );

        filesWithStats.sort((a, b) => {
          const mtimeDiff = b.mtime - a.mtime;
          if (mtimeDiff === 0) {
            return a.file.localeCompare(b.file);
          }
          return mtimeDiff;
        });

        lines = filesWithStats.map(item => item.file);
      }

      // 对于 content 模式，将文件路径转换为相对路径
      if (output_mode === 'content') {
        lines = lines.map(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const filePath = line.substring(0, colonIndex);
            const rest = line.substring(colonIndex);
            const relativePath = this.toRelativePath(filePath);
            return relativePath + rest;
          }
          return line;
        });
      }

      // 对于 count 模式，也转换文件路径
      if (output_mode === 'count') {
        lines = lines.map(line => {
          const colonIndex = line.lastIndexOf(':');
          if (colonIndex > 0) {
            const filePath = line.substring(0, colonIndex);
            const rest = line.substring(colonIndex);
            const relativePath = this.toRelativePath(filePath);
            return relativePath + rest;
          }
          return line;
        });
      }

      // 对于 files_with_matches 模式，转换为相对路径
      if (output_mode === 'files_with_matches') {
        lines = lines.map(file => this.toRelativePath(file));
      }

      // 应用 offset 和 head_limit
      lines = this.applyOffsetAndLimit(lines, head_limit, offset);

      const result = lines.join('\n');
      if (!result) {
        return { success: true, output: 'No matches found.' };
      }

      return { success: true, output: result };
    } catch (err) {
      // 如果 rg 不可用，回退到 grep
      return this.fallbackGrep(input);
    }
  }

  /**
   * 将绝对路径转换为相对路径
   * 如果相对路径以 ".." 开头，则返回绝对路径
   */
  private toRelativePath(absolutePath: string): string {
    const cwd = process.cwd();
    const relativePath = path.relative(cwd, absolutePath);
    return relativePath.startsWith('..') ? absolutePath : relativePath;
  }

  /**
   * 应用 offset 和 head_limit
   */
  private applyOffsetAndLimit(lines: string[], limit?: number, offset: number = 0): string[] {
    if (limit === undefined) {
      return lines.slice(offset);
    }
    return lines.slice(offset, offset + limit);
  }

  private fallbackGrep(input: GrepInput): ToolResult {
    const {
      pattern,
      path: searchPath = process.cwd(),
      '-i': ignoreCase,
      head_limit,
      offset = 0,
    } = input;

    try {
      const flags = ignoreCase ? '-rni' : '-rn';
      const cmd = `grep ${flags} '${pattern.replace(/'/g, "'\\''")}' '${searchPath.replace(/'/g, "'\\''")}' 2>/dev/null || true`;
      let output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

      let lines = output.split('\n').filter(line => line.length > 0);

      // 转换文件路径为相对路径
      lines = lines.map(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const filePath = line.substring(0, colonIndex);
          const rest = line.substring(colonIndex);
          const relativePath = this.toRelativePath(filePath);
          return relativePath + rest;
        }
        return line;
      });

      // 应用 offset 和 head_limit
      lines = this.applyOffsetAndLimit(lines, head_limit, offset);

      const result = lines.join('\n');
      return { success: true, output: result || 'No matches found.' };
    } catch (err) {
      return { success: false, error: `Grep error: ${err}` };
    }
  }
}
