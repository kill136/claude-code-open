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

  // Vim 模式支持
  const [vimModeEnabled, setVimModeEnabled] = useState(process.env.CLAUDE_CODE_VIM_MODE === 'true');
  const [vimNormalMode, setVimNormalMode] = useState(vimModeEnabled);
  const [undoStack, setUndoStack] = useState<Array<{ value: string; cursor: number }>>([]);
  const [lastDeletedText, setLastDeletedText] = useState('');
  const [pendingCommand, setPendingCommand] = useState(''); // For multi-key commands like dd

  // 监听环境变量变化（通过轮询检测）
  useEffect(() => {
    const checkVimMode = () => {
      const newVimMode = process.env.CLAUDE_CODE_VIM_MODE === 'true';
      if (newVimMode !== vimModeEnabled) {
        setVimModeEnabled(newVimMode);
        setVimNormalMode(newVimMode); // 启用时默认进入 Normal 模式
      }
    };

    const interval = setInterval(checkVimMode, 500); // 每500ms检查一次
    return () => clearInterval(interval);
  }, [vimModeEnabled]);

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

  // Vim 辅助函数
  const saveToUndoStack = () => {
    setUndoStack(prev => [...prev, { value, cursor }].slice(-50)); // 保留最近50个状态
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const lastState = undoStack[undoStack.length - 1];
      setValue(lastState.value);
      setCursor(lastState.cursor);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  // 单词导航辅助函数
  const findNextWordStart = (text: string, pos: number): number => {
    let i = pos;
    // 跳过当前单词
    while (i < text.length && /\S/.test(text[i])) i++;
    // 跳过空格
    while (i < text.length && /\s/.test(text[i])) i++;
    return Math.min(i, text.length);
  };

  const findPrevWordStart = (text: string, pos: number): number => {
    let i = pos - 1;
    // 跳过空格
    while (i >= 0 && /\s/.test(text[i])) i--;
    // 跳过单词
    while (i >= 0 && /\S/.test(text[i])) i--;
    return Math.max(0, i + 1);
  };

  const findWordEnd = (text: string, pos: number): number => {
    let i = pos;
    // 如果在空格上，先跳到下一个单词
    if (i < text.length && /\s/.test(text[i])) {
      while (i < text.length && /\s/.test(text[i])) i++;
    }
    // 跳到单词末尾
    while (i < text.length && /\S/.test(text[i])) i++;
    return Math.min(i - 1, text.length - 1);
  };

  useInput(
    (input, key) => {
      if (disabled) return;

      // 在命令列表显示时的特殊处理
      if (showCommandList && !vimNormalMode) {
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

      // ===== VIM 模式处理 =====
      if (vimModeEnabled && vimNormalMode) {
        // Normal 模式键绑定

        // ESC - 保持在 Normal 模式
        if (key.escape) {
          setPendingCommand('');
          return;
        }

        // 处理多键命令（如 dd）
        if (pendingCommand === 'd') {
          if (input === 'd') {
            // dd - 删除整行
            saveToUndoStack();
            setLastDeletedText(value);
            setValue('');
            setCursor(0);
            setPendingCommand('');
            return;
          }
          setPendingCommand('');
        }

        // 撤销
        if (input === 'u') {
          undo();
          return;
        }

        // 导航 - h, j, k, l
        if (input === 'h') {
          setCursor(prev => Math.max(0, prev - 1));
          return;
        }
        if (input === 'l') {
          setCursor(prev => Math.min(value.length - 1, prev + 1));
          return;
        }
        if (input === 'j' && !showCommandList) {
          // j - 历史记录向下
          if (history.length > 0 && historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setValue(history[newIndex]);
            setCursor(Math.min(cursor, history[newIndex].length - 1));
          }
          return;
        }
        if (input === 'k' && !showCommandList) {
          // k - 历史记录向上
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setValue(history[newIndex]);
            setCursor(Math.min(cursor, history[newIndex].length - 1));
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setValue('');
            setCursor(0);
          }
          return;
        }

        // 单词导航 - w, b, e
        if (input === 'w') {
          setCursor(findNextWordStart(value, cursor));
          return;
        }
        if (input === 'b') {
          setCursor(findPrevWordStart(value, cursor));
          return;
        }
        if (input === 'e') {
          setCursor(findWordEnd(value, cursor));
          return;
        }

        // 行导航 - 0, $, ^
        if (input === '0') {
          setCursor(0);
          return;
        }
        if (input === '$') {
          setCursor(Math.max(0, value.length - 1));
          return;
        }
        if (input === '^') {
          // 移动到第一个非空白字符
          let pos = 0;
          while (pos < value.length && /\s/.test(value[pos])) pos++;
          setCursor(pos);
          return;
        }

        // 删除操作 - x, d, D
        if (input === 'x') {
          // x - 删除当前字符
          if (value.length > 0 && cursor < value.length) {
            saveToUndoStack();
            setLastDeletedText(value[cursor]);
            setValue(value.slice(0, cursor) + value.slice(cursor + 1));
            if (cursor >= value.length - 1 && cursor > 0) {
              setCursor(cursor - 1);
            }
          }
          return;
        }
        if (input === 'd') {
          // d - 开始删除命令（等待第二个按键）
          setPendingCommand('d');
          return;
        }
        if (input === 'D') {
          // D - 删除到行尾
          saveToUndoStack();
          setLastDeletedText(value.slice(cursor));
          setValue(value.slice(0, cursor));
          if (cursor > 0 && cursor >= value.length) {
            setCursor(cursor - 1);
          }
          return;
        }

        // 插入模式切换 - i, a, I, A, o, O
        if (input === 'i') {
          // i - 在光标前插入
          setVimNormalMode(false);
          return;
        }
        if (input === 'a') {
          // a - 在光标后插入
          setCursor(Math.min(value.length, cursor + 1));
          setVimNormalMode(false);
          return;
        }
        if (input === 'I') {
          // I - 在行首插入
          setCursor(0);
          setVimNormalMode(false);
          return;
        }
        if (input === 'A') {
          // A - 在行尾插入
          setCursor(value.length);
          setVimNormalMode(false);
          return;
        }
        if (input === 'o') {
          // o - 在下方新建行（对于单行输入，等同于 A）
          setCursor(value.length);
          setVimNormalMode(false);
          return;
        }
        if (input === 'O') {
          // O - 在上方新建行（对于单行输入，等同于 I）
          setCursor(0);
          setVimNormalMode(false);
          return;
        }

        // Enter - 提交
        if (key.return) {
          if (value.trim()) {
            onSubmit(value.trim());
            setHistory(prev => [value.trim(), ...prev.slice(0, 99)]);
            setValue('');
            setCursor(0);
            setHistoryIndex(-1);
            setUndoStack([]);
          }
          return;
        }

        return; // 在 Normal 模式下忽略其他输入
      }

      // ===== INSERT 模式或非 VIM 模式处理 =====

      // ESC 或 Ctrl+[ - 退出插入模式
      if (vimModeEnabled && !vimNormalMode) {
        if (key.escape || (key.ctrl && input === '[')) {
          setVimNormalMode(true);
          // Vim 惯例：退出插入模式时光标左移一位
          if (cursor > 0) {
            setCursor(cursor - 1);
          }
          return;
        }
      } else if (!vimModeEnabled && key.escape) {
        // 非 Vim 模式下 ESC 清除输入
        setValue('');
        setCursor(0);
        setHistoryIndex(-1);
        return;
      }

      if (key.return) {
        if (value.trim()) {
          onSubmit(value.trim());
          setHistory(prev => [value.trim(), ...prev.slice(0, 99)]);
          setValue('');
          setCursor(0);
          setHistoryIndex(-1);
          if (vimModeEnabled) {
            setVimNormalMode(true);
            setUndoStack([]);
          }
        }
      } else if (key.backspace || key.delete) {
        if (cursor > 0) {
          if (vimModeEnabled) saveToUndoStack();
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
        if (vimModeEnabled) saveToUndoStack();
        setValue(value.slice(cursor));
        setCursor(0);
      } else if (key.ctrl && input === 'k') {
        // Ctrl+K: 清除到行尾
        if (vimModeEnabled) saveToUndoStack();
        setValue(value.slice(0, cursor));
      } else if (!key.ctrl && !key.meta && input) {
        if (vimModeEnabled && input.length === 1) saveToUndoStack();
        setValue((prev) => prev.slice(0, cursor) + input + prev.slice(cursor));
        setCursor((prev) => prev + input.length);
      }
    },
    { isActive: !disabled }
  );

  // 显示建议文本
  const showSuggestion = !value && suggestion && !disabled;

  // Vim 模式指示器
  const modeIndicator = vimModeEnabled
    ? vimNormalMode
      ? '[N] '
      : '[I] '
    : '';

  // 显示待处理命令
  const commandIndicator = pendingCommand ? `[${pendingCommand}] ` : '';

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
            {modeIndicator}{prompt}Try "{suggestion}"
          </Text>
        </Box>
      )}

      {/* 输入行 */}
      <Box>
        {/* Vim 模式指示器 */}
        {vimModeEnabled && (
          <Text color={vimNormalMode ? 'yellow' : 'green'} bold>
            {modeIndicator}
          </Text>
        )}
        {/* 待处理命令指示器 */}
        {commandIndicator && (
          <Text color="cyan" bold>
            {commandIndicator}
          </Text>
        )}
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
