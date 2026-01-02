/**
 * 用户交互处理器
 * 处理 AI 向用户提问并等待回答
 */

import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import type { QuestionOption, UserQuestionPayload } from '../shared/types.js';

/**
 * 待处理的问题
 */
interface PendingQuestion {
  requestId: string;
  resolve: (answer: string) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * 问题配置
 */
export interface QuestionConfig {
  question: string;
  header: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  timeout?: number; // 超时时间（毫秒）
}

/**
 * 用户交互处理器
 */
export class UserInteractionHandler {
  private pendingQuestions = new Map<string, PendingQuestion>();
  private ws: WebSocket | null = null;

  /**
   * 设置 WebSocket 连接
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  /**
   * 发送问题给用户并等待回答
   */
  async askQuestion(config: QuestionConfig): Promise<string> {
    if (!this.ws || this.ws.readyState !== 1 /* WebSocket.OPEN */) {
      throw new Error('WebSocket 连接不可用');
    }

    const requestId = randomUUID();

    return new Promise<string>((resolve, reject) => {
      const pending: PendingQuestion = {
        requestId,
        resolve,
        reject,
      };

      // 设置超时
      if (config.timeout && config.timeout > 0) {
        pending.timeoutId = setTimeout(() => {
          this.handleTimeout(requestId);
        }, config.timeout);
      }

      this.pendingQuestions.set(requestId, pending);

      // 发送问题到前端
      const payload: UserQuestionPayload = {
        requestId,
        question: config.question,
        header: config.header,
        options: config.options,
        multiSelect: config.multiSelect,
        timeout: config.timeout,
      };

      try {
        this.ws!.send(JSON.stringify({
          type: 'user_question',
          payload,
        }));
        console.log(`[UserInteraction] 发送问题: ${config.header} (${requestId})`);
      } catch (error) {
        this.cleanup(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * 处理用户回答
   */
  handleAnswer(requestId: string, answer: string): void {
    const pending = this.pendingQuestions.get(requestId);

    if (!pending) {
      console.warn(`[UserInteraction] 未找到待处理的问题: ${requestId}`);
      return;
    }

    console.log(`[UserInteraction] 收到回答: ${requestId} -> ${answer}`);

    // 清理超时定时器
    this.cleanup(requestId);

    // 解析 Promise
    pending.resolve(answer);
  }

  /**
   * 处理超时
   */
  handleTimeout(requestId: string): void {
    const pending = this.pendingQuestions.get(requestId);

    if (!pending) {
      return;
    }

    console.warn(`[UserInteraction] 问题超时: ${requestId}`);

    // 清理
    this.cleanup(requestId);

    // 拒绝 Promise
    pending.reject(new Error('用户回答超时'));
  }

  /**
   * 清理待处理的问题
   */
  private cleanup(requestId: string): void {
    const pending = this.pendingQuestions.get(requestId);

    if (pending?.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingQuestions.delete(requestId);
  }

  /**
   * 取消所有待处理的问题
   */
  cancelAll(): void {
    for (const [requestId, pending] of this.pendingQuestions) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error('操作已取消'));
    }
    this.pendingQuestions.clear();
  }

  /**
   * 获取待处理问题数量
   */
  getPendingCount(): number {
    return this.pendingQuestions.size;
  }
}
