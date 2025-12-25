/**
 * MultiEdit 工具
 * 批量编辑文件，一次性进行多个替换
 * 实现事务机制：所有编辑要么全部成功，要么全部回滚
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

interface EditOperation {
  old_string: string;
  new_string: string;
}

interface MultiEditInput {
  file_path: string;
  edits: EditOperation[];
}

interface EditResult {
  index: number;
  success: boolean;
  message: string;
  startPos?: number;
  endPos?: number;
}

interface ConflictInfo {
  edit1Index: number;
  edit2Index: number;
  description: string;
}

export class MultiEditTool extends BaseTool<MultiEditInput, ToolResult> {
  name = 'MultiEdit';
  description = `Performs multiple exact string replacements in a single file with full transaction support.

TRANSACTION MECHANISM:
- Creates automatic backup before any changes
- All edits either succeed together or fail together (atomic transaction)
- Automatic rollback on any failure - file is restored from backup
- Conflict detection between edits before execution
- Detailed error reporting showing which edit failed and why

FEATURES:
- More efficient than multiple single Edit calls
- Detects overlapping edits and potential conflicts
- Validates all edits before applying any changes
- Tracks position and impact of each edit
- Comprehensive statistics on changes made

CONFLICT DETECTION:
- Detects overlapping edit regions in the file
- Identifies potential nested replacement issues
- Prevents edits that would interfere with each other

ERROR HANDLING:
- Any validation failure rolls back the transaction
- File write errors trigger automatic restore from backup
- Critical errors preserve backup file for manual recovery
- Clear error messages indicate which edit failed

IMPORTANT RULES:
- You must have read the file before editing (same as Edit tool)
- Each old_string must be unique in the file
- Preserve exact indentation from the original file
- Empty old_string values are not allowed
- old_string and new_string must be different

Example usage:
{
  "file_path": "/path/to/file.ts",
  "edits": [
    { "old_string": "const x = 1", "new_string": "const x = 2" },
    { "old_string": "function foo()", "new_string": "function bar()" }
  ]
}

TRANSACTION PHASES:
1. Input validation
2. Backup creation (file.backup.timestamp)
3. Conflict detection between edits
4. Sequential validation of all edits
5. Sequential execution of all edits
6. File write with error handling
7. Backup cleanup on success
8. Automatic rollback on any failure`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to modify',
        },
        edits: {
          type: 'array',
          description: 'Array of edit operations to perform',
          items: {
            type: 'object',
            properties: {
              old_string: {
                type: 'string',
                description: 'The text to replace',
              },
              new_string: {
                type: 'string',
                description: 'The replacement text',
              },
            },
            required: ['old_string', 'new_string'],
          },
        },
      },
      required: ['file_path', 'edits'],
    };
  }

  /**
   * 创建文件备份
   */
  private createBackup(filePath: string): string {
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup.${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * 从备份恢复文件
   */
  private restoreFromBackup(filePath: string, backupPath: string): void {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
    }
  }

  /**
   * 删除备份文件
   */
  private deleteBackup(backupPath: string): void {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  }

  /**
   * 检测编辑之间的冲突
   * 如果两个编辑的 old_string 有重叠，或者一个编辑会影响另一个编辑的位置，则存在冲突
   */
  private detectConflicts(content: string, edits: EditOperation[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const editPositions: Array<{ index: number; start: number; end: number; old: string; new: string }> = [];

    // 找到每个编辑在原始内容中的位置
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const startPos = content.indexOf(edit.old_string);

      if (startPos !== -1) {
        editPositions.push({
          index: i,
          start: startPos,
          end: startPos + edit.old_string.length,
          old: edit.old_string,
          new: edit.new_string,
        });
      }
    }

    // 检查编辑之间的重叠
    for (let i = 0; i < editPositions.length; i++) {
      for (let j = i + 1; j < editPositions.length; j++) {
        const edit1 = editPositions[i];
        const edit2 = editPositions[j];

        // 检查区域是否重叠
        const overlaps = !(edit1.end <= edit2.start || edit2.end <= edit1.start);

        if (overlaps) {
          conflicts.push({
            edit1Index: edit1.index,
            edit2Index: edit2.index,
            description: `Edits ${edit1.index + 1} and ${edit2.index + 1} overlap in the file (positions ${edit1.start}-${edit1.end} and ${edit2.start}-${edit2.end})`,
          });
        }

        // 检查一个编辑的新字符串是否包含另一个编辑的旧字符串
        // 这可能导致意外的嵌套替换
        if (edit1.new.includes(edit2.old)) {
          conflicts.push({
            edit1Index: edit1.index,
            edit2Index: edit2.index,
            description: `Edit ${edit1.index + 1}'s new_string contains Edit ${edit2.index + 1}'s old_string, which may cause conflicts`,
          });
        }
        if (edit2.new.includes(edit1.old)) {
          conflicts.push({
            edit1Index: edit2.index,
            edit2Index: edit1.index,
            description: `Edit ${edit2.index + 1}'s new_string contains Edit ${edit1.index + 1}'s old_string, which may cause conflicts`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 验证单个编辑操作
   */
  private validateEdit(
    content: string,
    edit: EditOperation,
    index: number
  ): { valid: boolean; error?: string; occurrences?: number } {
    const { old_string, new_string } = edit;

    // 检查 old_string 和 new_string 是否相同
    if (old_string === new_string) {
      return {
        valid: false,
        error: `Edit ${index + 1}: old_string equals new_string (no change)`,
      };
    }

    // 检查 old_string 是否为空
    if (old_string.length === 0) {
      return {
        valid: false,
        error: `Edit ${index + 1}: old_string cannot be empty`,
      };
    }

    // 检查 old_string 是否存在
    const occurrences = content.split(old_string).length - 1;

    if (occurrences === 0) {
      return {
        valid: false,
        error: `Edit ${index + 1}: old_string not found in file`,
        occurrences,
      };
    }

    if (occurrences > 1) {
      return {
        valid: false,
        error: `Edit ${index + 1}: old_string found ${occurrences} times (must be unique)`,
        occurrences,
      };
    }

    return { valid: true, occurrences };
  }

  async execute(input: MultiEditInput): Promise<ToolResult> {
    const { file_path, edits } = input;
    let backupPath: string | null = null;

    // ========== 阶段 1: 输入验证 ==========
    if (!edits || edits.length === 0) {
      return { success: false, error: 'No edits provided' };
    }

    if (!fs.existsSync(file_path)) {
      return { success: false, error: `File not found: ${file_path}` };
    }

    try {
      // ========== 阶段 2: 创建备份 ==========
      const originalContent = fs.readFileSync(file_path, 'utf-8');
      backupPath = this.createBackup(file_path);

      // ========== 阶段 3: 冲突检测 ==========
      const conflicts = this.detectConflicts(originalContent, edits);
      if (conflicts.length > 0) {
        this.deleteBackup(backupPath);
        return {
          success: false,
          error: `Detected ${conflicts.length} conflict(s) between edits:\n${conflicts.map((c) => `- ${c.description}`).join('\n')}\n\nNo changes were made.`,
        };
      }

      // ========== 阶段 4: 验证所有编辑 ==========
      const editResults: EditResult[] = [];
      let currentContent = originalContent;

      for (let i = 0; i < edits.length; i++) {
        const validation = this.validateEdit(currentContent, edits[i], i);

        if (!validation.valid) {
          // 验证失败，回滚
          this.restoreFromBackup(file_path, backupPath);
          this.deleteBackup(backupPath);

          return {
            success: false,
            error: `${validation.error}\n\n` +
              `Transaction rolled back. No changes were made.\n` +
              `${editResults.length > 0 ? `Previously validated: ${editResults.length} edit(s)` : ''}`,
          };
        }

        editResults.push({
          index: i,
          success: true,
          message: `Edit ${i + 1}: validated`,
        });
      }

      // ========== 阶段 5: 执行所有编辑 ==========
      currentContent = originalContent;
      const appliedEdits: string[] = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const { old_string, new_string } = edit;

        const startPos = currentContent.indexOf(old_string);
        const endPos = startPos + old_string.length;

        // 应用编辑
        currentContent = currentContent.replace(old_string, new_string);

        const charDiff = new_string.length - old_string.length;
        appliedEdits.push(
          `Edit ${i + 1}: Replaced ${old_string.length} chars with ${new_string.length} chars ` +
          `(${charDiff > 0 ? '+' : ''}${charDiff}) at position ${startPos}`
        );

        editResults[i] = {
          index: i,
          success: true,
          message: appliedEdits[i],
          startPos,
          endPos,
        };
      }

      // ========== 阶段 6: 检查是否有实际更改 ==========
      if (currentContent === originalContent) {
        this.deleteBackup(backupPath);
        return {
          success: true,
          output: 'Transaction completed: No actual changes made (all edits resulted in identical content)',
        };
      }

      // ========== 阶段 7: 写入文件 ==========
      try {
        fs.writeFileSync(file_path, currentContent, 'utf-8');
      } catch (writeError) {
        // 写入失败，回滚
        this.restoreFromBackup(file_path, backupPath);
        this.deleteBackup(backupPath);

        return {
          success: false,
          error: `Failed to write file: ${writeError}\n\nTransaction rolled back from backup.`,
        };
      }

      // ========== 阶段 8: 清理备份并返回成功 ==========
      this.deleteBackup(backupPath);

      // 计算统计信息
      const originalLines = originalContent.split('\n').length;
      const newLines = currentContent.split('\n').length;
      const linesDiff = newLines - originalLines;
      const originalChars = originalContent.length;
      const newChars = currentContent.length;
      const charsDiff = newChars - originalChars;

      const summary = [
        `✓ Transaction successful: Applied ${appliedEdits.length} edit(s) to ${path.basename(file_path)}`,
        '',
        'Edit details:',
        ...appliedEdits.map((msg) => `  ${msg}`),
        '',
        'File statistics:',
        `  Lines: ${originalLines} → ${newLines} (${linesDiff > 0 ? '+' : ''}${linesDiff})`,
        `  Characters: ${originalChars} → ${newChars} (${charsDiff > 0 ? '+' : ''}${charsDiff})`,
      ];

      return {
        success: true,
        output: summary.join('\n'),
      };
    } catch (err) {
      // 发生未预期的错误，尝试回滚
      if (backupPath) {
        try {
          this.restoreFromBackup(file_path, backupPath);
          this.deleteBackup(backupPath);
          return {
            success: false,
            error: `Unexpected error: ${err}\n\nTransaction rolled back from backup.`,
          };
        } catch (rollbackErr) {
          return {
            success: false,
            error: `Critical error: ${err}\n\nFailed to rollback: ${rollbackErr}\n\nBackup file preserved at: ${backupPath}`,
          };
        }
      }

      return {
        success: false,
        error: `Error during transaction: ${err}`,
      };
    }
  }
}
