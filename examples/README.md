# Examples

本目录包含 Claude Code 的示例和演示脚本。

## Keychain 演示

`keychain-demo.ts` - 演示如何使用 macOS Keychain 来安全地存储和读取 API Key。

### 运行演示

```bash
# 编译项目
npm run build

# 运行 Keychain 演示（仅 macOS）
npx tsx examples/keychain-demo.ts
```

### 预期输出

```
============================================================
macOS Keychain API Key Storage Demo
============================================================

1. Platform Detection
------------------------------------------------------------
Is macOS: true
Keychain available: true

2. Keychain Status
------------------------------------------------------------
Platform: darwin
Available: true
Has API Key: false

3. Save and Load Test
------------------------------------------------------------
Test API Key: sk-ant-api03-test-key-17...
Saving to Keychain...
✅ Saved successfully

Checking if API Key exists...
Exists: true

Loading from Keychain...
✅ Loaded successfully
Loaded Key: sk-ant-api03-test-key-17...
Keys match: true

4. Delete Test
------------------------------------------------------------
Deleting from Keychain...
✅ Deleted successfully

Verifying deletion...
Still exists: false
✅ Deletion verified

5. Migration Test
------------------------------------------------------------
Migrating API Key to Keychain...
Key: sk-ant-api03-migration-test-...
✅ Migration successful
✅ Migration verified

Cleaning up...
✅ Cleanup complete

============================================================
Demo Complete!
============================================================

Next Steps:
1. Use setApiKey(key, true, true) to save your real API Key
2. Use initAuth() to load it automatically
3. Check docs/keychain.md for more information
```

### 注意事项

1. **仅 macOS**: Keychain 功能只在 macOS 上可用
2. **权限**: 首次运行时可能需要授予 Keychain 访问权限
3. **安全**: 演示使用测试密钥，不会影响你的实际 API Key

## 更多信息

- [Keychain 完整文档](../docs/keychain.md)
- [认证系统文档](../docs/auth.md)
- [配置管理文档](../docs/config.md)
