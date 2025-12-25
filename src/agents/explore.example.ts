/**
 * Explore 代理使用示例
 */

import { ExploreAgent, type ExploreOptions } from './explore.js';

/**
 * 示例 1: 快速搜索 TypeScript 文件
 */
async function example1() {
  console.log('=== Example 1: Quick search for TypeScript files ===');

  const options: ExploreOptions = {
    thoroughness: 'quick',
    query: '**/*.ts',
    targetPath: process.cwd(),
  };

  const agent = new ExploreAgent(options);
  const result = await agent.explore();

  console.log(result.summary);
  console.log(`\nFound ${result.files.length} files in ${result.stats.timeElapsed}ms`);
  console.log('\nSuggestions:');
  result.suggestions.forEach(s => console.log(`  - ${s}`));
}

/**
 * 示例 2: 中等深度搜索类定义
 */
async function example2() {
  console.log('\n=== Example 2: Medium search for class definitions ===');

  const options: ExploreOptions = {
    thoroughness: 'medium',
    query: 'class',
    targetPath: process.cwd(),
  };

  const agent = new ExploreAgent(options);
  const result = await agent.explore();

  console.log(result.summary);
  console.log(`\nFound ${result.codeSnippets.length} code snippets`);

  // 显示前5个片段
  console.log('\nTop 5 matches:');
  result.codeSnippets.slice(0, 5).forEach((snippet, i) => {
    console.log(`\n${i + 1}. ${snippet.filePath}:${snippet.lineNumber}`);
    console.log(`   ${snippet.content}`);
  });
}

/**
 * 示例 3: 深度探索特定功能
 */
async function example3() {
  console.log('\n=== Example 3: Thorough exploration of API endpoints ===');

  const options: ExploreOptions = {
    thoroughness: 'very thorough',
    query: 'API endpoint',
    targetPath: process.cwd(),
    maxResults: 100,
  };

  const agent = new ExploreAgent(options);
  const result = await agent.explore();

  console.log(result.summary);
  console.log(`\nStats:`);
  console.log(`  - Files searched: ${result.stats.filesSearched}`);
  console.log(`  - Matches found: ${result.stats.matchesFound}`);
  console.log(`  - Time elapsed: ${result.stats.timeElapsed}ms`);
}

/**
 * 示例 4: 使用文件搜索 API
 */
async function example4() {
  console.log('\n=== Example 4: Using findFiles API ===');

  const options: ExploreOptions = {
    thoroughness: 'quick',
    query: '',
    targetPath: process.cwd(),
  };

  const agent = new ExploreAgent(options);

  // 直接使用 findFiles 方法
  const tsFiles = await agent.findFiles('src/**/*.ts');
  console.log(`Found ${tsFiles.length} TypeScript files in src/`);

  const testFiles = await agent.findFiles('**/*.test.ts');
  console.log(`Found ${testFiles.length} test files`);
}

/**
 * 示例 5: 使用代码搜索 API
 */
async function example5() {
  console.log('\n=== Example 5: Using searchCode API ===');

  const options: ExploreOptions = {
    thoroughness: 'medium',
    query: '',
    targetPath: process.cwd(),
  };

  const agent = new ExploreAgent(options);

  // 直接使用 searchCode 方法
  const snippets = await agent.searchCode('export class');
  console.log(`Found ${snippets.length} class exports`);

  // 显示前3个
  snippets.slice(0, 3).forEach((snippet, i) => {
    console.log(`\n${i + 1}. ${snippet.filePath}:${snippet.lineNumber}`);
    console.log(`   ${snippet.content.trim()}`);
  });
}

/**
 * 示例 6: 分析文件结构
 */
async function example6() {
  console.log('\n=== Example 6: Analyzing file structure ===');

  const options: ExploreOptions = {
    thoroughness: 'quick',
    query: '',
    targetPath: process.cwd(),
  };

  const agent = new ExploreAgent(options);

  // 分析单个文件
  const filePath = process.cwd() + '/src/tools/agent.ts';
  const analysis = await agent.analyzeStructure(filePath);

  console.log(`File: ${analysis.path}`);
  console.log(`Language: ${analysis.language}`);
  console.log(`Lines: ${analysis.lines}`);
  console.log(`Exports: ${analysis.exports?.join(', ')}`);
  console.log(`Classes: ${analysis.classes?.join(', ')}`);
  console.log(`Functions: ${analysis.functions?.join(', ')}`);
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    await example1();
    await example2();
    await example3();
    await example4();
    await example5();
    await example6();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
