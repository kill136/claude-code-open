/**
 * Claude Code - 主入口
 * 导出所有模块
 */

// 核心模块
export * from './core/index.js';

// 工具系统
export * from './tools/index.js';

// 类型定义
export * from './types/index.js';

// 配置
export * from './config/index.js';

// Hooks 系统
export * from './hooks/index.js';

// 认证系统
export * from './auth/index.js';

// 会话管理
export * from './session/index.js';

// 上下文管理
export * from './context/index.js';

// 代码解析器
export * from './parser/index.js';

// Ripgrep 搜索
export * from './search/ripgrep.js';

// 遥测/分析
export * from './telemetry/index.js';

// 工具函数
export * from './utils/index.js';

// 版本信息
export const VERSION = '1.0.0';
export const NAME = 'claude-code';
