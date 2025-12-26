/**
 * 文件操作工具
 * Read, Write, Edit
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { FileReadInput, FileWriteInput, FileEditInput, FileResult, ToolDefinition } from '../types/index.js';
import {
  readImageFile,
  readPdfFile,
  renderSvgToPng,
  detectMediaType,
  isBlacklistedFile,
  isSupportedImageFormat,
  isPdfExtension,
  isPdfSupported,
  isSvgRenderEnabled,
} from '../media/index.js';

/**
 * 差异预览接口
 */
interface DiffPreview {
  diff: string;
  additions: number;
  deletions: number;
  contextLines: number;
}

/**
 * 批量编辑接口
 */
interface BatchEdit {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * 扩展的编辑输入接口（包含批量编辑）
 */
interface ExtendedFileEditInput extends FileEditInput {
  batch_edits?: BatchEdit[];
  show_diff?: boolean;
  require_confirmation?: boolean;
}

export class ReadTool extends BaseTool<FileReadInput, FileResult> {
  name = 'Read';
  description = `Reads a file from the local filesystem.

Usage:
- The file_path parameter must be an absolute path
- By default, reads up to 2000 lines from the beginning
- You can optionally specify a line offset and limit
- Lines longer than 2000 characters will be truncated
- Results are returned with line numbers starting at 1
- Can read images (PNG, JPG), PDFs, and Jupyter notebooks`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'The line number to start reading from',
        },
        limit: {
          type: 'number',
          description: 'The number of lines to read',
        },
      },
      required: ['file_path'],
    };
  }

  async execute(input: FileReadInput): Promise<FileResult> {
    const { file_path, offset = 0, limit = 2000 } = input;

    try {
      if (!fs.existsSync(file_path)) {
        return { success: false, error: `File not found: ${file_path}` };
      }

      const stat = fs.statSync(file_path);
      if (stat.isDirectory()) {
        return { success: false, error: `Path is a directory: ${file_path}. Use ls command instead.` };
      }

      const ext = path.extname(file_path).toLowerCase().slice(1);

      // 检查是否在黑名单中
      if (isBlacklistedFile(file_path)) {
        return {
          success: false,
          error: `Cannot read binary file type: .${ext}. This file type is not supported.`
        };
      }

      // 检测媒体文件类型
      const mediaType = detectMediaType(file_path);

      // 处理图片
      if (mediaType === 'image') {
        return await this.readImageEnhanced(file_path);
      }

      // 处理 PDF
      if (mediaType === 'pdf') {
        return await this.readPdfEnhanced(file_path);
      }

      // 处理 SVG（可选渲染）
      if (mediaType === 'svg') {
        return await this.readSvg(file_path);
      }

      // 处理 Jupyter Notebook
      if (ext === 'ipynb') {
        return this.readNotebook(file_path);
      }

      // 读取文本文件
      const content = fs.readFileSync(file_path, 'utf-8');
      const lines = content.split('\n');
      const selectedLines = lines.slice(offset, offset + limit);

      // 格式化带行号的输出
      const maxLineNumWidth = String(offset + selectedLines.length).length;
      const output = selectedLines.map((line, idx) => {
        const lineNum = String(offset + idx + 1).padStart(maxLineNumWidth, ' ');
        const truncatedLine = line.length > 2000 ? line.substring(0, 2000) + '...' : line;
        return `${lineNum}\t${truncatedLine}`;
      }).join('\n');

      return {
        success: true,
        content: output,
        output,
        lineCount: lines.length,
      };
    } catch (err) {
      return { success: false, error: `Error reading file: ${err}` };
    }
  }

  /**
   * 增强的图片读取（使用媒体处理模块）
   */
  private async readImageEnhanced(filePath: string): Promise<FileResult> {
    try {
      const result = await readImageFile(filePath);
      const sizeKB = (result.file.originalSize / 1024).toFixed(2);
      const tokenEstimate = Math.ceil(result.file.base64.length * 0.125);

      let output = `[Image: ${filePath}]\n`;
      output += `Format: ${result.file.type}\n`;
      output += `Size: ${sizeKB} KB\n`;

      if (result.file.dimensions) {
        const { originalWidth, originalHeight, displayWidth, displayHeight } = result.file.dimensions;
        if (originalWidth && originalHeight) {
          output += `Original dimensions: ${originalWidth}x${originalHeight}\n`;
          if (displayWidth && displayHeight && (displayWidth !== originalWidth || displayHeight !== originalHeight)) {
            output += `Display dimensions: ${displayWidth}x${displayHeight} (resized)\n`;
          }
        }
      }

      output += `Estimated tokens: ${tokenEstimate}`;

      return {
        success: true,
        output,
        content: `data:${result.file.type};base64,${result.file.base64}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error reading image: ${error}`,
      };
    }
  }

  /**
   * 增强的 PDF 读取（使用媒体处理模块）
   *
   * 对应官方实现 (cli.js 第1027行附近):
   * - 返回 PDF 数据结构
   * - 添加 newMessages，将 PDF 作为 document 块发送给 Claude
   */
  private async readPdfEnhanced(filePath: string): Promise<FileResult> {
    try {
      // 检查 PDF 支持
      if (!isPdfSupported()) {
        return {
          success: false,
          error: 'PDF support is not enabled. Set CLAUDE_PDF_SUPPORT=true to enable.',
        };
      }

      const result = await readPdfFile(filePath);
      const sizeMB = (result.file.originalSize / 1048576).toFixed(2);

      let output = `[PDF Document: ${filePath}]\n`;
      output += `Size: ${sizeMB} MB\n`;
      output += `Base64 length: ${result.file.base64.length} chars\n`;

      // 关键：添加 newMessages，将 PDF 作为 document 发送给 Claude
      // 这对应官方实现中的 newMessages 数组
      return {
        success: true,
        output,
        content: result.file.base64,
        newMessages: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'document' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'application/pdf' as const,
                  data: result.file.base64,
                },
              },
            ],
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: `Error reading PDF: ${error}`,
      };
    }
  }

  /**
   * SVG 文件读取（可选渲染为 PNG）
   */
  private async readSvg(filePath: string): Promise<FileResult> {
    try {
      // 检查是否启用 SVG 渲染
      if (isSvgRenderEnabled()) {
        // 渲染为 PNG
        const result = await renderSvgToPng(filePath, {
          fitTo: { mode: 'width', value: 800 }
        });

        let output = `[SVG rendered to PNG: ${filePath}]\n`;
        output += `Format: ${result.file.type}\n`;
        if (result.file.dimensions) {
          output += `Dimensions: ${result.file.dimensions.displayWidth}x${result.file.dimensions.displayHeight}\n`;
        }

        return {
          success: true,
          output,
          content: `data:${result.file.type};base64,${result.file.base64}`,
        };
      } else {
        // 作为文本读取
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          success: true,
          output: `[SVG File: ${filePath}]\n`,
          content,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error reading SVG: ${error}`,
      };
    }
  }

  private readImage(filePath: string): FileResult {
    const base64 = fs.readFileSync(filePath).toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.gif' ? 'image/gif' :
                     ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return {
      success: true,
      output: `[Image: ${filePath}]\nBase64 data (${base64.length} chars)`,
      content: `data:${mimeType};base64,${base64}`,
    };
  }

  private readPdf(filePath: string): FileResult {
    // 简化版 PDF 读取
    return {
      success: true,
      output: `[PDF File: ${filePath}]\nPDF reading requires additional processing.`,
    };
  }

  private readNotebook(filePath: string): FileResult {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const notebook = JSON.parse(content);
      const cells = notebook.cells || [];

      let output = '';
      cells.forEach((cell: any, idx: number) => {
        const cellType = cell.cell_type || 'unknown';
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        output += `\n--- Cell ${idx + 1} (${cellType}) ---\n${source}\n`;
      });

      return { success: true, output, content };
    } catch (err) {
      return { success: false, error: `Error reading notebook: ${err}` };
    }
  }
}

export class WriteTool extends BaseTool<FileWriteInput, FileResult> {
  name = 'Write';
  description = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one
- You MUST use the Read tool first to read existing files
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation files unless requested`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    };
  }

  async execute(input: FileWriteInput): Promise<FileResult> {
    const { file_path, content } = input;

    try {
      // 确保目录存在
      const dir = path.dirname(file_path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(file_path, content, 'utf-8');

      const lines = content.split('\n').length;
      return {
        success: true,
        output: `Successfully wrote ${lines} lines to ${file_path}`,
        lineCount: lines,
      };
    } catch (err) {
      return { success: false, error: `Error writing file: ${err}` };
    }
  }
}

/**
 * 生成 Unified Diff 格式的差异预览
 */
function generateUnifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
  contextLines: number = 3
): DiffPreview {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // 找到所有不同的行
  const changes: Array<{ type: 'add' | 'delete' | 'equal'; line: string; oldIndex?: number; newIndex?: number }> = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      changes.push({ type: 'add', line: newLines[j], newIndex: j });
      j++;
    } else if (j >= newLines.length) {
      changes.push({ type: 'delete', line: oldLines[i], oldIndex: i });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      changes.push({ type: 'equal', line: oldLines[i], oldIndex: i, newIndex: j });
      i++;
      j++;
    } else {
      // 检测是修改还是插入/删除
      const isInNew = newLines.slice(j).includes(oldLines[i]);
      const isInOld = oldLines.slice(i).includes(newLines[j]);

      if (!isInNew) {
        changes.push({ type: 'delete', line: oldLines[i], oldIndex: i });
        i++;
      } else if (!isInOld) {
        changes.push({ type: 'add', line: newLines[j], newIndex: j });
        j++;
      } else {
        // 都存在，按照距离判断
        const distNew = newLines.slice(j).indexOf(oldLines[i]);
        const distOld = oldLines.slice(i).indexOf(newLines[j]);

        if (distNew <= distOld) {
          changes.push({ type: 'add', line: newLines[j], newIndex: j });
          j++;
        } else {
          changes.push({ type: 'delete', line: oldLines[i], oldIndex: i });
          i++;
        }
      }
    }
  }

  // 生成 unified diff 格式
  let diff = '';
  diff += `--- a/${path.basename(filePath)}\n`;
  diff += `+++ b/${path.basename(filePath)}\n`;

  // 查找变化块（hunks）
  const hunks: Array<{ start: number; end: number }> = [];
  for (let idx = 0; idx < changes.length; idx++) {
    if (changes[idx].type !== 'equal') {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(changes.length - 1, idx + contextLines);

      if (hunks.length === 0 || start > hunks[hunks.length - 1].end + 1) {
        hunks.push({ start, end });
      } else {
        hunks[hunks.length - 1].end = end;
      }
    }
  }

  let additions = 0;
  let deletions = 0;

  // 生成每个 hunk
  for (const hunk of hunks) {
    const hunkChanges = changes.slice(hunk.start, hunk.end + 1);

    // 计算 hunk 头部的行号范围
    let oldStart = 0;
    let oldCount = 0;
    let newStart = 0;
    let newCount = 0;

    for (const change of hunkChanges) {
      if (change.type === 'delete' || change.type === 'equal') {
        if (oldCount === 0 && change.oldIndex !== undefined) {
          oldStart = change.oldIndex + 1;
        }
        oldCount++;
      }
      if (change.type === 'add' || change.type === 'equal') {
        if (newCount === 0 && change.newIndex !== undefined) {
          newStart = change.newIndex + 1;
        }
        newCount++;
      }
    }

    diff += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;

    // 生成 hunk 内容
    for (const change of hunkChanges) {
      if (change.type === 'equal') {
        diff += ` ${change.line}\n`;
      } else if (change.type === 'delete') {
        diff += `-${change.line}\n`;
        deletions++;
      } else if (change.type === 'add') {
        diff += `+${change.line}\n`;
        additions++;
      }
    }
  }

  return {
    diff,
    additions,
    deletions,
    contextLines,
  };
}

/**
 * 备份文件内容（用于回滚）
 */
class FileBackup {
  private backups: Map<string, string> = new Map();

  backup(filePath: string, content: string): void {
    this.backups.set(filePath, content);
  }

  restore(filePath: string): boolean {
    const content = this.backups.get(filePath);
    if (content === undefined) {
      return false;
    }
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.backups.clear();
  }

  has(filePath: string): boolean {
    return this.backups.has(filePath);
  }
}

export class EditTool extends BaseTool<ExtendedFileEditInput, FileResult> {
  name = 'Edit';
  description = `Performs exact string replacements in files with diff preview.

Usage:
- You must use Read tool at least once before editing
- Preserve exact indentation as it appears in the file
- The edit will FAIL if old_string is not unique
- Use replace_all for replacing all occurrences
- Use batch_edits for atomic multi-edit operations
- Set show_diff=true to preview changes before applying`;

  private fileBackup = new FileBackup();

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to modify',
        },
        old_string: {
          type: 'string',
          description: 'The text to replace',
        },
        new_string: {
          type: 'string',
          description: 'The text to replace it with',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default false)',
          default: false,
        },
        batch_edits: {
          type: 'array',
          description: 'Array of edit operations to perform atomically. If any edit fails, all changes are rolled back.',
          items: {
            type: 'object',
            properties: {
              old_string: { type: 'string' },
              new_string: { type: 'string' },
              replace_all: { type: 'boolean', default: false },
            },
            required: ['old_string', 'new_string'],
          },
        },
        show_diff: {
          type: 'boolean',
          description: 'Show unified diff preview of changes (default true)',
          default: true,
        },
        require_confirmation: {
          type: 'boolean',
          description: 'Require user confirmation before applying changes (default false)',
          default: false,
        },
      },
      required: ['file_path'],
    };
  }

  async execute(input: ExtendedFileEditInput): Promise<FileResult> {
    const {
      file_path,
      old_string,
      new_string,
      replace_all = false,
      batch_edits,
      show_diff = true,
      require_confirmation = false,
    } = input;

    try {
      if (!fs.existsSync(file_path)) {
        return { success: false, error: `File not found: ${file_path}` };
      }

      const stat = fs.statSync(file_path);
      if (stat.isDirectory()) {
        return { success: false, error: `Path is a directory: ${file_path}` };
      }

      const originalContent = fs.readFileSync(file_path, 'utf-8');

      // 备份原始内容
      this.fileBackup.backup(file_path, originalContent);

      // 确定编辑操作列表
      const edits: BatchEdit[] = batch_edits || [{ old_string: old_string!, new_string: new_string!, replace_all }];

      // 验证所有编辑操作
      let currentContent = originalContent;
      const validationErrors: string[] = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];

        if (!currentContent.includes(edit.old_string)) {
          validationErrors.push(`Edit ${i + 1}: old_string not found in file`);
          continue;
        }

        // 如果不是 replace_all，检查唯一性
        if (!edit.replace_all) {
          const matches = currentContent.split(edit.old_string).length - 1;
          if (matches > 1) {
            validationErrors.push(
              `Edit ${i + 1}: old_string appears ${matches} times. Use replace_all=true or provide more context.`
            );
            continue;
          }
        }

        // 应用编辑（用于验证后续编辑）
        if (edit.replace_all) {
          currentContent = currentContent.split(edit.old_string).join(edit.new_string);
        } else {
          currentContent = currentContent.replace(edit.old_string, edit.new_string);
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed:\n${validationErrors.join('\n')}`,
        };
      }

      const modifiedContent = currentContent;

      // 生成差异预览
      let diffPreview: DiffPreview | null = null;
      if (show_diff) {
        diffPreview = generateUnifiedDiff(file_path, originalContent, modifiedContent);
      }

      // 检查是否需要确认
      if (require_confirmation) {
        return {
          success: false,
          error: 'Confirmation required before applying changes',
          output: diffPreview ? this.formatDiffOutput(diffPreview) : undefined,
        };
      }

      // 执行实际的文件写入
      try {
        fs.writeFileSync(file_path, modifiedContent, 'utf-8');

        // 构建输出消息
        let output = '';

        if (batch_edits) {
          output += `Successfully applied ${edits.length} edit(s) to ${file_path}\n`;
        } else {
          output += `Successfully edited ${file_path}\n`;
        }

        if (diffPreview) {
          output += '\n' + this.formatDiffOutput(diffPreview);
        }

        // 清除备份
        this.fileBackup.clear();

        return {
          success: true,
          output,
          content: modifiedContent,
        };
      } catch (writeErr) {
        // 写入失败，尝试回滚
        this.fileBackup.restore(file_path);
        return {
          success: false,
          error: `Error writing file: ${writeErr}. Changes have been rolled back.`,
        };
      }
    } catch (err) {
      // 发生错误，尝试回滚
      if (this.fileBackup.has(file_path)) {
        this.fileBackup.restore(file_path);
      }
      return {
        success: false,
        error: `Error editing file: ${err}. Changes have been rolled back.`,
      };
    }
  }

  /**
   * 格式化差异输出
   */
  private formatDiffOutput(diffPreview: DiffPreview): string {
    const { diff, additions, deletions } = diffPreview;
    let output = '';
    output += `Changes: +${additions} -${deletions}\n`;
    output += '─'.repeat(60) + '\n';
    output += diff;
    output += '─'.repeat(60);
    return output;
  }
}
