/**
 * 增量缓存管理器
 * 支持增量更新，只重新分析变更的文件
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ModuleNode,
  CacheData,
  CacheEntry,
} from './types.js';

// ============================================================================
// IncrementalCache 类
// ============================================================================

export class IncrementalCache {
  private cacheFile: string;
  private cache: CacheData | null = null;
  private dirty: boolean = false;

  constructor(projectRoot: string) {
    const claudeDir = path.join(projectRoot, '.claude');
    this.cacheFile = path.join(claudeDir, 'map-cache.json');
  }

  /**
   * 加载缓存
   */
  async load(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        this.cache = null;
        return false;
      }

      const content = fs.readFileSync(this.cacheFile, 'utf-8');
      this.cache = JSON.parse(content);
      this.dirty = false;

      return true;
    } catch (error) {
      console.warn('Failed to load cache:', error);
      this.cache = null;
      return false;
    }
  }

  /**
   * 保存缓存
   */
  async save(): Promise<void> {
    if (!this.cache || !this.dirty) {
      return;
    }

    try {
      // 确保目录存在
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 更新时间戳
      this.cache.generatedAt = new Date().toISOString();

      // 写入文件
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(this.cache, null, 2),
        'utf-8'
      );

      this.dirty = false;
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  /**
   * 检查文件是否需要重新分析
   */
  async needsReanalysis(filePath: string): Promise<boolean> {
    if (!this.cache) {
      return true;
    }

    const relativePath = this.getRelativePath(filePath);
    const entry = this.cache.entries[relativePath];

    if (!entry) {
      return true;
    }

    try {
      const stats = fs.statSync(filePath);

      // 检查修改时间
      if (entry.mtime !== stats.mtimeMs) {
        // 修改时间不同，再检查内容哈希
        const content = fs.readFileSync(filePath, 'utf-8');
        const hash = this.calculateHash(content);

        return hash !== entry.hash;
      }

      // 修改时间相同，假设内容未变
      return false;
    } catch {
      return true;
    }
  }

  /**
   * 批量检查文件
   */
  async checkFiles(filePaths: string[]): Promise<{
    changed: string[];
    unchanged: string[];
    removed: string[];
  }> {
    const changed: string[] = [];
    const unchanged: string[] = [];
    const currentFiles = new Set(filePaths.map((f) => this.getRelativePath(f)));

    // 检查每个文件
    for (const filePath of filePaths) {
      const needsUpdate = await this.needsReanalysis(filePath);

      if (needsUpdate) {
        changed.push(filePath);
      } else {
        unchanged.push(filePath);
      }
    }

    // 检查已删除的文件
    const removed: string[] = [];
    if (this.cache) {
      for (const cachedPath of Object.keys(this.cache.entries)) {
        if (!currentFiles.has(cachedPath)) {
          removed.push(cachedPath);
        }
      }
    }

    return { changed, unchanged, removed };
  }

  /**
   * 获取缓存的模块
   */
  getCachedModule(filePath: string): ModuleNode | null {
    if (!this.cache) {
      return null;
    }

    const relativePath = this.getRelativePath(filePath);
    const entry = this.cache.entries[relativePath];

    return entry?.module || null;
  }

  /**
   * 更新缓存条目
   */
  async updateEntry(filePath: string, module: ModuleNode): Promise<void> {
    if (!this.cache) {
      this.cache = {
        version: '1.0.0',
        rootPath: path.dirname(path.dirname(this.cacheFile)),
        generatedAt: new Date().toISOString(),
        entries: {},
      };
    }

    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = this.calculateHash(content);

      const relativePath = this.getRelativePath(filePath);

      this.cache.entries[relativePath] = {
        hash,
        mtime: stats.mtimeMs,
        module,
      };

      this.dirty = true;
    } catch (error) {
      console.warn(`Failed to update cache entry for ${filePath}:`, error);
    }
  }

  /**
   * 删除缓存条目
   */
  removeEntry(filePath: string): void {
    if (!this.cache) {
      return;
    }

    const relativePath = this.getRelativePath(filePath);

    if (this.cache.entries[relativePath]) {
      delete this.cache.entries[relativePath];
      this.dirty = true;
    }
  }

  /**
   * 批量删除条目
   */
  removeEntries(filePaths: string[]): void {
    for (const filePath of filePaths) {
      this.removeEntry(filePath);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache = null;
    this.dirty = false;

    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch (error) {
      console.warn('Failed to delete cache file:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    entryCount: number;
    cacheFileSize: number;
    lastGenerated: string | null;
  } {
    let cacheFileSize = 0;

    try {
      if (fs.existsSync(this.cacheFile)) {
        cacheFileSize = fs.statSync(this.cacheFile).size;
      }
    } catch {
      // 忽略
    }

    return {
      entryCount: this.cache ? Object.keys(this.cache.entries).length : 0,
      cacheFileSize,
      lastGenerated: this.cache?.generatedAt || null,
    };
  }

  /**
   * 验证缓存版本兼容性
   */
  isCompatible(expectedVersion: string = '1.0.0'): boolean {
    if (!this.cache) {
      return false;
    }

    // 简单版本检查：主版本号必须相同
    const cacheVersion = this.cache.version.split('.')[0];
    const expected = expectedVersion.split('.')[0];

    return cacheVersion === expected;
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  private getRelativePath(filePath: string): string {
    if (this.cache?.rootPath) {
      return path.relative(this.cache.rootPath, filePath).replace(/\\/g, '/');
    }

    // 从缓存文件路径推断根目录
    const rootPath = path.dirname(path.dirname(this.cacheFile));
    return path.relative(rootPath, filePath).replace(/\\/g, '/');
  }

  private calculateHash(content: string): string {
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
  }
}

/**
 * 便捷函数：创建缓存管理器
 */
export function createCache(projectRoot: string): IncrementalCache {
  return new IncrementalCache(projectRoot);
}
