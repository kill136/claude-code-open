/**
 * 代码本体图谱模块
 * Code Ontology Map Module
 *
 * 提供代码库结构分析和可视化功能
 */

// ============================================================================
// 基础类型导出
// ============================================================================

export * from './types.js';

// ============================================================================
// 增强版类型导出（排除重复的 LocationInfo）
// ============================================================================

export type {
  // 架构层
  ArchitectureLayer,
  // 语义
  SemanticInfo,
  ProjectSemantic,
  KeyConcept,
  // 视图
  DirectoryNode,
  LayerInfo,
  ArchitectureLayers,
  Views,
  // 模块
  EnhancedModule,
  ModuleImport,
  // 符号
  SymbolKind,
  SymbolEntry,
  // 引用
  ModuleDependency,
  SymbolCall,
  TypeReference,
  References,
  // 统计
  EnhancedStatistics,
  // 元数据
  BlueprintMeta,
  EnhancedProjectInfo,
  // 根结构
  EnhancedCodeBlueprint,
  // 选项
  EnhancedGenerateOptions,
  EnhancedAnalysisProgress,
  EnhancedProgressCallback,
} from './types-enhanced.js';

// ============================================================================
// 基础模块
// ============================================================================

// 分析器
export { CodeMapAnalyzer, createAnalyzer } from './analyzer.js';

// 本体生成器（旧版）
export {
  OntologyGenerator,
  generateOntology,
  generateAndSaveOntology,
} from './ontology-generator.js';

// 调用图构建器
export { CallGraphBuilder, buildCallGraph } from './call-graph-builder.js';

// 依赖分析器
export { DependencyAnalyzer, analyzeDependencies } from './dependency-analyzer.js';

// 增量缓存
export { IncrementalCache, createCache } from './incremental-cache.js';

// 可视化服务器
export { VisualizationServer, startVisualizationServer } from './server/index.js';

// ============================================================================
// 增强版模块
// ============================================================================

// 架构层分类器
export {
  LayerClassifier,
  classifyModule,
  classifyModules,
  type ClassificationResult,
} from './layer-classifier.js';

// 视图构建器
export {
  ViewBuilder,
  buildViews,
  buildDirectoryTree,
  buildArchitectureLayers,
  countTreeNodes,
  findTreeNode,
  getTreeDepth,
  flattenTree,
} from './view-builder.js';

// 符号引用分析器
export {
  SymbolReferenceAnalyzer,
  analyzeSymbolReferences,
} from './symbol-reference-analyzer.js';

// 类型引用分析器
export {
  TypeReferenceAnalyzer,
  TypeUsageAnalyzer,
  analyzeTypeReferences,
  analyzeTypeUsages,
  type TypeUsage,
} from './type-reference-analyzer.js';

// AI 语义生成器
export {
  SemanticGenerator,
  generateModuleSemantic,
  batchGenerateSemantics,
  generateProjectSemantic,
  type SemanticGeneratorOptions,
} from './semantic-generator.js';

// 增强版生成器
export {
  EnhancedOntologyGenerator,
  generateEnhancedBlueprint,
  generateAndSaveEnhancedBlueprint,
} from './enhanced-generator.js';
