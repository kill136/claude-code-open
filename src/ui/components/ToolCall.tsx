/**
 * ToolCall 组件
 * 显示工具调用状态
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

interface ToolCallProps {
  name: string;
  status: 'running' | 'success' | 'error';
  result?: string;
  duration?: number;
}

export const ToolCall: React.FC<ToolCallProps> = ({
  name,
  status,
  result,
  duration,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Spinner />;
      case 'success':
        return <Text color="green">✓</Text>;
      case 'error':
        return <Text color="red">✗</Text>;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'cyan';
      case 'success':
        return 'green';
      case 'error':
        return 'red';
    }
  };

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        {getStatusIcon()}
        <Text> </Text>
        <Text color={getStatusColor()} bold>
          {name}
        </Text>
        {duration !== undefined && (
          <Text color="gray"> ({duration}ms)</Text>
        )}
      </Box>
      {result && status !== 'running' && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            {result.length > 200 ? result.substring(0, 200) + '...' : result}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ToolCall;
