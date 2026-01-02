/**
 * 官方源码函数提取器
 * 从混淆代码中提取函数定义，识别功能，准备分派对比
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExtractedFunction {
  name: string;           // 混淆后的函数名
  signature: string;      // 函数签名
  body: string;           // 函数体（截取前500字符）
  keywords: string[];     // 关键词（用于识别功能）
  category: string;       // 推测的分类
  startIndex: number;     // 在源码中的位置
  estimatedLines: number; // 估计行数
}

// 功能关键词映射
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'bash': ['spawn', 'exec', 'child_process', 'shell', 'command', 'sandbox', 'bubblewrap'],
  'file': ['readFile', 'writeFile', 'fs.', 'file_path', 'old_string', 'new_string', 'edit'],
  'search': ['ripgrep', 'glob', 'grep', 'pattern', 'rg ', 'search'],
  'web': ['fetch', 'http', 'url', 'WebFetch', 'WebSearch', 'request'],
  'agent': ['subagent', 'agent', 'task', 'background', 'spawn'],
  'todo': ['todo', 'TodoWrite', 'pending', 'in_progress', 'completed'],
  'plan': ['plan', 'PlanMode', 'ExitPlan', 'EnterPlan'],
  'mcp': ['mcp', 'McpServer', 'McpClient', 'protocol'],
  'ui': ['ink', 'react', 'render', 'component', 'useState', 'useEffect'],
  'session': ['session', 'persist', 'resume', 'history', 'message'],
  'auth': ['oauth', 'token', 'api_key', 'auth', 'credential'],
  'streaming': ['stream', 'sse', 'chunk', 'delta'],
  'hook': ['hook', 'PreToolUse', 'PostToolUse', 'lifecycle'],
  'permission': ['permission', 'allow', 'deny', 'sandbox'],
  'config': ['config', 'setting', 'env', 'CLAUDE_'],
};

class FunctionExtractor {
  private code: string = '';
  private functions: ExtractedFunction[] = [];

  constructor(private officialPath: string) {}

  async extract(): Promise<ExtractedFunction[]> {
    console.log('📦 加载官方源码...');
    this.code = fs.readFileSync(this.officialPath, 'utf8');
    console.log(`   大小: ${(this.code.length / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🔍 提取函数定义...');

    // 提取不同类型的函数
    this.extractNamedFunctions();
    this.extractArrowFunctions();
    this.extractAsyncFunctions();
    this.extractClassMethods();

    console.log(`   找到 ${this.functions.length} 个函数\n`);

    // 分类函数
    this.categorizeFunctions();

    // 按分类统计
    this.printStatistics();

    return this.functions;
  }

  private extractNamedFunctions() {
    // function name(...) { ... }
    const regex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = regex.exec(this.code)) !== null) {
      const body = this.extractFunctionBody(match.index + match[0].length - 1);
      this.functions.push({
        name: match[1],
        signature: `function ${match[1]}(${match[2]})`,
        body: body.substring(0, 800),
        keywords: this.extractKeywords(body),
        category: 'unknown',
        startIndex: match.index,
        estimatedLines: body.split('\n').length,
      });
    }
  }

  private extractArrowFunctions() {
    // var/let/const name = (...) => { ... }
    const regex = /(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
    let match;
    while ((match = regex.exec(this.code)) !== null) {
      const body = this.extractFunctionBody(match.index + match[0].length - 1);
      if (body.length > 50) { // 忽略太短的函数
        this.functions.push({
          name: match[1],
          signature: `const ${match[1]} = (${match[2]}) =>`,
          body: body.substring(0, 800),
          keywords: this.extractKeywords(body),
          category: 'unknown',
          startIndex: match.index,
          estimatedLines: body.split('\n').length,
        });
      }
    }
  }

  private extractAsyncFunctions() {
    // async function name(...) { ... }
    const regex = /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = regex.exec(this.code)) !== null) {
      const body = this.extractFunctionBody(match.index + match[0].length - 1);
      this.functions.push({
        name: match[1],
        signature: `async function ${match[1]}(${match[2]})`,
        body: body.substring(0, 800),
        keywords: this.extractKeywords(body),
        category: 'unknown',
        startIndex: match.index,
        estimatedLines: body.split('\n').length,
      });
    }
  }

  private extractClassMethods() {
    // 提取类定义中的方法
    const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let classMatch;
    while ((classMatch = classRegex.exec(this.code)) !== null) {
      // 记录类名，后续可用于分析
    }
  }

  private extractFunctionBody(startBrace: number): string {
    let depth = 1;
    let i = startBrace + 1;
    const maxLength = Math.min(startBrace + 50000, this.code.length);

    while (i < maxLength && depth > 0) {
      const char = this.code[i];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      i++;
    }

    return this.code.substring(startBrace, i);
  }

  private extractKeywords(body: string): string[] {
    const keywords: string[] = [];

    // 提取字符串常量
    const stringMatches = body.match(/["'`]([a-zA-Z_][a-zA-Z0-9_]{3,})["'`]/g) || [];
    keywords.push(...stringMatches.map(s => s.slice(1, -1)));

    // 提取特定模式
    for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const pattern of patterns) {
        if (body.toLowerCase().includes(pattern.toLowerCase())) {
          keywords.push(pattern);
        }
      }
    }

    return [...new Set(keywords)].slice(0, 20);
  }

  private categorizeFunctions() {
    for (const func of this.functions) {
      let maxScore = 0;
      let bestCategory = 'unknown';

      for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;
        for (const pattern of patterns) {
          if (func.keywords.some(k => k.toLowerCase().includes(pattern.toLowerCase()))) {
            score++;
          }
          if (func.body.toLowerCase().includes(pattern.toLowerCase())) {
            score += 0.5;
          }
        }
        if (score > maxScore) {
          maxScore = score;
          bestCategory = category;
        }
      }

      if (maxScore > 0) {
        func.category = bestCategory;
      }
    }
  }

  private printStatistics() {
    const stats: Record<string, number> = {};
    for (const func of this.functions) {
      stats[func.category] = (stats[func.category] || 0) + 1;
    }

    console.log('📊 函数分类统计:');
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sorted) {
      console.log(`   ${category}: ${count}`);
    }
  }

  // 导出分类后的函数列表
  async exportForComparison(outputDir: string) {
    fs.mkdirSync(outputDir, { recursive: true });

    // 按分类分组
    const byCategory: Record<string, ExtractedFunction[]> = {};
    for (const func of this.functions) {
      if (!byCategory[func.category]) {
        byCategory[func.category] = [];
      }
      byCategory[func.category].push(func);
    }

    // 为每个分类生成文件
    for (const [category, funcs] of Object.entries(byCategory)) {
      if (category === 'unknown') continue;

      const filePath = path.join(outputDir, `${category}-functions.json`);
      fs.writeFileSync(filePath, JSON.stringify(funcs.slice(0, 50), null, 2));
      console.log(`   ${category}: ${funcs.length} 函数 -> ${filePath}`);
    }

    // 生成汇总
    const summary = {
      totalFunctions: this.functions.length,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, v.length])
      ),
      topFunctions: this.functions
        .filter(f => f.category !== 'unknown')
        .sort((a, b) => b.estimatedLines - a.estimatedLines)
        .slice(0, 100)
        .map(f => ({
          name: f.name,
          category: f.category,
          lines: f.estimatedLines,
          keywords: f.keywords.slice(0, 5),
        })),
    };

    fs.writeFileSync(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
  }
}

// 主函数
async function main() {
  const projectRoot = process.cwd();
  const officialPath = path.join(projectRoot, 'node_modules/@anthropic-ai/claude-code/cli.js');
  const outputDir = path.join(projectRoot, 'extracted-functions');

  console.log('🚀 官方源码函数提取器\n');
  console.log('='.repeat(50));

  const extractor = new FunctionExtractor(officialPath);
  await extractor.extract();

  console.log('\n📁 导出函数定义...');
  await extractor.exportForComparison(outputDir);

  console.log('\n✅ 完成！函数已导出到:', outputDir);
}

main().catch(console.error);
