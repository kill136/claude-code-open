/**
 * 测试官网对齐的 Skill 实现
 */

import {
  SkillTool,
  initializeSkills,
  getAllSkills,
  findSkill,
  getInvokedSkills,
  clearSkillCache,
} from './src/tools/skill-official.js';

async function main() {
  console.log('=== 测试官网对齐的 Skill 实现 ===\n');

  // 1. 初始化 skills
  console.log('1. 初始化 skills...');
  await initializeSkills();
  console.log('✓ Skills 初始化完成\n');

  // 2. 列出所有 skills
  console.log('2. 所有可用的 skills:');
  const allSkills = getAllSkills();
  allSkills.forEach(skill => {
    console.log(`  - ${skill.skillName}`);
    console.log(`    显示名称: ${skill.displayName}`);
    console.log(`    描述: ${skill.description}`);
    console.log(`    来源: ${skill.source}`);
    console.log(`    文件: ${skill.filePath}`);
    if (skill.version) {
      console.log(`    版本: ${skill.version}`);
    }
    if (skill.model) {
      console.log(`    模型: ${skill.model}`);
    }
    if (skill.allowedTools) {
      console.log(`    允许的工具: ${skill.allowedTools.join(', ')}`);
    }
    console.log('');
  });

  // 3. 测试查找 skill
  console.log('3. 测试查找 skill:');
  const testSkill = findSkill('test-skill');
  if (testSkill) {
    console.log(`  ✓ 找到 skill: ${testSkill.skillName}`);
    console.log(`    内容预览: ${testSkill.markdownContent.substring(0, 100)}...`);
  } else {
    console.log('  ✗ 未找到 test-skill');
  }
  console.log('');

  // 4. 测试带命名空间的查找
  console.log('4. 测试带命名空间的查找:');
  const userTestSkill = findSkill('user:test-skill');
  if (userTestSkill) {
    console.log(`  ✓ 找到 skill: ${userTestSkill.skillName}`);
  } else {
    console.log('  ✗ 未找到 user:test-skill');
  }
  console.log('');

  // 5. 执行 skill
  console.log('5. 执行 skill:');
  const skillTool = new SkillTool();
  const result = await skillTool.execute({
    skill: 'test-skill',
    args: '--verbose --test',
  });

  if (result.success) {
    console.log('  ✓ Skill 执行成功');
    console.log('\n--- 输出内容 ---');
    console.log(result.output);
    console.log('--- 输出结束 ---\n');

    if (result.allowedTools) {
      console.log(`  允许的工具: ${result.allowedTools.join(', ')}`);
    }
    if (result.model) {
      console.log(`  使用模型: ${result.model}`);
    }
  } else {
    console.log(`  ✗ Skill 执行失败: ${result.error}`);
  }
  console.log('');

  // 6. 检查 invokedSkills 追踪
  console.log('6. 检查 invokedSkills 追踪:');
  const invoked = getInvokedSkills();
  console.log(`  已调用的 skills 数量: ${invoked.size}`);
  invoked.forEach((info, skillName) => {
    console.log(`  - ${skillName}`);
    console.log(`    路径: ${info.skillPath}`);
    console.log(`    调用时间: ${new Date(info.invokedAt).toISOString()}`);
    console.log(`    内容长度: ${info.content.length} 字符`);
  });
  console.log('');

  // 7. 测试 Skill Tool 的描述
  console.log('7. Skill Tool 描述（前500字符）:');
  console.log(skillTool.description.substring(0, 500) + '...\n');

  // 8. 清除缓存测试
  console.log('8. 测试清除缓存:');
  clearSkillCache();
  console.log('  ✓ 缓存已清除');
  await initializeSkills();
  console.log(`  ✓ 重新加载后的 skills 数量: ${getAllSkills().length}`);

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
