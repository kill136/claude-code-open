/**
 * 主应用组件
 * 使用 Ink 渲染 CLI 界面 - 仿官方 Claude Code
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './components/Header.js';
import { Message } from './components/Message.js';
import { Input } from './components/Input.js';
import { ToolCall } from './components/ToolCall.js';
import { TodoList } from './components/TodoList.js';
import { Spinner } from './components/Spinner.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { ShortcutHelp } from './components/ShortcutHelp.js';
import { LoginSelector, type LoginMethod } from './LoginSelector.js';
import { ConversationLoop } from '../core/loop.js';
import { initializeCommands, executeCommand } from '../commands/index.js';
import { isPlanModeActive } from '../tools/planmode.js';
import { updateManager } from '../updater/index.js';
import { useGlobalKeybindings } from './hooks/useGlobalKeybindings.js';
import { configManager } from '../config/index.js';
import { startOAuthLogin } from '../auth/index.js';
import { thinkingManager } from '../models/thinking.js';
import type { TodoItem } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  createBackgroundTask,
  appendTaskText,
  addTaskToolCall,
  completeTask,
  isTaskCancelled,
  getTaskSummaries,
  type TaskSummary,
} from '../core/backgroundTasks.js';
import { BackgroundTasksPanel } from './components/BackgroundTasksPanel.js';
const VERSION = '2.0.76-restored';

interface AppProps {
  model: string;
  initialPrompt?: string;
  verbose?: boolean;
  systemPrompt?: string;
  username?: string;
  apiType?: string;
  organization?: string;
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
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
}

interface RecentActivity {
  id: string;
  description: string;
  timestamp: string;
}

/**
 * 流式渲染块 - 用于按时间顺序交织显示文本和工具调用
 * Stream block - Used to interleave text and tool calls in chronological order
 */
interface StreamBlock {
  type: 'text' | 'tool';
  id: string;
  timestamp: Date;

  // 文本块字段 (type === 'text')
  text?: string;
  isStreaming?: boolean;

  // 工具块字段 (type === 'tool')
  tool?: {
    name: string;
    status: 'running' | 'success' | 'error';
    input?: Record<string, unknown>;
    result?: string;
    error?: string;
    duration?: number;
  };
}

// 默认建议提示
const DEFAULT_SUGGESTIONS = [
  'how do I log an error?',
  'explain this codebase',
  'find all TODO comments',
  'what does this function do?',
  'help me fix this bug',
];

export const App: React.FC<AppProps> = ({
  model,
  initialPrompt,
  verbose,
  systemPrompt,
  username,
  apiType = 'Claude API',
  organization,
}) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');

  // 新增：流式块数组，用于按时间顺序交织显示文本和工具
  const [streamBlocks, setStreamBlocks] = useState<StreamBlock[]>([]);
  const [activeTextBlockId, setActiveTextBlockId] = useState<string | null>(null);

  const [showWelcome, setShowWelcome] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [currentSuggestion] = useState(
    () => DEFAULT_SUGGESTIONS[Math.floor(Math.random() * DEFAULT_SUGGESTIONS.length)]
  );

  // Header 增强状态
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('connected');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | undefined>();
  const [planMode, setPlanMode] = useState(false);
  const [showVerbose, setShowVerbose] = useState(verbose || false);
  const [showTodosPanel, setShowTodosPanel] = useState(false);
  const [stashedPrompt, setStashedPrompt] = useState<string>('');
  const [thinkingEnabled, setThinkingEnabled] = useState(thinkingManager.isEnabled());

  // 后台任务相关状态
  const [backgroundTasks, setBackgroundTasks] = useState<TaskSummary[]>([]);
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false);
  const [currentBackgroundTaskId, setCurrentBackgroundTaskId] = useState<string | null>(null);
  const [shouldMoveToBackground, setShouldMoveToBackground] = useState(false);

  // 登录屏幕状态
  const [showLoginScreen, setShowLoginScreen] = useState(false);
  const [loginPreselect, setLoginPreselect] = useState<'claudeai' | 'console' | null>(null);

  // 会话 ID
  const sessionId = useRef(uuidv4());

  // 当前输入值的 ref（用于全局快捷键访问）
  const currentInputRef = useRef<string>('');

  // 模型映射
  const modelMap: Record<string, string> = {
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-opus-4-20250514',
    haiku: 'claude-haiku-3-5-20241022',
  };

  const modelDisplayName: Record<string, string> = {
    sonnet: 'Sonnet 4',
    opus: 'Opus 4',
    haiku: 'Haiku 3.5',
    'claude-sonnet-4-20250514': 'Sonnet 4',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-haiku-3-5-20241022': 'Haiku 3.5',
  };

  // 模型切换顺序
  const modelCycle = ['opus', 'sonnet', 'haiku'];

  // 当前模型状态（用于显示和切换）
  const [currentModel, setCurrentModel] = useState(model);

  const [loop] = useState(
    () =>
      new ConversationLoop({
        model: modelMap[model] || model,
        verbose,
        systemPrompt,
      })
  );

  // 初始化命令系统
  useEffect(() => {
    initializeCommands();
  }, []);

  // 监听更新通知
  useEffect(() => {
    const handleUpdateAvailable = (info: { currentVersion: string; latestVersion: string }) => {
      setHasUpdate(true);
      setLatestVersion(info.latestVersion);
    };

    const handleUpdateNotAvailable = () => {
      setHasUpdate(false);
      setLatestVersion(undefined);
    };

    updateManager.on('update-available', handleUpdateAvailable);
    updateManager.on('update-not-available', handleUpdateNotAvailable);

    // 静默检查更新（不影响 UI）
    updateManager.checkForUpdates().catch(() => {});

    return () => {
      updateManager.off('update-available', handleUpdateAvailable);
      updateManager.off('update-not-available', handleUpdateNotAvailable);
    };
  }, []);

  // 监听 Plan Mode 状态变化（轮询）
  useEffect(() => {
    const checkPlanMode = () => {
      setPlanMode(isPlanModeActive());
    };

    // 初始检查
    checkPlanMode();

    // 每秒检查一次
    const interval = setInterval(checkPlanMode, 1000);

    return () => clearInterval(interval);
  }, []);

  // 全局快捷键
  const config = configManager.getAll();
  useGlobalKeybindings({
    config,
    onVerboseToggle: () => {
      setShowVerbose((v) => !v);
      addActivity(`Verbose mode ${!showVerbose ? 'enabled' : 'disabled'}`);
    },
    onTodosToggle: () => {
      setShowTodosPanel((v) => !v);
      addActivity(`Todos panel ${!showTodosPanel ? 'shown' : 'hidden'}`);
    },
    onModelSwitch: () => {
      // 循环切换模型：opus → sonnet → haiku → opus
      const currentIndex = modelCycle.indexOf(currentModel);
      const nextIndex = (currentIndex + 1) % modelCycle.length;
      const nextModel = modelCycle[nextIndex];

      // 更新 ConversationLoop 中的模型
      loop.setModel(nextModel);

      // 更新本地状态
      setCurrentModel(nextModel);

      // 记录活动和显示消息
      const displayName = modelDisplayName[nextModel] || nextModel;
      addActivity(`Switched to ${displayName}`);
      addMessage('assistant', `✨ Switched to ${displayName}\n\nThe next message will use this model.`);
    },
    onStashPrompt: (prompt) => {
      setStashedPrompt(prompt);
      if (prompt) {
        addActivity(`Stashed prompt: ${prompt.slice(0, 30)}...`);
        addMessage('assistant', `Prompt stashed: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"\n\nYou can reference this later.`);
      }
    },
    onUndo: () => {
      addActivity('Undo requested');
      // Note: Undo is handled within Input component for Vim mode
    },
    onThinkingToggle: () => {
      const newState = !thinkingEnabled;
      if (newState) {
        thinkingManager.enable();
        setThinkingEnabled(true);
        addActivity('Extended thinking enabled');
        addMessage('assistant', '🧠 Extended thinking enabled\n\nClaude will now use extended thinking for complex reasoning tasks.');
      } else {
        thinkingManager.disable();
        setThinkingEnabled(false);
        addActivity('Extended thinking disabled');
        addMessage('assistant', '💤 Extended thinking disabled\n\nClaude will respond without extended thinking.');
      }
    },
    onBackgroundTask: () => {
      if (isProcessing) {
        // 如果有任务正在运行，设置标志将其转到后台
        setShouldMoveToBackground(true);
        addActivity('Moving current task to background...');
      } else {
        // 如果没有正在运行的任务，切换后台面板显示
        setShowBackgroundPanel((v) => !v);
        // 更新后台任务列表
        setBackgroundTasks(getTaskSummaries());
      }
    },
    getCurrentInput: () => currentInputRef.current,
    disabled: false, // 不禁用，即使在处理中也允许 Ctrl+B
  });

  // 处理键盘输入
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    // ? 显示快捷键帮助
    if (input === '?' && !isProcessing) {
      setShowShortcuts((prev) => !prev);
    }
    // Escape 关闭弹窗
    if (key.escape) {
      if (showShortcuts) setShowShortcuts(false);
      if (showWelcome) setShowWelcome(false);
    }
  });

  // 添加活动记录
  const addActivity = useCallback((description: string) => {
    setRecentActivity((prev) => [
      {
        id: Date.now().toString(),
        description,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 9), // 保留最近10条
    ]);
  }, []);

  // 添加消息的辅助函数
  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [
      ...prev,
      { role, content, timestamp: new Date() },
    ]);
  }, []);

  // 处理登录方法选择
  const handleLoginSelect = useCallback(async (method: LoginMethod) => {
    setShowLoginScreen(false);
    setLoginPreselect(null);

    if (method === 'exit') {
      addActivity('Login cancelled');
      return;
    }

    const isClaudeAi = method === 'claudeai';
    addActivity(`Starting ${isClaudeAi ? 'Claude.ai' : 'Console'} OAuth login...`);
    addMessage('assistant', `Starting OAuth login with ${isClaudeAi ? 'Claude.ai subscription' : 'Anthropic Console'}...\n\nPlease follow the instructions in the terminal.`);

    try {
      // 启动 OAuth 流程 - 转换类型名称
      const accountType = isClaudeAi ? 'claude.ai' : 'console';
      const result = await startOAuthLogin({
        accountType: accountType as 'claude.ai' | 'console',
        useDeviceFlow: false,
      });

      if (result && result.accessToken) {
        // 重新初始化客户端以使用新的凭据
        const reinitSuccess = loop.reinitializeClient();
        if (reinitSuccess) {
          addMessage('assistant', `✅ Login successful!\n\nYou are now authenticated with ${isClaudeAi ? 'Claude.ai' : 'Anthropic Console'}.\n\nClient has been reinitialized with new credentials. You can now start chatting!`);
          addActivity('OAuth login completed and client reinitialized');
        } else {
          addMessage('assistant', `✅ Login successful!\n\nYou are now authenticated with ${isClaudeAi ? 'Claude.ai' : 'Anthropic Console'}.\n\n⚠️ Note: Could not reinitialize client. Please restart the application.`);
          addActivity('OAuth login completed but client reinitialization failed');
        }
      }
    } catch (error) {
      addMessage('assistant', `❌ Login failed: ${error instanceof Error ? error.message : String(error)}\n\nPlease try again or use /login --api-key to set up an API key.`);
      addActivity('OAuth login failed');
    }
  }, [addActivity, addMessage, loop]);

  // 处理斜杠命令
  const handleSlashCommand = useCallback(async (input: string): Promise<boolean> => {
    const session = loop.getSession();
    const stats = session.getStats();

    const commandContext = {
      session: {
        id: sessionId.current,
        messageCount: stats.messageCount,
        duration: stats.duration,
        totalCost: stats.totalCost,
        clearMessages: () => {
          setMessages([]);
          setToolCalls([]);
          session.clearMessages();
        },
        getStats: () => stats,
      },
      config: {
        model: modelMap[model] || model,
        modelDisplayName: modelDisplayName[model] || model,
        apiType,
        organization,
        username,
        cwd: process.cwd(),
        version: VERSION,
      },
      ui: {
        addMessage,
        addActivity,
        setShowWelcome,
        setShowLoginScreen,
        setLoginPreselect,
        exit,
      },
    };

    try {
      const result = await executeCommand(input, commandContext);

      if (result.action === 'exit') {
        exit();
      } else if (result.action === 'clear') {
        // 清除已在命令中处理
      } else if (result.action === 'login') {
        // 显示登录屏幕
        setShowLoginScreen(true);
      } else if (result.action === 'logout') {
        // 登出后延迟退出程序（与官方行为一致）
        setTimeout(() => {
          process.exit(0);
        }, 200);
      } else if (result.action === 'reinitClient') {
        // 重新初始化客户端（登录成功后）
        const reinitSuccess = loop.reinitializeClient();
        if (reinitSuccess) {
          addMessage('assistant', '\n✅ Client reinitialized with new credentials. You can now start chatting!');
          addActivity('Client reinitialized');
        } else {
          addMessage('assistant', '\n⚠️ Could not reinitialize client. Please restart the application.');
          addActivity('Client reinitialization failed');
        }
      }

      return result.success;
    } catch (error) {
      addMessage('assistant', `Command error: ${error}`);
      return false;
    }
  }, [loop, model, apiType, organization, username, addMessage, addActivity, exit, setShowLoginScreen, setLoginPreselect]);

  // 处理消息
  const handleSubmit = useCallback(
    async (input: string) => {
      // 隐藏欢迎屏幕
      if (showWelcome) setShowWelcome(false);

      // 斜杠命令
      if (input.startsWith('/')) {
        await handleSlashCommand(input);
        return;
      }

      // 添加用户消息
      addMessage('user', input);

      setIsProcessing(true);
      setCurrentResponse('');
      setToolCalls([]);

      // 立即清空流式块和活动块ID（关键修复）
      setStreamBlocks([]);
      setActiveTextBlockId(null);
      setConnectionStatus('connecting');

      const startTime = Date.now();
      // 使用局部变量累积响应，避免闭包陷阱
      let accumulatedResponse = '';
      // 局部变量跟踪当前活动的文本块ID
      let localActiveTextBlockId: string | null = null;

      try {
        for await (const event of loop.processMessageStream(input)) {
          // 检查是否需要将任务移到后台
          if (shouldMoveToBackground) {
            setShouldMoveToBackground(false);

            // 创建后台任务
            const bgTask = createBackgroundTask(input);
            setCurrentBackgroundTaskId(bgTask.id);

            // 添加消息提示用户任务已转到后台
            addMessage('assistant', `⏳ Task moved to background (ID: ${bgTask.id.substring(0, 8)})\n\nYou can continue with other tasks. Use /tasks to check status.`);

            // 重置 UI 状态
            setIsProcessing(false);
            setCurrentResponse('');
            setStreamBlocks([]);
            setActiveTextBlockId(null);
            setConnectionStatus('connected');

            // 在后台继续处理流
            (async () => {
              try {
                let bgAccumulatedResponse = accumulatedResponse;

                // 继续处理剩余的事件
                for await (const bgEvent of loop.processMessageStream(input)) {
                  // 检查任务是否被取消
                  if (isTaskCancelled(bgTask.id)) {
                    break;
                  }

                  if (bgEvent.type === 'text') {
                    bgAccumulatedResponse += (bgEvent.content || '');
                    appendTaskText(bgTask.id, bgEvent.content || '');
                  } else if (bgEvent.type === 'tool_start') {
                    addTaskToolCall(
                      bgTask.id,
                      bgEvent.toolName || '',
                      bgEvent.toolInput
                    );
                  } else if (bgEvent.type === 'tool_end') {
                    addTaskToolCall(
                      bgTask.id,
                      bgEvent.toolName || '',
                      bgEvent.toolInput,
                      bgEvent.toolResult,
                      bgEvent.toolError
                    );
                  }
                }

                // 标记任务完成
                completeTask(bgTask.id, true);

                // 更新后台任务列表
                setBackgroundTasks(getTaskSummaries());
              } catch (err) {
                completeTask(bgTask.id, false, String(err));
                setBackgroundTasks(getTaskSummaries());
              }
            })();

            // 立即返回，不继续处理当前循环
            return;
          }

          // 调试：记录收到的事件
          if (verbose) {
            console.log('[App] Event:', event.type, event.content?.slice(0, 50));
          }

          if (event.type === 'text') {
            accumulatedResponse += (event.content || '');
            setCurrentResponse(accumulatedResponse);

            // 新增：追加或创建文本块
            setStreamBlocks((prev) => {
              if (localActiveTextBlockId) {
                // 更新现有文本块
                return prev.map(block =>
                  block.id === localActiveTextBlockId && block.type === 'text'
                    ? { ...block, text: (block.text || '') + (event.content || '') }
                    : block
                );
              } else {
                // 创建新文本块
                const newId = `text-${Date.now()}-${Math.random()}`;
                localActiveTextBlockId = newId;
                setActiveTextBlockId(newId);
                return [...prev, {
                  type: 'text' as const,
                  id: newId,
                  timestamp: new Date(),
                  text: event.content || '',
                  isStreaming: true,
                }];
              }
            });
          } else if (event.type === 'tool_start') {
            // 关闭当前文本块
            if (localActiveTextBlockId) {
              setStreamBlocks(prev => prev.map(block =>
                block.id === localActiveTextBlockId
                  ? { ...block, isStreaming: false }
                  : block
              ));
              localActiveTextBlockId = null;
              setActiveTextBlockId(null);
            }

            // 添加新工具块
            const id = `tool-${Date.now()}-${Math.random()}`;
            setStreamBlocks(prev => [...prev, {
              type: 'tool' as const,
              id,
              timestamp: new Date(),
              tool: {
                name: event.toolName || '',
                status: 'running' as const,
                input: event.toolInput as Record<string, unknown>,
              },
            }]);

            // 保持旧的toolCalls同步（兼容性）
            setToolCalls((prev) => [
              ...prev,
              {
                id,
                name: event.toolName || '',
                status: 'running',
                input: event.toolInput as Record<string, unknown>,
              },
            ]);
            addActivity(`Using tool: ${event.toolName}`);
          } else if (event.type === 'tool_end') {
            // 更新最后一个运行中的工具块
            setStreamBlocks(prev => {
              const blocks = [...prev];
              for (let i = blocks.length - 1; i >= 0; i--) {
                if (blocks[i].type === 'tool' && blocks[i].tool?.status === 'running') {
                  const isError = event.toolResult?.startsWith('Error') || event.toolError;
                  blocks[i] = {
                    ...blocks[i],
                    tool: {
                      ...blocks[i].tool!,
                      status: isError ? 'error' as const : 'success' as const,
                      result: event.toolResult,
                      error: isError ? (event.toolError || event.toolResult) : undefined,
                      duration: Date.now() - blocks[i].timestamp.getTime(),
                    },
                  };
                  break;
                }
              }
              return blocks;
            });

            // 保持旧的toolCalls同步（兼容性）
            setToolCalls((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last) {
                const isError = event.toolResult?.startsWith('Error') || event.toolError;
                last.status = isError ? 'error' : 'success';
                last.result = isError ? undefined : event.toolResult;
                last.error = isError ? (event.toolError || event.toolResult) : undefined;
                last.duration = Date.now() - startTime;
              }
              return updated;
            });
          } else if (event.type === 'done') {
            // 完成
          }
        }

        // 关闭最后的文本块
        if (localActiveTextBlockId) {
          setStreamBlocks(prev => prev.map(block =>
            block.id === localActiveTextBlockId
              ? { ...block, isStreaming: false }
              : block
          ));
          setActiveTextBlockId(null);
        }

        // 添加助手消息 - 使用累积的响应而非闭包中的状态
        if (verbose) {
          console.log('[App] Final response length:', accumulatedResponse.length);
        }
        if (accumulatedResponse) {
          addMessage('assistant', accumulatedResponse);
        }
        addActivity(`Conversation: ${input.slice(0, 30)}...`);
        setConnectionStatus('connected');
      } catch (err) {
        addMessage('assistant', `Error: ${err}`);
        addActivity(`Error occurred`);
        setConnectionStatus('error');
      }

      setIsProcessing(false);
      setCurrentResponse(''); // 清空当前响应，因为已添加到消息列表
      // 注意：不清空streamBlocks，让它保留在当前会话中直到下一次提交
    },
    [loop, showWelcome, addActivity, addMessage, handleSlashCommand, verbose] // 添加 verbose 依赖
  );

  // 初始 prompt
  useEffect(() => {
    if (initialPrompt) {
      setShowWelcome(false);
      handleSubmit(initialPrompt);
    }
  }, [handleSubmit, initialPrompt]); // 添加依赖项

  return (
    <Box flexDirection="column">
      {/* 欢迎屏幕或头部 */}
      {showWelcome && messages.length === 0 ? (
        <WelcomeScreen
          version={VERSION}
          username={username}
          model={modelDisplayName[currentModel] || currentModel}
          apiType={apiType as any}
          organization={organization}
          cwd={process.cwd()}
          recentActivity={recentActivity}
        />
      ) : (
        <Header
          version={VERSION}
          model={modelDisplayName[currentModel] || currentModel}
          cwd={process.cwd()}
          username={username}
          apiType={apiType}
          organization={organization}
          isCompact={messages.length > 0}
          isPlanMode={planMode}
          connectionStatus={connectionStatus}
          showShortcutHint={true}
          hasUpdate={hasUpdate}
          latestVersion={latestVersion}
        />
      )}

      {/* 快捷键帮助 */}
      <ShortcutHelp
        isVisible={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* 登录选择器 */}
      {showLoginScreen && (
        <LoginSelector onSelect={handleLoginSelect} />
      )}

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {/* 历史消息 */}
        {messages.map((msg, i) => (
          <Message
            key={`${msg.role}-${msg.timestamp.getTime()}-${i}`}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}

        {/* 当前流式块（按时间顺序交织显示文本和工具）*/}
        {streamBlocks.map((block) => {
          if (block.type === 'text') {
            return (
              <Message
                key={block.id}
                role="assistant"
                content={block.text || ''}
                timestamp={block.timestamp}
                streaming={block.isStreaming}
              />
            );
          } else if (block.type === 'tool' && block.tool) {
            return (
              <ToolCall
                key={block.id}
                name={block.tool.name}
                status={block.tool.status}
                input={block.tool.input}
                result={block.tool.result}
                error={block.tool.error}
                duration={block.tool.duration}
              />
            );
          }
          return null;
        })}

        {/* 加载中指示器（仅在没有任何块时显示）*/}
        {isProcessing && streamBlocks.length === 0 && (
          <Box marginLeft={2}>
            <Spinner label="Thinking..." />
          </Box>
        )}
      </Box>

      {/* Todo List */}
      {(todos.length > 0 || showTodosPanel) && <TodoList todos={todos} />}

      {/* Background Tasks Panel */}
      <BackgroundTasksPanel
        tasks={backgroundTasks}
        isVisible={showBackgroundPanel}
      />

      {/* Input with suggestion */}
      <Box marginTop={1}>
        <Input
          onSubmit={handleSubmit}
          disabled={isProcessing}
          suggestion={showWelcome ? currentSuggestion : undefined}
        />
      </Box>

      {/* Status Bar - 底部状态栏 */}
      <Box justifyContent="space-between" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          ? for shortcuts
        </Text>
        <Text color="gray" dimColor>
          {isProcessing ? 'Processing...' : 'Auto-updating...'}
        </Text>
      </Box>
    </Box>
  );
};

export default App;
