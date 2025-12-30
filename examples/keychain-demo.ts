#!/usr/bin/env node

/**
 * Keychain 功能演示脚本
 *
 * 演示如何使用 macOS Keychain 来存储和读取 API Key
 */

import {
  isMacOS,
  isKeychainAvailable,
  getKeychainStatus,
  saveToKeychain,
  loadFromKeychain,
  hasKeychainApiKey,
  deleteFromKeychain,
  migrateToKeychain,
} from '../src/auth/index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('macOS Keychain API Key Storage Demo');
  console.log('='.repeat(60));
  console.log();

  // 1. 检查平台
  console.log('1. Platform Detection');
  console.log('-'.repeat(60));
  console.log('Is macOS:', isMacOS());
  console.log('Keychain available:', isKeychainAvailable());
  console.log();

  // 2. 获取详细状态
  console.log('2. Keychain Status');
  console.log('-'.repeat(60));
  const status = getKeychainStatus();
  console.log('Platform:', status.platform);
  console.log('Available:', status.available);
  console.log('Has API Key:', status.hasApiKey);
  console.log();

  // 如果不在 macOS 上，退出
  if (!isKeychainAvailable()) {
    console.log('⚠️  Keychain is not available on this platform');
    console.log('This demo requires macOS');
    return;
  }

  // 3. 测试保存和读取
  console.log('3. Save and Load Test');
  console.log('-'.repeat(60));

  const testApiKey = 'sk-ant-api03-test-key-' + Date.now();
  console.log('Test API Key:', testApiKey.substring(0, 30) + '...');
  console.log();

  // 保存到 Keychain
  console.log('Saving to Keychain...');
  const saved = saveToKeychain(testApiKey);
  if (saved) {
    console.log('✅ Saved successfully');
  } else {
    console.log('❌ Failed to save');
    return;
  }
  console.log();

  // 检查是否存在
  console.log('Checking if API Key exists...');
  const exists = hasKeychainApiKey();
  console.log('Exists:', exists);
  console.log();

  // 从 Keychain 读取
  console.log('Loading from Keychain...');
  const loadedKey = loadFromKeychain();
  if (loadedKey) {
    console.log('✅ Loaded successfully');
    console.log('Loaded Key:', loadedKey.substring(0, 30) + '...');
    console.log('Keys match:', loadedKey === testApiKey);
  } else {
    console.log('❌ Failed to load');
  }
  console.log();

  // 4. 测试删除
  console.log('4. Delete Test');
  console.log('-'.repeat(60));
  console.log('Deleting from Keychain...');
  const deleted = deleteFromKeychain();
  if (deleted) {
    console.log('✅ Deleted successfully');
  } else {
    console.log('❌ Failed to delete');
  }
  console.log();

  // 验证删除
  console.log('Verifying deletion...');
  const stillExists = hasKeychainApiKey();
  console.log('Still exists:', stillExists);
  if (!stillExists) {
    console.log('✅ Deletion verified');
  }
  console.log();

  // 5. 测试迁移功能
  console.log('5. Migration Test');
  console.log('-'.repeat(60));
  const migrationKey = 'sk-ant-api03-migration-test-' + Date.now();
  console.log('Migrating API Key to Keychain...');
  console.log('Key:', migrationKey.substring(0, 30) + '...');
  const migrated = migrateToKeychain(migrationKey);
  if (migrated) {
    console.log('✅ Migration successful');

    // 验证迁移
    const migratedKey = loadFromKeychain();
    if (migratedKey === migrationKey) {
      console.log('✅ Migration verified');
    }
  } else {
    console.log('❌ Migration failed');
  }
  console.log();

  // 清理
  console.log('Cleaning up...');
  deleteFromKeychain();
  console.log('✅ Cleanup complete');
  console.log();

  console.log('='.repeat(60));
  console.log('Demo Complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('Next Steps:');
  console.log('1. Use setApiKey(key, true, true) to save your real API Key');
  console.log('2. Use initAuth() to load it automatically');
  console.log('3. Check docs/keychain.md for more information');
}

// 运行演示
main().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
