/**
 * 并行代理执行器使用示例
 */

import {
  ParallelAgentExecutor,
  AgentPool,
  createDependencyGraph,
  mergeAgentResults,
  validateTaskDependencies,
  estimateExecutionTime,
  type AgentTask,
  type ParallelAgentConfig,
} from './parallel.js';

// ============ 示例1: 简单并行执行 ============

export async function example1_simpleParallel() {
  console.log('=== Example 1: Simple Parallel Execution ===\n');

  // 定义任务
  const tasks: AgentTask[] = [
    {
      id: 'task-1',
      type: 'Explore',
      prompt: 'Find all TypeScript configuration files',
      description: 'Search tsconfig',
      priority: 1,
    },
    {
      id: 'task-2',
      type: 'Explore',
      prompt: 'Find all package.json files',
      description: 'Search package.json',
      priority: 2,
    },
    {
      id: 'task-3',
      type: 'general-purpose',
      prompt: 'Analyze the project structure',
      description: 'Analyze structure',
      model: 'haiku',
    },
  ];

  // 配置执行器
  const config: Partial<ParallelAgentConfig> = {
    maxConcurrency: 3,
    timeout: 60000,
    retryOnFailure: true,
    stopOnFirstError: false,
  };

  // 创建执行器
  const executor = new ParallelAgentExecutor(config);

  // 监听事件
  executor.on('task-started', (taskId) => {
    console.log(`[EVENT] Task started: ${taskId}`);
  });

  executor.on('task-completed', (taskId, result) => {
    console.log(`[EVENT] Task completed: ${taskId}`);
  });

  executor.on('task-failed', (taskId, error) => {
    console.log(`[EVENT] Task failed: ${taskId} - ${error}`);
  });

  // 执行任务
  console.log('Starting execution...\n');
  const result = await executor.execute(tasks);

  // 显示结果
  console.log('\n=== Execution Results ===');
  console.log(`Total tasks: ${result.totalTasks}`);
  console.log(`Completed: ${result.completed.length}`);
  console.log(`Failed: ${result.failed.length}`);
  console.log(`Cancelled: ${result.cancelled.length}`);
  console.log(`Success rate: ${result.successRate.toFixed(2)}%`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

  // 合并结果
  const merged = mergeAgentResults(result.completed);
  console.log('=== Merged Output ===');
  console.log(merged.combinedOutput);

  return result;
}

// ============ 示例2: 带依赖的执行 ============

export async function example2_withDependencies() {
  console.log('=== Example 2: Execution with Dependencies ===\n');

  // 定义有依赖关系的任务
  const tasks: AgentTask[] = [
    {
      id: 'analyze-structure',
      type: 'Explore',
      prompt: 'Analyze the overall project structure',
      description: 'Analyze structure',
      dependencies: [],
    },
    {
      id: 'find-components',
      type: 'Explore',
      prompt: 'Find all React components',
      description: 'Find components',
      dependencies: ['analyze-structure'],
    },
    {
      id: 'find-tests',
      type: 'Explore',
      prompt: 'Find all test files',
      description: 'Find tests',
      dependencies: ['analyze-structure'],
    },
    {
      id: 'check-coverage',
      type: 'general-purpose',
      prompt: 'Check test coverage for components',
      description: 'Check coverage',
      dependencies: ['find-components', 'find-tests'],
    },
  ];

  // 验证依赖
  const validation = validateTaskDependencies(tasks);
  if (!validation.valid) {
    console.error('Invalid task dependencies:');
    validation.errors.forEach(err => console.error(`  - ${err}`));
    return;
  }

  // 创建依赖图
  const graph = createDependencyGraph(tasks);
  console.log('Dependency graph:');
  console.log(`  Levels: ${graph.levels.length}`);
  graph.levels.forEach((level, idx) => {
    console.log(`  Level ${idx}: ${level.join(', ')}`);
  });
  console.log();

  // 估算执行时间
  const estimate = estimateExecutionTime(tasks, { maxConcurrency: 2 });
  console.log('Time estimate:');
  console.log(`  Sequential: ${(estimate.sequential / 1000).toFixed(0)}s`);
  console.log(`  Parallel: ${(estimate.parallel / 1000).toFixed(0)}s`);
  console.log(`  Speedup: ${estimate.speedup.toFixed(2)}x\n`);

  // 执行
  const executor = new ParallelAgentExecutor({ maxConcurrency: 2 });

  executor.on('task-started', (taskId) => {
    const progress = executor.getProgress();
    console.log(
      `[${progress.percentage.toFixed(0)}%] Started: ${taskId} (${progress.running} running)`
    );
  });

  executor.on('task-completed', (taskId) => {
    const progress = executor.getProgress();
    console.log(`[${progress.percentage.toFixed(0)}%] Completed: ${taskId}`);
  });

  const result = await executor.executeWithDependencies(tasks, graph);

  console.log('\n=== Execution Results ===');
  console.log(`Success rate: ${result.successRate.toFixed(2)}%`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

  return result;
}
