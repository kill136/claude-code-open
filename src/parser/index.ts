/**
 * 代码解析模块
 * 使用 LSP (Language Server Protocol) 进行代码分析
 *
 * 增强功能�?
 * - 基于 LSP 的符号提�?(更准确的语义分析)
 * - 引用查找 (通过 LSP textDocument/references)
 * - 跳转到定�?(通过 LSP textDocument/definition)
 * - 自动安装 LSP 服务�?
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LSPManager,
  lspManager,
  LSP_SERVERS,
} from './lsp/lsp-manager.js';
import {
  LSPSymbolExtractor,
  lspSymbolExtractor,
} from './lsp/lsp-symbol-extractor.js';

// 为了在本文件中使用这些类型，需要使用 import type
import type { CodeSymbol, SymbolKind, Reference } from './lsp/lsp-symbol-extractor.js';

// 重新导出类型 - 使用 export type 避免运行时导入错误
export type { CodeSymbol, SymbolKind, Reference } from './lsp/lsp-symbol-extractor.js';

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

// 语言配置
export interface LanguageConfig {
  extensions: string[];
  languageId: string;
}

// �?LSP 服务器配置生成语言配置
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {};
for (const [lang, server] of Object.entries(LSP_SERVERS)) {
  LANGUAGE_CONFIGS[lang] = {
    extensions: server.extensions,
    languageId: server.languageId,
  };
}

/**
 * 代码解析�?(基于 LSP)
 */
export class CodeParser {
  private extractor: LSPSymbolExtractor;
  private manager: LSPManager;
  private initialized: boolean = false;

  constructor() {
    this.manager = lspManager;
    this.extractor = new LSPSymbolExtractor(this.manager);
  }

  /**
   * 初始化解析器
   * 会自动安装需要的 LSP 服务器，安装失败时抛出错�?
   */
  async initialize(languages?: string[]): Promise<void> {
    if (this.initialized) return;

    // 如果没有指定语言，使用默认语言
    const defaultLanguages = languages || ['typescript', 'javascript'];

    // 初始�?LSP 服务器（失败时会抛出 LSPServerError�?
    await this.manager.initializeServers(defaultLanguages);
    this.initialized = true;
  }

  /**
   * 解析文件获取符号
   */
  async parseFile(filePath: string): Promise<CodeSymbol[]> {
    // 确保对应语言�?LSP 已初始化
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);

    if (language) {
      await this.manager.ensureServer(language);
    }

    return this.extractor.extractSymbols(filePath);
  }

  /**
   * 检测语言
   */
  detectLanguage(ext: string): string | null {
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) return lang;
    }
    return null;
  }

  /**
   * 获取 LSP 管理�?
   */
  getManager(): LSPManager {
    return this.manager;
  }
}

/**
 * 代码分析�?
 */
export class CodeAnalyzer {
  private parser: CodeParser;
  private extractor: LSPSymbolExtractor;
  private initialized: boolean = false;

  constructor() {
    this.parser = new CodeParser();
    this.extractor = lspSymbolExtractor;
  }

  /**
   * 初始化，LSP 不可用时抛出错误
   */
  async initialize(languages?: string[]): Promise<void> {
    if (this.initialized) return;
    await this.parser.initialize(languages);
    this.initialized = true;
  }

  async analyzeFile(filePath: string): Promise<CodeSymbol[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.parser.parseFile(filePath);
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

  /**
   * 查找引用 (通过 LSP)
   */
  async findReferencesInFile(
    filePath: string,
    line: number,
    column: number
  ): Promise<Reference[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.extractor.findReferences(filePath, line, column);
  }

  /**
   * 跳转到定�?(通过 LSP)
   */
  async getDefinition(
    filePath: string,
    line: number,
    column: number
  ): Promise<Reference | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.extractor.getDefinition(filePath, line, column);
  }

  /**
   * 检测语法错�?(简化版，基�?Regex)
   */
  async detectSyntaxErrors(filePath: string): Promise<SyntaxError[]> {
    // LSP 通常通过 publishDiagnostics 推送诊�?
    // 这里返回空数组，实际应用中可以订阅诊断事�?
    return [];
  }

  /**
   * 识别代码折叠区域 (简化版，基于缩�?
   */
  async detectFoldingRanges(filePath: string): Promise<FoldingRange[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.detectFoldingRangesByIndent(content);
  }

  private detectFoldingRangesByIndent(content: string): FoldingRange[] {
    const lines = content.split('\n');
    const ranges: FoldingRange[] = [];
    const stack: { line: number; indent: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;

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

      if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
        stack.push({ line: i, indent });
      }
    }

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

    return ranges;
  }

  /**
   * 停止所�?LSP 服务�?
   */
  async shutdown(): Promise<void> {
    await this.extractor.shutdown();
  }

  /**
   * 获取 LSP 管理�?
   */
  getManager(): LSPManager {
    return this.parser.getManager();
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

// 导出 LSP 模块
export * from './lsp/index.js';
