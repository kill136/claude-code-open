/**
 * WebUI 权限处理器
 * 处理敏感工具操作的权限确认
 */

import type { PermissionMode } from '../../types/index.js';

/**
 * 权限请求
 */
export interface PermissionRequest {
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  requestId: string;
  approved: boolean;
  remember?: boolean; // 是否记住此次决定
  scope?: 'once' | 'session' | 'always'; // 记忆范围
}

/**
 * 待处理的权限请求
 */
interface PendingRequest {
  request: PermissionRequest;
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * 权限配置
 */
export interface PermissionConfig {
  mode: PermissionMode;
  timeout: number; // 超时时间（毫秒），默认 60000
  bypassTools?: string[]; // 绕过权限检查的工具列表
  alwaysAllow?: string[]; // 总是允许的工具列表
  alwaysDeny?: string[]; // 总是拒绝的工具列表
}

/**
 * 权限处理器
 *
 * 职责：
 * 1. 判断工具是否需要权限确认
 * 2. 创建权限请求并等待用户响应
 * 3. 管理权限决策的记忆（会话级别）
 * 4. 处理超时和错误情况
 */
export class PermissionHandler {
  private pendingRequests = new Map<string, PendingRequest>();
  private sessionMemory = new Map<string, boolean>(); // 会话级别的权限记忆
  private config: PermissionConfig;

  // 需要权限确认的工具列表
  private static readonly SENSITIVE_TOOLS = new Set([
    'Write',
    'Edit',
    'MultiEdit',
    'Bash',
    'NotebookEdit',
    'KillShell',
  ]);

  // 危险的 Bash 命令模式
  private static readonly DANGEROUS_BASH_PATTERNS = [
    /^\s*rm\s+/i,
    /^\s*sudo\s+/i,
    /^\s*chmod\s+/i,
    /^\s*chown\s+/i,
    /^\s*mv\s+.*\//i, // 移动到其他目录
    /^\s*dd\s+/i,
    /^\s*mkfs\s+/i,
    /^\s*format\s+/i,
    />\s*\/dev\//i,
  ];

  constructor(config?: Partial<PermissionConfig>) {
    this.config = {
      mode: config?.mode || 'default',
      timeout: config?.timeout || 60000, // 默认 60 秒超时
      bypassTools: config?.bypassTools || [],
      alwaysAllow: config?.alwaysAllow || [],
      alwaysDeny: config?.alwaysDeny || [],
    };
  }

  /**
   * 检查工具是否需要权限确认
   */
  needsPermission(tool: string, args: unknown): boolean {
    // 模式检查
    if (this.config.mode === 'bypassPermissions') {
      return false;
    }

    if (this.config.mode === 'plan') {
      // 计划模式下所有操作都需要确认
      return true;
    }

    // 检查配置的绕过列表
    if (this.config.bypassTools?.includes(tool)) {
      return false;
    }

    // 检查总是允许列表
    if (this.config.alwaysAllow?.includes(tool)) {
      return false;
    }

    // 检查总是拒绝列表（虽然会被拒绝，但仍然需要权限流程）
    if (this.config.alwaysDeny?.includes(tool)) {
      return true;
    }

    // acceptEdits 模式：自动允许文件编辑
    if (this.config.mode === 'acceptEdits') {
      if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
        return false;
      }
    }

    // 检查工具是否在敏感列表中
    if (!PermissionHandler.SENSITIVE_TOOLS.has(tool)) {
      return false;
    }

    // 特殊处理 Bash 命令
    if (tool === 'Bash') {
      return this.isBashCommandDangerous(args);
    }

    // 其他敏感工具默认需要权限
    return true;
  }

  /**
   * 判断 Bash 命令是否危险
   */
  private isBashCommandDangerous(args: unknown): boolean {
    const argsObj = args as Record<string, unknown>;
    const command = argsObj.command as string;

    if (!command) {
      return false;
    }

    // 检查是否匹配危险模式
    for (const pattern of PermissionHandler.DANGEROUS_BASH_PATTERNS) {
      if (pattern.test(command)) {
        return true;
      }
    }

    // 检查是否有管道到危险位置
    if (command.includes('>') && command.includes('/')) {
      return true;
    }

    return false;
  }

  /**
   * 创建权限请求
   */
  createRequest(tool: string, args: unknown): PermissionRequest {
    const requestId = this.generateRequestId();
    const argsObj = args as Record<string, unknown>;

    // 生成描述
    const description = this.generateDescription(tool, argsObj);

    // 评估风险级别
    const riskLevel = this.assessRiskLevel(tool, argsObj);

    return {
      requestId,
      tool,
      args: argsObj,
      description,
      riskLevel,
      timestamp: Date.now(),
    };
  }

  /**
   * 生成权限请求描述
   */
  private generateDescription(tool: string, args: Record<string, unknown>): string {
    switch (tool) {
      case 'Write':
        return `创建/覆盖文件: ${args.file_path}`;

      case 'Edit':
        return `编辑文件: ${args.file_path}`;

      case 'MultiEdit':
        const edits = args.edits as Array<{ file_path: string }> || [];
        return `批量编辑 ${edits.length} 个文件`;

      case 'Bash':
        const command = args.command as string;
        const truncated = command.length > 50 ? command.slice(0, 50) + '...' : command;
        return `执行命令: ${truncated}`;

      case 'NotebookEdit':
        return `编辑 Notebook: ${args.notebook_path}`;

      case 'KillShell':
        return `终止进程: ${args.bash_id}`;

      default:
        return `执行 ${tool}`;
    }
  }

  /**
   * 评估风险级别
   */
  private assessRiskLevel(tool: string, args: Record<string, unknown>): 'low' | 'medium' | 'high' {
    // Bash 命令风险评估
    if (tool === 'Bash') {
      const command = args.command as string;
      if (!command) return 'low';

      // 高风险命令
      if (/^\s*(rm|sudo|chmod|chown|dd|mkfs|format)/i.test(command)) {
        return 'high';
      }

      // 中风险命令
      if (/^\s*(mv|cp|curl|wget|git\s+push)/i.test(command)) {
        return 'medium';
      }

      return 'low';
    }

    // 文件删除类操作
    if (tool === 'KillShell') {
      return 'medium';
    }

    // 批量编辑
    if (tool === 'MultiEdit') {
      const edits = args.edits as Array<unknown> || [];
      return edits.length > 5 ? 'high' : 'medium';
    }

    // 文件写入
    if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 请求权限并等待响应
   *
   * 这个方法整合了创建请求、注册、等待响应的完整流程
   * 避免了分离 registerRequest 和 waitForResponse 导致的 Promise 处理问题
   *
   * @param tool 工具名称
   * @param args 工具参数
   * @param onRequestCreated 可选回调，当请求创建后调用（用于发送到前端）
   * @returns Promise<boolean> 当用户批准时返回 true，拒绝时返回 false
   * @throws Error 当超时或取消时抛出错误
   */
  async requestPermission(
    tool: string,
    args: unknown,
    onRequestCreated?: (request: PermissionRequest) => void
  ): Promise<boolean> {
    // 1. 创建权限请求
    const request = this.createRequest(tool, args);

    // 2. 通知外部（例如发送到前端）
    if (onRequestCreated) {
      onRequestCreated(request);
    }

    // 3. 创建 Promise 并设置超时
    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.requestId);
        reject(new Error('权限请求超时'));
      }, this.config.timeout);

      // 4. 保存请求和 Promise 控制函数
      this.pendingRequests.set(request.requestId, {
        request,
        resolve,
        reject,
        timeout,
      });
    });
  }

  /**
   * @deprecated 使用 requestPermission 替代
   * 保留此方法用于向后兼容
   */
  async waitForResponse(requestId: string): Promise<boolean> {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error(`未找到权限请求: ${requestId}`);
    }

    // 返回现有的 Promise（通过创建一个新的 Promise 来包装）
    return new Promise<boolean>((resolve, reject) => {
      // 替换现有的 resolve/reject
      const originalResolve = pending.resolve;
      const originalReject = pending.reject;

      pending.resolve = (value: boolean) => {
        originalResolve(value);
        resolve(value);
      };

      pending.reject = (error: Error) => {
        originalReject(error);
        reject(error);
      };
    });
  }

  /**
   * @deprecated 使用 requestPermission 替代
   * 保留此方法用于向后兼容
   */
  registerRequest(request: PermissionRequest): void {
    // 创建一个永不解析的 Promise（仅用于占位）
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(request.requestId);
    }, this.config.timeout);

    this.pendingRequests.set(request.requestId, {
      request,
      resolve: () => {
        console.warn('[PermissionHandler] resolve 被调用但没有关联的 Promise');
      },
      reject: () => {
        console.warn('[PermissionHandler] reject 被调用但没有关联的 Promise');
      },
      timeout,
    });
  }

  /**
   * 处理用户响应
   */
  handleResponse(requestId: string, approved: boolean, remember?: boolean, scope?: 'once' | 'session' | 'always'): void {
    const pending = this.pendingRequests.get(requestId);

    if (!pending) {
      console.warn(`[PermissionHandler] 未找到待处理的权限请求: ${requestId}`);
      return;
    }

    // 清除超时
    clearTimeout(pending.timeout);

    // 记忆决策
    if (remember && scope === 'session') {
      const key = this.getMemoryKey(pending.request.tool, pending.request.args);
      this.sessionMemory.set(key, approved);
    }

    // 解析 Promise
    pending.resolve(approved);

    // 清理
    this.pendingRequests.delete(requestId);
  }

  /**
   * 检查是否已有会话级别的权限记忆
   */
  checkSessionMemory(tool: string, args: unknown): boolean | null {
    const key = this.getMemoryKey(tool, args as Record<string, unknown>);
    const remembered = this.sessionMemory.get(key);
    return remembered !== undefined ? remembered : null;
  }

  /**
   * 生成记忆键
   */
  private getMemoryKey(tool: string, args: Record<string, unknown>): string {
    switch (tool) {
      case 'Write':
      case 'Edit':
      case 'NotebookEdit':
        // 按文件路径记忆
        return `${tool}:${args.file_path}`;

      case 'Bash':
        // 按命令主体记忆（第一个单词）
        const command = args.command as string;
        const cmdName = command.trim().split(/\s+/)[0];
        return `Bash:${cmdName}`;

      case 'MultiEdit':
        // 批量编辑不记忆（每次都需要确认）
        return `${tool}:${Date.now()}`;

      default:
        return `${tool}:*`;
    }
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * 取消所有待处理的请求
   */
  cancelAll(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('权限请求已取消'));
    }
    this.pendingRequests.clear();
  }

  /**
   * 取消特定请求
   */
  cancelRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('权限请求已取消'));
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * 清除会话记忆
   */
  clearSessionMemory(): void {
    this.sessionMemory.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PermissionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * 获取待处理请求数量
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
