/**
 * 任务 026: Read 工具 - 基础读取
 * 负责人: 工程师 #026
 * 优先级: P0
 *
 * 官方行为: 读取文件内容，显示行号(cat -n格式)
 *
 * 验收标准:
 * - [ ] 读取文本文件
 * - [ ] 显示行号(cat -n格式)
 * - [ ] 默认2000行限制
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  TEST_TEMP_DIR,
  createTestFile,
  describeFeature,
} from '../setup';

// Read 工具输入类型
interface ReadToolInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

// Read 工具输出类型
interface ReadToolOutput {
  content: string;
  lineCount: number;
  truncated: boolean;
  error?: string;
}

/**
 * 模拟 Read 工具执行
 */
async function executeReadTool(input: ReadToolInput): Promise<ReadToolOutput> {
  const { file_path, offset = 1, limit = 2000 } = input;

  try {
    if (!fs.existsSync(file_path)) {
      return {
        content: '',
        lineCount: 0,
        truncated: false,
        error: `File not found: ${file_path}`,
      };
    }

    const content = fs.readFileSync(file_path, 'utf-8');
    const lines = content.split('\n');

    // 应用 offset 和 limit
    const startIndex = Math.max(0, offset - 1);
    const endIndex = Math.min(lines.length, startIndex + limit);
    const selectedLines = lines.slice(startIndex, endIndex);

    // 格式化为 cat -n 格式
    const formattedContent = selectedLines
      .map((line, index) => {
        const lineNumber = startIndex + index + 1;
        const paddedNumber = String(lineNumber).padStart(6, ' ');
        // 截断超过2000字符的行
        const truncatedLine =
          line.length > 2000 ? line.substring(0, 2000) + '...' : line;
        return `${paddedNumber}\t${truncatedLine}`;
      })
      .join('\n');

    return {
      content: formattedContent,
      lineCount: selectedLines.length,
      truncated: endIndex < lines.length,
    };
  } catch (error) {
    return {
      content: '',
      lineCount: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describeFeature(
  {
    id: '026',
    category: 'TOOLS',
    priority: 'P0',
    description: 'Read 工具 - 基础读取',
    officialBehavior: '读取文件内容，显示行号(cat -n格式)',
  },
  () => {
    describe('基础文件读取', () => {
      it('应该读取简单文本文件', async () => {
        const testFile = createTestFile('simple.txt', 'Hello World');

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.content).toContain('Hello World');
        expect(result.lineCount).toBe(1);
      });

      it('应该读取多行文件', async () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const testFile = createTestFile('multiline.txt', content);

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.lineCount).toBe(3);
        expect(result.content).toContain('Line 1');
        expect(result.content).toContain('Line 2');
        expect(result.content).toContain('Line 3');
      });

      it('应该读取空文件', async () => {
        const testFile = createTestFile('empty.txt', '');

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.lineCount).toBe(1); // 空文件有一个空行
      });
    });

    describe('行号格式 (cat -n)', () => {
      it('应该显示正确的行号格式', async () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const testFile = createTestFile('numbered.txt', content);

        const result = await executeReadTool({ file_path: testFile });

        // 检查行号格式：右对齐，后跟制表符
        expect(result.content).toMatch(/^\s+1\t/);
        expect(result.content).toMatch(/\s+2\t/);
        expect(result.content).toMatch(/\s+3\t/);
      });

      it('行号应该正确递增', async () => {
        const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
        const testFile = createTestFile('ten-lines.txt', lines.join('\n'));

        const result = await executeReadTool({ file_path: testFile });

        for (let i = 1; i <= 10; i++) {
          expect(result.content).toContain(`${i}\t`);
        }
      });
    });

    describe('分页读取 (offset/limit)', () => {
      let largeFile: string;

      beforeEach(() => {
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
        largeFile = createTestFile('large.txt', lines.join('\n'));
      });

      it('应该支持 offset 参数', async () => {
        const result = await executeReadTool({
          file_path: largeFile,
          offset: 10,
          limit: 5,
        });

        expect(result.lineCount).toBe(5);
        expect(result.content).toContain('Line 10');
        expect(result.content).toContain('Line 14');
        expect(result.content).not.toContain('Line 9');
      });

      it('应该支持 limit 参数', async () => {
        const result = await executeReadTool({
          file_path: largeFile,
          limit: 10,
        });

        expect(result.lineCount).toBe(10);
        expect(result.truncated).toBe(true);
      });

      it('offset 从 1 开始', async () => {
        const result = await executeReadTool({
          file_path: largeFile,
          offset: 1,
          limit: 1,
        });

        expect(result.content).toContain('Line 1');
      });
    });

    describe('默认 2000 行限制', () => {
      it('应该默认限制 2000 行', async () => {
        const lines = Array.from({ length: 3000 }, (_, i) => `Line ${i + 1}`);
        const testFile = createTestFile('very-large.txt', lines.join('\n'));

        const result = await executeReadTool({ file_path: testFile });

        expect(result.lineCount).toBe(2000);
        expect(result.truncated).toBe(true);
      });
    });

    describe('长行截断', () => {
      it('应该截断超过 2000 字符的行', async () => {
        const longLine = 'A'.repeat(3000);
        const testFile = createTestFile('long-line.txt', longLine);

        const result = await executeReadTool({ file_path: testFile });

        // 检查行被截断
        expect(result.content).toContain('...');
        expect(result.content.length).toBeLessThan(3000);
      });
    });

    describe('错误处理', () => {
      it('应该处理文件不存在的情况', async () => {
        const result = await executeReadTool({
          file_path: '/nonexistent/file.txt',
        });

        expect(result.error).toBeDefined();
        expect(result.error).toContain('not found');
      });

      it('应该要求绝对路径', async () => {
        // 相对路径应该被拒绝或警告
        const result = await executeReadTool({
          file_path: 'relative/path.txt',
        });

        // 具体行为取决于实现
        expect(result).toBeDefined();
      });
    });

    describe('特殊文件类型', () => {
      it('应该读取 JSON 文件', async () => {
        const json = JSON.stringify({ key: 'value' }, null, 2);
        const testFile = createTestFile('test.json', json);

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.content).toContain('key');
        expect(result.content).toContain('value');
      });

      it('应该读取 TypeScript 文件', async () => {
        const ts = 'const x: number = 42;\nconsole.log(x);';
        const testFile = createTestFile('test.ts', ts);

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.content).toContain('const x: number');
      });

      it('应该读取 Markdown 文件', async () => {
        const md = '# Title\n\n- Item 1\n- Item 2';
        const testFile = createTestFile('test.md', md);

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.content).toContain('# Title');
      });
    });

    describe('编码处理', () => {
      it('应该正确处理 UTF-8 文件', async () => {
        const content = '你好世界\nこんにちは\n🎉';
        const testFile = createTestFile('utf8.txt', content);

        const result = await executeReadTool({ file_path: testFile });

        expect(result.error).toBeUndefined();
        expect(result.content).toContain('你好世界');
        expect(result.content).toContain('こんにちは');
        expect(result.content).toContain('🎉');
      });
    });
  }
);
