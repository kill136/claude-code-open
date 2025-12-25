#!/usr/bin/env node
/**
 * Spinner 组件快速验证测试
 * 验证所有导出是否正常
 */

import { SPINNER_TYPES, STATUS_ICONS, STATUS_COLORS } from '../src/ui/components/index.js';

console.log('🧪 Spinner Component Validation\n');

// 验证动画类型
console.log('✅ Spinner Types:', Object.keys(SPINNER_TYPES).length, 'types');
console.log('   Available:', Object.keys(SPINNER_TYPES).join(', '));
console.log('');

// 验证状态图标
console.log('✅ Status Icons:', Object.keys(STATUS_ICONS).length, 'statuses');
Object.entries(STATUS_ICONS).forEach(([status, icon]) => {
  console.log(`   ${status}: ${icon}`);
});
console.log('');

// 验证状态颜色
console.log('✅ Status Colors:', Object.keys(STATUS_COLORS).length, 'colors');
Object.entries(STATUS_COLORS).forEach(([status, color]) => {
  console.log(`   ${status}: ${color}`);
});
console.log('');

// 验证动画帧
console.log('✅ Animation Frames:');
const sampleTypes = ['dots', 'arc', 'circle', 'moon'];
sampleTypes.forEach(type => {
  const frames = SPINNER_TYPES[type];
  console.log(`   ${type}: ${frames.join(' ')} (${frames.length} frames)`);
});
console.log('');

console.log('✨ All validations passed!');
console.log('📖 Read Spinner.README.md for usage guide');
console.log('🚀 Run spinner-demo.tsx for interactive demo');
