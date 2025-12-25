/**
 * 代码解析模块
 * 使用 Tree-sitter WASM 进行代码分析
 */

import * as fs from 'fs';
import * as path from 'path';

// 语法节点类型
export interface SyntaxNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: SyntaxNode[];
  parent?: SyntaxNode;
  isNamed: boolean;
}

// 代码符号类型
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'property'
  | 'variable'
  | 'constant'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'import'
  | 'export';

// 语法错误
export interface SyntaxError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

// 代码折叠区域
export interface FoldingRange {
  startLine: number;
  endLine: number;
  kind: 'comment' | 'imports' | 'region' | 'block';
}

// 代码符号
export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  location: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  children?: CodeSymbol[];
  signature?: string;
  documentation?: string;
}

// 语言配置
export interface LanguageConfig {
  extensions: string[];
  wasmName: string;
  symbolPatterns: {
    [key in SymbolKind]?: string[];
  };
}

// 支持的语言配置
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  bash: {
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    wasmName: 'tree-sitter-bash',
    symbolPatterns: {
      function: ['function_definition'],
      variable: ['variable_assignment', 'declaration_command'],
      import: ['source_command'],
    },
  },
  javascript: {
    extensions: ['.js', '.mjs', '.cjs', '.jsx'],
    wasmName: 'tree-sitter-javascript',
    symbolPatterns: {
      function: ['function_declaration', 'arrow_function', 'function_expression', 'generator_function_declaration'],
      class: ['class_declaration', 'class_expression'],
      method: ['method_definition'],
      variable: ['variable_declarator', 'lexical_declaration'],
      import: ['import_statement'],
      export: ['export_statement', 'export_default_declaration'],
    },
  },
  typescript: {
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    wasmName: 'tree-sitter-typescript',
    symbolPatterns: {
      function: ['function_declaration', 'arrow_function', 'function_expression', 'generator_function_declaration'],
      class: ['class_declaration', 'class_expression', 'abstract_class_declaration'],
      method: ['method_definition', 'method_signature'],
      interface: ['interface_declaration'],
      type: ['type_alias_declaration'],
      enum: ['enum_declaration'],
      import: ['import_statement'],
      export: ['export_statement', 'export_default_declaration'],
      property: ['property_signature', 'public_field_definition'],
    },
  },
  python: {
    extensions: ['.py', '.pyw', '.pyi'],
    wasmName: 'tree-sitter-python',
    symbolPatterns: {
      function: ['function_definition'],
      class: ['class_definition'],
      method: ['function_definition'],
      import: ['import_statement', 'import_from_statement'],
      variable: ['assignment', 'augmented_assignment'],
    },
  },
  go: {
    extensions: ['.go'],
    wasmName: 'tree-sitter-go',
    symbolPatterns: {
      function: ['function_declaration', 'method_declaration'],
      type: ['type_declaration', 'type_spec'],
      interface: ['interface_type'],
      variable: ['var_declaration', 'const_declaration', 'short_var_declaration'],
      import: ['import_declaration'],
    },
  },
  rust: {
    extensions: ['.rs'],
    wasmName: 'tree-sitter-rust',
    symbolPatterns: {
      function: ['function_item'],
      class: ['struct_item', 'impl_item'],
      interface: ['trait_item'],
      type: ['type_item'],
      enum: ['enum_item'],
      variable: ['let_declaration', 'const_item', 'static_item'],
      import: ['use_declaration'],
      module: ['mod_item'],
    },
  },
  java: {
    extensions: ['.java'],
    wasmName: 'tree-sitter-java',
    symbolPatterns: {
      function: ['method_declaration', 'constructor_declaration'],
      class: ['class_declaration', 'interface_declaration', 'enum_declaration'],
      interface: ['interface_declaration'],
      enum: ['enum_declaration'],
      variable: ['field_declaration', 'local_variable_declaration'],
      import: ['import_declaration'],
    },
  },
  c: {
    extensions: ['.c', '.h'],
    wasmName: 'tree-sitter-c',
    symbolPatterns: {
      function: ['function_definition', 'function_declarator'],
      type: ['struct_specifier', 'union_specifier', 'enum_specifier', 'type_definition'],
      variable: ['declaration', 'init_declarator'],
    },
  },
  cpp: {
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.h'],
    wasmName: 'tree-sitter-cpp',
    symbolPatterns: {
      function: ['function_definition', 'function_declarator'],
      class: ['class_specifier', 'struct_specifier'],
      type: ['type_definition', 'alias_declaration'],
      variable: ['declaration', 'init_declarator'],
      import: ['preproc_include'],
    },
  },
};

// 解析缓存条目
interface ParseCacheEntry {
  tree: any;
  content: string;
  timestamp: number;
  language: string;
}

// Tree-sitter 解析器（优先使用原生，回退到 WASM）
export class TreeSitterWasmParser {
  private ParserClass: any = null;
  private languages: Map<string, any> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private useNative: boolean = false;
  // 增量解析缓存（T256）
  private parseCache: Map<string, ParseCacheEntry> = new Map();
  private readonly CACHE_MAX_AGE = 5 * 60 * 1000; // 5 分钟
  private readonly MAX_CACHE_SIZE = 50; // 最多缓存 50 个文件

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<boolean> {
    // 首先尝试原生 tree-sitter
    try {
      const nativeTreeSitter = await import('tree-sitter');
      const Parser = (nativeTreeSitter as any).default || nativeTreeSitter;
      this.ParserClass = Parser;
      this.useNative = true;
      this.initialized = true;
      console.log('Tree-sitter: 使用原生模块');
      return true;
    } catch {
      // 原生模块不可用，尝试 WASM
    }

    try {
      // 动态导入 web-tree-sitter
      const TreeSitter = await import('web-tree-sitter');
      // Parser 可能是命名导出或默认导出
      const Parser = (TreeSitter as any).Parser || (TreeSitter as any).default || TreeSitter;
      if (typeof Parser.init === 'function') {
        await Parser.init();
      }
      this.ParserClass = Parser;
      this.useNative = false;
      this.initialized = true;
      console.log('Tree-sitter: 使用 WASM 模块');
      return true;
    } catch (err) {
      console.warn('Tree-sitter 初始化失败，使用 Regex 回退:', err);
      return false;
    }
  }

  isNative(): boolean {
    return this.useNative;
  }

  async loadLanguage(languageName: string): Promise<any | null> {
    if (!this.initialized || !this.ParserClass) {
      return null;
    }

    if (this.languages.has(languageName)) {
      return this.languages.get(languageName)!;
    }

    try {
      const wasmPath = this.getWasmPath(languageName);
      if (wasmPath && fs.existsSync(wasmPath)) {
        const language = await this.ParserClass.Language.load(wasmPath);
        this.languages.set(languageName, language);
        return language;
      }
    } catch (err) {
      console.warn(`加载语言 ${languageName} 失败:`, err);
    }

    return null;
  }

  private getWasmPath(languageName: string): string | null {
    const config = LANGUAGE_CONFIGS[languageName];
    if (!config) return null;

    // 优先查找官方包中的 WASM 文件（用于 Bash）
    const possiblePaths = [
      // 官方包的 WASM 文件（tree-sitter.wasm, tree-sitter-bash.wasm）
      path.join(__dirname, '../../node_modules/@anthropic-ai/claude-code', `${config.wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-code', `${config.wasmName}.wasm`),
      // tree-sitter-wasms 包中的语言 WASM
      path.join(__dirname, '../../node_modules/tree-sitter-wasms/out', `${config.wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/tree-sitter-wasms/out', `${config.wasmName}.wasm`),
      // 本地 vendor 目录（如果有的话）
      path.join(__dirname, '../../vendor/tree-sitter', `${config.wasmName}.wasm`),
      path.join(process.cwd(), 'vendor/tree-sitter', `${config.wasmName}.wasm`),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`Found WASM for ${languageName} at: ${p}`);
        return p;
      }
    }

    console.warn(`WASM not found for language: ${languageName}`);
    return null;
  }

  async parse(content: string, languageName: string, filePath?: string): Promise<any | null> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return null;
    }

    const language = await this.loadLanguage(languageName);
    if (!language) return null;

    try {
      const parser = new this.ParserClass();
      parser.setLanguage(language);

      // 增量解析支持（T256）
      if (filePath && this.parseCache.has(filePath)) {
        const cached = this.parseCache.get(filePath)!;
        const now = Date.now();

        // 如果缓存仍然有效且语言相同
        if (now - cached.timestamp < this.CACHE_MAX_AGE && cached.language === languageName) {
          // 检测变更
          if (cached.content === content) {
            // 内容未变化，返回缓存的树
            return cached.tree;
          } else {
            // 内容有变化，使用增量解析
            try {
              const oldTree = cached.tree;
              const newTree = parser.parse(content, oldTree);

              // 更新缓存
              this.updateCache(filePath, newTree, content, languageName);

              return newTree;
            } catch (err) {
              console.warn('增量解析失败，回退到完整解析:', err);
            }
          }
        }
      }

      // 完整解析
      const tree = parser.parse(content);

      // 缓存结果
      if (filePath) {
        this.updateCache(filePath, tree, content, languageName);
      }

      return tree;
    } catch (err) {
      console.warn('解析失败:', err);
      return null;
    }
  }

  /**
   * 更新解析缓存
   */
  private updateCache(filePath: string, tree: any, content: string, language: string): void {
    // 如果缓存太大，删除最旧的条目
    if (this.parseCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.parseCache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const oldEntry = this.parseCache.get(oldestKey);
        if (oldEntry?.tree?.delete) {
          oldEntry.tree.delete();
        }
        this.parseCache.delete(oldestKey);
      }
    }

    this.parseCache.set(filePath, {
      tree,
      content,
      timestamp: Date.now(),
      language,
    });
  }

  /**
   * 清除解析缓存
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      const entry = this.parseCache.get(filePath);
      if (entry?.tree?.delete) {
        entry.tree.delete();
      }
      this.parseCache.delete(filePath);
    } else {
      // 清除所有缓存
      for (const entry of this.parseCache.values()) {
        if (entry.tree?.delete) {
          entry.tree.delete();
        }
      }
      this.parseCache.clear();
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number; entries: string[] } {
    return {
      size: this.parseCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries: Array.from(this.parseCache.keys()),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// 代码解析器（支持 Tree-sitter WASM 和 Regex 回退）
export class CodeParser {
  private treeSitter: TreeSitterWasmParser;
  private useTreeSitter: boolean = true;

  constructor() {
    this.treeSitter = new TreeSitterWasmParser();
  }

  async initialize(): Promise<boolean> {
    const success = await this.treeSitter.initialize();
    this.useTreeSitter = success;
    return success;
  }

  async parseFile(filePath: string): Promise<CodeSymbol[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);
    if (!language) return [];

    // 尝试使用 Tree-sitter（支持增量解析）
    if (this.useTreeSitter) {
      const tree = await this.treeSitter.parse(content, language, filePath);
      if (tree) {
        const symbols = this.extractSymbolsFromTree(tree.rootNode, filePath, language);
        // 注意：不要删除树，因为它被缓存了
        // tree.delete();
        return symbols;
      }
    }

    // 回退到 Regex
    return this.parseWithRegex(content, filePath, language);
  }

  parseFileSync(filePath: string): CodeSymbol[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);
    if (!language) return [];
    return this.parseWithRegex(content, filePath, language);
  }

  private detectLanguage(ext: string): string | null {
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) return lang;
    }
    return null;
  }

  private extractSymbolsFromTree(node: any, filePath: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const config = LANGUAGE_CONFIGS[language];
    if (!config) return symbols;

    const visit = (n: any) => {
      for (const [kind, patterns] of Object.entries(config.symbolPatterns)) {
        if (patterns && patterns.includes(n.type)) {
          const name = this.extractName(n, kind as SymbolKind, language);
          if (name) {
            symbols.push({
              name,
              kind: kind as SymbolKind,
              location: {
                file: filePath,
                startLine: n.startPosition.row + 1,
                startColumn: n.startPosition.column,
                endLine: n.endPosition.row + 1,
                endColumn: n.endPosition.column,
              },
              signature: n.text.split('\n')[0].slice(0, 100),
            });
          }
          break;
        }
      }

      // 递归访问子节点
      if (n.namedChildren) {
        for (const child of n.namedChildren) {
          visit(child);
        }
      }
    };

    visit(node);
    return symbols;
  }

  private extractName(node: any, _kind: SymbolKind, _language: string): string | null {
    // 尝试从常见的字段名提取名称
    const nameNode = node.childForFieldName?.('name') ||
                     node.childForFieldName?.('declarator') ||
                     node.namedChildren?.find((c: any) => c.type === 'identifier' || c.type === 'property_identifier');

    if (nameNode) {
      return nameNode.text;
    }

    // 对于某些节点类型，尝试从第一个标识符子节点获取名称
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        if (child.type === 'identifier' || child.type === 'type_identifier') {
          return child.text;
        }
      }
    }

    return null;
  }

  parseWithRegex(content: string, filePath: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');
    const patterns = this.getRegexPatterns(language);

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      for (const [kind, pattern] of Object.entries(patterns)) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
          symbols.push({
            name: match[1],
            kind: kind as SymbolKind,
            location: {
              file: filePath,
              startLine: idx + 1,
              startColumn: line.indexOf(match[1]),
              endLine: idx + 1,
              endColumn: line.indexOf(match[1]) + match[1].length,
            },
            signature: trimmed.slice(0, 100),
          });
          break;
        }
      }
    });

    return symbols;
  }

  private getRegexPatterns(language: string): Record<string, RegExp> {
    const commonPatterns: Record<string, RegExp> = {
      function: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      class: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      interface: /^(?:export\s+)?interface\s+(\w+)/,
      type: /^(?:export\s+)?type\s+(\w+)/,
      enum: /^(?:export\s+)?enum\s+(\w+)/,
      variable: /^(?:export\s+)?(?:const|let|var)\s+(\w+)/,
    };

    const languagePatterns: Record<string, Record<string, RegExp>> = {
      bash: {
        function: /^(?:function\s+)?(\w+)\s*\(\s*\)\s*\{?/,
        variable: /^(?:declare\s+)?(?:local\s+)?(?:export\s+)?(\w+)=/,
        import: /^(?:source|\.)(?:\s+|=)['"]?([^'"]+)/,
      },
      python: {
        function: /^(?:async\s+)?def\s+(\w+)/,
        class: /^class\s+(\w+)/,
        variable: /^(\w+)\s*=/,
      },
      go: {
        function: /^func\s+(?:\([^)]+\)\s+)?(\w+)/,
        type: /^type\s+(\w+)/,
        variable: /^(?:var|const)\s+(\w+)/,
      },
      rust: {
        function: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
        class: /^(?:pub\s+)?struct\s+(\w+)/,
        interface: /^(?:pub\s+)?trait\s+(\w+)/,
        enum: /^(?:pub\s+)?enum\s+(\w+)/,
        type: /^(?:pub\s+)?type\s+(\w+)/,
        module: /^(?:pub\s+)?mod\s+(\w+)/,
      },
      java: {
        function: /^(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
        class: /^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/,
        interface: /^(?:public\s+)?interface\s+(\w+)/,
        enum: /^(?:public\s+)?enum\s+(\w+)/,
      },
      c: {
        function: /^(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{?$/,
        type: /^(?:typedef\s+)?struct\s+(\w+)/,
      },
      cpp: {
        function: /^(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{?$/,
        class: /^(?:template\s*<[^>]*>\s*)?class\s+(\w+)/,
        type: /^(?:typedef\s+)?struct\s+(\w+)/,
      },
    };

    return languagePatterns[language] || commonPatterns;
  }
}

// 代码分析器
export class CodeAnalyzer {
  private parser: CodeParser;
  private initialized: boolean = false;

  constructor() {
    this.parser = new CodeParser();
  }

  async initialize(): Promise<boolean> {
    this.initialized = await this.parser.initialize();
    return this.initialized;
  }

  async analyzeFile(filePath: string): Promise<CodeSymbol[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.parser.parseFile(filePath);
  }

  analyzeFileSync(filePath: string): CodeSymbol[] {
    return this.parser.parseFileSync(filePath);
  }

  async analyzeDirectory(dirPath: string, extensions?: string[]): Promise<CodeSymbol[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const symbols: CodeSymbol[] = [];
    const allExtensions = extensions || ['.ts', '.js', '.py', '.go', '.rs', '.java', '.c', '.cpp'];

    const walkDir = async (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '__pycache__', 'target'].includes(entry.name)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (allExtensions.includes(ext)) {
            const fileSymbols = await this.parser.parseFile(fullPath);
            symbols.push(...fileSymbols);
          }
        }
      }
    };

    await walkDir(dirPath);
    return symbols;
  }

  findSymbol(name: string, symbols: CodeSymbol[]): CodeSymbol[] {
    const lowerName = name.toLowerCase();
    return symbols.filter(s => s.name.toLowerCase().includes(lowerName));
  }

  findByKind(kind: SymbolKind, symbols: CodeSymbol[]): CodeSymbol[] {
    return symbols.filter(s => s.kind === kind);
  }

  async getOutline(filePath: string): Promise<CodeSymbol[]> {
    return this.analyzeFile(filePath);
  }

  getOutlineSync(filePath: string): CodeSymbol[] {
    return this.analyzeFileSync(filePath);
  }

  /**
   * 检测语法错误（T255）
   */
  async detectSyntaxErrors(filePath: string): Promise<SyntaxError[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);
    if (!language) return [];

    const errors: SyntaxError[] = [];

    // 尝试使用 Tree-sitter 解析
    if (this.initialized) {
      try {
        const tree = await (this.parser as any).treeSitter.parse(content, language);
        if (tree && tree.rootNode) {
          // 查找所有 ERROR 和 MISSING 节点
          this.findErrorNodes(tree.rootNode, errors, filePath);
          tree.delete?.();
        }
      } catch (err) {
        errors.push({
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
          line: 1,
          column: 0,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  private findErrorNodes(node: any, errors: SyntaxError[], filePath: string): void {
    if (node.type === 'ERROR' || node.isMissing) {
      errors.push({
        message: node.isMissing ? `Missing ${node.type}` : `Syntax error`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        severity: 'error',
      });
    }

    // 递归查找子节点
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.findErrorNodes(child, errors, filePath);
      }
    }
  }

  /**
   * 识别代码折叠区域（T257）
   */
  async detectFoldingRanges(filePath: string): Promise<FoldingRange[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);
    if (!language) return [];

    const ranges: FoldingRange[] = [];

    // 尝试使用 Tree-sitter 解析
    if (this.initialized) {
      try {
        const tree = await (this.parser as any).treeSitter.parse(content, language);
        if (tree && tree.rootNode) {
          this.findFoldingRanges(tree.rootNode, ranges, language);
          tree.delete?.();
        }
      } catch (err) {
        console.warn('Failed to detect folding ranges:', err);
      }
    }

    // 回退：基于缩进检测
    if (ranges.length === 0) {
      this.detectFoldingRangesByIndent(content, ranges);
    }

    return ranges;
  }

  private findFoldingRanges(node: any, ranges: FoldingRange[], language: string): void {
    const nodeType = node.type;
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    // 只折叠多行节点
    if (endLine - startLine < 1) {
      // 递归子节点
      if (node.namedChildren) {
        for (const child of node.namedChildren) {
          this.findFoldingRanges(child, ranges, language);
        }
      }
      return;
    }

    // 检测可折叠的节点类型
    const foldableNodes: Record<string, 'block' | 'comment' | 'imports'> = {
      // 通用
      'block': 'block',
      'statement_block': 'block',
      'compound_statement': 'block',
      'object': 'block',
      'array': 'block',
      'if_statement': 'block',
      'for_statement': 'block',
      'while_statement': 'block',
      // 注释
      'comment': 'comment',
      'block_comment': 'comment',
      'multiline_comment': 'comment',
      // 导入
      'import_statement': 'imports',
      'import_declaration': 'imports',
      // JavaScript/TypeScript
      'class_body': 'block',
      'function_declaration': 'block',
      'arrow_function': 'block',
      'object_type': 'block',
      'method_definition': 'block',
      // Python
      'function_definition': 'block',
      'class_definition': 'block',
      // Go
      'type_declaration': 'block',
      'method_declaration': 'block',
      // Rust
      'impl_item': 'block',
      'struct_item': 'block',
      'enum_item': 'block',
      'trait_item': 'block',
      // Java/C/C++
      'class_declaration': 'block',
      'method_body': 'block',
    };

    const kind = foldableNodes[nodeType];
    if (kind) {
      ranges.push({
        startLine,
        endLine,
        kind,
      });
    }

    // 递归子节点
    if (node.namedChildren) {
      for (const child of node.namedChildren) {
        this.findFoldingRanges(child, ranges, language);
      }
    }
  }

  private detectFoldingRangesByIndent(content: string, ranges: FoldingRange[]): void {
    const lines = content.split('\n');
    const stack: { line: number; indent: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;

      // 如果缩进减少，创建折叠区域
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        const start = stack.pop()!;
        if (i - start.line > 1) {
          ranges.push({
            startLine: start.line + 1,
            endLine: i,
            kind: 'block',
          });
        }
      }

      // 如果这行可能开始一个块，加入栈
      if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
        stack.push({ line: i, indent });
      }
    }

    // 处理剩余的栈
    while (stack.length > 0) {
      const start = stack.pop()!;
      if (lines.length - start.line > 1) {
        ranges.push({
          startLine: start.line + 1,
          endLine: lines.length,
          kind: 'block',
        });
      }
    }
  }

  /**
   * 查找特定类型的符号（T254）
   */
  async findSymbolsByKind(filePath: string, kind: SymbolKind): Promise<CodeSymbol[]> {
    const symbols = await this.analyzeFile(filePath);
    return symbols.filter(s => s.kind === kind);
  }

  /**
   * 按名称查找符号（T254）
   */
  async findSymbolsByName(filePath: string, name: string, exact: boolean = false): Promise<CodeSymbol[]> {
    const symbols = await this.analyzeFile(filePath);
    if (exact) {
      return symbols.filter(s => s.name === name);
    } else {
      const lowerName = name.toLowerCase();
      return symbols.filter(s => s.name.toLowerCase().includes(lowerName));
    }
  }

  /**
   * 查找位置处的符号（T253）
   */
  async findSymbolAtPosition(filePath: string, line: number, column: number): Promise<CodeSymbol | null> {
    const symbols = await this.analyzeFile(filePath);

    for (const symbol of symbols) {
      const { startLine, startColumn, endLine, endColumn } = symbol.location;

      if (line >= startLine && line <= endLine) {
        if (line === startLine && column < startColumn) continue;
        if (line === endLine && column > endColumn) continue;
        return symbol;
      }
    }

    return null;
  }

  private detectLanguage(ext: string): string | null {
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) return lang;
    }
    return null;
  }
}

// 简化解析器（向后兼容）
export class SimpleCodeParser {
  private parser: CodeParser;

  constructor() {
    this.parser = new CodeParser();
  }

  parseFile(filePath: string): CodeSymbol[] {
    return this.parser.parseFileSync(filePath);
  }

  parseContent(content: string, filePath: string, language: string): CodeSymbol[] {
    return this.parser.parseWithRegex(content, filePath, language);
  }
}

// 获取支持的语言列表
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CONFIGS);
}

// 获取语言配置
export function getLanguageConfig(language: string): LanguageConfig | null {
  return LANGUAGE_CONFIGS[language] || null;
}

// 默认实例
export const codeParser = new CodeParser();
export const codeAnalyzer = new CodeAnalyzer();

// 导出 Tree-sitter 解析器
export const treeSitterParser = new TreeSitterWasmParser();
