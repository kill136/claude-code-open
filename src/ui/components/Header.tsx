/**
 * Header 组件
 * 显示应用标题和状态
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  version: string;
  model: string;
  cwd?: string;
}

export const Header: React.FC<HeaderProps> = ({ version, model, cwd }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2}>
      <Box justifyContent="center">
        <Text color="cyan" bold>
          ╭─────────────────────────────────╮
        </Text>
      </Box>
      <Box justifyContent="center">
        <Text color="cyan" bold>
          │   Claude Code (Restored)        │
        </Text>
      </Box>
      <Box justifyContent="center">
        <Text color="cyan" bold>
          │      v{version}             │
        </Text>
      </Box>
      <Box justifyContent="center">
        <Text color="cyan" bold>
          ╰─────────────────────────────────╯
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Model: </Text>
        <Text color="yellow">{model}</Text>
        <Text color="gray"> │ </Text>
        <Text color="gray">Dir: </Text>
        <Text color="white">{cwd}</Text>
      </Box>
    </Box>
  );
};

export default Header;
