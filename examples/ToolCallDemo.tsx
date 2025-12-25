/**
 * ToolCall 组件演示
 * 展示增强版 ToolCall 组件的各种使用场景
 */

import React from 'react';
import { render, Box, Text } from 'ink';
import { ToolCall } from '../src/ui/components/ToolCall.js';

const ToolCallDemo: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        ═══════════════════════════════════════════════════════
      </Text>
      <Text bold color="cyan">
        ToolCall 组件演示 - 增强功能展示
      </Text>
      <Text bold color="cyan">
        ═══════════════════════════════════════════════════════
      </Text>
      <Text>{'\n'}</Text>

      {/* 示例 1: Read 工具 - 成功 */}
      <Text bold color="white">
        示例 1: Read 工具 - 读取文件
      </Text>
      <ToolCall
        name="Read"
        status="success"
        input={{
          file_path: '/home/user/claude-code-open/src/cli.ts',
          limit: 50,
        }}
        result="     1→#!/usr/bin/env node
     2→/**
     3→ * Claude Code CLI Entry Point
     4→ */
     5→
     6→import { Command } from 'commander';
     7→import { ClaudeClient } from './core/client.js';
... 43 more lines"
        duration={125}
      />
      <Text>{'\n'}</Text>

      {/* 示例 2: Edit 工具 - 显示 diff */}
      <Text bold color="white">
        示例 2: Edit 工具 - 文件编辑（带 diff）
      </Text>
      <ToolCall
        name="Edit"
        status="success"
        input={{
          file_path: '/home/user/claude-code-open/src/config.ts',
          old_string: 'const DEFAULT_MODEL = "sonnet"',
          new_string: 'const DEFAULT_MODEL = "opus"',
        }}
        result={`Successfully edited /home/user/claude-code-open/src/config.ts

Changes: +1 -1
────────────────────────────────────────────────────────────
--- a/config.ts
+++ b/config.ts
@@ -12,1 +12,1 @@
-const DEFAULT_MODEL = "sonnet"
+const DEFAULT_MODEL = "opus"
────────────────────────────────────────────────────────────`}
        duration={45}
      />
      <Text>{'\n'}</Text>

      {/* 示例 3: Bash 工具 - 运行中 */}
      <Text bold color="white">
        示例 3: Bash 工具 - 正在执行
      </Text>
      <ToolCall
        name="Bash"
        status="running"
        input={{
          command: 'npm run build && npm test',
          description: 'Build and test project',
        }}
      />
      <Text>{'\n'}</Text>

      {/* 示例 4: Bash 工具 - 成功 */}
      <Text bold color="white">
        示例 4: Bash 工具 - 执行成功
      </Text>
      <ToolCall
        name="Bash"
        status="success"
        input={{
          command: 'git status',
        }}
        result={`On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   src/ui/components/ToolCall.tsx

no changes added to commit`}
        duration={89}
      />
      <Text>{'\n'}</Text>

      {/* 示例 5: MultiEdit 工具 - 批量编辑 */}
      <Text bold color="white">
        示例 5: MultiEdit 工具 - 批量编辑（带详细统计）
      </Text>
      <ToolCall
        name="MultiEdit"
        status="success"
        input={{
          file_path: '/home/user/claude-code-open/src/tools/base.ts',
          edits: [
            { old_string: 'BaseTool', new_string: 'AbstractTool' },
            { old_string: 'ToolRegistry', new_string: 'ToolManager' },
          ],
        }}
        result={`✓ Transaction successful: Applied 2 edit(s) to base.ts

Edit details:
  Edit 1: Replaced 8 chars with 12 chars (+4) at position 156
  Edit 2: Replaced 12 chars with 11 chars (-1) at position 892

File statistics:
  Lines: 67 → 67 (+0)
  Characters: 1823 → 1826 (+3)`}
        duration={156}
      />
      <Text>{'\n'}</Text>

      {/* 示例 6: Grep 工具 */}
      <Text bold color="white">
        示例 6: Grep 工具 - 搜索文件
      </Text>
      <ToolCall
        name="Grep"
        status="success"
        input={{
          pattern: 'export.*interface',
          glob: '*.ts',
          output_mode: 'content',
        }}
        result={`src/types/index.ts:8:export interface AgentInput {
src/types/index.ts:17:export interface BashInput {
src/types/index.ts:26:export interface BashOutputInput {
src/types/index.ts:41:export interface FileReadInput {
src/types/index.ts:145:export interface ToolResult {
... 15 more matches`}
        duration={234}
      />
      <Text>{'\n'}</Text>

      {/* 示例 7: Write 工具 */}
      <Text bold color="white">
        示例 7: Write 工具 - 创建文件
      </Text>
      <ToolCall
        name="Write"
        status="success"
        input={{
          file_path: '/home/user/claude-code-open/src/utils/helper.ts',
          content: 'export function hello() { return "world"; }',
        }}
        result="Successfully wrote 1 lines to /home/user/claude-code-open/src/utils/helper.ts"
        duration={67}
      />
      <Text>{'\n'}</Text>

      {/* 示例 8: 错误示例 - 文件不存在 */}
      <Text bold color="white">
        示例 8: Edit 工具 - 错误（文件不存在）
      </Text>
      <ToolCall
        name="Edit"
        status="error"
        input={{
          file_path: '/nonexistent/file.ts',
          old_string: 'foo',
          new_string: 'bar',
        }}
        error="File not found: /nonexistent/file.ts"
        duration={12}
      />
      <Text>{'\n'}</Text>

      {/* 示例 9: 错误示例 - 字符串不唯一 */}
      <Text bold color="white">
        示例 9: Edit 工具 - 错误（字符串不唯一）
      </Text>
      <ToolCall
        name="Edit"
        status="error"
        input={{
          file_path: '/home/user/claude-code-open/src/config.ts',
          old_string: 'const',
          new_string: 'let',
        }}
        error={`Edit validation failed:
old_string appears 15 times in the file (must be unique)

Please provide more context to make the old_string unique, or use replace_all=true.`}
        duration={34}
      />
      <Text>{'\n'}</Text>

      {/* 示例 10: Glob 工具 */}
      <Text bold color="white">
        示例 10: Glob 工具 - 文件匹配
      </Text>
      <ToolCall
        name="Glob"
        status="success"
        input={{
          pattern: '**/*.tsx',
        }}
        result={`Found 12 files:
src/ui/components/ToolCall.tsx
src/ui/components/Message.tsx
src/ui/components/Spinner.tsx
src/ui/components/Header.tsx
src/ui/components/StatusBar.tsx
... 7 more files`}
        duration={178}
      />
      <Text>{'\n'}</Text>

      {/* 示例 11: 超长输出 - 展示折叠功能 */}
      <Text bold color="white">
        示例 11: Read 工具 - 长输出（自动折叠）
      </Text>
      <ToolCall
        name="Read"
        status="success"
        input={{
          file_path: '/home/user/claude-code-open/package.json',
        }}
        result={`     1→{
     2→  "name": "claude-code-open",
     3→  "version": "2.0.76",
     4→  "description": "Open source Claude Code CLI",
     5→  "type": "module",
     6→  "bin": {
     7→    "claude": "./dist/cli.js"
     8→  },
     9→  "engines": {
    10→    "node": ">=18.0.0"
    11→  },
    12→  "scripts": {
    13→    "build": "tsc",
    14→    "start": "node dist/cli.js"
    15→  },
    16→  "dependencies": {
    17→    "@anthropic-ai/sdk": "^0.32.0",
    18→    "axios": "^1.6.0",
    19→    "chalk": "^5.3.0",
    20→    "commander": "^12.0.0"
    21→  },
    22→  "devDependencies": {
    23→    "@types/node": "^20.0.0",
    24→    "typescript": "^5.3.0"
    25→  }
    26→}`}
        duration={98}
        expanded={false}
      />
      <Text>{'\n'}</Text>

      <Text bold color="cyan">
        ═══════════════════════════════════════════════════════
      </Text>
      <Text bold color="green">
        演示完成 - 所有功能已展示
      </Text>
      <Text bold color="cyan">
        ═══════════════════════════════════════════════════════
      </Text>
    </Box>
  );
};

// 运行演示（仅当直接执行此文件时）
if (import.meta.url === `file://${process.argv[1]}`) {
  render(<ToolCallDemo />);
}

export default ToolCallDemo;
