/**
 * 本体生成器
 * 协调分析器和构建器，生成完整的代码本体图谱
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeMapAnalyzer } from './analyzer.js';
import {
  CodeOntology,
  ModuleNode,
  CallGraph,
  DependencyGraph,
  DependencyEdge,
  OntologyStatistics,
  ProjectInfo,
  GenerateOptions,
  ProgressCallback,
  AnalysisProgress,
} from './types.js';

const VERSION = '1.0.0';

// ============================================================================
// OntologyGenerator 类
// ============================================================================

export class OntologyGenerator {
  private rootPath: string;
  private options: GenerateOptions;
  private analyzer: CodeMapAnalyzer;

  constructor(rootPath: string, options: GenerateOptions = {}) {
    this.rootPath = path.resolve(rootPath);
    this.options = {
      include: options.include,
      exclude: options.exclude,
      depth: options.depth || 3,
      incremental: options.incremental ?? true,
      useLSP: options.useLSP ?? false,
      outputPath: options.outputPath || path.join(rootPath, 'CODE_MAP.json'),
      concurrency: options.concurrency || 10,
    };

    this.analyzer = new CodeMapAnalyzer(rootPath, {
      include: this.options.include,
      exclude: this.options.exclude,
      concurrency: this.options.concurrency,
    });
  }

  /**
   * 生成完整的代码本体图谱
   */
  async generate(onProgress?: ProgressCallback): Promise<CodeOntology> {
    // 1. 发现文件
    if (onProgress) {
      onProgress({ phase: 'discover', current: 0, total: 0 });
    }

    const files = await this.analyzer.discoverFiles();

    if (onProgress) {
      onProgress({ phase: 'discover', current: files.length, total: files.length });
    }

    // 2. 分析文件
    const modules = await this.analyzer.analyzeFiles(files, onProgress);

    // 3. 构建依赖图
    if (onProgress) {
      onProgress({ phase: 'dependencies', current: 0, total: modules.length });
    }

    const dependencyGraph = this.buildDependencyGraph(modules);

    // 4. 构建调用图
    if (onProgress) {
      onProgress({ phase: 'calls', current: 0, total: modules.length });
    }

    const callGraph = this.buildCallGraph(modules);

    // 5. 生成统计信息
    if (onProgress) {
      onProgress({ phase: 'aggregate', current: 0, total: 1 });
    }

    const statistics = this.calculateStatistics(modules, callGraph, dependencyGraph);
    const projectInfo = this.getProjectInfo(modules);

    // 6. 聚合本体
    const ontology: CodeOntology = {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      project: projectInfo,
      modules,
      callGraph,
      dependencyGraph,
      statistics,
    };

    if (onProgress) {
      onProgress({ phase: 'aggregate', current: 1, total: 1 });
    }

    return ontology;
  }

  /**
   * 生成并保存到文件
   */
  async generateAndSave(onProgress?: ProgressCallback): Promise<string> {
    const ontology = await this.generate(onProgress);
    const outputPath = this.options.outputPath!;

    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入 JSON 文件
    fs.writeFileSync(outputPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return outputPath;
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(modules: ModuleNode[]): DependencyGraph {
    const edges: DependencyEdge[] = [];
    const moduleIds = new Set(modules.map((m) => m.id));

    for (const module of modules) {
      for (const imp of module.imports) {
        // 尝试解析导入目标
        const targetId = this.resolveImportTarget(imp.source, module.id, moduleIds);

        if (targetId) {
          edges.push({
            source: module.id,
            target: targetId,
            type: imp.isDynamic ? 'dynamic' : 'import',
            symbols: imp.symbols,
            isTypeOnly: imp.source.includes('type') || false,
          });
        }
      }
    }

    return { edges };
  }

  /**
   * 解析导入目标模块
   */
  private resolveImportTarget(
    source: string,
    currentModuleId: string,
    moduleIds: Set<string>
  ): string | null {
    // 跳过外部依赖
    if (!source.startsWith('.') && !source.startsWith('/')) {
      return null;
    }

    // 计算相对路径
    const currentDir = path.dirname(currentModuleId);
    let targetPath = path.posix.join(currentDir, source);

    // 尝试不同的扩展名
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const candidate = targetPath + ext;
      const normalized = candidate.replace(/\\/g, '/');

      if (moduleIds.has(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * 构建调用图（基础版 - AST 分析）
   */
  private buildCallGraph(modules: ModuleNode[]): CallGraph {
    const nodes: CallGraph['nodes'] = [];
    const edges: CallGraph['edges'] = [];
    const functionMap = new Map<string, string>(); // name -> id

    // 1. 收集所有函数/方法节点
    for (const module of modules) {
      // 顶层函数
      for (const func of module.functions) {
        nodes.push({
          id: func.id,
          name: func.name,
          type: 'function',
          moduleId: module.id,
          signature: func.signature,
        });
        functionMap.set(func.name, func.id);
      }

      // 类方法
      for (const cls of module.classes) {
        for (const method of cls.methods) {
          nodes.push({
            id: method.id,
            name: method.name,
            type: 'method',
            moduleId: module.id,
            className: cls.name,
            signature: method.signature,
          });
          // 使用 ClassName.methodName 作为键
          functionMap.set(`${cls.name}.${method.name}`, method.id);
        }
      }
    }

    // 2. 分析调用关系（这里使用简化的正则匹配）
    // 完整实现应该使用 AST 遍历
    // TODO: 集成 call-graph-builder.ts 进行更精确的分析

    return { nodes, edges };
  }

  /**
   * 获取项目信息
   */
  private getProjectInfo(modules: ModuleNode[]): ProjectInfo {
    const languages = new Set<string>();
    let totalLines = 0;

    for (const module of modules) {
      languages.add(module.language);
      totalLines += module.lines;
    }

    // 尝试从 package.json 获取项目名
    let projectName = path.basename(this.rootPath);
    try {
      const pkgPath = path.join(this.rootPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        projectName = pkg.name || projectName;
      }
    } catch {
      // 忽略
    }

    return {
      name: projectName,
      rootPath: this.rootPath,
      languages: Array.from(languages),
      fileCount: modules.length,
      totalLines,
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    modules: ModuleNode[],
    callGraph: CallGraph,
    dependencyGraph: DependencyGraph
  ): OntologyStatistics {
    let totalClasses = 0;
    let totalInterfaces = 0;
    let totalFunctions = 0;
    let totalMethods = 0;
    let totalVariables = 0;
    let totalLines = 0;

    const languageBreakdown: Record<string, number> = {};
    const fileStats: Array<{ path: string; lines: number; size: number }> = [];

    for (const module of modules) {
      totalClasses += module.classes.length;
      totalInterfaces += module.interfaces.length;
      totalFunctions += module.functions.length;
      totalVariables += module.variables.length;
      totalLines += module.lines;

      for (const cls of module.classes) {
        totalMethods += cls.methods.length;
      }

      languageBreakdown[module.language] = (languageBreakdown[module.language] || 0) + 1;

      fileStats.push({
        path: module.id,
        lines: module.lines,
        size: module.size,
      });
    }

    // 排序获取最大文件
    fileStats.sort((a, b) => b.lines - a.lines);
    const largestFiles = fileStats.slice(0, 10);

    // 计算被调用最多的函数
    const callCounts = new Map<string, number>();
    for (const edge of callGraph.edges) {
      callCounts.set(edge.target, (callCounts.get(edge.target) || 0) + edge.count);
    }

    const mostCalledFunctions = Array.from(callCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const node = callGraph.nodes.find((n) => n.id === id);
        return {
          id,
          name: node?.name || id.split('::').pop() || id,
          callCount: count,
        };
      });

    // 计算被导入最多的模块
    const importCounts = new Map<string, number>();
    for (const edge of dependencyGraph.edges) {
      importCounts.set(edge.target, (importCounts.get(edge.target) || 0) + 1);
    }

    const mostImportedModules = Array.from(importCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, importCount: count }));

    return {
      totalModules: modules.length,
      totalClasses,
      totalInterfaces,
      totalFunctions,
      totalMethods,
      totalVariables,
      totalCallEdges: callGraph.edges.length,
      totalDependencyEdges: dependencyGraph.edges.length,
      totalLines,
      languageBreakdown,
      largestFiles,
      mostCalledFunctions,
      mostImportedModules,
    };
  }
}

/**
 * 便捷函数：生成本体图谱
 */
export async function generateOntology(
  rootPath: string,
  options?: GenerateOptions
): Promise<CodeOntology> {
  const generator = new OntologyGenerator(rootPath, options);
  return generator.generate();
}

/**
 * 便捷函数：生成并保存本体图谱
 */
export async function generateAndSaveOntology(
  rootPath: string,
  options?: GenerateOptions,
  onProgress?: ProgressCallback
): Promise<string> {
  const generator = new OntologyGenerator(rootPath, options);
  return generator.generateAndSave(onProgress);
}
