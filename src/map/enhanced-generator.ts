/**
 * 增强版代码蓝图生成器
 * 整合所有分析模块，生成完整的增强版代码蓝图
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeMapAnalyzer } from './analyzer.js';
import { ModuleNode, DependencyEdge } from './types.js';
import {
  EnhancedCodeBlueprint,
  EnhancedModule,
  EnhancedProjectInfo,
  EnhancedStatistics,
  BlueprintMeta,
  Views,
  References,
  ModuleDependency,
  SymbolEntry,
  SymbolCall,
  TypeReference,
  EnhancedGenerateOptions,
  EnhancedAnalysisProgress,
  ArchitectureLayer,
  SemanticInfo,
} from './types-enhanced.js';
import { ViewBuilder } from './view-builder.js';
import { LayerClassifier, ClassificationResult } from './layer-classifier.js';
import { SymbolReferenceAnalyzer } from './symbol-reference-analyzer.js';
import { TypeReferenceAnalyzer } from './type-reference-analyzer.js';
import { SemanticGenerator, SemanticGeneratorOptions } from './semantic-generator.js';

// ============================================================================
// 常量
// ============================================================================

const VERSION = '2.0.0';
const GENERATOR_VERSION = '1.0.0';

// ============================================================================
// EnhancedOntologyGenerator 类
// ============================================================================

export class EnhancedOntologyGenerator {
  private rootPath: string;
  private options: EnhancedGenerateOptions;

  // 子模块
  private analyzer: CodeMapAnalyzer;
  private viewBuilder: ViewBuilder;
  private classifier: LayerClassifier;
  private symbolAnalyzer: SymbolReferenceAnalyzer;
  private typeAnalyzer: TypeReferenceAnalyzer;
  private semanticGenerator: SemanticGenerator | null = null;

  constructor(rootPath: string, options: EnhancedGenerateOptions = {}) {
    this.rootPath = path.resolve(rootPath);
    this.options = {
      include: options.include,
      exclude: options.exclude,
      withSemantics: options.withSemantics ?? true, // 默认生成语义
      outputPath: options.outputPath || path.join(rootPath, 'CODE_MAP.json'),
      concurrency: options.concurrency || 10,
      onProgress: options.onProgress,
    };

    // 初始化子模块
    this.analyzer = new CodeMapAnalyzer(rootPath, {
      include: this.options.include,
      exclude: this.options.exclude,
      concurrency: this.options.concurrency,
    });

    this.classifier = new LayerClassifier();
    this.viewBuilder = new ViewBuilder(this.classifier);
    this.symbolAnalyzer = new SymbolReferenceAnalyzer(rootPath);
    this.typeAnalyzer = new TypeReferenceAnalyzer(rootPath);
  }

  /**
   * 生成完整的增强版代码蓝图
   */
  async generate(): Promise<EnhancedCodeBlueprint> {
    const startTime = Date.now();

    // 1. 发现文件
    this.reportProgress({ phase: 'discover', current: 0, total: 0 });
    const files = await this.analyzer.discoverFiles();
    this.reportProgress({ phase: 'discover', current: files.length, total: files.length });

    // 2. 分析文件
    const modules = await this.analyzer.analyzeFiles(files, (progress) => {
      this.reportProgress({
        phase: progress.phase as EnhancedAnalysisProgress['phase'],
        current: progress.current,
        total: progress.total,
        currentFile: progress.currentFile,
      });
    });

    // 3. 构建视图
    this.reportProgress({ phase: 'views', current: 0, total: 2, message: '构建目录树视图' });
    const views = this.viewBuilder.buildViews(modules);
    this.reportProgress({ phase: 'views', current: 2, total: 2, message: '视图构建完成' });

    // 4. 分析符号引用
    this.reportProgress({ phase: 'references', current: 0, total: 3, message: '分析符号引用' });
    const { symbols, calls } = await this.symbolAnalyzer.analyze(modules);

    // 5. 分析类型引用
    this.reportProgress({ phase: 'references', current: 1, total: 3, message: '分析类型引用' });
    const typeRefs = this.typeAnalyzer.analyze(modules);

    // 6. 构建模块依赖
    this.reportProgress({ phase: 'references', current: 2, total: 3, message: '构建依赖关系' });
    const moduleDeps = this.buildModuleDependencies(modules);

    this.reportProgress({ phase: 'references', current: 3, total: 3, message: '引用分析完成' });

    // 7. 生成 AI 语义（如果启用）
    let moduleSemantics = new Map<string, SemanticInfo>();
    let projectSemantic = null;

    if (this.options.withSemantics) {
      this.semanticGenerator = new SemanticGenerator(this.rootPath, {
        onProgress: this.options.onProgress,
      });

      // 生成项目语义
      this.reportProgress({
        phase: 'semantics',
        current: 0,
        total: modules.length + 1,
        message: '生成项目语义描述',
      });
      projectSemantic = await this.semanticGenerator.generateProjectSemantic(modules);

      // 批量生成模块语义
      moduleSemantics = await this.semanticGenerator.batchGenerateModuleSemantics(modules);
    }

    // 8. 聚合输出
    this.reportProgress({ phase: 'aggregate', current: 0, total: 1, message: '聚合蓝图数据' });

    const classifications = this.classifier.classifyAll(modules);
    const enhancedModules = this.buildEnhancedModules(modules, moduleSemantics, classifications);
    const symbolsRecord = this.convertSymbolsToRecord(symbols);
    const references = this.buildReferences(moduleDeps, calls, typeRefs);
    const statistics = this.calculateStatistics(
      enhancedModules,
      symbolsRecord,
      references,
      classifications
    );

    const blueprint: EnhancedCodeBlueprint = {
      meta: this.buildMeta(),
      project: this.buildProjectInfo(modules, projectSemantic),
      views,
      modules: enhancedModules,
      symbols: symbolsRecord,
      references,
      statistics,
    };

    this.reportProgress({ phase: 'aggregate', current: 1, total: 1, message: '生成完成' });

    const duration = Date.now() - startTime;
    console.log(`蓝图生成完成，耗时 ${(duration / 1000).toFixed(1)}s`);

    return blueprint;
  }

  /**
   * 生成并保存到文件
   */
  async generateAndSave(): Promise<string> {
    const blueprint = await this.generate();
    const outputPath = this.options.outputPath!;

    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(outputPath, JSON.stringify(blueprint, null, 2), 'utf-8');

    return outputPath;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private reportProgress(progress: EnhancedAnalysisProgress): void {
    if (this.options.onProgress) {
      this.options.onProgress(progress);
    }
  }

  private buildMeta(): BlueprintMeta {
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      semanticVersion: this.options.withSemantics ? '1.0' : undefined,
    };
  }

  private buildProjectInfo(
    modules: ModuleNode[],
    projectSemantic: any
  ): EnhancedProjectInfo {
    // 获取项目名称
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

    // 收集语言
    const languages = new Set<string>();
    for (const module of modules) {
      languages.add(module.language);
    }

    return {
      name: projectName,
      rootPath: this.rootPath,
      languages: Array.from(languages),
      semantic: projectSemantic || undefined,
    };
  }

  private buildEnhancedModules(
    modules: ModuleNode[],
    semantics: Map<string, SemanticInfo>,
    classifications: Map<string, ClassificationResult>
  ): Record<string, EnhancedModule> {
    const result: Record<string, EnhancedModule> = {};

    for (const module of modules) {
      const semantic = semantics.get(module.id);
      const classification = classifications.get(module.id);

      // 构建导出列表
      const exports: string[] = [];
      for (const exp of module.exports) {
        exports.push(`${module.id}::${exp.name}`);
      }
      for (const func of module.functions) {
        if (func.isExported) {
          exports.push(func.id);
        }
      }
      for (const cls of module.classes) {
        if (cls.isExported) {
          exports.push(cls.id);
        }
      }

      // 构建导入列表
      const imports = module.imports.map((imp) => ({
        source: imp.source,
        symbols: imp.symbols,
        isExternal: !imp.source.startsWith('.') && !imp.source.startsWith('/'),
        isTypeOnly: imp.source.includes('type') || false,
      }));

      const enhanced: EnhancedModule = {
        id: module.id,
        name: module.name,
        path: module.path,
        language: module.language,
        lines: module.lines,
        size: module.size,
        exports,
        imports,
      };

      // 添加语义信息
      if (semantic) {
        enhanced.semantic = semantic;
      } else if (classification) {
        // 使用分类结果作为基本语义
        enhanced.semantic = {
          description: `${module.name} 模块`,
          responsibility: LayerClassifier.getLayerDescription(classification.layer),
          architectureLayer: classification.layer,
          tags: classification.matchedRules,
          confidence: classification.confidence,
          generatedAt: new Date().toISOString(),
        };
      }

      result[module.id] = enhanced;
    }

    return result;
  }

  private convertSymbolsToRecord(
    symbols: Map<string, SymbolEntry>
  ): Record<string, SymbolEntry> {
    const result: Record<string, SymbolEntry> = {};
    for (const [id, entry] of symbols) {
      result[id] = entry;
    }
    return result;
  }

  private buildModuleDependencies(modules: ModuleNode[]): ModuleDependency[] {
    const deps: ModuleDependency[] = [];
    const moduleIds = new Set(modules.map((m) => m.id));

    for (const module of modules) {
      for (const imp of module.imports) {
        // 尝试解析导入目标
        const targetId = this.resolveImportTarget(imp.source, module.id, moduleIds);

        if (targetId) {
          deps.push({
            source: module.id,
            target: targetId,
            type: imp.isDynamic ? 'dynamic' : 'import',
            symbols: imp.symbols,
            isTypeOnly: imp.source.includes('type') || false,
          });
        }
      }
    }

    return deps;
  }

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

  private buildReferences(
    moduleDeps: ModuleDependency[],
    symbolCalls: SymbolCall[],
    typeRefs: TypeReference[]
  ): References {
    return {
      moduleDeps,
      symbolCalls,
      typeRefs,
    };
  }

  private calculateStatistics(
    modules: Record<string, EnhancedModule>,
    symbols: Record<string, SymbolEntry>,
    references: References,
    classifications: Map<string, ClassificationResult>
  ): EnhancedStatistics {
    const moduleList = Object.values(modules);
    const symbolList = Object.values(symbols);

    // 基本统计
    let totalLines = 0;
    const languageBreakdown: Record<string, number> = {};
    const layerDistribution: Record<ArchitectureLayer, number> = {
      presentation: 0,
      business: 0,
      data: 0,
      infrastructure: 0,
      crossCutting: 0,
    };

    const fileStats: Array<{ path: string; lines: number; size: number }> = [];

    for (const module of moduleList) {
      totalLines += module.lines;
      languageBreakdown[module.language] = (languageBreakdown[module.language] || 0) + 1;

      const classification = classifications.get(module.id);
      if (classification) {
        layerDistribution[classification.layer]++;
      }

      fileStats.push({
        path: module.id,
        lines: module.lines,
        size: module.size,
      });
    }

    // 语义覆盖率
    let modulesWithDescription = 0;
    let symbolsWithDescription = 0;

    for (const module of moduleList) {
      if (module.semantic?.description) {
        modulesWithDescription++;
      }
    }

    for (const symbol of symbolList) {
      if (symbol.semantic?.description) {
        symbolsWithDescription++;
      }
    }

    const totalModules = moduleList.length;
    const totalSymbols = symbolList.length;
    const coveragePercent =
      totalModules > 0
        ? Math.round((modulesWithDescription / totalModules) * 100)
        : 0;

    // 最大文件
    fileStats.sort((a, b) => b.lines - a.lines);
    const largestFiles = fileStats.slice(0, 10);

    // 被调用最多的符号
    const callCounts = new Map<string, number>();
    for (const call of references.symbolCalls) {
      callCounts.set(call.callee, (callCounts.get(call.callee) || 0) + call.locations.length);
    }

    const mostCalledSymbols = Array.from(callCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const symbol = symbols[id];
        return {
          id,
          name: symbol?.name || id.split('::').pop() || id,
          callCount: count,
        };
      });

    // 被导入最多的模块
    const importCounts = new Map<string, number>();
    for (const dep of references.moduleDeps) {
      importCounts.set(dep.target, (importCounts.get(dep.target) || 0) + 1);
    }

    const mostImportedModules = Array.from(importCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, importCount: count }));

    return {
      totalModules,
      totalSymbols,
      totalLines,
      semanticCoverage: {
        modulesWithDescription,
        symbolsWithDescription,
        coveragePercent,
      },
      referenceStats: {
        totalModuleDeps: references.moduleDeps.length,
        totalSymbolCalls: references.symbolCalls.length,
        totalTypeRefs: references.typeRefs.length,
      },
      layerDistribution,
      languageBreakdown,
      largestFiles,
      mostCalledSymbols,
      mostImportedModules,
    };
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 生成增强版代码蓝图
 */
export async function generateEnhancedBlueprint(
  rootPath: string,
  options?: EnhancedGenerateOptions
): Promise<EnhancedCodeBlueprint> {
  const generator = new EnhancedOntologyGenerator(rootPath, options);
  return generator.generate();
}

/**
 * 生成并保存增强版代码蓝图
 */
export async function generateAndSaveEnhancedBlueprint(
  rootPath: string,
  options?: EnhancedGenerateOptions
): Promise<string> {
  const generator = new EnhancedOntologyGenerator(rootPath, options);
  return generator.generateAndSave();
}
