/**
 * UI 入口点
 * 使用 Ink 渲染
 */

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export interface RenderOptions {
  model: string;
  initialPrompt?: string;
  verbose?: boolean;
  systemPrompt?: string;
}

export function renderApp(options: RenderOptions): void {
  render(
    <App
      model={options.model}
      initialPrompt={options.initialPrompt}
      verbose={options.verbose}
      systemPrompt={options.systemPrompt}
    />
  );
}

export { App };
