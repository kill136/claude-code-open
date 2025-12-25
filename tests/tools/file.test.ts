/**
 * Unit tests for File tools (Read, Write, Edit)
 * Tests file operations, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReadTool, WriteTool, EditTool } from '../../src/tools/file.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ReadTool', () => {
  let readTool: ReadTool;
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    readTool = new ReadTool();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-test-'));
    testFile = path.join(testDir, 'test.txt');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = readTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('file_path');
      expect(schema.properties).toHaveProperty('offset');
      expect(schema.properties).toHaveProperty('limit');
      expect(schema.required).toContain('file_path');
    });
  });

  describe('Basic File Reading', () => {
    it('should read simple text file', async () => {
      const content = 'Hello World\nLine 2\nLine 3';
      fs.writeFileSync(testFile, content);

      const result = await readTool.execute({ file_path: testFile });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
      expect(result.lineCount).toBe(3);
    });

    it('should include line numbers in output', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3');

      const result = await readTool.execute({ file_path: testFile });
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\t/); // Should have line numbers
    });

    it('should handle empty files', async () => {
      fs.writeFileSync(testFile, '');

      const result = await readTool.execute({ file_path: testFile });
      expect(result.success).toBe(true);
      expect(result.lineCount).toBe(1);
    });
  });

  describe('File Reading with Offset and Limit', () => {
    beforeEach(() => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      fs.writeFileSync(testFile, lines.join('\n'));
    });

    it('should read with offset', async () => {
      const result = await readTool.execute({
        file_path: testFile,
        offset: 10
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Line 11'); // offset is 0-indexed
      expect(result.output).not.toContain('Line 1\t');
    });

    it('should read with limit', async () => {
      const result = await readTool.execute({
        file_path: testFile,
        limit: 5
      });

      expect(result.success).toBe(true);
      const lines = result.output!.split('\n');
      expect(lines.length).toBeLessThanOrEqual(5);
    });

    it('should read with both offset and limit', async () => {
      const result = await readTool.execute({
        file_path: testFile,
        offset: 50,
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Line 51');
      const lines = result.output!.split('\n');
      expect(lines.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    it('should fail on non-existent file', async () => {
      const result = await readTool.execute({
        file_path: path.join(testDir, 'nonexistent.txt')
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when trying to read directory', async () => {
      const result = await readTool.execute({ file_path: testDir });

      expect(result.success).toBe(false);
      expect(result.error).toContain('directory');
    });
  });

  describe('Line Truncation', () => {
    it('should truncate very long lines', async () => {
      const longLine = 'x'.repeat(3000);
      fs.writeFileSync(testFile, longLine);

      const result = await readTool.execute({ file_path: testFile });
      expect(result.success).toBe(true);
      expect(result.output!.length).toBeLessThan(longLine.length + 100);
    });
  });
});

describe('WriteTool', () => {
  let writeTool: WriteTool;
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    writeTool = new WriteTool();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-test-'));
    testFile = path.join(testDir, 'test.txt');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = writeTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('file_path');
      expect(schema.properties).toHaveProperty('content');
      expect(schema.required).toContain('file_path');
      expect(schema.required).toContain('content');
    });
  });

  describe('Basic File Writing', () => {
    it('should write simple text file', async () => {
      const content = 'Hello World';
      const result = await writeTool.execute({
        file_path: testFile,
        content
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
    });

    it('should overwrite existing file', async () => {
      fs.writeFileSync(testFile, 'Original content');

      const newContent = 'New content';
      const result = await writeTool.execute({
        file_path: testFile,
        content: newContent
      });

      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(newContent);
    });

    it('should create directory if not exists', async () => {
      const nestedFile = path.join(testDir, 'nested', 'dir', 'file.txt');
      const result = await writeTool.execute({
        file_path: nestedFile,
        content: 'test'
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedFile)).toBe(true);
    });

    it('should handle multiline content', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const result = await writeTool.execute({
        file_path: testFile,
        content
      });

      expect(result.success).toBe(true);
      expect(result.lineCount).toBe(3);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
    });

    it('should handle empty content', async () => {
      const result = await writeTool.execute({
        file_path: testFile,
        content: ''
      });

      expect(result.success).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('');
    });
  });
});

describe('EditTool', () => {
  let editTool: EditTool;
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    editTool = new EditTool();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-test-'));
    testFile = path.join(testDir, 'test.txt');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = editTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('file_path');
      expect(schema.properties).toHaveProperty('old_string');
      expect(schema.properties).toHaveProperty('new_string');
      expect(schema.properties).toHaveProperty('replace_all');
      expect(schema.required).toContain('file_path');
    });
  });

  describe('Basic String Replacement', () => {
    it('should replace single occurrence', async () => {
      const original = 'Hello World\nHello Universe';
      fs.writeFileSync(testFile, original);

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Hello World',
        new_string: 'Goodbye World',
        show_diff: false
      });

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain('Goodbye World');
      expect(content).toContain('Hello Universe');
    });

    it('should fail when old_string not found', async () => {
      fs.writeFileSync(testFile, 'Hello World');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Nonexistent',
        new_string: 'New',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when old_string appears multiple times without replace_all', async () => {
      fs.writeFileSync(testFile, 'Hello\nHello\nHello');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Hello',
        new_string: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('appears');
    });
  });

  describe('Replace All', () => {
    it('should replace all occurrences with replace_all=true', async () => {
      fs.writeFileSync(testFile, 'foo bar foo baz foo');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'foo',
        new_string: 'qux',
        replace_all: true,
        show_diff: false
      });

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('qux bar qux baz qux');
      expect(content).not.toContain('foo');
    });
  });

  describe('Batch Edits', () => {
    it('should apply multiple edits atomically', async () => {
      const original = 'Line 1\nLine 2\nLine 3';
      fs.writeFileSync(testFile, original);

      const result = await editTool.execute({
        file_path: testFile,
        batch_edits: [
          { old_string: 'Line 1', new_string: 'First Line' },
          { old_string: 'Line 2', new_string: 'Second Line' },
          { old_string: 'Line 3', new_string: 'Third Line' },
        ],
        show_diff: false
      });

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('First Line\nSecond Line\nThird Line');
    });

    it('should rollback all changes if any edit fails', async () => {
      const original = 'Line 1\nLine 2';
      fs.writeFileSync(testFile, original);

      const result = await editTool.execute({
        file_path: testFile,
        batch_edits: [
          { old_string: 'Line 1', new_string: 'First' },
          { old_string: 'Nonexistent', new_string: 'Fail' },
        ],
      });

      expect(result.success).toBe(false);
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe(original); // Should be unchanged
    });
  });

  describe('Diff Preview', () => {
    it('should generate diff preview when show_diff=true', async () => {
      fs.writeFileSync(testFile, 'Hello World');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Hello',
        new_string: 'Goodbye',
        show_diff: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('+'); // Additions
      expect(result.output).toContain('-'); // Deletions
    });

    it('should show changes count in diff', async () => {
      fs.writeFileSync(testFile, 'Hello World');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Hello',
        new_string: 'Goodbye',
        show_diff: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/Changes: /);
    });
  });

  describe('Error Handling', () => {
    it('should fail on non-existent file', async () => {
      const result = await editTool.execute({
        file_path: path.join(testDir, 'nonexistent.txt'),
        old_string: 'old',
        new_string: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when trying to edit directory', async () => {
      const result = await editTool.execute({
        file_path: testDir,
        old_string: 'old',
        new_string: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('directory');
    });
  });
});
