/**
 * Unit tests for Web tools (WebFetch, WebSearch)
 * Tests web content fetching and searching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFetchTool, WebSearchTool } from '../../src/tools/web.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('WebFetchTool', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    vi.clearAllMocks();
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
        headers: { 'content-type': 'text/html' }
      });

      await webFetchTool.execute({
        url: 'http://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.any(Object)
      );
    });

    it('should not modify HTTPS URLs', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' }
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.any(Object)
      );
    });
  });

  describe('HTML Cleaning', () => {
    it('should strip script tags', async () => {
      const mockHtml = '<html><script>alert("bad")</script><body>Content</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('alert');
      expect(result.output).toContain('Content');
    });

    it('should strip style tags', async () => {
      const mockHtml = '<html><style>body{color:red}</style><body>Text</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('color:red');
      expect(result.output).toContain('Text');
    });

    it('should convert HTML entities', async () => {
      const mockHtml = '<html><body>&lt;tag&gt; &amp; &quot;text&quot;</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('<tag>');
      expect(result.output).toContain('&');
      expect(result.output).toContain('"text"');
    });
  });

  describe('Content Truncation', () => {
    it('should truncate very large content', async () => {
      const largeContent = 'x'.repeat(100000);
      vi.mocked(axios.get).mockResolvedValue({
        data: `<html><body>${largeContent}</body></html>`,
        headers: { 'content-type': 'text/html' }
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output!.length).toBeLessThan(100000);
      expect(result.output).toContain('truncated');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
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
      expect(result.error).toContain('Redirected');
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
        headers: { 'content-type': 'text/html' }
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('ClaudeCode'),
            'Accept': expect.any(String)
          })
        })
      );
    });

    it('should set timeout', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' }
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should allow redirects', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' }
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxRedirects: 5
        })
      );
    });
  });
});

describe('WebSearchTool', () => {
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    webSearchTool = new WebSearchTool();
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
      expect(result.output).toContain('example.com');
      expect(result.output).toContain('test.com');
    });

    it('should accept blocked_domains parameter', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        blocked_domains: ['spam.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('spam.com');
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
      expect(result.output).toContain('Query parameters');
      expect(result.output).toContain('Allowed domains');
    });

    it('should indicate when no domain filters applied', async () => {
      const result = await webSearchTool.execute({
        query: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('all');
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
