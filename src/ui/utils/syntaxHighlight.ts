/**
 * 语法高亮工具模块
 * 使用 cli-highlight 为终端提供代码语法高亮
 */

import { highlight } from 'cli-highlight';
import chalk from 'chalk';

/**
 * 支持的编程语言列表
 */
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'cpp',
  'c',
  'csharp',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'r',
  'sql',
  'json',
  'yaml',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'markdown',
  'bash',
  'sh',
  'shell',
  'powershell',
  'dockerfile',
  'makefile',
  'graphql',
  'protobuf',
  'toml',
  'ini',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * 语言别名映射
 * 将常见的语言别名映射到 cli-highlight 支持的语言名称
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'zsh': 'bash',
  'yml': 'yaml',
  'cs': 'csharp',
  'c++': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'rs': 'rust',
  'kt': 'kotlin',
  'ps1': 'powershell',
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'mk': 'makefile',
};

/**
 * 根据语言别名获取标准语言名称
 */
export function normalizeLanguage(lang: string | undefined): string {
  if (!lang) return 'text';

  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

/**
 * 根据文件扩展名推断语言
 */
export function detectLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'text';

  const extensionMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'py': 'python',
    'pyw': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c': 'c',
    'h': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'sc': 'scala',
    'r': 'r',
    'sql': 'sql',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'md': 'markdown',
    'markdown': 'markdown',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'ps1': 'powershell',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'mk': 'makefile',
    'graphql': 'graphql',
    'gql': 'graphql',
    'proto': 'protobuf',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'ini',
    'cfg': 'ini',
  };

  return extensionMap[ext] || 'text';
}

/**
 * 高亮选项接口
 */
export interface HighlightOptions {
  language?: string;
  theme?: 'default' | 'monokai' | 'github' | 'solarized';
  ignoreIllegals?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
}

/**
 * 自定义主题配置
 * 基于终端 ANSI 颜色优化
 */
const THEME_COLORS = {
  keyword: chalk.cyan,
  built_in: chalk.cyan,
  type: chalk.cyan,
  literal: chalk.blue,
  number: chalk.magenta,
  regexp: chalk.red,
  string: chalk.green,
  subst: chalk.yellow,
  symbol: chalk.magenta,
  class: chalk.yellow,
  function: chalk.yellow,
  title: chalk.yellow,
  params: chalk.white,
  comment: chalk.gray,
  doctag: chalk.gray,
  meta: chalk.gray,
  'meta-keyword': chalk.gray,
  'meta-string': chalk.green,
  section: chalk.yellow,
  tag: chalk.blue,
  name: chalk.blue,
  'builtin-name': chalk.cyan,
  attr: chalk.cyan,
  attribute: chalk.cyan,
  variable: chalk.yellow,
  bullet: chalk.blue,
  code: chalk.white,
  emphasis: chalk.italic,
  strong: chalk.bold,
  formula: chalk.magenta,
  link: chalk.blue.underline,
  quote: chalk.gray.italic,
  'selector-tag': chalk.blue,
  'selector-id': chalk.yellow,
  'selector-class': chalk.yellow,
  'selector-attr': chalk.cyan,
  'selector-pseudo': chalk.cyan,
  'template-tag': chalk.gray,
  'template-variable': chalk.yellow,
  addition: chalk.green,
  deletion: chalk.red,
};

/**
 * 对代码进行语法高亮
 *
 * @param code - 要高亮的代码
 * @param options - 高亮选项
 * @returns 高亮后的代码字符串
 */
export function highlightCode(code: string, options: HighlightOptions = {}): string {
  const {
    language,
    ignoreIllegals = true,
    lineNumbers = false,
    startLine = 1,
  } = options;

  if (!code || code.trim().length === 0) {
    return code;
  }

  try {
    const normalizedLang = normalizeLanguage(language);

    // 使用 cli-highlight 进行语法高亮
    const highlighted = highlight(code, {
      language: normalizedLang !== 'text' ? normalizedLang : undefined,
      ignoreIllegals,
      theme: THEME_COLORS,
    });

    // 如果需要行号
    if (lineNumbers) {
      return addLineNumbers(highlighted, startLine);
    }

    return highlighted;
  } catch (error) {
    // 如果高亮失败，返回原始代码
    console.warn('Syntax highlighting failed:', error);
    return code;
  }
}

/**
 * 为代码添加行号
 */
function addLineNumbers(code: string, startLine: number = 1): string {
  const lines = code.split('\n');
  const maxLineNum = startLine + lines.length - 1;
  const lineNumWidth = String(maxLineNum).length;

  return lines.map((line, index) => {
    const lineNum = startLine + index;
    const paddedLineNum = String(lineNum).padStart(lineNumWidth, ' ');
    return chalk.gray(`${paddedLineNum} │ `) + line;
  }).join('\n');
}

/**
 * 高亮内联代码（单行或短代码片段）
 *
 * @param code - 要高亮的代码
 * @param language - 语言类型
 * @returns 高亮后的代码
 */
export function highlightInline(code: string, language?: string): string {
  if (!code) return code;

  // 内联代码不显示行号
  return highlightCode(code, {
    language,
    lineNumbers: false,
  });
}

/**
 * 高亮代码块（多行代码，带行号）
 *
 * @param code - 要高亮的代码
 * @param language - 语言类型
 * @param startLine - 起始行号
 * @returns 高亮后的代码
 */
export function highlightBlock(
  code: string,
  language?: string,
  startLine: number = 1
): string {
  if (!code) return code;

  return highlightCode(code, {
    language,
    lineNumbers: true,
    startLine,
  });
}

/**
 * 高亮 JSON 数据
 *
 * @param data - JSON 数据
 * @param pretty - 是否美化输出
 * @returns 高亮后的 JSON 字符串
 */
export function highlightJSON(data: unknown, pretty: boolean = true): string {
  try {
    const json = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    return highlightCode(json, { language: 'json' });
  } catch (error) {
    return String(data);
  }
}

/**
 * 从 Markdown 代码块中提取语言和代码
 *
 * @param markdownCode - Markdown 格式的代码块
 * @returns 语言和代码
 */
export function parseMarkdownCodeBlock(markdownCode: string): {
  language?: string;
  code: string;
} {
  const match = markdownCode.match(/^```(\w+)?\n([\s\S]*?)```$/);

  if (match) {
    return {
      language: match[1],
      code: match[2],
    };
  }

  return {
    code: markdownCode,
  };
}

/**
 * 高亮 Markdown 代码块
 *
 * @param markdownCode - Markdown 格式的代码块
 * @returns 高亮后的代码
 */
export function highlightMarkdownCodeBlock(markdownCode: string): string {
  const { language, code } = parseMarkdownCodeBlock(markdownCode);
  return highlightCode(code, { language });
}

/**
 * 检测代码中是否包含 ANSI 颜色代码
 */
export function hasAnsiColors(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x1b\[\d+m/.test(text);
}

/**
 * 移除 ANSI 颜色代码
 */
export function stripAnsiColors(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[\d+m/g, '');
}

/**
 * 智能高亮：根据内容自动检测语言并高亮
 *
 * @param code - 要高亮的代码
 * @param hint - 语言提示（文件名或语言）
 * @returns 高亮后的代码
 */
export function smartHighlight(code: string, hint?: string): string {
  if (!code) return code;

  // 如果已经包含 ANSI 颜色，直接返回
  if (hasAnsiColors(code)) {
    return code;
  }

  let language: string | undefined;

  // 尝试从提示中检测语言
  if (hint) {
    if (hint.includes('.')) {
      // 如果是文件名
      language = detectLanguageFromFilename(hint);
    } else {
      // 如果是语言名称
      language = normalizeLanguage(hint);
    }
  }

  // 尝试从代码内容推断语言
  if (!language || language === 'text') {
    language = detectLanguageFromContent(code);
  }

  return highlightCode(code, { language });
}

/**
 * 从代码内容推断语言
 * 基于常见的语法特征
 */
function detectLanguageFromContent(code: string): string {
  const trimmed = code.trim();

  // JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not JSON
    }
  }

  // Python - 检测常见关键字和语法
  if (/^(import|from|def|class|if __name__|print\()/m.test(code)) {
    return 'python';
  }

  // JavaScript/TypeScript
  if (/(const|let|var|function|class|import|export|=>)/m.test(code)) {
    if (/:\s*(string|number|boolean|any|void|interface|type)/m.test(code)) {
      return 'typescript';
    }
    return 'javascript';
  }

  // Go
  if (/(package|func|import|type|struct|interface)\s+\w+/m.test(code)) {
    return 'go';
  }

  // Rust
  if (/(fn|let|mut|impl|trait|struct|enum|pub|use)\s+/m.test(code)) {
    return 'rust';
  }

  // Bash/Shell
  if (/^#!\/bin\/(ba)?sh/m.test(code) || /^\$\s+\w+/m.test(code)) {
    return 'bash';
  }

  // HTML
  if (/<\/?[a-z][\s\S]*>/i.test(code)) {
    return 'html';
  }

  // CSS
  if (/\{[\s\S]*?:\s*[\s\S]*?;[\s\S]*?\}/m.test(code) && !/function|class|const/.test(code)) {
    return 'css';
  }

  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/im.test(code)) {
    return 'sql';
  }

  return 'text';
}
