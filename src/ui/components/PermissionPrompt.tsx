/**
 * PermissionPrompt 组件
 * 增强版工具权限确认对话框
 *
 * 支持功能:
 * - 多种工具类型的详细显示 (Bash, FileEdit, FileWrite 等)
 * - 文件路径高亮和命令格式化
 * - 权限记忆选项 (once, session, always, never)
 * - 危险操作警告
 * - 快捷键支持 (y/n/s/a/A/N)
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import * as path from 'path';

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

// 权限作用域
export type PermissionScope = 'once' | 'session' | 'always' | 'never';

// 权限决策回调
export interface PermissionDecision {
  allowed: boolean;
  scope: PermissionScope;
  remember: boolean;
}

export interface PermissionPromptProps {
  // 工具名称 (如 "Bash", "Edit", "Write")
  toolName: string;

  // 权限类型
  type: PermissionType;

  // 简短描述
  description: string;

  // 资源路径 (文件路径、命令、URL 等)
  resource?: string;

  // 额外详细信息
  details?: Record<string, unknown>;

  // 决策回调
  onDecision: (decision: PermissionDecision) => void;

  // 可选：已记住的权限模式
  rememberedPatterns?: string[];
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  toolName,
  type,
  description,
  resource,
  details,
  onDecision,
  rememberedPatterns = [],
}) => {
  const [selected, setSelected] = useState(0);

  // 定义可用选项
  const options = useMemo(() => {
    const opts = [
      {
        label: 'Yes, allow once',
        key: 'y',
        scope: 'once' as PermissionScope,
        allowed: true,
        description: 'Allow this operation one time only',
      },
      {
        label: 'No, deny',
        key: 'n',
        scope: 'once' as PermissionScope,
        allowed: false,
        description: 'Deny this operation',
      },
      {
        label: 'Allow for this session',
        key: 's',
        scope: 'session' as PermissionScope,
        allowed: true,
        description: 'Remember until program exits',
      },
      {
        label: 'Always allow (remember)',
        key: 'A',
        scope: 'always' as PermissionScope,
        allowed: true,
        description: 'Persist to config file',
      },
      {
        label: 'Never allow (remember)',
        key: 'N',
        scope: 'never' as PermissionScope,
        allowed: false,
        description: 'Persist denial to config file',
      },
    ];
    return opts;
  }, []);

  // 处理用户输入
  useInput((input, key) => {
    if (key.upArrow || key.leftArrow) {
      setSelected((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow || key.rightArrow) {
      setSelected((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const option = options[selected];
      onDecision({
        allowed: option.allowed,
        scope: option.scope,
        remember: option.scope === 'always' || option.scope === 'never',
      });
    } else {
      // 快捷键
      const option = options.find((o) => o.key === input || o.key.toLowerCase() === input);
      if (option) {
        onDecision({
          allowed: option.allowed,
          scope: option.scope,
          remember: option.scope === 'always' || option.scope === 'never',
        });
      }
    }
  });

  // 判断是否为危险操作
  const isDangerous = useMemo(() => {
    if (type === 'file_delete') return true;
    if (type === 'bash_command' && resource) {
      const dangerousCommands = ['rm', 'sudo', 'chmod', 'chown', 'mv', 'dd', 'mkfs', 'fdisk'];
      return dangerousCommands.some((cmd) => resource.trim().startsWith(cmd));
    }
    if (type === 'system_config') return true;
    return false;
  }, [type, resource]);

  // 格式化资源显示
  const formatResource = () => {
    if (!resource) return null;

    const maxLength = 80;
    let displayResource = resource;
    let label = 'Resource';

    switch (type) {
      case 'file_read':
      case 'file_write':
      case 'file_delete':
        label = 'File';
        // 显示相对路径（如果可能）
        try {
          const cwd = process.cwd();
          if (resource.startsWith(cwd)) {
            displayResource = './' + path.relative(cwd, resource);
          }
        } catch {
          // 保持原路径
        }
        break;
      case 'bash_command':
        label = 'Command';
        break;
      case 'network_request':
        label = 'URL';
        break;
      case 'mcp_server':
        label = 'Server';
        break;
    }

    // 截断过长的资源名
    if (displayResource.length > maxLength) {
      displayResource = '...' + displayResource.slice(-(maxLength - 3));
    }

    return (
      <Box marginTop={1}>
        <Text color="gray">{label}: </Text>
        <Text color="cyan" bold>
          {displayResource}
        </Text>
      </Box>
    );
  };

  // 显示额外详细信息
  const renderDetails = () => {
    if (!details || Object.keys(details).length === 0) return null;

    return (
      <Box marginTop={1} flexDirection="column">
        {Object.entries(details).map(([key, value]) => (
          <Box key={key}>
            <Text color="gray">
              {key}: <Text color="white">{String(value)}</Text>
            </Text>
          </Box>
        ))}
      </Box>
    );
  };

  // 获取权限类型图标和颜色
  const getTypeDisplay = () => {
    const displays: Record<PermissionType, { icon: string; color: string; label: string }> = {
      file_read: { icon: '📖', color: 'cyan', label: 'File Read' },
      file_write: { icon: '✏️ ', color: 'yellow', label: 'File Write' },
      file_delete: { icon: '🗑️ ', color: 'red', label: 'File Delete' },
      bash_command: { icon: '⚡', color: 'magenta', label: 'Bash Command' },
      network_request: { icon: '🌐', color: 'blue', label: 'Network Request' },
      mcp_server: { icon: '🔌', color: 'green', label: 'MCP Server' },
      plugin_install: { icon: '📦', color: 'yellow', label: 'Plugin Install' },
      system_config: { icon: '⚙️ ', color: 'red', label: 'System Config' },
    };

    return displays[type] || { icon: '🔧', color: 'white', label: 'Unknown' };
  };

  const typeDisplay = getTypeDisplay();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isDangerous ? 'red' : 'yellow'}
      paddingX={2}
      paddingY={1}
    >
      {/* 标题行 */}
      <Box>
        <Text color={isDangerous ? 'red' : 'yellow'} bold>
          {isDangerous ? '⚠️  DANGEROUS OPERATION - Permission Required' : '🔐 Permission Required'}
        </Text>
      </Box>

      {/* 工具和类型 */}
      <Box marginTop={1}>
        <Text>{typeDisplay.icon} </Text>
        <Text bold color={typeDisplay.color}>
          {toolName}
        </Text>
        <Text color="gray"> ({typeDisplay.label})</Text>
      </Box>

      {/* 描述 */}
      <Box marginTop={1} marginLeft={2}>
        <Text>{description}</Text>
      </Box>

      {/* 资源 */}
      {formatResource()}

      {/* 额外详细信息 */}
      {renderDetails()}

      {/* 已记住的模式提示 */}
      {rememberedPatterns.length > 0 && (
        <Box marginTop={1}>
          <Text color="green" dimColor>
            ℹ  Similar patterns already remembered: {rememberedPatterns.join(', ')}
          </Text>
        </Box>
      )}

      {/* 危险操作警告 */}
      {isDangerous && (
        <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="red">
          <Text color="red" bold>
            ⚠️  WARNING: This operation could be destructive!
          </Text>
        </Box>
      )}

      {/* 选项列表 */}
      <Box marginTop={2} flexDirection="column">
        {options.map((option, index) => {
          const isSelected = index === selected;

          return (
            <Box key={option.key} marginBottom={index < options.length - 1 ? 0 : 0}>
              <Text color={isSelected ? 'cyan' : 'gray'}>
                {isSelected ? '❯ ' : '  '}
              </Text>
              <Text
                color={isSelected ? 'cyan' : 'white'}
                bold={isSelected}
              >
                [{option.key}] {option.label}
              </Text>
              {isSelected && option.description && (
                <Text color="gray" dimColor>
                  {' '}
                  - {option.description}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* 提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑/↓ to navigate · enter to select · or type shortcut key
        </Text>
      </Box>
    </Box>
  );
};

export default PermissionPrompt;
