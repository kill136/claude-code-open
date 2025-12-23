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

// Tree-sitter 解析器（优先使用原生，回退到 WASM）
export class TreeSitterWasmParser {
  private ParserClass: any = null;
  private languages: Map<string, any> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private useNative: boolean = false;

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

    const possiblePaths = [
      path.join(__dirname, '../../node_modules/tree-sitter-wasms/out', `${config.wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/tree-sitter-wasms/out', `${config.wasmName}.wasm`),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  async parse(content: string, languageName: string): Promise<any | null> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return null;
    }

    const language = await this.loadLanguage(languageName);
    if (!language) return null;

    try {
      const parser = new this.ParserClass();
      parser.setLanguage(language);
      return parser.parse(content);
    } catch (err) {
      console.warn('解析失败:', err);
      return null;
    }
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

    // 尝试使用 Tree-sitter
    if (this.useTreeSitter) {
      const tree = await this.treeSitter.parse(content, language);
      if (tree) {
        const symbols = this.extractSymbolsFromTree(tree.rootNode, filePath, language);
        tree.delete();
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
