/**
 * 权限策略引擎使用示例
 *
 * 展示如何使用 PolicyEngine 定义和评估权限策略
 */

import {
  PolicyEngine,
  PolicyBuilder,
  RuleBuilder,
  createReadOnlyPolicy,
  createWorkHoursPolicy,
  createPathWhitelistPolicy,
  type Policy,
  type PolicyRule,
} from './policy.js';
import type { PermissionRequest } from './index.js';

// ============ 示例 1: 基本策略定义 ============

function example1_BasicPolicy() {
  console.log('=== Example 1: Basic Policy ===\n');

  const engine = new PolicyEngine(undefined, true);

  // 创建一个简单的策略
  const policy: Policy = {
    id: 'basic-policy',
    name: 'Basic File Policy',
    description: 'Allow reads, ask for writes',
    priority: 100,
    effect: 'deny',
    enabled: true,
    rules: [
      {
        id: 'allow-read',
        effect: 'allow',
        description: 'Allow all file reads',
        condition: {
          type: 'file_read',
        },
      },
      {
        id: 'deny-delete',
        effect: 'deny',
        description: 'Deny all file deletions',
        condition: {
          type: 'file_delete',
        },
      },
    ],
  };

  engine.addPolicy(policy);

  // 测试请求
  const readRequest: PermissionRequest = {
    type: 'file_read',
    tool: 'Read',
    description: 'Read config file',
    resource: '/home/user/.claude/settings.json',
  };

  const deleteRequest: PermissionRequest = {
    type: 'file_delete',
    tool: 'Bash',
    description: 'Delete temporary file',
    resource: '/tmp/test.txt',
  };

  console.log('Read Request:', engine.evaluate(readRequest));
  console.log('Delete Request:', engine.evaluate(deleteRequest));
  console.log();
}

// ============ 示例 2: 使用 Builder API ============

function example2_BuilderAPI() {
  console.log('=== Example 2: Builder API ===\n');

  const engine = new PolicyEngine();

  // 使用 PolicyBuilder 创建策略
  const policy = new PolicyBuilder('dev-policy', 'Development Policy')
    .description('Policy for development environment')
    .priority(200)
    .defaultEffect('deny')
    .addRule(
      new RuleBuilder('allow-project-files', 'allow')
        .description('Allow operations in project directory')
        .type(['file_read', 'file_write'])
        .path(['/home/user/projects/**', '/home/user/workspace/**'])
        .build()
    )
    .addRule(
      new RuleBuilder('deny-system-files', 'deny')
        .description('Deny operations on system files')
        .path(['/etc/**', '/sys/**', '/proc/**'])
        .build()
    )
    .build();

  engine.addPolicy(policy);

  // 测试
  const projectFileRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write to project file',
    resource: '/home/user/projects/app/src/index.ts',
  };

  const systemFileRequest: PermissionRequest = {
    type: 'file_read',
    tool: 'Read',
    description: 'Read system file',
    resource: '/etc/passwd',
  };

  console.log('Project File:', engine.evaluate(projectFileRequest));
  console.log('System File:', engine.evaluate(systemFileRequest));
  console.log();
}

// ============ 示例 3: 复杂条件组合 ============

function example3_ComplexConditions() {
  console.log('=== Example 3: Complex Conditions ===\n');

  const engine = new PolicyEngine();

  const policy: Policy = {
    id: 'complex-policy',
    name: 'Complex Conditions',
    priority: 300,
    effect: 'deny',
    rules: [
      {
        id: 'work-hours-write',
        effect: 'allow',
        description: 'Allow writes during work hours on weekdays',
        condition: {
          and: [
            { type: 'file_write' },
            { timeRange: { start: '09:00', end: '18:00' } },
            { daysOfWeek: [1, 2, 3, 4, 5] }, // Mon-Fri
          ],
        },
      },
      {
        id: 'emergency-access',
        effect: 'allow',
        description: 'Allow emergency access for specific tools',
        condition: {
          or: [
            { tool: 'EmergencyTool' },
            {
              and: [
                { type: 'bash_command' },
                { resource: /^(ps|top|htop|systemctl status)/ },
              ],
            },
          ],
        },
      },
      {
        id: 'deny-dangerous',
        effect: 'deny',
        description: 'Always deny dangerous commands',
        priority: 999,
        condition: {
          and: [
            { type: 'bash_command' },
            {
              or: [
                { resource: /^(rm -rf|sudo rm|mkfs|dd if=)/ },
                { resource: /\/(dev|sys|proc)\// },
              ],
            },
          ],
        },
      },
    ],
  };

  engine.addPolicy(policy);

  // 测试
  const writeRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write during work hours',
    resource: '/home/user/document.txt',
  };

  const dangerousRequest: PermissionRequest = {
    type: 'bash_command',
    tool: 'Bash',
    description: 'Dangerous command',
    resource: 'rm -rf /',
  };

  console.log('Write Request:', engine.evaluate(writeRequest));
  console.log('Dangerous Request:', engine.evaluate(dangerousRequest));
  console.log();
}

// ============ 示例 4: 多策略冲突解决 ============

function example4_ConflictResolution() {
  console.log('=== Example 4: Conflict Resolution ===\n');

  const engine = new PolicyEngine();

  // 添加多个可能冲突的策略
  const allowPolicy: Policy = {
    id: 'allow-all',
    name: 'Allow All',
    priority: 100,
    effect: 'allow',
    rules: [
      {
        id: 'allow-everything',
        effect: 'allow',
        condition: { type: 'file_write' },
      },
    ],
  };

  const denyPolicy: Policy = {
    id: 'deny-config',
    name: 'Deny Config Changes',
    priority: 200, // Higher priority
    effect: 'deny',
    rules: [
      {
        id: 'deny-config-write',
        effect: 'deny',
        condition: {
          and: [
            { type: 'file_write' },
            { path: ['**/.config/**', '**/.claude/**'] },
          ],
        },
      },
    ],
  };

  engine.addPolicy(allowPolicy);
  engine.addPolicy(denyPolicy);

  // 测试冲突
  const regularFileRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write regular file',
    resource: '/home/user/notes.txt',
  };

  const configFileRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write config file',
    resource: '/home/user/.claude/settings.json',
  };

  console.log('Regular File (allow wins):', engine.evaluate(regularFileRequest));
  console.log('Config File (deny wins - higher priority):', engine.evaluate(configFileRequest));
  console.log();
}

// ============ 示例 5: 预定义策略模板 ============

function example5_PolicyTemplates() {
  console.log('=== Example 5: Policy Templates ===\n');

  const engine = new PolicyEngine();

  // 使用预定义模板
  engine.addPolicy(createReadOnlyPolicy());
  engine.addPolicy(createWorkHoursPolicy('work-hours', '08:00', '17:00'));
  engine.addPolicy(
    createPathWhitelistPolicy('project-whitelist', [
      '/home/user/projects/**',
      '/tmp/**',
    ])
  );

  // 测试
  const writeRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write file',
    resource: '/home/user/projects/app/index.ts',
  };

  console.log('Write Request:', engine.evaluate(writeRequest));
  console.log('Stats:', engine.getStats());
  console.log();
}

// ============ 示例 6: 策略持久化 ============

async function example6_Persistence() {
  console.log('=== Example 6: Persistence ===\n');

  const engine = new PolicyEngine('/tmp/claude-policy-test');

  // 创建策略
  const policy = new PolicyBuilder('persistent-policy', 'Persistent Policy')
    .priority(100)
    .defaultEffect('deny')
    .addRule(
      new RuleBuilder('allow-reads', 'allow')
        .type('file_read')
        .build()
    )
    .build();

  engine.addPolicy(policy);

  // 保存到文件
  const policyFile = '/tmp/claude-policy-test/policies.json';
  await engine.savePolicies(policyFile);
  console.log(`Saved policies to ${policyFile}`);

  // 创建新引擎并加载
  const engine2 = new PolicyEngine('/tmp/claude-policy-test');
  await engine2.loadPolicies(policyFile);
  console.log('Loaded policies:', engine2.listPolicies().map(p => p.name));
  console.log();
}

// ============ 示例 7: 策略验证 ============

function example7_Validation() {
  console.log('=== Example 7: Policy Validation ===\n');

  const engine = new PolicyEngine();

  // 有效策略
  const validPolicy: Policy = {
    id: 'valid',
    name: 'Valid Policy',
    priority: 100,
    effect: 'allow',
    rules: [
      {
        id: 'rule1',
        effect: 'allow',
        condition: { type: 'file_read' },
      },
    ],
  };

  // 无效策略
  const invalidPolicy: any = {
    id: 'invalid',
    // 缺少 name
    priority: 'not-a-number', // 错误的类型
    effect: 'maybe', // 无效的 effect
    rules: 'not-an-array', // 错误的类型
  };

  console.log('Valid Policy:', engine.validatePolicy(validPolicy));
  console.log('Invalid Policy:', engine.validatePolicy(invalidPolicy));
  console.log();
}

// ============ 示例 8: 自定义条件函数 ============

function example8_CustomConditions() {
  console.log('=== Example 8: Custom Conditions ===\n');

  const engine = new PolicyEngine();

  const policy: Policy = {
    id: 'custom-policy',
    name: 'Custom Conditions',
    priority: 100,
    effect: 'deny',
    rules: [
      {
        id: 'custom-rule',
        effect: 'allow',
        description: 'Allow based on custom logic',
        condition: {
          custom: (request: PermissionRequest) => {
            // 自定义逻辑：只允许特定扩展名的文件
            if (!request.resource) return false;
            const allowedExtensions = ['.ts', '.js', '.json', '.md'];
            return allowedExtensions.some(ext => request.resource!.endsWith(ext));
          },
        },
      },
    ],
  };

  engine.addPolicy(policy);

  // 测试
  const tsFileRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write TypeScript file',
    resource: '/home/user/app.ts',
  };

  const binFileRequest: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write binary file',
    resource: '/home/user/app.bin',
  };

  console.log('TypeScript File:', engine.evaluate(tsFileRequest));
  console.log('Binary File:', engine.evaluate(binFileRequest));
  console.log();
}

// ============ 示例 9: 环境变量条件 ============

function example9_EnvironmentConditions() {
  console.log('=== Example 9: Environment Conditions ===\n');

  const engine = new PolicyEngine();

  const policy: Policy = {
    id: 'env-policy',
    name: 'Environment-Based Policy',
    priority: 100,
    effect: 'deny',
    rules: [
      {
        id: 'dev-env',
        effect: 'allow',
        description: 'Allow all in development environment',
        condition: {
          environment: {
            NODE_ENV: 'development',
          },
        },
      },
      {
        id: 'prod-env',
        effect: 'deny',
        description: 'Restrict in production',
        condition: {
          and: [
            { environment: { NODE_ENV: 'production' } },
            { type: ['file_write', 'file_delete'] },
          ],
        },
      },
    ],
  };

  engine.addPolicy(policy);

  const request: PermissionRequest = {
    type: 'file_write',
    tool: 'Write',
    description: 'Write file',
    resource: '/app/config.json',
  };

  // 测试不同环境
  console.log(
    'Development:',
    engine.evaluate(request, {
      environment: { NODE_ENV: 'development' },
    })
  );

  console.log(
    'Production:',
    engine.evaluate(request, {
      environment: { NODE_ENV: 'production' },
    })
  );
  console.log();
}

// ============ 运行所有示例 ============

async function runAllExamples() {
  console.log('\n======================================');
  console.log('  Policy Engine Examples');
  console.log('======================================\n');

  try {
    example1_BasicPolicy();
    example2_BuilderAPI();
    example3_ComplexConditions();
    example4_ConflictResolution();
    example5_PolicyTemplates();
    await example6_Persistence();
    example7_Validation();
    example8_CustomConditions();
    example9_EnvironmentConditions();

    console.log('======================================');
    console.log('  All Examples Completed');
    console.log('======================================\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// 运行示例（如果直接执行此文件）
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export { runAllExamples };
