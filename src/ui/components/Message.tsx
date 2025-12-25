/**
 * Message 组件
 * 显示用户或助手消息，支持流式渲染、Markdown、代码高亮等
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ContentBlock } from '../../types/index.js';

export interface MessageProps {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string | ContentBlock[];
  timestamp?: Date;
  streaming?: boolean; // 是否启用流式渲染
  streamSpeed?: number; // 流式渲染速度（ms/字符）
  showCopyHint?: boolean; // 显示复制提示
  model?: string; // 使用的模型
  onComplete?: () => void; // 流式渲染完成回调
}

// 解析 Markdown 为纯文本（移除语法标记，保留结构）
function parseMarkdownForTerminal(markdown: string): {
  type: 'text' | 'code' | 'heading' | 'list';
  content: string;
  language?: string;
  level?: number;
}[] {
  const blocks: {
    type: 'text' | 'code' | 'heading' | 'list';
    content: string;
    language?: string;
    level?: number;
  }[] = [];

  // 解析代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    // 添加代码块之前的文本
    if (match.index > lastIndex) {
      const text = markdown.slice(lastIndex, match.index).trim();
      if (text) {
        blocks.push(...parseTextBlocks(text));
      }
    }

    // 添加代码块
    blocks.push({
      type: 'code',
      content: match[2],
      language: match[1] || 'text',
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < markdown.length) {
    const text = markdown.slice(lastIndex).trim();
    if (text) {
      blocks.push(...parseTextBlocks(text));
    }
  }

  return blocks;
}

// 解析文本块（标题、列表等）
function parseTextBlocks(text: string): {
  type: 'text' | 'heading' | 'list';
  content: string;
  level?: number;
}[] {
  const blocks: {
    type: 'text' | 'heading' | 'list';
    content: string;
    level?: number;
  }[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length,
      });
      continue;
    }

    // 列表项
    const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (listMatch) {
      blocks.push({
        type: 'list',
        content: listMatch[1],
      });
      continue;
    }

    // 普通文本
    if (line.trim()) {
      blocks.push({
        type: 'text',
        content: line,
      });
    }
  }

  return blocks;
}

// 代码块组件
const CodeBlock: React.FC<{ content: string; language?: string }> = ({
  content,
  language,
}) => {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {language && (
        <Box marginBottom={0}>
          <Text color="cyan" dimColor>
            {language}
          </Text>
        </Box>
      )}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        flexDirection="column"
      >
        {content.split('\n').map((line, i) => (
          <Text key={i} color="yellow">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

// 工具调用块组件
const ToolUseBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        <Text color="magenta" bold>
          🔧 {block.name}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray" dimColor>
          {JSON.stringify(block.input, null, 2).slice(0, 200)}
          {JSON.stringify(block.input).length > 200 ? '...' : ''}
        </Text>
      </Box>
    </Box>
  );
};

// 工具结果块组件
const ToolResultBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
  const isError = block.content?.toString().toLowerCase().includes('error');
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        <Text color={isError ? 'red' : 'green'}>
          {isError ? '✗' : '✓'} Tool Result
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray" dimColor>
          {typeof block.content === 'string'
            ? block.content.slice(0, 200)
            : JSON.stringify(block.content, null, 2).slice(0, 200)}
          {(typeof block.content === 'string' ? block.content : JSON.stringify(block.content))
            .length > 200
            ? '...'
            : ''}
        </Text>
      </Box>
    </Box>
  );
};

// 渲染内容块
const renderContentBlocks = (blocks: ContentBlock[]) => {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'text':
        return <Text key={index}>{block.text || ''}</Text>;
      case 'tool_use':
        return <ToolUseBlock key={index} block={block} />;
      case 'tool_result':
        return <ToolResultBlock key={index} block={block} />;
      default:
        return null;
    }
  });
};

export const Message: React.FC<MessageProps> = ({
  role,
  content,
  timestamp,
  streaming = false,
  streamSpeed = 20,
  showCopyHint = false,
  model,
  onComplete,
}) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const isError = role === 'error';

  // 流式渲染状态
  const [displayedContent, setDisplayedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(streaming);

  // 获取纯文本内容
  const getTextContent = (): string => {
    if (typeof content === 'string') {
      return content;
    }
    // 从 ContentBlock 数组中提取文本
    return content
      .map(block => {
        if (block.type === 'text') return block.text || '';
        return '';
      })
      .join('\n');
  };

  // 流式渲染效果
  useEffect(() => {
    if (!streaming || typeof content !== 'string') {
      setDisplayedContent(getTextContent());
      setIsStreaming(false);
      return;
    }

    let currentIndex = 0;
    const textContent = content;

    const interval = setInterval(() => {
      if (currentIndex < textContent.length) {
        // 每次增加1-3个字符（模拟自然打字）
        const increment = Math.min(
          Math.floor(Math.random() * 3) + 1,
          textContent.length - currentIndex
        );
        currentIndex += increment;
        setDisplayedContent(textContent.slice(0, currentIndex));
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        onComplete?.();
      }
    }, streamSpeed);

    return () => clearInterval(interval);
  }, [content, streaming, streamSpeed, onComplete]);

  // 渲染角色标签
  const getRoleLabel = () => {
    if (isUser) return 'You';
    if (isSystem) return 'System';
    if (isError) return 'Error';
    return model ? `Claude (${model})` : 'Claude';
  };

  const getRoleColor = () => {
    if (isUser) return 'blue';
    if (isSystem) return 'cyan';
    if (isError) return 'red';
    return 'green';
  };

  // 如果内容是 ContentBlock 数组，直接渲染
  if (typeof content !== 'string') {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text bold color={getRoleColor()}>
            {getRoleLabel()}
          </Text>
          {timestamp && (
            <Text color="gray" dimColor>
              {' '}
              {timestamp.toLocaleTimeString()}
            </Text>
          )}
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {renderContentBlocks(content)}
        </Box>
      </Box>
    );
  }

  // 解析 Markdown 内容
  const blocks = parseMarkdownForTerminal(displayedContent);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 消息头部 */}
      <Box>
        <Text bold color={getRoleColor()}>
          {getRoleLabel()}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor>
            {' '}
            {timestamp.toLocaleTimeString()}
          </Text>
        )}
        {isStreaming && (
          <Text color="gray" dimColor>
            {' '}
            ⋯
          </Text>
        )}
      </Box>

      {/* 消息内容 */}
      <Box flexDirection="column" marginLeft={2}>
        {blocks.map((block, index) => {
          switch (block.type) {
            case 'code':
              return (
                <CodeBlock
                  key={index}
                  content={block.content}
                  language={block.language}
                />
              );
            case 'heading':
              return (
                <Box key={index} marginTop={1} marginBottom={0}>
                  <Text
                    bold
                    color="cyan"
                    underline={block.level === 1}
                  >
                    {block.content}
                  </Text>
                </Box>
              );
            case 'list':
              return (
                <Box key={index}>
                  <Text color="yellow">• </Text>
                  <Text>{block.content}</Text>
                </Box>
              );
            case 'text':
              return (
                <Box key={index}>
                  <Text color={isError ? 'red' : undefined}>
                    {block.content}
                  </Text>
                </Box>
              );
            default:
              return null;
          }
        })}
      </Box>

      {/* 复制提示 */}
      {showCopyHint && !isStreaming && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="gray" dimColor italic>
            Press Cmd+A to select and copy
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default Message;
