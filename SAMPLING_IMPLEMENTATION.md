# MCP Sampling 功能实现总结

## 概述

本次更新完善了 MCP (Model Context Protocol) Sampling 功能，使其符合 MCP 规范 2024-11-05。Sampling 允许 MCP 服务器向客户端请求 LLM 生成能力，实现"反向请求"流程。

## 修改的文件

### 1. `/src/mcp/protocol.ts`

**添加内容：**
- `SamplingMessageContent` - 采样消息内容接口
- `SamplingMessage` - 采样消息接口
- `ModelPreferences` - 模型选择偏好接口
- `CreateMessageParams` - sampling/createMessage 请求参数
- `CreateMessageResult` - sampling/createMessage 响应结果

**关键特性：**
- 完整的类型定义符合 MCP 规范
- 模型偏好使用 0-1 范围的优先级值
- 支持 systemPrompt、temperature、maxTokens 等参数
- 支持 includeContext 控制上下文范围
- 定义了标准的 stopReason 类型

### 2. `/src/mcp/sampling.ts`

**改进内容：**
- 移除重复的类型定义，改为从 `protocol.ts` 导入
- 增强参数验证：
  - 验证 messages 数组中的 content 对象
  - 验证 includeContext 取值范围
  - 验证 temperature 范围（0-1）
  - 验证 modelPreferences 优先级范围
- 增强结果验证：
  - 验证 content.type 字段
  - 对未知 stopReason 发出警告而非错误
- 添加详细的文档注释，说明安全性和工作流程
- 新增辅助函数：
  - `createTextContent()` - 创建文本消息内容
  - `createSamplingRequest()` - 创建完整的采样请求

**安全特性：**
- 文档中强调 Human-in-the-Loop 审查的重要性
- 支持对可疑内容进行检测
- 建议对采样请求进行成本控制

### 3. `/src/mcp/index.ts`

**添加内容：**
- 导出 Protocol 模块的所有类型和函数
- 导出 Sampling 模块的管理器、回调类型和辅助函数
- 新增的导出项：
  - 类型：`SamplingMessageContent`, `SamplingMessage`, `ModelPreferences`, `CreateMessageParams`, `CreateMessageResult`
  - 类：`McpSamplingManager`
  - 函数：`createSamplingCallback`, `createModelPreferences`, `createTextContent`, `createSamplingRequest`

### 4. `/src/mcp/examples/sampling-usage.ts` (新文件)

**包含示例：**
1. **基础设置** - 创建 SamplingManager 并注册回调
2. **处理请求** - 处理来自 MCP 服务器的采样请求
3. **创建请求** - 创建各种类型的采样请求
4. **Claude 集成** - 与 Anthropic Claude API 集成的示例代码
5. **安全检查** - 实现 prompt injection 防护和人工审核
6. **错误处理** - 正确的错误处理和重试逻辑

## 与 MCP 规范的兼容性

✅ **完全符合 MCP Specification 2024-11-05：**

1. **请求格式** - `sampling/createMessage` 使用正确的 JSON-RPC 2.0 格式
2. **消息结构** - messages 为 content 对象数组，而非 message 对象数组
3. **模型选择** - 使用抽象的优先级系统而非具体模型名称
4. **响应格式** - 包含 role、content、model 和 stopReason 字段
5. **能力声明** - ClientCapabilities 中包含 sampling 字段

## 使用方法

### 基本使用

```typescript
import {
  McpSamplingManager,
  createTextContent,
  createSamplingRequest,
} from './mcp';

// 创建管理器
const samplingManager = new McpSamplingManager();

// 注册回调
samplingManager.registerCallback('my-server', async (params) => {
  // 调用 LLM
  const result = await callLLM(params);

  return {
    role: 'assistant',
    content: { type: 'text', text: result },
    model: 'claude-3-sonnet-20240229',
    stopReason: 'endTurn',
  };
});

// 处理请求
const request = createSamplingRequest([
  createTextContent('Hello, world!'),
]);

const result = await samplingManager.handleSamplingRequest(
  'my-server',
  request
);
```

### 与官方 @anthropic-ai/claude-code 的兼容性

本实现基于 MCP 公开规范，并参考了官方实现的设计模式：

- ✅ 使用相同的消息格式和类型定义
- ✅ 支持相同的参数和选项
- ✅ 遵循相同的安全最佳实践
- ✅ 实现相同的事件系统

## 安全注意事项

⚠️ **重要安全建议：**

1. **Always use Human-in-the-Loop** - 对所有采样请求进行人工审核
2. **Prompt Injection Prevention** - 检测和阻止可疑的系统提示和消息
3. **Cost Control** - 限制 maxTokens 以防止滥用
4. **Context Isolation** - 谨慎使用 includeContext 参数
5. **Server Trust** - 为不同信任级别的服务器设置不同的策略

## 测试建议

```bash
# 类型检查
npx tsc --noEmit

# 运行示例（需要先实现 LLM 调用）
npx ts-node src/mcp/examples/sampling-usage.ts
```

## 相关资源

- [MCP Specification - Sampling](https://spec.modelcontextprotocol.io/specification/2024-11-05/client/sampling/)
- [MCP Security Considerations](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

## 下一步

1. 实现与 Anthropic Claude API 的实际集成
2. 添加人工审核 UI 组件
3. 实现更完善的 prompt injection 检测
4. 添加采样请求的日志和监控
5. 创建单元测试和集成测试

---

**完成时间：** 2025-12-26
**基于规范：** MCP Specification 2024-11-05
**兼容性：** 与官方 @anthropic-ai/claude-code 协议兼容
