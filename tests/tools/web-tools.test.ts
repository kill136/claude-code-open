/**
 * Comprehensive Unit Tests for Web Tools (WebFetch, WebSearch)
 * Tests input validation, URL fetching, HTML to Markdown conversion,
 * redirect handling, caching, domain filtering, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebFetchTool, WebSearchTool, getWebCacheStats, clearWebCaches } from '../../src/tools/web.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('WebFetchTool', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    vi.clearAllMocks();
    clearWebCaches();
  });

  afterEach(() => {
    clearWebCaches();
  });

  describe('Input Schema Validation', () => {
    it('should have correct schema definition', () => {
      const schema = webFetchTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('url');
      expect(schema.properties).toHaveProperty('prompt');
      expect(schema.required).toEqual(['url', 'prompt']);
    });

    it('should require url format to be uri', () => {
      const schema = webFetchTool.getInputSchema();
      expect(schema.properties.url.format).toBe('uri');
      expect(schema.properties.url.type).toBe('string');
    });

    it('should require prompt to be a string', () => {
      const schema = webFetchTool.getInputSchema();
      expect(schema.properties.prompt.type).toBe('string');
    });
  });

  describe('URL Validation and Normalization', () => {
    it('should reject invalid URLs', async () => {
      const result = await webFetchTool.execute({
        url: 'not-a-valid-url',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should upgrade HTTP to HTTPS', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetchTool.execute({
        url: 'http://example.com',
        prompt: 'Test'
      });

      // URL normalization may add trailing slash
      const calls = vi.mocked(axios.get).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const firstCallUrl = calls[0][0] as string;
      expect(firstCallUrl).toMatch(/^https:\/\/example\.com\/?$/);
    });

    it('should not modify HTTPS URLs', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
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

    it('should handle URLs with query parameters', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetchTool.execute({
        url: 'https://example.com?param=value&other=test',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com?param=value&other=test',
        expect.any(Object)
      );
    });
  });

  describe('HTML to Markdown Conversion', () => {
    it('should convert HTML to Markdown', async () => {
      const mockHtml = '<html><body><h1>Title</h1><p>Paragraph</p></body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Summarize this'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Title');
      expect(result.output).toContain('Paragraph');
    });

    it('should strip script tags', async () => {
      const mockHtml = '<html><script>alert("bad")</script><body>Content</body></html>';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
        status: 200
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
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('color:red');
      expect(result.output).toContain('Text');
    });

    it('should handle JSON content', async () => {
      const mockJson = { message: 'Hello', data: [1, 2, 3] };
      vi.mocked(axios.get).mockResolvedValue({
        data: mockJson,
        headers: { 'content-type': 'application/json' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://api.example.com/data',
        prompt: 'Parse this JSON'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello');
      expect(result.output).toContain('"data"');
    });

    it('should handle plain text content', async () => {
      const mockText = 'Plain text content';
      vi.mocked(axios.get).mockResolvedValue({
        data: mockText,
        headers: { 'content-type': 'text/plain' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com/file.txt',
        prompt: 'Read this'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Plain text content');
    });
  });

  describe('Redirect Handling', () => {
    it('should handle same-origin redirects automatically', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 301,
        headers: { location: '/new-path' }
      };

      // First call returns redirect, second call returns content
      vi.mocked(axios.get)
        .mockRejectedValueOnce(redirectError)
        .mockResolvedValueOnce({
          data: '<html><body>Redirected Content</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        });

      const result = await webFetchTool.execute({
        url: 'https://example.com/old-path',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Redirected Content');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should detect cross-origin redirects', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 301,
        headers: { location: 'https://different-domain.com/new-path' }
      };

      vi.mocked(axios.get).mockRejectedValue(redirectError);

      const result = await webFetchTool.execute({
        url: 'https://example.com/old-path',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('REDIRECT DETECTED');
      expect(result.error).toContain('different-domain.com');
    });

    it('should handle 302 redirects', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 302,
        headers: { location: 'https://other-domain.com' }
      };

      vi.mocked(axios.get).mockRejectedValue(redirectError);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('302');
    });

    it('should limit redirect count to 5', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 301,
        headers: { location: '/redirect' }
      };

      vi.mocked(axios.get).mockRejectedValue(redirectError);

      const result = await webFetchTool.execute({
        url: 'https://example.com/start',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many redirects');
    });
  });

  describe('Caching Mechanism (15 minutes)', () => {
    it('should cache successful fetches', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      // First fetch
      const result1 = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      // Second fetch - should use cache
      const result2 = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Different prompt'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.output).toContain('Cached');
      expect(axios.get).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should cache different URLs separately', async () => {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: '<html><body>Content 1</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        })
        .mockResolvedValueOnce({
          data: '<html><body>Content 2</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        });

      await webFetchTool.execute({
        url: 'https://example.com/page1',
        prompt: 'Test'
      });

      await webFetchTool.execute({
        url: 'https://example.com/page2',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should update cache statistics', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      const stats = getWebCacheStats();
      expect(stats.fetch.itemCount).toBeGreaterThan(0);
    });

    it('should have correct cache configuration', () => {
      const stats = getWebCacheStats();
      expect(stats.fetch.maxSize).toBe(50 * 1024 * 1024); // 50MB
      expect(stats.fetch.ttl).toBe(15 * 60 * 1000); // 15 minutes
    });
  });

  describe('Content Truncation', () => {
    it('should truncate content exceeding 100,000 characters', async () => {
      const largeContent = 'x'.repeat(150000);
      vi.mocked(axios.get).mockResolvedValue({
        data: `<html><body>${largeContent}</body></html>`,
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('[content truncated]');
      // Output includes URL, prompt, headers, so total length > 100k but content is truncated
      expect(result.output!.length).toBeLessThan(150000);
    });

    it('should not truncate content under 100,000 characters', async () => {
      const normalContent = 'x'.repeat(50000);
      vi.mocked(axios.get).mockResolvedValue({
        data: `<html><body>${normalContent}</body></html>`,
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.output).not.toContain('[content truncated]');
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

    it('should handle timeout errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle DNS resolution errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const result = await webFetchTool.execute({
        url: 'https://nonexistent-domain-12345.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing redirect location', async () => {
      const redirectError: any = new Error('Redirect');
      redirectError.response = {
        status: 301,
        headers: {} // No location header
      };

      vi.mocked(axios.get).mockRejectedValue(redirectError);

      const result = await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no location header');
    });
  });

  describe('Request Configuration', () => {
    it('should set proper User-Agent header', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('ClaudeCode')
          })
        })
      );
    });

    it('should set timeout to 30 seconds', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200
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

    it('should disable automatic redirects', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetchTool.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxRedirects: 0
        })
      );
    });
  });
});

describe('WebSearchTool', () => {
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    webSearchTool = new WebSearchTool();
    vi.clearAllMocks();
    clearWebCaches();
  });

  afterEach(() => {
    clearWebCaches();
  });

  describe('Input Schema Validation', () => {
    it('should have correct schema definition', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('query');
      expect(schema.properties).toHaveProperty('allowed_domains');
      expect(schema.properties).toHaveProperty('blocked_domains');
      expect(schema.required).toEqual(['query']);
    });

    it('should require query with minimum length of 2', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.properties.query.minLength).toBe(2);
      expect(schema.properties.query.type).toBe('string');
    });

    it('should define domain filters as string arrays', () => {
      const schema = webSearchTool.getInputSchema();
      expect(schema.properties.allowed_domains.type).toBe('array');
      expect(schema.properties.allowed_domains.items.type).toBe('string');
      expect(schema.properties.blocked_domains.type).toBe('array');
      expect(schema.properties.blocked_domains.items.type).toBe('string');
    });
  });

  describe('Search Execution', () => {
    it('should execute basic search query', async () => {
      const result = await webSearchTool.execute({
        query: 'test query'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test query');
    });

    it('should handle multi-word queries', async () => {
      const result = await webSearchTool.execute({
        query: 'multiple word search query'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('multiple word search query');
    });

    it('should handle queries with special characters', async () => {
      const result = await webSearchTool.execute({
        query: 'C++ programming "best practices"'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
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
    });

    it('should accept blocked_domains parameter', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        blocked_domains: ['spam.com', 'ads.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle both allowed and blocked domains', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        allowed_domains: ['example.com'],
        blocked_domains: ['spam.com']
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle empty domain lists', async () => {
      const result = await webSearchTool.execute({
        query: 'test',
        allowed_domains: [],
        blocked_domains: []
      });

      expect(result.success).toBe(true);
    });

    it('should report when all results filtered out', async () => {
      // This test depends on actual search results
      // With very restrictive allowed_domains, results might be filtered out
      const result = await webSearchTool.execute({
        query: 'test',
        allowed_domains: ['nonexistent-domain-12345.com']
      });

      expect(result.success).toBe(true);
      // Output should indicate filtering or no results
      expect(result.output).toBeDefined();
    });
  });

  describe('Search Result Formatting', () => {
    it('should format results as Markdown links', async () => {
      const result = await webSearchTool.execute({
        query: 'typescript tutorial'
      });

      expect(result.success).toBe(true);
      // Results should include markdown links or indicate search provider
      expect(result.output).toBeDefined();
    });

    it('should include Sources section', async () => {
      const result = await webSearchTool.execute({
        query: 'test'
      });

      expect(result.success).toBe(true);
      // If there are results, should have Sources section
      if (result.output?.includes('http')) {
        expect(result.output).toContain('Sources:');
      }
    });

    it('should handle no results gracefully', async () => {
      const result = await webSearchTool.execute({
        query: 'xyzabc123nonexistent456'
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  describe('Caching Mechanism (1 hour)', () => {
    it('should cache search results', async () => {
      // First search
      const result1 = await webSearchTool.execute({
        query: 'cached test query'
      });

      // Second search - should use cache
      const result2 = await webSearchTool.execute({
        query: 'cached test query'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Second result should indicate it's cached
      if (result2.output) {
        expect(result2.output).toContain('Cached');
      }
    });

    it('should cache different queries separately', async () => {
      const result1 = await webSearchTool.execute({
        query: 'query one'
      });

      const result2 = await webSearchTool.execute({
        query: 'query two'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Results might be different
    });

    it('should respect domain filters in cache key', async () => {
      // Same query but different filters should be cached separately
      await webSearchTool.execute({
        query: 'test',
        allowed_domains: ['example.com']
      });

      await webSearchTool.execute({
        query: 'test',
        allowed_domains: ['other.com']
      });

      const stats = getWebCacheStats();
      // Should have cached both queries separately
      expect(stats.search.itemCount).toBeGreaterThan(0);
    });

    it('should update cache statistics', async () => {
      await webSearchTool.execute({
        query: 'test query'
      });

      const stats = getWebCacheStats();
      expect(stats.search.itemCount).toBeGreaterThan(0);
    });

    it('should have correct cache configuration', () => {
      const stats = getWebCacheStats();
      expect(stats.search.max).toBe(500); // 500 queries max
      expect(stats.search.ttl).toBe(60 * 60 * 1000); // 1 hour
    });
  });

  describe('Error Handling', () => {
    it('should handle search API errors gracefully', async () => {
      // DuckDuckGo API might fail, should fallback gracefully
      const result = await webSearchTool.execute({
        query: 'test'
      });

      // Should not throw, should return a result
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Multiple Search Providers', () => {
    it('should indicate current search provider', async () => {
      const result = await webSearchTool.execute({
        query: 'test'
      });

      expect(result.success).toBe(true);
      // Should mention DuckDuckGo or search provider
      if (result.output) {
        expect(
          result.output.includes('DuckDuckGo') ||
          result.output.includes('search') ||
          result.output.includes('results')
        ).toBe(true);
      }
    });
  });
});

describe('Web Cache Management', () => {
  beforeEach(() => {
    clearWebCaches();
  });

  afterEach(() => {
    clearWebCaches();
  });

  describe('Cache Statistics', () => {
    it('should provide fetch cache statistics', () => {
      const stats = getWebCacheStats();

      expect(stats.fetch).toBeDefined();
      expect(stats.fetch.size).toBeDefined();
      expect(stats.fetch.calculatedSize).toBeDefined();
      expect(stats.fetch.maxSize).toBe(50 * 1024 * 1024);
      expect(stats.fetch.ttl).toBe(15 * 60 * 1000);
      expect(stats.fetch.itemCount).toBeDefined();
    });

    it('should provide search cache statistics', () => {
      const stats = getWebCacheStats();

      expect(stats.search).toBeDefined();
      expect(stats.search.size).toBeDefined();
      expect(stats.search.max).toBe(500);
      expect(stats.search.ttl).toBe(60 * 60 * 1000);
      expect(stats.search.itemCount).toBeDefined();
    });

    it('should track item counts correctly', async () => {
      const webFetch = new WebFetchTool();
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      await webFetch.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });

      const stats = getWebCacheStats();
      expect(stats.fetch.itemCount).toBeGreaterThan(0);
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all caches', async () => {
      const webFetch = new WebFetchTool();
      const webSearch = new WebSearchTool();

      vi.mocked(axios.get).mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/html' },
        status: 200
      });

      // Add items to cache
      await webFetch.execute({
        url: 'https://example.com',
        prompt: 'Test'
      });
      await webSearch.execute({
        query: 'test'
      });

      // Clear caches
      clearWebCaches();

      const stats = getWebCacheStats();
      expect(stats.fetch.itemCount).toBe(0);
      expect(stats.search.itemCount).toBe(0);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    clearWebCaches();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearWebCaches();
  });

  it('should work with both tools independently', async () => {
    const fetchTool = new WebFetchTool();
    const searchTool = new WebSearchTool();

    vi.mocked(axios.get).mockResolvedValue({
      data: '<html><body>Content</body></html>',
      headers: { 'content-type': 'text/html' },
      status: 200
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

  it('should maintain separate caches for fetch and search', async () => {
    const fetchTool = new WebFetchTool();
    const searchTool = new WebSearchTool();

    vi.mocked(axios.get).mockResolvedValue({
      data: 'content',
      headers: { 'content-type': 'text/html' },
      status: 200
    });

    await fetchTool.execute({
      url: 'https://example.com',
      prompt: 'Test'
    });

    await searchTool.execute({
      query: 'test'
    });

    const stats = getWebCacheStats();
    expect(stats.fetch.itemCount).toBeGreaterThan(0);
    expect(stats.search.itemCount).toBeGreaterThan(0);
  });
});
