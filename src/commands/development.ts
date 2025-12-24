/**
 * 开发命令 - review, plan, feedback, pr-comments, security-review
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';

// /review - 代码审查
export const reviewCommand: SlashCommand = {
  name: 'review',
  aliases: ['code-review', 'cr'],
  description: 'Request a code review',
  usage: '/review [file|pr] [path/number]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    if (args.length === 0) {
      const reviewInfo = `Code Review:

Usage:
  /review              - Review recent changes
  /review <file>       - Review specific file
  /review pr <number>  - Review a pull request

Examples:
  /review src/main.ts
  /review pr 123
  /review staged       - Review staged changes

Review focuses on:
  - Code quality
  - Best practices
  - Potential bugs
  - Security issues
  - Performance

For PR reviews, ensure GitHub App is installed:
  /install-github-app`;

      ctx.ui.addMessage('assistant', reviewInfo);
      return { success: true };
    }

    const target = args[0];
    if (target === 'pr') {
      const prNumber = args[1];
      ctx.ui.addMessage('assistant', `To review PR #${prNumber || '<number>'}:

1. Ensure GitHub App is installed
2. Ask: "Review PR #${prNumber || 'XXX'}"

Claude will analyze:
  - Changed files
  - Code quality
  - Potential issues
  - Suggest improvements`);
    } else {
      ctx.ui.addMessage('assistant', `To review ${target}:

Ask Claude: "Review the code in ${target}"

Or provide more context:
  "Review ${target} for security issues"
  "Review ${target} and suggest improvements"`);
    }

    return { success: true };
  },
};

// /plan - 规划模式
export const planCommand: SlashCommand = {
  name: 'plan',
  description: 'Enter planning mode for complex tasks',
  usage: '/plan [task description]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    const planInfo = `Planning Mode:

${args.length > 0 ? `Task: ${args.join(' ')}` : ''}

Planning mode helps with complex tasks by:
  1. Breaking down the task into steps
  2. Identifying dependencies
  3. Creating a structured approach
  4. No code execution until approved

Usage:
  /plan                    - Enter planning mode
  /plan <task>             - Plan specific task
  /plan approve            - Approve and execute plan
  /plan modify             - Modify the plan

In planning mode:
  - Claude analyzes the task
  - Creates step-by-step plan
  - Waits for approval
  - Then executes

Example:
  /plan Add user authentication to the app

This will create a plan including:
  - Database schema changes
  - API endpoints
  - Frontend components
  - Security considerations`;

    ctx.ui.addMessage('assistant', planInfo);
    return { success: true };
  },
};

// /feedback - 反馈
export const feedbackCommand: SlashCommand = {
  name: 'feedback',
  description: 'Send feedback about Claude Code',
  usage: '/feedback [message]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;

    if (args.length > 0) {
      const feedback = args.join(' ');
      ctx.ui.addMessage('assistant', `Thank you for your feedback:

"${feedback}"

Your feedback helps improve Claude Code.

Other ways to provide feedback:
  - GitHub Issues: https://github.com/anthropics/claude-code/issues
  - /bug for bug reports
  - Community Discord`);
      ctx.ui.addActivity('Submitted feedback');
      return { success: true };
    }

    const feedbackInfo = `Send Feedback:

Usage:
  /feedback <message>

Example:
  /feedback The new feature works great!
  /feedback I found a bug with file editing

Types of feedback:
  - Feature requests
  - Bug reports (/bug)
  - General comments
  - Suggestions

Where to submit:
  - GitHub: https://github.com/anthropics/claude-code/issues
  - In-app: /feedback <message>

We read all feedback and use it to improve Claude Code.`;

    ctx.ui.addMessage('assistant', feedbackInfo);
    return { success: true };
  },
};

// /pr-comments - PR 评论
export const prCommentsCommand: SlashCommand = {
  name: 'pr-comments',
  aliases: ['pr'],
  description: 'View or respond to PR comments',
  usage: '/pr-comments [pr-number]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const prNumber = args[0];

    const prInfo = `PR Comments:

${prNumber ? `PR #${prNumber}` : 'Usage: /pr-comments <pr-number>'}

Features:
  - View PR comments
  - Respond to reviews
  - Address feedback
  - Mark as resolved

Requirements:
  - GitHub App installed (/install-github-app)
  - Repository access

Commands:
  /pr-comments 123        - View comments on PR #123
  /pr-comments 123 reply  - Reply to comments

Integration:
  Claude can read PR comments and help you:
  - Understand feedback
  - Make suggested changes
  - Write responses

Example workflow:
  1. /pr-comments 123
  2. Claude shows the comments
  3. Ask Claude to address specific feedback
  4. Claude makes changes and responds`;

    ctx.ui.addMessage('assistant', prInfo);
    return { success: true };
  },
};

// /security-review - 安全审查
export const securityReviewCommand: SlashCommand = {
  name: 'security-review',
  aliases: ['security', 'sec'],
  description: 'Run a security review on code',
  usage: '/security-review [path]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;
    const target = args[0] || config.cwd;

    const securityInfo = `Security Review:

Target: ${target}

Security review checks for:

OWASP Top 10:
  - Injection vulnerabilities (SQL, XSS, Command)
  - Broken authentication
  - Sensitive data exposure
  - XML external entities
  - Broken access control
  - Security misconfiguration
  - Cross-site scripting (XSS)
  - Insecure deserialization
  - Known vulnerabilities
  - Insufficient logging

Code Analysis:
  - Hardcoded credentials
  - Unsafe dependencies
  - Insecure configurations
  - Missing input validation
  - Improper error handling

Usage:
  /security-review              - Review current directory
  /security-review src/         - Review specific path
  /security-review --detailed   - Detailed report

To start a security review, ask Claude:
  "Run a security review on this codebase"
  "Check for security vulnerabilities in src/"`;

    ctx.ui.addMessage('assistant', securityInfo);
    return { success: true };
  },
};

// /release-notes - 发布说明
export const releaseNotesCommand: SlashCommand = {
  name: 'release-notes',
  aliases: ['changelog', 'whats-new'],
  description: 'Show recent release notes and changes',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const releaseNotes = `Release Notes - Claude Code v${ctx.config.version}

Recent Updates:

v2.0.76:
  - Improved UI matching official Claude Code style
  - Added all slash commands
  - Better error handling
  - Performance improvements

v2.0.75:
  - Enhanced MCP support
  - New agent capabilities
  - Bug fixes

Features:
  - 25+ built-in tools
  - MCP server support
  - Plugin system
  - IDE integrations
  - Session management

Coming Soon:
  - More MCP servers
  - Enhanced planning mode
  - Team collaboration

Full changelog:
  https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`;

    ctx.ui.addMessage('assistant', releaseNotes);
    return { success: true };
  },
};

// 注册所有开发命令
export function registerDevelopmentCommands(): void {
  commandRegistry.register(reviewCommand);
  commandRegistry.register(planCommand);
  commandRegistry.register(feedbackCommand);
  commandRegistry.register(prCommentsCommand);
  commandRegistry.register(securityReviewCommand);
  commandRegistry.register(releaseNotesCommand);
}
