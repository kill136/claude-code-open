/**
 * PermissionPrompt 组件
 * 工具权限确认对话框
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface PermissionPromptProps {
  toolName: string;
  description: string;
  details?: string;
  onAllow: () => void;
  onDeny: () => void;
  onAllowAlways?: () => void;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  toolName,
  description,
  details,
  onAllow,
  onDeny,
  onAllowAlways,
}) => {
  const [selected, setSelected] = useState(0);

  const options = [
    { label: 'Allow once', action: onAllow, key: 'y' },
    { label: 'Deny', action: onDeny, key: 'n' },
  ];

  if (onAllowAlways) {
    options.push({ label: 'Always allow', action: onAllowAlways, key: 'a' });
  }

  useInput((input, key) => {
    if (key.leftArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      setSelected((prev) => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      options[selected].action();
    } else {
      // 快捷键
      const option = options.find((o) => o.key === input.toLowerCase());
      if (option) {
        option.action();
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Box>
        <Text color="yellow" bold>
          ⚠ Permission Required
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text>
          <Text bold>{toolName}</Text> wants to: {description}
        </Text>
      </Box>

      {details && (
        <Box marginTop={1} marginLeft={2}>
          <Text color="gray">{details}</Text>
        </Box>
      )}

      <Box marginTop={1} gap={2}>
        {options.map((option, index) => (
          <Box key={option.key}>
            <Text
              backgroundColor={selected === index ? 'cyan' : undefined}
              color={selected === index ? 'black' : 'white'}
            >
              {' '}
              [{option.key.toUpperCase()}] {option.label}{' '}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default PermissionPrompt;
