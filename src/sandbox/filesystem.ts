/**
 * Filesystem Sandbox
 * Provides path-based access control and isolation for file operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const mkdtemp = promisify(fs.mkdtemp);
const realpath = promisify(fs.realpath);
const stat = promisify(fs.stat);
const rm = promisify(fs.rm);

/**
 * Path rule for access control
 */
export interface PathRule {
  /** Path pattern (supports wildcards) */
  pattern: string;
  /** Operations allowed (default: all) */
  operations?: Array<'read' | 'write' | 'execute'>;
  /** Description of the rule */
  description?: string;
}

/**
 * Filesystem sandbox policy
 */
export interface FilesystemPolicy {
  /** Allowed path patterns */
  allowedPaths: PathRule[];
  /** Denied path patterns (takes precedence) */
  deniedPaths: PathRule[];
  /** Default action when no rule matches */
  defaultAction: 'allow' | 'deny';
  /** Case sensitivity for path matching */
  caseSensitive?: boolean;
}

/**
 * Sandboxed filesystem interface
 */
export interface SandboxedFs {
  readFile: typeof fs.promises.readFile;
  writeFile: typeof fs.promises.writeFile;
  readdir: typeof fs.promises.readdir;
  stat: typeof fs.promises.stat;
  mkdir: typeof fs.promises.mkdir;
  rm: typeof fs.promises.rm;
  exists: (path: string) => Promise<boolean>;
  realpath: (path: string) => Promise<string>;
}

/**
 * Filesystem Sandbox
 * Enforces path-based access control for file operations
 */
export class FilesystemSandbox {
  private policy: FilesystemPolicy;
  private tempDirs: Set<string> = new Set();
  private cleanupRegistered = false;

  constructor(policy: FilesystemPolicy) {
    this.policy = {
      ...policy,
      caseSensitive: policy.caseSensitive ?? (os.platform() !== 'win32'),
    };

    // Register cleanup on process exit
    if (!this.cleanupRegistered) {
      this.registerCleanup();
      this.cleanupRegistered = true;
    }
  }

  /**
   * Check if path is allowed for operation
   */
  isPathAllowed(
    filePath: string,
    operation: 'read' | 'write' | 'execute'
  ): boolean {
    try {
      const normalized = this.normalizePath(filePath);

      // Check deny list first (takes precedence)
      for (const rule of this.policy.deniedPaths) {
        if (this.matchesRule(normalized, rule, operation)) {
          return false;
        }
      }

      // Check allow list
      for (const rule of this.policy.allowedPaths) {
        if (this.matchesRule(normalized, rule, operation)) {
          return true;
        }
      }

      // No rule matched - use default action
      return this.policy.defaultAction === 'allow';
    } catch (error) {
      // If normalization fails, deny access
      return false;
    }
  }

  /**
   * Normalize path (resolve . and .. and symbolic links)
   */
  normalizePath(filePath: string): string {
    try {
      // Resolve to absolute path
      const absolute = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // Normalize path separators and resolve . and ..
      const normalized = path.normalize(absolute);

      return normalized;
    } catch (error) {
      throw new Error(`Failed to normalize path: ${filePath}`);
    }
  }

  /**
   * Resolve path relative to base
   */
  resolvePath(filePath: string, base?: string): string {
    const baseDir = base || process.cwd();
    const resolved = path.resolve(baseDir, filePath);
    return this.normalizePath(resolved);
  }

  /**
   * Create isolated temporary directory
   */
  async createTempDir(prefix = 'claude-sandbox-'): Promise<string> {
    const tmpBase = os.tmpdir();
    const tempDir = await mkdtemp(path.join(tmpBase, prefix));
    this.tempDirs.add(tempDir);
    return tempDir;
  }

  /**
   * Cleanup all temporary directories
   */
  async cleanupTempDirs(): Promise<void> {
    const errors: Error[] = [];
    const dirs = Array.from(this.tempDirs);

    for (const dir of dirs) {
      try {
        if (fs.existsSync(dir)) {
          await rm(dir, { recursive: true, force: true });
        }
      } catch (error) {
        errors.push(error as Error);
      }
    }

    this.tempDirs.clear();

    if (errors.length > 0) {
      const errorMsg = `Failed to cleanup ${errors.length} temp directories: ${errors.map(e => e.message).join(', ')}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * Wrap filesystem with sandbox checks
   */
  wrapFs(): SandboxedFs {
    const checkAccess = (filePath: string, operation: 'read' | 'write') => {
      if (!this.isPathAllowed(filePath, operation)) {
        throw new Error(
          `Access denied: ${operation} operation on ${filePath} is not allowed by sandbox policy`
        );
      }
    };

    return {
      readFile: async (filePath: fs.PathLike, options?: any): Promise<any> => {
        const pathStr = filePath.toString();
        checkAccess(pathStr, 'read');
        return fs.promises.readFile(filePath, options);
      },

      writeFile: async (filePath: fs.PathLike, data: any, options?: any): Promise<void> => {
        const pathStr = filePath.toString();
        checkAccess(pathStr, 'write');
        return fs.promises.writeFile(filePath, data, options);
      },

      readdir: async (dirPath: fs.PathLike, options?: any): Promise<any> => {
        const pathStr = dirPath.toString();
        checkAccess(pathStr, 'read');
        return fs.promises.readdir(dirPath, options);
      },

      stat: async (filePath: fs.PathLike, options?: any): Promise<any> => {
        const pathStr = filePath.toString();
        checkAccess(pathStr, 'read');
        return fs.promises.stat(filePath, options);
      },

      mkdir: async (dirPath: fs.PathLike, options?: any): Promise<any> => {
        const pathStr = dirPath.toString();
        checkAccess(pathStr, 'write');
        return fs.promises.mkdir(dirPath, options);
      },

      rm: async (filePath: fs.PathLike, options?: any): Promise<void> => {
        const pathStr = filePath.toString();
        checkAccess(pathStr, 'write');
        return fs.promises.rm(filePath, options);
      },

      exists: async (filePath: string): Promise<boolean> => {
        checkAccess(filePath, 'read');
        try {
          await fs.promises.access(filePath, fs.constants.F_OK);
          return true;
        } catch {
          return false;
        }
      },

      realpath: async (filePath: string): Promise<string> => {
        checkAccess(filePath, 'read');
        return realpath(filePath);
      },
    } as SandboxedFs;
  }

  /**
   * Get policy information
   */
  getPolicy(): Readonly<FilesystemPolicy> {
    return { ...this.policy };
  }

  /**
   * Add allowed path rule
   */
  addAllowedPath(rule: PathRule): void {
    this.policy.allowedPaths.push(rule);
  }

  /**
   * Add denied path rule
   */
  addDeniedPath(rule: PathRule): void {
    this.policy.deniedPaths.push(rule);
  }

  /**
   * Remove path rule
   */
  removePathRule(pattern: string, listType: 'allowed' | 'denied'): boolean {
    const list =
      listType === 'allowed'
        ? this.policy.allowedPaths
        : this.policy.deniedPaths;

    const index = list.findIndex((rule) => rule.pattern === pattern);
    if (index >= 0) {
      list.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if path matches rule
   */
  private matchesRule(
    filePath: string,
    rule: PathRule,
    operation: 'read' | 'write' | 'execute'
  ): boolean {
    // Check if operation is allowed by this rule
    if (rule.operations && !rule.operations.includes(operation)) {
      return false;
    }

    // Normalize pattern
    const pattern = this.normalizePath(rule.pattern);

    // Check if path matches pattern
    return matchPathPattern(
      filePath,
      pattern,
      this.policy.caseSensitive ?? true
    );
  }

  /**
   * Register cleanup handler
   */
  private registerCleanup(): void {
    const cleanup = () => {
      // Synchronous cleanup on exit
      const dirs = Array.from(this.tempDirs);
      for (const dir of dirs) {
        try {
          if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        } catch {
          // Ignore errors during exit cleanup
        }
      }
      this.tempDirs.clear();
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
  }
}

/**
 * Match path against pattern
 * Supports wildcards: * (any chars), ** (any dirs), ? (single char)
 */
export function matchPathPattern(
  filePath: string,
  pattern: string,
  caseSensitive = true
): boolean {
  // Normalize for comparison
  let testPath = path.normalize(filePath);
  let testPattern = path.normalize(pattern);

  if (!caseSensitive) {
    testPath = testPath.toLowerCase();
    testPattern = testPattern.toLowerCase();
  }

  // Handle exact match
  if (testPath === testPattern) {
    return true;
  }

  // Handle directory prefix match (pattern ends with /*)
  if (testPattern.endsWith(path.sep + '*')) {
    const prefix = testPattern.slice(0, -2);
    return isPathInside(testPath, prefix);
  }

  // Handle recursive directory match (pattern contains /**)
  if (testPattern.includes(path.sep + '**')) {
    // Convert to regex
    const regex = patternToRegex(testPattern, caseSensitive);
    return regex.test(testPath);
  }

  // Handle glob patterns
  if (testPattern.includes('*') || testPattern.includes('?')) {
    const regex = patternToRegex(testPattern, caseSensitive);
    return regex.test(testPath);
  }

  // Handle directory containment
  return isPathInside(testPath, testPattern);
}

/**
 * Check if child path is inside parent path
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);

  // If relative path starts with .. then child is outside parent
  return (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

/**
 * Convert glob pattern to regex
 */
function patternToRegex(pattern: string, caseSensitive = true): RegExp {
  // Escape regex special chars except * and ?
  let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Replace ** with placeholder
  regex = regex.replace(/\*\*/g, '\x00DOUBLESTAR\x00');

  // Replace * with [^/]* (match any char except separator)
  regex = regex.replace(/\*/g, '[^' + escapeRegex(path.sep) + ']*');

  // Replace ? with [^/] (match single char except separator)
  regex = regex.replace(/\?/g, '[^' + escapeRegex(path.sep) + ']');

  // Replace ** with .* (match any chars including separator)
  regex = regex.replace(/\x00DOUBLESTAR\x00/g, '.*');

  // Anchor to start and end
  regex = '^' + regex + '$';

  return new RegExp(regex, caseSensitive ? '' : 'i');
}

/**
 * Escape string for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create default sandbox policy
 */
export function createDefaultPolicy(cwd?: string): FilesystemPolicy {
  const workDir = cwd || process.cwd();
  const homeDir = os.homedir();
  const tmpDir = os.tmpdir();

  return {
    allowedPaths: [
      {
        pattern: path.join(workDir, '**'),
        description: 'Working directory',
      },
      {
        pattern: path.join(tmpDir, '**'),
        description: 'System temporary directory',
      },
      {
        pattern: path.join(homeDir, '.claude', '**'),
        operations: ['read', 'write'],
        description: 'Claude configuration directory',
      },
    ],
    deniedPaths: [
      {
        pattern: path.join(homeDir, '.ssh', '**'),
        description: 'SSH keys directory',
      },
      {
        pattern: path.join(homeDir, '.aws', '**'),
        description: 'AWS credentials',
      },
      {
        pattern: path.join(homeDir, '.gnupg', '**'),
        description: 'GPG keys',
      },
      {
        pattern: '/etc/shadow',
        description: 'System password file',
      },
      {
        pattern: '/etc/passwd',
        operations: ['write', 'execute'],
        description: 'System user file (read-only)',
      },
    ],
    defaultAction: 'deny',
    caseSensitive: os.platform() !== 'win32',
  };
}

/**
 * Create permissive sandbox policy (allows most operations)
 */
export function createPermissivePolicy(): FilesystemPolicy {
  const homeDir = os.homedir();

  return {
    allowedPaths: [
      {
        pattern: '/**',
        description: 'All paths',
      },
    ],
    deniedPaths: [
      {
        pattern: path.join(homeDir, '.ssh', '**'),
        description: 'SSH keys',
      },
      {
        pattern: '/etc/shadow',
        description: 'System passwords',
      },
    ],
    defaultAction: 'allow',
    caseSensitive: os.platform() !== 'win32',
  };
}

/**
 * Create strict sandbox policy (minimal access)
 */
export function createStrictPolicy(workDir?: string): FilesystemPolicy {
  const cwd = workDir || process.cwd();
  const tmpDir = os.tmpdir();

  return {
    allowedPaths: [
      {
        pattern: path.join(cwd, '**'),
        description: 'Working directory only',
      },
      {
        pattern: path.join(tmpDir, 'claude-sandbox-*', '**'),
        description: 'Sandbox temp directories only',
      },
    ],
    deniedPaths: [],
    defaultAction: 'deny',
    caseSensitive: os.platform() !== 'win32',
  };
}

/**
 * Validate filesystem policy
 */
export function validatePolicy(policy: FilesystemPolicy): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!policy.allowedPaths) {
    errors.push('Missing allowedPaths');
  }

  if (!policy.deniedPaths) {
    errors.push('Missing deniedPaths');
  }

  if (!['allow', 'deny'].includes(policy.defaultAction)) {
    errors.push('defaultAction must be "allow" or "deny"');
  }

  // Check for invalid patterns
  for (const rule of [...policy.allowedPaths, ...policy.deniedPaths]) {
    if (!rule.pattern) {
      errors.push('Path rule missing pattern');
    }

    if (rule.operations) {
      const validOps = ['read', 'write', 'execute'];
      for (const op of rule.operations) {
        if (!validOps.includes(op)) {
          errors.push(`Invalid operation: ${op}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge multiple policies (later policies override earlier ones)
 */
export function mergePolicies(
  ...policies: FilesystemPolicy[]
): FilesystemPolicy {
  if (policies.length === 0) {
    return createDefaultPolicy();
  }

  if (policies.length === 1) {
    return policies[0];
  }

  const merged: FilesystemPolicy = {
    allowedPaths: [],
    deniedPaths: [],
    defaultAction: policies[policies.length - 1].defaultAction,
    caseSensitive: policies[policies.length - 1].caseSensitive,
  };

  // Merge all path rules
  for (const policy of policies) {
    merged.allowedPaths.push(...policy.allowedPaths);
    merged.deniedPaths.push(...policy.deniedPaths);
  }

  // Remove duplicates
  merged.allowedPaths = deduplicateRules(merged.allowedPaths);
  merged.deniedPaths = deduplicateRules(merged.deniedPaths);

  return merged;
}

/**
 * Remove duplicate rules from list
 */
function deduplicateRules(rules: PathRule[]): PathRule[] {
  const seen = new Set<string>();
  const unique: PathRule[] = [];

  for (const rule of rules) {
    const key = JSON.stringify({
      pattern: rule.pattern,
      operations: rule.operations?.sort(),
    });

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rule);
    }
  }

  return unique;
}

/**
 * Get sandbox statistics
 */
export interface SandboxStats {
  tempDirsCount: number;
  allowedRulesCount: number;
  deniedRulesCount: number;
  defaultAction: 'allow' | 'deny';
}

/**
 * Get sandbox statistics
 */
export function getSandboxStats(sandbox: FilesystemSandbox): SandboxStats {
  const policy = sandbox.getPolicy();

  return {
    tempDirsCount: (sandbox as any).tempDirs.size,
    allowedRulesCount: policy.allowedPaths.length,
    deniedRulesCount: policy.deniedPaths.length,
    defaultAction: policy.defaultAction,
  };
}
