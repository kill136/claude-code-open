/**
 * API 路由
 * 处理所有 /api/* 请求
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import { EnhancedCodeBlueprint } from '../../types-enhanced.js';
import {
  buildArchitectureMap,
  getModuleDetail,
  getSymbolRefs,
} from '../services/architecture.js';
import {
  detectEntryPoints,
  buildDependencyTree,
} from '../services/dependency.js';

/**
 * 检查是否为增强格式
 */
function isEnhancedFormat(data: any): data is EnhancedCodeBlueprint {
  return data && data.format === 'enhanced' && data.modules && data.references;
}

/**
 * 加载蓝图数据
 */
function loadBlueprint(ontologyPath: string): any {
  const content = fs.readFileSync(ontologyPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 设置 API 路由
 */
export function setupApiRoutes(app: Express, ontologyPath: string): void {
  // 获取本体数据
  app.get('/api/ontology', (req: Request, res: Response) => {
    try {
      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        res.json({
          isEnhanced: true,
          project: data.project,
          modules: data.modules,
          references: data.references,
        });
      } else {
        res.json({
          isEnhanced: false,
          ...data,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 获取架构图数据
  app.get('/api/architecture', (req: Request, res: Response) => {
    try {
      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        const archMap = buildArchitectureMap(data);
        res.json(archMap);
      } else {
        res.status(400).json({ error: 'Architecture requires enhanced format' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 获取入口点列表
  app.get('/api/entry-points', (req: Request, res: Response) => {
    try {
      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        const entries = detectEntryPoints(data);
        res.json({ entryPoints: entries });
      } else {
        res.status(400).json({ error: 'Entry points requires enhanced format' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 获取依赖树
  app.get('/api/dependency-tree', (req: Request, res: Response) => {
    try {
      const entryId = req.query.entry as string || '';
      const maxDepth = parseInt(req.query.depth as string || '10', 10);

      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        const tree = buildDependencyTree(data, entryId, maxDepth);
        if (tree) {
          res.json(tree);
        } else {
          res.status(404).json({ error: 'Entry module not found' });
        }
      } else {
        res.status(400).json({ error: 'Dependency tree requires enhanced format' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 获取模块详情 (使用查询参数)
  app.get('/api/module-detail', (req: Request, res: Response) => {
    try {
      const moduleId = req.query.id as string;
      if (!moduleId) {
        res.status(400).json({ error: 'Missing id parameter' });
        return;
      }

      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        const detail = getModuleDetail(data, moduleId);
        if (detail) {
          res.json(detail);
        } else {
          res.status(404).json({ error: 'Module not found' });
        }
      } else {
        res.status(400).json({ error: 'Module detail requires enhanced format' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 获取符号引用 (使用查询参数)
  app.get('/api/symbol-refs', (req: Request, res: Response) => {
    try {
      const symbolId = req.query.id as string;
      if (!symbolId) {
        res.status(400).json({ error: 'Missing id parameter' });
        return;
      }

      const data = loadBlueprint(ontologyPath);

      if (isEnhancedFormat(data)) {
        const refs = getSymbolRefs(data, symbolId);
        if (refs) {
          res.json(refs);
        } else {
          res.status(404).json({ error: 'Symbol not found' });
        }
      } else {
        res.status(400).json({ error: 'Symbol refs requires enhanced format' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 代码预览
  app.get('/api/code-preview', (req: Request, res: Response) => {
    try {
      const moduleId = req.query.module as string || '';
      const startLine = parseInt(req.query.start as string || '1', 10);
      const endLine = parseInt(req.query.end as string || '0', 10);

      if (!moduleId) {
        res.status(400).json({ error: 'Missing module parameter' });
        return;
      }

      const data = loadBlueprint(ontologyPath);

      if (!isEnhancedFormat(data)) {
        res.status(400).json({ error: 'Code preview requires enhanced format' });
        return;
      }

      const module = data.modules[moduleId];
      if (!module) {
        res.status(404).json({ error: 'Module not found: ' + moduleId });
        return;
      }

      const filePath = module.path;
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Source file not found: ' + filePath });
        return;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      const actualEndLine = endLine > 0 ? Math.min(endLine, lines.length) : lines.length;
      const actualStartLine = Math.max(1, startLine);

      const codeLines = lines.slice(actualStartLine - 1, actualEndLine).map((content, index) => ({
        number: actualStartLine + index,
        content,
      }));

      // 获取模块相关的符号
      const moduleSymbols = Object.values(data.symbols || {})
        .filter(s => s.moduleId === moduleId);

      res.json({
        moduleId,
        fileName: module.name,
        filePath: module.path,
        language: module.language,
        totalLines: lines.length,
        startLine: actualStartLine,
        endLine: actualEndLine,
        lines: codeLines,
        semantic: module.semantic,
        symbols: moduleSymbols,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // 搜索
  app.get('/api/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string || '').toLowerCase();

      if (!query) {
        res.json({ results: [] });
        return;
      }

      const data = loadBlueprint(ontologyPath);
      const results: any[] = [];

      if (isEnhancedFormat(data)) {
        for (const mod of Object.values(data.modules)) {
          // 搜索模块名
          if (mod.name.toLowerCase().includes(query) || mod.id.toLowerCase().includes(query)) {
            results.push({
              type: 'module',
              id: mod.id,
              name: mod.name,
              description: mod.semantic?.description || '',
            });
          }

        }

        // 搜索全局符号表
        for (const symbol of Object.values(data.symbols || {})) {
          if (symbol.name.toLowerCase().includes(query)) {
            results.push({
              type: symbol.kind,
              id: symbol.id,
              name: symbol.name,
              moduleId: symbol.moduleId,
              description: symbol.semantic?.description || '',
            });
          }
        }
      }

      res.json({ results: results.slice(0, 50) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // TODO: 添加更多 API 路由
  // - /api/scenarios
  // - /api/flowchart
  // - /api/beginner-guide
  // - /api/story-guide
  // - /api/reading-guide
  // - /api/smart-hover
}
