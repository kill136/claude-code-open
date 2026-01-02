/**
 * 依赖分析服务
 * 负责入口点检测和依赖树构建
 */

import { EnhancedCodeBlueprint, ModuleDependency } from '../../types-enhanced.js';
import { DependencyTreeNode } from '../types.js';

/**
 * 检测项目入口点
 */
export function detectEntryPoints(blueprint: EnhancedCodeBlueprint): string[] {
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
        score += (entryPatterns.length - i) * 10;
        break;
      }
    }

    // 在根目录或 src 目录下的文件加分
    if (/^(src\/)?[^/]+\.(ts|js)$/.test(mod.id)) {
      score += 5;
    }

    // 不被任何其他模块导入的文件加分
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

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 5).map(c => c.id);
}

/**
 * 构建从入口点开始的依赖树
 */
export function buildDependencyTree(
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

    const deps = depsBySource.get(moduleId) || [];
    deps.sort((a, b) => a.target.localeCompare(b.target));

    for (const dep of deps) {
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
