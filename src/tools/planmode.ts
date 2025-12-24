/**
 * 计划模式工具
 * EnterPlanMode 和 ExitPlanMode
 */

import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition, ExitPlanModeInput } from '../types/index.js';

// 计划模式状态管理
let planModeActive = false;
let currentPlanFile: string | null = null;

export function isPlanModeActive(): boolean {
  return planModeActive;
}

export function getPlanFile(): string | null {
  return currentPlanFile;
}

export function setPlanMode(active: boolean, planFile?: string): void {
  planModeActive = active;
  currentPlanFile = planFile || null;
}

export class EnterPlanModeTool extends BaseTool<Record<string, unknown>, ToolResult> {
  name = 'EnterPlanMode';
  description = `Use this tool when you encounter a complex task that requires careful planning and exploration before implementation.

## When to Use This Tool

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
   - If you would use AskUserQuestion to clarify the approach, consider EnterPlanMode instead
   - Plan mode lets you explore first, then present options with context

## When NOT to Use This Tool

Do NOT use EnterPlanMode for:
- Simple, straightforward tasks with obvious implementation
- Small bug fixes where the solution is clear
- Adding a single function or small feature
- Tasks you're already confident how to implement
- Research-only tasks (use the Task tool with explore agent instead)

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using Glob, Grep, and Read tools
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Present your plan to the user for approval
5. Use AskUserQuestion if you need to clarify approaches
6. Exit plan mode with ExitPlanMode when ready to implement

## Examples

### GOOD - Use EnterPlanMode:
User: "Add user authentication to the app"
- This requires architectural decisions (session vs JWT, where to store tokens, middleware structure)

User: "Optimize the database queries"
- Multiple approaches possible, need to profile first, significant impact

User: "Implement dark mode"
- Architectural decision on theme system, affects many components

### BAD - Don't use EnterPlanMode:
User: "Fix the typo in the README"
- Straightforward, no planning needed

User: "Add a console.log to debug this function"
- Simple, obvious implementation

User: "What files handle routing?"
- Research task, not implementation planning

## Important Notes

- This tool REQUIRES user approval - they must consent to entering plan mode
- Be thoughtful about when to use it - unnecessary plan mode slows down simple tasks
- If unsure whether to use it, err on the side of starting implementation
- You can always ask the user "Would you like me to plan this out first?"`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  async execute(_input: Record<string, unknown>): Promise<ToolResult> {
    if (planModeActive) {
      return {
        success: false,
        error: 'Already in plan mode. Use ExitPlanMode to exit first.',
      };
    }

    planModeActive = true;

    // Generate plan file path
    const planPath = process.cwd() + '/PLAN.md';
    currentPlanFile = planPath;

    return {
      success: true,
      output: `Entered plan mode.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind) EXCEPT the plan file
- Modifying existing files (no Edit operations) EXCEPT the plan file
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to explore the codebase and design implementation plans. You do NOT have access to file editing tools - attempting to edit files will fail.

## Plan File Info:
No plan file exists yet. You should create your plan at ${planPath} using the Write tool.
You should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns
2. Identify similar features and architectural approaches
3. Consider multiple approaches and their trade-offs
4. Use AskUserQuestion if you need to clarify the approach
5. Design a concrete implementation strategy
6. When ready, use ExitPlanMode to present your plan for approval

Focus on understanding the problem before proposing solutions.`,
    };
  }
}

export class ExitPlanModeTool extends BaseTool<ExitPlanModeInput, ToolResult> {
  name = 'ExitPlanMode';
  description = `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user to review and approve
- The user will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Handling Ambiguity in Plans
Before using this tool, ensure your plan is clear and unambiguous. If there are multiple valid approaches or unclear requirements:
1. Use the AskUserQuestion tool to clarify with the user
2. Ask about specific implementation choices (e.g., architectural patterns, which library to use)
3. Clarify any assumptions that could affect the implementation
4. Edit your plan file to incorporate user feedback
5. Only proceed with ExitPlanMode after resolving ambiguities and updating the plan file

## Examples

1. Initial task: "Search for and understand the implementation of vim mode in the codebase" - Do not use the exit plan mode tool because you are not planning the implementation steps of a task.
2. Initial task: "Help me implement yank mode for vim" - Use the exit plan mode tool after you have finished planning the implementation steps of the task.
3. Initial task: "Add a new feature to handle user authentication" - If unsure about auth method (OAuth, JWT, etc.), use AskUserQuestion first, then use exit plan mode tool after clarifying the approach.`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  async execute(_input: ExitPlanModeInput): Promise<ToolResult> {
    if (!planModeActive) {
      return {
        success: false,
        error: 'Not in plan mode. Use EnterPlanMode first.',
      };
    }

    planModeActive = false;
    const planFile = currentPlanFile;
    currentPlanFile = null;

    let planContent = '';
    if (planFile) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(planFile)) {
          planContent = fs.readFileSync(planFile, 'utf-8');
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    const output = planFile
      ? `Exited plan mode.

Your plan has been saved to: ${planFile}
You can refer back to it if needed during implementation.

## Approved Plan:
${planContent}

Awaiting user approval to proceed with implementation.`
      : `Exited plan mode. Awaiting user approval to proceed with implementation.`;

    return {
      success: true,
      output,
    };
  }
}
