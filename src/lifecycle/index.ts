/**
 * 生命周期事件管理器
 * 基于官方 Claude Code CLI v2.0.76 的生命周期系统
 *
 * 生命周期事件分为两个级别：
 * 1. CLI 级别 - 整个 CLI 进程的生命周期
 * 2. Action 级别 - 单个命令执行的生命周期
 */

/**
 * 生命周期事件类型
 */
export type LifecycleEvent =
  // CLI 级别事件（CLI process lifecycle）
  | 'cli_entry'                    // CLI 入口
  | 'cli_imports_loaded'           // 导入加载完成
  | 'cli_version_fast_path'        // 版本快速路径（仅 --version）
  | 'cli_ripgrep_path'             // Ripgrep 路径（仅 --ripgrep）
  | 'cli_claude_in_chrome_mcp_path' // Chrome MCP 路径
  | 'cli_chrome_native_host_path'  // Chrome 原生主机路径
  | 'cli_before_main_import'       // 主函数导入前
  | 'cli_after_main_import'        // 主函数导入后
  | 'cli_after_main_complete'      // 主函数完成后
  // Action 级别事件（Action handler lifecycle）
  | 'action_handler_start'         // Action 处理器开始
  | 'action_mcp_configs_loaded'    // MCP 配置加载完成
  | 'action_after_input_prompt'    // 输入提示处理后
  | 'action_tools_loaded'          // 工具加载完成
  | 'action_before_setup'          // 设置前
  | 'action_after_setup'           // 设置后
  | 'action_commands_loaded'       // 命令加载完成
  | 'action_after_plugins_init'    // 插件初始化后
  | 'action_after_hooks';          // Hooks 执行后

/**
 * 生命周期事件处理器函数类型
 */
export type LifecycleEventHandler = (event: LifecycleEvent, data?: unknown) => void | Promise<void>;

/**
 * 生命周期事件数据
 */
export interface LifecycleEventData {
  event: LifecycleEvent;
  timestamp: number;
  data?: unknown;
}

/**
 * 生命周期管理器
 * 负责管理和触发生命周期事件
 */
class LifecycleManager {
  /** 事件处理器映射（每个事件可有多个处理器） */
  private handlers: Map<LifecycleEvent, LifecycleEventHandler[]> = new Map();

  /** 事件历史记录 */
  private eventHistory: LifecycleEventData[] = [];

  /** 是否启用调试模式 */
  private debugMode: boolean = false;

  /**
   * 注册事件处理器
   */
  on(event: LifecycleEvent, handler: LifecycleEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  /**
   * 触发事件
   * 按注册顺序依次执行所有处理器
   */
  async trigger(event: LifecycleEvent, data?: unknown): Promise<void> {
    const timestamp = Date.now();

    // 记录到历史
    this.eventHistory.push({ event, timestamp, data });

    // 调试输出
    if (this.debugMode || process.env.CLAUDE_DEBUG?.includes('lifecycle')) {
      console.error(`[Lifecycle] ${event}${data ? ` (${JSON.stringify(data)})` : ''}`);
    }

    // 执行所有注册的处理器
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(event, data);
      } catch (error) {
        console.error(`[Lifecycle] Error in handler for ${event}:`, error);
      }
    }
  }

  /**
   * 移除事件处理器
   */
  off(event: LifecycleEvent, handler: LifecycleEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 移除指定事件的所有处理器
   */
  clear(event?: LifecycleEvent): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * 获取事件历史记录
   */
  getHistory(): LifecycleEventData[] {
    return [...this.eventHistory];
  }

  /**
   * 获取指定事件的触发次数
   */
  getEventCount(event: LifecycleEvent): number {
    return this.eventHistory.filter(e => e.event === event).length;
  }

  /**
   * 检查事件是否已触发
   */
  hasTriggered(event: LifecycleEvent): boolean {
    return this.eventHistory.some(e => e.event === event);
  }

  /**
   * 启用/禁用调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * 获取已注册的处理器数量
   */
  getHandlerCount(event?: LifecycleEvent): number {
    if (event) {
      return this.handlers.get(event)?.length || 0;
    }
    let total = 0;
    this.handlers.forEach(handlers => {
      total += handlers.length;
    });
    return total;
  }

  /**
   * 清空事件历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

/**
 * 全局生命周期管理器实例
 */
export const lifecycleManager = new LifecycleManager();

/**
 * 触发生命周期事件的辅助函数（对应官方的 x9 函数）
 * 这是对外暴露的主要 API
 */
export async function emitLifecycleEvent(event: LifecycleEvent, data?: unknown): Promise<void> {
  await lifecycleManager.trigger(event, data);
}

/**
 * 注册生命周期事件处理器的辅助函数
 */
export function onLifecycleEvent(event: LifecycleEvent, handler: LifecycleEventHandler): void {
  lifecycleManager.on(event, handler);
}

/**
 * 移除生命周期事件处理器的辅助函数
 */
export function offLifecycleEvent(event: LifecycleEvent, handler: LifecycleEventHandler): void {
  lifecycleManager.off(event, handler);
}

/**
 * 获取生命周期事件历史
 */
export function getLifecycleHistory(): LifecycleEventData[] {
  return lifecycleManager.getHistory();
}

/**
 * 检查事件是否已触发
 */
export function hasLifecycleEventTriggered(event: LifecycleEvent): boolean {
  return lifecycleManager.hasTriggered(event);
}

/**
 * 启用生命周期调试模式
 */
export function enableLifecycleDebug(): void {
  lifecycleManager.setDebugMode(true);
}

/**
 * 禁用生命周期调试模式
 */
export function disableLifecycleDebug(): void {
  lifecycleManager.setDebugMode(false);
}

/**
 * 清空生命周期历史记录
 */
export function clearLifecycleHistory(): void {
  lifecycleManager.clearHistory();
}

/**
 * 清空所有生命周期处理器
 */
export function clearLifecycleHandlers(event?: LifecycleEvent): void {
  lifecycleManager.clear(event);
}
