/**
 * Statusline Agent 使用示例
 */

import { statuslineAgent, createInlineCommand, parseStatuslineCommand } from '../src/agents/index.js';

async function main() {
  console.log('=== Statusline Agent Usage Examples ===\n');

  // 1. 获取当前配置
  console.log('1. Getting current configuration...');
  const config = await statuslineAgent.getConfig();
  console.log('Current config:', JSON.stringify(config, null, 2));
  console.log('');

  // 2. 从 PS1 导入（演示）
  console.log('2. Importing from PS1...');
  const importResult = await statuslineAgent.importFromPS1();
  if (importResult.success) {
    console.log('PS1 found:', importResult.ps1);
    console.log('Converted command:', importResult.command);
  } else {
    console.log('Import result:', importResult.error);
  }
  console.log('');

  // 3. 创建自定义命令
  console.log('3. Creating custom inline command...');
  const elements = [
    { type: 'model' as const, visible: true },
    { type: 'cwd' as const, visible: true },
    { type: 'context_percentage' as const, visible: true },
  ];
  const customCommand = createInlineCommand(elements);
  console.log('Custom command:', customCommand);
  console.log('');

  // 4. 解析命令
  console.log('4. Parsing command...');
  const parseResult = parseStatuslineCommand(customCommand);
  console.log('Parse result:', JSON.stringify(parseResult, null, 2));
  console.log('');

  // 5. 创建模板脚本
  console.log('5. Creating template script...');
  try {
    const scriptPath = await statuslineAgent.createTemplateScript('standard');
    console.log('Script created at:', scriptPath);
  } catch (error) {
    console.log('Script creation:', error instanceof Error ? error.message : String(error));
  }
  console.log('');

  // 6. 配置状态行（演示 - 不实际保存）
  console.log('6. Configuring statusline (demo)...');
  const demoConfig = {
    type: 'command' as const,
    command: 'input=$(cat); echo "$(echo "$input" | jq -r \'.model.display_name\')"',
  };
  console.log('Would configure:', JSON.stringify(demoConfig, null, 2));
  console.log('');

  // 7. 预览效果
  console.log('7. Previewing statusline...');
  try {
    const preview = await statuslineAgent.preview(demoConfig.command);
    console.log('Preview result:', preview);
  } catch (error) {
    console.log('Preview:', error instanceof Error ? error.message : String(error));
  }
  console.log('');

  // 8. 命令验证
  console.log('8. Validating commands...');
  const safeCommand = 'echo "Hello World"';
  const dangerousCommand = 'rm -rf /';
  
  const safeResult = statuslineAgent.validateCommand(safeCommand);
  const dangerResult = statuslineAgent.validateCommand(dangerousCommand);
  
  console.log('Safe command:', safeCommand);
  console.log('Validation:', safeResult);
  console.log('');
  console.log('Dangerous command:', dangerousCommand);
  console.log('Validation:', dangerResult);
  console.log('');

  console.log('=== Examples Complete ===');
}

// 运行示例
main().catch(console.error);
