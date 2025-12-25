/**
 * ModelSelector 使用示例
 *
 * 运行方式:
 * tsx src/ui/components/ModelSelector.example.tsx
 */

import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import { ModelSelector } from './ModelSelector.js';

/**
 * 示例 1: 基本用法
 */
function BasicExample() {
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [isSelecting, setIsSelecting] = useState(true);

  if (!isSelecting) {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Model selected: {selectedModel}</Text>
        <Text color="gray" dimColor>
          Press any key to exit...
        </Text>
      </Box>
    );
  }

  return (
    <ModelSelector
      currentModel={selectedModel}
      onSelect={(model) => {
        setSelectedModel(model);
        setIsSelecting(false);
        // 1秒后退出
        setTimeout(() => process.exit(0), 1000);
      }}
      onCancel={() => {
        console.log('Selection cancelled');
        process.exit(0);
      }}
    />
  );
}

/**
 * 示例 2: 不显示定价
 */
function NoPricingExample() {
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-5-20251101');

  return (
    <ModelSelector
      currentModel={selectedModel}
      onSelect={(model) => {
        console.log('Selected:', model);
        process.exit(0);
      }}
      showPricing={false}
      title="Select a model (no pricing):"
    />
  );
}

/**
 * 示例 3: 不显示能力标签
 */
function NoCapabilitiesExample() {
  const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5-20250924');

  return (
    <ModelSelector
      currentModel={selectedModel}
      onSelect={(model) => {
        console.log('Selected:', model);
        process.exit(0);
      }}
      showCapabilities={false}
      title="Select a model (no capabilities):"
    />
  );
}

/**
 * 示例 4: 最简化版本
 */
function MinimalExample() {
  return (
    <ModelSelector
      currentModel="claude-sonnet-4-5-20250929"
      onSelect={(model) => {
        console.log('Selected:', model);
        process.exit(0);
      }}
      showPricing={false}
      showCapabilities={false}
      title="Choose a model:"
      hint="↑/↓ navigate · enter select"
    />
  );
}

// 根据命令行参数选择示例
const exampleType = process.argv[2] || 'basic';

let ExampleComponent;
switch (exampleType) {
  case 'no-pricing':
    ExampleComponent = NoPricingExample;
    break;
  case 'no-capabilities':
    ExampleComponent = NoCapabilitiesExample;
    break;
  case 'minimal':
    ExampleComponent = MinimalExample;
    break;
  default:
    ExampleComponent = BasicExample;
}

render(<ExampleComponent />);

console.log('\nAvailable examples:');
console.log('  tsx src/ui/components/ModelSelector.example.tsx');
console.log('  tsx src/ui/components/ModelSelector.example.tsx no-pricing');
console.log('  tsx src/ui/components/ModelSelector.example.tsx no-capabilities');
console.log('  tsx src/ui/components/ModelSelector.example.tsx minimal');
