/**
 * 代码本体图谱类型定义
 * Code Ontology Map Types
 */

// ============================================================================
// 位置信息
// ============================================================================

export interface LocationInfo {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// ============================================================================
// 项目信息
// ============================================================================

export interface ProjectInfo {
  name: string;
  rootPath: string;
  languages: string[];
  fileCount: number;
  totalLines: number;
}

// ============================================================================
// 导入/导出信息
// ============================================================================

export interface ImportInfo {
  source: string;           // 导入来源 (模块路径)
  symbols: string[];        // 导入的符号列表
  isDefault: boolean;       // 是否为默认导入
  isNamespace: boolean;     // 是否为命名空间导入 (import * as)
  isDynamic: boolean;       // 是否为动态导入
  location: LocationInfo;
}

export interface ExportInfo {
  name: string;             // 导出名称
  type: 'default' | 'named' | 'namespace' | 'reexport';
  originalName?: string;    // 重命名前的原名
  source?: string;          // 重导出的来源
  location: LocationInfo;
}

// ============================================================================
// 变量和属性
// ============================================================================

export interface VariableNode {
  id: string;
  name: string;
  type?: string;            // 类型注解
  kind: 'const' | 'let' | 'var';
  isExported: boolean;
  location: LocationInfo;
  documentation?: string;
}

export interface PropertyNode {
  id: string;
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
  isOptional: boolean;
  location: LocationInfo;
  documentation?: string;
}

export interface PropertySignature {
  name: string;
  type?: string;
  isOptional: boolean;
  isReadonly: boolean;
}

// ============================================================================
// 参数信息
// ============================================================================

export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  isRest: boolean;          // ...args
  defaultValue?: string;
}

// ============================================================================
// 函数和方法
// ============================================================================

export interface FunctionNode {
  id: string;               // "file.ts::functionName"
  name: string;
  signature: string;        // 完整函数签名
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
  location: LocationInfo;
  documentation?: string;
  calls: CallReference[];       // 调用的函数（出边）
  calledBy: CallReference[];    // 被调用位置（入边）
}

export interface MethodNode extends FunctionNode {
  className: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAbstract: boolean;
  isOverride: boolean;
}

export interface MethodSignature {
  name: string;
  signature: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isOptional: boolean;
}

// ============================================================================
// 调用引用
// ============================================================================

export interface CallReference {
  targetId: string;         // 目标函数ID
  targetName: string;       // 目标函数名
  type: 'direct' | 'method' | 'constructor' | 'callback' | 'dynamic';
  location: LocationInfo;
}

// ============================================================================
// 类和接口
// ============================================================================

export interface ClassNode {
  id: string;               // "file.ts::ClassName"
  name: string;
  extends?: string;         // 父类
  implements?: string[];    // 实现的接口
  isAbstract: boolean;
  isExported: boolean;
  methods: MethodNode[];
  properties: PropertyNode[];
  location: LocationInfo;
  documentation?: string;
}

export interface InterfaceNode {
  id: string;
  name: string;
  extends?: string[];       // 继承的接口
  isExported: boolean;
  properties: PropertySignature[];
  methods: MethodSignature[];
  location: LocationInfo;
  documentation?: string;
}

export interface TypeNode {
  id: string;
  name: string;
  definition: string;       // 类型定义内容
  isExported: boolean;
  location: LocationInfo;
  documentation?: string;
}

export interface EnumNode {
  id: string;
  name: string;
  members: Array<{ name: string; value?: string | number }>;
  isExported: boolean;
  isConst: boolean;
  location: LocationInfo;
  documentation?: string;
}

// ============================================================================
// 模块节点
// ============================================================================

export interface ModuleNode {
  id: string;               // 相对路径作为 ID
  name: string;             // 文件名
  path: string;             // 绝对路径
  language: string;         // 编程语言
  lines: number;            // 代码行数
  size: number;             // 文件大小（字节）
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassNode[];
  interfaces: InterfaceNode[];
  types: TypeNode[];
  enums: EnumNode[];
  functions: FunctionNode[];
  variables: VariableNode[];
}

// ============================================================================
// 调用图
// ============================================================================

export interface CallGraphNode {
  id: string;
  name: string;
  type: 'function' | 'method' | 'constructor' | 'arrow';
  moduleId: string;
  className?: string;
  signature?: string;
}

export interface CallGraphEdge {
  source: string;           // 调用者 ID
  target: string;           // 被调用者 ID
  type: 'direct' | 'method' | 'callback' | 'dynamic';
  count: number;            // 调用次数
  locations: LocationInfo[];
}

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}

// ============================================================================
// 依赖图
// ============================================================================

export interface DependencyEdge {
  source: string;           // 源模块 ID
  target: string;           // 目标模块 ID
  type: 'import' | 'require' | 'dynamic';
  symbols: string[];        // 导入的符号
  isTypeOnly: boolean;      // 是否仅类型导入
}

export interface DependencyGraph {
  edges: DependencyEdge[];
}

// ============================================================================
// 统计信息
// ============================================================================

export interface OntologyStatistics {
  totalModules: number;
  totalClasses: number;
  totalInterfaces: number;
  totalFunctions: number;
  totalMethods: number;
  totalVariables: number;
  totalCallEdges: number;
  totalDependencyEdges: number;
  totalLines: number;

  languageBreakdown: Record<string, number>;

  largestFiles: Array<{
    path: string;
    lines: number;
    size: number;
  }>;

  mostCalledFunctions: Array<{
    id: string;
    name: string;
    callCount: number;
  }>;

  mostImportedModules: Array<{
    id: string;
    importCount: number;
  }>;
}

// ============================================================================
// 代码本体（根结构）
// ============================================================================

export interface CodeOntology {
  /** 图谱版本 */
  version: string;

  /** 生成时间戳 */
  generatedAt: string;

  /** 项目信息 */
  project: ProjectInfo;

  /** 模块列表 */
  modules: ModuleNode[];

  /** 调用图 */
  callGraph: CallGraph;

  /** 依赖图 */
  dependencyGraph: DependencyGraph;

  /** 统计信息 */
  statistics: OntologyStatistics;
}

// ============================================================================
// 生成选项
// ============================================================================

export interface GenerateOptions {
  /** 包含的文件模式 */
  include?: string[];

  /** 排除的文件模式 */
  exclude?: string[];

  /** 调用链分析深度 */
  depth?: number;

  /** 是否增量更新 */
  incremental?: boolean;

  /** 是否使用 LSP */
  useLSP?: boolean;

  /** 输出路径 */
  outputPath?: string;

  /** 并发数 */
  concurrency?: number;
}

// ============================================================================
// 缓存相关
// ============================================================================

export interface CacheEntry {
  hash: string;             // 文件内容哈希
  mtime: number;            // 修改时间
  module: ModuleNode;       // 缓存的模块数据
}

export interface CacheData {
  version: string;
  rootPath: string;
  generatedAt: string;
  entries: Record<string, CacheEntry>;
}

// ============================================================================
// 分析进度
// ============================================================================

export interface AnalysisProgress {
  phase: 'discover' | 'parse' | 'symbols' | 'calls' | 'dependencies' | 'aggregate';
  current: number;
  total: number;
  currentFile?: string;
}

export type ProgressCallback = (progress: AnalysisProgress) => void;
