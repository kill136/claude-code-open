/**
 * 调用图构建器
 * 分析函数/方法之间的调用关系
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ModuleNode,
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  CallReference,
  LocationInfo,
  FunctionNode,
  MethodNode,
} from './types.js';

// ============================================================================
// 调用表达式模式
// ============================================================================

interface CallExpressionPattern {
  language: string;
  patterns: RegExp[];
}

const CALL_PATTERNS: CallExpressionPattern[] = [
  {
    language: 'typescript',
    patterns: [
      // 普通函数调用: functionName(args)
      /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      // 方法调用: object.method(args)
      /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      // 可选链调用: object?.method(args)
      /\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      // new 构造函数: new ClassName(args)
      /\bnew\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    ],
  },
  {
    language: 'javascript',
    patterns: [
      /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      /\?\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      /\bnew\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    ],
  },
  {
    language: 'python',
    patterns: [
      // 函数调用: function_name(args)
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      // 方法调用: object.method(args)
      /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    ],
  },
  {
    language: 'go',
    patterns: [
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    ],
  },
];

// 需要忽略的内置函数/关键字
const IGNORED_NAMES = new Set([
  // JavaScript/TypeScript
  'if', 'for', 'while', 'switch', 'catch', 'with', 'function', 'class',
  'return', 'throw', 'typeof', 'instanceof', 'void', 'delete',
  'await', 'async', 'yield', 'new', 'super', 'this',
  // 常见内置
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'require', 'import', 'export', 'module', 'exports',
  // Python
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'set',
  'open', 'input', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
  'lambda', 'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except',
]);

// ============================================================================
// CallGraphBuilder 类
// ============================================================================

export class CallGraphBuilder {
  private functionIndex: Map<string, CallGraphNode> = new Map();
  private nameToIds: Map<string, string[]> = new Map();

  /**
   * 构建调用图
   */
  async buildCallGraph(modules: ModuleNode[]): Promise<CallGraph> {
    const nodes: CallGraphNode[] = [];
    const edges: CallGraphEdge[] = [];

    // 1. 收集所有函数/方法节点并建立索引
    this.buildFunctionIndex(modules, nodes);

    // 2. 分析每个模块的调用关系
    for (const module of modules) {
      await this.analyzeModuleCalls(module, edges);
    }

    // 3. 合并重复边
    const mergedEdges = this.mergeEdges(edges);

    return { nodes, edges: mergedEdges };
  }

  /**
   * 建立函数索引
   */
  private buildFunctionIndex(modules: ModuleNode[], nodes: CallGraphNode[]): void {
    this.functionIndex.clear();
    this.nameToIds.clear();

    for (const module of modules) {
      // 顶层函数
      for (const func of module.functions) {
        const node: CallGraphNode = {
          id: func.id,
          name: func.name,
          type: 'function',
          moduleId: module.id,
          signature: func.signature,
        };

        nodes.push(node);
        this.functionIndex.set(func.id, node);
        this.addToNameIndex(func.name, func.id);
      }

      // 类方法
      for (const cls of module.classes) {
        for (const method of cls.methods) {
          const node: CallGraphNode = {
            id: method.id,
            name: method.name,
            type: method.name === 'constructor' ? 'constructor' : 'method',
            moduleId: module.id,
            className: cls.name,
            signature: method.signature,
          };

          nodes.push(node);
          this.functionIndex.set(method.id, node);

          // 使用多种键索引方法
          this.addToNameIndex(method.name, method.id);
          this.addToNameIndex(`${cls.name}.${method.name}`, method.id);
          this.addToNameIndex(`${cls.name}#${method.name}`, method.id);
        }
      }
    }
  }

  private addToNameIndex(name: string, id: string): void {
    const existing = this.nameToIds.get(name) || [];
    if (!existing.includes(id)) {
      existing.push(id);
      this.nameToIds.set(name, existing);
    }
  }

  /**
   * 分析模块中的调用
   */
  private async analyzeModuleCalls(
    module: ModuleNode,
    edges: CallGraphEdge[]
  ): Promise<void> {
    // 读取源文件
    let content: string;
    try {
      content = fs.readFileSync(module.path, 'utf-8');
    } catch {
      return;
    }

    const lines = content.split('\n');

    // 获取适用的调用模式
    const patterns = this.getCallPatterns(module.language);
    if (patterns.length === 0) return;

    // 分析每个函数/方法内的调用
    for (const func of module.functions) {
      this.analyzeFunctionCalls(func, lines, patterns, module.id, edges);
    }

    for (const cls of module.classes) {
      for (const method of cls.methods) {
        this.analyzeFunctionCalls(method, lines, patterns, module.id, edges);
      }
    }
  }

  /**
   * 分析单个函数内的调用
   */
  private analyzeFunctionCalls(
    func: FunctionNode | MethodNode,
    lines: string[],
    patterns: RegExp[],
    moduleId: string,
    edges: CallGraphEdge[]
  ): void {
    const { startLine, endLine } = func.location;

    // 提取函数体内容
    const functionLines = lines.slice(startLine - 1, endLine);

    for (let i = 0; i < functionLines.length; i++) {
      const line = functionLines[i];
      const lineNumber = startLine + i;

      for (const pattern of patterns) {
        // 重置正则
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(line)) !== null) {
          const calledName = match[1];

          // 跳过忽略的名称
          if (IGNORED_NAMES.has(calledName)) continue;

          // 跳过自身递归调用
          if (calledName === func.name) continue;

          // 查找目标函数
          const targetIds = this.nameToIds.get(calledName) || [];

          for (const targetId of targetIds) {
            // 优先选择同模块的函数
            const isSameModule = targetId.startsWith(moduleId);

            edges.push({
              source: func.id,
              target: targetId,
              type: this.detectCallType(line, calledName),
              count: 1,
              locations: [{
                file: moduleId,
                startLine: lineNumber,
                startColumn: match.index,
                endLine: lineNumber,
                endColumn: match.index + match[0].length,
              }],
            });

            // 如果找到同模块的目标，就不再继续查找
            if (isSameModule) break;
          }
        }
      }
    }
  }

  /**
   * 获取语言对应的调用模式
   */
  private getCallPatterns(language: string): RegExp[] {
    const config = CALL_PATTERNS.find((p) => p.language === language);
    if (config) {
      // 返回模式的副本（避免状态污染）
      return config.patterns.map((p) => new RegExp(p.source, p.flags));
    }

    // 默认使用 JavaScript 模式
    const defaultConfig = CALL_PATTERNS.find((p) => p.language === 'javascript');
    if (defaultConfig) {
      return defaultConfig.patterns.map((p) => new RegExp(p.source, p.flags));
    }

    return [];
  }

  /**
   * 检测调用类型
   */
  private detectCallType(
    line: string,
    calledName: string
  ): 'direct' | 'method' | 'callback' | 'dynamic' {
    // 检查是否为方法调用
    if (line.includes(`.${calledName}(`) || line.includes(`?.${calledName}(`)) {
      return 'method';
    }

    // 检查是否为回调
    if (line.includes(`(${calledName})`) || line.includes(`, ${calledName})`)) {
      return 'callback';
    }

    // 检查是否为动态调用
    if (line.includes(`[${calledName}](`)) {
      return 'dynamic';
    }

    return 'direct';
  }

  /**
   * 合并重复边
   */
  private mergeEdges(edges: CallGraphEdge[]): CallGraphEdge[] {
    const edgeMap = new Map<string, CallGraphEdge>();

    for (const edge of edges) {
      const key = `${edge.source}|${edge.target}`;
      const existing = edgeMap.get(key);

      if (existing) {
        existing.count += edge.count;
        existing.locations.push(...edge.locations);
      } else {
        edgeMap.set(key, { ...edge, locations: [...edge.locations] });
      }
    }

    return Array.from(edgeMap.values());
  }

  /**
   * 更新模块中函数的调用信息
   */
  updateModulesWithCallInfo(modules: ModuleNode[], callGraph: CallGraph): void {
    // 构建入边和出边索引
    const outgoingCalls = new Map<string, CallReference[]>();
    const incomingCalls = new Map<string, CallReference[]>();

    for (const edge of callGraph.edges) {
      // 出边
      const outgoing = outgoingCalls.get(edge.source) || [];
      const targetNode = this.functionIndex.get(edge.target);

      if (targetNode) {
        for (const loc of edge.locations) {
          outgoing.push({
            targetId: edge.target,
            targetName: targetNode.name,
            type: edge.type,
            location: loc,
          });
        }
        outgoingCalls.set(edge.source, outgoing);
      }

      // 入边
      const incoming = incomingCalls.get(edge.target) || [];
      const sourceNode = this.functionIndex.get(edge.source);

      if (sourceNode) {
        for (const loc of edge.locations) {
          incoming.push({
            targetId: edge.source,
            targetName: sourceNode.name,
            type: edge.type,
            location: loc,
          });
        }
        incomingCalls.set(edge.target, incoming);
      }
    }

    // 更新模块中的函数
    for (const module of modules) {
      for (const func of module.functions) {
        func.calls = outgoingCalls.get(func.id) || [];
        func.calledBy = incomingCalls.get(func.id) || [];
      }

      for (const cls of module.classes) {
        for (const method of cls.methods) {
          method.calls = outgoingCalls.get(method.id) || [];
          method.calledBy = incomingCalls.get(method.id) || [];
        }
      }
    }
  }
}

/**
 * 便捷函数：构建调用图
 */
export async function buildCallGraph(modules: ModuleNode[]): Promise<CallGraph> {
  const builder = new CallGraphBuilder();
  return builder.buildCallGraph(modules);
}
