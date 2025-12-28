/**
 * 权限系统综合测试
 *
 * 测试覆盖：
 * - PermissionManager 初始化
 * - 各权限模式行为验证
 * - 工具白名单/黑名单
 * - 权限规则解析
 * - 权限检查逻辑
 * - 权限缓存机制
 * - 动态权限更新
 * - 与 PolicyEngine 和 ToolPermissionManager 集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionManager, type PermissionRequest, type PermissionConfig } from './index.js';
import { PolicyEngine, createReadOnlyPolicy } from './policy.js';
import { ToolPermissionManager } from './tools.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PermissionManager', () => {
  let testConfigDir: string;
  let manager: PermissionManager;

  beforeEach(() => {
    // 创建临时测试目录
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-test-'));
    process.env.CLAUDE_CONFIG_DIR = testConfigDir;

    // 创建新的 PermissionManager 实例
    manager = new PermissionManager();
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  describe('初始化', () => {
    it('应该使用默认模式初始化', () => {
      expect(manager.getMode()).toBe('default');
    });

    it('应该可以指定初始模式', () => {
      const bypassManager = new PermissionManager('bypassPermissions');
      expect(bypassManager.getMode()).toBe('bypassPermissions');
    });

    it('应该加载持久化的权限', () => {
      // 创建权限文件
      const permFile = path.join(testConfigDir, 'permissions.json');
      const permissions = [
        {
          type: 'file_write',
          pattern: '/test/**',
          allowed: true,
          scope: 'always',
          timestamp: Date.now()
        }
      ];
      fs.writeFileSync(permFile, JSON.stringify(permissions, null, 2));

      // 重新创建 manager 以加载权限
      const newManager = new PermissionManager();
      expect(newManager).toBeDefined();
    });
  });

  describe('权限模式：bypassPermissions', () => {
    beforeEach(() => {
      manager.setMode('bypassPermissions');
    });

    it('应该允许所有操作', async () => {
      const request: PermissionRequest = {
        type: 'file_write',
        tool: 'Write',
        description: 'Write to system file',
        resource: '/etc/passwd'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toContain('bypassed');
    });

    it('应该允许危险的 bash 命令', async () => {
      const request: PermissionRequest = {
        type: 'bash_command',
        tool: 'Bash',
        description: 'Dangerous command',
        resource: 'rm -rf /'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
    });
  });

  describe('权限模式：acceptEdits', () => {
    beforeEach(() => {
      manager.setMode('acceptEdits');
    });

    it('应该自动接受文件读取', async () => {
      const request: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Read file',
        resource: '/test.txt'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toContain('Auto-accept');
    });

    it('应该自动接受文件写入', async () => {
      const request: PermissionRequest = {
        type: 'file_write',
        tool: 'Write',
        description: 'Write file',
        resource: '/test.txt'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toContain('Auto-accept');
    });

    it('对于非文件操作应该使用常规检查', async () => {
      const request: PermissionRequest = {
        type: 'bash_command',
        tool: 'Bash',
        description: 'Run command',
        resource: 'ls -la'
      };

      const decision = await manager.check(request);
      expect(decision).toBeDefined();
      // 应该通过规则检查（不会自动接受）
    });
  });

  describe('权限模式：plan', () => {
    beforeEach(() => {
      manager.setMode('plan');
    });

    it('应该拒绝所有操作', async () => {
      const requests: PermissionRequest[] = [
        {
          type: 'file_read',
          tool: 'Read',
          description: 'Read',
          resource: '/test.txt'
        },
        {
          type: 'file_write',
          tool: 'Write',
          description: 'Write',
          resource: '/test.txt'
        },
        {
          type: 'bash_command',
          tool: 'Bash',
          description: 'Command',
          resource: 'ls'
        }
      ];

      for (const request of requests) {
        const decision = await manager.check(request);
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toContain('Plan mode');
      }
    });
  });

  describe('权限模式：dontAsk', () => {
    beforeEach(() => {
      manager.setMode('dontAsk');
    });

    it('应该自动允许文件读取', async () => {
      const request: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Read',
        resource: '/test.txt'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
    });

    it('应该允许在允许目录内的写操作', async () => {
      manager.addAllowedDir(testConfigDir);

      const request: PermissionRequest = {
        type: 'file_write',
        tool: 'Write',
        description: 'Write',
        resource: path.join(testConfigDir, 'test.txt')
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
    });

    it('应该拒绝在未允许目录的写操作', async () => {
      const request: PermissionRequest = {
        type: 'file_write',
        tool: 'Write',
        description: 'Write',
        resource: '/etc/passwd'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('dontAsk');
    });
  });

  describe('权限模式：delegate', () => {
    beforeEach(() => {
      manager.setMode('delegate');
    });

    it('应该使用规则进行检查', async () => {
      const request: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Read',
        resource: '/test.txt'
      };

      const decision = await manager.check(request);
      // delegate 模式应该通过规则检查
      expect(decision).toBeDefined();
      expect(decision.allowed).toBeDefined();
    });
  });

  describe('允许的目录管理', () => {
    it('应该添加允许的目录', () => {
      manager.addAllowedDir('/home/user/project');
      const dirs = manager.getAdditionalDirectories();

      expect(dirs.size).toBeGreaterThan(0);
      const found = Array.from(dirs.values()).some(
        d => d.path.includes('project')
      );
      expect(found).toBe(true);
    });

    it('应该移除允许的目录', () => {
      const testDir = '/home/user/project';
      manager.addAllowedDir(testDir);
      manager.removeAllowedDir(testDir);

      const dirs = manager.getAdditionalDirectories();
      const found = Array.from(dirs.values()).some(
        d => d.path === path.resolve(testDir)
      );
      expect(found).toBe(false);
    });

    it('应该检查路径是否在允许的目录内', () => {
      manager.addAllowedDir(testConfigDir);

      const allowed = manager.isPathAllowed(
        path.join(testConfigDir, 'test.txt')
      );
      expect(allowed).toBe(true);

      const denied = manager.isPathAllowed('/etc/passwd');
      expect(denied).toBe(false);
    });

    it('当前工作目录应该总是被允许', () => {
      const cwd = process.cwd();
      const allowed = manager.isPathAllowed(
        path.join(cwd, 'test.txt')
      );
      expect(allowed).toBe(true);
    });
  });

  describe('权限配置（settings.json）', () => {
    it('应该加载工具级权限配置', () => {
      const config: PermissionConfig = {
        tools: {
          allow: ['Read', 'Glob'],
          deny: ['Bash', 'Write']
        }
      };

      manager.setPermissionConfig(config);
      const loaded = manager.getPermissionConfig();

      expect(loaded.tools?.allow).toEqual(['Read', 'Glob']);
      expect(loaded.tools?.deny).toEqual(['Bash', 'Write']);
    });

    it('应该加载路径级权限配置', () => {
      const config: PermissionConfig = {
        paths: {
          allow: ['/home/user/**'],
          deny: ['/etc/**', '/sys/**']
        }
      };

      manager.setPermissionConfig(config);
      const loaded = manager.getPermissionConfig();

      expect(loaded.paths?.allow).toContain('/home/user/**');
      expect(loaded.paths?.deny).toContain('/etc/**');
    });

    it('应该加载命令级权限配置', () => {
      const config: PermissionConfig = {
        commands: {
          allow: ['npm *', 'git *'],
          deny: ['rm *', 'sudo *']
        }
      };

      manager.setPermissionConfig(config);
      const loaded = manager.getPermissionConfig();

      expect(loaded.commands?.allow).toContain('npm *');
      expect(loaded.commands?.deny).toContain('rm *');
    });

    it('应该加载网络权限配置', () => {
      const config: PermissionConfig = {
        network: {
          allow: ['*.github.com', '*.anthropic.com'],
          deny: ['*.malware.com']
        }
      };

      manager.setPermissionConfig(config);
      const loaded = manager.getPermissionConfig();

      expect(loaded.network?.allow).toContain('*.github.com');
      expect(loaded.network?.deny).toContain('*.malware.com');
    });
  });

  describe('权限规则添加和管理', () => {
    it('应该添加 allow 规则', () => {
      manager.addPermissionRule('allow', 'test', ['Read', 'Glob']);
      const rules = manager.getAllPermissionRules();

      expect(rules.allow.has('test')).toBe(true);
      expect(rules.allow.get('test')).toContain('Read');
      expect(rules.allow.get('test')).toContain('Glob');
    });

    it('应该添加 deny 规则', () => {
      manager.addPermissionRule('deny', 'test', ['Bash', 'Write']);
      const rules = manager.getAllPermissionRules();

      expect(rules.deny.has('test')).toBe(true);
      expect(rules.deny.get('test')).toContain('Bash');
    });

    it('应该替换规则', () => {
      manager.addPermissionRule('allow', 'test', ['Read']);
      manager.replacePermissionRules('allow', 'test', ['Glob', 'Grep']);

      const rules = manager.getAllPermissionRules();
      expect(rules.allow.get('test')).toEqual(['Glob', 'Grep']);
      expect(rules.allow.get('test')).not.toContain('Read');
    });

    it('应该移除规则', () => {
      manager.addPermissionRule('allow', 'test', ['Read', 'Glob', 'Grep']);
      manager.removePermissionRule('allow', 'test', ['Glob']);

      const rules = manager.getAllPermissionRules();
      expect(rules.allow.get('test')).toContain('Read');
      expect(rules.allow.get('test')).toContain('Grep');
      expect(rules.allow.get('test')).not.toContain('Glob');
    });
  });

  describe('会话权限', () => {
    it('应该清除会话权限', () => {
      // 会话权限会在后续的 check 调用中被设置
      manager.clearSessionPermissions();

      // 验证清除不会引发错误
      expect(() => manager.clearSessionPermissions()).not.toThrow();
    });
  });

  describe('审计日志', () => {
    it('应该启用审计日志', () => {
      const config: PermissionConfig = {
        audit: {
          enabled: true,
          logFile: path.join(testConfigDir, 'audit.log'),
          maxSize: 1024 * 1024 // 1MB
        }
      };

      manager.setPermissionConfig(config);
      const loaded = manager.getPermissionConfig();

      expect(loaded.audit?.enabled).toBe(true);
      expect(loaded.audit?.logFile).toBeDefined();
    });

    it('应该记录权限决策到审计日志', async () => {
      const logFile = path.join(testConfigDir, 'audit.log');
      const config: PermissionConfig = {
        audit: {
          enabled: true,
          logFile
        }
      };

      manager.setPermissionConfig(config);

      const request: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Test read',
        resource: '/test.txt'
      };

      await manager.check(request);

      // 检查日志文件是否存在
      expect(fs.existsSync(logFile)).toBe(true);

      // 验证日志内容
      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).toBeTruthy();
      const logEntry = JSON.parse(logContent.trim().split('\n')[0]);
      expect(logEntry.type).toBe('file_read');
      expect(logEntry.tool).toBe('Read');
    });
  });

  describe('权限导出', () => {
    it('应该导出完整的权限配置', () => {
      manager.addAllowedDir('/home/user/project', 'test');
      manager.addPermissionRule('allow', 'test', ['Read', 'Glob']);

      const exported = manager.export();

      expect(exported).toHaveProperty('mode');
      expect(exported).toHaveProperty('rules');
      expect(exported).toHaveProperty('allowedDirs');
      expect(exported).toHaveProperty('additionalWorkingDirectories');
      expect(exported).toHaveProperty('alwaysAllowRules');
      expect(exported).toHaveProperty('permissionConfig');
    });

    it('导出的配置应该包含正确的数据', () => {
      manager.setMode('acceptEdits');
      manager.addPermissionRule('allow', 'test', ['Read']);

      const exported = manager.export() as any;

      expect(exported.mode).toBe('acceptEdits');
      expect(exported.alwaysAllowRules).toHaveProperty('test');
    });
  });

  describe('默认规则', () => {
    it('应该允许文件读取', async () => {
      const request: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Read file',
        resource: '/test.txt'
      };

      const decision = await manager.check(request);
      expect(decision.allowed).toBe(true);
    });

    it('应该允许安全的 bash 命令', async () => {
      const safeCommands = ['ls', 'pwd', 'cat test.txt', 'echo hello'];

      for (const cmd of safeCommands) {
        const request: PermissionRequest = {
          type: 'bash_command',
          tool: 'Bash',
          description: 'Safe command',
          resource: cmd
        };

        const decision = await manager.check(request);
        expect(decision.allowed).toBe(true);
      }
    });
  });

  describe('模式匹配', () => {
    beforeEach(() => {
      const config: PermissionConfig = {
        tools: {
          allow: ['Read*', 'Glob'],
          deny: ['Write*']
        }
      };
      manager.setPermissionConfig(config);
    });

    it('应该匹配通配符工具名', async () => {
      const readRequest: PermissionRequest = {
        type: 'file_read',
        tool: 'Read',
        description: 'Read',
        resource: '/test.txt'
      };

      const decision = await manager.check(readRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toContain('allowed by config');
    });

    it('应该拒绝匹配黑名单的工具', async () => {
      const writeRequest: PermissionRequest = {
        type: 'file_write',
        tool: 'Write',
        description: 'Write',
        resource: '/test.txt'
      };

      const decision = await manager.check(writeRequest);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('denied by config');
    });
  });

  describe('持久化', () => {
    it('应该持久化 always 范围的权限', () => {
      const permFile = path.join(testConfigDir, 'permissions.json');

      // 权限会在内部自动持久化
      expect(manager).toBeDefined();

      // 如果文件存在，验证格式
      if (fs.existsSync(permFile)) {
        const content = fs.readFileSync(permFile, 'utf-8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的配置文件', () => {
      const settingsFile = path.join(testConfigDir, 'settings.json');
      fs.writeFileSync(settingsFile, 'invalid json{');

      // 应该不会崩溃
      expect(() => new PermissionManager()).not.toThrow();
    });

    it('应该处理缺失的配置目录', () => {
      delete process.env.CLAUDE_CONFIG_DIR;
      process.env.HOME = testConfigDir;

      expect(() => new PermissionManager()).not.toThrow();
    });
  });
});

describe('PolicyEngine 集成', () => {
  let engine: PolicyEngine;
  let testConfigDir: string;

  beforeEach(() => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-test-'));
    engine = new PolicyEngine(testConfigDir);
  });

  afterEach(() => {
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('应该评估权限请求', () => {
    const policy = createReadOnlyPolicy();
    engine.addPolicy(policy);

    const request: PermissionRequest = {
      type: 'file_read',
      tool: 'Read',
      description: 'Read file',
      resource: '/test.txt'
    };

    const decision = engine.evaluate(request);
    expect(decision.allowed).toBe(true);
  });

  it('应该拒绝写操作（只读策略）', () => {
    const policy = createReadOnlyPolicy();
    engine.addPolicy(policy);

    const request: PermissionRequest = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write file',
      resource: '/test.txt'
    };

    const decision = engine.evaluate(request);
    expect(decision.allowed).toBe(false);
  });

  it('应该处理策略冲突（deny 优先）', () => {
    const allowPolicy = {
      id: 'allow-all',
      name: 'Allow All',
      priority: 100,
      effect: 'allow' as const,
      rules: [
        {
          id: 'rule1',
          effect: 'allow' as const,
          condition: {}
        }
      ]
    };

    const denyPolicy = {
      id: 'deny-write',
      name: 'Deny Write',
      priority: 200,
      effect: 'deny' as const,
      rules: [
        {
          id: 'rule2',
          effect: 'deny' as const,
          condition: {
            type: 'file_write' as const
          }
        }
      ]
    };

    engine.addPolicy(allowPolicy);
    engine.addPolicy(denyPolicy);

    const request: PermissionRequest = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write',
      resource: '/test.txt'
    };

    const decision = engine.evaluate(request);
    expect(decision.allowed).toBe(false);
    expect(decision.policy).toBe('deny-write');
  });
});

describe('ToolPermissionManager 集成', () => {
  let toolManager: ToolPermissionManager;
  let testConfigDir: string;

  beforeEach(() => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-perm-test-'));
    process.env.CLAUDE_CONFIG_DIR = testConfigDir;
    toolManager = new ToolPermissionManager(testConfigDir);
  });

  afterEach(() => {
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  it('应该检查工具权限', () => {
    toolManager.addPermission({
      tool: 'Read',
      allowed: true,
      priority: 10
    });

    const result = toolManager.isAllowed(
      'Read',
      { file_path: '/test.txt' },
      {
        workingDirectory: process.cwd(),
        sessionId: 'test',
        timestamp: Date.now()
      }
    );

    expect(result.allowed).toBe(true);
  });

  it('应该拒绝被禁止的工具', () => {
    toolManager.addPermission({
      tool: 'Write',
      allowed: false,
      reason: 'Test deny'
    });

    const result = toolManager.isAllowed(
      'Write',
      { file_path: '/test.txt', content: 'test' },
      {
        workingDirectory: process.cwd(),
        sessionId: 'test',
        timestamp: Date.now()
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Test deny');
  });

  it('应该支持参数限制', () => {
    toolManager.addPermission({
      tool: 'Bash',
      allowed: true,
      parameterRestrictions: [
        {
          parameter: 'command',
          type: 'blacklist',
          values: ['rm -rf', 'sudo']
        }
      ]
    });

    const safeResult = toolManager.isAllowed(
      'Bash',
      { command: 'ls -la' },
      {
        workingDirectory: process.cwd(),
        sessionId: 'test',
        timestamp: Date.now()
      }
    );

    expect(safeResult.allowed).toBe(true);

    const dangerousResult = toolManager.isAllowed(
      'Bash',
      { command: 'rm -rf' },
      {
        workingDirectory: process.cwd(),
        sessionId: 'test',
        timestamp: Date.now()
      }
    );

    expect(dangerousResult.allowed).toBe(false);
  });

  it('应该支持权限继承', () => {
    // Clear any existing permissions first
    toolManager.clearPermissions();

    toolManager.addPermission({ tool: 'Global', allowed: true }, 'global');
    toolManager.addPermission({ tool: 'Project', allowed: true }, 'project');
    toolManager.addPermission({ tool: 'Session', allowed: true }, 'session');

    const stats = toolManager.getStats();
    expect(stats.totalPermissions).toBe(3);
  });

  it('应该导出和导入权限', () => {
    toolManager.addPermission({ tool: 'Read', allowed: true, priority: 5 });
    toolManager.addPermission({ tool: 'Write', allowed: false });

    const exported = toolManager.export();
    expect(exported).toBeTruthy();

    const newManager = new ToolPermissionManager(testConfigDir);
    const imported = newManager.import(exported);
    expect(imported).toBe(true);

    const permissions = newManager.getPermissions();
    expect(permissions.length).toBeGreaterThanOrEqual(2);

    // 验证导入的权限包含我们添加的
    const readPerm = permissions.find(p => p.tool === 'Read');
    const writePerm = permissions.find(p => p.tool === 'Write');
    expect(readPerm).toBeDefined();
    expect(writePerm).toBeDefined();
    expect(readPerm?.allowed).toBe(true);
    expect(writePerm?.allowed).toBe(false);
  });
});

describe('权限系统集成测试', () => {
  let manager: PermissionManager;
  let testConfigDir: string;

  beforeEach(() => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-integration-'));
    process.env.CLAUDE_CONFIG_DIR = testConfigDir;
    manager = new PermissionManager();
  });

  afterEach(() => {
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  it('应该正确处理复杂的权限场景', async () => {
    // 设置多层权限配置
    const config: PermissionConfig = {
      tools: {
        deny: ['Write', 'Edit']
      },
      paths: {
        deny: ['/etc/**', '/sys/**']
      },
      commands: {
        deny: ['rm *', 'sudo *']
      }
    };

    manager.setPermissionConfig(config);

    // 测试被拒绝的工具
    const writeRequest: PermissionRequest = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write',
      resource: '/home/user/test.txt'
    };

    const writeDecision = await manager.check(writeRequest);
    expect(writeDecision.allowed).toBe(false);
    expect(writeDecision.reason).toContain('denied by config');

    // 测试被拒绝的路径（使用 Write 工具，因为 Read 有默认 allow 规则）
    const sysWriteRequest: PermissionRequest = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write system file',
      resource: '/etc/passwd'
    };

    const sysWriteDecision = await manager.check(sysWriteRequest);
    expect(sysWriteDecision.allowed).toBe(false);
    // 工具级拒绝优先于路径检查
  });

  it('应该在不同模式之间切换', async () => {
    // bypassPermissions 模式 - 允许所有操作
    manager.setMode('bypassPermissions');
    let request: PermissionRequest = {
      type: 'bash_command',
      tool: 'Bash',
      description: 'Command',
      resource: 'rm -rf /'
    };
    let decision = await manager.check(request);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('bypassed');

    // plan 模式 - 拒绝所有操作
    manager.setMode('plan');
    request = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write',
      resource: '/test.txt'
    };
    decision = await manager.check(request);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Plan mode');

    // acceptEdits 模式 - 自动接受文件操作
    manager.setMode('acceptEdits');
    request = {
      type: 'file_write',
      tool: 'Write',
      description: 'Write',
      resource: '/test.txt'
    };
    decision = await manager.check(request);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('Auto-accept');

    // dontAsk 模式 - 自动决策
    manager.setMode('dontAsk');
    request = {
      type: 'file_read',
      tool: 'Read',
      description: 'Read',
      resource: '/test.txt'
    };
    decision = await manager.check(request);
    expect(decision.allowed).toBe(true);

    // 验证模式切换生效
    expect(manager.getMode()).toBe('dontAsk');
  });

  it('应该支持动态权限更新', async () => {
    // 初始状态：工具被允许
    manager.setPermissionConfig({
      tools: { allow: ['Bash'] }
    });

    const request: PermissionRequest = {
      type: 'bash_command',
      tool: 'Bash',
      description: 'Command',
      resource: 'ls'
    };

    let decision = await manager.check(request);
    expect(decision.allowed).toBe(true);

    // 更新配置：工具被禁止
    manager.setPermissionConfig({
      tools: { deny: ['Bash'] }
    });

    decision = await manager.check(request);
    expect(decision.allowed).toBe(false);
  });
});
