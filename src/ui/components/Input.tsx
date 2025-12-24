/**
 * Input 组件
 * 用户输入框 - 仿官方 Claude Code 风格
 * 支持斜杠命令自动补全
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// 官方 claude 颜色
const CLAUDE_COLOR = '#D77757';

// 命令定义
interface CommandInfo {
  name: string;
  description: string;
  aliases?: string[];
}

// 所有可用命令列表 (简化版)
const ALL_COMMANDS: CommandInfo[] = [
  { name: 'add-dir', description: 'Add a new working directory', aliases: ['add'] },
  { name: 'agents', description: 'Manage agent configurations' },
  { name: 'bug', description: 'Report a bug or issue' },
  { name: 'chrome', description: 'Claude in Chrome (Beta) settings' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Compact context to save tokens', aliases: ['c'] },
  { name: 'config', description: 'View or edit configuration' },
  { name: 'context', description: 'Show current context window usage', aliases: ['ctx'] },
  { name: 'cost', description: 'Show API cost and spending information' },
  { name: 'doctor', description: 'Run diagnostics to check for issues' },
  { name: 'exit', description: 'Exit Claude Code', aliases: ['quit', 'q'] },
  { name: 'export', description: 'Export conversation to file' },
  { name: 'feedback', description: 'Send feedback about Claude Code' },
  { name: 'files', description: 'List files in the current directory or context', aliases: ['ls'] },
  { name: 'help', description: 'Show help and available commands', aliases: ['?', 'h'] },
  { name: 'hooks', description: 'Manage hook configurations' },
  { name: 'ide', description: 'IDE integration settings' },
  { name: 'init', description: 'Initialize CLAUDE.md configuration file' },
  { name: 'install', description: 'Install MCP server' },
  { name: 'login', description: 'Log in to Anthropic account' },
  { name: 'logout', description: 'Log out from current account' },
  { name: 'mcp', description: 'Manage MCP servers' },
  { name: 'memory', description: 'View or edit memory/instructions' },
  { name: 'model', description: 'Switch or view current model', aliases: ['m'] },
  { name: 'permissions', description: 'View or change permission mode', aliases: ['perms'] },
  { name: 'plan', description: 'Enter planning mode for complex tasks' },
  { name: 'plugin', description: 'Manage plugins' },
  { name: 'pr-comments', description: 'View or respond to PR comments', aliases: ['pr'] },
  { name: 'release-notes', description: 'Show recent release notes and changes', aliases: ['changelog', 'whats-new'] },
  { name: 'resume', description: 'Resume a previous session', aliases: ['r'] },
  { name: 'review', description: 'Request a code review', aliases: ['code-review', 'cr'] },
  { name: 'rewind', description: 'Rewind conversation to a previous state' },
  { name: 'security-review', description: 'Run a security review on code', aliases: ['security', 'sec'] },
  { name: 'status', description: 'Show current session status' },
  { name: 'stickers', description: 'Fun stickers and reactions' },
  { name: 'tasks', description: 'Show running background tasks' },
  { name: 'terminal-setup', description: 'Terminal setup instructions' },
  { name: 'theme', description: 'Change color theme' },
  { name: 'todos', description: 'Show or manage the current todo list', aliases: ['todo'] },
  { name: 'usage', description: 'Show usage statistics' },
  { name: 'version', description: 'Show version information', aliases: ['v'] },
  { name: 'vim', description: 'Toggle vim keybindings' },
];

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
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // 检测是否在输入斜杠命令
  const isTypingCommand = value.startsWith('/');
  const commandQuery = isTypingCommand ? value.slice(1).toLowerCase() : '';

  // 过滤匹配的命令
  const filteredCommands = useMemo(() => {
    if (!isTypingCommand) return [];
    if (commandQuery === '') return ALL_COMMANDS.slice(0, 10); // 显示前10个命令

    return ALL_COMMANDS.filter(cmd => {
      const matchesName = cmd.name.toLowerCase().startsWith(commandQuery);
      const matchesAlias = cmd.aliases?.some(alias =>
        alias.toLowerCase().startsWith(commandQuery)
      );
      return matchesName || matchesAlias;
    }).slice(0, 10);
  }, [isTypingCommand, commandQuery]);

  // 显示命令列表
  const showCommandList = isTypingCommand && filteredCommands.length > 0;

  // 重置选择索引当命令列表变化时
  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandQuery]);

  useInput(
    (input, key) => {
      if (disabled) return;

      // 在命令列表显示时的特殊处理
      if (showCommandList) {
        if (key.upArrow) {
          setSelectedCommandIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          return;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (key.tab) {
          // Tab 补全选中的命令
          const selectedCommand = filteredCommands[selectedCommandIndex];
          if (selectedCommand) {
            setValue('/' + selectedCommand.name + ' ');
            setCursor(selectedCommand.name.length + 2);
          }
          return;
        }
      }

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
      } else if (key.upArrow && !showCommandList) {
        // 历史记录向上
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setValue(history[newIndex]);
          setCursor(history[newIndex].length);
        }
      } else if (key.downArrow && !showCommandList) {
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
      } else if (key.escape) {
        // Escape 清除输入
        setValue('');
        setCursor(0);
        setHistoryIndex(-1);
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
      {/* 斜杠命令列表 */}
      {showCommandList && (
        <Box flexDirection="column" marginBottom={1}>
          {filteredCommands.map((cmd, index) => (
            <Box key={cmd.name}>
              <Text
                backgroundColor={index === selectedCommandIndex ? 'gray' : undefined}
                color={index === selectedCommandIndex ? 'white' : undefined}
              >
                <Text color={CLAUDE_COLOR} bold={index === selectedCommandIndex}>
                  /{cmd.name}
                </Text>
                {cmd.aliases && cmd.aliases.length > 0 && (
                  <Text dimColor> ({cmd.aliases.join(', ')})</Text>
                )}
                <Text dimColor> - {cmd.description}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* 建议提示行 */}
      {showSuggestion && (
        <Box marginBottom={0}>
          <Text dimColor>
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
