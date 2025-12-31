/**
 * Symbol Extractor using Tree-sitter Query API
 * Implements T-004: Enhanced symbol extraction with query-based approach
 */

// 使用 any 类型以兼容不同版本的 web-tree-sitter API
type Query = any;
type QueryMatch = any;
type Language = any;
type Node = any;
type Tree = any;
import { CodeSymbol, SymbolKind } from './index.js';
import { getLanguageQueries } from './queries.js';

/**
 * Symbol Extractor using Tree-sitter Query API
 */
export class SymbolExtractor {
  private queryCache: Map<string, Query> = new Map();

  /**
   * Extract symbols from a parsed tree using queries
   */
  async extractSymbols(
    tree: Tree,
    language: Language,
    languageName: string,
    filePath: string
  ): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    const queries = getLanguageQueries(languageName);

    if (!queries) {
      // No query support for this language, return empty
      return symbols;
    }

    // Process each symbol kind
    for (const [kindStr, queryString] of Object.entries(queries)) {
      if (!queryString) continue;

      const kind = kindStr as SymbolKind;

      try {
        const query = this.getOrCreateQuery(language, languageName, kind, queryString);
        const matches = query.matches(tree.rootNode);

        for (const match of matches) {
          const symbol = this.extractSymbolFromMatch(match, kind, filePath);
          if (symbol) {
            symbols.push(symbol);
          }
        }
      } catch (error) {
        console.warn(`Failed to execute query for ${languageName}.${kind}:`, error);
      }
    }

    return symbols;
  }

  /**
   * Get or create a cached query
   * web-tree-sitter 使用 language.query(queryString) 方法创建查询
   */
  private getOrCreateQuery(
    language: Language,
    languageName: string,
    kind: SymbolKind,
    queryString: string
  ): Query {
    const cacheKey = `${languageName}:${kind}`;

    if (!this.queryCache.has(cacheKey)) {
      try {
        // web-tree-sitter 使用 language.query() 方法创建查询
        const query = language.query(queryString);
        this.queryCache.set(cacheKey, query);
      } catch (error) {
        console.error(`Failed to create query for ${cacheKey}:`, error);
        throw error;
      }
    }

    return this.queryCache.get(cacheKey)!;
  }

  /**
   * Extract symbol information from a query match
   */
  private extractSymbolFromMatch(
    match: QueryMatch,
    kind: SymbolKind,
    filePath: string
  ): CodeSymbol | null {
    const nameCapture = match.captures.find((c) => c.name === 'name');
    const definitionCapture = match.captures.find((c) => c.name === 'definition');

    if (!definitionCapture) {
      return null;
    }

    // For some symbols like arrow functions, there might not be a name capture
    const name = nameCapture
      ? nameCapture.node.text
      : this.generateAnonymousName(kind, definitionCapture.node);

    return {
      name,
      kind,
      location: {
        file: filePath,
        startLine: definitionCapture.node.startPosition.row + 1,
        startColumn: definitionCapture.node.startPosition.column,
        endLine: definitionCapture.node.endPosition.row + 1,
        endColumn: definitionCapture.node.endPosition.column,
      },
      signature: this.extractSignature(match, kind),
      documentation: this.extractDocumentation(definitionCapture.node),
      children: this.extractChildren(match, kind),
    };
  }

  /**
   * Generate a name for anonymous symbols (e.g., arrow functions)
   */
  private generateAnonymousName(kind: SymbolKind, node: Node): string {
    const line = node.startPosition.row + 1;
    return `<anonymous ${kind} at line ${line}>`;
  }

  /**
   * Extract signature from match captures
   */
  private extractSignature(match: QueryMatch, kind: SymbolKind): string | undefined {
    const nameNode = match.captures.find((c) => c.name === 'name')?.node;
    const paramsNode = match.captures.find((c) => c.name === 'params')?.node;
    const returnNode = match.captures.find((c) => c.name === 'return')?.node;
    const typeNode = match.captures.find((c) => c.name === 'type')?.node;
    const extendsNode = match.captures.find((c) => c.name === 'extends')?.node;

    if (kind === 'function' || kind === 'method') {
      const name = nameNode?.text || '<anonymous>';
      const params = paramsNode?.text || '()';
      const returnType = returnNode ? `: ${returnNode.text.trim()}` : '';
      return `${name}${params}${returnType}`;
    }

    if (kind === 'class') {
      const name = nameNode?.text || '<anonymous>';
      const extends_ = extendsNode ? ` extends ${extendsNode.text}` : '';
      return `class ${name}${extends_}`;
    }

    if (kind === 'interface') {
      const name = nameNode?.text || '<anonymous>';
      return `interface ${name}`;
    }

    if (kind === 'type') {
      const name = nameNode?.text || '<anonymous>';
      const type = typeNode?.text ? ` = ${typeNode.text}` : '';
      return `type ${name}${type}`;
    }

    if (kind === 'variable' || kind === 'constant' || kind === 'property') {
      const name = nameNode?.text || '<unknown>';
      const type = typeNode ? `: ${typeNode.text}` : '';
      return `${name}${type}`;
    }

    // Default: just return the first line of the definition
    const definitionNode = match.captures.find((c) => c.name === 'definition')?.node;
    if (definitionNode) {
      const firstLine = definitionNode.text.split('\n')[0];
      return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
    }

    return undefined;
  }

  /**
   * Extract documentation from comments preceding the definition
   */
  private extractDocumentation(node: Node): string | undefined {
    // Look for comment nodes before the definition
    let prevSibling = node.previousNamedSibling;

    while (prevSibling) {
      const nodeType = prevSibling.type;

      // Check for comment types
      if (
        nodeType === 'comment' ||
        nodeType === 'block_comment' ||
        nodeType === 'line_comment'
      ) {
        const text = prevSibling.text;

        // Check for JSDoc/docstring style comments
        if (text.startsWith('/**') || text.startsWith('///') || text.startsWith('"""')) {
          return this.parseDocComment(text);
        }
      } else {
        // Stop if we hit a non-comment node
        break;
      }

      prevSibling = prevSibling.previousNamedSibling;
    }

    return undefined;
  }

  /**
   * Parse documentation comment text
   */
  private parseDocComment(commentText: string): string {
    // Remove comment markers and clean up
    let cleaned = commentText;

    // JSDoc style
    if (cleaned.startsWith('/**')) {
      cleaned = cleaned.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\*\s?/gm, '');
    }
    // Triple slash (TypeScript/Rust)
    else if (cleaned.startsWith('///')) {
      cleaned = cleaned.replace(/^\/\/\/\s?/gm, '');
    }
    // Python docstring
    else if (cleaned.startsWith('"""') || cleaned.startsWith("'''")) {
      cleaned = cleaned.replace(/^"""|"""$/g, '').replace(/^'''|'''$/g, '');
    }

    return cleaned.trim();
  }

  /**
   * Extract child symbols (e.g., methods in a class)
   */
  private extractChildren(match: QueryMatch, kind: SymbolKind): CodeSymbol[] | undefined {
    // For classes and interfaces, we might want to extract methods/properties
    // This is a simplified version - could be enhanced later
    if (kind === 'class' || kind === 'interface') {
      const bodyNode = match.captures.find((c) => c.name === 'body')?.node;
      if (bodyNode) {
        // TODO: Could recursively extract child symbols here
        // For now, we'll leave this as undefined
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Clear the query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
    };
  }
}
