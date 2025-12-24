/**
 * Header 组件
 * 仿官方 Claude Code 的头部样式
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  version: string;
  model: string;
  cwd?: string;
  username?: string;
  apiType?: string;
  organization?: string;
  isCompact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  version,
  model,
  cwd,
  username,
  apiType = 'Claude API',
  organization,
  isCompact = false,
}) => {
  // 紧凑模式 - 对话开始后显示的简洁头部
  if (isCompact) {
    return (
      <Box marginBottom={1} paddingX={1}>
        <Text color="red" bold>
          Claude Code
        </Text>
        <Text color="gray"> v{version}</Text>
        <Text color="gray"> · </Text>
        <Text color="cyan">{model}</Text>
        {cwd && (
          <>
            <Text color="gray"> · </Text>
            <Text color="gray" dimColor>{cwd}</Text>
          </>
        )}
      </Box>
    );
  }

  // 完整模式 - 带边框的头部 (用于没有欢迎屏幕时)
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      {/* 标题行 */}
      <Box justifyContent="space-between">
        <Box>
          <Text color="red" bold>
            Claude Code
          </Text>
          <Text color="gray"> v{version}</Text>
        </Box>
        {username && (
          <Text bold>
            Welcome back {username}!
          </Text>
        )}
      </Box>

      {/* 模型和 API 信息 */}
      <Box marginTop={1}>
        <Text color="cyan">{model}</Text>
        <Text color="gray"> · </Text>
        <Text color="gray">{apiType}</Text>
        {organization && (
          <>
            <Text color="gray"> · </Text>
            <Text color="gray">{organization}</Text>
          </>
        )}
      </Box>

      {/* 工作目录 */}
      {cwd && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>{cwd}</Text>
        </Box>
      )}
    </Box>
  );
};

export default Header;
