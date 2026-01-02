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

// ============================================================================
// 流程图数据结构
// ============================================================================

interface FlowchartNode {
  id: string;
  label: string;
  type: 'entry' | 'process' | 'decision' | 'data' | 'end' | 'subprocess';
  description?: string;
  moduleId?: string;
  symbolId?: string;
  layer?: string;
  x?: number;
  y?: number;
}

interface FlowchartEdge {
  source: string;
  target: string;
  label?: string;
  type: 'normal' | 'conditional' | 'loop' | 'async';
}

interface Flowchart {
  title: string;
  description: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  scenario: string;
  entryPoint?: string;
}

interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  entryPoints: string[];
  keywords: string[];
}

/**
 * 检测可用的业务场景
 */
function detectScenarios(blueprint: EnhancedCodeBlueprint): ScenarioInfo[] {
  const scenarios: ScenarioInfo[] = [];
  const modules = Object.values(blueprint.modules);
  const symbols = Object.values(blueprint.symbols);

  // 预定义的场景模式
  const scenarioPatterns: Array<{
    id: string;
    name: string;
    description: string;
    modulePatterns: RegExp[];
    symbolPatterns: RegExp[];
    keywords: string[];
  }> = [
    {
      id: 'cli-input',
      name: 'CLI 命令处理',
      description: '用户输入命令 → 解析参数 → 执行处理 → 返回结果',
      modulePatterns: [/cli/, /command/, /parser/],
      symbolPatterns: [/parse|execute|run|handle/i],
      keywords: ['cli', 'command', 'argument', 'parse'],
    },
    {
      id: 'api-request',
      name: 'API 请求流程',
      description: '接收请求 → 验证参数 → 调用服务 → 返回响应',
      modulePatterns: [/api|client|request|fetch/],
      symbolPatterns: [/request|fetch|send|call/i],
      keywords: ['api', 'request', 'response', 'http'],
    },
    {
      id: 'message-flow',
      name: '消息处理流程',
      description: '接收消息 → 解析内容 → 处理逻辑 → 生成响应',
      modulePatterns: [/message|conversation|chat|loop/],
      symbolPatterns: [/send|receive|process|handle.*message/i],
      keywords: ['message', 'conversation', 'chat', 'response'],
    },
    {
      id: 'tool-execution',
      name: '工具执行流程',
      description: '接收工具调用 → 验证参数 → 执行工具 → 返回结果',
      modulePatterns: [/tool|executor|handler/],
      symbolPatterns: [/execute|run|invoke|call.*tool/i],
      keywords: ['tool', 'execute', 'invoke', 'result'],
    },
    {
      id: 'session-management',
      name: '会话管理流程',
      description: '创建会话 → 保存状态 → 恢复会话 → 清理资源',
      modulePatterns: [/session|state|store|persistence/],
      symbolPatterns: [/create|save|load|restore|clear/i],
      keywords: ['session', 'state', 'persistence', 'storage'],
    },
    {
      id: 'config-load',
      name: '配置加载流程',
      description: '读取配置 → 验证格式 → 合并默认值 → 应用配置',
      modulePatterns: [/config|settings|env/],
      symbolPatterns: [/load|read|parse|merge.*config/i],
      keywords: ['config', 'settings', 'environment', 'options'],
    },
    {
      id: 'plugin-lifecycle',
      name: '插件生命周期',
      description: '发现插件 → 加载插件 → 初始化 → 调用钩子',
      modulePatterns: [/plugin|hook|extension/],
      symbolPatterns: [/register|init|load|unload|hook/i],
      keywords: ['plugin', 'hook', 'extension', 'lifecycle'],
    },
    {
      id: 'file-operation',
      name: '文件操作流程',
      description: '读取文件 → 处理内容 → 写入文件 → 验证结果',
      modulePatterns: [/file|fs|io|read|write/],
      symbolPatterns: [/read|write|edit|delete.*file/i],
      keywords: ['file', 'read', 'write', 'edit', 'path'],
    },
  ];

  // 检测每个场景是否存在
  for (const pattern of scenarioPatterns) {
    const matchedModules: string[] = [];
    const matchedSymbols: string[] = [];

    // 检查模块匹配
    for (const mod of modules) {
      for (const regex of pattern.modulePatterns) {
        if (regex.test(mod.id) || regex.test(mod.name)) {
          matchedModules.push(mod.id);
          break;
        }
      }
    }

    // 检查符号匹配
    for (const sym of symbols) {
      for (const regex of pattern.symbolPatterns) {
        if (regex.test(sym.name)) {
          matchedSymbols.push(sym.id);
          break;
        }
      }
    }

    // 如果匹配的模块足够多，添加场景
    if (matchedModules.length >= 2 || matchedSymbols.length >= 3) {
      // 找到最可能的入口点
      const entryPoints = findScenarioEntryPoints(blueprint, matchedModules, pattern.keywords);

      scenarios.push({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        entryPoints: entryPoints.slice(0, 3),
        keywords: pattern.keywords,
      });
    }
  }

  // 如果没有检测到特定场景，添加默认场景
  if (scenarios.length === 0) {
    const defaultEntries = detectEntryPoints(blueprint);
    scenarios.push({
      id: 'default',
      name: '项目入口流程',
      description: '从主入口开始的代码执行流程',
      entryPoints: defaultEntries,
      keywords: ['entry', 'main', 'index'],
    });
  }

  return scenarios;
}

/**
 * 查找场景的入口点
 */
function findScenarioEntryPoints(
  blueprint: EnhancedCodeBlueprint,
  candidateModules: string[],
  keywords: string[]
): string[] {
  const scored: Array<{ id: string; score: number }> = [];

  // 计算被导入次数
  const importCounts = new Map<string, number>();
  for (const dep of blueprint.references.moduleDeps) {
    const count = importCounts.get(dep.target) || 0;
    importCounts.set(dep.target, count + 1);
  }

  for (const modId of candidateModules) {
    let score = 0;
    const mod = blueprint.modules[modId];
    if (!mod) continue;

    // 关键词匹配加分
    for (const keyword of keywords) {
      if (mod.id.toLowerCase().includes(keyword) || mod.name.toLowerCase().includes(keyword)) {
        score += 5;
      }
      if (mod.semantic?.description?.toLowerCase().includes(keyword)) {
        score += 3;
      }
    }

    // 不被导入的模块更可能是入口
    const importCount = importCounts.get(modId) || 0;
    if (importCount === 0) {
      score += 10;
    }

    // 导出符号多的模块更可能是核心模块
    score += Math.min(mod.exports.length, 5);

    if (score > 0) {
      scored.push({ id: modId, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.id);
}

/**
 * 构建流程图
 */
function buildFlowchart(
  blueprint: EnhancedCodeBlueprint,
  entryId: string,
  scenario: string,
  maxDepth: number
): Flowchart {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  const nodeMap = new Map<string, FlowchartNode>();
  const visited = new Set<string>();

  // 如果没有指定入口，尝试自动检测
  let actualEntryId = entryId;
  if (!actualEntryId) {
    const entries = detectEntryPoints(blueprint);
    actualEntryId = entries[0] || Object.keys(blueprint.modules)[0];
  }

  const entryModule = blueprint.modules[actualEntryId];
  if (!entryModule) {
    return {
      title: '流程图',
      description: '无法找到入口模块',
      nodes: [],
      edges: [],
      scenario,
      entryPoint: actualEntryId,
    };
  }

  // 构建模块依赖图
  const depsBySource = new Map<string, ModuleDependency[]>();
  for (const dep of blueprint.references.moduleDeps) {
    const deps = depsBySource.get(dep.source) || [];
    deps.push(dep);
    depsBySource.set(dep.source, deps);
  }

  // 构建符号调用图
  const callsByCaller = new Map<string, SymbolCall[]>();
  for (const call of blueprint.references.symbolCalls) {
    const calls = callsByCaller.get(call.caller) || [];
    calls.push(call);
    callsByCaller.set(call.caller, calls);
  }

  // 确定节点类型
  function getNodeType(mod: EnhancedModule): FlowchartNode['type'] {
    const layer = mod.semantic?.architectureLayer;
    if (layer === 'presentation') return 'data';
    if (layer === 'data') return 'data';
    if (mod.id.includes('config') || mod.id.includes('settings')) return 'data';
    if (mod.exports.length > 5) return 'subprocess';
    return 'process';
  }

  // 递归构建流程图
  function buildFromModule(moduleId: string, depth: number, parentNodeId?: string) {
    if (depth > maxDepth || visited.has(moduleId)) {
      // 如果已访问过，只添加边，不添加新节点
      if (visited.has(moduleId) && parentNodeId) {
        const existingNode = nodeMap.get(moduleId);
        if (existingNode) {
          edges.push({
            source: parentNodeId,
            target: existingNode.id,
            type: 'loop',
            label: '循环引用',
          });
        }
      }
      return;
    }

    const mod = blueprint.modules[moduleId];
    if (!mod) return;

    visited.add(moduleId);

    // 创建模块节点
    const nodeId = `mod_${moduleId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const node: FlowchartNode = {
      id: nodeId,
      label: mod.name.replace(/\.(ts|js|tsx|jsx)$/, ''),
      type: depth === 0 ? 'entry' : getNodeType(mod),
      description: mod.semantic?.description || `${mod.name} (${mod.lines} 行)`,
      moduleId: moduleId,
      layer: mod.semantic?.architectureLayer || 'unknown',
    };

    nodes.push(node);
    nodeMap.set(moduleId, node);

    // 添加从父节点到当前节点的边
    if (parentNodeId) {
      edges.push({
        source: parentNodeId,
        target: nodeId,
        type: 'normal',
      });
    }

    // 获取该模块导出的主要函数
    const moduleSymbols = Object.values(blueprint.symbols)
      .filter(s => s.moduleId === moduleId && (s.kind === 'function' || s.kind === 'class'))
      .slice(0, 3); // 限制每个模块最多显示3个关键符号

    // 为重要符号创建子节点
    for (const sym of moduleSymbols) {
      const symNodeId = `sym_${sym.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const symNode: FlowchartNode = {
        id: symNodeId,
        label: sym.name,
        type: sym.kind === 'class' ? 'subprocess' : 'process',
        description: sym.semantic?.description || sym.signature || sym.name,
        moduleId: moduleId,
        symbolId: sym.id,
      };

      // 只有当符号被其他模块调用时才显示
      const calls = blueprint.references.symbolCalls.filter(c => c.callee === sym.id);
      if (calls.length > 0 || depth === 0) {
        nodes.push(symNode);
        nodeMap.set(sym.id, symNode);

        edges.push({
          source: nodeId,
          target: symNodeId,
          type: 'normal',
          label: sym.kind,
        });
      }
    }

    // 递归处理依赖的模块
    const deps = depsBySource.get(moduleId) || [];

    // 按重要性排序依赖
    const sortedDeps = deps
      .filter(d => blueprint.modules[d.target]) // 只处理内部模块
      .sort((a, b) => {
        // 优先显示被多次引用的模块
        return (b.symbols?.length || 0) - (a.symbols?.length || 0);
      })
      .slice(0, 5); // 限制每个模块最多5个依赖

    for (const dep of sortedDeps) {
      buildFromModule(dep.target, depth + 1, nodeId);
    }
  }

  // 从入口开始构建
  buildFromModule(actualEntryId, 0);

  // 添加结束节点（如果图不为空）
  if (nodes.length > 0) {
    const endNode: FlowchartNode = {
      id: 'end_node',
      label: '完成',
      type: 'end',
      description: '流程结束',
    };
    nodes.push(endNode);

    // 找到没有出边的叶子节点，连接到结束节点
    const nodesWithOutEdges = new Set(edges.map(e => e.source));
    const leafNodes = nodes.filter(n => n.id !== 'end_node' && !nodesWithOutEdges.has(n.id));

    for (const leaf of leafNodes.slice(0, 5)) { // 限制连接数
      edges.push({
        source: leaf.id,
        target: 'end_node',
        type: 'normal',
      });
    }
  }

  // 计算节点位置（简单分层布局）
  assignNodePositions(nodes, edges);

  return {
    title: getFlowchartTitle(scenario, entryModule),
    description: entryModule.semantic?.description || `从 ${entryModule.name} 开始的执行流程`,
    nodes,
    edges,
    scenario,
    entryPoint: actualEntryId,
  };
}

/**
 * 获取流程图标题
 */
function getFlowchartTitle(scenario: string, entryModule: EnhancedModule): string {
  const scenarioTitles: Record<string, string> = {
    'cli-input': 'CLI 命令处理流程',
    'api-request': 'API 请求处理流程',
    'message-flow': '消息处理流程',
    'tool-execution': '工具执行流程',
    'session-management': '会话管理流程',
    'config-load': '配置加载流程',
    'plugin-lifecycle': '插件生命周期',
    'file-operation': '文件操作流程',
    'default': '代码执行流程',
  };

  return scenarioTitles[scenario] || `${entryModule.name} 执行流程`;
}

/**
 * 分配节点位置（分层布局）
 */
function assignNodePositions(nodes: FlowchartNode[], edges: FlowchartEdge[]) {
  if (nodes.length === 0) return;

  // 构建邻接表
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const edge of edges) {
    const c = children.get(edge.source) || [];
    c.push(edge.target);
    children.set(edge.source, c);

    const p = parents.get(edge.target) || [];
    p.push(edge.source);
    parents.set(edge.target, p);
  }

  // 找到根节点（没有父节点的节点）
  const roots = nodes.filter(n => !parents.has(n.id) || parents.get(n.id)!.length === 0);

  // BFS 分层
  const layers: string[][] = [];
  const nodeLayer = new Map<string, number>();
  const visited = new Set<string>();

  let currentLayer = roots.map(n => n.id);
  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach((id, idx) => {
      nodeLayer.set(id, layers.length - 1);
      visited.add(id);
    });

    const nextLayer: string[] = [];
    for (const id of currentLayer) {
      const childIds = children.get(id) || [];
      for (const childId of childIds) {
        if (!visited.has(childId) && !nextLayer.includes(childId)) {
          nextLayer.push(childId);
        }
      }
    }
    currentLayer = nextLayer;
  }

  // 分配坐标
  const layerHeight = 120;
  const nodeWidth = 180;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const totalWidth = layer.length * nodeWidth;
    const startX = -totalWidth / 2 + nodeWidth / 2;

    for (let j = 0; j < layer.length; j++) {
      const node = nodes.find(n => n.id === layer[j]);
      if (node) {
        node.x = startX + j * nodeWidth;
        node.y = i * layerHeight;
      }
    }
  }
}

// ============================================================================
// 新手导览数据结构
// ============================================================================

interface BeginnerCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  explain: string;
  analogy: string;
  badge: 'core' | 'tool' | 'util' | 'ui';
  files: string[];
  keyFunctions: Array<{ name: string; desc: string }>;
}

interface BeginnerGuide {
  projectName: string;
  tagline: string;
  summary: string;
  cards: BeginnerCard[];
}

/**
 * 生成新手导览数据 - 将复杂代码简化为易懂的卡片
 */
function generateBeginnerGuide(blueprint: EnhancedCodeBlueprint): BeginnerGuide {
  const modules = Object.values(blueprint.modules);

  // 智能分组：根据目录和功能将模块归类
  const groups = categorizeModules(modules);

  // 为每个分组生成卡片
  const cards: BeginnerCard[] = [];

  for (const [groupId, groupModules] of Object.entries(groups)) {
    const card = generateCard(groupId, groupModules, blueprint);
    if (card) {
      cards.push(card);
    }
  }

  // 按重要性排序（core > tool > util > ui）
  const badgeOrder = { core: 0, tool: 1, util: 2, ui: 3 };
  cards.sort((a, b) => badgeOrder[a.badge] - badgeOrder[b.badge]);

  // 获取项目信息
  const projectInfo = extractProjectInfo(blueprint);

  return {
    projectName: projectInfo.name,
    tagline: projectInfo.tagline,
    summary: projectInfo.summary,
    cards: cards.slice(0, 10), // 最多显示10个卡片
  };
}

/**
 * 将模块按功能分类
 */
function categorizeModules(modules: EnhancedModule[]): Record<string, EnhancedModule[]> {
  const groups: Record<string, EnhancedModule[]> = {};

  // 预定义的分类规则
  const categoryRules: Array<{
    id: string;
    patterns: RegExp[];
    priority: number;
  }> = [
    { id: 'entry', patterns: [/^src\/(cli|index|main|app)\.(ts|js)$/], priority: 0 },
    { id: 'core', patterns: [/core\/|engine\/|\/loop|\/client/], priority: 1 },
    { id: 'tools', patterns: [/tools\/|tool\./], priority: 2 },
    { id: 'ui', patterns: [/ui\/|components\/|\.tsx$/], priority: 3 },
    { id: 'config', patterns: [/config\/|settings|\.config\./], priority: 4 },
    { id: 'auth', patterns: [/auth\/|login|oauth/], priority: 5 },
    { id: 'session', patterns: [/session\/|state\/|store\//], priority: 6 },
    { id: 'mcp', patterns: [/mcp\/|protocol\//], priority: 7 },
    { id: 'git', patterns: [/git\/|vcs\//], priority: 8 },
    { id: 'network', patterns: [/network\/|http|api\/|fetch/], priority: 9 },
    { id: 'parser', patterns: [/parser\/|parse|ast/], priority: 10 },
    { id: 'utils', patterns: [/utils?\/|helpers?\/|lib\//], priority: 11 },
    { id: 'types', patterns: [/types?\/|interfaces?\//], priority: 12 },
    { id: 'tests', patterns: [/tests?\/|\.test\.|\.spec\./], priority: 99 },
  ];

  for (const mod of modules) {
    // 跳过测试文件
    if (/tests?\/|\.test\.|\.spec\./.test(mod.id)) continue;

    let assigned = false;
    for (const rule of categoryRules) {
      if (rule.patterns.some(p => p.test(mod.id))) {
        if (!groups[rule.id]) groups[rule.id] = [];
        groups[rule.id].push(mod);
        assigned = true;
        break;
      }
    }

    // 默认归类到 "other"
    if (!assigned) {
      // 尝试根据目录名归类
      const dirMatch = mod.id.match(/src\/([^/]+)\//);
      if (dirMatch) {
        const dir = dirMatch[1];
        if (!groups[dir]) groups[dir] = [];
        groups[dir].push(mod);
      } else {
        if (!groups['other']) groups['other'] = [];
        groups['other'].push(mod);
      }
    }
  }

  return groups;
}

/**
 * 为一个分组生成卡片
 */
function generateCard(
  groupId: string,
  modules: EnhancedModule[],
  blueprint: EnhancedCodeBlueprint
): BeginnerCard | null {
  if (modules.length === 0) return null;

  // 卡片模板数据
  const cardTemplates: Record<string, {
    icon: string;
    title: string;
    explain: string;
    analogy: string;
    badge: BeginnerCard['badge'];
  }> = {
    entry: {
      icon: '🚀',
      title: '程序入口',
      explain: '这是程序启动的地方。当你运行命令时，代码从这里开始执行，解析参数，然后调用其他模块。',
      analogy: '就像餐厅的前台，接待顾客并引导他们到正确的位置。',
      badge: 'core',
    },
    core: {
      icon: '⚙️',
      title: '核心引擎',
      explain: '这是程序的大脑，负责处理主要逻辑：接收请求、调用AI、管理对话流程。',
      analogy: '就像汽车的发动机，所有动力都从这里产生。',
      badge: 'core',
    },
    tools: {
      icon: '🔧',
      title: '工具箱',
      explain: '这里定义了AI可以使用的各种工具：读写文件、执行命令、搜索代码等。每个工具都是一个独立的能力。',
      analogy: '就像瑞士军刀，每个工具都有特定用途，组合起来功能强大。',
      badge: 'tool',
    },
    ui: {
      icon: '🎨',
      title: '用户界面',
      explain: '负责在终端中显示内容：消息、进度条、代码高亮等。让信息以美观的方式呈现给用户。',
      analogy: '就像商店的橱窗，把商品展示得漂亮吸引人。',
      badge: 'ui',
    },
    config: {
      icon: '⚙️',
      title: '配置管理',
      explain: '管理所有设置：API密钥、用户偏好、环境变量等。程序启动时从这里读取配置。',
      analogy: '就像手机的设置菜单，保存你的个人偏好。',
      badge: 'util',
    },
    auth: {
      icon: '🔐',
      title: '身份认证',
      explain: '处理登录和权限：验证API密钥、OAuth登录、保存凭证。确保只有授权用户能使用。',
      analogy: '就像门卫，检查你的身份证才让你进入。',
      badge: 'core',
    },
    session: {
      icon: '💾',
      title: '会话管理',
      explain: '保存和恢复对话历史：你上次聊到哪里、做了什么改动。下次可以继续之前的工作。',
      analogy: '就像游戏的存档功能，让你随时继续之前的进度。',
      badge: 'core',
    },
    mcp: {
      icon: '🔌',
      title: 'MCP 协议',
      explain: '模型上下文协议，让AI能连接外部服务和工具。类似于插件系统，扩展AI的能力。',
      analogy: '就像USB接口，可以连接各种外部设备。',
      badge: 'tool',
    },
    git: {
      icon: '📦',
      title: 'Git 集成',
      explain: '与Git版本控制集成：读取仓库状态、分析变更、帮助提交代码。',
      analogy: '就像时光机，记录代码的每一次变化，随时可以回到过去。',
      badge: 'tool',
    },
    network: {
      icon: '🌐',
      title: '网络通信',
      explain: '处理所有网络请求：调用API、获取网页、处理代理和超时。',
      analogy: '就像快递员，负责把消息送到正确的地方并带回回复。',
      badge: 'util',
    },
    parser: {
      icon: '📖',
      title: '代码解析',
      explain: '分析代码结构：找出函数、类、变量的定义和引用。让AI能"读懂"代码。',
      analogy: '就像语文老师，分析文章的结构和含义。',
      badge: 'tool',
    },
    utils: {
      icon: '🧰',
      title: '工具函数',
      explain: '各种辅助函数：字符串处理、文件操作、错误处理等。被其他模块广泛使用。',
      analogy: '就像厨房的基础工具，做任何菜都需要用到。',
      badge: 'util',
    },
    types: {
      icon: '📋',
      title: '类型定义',
      explain: 'TypeScript类型和接口定义，描述数据的形状。帮助开发时发现错误。',
      analogy: '就像建筑图纸，规定每个部件应该是什么样子。',
      badge: 'util',
    },
    prompt: {
      icon: '💬',
      title: '提示词管理',
      explain: '构建和管理发送给AI的提示词：系统指令、上下文、用户消息的组装。',
      analogy: '就像写信的格式，决定如何把你的意图清晰地表达给AI。',
      badge: 'core',
    },
    streaming: {
      icon: '📡',
      title: '流式处理',
      explain: '处理AI的流式响应，让回答一个字一个字地显示，而不是等全部完成。',
      analogy: '就像直播和录播的区别，流式让你实时看到AI在"思考"。',
      badge: 'util',
    },
    commands: {
      icon: '⌨️',
      title: '命令系统',
      explain: '定义和处理斜杠命令：/help、/clear、/config等，提供快捷操作。',
      analogy: '就像手机的快捷手势，一个动作完成复杂操作。',
      badge: 'tool',
    },
    hooks: {
      icon: '🪝',
      title: '钩子系统',
      explain: '允许在特定时机执行自定义代码：工具调用前后、消息发送时等。',
      analogy: '就像事件监听器，当某事发生时自动触发你的代码。',
      badge: 'tool',
    },
    agents: {
      icon: '🤖',
      title: '子代理',
      explain: '创建专门的AI子代理来处理特定任务：代码审查、探索、规划等。',
      analogy: '就像派出专门的小助手去完成特定任务，然后汇报结果。',
      badge: 'core',
    },
    sandbox: {
      icon: '🏖️',
      title: '沙箱安全',
      explain: '在安全隔离的环境中执行命令，防止危险操作影响系统。',
      analogy: '就像儿童游乐场，孩子可以自由玩耍但不会受伤。',
      badge: 'util',
    },
    map: {
      icon: '🗺️',
      title: '代码地图',
      explain: '分析代码结构，生成可视化地图。就是你现在看到的这个功能！',
      analogy: '就像城市地图，帮你快速了解整个项目的布局。',
      badge: 'tool',
    },
  };

  // 获取模板或生成默认
  const template = cardTemplates[groupId] || {
    icon: '📁',
    title: groupId.charAt(0).toUpperCase() + groupId.slice(1),
    explain: `包含 ${modules.length} 个相关文件，处理 ${groupId} 相关的功能。`,
    analogy: '这是一个功能模块。',
    badge: 'util' as const,
  };

  // 找出关键函数
  const keyFunctions: Array<{ name: string; desc: string }> = [];
  for (const mod of modules.slice(0, 3)) {
    const symbols = Object.values(blueprint.symbols)
      .filter(s => s.moduleId === mod.id && (s.kind === 'function' || s.kind === 'class'))
      .slice(0, 2);

    for (const sym of symbols) {
      keyFunctions.push({
        name: sym.name,
        desc: sym.semantic?.description || sym.signature || '核心功能',
      });
    }
  }

  // 提取文件名（简化显示）
  const files = modules.slice(0, 5).map(m => {
    const parts = m.id.split('/');
    return parts[parts.length - 1];
  });

  return {
    id: groupId,
    icon: template.icon,
    title: template.title,
    subtitle: `${modules.length} 个文件 · ${modules.reduce((sum, m) => sum + m.lines, 0).toLocaleString()} 行代码`,
    explain: template.explain,
    analogy: template.analogy,
    badge: template.badge,
    files,
    keyFunctions: keyFunctions.slice(0, 4),
  };
}

/**
 * 提取项目信息
 */
function extractProjectInfo(blueprint: EnhancedCodeBlueprint): {
  name: string;
  tagline: string;
  summary: string;
} {
  // 尝试从入口文件获取信息
  const entryModule = blueprint.modules['src/cli.ts'] ||
    blueprint.modules['src/index.ts'] ||
    blueprint.modules['src/main.ts'] ||
    Object.values(blueprint.modules)[0];

  const stats = blueprint.statistics;
  const totalModules = stats.totalModules;
  const totalLines = stats.totalLines || 0;

  // 尝试推断项目类型
  let projectType = 'TypeScript 项目';
  if (blueprint.modules['src/cli.ts']) {
    projectType = '命令行工具';
  } else if (Object.keys(blueprint.modules).some(k => k.includes('server'))) {
    projectType = '服务端应用';
  } else if (Object.keys(blueprint.modules).some(k => k.includes('.tsx'))) {
    projectType = 'React 应用';
  }

  return {
    name: entryModule?.semantic?.description?.split('。')[0] || projectType,
    tagline: `${totalModules} 个模块 · ${totalLines.toLocaleString()} 行代码`,
    summary: entryModule?.semantic?.description ||
      `这是一个 ${projectType}，包含 ${totalModules} 个模块。点击下方卡片了解各个部分的功能。`,
  };
}

// ============================================================================
// 业务故事视图 - 用故事的方式解释代码流程
// ============================================================================

interface StoryStep {
  id: string;
  title: string;           // 步骤标题
  story: string;           // 故事化描述（大白话）
  technical: string;       // 技术描述
  moduleId: string;        // 关联的模块
  symbolId?: string;       // 关联的符号
  codeSnippet?: string;    // 代码片段预览
  lineRange?: { start: number; end: number };
  children?: StoryStep[];  // 子步骤
  nextSteps?: string[];    // 下一步的 ID
}

interface BusinessStory {
  id: string;
  title: string;           // 故事标题，如"用户输入一个命令"
  description: string;     // 故事描述
  icon: string;
  steps: StoryStep[];      // 故事步骤
  keyTakeaways: string[];  // 核心要点
  relatedStories: string[];// 相关故事
}

interface StoryGuide {
  projectName: string;
  projectDescription: string;
  stories: BusinessStory[];
  currentProgress?: {
    storyId: string;
    stepIndex: number;
    completedSteps: string[];
  };
}

/**
 * 生成业务故事导览 - 用讲故事的方式解释代码
 */
function generateStoryGuide(blueprint: EnhancedCodeBlueprint): StoryGuide {
  const stories: BusinessStory[] = [];

  // 检测项目类型并生成对应的故事
  const projectType = detectProjectType(blueprint);

  // 1. CLI 工具的故事
  if (projectType.includes('cli')) {
    stories.push(generateCliStory(blueprint));
  }

  // 2. 对话流程的故事
  if (hasModule(blueprint, /conversation|loop|chat|message/)) {
    stories.push(generateConversationStory(blueprint));
  }

  // 3. 工具执行的故事
  if (hasModule(blueprint, /tools?\//)) {
    stories.push(generateToolStory(blueprint));
  }

  // 4. 配置加载的故事
  if (hasModule(blueprint, /config|settings/)) {
    stories.push(generateConfigStory(blueprint));
  }

  // 5. 会话管理的故事
  if (hasModule(blueprint, /session/)) {
    stories.push(generateSessionStory(blueprint));
  }

  // 确保至少有一个故事
  if (stories.length === 0) {
    stories.push(generateDefaultStory(blueprint));
  }

  return {
    projectName: blueprint.project.name,
    projectDescription: blueprint.project.semantic?.description || '代码项目',
    stories,
  };
}

function detectProjectType(blueprint: EnhancedCodeBlueprint): string[] {
  const types: string[] = [];
  const moduleIds = Object.keys(blueprint.modules);

  if (moduleIds.some(id => /cli|command/.test(id))) types.push('cli');
  if (moduleIds.some(id => /server|api/.test(id))) types.push('server');
  if (moduleIds.some(id => /\.tsx$/.test(id))) types.push('react');
  if (moduleIds.some(id => /conversation|chat/.test(id))) types.push('chat');

  return types.length > 0 ? types : ['generic'];
}

function hasModule(blueprint: EnhancedCodeBlueprint, pattern: RegExp): boolean {
  return Object.keys(blueprint.modules).some(id => pattern.test(id));
}

function generateCliStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const steps: StoryStep[] = [];

  // 1. 找入口文件
  const entryModule = blueprint.modules['src/cli.ts'] ||
    blueprint.modules['src/index.ts'] ||
    Object.values(blueprint.modules).find(m => /cli|index|main/.test(m.id));

  if (entryModule) {
    steps.push({
      id: 'entry',
      title: '程序启动',
      story: '当你在终端输入命令时，操作系统会找到程序入口，开始执行代码。就像打开一扇门，程序从这里"醒来"。',
      technical: `入口文件: ${entryModule.name}，解析命令行参数，初始化必要组件`,
      moduleId: entryModule.id,
      lineRange: { start: 1, end: 50 },
    });
  }

  // 2. 找配置加载
  const configModule = Object.values(blueprint.modules).find(m => /config/.test(m.id));
  if (configModule) {
    steps.push({
      id: 'config',
      title: '读取配置',
      story: '程序需要知道一些设置：你的 API 密钥是什么？用哪个 AI 模型？这些信息从配置文件读取。',
      technical: `配置文件: ${configModule.name}，读取环境变量和配置文件`,
      moduleId: configModule.id,
    });
  }

  // 3. 找核心循环
  const loopModule = Object.values(blueprint.modules).find(m => /loop|conversation|engine/.test(m.id));
  if (loopModule) {
    steps.push({
      id: 'loop',
      title: '进入对话循环',
      story: '一切准备就绪！程序进入"待命"状态，等待你的输入。就像服务员站在那里等你点餐。',
      technical: `核心循环: ${loopModule.name}，管理用户输入和 AI 响应的来回交互`,
      moduleId: loopModule.id,
    });
  }

  return {
    id: 'cli-flow',
    title: '程序是怎么启动的？',
    description: '从你敲下命令到看到提示符，背后发生了什么',
    icon: '🚀',
    steps,
    keyTakeaways: [
      '程序从入口文件开始执行',
      '配置信息决定程序行为',
      '核心循环让程序持续运行',
    ],
    relatedStories: ['conversation-flow', 'tool-execution'],
  };
}

function generateConversationStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const steps: StoryStep[] = [];

  // 1. 用户输入
  const inputModule = Object.values(blueprint.modules).find(m =>
    /input|prompt|ui/.test(m.id) && !m.id.includes('test'));
  if (inputModule) {
    steps.push({
      id: 'user-input',
      title: '你说了一句话',
      story: '你在终端输入一段话，按下回车。这段文字被程序接收，准备发送给 AI。',
      technical: `输入处理: ${inputModule.name}`,
      moduleId: inputModule.id,
    });
  }

  // 2. 发送给 AI
  const clientModule = Object.values(blueprint.modules).find(m =>
    /client|api|anthropic/.test(m.id));
  if (clientModule) {
    steps.push({
      id: 'api-call',
      title: '发送给 AI',
      story: '你的话被打包成请求，通过网络发送给 Claude AI。就像寄一封信，等待回复。',
      technical: `API 调用: ${clientModule.name}，构建请求并发送到 Anthropic API`,
      moduleId: clientModule.id,
    });
  }

  // 3. 处理响应
  const streamModule = Object.values(blueprint.modules).find(m =>
    /stream|response/.test(m.id));
  if (streamModule) {
    steps.push({
      id: 'stream-response',
      title: 'AI 开始回复',
      story: 'AI 的回复是一个字一个字传回来的（流式响应），你会看到文字逐渐出现，就像 AI 在"打字"。',
      technical: `流式处理: ${streamModule.name}，实时处理 SSE 响应`,
      moduleId: streamModule.id,
    });
  }

  // 4. 工具调用
  const toolModule = Object.values(blueprint.modules).find(m =>
    /tools?\//.test(m.id) && m.id.includes('index'));
  if (toolModule) {
    steps.push({
      id: 'tool-call',
      title: 'AI 需要帮手',
      story: 'AI 发现需要读文件或执行命令，它会调用"工具"来完成。就像医生需要护士递工具一样。',
      technical: `工具系统: ${toolModule.name}，注册和执行各种工具`,
      moduleId: toolModule.id,
    });
  }

  return {
    id: 'conversation-flow',
    title: '一次对话是怎么完成的？',
    description: '从你问问题到 AI 回答，中间经历了什么',
    icon: '💬',
    steps,
    keyTakeaways: [
      '输入被发送到云端 AI 服务',
      '响应是流式传回的',
      'AI 可以调用工具完成任务',
    ],
    relatedStories: ['tool-execution', 'cli-flow'],
  };
}

function generateToolStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const steps: StoryStep[] = [];

  // 找所有工具模块
  const toolModules = Object.values(blueprint.modules)
    .filter(m => /tools?\//.test(m.id) && !m.id.includes('test'))
    .slice(0, 5);

  steps.push({
    id: 'tool-registry',
    title: '工具注册表',
    story: '程序启动时，所有可用的工具（读文件、写文件、执行命令等）都在这里登记。AI 需要时就来这里"借"。',
    technical: '工具通过 ToolRegistry 注册，每个工具定义自己的参数和执行逻辑',
    moduleId: toolModules[0]?.id || 'tools',
  });

  for (const tool of toolModules.slice(1)) {
    const name = tool.name.replace(/\.(ts|js)$/, '');
    steps.push({
      id: `tool-${name}`,
      title: `工具: ${name}`,
      story: getToolStory(name),
      technical: tool.semantic?.description || `${name} 工具实现`,
      moduleId: tool.id,
    });
  }

  return {
    id: 'tool-execution',
    title: 'AI 是怎么执行任务的？',
    description: '工具系统让 AI 能读写文件、执行命令、搜索代码',
    icon: '🔧',
    steps,
    keyTakeaways: [
      'AI 本身只能"思考"和"说话"',
      '工具让 AI 能"动手"做事',
      '每个工具有明确的功能边界',
    ],
    relatedStories: ['conversation-flow'],
  };
}

function getToolStory(toolName: string): string {
  const stories: Record<string, string> = {
    bash: '让 AI 能在终端执行命令，就像你自己敲命令一样。但有安全限制，防止危险操作。',
    read: '让 AI 能读取文件内容。告诉它文件路径，它就能看到里面写了什么。',
    write: '让 AI 能创建或覆盖文件。适合生成新代码或配置文件。',
    edit: '让 AI 能修改现有文件的特定部分，精确替换指定内容。',
    glob: '让 AI 能按模式搜索文件，比如"找所有 .ts 文件"。',
    grep: '让 AI 能在文件中搜索内容，找到包含特定文字的位置。',
    webfetch: '让 AI 能访问网页，获取网上的信息。',
    websearch: '让 AI 能进行网络搜索，找到相关资料。',
  };
  return stories[toolName.toLowerCase()] || `${toolName} 工具提供特定功能`;
}

function generateConfigStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const configModules = Object.values(blueprint.modules)
    .filter(m => /config|settings|env/.test(m.id))
    .slice(0, 3);

  const steps: StoryStep[] = configModules.map((m, i) => ({
    id: `config-${i}`,
    title: i === 0 ? '配置从哪来？' : `配置模块: ${m.name}`,
    story: i === 0
      ? '配置信息可能来自：环境变量、配置文件、命令行参数。程序启动时按优先级合并这些配置。'
      : `${m.name} 负责处理特定类型的配置`,
    technical: m.semantic?.description || m.name,
    moduleId: m.id,
  }));

  return {
    id: 'config-loading',
    title: '配置是怎么加载的？',
    description: '程序需要知道 API 密钥、模型选择等设置',
    icon: '⚙️',
    steps,
    keyTakeaways: [
      '环境变量优先级最高',
      '配置文件提供默认值',
      '命令行参数可覆盖其他配置',
    ],
    relatedStories: ['cli-flow'],
  };
}

function generateSessionStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const sessionModules = Object.values(blueprint.modules)
    .filter(m => /session|persistence|storage/.test(m.id))
    .slice(0, 3);

  const steps: StoryStep[] = [
    {
      id: 'session-create',
      title: '创建会话',
      story: '每次你开始聊天，程序会创建一个"会话"来记录这次对话。就像开了一个新的聊天窗口。',
      technical: '会话包含消息历史、工具调用记录、累计成本等信息',
      moduleId: sessionModules[0]?.id || 'session',
    },
    {
      id: 'session-save',
      title: '保存进度',
      story: '对话过程中，内容会定期保存。即使程序意外关闭，你的对话也不会丢失。',
      technical: '会话序列化为 JSON，保存到 ~/.claude/sessions/ 目录',
      moduleId: sessionModules[0]?.id || 'session',
    },
    {
      id: 'session-resume',
      title: '继续上次',
      story: '使用 --resume 参数可以继续上次的对话，AI 会记得之前说过什么。',
      technical: '从文件加载会话状态，恢复消息历史和上下文',
      moduleId: sessionModules[0]?.id || 'session',
    },
  ];

  return {
    id: 'session-management',
    title: '对话历史是怎么保存的？',
    description: '会话管理让你可以暂停和继续对话',
    icon: '💾',
    steps,
    keyTakeaways: [
      '会话自动保存，不怕意外中断',
      '30 天内的会话都可以恢复',
      '使用 --resume 继续上次对话',
    ],
    relatedStories: ['conversation-flow'],
  };
}

function generateDefaultStory(blueprint: EnhancedCodeBlueprint): BusinessStory {
  const topModules = Object.values(blueprint.modules)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  return {
    id: 'project-overview',
    title: '项目概览',
    description: '这个项目的主要组成部分',
    icon: '📦',
    steps: topModules.map((m, i) => ({
      id: `module-${i}`,
      title: m.name.replace(/\.(ts|js)$/, ''),
      story: m.semantic?.description || `${m.name} 是项目的重要组成部分`,
      technical: `${m.lines} 行代码，${m.exports.length} 个导出`,
      moduleId: m.id,
    })),
    keyTakeaways: [
      `共 ${blueprint.statistics.totalModules} 个模块`,
      `${blueprint.statistics.totalLines.toLocaleString()} 行代码`,
    ],
    relatedStories: [],
  };
}

// ============================================================================
// 代码阅读引擎 - 引导式代码理解
// ============================================================================

interface ReadingStep {
  id: string;
  question: string;        // 引导问题
  hint: string;            // 提示
  codeLocation: {
    moduleId: string;
    lineStart: number;
    lineEnd: number;
  };
  explanation: string;     // 解释
  keyPoints: string[];     // 要点
  nextQuestion?: string;   // 下一个问题
}

interface ReadingPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;   // 如 "15 分钟"
  steps: ReadingStep[];
  prerequisites?: string[];
}

interface CodeReadingGuide {
  projectName: string;
  paths: ReadingPath[];
  currentPath?: string;
  currentStep?: number;
}

/**
 * 生成代码阅读引导
 */
function generateReadingGuide(blueprint: EnhancedCodeBlueprint): CodeReadingGuide {
  const paths: ReadingPath[] = [];

  // 1. 入门路径 - 理解项目结构
  paths.push({
    id: 'getting-started',
    title: '快速了解项目',
    description: '用 10 分钟理解这个项目在做什么',
    difficulty: 'beginner',
    estimatedTime: '10 分钟',
    steps: [
      {
        id: 'step-1',
        question: '这个项目是做什么的？',
        hint: '看看入口文件的开头注释和 package.json',
        codeLocation: {
          moduleId: 'src/cli.ts',
          lineStart: 1,
          lineEnd: 20,
        },
        explanation: '入口文件的注释通常会说明项目目的',
        keyPoints: ['找项目描述', '看主要功能'],
      },
      {
        id: 'step-2',
        question: '项目有哪些主要部分？',
        hint: '看 src 目录结构',
        codeLocation: {
          moduleId: 'src/index.ts',
          lineStart: 1,
          lineEnd: 30,
        },
        explanation: '目录结构反映了代码组织方式',
        keyPoints: ['core = 核心逻辑', 'tools = 工具实现', 'ui = 用户界面'],
      },
    ],
  });

  // 2. 核心流程路径
  if (hasModule(blueprint, /loop|conversation/)) {
    paths.push({
      id: 'core-flow',
      title: '理解核心流程',
      description: '深入了解程序的主要执行流程',
      difficulty: 'intermediate',
      estimatedTime: '20 分钟',
      steps: generateCoreFlowSteps(blueprint),
      prerequisites: ['getting-started'],
    });
  }

  // 3. 工具系统路径
  if (hasModule(blueprint, /tools?\//)) {
    paths.push({
      id: 'tool-system',
      title: '理解工具系统',
      description: '了解 AI 如何调用工具执行任务',
      difficulty: 'intermediate',
      estimatedTime: '15 分钟',
      steps: generateToolSystemSteps(blueprint),
      prerequisites: ['core-flow'],
    });
  }

  return {
    projectName: blueprint.project.name,
    paths,
  };
}

function generateCoreFlowSteps(blueprint: EnhancedCodeBlueprint): ReadingStep[] {
  const steps: ReadingStep[] = [];

  const loopModule = Object.values(blueprint.modules).find(m => /loop/.test(m.id));
  if (loopModule) {
    steps.push({
      id: 'loop-entry',
      question: '对话循环是怎么开始的？',
      hint: '找 ConversationLoop 类或 runLoop 函数',
      codeLocation: {
        moduleId: loopModule.id,
        lineStart: 1,
        lineEnd: 100,
      },
      explanation: '主循环函数是程序的"心脏"，控制着输入输出的节奏',
      keyPoints: ['while 循环', '等待用户输入', '调用 AI', '处理响应'],
      nextQuestion: 'AI 响应是怎么处理的？',
    });
  }

  return steps;
}

function generateToolSystemSteps(blueprint: EnhancedCodeBlueprint): ReadingStep[] {
  const steps: ReadingStep[] = [];

  const toolIndex = Object.values(blueprint.modules).find(m =>
    m.id.includes('tools') && m.id.includes('index'));
  if (toolIndex) {
    steps.push({
      id: 'tool-registry',
      question: '工具是怎么注册的？',
      hint: '看 ToolRegistry 或 registerTools',
      codeLocation: {
        moduleId: toolIndex.id,
        lineStart: 1,
        lineEnd: 50,
      },
      explanation: '所有工具在启动时注册到一个中心注册表',
      keyPoints: ['注册模式', '工具接口', '参数定义'],
    });
  }

  return steps;
}

// ============================================================================
// 知识快照 - 用于增量更新
// ============================================================================

interface KnowledgeSnapshot {
  timestamp: string;
  version: string;
  changes: CodeChange[];
  insights: string[];
}

interface CodeChange {
  type: 'added' | 'modified' | 'deleted';
  moduleId: string;
  symbolId?: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * 生成知识快照（用于对比变化）
 */
function generateKnowledgeSnapshot(blueprint: EnhancedCodeBlueprint): KnowledgeSnapshot {
  return {
    timestamp: new Date().toISOString(),
    version: blueprint.meta.version,
    changes: [], // 首次生成没有变化
    insights: [
      `项目包含 ${blueprint.statistics.totalModules} 个模块`,
      `共 ${blueprint.statistics.totalLines.toLocaleString()} 行代码`,
      `${blueprint.statistics.totalSymbols} 个导出符号`,
    ],
  };
}

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
   * 生成 AI 代码解释
   */
  private generateAIExplanation(
    code: string,
    module: any,
    symbols: any[],
    question: string,
    blueprint: any
  ): {
    summary: string;
    detailed: string;
    keyPoints: string[];
    relatedConcepts: string[];
    codeFlow: string[];
  } {
    // 分析代码特征
    const lines = code.split('\n');
    const hasFunction = /function\s+\w+|=>\s*{|async\s+/.test(code);
    const hasClass = /class\s+\w+/.test(code);
    const hasImport = /import\s+/.test(code);
    const hasExport = /export\s+/.test(code);
    const hasLoop = /for\s*\(|while\s*\(|\.forEach|\.map|\.filter/.test(code);
    const hasConditional = /if\s*\(|switch\s*\(|\?\s*:/.test(code);
    const hasAsync = /async|await|Promise|\.then\(/.test(code);
    const hasError = /try\s*{|catch\s*\(|throw\s+/.test(code);

    // 获取符号信息
    const symbolNames = symbols.map(s => s.name).join(', ');
    const symbolDescriptions = symbols
      .filter(s => s.semantic?.description)
      .map(s => `${s.name}: ${s.semantic.description}`);

    // 生成摘要
    let summary = '';
    if (symbols.length > 0 && symbols[0].semantic?.description) {
      summary = symbols[0].semantic.description;
    } else if (hasClass) {
      summary = `这是一个类定义，用于封装相关的数据和行为。`;
    } else if (hasFunction) {
      summary = `这是一个函数实现，负责执行特定的逻辑操作。`;
    } else if (hasImport) {
      summary = `这部分代码导入了外部依赖模块。`;
    } else {
      summary = `这段代码是 ${module.name} 模块的一部分。`;
    }

    // 生成详细解释
    const detailedParts: string[] = [];

    if (module.semantic?.description) {
      detailedParts.push(`**模块背景**: ${module.semantic.description}`);
    }

    if (symbolDescriptions.length > 0) {
      detailedParts.push(`**相关符号**:\n${symbolDescriptions.map(d => `  • ${d}`).join('\n')}`);
    }

    if (hasAsync) {
      detailedParts.push(`**异步处理**: 这段代码包含异步操作，使用 async/await 或 Promise 处理非阻塞任务。`);
    }

    if (hasError) {
      detailedParts.push(`**错误处理**: 代码包含 try-catch 错误处理逻辑，确保异常情况得到正确处理。`);
    }

    if (hasLoop) {
      detailedParts.push(`**循环/迭代**: 代码使用循环或数组方法来处理集合数据。`);
    }

    // 关键点
    const keyPoints: string[] = [];
    if (hasFunction) keyPoints.push('定义了可复用的函数逻辑');
    if (hasClass) keyPoints.push('使用面向对象的类结构');
    if (hasAsync) keyPoints.push('包含异步操作处理');
    if (hasError) keyPoints.push('实现了错误处理机制');
    if (hasImport) keyPoints.push('依赖外部模块');
    if (hasExport) keyPoints.push('导出供其他模块使用');
    if (hasConditional) keyPoints.push('包含条件判断逻辑');

    // 相关概念
    const relatedConcepts: string[] = [];
    if (hasAsync) relatedConcepts.push('异步编程', 'Promise', 'async/await');
    if (hasClass) relatedConcepts.push('面向对象', '封装', '类继承');
    if (hasLoop) relatedConcepts.push('迭代器', '函数式编程');
    if (module.semantic?.tags) {
      relatedConcepts.push(...module.semantic.tags.slice(0, 3));
    }

    // 代码流程
    const codeFlow: string[] = [];
    if (hasImport) codeFlow.push('1. 导入依赖模块');
    if (hasFunction || hasClass) codeFlow.push('2. 定义核心逻辑');
    if (hasConditional) codeFlow.push('3. 条件判断分支');
    if (hasLoop) codeFlow.push('4. 循环处理数据');
    if (hasAsync) codeFlow.push('5. 异步操作执行');
    if (hasError) codeFlow.push('6. 错误处理');
    if (hasExport) codeFlow.push('7. 导出模块接口');

    // 如果有具体问题，尝试回答
    if (question) {
      detailedParts.push(`\n**关于你的问题 "${question}"**:`);
      if (question.includes('作用') || question.includes('干什么') || question.includes('做什么')) {
        detailedParts.push(summary);
      } else if (question.includes('为什么') || question.includes('原因')) {
        detailedParts.push('这段代码的设计目的是为了' + (module.semantic?.responsibility || '实现特定功能'));
      } else if (question.includes('怎么') || question.includes('如何')) {
        detailedParts.push('代码通过以下步骤实现功能:\n' + codeFlow.join('\n'));
      } else {
        detailedParts.push('请查看上述分析了解代码详情。');
      }
    }

    return {
      summary,
      detailed: detailedParts.join('\n\n'),
      keyPoints: keyPoints.length > 0 ? keyPoints : ['这是模块的基础代码'],
      relatedConcepts: [...new Set(relatedConcepts)].slice(0, 5),
      codeFlow: codeFlow.length > 0 ? codeFlow : ['执行基本操作']
    };
  }

  /**
   * 生成代码改进建议
   */
  private generateCodeSuggestions(
    code: string,
    module: any,
    blueprint: any
  ): Array<{
    type: 'info' | 'warning' | 'tip';
    title: string;
    description: string;
  }> {
    const suggestions: Array<{
      type: 'info' | 'warning' | 'tip';
      title: string;
      description: string;
    }> = [];

    // 分析代码特征
    const lines = code.split('\n');
    const hasAny = /:\s*any\b/.test(code);
    const hasConsoleLog = /console\.log/.test(code);
    const hasTodo = /\/\/\s*TODO|\/\/\s*FIXME/.test(code);
    const hasLongFunction = lines.length > 50;
    const hasNestedCallback = /\(\s*\([^)]*\)\s*=>\s*{[^}]*\([^)]*\)\s*=>\s*{/.test(code);

    if (hasAny) {
      suggestions.push({
        type: 'warning',
        title: '避免使用 any 类型',
        description: '使用具体类型或泛型可以提供更好的类型安全和代码提示。'
      });
    }

    if (hasConsoleLog) {
      suggestions.push({
        type: 'tip',
        title: '生产代码中移除 console.log',
        description: '考虑使用专门的日志库来管理日志输出。'
      });
    }

    if (hasTodo) {
      suggestions.push({
        type: 'info',
        title: '发现 TODO/FIXME 注释',
        description: '这里有待完成或需要修复的代码，请关注。'
      });
    }

    if (hasLongFunction) {
      suggestions.push({
        type: 'tip',
        title: '函数过长',
        description: '考虑将复杂逻辑拆分为多个小函数，提高可读性和可维护性。'
      });
    }

    if (hasNestedCallback) {
      suggestions.push({
        type: 'tip',
        title: '嵌套回调',
        description: '可以使用 async/await 来简化嵌套的回调结构。'
      });
    }

    // 添加模块相关建议
    if (module.semantic?.architectureLayer === 'presentation') {
      suggestions.push({
        type: 'info',
        title: '表现层代码',
        description: '确保 UI 逻辑与业务逻辑分离，保持组件的单一职责。'
      });
    }

    return suggestions;
  }

  /**
   * 生成智能悬浮分析 - 详细的代码语义解释
   */
  private generateSmartHoverAnalysis(
    code: string,
    moduleId: string,
    module: any,
    startLine: number,
    endLine: number,
    blueprint: any
  ): any {
    const lines = code.split('\n');

    // 1. 查找选中区域内的符号
    const symbolsInRange = Object.values(blueprint.symbols || {})
      .filter((s: any) =>
        s.moduleId === moduleId &&
        s.location?.startLine <= endLine &&
        s.location?.endLine >= startLine
      ) as any[];

    // 2. 分析代码特征
    const codeFeatures = this.analyzeCodeFeatures(code);

    // 3. 分析引用的库和依赖
    const imports = this.analyzeImports(code, module, blueprint);

    // 4. 分析调用关系
    const callRelations = this.analyzeCallRelations(symbolsInRange, blueprint);

    // 5. 分析与其他文件的关系
    const fileRelations = this.analyzeFileRelations(moduleId, symbolsInRange, blueprint);

    // 6. 生成局部作用描述
    const localRole = this.generateLocalRole(code, symbolsInRange, codeFeatures);

    // 7. 生成整体作用描述
    const globalRole = this.generateGlobalRole(module, symbolsInRange, blueprint);

    // 8. 生成工作原理说明
    const workingPrinciple = this.generateWorkingPrinciple(code, codeFeatures, imports);

    return {
      // 基本信息
      moduleId,
      fileName: module.name,
      lineRange: { start: startLine, end: endLine },
      linesCount: endLine - startLine + 1,

      // 符号信息
      symbols: symbolsInRange.map((s: any) => ({
        name: s.name,
        kind: s.kind,
        signature: s.signature,
        description: s.semantic?.description,
        line: s.location?.startLine
      })),

      // 语义分析
      analysis: {
        // 局部作用 - 这段代码在当前文件中做什么
        localRole: {
          summary: localRole.summary,
          details: localRole.details,
          codePattern: codeFeatures.pattern
        },

        // 整体作用 - 这段代码在整个项目中的角色
        globalRole: {
          summary: globalRole.summary,
          architectureLayer: module.semantic?.architectureLayer || 'unknown',
          businessDomain: module.semantic?.businessDomain || '',
          importance: globalRole.importance
        },

        // 工作原理
        workingPrinciple: {
          summary: workingPrinciple.summary,
          steps: workingPrinciple.steps,
          dataFlow: workingPrinciple.dataFlow
        },

        // 引用的库
        dependencies: {
          imports: imports.directImports,
          externalLibs: imports.externalLibs,
          internalModules: imports.internalModules,
          explanation: imports.explanation
        },

        // 调用关系
        callGraph: {
          callers: callRelations.callers,
          callees: callRelations.callees,
          callChain: callRelations.callChain
        },

        // 文件关系
        fileRelations: {
          dependsOn: fileRelations.dependsOn,
          usedBy: fileRelations.usedBy,
          relatedFiles: fileRelations.relatedFiles
        }
      },

      // 代码特征标签
      tags: [
        ...codeFeatures.tags,
        ...(module.semantic?.tags?.slice(0, 3) || [])
      ],

      // 快速理解要点
      keyInsights: this.generateKeyInsights(code, codeFeatures, symbolsInRange, module)
    };
  }

  /**
   * 分析代码特征
   */
  private analyzeCodeFeatures(code: string): any {
    const features: any = {
      hasAsync: /async|await|Promise|\.then\(/.test(code),
      hasLoop: /for\s*\(|while\s*\(|\.forEach|\.map|\.filter|\.reduce/.test(code),
      hasConditional: /if\s*\(|switch\s*\(|\?\s*:|&&|\|\|/.test(code),
      hasClass: /class\s+\w+/.test(code),
      hasFunction: /function\s+\w+|=>\s*{|async\s+function/.test(code),
      hasExport: /export\s+(default\s+)?/.test(code),
      hasImport: /import\s+/.test(code),
      hasError: /try\s*{|catch\s*\(|throw\s+|\.catch\(/.test(code),
      hasCallback: /\(\s*\([^)]*\)\s*=>|\bfunction\s*\(/.test(code),
      hasTypeAnnotation: /:\s*(string|number|boolean|any|void|Promise|Array)/.test(code),
      hasInterface: /interface\s+\w+/.test(code),
      hasDecorator: /@\w+/.test(code),
      hasJSX: /<\w+[^>]*>|<\/\w+>/.test(code),
      hasRegex: /\/[^/]+\/[gimsy]*/.test(code),
      hasApi: /fetch\(|axios|http\.|request\(|\.get\(|\.post\(/.test(code),
      hasState: /useState|setState|this\.state|createSignal/.test(code),
      hasEffect: /useEffect|componentDidMount|watch\(/.test(code),
      pattern: '',
      tags: [] as string[]
    };

    // 确定代码模式
    if (features.hasClass) {
      features.pattern = 'class-definition';
      features.tags.push('面向对象');
    } else if (features.hasFunction) {
      features.pattern = features.hasAsync ? 'async-function' : 'function';
      features.tags.push('函数式');
    } else if (features.hasImport && !features.hasFunction && !features.hasClass) {
      features.pattern = 'imports';
      features.tags.push('模块导入');
    } else if (features.hasInterface) {
      features.pattern = 'type-definition';
      features.tags.push('类型定义');
    } else if (features.hasJSX) {
      features.pattern = 'jsx-component';
      features.tags.push('UI组件');
    } else {
      features.pattern = 'logic';
      features.tags.push('业务逻辑');
    }

    // 添加特征标签
    if (features.hasAsync) features.tags.push('异步');
    if (features.hasError) features.tags.push('错误处理');
    if (features.hasLoop) features.tags.push('循环/迭代');
    if (features.hasApi) features.tags.push('API调用');
    if (features.hasState) features.tags.push('状态管理');

    return features;
  }

  /**
   * 分析导入的库和依赖
   */
  private analyzeImports(code: string, module: any, blueprint: any): any {
    const directImports: string[] = [];
    const externalLibs: Array<{ name: string; description: string }> = [];
    const internalModules: Array<{ name: string; path: string }> = [];

    // 从代码中提取 import
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      directImports.push(match[1]);
    }

    // 从模块导入信息分析
    const moduleImports = module.imports || [];
    for (const imp of moduleImports) {
      if (imp.isExternal) {
        const libDesc = this.getLibraryDescription(imp.source);
        externalLibs.push({
          name: imp.source,
          description: libDesc
        });
      } else {
        internalModules.push({
          name: imp.source,
          path: imp.source
        });
      }
    }

    // 生成依赖说明
    let explanation = '';
    if (externalLibs.length > 0) {
      explanation += '使用了 ' + externalLibs.map(l => l.name).join('、') + ' 等外部库。';
    }
    if (internalModules.length > 0) {
      explanation += '依赖了项目内 ' + internalModules.length + ' 个模块。';
    }

    return { directImports, externalLibs, internalModules, explanation };
  }

  /**
   * 获取常用库的描述
   */
  private getLibraryDescription(libName: string): string {
    const knownLibs: Record<string, string> = {
      'react': 'UI 组件库，用于构建用户界面',
      'vue': 'Vue.js 框架，渐进式 JavaScript 框架',
      'express': 'Node.js Web 框架，用于构建 API 服务',
      'axios': 'HTTP 客户端，用于发起网络请求',
      'lodash': '工具函数库，提供常用的数据处理方法',
      'fs': 'Node.js 文件系统模块',
      'path': 'Node.js 路径处理模块',
      'commander': '命令行参数解析库',
      'chalk': '终端文字样式库',
      'ink': 'React 命令行 UI 框架',
      'typescript': 'TypeScript 编译器',
      'zod': '类型安全的数据验证库',
      'http': 'Node.js HTTP 模块',
      'https': 'Node.js HTTPS 模块',
      'crypto': 'Node.js 加密模块',
      'events': 'Node.js 事件发射器',
      'stream': 'Node.js 流处理模块',
      'd3': '数据可视化库',
      'moment': '日期时间处理库',
      'dayjs': '轻量级日期时间库',
      'uuid': 'UUID 生成库',
      'dotenv': '环境变量加载库',
    };
    return knownLibs[libName] || '第三方库';
  }

  /**
   * 分析调用关系
   */
  private analyzeCallRelations(symbols: any[], blueprint: any): any {
    const callers: any[] = [];
    const callees: any[] = [];
    const callChain: string[] = [];

    for (const symbol of symbols) {
      // 谁调用了这个符号
      const symbolCallers = (blueprint.references?.symbolCalls || [])
        .filter((c: any) => c.callee === symbol.id)
        .slice(0, 5)
        .map((c: any) => {
          const caller = blueprint.symbols?.[c.caller];
          return {
            name: caller?.name || 'unknown',
            module: caller?.moduleId || '',
            callType: c.callType
          };
        });
      callers.push(...symbolCallers);

      // 这个符号调用了谁
      const symbolCallees = (blueprint.references?.symbolCalls || [])
        .filter((c: any) => c.caller === symbol.id)
        .slice(0, 5)
        .map((c: any) => {
          const callee = blueprint.symbols?.[c.callee];
          return {
            name: callee?.name || 'unknown',
            module: callee?.moduleId || '',
            callType: c.callType
          };
        });
      callees.push(...symbolCallees);
    }

    // 构建简化的调用链
    if (callers.length > 0 && symbols.length > 0) {
      callChain.push(callers[0]?.name || '?');
      callChain.push('→');
      callChain.push(symbols[0]?.name || '当前代码');
      if (callees.length > 0) {
        callChain.push('→');
        callChain.push(callees[0]?.name || '?');
      }
    }

    return {
      callers: callers.slice(0, 5),
      callees: callees.slice(0, 5),
      callChain: callChain.length > 0 ? callChain.join(' ') : '无调用链信息'
    };
  }

  /**
   * 分析与其他文件的关系
   */
  private analyzeFileRelations(moduleId: string, symbols: any[], blueprint: any): any {
    const dependsOn: Array<{ module: string; reason: string }> = [];
    const usedBy: Array<{ module: string; reason: string }> = [];
    const relatedFiles: string[] = [];

    // 这个模块依赖哪些模块
    const moduleDeps = (blueprint.references?.moduleDeps || [])
      .filter((d: any) => d.source === moduleId)
      .slice(0, 5);

    for (const dep of moduleDeps) {
      dependsOn.push({
        module: dep.target,
        reason: dep.isTypeOnly ? '类型导入' : '功能导入'
      });
      relatedFiles.push(dep.target);
    }

    // 哪些模块依赖这个模块
    const reverseDeps = (blueprint.references?.moduleDeps || [])
      .filter((d: any) => d.target === moduleId)
      .slice(0, 5);

    for (const dep of reverseDeps) {
      usedBy.push({
        module: dep.source,
        reason: '引用了此模块'
      });
      if (!relatedFiles.includes(dep.source)) {
        relatedFiles.push(dep.source);
      }
    }

    return {
      dependsOn,
      usedBy,
      relatedFiles: relatedFiles.slice(0, 8)
    };
  }

  /**
   * 生成局部作用描述
   */
  private generateLocalRole(code: string, symbols: any[], features: any): any {
    let summary = '';
    const details: string[] = [];

    if (symbols.length > 0) {
      const mainSymbol = symbols[0];
      if (mainSymbol.semantic?.description) {
        summary = mainSymbol.semantic.description;
      } else {
        summary = `定义了 ${mainSymbol.kind} "${mainSymbol.name}"`;
      }

      for (const s of symbols) {
        if (s.semantic?.responsibility) {
          details.push(`${s.name}: ${s.semantic.responsibility}`);
        }
      }
    } else {
      // 根据代码特征推断
      if (features.hasImport) {
        summary = '导入所需的依赖模块';
        details.push('为当前文件引入外部功能');
      } else if (features.hasExport) {
        summary = '导出模块功能供其他文件使用';
      } else if (features.hasLoop) {
        summary = '循环处理数据集合';
        details.push('对数组或对象进行迭代操作');
      } else if (features.hasConditional) {
        summary = '条件判断逻辑';
        details.push('根据条件执行不同的分支');
      } else if (features.hasAsync) {
        summary = '异步操作处理';
        details.push('处理需要等待的操作，如网络请求或文件读写');
      } else if (features.hasError) {
        summary = '错误处理逻辑';
        details.push('捕获和处理可能发生的异常');
      } else {
        summary = '执行具体的业务逻辑';
      }
    }

    return { summary, details };
  }

  /**
   * 生成整体作用描述
   */
  private generateGlobalRole(module: any, symbols: any[], blueprint: any): any {
    let summary = '';
    let importance = 'normal';

    if (module.semantic?.description) {
      summary = `此代码属于 "${module.name}" 模块。${module.semantic.description}`;
    } else {
      summary = `此代码是 "${module.name}" 模块的一部分。`;
    }

    // 判断重要性
    const totalImports = (blueprint.references?.moduleDeps || [])
      .filter((d: any) => d.target === module.id).length;

    if (totalImports > 10) {
      importance = 'critical';
      summary += ' 这是一个核心模块，被大量其他模块依赖。';
    } else if (totalImports > 5) {
      importance = 'important';
      summary += ' 这是一个重要模块，有多个模块依赖它。';
    }

    // 添加架构层说明
    const layerLabels: Record<string, string> = {
      presentation: '表现层 - 负责用户界面展示',
      business: '业务层 - 处理核心业务逻辑',
      data: '数据层 - 管理数据存取',
      infrastructure: '基础设施层 - 提供通用工具和服务',
      crossCutting: '横切关注点 - 日志、安全等通用功能'
    };

    if (module.semantic?.architectureLayer) {
      summary += ` [${layerLabels[module.semantic.architectureLayer] || module.semantic.architectureLayer}]`;
    }

    return { summary, importance };
  }

  /**
   * 生成工作原理说明
   */
  private generateWorkingPrinciple(code: string, features: any, imports: any): any {
    const steps: string[] = [];
    let summary = '';
    let dataFlow = '';

    // 根据代码特征推断工作原理
    if (features.hasImport) {
      steps.push('1. 引入所需的依赖模块');
    }

    if (features.hasClass) {
      steps.push('2. 定义类结构，封装数据和行为');
      summary = '通过面向对象的方式组织代码，将相关的数据和方法封装在一起。';
      dataFlow = '外部调用 → 类实例 → 内部方法';
    } else if (features.hasFunction) {
      if (features.hasAsync) {
        steps.push('2. 定义异步函数处理非阻塞操作');
        steps.push('3. 使用 await 等待异步结果');
        summary = '使用 async/await 处理异步操作，避免回调地狱，使代码更易读。';
        dataFlow = '输入参数 → 异步处理 → Promise 结果';
      } else {
        steps.push('2. 定义函数接收参数');
        steps.push('3. 执行逻辑并返回结果');
        summary = '函数式编程，接收输入产生输出，保持代码的可测试性。';
        dataFlow = '输入参数 → 处理逻辑 → 返回值';
      }
    }

    if (features.hasConditional) {
      steps.push((steps.length + 1) + '. 根据条件分支执行不同逻辑');
    }

    if (features.hasLoop) {
      steps.push((steps.length + 1) + '. 遍历数据集合进行处理');
    }

    if (features.hasError) {
      steps.push((steps.length + 1) + '. 捕获异常并进行错误处理');
    }

    if (features.hasApi) {
      steps.push((steps.length + 1) + '. 发起网络请求与外部服务通信');
      dataFlow = '请求参数 → HTTP 请求 → 响应数据';
    }

    if (steps.length === 0) {
      steps.push('1. 执行基本操作');
      summary = '这段代码执行基本的逻辑操作。';
    }

    if (!summary) {
      summary = '代码按照步骤依次执行，处理输入数据并产生输出。';
    }

    return { summary, steps, dataFlow: dataFlow || '输入 → 处理 → 输出' };
  }

  /**
   * 生成快速理解要点
   */
  private generateKeyInsights(code: string, features: any, symbols: any[], module: any): string[] {
    const insights: string[] = [];

    // 基于符号生成要点
    if (symbols.length > 0) {
      const mainSymbol = symbols[0];
      insights.push(`📌 这里定义了 ${mainSymbol.kind} "${mainSymbol.name}"`);
    }

    // 基于特征生成要点
    if (features.hasAsync) {
      insights.push('⚡ 包含异步操作，注意 Promise 的处理');
    }

    if (features.hasError) {
      insights.push('🛡️ 有错误处理逻辑，确保程序健壮性');
    }

    if (features.hasApi) {
      insights.push('🌐 涉及网络请求，需要考虑网络异常');
    }

    if (features.hasState) {
      insights.push('📊 管理组件状态，影响 UI 渲染');
    }

    // 基于模块信息生成要点
    if (module.semantic?.architectureLayer === 'presentation') {
      insights.push('🎨 表现层代码，关注用户交互体验');
    } else if (module.semantic?.architectureLayer === 'business') {
      insights.push('💼 业务层代码，包含核心业务逻辑');
    } else if (module.semantic?.architectureLayer === 'data') {
      insights.push('💾 数据层代码，处理数据存取');
    }

    // 如果没有生成任何要点
    if (insights.length === 0) {
      insights.push('📝 这段代码是模块的一部分');
    }

    return insights.slice(0, 5);
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

      if (pathname === '/api/flowchart') {
        // 返回流程图数据
        const entryId = url.searchParams.get('entry') || '';
        const scenario = url.searchParams.get('scenario') || 'default';
        const maxDepth = parseInt(url.searchParams.get('depth') || '6', 10);

        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const flowchart = buildFlowchart(data, entryId, scenario, maxDepth);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(flowchart));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Flowchart requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/scenarios') {
        // 返回可用的业务场景列表
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const scenarios = detectScenarios(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ scenarios }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Scenarios requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/beginner-guide') {
        // 返回新手导览数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const guide = generateBeginnerGuide(data);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(guide));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Beginner guide requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/story-guide') {
        // 返回业务故事导览数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const guide = generateStoryGuide(data);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(guide));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Story guide requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/reading-guide') {
        // 返回代码阅读引导数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const guide = generateReadingGuide(data);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(guide));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Reading guide requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/knowledge-snapshot') {
        // 返回知识快照数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const data = JSON.parse(content);

        if (this.isEnhancedFormat(data)) {
          const snapshot = generateKnowledgeSnapshot(data);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(snapshot));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Knowledge snapshot requires enhanced format' }));
        }
        return;
      }

      if (pathname === '/api/code-preview') {
        // 返回代码预览
        const moduleId = url.searchParams.get('module') || '';
        const startLine = parseInt(url.searchParams.get('start') || '1', 10);
        const endLine = parseInt(url.searchParams.get('end') || '0', 10); // 0 表示全文件
        const fullFile = url.searchParams.get('full') === 'true' || endLine === 0;
        const highlightStart = parseInt(url.searchParams.get('highlightStart') || '0', 10);
        const highlightEnd = parseInt(url.searchParams.get('highlightEnd') || '0', 10);

        if (!moduleId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing module parameter' }));
          return;
        }

        try {
          const blueprintContent = fs.readFileSync(this.ontologyPath, 'utf-8');
          const blueprint = JSON.parse(blueprintContent);

          if (!this.isEnhancedFormat(blueprint)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Code preview requires enhanced format' }));
            return;
          }

          const module = blueprint.modules[moduleId];
          if (!module) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Module not found: ' + moduleId }));
            return;
          }

          // 读取源文件
          const filePath = module.path;
          if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Source file not found: ' + filePath }));
            return;
          }

          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const lines = fileContent.split('\n');
          const totalLines = lines.length;

          // 全文件模式或指定范围
          let actualStart: number, actualEnd: number;
          if (fullFile) {
            actualStart = 1;
            actualEnd = totalLines;
          } else {
            const contextBefore = 3;
            const contextAfter = 3;
            actualStart = Math.max(1, startLine - contextBefore);
            actualEnd = Math.min(totalLines, endLine + contextAfter);
          }

          // 构建代码行数据
          const codeLines = lines.slice(actualStart - 1, actualEnd).map((line, idx) => {
            const lineNum = actualStart + idx;
            return {
              lineNumber: lineNum,
              content: line,
              isHighlighted: highlightStart > 0 && highlightEnd > 0
                ? lineNum >= highlightStart && lineNum <= highlightEnd
                : lineNum >= startLine && lineNum <= endLine
            };
          });

          // 提取符号信息用于导航
          const symbols = Object.values(blueprint.symbols || {})
            .filter((s: any) => s.moduleId === moduleId)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              kind: s.kind,
              line: s.location?.startLine || 0,
              endLine: s.location?.endLine || 0,
              signature: s.signature,
              semantic: s.semantic
            }))
            .sort((a: any, b: any) => a.line - b.line);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            moduleId,
            fileName: module.name,
            filePath: module.path,
            language: module.language,
            totalLines,
            fullFile,
            requestedRange: { start: startLine, end: endLine || totalLines },
            actualRange: { start: actualStart, end: actualEnd },
            highlightRange: highlightStart > 0 ? { start: highlightStart, end: highlightEnd } : null,
            lines: codeLines,
            symbols,
            semantic: module.semantic,
            imports: module.imports || [],
            exports: module.exports || []
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // AI 代码解释 API
      if (pathname === '/api/ai-explain') {
        const moduleId = url.searchParams.get('module');
        const startLine = parseInt(url.searchParams.get('start') || '1', 10);
        const endLine = parseInt(url.searchParams.get('end') || '10', 10);
        const question = url.searchParams.get('question') || '';

        if (!moduleId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing module parameter' }));
          return;
        }

        try {
          const blueprintContent = fs.readFileSync(this.ontologyPath, 'utf-8');
          const blueprint = JSON.parse(blueprintContent);
          const module = blueprint.modules?.[moduleId];

          if (!module) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Module not found' }));
            return;
          }

          // 读取源文件
          const fileContent = fs.readFileSync(module.path, 'utf-8');
          const lines = fileContent.split('\n');
          const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');

          // 查找相关符号
          const relatedSymbols = Object.values(blueprint.symbols || {})
            .filter((s: any) =>
              s.moduleId === moduleId &&
              s.location?.startLine <= endLine &&
              s.location?.endLine >= startLine
            );

          // 生成 AI 解释（模拟）
          const explanation = this.generateAIExplanation(
            codeSnippet,
            module,
            relatedSymbols as any[],
            question,
            blueprint
          );

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            moduleId,
            lineRange: { start: startLine, end: endLine },
            codeSnippet,
            explanation,
            relatedSymbols: relatedSymbols.map((s: any) => ({
              name: s.name,
              kind: s.kind,
              description: s.semantic?.description
            })),
            suggestions: this.generateCodeSuggestions(codeSnippet, module, blueprint)
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // 获取符号引用 API
      if (pathname === '/api/symbol-refs') {
        const symbolId = url.searchParams.get('symbol');

        if (!symbolId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing symbol parameter' }));
          return;
        }

        try {
          const blueprintContent = fs.readFileSync(this.ontologyPath, 'utf-8');
          const blueprint = JSON.parse(blueprintContent);

          const symbol = blueprint.symbols?.[symbolId];
          if (!symbol) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Symbol not found' }));
            return;
          }

          // 查找调用关系
          const callers = (blueprint.references?.symbolCalls || [])
            .filter((c: any) => c.callee === symbolId)
            .map((c: any) => ({
              callerId: c.caller,
              callerName: blueprint.symbols?.[c.caller]?.name,
              callerModule: blueprint.symbols?.[c.caller]?.moduleId,
              callType: c.callType,
              locations: c.locations
            }));

          const callees = (blueprint.references?.symbolCalls || [])
            .filter((c: any) => c.caller === symbolId)
            .map((c: any) => ({
              calleeId: c.callee,
              calleeName: blueprint.symbols?.[c.callee]?.name,
              calleeModule: blueprint.symbols?.[c.callee]?.moduleId,
              callType: c.callType,
              locations: c.locations
            }));

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            symbol: {
              id: symbol.id,
              name: symbol.name,
              kind: symbol.kind,
              moduleId: symbol.moduleId,
              signature: symbol.signature,
              semantic: symbol.semantic
            },
            callers,
            callees,
            totalCallers: callers.length,
            totalCallees: callees.length
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // 智能悬浮分析 API - 选中代码自动生成详细语义解释
      if (pathname === '/api/smart-hover') {
        const moduleId = url.searchParams.get('module');
        const startLine = parseInt(url.searchParams.get('start') || '1', 10);
        const endLine = parseInt(url.searchParams.get('end') || '10', 10);

        if (!moduleId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing module parameter' }));
          return;
        }

        try {
          const blueprintContent = fs.readFileSync(this.ontologyPath, 'utf-8');
          const blueprint = JSON.parse(blueprintContent);
          const module = blueprint.modules?.[moduleId];

          if (!module) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Module not found' }));
            return;
          }

          // 读取源文件
          const fileContent = fs.readFileSync(module.path, 'utf-8');
          const lines = fileContent.split('\n');
          const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');

          // 生成智能悬浮分析
          const analysis = this.generateSmartHoverAnalysis(
            codeSnippet,
            moduleId,
            module,
            startLine,
            endLine,
            blueprint
          );

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(analysis));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
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
    .scenario-selector {
      display: none;
      gap: 0.5rem;
      align-items: center;
    }
    .scenario-selector.active { display: flex; }
    .scenario-selector label { font-size: 0.85rem; color: #888; }
    .scenario-selector select { min-width: 150px; }
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

    /* 流程图样式 */
    .flowchart-legend {
      position: absolute;
      right: 10px;
      bottom: 10px;
      background: rgba(22, 33, 62, 0.95);
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      display: none;
    }
    .flowchart-legend.active { display: block; }
    .flowchart-legend h3 {
      color: #e94560;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .flowchart-legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.4rem 0;
    }
    .flow-shape {
      width: 24px;
      height: 16px;
      display: inline-block;
    }
    .flow-shape.entry {
      background: #e94560;
      border-radius: 8px;
    }
    .flow-shape.process {
      background: #0f3460;
      border: 2px solid #4ecdc4;
      border-radius: 4px;
    }
    .flow-shape.subprocess {
      background: #533483;
      border-radius: 4px;
    }
    .flow-shape.data {
      background: #16213e;
      border: 2px solid #888;
      transform: skewX(-10deg);
    }
    .flow-shape.end {
      background: #2d3436;
      border: 2px solid #ff6b6b;
      border-radius: 50%;
      width: 16px;
    }
    .flowchart-title {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      display: none;
      background: rgba(22, 33, 62, 0.9);
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
    }
    .flowchart-title.active { display: block; }
    .flowchart-title h2 {
      color: #e94560;
      font-size: 1.2rem;
      margin-bottom: 0.3rem;
    }
    .flowchart-title p {
      color: #888;
      font-size: 0.85rem;
    }

    /* 流程图节点样式 */
    .flow-node {
      cursor: pointer;
    }
    .flow-node rect, .flow-node ellipse, .flow-node polygon {
      stroke-width: 2;
    }
    .flow-node:hover rect, .flow-node:hover ellipse, .flow-node:hover polygon {
      filter: brightness(1.3);
    }
    .flow-node.type-entry rect { fill: #e94560; stroke: #e94560; }
    .flow-node.type-entry ellipse { fill: #e94560; stroke: #e94560; }
    .flow-node.type-process rect { fill: #0f3460; stroke: #4ecdc4; }
    .flow-node.type-subprocess rect { fill: #533483; stroke: #533483; }
    .flow-node.type-data polygon { fill: #16213e; stroke: #888; }
    .flow-node.type-decision polygon { fill: #f39c12; stroke: #f39c12; }
    .flow-node.type-end ellipse { fill: #2d3436; stroke: #ff6b6b; }
    .flow-node text {
      font-size: 11px;
      fill: #eee;
      text-anchor: middle;
    }
    .flow-node .node-desc {
      font-size: 9px;
      fill: #aaa;
    }
    .flow-edge {
      fill: none;
      stroke-width: 2;
      stroke-opacity: 0.7;
    }
    .flow-edge.type-normal { stroke: #4ecdc4; }
    .flow-edge.type-conditional { stroke: #f39c12; stroke-dasharray: 5,3; }
    .flow-edge.type-loop { stroke: #ff6b6b; stroke-dasharray: 3,3; }
    .flow-edge.type-async { stroke: #9b59b6; stroke-dasharray: 8,4; }
    .flow-edge-label {
      font-size: 9px;
      fill: #888;
    }
    .flow-arrow {
      fill: #4ecdc4;
    }

    /* ========== 新手导览样式 ========== */
    .beginner-view {
      display: none;
      flex-direction: column;
      padding: 2rem;
      overflow-y: auto;
      height: 100%;
    }
    .beginner-view.active {
      display: flex;
    }
    .project-intro {
      text-align: center;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 12px;
      border: 1px solid #0f3460;
    }
    .project-intro h1 {
      color: #e94560;
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
    }
    .project-intro .tagline {
      color: #4ecdc4;
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }
    .project-intro .summary {
      color: #aaa;
      font-size: 0.95rem;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
    }
    .module-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }
    .module-card {
      background: #16213e;
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
      position: relative;
    }
    .module-card:hover {
      transform: translateY(-4px);
      border-color: #4ecdc4;
      box-shadow: 0 8px 24px rgba(78, 205, 196, 0.2);
    }
    .module-card.expanded {
      grid-column: span 2;
    }
    .module-card .card-icon {
      font-size: 2rem;
      margin-bottom: 0.8rem;
    }
    .module-card .card-title {
      color: #e94560;
      font-size: 1.2rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    .module-card .card-subtitle {
      color: #4ecdc4;
      font-size: 0.85rem;
      margin-bottom: 0.8rem;
    }
    .module-card .card-explain {
      color: #ccc;
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 1rem;
    }
    .module-card .card-analogy {
      background: rgba(233, 69, 96, 0.1);
      border-left: 3px solid #e94560;
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
      color: #f8b4b4;
      border-radius: 0 6px 6px 0;
      margin-bottom: 1rem;
    }
    .module-card .card-files {
      font-size: 0.8rem;
      color: #888;
    }
    .module-card .card-files span {
      background: #0f3460;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-right: 0.3rem;
      display: inline-block;
      margin-bottom: 0.3rem;
    }
    .module-card .expand-details {
      display: none;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #0f3460;
    }
    .module-card.expanded .expand-details {
      display: block;
    }
    .expand-details h4 {
      color: #4ecdc4;
      font-size: 0.9rem;
      margin-bottom: 0.8rem;
    }
    .key-function {
      background: #1a1a2e;
      padding: 0.8rem;
      border-radius: 6px;
      margin-bottom: 0.6rem;
    }
    .key-function .func-name {
      color: #e94560;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .key-function .func-desc {
      color: #aaa;
      font-size: 0.8rem;
      margin-top: 0.3rem;
    }
    .card-badge {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #e94560;
      color: white;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
    }
    .card-badge.core { background: #e94560; }
    .card-badge.tool { background: #533483; }
    .card-badge.util { background: #0f3460; }
    .card-badge.ui { background: #2d3436; }

    /* ========================================
       业务故事视图样式
       ======================================== */
    .story-view {
      display: none;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      height: 100%;
      overflow-y: auto;
    }
    .story-view.active {
      display: block;
    }
    .story-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .story-header h1 {
      color: #e94560;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .story-header p {
      color: #888;
      font-size: 1rem;
    }
    .story-list {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      justify-content: center;
      margin-bottom: 2rem;
    }
    .story-card {
      background: linear-gradient(145deg, #1a1a2e, #16213e);
      border-radius: 16px;
      padding: 1.5rem;
      width: 280px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }
    .story-card:hover {
      transform: translateY(-5px);
      border-color: #4ecdc4;
      box-shadow: 0 10px 30px rgba(78, 205, 196, 0.2);
    }
    .story-card.active {
      border-color: #e94560;
      box-shadow: 0 10px 30px rgba(233, 69, 96, 0.3);
    }
    .story-card .story-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .story-card h3 {
      color: #fff;
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }
    .story-card p {
      color: #888;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .story-detail {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 2rem;
      margin-top: 2rem;
    }
    .story-detail.hidden {
      display: none;
    }
    .story-detail h2 {
      color: #e94560;
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .story-steps {
      position: relative;
      padding-left: 3rem;
    }
    .story-steps::before {
      content: '';
      position: absolute;
      left: 1rem;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(to bottom, #e94560, #533483, #0f3460);
      border-radius: 2px;
    }
    .story-step {
      position: relative;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #16213e;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .story-step:hover {
      background: #1f2b4a;
      transform: translateX(5px);
    }
    .story-step::before {
      content: '';
      position: absolute;
      left: -2.5rem;
      top: 1.5rem;
      width: 14px;
      height: 14px;
      background: #e94560;
      border-radius: 50%;
      border: 3px solid #1a1a2e;
    }
    .story-step.completed::before {
      background: #4ecdc4;
    }
    .story-step h4 {
      color: #4ecdc4;
      font-size: 1.1rem;
      margin-bottom: 0.8rem;
    }
    .story-step .step-story {
      color: #eee;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .story-step .step-technical {
      color: #888;
      font-size: 0.85rem;
      padding: 0.8rem;
      background: #1a1a2e;
      border-radius: 8px;
      font-family: monospace;
    }
    .story-step .step-code-link {
      display: inline-block;
      margin-top: 0.8rem;
      color: #e94560;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .story-step .step-code-link:hover {
      text-decoration: underline;
    }
    .story-takeaways {
      margin-top: 2rem;
      padding: 1.5rem;
      background: linear-gradient(145deg, #16213e, #1a1a2e);
      border-radius: 12px;
      border-left: 4px solid #4ecdc4;
    }
    .story-takeaways h4 {
      color: #4ecdc4;
      margin-bottom: 1rem;
    }
    .story-takeaways ul {
      list-style: none;
      padding: 0;
    }
    .story-takeaways li {
      color: #eee;
      padding: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;
    }
    .story-takeaways li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #4ecdc4;
    }

    /* ========================================
       代码阅读引擎视图样式
       ======================================== */
    .reading-view {
      display: none;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      height: 100%;
      overflow-y: auto;
    }
    .reading-view.active {
      display: block;
    }
    .reading-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .reading-header h1 {
      color: #e94560;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .reading-header p {
      color: #888;
      font-size: 1rem;
    }
    .reading-paths {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }
    .reading-path {
      background: linear-gradient(145deg, #1a1a2e, #16213e);
      border-radius: 12px;
      padding: 1.5rem;
      width: 300px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }
    .reading-path:hover {
      border-color: #4ecdc4;
    }
    .reading-path.active {
      border-color: #e94560;
    }
    .reading-path h3 {
      color: #fff;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
    .reading-path p {
      color: #888;
      font-size: 0.9rem;
      margin-bottom: 0.8rem;
    }
    .reading-path .path-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.8rem;
    }
    .reading-path .difficulty {
      padding: 0.2rem 0.6rem;
      border-radius: 10px;
      background: #533483;
      color: #fff;
    }
    .reading-path .difficulty.beginner { background: #4ecdc4; color: #000; }
    .reading-path .difficulty.intermediate { background: #533483; }
    .reading-path .difficulty.advanced { background: #e94560; }
    .reading-path .time {
      color: #888;
    }
    .reading-content {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 2rem;
    }
    .reading-content.hidden {
      display: none;
    }
    .reading-question {
      margin-bottom: 2rem;
    }
    .reading-question h3 {
      color: #e94560;
      font-size: 1.3rem;
      margin-bottom: 1rem;
    }
    .reading-question .hint {
      color: #4ecdc4;
      font-size: 0.95rem;
      padding: 1rem;
      background: #16213e;
      border-radius: 8px;
      margin-bottom: 1rem;
      border-left: 3px solid #4ecdc4;
    }
    .reading-question .code-preview {
      background: #0f0f1a;
      border-radius: 8px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.9rem;
      color: #eee;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    .reading-question .explanation {
      color: #ccc;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .reading-question .key-points {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .reading-question .key-point {
      background: #16213e;
      color: #4ecdc4;
      padding: 0.4rem 0.8rem;
      border-radius: 15px;
      font-size: 0.85rem;
    }
    .reading-nav {
      display: flex;
      justify-content: space-between;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #16213e;
    }
    .reading-nav button {
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.3s ease;
    }
    .reading-nav .prev-btn {
      background: #16213e;
      color: #fff;
    }
    .reading-nav .next-btn {
      background: #e94560;
      color: #fff;
    }
    .reading-nav button:hover {
      transform: translateY(-2px);
    }
    .reading-nav button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .reading-progress {
      margin-top: 1rem;
      height: 4px;
      background: #16213e;
      border-radius: 2px;
      overflow: hidden;
    }
    .reading-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #e94560, #4ecdc4);
      transition: width 0.3s ease;
    }

    /* ========================================
       Monaco Editor 代码预览弹窗样式
       ======================================== */
    .code-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      padding: 0;
    }
    .code-modal.active {
      display: flex;
      flex-direction: column;
    }
    .code-modal-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: #1e1e1e;
    }
    /* VS Code 风格标题栏 */
    .code-modal-titlebar {
      display: flex;
      align-items: center;
      background: #323233;
      height: 35px;
      padding: 0 10px;
      border-bottom: 1px solid #1e1e1e;
    }
    .code-modal-titlebar .window-controls {
      display: flex;
      gap: 8px;
      margin-right: 15px;
    }
    .code-modal-titlebar .window-btn {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
    }
    .code-modal-titlebar .window-btn.close { background: #ff5f56; }
    .code-modal-titlebar .window-btn.minimize { background: #ffbd2e; }
    .code-modal-titlebar .window-btn.maximize { background: #27ca40; }
    .code-modal-titlebar .title-text {
      color: #cccccc;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    /* 文件标签栏 */
    .code-modal-tabs {
      display: flex;
      background: #252526;
      height: 35px;
      border-bottom: 1px solid #1e1e1e;
    }
    .code-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 15px;
      height: 100%;
      background: #1e1e1e;
      border-right: 1px solid #252526;
      color: #ffffff;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .code-tab .file-icon {
      width: 16px;
      height: 16px;
    }
    .code-tab .close-tab {
      opacity: 0;
      background: none;
      border: none;
      color: #cccccc;
      cursor: pointer;
      padding: 2px;
      font-size: 14px;
      line-height: 1;
      border-radius: 3px;
    }
    .code-tab:hover .close-tab {
      opacity: 1;
    }
    .code-tab .close-tab:hover {
      background: rgba(255,255,255,0.1);
    }
    /* 面包屑导航 */
    .code-breadcrumb {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 15px;
      background: #1e1e1e;
      border-bottom: 1px solid #2d2d2d;
      font-size: 12px;
      color: #888;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .code-breadcrumb span {
      color: #cccccc;
    }
    .code-breadcrumb .separator {
      color: #666;
    }
    /* 编辑器容器 */
    .monaco-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #monaco-editor {
      width: 100%;
      height: 100%;
    }
    /* 状态栏 */
    .code-statusbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 22px;
      background: #007acc;
      padding: 0 10px;
      font-size: 12px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .code-statusbar .left, .code-statusbar .right {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .code-statusbar .item {
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: default;
    }
    /* 语义信息面板 */
    .code-semantic-panel {
      background: #252526;
      padding: 10px 15px;
      border-bottom: 1px solid #1e1e1e;
      display: none;
    }
    .code-semantic-panel.active {
      display: block;
    }
    .code-semantic-panel p {
      margin: 0;
      color: #d4d4d4;
      font-size: 13px;
      line-height: 1.5;
    }
    .code-semantic-panel .layer-badge {
      display: inline-block;
      background: #0e639c;
      color: #fff;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      margin-left: 8px;
    }
    /* 加载和错误状态 */
    .code-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #888;
      font-size: 14px;
    }
    .code-loading .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #007acc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 15px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .code-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #f14c4c;
      font-size: 14px;
    }
    /* 高亮行装饰 */
    .highlighted-line {
      background: rgba(255, 213, 0, 0.15) !important;
    }
    .highlighted-glyph {
      background: #ffd500;
      width: 4px !important;
      margin-left: 3px;
    }

    /* 加载动画 */
    .code-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      color: #888;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #007acc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* 语义标签 */
    .semantic-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .semantic-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .semantic-tag {
      background: #333;
      color: #9cdcfe;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }

    /* VS Code 风格弹窗优化 */
    .code-modal-content.vscode-style {
      width: 95vw;
      max-width: 1600px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    /* 主内容区三栏布局 */
    .code-modal-body {
      flex: 1;
      display: flex;
      min-height: 0;
      background: #1e1e1e;
    }

    /* 编辑器区域 */
    .editor-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      position: relative;
    }

    .monaco-container {
      flex: 1;
      position: relative;
      min-height: 0;
    }
    #monaco-loading {
      position: absolute;
      inset: 0;
      background: #1e1e1e;
      z-index: 10;
    }

    /* 左侧符号大纲面板 */
    .outline-panel {
      width: 250px;
      background: #252526;
      border-right: 1px solid #3c3c3c;
      display: none;
      flex-direction: column;
    }
    .outline-panel.active {
      display: flex;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #2d2d30;
      border-bottom: 1px solid #3c3c3c;
      font-size: 12px;
      color: #ccc;
    }
    .panel-close {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 16px;
    }
    .panel-close:hover {
      color: #fff;
    }
    .outline-search {
      padding: 8px;
      border-bottom: 1px solid #3c3c3c;
    }
    .outline-search input {
      width: 100%;
      padding: 6px 8px;
      background: #3c3c3c;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      font-size: 12px;
    }
    .outline-search input:focus {
      outline: none;
      border-color: #007acc;
    }
    .outline-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .outline-item {
      display: flex;
      align-items: center;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 13px;
      color: #ccc;
      gap: 6px;
    }
    .outline-item:hover {
      background: #2a2d2e;
    }
    .outline-item.active {
      background: #094771;
    }
    .outline-icon {
      font-size: 14px;
    }
    .outline-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .outline-line {
      font-size: 11px;
      color: #888;
    }
    .outline-kind-function .outline-icon { color: #dcdcaa; }
    .outline-kind-class .outline-icon { color: #4ec9b0; }
    .outline-kind-interface .outline-icon { color: #4ec9b0; }
    .outline-kind-variable .outline-icon { color: #9cdcfe; }
    .outline-kind-constant .outline-icon { color: #4fc1ff; }
    .outline-kind-type .outline-icon { color: #4ec9b0; }

    /* 右侧 AI 面板 */
    .ai-panel {
      width: 350px;
      background: #252526;
      border-left: 1px solid #3c3c3c;
      display: none;
      flex-direction: column;
    }
    .ai-panel.active {
      display: flex;
    }
    .ai-chat {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .ai-welcome {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .ai-avatar {
      width: 36px;
      height: 36px;
      background: #0e639c;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .ai-message {
      background: #2d2d30;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      color: #ccc;
      line-height: 1.5;
    }
    .ai-message p {
      margin: 0 0 8px 0;
    }
    .ai-message p:last-child {
      margin-bottom: 0;
    }
    .ai-message ul {
      margin: 8px 0 0 0;
      padding-left: 18px;
    }
    .ai-message li {
      margin: 4px 0;
    }
    .ai-message code {
      background: #1e1e1e;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      font-size: 12px;
    }
    .ai-message pre {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }

    /* AI 对话消息 */
    .ai-msg {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }
    .ai-msg.user {
      flex-direction: row-reverse;
    }
    .ai-msg.user .ai-message {
      background: #0e639c;
    }
    .ai-msg .ai-avatar {
      width: 28px;
      height: 28px;
      font-size: 14px;
    }
    .ai-msg.user .ai-avatar {
      background: #4caf50;
    }

    /* 快捷问题按钮 */
    .quick-questions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid #3c3c3c;
    }
    .quick-questions button {
      padding: 4px 10px;
      background: #0e639c;
      border: none;
      border-radius: 12px;
      color: #fff;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .quick-questions button:hover {
      background: #1177bb;
    }

    /* AI 输入区 */
    .ai-input-area {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #3c3c3c;
      background: #2d2d30;
    }
    .ai-input-area textarea {
      flex: 1;
      padding: 8px 10px;
      background: #3c3c3c;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      font-size: 13px;
      resize: none;
      font-family: inherit;
    }
    .ai-input-area textarea:focus {
      outline: none;
      border-color: #007acc;
    }
    .ai-send-btn {
      padding: 8px 16px;
      background: #0e639c;
      border: none;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 13px;
    }
    .ai-send-btn:hover {
      background: #1177bb;
    }

    /* 选中代码浮动工具栏 */
    .selection-toolbar {
      position: absolute;
      background: #2d2d30;
      border: 1px solid #454545;
      border-radius: 6px;
      padding: 4px;
      display: flex;
      gap: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 100;
    }
    .selection-toolbar button {
      padding: 6px 10px;
      background: transparent;
      border: none;
      color: #ccc;
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .selection-toolbar button:hover {
      background: #094771;
      color: #fff;
    }

    /* 状态栏可点击项 */
    .status-item.clickable {
      cursor: pointer;
    }
    .status-item.clickable:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    /* AI 加载动画 */
    .ai-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      color: #888;
      font-size: 13px;
    }
    .ai-loading .loading-spinner {
      width: 16px;
      height: 16px;
      border-width: 2px;
    }

    /* 关键点列表 */
    .key-points {
      margin: 8px 0;
    }
    .key-point {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      font-size: 12px;
    }
    .key-point::before {
      content: '•';
      color: #4caf50;
    }

    /* 相关概念标签 */
    .concept-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }
    .concept-tag {
      padding: 2px 8px;
      background: #0e639c;
      border-radius: 10px;
      font-size: 11px;
      color: #fff;
    }

    /* ========================================
       智能悬浮解释框 - 选中代码自动显示
       ======================================== */
    .smart-hover-tooltip {
      position: fixed;
      max-width: 520px;
      max-height: 70vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid #4ecdc4;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(78, 205, 196, 0.15);
      z-index: 2147483647;
      overflow: hidden;
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }
    .smart-hover-tooltip.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .smart-hover-tooltip.loading {
      min-width: 280px;
      min-height: 120px;
    }

    /* 悬浮框头部 */
    .smart-hover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(90deg, rgba(233, 69, 96, 0.2), rgba(78, 205, 196, 0.2));
      border-bottom: 1px solid rgba(78, 205, 196, 0.3);
    }
    .smart-hover-header .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #4ecdc4;
    }
    .smart-hover-header .title .icon {
      font-size: 18px;
    }
    .smart-hover-header .close-btn {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .smart-hover-header .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    /* 悬浮框内容 */
    .smart-hover-content {
      padding: 16px;
      overflow-y: auto;
      max-height: calc(70vh - 50px);
    }

    /* 代码预览区 */
    .smart-hover-code {
      background: #0d1117;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      border: 1px solid #30363d;
      overflow-x: auto;
    }
    .smart-hover-code pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      color: #c9d1d9;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .smart-hover-code .line-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 11px;
      color: #8b949e;
    }

    /* 语义标签区 */
    .smart-hover-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }
    .smart-hover-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }
    .smart-hover-tag.async { background: #1f6feb; color: #fff; }
    .smart-hover-tag.function { background: #238636; color: #fff; }
    .smart-hover-tag.class { background: #8957e5; color: #fff; }
    .smart-hover-tag.interface { background: #bf8700; color: #fff; }
    .smart-hover-tag.loop { background: #da3633; color: #fff; }
    .smart-hover-tag.conditional { background: #f85149; color: #fff; }
    .smart-hover-tag.api { background: #3fb950; color: #fff; }
    .smart-hover-tag.error { background: #f85149; color: #fff; }
    .smart-hover-tag.import { background: #a371f7; color: #fff; }
    .smart-hover-tag.default { background: #484f58; color: #fff; }

    /* 分析区块 */
    .smart-hover-section {
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border-left: 3px solid #4ecdc4;
    }
    .smart-hover-section:last-child {
      margin-bottom: 0;
    }
    .smart-hover-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #e94560;
      margin-bottom: 8px;
    }
    .smart-hover-section-title .icon {
      font-size: 16px;
    }
    .smart-hover-section-content {
      font-size: 13px;
      color: #d4d4d4;
      line-height: 1.6;
    }
    .smart-hover-section-content .summary {
      margin-bottom: 6px;
    }
    .smart-hover-section-content .details {
      font-size: 12px;
      color: #9ca3af;
      padding-left: 10px;
      border-left: 2px solid #4b5563;
    }
    .smart-hover-section-content .layer-badge,
    .smart-hover-section-content .domain-badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-top: 6px;
      margin-right: 6px;
    }
    .smart-hover-section-content .layer-badge {
      background: rgba(78, 205, 196, 0.2);
      color: #4ecdc4;
    }
    .smart-hover-section-content .domain-badge {
      background: rgba(233, 69, 96, 0.2);
      color: #e94560;
    }
    .smart-hover-section-content .steps-list {
      margin: 8px 0 0 0;
      padding-left: 20px;
      font-size: 12px;
      color: #9ca3af;
    }
    .smart-hover-section-content .steps-list li {
      margin: 4px 0;
    }

    /* 局部作用 */
    .smart-hover-section.local-role {
      border-left-color: #4ecdc4;
    }
    .smart-hover-section.local-role .smart-hover-section-title { color: #4ecdc4; }

    /* 整体作用 */
    .smart-hover-section.global-role {
      border-left-color: #e94560;
    }
    .smart-hover-section.global-role .smart-hover-section-title { color: #e94560; }

    /* 工作原理 */
    .smart-hover-section.principle {
      border-left-color: #f0db4f;
    }
    .smart-hover-section.principle .smart-hover-section-title { color: #f0db4f; }

    /* 依赖库 */
    .smart-hover-section.dependencies {
      border-left-color: #a371f7;
    }
    .smart-hover-section.dependencies .smart-hover-section-title { color: #a371f7; }
    .dependency-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dependency-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px;
      background: rgba(163, 113, 247, 0.1);
      border-radius: 6px;
    }
    .dependency-item .name {
      font-weight: 600;
      color: #a371f7;
      font-family: monospace;
    }
    .dependency-item .desc {
      font-size: 12px;
      color: #aaa;
    }

    /* 调用关系 */
    .smart-hover-section.call-graph {
      border-left-color: #58a6ff;
    }
    .smart-hover-section.call-graph .smart-hover-section-title { color: #58a6ff; }
    .call-graph-visual {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .call-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: rgba(88, 166, 255, 0.15);
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      color: #58a6ff;
    }
    .call-arrow {
      color: #888;
      font-size: 16px;
    }
    .current-code {
      padding: 6px 12px;
      background: linear-gradient(135deg, #e94560, #4ecdc4);
      border-radius: 6px;
      color: #fff;
      font-weight: 600;
      font-size: 12px;
    }

    /* 文件关系 */
    .smart-hover-section.file-relations {
      border-left-color: #3fb950;
    }
    .smart-hover-section.file-relations .smart-hover-section-title { color: #3fb950; }
    .file-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .file-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: rgba(63, 185, 80, 0.15);
      border-radius: 4px;
      font-size: 11px;
      color: #3fb950;
      font-family: monospace;
    }

    /* 关键理解点 */
    .smart-hover-section.insights {
      border-left-color: #f0db4f;
      background: rgba(240, 219, 79, 0.05);
    }
    .smart-hover-section.insights .smart-hover-section-title { color: #f0db4f; }
    .insights-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .insights-list li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .insights-list li:last-child {
      border-bottom: none;
    }
    .insights-list li::before {
      content: '💡';
      font-size: 14px;
    }

    /* 加载状态 */
    .smart-hover-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      gap: 16px;
    }
    .smart-hover-loading .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(78, 205, 196, 0.2);
      border-top-color: #4ecdc4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .smart-hover-loading .text {
      color: #888;
      font-size: 13px;
    }

    /* 符号列表 */
    .smart-hover-symbols {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .symbol-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
    }
    .symbol-badge.function { color: #dcdcaa; }
    .symbol-badge.class { color: #4ec9b0; }
    .symbol-badge.interface { color: #4ec9b0; }
    .symbol-badge.variable { color: #9cdcfe; }
    .symbol-badge.type { color: #4ec9b0; }
  </style>
  <!-- Monaco Editor CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"></script>
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
        <option value="story">📖 业务故事</option>
        <option value="reading">📚 代码阅读</option>
        <option value="beginner">🎯 新手导览</option>
        <option value="flowchart">流程图</option>
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
    <div class="scenario-selector" id="scenario-selector">
      <label>场景:</label>
      <select id="scenario-select"></select>
    </div>
  </header>

  <!-- 面包屑导航 -->
  <div class="breadcrumb" id="breadcrumb"></div>

  <main>
    <!-- 新手导览视图 -->
    <div class="beginner-view" id="beginner-view">
      <div class="project-intro" id="beginner-intro"></div>
      <div class="module-cards" id="module-cards"></div>
    </div>

    <!-- 业务故事视图 -->
    <div class="story-view" id="story-view">
      <div class="story-header" id="story-header"></div>
      <div class="story-list" id="story-list"></div>
      <div class="story-detail" id="story-detail"></div>
    </div>

    <!-- 代码阅读引擎视图 -->
    <div class="reading-view" id="reading-view">
      <div class="reading-header" id="reading-header"></div>
      <div class="reading-paths" id="reading-paths"></div>
      <div class="reading-content" id="reading-content"></div>
    </div>

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
      <div class="flowchart-legend" id="flowchart-legend">
        <h3>流程图图例</h3>
        <div class="flowchart-legend-item"><span class="flow-shape entry"></span>入口点</div>
        <div class="flowchart-legend-item"><span class="flow-shape process"></span>处理过程</div>
        <div class="flowchart-legend-item"><span class="flow-shape subprocess"></span>子流程/类</div>
        <div class="flowchart-legend-item"><span class="flow-shape data"></span>数据/配置</div>
        <div class="flowchart-legend-item"><span class="flow-shape end"></span>结束</div>
        <p style="margin-top:0.5rem;color:#888;font-size:0.75rem">点击节点查看详情<br>选择场景切换流程</p>
      </div>
      <div class="flowchart-title" id="flowchart-title"></div>
    </section>

    <aside id="details-panel">
      <h2>详情</h2>
      <div id="node-details"></div>
    </aside>
  </main>

  <div id="search-results"></div>

  <!-- 代码预览弹窗 - VS Code 风格 + AI 辅助 -->
  <div class="code-modal" id="code-modal" onclick="closeCodeModal(event)">
    <div class="code-modal-content vscode-style" onclick="event.stopPropagation()">
      <!-- VS Code 标题栏 -->
      <div class="code-modal-titlebar">
        <div class="titlebar-left">
          <span class="titlebar-icon">📄</span>
          <span id="code-modal-title">Code Preview</span>
        </div>
        <div class="titlebar-actions">
          <button class="titlebar-btn" onclick="toggleOutline()" title="符号大纲">📋</button>
          <button class="titlebar-btn" onclick="toggleAIPanel()" title="AI 助手">🤖</button>
          <button class="titlebar-btn" onclick="toggleMinimap()" title="切换小地图">🗺️</button>
          <button class="titlebar-btn" onclick="toggleWordWrap()" title="切换自动换行">↩️</button>
          <button class="titlebar-btn close" onclick="closeCodeModal()" title="关闭">✕</button>
        </div>
      </div>

      <!-- VS Code 标签栏 -->
      <div class="code-modal-tabs">
        <div class="tab active" id="code-tab">
          <span class="tab-icon">📄</span>
          <span class="tab-name" id="code-modal-filename">loading...</span>
          <span class="tab-close" onclick="closeCodeModal()">×</span>
        </div>
      </div>

      <!-- 面包屑导航 -->
      <div class="code-modal-breadcrumb" id="code-modal-breadcrumb">
        <span class="breadcrumb-path" id="code-modal-filepath">loading...</span>
      </div>

      <!-- 主内容区 - 左中右布局 -->
      <div class="code-modal-body">
        <!-- 左侧：符号大纲面板 -->
        <div class="outline-panel" id="outline-panel">
          <div class="panel-header">
            <span>📋 符号大纲</span>
            <button class="panel-close" onclick="toggleOutline()">×</button>
          </div>
          <div class="outline-search">
            <input type="text" id="outline-search" placeholder="搜索符号..." oninput="filterOutline(this.value)">
          </div>
          <div class="outline-list" id="outline-list">
            <!-- 动态填充符号列表 -->
          </div>
        </div>

        <!-- 中间：代码编辑器区域 -->
        <div class="editor-area">
          <!-- 语义描述区 -->
          <div class="code-modal-semantic" id="code-modal-semantic" style="display:none"></div>

          <!-- Monaco Editor 容器 -->
          <div class="monaco-container" id="monaco-container">
            <div class="code-loading" id="monaco-loading">
              <div class="loading-spinner"></div>
              <span>Loading Monaco Editor...</span>
            </div>
          </div>

          <!-- 选中代码后的浮动操作栏 -->
          <div class="selection-toolbar" id="selection-toolbar" style="display:none">
            <button onclick="explainSelection()" title="AI 解释这段代码">🤖 解释</button>
            <button onclick="findReferences()" title="查找引用">🔍 引用</button>
            <button onclick="askAboutSelection()" title="提问">❓ 提问</button>
          </div>
        </div>

        <!-- 右侧：AI 助手面板 -->
        <div class="ai-panel" id="ai-panel">
          <div class="panel-header">
            <span>🤖 AI 代码助手</span>
            <button class="panel-close" onclick="toggleAIPanel()">×</button>
          </div>

          <!-- AI 对话区 -->
          <div class="ai-chat" id="ai-chat">
            <div class="ai-welcome">
              <div class="ai-avatar">🤖</div>
              <div class="ai-message">
                <p><strong>你好！我是 AI 代码助手</strong></p>
                <p>我可以帮你理解这份代码：</p>
                <ul>
                  <li>选中任意代码，点击"解释"</li>
                  <li>点击符号大纲中的函数/类</li>
                  <li>直接在下方输入问题</li>
                </ul>
              </div>
            </div>
            <div id="ai-messages">
              <!-- 动态填充 AI 对话 -->
            </div>
          </div>

          <!-- 快捷问题 -->
          <div class="quick-questions">
            <button onclick="quickAsk('这个文件是做什么的？')">📄 文件功能</button>
            <button onclick="quickAsk('核心逻辑是什么？')">💡 核心逻辑</button>
            <button onclick="quickAsk('有什么依赖？')">🔗 依赖关系</button>
            <button onclick="quickAsk('如何使用？')">📖 使用方法</button>
          </div>

          <!-- AI 输入区 -->
          <div class="ai-input-area">
            <textarea id="ai-input" placeholder="输入你的问题... (Enter 发送)" rows="2" onkeydown="handleAIInput(event)"></textarea>
            <button onclick="sendAIQuestion()" class="ai-send-btn">发送</button>
          </div>
        </div>
      </div>

      <!-- VS Code 状态栏 -->
      <div class="code-statusbar">
        <div class="statusbar-left">
          <span class="status-item" id="code-status-position">Ln 1, Col 1</span>
          <span class="status-item" id="code-status-selection"></span>
        </div>
        <div class="statusbar-right">
          <span class="status-item clickable" onclick="toggleAIPanel()" title="AI 助手">🤖 AI</span>
          <span class="status-item" id="code-status-language">TypeScript</span>
          <span class="status-item" id="code-status-encoding">UTF-8</span>
          <span class="status-item" id="code-status-lines">0 lines</span>
        </div>
      </div>

      <!-- 智能悬浮解释框 - 在 modal 内部以确保在最上层 -->
      <div class="smart-hover-tooltip" id="smart-hover-tooltip">
        <div class="smart-hover-header">
          <div class="title">
            <span class="icon">🧠</span>
            <span>智能代码解析</span>
          </div>
          <button class="close-btn" onclick="closeSmartHover()">×</button>
        </div>
        <div class="smart-hover-content" id="smart-hover-content">
          <!-- 动态填充分析内容 -->
        </div>
      </div>
    </div>
  </div>

  <script>
    // 状态
    let ontology = null;
    let archData = null;
    let flowchartData = null;
    let scenarios = [];
    let simulation = null;
    let svg, g, zoom;
    let currentView = 'story'; // 默认使用业务故事视图
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

        // 加载入口点和场景
        if (ontology.isEnhanced) {
          loadEntryPoints();
          loadScenarios();
          // 默认显示业务故事视图
          renderStoryView();
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

    // 加载场景列表
    async function loadScenarios() {
      try {
        const response = await fetch('/api/scenarios');
        const data = await response.json();
        scenarios = data.scenarios || [];

        const select = document.getElementById('scenario-select');
        select.innerHTML = scenarios.map(s =>
          '<option value="' + s.id + '" data-entry="' + (s.entryPoints[0] || '') + '">' + s.name + '</option>'
        ).join('');

        // 场景切换时重新渲染流程图
        select.addEventListener('change', () => {
          renderFlowchart();
        });
      } catch (error) {
        console.error('Failed to load scenarios:', error);
      }
    }

    // 渲染新手导览
    async function renderBeginnerGuide() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('beginner-view').classList.add('active');

      try {
        const response = await fetch('/api/beginner-guide');
        const guide = await response.json();

        // 渲染项目介绍
        const introHtml = \`
          <h1>\${guide.projectName}</h1>
          <div class="tagline">\${guide.tagline}</div>
          <div class="summary">\${guide.summary}</div>
        \`;
        document.getElementById('beginner-intro').innerHTML = introHtml;

        // 渲染卡片
        const cardsHtml = guide.cards.map(card => \`
          <div class="module-card" data-id="\${card.id}" onclick="toggleCard(this)">
            <span class="card-badge \${card.badge}">\${getBadgeLabel(card.badge)}</span>
            <div class="card-icon">\${card.icon}</div>
            <div class="card-title">\${card.title}</div>
            <div class="card-subtitle">\${card.subtitle}</div>
            <div class="card-explain">\${card.explain}</div>
            <div class="card-analogy">💡 \${card.analogy}</div>
            <div class="card-files">
              \${card.files.map(f => '<span>' + f + '</span>').join('')}
            </div>
            <div class="expand-details">
              <h4>📌 关键函数</h4>
              \${card.keyFunctions.length > 0 ? card.keyFunctions.map(fn => \`
                <div class="key-function">
                  <div class="func-name">\${fn.name}()</div>
                  <div class="func-desc">\${truncateText(fn.desc, 80)}</div>
                </div>
              \`).join('') : '<div style="color:#888;font-size:0.85rem">点击其他视图查看详细函数</div>'}
            </div>
          </div>
        \`).join('');

        document.getElementById('module-cards').innerHTML = cardsHtml;
      } catch (error) {
        console.error('Failed to load beginner guide:', error);
        document.getElementById('beginner-intro').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function getBadgeLabel(badge) {
      const labels = {
        core: '核心',
        tool: '工具',
        util: '辅助',
        ui: '界面'
      };
      return labels[badge] || badge;
    }

    function truncateText(text, maxLen) {
      if (!text) return '';
      return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    }

    function toggleCard(card) {
      card.classList.toggle('expanded');
    }

    function hideAllViews() {
      document.getElementById('beginner-view').classList.remove('active');
      document.getElementById('story-view').classList.remove('active');
      document.getElementById('reading-view').classList.remove('active');
      document.getElementById('sidebar').style.display = 'none';
      document.getElementById('graph-container').style.display = 'none';
    }

    // ========================================
    // 业务故事视图
    // ========================================
    let storyData = null;
    let currentStory = null;

    async function renderStoryView() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('story-view').classList.add('active');

      try {
        const response = await fetch('/api/story-guide');
        storyData = await response.json();

        // 渲染头部
        const headerHtml = \`
          <h1>📖 \${storyData.projectName}</h1>
          <p>\${storyData.projectDescription}</p>
        \`;
        document.getElementById('story-header').innerHTML = headerHtml;

        // 渲染故事卡片列表
        const listHtml = storyData.stories.map((story, index) => \`
          <div class="story-card \${index === 0 ? 'active' : ''}" data-id="\${story.id}" onclick="selectStory('\${story.id}')">
            <div class="story-icon">\${story.icon}</div>
            <h3>\${story.title}</h3>
            <p>\${story.description}</p>
          </div>
        \`).join('');
        document.getElementById('story-list').innerHTML = listHtml;

        // 默认显示第一个故事
        if (storyData.stories.length > 0) {
          showStoryDetail(storyData.stories[0]);
        }
      } catch (error) {
        console.error('Failed to load story guide:', error);
        document.getElementById('story-header').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function selectStory(storyId) {
      // 更新卡片样式
      document.querySelectorAll('.story-card').forEach(card => {
        card.classList.toggle('active', card.dataset.id === storyId);
      });

      // 找到并显示故事
      const story = storyData.stories.find(s => s.id === storyId);
      if (story) {
        showStoryDetail(story);
      }
    }

    function showStoryDetail(story) {
      currentStory = story;

      const stepsHtml = story.steps.map((step, index) => \`
        <div class="story-step" data-module="\${step.moduleId}" onclick="jumpToCode('\${step.moduleId}', \${step.lineRange ? step.lineRange.start : 1}, \${step.lineRange ? step.lineRange.end : 50})">
          <h4>\${index + 1}. \${step.title}</h4>
          <div class="step-story">\${step.story}</div>
          <div class="step-technical">\${step.technical}</div>
          <div class="step-code-link">📄 查看代码: \${step.moduleId}</div>
        </div>
      \`).join('');

      const takeawaysHtml = story.keyTakeaways.length > 0 ? \`
        <div class="story-takeaways">
          <h4>💡 核心要点</h4>
          <ul>
            \${story.keyTakeaways.map(t => '<li>' + t + '</li>').join('')}
          </ul>
        </div>
      \` : '';

      const relatedHtml = story.relatedStories.length > 0 ? \`
        <div style="margin-top:1.5rem; color:#888;">
          相关故事: \${story.relatedStories.map(id => {
            const related = storyData.stories.find(s => s.id === id);
            return related ? '<a href="javascript:selectStory(\\'' + id + '\\')" style="color:#4ecdc4">' + related.title + '</a>' : '';
          }).filter(Boolean).join(' | ')}
        </div>
      \` : '';

      const detailHtml = \`
        <h2>\${story.icon} \${story.title}</h2>
        <div class="story-steps">
          \${stepsHtml}
        </div>
        \${takeawaysHtml}
        \${relatedHtml}
      \`;

      document.getElementById('story-detail').innerHTML = detailHtml;
      document.getElementById('story-detail').classList.remove('hidden');
    }

    // ========================================
    // Monaco Editor 代码预览功能
    // ========================================
    let monacoEditor = null;
    let monacoLoaded = false;
    let monacoLoading = false;
    let currentDecorations = [];
    let currentModuleId = null;
    let editorOptions = {
      minimap: true,
      wordWrap: false
    };

    // 初始化 Monaco Editor
    async function initMonaco() {
      if (monacoLoaded) return Promise.resolve();
      if (monacoLoading) {
        return new Promise((resolve) => {
          const check = setInterval(() => {
            if (monacoLoaded) {
              clearInterval(check);
              resolve();
            }
          }, 100);
        });
      }

      monacoLoading = true;
      return new Promise((resolve, reject) => {
        require.config({
          paths: {
            'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
          }
        });

        require(['vs/editor/editor.main'], function() {
          // 定义自定义主题 - VS Code Dark+
          monaco.editor.defineTheme('vs-dark-custom', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
              { token: 'keyword', foreground: '569CD6' },
              { token: 'string', foreground: 'CE9178' },
              { token: 'number', foreground: 'B5CEA8' },
              { token: 'type', foreground: '4EC9B0' },
              { token: 'function', foreground: 'DCDCAA' },
              { token: 'variable', foreground: '9CDCFE' },
            ],
            colors: {
              'editor.background': '#1e1e1e',
              'editor.foreground': '#d4d4d4',
              'editor.lineHighlightBackground': '#2d2d30',
              'editor.selectionBackground': '#264f78',
              'editorLineNumber.foreground': '#858585',
              'editorLineNumber.activeForeground': '#c6c6c6',
              'editorCursor.foreground': '#aeafad',
              'editor.findMatchBackground': '#515c6a',
              'editor.findMatchHighlightBackground': '#ea5c0055',
            }
          });

          monacoLoaded = true;
          monacoLoading = false;
          resolve();
        });
      });
    }

    // 获取语言 ID
    function getLanguageId(language) {
      const langMap = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'csharp': 'csharp',
        'go': 'go',
        'rust': 'rust',
        'ruby': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'json': 'json',
        'yaml': 'yaml',
        'xml': 'xml',
        'markdown': 'markdown',
        'sql': 'sql',
        'shell': 'shell',
        'bash': 'shell',
        'powershell': 'powershell',
      };
      return langMap[language?.toLowerCase()] || 'plaintext';
    }

    // 跳转到代码
    async function jumpToCode(moduleId, startLine, endLine) {
      if (!moduleId) return;

      // 保存当前模块 ID 用于 AI 功能
      currentModuleId = moduleId;

      const modal = document.getElementById('code-modal');
      const container = document.getElementById('monaco-container');
      const loading = document.getElementById('monaco-loading');

      // 显示弹窗和加载状态
      modal.classList.add('active');
      loading.style.display = 'flex';

      // 设置默认行范围
      startLine = startLine || 1;
      endLine = endLine || startLine + 30;

      try {
        // 并行加载 Monaco 和代码数据
        const [_, response] = await Promise.all([
          initMonaco(),
          fetch('/api/code-preview?module=' + encodeURIComponent(moduleId) +
            '&start=1&end=99999')  // 加载完整文件
        ]);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load code');
        }

        const data = await response.json();

        // 更新标题和文件信息
        document.getElementById('code-modal-title').textContent = data.fileName + ' - Code Preview';
        document.getElementById('code-modal-filename').textContent = data.fileName;
        document.getElementById('code-modal-filepath').textContent = data.filePath;

        // 显示语义信息
        const semanticEl = document.getElementById('code-modal-semantic');
        if (data.semantic) {
          const layerLabels = {
            presentation: '表现层',
            business: '业务层',
            data: '数据层',
            infrastructure: '基础设施',
            crossCutting: '横切关注点'
          };
          const tags = data.semantic.tags?.slice(0, 3).map(t => '<span class="semantic-tag">' + t + '</span>').join('') || '';
          semanticEl.innerHTML = \`
            <div class="semantic-content">
              <p>\${data.semantic.description || ''}
              <span class="layer-badge">\${layerLabels[data.semantic.architectureLayer] || data.semantic.architectureLayer}</span></p>
              <div class="semantic-tags">\${tags}</div>
            </div>
          \`;
          semanticEl.style.display = 'block';
        } else {
          semanticEl.style.display = 'none';
        }

        // 组装完整代码
        const fullCode = data.lines.map(l => l.content).join('\\n');
        const language = getLanguageId(data.language);

        // 隐藏加载动画
        loading.style.display = 'none';

        // 创建或更新编辑器
        if (monacoEditor) {
          monacoEditor.dispose();
        }

        monacoEditor = monaco.editor.create(container, {
          value: fullCode,
          language: language,
          theme: 'vs-dark-custom',
          readOnly: true,
          automaticLayout: true,
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          minimap: {
            enabled: editorOptions.minimap,
            scale: 1,
            showSlider: 'mouseover'
          },
          wordWrap: editorOptions.wordWrap ? 'on' : 'off',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderWhitespace: 'selection',
          guides: {
            indentation: true,
            bracketPairs: true
          },
          bracketPairColorization: {
            enabled: true
          },
          padding: {
            top: 10,
            bottom: 10
          }
        });

        // 高亮目标行范围
        if (startLine && endLine && startLine !== 1) {
          currentDecorations = monacoEditor.deltaDecorations([], [
            {
              range: new monaco.Range(startLine, 1, endLine, 1),
              options: {
                isWholeLine: true,
                className: 'highlighted-line',
                glyphMarginClassName: 'highlighted-glyph',
                overviewRuler: {
                  color: '#ffd500',
                  position: monaco.editor.OverviewRulerLane.Full
                }
              }
            }
          ]);

          // 滚动到高亮行
          monacoEditor.revealLineInCenter(startLine);
        }

        // 更新状态栏
        document.getElementById('code-status-language').textContent = data.language || 'Unknown';
        document.getElementById('code-status-lines').textContent = data.totalLines + ' lines';

        // 渲染符号大纲
        if (data.symbols && data.symbols.length > 0) {
          renderOutline(data.symbols);
          // 默认打开大纲面板
          document.getElementById('outline-panel').classList.add('active');
        } else {
          renderOutline([]);
        }

        // 设置选区处理器
        setupSelectionHandler();

        // 监听光标位置变化
        monacoEditor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          document.getElementById('code-status-position').textContent =
            'Ln ' + pos.lineNumber + ', Col ' + pos.column;
        });

        // 监听选区变化（状态栏更新）
        monacoEditor.onDidChangeCursorSelection((e) => {
          const sel = e.selection;
          if (sel.isEmpty()) {
            document.getElementById('code-status-selection').textContent = '';
          } else {
            const lines = sel.endLineNumber - sel.startLineNumber + 1;
            const chars = monacoEditor.getModel().getValueInRange(sel).length;
            document.getElementById('code-status-selection').textContent =
              '(' + lines + ' lines, ' + chars + ' chars selected)';
          }
        });

      } catch (error) {
        loading.innerHTML = '<div class="code-error">❌ ' + error.message + '</div>';
      }
    }

    // 切换小地图
    function toggleMinimap() {
      editorOptions.minimap = !editorOptions.minimap;
      if (monacoEditor) {
        monacoEditor.updateOptions({
          minimap: { enabled: editorOptions.minimap }
        });
      }
    }

    // 切换自动换行
    function toggleWordWrap() {
      editorOptions.wordWrap = !editorOptions.wordWrap;
      if (monacoEditor) {
        monacoEditor.updateOptions({
          wordWrap: editorOptions.wordWrap ? 'on' : 'off'
        });
      }
    }

    // ========================================
    // 符号大纲面板功能
    // ========================================
    let currentSymbols = [];

    function toggleOutline() {
      const panel = document.getElementById('outline-panel');
      panel.classList.toggle('active');
    }

    function renderOutline(symbols) {
      currentSymbols = symbols || [];
      const list = document.getElementById('outline-list');

      if (!currentSymbols.length) {
        list.innerHTML = '<div style="padding: 12px; color: #888; font-size: 12px;">暂无符号信息</div>';
        return;
      }

      const kindIcons = {
        'function': '𝑓',
        'class': '𝐂',
        'interface': '𝐈',
        'method': '𝑚',
        'property': '𝑝',
        'variable': '𝑣',
        'constant': '𝑐',
        'type': '𝑇',
        'enum': '𝐄'
      };

      list.innerHTML = currentSymbols.map(s => \`
        <div class="outline-item outline-kind-\${s.kind}"
             data-line="\${s.line}"
             onclick="goToSymbol(\${s.line}, \${s.endLine || s.line}, '\${s.id}')">
          <span class="outline-icon">\${kindIcons[s.kind] || '•'}</span>
          <span class="outline-name" title="\${s.signature || s.name}">\${s.name}</span>
          <span class="outline-line">:\${s.line}</span>
        </div>
      \`).join('');
    }

    function filterOutline(query) {
      const items = document.querySelectorAll('.outline-item');
      const q = query.toLowerCase();

      items.forEach(item => {
        const name = item.querySelector('.outline-name').textContent.toLowerCase();
        item.style.display = name.includes(q) ? 'flex' : 'none';
      });
    }

    function goToSymbol(line, endLine, symbolId) {
      if (!monacoEditor) return;

      // 跳转到符号位置
      monacoEditor.revealLineInCenter(line);
      monacoEditor.setPosition({ lineNumber: line, column: 1 });

      // 高亮符号范围
      currentDecorations = monacoEditor.deltaDecorations(currentDecorations, [
        {
          range: new monaco.Range(line, 1, endLine || line, 1),
          options: {
            isWholeLine: true,
            className: 'highlighted-line',
            glyphMarginClassName: 'highlighted-glyph'
          }
        }
      ]);

      // 更新大纲中的激活项
      document.querySelectorAll('.outline-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.line) === line);
      });

      // 显示 AI 面板并解释该符号
      const symbol = currentSymbols.find(s => s.id === symbolId);
      if (symbol && symbol.semantic) {
        showSymbolExplanation(symbol);
      }
    }

    function showSymbolExplanation(symbol) {
      toggleAIPanel(true);
      const messagesEl = document.getElementById('ai-messages');

      const html = \`
        <div class="ai-msg">
          <div class="ai-avatar">🤖</div>
          <div class="ai-message">
            <p><strong>\${symbol.kind}: \${symbol.name}</strong></p>
            \${symbol.semantic?.description ? \`<p>\${symbol.semantic.description}</p>\` : ''}
            \${symbol.signature ? \`<pre><code>\${symbol.signature}</code></pre>\` : ''}
            \${symbol.semantic?.keyPoints ? \`
              <div class="key-points">
                \${symbol.semantic.keyPoints.map(p => \`<div class="key-point">\${p}</div>\`).join('')}
              </div>
            \` : ''}
          </div>
        </div>
      \`;
      messagesEl.innerHTML = html;
      scrollAIToBottom();
    }

    // ========================================
    // AI 助手面板功能
    // ========================================
    function toggleAIPanel(forceOpen) {
      const panel = document.getElementById('ai-panel');
      if (forceOpen === true) {
        panel.classList.add('active');
      } else {
        panel.classList.toggle('active');
      }
    }

    function handleAIInput(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAIQuestion();
      }
    }

    async function sendAIQuestion() {
      const input = document.getElementById('ai-input');
      const question = input.value.trim();
      if (!question) return;

      input.value = '';
      addUserMessage(question);
      await askAI(question);
    }

    function quickAsk(question) {
      addUserMessage(question);
      askAI(question);
    }

    function addUserMessage(text) {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += \`
        <div class="ai-msg user">
          <div class="ai-avatar">👤</div>
          <div class="ai-message">\${text}</div>
        </div>
      \`;
      scrollAIToBottom();
    }

    function addAIMessage(content) {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += \`
        <div class="ai-msg">
          <div class="ai-avatar">🤖</div>
          <div class="ai-message">\${content}</div>
        </div>
      \`;
      scrollAIToBottom();
    }

    function showAILoading() {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += \`
        <div class="ai-loading" id="ai-loading">
          <div class="loading-spinner"></div>
          <span>思考中...</span>
        </div>
      \`;
      scrollAIToBottom();
    }

    function hideAILoading() {
      const loading = document.getElementById('ai-loading');
      if (loading) loading.remove();
    }

    function scrollAIToBottom() {
      const chat = document.getElementById('ai-chat');
      chat.scrollTop = chat.scrollHeight;
    }

    async function askAI(question) {
      if (!currentModuleId) return;

      showAILoading();
      toggleAIPanel(true);

      try {
        // 获取当前选区或使用整个文件
        let startLine = 1, endLine = 100;
        if (monacoEditor) {
          const selection = monacoEditor.getSelection();
          if (selection && !selection.isEmpty()) {
            startLine = selection.startLineNumber;
            endLine = selection.endLineNumber;
          }
        }

        const response = await fetch(
          '/api/ai-explain?module=' + encodeURIComponent(currentModuleId) +
          '&start=' + startLine + '&end=' + endLine +
          '&question=' + encodeURIComponent(question)
        );

        const data = await response.json();
        hideAILoading();

        if (data.error) {
          addAIMessage('❌ ' + data.error);
          return;
        }

        // 构建 AI 响应
        let html = '';

        if (data.explanation) {
          html += '<p>' + data.explanation.summary + '</p>';

          if (data.explanation.detailed) {
            html += '<p>' + data.explanation.detailed.replace(/\\n/g, '<br>') + '</p>';
          }

          if (data.explanation.keyPoints?.length) {
            html += '<div class="key-points">';
            data.explanation.keyPoints.forEach(p => {
              html += '<div class="key-point">' + p + '</div>';
            });
            html += '</div>';
          }

          if (data.explanation.relatedConcepts?.length) {
            html += '<div class="concept-tags">';
            data.explanation.relatedConcepts.forEach(c => {
              html += '<span class="concept-tag">' + c + '</span>';
            });
            html += '</div>';
          }

          if (data.explanation.codeFlow?.length) {
            html += '<p><strong>代码流程:</strong></p><ul>';
            data.explanation.codeFlow.forEach(f => {
              html += '<li>' + f + '</li>';
            });
            html += '</ul>';
          }
        }

        if (data.suggestions?.length) {
          html += '<p><strong>建议:</strong></p>';
          data.suggestions.forEach(s => {
            const icon = s.type === 'warning' ? '⚠️' : s.type === 'tip' ? '💡' : 'ℹ️';
            html += '<p>' + icon + ' <strong>' + s.title + '</strong>: ' + s.description + '</p>';
          });
        }

        addAIMessage(html || '暂无更多信息');

      } catch (error) {
        hideAILoading();
        addAIMessage('❌ 请求失败: ' + error.message);
      }
    }

    // ========================================
    // 代码选区功能 + 智能悬浮框
    // ========================================
    let selectionTimeout = null;
    let smartHoverTimeout = null;
    let smartHoverAbortController = null;
    let lastSmartHoverSelection = null;

    function setupSelectionHandler() {
      if (!monacoEditor) return;

      monacoEditor.onDidChangeCursorSelection((e) => {
        clearTimeout(selectionTimeout);
        clearTimeout(smartHoverTimeout);

        const selection = e.selection;
        if (selection.isEmpty()) {
          document.getElementById('selection-toolbar').style.display = 'none';
          // 不自动关闭悬浮框，让用户可以继续阅读
          return;
        }

        // 检查是否选中了足够的内容（至少3个字符）
        const selectedText = monacoEditor.getModel().getValueInRange(selection);
        if (selectedText.trim().length < 3) {
          return;
        }

        // 延迟触发智能悬浮框，避免频繁请求
        smartHoverTimeout = setTimeout(() => {
          showSmartHover(selection);
        }, 500);
      });

      // 点击其他地方时关闭悬浮框
      document.addEventListener('click', (e) => {
        const tooltip = document.getElementById('smart-hover-tooltip');
        if (tooltip && !tooltip.contains(e.target) && !e.target.closest('.monaco-editor')) {
          closeSmartHover();
        }
      });
    }

    function showSelectionToolbar(selection) {
      const toolbar = document.getElementById('selection-toolbar');
      const container = document.getElementById('monaco-container');

      // 获取选区位置
      const pos = monacoEditor.getScrolledVisiblePosition({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn
      });

      if (!pos) return;

      toolbar.style.display = 'flex';
      toolbar.style.left = (pos.left + 50) + 'px';
      toolbar.style.top = (pos.top - 40) + 'px';
    }

    // ========================================
    // 智能悬浮解释框
    // ========================================
    async function showSmartHover(selection) {
      if (!monacoEditor || !currentModuleId) return;

      const selKey = selection.startLineNumber + '-' + selection.endLineNumber;
      if (lastSmartHoverSelection === selKey) return;
      lastSmartHoverSelection = selKey;

      // 取消之前的请求
      if (smartHoverAbortController) {
        smartHoverAbortController.abort();
      }
      smartHoverAbortController = new AbortController();

      const tooltip = document.getElementById('smart-hover-tooltip');
      const content = document.getElementById('smart-hover-content');

      // 显示加载状态
      tooltip.classList.add('loading', 'visible');
      content.innerHTML = \`
        <div class="smart-hover-loading">
          <div class="spinner"></div>
          <div class="text">🧠 正在分析代码语义...</div>
        </div>
      \`;

      // 定位悬浮框
      positionSmartHover(selection);

      try {
        const response = await fetch(
          '/api/smart-hover?module=' + encodeURIComponent(currentModuleId) +
          '&start=' + selection.startLineNumber +
          '&end=' + selection.endLineNumber,
          { signal: smartHoverAbortController.signal }
        );

        if (!response.ok) throw new Error('API 请求失败');

        const data = await response.json();
        tooltip.classList.remove('loading');
        renderSmartHoverContent(data);
      } catch (error) {
        if (error.name === 'AbortError') return;

        tooltip.classList.remove('loading');
        content.innerHTML = \`
          <div class="smart-hover-section">
            <div class="smart-hover-section-title">
              <span class="icon">❌</span>
              <span>分析失败</span>
            </div>
            <div class="smart-hover-section-content">
              \${error.message}
            </div>
          </div>
        \`;
      }
    }

    function positionSmartHover(selection) {
      const tooltip = document.getElementById('smart-hover-tooltip');
      const container = document.getElementById('monaco-container');
      const containerRect = container.getBoundingClientRect();

      // 获取选区结束位置
      const pos = monacoEditor.getScrolledVisiblePosition({
        lineNumber: selection.endLineNumber,
        column: selection.endColumn
      });

      if (!pos) return;

      // 计算绝对位置
      const left = containerRect.left + pos.left + 20;
      const top = containerRect.top + pos.top + 30;

      // 确保不超出视口
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const tooltipWidth = 520;
      const tooltipHeight = 400;

      let finalLeft = left;
      let finalTop = top;

      if (left + tooltipWidth > viewportWidth - 20) {
        finalLeft = viewportWidth - tooltipWidth - 20;
      }
      if (top + tooltipHeight > viewportHeight - 20) {
        finalTop = containerRect.top + pos.top - tooltipHeight - 10;
      }

      tooltip.style.left = Math.max(20, finalLeft) + 'px';
      tooltip.style.top = Math.max(20, finalTop) + 'px';
    }

    function renderSmartHoverContent(data) {
      const content = document.getElementById('smart-hover-content');

      let html = '';

      // 代码预览区
      if (data.codeSnippet) {
        const lines = data.codeSnippet.split('\\n').slice(0, 8);
        const preview = lines.join('\\n') + (lines.length < data.codeSnippet.split('\\n').length ? '\\n...' : '');
        html += \`
          <div class="smart-hover-code">
            <div class="line-info">
              <span>📍 行 \${data.startLine} - \${data.endLine}</span>
              <span>\${data.moduleId}</span>
            </div>
            <pre>\${escapeHtml(preview)}</pre>
          </div>
        \`;
      }

      // 符号列表
      if (data.symbols && data.symbols.length > 0) {
        html += '<div class="smart-hover-symbols">';
        data.symbols.forEach(s => {
          const iconMap = {
            function: '𝑓',
            class: '◇',
            interface: '◈',
            variable: '𝑥',
            type: '𝑇'
          };
          html += \`<span class="symbol-badge \${s.kind}">\${iconMap[s.kind] || '•'} \${s.name}</span>\`;
        });
        html += '</div>';
      }

      // 语义标签
      if (data.tags && data.tags.length > 0) {
        html += '<div class="smart-hover-tags">';
        data.tags.forEach(tag => {
          const tagClass = tag.toLowerCase().replace(/[^a-z]/g, '');
          html += \`<span class="smart-hover-tag \${tagClass || 'default'}">\${tag}</span>\`;
        });
        html += '</div>';
      }

      // 局部作用
      if (data.analysis?.localRole) {
        const local = data.analysis.localRole;
        const summary = typeof local === 'string' ? local : (local.summary || '');
        const details = typeof local === 'object' && local.details ? local.details : '';
        html += \`
          <div class="smart-hover-section local-role">
            <div class="smart-hover-section-title">
              <span class="icon">🎯</span>
              <span>局部作用</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">\${summary}</div>
              \${details ? '<div class="details">' + details + '</div>' : ''}
            </div>
          </div>
        \`;
      }

      // 整体作用
      if (data.analysis?.globalRole) {
        const global = data.analysis.globalRole;
        const summary = typeof global === 'string' ? global : (global.summary || '');
        const layer = typeof global === 'object' && global.architectureLayer ? global.architectureLayer : '';
        const domain = typeof global === 'object' && global.businessDomain ? global.businessDomain : '';
        html += \`
          <div class="smart-hover-section global-role">
            <div class="smart-hover-section-title">
              <span class="icon">🌐</span>
              <span>项目中的角色</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">\${summary}</div>
              \${layer ? '<div class="layer-badge">' + layer + '</div>' : ''}
              \${domain ? '<div class="domain-badge">' + domain + '</div>' : ''}
            </div>
          </div>
        \`;
      }

      // 工作原理
      if (data.analysis?.workingPrinciple) {
        const principle = data.analysis.workingPrinciple;
        const summary = typeof principle === 'string' ? principle : (principle.summary || '');
        const steps = typeof principle === 'object' && principle.steps ? principle.steps : [];
        html += \`
          <div class="smart-hover-section principle">
            <div class="smart-hover-section-title">
              <span class="icon">⚙️</span>
              <span>工作原理</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">\${summary}</div>
              \${steps.length > 0 ? '<ol class="steps-list">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' : ''}
            </div>
          </div>
        \`;
      }

      // 依赖库
      const deps = data.analysis?.dependencies;
      const depsList = deps ? (deps.externalLibs || deps.imports || (Array.isArray(deps) ? deps : [])) : [];
      if (depsList.length > 0) {
        html += \`
          <div class="smart-hover-section dependencies">
            <div class="smart-hover-section-title">
              <span class="icon">📦</span>
              <span>依赖库</span>
            </div>
            <div class="dependency-list">
        \`;
        depsList.forEach(dep => {
          const name = typeof dep === 'string' ? dep : (dep.name || dep);
          const desc = typeof dep === 'object' ? (dep.description || dep.desc || '') : '';
          html += \`
            <div class="dependency-item">
              <div class="name">\${name}</div>
              \${desc ? '<div class="desc">' + desc + '</div>' : ''}
            </div>
          \`;
        });
        html += '</div></div>';
      }

      // 调用关系
      if (data.analysis?.callGraph) {
        const cg = data.analysis.callGraph;
        if (cg.callers?.length > 0 || cg.callees?.length > 0) {
          html += \`
            <div class="smart-hover-section call-graph">
              <div class="smart-hover-section-title">
                <span class="icon">🔗</span>
                <span>调用关系</span>
              </div>
              <div class="call-graph-visual">
          \`;

          // 调用者
          if (cg.callers?.length > 0) {
            cg.callers.slice(0, 3).forEach(c => {
              html += \`<span class="call-item">⬅ \${c}</span>\`;
            });
            if (cg.callers.length > 3) {
              html += \`<span class="call-item">+\${cg.callers.length - 3}</span>\`;
            }
            html += '<span class="call-arrow">→</span>';
          }

          html += '<span class="current-code">当前代码</span>';

          // 被调用者
          if (cg.callees?.length > 0) {
            html += '<span class="call-arrow">→</span>';
            cg.callees.slice(0, 3).forEach(c => {
              html += \`<span class="call-item">\${c} ➡</span>\`;
            });
            if (cg.callees.length > 3) {
              html += \`<span class="call-item">+\${cg.callees.length - 3}</span>\`;
            }
          }

          html += '</div></div>';
        }
      }

      // 文件关系
      if (data.analysis?.fileRelations && data.analysis.fileRelations.length > 0) {
        html += \`
          <div class="smart-hover-section file-relations">
            <div class="smart-hover-section-title">
              <span class="icon">📁</span>
              <span>相关文件</span>
            </div>
            <div class="file-list">
        \`;
        data.analysis.fileRelations.slice(0, 6).forEach(f => {
          const fileName = f.split('/').pop();
          html += \`<span class="file-item">📄 \${fileName}</span>\`;
        });
        if (data.analysis.fileRelations.length > 6) {
          html += \`<span class="file-item">+\${data.analysis.fileRelations.length - 6} 更多</span>\`;
        }
        html += '</div></div>';
      }

      // 关键理解点
      if (data.keyInsights && data.keyInsights.length > 0) {
        html += \`
          <div class="smart-hover-section insights">
            <div class="smart-hover-section-title">
              <span class="icon">💡</span>
              <span>快速理解</span>
            </div>
            <ul class="insights-list">
        \`;
        data.keyInsights.forEach(insight => {
          html += \`<li>\${insight}</li>\`;
        });
        html += '</ul></div>';
      }

      content.innerHTML = html;
    }

    function closeSmartHover() {
      const tooltip = document.getElementById('smart-hover-tooltip');
      tooltip.classList.remove('visible', 'loading');
      lastSmartHoverSelection = null;

      if (smartHoverAbortController) {
        smartHoverAbortController.abort();
        smartHoverAbortController = null;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function explainSelection() {
      if (!monacoEditor) return;

      const selection = monacoEditor.getSelection();
      if (!selection || selection.isEmpty()) return;

      const code = monacoEditor.getModel().getValueInRange(selection);
      document.getElementById('selection-toolbar').style.display = 'none';

      // 显示 AI 面板
      toggleAIPanel(true);
      addUserMessage('解释这段代码:\\n\`\`\`\\n' + code.substring(0, 200) + (code.length > 200 ? '...' : '') + '\\n\`\`\`');

      await askAI('请解释这段代码的作用');
    }

    async function findReferences() {
      if (!monacoEditor) return;

      const position = monacoEditor.getPosition();
      const word = monacoEditor.getModel().getWordAtPosition(position);

      if (!word) {
        addAIMessage('请将光标放在一个符号上');
        return;
      }

      document.getElementById('selection-toolbar').style.display = 'none';
      toggleAIPanel(true);

      // 查找匹配的符号
      const symbol = currentSymbols.find(s => s.name === word.word);
      if (symbol) {
        try {
          const response = await fetch('/api/symbol-refs?symbol=' + encodeURIComponent(symbol.id));
          const data = await response.json();

          let html = '<p><strong>符号引用: ' + word.word + '</strong></p>';

          if (data.callers?.length) {
            html += '<p>被以下位置调用 (' + data.totalCallers + '):</p><ul>';
            data.callers.slice(0, 5).forEach(c => {
              html += '<li>' + c.callerName + ' @ ' + c.callerModule + '</li>';
            });
            if (data.totalCallers > 5) {
              html += '<li>...还有 ' + (data.totalCallers - 5) + ' 处</li>';
            }
            html += '</ul>';
          }

          if (data.callees?.length) {
            html += '<p>调用了以下符号 (' + data.totalCallees + '):</p><ul>';
            data.callees.slice(0, 5).forEach(c => {
              html += '<li>' + c.calleeName + ' @ ' + c.calleeModule + '</li>';
            });
            if (data.totalCallees > 5) {
              html += '<li>...还有 ' + (data.totalCallees - 5) + ' 处</li>';
            }
            html += '</ul>';
          }

          if (!data.callers?.length && !data.callees?.length) {
            html += '<p>未找到引用关系</p>';
          }

          addAIMessage(html);
        } catch (error) {
          addAIMessage('❌ 查询失败: ' + error.message);
        }
      } else {
        addAIMessage('未找到符号 "' + word.word + '" 的定义信息');
      }
    }

    function askAboutSelection() {
      document.getElementById('selection-toolbar').style.display = 'none';
      toggleAIPanel(true);
      document.getElementById('ai-input').focus();
    }

    function closeCodeModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('code-modal').classList.remove('active');
      document.getElementById('outline-panel').classList.remove('active');
      document.getElementById('ai-panel').classList.remove('active');
      document.getElementById('ai-messages').innerHTML = '';

      // 关闭智能悬浮框
      closeSmartHover();

      // 清理编辑器以释放资源
      if (monacoEditor) {
        monacoEditor.dispose();
        monacoEditor = null;
      }
    }

    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSmartHover();
        closeCodeModal();
      }
    });

    // ========================================
    // 代码阅读引擎视图
    // ========================================
    let readingData = null;
    let currentPath = null;
    let currentStepIndex = 0;

    async function renderReadingView() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('reading-view').classList.add('active');

      try {
        const response = await fetch('/api/reading-guide');
        readingData = await response.json();

        // 渲染头部
        const headerHtml = \`
          <h1>📚 代码阅读引擎</h1>
          <p>选择一条学习路径，跟随引导理解代码</p>
        \`;
        document.getElementById('reading-header').innerHTML = headerHtml;

        // 渲染学习路径
        const pathsHtml = readingData.paths.map((path, index) => \`
          <div class="reading-path \${index === 0 ? 'active' : ''}" data-id="\${path.id}" onclick="selectReadingPath('\${path.id}')">
            <h3>\${path.title}</h3>
            <p>\${path.description}</p>
            <div class="path-meta">
              <span class="difficulty \${path.difficulty}">\${getDifficultyLabel(path.difficulty)}</span>
              <span class="time">⏱ \${path.estimatedTime}</span>
            </div>
          </div>
        \`).join('');
        document.getElementById('reading-paths').innerHTML = pathsHtml;

        // 默认显示第一个路径
        if (readingData.paths.length > 0) {
          showReadingPath(readingData.paths[0]);
        }
      } catch (error) {
        console.error('Failed to load reading guide:', error);
        document.getElementById('reading-header').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function getDifficultyLabel(difficulty) {
      const labels = {
        beginner: '入门',
        intermediate: '进阶',
        advanced: '高级'
      };
      return labels[difficulty] || difficulty;
    }

    function selectReadingPath(pathId) {
      // 更新路径样式
      document.querySelectorAll('.reading-path').forEach(p => {
        p.classList.toggle('active', p.dataset.id === pathId);
      });

      // 找到并显示路径
      const path = readingData.paths.find(p => p.id === pathId);
      if (path) {
        showReadingPath(path);
      }
    }

    function showReadingPath(path) {
      currentPath = path;
      currentStepIndex = 0;
      showReadingStep();
    }

    function showReadingStep() {
      if (!currentPath || !currentPath.steps.length) {
        document.getElementById('reading-content').innerHTML = '<p style="color:#888">这个路径暂无内容</p>';
        return;
      }

      const step = currentPath.steps[currentStepIndex];
      const totalSteps = currentPath.steps.length;
      const progress = ((currentStepIndex + 1) / totalSteps) * 100;

      const contentHtml = \`
        <div class="reading-question">
          <h3>❓ \${step.question}</h3>
          <div class="hint">💡 提示: \${step.hint}</div>
          <div class="code-preview">
            📄 \${step.codeLocation.moduleId} (行 \${step.codeLocation.lineStart}-\${step.codeLocation.lineEnd})
            <br><br>
            <a href="javascript:jumpToCode('\${step.codeLocation.moduleId}', \${step.codeLocation.lineStart}, \${step.codeLocation.lineEnd})" style="color:#e94560">点击查看代码 →</a>
          </div>
          <div class="explanation">\${step.explanation}</div>
          <div class="key-points">
            \${step.keyPoints.map(p => '<span class="key-point">' + p + '</span>').join('')}
          </div>
          \${step.nextQuestion ? '<p style="margin-top:1rem;color:#4ecdc4">下一步: ' + step.nextQuestion + '</p>' : ''}
        </div>
        <div class="reading-progress">
          <div class="reading-progress-bar" style="width: \${progress}%"></div>
        </div>
        <div style="text-align:center;color:#888;margin-top:0.5rem">
          步骤 \${currentStepIndex + 1} / \${totalSteps}
        </div>
        <div class="reading-nav">
          <button class="prev-btn" onclick="prevReadingStep()" \${currentStepIndex === 0 ? 'disabled' : ''}>← 上一步</button>
          <button class="next-btn" onclick="nextReadingStep()" \${currentStepIndex >= totalSteps - 1 ? 'disabled' : ''}>下一步 →</button>
        </div>
      \`;

      document.getElementById('reading-content').innerHTML = contentHtml;
      document.getElementById('reading-content').classList.remove('hidden');
    }

    function prevReadingStep() {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        showReadingStep();
      }
    }

    function nextReadingStep() {
      if (currentPath && currentStepIndex < currentPath.steps.length - 1) {
        currentStepIndex++;
        showReadingStep();
      }
    }

    // 渲染流程图
    async function renderFlowchart() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('sidebar').style.display = '';
      document.getElementById('graph-container').style.display = '';
      document.getElementById('flowchart-legend').classList.add('active');
      document.getElementById('flowchart-title').classList.add('active');
      document.getElementById('scenario-selector').classList.add('active');

      const scenarioSelect = document.getElementById('scenario-select');
      const scenario = scenarioSelect.value || 'default';
      const selectedOption = scenarioSelect.selectedOptions[0];
      const entryId = selectedOption ? selectedOption.dataset.entry : '';
      const depth = parseInt(document.getElementById('max-depth').value) || 5;

      try {
        const response = await fetch('/api/flowchart?scenario=' + scenario + '&entry=' + encodeURIComponent(entryId) + '&depth=' + depth);
        flowchartData = await response.json();

        // 更新标题
        const titleEl = document.getElementById('flowchart-title');
        titleEl.innerHTML = '<h2>' + flowchartData.title + '</h2><p>' + flowchartData.description + '</p>';

        // 渲染流程图
        renderFlowchartSvg(flowchartData);
      } catch (error) {
        console.error('Failed to load flowchart:', error);
        document.getElementById('flowchart-title').innerHTML = '<h2>加载失败</h2><p>' + error.message + '</p>';
      }
    }

    // 渲染流程图 SVG
    function renderFlowchartSvg(data) {
      // 初始化 SVG
      svg = d3.select('#graph')
        .attr('width', '100%')
        .attr('height', '100%');

      svg.selectAll('*').remove();

      // 设置缩放
      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      if (!data.nodes || data.nodes.length === 0) {
        g.append('text')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('fill', '#888')
          .text('暂无流程数据');
        return;
      }

      // 定义箭头标记
      const defs = g.append('defs');

      const arrowColors = {
        normal: '#4ecdc4',
        conditional: '#f39c12',
        loop: '#ff6b6b',
        async: '#9b59b6'
      };

      Object.entries(arrowColors).forEach(([type, color]) => {
        defs.append('marker')
          .attr('id', 'arrow-' + type)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 10)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', color);
      });

      // 节点尺寸
      const nodeWidth = 160;
      const nodeHeight = 50;

      // 绘制边
      const edges = g.selectAll('.flow-edge')
        .data(data.edges)
        .enter()
        .append('g')
        .attr('class', d => 'flow-edge-group');

      edges.append('path')
        .attr('class', d => 'flow-edge type-' + d.type)
        .attr('d', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          if (!source || !target) return '';

          const sx = source.x || 0;
          const sy = (source.y || 0) + nodeHeight / 2;
          const tx = target.x || 0;
          const ty = (target.y || 0) - nodeHeight / 2;

          // 使用贝塞尔曲线
          const midY = (sy + ty) / 2;
          return 'M' + sx + ',' + sy + ' C' + sx + ',' + midY + ' ' + tx + ',' + midY + ' ' + tx + ',' + ty;
        })
        .attr('marker-end', d => 'url(#arrow-' + d.type + ')');

      // 边标签
      edges.filter(d => d.label)
        .append('text')
        .attr('class', 'flow-edge-label')
        .attr('x', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          return ((source?.x || 0) + (target?.x || 0)) / 2;
        })
        .attr('y', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          return ((source?.y || 0) + (target?.y || 0)) / 2;
        })
        .attr('text-anchor', 'middle')
        .text(d => d.label);

      // 绘制节点
      const nodes = g.selectAll('.flow-node')
        .data(data.nodes)
        .enter()
        .append('g')
        .attr('class', d => 'flow-node type-' + d.type)
        .attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')')
        .on('click', (event, d) => {
          showFlowNodeDetails(d);
        });

      // 根据类型绘制不同形状
      nodes.each(function(d) {
        const node = d3.select(this);

        if (d.type === 'entry') {
          // 入口：圆角矩形
          node.append('rect')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 25);
        } else if (d.type === 'end') {
          // 结束：椭圆
          node.append('ellipse')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('rx', 40)
            .attr('ry', 20);
        } else if (d.type === 'decision') {
          // 判断：菱形
          node.append('polygon')
            .attr('points', '0,-30 50,0 0,30 -50,0');
        } else if (d.type === 'data') {
          // 数据：平行四边形
          node.append('polygon')
            .attr('points', (-nodeWidth/2 + 10) + ',-25 ' + (nodeWidth/2) + ',-25 ' + (nodeWidth/2 - 10) + ',25 ' + (-nodeWidth/2) + ',25');
        } else {
          // 默认处理：矩形
          node.append('rect')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 4);
        }

        // 节点标签
        node.append('text')
          .attr('y', d.type === 'end' ? 4 : -5)
          .text(d.label.length > 18 ? d.label.substring(0, 16) + '...' : d.label);

        // 节点描述（如果不是结束节点）
        if (d.type !== 'end' && d.description) {
          const desc = d.description.length > 25 ? d.description.substring(0, 23) + '...' : d.description;
          node.append('text')
            .attr('class', 'node-desc')
            .attr('y', 12)
            .text(desc);
        }
      });

      // 调整视图
      const bounds = g.node().getBBox();
      const padding = 50;
      svg.call(zoom.transform, d3.zoomIdentity
        .translate(svg.node().clientWidth / 2 - bounds.x - bounds.width / 2, padding)
        .scale(Math.min(1, (svg.node().clientHeight - padding * 2) / bounds.height, (svg.node().clientWidth - padding * 2) / bounds.width))
      );
    }

    // 显示流程节点详情
    function showFlowNodeDetails(node) {
      const panel = document.getElementById('details-panel');
      const details = document.getElementById('node-details');

      let html = '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + node.label + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + getNodeTypeName(node.type) + '</span></div>';

      if (node.description) {
        html += '<div class="info-item"><span class="info-label">描述:</span> <span class="info-value">' + node.description + '</span></div>';
      }

      if (node.moduleId) {
        html += '<div class="info-item"><span class="info-label">模块:</span> <span class="info-value">' + node.moduleId + '</span></div>';
      }

      if (node.layer) {
        html += '<div class="info-item"><span class="info-label">架构层:</span> <span class="info-value">' + getLayerName(node.layer) + '</span></div>';
      }

      details.innerHTML = html;
      panel.classList.add('active');
    }

    function getNodeTypeName(type) {
      const names = {
        entry: '入口点',
        process: '处理过程',
        subprocess: '子流程',
        data: '数据/配置',
        decision: '判断节点',
        end: '结束'
      };
      return names[type] || type;
    }

    function getLayerName(layer) {
      const names = {
        presentation: '表现层',
        business: '业务层',
        data: '数据层',
        infrastructure: '基础设施',
        crossCutting: '横切关注点'
      };
      return names[layer] || layer;
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
      document.getElementById('flowchart-legend').classList.remove('active');
      document.getElementById('flowchart-title').classList.remove('active');
      document.getElementById('scenario-selector').classList.remove('active');
    }

    // 返回按钮事件
    document.getElementById('back-btn').addEventListener('click', goBack);

    // 视图切换
    document.getElementById('view-mode').addEventListener('change', (e) => {
      currentView = e.target.value;
      hideAllIndicators();
      hideAllViews();

      // 清除下钻状态
      drillStack = [];
      currentDrillLevel = null;
      updateBreadcrumb();

      if (simulation) simulation.stop();

      if (currentView === 'story') {
        if (ontology.isEnhanced) {
          renderStoryView();
        } else {
          alert('业务故事需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'reading') {
        if (ontology.isEnhanced) {
          renderReadingView();
        } else {
          alert('代码阅读引擎需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'beginner') {
        if (ontology.isEnhanced) {
          renderBeginnerGuide();
        } else {
          alert('新手导览需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'flowchart') {
        if (ontology.isEnhanced) {
          renderFlowchart();
        } else {
          alert('流程图需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'architecture') {
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

// CLI 入口点 - 如果直接运行此文件
const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.js') ||
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].includes('map/server')
);

if (isMain) {
  const mapPath = process.argv[2] || 'CODE_MAP.json';
  const port = parseInt(process.argv[3] || '3030', 10);

  console.log('Starting server with map file:', mapPath);
  const server = createServer(mapPath, port);
  server.start().then(url => {
    console.log('Server started at:', url);
    console.log('Press Ctrl+C to stop');
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
