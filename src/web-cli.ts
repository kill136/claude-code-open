#!/usr/bin/env node
/**
 * WebUI CLI 入口
 * 启动 Web 服务器
 */

import { Command } from 'commander';
import { startWebServer } from './web/index.js';

const program = new Command();

program
  .name('claude-web')
  .description('Claude Code WebUI 服务器')
  .version('2.0.76')
  .option('-p, --port <port>', '服务器端口', '3456')
  .option('-H, --host <host>', '服务器主机', 'localhost')
  .option('-m, --model <model>', '默认模型 (opus/sonnet/haiku)', 'sonnet')
  .option('-d, --dir <directory>', '工作目录', process.cwd())
  .action(async (options) => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🤖 Claude Code WebUI                                    ║
║                                                           ║
║   一个基于 Web 的 Claude Code 界面                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

    try {
      await startWebServer({
        port: parseInt(options.port),
        host: options.host,
        model: options.model,
        cwd: options.dir,
      });
    } catch (error) {
      console.error('启动失败:', error);
      process.exit(1);
    }
  });

program.parse();
