/**
 * Tool Chain Integration Tests
 * Tests multiple tools working together in realistic scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment, createTestFile, readTestFile } from './setup.js';
import type { TestEnvironment } from './setup.js';
import { ToolRegistry } from '../../src/tools/index.js';
import { ReadTool } from '../../src/tools/file.js';
import { WriteTool } from '../../src/tools/file.js';
import { EditTool } from '../../src/tools/file.js';
import { GlobTool } from '../../src/tools/search.js';
import { GrepTool } from '../../src/tools/search.js';

describe('Tool Chain Integration', () => {
  let env: TestEnvironment;
  let registry: ToolRegistry;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    env = await setupTestEnvironment();
    // Disable file read requirement for tests
    originalEnv = process.env.CLAUDE_EDIT_REQUIRE_READ;
    process.env.CLAUDE_EDIT_REQUIRE_READ = 'false';
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.CLAUDE_EDIT_REQUIRE_READ = originalEnv;
    } else {
      delete process.env.CLAUDE_EDIT_REQUIRE_READ;
    }
  });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Read → Edit → Write Chain', () => {
    it('should execute Read → Edit → Write chain successfully', async () => {
      // Setup: Create initial file
      const originalContent = 'function hello() {\n  console.log("Hello");\n}\n';
      const filePath = createTestFile(env, 'src/hello.ts', originalContent);

      // Step 1: Read the file
      const readTool = new ReadTool();
      const readResult = await readTool.execute({ file_path: filePath });

      expect(readResult.success).toBe(true);
      expect(readResult.output).toContain('console.log("Hello")');

      // Step 2: Edit the file
      const editTool = new EditTool();
      const editResult = await editTool.execute({
        file_path: filePath,
        old_string: 'console.log("Hello")',
        new_string: 'console.log("Hello, World!")',
      });

      expect(editResult.success).toBe(true);

      // Step 3: Verify the edit
      const finalContent = readTestFile(env, 'src/hello.ts');
      expect(finalContent).toContain('Hello, World!');
      expect(finalContent).not.toContain('console.log("Hello")');
    });

    it('should handle multiple edits in sequence', async () => {
      const originalContent = `export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
`;
      const filePath = createTestFile(env, 'src/calculator.ts', originalContent);

      const editTool = new EditTool();

      // Edit 1: Add subtract method
      await editTool.execute({
        file_path: filePath,
        old_string: '  add(a: number, b: number): number {\n    return a + b;\n  }',
        new_string: `  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }`,
      });

      // Edit 2: Add multiply method
      await editTool.execute({
        file_path: filePath,
        old_string: '  subtract(a: number, b: number): number {\n    return a - b;\n  }',
        new_string: `  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }`,
      });

      // Verify all methods exist
      const finalContent = readTestFile(env, 'src/calculator.ts');
      expect(finalContent).toContain('add(a: number, b: number)');
      expect(finalContent).toContain('subtract(a: number, b: number)');
      expect(finalContent).toContain('multiply(a: number, b: number)');
    });
  });

  describe('Glob → Read Chain', () => {
    it('should find files and read their contents', async () => {
      // Setup: Create multiple files
      createTestFile(env, 'src/file1.ts', 'export const value1 = 1;');
      createTestFile(env, 'src/file2.ts', 'export const value2 = 2;');
      createTestFile(env, 'src/nested/file3.ts', 'export const value3 = 3;');
      createTestFile(env, 'docs/readme.md', '# Readme');

      // Step 1: Find all TypeScript files
      const globTool = new GlobTool();
      const globResult = await globTool.execute({
        pattern: '**/*.ts',
        path: env.projectDir,
      });

      expect(globResult.output).toContain('file1.ts');
      expect(globResult.output).toContain('file2.ts');
      expect(globResult.output).toContain('file3.ts');
      expect(globResult.output).not.toContain('readme.md');

      // Step 2: Read one of the found files
      const readTool = new ReadTool();
      const file1Path = `${env.projectDir}/src/file1.ts`;
      const readResult = await readTool.execute({ file_path: file1Path });

      expect(readResult.output).toContain('value1 = 1');
    });
  });

  describe('Grep → Edit Chain', () => {
    it('should search for pattern and edit matching files', async () => {
      // Setup: Create files with TODO comments
      createTestFile(
        env,
        'src/app.ts',
        '// TODO: Implement feature\nexport function app() {\n  return "app";\n}\n'
      );
      createTestFile(
        env,
        'src/utils.ts',
        '// TODO: Add validation\nexport function validate() {\n  return true;\n}\n'
      );

      // Step 1: Search for TODO comments
      const grepTool = new GrepTool();
      const grepResult = await grepTool.execute({
        pattern: 'TODO',
        path: env.projectDir,
        output_mode: 'files_with_matches',
      });

      expect(grepResult.output).toContain('app.ts');
      expect(grepResult.output).toContain('utils.ts');

      // Step 2: Edit one of the files to resolve TODO
      const editTool = new EditTool();
      const appPath = `${env.projectDir}/src/app.ts`;
      await editTool.execute({
        file_path: appPath,
        old_string: '// TODO: Implement feature',
        new_string: '// Feature implemented',
      });

      // Verify edit
      const content = readTestFile(env, 'src/app.ts');
      expect(content).toContain('Feature implemented');
      expect(content).not.toContain('TODO: Implement feature');
    });

    it('should search with context and edit specific lines', async () => {
      const fileContent = `function calculate(x: number, y: number): number {
  // FIXME: This should handle division by zero
  return x / y;
}`;

      createTestFile(env, 'src/math.ts', fileContent);

      // Step 1: Search with context
      const grepTool = new GrepTool();
      const grepResult = await grepTool.execute({
        pattern: 'FIXME',
        path: env.projectDir,
        output_mode: 'content',
        '-B': 1,
        '-A': 1,
      });

      expect(grepResult.output).toContain('FIXME');
      expect(grepResult.output).toContain('return x / y');

      // Step 2: Fix the issue
      const editTool = new EditTool();
      const mathPath = `${env.projectDir}/src/math.ts`;
      await editTool.execute({
        file_path: mathPath,
        old_string: '  // FIXME: This should handle division by zero\n  return x / y;',
        new_string: `  if (y === 0) {
    throw new Error('Division by zero');
  }
  return x / y;`,
      });

      // Verify fix
      const updatedContent = readTestFile(env, 'src/math.ts');
      expect(updatedContent).toContain('Division by zero');
      expect(updatedContent).not.toContain('FIXME');
    });
  });

  describe('Write → Glob → Read Chain', () => {
    it('should create files, find them, and read contents', async () => {
      const writeTool = new WriteTool();

      // Step 1: Write multiple files
      await writeTool.execute({
        file_path: `${env.projectDir}/models/user.ts`,
        content: 'export interface User { id: string; name: string; }',
      });

      await writeTool.execute({
        file_path: `${env.projectDir}/models/post.ts`,
        content: 'export interface Post { id: string; title: string; }',
      });

      // Step 2: Find all model files
      const globTool = new GlobTool();
      const globResult = await globTool.execute({
        pattern: 'models/*.ts',
        path: env.projectDir,
      });

      expect(globResult.output).toContain('user.ts');
      expect(globResult.output).toContain('post.ts');

      // Step 3: Read one of the created files
      const readTool = new ReadTool();
      const userPath = `${env.projectDir}/models/user.ts`;
      const readResult = await readTool.execute({ file_path: userPath });

      expect(readResult.output).toContain('interface User');
      expect(readResult.output).toContain('id: string');
    });
  });

  describe('Complex Multi-Tool Workflow', () => {
    it('should execute a refactoring workflow', async () => {
      // Setup: Create a file that needs refactoring
      const originalCode = `export function processUser(data: any) {
  console.log(data);
  return data.name;
}`;

      createTestFile(env, 'src/processor.ts', originalCode);

      // Workflow:
      // 1. Search for 'any' type usage
      const grepTool = new GrepTool();
      const searchResult = await grepTool.execute({
        pattern: ': any',
        path: env.projectDir,
        output_mode: 'content',
      });

      expect(searchResult.output).toContain('data: any');

      // 2. Read the file to understand context
      const readTool = new ReadTool();
      const filePath = `${env.projectDir}/src/processor.ts`;
      const readResult = await readTool.execute({ file_path: filePath });

      expect(readResult.output).toContain('processUser');

      // 3. Edit to add proper types
      const editTool = new EditTool();
      await editTool.execute({
        file_path: filePath,
        old_string: 'export function processUser(data: any) {',
        new_string: 'interface UserData { name: string; }\n\nexport function processUser(data: UserData) {',
      });

      // 4. Verify refactoring
      const finalContent = readTestFile(env, 'src/processor.ts');
      expect(finalContent).toContain('interface UserData');
      expect(finalContent).toContain('data: UserData');
      expect(finalContent).not.toContain('data: any');
    });

    it('should handle file creation and organization workflow', async () => {
      const writeTool = new WriteTool();
      const globTool = new GlobTool();
      const readTool = new ReadTool();

      // Step 1: Create project structure
      await writeTool.execute({
        file_path: `${env.projectDir}/src/index.ts`,
        content: 'export * from "./models";\nexport * from "./services";',
      });

      await writeTool.execute({
        file_path: `${env.projectDir}/src/models/index.ts`,
        content: 'export * from "./user";\nexport * from "./post";',
      });

      await writeTool.execute({
        file_path: `${env.projectDir}/src/models/user.ts`,
        content: 'export interface User { id: string; }',
      });

      // Step 2: Verify structure with glob
      const allFiles = await globTool.execute({
        pattern: '**/*.ts',
        path: env.projectDir,
      });

      expect(allFiles.output).toContain('src/index.ts');
      expect(allFiles.output).toContain('src/models/index.ts');
      expect(allFiles.output).toContain('src/models/user.ts');

      // Step 3: Read and verify barrel exports
      const indexContent = await readTool.execute({
        file_path: `${env.projectDir}/src/index.ts`,
      });

      expect(indexContent.output).toContain('export * from "./models"');
      expect(indexContent.output).toContain('export * from "./services"');
    });
  });
});
