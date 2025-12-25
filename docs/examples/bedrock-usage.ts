/**
 * AWS Bedrock 使用示例
 * 展示如何使用增强的 Bedrock 客户端功能
 */

import {
  detectProvider,
  createClient,
  validateProviderConfig,
  parseBedrockModelArn,
  getBedrockModelId,
  getBedrockRegions,
  formatBedrockConfig,
  handleBedrockError,
  createBedrockModelArn,
  type ProviderConfig,
} from '../src/providers/index.js';

// ==================== 示例 1: 自动检测配置 ====================
console.log('=== 示例 1: 自动检测配置 ===\n');

const config = detectProvider();
console.log('检测到的配置:', config);

// ==================== 示例 2: 验证配置 ====================
console.log('\n=== 示例 2: 验证配置 ===\n');

const validation = validateProviderConfig(config);
if (validation.valid) {
  console.log('✅ 配置有效');
} else {
  console.log('❌ 配置错误:');
  validation.errors.forEach(err => console.log('  -', err));
}

if (validation.warnings && validation.warnings.length > 0) {
  console.log('⚠️  警告:');
  validation.warnings.forEach(warn => console.log('  -', warn));
}

// ==================== 示例 3: ARN 解析 ====================
console.log('\n=== 示例 3: ARN 解析 ===\n');

// Foundation Model ARN
const arn1 = 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0';
const parsed1 = parseBedrockModelArn(arn1);
console.log('Foundation Model ARN:');
console.log('  原始:', arn1);
console.log('  解析结果:', parsed1);

// Inference Profile ARN (跨区域)
const arn2 = 'arn:aws:bedrock:us-east-1::inference-profile/eu.anthropic.claude-3-5-sonnet-20241022-v2:0';
const parsed2 = parseBedrockModelArn(arn2);
console.log('\nInference Profile ARN:');
console.log('  原始:', arn2);
console.log('  解析结果:', parsed2);

// 纯模型 ID
const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const parsed3 = parseBedrockModelArn(modelId);
console.log('\n纯模型 ID:');
console.log('  原始:', modelId);
console.log('  解析结果:', parsed3);

// ==================== 示例 4: 模型别名映射 ====================
console.log('\n=== 示例 4: 模型别名映射 ===\n');

const aliases = ['sonnet', 'opus', 'haiku', 'sonnet-4', 'haiku-3.5'];
aliases.forEach(alias => {
  const fullId = getBedrockModelId(alias);
  console.log(`  ${alias.padEnd(12)} → ${fullId}`);
});

// ==================== 示例 5: 创建 ARN ====================
console.log('\n=== 示例 5: 创建 ARN ===\n');

const arnFoundation = createBedrockModelArn(
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'us-east-1'
);
console.log('Foundation Model ARN:', arnFoundation);

const arnProvisioned = createBedrockModelArn(
  'my-custom-model',
  'us-west-2',
  '123456789012',
  true
);
console.log('Provisioned Model ARN:', arnProvisioned);

// ==================== 示例 6: 可用区域 ====================
console.log('\n=== 示例 6: 可用区域 ===\n');

const regions = getBedrockRegions();
console.log(`共 ${regions.length} 个可用区域:\n`);
regions.forEach(r => {
  console.log(`  ${r.region.padEnd(20)} ${r.name}`);
  console.log(`  ${' '.repeat(20)} ${r.endpoint}\n`);
});

// ==================== 示例 7: 格式化配置信息 ====================
console.log('\n=== 示例 7: 格式化配置信息 ===\n');

const bedrockConfig: ProviderConfig = {
  type: 'bedrock',
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  crossRegionInference: false,
};

console.log(formatBedrockConfig(bedrockConfig));

// ==================== 示例 8: 错误处理 ====================
console.log('\n=== 示例 8: 错误处理 ===\n');

const errors = [
  new Error('InvalidSignatureException: Signature invalid'),
  new Error('AccessDeniedException: User not authorized'),
  new Error('ResourceNotFoundException: Model not found'),
  new Error('ThrottlingException: Rate limit exceeded'),
];

errors.forEach(err => {
  const friendlyMessage = handleBedrockError(err);
  console.log('  原始错误:', err.message);
  console.log('  友好提示:', friendlyMessage);
  console.log();
});

// ==================== 示例 9: 创建客户端（不同配置） ====================
console.log('\n=== 示例 9: 创建客户端 ===\n');

// 配置 1: 使用默认检测
try {
  console.log('方式 1: 使用环境变量自动检测');
  const client1 = createClient();
  console.log('  ✅ 客户端创建成功');
} catch (error) {
  console.log('  ❌ 错误:', handleBedrockError(error));
}

// 配置 2: 手动指定配置
try {
  console.log('\n方式 2: 手动指定配置');
  const manualConfig: ProviderConfig = {
    type: 'bedrock',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    model: 'sonnet', // 使用别名
  };
  const client2 = createClient(manualConfig);
  console.log('  ✅ 客户端创建成功');
} catch (error) {
  console.log('  ❌ 错误:', handleBedrockError(error));
}

// 配置 3: 跨区域推理
try {
  console.log('\n方式 3: 跨区域推理');
  const crossRegionConfig: ProviderConfig = {
    type: 'bedrock',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    model: 'arn:aws:bedrock:us-east-1::inference-profile/eu.anthropic.claude-3-5-sonnet-20241022-v2:0',
    crossRegionInference: true,
  };
  const client3 = createClient(crossRegionConfig);
  console.log('  ✅ 客户端创建成功（跨区域）');
} catch (error) {
  console.log('  ❌ 错误:', handleBedrockError(error));
}

// ==================== 示例 10: 实际使用场景 ====================
console.log('\n=== 示例 10: 完整使用流程 ===\n');

async function setupBedrockClient() {
  console.log('步骤 1: 检测环境配置');
  const config = detectProvider();
  console.log(`  提供商: ${config.type}`);
  console.log(`  区域: ${config.region}`);
  console.log(`  模型: ${config.model}\n`);

  console.log('步骤 2: 验证配置');
  const validation = validateProviderConfig(config);
  if (!validation.valid) {
    console.error('  ❌ 配置无效:');
    validation.errors.forEach(err => console.error(`    - ${err}`));
    return null;
  }
  console.log('  ✅ 配置有效\n');

  if (validation.warnings && validation.warnings.length > 0) {
    console.log('  ⚠️  警告:');
    validation.warnings.forEach(warn => console.log(`    - ${warn}`));
    console.log();
  }

  console.log('步骤 3: 创建客户端');
  try {
    const client = createClient(config);
    console.log('  ✅ 客户端创建成功\n');

    console.log('步骤 4: 显示配置摘要');
    console.log(formatBedrockConfig(config));

    return client;
  } catch (error) {
    console.error('  ❌ 创建失败:', handleBedrockError(error));
    return null;
  }
}

// 运行完整流程
setupBedrockClient();

// ==================== 示例 11: 环境变量配置检查 ====================
console.log('\n=== 示例 11: 环境变量检查 ===\n');

const requiredVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'CLAUDE_CODE_USE_BEDROCK',
];

const optionalVars = [
  'AWS_SESSION_TOKEN',
  'AWS_PROFILE',
  'AWS_BEDROCK_MODEL',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'DEBUG',
];

console.log('必需的环境变量:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const display = value ? (varName.includes('KEY') ? '***' : value) : '未设置';
  console.log(`  ${status} ${varName.padEnd(30)} = ${display}`);
});

console.log('\n可选的环境变量:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '○';
  const display = value || '未设置';
  console.log(`  ${status} ${varName.padEnd(30)} = ${display}`);
});

// ==================== 示例 12: 配置建议 ====================
console.log('\n=== 示例 12: 配置建议 ===\n');

function getConfigRecommendations(config: ProviderConfig) {
  const recommendations: string[] = [];

  // 检查 SDK
  try {
    require.resolve('@anthropic-ai/bedrock-sdk');
  } catch {
    recommendations.push('安装 Bedrock SDK 以获得完整功能: npm install @anthropic-ai/bedrock-sdk');
  }

  // 检查模型
  if (!config.model) {
    recommendations.push('建议设置 AWS_BEDROCK_MODEL 环境变量指定模型');
  }

  // 检查调试
  if (!process.env.DEBUG) {
    recommendations.push('开发时建议设置 DEBUG=true 查看详细日志');
  }

  // 检查区域
  const preferredRegions = ['us-east-1', 'us-west-2'];
  if (config.region && !preferredRegions.includes(config.region)) {
    recommendations.push(`当前区域 ${config.region} 可能模型可用性较低，建议使用 us-east-1 或 us-west-2`);
  }

  return recommendations;
}

const recommendations = getConfigRecommendations(config);
if (recommendations.length > 0) {
  console.log('配置优化建议:');
  recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
} else {
  console.log('✅ 配置已优化，无需额外建议');
}

console.log('\n' + '='.repeat(60));
console.log('示例演示完成！');
console.log('='.repeat(60));
