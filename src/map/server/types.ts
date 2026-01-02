/**
 * 可视化服务器类型定义
 */

// ============================================================================
// 模块详情接口 - 用于下钻展示
// ============================================================================

export interface ModuleDetailInfo {
  id: string;
  name: string;
  path: string;
  language: string;
  lines: number;
  semantic?: any;
  // 文件内的符号分组
  symbols: {
    classes: SymbolInfo[];
    interfaces: SymbolInfo[];
    functions: SymbolInfo[];
    types: SymbolInfo[];
    variables: SymbolInfo[];
    constants: SymbolInfo[];
    exports: SymbolInfo[];  // re-export 的符号
  };
  // 导入的外部依赖
  externalImports: string[];
  // 导入的内部模块
  internalImports: string[];
}

export interface SymbolInfo {
  id: string;
  name: string;
  kind: string;
  signature?: string;
  semantic?: any;
  location: {
    startLine: number;
    endLine: number;
  };
  // 子符号（如类的方法）
  children: SymbolInfo[];
}

// ============================================================================
// 符号引用接口 - 展示调用关系
// ============================================================================

export interface SymbolRefInfo {
  symbolId: string;
  symbolName: string;
  symbolKind: string;
  moduleId: string;
  // 被谁调用
  calledBy: {
    symbolId: string;
    symbolName: string;
    moduleId: string;
    callType: string;
    locations: { line: number }[];
  }[];
  // 调用了谁
  calls: {
    symbolId: string;
    symbolName: string;
    moduleId: string;
    callType: string;
    locations: { line: number }[];
  }[];
  // 类型引用（extends/implements）
  typeRefs: {
    relatedSymbolId: string;
    relatedSymbolName: string;
    kind: 'extends' | 'implements';
    direction: 'parent' | 'child';
  }[];
}

// ============================================================================
// 入口点检测和依赖树构建
// ============================================================================

export interface DependencyTreeNode {
  id: string;
  name: string;
  path: string;
  language?: string;
  lines?: number;
  semantic?: any;
  children: DependencyTreeNode[];
  depth: number;
  isCircular?: boolean;
}

// ============================================================================
// 逻辑架构图 - 按目录/功能聚合模块
// ============================================================================

export interface LogicBlock {
  id: string;
  name: string;           // 简短名称
  description: string;    // 语义描述（做什么）
  type: 'entry' | 'core' | 'feature' | 'util' | 'ui' | 'data' | 'config';
  files: string[];        // 包含的文件 ID
  fileCount: number;
  totalLines: number;
  children: LogicBlock[]; // 子逻辑块
  dependencies: string[]; // 依赖的其他逻辑块 ID
}

export interface ArchitectureMap {
  projectName: string;
  projectDescription: string;
  blocks: LogicBlock[];
}

// ============================================================================
// 流程图数据结构
// ============================================================================

export interface FlowchartNode {
  id: string;
  label: string;
  type: 'entry' | 'process' | 'decision' | 'io' | 'end';
  description?: string;
  moduleId?: string;
  symbolId?: string;
  x?: number;
  y?: number;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  type?: 'normal' | 'yes' | 'no' | 'error';
}

export interface Flowchart {
  title: string;
  description: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  entryPoints: string[];
  relatedModules: string[];
}

// ============================================================================
// 新手导览数据结构
// ============================================================================

export interface BeginnerGuide {
  projectName: string;
  projectDescription: string;
  totalFiles: number;
  totalLines: number;
  mainLanguages: string[];
  cards: GuideCard[];
}

export interface GuideCard {
  id: string;
  groupId: string;
  icon: string;
  title: string;
  description: string;
  explain: string;
  analogy: string;
  badge: string;
  files: {
    id: string;
    name: string;
    description: string;
    importance: 'critical' | 'important' | 'normal';
  }[];
}

// ============================================================================
// 业务故事视图
// ============================================================================

export interface StoryGuide {
  projectType: string;
  mainStory: BusinessStory;
  subStories: BusinessStory[];
}

export interface BusinessStory {
  id: string;
  title: string;
  description: string;
  protagonist: string;
  chapters: StoryChapter[];
}

export interface StoryChapter {
  id: string;
  title: string;
  narrative: string;
  keyFiles: {
    id: string;
    name: string;
    role: string;
  }[];
  codeSnippet?: {
    file: string;
    startLine: number;
    endLine: number;
    explanation: string;
  };
}

// ============================================================================
// 代码阅读引擎
// ============================================================================

export interface CodeReadingGuide {
  title: string;
  description: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  paths: ReadingPath[];
}

export interface ReadingPath {
  id: string;
  name: string;
  description: string;
  steps: ReadingStep[];
}

export interface ReadingStep {
  id: string;
  title: string;
  description: string;
  fileId: string;
  fileName: string;
  focusLines?: { start: number; end: number };
  keyPoints: string[];
  nextSteps: string[];
}

// ============================================================================
// 知识快照
// ============================================================================

export interface KnowledgeSnapshot {
  version: string;
  timestamp: number;
  projectHash: string;
  summary: {
    totalModules: number;
    totalSymbols: number;
    totalDependencies: number;
    entryPoints: string[];
    mainPatterns: string[];
  };
}
