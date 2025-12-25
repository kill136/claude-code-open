/**
 * 权限模式系统
 * 控制工具执行的权限检查
 *
 * 功能：
 * - 工具级权限控制 (allow/deny 特定工具)
 * - 路径级权限 (支持 glob patterns)
 * - 命令级权限 (Bash 命令白名单/黑名单)
 * - 永久记忆和会话记忆
 * - 权限审计日志
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import { minimatch } from 'minimatch';
import type { PermissionMode } from '../types/index.js';

// 权限请求类型
export type PermissionType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'bash_command'
  | 'network_request'
  | 'mcp_server'
  | 'plugin_install'
  | 'system_config';

// 权限请求
export interface PermissionRequest {
  type: PermissionType;
  tool: string;
  description: string;
  resource?: string;
  details?: Record<string, unknown>;
}

// 权限决策
export interface PermissionDecision {
  allowed: boolean;
  remember?: boolean;
  scope?: 'once' | 'session' | 'always';
  reason?: string;
}

// 权限规则
export interface PermissionRule {
  type: PermissionType;
  pattern?: string | RegExp;
  action: 'allow' | 'deny' | 'ask';
  scope?: 'once' | 'session' | 'always';
}

// 已记住的权限
interface RememberedPermission {
  type: PermissionType;
  pattern: string;
  allowed: boolean;
  scope: 'session' | 'always';
  timestamp: number;
}

// 权限配置格式（匹配官方 CLI settings.json 格式）
export interface PermissionConfig {
  // 工具级白名单/黑名单
  tools?: {
    allow?: string[];  // 允许的工具名称列表
    deny?: string[];   // 禁止的工具名称列表
  };

  // 路径级白名单/黑名单（支持 glob patterns）
  paths?: {
    allow?: string[];  // 允许访问的路径 glob patterns
    deny?: string[];   // 禁止访问的路径 glob patterns
  };

  // Bash 命令级白名单/黑名单（支持 glob patterns）
  commands?: {
    allow?: string[];  // 允许的命令 patterns
    deny?: string[];   // 禁止的命令 patterns
  };

  // 网络请求白名单/黑名单
  network?: {
    allow?: string[];  // 允许的域名/URL patterns
    deny?: string[];   // 禁止的域名/URL patterns
  };

  // 审计日志配置
  audit?: {
    enabled?: boolean;
    logFile?: string;
    maxSize?: number;  // 最大日志文件大小（字节）
  };
}

// 审计日志条目
interface AuditLogEntry {
  timestamp: string;
  type: PermissionType;
  tool: string;
  resource?: string;
  decision: 'allow' | 'deny';
  reason: string;
  scope?: 'once' | 'session' | 'always';
  user?: boolean;  // 是否由用户手动决定
}

// 权限管理器
export class PermissionManager {
  private mode: PermissionMode = 'default';
  private rules: PermissionRule[] = [];
  private rememberedPermissions: RememberedPermission[] = [];
  private sessionPermissions: Map<string, boolean> = new Map();
  private allowedDirs: string[] = [];
  private configDir: string;

  // 权限配置（从 settings.json 加载）
  private permissionConfig: PermissionConfig = {};

  // 审计日志
  private auditLogPath: string;
  private auditEnabled: boolean = false;

  constructor(mode: PermissionMode = 'default') {
    this.mode = mode;
    this.configDir = process.env.CLAUDE_CONFIG_DIR ||
                     path.join(process.env.HOME || '~', '.claude');

    // 审计日志路径
    this.auditLogPath = path.join(this.configDir, 'permissions-audit.log');

    // 加载权限配置（从 settings.json）
    this.loadPermissionConfig();

    // 加载持久化的权限
    this.loadPersistedPermissions();

    // 设置默认规则
    this.setupDefaultRules();
  }

  // 设置权限模式
  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  // 添加允许的目录
  addAllowedDir(dir: string): void {
    const resolved = path.resolve(dir);
    if (!this.allowedDirs.includes(resolved)) {
      this.allowedDirs.push(resolved);
    }
  }

  // 检查路径是否在允许的目录内
  isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const cwd = process.cwd();

    // 当前工作目录总是允许的
    if (resolved.startsWith(cwd)) {
      return true;
    }

    // 检查额外允许的目录
    for (const dir of this.allowedDirs) {
      if (resolved.startsWith(dir)) {
        return true;
      }
    }

    return false;
  }

  // 检查权限
  async check(request: PermissionRequest): Promise<PermissionDecision> {
    let decision: PermissionDecision;

    // 根据模式处理
    switch (this.mode) {
      case 'bypassPermissions':
        decision = { allowed: true, reason: 'Permissions bypassed' };
        break;

      case 'dontAsk':
        // 对于安全操作自动允许，危险操作自动拒绝
        decision = this.autoDecide(request);
        break;

      case 'acceptEdits':
        // 自动接受文件编辑
        if (request.type === 'file_write' || request.type === 'file_read') {
          decision = { allowed: true, reason: 'Auto-accept edits mode' };
        } else {
          decision = await this.checkWithRules(request);
        }
        break;

      case 'plan':
        // 计划模式下不执行任何操作
        decision = { allowed: false, reason: 'Plan mode - no execution' };
        break;

      case 'delegate':
        // 委托模式 - 需要实现更复杂的逻辑
        decision = await this.checkWithRules(request);
        break;

      case 'default':
      default:
        decision = await this.checkWithRules(request);
        break;
    }

    // 记录审计日志
    this.logAudit(request, decision);

    return decision;
  }

  // 自动决策（用于 dontAsk 模式）
  private autoDecide(request: PermissionRequest): PermissionDecision {
    // 文件读取总是允许
    if (request.type === 'file_read') {
      return { allowed: true };
    }

    // 检查是否在允许的目录内
    if (request.resource && (request.type === 'file_write' || request.type === 'file_delete')) {
      if (this.isPathAllowed(request.resource)) {
        return { allowed: true };
      }
    }

    // 默认拒绝危险操作
    return { allowed: false, reason: 'Auto-denied in dontAsk mode' };
  }

  // 根据规则检查
  private async checkWithRules(request: PermissionRequest): Promise<PermissionDecision> {
    // 1. 检查工具级权限配置（优先级最高）
    const toolCheck = this.checkToolPermission(request);
    if (toolCheck !== null) {
      return { allowed: toolCheck, reason: toolCheck ? 'Tool allowed by config' : 'Tool denied by config' };
    }

    // 2. 检查路径级权限配置
    if (request.resource && (request.type === 'file_read' || request.type === 'file_write' || request.type === 'file_delete')) {
      const pathCheck = this.checkPathPermission(request.resource);
      if (pathCheck !== null) {
        return { allowed: pathCheck, reason: pathCheck ? 'Path allowed by config' : 'Path denied by config' };
      }
    }

    // 3. 检查命令级权限配置
    if (request.type === 'bash_command' && request.resource) {
      const cmdCheck = this.checkCommandPermission(request.resource);
      if (cmdCheck !== null) {
        return { allowed: cmdCheck, reason: cmdCheck ? 'Command allowed by config' : 'Command denied by config' };
      }
    }

    // 4. 检查网络权限配置
    if (request.type === 'network_request' && request.resource) {
      const netCheck = this.checkNetworkPermission(request.resource);
      if (netCheck !== null) {
        return { allowed: netCheck, reason: netCheck ? 'Network allowed by config' : 'Network denied by config' };
      }
    }

    // 5. 检查已记住的权限
    const remembered = this.checkRemembered(request);
    if (remembered !== null) {
      return { allowed: remembered, reason: 'Previously remembered' };
    }

    // 6. 检查会话权限
    const sessionKey = this.getPermissionKey(request);
    if (this.sessionPermissions.has(sessionKey)) {
      return { allowed: this.sessionPermissions.get(sessionKey)!, reason: 'Session permission' };
    }

    // 7. 检查预定义规则
    for (const rule of this.rules) {
      if (this.ruleMatches(rule, request)) {
        if (rule.action === 'allow') {
          return { allowed: true, reason: 'Matched allow rule' };
        } else if (rule.action === 'deny') {
          return { allowed: false, reason: 'Matched deny rule' };
        }
        // 'ask' 继续到交互式提示
        break;
      }
    }

    // 8. 交互式询问
    return this.askUser(request);
  }

  // 检查规则是否匹配
  private ruleMatches(rule: PermissionRule, request: PermissionRequest): boolean {
    if (rule.type !== request.type) {
      return false;
    }

    if (!rule.pattern) {
      return true;
    }

    if (typeof rule.pattern === 'string') {
      return request.resource?.includes(rule.pattern) ?? false;
    }

    return rule.pattern.test(request.resource || '');
  }

  // 检查已记住的权限
  private checkRemembered(request: PermissionRequest): boolean | null {
    const key = this.getPermissionKey(request);

    for (const perm of this.rememberedPermissions) {
      if (perm.type === request.type) {
        if (request.resource?.includes(perm.pattern) || perm.pattern === '*') {
          return perm.allowed;
        }
      }
    }

    return null;
  }

  // 生成权限键
  private getPermissionKey(request: PermissionRequest): string {
    return `${request.type}:${request.resource || '*'}`;
  }

  // 交互式询问用户
  private async askUser(request: PermissionRequest): Promise<PermissionDecision> {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│          Permission Request             │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Tool: ${request.tool.padEnd(33)}│`);
    console.log(`│ Type: ${request.type.padEnd(33)}│`);
    if (request.resource) {
      const resource = request.resource.length > 33
        ? '...' + request.resource.slice(-30)
        : request.resource;
      console.log(`│ Resource: ${resource.padEnd(29)}│`);
    }
    console.log(`│ Description: ${request.description.slice(0, 26).padEnd(26)}│`);
    console.log('└─────────────────────────────────────────┘');
    console.log('\nOptions:');
    console.log('  [y] Yes, allow once');
    console.log('  [n] No, deny');
    console.log('  [a] Always allow for this session');
    console.log('  [A] Always allow (remember)');
    console.log('  [N] Never allow (remember)');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('\nYour choice [y/n/a/A/N]: ', (answer) => {
        rl.close();

        const choice = answer.trim().toLowerCase();
        const key = this.getPermissionKey(request);

        switch (choice) {
          case 'y':
            resolve({ allowed: true, scope: 'once' });
            break;

          case 'a':
            this.sessionPermissions.set(key, true);
            resolve({ allowed: true, scope: 'session', remember: true });
            break;

          case 'A':
            this.rememberPermission(request, true, 'always');
            resolve({ allowed: true, scope: 'always', remember: true });
            break;

          case 'N':
            this.rememberPermission(request, false, 'always');
            resolve({ allowed: false, scope: 'always', remember: true });
            break;

          case 'n':
          default:
            resolve({ allowed: false, scope: 'once' });
            break;
        }
      });
    });
  }

  // 记住权限决策
  private rememberPermission(
    request: PermissionRequest,
    allowed: boolean,
    scope: 'session' | 'always'
  ): void {
    const perm: RememberedPermission = {
      type: request.type,
      pattern: request.resource || '*',
      allowed,
      scope,
      timestamp: Date.now(),
    };

    // 移除旧的同类权限
    this.rememberedPermissions = this.rememberedPermissions.filter(
      p => !(p.type === perm.type && p.pattern === perm.pattern)
    );

    this.rememberedPermissions.push(perm);

    if (scope === 'always') {
      this.persistPermissions();
    }
  }

  // 设置默认规则
  private setupDefaultRules(): void {
    this.rules = [
      // 允许读取当前目录下的文件
      { type: 'file_read', action: 'allow' },

      // 安全的 bash 命令
      { type: 'bash_command', pattern: /^(ls|pwd|cat|head|tail|grep|find|echo|which|node --version|npm --version|git status|git log|git diff)/, action: 'allow' },

      // 危险操作需要询问
      { type: 'file_delete', action: 'ask' },
      { type: 'bash_command', pattern: /^(rm|sudo|chmod|chown|mv|dd)/, action: 'ask' },
      { type: 'network_request', action: 'ask' },
      { type: 'mcp_server', action: 'ask' },
      { type: 'plugin_install', action: 'ask' },
      { type: 'system_config', action: 'ask' },
    ];
  }

  // 添加规则
  addRule(rule: PermissionRule): void {
    this.rules.unshift(rule); // 新规则优先
  }

  // 清除会话权限
  clearSessionPermissions(): void {
    this.sessionPermissions.clear();
  }

  // 持久化权限
  private persistPermissions(): void {
    const permFile = path.join(this.configDir, 'permissions.json');

    try {
      const alwaysPerms = this.rememberedPermissions.filter(p => p.scope === 'always');
      fs.writeFileSync(permFile, JSON.stringify(alwaysPerms, null, 2));
    } catch (err) {
      console.warn('Failed to persist permissions:', err);
    }
  }

  // 加载持久化的权限
  private loadPersistedPermissions(): void {
    const permFile = path.join(this.configDir, 'permissions.json');

    if (!fs.existsSync(permFile)) {
      return;
    }

    try {
      const data = fs.readFileSync(permFile, 'utf-8');
      this.rememberedPermissions = JSON.parse(data);
    } catch (err) {
      console.warn('Failed to load persisted permissions:', err);
    }
  }

  // 加载权限配置（从 settings.json）
  private loadPermissionConfig(): void {
    const settingsFile = path.join(this.configDir, 'settings.json');

    if (!fs.existsSync(settingsFile)) {
      return;
    }

    try {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      if (settings.permissions) {
        this.permissionConfig = settings.permissions;

        // 配置审计日志
        if (this.permissionConfig.audit?.enabled) {
          this.auditEnabled = true;
          if (this.permissionConfig.audit.logFile) {
            this.auditLogPath = path.resolve(this.permissionConfig.audit.logFile);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load permission config from settings.json:', err);
    }
  }

  // 检查工具级权限
  private checkToolPermission(request: PermissionRequest): boolean | null {
    const { tools } = this.permissionConfig;
    if (!tools) return null;

    // 黑名单优先
    if (tools.deny?.length) {
      for (const pattern of tools.deny) {
        if (this.matchesPattern(request.tool, pattern)) {
          return false;
        }
      }
    }

    // 白名单检查
    if (tools.allow?.length) {
      for (const pattern of tools.allow) {
        if (this.matchesPattern(request.tool, pattern)) {
          return true;
        }
      }
      // 如果定义了白名单，但不在白名单中，则拒绝
      return false;
    }

    return null;
  }

  // 检查路径级权限（支持 glob patterns）
  private checkPathPermission(filePath: string): boolean | null {
    const { paths } = this.permissionConfig;
    if (!paths) return null;

    const resolvedPath = path.resolve(filePath);

    // 黑名单优先
    if (paths.deny?.length) {
      for (const pattern of paths.deny) {
        if (this.matchesGlobPath(resolvedPath, pattern)) {
          return false;
        }
      }
    }

    // 白名单检查
    if (paths.allow?.length) {
      for (const pattern of paths.allow) {
        if (this.matchesGlobPath(resolvedPath, pattern)) {
          return true;
        }
      }
      // 如果定义了白名单，但不在白名单中，则拒绝
      return false;
    }

    return null;
  }

  // 检查命令级权限（支持 glob patterns）
  private checkCommandPermission(command: string): boolean | null {
    const { commands } = this.permissionConfig;
    if (!commands) return null;

    // 提取命令主体（第一个单词）
    const cmdName = command.trim().split(/\s+/)[0];

    // 黑名单优先
    if (commands.deny?.length) {
      for (const pattern of commands.deny) {
        if (this.matchesPattern(command, pattern) || this.matchesPattern(cmdName, pattern)) {
          return false;
        }
      }
    }

    // 白名单检查
    if (commands.allow?.length) {
      for (const pattern of commands.allow) {
        if (this.matchesPattern(command, pattern) || this.matchesPattern(cmdName, pattern)) {
          return true;
        }
      }
      // 如果定义了白名单，但不在白名单中，则拒绝
      return false;
    }

    return null;
  }

  // 检查网络权限
  private checkNetworkPermission(url: string): boolean | null {
    const { network } = this.permissionConfig;
    if (!network) return null;

    // 提取域名
    let domain: string;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch {
      domain = url;
    }

    // 黑名单优先
    if (network.deny?.length) {
      for (const pattern of network.deny) {
        if (this.matchesPattern(domain, pattern) || this.matchesPattern(url, pattern)) {
          return false;
        }
      }
    }

    // 白名单检查
    if (network.allow?.length) {
      for (const pattern of network.allow) {
        if (this.matchesPattern(domain, pattern) || this.matchesPattern(url, pattern)) {
          return true;
        }
      }
      // 如果定义了白名单，但不在白名单中，则拒绝
      return false;
    }

    return null;
  }

  // 模式匹配（支持通配符 * 和 ?）
  private matchesPattern(value: string, pattern: string): boolean {
    // 精确匹配
    if (value === pattern) return true;

    // 通配符匹配
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(value, pattern, { nocase: false });
    }

    // 包含匹配
    return value.includes(pattern);
  }

  // Glob 路径匹配
  private matchesGlobPath(filePath: string, pattern: string): boolean {
    // 将 pattern 解析为绝对路径（如果不是 glob pattern）
    let globPattern = pattern;

    // 如果 pattern 不包含通配符，将其视为路径前缀
    if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
      const resolvedPattern = path.resolve(pattern);
      return filePath.startsWith(resolvedPattern);
    }

    // 使用 minimatch 进行 glob 匹配
    return minimatch(filePath, globPattern, {
      dot: true,
      matchBase: false,
      nocase: process.platform === 'win32'
    });
  }

  // 记录审计日志
  private logAudit(request: PermissionRequest, decision: PermissionDecision): void {
    if (!this.auditEnabled) return;

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      type: request.type,
      tool: request.tool,
      resource: request.resource,
      decision: decision.allowed ? 'allow' : 'deny',
      reason: decision.reason || 'No reason provided',
      scope: decision.scope,
      user: decision.scope !== undefined,  // 如果有 scope，说明是用户决定的
    };

    try {
      // 检查日志文件大小
      const maxSize = this.permissionConfig.audit?.maxSize || 10 * 1024 * 1024; // 默认 10MB
      if (fs.existsSync(this.auditLogPath)) {
        const stats = fs.statSync(this.auditLogPath);
        if (stats.size > maxSize) {
          // 归档旧日志
          const archivePath = `${this.auditLogPath}.${Date.now()}`;
          fs.renameSync(this.auditLogPath, archivePath);
        }
      }

      // 追加日志
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);
    } catch (err) {
      console.warn('Failed to write audit log:', err);
    }
  }

  // 设置权限配置
  setPermissionConfig(config: PermissionConfig): void {
    this.permissionConfig = config;

    // 更新审计日志配置
    if (config.audit?.enabled) {
      this.auditEnabled = true;
      if (config.audit.logFile) {
        this.auditLogPath = path.resolve(config.audit.logFile);
      }
    } else {
      this.auditEnabled = false;
    }
  }

  // 获取权限配置
  getPermissionConfig(): PermissionConfig {
    return { ...this.permissionConfig };
  }

  // 导出权限配置
  export(): object {
    return {
      mode: this.mode,
      rules: this.rules,
      rememberedPermissions: this.rememberedPermissions,
      allowedDirs: this.allowedDirs,
      permissionConfig: this.permissionConfig,
      auditEnabled: this.auditEnabled,
    };
  }
}

// 权限检查装饰器（用于工具）
export function requiresPermission(type: PermissionType, descriptionFn?: (input: unknown) => string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { permissionManager?: PermissionManager }, ...args: unknown[]) {
      const manager = this.permissionManager || permissionManager;
      const input = args[0];

      const request: PermissionRequest = {
        type,
        tool: propertyKey,
        description: descriptionFn ? descriptionFn(input) : `Execute ${propertyKey}`,
        resource: typeof input === 'object' && input !== null
          ? ((input as Record<string, unknown>).file_path as string) ||
            ((input as Record<string, unknown>).path as string) ||
            ((input as Record<string, unknown>).command as string)
          : undefined,
      };

      const decision = await manager.check(request);

      if (!decision.allowed) {
        throw new Error(`Permission denied: ${decision.reason || 'User denied'}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// 默认权限管理器实例
export const permissionManager = new PermissionManager();

// ============ T071: 细粒度工具权限控制 ============
export * from './tools.js';
