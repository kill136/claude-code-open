/**
 * 增强上下文管理功能测试
 */

import {
  getModelContextWindow,
  ContextWindowManager,
  addCacheControl,
  calculateCacheSavings,
  evaluateMessagePriority,
  MessagePriority,
  collapseToolReferences,
  parseAtMentions,
  parseMcpUri,
  formatMcpResource,
  type TokenUsage,
} from '../enhanced.js';
import type { Message } from '../../types/index.js';

// 简单的测试框架（不需要 Jest）
function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toEqual(expected: any) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain(expected: string) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${actual}`);
      }
    },
  };
}

describe('Enhanced Context Management', () => {
  // ============ T321-T322: Token 计数和窗口管理 ============

  describe('getModelContextWindow', () => {
    it('应该返回正确的上下文窗口大小', () => {
      expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(200000);
      expect(getModelContextWindow('claude-4-5-sonnet-20250929')).toBe(200000);
      expect(getModelContextWindow('claude-opus-4-5-20251101')).toBe(200000);
    });

    it('应该处理未知模型', () => {
      expect(getModelContextWindow('unknown-model')).toBe(200000);
    });

    it('应该识别超大上下文模型', () => {
      expect(getModelContextWindow('claude-sonnet-4-5[1m]')).toBe(1000000);
    });
  });

  describe('ContextWindowManager', () => {
    it('应该正确记录和统计 token 使用', () => {
      const manager = new ContextWindowManager('claude-3-5-sonnet-20241022');

      const usage: TokenUsage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      };

      manager.recordUsage(usage);

      const stats = manager.getStats();
      expect(stats.total_input_tokens).toBe(1000);
      expect(stats.total_output_tokens).toBe(500);
      expect(stats.context_window_size).toBe(200000);
    });

    it('应该计算正确的使用率', () => {
      const manager = new ContextWindowManager('claude-3-5-sonnet-20241022');

      manager.recordUsage({
        input_tokens: 100000,  // 50% of 200000
        output_tokens: 1000,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      });

      expect(manager.getUsagePercentage()).toBe(50);
    });

    it('应该检测接近限制', () => {
      const manager = new ContextWindowManager('claude-3-5-sonnet-20241022');

      manager.recordUsage({
        input_tokens: 170000,  // 85% of 200000
        output_tokens: 1000,
      });

      expect(manager.isNearLimit(0.8)).toBe(true);
      expect(manager.isNearLimit(0.9)).toBe(false);
    });

    it('应该统计缓存使用', () => {
      const manager = new ContextWindowManager('claude-3-5-sonnet-20241022');

      manager.recordUsage({
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 300,
      });

      manager.recordUsage({
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 700,
      });

      const cacheStats = manager.getCacheStats();
      expect(cacheStats.total_cache_creation_tokens).toBe(500);
      expect(cacheStats.total_cache_read_tokens).toBe(1000);
    });
  });

  // ============ T327-T329: Prompt Caching ============

  describe('addCacheControl', () => {
    it('应该为最近消息添加缓存控制', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: [{ type: 'text', text: 'Message 2' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Response 2' }] },
      ];

      const result = addCacheControl(messages, { cacheRecentMessages: 2 });

      // 检查最后两条消息
      expect(result.length).toBe(4);

      const lastMessage = result[3];
      if (Array.isArray(lastMessage.content)) {
        const lastBlock = lastMessage.content[lastMessage.content.length - 1];
        expect('cache_control' in lastBlock).toBe(true);
      }
    });
  });

  describe('calculateCacheSavings', () => {
    it('应该计算缓存成本节省', () => {
      const usage: TokenUsage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 10000,
      };

      const savings = calculateCacheSavings(usage);

      expect(savings.baseCost).toBeGreaterThan(0);
      expect(savings.savings).toBeGreaterThan(0);
      // 缓存读取应该节省成本
      expect(savings.savings).toBeGreaterThan(savings.cacheCost);
    });
  });

  // ============ T324: 消息优先级 ============

  describe('evaluateMessagePriority', () => {
    it('应该为系统消息分配最高优先级', () => {
      const message: Message = {
        role: 'user',
        content: '=== Previous Conversation Summary ===\nSome summary',
      };

      const priority = evaluateMessagePriority(message, 0, 10);
      expect(priority).toBe(MessagePriority.CRITICAL);
    });

    it('应该为最近消息分配高优先级', () => {
      const message: Message = {
        role: 'user',
        content: 'Recent message',
      };

      // 最近的消息（index 9/10）
      const priority = evaluateMessagePriority(message, 9, 10);
      expect(priority).toBe(MessagePriority.HIGH);
    });

    it('应该为工具调用消息分配高优先级', () => {
      const message: Message = {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'test',
            name: 'bash',
            input: { command: 'ls' },
          },
        ],
      };

      const priority = evaluateMessagePriority(message, 5, 10);
      expect(priority).toBe(MessagePriority.HIGH);
    });

    it('应该为旧消息分配低优先级', () => {
      const message: Message = {
        role: 'user',
        content: 'Old message',
      };

      // 旧消息（index 1/10）
      const priority = evaluateMessagePriority(message, 1, 10);
      expect(priority).toBe(MessagePriority.LOW);
    });
  });

  // ============ T325: Tool Reference 折叠 ============

  describe('collapseToolReferences', () => {
    it('应该移除 tool_reference 块', () => {
      const message: Message = {
        role: 'user',
        content: [
          { type: 'text', text: 'Some text' },
          { type: 'tool_reference', tool_use_id: 'test' } as any,
        ],
      };

      const result = collapseToolReferences(message);

      expect(Array.isArray(result.content)).toBe(true);
      if (Array.isArray(result.content)) {
        expect(result.content.length).toBe(1);
        expect(result.content[0].type).toBe('text');
      }
    });

    it('应该为纯引用消息添加占位符', () => {
      const message: Message = {
        role: 'user',
        content: [
          { type: 'tool_reference', tool_use_id: 'test1' } as any,
          { type: 'tool_reference', tool_use_id: 'test2' } as any,
        ],
      };

      const result = collapseToolReferences(message);

      expect(Array.isArray(result.content)).toBe(true);
      if (Array.isArray(result.content)) {
        expect(result.content.length).toBe(1);
        expect(result.content[0].type).toBe('text');
        if (result.content[0].type === 'text') {
          expect(result.content[0].text).toBe('[tool references]');
        }
      }
    });
  });

  // ============ T332: @ 文件提及 ============

  describe('parseAtMentions', () => {
    it('应该解析简单的 @ 提及', () => {
      const text = 'Check @file.ts and @another.js';
      const mentions = parseAtMentions(text);

      expect(mentions).toEqual(['file.ts', 'another.js']);
    });

    it('应该解析路径提及', () => {
      const text = 'See @src/utils/helper.ts';
      const mentions = parseAtMentions(text);

      expect(mentions).toEqual(['src/utils/helper.ts']);
    });

    it('应该处理多个提及', () => {
      const text = 'Files: @a.ts, @b.js, @c.md';
      const mentions = parseAtMentions(text);

      expect(mentions.length).toBe(3);
    });
  });

  // ============ T330: MCP URI ============

  describe('parseMcpUri', () => {
    it('应该解析有效的 MCP URI', () => {
      const result = parseMcpUri('mcp://filesystem/path/to/file');

      expect(result).toEqual({
        server: 'filesystem',
        path: '/path/to/file',
      });
    });

    it('应该处理没有路径的 URI', () => {
      const result = parseMcpUri('mcp://server');

      expect(result).toEqual({
        server: 'server',
        path: '/',
      });
    });

    it('应该拒绝无效的 URI', () => {
      const result = parseMcpUri('http://example.com');
      expect(result).toBeNull();
    });
  });

  describe('formatMcpResource', () => {
    it('应该格式化带内容的资源', () => {
      const resource = {
        server: 'filesystem',
        uri: 'file:///path/to/file',
        content: 'File content here',
      };

      const block = formatMcpResource(resource);

      expect(block.type).toBe('text');
      if (block.type === 'text') {
        expect(block.text).toContain('filesystem');
        expect(block.text).toContain('File content here');
      }
    });

    it('应该处理空内容', () => {
      const resource = {
        server: 'filesystem',
        uri: 'file:///path/to/file',
      };

      const block = formatMcpResource(resource);

      expect(block.type).toBe('text');
      if (block.type === 'text') {
        expect(block.text).toContain('(No content)');
      }
    });
  });
});
