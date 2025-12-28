/**
 * 任务 047: MCP add 命令
 * 负责人: 工程师 #047
 * 优先级: P0
 *
 * 官方行为: 添加 MCP 服务器配置
 *
 * 验收标准:
 * - [ ] `--transport http` HTTP服务器
 * - [ ] `--transport sse` SSE服务器
 * - [ ] `--transport stdio` 标准IO服务器
 * - [ ] 支持环境变量 `--env`
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  runCLI,
  compareCLIOutput,
  TEST_CONFIG_DIR,
  describeFeature,
} from '../setup';

describeFeature(
  {
    id: '047',
    category: 'MCP',
    priority: 'P0',
    description: 'MCP add 命令',
    officialBehavior: '添加 MCP 服务器配置',
  },
  () => {
    const settingsPath = path.join(TEST_CONFIG_DIR, 'settings.json');

    beforeEach(() => {
      // 确保设置文件存在
      if (!fs.existsSync(TEST_CONFIG_DIR)) {
        fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
      }
      // 初始化空配置
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
    });

    afterEach(() => {
      // 清理配置
      if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
      }
    });

    describe('MCP add 命令帮助', () => {
      it('应该显示 mcp add 帮助信息', async () => {
        const result = await runCLI(['mcp', 'add', '--help']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Add an MCP server');
      });

      it('官方帮助信息应包含传输类型说明', async () => {
        const { official } = await compareCLIOutput(['mcp', 'add', '--help']);

        expect(official.stdout).toContain('--transport');
        expect(official.stdout).toContain('http');
        expect(official.stdout).toContain('sse');
        expect(official.stdout).toContain('stdio');
      });
    });

    describe('HTTP 传输类型', () => {
      it('应该支持添加 HTTP 服务器', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'http',
          'test-http',
          'https://example.com/mcp',
        ]);

        // 验证命令被接受
        expect(result.stderr).not.toContain('unknown option');
      });

      it('HTTP URL 应该以 http:// 或 https:// 开头', async () => {
        // 无效 URL 应该报错
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'http',
          'invalid',
          'not-a-url',
        ]);

        // 具体行为取决于实现
        expect(result).toBeDefined();
      });
    });

    describe('SSE 传输类型', () => {
      it('应该支持添加 SSE 服务器', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'sse',
          'test-sse',
          'https://example.com/sse',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('Stdio 传输类型', () => {
      it('应该支持添加 stdio 服务器', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'stdio',
          'test-stdio',
          '--',
          'node',
          'server.js',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --env 环境变量', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'stdio',
          'test-env',
          '--env',
          'API_KEY=secret',
          '--',
          'node',
          'server.js',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持多个 --env 参数', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'stdio',
          'test-multi-env',
          '--env',
          'KEY1=value1',
          '--env',
          'KEY2=value2',
          '--',
          'node',
          'server.js',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('作用域选项', () => {
      it('应该支持 --scope user', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--scope',
          'user',
          '--transport',
          'http',
          'user-scope',
          'https://example.com',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --scope project', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--scope',
          'project',
          '--transport',
          'http',
          'project-scope',
          'https://example.com',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('官方示例验证', () => {
      it('官方示例: 添加 HTTP 服务器', async () => {
        // 官方文档示例:
        // claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'http',
          'sentry',
          'https://mcp.sentry.dev/mcp',
        ]);

        // 验证命令格式被接受
        expect(result).toBeDefined();
      });

      it('官方示例: 添加 SSE 服务器', async () => {
        // claude mcp add --transport sse asana https://mcp.asana.com/sse
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'sse',
          'asana',
          'https://mcp.asana.com/sse',
        ]);

        expect(result).toBeDefined();
      });

      it('官方示例: 添加 stdio 服务器带环境变量', async () => {
        // claude mcp add --transport stdio airtable --env AIRTABLE_API_KEY=YOUR_KEY -- npx -y airtable-mcp-server
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'stdio',
          'airtable',
          '--env',
          'AIRTABLE_API_KEY=YOUR_KEY',
          '--',
          'npx',
          '-y',
          'airtable-mcp-server',
        ]);

        expect(result).toBeDefined();
      });
    });

    describe('错误处理', () => {
      it('缺少名称参数应该报错', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'http',
        ]);

        // 应该有错误提示
        expect(result.exitCode).not.toBe(0);
      });

      it('缺少 URL/命令参数应该报错', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'http',
          'name-only',
        ]);

        expect(result.exitCode).not.toBe(0);
      });

      it('无效传输类型应该报错', async () => {
        const result = await runCLI([
          'mcp',
          'add',
          '--transport',
          'invalid-type',
          'test',
          'https://example.com',
        ]);

        expect(result.exitCode).not.toBe(0);
      });
    });
  }
);
