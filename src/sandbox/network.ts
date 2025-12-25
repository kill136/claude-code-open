/**
 * Network Sandbox
 * Enhanced network request filtering and monitoring
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

/**
 * Network policy configuration
 */
export interface NetworkPolicy {
  /** Allowed domains (whitelist, supports wildcards) */
  allowedDomains: string[];
  /** Denied domains (blacklist, supports wildcards) */
  deniedDomains: string[];
  /** Allowed ports (whitelist) */
  allowedPorts: number[];
  /** Denied ports (blacklist) */
  deniedPorts: number[];
  /** Allowed protocols (http, https, ftp, etc.) */
  allowedProtocols: string[];
  /** Maximum requests per minute (rate limiting) */
  maxRequestsPerMinute?: number;
  /** Enable request logging */
  enableLogging?: boolean;
}

/**
 * Parsed URL information
 */
export interface ParsedUrl {
  protocol: string;
  hostname: string;
  port: number;
  pathname: string;
  search: string;
  hash: string;
  href: string;
}

/**
 * Network request log entry
 */
export interface NetworkRequest {
  timestamp: number;
  url: string;
  method: string;
  protocol: string;
  hostname: string;
  port: number;
  allowed: boolean;
  reason?: string;
  duration?: number;
  statusCode?: number;
  error?: string;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  requestsPerMinute: number;
  topDomains: Array<{ domain: string; count: number }>;
  topPorts: Array<{ port: number; count: number }>;
  protocolBreakdown: Record<string, number>;
  errorCount: number;
}

/**
 * Sandboxed HTTP/HTTPS modules
 */
export interface SandboxedHttp {
  request: typeof http.request;
  get: typeof http.get;
}

/**
 * Default network policy (restrictive)
 */
const DEFAULT_POLICY: NetworkPolicy = {
  allowedDomains: [],
  deniedDomains: [],
  allowedPorts: [80, 443, 8080, 8443],
  deniedPorts: [],
  allowedProtocols: ['http:', 'https:'],
  maxRequestsPerMinute: 60,
  enableLogging: true,
};

/**
 * Network Sandbox Class
 */
export class NetworkSandbox {
  private policy: NetworkPolicy;
  private requestLog: NetworkRequest[] = [];
  private requestTimestamps: number[] = [];
  private domainCounts: Map<string, number> = new Map();
  private portCounts: Map<number, number> = new Map();
  private protocolCounts: Map<string, number> = new Map();
  private errorCount = 0;

  constructor(policy: Partial<NetworkPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  /**
   * Update the network policy
   */
  updatePolicy(policy: Partial<NetworkPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Get current policy
   */
  getPolicy(): NetworkPolicy {
    return { ...this.policy };
  }

  /**
   * Check if a request to the given URL is allowed
   */
  isRequestAllowed(url: string): boolean {
    try {
      const parsed = parseUrl(url);

      // Check protocol
      if (!this.isProtocolAllowed(parsed.protocol)) {
        return false;
      }

      // Check domain
      if (!this.isDomainAllowed(parsed.hostname)) {
        return false;
      }

      // Check port
      if (!this.isPortAllowed(parsed.port)) {
        return false;
      }

      // Check rate limit
      if (!this.isRateLimitOk()) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a domain is allowed
   */
  isDomainAllowed(domain: string): boolean {
    // If denied domains list is not empty, check if domain is denied
    if (this.policy.deniedDomains.length > 0) {
      for (const pattern of this.policy.deniedDomains) {
        if (matchDomainPattern(domain, pattern)) {
          return false;
        }
      }
    }

    // If allowed domains list is empty, allow all (unless denied)
    if (this.policy.allowedDomains.length === 0) {
      return true;
    }

    // Check if domain matches any allowed pattern
    for (const pattern of this.policy.allowedDomains) {
      if (matchDomainPattern(domain, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a port is allowed
   */
  isPortAllowed(port: number): boolean {
    // Check denied ports first
    if (this.policy.deniedPorts.length > 0) {
      if (this.policy.deniedPorts.includes(port)) {
        return false;
      }
    }

    // If allowed ports list is empty, allow all (unless denied)
    if (this.policy.allowedPorts.length === 0) {
      return true;
    }

    // Check if port is in allowed list
    return this.policy.allowedPorts.includes(port);
  }

  /**
   * Check if a protocol is allowed
   */
  isProtocolAllowed(protocol: string): boolean {
    // Normalize protocol (ensure it ends with ':')
    const normalizedProtocol = protocol.endsWith(':') ? protocol : `${protocol}:`;

    // If allowed protocols list is empty, allow all
    if (this.policy.allowedProtocols.length === 0) {
      return true;
    }

    // Check if protocol is in allowed list
    return this.policy.allowedProtocols.some(
      (p) => (p.endsWith(':') ? p : `${p}:`) === normalizedProtocol
    );
  }

  /**
   * Check if rate limit is OK
   */
  private isRateLimitOk(): boolean {
    if (!this.policy.maxRequestsPerMinute) {
      return true;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

    // Check if we're under the limit
    return this.requestTimestamps.length < this.policy.maxRequestsPerMinute;
  }

  /**
   * Record a request
   */
  private recordRequest(request: NetworkRequest): void {
    if (!this.policy.enableLogging) {
      return;
    }

    this.requestLog.push(request);
    this.requestTimestamps.push(request.timestamp);

    // Update statistics
    if (request.allowed) {
      const count = this.domainCounts.get(request.hostname) || 0;
      this.domainCounts.set(request.hostname, count + 1);

      const portCount = this.portCounts.get(request.port) || 0;
      this.portCounts.set(request.port, portCount + 1);

      const protocolCount = this.protocolCounts.get(request.protocol) || 0;
      this.protocolCounts.set(request.protocol, protocolCount + 1);
    }

    if (request.error) {
      this.errorCount++;
    }

    // Limit log size (keep last 10000 entries)
    if (this.requestLog.length > 10000) {
      this.requestLog = this.requestLog.slice(-10000);
    }
  }

  /**
   * Wrap native fetch function
   */
  wrapFetch(): typeof fetch {
    const sandbox = this;

    return async function sandboxedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : input.toString();
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const startTime = Date.now();

      const request: NetworkRequest = {
        timestamp: startTime,
        url,
        method,
        protocol: '',
        hostname: '',
        port: 0,
        allowed: false,
      };

      try {
        const parsed = parseUrl(url);
        request.protocol = parsed.protocol;
        request.hostname = parsed.hostname;
        request.port = parsed.port;

        // Check if request is allowed
        if (!sandbox.isRequestAllowed(url)) {
          request.allowed = false;
          request.reason = 'Request denied by network policy';
          sandbox.recordRequest(request);

          throw new Error(
            `Network request denied: ${url} (policy violation)`
          );
        }

        request.allowed = true;
        sandbox.recordRequest(request);

        // Make the actual request
        const response = await fetch(input, init);

        // Update request with response info
        request.duration = Date.now() - startTime;
        request.statusCode = response.status;

        return response;
      } catch (error) {
        request.error = error instanceof Error ? error.message : String(error);
        request.duration = Date.now() - startTime;
        sandbox.recordRequest(request);
        throw error;
      }
    };
  }

  /**
   * Wrap HTTP/HTTPS modules
   */
  wrapHttp(): SandboxedHttp {
    const sandbox = this;

    const sandboxedRequest: typeof http.request = function (
      urlOrOptions: string | URL | http.RequestOptions,
      optionsOrCallback?: http.RequestOptions | ((res: http.IncomingMessage) => void),
      callback?: (res: http.IncomingMessage) => void
    ): http.ClientRequest {
      // Parse arguments
      let url: string;
      let options: http.RequestOptions;
      let cb: ((res: http.IncomingMessage) => void) | undefined;

      if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
        url = urlOrOptions.toString();
        options = (typeof optionsOrCallback === 'object' ? optionsOrCallback : {}) as http.RequestOptions;
        cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      } else {
        options = urlOrOptions;
        url = `${options.protocol || 'http:'}//${options.hostname || options.host}${options.path || '/'}`;
        cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      }

      const startTime = Date.now();
      const method = options.method || 'GET';

      const request: NetworkRequest = {
        timestamp: startTime,
        url,
        method,
        protocol: '',
        hostname: '',
        port: 0,
        allowed: false,
      };

      try {
        const parsed = parseUrl(url);
        request.protocol = parsed.protocol;
        request.hostname = parsed.hostname;
        request.port = parsed.port;

        // Check if request is allowed
        if (!sandbox.isRequestAllowed(url)) {
          request.allowed = false;
          request.reason = 'Request denied by network policy';
          sandbox.recordRequest(request);

          // Create a dummy request that immediately errors
          const dummyRequest = new http.ClientRequest(options);
          process.nextTick(() => {
            dummyRequest.emit(
              'error',
              new Error(`Network request denied: ${url} (policy violation)`)
            );
          });
          return dummyRequest;
        }

        request.allowed = true;
        sandbox.recordRequest(request);

        // Make the actual request
        const protocol = parsed.protocol === 'https:' ? https : http;
        const actualRequest = protocol.request(urlOrOptions as any, optionsOrCallback as any, callback as any);

        // Track response
        actualRequest.on('response', (res) => {
          request.duration = Date.now() - startTime;
          request.statusCode = res.statusCode;
          sandbox.recordRequest(request);
        });

        actualRequest.on('error', (error) => {
          request.error = error.message;
          request.duration = Date.now() - startTime;
          sandbox.recordRequest(request);
        });

        return actualRequest;
      } catch (error) {
        request.error = error instanceof Error ? error.message : String(error);
        request.duration = Date.now() - startTime;
        sandbox.recordRequest(request);

        const dummyRequest = new http.ClientRequest(options);
        process.nextTick(() => {
          dummyRequest.emit('error', error);
        });
        return dummyRequest;
      }
    };

    const sandboxedGet: typeof http.get = function (
      urlOrOptions: string | URL | http.RequestOptions,
      optionsOrCallback?: http.RequestOptions | ((res: http.IncomingMessage) => void),
      callback?: (res: http.IncomingMessage) => void
    ): http.ClientRequest {
      return sandboxedRequest(urlOrOptions as any, optionsOrCallback as any, callback);
    };

    return {
      request: sandboxedRequest,
      get: sandboxedGet,
    };
  }

  /**
   * Get request log
   */
  getRequestLog(limit?: number): NetworkRequest[] {
    if (limit) {
      return this.requestLog.slice(-limit);
    }
    return [...this.requestLog];
  }

  /**
   * Get statistics
   */
  getStats(): NetworkStats {
    const totalRequests = this.requestLog.length;
    const allowedRequests = this.requestLog.filter((r) => r.allowed).length;
    const deniedRequests = totalRequests - allowedRequests;

    // Calculate requests per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const requestsPerMinute = this.requestLog.filter((r) => r.timestamp > oneMinuteAgo).length;

    // Top domains
    const topDomains = Array.from(this.domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top ports
    const topPorts = Array.from(this.portCounts.entries())
      .map(([port, count]) => ({ port, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Protocol breakdown
    const protocolBreakdown: Record<string, number> = {};
    this.protocolCounts.forEach((count, protocol) => {
      protocolBreakdown[protocol] = count;
    });

    return {
      totalRequests,
      allowedRequests,
      deniedRequests,
      requestsPerMinute,
      topDomains,
      topPorts,
      protocolBreakdown,
      errorCount: this.errorCount,
    };
  }

  /**
   * Clear all logs and statistics
   */
  clearLogs(): void {
    this.requestLog = [];
    this.requestTimestamps = [];
    this.domainCounts.clear();
    this.portCounts.clear();
    this.protocolCounts.clear();
    this.errorCount = 0;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(
      {
        policy: this.policy,
        stats: this.getStats(),
        requests: this.requestLog,
      },
      null,
      2
    );
  }
}

/**
 * Parse URL string into components
 */
export function parseUrl(urlString: string): ParsedUrl {
  try {
    const url = new URL(urlString);

    // Determine port
    let port: number;
    if (url.port) {
      port = parseInt(url.port, 10);
    } else {
      // Default ports
      port = url.protocol === 'https:' ? 443 : url.protocol === 'http:' ? 80 : 0;
    }

    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      href: url.href,
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

/**
 * Match domain against pattern (supports wildcards)
 *
 * Patterns:
 * - "example.com" - exact match
 * - "*.example.com" - match all subdomains
 * - "**.example.com" - match all subdomains and the domain itself
 * - "*" - match all domains
 */
export function matchDomainPattern(domain: string, pattern: string): boolean {
  // Normalize to lowercase
  domain = domain.toLowerCase();
  pattern = pattern.toLowerCase();

  // Exact match
  if (domain === pattern) {
    return true;
  }

  // Match all domains
  if (pattern === '*' || pattern === '**') {
    return true;
  }

  // Wildcard patterns
  if (pattern.startsWith('**.')) {
    // Match domain and all subdomains
    const baseDomain = pattern.slice(3);
    return domain === baseDomain || domain.endsWith(`.${baseDomain}`);
  }

  if (pattern.startsWith('*.')) {
    // Match only subdomains
    const baseDomain = pattern.slice(2);
    return domain.endsWith(`.${baseDomain}`);
  }

  // Pattern ends with wildcard
  if (pattern.endsWith('.*')) {
    const basePattern = pattern.slice(0, -2);
    return domain.startsWith(basePattern);
  }

  // Contains wildcard
  if (pattern.includes('*')) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(domain);
  }

  return false;
}

/**
 * Create a restrictive network sandbox
 */
export function createRestrictiveSandbox(allowedDomains: string[]): NetworkSandbox {
  return new NetworkSandbox({
    allowedDomains,
    deniedDomains: [],
    allowedPorts: [80, 443],
    deniedPorts: [],
    allowedProtocols: ['http:', 'https:'],
    maxRequestsPerMinute: 30,
    enableLogging: true,
  });
}

/**
 * Create a permissive network sandbox
 */
export function createPermissiveSandbox(deniedDomains: string[] = []): NetworkSandbox {
  return new NetworkSandbox({
    allowedDomains: [],
    deniedDomains,
    allowedPorts: [],
    deniedPorts: [22, 23, 3389], // Block SSH, Telnet, RDP
    allowedProtocols: ['http:', 'https:', 'ws:', 'wss:'],
    maxRequestsPerMinute: 120,
    enableLogging: true,
  });
}

/**
 * Create a sandbox with no restrictions (for testing)
 */
export function createUnrestrictedSandbox(): NetworkSandbox {
  return new NetworkSandbox({
    allowedDomains: [],
    deniedDomains: [],
    allowedPorts: [],
    deniedPorts: [],
    allowedProtocols: [],
    maxRequestsPerMinute: undefined,
    enableLogging: true,
  });
}
