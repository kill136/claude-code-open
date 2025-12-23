/**
 * 代码解析器
 * 使用 tree-sitter 进行语法分析
 */

import * as fs from 'fs';
import * as path from 'path';

// 语言到文件扩展名的映射
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  python: ['.py', '.pyw', '.pyi'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  csharp: ['.cs'],
  ruby: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
  scala: ['.scala'],
  html: ['.html', '.htm'],
  css: ['.css'],
  json: ['.json'],
  yaml: ['.yml', '.yaml'],
  markdown: ['.md', '.markdown'],
  bash: ['.sh', '.bash'],
  sql: ['.sql'],
};

// 扩展名到语言的反向映射
const EXTENSION_TO_LANGUAGE: Record<string, string> = {};
for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
  for (const ext of exts) {
    EXTENSION_TO_LANGUAGE[ext] = lang;
  }
}

export interface ParsedNode {
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  children?: ParsedNode[];
  text?: string;
}

export interface ParsedFile {
  language: string;
  path: string;
  symbols: Symbol[];
  imports: Import[];
  exports: Export[];
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
  errors: ParseError[];
}

export interface Symbol {
  name: string;
  type: 'class' | 'function' | 'variable' | 'constant' | 'interface' | 'type' | 'enum';
  line: number;
  column: number;
  exported: boolean;
}

export interface Import {
  source: string;
  names: string[];
  default?: string;
  line: number;
}

export interface Export {
  name: string;
  type: 'named' | 'default' | 'all';
  line: number;
}

export interface ClassDefinition {
  name: string;
  extends?: string;
  implements?: string[];
  methods: FunctionDefinition[];
  properties: PropertyDefinition[];
  startLine: number;
  endLine: number;
}

export interface FunctionDefinition {
  name: string;
  params: ParameterDefinition[];
  returnType?: string;
  async: boolean;
  generator: boolean;
  startLine: number;
  endLine: number;
}

export interface PropertyDefinition {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  static: boolean;
  line: number;
}

export interface ParameterDefinition {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

/**
 * 检测文件语言
 */
export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || null;
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_EXTENSIONS);
}

/**
 * 简单的代码解析器（不依赖 tree-sitter wasm）
 * 使用正则表达式进行基本解析
 */
export function parseCode(content: string, language: string): ParsedFile {
  const result: ParsedFile = {
    language,
    path: '',
    symbols: [],
    imports: [],
    exports: [],
    classes: [],
    functions: [],
    errors: [],
  };

  const lines = content.split('\n');

  switch (language) {
    case 'javascript':
    case 'typescript':
      parseJavaScriptLike(content, lines, result);
      break;
    case 'python':
      parsePython(content, lines, result);
      break;
    case 'go':
      parseGo(content, lines, result);
      break;
    case 'rust':
      parseRust(content, lines, result);
      break;
    default:
      // 通用解析
      parseGeneric(content, lines, result);
  }

  return result;
}

/**
 * 解析 JavaScript/TypeScript
 */
function parseJavaScriptLike(
  content: string,
  lines: string[],
  result: ParsedFile
): void {
  // 导入
  const importRegex = /import\s+(?:(\w+)|{([^}]+)}|(\*\s+as\s+\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.imports.push({
      source: match[4],
      default: match[1],
      names: match[2] ? match[2].split(',').map((s) => s.trim()) : [],
      line: lineNum,
    });
  }

  // 导出
  const exportRegex = /export\s+(default\s+)?(class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.exports.push({
      name: match[3],
      type: match[1] ? 'default' : 'named',
      line: lineNum,
    });
    result.symbols.push({
      name: match[3],
      type: match[2] as any,
      line: lineNum,
      column: 0,
      exported: true,
    });
  }

  // 函数
  const funcRegex = /(async\s+)?function\s*(\*?)\s*(\w+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.functions.push({
      name: match[3],
      params: parseParams(match[4]),
      async: !!match[1],
      generator: !!match[2],
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // 箭头函数（const xxx = async () => {}）
  const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.functions.push({
      name: match[1],
      params: [],
      async: !!match[2],
      generator: false,
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // 类
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
  while ((match = classRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.classes.push({
      name: match[1],
      extends: match[2],
      implements: match[3]?.split(',').map((s) => s.trim()),
      methods: [],
      properties: [],
      startLine: lineNum,
      endLine: lineNum,
    });
  }
}

/**
 * 解析 Python
 */
function parsePython(
  content: string,
  lines: string[],
  result: ParsedFile
): void {
  // 导入
  const importRegex = /(?:from\s+(\S+)\s+)?import\s+(.+)/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.imports.push({
      source: match[1] || match[2].split(',')[0].trim(),
      names: match[2].split(',').map((s) => s.trim()),
      line: lineNum,
    });
  }

  // 函数
  const funcRegex = /(async\s+)?def\s+(\w+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.functions.push({
      name: match[2],
      params: parseParams(match[3]),
      async: !!match[1],
      generator: false,
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // 类
  const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?:/g;
  while ((match = classRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.classes.push({
      name: match[1],
      extends: match[2]?.split(',')[0]?.trim(),
      methods: [],
      properties: [],
      startLine: lineNum,
      endLine: lineNum,
    });
  }
}

/**
 * 解析 Go
 */
function parseGo(content: string, lines: string[], result: ParsedFile): void {
  // 导入
  const importRegex = /import\s+(?:"([^"]+)"|(?:\(\s*([\s\S]*?)\s*\)))/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    if (match[1]) {
      result.imports.push({
        source: match[1],
        names: [],
        line: lineNum,
      });
    } else if (match[2]) {
      const imports = match[2].split('\n').filter((l) => l.trim());
      for (const imp of imports) {
        const source = imp.trim().replace(/"/g, '');
        result.imports.push({
          source,
          names: [],
          line: lineNum,
        });
      }
    }
  }

  // 函数
  const funcRegex = /func\s+(?:\(([^)]+)\)\s+)?(\w+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.functions.push({
      name: match[2],
      params: parseParams(match[3]),
      async: false,
      generator: false,
      startLine: lineNum,
      endLine: lineNum,
    });
  }

  // 结构体
  const structRegex = /type\s+(\w+)\s+struct\s*\{/g;
  while ((match = structRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.classes.push({
      name: match[1],
      methods: [],
      properties: [],
      startLine: lineNum,
      endLine: lineNum,
    });
  }
}

/**
 * 解析 Rust
 */
function parseRust(content: string, lines: string[], result: ParsedFile): void {
  // 导入
  const useRegex = /use\s+([^;]+);/g;
  let match;

  while ((match = useRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.imports.push({
      source: match[1].trim(),
      names: [],
      line: lineNum,
    });
  }

  // 函数
  const funcRegex = /(pub\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.functions.push({
      name: match[3],
      params: parseParams(match[4]),
      async: !!match[2],
      generator: false,
      startLine: lineNum,
      endLine: lineNum,
    });
    if (match[1]) {
      result.exports.push({
        name: match[3],
        type: 'named',
        line: lineNum,
      });
    }
  }

  // 结构体
  const structRegex = /(pub\s+)?struct\s+(\w+)/g;
  while ((match = structRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.classes.push({
      name: match[2],
      methods: [],
      properties: [],
      startLine: lineNum,
      endLine: lineNum,
    });
  }
}

/**
 * 通用解析
 */
function parseGeneric(
  content: string,
  lines: string[],
  result: ParsedFile
): void {
  // 尝试找到函数定义模式
  const funcPatterns = [
    /(?:function|func|def|fn)\s+(\w+)/g,
    /(\w+)\s*:\s*(?:function|func)/g,
  ];

  for (const regex of funcPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      result.functions.push({
        name: match[1],
        params: [],
        async: false,
        generator: false,
        startLine: lineNum,
        endLine: lineNum,
      });
    }
  }

  // 尝试找到类定义模式
  const classPatterns = [
    /(?:class|struct|interface|type)\s+(\w+)/g,
  ];

  for (const regex of classPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      result.classes.push({
        name: match[1],
        methods: [],
        properties: [],
        startLine: lineNum,
        endLine: lineNum,
      });
    }
  }
}

/**
 * 解析参数列表
 */
function parseParams(paramString: string): ParameterDefinition[] {
  if (!paramString.trim()) return [];

  return paramString.split(',').map((p) => {
    const parts = p.trim().split(/[:\s]+/);
    const name = parts[0].replace(/[?=].*/, '');
    return {
      name,
      type: parts[1],
      optional: p.includes('?') || p.includes('='),
      defaultValue: p.includes('=') ? p.split('=')[1]?.trim() : undefined,
    };
  });
}

/**
 * 从文件解析
 */
export function parseFile(filePath: string): ParsedFile | null {
  const language = detectLanguage(filePath);
  if (!language) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseCode(content, language);
    result.path = filePath;
    return result;
  } catch (err) {
    return null;
  }
}

/**
 * 获取文件摘要
 */
export function getFileSummary(parsed: ParsedFile): string {
  const parts: string[] = [];

  if (parsed.classes.length > 0) {
    parts.push(`Classes: ${parsed.classes.map((c) => c.name).join(', ')}`);
  }

  if (parsed.functions.length > 0) {
    parts.push(`Functions: ${parsed.functions.map((f) => f.name).join(', ')}`);
  }

  if (parsed.imports.length > 0) {
    parts.push(`Imports: ${parsed.imports.length} modules`);
  }

  if (parsed.exports.length > 0) {
    parts.push(`Exports: ${parsed.exports.map((e) => e.name).join(', ')}`);
  }

  return parts.join('\n');
}
