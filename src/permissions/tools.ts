/**
 * T071: 细粒度工具权限控制系统
 *
 * 功能：
 * - 工具级权限：每个工具的单独权限设置
 * - 参数级权限：特定参数值的限制
 * - 上下文权限：基于会话/目录的权限
 * - 权限继承：从全局到项目的继承
 *
 * 架构设计：
 * - 多层权限检查（工具 -> 参数 -> 上下文 -> 条件）
 * - 支持动态权限规则和验证器
 * - 与现有 PermissionManager 集成
 */

import * as path from 'path';
import * as fs from 'fs';
import { minimatch } from 'minimatch';

// ============ 核心类型定义 ============

/**
 * 权限条件类型
 */
export type ConditionType = 'context' | 'time' | 'user' | 'session' | 'custom';

/**
 * 条件运算符
 */
export type ConditionOperator =
  | 'equals'        // 精确匹配
  | 'notEquals'     // 不等于
  | 'contains'      // 包含
  | 'notContains'   // 不包含
  | 'matches'       // 正则匹配
  | 'notMatches'    // 正则不匹配
  | 'range'         // 范围（数字、日期等）
  | 'in'            // 在列表中
  | 'notIn'         // 不在列表中
  | 'custom';       // 自定义验证函数

/**
 * 权限条件
 */
export interface PermissionCondition {
  type: ConditionType;
  field?: string;                              // 条件字段（如 'workingDirectory', 'timestamp'）
  operator: ConditionOperator;
  value: unknown;
  validator?: (context: PermissionContext) => boolean;  // 自定义验证器
  description?: string;                        // 条件描述
}

/**
 * 参数限制类型
 */
export type RestrictionType = 'whitelist' | 'blacklist' | 'pattern' | 'validator' | 'range';

/**
 * 参数限制
 */
export interface ParameterRestriction {
  parameter: string;                           // 参数名称
  type: RestrictionType;
  values?: unknown[];                          // 白名单/黑名单值列表
  pattern?: RegExp | string;                   // 正则模式
  validator?: (value: unknown) => boolean;     // 自定义验证器
  min?: number;                                // 范围最小值
  max?: number;                                // 范围最大值
  required?: boolean;                          // 是否必需
  description?: string;                        // 限制描述
}

/**
 * 工具权限定义
 */
export interface ToolPermission {
  tool: string;                                // 工具名称（支持通配符）
  allowed: boolean;                            // 是否允许
  priority?: number;                           // 优先级（越高越优先，默认 0）
  conditions?: PermissionCondition[];          // 条件列表（AND 关系）
  parameterRestrictions?: ParameterRestriction[];  // 参数限制
  scope?: 'global' | 'project' | 'session';    // 权限范围
  reason?: string;                             // 权限设置原因
  expiresAt?: number;                          // 过期时间（时间戳）
  metadata?: Record<string, unknown>;          // 额外元数据
}

/**
 * 权限上下文
 */
export interface PermissionContext {
  workingDirectory: string;                    // 当前工作目录
  sessionId: string;                           // 会话 ID
  timestamp: number;                           // 当前时间戳
  user?: string;                               // 用户标识
  environment?: Record<string, string>;        // 环境变量
  metadata?: Record<string, unknown>;          // 额外元数据
}

/**
 * 权限检查结果
 */
export interface PermissionResult {
  allowed: boolean;                            // 是否允许
  reason?: string;                             // 原因说明
  restricted?: boolean;                        // 是否受限（部分限制）
  suggestions?: string[];                      // 建议操作
  matchedRule?: ToolPermission;                // 匹配的权限规则
  violations?: string[];                       // 违规详情
}

/**
 * 权限继承配置
 */
export interface PermissionInheritance {
  inheritGlobal: boolean;                      // 是否继承全局权限
  inheritProject: boolean;                     // 是否继承项目权限
  overrideGlobal: boolean;                     // 是否覆盖全局权限
  mergeStrategy: 'override' | 'merge' | 'union';  // 合并策略
}

/**
 * 权限统计
 */
export interface PermissionStats {
  totalPermissions: number;
  allowedTools: number;
  deniedTools: number;
  conditionalTools: number;
  restrictedParameters: number;
  activeContexts: number;
}

// ============ 工具权限管理器 ============

export class ToolPermissionManager {
  private globalPermissions: Map<string, ToolPermission> = new Map();
  private projectPermissions: Map<string, ToolPermission> = new Map();
  private sessionPermissions: Map<string, ToolPermission> = new Map();

  private inheritance: PermissionInheritance = {
    inheritGlobal: true,
    inheritProject: true,
    overrideGlobal: true,
    mergeStrategy: 'override',
  };

  private configDir: string;
  private globalPermissionsFile: string;
  private projectPermissionsFile: string;

  constructor(configDir?: string) {
    this.configDir = configDir ||
                     process.env.CLAUDE_CONFIG_DIR ||
                     path.join(process.env.HOME || '~', '.claude');

    this.globalPermissionsFile = path.join(this.configDir, 'tool-permissions.json');
    this.projectPermissionsFile = path.join(process.cwd(), '.claude', 'tool-permissions.json');

    // 加载权限配置
    this.loadPermissions();
  }

  // ============ 核心权限检查 ============

  /**
   * 检查工具是否允许执行
   */
  isAllowed(
    tool: string,
    params: Record<string, unknown>,
    context: PermissionContext
  ): PermissionResult {
    // 1. 获取所有适用的权限规则（按优先级排序）
    const applicableRules = this.getApplicableRules(tool, context);

    if (applicableRules.length === 0) {
      // 没有规则时默认允许
      return {
        allowed: true,
        reason: 'No specific permissions defined, allowing by default',
      };
    }

    // 2. 按优先级检查每个规则
    for (const rule of applicableRules) {
      // 检查是否过期
      if (rule.expiresAt && rule.expiresAt < context.timestamp) {
        continue;
      }

      // 检查条件
      const conditionResult = this.checkConditions(rule, context);
      if (!conditionResult.match) {
        continue; // 条件不匹配，继续下一个规则
      }

      // 检查参数限制
      const paramResult = this.checkParameterRestrictions(rule, params);
      if (!paramResult.allowed) {
        return {
          allowed: false,
          restricted: true,
          reason: paramResult.reason,
          matchedRule: rule,
          violations: paramResult.violations,
          suggestions: this.generateSuggestions(rule, paramResult.violations || []),
        };
      }

      // 规则匹配且条件满足
      if (rule.allowed) {
        return {
          allowed: true,
          reason: rule.reason || 'Permission granted by matching rule',
          matchedRule: rule,
        };
      } else {
        return {
          allowed: false,
          reason: rule.reason || 'Permission denied by matching rule',
          matchedRule: rule,
          suggestions: this.generateSuggestions(rule, []),
        };
      }
    }

    // 没有匹配的规则，默认允许
    return {
      allowed: true,
      reason: 'No matching rules, allowing by default',
    };
  }

  /**
   * 检查特定参数的限制
   */
  checkParameterRestriction(
    tool: string,
    param: string,
    value: unknown
  ): boolean {
    const rules = this.getApplicableRules(tool, {
      workingDirectory: process.cwd(),
      sessionId: 'default',
      timestamp: Date.now(),
    });

    for (const rule of rules) {
      if (!rule.parameterRestrictions) continue;

      const restriction = rule.parameterRestrictions.find(r => r.parameter === param);
      if (!restriction) continue;

      const result = this.validateParameterRestriction(restriction, value);
      if (!result) return false;
    }

    return true;
  }

  // ============ 权限管理 ============

  /**
   * 添加权限规则
   */
  addPermission(
    permission: ToolPermission,
    scope: 'global' | 'project' | 'session' = 'session'
  ): void {
    const targetMap = this.getPermissionMap(scope);
    targetMap.set(permission.tool, {
      ...permission,
      scope,
      priority: permission.priority ?? 0,
    });

    // 持久化（如果不是会话级）
    if (scope !== 'session') {
      this.savePermissions(scope);
    }
  }

  /**
   * 移除权限规则
   */
  removePermission(tool: string, scope?: 'global' | 'project' | 'session'): void {
    if (scope) {
      this.getPermissionMap(scope).delete(tool);
      if (scope !== 'session') {
        this.savePermissions(scope);
      }
    } else {
      // 移除所有范围的权限
      this.globalPermissions.delete(tool);
      this.projectPermissions.delete(tool);
      this.sessionPermissions.delete(tool);
      this.savePermissions('global');
      this.savePermissions('project');
    }
  }

  /**
   * 更新权限规则
   */
  updatePermission(
    tool: string,
    updates: Partial<ToolPermission>,
    scope: 'global' | 'project' | 'session' = 'session'
  ): boolean {
    const targetMap = this.getPermissionMap(scope);
    const existing = targetMap.get(tool);

    if (!existing) return false;

    targetMap.set(tool, {
      ...existing,
      ...updates,
      tool, // 保持工具名不变
      scope, // 保持范围不变
    });

    if (scope !== 'session') {
      this.savePermissions(scope);
    }

    return true;
  }

  /**
   * 获取所有权限规则
   */
  getPermissions(scope?: 'global' | 'project' | 'session'): ToolPermission[] {
    if (scope) {
      return Array.from(this.getPermissionMap(scope).values());
    }

    // 合并所有范围的权限
    return this.getMergedPermissions();
  }

  /**
   * 获取特定工具的权限
   */
  getToolPermission(tool: string): ToolPermission | undefined {
    // 按优先级：会话 > 项目 > 全局
    return this.sessionPermissions.get(tool) ||
           this.projectPermissions.get(tool) ||
           this.globalPermissions.get(tool);
  }

  /**
   * 清空所有权限
   */
  clearPermissions(scope?: 'global' | 'project' | 'session'): void {
    if (scope) {
      this.getPermissionMap(scope).clear();
      if (scope !== 'session') {
        this.savePermissions(scope);
      }
    } else {
      this.globalPermissions.clear();
      this.projectPermissions.clear();
      this.sessionPermissions.clear();
      this.savePermissions('global');
      this.savePermissions('project');
    }
  }

  // ============ 权限继承 ============

  /**
   * 设置继承配置
   */
  setInheritance(config: Partial<PermissionInheritance>): void {
    this.inheritance = {
      ...this.inheritance,
      ...config,
    };
  }

  /**
   * 获取继承配置
   */
  getInheritance(): PermissionInheritance {
    return { ...this.inheritance };
  }

  // ============ 统计和查询 ============

  /**
   * 获取权限统计
   */
  getStats(): PermissionStats {
    const allPermissions = this.getMergedPermissions();

    return {
      totalPermissions: allPermissions.length,
      allowedTools: allPermissions.filter(p => p.allowed).length,
      deniedTools: allPermissions.filter(p => !p.allowed).length,
      conditionalTools: allPermissions.filter(p => p.conditions && p.conditions.length > 0).length,
      restrictedParameters: allPermissions.reduce((sum, p) =>
        sum + (p.parameterRestrictions?.length || 0), 0),
      activeContexts: 3, // global, project, session
    };
  }

  /**
   * 查询权限
   */
  queryPermissions(filter: {
    allowed?: boolean;
    scope?: 'global' | 'project' | 'session';
    hasConditions?: boolean;
    hasRestrictions?: boolean;
    toolPattern?: string;
  }): ToolPermission[] {
    let permissions = filter.scope
      ? this.getPermissions(filter.scope)
      : this.getMergedPermissions();

    if (filter.allowed !== undefined) {
      permissions = permissions.filter(p => p.allowed === filter.allowed);
    }

    if (filter.hasConditions !== undefined) {
      permissions = permissions.filter(p =>
        filter.hasConditions
          ? (p.conditions && p.conditions.length > 0)
          : (!p.conditions || p.conditions.length === 0)
      );
    }

    if (filter.hasRestrictions !== undefined) {
      permissions = permissions.filter(p =>
        filter.hasRestrictions
          ? (p.parameterRestrictions && p.parameterRestrictions.length > 0)
          : (!p.parameterRestrictions || p.parameterRestrictions.length === 0)
      );
    }

    if (filter.toolPattern) {
      permissions = permissions.filter(p =>
        this.matchPattern(p.tool, filter.toolPattern!)
      );
    }

    return permissions;
  }

  // ============ 导入/导出 ============

  /**
   * 导出权限配置
   */
  export(scope?: 'global' | 'project' | 'session'): string {
    const permissions = scope
      ? this.getPermissions(scope)
      : this.getMergedPermissions();

    return JSON.stringify({
      version: '1.0.0',
      inheritance: this.inheritance,
      permissions,
    }, null, 2);
  }

  /**
   * 导入权限配置
   */
  import(
    configJson: string,
    scope: 'global' | 'project' | 'session' = 'session'
  ): boolean {
    try {
      const config = JSON.parse(configJson);

      if (config.inheritance) {
        this.setInheritance(config.inheritance);
      }

      if (config.permissions && Array.isArray(config.permissions)) {
        const targetMap = this.getPermissionMap(scope);
        targetMap.clear();

        for (const perm of config.permissions) {
          targetMap.set(perm.tool, { ...perm, scope });
        }

        if (scope !== 'session') {
          this.savePermissions(scope);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to import permissions:', error);
      return false;
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 获取适用的规则（已排序）
   */
  private getApplicableRules(
    tool: string,
    context: PermissionContext
  ): ToolPermission[] {
    const allPermissions = this.getMergedPermissions();

    // 筛选匹配的规则
    const matching = allPermissions.filter(perm =>
      this.matchPattern(tool, perm.tool)
    );

    // 按优先级排序（高 -> 低）
    return matching.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 检查条件是否满足
   */
  private checkConditions(
    rule: ToolPermission,
    context: PermissionContext
  ): { match: boolean; reason?: string } {
    if (!rule.conditions || rule.conditions.length === 0) {
      return { match: true };
    }

    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return {
          match: false,
          reason: condition.description || 'Condition not met',
        };
      }
    }

    return { match: true };
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(
    condition: PermissionCondition,
    context: PermissionContext
  ): boolean {
    // 自定义验证器优先
    if (condition.validator) {
      return condition.validator(context);
    }

    // 获取上下文字段值
    const contextValue = condition.field
      ? this.getContextField(context, condition.field)
      : null;

    // 根据运算符评估
    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;

      case 'notEquals':
        return contextValue !== condition.value;

      case 'contains':
        if (typeof contextValue === 'string' && typeof condition.value === 'string') {
          return contextValue.includes(condition.value);
        }
        if (Array.isArray(contextValue)) {
          return contextValue.includes(condition.value);
        }
        return false;

      case 'notContains':
        if (typeof contextValue === 'string' && typeof condition.value === 'string') {
          return !contextValue.includes(condition.value);
        }
        if (Array.isArray(contextValue)) {
          return !contextValue.includes(condition.value);
        }
        return true;

      case 'matches':
        if (typeof contextValue === 'string') {
          const pattern = condition.value instanceof RegExp
            ? condition.value
            : new RegExp(String(condition.value));
          return pattern.test(contextValue);
        }
        return false;

      case 'notMatches':
        if (typeof contextValue === 'string') {
          const pattern = condition.value instanceof RegExp
            ? condition.value
            : new RegExp(String(condition.value));
          return !pattern.test(contextValue);
        }
        return true;

      case 'range':
        if (typeof contextValue === 'number' && Array.isArray(condition.value)) {
          const [min, max] = condition.value as number[];
          return contextValue >= min && contextValue <= max;
        }
        return false;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);

      case 'notIn':
        return !Array.isArray(condition.value) || !condition.value.includes(contextValue);

      case 'custom':
        return condition.validator ? condition.validator(context) : false;

      default:
        return false;
    }
  }

  /**
   * 获取上下文字段值
   */
  private getContextField(context: PermissionContext, field: string): unknown {
    const fields: Record<string, unknown> = {
      workingDirectory: context.workingDirectory,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      user: context.user,
      ...context.metadata,
    };

    return fields[field];
  }

  /**
   * 检查参数限制
   */
  private checkParameterRestrictions(
    rule: ToolPermission,
    params: Record<string, unknown>
  ): { allowed: boolean; reason?: string; violations?: string[] } {
    if (!rule.parameterRestrictions || rule.parameterRestrictions.length === 0) {
      return { allowed: true };
    }

    const violations: string[] = [];

    for (const restriction of rule.parameterRestrictions) {
      const paramValue = params[restriction.parameter];

      // 检查必需参数
      if (restriction.required && paramValue === undefined) {
        violations.push(`Required parameter '${restriction.parameter}' is missing`);
        continue;
      }

      if (paramValue === undefined) continue;

      // 验证参数限制
      if (!this.validateParameterRestriction(restriction, paramValue)) {
        violations.push(
          restriction.description ||
          `Parameter '${restriction.parameter}' violates restriction`
        );
      }
    }

    if (violations.length > 0) {
      return {
        allowed: false,
        reason: 'Parameter restrictions violated',
        violations,
      };
    }

    return { allowed: true };
  }

  /**
   * 验证单个参数限制
   */
  private validateParameterRestriction(
    restriction: ParameterRestriction,
    value: unknown
  ): boolean {
    switch (restriction.type) {
      case 'whitelist':
        return restriction.values?.includes(value) ?? false;

      case 'blacklist':
        return !(restriction.values?.includes(value) ?? true);

      case 'pattern':
        if (typeof value === 'string' && restriction.pattern) {
          const pattern = restriction.pattern instanceof RegExp
            ? restriction.pattern
            : new RegExp(restriction.pattern);
          return pattern.test(value);
        }
        return false;

      case 'validator':
        return restriction.validator ? restriction.validator(value) : true;

      case 'range':
        if (typeof value === 'number') {
          if (restriction.min !== undefined && value < restriction.min) return false;
          if (restriction.max !== undefined && value > restriction.max) return false;
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    rule: ToolPermission,
    violations: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (!rule.allowed) {
      suggestions.push(`Tool '${rule.tool}' is not allowed in current context`);

      if (rule.reason) {
        suggestions.push(`Reason: ${rule.reason}`);
      }

      if (rule.scope) {
        suggestions.push(`Permission scope: ${rule.scope}`);
      }
    }

    if (violations.length > 0) {
      suggestions.push('Parameter violations detected:');
      suggestions.push(...violations.map(v => `  - ${v}`));
    }

    if (rule.parameterRestrictions && rule.parameterRestrictions.length > 0) {
      suggestions.push('Allowed parameter values:');
      for (const restriction of rule.parameterRestrictions) {
        if (restriction.type === 'whitelist' && restriction.values) {
          suggestions.push(`  ${restriction.parameter}: ${restriction.values.join(', ')}`);
        }
      }
    }

    return suggestions;
  }

  /**
   * 模式匹配（支持通配符）
   */
  private matchPattern(value: string, pattern: string): boolean {
    // 精确匹配
    if (value === pattern) return true;

    // 通配符匹配
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(value, pattern, { nocase: false });
    }

    return false;
  }

  /**
   * 获取权限映射表
   */
  private getPermissionMap(
    scope: 'global' | 'project' | 'session'
  ): Map<string, ToolPermission> {
    switch (scope) {
      case 'global': return this.globalPermissions;
      case 'project': return this.projectPermissions;
      case 'session': return this.sessionPermissions;
    }
  }

  /**
   * 合并所有权限（考虑继承）
   */
  private getMergedPermissions(): ToolPermission[] {
    const merged = new Map<string, ToolPermission>();

    // 1. 全局权限（如果继承）
    if (this.inheritance.inheritGlobal) {
      for (const [key, perm] of this.globalPermissions) {
        merged.set(key, perm);
      }
    }

    // 2. 项目权限（如果继承，根据策略合并）
    if (this.inheritance.inheritProject) {
      for (const [key, perm] of this.projectPermissions) {
        if (this.inheritance.mergeStrategy === 'override') {
          merged.set(key, perm);
        } else if (this.inheritance.mergeStrategy === 'merge') {
          const existing = merged.get(key);
          if (existing) {
            merged.set(key, this.mergePermissions(existing, perm));
          } else {
            merged.set(key, perm);
          }
        } else {
          // union
          merged.set(key, perm);
        }
      }
    }

    // 3. 会话权限（总是最高优先级）
    for (const [key, perm] of this.sessionPermissions) {
      merged.set(key, perm);
    }

    return Array.from(merged.values());
  }

  /**
   * 合并两个权限规则
   */
  private mergePermissions(
    base: ToolPermission,
    override: ToolPermission
  ): ToolPermission {
    return {
      ...base,
      ...override,
      conditions: [
        ...(base.conditions || []),
        ...(override.conditions || []),
      ],
      parameterRestrictions: [
        ...(base.parameterRestrictions || []),
        ...(override.parameterRestrictions || []),
      ],
      priority: Math.max(base.priority || 0, override.priority || 0),
    };
  }

  /**
   * 加载权限配置
   */
  private loadPermissions(): void {
    // 加载全局权限
    this.loadPermissionsFromFile(this.globalPermissionsFile, this.globalPermissions);

    // 加载项目权限
    this.loadPermissionsFromFile(this.projectPermissionsFile, this.projectPermissions);
  }

  /**
   * 从文件加载权限
   */
  private loadPermissionsFromFile(
    filePath: string,
    targetMap: Map<string, ToolPermission>
  ): void {
    if (!fs.existsSync(filePath)) return;

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(data);

      if (config.inheritance) {
        this.inheritance = { ...this.inheritance, ...config.inheritance };
      }

      if (config.permissions && Array.isArray(config.permissions)) {
        for (const perm of config.permissions) {
          targetMap.set(perm.tool, perm);
        }
      }
    } catch (error) {
      console.warn(`Failed to load permissions from ${filePath}:`, error);
    }
  }

  /**
   * 保存权限配置
   */
  private savePermissions(scope: 'global' | 'project'): void {
    const filePath = scope === 'global'
      ? this.globalPermissionsFile
      : this.projectPermissionsFile;

    const permissions = Array.from(this.getPermissionMap(scope).values());

    const config = {
      version: '1.0.0',
      inheritance: this.inheritance,
      permissions,
    };

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save permissions to ${filePath}:`, error);
    }
  }
}

// ============ 预设权限模板 ============

export const PERMISSION_TEMPLATES = {
  /**
   * 只读模式：仅允许读取操作
   */
  readOnly: (): ToolPermission[] => [
    { tool: 'Read', allowed: true, reason: 'Read-only mode' },
    { tool: 'Glob', allowed: true, reason: 'Read-only mode' },
    { tool: 'Grep', allowed: true, reason: 'Read-only mode' },
    { tool: 'WebFetch', allowed: true, reason: 'Read-only mode' },
    { tool: 'Write', allowed: false, reason: 'Read-only mode' },
    { tool: 'Edit', allowed: false, reason: 'Read-only mode' },
    { tool: 'MultiEdit', allowed: false, reason: 'Read-only mode' },
    { tool: 'Bash', allowed: false, reason: 'Read-only mode' },
  ],

  /**
   * 安全模式：禁止危险操作
   */
  safe: (): ToolPermission[] => [
    {
      tool: 'Bash',
      allowed: true,
      parameterRestrictions: [
        {
          parameter: 'command',
          type: 'blacklist',
          values: ['rm', 'sudo', 'chmod', 'chown', 'dd', 'mkfs'],
          description: 'Dangerous commands not allowed',
        },
      ],
      reason: 'Safe mode',
    },
    {
      tool: 'Write',
      allowed: true,
      parameterRestrictions: [
        {
          parameter: 'file_path',
          type: 'pattern',
          pattern: /^(?!\/etc|\/sys|\/proc)/,
          description: 'System directories not allowed',
        },
      ],
      reason: 'Safe mode',
    },
  ],

  /**
   * 项目限制：仅允许当前项目目录
   */
  projectOnly: (projectDir: string): ToolPermission[] => [
    {
      tool: '*',
      allowed: true,
      conditions: [
        {
          type: 'context',
          field: 'workingDirectory',
          operator: 'contains',
          value: projectDir,
          description: 'Must be in project directory',
        },
      ],
      reason: 'Project-only mode',
    },
  ],

  /**
   * 时间限制：仅在特定时间段允许
   */
  timeRestricted: (startHour: number, endHour: number): ToolPermission[] => [
    {
      tool: '*',
      allowed: true,
      conditions: [
        {
          type: 'time',
          operator: 'custom',
          value: null,
          validator: (context) => {
            const hour = new Date(context.timestamp).getHours();
            return hour >= startHour && hour < endHour;
          },
          description: `Only allowed between ${startHour}:00 and ${endHour}:00`,
        },
      ],
      reason: 'Time-restricted mode',
    },
  ],
};

// ============ 导出全局实例 ============

export const toolPermissionManager = new ToolPermissionManager();
