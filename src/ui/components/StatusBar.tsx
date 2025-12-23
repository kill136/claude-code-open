/**
 * StatusBar 组件
 * 底部状态栏
 */

import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  messageCount: number;
  tokenCount?: number;
  cost?: string;
  duration?: number;
  isProcessing?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  messageCount,
  tokenCount,
  cost,
  duration,
  isProcessing,
}) => {
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <Text color="gray">
          Messages: <Text color="white">{messageCount}</Text>
        </Text>
        {tokenCount !== undefined && (
          <Text color="gray">
            Tokens: <Text color="white">{tokenCount.toLocaleString()}</Text>
          </Text>
        )}
        {cost && (
          <Text color="gray">
            Cost: <Text color="green">{cost}</Text>
          </Text>
        )}
      </Box>

      <Box gap={2}>
        {duration !== undefined && (
          <Text color="gray">
            Duration: <Text color="white">{formatDuration(duration)}</Text>
          </Text>
        )}
        {isProcessing && (
          <Text color="yellow">Processing...</Text>
        )}
      </Box>
    </Box>
  );
};

export default StatusBar;
