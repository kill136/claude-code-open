/**
 * 权限策略引擎
 * 提供声明式策略语言和高级权限决策
 *
 * 功能：
 * - 声明式策略定义（支持复杂条件组合）
 * - 策略评估和规则匹配
 * - 多策略冲突解决（优先级、效果）
 * - 策略持久化（JSON 格式）
 * - 策略验证和调试
 */

import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';
import type { PermissionRequest, PermissionType } from './index.js';

// ============ 策略条件定义 ============

/**
 * 策略条件 - 支持复杂的逻辑组合
 */
export interface PolicyCondition {
  // 逻辑操作符
  and?: PolicyCondition[];
  or?: PolicyCondition[];
  not?: PolicyCondition;

  // 字段匹配条件
  type?: PermissionType | PermissionType[];
  tool?: string | string[] | RegExp;
  resource?: string | string[] | RegExp;
  path?: string | string[];  // glob patterns

  // 时间条件
  timeRange?: {
    start?: string;  // HH:MM format
    end?: string;    // HH:MM format
  };
  dateRange?: {
    start?: string;  // YYYY-MM-DD format
    end?: string;    // YYYY-MM-DD format
  };
  daysOfWeek?: number[];  // 0-6, 0=Sunday

  // 上下文条件
  environment?: {
    [key: string]: string | RegExp;
  };

  // 自定义条件函数（不可序列化，仅用于运行时）
  custom?: (request: PermissionRequest) => boolean;
}

/**
 * 策略规则 - 单个决策规则
 */
export interface PolicyRule {
  id: string;
  description?: string;
  condition: PolicyCondition;
  effect: 'allow' | 'deny';
  priority?: number;  // 规则内部优先级
}

/**
 * 策略 - 一组相关规则的集合
 */
export interface Policy {
  id: string;
  name: string;
  description?: string;
  version?: string;
  rules: PolicyRule[];
  priority: number;  // 策略优先级（越高越先评估）
  effect: 'allow' | 'deny';  // 默认效果（当没有规则匹配时）
  enabled?: boolean;
  metadata?: {
    author?: string;
    created?: string;
    modified?: string;
    tags?: string[];
  };
}

/**
 * 策略决策结果
 */
export interface PolicyDecision {
  allowed: boolean;
  policy?: string;      // 做出决策的策略 ID
  rule?: string;        // 匹配的规则 ID
  reason: string;
  priority: number;
  metadata?: {
    evaluatedPolicies?: number;
    evaluatedRules?: number;
    conflictResolution?: string;
  };
}

/**
 * 策略评估上下文
 */
export interface EvaluationContext {
  request: PermissionRequest;
  timestamp?: number;
  environment?: Record<string, string>;
  debug?: boolean;
}

/**
 * 策略验证结果
 */
export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============ 策略引擎实现 ============

/**
 * 权限策略引擎
 *
 * 提供基于策略的权限决策机制，支持：
 * - 声明式策略语言
 * - 复杂条件组合（AND/OR/NOT）
 * - 多策略冲突解决
 * - 策略持久化
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private configDir: string;
  private debug: boolean = false;

  constructor(configDir?: string, debug: boolean = false) {
    this.configDir = configDir ||
      process.env.CLAUDE_CONFIG_DIR ||
      path.join(process.env.HOME || '~', '.claude');
    this.debug = debug;
  }

  // ============ 策略评估 ============

  /**
   * 评估权限请求
   *
   * @param request 权限请求
   * @param context 额外的评估上下文
   * @returns 策略决策结果
   */
  evaluate(
    request: PermissionRequest,
    context?: Partial<EvaluationContext>
  ): PolicyDecision {
    const evalContext: EvaluationContext = {
      request,
      timestamp: context?.timestamp || Date.now(),
      environment: context?.environment || process.env as Record<string, string>,
      debug: context?.debug || this.debug,
    };

    // 获取所有启用的策略，按优先级排序
    const enabledPolicies = Array.from(this.policies.values())
      .filter(p => p.enabled !== false)
      .sort((a, b) => b.priority - a.priority);

    if (enabledPolicies.length === 0) {
      return {
        allowed: false,
        reason: 'No policies defined',
        priority: 0,
      };
    }

    const decisions: PolicyDecision[] = [];
    let evaluatedPolicies = 0;
    let evaluatedRules = 0;

    // 评估每个策略
    for (const policy of enabledPolicies) {
      evaluatedPolicies++;
      const decision = this.evaluatePolicy(policy, evalContext);

      if (decision) {
        decision.metadata = {
          ...decision.metadata,
          evaluatedPolicies,
          evaluatedRules,
        };
        decisions.push(decision);
      }

      // 评估规则
      evaluatedRules += policy.rules.length;
    }

    // 如果没有任何决策，返回默认拒绝
    if (decisions.length === 0) {
      return {
        allowed: false,
        reason: 'No matching policy rules',
        priority: 0,
        metadata: { evaluatedPolicies, evaluatedRules },
      };
    }

    // 解决冲突
    const finalDecision = this.resolveConflicts(decisions);
    finalDecision.metadata = {
      ...finalDecision.metadata,
      evaluatedPolicies,
      evaluatedRules,
    };

    return finalDecision;
  }

  /**
   * 评估单个策略
   *
   * @param policy 策略
   * @param context 评估上下文
   * @returns 策略决策结果，如果没有匹配则返回 null
   */
  private evaluatePolicy(
    policy: Policy,
    context: EvaluationContext
  ): PolicyDecision | null {
    // 按规则优先级排序
    const sortedRules = [...policy.rules].sort((a, b) =>
      (b.priority || 0) - (a.priority || 0)
    );

    // 评估每个规则
    for (const rule of sortedRules) {
      if (this.evaluateCondition(rule.condition, context)) {
        // 规则匹配
        return {
          allowed: rule.effect === 'allow',
          policy: policy.id,
          rule: rule.id,
          reason: rule.description || `Matched rule ${rule.id} in policy ${policy.name}`,
          priority: policy.priority,
        };
      }
    }

    // 没有规则匹配，使用策略的默认效果
    // 但只有在策略有显式默认效果时才返回决策
    return null;
  }

  /**
   * 评估条件是否匹配
   *
   * @param condition 策略条件
   * @param context 评估上下文
   * @returns 是否匹配
   */
  private evaluateCondition(
    condition: PolicyCondition,
    context: EvaluationContext
  ): boolean {
    const { request } = context;

    // 逻辑操作符
    if (condition.and) {
      return condition.and.every(c => this.evaluateCondition(c, context));
    }

    if (condition.or) {
      return condition.or.some(c => this.evaluateCondition(c, context));
    }

    if (condition.not) {
      return !this.evaluateCondition(condition.not, context);
    }

    // 字段匹配
    let matches = true;

    // 类型匹配
    if (condition.type !== undefined) {
      if (Array.isArray(condition.type)) {
        matches = matches && condition.type.includes(request.type);
      } else {
        matches = matches && request.type === condition.type;
      }
    }

    // 工具匹配
    if (condition.tool !== undefined) {
      matches = matches && this.matchesStringOrRegex(request.tool, condition.tool);
    }

    // 资源匹配
    if (condition.resource !== undefined && request.resource) {
      matches = matches && this.matchesStringOrRegex(request.resource, condition.resource);
    }

    // 路径匹配（glob patterns）
    if (condition.path !== undefined && request.resource) {
      const paths = Array.isArray(condition.path) ? condition.path : [condition.path];
      matches = matches && paths.some(pattern =>
        this.matchesGlobPattern(request.resource!, pattern)
      );
    }

    // 时间条件
    if (condition.timeRange) {
      matches = matches && this.matchesTimeRange(
        context.timestamp || Date.now(),
        condition.timeRange
      );
    }

    // 日期条件
    if (condition.dateRange) {
      matches = matches && this.matchesDateRange(
        context.timestamp || Date.now(),
        condition.dateRange
      );
    }

    // 星期条件
    if (condition.daysOfWeek !== undefined) {
      const day = new Date(context.timestamp || Date.now()).getDay();
      matches = matches && condition.daysOfWeek.includes(day);
    }

    // 环境变量匹配
    if (condition.environment && context.environment) {
      matches = matches && this.matchesEnvironment(
        context.environment,
        condition.environment
      );
    }

    // 自定义条件
    if (condition.custom) {
      matches = matches && condition.custom(request);
    }

    return matches;
  }

  // ============ 匹配辅助函数 ============

  /**
   * 匹配字符串或正则表达式
   */
  private matchesStringOrRegex(
    value: string,
    pattern: string | string[] | RegExp
  ): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }

    if (Array.isArray(pattern)) {
      return pattern.some(p => this.matchesStringOrRegex(value, p));
    }

    // 支持通配符
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(value, pattern, { nocase: false });
    }

    return value === pattern || value.includes(pattern);
  }

  /**
   * 匹配 glob 模式
   */
  private matchesGlobPattern(value: string, pattern: string): boolean {
    // 解析为绝对路径
    let resolvedValue = value;
    let resolvedPattern = pattern;

    try {
      resolvedValue = path.resolve(value);
    } catch {
      // 如果解析失败，使用原始值
    }

    // 如果 pattern 不包含通配符，将其视为前缀匹配
    if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
      try {
        resolvedPattern = path.resolve(pattern);
        return resolvedValue.startsWith(resolvedPattern);
      } catch {
        return value.startsWith(pattern);
      }
    }

    // 使用 minimatch 进行 glob 匹配
    return minimatch(resolvedValue, resolvedPattern, {
      dot: true,
      matchBase: false,
      nocase: process.platform === 'win32',
    });
  }

  /**
   * 匹配时间范围
   */
  private matchesTimeRange(
    timestamp: number,
    range: { start?: string; end?: string }
  ): boolean {
    const date = new Date(timestamp);
    const currentTime = date.getHours() * 60 + date.getMinutes();

    if (range.start) {
      const [startHour, startMin] = range.start.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      if (currentTime < startTime) return false;
    }

    if (range.end) {
      const [endHour, endMin] = range.end.split(':').map(Number);
      const endTime = endHour * 60 + endMin;
      if (currentTime > endTime) return false;
    }

    return true;
  }

  /**
   * 匹配日期范围
   */
  private matchesDateRange(
    timestamp: number,
    range: { start?: string; end?: string }
  ): boolean {
    const date = new Date(timestamp);
    const currentDate = date.toISOString().split('T')[0];

    if (range.start && currentDate < range.start) return false;
    if (range.end && currentDate > range.end) return false;

    return true;
  }

  /**
   * 匹配环境变量
   */
  private matchesEnvironment(
    environment: Record<string, string>,
    pattern: Record<string, string | RegExp>
  ): boolean {
    for (const [key, value] of Object.entries(pattern)) {
      const envValue = environment[key];
      if (!envValue) return false;

      if (value instanceof RegExp) {
        if (!value.test(envValue)) return false;
      } else {
        if (envValue !== value) return false;
      }
    }

    return true;
  }

  // ============ 冲突解决 ============

  /**
   * 解决多个策略决策之间的冲突
   *
   * 策略：
   * 1. Deny 优先于 Allow（安全优先）
   * 2. 高优先级优先于低优先级
   * 3. 显式决策优先于默认决策
   *
   * @param decisions 策略决策列表
   * @returns 最终决策
   */
  resolveConflicts(decisions: PolicyDecision[]): PolicyDecision {
    if (decisions.length === 0) {
      return {
        allowed: false,
        reason: 'No decisions to resolve',
        priority: 0,
      };
    }

    if (decisions.length === 1) {
      return decisions[0];
    }

    // 按优先级排序
    const sorted = [...decisions].sort((a, b) => b.priority - a.priority);

    // 检查是否有 deny 决策
    const denyDecisions = sorted.filter(d => !d.allowed);
    if (denyDecisions.length > 0) {
      // 取最高优先级的 deny
      const topDeny = denyDecisions[0];
      return {
        ...topDeny,
        reason: `${topDeny.reason} (deny takes precedence)`,
        metadata: {
          ...topDeny.metadata,
          conflictResolution: 'deny-precedence',
        },
      };
    }

    // 所有决策都是 allow，取最高优先级的
    const topAllow = sorted[0];
    return {
      ...topAllow,
      metadata: {
        ...topAllow.metadata,
        conflictResolution: 'priority-order',
      },
    };
  }

  // ============ 策略管理 ============

  /**
   * 添加策略
   */
  addPolicy(policy: Policy): void {
    // 验证策略
    const validation = this.validatePolicy(policy);
    if (!validation.valid) {
      throw new Error(`Invalid policy: ${validation.errors.join(', ')}`);
    }

    // 默认启用
    if (policy.enabled === undefined) {
      policy.enabled = true;
    }

    this.policies.set(policy.id, policy);

    if (this.debug) {
      console.log(`[PolicyEngine] Added policy: ${policy.id} (${policy.name})`);
    }
  }

  /**
   * 移除策略
   */
  removePolicy(id: string): void {
    const deleted = this.policies.delete(id);

    if (this.debug && deleted) {
      console.log(`[PolicyEngine] Removed policy: ${id}`);
    }
  }

  /**
   * 更新策略
   */
  updatePolicy(id: string, updates: Partial<Policy>): void {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`Policy not found: ${id}`);
    }

    const updated = { ...existing, ...updates, id };
    const validation = this.validatePolicy(updated);

    if (!validation.valid) {
      throw new Error(`Invalid policy update: ${validation.errors.join(', ')}`);
    }

    this.policies.set(id, updated);

    if (this.debug) {
      console.log(`[PolicyEngine] Updated policy: ${id}`);
    }
  }

  /**
   * 获取策略
   */
  getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  /**
   * 列出所有策略
   */
  listPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * 启用策略
   */
  enablePolicy(id: string): void {
    const policy = this.policies.get(id);
    if (!policy) {
      throw new Error(`Policy not found: ${id}`);
    }

    policy.enabled = true;

    if (this.debug) {
      console.log(`[PolicyEngine] Enabled policy: ${id}`);
    }
  }

  /**
   * 禁用策略
   */
  disablePolicy(id: string): void {
    const policy = this.policies.get(id);
    if (!policy) {
      throw new Error(`Policy not found: ${id}`);
    }

    policy.enabled = false;

    if (this.debug) {
      console.log(`[PolicyEngine] Disabled policy: ${id}`);
    }
  }

  /**
   * 清空所有策略
   */
  clearPolicies(): void {
    this.policies.clear();

    if (this.debug) {
      console.log('[PolicyEngine] Cleared all policies');
    }
  }

  // ============ 策略持久化 ============

  /**
   * 从文件加载策略
   *
   * @param filePath 策略文件路径（相对或绝对）
   */
  async loadPolicies(filePath: string): Promise<void> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.configDir, filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Policy file not found: ${resolvedPath}`);
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const data = JSON.parse(content);

      // 支持单个策略或策略数组
      const policies = Array.isArray(data) ? data : [data];

      for (const policyData of policies) {
        this.addPolicy(policyData);
      }

      if (this.debug) {
        console.log(`[PolicyEngine] Loaded ${policies.length} policies from ${resolvedPath}`);
      }
    } catch (err) {
      throw new Error(`Failed to load policies from ${resolvedPath}: ${err}`);
    }
  }

  /**
   * 保存策略到文件
   *
   * @param filePath 策略文件路径（相对或绝对）
   * @param policyIds 要保存的策略 ID（如果未指定，保存所有策略）
   */
  async savePolicies(filePath: string, policyIds?: string[]): Promise<void> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.configDir, filePath);

    // 确保目录存在
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      // 获取要保存的策略
      let policiesToSave: Policy[];
      if (policyIds) {
        policiesToSave = policyIds
          .map(id => this.policies.get(id))
          .filter((p): p is Policy => p !== undefined);
      } else {
        policiesToSave = Array.from(this.policies.values());
      }

      // 清理不可序列化的字段（custom 函数）
      const serializable = policiesToSave.map(policy => ({
        ...policy,
        rules: policy.rules.map(rule => ({
          ...rule,
          condition: this.sanitizeCondition(rule.condition),
        })),
      }));

      const content = JSON.stringify(serializable, null, 2);
      fs.writeFileSync(resolvedPath, content, 'utf-8');

      if (this.debug) {
        console.log(`[PolicyEngine] Saved ${policiesToSave.length} policies to ${resolvedPath}`);
      }
    } catch (err) {
      throw new Error(`Failed to save policies to ${resolvedPath}: ${err}`);
    }
  }

  /**
   * 清理条件中的不可序列化字段
   */
  private sanitizeCondition(condition: PolicyCondition): PolicyCondition {
    const sanitized: PolicyCondition = { ...condition };

    // 移除 custom 函数
    delete sanitized.custom;

    // 递归清理嵌套条件
    if (sanitized.and) {
      sanitized.and = sanitized.and.map(c => this.sanitizeCondition(c));
    }
    if (sanitized.or) {
      sanitized.or = sanitized.or.map(c => this.sanitizeCondition(c));
    }
    if (sanitized.not) {
      sanitized.not = this.sanitizeCondition(sanitized.not);
    }

    return sanitized;
  }

  // ============ 策略验证 ============

  /**
   * 验证策略定义
   *
   * @param policy 策略对象
   * @returns 验证结果
   */
  validatePolicy(policy: Policy): PolicyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本字段验证
    if (!policy.id || typeof policy.id !== 'string') {
      errors.push('Policy must have a valid id');
    }

    if (!policy.name || typeof policy.name !== 'string') {
      errors.push('Policy must have a valid name');
    }

    if (typeof policy.priority !== 'number') {
      errors.push('Policy must have a numeric priority');
    }

    if (!['allow', 'deny'].includes(policy.effect)) {
      errors.push('Policy effect must be "allow" or "deny"');
    }

    if (!Array.isArray(policy.rules)) {
      errors.push('Policy must have an array of rules');
    } else {
      // 验证每个规则
      policy.rules.forEach((rule, index) => {
        const ruleErrors = this.validateRule(rule, index);
        errors.push(...ruleErrors);
      });

      // 检查重复的规则 ID
      const ruleIds = policy.rules.map(r => r.id);
      const duplicates = ruleIds.filter((id, index) => ruleIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate rule IDs: ${duplicates.join(', ')}`);
      }
    }

    // 警告
    if (policy.rules.length === 0) {
      warnings.push('Policy has no rules (will always use default effect)');
    }

    if (policy.priority < 0) {
      warnings.push('Negative priority may cause unexpected evaluation order');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证规则
   */
  private validateRule(rule: PolicyRule, index: number): string[] {
    const errors: string[] = [];

    if (!rule.id || typeof rule.id !== 'string') {
      errors.push(`Rule ${index} must have a valid id`);
    }

    if (!['allow', 'deny'].includes(rule.effect)) {
      errors.push(`Rule ${index} effect must be "allow" or "deny"`);
    }

    if (!rule.condition || typeof rule.condition !== 'object') {
      errors.push(`Rule ${index} must have a condition object`);
    } else {
      const conditionErrors = this.validateCondition(rule.condition, `Rule ${index}`);
      errors.push(...conditionErrors);
    }

    return errors;
  }

  /**
   * 验证条件
   */
  private validateCondition(condition: PolicyCondition, path: string): string[] {
    const errors: string[] = [];

    // 检查逻辑操作符
    if (condition.and && !Array.isArray(condition.and)) {
      errors.push(`${path}: "and" must be an array`);
    }

    if (condition.or && !Array.isArray(condition.or)) {
      errors.push(`${path}: "or" must be an array`);
    }

    if (condition.not && typeof condition.not !== 'object') {
      errors.push(`${path}: "not" must be an object`);
    }

    // 递归验证嵌套条件
    if (condition.and) {
      condition.and.forEach((c, i) => {
        errors.push(...this.validateCondition(c, `${path}.and[${i}]`));
      });
    }

    if (condition.or) {
      condition.or.forEach((c, i) => {
        errors.push(...this.validateCondition(c, `${path}.or[${i}]`));
      });
    }

    if (condition.not) {
      errors.push(...this.validateCondition(condition.not, `${path}.not`));
    }

    // 检查时间格式
    if (condition.timeRange) {
      if (condition.timeRange.start && !/^\d{2}:\d{2}$/.test(condition.timeRange.start)) {
        errors.push(`${path}: timeRange.start must be in HH:MM format`);
      }
      if (condition.timeRange.end && !/^\d{2}:\d{2}$/.test(condition.timeRange.end)) {
        errors.push(`${path}: timeRange.end must be in HH:MM format`);
      }
    }

    // 检查日期格式
    if (condition.dateRange) {
      if (condition.dateRange.start && !/^\d{4}-\d{2}-\d{2}$/.test(condition.dateRange.start)) {
        errors.push(`${path}: dateRange.start must be in YYYY-MM-DD format`);
      }
      if (condition.dateRange.end && !/^\d{4}-\d{2}-\d{2}$/.test(condition.dateRange.end)) {
        errors.push(`${path}: dateRange.end must be in YYYY-MM-DD format`);
      }
    }

    return errors;
  }

  // ============ 调试和工具方法 ============

  /**
   * 设置调试模式
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * 导出策略引擎状态
   */
  export(): object {
    return {
      policies: Array.from(this.policies.entries()).map(([id, policy]) => ({
        id,
        ...policy,
      })),
      configDir: this.configDir,
      debug: this.debug,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPolicies: number;
    enabledPolicies: number;
    disabledPolicies: number;
    totalRules: number;
  } {
    const policies = Array.from(this.policies.values());
    const enabled = policies.filter(p => p.enabled !== false);
    const disabled = policies.filter(p => p.enabled === false);
    const totalRules = policies.reduce((sum, p) => sum + p.rules.length, 0);

    return {
      totalPolicies: policies.length,
      enabledPolicies: enabled.length,
      disabledPolicies: disabled.length,
      totalRules,
    };
  }
}

// ============ 策略构建器（便捷 API） ============

/**
 * 策略构建器 - 提供流畅的 API 来构建策略
 */
export class PolicyBuilder {
  private policy: Partial<Policy> = {
    rules: [],
    priority: 100,
    effect: 'deny',
    enabled: true,
  };

  constructor(id: string, name: string) {
    this.policy.id = id;
    this.policy.name = name;
  }

  description(desc: string): this {
    this.policy.description = desc;
    return this;
  }

  priority(priority: number): this {
    this.policy.priority = priority;
    return this;
  }

  defaultEffect(effect: 'allow' | 'deny'): this {
    this.policy.effect = effect;
    return this;
  }

  addRule(rule: PolicyRule): this {
    this.policy.rules!.push(rule);
    return this;
  }

  build(): Policy {
    if (!this.policy.id || !this.policy.name) {
      throw new Error('Policy must have id and name');
    }

    return this.policy as Policy;
  }
}

/**
 * 规则构建器
 */
export class RuleBuilder {
  private rule: Partial<PolicyRule> = {
    condition: {},
  };

  constructor(id: string, effect: 'allow' | 'deny') {
    this.rule.id = id;
    this.rule.effect = effect;
  }

  description(desc: string): this {
    this.rule.description = desc;
    return this;
  }

  priority(priority: number): this {
    this.rule.priority = priority;
    return this;
  }

  type(type: PermissionType | PermissionType[]): this {
    this.rule.condition!.type = type;
    return this;
  }

  tool(tool: string | string[] | RegExp): this {
    this.rule.condition!.tool = tool;
    return this;
  }

  resource(resource: string | string[] | RegExp): this {
    this.rule.condition!.resource = resource;
    return this;
  }

  path(path: string | string[]): this {
    this.rule.condition!.path = path;
    return this;
  }

  custom(fn: (request: PermissionRequest) => boolean): this {
    this.rule.condition!.custom = fn;
    return this;
  }

  build(): PolicyRule {
    if (!this.rule.id || !this.rule.effect) {
      throw new Error('Rule must have id and effect');
    }

    return this.rule as PolicyRule;
  }
}

// ============ 预定义策略模板 ============

/**
 * 创建只读模式策略
 */
export function createReadOnlyPolicy(id: string = 'read-only'): Policy {
  return new PolicyBuilder(id, 'Read-Only Mode')
    .description('Allow only read operations, deny all write/delete/execute operations')
    .priority(1000)
    .defaultEffect('deny')
    .addRule(
      new RuleBuilder('allow-reads', 'allow')
        .description('Allow all read operations')
        .type('file_read')
        .build()
    )
    .addRule(
      new RuleBuilder('deny-writes', 'deny')
        .description('Deny all write operations')
        .type(['file_write', 'file_delete'])
        .build()
    )
    .addRule(
      new RuleBuilder('deny-bash', 'deny')
        .description('Deny all bash commands')
        .type('bash_command')
        .build()
    )
    .build();
}

/**
 * 创建工作时间策略
 */
export function createWorkHoursPolicy(
  id: string = 'work-hours',
  start: string = '09:00',
  end: string = '18:00'
): Policy {
  return new PolicyBuilder(id, 'Work Hours Policy')
    .description(`Allow operations only during work hours (${start}-${end})`)
    .priority(500)
    .defaultEffect('deny')
    .addRule({
      id: 'work-hours-allow',
      effect: 'allow',
      description: 'Allow operations during work hours',
      condition: {
        timeRange: { start, end },
        daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
      },
    })
    .build();
}

/**
 * 创建路径白名单策略
 */
export function createPathWhitelistPolicy(
  id: string,
  allowedPaths: string[]
): Policy {
  return new PolicyBuilder(id, 'Path Whitelist')
    .description('Allow operations only in specified paths')
    .priority(800)
    .defaultEffect('deny')
    .addRule({
      id: 'path-whitelist',
      effect: 'allow',
      description: 'Allow operations in whitelisted paths',
      condition: {
        type: ['file_read', 'file_write', 'file_delete'],
        path: allowedPaths,
      },
    })
    .build();
}
