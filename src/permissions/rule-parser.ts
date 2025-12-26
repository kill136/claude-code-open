/**
 * T-015: 权限规则解析器
 *
 * 功能：
 * - 解析官方 Claude Code 权限规则语法
 * - 支持 Bash(command:pattern) 命令匹配
 * - 支持 Read/Write/Edit(path/**) 路径通配符
 * - 支持工具参数级别的权限控制
 * - 实现权限规则的优先级排序 (deny > allow > default)
 *
 * 语法示例：
 * - "Bash" - 匹配所有 Bash 命令
 * - "Bash(*)" - 同上，匹配所有 Bash 命令
 * - "Bash(npm:*)" - 匹配以 npm 开头的命令
 * - "Bash(npm install:*)" - 匹配以 "npm install" 开头的命令
 * - "Read" - 匹配所有 Read 操作
 * - "Read(/home/user/**)" - 匹配 /home/user/ 及其子目录下的所有文件
 * - "Write(src/*.ts)" - 匹配 src 目录下的 .ts 文件
 * - "Edit(*.md)" - 匹配所有 .md 文件
 */

import * as path from 'path';
import { minimatch } from 'minimatch';

// ============ 类型定义 ============

/**
 * 权限规则类型
 */
export type RuleType = 'allow' | 'deny';

/**
 * 规则来源
 */
export type RuleSource =
  | 'cli'              // 命令行参数
  | 'settings'         // 用户设置 (~/.claude/settings.json)
  | 'project'          // 项目设置 (.claude/settings.json)
  | 'policy'           // 策略文件
  | 'session'          // 会话记忆
  | 'runtime';         // 运行时动态添加

/**
 * 解析后的权限规则
 */
export interface ParsedRule {
  /** 原始规则字符串 */
  raw: string;

  /** 规则类型: allow 或 deny */
  type: RuleType;

  /** 工具名称 (如 "Bash", "Read", "Write") */
  tool: string;

  /** 是否有参数限制 */
  hasParams: boolean;

  /** 参数模式 (如 "npm install:*", "/home/**") */
  paramPattern?: string;

  /** 解析后的参数匹配器 */
  matcher?: ParameterMatcher;

  /** 规则优先级 (数值越高优先级越高) */
  priority: number;

  /** 规则来源 */
  source: RuleSource;

  /** 创建时间戳 */
  createdAt: number;

  /** 描述信息 */
  description?: string;
}

/**
 * 参数匹配器类型
 */
export type ParameterMatcherType =
  | 'any'           // 匹配任意参数 (*)
  | 'prefix'        // 前缀匹配 (npm:*)
  | 'exact'         // 精确匹配
  | 'glob'          // Glob 模式匹配 (**/*.ts)
  | 'regex';        // 正则表达式匹配

/**
 * 参数匹配器
 */
export interface ParameterMatcher {
  type: ParameterMatcherType;
  pattern: string;
  /** 对于命令匹配，这是命令前缀 */
  commandPrefix?: string;
  /** 对于路径匹配，这是路径模式 */
  pathPattern?: string;
  /** 编译后的正则表达式 */
  regex?: RegExp;
}

/**
 * 工具输入参数
 */
export interface ToolInput {
  /** 工具名称 */
  tool: string;
  /** 工具参数 */
  params: Record<string, unknown>;
}

/**
 * 权限检查结果
 */
export interface RuleCheckResult {
  /** 是否匹配到规则 */
  matched: boolean;
  /** 匹配的规则 */
  rule?: ParsedRule;
  /** 是否允许 */
  allowed: boolean;
  /** 原因说明 */
  reason: string;
}

/**
 * 解析错误
 */
export class RuleParseError extends Error {
  constructor(
    public rule: string,
    message: string
  ) {
    super(`Failed to parse rule "${rule}": ${message}`);
    this.name = 'RuleParseError';
  }
}

// ============ 规则解析器 ============

/**
 * 权限规则解析器
 *
 * 解析官方 Claude Code 权限规则语法，支持：
 * - 工具级权限 (Bash, Read, Write, etc.)
 * - 命令级权限 (Bash(npm:*), Bash(git diff:*))
 * - 路径级权限 (Read(/path/**), Write(src/*.ts))
 */
export class PermissionRuleParser {
  // 规则语法正则表达式
  // 匹配格式: ToolName 或 ToolName(pattern)
  private static readonly RULE_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*)(?:\(([^)]*)\))?$/;

  // 命令前缀匹配正则 (如 "npm install:*")
  private static readonly COMMAND_PREFIX_PATTERN = /^(.+?):\*$/;

  // Glob 模式检测
  private static readonly GLOB_CHARS = /[*?[\]{}]/;

  /**
   * 解析单个规则字符串
   *
   * @param ruleStr 规则字符串 (如 "Bash(npm:*)")
   * @param type 规则类型 (allow/deny)
   * @param source 规则来源
   * @param priority 优先级 (可选，默认根据来源和类型自动计算)
   * @returns 解析后的规则
   */
  static parse(
    ruleStr: string,
    type: RuleType = 'allow',
    source: RuleSource = 'runtime',
    priority?: number
  ): ParsedRule {
    const trimmed = ruleStr.trim();

    if (!trimmed) {
      throw new RuleParseError(ruleStr, 'Rule string cannot be empty');
    }

    const match = this.RULE_PATTERN.exec(trimmed);
    if (!match) {
      throw new RuleParseError(ruleStr, 'Invalid rule syntax');
    }

    const [, tool, paramStr] = match;
    const hasParams = paramStr !== undefined;
    const paramPattern = paramStr?.trim();

    // 创建参数匹配器
    let matcher: ParameterMatcher | undefined;
    if (hasParams && paramPattern) {
      matcher = this.createMatcher(tool, paramPattern);
    } else if (hasParams && !paramPattern) {
      // 空括号 Tool() 等同于 Tool(*)
      matcher = { type: 'any', pattern: '*' };
    }

    // 计算优先级
    const calculatedPriority = priority ?? this.calculatePriority(type, source, hasParams);

    return {
      raw: ruleStr,
      type,
      tool,
      hasParams,
      paramPattern,
      matcher,
      priority: calculatedPriority,
      source,
      createdAt: Date.now(),
    };
  }

  /**
   * 解析多个规则字符串
   *
   * @param rulesStr 规则字符串，逗号分隔
   * @param type 规则类型
   * @param source 规则来源
   * @returns 解析后的规则数组
   */
  static parseMultiple(
    rulesStr: string,
    type: RuleType = 'allow',
    source: RuleSource = 'runtime'
  ): ParsedRule[] {
    if (!rulesStr.trim()) {
      return [];
    }

    // 处理逗号分隔的规则，需要考虑括号内的逗号
    const rules: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of rulesStr) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        if (current.trim()) {
          rules.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      rules.push(current.trim());
    }

    return rules.map(rule => this.parse(rule, type, source));
  }

  /**
   * 创建参数匹配器
   */
  private static createMatcher(tool: string, pattern: string): ParameterMatcher {
    // 匹配任意参数
    if (pattern === '*') {
      return { type: 'any', pattern };
    }

    // 检查是否为命令前缀匹配 (如 "npm:*" 或 "npm install:*")
    const prefixMatch = this.COMMAND_PREFIX_PATTERN.exec(pattern);
    if (prefixMatch) {
      const [, prefix] = prefixMatch;
      return {
        type: 'prefix',
        pattern,
        commandPrefix: prefix,
      };
    }

    // 检查是否为 Glob 模式
    if (this.GLOB_CHARS.test(pattern)) {
      return {
        type: 'glob',
        pattern,
        pathPattern: pattern,
      };
    }

    // 精确匹配
    return {
      type: 'exact',
      pattern,
    };
  }

  /**
   * 计算规则优先级
   *
   * 优先级规则：
   * 1. deny > allow (deny 优先级 +1000)
   * 2. 更具体的规则优先级更高
   * 3. 来源优先级: cli > policy > project > settings > session > runtime
   */
  private static calculatePriority(
    type: RuleType,
    source: RuleSource,
    hasParams: boolean
  ): number {
    let priority = 0;

    // deny 优先于 allow
    if (type === 'deny') {
      priority += 1000;
    }

    // 有参数的规则更具体，优先级更高
    if (hasParams) {
      priority += 100;
    }

    // 来源优先级
    const sourcePriorities: Record<RuleSource, number> = {
      cli: 50,
      policy: 40,
      project: 30,
      settings: 20,
      session: 10,
      runtime: 0,
    };
    priority += sourcePriorities[source] ?? 0;

    return priority;
  }
}

// ============ 规则匹配器 ============

/**
 * 规则匹配器
 *
 * 检查工具调用是否匹配给定的权限规则
 */
export class RuleMatcher {
  /**
   * 检查工具调用是否匹配规则
   *
   * @param rule 权限规则
   * @param input 工具输入
   * @returns 是否匹配
   */
  static matches(rule: ParsedRule, input: ToolInput): boolean {
    // 检查工具名是否匹配
    if (rule.tool !== input.tool && rule.tool !== '*') {
      return false;
    }

    // 如果没有参数限制，匹配成功
    if (!rule.hasParams || !rule.matcher) {
      return true;
    }

    // 根据工具类型和匹配器类型进行参数匹配
    return this.matchParameters(rule, input);
  }

  /**
   * 匹配参数
   */
  private static matchParameters(rule: ParsedRule, input: ToolInput): boolean {
    const matcher = rule.matcher!;

    // 匹配任意参数
    if (matcher.type === 'any') {
      return true;
    }

    // 根据工具类型选择匹配策略
    switch (rule.tool) {
      case 'Bash':
        return this.matchBashCommand(matcher, input.params);

      case 'Read':
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        return this.matchFilePath(matcher, input.params);

      case 'Glob':
      case 'Grep':
        return this.matchSearchPath(matcher, input.params);

      case 'WebFetch':
      case 'WebSearch':
        return this.matchUrl(matcher, input.params);

      default:
        // 对于其他工具，尝试通用匹配
        return this.matchGeneric(matcher, input.params);
    }
  }

  /**
   * 匹配 Bash 命令
   */
  private static matchBashCommand(
    matcher: ParameterMatcher,
    params: Record<string, unknown>
  ): boolean {
    const command = params.command as string | undefined;
    if (!command) {
      return false;
    }

    switch (matcher.type) {
      case 'prefix':
        // 前缀匹配 (如 "npm:*" 匹配 "npm install lodash")
        if (matcher.commandPrefix) {
          return command.startsWith(matcher.commandPrefix);
        }
        return false;

      case 'exact':
        // 精确匹配
        return command === matcher.pattern;

      case 'glob':
        // Glob 模式匹配
        return minimatch(command, matcher.pattern, { nocase: false });

      case 'regex':
        // 正则表达式匹配
        return matcher.regex?.test(command) ?? false;

      default:
        return false;
    }
  }

  /**
   * 匹配文件路径
   */
  private static matchFilePath(
    matcher: ParameterMatcher,
    params: Record<string, unknown>
  ): boolean {
    const filePath = (params.file_path ?? params.path) as string | undefined;
    if (!filePath) {
      return false;
    }

    // 规范化路径
    const normalizedPath = path.normalize(filePath);

    switch (matcher.type) {
      case 'prefix':
        // 路径前缀匹配
        if (matcher.commandPrefix) {
          const normalizedPrefix = path.normalize(matcher.commandPrefix);
          return normalizedPath.startsWith(normalizedPrefix);
        }
        return false;

      case 'exact':
        // 精确匹配
        return normalizedPath === path.normalize(matcher.pattern);

      case 'glob':
        // Glob 模式匹配
        return minimatch(normalizedPath, matcher.pattern, {
          dot: true,
          matchBase: false,
          nocase: process.platform === 'win32',
        });

      case 'regex':
        // 正则表达式匹配
        return matcher.regex?.test(normalizedPath) ?? false;

      default:
        return false;
    }
  }

  /**
   * 匹配搜索路径 (Glob, Grep)
   */
  private static matchSearchPath(
    matcher: ParameterMatcher,
    params: Record<string, unknown>
  ): boolean {
    const searchPath = (params.path ?? params.pattern) as string | undefined;
    if (!searchPath) {
      return true; // 没有指定路径时使用当前目录，默认匹配
    }

    return this.matchFilePath(matcher, { path: searchPath });
  }

  /**
   * 匹配 URL
   */
  private static matchUrl(
    matcher: ParameterMatcher,
    params: Record<string, unknown>
  ): boolean {
    const url = params.url as string | undefined;
    if (!url) {
      return false;
    }

    switch (matcher.type) {
      case 'prefix':
        if (matcher.commandPrefix) {
          return url.startsWith(matcher.commandPrefix);
        }
        return false;

      case 'exact':
        return url === matcher.pattern;

      case 'glob':
        return minimatch(url, matcher.pattern, { nocase: true });

      case 'regex':
        return matcher.regex?.test(url) ?? false;

      default:
        return false;
    }
  }

  /**
   * 通用参数匹配
   */
  private static matchGeneric(
    matcher: ParameterMatcher,
    params: Record<string, unknown>
  ): boolean {
    // 尝试匹配所有字符串类型的参数
    for (const value of Object.values(params)) {
      if (typeof value === 'string') {
        let matched = false;

        switch (matcher.type) {
          case 'prefix':
            matched = matcher.commandPrefix
              ? value.startsWith(matcher.commandPrefix)
              : false;
            break;

          case 'exact':
            matched = value === matcher.pattern;
            break;

          case 'glob':
            matched = minimatch(value, matcher.pattern, { nocase: false });
            break;

          case 'regex':
            matched = matcher.regex?.test(value) ?? false;
            break;
        }

        if (matched) {
          return true;
        }
      }
    }

    return false;
  }
}

// ============ 权限规则管理器 ============

/**
 * 权限规则管理器
 *
 * 管理和评估权限规则，支持：
 * - 添加/移除规则
 * - 规则优先级排序
 * - 权限检查 (deny > allow > default)
 */
export class PermissionRuleManager {
  private allowRules: ParsedRule[] = [];
  private denyRules: ParsedRule[] = [];

  /**
   * 添加允许规则
   */
  addAllowRule(rule: ParsedRule | string, source?: RuleSource): void {
    const parsed = typeof rule === 'string'
      ? PermissionRuleParser.parse(rule, 'allow', source ?? 'runtime')
      : { ...rule, type: 'allow' as RuleType };

    this.allowRules.push(parsed);
    this.sortRules();
  }

  /**
   * 添加多个允许规则
   */
  addAllowRules(rulesStr: string, source?: RuleSource): void {
    const rules = PermissionRuleParser.parseMultiple(rulesStr, 'allow', source ?? 'runtime');
    this.allowRules.push(...rules);
    this.sortRules();
  }

  /**
   * 添加拒绝规则
   */
  addDenyRule(rule: ParsedRule | string, source?: RuleSource): void {
    const parsed = typeof rule === 'string'
      ? PermissionRuleParser.parse(rule, 'deny', source ?? 'runtime')
      : { ...rule, type: 'deny' as RuleType };

    this.denyRules.push(parsed);
    this.sortRules();
  }

  /**
   * 添加多个拒绝规则
   */
  addDenyRules(rulesStr: string, source?: RuleSource): void {
    const rules = PermissionRuleParser.parseMultiple(rulesStr, 'deny', source ?? 'runtime');
    this.denyRules.push(...rules);
    this.sortRules();
  }

  /**
   * 移除规则
   */
  removeRule(ruleStr: string): void {
    this.allowRules = this.allowRules.filter(r => r.raw !== ruleStr);
    this.denyRules = this.denyRules.filter(r => r.raw !== ruleStr);
  }

  /**
   * 清空所有规则
   */
  clearRules(): void {
    this.allowRules = [];
    this.denyRules = [];
  }

  /**
   * 清空特定来源的规则
   */
  clearRulesBySource(source: RuleSource): void {
    this.allowRules = this.allowRules.filter(r => r.source !== source);
    this.denyRules = this.denyRules.filter(r => r.source !== source);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): { allow: ParsedRule[]; deny: ParsedRule[] } {
    return {
      allow: [...this.allowRules],
      deny: [...this.denyRules],
    };
  }

  /**
   * 检查工具调用是否被允许
   *
   * 优先级规则：
   * 1. deny 规则优先于 allow 规则
   * 2. 更具体的规则优先于更通用的规则
   * 3. 如果没有匹配的规则，返回默认结果
   *
   * @param input 工具输入
   * @param defaultAllow 默认是否允许 (当没有匹配规则时)
   * @returns 检查结果
   */
  check(input: ToolInput, defaultAllow: boolean = true): RuleCheckResult {
    // 1. 首先检查 deny 规则 (优先级最高)
    for (const rule of this.denyRules) {
      if (RuleMatcher.matches(rule, input)) {
        return {
          matched: true,
          rule,
          allowed: false,
          reason: `Denied by rule: ${rule.raw}`,
        };
      }
    }

    // 2. 检查 allow 规则
    for (const rule of this.allowRules) {
      if (RuleMatcher.matches(rule, input)) {
        return {
          matched: true,
          rule,
          allowed: true,
          reason: `Allowed by rule: ${rule.raw}`,
        };
      }
    }

    // 3. 没有匹配的规则，返回默认结果
    return {
      matched: false,
      allowed: defaultAllow,
      reason: defaultAllow
        ? 'No matching rule, allowed by default'
        : 'No matching rule, denied by default',
    };
  }

  /**
   * 检查工具是否被明确允许
   */
  isExplicitlyAllowed(input: ToolInput): boolean {
    for (const rule of this.allowRules) {
      if (RuleMatcher.matches(rule, input)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查工具是否被明确拒绝
   */
  isExplicitlyDenied(input: ToolInput): boolean {
    for (const rule of this.denyRules) {
      if (RuleMatcher.matches(rule, input)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取匹配的规则列表
   */
  getMatchingRules(input: ToolInput): ParsedRule[] {
    const matching: ParsedRule[] = [];

    for (const rule of this.denyRules) {
      if (RuleMatcher.matches(rule, input)) {
        matching.push(rule);
      }
    }

    for (const rule of this.allowRules) {
      if (RuleMatcher.matches(rule, input)) {
        matching.push(rule);
      }
    }

    return matching;
  }

  /**
   * 排序规则 (按优先级降序)
   */
  private sortRules(): void {
    const sortFn = (a: ParsedRule, b: ParsedRule) => b.priority - a.priority;
    this.allowRules.sort(sortFn);
    this.denyRules.sort(sortFn);
  }

  /**
   * 导出规则配置
   */
  export(): { allow: string[]; deny: string[] } {
    return {
      allow: this.allowRules.map(r => r.raw),
      deny: this.denyRules.map(r => r.raw),
    };
  }

  /**
   * 导入规则配置
   */
  import(config: { allow?: string[]; deny?: string[] }, source?: RuleSource): void {
    if (config.allow) {
      for (const rule of config.allow) {
        this.addAllowRule(rule, source);
      }
    }
    if (config.deny) {
      for (const rule of config.deny) {
        this.addDenyRule(rule, source);
      }
    }
  }

  /**
   * 获取规则统计
   */
  getStats(): {
    totalRules: number;
    allowRules: number;
    denyRules: number;
    bySource: Record<RuleSource, number>;
    byTool: Record<string, number>;
  } {
    const allRules = [...this.allowRules, ...this.denyRules];

    const bySource: Record<RuleSource, number> = {
      cli: 0,
      settings: 0,
      project: 0,
      policy: 0,
      session: 0,
      runtime: 0,
    };

    const byTool: Record<string, number> = {};

    for (const rule of allRules) {
      bySource[rule.source] = (bySource[rule.source] || 0) + 1;
      byTool[rule.tool] = (byTool[rule.tool] || 0) + 1;
    }

    return {
      totalRules: allRules.length,
      allowRules: this.allowRules.length,
      denyRules: this.denyRules.length,
      bySource,
      byTool,
    };
  }
}

// ============ 便捷函数 ============

/**
 * 解析允许的工具列表 (如 --allowed-tools 参数)
 */
export function parseAllowedTools(
  toolsStr: string,
  source: RuleSource = 'cli'
): ParsedRule[] {
  return PermissionRuleParser.parseMultiple(toolsStr, 'allow', source);
}

/**
 * 解析禁止的工具列表 (如 --disallowed-tools 参数)
 */
export function parseDisallowedTools(
  toolsStr: string,
  source: RuleSource = 'cli'
): ParsedRule[] {
  return PermissionRuleParser.parseMultiple(toolsStr, 'deny', source);
}

/**
 * 创建 Bash 命令规则
 */
export function createBashRule(
  commandPattern: string,
  type: RuleType = 'allow',
  source: RuleSource = 'runtime'
): ParsedRule {
  return PermissionRuleParser.parse(
    commandPattern.includes(':') ? `Bash(${commandPattern})` : `Bash(${commandPattern}:*)`,
    type,
    source
  );
}

/**
 * 创建文件路径规则
 */
export function createPathRule(
  tool: 'Read' | 'Write' | 'Edit',
  pathPattern: string,
  type: RuleType = 'allow',
  source: RuleSource = 'runtime'
): ParsedRule {
  return PermissionRuleParser.parse(`${tool}(${pathPattern})`, type, source);
}

// ============ 全局实例 ============

/**
 * 默认权限规则管理器实例
 */
export const permissionRuleManager = new PermissionRuleManager();
