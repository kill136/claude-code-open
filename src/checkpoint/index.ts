/**
 * File Checkpointing System
 * Save and restore file states during editing sessions
 *
 * Features:
 * - Automatic and manual checkpoint creation
 * - Incremental diff-based storage
 * - Git integration
 * - Checkpoint browsing and search
 * - Multi-file restoration
 * - Compression and storage optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { execSync } from 'child_process';

export interface FileCheckpoint {
  path: string;
  content?: string; // Full content (for first checkpoint)
  diff?: string; // Incremental diff (for subsequent checkpoints)
  hash: string;
  timestamp: number;
  name?: string; // User-defined name
  description?: string; // User-defined description
  gitCommit?: string; // Associated git commit SHA
  editCount?: number; // Number of edits since last checkpoint
  compressed?: boolean; // Whether content is compressed
  metadata?: {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number; // File size in bytes
  };
  tags?: string[]; // User-defined tags for filtering
}

export interface CheckpointSession {
  id: string;
  startTime: number;
  workingDirectory: string;
  checkpoints: Map<string, FileCheckpoint[]>;
  currentIndex: Map<string, number>;
  editCounts: Map<string, number>; // Track edits per file
  autoCheckpointInterval: number; // Auto-checkpoint after N edits
  metadata?: {
    gitBranch?: string;
    gitCommit?: string;
    tags?: string[];
    totalSize?: number; // Total storage used in bytes
  };
}

export interface CheckpointSearchOptions {
  filePath?: string;
  timeRange?: { start: number; end: number };
  tags?: string[];
  gitCommit?: string;
  namePattern?: string;
  limit?: number;
}

export interface CheckpointRestoreOptions {
  createBackup?: boolean;
  dryRun?: boolean;
  preserveMetadata?: boolean;
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalFiles: number;
  totalSize: number;
  oldestCheckpoint?: number;
  newestCheckpoint?: number;
  compressionRatio?: number;
}

// Checkpoint storage directory
const CHECKPOINT_DIR = path.join(os.homedir(), '.claude', 'checkpoints');
const MAX_CHECKPOINTS_PER_FILE = 100;
const CHECKPOINT_RETENTION_DAYS = 30;
const DEFAULT_AUTO_CHECKPOINT_INTERVAL = 5; // Create checkpoint every 5 edits
const MAX_STORAGE_SIZE_MB = 500; // Maximum storage size
const COMPRESSION_THRESHOLD_BYTES = 1024; // Compress files larger than 1KB

// Current session
let currentSession: CheckpointSession | null = null;

/**
 * Initialize checkpoint system
 */
export function initCheckpoints(
  sessionId?: string,
  autoCheckpointInterval: number = DEFAULT_AUTO_CHECKPOINT_INTERVAL
): CheckpointSession {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }

  const gitBranch = getGitBranch();
  const gitCommit = getGitCommit();

  currentSession = {
    id: sessionId || generateSessionId(),
    startTime: Date.now(),
    workingDirectory: process.cwd(),
    checkpoints: new Map(),
    currentIndex: new Map(),
    editCounts: new Map(),
    autoCheckpointInterval,
    metadata: {
      gitBranch,
      gitCommit,
      totalSize: 0,
    },
  };

  // Clean up old checkpoints
  cleanupOldCheckpoints();

  // Load existing session if resuming
  if (sessionId) {
    loadCheckpointSession(sessionId);
  }

  return currentSession;
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Get content hash
 */
function getContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Get current git branch
 */
function getGitBranch(): string | undefined {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Get current git commit
 */
function getGitCommit(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Check if file is in a git repository
 */
function isInGitRepo(filePath: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: path.dirname(filePath),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress content using gzip
 */
function compressContent(content: string): Buffer {
  return zlib.gzipSync(Buffer.from(content, 'utf-8'));
}

/**
 * Decompress content
 */
function decompressContent(compressed: Buffer): string {
  return zlib.gunzipSync(compressed).toString('utf-8');
}

/**
 * Calculate simple diff between two strings
 * Returns a compact diff representation
 */
function calculateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const diff: Array<{ op: 'add' | 'del' | 'eq'; line: string; num: number }> = [];

  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length) {
      // Find next common line
      while (oldIdx < oldLines.length && oldLines[oldIdx] !== lcs[lcsIdx]) {
        diff.push({ op: 'del', line: oldLines[oldIdx], num: oldIdx });
        oldIdx++;
      }
      while (newIdx < newLines.length && newLines[newIdx] !== lcs[lcsIdx]) {
        diff.push({ op: 'add', line: newLines[newIdx], num: newIdx });
        newIdx++;
      }
      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        diff.push({ op: 'eq', line: oldLines[oldIdx], num: oldIdx });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      }
    } else {
      // Remaining lines
      while (oldIdx < oldLines.length) {
        diff.push({ op: 'del', line: oldLines[oldIdx], num: oldIdx });
        oldIdx++;
      }
      while (newIdx < newLines.length) {
        diff.push({ op: 'add', line: newLines[newIdx], num: newIdx });
        newIdx++;
      }
    }
  }

  // Encode diff as JSON
  return JSON.stringify(diff);
}

/**
 * Apply diff to content
 */
function applyDiff(oldContent: string, diffStr: string): string {
  const diff = JSON.parse(diffStr);
  const result: string[] = [];

  for (const entry of diff) {
    if (entry.op === 'add' || entry.op === 'eq') {
      result.push(entry.line);
    }
  }

  return result.join('\n');
}

/**
 * Longest Common Subsequence algorithm
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Create a checkpoint for a file (enhanced version)
 */
export function createCheckpoint(
  filePath: string,
  options?: {
    name?: string;
    description?: string;
    tags?: string[];
    forceFullContent?: boolean;
  }
): FileCheckpoint | null {
  if (!currentSession) {
    initCheckpoints();
  }

  const absolutePath = path.resolve(filePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const stats = fs.statSync(absolutePath);
    const hash = getContentHash(content);

    // Check if content is different from last checkpoint
    const existingCheckpoints = currentSession!.checkpoints.get(absolutePath) || [];
    if (existingCheckpoints.length > 0 && !options?.forceFullContent) {
      const lastCheckpoint = existingCheckpoints[existingCheckpoints.length - 1];
      if (lastCheckpoint.hash === hash) {
        // Content unchanged, skip
        return lastCheckpoint;
      }
    }

    // Get git commit if in repo
    const gitCommit = isInGitRepo(absolutePath) ? getGitCommit() : undefined;

    // Get edit count
    const editCount = currentSession!.editCounts.get(absolutePath) || 0;

    // Determine if we should use diff or full content
    const useFullContent =
      existingCheckpoints.length === 0 || options?.forceFullContent || editCount === 0;

    let checkpointContent: string | undefined;
    let checkpointDiff: string | undefined;
    let compressed = false;

    if (useFullContent) {
      // Store full content
      if (content.length > COMPRESSION_THRESHOLD_BYTES) {
        // Compress large files
        const compressedBuffer = compressContent(content);
        checkpointContent = compressedBuffer.toString('base64');
        compressed = true;
      } else {
        checkpointContent = content;
      }
    } else {
      // Store incremental diff
      const lastCheckpoint = existingCheckpoints[existingCheckpoints.length - 1];
      const lastContent = reconstructContent(absolutePath, existingCheckpoints.length - 1);
      checkpointDiff = calculateDiff(lastContent, content);
    }

    const checkpoint: FileCheckpoint = {
      path: absolutePath,
      content: checkpointContent,
      diff: checkpointDiff,
      hash,
      timestamp: Date.now(),
      name: options?.name,
      description: options?.description,
      gitCommit,
      editCount,
      compressed,
      metadata: {
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
        size: stats.size,
      },
      tags: options?.tags,
    };

    // Add to session
    if (!currentSession!.checkpoints.has(absolutePath)) {
      currentSession!.checkpoints.set(absolutePath, []);
    }

    const checkpoints = currentSession!.checkpoints.get(absolutePath)!;
    checkpoints.push(checkpoint);

    // Limit checkpoints (keep first and last, remove middle ones if needed)
    if (checkpoints.length > MAX_CHECKPOINTS_PER_FILE) {
      // Keep first checkpoint (base) and recent ones
      const toKeep = MAX_CHECKPOINTS_PER_FILE;
      const toRemove = checkpoints.length - toKeep;
      checkpoints.splice(1, toRemove); // Remove from position 1
    }

    // Update index
    currentSession!.currentIndex.set(absolutePath, checkpoints.length - 1);

    // Reset edit count
    currentSession!.editCounts.set(absolutePath, 0);

    // Persist checkpoint
    saveCheckpointToDisk(checkpoint);

    // Update total size
    updateSessionSize();

    // Check storage limits
    enforceStorageLimits();

    return checkpoint;
  } catch (err) {
    console.error(`Failed to create checkpoint for ${filePath}:`, err);
    return null;
  }
}

/**
 * Auto-checkpoint: called after each file edit
 */
export function trackFileEdit(filePath: string): void {
  if (!currentSession) {
    return;
  }

  const absolutePath = path.resolve(filePath);
  const editCount = (currentSession.editCounts.get(absolutePath) || 0) + 1;
  currentSession.editCounts.set(absolutePath, editCount);

  // Auto-checkpoint if threshold reached
  if (editCount >= currentSession.autoCheckpointInterval) {
    createCheckpoint(absolutePath, {
      name: `Auto-checkpoint at ${editCount} edits`,
    });
  }
}

/**
 * Reconstruct file content from checkpoints
 */
function reconstructContent(filePath: string, checkpointIndex: number): string {
  if (!currentSession) {
    throw new Error('No active session');
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpointIndex < 0 || checkpointIndex >= checkpoints.length) {
    throw new Error('Invalid checkpoint index');
  }

  // Find the last full content checkpoint at or before this index
  let baseIndex = checkpointIndex;
  while (baseIndex >= 0 && !checkpoints[baseIndex].content) {
    baseIndex--;
  }

  if (baseIndex < 0) {
    throw new Error('No base checkpoint found');
  }

  let content = checkpoints[baseIndex].content!;

  // Decompress if needed
  if (checkpoints[baseIndex].compressed) {
    const buffer = Buffer.from(content, 'base64');
    content = decompressContent(buffer);
  }

  // Apply diffs from base to target
  for (let i = baseIndex + 1; i <= checkpointIndex; i++) {
    if (checkpoints[i].diff) {
      content = applyDiff(content, checkpoints[i].diff);
    } else if (checkpoints[i].content) {
      // Full content checkpoint
      content = checkpoints[i].content!;
      if (checkpoints[i].compressed) {
        const buffer = Buffer.from(content, 'base64');
        content = decompressContent(buffer);
      }
    }
  }

  return content;
}

/**
 * Save checkpoint to disk
 */
function saveCheckpointToDisk(checkpoint: FileCheckpoint): void {
  if (!currentSession) return;

  const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Use hash of file path as filename
  const fileHash = getContentHash(checkpoint.path);
  const checkpointFile = path.join(
    sessionDir,
    `${fileHash}-${checkpoint.timestamp}.json`
  );

  fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2), {
    mode: 0o600,
  });

  // Save session metadata
  saveSessionMetadata();
}

/**
 * Save session metadata
 */
function saveSessionMetadata(): void {
  if (!currentSession) return;

  const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
  const metadataFile = path.join(sessionDir, 'session.json');

  const metadata = {
    id: currentSession.id,
    startTime: currentSession.startTime,
    workingDirectory: currentSession.workingDirectory,
    autoCheckpointInterval: currentSession.autoCheckpointInterval,
    metadata: currentSession.metadata,
    files: Array.from(currentSession.checkpoints.keys()),
  };

  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), {
    mode: 0o600,
  });
}

/**
 * Load checkpoint session from disk
 */
function loadCheckpointSession(sessionId: string): void {
  if (!currentSession) return;

  const sessionDir = path.join(CHECKPOINT_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    return;
  }

  try {
    // Load all checkpoint files
    const files = fs.readdirSync(sessionDir);

    for (const file of files) {
      if (file === 'session.json') continue;
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(sessionDir, file);
      const checkpoint: FileCheckpoint = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Add to session
      if (!currentSession.checkpoints.has(checkpoint.path)) {
        currentSession.checkpoints.set(checkpoint.path, []);
      }

      currentSession.checkpoints.get(checkpoint.path)!.push(checkpoint);
    }

    // Sort checkpoints by timestamp
    for (const [, checkpoints] of currentSession.checkpoints) {
      checkpoints.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Update indices
    for (const [filePath, checkpoints] of currentSession.checkpoints) {
      currentSession.currentIndex.set(filePath, checkpoints.length - 1);
    }
  } catch (err) {
    console.error(`Failed to load checkpoint session ${sessionId}:`, err);
  }
}

/**
 * Update session total size
 */
function updateSessionSize(): void {
  if (!currentSession) return;

  const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
  if (!fs.existsSync(sessionDir)) {
    return;
  }

  let totalSize = 0;

  try {
    const files = fs.readdirSync(sessionDir);
    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }

    if (currentSession.metadata) {
      currentSession.metadata.totalSize = totalSize;
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Enforce storage limits
 */
function enforceStorageLimits(): void {
  if (!currentSession) return;

  const maxBytes = MAX_STORAGE_SIZE_MB * 1024 * 1024;
  const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);

  if (!fs.existsSync(sessionDir)) {
    return;
  }

  try {
    const totalSize = currentSession.metadata?.totalSize || 0;

    if (totalSize > maxBytes) {
      // Remove oldest checkpoints until under limit
      const allCheckpoints: Array<{ file: string; timestamp: number; size: number }> = [];

      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        if (file === 'session.json') continue;
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(sessionDir, file);
        const stats = fs.statSync(filePath);
        const checkpoint: FileCheckpoint = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        allCheckpoints.push({
          file: filePath,
          timestamp: checkpoint.timestamp,
          size: stats.size,
        });
      }

      // Sort by timestamp (oldest first)
      allCheckpoints.sort((a, b) => a.timestamp - b.timestamp);

      let currentSize = totalSize;
      for (const cp of allCheckpoints) {
        if (currentSize <= maxBytes * 0.8) {
          // Aim for 80% of limit
          break;
        }

        // Don't delete the first checkpoint for each file
        try {
          const checkpoint: FileCheckpoint = JSON.parse(fs.readFileSync(cp.file, 'utf-8'));
          const fileCheckpoints = currentSession.checkpoints.get(checkpoint.path);

          if (fileCheckpoints && fileCheckpoints.length > 1 && fileCheckpoints[0] !== checkpoint) {
            fs.unlinkSync(cp.file);
            currentSize -= cp.size;

            // Remove from session
            const idx = fileCheckpoints.findIndex((c) => c.timestamp === checkpoint.timestamp);
            if (idx > 0) {
              fileCheckpoints.splice(idx, 1);
            }
          }
        } catch {
          // Skip if error
        }
      }

      // Update size
      updateSessionSize();
    }
  } catch (err) {
    console.error('Failed to enforce storage limits:', err);
  }
}

/**
 * Restore file from checkpoint (enhanced)
 */
export function restoreCheckpoint(
  filePath: string,
  index?: number,
  options?: CheckpointRestoreOptions
): { success: boolean; message: string; content?: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints found for this file' };
  }

  const targetIndex = index ?? currentSession.currentIndex.get(absolutePath) ?? checkpoints.length - 1;

  if (targetIndex < 0 || targetIndex >= checkpoints.length) {
    return { success: false, message: 'Invalid checkpoint index' };
  }

  const checkpoint = checkpoints[targetIndex];

  try {
    // Reconstruct content
    const content = reconstructContent(absolutePath, targetIndex);

    // Dry run mode
    if (options?.dryRun) {
      return {
        success: true,
        message: 'Dry run successful',
        content,
      };
    }

    // Create backup of current state first
    if (fs.existsSync(absolutePath) && options?.createBackup !== false) {
      createCheckpoint(absolutePath, {
        name: 'Pre-restore backup',
      });
    }

    // Restore content
    fs.writeFileSync(absolutePath, content);

    // Restore metadata if requested
    if (options?.preserveMetadata !== false && checkpoint.metadata?.mode) {
      try {
        fs.chmodSync(absolutePath, checkpoint.metadata.mode);
      } catch {
        // Ignore permission errors
      }
    }

    currentSession.currentIndex.set(absolutePath, targetIndex);

    const checkpointName = checkpoint.name || `checkpoint from ${new Date(checkpoint.timestamp).toLocaleString()}`;

    return {
      success: true,
      message: `Restored to ${checkpointName}`,
    };
  } catch (err) {
    return { success: false, message: `Failed to restore: ${err}` };
  }
}

/**
 * Restore multiple files to a specific checkpoint
 */
export function restoreMultipleCheckpoints(
  files: Array<{ path: string; index?: number }>,
  options?: CheckpointRestoreOptions
): Array<{ path: string; success: boolean; message: string }> {
  const results: Array<{ path: string; success: boolean; message: string }> = [];

  for (const file of files) {
    const result = restoreCheckpoint(file.path, file.index, options);
    results.push({
      path: file.path,
      success: result.success,
      message: result.message,
    });
  }

  return results;
}

/**
 * Restore all files to a specific timestamp
 */
export function restoreToTimestamp(
  timestamp: number,
  options?: CheckpointRestoreOptions
): Array<{ path: string; success: boolean; message: string }> {
  if (!currentSession) {
    return [];
  }

  const results: Array<{ path: string; success: boolean; message: string }> = [];

  for (const [filePath, checkpoints] of currentSession.checkpoints) {
    // Find checkpoint closest to timestamp (but not after)
    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let i = 0; i < checkpoints.length; i++) {
      const diff = timestamp - checkpoints[i].timestamp;
      if (diff >= 0 && diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    if (closestIndex >= 0) {
      const result = restoreCheckpoint(filePath, closestIndex, options);
      results.push({
        path: filePath,
        success: result.success,
        message: result.message,
      });
    }
  }

  return results;
}

/**
 * Undo last change (go to previous checkpoint)
 */
export function undo(filePath: string): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints available' };
  }

  const currentIndex = currentSession.currentIndex.get(absolutePath) ?? checkpoints.length - 1;

  if (currentIndex <= 0) {
    return { success: false, message: 'Already at oldest checkpoint' };
  }

  return restoreCheckpoint(absolutePath, currentIndex - 1);
}

/**
 * Redo (go to next checkpoint)
 */
export function redo(filePath: string): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints available' };
  }

  const currentIndex = currentSession.currentIndex.get(absolutePath) ?? checkpoints.length - 1;

  if (currentIndex >= checkpoints.length - 1) {
    return { success: false, message: 'Already at newest checkpoint' };
  }

  return restoreCheckpoint(absolutePath, currentIndex + 1);
}

/**
 * Get checkpoint history for a file (enhanced)
 */
export function getCheckpointHistory(filePath: string): {
  checkpoints: Array<{
    index: number;
    timestamp: number;
    hash: string;
    name?: string;
    description?: string;
    gitCommit?: string;
    tags?: string[];
    size?: number;
    compressed?: boolean;
    current: boolean;
  }>;
  currentIndex: number;
} {
  if (!currentSession) {
    return { checkpoints: [], currentIndex: -1 };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath) || [];
  const currentIndex = currentSession.currentIndex.get(absolutePath) ?? checkpoints.length - 1;

  return {
    checkpoints: checkpoints.map((cp, idx) => ({
      index: idx,
      timestamp: cp.timestamp,
      hash: cp.hash,
      name: cp.name,
      description: cp.description,
      gitCommit: cp.gitCommit,
      tags: cp.tags,
      size: cp.metadata?.size,
      compressed: cp.compressed,
      current: idx === currentIndex,
    })),
    currentIndex,
  };
}

/**
 * Search checkpoints across all files
 */
export function searchCheckpoints(options: CheckpointSearchOptions): FileCheckpoint[] {
  if (!currentSession) {
    return [];
  }

  let results: FileCheckpoint[] = [];

  for (const [filePath, checkpoints] of currentSession.checkpoints) {
    // Filter by file path
    if (options.filePath) {
      const pattern = new RegExp(options.filePath, 'i');
      if (!pattern.test(filePath)) {
        continue;
      }
    }

    for (const checkpoint of checkpoints) {
      // Filter by time range
      if (options.timeRange) {
        if (
          checkpoint.timestamp < options.timeRange.start ||
          checkpoint.timestamp > options.timeRange.end
        ) {
          continue;
        }
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        if (!checkpoint.tags || !options.tags.some((tag) => checkpoint.tags?.includes(tag))) {
          continue;
        }
      }

      // Filter by git commit
      if (options.gitCommit && checkpoint.gitCommit !== options.gitCommit) {
        continue;
      }

      // Filter by name pattern
      if (options.namePattern && checkpoint.name) {
        const pattern = new RegExp(options.namePattern, 'i');
        if (!pattern.test(checkpoint.name)) {
          continue;
        }
      }

      results.push(checkpoint);
    }
  }

  // Sort by timestamp (newest first)
  results.sort((a, b) => b.timestamp - a.timestamp);

  // Apply limit
  if (options.limit && results.length > options.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * List all checkpoints with filtering
 */
export function listAllCheckpoints(options?: {
  sortBy?: 'timestamp' | 'size' | 'file';
  ascending?: boolean;
}): Array<{
  filePath: string;
  checkpoint: FileCheckpoint;
  index: number;
}> {
  if (!currentSession) {
    return [];
  }

  const results: Array<{
    filePath: string;
    checkpoint: FileCheckpoint;
    index: number;
  }> = [];

  for (const [filePath, checkpoints] of currentSession.checkpoints) {
    checkpoints.forEach((checkpoint, index) => {
      results.push({ filePath, checkpoint, index });
    });
  }

  // Sort
  const sortBy = options?.sortBy || 'timestamp';
  const ascending = options?.ascending || false;

  results.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'timestamp':
        comparison = a.checkpoint.timestamp - b.checkpoint.timestamp;
        break;
      case 'size':
        comparison = (a.checkpoint.metadata?.size || 0) - (b.checkpoint.metadata?.size || 0);
        break;
      case 'file':
        comparison = a.filePath.localeCompare(b.filePath);
        break;
    }

    return ascending ? comparison : -comparison;
  });

  return results;
}

/**
 * Get diff between two checkpoints
 */
export function getCheckpointDiff(
  filePath: string,
  fromIndex: number,
  toIndex: number
): { added: number; removed: number; diff: string } | null {
  if (!currentSession) {
    return null;
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || fromIndex < 0 || toIndex >= checkpoints.length) {
    return null;
  }

  const fromContent = checkpoints[fromIndex].content;
  const toContent = checkpoints[toIndex].content;

  // Simple line-based diff
  const fromLines = fromContent.split('\n');
  const toLines = toContent.split('\n');

  let added = 0;
  let removed = 0;
  const diffLines: string[] = [];

  // Very simple diff - just count line changes
  const maxLines = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (i >= fromLines.length) {
      added++;
      diffLines.push(`+ ${toLines[i]}`);
    } else if (i >= toLines.length) {
      removed++;
      diffLines.push(`- ${fromLines[i]}`);
    } else if (fromLines[i] !== toLines[i]) {
      removed++;
      added++;
      diffLines.push(`- ${fromLines[i]}`);
      diffLines.push(`+ ${toLines[i]}`);
    }
  }

  return {
    added,
    removed,
    diff: diffLines.join('\n'),
  };
}

/**
 * Clean up old checkpoints
 */
function cleanupOldCheckpoints(): void {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    return;
  }

  const cutoffTime = Date.now() - CHECKPOINT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    const sessions = fs.readdirSync(CHECKPOINT_DIR);

    for (const sessionDir of sessions) {
      const sessionPath = path.join(CHECKPOINT_DIR, sessionDir);
      const stats = fs.statSync(sessionPath);

      if (stats.isDirectory() && stats.mtimeMs < cutoffTime) {
        // Remove old session directory
        fs.rmSync(sessionPath, { recursive: true });
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Delete specific checkpoint
 */
export function deleteCheckpoint(
  filePath: string,
  index: number
): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || index < 0 || index >= checkpoints.length) {
    return { success: false, message: 'Invalid checkpoint index' };
  }

  // Don't allow deleting the first checkpoint if it's the only one
  if (checkpoints.length === 1) {
    return { success: false, message: 'Cannot delete the only checkpoint' };
  }

  // Don't allow deleting the base checkpoint if there are diff-based checkpoints
  if (index === 0) {
    const hasDiffs = checkpoints.slice(1).some((cp) => cp.diff && !cp.content);
    if (hasDiffs) {
      return { success: false, message: 'Cannot delete base checkpoint while diff checkpoints exist' };
    }
  }

  try {
    const checkpoint = checkpoints[index];

    // Delete from disk
    const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
    const fileHash = getContentHash(checkpoint.path);
    const checkpointFile = path.join(sessionDir, `${fileHash}-${checkpoint.timestamp}.json`);

    if (fs.existsSync(checkpointFile)) {
      fs.unlinkSync(checkpointFile);
    }

    // Remove from session
    checkpoints.splice(index, 1);

    // Update current index if needed
    const currentIndex = currentSession.currentIndex.get(absolutePath);
    if (currentIndex !== undefined && currentIndex >= index) {
      currentSession.currentIndex.set(absolutePath, Math.max(0, currentIndex - 1));
    }

    updateSessionSize();

    return { success: true, message: 'Checkpoint deleted successfully' };
  } catch (err) {
    return { success: false, message: `Failed to delete checkpoint: ${err}` };
  }
}

/**
 * Delete all checkpoints for a file
 */
export function deleteFileCheckpoints(filePath: string): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints found for this file' };
  }

  try {
    const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);

    // Delete all checkpoint files
    for (const checkpoint of checkpoints) {
      const fileHash = getContentHash(checkpoint.path);
      const checkpointFile = path.join(sessionDir, `${fileHash}-${checkpoint.timestamp}.json`);

      if (fs.existsSync(checkpointFile)) {
        fs.unlinkSync(checkpointFile);
      }
    }

    // Remove from session
    currentSession.checkpoints.delete(absolutePath);
    currentSession.currentIndex.delete(absolutePath);
    currentSession.editCounts.delete(absolutePath);

    updateSessionSize();

    return { success: true, message: `Deleted ${checkpoints.length} checkpoints` };
  } catch (err) {
    return { success: false, message: `Failed to delete checkpoints: ${err}` };
  }
}

/**
 * Merge consecutive checkpoints
 * Useful for reducing storage when you have many small changes
 */
export function mergeCheckpoints(
  filePath: string,
  startIndex: number,
  endIndex: number,
  options?: {
    name?: string;
    description?: string;
  }
): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || startIndex < 0 || endIndex >= checkpoints.length || startIndex >= endIndex) {
    return { success: false, message: 'Invalid checkpoint range' };
  }

  try {
    // Reconstruct final content
    const finalContent = reconstructContent(absolutePath, endIndex);

    // Get metadata from last checkpoint
    const lastCheckpoint = checkpoints[endIndex];

    // Create merged checkpoint
    const mergedCheckpoint: FileCheckpoint = {
      path: absolutePath,
      content: finalContent.length > COMPRESSION_THRESHOLD_BYTES
        ? compressContent(finalContent).toString('base64')
        : finalContent,
      hash: getContentHash(finalContent),
      timestamp: Date.now(),
      name: options?.name || `Merged ${endIndex - startIndex + 1} checkpoints`,
      description: options?.description,
      compressed: finalContent.length > COMPRESSION_THRESHOLD_BYTES,
      metadata: lastCheckpoint.metadata,
      tags: lastCheckpoint.tags,
    };

    // Delete old checkpoint files
    const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
    for (let i = startIndex; i <= endIndex; i++) {
      const checkpoint = checkpoints[i];
      const fileHash = getContentHash(checkpoint.path);
      const checkpointFile = path.join(sessionDir, `${fileHash}-${checkpoint.timestamp}.json`);

      if (fs.existsSync(checkpointFile)) {
        fs.unlinkSync(checkpointFile);
      }
    }

    // Remove old checkpoints and insert merged one
    checkpoints.splice(startIndex, endIndex - startIndex + 1, mergedCheckpoint);

    // Save merged checkpoint
    saveCheckpointToDisk(mergedCheckpoint);

    // Update index if needed
    const currentIndex = currentSession.currentIndex.get(absolutePath);
    if (currentIndex !== undefined && currentIndex >= startIndex && currentIndex <= endIndex) {
      currentSession.currentIndex.set(absolutePath, startIndex);
    } else if (currentIndex !== undefined && currentIndex > endIndex) {
      currentSession.currentIndex.set(absolutePath, currentIndex - (endIndex - startIndex));
    }

    updateSessionSize();

    return {
      success: true,
      message: `Merged ${endIndex - startIndex + 1} checkpoints into one`,
    };
  } catch (err) {
    return { success: false, message: `Failed to merge checkpoints: ${err}` };
  }
}

/**
 * Get checkpoint statistics
 */
export function getCheckpointStats(): CheckpointStats {
  if (!currentSession) {
    return {
      totalCheckpoints: 0,
      totalFiles: 0,
      totalSize: 0,
    };
  }

  let totalCheckpoints = 0;
  let totalFiles = 0;
  let oldestTimestamp: number | undefined;
  let newestTimestamp: number | undefined;
  let uncompressedSize = 0;
  let compressedSize = 0;

  for (const [, checkpoints] of currentSession.checkpoints) {
    totalFiles++;
    totalCheckpoints += checkpoints.length;

    for (const checkpoint of checkpoints) {
      if (!oldestTimestamp || checkpoint.timestamp < oldestTimestamp) {
        oldestTimestamp = checkpoint.timestamp;
      }
      if (!newestTimestamp || checkpoint.timestamp > newestTimestamp) {
        newestTimestamp = checkpoint.timestamp;
      }

      if (checkpoint.metadata?.size) {
        uncompressedSize += checkpoint.metadata.size;
      }
    }
  }

  compressedSize = currentSession.metadata?.totalSize || 0;

  return {
    totalCheckpoints,
    totalFiles,
    totalSize: compressedSize,
    oldestCheckpoint: oldestTimestamp,
    newestCheckpoint: newestTimestamp,
    compressionRatio: uncompressedSize > 0 ? compressedSize / uncompressedSize : undefined,
  };
}

/**
 * Export checkpoint session
 */
export function exportCheckpointSession(
  outputPath?: string
): { success: boolean; message: string; data?: object } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const exported: Record<string, FileCheckpoint[]> = {};

  for (const [filePath, checkpoints] of currentSession.checkpoints) {
    exported[filePath] = checkpoints;
  }

  const exportData = {
    id: currentSession.id,
    startTime: currentSession.startTime,
    workingDirectory: currentSession.workingDirectory,
    metadata: currentSession.metadata,
    files: exported,
  };

  if (outputPath) {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), {
        mode: 0o600,
      });
      return {
        success: true,
        message: `Session exported to ${outputPath}`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to export session: ${err}`,
      };
    }
  }

  return {
    success: true,
    message: 'Session data prepared',
    data: exportData,
  };
}

/**
 * Import checkpoint session
 */
export function importCheckpointSession(
  importPath: string
): { success: boolean; message: string } {
  try {
    const data = JSON.parse(fs.readFileSync(importPath, 'utf-8'));

    // Initialize session
    currentSession = {
      id: data.id || generateSessionId(),
      startTime: data.startTime,
      workingDirectory: data.workingDirectory,
      checkpoints: new Map(),
      currentIndex: new Map(),
      editCounts: new Map(),
      autoCheckpointInterval: DEFAULT_AUTO_CHECKPOINT_INTERVAL,
      metadata: data.metadata,
    };

    // Restore checkpoints
    for (const [filePath, checkpoints] of Object.entries(data.files)) {
      currentSession.checkpoints.set(filePath, checkpoints as FileCheckpoint[]);
      currentSession.currentIndex.set(filePath, (checkpoints as FileCheckpoint[]).length - 1);
    }

    // Save to disk
    for (const [, checkpoints] of currentSession.checkpoints) {
      for (const checkpoint of checkpoints) {
        saveCheckpointToDisk(checkpoint);
      }
    }

    return {
      success: true,
      message: `Session imported successfully (${currentSession.checkpoints.size} files)`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to import session: ${err}`,
    };
  }
}

/**
 * Clear all checkpoints for current session
 */
export function clearCheckpoints(): void {
  if (!currentSession) {
    return;
  }

  currentSession.checkpoints.clear();
  currentSession.currentIndex.clear();

  // Remove session directory
  const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}

/**
 * Get current session
 */
export function getCurrentSession(): CheckpointSession | null {
  return currentSession;
}

/**
 * End current checkpoint session
 */
export function endCheckpointSession(): void {
  if (currentSession) {
    saveSessionMetadata();
  }
  currentSession = null;
}

/**
 * List all available checkpoint sessions
 */
export function listCheckpointSessions(): Array<{
  id: string;
  startTime: number;
  workingDirectory: string;
  fileCount: number;
  totalSize: number;
}> {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    return [];
  }

  const sessions: Array<{
    id: string;
    startTime: number;
    workingDirectory: string;
    fileCount: number;
    totalSize: number;
  }> = [];

  try {
    const sessionDirs = fs.readdirSync(CHECKPOINT_DIR);

    for (const sessionId of sessionDirs) {
      const sessionDir = path.join(CHECKPOINT_DIR, sessionId);
      const metadataFile = path.join(sessionDir, 'session.json');

      if (fs.existsSync(metadataFile)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
          const stats = fs.statSync(sessionDir);

          // Calculate total size
          let totalSize = 0;
          const files = fs.readdirSync(sessionDir);
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const fileStats = fs.statSync(filePath);
            totalSize += fileStats.size;
          }

          sessions.push({
            id: metadata.id,
            startTime: metadata.startTime,
            workingDirectory: metadata.workingDirectory,
            fileCount: metadata.files?.length || 0,
            totalSize,
          });
        } catch {
          // Skip invalid sessions
        }
      }
    }

    // Sort by start time (newest first)
    sessions.sort((a, b) => b.startTime - a.startTime);
  } catch (err) {
    console.error('Failed to list sessions:', err);
  }

  return sessions;
}

/**
 * Delete a specific checkpoint session
 */
export function deleteCheckpointSession(sessionId: string): { success: boolean; message: string } {
  const sessionDir = path.join(CHECKPOINT_DIR, sessionId);

  if (!fs.existsSync(sessionDir)) {
    return { success: false, message: 'Session not found' };
  }

  try {
    fs.rmSync(sessionDir, { recursive: true });
    return { success: true, message: 'Session deleted successfully' };
  } catch (err) {
    return { success: false, message: `Failed to delete session: ${err}` };
  }
}

/**
 * Optimize checkpoint storage for a file
 * Converts diff-based checkpoints to full content at intervals
 */
export function optimizeCheckpointStorage(filePath: string): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints found for this file' };
  }

  try {
    let modified = 0;

    // Every 10 checkpoints, create a full content checkpoint
    for (let i = 0; i < checkpoints.length; i++) {
      if (i % 10 === 0 && i > 0 && checkpoints[i].diff) {
        // Reconstruct content
        const content = reconstructContent(absolutePath, i);

        // Replace diff with full content
        checkpoints[i].content =
          content.length > COMPRESSION_THRESHOLD_BYTES
            ? compressContent(content).toString('base64')
            : content;
        checkpoints[i].diff = undefined;
        checkpoints[i].compressed = content.length > COMPRESSION_THRESHOLD_BYTES;

        // Save updated checkpoint
        saveCheckpointToDisk(checkpoints[i]);
        modified++;
      }
    }

    updateSessionSize();

    return {
      success: true,
      message: `Optimized ${modified} checkpoints`,
    };
  } catch (err) {
    return { success: false, message: `Failed to optimize: ${err}` };
  }
}

/**
 * Compact checkpoint storage by removing redundant checkpoints
 */
export function compactCheckpoints(
  filePath: string,
  options?: {
    keepEveryNth?: number; // Keep every Nth checkpoint
    maxCheckpoints?: number; // Maximum number of checkpoints to keep
  }
): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || checkpoints.length === 0) {
    return { success: false, message: 'No checkpoints found for this file' };
  }

  const keepEveryNth = options?.keepEveryNth || 5;
  const maxCheckpoints = options?.maxCheckpoints || MAX_CHECKPOINTS_PER_FILE;

  try {
    const toKeep: FileCheckpoint[] = [];

    // Always keep first checkpoint
    toKeep.push(checkpoints[0]);

    // Keep every Nth checkpoint
    for (let i = keepEveryNth; i < checkpoints.length; i += keepEveryNth) {
      toKeep.push(checkpoints[i]);
    }

    // Always keep last checkpoint
    if (checkpoints.length > 1 && toKeep[toKeep.length - 1] !== checkpoints[checkpoints.length - 1]) {
      toKeep.push(checkpoints[checkpoints.length - 1]);
    }

    // Limit total checkpoints
    if (toKeep.length > maxCheckpoints) {
      // Keep first, last, and evenly distributed ones
      const step = Math.floor(toKeep.length / maxCheckpoints);
      const limited: FileCheckpoint[] = [toKeep[0]];

      for (let i = step; i < toKeep.length - 1; i += step) {
        limited.push(toKeep[i]);
      }

      limited.push(toKeep[toKeep.length - 1]);
      toKeep.splice(0, toKeep.length, ...limited);
    }

    const deletedCount = checkpoints.length - toKeep.length;

    // Delete checkpoints not in toKeep
    const sessionDir = path.join(CHECKPOINT_DIR, currentSession.id);
    for (const checkpoint of checkpoints) {
      if (!toKeep.includes(checkpoint)) {
        const fileHash = getContentHash(checkpoint.path);
        const checkpointFile = path.join(sessionDir, `${fileHash}-${checkpoint.timestamp}.json`);

        if (fs.existsSync(checkpointFile)) {
          fs.unlinkSync(checkpointFile);
        }
      }
    }

    // Update session
    currentSession.checkpoints.set(absolutePath, toKeep);
    currentSession.currentIndex.set(absolutePath, toKeep.length - 1);

    updateSessionSize();

    return {
      success: true,
      message: `Compacted from ${checkpoints.length} to ${toKeep.length} checkpoints (deleted ${deletedCount})`,
    };
  } catch (err) {
    return { success: false, message: `Failed to compact: ${err}` };
  }
}

/**
 * Compare two checkpoints and get detailed diff
 */
export function compareCheckpoints(
  filePath: string,
  fromIndex: number,
  toIndex: number
): {
  success: boolean;
  message?: string;
  diff?: {
    added: number;
    removed: number;
    modified: number;
    diffText: string;
  };
} {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || fromIndex < 0 || toIndex >= checkpoints.length) {
    return { success: false, message: 'Invalid checkpoint indices' };
  }

  try {
    const fromContent = reconstructContent(absolutePath, fromIndex);
    const toContent = reconstructContent(absolutePath, toIndex);

    const fromLines = fromContent.split('\n');
    const toLines = toContent.split('\n');

    let added = 0;
    let removed = 0;
    let modified = 0;
    const diffLines: string[] = [];

    const maxLines = Math.max(fromLines.length, toLines.length);

    for (let i = 0; i < maxLines; i++) {
      if (i >= fromLines.length) {
        added++;
        diffLines.push(`+${i + 1}: ${toLines[i]}`);
      } else if (i >= toLines.length) {
        removed++;
        diffLines.push(`-${i + 1}: ${fromLines[i]}`);
      } else if (fromLines[i] !== toLines[i]) {
        modified++;
        diffLines.push(`-${i + 1}: ${fromLines[i]}`);
        diffLines.push(`+${i + 1}: ${toLines[i]}`);
      }
    }

    return {
      success: true,
      diff: {
        added,
        removed,
        modified,
        diffText: diffLines.join('\n'),
      },
    };
  } catch (err) {
    return { success: false, message: `Failed to compare: ${err}` };
  }
}

/**
 * Tag a checkpoint
 */
export function tagCheckpoint(
  filePath: string,
  index: number,
  tags: string[]
): { success: boolean; message: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || index < 0 || index >= checkpoints.length) {
    return { success: false, message: 'Invalid checkpoint index' };
  }

  try {
    checkpoints[index].tags = [...new Set([...(checkpoints[index].tags || []), ...tags])];
    saveCheckpointToDisk(checkpoints[index]);

    return { success: true, message: 'Tags added successfully' };
  } catch (err) {
    return { success: false, message: `Failed to tag checkpoint: ${err}` };
  }
}

/**
 * Get checkpoint content without restoring
 */
export function getCheckpointContent(
  filePath: string,
  index: number
): { success: boolean; message?: string; content?: string } {
  if (!currentSession) {
    return { success: false, message: 'No active checkpoint session' };
  }

  const absolutePath = path.resolve(filePath);
  const checkpoints = currentSession.checkpoints.get(absolutePath);

  if (!checkpoints || index < 0 || index >= checkpoints.length) {
    return { success: false, message: 'Invalid checkpoint index' };
  }

  try {
    const content = reconstructContent(absolutePath, index);
    return { success: true, content };
  } catch (err) {
    return { success: false, message: `Failed to get content: ${err}` };
  }
}
