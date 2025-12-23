/**
 * 主应用组件
 * 使用 Ink 渲染 CLI 界面
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './components/Header.js';
import { Message } from './components/Message.js';
import { Input } from './components/Input.js';
import { ToolCall } from './components/ToolCall.js';
import { TodoList } from './components/TodoList.js';
import { StatusBar } from './components/StatusBar.js';
import { Spinner } from './components/Spinner.js';
import { ConversationLoop } from '../core/loop.js';
import type { TodoItem } from '../types/index.js';

const VERSION = '2.0.76-restored';

interface AppProps {
  model: string;
  initialPrompt?: string;
  verbose?: boolean;
  systemPrompt?: string;
}

interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ToolCallItem {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  result?: string;
  duration?: number;
}

export const App: React.FC<AppProps> = ({
  model,
  initialPrompt,
  verbose,
  systemPrompt,
}) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [stats, setStats] = useState({ messageCount: 0, duration: 0 });

  // 模型映射
  const modelMap: Record<string, string> = {
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-opus-4-20250514',
    haiku: 'claude-haiku-3-5-20241022',
  };

  const [loop] = useState(
    () =>
      new ConversationLoop({
        model: modelMap[model] || model,
        verbose,
        systemPrompt,
      })
  );

  // 处理退出
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  // 处理消息
  const handleSubmit = useCallback(
    async (input: string) => {
      // 斜杠命令
      if (input.startsWith('/')) {
        handleSlashCommand(input);
        return;
      }

      // 添加用户消息
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input, timestamp: new Date() },
      ]);

      setIsProcessing(true);
      setCurrentResponse('');
      setToolCalls([]);

      const startTime = Date.now();

      try {
        for await (const event of loop.processMessageStream(input)) {
          if (event.type === 'text') {
            setCurrentResponse((prev) => prev + (event.content || ''));
          } else if (event.type === 'tool_start') {
            const id = `tool_${Date.now()}`;
            setToolCalls((prev) => [
              ...prev,
              { id, name: event.toolName || '', status: 'running' },
            ]);
          } else if (event.type === 'tool_end') {
            setToolCalls((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last) {
                last.status = event.toolResult?.startsWith('Error')
                  ? 'error'
                  : 'success';
                last.result = event.toolResult;
                last.duration = Date.now() - startTime;
              }
              return updated;
            });
          } else if (event.type === 'done') {
            // 完成
          }
        }

        // 添加助手消息
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: currentResponse,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${err}`,
            timestamp: new Date(),
          },
        ]);
      }

      setIsProcessing(false);
      setStats((prev) => ({
        messageCount: prev.messageCount + 2,
        duration: Date.now() - startTime,
      }));
    },
    [loop, currentResponse]
  );

  // 斜杠命令处理
  const handleSlashCommand = (input: string) => {
    const [cmd, ...args] = input.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'exit':
      case 'quit':
        exit();
        break;

      case 'clear':
        setMessages([]);
        setToolCalls([]);
        loop.getSession().clearMessages();
        break;

      case 'help':
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Available commands:
/help - Show this help
/clear - Clear conversation
/exit - Exit Claude Code
/stats - Show statistics`,
            timestamp: new Date(),
          },
        ]);
        break;

      case 'stats':
        const sessionStats = loop.getSession().getStats();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Session Statistics:
Messages: ${sessionStats.messageCount}
Duration: ${Math.round(sessionStats.duration / 1000)}s
Cost: ${sessionStats.totalCost}`,
            timestamp: new Date(),
          },
        ]);
        break;

      default:
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Unknown command: /${cmd}`,
            timestamp: new Date(),
          },
        ]);
    }
  };

  // 初始 prompt
  useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Header version={VERSION} model={model} cwd={process.cwd()} />

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {messages.map((msg, i) => (
          <Message
            key={i}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}

        {/* 当前响应 */}
        {isProcessing && currentResponse && (
          <Message
            role="assistant"
            content={currentResponse}
            timestamp={new Date()}
          />
        )}

        {/* 工具调用 */}
        {toolCalls.length > 0 && (
          <Box flexDirection="column" marginY={1}>
            {toolCalls.map((tool) => (
              <ToolCall
                key={tool.id}
                name={tool.name}
                status={tool.status}
                result={tool.result}
                duration={tool.duration}
              />
            ))}
          </Box>
        )}

        {/* 加载中 */}
        {isProcessing && !currentResponse && (
          <Box marginLeft={2}>
            <Spinner label="Thinking..." />
          </Box>
        )}
      </Box>

      {/* Todo List */}
      {todos.length > 0 && <TodoList todos={todos} />}

      {/* Input */}
      <Input onSubmit={handleSubmit} disabled={isProcessing} />

      {/* Status Bar */}
      <StatusBar
        messageCount={stats.messageCount}
        duration={stats.duration}
        isProcessing={isProcessing}
      />
    </Box>
  );
};

export default App;
