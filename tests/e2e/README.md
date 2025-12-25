# E2E 测试框架

端到端测试框架，用于测试 Claude Code CLI 的完整功能。

## 目录结构

```
tests/e2e/
├── setup.ts              # E2E 测试环境设置
├── cli-runner.ts         # CLI 执行器
├── mock-server.ts        # Mock API 服务器
├── cli-basic.test.ts     # 基础 CLI 功能测试
├── cli-session.test.ts   # 会话持久化测试
├── cli-tools.test.ts     # 工具调用测试
├── run-all.ts            # 测试运行器
└── README.md             # 本文件
```

## 快速开始

### 运行所有测试

```bash
npm run test:e2e
```

### 运行单个测试文件

```bash
# 基础功能测试
npm run test:e2e:basic

# 会话测试
npm run test:e2e:session

# 工具测试
npm run test:e2e:tools
```

### 手动运行

```bash
# 使用 tsx 运行单个测试
tsx tests/e2e/cli-basic.test.ts

# 运行所有测试
tsx tests/e2e/run-all.ts
```

## 测试框架组件

### 1. setup.ts - 测试环境设置

提供测试前的初始化和测试后的清理功能。

**主要功能:**
- `setupE2ETest()` - 初始化测试环境
- `teardownE2ETest()` - 清理测试环境
- `createTestFile()` - 创建测试文件
- `assert*()` - 断言辅助函数

**使用示例:**

```typescript
import { setupE2ETest, teardownE2ETest, assert } from './setup.js';

const context = await setupE2ETest('my-test');

try {
  // 运行测试
  assert(someCondition, 'Error message');
} finally {
  await teardownE2ETest(context);
}
```

### 2. cli-runner.ts - CLI 执行器

提供编程方式运行 CLI 命令并捕获输出。

**主要功能:**
- `runCLI()` - 运行 CLI 命令
- `InteractiveCLISession` - 交互式会话
- `runSimpleCommand()` - 运行简单命令
- `simulateInteraction()` - 模拟用户交互

**使用示例:**

```typescript
import { runCLI, InteractiveCLISession } from './cli-runner.js';

// 运行简单命令
const result = await runCLI(['--version']);
console.log(result.stdout);

// 交互式会话
const session = new InteractiveCLISession();
await session.start();
session.writeLine('Hello');
await session.waitForOutput('Response');
await session.stop();
```

### 3. mock-server.ts - Mock API 服务器

模拟 Anthropic API 用于测试，无需真实 API 调用。

**主要功能:**
- `start()` - 启动服务器
- `stop()` - 停止服务器
- `setTextResponse()` - 设置文本响应
- `setToolUseResponse()` - 设置工具使用响应
- `getRequests()` - 获取请求历史

**使用示例:**

```typescript
import { MockApiServer } from './mock-server.js';

const server = new MockApiServer();
await server.start();

// 设置响应
server.setTextResponse('Hello from mock API!');

// 设置工具使用
server.setToolUseResponse('Read', {
  file_path: '/test/file.txt'
}, 'Reading file...');

// 检查请求
const requests = server.getRequests();
console.log(requests[0].body);

await server.stop();
```

## 测试文件

### cli-basic.test.ts - 基础功能测试

测试 CLI 的基本功能，包括:
- ✓ 版本信息显示
- ✓ 帮助信息显示
- ✓ 打印模式 (-p)
- ✓ 模型选择 (-m)
- ✓ 详细模式 (--verbose)
- ✓ JSON 输出格式
- ✓ API 密钥验证
- ✓ 调试模式 (-d)
- ✓ 工作目录参数
- ✓ 无效参数处理

### cli-session.test.ts - 会话持久化测试

测试会话管理功能，包括:
- ✓ 创建新会话
- ✓ 保存会话历史
- ✓ 会话恢复 (--resume)
- ✓ 会话列表
- ✓ 指定 ID 恢复
- ✓ 会话过期处理
- ✓ 工作目录保存
- ✓ 成本统计跟踪

### cli-tools.test.ts - 工具调用测试

测试各种工具的调用，包括:
- ✓ Read 工具读取文件
- ✓ Write 工具创建文件
- ✓ Edit 工具编辑文件
- ✓ Bash 工具执行命令
- ✓ Glob 工具查找文件
- ✓ Grep 工具搜索内容
- ✓ TodoWrite 工具管理任务
- ✓ 工具过滤 (--allow-tools)
- ✓ 工具黑名单 (--disallow-tools)
- ✓ 多轮工具调用
- ✓ WebFetch 工具

## 编写新测试

### 基本结构

```typescript
import {
  setupE2ETest,
  teardownE2ETest,
  assert,
  assertContains,
  runTestSuite
} from './setup.js';
import { runCLI } from './cli-runner.js';

const tests = [
  {
    name: '测试名称',
    fn: async () => {
      const context = await setupE2ETest('test-id');

      try {
        // 设置 Mock 响应
        context.mockServer.setTextResponse('Response');

        // 运行 CLI
        const result = await runCLI(['-p', 'prompt'], {
          env: {
            ...process.env,
            ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
            ANTHROPIC_API_KEY: 'test-key'
          }
        });

        // 断言
        assert(result.exitCode === 0, '应该成功');
        assertContains(result.stdout, 'Response', '应该包含响应');

      } finally {
        await teardownE2ETest(context);
      }
    }
  }
];

async function runTests() {
  const result = await runTestSuite({
    name: '我的测试套件',
    tests
  });

  if (result.failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
```

### 断言函数

```typescript
// 基础断言
assert(condition, 'Error message');

// 相等断言
assertEqual(actual, expected, 'Error message');

// 包含断言
assertContains(text, substring, 'Error message');

// 不包含断言
assertNotContains(text, substring, 'Error message');

// 正则匹配
assertMatch(text, /pattern/, 'Error message');
```

### Mock 服务器配置

```typescript
// 文本响应
context.mockServer.setTextResponse('Simple text');

// 工具使用响应
context.mockServer.setToolUseResponse(
  'ToolName',
  { param: 'value' },
  'Optional message'
);

// 自定义响应处理器
context.mockServer.setResponseHandler('messages', (req) => {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Custom response' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 }
  };
});

// 检查请求
const requests = context.mockServer.getRequests();
const lastRequest = context.mockServer.getLastRequest();
```

## 测试最佳实践

### 1. 使用独立的测试环境

每个测试应该使用独立的临时目录:

```typescript
const context = await setupE2ETest('unique-test-id');
// 测试代码
await teardownE2ETest(context);
```

### 2. 清理资源

始终在 `finally` 块中清理:

```typescript
try {
  // 测试代码
} finally {
  await teardownE2ETest(context);
}
```

### 3. 设置合理的超时

为长时间运行的测试设置足够的超时:

```typescript
const result = await runCLI(args, {
  timeout: 30000  // 30 秒
});
```

### 4. 验证多个方面

不仅验证成功，还要验证失败情况:

```typescript
// 成功情况
assert(result.exitCode === 0, '应该成功');

// 失败情况
assert(result.exitCode !== 0, '应该失败');
assertContains(result.stderr, 'error', '应该显示错误');
```

### 5. 使用描述性的测试名称

```typescript
// 好的测试名称
'应该在缺少 API 密钥时显示错误'

// 不好的测试名称
'测试 API'
```

## 调试测试

### 启用详细输出

```typescript
const result = await runCLI(args, {
  captureStderr: true  // 捕获错误输出
});

console.log('stdout:', result.stdout);
console.log('stderr:', result.stderr);
```

### 查看 Mock 服务器日志

```typescript
const server = new MockApiServer({
  logRequests: true  // 启用请求日志
});
```

### 检查请求历史

```typescript
const requests = context.mockServer.getRequests();
console.log('所有请求:', JSON.stringify(requests, null, 2));

const lastRequest = context.mockServer.getLastRequest();
console.log('最后请求:', JSON.stringify(lastRequest, null, 2));
```

## 持续集成

在 CI 环境中运行测试:

```bash
# GitHub Actions 示例
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    NODE_ENV: test
```

## 故障排除

### 测试超时

增加超时时间或优化测试:

```typescript
const result = await runCLI(args, {
  timeout: 60000  // 增加到 60 秒
});
```

### 端口冲突

Mock 服务器会自动选择可用端口:

```typescript
const server = new MockApiServer({
  port: 0  // 自动分配端口
});
await server.start();
console.log('Server port:', server.port);
```

### 清理失败

确保正确使用 try-finally:

```typescript
const context = await setupE2ETest('test');
try {
  // 测试代码
} finally {
  await teardownE2ETest(context);  // 总是执行
}
```

## 扩展测试框架

### 添加新的断言函数

在 `setup.ts` 中添加:

```typescript
export function assertArrayEqual<T>(
  actual: T[],
  expected: T[],
  message: string
): void {
  assertEqual(actual.length, expected.length, `${message} (length)`);
  for (let i = 0; i < actual.length; i++) {
    assertEqual(actual[i], expected[i], `${message} [${i}]`);
  }
}
```

### 添加新的 CLI 辅助函数

在 `cli-runner.ts` 中添加:

```typescript
export async function runWithSession(
  sessionId: string,
  prompt: string,
  options: CLIRunOptions = {}
): Promise<CLIRunResult> {
  return runCLI(['--resume', sessionId, '-p', prompt], options);
}
```

### 扩展 Mock 服务器

在 `mock-server.ts` 中添加新的响应类型:

```typescript
setStreamingResponse(chunks: string[]): void {
  this.setResponseHandler('messages', async (req) => {
    // 实现流式响应
  });
}
```

## 资源

- [测试文档](../../docs/)
- [CLI 文档](../../README.md)
- [贡献指南](../../CONTRIBUTING.md)

## 许可证

MIT
