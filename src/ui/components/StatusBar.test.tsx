#!/usr/bin/env node
/**
 * StatusBar 组件测试
 * 运行: npm run dev -- src/ui/components/StatusBar.test.tsx
 * 或: node --loader ts-node/esm src/ui/components/StatusBar.test.tsx
 */

import React from 'react';
import { render, Box, Text } from 'ink';
import { StatusBar } from './StatusBar.js';

// 测试场景 1: 基础功能
const BasicTest = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        === Test 1: Basic StatusBar ===
      </Text>
      <StatusBar
        messageCount={10}
        tokenCount={5234}
        cost="$0.0234"
        duration={125000}
        isProcessing={false}
      />
    </Box>
  );
};

// 测试场景 2: 完整功能
const FullTest = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        === Test 2: Full Features ===
      </Text>
      <StatusBar
        messageCount={42}
        inputTokens={125000}
        outputTokens={45000}
        cost="$0.1523"
        duration={3600000}
        isProcessing={true}
        model="claude-sonnet-4.5-20241022"
        modelDisplayName="sonnet-4.5"
        contextUsed={170000}
        contextMax={200000}
        contextPercentage={85}
        networkStatus="online"
        permissionMode="acceptEdits"
        gitBranch="feature/status-bar"
        cwd="/home/user/claude-code-open"
      />
    </Box>
  );
};

// 测试场景 3: 高负载（90%+ 上下文）
const HighLoadTest = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        === Test 3: High Load (Context Warning) ===
      </Text>
      <StatusBar
        messageCount={150}
        inputTokens={1500000}
        outputTokens={500000}
        cost="$1.7234"
        duration={7200000}
        isProcessing={false}
        model="claude-opus-4.5-20251101"
        modelDisplayName="opus-4.5"
        contextUsed={182000}
        contextMax={200000}
        contextPercentage={91}
        networkStatus="online"
        permissionMode="plan"
        gitBranch="main"
        cwd="/home/user/projects/very/long/path/to/my/awesome/project"
      />
    </Box>
  );
};

// 测试场景 4: 错误状态
const ErrorTest = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        === Test 4: Error State ===
      </Text>
      <StatusBar
        messageCount={5}
        tokenCount={1200}
        cost="$0.0045"
        duration={15000}
        isProcessing={false}
        model="claude-sonnet-4.5-20241022"
        networkStatus="error"
        permissionMode="default"
        gitBranch="hotfix/api-error"
        cwd="/home/user/debugging"
      />
    </Box>
  );
};

// 测试场景 5: 最小配置
const MinimalTest = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        === Test 5: Minimal Configuration ===
      </Text>
      <StatusBar messageCount={0} />
    </Box>
  );
};

// 主测试套件
const TestSuite = () => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box borderStyle="bold" borderColor="green" padding={1} marginBottom={1}>
        <Text bold color="green">
          StatusBar Component Test Suite
        </Text>
      </Box>

      <BasicTest />
      <Box marginY={1} />

      <FullTest />
      <Box marginY={1} />

      <HighLoadTest />
      <Box marginY={1} />

      <ErrorTest />
      <Box marginY={1} />

      <MinimalTest />
      <Box marginY={1} />

      <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text color="gray">
          All tests rendered successfully! Press Ctrl+C to exit.
        </Text>
      </Box>
    </Box>
  );
};

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n🧪 Running StatusBar tests...\n');

  const { unmount } = render(<TestSuite />);

  // 10 秒后自动退出
  setTimeout(() => {
    console.log('\n✅ All tests completed!\n');
    unmount();
    process.exit(0);
  }, 10000);
}

export default TestSuite;
