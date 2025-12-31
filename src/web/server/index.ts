/**
 * WebUI 服务器入口
 * Express + WebSocket 服务器
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConversationManager } from './conversation.js';
import { setupWebSocket } from './websocket.js';
import { setupApiRoutes } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebServerOptions {
  port?: number;
  host?: string;
  cwd?: string;
  model?: string;
}

export async function startWebServer(options: WebServerOptions = {}): Promise<void> {
  const {
    port = parseInt(process.env.CLAUDE_WEB_PORT || '3456'),
    host = process.env.CLAUDE_WEB_HOST || 'localhost',
    cwd = process.cwd(),
    model = process.env.CLAUDE_MODEL || 'sonnet',
  } = options;

  // 创建 Express 应用
  const app = express();
  const server = createServer(app);

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server, path: '/ws' });

  // 创建对话管理器
  const conversationManager = new ConversationManager(cwd, model);
  await conversationManager.initialize();

  // 中间件
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS 配置（开发模式）
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API 路由
  setupApiRoutes(app, conversationManager);

  // 静态文件服务（生产模式）
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  // 内联 HTML（所有请求返回 SPA）
  // 使用 use 中间件作为 catch-all（Express 5 兼容）
  app.use((req, res, next) => {
    // 跳过 API 路由和静态资源
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      return next();
    }
    res.send(getInlineHTML(port));
  });

  // 设置 WebSocket 处理
  setupWebSocket(wss, conversationManager);

  // 启动服务器
  server.listen(port, host, () => {
    console.log(`\n🌐 Claude Code WebUI 已启动`);
    console.log(`   地址: http://${host}:${port}`);
    console.log(`   WebSocket: ws://${host}:${port}/ws`);
    console.log(`   工作目录: ${cwd}`);
    console.log(`   模型: ${model}\n`);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    wss.close();
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

/**
 * 获取内联 HTML
 * 包含完整的前端应用
 */
function getInlineHTML(port: number): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code WebUI</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <style>
    ${getInlineCSS()}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    ${getInlineReactApp(port)}
  </script>
</body>
</html>`;
}

/**
 * 获取内联 CSS 样式
 */
function getInlineCSS(): string {
  return `
    :root {
      --bg-primary: #1a1b26;
      --bg-secondary: #24283b;
      --bg-tertiary: #414868;
      --text-primary: #c0caf5;
      --text-secondary: #a9b1d6;
      --text-muted: #565f89;
      --accent-primary: #7aa2f7;
      --accent-success: #9ece6a;
      --accent-warning: #e0af68;
      --accent-error: #f7768e;
      --border-color: #414868;
      --code-bg: #1f2335;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
    }

    #root {
      display: flex;
      height: 100vh;
    }

    /* 侧边栏 */
    .sidebar {
      width: 260px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header h1 {
      font-size: 18px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .new-chat-btn {
      width: 100%;
      padding: 10px;
      margin-top: 12px;
      background: var(--accent-primary);
      color: var(--bg-primary);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .new-chat-btn:hover {
      opacity: 0.9;
    }

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .session-item {
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 4px;
      transition: background 0.2s;
    }

    .session-item:hover {
      background: var(--bg-tertiary);
    }

    .session-item.active {
      background: var(--bg-tertiary);
    }

    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
    }

    /* 主聊天区域 */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .chat-header {
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .model-selector {
      padding: 6px 12px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      cursor: pointer;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    /* 消息样式 */
    .message {
      max-width: 900px;
      margin: 0 auto 20px;
      padding: 16px 20px;
      border-radius: 12px;
    }

    .message.user {
      background: var(--bg-tertiary);
      margin-left: 60px;
    }

    .message.assistant {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .message-role {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .message-content {
      line-height: 1.6;
    }

    .message-content p {
      margin-bottom: 12px;
    }

    .message-content p:last-child {
      margin-bottom: 0;
    }

    .message-content pre {
      background: var(--code-bg);
      border-radius: 8px;
      padding: 12px;
      overflow-x: auto;
      margin: 12px 0;
    }

    .message-content code {
      font-family: 'Fira Code', 'JetBrains Mono', Consolas, monospace;
      font-size: 13px;
    }

    .message-content :not(pre) > code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* 工具调用样式 */
    .tool-call {
      margin: 12px 0;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .tool-call-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--bg-tertiary);
      cursor: pointer;
      user-select: none;
    }

    .tool-call-header:hover {
      background: #4a5178;
    }

    .tool-icon {
      font-size: 16px;
    }

    .tool-name {
      font-weight: 600;
      color: var(--accent-primary);
    }

    .tool-status {
      margin-left: auto;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .tool-status.running {
      background: var(--accent-warning);
      color: var(--bg-primary);
    }

    .tool-status.completed {
      background: var(--accent-success);
      color: var(--bg-primary);
    }

    .tool-status.error {
      background: var(--accent-error);
      color: var(--bg-primary);
    }

    .tool-call-body {
      padding: 12px 14px;
      background: var(--bg-primary);
      font-size: 13px;
    }

    .tool-input, .tool-output {
      margin-bottom: 12px;
    }

    .tool-input:last-child, .tool-output:last-child {
      margin-bottom: 0;
    }

    .tool-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .tool-input pre, .tool-output pre {
      margin: 0;
      padding: 10px;
      background: var(--code-bg);
      border-radius: 6px;
      overflow-x: auto;
      font-size: 12px;
    }

    /* Diff 样式 */
    .diff-view {
      font-family: 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
    }

    .diff-line {
      padding: 2px 10px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-line.add {
      background: rgba(158, 206, 106, 0.15);
      color: var(--accent-success);
    }

    .diff-line.remove {
      background: rgba(247, 118, 142, 0.15);
      color: var(--accent-error);
    }

    .diff-line.context {
      color: var(--text-muted);
    }

    .diff-line-number {
      display: inline-block;
      width: 40px;
      color: var(--text-muted);
      text-align: right;
      margin-right: 10px;
      user-select: none;
    }

    /* 文件路径样式 */
    .file-path {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: var(--accent-primary);
    }

    /* Todo 列表样式 */
    .todo-list {
      list-style: none;
    }

    .todo-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }

    .todo-item:last-child {
      border-bottom: none;
    }

    .todo-status-icon {
      font-size: 14px;
    }

    .todo-content {
      flex: 1;
    }

    .todo-item.completed .todo-content {
      text-decoration: line-through;
      color: var(--text-muted);
    }

    /* 输入区域 */
    .input-area {
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .input-container {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      gap: 12px;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    .chat-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      resize: none;
      min-height: 48px;
      max-height: 200px;
      line-height: 1.5;
    }

    .chat-input:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .chat-input::placeholder {
      color: var(--text-muted);
    }

    .send-btn {
      padding: 12px 20px;
      background: var(--accent-primary);
      color: var(--bg-primary);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .send-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* 状态指示器 */
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-success);
    }

    .status-dot.thinking {
      background: var(--accent-warning);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* 思考块样式 */
    .thinking-block {
      margin: 12px 0;
      padding: 12px;
      background: rgba(122, 162, 247, 0.1);
      border-left: 3px solid var(--accent-primary);
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .thinking-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--accent-primary);
    }

    /* 搜索结果样式 */
    .search-results {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .search-result-item {
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 8px;
    }

    .search-result-title {
      color: var(--accent-primary);
      font-weight: 500;
      margin-bottom: 4px;
    }

    .search-result-url {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .search-result-snippet {
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* 滚动条样式 */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    /* 加载动画 */
    .loading-dots {
      display: inline-flex;
      gap: 4px;
    }

    .loading-dots span {
      width: 6px;
      height: 6px;
      background: var(--accent-primary);
      border-radius: 50%;
      animation: loading 1.4s infinite both;
    }

    .loading-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .loading-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes loading {
      0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* 欢迎屏幕 */
    .welcome-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 40px;
    }

    .welcome-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }

    .welcome-title {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text-primary);
    }

    .welcome-subtitle {
      font-size: 16px;
      color: var(--text-muted);
      max-width: 500px;
      line-height: 1.6;
    }

    /* 响应式 */
    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }

      .message.user {
        margin-left: 20px;
      }
    }
  `;
}

/**
 * 获取内联 React 应用代码
 */
function getInlineReactApp(port: number): string {
  return `
    const { useState, useEffect, useRef, useCallback } = React;

    // 工具名称映射
    const TOOL_DISPLAY_NAMES = {
      Bash: '终端命令',
      BashOutput: '终端输出',
      KillShell: '终止进程',
      Read: '读取文件',
      Write: '写入文件',
      Edit: '编辑文件',
      MultiEdit: '批量编辑',
      Glob: '文件搜索',
      Grep: '内容搜索',
      WebFetch: '网页获取',
      WebSearch: '网页搜索',
      TodoWrite: '任务管理',
      Task: '子任务',
      NotebookEdit: '笔记本编辑',
      AskUserQuestion: '询问用户',
    };

    // 工具图标映射
    const TOOL_ICONS = {
      Bash: '💻',
      Read: '📖',
      Write: '✏️',
      Edit: '🔧',
      MultiEdit: '📝',
      Glob: '🔍',
      Grep: '🔎',
      WebFetch: '🌐',
      WebSearch: '🔍',
      TodoWrite: '✅',
      Task: '🤖',
      NotebookEdit: '📓',
      AskUserQuestion: '❓',
    };

    // WebSocket Hook
    function useWebSocket(url) {
      const [connected, setConnected] = useState(false);
      const [sessionId, setSessionId] = useState(null);
      const [model, setModel] = useState('sonnet');
      const wsRef = useRef(null);
      const messageHandlersRef = useRef([]);

      useEffect(() => {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            messageHandlersRef.current.forEach(handler => handler(message));

            if (message.type === 'connected') {
              setSessionId(message.payload.sessionId);
              setModel(message.payload.model);
            }
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnected(false);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        return () => {
          ws.close();
        };
      }, [url]);

      const send = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(message));
        }
      }, []);

      const addMessageHandler = useCallback((handler) => {
        messageHandlersRef.current.push(handler);
        return () => {
          messageHandlersRef.current = messageHandlersRef.current.filter(h => h !== handler);
        };
      }, []);

      return { connected, sessionId, model, send, addMessageHandler };
    }

    // Markdown 渲染组件
    function MarkdownContent({ content }) {
      const ref = useRef(null);

      useEffect(() => {
        if (ref.current && content) {
          ref.current.innerHTML = marked.parse(content);
          ref.current.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
          });
        }
      }, [content]);

      return React.createElement('div', { ref, className: 'message-content' });
    }

    // 工具调用组件
    function ToolCall({ toolUse }) {
      const [expanded, setExpanded] = useState(true);
      const { name, input, status, result } = toolUse;

      const icon = TOOL_ICONS[name] || '🔧';
      const displayName = TOOL_DISPLAY_NAMES[name] || name;

      return React.createElement('div', { className: 'tool-call' },
        React.createElement('div', {
          className: 'tool-call-header',
          onClick: () => setExpanded(!expanded)
        },
          React.createElement('span', { className: 'tool-icon' }, icon),
          React.createElement('span', { className: 'tool-name' }, displayName),
          React.createElement('span', { className: \`tool-status \${status}\` },
            status === 'running' ? '执行中...' :
            status === 'completed' ? '完成' :
            status === 'error' ? '错误' : '等待中'
          ),
          React.createElement('span', null, expanded ? '▼' : '▶')
        ),
        expanded && React.createElement('div', { className: 'tool-call-body' },
          React.createElement('div', { className: 'tool-input' },
            React.createElement('div', { className: 'tool-label' }, '输入参数'),
            React.createElement('pre', null,
              React.createElement('code', null, JSON.stringify(input, null, 2))
            )
          ),
          result && React.createElement('div', { className: 'tool-output' },
            React.createElement('div', { className: 'tool-label' }, result.success ? '输出结果' : '错误信息'),
            React.createElement('pre', null,
              React.createElement('code', null, result.output || result.error || '(无输出)')
            )
          )
        )
      );
    }

    // 消息组件
    function Message({ message }) {
      const { role, content } = message;

      const renderContent = (item, index) => {
        if (item.type === 'text') {
          return React.createElement(MarkdownContent, { key: index, content: item.text });
        }
        if (item.type === 'tool_use') {
          return React.createElement(ToolCall, { key: index, toolUse: item });
        }
        if (item.type === 'thinking') {
          return React.createElement('div', { key: index, className: 'thinking-block' },
            React.createElement('div', { className: 'thinking-header' }, '💭 思考中'),
            React.createElement('div', null, item.text)
          );
        }
        return null;
      };

      return React.createElement('div', { className: \`message \${role}\` },
        React.createElement('div', { className: 'message-header' },
          React.createElement('span', { className: 'message-role' },
            role === 'user' ? '你' : 'Claude'
          ),
          message.model && React.createElement('span', null, \`(\${message.model})\`)
        ),
        Array.isArray(content)
          ? content.map(renderContent)
          : React.createElement(MarkdownContent, { content })
      );
    }

    // 欢迎屏幕组件
    function WelcomeScreen() {
      return React.createElement('div', { className: 'welcome-screen' },
        React.createElement('div', { className: 'welcome-icon' }, '🤖'),
        React.createElement('h2', { className: 'welcome-title' }, 'Claude Code WebUI'),
        React.createElement('p', { className: 'welcome-subtitle' },
          '欢迎使用 Claude Code 的 Web 界面。在下方输入框中输入你的问题或指令，我会帮助你完成编程任务。'
        )
      );
    }

    // 主应用组件
    function App() {
      const [messages, setMessages] = useState([]);
      const [input, setInput] = useState('');
      const [status, setStatus] = useState('idle');
      const chatContainerRef = useRef(null);
      const inputRef = useRef(null);

      const { connected, sessionId, model, send, addMessageHandler } = useWebSocket(\`ws://localhost:${port}/ws\`);

      // 当前正在构建的消息
      const currentMessageRef = useRef(null);

      useEffect(() => {
        const unsubscribe = addMessageHandler((msg) => {
          switch (msg.type) {
            case 'message_start':
              currentMessageRef.current = {
                id: msg.payload.messageId,
                role: 'assistant',
                timestamp: Date.now(),
                content: [],
                model
              };
              setStatus('streaming');
              break;

            case 'text_delta':
              if (currentMessageRef.current) {
                const lastContent = currentMessageRef.current.content[currentMessageRef.current.content.length - 1];
                if (lastContent?.type === 'text') {
                  lastContent.text += msg.payload.text;
                } else {
                  currentMessageRef.current.content.push({ type: 'text', text: msg.payload.text });
                }
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMessageRef.current.id);
                  return [...filtered, { ...currentMessageRef.current }];
                });
              }
              break;

            case 'thinking_start':
              if (currentMessageRef.current) {
                currentMessageRef.current.content.push({ type: 'thinking', text: '' });
                setStatus('thinking');
              }
              break;

            case 'thinking_delta':
              if (currentMessageRef.current) {
                const thinkingContent = currentMessageRef.current.content.find(c => c.type === 'thinking');
                if (thinkingContent) {
                  thinkingContent.text += msg.payload.text;
                  setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== currentMessageRef.current.id);
                    return [...filtered, { ...currentMessageRef.current }];
                  });
                }
              }
              break;

            case 'tool_use_start':
              if (currentMessageRef.current) {
                currentMessageRef.current.content.push({
                  type: 'tool_use',
                  id: msg.payload.toolUseId,
                  name: msg.payload.toolName,
                  input: msg.payload.input,
                  status: 'running'
                });
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMessageRef.current.id);
                  return [...filtered, { ...currentMessageRef.current }];
                });
                setStatus('tool_executing');
              }
              break;

            case 'tool_result':
              if (currentMessageRef.current) {
                const toolUse = currentMessageRef.current.content.find(
                  c => c.type === 'tool_use' && c.id === msg.payload.toolUseId
                );
                if (toolUse) {
                  toolUse.status = msg.payload.success ? 'completed' : 'error';
                  toolUse.result = {
                    success: msg.payload.success,
                    output: msg.payload.output,
                    error: msg.payload.error
                  };
                  setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== currentMessageRef.current.id);
                    return [...filtered, { ...currentMessageRef.current }];
                  });
                }
              }
              break;

            case 'message_complete':
              if (currentMessageRef.current) {
                currentMessageRef.current.usage = msg.payload.usage;
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMessageRef.current.id);
                  return [...filtered, { ...currentMessageRef.current }];
                });
                currentMessageRef.current = null;
              }
              setStatus('idle');
              break;

            case 'error':
              console.error('Server error:', msg.payload);
              setStatus('idle');
              break;

            case 'status':
              setStatus(msg.payload.status);
              break;
          }
        });

        return unsubscribe;
      }, [addMessageHandler, model]);

      // 自动滚动到底部
      useEffect(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, [messages]);

      const handleSend = () => {
        if (!input.trim() || !connected || status !== 'idle') return;

        const userMessage = {
          id: 'user-' + Date.now(),
          role: 'user',
          timestamp: Date.now(),
          content: [{ type: 'text', text: input }]
        };

        setMessages(prev => [...prev, userMessage]);
        send({ type: 'chat', payload: { content: input } });
        setInput('');
        setStatus('thinking');
      };

      const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      };

      return React.createElement('div', { id: 'root' },
        // 侧边栏
        React.createElement('div', { className: 'sidebar' },
          React.createElement('div', { className: 'sidebar-header' },
            React.createElement('h1', null, '🤖 Claude Code'),
            React.createElement('button', {
              className: 'new-chat-btn',
              onClick: () => {
                setMessages([]);
                send({ type: 'clear_history' });
              }
            }, '+ 新对话')
          ),
          React.createElement('div', { className: 'session-list' }),
          React.createElement('div', { className: 'sidebar-footer' },
            React.createElement('div', { className: 'status-indicator' },
              React.createElement('span', {
                className: \`status-dot \${status === 'idle' ? '' : 'thinking'}\`
              }),
              connected ? '已连接' : '连接中...'
            ),
            sessionId && React.createElement('div', null, \`会话: \${sessionId.slice(0, 8)}...\`)
          )
        ),
        // 主内容区
        React.createElement('div', { className: 'main-content' },
          React.createElement('div', { className: 'chat-header' },
            React.createElement('div', null, '对话'),
            React.createElement('select', {
              className: 'model-selector',
              value: model,
              onChange: (e) => send({ type: 'set_model', payload: { model: e.target.value } })
            },
              React.createElement('option', { value: 'opus' }, 'Claude Opus'),
              React.createElement('option', { value: 'sonnet' }, 'Claude Sonnet'),
              React.createElement('option', { value: 'haiku' }, 'Claude Haiku')
            )
          ),
          React.createElement('div', {
            className: 'chat-container',
            ref: chatContainerRef
          },
            messages.length === 0
              ? React.createElement(WelcomeScreen)
              : messages.map(msg => React.createElement(Message, { key: msg.id, message: msg }))
          ),
          React.createElement('div', { className: 'input-area' },
            React.createElement('div', { className: 'input-container' },
              React.createElement('div', { className: 'input-wrapper' },
                React.createElement('textarea', {
                  ref: inputRef,
                  className: 'chat-input',
                  value: input,
                  onChange: (e) => setInput(e.target.value),
                  onKeyDown: handleKeyDown,
                  placeholder: status === 'idle' ? '输入消息...' : '处理中...',
                  disabled: status !== 'idle',
                  rows: 1
                })
              ),
              React.createElement('button', {
                className: 'send-btn',
                onClick: handleSend,
                disabled: !connected || status !== 'idle' || !input.trim()
              },
                status !== 'idle'
                  ? React.createElement('div', { className: 'loading-dots' },
                      React.createElement('span'),
                      React.createElement('span'),
                      React.createElement('span')
                    )
                  : '发送'
              )
            )
          )
        )
      );
    }

    // 渲染应用
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  `;
}

// 如果直接运行此文件，启动服务器
const isMainModule = process.argv[1]?.includes('server') ||
                     process.argv[1]?.endsWith('web.js') ||
                     process.argv[1]?.endsWith('web.ts');

if (isMainModule) {
  startWebServer().catch(console.error);
}
