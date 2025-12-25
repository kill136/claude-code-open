/**
 * 配置系统使用示例
 * 演示增强版配置管理器的各种功能
 */

import { configManager, type UserConfig } from '../src/config/index.js';

// ============ 示例 1: 基本配置操作 ============

function basicConfigExample() {
  console.log('\n=== 示例 1: 基本配置操作 ===\n');

  // 获取配置项
  const model = configManager.get('model');
  const maxTokens = configManager.get('maxTokens');
  const theme = configManager.get('theme');

  console.log('当前配置:');
  console.log(`- 模型: ${model}`);
  console.log(`- 最大令牌数: ${maxTokens}`);
  console.log(`- 主题: ${theme}`);

  // 设置配置项
  configManager.set('verbose', true);
  configManager.set('theme', 'dark');

  console.log('\n配置已更新:');
  console.log(`- 详细输出: ${configManager.get('verbose')}`);
  console.log(`- 主题: ${configManager.get('theme')}`);

  // 获取所有配置
  const allConfig = configManager.getAll();
  console.log(`\n总共 ${Object.keys(allConfig).length} 个配置项`);
}

// ============ 示例 2: 项目级配置 ============

function projectConfigExample() {
  console.log('\n=== 示例 2: 项目级配置 ===\n');

  // 保存项目特定配置
  configManager.saveProject({
    model: 'opus',
    maxTokens: 16384,
    systemPrompt: '你是一个专业的 TypeScript 代码审查助手',
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'],
    verbose: true
  });

  console.log('项目配置已保存到 .claude/settings.json');
  console.log('这些设置只在当前项目中生效');

  // 重新加载以应用项目配置
  configManager.reload();
  console.log(`\n重新加载后的模型: ${configManager.get('model')}`);
  console.log(`重新加载后的最大令牌数: ${configManager.get('maxTokens')}`);
}

// ============ 示例 3: 配置验证 ============

function configValidationExample() {
  console.log('\n=== 示例 3: 配置验证 ===\n');

  const validation = configManager.validate();

  if (validation.valid) {
    console.log('✓ 配置验证通过');
  } else {
    console.log('✗ 配置验证失败:');
    validation.errors?.issues.forEach(issue => {
      console.log(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  // 尝试设置无效的配置（会在 set 时抛出错误）
  try {
    // @ts-expect-error - 故意使用无效值来测试
    configManager.set('maxTokens', -1000);
  } catch (error) {
    console.log('\n✓ 正确拦截了无效配置:', (error as Error).message);
  }
}

// ============ 示例 4: 配置导出/导入 ============

function configExportImportExample() {
  console.log('\n=== 示例 4: 配置导出/导入 ===\n');

  // 导出配置（掩码敏感信息）
  const maskedConfig = configManager.export(true);
  console.log('导出的配置（已掩码）:');
  const maskedObj = JSON.parse(maskedConfig);
  console.log(`- API 密钥: ${maskedObj.apiKey || '(未设置)'}`);
  console.log(`- OAuth 令牌: ${maskedObj.oauthToken || '(未设置)'}`);

  // 导出完整配置（不掩码）
  const fullConfig = configManager.export(false);
  console.log('\n✓ 完整配置已导出（包含敏感信息）');

  // 备份配置
  const fs = await import('fs');
  const path = await import('path');
  const backupPath = path.join(process.cwd(), 'config-backup.json');
  fs.writeFileSync(backupPath, fullConfig);
  console.log(`✓ 配置已备份到: ${backupPath}`);

  // 导入配置
  const importSuccess = configManager.import(fullConfig);
  if (importSuccess) {
    console.log('✓ 配置导入成功');
  }
}

// ============ 示例 5: MCP 服务器管理 ============

function mcpServerExample() {
  console.log('\n=== 示例 5: MCP 服务器管理 ===\n');

  // 添加 stdio 类型的 MCP 服务器
  configManager.addMcpServer('filesystem', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/projects']
  });
  console.log('✓ 已添加 filesystem MCP 服务器');

  // 添加 HTTP 类型的 MCP 服务器
  configManager.addMcpServer('api-server', {
    type: 'http',
    url: 'http://localhost:3000/mcp',
    headers: {
      'Authorization': 'Bearer token123',
      'Content-Type': 'application/json'
    }
  });
  console.log('✓ 已添加 api-server MCP 服务器');

  // 获取所有 MCP 服务器
  const mcpServers = configManager.getMcpServers();
  console.log(`\n当前配置了 ${Object.keys(mcpServers).length} 个 MCP 服务器:`);
  Object.entries(mcpServers).forEach(([name, config]) => {
    console.log(`- ${name}: ${config.type}`);
  });

  // 更新 MCP 服务器
  configManager.updateMcpServer('filesystem', {
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path']
  });
  console.log('\n✓ 已更新 filesystem 服务器路径');

  // 删除 MCP 服务器
  configManager.removeMcpServer('api-server');
  console.log('✓ 已删除 api-server');

  // 再次查看
  const updatedServers = configManager.getMcpServers();
  console.log(`\n剩余 ${Object.keys(updatedServers).length} 个 MCP 服务器`);
}

// ============ 示例 6: 配置热重载 ============

function configHotReloadExample() {
  console.log('\n=== 示例 6: 配置热重载 ===\n');

  // 设置监听回调
  configManager.watch((newConfig: UserConfig) => {
    console.log('\n🔄 配置已更新！');
    console.log(`- 模型: ${newConfig.model}`);
    console.log(`- 最大令牌数: ${newConfig.maxTokens}`);
    console.log(`- 详细输出: ${newConfig.verbose}`);
  });

  console.log('✓ 已启用配置热重载监听');
  console.log('现在修改配置文件会自动触发更新...');
  console.log('\n提示：修改 ~/.claude/settings.json 或 .claude/settings.json 来测试热重载');

  // 模拟配置更改
  setTimeout(() => {
    console.log('\n⏰ 10秒后自动触发配置更新...');
    configManager.set('verbose', !configManager.get('verbose'));
  }, 10000);

  // 30秒后停止监听
  setTimeout(() => {
    configManager.unwatch();
    console.log('\n✓ 已停止配置监听');
  }, 30000);
}

// ============ 示例 7: 环境变量配置 ============

function environmentVariableExample() {
  console.log('\n=== 示例 7: 环境变量配置 ===\n');

  // 显示当前环境变量配置
  console.log('环境变量配置:');
  console.log(`- ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '已设置' : '未设置'}`);
  console.log(`- CLAUDE_CODE_MAX_OUTPUT_TOKENS: ${process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || '未设置'}`);
  console.log(`- CLAUDE_CODE_USE_BEDROCK: ${process.env.CLAUDE_CODE_USE_BEDROCK || '未设置'}`);
  console.log(`- CLAUDE_CODE_ENABLE_TELEMETRY: ${process.env.CLAUDE_CODE_ENABLE_TELEMETRY || '未设置'}`);

  // 显示合并后的配置
  const finalConfig = configManager.getAll();
  console.log('\n合并后的配置:');
  console.log(`- API 密钥: ${finalConfig.apiKey ? '已设置' : '未设置'}`);
  console.log(`- 最大令牌数: ${finalConfig.maxTokens}`);
  console.log(`- 使用 Bedrock: ${finalConfig.useBedrock}`);
  console.log(`- 启用遥测: ${finalConfig.enableTelemetry}`);
}

// ============ 示例 8: 配置重置 ============

function configResetExample() {
  console.log('\n=== 示例 8: 配置重置 ===\n');

  console.log('当前配置:');
  const beforeReset = configManager.getAll();
  console.log(`- 模型: ${beforeReset.model}`);
  console.log(`- 主题: ${beforeReset.theme}`);
  console.log(`- 详细输出: ${beforeReset.verbose}`);

  // 重置为默认配置
  configManager.reset();
  console.log('\n✓ 配置已重置为默认值');

  const afterReset = configManager.getAll();
  console.log('\n重置后的配置:');
  console.log(`- 模型: ${afterReset.model}`);
  console.log(`- 主题: ${afterReset.theme}`);
  console.log(`- 详细输出: ${afterReset.verbose}`);
}

// ============ 示例 9: 敏感信息掩码 ============

function sensitiveDataMaskingExample() {
  console.log('\n=== 示例 9: 敏感信息掩码 ===\n');

  // 设置一些敏感信息
  configManager.set('apiKey', 'sk-ant-api03-1234567890abcdef');

  // 添加包含敏感信息的 MCP 服务器
  configManager.addMcpServer('secure-server', {
    type: 'http',
    url: 'https://api.example.com/mcp',
    headers: {
      'Authorization': 'Bearer secret_token_1234567890',
      'X-API-Key': 'api_key_abcdefghijklmnop'
    },
    env: {
      'DATABASE_PASSWORD': 'super_secret_password',
      'API_SECRET': 'very_secret_key',
      'LOG_LEVEL': 'info'  // 非敏感信息
    }
  });

  // 导出配置（掩码敏感信息）
  const maskedConfig = JSON.parse(configManager.export(true));
  console.log('掩码后的敏感信息:');
  console.log(`- API 密钥: ${maskedConfig.apiKey}`);

  const secureServer = maskedConfig.mcpServers?.['secure-server'];
  if (secureServer) {
    console.log(`- MCP 服务器 Authorization: ${secureServer.headers?.Authorization}`);
    console.log(`- MCP 服务器 X-API-Key: ${secureServer.headers?.['X-API-Key']}`);
    console.log(`- 环境变量 DATABASE_PASSWORD: ${secureServer.env?.DATABASE_PASSWORD}`);
    console.log(`- 环境变量 LOG_LEVEL: ${secureServer.env?.LOG_LEVEL}`);
  }

  console.log('\n✓ 敏感信息已自动掩码，非敏感信息保持原样');
}

// ============ 主函数 ============

async function main() {
  console.log('Claude Code 配置系统使用示例');
  console.log('================================');

  // 运行所有示例（注释掉不需要的）
  basicConfigExample();
  projectConfigExample();
  configValidationExample();
  await configExportImportExample();
  mcpServerExample();
  environmentVariableExample();
  configResetExample();
  sensitiveDataMaskingExample();

  // 热重载示例需要长时间运行，可选
  // configHotReloadExample();

  console.log('\n\n所有示例执行完毕！');
  console.log('\n详细文档请参考: docs/config-enhanced.md');
}

// 运行示例
main().catch(console.error);
