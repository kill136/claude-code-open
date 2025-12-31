/**
 * Reference Finder using Tree-sitter
 * Implements T-005: Method A - Text matching + scope filtering
 */

// 使用 any 类型以兼容不同版本的 web-tree-sitter API
type Query = any;
type Language = any;
type Node = any;
type Tree = any;

export interface Reference {
  location: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  kind: 'definition' | 'read' | 'write';
}

/**
 * Reference Finder - Simplified approach using text matching and scope filtering
 */
export class ReferenceFinder {
  /**
   * Find all references to an identifier at a given position
   */
  async findReferences(
    tree: Tree,
    language: Language,
    identifier: string,
    position: { line: number; column: number },
    filePath: string
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    try {
      // 1. Find all identifier nodes using a query
      // web-tree-sitter 使用 language.query() 方法创建查询
      const identifierQuery = language.query('(identifier) @id');
      const matches = identifierQuery.matches(tree.rootNode);

      // 2. Find the cursor position node and its definition
      const cursorNode = tree.rootNode.descendantForPosition({
        row: position.line - 1,
        column: position.column,
      });

      if (!cursorNode) {
        return references;
      }

      // 3. Find the definition node for this identifier
      const definitionNode = this.findDefinition(cursorNode, identifier);
      if (!definitionNode) {
        // If no definition found, just return all matches with the same name
        return this.findAllOccurrences(matches, identifier, filePath);
      }

      // 4. Determine the scope of the definition
      const scope = this.findScope(definitionNode);

      // 5. Filter matches that are in the same scope
      for (const match of matches) {
        const node = match.captures[0].node;

        if (node.text === identifier && this.isInScope(node, scope)) {
          references.push({
            location: {
              file: filePath,
              startLine: node.startPosition.row + 1,
              startColumn: node.startPosition.column,
              endLine: node.endPosition.row + 1,
              endColumn: node.endPosition.column,
            },
            kind: this.determineReferenceKind(node),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to find references:', error);
    }

    return references;
  }

  /**
   * Find all occurrences of an identifier (fallback when no definition found)
   */
  private findAllOccurrences(
    matches: any[],
    identifier: string,
    filePath: string
  ): Reference[] {
    const references: Reference[] = [];

    for (const match of matches) {
      const node = match.captures[0].node;

      if (node.text === identifier) {
        references.push({
          location: {
            file: filePath,
            startLine: node.startPosition.row + 1,
            startColumn: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
          },
          kind: this.determineReferenceKind(node),
        });
      }
    }

    return references;
  }

  /**
   * Find the definition node for an identifier
   */
  private findDefinition(
    node: Node,
    identifier: string
  ): Node | null {
    let current: Node | null = node;

    while (current) {
      // Check if this is a definition node
      if (this.isDefinitionNode(current)) {
        const name = this.getDefinitionName(current);
        if (name === identifier) {
          return current;
        }
      }

      current = current.parent;
    }

    return null;
  }

  /**
   * Check if a node is a definition node
   */
  private isDefinitionNode(node: Node): boolean {
    const definitionTypes = [
      // JavaScript/TypeScript
      'function_declaration',
      'function_expression',
      'arrow_function',
      'variable_declarator',
      'class_declaration',
      'method_definition',
      'formal_parameter',
      'assignment_expression',
      'lexical_declaration',
      // Python
      'function_definition',
      'class_definition',
      'assignment',
      // Go
      'function_declaration',
      'method_declaration',
      'var_spec',
      'const_spec',
      'short_var_declaration',
      // Rust
      'function_item',
      'let_declaration',
      'const_item',
      'static_item',
      // Java
      'method_declaration',
      'constructor_declaration',
      'field_declaration',
      'local_variable_declaration',
      // C/C++
      'function_definition',
      'declaration',
      'init_declarator',
    ];

    return definitionTypes.includes(node.type);
  }

  /**
   * Get the name from a definition node
   */
  private getDefinitionName(node: Node): string | null {
    // Try common field names first
    const nameNode =
      node.childForFieldName('name') ||
      node.childForFieldName('left') ||
      node.childForFieldName('pattern') ||
      node.childForFieldName('declarator');

    if (nameNode) {
      // If the name node is a declarator, get its identifier
      if (nameNode.type === 'identifier' || nameNode.type === 'type_identifier') {
        return nameNode.text;
      }

      // Try to find an identifier child
      const identifierChild = nameNode.namedChildren.find(
        (c) => c.type === 'identifier' || c.type === 'type_identifier'
      );
      if (identifierChild) {
        return identifierChild.text;
      }

      return nameNode.text;
    }

    // Fallback: look for first identifier child
    for (const child of node.namedChildren) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text;
      }
    }

    return null;
  }

  /**
   * Find the scope that contains a node
   */
  private findScope(node: Node): Node {
    let current: Node | null = node;

    while (current) {
      if (this.isScopeNode(current)) {
        return current;
      }
      current = current.parent;
    }

    // If no scope found, return the root
    return node.tree.rootNode;
  }

  /**
   * Check if a node creates a new scope
   */
  private isScopeNode(node: Node): boolean {
    const scopeTypes = [
      // JavaScript/TypeScript
      'program',
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition',
      'class_body',
      'class_declaration',
      'block',
      'statement_block',
      'for_statement',
      'for_in_statement',
      'while_statement',
      'if_statement',
      'try_statement',
      'catch_clause',
      // Python
      'module',
      'function_definition',
      'class_definition',
      // Go
      'source_file',
      'function_declaration',
      'method_declaration',
      'block',
      // Rust
      'source_file',
      'function_item',
      'impl_item',
      'trait_item',
      'mod_item',
      'block',
      // Java
      'program',
      'method_declaration',
      'constructor_declaration',
      'class_body',
      'block',
      // C/C++
      'translation_unit',
      'function_definition',
      'compound_statement',
    ];

    return scopeTypes.includes(node.type);
  }

  /**
   * Check if a node is within a given scope
   */
  private isInScope(node: Node, scope: Node): boolean {
    let current: Node | null = node;

    while (current) {
      if (current === scope) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Determine if a reference is a read or write
   */
  private determineReferenceKind(node: Node): 'definition' | 'read' | 'write' {
    const parent = node.parent;
    if (!parent) return 'read';

    // Check if this is a definition
    if (this.isDefinitionNode(parent)) {
      const defName = this.getDefinitionName(parent);
      if (defName === node.text) {
        return 'definition';
      }
    }

    // Check if this is a write (assignment)
    if (
      parent.type === 'assignment_expression' ||
      parent.type === 'augmented_assignment' ||
      parent.type === 'assignment'
    ) {
      const left = parent.childForFieldName('left');
      if (left && this.containsNode(left, node)) {
        return 'write';
      }
    }

    // Check for update expressions (++, --)
    if (parent.type === 'update_expression') {
      return 'write';
    }

    // Default to read
    return 'read';
  }

  /**
   * Check if a parent node contains a child node
   */
  private containsNode(parent: Node, child: Node): boolean {
    if (parent === child) return true;

    for (const c of parent.children) {
      if (this.containsNode(c, child)) {
        return true;
      }
    }

    return false;
  }
}
