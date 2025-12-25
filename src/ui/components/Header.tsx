/**
 * Header 组件
 * 仿官方 Claude Code 的头部样式
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// 官方 claude 颜色 (clawd_body)
const CLAUDE_COLOR = '#D77757'; // rgb(215,119,87)

interface HeaderProps {
  version: string;
  model: string;
  cwd?: string;
  username?: string;
  apiType?: string;
  organization?: string;
  isCompact?: boolean;
  isPlanMode?: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  showShortcutHint?: boolean;
  hasUpdate?: boolean;
  latestVersion?: string;
}

export const Header: React.FC<HeaderProps> = ({
  version,
  model,
  cwd,
  username,
  apiType = 'Claude API',
  organization,
  isCompact = false,
  isPlanMode = false,
  connectionStatus = 'connected',
  showShortcutHint = true,
  hasUpdate = false,
  latestVersion,
}) => {
  // 连接状态指示器
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Text color="green">●</Text>;
      case 'connecting':
        return <Text color="yellow">●</Text>;
      case 'disconnected':
        return <Text color="gray" dimColor>●</Text>;
      case 'error':
        return <Text color="red">●</Text>;
      default:
        return null;
    }
  };

  const getConnectionLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return '';
    }
  };

  // 紧凑模式 - 对话开始后显示的简洁头部
  if (isCompact) {
    return (
      <Box marginBottom={1} paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={CLAUDE_COLOR} bold>
            Claude Code
          </Text>
          <Text dimColor> v{version}</Text>
          <Text dimColor> · </Text>
          <Text color="cyan">{model}</Text>
          {isPlanMode && (
            <>
              <Text dimColor> · </Text>
              <Text color="magenta" bold>📋 PLAN MODE</Text>
            </>
          )}
          {cwd && (
            <>
              <Text dimColor> · </Text>
              <Text dimColor>{cwd}</Text>
            </>
          )}
        </Box>
        <Box>
          {hasUpdate && latestVersion && (
            <>
              <Text color="green">🎉 v{latestVersion} available</Text>
              <Text dimColor> · </Text>
            </>
          )}
          {getConnectionIndicator()}
          <Text dimColor> {getConnectionLabel()}</Text>
        </Box>
      </Box>
    );
  }

  // 完整模式 - 带边框的头部 (用于没有欢迎屏幕时)
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isPlanMode ? 'magenta' : CLAUDE_COLOR}
      paddingX={2}
      paddingY={1}
    >
      {/* 标题行 */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={CLAUDE_COLOR} bold>
            Claude Code
          </Text>
          <Text dimColor> v{version}</Text>
          {hasUpdate && latestVersion && (
            <>
              <Text dimColor> · </Text>
              <Text color="green" bold>Update Available: v{latestVersion}</Text>
            </>
          )}
        </Box>
        <Box>
          {username && (
            <>
              <Text bold>Welcome back {username}!</Text>
              <Text dimColor> · </Text>
            </>
          )}
          {getConnectionIndicator()}
          <Text dimColor> {getConnectionLabel()}</Text>
        </Box>
      </Box>

      {/* 计划模式指示器 */}
      {isPlanMode && (
        <Box
          marginTop={1}
          paddingX={1}
          borderStyle="single"
          borderColor="magenta"
        >
          <Text color="magenta" bold>
            📋 PLAN MODE ACTIVE
          </Text>
          <Text dimColor> - Read-only exploration mode. Use /plan exit to submit plan.</Text>
        </Box>
      )}

      {/* 模型和 API 信息 */}
      <Box marginTop={1} justifyContent="space-between">
        <Box>
          <Text color="cyan">{model}</Text>
          <Text dimColor> · </Text>
          <Text dimColor>{apiType}</Text>
          {organization && (
            <>
              <Text dimColor> · </Text>
              <Text dimColor>{organization}</Text>
            </>
          )}
        </Box>
        {showShortcutHint && (
          <Text color="gray" dimColor>
            Press ? for shortcuts
          </Text>
        )}
      </Box>

      {/* 工作目录 */}
      {cwd && (
        <Box marginTop={1}>
          <Text dimColor>📁 {cwd}</Text>
        </Box>
      )}

      {/* 更新通知 */}
      {hasUpdate && latestVersion && (
        <Box
          marginTop={1}
          paddingX={1}
          borderStyle="single"
          borderColor="green"
        >
          <Text color="green">
            🎉 New version available! Run:
          </Text>
          <Text color="green" bold> npm install -g claude-code-open</Text>
        </Box>
      )}
    </Box>
  );
};

export default Header;
