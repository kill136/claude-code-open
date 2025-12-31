/**
 * 视图构建器
 * 构建目录树视图和架构分层视图
 */

import * as path from 'path';
import { ModuleNode } from './types.js';
import {
  DirectoryNode,
  ArchitectureLayers,
  LayerInfo,
  Views,
  ArchitectureLayer,
} from './types-enhanced.js';
import { LayerClassifier, ClassificationResult } from './layer-classifier.js';

// ============================================================================
// ViewBuilder 类
// ============================================================================

export class ViewBuilder {
  private classifier: LayerClassifier;

  constructor(classifier?: LayerClassifier) {
    this.classifier = classifier || new LayerClassifier();
  }

  /**
   * 构建两种视图
   */
  buildViews(modules: ModuleNode[]): Views {
    return {
      directoryTree: this.buildDirectoryTree(modules),
      architectureLayers: this.buildArchitectureLayers(modules),
    };
  }

  /**
   * 构建目录树视图
   */
  buildDirectoryTree(modules: ModuleNode[]): DirectoryNode {
    // 创建根节点
    const root: DirectoryNode = {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [],
    };

    // 按路径排序，确保父目录先处理
    const sortedModules = [...modules].sort((a, b) => a.id.localeCompare(b.id));

    // 目录节点缓存
    const dirCache = new Map<string, DirectoryNode>();
    dirCache.set('src', root);

    for (const module of sortedModules) {
      const relativePath = module.id;

      // 跳过非 src 开头的文件
      if (!relativePath.startsWith('src/') && !relativePath.startsWith('src\\')) {
        continue;
      }

      // 分割路径
      const parts = relativePath.split(/[/\\]/);
      let currentPath = '';
      let parentNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (i === 0 && part === 'src') {
          // 跳过根目录
          continue;
        }

        if (isLast) {
          // 文件节点
          const fileNode: DirectoryNode = {
            name: part,
            path: currentPath,
            type: 'file',
            moduleId: module.id,
          };
          parentNode.children = parentNode.children || [];
          parentNode.children.push(fileNode);
        } else {
          // 目录节点
          let dirNode = dirCache.get(currentPath);

          if (!dirNode) {
            dirNode = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
            dirCache.set(currentPath, dirNode);
            parentNode.children = parentNode.children || [];
            parentNode.children.push(dirNode);
          }

          parentNode = dirNode;
        }
      }
    }

    // 递归排序子节点
    this.sortDirectoryChildren(root);

    return root;
  }

  /**
   * 递归排序目录子节点
   * 目录在前，文件在后，各自按名称排序
   */
  private sortDirectoryChildren(node: DirectoryNode): void {
    if (!node.children) return;

    node.children.sort((a, b) => {
      // 目录优先
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // 同类型按名称排序
      return a.name.localeCompare(b.name);
    });

    // 递归处理子目录
    for (const child of node.children) {
      if (child.type === 'directory') {
        this.sortDirectoryChildren(child);
      }
    }
  }

  /**
   * 构建架构分层视图
   */
  buildArchitectureLayers(modules: ModuleNode[]): ArchitectureLayers {
    // 初始化各层
    const layers: ArchitectureLayers = {
      presentation: {
        description: LayerClassifier.getLayerDescription('presentation'),
        modules: [],
        subLayers: {},
      },
      business: {
        description: LayerClassifier.getLayerDescription('business'),
        modules: [],
        subLayers: {},
      },
      data: {
        description: LayerClassifier.getLayerDescription('data'),
        modules: [],
        subLayers: {},
      },
      infrastructure: {
        description: LayerClassifier.getLayerDescription('infrastructure'),
        modules: [],
        subLayers: {},
      },
      crossCutting: {
        description: LayerClassifier.getLayerDescription('crossCutting'),
        modules: [],
        subLayers: {},
      },
    };

    // 分类每个模块
    for (const module of modules) {
      const result = this.classifier.classify(module);
      const layer = layers[result.layer];

      layer.modules.push(module.id);

      // 添加到子分层
      if (result.subLayer) {
        if (!layer.subLayers) {
          layer.subLayers = {};
        }
        if (!layer.subLayers[result.subLayer]) {
          layer.subLayers[result.subLayer] = [];
        }
        layer.subLayers[result.subLayer].push(module.id);
      }
    }

    // 排序各层模块
    for (const layer of Object.values(layers)) {
      layer.modules.sort();
      if (layer.subLayers) {
        for (const subLayer of Object.values(layer.subLayers) as string[][]) {
          subLayer.sort();
        }
      }
    }

    return layers;
  }

  /**
   * 为目录树节点添加语义描述
   */
  addDirectoryDescriptions(
    tree: DirectoryNode,
    descriptions: Map<string, { description?: string; purpose?: string }>
  ): void {
    const addDesc = (node: DirectoryNode) => {
      const desc = descriptions.get(node.path);
      if (desc) {
        node.description = desc.description;
        node.purpose = desc.purpose;
      }

      if (node.children) {
        for (const child of node.children) {
          addDesc(child);
        }
      }
    };

    addDesc(tree);
  }

  /**
   * 为架构层添加语义描述
   */
  addLayerDescriptions(
    layers: ArchitectureLayers,
    descriptions: Partial<Record<ArchitectureLayer, string>>
  ): void {
    for (const [layer, desc] of Object.entries(descriptions)) {
      if (layers[layer as ArchitectureLayer]) {
        layers[layer as ArchitectureLayer].description = desc;
      }
    }
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 统计目录树的节点数量
 */
export function countTreeNodes(node: DirectoryNode): { directories: number; files: number } {
  let directories = 0;
  let files = 0;

  const count = (n: DirectoryNode) => {
    if (n.type === 'directory') {
      directories++;
    } else {
      files++;
    }

    if (n.children) {
      for (const child of n.children) {
        count(child);
      }
    }
  };

  count(node);
  return { directories, files };
}

/**
 * 查找目录树中的节点
 */
export function findTreeNode(
  root: DirectoryNode,
  targetPath: string
): DirectoryNode | null {
  if (root.path === targetPath) {
    return root;
  }

  if (root.children) {
    for (const child of root.children) {
      const found = findTreeNode(child, targetPath);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * 获取目录树的最大深度
 */
export function getTreeDepth(node: DirectoryNode, currentDepth = 0): number {
  if (!node.children || node.children.length === 0) {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of node.children) {
    const childDepth = getTreeDepth(child, currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

/**
 * 扁平化目录树为路径列表
 */
export function flattenTree(node: DirectoryNode): string[] {
  const paths: string[] = [node.path];

  if (node.children) {
    for (const child of node.children) {
      paths.push(...flattenTree(child));
    }
  }

  return paths;
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 快速构建视图
 */
export function buildViews(modules: ModuleNode[]): Views {
  const builder = new ViewBuilder();
  return builder.buildViews(modules);
}

/**
 * 快速构建目录树
 */
export function buildDirectoryTree(modules: ModuleNode[]): DirectoryNode {
  const builder = new ViewBuilder();
  return builder.buildDirectoryTree(modules);
}

/**
 * 快速构建架构分层
 */
export function buildArchitectureLayers(modules: ModuleNode[]): ArchitectureLayers {
  const builder = new ViewBuilder();
  return builder.buildArchitectureLayers(modules);
}
