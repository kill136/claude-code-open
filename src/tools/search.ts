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
          description: 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults based on "cap" experiment value: 0 (unlimited), 20, or 100.',
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
      // 验证参数
      if (offset < 0) {
        return { success: false, error: 'offset must be non-negative' };
      }
      if (head_limit !== undefined && head_limit < 0) {
        return { success: false, error: 'head_limit must be non-negative' };
      }

      // 上下文参数只在 content 模式下有效
      if (output_mode !== 'content') {
        if (beforeContext !== undefined || afterContext !== undefined || context !== undefined) {
          return { success: false, error: 'Context options (-A/-B/-C) require output_mode: "content"' };
        }
        if (showLineNumbers !== true && showLineNumbers !== undefined) {
          return { success: false, error: 'Line numbers (-n) require output_mode: "content"' };
        }
      }

      // 构建 ripgrep 命令
      const args: string[] = [];

      // 输出模式
      if (output_mode === 'files_with_matches') {
        args.push('-l');
      } else if (output_mode === 'count') {
        args.push('-c');
      }

      // 选项
      if (ignoreCase) args.push('-i');
      if (showLineNumbers && output_mode === 'content') args.push('-n');
      if (multiline) {
        args.push('-U', '--multiline-dotall');
      }
      if (beforeContext && output_mode === 'content') args.push('-B', String(beforeContext));
      if (afterContext && output_mode === 'content') args.push('-A', String(afterContext));
      if (context && output_mode === 'content') args.push('-C', String(context));
      if (globPattern) args.push('--glob', globPattern);
      if (fileType) args.push('--type', fileType);

      args.push('--', pattern, searchPath);

      const cmd = `rg ${args.map(a => `'${a}'`).join(' ')} 2>/dev/null || true`;

      let output = execSync(cmd, {
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
      });

      // 应用 offset 和 head_limit
      // 这些参数在所有 output_mode 下都应该工作
      if (offset > 0 || head_limit !== undefined) {
        const lines = output.split('\n').filter(line => line.length > 0);

        // 跳过前 offset 行
        let processedLines = lines;
        if (offset > 0) {
          processedLines = lines.slice(offset);
        }

        // 限制为前 head_limit 行
        if (head_limit !== undefined && head_limit >= 0) {
          processedLines = processedLines.slice(0, head_limit);
        }

        output = processedLines.join('\n');
      }

      const trimmedOutput = output.trim();
      if (!trimmedOutput) {
        return { success: true, output: 'No matches found.' };
      }

      return { success: true, output: trimmedOutput };
    } catch (err) {
      // 如果 rg 不可用，回退到 grep
      return this.fallbackGrep(input);
    }
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
      const cmd = `grep ${flags} '${pattern}' '${searchPath}' 2>/dev/null || true`;
      let output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

      // 应用 offset 和 head_limit（与主方法保持一致）
      if (offset > 0 || head_limit !== undefined) {
        const lines = output.split('\n').filter(line => line.length > 0);

        let processedLines = lines;
        if (offset > 0) {
          processedLines = lines.slice(offset);
        }

        if (head_limit !== undefined && head_limit >= 0) {
          processedLines = processedLines.slice(0, head_limit);
        }

        output = processedLines.join('\n');
      }

      const trimmedOutput = output.trim();
      return { success: true, output: trimmedOutput || 'No matches found.' };
    } catch (err) {
      return { success: false, error: `Grep error: ${err}` };
    }
  }
}
