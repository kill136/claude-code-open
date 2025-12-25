/**
 * Message 组件演示
 * 展示各种 Message 组件的使用场景
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Message } from '../src/ui/components/Message.js';
import type { ContentBlock } from '../src/types/index.js';

const MessageDemo: React.FC = () => {
  const [step, setStep] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');

  // 演示数据
  const demos = [
    {
      title: '1. 基础用户消息',
      component: (
        <Message
          role="user"
          content="你好，Claude！请帮我分析这个代码库。"
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '2. 基础助手消息',
      component: (
        <Message
          role="assistant"
          content="你好！我是 Claude，很高兴帮助你分析代码库。"
          timestamp={new Date()}
          model="claude-sonnet-4-20250514"
        />
      ),
    },
    {
      title: '3. Markdown 渲染',
      component: (
        <Message
          role="assistant"
          content={`
# 代码库分析结果

我已经分析了你的代码库，以下是主要发现：

## 架构概述

这是一个 TypeScript 项目，主要包含以下模块：

- **core/** - 核心引擎
- **tools/** - 工具系统
- **ui/** - 用户界面

## 代码示例

\`\`\`typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}
\`\`\`

## 建议

1. 添加更多单元测试
2. 优化错误处理
3. 改进文档
          `}
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '4. 流式渲染',
      component: (
        <Message
          role="assistant"
          content="这是一个流式渲染的消息示例。你可以看到文本像打字一样逐字符出现。这提供了更好的用户体验，让 AI 的回复看起来更自然。"
          timestamp={new Date()}
          streaming={true}
          streamSpeed={30}
          onComplete={() => console.log('流式渲染完成！')}
        />
      ),
    },
    {
      title: '5. 工具调用展示',
      component: (
        <Message
          role="assistant"
          content={[
            {
              type: 'text',
              text: '我将使用 Read 工具来读取你的配置文件。',
            },
            {
              type: 'tool_use',
              id: 'tool_abc123',
              name: 'Read',
              input: {
                file_path: '/home/user/project/config.json',
              },
            },
            {
              type: 'tool_result',
              tool_use_id: 'tool_abc123',
              content: JSON.stringify(
                {
                  name: 'my-project',
                  version: '1.0.0',
                  dependencies: {
                    react: '^18.2.0',
                    typescript: '^5.0.0',
                  },
                },
                null,
                2
              ),
            },
            {
              type: 'text',
              text: '配置文件读取成功！这是一个 React 项目。',
            },
          ] as ContentBlock[]}
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '6. 系统消息',
      component: (
        <Message
          role="system"
          content="会话已保存到 ~/.claude/sessions/abc-123.json"
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '7. 错误消息',
      component: (
        <Message
          role="error"
          content="无法连接到 Anthropic API。请检查你的网络连接和 API 密钥。"
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '8. 代码块高亮',
      component: (
        <Message
          role="assistant"
          content={`
这是一个 Python 函数示例：

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# 计算前 10 个斐波那契数
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
\`\`\`

这个递归实现很简洁，但效率不高。
          `}
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '9. 列表渲染',
      component: (
        <Message
          role="assistant"
          content={`
我建议你采取以下步骤：

- 首先运行测试确保代码质量
- 然后更新文档
- 最后提交你的更改
- 创建 Pull Request

每一步都很重要！
          `}
          timestamp={new Date()}
        />
      ),
    },
    {
      title: '10. 带复制提示的消息',
      component: (
        <Message
          role="assistant"
          content="这是一段重要的信息，你可能需要复制它。"
          timestamp={new Date()}
          showCopyHint={true}
        />
      ),
    },
  ];

  // 自动切换演示
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => (prev + 1) % demos.length);
    }, 8000); // 每 8 秒切换一次

    return () => clearInterval(timer);
  }, [demos.length]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          Message 组件演示 - {demos[step].title}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          演示进度: {step + 1} / {demos.length} (自动切换中...)
        </Text>
      </Box>

      {demos[step].component}

      <Box marginTop={2} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor italic>
          提示: 演示会自动循环。按 Ctrl+C 退出。
        </Text>
      </Box>
    </Box>
  );
};

// 渲染演示
console.clear();
render(<MessageDemo />);

// 导出以供其他地方使用
export default MessageDemo;
