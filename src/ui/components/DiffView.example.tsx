/**
 * DiffView 组件使用示例
 *
 * 本文件展示了如何在不同场景下使用 DiffView 组件
 */

import React from 'react';
import { render } from 'ink';
import { DiffView } from './DiffView.js';

// 示例 1: 基本的统一视图（Unified Diff）
export function UnifiedDiffExample() {
  const oldContent = `function hello() {
  console.log('Hello World');
  return true;
}`;

  const newContent = `function hello(name) {
  console.log('Hello ' + name);
  console.log('Welcome!');
  return true;
}`;

  return (
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName="hello.js"
      mode="unified"
      language="javascript"
    />
  );
}

// 示例 2: 并排视图（Side-by-Side Diff）
export function SideBySideDiffExample() {
  const oldContent = `import React from 'react';

export const Component = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};`;

  const newContent = `import React, { useState } from 'react';

export const Component = () => {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  return (
    <div>
      <p>Count: {count}</p>
      <p>Name: {name}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name"
      />
    </div>
  );
};`;

  return (
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName="Component.tsx"
      mode="side-by-side"
      language="typescript"
      maxWidth={140}
    />
  );
}

// 示例 3: 配置文件差异
export function ConfigDiffExample() {
  const oldConfig = `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "express": "^4.18.0"
  },
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  }
}`;

  const newConfig = `{
  "name": "my-app",
  "version": "1.1.0",
  "dependencies": {
    "react": "^18.2.0",
    "express": "^4.18.0",
    "axios": "^1.4.0"
  },
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "webpack"
  }
}`;

  return (
    <DiffView
      oldContent={oldConfig}
      newContent={newConfig}
      fileName="package.json"
      mode="unified"
      contextLines={2}
      language="json"
    />
  );
}

// 示例 4: 无行号显示
export function NoLineNumbersExample() {
  const oldText = `First line
Second line
Third line`;

  const newText = `First line
Modified second line
Third line
Fourth line`;

  return (
    <DiffView
      oldContent={oldText}
      newContent={newText}
      fileName="notes.txt"
      showLineNumbers={false}
      contextLines={1}
    />
  );
}

// 示例 5: 大文件差异（较多上下文行）
export function LargeFileDiffExample() {
  const oldCode = Array(50)
    .fill(0)
    .map((_, i) => `Line ${i + 1}: This is some content`)
    .join('\n');

  const lines = oldCode.split('\n');
  lines[25] = 'Line 26: This line was modified';
  lines.splice(30, 0, 'Line 30.5: This is a new line');
  const newCode = lines.join('\n');

  return (
    <DiffView
      oldContent={oldCode}
      newContent={newCode}
      fileName="large-file.txt"
      mode="unified"
      contextLines={5}
      maxWidth={100}
    />
  );
}

// 示例 6: 完全不同的文件
export function CompleteRewriteExample() {
  const oldContent = `class OldImplementation {
  constructor() {
    this.data = [];
  }

  addItem(item) {
    this.data.push(item);
  }
}`;

  const newContent = `// Modern implementation using functional approach
export function createStore() {
  let data = [];

  return {
    add: (item) => data.push(item),
    get: () => [...data],
    clear: () => data = []
  };
}`;

  return (
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName="store.js"
      mode="side-by-side"
      language="javascript"
    />
  );
}

// 主渲染函数
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n=== Example 1: Unified Diff ===');
  render(<UnifiedDiffExample />);

  setTimeout(() => {
    console.log('\n\n=== Example 2: Side-by-Side Diff ===');
    render(<SideBySideDiffExample />);
  }, 2000);
}

// 使用说明
export const USAGE_NOTES = `
DiffView 组件使用说明
====================

基本用法:
---------
import { DiffView } from './ui/components/DiffView';

<DiffView
  oldContent={originalText}
  newContent={modifiedText}
  fileName="example.js"
/>

属性说明:
---------
- oldContent (string, 必需): 原始内容
- newContent (string, 必需): 修改后的内容
- fileName (string, 可选): 文件名，显示在顶部
- mode ('unified' | 'side-by-side', 默认: 'unified'): 显示模式
  * unified: 统一视图，类似 git diff
  * side-by-side: 并排视图，左右对比
- contextLines (number, 默认: 3): 显示的上下文行数
- showLineNumbers (boolean, 默认: true): 是否显示行号
- language (string, 可选): 编程语言（用于未来的语法高亮）
- maxWidth (number, 默认: 120): 最大显示宽度

使用场景:
---------
1. 文件编辑预览: 在应用编辑前显示差异
2. Git 差异展示: 显示提交或分支之间的差异
3. 配置文件对比: 比较不同环境的配置
4. 代码审查: 在终端中进行代码审查
5. 文档变更追踪: 查看文档的修订历史

性能注意事项:
-------------
- 对于超大文件（>1000 行），考虑增加 contextLines 来减少显示的内容
- maxWidth 会截断过长的行，避免终端显示问题
- 统一视图通常比并排视图更节省空间

集成示例:
---------
// 在 Edit 工具中使用
import { DiffView } from '../ui/components/DiffView';

async function previewEdit(filePath, oldContent, newContent) {
  const { render } = await import('ink');

  render(
    <DiffView
      oldContent={oldContent}
      newContent={newContent}
      fileName={filePath}
      mode="unified"
    />
  );

  const answer = await prompt('Apply these changes? (y/n)');
  return answer === 'y';
}
`;
