/**
 * 符号引用分析器
 * 分析函数调用、变量读写等符号级引用关系
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleNode, FunctionNode, ClassNode, LocationInfo } from './types.js';
import { SymbolCall, SymbolEntry, SymbolKind } from './types-enhanced.js';

// ============================================================================
// 辅助类型
// ============================================================================

interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  moduleId: string;
  location: LocationInfo;
  signature?: string;
  parent?: string;
}

interface CallInfo {
  callerSymbol: string;
  calleeSymbol: string;
  calleeName: string;
  callType: SymbolCall['callType'];
  location: LocationInfo;
}

// ============================================================================
// 符号引用分析器
// ============================================================================

export class SymbolReferenceAnalyzer {
  private rootPath: string;

  // 符号索引
  private symbolIndex: Map<string, SymbolInfo> = new Map();
  private nameToSymbols: Map<string, string[]> = new Map();

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * 分析模块列表，提取符号引用关系
   */
  async analyze(modules: ModuleNode[]): Promise<{
    symbols: Map<string, SymbolEntry>;
    calls: SymbolCall[];
  }> {
    // 1. 构建符号索引
    this.buildSymbolIndex(modules);

    // 2. 分析调用关系
    const calls = await this.analyzeCallRelations(modules);

    // 3. 转换为输出格式
    const symbols = this.convertToSymbolEntries();

    return { symbols, calls };
  }

  /**
   * 构建符号索引
   */
  private buildSymbolIndex(modules: ModuleNode[]): void {
    this.symbolIndex.clear();
    this.nameToSymbols.clear();

    for (const module of modules) {
      // 函数
      for (const func of module.functions) {
        const info: SymbolInfo = {
          id: func.id,
          name: func.name,
          kind: 'function',
          moduleId: module.id,
          location: func.location,
          signature: func.signature,
        };
        this.addSymbol(info);
      }

      // 类
      for (const cls of module.classes) {
        const classInfo: SymbolInfo = {
          id: cls.id,
          name: cls.name,
          kind: 'class',
          moduleId: module.id,
          location: cls.location,
        };
        this.addSymbol(classInfo);

        // 方法
        for (const method of cls.methods) {
          const methodInfo: SymbolInfo = {
            id: method.id,
            name: method.name,
            kind: 'method',
            moduleId: module.id,
            location: method.location,
            signature: method.signature,
            parent: cls.id,
          };
          this.addSymbol(methodInfo);
        }

        // 属性
        for (const prop of cls.properties) {
          const propInfo: SymbolInfo = {
            id: prop.id,
            name: prop.name,
            kind: 'property',
            moduleId: module.id,
            location: prop.location,
            parent: cls.id,
          };
          this.addSymbol(propInfo);
        }
      }

      // 接口
      for (const iface of module.interfaces) {
        const info: SymbolInfo = {
          id: iface.id,
          name: iface.name,
          kind: 'interface',
          moduleId: module.id,
          location: iface.location,
        };
        this.addSymbol(info);
      }

      // 类型
      for (const type of module.types) {
        const info: SymbolInfo = {
          id: type.id,
          name: type.name,
          kind: 'type',
          moduleId: module.id,
          location: type.location,
        };
        this.addSymbol(info);
      }

      // 枚举
      for (const enumNode of module.enums) {
        const info: SymbolInfo = {
          id: enumNode.id,
          name: enumNode.name,
          kind: 'enum',
          moduleId: module.id,
          location: enumNode.location,
        };
        this.addSymbol(info);
      }

      // 变量
      for (const variable of module.variables) {
        const info: SymbolInfo = {
          id: variable.id,
          name: variable.name,
          kind: variable.kind === 'const' ? 'constant' : 'variable',
          moduleId: module.id,
          location: variable.location,
        };
        this.addSymbol(info);
      }

      // 导出的符号（包括 re-export）
      // 对于纯 re-export 文件，这是主要的符号来源
      for (const exp of module.exports) {
        // 跳过通配符导出 (export * from ...)
        if (exp.name.startsWith('*')) continue;

        // 检查该导出是否已经被其他类型覆盖
        const existingId = `${module.id}::${exp.name}`;
        if (this.symbolIndex.has(existingId)) continue;

        // 推断符号类型：
        // - 检查名称是否以大写开头（可能是类型、类、接口）
        // - reexport 类型的导出需要特殊处理
        const startsWithUppercase = /^[A-Z]/.test(exp.name);
        const looksLikeType = startsWithUppercase && !exp.name.includes('_');

        const info: SymbolInfo = {
          id: existingId,
          name: exp.name,
          // 根据命名约定推断符号类型
          kind: looksLikeType ? 'type' : 'variable',
          moduleId: module.id,
          location: exp.location,
        };
        this.addSymbol(info);
      }
    }
  }

  /**
   * 添加符号到索引
   */
  private addSymbol(info: SymbolInfo): void {
    this.symbolIndex.set(info.id, info);

    // 名称索引
    const existing = this.nameToSymbols.get(info.name) || [];
    existing.push(info.id);
    this.nameToSymbols.set(info.name, existing);
  }

  /**
   * 分析调用关系
   */
  private async analyzeCallRelations(modules: ModuleNode[]): Promise<SymbolCall[]> {
    const calls: SymbolCall[] = [];
    const callMap = new Map<string, SymbolCall>();

    for (const module of modules) {
      // 读取文件内容
      const filePath = path.join(this.rootPath, module.id);
      let content: string;

      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');

      // 分析函数内的调用
      for (const func of module.functions) {
        const funcCalls = this.analyzeCallsInFunction(
          func,
          module,
          lines
        );
        this.mergeCallsIntoMap(funcCalls, callMap);
      }

      // 分析类方法内的调用
      for (const cls of module.classes) {
        for (const method of cls.methods) {
          const methodCalls = this.analyzeCallsInFunction(
            method,
            module,
            lines,
            cls
          );
          this.mergeCallsIntoMap(methodCalls, callMap);
        }
      }
    }

    return Array.from(callMap.values());
  }

  /**
   * 分析函数/方法内的调用
   */
  private analyzeCallsInFunction(
    func: FunctionNode,
    module: ModuleNode,
    lines: string[],
    parentClass?: ClassNode
  ): CallInfo[] {
    const calls: CallInfo[] = [];
    const callerSymbol = func.id;

    // 获取函数体的行范围
    const startLine = func.location.startLine - 1;
    const endLine = Math.min(func.location.endLine, lines.length);

    // 函数调用模式
    const patterns = [
      // 普通函数调用: functionName(
      /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      // 方法调用: obj.methodName( 或 this.methodName(
      /(?:([a-zA-Z_$][a-zA-Z0-9_$]*)|this)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      // 构造函数: new ClassName(
      /\bnew\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    ];

    // 忽略的关键字
    const IGNORED = new Set([
      'if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try',
      'return', 'throw', 'typeof', 'instanceof', 'delete', 'void',
      'function', 'class', 'const', 'let', 'var', 'import', 'export',
      'async', 'await', 'yield', 'super', 'this',
    ]);

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // 跳过注释行
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      // 模式 1: 普通函数调用
      let match: RegExpExecArray | null;
      const pattern1 = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

      while ((match = pattern1.exec(line)) !== null) {
        const funcName = match[1];

        if (IGNORED.has(funcName)) continue;

        // 查找可能的目标符号
        const targets = this.findTargetSymbols(funcName, module);

        for (const targetId of targets) {
          calls.push({
            callerSymbol,
            calleeSymbol: targetId,
            calleeName: funcName,
            callType: 'direct',
            location: {
              file: module.id,
              startLine: lineNum,
              startColumn: match.index,
              endLine: lineNum,
              endColumn: match.index + funcName.length,
            },
          });
        }
      }

      // 模式 2: 方法调用
      const pattern2 = /(?:([a-zA-Z_$][a-zA-Z0-9_$]*)|this)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

      while ((match = pattern2.exec(line)) !== null) {
        const objName = match[1]; // 可能是 undefined (this 的情况)
        const methodName = match[2];

        if (IGNORED.has(methodName)) continue;

        // this.method() 调用
        if (!objName && parentClass) {
          // 在同一个类中查找方法
          const targetId = `${module.id}::${parentClass.name}::${methodName}`;
          if (this.symbolIndex.has(targetId)) {
            calls.push({
              callerSymbol,
              calleeSymbol: targetId,
              calleeName: methodName,
              callType: 'method',
              location: {
                file: module.id,
                startLine: lineNum,
                startColumn: match.index,
                endLine: lineNum,
                endColumn: match.index + match[0].length - 1,
              },
            });
          }
        } else {
          // obj.method() 调用 - 尝试解析
          const targets = this.findMethodTargets(methodName);
          for (const targetId of targets) {
            calls.push({
              callerSymbol,
              calleeSymbol: targetId,
              calleeName: methodName,
              callType: 'method',
              location: {
                file: module.id,
                startLine: lineNum,
                startColumn: match.index,
                endLine: lineNum,
                endColumn: match.index + match[0].length - 1,
              },
            });
          }
        }
      }

      // 模式 3: 构造函数调用
      const pattern3 = /\bnew\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

      while ((match = pattern3.exec(line)) !== null) {
        const className = match[1];

        // 查找类
        const targets = this.findTargetSymbols(className, module);
        for (const targetId of targets) {
          const symbol = this.symbolIndex.get(targetId);
          if (symbol?.kind === 'class') {
            calls.push({
              callerSymbol,
              calleeSymbol: targetId,
              calleeName: className,
              callType: 'constructor',
              location: {
                file: module.id,
                startLine: lineNum,
                startColumn: match.index,
                endLine: lineNum,
                endColumn: match.index + match[0].length - 1,
              },
            });
          }
        }
      }
    }

    return calls;
  }

  /**
   * 查找目标符号
   */
  private findTargetSymbols(name: string, currentModule: ModuleNode): string[] {
    const candidates = this.nameToSymbols.get(name) || [];

    if (candidates.length === 0) {
      return [];
    }

    // 优先选择：
    // 1. 同模块内的符号
    // 2. 导入的符号
    // 3. 其他符号

    const sameModule: string[] = [];
    const imported: string[] = [];
    const others: string[] = [];

    // 获取当前模块导入的符号
    const importedSymbols = new Set<string>();
    for (const imp of currentModule.imports) {
      for (const sym of imp.symbols) {
        importedSymbols.add(sym);
      }
    }

    for (const candidateId of candidates) {
      const symbol = this.symbolIndex.get(candidateId);
      if (!symbol) continue;

      if (symbol.moduleId === currentModule.id) {
        sameModule.push(candidateId);
      } else if (importedSymbols.has(name)) {
        imported.push(candidateId);
      } else {
        others.push(candidateId);
      }
    }

    // 返回最可能的目标
    if (sameModule.length > 0) return sameModule;
    if (imported.length > 0) return imported;
    return others.slice(0, 1); // 只返回第一个
  }

  /**
   * 查找方法目标
   */
  private findMethodTargets(methodName: string): string[] {
    const candidates: string[] = [];

    for (const [id, symbol] of this.symbolIndex) {
      if (symbol.kind === 'method' && symbol.name === methodName) {
        candidates.push(id);
      }
    }

    return candidates;
  }

  /**
   * 合并调用到 Map（去重）
   */
  private mergeCallsIntoMap(calls: CallInfo[], map: Map<string, SymbolCall>): void {
    for (const call of calls) {
      const key = `${call.callerSymbol}::${call.calleeSymbol}`;

      const existing = map.get(key);
      if (existing) {
        // 合并位置
        existing.locations.push(call.location);
      } else {
        map.set(key, {
          caller: call.callerSymbol,
          callee: call.calleeSymbol,
          callType: call.callType,
          locations: [call.location],
        });
      }
    }
  }

  /**
   * 转换为 SymbolEntry 格式
   */
  private convertToSymbolEntries(): Map<string, SymbolEntry> {
    const entries = new Map<string, SymbolEntry>();

    for (const [id, info] of this.symbolIndex) {
      const entry: SymbolEntry = {
        id: info.id,
        name: info.name,
        kind: info.kind,
        moduleId: info.moduleId,
        location: info.location,
        signature: info.signature,
        parent: info.parent,
      };

      // 收集子符号
      if (info.kind === 'class') {
        const children: string[] = [];
        for (const [childId, childInfo] of this.symbolIndex) {
          if (childInfo.parent === id) {
            children.push(childId);
          }
        }
        if (children.length > 0) {
          entry.children = children;
        }
      }

      entries.set(id, entry);
    }

    return entries;
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 分析符号引用
 */
export async function analyzeSymbolReferences(
  rootPath: string,
  modules: ModuleNode[]
): Promise<{
  symbols: Map<string, SymbolEntry>;
  calls: SymbolCall[];
}> {
  const analyzer = new SymbolReferenceAnalyzer(rootPath);
  return analyzer.analyze(modules);
}
