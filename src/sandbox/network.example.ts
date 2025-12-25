/**
 * Network Sandbox Examples
 * Demonstrates usage of the network sandbox
 */

import {
  NetworkSandbox,
  createRestrictiveSandbox,
  createPermissiveSandbox,
  createUnrestrictedSandbox,
  parseUrl,
  matchDomainPattern,
} from './network.js';

// Example 1: Basic domain matching
console.log('=== Example 1: Domain Pattern Matching ===');
console.log('Match example.com with example.com:', matchDomainPattern('example.com', 'example.com'));
console.log('Match api.example.com with *.example.com:', matchDomainPattern('api.example.com', '*.example.com'));
console.log('Match example.com with **.example.com:', matchDomainPattern('example.com', '**.example.com'));
console.log('Match api.example.com with **.example.com:', matchDomainPattern('api.example.com', '**.example.com'));
console.log('Match anything with *:', matchDomainPattern('anything.com', '*'));
console.log();

// Example 2: URL parsing
console.log('=== Example 2: URL Parsing ===');
const url1 = parseUrl('https://api.example.com:8443/v1/users?page=1#top');
console.log('Parsed URL:', JSON.stringify(url1, null, 2));
console.log();

// Example 3: Restrictive sandbox (whitelist approach)
console.log('=== Example 3: Restrictive Sandbox ===');
const restrictiveSandbox = createRestrictiveSandbox([
  'api.github.com',
  '*.anthropic.com',
]);

console.log('Allow api.github.com:', restrictiveSandbox.isRequestAllowed('https://api.github.com/users'));
console.log('Allow api.anthropic.com:', restrictiveSandbox.isRequestAllowed('https://api.anthropic.com/v1/messages'));
console.log('Allow random.com:', restrictiveSandbox.isRequestAllowed('https://random.com/api'));
console.log('Allow port 22 (SSH):', restrictiveSandbox.isPortAllowed(22));
console.log('Allow port 443 (HTTPS):', restrictiveSandbox.isPortAllowed(443));
console.log();

// Example 4: Permissive sandbox (blacklist approach)
console.log('=== Example 4: Permissive Sandbox ===');
const permissiveSandbox = createPermissiveSandbox([
  '*.malicious.com',
  'dangerous.net',
]);

console.log('Allow github.com:', permissiveSandbox.isRequestAllowed('https://github.com/api'));
console.log('Allow api.malicious.com:', permissiveSandbox.isRequestAllowed('https://api.malicious.com/data'));
console.log('Allow dangerous.net:', permissiveSandbox.isRequestAllowed('https://dangerous.net/api'));
console.log('Allow port 22 (SSH):', permissiveSandbox.isPortAllowed(22));
console.log('Allow port 443 (HTTPS):', permissiveSandbox.isPortAllowed(443));
console.log();

// Example 5: Custom policy
console.log('=== Example 5: Custom Policy ===');
const customSandbox = new NetworkSandbox({
  allowedDomains: ['api.example.com', '**.github.com'],
  deniedDomains: ['malware.github.com'],
  allowedPorts: [80, 443, 8080],
  deniedPorts: [],
  allowedProtocols: ['http:', 'https:'],
  maxRequestsPerMinute: 10,
  enableLogging: true,
});

console.log('Policy:', JSON.stringify(customSandbox.getPolicy(), null, 2));
console.log('Allow api.example.com:', customSandbox.isDomainAllowed('api.example.com'));
console.log('Allow api.github.com:', customSandbox.isDomainAllowed('api.github.com'));
console.log('Allow malware.github.com:', customSandbox.isDomainAllowed('malware.github.com'));
console.log('Allow port 8080:', customSandbox.isPortAllowed(8080));
console.log('Allow port 3000:', customSandbox.isPortAllowed(3000));
console.log();

// Example 6: Statistics tracking
console.log('=== Example 6: Statistics Tracking ===');
const sandbox = new NetworkSandbox({
  allowedDomains: ['*.example.com'],
  allowedPorts: [80, 443],
  allowedProtocols: ['http:', 'https:'],
  enableLogging: true,
});

// Simulate some requests
const urls = [
  'https://api.example.com/v1/users',
  'https://cdn.example.com/images/logo.png',
  'https://random.com/api',
  'http://api.example.com/v1/posts',
  'https://api.example.com:8080/admin',
];

urls.forEach((url) => {
  const allowed = sandbox.isRequestAllowed(url);
  console.log(`${allowed ? '✓' : '✗'} ${url}`);
});

console.log('\nStatistics:');
const stats = sandbox.getStats();
console.log(JSON.stringify(stats, null, 2));
console.log();

// Example 7: Rate limiting
console.log('=== Example 7: Rate Limiting ===');
const rateLimitedSandbox = new NetworkSandbox({
  allowedDomains: [],
  allowedPorts: [],
  allowedProtocols: [],
  maxRequestsPerMinute: 5,
  enableLogging: true,
});

console.log('Testing rate limit (max 5 requests per minute):');
for (let i = 1; i <= 7; i++) {
  const allowed = rateLimitedSandbox.isRequestAllowed('https://example.com/api');
  console.log(`Request ${i}: ${allowed ? 'Allowed' : 'Rate limited'}`);
}
console.log();

// Example 8: Export logs
console.log('=== Example 8: Export Logs ===');
const loggingSandbox = new NetworkSandbox({
  allowedDomains: ['example.com'],
  enableLogging: true,
});

loggingSandbox.isRequestAllowed('https://example.com/api');
loggingSandbox.isRequestAllowed('https://blocked.com/api');

const exportedLogs = loggingSandbox.exportLogs();
console.log('Exported logs (truncated):');
console.log(exportedLogs.slice(0, 500) + '...\n');

// Example 9: Wildcard patterns
console.log('=== Example 9: Advanced Wildcard Patterns ===');
const patterns = [
  { pattern: 'example.com', domain: 'example.com', expected: true },
  { pattern: 'example.com', domain: 'api.example.com', expected: false },
  { pattern: '*.example.com', domain: 'api.example.com', expected: true },
  { pattern: '*.example.com', domain: 'example.com', expected: false },
  { pattern: '**.example.com', domain: 'example.com', expected: true },
  { pattern: '**.example.com', domain: 'api.example.com', expected: true },
  { pattern: 'api.*.com', domain: 'api.example.com', expected: true },
  { pattern: '*', domain: 'anything.anywhere.com', expected: true },
];

patterns.forEach(({ pattern, domain, expected }) => {
  const result = matchDomainPattern(domain, pattern);
  const status = result === expected ? '✓' : '✗';
  console.log(`${status} Pattern: ${pattern}, Domain: ${domain}, Result: ${result} (Expected: ${expected})`);
});
console.log();

console.log('All examples completed!');
