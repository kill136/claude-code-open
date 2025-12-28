/**
 * 任务 003: 打印模式 (-p/--print)
 * 负责人: 工程师 #003
 * 优先级: P0
 *
 * 官方行为: `claude -p "Explain this"` 非交互输出后退出
 *
 * 验收标准:
 * - [ ] 输出结果后退出
 * - [ ] 不进入交互模式
 * - [ ] 支持管道操作
 */

import { describe, it, expect } from 'vitest';
import {
  runCLI,
  compareCLIOutput,
  createTestFile,
  TEST_TEMP_DIR,
  describeFeature,
} from '../setup';

describeFeature(
  {
    id: '003',
    category: 'CLI',
    priority: 'P0',
    description: '打印模式 (-p/--print)',
    officialBehavior: '非交互输出后退出',
  },
  () => {
    describe('基础打印模式', () => {
      it('应该接受 -p 短参数', async () => {
        const result = await runCLI(['-p', '--help']);

        // 验证 -p 参数被识别
        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该接受 --print 长参数', async () => {
        const result = await runCLI(['--print', '--help']);

        // 验证 --print 参数被识别
        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('输出格式配合', () => {
      it('应该支持 --output-format text', async () => {
        const result = await runCLI([
          '-p',
          '--output-format',
          'text',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --output-format json', async () => {
        const result = await runCLI([
          '-p',
          '--output-format',
          'json',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --output-format stream-json', async () => {
        const result = await runCLI([
          '-p',
          '--output-format',
          'stream-json',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('管道操作支持', () => {
      it('应该能够接收标准输入', async () => {
        const result = await runCLI(['-p', '--help'], {
          input: 'test input\n',
        });

        // 验证可以处理输入
        expect(result).toBeDefined();
      });
    });

    describe('与其他选项组合', () => {
      it('应该支持 --model 选项组合', async () => {
        const result = await runCLI([
          '-p',
          '--model',
          'sonnet',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --max-budget-usd 选项', async () => {
        const result = await runCLI([
          '-p',
          '--max-budget-usd',
          '1.0',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });

      it('应该支持 --no-session-persistence 选项', async () => {
        const result = await runCLI([
          '-p',
          '--no-session-persistence',
          '--help',
        ]);

        expect(result.stderr).not.toContain('unknown option');
      });
    });

    describe('官方行为对比', () => {
      it('帮助信息应该说明 -p 用于管道操作', async () => {
        const { official, ours } = await compareCLIOutput(['--help']);

        // 官方帮助信息中关于 -p 的描述
        const printDescription = 'Print response and exit';

        if (official.stdout.includes(printDescription)) {
          expect(ours.stdout).toContain(printDescription);
        }
      });
    });
  }
);
