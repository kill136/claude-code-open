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

  // ============ 会话管理API ============

  // 获取会话列表
  app.get('/api/sessions', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const search = req.query.search as string | undefined;

      const sessions = conversationManager.listPersistedSessions({
        limit,
        offset,
        search,
      });

      res.json({
        sessions,
        total: sessions.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('[API] 获取会话列表失败:', error);
      res.status(500).json({
        error: '获取会话列表失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 获取特定会话详情
  app.get('/api/sessions/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sessionManager = conversationManager.getSessionManager();
      const session = sessionManager.loadSessionById(id);

      if (!session) {
        res.status(404).json({
          error: '会话不存在',
          sessionId: id,
        });
        return;
      }

      res.json({
        session: {
          id: session.metadata.id,
          name: session.metadata.name,
          createdAt: session.metadata.createdAt,
          updatedAt: session.metadata.updatedAt,
          messageCount: session.metadata.messageCount,
          model: session.metadata.model,
          cost: session.metadata.cost,
          tokenUsage: session.metadata.tokenUsage,
          tags: session.metadata.tags,
          workingDirectory: session.metadata.workingDirectory,
        },
        messages: session.chatHistory || [],
      });
    } catch (error) {
      console.error('[API] 获取会话详情失败:', error);
      res.status(500).json({
        error: '获取会话详情失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 删除会话
  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = conversationManager.deletePersistedSession(id);

      if (success) {
        res.json({
          success: true,
          sessionId: id,
          message: '会话已删除',
        });
      } else {
        res.status(404).json({
          success: false,
          sessionId: id,
          error: '会话不存在',
        });
      }
    } catch (error) {
      console.error('[API] 删除会话失败:', error);
      res.status(500).json({
        success: false,
        error: '删除会话失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 重命名会话
  app.patch('/api/sessions/:id/rename', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          error: '无效的会话名称',
        });
        return;
      }

      const success = conversationManager.renamePersistedSession(id, name);

      if (success) {
        res.json({
          success: true,
          sessionId: id,
          name,
          message: '会话已重命名',
        });
      } else {
        res.status(404).json({
          success: false,
          error: '会话不存在',
        });
      }
    } catch (error) {
      console.error('[API] 重命名会话失败:', error);
      res.status(500).json({
        success: false,
        error: '重命名会话失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 导出会话
  app.get('/api/sessions/:id/export', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const format = (req.query.format as 'json' | 'md') || 'json';

      const content = conversationManager.exportPersistedSession(id, format);

      if (!content) {
        res.status(404).json({
          error: '会话不存在或导出失败',
        });
        return;
      }

      // 设置响应头
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="session-${id}.json"`);
      } else {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="session-${id}.md"`);
      }

      res.send(content);
    } catch (error) {
      console.error('[API] 导出会话失败:', error);
      res.status(500).json({
        error: '导出会话失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 恢复会话
  app.post('/api/sessions/:id/resume', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await conversationManager.resumeSession(id);

      if (success) {
        const history = conversationManager.getHistory(id);
        res.json({
          success: true,
          sessionId: id,
          message: '会话已恢复',
          history,
        });
      } else {
        res.status(404).json({
          success: false,
          error: '会话不存在',
        });
      }
    } catch (error) {
      console.error('[API] 恢复会话失败:', error);
      res.status(500).json({
        success: false,
        error: '恢复会话失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // ============ 工具过滤配置API ============

  // 获取工具过滤配置
  app.get('/api/tools/config', (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).json({
          error: '缺少 sessionId 参数',
        });
        return;
      }

      const tools = conversationManager.getAvailableTools(sessionId);
      const config = conversationManager.getToolFilterConfig(sessionId);

      res.json({
        config,
        tools,
      });
    } catch (error) {
      console.error('[API] 获取工具过滤配置失败:', error);
      res.status(500).json({
        error: '获取工具过滤配置失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 更新工具过滤配置
  app.put('/api/tools/config', (req: Request, res: Response) => {
    try {
      const { sessionId, config } = req.body;

      if (!sessionId) {
        res.status(400).json({
          error: '缺少 sessionId',
        });
        return;
      }

      if (!config || !config.mode) {
        res.status(400).json({
          error: '无效的工具过滤配置',
        });
        return;
      }

      conversationManager.updateToolFilter(sessionId, config);

      res.json({
        success: true,
        config,
      });
    } catch (error) {
      console.error('[API] 更新工具过滤配置失败:', error);
      res.status(500).json({
        success: false,
        error: '更新工具过滤配置失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 获取当前可用工具列表
  app.get('/api/tools/available', (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).json({
          error: '缺少 sessionId 参数',
        });
        return;
      }

      const tools = conversationManager.getAvailableTools(sessionId);

      // 按分类分组
      const byCategory: Record<string, any[]> = {};
      for (const tool of tools) {
        if (!byCategory[tool.category]) {
          byCategory[tool.category] = [];
        }
        byCategory[tool.category].push(tool);
      }

      res.json({
        tools,
        byCategory,
        total: tools.length,
        enabled: tools.filter(t => t.enabled).length,
        disabled: tools.filter(t => !t.enabled).length,
      });
    } catch (error) {
      console.error('[API] 获取可用工具列表失败:', error);
      res.status(500).json({
        error: '获取可用工具列表失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // ============ 系统提示API ============

  // 获取当前系统提示
  app.get('/api/system-prompt', async (req: Request, res: Response) => {
    try {
      // 获取当前会话ID（假设从查询参数或默认会话）
      const sessionId = (req.query.sessionId as string) || 'default';

      const result = await conversationManager.getSystemPrompt(sessionId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[API] 获取系统提示失败:', error);
      res.status(500).json({
        success: false,
        error: '获取系统提示失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 更新系统提示配置
  app.put('/api/system-prompt', async (req: Request, res: Response) => {
    try {
      const { config, sessionId } = req.body;

      if (!config || typeof config !== 'object') {
        res.status(400).json({
          success: false,
          error: '无效的配置',
        });
        return;
      }

      const targetSessionId = sessionId || 'default';
      const success = conversationManager.updateSystemPrompt(targetSessionId, config);

      if (success) {
        const result = await conversationManager.getSystemPrompt(targetSessionId);
        res.json({
          success: true,
          message: '系统提示已更新',
          ...result,
        });
      } else {
        res.status(404).json({
          success: false,
          error: '会话不存在',
        });
      }
    } catch (error) {
      console.error('[API] 更新系统提示失败:', error);
      res.status(500).json({
        success: false,
        error: '更新系统提示失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  });

  // 注意：Express 5 不再支持 /api/* 这样的通配符路由
  // 404 处理将由主路由的 SPA fallback 处理
}
