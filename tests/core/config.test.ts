/**
 * ConfigManager 测试（核心版本）
 * 测试配置加载、验证、合并和迁移功能
 */

import { ConfigManager, type UserConfig } from '../../src/config/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 测试配置目录
const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'claude-test-config-core');
const TEST_GLOBAL_CONFIG = path.join(TEST_CONFIG_DIR, 'settings.json');
const TEST_PROJECT_DIR = path.join(os.tmpdir(), 'claude-test-project-core');
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
      if ((error as Error).stack) {
        console.error(`  堆栈: ${(error as Error).stack?.split('\n').slice(1, 3).join('\n')}`);
      }
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

function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${message}\n  值为: ${value}`);
  }
}

// ============ 初始化测试 ============

const initTests = [
  test('应该使用默认配置初始化', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.version, '2.0.76', '版本号应为 2.0.76');
    assertEqual(config.model, 'sonnet', '默认模型应为 sonnet');
    assertEqual(config.maxTokens, 8192, '默认最大令牌数应为 8192');
    assertEqual(config.temperature, 1, '默认温度应为 1');
    assertEqual(config.theme, 'auto', '默认主题应为 auto');
    assertEqual(config.verbose, false, '默认 verbose 应为 false');
    assertEqual(config.enableTelemetry, false, '默认遥测应为 false');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该创建配置目录', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    cleanup();
    const manager = new ConfigManager();
    manager.save();

    assert(fs.existsSync(TEST_CONFIG_DIR), '配置目录应该被创建');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),
];

// ============ 配置加载测试 ============

const loadTests = [
  test('应该从全局配置文件加载', () => {
    setup();

    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        model: 'opus',
        maxTokens: 16384,
        verbose: true,
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.model, 'opus', '应该加载全局配置的 model');
    assertEqual(config.maxTokens, 16384, '应该加载全局配置的 maxTokens');
    assertEqual(config.verbose, true, '应该加载全局配置的 verbose');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),

  test('应该处理不存在的配置文件', () => {
    setup();

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    // 应该使用默认值
    assertEqual(config.model, 'sonnet', '不存在配置时应使用默认值');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),

  test('应该处理损坏的配置文件', () => {
    setup();

    fs.writeFileSync(TEST_GLOBAL_CONFIG, 'invalid json content {{{');

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    // 应该降级为默认值
    assertEqual(config.model, 'sonnet', '损坏的配置应降级为默认值');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),
];

// ============ 配置合并测试 ============

const mergeTests = [
  test('项目配置应该覆盖全局配置', () => {
    setup();

    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({ model: 'sonnet', maxTokens: 8192 })
    );

    fs.writeFileSync(
      TEST_PROJECT_CONFIG,
      JSON.stringify({ model: 'opus', verbose: true })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    const originalCwd = process.cwd();

    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;
    process.chdir(TEST_PROJECT_DIR);

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.model, 'opus', '项目配置应覆盖全局配置');
    assertEqual(config.maxTokens, 8192, '未被覆盖的值应保留');
    assertEqual(config.verbose, true, '项目配置的新值应生效');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    process.chdir(originalCwd);
    cleanup();
  }),

  test('环境变量应该覆盖配置文件', () => {
    setup();

    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({ maxTokens: 8192 })
    );

    const originalEnv = {
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,
    };

    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = '32768';

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.maxTokens, 32768, '环境变量应覆盖配置文件');

    process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = originalEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
    cleanup();
  }),
];

// ============ 配置保存测试 ============

const saveTests = [
  test('应该保存配置到全局文件', () => {
    setup();

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    manager.set('model', 'opus');
    manager.set('maxTokens', 16384);
    manager.save();

    assert(fs.existsSync(TEST_GLOBAL_CONFIG), '配置文件应该存在');

    const saved = JSON.parse(fs.readFileSync(TEST_GLOBAL_CONFIG, 'utf-8'));
    assertEqual(saved.model, 'opus', '保存的配置应该正确');
    assertEqual(saved.maxTokens, 16384, '保存的配置应该正确');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),

  test('应该保存项目配置', () => {
    setup();

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    const originalCwd = process.cwd();

    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;
    process.chdir(TEST_PROJECT_DIR);

    const manager = new ConfigManager();
    manager.saveProject({ model: 'opus', verbose: true });

    assert(fs.existsSync(TEST_PROJECT_CONFIG), '项目配置文件应该存在');

    const saved = JSON.parse(fs.readFileSync(TEST_PROJECT_CONFIG, 'utf-8'));
    assertEqual(saved.model, 'opus', '保存的项目配置应该正确');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    process.chdir(originalCwd);
    cleanup();
  }),
];

// ============ 配置验证测试 ============

const validationTests = [
  test('应该验证有效配置', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const validation = manager.validate();

    assertEqual(validation.valid, true, '默认配置应该有效');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该拦截无效的 maxTokens', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    try {
      // @ts-expect-error - 故意使用无效值
      manager.set('maxTokens', -1000);
      throw new Error('应该抛出验证错误');
    } catch (error) {
      assert(
        (error as Error).message.includes('positive') ||
        (error as Error).message.includes('greater than 0'),
        '应该提示数字必须为正数'
      );
    }

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该拦截无效的模型名称', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    try {
      // @ts-expect-error - 故意使用无效值
      manager.set('model', 'invalid-model');
      throw new Error('应该抛出验证错误');
    } catch (error) {
      assert(
        (error as Error).message.includes('Invalid enum value'),
        '应该提示无效的枚举值'
      );
    }

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),
];

// ============ 配置迁移测试 ============

const migrationTests = [
  test('应该迁移旧版本配置', () => {
    setup();

    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        model: 'claude-3-opus',
        autoSave: true,
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.model, 'opus', '旧模型名应该被迁移');
    assertEqual(config.enableAutoSave, true, 'autoSave 应该迁移为 enableAutoSave');
    assertEqual(config.version, '2.0.76', '版本号应该更新');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),

  test('应该迁移多个旧字段', () => {
    setup();

    fs.writeFileSync(
      TEST_GLOBAL_CONFIG,
      JSON.stringify({
        version: '1.0.0',
        model: 'claude-3-sonnet',
        autoSave: false,
      })
    );

    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    const config = manager.getAll();

    assertEqual(config.model, 'sonnet', '所有旧模型名都应该被迁移');
    assertEqual(config.enableAutoSave, false, 'autoSave 应该正确迁移');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    cleanup();
  }),
];

// ============ 配置导入导出测试 ============

const importExportTests = [
  test('应该导出配置（掩码敏感信息）', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    manager.set('apiKey', 'sk-ant-1234567890abcdef');

    const exported = manager.export(true);
    const config = JSON.parse(exported);

    assert(config.apiKey.includes('***'), 'API 密钥应该被掩码');
    assert(config.apiKey !== 'sk-ant-1234567890abcdef', 'API 密钥不应该明文导出');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该导出配置（不掩码）', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();
    manager.set('apiKey', 'sk-ant-1234567890abcdef');

    const exported = manager.export(false);
    const config = JSON.parse(exported);

    assertEqual(config.apiKey, 'sk-ant-1234567890abcdef', '不掩码时应该导出原始值');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该导入有效配置', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    const configJson = JSON.stringify({
      version: '2.0.76',
      model: 'opus',
      maxTokens: 16384,
    });

    const result = manager.import(configJson);
    assertEqual(result, true, '导入应该成功');

    const config = manager.getAll();
    assertEqual(config.model, 'opus', '导入的配置应该生效');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该拒绝无效配置', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    const invalidJson = JSON.stringify({
      model: 'invalid-model',
      maxTokens: -1000,
    });

    const result = manager.import(invalidJson);
    assertEqual(result, false, '无效配置应该被拒绝');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),
];

// ============ MCP 服务器管理测试 ============

const mcpTests = [
  test('应该添加 MCP 服务器', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    manager.addMcpServer('fs', {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    });

    const servers = manager.getMcpServers();
    assert('fs' in servers, 'MCP 服务器应该被添加');
    assertEqual(servers.fs.type, 'stdio', '服务器类型应该正确');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该验证 MCP 服务器配置', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    try {
      manager.addMcpServer('invalid', {
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

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该删除 MCP 服务器', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    manager.addMcpServer('test', {
      type: 'http',
      url: 'http://localhost:3000',
    });

    const result = manager.removeMcpServer('test');
    assertEqual(result, true, '删除应该成功');

    const servers = manager.getMcpServers();
    assert(!('test' in servers), 'MCP 服务器应该被删除');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),

  test('应该更新 MCP 服务器', () => {
    const originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = TEST_CONFIG_DIR;

    const manager = new ConfigManager();

    manager.addMcpServer('test', {
      type: 'http',
      url: 'http://localhost:3000',
    });

    const result = manager.updateMcpServer('test', {
      url: 'http://localhost:4000',
    });

    assertEqual(result, true, '更新应该成功');

    const servers = manager.getMcpServers();
    assertEqual(servers.test.url, 'http://localhost:4000', 'URL 应该被更新');

    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  }),
];

// ============ 运行测试 ============

async function runTests() {
  console.log('运行 ConfigManager（核心）测试...\n');

  const allTests = [
    ...initTests,
    ...loadTests,
    ...mergeTests,
    ...saveTests,
    ...validationTests,
    ...migrationTests,
    ...importExportTests,
    ...mcpTests,
  ];

  for (const testFn of allTests) {
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
