/**
 * 增强版代码蓝图类型定义
 * Enhanced Code Blueprint Types
 *
 * 解决原版 CODE_MAP.json 的三个核心问题：
 * 1. 没有层级 → 新增目录树视图 + 架构分层视图
 * 2. 没有引用关系 → 新增符号级调用 + 类型引用
 * 3. 没有语义 → AI 生成业务描述
 */

// ============================================================================
// 基础类型
// ============================================================================

export interface LocationInfo {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// ============================================================================
// 架构层枚举
// ============================================================================

export type ArchitectureLayer =
  | 'presentation'     // 表现层：UI 组件、页面、视图
  | 'business'         // 业务层：核心逻辑、服务、领域模型
  | 'data'             // 数据层：API 调用、数据库、存储
  | 'infrastructure'   // 基础设施：工具类、配置、第三方集成
  | 'crossCutting';    // 横切关注点：日志、认证、中间件

// ============================================================================
// 语义信息
// ============================================================================

export interface SemanticInfo {
  /** 这个模块/符号做什么（1-2句话） */
  description: string;

  /** 核心职责 */
  responsibility: string;

  /** 所属业务领域 */
  businessDomain?: string;

  /** 架构层分类 */
  architectureLayer: ArchitectureLayer;

  /** 关键词标签 */
  tags: string[];

  /** AI 置信度 0-1 */
  confidence: number;

  /** 生成时间 */
  generatedAt: string;
}

export interface ProjectSemantic {
  /** 项目描述：这个项目做什么 */
  description: string;

  /** 项目目的：核心价值 */
  purpose: string;

  /** 业务领域关键词 */
  domains: string[];

  /** 核心业务概念 */
  keyConcepts: KeyConcept[];
}

export interface KeyConcept {
  /** 概念名称 */
  name: string;

  /** 概念描述 */
  description: string;

  /** 相关模块 ID 列表 */
  relatedModules: string[];
}

// ============================================================================
// 目录树视图
// ============================================================================

export interface DirectoryNode {
  /** 目录/文件名 */
  name: string;

  /** 相对路径 */
  path: string;

  /** 类型：目录或文件 */
  type: 'directory' | 'file';

  /** AI 生成的描述 */
  description?: string;

  /** 目录职责 */
  purpose?: string;

  /** 如果是文件，关联的模块 ID */
  moduleId?: string;

  /** 子节点 */
  children?: DirectoryNode[];
}

// ============================================================================
// 架构层视图
// ============================================================================

export interface LayerInfo {
  /** 层描述 */
  description: string;

  /** 该层的模块 ID 列表 */
  modules: string[];

  /** 子分层（可选） */
  subLayers?: Record<string, string[]>;
}

export interface ArchitectureLayers {
  /** 表现层：UI、组件、页面 */
  presentation: LayerInfo;

  /** 业务层：核心逻辑、服务 */
  business: LayerInfo;

  /** 数据层：API、数据库 */
  data: LayerInfo;

  /** 基础设施层：工具、配置 */
  infrastructure: LayerInfo;

  /** 横切关注点：日志、认证 */
  crossCutting: LayerInfo;
}

export interface Views {
  /** 目录层级视图 */
  directoryTree: DirectoryNode;

  /** 架构分层视图 */
  architectureLayers: ArchitectureLayers;
}

// ============================================================================
// 增强版模块
// ============================================================================

export interface EnhancedModule {
  /** 模块 ID（相对路径） */
  id: string;

  /** 文件名 */
  name: string;

  /** 绝对路径 */
  path: string;

  /** 编程语言 */
  language: string;

  /** 代码行数 */
  lines: number;

  /** 文件大小（字节） */
  size: number;

  /** AI 生成的语义信息 */
  semantic?: SemanticInfo;

  /** 导出的符号 ID 列表 */
  exports: string[];

  /** 导入信息 */
  imports: ModuleImport[];
}

export interface ModuleImport {
  /** 导入来源 */
  source: string;

  /** 导入的符号 */
  symbols: string[];

  /** 是否为外部包 */
  isExternal: boolean;

  /** 是否仅类型导入 */
  isTypeOnly?: boolean;
}

// ============================================================================
// 符号条目
// ============================================================================

export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'property'
  | 'variable'
  | 'constant'
  | 'interface'
  | 'type'
  | 'enum';

export interface SymbolEntry {
  /** 全局唯一 ID: module::SymbolName */
  id: string;

  /** 符号名称 */
  name: string;

  /** 符号类型 */
  kind: SymbolKind;

  /** 所属模块 ID */
  moduleId: string;

  /** 位置信息 */
  location: LocationInfo;

  /** 函数/方法签名 */
  signature?: string;

  /** AI 生成的语义信息 */
  semantic?: SemanticInfo;

  /** 子符号 ID（如类的方法） */
  children?: string[];

  /** 父符号 ID（如方法的所属类） */
  parent?: string;
}

// ============================================================================
// 引用关系
// ============================================================================

export interface ModuleDependency {
  /** 源模块 ID */
  source: string;

  /** 目标模块 ID */
  target: string;

  /** 依赖类型 */
  type: 'import' | 'require' | 'dynamic';

  /** 导入的符号 */
  symbols: string[];

  /** 是否仅类型导入 */
  isTypeOnly: boolean;
}

export interface SymbolCall {
  /** 调用者符号 ID */
  caller: string;

  /** 被调用者符号 ID */
  callee: string;

  /** 调用类型 */
  callType: 'direct' | 'method' | 'constructor' | 'callback' | 'dynamic';

  /** 调用位置 */
  locations: LocationInfo[];
}

export interface TypeReference {
  /** 子类/实现者符号 ID */
  child: string;

  /** 父类/接口符号 ID */
  parent: string;

  /** 引用类型 */
  kind: 'extends' | 'implements';
}

export interface References {
  /** 模块级依赖 */
  moduleDeps: ModuleDependency[];

  /** 符号级调用 */
  symbolCalls: SymbolCall[];

  /** 类型引用 */
  typeRefs: TypeReference[];
}

// ============================================================================
// 统计信息
// ============================================================================

export interface EnhancedStatistics {
  /** 总模块数 */
  totalModules: number;

  /** 总符号数 */
  totalSymbols: number;

  /** 总代码行数 */
  totalLines: number;

  /** 语义覆盖率 */
  semanticCoverage: {
    /** 有描述的模块数 */
    modulesWithDescription: number;
    /** 有描述的符号数 */
    symbolsWithDescription: number;
    /** 覆盖百分比 */
    coveragePercent: number;
  };

  /** 引用统计 */
  referenceStats: {
    /** 模块依赖数 */
    totalModuleDeps: number;
    /** 符号调用数 */
    totalSymbolCalls: number;
    /** 类型引用数 */
    totalTypeRefs: number;
  };

  /** 架构层分布 */
  layerDistribution: Record<ArchitectureLayer, number>;

  /** 语言分布 */
  languageBreakdown: Record<string, number>;

  /** 最大文件 */
  largestFiles: Array<{
    path: string;
    lines: number;
    size: number;
  }>;

  /** 被调用最多的符号 */
  mostCalledSymbols: Array<{
    id: string;
    name: string;
    callCount: number;
  }>;

  /** 被导入最多的模块 */
  mostImportedModules: Array<{
    id: string;
    importCount: number;
  }>;
}

// ============================================================================
// 元数据
// ============================================================================

export interface BlueprintMeta {
  /** 蓝图版本 */
  version: string;

  /** 生成时间 */
  generatedAt: string;

  /** 生成器版本 */
  generatorVersion: string;

  /** 语义版本（用于增量更新） */
  semanticVersion?: string;
}

// ============================================================================
// 项目信息
// ============================================================================

export interface EnhancedProjectInfo {
  /** 项目名称 */
  name: string;

  /** 项目根路径 */
  rootPath: string;

  /** AI 生成的语义信息 */
  semantic?: ProjectSemantic;

  /** 支持的语言 */
  languages: string[];

  /** 技术栈 */
  technologies?: string[];
}

// ============================================================================
// 增强版代码蓝图（根结构）
// ============================================================================

export interface EnhancedCodeBlueprint {
  /** 元数据 */
  meta: BlueprintMeta;

  /** 项目信息 */
  project: EnhancedProjectInfo;

  /** 两种视图 */
  views: Views;

  /** 模块详情（按 ID 索引） */
  modules: Record<string, EnhancedModule>;

  /** 全局符号索引 */
  symbols: Record<string, SymbolEntry>;

  /** 引用关系 */
  references: References;

  /** 统计信息 */
  statistics: EnhancedStatistics;
}

// ============================================================================
// 生成选项
// ============================================================================

export interface EnhancedGenerateOptions {
  /** 包含的文件模式 */
  include?: string[];

  /** 排除的文件模式 */
  exclude?: string[];

  /** 是否生成 AI 语义（默认 true） */
  withSemantics?: boolean;

  /** 输出路径 */
  outputPath?: string;

  /** 并发数 */
  concurrency?: number;

  /** 进度回调 */
  onProgress?: EnhancedProgressCallback;
}

export interface EnhancedAnalysisProgress {
  phase:
    | 'discover'      // 发现文件
    | 'parse'         // 解析代码
    | 'symbols'       // 提取符号
    | 'references'    // 分析引用
    | 'views'         // 构建视图
    | 'semantics'     // AI 语义生成
    | 'aggregate';    // 聚合输出
  current: number;
  total: number;
  currentFile?: string;
  message?: string;
}

export type EnhancedProgressCallback = (progress: EnhancedAnalysisProgress) => void;
