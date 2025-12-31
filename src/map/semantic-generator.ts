/**
 * AI 语义生成器
 * 使用 Claude 为模块和符号生成业务语义描述
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleNode } from './types.js';
import {
  SemanticInfo,
  ProjectSemantic,
  KeyConcept,
  ArchitectureLayer,
  SymbolEntry,
  EnhancedAnalysisProgress,
} from './types-enhanced.js';
import { ClaudeClient, getDefaultClient } from '../core/client.js';

// ============================================================================
// 配置
// ============================================================================

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_CODE_LENGTH = 8000; // 最大代码长度
const BATCH_SIZE = 5; // 批量处理大小
const CONCURRENCY = 3; // 并发数

// ============================================================================
// 类型定义
// ============================================================================

export interface SemanticGeneratorOptions {
  /** 使用的模型 */
  model?: string;
  /** 并发数 */
  concurrency?: number;
  /** 批量大小 */
  batchSize?: number;
  /** 进度回调 */
  onProgress?: (progress: EnhancedAnalysisProgress) => void;
  /** 可选：传入已初始化的 ClaudeClient 实例 */
  client?: ClaudeClient;
}

interface ModuleSemanticResponse {
  description: string;
  responsibility: string;
  businessDomain?: string;
  architectureLayer: ArchitectureLayer;
  tags: string[];
}

interface ProjectSemanticResponse {
  description: string;
  purpose: string;
  domains: string[];
  keyConcepts: Array<{
    name: string;
    description: string;
  }>;
}

// ============================================================================
// SemanticGenerator 类
// ============================================================================

export class SemanticGenerator {
  private client: ClaudeClient | null = null;
  private clientProvider?: () => ClaudeClient;
  private model: string;
  private concurrency: number;
  private batchSize: number;
  private onProgress?: (progress: EnhancedAnalysisProgress) => void;
  private rootPath: string;

  constructor(rootPath: string, options: SemanticGeneratorOptions = {}) {
    this.rootPath = path.resolve(rootPath);
    this.model = options.model || DEFAULT_MODEL;
    this.concurrency = options.concurrency || CONCURRENCY;
    this.batchSize = options.batchSize || BATCH_SIZE;
    this.onProgress = options.onProgress;

    // 如果提供了 client 实例，直接使用
    if (options.client) {
      this.client = options.client;
    } else {
      // 延迟获取 client，在首次需要时才初始化
      this.clientProvider = getDefaultClient;
    }
  }

  /**
   * 获取 Claude 客户端（延迟初始化）
   */
  private getClient(): ClaudeClient {
    if (!this.client) {
      if (this.clientProvider) {
        this.client = this.clientProvider();
      } else {
        // 最后兜底方案
        this.client = getDefaultClient();
      }
    }
    return this.client;
  }

  /**
   * 为单个模块生成语义描述
   */
  async generateModuleSemantic(module: ModuleNode): Promise<SemanticInfo> {
    // 读取文件内容
    const filePath = path.join(this.rootPath, module.id);
    let content: string;

    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // 如果无法读取，返回基于元数据的描述
      return this.generateFallbackSemantic(module);
    }

    // 截断过长的代码
    if (content.length > MAX_CODE_LENGTH) {
      content = content.slice(0, MAX_CODE_LENGTH) + '\n// ... (code truncated)';
    }

    const prompt = this.buildModulePrompt(module, content);

    try {
      // 使用 ClaudeClient 的 createMessage 方法（已处理 OAuth 认证）
      const response = await this.getClient().createMessage(
        [{ role: 'user', content: prompt }],
        undefined, // 不需要工具
        undefined  // 不需要系统提示
      );

      // 提取文本响应
      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      const parsed = this.parseModuleResponse(text);

      return {
        ...parsed,
        confidence: 0.85,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to generate semantic for ${module.id}:`, error);
      return this.generateFallbackSemantic(module);
    }
  }

  /**
   * 批量生成模块语义
   */
  async batchGenerateModuleSemantics(
    modules: ModuleNode[]
  ): Promise<Map<string, SemanticInfo>> {
    const results = new Map<string, SemanticInfo>();
    const total = modules.length;
    let completed = 0;

    // 分批处理
    for (let i = 0; i < modules.length; i += this.batchSize) {
      const batch = modules.slice(i, i + this.batchSize);

      // 并发处理批次内的模块
      const batchPromises = batch.map(async (module) => {
        const semantic = await this.generateModuleSemantic(module);
        return { moduleId: module.id, semantic };
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { moduleId, semantic } of batchResults) {
        results.set(moduleId, semantic);
        completed++;

        if (this.onProgress) {
          this.onProgress({
            phase: 'semantics',
            current: completed,
            total,
            currentFile: moduleId,
            message: `生成语义: ${moduleId}`,
          });
        }
      }

      // 避免速率限制
      if (i + this.batchSize < modules.length) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * 生成项目级语义描述
   */
  async generateProjectSemantic(modules: ModuleNode[]): Promise<ProjectSemantic> {
    // 收集项目信息
    const moduleList = modules.slice(0, 50).map((m) => ({
      path: m.id,
      classes: m.classes.map((c) => c.name),
      functions: m.functions.map((f) => f.name).slice(0, 10),
    }));

    const prompt = this.buildProjectPrompt(moduleList);

    try {
      const response = await this.getClient().createMessage(
        [{ role: 'user', content: prompt }],
        undefined,
        undefined
      );

      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      return this.parseProjectResponse(text, modules);
    } catch (error) {
      console.error('Failed to generate project semantic:', error);
      return this.generateFallbackProjectSemantic(modules);
    }
  }

  /**
   * 为符号生成语义描述
   */
  async generateSymbolSemantic(
    symbol: SymbolEntry,
    context: { moduleCode?: string }
  ): Promise<SemanticInfo> {
    const prompt = `分析以下代码符号，生成简洁的业务描述：

符号名称: ${symbol.name}
符号类型: ${symbol.kind}
位置: ${symbol.location.file}:${symbol.location.startLine}
签名: ${symbol.signature || 'N/A'}

${context.moduleCode ? `相关代码:\n${context.moduleCode.slice(0, 2000)}` : ''}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "description": "这个${symbol.kind}做什么（1句话）",
  "responsibility": "核心职责",
  "tags": ["关键词1", "关键词2"]
}`;

    try {
      const response = await this.getClient().createMessage(
        [{ role: 'user', content: prompt }],
        undefined,
        undefined
      );

      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      const parsed = this.parseSymbolResponse(text);

      return {
        description: parsed.description,
        responsibility: parsed.responsibility,
        architectureLayer: 'infrastructure', // 默认
        tags: parsed.tags,
        confidence: 0.8,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return {
        description: `${symbol.kind} ${symbol.name}`,
        responsibility: symbol.kind,
        architectureLayer: 'infrastructure',
        tags: [],
        confidence: 0.3,
        generatedAt: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Prompt 构建
  // ============================================================================

  private buildModulePrompt(module: ModuleNode, content: string): string {
    return `分析以下代码模块，生成简洁的业务描述。

文件路径: ${module.id}
语言: ${module.language}
代码行数: ${module.lines}
类: ${module.classes.map((c) => c.name).join(', ') || '无'}
函数: ${module.functions.map((f) => f.name).slice(0, 10).join(', ') || '无'}
导入: ${module.imports.slice(0, 5).map((i) => i.source).join(', ') || '无'}

代码内容:
\`\`\`${module.language}
${content}
\`\`\`

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "description": "这个模块做什么（1-2句话，用中文）",
  "responsibility": "核心职责（1句话）",
  "businessDomain": "所属业务领域（如：用户管理、支付、搜索等）",
  "architectureLayer": "presentation|business|data|infrastructure|crossCutting",
  "tags": ["关键词1", "关键词2", "关键词3"]
}

architectureLayer 说明：
- presentation: UI 组件、页面、视图渲染
- business: 核心业务逻辑、领域模型、服务
- data: API 调用、数据库、存储
- infrastructure: 工具函数、配置、类型定义
- crossCutting: 认证、日志、中间件、插件`;
  }

  private buildProjectPrompt(
    moduleList: Array<{ path: string; classes: string[]; functions: string[] }>
  ): string {
    const modulesSummary = moduleList
      .map((m) => `- ${m.path}: 类[${m.classes.join(', ')}], 函数[${m.functions.join(', ')}]`)
      .join('\n');

    return `分析以下项目结构，生成项目级语义描述。

项目模块列表（前50个）：
${modulesSummary}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "description": "这个项目做什么（2-3句话，用中文）",
  "purpose": "项目的核心价值和目的（1-2句话）",
  "domains": ["业务领域1", "业务领域2", "业务领域3"],
  "keyConcepts": [
    {
      "name": "核心概念1",
      "description": "这个概念的含义和作用"
    },
    {
      "name": "核心概念2",
      "description": "这个概念的含义和作用"
    }
  ]
}`;
  }

  // ============================================================================
  // 响应解析
  // ============================================================================

  private parseModuleResponse(text: string): ModuleSemanticResponse {
    try {
      // 尝试提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || '模块功能描述',
          responsibility: parsed.responsibility || '待分析',
          businessDomain: parsed.businessDomain,
          architectureLayer: this.validateLayer(parsed.architectureLayer),
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        };
      }
    } catch {
      // JSON 解析失败
    }

    // 返回默认值
    return {
      description: '模块功能待分析',
      responsibility: '待确定',
      architectureLayer: 'infrastructure',
      tags: [],
    };
  }

  private parseProjectResponse(
    text: string,
    modules: ModuleNode[]
  ): ProjectSemantic {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // 关联模块到概念
        const keyConcepts: KeyConcept[] = (parsed.keyConcepts || []).map(
          (c: { name: string; description: string }) => ({
            name: c.name,
            description: c.description,
            relatedModules: this.findRelatedModules(c.name, modules),
          })
        );

        return {
          description: parsed.description || '项目描述待生成',
          purpose: parsed.purpose || '项目目的待确定',
          domains: Array.isArray(parsed.domains) ? parsed.domains : [],
          keyConcepts,
        };
      }
    } catch {
      // JSON 解析失败
    }

    return this.generateFallbackProjectSemantic(modules);
  }

  private parseSymbolResponse(text: string): {
    description: string;
    responsibility: string;
    tags: string[];
  } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || '符号描述',
          responsibility: parsed.responsibility || '待分析',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        };
      }
    } catch {
      // 解析失败
    }

    return {
      description: '符号功能待分析',
      responsibility: '待确定',
      tags: [],
    };
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private validateLayer(layer: string): ArchitectureLayer {
    const validLayers: ArchitectureLayer[] = [
      'presentation',
      'business',
      'data',
      'infrastructure',
      'crossCutting',
    ];
    return validLayers.includes(layer as ArchitectureLayer)
      ? (layer as ArchitectureLayer)
      : 'infrastructure';
  }

  private findRelatedModules(conceptName: string, modules: ModuleNode[]): string[] {
    const lowerName = conceptName.toLowerCase();
    const related: string[] = [];

    for (const module of modules) {
      const modulePath = module.id.toLowerCase();
      const hasMatchingClass = module.classes.some((c) =>
        c.name.toLowerCase().includes(lowerName)
      );
      const hasMatchingFunction = module.functions.some((f) =>
        f.name.toLowerCase().includes(lowerName)
      );

      if (
        modulePath.includes(lowerName) ||
        hasMatchingClass ||
        hasMatchingFunction
      ) {
        related.push(module.id);
      }
    }

    return related.slice(0, 10); // 最多10个
  }

  private generateFallbackSemantic(module: ModuleNode): SemanticInfo {
    // 基于路径和内容推断
    const pathParts = module.id.split('/');
    const fileName = pathParts[pathParts.length - 1];

    let layer: ArchitectureLayer = 'infrastructure';
    let description = `${fileName} 模块`;

    if (module.id.includes('/ui/') || module.id.includes('/components/')) {
      layer = 'presentation';
      description = `UI 组件模块 ${fileName}`;
    } else if (module.id.includes('/core/') || module.id.includes('/services/')) {
      layer = 'business';
      description = `业务逻辑模块 ${fileName}`;
    } else if (module.id.includes('/api/') || module.id.includes('/data/')) {
      layer = 'data';
      description = `数据处理模块 ${fileName}`;
    }

    return {
      description,
      responsibility: `${fileName} 的功能实现`,
      architectureLayer: layer,
      tags: pathParts.filter((p) => p !== 'src' && !p.includes('.')),
      confidence: 0.4,
      generatedAt: new Date().toISOString(),
    };
  }

  private generateFallbackProjectSemantic(modules: ModuleNode[]): ProjectSemantic {
    const paths = modules.map((m) => m.id);
    const hasUI = paths.some((p) => p.includes('/ui/') || p.includes('/components/'));
    const hasTools = paths.some((p) => p.includes('/tools/'));
    const hasCore = paths.some((p) => p.includes('/core/'));

    const domains: string[] = [];
    if (hasUI) domains.push('用户界面');
    if (hasTools) domains.push('工具系统');
    if (hasCore) domains.push('核心引擎');

    return {
      description: '代码项目（语义描述待生成）',
      purpose: '项目目的待分析',
      domains: domains.length > 0 ? domains : ['软件开发'],
      keyConcepts: [],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 快速生成模块语义
 */
export async function generateModuleSemantic(
  rootPath: string,
  module: ModuleNode,
  options?: SemanticGeneratorOptions
): Promise<SemanticInfo> {
  const generator = new SemanticGenerator(rootPath, options);
  return generator.generateModuleSemantic(module);
}

/**
 * 批量生成模块语义
 */
export async function batchGenerateSemantics(
  rootPath: string,
  modules: ModuleNode[],
  options?: SemanticGeneratorOptions
): Promise<Map<string, SemanticInfo>> {
  const generator = new SemanticGenerator(rootPath, options);
  return generator.batchGenerateModuleSemantics(modules);
}

/**
 * 生成项目语义
 */
export async function generateProjectSemantic(
  rootPath: string,
  modules: ModuleNode[],
  options?: SemanticGeneratorOptions
): Promise<ProjectSemantic> {
  const generator = new SemanticGenerator(rootPath, options);
  return generator.generateProjectSemantic(modules);
}
