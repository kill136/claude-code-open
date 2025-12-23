/**
 * MultiEdit 工具
 * 批量编辑文件，一次性进行多个替换
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

export class MultiEditTool extends BaseTool<MultiEditInput, ToolResult> {
  name = 'MultiEdit';
  description = `Performs multiple exact string replacements in a single file atomically.

This tool is useful when you need to make several edits to the same file at once:
- All edits are applied together - if any edit fails, no changes are made
- More efficient than multiple single Edit calls
- Edits are applied in order from the array

IMPORTANT:
- You must have read the file before editing (same as Edit tool)
- Each old_string must be unique in the file at the time it's being replaced
- Preserve exact indentation from the original file

Example usage:
{
  "file_path": "/path/to/file.ts",
  "edits": [
    { "old_string": "const x = 1", "new_string": "const x = 2" },
    { "old_string": "function foo()", "new_string": "function bar()" }
  ]
}`;

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

  async execute(input: MultiEditInput): Promise<ToolResult> {
    const { file_path, edits } = input;

    // 验证输入
    if (!edits || edits.length === 0) {
      return { success: false, error: 'No edits provided' };
    }

    if (!fs.existsSync(file_path)) {
      return { success: false, error: `File not found: ${file_path}` };
    }

    try {
      // 读取文件
      let content = fs.readFileSync(file_path, 'utf-8');
      const originalContent = content;
      const appliedEdits: string[] = [];
      const failedEdits: string[] = [];

      // 应用每个编辑
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const { old_string, new_string } = edit;

        // 验证
        if (old_string === new_string) {
          failedEdits.push(`Edit ${i + 1}: old_string equals new_string`);
          continue;
        }

        // 检查 old_string 是否存在
        const occurrences = content.split(old_string).length - 1;

        if (occurrences === 0) {
          failedEdits.push(`Edit ${i + 1}: old_string not found`);
          // 回滚所有更改
          content = originalContent;
          return {
            success: false,
            error: `Edit ${i + 1} failed: old_string not found in file.\nNo changes were made.`,
          };
        }

        if (occurrences > 1) {
          failedEdits.push(`Edit ${i + 1}: old_string found ${occurrences} times (must be unique)`);
          content = originalContent;
          return {
            success: false,
            error: `Edit ${i + 1} failed: old_string found ${occurrences} times. It must be unique.\nNo changes were made.`,
          };
        }

        // 应用编辑
        content = content.replace(old_string, new_string);
        appliedEdits.push(`Edit ${i + 1}: replaced ${old_string.length} chars with ${new_string.length} chars`);
      }

      // 检查是否有任何更改
      if (content === originalContent) {
        return { success: true, output: 'No changes made (all edits were no-ops)' };
      }

      // 写入文件
      fs.writeFileSync(file_path, content, 'utf-8');

      // 计算统计
      const linesChanged = content.split('\n').length - originalContent.split('\n').length;

      return {
        success: true,
        output: `Successfully applied ${appliedEdits.length} edits to ${path.basename(file_path)}
${appliedEdits.join('\n')}
${linesChanged !== 0 ? `Lines: ${linesChanged > 0 ? '+' : ''}${linesChanged}` : ''}`,
      };
    } catch (err) {
      return { success: false, error: `Error editing file: ${err}` };
    }
  }
}
