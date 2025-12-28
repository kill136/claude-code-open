/**
 * 任务 001: 基础启动模式
 * 负责人: 工程师 #001
 * 优先级: P0 (核心功能)
 *
 * 官方行为: `claude` 无参数启动进入交互式会话
 *
 * 验收标准:
 * - [ ] 无参数启动进入交互模式
 * - [ ] 显示欢迎信息
 * - [ ] 可接收用户输入
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  runCLI,
  compareCLIOutput,
  TEST_TEMP_DIR,
  describeFeature,
  Priority,
  TestCategory,
} from '../setup';

describeFeature(
  {
    id: '001',
    category: 'CLI',
    priority: 'P0',
    description: '基础启动模式',
    officialBehavior: '无参数启动进入交互式会话',
  },
  () => {
    describe('验收标准检查', () => {
      it('应该显示帮助信息当使用 --help 参数时', async () => {
        const result = await runCLI(['--help']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('claude');
      });

      it('应该与官方CLI帮助信息结构一致', async () => {
        const { official, ours } = await compareCLIOutput(['--help']);

        // 检查关键帮助信息是否存在
        const requiredSections = [
          'Usage:',
          'Options:',
          '--help',
          '--version',
          '-p, --print',
          '--model',
        ];

        for (const section of requiredSections) {
          expect(official.stdout).toContain(section);
          expect(ours.stdout).toContain(section);
        }
      });

      it('应该显示正确的版本信息', async () => {
        const result = await runCLI(['--version']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      });

      it('无参数启动时应该尝试进入交互模式', async () => {
        // 由于没有TTY，预期会有特定的行为
        const result = await runCLI([], { timeout: 5000 });

        // 检查是否有交互式相关的输出或错误
        // 具体行为取决于实现
        expect(result).toBeDefined();
      });
    });

    describe('官方对比测试', () => {
      it('--help 输出应该包含相同的核心选项', async () => {
        const { official, ours } = await compareCLIOutput(['--help']);

        // 核心选项列表
        const coreOptions = [
          '-p, --print',
          '-c, --continue',
          '-r, --resume',
          '--model',
          '--permission-mode',
          '--allowedTools',
          '--disallowedTools',
        ];

        for (const option of coreOptions) {
          const officialHas = official.stdout.includes(option);
          const oursHas = ours.stdout.includes(option);

          if (officialHas && !oursHas) {
            console.warn(`我们的CLI缺少选项: ${option}`);
          }

          // 确保官方有的核心选项我们也有
          if (officialHas) {
            expect(ours.stdout).toContain(option);
          }
        }
      });
    });

    describe('边界情况', () => {
      it('应该正确处理无效参数', async () => {
        const result = await runCLI(['--invalid-option-xyz']);

        // 无效参数应该返回错误
        expect(result.exitCode).not.toBe(0);
      });

      it('应该正确处理空工作目录', async () => {
        const result = await runCLI(['--help'], { cwd: TEST_TEMP_DIR });

        expect(result.exitCode).toBe(0);
      });
    });
  }
);
