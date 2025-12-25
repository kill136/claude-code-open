/**
 * 权限 UI 集成
 * 将 PermissionPrompt React 组件集成到 PermissionManager
 */

import React from 'react';
import { render } from 'ink';
import {
  PermissionPrompt,
  type PermissionType as UIPermissionType,
  type PermissionDecision as UIPermissionDecision,
} from '../ui/components/PermissionPrompt.js';
import type {
  PermissionRequest,
  PermissionDecision,
  PermissionType,
} from './index.js';

/**
 * 将权限类型从系统类型转换为 UI 类型
 */
function mapPermissionType(type: PermissionType): UIPermissionType {
  // 类型定义相同，直接返回
  return type as UIPermissionType;
}

/**
 * 格式化工具名称
 */
function formatToolName(toolName: string): string {
  // 首字母大写
  return toolName.charAt(0).toUpperCase() + toolName.slice(1);
}

/**
 * 提取已记住的模式
 * 从记住的权限中提取相关的模式
 */
function extractRememberedPatterns(
  request: PermissionRequest,
  rememberedPermissions: Array<{
    type: PermissionType;
    pattern: string;
    allowed: boolean;
  }>
): string[] {
  return rememberedPermissions
    .filter((perm) => perm.type === request.type && perm.pattern !== '*')
    .map((perm) => perm.pattern)
    .slice(0, 3); // 最多显示 3 个
}

/**
 * 使用 React UI 询问用户权限
 * 替代 readline 的命令行交互方式
 */
export async function askUserWithUI(
  request: PermissionRequest,
  rememberedPermissions: Array<{
    type: PermissionType;
    pattern: string;
    allowed: boolean;
  }> = []
): Promise<PermissionDecision> {
  return new Promise((resolve) => {
    const handleDecision = (uiDecision: UIPermissionDecision) => {
      // 转换 UI 决策为系统决策
      const systemDecision: PermissionDecision = {
        allowed: uiDecision.allowed,
        remember: uiDecision.remember,
        scope: uiDecision.scope === 'never' ? 'always' : uiDecision.scope,
        reason: uiDecision.remember
          ? `User choice (${uiDecision.scope})`
          : 'User choice (once)',
      };

      // 如果是 never，则记住为拒绝
      if (uiDecision.scope === 'never') {
        systemDecision.allowed = false;
      }

      // 清理 UI
      app.unmount();

      // 返回决策
      resolve(systemDecision);
    };

    // 渲染 UI
    const app = render(
      <PermissionPrompt
        toolName={formatToolName(request.tool)}
        type={mapPermissionType(request.type)}
        description={request.description}
        resource={request.resource}
        details={request.details as Record<string, unknown>}
        onDecision={handleDecision}
        rememberedPatterns={extractRememberedPatterns(request, rememberedPermissions)}
      />
    );
  });
}

/**
 * 扩展的权限管理器，使用 React UI
 */
export class UIPermissionManager {
  private rememberedPermissions: Array<{
    type: PermissionType;
    pattern: string;
    allowed: boolean;
    scope: 'session' | 'always';
    timestamp: number;
  }> = [];

  /**
   * 使用 UI 询问用户
   */
  async askUser(request: PermissionRequest): Promise<PermissionDecision> {
    return askUserWithUI(request, this.rememberedPermissions);
  }

  /**
   * 记住权限决策
   */
  rememberPermission(
    request: PermissionRequest,
    decision: PermissionDecision
  ): void {
    if (!decision.remember) {
      return;
    }

    const perm = {
      type: request.type,
      pattern: request.resource || '*',
      allowed: decision.allowed,
      scope: decision.scope as 'session' | 'always',
      timestamp: Date.now(),
    };

    // 移除旧的同类权限
    this.rememberedPermissions = this.rememberedPermissions.filter(
      (p) => !(p.type === perm.type && p.pattern === perm.pattern)
    );

    this.rememberedPermissions.push(perm);
  }

  /**
   * 清除会话权限
   */
  clearSessionPermissions(): void {
    this.rememberedPermissions = this.rememberedPermissions.filter(
      (p) => p.scope === 'always'
    );
  }

  /**
   * 获取记住的权限
   */
  getRememberedPermissions() {
    return this.rememberedPermissions;
  }
}

/**
 * 集成示例：如何在 PermissionManager 中使用
 *
 * ```typescript
 * import { UIPermissionManager } from './permissions/ui-integration.js';
 *
 * const uiManager = new UIPermissionManager();
 *
 * const request = {
 *   type: 'file_write',
 *   tool: 'Write',
 *   description: 'Write content to file',
 *   resource: '/home/user/config.json',
 *   details: { size: '1.2 KB' }
 * };
 *
 * const decision = await uiManager.askUser(request);
 * if (decision.allowed) {
 *   // 执行操作
 *   console.log('Permission granted');
 *   uiManager.rememberPermission(request, decision);
 * } else {
 *   console.log('Permission denied');
 * }
 * ```
 */
