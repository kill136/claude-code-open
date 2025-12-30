# USE_BUILTIN_RIPGREP 环境变量实现说明

## 概述

实现了官方 Claude Code 的 `USE_BUILTIN_RIPGREP` 环境变量功能，允许用户控制使用系统或内置 ripgrep。

## 功能说明

### 环境变量行为

- **`USE_BUILTIN_RIPGREP=1/true/yes/on`**
  - 优先使用系统 ripgrep（从 PATH 中查找）
  - 如果系统版本不可用，自动回退到内置版本

- **未设置或其他值**
  - 优先使用内置（vendored）ripgrep
  - 如果内置版本不可用，自动回退到系统版本

### 自动回退机制

无论哪种模式，如果首选版本不可用，系统会自动切换到备选版本，确保功能可用性。

## 实现细节

### 代码位置

**文件：** `/home/user/claude-code-open/src/search/ripgrep.ts`

### 核心函数

#### `shouldUseSystemRipgrep()`
```typescript
function shouldUseSystemRipgrep(): boolean {
  const env = process.env.USE_BUILTIN_RIPGREP;
  if (!env) return false;

  // 检查是否为真值（'1', 'true', 'yes', 'on'）
  const truthyValues = ['1', 'true', 'yes', 'on'];
  return truthyValues.includes(env.toLowerCase());
}
```

#### `getRgPath()` - 更新版本
```typescript
export function getRgPath(): string | null {
  // 如果设置了 USE_BUILTIN_RIPGREP 环境变量，优先使用系统版本
  if (shouldUseSystemRipgrep()) {
    const system = getSystemRgPath();
    if (system) return system;

    // 如果系统版本不可用，回退到 vendored 版本
    return getVendoredRgPath();
  }

  // 默认优先使用 vendored 版本
  const vendored = getVendoredRgPath();
  if (vendored) return vendored;

  // 回退到系统版本
  return getSystemRgPath();
}
```

### ES Module 兼容性修复

添加了对 ES module 的支持，修复 `__dirname` 未定义问题：

```typescript
import { fileURLToPath } from 'url';

// ES module 兼容性：获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

## 使用示例

### 使用系统 ripgrep

```bash
# Linux/macOS
export USE_BUILTIN_RIPGREP=1
node dist/cli.js

# Windows (PowerShell)
$env:USE_BUILTIN_RIPGREP = "1"
node dist/cli.js

# Windows (CMD)
set USE_BUILTIN_RIPGREP=1
node dist/cli.js
```

### 使用内置 ripgrep（默认）

```bash
# 不设置环境变量即可
node dist/cli.js

# 或者显式设置为其他值
export USE_BUILTIN_RIPGREP=0
node dist/cli.js
```

## 测试结果

所有测试用例通过：

```
[测试 1] 不设置 USE_BUILTIN_RIPGREP
  预期: 应优先使用 vendored 版本（如果存在）
  结果: ✓ 正确（回退到系统版本，因为无 vendored）

[测试 2] USE_BUILTIN_RIPGREP=true
  预期: 应优先使用系统版本
  结果: ✓ 正确

[测试 3] USE_BUILTIN_RIPGREP=1
  预期: 应优先使用系统版本
  结果: ✓ 正确

[测试 4] USE_BUILTIN_RIPGREP=false
  预期: 应优先使用 vendored 版本
  结果: ✓ 正确

[测试 5] USE_BUILTIN_RIPGREP=0
  预期: 应优先使用 vendored 版本
  结果: ✓ 正确
```

## 官方参考

基于官方 Claude Code 实现（`node_modules/@anthropic-ai/claude-code/cli.js`）：

```javascript
if(AI(process.env.USE_BUILTIN_RIPGREP)){
  let{cmd:G}=Vp0.findActualExecutable("rg",[]);
  if(G!=="rg")return{mode:"system",command:"rg",args:[]}
}
if(DG())return{mode:"builtin",command:process.execPath,args:["--ripgrep"]};
```

## 相关文件

- **实现：** `/home/user/claude-code-open/src/search/ripgrep.ts`
- **文档：** `/home/user/claude-code-open/CLAUDE.md` (环境变量部分)
- **Commit：** `1436227` - feat: 添加 USE_BUILTIN_RIPGREP 环境变量控制

## 注意事项

1. **真值判断**：只有 `1`, `true`, `yes`, `on`（大小写不敏感）被视为真值
2. **回退机制**：确保在任何情况下都能找到可用的 ripgrep
3. **ES Module**：使用 `import.meta.url` 确保与 ES module 兼容
4. **平台兼容**：支持 Windows、Linux、macOS 所有平台

## 后续工作

- [ ] 考虑添加日志输出，显示选择了哪个版本的 ripgrep
- [ ] 考虑添加版本检查，确保 ripgrep 版本满足最低要求
- [ ] 考虑添加性能监控，对比系统和内置版本的性能差异
