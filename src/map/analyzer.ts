/**
 * 代码分析器
 * 负责分析代码文件，提取符号和结构信息
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  codeAnalyzer,
  treeSitterParser,
  CodeSymbol,
  SymbolKind,
} from '../parser/index.js';
import {
  ModuleNode,
  ClassNode,
  InterfaceNode,
  TypeNode,
  EnumNode,
  FunctionNode,
  MethodNode,
  VariableNode,
  PropertyNode,
  ImportInfo,
  ExportInfo,
  LocationInfo,
  ParameterInfo,
  ProgressCallback,
  AnalysisProgress,
} from './types.js';

// ============================================================================
// 语言检测
// ============================================================================

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.cs': 'csharp',
  '.sh': 'bash',
  '.bash': 'bash',
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_EXTENSIONS[ext] || 'unknown';
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_INCLUDE = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.go',
  '**/*.rs',
  '**/*.java',
];

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/vendor/**',
  '**/target/**',
  '**/*.min.js',
  '**/*.bundle.js',
];

// ============================================================================
// CodeMapAnalyzer 类
// ============================================================================

export class CodeMapAnalyzer {
  private rootPath: string;
  private include: string[];
  private exclude: string[];
  private concurrency: number;

  constructor(
    rootPath: string,
    options: {
      include?: string[];
      exclude?: string[];
      concurrency?: number;
    } = {}
  ) {
    this.rootPath = path.resolve(rootPath);
    this.include = options.include || DEFAULT_INCLUDE;
    this.exclude = options.exclude || DEFAULT_EXCLUDE;
    this.concurrency = options.concurrency || 10;
  }

  /**
   * 发现所有待分析的文件
   */
  async discoverFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.include) {
      const files = await glob(pattern, {
        cwd: this.rootPath,
        absolute: true,
        ignore: this.exclude,
        nodir: true,
      });
      allFiles.push(...files);
    }

    // 去重并排序
    return [...new Set(allFiles)].sort();
  }

  /**
   * 分析单个文件
   */
  async analyzeFile(filePath: string): Promise<ModuleNode> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);
    const language = detectLanguage(filePath);
    const relativePath = path.relative(this.rootPath, filePath).replace(/\\/g, '/');
    const lines = content.split('\n').length;

    // 使用 Tree-sitter 解析器提取符号
    let symbols: CodeSymbol[] = [];
    try {
      symbols = await codeAnalyzer.analyzeFile(filePath);
    } catch (error) {
      // Tree-sitter 解析失败时记录警告但继续
      console.warn(`Warning: Failed to analyze ${filePath}:`, error);
    }

    // 构建模块节点
    const module: ModuleNode = {
      id: relativePath,
      name: path.basename(filePath),
      path: filePath,
      language,
      lines,
      size: stats.size,
      imports: this.extractImports(content, relativePath, language),
      exports: this.extractExports(symbols, relativePath),
      classes: this.extractClasses(symbols, relativePath),
      interfaces: this.extractInterfaces(symbols, relativePath),
      types: this.extractTypes(symbols, relativePath),
      enums: this.extractEnums(symbols, relativePath),
      functions: this.extractFunctions(symbols, relativePath),
      variables: this.extractVariables(symbols, relativePath),
    };

    return module;
  }

  /**
   * 批量分析文件（支持并行和进度回调）
   */
  async analyzeFiles(
    files?: string[],
    onProgress?: ProgressCallback
  ): Promise<ModuleNode[]> {
    const filesToAnalyze = files || (await this.discoverFiles());
    const modules: ModuleNode[] = [];
    const total = filesToAnalyze.length;

    // 分批并行处理
    for (let i = 0; i < total; i += this.concurrency) {
      const batch = filesToAnalyze.slice(i, i + this.concurrency);

      const results = await Promise.all(
        batch.map(async (file, batchIndex) => {
          const current = i + batchIndex + 1;

          if (onProgress) {
            onProgress({
              phase: 'parse',
              current,
              total,
              currentFile: file,
            });
          }

          try {
            return await this.analyzeFile(file);
          } catch (error) {
            console.warn(`Warning: Failed to analyze ${file}:`, error);
            return null;
          }
        })
      );

      modules.push(...results.filter((m): m is ModuleNode => m !== null));
    }

    return modules;
  }

  // ==========================================================================
  // 提取方法
  // ==========================================================================

  /**
   * 从代码内容提取导入信息
   */
  private extractImports(content: string, moduleId: string, language: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    // TypeScript/JavaScript import 语句
    if (language === 'typescript' || language === 'javascript') {
      // import { x } from 'y'
      // import x from 'y'
      // import * as x from 'y'
      // import 'y'
      const importRegex = /^import\s+(?:(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))\s+from\s+)?['"]([^'"]+)['"]/gm;

      let match;
      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        importRegex.lastIndex = 0;
        match = importRegex.exec(line);

        if (match) {
          const namedImports = match[1]; // { x, y }
          const namespaceImport = match[2]; // * as x
          const defaultImport = match[3]; // x
          const source = match[4];

          const symbols: string[] = [];
          let isDefault = false;
          let isNamespace = false;

          if (namedImports) {
            // 提取 { x, y as z } 中的符号
            const symbolMatches = namedImports.match(/\w+/g);
            if (symbolMatches) {
              symbols.push(...symbolMatches);
            }
          }

          if (namespaceImport) {
            isNamespace = true;
            const nsMatch = namespaceImport.match(/\*\s+as\s+(\w+)/);
            if (nsMatch) {
              symbols.push(nsMatch[1]);
            }
          }

          if (defaultImport) {
            isDefault = true;
            symbols.push(defaultImport);
          }

          imports.push({
            source,
            symbols,
            isDefault,
            isNamespace,
            isDynamic: false,
            location: {
              file: moduleId,
              startLine: lineNum,
              startColumn: 0,
              endLine: lineNum,
              endColumn: line.length,
            },
          });
        }
      }

      // 动态 import()
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      lineNum = 0;
      for (const line of lines) {
        lineNum++;
        dynamicImportRegex.lastIndex = 0;
        while ((match = dynamicImportRegex.exec(line)) !== null) {
          imports.push({
            source: match[1],
            symbols: [],
            isDefault: false,
            isNamespace: false,
            isDynamic: true,
            location: {
              file: moduleId,
              startLine: lineNum,
              startColumn: match.index,
              endLine: lineNum,
              endColumn: match.index + match[0].length,
            },
          });
        }
      }
    }

    // Python import
    if (language === 'python') {
      const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        importRegex.lastIndex = 0;
        const match = importRegex.exec(line.trim());

        if (match) {
          const fromModule = match[1] || '';
          const importPart = match[2];
          const symbols = importPart
            .split(',')
            .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
            .filter((s) => s && s !== '*');

          imports.push({
            source: fromModule || importPart.split(',')[0].trim(),
            symbols,
            isDefault: false,
            isNamespace: importPart.trim() === '*',
            isDynamic: false,
            location: {
              file: moduleId,
              startLine: lineNum,
              startColumn: 0,
              endLine: lineNum,
              endColumn: line.length,
            },
          });
        }
      }
    }

    return imports;
  }

  /**
   * 从符号提取导出信息
   */
  private extractExports(symbols: CodeSymbol[], moduleId: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'export') {
        exports.push({
          name: symbol.name,
          type: symbol.name === 'default' ? 'default' : 'named',
          location: this.convertLocation(symbol.location, moduleId),
        });
      }
    }

    return exports;
  }

  /**
   * 从符号提取类
   */
  private extractClasses(symbols: CodeSymbol[], moduleId: string): ClassNode[] {
    const classes: ClassNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'class') {
        const classNode: ClassNode = {
          id: `${moduleId}::${symbol.name}`,
          name: symbol.name,
          isAbstract: symbol.signature?.includes('abstract') || false,
          isExported: true, // 假设已提取的都是导出的
          methods: [],
          properties: [],
          location: this.convertLocation(symbol.location, moduleId),
          documentation: symbol.documentation,
        };

        // 提取类的子元素（方法、属性）
        if (symbol.children) {
          for (const child of symbol.children) {
            if (child.kind === 'method') {
              classNode.methods.push(this.createMethodNode(child, moduleId, symbol.name));
            } else if (child.kind === 'property') {
              classNode.properties.push(this.createPropertyNode(child, moduleId));
            }
          }
        }

        classes.push(classNode);
      }
    }

    return classes;
  }

  /**
   * 从符号提取接口
   */
  private extractInterfaces(symbols: CodeSymbol[], moduleId: string): InterfaceNode[] {
    const interfaces: InterfaceNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'interface') {
        interfaces.push({
          id: `${moduleId}::${symbol.name}`,
          name: symbol.name,
          isExported: true,
          properties: [],
          methods: [],
          location: this.convertLocation(symbol.location, moduleId),
          documentation: symbol.documentation,
        });
      }
    }

    return interfaces;
  }

  /**
   * 从符号提取类型定义
   */
  private extractTypes(symbols: CodeSymbol[], moduleId: string): TypeNode[] {
    const types: TypeNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'type') {
        types.push({
          id: `${moduleId}::${symbol.name}`,
          name: symbol.name,
          definition: symbol.signature || '',
          isExported: true,
          location: this.convertLocation(symbol.location, moduleId),
          documentation: symbol.documentation,
        });
      }
    }

    return types;
  }

  /**
   * 从符号提取枚举
   */
  private extractEnums(symbols: CodeSymbol[], moduleId: string): EnumNode[] {
    const enums: EnumNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'enum') {
        enums.push({
          id: `${moduleId}::${symbol.name}`,
          name: symbol.name,
          members: [], // 需要进一步解析
          isExported: true,
          isConst: symbol.signature?.includes('const') || false,
          location: this.convertLocation(symbol.location, moduleId),
          documentation: symbol.documentation,
        });
      }
    }

    return enums;
  }

  /**
   * 从符号提取函数
   */
  private extractFunctions(symbols: CodeSymbol[], moduleId: string): FunctionNode[] {
    const functions: FunctionNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'function') {
        functions.push(this.createFunctionNode(symbol, moduleId));
      }
    }

    return functions;
  }

  /**
   * 从符号提取变量
   */
  private extractVariables(symbols: CodeSymbol[], moduleId: string): VariableNode[] {
    const variables: VariableNode[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'variable' || symbol.kind === 'constant') {
        variables.push({
          id: `${moduleId}::${symbol.name}`,
          name: symbol.name,
          kind: symbol.kind === 'constant' ? 'const' : 'let',
          isExported: true,
          location: this.convertLocation(symbol.location, moduleId),
          documentation: symbol.documentation,
        });
      }
    }

    return variables;
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  private convertLocation(loc: CodeSymbol['location'], moduleId: string): LocationInfo {
    return {
      file: moduleId,
      startLine: loc.startLine,
      startColumn: loc.startColumn,
      endLine: loc.endLine,
      endColumn: loc.endColumn,
    };
  }

  private createFunctionNode(symbol: CodeSymbol, moduleId: string): FunctionNode {
    const signature = symbol.signature || `${symbol.name}()`;
    const params = this.parseParameters(signature);

    return {
      id: `${moduleId}::${symbol.name}`,
      name: symbol.name,
      signature,
      parameters: params,
      returnType: this.parseReturnType(signature),
      isAsync: signature.includes('async') || false,
      isGenerator: signature.includes('*') || false,
      isExported: true,
      location: this.convertLocation(symbol.location, moduleId),
      documentation: symbol.documentation,
      calls: [],
      calledBy: [],
    };
  }

  private createMethodNode(symbol: CodeSymbol, moduleId: string, className: string): MethodNode {
    const funcNode = this.createFunctionNode(symbol, moduleId);

    return {
      ...funcNode,
      id: `${moduleId}::${className}::${symbol.name}`,
      className,
      visibility: this.detectVisibility(symbol),
      isStatic: symbol.signature?.includes('static') || false,
      isAbstract: symbol.signature?.includes('abstract') || false,
      isOverride: symbol.signature?.includes('override') || false,
    };
  }

  private createPropertyNode(symbol: CodeSymbol, moduleId: string): PropertyNode {
    return {
      id: `${moduleId}::${symbol.name}`,
      name: symbol.name,
      type: symbol.signature,
      visibility: this.detectVisibility(symbol),
      isStatic: symbol.signature?.includes('static') || false,
      isReadonly: symbol.signature?.includes('readonly') || false,
      isOptional: symbol.name.includes('?') || false,
      location: this.convertLocation(symbol.location, moduleId),
      documentation: symbol.documentation,
    };
  }

  private detectVisibility(symbol: CodeSymbol): 'public' | 'private' | 'protected' {
    const sig = symbol.signature || '';
    if (sig.includes('private') || symbol.name.startsWith('_')) return 'private';
    if (sig.includes('protected')) return 'protected';
    return 'public';
  }

  private parseParameters(signature: string): ParameterInfo[] {
    const params: ParameterInfo[] = [];
    const match = signature.match(/\(([^)]*)\)/);

    if (match && match[1]) {
      const paramStr = match[1];
      const paramParts = this.splitParameters(paramStr);

      for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const isRest = trimmed.startsWith('...');
        const isOptional = trimmed.includes('?');
        const hasDefault = trimmed.includes('=');

        // 解析参数名和类型
        let name = trimmed.split(/[?:=]/)[0].replace('...', '').trim();
        let type: string | undefined;

        const typeMatch = trimmed.match(/:\s*([^=]+)/);
        if (typeMatch) {
          type = typeMatch[1].trim();
        }

        params.push({
          name,
          type,
          isOptional: isOptional || hasDefault,
          isRest,
          defaultValue: hasDefault ? trimmed.split('=')[1]?.trim() : undefined,
        });
      }
    }

    return params;
  }

  private splitParameters(paramStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramStr) {
      if (char === '(' || char === '<' || char === '{' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === '>' || char === '}' || char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        params.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current);
    }

    return params;
  }

  private parseReturnType(signature: string): string | undefined {
    // 查找 ): Type 或 => Type
    const match = signature.match(/\)\s*:\s*([^{]+)/) || signature.match(/=>\s*([^{]+)/);
    return match ? match[1].trim() : undefined;
  }
}

// 导出默认实例创建函数
export function createAnalyzer(
  rootPath: string,
  options?: {
    include?: string[];
    exclude?: string[];
    concurrency?: number;
  }
): CodeMapAnalyzer {
  return new CodeMapAnalyzer(rootPath, options);
}
