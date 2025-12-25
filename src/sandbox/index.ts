/**
 * Sandbox Module
 * Provides sandboxing capabilities for filesystem, network, and process isolation
 */

// Filesystem sandbox
export {
  FilesystemSandbox,
  createDefaultPolicy,
  createPermissivePolicy,
  createStrictPolicy,
  validatePolicy,
  mergePolicies,
  matchPathPattern,
  isPathInside,
  getSandboxStats,
} from './filesystem.js';

export type {
  PathRule,
  FilesystemPolicy,
  SandboxedFs,
  SandboxStats,
} from './filesystem.js';

// Bubblewrap (Linux process isolation)
export {
  isBubblewrapAvailable,
  buildBwrapArgs,
  execInSandbox,
  createSandboxedBash,
  getSandboxCapabilities,
  getRecommendedSandbox,
  getSandboxInfo,
} from './bubblewrap.js';

export type {
  BubblewrapConfig,
  SandboxResult,
} from './bubblewrap.js';

// Network sandbox
export {
  NetworkSandbox,
  parseUrl,
  matchDomainPattern,
  createRestrictiveSandbox,
  createPermissiveSandbox,
  createUnrestrictedSandbox,
} from './network.js';

export type {
  NetworkPolicy,
  ParsedUrl,
  NetworkRequest,
  NetworkStats,
  SandboxedHttp,
} from './network.js';
