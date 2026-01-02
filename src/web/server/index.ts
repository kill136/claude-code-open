/**
 * WebUI 服务器入�?
 * Express + WebSocket 服务�?
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

  // 创建 WebSocket 服务�?
  const wss = new WebSocketServer({ server, path: '/ws' });

  // 创建对话管理�?
  const conversationManager = new ConversationManager(cwd, model);
  await conversationManager.initialize();

  // 中间�?
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

  // 静态文件服务（生产模式�?
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  // 内联 HTML（所有请求返�?SPA�?
  // 使用 use 中间件作�?catch-all（Express 5 兼容�?
  app.use((req, res, next) => {
    // 跳过 API 路由和静态资�?
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      return next();
    }
    res.send(getInlineHTML(port));
  });

  // 设置 WebSocket 处理
  setupWebSocket(wss, conversationManager);

  // 启动服务�?
  server.listen(port, host, () => {
    console.log(`\n🌐 Claude Code WebUI 已启动`);
    console.log(`   地址: http://${host}:${port}`);
    console.log(`   WebSocket: ws://${host}:${port}/ws`);
    console.log(`   工作目录: ${cwd}`);
    console.log(`   模型: ${model}\n`);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务�?..');
    wss.close();
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

/**
 * 获取内联 HTML
 * 包含完整的前端应�?
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

    /* 侧边�?*/
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
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .session-item:hover {
      background: var(--bg-tertiary);
    }

    .session-item.active {
      background: var(--bg-tertiary);
      border-left: 3px solid var(--accent-primary);
    }

    .session-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-right: 50px;
    }

    .session-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
    }

    .session-date {
      font-size: 11px;
      color: var(--text-muted);
    }

    .session-count {
      font-size: 11px;
      color: var(--text-muted);
    }

    .session-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: none;
      gap: 4px;
      align-items: center;
    }

    .session-item:hover .session-actions {
      display: flex;
    }

    .session-action-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 12px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .session-action-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .session-item input {
      width: 100%;
      padding: 4px 8px;
      background: var(--bg-primary);
      border: 1px solid var(--accent-primary);
      border-radius: 4px;
      color: var(--text-primary);
      font-size: 14px;
      outline: none;
    }

    .session-list-empty {
      padding: 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
    }

    /* 主聊天区�?*/
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
      align-items: flex-end;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    /* 斜杠命令面板 */
    .slash-command-palette {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
      margin-bottom: 8px;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
    }

    .slash-command-item {
      padding: 10px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }

    .slash-command-item:last-child {
      border-bottom: none;
    }

    .slash-command-item.selected,
    .slash-command-item:hover {
      background: var(--bg-tertiary);
    }

    .command-name {
      font-weight: 600;
      color: var(--accent-primary);
      min-width: 80px;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
    }

    .command-desc {
      flex: 1;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .command-usage {
      color: var(--text-muted);
      font-size: 12px;
      font-family: 'Fira Code', monospace;
      font-style: italic;
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

    /* 附件上传按钮 */
    .attach-btn {
      padding: 12px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    .attach-btn:hover {
      color: var(--accent-primary);
      border-color: var(--accent-primary);
      background: rgba(122, 162, 247, 0.1);
    }

    .attach-btn input[type="file"] {
      display: none;
    }

    /* 附件预览区域 */
    .attachments-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      max-width: 900px;
      margin-left: auto;
      margin-right: auto;
    }

    .attachment-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 13px;
    }

    .attachment-item .file-icon {
      font-size: 16px;
    }

    .attachment-item .file-name {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .attachment-item .remove-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      font-size: 14px;
      line-height: 1;
    }

    .attachment-item .remove-btn:hover {
      color: var(--accent-error);
    }

    /* 图片预览 */
    .image-preview {
      max-width: 200px;
      max-height: 150px;
      border-radius: 6px;
      margin-top: 8px;
    }

    /* 消息中的图片 */
    .message-image {
      max-width: 400px;
      max-height: 300px;
      border-radius: 8px;
      margin: 8px 0;
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

    /* 滚动条样�?*/
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

    /* 权限对话框样�?*/
    .permission-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .permission-dialog {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .permission-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .permission-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .risk-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .risk-badge.risk-high {
      background: rgba(247, 118, 142, 0.2);
      color: var(--accent-error);
      border: 1px solid var(--accent-error);
    }

    .risk-badge.risk-medium {
      background: rgba(224, 175, 104, 0.2);
      color: var(--accent-warning);
      border: 1px solid var(--accent-warning);
    }

    .risk-badge.risk-low {
      background: rgba(158, 206, 106, 0.2);
      color: var(--accent-success);
      border: 1px solid var(--accent-success);
    }

    .permission-content {
      margin-bottom: 20px;
    }

    .permission-content .tool-name {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      font-weight: 500;
    }

    .permission-content .tool-name strong {
      color: var(--accent-primary);
    }

    .permission-content .description {
      font-size: 14px;
      color: var(--text-primary);
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .permission-content .args {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      font-family: 'Fira Code', monospace;
      overflow-x: auto;
      max-height: 300px;
      margin: 0;
    }

    .permission-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }

    .permission-actions label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      flex: 1;
    }

    .permission-actions input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .permission-actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .permission-actions button:first-of-type {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .permission-actions button:first-of-type:hover {
      background: var(--border-color);
    }

    .permission-actions button:last-of-type {
      background: var(--accent-primary);
      color: var(--bg-primary);
    }

    .permission-actions button:last-of-type:hover {
      opacity: 0.9;
    }

    /* 用户问答对话框样�?*/
    .question-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .question-dialog {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
    }

    .question-header {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .question-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .question-content {
      margin-bottom: 24px;
    }

    .question-text {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text-primary);
      margin-bottom: 16px;
      white-space: pre-wrap;
    }

    .question-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .question-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .question-option:hover {
      background: var(--bg-tertiary);
      border-color: var(--accent-primary);
    }

    .question-option.selected {
      background: rgba(122, 162, 247, 0.15);
      border-color: var(--accent-primary);
    }

    .question-option input[type="radio"],
    .question-option input[type="checkbox"] {
      margin-top: 3px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .question-option-content {
      flex: 1;
    }

    .question-option-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .question-option-description {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .question-dialog textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
      line-height: 1.5;
    }

    .question-dialog textarea:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .question-dialog textarea::placeholder {
      color: var(--text-muted);
    }

    .question-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .question-actions button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .question-actions button:first-child {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .question-actions button:first-child:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .question-actions button:last-child {
      background: var(--accent-primary);
      color: var(--bg-primary);
    }

    .question-actions button:last-child:hover:not(:disabled) {
      opacity: 0.9;
    }

    .question-actions button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .question-timeout-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 12px;
      text-align: center;
    }

    /* 响应�?*/
    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }

      .question-dialog {
        width: 95%;
        max-width: none;
        padding: 20px;
        margin-left: 20px;
      }

      .permission-dialog {
        width: 95%;
        padding: 20px;
      }

      .permission-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .permission-actions label {
        order: -1;
        margin-bottom: 8px;
      }

      .permission-actions button {
        width: 100%;
      }
    }

    /* 设置面板样式 */
    .settings-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .settings-panel {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .settings-header h2 {
      margin: 0;
      font-size: 18px;
      color: var(--text-primary);
    }

    .settings-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .settings-close-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .settings-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .settings-nav {
      width: 180px;
      border-right: 1px solid var(--border-color);
      padding: 12px;
    }

    .settings-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 4px;
    }

    .settings-nav-item:hover {
      background: var(--bg-tertiary);
    }

    .settings-nav-item.active {
      background: var(--accent-primary);
      color: var(--bg-primary);
    }

    .settings-content {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }

    .settings-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .settings-section p {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }

    .mcp-server-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mcp-server-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .mcp-server-info { flex: 1; }

    .mcp-server-name {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .mcp-server-command {
      font-size: 12px;
      color: var(--text-muted);
      font-family: monospace;
    }

    .mcp-server-status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      margin-right: 12px;
    }

    .mcp-server-status.enabled {
      background: rgba(158, 206, 106, 0.2);
      color: var(--accent-success);
    }

    .mcp-server-status.disabled {
      background: rgba(247, 118, 142, 0.2);
      color: var(--accent-error);
    }

    .mcp-server-actions {
      display: flex;
      gap: 8px;
    }

    .mcp-server-actions button {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
    }

    .mcp-server-actions button:hover {
      background: var(--bg-tertiary);
    }

    .mcp-server-actions button.danger:hover {
      background: rgba(247, 118, 142, 0.2);
      color: var(--accent-error);
    }

    .mcp-add-form {
      padding: 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-top: 12px;
    }

    .mcp-add-form .form-row {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .mcp-add-form .form-group {
      flex: 1;
    }

    .mcp-add-form label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .mcp-add-form input {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }

    .mcp-add-form input:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .mcp-add-form .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .mcp-add-form button {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .mcp-add-form button.cancel {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .mcp-add-form button.submit {
      background: var(--accent-primary);
      border: none;
      color: var(--bg-primary);
    }

    .add-mcp-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: transparent;
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      margin-top: 12px;
    }

    .add-mcp-btn:hover {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .prompt-editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .prompt-mode-selector {
      display: flex;
      gap: 8px;
    }

    .prompt-mode-btn {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
    }

    .prompt-mode-btn.active {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
      color: var(--bg-primary);
    }

    .prompt-textarea {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: monospace;
      resize: vertical;
    }

    .prompt-textarea:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .prompt-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .prompt-actions button {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .prompt-actions button.reset {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .prompt-actions button.save {
      background: var(--accent-primary);
      border: none;
      color: var(--bg-primary);
    }

    .settings-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .settings-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--accent-primary);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
    }

    .empty-state .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  `;
}

/**
 * 获取内联 React 应用代码
 */
function getInlineReactApp(port: number): string {
  return `
    const { useState, useEffect, useRef, useCallback } = React;

    // 斜杠命令列表
    const SLASH_COMMANDS = [
      { name: '/help', description: '显示所有可用命�?, aliases: ['/?'] },
      { name: '/clear', description: '清空当前对话', aliases: ['/reset', '/new'] },
      { name: '/model', description: '查看或切换模�?, usage: '/model [opus|sonnet|haiku]' },
      { name: '/cost', description: '显示当前会话费用' },
      { name: '/compact', description: '压缩对话历史' },
      { name: '/undo', description: '撤销上一次操�? },
      { name: '/diff', description: '显示未提交的git更改' },
      { name: '/config', description: '显示当前配置' },
      { name: '/sessions', description: '列出历史会话' },
      { name: '/resume', description: '恢复指定会话', usage: '/resume [id]' },
      { name: '/status', description: '显示系统状�? },
      { name: '/version', description: '显示版本信息' },
      { name: '/prompt', description: '管理系统提示', usage: '/prompt [set|append|reset]' },
      { name: '/tools', description: '管理工具配置', usage: '/tools [enable|disable|reset]' },
      { name: '/tasks', description: '管理后台任务', usage: '/tasks [cancel|output] [id]' },
    ];

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
      Task: '子任�?,
      NotebookEdit: '笔记本编�?,
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
      TodoWrite: '�?,
      Task: '🤖',
      NotebookEdit: '📓',
      AskUserQuestion: '�?,
    };

    // WebSocket Hook with auto-reconnect and heartbeat
    function useWebSocket(url) {
      const [connected, setConnected] = useState(false);
      const [sessionId, setSessionId] = useState(null);
      const [model, setModel] = useState('sonnet');
      const wsRef = useRef(null);
      const messageHandlersRef = useRef([]);
      const reconnectTimeoutRef = useRef(null);
      const pingIntervalRef = useRef(null);

      const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnected(true);

          // 定期发�?ping 保持连接
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // 忽略 pong 消息
            if (message.type === 'pong') return;

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

          // 清除 ping 定时�?
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          // 3秒后尝试重连
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      }, [url]);

      useEffect(() => {
        connect();

        return () => {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
          wsRef.current?.close();
        };
      }, [connect]);

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

    // 斜杠命令面板组件
    function SlashCommandPalette({ input, onSelect, onClose }) {
      const [selectedIndex, setSelectedIndex] = useState(0);
      const paletteRef = useRef(null);

      // 过滤匹配的命�?
      const query = input.slice(1).toLowerCase();
      const filteredCommands = SLASH_COMMANDS.filter(cmd =>
        cmd.name.slice(1).startsWith(query) ||
        cmd.aliases?.some(a => a.slice(1).startsWith(query))
      );

      // 重置选中索引当过滤结果变化时
      useEffect(() => {
        setSelectedIndex(0);
      }, [query]);

      // 键盘导航
      useEffect(() => {
        const handleKeyDown = (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (filteredCommands.length > 0) {
              e.preventDefault();
              onSelect(filteredCommands[selectedIndex]);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }, [filteredCommands, selectedIndex, onSelect, onClose]);

      if (filteredCommands.length === 0) return null;

      return React.createElement('div', {
        ref: paletteRef,
        className: 'slash-command-palette'
      },
        filteredCommands.map((cmd, i) =>
          React.createElement('div', {
            key: cmd.name,
            className: \`slash-command-item \${i === selectedIndex ? 'selected' : ''}\`,
            onClick: () => onSelect(cmd),
            onMouseEnter: () => setSelectedIndex(i)
          },
            React.createElement('span', { className: 'command-name' }, cmd.name),
            React.createElement('span', { className: 'command-desc' }, cmd.description),
            cmd.usage && React.createElement('span', { className: 'command-usage' }, cmd.usage)
          )
        )
      );
    }

    // 工具调用组件
    function ToolCall({ toolUse }) {
      // 默认折叠，用户点击可展开
      const [expanded, setExpanded] = useState(false);
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
            status === 'running' ? '执行�?..' :
            status === 'completed' ? '完成' :
            status === 'error' ? '错误' : '等待�?
          ),
          React.createElement('span', null, expanded ? '�? : '�?)
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
              React.createElement('code', null, result.output || result.error || '(无输�?')
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
        if (item.type === 'image') {
          // 渲染图片附件
          const imgSrc = item.source?.type === 'base64'
            ? \`data:\${item.source.media_type};base64,\${item.source.data}\`
            : item.url;
          return React.createElement('div', { key: index, className: 'image-container' },
            React.createElement('img', {
              src: imgSrc,
              alt: item.fileName || '上传的图�?,
              className: 'message-image'
            }),
            item.fileName && React.createElement('div', {
              style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }
            }, item.fileName)
          );
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
            role === 'user' ? '�? : 'Claude'
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
          '欢迎使用 Claude Code �?Web 界面。在下方输入框中输入你的问题或指令，我会帮助你完成编程任务�?
        )
      );
    }

    // 用户问答对话框组�?
    function UserQuestionDialog({ question, onAnswer }) {
      const [answer, setAnswer] = useState('');
      const [selectedOptions, setSelectedOptions] = useState([]);

      if (!question) return null;

      const handleOptionChange = (optionLabel, isMultiSelect) => {
        if (isMultiSelect) {
          setSelectedOptions(prev =>
            prev.includes(optionLabel)
              ? prev.filter(o => o !== optionLabel)
              : [...prev, optionLabel]
          );
        } else {
          setSelectedOptions([optionLabel]);
        }
      };

      const handleSubmit = () => {
        let finalAnswer = '';
        if (question.options) {
          finalAnswer = question.multiSelect
            ? selectedOptions.join(',')
            : selectedOptions[0] || '';
        } else {
          finalAnswer = answer;
        }
        onAnswer(finalAnswer);
      };

      const handleSkip = () => {
        onAnswer('');
      };

      const isValid = question.options
        ? selectedOptions.length > 0
        : answer.trim().length > 0;

      return React.createElement('div', { className: 'question-dialog-overlay' },
        React.createElement('div', { className: 'question-dialog' },
          React.createElement('div', { className: 'question-header' },
            React.createElement('h3', null, '�?', question.header || '请回答问�?)
          ),
          React.createElement('div', { className: 'question-content' },
            React.createElement('p', { className: 'question-text' }, question.question),
            question.options && React.createElement('div', { className: 'question-options' },
              question.options.map((opt, i) =>
                React.createElement('label', {
                  key: i,
                  className: \`question-option \${selectedOptions.includes(opt.label) ? 'selected' : ''}\`,
                  onClick: () => handleOptionChange(opt.label, question.multiSelect)
                },
                  React.createElement('input', {
                    type: question.multiSelect ? 'checkbox' : 'radio',
                    name: 'question-answer',
                    value: opt.label,
                    checked: selectedOptions.includes(opt.label),
                    onChange: () => {},
                    onClick: (e) => e.stopPropagation()
                  }),
                  React.createElement('div', { className: 'question-option-content' },
                    React.createElement('div', { className: 'question-option-label' }, opt.label),
                    opt.description && React.createElement('div', {
                      className: 'question-option-description'
                    }, opt.description)
                  )
                )
              )
            ),
            !question.options && React.createElement('textarea', {
              value: answer,
              onChange: (e) => setAnswer(e.target.value),
              placeholder: '请输入您的回�?..',
              autoFocus: true
            })
          ),
          React.createElement('div', { className: 'question-actions' },
            React.createElement('button', { onClick: handleSkip }, '跳过'),
            React.createElement('button', { onClick: handleSubmit, disabled: !isValid }, '提交')
          ),
          question.timeout && React.createElement('div', { className: 'question-timeout-hint' },
            \`超时时间: \${Math.round(question.timeout / 1000)}秒\`
          )
        )
      );
    }

    // 权限对话框组�?
    function PermissionDialog({ request, onRespond }) {
      const [remember, setRemember] = useState(false);
      const { requestId, tool, args, description, riskLevel } = request;

      const handleApprove = () => {
        onRespond(true, remember);
      };

      const handleDeny = () => {
        onRespond(false, remember);
      };

      // 获取工具的显示名称和图标
      const toolDisplayName = TOOL_DISPLAY_NAMES[tool] || tool;
      const toolIcon = TOOL_ICONS[tool] || '🔧';

      return React.createElement('div', { className: 'permission-dialog-overlay' },
        React.createElement('div', {
          className: 'permission-dialog',
          onClick: (e) => e.stopPropagation() // 防止点击对话框时关闭
        },
          // 头部
          React.createElement('div', { className: 'permission-header' },
            React.createElement('span', { className: \`risk-badge risk-\${riskLevel}\` },
              riskLevel === 'high' ? '高风�? :
              riskLevel === 'medium' ? '中风�? : '低风�?
            ),
            React.createElement('h3', null, '权限请求')
          ),
          // 内容
          React.createElement('div', { className: 'permission-content' },
            React.createElement('p', { className: 'tool-name' },
              \`工具: \${toolIcon} \`,
              React.createElement('strong', null, toolDisplayName)
            ),
            React.createElement('p', { className: 'description' }, description),
            React.createElement('pre', { className: 'args' },
              JSON.stringify(args, null, 2)
            )
          ),
          // 操作按钮
          React.createElement('div', { className: 'permission-actions' },
            React.createElement('label', null,
              React.createElement('input', {
                type: 'checkbox',
                checked: remember,
                onChange: (e) => setRemember(e.target.checked)
              }),
              '记住此决�?
            ),
            React.createElement('button', { onClick: handleDeny }, '拒绝'),
            React.createElement('button', { onClick: handleApprove }, '允许')
          )
        )
      );
    }

    // 主应用组�?

    // 格式化日�?
    function formatDate(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return \`\${diffMins}分钟前\`;
      if (diffHours < 24) return \`\${diffHours}小时前\`;
      if (diffDays < 7) return \`\${diffDays}天前\`;

      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    // 会话列表组件
    function SessionList({ sessions, currentSessionId, onSessionSelect, onSessionDelete, onSessionRename }) {
      const [editingId, setEditingId] = useState(null);
      const [newTitle, setNewTitle] = useState('');

      const handleRenameStart = (session) => {
        setEditingId(session.id);
        setNewTitle(session.name || '未命名会话);
      };

      const handleRenameSubmit = (sessionId) => {
        if (newTitle.trim()) {
          onSessionRename(sessionId, newTitle.trim());
        }
        setEditingId(null);
      };

      const handleRenameCancel = () => {
        setEditingId(null);
        setNewTitle('');
      };

      if (sessions.length === 0) {
        return React.createElement('div', { className: 'session-list-empty' },
          '暂无会话历史'
        );
      }

      return React.createElement('div', { className: 'session-list' },
        sessions.map(session =>
          React.createElement('div', {
            key: session.id,
            className: \`session-item \${session.id === currentSessionId ? 'active' : ''}\`,
            onClick: () => editingId !== session.id && onSessionSelect(session.id)
          },
            editingId === session.id
              ? React.createElement('input', {
                  value: newTitle,
                  onChange: (e) => setNewTitle(e.target.value),
                  onBlur: () => handleRenameSubmit(session.id),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                      handleRenameSubmit(session.id);
                    } else if (e.key === 'Escape') {
                      handleRenameCancel();
                    }
                    e.stopPropagation();
                  },
                  onClick: (e) => e.stopPropagation(),
                  autoFocus: true
                })
              : [
                  React.createElement('div', { key: 'title', className: 'session-title' },
                    session.name || '未命名会话'
                  ),
                  React.createElement('div', { key: 'meta', className: 'session-meta' },
                    React.createElement('span', { className: 'session-date' },
                      formatDate(session.updatedAt)
                    ),
                    React.createElement('span', { className: 'session-count' },
                      \`\${session.messageCount} 消息\`
                    )
                  ),
                  React.createElement('div', { key: 'actions', className: 'session-actions' },
                    React.createElement('button', {
                      className: 'session-action-btn',
                      onClick: (e) => {
                        e.stopPropagation();
                        handleRenameStart(session);
                      },
                      title: '重命名'
                    }, '✏️'),
                    React.createElement('button', {
                      className: 'session-action-btn',
                      onClick: (e) => {
                        e.stopPropagation();
                        if (confirm(\`确定要删除会话 "\${session.name || '未命名会话'}" 吗？\`)) {
                          onSessionDelete(session.id);
                        }
                      },
                      title: '删除'
                    }, '🗑️')
                  )
                ]
          )
        )
      );
    }
    function App() {
      const [messages, setMessages] = useState([]);
      const [input, setInput] = useState('');
      const [status, setStatus] = useState('idle');
      const [attachments, setAttachments] = useState([]);
      const [showCommandPalette, setShowCommandPalette] = useState(false);
      const [permissionRequest, setPermissionRequest] = useState(null);
      const [userQuestion, setUserQuestion] = useState(null);
      const [sessions, setSessions] = useState([]);
      const [showSettings, setShowSettings] = useState(false);
      const chatContainerRef = useRef(null);
      const inputRef = useRef(null);
      const fileInputRef = useRef(null);

      const { connected, sessionId, model, send, addMessageHandler } = useWebSocket(\`ws://localhost:${port}/ws\`);

      // 当前正在构建的消�?
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
                const currentMsg = currentMessageRef.current;
                const lastContent = currentMsg.content[currentMsg.content.length - 1];
                if (lastContent?.type === 'text') {
                  lastContent.text += msg.payload.text;
                } else {
                  currentMsg.content.push({ type: 'text', text: msg.payload.text });
                }
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMsg.id);
                  return [...filtered, { ...currentMsg }];
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
                const currentMsg = currentMessageRef.current;
                const thinkingContent = currentMsg.content.find(c => c.type === 'thinking');
                if (thinkingContent) {
                  thinkingContent.text += msg.payload.text;
                  setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== currentMsg.id);
                    return [...filtered, { ...currentMsg }];
                  });
                }
              }
              break;

            case 'tool_use_start':
              if (currentMessageRef.current) {
                const currentMsg = currentMessageRef.current;
                currentMsg.content.push({
                  type: 'tool_use',
                  id: msg.payload.toolUseId,
                  name: msg.payload.toolName,
                  input: msg.payload.input,
                  status: 'running'
                });
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMsg.id);
                  return [...filtered, { ...currentMsg }];
                });
                setStatus('tool_executing');
              }
              break;

            case 'tool_result':
              if (currentMessageRef.current) {
                const currentMsg = currentMessageRef.current;
                const toolUse = currentMsg.content.find(
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
                    const filtered = prev.filter(m => m.id !== currentMsg.id);
                    return [...filtered, { ...currentMsg }];
                  });
                }
              }
              break;

            case 'message_complete':
              if (currentMessageRef.current) {
                const currentMsg = currentMessageRef.current;
                currentMsg.usage = msg.payload.usage;
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== currentMsg.id);
                  return [...filtered, { ...currentMsg }];
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

            case 'permission_request':
              // 收到权限请求,显示对话�?
              setPermissionRequest(msg.payload);
              break;

            case 'user_question':
              // 收到用户问答请求
              setUserQuestion(msg.payload);
              break;

            case 'session_list_response':
              // 收到会话列表
              if (msg.payload && msg.payload.sessions) {
                setSessions(msg.payload.sessions);
              }
              break;

            case 'session_switched':
              // 会话切换成功，重新加载消�?
              setMessages([]);
              send({ type: 'get_history' });
              // 刷新会话列表
              send({ type: 'session_list', payload: { limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' } });
              break;

            case 'session_deleted':
              // 会话删除成功
              if (msg.payload.success) {
                setSessions(prev => prev.filter(s => s.id !== msg.payload.sessionId));
              }
              break;

            case 'session_renamed':
              // 会话重命名成�?
              if (msg.payload.success) {
                setSessions(prev => prev.map(s =>
                  s.id === msg.payload.sessionId ? { ...s, name: msg.payload.name } : s
                ));
              }
              break;
              break;
          }
        });

        return unsubscribe;
      }, [addMessageHandler, model]);

      // 自动滚动到底�?
      useEffect(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, [messages]);

      // 处理文件选择

      // 请求会话列表
      useEffect(() => {
        if (connected) {
          send({ type: 'session_list', payload: { limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' } });
        }
      }, [connected, send]);

      // 会话操作处理函数
      const handleSessionSelect = useCallback((sessionId) => {
        send({ type: 'session_switch', payload: { sessionId } });
      }, [send]);

      const handleSessionDelete = useCallback((sessionId) => {
        send({ type: 'session_delete', payload: { sessionId } });
      }, [send]);

      const handleSessionRename = useCallback((sessionId, name) => {
        send({ type: 'session_rename', payload: { sessionId, name } });
      }, [send]);

      const handleNewSession = useCallback(() => {
        setMessages([]);
        send({ type: 'clear_history' });
        // 刷新会话列表
        setTimeout(() => {
          send({ type: 'session_list', payload: { limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' } });
        }, 500);
      }, [send]);
      const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);

        files.forEach(file => {
          // 检查文件类型（支持图片和文本文件）
          const isImage = file.type.startsWith('image/');
          const isText = file.type.startsWith('text/') ||
                        /\\.(txt|md|json|js|ts|tsx|jsx|py|java|c|cpp|h|css|html|xml|yaml|yml|sh|bat|sql|log)$/i.test(file.name);

          if (!isImage && !isText) {
            alert(\`不支持的文件类型: \${file.name}\`);
            return;
          }

          const reader = new FileReader();

          if (isImage) {
            reader.onload = (event) => {
              setAttachments(prev => [...prev, {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: 'image',
                mimeType: file.type,
                data: event.target.result // base64 data URL
              }]);
            };
            reader.readAsDataURL(file);
          } else {
            reader.onload = (event) => {
              setAttachments(prev => [...prev, {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: 'text',
                mimeType: file.type || 'text/plain',
                data: event.target.result // 文本内容
              }]);
            };
            reader.readAsText(file);
          }
        });

        // 清空 file input
        if (e.target) {
          e.target.value = '';
        }
      };

      // 移除附件
      const handleRemoveAttachment = (id) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
      };

      // 处理粘贴事件
      const handlePaste = (e) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        const files = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // 处理图片
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              files.push(file);
            }
          }
        }

        // 如果有文件，处理它们
        if (files.length > 0) {
          e.preventDefault(); // 阻止默认粘贴行为

          files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              setAttachments(prev => [...prev, {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name || \`粘贴的图片_\${new Date().toLocaleTimeString()}.png\`,
                type: 'image',
                mimeType: file.type,
                data: event.target.result
              }]);
            };
            reader.readAsDataURL(file);
          });
        }
      };

      const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || !connected || status !== 'idle') return;

        // 构建消息内容
        const contentItems = [];

        // 添加图片附件
        attachments.forEach(att => {
          if (att.type === 'image') {
            contentItems.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType,
                data: att.data.split(',')[1] // 移除 data URL 前缀
              },
              fileName: att.name
            });
          } else if (att.type === 'text') {
            // 文本文件作为引用内容添加
            contentItems.push({
              type: 'text',
              text: \`[文件: \${att.name}]\\n\\\`\\\`\\\`\\n\${att.data}\\n\\\`\\\`\\\`\`
            });
          }
        });

        // 添加用户输入的文�?
        if (input.trim()) {
          contentItems.push({ type: 'text', text: input });
        }

        const userMessage = {
          id: 'user-' + Date.now(),
          role: 'user',
          timestamp: Date.now(),
          content: contentItems.length === 1 && contentItems[0].type === 'text'
            ? contentItems
            : contentItems,
          attachments: attachments.map(a => ({ name: a.name, type: a.type }))
        };

        setMessages(prev => [...prev, userMessage]);

        // 发送到服务器，包含附件信息
        send({
          type: 'chat',
          payload: {
            content: input,
            attachments: attachments.map(att => ({
              name: att.name,
              type: att.type,
              mimeType: att.mimeType,
              data: att.type === 'image' ? att.data.split(',')[1] : att.data
            }))
          }
        });

        setInput('');
        setAttachments([]);
        setStatus('thinking');
      };

      // 处理命令选择
      const handleCommandSelect = (command) => {
        setInput(command.name + ' ');
        setShowCommandPalette(false);
        inputRef.current?.focus();
      };

      // 处理用户问答
      const handleAnswerQuestion = (answer) => {
        if (userQuestion) {
          send({
            type: 'user_answer',
            payload: {
              requestId: userQuestion.requestId,
              answer: answer
            }
          });
          setUserQuestion(null);
        }
      };

      // 处理输入变化
      const handleInputChange = (e) => {
        const value = e.target.value;
        setInput(value);

        // 检测是否显示命令面�?
        if (value.startsWith('/') && !value.includes(' ')) {
          setShowCommandPalette(true);
        } else {
          setShowCommandPalette(false);
        }
      };

      // 处理权限响应
      const handlePermissionResponse = (approved, remember) => {
        if (!permissionRequest) return;

        // 发送权限响应到服务�?
        send({
          type: 'permission_response',
          payload: {
            requestId: permissionRequest.requestId,
            approved,
            remember,
            scope: remember ? 'session' : 'once'
          }
        });

        // 关闭权限对话�?
        setPermissionRequest(null);
      };

      const handleKeyDown = (e) => {
        // 如果命令面板显示，让面板处理键盘事件
        if (showCommandPalette && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
          return; // �?SlashCommandPalette 处理
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      };

      return React.createElement(React.Fragment, null,
        // 用户问答对话�?
        userQuestion && React.createElement(UserQuestionDialog, {
          question: userQuestion,
          onAnswer: handleAnswerQuestion
        }),

        // 侧边�?
        React.createElement('div', { className: 'sidebar' },
          React.createElement('div', { className: 'sidebar-header' },
            React.createElement('h1', null, '🤖 Claude Code'),
            React.createElement('button', {
              className: 'new-chat-btn',
              onClick: handleNewSession
            }, '+ 新对�?)
          ),
          React.createElement(SessionList, {
            sessions: sessions,
            currentSessionId: sessionId,
            onSessionSelect: handleSessionSelect,
            onSessionDelete: handleSessionDelete,
            onSessionRename: handleSessionRename
          }),
          React.createElement('div', { className: 'sidebar-footer' },
            React.createElement('button', {
              className: 'settings-btn',
              onClick: () => setShowSettings(true)
            }, '⚙️ 设置'),
            React.createElement('div', { className: 'status-indicator' },
              React.createElement('span', {
                className: \`status-dot \${status === 'idle' ? '' : 'thinking'}\`
              }),
              connected ? '已连�? : '连接�?..'
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
            // 附件预览区域
            attachments.length > 0 && React.createElement('div', { className: 'attachments-preview' },
              attachments.map(att => React.createElement('div', {
                key: att.id,
                className: 'attachment-item'
              },
                React.createElement('span', { className: 'file-icon' },
                  att.type === 'image' ? '🖼�? : '📄'
                ),
                React.createElement('span', { className: 'file-name' }, att.name),
                React.createElement('button', {
                  className: 'remove-btn',
                  onClick: () => handleRemoveAttachment(att.id)
                }, '×'),
                att.type === 'image' && React.createElement('img', {
                  src: att.data,
                  alt: att.name,
                  className: 'image-preview'
                })
              ))
            ),
            React.createElement('div', { className: 'input-container' },
              // 附件上传按钮
              React.createElement('label', { className: 'attach-btn' },
                '📎',
                React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  multiple: true,
                  accept: 'image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml,.sh,.bat,.sql,.log',
                  onChange: handleFileSelect
                })
              ),
              React.createElement('div', { className: 'input-wrapper' },
                // 斜杠命令面板
                showCommandPalette && React.createElement(SlashCommandPalette, {
                  input: input,
                  onSelect: handleCommandSelect,
                  onClose: () => setShowCommandPalette(false)
                }),
                React.createElement('textarea', {
                  ref: inputRef,
                  className: 'chat-input',
                  value: input,
                  onChange: handleInputChange,
                  onKeyDown: handleKeyDown,
                  onPaste: handlePaste,
                  placeholder: status === 'idle' ? '输入消息，可粘贴图片或点�?📎 上传文件 (输入 / 查看命令)...' : '处理�?..',
                  disabled: status !== 'idle',
                  rows: 1
                })
              ),
              React.createElement('button', {
                className: 'send-btn',
                onClick: handleSend,
                disabled: !connected || status !== 'idle' || (!input.trim() && attachments.length === 0)
              },
                status !== 'idle'
                  ? React.createElement('div', { className: 'loading-dots' },
                      React.createElement('span'),
                      React.createElement('span'),
                      React.createElement('span')
                    )
                  : '发�?
              )
            )
          )
        ),
        // 权限对话�?
        permissionRequest && React.createElement(PermissionDialog, {
          request: permissionRequest,
          onRespond: handlePermissionResponse
        }),
        // 设置面板
        showSettings && React.createElement(SettingsPanel, {
          onClose: () => setShowSettings(false),
          send: send,
          addMessageHandler: addMessageHandler
        })
      );
    }

    // 设置面板组件
    function SettingsPanel({ onClose, send, addMessageHandler }) {
      const [activeTab, setActiveTab] = useState('mcp');
      const [mcpServers, setMcpServers] = useState([]);
      const [mcpLoading, setMcpLoading] = useState(true);
      const [showAddForm, setShowAddForm] = useState(false);
      const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });

      // 系统提示词状�?
      const [promptConfig, setPromptConfig] = useState({ useDefault: true, customPrompt: '', appendPrompt: '' });
      const [promptMode, setPromptMode] = useState('default');
      const [promptText, setPromptText] = useState('');
      const [promptLoading, setPromptLoading] = useState(true);
      const [promptSaved, setPromptSaved] = useState(false);

      // 加载数据
      useEffect(() => {
        const unsubscribe = addMessageHandler((msg) => {
          if (msg.type === 'mcp_list_response') {
            setMcpServers(msg.payload.servers || []);
            setMcpLoading(false);
          } else if (msg.type === 'system_prompt_response') {
            const config = msg.payload.config || { useDefault: true };
            setPromptConfig(config);
            setPromptLoading(false);

            if (!config.useDefault && config.customPrompt) {
              setPromptMode('custom');
              setPromptText(config.customPrompt);
            } else if (config.useDefault && config.appendPrompt) {
              setPromptMode('append');
              setPromptText(config.appendPrompt);
            } else {
              setPromptMode('default');
              setPromptText('');
            }
          }
        });

        send({ type: 'mcp_list' });
        send({ type: 'system_prompt_get' });

        return unsubscribe;
      }, [send, addMessageHandler]);

      // 添加 MCP 服务�?
      const handleAddServer = () => {
        if (!newServer.name.trim() || !newServer.command.trim()) return;
        const args = newServer.args.trim() ? newServer.args.split(' ') : [];
        send({
          type: 'mcp_add',
          payload: {
            server: {
              name: newServer.name.trim(),
              type: 'stdio',
              command: newServer.command.trim(),
              args,
              enabled: true
            }
          }
        });
        setNewServer({ name: '', command: '', args: '' });
        setShowAddForm(false);
      };

      const handleToggleServer = (name) => {
        send({ type: 'mcp_toggle', payload: { name } });
      };

      const handleRemoveServer = (name) => {
        if (confirm('确定要删除此 MCP 服务器吗�?)) {
          send({ type: 'mcp_remove', payload: { name } });
        }
      };

      const handleSavePrompt = () => {
        let config = { useDefault: true, customPrompt: '', appendPrompt: '' };
        if (promptMode === 'custom') {
          config = { useDefault: false, customPrompt: promptText, appendPrompt: '' };
        } else if (promptMode === 'append') {
          config = { useDefault: true, customPrompt: '', appendPrompt: promptText };
        }
        send({ type: 'system_prompt_update', payload: { config } });
        setPromptSaved(true);
        setTimeout(() => setPromptSaved(false), 2000);
      };

      const handleResetPrompt = () => {
        const config = { useDefault: true, customPrompt: '', appendPrompt: '' };
        send({ type: 'system_prompt_update', payload: { config } });
        setPromptMode('default');
        setPromptText('');
      };

      return React.createElement('div', { className: 'settings-panel-overlay', onClick: onClose },
        React.createElement('div', { className: 'settings-panel', onClick: (e) => e.stopPropagation() },
          // 头部
          React.createElement('div', { className: 'settings-header' },
            React.createElement('h2', null, '⚙️ 设置'),
            React.createElement('button', { className: 'settings-close-btn', onClick: onClose }, '×')
          ),
          // 主体
          React.createElement('div', { className: 'settings-body' },
            // 导航
            React.createElement('div', { className: 'settings-nav' },
              React.createElement('div', {
                className: 'settings-nav-item ' + (activeTab === 'mcp' ? 'active' : ''),
                onClick: () => setActiveTab('mcp')
              }, React.createElement('span', { className: 'nav-icon' }, '🔌'), ' MCP 服务�?),
              React.createElement('div', {
                className: 'settings-nav-item ' + (activeTab === 'prompt' ? 'active' : ''),
                onClick: () => setActiveTab('prompt')
              }, React.createElement('span', { className: 'nav-icon' }, '📝'), ' 系统提示�?)
            ),
            // 内容�?
            React.createElement('div', { className: 'settings-content' },
              // MCP 管理
              activeTab === 'mcp' && React.createElement('div', { className: 'settings-section' },
                React.createElement('h3', null, '🔌 MCP 服务�?),
                React.createElement('p', null, '管理 Model Context Protocol 服务器连�?),
                mcpLoading
                  ? React.createElement('div', { className: 'empty-state' }, '加载�?..')
                  : mcpServers.length === 0
                    ? React.createElement('div', { className: 'empty-state' },
                        React.createElement('div', { className: 'empty-icon' }, '🔌'),
                        React.createElement('p', null, '暂无 MCP 服务器配�?)
                      )
                    : React.createElement('div', { className: 'mcp-server-list' },
                        mcpServers.map(server =>
                          React.createElement('div', { key: server.name, className: 'mcp-server-item' },
                            React.createElement('div', { className: 'mcp-server-info' },
                              React.createElement('div', { className: 'mcp-server-name' }, server.name),
                              React.createElement('div', { className: 'mcp-server-command' },
                                server.command + (server.args?.length ? ' ' + server.args.join(' ') : '')
                              )
                            ),
                            React.createElement('span', {
                              className: 'mcp-server-status ' + (server.enabled ? 'enabled' : 'disabled')
                            }, server.enabled ? '已启�? : '已禁�?),
                            React.createElement('div', { className: 'mcp-server-actions' },
                              React.createElement('button', {
                                onClick: () => handleToggleServer(server.name)
                              }, server.enabled ? '禁用' : '启用'),
                              React.createElement('button', {
                                className: 'danger',
                                onClick: () => handleRemoveServer(server.name)
                              }, '删除')
                            )
                          )
                        )
                      ),
                showAddForm
                  ? React.createElement('div', { className: 'mcp-add-form' },
                      React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                          React.createElement('label', null, '服务器名�?),
                          React.createElement('input', {
                            type: 'text',
                            placeholder: '例如: my-server',
                            value: newServer.name,
                            onChange: (e) => setNewServer({ ...newServer, name: e.target.value })
                          })
                        )
                      ),
                      React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                          React.createElement('label', null, '命令'),
                          React.createElement('input', {
                            type: 'text',
                            placeholder: '例如: node',
                            value: newServer.command,
                            onChange: (e) => setNewServer({ ...newServer, command: e.target.value })
                          })
                        ),
                        React.createElement('div', { className: 'form-group' },
                          React.createElement('label', null, '参数 (空格分隔)'),
                          React.createElement('input', {
                            type: 'text',
                            placeholder: '例如: /path/to/server.js',
                            value: newServer.args,
                            onChange: (e) => setNewServer({ ...newServer, args: e.target.value })
                          })
                        )
                      ),
                      React.createElement('div', { className: 'form-actions' },
                        React.createElement('button', { className: 'cancel', onClick: () => setShowAddForm(false) }, '取消'),
                        React.createElement('button', {
                          className: 'submit',
                          onClick: handleAddServer,
                          disabled: !newServer.name.trim() || !newServer.command.trim()
                        }, '添加')
                      )
                    )
                  : React.createElement('button', {
                      className: 'add-mcp-btn',
                      onClick: () => setShowAddForm(true)
                    }, '+ 添加 MCP 服务�?)
              ),
              // 系统提示词管�?
              activeTab === 'prompt' && React.createElement('div', { className: 'settings-section' },
                React.createElement('h3', null, '📝 系统提示�?),
                React.createElement('p', null, '自定�?Claude 的行为和响应风格'),
                promptLoading
                  ? React.createElement('div', { className: 'empty-state' }, '加载�?..')
                  : React.createElement('div', { className: 'prompt-editor' },
                      React.createElement('div', { className: 'prompt-mode-selector' },
                        React.createElement('button', {
                          className: 'prompt-mode-btn ' + (promptMode === 'default' ? 'active' : ''),
                          onClick: () => { setPromptMode('default'); setPromptText(''); }
                        }, '使用默认'),
                        React.createElement('button', {
                          className: 'prompt-mode-btn ' + (promptMode === 'append' ? 'active' : ''),
                          onClick: () => setPromptMode('append')
                        }, '追加内容'),
                        React.createElement('button', {
                          className: 'prompt-mode-btn ' + (promptMode === 'custom' ? 'active' : ''),
                          onClick: () => setPromptMode('custom')
                        }, '完全自定�?)
                      ),
                      promptMode !== 'default' && React.createElement('textarea', {
                        className: 'prompt-textarea',
                        placeholder: promptMode === 'append' ? '输入要追加到默认提示词后的内�?..' : '输入完全自定义的系统提示�?..',
                        value: promptText,
                        onChange: (e) => setPromptText(e.target.value)
                      }),
                      promptMode === 'default' && React.createElement('div', {
                        style: { padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', color: 'var(--text-muted)' }
                      }, '当前使用默认系统提示�?),
                      React.createElement('div', { className: 'prompt-actions' },
                        React.createElement('button', { className: 'reset', onClick: handleResetPrompt }, '重置'),
                        React.createElement('button', { className: 'save', onClick: handleSavePrompt },
                          promptSaved ? '�?已保�? : '保存'
                        )
                      )
                    )
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

// 如果直接运行此文件，启动服务�?
const isMainModule = process.argv[1]?.includes('server') ||
                     process.argv[1]?.endsWith('web.js') ||
                     process.argv[1]?.endsWith('web.ts');

if (isMainModule) {
  startWebServer().catch(console.error);
}
