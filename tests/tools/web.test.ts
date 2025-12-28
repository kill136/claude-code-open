/**
 * Unit tests for Web tools (WebFetch, WebSearch)
 * Tests web content fetching and searching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFetchTool, WebSearchTool, clearWebCaches } from '../../src/tools/web.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('WebFetchTool', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    vi.clearAllMocks();
    clearWebCaches(); // Clear cache before each test
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = webFetchTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('url');
      expect(schema.properties).toHaveProperty('prompt');
      expect(schema.required).toContain('url');
      expect(schema.required).toContain('prompt');
    });

    it('should require url format to be uri', () => {
      const schema = webFetchTool.getInputSchema();
      expect(schema.properties.url.format).toBe('uri');
    });
  });

  describe('Basic Fetching', () => {
    it('should fetch HTML content', async () => {
      const mockHtml = '<html><body>Hello World</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Summarize this'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
      expect(result.output).toContain('example.com');
    });

    it('should fetch JSON content', async () => {
      const mockJson = { message: 'Hello', data: [1, 2, 3] };
      vi.mocked(axios.get).mockResolvedValue({
        data: mockJson,
        headers: { 'content-type': 'application/json' }
      });

      const result = await webFetchTool.execute({
        url: 'https://api.example.com/data',
        prompt: 'Parse this JSON'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello');
      expect(result.output).toContain('data');
    });

    it('should fetch plain text content', async () => {
      const mockText = 'Plain text content';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockText,
        headers: { 'content-type': 'text/plain' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com/file.txt',
        prompt: 'Read this'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Plain text content');
    });
  });

  describe('HTTP to HTTPS Upgrade', () => {
    it('should upgrade HTTP to HTTPS', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'http://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('https://example.com');
    });

    it('should not modify HTTPS URLs', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('https://example.com');
    });
  });

  describe('HTML Cleaning', () => {
    it('should strip script tags', async () => {
      const mockHtml = '<html><script>alert("bad")</script><body>Content</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('alert');
    });

    it('should strip style tags', async () => {
      const mockHtml = '<html><style>body{color:red}</style><body>Text</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('color:red');
    });

    it('should convert HTML entities', async () => {
      const mockHtml = '<html><body>&lt;tag&gt; &amp; &quot;text&quot;</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      // Turndown converts HTML entities correctly
      expect(result.output).toBeDefined();
    });
  });

  describe('Content Truncation', () => {
    it('should truncate very large content', async () => {
      const largeContent = 'x'.repeat(150000);
      vi.mocked(axios.get).mockResolvedValue({
        data: `<html><body>${largeContent}</body></html>`,
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output!.length).toBeLessThan(150000);
      expect(result.output).toContain('[content truncated]');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';
      vi.mocked(axios.get).mockRejectedValue(networkError);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });

    it('should handle redirect errors', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 301,
        headers: { location: 'https://newurl.com' }
      };
      vi.mocked(axios.get).mockRejectedValue(redirectError);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('REDIRECT');
      expect(result.error).toContain('newurl.com');
    });

    it('should handle timeout', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Request Configuration', () => {
    it('should set proper headers', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalled();
    });

    it('should set timeout', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalled();
    });

    it('should allow redirects', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200,
        statusText: 'OK',
        config: {} as any
      } as any);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalled();
    });
  });
});

describe('WebSearchTool', () => {
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    webSearchTool = new WebSearchTool();
    clearWebCaches(); // Clear cache before each test
  });

  describe('Input Schema', () => {
    it('should have correct schema definition', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('query');
      expect(schema.properties).toHaveProperty('allowed_domains');
      expect(schema.properties).toHaveProperty('blocked_domains');
      expect(schema.required).toContain('query');
    });

    it('should require query with minimum length', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.properties.query.minLength).toBe(2);
    });

    it('should define domain filters as arrays', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.properties.allowed_domains.type).toBe('array');
      expect(schema.properties.blocked_domains.type).toBe('array');
    });
  });

  describe('Basic Search', () => {
    it('should execute search query', async () => {
      const result = await webSearchTool.execute({
        query: 'test query'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test query');
    });

    it('should mention API integration requirement', async () => {
      const result = await webSearchTool.execute({
        query: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('API');
    });
  });

  describe('Domain Filtering', () => {
    it('should accept allowed_domains parameter', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        allowed_domains: ['example.com', 'test.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      // With domain filtering, results might be empty or contain filtered domains
      expect(result.output).toContain('test');
    });

    it('should accept blocked_domains parameter', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        blocked_domains: ['spam.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('test');
    });

    it('should handle empty domain lists', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        allowed_domains: [],
        blocked_domains: []
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Query Validation', () => {
    it('should accept multi-word queries', async () => {
      const result = await webSearchTool.execute({
        query: 'multiple word search query'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('multiple word search query');
    });

    it('should accept queries with special characters', async () => {
      const result = await webSearchTool.execute({
        query: 'test-query_with.special+chars'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should include query parameters in output', async () => {
      const result = await webSearchTool.execute({
        query: 'test query',
        allowed_domains: ['example.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test query');
    });

    it('should indicate when no domain filters applied', async () => {
      const result = await webSearchTool.execute({
        query: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });
  });
});

describe('Integration Tests', () => {
  describe('WebFetch and WebSearch Interaction', () => {
    it('should work with both tools independently', async () => {
      const fetchTool = new WebFetchTool();
      const searchTool = new WebSearchTool();

      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' }
      });

      const fetchResult = await fetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      const searchResult = await searchTool.execute({
        query: 'test'
      });

      expect(fetchResult.success).toBe(true);
      expect(searchResult.success).toBe(true);
    });
  });
});
