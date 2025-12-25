# 权限策略引擎 (Policy Engine)

基于声明式策略语言的高级权限决策系统。

## 概述

权限策略引擎提供了一个灵活、可扩展的权限管理框架，支持：

- **声明式策略定义** - 使用 JSON 格式定义复杂权限规则
- **策略评估** - 自动评估权限请求并做出决策
- **策略组合** - 支持多策略并存，自动解决冲突
- **策略持久化** - 保存和加载策略配置
- **策略验证** - 验证策略定义的正确性

## 核心概念

### 1. 策略 (Policy)

策略是一组相关规则的集合，包含：

```typescript
interface Policy {
  id: string;              // 唯一标识符
  name: string;            // 策略名称
  description?: string;    // 描述
  priority: number;        // 优先级（越高越先评估）
  effect: 'allow' | 'deny'; // 默认效果
  rules: PolicyRule[];     // 规则列表
  enabled?: boolean;       // 是否启用
}
```

### 2. 规则 (PolicyRule)

规则定义具体的权限决策逻辑：

```typescript
interface PolicyRule {
  id: string;              // 规则 ID
  description?: string;    // 描述
  condition: PolicyCondition; // 匹配条件
  effect: 'allow' | 'deny';   // 效果
  priority?: number;       // 规则优先级
}
```

### 3. 条件 (PolicyCondition)

条件支持复杂的逻辑组合：

```typescript
interface PolicyCondition {
  // 逻辑操作符
  and?: PolicyCondition[];
  or?: PolicyCondition[];
  not?: PolicyCondition;

  // 字段匹配
  type?: PermissionType | PermissionType[];
  tool?: string | string[] | RegExp;
  resource?: string | string[] | RegExp;
  path?: string | string[];  // glob patterns

  // 时间条件
  timeRange?: { start?: string; end?: string };
  dateRange?: { start?: string; end?: string };
  daysOfWeek?: number[];

  // 环境条件
  environment?: Record<string, string | RegExp>;

  // 自定义条件
  custom?: (request: PermissionRequest) => boolean;
}
```

## 快速开始

### 基本使用

```typescript
import { PolicyEngine, PolicyBuilder, RuleBuilder } from './policy.js';

// 创建策略引擎
const engine = new PolicyEngine();

// 创建策略
const policy = new PolicyBuilder('my-policy', 'My First Policy')
  .priority(100)
  .defaultEffect('deny')
  .addRule(
    new RuleBuilder('allow-reads', 'allow')
      .type('file_read')
      .description('Allow all file reads')
      .build()
  )
  .build();

// 添加策略
engine.addPolicy(policy);

// 评估权限请求
const request = {
  type: 'file_read',
  tool: 'Read',
  description: 'Read file',
  resource: '/path/to/file.txt',
};

const decision = engine.evaluate(request);
console.log(decision.allowed); // true
```

### 使用预定义模板

```typescript
import {
  createReadOnlyPolicy,
  createWorkHoursPolicy,
  createPathWhitelistPolicy,
} from './policy.js';

// 只读模式
engine.addPolicy(createReadOnlyPolicy());

// 工作时间限制
engine.addPolicy(createWorkHoursPolicy('work-hours', '09:00', '18:00'));

// 路径白名单
engine.addPolicy(
  createPathWhitelistPolicy('whitelist', [
    '/home/user/projects/**',
    '/tmp/**',
  ])
);
```

## 高级功能

### 1. 复杂条件组合

```typescript
const policy = {
  id: 'complex',
  name: 'Complex Policy',
  priority: 200,
  effect: 'deny',
  rules: [
    {
      id: 'business-hours',
      effect: 'allow',
      condition: {
        and: [
          { type: 'file_write' },
          { timeRange: { start: '09:00', end: '18:00' } },
          { daysOfWeek: [1, 2, 3, 4, 5] }, // Mon-Fri
          {
            or: [
              { path: ['/home/user/projects/**'] },
              { path: ['/tmp/**'] },
            ],
          },
        ],
      },
    },
  ],
};
```

### 2. 正则表达式匹配

```typescript
const rule = {
  id: 'deny-dangerous',
  effect: 'deny',
  condition: {
    and: [
      { type: 'bash_command' },
      { resource: /^(rm -rf|sudo rm|mkfs|dd)/ },
    ],
  },
};
```

### 3. 自定义条件函数

```typescript
const rule = {
  id: 'custom-logic',
  effect: 'allow',
  condition: {
    custom: (request) => {
      // 自定义逻辑
      if (!request.resource) return false;
      const ext = request.resource.split('.').pop();
      return ['ts', 'js', 'json'].includes(ext || '');
    },
  },
};
```

### 4. 环境变量条件

```typescript
const rule = {
  id: 'dev-only',
  effect: 'allow',
  condition: {
    environment: {
      NODE_ENV: 'development',
      DEBUG: /^true|1$/,
    },
  },
};
```

### 5. 策略持久化

```typescript
// 保存策略
await engine.savePolicies('policies.json');

// 加载策略
await engine.loadPolicies('policies.json');

// 保存特定策略
await engine.savePolicies('my-policies.json', ['policy-1', 'policy-2']);
```

## 冲突解决策略

当多个策略产生不同决策时，PolicyEngine 使用以下规则解决冲突：

1. **Deny 优先** - 拒绝决策优先于允许决策（安全优先）
2. **优先级排序** - 高优先级策略优先于低优先级策略
3. **显式优先** - 显式匹配的规则优先于默认效果

```typescript
// 示例：冲突解决
const allowPolicy = {
  id: 'allow-all',
  priority: 100,
  effect: 'allow',
  rules: [{ id: 'allow', effect: 'allow', condition: {} }],
};

const denyPolicy = {
  id: 'deny-config',
  priority: 200, // 更高优先级
  effect: 'deny',
  rules: [
    {
      id: 'deny',
      effect: 'deny',
      condition: { path: ['**/.config/**'] },
    },
  ],
};

// deny-config 的决策会胜出（优先级更高且是 deny）
```

## 策略验证

```typescript
const validation = engine.validatePolicy(policy);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

if (validation.warnings) {
  console.warn('Warnings:', validation.warnings);
}
```

验证检查包括：
- 必填字段检查
- 类型验证
- 条件格式验证（时间、日期格式）
- 重复 ID 检查

## 调试和监控

```typescript
// 启用调试模式
const engine = new PolicyEngine(undefined, true);

// 或运行时启用
engine.setDebug(true);

// 获取统计信息
const stats = engine.getStats();
console.log(stats);
// {
//   totalPolicies: 5,
//   enabledPolicies: 4,
//   disabledPolicies: 1,
//   totalRules: 12
// }

// 导出引擎状态
const state = engine.export();
```

## 策略管理 API

```typescript
// 添加策略
engine.addPolicy(policy);

// 获取策略
const policy = engine.getPolicy('policy-id');

// 列出所有策略
const policies = engine.listPolicies();

// 更新策略
engine.updatePolicy('policy-id', { priority: 200 });

// 移除策略
engine.removePolicy('policy-id');

// 启用/禁用策略
engine.enablePolicy('policy-id');
engine.disablePolicy('policy-id');

// 清空所有策略
engine.clearPolicies();
```

## 与 PermissionManager 集成

PolicyEngine 可以与现有的 PermissionManager 配合使用：

```typescript
import { PermissionManager } from './index.js';
import { PolicyEngine } from './policy.js';

class EnhancedPermissionManager extends PermissionManager {
  private policyEngine: PolicyEngine;

  constructor(mode, configDir) {
    super(mode);
    this.policyEngine = new PolicyEngine(configDir);
  }

  async check(request) {
    // 先使用策略引擎评估
    const policyDecision = this.policyEngine.evaluate(request);

    if (policyDecision.allowed !== undefined) {
      return {
        allowed: policyDecision.allowed,
        reason: policyDecision.reason,
      };
    }

    // 回退到原有逻辑
    return super.check(request);
  }
}
```

## 实际应用场景

### 1. 开发环境策略

```typescript
const devPolicy = new PolicyBuilder('dev-env', 'Development Environment')
  .priority(100)
  .defaultEffect('allow')
  .addRule(
    new RuleBuilder('restrict-system', 'deny')
      .path(['/etc/**', '/sys/**', '/proc/**'])
      .build()
  )
  .build();
```

### 2. 生产环境策略

```typescript
const prodPolicy = new PolicyBuilder('prod-env', 'Production Environment')
  .priority(100)
  .defaultEffect('deny')
  .addRule(
    new RuleBuilder('allow-app-dir', 'allow')
      .path(['/app/**'])
      .type(['file_read', 'file_write'])
      .build()
  )
  .addRule(
    new RuleBuilder('allow-monitoring', 'allow')
      .type('bash_command')
      .resource(/^(ps|top|df|free|uptime)/)
      .build()
  )
  .build();
```

### 3. 审计模式策略

```typescript
const auditPolicy = new PolicyBuilder('audit', 'Audit Mode')
  .priority(1000)
  .defaultEffect('allow')
  .addRule(
    new RuleBuilder('log-all', 'allow')
      .description('Log all operations')
      .custom((request) => {
        console.log('[AUDIT]', request);
        return true;
      })
      .build()
  )
  .build();
```

## 性能考虑

- **策略数量** - 建议保持策略数量在 10 个以内
- **规则数量** - 每个策略建议不超过 20 个规则
- **自定义函数** - 避免在自定义条件中执行耗时操作
- **正则表达式** - 复杂正则表达式可能影响性能

## 最佳实践

1. **使用有意义的 ID 和名称** - 便于调试和维护
2. **适当设置优先级** - 关键策略使用更高优先级
3. **添加描述信息** - 记录策略和规则的用途
4. **定期验证策略** - 使用 `validatePolicy()` 检查配置
5. **使用模板** - 利用预定义模板快速创建常见策略
6. **分离关注点** - 不同用途的规则放在不同策略中
7. **测试策略** - 编写测试用例验证策略行为

## 完整示例

参见 `policy.example.ts` 文件，包含 9 个完整的使用示例。

## API 参考

### PolicyEngine

- `constructor(configDir?: string, debug?: boolean)`
- `evaluate(request: PermissionRequest, context?: Partial<EvaluationContext>): PolicyDecision`
- `addPolicy(policy: Policy): void`
- `removePolicy(id: string): void`
- `updatePolicy(id: string, updates: Partial<Policy>): void`
- `getPolicy(id: string): Policy | undefined`
- `listPolicies(): Policy[]`
- `enablePolicy(id: string): void`
- `disablePolicy(id: string): void`
- `loadPolicies(path: string): Promise<void>`
- `savePolicies(path: string, policyIds?: string[]): Promise<void>`
- `resolveConflicts(decisions: PolicyDecision[]): PolicyDecision`
- `validatePolicy(policy: Policy): PolicyValidationResult`
- `setDebug(enabled: boolean): void`
- `export(): object`
- `getStats(): object`

### PolicyBuilder

流畅 API 用于构建策略：

```typescript
new PolicyBuilder(id, name)
  .description(desc)
  .priority(priority)
  .defaultEffect(effect)
  .addRule(rule)
  .build();
```

### RuleBuilder

流畅 API 用于构建规则：

```typescript
new RuleBuilder(id, effect)
  .description(desc)
  .priority(priority)
  .type(type)
  .tool(tool)
  .resource(resource)
  .path(path)
  .custom(fn)
  .build();
```

### 预定义模板

- `createReadOnlyPolicy(id?: string): Policy`
- `createWorkHoursPolicy(id?: string, start?: string, end?: string): Policy`
- `createPathWhitelistPolicy(id: string, paths: string[]): Policy`

## 故障排查

### 策略不生效

1. 检查策略是否已启用：`policy.enabled !== false`
2. 检查策略优先级：高优先级策略先评估
3. 检查条件匹配：使用调试模式查看评估过程

### 意外的决策结果

1. 检查冲突解决规则：deny 优先于 allow
2. 检查多个策略之间的交互
3. 使用 `validatePolicy()` 验证策略定义

### 性能问题

1. 减少策略和规则数量
2. 优化正则表达式
3. 避免在自定义函数中执行耗时操作

## 更新日志

### v1.0.0 (2025-12-25)

- 初始版本
- 支持声明式策略语言
- 支持复杂条件组合
- 支持策略持久化
- 支持策略验证
- 提供预定义模板
