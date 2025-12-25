/**
 * Git 工具模块统一导出
 * 实现 T291-T298 所有 Git 集成功能
 */

// 核心功能 (T291, T294, T295)
export {
  GitUtils,
  type GitStatus,
  type GitInfo,
  type PushStatus,
} from './core.js';

// 分析功能 (T292, T293)
export {
  GitAnalysis,
  type GitDiffOptions,
  type Commit,
  type DiffStats,
} from './analysis.js';

// 安全检查 (T297)
export {
  GitSafety,
  type SafetyCheckResult,
  type SensitiveFilesCheck,
} from './safety.js';

// 操作建议 (T298)
export {
  GitOperations,
  type CommitAndPushResult,
  type CommitMessageOptions,
  type ProgressCallback,
} from './operations.js';

// Ignore 规则 (T296)
export {
  GitIgnore,
  DEFAULT_IGNORE_PATTERNS,
} from './ignore.js';

// 需要先导入各个模块才能在 Git 常量中使用
import { GitUtils as _GitUtils } from './core.js';
import { GitAnalysis as _GitAnalysis } from './analysis.js';
import { GitSafety as _GitSafety } from './safety.js';
import { GitOperations as _GitOperations } from './operations.js';
import { GitIgnore as _GitIgnore } from './ignore.js';

/**
 * Git 工具集合
 * 提供所有 Git 功能的快捷访问
 */
export const Git = {
  // 核心功能
  isRepository: _GitUtils.isGitRepository,
  getStatus: _GitUtils.getGitStatus,
  getInfo: _GitUtils.getGitInfo,
  getCurrentBranch: _GitUtils.getCurrentBranch,
  getDefaultBranch: _GitUtils.getDefaultBranch,

  // 分析功能
  getDiff: _GitAnalysis.getDiff,
  getRecentCommits: _GitAnalysis.getRecentCommits,
  getDiffStats: _GitAnalysis.getDiffStats,

  // 安全检查
  checkSafety: _GitSafety.validateGitCommand,
  checkSensitiveFiles: _GitSafety.checkSensitiveFiles,
  isDangerous: _GitSafety.isDangerousCommand,

  // 操作功能
  checkPushStatus: _GitOperations.checkPushStatus,
  generateCommitMessage: _GitOperations.generateCommitMessage,
  commitAndPush: _GitOperations.commitAndPush,

  // Ignore 规则
  isIgnored: _GitIgnore.isIgnored,
  getIgnoreRules: _GitIgnore.getAllIgnoreRules,
};
