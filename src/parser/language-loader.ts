/**
 * Language Loader for Tree-sitter WASM files
 * Implements T-006: Multi-language support with dynamic loading
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入 web-tree-sitter 以支持正确的初始化
let Parser: any = null;
let Language: any = null;

/**
 * Language configuration mapping file extensions to language names
 */
export interface LanguageMapping {
  extensions: string[];
  wasmName: string;
  treeLanguageName?: string; // Some languages have different names in tree-sitter
}

/**
 * Supported language configurations
 */
export const LANGUAGE_MAPPINGS: Record<string, LanguageMapping> = {
  bash: {
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    wasmName: 'tree-sitter-bash',
  },
  javascript: {
    extensions: ['.js', '.mjs', '.cjs', '.jsx'],
    wasmName: 'tree-sitter-javascript',
  },
  typescript: {
    extensions: ['.ts', '.mts', '.cts'],
    wasmName: 'tree-sitter-typescript',
    treeLanguageName: 'typescript/typescript',
  },
  tsx: {
    extensions: ['.tsx'],
    wasmName: 'tree-sitter-tsx',
    treeLanguageName: 'typescript/tsx',
  },
  python: {
    extensions: ['.py', '.pyw', '.pyi'],
    wasmName: 'tree-sitter-python',
  },
  go: {
    extensions: ['.go'],
    wasmName: 'tree-sitter-go',
  },
  rust: {
    extensions: ['.rs'],
    wasmName: 'tree-sitter-rust',
  },
  java: {
    extensions: ['.java'],
    wasmName: 'tree-sitter-java',
  },
  c: {
    extensions: ['.c', '.h'],
    wasmName: 'tree-sitter-c',
  },
  cpp: {
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx'],
    wasmName: 'tree-sitter-cpp',
  },
  ruby: {
    extensions: ['.rb'],
    wasmName: 'tree-sitter-ruby',
  },
  php: {
    extensions: ['.php'],
    wasmName: 'tree-sitter-php',
  },
  swift: {
    extensions: ['.swift'],
    wasmName: 'tree-sitter-swift',
  },
  kotlin: {
    extensions: ['.kt', '.kts'],
    wasmName: 'tree-sitter-kotlin',
  },
  scala: {
    extensions: ['.scala', '.sc'],
    wasmName: 'tree-sitter-scala',
  },
  csharp: {
    extensions: ['.cs'],
    wasmName: 'tree-sitter-c-sharp',
  },
  html: {
    extensions: ['.html', '.htm'],
    wasmName: 'tree-sitter-html',
  },
  css: {
    extensions: ['.css'],
    wasmName: 'tree-sitter-css',
  },
  json: {
    extensions: ['.json'],
    wasmName: 'tree-sitter-json',
  },
  yaml: {
    extensions: ['.yaml', '.yml'],
    wasmName: 'tree-sitter-yaml',
  },
  toml: {
    extensions: ['.toml'],
    wasmName: 'tree-sitter-toml',
  },
  markdown: {
    extensions: ['.md', '.markdown'],
    wasmName: 'tree-sitter-markdown',
  },
};

/**
 * Language Loader - Manages loading and caching of Tree-sitter language parsers
 */
export class LanguageLoader {
  private languageCache: Map<string, any> = new Map();
  private initPromise: Promise<boolean> | null = null;
  private initialized: boolean = false;

  /**
   * 获取 web-tree-sitter wasm 文件目录
   */
  private getWebTreeSitterWasmDir(): string {
    const possibleDirs = [
      path.join(__dirname, '../../node_modules/web-tree-sitter'),
      path.join(process.cwd(), 'node_modules/web-tree-sitter'),
    ];

    for (const dir of possibleDirs) {
      const wasmPath = path.join(dir, 'web-tree-sitter.wasm');
      if (fs.existsSync(wasmPath)) {
        return dir;
      }
    }

    return possibleDirs[0];
  }

  /**
   * Initialize the language loader (must be called before loading languages)
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<boolean> {
    try {
      // 动态导入 web-tree-sitter
      const TreeSitter = await import('web-tree-sitter');
      // web-tree-sitter@0.22.x 使用 default export，0.26.x 使用 named exports
      Parser = (TreeSitter as any).default || (TreeSitter as any).Parser;

      // 获取 wasm 目录
      const wasmDir = this.getWebTreeSitterWasmDir();

      // 初始化 Parser，提供正确的 wasm 文件位置
      await Parser.init({
        locateFile(scriptName: string) {
          return path.join(wasmDir, scriptName);
        }
      });

      // 0.22.x: Parser.Language, 0.26.x: TreeSitter.Language
      Language = Parser.Language || (TreeSitter as any).Language;

      this.initialized = true;
      return true;
    } catch (error) {
      // web-tree-sitter 初始化失败
      return false;
    }
  }

  /**
   * Load a language WASM file
   */
  async loadLanguage(languageName: string): Promise<any | null> {
    // Ensure initialized
    const success = await this.initialize();
    if (!success || !Language) {
      // web-tree-sitter 未初始化
      return null;
    }

    // Check cache
    if (this.languageCache.has(languageName)) {
      return this.languageCache.get(languageName)!;
    }

    // Get language mapping
    const mapping = LANGUAGE_MAPPINGS[languageName];
    if (!mapping) {
      // 没有语言映射
      return null;
    }

    // Find WASM file
    const wasmPath = this.findWasmPath(mapping.wasmName);
    if (!wasmPath) {
      // WASM 文件不存在
      return null;
    }

    try {
      const language = await Language.load(wasmPath);
      this.languageCache.set(languageName, language);
      return language;
    } catch (error) {
      // 静默处理加载失败
      return null;
    }
  }

  /**
   * Create a new Parser instance
   */
  createParser(): any | null {
    if (!this.initialized || !Parser) {
      return null;
    }
    return new Parser();
  }

  /**
   * Find the WASM file path for a language
   */
  private findWasmPath(wasmName: string): string | null {
    const possiblePaths = [
      // tree-sitter-wasms package (primary source)
      path.join(__dirname, '../../node_modules/tree-sitter-wasms/out', `${wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/tree-sitter-wasms/out', `${wasmName}.wasm`),

      // Official Claude Code package (if available)
      path.join(__dirname, '../../node_modules/@anthropic-ai/claude-code', `${wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-code', `${wasmName}.wasm`),

      // Local vendor directory
      path.join(__dirname, '../../vendor/tree-sitter', `${wasmName}.wasm`),
      path.join(process.cwd(), 'vendor/tree-sitter', `${wasmName}.wasm`),

      // web-tree-sitter package
      path.join(__dirname, '../../node_modules/web-tree-sitter', `${wasmName}.wasm`),
      path.join(process.cwd(), 'node_modules/web-tree-sitter', `${wasmName}.wasm`),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();

    for (const [langName, mapping] of Object.entries(LANGUAGE_MAPPINGS)) {
      if (mapping.extensions.includes(ext)) {
        return langName;
      }
    }

    return null;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_MAPPINGS);
  }

  /**
   * Get language mapping for a specific language
   */
  getLanguageMapping(languageName: string): LanguageMapping | null {
    return LANGUAGE_MAPPINGS[languageName] || null;
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(languageName: string): boolean {
    return languageName in LANGUAGE_MAPPINGS;
  }

  /**
   * Preload commonly used languages
   */
  async preloadCommonLanguages(): Promise<void> {
    const commonLanguages = [
      'javascript',
      'typescript',
      'python',
      'go',
      'rust',
      'java',
      'c',
      'cpp',
    ];

    await Promise.all(
      commonLanguages.map((lang) =>
        this.loadLanguage(lang).catch((err) => {
          console.warn(`Failed to preload ${lang}:`, err);
        })
      )
    );
  }

  /**
   * Clear the language cache
   */
  clearCache(): void {
    this.languageCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; languages: string[] } {
    return {
      size: this.languageCache.size,
      languages: Array.from(this.languageCache.keys()),
    };
  }
}

/**
 * Singleton instance
 */
export const languageLoader = new LanguageLoader();
