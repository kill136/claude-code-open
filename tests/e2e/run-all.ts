#!/usr/bin/env node
/**
 * E2E 测试运行器
 * 运行所有 E2E 测试并生成报告
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
  error?: string;
}

/**
 * 运行单个测试文件
 */
async function runTestFile(testFile: string): Promise<TestResult> {
  const startTime = Date.now();
  const testPath = path.join(__dirname, testFile);

  return new Promise((resolve) => {
    const child = spawn('tsx', [testPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve({
          name: testFile,
          passed: 1,
          failed: 0,
          duration
        });
      } else {
        resolve({
          name: testFile,
          passed: 0,
          failed: 1,
          duration,
          error: `退出码 ${code}`
        });
      }
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        name: testFile,
        passed: 0,
        failed: 1,
        duration,
        error: error.message
      });
    });
  });
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('E2E 测试套件');
  console.log('='.repeat(60));
  console.log();

  const testFiles = [
    'cli-basic.test.ts',
    'cli-session.test.ts',
    'cli-tools.test.ts'
  ];

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const testFile of testFiles) {
    console.log(`\n运行: ${testFile}`);
    console.log('-'.repeat(60));

    const result = await runTestFile(testFile);
    results.push(result);

    totalPassed += result.passed;
    totalFailed += result.failed;
    totalDuration += result.duration;

    if (result.error) {
      console.error(`错误: ${result.error}`);
    }
  }

  // 打印总结
  console.log('\n' + '='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.failed === 0 ? '✓' : '✗';
    const time = (result.duration / 1000).toFixed(2);
    console.log(`${status} ${result.name} (${time}s)`);

    if (result.error) {
      console.log(`  错误: ${result.error}`);
    }
  }

  console.log();
  console.log(`总计: ${totalPassed} 个测试文件通过, ${totalFailed} 个失败`);
  console.log(`耗时: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log();

  // 退出码
  if (totalFailed > 0) {
    console.error('部分测试失败!');
    process.exit(1);
  } else {
    console.log('所有测试通过!');
    process.exit(0);
  }
}

// 运行测试
runAllTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
