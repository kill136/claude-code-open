/**
 * 可视化 Web 服务器 (Express 版本)
 * 提供代码本体图谱的交互式可视化
 */

import express, { type Express, type Request, type Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { setupApiRoutes } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VisualizationServerOptions {
  ontologyPath: string;
  port?: number;
}

/**
 * 可视化服务器类
 */
export class VisualizationServer {
  private app: Express;
  private ontologyPath: string;
  private port: number;
  private server: ReturnType<Express['listen']> | null = null;

  constructor(options: VisualizationServerOptions) {
    this.ontologyPath = options.ontologyPath;
    this.port = options.port || 3000;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // JSON 解析
    this.app.use(express.json());

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 静态文件服务
    const staticDir = path.join(__dirname, 'static');
    this.app.use(express.static(staticDir));

    // API 路由
    setupApiRoutes(this.app, this.ontologyPath);

    // 首页
    this.app.get('/', (req: Request, res: Response) => {
      const indexPath = path.join(staticDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // 如果静态文件不存在，使用内嵌 HTML (向后兼容)
        res.send(this.getFallbackHtml());
      }
    });

    // 404 处理
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * 启动服务器
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`\n🌐 Visualization server running at:`);
          console.log(`   http://localhost:${this.port}\n`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取服务器地址
   */
  getAddress(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * 向后兼容：当静态文件不存在时使用的基础 HTML
   */
  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Ontology Map</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .error {
      text-align: center;
      padding: 2rem;
      background: #16213e;
      border-radius: 8px;
      max-width: 600px;
    }
    .error h1 { color: #e94560; margin-bottom: 1rem; }
    .error p { color: #888; }
    .error code {
      display: block;
      margin-top: 1rem;
      padding: 0.5rem;
      background: #0f3460;
      border-radius: 4px;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>⚠️ 静态资源未找到</h1>
    <p>请确保 static 目录中包含 index.html、styles.css 和 app.js 文件。</p>
    <code>src/map/server/static/</code>
  </div>
</body>
</html>`;
  }
}

/**
 * 导出便捷函数
 */
export async function startVisualizationServer(
  ontologyPath: string,
  port: number = 3000
): Promise<VisualizationServer> {
  const server = new VisualizationServer({ ontologyPath, port });
  await server.start();
  return server;
}
