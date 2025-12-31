/**
 * 架构层分类器
 * 根据文件路径和内容自动分类模块所属的架构层
 */

import * as path from 'path';
import { ArchitectureLayer } from './types-enhanced.js';
import { ModuleNode } from './types.js';

// ============================================================================
// 分类规则配置
// ============================================================================

interface ClassificationRule {
  /** 路径模式（正则） */
  patterns: RegExp[];
  /** 匹配时的架构层 */
  layer: ArchitectureLayer;
  /** 子分层名称（可选） */
  subLayer?: string;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // 表现层 - UI 组件
  {
    patterns: [
      /\/ui\//i,
      /\/components?\//i,
      /\/pages?\//i,
      /\/views?\//i,
      /\/screens?\//i,
      /\/layouts?\//i,
      /\.tsx$/i,
    ],
    layer: 'presentation',
    subLayer: 'components',
    priority: 10,
  },

  // 表现层 - 样式
  {
    patterns: [
      /\/styles?\//i,
      /\/css\//i,
      /\/themes?\//i,
      /\.css$/i,
      /\.scss$/i,
      /\.less$/i,
    ],
    layer: 'presentation',
    subLayer: 'styles',
    priority: 10,
  },

  // 业务层 - 核心逻辑
  {
    patterns: [
      /\/core\//i,
      /\/domain\//i,
      /\/business\//i,
      /\/logic\//i,
      /\/services?\//i,
      /\/usecases?\//i,
    ],
    layer: 'business',
    subLayer: 'core',
    priority: 20,
  },

  // 业务层 - 工具系统
  {
    patterns: [
      /\/tools?\//i,
    ],
    layer: 'business',
    subLayer: 'tools',
    priority: 15,
  },

  // 业务层 - 命令系统
  {
    patterns: [
      /\/commands?\//i,
    ],
    layer: 'business',
    subLayer: 'commands',
    priority: 15,
  },

  // 数据层 - API
  {
    patterns: [
      /\/api\//i,
      /\/apis?\//i,
      /\/client\//i,
      /\/http\//i,
      /\/fetch\//i,
      /\/request\//i,
    ],
    layer: 'data',
    subLayer: 'api',
    priority: 20,
  },

  // 数据层 - 数据库/存储
  {
    patterns: [
      /\/db\//i,
      /\/database\//i,
      /\/repositories?\//i,
      /\/storage\//i,
      /\/cache\//i,
      /\/session\//i,
    ],
    layer: 'data',
    subLayer: 'storage',
    priority: 20,
  },

  // 基础设施 - 配置
  {
    patterns: [
      /\/config\//i,
      /\/configs?\//i,
      /\/settings?\//i,
      /\/env\//i,
    ],
    layer: 'infrastructure',
    subLayer: 'config',
    priority: 5,
  },

  // 基础设施 - 工具函数
  {
    patterns: [
      /\/utils?\//i,
      /\/helpers?\//i,
      /\/lib\//i,
      /\/common\//i,
      /\/shared\//i,
    ],
    layer: 'infrastructure',
    subLayer: 'utils',
    priority: 5,
  },

  // 基础设施 - 类型定义
  {
    patterns: [
      /\/types?\//i,
      /\/interfaces?\//i,
      /\/models?\//i,
      /\.d\.ts$/i,
    ],
    layer: 'infrastructure',
    subLayer: 'types',
    priority: 5,
  },

  // 横切关注点 - 钩子
  {
    patterns: [
      /\/hooks?\//i,
      /use[A-Z]/,
    ],
    layer: 'crossCutting',
    subLayer: 'hooks',
    priority: 15,
  },

  // 横切关注点 - 中间件
  {
    patterns: [
      /\/middleware\//i,
      /\/interceptors?\//i,
    ],
    layer: 'crossCutting',
    subLayer: 'middleware',
    priority: 15,
  },

  // 横切关注点 - 日志/监控
  {
    patterns: [
      /\/log(ging)?\//i,
      /\/monitor(ing)?\//i,
      /\/telemetry\//i,
      /\/analytics?\//i,
    ],
    layer: 'crossCutting',
    subLayer: 'logging',
    priority: 15,
  },

  // 横切关注点 - 认证/权限
  {
    patterns: [
      /\/auth(entication)?\//i,
      /\/permission\//i,
      /\/security\//i,
      /\/oauth\//i,
    ],
    layer: 'crossCutting',
    subLayer: 'auth',
    priority: 15,
  },

  // 横切关注点 - 插件系统
  {
    patterns: [
      /\/plugins?\//i,
      /\/extensions?\//i,
      /\/addons?\//i,
    ],
    layer: 'crossCutting',
    subLayer: 'plugins',
    priority: 15,
  },
];

// ============================================================================
// 内容特征分析
// ============================================================================

interface ContentFeatures {
  hasReactImports: boolean;
  hasExpressImports: boolean;
  hasDbImports: boolean;
  hasApiCalls: boolean;
  hasUIElements: boolean;
  hasConfigExports: boolean;
}

function analyzeContentFeatures(module: ModuleNode): ContentFeatures {
  const features: ContentFeatures = {
    hasReactImports: false,
    hasExpressImports: false,
    hasDbImports: false,
    hasApiCalls: false,
    hasUIElements: false,
    hasConfigExports: false,
  };

  // 分析导入
  for (const imp of module.imports) {
    const source = imp.source.toLowerCase();

    if (source.includes('react') || source.includes('ink')) {
      features.hasReactImports = true;
    }
    if (source.includes('express') || source.includes('koa') || source.includes('fastify')) {
      features.hasExpressImports = true;
    }
    if (source.includes('mongo') || source.includes('mysql') || source.includes('postgres') || source.includes('redis')) {
      features.hasDbImports = true;
    }
    if (source.includes('axios') || source.includes('fetch') || source.includes('http')) {
      features.hasApiCalls = true;
    }
  }

  // 分析类和函数名
  for (const cls of module.classes) {
    if (cls.name.endsWith('Component') || cls.name.endsWith('View') || cls.name.endsWith('Page')) {
      features.hasUIElements = true;
    }
  }

  for (const func of module.functions) {
    if (func.name.startsWith('use') && func.name.length > 3) {
      // React Hook 模式
      features.hasUIElements = true;
    }
  }

  // 分析导出
  for (const exp of module.exports) {
    if (exp.name.toLowerCase().includes('config') || exp.name.toLowerCase().includes('settings')) {
      features.hasConfigExports = true;
    }
  }

  return features;
}

// ============================================================================
// LayerClassifier 类
// ============================================================================

export interface ClassificationResult {
  layer: ArchitectureLayer;
  subLayer?: string;
  confidence: number;
  matchedRules: string[];
}

export class LayerClassifier {
  private rules: ClassificationRule[];

  constructor(customRules?: ClassificationRule[]) {
    this.rules = customRules || CLASSIFICATION_RULES;
  }

  /**
   * 对单个模块进行架构层分类
   */
  classify(module: ModuleNode): ClassificationResult {
    const relativePath = module.id;
    const matchedRules: { rule: ClassificationRule; matched: RegExp[] }[] = [];

    // 1. 基于路径模式匹配
    for (const rule of this.rules) {
      const matched: RegExp[] = [];
      for (const pattern of rule.patterns) {
        if (pattern.test(relativePath)) {
          matched.push(pattern);
        }
      }
      if (matched.length > 0) {
        matchedRules.push({ rule, matched });
      }
    }

    // 2. 如果有匹配，按优先级选择
    if (matchedRules.length > 0) {
      // 按优先级和匹配数量排序
      matchedRules.sort((a, b) => {
        if (a.rule.priority !== b.rule.priority) {
          return b.rule.priority - a.rule.priority;
        }
        return b.matched.length - a.matched.length;
      });

      const best = matchedRules[0];
      return {
        layer: best.rule.layer,
        subLayer: best.rule.subLayer,
        confidence: Math.min(0.9, 0.5 + best.matched.length * 0.1),
        matchedRules: best.matched.map((r) => r.source),
      };
    }

    // 3. 基于内容特征分析
    const features = analyzeContentFeatures(module);

    if (features.hasReactImports || features.hasUIElements) {
      return {
        layer: 'presentation',
        confidence: 0.7,
        matchedRules: ['content:react/ui'],
      };
    }

    if (features.hasDbImports) {
      return {
        layer: 'data',
        subLayer: 'storage',
        confidence: 0.7,
        matchedRules: ['content:database'],
      };
    }

    if (features.hasApiCalls) {
      return {
        layer: 'data',
        subLayer: 'api',
        confidence: 0.6,
        matchedRules: ['content:api'],
      };
    }

    if (features.hasConfigExports) {
      return {
        layer: 'infrastructure',
        subLayer: 'config',
        confidence: 0.6,
        matchedRules: ['content:config'],
      };
    }

    // 4. 默认分类为基础设施
    return {
      layer: 'infrastructure',
      confidence: 0.3,
      matchedRules: ['default'],
    };
  }

  /**
   * 批量分类
   */
  classifyAll(modules: ModuleNode[]): Map<string, ClassificationResult> {
    const results = new Map<string, ClassificationResult>();

    for (const module of modules) {
      results.set(module.id, this.classify(module));
    }

    return results;
  }

  /**
   * 获取层描述
   */
  static getLayerDescription(layer: ArchitectureLayer): string {
    const descriptions: Record<ArchitectureLayer, string> = {
      presentation: '表现层：用户界面、组件、页面、视图渲染',
      business: '业务层：核心业务逻辑、领域模型、服务实现',
      data: '数据层：API 调用、数据库访问、存储管理',
      infrastructure: '基础设施层：工具函数、配置管理、类型定义',
      crossCutting: '横切关注点：认证、日志、中间件、插件系统',
    };
    return descriptions[layer];
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 快速分类单个模块
 */
export function classifyModule(module: ModuleNode): ClassificationResult {
  const classifier = new LayerClassifier();
  return classifier.classify(module);
}

/**
 * 批量分类模块
 */
export function classifyModules(modules: ModuleNode[]): Map<string, ClassificationResult> {
  const classifier = new LayerClassifier();
  return classifier.classifyAll(modules);
}
