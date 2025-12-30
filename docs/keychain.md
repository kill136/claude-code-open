# macOS Keychain API Key 存储

本项目支持在 macOS 上使用系统 Keychain 来安全地存储 Anthropic API Key，而不是将其保存在纯文本文件中。

## 功能特性

- ✅ 使用 macOS 系统 Keychain 安全存储 API Key
- ✅ 自动平台检测（仅在 macOS 上启用）
- ✅ 优先级：Keychain > 配置文件 > 环境变量
- ✅ 与现有认证系统无缝集成
- ✅ 支持从文件迁移到 Keychain

## 使用方法

### 1. 保存 API Key 到 Keychain

```typescript
import { setApiKey } from './auth/index.js';

// 保存到 Keychain（macOS）或文件（其他平台）
setApiKey('sk-ant-api03-...', true, true);
```

### 2. 从 Keychain 读取 API Key

认证系统会自动按以下优先级查找 API Key：

1. 环境变量 (`ANTHROPIC_API_KEY` 或 `CLAUDE_API_KEY`)
2. OAuth token（如果已登录）
3. 官方 Claude Code 的 config.json (`primaryApiKey`)
4. **macOS Keychain**（如果可用）
5. 凭证文件 (`~/.claude/credentials.json`)

```typescript
import { initAuth, getApiKey } from './auth/index.js';

// 初始化认证（会自动尝试从 Keychain 读取）
const auth = initAuth();

// 获取 API Key
const apiKey = getApiKey();
if (apiKey) {
  console.log('API Key loaded successfully');
}
```

### 3. 检查 Keychain 是否可用

```typescript
import { isKeychainAvailable, getKeychainStatus } from './auth/index.js';

// 简单检查
if (isKeychainAvailable()) {
  console.log('Keychain is available');
}

// 获取详细状态
const status = getKeychainStatus();
console.log('Platform:', status.platform);
console.log('Keychain available:', status.available);
console.log('Has API Key:', status.hasApiKey);
```

### 4. 从文件迁移到 Keychain

```typescript
import { migrateToKeychain, loadFromKeychain } from './auth/index.js';

// 如果你之前在文件中存储了 API Key，可以迁移到 Keychain
const apiKey = 'sk-ant-api03-...';
const success = migrateToKeychain(apiKey);

if (success) {
  console.log('API Key migrated to Keychain');
  // 可以选择删除文件中的 API Key
}
```

### 5. 删除 Keychain 中的 API Key

```typescript
import { deleteFromKeychain } from './auth/index.js';

// 从 Keychain 中删除 API Key
const deleted = deleteFromKeychain();
if (deleted) {
  console.log('API Key removed from Keychain');
}
```

## CLI 使用

### 保存 API Key 到 Keychain

```bash
# 通过 CLI 设置 API Key（会自动使用 Keychain）
claude setup-token
# 输入你的 API Key
# ✅ API Key saved to macOS Keychain
```

### 检查 Keychain 状态

```bash
# 查看认证状态（会显示是否使用 Keychain）
claude auth status
# [Auth] Using API Key from macOS Keychain
```

### 从 Keychain 删除 API Key

```bash
# 登出（会提供选项删除 Keychain 中的凭证）
claude logout
```

## 技术实现

### 使用的命令

本实现使用 macOS 的 `security` 命令行工具：

```bash
# 保存密码
security add-generic-password \
  -s "com.anthropic.claude-code" \
  -a "api-key" \
  -w "sk-ant-api03-..." \
  -U

# 读取密码
security find-generic-password \
  -s "com.anthropic.claude-code" \
  -a "api-key" \
  -w

# 删除密码
security delete-generic-password \
  -s "com.anthropic.claude-code" \
  -a "api-key"
```

### Keychain 项目标识

- **服务名称**: `com.anthropic.claude-code`
- **账户名称**: `api-key`
- **存储位置**: 用户的登录 Keychain（默认）

## 安全性

### 优势

1. **系统级加密**: API Key 使用 macOS 系统的加密存储，比纯文本文件更安全
2. **权限控制**: 只有当前用户可以访问
3. **审计**: 系统会记录 Keychain 访问
4. **集成**: 与 macOS 的安全架构集成

### 注意事项

1. **平台限制**: 仅在 macOS 上可用
2. **备份**: Keychain 数据会包含在 Time Machine 备份中（加密）
3. **迁移**: 迁移到新 Mac 时需要重新设置 API Key
4. **权限**: 首次访问时可能需要输入系统密码

## 故障排除

### Keychain 不可用

```typescript
import { isKeychainAvailable } from './auth/index.js';

if (!isKeychainAvailable()) {
  console.log('Keychain not available');
  // 原因可能是：
  // 1. 不是 macOS 系统
  // 2. security 命令不可用
  // 会自动回退到文件存储
}
```

### 保存失败

如果保存到 Keychain 失败，系统会自动回退到文件存储：

```
[Auth] Failed to save to Keychain, falling back to file storage
```

### 访问被拒绝

如果系统提示需要授权：

1. 点击"允许"或"始终允许"
2. 输入 macOS 用户密码
3. 选择"始终允许"可以避免每次都输入密码

## API 参考

### Keychain 模块

```typescript
// 从 src/auth/keychain.ts 导出的函数

// 平台检测
isMacOS(): boolean
isKeychainAvailable(): boolean

// 基本操作
saveToKeychain(apiKey: string): boolean
loadFromKeychain(): string | null
deleteFromKeychain(): boolean
hasKeychainApiKey(): boolean

// 辅助功能
migrateToKeychain(apiKey: string): boolean
getKeychainStatus(): {
  available: boolean;
  platform: string;
  hasApiKey: boolean;
}
```

### 集成到认证系统

```typescript
// 从 src/auth/index.ts 导出的函数

// 设置 API Key（支持 Keychain）
setApiKey(apiKey: string, persist?: boolean, useKeychain?: boolean): void

// 初始化认证（自动从 Keychain 读取）
initAuth(): AuthConfig | null

// Keychain 函数（重新导出）
isKeychainAvailable(): boolean
saveToKeychain(apiKey: string): boolean
loadFromKeychain(): string | null
// ... 其他函数
```

## 与官方 Claude Code 的兼容性

本实现与官方 Claude Code v2.0.76 的 Keychain 集成保持一致：

- ✅ 使用相同的服务名称 (`com.anthropic.claude-code`)
- ✅ 相同的优先级策略
- ✅ 相同的回退机制
- ✅ 无缝迁移支持

## 示例代码

### 完整的认证流程

```typescript
import {
  initAuth,
  getApiKey,
  setApiKey,
  isKeychainAvailable,
  getKeychainStatus,
} from './auth/index.js';

// 检查 Keychain 状态
const keychainStatus = getKeychainStatus();
console.log('Keychain Status:', keychainStatus);

// 初始化认证
let auth = initAuth();

if (!auth) {
  // 没有找到认证，设置新的 API Key
  const newApiKey = 'sk-ant-api03-...';

  // 保存到 Keychain（如果可用）
  setApiKey(newApiKey, true, true);

  // 重新初始化
  auth = initAuth();
}

// 使用 API Key
const apiKey = getApiKey();
if (apiKey) {
  console.log('Ready to use Claude API');
  // 使用 apiKey 调用 Anthropic API
}
```

### 迁移现有设置

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { migrateToKeychain, deleteFromKeychain } from './auth/index.js';

// 从旧的凭证文件读取
const credFile = path.join(process.env.HOME!, '.claude', 'credentials.json');
if (fs.existsSync(credFile)) {
  const creds = JSON.parse(fs.readFileSync(credFile, 'utf-8'));

  if (creds.apiKey) {
    // 迁移到 Keychain
    const success = migrateToKeychain(creds.apiKey);

    if (success) {
      console.log('✅ Migrated to Keychain');

      // 可选：删除文件中的 API Key
      delete creds.apiKey;
      fs.writeFileSync(credFile, JSON.stringify(creds, null, 2));
      console.log('✅ Removed API Key from file');
    }
  }
}
```

## 最佳实践

1. **首选 Keychain**: 在 macOS 上始终使用 Keychain 存储 API Key
2. **环境变量用于 CI/CD**: 在持续集成环境中使用环境变量
3. **定期轮换**: 定期更新 API Key 以提高安全性
4. **最小权限**: 只在需要时授予 Keychain 访问权限
5. **备份恢复计划**: 记录 API Key 获取方式，以便迁移时重新设置

## 未来改进

- [ ] 支持 Windows Credential Manager
- [ ] 支持 Linux Secret Service API (libsecret)
- [ ] 支持多个 API Key 存储
- [ ] 支持 API Key 过期提醒
- [ ] 集成到 GUI 配置工具
