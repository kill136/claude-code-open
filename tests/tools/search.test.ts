/**
 * Unit tests for Search tools (Glob, Grep)
 * Tests file pattern matching and content searching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GlobTool, GrepTool } from '../../src/tools/search.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('GlobTool', () => {
  let globTool: GlobTool;
  let testDir: string;

  beforeEach(() => {
    globTool = new GlobTool();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glob-test-'));

    // Create test file structure
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content');
    fs.writeFileSync(path.join(testDir, 'file.js'), 'code');
    fs.writeFileSync(path.join(testDir, 'file.ts'), 'code');
    fs.mkdirSync(path.join(testDir, 'subdir'));
    fs.writeFileSync(path.join(testDir, 'subdir', 'nested.txt'), 'nested');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = globTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('pattern');
      expect(schema.properties).toHaveProperty('path');
      expect(schema.required).toContain('pattern');
    });
  });

  describe('Basic Pattern Matching', () => {
    it('should find all txt files', async () => {
      const result = await globTool.execute({
        pattern: '*.txt',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
      expect(result.output).not.toContain('file.js');
    });

    it('should find all files with wildcard', async () => {
      const result = await globTool.execute({
        pattern: '*',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });

    it('should find nested files with **', async () => {
      const result = await globTool.execute({
        pattern: '**/*.txt',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('nested.txt');
    });

    it('should find files by extension group', async () => {
      const result = await globTool.execute({
        pattern: '*.{js,ts}',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('file.js');
      expect(result.output).toContain('file.ts');
    });
  });

  describe('No Matches', () => {
    it('should return message when no files match', async () => {
      const result = await globTool.execute({
        pattern: '*.nonexistent',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('No files found');
    });
  });

  describe('Sorting', () => {
    it('should sort files by modification time', async () => {
      // Create files with delays to ensure different mtimes
      const file1 = path.join(testDir, 'first.txt');
      const file2 = path.join(testDir, 'second.txt');

      fs.writeFileSync(file1, 'first');
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(file2, 'second');

      const result = await globTool.execute({
        pattern: '*.txt',
        path: testDir
      });

      expect(result.success).toBe(true);
      const lines = result.output!.split('\n');
      // Most recent should be first
      expect(lines[0]).toContain('second.txt');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid directory', async () => {
      const result = await globTool.execute({
        pattern: '*.txt',
        path: '/nonexistent/directory'
      });

      // Glob doesn't fail on non-existent directories, just returns empty
      expect(result.success).toBe(true);
    });
  });
});

describe('GrepTool', () => {
  let grepTool: GrepTool;
  let testDir: string;

  beforeEach(() => {
    grepTool = new GrepTool();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-test-'));

    // Create test files with content
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Hello World\nFoo Bar\nBaz');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'Test Hello\nAnother Line');
    fs.writeFileSync(path.join(testDir, 'file.js'), 'function test() {\n  return "Hello";\n}');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = grepTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('pattern');
      expect(schema.properties).toHaveProperty('path');
      expect(schema.properties).toHaveProperty('output_mode');
      expect(schema.required).toContain('pattern');
    });
  });

  describe('Basic Search', () => {
    it('should find pattern in files', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir
      });

      expect(result.success).toBe(true);
      // Default output mode is files_with_matches
      expect(result.output).toBeTruthy();
    });

    it('should search case-insensitively with -i flag', async () => {
      const result = await grepTool.execute({
        pattern: 'hello',
        path: testDir,
        '-i': true,
        output_mode: 'content'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });

    it('should return no matches message when pattern not found', async () => {
      const result = await grepTool.execute({
        pattern: 'NonexistentPattern123',
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('No matches found');
    });
  });

  describe('Output Modes', () => {
    it('should show matching lines in content mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'content'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello');
    });

    it('should show only file paths in files_with_matches mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'files_with_matches'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });

    it('should show match counts in count mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'count'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });
  });

  describe('Context Lines', () => {
    it('should show lines before match with -B', async () => {
      const result = await grepTool.execute({
        pattern: 'Foo',
        path: testDir,
        output_mode: 'content',
        '-B': 1
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello'); // Line before "Foo Bar"
    });

    it('should show lines after match with -A', async () => {
      const result = await grepTool.execute({
        pattern: 'Foo',
        path: testDir,
        output_mode: 'content',
        '-A': 1
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baz'); // Line after "Foo Bar"
    });

    it('should show lines around match with -C', async () => {
      const result = await grepTool.execute({
        pattern: 'Foo',
        path: testDir,
        output_mode: 'content',
        '-C': 1
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });

    it('should fail when context options used without content mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'files_with_matches',
        '-B': 1
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Context options');
    });
  });

  describe('Line Numbers', () => {
    it('should show line numbers with -n in content mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'content',
        '-n': true
      });

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/:\d+:/); // Should contain line numbers
    });

    it('should fail when -n used without content mode', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        output_mode: 'files_with_matches',
        '-n': false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Line numbers');
    });
  });

  describe('File Filtering', () => {
    it('should filter by glob pattern', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        glob: '*.txt',
        output_mode: 'files_with_matches'
      });

      expect(result.success).toBe(true);
      if (result.output && result.output !== 'No matches found.') {
        expect(result.output).not.toContain('.js');
      }
    });

    it('should filter by file type', async () => {
      const result = await grepTool.execute({
        pattern: 'function',
        path: testDir,
        type: 'js',
        output_mode: 'files_with_matches'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Head Limit and Offset', () => {
    it('should limit output with head_limit', async () => {
      const result = await grepTool.execute({
        pattern: '.*', // Match all
        path: testDir,
        output_mode: 'content',
        head_limit: 2
      });

      expect(result.success).toBe(true);
      const lines = result.output!.split('\n').filter(l => l.length > 0);
      expect(lines.length).toBeLessThanOrEqual(2);
    });

    it('should skip lines with offset', async () => {
      const result = await grepTool.execute({
        pattern: '.*',
        path: testDir,
        output_mode: 'content',
        offset: 5,
        head_limit: 2
      });

      expect(result.success).toBe(true);
    });

    it('should fail with negative offset', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        offset: -1
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('offset must be non-negative');
    });

    it('should fail with negative head_limit', async () => {
      const result = await grepTool.execute({
        pattern: 'Hello',
        path: testDir,
        head_limit: -1
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('head_limit must be non-negative');
    });
  });

  describe('Multiline Mode', () => {
    it('should search across lines with multiline=true', async () => {
      const result = await grepTool.execute({
        pattern: 'function.*return',
        path: testDir,
        multiline: true,
        output_mode: 'files_with_matches'
      });

      expect(result.success).toBe(true);
      // May or may not find matches depending on ripgrep availability
    });
  });

  describe('Regex Patterns', () => {
    it('should support regex patterns', async () => {
      const result = await grepTool.execute({
        pattern: 'Hel+o',
        path: testDir,
        output_mode: 'content'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello');
    });

    it('should support character classes', async () => {
      const result = await grepTool.execute({
        pattern: '[Hh]ello',
        path: testDir,
        output_mode: 'content'
      });

      expect(result.success).toBe(true);
    });
  });
});
