/**
 * 开发命令 - review, plan, feedback, pr-comments, security-review
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';

// /review - 代码审查
export const reviewCommand: SlashCommand = {
  name: 'review',
  aliases: ['code-review', 'cr'],
  description: 'Review a pull request or code changes',
  usage: '/review [pr-number]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const prNumber = args[0];

    // 基于官方源码的代码审查提示
    const reviewPrompt = `You are an expert code reviewer. Follow these steps:

${!prNumber ? `1. Use Bash("gh pr list") to show open pull requests` : `1. Use Bash("gh pr view ${prNumber}") to get PR details`}
${!prNumber ? `2. Ask which PR to review` : `2. Use Bash("gh pr diff ${prNumber}") to get the diff`}
${!prNumber ? `` : `3. Analyze the changes and provide a thorough code review that includes:
   - Overview of what the PR does
   - Analysis of code quality and style
   - Specific suggestions for improvements
   - Any potential issues or risks`}

Keep your review concise but thorough. Focus on:
  - Code correctness
  - Following project conventions
  - Performance implications
  - Test coverage
  - Security considerations

Format your review with clear sections and bullet points.
${prNumber ? `\nPR number: ${prNumber}` : ''}`;

    ctx.ui.addMessage('user', reviewPrompt);
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

    // 基于官方源码的完整计划模式提示
    const planPrompt = `You should now enter plan mode to handle this request.

${args.length > 0 ? `Task: ${args.join(' ')}

` : ''}Use the EnterPlanMode tool to begin planning.

## What is Plan Mode?

Plan Mode is designed for complex tasks that require careful planning and exploration before implementation.

## When to Use Plan Mode

Use EnterPlanMode when ANY of these conditions apply:

1. **Multiple Valid Approaches**: The task can be solved in several different ways, each with trade-offs
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

2. **Significant Architectural Decisions**: The task requires choosing between architectural patterns
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

3. **Large-Scale Changes**: The task touches many files or systems
   - Example: "Refactor the authentication system"
   - Example: "Migrate from REST to GraphQL"

4. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

5. **User Input Needed**: You'll need to ask clarifying questions before starting
   - Plan mode lets you explore first, then present options with context

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using Glob, Grep, and Read tools
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Write your plan to a plan file (the ONLY file you can edit in plan mode)
5. Use AskUserQuestion if you need to clarify approaches
6. Exit plan mode with ExitPlanMode when ready to implement

## Important Notes

- Plan mode is READ-ONLY: You cannot modify any files except the plan file
- You must thoroughly explore the codebase before writing your plan
- Your plan should be concise enough to scan quickly, but detailed enough to execute effectively
- Include the paths of critical files to be modified in your plan
- Only exit plan mode when you have a complete, actionable plan`;

    ctx.ui.addMessage('user', planPrompt);
    return { success: true };
  },
};

// /feedback - 反馈 (基于官方 v2.0.59 源码实现)
export const feedbackCommand: SlashCommand = {
  name: 'feedback',
  description: 'Submit feedback or bug report to Anthropic',
  usage: '/feedback [message]',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    const { args, config } = ctx;

    // 官方 GitHub issues URL 和反馈 API
    const ISSUES_URL = 'https://github.com/anthropics/claude-code/issues';
    const FEEDBACK_API = 'https://api.anthropic.com/api/claude_cli_feedback';

    if (args.length > 0) {
      const feedbackMessage = args.join(' ');

      // 收集环境信息 (基于官方实现)
      const environmentInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        version: config.version || '2.0.76',
        terminal: process.env.TERM || process.env.TERM_PROGRAM || 'unknown',
        datetime: new Date().toISOString(),
      };

      // 生成简短的 issue 标题 (官方使用 LLM 生成,这里简化处理)
      let issueTitle = feedbackMessage.split('\n')[0] || '';
      if (issueTitle.length > 60) {
        const truncated = issueTitle.slice(0, 60);
        const lastSpace = truncated.lastIndexOf(' ');
        issueTitle = (lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated) + '...';
      }
      if (issueTitle.length < 10) {
        issueTitle = 'Feedback / Bug Report';
      }

      // 生成 GitHub issue URL (基于官方实现的格式)
      const encodedTitle = encodeURIComponent(`[Feedback] ${issueTitle}`);
      const issueBody = `**Feedback / Bug Description**
${feedbackMessage}

**Environment Info**
- Platform: ${environmentInfo.platform}
- Node: ${environmentInfo.nodeVersion}
- Version: ${environmentInfo.version}
- Terminal: ${environmentInfo.terminal}
- Date: ${environmentInfo.datetime}

**Source**
Submitted via /feedback command in Claude Code CLI

---
*This issue was auto-generated from the /feedback command*`;

      const encodedBody = encodeURIComponent(issueBody);
      const githubIssueUrl = `${ISSUES_URL}/new?title=${encodedTitle}&body=${encodedBody}&labels=user-feedback`;

      const response = `Thank you for your feedback!

"${feedbackMessage}"

Your feedback helps improve Claude Code.

**Next Steps:**

1. Your feedback has been formatted as a GitHub issue
2. Open this URL in your browser to submit:

   ${githubIssueUrl}

3. Or manually visit: ${ISSUES_URL}

**What's included:**
  ✓ Your feedback message
  ✓ Environment information (platform, version, terminal)
  ✓ Timestamp

The GitHub issue has been pre-filled - you just need to submit it.

**Alternative:**
If you prefer, you can also:
  - Email: Not available (use GitHub issues)
  - Report bugs: Use /bug command (coming soon)
  - API feedback endpoint: ${FEEDBACK_API} (requires API key)`;

      ctx.ui.addMessage('assistant', response);
      ctx.ui.addActivity('Feedback prepared - check message for GitHub URL');

      return { success: true };
    }

    // 无参数时显示使用说明
    const feedbackInfo = `Submit Feedback / Bug Report

Based on official Claude Code v2.0.59 implementation.

**Usage:**
  /feedback <your message>

**Examples:**
  /feedback The new feature works great!
  /feedback Found a bug with file editing
  /feedback Feature request: add support for TypeScript 5.3

**What gets included:**
  ✓ Your feedback message
  ✓ Environment info (platform, Node version, terminal)
  ✓ Claude Code version
  ✓ Timestamp

**Types of feedback welcome:**
  • Feature requests
  • Bug reports
  • General feedback
  • Improvement suggestions
  • Documentation issues

**How it works:**
  1. Run: /feedback <your message>
  2. A pre-filled GitHub issue URL will be generated
  3. Copy the URL to your browser
  4. Submit the issue on GitHub

**Channels:**
  • GitHub Issues: ${ISSUES_URL}
  • Feedback API: ${FEEDBACK_API}
  • Community: https://discord.gg/anthropic

We read all feedback and use it to improve Claude Code!`;

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

// /security-review - 安全审查 (基于官方 v2.0.59 源码完整实现)
export const securityReviewCommand: SlashCommand = {
  name: 'security-review',
  aliases: ['security', 'sec'],
  description: 'Complete a security review of the pending changes on the current branch',
  usage: '/security-review',
  category: 'development',
  execute: (ctx: CommandContext): CommandResult => {
    // 基于官方源码的完整安全审查 prompt
    const securityReviewPrompt = `You are a senior security engineer conducting a focused security review of the changes on this branch.

GIT STATUS:

\`\`\`
!Bash("git status")
\`\`\`

FILES MODIFIED:

\`\`\`
!Bash("git diff --name-only origin/HEAD...")
\`\`\`

COMMITS:

\`\`\`
!Bash("git log --no-decorate origin/HEAD...")
\`\`\`

DIFF CONTENT:

\`\`\`
!Bash("git diff --merge-base origin/HEAD")
\`\`\`

Review the complete diff above. This contains all code changes in the PR.


OBJECTIVE:
Perform a security-focused code review to identify HIGH-CONFIDENCE security vulnerabilities that could have real exploitation potential. This is not a general code review - focus ONLY on security implications newly added by this PR. Do not comment on existing security concerns.

CRITICAL INSTRUCTIONS:
1. MINIMIZE FALSE POSITIVES: Only flag issues where you're >80% confident of actual exploitability
2. AVOID NOISE: Skip theoretical issues, style concerns, or low-impact findings
3. FOCUS ON IMPACT: Prioritize vulnerabilities that could lead to unauthorized access, data breaches, or system compromise
4. EXCLUSIONS: Do NOT report the following issue types:
   - Denial of Service (DOS) vulnerabilities, even if they allow service disruption
   - Secrets or sensitive data stored on disk (these are handled by other processes)
   - Rate limiting or resource exhaustion issues

SECURITY CATEGORIES TO EXAMINE:

**Input Validation Vulnerabilities:**
- SQL injection via unsanitized user input
- Command injection in system calls or subprocesses
- XXE injection in XML parsing
- Template injection in templating engines
- NoSQL injection in database queries
- Path traversal in file operations

**Authentication & Authorization Issues:**
- Authentication bypass logic
- Privilege escalation paths
- Session management flaws
- JWT token vulnerabilities
- Authorization logic bypasses

**Crypto & Secrets Management:**
- Hardcoded API keys, passwords, or tokens
- Weak cryptographic algorithms or implementations
- Improper key storage or management
- Cryptographic randomness issues
- Certificate validation bypasses

**Injection & Code Execution:**
- Remote code execution via deserialization
- Pickle injection in Python
- YAML deserialization vulnerabilities
- Eval injection in dynamic code execution
- XSS vulnerabilities in web applications (reflected, stored, DOM-based)

**Data Exposure:**
- Sensitive data logging or storage
- PII handling violations
- API endpoint data leakage
- Debug information exposure

Additional notes:
- Even if something is only exploitable from the local network, it can still be a HIGH severity issue

ANALYSIS METHODOLOGY:

Phase 1 - Repository Context Research (Use file search tools):
- Identify existing security frameworks and libraries in use
- Look for established secure coding patterns in the codebase
- Examine existing sanitization and validation patterns
- Understand the project's security model and threat model

Phase 2 - Comparative Analysis:
- Compare new code changes against existing security patterns
- Identify deviations from established secure practices
- Look for inconsistent security implementations
- Flag code that introduces new attack surfaces

Phase 3 - Vulnerability Assessment:
- Examine each modified file for security implications
- Trace data flow from user inputs to sensitive operations
- Look for privilege boundaries being crossed unsafely
- Identify injection points and unsafe deserialization

REQUIRED OUTPUT FORMAT:

You MUST output your findings in markdown. The markdown output should contain the file, line number, severity, category (e.g. \`sql_injection\` or \`xss\`), description, exploit scenario, and fix recommendation.

For example:

# Vuln 1: XSS: \`foo.py:42\`

* Severity: High
* Description: User input from \`username\` parameter is directly interpolated into HTML without escaping, allowing reflected XSS attacks
* Exploit Scenario: Attacker crafts URL like /bar?q=<script>alert(document.cookie)</script> to execute JavaScript in victim's browser, enabling session hijacking or data theft
* Recommendation: Use Flask's escape() function or Jinja2 templates with auto-escaping enabled for all user inputs rendered in HTML

SEVERITY GUIDELINES:
- **HIGH**: Directly exploitable vulnerabilities leading to RCE, data breach, or authentication bypass
- **MEDIUM**: Vulnerabilities requiring specific conditions but with significant impact
- **LOW**: Defense-in-depth issues or lower-impact vulnerabilities

CONFIDENCE SCORING:
- 0.9-1.0: Certain exploit path identified, tested if possible
- 0.8-0.9: Clear vulnerability pattern with known exploitation methods
- 0.7-0.8: Suspicious pattern requiring specific conditions to exploit
- Below 0.7: Don't report (too speculative)

FINAL REMINDER:
Focus on HIGH and MEDIUM findings only. Better to miss some theoretical issues than flood the report with false positives. Each finding should be something a security engineer would confidently raise in a PR review.

FALSE POSITIVE FILTERING:

> You do not need to run commands to reproduce the vulnerability, just read the code to determine if it is a real vulnerability. Do not use the bash tool or write to any files.
>
> HARD EXCLUSIONS - Automatically exclude findings matching these patterns:
> 1. Denial of Service (DOS) vulnerabilities or resource exhaustion attacks.
> 2. Secrets or credentials stored on disk if they are otherwise secured.
> 3. Rate limiting concerns or service overload scenarios.
> 4. Memory consumption or CPU exhaustion issues.
> 5. Lack of input validation on non-security-critical fields without proven security impact.
> 6. Input sanitization concerns for GitHub Action workflows unless they are clearly triggerable via untrusted input.
> 7. A lack of hardening measures. Code is not expected to implement all security best practices, only flag concrete vulnerabilities.
> 8. Race conditions or timing attacks that are theoretical rather than practical issues. Only report a race condition if it is concretely problematic.
> 9. Vulnerabilities related to outdated third-party libraries. These are managed separately and should not be reported here.
> 10. Memory safety issues such as buffer overflows or use-after-free-vulnerabilities are impossible in rust. Do not report memory safety issues in rust or any other memory safe languages.
> 11. Files that are only unit tests or only used as part of running tests.
> 12. Log spoofing concerns. Outputting un-sanitized user input to logs is not a vulnerability.
> 13. SSRF vulnerabilities that only control the path. SSRF is only a concern if it can control the host or protocol.
> 14. Including user-controlled content in AI system prompts is not a vulnerability.
> 15. Regex injection. Injecting untrusted content into a regex is not a vulnerability.
> 16. Regex DOS concerns.
> 17. Insecure documentation. Do not report any findings in documentation files such as markdown files.
> 18. A lack of audit logs is not a vulnerability.
>
> PRECEDENTS -
> 1. Logging high value secrets in plaintext is a vulnerability. Logging URLs is assumed to be safe.
> 2. UUIDs can be assumed to be unguessable and do not need to be validated.
> 3. Environment variables and CLI flags are trusted values. Attackers are generally not able to modify them in a secure environment. Any attack that relies on controlling an environment variable is invalid.
> 4. Resource management issues such as memory or file descriptor leaks are not valid.
> 5. Subtle or low impact web vulnerabilities such as tabnabbing, XS-Leaks, prototype pollution, and open redirects should not be reported unless they are extremely high confidence.
> 6. React and Angular are generally secure against XSS. These frameworks do not need to sanitize or escape user input unless it is using dangerouslySetInnerHTML, bypassSecurityTrustHtml, or similar methods. Do not report XSS vulnerabilities in React or Angular components or tsx files unless they are using unsafe methods.
> 7. Most vulnerabilities in github action workflows are not exploitable in practice. Before validating a github action workflow vulnerability ensure it is concrete and has a very specific attack path.
> 8. A lack of permission checking or authentication in client-side JS/TS code is not a vulnerability. Client-side code is not trusted and does not need to implement these checks, they are handled on the server-side. The same applies to all flows that send untrusted data to the backend, the backend is responsible for validating and sanitizing all inputs.
> 9. Only include MEDIUM findings if they are obvious and concrete issues.
> 10. Most vulnerabilities in ipython notebooks (*.ipynb files) are not exploitable in practice. Before validating a notebook vulnerability ensure it is concrete and has a very specific attack path where untrusted input can trigger the vulnerability.
> 11. Logging non-PII data is not a vulnerability even if the data may be sensitive. Only report logging vulnerabilities if they expose sensitive information such as secrets, passwords, or personally identifiable information (PII).
> 12. Command injection vulnerabilities in shell scripts are generally not exploitable in practice since shell scripts generally do not run with untrusted user input. Only report command injection vulnerabilities in shell scripts if they are concrete and have a very specific attack path for untrusted input.
>
> SIGNAL QUALITY CRITERIA - For remaining findings, assess:
> 1. Is there a concrete, exploitable vulnerability with a clear attack path?
> 2. Does this represent a real security risk vs theoretical best practice?
> 3. Are there specific code locations and reproduction steps?
> 4. Would this finding be actionable for a security team?
>
> For each finding, assign a confidence score from 1-10:
> - 1-3: Low confidence, likely false positive or noise
> - 4-6: Medium confidence, needs investigation
> - 7-10: High confidence, likely true vulnerability

START ANALYSIS:

Begin your analysis now. Do this in 3 steps:

1. Use a sub-task to identify vulnerabilities. Use the repository exploration tools to understand the codebase context, then analyze the PR changes for security implications. In the prompt for this sub-task, include all of the above.
2. Then for each vulnerability identified by the above sub-task, create a new sub-task to filter out false-positives. Launch these sub-tasks as parallel sub-tasks. In the prompt for these sub-tasks, include everything in the "FALSE POSITIVE FILTERING" instructions.
3. Filter out any vulnerabilities where the sub-task reported a confidence less than 8.

Your final reply must contain the markdown report and nothing else.`;

    ctx.ui.addMessage('user', securityReviewPrompt);
    ctx.ui.addActivity('Starting security review of branch changes');
    return { success: true };
  },
};

// /release-notes - 发布说明 (基于官方 v2.0.59 源码实现)
export const releaseNotesCommand: SlashCommand = {
  name: 'release-notes',
  aliases: ['changelog', 'whats-new'],
  description: 'View release notes for Claude Code',
  category: 'development',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      // 获取并解析 changelog (基于官方实现)
      const changelog = await fetchChangelog();
      const parsedNotes = parseChangelog(changelog);

      if (parsedNotes.length > 0) {
        const formattedNotes = formatReleaseNotes(parsedNotes);
        ctx.ui.addMessage('assistant', formattedNotes);
        return { success: true };
      }

      // 如果没有解析到版本信息，显示基本信息
      const fallbackInfo = `Claude Code Release Notes

Version: ${ctx.config.version}

Recent updates and features have been added.

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`;

      ctx.ui.addMessage('assistant', fallbackInfo);
      return { success: true };
    } catch (error) {
      // 错误处理：显示备用信息
      const errorInfo = `Claude Code - Version ${ctx.config.version}

Unable to fetch latest release notes at this time.

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`;

      ctx.ui.addMessage('assistant', errorInfo);
      return { success: true };
    }
  },
};

/**
 * 从 GitHub 获取 CHANGELOG.md
 * 基于官方 eW0() 函数实现
 */
async function fetchChangelog(): Promise<string> {
  // 如果设置了禁止非必要流量的环境变量，返回空字符串
  if (process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
    return '';
  }

  try {
    const CHANGELOG_URL =
      'https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md';

    // 使用 fetch API 获取 changelog
    const response = await fetch(CHANGELOG_URL, {
      headers: {
        'User-Agent': 'claude-code-cli',
      },
    });

    if (response.ok) {
      const text = await response.text();
      return text;
    }

    return '';
  } catch (error) {
    // 静默失败，返回空字符串
    return '';
  }
}

/**
 * 解析 changelog 文本为版本数组
 * 基于官方 wI1() 和 AX0() 函数实现
 */
function parseChangelog(changelog: string): Array<[string, string[]]> {
  if (!changelog) {
    return [];
  }

  try {
    const versionMap: Record<string, string[]> = {};

    // 按 ## 分割版本段落
    const sections = changelog.split(/^## /gm).slice(1);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      if (lines.length === 0) continue;

      const header = lines[0];
      if (!header) continue;

      // 提取版本号 (例如: "2.0.76 - 2024-01-15" -> "2.0.76")
      const version = header.split(' - ')[0]?.trim() || '';
      if (!version) continue;

      // 提取更新条目（以 "- " 开头的行）
      const updates = lines
        .slice(1)
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().substring(2).trim())
        .filter(Boolean);

      if (updates.length > 0) {
        versionMap[version] = updates;
      }
    }

    // 转换为数组并排序（最新版本在前）
    return Object.entries(versionMap)
      .sort(([a], [b]) => compareVersions(b, a))
      .slice(0, 5); // 只显示最近 5 个版本
  } catch (error) {
    return [];
  }
}

/**
 * 简单的版本比较函数
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;

    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }

  return 0;
}

/**
 * 格式化 release notes 输出
 * 基于官方 vK9() 函数实现
 */
function formatReleaseNotes(versions: Array<[string, string[]]>): string {
  const formatted = versions.map(([version, updates]) => {
    const versionHeader = `Version ${version}:`;
    const updateList = updates.map((update) => `• ${update}`).join('\n');
    return `${versionHeader}\n${updateList}`;
  });

  return `Claude Code Release Notes

${formatted.join('\n\n')}

See the full changelog at:
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`;
}

// 注册所有开发命令
export function registerDevelopmentCommands(): void {
  commandRegistry.register(reviewCommand);
  commandRegistry.register(planCommand);
  commandRegistry.register(feedbackCommand);
  commandRegistry.register(prCommentsCommand);
  commandRegistry.register(securityReviewCommand);
  commandRegistry.register(releaseNotesCommand);
}
