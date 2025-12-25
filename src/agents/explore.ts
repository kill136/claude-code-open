/**
 * Explore 代理
 * 快速代码库探索代理
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

/**
 * 彻底程度级别
 */
export type ThoroughnessLevel = 'quick' | 'medium' | 'very thorough';

/**
 * Explore 选项
 */
export interface ExploreOptions {
  /** 探索彻底程度 */
  thoroughness: ThoroughnessLevel;
  /** 查询字符串 */
  query: string;
  /** 目标路径（可选） */
  targetPath?: string;
  /** 搜索模式列表（可选） */
  patterns?: string[];
  /** 最大结果数（可选） */
  maxResults?: number;
  /** 是否包含隐藏文件（可选） */
  includeHidden?: boolean;
}

/**
 * 代码片段
 */
export interface CodeSnippet {
  /** 文件路径 */
  filePath: string;
  /** 行号 */
  lineNumber: number;
  /** 代码内容 */
  content: string;
  /** 上下文（前后行） */
  context?: {
    before: string[];
    after: string[];
  };
  /** 匹配的模式 */
  matchedPattern?: string;
}

/**
 * 结构分析结果
 */
export interface StructureAnalysis {
  /** 文件/目录路径 */
  path: string;
  /** 类型 */
  type: 'file' | 'directory';
  /** 文件大小（字节） */
  size?: number;
  /** 行数（仅文件） */
  lines?: number;
  /** 语言类型 */
  language?: string;
  /** 主要导出 */
  exports?: string[];
  /** 主要导入 */
  imports?: string[];
  /** 类定义 */
  classes?: string[];
  /** 函数定义 */
  functions?: string[];
  /** 接口定义 */
  interfaces?: string[];
  /** 子文件/目录（仅目录） */
  children?: StructureAnalysis[];
}

/**
 * Explore 结果
 */
export interface ExploreResult {
  /** 找到的文件列表 */
  files: string[];
  /** 代码片段列表 */
  codeSnippets: CodeSnippet[];
  /** 总结 */
  summary: string;
  /** 建议 */
  suggestions: string[];
  /** 统计信息 */
  stats: {
    filesSearched: number;
    matchesFound: number;
    timeElapsed: number;
  };
}

/**
 * Explore 代理
 */
export class ExploreAgent {
  private options: ExploreOptions;
  private startTime: number = 0;

  constructor(options: ExploreOptions) {
    this.options = {
      ...options,
      targetPath: options.targetPath || process.cwd(),
      maxResults: options.maxResults || this.getDefaultMaxResults(options.thoroughness),
      includeHidden: options.includeHidden ?? false,
    };
  }

  /**
   * 根据彻底程度获取默认最大结果数
   */
  private getDefaultMaxResults(thoroughness: ThoroughnessLevel): number {
    switch (thoroughness) {
      case 'quick':
        return 20;
      case 'medium':
        return 50;
      case 'very thorough':
        return 200;
      default:
        return 50;
    }
  }

  /**
   * 执行探索
   */
  async explore(): Promise<ExploreResult> {
    this.startTime = Date.now();

    const files: string[] = [];
    const codeSnippets: CodeSnippet[] = [];
    let filesSearched = 0;
    let matchesFound = 0;

    try {
      // 1. 根据查询类型决定搜索策略
      const queryType = this.detectQueryType(this.options.query);

      switch (queryType) {
        case 'pattern':
          // 文件模式搜索
          const patternFiles = await this.findFilesByPattern(this.options.query);
          files.push(...patternFiles);
          filesSearched = patternFiles.length;
          break;

        case 'code':
          // 代码内容搜索
          const searchResults = await this.searchCode(this.options.query);
          codeSnippets.push(...searchResults);
          matchesFound = searchResults.length;
          filesSearched = new Set(searchResults.map(s => s.filePath)).size;
          break;

        case 'semantic':
          // 语义搜索（结合文件和代码搜索）
          const semanticResults = await this.semanticSearch(this.options.query);
          files.push(...semanticResults.files);
          codeSnippets.push(...semanticResults.snippets);
          filesSearched = semanticResults.files.length;
          matchesFound = semanticResults.snippets.length;
          break;
      }

      // 2. 根据彻底程度决定是否进行额外分析
      if (this.options.thoroughness !== 'quick' && files.length > 0) {
        // 对找到的文件进行深度分析
        const additionalSnippets = await this.analyzeFiles(files.slice(0, 10));
        codeSnippets.push(...additionalSnippets);
      }

      // 3. 生成总结和建议
      const summary = this.generateSummary(files, codeSnippets);
      const suggestions = this.generateSuggestions(files, codeSnippets);

      // 4. 限制结果数量
      const limitedFiles = files.slice(0, this.options.maxResults);
      const limitedSnippets = codeSnippets.slice(0, this.options.maxResults);

      return {
        files: limitedFiles,
        codeSnippets: limitedSnippets,
        summary,
        suggestions,
        stats: {
          filesSearched,
          matchesFound: matchesFound || limitedSnippets.length,
          timeElapsed: Date.now() - this.startTime,
        },
      };
    } catch (error) {
      throw new Error(`Explore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检测查询类型
   */
  private detectQueryType(query: string): 'pattern' | 'code' | 'semantic' {
    // 如果包含 glob 通配符，视为模式搜索
    if (/[*?[\]{}]/.test(query)) {
      return 'pattern';
    }

    // 如果看起来像文件扩展名或路径
    if (/\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h)$/.test(query) || query.includes('/')) {
      return 'pattern';
    }

    // 如果包含编程关键字，视为代码搜索
    const codeKeywords = ['class', 'function', 'const', 'let', 'var', 'import', 'export', 'interface', 'type', 'async', 'await'];
    if (codeKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      return 'code';
    }

    // 默认为语义搜索
    return 'semantic';
  }

  /**
   * 通过模式查找文件
   */
  async findFiles(pattern: string): Promise<string[]> {
    try {
      const files = await glob(pattern, {
        cwd: this.options.targetPath,
        absolute: true,
        nodir: true,
        dot: this.options.includeHidden,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });

      // 按修改时间排序
      return files
        .map(file => ({
          file,
          mtime: fs.existsSync(file) ? fs.statSync(file).mtime.getTime() : 0,
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .map(item => item.file)
        .slice(0, this.options.maxResults);
    } catch (error) {
      console.error(`Error finding files with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * 通过模式查找文件（内部使用）
   */
  private async findFilesByPattern(pattern: string): Promise<string[]> {
    return this.findFiles(pattern);
  }

  /**
   * 搜索代码
   */
  async searchCode(keyword: string): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];

    try {
      // 根据彻底程度确定上下文行数
      const contextLines = this.getContextLines();

      // 使用 ripgrep 进行搜索
      const args = [
        '-n', // 显示行号
        '--color', 'never',
        '-C', String(contextLines), // 上下文行数
        '--max-count', String(this.options.maxResults),
      ];

      if (!this.options.includeHidden) {
        args.push('--hidden', '--glob', '!.git');
      }

      args.push('--', keyword, this.options.targetPath || '.');

      let output: string;
      try {
        output = execSync(`rg ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, {
          maxBuffer: 50 * 1024 * 1024,
          encoding: 'utf-8',
        });
      } catch (err) {
        // rg 不可用时回退到 grep
        return this.fallbackSearchCode(keyword);
      }

      // 解析输出
      const lines = output.split('\n');
      let currentFile = '';
      let currentLineNumber = 0;
      let currentContent = '';
      const beforeLines: string[] = [];
      const afterLines: string[] = [];

      for (const line of lines) {
        if (!line) continue;

        // 检查是否是文件路径行
        const fileMatch = line.match(/^([^:]+):(\d+):(.*)/);
        if (fileMatch) {
          // 保存之前的片段
          if (currentFile && currentContent) {
            snippets.push({
              filePath: currentFile,
              lineNumber: currentLineNumber,
              content: currentContent,
              context: {
                before: [...beforeLines],
                after: [...afterLines],
              },
              matchedPattern: keyword,
            });
          }

          // 开始新片段
          currentFile = fileMatch[1];
          currentLineNumber = parseInt(fileMatch[2], 10);
          currentContent = fileMatch[3];
          beforeLines.length = 0;
          afterLines.length = 0;
        }
      }

      // 保存最后一个片段
      if (currentFile && currentContent) {
        snippets.push({
          filePath: currentFile,
          lineNumber: currentLineNumber,
          content: currentContent,
          matchedPattern: keyword,
        });
      }

      return snippets.slice(0, this.options.maxResults);
    } catch (error) {
      console.error(`Error searching code for keyword ${keyword}:`, error);
      return [];
    }
  }

  /**
   * 回退的代码搜索（使用 grep）
   */
  private fallbackSearchCode(keyword: string): CodeSnippet[] {
    try {
      const output = execSync(
        `grep -rn '${keyword.replace(/'/g, "'\\''")}' ${this.options.targetPath} 2>/dev/null || true`,
        {
          maxBuffer: 50 * 1024 * 1024,
          encoding: 'utf-8',
        }
      );

      const snippets: CodeSnippet[] = [];
      const lines = output.split('\n').slice(0, this.options.maxResults);

      for (const line of lines) {
        const match = line.match(/^([^:]+):(\d+):(.*)/);
        if (match) {
          snippets.push({
            filePath: match[1],
            lineNumber: parseInt(match[2], 10),
            content: match[3],
            matchedPattern: keyword,
          });
        }
      }

      return snippets;
    } catch (error) {
      console.error(`Fallback search failed:`, error);
      return [];
    }
  }

  /**
   * 语义搜索（结合文件名和内容）
   */
  private async semanticSearch(query: string): Promise<{ files: string[]; snippets: CodeSnippet[] }> {
    const files: string[] = [];
    const snippets: CodeSnippet[] = [];

    // 1. 搜索文件名
    const keywords = query.toLowerCase().split(/\s+/);
    for (const keyword of keywords) {
      const pattern = `**/*${keyword}*`;
      const foundFiles = await this.findFiles(pattern);
      files.push(...foundFiles);
    }

    // 2. 搜索代码内容
    for (const keyword of keywords) {
      const foundSnippets = await this.searchCode(keyword);
      snippets.push(...foundSnippets);
    }

    // 去重
    const uniqueFiles = Array.from(new Set(files));
    const uniqueSnippets = this.deduplicateSnippets(snippets);

    return {
      files: uniqueFiles.slice(0, this.options.maxResults),
      snippets: uniqueSnippets.slice(0, this.options.maxResults),
    };
  }

  /**
   * 分析文件结构
   */
  async analyzeStructure(filePath: string): Promise<StructureAnalysis> {
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      return this.analyzeDirectory(filePath);
    } else {
      return this.analyzeFile(filePath);
    }
  }

  /**
   * 分析文件
   */
  private analyzeFile(filePath: string): StructureAnalysis {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(ext);

    const analysis: StructureAnalysis = {
      path: filePath,
      type: 'file',
      size: stat.size,
      language,
    };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      analysis.lines = lines.length;

      // 根据语言提取结构信息
      if (language === 'typescript' || language === 'javascript') {
        analysis.exports = this.extractExports(content);
        analysis.imports = this.extractImports(content);
        analysis.classes = this.extractClasses(content);
        analysis.functions = this.extractFunctions(content);
        analysis.interfaces = this.extractInterfaces(content);
      }
    } catch (error) {
      // 忽略读取错误
    }

    return analysis;
  }

  /**
   * 分析目录
   */
  private analyzeDirectory(dirPath: string): StructureAnalysis {
    const children: StructureAnalysis[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries.slice(0, 20)) {
        // 限制子项数量
        const childPath = path.join(dirPath, entry.name);

        // 跳过常见的忽略目录
        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
          continue;
        }

        try {
          if (entry.isDirectory()) {
            children.push({
              path: childPath,
              type: 'directory',
            });
          } else {
            children.push(this.analyzeFile(childPath));
          }
        } catch (error) {
          // 忽略单个文件的错误
        }
      }
    } catch (error) {
      // 忽略读取错误
    }

    return {
      path: dirPath,
      type: 'directory',
      children,
    };
  }

  /**
   * 分析文件列表
   */
  private async analyzeFiles(files: string[]): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        // 提取重要的代码片段（如导出、类定义等）
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (
            /export\s+(class|function|const|interface|type)/.test(line) ||
            /class\s+\w+/.test(line) ||
            /function\s+\w+/.test(line)
          ) {
            snippets.push({
              filePath: file,
              lineNumber: i + 1,
              content: line,
              context: {
                before: lines.slice(Math.max(0, i - 2), i),
                after: lines.slice(i + 1, Math.min(lines.length, i + 3)),
              },
            });
          }
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    return snippets;
  }

  /**
   * 生成总结
   */
  private generateSummary(files: string[], snippets: CodeSnippet[]): string {
    const parts: string[] = [];

    parts.push(`Explored codebase for: "${this.options.query}"`);
    parts.push(`Thoroughness level: ${this.options.thoroughness}`);
    parts.push('');

    if (files.length > 0) {
      parts.push(`Found ${files.length} matching file(s):`);
      files.slice(0, 5).forEach(file => {
        parts.push(`  - ${file}`);
      });
      if (files.length > 5) {
        parts.push(`  ... and ${files.length - 5} more`);
      }
      parts.push('');
    }

    if (snippets.length > 0) {
      parts.push(`Found ${snippets.length} code match(es):`);
      const fileGroups = this.groupSnippetsByFile(snippets);
      Object.entries(fileGroups).slice(0, 5).forEach(([file, count]) => {
        parts.push(`  - ${file}: ${count} match(es)`);
      });
      parts.push('');
    }

    if (files.length === 0 && snippets.length === 0) {
      parts.push('No matches found for the query.');
    }

    return parts.join('\n');
  }

  /**
   * 生成建议
   */
  private generateSuggestions(files: string[], snippets: CodeSnippet[]): string[] {
    const suggestions: string[] = [];

    if (files.length === 0 && snippets.length === 0) {
      suggestions.push('Try broadening your search query');
      suggestions.push('Check if the path is correct');
      suggestions.push('Try using wildcard patterns like "**/*.ts"');
      return suggestions;
    }

    if (this.options.thoroughness === 'quick' && (files.length > 10 || snippets.length > 10)) {
      suggestions.push('Consider using "medium" or "very thorough" for more comprehensive results');
    }

    if (snippets.length > 0) {
      const fileCount = new Set(snippets.map(s => s.filePath)).size;
      suggestions.push(`Matches found across ${fileCount} file(s)`);

      if (fileCount > 5) {
        suggestions.push('Consider narrowing your search to specific directories or file types');
      }
    }

    if (files.length > 0) {
      const extensions = new Set(files.map(f => path.extname(f)));
      suggestions.push(`File types found: ${Array.from(extensions).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * 根据彻底程度获取上下文行数
   */
  private getContextLines(): number {
    switch (this.options.thoroughness) {
      case 'quick':
        return 1;
      case 'medium':
        return 3;
      case 'very thorough':
        return 5;
      default:
        return 3;
    }
  }

  /**
   * 去重代码片段
   */
  private deduplicateSnippets(snippets: CodeSnippet[]): CodeSnippet[] {
    const seen = new Set<string>();
    return snippets.filter(snippet => {
      const key = `${snippet.filePath}:${snippet.lineNumber}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 按文件分组片段
   */
  private groupSnippetsByFile(snippets: CodeSnippet[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const snippet of snippets) {
      groups[snippet.filePath] = (groups[snippet.filePath] || 0) + 1;
    }
    return groups;
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * 提取导出
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
  }

  /**
   * 提取导入
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  /**
   * 提取类定义
   */
  private extractClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }

  /**
   * 提取函数定义
   */
  private extractFunctions(content: string): string[] {
    const functions: string[] = [];
    const functionRegex = /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    return functions;
  }

  /**
   * 提取接口定义
   */
  private extractInterfaces(content: string): string[] {
    const interfaces: string[] = [];
    const interfaceRegex = /interface\s+(\w+)/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push(match[1]);
    }
    return interfaces;
  }
}
