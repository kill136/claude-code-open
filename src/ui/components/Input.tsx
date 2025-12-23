/**
 * Input 组件
 * 用户输入框
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  prompt = 'You: ',
  placeholder = 'Type your message...',
  onSubmit,
  disabled = false,
}) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (value.trim()) {
          onSubmit(value.trim());
          setValue('');
          setCursor(0);
        }
      } else if (key.backspace || key.delete) {
        if (cursor > 0) {
          setValue((prev) => prev.slice(0, cursor - 1) + prev.slice(cursor));
          setCursor((prev) => prev - 1);
        }
      } else if (key.leftArrow) {
        setCursor((prev) => Math.max(0, prev - 1));
      } else if (key.rightArrow) {
        setCursor((prev) => Math.min(value.length, prev + 1));
      } else if (!key.ctrl && !key.meta && input) {
        setValue((prev) => prev.slice(0, cursor) + input + prev.slice(cursor));
        setCursor((prev) => prev + input.length);
      }
    },
    { isActive: !disabled }
  );

  // 显示带光标的文本
  const displayValue = value || (disabled ? '' : placeholder);
  const showPlaceholder = !value && !disabled;

  return (
    <Box>
      <Text color="blue" bold>
        {prompt}
      </Text>
      <Text color={showPlaceholder ? 'gray' : undefined} dimColor={showPlaceholder}>
        {displayValue.slice(0, cursor)}
      </Text>
      {!disabled && (
        <Text backgroundColor="white" color="black">
          {value[cursor] || ' '}
        </Text>
      )}
      <Text>{displayValue.slice(cursor + 1)}</Text>
    </Box>
  );
};

export default Input;
