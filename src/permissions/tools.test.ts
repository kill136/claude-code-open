/**
 * T071: 工具权限控制系统 - 测试文件
 *
 * 注意：这是一个演示测试文件，展示如何测试权限系统
 * 实际项目中应使用 Jest/Vitest 等测试框架
 */

import {
  ToolPermissionManager,
  ToolPermission,
  PermissionContext,
  PermissionResult,
  PERMISSION_TEMPLATES,
} from './tools.js';

// ============ 测试辅助函数 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createTestContext(overrides?: Partial<PermissionContext>): PermissionContext {
  return {
    workingDirectory: '/home/user/test-project',
    sessionId: 'test-session-123',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============ 测试套件 ============

function testBasicPermissions() {
  console.log('Testing: Basic Permissions');

  const manager = new ToolPermissionManager();
  const context = createTestContext();

  // 测试默认允许
  const defaultResult = manager.isAllowed('UnknownTool', {}, context);
  assert(defaultResult.allowed === true, 'Unknown tool should be allowed by default');

  // 测试显式允许
  manager.addPermission({ tool: 'Read', allowed: true });
  const readResult = manager.isAllowed('Read', { file_path: 'test.txt' }, context);
  assert(readResult.allowed === true, 'Read should be allowed');

  // 测试显式禁止
  manager.addPermission({ tool: 'Write', allowed: false });
  const writeResult = manager.isAllowed('Write', { file_path: 'test.txt', content: 'test' }, context);
  assert(writeResult.allowed === false, 'Write should be denied');
  assert(writeResult.reason !== undefined, 'Denied result should have a reason');

  console.log('✓ Basic permissions tests passed');
}

function testParameterRestrictions() {
  console.log('Testing: Parameter Restrictions');

  const manager = new ToolPermissionManager();
  const context = createTestContext();

  // 测试黑名单
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'command',
        type: 'blacklist',
        values: ['rm -rf', 'sudo'],
      },
    ],
  });

  const safeResult = manager.isAllowed('Bash', { command: 'ls -la' }, context);
  assert(safeResult.allowed === true, 'Safe command should be allowed');

  const dangerousResult = manager.isAllowed('Bash', { command: 'rm -rf /' }, context);
  assert(dangerousResult.allowed === false, 'Dangerous command should be denied');
  assert(dangerousResult.violations !== undefined, 'Should have violations');
  assert(dangerousResult.violations!.length > 0, 'Should have at least one violation');

  // 测试白名单
  manager.addPermission({
    tool: 'Model',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'model',
        type: 'whitelist',
        values: ['opus', 'sonnet', 'haiku'],
      },
    ],
  });

  const validModel = manager.isAllowed('Model', { model: 'sonnet' }, context);
  assert(validModel.allowed === true, 'Valid model should be allowed');

  const invalidModel = manager.isAllowed('Model', { model: 'gpt-4' }, context);
  assert(invalidModel.allowed === false, 'Invalid model should be denied');

  // 测试正则表达式
  manager.addPermission({
    tool: 'Write',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'file_path',
        type: 'pattern',
        pattern: /^\/home\/user\/.*\.(ts|js)$/,
      },
    ],
  });

  const validPath = manager.isAllowed('Write', { file_path: '/home/user/test.ts', content: 'test' }, context);
  assert(validPath.allowed === true, 'Valid path should be allowed');

  const invalidPath = manager.isAllowed('Write', { file_path: '/etc/config', content: 'test' }, context);
  assert(invalidPath.allowed === false, 'Invalid path should be denied');

  // 测试自定义验证器
  manager.addPermission({
    tool: 'Custom',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'value',
        type: 'validator',
        validator: (value) => typeof value === 'number' && value > 0,
      },
    ],
  });

  const validValue = manager.isAllowed('Custom', { value: 42 }, context);
  assert(validValue.allowed === true, 'Valid value should be allowed');

  const invalidValue = manager.isAllowed('Custom', { value: -1 }, context);
  assert(invalidValue.allowed === false, 'Invalid value should be denied');

  // 测试范围限制
  manager.addPermission({
    tool: 'Range',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'port',
        type: 'range',
        min: 1024,
        max: 65535,
      },
    ],
  });

  const validPort = manager.isAllowed('Range', { port: 8080 }, context);
  assert(validPort.allowed === true, 'Valid port should be allowed');

  const invalidPort = manager.isAllowed('Range', { port: 80 }, context);
  assert(invalidPort.allowed === false, 'Invalid port should be denied');

  console.log('✓ Parameter restrictions tests passed');
}

function testContextConditions() {
  console.log('Testing: Context Conditions');

  const manager = new ToolPermissionManager();

  // 测试工作目录条件
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    conditions: [
      {
        type: 'context',
        field: 'workingDirectory',
        operator: 'contains',
        value: '/safe-project',
      },
    ],
  });

  const safeContext = createTestContext({ workingDirectory: '/home/user/safe-project' });
  const safeResult = manager.isAllowed('Bash', { command: 'npm test' }, safeContext);
  assert(safeResult.allowed === true, 'Should be allowed in safe directory');

  const unsafeContext = createTestContext({ workingDirectory: '/home/user/other-project' });
  const unsafeResult = manager.isAllowed('Bash', { command: 'npm test' }, unsafeContext);
  assert(unsafeResult.allowed === false, 'Should be denied in other directory');

  // 测试 equals 运算符
  manager.addPermission({
    tool: 'SessionTool',
    allowed: true,
    conditions: [
      {
        type: 'context',
        field: 'sessionId',
        operator: 'equals',
        value: 'special-session',
      },
    ],
  });

  const specialContext = createTestContext({ sessionId: 'special-session' });
  const specialResult = manager.isAllowed('SessionTool', {}, specialContext);
  assert(specialResult.allowed === true, 'Should be allowed for special session');

  const normalContext = createTestContext({ sessionId: 'normal-session' });
  const normalResult = manager.isAllowed('SessionTool', {}, normalContext);
  assert(normalResult.allowed === false, 'Should be denied for normal session');

  // 测试时间范围
  manager.addPermission({
    tool: 'TimeTool',
    allowed: true,
    conditions: [
      {
        type: 'time',
        operator: 'range',
        value: [
          new Date('2025-01-01T09:00:00').getTime(),
          new Date('2025-01-01T18:00:00').getTime(),
        ],
      },
    ],
  });

  const workHourContext = createTestContext({
    timestamp: new Date('2025-01-01T10:00:00').getTime(),
  });
  const workHourResult = manager.isAllowed('TimeTool', {}, workHourContext);
  assert(workHourResult.allowed === true, 'Should be allowed during work hours');

  const afterHourContext = createTestContext({
    timestamp: new Date('2025-01-01T20:00:00').getTime(),
  });
  const afterHourResult = manager.isAllowed('TimeTool', {}, afterHourContext);
  assert(afterHourResult.allowed === false, 'Should be denied after hours');

  // 测试自定义验证器
  manager.addPermission({
    tool: 'CustomCondition',
    allowed: true,
    conditions: [
      {
        type: 'custom',
        operator: 'custom',
        value: null,
        validator: (context) => {
          return context.workingDirectory.includes('approved');
        },
      },
    ],
  });

  const approvedContext = createTestContext({ workingDirectory: '/home/user/approved-project' });
  const approvedResult = manager.isAllowed('CustomCondition', {}, approvedContext);
  assert(approvedResult.allowed === true, 'Should be allowed for approved project');

  const unapprovedContext = createTestContext({ workingDirectory: '/home/user/test-project' });
  const unapprovedResult = manager.isAllowed('CustomCondition', {}, unapprovedContext);
  assert(unapprovedResult.allowed === false, 'Should be denied for unapproved project');

  console.log('✓ Context conditions tests passed');
}

function testPriorityAndInheritance() {
  console.log('Testing: Priority and Inheritance');

  const manager = new ToolPermissionManager();
  const context = createTestContext();

  // 测试优先级
  manager.addPermission({
    tool: 'Test',
    allowed: false,
    priority: 0,
  }, 'global');

  manager.addPermission({
    tool: 'Test',
    allowed: true,
    priority: 10,
  }, 'session');

  const result = manager.isAllowed('Test', {}, context);
  assert(result.allowed === true, 'Higher priority permission should win');
  assert(result.matchedRule?.priority === 10, 'Should match high priority rule');

  // 测试范围隔离
  manager.clearPermissions();

  manager.addPermission({ tool: 'Global', allowed: true }, 'global');
  manager.addPermission({ tool: 'Project', allowed: true }, 'project');
  manager.addPermission({ tool: 'Session', allowed: true }, 'session');

  const globalPerms = manager.getPermissions('global');
  assert(globalPerms.length === 1, 'Should have 1 global permission');
  assert(globalPerms[0].tool === 'Global', 'Should be Global tool');

  const projectPerms = manager.getPermissions('project');
  assert(projectPerms.length === 1, 'Should have 1 project permission');
  assert(projectPerms[0].tool === 'Project', 'Should be Project tool');

  const sessionPerms = manager.getPermissions('session');
  assert(sessionPerms.length === 1, 'Should have 1 session permission');
  assert(sessionPerms[0].tool === 'Session', 'Should be Session tool');

  const allPerms = manager.getPermissions();
  assert(allPerms.length === 3, 'Should have 3 total permissions');

  console.log('✓ Priority and inheritance tests passed');
}

function testTemplates() {
  console.log('Testing: Permission Templates');

  const manager = new ToolPermissionManager();
  const context = createTestContext();

  // 测试只读模板
  const readOnlyPerms = PERMISSION_TEMPLATES.readOnly();
  readOnlyPerms.forEach(perm => manager.addPermission(perm));

  const readResult = manager.isAllowed('Read', { file_path: 'test.txt' }, context);
  assert(readResult.allowed === true, 'Read should be allowed in read-only mode');

  const writeResult = manager.isAllowed('Write', { file_path: 'test.txt', content: 'test' }, context);
  assert(writeResult.allowed === false, 'Write should be denied in read-only mode');

  // 测试安全模板
  manager.clearPermissions();
  const safePerms = PERMISSION_TEMPLATES.safe();
  safePerms.forEach(perm => manager.addPermission(perm));

  const safeBash = manager.isAllowed('Bash', { command: 'ls -la' }, context);
  assert(safeBash.allowed === true, 'Safe bash command should be allowed');

  const dangerousBash = manager.isAllowed('Bash', { command: 'sudo rm -rf /' }, context);
  assert(dangerousBash.allowed === false, 'Dangerous bash command should be denied');

  // 测试项目限制模板
  manager.clearPermissions();
  const projectPerms = PERMISSION_TEMPLATES.projectOnly('/home/user/test-project');
  projectPerms.forEach(perm => manager.addPermission(perm));

  const inProject = manager.isAllowed('Read', { file_path: 'test.txt' }, context);
  assert(inProject.allowed === true, 'Should be allowed in project directory');

  const outOfProject = manager.isAllowed('Read', { file_path: 'test.txt' },
    createTestContext({ workingDirectory: '/home/user/other-project' }));
  assert(outOfProject.allowed === false, 'Should be denied outside project directory');

  console.log('✓ Permission templates tests passed');
}

function testQueryAndStats() {
  console.log('Testing: Query and Statistics');

  const manager = new ToolPermissionManager();

  // 添加多个权限
  manager.addPermission({ tool: 'Read', allowed: true });
  manager.addPermission({ tool: 'Write', allowed: false });
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    conditions: [
      {
        type: 'context',
        field: 'workingDirectory',
        operator: 'contains',
        value: '/safe',
      },
    ],
  });
  manager.addPermission({
    tool: 'Custom',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'value',
        type: 'range',
        min: 0,
        max: 100,
      },
    ],
  });

  // 测试统计
  const stats = manager.getStats();
  assert(stats.totalPermissions === 4, 'Should have 4 permissions');
  assert(stats.allowedTools === 3, 'Should have 3 allowed tools');
  assert(stats.deniedTools === 1, 'Should have 1 denied tool');
  assert(stats.conditionalTools === 1, 'Should have 1 conditional tool');
  assert(stats.restrictedParameters === 1, 'Should have 1 restricted parameter');

  // 测试查询
  const allowedTools = manager.queryPermissions({ allowed: true });
  assert(allowedTools.length === 3, 'Should find 3 allowed tools');

  const deniedTools = manager.queryPermissions({ allowed: false });
  assert(deniedTools.length === 1, 'Should find 1 denied tool');

  const conditionalTools = manager.queryPermissions({ hasConditions: true });
  assert(conditionalTools.length === 1, 'Should find 1 conditional tool');
  assert(conditionalTools[0].tool === 'Bash', 'Should be Bash tool');

  const restrictedTools = manager.queryPermissions({ hasRestrictions: true });
  assert(restrictedTools.length === 1, 'Should find 1 restricted tool');
  assert(restrictedTools[0].tool === 'Custom', 'Should be Custom tool');

  const patternMatch = manager.queryPermissions({ toolPattern: 'Read' });
  assert(patternMatch.length === 1, 'Should find 1 matching tool');
  assert(patternMatch[0].tool === 'Read', 'Should be Read tool');

  console.log('✓ Query and statistics tests passed');
}

function testImportExport() {
  console.log('Testing: Import/Export');

  const manager1 = new ToolPermissionManager();

  // 添加权限
  manager1.addPermission({ tool: 'Read', allowed: true, priority: 5 });
  manager1.addPermission({ tool: 'Write', allowed: false, priority: 3 });

  // 导出
  const exported = manager1.export();
  assert(typeof exported === 'string', 'Export should return a string');

  const parsed = JSON.parse(exported);
  assert(parsed.version === '1.0.0', 'Should have version');
  assert(Array.isArray(parsed.permissions), 'Should have permissions array');
  assert(parsed.permissions.length === 2, 'Should have 2 permissions');

  // 导入到新管理器
  const manager2 = new ToolPermissionManager();
  const importSuccess = manager2.import(exported);
  assert(importSuccess === true, 'Import should succeed');

  const imported = manager2.getPermissions();
  assert(imported.length === 2, 'Should have 2 imported permissions');

  const readPerm = imported.find(p => p.tool === 'Read');
  assert(readPerm !== undefined, 'Should have Read permission');
  assert(readPerm!.allowed === true, 'Read should be allowed');
  assert(readPerm!.priority === 5, 'Read should have priority 5');

  const writePerm = imported.find(p => p.tool === 'Write');
  assert(writePerm !== undefined, 'Should have Write permission');
  assert(writePerm!.allowed === false, 'Write should be denied');
  assert(writePerm!.priority === 3, 'Write should have priority 3');

  console.log('✓ Import/Export tests passed');
}

function testWildcardMatching() {
  console.log('Testing: Wildcard Matching');

  const manager = new ToolPermissionManager();
  const context = createTestContext();

  // 测试通配符权限
  manager.addPermission({ tool: 'File*', allowed: false });

  const fileRead = manager.isAllowed('FileRead', {}, context);
  assert(fileRead.allowed === false, 'FileRead should be denied by wildcard');

  const fileWrite = manager.isAllowed('FileWrite', {}, context);
  assert(fileWrite.allowed === false, 'FileWrite should be denied by wildcard');

  const bash = manager.isAllowed('Bash', {}, context);
  assert(bash.allowed === true, 'Bash should not be affected by File* wildcard');

  // 测试 * 通配符（匹配所有）
  manager.clearPermissions();
  manager.addPermission({ tool: '*', allowed: false });

  const anyTool = manager.isAllowed('AnyTool', {}, context);
  assert(anyTool.allowed === false, 'Any tool should be denied by * wildcard');

  console.log('✓ Wildcard matching tests passed');
}

function testExpiration() {
  console.log('Testing: Permission Expiration');

  const manager = new ToolPermissionManager();

  // 添加已过期的权限
  const expiredTime = Date.now() - 1000; // 1秒前
  manager.addPermission({
    tool: 'Expired',
    allowed: false,
    expiresAt: expiredTime,
  });

  // 添加未过期的权限
  const futureTime = Date.now() + 60000; // 1分钟后
  manager.addPermission({
    tool: 'Valid',
    allowed: false,
    expiresAt: futureTime,
  });

  const context = createTestContext();

  // 过期的权限应该被忽略
  const expiredResult = manager.isAllowed('Expired', {}, context);
  assert(expiredResult.allowed === true, 'Expired permission should be ignored');

  // 未过期的权限应该生效
  const validResult = manager.isAllowed('Valid', {}, context);
  assert(validResult.allowed === false, 'Valid permission should be enforced');

  console.log('✓ Permission expiration tests passed');
}

function testComplexScenario() {
  console.log('Testing: Complex Scenario');

  const manager = new ToolPermissionManager();

  // 模拟复杂的企业场景
  // 1. 全局禁止所有写操作
  manager.addPermission({
    tool: 'Write',
    allowed: false,
    priority: 0,
    reason: 'Global policy: All writes disabled',
  }, 'global');

  // 2. 项目级别：允许在特定目录写入特定类型文件
  manager.addPermission({
    tool: 'Write',
    allowed: true,
    priority: 5,
    conditions: [
      {
        type: 'context',
        field: 'workingDirectory',
        operator: 'contains',
        value: '/approved-project',
      },
    ],
    parameterRestrictions: [
      {
        parameter: 'file_path',
        type: 'pattern',
        pattern: /\.(ts|js|json|md)$/,
        description: 'Only source and doc files',
      },
    ],
    reason: 'Project override: Limited writes allowed',
  }, 'project');

  // 3. 会话级别：工作时间限制
  manager.addPermission({
    tool: '*',
    allowed: true,
    priority: 10,
    conditions: [
      {
        type: 'time',
        operator: 'custom',
        value: null,
        validator: (context) => {
          const hour = new Date(context.timestamp).getHours();
          return hour >= 9 && hour < 18;
        },
        description: 'Work hours only',
      },
    ],
  }, 'session');

  // 测试场景 1: 非工作时间 - 应该被拒绝
  const afterHoursContext = createTestContext({
    workingDirectory: '/home/user/approved-project',
    timestamp: new Date('2025-01-15T20:00:00').getTime(),
  });

  const afterHoursResult = manager.isAllowed(
    'Write',
    { file_path: 'src/test.ts', content: 'test' },
    afterHoursContext
  );
  assert(afterHoursResult.allowed === false, 'Should be denied after hours');

  // 测试场景 2: 工作时间 + 审批项目 + 允许的文件类型 - 应该允许
  const validContext = createTestContext({
    workingDirectory: '/home/user/approved-project',
    timestamp: new Date('2025-01-15T10:00:00').getTime(),
  });

  const validResult = manager.isAllowed(
    'Write',
    { file_path: 'src/test.ts', content: 'test' },
    validContext
  );
  assert(validResult.allowed === true, 'Should be allowed with all conditions met');

  // 测试场景 3: 工作时间 + 审批项目 + 不允许的文件类型 - 应该被拒绝
  const invalidFileResult = manager.isAllowed(
    'Write',
    { file_path: 'bin/executable', content: 'test' },
    validContext
  );
  assert(invalidFileResult.allowed === false, 'Should be denied for non-source files');

  // 测试场景 4: 工作时间 + 未审批项目 - 应该被拒绝
  const unapprovedContext = createTestContext({
    workingDirectory: '/home/user/other-project',
    timestamp: new Date('2025-01-15T10:00:00').getTime(),
  });

  const unapprovedResult = manager.isAllowed(
    'Write',
    { file_path: 'src/test.ts', content: 'test' },
    unapprovedContext
  );
  assert(unapprovedResult.allowed === false, 'Should be denied in unapproved project');

  console.log('✓ Complex scenario tests passed');
}

// ============ 运行所有测试 ============

export function runAllTests() {
  console.log('='.repeat(60));
  console.log('Running Tool Permission Manager Tests');
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    testBasicPermissions,
    testParameterRestrictions,
    testContextConditions,
    testPriorityAndInheritance,
    testTemplates,
    testQueryAndStats,
    testImportExport,
    testWildcardMatching,
    testExpiration,
    testComplexScenario,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
      console.log('');
    } catch (error) {
      failed++;
      console.error(`✗ Test failed: ${error}`);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  return { passed, failed };
}

// 如果直接运行此文件，执行所有测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
