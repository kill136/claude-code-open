/**
 * 提示词预览功能使用示例
 */

import { promptPreview } from '../src/prompt/preview.js';
import { systemPromptBuilder } from '../src/prompt/builder.js';
import type { PromptContext } from '../src/prompt/types.js';

async function main() {
  console.log('=== Prompt Preview Example ===\n');

  // 1. 构建一个示例提示词
  const context: PromptContext = {
    workingDir: '/home/user/project',
    model: 'claude-sonnet-4-5',
    permissionMode: 'default',
    isGitRepo: true,
    platform: 'linux',
    todayDate: '2025-12-25',
  };

  const result = await systemPromptBuilder.build(context);
  console.log('Built system prompt\n');

  // 2. 生成预览
  console.log('--- Preview (Plain Format) ---');
  const preview = promptPreview.preview(result.content, {
    maxLength: 500,
    showTokenCount: true,
    showSections: true,
  });
  console.log(preview);
  console.log('\n');

  // 3. 分析提示词
  console.log('--- Analysis ---');
  const analysis = promptPreview.analyze(result.content);
  console.log(`Total tokens: ${analysis.totalTokens}`);
  console.log(`Total chars: ${analysis.totalChars}`);
  console.log(`Sections: ${analysis.sections.length}`);
  console.log(`Warnings: ${analysis.warnings.length}`);

  if (analysis.warnings.length > 0) {
    console.log('\nWarnings:');
    analysis.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log('\n');

  // 4. 比较两个提示词
  console.log('--- Diff Example ---');
  const oldPrompt = `You are Claude Code, an AI assistant.

# Tool usage policy
- Use tools wisely
- Read files before editing`;

  const newPrompt = `You are Claude Code, Anthropic's official CLI.

# Tool usage policy
- Use tools wisely
- Read files before editing
- Prefer specialized tools over bash commands`;

  const diff = promptPreview.diff(oldPrompt, newPrompt, {
    showTokenCount: true,
    highlightChanges: true,
  });
  console.log(diff);
  console.log('\n');

  // 5. JSON 格式输出
  console.log('--- JSON Format ---');
  const jsonPreview = promptPreview.preview(result.content, {
    maxLength: 200,
    format: 'json',
  });
  const parsed = JSON.parse(jsonPreview);
  console.log(`Total tokens: ${parsed.totalTokens}`);
  console.log(`Sections: ${parsed.sections.length}`);
  console.log('First 3 sections:');
  parsed.sections.slice(0, 3).forEach((s: any) => {
    console.log(`  - ${s.name}: ${s.tokens} tokens (${s.percentage}%)`);
  });
}

main().catch(console.error);
