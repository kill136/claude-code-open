/**
 * 类型引用分析器
 * 分析 extends、implements 等类型级引用关系
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleNode, ClassNode, InterfaceNode } from './types.js';
import { TypeReference, SymbolEntry } from './types-enhanced.js';

// ============================================================================
// 类型引用分析器
// ============================================================================

export class TypeReferenceAnalyzer {
  private rootPath: string;

  // 类/接口索引（按名称）
  private classIndex: Map<string, string[]> = new Map(); // name -> ids[]
  private interfaceIndex: Map<string, string[]> = new Map();

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * 分析模块列表，提取类型引用关系
   */
  analyze(modules: ModuleNode[]): TypeReference[] {
    // 1. 构建类型索引
    this.buildTypeIndex(modules);

    // 2. 分析继承和实现关系
    const references: TypeReference[] = [];

    for (const module of modules) {
      // 分析类的继承和实现
      for (const cls of module.classes) {
        const classRefs = this.analyzeClassRelations(cls, module);
        references.push(...classRefs);
      }

      // 分析接口的继承
      for (const iface of module.interfaces) {
        const ifaceRefs = this.analyzeInterfaceRelations(iface, module);
        references.push(...ifaceRefs);
      }
    }

    return references;
  }

  /**
   * 构建类型索引
   */
  private buildTypeIndex(modules: ModuleNode[]): void {
    this.classIndex.clear();
    this.interfaceIndex.clear();

    for (const module of modules) {
      // 索引类
      for (const cls of module.classes) {
        const existing = this.classIndex.get(cls.name) || [];
        existing.push(cls.id);
        this.classIndex.set(cls.name, existing);
      }

      // 索引接口
      for (const iface of module.interfaces) {
        const existing = this.interfaceIndex.get(iface.name) || [];
        existing.push(iface.id);
        this.interfaceIndex.set(iface.name, existing);
      }
    }
  }

  /**
   * 分析类的继承和实现关系
   */
  private analyzeClassRelations(cls: ClassNode, module: ModuleNode): TypeReference[] {
    const refs: TypeReference[] = [];

    // extends 关系
    if (cls.extends) {
      const parentName = this.extractTypeName(cls.extends);
      const parentIds = this.findTypeByName(parentName, module, 'class');

      for (const parentId of parentIds) {
        refs.push({
          child: cls.id,
          parent: parentId,
          kind: 'extends',
        });
      }
    }

    // implements 关系
    if (cls.implements && cls.implements.length > 0) {
      for (const ifaceName of cls.implements) {
        const cleanName = this.extractTypeName(ifaceName);
        const ifaceIds = this.findTypeByName(cleanName, module, 'interface');

        for (const ifaceId of ifaceIds) {
          refs.push({
            child: cls.id,
            parent: ifaceId,
            kind: 'implements',
          });
        }
      }
    }

    return refs;
  }

  /**
   * 分析接口的继承关系
   */
  private analyzeInterfaceRelations(iface: InterfaceNode, module: ModuleNode): TypeReference[] {
    const refs: TypeReference[] = [];

    if (iface.extends && iface.extends.length > 0) {
      for (const parentName of iface.extends) {
        const cleanName = this.extractTypeName(parentName);
        const parentIds = this.findTypeByName(cleanName, module, 'interface');

        for (const parentId of parentIds) {
          refs.push({
            child: iface.id,
            parent: parentId,
            kind: 'extends',
          });
        }
      }
    }

    return refs;
  }

  /**
   * 提取类型名称（去除泛型参数）
   */
  private extractTypeName(fullType: string): string {
    // 去除泛型参数 Foo<T> -> Foo
    const genericIndex = fullType.indexOf('<');
    if (genericIndex > 0) {
      return fullType.slice(0, genericIndex).trim();
    }
    return fullType.trim();
  }

  /**
   * 根据名称查找类型
   */
  private findTypeByName(
    name: string,
    currentModule: ModuleNode,
    preferKind: 'class' | 'interface'
  ): string[] {
    const index = preferKind === 'class' ? this.classIndex : this.interfaceIndex;
    const candidates = index.get(name) || [];

    if (candidates.length === 0) {
      // 尝试在另一个索引中查找
      const otherIndex = preferKind === 'class' ? this.interfaceIndex : this.classIndex;
      return otherIndex.get(name) || [];
    }

    // 优先选择同模块或导入的
    const importedTypes = new Set<string>();
    for (const imp of currentModule.imports) {
      for (const sym of imp.symbols) {
        importedTypes.add(sym);
      }
    }

    const sameModule = candidates.filter((id) => id.startsWith(currentModule.id + '::'));
    if (sameModule.length > 0) {
      return sameModule;
    }

    const imported = candidates.filter(() => importedTypes.has(name));
    if (imported.length > 0) {
      return imported;
    }

    // 返回第一个候选
    return candidates.slice(0, 1);
  }

  /**
   * 从文件内容中提取更详细的类型关系（高级分析）
   */
  async analyzeFromSource(modules: ModuleNode[]): Promise<TypeReference[]> {
    const refs: TypeReference[] = [];

    for (const module of modules) {
      const filePath = path.join(this.rootPath, module.id);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceRefs = this.parseTypeRelationsFromSource(content, module);
        refs.push(...sourceRefs);
      } catch {
        // 忽略读取错误
      }
    }

    return refs;
  }

  /**
   * 从源代码中解析类型关系
   */
  private parseTypeRelationsFromSource(content: string, module: ModuleNode): TypeReference[] {
    const refs: TypeReference[] = [];

    // 匹配 class X extends Y implements Z, W
    const classPattern = /class\s+(\w+)(?:\s*<[^>]*>)?\s+extends\s+(\w+)(?:\s*<[^>]*>)?(?:\s+implements\s+([^{]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const parentClass = match[2];
      const implementsList = match[3];

      const childId = `${module.id}::${className}`;

      // extends
      const parentIds = this.findTypeByName(parentClass, module, 'class');
      for (const parentId of parentIds) {
        refs.push({
          child: childId,
          parent: parentId,
          kind: 'extends',
        });
      }

      // implements
      if (implementsList) {
        const interfaces = implementsList.split(',').map((s) => s.trim());
        for (const ifaceName of interfaces) {
          const cleanName = this.extractTypeName(ifaceName);
          const ifaceIds = this.findTypeByName(cleanName, module, 'interface');
          for (const ifaceId of ifaceIds) {
            refs.push({
              child: childId,
              parent: ifaceId,
              kind: 'implements',
            });
          }
        }
      }
    }

    // 匹配 interface X extends Y, Z
    const ifacePattern = /interface\s+(\w+)(?:\s*<[^>]*>)?\s+extends\s+([^{]+)/g;

    while ((match = ifacePattern.exec(content)) !== null) {
      const ifaceName = match[1];
      const extendsList = match[2];

      const childId = `${module.id}::${ifaceName}`;

      const parents = extendsList.split(',').map((s) => s.trim());
      for (const parentName of parents) {
        const cleanName = this.extractTypeName(parentName);
        const parentIds = this.findTypeByName(cleanName, module, 'interface');
        for (const parentId of parentIds) {
          refs.push({
            child: childId,
            parent: parentId,
            kind: 'extends',
          });
        }
      }
    }

    return refs;
  }
}

// ============================================================================
// 类型使用分析（参数、返回值、属性中的类型引用）
// ============================================================================

export interface TypeUsage {
  /** 使用者符号 ID */
  user: string;

  /** 被使用的类型名称 */
  typeName: string;

  /** 使用方式 */
  usageKind: 'parameter' | 'return' | 'property' | 'generic' | 'cast';

  /** 位置信息 */
  location?: {
    file: string;
    line: number;
  };
}

export class TypeUsageAnalyzer {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * 分析类型使用
   */
  analyze(modules: ModuleNode[]): TypeUsage[] {
    const usages: TypeUsage[] = [];

    for (const module of modules) {
      // 分析函数参数和返回值
      for (const func of module.functions) {
        // 参数类型
        for (const param of func.parameters) {
          if (param.type && this.isCustomType(param.type)) {
            usages.push({
              user: func.id,
              typeName: this.extractTypeName(param.type),
              usageKind: 'parameter',
            });
          }
        }

        // 返回类型
        if (func.returnType && this.isCustomType(func.returnType)) {
          usages.push({
            user: func.id,
            typeName: this.extractTypeName(func.returnType),
            usageKind: 'return',
          });
        }
      }

      // 分析类方法和属性
      for (const cls of module.classes) {
        for (const method of cls.methods) {
          for (const param of method.parameters) {
            if (param.type && this.isCustomType(param.type)) {
              usages.push({
                user: method.id,
                typeName: this.extractTypeName(param.type),
                usageKind: 'parameter',
              });
            }
          }

          if (method.returnType && this.isCustomType(method.returnType)) {
            usages.push({
              user: method.id,
              typeName: this.extractTypeName(method.returnType),
              usageKind: 'return',
            });
          }
        }

        for (const prop of cls.properties) {
          if (prop.type && this.isCustomType(prop.type)) {
            usages.push({
              user: prop.id,
              typeName: this.extractTypeName(prop.type),
              usageKind: 'property',
            });
          }
        }
      }
    }

    return usages;
  }

  /**
   * 判断是否为自定义类型（非基础类型）
   */
  private isCustomType(typeName: string): boolean {
    const builtinTypes = new Set([
      'string', 'number', 'boolean', 'void', 'null', 'undefined',
      'any', 'unknown', 'never', 'object', 'symbol', 'bigint',
      'String', 'Number', 'Boolean', 'Object', 'Symbol', 'BigInt',
      'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
      'Date', 'RegExp', 'Error', 'Function',
    ]);

    const baseName = this.extractTypeName(typeName);
    return !builtinTypes.has(baseName);
  }

  /**
   * 提取类型名称
   */
  private extractTypeName(fullType: string): string {
    // 去除泛型、数组标记等
    let name = fullType
      .replace(/<[^>]*>/g, '')
      .replace(/\[\]/g, '')
      .replace(/\|/g, ' ')
      .replace(/&/g, ' ')
      .trim();

    // 取第一个单词
    const parts = name.split(/\s+/);
    return parts[0] || name;
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 分析类型引用关系
 */
export function analyzeTypeReferences(
  rootPath: string,
  modules: ModuleNode[]
): TypeReference[] {
  const analyzer = new TypeReferenceAnalyzer(rootPath);
  return analyzer.analyze(modules);
}

/**
 * 分析类型使用
 */
export function analyzeTypeUsages(
  rootPath: string,
  modules: ModuleNode[]
): TypeUsage[] {
  const analyzer = new TypeUsageAnalyzer(rootPath);
  return analyzer.analyze(modules);
}
