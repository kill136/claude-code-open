/**
 * Input 组件
 * 用户输入框 - 仿官方 Claude Code 风格
 * 支持斜杠命令、文件路径、@mention 自动补全
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { getCompletions, applyCompletion, type CompletionItem } from '../autocomplete/index.js';
import { getHistoryManager } from '../utils/history-manager.js';
import { HistorySearch } from './HistorySearch.js';

// 官方 claude 颜色
const CLAUDE_COLOR = '#D77757';

interface InputProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  suggestion?: string;
  /** 双击 ESC 触发 Rewind 的回调 */
  onRewindRequest?: () => void;
}

// 双击检测间隔（毫秒）
const DOUBLE_PRESS_INTERVAL = 300;

export const Input: React.FC<InputProps> = ({
  prompt = '> ',
  placeholder = '',
  onSubmit,
  disabled = false,
  suggestion,
  onRewindRequest,
}) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [completionType, setCompletionType] = useState<'command' | 'file' | 'mention' | 'none'>('none');

  // Vim 模式支持
  const [vimModeEnabled, setVimModeEnabled] = useState(process.env.CLAUDE_CODE_VIM_MODE === 'true');
  const [vimNormalMode, setVimNormalMode] = useState(vimModeEnabled);
  const [undoStack, setUndoStack] = useState<Array<{ value: string; cursor: number }>>([]);
  const [lastDeletedText, setLastDeletedText] = useState('');
  const [pendingCommand, setPendingCommand] = useState(''); // For multi-key commands like dd
  const [yankRegister, setYankRegister] = useState<string>(''); // Yank register for y/p
  const [replaceMode, setReplaceMode] = useState(false); // For 'r' command

  // IME (输入法编辑器) 组合状态支持
  const [isComposing, setIsComposing] = useState(false);
  const compositionTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Ctrl+R 反向历史搜索
  const [reverseSearchMode, setReverseSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  // 双击 ESC 检测
  const lastEscPressTimeRef = React.useRef<number>(0);

  const [searchOriginalValue, setSearchOriginalValue] = useState('');
  const historyManager = useMemo(() => getHistoryManager(), []);

  // 初始化：从持久化存储加载历史记录
  useEffect(() => {
    const loadedHistory = historyManager.getHistory();
    setHistory(loadedHistory);
  }, [historyManager]);

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

  // 反向搜索：当搜索查询变化时更新匹配结果
  useEffect(() => {
    if (reverseSearchMode) {
      const matches = historyManager.search(searchQuery);
      setSearchMatches(matches);
      setSearchIndex(0);
    }
  }, [searchQuery, reverseSearchMode, historyManager]);

  // 获取自动补全建议
  useEffect(() => {
    const fetchCompletions = async () => {
      const result = await getCompletions({
        fullText: value,
        cursorPosition: cursor,
        cwd: process.cwd(),
        enableFileCompletion: true,
        enableMentionCompletion: true,
      });

      setCompletions(result.items);
      setCompletionType(result.type);
      setSelectedCompletionIndex(0);
    };

    fetchCompletions();
  }, [value, cursor]);

  // 显示补全列表
  const showCompletionList = completions.length > 0 && completionType !== 'none';

  // IME 辅助函数
  // 检测字符是否为 CJK（中日韩）字符
  const isCJKChar = (char: string): boolean => {
    if (!char || char.length === 0) return false;
    const code = char.charCodeAt(0);
    // CJK 统一表意文字: U+4E00-U+9FFF
    // CJK 扩展 A: U+3400-U+4DBF
    // 日文假名: U+3040-U+309F (平假名), U+30A0-U+30FF (片假名)
    // 韩文音节: U+AC00-U+D7AF
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    );
  };

  // 开始组合输入（检测到 CJK 字符输入时）
  const startComposition = () => {
    setIsComposing(true);
    // 清除之前的定时器
    if (compositionTimerRef.current) {
      clearTimeout(compositionTimerRef.current);
    }
  };

  // 延迟结束组合（等待可能的后续输入）
  const scheduleEndComposition = () => {
    if (compositionTimerRef.current) {
      clearTimeout(compositionTimerRef.current);
    }
    // 500ms 后自动结束组合状态
    compositionTimerRef.current = setTimeout(() => {
      setIsComposing(false);
    }, 500);
  };

  // 立即结束组合
  const endComposition = () => {
    if (compositionTimerRef.current) {
      clearTimeout(compositionTimerRef.current);
      compositionTimerRef.current = null;
    }
    setIsComposing(false);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (compositionTimerRef.current) {
        clearTimeout(compositionTimerRef.current);
      }
    };
  }, []);

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

      // 检测 Shift+Enter 的转义序列 (\x1b\r)
      // 需要终端配置支持（详见 /terminal-setup 命令）
      if (input === '\x1b' && key.return) {
        // 插入换行符而非提交
        if (vimModeEnabled) saveToUndoStack();
        setValue((prev) => {
          const before = prev.slice(0, cursor);
          const after = prev.slice(cursor);
          return before + '\n' + after;
        });
        setCursor((prev) => prev + 1);
        return;
      }

      // ===== Ctrl+R 反向历史搜索模式处理 =====
      if (reverseSearchMode) {
        // ESC - 退出搜索模式，恢复原始值
        if (key.escape) {
          setValue(searchOriginalValue);
          setCursor(searchOriginalValue.length);
          setReverseSearchMode(false);
          setSearchQuery('');
          setSearchMatches([]);
          setSearchIndex(0);
          return;
        }

        // Enter - 选择当前匹配项
        if (key.return) {
          if (searchMatches.length > 0) {
            const selected = searchMatches[searchIndex];
            setValue(selected);
            setCursor(selected.length);
          }
          setReverseSearchMode(false);
          setSearchQuery('');
          setSearchMatches([]);
          setSearchIndex(0);
          return;
        }

        // Ctrl+R - 下一个匹配项（向后搜索）
        if (key.ctrl && input === 'r') {
          if (searchMatches.length > 0) {
            setSearchIndex((prev) => (prev + 1) % searchMatches.length);
          }
          return;
        }

        // Ctrl+S - 上一个匹配项（向前搜索）
        if (key.ctrl && input === 's') {
          if (searchMatches.length > 0) {
            setSearchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
          }
          return;
        }

        // Backspace - 删除搜索查询的最后一个字符
        if (key.backspace || key.delete) {
          setSearchQuery((prev) => prev.slice(0, -1));
          return;
        }

        // 其他字符 - 添加到搜索查询
        if (input && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + input);
          return;
        }

        return; // 在搜索模式下忽略其他按键
      }

      // Ctrl+R - 进入反向历史搜索模式（非搜索模式下）
      if (key.ctrl && input === 'r' && !reverseSearchMode) {
        setReverseSearchMode(true);
        setSearchOriginalValue(value);
        setSearchQuery('');
        const allMatches = historyManager.search('');
        setSearchMatches(allMatches);
        setSearchIndex(0);
        return;
      }

      // 在补全列表显示时的特殊处理
      if (showCompletionList && !vimNormalMode) {
        if (key.upArrow) {
          setSelectedCompletionIndex(prev =>
            prev > 0 ? prev - 1 : completions.length - 1
          );
          return;
        }
        if (key.downArrow) {
          setSelectedCompletionIndex(prev =>
            prev < completions.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (key.tab || key.return) {
          // Tab 或 Enter 补全选中的项
          const selectedCompletion = completions[selectedCompletionIndex];
          if (selectedCompletion) {
            // 应用补全
            const startPos = completionType === 'command' ? 0 :
              (value.lastIndexOf(' ', cursor - 1) + 1);
            const result = applyCompletion(
              value,
              selectedCompletion,
              startPos,
              cursor
            );

            // 如果是命令补全且按的是 Enter，应用后直接提交
            if (key.return && completionType === 'command') {
              // IME 组合期间：先结束组合，然后继续提交
              if (isComposing) {
                endComposition();
              }
              const finalValue = result.newText.trim();
              if (finalValue) {
                onSubmit(finalValue);
                historyManager.addCommand(finalValue);
                setHistory(prev => [finalValue, ...prev.slice(0, 99)]);
                setValue('');
                setCursor(0);
                setHistoryIndex(-1);
                if (vimModeEnabled) {
                  setVimNormalMode(true);
                  setUndoStack([]);
                }
              }
            } else {
              // Tab 键或其他类型的补全：只应用补全不提交
              setValue(result.newText);
              setCursor(result.newCursor);
            }
            return;
          }
          // 没有选中的补全项时，如果是 Enter 键，不 return，让后面的提交逻辑处理
          if (key.tab) {
            return;
          }
          // 如果是 Enter 键且没有有效的补全项，继续执行后面的提交逻辑
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

        // 处理多键命令（如 dd, yy）
        if (pendingCommand === 'd') {
          if (input === 'd') {
            // dd - 删除整行
            saveToUndoStack();
            setLastDeletedText(value);
            setYankRegister(value); // 删除的内容也会被 yank
            setValue('');
            setCursor(0);
            setPendingCommand('');
            return;
          }
          setPendingCommand('');
        }

        if (pendingCommand === 'y') {
          if (input === 'y') {
            // yy - 复制整行
            setYankRegister(value);
            setPendingCommand('');
            return;
          }
          setPendingCommand('');
        }

        if (pendingCommand === 'r') {
          // r{char} - 替换当前字符
          if (input && input.length === 1 && cursor < value.length) {
            saveToUndoStack();
            setValue(value.slice(0, cursor) + input + value.slice(cursor + 1));
            setPendingCommand('');
          }
          return;
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
        if (input === 'j' && !showCompletionList) {
          // j - 历史记录向下
          if (history.length > 0 && historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setValue(history[newIndex]);
            setCursor(Math.min(cursor, history[newIndex].length - 1));
          }
          return;
        }
        if (input === 'k' && !showCompletionList) {
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

        // Yank 操作 - y, yy
        if (input === 'y') {
          // y - 开始 yank 命令（等待第二个按键）
          setPendingCommand('y');
          return;
        }

        // Paste 操作 - p, P
        if (input === 'p') {
          // p - 在光标后粘贴
          if (yankRegister) {
            saveToUndoStack();
            const newValue = value.slice(0, cursor + 1) + yankRegister + value.slice(cursor + 1);
            setValue(newValue);
            setCursor(cursor + yankRegister.length);
          }
          return;
        }
        if (input === 'P') {
          // P - 在光标前粘贴
          if (yankRegister) {
            saveToUndoStack();
            const newValue = value.slice(0, cursor) + yankRegister + value.slice(cursor);
            setValue(newValue);
            setCursor(cursor + yankRegister.length - 1);
          }
          return;
        }

        // Replace 操作 - r
        if (input === 'r') {
          // r - 开始替换命令（等待字符）
          setPendingCommand('r');
          return;
        }

        // Change 操作 - C
        if (input === 'C') {
          // C - 修改到行尾（删除到行尾并进入插入模式）
          saveToUndoStack();
          setLastDeletedText(value.slice(cursor));
          setYankRegister(value.slice(cursor));
          setValue(value.slice(0, cursor));
          setVimNormalMode(false);
          return;
        }

        // 删除操作 - x, d, D
        if (input === 'x') {
          // x - 删除当前字符
          if (value.length > 0 && cursor < value.length) {
            saveToUndoStack();
            setLastDeletedText(value[cursor]);
            setYankRegister(value[cursor]);
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
          setYankRegister(value.slice(cursor));
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
          // IME 组合期间：先结束组合，然后继续提交（不再 return）
          if (isComposing) {
            endComposition();
          }
          if (value.trim()) {
            const trimmedValue = value.trim();
            onSubmit(trimmedValue);
            historyManager.addCommand(trimmedValue);
            setHistory(prev => [trimmedValue, ...prev.slice(0, 99)]);
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
        // 非 Vim 模式下 ESC: 检测双击触发 Rewind
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscPressTimeRef.current;
        lastEscPressTimeRef.current = now;

        if (timeSinceLastEsc < DOUBLE_PRESS_INTERVAL && onRewindRequest) {
          // 双击 ESC - 触发 Rewind
          onRewindRequest();
          return;
        }

        // 单击 ESC - 清除输入
        setValue('');
        setCursor(0);
        setHistoryIndex(-1);
        return;
      }

      if (key.return) {
        // IME 组合期间：先结束组合，然后继续提交（不再 return）
        if (isComposing) {
          endComposition();
        }
        if (value.trim()) {
          const trimmedValue = value.trim();
          onSubmit(trimmedValue);
          historyManager.addCommand(trimmedValue);
          setHistory(prev => [trimmedValue, ...prev.slice(0, 99)]);
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
      } else if (key.upArrow && !showCompletionList) {
        // 历史记录向上
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setValue(history[newIndex]);
          setCursor(history[newIndex].length);
        }
      } else if (key.downArrow && !showCompletionList) {
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

        // IME 支持：检测 CJK 字符输入
        if (input.length > 0) {
          const hasCJK = Array.from(input).some(char => isCJKChar(char));
          if (hasCJK) {
            startComposition();
            scheduleEndComposition(); // 延迟结束组合状态
          }
        }

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

  // IME 组合状态指示器
  const imeIndicator = isComposing ? '[组合中] ' : '';

  return (
    <Box flexDirection="column">
      {/* Ctrl+R 反向历史搜索界面 */}
      {reverseSearchMode && (
        <HistorySearch
          query={searchQuery}
          matches={searchMatches}
          selectedIndex={searchIndex}
          visible={reverseSearchMode}
        />
      )}

      {/* 补全建议列表 */}
      {showCompletionList && !reverseSearchMode && (
        <Box flexDirection="column" marginBottom={1}>
          {completions.map((item, index) => (
            <Box key={`${item.type}-${item.label}-${index}`}>
              <Text
                backgroundColor={index === selectedCompletionIndex ? 'gray' : undefined}
                color={index === selectedCompletionIndex ? 'white' : undefined}
              >
                <Text color={CLAUDE_COLOR} bold={index === selectedCompletionIndex}>
                  {item.label}
                </Text>
                {item.aliases && item.aliases.length > 0 && (
                  <Text dimColor> ({item.aliases.join(', ')})</Text>
                )}
                {item.description && (
                  <Text dimColor> - {item.description}</Text>
                )}
              </Text>
            </Box>
          ))}
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
        {/* IME 组合状态指示器 */}
        {imeIndicator && (
          <Text color="magenta" bold>
            {imeIndicator}
          </Text>
        )}
        <Text color="white" bold>
          {prompt}
        </Text>
        {/* 显示建议文本或实际输入 */}
        {showSuggestion ? (
          <Text dimColor>
            Try "{suggestion}"
          </Text>
        ) : !disabled && value === '' ? (
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
