/**
 * Input 组件
 * 用户输入框 - 仿官方 Claude Code 风格
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  suggestion?: string;
}

export const Input: React.FC<InputProps> = ({
  prompt = '> ',
  placeholder = '',
  onSubmit,
  disabled = false,
  suggestion,
}) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (value.trim()) {
          onSubmit(value.trim());
          setHistory(prev => [value.trim(), ...prev.slice(0, 99)]);
          setValue('');
          setCursor(0);
          setHistoryIndex(-1);
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
      } else if (key.upArrow) {
        // 历史记录向上
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setValue(history[newIndex]);
          setCursor(history[newIndex].length);
        }
      } else if (key.downArrow) {
        // 历史记录向下
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setValue(history[newIndex]);
          setCursor(history[newIndex].length);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setValue('');
          setCursor(0);
        }
      } else if (key.ctrl && input === 'a') {
        // Ctrl+A: 移动到行首
        setCursor(0);
      } else if (key.ctrl && input === 'e') {
        // Ctrl+E: 移动到行尾
        setCursor(value.length);
      } else if (key.ctrl && input === 'u') {
        // Ctrl+U: 清除到行首
        setValue(value.slice(cursor));
        setCursor(0);
      } else if (key.ctrl && input === 'k') {
        // Ctrl+K: 清除到行尾
        setValue(value.slice(0, cursor));
      } else if (!key.ctrl && !key.meta && input) {
        setValue((prev) => prev.slice(0, cursor) + input + prev.slice(cursor));
        setCursor((prev) => prev + input.length);
      }
    },
    { isActive: !disabled }
  );

  // 显示建议文本
  const showSuggestion = !value && suggestion && !disabled;

  return (
    <Box flexDirection="column">
      {/* 建议提示行 */}
      {showSuggestion && (
        <Box marginBottom={0}>
          <Text color="gray" dimColor>
            {prompt}Try "{suggestion}"
          </Text>
        </Box>
      )}
      {/* 输入行 */}
      <Box>
        <Text color="white" bold>
          {prompt}
        </Text>
        {!disabled && value === '' ? (
          <Text backgroundColor="gray" color="black">
            {' '}
          </Text>
        ) : (
          <>
            <Text>
              {value.slice(0, cursor)}
            </Text>
            {!disabled && (
              <Text backgroundColor="gray" color="black">
                {value[cursor] || ' '}
              </Text>
            )}
            <Text>{value.slice(cursor + 1)}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Input;
