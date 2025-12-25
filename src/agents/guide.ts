/**
 * Claude Code Guide Agent
 *
 * 专门用于回答关于 Claude Code、Claude Agent SDK 和 Claude API 的问题
 */

import { BaseTool } from '../tools/base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

// 文档 URLs
const CLAUDE_CODE_DOCS_MAP = 'https://code.claude.com/docs/en/claude_code_docs_map.md';
const CLAUDE_API_DOCS = 'https://platform.claude.com/llms.txt';

/**
 * Guide 代理选项
 */
export interface GuideOptions {
  /** 用户查询内容 */
  query: string;
  /** 主题分类 */
  topic?: 'features' | 'hooks' | 'commands' | 'mcp' | 'sdk' | 'api' | 'general';
  /** 恢复之前的会话 */
  resume?: string;
}

/**
 * 代码示例
 */
export interface CodeExample {
  language: string;
  code: string;
  description: string;
}

/**
 * 文档链接
 */
export interface DocumentationLink {
  title: string;
  url: string;
  description: string;
}

/**
 * Guide 结果
 */
export interface GuideResult {
  answer: string;
  examples?: CodeExample[];
  relatedTopics?: string[];
  documentation?: DocumentationLink[];
}

/**
 * 文档数据库条目
 */
export interface Documentation {
  title: string;
  content: string;
  url: string;
  category: 'claude-code' | 'sdk' | 'api';
  keywords: string[];
}

/**
 * Guide 代理会话状态
 */
interface GuideSession {
  id: string;
  query: string;
  topic?: string;
  fetchedDocs: string[];
  searchedQueries: string[];
  intermediateResults: any[];
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
}

// 会话存储
const guideSessions = new Map<string, GuideSession>();

/**
 * 内置文档数据库
 *
 * 这里存储了常见问题的快速参考文档
 */
export const GUIDE_DOCUMENTATION: Record<string, Documentation> = {
  'claude-code-installation': {
    title: 'Installing Claude Code',
    content: `# Installing Claude Code

## Quick Installation

\`\`\`bash
npm install -g @anthropic-ai/claude-code
\`\`\`

## Requirements
- Node.js 18 or higher
- Anthropic API key

## Setup API Key

\`\`\`bash
# Set API key
export ANTHROPIC_API_KEY=your_api_key_here

# Or save to settings
claude auth
\`\`\`

## Verify Installation

\`\`\`bash
claude --version
\`\`\``,
    url: 'https://code.claude.com/docs/en/overview',
    category: 'claude-code',
    keywords: ['install', 'setup', 'getting started', 'npm', 'api key'],
  },

  'claude-code-hooks': {
    title: 'Claude Code Hooks',
    content: `# Hooks System

Hooks allow you to run scripts before or after Claude Code operations.

## Hook Locations
- \`.claude/hooks/\` - Project-specific hooks
- \`~/.claude/hooks/\` - Global hooks

## Available Hooks

### Session Hooks
- \`session-start\` - Runs when session starts
- \`session-end\` - Runs when session ends

### Tool Hooks
- \`pre-tool-<toolname>\` - Before tool execution
- \`post-tool-<toolname>\` - After tool execution

## Example Hook

\`.claude/hooks/session-start.sh\`:
\`\`\`bash
#!/bin/bash
# Run tests before starting
npm test
\`\`\`

Make executable:
\`\`\`bash
chmod +x .claude/hooks/session-start.sh
\`\`\``,
    url: 'https://code.claude.com/docs/en/hooks',
    category: 'claude-code',
    keywords: ['hooks', 'automation', 'pre-tool', 'post-tool', 'session'],
  },

  'claude-code-slash-commands': {
    title: 'Slash Commands (Skills)',
    content: `# Slash Commands (Skills)

Custom commands that extend Claude Code functionality.

## Creating a Slash Command

1. Create file in \`.claude/commands/\`
2. Name it \`mycommand.md\`
3. Add prompt content

Example \`.claude/commands/review.md\`:
\`\`\`markdown
# Review Code

Review the code changes in the current branch for:
- Code quality
- Best practices
- Potential bugs
- Performance issues
\`\`\`

## Using Slash Commands

\`\`\`bash
# In conversation
/review

# Or from CLI
claude /review
\`\`\`

## Command Locations
- \`.claude/commands/\` - Project-specific
- \`~/.claude/commands/\` - Global`,
    url: 'https://code.claude.com/docs/en/skills',
    category: 'claude-code',
    keywords: ['slash commands', 'skills', 'commands', 'custom prompts'],
  },

  'claude-code-mcp': {
    title: 'MCP Server Configuration',
    content: `# MCP Servers

Model Context Protocol (MCP) servers provide additional tools and context.

## Configuration

Add to \`~/.claude/settings.json\`:
\`\`\`json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
\`\`\`

## Using MCP Servers

Available MCP servers:
- filesystem - File system access
- github - GitHub integration
- postgres - Database access
- puppeteer - Web automation
- And more...

## CLI Commands

\`\`\`bash
# List configured servers
claude mcp list

# Add server
claude mcp add server-name

# Remove server
claude mcp remove server-name
\`\`\``,
    url: 'https://code.claude.com/docs/en/mcp',
    category: 'claude-code',
    keywords: ['mcp', 'servers', 'model context protocol', 'tools', 'integration'],
  },

  'agent-sdk-overview': {
    title: 'Claude Agent SDK Overview',
    content: `# Claude Agent SDK

Build custom AI agents using Claude Code technology.

## Installation

### TypeScript/Node.js
\`\`\`bash
npm install @anthropic-ai/agent-sdk
\`\`\`

### Python
\`\`\`bash
pip install anthropic-agent-sdk
\`\`\`

## Quick Start (TypeScript)

\`\`\`typescript
import { Agent } from '@anthropic-ai/agent-sdk';

const agent = new Agent({
  model: 'claude-sonnet-4',
  systemPrompt: 'You are a helpful assistant.',
  tools: ['Read', 'Write', 'Bash'],
});

await agent.run('Analyze this codebase');
\`\`\`

## Quick Start (Python)

\`\`\`python
from anthropic_agent import Agent

agent = Agent(
    model="claude-sonnet-4",
    system_prompt="You are a helpful assistant.",
    tools=["Read", "Write", "Bash"]
)

agent.run("Analyze this codebase")
\`\`\``,
    url: 'https://platform.claude.com/docs/agent-sdk',
    category: 'sdk',
    keywords: ['agent sdk', 'custom agents', 'typescript', 'python', 'api'],
  },

  'claude-api-messages': {
    title: 'Claude API Messages',
    content: `# Claude Messages API

Direct API access for Claude models.

## Basic Usage

\`\`\`typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
});

console.log(message.content);
\`\`\`

## Streaming

\`\`\`typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Write a story' }
  ],
});

for await (const chunk of stream) {
  console.log(chunk);
}
\`\`\``,
    url: 'https://platform.claude.com/docs/api/messages',
    category: 'api',
    keywords: ['messages api', 'claude api', 'streaming', 'anthropic sdk'],
  },

  'claude-api-tool-use': {
    title: 'Tool Use (Function Calling)',
    content: `# Tool Use

Enable Claude to use tools (function calling).

## Defining Tools

\`\`\`typescript
const tools = [{
  name: 'get_weather',
  description: 'Get weather for a location',
  input_schema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name'
      }
    },
    required: ['location']
  }
}];

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4',
  max_tokens: 1024,
  tools: tools,
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
});
\`\`\`

## Handling Tool Calls

\`\`\`typescript
if (message.stop_reason === 'tool_use') {
  const toolUse = message.content.find(block => block.type === 'tool_use');

  // Execute tool
  const result = await executeToolFunction(toolUse.name, toolUse.input);

  // Send result back
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    max_tokens: 1024,
    tools: tools,
    messages: [
      ...previousMessages,
      { role: 'assistant', content: message.content },
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result
        }]
      }
    ],
  });
}
\`\`\``,
    url: 'https://platform.claude.com/docs/api/tool-use',
    category: 'api',
    keywords: ['tool use', 'function calling', 'tools', 'api'],
  },
};

/**
 * Guide Agent 类
 */
export class GuideAgent {
  private options: GuideOptions;
  private sessionId: string;

  constructor(options: GuideOptions) {
    this.options = options;
    this.sessionId = options.resume || uuidv4();

    if (!options.resume) {
      // 创建新会话
      guideSessions.set(this.sessionId, {
        id: this.sessionId,
        query: options.query,
        topic: options.topic,
        fetchedDocs: [],
        searchedQueries: [],
        intermediateResults: [],
        startTime: new Date(),
        status: 'running',
      });
    }
  }

  /**
   * 回答用户问题
   */
  async answer(): Promise<GuideResult> {
    const session = guideSessions.get(this.sessionId);
    if (!session) {
      throw new Error(`Session ${this.sessionId} not found`);
    }

    try {
      // 1. 分类问题
      const category = this.categorizeQuery(this.options.query);

      // 2. 搜索内置文档
      const builtInDocs = this.searchBuiltInDocumentation(this.options.query);

      // 3. 构建回答
      const answer = this.buildAnswer(builtInDocs, category);

      // 4. 提取示例
      const examples = this.extractExamples(builtInDocs);

      // 5. 查找相关主题
      const relatedTopics = this.findRelatedTopics(category);

      // 6. 收集文档链接
      const documentation = builtInDocs.map(doc => ({
        title: doc.title,
        url: doc.url,
        description: doc.content.split('\n')[0].replace(/^#\s*/, ''),
      }));

      session.status = 'completed';

      return {
        answer,
        examples,
        relatedTopics,
        documentation,
      };
    } catch (error) {
      session.status = 'failed';
      throw error;
    }
  }

  /**
   * 搜索内置文档
   */
  async searchDocumentation(query: string): Promise<Documentation[]> {
    return this.searchBuiltInDocumentation(query);
  }

  /**
   * 获取主题示例
   */
  async getExamples(topic: string): Promise<CodeExample[]> {
    const docs = Object.values(GUIDE_DOCUMENTATION).filter(doc =>
      doc.keywords.includes(topic.toLowerCase())
    );

    return this.extractExamples(docs);
  }

  /**
   * 恢复之前的会话
   */
  async resume(previousId: string): Promise<GuideResult> {
    const session = guideSessions.get(previousId);
    if (!session) {
      throw new Error(`Session ${previousId} not found`);
    }

    this.sessionId = previousId;
    return this.answer();
  }

  // ============ 私有方法 ============

  /**
   * 分类查询
   */
  private categorizeQuery(query: string): 'claude-code' | 'sdk' | 'api' | 'general' {
    const lowerQuery = query.toLowerCase();

    // Claude Code CLI 相关
    if (
      lowerQuery.includes('install') ||
      lowerQuery.includes('hook') ||
      lowerQuery.includes('slash command') ||
      lowerQuery.includes('skill') ||
      lowerQuery.includes('mcp server') ||
      lowerQuery.includes('settings.json') ||
      lowerQuery.includes('claude code')
    ) {
      return 'claude-code';
    }

    // Agent SDK 相关
    if (
      lowerQuery.includes('agent sdk') ||
      lowerQuery.includes('custom agent') ||
      lowerQuery.includes('build agent') ||
      lowerQuery.includes('agent configuration')
    ) {
      return 'sdk';
    }

    // Claude API 相关
    if (
      lowerQuery.includes('api') ||
      lowerQuery.includes('messages') ||
      lowerQuery.includes('tool use') ||
      lowerQuery.includes('function calling') ||
      lowerQuery.includes('anthropic sdk')
    ) {
      return 'api';
    }

    return 'general';
  }

  /**
   * 搜索内置文档
   */
  private searchBuiltInDocumentation(query: string): Documentation[] {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ doc: Documentation; score: number }> = [];

    for (const doc of Object.values(GUIDE_DOCUMENTATION)) {
      let score = 0;

      // 关键词匹配
      for (const keyword of doc.keywords) {
        if (lowerQuery.includes(keyword)) {
          score += 10;
        }
      }

      // 标题匹配
      if (lowerQuery.includes(doc.title.toLowerCase())) {
        score += 20;
      }

      // 内容匹配
      if (doc.content.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }

      if (score > 0) {
        results.push({ doc, score });
      }
    }

    // 排序并返回
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(r => r.doc);
  }

  /**
   * 构建回答
   */
  private buildAnswer(docs: Documentation[], category: string): string {
    if (docs.length === 0) {
      return this.buildFallbackAnswer(category);
    }

    const parts: string[] = [];

    // 主要回答
    parts.push(`Based on the official documentation, here's what you need to know:\n`);

    for (const doc of docs) {
      parts.push(`## ${doc.title}\n`);
      parts.push(doc.content);
      parts.push(`\nFor more details, see: ${doc.url}\n`);
    }

    return parts.join('\n');
  }

  /**
   * 构建备选回答
   */
  private buildFallbackAnswer(category: string): string {
    const docUrls = {
      'claude-code': CLAUDE_CODE_DOCS_MAP,
      'sdk': CLAUDE_API_DOCS,
      'api': CLAUDE_API_DOCS,
      'general': CLAUDE_CODE_DOCS_MAP,
    };

    return `I don't have built-in documentation for this specific question, but you can find comprehensive information at:

${docUrls[category]}

For questions about Claude Code features, try asking about:
- Installation and setup
- Hooks and automation
- Slash commands (skills)
- MCP server configuration
- IDE integrations

For Agent SDK questions, ask about:
- Creating custom agents
- Tool configuration
- Session management

For Claude API questions, ask about:
- Messages API
- Tool use (function calling)
- Streaming responses

You can also report issues or request features at:
https://github.com/anthropics/claude-code/issues`;
  }

  /**
   * 提取代码示例
   */
  private extractExamples(docs: Documentation[]): CodeExample[] {
    const examples: CodeExample[] = [];

    for (const doc of docs) {
      const codeBlocks = doc.content.match(/```(\w+)\n([\s\S]*?)```/g) || [];

      for (const block of codeBlocks) {
        const match = block.match(/```(\w+)\n([\s\S]*?)```/);
        if (match) {
          const [, language, code] = match;

          // 找到代码块前的描述
          const blockIndex = doc.content.indexOf(block);
          const beforeBlock = doc.content.substring(0, blockIndex);
          const lines = beforeBlock.split('\n');
          const description = lines[lines.length - 1]?.trim() || doc.title;

          examples.push({
            language,
            code: code.trim(),
            description,
          });
        }
      }
    }

    return examples;
  }

  /**
   * 查找相关主题
   */
  private findRelatedTopics(category: string): string[] {
    const relatedMap: Record<string, string[]> = {
      'claude-code': [
        'Hooks and Automation',
        'Slash Commands (Skills)',
        'MCP Server Configuration',
        'IDE Integrations',
        'Settings and Configuration',
      ],
      'sdk': [
        'Custom Tool Development',
        'Agent Configuration',
        'Session Management',
        'MCP Integration',
        'Cost Tracking',
      ],
      'api': [
        'Messages API',
        'Tool Use (Function Calling)',
        'Streaming Responses',
        'Vision and PDF Support',
        'Structured Outputs',
      ],
      'general': [
        'Getting Started',
        'Basic Usage',
        'Best Practices',
      ],
    };

    return relatedMap[category] || relatedMap.general;
  }
}

/**
 * Guide Tool - 用于 Tool Registry
 */
export class GuideTool extends BaseTool<GuideOptions, ToolResult> {
  name = 'Guide';
  description = `Get help with Claude Code, Claude Agent SDK, or Claude API.

Usage:
- Ask questions about Claude Code features, configuration, hooks, skills, MCP servers
- Learn about building custom agents with the Agent SDK
- Get guidance on using the Claude API (Messages, Tool Use, etc.)

Examples:
- "How do I set up hooks in Claude Code?"
- "How do I create a slash command?"
- "How do I configure an MCP server?"
- "How do I build a custom agent with the SDK?"
- "How do I use tool calling in the Claude API?"`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Your question about Claude Code, Agent SDK, or Claude API',
        },
        topic: {
          type: 'string',
          enum: ['features', 'hooks', 'commands', 'mcp', 'sdk', 'api', 'general'],
          description: 'Optional topic category to narrow the search',
        },
        resume: {
          type: 'string',
          description: 'Optional session ID to resume from a previous query',
        },
      },
      required: ['query'],
    };
  }

  async execute(input: GuideOptions): Promise<ToolResult> {
    try {
      const agent = new GuideAgent(input);
      const result = await agent.answer();

      // 格式化输出
      const output: string[] = [];

      output.push(result.answer);
      output.push('');

      if (result.examples && result.examples.length > 0) {
        output.push('## Examples\n');
        for (const example of result.examples) {
          output.push(`### ${example.description}`);
          output.push(`\`\`\`${example.language}`);
          output.push(example.code);
          output.push('```\n');
        }
      }

      if (result.relatedTopics && result.relatedTopics.length > 0) {
        output.push('## Related Topics\n');
        for (const topic of result.relatedTopics) {
          output.push(`- ${topic}`);
        }
        output.push('');
      }

      if (result.documentation && result.documentation.length > 0) {
        output.push('## Documentation\n');
        for (const doc of result.documentation) {
          output.push(`- [${doc.title}](${doc.url})`);
          if (doc.description) {
            output.push(`  ${doc.description}`);
          }
        }
      }

      return {
        success: true,
        output: output.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        error: `Guide agent failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
