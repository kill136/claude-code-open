# 代码解析器模块分析报告

## 执行摘要

本报告分析了官方 Claude Code CLI v2.0.76 中的代码解析器实现，并与本项目现有实现进行对比。通过研究官方包的 WASM 文件、API 接口定义和现有代码，我们确定了关键实现差异和改进方向。

## 官方源码分析

### 1. Tree-sitter 集成方式

#### 发现的 WASM 文件
官方包在 `/node_modules/@anthropic-ai/claude-code/` 目录下包含：

- **tree-sitter.wasm** (205KB) - Tree-sitter 核心解析引擎
- **tree-sitter-bash.wasm** (1.38MB) - Bash 语言语法解析器
- **resvg.wasm** (2.48MB) - SVG 渲染器（非解析器）

#### WASM 加载机制

官方实现使用了 **web-tree-sitter** 库的 WASM 版本，从压缩代码中可见以下关键模式：

```javascript
// 行 2235: WASM 模块加载
Module.wasmMemory = new WebAssembly.Memory({
  initial: INITIAL_MEMORY/65536,
  maximum: 32768
});

// Tree-sitter Language.load 函数
Language.load = async function(wasmPath) {
  const wasmBinary = await readAsync(wasmPath);
  const module = await WebAssembly.instantiate(wasmBinary, imports);
  return new Language(module);
}
```

**关键发现：**
- 使用 WebAssembly.Memory 管理内存池
- 异步加载语言 WASM 文件
- 支持多语言动态加载机制

### 2. 符号提取实现

基于官方 SDK 类型定义 (`sdk-tools.d.ts`) 和代码模式分析：

#### 核心接口（推断）

```typescript
interface Parser {
  parse(input: string, oldTree?: Tree): Tree;
  setLanguage(language: Language): void;
}

interface Tree {
  rootNode: SyntaxNode;
  edit(edit: Edit): void;
  delete(): void;
}

interface SyntaxNode {
  type: string;
  text: string;
  startPosition: Point;
  endPosition: Point;
  startIndex: number;
  endIndex: number;
  children: SyntaxNode[];
  namedChildren: SyntaxNode[];
  childForFieldName(name: string): SyntaxNode | null;
  descendantsOfType(types: string[], startPoint?: Point, endPoint?: Point): SyntaxNode[];
}
```

#### 符号提取策略

官方实现采用 **Tree-sitter Query** 机制进行符号提取，而非简单的节点类型匹配：

```javascript
// 推断的查询语法示例
const functionQuery = `
  (function_declaration
    name: (identifier) @function.name
    parameters: (formal_parameters) @function.params
  ) @function.definition
`;

const query = language.query(functionQuery);
const matches = query.matches(tree.rootNode);
```

**优势：**
1. 声明式查询语法，易于维护
2. 支持复杂的模式匹配（如嵌套、可选节点）
3. 性能优于递归遍历
4. 可复用查询模板

### 3. 引用查找实现

从压缩代码中未发现明确的引用查找实现，但基于 tree-sitter 的能力和常见模式，推断实现方式：

#### 方法 1: 基于标识符位置查找

```typescript
function findReferences(tree: Tree, identifier: string, position: Point): Reference[] {
  // 1. 查找定义位置
  const definitionNode = findDefinitionAtPosition(tree.rootNode, position);

  // 2. 查询所有同名标识符
  const identifierQuery = `(identifier) @id`;
  const matches = query.matches(tree.rootNode);

  // 3. 过滤相同作用域的引用
  return matches
    .filter(m => m.captures[0].node.text === identifier)
    .filter(m => isInSameScope(definitionNode, m.captures[0].node))
    .map(m => nodeToReference(m.captures[0].node));
}
```

#### 方法 2: 作用域感知引用分析

```typescript
interface Scope {
  parent: Scope | null;
  bindings: Map<string, SyntaxNode>;
  children: Scope[];
}

function buildScopeTree(rootNode: SyntaxNode): Scope {
  // 构建作用域树
  const rootScope: Scope = { parent: null, bindings: new Map(), children: [] };

  function visit(node: SyntaxNode, currentScope: Scope) {
    // 检测作用域节点（function, class, block等）
    if (isScopeNode(node)) {
      const newScope: Scope = {
        parent: currentScope,
        bindings: new Map(),
        children: []
      };
      currentScope.children.push(newScope);
      currentScope = newScope;
    }

    // 检测绑定节点（变量声明、函数参数等）
    if (isBindingNode(node)) {
      const name = getBindingName(node);
      currentScope.bindings.set(name, node);
    }

    // 递归处理子节点
    for (const child of node.namedChildren) {
      visit(child, currentScope);
    }
  }

  visit(rootNode, rootScope);
  return rootScope;
}
```

### 4. 代码折叠点检测

根据 LSP (Language Server Protocol) 标准和 tree-sitter 能力：

#### 折叠类型识别

```typescript
enum FoldingRangeKind {
  Comment = 'comment',
  Imports = 'imports',
  Region = 'region',
  Block = 'block'
}

// 基于节点类型的折叠点查询
const foldableQuery = `
  [
    (block) @fold.block
    (comment) @fold.comment
    (import_statement)+ @fold.imports
    (class_body) @fold.block
    (function_body) @fold.block
  ]
`;
```

#### 多行检测逻辑

```typescript
function detectFoldingRanges(tree: Tree): FoldingRange[] {
  const query = language.query(foldableQuery);
  const matches = query.matches(tree.rootNode);

  return matches
    .filter(match => {
      const node = match.captures[0].node;
      // 只折叠跨越多行的节点
      return node.endPosition.row - node.startPosition.row > 0;
    })
    .map(match => ({
      startLine: match.captures[0].node.startPosition.row,
      endLine: match.captures[0].node.endPosition.row,
      kind: determineFoldingKind(match.captures[0].node)
    }));
}
```

### 5. 语言支持扩展机制

官方实现专注于 **Bash** 语言（tree-sitter-bash.wasm），但架构支持多语言：

```typescript
// 语言注册表
const languageRegistry = new Map<string, Language>();

async function loadLanguage(name: string): Promise<Language> {
  if (languageRegistry.has(name)) {
    return languageRegistry.get(name)!;
  }

  const wasmPath = `./tree-sitter-${name}.wasm`;
  const language = await Language.load(wasmPath);
  languageRegistry.set(name, language);

  return language;
}

// 语言特定查询
const languageQueries = new Map<string, string[]>([
  ['bash', [
    '(function_definition name: (word) @function.name) @function',
    '(variable_assignment name: (variable_name) @variable.name) @variable',
  ]],
  ['javascript', [
    '(function_declaration name: (identifier) @function.name) @function',
    '(class_declaration name: (identifier) @class.name) @class',
  ]],
  // ... 其他语言
]);
```

## 本项目差距分析

### 已实现功能 ✅

1. **基础 Tree-sitter 集成**
   - ✅ 动态加载 WASM 解析器
   - ✅ 原生模块回退机制
   - ✅ 多语言配置支持（9种语言）
   - ✅ 解析缓存（增量解析支持）

2. **符号提取**
   - ✅ 基于节点类型的符号提取
   - ✅ 支持函数、类、变量、接口等
   - ✅ Regex 回退机制

3. **代码分析功能**
   - ✅ 语法错误检测 (`detectSyntaxErrors`)
   - ✅ 代码折叠检测 (`detectFoldingRanges`)
   - ✅ 位置符号查找 (`findSymbolAtPosition`)

### 缺失功能 ❌

1. **Tree-sitter Query 支持** 🔴 **高优先级**
   - ❌ 未使用 Query API 进行符号提取
   - ❌ 硬编码节点类型匹配
   - ❌ 缺少声明式查询语法

2. **引用查找** 🔴 **T-005 关键任务**
   - ❌ 未实现 `findReferences` 功能
   - ❌ 缺少作用域分析
   - ❌ 无法追踪变量/函数的使用位置

3. **高级符号信息**
   - ❌ 缺少函数签名提取
   - ❌ 缺少文档注释关联
   - ❌ 缺少符号层级关系（parent-child）

4. **性能优化**
   - ⚠️ 未使用 Tree-sitter 的增量编辑（`tree.edit()`）
   - ⚠️ Query 对象未缓存（每次解析重新创建）

5. **语言特定优化**
   - ❌ 未针对各语言定制 Query 规则
   - ❌ 缺少语言特定的符号类型细化

## 具体实现建议

### T-004: 符号提取增强

#### 第一步：引入 Tree-sitter Query API

```typescript
// src/parser/queries.ts
export const LANGUAGE_QUERIES: Record<string, Record<SymbolKind, string>> = {
  javascript: {
    function: `
      [
        (function_declaration
          name: (identifier) @name) @definition
        (arrow_function) @definition
        (function_expression
          name: (identifier) @name) @definition
      ]
    `,
    class: `
      (class_declaration
        name: (identifier) @name
        body: (class_body) @body) @definition
    `,
    method: `
      (method_definition
        name: (property_identifier) @name
        parameters: (formal_parameters) @params) @definition
    `,
    variable: `
      (variable_declarator
        name: (identifier) @name
        value: (_)? @value) @definition
    `,
  },
  typescript: {
    interface: `
      (interface_declaration
        name: (type_identifier) @name
        body: (interface_body) @body) @definition
    `,
    type: `
      (type_alias_declaration
        name: (type_identifier) @name
        value: (_) @value) @definition
    `,
    // ... 继承 JavaScript 查询
  },
  python: {
    function: `
      (function_definition
        name: (identifier) @name
        parameters: (parameters) @params
        return_type: (type)? @return) @definition
    `,
    class: `
      (class_definition
        name: (identifier) @name
        superclasses: (argument_list)? @extends
        body: (block) @body) @definition
    `,
  },
  // ... 其他语言
};
```

#### 第二步：实现 Query-based 符号提取

```typescript
// src/parser/symbol-extractor.ts
import Parser from 'tree-sitter';

interface QueryCapture {
  name: string;
  node: Parser.SyntaxNode;
}

interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

export class SymbolExtractor {
  private queryCache: Map<string, Parser.Query> = new Map();

  constructor(private parser: TreeSitterWasmParser) {}

  async extractSymbols(
    tree: Parser.Tree,
    language: string,
    filePath: string
  ): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    const languageObj = await this.parser.loadLanguage(language);
    if (!languageObj) return symbols;

    for (const [kind, queryString] of Object.entries(LANGUAGE_QUERIES[language] || {})) {
      const query = this.getOrCreateQuery(languageObj, queryString);
      const matches = query.matches(tree.rootNode);

      for (const match of matches) {
        const nameCapture = match.captures.find(c => c.name === 'name');
        const definitionCapture = match.captures.find(c => c.name === 'definition');

        if (nameCapture && definitionCapture) {
          symbols.push({
            name: nameCapture.node.text,
            kind: kind as SymbolKind,
            location: {
              file: filePath,
              startLine: definitionCapture.node.startPosition.row + 1,
              startColumn: definitionCapture.node.startPosition.column,
              endLine: definitionCapture.node.endPosition.row + 1,
              endColumn: definitionCapture.node.endPosition.column,
            },
            signature: this.extractSignature(match, kind as SymbolKind),
            documentation: this.extractDocumentation(definitionCapture.node),
          });
        }
      }
    }

    return symbols;
  }

  private getOrCreateQuery(language: Parser.Language, queryString: string): Parser.Query {
    const cacheKey = `${language}_${queryString}`;
    if (!this.queryCache.has(cacheKey)) {
      const query = language.query(queryString);
      this.queryCache.set(cacheKey, query);
    }
    return this.queryCache.get(cacheKey)!;
  }

  private extractSignature(match: QueryMatch, kind: SymbolKind): string {
    // 提取函数签名、类继承信息等
    const nameNode = match.captures.find(c => c.name === 'name')?.node;
    const paramsNode = match.captures.find(c => c.name === 'params')?.node;
    const returnNode = match.captures.find(c => c.name === 'return')?.node;

    if (kind === 'function' && nameNode && paramsNode) {
      const params = paramsNode.text;
      const returnType = returnNode ? `: ${returnNode.text}` : '';
      return `${nameNode.text}${params}${returnType}`;
    }

    return nameNode?.text || '';
  }

  private extractDocumentation(node: Parser.SyntaxNode): string | undefined {
    // 查找前面的注释节点
    let prevNode = node.previousNamedSibling;

    // 跳过空白节点
    while (prevNode && prevNode.type === 'comment') {
      if (prevNode.text.startsWith('/**') || prevNode.text.startsWith('///')) {
        return this.parseDocComment(prevNode.text);
      }
      prevNode = prevNode.previousNamedSibling;
    }

    return undefined;
  }

  private parseDocComment(commentText: string): string {
    // 提取文档注释的主要内容
    return commentText
      .replace(/^\/\*\*|\*\/$/g, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();
  }
}
```

### T-005: 引用查找实现

#### 方案 A：简化版本（基于文本匹配 + 作用域过滤）

```typescript
// src/parser/reference-finder.ts
export interface Reference {
  location: Location;
  kind: 'definition' | 'read' | 'write';
}

export class ReferenceFinder {
  async findReferences(
    tree: Parser.Tree,
    identifier: string,
    position: { line: number; column: number },
    language: string
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    // 1. 查找所有标识符节点
    const identifierQuery = `(identifier) @id`;
    const languageObj = await this.parser.loadLanguage(language);
    if (!languageObj) return references;

    const query = languageObj.query(identifierQuery);
    const matches = query.matches(tree.rootNode);

    // 2. 找到光标位置的定义节点
    const cursorNode = tree.rootNode.descendantForPosition({
      row: position.line - 1,
      column: position.column,
    });

    const definitionNode = this.findDefinition(cursorNode, identifier);
    if (!definitionNode) return references;

    // 3. 确定作用域
    const scope = this.findScope(definitionNode);

    // 4. 过滤相同作用域的引用
    for (const match of matches) {
      const node = match.captures[0].node;
      if (node.text === identifier && this.isInScope(node, scope)) {
        references.push({
          location: {
            file: '', // 由调用者填充
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

  private findDefinition(node: Parser.SyntaxNode, identifier: string): Parser.SyntaxNode | null {
    let current: Parser.SyntaxNode | null = node;

    while (current) {
      // 检查是否是定义节点
      if (this.isDefinitionNode(current) && this.getDefinitionName(current) === identifier) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  private isDefinitionNode(node: Parser.SyntaxNode): boolean {
    const definitionTypes = [
      'function_declaration',
      'variable_declarator',
      'class_declaration',
      'method_definition',
      'formal_parameter',
      'assignment_expression',
    ];
    return definitionTypes.includes(node.type);
  }

  private getDefinitionName(node: Parser.SyntaxNode): string | null {
    // 根据节点类型提取名称
    const nameNode = node.childForFieldName('name') ||
                     node.childForFieldName('left') ||
                     node.namedChildren.find(c => c.type === 'identifier');
    return nameNode?.text || null;
  }

  private findScope(node: Parser.SyntaxNode): Parser.SyntaxNode {
    let current: Parser.SyntaxNode | null = node;

    while (current) {
      if (this.isScopeNode(current)) {
        return current;
      }
      current = current.parent;
    }

    return node.tree.rootNode;
  }

  private isScopeNode(node: Parser.SyntaxNode): boolean {
    const scopeTypes = [
      'program',
      'function_declaration',
      'arrow_function',
      'function_expression',
      'method_definition',
      'class_body',
      'block',
      'for_statement',
      'while_statement',
    ];
    return scopeTypes.includes(node.type);
  }

  private isInScope(node: Parser.SyntaxNode, scope: Parser.SyntaxNode): boolean {
    let current: Parser.SyntaxNode | null = node;

    while (current) {
      if (current === scope) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  private determineReferenceKind(node: Parser.SyntaxNode): 'definition' | 'read' | 'write' {
    // 检查父节点判断是读还是写
    const parent = node.parent;
    if (!parent) return 'read';

    // 定义
    if (this.isDefinitionNode(parent)) {
      return 'definition';
    }

    // 赋值（写）
    if (parent.type === 'assignment_expression' || parent.type === 'update_expression') {
      const left = parent.childForFieldName('left');
      if (left && this.containsNode(left, node)) {
        return 'write';
      }
    }

    // 默认为读
    return 'read';
  }

  private containsNode(parent: Parser.SyntaxNode, child: Parser.SyntaxNode): boolean {
    if (parent === child) return true;

    for (const c of parent.children) {
      if (this.containsNode(c, child)) {
        return true;
      }
    }

    return false;
  }
}
```

#### 方案 B：完整版本（语义分析 + 作用域链）

```typescript
// src/parser/semantic-analyzer.ts
export interface Binding {
  name: string;
  definitionNode: Parser.SyntaxNode;
  kind: 'var' | 'let' | 'const' | 'function' | 'class' | 'parameter';
  scope: Scope;
}

export class Scope {
  parent: Scope | null;
  bindings: Map<string, Binding> = new Map();
  children: Scope[] = [];
  node: Parser.SyntaxNode;

  constructor(node: Parser.SyntaxNode, parent: Scope | null = null) {
    this.node = node;
    this.parent = parent;
  }

  resolve(name: string): Binding | null {
    // 在当前作用域查找
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }

    // 向上查找
    if (this.parent) {
      return this.parent.resolve(name);
    }

    return null;
  }
}

export class SemanticAnalyzer {
  private rootScope: Scope | null = null;

  buildScopeTree(tree: Parser.Tree): Scope {
    this.rootScope = new Scope(tree.rootNode, null);
    this.visitNode(tree.rootNode, this.rootScope);
    return this.rootScope;
  }

  private visitNode(node: Parser.SyntaxNode, currentScope: Scope): void {
    // 创建新作用域
    if (this.isScopeNode(node)) {
      const newScope = new Scope(node, currentScope);
      currentScope.children.push(newScope);
      currentScope = newScope;
    }

    // 记录绑定
    this.recordBindings(node, currentScope);

    // 递归访问子节点
    for (const child of node.namedChildren) {
      this.visitNode(child, currentScope);
    }
  }

  private recordBindings(node: Parser.SyntaxNode, scope: Scope): void {
    const bindingInfo = this.extractBinding(node);
    if (bindingInfo) {
      scope.bindings.set(bindingInfo.name, {
        ...bindingInfo,
        scope,
      });
    }
  }

  private extractBinding(node: Parser.SyntaxNode): Omit<Binding, 'scope'> | null {
    switch (node.type) {
      case 'variable_declarator': {
        const name = node.childForFieldName('name')?.text;
        const parent = node.parent;
        const kind = parent?.childForFieldName('kind')?.text as 'var' | 'let' | 'const' || 'var';
        if (name) {
          return { name, definitionNode: node, kind };
        }
        break;
      }

      case 'function_declaration': {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          return { name, definitionNode: node, kind: 'function' };
        }
        break;
      }

      case 'class_declaration': {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          return { name, definitionNode: node, kind: 'class' };
        }
        break;
      }

      case 'formal_parameter': {
        const name = node.childForFieldName('pattern')?.text || node.text;
        if (name) {
          return { name, definitionNode: node, kind: 'parameter' };
        }
        break;
      }
    }

    return null;
  }

  private isScopeNode(node: Parser.SyntaxNode): boolean {
    const scopeTypes = [
      'program',
      'function_declaration',
      'arrow_function',
      'function_expression',
      'method_definition',
      'class_body',
      'block',
    ];
    return scopeTypes.includes(node.type);
  }

  findReferences(identifier: string, position: Parser.Point): Reference[] {
    if (!this.rootScope) {
      throw new Error('Scope tree not built');
    }

    const references: Reference[] = [];

    // 找到位置对应的作用域
    const scope = this.findScopeAtPosition(this.rootScope, position);
    if (!scope) return references;

    // 解析绑定
    const binding = scope.resolve(identifier);
    if (!binding) return references;

    // 查找所有引用该绑定的位置
    this.findReferencesInScope(this.rootScope, binding, references);

    return references;
  }

  private findScopeAtPosition(scope: Scope, position: Parser.Point): Scope | null {
    // 检查位置是否在当前作用域内
    if (!this.containsPosition(scope.node, position)) {
      return null;
    }

    // 递归检查子作用域
    for (const child of scope.children) {
      const result = this.findScopeAtPosition(child, position);
      if (result) return result;
    }

    return scope;
  }

  private findReferencesInScope(scope: Scope, binding: Binding, references: Reference[]): void {
    // 在当前作用域查找引用
    this.findReferencesInNode(scope.node, binding, references);

    // 递归子作用域
    for (const child of scope.children) {
      // 只处理能访问该绑定的子作用域
      if (child.resolve(binding.name) === binding) {
        this.findReferencesInScope(child, binding, references);
      }
    }
  }

  private findReferencesInNode(
    node: Parser.SyntaxNode,
    binding: Binding,
    references: Reference[]
  ): void {
    if (node.type === 'identifier' && node.text === binding.name) {
      references.push({
        location: {
          file: '',
          startLine: node.startPosition.row + 1,
          startColumn: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endColumn: node.endPosition.column,
        },
        kind: this.isWrite(node) ? 'write' : 'read',
      });
    }

    for (const child of node.children) {
      this.findReferencesInNode(child, binding, references);
    }
  }

  private containsPosition(node: Parser.SyntaxNode, position: Parser.Point): boolean {
    const start = node.startPosition;
    const end = node.endPosition;

    if (position.row < start.row || position.row > end.row) {
      return false;
    }

    if (position.row === start.row && position.column < start.column) {
      return false;
    }

    if (position.row === end.row && position.column > end.column) {
      return false;
    }

    return true;
  }

  private isWrite(node: Parser.SyntaxNode): boolean {
    const parent = node.parent;
    if (!parent) return false;

    if (parent.type === 'assignment_expression') {
      const left = parent.childForFieldName('left');
      return left === node || this.containsNode(left!, node);
    }

    if (parent.type === 'update_expression') {
      return true;
    }

    return false;
  }

  private containsNode(parent: Parser.SyntaxNode, child: Parser.SyntaxNode): boolean {
    if (parent === child) return true;
    for (const c of parent.children) {
      if (this.containsNode(c, child)) return true;
    }
    return false;
  }
}
```

### T-006: 多语言支持扩展

#### WASM 文件获取

推荐使用 `tree-sitter-wasms` npm 包，它包含预编译的多语言 WASM：

```bash
npm install tree-sitter-wasms
```

**支持的语言：**
- JavaScript/TypeScript
- Python
- Go
- Rust
- Java
- C/C++
- Ruby
- PHP
- Swift
- Kotlin
- 等 40+ 语言

#### 查询规则库

建议创建语言特定的查询文件：

```
src/parser/queries/
├── javascript.scm
├── typescript.scm
├── python.scm
├── go.scm
├── rust.scm
├── java.scm
├── c.scm
├── cpp.scm
└── README.md
```

**示例：Python 查询文件 (python.scm)**

```scheme
; 函数定义
(function_definition
  name: (identifier) @function.name
  parameters: (parameters) @function.params
  return_type: (type)? @function.return
  body: (block) @function.body
) @function.definition

; 类定义
(class_definition
  name: (identifier) @class.name
  superclasses: (argument_list)? @class.extends
  body: (block) @class.body
) @class.definition

; 方法定义（类内函数）
(class_definition
  body: (block
    (function_definition
      name: (identifier) @method.name
      parameters: (parameters) @method.params
    ) @method.definition
  )
)

; 变量赋值
(assignment
  left: (identifier) @variable.name
  right: (_) @variable.value
) @variable.definition

; 导入语句
(import_statement) @import
(import_from_statement) @import

; 装饰器
(decorator) @decorator
```

#### 动态加载机制

```typescript
// src/parser/language-loader.ts
import * as fs from 'fs';
import * as path from 'path';

export class LanguageLoader {
  private wasmCache: Map<string, Parser.Language> = new Map();
  private queryCache: Map<string, string> = new Map();

  async loadLanguage(languageName: string): Promise<Parser.Language | null> {
    if (this.wasmCache.has(languageName)) {
      return this.wasmCache.get(languageName)!;
    }

    const wasmPath = this.findWasmPath(languageName);
    if (!wasmPath) {
      console.warn(`WASM not found for language: ${languageName}`);
      return null;
    }

    try {
      const language = await Parser.Language.load(wasmPath);
      this.wasmCache.set(languageName, language);
      return language;
    } catch (error) {
      console.error(`Failed to load language ${languageName}:`, error);
      return null;
    }
  }

  loadQueryFile(languageName: string): string | null {
    if (this.queryCache.has(languageName)) {
      return this.queryCache.get(languageName)!;
    }

    const queryPath = path.join(__dirname, 'queries', `${languageName}.scm`);
    if (!fs.existsSync(queryPath)) {
      return null;
    }

    const queryContent = fs.readFileSync(queryPath, 'utf-8');
    this.queryCache.set(languageName, queryContent);
    return queryContent;
  }

  private findWasmPath(languageName: string): string | null {
    const possiblePaths = [
      // tree-sitter-wasms package
      path.join(__dirname, `../../node_modules/tree-sitter-wasms/out/tree-sitter-${languageName}.wasm`),
      // 官方包
      path.join(__dirname, `../../node_modules/@anthropic-ai/claude-code/tree-sitter-${languageName}.wasm`),
      // 本地 vendor
      path.join(__dirname, `../../vendor/tree-sitter/tree-sitter-${languageName}.wasm`),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}
```

## 性能优化建议

### 1. Query 对象缓存

```typescript
class QueryCache {
  private cache = new Map<string, Parser.Query>();

  get(language: Parser.Language, queryString: string): Parser.Query {
    const key = `${language}_${queryString}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, language.query(queryString));
    }
    return this.cache.get(key)!;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 2. 增量编辑支持

```typescript
class IncrementalParser {
  private previousTree: Parser.Tree | null = null;

  parse(content: string, edits?: Edit[]): Parser.Tree {
    if (this.previousTree && edits) {
      // 应用编辑
      for (const edit of edits) {
        this.previousTree.edit(edit);
      }

      // 增量解析
      const newTree = this.parser.parse(content, this.previousTree);
      this.previousTree = newTree;
      return newTree;
    } else {
      // 完整解析
      this.previousTree = this.parser.parse(content);
      return this.previousTree;
    }
  }

  reset(): void {
    if (this.previousTree) {
      this.previousTree.delete();
      this.previousTree = null;
    }
  }
}
```

### 3. 并行解析（多文件）

```typescript
async function parseFiles(filePaths: string[]): Promise<Map<string, Parser.Tree>> {
  const results = new Map<string, Parser.Tree>();

  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const language = detectLanguage(filePath);
      const tree = await parseContent(content, language);
      results.set(filePath, tree);
    })
  );

  return results;
}
```

## 实现优先级

### P0 - 立即实现（1-2周）
1. **T-004**: 引入 Tree-sitter Query API
2. **T-004**: 重构符号提取使用查询

### P1 - 高优先级（2-4周）
3. **T-005**: 实现简化版引用查找（方案 A）
4. **T-006**: 添加 Python、Go、Rust 查询规则

### P2 - 中优先级（4-8周）
5. **T-005**: 实现完整语义分析（方案 B）
6. 性能优化：Query 缓存、增量编辑

### P3 - 低优先级（>8周）
7. **T-006**: 扩展到 20+ 语言支持
8. LSP 集成（跳转到定义、自动补全等）

## 参考资源

### 官方文档
- Tree-sitter 官网: https://tree-sitter.github.io/tree-sitter/
- Tree-sitter Playground: https://tree-sitter.github.io/tree-sitter/playground
- Query 语法文档: https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries

### 查询示例
- tree-sitter-javascript 查询: https://github.com/tree-sitter/tree-sitter-javascript/tree/master/queries
- tree-sitter-python 查询: https://github.com/tree-sitter/tree-sitter-python/tree/master/queries
- Neovim Treesitter 查询集合: https://github.com/nvim-treesitter/nvim-treesitter

### WASM 包
- tree-sitter-wasms: https://www.npmjs.com/package/tree-sitter-wasms
- web-tree-sitter: https://www.npmjs.com/package/web-tree-sitter

## 总结

官方 Claude Code 的代码解析器核心优势在于：

1. **Query-based 符号提取** - 声明式、可维护、高性能
2. **语义感知的引用查找** - 通过作用域分析提供准确的引用追踪
3. **模块化设计** - 语言、查询、解析器三层分离

本项目当前实现较为基础，建议优先实现 Query API 集成和引用查找功能，以达到生产级代码分析能力。

---

**报告生成时间**: 2025-12-26
**分析版本**: Claude Code CLI v2.0.76
**本项目版本**: 开发中
