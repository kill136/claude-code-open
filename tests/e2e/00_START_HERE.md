# 🚀 E2E 测试框架 - 从这里开始

欢迎使用 Claude Code CLI E2E 测试框架！

## 📚 文档导航

### 🎯 我是新手，想快速开始
👉 [QUICK_START.md](./QUICK_START.md) - **5分钟快速入门**
- 如何运行测试
- 编写第一个测试
- 常用代码模式

### 📖 我想全面了解框架
👉 [README.md](./README.md) - **完整使用文档**
- 框架架构详解
- 所有 API 参考
- 最佳实践指南

### 🔍 我想查找特定内容
👉 [INDEX.md](./INDEX.md) - **文件索引导航**
- 文件结构图
- 快速查找
- 依赖关系

### 🛠️ 我想了解技术细节
👉 [IMPLEMENTATION.md](./IMPLEMENTATION.md) - **技术实现报告**
- 架构设计
- 核心 API
- 扩展指南

### 📊 我想查看完成情况
👉 [T095_SUMMARY.md](./T095_SUMMARY.md) - **任务完成总结**
- 交付成果
- 统计数据
- 质量保证

### 💡 我想看代码示例
👉 [example.test.ts](./example.test.ts) - **测试代码示例**
- 5个完整示例
- 可直接运行
- 注释详细

## 🎬 快速开始

### 运行所有测试
```bash
npm run test:e2e
```

### 运行单个测试套件
```bash
npm run test:e2e:basic    # 基础 CLI 功能
npm run test:e2e:session  # 会话持久化
npm run test:e2e:tools    # 工具调用
```

### 运行示例
```bash
tsx tests/e2e/example.test.ts
```

## 📂 文件结构

```
tests/e2e/
│
├── 📘 文档入口
│   └── 00_START_HERE.md      ← 你在这里！
│
├── 📚 使用文档
│   ├── QUICK_START.md        - 快速入门（5分钟）
│   ├── README.md             - 完整文档（全面）
│   ├── INDEX.md              - 文件索引（导航）
│   ├── IMPLEMENTATION.md     - 技术报告（深入）
│   └── T095_SUMMARY.md       - 完成总结（概览）
│
├── 🔧 核心框架
│   ├── setup.ts              - 测试环境设置
│   ├── cli-runner.ts         - CLI 执行器
│   └── mock-server.ts        - Mock API 服务器
│
├── 🧪 测试套件
│   ├── cli-basic.test.ts     - 基础功能（12个测试）
│   ├── cli-session.test.ts   - 会话管理（8个测试）
│   └── cli-tools.test.ts     - 工具调用（11个测试）
│
└── 🎯 辅助工具
    ├── example.test.ts       - 代码示例（5个示例）
    └── run-all.ts           - 测试运行器
```

## 🎓 学习路径

### 路径 1: 快速上手（推荐新手）
1. 阅读本文件 ✓ 你已经在做了！
2. 阅读 [QUICK_START.md](./QUICK_START.md)
3. 运行 `npm run test:e2e`
4. 查看 [example.test.ts](./example.test.ts)
5. 编写你的第一个测试

**预计时间**: 15-30 分钟

### 路径 2: 深入学习（推荐开发者）
1. 阅读 [README.md](./README.md) 完整文档
2. 研究核心框架文件
   - [setup.ts](./setup.ts)
   - [cli-runner.ts](./cli-runner.ts)
   - [mock-server.ts](./mock-server.ts)
3. 分析测试套件
   - [cli-basic.test.ts](./cli-basic.test.ts)
   - [cli-session.test.ts](./cli-session.test.ts)
   - [cli-tools.test.ts](./cli-tools.test.ts)
4. 编写复杂测试场景

**预计时间**: 1-2 小时

### 路径 3: 扩展框架（推荐贡献者）
1. 阅读 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 技术细节
2. 了解架构设计和核心 API
3. 查看扩展指南
4. 添加新功能或改进

**预计时间**: 2-4 小时

## 💡 核心概念

### E2E 测试是什么？
端到端测试模拟真实用户场景，测试整个应用流程。

### 为什么需要 E2E 测试？
- ✅ 验证完整功能流程
- ✅ 发现集成问题
- ✅ 确保用户体验
- ✅ 回归测试保护

### 这个框架提供什么？
- ✅ 隔离的测试环境
- ✅ Mock API 服务器（无需真实密钥）
- ✅ CLI 程序化执行
- ✅ 丰富的测试工具
- ✅ 完善的文档

## 🎯 测试覆盖

### 已实现（36个测试用例）
- ✅ 基础 CLI 功能（12个）
- ✅ 会话管理（8个）
- ✅ 工具调用（11个）
- ✅ 代码示例（5个）

### 测试内容
- ✅ 命令行参数和选项
- ✅ 版本和帮助信息
- ✅ 会话创建、保存、恢复
- ✅ 工具注册和调用
- ✅ API 请求验证
- ✅ 错误处理

## 🔧 核心 API 预览

### 测试环境
```typescript
const context = await setupE2ETest('test-name');
try {
  // 你的测试代码
} finally {
  await teardownE2ETest(context);
}
```

### CLI 执行
```typescript
const result = await runCLI(['-p', 'prompt']);
console.log(result.stdout);
```

### Mock 服务器
```typescript
context.mockServer.setTextResponse('Hello!');
context.mockServer.setToolUseResponse('Read', { file_path: '/test' });
```

### 断言
```typescript
assert(condition, 'message');
assertEqual(actual, expected, 'message');
assertContains(text, 'substring', 'message');
```

## 📊 统计数据

| 指标 | 数值 |
|------|------|
| 总文件数 | 13 |
| 代码行数 | ~4,200 |
| 测试用例 | 36 |
| 核心框架 | 3 个文件 |
| 测试套件 | 4 个文件 |
| 文档文件 | 6 个文件 |

## 🆘 需要帮助？

### 常见问题
**Q: 测试超时怎么办？**
A: 增加超时时间 `runCLI(args, { timeout: 30000 })`

**Q: 如何调试测试？**
A: 查看输出 `console.log(result.stdout, result.stderr)`

**Q: 如何验证 API 请求？**
A: 使用 `context.mockServer.getRequests()`

更多问题请查看 [README.md](./README.md) 的故障排除章节。

### 获取支持
1. 查看文档：各个 .md 文件
2. 运行示例：`tsx tests/e2e/example.test.ts`
3. 查看测试：分析现有测试套件

## 🎉 你准备好了！

选择一个学习路径，开始你的 E2E 测试之旅吧！

### 推荐起点
1. **新手**: 👉 [QUICK_START.md](./QUICK_START.md)
2. **开发者**: 👉 [README.md](./README.md)
3. **学习者**: 👉 [example.test.ts](./example.test.ts)
4. **贡献者**: 👉 [IMPLEMENTATION.md](./IMPLEMENTATION.md)

---

**框架版本**: 1.0.0
**创建日期**: 2025-12-25
**状态**: ✅ 生产就绪

Happy Testing! 🚀
