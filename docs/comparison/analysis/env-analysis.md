# 环境变量模块分析报告

## 官方源码分析

### 1. 环境变量验证器系统

官方 Claude Code 实现了一个环境变量验证器系统，用于验证和规范化特定环境变量的值。

#### 1.1 验证器数据结构

```typescript
interface EnvVarValidator {
  name: string;           // 环境变量名称
  default: number;        // 默认值
  validate: (value: string | undefined) => ValidationResult;
}

interface ValidationResult {
  effective: number;      // 实际生效的值
  status: 'valid' | 'invalid' | 'capped';  // 验证状态
  message?: string;       // 错误或警告信息
}
```

#### 1.2 内置验证器

官方源码定义了两个内置验证器：

**1. BASH_MAX_OUTPUT_LENGTH 验证器**
- 环境变量: `BASH_MAX_OUTPUT_LENGTH`
- 默认值: 30000
- 验证规则:
  - 未设置: 使用默认值 30000
  - 非数字或 ≤ 0: 使用默认值 30000，状态 'invalid'
  - 超过 150000: 限制为 150000，状态 'capped'
  - 其他: 使用原值，状态 'valid'

**2. CLAUDE_CODE_MAX_OUTPUT_TOKENS 验证器**
- 环境变量: `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
- 默认值: 32000
- 验证规则:
  - 未设置: 使用默认值 32000
  - 非数字或 ≤ 0: 使用默认值 32000，状态 'invalid'
  - 超过 64000: 限制为 64000，状态 'capped'
  - 其他: 使用原值，状态 'valid'

#### 1.3 验证器存储和访问

```javascript
// 官方源码（反编译后）
var PhA = {
  name: "BASH_MAX_OUTPUT_LENGTH",
  default: 30000,
  validate: (A) => {
    if (!A) return { effective: 30000, status: "valid" };
    let G = parseInt(A, 10);
    if (isNaN(G) || G <= 0)
      return { effective: 30000, status: "invalid",
               message: `Invalid value "${A}" (using default: 30000)` };
    if (G > 150000)
      return { effective: 150000, status: "capped",
               message: `Capped from ${G} to 150000` };
    return { effective: G, status: "valid" };
  }
};

var ShA = {
  name: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
  default: 32000,
  validate: (A) => {
    if (!A) return { effective: 32000, status: "valid" };
    let G = parseInt(A, 10);
    if (isNaN(G) || G <= 0)
      return { effective: 32000, status: "invalid",
               message: `Invalid value "${A}" (using default: 32000)` };
    if (G > 64000)
      return { effective: 64000, status: "capped",
               message: `Capped from ${G} to 64000` };
    return { effective: G, status: "valid" };
  }
};

// 存储在全局会话对象中
r0 = {
  // ... 其他字段
  envVarValidators: [PhA, ShA],
  // ...
};

// 访问函数
function iT0() {
  return r0.envVarValidators;
}
```

### 2. 敏感变量处理

#### 2.1 敏感变量识别规则

官方源码在导出配置时会对敏感信息进行掩码处理，识别规则如下：

```javascript
// 在 MCP 服务器配置的 env 字段中
if (server.env) {
  const maskedEnv = {};
  for (const [key, value] of Object.entries(server.env)) {
    if (key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password')) {
      maskedEnv[key] = this.maskSecret(value);
    } else {
      maskedEnv[key] = value;
    }
  }
  config.mcpServers[name] = { ...server, env: maskedEnv };
}
```

**敏感关键词列表:**
- `key` (如 API_KEY, OPENAI_KEY)
- `token` (如 ACCESS_TOKEN, AUTH_TOKEN)
- `secret` (如 CLIENT_SECRET, SECRET_KEY)
- `password` (如 DB_PASSWORD, USER_PASSWORD)

#### 2.2 掩码算法

```javascript
function maskSecret(value: string): string {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '***' + value.slice(-4);
}
```

**掩码规则:**
- ≤ 8 个字符: 完全掩码为 `***`
- \> 8 个字符: 保留前 4 位和后 4 位，中间用 `***` 替换

**示例:**
- `sk-ant-api03-xxx` → `sk-a***-xxx`
- `short` → `***`
- `my-secret-token-12345678` → `my-s***5678`

### 3. 环境变量读取优先级

官方源码的环境变量读取优先级如下（从高到低）：

1. **命令行环境变量** (`-e KEY=VALUE`)
2. **系统环境变量** (`process.env`)
3. **配置文件** (按优先级):
   - Flag Settings (命令行指定配置文件)
   - Environment Settings (环境变量)
   - Local Settings (`./.claude/local.json`)
   - Project Settings (`./.claude/settings.json`)
   - User Settings (`~/.claude/settings.json`)
   - Policy Settings (`~/.claude/policy.json`)
   - Default (代码默认值)

#### 3.1 环境变量解析函数

```javascript
// 布尔值解析
function F0(A) {
  if (!A) return false;
  if (typeof A === "boolean") return A;
  let Q = A.toLowerCase().trim();
  return ["1", "true", "yes", "on"].includes(Q);
}

// 布尔值反向解析 (检查是否为 false)
function AI(A) {
  if (A === void 0) return false;
  if (typeof A === "boolean") return !A;
  if (!A) return false;
  let Q = A.toLowerCase().trim();
  return ["0", "false", "no", "off"].includes(Q);
}

// 环境变量格式化 (用于 -e 参数)
function h_0(A) {
  let Q = {};
  if (A)
    for (let B of A) {
      let [G, ...Z] = B.split("=");
      if (!G || Z.length === 0)
        throw Error(`Invalid environment variable format: ${B}, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`);
      Q[G] = Z.join("=");
    }
  return Q;
}
```

### 4. 特殊环境变量

官方源码还处理了一些特殊的环境变量：

#### 4.1 配置目录
```javascript
function vQ() {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
}
```

#### 4.2 AWS 区域
```javascript
function bt() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}
```

#### 4.3 Vertex AI 区域
```javascript
function Jj() {
  return process.env.CLOUD_ML_REGION || "us-east5";
}

// 模型特定区域配置
function ofA(modelName) {
  if (modelName?.startsWith("claude-haiku-4-5"))
    return process.env.VERTEX_REGION_CLAUDE_HAIKU_4_5 || Jj();
  if (modelName?.startsWith("claude-3-5-haiku"))
    return process.env.VERTEX_REGION_CLAUDE_3_5_HAIKU || Jj();
  // ... 其他模型
  return Jj();
}
```

#### 4.4 调试相关
```javascript
// 调试模式
process.env.DEBUG || process.env.DEBUG_SDK

// 调试日志目录
process.env.CLAUDE_CODE_DEBUG_LOGS_DIR

// 遥测配置
process.env.CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS
process.env.CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS

// OpenTelemetry
process.env.OTEL_EXPORTER_OTLP_HEADERS
```

## 本项目差距分析

### 已实现

1. **基本环境变量读取** (`src/config/index.ts`)
   - ✅ `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY`
   - ✅ `CLAUDE_CODE_OAUTH_TOKEN`
   - ✅ `CLAUDE_CODE_USE_BEDROCK`
   - ✅ `CLAUDE_CODE_USE_VERTEX`
   - ✅ `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
   - ✅ `CLAUDE_CODE_MAX_RETRIES`
   - ✅ `CLAUDE_CODE_DEBUG_LOGS_DIR`
   - ✅ `CLAUDE_CODE_ENABLE_TELEMETRY`
   - ✅ `HTTP_PROXY` / `HTTPS_PROXY`

2. **环境变量解析函数**
   - ✅ `parseEnvBoolean()` - 布尔值解析
   - ✅ `parseEnvNumber()` - 数字解析
   - ✅ `getEnvConfig()` - 环境变量配置提取

3. **敏感信息掩码** (`src/config/index.ts:597-636`)
   - ✅ `maskSecret()` - 掩码函数
   - ✅ 配置导出时的敏感字段处理
   - ✅ MCP 服务器 headers 掩码
   - ✅ MCP 服务器 env 掩码 (基于关键词)

### 缺失

1. **环境变量验证器系统** ❌
   - 缺少 `EnvVarValidator` 接口定义
   - 缺少 `ValidationResult` 类型
   - 缺少内置验证器 (`BASH_MAX_OUTPUT_LENGTH`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`)
   - 缺少验证器注册和执行机制

2. **环境变量验证功能** ❌
   - 缺少数值范围验证
   - 缺少自动限制超范围值 (capping)
   - 缺少验证失败时的警告信息

3. **完整的敏感变量标记** ⚠️ (部分实现)
   - 已有基于关键词的识别 (`key`, `token`, `secret`, `password`)
   - 但未暴露通用的 `isSensitive()` 函数
   - 未提供敏感变量列表管理

4. **命令行环境变量注入** ❌
   - 缺少 `-e KEY=VALUE` 格式的环境变量注入
   - 缺少对应的解析函数

5. **Vertex AI 区域配置** ❌
   - 缺少模型特定的区域环境变量支持
   - 缺少 `VERTEX_REGION_CLAUDE_*` 变量处理

## 具体实现建议

### T-015: 变量验证和敏感标记

#### 1. 创建环境变量验证器模块

**文件:** `src/config/env-validator.ts`

```typescript
/**
 * 环境变量验证器
 *
 * 提供环境变量值的验证、规范化和限制功能
 */

export type ValidationStatus = 'valid' | 'invalid' | 'capped';

export interface ValidationResult<T = any> {
  /** 实际生效的值 */
  effective: T;
  /** 验证状态 */
  status: ValidationStatus;
  /** 错误或警告信息 */
  message?: string;
}

export interface EnvVarValidator<T = any> {
  /** 环境变量名称 */
  name: string;
  /** 默认值 */
  default: T;
  /** 验证函数 */
  validate: (value: string | undefined) => ValidationResult<T>;
  /** 变量描述（可选） */
  description?: string;
  /** 是否为敏感变量 */
  sensitive?: boolean;
}

// ============ 内置验证器 ============

/**
 * BASH 输出长度限制验证器
 */
export const BASH_MAX_OUTPUT_LENGTH: EnvVarValidator<number> = {
  name: 'BASH_MAX_OUTPUT_LENGTH',
  default: 30000,
  description: 'Maximum output length for bash commands',
  validate: (value) => {
    if (!value) {
      return { effective: 30000, status: 'valid' };
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed) || parsed <= 0) {
      return {
        effective: 30000,
        status: 'invalid',
        message: `Invalid value "${value}" (using default: 30000)`,
      };
    }

    if (parsed > 150000) {
      return {
        effective: 150000,
        status: 'capped',
        message: `Capped from ${parsed} to 150000`,
      };
    }

    return { effective: parsed, status: 'valid' };
  },
};

/**
 * Claude 最大输出 token 数验证器
 */
export const CLAUDE_CODE_MAX_OUTPUT_TOKENS: EnvVarValidator<number> = {
  name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  default: 32000,
  description: 'Maximum output tokens for Claude API',
  validate: (value) => {
    if (!value) {
      return { effective: 32000, status: 'valid' };
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed) || parsed <= 0) {
      return {
        effective: 32000,
        status: 'invalid',
        message: `Invalid value "${value}" (using default: 32000)`,
      };
    }

    if (parsed > 64000) {
      return {
        effective: 64000,
        status: 'capped',
        message: `Capped from ${parsed} to 64000`,
      };
    }

    return { effective: parsed, status: 'valid' };
  },
};

// ============ 验证器注册表 ============

class EnvValidatorRegistry {
  private validators: Map<string, EnvVarValidator> = new Map();

  /**
   * 注册验证器
   */
  register(validator: EnvVarValidator): void {
    this.validators.set(validator.name, validator);
  }

  /**
   * 批量注册验证器
   */
  registerAll(validators: EnvVarValidator[]): void {
    for (const validator of validators) {
      this.register(validator);
    }
  }

  /**
   * 获取验证器
   */
  get(name: string): EnvVarValidator | undefined {
    return this.validators.get(name);
  }

  /**
   * 验证环境变量
   */
  validate(name: string, value: string | undefined): ValidationResult | null {
    const validator = this.validators.get(name);
    if (!validator) {
      return null;
    }
    return validator.validate(value);
  }

  /**
   * 获取环境变量的有效值
   */
  getEffectiveValue<T = any>(name: string): T | undefined {
    const validator = this.validators.get(name);
    if (!validator) {
      return undefined;
    }

    const envValue = process.env[name];
    const result = validator.validate(envValue);
    return result.effective as T;
  }

  /**
   * 验证所有已注册的环境变量
   */
  validateAll(): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const [name, validator] of this.validators) {
      const envValue = process.env[name];
      const result = validator.validate(envValue);
      results.set(name, result);

      // 输出警告信息
      if (result.status === 'invalid' || result.status === 'capped') {
        console.warn(`[ENV] ${name}: ${result.message}`);
      }
    }

    return results;
  }

  /**
   * 获取所有验证器
   */
  getAll(): EnvVarValidator[] {
    return Array.from(this.validators.values());
  }
}

// ============ 全局注册表 ============

export const envValidatorRegistry = new EnvValidatorRegistry();

// 注册内置验证器
envValidatorRegistry.registerAll([
  BASH_MAX_OUTPUT_LENGTH,
  CLAUDE_CODE_MAX_OUTPUT_TOKENS,
]);

// ============ 辅助函数 ============

/**
 * 验证单个环境变量
 */
export function validateEnvVar(
  name: string,
  value: string | undefined
): ValidationResult | null {
  return envValidatorRegistry.validate(name, value);
}

/**
 * 获取验证后的环境变量值
 */
export function getValidatedEnvValue<T = any>(name: string): T | undefined {
  return envValidatorRegistry.getEffectiveValue<T>(name);
}

/**
 * 验证所有环境变量并返回结果
 */
export function validateAllEnvVars(): Map<string, ValidationResult> {
  return envValidatorRegistry.validateAll();
}
```

#### 2. 增强敏感变量标记功能

**文件:** `src/config/sensitive.ts`

```typescript
/**
 * 敏感变量标记和处理
 */

/** 敏感关键词列表 */
const SENSITIVE_KEYWORDS = [
  'key',
  'token',
  'secret',
  'password',
  'auth',
  'credential',
  'passphrase',
  'private',
  'apikey',
  'api_key',
];

/**
 * 检查变量名是否为敏感变量
 */
export function isSensitiveVar(name: string): boolean {
  const lowerName = name.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * 掩码敏感信息
 *
 * @param value - 要掩码的值
 * @returns 掩码后的值
 *
 * @example
 * maskSensitive('sk-ant-api03-xxx') // => 'sk-a***-xxx'
 * maskSensitive('short') // => '***'
 */
export function maskSensitive(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return value.slice(0, 4) + '***' + value.slice(-4);
}

/**
 * 掩码对象中的敏感字段
 */
export function maskSensitiveFields(obj: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && isSensitiveVar(key)) {
      masked[key] = maskSensitive(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveFields(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 获取所有敏感环境变量
 */
export function getSensitiveEnvVars(): Record<string, string> {
  const sensitive: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (isSensitiveVar(key) && typeof value === 'string') {
      sensitive[key] = value;
    }
  }

  return sensitive;
}

/**
 * 获取掩码后的敏感环境变量
 */
export function getMaskedSensitiveEnvVars(): Record<string, string> {
  const sensitive: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (isSensitiveVar(key) && typeof value === 'string') {
      sensitive[key] = maskSensitive(value);
    }
  }

  return sensitive;
}
```

#### 3. 集成到配置管理器

**文件:** `src/config/index.ts` (修改)

```typescript
import {
  envValidatorRegistry,
  validateAllEnvVars,
  getValidatedEnvValue,
  type ValidationResult
} from './env-validator.js';
import {
  isSensitiveVar,
  maskSensitive,
  maskSensitiveFields
} from './sensitive.js';

export class ConfigManager {
  // ... 现有代码 ...

  constructor(options?: { flagSettingsPath?: string }) {
    // ... 现有代码 ...

    // 验证环境变量
    this.validateEnvironmentVariables();

    // ... 现有代码 ...
  }

  /**
   * 验证所有环境变量
   */
  private validateEnvironmentVariables(): void {
    const results = validateAllEnvVars();

    // 记录验证结果
    for (const [name, result] of results) {
      if (result.status === 'invalid') {
        console.warn(`[Config] Invalid environment variable ${name}: ${result.message}`);
      } else if (result.status === 'capped') {
        console.warn(`[Config] Environment variable ${name} capped: ${result.message}`);
      }
    }
  }

  /**
   * 获取验证后的环境变量值
   */
  getValidatedEnv<T = any>(name: string): T | undefined {
    return getValidatedEnvValue<T>(name);
  }

  /**
   * 导出配置（增强版，使用通用敏感字段标记）
   */
  export(maskSecrets = true): string {
    const config = { ...this.mergedConfig };

    if (maskSecrets) {
      // 使用通用的敏感字段掩码函数
      const masked = maskSensitiveFields(config);
      return JSON.stringify(masked, null, 2);
    }

    return JSON.stringify(config, null, 2);
  }

  // 保留原有的 maskSecret 方法以保持兼容性
  private maskSecret(value: string): string {
    return maskSensitive(value);
  }

  // ... 其他现有方法 ...
}

// 重新导出敏感变量工具
export {
  isSensitiveVar,
  maskSensitive,
  maskSensitiveFields,
  getSensitiveEnvVars,
  getMaskedSensitiveEnvVars
} from './sensitive.js';

// 重新导出验证器工具
export {
  envValidatorRegistry,
  validateEnvVar,
  getValidatedEnvValue,
  validateAllEnvVars,
  type EnvVarValidator,
  type ValidationResult,
  type ValidationStatus
} from './env-validator.js';
```

#### 4. 在工具中使用验证值

**示例: Bash 工具** (`src/tools/bash.ts`)

```typescript
import { getValidatedEnvValue } from '../config/index.js';

export class BashTool extends BaseTool {
  // ...

  async execute(input: BashInput): Promise<ToolResult> {
    // 使用验证后的环境变量值
    const maxOutputLength = getValidatedEnvValue<number>('BASH_MAX_OUTPUT_LENGTH') || 30000;

    // ... 执行命令 ...

    if (output.length > maxOutputLength) {
      output = output.slice(0, maxOutputLength) + '\n... (output truncated)';
    }

    // ...
  }
}
```

## 参考行号

### 官方源码关键位置 (cli.js)

**环境变量验证器定义:**
- PhA (BASH_MAX_OUTPUT_LENGTH): ~行号位置（反编译代码，行号不固定）
- ShA (CLAUDE_CODE_MAX_OUTPUT_TOKENS): ~行号位置

**敏感变量识别:**
- 敏感关键词检查: 在配置导出函数中 (`export()` 方法)
- 掩码实现: `maskSecret()` 函数

**环境变量解析:**
- 布尔值解析: `F0()` 函数
- 布尔值反向解析: `AI()` 函数
- 命令行环境变量解析: `h_0()` 函数

**特殊环境变量:**
- 配置目录: `vQ()` 函数
- AWS 区域: `bt()` 函数
- Vertex AI 区域: `Jj()` 和 `ofA()` 函数

### 本项目对应文件

**配置管理:**
- `/home/user/claude-code-open/src/config/index.ts`
  - 行 183-195: 环境变量解析函数
  - 行 197-234: 环境变量配置读取
  - 行 597-636: 敏感信息掩码

**建议新增文件:**
- `/home/user/claude-code-open/src/config/env-validator.ts` - 环境变量验证器
- `/home/user/claude-code-open/src/config/sensitive.ts` - 敏感变量标记

## 总结

官方 Claude Code 的环境变量处理系统具有以下特点:

1. **验证器模式**: 使用验证器对象封装验证逻辑，支持自定义验证规则
2. **自动限制**: 超范围值自动限制到最大允许值 (capping)
3. **友好提示**: 验证失败时提供清晰的错误信息
4. **敏感标记**: 基于关键词自动识别敏感变量
5. **安全导出**: 导出配置时自动掩码敏感信息

本项目建议:
- 实现完整的验证器系统以确保环境变量值的有效性
- 增强敏感变量标记功能，提供通用的识别和掩码工具
- 在配置管理器初始化时自动验证所有环境变量
- 在工具中使用验证后的环境变量值，避免无效配置导致的错误
