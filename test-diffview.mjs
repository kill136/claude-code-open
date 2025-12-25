#!/usr/bin/env node

/**
 * DiffView Component Test Script
 *
 * This script demonstrates the DiffView component in action.
 * Run with: node test-diffview.mjs
 */

import React from 'react';
import { render, Box, Text } from 'ink';
import { DiffView } from './dist/ui/components/DiffView.js';

// Test Case 1: Simple function modification
const testCase1 = {
  name: 'Simple Function Modification',
  oldContent: `function calculateSum(a, b) {
  return a + b;
}

function main() {
  const result = calculateSum(5, 3);
  console.log(result);
}`,
  newContent: `function calculateSum(a, b, c = 0) {
  const sum = a + b + c;
  return sum;
}

function main() {
  const result = calculateSum(5, 3, 2);
  console.log('Result:', result);
  console.log('Done!');
}`,
  fileName: 'calculator.js',
};

// Test Case 2: Configuration file changes
const testCase2 = {
  name: 'Configuration File Changes',
  oldContent: `{
  "name": "my-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}`,
  newContent: `{
  "name": "my-app",
  "version": "1.1.0",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.4.0"
  }
}`,
  fileName: 'package.json',
};

// Test interface
function TestApp({ testCase, mode = 'unified' }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Test: {testCase.name}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">
          Mode: {mode}
        </Text>
      </Box>
      <DiffView
        oldContent={testCase.oldContent}
        newContent={testCase.newContent}
        fileName={testCase.fileName}
        mode={mode}
        showLineNumbers={true}
        contextLines={3}
      />
    </Box>
  );
}

// Run tests
async function runTests() {
  console.log('\n='.repeat(80));
  console.log('DiffView Component Test Suite');
  console.log('='.repeat(80));

  // Test 1: Unified mode
  console.log('\n\n--- Test 1: Unified Mode ---\n');
  const { waitUntilExit: wait1 } = render(
    <TestApp testCase={testCase1} mode="unified" />
  );
  await wait1;

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Side-by-side mode
  console.log('\n\n--- Test 2: Side-by-Side Mode ---\n');
  const { waitUntilExit: wait2 } = render(
    <TestApp testCase={testCase1} mode="side-by-side" />
  );
  await wait2;

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Configuration file (unified)
  console.log('\n\n--- Test 3: Configuration File Diff ---\n');
  const { waitUntilExit: wait3 } = render(
    <TestApp testCase={testCase2} mode="unified" />
  );
  await wait3;

  console.log('\n\n='.repeat(80));
  console.log('All tests completed!');
  console.log('='.repeat(80));
  console.log('\nDiffView Component Features:');
  console.log('  ✅ Unified diff view');
  console.log('  ✅ Side-by-side diff view');
  console.log('  ✅ Line numbers');
  console.log('  ✅ Color highlighting (add/delete/modify)');
  console.log('  ✅ Context lines');
  console.log('  ✅ Hunk grouping');
  console.log('  ✅ Statistics display');
  console.log('\nFor more examples, see: src/ui/components/DiffView.example.tsx');
  console.log('For documentation, see: src/ui/components/DiffView.README.md\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
