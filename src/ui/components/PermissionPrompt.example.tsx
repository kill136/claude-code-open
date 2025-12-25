/**
 * PermissionPrompt 使用示例
 * 展示如何在不同场景下使用增强的权限提示组件
 */

import React from 'react';
import { render } from 'ink';
import { PermissionPrompt } from './PermissionPrompt.js';

// =============== 示例 1: 文件写入权限 ===============
export function FileWriteExample() {
  return (
    <PermissionPrompt
      toolName="Write"
      type="file_write"
      description="Write content to file"
      resource="/home/user/project/src/config.json"
      details={{
        size: '1.2 KB',
        encoding: 'utf-8',
      }}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 2: Bash 命令权限 ===============
export function BashCommandExample() {
  return (
    <PermissionPrompt
      toolName="Bash"
      type="bash_command"
      description="Execute shell command"
      resource="npm install --save axios"
      details={{
        timeout: '120000ms',
        sandbox: false,
      }}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 3: 危险操作 - 文件删除 ===============
export function DangerousOperationExample() {
  return (
    <PermissionPrompt
      toolName="Delete"
      type="file_delete"
      description="Delete file permanently"
      resource="/home/user/important-data.db"
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 4: 危险 Bash 命令 ===============
export function DangerousBashExample() {
  return (
    <PermissionPrompt
      toolName="Bash"
      type="bash_command"
      description="Execute potentially destructive command"
      resource="rm -rf /tmp/old-files/*"
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 5: 网络请求权限 ===============
export function NetworkRequestExample() {
  return (
    <PermissionPrompt
      toolName="WebFetch"
      type="network_request"
      description="Fetch content from URL"
      resource="https://api.github.com/repos/anthropics/claude-code"
      details={{
        method: 'GET',
        headers: { Accept: 'application/json' },
      }}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 6: MCP 服务器权限 ===============
export function McpServerExample() {
  return (
    <PermissionPrompt
      toolName="MCP"
      type="mcp_server"
      description="Connect to MCP server"
      resource="filesystem-server"
      details={{
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      }}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 7: 系统配置权限 ===============
export function SystemConfigExample() {
  return (
    <PermissionPrompt
      toolName="Config"
      type="system_config"
      description="Modify system configuration"
      resource="~/.claude/settings.json"
      details={{
        setting: 'apiKey',
        action: 'update',
      }}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 示例 8: 带记忆模式的权限 ===============
export function WithRememberedPatternsExample() {
  return (
    <PermissionPrompt
      toolName="Write"
      type="file_write"
      description="Write to configuration file"
      resource="/home/user/project/.eslintrc.json"
      rememberedPatterns={['*.json', '*.config.js']}
      onDecision={(decision) => {
        console.log('Decision:', decision);
        process.exit(0);
      }}
    />
  );
}

// =============== 运行示例 ===============
if (import.meta.url === `file://${process.argv[1]}`) {
  const examples = {
    'file-write': FileWriteExample,
    'bash': BashCommandExample,
    'delete': DangerousOperationExample,
    'dangerous-bash': DangerousBashExample,
    'network': NetworkRequestExample,
    'mcp': McpServerExample,
    'config': SystemConfigExample,
    'remembered': WithRememberedPatternsExample,
  };

  const exampleName = process.argv[2] || 'file-write';
  const Example = examples[exampleName as keyof typeof examples];

  if (!Example) {
    console.error(`Unknown example: ${exampleName}`);
    console.log('Available examples:', Object.keys(examples).join(', '));
    process.exit(1);
  }

  render(<Example />);
}
