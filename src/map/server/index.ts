/**
 * 可视化 Web 服务器
 * 提供代码本体图谱的交互式可视化
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CodeOntology } from '../types.js';
import { EnhancedCodeBlueprint, EnhancedModule, ModuleDependency, SymbolEntry, SymbolCall } from '../types-enhanced.js';

// ============================================================================
// 模块详情接口 - 用于下钻展示
// ============================================================================

interface ModuleDetailInfo {
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

interface SymbolInfo {
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

interface SymbolRefInfo {
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

interface DependencyTreeNode {
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

interface LogicBlock {
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

interface ArchitectureMap {
  projectName: string;
  projectDescription: string;
  blocks: LogicBlock[];
}

/**
 * 构建逻辑架构图
 * 将文件按目录结构和语义聚合成逻辑块
 */
function buildArchitectureMap(blueprint: EnhancedCodeBlueprint): ArchitectureMap {
  const modules = Object.values(blueprint.modules);

  // 按目录分组
  const dirGroups = new Map<string, EnhancedModule[]>();
  for (const mod of modules) {
    // 提取目录路径 (如 src/tools/bash.ts -> src/tools)
    const parts = mod.id.split('/');
    let dir: string;
    if (parts.length === 1) {
      dir = '.'; // 根目录
    } else if (parts.length === 2) {
      dir = parts[0]; // src/xxx.ts -> src
    } else {
      dir = parts.slice(0, -1).join('/'); // src/tools/xxx.ts -> src/tools
    }

    const group = dirGroups.get(dir) || [];
    group.push(mod);
    dirGroups.set(dir, group);
  }

  // 为每个目录创建逻辑块
  const blocks: LogicBlock[] = [];
  const blockMap = new Map<string, LogicBlock>();

  // 定义目录到逻辑块类型的映射
  const typePatterns: [RegExp, LogicBlock['type'], string][] = [
    [/^(src\/)?cli/, 'entry', '程序入口'],
    [/^(src\/)?core/, 'core', '核心引擎'],
    [/^(src\/)?tools?/, 'feature', '工具系统'],
    [/^(src\/)?commands?/, 'feature', '命令处理'],
    [/^(src\/)?ui/, 'ui', '用户界面'],
    [/^(src\/)?hooks?/, 'feature', '钩子系统'],
    [/^(src\/)?plugins?/, 'feature', '插件系统'],
    [/^(src\/)?config/, 'config', '配置管理'],
    [/^(src\/)?session/, 'data', '会话管理'],
    [/^(src\/)?context/, 'core', '上下文管理'],
    [/^(src\/)?streaming/, 'core', '流式处理'],
    [/^(src\/)?providers?/, 'core', 'API 提供者'],
    [/^(src\/)?utils?/, 'util', '工具函数'],
    [/^(src\/)?parser/, 'util', '代码解析'],
    [/^(src\/)?search/, 'util', '代码搜索'],
    [/^(src\/)?map/, 'feature', '代码地图'],
    [/^(src\/)?mcp/, 'feature', 'MCP 服务'],
    [/^(src\/)?ide/, 'feature', 'IDE 集成'],
  ];

  for (const [dir, mods] of dirGroups) {
    // 确定块类型
    let blockType: LogicBlock['type'] = 'util';
    let defaultName = dir.split('/').pop() || dir;

    for (const [pattern, type, name] of typePatterns) {
      if (pattern.test(dir)) {
        blockType = type;
        defaultName = name;
        break;
      }
    }

    // 聚合语义描述
    const descriptions = mods
      .filter(m => m.semantic?.description)
      .map(m => m.semantic!.description);

    // 取最常见的描述或生成默认描述
    let description = descriptions[0] || `${defaultName}相关功能`;

    // 如果有多个文件，尝试总结
    if (mods.length > 3) {
      const funcNames = mods.map(m => m.name.replace(/\.(ts|js)$/, '')).slice(0, 5);
      description = `包含 ${funcNames.join(', ')} 等 ${mods.length} 个模块`;
    }

    const block: LogicBlock = {
      id: dir,
      name: defaultName,
      description,
      type: blockType,
      files: mods.map(m => m.id),
      fileCount: mods.length,
      totalLines: mods.reduce((sum, m) => sum + m.lines, 0),
      children: [],
      dependencies: [],
    };

    blocks.push(block);
    blockMap.set(dir, block);
  }

  // 建立块之间的依赖关系
  for (const dep of blueprint.references.moduleDeps) {
    const sourceDir = getDir(dep.source);
    const targetDir = getDir(dep.target);

    if (sourceDir !== targetDir) {
      const sourceBlock = blockMap.get(sourceDir);
      const targetBlock = blockMap.get(targetDir);

      if (sourceBlock && targetBlock && !sourceBlock.dependencies.includes(targetDir)) {
        sourceBlock.dependencies.push(targetDir);
      }
    }
  }

  // 构建层次结构（根据目录嵌套）
  const rootBlocks: LogicBlock[] = [];
  const processedDirs = new Set<string>();

  // 按目录深度排序
  const sortedBlocks = [...blocks].sort((a, b) => {
    const depthA = a.id.split('/').length;
    const depthB = b.id.split('/').length;
    return depthA - depthB;
  });

  for (const block of sortedBlocks) {
    const parts = block.id.split('/');
    if (parts.length <= 2 || block.id === '.' || block.id === 'src') {
      // 顶层块
      rootBlocks.push(block);
      processedDirs.add(block.id);
    } else {
      // 尝试找到父块
      const parentDir = parts.slice(0, -1).join('/');
      const parentBlock = blockMap.get(parentDir);
      if (parentBlock) {
        parentBlock.children.push(block);
        processedDirs.add(block.id);
      } else {
        rootBlocks.push(block);
        processedDirs.add(block.id);
      }
    }
  }

  // 按类型和重要性排序
  const typeOrder: Record<LogicBlock['type'], number> = {
    entry: 0,
    core: 1,
    feature: 2,
    ui: 3,
    data: 4,
    config: 5,
    util: 6,
  };

  rootBlocks.sort((a, b) => {
    const orderA = typeOrder[a.type];
    const orderB = typeOrder[b.type];
    if (orderA !== orderB) return orderA - orderB;
    return b.fileCount - a.fileCount; // 文件多的优先
  });

  return {
    projectName: blueprint.project.name,
    projectDescription: blueprint.project.semantic?.description || '项目描述',
    blocks: rootBlocks,
  };
}

function getDir(moduleId: string): string {
  const parts = moduleId.split('/');
  if (parts.length === 1) return '.';
  if (parts.length === 2) return parts[0];
  return parts.slice(0, -1).join('/');
}

/**
 * 获取模块详情（用于下钻展示）
 */
function getModuleDetail(blueprint: EnhancedCodeBlueprint, moduleId: string): ModuleDetailInfo | null {
  const module = blueprint.modules[moduleId];
  if (!module) return null;

  // 收集该模块的所有符号
  const moduleSymbols = Object.values(blueprint.symbols).filter(s => s.moduleId === moduleId);

  // 按类型分组
  const symbolGroups: ModuleDetailInfo['symbols'] = {
    classes: [],
    interfaces: [],
    functions: [],
    types: [],
    variables: [],
    constants: [],
    exports: [],
  };

  // 构建父子关系映射
  const childrenMap = new Map<string, SymbolEntry[]>();
  for (const sym of moduleSymbols) {
    if (sym.parent) {
      const children = childrenMap.get(sym.parent) || [];
      children.push(sym);
      childrenMap.set(sym.parent, children);
    }
  }

  // 转换符号为 SymbolInfo
  function toSymbolInfo(sym: SymbolEntry): SymbolInfo {
    const children = childrenMap.get(sym.id) || [];
    return {
      id: sym.id,
      name: sym.name,
      kind: sym.kind,
      signature: sym.signature,
      semantic: sym.semantic,
      location: {
        startLine: sym.location.startLine,
        endLine: sym.location.endLine,
      },
      children: children.map(toSymbolInfo),
    };
  }

  // 只处理顶层符号（没有 parent 的）
  for (const sym of moduleSymbols) {
    if (sym.parent) continue; // 跳过子符号

    const info = toSymbolInfo(sym);

    switch (sym.kind) {
      case 'class':
        symbolGroups.classes.push(info);
        break;
      case 'interface':
        symbolGroups.interfaces.push(info);
        break;
      case 'function':
        symbolGroups.functions.push(info);
        break;
      case 'type':
        symbolGroups.types.push(info);
        break;
      case 'variable':
        symbolGroups.variables.push(info);
        break;
      case 'constant':
        symbolGroups.constants.push(info);
        break;
    }
  }

  // 分离内部和外部导入
  const externalImports: string[] = [];
  const internalImports: string[] = [];

  for (const imp of module.imports) {
    if (imp.isExternal) {
      externalImports.push(imp.source);
    } else {
      internalImports.push(imp.source);
    }
  }

  return {
    id: module.id,
    name: module.name,
    path: module.path,
    language: module.language,
    lines: module.lines,
    semantic: module.semantic,
    symbols: symbolGroups,
    externalImports: [...new Set(externalImports)],
    internalImports: [...new Set(internalImports)],
  };
}

/**
 * 获取符号引用关系
 */
function getSymbolRefs(blueprint: EnhancedCodeBlueprint, symbolId: string): SymbolRefInfo | null {
  const symbol = blueprint.symbols[symbolId];
  if (!symbol) return null;

  const result: SymbolRefInfo = {
    symbolId: symbol.id,
    symbolName: symbol.name,
    symbolKind: symbol.kind,
    moduleId: symbol.moduleId,
    calledBy: [],
    calls: [],
    typeRefs: [],
  };

  // 查找调用关系
  for (const call of blueprint.references.symbolCalls) {
    if (call.callee === symbolId) {
      // 该符号被调用
      const callerSymbol = blueprint.symbols[call.caller];
      if (callerSymbol) {
        result.calledBy.push({
          symbolId: call.caller,
          symbolName: callerSymbol.name,
          moduleId: callerSymbol.moduleId,
          callType: call.callType,
          locations: call.locations.map(loc => ({ line: loc.startLine })),
        });
      }
    }
    if (call.caller === symbolId) {
      // 该符号调用了其他
      const calleeSymbol = blueprint.symbols[call.callee];
      if (calleeSymbol) {
        result.calls.push({
          symbolId: call.callee,
          symbolName: calleeSymbol.name,
          moduleId: calleeSymbol.moduleId,
          callType: call.callType,
          locations: call.locations.map(loc => ({ line: loc.startLine })),
        });
      }
    }
  }

  // 查找类型引用
  for (const ref of blueprint.references.typeRefs) {
    if (ref.child === symbolId) {
      // 该符号继承/实现了其他
      const parentSymbol = blueprint.symbols[ref.parent];
      if (parentSymbol) {
        result.typeRefs.push({
          relatedSymbolId: ref.parent,
          relatedSymbolName: parentSymbol.name,
          kind: ref.kind,
          direction: 'parent',
        });
      }
    }
    if (ref.parent === symbolId) {
      // 其他符号继承/实现了该符号
      const childSymbol = blueprint.symbols[ref.child];
      if (childSymbol) {
        result.typeRefs.push({
          relatedSymbolId: ref.child,
          relatedSymbolName: childSymbol.name,
          kind: ref.kind,
          direction: 'child',
        });
      }
    }
  }

  return result;
}

/**
 * 自动检测项目入口点
 */
function detectEntryPoints(blueprint: EnhancedCodeBlueprint): string[] {
  const entryPatterns = [
    /cli\.(ts|js)$/,
    /index\.(ts|js)$/,
    /main\.(ts|js)$/,
    /app\.(ts|js)$/,
    /server\.(ts|js)$/,
    /entry\.(ts|js)$/,
  ];

  const candidates: { id: string; score: number }[] = [];

  // 计算每个模块被导入的次数
  const importCounts = new Map<string, number>();
  for (const dep of blueprint.references.moduleDeps) {
    const count = importCounts.get(dep.target) || 0;
    importCounts.set(dep.target, count + 1);
  }

  for (const mod of Object.values(blueprint.modules)) {
    let score = 0;

    // 入口文件名模式匹配
    for (let i = 0; i < entryPatterns.length; i++) {
      if (entryPatterns[i].test(mod.id)) {
        // 优先级：cli > index > main > app > server > entry
        score += (entryPatterns.length - i) * 10;
        break;
      }
    }

    // 在根目录或 src 目录下的文件加分
    if (/^(src\/)?[^/]+\.(ts|js)$/.test(mod.id)) {
      score += 5;
    }

    // 不被任何其他模块导入的文件加分（可能是真正的入口）
    const importCount = importCounts.get(mod.id) || 0;
    if (importCount === 0) {
      score += 20;
    }

    // 有导入其他模块的文件加分
    if (mod.imports.length > 0) {
      score += Math.min(mod.imports.length, 10);
    }

    if (score > 0) {
      candidates.push({ id: mod.id, score });
    }
  }

  // 按分数排序，取前 5 个
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 5).map(c => c.id);
}

/**
 * 构建从入口点开始的依赖树
 */
function buildDependencyTree(
  blueprint: EnhancedCodeBlueprint,
  entryId: string,
  maxDepth: number = 10
): DependencyTreeNode | null {
  const module = blueprint.modules[entryId];
  if (!module) return null;

  // 构建依赖图
  const depsBySource = new Map<string, ModuleDependency[]>();
  for (const dep of blueprint.references.moduleDeps) {
    const deps = depsBySource.get(dep.source) || [];
    deps.push(dep);
    depsBySource.set(dep.source, deps);
  }

  const visited = new Set<string>();

  function buildNode(moduleId: string, depth: number): DependencyTreeNode | null {
    const mod = blueprint.modules[moduleId];
    if (!mod) return null;

    const isCircular = visited.has(moduleId);

    const node: DependencyTreeNode = {
      id: moduleId,
      name: mod.name,
      path: mod.path,
      language: mod.language,
      lines: mod.lines,
      semantic: mod.semantic,
      children: [],
      depth,
      isCircular,
    };

    if (isCircular || depth >= maxDepth) {
      return node;
    }

    visited.add(moduleId);

    // 获取该模块的所有依赖
    const deps = depsBySource.get(moduleId) || [];

    // 按目标模块名排序
    deps.sort((a, b) => a.target.localeCompare(b.target));

    for (const dep of deps) {
      // 只处理内部模块
      if (blueprint.modules[dep.target]) {
        const childNode = buildNode(dep.target, depth + 1);
        if (childNode) {
          node.children.push(childNode);
        }
      }
    }

    visited.delete(moduleId);

    return node;
  }

  return buildNode(entryId, 0);
}

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// VisualizationServer 类
// ============================================================================

export class VisualizationServer {
  private server: http.Server | null = null;
  private ontologyPath: string;
  private port: number;
  private staticDir: string;

  constructor(ontologyPath: string, port: number = 3030) {
    this.ontologyPath = ontologyPath;
    this.port = port;
    this.staticDir = path.join(__dirname, 'static');
  }

  /**
   * 启动服务器
   */
  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        resolve(url);
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 处理请求
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // API 路由
    if (pathname.startsWith('/api/')) {
      this.handleApiRequest(pathname, url, res);
      return;
    }

    // 静态文件
    this.handleStaticRequest(pathname, res);
  }

  /**
   * 判断是否为新格式（EnhancedCodeBlueprint）
   */
  private isEnhancedFormat(data: any): data is EnhancedCodeBlueprint {
    return data.meta && data.meta.version && data.views && data.references;
  }

  /**
   * 将新格式转换为前端兼容格式
   */
  private convertToLegacyFormat(blueprint: EnhancedCodeBlueprint): any {
    // 将 modules 对象转为数组
    const modulesArray = Object.values(blueprint.modules).map((m: EnhancedModule) => ({
      id: m.id,
      name: m.name,
      path: m.path,
      language: m.language,
      lines: m.lines,
      size: m.size,
      imports: m.imports,
      exports: m.exports,
      classes: [],
      interfaces: [],
      functions: [],
      semantic: m.semantic,
    }));

    // 将 references.moduleDeps 转为 dependencyGraph.edges
    const edges = blueprint.references.moduleDeps.map(dep => ({
      source: dep.source,
      target: dep.target,
      type: dep.type,
      symbols: dep.symbols,
      isTypeOnly: dep.isTypeOnly,
    }));

    // 从 symbols 中提取类、接口、函数
    for (const symbol of Object.values(blueprint.symbols)) {
      const mod = modulesArray.find(m => m.id === symbol.moduleId);
      if (!mod) continue;

      if (symbol.kind === 'class') {
        mod.classes.push({
          id: symbol.id,
          name: symbol.name,
          location: symbol.location,
          semantic: symbol.semantic,
        });
      } else if (symbol.kind === 'interface') {
        mod.interfaces.push({
          id: symbol.id,
          name: symbol.name,
          location: symbol.location,
          semantic: symbol.semantic,
        });
      } else if (symbol.kind === 'function') {
        mod.functions.push({
          id: symbol.id,
          name: symbol.name,
          signature: symbol.signature,
          location: symbol.location,
          semantic: symbol.semantic,
        });
      }
    }

    // 构造兼容格式的统计信息
    const statistics = {
      totalModules: blueprint.statistics.totalModules,
      totalClasses: Object.values(blueprint.symbols).filter(s => s.kind === 'class').length,
      totalInterfaces: Object.values(blueprint.symbols).filter(s => s.kind === 'interface').length,
      totalFunctions: Object.values(blueprint.symbols).filter(s => s.kind === 'function').length,
      totalMethods: Object.values(blueprint.symbols).filter(s => s.kind === 'method').length,
      totalLines: blueprint.statistics.totalLines,
      totalDependencyEdges: blueprint.statistics.referenceStats.totalModuleDeps,
      languageBreakdown: blueprint.statistics.languageBreakdown,
      largestFiles: blueprint.statistics.largestFiles,
      mostImportedModules: blueprint.statistics.mostImportedModules,
      mostCalledFunctions: blueprint.statistics.mostCalledSymbols,
      // 新格式独有的统计
      semanticCoverage: blueprint.statistics.semanticCoverage,
      layerDistribution: blueprint.statistics.layerDistribution,
      referenceStats: blueprint.statistics.referenceStats,
    };

    return {
      version: blueprint.meta.version,
      generatedAt: blueprint.meta.generatedAt,
      project: blueprint.project,
      modules: modulesArray,
      dependencyGraph: { edges },
      statistics,
      // 保留新格式的额外信息
      views: blueprint.views,
      symbols: blueprint.symbols,
      references: blueprint.references,
      isEnhanced: true,
    };
  }

  /**
   * 处理 API 请求
   */
  private handleApiRequest(
    pathname: string,
    url: URL,
    res: http.ServerResponse
  ): void {
    try {
      if (pathname === '/api/ontology') {
        // 返回完整的本体数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        // 检测格式并转换
        let ontology;
        if (this.isEnhancedFormat(data)) {
          ontology = this.convertToLegacyFormat(data);
        } else {
          ontology = data;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ontology));
        return;
      }

      if (pathname.startsWith('/api/module/')) {
        // 返回单个模块
        const moduleId = decodeURIComponent(pathname.slice('/api/module/'.length));
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        let module;
        if (this.isEnhancedFormat(data)) {
          // 新格式：modules 是对象
          module = data.modules[moduleId];
        } else {
          // 旧格式：modules 是数组
          module = (data as CodeOntology).modules.find((m) => m.id === moduleId);
        }

        if (module) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(module));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Module not found' }));
        }
        return;
      }

      if (pathname === '/api/search') {
        // 搜索
        const query = url.searchParams.get('q') || '';
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        let results;
        if (this.isEnhancedFormat(data)) {
          results = this.searchEnhanced(data, query);
        } else {
          results = this.search(data as CodeOntology, query);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
      }

      if (pathname === '/api/stats') {
        // 统计信息
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        let statistics;
        if (this.isEnhancedFormat(data)) {
          statistics = data.statistics;
        } else {
          statistics = (data as CodeOntology).statistics;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(statistics));
        return;
      }

      if (pathname === '/api/architecture') {
        // 返回逻辑架构图
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const archMap = buildArchitectureMap(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(archMap));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Architecture map requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/entry-points') {
        // 返回检测到的入口点
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const entryPoints = detectEntryPoints(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ entryPoints }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Entry point detection requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/dependency-tree') {
        // 返回从指定入口点开始的依赖树
        const entryId = url.searchParams.get('entry') || '';
        const maxDepth = parseInt(url.searchParams.get('depth') || '10', 10);

        if (!entryId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing entry parameter' }));
          return;
        }

        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const tree = buildDependencyTree(data, entryId, maxDepth);
          if (tree) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tree));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Entry module not found' }));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Dependency tree requires enhanced format' }));
        }
        return;
      }

      if (pathname.startsWith('/api/module-detail/')) {
        // 返回模块详情（含符号分组）
        const moduleId = decodeURIComponent(pathname.slice('/api/module-detail/'.length));
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const detail = getModuleDetail(data, moduleId);
          if (detail) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(detail));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Module not found' }));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Module detail requires enhanced format' }));
        }
        return;
      }

      if (pathname.startsWith('/api/symbol-refs/')) {
        // 返回符号引用关系
        const symbolId = decodeURIComponent(pathname.slice('/api/symbol-refs/'.length));
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const refs = getSymbolRefs(data, symbolId);
          if (refs) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(refs));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Symbol not found' }));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Symbol refs requires enhanced format' }));
        }
        return;
      }

      // 未知 API
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API not found' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  }

  /**
   * 处理静态文件请求
   */
  private handleStaticRequest(
    pathname: string,
    res: http.ServerResponse
  ): void {
    // 默认请求返回 index.html
    if (pathname === '/' || pathname === '/index.html') {
      this.serveFile('index.html', res);
      return;
    }

    // 其他静态文件
    const fileName = pathname.slice(1);
    this.serveFile(fileName, res);
  }

  /**
   * 提供静态文件
   */
  private serveFile(fileName: string, res: http.ServerResponse): void {
    const filePath = path.join(this.staticDir, fileName);

    // 安全检查：防止路径遍历
    if (!filePath.startsWith(this.staticDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    try {
      if (!fs.existsSync(filePath)) {
        // 文件不存在，返回内嵌的 HTML
        if (fileName === 'index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getEmbeddedHtml());
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const content = fs.readFileSync(filePath);
      const contentType = this.getContentType(fileName);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  /**
   * 获取文件的 Content-Type
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();

    const types: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };

    return types[ext] || 'application/octet-stream';
  }

  /**
   * 搜索功能
   */
  private search(ontology: CodeOntology, query: string): any[] {
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    if (!lowerQuery) {
      return results;
    }

    for (const module of ontology.modules) {
      // 搜索模块名
      if (module.name.toLowerCase().includes(lowerQuery) ||
          module.id.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'module',
          id: module.id,
          name: module.name,
          path: module.path,
        });
      }

      // 搜索类
      for (const cls of module.classes) {
        if (cls.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'class',
            id: cls.id,
            name: cls.name,
            moduleId: module.id,
          });
        }
      }

      // 搜索函数
      for (const func of module.functions) {
        if (func.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'function',
            id: func.id,
            name: func.name,
            moduleId: module.id,
          });
        }
      }

      // 搜索接口
      for (const iface of module.interfaces) {
        if (iface.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'interface',
            id: iface.id,
            name: iface.name,
            moduleId: module.id,
          });
        }
      }
    }

    // 限制结果数量
    return results.slice(0, 50);
  }

  /**
   * 增强版搜索功能（新格式）
   */
  private searchEnhanced(blueprint: EnhancedCodeBlueprint, query: string): any[] {
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    if (!lowerQuery) {
      return results;
    }

    // 搜索模块
    for (const module of Object.values(blueprint.modules)) {
      if (module.name.toLowerCase().includes(lowerQuery) ||
          module.id.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'module',
          id: module.id,
          name: module.name,
          path: module.path,
          semantic: module.semantic,
        });
      }
    }

    // 搜索符号
    for (const symbol of Object.values(blueprint.symbols)) {
      if (symbol.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: symbol.kind,
          id: symbol.id,
          name: symbol.name,
          moduleId: symbol.moduleId,
          signature: symbol.signature,
          semantic: symbol.semantic,
        });
      }
    }

    // 限制结果数量
    return results.slice(0, 50);
  }

  /**
   * 内嵌的 HTML 页面
   */
  private getEmbeddedHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Ontology Map</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #16213e;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid #0f3460;
      flex-wrap: wrap;
    }
    header h1 { font-size: 1.2rem; color: #e94560; }
    .search-box {
      flex: 1;
      max-width: 400px;
    }
    .search-box input {
      width: 100%;
      padding: 0.5rem 1rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #1a1a2e;
      color: #eee;
      font-size: 0.9rem;
    }
    .search-box input:focus {
      outline: none;
      border-color: #e94560;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .controls button {
      padding: 0.5rem 1rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
      cursor: pointer;
    }
    .controls button:hover { background: #0f3460; }
    .controls button.active { background: #e94560; border-color: #e94560; }
    .controls select {
      padding: 0.5rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
    }
    .entry-selector {
      display: none;
      gap: 0.5rem;
      align-items: center;
    }
    .entry-selector.active { display: flex; }
    .entry-selector label { font-size: 0.85rem; color: #888; }
    main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    #sidebar {
      width: 280px;
      background: #16213e;
      border-right: 1px solid #0f3460;
      overflow-y: auto;
      padding: 1rem;
    }
    #sidebar h2 {
      font-size: 0.9rem;
      color: #e94560;
      margin-bottom: 0.5rem;
    }
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      border-bottom: 1px solid #0f3460;
      font-size: 0.85rem;
    }
    .stat-value { color: #e94560; font-weight: bold; }
    .module-list { margin-top: 1rem; }
    .module-item {
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .module-item:hover { background: #0f3460; }
    #graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #graph-container svg {
      width: 100%;
      height: 100%;
    }
    .node { cursor: pointer; }
    .node circle {
      stroke: #0f3460;
      stroke-width: 2px;
    }
    .node.module circle { fill: #e94560; }
    .node.class circle { fill: #0f3460; }
    .node.function circle { fill: #16213e; }
    .node.interface circle { fill: #533483; }
    .node text {
      font-size: 11px;
      fill: #eee;
    }
    .node.circular circle { fill: #ff6b6b; stroke: #ff6b6b; opacity: 0.6; }
    .node.circular text { fill: #ff6b6b; font-style: italic; }
    .link {
      stroke: #0f3460;
      stroke-opacity: 0.6;
      fill: none;
    }
    .link.dependency { stroke: #e94560; }
    .link.tree-link { stroke: #4ecdc4; stroke-width: 2; }
    #details-panel {
      width: 300px;
      background: #16213e;
      border-left: 1px solid #0f3460;
      padding: 1rem;
      overflow-y: auto;
      display: none;
    }
    #details-panel.active { display: block; }
    #details-panel h2 {
      font-size: 1rem;
      color: #e94560;
      margin-bottom: 1rem;
    }
    #details-panel .info-item {
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    #details-panel .info-label { color: #888; }
    #details-panel .info-value { color: #eee; }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.2rem;
      color: #e94560;
    }
    #search-results {
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
      display: none;
      min-width: 300px;
    }
    #search-results.active { display: block; }
    .search-result-item {
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #0f3460;
      font-size: 0.85rem;
    }
    .search-result-item:hover { background: #0f3460; }
    .search-result-type {
      display: inline-block;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      font-size: 0.7rem;
      margin-right: 0.5rem;
    }
    .search-result-type.module { background: #e94560; }
    .search-result-type.class { background: #0f3460; border: 1px solid #e94560; }
    .search-result-type.function { background: #16213e; border: 1px solid #e94560; }
    .search-result-type.interface { background: #533483; }

    /* 树形视图样式 */
    .tree-node { cursor: pointer; }
    .tree-node rect {
      fill: #16213e;
      stroke: #0f3460;
      stroke-width: 1px;
      rx: 4;
    }
    .tree-node:hover rect { stroke: #e94560; }
    .tree-node.depth-0 rect { fill: #e94560; stroke: #e94560; }
    .tree-node.depth-1 rect { fill: #533483; }
    .tree-node.depth-2 rect { fill: #0f3460; }
    .tree-node.circular rect { fill: #ff6b6b; opacity: 0.6; }
    .tree-node text {
      font-size: 11px;
      fill: #eee;
    }
    .tree-link {
      fill: none;
      stroke: #4ecdc4;
      stroke-width: 1.5;
      stroke-opacity: 0.6;
    }
    .depth-indicator {
      position: absolute;
      left: 10px;
      bottom: 10px;
      background: rgba(22, 33, 62, 0.9);
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      display: none;
    }
    .depth-indicator.active { display: block; }
    .depth-legend {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    .depth-legend-item {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .depth-legend-item .color-box {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    /* 架构图样式 */
    .arch-block {
      cursor: pointer;
    }
    .arch-block rect {
      rx: 8;
      stroke-width: 2;
    }
    .arch-block:hover rect {
      filter: brightness(1.2);
    }
    .arch-block.type-entry rect { fill: #e94560; stroke: #e94560; }
    .arch-block.type-core rect { fill: #533483; stroke: #533483; }
    .arch-block.type-feature rect { fill: #0f3460; stroke: #4ecdc4; }
    .arch-block.type-ui rect { fill: #16213e; stroke: #e94560; }
    .arch-block.type-data rect { fill: #16213e; stroke: #533483; }
    .arch-block.type-config rect { fill: #16213e; stroke: #888; }
    .arch-block.type-util rect { fill: #16213e; stroke: #0f3460; }
    .arch-block .block-title {
      font-size: 14px;
      font-weight: bold;
      fill: #fff;
    }
    .arch-block .block-desc {
      font-size: 11px;
      fill: #ccc;
    }
    .arch-block .block-info {
      font-size: 10px;
      fill: #888;
    }
    .arch-link {
      fill: none;
      stroke: #4ecdc4;
      stroke-width: 2;
      stroke-opacity: 0.5;
      marker-end: url(#arrow);
    }
    .arch-legend {
      position: absolute;
      right: 10px;
      bottom: 10px;
      background: rgba(22, 33, 62, 0.95);
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      display: none;
    }
    .arch-legend.active { display: block; }
    .arch-legend h3 {
      color: #e94560;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .arch-legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.3rem 0;
    }
    .arch-legend-item .color-box {
      width: 20px;
      height: 14px;
      border-radius: 3px;
    }
    .project-header {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      display: none;
    }
    .project-header.active { display: block; }
    .project-header h2 {
      color: #e94560;
      font-size: 1.5rem;
      margin-bottom: 0.3rem;
    }
    .project-header p {
      color: #888;
      font-size: 0.9rem;
    }

    /* 下钻面包屑导航 */
    .breadcrumb {
      display: none;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #16213e;
      border-bottom: 1px solid #0f3460;
      font-size: 0.85rem;
    }
    .breadcrumb.active { display: flex; }
    .breadcrumb-item {
      color: #4ecdc4;
      cursor: pointer;
    }
    .breadcrumb-item:hover { color: #e94560; }
    .breadcrumb-separator { color: #888; }
    .breadcrumb-current { color: #eee; }

    /* 文件节点样式 */
    .file-node {
      cursor: pointer;
    }
    .file-node rect {
      fill: #1a1a2e;
      stroke: #4ecdc4;
      stroke-width: 1.5;
      rx: 4;
    }
    .file-node:hover rect { stroke: #e94560; filter: brightness(1.2); }
    .file-node text {
      font-size: 11px;
      fill: #eee;
    }
    .file-node .file-desc {
      font-size: 9px;
      fill: #888;
    }

    /* 符号节点样式 */
    .symbol-node {
      cursor: pointer;
    }
    .symbol-node rect {
      rx: 4;
      stroke-width: 1.5;
    }
    .symbol-node:hover rect { filter: brightness(1.3); }
    .symbol-node.kind-class rect { fill: #e94560; stroke: #e94560; }
    .symbol-node.kind-interface rect { fill: #533483; stroke: #533483; }
    .symbol-node.kind-function rect { fill: #0f3460; stroke: #4ecdc4; }
    .symbol-node.kind-type rect { fill: #16213e; stroke: #888; }
    .symbol-node.kind-variable rect { fill: #16213e; stroke: #0f3460; }
    .symbol-node.kind-constant rect { fill: #16213e; stroke: #ff6b6b; }
    .symbol-node.kind-method rect { fill: #0f3460; stroke: #888; }
    .symbol-node.kind-property rect { fill: #1a1a2e; stroke: #533483; }
    .symbol-node.kind-export rect { fill: #2d3436; stroke: #00cec9; }
    .symbol-node text {
      font-size: 11px;
      fill: #eee;
    }
    .symbol-node .symbol-sig {
      font-size: 9px;
      fill: #aaa;
    }

    /* 引用关系样式 */
    .ref-link {
      fill: none;
      stroke-width: 1.5;
      stroke-opacity: 0.6;
    }
    .ref-link.calls { stroke: #e94560; }
    .ref-link.called-by { stroke: #4ecdc4; }
    .ref-link.extends { stroke: #533483; stroke-dasharray: 5,3; }
    .ref-link.implements { stroke: #888; stroke-dasharray: 3,3; }

    /* 符号图例 */
    .symbol-legend {
      position: absolute;
      left: 10px;
      bottom: 10px;
      background: rgba(22, 33, 62, 0.95);
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      display: none;
    }
    .symbol-legend.active { display: block; }
    .symbol-legend h3 {
      color: #e94560;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .symbol-legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.3rem 0;
    }
    .symbol-legend-item .color-box {
      width: 16px;
      height: 12px;
      border-radius: 2px;
    }

    /* 返回按钮 */
    .back-btn {
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 0.5rem 1rem;
      background: #e94560;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: none;
      font-size: 0.85rem;
    }
    .back-btn.active { display: block; }
    .back-btn:hover { background: #c73b50; }

    /* 引用面板 */
    .refs-section {
      margin-top: 1rem;
      padding-top: 0.5rem;
      border-top: 1px solid #0f3460;
    }
    .refs-section h3 {
      font-size: 0.85rem;
      color: #e94560;
      margin-bottom: 0.5rem;
    }
    .ref-item {
      padding: 0.3rem 0.5rem;
      font-size: 0.75rem;
      color: #4ecdc4;
      cursor: pointer;
      border-radius: 3px;
    }
    .ref-item:hover { background: #0f3460; }
    .ref-item .ref-type {
      color: #888;
      font-size: 0.7rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>📊 Code Ontology Map</h1>
    <div class="search-box">
      <input type="text" id="search" placeholder="搜索模块、类、函数...">
    </div>
    <div class="controls">
      <button id="zoom-in">+</button>
      <button id="zoom-out">-</button>
      <button id="reset">重置</button>
      <select id="view-mode">
        <option value="architecture">架构概览</option>
        <option value="dependency">依赖图</option>
        <option value="entry-tree">入口树</option>
      </select>
    </div>
    <div class="entry-selector" id="entry-selector">
      <label>入口点:</label>
      <select id="entry-point"></select>
      <label>深度:</label>
      <select id="max-depth">
        <option value="3">3层</option>
        <option value="5" selected>5层</option>
        <option value="8">8层</option>
        <option value="10">10层</option>
      </select>
    </div>
  </header>

  <!-- 面包屑导航 -->
  <div class="breadcrumb" id="breadcrumb"></div>

  <main>
    <aside id="sidebar">
      <h2>统计</h2>
      <div id="stats"></div>
      <div class="module-list">
        <h2>模块</h2>
        <div id="module-list"></div>
      </div>
    </aside>

    <section id="graph-container">
      <div class="loading">加载中...</div>
      <svg id="graph"></svg>
      <button class="back-btn" id="back-btn">← 返回上级</button>
      <div class="project-header" id="project-header">
        <h2 id="project-name"></h2>
        <p id="project-desc"></p>
      </div>
      <div class="depth-indicator" id="depth-indicator">
        <div>颜色表示层级深度</div>
        <div class="depth-legend">
          <div class="depth-legend-item"><span class="color-box" style="background:#e94560"></span>入口</div>
          <div class="depth-legend-item"><span class="color-box" style="background:#533483"></span>1层</div>
          <div class="depth-legend-item"><span class="color-box" style="background:#0f3460"></span>2层</div>
          <div class="depth-legend-item"><span class="color-box" style="background:#16213e;border:1px solid #0f3460"></span>更深</div>
          <div class="depth-legend-item"><span class="color-box" style="background:#ff6b6b"></span>循环</div>
        </div>
      </div>
      <div class="arch-legend" id="arch-legend">
        <h3>图例说明</h3>
        <div class="arch-legend-item"><span class="color-box" style="background:#e94560"></span>入口层</div>
        <div class="arch-legend-item"><span class="color-box" style="background:#533483"></span>核心引擎</div>
        <div class="arch-legend-item"><span class="color-box" style="background:#0f3460;border:1px solid #4ecdc4"></span>功能模块</div>
        <div class="arch-legend-item"><span class="color-box" style="background:#16213e;border:1px solid #e94560"></span>用户界面</div>
        <div class="arch-legend-item"><span class="color-box" style="background:#16213e;border:1px solid #888"></span>配置/工具</div>
        <p style="margin-top:0.5rem;color:#888;font-size:0.75rem">双击模块下钻查看<br>点击查看详情</p>
      </div>
      <div class="symbol-legend" id="symbol-legend">
        <h3>符号类型</h3>
        <div class="symbol-legend-item"><span class="color-box" style="background:#e94560"></span>类 Class</div>
        <div class="symbol-legend-item"><span class="color-box" style="background:#533483"></span>接口 Interface</div>
        <div class="symbol-legend-item"><span class="color-box" style="background:#0f3460;border:1px solid #4ecdc4"></span>函数 Function</div>
        <div class="symbol-legend-item"><span class="color-box" style="background:#16213e;border:1px solid #888"></span>类型 Type</div>
        <div class="symbol-legend-item"><span class="color-box" style="background:#16213e;border:1px solid #ff6b6b"></span>常量 Constant</div>
        <div class="symbol-legend-item"><span class="color-box" style="background:#2d3436;border:1px solid #00cec9"></span>导出 Export</div>
        <p style="margin-top:0.5rem;color:#888;font-size:0.75rem">双击符号查看引用<br>点击查看详情</p>
      </div>
    </section>

    <aside id="details-panel">
      <h2>详情</h2>
      <div id="node-details"></div>
    </aside>
  </main>

  <div id="search-results"></div>

  <script>
    // 状态
    let ontology = null;
    let archData = null;
    let simulation = null;
    let svg, g, zoom;
    let currentView = 'architecture';
    let entryPoints = [];

    // 下钻导航状态
    let drillStack = []; // 导航历史栈 [{type: 'arch'|'block'|'file'|'symbol', data: any}]
    let currentDrillLevel = null; // 当前下钻层级

    // 更新面包屑导航
    function updateBreadcrumb() {
      const breadcrumb = document.getElementById('breadcrumb');
      const backBtn = document.getElementById('back-btn');

      if (drillStack.length === 0) {
        breadcrumb.classList.remove('active');
        backBtn.classList.remove('active');
        return;
      }

      breadcrumb.classList.add('active');
      backBtn.classList.add('active');

      let html = '<span class="breadcrumb-item" onclick="goToLevel(-1)">架构概览</span>';

      drillStack.forEach((item, index) => {
        html += '<span class="breadcrumb-separator">›</span>';
        if (index === drillStack.length - 1) {
          html += '<span class="breadcrumb-current">' + item.name + '</span>';
        } else {
          html += '<span class="breadcrumb-item" onclick="goToLevel(' + index + ')">' + item.name + '</span>';
        }
      });

      breadcrumb.innerHTML = html;
    }

    // 跳转到指定层级
    function goToLevel(index) {
      if (index === -1) {
        // 返回架构概览
        drillStack = [];
        currentDrillLevel = null;
        hideAllIndicators();
        renderArchitecture();
        updateBreadcrumb();
        return;
      }

      // 截断栈到指定位置
      drillStack = drillStack.slice(0, index + 1);
      const target = drillStack[index];

      if (target.type === 'block') {
        renderBlockFiles(target.data);
      } else if (target.type === 'file') {
        renderFileSymbols(target.data);
      }

      updateBreadcrumb();
    }

    // 返回上一级
    function goBack() {
      if (drillStack.length === 0) return;

      drillStack.pop();
      if (drillStack.length === 0) {
        goToLevel(-1);
      } else {
        goToLevel(drillStack.length - 1);
      }
    }

    // 加载数据
    async function loadOntology() {
      try {
        const response = await fetch('/api/ontology');
        ontology = await response.json();
        renderStats();
        renderModuleList();

        // 加载入口点
        if (ontology.isEnhanced) {
          loadEntryPoints();
          // 默认显示架构图
          renderArchitecture();
        } else {
          renderGraph();
        }
        document.querySelector('.loading').style.display = 'none';
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 加载入口点
    async function loadEntryPoints() {
      try {
        const response = await fetch('/api/entry-points');
        const data = await response.json();
        entryPoints = data.entryPoints || [];

        const select = document.getElementById('entry-point');
        select.innerHTML = entryPoints.map(ep =>
          '<option value="' + ep + '">' + ep + '</option>'
        ).join('');
      } catch (error) {
        console.error('Failed to load entry points:', error);
      }
    }

    // 渲染统计信息
    function renderStats() {
      const stats = ontology.statistics;
      const isEnhanced = ontology.isEnhanced;

      const items = [
        { label: '模块数', value: stats.totalModules },
        { label: '类', value: stats.totalClasses || 0 },
        { label: '接口', value: stats.totalInterfaces || 0 },
        { label: '函数', value: stats.totalFunctions || 0 },
        { label: '代码行', value: (stats.totalLines || 0).toLocaleString() },
        { label: '依赖', value: stats.totalDependencyEdges || (stats.referenceStats ? stats.referenceStats.totalModuleDeps : 0) },
      ];

      if (isEnhanced && stats.semanticCoverage) {
        items.push({ label: '语义覆盖', value: stats.semanticCoverage.coveragePercent + '%' });
      }

      const html = items.map(item =>
        '<div class="stat-item"><span>' + item.label + '</span><span class="stat-value">' + (item.value !== undefined ? item.value : 0) + '</span></div>'
      ).join('');

      document.getElementById('stats').innerHTML = html;
    }

    // 渲染模块列表
    function renderModuleList() {
      const html = ontology.modules
        .slice(0, 50)
        .map(m => '<div class="module-item" data-id="' + m.id + '" title="' + m.id + '">' + m.name + '</div>')
        .join('');

      document.getElementById('module-list').innerHTML = html;

      document.querySelectorAll('.module-item').forEach(item => {
        item.addEventListener('click', () => {
          showModuleDetails(item.dataset.id);
        });
      });
    }

    // 渲染依赖图（力导向）
    function renderGraph() {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      const nodes = [];
      const links = [];
      const nodeMap = new Map();

      const displayModules = ontology.modules.slice(0, 100);

      displayModules.forEach(m => {
        const node = { id: m.id, name: m.name, type: 'module', data: m };
        nodes.push(node);
        nodeMap.set(m.id, node);
      });

      ontology.dependencyGraph.edges.forEach(edge => {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
          links.push({
            source: edge.source,
            target: edge.target,
            type: 'dependency',
          });
        }
      });

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', d => 'link ' + d.type)
        .attr('stroke-width', 1);

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', d => 'node ' + d.type)
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('circle').attr('r', 8);
      node.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .text(d => d.name.length > 20 ? d.name.slice(0, 20) + '...' : d.name);

      node.on('click', (event, d) => {
        showModuleDetails(d.id);
      });

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x; d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    // 渲染架构概览图
    async function renderArchitecture() {
      document.querySelector('.loading').style.display = 'block';
      document.querySelector('.loading').textContent = '加载架构图...';

      try {
        const response = await fetch('/api/architecture');
        archData = await response.json();

        if (archData.error) {
          throw new Error(archData.error);
        }

        document.querySelector('.loading').style.display = 'none';
        drawArchitecture(archData);
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 绘制架构图（从上到下）
    function drawArchitecture(data) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 添加箭头标记
      svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#4ecdc4');

      // 显示项目信息
      document.getElementById('project-name').textContent = data.projectName;
      document.getElementById('project-desc').textContent = data.projectDescription;
      document.getElementById('project-header').classList.add('active');
      document.getElementById('arch-legend').classList.add('active');

      // 布局参数
      const blockWidth = 200;
      const blockHeight = 70;
      const gapX = 50;
      const gapY = 40;
      const startY = 80;

      // 按类型分层
      const layers = {
        entry: [],
        core: [],
        feature: [],
        ui: [],
        data: [],
        config: [],
        util: []
      };

      data.blocks.forEach(block => {
        if (layers[block.type]) {
          layers[block.type].push(block);
        } else {
          layers.util.push(block);
        }
      });

      // 计算每层位置
      const blockPositions = new Map();
      let currentY = startY;

      const layerOrder = ['entry', 'core', 'feature', 'ui', 'data', 'config', 'util'];

      layerOrder.forEach(layerType => {
        const blocks = layers[layerType];
        if (blocks.length === 0) return;

        const totalWidth = blocks.length * blockWidth + (blocks.length - 1) * gapX;
        let startX = (width - totalWidth) / 2;

        blocks.forEach((block, i) => {
          const x = startX + i * (blockWidth + gapX);
          const y = currentY;
          blockPositions.set(block.id, { x, y, block });
        });

        currentY += blockHeight + gapY;
      });

      // 绘制依赖连线
      const links = g.append('g');

      data.blocks.forEach(block => {
        const sourcePos = blockPositions.get(block.id);
        if (!sourcePos) return;

        block.dependencies.forEach(depId => {
          const targetPos = blockPositions.get(depId);
          if (!targetPos) return;

          // 计算连线点
          const sx = sourcePos.x + blockWidth / 2;
          const sy = sourcePos.y + blockHeight;
          const tx = targetPos.x + blockWidth / 2;
          const ty = targetPos.y;

          // 绘制曲线
          const path = d3.path();
          path.moveTo(sx, sy);
          const midY = (sy + ty) / 2;
          path.bezierCurveTo(sx, midY, tx, midY, tx, ty);

          links.append('path')
            .attr('class', 'arch-link')
            .attr('d', path.toString());
        });
      });

      // 绘制逻辑块
      const nodes = g.append('g')
        .selectAll('g')
        .data(Array.from(blockPositions.values()))
        .join('g')
        .attr('class', d => 'arch-block type-' + d.block.type)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      // 块背景
      nodes.append('rect')
        .attr('width', blockWidth)
        .attr('height', blockHeight);

      // 块标题
      nodes.append('text')
        .attr('class', 'block-title')
        .attr('x', blockWidth / 2)
        .attr('y', 22)
        .attr('text-anchor', 'middle')
        .text(d => d.block.name);

      // 块描述
      nodes.append('text')
        .attr('class', 'block-desc')
        .attr('x', blockWidth / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .text(d => {
          const desc = d.block.description;
          return desc.length > 25 ? desc.slice(0, 25) + '...' : desc;
        });

      // 文件数信息
      nodes.append('text')
        .attr('class', 'block-info')
        .attr('x', blockWidth / 2)
        .attr('y', 58)
        .attr('text-anchor', 'middle')
        .text(d => d.block.fileCount + ' 文件 · ' + d.block.totalLines.toLocaleString() + ' 行');

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showBlockDetails(d.block);
      });

      // 双击下钻到文件列表
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        drillIntoBlock(d.block);
      });

      // 初始缩放适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * width / bounds.width,
          0.85 * height / bounds.height,
          1.2
        );
        const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const ty = 30;

        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示逻辑块详情
    function showBlockDetails(block) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">模块:</span> <span class="info-value">' + block.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + block.type + '</span></div>';
      html += '<div class="info-item"><span class="info-label">文件数:</span> <span class="info-value">' + block.fileCount + '</span></div>';
      html += '<div class="info-item"><span class="info-label">代码行:</span> <span class="info-value">' + block.totalLines.toLocaleString() + '</span></div>';
      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item"><span class="info-label">描述:</span></div>';
      html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + block.description + '</div>';

      if (block.files.length > 0) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">包含文件:</span></div>';
        block.files.slice(0, 15).forEach(f => {
          html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem; cursor:pointer;" onclick="showModuleDetails(\\'' + f + '\\')">' + f + '</div>';
        });
        if (block.files.length > 15) {
          html += '<div class="info-item" style="color: #888; font-size: 0.75rem;">... 还有 ' + (block.files.length - 15) + ' 个文件</div>';
        }
      }

      document.getElementById('node-details').innerHTML = html;
    }

    // 下钻到逻辑块 - 显示文件列表
    function drillIntoBlock(block) {
      drillStack.push({ type: 'block', name: block.name, data: block });
      currentDrillLevel = 'block';
      updateBreadcrumb();
      renderBlockFiles(block);
    }

    // 渲染逻辑块内的文件列表
    async function renderBlockFiles(block) {
      hideAllIndicators();
      document.getElementById('symbol-legend').classList.add('active');

      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 获取文件详情
      const fileDetails = [];
      for (const fileId of block.files) {
        try {
          const response = await fetch('/api/module-detail/' + encodeURIComponent(fileId));
          if (response.ok) {
            const detail = await response.json();
            fileDetails.push(detail);
          }
        } catch (e) {
          console.error('Failed to load file:', fileId, e);
        }
      }

      // 布局参数
      const nodeWidth = 220;
      const nodeHeight = 50;
      const gapX = 30;
      const gapY = 20;
      const cols = Math.ceil(Math.sqrt(fileDetails.length));

      // 计算位置
      const filePositions = fileDetails.map((file, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return {
          x: col * (nodeWidth + gapX) + 50,
          y: row * (nodeHeight + gapY) + 50,
          file
        };
      });

      // 绘制文件节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(filePositions)
        .join('g')
        .attr('class', 'file-node')
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      nodes.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight);

      // 文件名
      nodes.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .text(d => d.file.name.length > 25 ? d.file.name.slice(0, 25) + '...' : d.file.name);

      // 符号统计
      nodes.append('text')
        .attr('class', 'file-desc')
        .attr('x', 10)
        .attr('y', 38)
        .text(d => {
          const s = d.file.symbols;
          const counts = [];
          if (s.classes.length) counts.push(s.classes.length + ' 类');
          if (s.functions.length) counts.push(s.functions.length + ' 函数');
          if (s.interfaces.length) counts.push(s.interfaces.length + ' 接口');
          return counts.join(' · ') || d.file.lines + ' 行';
        });

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showFileDetails(d.file);
      });

      // 双击下钻到符号
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        drillIntoFile(d.file);
      });

      // 适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * (width - 100) / bounds.width,
          0.85 * height / bounds.height,
          1.5
        );
        const tx = (width - bounds.width * scale) / 2;
        const ty = 30;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示文件详情
    function showFileDetails(file) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">文件:</span> <span class="info-value">' + file.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">路径:</span> <span class="info-value" style="font-size:0.75rem">' + file.id + '</span></div>';
      html += '<div class="info-item"><span class="info-label">语言:</span> <span class="info-value">' + file.language + '</span></div>';
      html += '<div class="info-item"><span class="info-label">行数:</span> <span class="info-value">' + file.lines + '</span></div>';

      if (file.semantic) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">描述:</span></div>';
        html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (file.semantic.description || 'N/A') + '</div>';
      }

      // 符号摘要
      const s = file.symbols;
      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item"><span class="info-label">符号统计:</span></div>';
      if (s.classes.length) html += '<div class="info-item" style="font-size:0.8rem">类: ' + s.classes.length + '</div>';
      if (s.interfaces.length) html += '<div class="info-item" style="font-size:0.8rem">接口: ' + s.interfaces.length + '</div>';
      if (s.functions.length) html += '<div class="info-item" style="font-size:0.8rem">函数: ' + s.functions.length + '</div>';
      if (s.types.length) html += '<div class="info-item" style="font-size:0.8rem">类型: ' + s.types.length + '</div>';
      if (s.constants.length) html += '<div class="info-item" style="font-size:0.8rem">常量: ' + s.constants.length + '</div>';

      // 依赖
      if (file.internalImports.length > 0) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">内部依赖:</span></div>';
        file.internalImports.slice(0, 10).forEach(imp => {
          html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem;">' + imp + '</div>';
        });
      }

      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item" style="color:#e94560;cursor:pointer" onclick="drillIntoFile(window._currentFile)">双击查看符号 →</div>';

      window._currentFile = file;
      document.getElementById('node-details').innerHTML = html;
    }

    // 下钻到文件 - 显示符号列表
    function drillIntoFile(file) {
      drillStack.push({ type: 'file', name: file.name, data: file });
      currentDrillLevel = 'file';
      updateBreadcrumb();
      renderFileSymbols(file);
    }

    // 渲染文件内的符号
    function renderFileSymbols(file) {
      hideAllIndicators();
      document.getElementById('symbol-legend').classList.add('active');

      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 收集所有符号
      const allSymbols = [];
      const s = file.symbols;

      // 按类型顺序添加
      s.classes.forEach(sym => allSymbols.push({ ...sym, groupKind: 'class' }));
      s.interfaces.forEach(sym => allSymbols.push({ ...sym, groupKind: 'interface' }));
      s.functions.forEach(sym => allSymbols.push({ ...sym, groupKind: 'function' }));
      s.types.forEach(sym => allSymbols.push({ ...sym, groupKind: 'type' }));
      s.constants.forEach(sym => allSymbols.push({ ...sym, groupKind: 'constant' }));
      s.variables.forEach(sym => allSymbols.push({ ...sym, groupKind: 'variable' }));
      // re-export 的符号
      if (s.exports) {
        s.exports.forEach(sym => allSymbols.push({ ...sym, groupKind: 'export' }));
      }

      // 按行号排序
      allSymbols.sort((a, b) => a.location.startLine - b.location.startLine);

      // 布局参数
      const nodeWidth = 250;
      const nodeHeight = 45;
      const gapY = 15;
      const childIndent = 30;

      // 计算位置（树形布局）
      let currentY = 50;
      const symbolPositions = [];

      function addSymbol(sym, depth = 0) {
        const x = 50 + depth * childIndent;
        symbolPositions.push({
          x,
          y: currentY,
          symbol: sym,
          depth
        });
        currentY += nodeHeight + gapY;

        // 添加子符号（如类的方法）
        if (sym.children && sym.children.length > 0) {
          sym.children.forEach(child => addSymbol(child, depth + 1));
        }
      }

      allSymbols.forEach(sym => addSymbol(sym, 0));

      // 绘制符号节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(symbolPositions)
        .join('g')
        .attr('class', d => 'symbol-node kind-' + d.symbol.kind)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      nodes.append('rect')
        .attr('width', d => nodeWidth - d.depth * childIndent)
        .attr('height', nodeHeight);

      // 符号名
      nodes.append('text')
        .attr('x', 10)
        .attr('y', 18)
        .text(d => {
          const name = d.symbol.name;
          return name.length > 30 ? name.slice(0, 30) + '...' : name;
        });

      // 签名或类型
      nodes.append('text')
        .attr('class', 'symbol-sig')
        .attr('x', 10)
        .attr('y', 34)
        .text(d => {
          if (d.symbol.signature) {
            const sig = d.symbol.signature;
            return sig.length > 35 ? sig.slice(0, 35) + '...' : sig;
          }
          return 'L' + d.symbol.location.startLine + '-' + d.symbol.location.endLine;
        });

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showSymbolDetails(d.symbol, file.id);
      });

      // 双击查看引用
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        showSymbolRefs(d.symbol);
      });

      // 适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * (width - 100) / bounds.width,
          0.85 * (height - 50) / bounds.height,
          1.2
        );
        const tx = 30;
        const ty = 20;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示符号详情
    async function showSymbolDetails(symbol, moduleId) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + symbol.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + symbol.kind + '</span></div>';
      html += '<div class="info-item"><span class="info-label">位置:</span> <span class="info-value">L' + symbol.location.startLine + '-' + symbol.location.endLine + '</span></div>';

      if (symbol.signature) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">签名:</span></div>';
        html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem; word-break: break-all;">' + symbol.signature + '</div>';
      }

      if (symbol.semantic) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">描述:</span></div>';
        html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (symbol.semantic.description || 'N/A') + '</div>';
      }

      // 加载引用关系
      try {
        const response = await fetch('/api/symbol-refs/' + encodeURIComponent(symbol.id));
        if (response.ok) {
          const refs = await response.json();

          if (refs.calledBy.length > 0) {
            html += '<div class="refs-section"><h3>被调用 (' + refs.calledBy.length + ')</h3>';
            refs.calledBy.slice(0, 8).forEach(ref => {
              html += '<div class="ref-item" onclick="navigateToSymbol(\\'' + ref.symbolId + '\\')">' +
                ref.symbolName + ' <span class="ref-type">' + ref.callType + '</span></div>';
            });
            html += '</div>';
          }

          if (refs.calls.length > 0) {
            html += '<div class="refs-section"><h3>调用了 (' + refs.calls.length + ')</h3>';
            refs.calls.slice(0, 8).forEach(ref => {
              html += '<div class="ref-item" onclick="navigateToSymbol(\\'' + ref.symbolId + '\\')">' +
                ref.symbolName + ' <span class="ref-type">' + ref.callType + '</span></div>';
            });
            html += '</div>';
          }

          if (refs.typeRefs.length > 0) {
            html += '<div class="refs-section"><h3>类型关系</h3>';
            refs.typeRefs.forEach(ref => {
              const dir = ref.direction === 'parent' ? '继承自' : '被继承';
              html += '<div class="ref-item">' + dir + ': ' + ref.relatedSymbolName + '</div>';
            });
            html += '</div>';
          }
        }
      } catch (e) {
        console.error('Failed to load symbol refs:', e);
      }

      document.getElementById('node-details').innerHTML = html;
    }

    // 显示符号引用图
    async function showSymbolRefs(symbol) {
      try {
        const response = await fetch('/api/symbol-refs/' + encodeURIComponent(symbol.id));
        if (!response.ok) return;

        const refs = await response.json();

        // 如果有引用关系，绘制引用图
        if (refs.calledBy.length > 0 || refs.calls.length > 0) {
          drawSymbolRefGraph(symbol, refs);
        } else {
          alert('该符号没有引用关系');
        }
      } catch (e) {
        console.error('Failed to show symbol refs:', e);
      }
    }

    // 绘制符号引用关系图
    function drawSymbolRefGraph(centerSymbol, refs) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg.selectAll('*').remove();
      g = svg.append('g');

      const centerX = width / 2;
      const centerY = height / 2;

      // 中心节点
      const centerNode = g.append('g')
        .attr('class', 'symbol-node kind-' + centerSymbol.kind)
        .attr('transform', 'translate(' + (centerX - 75) + ',' + (centerY - 20) + ')');

      centerNode.append('rect')
        .attr('width', 150)
        .attr('height', 40);

      centerNode.append('text')
        .attr('x', 75)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .text(centerSymbol.name);

      // 被调用者（上方）
      const calledByNodes = refs.calledBy.slice(0, 8);
      const calledBySpacing = Math.min(180, (width - 100) / Math.max(calledByNodes.length, 1));

      calledByNodes.forEach((ref, i) => {
        const x = centerX - (calledByNodes.length - 1) * calledBySpacing / 2 + i * calledBySpacing - 60;
        const y = centerY - 150;

        // 连线
        g.append('path')
          .attr('class', 'ref-link called-by')
          .attr('d', 'M' + (x + 60) + ',' + (y + 40) + ' Q' + (x + 60) + ',' + (centerY - 50) + ' ' + centerX + ',' + (centerY - 20))
          .attr('marker-end', 'url(#arrow-down)');

        // 节点
        const node = g.append('g')
          .attr('class', 'symbol-node kind-function')
          .attr('transform', 'translate(' + x + ',' + y + ')');

        node.append('rect')
          .attr('width', 120)
          .attr('height', 40);

        node.append('text')
          .attr('x', 60)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .text(ref.symbolName.length > 15 ? ref.symbolName.slice(0, 15) + '...' : ref.symbolName);
      });

      // 调用者（下方）
      const callsNodes = refs.calls.slice(0, 8);
      const callsSpacing = Math.min(180, (width - 100) / Math.max(callsNodes.length, 1));

      callsNodes.forEach((ref, i) => {
        const x = centerX - (callsNodes.length - 1) * callsSpacing / 2 + i * callsSpacing - 60;
        const y = centerY + 120;

        // 连线
        g.append('path')
          .attr('class', 'ref-link calls')
          .attr('d', 'M' + centerX + ',' + (centerY + 20) + ' Q' + centerX + ',' + (centerY + 60) + ' ' + (x + 60) + ',' + y)
          .attr('marker-end', 'url(#arrow-down)');

        // 节点
        const node = g.append('g')
          .attr('class', 'symbol-node kind-function')
          .attr('transform', 'translate(' + x + ',' + y + ')');

        node.append('rect')
          .attr('width', 120)
          .attr('height', 40);

        node.append('text')
          .attr('x', 60)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .text(ref.symbolName.length > 15 ? ref.symbolName.slice(0, 15) + '...' : ref.symbolName);
      });

      // 添加箭头
      svg.append('defs').append('marker')
        .attr('id', 'arrow-down')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#e94560');

      // 添加说明
      g.append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', '#888')
        .attr('font-size', '12px')
        .text('↑ 被以下函数调用');

      g.append('text')
        .attr('x', 20)
        .attr('y', height - 30)
        .attr('fill', '#888')
        .attr('font-size', '12px')
        .text('↓ 调用了以下函数');
    }

    // 导航到符号
    function navigateToSymbol(symbolId) {
      // TODO: 实现跨文件符号导航
      console.log('Navigate to symbol:', symbolId);
    }

    // 渲染入口树（从上到下）
    async function renderEntryTree() {
      const entryId = document.getElementById('entry-point').value;
      const maxDepth = parseInt(document.getElementById('max-depth').value, 10);

      if (!entryId) {
        alert('请先选择入口点');
        return;
      }

      document.querySelector('.loading').style.display = 'block';
      document.querySelector('.loading').textContent = '加载依赖树...';

      try {
        const response = await fetch('/api/dependency-tree?entry=' + encodeURIComponent(entryId) + '&depth=' + maxDepth);
        const tree = await response.json();

        if (tree.error) {
          throw new Error(tree.error);
        }

        document.querySelector('.loading').style.display = 'none';
        drawTree(tree);
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 绘制树形图
    function drawTree(treeData) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 创建层次结构
      const root = d3.hierarchy(treeData);

      // 计算节点数量来调整布局
      const nodeCount = root.descendants().length;
      const dynamicHeight = Math.max(height - 100, nodeCount * 25);

      // 使用树形布局
      const treeLayout = d3.tree()
        .size([dynamicHeight, width - 300])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

      treeLayout(root);

      // 绘制连线
      const links = g.append('g')
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('class', 'tree-link')
        .attr('d', d3.linkHorizontal()
          .x(d => d.y + 100)
          .y(d => d.x + 50));

      // 绘制节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('class', d => {
          let cls = 'tree-node depth-' + Math.min(d.depth, 3);
          if (d.data.isCircular) cls += ' circular';
          return cls;
        })
        .attr('transform', d => 'translate(' + (d.y + 100) + ',' + (d.x + 50) + ')');

      // 节点背景
      nodes.append('rect')
        .attr('x', -60)
        .attr('y', -10)
        .attr('width', 120)
        .attr('height', 20);

      // 节点文字
      nodes.append('text')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .text(d => {
          let name = d.data.name;
          if (d.data.isCircular) name = '↻ ' + name;
          return name.length > 15 ? name.slice(0, 15) + '...' : name;
        });

      // 点击事件
      nodes.on('click', (event, d) => {
        showModuleDetails(d.data.id);
      });

      // 初始缩放以适应视口
      const bounds = g.node().getBBox();
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const midX = bounds.x + fullWidth / 2;
      const midY = bounds.y + fullHeight / 2;

      const scale = 0.8 / Math.max(fullWidth / width, fullHeight / height);
      const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );

      // 显示深度指示器
      document.getElementById('depth-indicator').classList.add('active');
    }

    // 显示模块详情
    function showModuleDetails(moduleId) {
      const module = ontology.modules.find(m => m.id === moduleId);
      if (!module) return;

      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      const items = [
        '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + module.name + '</span></div>',
        '<div class="info-item"><span class="info-label">路径:</span> <span class="info-value">' + module.id + '</span></div>',
        '<div class="info-item"><span class="info-label">语言:</span> <span class="info-value">' + module.language + '</span></div>',
        '<div class="info-item"><span class="info-label">行数:</span> <span class="info-value">' + module.lines + '</span></div>',
      ];

      if (module.classes) {
        items.push('<div class="info-item"><span class="info-label">类:</span> <span class="info-value">' + module.classes.length + '</span></div>');
      }
      if (module.functions) {
        items.push('<div class="info-item"><span class="info-label">函数:</span> <span class="info-value">' + module.functions.length + '</span></div>');
      }
      if (module.imports) {
        items.push('<div class="info-item"><span class="info-label">导入:</span> <span class="info-value">' + module.imports.length + '</span></div>');
      }

      if (module.semantic) {
        items.push('<hr style="border-color: #0f3460; margin: 0.5rem 0;">');
        items.push('<div class="info-item"><span class="info-label">描述:</span></div>');
        items.push('<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (module.semantic.description || 'N/A') + '</div>');
        if (module.semantic.architectureLayer) {
          items.push('<div class="info-item"><span class="info-label">架构层:</span> <span class="info-value">' + module.semantic.architectureLayer + '</span></div>');
        }
        if (module.semantic.tags && module.semantic.tags.length > 0) {
          items.push('<div class="info-item"><span class="info-label">标签:</span> <span class="info-value">' + module.semantic.tags.join(', ') + '</span></div>');
        }
      }

      document.getElementById('node-details').innerHTML = items.join('');
    }

    // 搜索功能
    let searchTimeout;
    document.getElementById('search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        document.getElementById('search-results').classList.remove('active');
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/search?q=' + encodeURIComponent(query));
          const results = await response.json();

          const html = results.map(r =>
            '<div class="search-result-item" data-id="' + r.id + '" data-type="' + r.type + '">' +
            '<span class="search-result-type ' + r.type + '">' + r.type + '</span>' +
            r.name +
            '</div>'
          ).join('');

          const resultsEl = document.getElementById('search-results');
          resultsEl.innerHTML = html || '<div class="search-result-item">无结果</div>';
          resultsEl.classList.add('active');

          resultsEl.querySelectorAll('.search-result-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              if (item.dataset.type === 'module') {
                showModuleDetails(item.dataset.id);
              }
              resultsEl.classList.remove('active');
              document.getElementById('search').value = '';
            });
          });
        } catch (error) {
          console.error('Search error:', error);
        }
      }, 300);
    });

    // 点击其他地方关闭搜索结果
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#search-results') && !e.target.closest('.search-box')) {
        document.getElementById('search-results').classList.remove('active');
      }
    });

    // 隐藏所有视图指示器
    function hideAllIndicators() {
      document.getElementById('entry-selector').classList.remove('active');
      document.getElementById('depth-indicator').classList.remove('active');
      document.getElementById('arch-legend').classList.remove('active');
      document.getElementById('project-header').classList.remove('active');
      document.getElementById('symbol-legend').classList.remove('active');
    }

    // 返回按钮事件
    document.getElementById('back-btn').addEventListener('click', goBack);

    // 视图切换
    document.getElementById('view-mode').addEventListener('change', (e) => {
      currentView = e.target.value;
      hideAllIndicators();

      // 清除下钻状态
      drillStack = [];
      currentDrillLevel = null;
      updateBreadcrumb();

      if (simulation) simulation.stop();

      if (currentView === 'architecture') {
        if (ontology.isEnhanced) {
          renderArchitecture();
        } else {
          alert('架构图需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'entry-tree') {
        document.getElementById('entry-selector').classList.add('active');
        if (entryPoints.length > 0) {
          renderEntryTree();
        }
      } else {
        renderGraph();
      }
    });

    // 入口点或深度变化时重新渲染
    document.getElementById('entry-point').addEventListener('change', () => {
      if (currentView === 'entry-tree') {
        renderEntryTree();
      }
    });
    document.getElementById('max-depth').addEventListener('change', () => {
      if (currentView === 'entry-tree') {
        renderEntryTree();
      }
    });

    // 缩放控制
    document.getElementById('zoom-in').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 1.3);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 0.7);
    });

    document.getElementById('reset').addEventListener('click', () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
    });

    // 初始化
    loadOntology();
  </script>
</body>
</html>`;
  }
}

/**
 * 便捷函数：创建服务器
 */
export function createServer(
  ontologyPath: string,
  port: number = 3030
): VisualizationServer {
  return new VisualizationServer(ontologyPath, port);
}
