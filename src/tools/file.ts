/**
 * 文件操作工具
 * Read, Write, Edit
 *
 * 对应官方实现 (cli.js):
 * - m2A 函数: 智能字符串匹配，处理智能引号
 * - lY2 函数: 字符串替换逻辑
 * - GG1/VSA 函数: Edit 验证和执行
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { FileReadInput, FileWriteInput, FileEditInput, FileResult, EditToolResult, ToolDefinition } from '../types/index.js';
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

/**
 * 文件读取记录接口
 */
interface FileReadRecord {
  path: string;
  readTime: number;  // 读取时的时间戳
  mtime: number;     // 读取时的文件修改时间（mtimeMs）
}

/**
 * 全局文件读取跟踪器
 * 用于验证在编辑文件之前是否已读取该文件
 * 并跟踪文件的 mtime 以检测外部修改
 */
class FileReadTracker {
  private static instance: FileReadTracker;
  private readFiles: Map<string, FileReadRecord> = new Map();

  static getInstance(): FileReadTracker {
    if (!FileReadTracker.instance) {
      FileReadTracker.instance = new FileReadTracker();
    }
    return FileReadTracker.instance;
  }

  markAsRead(filePath: string, mtime: number): void {
    // 规范化路径
    const normalizedPath = path.resolve(filePath);
    const record: FileReadRecord = {
      path: normalizedPath,
      readTime: Date.now(),
      mtime,
    };
    this.readFiles.set(normalizedPath, record);
  }

  hasBeenRead(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    return this.readFiles.has(normalizedPath);
  }

  getRecord(filePath: string): FileReadRecord | undefined {
    const normalizedPath = path.resolve(filePath);
    return this.readFiles.get(normalizedPath);
  }

  clear(): void {
    this.readFiles.clear();
  }
}

// 导出跟踪器供外部使用
export const fileReadTracker = FileReadTracker.getInstance();

/**
 * 智能引号字符映射
 * 对应官方 cli.js 中的 RI5, _I5, jI5, TI5 常量
 */
const SMART_QUOTE_MAP: Record<string, string> = {
  '\u2018': "'",  // 左单引号 '
  '\u2019': "'",  // 右单引号 '
  '\u201C': '"',  // 左双引号 "
  '\u201D': '"',  // 右双引号 "
};

/**
 * 将智能引号转换为普通引号
 * 对应官方 cli.js 中的 cY2 函数
 */
function normalizeQuotes(str: string): string {
  let result = str;
  for (const [smart, normal] of Object.entries(SMART_QUOTE_MAP)) {
    result = result.replaceAll(smart, normal);
  }
  return result;
}

/**
 * 清理字符串中的尾部空白（保持行结构）
 * 对应官方 cli.js 中的 VJ0 函数
 */
function cleanTrailingWhitespace(str: string): string {
  const parts = str.split(/(\r\n|\n|\r)/);
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part !== undefined) {
      if (i % 2 === 0) {
        // 文本部分，清理尾部空白
        result += part.replace(/\s+$/, '');
      } else {
        // 换行符部分，保持原样
        result += part;
      }
    }
  }
  return result;
}

/**
 * 智能字符串匹配函数
 * 对应官方 cli.js 中的 m2A 函数
 *
 * 功能：
 * 1. 直接匹配
 * 2. 智能引号转换后匹配
 * 3. 返回实际匹配的字符串（保持原始格式）
 */
function findMatchingString(fileContents: string, searchString: string): string | null {
  // 直接匹配
  if (fileContents.includes(searchString)) {
    return searchString;
  }

  // 尝试智能引号转换
  const normalizedSearch = normalizeQuotes(searchString);
  const normalizedContents = normalizeQuotes(fileContents);
  const index = normalizedContents.indexOf(normalizedSearch);

  if (index !== -1) {
    // 返回原始文件中对应位置的字符串
    return fileContents.substring(index, index + searchString.length);
  }

  return null;
}

/**
 * 检测行号前缀模式
 * Read 工具输出格式: "  123\tcode content"
 * 即: 空格 + 行号 + 制表符 + 实际内容
 */
const LINE_NUMBER_PREFIX_PATTERN = /^(\s*\d+)\t/;

/**
 * 移除字符串中的行号前缀
 * 用于处理从 Read 工具输出中复制的内容
 */
function stripLineNumberPrefixes(str: string): string {
  return str.split('\n').map(line => {
    const match = line.match(LINE_NUMBER_PREFIX_PATTERN);
    if (match) {
      // 移除行号前缀（包括制表符）
      return line.substring(match[0].length);
    }
    return line;
  }).join('\n');
}

/**
 * 检测字符串是否包含行号前缀
 */
function hasLineNumberPrefixes(str: string): boolean {
  const lines = str.split('\n');
  // 检查是否有多行都包含行号前缀模式
  let prefixCount = 0;
  for (const line of lines) {
    if (LINE_NUMBER_PREFIX_PATTERN.test(line)) {
      prefixCount++;
    }
  }
  // 如果超过一半的行有行号前缀，则认为需要处理
  return prefixCount > 0 && prefixCount >= lines.length / 2;
}

/**
 * 智能查找并匹配字符串
 * 支持：
 * 1. 直接匹配
 * 2. 智能引号匹配
 * 3. 行号前缀处理
 * 4. 尾部换行处理
 */
function smartFindString(fileContents: string, searchString: string): string | null {
  // 1. 直接匹配
  let match = findMatchingString(fileContents, searchString);
  if (match) return match;

  // 2. 尝试移除行号前缀后匹配
  if (hasLineNumberPrefixes(searchString)) {
    const strippedSearch = stripLineNumberPrefixes(searchString);
    match = findMatchingString(fileContents, strippedSearch);
    if (match) return match;
  }

  // 3. 处理尾部换行
  // 如果搜索字符串不以换行结尾，但文件中该位置后面有换行
  if (!searchString.endsWith('\n') && fileContents.includes(searchString + '\n')) {
    return searchString;
  }

  return null;
}

/**
 * 执行字符串替换
 * 对应官方 cli.js 中的 lY2 函数
 */
function replaceString(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): string {
  if (replaceAll) {
    return content.replaceAll(oldString, newString);
  }

  // 处理空 new_string 的特殊情况
  if (newString === '') {
    // 如果 old_string 不以换行结尾，但在文件中后面跟着换行
    // 则应该也删除那个换行
    if (!oldString.endsWith('\n') && content.includes(oldString + '\n')) {
      return content.replace(oldString + '\n', newString);
    }
  }

  return content.replace(oldString, newString);
}

export class ReadTool extends BaseTool<FileReadInput, FileResult> {
  name = 'Read';
  description = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n format, with line numbers starting at 1
- This tool allows Claude Code to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Claude Code is a multimodal LLM.
- This tool can read PDF files (.pdf). PDFs are processed page by page, extracting both text and visual content for analysis.
- This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.
- This tool can only read files, not directories. To read a directory, use an ls command via the Bash tool.
- You can call multiple tools in a single response. It is always better to speculatively read multiple potentially useful files in parallel.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot, ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`;

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

      // 标记文件已被读取（用于 Edit 工具验证），记录 mtime
      fileReadTracker.markAsRead(file_path, stat.mtimeMs);

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
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`;

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

/**
 * Edit 验证错误码
 * 对应官方 cli.js 中的 errorCode
 */
enum EditErrorCode {
  NO_CHANGE = 1,              // 文件内容无变化
  PATH_DENIED = 2,            // 路径权限被拒绝
  FILE_EXISTS = 3,            // 文件已存在（创建新文件时）
  FILE_NOT_FOUND = 4,         // 文件不存在
  IS_NOTEBOOK = 5,            // 是 Jupyter Notebook 文件
  NOT_READ = 6,               // 文件未被读取
  EXTERNALLY_MODIFIED = 7,    // 文件在读取后被外部修改
  STRING_NOT_FOUND = 8,       // 字符串未找到
  MULTIPLE_MATCHES = 9,       // 找到多个匹配
  FILE_NOT_READ = 10,         // 文件未被读取（兼容旧代码）
  INVALID_PATH = 11,          // 无效路径
}

export class EditTool extends BaseTool<ExtendedFileEditInput, EditToolResult> {
  name = 'Edit';
  description = `Performs exact string replacements in files.

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`;

  private fileBackup = new FileBackup();
  /** 是否强制要求先读取文件（可通过环境变量配置） */
  private requireFileRead: boolean = process.env.CLAUDE_EDIT_REQUIRE_READ !== 'false';

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
          description: 'The text to replace it with (must be different from old_string)',
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
      required: ['file_path', 'old_string', 'new_string'],
    };
  }

  async execute(input: ExtendedFileEditInput): Promise<EditToolResult> {
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
      // 1. 验证路径是绝对路径
      if (!path.isAbsolute(file_path)) {
        return {
          success: false,
          error: `File path must be absolute. Received: ${file_path}`,
          errorCode: EditErrorCode.INVALID_PATH,
        };
      }

      // 2. 验证文件是否已被读取（如果启用了此检查）
      if (this.requireFileRead && !fileReadTracker.hasBeenRead(file_path)) {
        return {
          success: false,
          error: `You must read the file with the Read tool before editing it. File: ${file_path}`,
          errorCode: EditErrorCode.NOT_READ,
        };
      }

      // 3. 检查文件是否存在
      if (!fs.existsSync(file_path)) {
        // 特殊情况：如果 old_string 为空，视为创建新文件
        if (old_string === '' && new_string !== undefined) {
          return this.createNewFile(file_path, new_string);
        }
        return { success: false, error: `File not found: ${file_path}` };
      }

      const stat = fs.statSync(file_path);
      if (stat.isDirectory()) {
        return { success: false, error: `Path is a directory: ${file_path}` };
      }

      // 4. 检查文件是否在读取后被外部修改
      const readRecord = fileReadTracker.getRecord(file_path);
      if (readRecord && stat.mtimeMs > readRecord.mtime) {
        return {
          success: false,
          error: 'File has been modified since it was read. Please read the file again to see the latest changes before editing.',
          errorCode: EditErrorCode.EXTERNALLY_MODIFIED,
        };
      }

      // 5. 读取原始内容
      const originalContent = fs.readFileSync(file_path, 'utf-8');

      // 6. 特殊情况：old_string 为空表示写入/覆盖整个文件
      if (old_string === '') {
        return this.writeEntireFile(file_path, new_string ?? '', originalContent, show_diff);
      }

      // 7. 备份原始内容
      this.fileBackup.backup(file_path, originalContent);

      // 8. 确定编辑操作列表
      const edits: BatchEdit[] = batch_edits || [{ old_string: old_string!, new_string: new_string!, replace_all }];

      // 9. 验证并执行所有编辑操作
      let currentContent = originalContent;
      const appliedEdits: string[] = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];

        // 9.1 智能查找匹配字符串
        const matchedString = smartFindString(currentContent, edit.old_string);

        if (!matchedString) {
          // 字符串未找到
          return {
            success: false,
            error: `String to replace not found in file.\nString: ${edit.old_string}`,
            errorCode: EditErrorCode.STRING_NOT_FOUND,
          };
        }

        // 9.2 计算匹配次数
        const matchCount = currentContent.split(matchedString).length - 1;

        // 9.3 如果不是 replace_all，检查唯一性
        if (matchCount > 1 && !edit.replace_all) {
          return {
            success: false,
            error: `Found ${matchCount} matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.\nString: ${edit.old_string}`,
            errorCode: EditErrorCode.MULTIPLE_MATCHES,
          };
        }

        // 9.4 检查 old_string 和 new_string 是否相同
        if (matchedString === edit.new_string) {
          continue; // 跳过无变化的编辑
        }

        // 9.5 检查是否会与之前的 new_string 冲突
        for (const prevEdit of appliedEdits) {
          if (matchedString !== '' && prevEdit.includes(matchedString)) {
            return {
              success: false,
              error: `Cannot edit file: old_string is a substring of a new_string from a previous edit.\nold_string: ${matchedString}`,
            };
          }
        }

        // 9.6 应用编辑
        currentContent = replaceString(currentContent, matchedString, edit.new_string, edit.replace_all);
        appliedEdits.push(edit.new_string);
      }

      // 10. 检查是否有实际变化
      if (currentContent === originalContent) {
        return {
          success: false,
          error: 'Original and edited file match exactly. No changes were made.',
        };
      }

      const modifiedContent = currentContent;

      // 11. 生成差异预览
      let diffPreview: DiffPreview | null = null;
      if (show_diff) {
        diffPreview = generateUnifiedDiff(file_path, originalContent, modifiedContent);
      }

      // 12. 检查是否需要确认
      if (require_confirmation) {
        return {
          success: false,
          error: 'Confirmation required before applying changes',
          output: diffPreview ? this.formatDiffOutput(diffPreview) : undefined,
        };
      }

      // 13. 执行实际的文件写入
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
   * 创建新文件
   * 当 old_string 为空且文件不存在时调用
   */
  private createNewFile(filePath: string, content: string): EditToolResult {
    try {
      // 确保父目录存在
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');

      const lineCount = content.split('\n').length;
      return {
        success: true,
        output: `Successfully created new file: ${filePath} (${lineCount} lines)`,
        content,
      };
    } catch (err) {
      return {
        success: false,
        error: `Error creating file: ${err}`,
      };
    }
  }

  /**
   * 写入整个文件（覆盖现有内容）
   * 当 old_string 为空且文件存在时调用
   */
  private writeEntireFile(
    filePath: string,
    newContent: string,
    originalContent: string,
    showDiff: boolean
  ): EditToolResult {
    try {
      // 备份原始内容
      this.fileBackup.backup(filePath, originalContent);

      // 检查内容是否相同
      if (newContent === originalContent) {
        return {
          success: false,
          error: 'Original and new content match exactly. No changes were made.',
        };
      }

      // 生成差异预览
      let diffPreview: DiffPreview | null = null;
      if (showDiff) {
        diffPreview = generateUnifiedDiff(filePath, originalContent, newContent);
      }

      // 写入文件
      fs.writeFileSync(filePath, newContent, 'utf-8');

      // 构建输出消息
      let output = `Successfully wrote to ${filePath}\n`;
      if (diffPreview) {
        output += '\n' + this.formatDiffOutput(diffPreview);
      }

      // 清除备份
      this.fileBackup.clear();

      return {
        success: true,
        output,
        content: newContent,
      };
    } catch (err) {
      // 写入失败，尝试回滚
      this.fileBackup.restore(filePath);
      return {
        success: false,
        error: `Error writing file: ${err}. Changes have been rolled back.`,
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
