/**
 * Filesystem Sandbox Usage Examples
 */

import {
  FilesystemSandbox,
  createDefaultPolicy,
  createPermissivePolicy,
  createStrictPolicy,
  matchPathPattern,
  isPathInside,
  validatePolicy,
  mergePolicies,
  getSandboxStats,
} from './filesystem.js';
import * as path from 'path';

/**
 * Example 1: Basic sandbox with default policy
 */
async function example1() {
  console.log('=== Example 1: Basic Sandbox ===');

  const policy = createDefaultPolicy('/home/user/projects');
  const sandbox = new FilesystemSandbox(policy);

  // Check if paths are allowed
  console.log('Can read /home/user/projects/file.txt?',
    sandbox.isPathAllowed('/home/user/projects/file.txt', 'read'));

  console.log('Can write to /etc/passwd?',
    sandbox.isPathAllowed('/etc/passwd', 'write'));

  console.log('Can read ~/.ssh/id_rsa?',
    sandbox.isPathAllowed('/home/user/.ssh/id_rsa', 'read'));

  // Get stats
  const stats = getSandboxStats(sandbox);
  console.log('Sandbox stats:', stats);

  await sandbox.cleanupTempDirs();
}

/**
 * Example 2: Using sandboxed filesystem wrapper
 */
async function example2() {
  console.log('\n=== Example 2: Sandboxed FS Wrapper ===');

  const policy = createStrictPolicy('/tmp/sandbox-test');
  const sandbox = new FilesystemSandbox(policy);
  const fs = sandbox.wrapFs();

  try {
    // This should work (inside allowed directory)
    const tempDir = await sandbox.createTempDir();
    console.log('Created temp directory:', tempDir);

    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'Hello, sandbox!');
    console.log('Wrote file successfully');

    const content = await fs.readFile(testFile, 'utf-8');
    console.log('Read content:', content);

    // This should fail (outside allowed directory)
    try {
      await fs.readFile('/etc/shadow', 'utf-8');
    } catch (error) {
      console.log('Access denied (as expected):', (error as Error).message);
    }

    await sandbox.cleanupTempDirs();
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 3: Path pattern matching
 */
function example3() {
  console.log('\n=== Example 3: Path Pattern Matching ===');

  // Wildcard patterns
  console.log('*.js matches test.js?',
    matchPathPattern('/home/user/test.js', '/home/user/*.js'));

  console.log('*.js matches dir/test.js?',
    matchPathPattern('/home/user/dir/test.js', '/home/user/*.js'));

  // Recursive patterns
  console.log('**/*.ts matches nested file?',
    matchPathPattern('/home/user/a/b/c/file.ts', '/home/user/**/*.ts'));

  // Directory containment
  console.log('Is /home/user/projects/file.txt inside /home/user/projects?',
    isPathInside('/home/user/projects/file.txt', '/home/user/projects'));

  console.log('Is /etc/passwd inside /home/user?',
    isPathInside('/etc/passwd', '/home/user'));
}

/**
 * Example 4: Custom policy
 */
async function example4() {
  console.log('\n=== Example 4: Custom Policy ===');

  const policy = {
    allowedPaths: [
      {
        pattern: '/home/user/projects/**',
        operations: ['read', 'write'] as const,
        description: 'Project files',
      },
      {
        pattern: '/tmp/**',
        description: 'Temp directory',
      },
    ],
    deniedPaths: [
      {
        pattern: '/home/user/projects/secrets/**',
        description: 'Secret files',
      },
    ],
    defaultAction: 'deny' as const,
  };

  const validation = validatePolicy(policy);
  console.log('Policy valid?', validation.valid);
  if (!validation.valid) {
    console.log('Errors:', validation.errors);
  }

  const sandbox = new FilesystemSandbox(policy);

  console.log('Can read project file?',
    sandbox.isPathAllowed('/home/user/projects/src/main.ts', 'read'));

  console.log('Can read secret file?',
    sandbox.isPathAllowed('/home/user/projects/secrets/api-key.txt', 'read'));

  await sandbox.cleanupTempDirs();
}

/**
 * Example 5: Merging policies
 */
async function example5() {
  console.log('\n=== Example 5: Merging Policies ===');

  const basePolicy = createDefaultPolicy('/home/user/work');
  const extraPolicy = createPermissivePolicy();

  const merged = mergePolicies(basePolicy, extraPolicy);

  console.log('Merged policy has', merged.allowedPaths.length, 'allowed rules');
  console.log('Merged policy has', merged.deniedPaths.length, 'denied rules');
  console.log('Default action:', merged.defaultAction);

  const sandbox = new FilesystemSandbox(merged);
  await sandbox.cleanupTempDirs();
}

/**
 * Example 6: Dynamic policy modification
 */
async function example6() {
  console.log('\n=== Example 6: Dynamic Policy Modification ===');

  const policy = createStrictPolicy('/home/user/work');
  const sandbox = new FilesystemSandbox(policy);

  console.log('Before: Can read /opt/data?',
    sandbox.isPathAllowed('/opt/data/file.txt', 'read'));

  // Add new allowed path
  sandbox.addAllowedPath({
    pattern: '/opt/data/**',
    operations: ['read'],
    description: 'Read-only data directory',
  });

  console.log('After: Can read /opt/data?',
    sandbox.isPathAllowed('/opt/data/file.txt', 'read'));

  console.log('Can write /opt/data?',
    sandbox.isPathAllowed('/opt/data/file.txt', 'write'));

  // Add denied path
  sandbox.addDeniedPath({
    pattern: '/opt/data/private/**',
    description: 'Private data',
  });

  console.log('Can read /opt/data/private?',
    sandbox.isPathAllowed('/opt/data/private/secret.txt', 'read'));

  await sandbox.cleanupTempDirs();
}

/**
 * Example 7: Temporary directory isolation
 */
async function example7() {
  console.log('\n=== Example 7: Temporary Directory Isolation ===');

  const sandbox = new FilesystemSandbox(createDefaultPolicy());

  // Create multiple temp directories
  const temp1 = await sandbox.createTempDir('project-1-');
  const temp2 = await sandbox.createTempDir('project-2-');
  const temp3 = await sandbox.createTempDir('project-3-');

  console.log('Created temp directories:');
  console.log('  -', temp1);
  console.log('  -', temp2);
  console.log('  -', temp3);

  const stats = getSandboxStats(sandbox);
  console.log('Active temp directories:', stats.tempDirsCount);

  // Cleanup all at once
  await sandbox.cleanupTempDirs();

  const statsAfter = getSandboxStats(sandbox);
  console.log('After cleanup:', statsAfter.tempDirsCount);
}

// Run examples
async function main() {
  try {
    await example1();
    await example2();
    example3();
    await example4();
    await example5();
    await example6();
    await example7();
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Uncomment to run examples
// main();

export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
  example7,
};
