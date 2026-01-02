/**
 * 架构分析服务
 * 负责构建逻辑架构图、模块详情、符号引用等
 */

import { EnhancedCodeBlueprint, EnhancedModule } from '../../types-enhanced.js';
import {
  ArchitectureMap,
  LogicBlock,
  ModuleDetailInfo,
  SymbolInfo,
  SymbolRefInfo,
} from '../types.js';

/**
 * 构建逻辑架构图
 * 将文件按目录结构和语义聚合成逻辑块
 */
export function buildArchitectureMap(blueprint: EnhancedCodeBlueprint): ArchitectureMap {
  const modules = Object.values(blueprint.modules);

  // 按目录分组
  const dirGroups = new Map<string, EnhancedModule[]>();
  for (const mod of modules) {
    const parts = mod.id.split('/');
    let dir: string;
    if (parts.length === 1) {
      dir = '.';
    } else if (parts.length === 2) {
      dir = parts[0];
    } else {
      dir = parts.slice(0, -1).join('/');
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
    let blockType: LogicBlock['type'] = 'util';
    let defaultName = dir.split('/').pop() || dir;

    for (const [pattern, type, name] of typePatterns) {
      if (pattern.test(dir)) {
        blockType = type;
        defaultName = name;
        break;
      }
    }

    const descriptions = mods
      .filter(m => m.semantic?.description)
      .map(m => m.semantic!.description);

    let description = descriptions[0] || `${defaultName}相关功能`;

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

  // 构建层次结构
  const rootBlocks: LogicBlock[] = [];
  const processedDirs = new Set<string>();

  const sortedBlocks = [...blocks].sort((a, b) => {
    const depthA = a.id.split('/').length;
    const depthB = b.id.split('/').length;
    return depthA - depthB;
  });

  for (const block of sortedBlocks) {
    const parts = block.id.split('/');
    if (parts.length <= 2 || block.id === '.' || block.id === 'src') {
      rootBlocks.push(block);
      processedDirs.add(block.id);
    } else {
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
    return b.fileCount - a.fileCount;
  });

  return {
    projectName: blueprint.project.name,
    projectDescription: blueprint.project.semantic?.description || '项目描述',
    blocks: rootBlocks,
  };
}

export function getDir(moduleId: string): string {
  const parts = moduleId.split('/');
  if (parts.length === 1) return '.';
  if (parts.length === 2) return parts[0];
  return parts.slice(0, -1).join('/');
}

/**
 * 获取模块详情（用于下钻展示）
 */
export function getModuleDetail(blueprint: EnhancedCodeBlueprint, moduleId: string): ModuleDetailInfo | null {
  const module = blueprint.modules[moduleId];
  if (!module) return null;

  const symbols: ModuleDetailInfo['symbols'] = {
    classes: [],
    interfaces: [],
    functions: [],
    types: [],
    variables: [],
    constants: [],
    exports: [],
  };

  // 从全局符号表中查找属于此模块的符号
  for (const symbol of Object.values(blueprint.symbols)) {
    if (symbol.moduleId !== moduleId) continue;

    const info: SymbolInfo = {
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      signature: symbol.signature,
      semantic: symbol.semantic,
      location: {
        startLine: symbol.location?.startLine || 0,
        endLine: symbol.location?.endLine || 0,
      },
      children: [],
    };

    // 添加子符号（方法、属性等）
    if (symbol.children) {
      info.children = symbol.children.map(childId => {
        const child = blueprint.symbols[childId];
        if (!child) return null;
        return {
          id: child.id,
          name: child.name,
          kind: child.kind as string,
          signature: child.signature,
          semantic: child.semantic,
          location: {
            startLine: child.location?.startLine || 0,
            endLine: child.location?.endLine || 0,
          },
          children: [],
        } as SymbolInfo;
      }).filter((c): c is SymbolInfo => c !== null);
    }

    // 分类符号
    switch (symbol.kind) {
      case 'class':
        symbols.classes.push(info);
        break;
      case 'interface':
        symbols.interfaces.push(info);
        break;
      case 'function':
        symbols.functions.push(info);
        break;
      case 'type':
        symbols.types.push(info);
        break;
      case 'variable':
        symbols.variables.push(info);
        break;
      case 'constant':
        symbols.constants.push(info);
        break;
      default:
        symbols.functions.push(info);
    }
  }

  // 解析导入
  const externalImports: string[] = [];
  const internalImports: string[] = [];

  for (const imp of module.imports || []) {
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
    symbols,
    externalImports: [...new Set(externalImports)],
    internalImports: [...new Set(internalImports)],
  };
}

/**
 * 获取符号引用信息
 */
export function getSymbolRefs(blueprint: EnhancedCodeBlueprint, symbolId: string): SymbolRefInfo | null {
  // 从全局符号表中查找符号
  const symbolEntry = blueprint.symbols[symbolId];
  if (!symbolEntry) return null;

  const refs: SymbolRefInfo = {
    symbolId,
    symbolName: symbolEntry.name,
    symbolKind: symbolEntry.kind,
    moduleId: symbolEntry.moduleId,
    calledBy: [],
    calls: [],
    typeRefs: [],
  };

  // 从 blueprint.references.symbolCalls 中查找调用关系
  for (const call of blueprint.references.symbolCalls || []) {
    if (call.callee === symbolId) {
      const callerSymbol = blueprint.symbols[call.caller];
      refs.calledBy.push({
        symbolId: call.caller,
        symbolName: callerSymbol?.name || call.caller.split('::').pop() || '',
        moduleId: callerSymbol?.moduleId || '',
        callType: call.callType,
        locations: call.locations?.map(loc => ({ line: loc.startLine })) || [],
      });
    }
    if (call.caller === symbolId) {
      const calleeSymbol = blueprint.symbols[call.callee];
      refs.calls.push({
        symbolId: call.callee,
        symbolName: calleeSymbol?.name || call.callee.split('::').pop() || '',
        moduleId: calleeSymbol?.moduleId || '',
        callType: call.callType,
        locations: call.locations?.map(loc => ({ line: loc.startLine })) || [],
      });
    }
  }

  // 查找类型引用（extends/implements）
  for (const typeRef of blueprint.references.typeRefs || []) {
    if (typeRef.child === symbolId) {
      const parentSymbol = blueprint.symbols[typeRef.parent];
      refs.typeRefs.push({
        relatedSymbolId: typeRef.parent,
        relatedSymbolName: parentSymbol?.name || '',
        kind: typeRef.kind,
        direction: 'parent',
      });
    }
    if (typeRef.parent === symbolId) {
      const childSymbol = blueprint.symbols[typeRef.child];
      refs.typeRefs.push({
        relatedSymbolId: typeRef.child,
        relatedSymbolName: childSymbol?.name || '',
        kind: typeRef.kind,
        direction: 'child',
      });
    }
  }

  return refs;
}
