/**
 * Message 组件
 * 显示用户或助手消息
 */

import React from 'react';
import { Box, Text } from 'ink';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export const Message: React.FC<MessageProps> = ({ role, content, timestamp }) => {
  const isUser = role === 'user';

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text bold color={isUser ? 'blue' : 'green'}>
          {isUser ? 'You' : 'Claude'}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor>
            {' '}
            {timestamp.toLocaleTimeString()}
          </Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text>{content}</Text>
      </Box>
    </Box>
  );
};

export default Message;
