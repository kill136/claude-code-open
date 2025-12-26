/**
 * Hooks 系统
 * 支持在工具调用前后执行自定义脚本或 URL 回调
 * 基于官方 Claude Code CLI v2.0.76 逆向分析
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Hook 事件类型（官方支持的事件 + CLI 级别事件）
 */
export type HookEvent =
  // 工具级别事件
  | 'PreToolUse'           // 工具执行前
  | 'PostToolUse'          // 工具执行后
  | 'PostToolUseFailure'   // 工具执行失败后
  | 'Notification'         // 通知事件
  | 'UserPromptSubmit'     // 用户提交提示
  | 'SessionStart'         // 会话开始
  | 'SessionEnd'           // 会话结束
  | 'Stop'                 // 停止事件
  | 'SubagentStart'        // 子代理开始
  | 'SubagentStop'         // 子代理停止
  | 'PreCompact'           // 压缩前
  | 'PermissionRequest'    // 权限请求
  // CLI 级别事件（新增）
  | 'BeforeSetup'          // 设置前（对应 action_before_setup）
  | 'AfterSetup'           // 设置后（对应 action_after_setup）
  | 'CommandsLoaded'       // 命令加载完成（对应 action_commands_loaded）
  | 'ToolsLoaded'          // 工具加载完成（对应 action_tools_loaded）
  | 'McpConfigsLoaded'     // MCP 配置加载完成（对应 action_mcp_configs_loaded）
  | 'PluginsInitialized'   // 插件初始化后（对应 action_after_plugins_init）
  | 'AfterHooks';          // Hooks 执行后（对应 action_after_hooks）

/**
 * Hook 类型（对应官方 Claude Code CLI 支持的类型 + 扩展类型）
 * - command: 执行 shell 命令（官方）
 * - prompt: LLM 提示评估（官方）
 * - agent: 代理验证器（官方）
 * - url: HTTP 回调（扩展，用于远程集成）
 */
export type HookType = 'command' | 'prompt' | 'agent' | 'url';

/**
 * Command Hook 配置
 */
export interface CommandHookConfig {
  type: 'command';
  /** 执行的命令（支持环境变量替换，如 $TOOL_NAME） */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number;
  /** 是否阻塞（等待完成，默认 true） */
  blocking?: boolean;
  /** 匹配条件（工具名或正则） */
  matcher?: string;
}

/**
 * Prompt Hook 配置（使用 LLM 评估）
 */
export interface PromptHookConfig {
  type: 'prompt';
  /** LLM 提示模板 */
  prompt: string;
  /** 使用的模型（可选，默认使用当前会话模型） */
  model?: string;
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number;
  /** 是否阻塞（等待完成，默认 true） */
  blocking?: boolean;
  /** 匹配条件（工具名或正则） */
  matcher?: string;
}

/**
 * Agent Hook 配置（代理验证器）
 */
export interface AgentHookConfig {
  type: 'agent';
  /** 代理类型或名称 */
  agentType: string;
  /** 代理配置 */
  agentConfig?: Record<string, unknown>;
  /** 超时时间（毫秒，默认 60000） */
  timeout?: number;
  /** 是否阻塞（等待完成，默认 true） */
  blocking?: boolean;
  /** 匹配条件（工具名或正则） */
  matcher?: string;
}

/**
 * URL Hook 配置（扩展类型，用于远程集成）
 */
export interface UrlHookConfig {
  type: 'url';
  /** 回调 URL */
  url: string;
  /** HTTP 方法（默认 POST） */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 超时时间（毫秒，默认 10000） */
  timeout?: number;
  /** 是否阻塞（等待完成，默认 false） */
  blocking?: boolean;
  /** 匹配条件（工具名或正则） */
  matcher?: string;
}

/**
 * Hook 配置（联合类型）
 */
export type HookConfig = CommandHookConfig | PromptHookConfig | AgentHookConfig | UrlHookConfig;

/**
 * 旧版 Hook 配置（兼容性）
 */
export interface LegacyHookConfig {
  event: HookEvent;
  matcher?: string;
  command: string;
  args?: string[];
  timeout?: number;
  env?: Record<string, string>;
  blocking?: boolean;
}

export interface HookInput {
  event: HookEvent;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: string;
  message?: string;
  sessionId?: string;
}

export interface HookResult {
  success: boolean;
  output?: string;
  error?: string;
  blocked?: boolean;
  blockMessage?: string;
  /** 异步钩子标识（支持后台执行） */
  async?: boolean;
  /** 钩子决策（用于 agent 类型） */
  decision?: 'allow' | 'deny' | 'block';
  /** 决策原因 */
  reason?: string;
}

/**
 * 注册的 Hooks 存储（按事件类型分组）
 */
export interface RegisteredHooks {
  [event: string]: HookConfig[];
}

const registeredHooks: RegisteredHooks = {};

/**
 * 注册 hook
 */
export function registerHook(event: HookEvent, config: HookConfig): void {
  if (!registeredHooks[event]) {
    registeredHooks[event] = [];
  }
  registeredHooks[event].push(config);
}

/**
 * 注册旧版 hook（兼容性）
 */
export function registerLegacyHook(config: LegacyHookConfig): void {
  const hookConfig: CommandHookConfig = {
    type: 'command',
    command: config.command,
    args: config.args,
    env: config.env,
    timeout: config.timeout,
    blocking: config.blocking,
    matcher: config.matcher,
  };
  registerHook(config.event, hookConfig);
}

/**
 * 从配置文件加载 hooks（支持新旧两种格式）
 */
export function loadHooksFromFile(configPath: string): void {
  if (!fs.existsSync(configPath)) return;

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // 新格式：{ "hooks": { "PreToolUse": [...], "PostToolUse": [...] } }
    if (config.hooks && typeof config.hooks === 'object' && !Array.isArray(config.hooks)) {
      for (const [eventName, hooks] of Object.entries(config.hooks)) {
        if (!isValidHookEvent(eventName)) {
          console.warn(`Unknown hook event: ${eventName}`);
          continue;
        }

        const hookArray = Array.isArray(hooks) ? hooks : [hooks];
        for (const hook of hookArray) {
          if (isValidHookConfig(hook)) {
            registerHook(eventName as HookEvent, hook);
          } else {
            console.warn(`Invalid hook config for event ${eventName}:`, hook);
          }
        }
      }
    }
    // 旧格式：{ "hooks": [...] }（兼容性）
    else if (config.hooks && Array.isArray(config.hooks)) {
      for (const hook of config.hooks) {
        if (isValidLegacyHookConfig(hook)) {
          registerLegacyHook(hook);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to load hooks from ${configPath}:`, err);
  }
}

/**
 * 验证 Hook 事件名称
 */
function isValidHookEvent(event: string): boolean {
  const validEvents: HookEvent[] = [
    // 工具级别事件
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Notification',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'PreCompact',
    'PermissionRequest',
    // CLI 级别事件
    'BeforeSetup',
    'AfterSetup',
    'CommandsLoaded',
    'ToolsLoaded',
    'McpConfigsLoaded',
    'PluginsInitialized',
    'AfterHooks',
  ];
  return validEvents.includes(event as HookEvent);
}

/**
 * 验证 Hook 配置
 */
function isValidHookConfig(config: any): config is HookConfig {
  if (!config || typeof config !== 'object') return false;

  if (config.type === 'command') {
    return typeof config.command === 'string';
  } else if (config.type === 'prompt') {
    return typeof config.prompt === 'string';
  } else if (config.type === 'agent') {
    return typeof config.agentType === 'string';
  } else if (config.type === 'url') {
    return typeof config.url === 'string';
  }

  return false;
}

/**
 * 验证旧版 Hook 配置
 */
function isValidLegacyHookConfig(config: any): config is LegacyHookConfig {
  return config &&
         typeof config === 'object' &&
         typeof config.event === 'string' &&
         typeof config.command === 'string';
}

/**
 * 从项目目录加载 hooks
 */
export function loadProjectHooks(projectDir: string): void {
  // 检查 .claude/settings.json
  const settingsPath = path.join(projectDir, '.claude', 'settings.json');
  loadHooksFromFile(settingsPath);

  // 检查 .claude/hooks/ 目录
  const hooksDir = path.join(projectDir, '.claude', 'hooks');
  if (fs.existsSync(hooksDir) && fs.statSync(hooksDir).isDirectory()) {
    const files = fs.readdirSync(hooksDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        loadHooksFromFile(path.join(hooksDir, file));
      }
    }
  }
}

/**
 * 获取匹配的 hooks
 */
function getMatchingHooks(event: HookEvent, toolName?: string): HookConfig[] {
  const hooks = registeredHooks[event] || [];

  return hooks.filter((hook) => {
    if (hook.matcher && toolName) {
      // 支持正则匹配
      if (hook.matcher.startsWith('/') && hook.matcher.endsWith('/')) {
        const regex = new RegExp(hook.matcher.slice(1, -1));
        return regex.test(toolName);
      }
      // 精确匹配
      return hook.matcher === toolName;
    }

    return true;
  });
}

/**
 * 替换命令中的环境变量占位符
 */
function replaceCommandVariables(command: string, input: HookInput): string {
  return command
    .replace(/\$TOOL_NAME/g, input.toolName || '')
    .replace(/\$EVENT/g, input.event)
    .replace(/\$SESSION_ID/g, input.sessionId || '');
}

/**
 * 执行 Command Hook
 */
async function executeCommandHook(
  hook: CommandHookConfig,
  input: HookInput
): Promise<HookResult> {
  return new Promise((resolve) => {
    const timeout = hook.timeout || 30000;
    let stdout = '';
    let stderr = '';

    // 替换命令中的环境变量
    const command = replaceCommandVariables(hook.command, input);

    // 准备环境变量
    const env = {
      ...process.env,
      ...hook.env,
      CLAUDE_HOOK_EVENT: input.event,
      CLAUDE_HOOK_TOOL_NAME: input.toolName || '',
      CLAUDE_HOOK_SESSION_ID: input.sessionId || '',
    };

    // 通过 stdin 传递输入
    const inputJson = JSON.stringify({
      event: input.event,
      toolName: input.toolName,
      toolInput: input.toolInput,
      toolOutput: input.toolOutput,
      message: input.message,
      sessionId: input.sessionId,
    });

    const proc = spawn(command, hook.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true, // 使用 shell 执行以支持复杂命令
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        success: false,
        error: 'Hook execution timed out',
      });
    }, timeout);

    proc.stdin?.write(inputJson);
    proc.stdin?.end();

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      // 检查是否阻塞
      if (code !== 0) {
        // 尝试解析 JSON 输出以获取阻塞消息
        try {
          const output = JSON.parse(stdout);
          if (output.blocked) {
            resolve({
              success: false,
              blocked: true,
              blockMessage: output.message || 'Blocked by hook',
            });
            return;
          }
        } catch {
          // 非 JSON 输出
        }

        resolve({
          success: false,
          error: stderr || `Hook exited with code ${code}`,
        });
        return;
      }

      resolve({
        success: true,
        output: stdout,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * 执行 Prompt Hook（使用 LLM 评估）
 */
async function executePromptHook(
  hook: PromptHookConfig,
  input: HookInput
): Promise<HookResult> {
  const timeout = hook.timeout || 30000;

  try {
    // 构建提示词，替换变量
    let prompt = hook.prompt
      .replace(/\{EVENT\}/g, input.event)
      .replace(/\{TOOL_NAME\}/g, input.toolName || '')
      .replace(/\{TOOL_INPUT\}/g, JSON.stringify(input.toolInput || {}))
      .replace(/\{TOOL_OUTPUT\}/g, input.toolOutput || '')
      .replace(/\{MESSAGE\}/g, input.message || '')
      .replace(/\{SESSION_ID\}/g, input.sessionId || '');

    // TODO: 集成 Anthropic API 调用
    // 这里需要调用 Claude API 来评估提示
    // 目前返回一个占位符实现
    console.warn('[Prompt Hook] LLM evaluation not yet implemented');

    return {
      success: true,
      output: JSON.stringify({
        type: 'prompt_evaluation',
        model: hook.model || 'claude-3-sonnet-20240229',
        decision: 'allow',
        message: 'Prompt hook evaluation not yet implemented',
      }),
      async: false,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Prompt hook evaluation failed',
    };
  }
}

/**
 * 执行 Agent Hook（代理验证器）
 */
async function executeAgentHook(
  hook: AgentHookConfig,
  input: HookInput
): Promise<HookResult> {
  const timeout = hook.timeout || 60000;

  try {
    // TODO: 集成 Agent 系统调用
    // 这里需要调用指定的 Agent 来验证操作
    // 目前返回一个占位符实现
    console.warn(`[Agent Hook] Agent validation not yet implemented for: ${hook.agentType}`);

    return {
      success: true,
      output: JSON.stringify({
        type: 'agent_validation',
        agentType: hook.agentType,
        decision: 'allow',
        message: 'Agent hook validation not yet implemented',
      }),
      async: false,
      decision: 'allow',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Agent hook validation failed',
    };
  }
}

/**
 * 执行 URL Hook（扩展功能，用于远程集成）
 */
async function executeUrlHook(
  hook: UrlHookConfig,
  input: HookInput
): Promise<HookResult> {
  const timeout = hook.timeout || 10000;
  const method = hook.method || 'POST';

  const payload = {
    event: input.event,
    toolName: input.toolName,
    toolInput: input.toolInput,
    toolOutput: input.toolOutput,
    message: input.message,
    sessionId: input.sessionId,
    timestamp: new Date().toISOString(),
  };

  try {
    // 使用 fetch API（Node.js 18+ 内置）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Claude-Code-Hooks/2.0',
      ...(hook.headers || {}),
    };

    const response = await fetch(hook.url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
      };
    }

    // 尝试解析 JSON 响应
    try {
      const responseJson = JSON.parse(responseText);
      if (responseJson.blocked) {
        return {
          success: false,
          blocked: true,
          blockMessage: responseJson.message || 'Blocked by hook',
        };
      }
      return {
        success: true,
        output: responseText,
      };
    } catch {
      // 非 JSON 响应
      return {
        success: true,
        output: responseText,
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Hook request timed out',
      };
    }
    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * 执行单个 hook（根据类型分发）
 */
async function executeHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
  if (hook.type === 'command') {
    return executeCommandHook(hook, input);
  } else if (hook.type === 'prompt') {
    return executePromptHook(hook, input);
  } else if (hook.type === 'agent') {
    return executeAgentHook(hook, input);
  } else if (hook.type === 'url') {
    return executeUrlHook(hook, input);
  } else {
    return {
      success: false,
      error: `Unknown hook type: ${(hook as any).type}`,
    };
  }
}

/**
 * 运行所有匹配的 hooks
 */
export async function runHooks(input: HookInput): Promise<HookResult[]> {
  const matchingHooks = getMatchingHooks(input.event, input.toolName);
  const results: HookResult[] = [];

  for (const hook of matchingHooks) {
    const result = await executeHook(hook, input);
    results.push(result);

    // 如果 hook 阻塞且是 blocking 类型，停止执行后续 hooks
    if (result.blocked && hook.blocking) {
      break;
    }
  }

  return results;
}

/**
 * 检查是否有任何 hook 阻塞操作
 */
export function isBlocked(results: HookResult[]): { blocked: boolean; message?: string } {
  for (const result of results) {
    if (result.blocked) {
      return { blocked: true, message: result.blockMessage };
    }
  }
  return { blocked: false };
}

/**
 * PreToolUse hook 辅助函数
 */
export async function runPreToolUseHooks(
  toolName: string,
  toolInput: unknown,
  sessionId?: string
): Promise<{ allowed: boolean; message?: string }> {
  const results = await runHooks({
    event: 'PreToolUse',
    toolName,
    toolInput,
    sessionId,
  });

  const blockCheck = isBlocked(results);
  return {
    allowed: !blockCheck.blocked,
    message: blockCheck.message,
  };
}

/**
 * PostToolUse hook 辅助函数
 */
export async function runPostToolUseHooks(
  toolName: string,
  toolInput: unknown,
  toolOutput: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'PostToolUse',
    toolName,
    toolInput,
    toolOutput,
    sessionId,
  });
}

/**
 * UserPromptSubmit hook - 用户提交提示时触发
 */
export async function runUserPromptSubmitHooks(
  prompt: string,
  sessionId?: string
): Promise<{ allowed: boolean; message?: string }> {
  const results = await runHooks({
    event: 'UserPromptSubmit',
    message: prompt,
    sessionId,
  });

  const blockCheck = isBlocked(results);
  return {
    allowed: !blockCheck.blocked,
    message: blockCheck.message,
  };
}

/**
 * Stop hook - 停止事件触发
 */
export async function runStopHooks(
  reason?: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'Stop',
    message: reason,
    sessionId,
  });
}

/**
 * PreCompact hook - 压缩前触发
 */
export async function runPreCompactHooks(
  sessionId?: string,
  currentTokens?: number
): Promise<{ allowed: boolean; message?: string }> {
  const results = await runHooks({
    event: 'PreCompact',
    message: currentTokens ? `Current tokens: ${currentTokens}` : undefined,
    sessionId,
  });

  const blockCheck = isBlocked(results);
  return {
    allowed: !blockCheck.blocked,
    message: blockCheck.message,
  };
}

/**
 * PostToolUseFailure hook - 工具执行失败后触发
 */
export async function runPostToolUseFailureHooks(
  toolName: string,
  toolInput: unknown,
  error: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'PostToolUseFailure',
    toolName,
    toolInput,
    message: error,
    sessionId,
  });
}

/**
 * 清除所有已注册的 hooks
 */
export function clearHooks(): void {
  for (const event in registeredHooks) {
    delete registeredHooks[event];
  }
}

/**
 * 获取已注册的 hooks 数量
 */
export function getHookCount(): number {
  let count = 0;
  for (const event in registeredHooks) {
    count += registeredHooks[event].length;
  }
  return count;
}

/**
 * 获取指定事件的 hooks 数量
 */
export function getEventHookCount(event: HookEvent): number {
  return (registeredHooks[event] || []).length;
}

/**
 * SessionStart hook - 会话开始时触发
 */
export async function runSessionStartHooks(sessionId: string): Promise<void> {
  await runHooks({
    event: 'SessionStart',
    sessionId,
  });
}

/**
 * SessionEnd hook - 会话结束时触发
 */
export async function runSessionEndHooks(sessionId: string): Promise<void> {
  await runHooks({
    event: 'SessionEnd',
    sessionId,
  });
}

/**
 * SubagentStart hook - 子代理启动时触发
 */
export async function runSubagentStartHooks(
  agentType: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'SubagentStart',
    toolName: agentType,
    sessionId,
  });
}

/**
 * SubagentStop hook - 子代理停止时触发
 */
export async function runSubagentStopHooks(
  agentType: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'SubagentStop',
    toolName: agentType,
    sessionId,
  });
}

/**
 * PermissionRequest hook - 权限请求时触发
 */
export async function runPermissionRequestHooks(
  toolName: string,
  toolInput: unknown,
  sessionId?: string
): Promise<{ decision?: 'allow' | 'deny'; message?: string }> {
  const results = await runHooks({
    event: 'PermissionRequest',
    toolName,
    toolInput,
    sessionId,
  });

  // 检查是否有 hook 返回决策
  for (const result of results) {
    if (result.output) {
      try {
        const output = JSON.parse(result.output);
        if (output.decision === 'allow' || output.decision === 'deny') {
          return {
            decision: output.decision,
            message: output.message,
          };
        }
      } catch {
        // 非 JSON 输出
      }
    }
  }

  return {};
}

/**
 * Notification hook - 发送通知时触发
 */
export async function runNotificationHooks(
  message: string,
  sessionId?: string
): Promise<void> {
  await runHooks({
    event: 'Notification',
    message,
    sessionId,
  });
}

/**
 * 获取所有已注册的 hooks（按事件分组）
 */
export function getRegisteredHooks(): RegisteredHooks {
  return { ...registeredHooks };
}

/**
 * 获取所有已注册的 hooks（扁平数组，兼容旧版）
 */
export function getRegisteredHooksFlat(): Array<{ event: HookEvent; config: HookConfig }> {
  const result: Array<{ event: HookEvent; config: HookConfig }> = [];
  for (const [event, hooks] of Object.entries(registeredHooks)) {
    for (const config of hooks) {
      result.push({ event: event as HookEvent, config });
    }
  }
  return result;
}

/**
 * 获取指定事件的 hooks
 */
export function getHooksForEvent(event: HookEvent): HookConfig[] {
  return [...(registeredHooks[event] || [])];
}

/**
 * 取消注册 hook
 */
export function unregisterHook(event: HookEvent, config: HookConfig): boolean {
  const hooks = registeredHooks[event];
  if (!hooks) return false;

  const index = hooks.findIndex((h) => {
    if (h.type === 'command' && config.type === 'command') {
      return h.command === config.command;
    } else if (h.type === 'url' && config.type === 'url') {
      return h.url === config.url;
    }
    return false;
  });

  if (index !== -1) {
    hooks.splice(index, 1);
    if (hooks.length === 0) {
      delete registeredHooks[event];
    }
    return true;
  }
  return false;
}

/**
 * 清除指定事件的所有 hooks
 */
export function clearEventHooks(event: HookEvent): void {
  delete registeredHooks[event];
}
