/**
 * NotebookEdit 工具
 * 编辑 Jupyter Notebook 单元格
 *
 * 功能特性：
 * - 支持 replace, insert, delete 三种编辑模式
 * - 自动清理单元格输出（code 类型）
 * - Jupyter notebook 格式验证
 * - 增强的错误处理和路径验证
 * - 保留单元格元数据
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { NotebookEditInput, ToolResult, ToolDefinition } from '../types/index.js';

interface NotebookCell {
  id?: string;
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface NotebookContent {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

export class NotebookEditTool extends BaseTool<NotebookEditInput, ToolResult> {
  name = 'NotebookEdit';
  description = `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source.

Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing.

The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.

Usage:
- notebook_path: Absolute path to the .ipynb file (required)
- cell_id: ID of the cell to edit, or numeric index (0-based)
- new_source: New source code/text for the cell (required)
- cell_type: "code" or "markdown" (required for insert mode)
- edit_mode: "replace" (default), "insert", or "delete"

Features:
- Automatically clears outputs for code cells
- Validates Jupyter notebook format
- Preserves cell metadata
- Generates unique cell IDs for new cells`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        notebook_path: {
          type: 'string',
          description: 'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
        },
        cell_id: {
          type: 'string',
          description: 'The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.',
        },
        new_source: {
          type: 'string',
          description: 'The new source for the cell',
        },
        cell_type: {
          type: 'string',
          enum: ['code', 'markdown'],
          description: 'The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.',
        },
        edit_mode: {
          type: 'string',
          enum: ['replace', 'insert', 'delete'],
          description: 'The type of edit to make (replace, insert, delete). Defaults to replace.',
        },
      },
      required: ['notebook_path', 'new_source'],
    };
  }

  async execute(input: NotebookEditInput): Promise<ToolResult> {
    const { notebook_path, cell_id, new_source, cell_type, edit_mode = 'replace' } = input;

    try {
      // 验证路径是否为绝对路径
      if (!path.isAbsolute(notebook_path)) {
        return {
          success: false,
          error: `notebook_path must be an absolute path, got: ${notebook_path}`,
        };
      }

      // 检查文件是否存在
      if (!fs.existsSync(notebook_path)) {
        return {
          success: false,
          error: `Notebook file not found: ${notebook_path}`,
        };
      }

      // 检查是否是文件（不是目录）
      const stats = fs.statSync(notebook_path);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${notebook_path}`,
        };
      }

      // 检查文件扩展名
      if (!notebook_path.endsWith('.ipynb')) {
        return {
          success: false,
          error: `File must be a Jupyter notebook (.ipynb), got: ${path.extname(notebook_path)}`,
        };
      }

      // 读取并解析 notebook
      const content = fs.readFileSync(notebook_path, 'utf-8');
      let notebook: NotebookContent;

      try {
        notebook = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          error: `Failed to parse notebook JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };
      }

      // 验证 notebook 格式
      const validationError = this.validateNotebookFormat(notebook);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // 找到目标单元格
      let cellIndex = -1;
      if (cell_id !== undefined) {
        cellIndex = this.findCellIndex(notebook.cells, cell_id);

        // 对于 insert 和 delete 模式，需要找到单元格
        if (cellIndex === -1 && (edit_mode === 'replace' || edit_mode === 'delete')) {
          return {
            success: false,
            error: `Cell not found with ID: ${cell_id}. Available cells: ${notebook.cells.length}`,
          };
        }
      } else {
        // 默认第一个单元格（仅用于 replace）
        if (edit_mode === 'replace') {
          cellIndex = 0;
        }
        // insert 模式：如果没有 cell_id，插入到末尾
        // delete 模式：必须指定 cell_id
        if (edit_mode === 'delete') {
          return {
            success: false,
            error: 'cell_id is required for delete mode',
          };
        }
      }

      // 执行编辑操作
      let resultMessage = '';

      switch (edit_mode) {
        case 'replace': {
          if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
            return {
              success: false,
              error: `Cell index out of range: ${cellIndex} (total cells: ${notebook.cells.length})`,
            };
          }

          const cell = notebook.cells[cellIndex];
          const oldType = cell.cell_type;

          // 更新源代码
          cell.source = this.formatSource(new_source);

          // 如果指定了 cell_type，更新类型
          if (cell_type) {
            cell.cell_type = cell_type;
          }

          // 清除输出（对于 code 单元格）
          this.clearCellOutputs(cell);

          resultMessage = `Replaced cell ${cellIndex}${oldType !== cell.cell_type ? ` (changed type from ${oldType} to ${cell.cell_type})` : ''}`;
          break;
        }

        case 'insert': {
          if (!cell_type) {
            return {
              success: false,
              error: 'cell_type is required for insert mode',
            };
          }

          const newCell: NotebookCell = {
            cell_type,
            source: this.formatSource(new_source),
            metadata: {},
          };

          // 初始化 code 单元格的输出
          if (cell_type === 'code') {
            newCell.outputs = [];
            newCell.execution_count = null;
          }

          // 生成唯一 ID
          newCell.id = this.generateCellId();

          // 确定插入位置
          const insertIndex = cellIndex >= 0 ? cellIndex + 1 : notebook.cells.length;
          notebook.cells.splice(insertIndex, 0, newCell);

          resultMessage = `Inserted new ${cell_type} cell at position ${insertIndex}`;
          break;
        }

        case 'delete': {
          if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
            return {
              success: false,
              error: `Cell index out of range: ${cellIndex} (total cells: ${notebook.cells.length})`,
            };
          }

          const deletedCell = notebook.cells[cellIndex];
          notebook.cells.splice(cellIndex, 1);

          resultMessage = `Deleted ${deletedCell.cell_type} cell at position ${cellIndex} (${notebook.cells.length} cells remaining)`;
          break;
        }

        default:
          return {
            success: false,
            error: `Invalid edit_mode: ${edit_mode}. Must be 'replace', 'insert', or 'delete'`,
          };
      }

      // 写回文件（使用美化的 JSON 格式）
      fs.writeFileSync(notebook_path, JSON.stringify(notebook, null, 1) + '\n', 'utf-8');

      return {
        success: true,
        output: `${resultMessage} in ${path.basename(notebook_path)}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to edit notebook: ${errorMessage}`,
      };
    }
  }

  /**
   * 验证 Jupyter notebook 格式
   */
  private validateNotebookFormat(notebook: any): string | null {
    // 检查必需字段
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return 'Invalid notebook structure: missing or invalid cells array';
    }

    if (typeof notebook.nbformat !== 'number') {
      return 'Invalid notebook structure: missing or invalid nbformat';
    }

    if (typeof notebook.nbformat_minor !== 'number') {
      return 'Invalid notebook structure: missing or invalid nbformat_minor';
    }

    // 验证 nbformat 版本（支持 v4.x）
    if (notebook.nbformat < 4) {
      return `Unsupported notebook format version: ${notebook.nbformat}.${notebook.nbformat_minor} (only v4.x is supported)`;
    }

    if (notebook.nbformat > 4) {
      // 警告但不阻止（未来版本可能兼容）
      console.warn(`Warning: Notebook format v${notebook.nbformat}.${notebook.nbformat_minor} is newer than expected (v4.x)`);
    }

    // 验证 metadata
    if (!notebook.metadata || typeof notebook.metadata !== 'object') {
      return 'Invalid notebook structure: missing or invalid metadata';
    }

    // 验证每个单元格的基本结构
    for (let i = 0; i < notebook.cells.length; i++) {
      const cell = notebook.cells[i];

      if (!cell.cell_type || typeof cell.cell_type !== 'string') {
        return `Invalid cell at index ${i}: missing or invalid cell_type`;
      }

      if (!['code', 'markdown', 'raw'].includes(cell.cell_type)) {
        return `Invalid cell at index ${i}: unknown cell_type '${cell.cell_type}'`;
      }

      if (cell.source === undefined) {
        return `Invalid cell at index ${i}: missing source`;
      }

      // code 单元格必须有 outputs 和 execution_count
      if (cell.cell_type === 'code') {
        if (!Array.isArray(cell.outputs)) {
          // 自动修复：添加空输出数组
          cell.outputs = [];
        }
        if (cell.execution_count === undefined) {
          cell.execution_count = null;
        }
      }
    }

    return null;
  }

  /**
   * 查找单元格索引
   * 支持按 ID 或数字索引查找
   */
  private findCellIndex(cells: NotebookCell[], cellId: string): number {
    // 首先尝试按 ID 精确匹配
    const indexById = cells.findIndex((c) => c.id === cellId);
    if (indexById !== -1) {
      return indexById;
    }

    // 尝试解析为数字索引
    const numIndex = parseInt(cellId, 10);
    if (!isNaN(numIndex)) {
      // 支持负数索引（从末尾开始）
      if (numIndex < 0) {
        const positiveIndex = cells.length + numIndex;
        if (positiveIndex >= 0 && positiveIndex < cells.length) {
          return positiveIndex;
        }
      } else if (numIndex >= 0 && numIndex < cells.length) {
        return numIndex;
      }
    }

    return -1;
  }

  /**
   * 格式化源代码为 Jupyter notebook 格式
   * 将字符串转换为行数组，每行以换行符结尾（除了最后一行）
   */
  private formatSource(source: string): string[] {
    if (!source) {
      return [''];
    }

    const lines = source.split('\n');
    return lines.map((line, i, arr) => (i < arr.length - 1 ? line + '\n' : line));
  }

  /**
   * 清除单元格输出
   * 仅对 code 类型的单元格生效
   */
  private clearCellOutputs(cell: NotebookCell): void {
    if (cell.cell_type === 'code') {
      cell.outputs = [];
      cell.execution_count = null;
    }
  }

  /**
   * 生成唯一的单元格 ID
   * 格式：8位随机字母数字字符串
   */
  private generateCellId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
}
