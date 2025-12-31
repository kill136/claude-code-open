/**
 * REST API 路由
 */

import type { Express, Request, Response } from 'express';
import type { ConversationManager } from '../conversation.js';
import { toolRegistry } from '../../../tools/index.js';

export function setupApiRoutes(app: Express, conversationManager: ConversationManager): void {
  // 健康检查
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      version: '2.0.76',
    });
  });

  // 获取可用工具列表
  app.get('/api/tools', (req: Request, res: Response) => {
    const tools = toolRegistry.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.getInputSchema(),
    }));

    res.json({
      count: tools.length,
      tools,
    });
  });

  // 获取模型列表
  app.get('/api/models', (req: Request, res: Response) => {
    res.json({
      models: [
        {
          id: 'opus',
          name: 'Claude Opus',
          description: '最强大的模型，适合复杂任务',
          modelId: 'claude-opus-4-20250514',
        },
        {
          id: 'sonnet',
          name: 'Claude Sonnet',
          description: '平衡性能和速度',
          modelId: 'claude-sonnet-4-20250514',
        },
        {
          id: 'haiku',
          name: 'Claude Haiku',
          description: '最快速的模型',
          modelId: 'claude-3-5-haiku-20241022',
        },
      ],
    });
  });

  // 获取会话信息
  app.get('/api/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const history = conversationManager.getHistory(sessionId);

    res.json({
      sessionId,
      messageCount: history.length,
      history,
    });
  });

  // 清除会话
  app.delete('/api/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    conversationManager.clearHistory(sessionId);

    res.json({
      success: true,
      message: '会话已清除',
    });
  });

  // 获取工作目录信息
  app.get('/api/cwd', (req: Request, res: Response) => {
    res.json({
      cwd: process.cwd(),
    });
  });

  // 注意：Express 5 不再支持 /api/* 这样的通配符路由
  // 404 处理将由主路由的 SPA fallback 处理
}
