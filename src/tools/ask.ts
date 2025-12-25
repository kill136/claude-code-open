/**
 * AskUserQuestion 工具
 * 向用户提出问题并获取选择
 *
 * 支持特性:
 * - 键盘导航 (↑/↓ 箭头键)
 * - 多选模式 (空格键选择/取消)
 * - 数字快捷键
 * - 自定义答案选项
 * - 美化的终端 UI
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { BaseTool } from './base.js';
import type { AskUserQuestionInput, ToolResult, ToolDefinition } from '../types/index.js';

interface QuestionOption {
  label: string;
  description: string;
}

interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export class AskUserQuestionTool extends BaseTool<AskUserQuestionInput, ToolResult> {
  name = 'AskUserQuestion';
  description = `Ask the user a question with predefined options to clarify requirements or get approval.

Use this tool when you need to:
- Clarify ambiguous requirements
- Get user approval for a specific approach
- Ask about implementation preferences
- Confirm understanding of a task

Each question should have 2-4 options. An "Other" option allowing free-form input is automatically provided.`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'Questions to ask the user (1-4 questions)',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The complete question to ask the user',
              },
              header: {
                type: 'string',
                description: 'Short label displayed as a chip/tag (max 12 chars)',
              },
              options: {
                type: 'array',
                description: 'The available choices (2-4 options)',
                items: {
                  type: 'object',
                  properties: {
                    label: {
                      type: 'string',
                      description: 'Display text for this option (1-5 words)',
                    },
                    description: {
                      type: 'string',
                      description: 'Explanation of what this option means',
                    },
                  },
                  required: ['label', 'description'],
                },
              },
              multiSelect: {
                type: 'boolean',
                description: 'Allow multiple selections',
              },
            },
            required: ['question', 'header', 'options', 'multiSelect'],
          },
        },
      },
      required: ['questions'],
    };
  }

  async execute(input: AskUserQuestionInput): Promise<ToolResult> {
    const { questions } = input;

    if (!questions || questions.length === 0) {
      return { success: false, error: 'No questions provided' };
    }

    if (questions.length > 4) {
      return { success: false, error: 'Maximum 4 questions allowed' };
    }

    const answers: Record<string, string> = {};

    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // 验证选项数量
        if (q.options.length < 2 || q.options.length > 4) {
          return {
            success: false,
            error: `Question "${q.header}" must have 2-4 options (has ${q.options.length})`
          };
        }

        const answer = await this.askInteractiveQuestion(q, i + 1, questions.length);
        answers[q.header] = answer;
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user response: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // 格式化答案输出
    let output = '✓ User Responses:\n\n';
    for (const [header, answer] of Object.entries(answers)) {
      output += `  ${chalk.bold(header)}: ${chalk.cyan(answer)}\n`;
    }

    return {
      success: true,
      output,
    };
  }

  /**
   * 交互式问题选择器 - 支持键盘导航
   */
  private async askInteractiveQuestion(
    question: Question,
    questionNum: number,
    totalQuestions: number
  ): Promise<string> {
    // 添加 "Other" 选项
    const allOptions = [...question.options, { label: 'Other', description: 'Enter custom response' }];

    // 检查是否支持交互模式
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

    if (isInteractive) {
      return this.interactiveSelect(question, allOptions, questionNum, totalQuestions);
    } else {
      // 降级到简单模式
      return this.simpleSelect(question, allOptions, questionNum, totalQuestions);
    }
  }

  /**
   * 交互式选择模式 - 支持箭头键导航
   */
  private async interactiveSelect(
    question: Question,
    options: QuestionOption[],
    questionNum: number,
    totalQuestions: number
  ): Promise<string> {
    let currentIndex = 0;
    const selectedIndices = new Set<number>();

    // 显示问题头部
    this.displayQuestionHeader(question, questionNum, totalQuestions);

    return new Promise((resolve) => {
      // 设置原始模式
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      readline.emitKeypressEvents(process.stdin);

      const render = () => {
        // 清除之前的选项显示
        if (currentIndex > 0) {
          readline.moveCursor(process.stdout, 0, -(options.length + 2));
          readline.clearScreenDown(process.stdout);
        }

        // 显示选项
        options.forEach((opt, idx) => {
          const isSelected = selectedIndices.has(idx);
          const isCurrent = idx === currentIndex;

          let prefix = '  ';
          if (question.multiSelect) {
            prefix = isSelected ? chalk.green('◉ ') : '◯ ';
          }

          const cursor = isCurrent ? chalk.cyan('❯ ') : '  ';
          const number = chalk.dim(`${idx + 1}.`);
          const label = isCurrent ? chalk.cyan.bold(opt.label) : opt.label;
          const desc = chalk.dim(`- ${opt.description}`);

          console.log(`${cursor}${prefix}${number} ${label} ${desc}`);
        });

        // 显示提示
        console.log();
        if (question.multiSelect) {
          console.log(chalk.dim('  ↑/↓: Navigate | Space: Toggle | Enter: Confirm | 1-9: Quick select'));
        } else {
          console.log(chalk.dim('  ↑/↓: Navigate | Enter: Select | 1-9: Quick select'));
        }
      };

      const cleanup = () => {
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeAllListeners('keypress');
      };

      const finishSelection = async () => {
        cleanup();

        // 清除选项显示
        readline.moveCursor(process.stdout, 0, -(options.length + 2));
        readline.clearScreenDown(process.stdout);

        let result: string;

        if (question.multiSelect) {
          if (selectedIndices.size === 0) {
            selectedIndices.add(currentIndex);
          }

          const selectedLabels: string[] = [];
          for (const idx of Array.from(selectedIndices).sort((a, b) => a - b)) {
            if (idx === options.length - 1) {
              // "Other" 选项
              const custom = await this.getCustomInput();
              selectedLabels.push(custom);
            } else {
              selectedLabels.push(options[idx].label);
            }
          }
          result = selectedLabels.join(', ');
        } else {
          if (currentIndex === options.length - 1) {
            // "Other" 选项
            result = await this.getCustomInput();
          } else {
            result = options[currentIndex].label;
          }
        }

        // 显示选中结果
        console.log(chalk.green(`  ✓ Selected: ${chalk.bold(result)}\n`));

        resolve(result);
      };

      // 键盘事件处理
      process.stdin.on('keypress', async (str, key) => {
        if (key.ctrl && key.name === 'c') {
          cleanup();
          process.exit(0);
        }

        if (key.name === 'up') {
          currentIndex = (currentIndex - 1 + options.length) % options.length;
          render();
        } else if (key.name === 'down') {
          currentIndex = (currentIndex + 1) % options.length;
          render();
        } else if (key.name === 'space' && question.multiSelect) {
          if (selectedIndices.has(currentIndex)) {
            selectedIndices.delete(currentIndex);
          } else {
            selectedIndices.add(currentIndex);
          }
          render();
        } else if (key.name === 'return') {
          await finishSelection();
        } else if (str && /^[1-9]$/.test(str)) {
          const idx = parseInt(str, 10) - 1;
          if (idx >= 0 && idx < options.length) {
            currentIndex = idx;
            if (question.multiSelect) {
              if (selectedIndices.has(idx)) {
                selectedIndices.delete(idx);
              } else {
                selectedIndices.add(idx);
              }
              render();
            } else {
              await finishSelection();
            }
          }
        }
      });

      // 初始渲染
      render();
    });
  }

  /**
   * 简单选择模式 - 用于非 TTY 环境
   */
  private async simpleSelect(
    question: Question,
    options: QuestionOption[],
    questionNum: number,
    totalQuestions: number
  ): Promise<string> {
    // 显示问题头部
    this.displayQuestionHeader(question, questionNum, totalQuestions);

    // 显示选项
    options.forEach((opt, idx) => {
      console.log(chalk.cyan(`  ${idx + 1}. ${opt.label}`));
      console.log(chalk.gray(`     ${opt.description}`));
    });
    console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    try {
      const response = await askQuestion(
        question.multiSelect
          ? chalk.blue('Enter choices (comma-separated numbers): ')
          : chalk.blue('Enter your choice (number): ')
      );

      // 解析响应
      if (question.multiSelect) {
        const indices = response.split(',').map((s) => parseInt(s.trim(), 10));
        const selected: string[] = [];

        for (const idx of indices) {
          if (idx >= 1 && idx < options.length) {
            selected.push(options[idx - 1].label);
          } else if (idx === options.length) {
            const custom = await askQuestion(chalk.blue('Enter custom response: '));
            selected.push(custom);
          }
        }

        return selected.length > 0 ? selected.join(', ') : response;
      } else {
        const idx = parseInt(response, 10);

        if (idx >= 1 && idx < options.length) {
          return options[idx - 1].label;
        } else if (idx === options.length) {
          return await askQuestion(chalk.blue('Enter custom response: '));
        } else {
          return response; // 直接使用输入
        }
      }
    } finally {
      rl.close();
    }
  }

  /**
   * 显示问题头部
   */
  private displayQuestionHeader(question: Question, questionNum: number, totalQuestions: number): void {
    console.log();
    console.log(chalk.bgBlue.white.bold(` Question ${questionNum}/${totalQuestions} `));
    console.log();

    // 显示标签芯片
    const headerChip = chalk.bgCyan.black.bold(` ${question.header} `);
    console.log(`  ${headerChip}`);
    console.log();

    // 显示问题
    console.log(chalk.bold(`  ${question.question}`));
    console.log();
  }

  /**
   * 获取自定义输入
   */
  private async getCustomInput(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(chalk.blue('  Enter custom response: '), (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
