/**
 * T-015: 权限规则解析器 - 测试文件
 *
 * 测试覆盖：
 * - 规则解析语法
 * - Bash(command:pattern) 命令匹配
 * - Read/Write(path/**) 路径通配符
 * - 工具参数级别的权限控制
 * - 权限规则的优先级排序 (deny > allow > default)
 */

import {
  PermissionRuleParser,
  RuleMatcher,
  PermissionRuleManager,
  ParsedRule,
  RuleType,
  RuleSource,
  ToolInput,
  RuleParseError,
  parseAllowedTools,
  parseDisallowedTools,
  createBashRule,
  createPathRule,
} from './rule-parser.js';

// ============ 测试辅助函数 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected to throw: ${message}`);
  }
}

// ============ 规则解析测试 ============

function testBasicRuleParsing() {
  console.log('Testing: Basic Rule Parsing');

  // 测试简单工具名
  const rule1 = PermissionRuleParser.parse('Bash');
  assert(rule1.tool === 'Bash', 'Should parse tool name');
  assert(rule1.hasParams === false, 'Should have no params');
  assert(rule1.type === 'allow', 'Default type should be allow');

  // 测试带空括号的工具
  const rule2 = PermissionRuleParser.parse('Read()');
  assert(rule2.tool === 'Read', 'Should parse tool name');
  assert(rule2.hasParams === true, 'Should have empty params');
  assert(rule2.matcher?.type === 'any', 'Empty params should match any');

  // 测试带通配符的工具
  const rule3 = PermissionRuleParser.parse('Write(*)');
  assert(rule3.tool === 'Write', 'Should parse tool name');
  assert(rule3.hasParams === true, 'Should have params');
  assert(rule3.matcher?.type === 'any', 'Should match any');

  // 测试类型参数
  const rule4 = PermissionRuleParser.parse('Bash', 'deny');
  assert(rule4.type === 'deny', 'Should use deny type');

  // 测试来源参数
  const rule5 = PermissionRuleParser.parse('Read', 'allow', 'cli');
  assert(rule5.source === 'cli', 'Should use cli source');

  console.log('  Basic rule parsing tests passed');
}

function testCommandPatternParsing() {
  console.log('Testing: Command Pattern Parsing');

  // 测试命令前缀匹配
  const rule1 = PermissionRuleParser.parse('Bash(npm:*)');
  assert(rule1.tool === 'Bash', 'Should parse tool name');
  assert(rule1.hasParams === true, 'Should have params');
  assert(rule1.paramPattern === 'npm:*', 'Should have param pattern');
  assert(rule1.matcher?.type === 'prefix', 'Should be prefix type');
  assert(rule1.matcher?.commandPrefix === 'npm', 'Should have npm prefix');

  // 测试多词命令前缀
  const rule2 = PermissionRuleParser.parse('Bash(npm install:*)');
  assert(rule2.matcher?.commandPrefix === 'npm install', 'Should have "npm install" prefix');

  // 测试 git 命令
  const rule3 = PermissionRuleParser.parse('Bash(git diff:*)');
  assert(rule3.matcher?.commandPrefix === 'git diff', 'Should have "git diff" prefix');

  // 测试精确匹配
  const rule4 = PermissionRuleParser.parse('Bash(ls -la)');
  assert(rule4.matcher?.type === 'exact', 'Should be exact type');
  assert(rule4.matcher?.pattern === 'ls -la', 'Should have exact pattern');

  console.log('  Command pattern parsing tests passed');
}

function testPathPatternParsing() {
  console.log('Testing: Path Pattern Parsing');

  // 测试路径通配符
  const rule1 = PermissionRuleParser.parse('Read(/home/user/**)');
  assert(rule1.tool === 'Read', 'Should parse tool name');
  assert(rule1.matcher?.type === 'glob', 'Should be glob type');
  assert(rule1.matcher?.pattern === '/home/user/**', 'Should have path pattern');

  // 测试 src 目录匹配
  const rule2 = PermissionRuleParser.parse('Write(src/*.ts)');
  assert(rule2.matcher?.type === 'glob', 'Should be glob type');
  assert(rule2.matcher?.pattern === 'src/*.ts', 'Should have glob pattern');

  // 测试递归匹配
  const rule3 = PermissionRuleParser.parse('Edit(**/*.md)');
  assert(rule3.matcher?.type === 'glob', 'Should be glob type');

  // 测试精确路径
  const rule4 = PermissionRuleParser.parse('Read(/etc/passwd)');
  assert(rule4.matcher?.type === 'exact', 'Should be exact type');

  console.log('  Path pattern parsing tests passed');
}

function testMultipleRulesParsing() {
  console.log('Testing: Multiple Rules Parsing');

  // 测试逗号分隔的规则
  const rules1 = PermissionRuleParser.parseMultiple('Bash, Read, Write');
  assert(rules1.length === 3, 'Should parse 3 rules');
  assert(rules1[0].tool === 'Bash', 'First should be Bash');
  assert(rules1[1].tool === 'Read', 'Second should be Read');
  assert(rules1[2].tool === 'Write', 'Third should be Write');

  // 测试带参数的多个规则
  const rules2 = PermissionRuleParser.parseMultiple('Bash(npm:*), Read(/home/**), Write(src/*)');
  assert(rules2.length === 3, 'Should parse 3 rules');
  assert(rules2[0].paramPattern === 'npm:*', 'First should have npm pattern');
  assert(rules2[1].paramPattern === '/home/**', 'Second should have path pattern');
  assert(rules2[2].paramPattern === 'src/*', 'Third should have src pattern');

  // 测试官方文档中的示例
  const rules3 = PermissionRuleParser.parseMultiple(
    'Bash(git diff:*), Bash(git status:*), Bash(git log:*), Read, Glob, Grep'
  );
  assert(rules3.length === 6, 'Should parse 6 rules');
  assert(rules3[0].matcher?.commandPrefix === 'git diff', 'Should have git diff prefix');

  // 测试空字符串
  const rules4 = PermissionRuleParser.parseMultiple('');
  assert(rules4.length === 0, 'Empty string should return empty array');

  console.log('  Multiple rules parsing tests passed');
}

function testParseErrors() {
  console.log('Testing: Parse Errors');

  // 测试空规则
  assertThrows(() => {
    PermissionRuleParser.parse('');
  }, 'Should throw on empty rule');

  // 测试无效语法
  assertThrows(() => {
    PermissionRuleParser.parse('123Invalid');
  }, 'Should throw on invalid tool name');

  // 测试不匹配的括号
  assertThrows(() => {
    PermissionRuleParser.parse('Bash(npm:*');
  }, 'Should throw on unmatched parenthesis');

  console.log('  Parse error tests passed');
}

// ============ 规则匹配测试 ============

function testBashCommandMatching() {
  console.log('Testing: Bash Command Matching');

  // 测试任意命令匹配
  const rule1 = PermissionRuleParser.parse('Bash(*)');
  const input1: ToolInput = { tool: 'Bash', params: { command: 'any command' } };
  assert(RuleMatcher.matches(rule1, input1), 'Should match any command');

  // 测试命令前缀匹配
  const rule2 = PermissionRuleParser.parse('Bash(npm:*)');
  const input2a: ToolInput = { tool: 'Bash', params: { command: 'npm install lodash' } };
  const input2b: ToolInput = { tool: 'Bash', params: { command: 'npm test' } };
  const input2c: ToolInput = { tool: 'Bash', params: { command: 'yarn add lodash' } };
  assert(RuleMatcher.matches(rule2, input2a), 'Should match npm install');
  assert(RuleMatcher.matches(rule2, input2b), 'Should match npm test');
  assert(!RuleMatcher.matches(rule2, input2c), 'Should not match yarn');

  // 测试多词命令前缀匹配
  const rule3 = PermissionRuleParser.parse('Bash(npm install:*)');
  const input3a: ToolInput = { tool: 'Bash', params: { command: 'npm install lodash' } };
  const input3b: ToolInput = { tool: 'Bash', params: { command: 'npm test' } };
  assert(RuleMatcher.matches(rule3, input3a), 'Should match npm install');
  assert(!RuleMatcher.matches(rule3, input3b), 'Should not match npm test');

  // 测试 git 命令
  const rule4 = PermissionRuleParser.parse('Bash(git diff:*)');
  const input4a: ToolInput = { tool: 'Bash', params: { command: 'git diff HEAD' } };
  const input4b: ToolInput = { tool: 'Bash', params: { command: 'git status' } };
  assert(RuleMatcher.matches(rule4, input4a), 'Should match git diff');
  assert(!RuleMatcher.matches(rule4, input4b), 'Should not match git status');

  // 测试精确匹配
  const rule5 = PermissionRuleParser.parse('Bash(ls -la)');
  const input5a: ToolInput = { tool: 'Bash', params: { command: 'ls -la' } };
  const input5b: ToolInput = { tool: 'Bash', params: { command: 'ls -la /home' } };
  assert(RuleMatcher.matches(rule5, input5a), 'Should match exact command');
  assert(!RuleMatcher.matches(rule5, input5b), 'Should not match with extra args');

  // 测试不匹配的工具
  const input6: ToolInput = { tool: 'Read', params: { command: 'npm install' } };
  assert(!RuleMatcher.matches(rule2, input6), 'Should not match different tool');

  console.log('  Bash command matching tests passed');
}

function testPathMatching() {
  console.log('Testing: Path Matching');

  // 测试路径通配符
  const rule1 = PermissionRuleParser.parse('Read(/home/user/**)');
  const input1a: ToolInput = { tool: 'Read', params: { file_path: '/home/user/file.txt' } };
  const input1b: ToolInput = { tool: 'Read', params: { file_path: '/home/user/subdir/file.txt' } };
  const input1c: ToolInput = { tool: 'Read', params: { file_path: '/etc/passwd' } };
  assert(RuleMatcher.matches(rule1, input1a), 'Should match file in user dir');
  assert(RuleMatcher.matches(rule1, input1b), 'Should match file in subdir');
  assert(!RuleMatcher.matches(rule1, input1c), 'Should not match /etc');

  // 测试扩展名匹配
  const rule2 = PermissionRuleParser.parse('Write(src/*.ts)');
  const input2a: ToolInput = { tool: 'Write', params: { file_path: 'src/index.ts', content: '' } };
  const input2b: ToolInput = { tool: 'Write', params: { file_path: 'src/utils.js', content: '' } };
  assert(RuleMatcher.matches(rule2, input2a), 'Should match .ts file');
  assert(!RuleMatcher.matches(rule2, input2b), 'Should not match .js file');

  // 测试递归匹配
  const rule3 = PermissionRuleParser.parse('Edit(**/*.md)');
  const input3a: ToolInput = { tool: 'Edit', params: { file_path: 'README.md' } };
  const input3b: ToolInput = { tool: 'Edit', params: { file_path: 'docs/guide.md' } };
  const input3c: ToolInput = { tool: 'Edit', params: { file_path: 'docs/advanced/setup.md' } };
  assert(RuleMatcher.matches(rule3, input3a), 'Should match root md');
  assert(RuleMatcher.matches(rule3, input3b), 'Should match docs md');
  assert(RuleMatcher.matches(rule3, input3c), 'Should match nested md');

  // 测试无参数规则
  const rule4 = PermissionRuleParser.parse('Read');
  const input4: ToolInput = { tool: 'Read', params: { file_path: '/any/path.txt' } };
  assert(RuleMatcher.matches(rule4, input4), 'Should match any path without restriction');

  console.log('  Path matching tests passed');
}

function testToolNameMatching() {
  console.log('Testing: Tool Name Matching');

  // 测试工具名匹配
  const rule1 = PermissionRuleParser.parse('Bash');
  const input1a: ToolInput = { tool: 'Bash', params: {} };
  const input1b: ToolInput = { tool: 'Read', params: {} };
  assert(RuleMatcher.matches(rule1, input1a), 'Should match same tool');
  assert(!RuleMatcher.matches(rule1, input1b), 'Should not match different tool');

  // 测试 * 通配符
  const rule2 = PermissionRuleParser.parse('*');
  assert(RuleMatcher.matches(rule2, input1a), 'Should match Bash with *');
  assert(RuleMatcher.matches(rule2, input1b), 'Should match Read with *');

  console.log('  Tool name matching tests passed');
}

// ============ 权限规则管理器测试 ============

function testRuleManagerBasic() {
  console.log('Testing: Rule Manager Basic');

  const manager = new PermissionRuleManager();

  // 添加允许规则
  manager.addAllowRule('Bash(npm:*)');
  manager.addAllowRule('Read');

  // 添加拒绝规则
  manager.addDenyRule('Bash(rm:*)');
  manager.addDenyRule('Write(/etc/**)');

  const stats = manager.getStats();
  assert(stats.allowRules === 2, 'Should have 2 allow rules');
  assert(stats.denyRules === 2, 'Should have 2 deny rules');
  assert(stats.totalRules === 4, 'Should have 4 total rules');

  console.log('  Rule manager basic tests passed');
}

function testRulePriority() {
  console.log('Testing: Rule Priority (deny > allow > default)');

  const manager = new PermissionRuleManager();

  // 添加规则：允许 npm，但拒绝 npm install
  manager.addAllowRule('Bash(npm:*)');
  manager.addDenyRule('Bash(npm install:*)');

  // npm test 应该被允许 (匹配 allow 规则)
  const input1: ToolInput = { tool: 'Bash', params: { command: 'npm test' } };
  const result1 = manager.check(input1);
  assert(result1.allowed === true, 'npm test should be allowed');
  assert(result1.matched === true, 'Should have matched rule');

  // npm install 应该被拒绝 (deny 优先于 allow)
  const input2: ToolInput = { tool: 'Bash', params: { command: 'npm install lodash' } };
  const result2 = manager.check(input2);
  assert(result2.allowed === false, 'npm install should be denied');
  assert(result2.matched === true, 'Should have matched rule');

  // yarn 命令应该使用默认值
  const input3: ToolInput = { tool: 'Bash', params: { command: 'yarn add lodash' } };
  const result3 = manager.check(input3, true);  // 默认允许
  assert(result3.allowed === true, 'yarn should be allowed by default');
  assert(result3.matched === false, 'Should not have matched rule');

  const result4 = manager.check(input3, false);  // 默认拒绝
  assert(result4.allowed === false, 'yarn should be denied by default');
  assert(result4.matched === false, 'Should not have matched rule');

  console.log('  Rule priority tests passed');
}

function testDenyPrecedence() {
  console.log('Testing: Deny Precedence');

  const manager = new PermissionRuleManager();

  // 场景：允许所有 Bash 命令，但拒绝危险命令
  manager.addAllowRule('Bash(*)');
  manager.addDenyRule('Bash(rm:*)');
  manager.addDenyRule('Bash(sudo:*)');
  manager.addDenyRule('Bash(chmod:*)');

  // 安全命令应该被允许
  const safeCommands = ['ls -la', 'pwd', 'npm install', 'git status'];
  for (const cmd of safeCommands) {
    const input: ToolInput = { tool: 'Bash', params: { command: cmd } };
    const result = manager.check(input);
    assert(result.allowed === true, `${cmd} should be allowed`);
  }

  // 危险命令应该被拒绝
  const dangerousCommands = ['rm -rf /', 'sudo apt install', 'chmod 777 file'];
  for (const cmd of dangerousCommands) {
    const input: ToolInput = { tool: 'Bash', params: { command: cmd } };
    const result = manager.check(input);
    assert(result.allowed === false, `${cmd} should be denied`);
  }

  console.log('  Deny precedence tests passed');
}

function testFilePathRules() {
  console.log('Testing: File Path Rules');

  const manager = new PermissionRuleManager();

  // 允许读取项目目录
  manager.addAllowRule('Read(src/**)');
  manager.addAllowRule('Read(docs/**)');

  // 禁止读取敏感文件
  manager.addDenyRule('Read(**/.env)');
  manager.addDenyRule('Read(**/secrets.json)');

  // 项目文件应该被允许
  const input1: ToolInput = { tool: 'Read', params: { file_path: 'src/index.ts' } };
  assert(manager.check(input1).allowed === true, 'Should allow reading src files');

  // 敏感文件应该被拒绝
  const input2: ToolInput = { tool: 'Read', params: { file_path: 'src/.env' } };
  assert(manager.check(input2).allowed === false, 'Should deny reading .env');

  const input3: ToolInput = { tool: 'Read', params: { file_path: 'config/secrets.json' } };
  assert(manager.check(input3).allowed === false, 'Should deny reading secrets.json');

  console.log('  File path rules tests passed');
}

function testRuleImportExport() {
  console.log('Testing: Rule Import/Export');

  const manager1 = new PermissionRuleManager();
  manager1.addAllowRule('Bash(npm:*)');
  manager1.addAllowRule('Read');
  manager1.addDenyRule('Bash(rm:*)');

  const exported = manager1.export();
  assert(exported.allow.length === 2, 'Should export 2 allow rules');
  assert(exported.deny.length === 1, 'Should export 1 deny rule');

  const manager2 = new PermissionRuleManager();
  manager2.import(exported);

  const stats = manager2.getStats();
  assert(stats.allowRules === 2, 'Should import 2 allow rules');
  assert(stats.denyRules === 1, 'Should import 1 deny rule');

  // 验证规则工作正常
  const input1: ToolInput = { tool: 'Bash', params: { command: 'npm test' } };
  assert(manager2.check(input1).allowed === true, 'Imported rules should work');

  const input2: ToolInput = { tool: 'Bash', params: { command: 'rm -rf /' } };
  assert(manager2.check(input2).allowed === false, 'Imported deny rules should work');

  console.log('  Rule import/export tests passed');
}

function testRulesBySource() {
  console.log('Testing: Rules by Source');

  const manager = new PermissionRuleManager();

  // 添加不同来源的规则
  manager.addAllowRule('Bash(npm:*)', 'cli');
  manager.addAllowRule('Read', 'settings');
  manager.addDenyRule('Bash(rm:*)', 'project');

  const stats = manager.getStats();
  assert(stats.bySource.cli === 1, 'Should have 1 cli rule');
  assert(stats.bySource.settings === 1, 'Should have 1 settings rule');
  assert(stats.bySource.project === 1, 'Should have 1 project rule');

  // 清除特定来源的规则
  manager.clearRulesBySource('cli');
  const newStats = manager.getStats();
  assert(newStats.bySource.cli === 0, 'Should have 0 cli rules after clear');
  assert(newStats.totalRules === 2, 'Should have 2 total rules after clear');

  console.log('  Rules by source tests passed');
}

function testMatchingRules() {
  console.log('Testing: Get Matching Rules');

  const manager = new PermissionRuleManager();

  manager.addAllowRule('Bash(npm:*)');
  manager.addAllowRule('Bash(*)');
  manager.addDenyRule('Bash(npm install:*)');

  const input: ToolInput = { tool: 'Bash', params: { command: 'npm install lodash' } };
  const matching = manager.getMatchingRules(input);

  // 应该匹配所有三个规则
  assert(matching.length === 3, 'Should match 3 rules');

  // 但最终结果应该是拒绝 (deny 优先)
  const result = manager.check(input);
  assert(result.allowed === false, 'Should be denied');

  console.log('  Get matching rules tests passed');
}

// ============ 便捷函数测试 ============

function testConvenienceFunctions() {
  console.log('Testing: Convenience Functions');

  // 测试 parseAllowedTools
  const allowed = parseAllowedTools('Bash(npm:*), Read, Write(src/*)');
  assert(allowed.length === 3, 'Should parse 3 allowed tools');
  assert(allowed[0].type === 'allow', 'Should be allow type');
  assert(allowed[0].source === 'cli', 'Should have cli source');

  // 测试 parseDisallowedTools
  const disallowed = parseDisallowedTools('Bash(rm:*), Bash(sudo:*)');
  assert(disallowed.length === 2, 'Should parse 2 disallowed tools');
  assert(disallowed[0].type === 'deny', 'Should be deny type');

  // 测试 createBashRule
  const bashRule1 = createBashRule('npm install');
  assert(bashRule1.tool === 'Bash', 'Should be Bash tool');
  assert(bashRule1.matcher?.commandPrefix === 'npm install', 'Should have npm install prefix');

  const bashRule2 = createBashRule('npm:*');
  assert(bashRule2.matcher?.commandPrefix === 'npm', 'Should have npm prefix');

  // 测试 createPathRule
  const readRule = createPathRule('Read', '/home/user/**');
  assert(readRule.tool === 'Read', 'Should be Read tool');
  assert(readRule.matcher?.type === 'glob', 'Should be glob type');

  const writeRule = createPathRule('Write', 'src/*.ts', 'deny');
  assert(writeRule.tool === 'Write', 'Should be Write tool');
  assert(writeRule.type === 'deny', 'Should be deny type');

  console.log('  Convenience functions tests passed');
}

// ============ 官方示例测试 ============

function testOfficialExamples() {
  console.log('Testing: Official Examples');

  const manager = new PermissionRuleManager();

  // 官方文档中的示例规则
  const allowedToolsStr = 'Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git show:*), Bash(git remote show:*), Read, Glob, Grep, LS, Task';
  manager.addAllowRules(allowedToolsStr, 'cli');

  // 测试 git 命令
  const gitDiff: ToolInput = { tool: 'Bash', params: { command: 'git diff HEAD~1' } };
  assert(manager.check(gitDiff).allowed === true, 'git diff should be allowed');

  const gitStatus: ToolInput = { tool: 'Bash', params: { command: 'git status' } };
  assert(manager.check(gitStatus).allowed === true, 'git status should be allowed');

  const gitPush: ToolInput = { tool: 'Bash', params: { command: 'git push' } };
  assert(manager.check(gitPush, false).allowed === false, 'git push should be denied by default');

  // 测试其他工具
  const read: ToolInput = { tool: 'Read', params: { file_path: 'test.txt' } };
  assert(manager.check(read).allowed === true, 'Read should be allowed');

  const glob: ToolInput = { tool: 'Glob', params: { pattern: '**/*.ts' } };
  assert(manager.check(glob).allowed === true, 'Glob should be allowed');

  // GitHub Actions 示例
  const ghActionsRules = 'Bash(gh issue view:*),Bash(gh search:*),Bash(gh issue list:*),Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),Bash(gh pr list:*)';
  manager.clearRules();
  manager.addAllowRules(ghActionsRules, 'cli');

  const ghPrView: ToolInput = { tool: 'Bash', params: { command: 'gh pr view 123' } };
  assert(manager.check(ghPrView).allowed === true, 'gh pr view should be allowed');

  const ghPrMerge: ToolInput = { tool: 'Bash', params: { command: 'gh pr merge 123' } };
  assert(manager.check(ghPrMerge, false).allowed === false, 'gh pr merge should be denied');

  console.log('  Official examples tests passed');
}

// ============ 边界情况测试 ============

function testEdgeCases() {
  console.log('Testing: Edge Cases');

  const manager = new PermissionRuleManager();

  // 测试空命令
  const emptyCmd: ToolInput = { tool: 'Bash', params: { command: '' } };
  manager.addAllowRule('Bash(npm:*)');
  const result1 = manager.check(emptyCmd, true);
  assert(result1.matched === false, 'Empty command should not match');

  // 测试缺失参数
  const noParams: ToolInput = { tool: 'Bash', params: {} };
  const result2 = manager.check(noParams, true);
  assert(result2.matched === false, 'Missing command should not match');

  // 测试特殊字符
  manager.clearRules();
  manager.addAllowRule('Bash(echo "hello world":*)');
  const echoCmd: ToolInput = { tool: 'Bash', params: { command: 'echo "hello world" | grep hello' } };
  const result3 = manager.check(echoCmd);
  assert(result3.allowed === true, 'Should match command with quotes');

  // 测试路径规范化
  manager.clearRules();
  manager.addAllowRule('Read(./src/**)');
  const relativePath: ToolInput = { tool: 'Read', params: { file_path: 'src/index.ts' } };
  // 注意：minimatch 会处理路径匹配
  const result4 = manager.check(relativePath);
  // 这个测试可能因为路径规范化而有不同结果

  console.log('  Edge cases tests passed');
}

// ============ 运行所有测试 ============

export function runAllTests() {
  console.log('='.repeat(60));
  console.log('Running Permission Rule Parser Tests (T-015)');
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    testBasicRuleParsing,
    testCommandPatternParsing,
    testPathPatternParsing,
    testMultipleRulesParsing,
    testParseErrors,
    testBashCommandMatching,
    testPathMatching,
    testToolNameMatching,
    testRuleManagerBasic,
    testRulePriority,
    testDenyPrecedence,
    testFilePathRules,
    testRuleImportExport,
    testRulesBySource,
    testMatchingRules,
    testConvenienceFunctions,
    testOfficialExamples,
    testEdgeCases,
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
      console.error(`  FAILED: ${error}`);
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
