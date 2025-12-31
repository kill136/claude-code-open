/**
 * UI 入口点
 * 使用 Ink 渲染
 *
 * 官方 Claude Code 的渲染策略：
 * 1. 监听 stdout.on("resize") 事件
 * 2. resize 时更新 terminalColumns/terminalRows
 * 3. 使用 Static 组件固化历史消息
 * 4. 增量渲染 (blit) 优化性能
 */

import React from 'react';
import { render, type Instance } from 'ink';
import { App } from './App.js';

export interface RenderOptions {
  model: string;
  initialPrompt?: string;
  verbose?: boolean;
  systemPrompt?: string;
}

// 保存 Ink 实例的引用，用于后续操作
let inkInstance: Instance | null = null;

export function renderApp(options: RenderOptions): Instance {
  // 使用 Ink 的标准配置
  // 注意：Ink 会自动处理终端 resize 事件
  inkInstance = render(
    <App
      model={options.model}
      initialPrompt={options.initialPrompt}
      verbose={options.verbose}
      systemPrompt={options.systemPrompt}
    />,
    {
      // 配置 Ink 选项
      exitOnCtrlC: true,
      patchConsole: true,  // 确保 console.log 不干扰 Ink 渲染
    }
  );

  return inkInstance;
}

/**
 * 获取当前 Ink 实例
 */
export function getInkInstance(): Instance | null {
  return inkInstance;
}

/**
 * 清理并卸载 Ink 应用
 */
export function unmountApp(): void {
  if (inkInstance) {
    inkInstance.unmount();
    inkInstance = null;
  }
}

export { App };
