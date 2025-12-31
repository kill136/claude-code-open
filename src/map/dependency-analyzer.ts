/**
 * 依赖分析器
 * 分析模块之间的导入/依赖关系
 */

import * as path from 'path';
import {
  ModuleNode,
  DependencyGraph,
  DependencyEdge,
  ImportInfo,
} from './types.js';

// ============================================================================
// 模块路径解析规则
// ============================================================================

interface ResolutionConfig {
  extensions: string[];
  indexFiles: string[];
}

const RESOLUTION_CONFIG: Record<string, ResolutionConfig> = {
  typescript: {
    extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', ''],
    indexFiles: ['index.ts', 'index.tsx', 'index.js', 'index.jsx'],
  },
  javascript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs', ''],
    indexFiles: ['index.js', 'index.jsx', 'index.mjs'],
  },
  python: {
    extensions: ['.py', ''],
    indexFiles: ['__init__.py'],
  },
  go: {
    extensions: ['.go', ''],
    indexFiles: [],
  },
  default: {
    extensions: [''],
    indexFiles: [],
  },
};

// ============================================================================
// DependencyAnalyzer 类
// ============================================================================

export class DependencyAnalyzer {
  private moduleIndex: Map<string, ModuleNode> = new Map();
  private moduleIds: Set<string> = new Set();

  /**
   * 分析模块间的依赖关系
   */
  analyzeDependencies(modules: ModuleNode[]): DependencyGraph {
    // 建立模块索引
    this.buildModuleIndex(modules);

    const edges: DependencyEdge[] = [];

    for (const module of modules) {
      this.analyzeModuleDependencies(module, edges);
    }

    return { edges };
  }

  /**
   * 建立模块索引
   */
  private buildModuleIndex(modules: ModuleNode[]): void {
    this.moduleIndex.clear();
    this.moduleIds.clear();

    for (const module of modules) {
      this.moduleIndex.set(module.id, module);
      this.moduleIds.add(module.id);

      // 也索引不带扩展名的路径
      const withoutExt = module.id.replace(/\.[^/.]+$/, '');
      if (withoutExt !== module.id) {
        this.moduleIndex.set(withoutExt, module);
      }
    }
  }

  /**
   * 分析单个模块的依赖
   */
  private analyzeModuleDependencies(
    module: ModuleNode,
    edges: DependencyEdge[]
  ): void {
    for (const imp of module.imports) {
      const targetId = this.resolveImportTarget(
        imp.source,
        module.id,
        module.language
      );

      if (targetId) {
        edges.push({
          source: module.id,
          target: targetId,
          type: imp.isDynamic ? 'dynamic' : 'import',
          symbols: imp.symbols,
          isTypeOnly: this.isTypeOnlyImport(imp),
        });
      }
    }
  }

  /**
   * 解析导入目标模块
   */
  private resolveImportTarget(
    source: string,
    currentModuleId: string,
    language: string
  ): string | null {
    // 跳过外部依赖（不以 . 或 / 开头）
    if (!source.startsWith('.') && !source.startsWith('/')) {
      return null;
    }

    // 计算相对路径
    const currentDir = path.dirname(currentModuleId);
    let targetPath = path.posix.join(currentDir, source);

    // 规范化路径
    targetPath = this.normalizePath(targetPath);

    // 获取解析配置
    const config = RESOLUTION_CONFIG[language] || RESOLUTION_CONFIG.default;

    // 尝试各种扩展名
    for (const ext of config.extensions) {
      const candidate = targetPath + ext;

      if (this.moduleIds.has(candidate)) {
        return candidate;
      }
    }

    // 尝试 index 文件
    for (const indexFile of config.indexFiles) {
      const candidate = path.posix.join(targetPath, indexFile);

      if (this.moduleIds.has(candidate)) {
        return candidate;
      }
    }

    // 特殊处理：如果是目录导入，尝试匹配任何以该路径开头的模块
    for (const moduleId of this.moduleIds) {
      // 检查是否为该目录下的 index 文件
      if (moduleId.startsWith(targetPath + '/')) {
        const remaining = moduleId.slice(targetPath.length + 1);
        // 只匹配直接的 index 文件，不递归
        if (!remaining.includes('/') && remaining.startsWith('index.')) {
          return moduleId;
        }
      }
    }

    return null;
  }

  /**
   * 规范化路径
   */
  private normalizePath(p: string): string {
    // 处理 ../ 和 ./
    const parts = p.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.' && part !== '') {
        result.push(part);
      }
    }

    return result.join('/');
  }

  /**
   * 判断是否为纯类型导入
   */
  private isTypeOnlyImport(imp: ImportInfo): boolean {
    // TypeScript 的 type-only import
    // import type { Foo } from './foo'
    // import { type Foo } from './foo'
    return imp.symbols.some((s) => s.startsWith('type ')) || false;
  }

  /**
   * 获取依赖统计信息
   */
  getDependencyStats(graph: DependencyGraph): {
    totalEdges: number;
    internalDeps: number;
    typeOnlyDeps: number;
    dynamicDeps: number;
    mostDependent: Array<{ id: string; count: number }>;
    mostDepended: Array<{ id: string; count: number }>;
  } {
    const dependentCount = new Map<string, number>();
    const dependedCount = new Map<string, number>();
    let typeOnlyDeps = 0;
    let dynamicDeps = 0;

    for (const edge of graph.edges) {
      // 出度统计
      dependentCount.set(
        edge.source,
        (dependentCount.get(edge.source) || 0) + 1
      );

      // 入度统计
      dependedCount.set(
        edge.target,
        (dependedCount.get(edge.target) || 0) + 1
      );

      if (edge.isTypeOnly) typeOnlyDeps++;
      if (edge.type === 'dynamic') dynamicDeps++;
    }

    // 排序获取最多依赖的模块
    const mostDependent = Array.from(dependentCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    // 排序获取被依赖最多的模块
    const mostDepended = Array.from(dependedCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    return {
      totalEdges: graph.edges.length,
      internalDeps: graph.edges.length,
      typeOnlyDeps,
      dynamicDeps,
      mostDependent,
      mostDepended,
    };
  }

  /**
   * 检测循环依赖
   */
  detectCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const adjacencyList = new Map<string, string[]>();

    // 构建邻接表
    for (const edge of graph.edges) {
      const targets = adjacencyList.get(edge.source) || [];
      targets.push(edge.target);
      adjacencyList.set(edge.source, targets);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adjacencyList.get(node) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // 找到循环
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(neighbor); // 闭合循环
            cycles.push(cycle);
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    // 对每个节点运行 DFS
    for (const node of adjacencyList.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * 计算模块的依赖深度
   */
  calculateDependencyDepth(graph: DependencyGraph): Map<string, number> {
    const depths = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // 构建邻接表
    for (const edge of graph.edges) {
      const targets = adjacencyList.get(edge.source) || [];
      targets.push(edge.target);
      adjacencyList.set(edge.source, targets);
    }

    // 找到所有入口点（没有入边的节点）
    const hasIncoming = new Set<string>();
    for (const edge of graph.edges) {
      hasIncoming.add(edge.target);
    }

    const entryPoints = new Set<string>();
    for (const node of adjacencyList.keys()) {
      if (!hasIncoming.has(node)) {
        entryPoints.add(node);
      }
    }

    // BFS 计算深度
    const queue: Array<{ node: string; depth: number }> = [];

    for (const entry of entryPoints) {
      queue.push({ node: entry, depth: 0 });
    }

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      const currentDepth = depths.get(node);
      if (currentDepth !== undefined && currentDepth >= depth) {
        continue;
      }

      depths.set(node, depth);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        queue.push({ node: neighbor, depth: depth + 1 });
      }
    }

    return depths;
  }
}

/**
 * 便捷函数：分析依赖
 */
export function analyzeDependencies(modules: ModuleNode[]): DependencyGraph {
  const analyzer = new DependencyAnalyzer();
  return analyzer.analyzeDependencies(modules);
}
