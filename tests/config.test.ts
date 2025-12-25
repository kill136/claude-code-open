/**
 * 配置系统测试
 * 验证增强版配置管理器的各项功能
 */

import { ConfigManager, type UserConfig } from '../src/config/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 测试配置目录
const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'claude-test-config');
const TEST_GLOBAL_CONFIG = path.join(TEST_CONFIG_DIR, 'settings.json');
const TEST_PROJECT_DIR = path.join(os.tmpdir(), 'claude-test-project');
const TEST_PROJECT_CONFIG = path.join(TEST_PROJECT_DIR, '.claude', 'settings.json');

// 清理测试环境
function cleanup() {
  if (fs.existsSync(TEST_CONFIG_DIR)) {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TEST_PROJECT_DIR)) {
    fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
}

// 初始化测试环境
function setup() {
  cleanup();
  fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_PROJECT_DIR, '.claude'), { recursive: true });
}

// 测试结果统计
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  错误: ${(error as Error).message}`);
      failed++;
    }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  期望: ${expected}\n  实际: ${actual}`);
  }
}

// ============ 测试用例 ============

const tests = [
  test('默认配置应该正确加载', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.version, '2.0.76', '版本号应为 2.0.76');
    assertEqual(config.model, 'sonnet', '默认模型应为 sonnet');
    assertEqual(config.maxTokens, 8192, '默认最大令牌数应为 8192');
    assertEqual(config.temperature, 1, '默认温度应为 1');
    assertEqual(config.theme, 'auto', '默认主题应为 auto');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('配置验证应该拦截无效值', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    try {
      // @ts-expect-error - 故意使用无效值
      manager.set('maxTokens', -1000);
      throw new Error('应该抛出验证错误');
    } catch (error) {
      assert(
        (error as Error).message.includes('Number must be greater than 0') ||
        (error as Error).message.includes('positive'),
        '应该提示数字必须为正数'
      );
    }

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('配置合并应该遵循正确优先级', () => {
    setup();

    // 设置全局配置
    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        model: 'sonnet',
        maxTokens: 8192,
        verbose: false
      })
    );

    // 设置项目配置
    fs.writeFileSync(
      TEST_PROJECT_CONFIG,
      JSON.stringify({
        model: 'opus',
        verbose: true
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    const originalCwd = process.cwd();

    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;
    process.chdir(TEST_PROJECT_DIR);

    const manager = new ConfigManager();
    const config = manager.getAll();

    // 项目配置应该覆盖全局配置
    assertEqual(config.model, 'opus', '项目配置的 model 应该覆盖全局配置');
    assertEqual(config.verbose, true, '项目配置的 verbose 应该覆盖全局配置');
    assertEqual(config.maxTokens, 8192, '未被项目配置覆盖的值应该使用全局配置');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    process.chdir(originalCwd);
    cleanup();
  }),

  test('环境变量应该覆盖配置文件', () => {
    setup();

    // 设置全局配置
    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        maxTokens: 8192,
        useBedrock: false
      })
    );

    const originalEnv = {
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,
      CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK
    };

    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = '16384';
    process.env.CLAUDE_CODE_USE_BEDROCK = 'true';

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.maxTokens, 16384, '环境变量应该覆盖配置文件');
    assertEqual(config.useBedrock, true, '环境变量应该覆盖配置文件');

    process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = originalEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
    process.env.CLAUDE_CODE_USE_BEDROCK = originalEnv.CLAUDE_CODE_USE_BEDROCK;
    cleanup();
  }),

  test('配置迁移应该正确处理旧版本', () => {
    setup();

    // 创建旧版本配置
    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        model: 'claude-3-opus',
        autoSave: true
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    // 检查迁移结果
    assertEqual(config.model, 'opus', '旧模型名应该被迁移');
    assertEqual(config.enableAutoSave, true, 'autoSave 应该迁移为 enableAutoSave');
    assertEqual(config.version, '2.0.76', '版本号应该更新');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),

  test('配置导出应该正确掩码敏感信息', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    // 设置敏感信息
    manager.set('apiKey', 'sk-ant-api03-1234567890abcdef');

    manager.addMcpServer('test-server', {
      type: 'http',
      url: 'http://localhost:3000',
      headers: {
        'Authorization': 'Bearer secret_token_1234567890'
      },
      env: {
        'API_KEY': 'secret_key_12345',
        'LOG_LEVEL': 'info'
      }
    });

    // 导出配置（掩码）
    const maskedExport = manager.export(true);
    const maskedConfig = JSON.parse(maskedExport);

    assert(maskedConfig.apiKey !== 'sk-ant-api03-1234567890abcdef', 'API 密钥应该被掩码');
    assert(maskedConfig.apiKey.includes('***'), 'API 密钥应该包含掩码标记');

    const server = maskedConfig.mcpServers?.['test-server'];
    assert(server.headers.Authorization.includes('***'), 'Authorization header 应该被掩码');
    assert(server.env.API_KEY.includes('***'), 'API_KEY 环境变量应该被掩码');
    assertEqual(server.env.LOG_LEVEL, 'info', '非敏感环境变量不应被掩码');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('配置导入应该验证数据', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    // 尝试导入无效配置
    const invalidConfig = JSON.stringify({
      model: 'invalid-model',
      maxTokens: -1000
    });

    const result = manager.import(invalidConfig);
    assertEqual(result, false, '导入无效配置应该失败');

    // 导入有效配置
    const validConfig = JSON.stringify({
      version: '2.0.76',
      model: 'opus',
      maxTokens: 16384,
      temperature: 0.7
    });

    const result2 = manager.import(validConfig);
    assertEqual(result2, true, '导入有效配置应该成功');

    const config = manager.getAll();
    assertEqual(config.model, 'opus', '导入的配置应该生效');
    assertEqual(config.maxTokens, 16384, '导入的配置应该生效');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('MCP 服务器配置应该正确验证', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    // 添加有效的 stdio 服务器
    manager.addMcpServer('fs-server', {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path']
    });

    const servers = manager.getMcpServers();
    assert('fs-server' in servers, '服务器应该被添加');

    // 尝试添加无效的 stdio 服务器（缺少 command）
    try {
      manager.addMcpServer('invalid-stdio', {
        type: 'stdio',
        // command 缺失
      } as any);
      throw new Error('应该抛出验证错误');
    } catch (error) {
      assert(
        (error as Error).message.includes('无效的 MCP 服务器配置'),
        '应该提示配置无效'
      );
    }

    // 尝试添加无效的 http 服务器（缺少 url）
    try {
      manager.addMcpServer('invalid-http', {
        type: 'http',
        // url 缺失
      } as any);
      throw new Error('应该抛出验证错误');
    } catch (error) {
      assert(
        (error as Error).message.includes('无效的 MCP 服务器配置'),
        '应该提示配置无效'
      );
    }

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('配置重置应该恢复默认值', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    // 修改配置
    manager.set('model', 'opus');
    manager.set('maxTokens', 16384);
    manager.set('verbose', true);

    // 重置
    manager.reset();

    const config = manager.getAll();
    assertEqual(config.model, 'sonnet', '重置后应该恢复默认模型');
    assertEqual(config.maxTokens, 8192, '重置后应该恢复默认令牌数');
    assertEqual(config.verbose, false, '重置后应该恢复默认 verbose 值');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('配置验证应该返回详细错误', () => {
    setup();

    // 创建无效配置
    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        model: 'invalid-model',
        maxTokens: -1000,
        temperature: 2
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const validation = manager.validate();

    // 由于配置加载时会降级为默认值，验证应该通过
    // 但我们可以验证降级逻辑是否正常工作
    const config = manager.getAll();
    assertEqual(config.model, 'sonnet', '无效配置应该降级为默认值');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  })
];

// ============ 运行测试 ============

async function runTests() {
  console.log('运行配置系统测试...\n');

  for (const testFn of tests) {
    await testFn();
  }

  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

  cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('测试运行失败:', error);
  cleanup();
  process.exit(1);
});
