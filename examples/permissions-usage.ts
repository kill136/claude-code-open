/**
 * 权限系统使用示例
 * 展示如何使用增强的权限白名单/黑名单系统
 */

import { PermissionManager, PermissionConfig, PermissionRequest } from '../src/permissions/index.js';

// ============ 示例 1：创建权限管理器并配置 ============

console.log('========== 示例 1：基础配置 ==========\n');

const manager = new PermissionManager('default');

// 定义权限配置
const config: PermissionConfig = {
  tools: {
    allow: ['Read', 'Glob', 'Grep'],
    deny: ['Bash', 'Write']
  },
  paths: {
    allow: [
      '/home/user/project/**',
      '/tmp/**'
    ],
    deny: [
      '/etc/**',
      '**/.env',
      '**/secrets.json'
    ]
  },
  commands: {
    allow: [
      'ls*',
      'git status',
      'git log*'
    ],
    deny: [
      'rm -rf *',
      'sudo *'
    ]
  },
  network: {
    allow: [
      'api.anthropic.com',
      '*.github.com'
    ],
    deny: [
      '192.168.*',
      '10.*'
    ]
  },
  audit: {
    enabled: true,
    logFile: '/tmp/permissions-test.log',
    maxSize: 1024 * 1024  // 1MB
  }
};

manager.setPermissionConfig(config);

console.log('权限配置已设置：');
console.log(JSON.stringify(config, null, 2));
console.log('\n');

// ============ 示例 2：检查工具级权限 ============

console.log('========== 示例 2：工具级权限检查 ==========\n');

async function testToolPermissions() {
  const tests: PermissionRequest[] = [
    {
      type: 'file_read',
      tool: 'Read',
      description: 'Read a file',
      resource: '/home/user/project/test.ts'
    },
    {
      type: 'file_write',
      tool: 'Write',
      description: 'Write a file',
      resource: '/home/user/project/output.txt'
    },
    {
      type: 'bash_command',
      tool: 'Bash',
      description: 'Execute bash command',
      resource: 'ls -la'
    }
  ];

  for (const request of tests) {
    const decision = await manager.check(request);
    console.log(`工具: ${request.tool}`);
    console.log(`决策: ${decision.allowed ? '✓ 允许' : '✗ 拒绝'}`);
    console.log(`原因: ${decision.reason}`);
    console.log('---');
  }
}

await testToolPermissions();
console.log('\n');

// ============ 示例 3：检查路径级权限 ============

console.log('========== 示例 3：路径级权限检查 ==========\n');

async function testPathPermissions() {
  const testPaths = [
    '/home/user/project/src/index.ts',
    '/home/user/project/.env',
    '/etc/passwd',
    '/tmp/test.txt',
    '/home/user/secrets.json'
  ];

  for (const filePath of testPaths) {
    const request: PermissionRequest = {
      type: 'file_read',
      tool: 'Read',
      description: 'Read file',
      resource: filePath
    };

    const decision = await manager.check(request);
    console.log(`路径: ${filePath}`);
    console.log(`决策: ${decision.allowed ? '✓ 允许' : '✗ 拒绝'}`);
    console.log(`原因: ${decision.reason}`);
    console.log('---');
  }
}

await testPathPermissions();
console.log('\n');

// ============ 示例 4：检查命令级权限 ============

console.log('========== 示例 4：命令级权限检查 ==========\n');

async function testCommandPermissions() {
  const testCommands = [
    'ls -la',
    'git status',
    'git log --oneline',
    'rm -rf /tmp/*',
    'sudo apt install',
    'cat /etc/passwd'
  ];

  for (const command of testCommands) {
    const request: PermissionRequest = {
      type: 'bash_command',
      tool: 'Bash',
      description: 'Execute bash command',
      resource: command
    };

    const decision = await manager.check(request);
    console.log(`命令: ${command}`);
    console.log(`决策: ${decision.allowed ? '✓ 允许' : '✗ 拒绝'}`);
    console.log(`原因: ${decision.reason}`);
    console.log('---');
  }
}

await testCommandPermissions();
console.log('\n');

// ============ 示例 5：检查网络权限 ============

console.log('========== 示例 5：网络权限检查 ==========\n');

async function testNetworkPermissions() {
  const testUrls = [
    'https://api.anthropic.com/v1/messages',
    'https://api.github.com/repos',
    'https://192.168.1.1/admin',
    'http://10.0.0.1/api'
  ];

  for (const url of testUrls) {
    const request: PermissionRequest = {
      type: 'network_request',
      tool: 'WebFetch',
      description: 'Fetch URL',
      resource: url
    };

    const decision = await manager.check(request);
    console.log(`URL: ${url}`);
    console.log(`决策: ${decision.allowed ? '✓ 允许' : '✗ 拒绝'}`);
    console.log(`原因: ${decision.reason}`);
    console.log('---');
  }
}

await testNetworkPermissions();
console.log('\n');

// ============ 示例 6：权限配置导出 ============

console.log('========== 示例 6：权限配置导出 ==========\n');

const exportedConfig = manager.export();
console.log('导出的权限配置：');
console.log(JSON.stringify(exportedConfig, null, 2));
console.log('\n');

// ============ 示例 7：查看审计日志 ============

console.log('========== 示例 7：审计日志 ==========\n');

console.log('审计日志已写入: /tmp/permissions-test.log');
console.log('可以使用以下命令查看：');
console.log('  cat /tmp/permissions-test.log | jq');
console.log('  grep \'"decision":"deny"\' /tmp/permissions-test.log | jq');
console.log('\n');

// ============ 示例 8：高级 Glob 模式匹配 ============

console.log('========== 示例 8：高级 Glob 模式 ==========\n');

const advancedConfig: PermissionConfig = {
  paths: {
    deny: [
      '**/*.env*',           // 所有环境变量文件
      '**/node_modules/**',  // 所有 node_modules
      '**/.git/**',          // 所有 .git 目录
      '**/dist/**',          // 所有构建输出
      '**/*secret*',         // 包含 secret 的文件
      '**/*credential*',     // 包含 credential 的文件
      '/etc/**',             // 系统配置目录
      '/root/**',            // root 用户目录
      '~/.ssh/**',           // SSH 密钥目录
    ]
  },
  commands: {
    deny: [
      'rm -rf /*',
      'dd if=*',
      'mkfs*',
      '> /dev/sd*',
      'chmod -R 777 *',
      'chown -R * *',
    ]
  }
};

console.log('高级 Glob 模式示例：');
console.log(JSON.stringify(advancedConfig, null, 2));
console.log('\n');

// ============ 示例 9：动态添加规则 ============

console.log('========== 示例 9：动态规则管理 ==========\n');

// 添加新规则
manager.addRule({
  type: 'file_write',
  pattern: /\.log$/,
  action: 'allow',
  scope: 'session'
});

console.log('已添加规则：允许写入 .log 文件');

const logWriteRequest: PermissionRequest = {
  type: 'file_write',
  tool: 'Write',
  description: 'Write log file',
  resource: '/tmp/app.log'
};

const logDecision = await manager.check(logWriteRequest);
console.log(`写入日志文件: ${logDecision.allowed ? '✓ 允许' : '✗ 拒绝'}`);
console.log(`原因: ${logDecision.reason}`);
console.log('\n');

console.log('========== 所有测试完成 ==========\n');
