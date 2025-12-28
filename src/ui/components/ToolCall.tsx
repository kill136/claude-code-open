/**
 * ToolCall 组件 - 增强版
 * 显示工具调用状态、输入、输出和差异
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { highlightCode, highlightJSON, smartHighlight } from '../utils/syntaxHighlight.js';

interface ToolCallProps {
  name: string;
  status: 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
  expanded?: boolean;
}

/**
 * 格式化 JSON 对象为可读的多行字符串（带语法高亮）
 */
function formatJSON(obj: unknown, indent: number = 2): string {
  try {
    return highlightJSON(obj, indent > 0);
  } catch {
    return String(obj);
  }
}

/**
 * 解析 diff 输出并应用颜色高亮
 */
function parseDiffLine(line: string): { text: string; color: string } {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return { text: line, color: 'gray' };
  }
  if (line.startsWith('@@')) {
    return { text: line, color: 'cyan' };
  }
  if (line.startsWith('+')) {
    return { text: line, color: 'green' };
  }
  if (line.startsWith('-')) {
    return { text: line, color: 'red' };
  }
  return { text: line, color: 'white' };
}

/**
 * 检测输出是否包含 diff
 */
function containsDiff(output: string): boolean {
  return output.includes('---') && output.includes('+++') && output.includes('@@');
}

/**
 * 提取并格式化差异预览
 */
interface DiffSection {
  type: 'header' | 'stats' | 'diff' | 'separator';
  content: string;
}

function extractDiffSections(output: string): DiffSection[] {
  const sections: DiffSection[] = [];
  const lines = output.split('\n');

  let inDiff = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测变更统计行 (e.g., "Changes: +5 -2")
    if (line.match(/^Changes:\s*\+\d+\s*-\d+/)) {
      sections.push({ type: 'stats', content: line });
      continue;
    }

    // 检测分隔线
    if (line.match(/^─+$/)) {
      sections.push({ type: 'separator', content: line });
      continue;
    }

    // 检测 diff 头部
    if (line.startsWith('---') || line.startsWith('+++')) {
      sections.push({ type: 'header', content: line });
      inDiff = true;
      continue;
    }

    // 检测 diff hunk 头
    if (line.startsWith('@@')) {
      sections.push({ type: 'header', content: line });
      inDiff = true;
      continue;
    }

    // diff 内容行
    if (inDiff && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      sections.push({ type: 'diff', content: line });
      continue;
    }

    // 其他内容
    if (line.trim()) {
      sections.push({ type: 'diff', content: line });
    }
  }

  return sections;
}

/**
 * 渲染 Diff 视图（带语法高亮）
 */
const DiffView: React.FC<{ output: string }> = ({ output }) => {
  const sections = extractDiffSections(output);

  return (
    <Box flexDirection="column" marginLeft={2}>
      {sections.map((section, idx) => {
        switch (section.type) {
          case 'stats':
            return (
              <Text key={idx} color="yellow" bold>
                {section.content}
              </Text>
            );
          case 'separator':
            return (
              <Text key={idx} color="gray" dimColor>
                {section.content}
              </Text>
            );
          case 'header':
            const parsed = parseDiffLine(section.content);
            return (
              <Text key={idx} color={parsed.color as any} bold>
                {parsed.text}
              </Text>
            );
          case 'diff':
            const diffParsed = parseDiffLine(section.content);
            return (
              <Text key={idx} color={diffParsed.color as any}>
                {diffParsed.text}
              </Text>
            );
          default:
            return <Text key={idx}>{section.content}</Text>;
        }
      })}
    </Box>
  );
};

/**
 * 格式化文件路径显示
 */
function formatFilePath(input: Record<string, unknown>): string | null {
  const filePath = input.file_path as string;
  if (filePath) {
    // 只显示文件名，如果路径太长
    const parts = filePath.split('/');
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    return filePath;
  }
  return null;
}

/**
 * 格式化工具输入参数显示
 */
const InputDisplay: React.FC<{ input: Record<string, unknown>; toolName: string }> = ({ input, toolName }) => {
  // 特殊处理某些工具的输入显示
  const formatSpecialInput = () => {
    switch (toolName) {
      case 'Edit':
      case 'MultiEdit':
        const filePath = formatFilePath(input);
        if (filePath) {
          return (
            <Box flexDirection="column">
              <Text color="gray">
                File: <Text color="cyan">{filePath}</Text>
              </Text>
              {input.old_string && (
                <Text color="gray" dimColor>
                  {String(input.old_string).length > 50
                    ? `Replacing ${String(input.old_string).length} chars...`
                    : `Replacing: "${input.old_string}"`}
                </Text>
              )}
            </Box>
          );
        }
        break;
      case 'Read':
        const readPath = formatFilePath(input);
        if (readPath) {
          return <Text color="gray">Reading: <Text color="cyan">{readPath}</Text></Text>;
        }
        break;
      case 'Write':
        const writePath = formatFilePath(input);
        if (writePath) {
          const contentLength = input.content ? String(input.content).length : 0;
          return (
            <Text color="gray">
              Writing {contentLength} chars to <Text color="cyan">{writePath}</Text>
            </Text>
          );
        }
        break;
      case 'Bash':
        if (input.command) {
          const cmd = String(input.command);
          return (
            <Text color="gray">
              $ <Text color="yellow">{cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd}</Text>
            </Text>
          );
        }
        break;
      case 'Grep':
        if (input.pattern) {
          return (
            <Text color="gray">
              Pattern: <Text color="magenta">{String(input.pattern)}</Text>
              {input.glob && <Text> in <Text color="cyan">{String(input.glob)}</Text></Text>}
            </Text>
          );
        }
        break;
      case 'Glob':
        if (input.pattern) {
          return (
            <Text color="gray">
              Pattern: <Text color="cyan">{String(input.pattern)}</Text>
            </Text>
          );
        }
        break;
    }
    return null;
  };

  const specialDisplay = formatSpecialInput();
  if (specialDisplay) {
    return specialDisplay;
  }

  // 通用的 JSON 显示（简化版）
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {keys.slice(0, 3).map((key) => {
        const value = input[key];
        const valueStr = typeof value === 'string' && value.length > 40
          ? value.substring(0, 40) + '...'
          : String(value);
        return (
          <Text key={key} color="gray" dimColor>
            {key}: {valueStr}
          </Text>
        );
      })}
      {keys.length > 3 && <Text color="gray" dimColor>... and {keys.length - 3} more</Text>}
    </Box>
  );
};

/**
 * 格式化输出内容（带智能语法高亮）
 */
const OutputDisplay: React.FC<{ output: string; expanded: boolean; onToggle: () => void }> = ({
  output,
  expanded,
  onToggle
}) => {
  const hasDiff = containsDiff(output);
  const lines = output.split('\n');
  const isTruncated = lines.length > 20;

  // 如果是 diff，使用特殊渲染
  if (hasDiff) {
    return <DiffView output={output} />;
  }

  // 检测是否为代码（JSON、XML、HTML 等）
  const isCode = React.useMemo(() => {
    const trimmed = output.trim();
    return (
      // JSON
      ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
       (trimmed.endsWith('}') || trimmed.endsWith(']'))) ||
      // XML/HTML
      trimmed.startsWith('<') ||
      // 代码特征
      /^(import|export|function|class|def|package|fn|const|let|var)\s+/m.test(output)
    );
  }, [output]);

  // 如果是代码，使用智能高亮
  const displayContent = React.useMemo(() => {
    if (isCode) {
      return smartHighlight(output);
    }
    return output;
  }, [output, isCode]);

  const displayLines = (isCode ? displayContent : output).split('\n');
  const linesToShow = expanded ? displayLines : displayLines.slice(0, 10);

  return (
    <Box flexDirection="column" marginLeft={2}>
      {linesToShow.map((line, idx) => (
        <Text key={idx} color={isCode ? undefined : "gray"} dimColor={!isCode}>
          {line.length > 120 ? line.substring(0, 120) + '...' : line}
        </Text>
      ))}
      {isTruncated && !expanded && (
        <Text color="blue" dimColor>
          ... {displayLines.length - 10} more lines (press Enter to expand)
        </Text>
      )}
    </Box>
  );
};

/**
 * 错误显示
 */
const ErrorDisplay: React.FC<{ error: string }> = ({ error }) => {
  const lines = error.split('\n');

  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, idx) => (
        <Text key={idx} color="red">
          {line}
        </Text>
      ))}
    </Box>
  );
};

/**
 * 主 ToolCall 组件
 */
export const ToolCall: React.FC<ToolCallProps> = ({
  name,
  status,
  input,
  result,
  error,
  duration,
  expanded: initialExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // 格式化执行时间
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Box flexDirection="column" marginLeft={1} marginY={0}>
      {/* 工具名称和状态行 */}
      <Box>
        {getStatusIcon()}
        <Text> </Text>
        <Text color={getStatusColor()} bold>
          {name}
        </Text>
        {duration !== undefined && status !== 'running' && (
          <Text color="gray" dimColor> ({formatDuration(duration)})</Text>
        )}
        {status === 'running' && (
          <Text color="cyan" dimColor> running...</Text>
        )}
      </Box>

      {/* 输入参数显示 */}
      {input && Object.keys(input).length > 0 && (
        <Box marginLeft={2} marginTop={0}>
          <InputDisplay input={input} toolName={name} />
        </Box>
      )}

      {/* 输出结果显示 */}
      {result && status !== 'running' && (
        <Box marginTop={0}>
          <OutputDisplay
            output={result}
            expanded={isExpanded}
            onToggle={toggleExpanded}
          />
        </Box>
      )}

      {/* 错误信息显示 */}
      {error && status === 'error' && (
        <Box marginTop={0}>
          <ErrorDisplay error={error} />
        </Box>
      )}

      {/* 分隔线（仅在有内容时显示） */}
      {(result || error) && status !== 'running' && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>{'─'.repeat(60)}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ToolCall;
