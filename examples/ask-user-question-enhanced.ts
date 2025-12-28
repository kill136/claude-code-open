/**
 * AskUserQuestion 工具增强功能示例
 *
 * 本示例展示了 AskUserQuestion 工具的增强功能：
 * 1. 默认值支持 (defaultIndex)
 * 2. 超时处理 (timeout)
 * 3. 输入验证 (validator)
 */

import { AskUserQuestionTool } from '../src/tools/ask.js';

// 创建工具实例
const askTool = new AskUserQuestionTool();

// 示例 1: 带默认值的问题
async function example1() {
  console.log('\n=== 示例 1: 带默认值的问题 ===\n');

  const result = await askTool.execute({
    questions: [
      {
        question: 'Which web framework should we use?',
        header: 'Framework',
        options: [
          { label: 'React (Recommended)', description: 'Popular UI library with virtual DOM' },
          { label: 'Vue', description: 'Progressive JavaScript framework' },
          { label: 'Angular', description: 'Full-featured TypeScript framework' },
        ],
        multiSelect: false,
        defaultIndex: 0,  // 默认选中 React
      } as any,
    ],
  });

  console.log('Result:', result);
}

// 示例 2: 带超时的问题
async function example2() {
  console.log('\n=== 示例 2: 带超时的问题 (10秒) ===\n');

  const result = await askTool.execute({
    questions: [
      {
        question: 'Continue with default settings?',
        header: 'Settings',
        options: [
          { label: 'Yes', description: 'Use recommended default configuration' },
          { label: 'No', description: 'I want to customize settings' },
        ],
        multiSelect: false,
        defaultIndex: 0,
        timeout: 10000,  // 10秒后自动选择默认值
      } as any,
    ],
  });

  console.log('Result:', result);
}

// 示例 3: 带验证器的问题
async function example3() {
  console.log('\n=== 示例 3: 带输入验证的问题 ===\n');

  const result = await askTool.execute({
    questions: [
      {
        question: 'What should we name this project?',
        header: 'Project Name',
        options: [
          { label: 'my-awesome-app', description: 'Default project name' },
          { label: 'my-project', description: 'Simple project name' },
        ],
        multiSelect: false,
        validator: (input: string) => {
          // 项目名只能包含小写字母、数字和连字符
          if (!/^[a-z0-9-]+$/.test(input)) {
            return {
              valid: false,
              message: 'Project name can only contain lowercase letters, numbers, and hyphens',
            };
          }
          // 不能以连字符开头或结尾
          if (input.startsWith('-') || input.endsWith('-')) {
            return {
              valid: false,
              message: 'Project name cannot start or end with a hyphen',
            };
          }
          // 长度限制
          if (input.length < 3 || input.length > 50) {
            return {
              valid: false,
              message: 'Project name must be between 3 and 50 characters',
            };
          }
          return { valid: true };
        },
      } as any,
    ],
  });

  console.log('Result:', result);
}

// 示例 4: 多选模式 + 默认值
async function example4() {
  console.log('\n=== 示例 4: 多选模式 + 默认值 ===\n');

  const result = await askTool.execute({
    questions: [
      {
        question: 'Which features do you want to enable?',
        header: 'Features',
        options: [
          { label: 'TypeScript', description: 'Add TypeScript support (Recommended)' },
          { label: 'ESLint', description: 'Add linting with ESLint' },
          { label: 'Prettier', description: 'Add code formatting with Prettier' },
          { label: 'Jest', description: 'Add testing with Jest' },
        ],
        multiSelect: true,
        defaultIndex: 0,  // 默认选中 TypeScript
      } as any,
    ],
  });

  console.log('Result:', result);
}

// 示例 5: 组合多个增强功能
async function example5() {
  console.log('\n=== 示例 5: 组合多个增强功能 ===\n');

  const result = await askTool.execute({
    questions: [
      {
        question: 'Enter your email address:',
        header: 'Email',
        options: [
          { label: 'user@example.com', description: 'Default email address' },
          { label: 'admin@example.com', description: 'Admin email address' },
        ],
        multiSelect: false,
        defaultIndex: 0,
        timeout: 15000,  // 15秒超时
        validator: (input: string) => {
          // 简单的邮箱验证
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input)) {
            return {
              valid: false,
              message: 'Please enter a valid email address (e.g., user@example.com)',
            };
          }
          return { valid: true };
        },
      } as any,
    ],
  });

  console.log('Result:', result);
}

// 运行示例
async function runExamples() {
  try {
    // 取消注释你想运行的示例

    // await example1();  // 默认值示例
    // await example2();  // 超时示例
    // await example3();  // 验证器示例
    // await example4();  // 多选 + 默认值示例
    // await example5();  // 组合示例

    console.log('\n✅ Examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// 导出所有示例函数
export { example1, example2, example3, example4, example5, runExamples };
