/**
 * 可视化服务器模块入口
 *
 * 重构后的模块结构：
 * - server.ts: Express 服务器实现
 * - types.ts: 类型定义
 * - routes/api.ts: API 路由处理
 * - services/: 业务逻辑服务
 * - static/: 前端静态资源 (HTML/CSS/JS)
 */

export { VisualizationServer, startVisualizationServer } from './server.js';
export type { VisualizationServerOptions } from './server.js';
export * from './types.js';
