/**
 * macOS Keychain API Key 存储
 *
 * 使用 macOS 的 security 命令行工具来安全地存储和读取 API Key
 * 只在 macOS 平台上启用
 *
 * 功能:
 * - 安全存储 API Key 到 Keychain
 * - 从 Keychain 读取 API Key
 * - 删除 Keychain 中的 API Key
 * - 平台检测（仅 macOS）
 */

import { execSync } from 'child_process';
import * as os from 'os';

// ============ 常量配置 ============

// Keychain 服务名称（用于标识存储的凭证）
const SERVICE_NAME = 'com.anthropic.claude-code';
const ACCOUNT_NAME = 'api-key';

// ============ 平台检测 ============

/**
 * 检查是否在 macOS 平台
 */
export function isMacOS(): boolean {
  return os.platform() === 'darwin';
}

/**
 * 检查 Keychain 是否可用
 */
export function isKeychainAvailable(): boolean {
  if (!isMacOS()) {
    return false;
  }

  try {
    // 尝试执行 security 命令来验证可用性
    execSync('which security', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ============ Keychain 操作 ============

/**
 * 将 API Key 存储到 Keychain
 *
 * @param apiKey - 要存储的 API Key
 * @returns 是否成功存储
 */
export function saveToKeychain(apiKey: string): boolean {
  if (!isKeychainAvailable()) {
    throw new Error('Keychain is not available on this platform');
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key');
  }

  try {
    // 先尝试删除现有的条目（如果存在）
    try {
      execSync(
        `security delete-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}"`,
        { stdio: 'ignore' }
      );
    } catch {
      // 忽略删除失败（可能是因为条目不存在）
    }

    // 添加新的密码到 Keychain
    // -s: service name
    // -a: account name
    // -w: password (API key)
    // -U: update if exists
    execSync(
      `security add-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w "${apiKey}" -U`,
      { stdio: 'ignore' }
    );

    return true;
  } catch (error) {
    console.error('Failed to save API key to Keychain:', error);
    return false;
  }
}

/**
 * 从 Keychain 读取 API Key
 *
 * @returns API Key，如果不存在则返回 null
 */
export function loadFromKeychain(): string | null {
  if (!isKeychainAvailable()) {
    return null;
  }

  try {
    // 从 Keychain 读取密码
    // -s: service name
    // -a: account name
    // -w: output password only
    const output = execSync(
      `security find-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const apiKey = output.trim();

    if (!apiKey) {
      return null;
    }

    return apiKey;
  } catch (error) {
    // 如果找不到条目或发生其他错误，返回 null
    // 这是正常情况（用户可能还没有存储 API key）
    return null;
  }
}

/**
 * 从 Keychain 删除 API Key
 *
 * @returns 是否成功删除
 */
export function deleteFromKeychain(): boolean {
  if (!isKeychainAvailable()) {
    throw new Error('Keychain is not available on this platform');
  }

  try {
    execSync(
      `security delete-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}"`,
      { stdio: 'ignore' }
    );
    return true;
  } catch (error) {
    // 删除失败可能是因为条目不存在
    return false;
  }
}

/**
 * 检查 Keychain 中是否存在 API Key
 *
 * @returns 是否存在
 */
export function hasKeychainApiKey(): boolean {
  if (!isKeychainAvailable()) {
    return false;
  }

  try {
    execSync(
      `security find-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}"`,
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

// ============ 辅助函数 ============

/**
 * 安全地转移 API Key 从文件到 Keychain
 *
 * 从现有的凭证文件读取 API Key，存储到 Keychain，然后可选地删除文件中的 key
 *
 * @param apiKey - API Key
 * @returns 是否成功
 */
export function migrateToKeychain(apiKey: string): boolean {
  if (!isKeychainAvailable()) {
    return false;
  }

  try {
    return saveToKeychain(apiKey);
  } catch (error) {
    console.error('Failed to migrate API key to Keychain:', error);
    return false;
  }
}

/**
 * 获取 Keychain 状态信息
 */
export function getKeychainStatus(): {
  available: boolean;
  platform: string;
  hasApiKey: boolean;
} {
  return {
    available: isKeychainAvailable(),
    platform: os.platform(),
    hasApiKey: hasKeychainApiKey(),
  };
}

// ============ 导出所有功能 ============

export default {
  isMacOS,
  isKeychainAvailable,
  saveToKeychain,
  loadFromKeychain,
  deleteFromKeychain,
  hasKeychainApiKey,
  migrateToKeychain,
  getKeychainStatus,
};
