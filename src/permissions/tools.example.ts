/**
 * T071: 工具权限控制系统 - 使用示例
 *
 * 展示如何使用细粒度工具权限控制系统
 */

import {
  ToolPermissionManager,
  ToolPermission,
  PermissionContext,
  PERMISSION_TEMPLATES,
  ParameterRestriction,
  PermissionCondition,
} from './tools.js';

// ============ 示例 1: 基本权限设置 ============

function example1_BasicPermissions() {
  const manager = new ToolPermissionManager();

  // 允许 Read 工具
  manager.addPermission({
    tool: 'Read',
    allowed: true,
    reason: 'Reading files is safe',
  });

  // 禁止 Write 工具
  manager.addPermission({
    tool: 'Write',
    allowed: false,
    reason: 'Writing is disabled in read-only mode',
  });

  // 检查权限
  const context: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  const readResult = manager.isAllowed('Read', { file_path: '/home/user/project/file.txt' }, context);
  console.log('Read allowed:', readResult.allowed); // true

  const writeResult = manager.isAllowed('Write', { file_path: '/home/user/project/file.txt', content: 'test' }, context);
  console.log('Write allowed:', writeResult.allowed); // false
}

// ============ 示例 2: 参数级限制 ============

function example2_ParameterRestrictions() {
  const manager = new ToolPermissionManager();

  // Bash 工具：禁止危险命令
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'command',
        type: 'blacklist',
        values: ['rm -rf', 'sudo', 'chmod 777', 'dd'],
        description: 'Dangerous commands are not allowed',
      },
    ],
  });

  const context: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  // 安全命令
  const safeResult = manager.isAllowed('Bash', { command: 'ls -la' }, context);
  console.log('Safe command allowed:', safeResult.allowed); // true

  // 危险命令
  const dangerResult = manager.isAllowed('Bash', { command: 'rm -rf /' }, context);
  console.log('Dangerous command allowed:', dangerResult.allowed); // false
  console.log('Reason:', dangerResult.reason);
  console.log('Violations:', dangerResult.violations);
}

// ============ 示例 3: 路径限制（使用正则表达式）============

function example3_PathRestrictions() {
  const manager = new ToolPermissionManager();

  // 仅允许在项目目录下写入
  manager.addPermission({
    tool: 'Write',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'file_path',
        type: 'pattern',
        pattern: /^\/home\/user\/project\//,
        description: 'Can only write to project directory',
      },
    ],
  });

  const context: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  // 项目内写入
  const projectWrite = manager.isAllowed(
    'Write',
    { file_path: '/home/user/project/src/file.ts', content: 'test' },
    context
  );
  console.log('Project write allowed:', projectWrite.allowed); // true

  // 项目外写入
  const systemWrite = manager.isAllowed(
    'Write',
    { file_path: '/etc/config', content: 'test' },
    context
  );
  console.log('System write allowed:', systemWrite.allowed); // false
}

// ============ 示例 4: 上下文条件 ============

function example4_ContextConditions() {
  const manager = new ToolPermissionManager();

  // 仅在特定目录下允许 Bash
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    conditions: [
      {
        type: 'context',
        field: 'workingDirectory',
        operator: 'contains',
        value: '/home/user/safe-project',
        description: 'Only allowed in safe-project directory',
      },
    ],
  });

  // 在安全目录
  const safeContext: PermissionContext = {
    workingDirectory: '/home/user/safe-project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  const safeResult = manager.isAllowed('Bash', { command: 'npm test' }, safeContext);
  console.log('Bash in safe directory:', safeResult.allowed); // true

  // 在不安全目录
  const unsafeContext: PermissionContext = {
    workingDirectory: '/home/user/other-project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  const unsafeResult = manager.isAllowed('Bash', { command: 'npm test' }, unsafeContext);
  console.log('Bash in other directory:', unsafeResult.allowed); // false
}

// ============ 示例 5: 自定义验证器 ============

function example5_CustomValidators() {
  const manager = new ToolPermissionManager();

  // 自定义参数验证器：仅允许特定文件扩展名
  manager.addPermission({
    tool: 'Write',
    allowed: true,
    parameterRestrictions: [
      {
        parameter: 'file_path',
        type: 'validator',
        validator: (value) => {
          if (typeof value !== 'string') return false;
          const allowedExtensions = ['.ts', '.js', '.json', '.md'];
          return allowedExtensions.some(ext => value.endsWith(ext));
        },
        description: 'Only allowed extensions: .ts, .js, .json, .md',
      },
    ],
  });

  const context: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  // 允许的扩展名
  const tsFile = manager.isAllowed('Write', { file_path: 'src/file.ts', content: 'test' }, context);
  console.log('TypeScript file allowed:', tsFile.allowed); // true

  // 不允许的扩展名
  const binFile = manager.isAllowed('Write', { file_path: 'bin/app', content: 'test' }, context);
  console.log('Binary file allowed:', binFile.allowed); // false
}

// ============ 示例 6: 时间限制 ============

function example6_TimeRestrictions() {
  const manager = new ToolPermissionManager();

  // 仅在工作时间（9:00-18:00）允许网络请求
  manager.addPermission({
    tool: 'WebFetch',
    allowed: true,
    conditions: [
      {
        type: 'time',
        operator: 'custom',
        value: null,
        validator: (context) => {
          const hour = new Date(context.timestamp).getHours();
          return hour >= 9 && hour < 18;
        },
        description: 'Only allowed during work hours (9:00-18:00)',
      },
    ],
  });

  // 工作时间
  const workHourContext: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: new Date('2025-01-15T10:00:00').getTime(),
  };

  const workHourResult = manager.isAllowed('WebFetch', { url: 'https://api.example.com', prompt: 'test' }, workHourContext);
  console.log('WebFetch during work hours:', workHourResult.allowed); // true

  // 非工作时间
  const afterHourContext: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: new Date('2025-01-15T20:00:00').getTime(),
  };

  const afterHourResult = manager.isAllowed('WebFetch', { url: 'https://api.example.com', prompt: 'test' }, afterHourContext);
  console.log('WebFetch after hours:', afterHourResult.allowed); // false
}

// ============ 示例 7: 优先级和权限继承 ============

function example7_PriorityAndInheritance() {
  const manager = new ToolPermissionManager();

  // 全局权限：默认禁止 Bash
  manager.addPermission(
    {
      tool: 'Bash',
      allowed: false,
      priority: 0,
      reason: 'Global policy: Bash disabled',
    },
    'global'
  );

  // 项目权限：在特定项目中允许 Bash（高优先级）
  manager.addPermission(
    {
      tool: 'Bash',
      allowed: true,
      priority: 10,
      conditions: [
        {
          type: 'context',
          field: 'workingDirectory',
          operator: 'contains',
          value: '/home/user/approved-project',
        },
      ],
      reason: 'Project override: Bash enabled for approved project',
    },
    'project'
  );

  // 在审批项目中
  const approvedContext: PermissionContext = {
    workingDirectory: '/home/user/approved-project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  const approvedResult = manager.isAllowed('Bash', { command: 'npm test' }, approvedContext);
  console.log('Bash in approved project:', approvedResult.allowed); // true
  console.log('Reason:', approvedResult.matchedRule?.reason);

  // 在其他项目中
  const otherContext: PermissionContext = {
    workingDirectory: '/home/user/other-project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  const otherResult = manager.isAllowed('Bash', { command: 'npm test' }, otherContext);
  console.log('Bash in other project:', otherResult.allowed); // false
  console.log('Reason:', otherResult.matchedRule?.reason);
}

// ============ 示例 8: 使用预设模板 ============

function example8_Templates() {
  const manager = new ToolPermissionManager();

  // 应用只读模式模板
  const readOnlyPermissions = PERMISSION_TEMPLATES.readOnly();
  readOnlyPermissions.forEach(perm => manager.addPermission(perm));

  const context: PermissionContext = {
    workingDirectory: '/home/user/project',
    sessionId: 'session-123',
    timestamp: Date.now(),
  };

  // Read 允许
  const readResult = manager.isAllowed('Read', { file_path: 'file.txt' }, context);
  console.log('Read in read-only mode:', readResult.allowed); // true

  // Write 禁止
  const writeResult = manager.isAllowed('Write', { file_path: 'file.txt', content: 'test' }, context);
  console.log('Write in read-only mode:', writeResult.allowed); // false

  // 应用安全模式模板
  const manager2 = new ToolPermissionManager();
  const safePermissions = PERMISSION_TEMPLATES.safe();
  safePermissions.forEach(perm => manager2.addPermission(perm));

  // Bash 允许，但有限制
  const bashResult = manager2.isAllowed('Bash', { command: 'ls' }, context);
  console.log('Safe bash command:', bashResult.allowed); // true

  const dangerousBash = manager2.isAllowed('Bash', { command: 'sudo rm -rf /' }, context);
  console.log('Dangerous bash command:', dangerousBash.allowed); // false
}

// ============ 示例 9: 权限统计和查询 ============

function example9_StatsAndQuery() {
  const manager = new ToolPermissionManager();

  // 添加多个权限
  manager.addPermission({ tool: 'Read', allowed: true });
  manager.addPermission({ tool: 'Write', allowed: false });
  manager.addPermission({
    tool: 'Bash',
    allowed: true,
    parameterRestrictions: [
      { parameter: 'command', type: 'blacklist', values: ['rm', 'sudo'] },
    ],
  });

  // 获取统计
  const stats = manager.getStats();
  console.log('Stats:', stats);
  // {
  //   totalPermissions: 3,
  //   allowedTools: 2,
  //   deniedTools: 1,
  //   conditionalTools: 0,
  //   restrictedParameters: 1,
  //   activeContexts: 3
  // }

  // 查询权限
  const allowedTools = manager.queryPermissions({ allowed: true });
  console.log('Allowed tools:', allowedTools.map(p => p.tool));

  const restrictedTools = manager.queryPermissions({ hasRestrictions: true });
  console.log('Tools with restrictions:', restrictedTools.map(p => p.tool));
}

// ============ 示例 10: 导入/导出 ============

function example10_ImportExport() {
  const manager = new ToolPermissionManager();

  // 添加权限
  manager.addPermission({ tool: 'Read', allowed: true });
  manager.addPermission({ tool: 'Write', allowed: false });

  // 导出配置
  const exported = manager.export();
  console.log('Exported config:', exported);

  // 导入到新的管理器
  const manager2 = new ToolPermissionManager();
  manager2.import(exported);

  const permissions = manager2.getPermissions();
  console.log('Imported permissions:', permissions.length); // 2
}

// ============ 运行所有示例 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Example 1: Basic Permissions ===');
  example1_BasicPermissions();

  console.log('\n=== Example 2: Parameter Restrictions ===');
  example2_ParameterRestrictions();

  console.log('\n=== Example 3: Path Restrictions ===');
  example3_PathRestrictions();

  console.log('\n=== Example 4: Context Conditions ===');
  example4_ContextConditions();

  console.log('\n=== Example 5: Custom Validators ===');
  example5_CustomValidators();

  console.log('\n=== Example 6: Time Restrictions ===');
  example6_TimeRestrictions();

  console.log('\n=== Example 7: Priority and Inheritance ===');
  example7_PriorityAndInheritance();

  console.log('\n=== Example 8: Templates ===');
  example8_Templates();

  console.log('\n=== Example 9: Stats and Query ===');
  example9_StatsAndQuery();

  console.log('\n=== Example 10: Import/Export ===');
  example10_ImportExport();
}

// ============ 导出示例函数 ============

export {
  example1_BasicPermissions,
  example2_ParameterRestrictions,
  example3_PathRestrictions,
  example4_ContextConditions,
  example5_CustomValidators,
  example6_TimeRestrictions,
  example7_PriorityAndInheritance,
  example8_Templates,
  example9_StatsAndQuery,
  example10_ImportExport,
};
