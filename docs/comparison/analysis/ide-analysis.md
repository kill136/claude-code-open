# IDE集成模块分析报告

## 概述

本报告详细分析官方 Claude Code v2.0.76 中的 IDE 集成功能，包括 LSP (Language Server Protocol) 客户端实现、诊断信息处理、以及代码智能功能。

## 官方源码分析

### 1. LSP 工具实现 (cli.js:2927-3119)

官方源码在 `cli.js` 的 2927-3119 行实现了完整的 LSP 工具。

#### 1.1 核心配置

```typescript
// 工具名称和描述
const L49 = "LSP";
const kq0 = `Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:
- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.`;
```

#### 1.2 输入/输出 Schema

```typescript
// 输入 Schema (简化)
W27 = m.strictObject({
  operation: m.enum([
    "goToDefinition",
    "findReferences",
    "hover",
    "documentSymbol",
    "workspaceSymbol",
    "goToImplementation",
    "prepareCallHierarchy",
    "incomingCalls",
    "outgoingCalls"
  ]),
  filePath: m.string(),
  line: m.number().int().positive(),
  character: m.number().int().positive()
});

// 输出 Schema
K27 = m.object({
  operation: m.enum([...]),
  result: m.string(),
  filePath: m.string(),
  resultCount: m.number().int().nonnegative().optional(),
  fileCount: m.number().int().nonnegative().optional()
});
```

#### 1.3 LSP 协议转换函数 (V27)

```typescript
// cli.js:2970-3000
function V27(A, Q) {
  let B = I27(Q).href,  // pathToFileURL
  G = { line: A.line - 1, character: A.character - 1 };  // 转换为 0-based

  switch (A.operation) {
    case "goToDefinition":
      return {
        method: "textDocument/definition",
        params: {
          textDocument: { uri: B },
          position: G
        }
      };

    case "findReferences":
      return {
        method: "textDocument/references",
        params: {
          textDocument: { uri: B },
          position: G,
          context: { includeDeclaration: true }
        }
      };

    case "hover":
      return {
        method: "textDocument/hover",
        params: {
          textDocument: { uri: B },
          position: G
        }
      };

    case "documentSymbol":
      return {
        method: "textDocument/documentSymbol",
        params: { textDocument: { uri: B } }
      };

    case "workspaceSymbol":
      return {
        method: "workspace/symbol",
        params: { query: "" }
      };

    case "goToImplementation":
      return {
        method: "textDocument/implementation",
        params: {
          textDocument: { uri: B },
          position: G
        }
      };

    case "prepareCallHierarchy":
      return {
        method: "textDocument/prepareCallHierarchy",
        params: {
          textDocument: { uri: B },
          position: G
        }
      };

    case "incomingCalls":
    case "outgoingCalls":
      return {
        method: "textDocument/prepareCallHierarchy",
        params: {
          textDocument: { uri: B },
          position: G
        }
      };
  }
}
```

#### 1.4 工具执行流程 (call 函数)

```typescript
// cli.js:3070-3119 (简化重构)
async call(A, Q) {
  let B = q4(A.filePath),  // 解析文件路径
      G = t1(),             // 获取工作目录
      Z = _m();             // 获取 LSP 服务器管理器

  if (!Z) {
    return {
      data: {
        operation: A.operation,
        result: "LSP server manager not initialized. This may indicate a startup issue.",
        filePath: A.filePath
      }
    };
  }

  // 构建 LSP 请求
  let { method: Y, params: J } = V27(A, B);

  try {
    // 如果文件未打开，先打开文件
    if (!Z.isFileOpen(B)) {
      let H = await X27(B, "utf-8");  // readFile
      await Z.openFile(B, H);
    }

    // 发送 LSP 请求
    let X = await Z.sendRequest(B, Y, J);

    if (X === undefined) {
      return {
        data: {
          operation: A.operation,
          result: `No LSP server available for file type: ${bq0.extname(B)}`,
          filePath: A.filePath
        }
      };
    }

    // 处理 incomingCalls/outgoingCalls 的二次请求
    if (A.operation === "incomingCalls" || A.operation === "outgoingCalls") {
      let H = X;
      if (!H || H.length === 0) {
        return {
          data: {
            operation: A.operation,
            result: "No call hierarchy item found at this position",
            filePath: A.filePath,
            resultCount: 0,
            fileCount: 0
          }
        };
      }

      let D = A.operation === "incomingCalls"
        ? "callHierarchy/incomingCalls"
        : "callHierarchy/outgoingCalls";

      X = await Z.sendRequest(B, D, { item: H[0] });

      if (X === undefined) {
        // 记录错误
      }
    }

    // 格式化结果
    let { formatted: I, resultCount: W, fileCount: K } = D27(A.operation, X, G);

    return {
      data: {
        operation: A.operation,
        result: I,
        filePath: A.filePath,
        resultCount: W,
        fileCount: K
      }
    };
  } catch (X) {
    let W = (X instanceof Error ? X : Error(String(X))).message;
    return {
      data: {
        operation: A.operation,
        result: `Error performing ${A.operation}: ${W}`,
        filePath: A.filePath
      }
    };
  }
}
```

### 2. LSP 服务器管理器

#### 2.1 管理器访问函数

```typescript
// 获取 LSP 管理器实例
function _m() {
  // 返回全局 LSP 服务器管理器实例
}

// 检查 LSP 状态
function EKA() {
  return {
    status: "ready" | "failed"
  };
}

// 在工具的 isEnabled 检查中使用
isEnabled() {
  if (EKA().status === "failed")
    return false;

  let Q = _m();
  if (Q) {
    let B = Q.getAllServers();
    if (B.size > 0) {
      if (!Array.from(B.values()).some((Z) => Z.state !== "error"))
        return false;
    }
  }
  return true;
}
```

#### 2.2 关键方法

```typescript
// LSP 服务器管理器的关键方法：
interface LSPServerManager {
  // 获取所有 LSP 服务器
  getAllServers(): Map<string, Server>;

  // 检查文件是否已打开
  isFileOpen(filePath: string): boolean;

  // 打开文件（发送 textDocument/didOpen）
  openFile(filePath: string, content: string): Promise<void>;

  // 发送 LSP 请求
  sendRequest(
    filePath: string,
    method: string,
    params: any
  ): Promise<any>;
}

// Server 状态
interface Server {
  state: "ready" | "error" | "initializing";
  // ...其他属性
}
```

### 3. 结果格式化函数

#### 3.1 goToDefinition 格式化 (yq0)

```typescript
// cli.js:2910-2916
function yq0(A, Q) {
  // 处理单个或多个定义结果
  if (!A || (Array.isArray(A) && A.length === 0))
    return "No definition found. This may occur if the symbol is not defined in the workspace, or if the LSP server has not fully indexed the file.";

  let B = Array.isArray(A) ? A : [A];

  if (B.length === 1)
    return `Definition found at ${gV1(B[0], Q)}`;

  let Z = F49(B, Q),  // 按文件分组
      Y = [`Found ${B.length} definitions across ${Z.size} files:`];

  for (let [J, X] of Z) {
    Y.push(`\n${J}:`);
    for (let I of X) {
      let W = I.range.start.line + 1,
          K = I.range.start.character + 1;
      Y.push(`  Line ${W}:${K}`);
    }
  }
  return Y.join('\n');
}
```

#### 3.2 findReferences 格式化 (E49)

```typescript
// cli.js:2912-2915
function E49(A, Q) {
  if (!A || A.length === 0)
    return "No references found. This may occur if the symbol is not used elsewhere, or if the LSP server has not fully indexed the project.";

  let B = F49(A, Q);  // 按文件分组
  let result = [`Found ${A.length} references across ${B.size} files:`];

  for (let [file, refs] of B) {
    result.push(`\n${file}:`);
    for (let ref of refs) {
      let line = ref.range.start.line + 1;
      let char = ref.range.start.character + 1;
      result.push(`  Line ${line}:${char}`);
    }
  }
  return result.join('\n');
}
```

#### 3.3 hover 格式化 (z49)

```typescript
// cli.js:2917-2919
function z49(A, Q) {
  if (!A)
    return "No hover information available. This may occur if the cursor is not on a symbol, or if the LSP server has not fully indexed the file.";

  let B = Z27(A.contents);  // 提取内容

  if (A.range) {
    let G = A.range.start.line + 1,
        Z = A.range.start.character + 1;
    return `Hover info at ${G}:${Z}:\n\n${B}`;
  }

  return `${B}`;
}

// 提取 hover 内容
function Z27(A) {
  if (Array.isArray(A))
    return A.map((Q) => {
      if (typeof Q === "string") return Q;
      return Q.value;
    }).join('\n\n');

  if (typeof A === "string")
    return A;

  if ("kind" in A)
    return A.value;

  return A.value;
}
```

#### 3.4 documentSymbol 格式化 ($49)

```typescript
// cli.js:2920-2922
function $49(A, Q) {
  if (!A || A.length === 0)
    return "No symbols found in document. This may occur if the file is empty or has no recognizable code structures.";

  // 递归计算符号数量（包括嵌套符号）
  let count = v49(A);

  let result = [`Found ${count} symbol${count === 1 ? "" : "s"} in document:`];

  // 格式化符号列表
  for (let symbol of A) {
    let kind = cDA(symbol.kind),  // 转换 SymbolKind
        line = symbol.range.start.line + 1;
    let text = `  ${symbol.name} (${kind}) - Line ${line}`;

    if (symbol.containerName)
      text += ` in ${symbol.containerName}`;

    result.push(text);
  }

  return result.join('\n');
}

// 递归计算符号数量
function v49(A) {
  let Q = A.length;
  for (let B of A) {
    if (B.children && B.children.length > 0)
      Q += v49(B.children);
  }
  return Q;
}
```

#### 3.5 workspaceSymbol 格式化 (vq0)

```typescript
// cli.js:2920
function vq0(A, Q) {
  if (!A || A.length === 0)
    return "No symbols found in workspace. This may occur if the workspace is empty, or if the LSP server has not finished indexing the project.";

  // 过滤无效符号
  let valid = A.filter((J) => J && J.location && J.location.uri);

  if (valid.length === 0)
    return "No symbols found in workspace. This may occur if the workspace is empty, or if the LSP server has not finished indexing the project.";

  let result = [`Found ${valid.length} symbol${valid.length === 1 ? "" : "s"} in workspace:`];
  let grouped = F49(valid, Q);  // 按文件分组

  for (let [file, symbols] of grouped) {
    result.push(`\n${file}:`);
    for (let symbol of symbols) {
      let kind = cDA(symbol.kind);
      let line = symbol.location.range.start.line + 1;
      let text = `  ${symbol.name} (${kind}) - Line ${line}`;

      if (symbol.containerName)
        text += ` in ${symbol.containerName}`;

      result.push(text);
    }
  }

  return result.join('\n');
}
```

#### 3.6 callHierarchy 格式化 (w49, q49)

```typescript
// incomingCalls 格式化 - cli.js:2923-2924
function w49(A, Q) {
  if (!A || A.length === 0)
    return "No incoming calls found (nothing calls this function)";

  let result = [`Found ${A.length} incoming call${A.length === 1 ? "" : "s"}:`];
  let grouped = new Map();

  // 按文件分组
  for (let call of A) {
    if (!call.from) continue;

    let file = VbA(call.from.uri, Q);  // 转换 URI
    if (!grouped.has(file))
      grouped.set(file, []);
    grouped.get(file).push(call);
  }

  // 格式化输出
  for (let [file, calls] of grouped) {
    result.push(`\n${file}:`);
    for (let call of calls) {
      if (!call.from) continue;

      let kind = cDA(call.from.kind);
      let line = call.from.range.start.line + 1;
      let text = `  ${call.from.name} (${kind}) - Line ${line}`;

      if (call.fromRanges && call.fromRanges.length > 0) {
        let ranges = call.fromRanges
          .map((r) => `${r.start.line + 1}:${r.start.character + 1}`)
          .join(", ");
        text += ` [calls at: ${ranges}]`;
      }

      result.push(text);
    }
  }

  return result.join('\n');
}

// outgoingCalls 格式化 - cli.js:2925-2926
function q49(A, Q) {
  if (!A || A.length === 0)
    return "No outgoing calls found (this function calls nothing)";

  // 与 incomingCalls 类似，但使用 call.to 而不是 call.from
  // ... 类似的实现
}
```

### 4. 辅助工具函数

#### 4.1 符号提取 (O49)

```typescript
// cli.js:2945-2946
function O49(A, Q, B) {
  // 从文件中提取光标位置的符号
  try {
    let G = jA(),  // fs
        Z = q4(A);  // 解析路径

    if (!G.existsSync(Z))
      return null;

    let J = G.readFileSync(Z, { encoding: "utf-8" }).split('\n');

    if (Q < 0 || Q >= J.length)
      return null;

    let X = J[Q];
    if (!X || B < 0 || B >= X.length)
      return null;

    // 使用正则表达式提取符号
    let I = /[\w$'!]+|[+\-*/%&|^~<>=]+/g;
    let W;

    while ((W = I.exec(X)) !== null) {
      let K = W.index;
      let V = K + W[0].length;

      if (B >= K && B < V) {
        let H = W[0];
        return H.length > 30 ? H.slice(0, 27) + "..." : H;
      }
    }

    return null;
  } catch (G) {
    return null;
  }
}
```

#### 4.2 URI 转换 (VbA)

```typescript
// 将文件 URI 转换为相对路径
function VbA(uri, workingDir) {
  // pathToFileURL 的逆操作
  // 将 file:// URI 转换为文件系统路径
  // 然后转换为相对于工作目录的路径
}
```

#### 4.3 SymbolKind 转换 (cDA)

```typescript
// 将 LSP SymbolKind 枚举转换为可读字符串
function cDA(kind) {
  const kinds = {
    1: "File",
    2: "Module",
    3: "Namespace",
    4: "Package",
    5: "Class",
    6: "Method",
    7: "Property",
    8: "Field",
    9: "Constructor",
    10: "Enum",
    11: "Interface",
    12: "Function",
    13: "Variable",
    14: "Constant",
    15: "String",
    16: "Number",
    17: "Boolean",
    18: "Array",
    19: "Object",
    20: "Key",
    21: "Null",
    22: "EnumMember",
    23: "Struct",
    24: "Event",
    25: "Operator",
    26: "TypeParameter"
  };

  return kinds[kind] || "Unknown";
}
```

#### 4.4 按文件分组 (F49)

```typescript
// 将位置列表按文件分组
function F49(locations, workingDir) {
  let grouped = new Map();

  for (let loc of locations) {
    let file = VbA(loc.uri || loc.location.uri, workingDir);

    if (!grouped.has(file))
      grouped.set(file, []);

    grouped.get(file).push(loc);
  }

  return grouped;
}
```

### 5. UI 渲染组件

#### 5.1 工具使用消息渲染 (_49)

```typescript
// cli.js:3048-3060
function _49(A, { verbose: Q }) {
  if (!A.operation)
    return null;

  let B = [];

  // 对于有位置信息的操作，显示符号和文件
  if ((A.operation === "goToDefinition" ||
       A.operation === "findReferences" ||
       A.operation === "hover" ||
       A.operation === "goToImplementation") &&
      A.filePath &&
      A.line !== undefined &&
      A.character !== undefined) {

    let G = O49(A.filePath, A.line - 1, A.character - 1);  // 提取符号
    let Z = Q ? A.filePath : r3(A.filePath);  // 相对路径

    if (G) {
      B.push(`operation: "${A.operation}"`);
      B.push(`symbol: "${G}"`);
      B.push(`in: "${Z}"`);
    } else {
      B.push(`operation: "${A.operation}"`);
      B.push(`file: "${Z}"`);
      B.push(`position: ${A.line}:${A.character}`);
    }

    return B.join(", ");
  }

  // 对于其他操作
  B.push(`operation: "${A.operation}"`);

  if (A.filePath) {
    let G = Q ? A.filePath : r3(A.filePath);
    B.push(`file: "${G}"`);
  }

  return B.join(", ");
}
```

#### 5.2 结果消息渲染 (S49)

```typescript
// cli.js:3065-3068
function S49(A, Q, { verbose: B }) {
  // 如果有统计信息，使用特殊组件
  if (A.resultCount !== undefined && A.fileCount !== undefined) {
    return createElement(J27, {
      operation: A.operation,
      resultCount: A.resultCount,
      fileCount: A.fileCount,
      content: A.result,
      verbose: B
    });
  }

  // 否则显示纯文本结果
  return createElement(k0, null,
    createElement(C, null, A.result)
  );
}

// 结果统计组件 (J27)
function J27({ operation, resultCount, fileCount, content, verbose }) {
  let labels = {
    goToDefinition: { singular: "definition", plural: "definitions" },
    findReferences: { singular: "reference", plural: "references" },
    documentSymbol: { singular: "symbol", plural: "symbols" },
    workspaceSymbol: { singular: "symbol", plural: "symbols" },
    hover: { singular: "hover info", plural: "hover info", special: "available" },
    goToImplementation: { singular: "implementation", plural: "implementations" },
    prepareCallHierarchy: { singular: "call item", plural: "call items" },
    incomingCalls: { singular: "caller", plural: "callers" },
    outgoingCalls: { singular: "callee", plural: "callees" }
  };

  let label = labels[operation] || { singular: "result", plural: "results" };
  let resultLabel = resultCount === 1 ? label.singular : label.plural;

  let summary = operation === "hover" && resultCount > 0 && label.special
    ? createElement(C, null, "Hover info ", label.special)
    : createElement(C, null,
        "Found ",
        createElement(C, { bold: true }, resultCount, " "),
        resultLabel
      );

  let fileInfo = fileCount > 1
    ? createElement(C, null, " ", "across ", createElement(C, { bold: true }, fileCount, " "), "files")
    : null;

  if (verbose) {
    return createElement(T, { flexDirection: "column" },
      createElement(T, { flexDirection: "row" },
        createElement(C, null, "  ⎿  ", summary, fileInfo)
      ),
      createElement(T, { marginLeft: 5 },
        createElement(C, null, content)
      )
    );
  }

  return createElement(k0, { height: 1 },
    createElement(C, null, summary, fileInfo, " ", resultCount > 0 && createElement(nT, null))
  );
}
```

### 6. 工作空间上下文

官方 CLI 在 LSP 工具中使用 `workspace` 上下文（cli.js 行 1982-2012）：

```typescript
// Bash 工具输入 JSON
{
  "workspace": {
    "current_dir": "string",  // 当前工作目录路径
    "project_dir": "string"   // 项目根目录路径
  }
}
```

这个上下文信息被传递给 LSP 服务器，用于：
- 解析相对路径
- workspace/symbol 搜索范围
- 项目级别的索引和缓存

## 本项目现有实现分析

### 已实现

1. **IDE 连接框架** (`src/ide/index.ts`)
   - ✅ IDE 类型定义 (VSCode, JetBrains)
   - ✅ 连接器基类 (IDEConnector)
   - ✅ VSCodeConnector (通过 Socket)
   - ✅ JetBrainsConnector (通过 REST API)
   - ✅ IDE 发现机制 (IDEDiscovery)
   - ✅ IDE 管理器 (IDEManager)

2. **诊断信息收集** (`src/prompt/diagnostics.ts`)
   - ✅ TypeScript 诊断收集
   - ✅ ESLint 诊断收集
   - ✅ 诊断缓存机制
   - ✅ 诊断格式化和分组
   - ⚠️ LSP 诊断（仅占位，未实现）

### 缺失功能

#### T-009: LSP 客户端实现

**完全缺失的部分：**

1. **LSP 服务器管理器**
   - ❌ 服务器生命周期管理
   - ❌ 多语言服务器支持
   - ❌ 服务器自动启动和配置
   - ❌ 连接池和会话管理

2. **LSP 协议通信**
   - ❌ JSON-RPC 消息序列化/反序列化
   - ❌ 请求/响应匹配
   - ❌ 通知处理
   - ❌ 错误处理

3. **文档同步**
   - ❌ textDocument/didOpen
   - ❌ textDocument/didChange
   - ❌ textDocument/didSave
   - ❌ textDocument/didClose

4. **LSP 工具集成**
   - ❌ LSP Tool 注册
   - ❌ 协议请求转换
   - ❌ 结果格式化
   - ❌ UI 渲染组件

#### T-010: 诊断信息显示

**部分实现，需要增强：**

1. **LSP publishDiagnostics 处理**
   - ❌ 监听诊断推送
   - ❌ 诊断缓存更新
   - ❌ 文件关联

2. **实时诊断更新**
   - ❌ 文件变更触发
   - ❌ 增量更新
   - ❌ 事件通知

3. **诊断显示集成**
   - ❌ 与 prompt 模块集成
   - ❌ 与工具系统集成
   - ❌ 终端 UI 渲染

## 具体实现建议

### T-009: LSP 客户端实现

#### 第一步：创建 LSP 管理器

**文件：** `src/lsp/manager.ts`

```typescript
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * LSP 服务器配置
 */
export interface LSPServerConfig {
  /** 服务器名称 */
  name: string;
  /** 可执行文件路径 */
  command: string;
  /** 命令行参数 */
  args?: string[];
  /** 支持的文件扩展名 */
  fileExtensions: string[];
  /** 初始化选项 */
  initializationOptions?: any;
  /** 环境变量 */
  env?: Record<string, string>;
}

/**
 * LSP 服务器状态
 */
export type LSPServerState = 'initializing' | 'ready' | 'error' | 'stopped';

/**
 * LSP 服务器实例
 */
export class LSPServer extends EventEmitter {
  private config: LSPServerConfig;
  private process: ChildProcess | null = null;
  private state: LSPServerState = 'stopped';
  private nextRequestId = 1;
  private pendingRequests = new Map<number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }>();
  private messageBuffer = '';

  // 已打开的文档
  private openDocuments = new Map<string, {
    uri: string;
    languageId: string;
    version: number;
    content: string;
  }>();

  constructor(config: LSPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * 启动 LSP 服务器
   */
  async start(workspaceRoot: string): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error('Server already started');
    }

    this.state = 'initializing';

    // 启动进程
    this.process = spawn(this.config.command, this.config.args || [], {
      cwd: workspaceRoot,
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 监听输出
    this.process.stdout!.on('data', (data) => {
      this.handleData(data);
    });

    this.process.stderr!.on('data', (data) => {
      console.error(`[LSP ${this.config.name}] ${data.toString()}`);
    });

    this.process.on('exit', (code) => {
      this.state = 'stopped';
      this.emit('exit', code);
    });

    this.process.on('error', (err) => {
      this.state = 'error';
      this.emit('error', err);
    });

    // 发送 initialize 请求
    try {
      const initResult = await this.sendRequest('initialize', {
        processId: process.pid,
        rootUri: `file://${workspaceRoot}`,
        capabilities: {
          textDocument: {
            synchronization: {
              didOpen: true,
              didChange: true,
              didSave: true,
              didClose: true,
            },
            completion: { completionItem: { snippetSupport: true } },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            definition: { linkSupport: true },
            references: {},
            documentSymbol: { hierarchicalDocumentSymbolSupport: true },
            implementation: {},
            typeDefinition: {},
            callHierarchy: {},
          },
          workspace: {
            symbol: {},
            workspaceFolders: true,
          },
        },
        initializationOptions: this.config.initializationOptions,
        workspaceFolders: [
          {
            uri: `file://${workspaceRoot}`,
            name: path.basename(workspaceRoot),
          },
        ],
      });

      // 发送 initialized 通知
      this.sendNotification('initialized', {});

      this.state = 'ready';
      this.emit('ready', initResult);
    } catch (err) {
      this.state = 'error';
      throw err;
    }
  }

  /**
   * 停止 LSP 服务器
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return;
    }

    // 发送 shutdown 请求
    try {
      await this.sendRequest('shutdown', null);
      this.sendNotification('exit', null);
    } catch (err) {
      // 忽略错误
    }

    // 杀死进程
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.state = 'stopped';
  }

  /**
   * 处理接收的数据
   */
  private handleData(data: Buffer): void {
    this.messageBuffer += data.toString();

    while (true) {
      const headerEnd = this.messageBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        break;
      }

      const headerText = this.messageBuffer.substring(0, headerEnd);
      const headers = this.parseHeaders(headerText);
      const contentLength = headers['Content-Length'];

      if (!contentLength) {
        console.error('[LSP] No Content-Length header');
        this.messageBuffer = '';
        break;
      }

      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.messageBuffer.length < bodyEnd) {
        // 不完整的消息，等待更多数据
        break;
      }

      const bodyText = this.messageBuffer.substring(bodyStart, bodyEnd);
      this.messageBuffer = this.messageBuffer.substring(bodyEnd);

      try {
        const message = JSON.parse(bodyText);
        this.handleMessage(message);
      } catch (err) {
        console.error('[LSP] Failed to parse message:', err);
      }
    }
  }

  /**
   * 解析消息头
   */
  private parseHeaders(text: string): Record<string, number> {
    const headers: Record<string, number> = {};
    const lines = text.split('\r\n');

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        if (key === 'Content-Length') {
          headers[key] = parseInt(value, 10);
        }
      }
    }

    return headers;
  }

  /**
   * 处理消息
   */
  private handleMessage(message: any): void {
    if ('id' in message && 'result' in message) {
      // 响应消息
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        pending.resolve(message.result);
      }
    } else if ('id' in message && 'error' in message) {
      // 错误响应
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        pending.reject(new Error(message.error.message));
      }
    } else if ('method' in message && !('id' in message)) {
      // 通知
      this.emit('notification', message.method, message.params);

      // 处理诊断推送
      if (message.method === 'textDocument/publishDiagnostics') {
        this.emit('diagnostics', message.params);
      }
    }
  }

  /**
   * 发送请求
   */
  sendRequest(method: string, params: any): Promise<any> {
    if (this.state !== 'ready' && this.state !== 'initializing') {
      return Promise.reject(new Error('Server not ready'));
    }

    const id = this.nextRequestId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.sendMessage(message);

      // 30 秒超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 发送通知
   */
  sendNotification(method: string, params: any): void {
    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(message);
  }

  /**
   * 发送消息
   */
  private sendMessage(message: any): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Process not started');
    }

    const content = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.process.stdin.write(headers + content);
  }

  /**
   * 打开文档
   */
  async openDocument(filePath: string, content: string, languageId: string): Promise<void> {
    const uri = `file://${filePath}`;

    // 如果已打开，先关闭
    if (this.openDocuments.has(filePath)) {
      await this.closeDocument(filePath);
    }

    // 发送 didOpen 通知
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text: content,
      },
    });

    // 记录文档状态
    this.openDocuments.set(filePath, {
      uri,
      languageId,
      version: 1,
      content,
    });
  }

  /**
   * 更新文档
   */
  async changeDocument(filePath: string, newContent: string): Promise<void> {
    const doc = this.openDocuments.get(filePath);
    if (!doc) {
      throw new Error('Document not opened');
    }

    doc.version++;
    doc.content = newContent;

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: doc.uri,
        version: doc.version,
      },
      contentChanges: [
        {
          text: newContent,
        },
      ],
    });
  }

  /**
   * 关闭文档
   */
  async closeDocument(filePath: string): Promise<void> {
    const doc = this.openDocuments.get(filePath);
    if (!doc) {
      return;
    }

    this.sendNotification('textDocument/didClose', {
      textDocument: {
        uri: doc.uri,
      },
    });

    this.openDocuments.delete(filePath);
  }

  /**
   * 检查文档是否打开
   */
  isDocumentOpen(filePath: string): boolean {
    return this.openDocuments.has(filePath);
  }

  /**
   * 获取状态
   */
  getState(): LSPServerState {
    return this.state;
  }
}

/**
 * LSP 服务器管理器
 */
export class LSPServerManager extends EventEmitter {
  private servers = new Map<string, LSPServer>();
  private serverConfigs: LSPServerConfig[] = [];
  private workspaceRoot: string;
  private state: 'initializing' | 'ready' | 'failed' = 'initializing';

  constructor(workspaceRoot: string) {
    super();
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * 注册 LSP 服务器配置
   */
  registerServer(config: LSPServerConfig): void {
    this.serverConfigs.push(config);
  }

  /**
   * 初始化所有服务器
   */
  async initialize(): Promise<void> {
    try {
      for (const config of this.serverConfigs) {
        const server = new LSPServer(config);

        // 监听诊断
        server.on('diagnostics', (params) => {
          this.emit('diagnostics', params);
        });

        try {
          await server.start(this.workspaceRoot);
          this.servers.set(config.name, server);
        } catch (err) {
          console.error(`Failed to start LSP server ${config.name}:`, err);
        }
      }

      this.state = 'ready';
      this.emit('ready');
    } catch (err) {
      this.state = 'failed';
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * 关闭所有服务器
   */
  async shutdown(): Promise<void> {
    for (const server of this.servers.values()) {
      try {
        await server.stop();
      } catch (err) {
        console.error('Failed to stop server:', err);
      }
    }

    this.servers.clear();
  }

  /**
   * 根据文件类型获取服务器
   */
  getServerForFile(filePath: string): LSPServer | undefined {
    const ext = path.extname(filePath);

    for (const [name, server] of this.servers) {
      const config = this.serverConfigs.find(c => c.name === name);
      if (config && config.fileExtensions.includes(ext)) {
        if (server.getState() === 'ready') {
          return server;
        }
      }
    }

    return undefined;
  }

  /**
   * 获取所有服务器
   */
  getAllServers(): Map<string, LSPServer> {
    return this.servers;
  }

  /**
   * 打开文件
   */
  async openFile(filePath: string, content: string): Promise<void> {
    const server = this.getServerForFile(filePath);
    if (!server) {
      return;
    }

    const ext = path.extname(filePath);
    const languageId = this.getLanguageId(ext);

    await server.openDocument(filePath, content, languageId);
  }

  /**
   * 检查文件是否打开
   */
  isFileOpen(filePath: string): boolean {
    const server = this.getServerForFile(filePath);
    return server?.isDocumentOpen(filePath) ?? false;
  }

  /**
   * 发送 LSP 请求
   */
  async sendRequest(filePath: string, method: string, params: any): Promise<any> {
    const server = this.getServerForFile(filePath);
    if (!server) {
      return undefined;
    }

    return server.sendRequest(method, params);
  }

  /**
   * 获取语言 ID
   */
  private getLanguageId(ext: string): string {
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
    };

    return mapping[ext] || 'plaintext';
  }

  /**
   * 获取状态
   */
  getStatus(): { status: 'initializing' | 'ready' | 'failed' } {
    return { status: this.state };
  }
}

// 默认配置
export const defaultLSPConfigs: LSPServerConfig[] = [
  {
    name: 'typescript-language-server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    name: 'pyright',
    command: 'pyright-langserver',
    args: ['--stdio'],
    fileExtensions: ['.py'],
  },
  // 可以添加更多语言服务器
];

// 全局实例
let globalManager: LSPServerManager | null = null;

/**
 * 初始化全局 LSP 管理器
 */
export async function initializeLSPManager(workspaceRoot: string): Promise<LSPServerManager> {
  if (globalManager) {
    await globalManager.shutdown();
  }

  globalManager = new LSPServerManager(workspaceRoot);

  // 注册默认服务器
  for (const config of defaultLSPConfigs) {
    globalManager.registerServer(config);
  }

  await globalManager.initialize();

  return globalManager;
}

/**
 * 获取全局 LSP 管理器
 */
export function getLSPManager(): LSPServerManager | null {
  return globalManager;
}
```

#### 第二步：创建 LSP 工具

**文件：** `src/tools/lsp.ts`

```typescript
import { BaseTool } from './base.js';
import { z } from 'zod';
import { getLSPManager } from '../lsp/manager.js';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import * as path from 'path';

/**
 * LSP 操作类型
 */
const LSPOperation = z.enum([
  'goToDefinition',
  'findReferences',
  'hover',
  'documentSymbol',
  'workspaceSymbol',
  'goToImplementation',
  'prepareCallHierarchy',
  'incomingCalls',
  'outgoingCalls',
]);

/**
 * LSP 工具输入
 */
const LSPInput = z.object({
  operation: LSPOperation.describe('The LSP operation to perform'),
  filePath: z.string().describe('The absolute or relative path to the file'),
  line: z.number().int().positive().describe('The line number (1-based, as shown in editors)'),
  character: z.number().int().positive().describe('The character offset (1-based, as shown in editors)'),
});

/**
 * LSP 工具输出
 */
const LSPOutput = z.object({
  operation: LSPOperation.describe('The LSP operation that was performed'),
  result: z.string().describe('The formatted result of the LSP operation'),
  filePath: z.string().describe('The file path the operation was performed on'),
  resultCount: z.number().int().nonnegative().optional().describe('Number of results'),
  fileCount: z.number().int().nonnegative().optional().describe('Number of files containing results'),
});

type LSPInputType = z.infer<typeof LSPInput>;
type LSPOutputType = z.infer<typeof LSPOutput>;

/**
 * LSP 工具
 */
export class LSPTool extends BaseTool<LSPInputType, LSPOutputType> {
  name = 'LSP';
  description = `Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:
- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.`;

  inputSchema = LSPInput;
  outputSchema = LSPOutput;

  /**
   * 将工具输入转换为 LSP 协议请求
   */
  private buildLSPRequest(input: LSPInputType, filePath: string): { method: string; params: any } {
    const uri = pathToFileURL(filePath).href;
    const position = {
      line: input.line - 1,  // 转换为 0-based
      character: input.character - 1,
    };

    switch (input.operation) {
      case 'goToDefinition':
        return {
          method: 'textDocument/definition',
          params: {
            textDocument: { uri },
            position,
          },
        };

      case 'findReferences':
        return {
          method: 'textDocument/references',
          params: {
            textDocument: { uri },
            position,
            context: { includeDeclaration: true },
          },
        };

      case 'hover':
        return {
          method: 'textDocument/hover',
          params: {
            textDocument: { uri },
            position,
          },
        };

      case 'documentSymbol':
        return {
          method: 'textDocument/documentSymbol',
          params: {
            textDocument: { uri },
          },
        };

      case 'workspaceSymbol':
        return {
          method: 'workspace/symbol',
          params: { query: '' },
        };

      case 'goToImplementation':
        return {
          method: 'textDocument/implementation',
          params: {
            textDocument: { uri },
            position,
          },
        };

      case 'prepareCallHierarchy':
      case 'incomingCalls':
      case 'outgoingCalls':
        return {
          method: 'textDocument/prepareCallHierarchy',
          params: {
            textDocument: { uri },
            position,
          },
        };

      default:
        throw new Error(`Unsupported operation: ${input.operation}`);
    }
  }

  /**
   * 格式化 LSP 结果
   */
  private formatResult(
    operation: string,
    result: any,
    workingDir: string
  ): { formatted: string; resultCount: number; fileCount: number } {
    switch (operation) {
      case 'goToDefinition':
      case 'goToImplementation':
        return this.formatLocationResult(result, workingDir);

      case 'findReferences':
        return this.formatReferencesResult(result, workingDir);

      case 'hover':
        return this.formatHoverResult(result);

      case 'documentSymbol':
        return this.formatDocumentSymbolResult(result);

      case 'workspaceSymbol':
        return this.formatWorkspaceSymbolResult(result, workingDir);

      case 'prepareCallHierarchy':
        return this.formatCallHierarchyResult(result, workingDir);

      case 'incomingCalls':
      case 'outgoingCalls':
        return this.formatCallsResult(operation, result, workingDir);

      default:
        return {
          formatted: JSON.stringify(result, null, 2),
          resultCount: 0,
          fileCount: 0,
        };
    }
  }

  /**
   * 格式化位置结果（definition/implementation）
   */
  private formatLocationResult(result: any, workingDir: string) {
    const locations = Array.isArray(result) ? result : result ? [result] : [];

    if (locations.length === 0) {
      return {
        formatted: 'No definition found.',
        resultCount: 0,
        fileCount: 0,
      };
    }

    if (locations.length === 1) {
      const loc = locations[0];
      const filePath = this.uriToPath(loc.uri || loc.targetUri, workingDir);
      const line = (loc.range || loc.targetRange).start.line + 1;
      return {
        formatted: `Definition found at ${filePath}:${line}`,
        resultCount: 1,
        fileCount: 1,
      };
    }

    const grouped = this.groupByFile(locations, workingDir);
    const lines = [`Found ${locations.length} definitions across ${grouped.size} files:`];

    for (const [file, locs] of grouped) {
      lines.push(`\n${file}:`);
      for (const loc of locs) {
        const line = (loc.range || loc.targetRange).start.line + 1;
        const char = (loc.range || loc.targetRange).start.character + 1;
        lines.push(`  Line ${line}:${char}`);
      }
    }

    return {
      formatted: lines.join('\n'),
      resultCount: locations.length,
      fileCount: grouped.size,
    };
  }

  /**
   * 格式化引用结果
   */
  private formatReferencesResult(result: any, workingDir: string) {
    const references = result || [];

    if (references.length === 0) {
      return {
        formatted: 'No references found.',
        resultCount: 0,
        fileCount: 0,
      };
    }

    const grouped = this.groupByFile(references, workingDir);
    const lines = [`Found ${references.length} references across ${grouped.size} files:`];

    for (const [file, refs] of grouped) {
      lines.push(`\n${file}:`);
      for (const ref of refs) {
        const line = ref.range.start.line + 1;
        const char = ref.range.start.character + 1;
        lines.push(`  Line ${line}:${char}`);
      }
    }

    return {
      formatted: lines.join('\n'),
      resultCount: references.length,
      fileCount: grouped.size,
    };
  }

  /**
   * 格式化 hover 结果
   */
  private formatHoverResult(result: any) {
    if (!result) {
      return {
        formatted: 'No hover information available.',
        resultCount: 0,
        fileCount: 0,
      };
    }

    let content = '';

    if (Array.isArray(result.contents)) {
      content = result.contents
        .map((c: any) => (typeof c === 'string' ? c : c.value))
        .join('\n\n');
    } else if (typeof result.contents === 'string') {
      content = result.contents;
    } else {
      content = result.contents.value;
    }

    if (result.range) {
      const line = result.range.start.line + 1;
      const char = result.range.start.character + 1;
      content = `Hover info at ${line}:${char}:\n\n${content}`;
    }

    return {
      formatted: content,
      resultCount: 1,
      fileCount: 1,
    };
  }

  /**
   * 格式化文档符号结果
   */
  private formatDocumentSymbolResult(result: any) {
    const symbols = result || [];

    if (symbols.length === 0) {
      return {
        formatted: 'No symbols found in document.',
        resultCount: 0,
        fileCount: 0,
      };
    }

    const count = this.countSymbols(symbols);
    const lines = [`Found ${count} symbol${count === 1 ? '' : 's'} in document:`];

    for (const symbol of symbols) {
      const kind = this.symbolKindToString(symbol.kind);
      const line = symbol.range.start.line + 1;
      let text = `  ${symbol.name} (${kind}) - Line ${line}`;

      if (symbol.containerName) {
        text += ` in ${symbol.containerName}`;
      }

      lines.push(text);
    }

    return {
      formatted: lines.join('\n'),
      resultCount: count,
      fileCount: 1,
    };
  }

  /**
   * 格式化工作区符号结果
   */
  private formatWorkspaceSymbolResult(result: any, workingDir: string) {
    const symbols = (result || []).filter((s: any) => s && s.location && s.location.uri);

    if (symbols.length === 0) {
      return {
        formatted: 'No symbols found in workspace.',
        resultCount: 0,
        fileCount: 0,
      };
    }

    const grouped = this.groupSymbolsByFile(symbols, workingDir);
    const lines = [`Found ${symbols.length} symbol${symbols.length === 1 ? '' : 's'} in workspace:`];

    for (const [file, syms] of grouped) {
      lines.push(`\n${file}:`);
      for (const sym of syms) {
        const kind = this.symbolKindToString(sym.kind);
        const line = sym.location.range.start.line + 1;
        let text = `  ${sym.name} (${kind}) - Line ${line}`;

        if (sym.containerName) {
          text += ` in ${sym.containerName}`;
        }

        lines.push(text);
      }
    }

    return {
      formatted: lines.join('\n'),
      resultCount: symbols.length,
      fileCount: grouped.size,
    };
  }

  /**
   * 格式化调用层次结果
   */
  private formatCallHierarchyResult(result: any, workingDir: string) {
    const items = result || [];

    if (items.length === 0) {
      return {
        formatted: 'No call hierarchy item found at this position',
        resultCount: 0,
        fileCount: 0,
      };
    }

    if (items.length === 1) {
      const item = items[0];
      const filePath = this.uriToPath(item.uri, workingDir);
      const kind = this.symbolKindToString(item.kind);
      const line = item.range.start.line + 1;

      return {
        formatted: `Call hierarchy item: ${item.name} (${kind}) - ${filePath}:${line}`,
        resultCount: 1,
        fileCount: 1,
      };
    }

    const lines = [`Found ${items.length} call hierarchy items:`];
    for (const item of items) {
      const filePath = this.uriToPath(item.uri, workingDir);
      const kind = this.symbolKindToString(item.kind);
      const line = item.range.start.line + 1;
      lines.push(`  ${item.name} (${kind}) - ${filePath}:${line}`);
    }

    return {
      formatted: lines.join('\n'),
      resultCount: items.length,
      fileCount: new Set(items.map((i: any) => i.uri)).size,
    };
  }

  /**
   * 格式化调用结果
   */
  private formatCallsResult(operation: string, result: any, workingDir: string) {
    const calls = result || [];

    if (calls.length === 0) {
      const type = operation === 'incomingCalls' ? 'incoming' : 'outgoing';
      return {
        formatted: `No ${type} calls found.`,
        resultCount: 0,
        fileCount: 0,
      };
    }

    const isIncoming = operation === 'incomingCalls';
    const callItem = isIncoming ? 'from' : 'to';
    const label = isIncoming ? 'caller' : 'callee';
    const lines = [`Found ${calls.length} ${label}${calls.length === 1 ? '' : 's'}:`];

    const grouped = new Map<string, any[]>();

    for (const call of calls) {
      const item = call[callItem];
      if (!item) continue;

      const filePath = this.uriToPath(item.uri, workingDir);
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath)!.push(call);
    }

    for (const [file, fileCalls] of grouped) {
      lines.push(`\n${file}:`);
      for (const call of fileCalls) {
        const item = call[callItem];
        if (!item) continue;

        const kind = this.symbolKindToString(item.kind);
        const line = item.range.start.line + 1;
        let text = `  ${item.name} (${kind}) - Line ${line}`;

        if (call.fromRanges && call.fromRanges.length > 0) {
          const ranges = call.fromRanges
            .map((r: any) => `${r.start.line + 1}:${r.start.character + 1}`)
            .join(', ');
          text += ` [${isIncoming ? 'calls at' : 'called from'}: ${ranges}]`;
        }

        lines.push(text);
      }
    }

    return {
      formatted: lines.join('\n'),
      resultCount: calls.length,
      fileCount: grouped.size,
    };
  }

  /**
   * 辅助方法：URI 转路径
   */
  private uriToPath(uri: string, workingDir: string): string {
    const filePath = uri.replace('file://', '');
    return path.relative(workingDir, filePath);
  }

  /**
   * 辅助方法：按文件分组
   */
  private groupByFile(locations: any[], workingDir: string): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const loc of locations) {
      const uri = loc.uri || loc.targetUri || loc.location?.uri;
      if (!uri) continue;

      const filePath = this.uriToPath(uri, workingDir);

      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }

      grouped.get(filePath)!.push(loc);
    }

    return grouped;
  }

  /**
   * 辅助方法：按文件分组符号
   */
  private groupSymbolsByFile(symbols: any[], workingDir: string): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const sym of symbols) {
      const filePath = this.uriToPath(sym.location.uri, workingDir);

      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }

      grouped.get(filePath)!.push(sym);
    }

    return grouped;
  }

  /**
   * 辅助方法：递归计算符号数量
   */
  private countSymbols(symbols: any[]): number {
    let count = symbols.length;

    for (const sym of symbols) {
      if (sym.children && sym.children.length > 0) {
        count += this.countSymbols(sym.children);
      }
    }

    return count;
  }

  /**
   * 辅助方法：SymbolKind 转字符串
   */
  private symbolKindToString(kind: number): string {
    const kinds: Record<number, string> = {
      1: 'File',
      2: 'Module',
      3: 'Namespace',
      4: 'Package',
      5: 'Class',
      6: 'Method',
      7: 'Property',
      8: 'Field',
      9: 'Constructor',
      10: 'Enum',
      11: 'Interface',
      12: 'Function',
      13: 'Variable',
      14: 'Constant',
      15: 'String',
      16: 'Number',
      17: 'Boolean',
      18: 'Array',
      19: 'Object',
      20: 'Key',
      21: 'Null',
      22: 'EnumMember',
      23: 'Struct',
      24: 'Event',
      25: 'Operator',
      26: 'TypeParameter',
    };

    return kinds[kind] || 'Unknown';
  }

  /**
   * 执行工具
   */
  async execute(input: LSPInputType): Promise<LSPOutputType> {
    const manager = getLSPManager();

    if (!manager) {
      return {
        operation: input.operation,
        result: 'LSP server manager not initialized.',
        filePath: input.filePath,
      };
    }

    const filePath = path.resolve(input.filePath);
    const workingDir = process.cwd();

    // 构建 LSP 请求
    const { method, params } = this.buildLSPRequest(input, filePath);

    try {
      // 如果文件未打开，先打开
      if (!manager.isFileOpen(filePath)) {
        const content = await readFile(filePath, 'utf-8');
        await manager.openFile(filePath, content);
      }

      // 发送请求
      let result = await manager.sendRequest(filePath, method, params);

      if (result === undefined) {
        return {
          operation: input.operation,
          result: `No LSP server available for file type: ${path.extname(filePath)}`,
          filePath: input.filePath,
        };
      }

      // 处理 incoming/outgoing calls 的二次请求
      if (input.operation === 'incomingCalls' || input.operation === 'outgoingCalls') {
        const items = result;

        if (!items || items.length === 0) {
          return {
            operation: input.operation,
            result: 'No call hierarchy item found at this position',
            filePath: input.filePath,
            resultCount: 0,
            fileCount: 0,
          };
        }

        const secondMethod =
          input.operation === 'incomingCalls'
            ? 'callHierarchy/incomingCalls'
            : 'callHierarchy/outgoingCalls';

        result = await manager.sendRequest(filePath, secondMethod, { item: items[0] });

        if (result === undefined) {
          return {
            operation: input.operation,
            result: 'LSP server did not return call hierarchy results',
            filePath: input.filePath,
          };
        }
      }

      // 格式化结果
      const { formatted, resultCount, fileCount } = this.formatResult(
        input.operation,
        result,
        workingDir
      );

      return {
        operation: input.operation,
        result: formatted,
        filePath: input.filePath,
        resultCount,
        fileCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        operation: input.operation,
        result: `Error performing ${input.operation}: ${message}`,
        filePath: input.filePath,
      };
    }
  }
}
```

### T-010: 诊断信息显示实现

#### 增强诊断收集器

**文件：** `src/prompt/diagnostics.ts` (修改)

```typescript
// 在现有的 DiagnosticsCollector 类中添加：

/**
 * 从 LSP 服务器收集诊断信息（真实实现）
 */
async collectFromLSP(): Promise<DiagnosticInfo[]> {
  const cacheKey = 'lsp';
  const cached = this.getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const diagnostics: DiagnosticInfo[] = [];

  try {
    const manager = getLSPManager();
    if (!manager) {
      return [];
    }

    // 从管理器获取缓存的诊断信息
    const lspDiagnostics = manager.getDiagnostics();

    for (const [uri, fileDiagnostics] of lspDiagnostics) {
      const filePath = uri.replace('file://', '');
      const relativePath = this.normalizeFilePath(filePath);

      for (const diag of fileDiagnostics) {
        diagnostics.push({
          file: relativePath,
          line: diag.range.start.line + 1,
          column: diag.range.start.character + 1,
          severity: this.mapLSPSeverity(diag.severity),
          message: diag.message,
          source: diag.source || 'lsp',
        });
      }
    }

    this.setCache(cacheKey, diagnostics);
    return diagnostics;
  } catch (error) {
    console.warn('Failed to collect LSP diagnostics:', error);
    this.setCache(cacheKey, []);
    return [];
  }
}

/**
 * 映射 LSP 严重性到标准严重性
 */
private mapLSPSeverity(severity: number | undefined): DiagnosticInfo['severity'] {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'error';
  }
}
```

#### 在 LSPServerManager 中添加诊断缓存

```typescript
// 在 LSPServerManager 类中添加：

private diagnosticsCache = new Map<string, any[]>();

constructor(workspaceRoot: string) {
  super();
  this.workspaceRoot = workspaceRoot;

  // 监听诊断通知
  this.on('diagnostics', (params) => {
    this.handleDiagnostics(params);
  });
}

/**
 * 处理诊断推送
 */
private handleDiagnostics(params: any): void {
  const { uri, diagnostics } = params;
  this.diagnosticsCache.set(uri, diagnostics);
}

/**
 * 获取所有诊断
 */
getDiagnostics(): Map<string, any[]> {
  return new Map(this.diagnosticsCache);
}

/**
 * 获取文件的诊断
 */
getFileDiagnostics(filePath: string): any[] {
  const uri = `file://${filePath}`;
  return this.diagnosticsCache.get(uri) || [];
}

/**
 * 清除诊断
 */
clearDiagnostics(filePath?: string): void {
  if (filePath) {
    const uri = `file://${filePath}`;
    this.diagnosticsCache.delete(uri);
  } else {
    this.diagnosticsCache.clear();
  }
}
```

## 依赖库建议

### 必需依赖

```json
{
  "dependencies": {
    "vscode-languageserver-protocol": "^3.17.5",
    "vscode-languageserver-types": "^3.17.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### 可选依赖（用于特定语言服务器）

```json
{
  "optionalDependencies": {
    "typescript-language-server": "^4.3.3",
    "typescript": "^5.4.5",
    "pyright": "^1.1.358",
    "vscode-langservers-extracted": "^4.8.0"
  }
}
```

## 集成步骤

### 1. 在应用启动时初始化 LSP

**文件：** `src/cli.ts`

```typescript
import { initializeLSPManager } from './lsp/manager.js';

async function main() {
  // ... 其他初始化代码

  // 初始化 LSP 管理器
  try {
    const workspaceRoot = process.cwd();
    await initializeLSPManager(workspaceRoot);
    console.log('LSP servers initialized');
  } catch (error) {
    console.warn('Failed to initialize LSP:', error);
  }

  // ... 启动主循环
}
```

### 2. 注册 LSP 工具

**文件：** `src/tools/registry.ts`

```typescript
import { LSPTool } from './lsp.js';

export function registerTools(registry: ToolRegistry) {
  // ... 注册其他工具

  // 注册 LSP 工具
  registry.register(new LSPTool());
}
```

### 3. 在 prompt 中集成诊断

**文件：** `src/prompt/builder.ts`

```typescript
import { getDefaultCollector } from './diagnostics.js';

export async function buildPrompt(): Promise<string> {
  const parts: string[] = [];

  // ... 其他 prompt 部分

  // 添加诊断信息
  const collector = getDefaultCollector();
  const diagnostics = await collector.collectAll();

  if (diagnostics.length > 0) {
    const summary = collector.getSummary(diagnostics);
    const formatted = collector.formatDiagnostics(diagnostics, 5);

    parts.push(`## Code Diagnostics\n\n${summary}\n\n${formatted}`);
  }

  return parts.join('\n\n');
}
```

## 参考行号（官方源码）

基于官方 Claude Code v2.0.76 (`cli.js`):

- **行 2927-2945**: LSP 工具定义和描述
- **行 2970-3000**: 协议转换函数 (V27)
- **行 3000-3010**: 结果格式化调度 (D27)
- **行 3070-3119**: LSP 工具主执行函数 (call)
- **行 2910-2916**: goToDefinition 格式化 (yq0)
- **行 2912-2915**: findReferences 格式化 (E49)
- **行 2917-2919**: hover 格式化 (z49)
- **行 2920-2922**: documentSymbol 格式化 ($49)
- **行 2920**: workspaceSymbol 格式化 (vq0)
- **行 2923-2924**: incomingCalls 格式化 (w49)
- **行 2925-2926**: outgoingCalls 格式化 (q49)
- **行 2945-2946**: 符号提取 (O49)
- **行 3048-3060**: 工具使用消息渲染 (_49)
- **行 3065-3068**: 结果消息渲染 (S49)
- **行 1982-2012**: workspace 上下文定义

## 实现优先级建议

### 第一阶段（核心功能）
1. ✅ LSPServer 类 - 单个服务器管理
2. ✅ LSPServerManager 类 - 多服务器管理
3. ✅ LSPTool 类 - 工具集成
4. ✅ 基本的 LSP 操作（definition, references, hover）

### 第二阶段（诊断集成）
5. ⬜ publishDiagnostics 处理
6. ⬜ DiagnosticsCollector 增强
7. ⬜ Prompt 集成

### 第三阶段（高级功能）
8. ⬜ 调用层次（call hierarchy）
9. ⬜ 工作区符号搜索
10. ⬜ UI 渲染组件

### 第四阶段（优化）
11. ⬜ 性能优化（缓存、增量更新）
12. ⬜ 错误处理改进
13. ⬜ 多语言服务器配置

## 总结

官方 Claude Code 的 IDE 集成模块设计精良，主要特点：

1. **完整的 LSP 协议支持** - 9 种操作，覆盖主要代码智能场景
2. **优雅的协议转换** - 清晰的输入到 LSP 请求的映射
3. **智能的结果格式化** - 针对不同操作类型的专用格式化函数
4. **良好的错误处理** - 对各种边界情况的处理
5. **工作区感知** - 相对路径、多文件支持

本项目需要从零开始实现 LSP 管理器和协议通信层，但可以直接复用官方的工具接口设计和格式化逻辑。按照上述实现建议分阶段进行，可以逐步达到官方的功能水平。
