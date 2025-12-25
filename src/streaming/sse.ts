/**
 * Server-Sent Events (SSE) Parser
 * T333: SSE 流式解析
 *
 * 实现标准 SSE 协议解析，支持:
 * - event: 和 data: 字段解析
 * - 多行数据字段
 * - CRLF 和 LF 换行符
 * - 流式重连
 */

export interface SSEEvent {
  event: string | null;
  data: string;
  raw: string[];
  id?: string;
  retry?: number;
}

/**
 * SSE 事件解码器
 * 基于官方实现的 jzB 类
 */
export class SSEDecoder {
  private eventType: string | null = null;
  private dataLines: string[] = [];
  private chunks: string[] = [];
  private eventId: string | null = null;
  private retryTime: number | null = null;

  /**
   * 解析一行 SSE 数据
   * @param line 单行文本
   * @returns 完整的 SSE 事件（如果该行是空行），否则返回 null
   */
  decode(line: string): SSEEvent | null {
    // 保存原始行
    this.chunks.push(line);

    // 空行表示事件结束
    if (!line.trim()) {
      if (this.dataLines.length === 0) {
        // 空事件，重置并继续
        this.reset();
        return null;
      }

      // 构造完整事件
      const event: SSEEvent = {
        event: this.eventType || 'message',
        data: this.dataLines.join('\n'),
        raw: [...this.chunks],
      };

      if (this.eventId !== null) {
        event.id = this.eventId;
      }

      if (this.retryTime !== null) {
        event.retry = this.retryTime;
      }

      // 重置状态
      this.reset();
      return event;
    }

    // 注释行（以 : 开头）
    if (line.startsWith(':')) {
      return null;
    }

    // 解析字段
    const [field, , value] = splitFirst(line, ':');

    if (field === 'event') {
      this.eventType = value.trimStart();
    } else if (field === 'data') {
      this.dataLines.push(value.trimStart());
    } else if (field === 'id') {
      this.eventId = value.trimStart();
    } else if (field === 'retry') {
      const retry = parseInt(value.trimStart(), 10);
      if (!isNaN(retry)) {
        this.retryTime = retry;
      }
    }

    return null;
  }

  /**
   * 刷新缓冲区（强制完成当前事件）
   */
  flush(): SSEEvent | null {
    if (this.dataLines.length === 0) {
      return null;
    }

    const event: SSEEvent = {
      event: this.eventType || 'message',
      data: this.dataLines.join('\n'),
      raw: [...this.chunks],
    };

    if (this.eventId !== null) {
      event.id = this.eventId;
    }

    if (this.retryTime !== null) {
      event.retry = this.retryTime;
    }

    this.reset();
    return event;
  }

  private reset(): void {
    this.eventType = null;
    this.dataLines = [];
    this.chunks = [];
    // id 和 retry 不重置（根据 SSE 规范）
  }
}

/**
 * 换行解码器
 * 基于官方实现的 An 类
 * 处理字节级缓冲，支持 CRLF 和 LF
 */
export class NewlineDecoder {
  private buffer: Uint8Array = new Uint8Array();
  private carriageIndex: number | null = null;

  /**
   * 解码字节块，提取完整的行
   * @param chunk 新的字节块
   * @returns 完整的行数组
   */
  decode(chunk: Uint8Array): string[] {
    // 合并缓冲区
    this.buffer = concatUint8Arrays([this.buffer, chunk]);

    const lines: string[] = [];

    while (true) {
      const lineEnd = this.findNewline();
      if (!lineEnd) {
        break;
      }

      // 提取行（不包含换行符）
      const lineBytes = this.buffer.subarray(0, lineEnd.preceding);
      const lineText = decodeText(lineBytes);
      lines.push(lineText);

      // 更新缓冲区
      this.buffer = this.buffer.subarray(lineEnd.index);
      this.carriageIndex = null;
    }

    return lines;
  }

  /**
   * 刷新缓冲区（强制输出剩余数据）
   */
  flush(): string[] {
    if (this.buffer.length === 0) {
      return [];
    }

    // 将剩余数据作为最后一行
    const lines = [decodeText(this.buffer)];
    this.buffer = new Uint8Array();
    this.carriageIndex = null;
    return lines;
  }

  /**
   * 查找下一个换行符
   */
  private findNewline(): { index: number; preceding: number } | null {
    const startIndex = this.carriageIndex ?? 0;

    for (let i = startIndex; i < this.buffer.length; i++) {
      const byte = this.buffer[i];

      if (byte === 0x0d) {
        // \r (CR)
        this.carriageIndex = i;
      } else if (byte === 0x0a) {
        // \n (LF)
        const preceding = this.carriageIndex !== null && this.carriageIndex === i - 1
          ? i - 1  // CRLF: 不包含 \r
          : i;     // LF: 不包含 \n

        return { index: i + 1, preceding };
      }
    }

    return null;
  }
}

/**
 * SSE 流解析器
 * 基于官方实现的 H63 函数
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  controller?: AbortController
): AsyncGenerator<SSEEvent> {
  const decoder = new SSEDecoder();
  const newlineDecoder = new NewlineDecoder();
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 刷新缓冲区
        for (const line of newlineDecoder.flush()) {
          const event = decoder.decode(line);
          if (event) {
            yield event;
          }
        }

        const finalEvent = decoder.flush();
        if (finalEvent) {
          yield finalEvent;
        }
        break;
      }

      // 检查中断
      if (controller?.signal.aborted) {
        break;
      }

      // 解码换行
      const lines = newlineDecoder.decode(value);

      // 解析 SSE 事件
      for (const line of lines) {
        const event = decoder.decode(line);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * SSE 流包装器
 * 基于官方实现的 yC 类
 * 提供高层次的 SSE 流处理接口
 */
export class SSEStream<T = any> {
  private iterator: AsyncGenerator<SSEEvent>;
  private controller: AbortController;

  constructor(
    iterator: AsyncGenerator<SSEEvent>,
    controller: AbortController
  ) {
    this.iterator = iterator;
    this.controller = controller;
  }

  /**
   * 从 Response 创建 SSE 流
   */
  static fromResponse<T = any>(
    response: Response,
    controller?: AbortController
  ): SSEStream<T> {
    if (!response.body) {
      throw new Error('Response has no body');
    }

    const abortController = controller || new AbortController();
    const iterator = parseSSEStream(response.body, abortController);

    return new SSEStream<T>(iterator, abortController);
  }

  /**
   * 异步迭代器
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const self = this;

    return {
      async next(): Promise<IteratorResult<T>> {
        const { done, value } = await self.iterator.next();

        if (done) {
          return { done: true, value: undefined };
        }

        // 解析 JSON 数据
        try {
          const data = JSON.parse(value.data) as T;
          return { done: false, value: data };
        } catch (error) {
          console.error('Failed to parse SSE data:', value.data, error);
          // 跳过无效数据
          return this.next();
        }
      },

      async return(): Promise<IteratorResult<T>> {
        self.controller.abort();
        return { done: true, value: undefined };
      },
    };
  }

  /**
   * 中止流
   */
  abort(): void {
    this.controller.abort();
  }

  /**
   * 分叉流（创建两个独立的流）
   */
  tee(): [SSEStream<T>, SSEStream<T>] {
    // Note: 这个实现是简化的，真实的 tee 需要缓冲机制
    throw new Error('SSEStream.tee() is not yet implemented');
  }
}

// ========== 辅助函数 ==========

/**
 * 分割字符串（只分割第一次出现的分隔符）
 */
function splitFirst(str: string, separator: string): [string, string, string] {
  const index = str.indexOf(separator);
  if (index === -1) {
    return [str, '', ''];
  }
  return [
    str.substring(0, index),
    separator,
    str.substring(index + separator.length),
  ];
}

/**
 * 合并 Uint8Array
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * 解码文本（UTF-8）
 */
function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
