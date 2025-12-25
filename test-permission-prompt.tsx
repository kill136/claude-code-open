#!/usr/bin/env tsx
/**
 * 快速测试 PermissionPrompt 组件
 */

import React from 'react';
import { render } from 'ink';
import { PermissionPrompt } from './src/ui/components/PermissionPrompt.js';

// 测试文件写入权限
const TestApp = () => {
  return (
    <PermissionPrompt
      toolName="Write"
      type="file_write"
      description="Write enhanced component to file"
      resource="/home/user/claude-code-open/src/ui/components/PermissionPrompt.tsx"
      details={{
        size: '8.5 KB',
        encoding: 'utf-8',
        enhanced: 'true',
      }}
      rememberedPatterns={['*.tsx', '*.ts']}
      onDecision={(decision) => {
        console.log('\n✓ Component rendered successfully!');
        console.log('Decision:', {
          allowed: decision.allowed,
          scope: decision.scope,
          remember: decision.remember,
        });
        process.exit(0);
      }}
    />
  );
};

render(<TestApp />);
