/**
 * Message 组件
 * 显示用户或助手消息，支持流式渲染、Markdown、代码高亮等
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ContentBlock, ToolUseBlock, ToolResultBlockParam, AnyContentBlock } from '../../types/messages.js';
import { parseMarkdown, renderBlock, type MarkdownBlock } from '../markdown-renderer.js';

export interface MessageProps {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string | AnyContentBlock[];
  timestamp?: Date;
  streaming?: boolean; // 是否启用流式渲染
  streamSpeed?: number; // 流式渲染速度（ms/字符）
  showCopyHint?: boolean; // 显示复制提示
  model?: string; // 使用的模型
  onComplete?: () => void; // 流式渲染完成回调
}

// 渲染 Markdown 块组件
const MarkdownBlockComponent: React.FC<{ block: MarkdownBlock }> = ({ block }) => {
  const rendered = renderBlock(block);

  // 渲染的内容已经包含 ANSI 颜色代码，直接显示
  return (
    <Text>
      {rendered}
    </Text>
  );
};

// 工具调用块组件
const ToolUseBlockComponent: React.FC<{ block: ToolUseBlock }> = ({ block }) => {
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
const ToolResultBlockComponent: React.FC<{ block: ToolResultBlockParam }> = ({ block }) => {
  const contentStr = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
  const isError = block.is_error || contentStr?.toLowerCase().includes('error');
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        <Text color={isError ? 'red' : 'green'}>
          {isError ? '✗' : '✓'} Tool Result
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray" dimColor>
          {contentStr ? contentStr.slice(0, 200) : ''}
          {contentStr && contentStr.length > 200 ? '...' : ''}
        </Text>
      </Box>
    </Box>
  );
};

// 渲染内容块
const renderContentBlocks = (blocks: AnyContentBlock[]) => {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'text':
        return <Text key={index}>{(block as { text?: string }).text || ''}</Text>;
      case 'tool_use':
        return <ToolUseBlockComponent key={index} block={block as ToolUseBlock} />;
      case 'tool_result':
        return <ToolResultBlockComponent key={index} block={block as ToolResultBlockParam} />;
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

  // 渲染角色标签 - 官方风格
  const getRoleLabel = () => {
    if (isUser) return 'You';
    if (isSystem) return 'System';
    if (isError) return 'Error';
    return 'Claude';
  };

  const getRoleColor = () => {
    if (isUser) return 'blue';
    if (isSystem) return 'cyan';
    if (isError) return 'red';
    return 'green';
  };

  // 获取时间字符串
  const getTimeString = () => {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
              {' '}{getTimeString()}
            </Text>
          )}
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {renderContentBlocks(content)}
        </Box>
      </Box>
    );
  }

  // 用户消息 - 简洁样式
  if (isUser) {
    return (
      <Box flexDirection="column" marginY={0}>
        <Box>
          <Text bold color="blue">You</Text>
          {timestamp && (
            <Text color="gray" dimColor> {getTimeString()}</Text>
          )}
        </Box>
        <Box marginLeft={2}>
          <Text>{displayedContent}</Text>
        </Box>
      </Box>
    );
  }

  // 解析 Markdown 内容
  const blocks = parseMarkdown(displayedContent);

  // 助手消息 - 使用增强的 Markdown 渲染
  return (
    <Box flexDirection="column" marginY={1}>
      {/* 消息头部 */}
      <Box>
        <Text bold color="green">
          {getRoleLabel()}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor> {getTimeString()}</Text>
        )}
        {isStreaming && (
          <Text color="gray" dimColor> ⋯</Text>
        )}
      </Box>

      {/* 消息内容 - 使用增强的 Markdown 渲染 */}
      <Box flexDirection="column">
        {blocks.map((block, index) => (
          <MarkdownBlockComponent key={index} block={block} />
        ))}
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
