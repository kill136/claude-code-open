/**
 * 代理工具过滤逻辑
 * Agent Tool Filtering Logic
 *
 * 实现工具过滤、验证、映射和使用统计功能
 */

import { ToolDefinition } from '../types/index.js';
import { toolRegistry } from '../tools/base.js';

// ============ 类型定义 ============

/**
 * 代理工具配置
 */
export interface AgentToolConfig {
  /** 代理类型标识符 */
  agentType: string;
  /** 允许的工具列表，'*' 表示所有工具 */
  allowedTools: string[] | '*';
  /** 禁用的工具列表（从 allowedTools 中排除） */
  disallowedTools?: string[];
  /** 工具名称别名映射 */
  toolAliases?: Record<string, string>;
  /** 工具访问权限级别 */
  permissionLevel?: 'readonly' | 'standard' | 'elevated';
  /** 自定义工具限制 */
  customRestrictions?: ToolRestriction[];
}

/**
 * 工具限制配置
 */
export interface ToolRestriction {
  /** 工具名称 */
  toolName: string;
  /** 限制类型 */
  type: 'parameter' | 'rate' | 'scope';
  /** 限制规则 */
  rule: ParameterRestriction | RateRestriction | ScopeRestriction;
}

/**
 * 参数限制
 */
export interface ParameterRestriction {
  /** 被限制的参数名 */
  parameterName: string;
  /** 允许的值列表 */
  allowedValues?: any[];
  /** 禁止的值列表 */
  disallowedValues?: any[];
  /** 值验证函数 */
  validator?: (value: any) => boolean;
}

/**
 * 速率限制
 */
export interface RateRestriction {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 最大调用次数 */
  maxCalls: number;
}

/**
 * 范围限制
 */
export interface ScopeRestriction {
  /** 允许的路径前缀 */
  allowedPaths?: string[];
  /** 禁止的路径前缀 */
  disallowedPaths?: string[];
  /** 允许的命令模式（正则表达式） */
  allowedCommands?: RegExp[];
  /** 禁止的命令模式（正则表达式） */
  disallowedCommands?: RegExp[];
}

/**
 * 工具调用验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 错误消息（验证失败时） */
  error?: string;
  /** 警告消息 */
  warnings?: string[];
  /** 建议的替代工具 */
  suggestedAlternatives?: string[];
}

/**
 * 工具使用记录
 */
export interface ToolUsageRecord {
  /** 记录ID */
  id: string;
  /** 代理ID */
  agentId: string;
  /** 代理类型 */
  agentType: string;
  /** 工具名称 */
  toolName: string;
  /** 调用参数 */
  params: any;
  /** 调用结果 */
  result?: any;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 调用时间戳 */
  timestamp: number;
  /** 执行耗时（毫秒） */
  durationMs: number;
}

/**
 * 使用统计
 */
export interface UsageStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 成功调用次数 */
  successfulCalls: number;
  /** 失败调用次数 */
  failedCalls: number;
  /** 各工具调用次数 */
  callsByTool: Record<string, number>;
  /** 各代理调用次数 */
  callsByAgent: Record<string, number>;
  /** 平均执行时间（毫秒） */
  averageDurationMs: number;
  /** 最近的调用记录 */
  recentCalls: ToolUsageRecord[];
}

/**
 * 异常检测结果
 */
export interface Anomaly {
  /** 异常类型 */
  type: 'rate_limit' | 'unusual_pattern' | 'permission_violation' | 'error_spike';
  /** 异常描述 */
  description: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 涉及的代理ID */
  agentId?: string;
  /** 涉及的工具名称 */
  toolName?: string;
  /** 检测时间 */
  timestamp: number;
  /** 相关数据 */
  data?: any;
}

/**
 * 报告选项
 */
export interface ReportOptions {
  /** 报告格式 */
  format?: 'text' | 'json' | 'markdown';
  /** 包含详细信息 */
  includeDetails?: boolean;
  /** 时间范围（毫秒） */
  timeRange?: number;
  /** 按代理分组 */
  groupByAgent?: boolean;
  /** 按工具分组 */
  groupByTool?: boolean;
}

// ============ 预定义代理配置 ============

/**
 * 内置代理工具配置
 */
export const AGENT_TOOL_CONFIGS: Record<string, AgentToolConfig> = {
  'general-purpose': {
    agentType: 'general-purpose',
    allowedTools: '*',
    permissionLevel: 'standard',
  },
  'statusline-setup': {
    agentType: 'statusline-setup',
    allowedTools: ['Read', 'Edit'],
    permissionLevel: 'standard',
  },
  'Explore': {
    agentType: 'Explore',
    allowedTools: '*', // 所有工具，但主要使用 Glob, Grep, Read
    permissionLevel: 'readonly',
    customRestrictions: [
      {
        toolName: 'Bash',
        type: 'scope',
        rule: {
          // 限制只能执行只读命令
          allowedCommands: [
            /^git\s+(status|diff|log|show)/,
            /^ls(\s|$)/,
            /^cat(\s|$)/,
            /^head(\s|$)/,
            /^tail(\s|$)/,
          ],
        },
      },
    ],
  },
  'Plan': {
    agentType: 'Plan',
    allowedTools: '*',
    permissionLevel: 'elevated',
  },
  'claude-code-guide': {
    agentType: 'claude-code-guide',
    allowedTools: ['Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch'],
    permissionLevel: 'readonly',
  },
  // 代码审查代理
  'code-reviewer': {
    agentType: 'code-reviewer',
    allowedTools: ['Bash', 'Glob', 'Grep', 'Read', 'Task'],
    permissionLevel: 'readonly',
    customRestrictions: [
      {
        toolName: 'Bash',
        type: 'scope',
        rule: {
          allowedCommands: [/^git\s+(diff|status|log|show|remote\s+show)/],
        },
      },
    ],
  },
};

// ============ 工具过滤器类 ============

/**
 * 代理工具过滤器
 * 负责根据代理配置过滤和验证工具调用
 */
export class AgentToolFilter {
  private config: AgentToolConfig;
  private rateLimitMap: Map<string, number[]> = new Map();

  constructor(config: AgentToolConfig) {
    this.config = config;
  }

  /**
   * 检查工具是否被允许使用
   */
  isAllowed(toolName: string): boolean {
    // 解析工具别名
    const resolvedName = this.resolveToolAlias(toolName);

    // 检查禁用列表
    if (this.config.disallowedTools?.includes(resolvedName)) {
      return false;
    }

    // 检查允许列表
    if (this.config.allowedTools === '*') {
      return true;
    }

    return this.config.allowedTools.includes(resolvedName);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): ToolDefinition[] {
    const allTools = toolRegistry.getAll();

    return allTools
      .filter((tool) => this.isAllowed(tool.name))
      .map((tool) => tool.getDefinition());
  }

  /**
   * 验证工具调用
   */
  validateToolCall(toolName: string, params: any): ValidationResult {
    const resolvedName = this.resolveToolAlias(toolName);

    // 检查工具是否允许
    if (!this.isAllowed(resolvedName)) {
      return {
        valid: false,
        error: `Tool '${toolName}' is not allowed for agent type '${this.config.agentType}'`,
        suggestedAlternatives: this.findAlternativeTools(resolvedName),
      };
    }

    // 检查权限级别限制
    const permissionCheck = this.checkPermissionLevel(resolvedName, params);
    if (!permissionCheck.valid) {
      return permissionCheck;
    }

    // 检查自定义限制
    const restrictionCheck = this.checkCustomRestrictions(resolvedName, params);
    if (!restrictionCheck.valid) {
      return restrictionCheck;
    }

    // 检查速率限制
    const rateLimitCheck = this.checkRateLimit(resolvedName);
    if (!rateLimitCheck.valid) {
      return rateLimitCheck;
    }

    return { valid: true };
  }

  /**
   * 解析工具别名
   */
  resolveToolAlias(name: string): string {
    if (this.config.toolAliases && this.config.toolAliases[name]) {
      return this.config.toolAliases[name];
    }
    return name;
  }

  /**
   * 检查权限级别
   */
  private checkPermissionLevel(toolName: string, params: any): ValidationResult {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { valid: false, error: `Tool '${toolName}' not found` };
    }

    // 只读模式限制
    if (this.config.permissionLevel === 'readonly') {
      const writingTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'ExitPlanMode'];
      if (writingTools.includes(toolName)) {
        return {
          valid: false,
          error: `Tool '${toolName}' requires write permissions, but agent is in readonly mode`,
        };
      }

      // 检查 Bash 命令是否为只读
      if (toolName === 'Bash' && params.command) {
        const dangerousPatterns = [
          /\brm\b/,
          /\bmv\b/,
          /\bcp\b/,
          />/,
          /\bgit\s+(commit|push|reset|rebase)/,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(params.command)) {
            return {
              valid: false,
              error: `Command '${params.command}' is not allowed in readonly mode`,
            };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * 检查自定义限制
   */
  private checkCustomRestrictions(toolName: string, params: any): ValidationResult {
    if (!this.config.customRestrictions) {
      return { valid: true };
    }

    const restrictions = this.config.customRestrictions.filter(
      (r) => r.toolName === toolName
    );

    for (const restriction of restrictions) {
      if (restriction.type === 'parameter') {
        const paramRule = restriction.rule as ParameterRestriction;
        const value = params[paramRule.parameterName];

        if (paramRule.allowedValues && !paramRule.allowedValues.includes(value)) {
          return {
            valid: false,
            error: `Parameter '${paramRule.parameterName}' value '${value}' is not in allowed values`,
          };
        }

        if (paramRule.disallowedValues && paramRule.disallowedValues.includes(value)) {
          return {
            valid: false,
            error: `Parameter '${paramRule.parameterName}' value '${value}' is disallowed`,
          };
        }

        if (paramRule.validator && !paramRule.validator(value)) {
          return {
            valid: false,
            error: `Parameter '${paramRule.parameterName}' value '${value}' failed validation`,
          };
        }
      } else if (restriction.type === 'scope') {
        const scopeRule = restriction.rule as ScopeRestriction;

        // 检查命令限制
        if (toolName === 'Bash' && params.command) {
          if (scopeRule.allowedCommands) {
            const allowed = scopeRule.allowedCommands.some((pattern) =>
              pattern.test(params.command)
            );
            if (!allowed) {
              return {
                valid: false,
                error: `Command '${params.command}' is not in allowed command patterns`,
              };
            }
          }

          if (scopeRule.disallowedCommands) {
            const disallowed = scopeRule.disallowedCommands.some((pattern) =>
              pattern.test(params.command)
            );
            if (disallowed) {
              return {
                valid: false,
                error: `Command '${params.command}' matches a disallowed command pattern`,
              };
            }
          }
        }

        // 检查路径限制
        const pathParam = params.file_path || params.path || params.notebook_path;
        if (pathParam) {
          if (scopeRule.allowedPaths) {
            const allowed = scopeRule.allowedPaths.some((prefix) =>
              pathParam.startsWith(prefix)
            );
            if (!allowed) {
              return {
                valid: false,
                error: `Path '${pathParam}' is not in allowed path prefixes`,
              };
            }
          }

          if (scopeRule.disallowedPaths) {
            const disallowed = scopeRule.disallowedPaths.some((prefix) =>
              pathParam.startsWith(prefix)
            );
            if (disallowed) {
              return {
                valid: false,
                error: `Path '${pathParam}' matches a disallowed path prefix`,
              };
            }
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(toolName: string): ValidationResult {
    if (!this.config.customRestrictions) {
      return { valid: true };
    }

    const rateRestrictions = this.config.customRestrictions.filter(
      (r) => r.toolName === toolName && r.type === 'rate'
    );

    for (const restriction of rateRestrictions) {
      const rateRule = restriction.rule as RateRestriction;
      const key = `${this.config.agentType}:${toolName}`;
      const now = Date.now();

      // 获取或创建时间戳数组
      let timestamps = this.rateLimitMap.get(key) || [];

      // 清除过期的时间戳
      timestamps = timestamps.filter((ts) => now - ts < rateRule.windowMs);

      // 检查是否超过限制
      if (timestamps.length >= rateRule.maxCalls) {
        return {
          valid: false,
          error: `Rate limit exceeded for '${toolName}': ${rateRule.maxCalls} calls per ${rateRule.windowMs}ms`,
        };
      }

      // 记录新的调用
      timestamps.push(now);
      this.rateLimitMap.set(key, timestamps);
    }

    return { valid: true };
  }

  /**
   * 查找替代工具
   */
  private findAlternativeTools(toolName: string): string[] {
    const alternatives: string[] = [];
    const allTools = this.getAvailableTools();

    // 基于工具类型查找替代品
    const toolCategories: Record<string, string[]> = {
      file: ['Read', 'Write', 'Edit', 'MultiEdit'],
      search: ['Glob', 'Grep'],
      web: ['WebFetch', 'WebSearch'],
      execution: ['Bash', 'Task'],
    };

    for (const [category, tools] of Object.entries(toolCategories)) {
      if (tools.includes(toolName)) {
        const availableInCategory = tools.filter((t) =>
          allTools.some((tool) => tool.name === t)
        );
        alternatives.push(...availableInCategory.filter((t) => t !== toolName));
      }
    }

    return alternatives;
  }
}

// ============ 工具使用跟踪器 ============

/**
 * 工具使用跟踪器
 * 记录和分析工具使用情况
 */
export class ToolUsageTracker {
  private records: ToolUsageRecord[] = [];
  private maxRecords = 10000; // 最大记录数

  /**
   * 记录工具调用
   */
  record(
    agentId: string,
    agentType: string,
    toolName: string,
    params: any,
    result: any,
    durationMs: number
  ): void {
    const record: ToolUsageRecord = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      agentType,
      toolName,
      params,
      result,
      success: result?.success !== false,
      error: result?.error,
      timestamp: Date.now(),
      durationMs,
    };

    this.records.push(record);

    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * 获取使用统计
   */
  getUsageStats(agentId?: string, timeRange?: number): UsageStats {
    let records = this.records;

    // 按代理ID过滤
    if (agentId) {
      records = records.filter((r) => r.agentId === agentId);
    }

    // 按时间范围过滤
    if (timeRange) {
      const cutoff = Date.now() - timeRange;
      records = records.filter((r) => r.timestamp >= cutoff);
    }

    const totalCalls = records.length;
    const successfulCalls = records.filter((r) => r.success).length;
    const failedCalls = totalCalls - successfulCalls;

    // 按工具统计
    const callsByTool: Record<string, number> = {};
    for (const record of records) {
      callsByTool[record.toolName] = (callsByTool[record.toolName] || 0) + 1;
    }

    // 按代理统计
    const callsByAgent: Record<string, number> = {};
    for (const record of records) {
      callsByAgent[record.agentId] = (callsByAgent[record.agentId] || 0) + 1;
    }

    // 计算平均执行时间
    const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);
    const averageDurationMs = totalCalls > 0 ? totalDuration / totalCalls : 0;

    // 获取最近的调用记录
    const recentCalls = records.slice(-20);

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      callsByTool,
      callsByAgent,
      averageDurationMs,
      recentCalls,
    };
  }

  /**
   * 检测异常
   */
  detectAnomalies(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const now = Date.now();
    const recentWindow = 60000; // 1分钟窗口
    const recentRecords = this.records.filter(
      (r) => now - r.timestamp < recentWindow
    );

    // 检测错误激增
    const errorRate =
      recentRecords.filter((r) => !r.success).length / recentRecords.length;
    if (errorRate > 0.5 && recentRecords.length > 10) {
      anomalies.push({
        type: 'error_spike',
        description: `High error rate detected: ${(errorRate * 100).toFixed(1)}% in the last minute`,
        severity: 'high',
        timestamp: now,
        data: { errorRate, recordCount: recentRecords.length },
      });
    }

    // 检测速率异常
    const callsByTool: Record<string, number> = {};
    for (const record of recentRecords) {
      callsByTool[record.toolName] = (callsByTool[record.toolName] || 0) + 1;
    }

    for (const [toolName, count] of Object.entries(callsByTool)) {
      if (count > 50) {
        // 每分钟超过50次调用
        anomalies.push({
          type: 'rate_limit',
          description: `Unusual call rate for '${toolName}': ${count} calls in the last minute`,
          severity: 'medium',
          toolName,
          timestamp: now,
          data: { count },
        });
      }
    }

    // 检测异常模式
    const callsByAgent: Record<string, number> = {};
    for (const record of recentRecords) {
      callsByAgent[record.agentId] = (callsByAgent[record.agentId] || 0) + 1;
    }

    for (const [agentId, count] of Object.entries(callsByAgent)) {
      if (count > 100) {
        // 单个代理每分钟超过100次调用
        anomalies.push({
          type: 'unusual_pattern',
          description: `Agent ${agentId} made ${count} calls in the last minute`,
          severity: 'medium',
          agentId,
          timestamp: now,
          data: { count },
        });
      }
    }

    return anomalies;
  }

  /**
   * 生成报告
   */
  generateReport(options: ReportOptions = {}): string {
    const {
      format = 'text',
      includeDetails = false,
      timeRange,
      groupByAgent = false,
      groupByTool = false,
    } = options;

    const stats = this.getUsageStats(undefined, timeRange);

    if (format === 'json') {
      return JSON.stringify(
        {
          stats,
          anomalies: this.detectAnomalies(),
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      );
    }

    const lines: string[] = [];

    if (format === 'markdown') {
      lines.push('# Tool Usage Report\n');
      lines.push(`**Generated:** ${new Date().toISOString()}\n`);
      lines.push('## Summary\n');
      lines.push(`- **Total Calls:** ${stats.totalCalls}`);
      lines.push(`- **Successful:** ${stats.successfulCalls}`);
      lines.push(`- **Failed:** ${stats.failedCalls}`);
      lines.push(
        `- **Success Rate:** ${((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1)}%`
      );
      lines.push(
        `- **Average Duration:** ${stats.averageDurationMs.toFixed(2)}ms\n`
      );

      if (groupByTool) {
        lines.push('## Calls by Tool\n');
        lines.push('| Tool | Calls |');
        lines.push('|------|-------|');
        for (const [tool, count] of Object.entries(stats.callsByTool).sort(
          (a, b) => b[1] - a[1]
        )) {
          lines.push(`| ${tool} | ${count} |`);
        }
        lines.push('');
      }

      if (groupByAgent) {
        lines.push('## Calls by Agent\n');
        lines.push('| Agent ID | Calls |');
        lines.push('|----------|-------|');
        for (const [agent, count] of Object.entries(stats.callsByAgent).sort(
          (a, b) => b[1] - a[1]
        )) {
          lines.push(`| ${agent} | ${count} |`);
        }
        lines.push('');
      }

      const anomalies = this.detectAnomalies();
      if (anomalies.length > 0) {
        lines.push('## Detected Anomalies\n');
        for (const anomaly of anomalies) {
          lines.push(`- **[${anomaly.severity.toUpperCase()}]** ${anomaly.description}`);
        }
        lines.push('');
      }
    } else {
      // Text format
      lines.push('=== Tool Usage Report ===\n');
      lines.push(`Generated: ${new Date().toISOString()}\n`);
      lines.push('Summary:');
      lines.push(`  Total Calls: ${stats.totalCalls}`);
      lines.push(`  Successful: ${stats.successfulCalls}`);
      lines.push(`  Failed: ${stats.failedCalls}`);
      lines.push(
        `  Success Rate: ${((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1)}%`
      );
      lines.push(`  Average Duration: ${stats.averageDurationMs.toFixed(2)}ms\n`);

      if (groupByTool) {
        lines.push('Calls by Tool:');
        for (const [tool, count] of Object.entries(stats.callsByTool).sort(
          (a, b) => b[1] - a[1]
        )) {
          lines.push(`  ${tool}: ${count}`);
        }
        lines.push('');
      }

      if (groupByAgent) {
        lines.push('Calls by Agent:');
        for (const [agent, count] of Object.entries(stats.callsByAgent).sort(
          (a, b) => b[1] - a[1]
        )) {
          lines.push(`  ${agent}: ${count}`);
        }
        lines.push('');
      }

      const anomalies = this.detectAnomalies();
      if (anomalies.length > 0) {
        lines.push('Detected Anomalies:');
        for (const anomaly of anomalies) {
          lines.push(`  [${anomaly.severity.toUpperCase()}] ${anomaly.description}`);
        }
        lines.push('');
      }
    }

    if (includeDetails && stats.recentCalls.length > 0) {
      if (format === 'markdown') {
        lines.push('## Recent Calls\n');
      } else {
        lines.push('Recent Calls:');
      }

      for (const call of stats.recentCalls) {
        const timestamp = new Date(call.timestamp).toISOString();
        const status = call.success ? '✓' : '✗';
        lines.push(
          `  ${status} ${call.toolName} (${call.durationMs}ms) - ${timestamp}`
        );
        if (!call.success && call.error) {
          lines.push(`    Error: ${call.error}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 清除旧记录
   */
  clearOldRecords(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    const before = this.records.length;
    this.records = this.records.filter((r) => r.timestamp >= cutoff);
    return before - this.records.length;
  }

  /**
   * 获取所有记录
   */
  getAllRecords(): ToolUsageRecord[] {
    return [...this.records];
  }
}

// ============ 工厂函数 ============

/**
 * 创建工具过滤器
 */
export function createToolFilter(
  agentType: string,
  userConfig?: Partial<AgentToolConfig>
): AgentToolFilter {
  // 获取基础配置
  const baseConfig = AGENT_TOOL_CONFIGS[agentType] || {
    agentType,
    allowedTools: '*',
    permissionLevel: 'standard' as const,
  };

  // 合并用户配置
  const mergedConfig = mergeToolConfigs(baseConfig, userConfig);

  return new AgentToolFilter(mergedConfig);
}

/**
 * 合并工具配置
 */
export function mergeToolConfigs(
  base: AgentToolConfig,
  override?: Partial<AgentToolConfig>
): AgentToolConfig {
  if (!override) {
    return { ...base };
  }

  const merged: AgentToolConfig = { ...base };

  // 合并允许的工具
  if (override.allowedTools !== undefined) {
    merged.allowedTools = override.allowedTools;
  }

  // 合并禁用的工具
  if (override.disallowedTools !== undefined) {
    merged.disallowedTools = [
      ...(base.disallowedTools || []),
      ...override.disallowedTools,
    ];
  }

  // 合并工具别名
  if (override.toolAliases !== undefined) {
    merged.toolAliases = {
      ...(base.toolAliases || {}),
      ...override.toolAliases,
    };
  }

  // 覆盖权限级别
  if (override.permissionLevel !== undefined) {
    merged.permissionLevel = override.permissionLevel;
  }

  // 合并自定义限制
  if (override.customRestrictions !== undefined) {
    merged.customRestrictions = [
      ...(base.customRestrictions || []),
      ...override.customRestrictions,
    ];
  }

  return merged;
}

// ============ 导出单例实例 ============

/**
 * 全局工具使用跟踪器实例
 */
export const globalUsageTracker = new ToolUsageTracker();
