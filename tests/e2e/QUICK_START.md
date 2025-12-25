# E2E 测试快速开始

5 分钟快速入门 E2E 测试框架。

## 1. 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定测试套件
npm run test:e2e:basic    # 基础功能
npm run test:e2e:session  # 会话管理
npm run test:e2e:tools    # 工具调用
```

## 2. 编写第一个测试

创建 `tests/e2e/my-test.test.ts`:

```typescript
import {
  setupE2ETest,
  teardownE2ETest,
  assertContains,
  runTestSuite
} from './setup.js';
import { runCLI } from './cli-runner.js';

const tests = [
  {
    name: '我的第一个测试',
    fn: async () => {
      const context = await setupE2ETest('my-test');

      try {
        // 设置 Mock 响应
        context.mockServer.setTextResponse('Hello World!');

        // 运行 CLI
        const result = await runCLI(['-p', 'Say hello'], {
          timeout: 10000,
          env: {
            ...process.env,
            ANTHROPIC_BASE_URL: `http://localhost:${context.mockServer.port}`,
            ANTHROPIC_API_KEY: 'test-key'
          }
        });

        // 验证
        assertContains(result.stdout, 'Hello World!', '应该有响应');

      } finally {
        await teardownE2ETest(context);
      }
    }
  }
];

async function runTests() {
  const result = await runTestSuite({ name: '我的测试', tests });
  if (result.failed > 0) process.exit(1);
}

runTests().catch(console.error);
```

运行测试:
```bash
tsx tests/e2e/my-test.test.ts
```

## 3. 常用模式

### 测试文件操作
```typescript
import { createTestFile, readTestFile } from './setup.js';

// 创建测试文件
const file = createTestFile(context.testDir, 'test.txt', 'content');

// 读取文件
const content = readTestFile(file);
```

### 测试工具调用
```typescript
// 设置工具响应
context.mockServer.setToolUseResponse(
  'Read',                    // 工具名
  { file_path: '/test' },    // 工具输入
  'Reading file...'          // 可选消息
);
```

### 验证请求
```typescript
// 获取所有请求
const requests = context.mockServer.getRequests();

// 获取最后一个请求
const lastRequest = context.mockServer.getLastRequest();

// 验证
assert(lastRequest.body.model === 'claude-opus-4-5-20251101');
```

### 交互式测试
```typescript
import { InteractiveCLISession } from './cli-runner.js';

const session = new InteractiveCLISession();
await session.start();
session.writeLine('input');
await session.waitForOutput('expected');
await session.stop();
```

## 4. 断言函数

```typescript
// 基础断言
assert(condition, 'message');

// 相等
assertEqual(actual, expected, 'message');

// 包含
assertContains(text, 'substring', 'message');

// 不包含
assertNotContains(text, 'substring', 'message');

// 正则匹配
assertMatch(text, /pattern/, 'message');
```

## 5. Mock 服务器

```typescript
// 文本响应
context.mockServer.setTextResponse('Hello!');

// 工具使用
context.mockServer.setToolUseResponse('Read', { file_path: '/test' });

// 自定义处理器
context.mockServer.setResponseHandler('messages', (req) => {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Custom' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 }
  };
});
```

## 6. 调试

```typescript
// 打印输出
console.log('stdout:', result.stdout);
console.log('stderr:', result.stderr);

// 查看请求
const requests = context.mockServer.getRequests();
console.log('Requests:', JSON.stringify(requests, null, 2));

// 启用服务器日志
const server = new MockApiServer({ logRequests: true });
```

## 7. 完整示例

查看 `tests/e2e/example.test.ts` 获取更多示例。

## 需要帮助?

- 查看 [README.md](./README.md) 完整文档
- 查看 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 实现细节
- 运行示例: `tsx tests/e2e/example.test.ts`

## 常见问题

**Q: 测试超时怎么办?**
A: 增加超时: `runCLI(args, { timeout: 30000 })`

**Q: 如何测试错误情况?**
A: 验证退出码: `assert(result.exitCode !== 0)`

**Q: 如何清理测试文件?**
A: 使用 try-finally: `finally { await teardownE2ETest(context); }`

**Q: 如何测试多轮对话?**
A: 使用 `setResponseHandler` 并计数调用次数
