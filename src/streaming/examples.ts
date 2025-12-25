/**
 * 流式处理使用示例
 * 展示如何使用增强的流式处理功能 (T333-T342)
 */

import {
  SSEStream,
  parseSSEStream,
  SSEDecoder,
  NewlineDecoder,
  EnhancedMessageStream,
  parseTolerantJSON,
} from './index.js';

// ========== 示例 1: 使用 SSE 解析器 (T333) ==========

export async function exampleSSEParser() {
  console.log('=== 示例 1: SSE 解析器 ===\n');

  // 创建一个模拟的 SSE 数据流
  const sseData = `
event: message_start
data: {"type":"message_start","message":{"id":"msg_123","role":"assistant"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

event: message_stop
data: {"type":"message_stop"}

`.trim();

  // 方式1: 使用 SSEDecoder 手动解析
  const decoder = new SSEDecoder();
  const lines = sseData.split('\n');

  for (const line of lines) {
    const event = decoder.decode(line);
    if (event) {
      console.log('事件:', event.event);
      console.log('数据:', event.data);
      console.log('---');
    }
  }

  // 方式2: 使用 NewlineDecoder 处理字节流
  const newlineDecoder = new NewlineDecoder();
  const bytes = new TextEncoder().encode(sseData);
  const extractedLines = newlineDecoder.decode(bytes);

  console.log('\n提取的行数:', extractedLines.length);
}

// ========== 示例 2: 使用增强的消息流处理器 (T334-T342) ==========

export async function exampleEnhancedMessageStream() {
  console.log('\n=== 示例 2: 增强的消息流处理器 ===\n');

  // 创建流处理器，带完整回调
  const stream = new EnhancedMessageStream({
    // T335: 文本增量回调
    onText: (delta, snapshot) => {
      console.log('文本增量:', delta);
      console.log('当前完整文本:', snapshot);
    },

    // T336: 思考增量回调
    onThinking: (delta, snapshot) => {
      console.log('思考增量:', delta);
      console.log('当前思考内容:', snapshot);
    },

    // T337: 工具输入 JSON 增量回调
    onInputJson: (delta, parsedInput) => {
      console.log('JSON 增量:', delta);
      console.log('解析后的输入:', parsedInput);
    },

    // T338: 引用回调
    onCitation: (citation, allCitations) => {
      console.log('新引用:', citation);
      console.log('所有引用:', allCitations);
    },

    // T339: 签名回调
    onSignature: (signature) => {
      console.log('签名:', signature);
    },

    // T342: 内容块完成回调
    onContentBlock: (block) => {
      console.log('内容块完成:', block.type);
    },

    // T342: 消息完成回调
    onMessage: (message) => {
      console.log('消息完成:', message.id);
      console.log('停止原因:', message.stop_reason);
      console.log('Token 使用:', message.usage);
    },

    // T342: 流式事件回调
    onStreamEvent: (event, snapshot) => {
      console.log('流式事件:', event.type);
    },

    // T337: 错误回调
    onError: (error) => {
      console.error('流错误:', error.message);
    },

    // T338: 中止回调
    onAbort: (error) => {
      console.warn('流已中止:', error.message);
    },

    // T342: 完成回调
    onComplete: () => {
      console.log('流处理完成');
    },
  }, {
    // T338: 提供 AbortSignal
    signal: new AbortController().signal,

    // T340: 设置超时（30秒）
    timeout: 30000,

    // T341: 心跳回调
    onHeartbeat: () => {
      console.log('心跳检测...');
    },
  });

  // 模拟处理事件
  await stream.handleStreamEvent({
    type: 'message_start',
    message: {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-20250514',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 0,
      },
    },
  });

  await stream.handleStreamEvent({
    type: 'content_block_start',
    index: 0,
    content_block: {
      type: 'text',
      text: '',
    },
  });

  await stream.handleStreamEvent({
    type: 'content_block_delta',
    index: 0,
    delta: {
      type: 'text_delta',
      text: 'Hello ',
    },
  });

  await stream.handleStreamEvent({
    type: 'content_block_delta',
    index: 0,
    delta: {
      type: 'text_delta',
      text: 'World!',
    },
  });

  await stream.handleStreamEvent({
    type: 'content_block_stop',
    index: 0,
  });

  await stream.handleStreamEvent({
    type: 'message_stop',
  });

  // 获取最终结果
  const finalMessage = stream.getFinalMessage();
  const finalText = stream.getFinalText();

  console.log('\n最终消息:', finalMessage);
  console.log('最终文本:', finalText);
}

// ========== 示例 3: 容错 JSON 解析 (T337) ==========

export function exampleTolerantJSONParsing() {
  console.log('\n=== 示例 3: 容错 JSON 解析 ===\n');

  // 测试各种不完整的 JSON
  const testCases = [
    // 未闭合的对象
    '{"name": "test", "value": 123',
    // 未闭合的数组
    '{"items": [1, 2, 3',
    // 未闭合的字符串
    '{"message": "Hello World',
    // 尾部逗号
    '{"a": 1, "b": 2,}',
    // 复杂嵌套
    '{"user": {"name": "Alice", "tags": ["admin", "user"',
    // 完全正常的 JSON
    '{"status": "ok"}',
  ];

  for (const json of testCases) {
    console.log('输入:', json);
    console.log('解析结果:', parseTolerantJSON(json));
    console.log('---');
  }
}

// ========== 示例 4: 流取消 (T338) ==========

export async function exampleStreamCancellation() {
  console.log('\n=== 示例 4: 流取消 ===\n');

  const abortController = new AbortController();

  const stream = new EnhancedMessageStream({
    onText: (delta) => {
      console.log('收到文本:', delta);
    },
    onAbort: (error) => {
      console.log('流已中止:', error.message);
    },
  }, {
    signal: abortController.signal,
  });

  // 开始处理事件
  await stream.handleStreamEvent({
    type: 'message_start',
    message: {
      id: 'msg_abc',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-20250514',
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 0 },
    },
  });

  // 模拟一段时间后取消
  setTimeout(() => {
    console.log('正在中止流...');
    abortController.abort();
  }, 100);

  // 继续尝试处理事件（会被忽略）
  await new Promise(resolve => setTimeout(resolve, 200));

  await stream.handleStreamEvent({
    type: 'content_block_delta',
    index: 0,
    delta: {
      type: 'text_delta',
      text: '这段文本不会被处理',
    },
  });

  console.log('流已中止:', stream.isAborted());
}

// ========== 示例 5: 工具调用 JSON 增量解析 (T337) ==========

export async function exampleToolInputJsonDelta() {
  console.log('\n=== 示例 5: 工具调用 JSON 增量解析 ===\n');

  const stream = new EnhancedMessageStream({
    onInputJson: (delta, parsedInput) => {
      console.log('JSON 片段:', delta);
      console.log('当前解析结果:', JSON.stringify(parsedInput, null, 2));
      console.log('---');
    },
  });

  // 开始消息
  await stream.handleStreamEvent({
    type: 'message_start',
    message: {
      id: 'msg_tool',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-20250514',
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 0 },
    },
  });

  // 开始工具使用块
  await stream.handleStreamEvent({
    type: 'content_block_start',
    index: 0,
    content_block: {
      type: 'tool_use',
      id: 'tool_123',
      name: 'get_weather',
      input: {},
    },
  });

  // 增量发送 JSON 片段（模拟流式输入）
  const jsonParts = [
    '{"loc',
    'ation": "San',
    ' Francisco", "u',
    'nit": "cel',
    'sius"',
  ];

  for (const part of jsonParts) {
    await stream.handleStreamEvent({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: part,
      },
    });
  }

  // 完成
  await stream.handleStreamEvent({
    type: 'content_block_stop',
    index: 0,
  });

  const finalMessage = stream.getFinalMessage();
  console.log('\n最终工具输入:', finalMessage?.content[0]);
}

// ========== 运行所有示例 ==========

export async function runAllExamples() {
  await exampleSSEParser();
  await exampleEnhancedMessageStream();
  exampleTolerantJSONParsing();
  await exampleStreamCancellation();
  await exampleToolInputJsonDelta();
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
