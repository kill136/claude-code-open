/**
 * Plan 代理 - 软件架构师
 * 用于设计实现计划，返回步骤化方案、识别关键文件、考虑架构权衡
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Plan 代理选项
 */
export interface PlanOptions {
  /** 任务描述 */
  task: string;
  /** 额外上下文信息 */
  context?: string;
  /** 技术约束条件 */
  constraints?: string[];
  /** 现有代码参考路径 */
  existingCode?: string[];
  /** 设计视角/方法论 */
  perspective?: string;
  /** 使用的模型 (默认继承) */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  /** 详细程度 */
  thoroughness?: 'quick' | 'medium' | 'thorough';
}

/**
 * 实现步骤
 */
export interface PlanStep {
  /** 步骤编号 */
  step: number;
  /** 步骤描述 */
  description: string;
  /** 涉及的文件列表 */
  files: string[];
  /** 复杂度评估 */
  complexity: 'low' | 'medium' | 'high';
  /** 依赖的前置步骤 */
  dependencies: number[];
  /** 预计耗时 (分钟) */
  estimatedMinutes?: number;
  /** 潜在风险 */
  risks?: string[];
}

/**
 * 关键文件信息
 */
export interface CriticalFile {
  /** 文件路径 */
  path: string;
  /** 文件作用说明 */
  reason: string;
  /** 重要程度 (1-5) */
  importance: number;
  /** 是否需要新建 */
  isNew?: boolean;
}

/**
 * 风险评估
 */
export interface Risk {
  /** 风险类别 */
  category: 'technical' | 'architectural' | 'compatibility' | 'performance' | 'security' | 'maintainability';
  /** 风险级别 */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** 风险描述 */
  description: string;
  /** 缓解措施 */
  mitigation?: string;
  /** 影响范围 */
  impact?: string[];
}

/**
 * 替代方案
 */
export interface Alternative {
  /** 方案名称 */
  name: string;
  /** 方案描述 */
  description: string;
  /** 优势 */
  pros: string[];
  /** 劣势 */
  cons: string[];
  /** 适用场景 */
  bestFor?: string;
  /** 是否推荐 */
  recommended?: boolean;
}

/**
 * 架构决策
 */
export interface ArchitecturalDecision {
  /** 决策点 */
  decision: string;
  /** 选择的方案 */
  chosen: string;
  /** 其他考虑过的方案 */
  alternatives: string[];
  /** 选择理由 */
  rationale: string;
  /** 权衡分析 */
  tradeoffs?: {
    benefits: string[];
    drawbacks: string[];
  };
}

/**
 * 需求分析结果
 */
export interface RequirementsAnalysis {
  /** 功能需求 */
  functionalRequirements: string[];
  /** 非功能需求 */
  nonFunctionalRequirements: string[];
  /** 技术约束 */
  technicalConstraints: string[];
  /** 成功标准 */
  successCriteria: string[];
  /** 范围外事项 */
  outOfScope?: string[];
  /** 假设条件 */
  assumptions?: string[];
}

/**
 * 完整的 Plan 结果
 */
export interface PlanResult {
  /** 计划摘要 */
  summary: string;
  /** 需求分析 */
  requirementsAnalysis: RequirementsAnalysis;
  /** 架构决策列表 */
  architecturalDecisions: ArchitecturalDecision[];
  /** 实现步骤 */
  steps: PlanStep[];
  /** 关键文件列表 (3-5个) */
  criticalFiles: CriticalFile[];
  /** 风险评估 */
  risks: Risk[];
  /** 替代方案 */
  alternatives: Alternative[];
  /** 总体复杂度评估 */
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  /** 预计总耗时 (小时) */
  estimatedHours?: number;
  /** 实现建议 */
  recommendations?: string[];
  /** 后续步骤 */
  nextSteps?: string[];
}

/**
 * Plan 代理类
 * 软件架构师代理，专注于设计实现计划
 */
export class PlanAgent {
  private options: PlanOptions;

  constructor(options: PlanOptions) {
    this.options = {
      model: 'inherit',
      thoroughness: 'medium',
      ...options,
    };
  }

  /**
   * 获取 Plan 代理的系统提示词
   */
  private getSystemPrompt(): string {
    const toolNames = {
      glob: 'Glob',
      grep: 'Grep',
      read: 'Read',
      bash: 'Bash',
    };

    return `You are a software architect and planning specialist for Claude Code. Your role is to explore the codebase and design implementation plans.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to explore the codebase and design implementation plans. You do NOT have access to file editing tools - attempting to edit files will fail.

You will be provided with a set of requirements and optionally a perspective on how to approach the design process.

## Your Process

1. **Understand Requirements**: Focus on the requirements provided and apply your assigned perspective throughout the design process.

2. **Explore Thoroughly**:
   - Read any files provided to you in the initial prompt
   - Find existing patterns and conventions using ${toolNames.glob}, ${toolNames.grep}, and ${toolNames.read}
   - Understand the current architecture
   - Identify similar features as reference
   - Trace through relevant code paths
   - Use ${toolNames.bash} ONLY for read-only operations (ls, git status, git log, git diff, find, cat, head, tail)
   - NEVER use ${toolNames.bash} for: mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install, or any file creation/modification

3. **Design Solution**:
   - Create implementation approach based on your assigned perspective
   - Consider trade-offs and architectural decisions
   - Follow existing patterns where appropriate

4. **Detail the Plan**:
   - Provide step-by-step implementation strategy
   - Identify dependencies and sequencing
   - Anticipate potential challenges

## Required Output

End your response with:

### Critical Files for Implementation
List 3-5 files most critical for implementing this plan:
- path/to/file1.ts - [Brief reason: e.g., "Core logic to modify"]
- path/to/file2.ts - [Brief reason: e.g., "Interfaces to implement"]
- path/to/file3.ts - [Brief reason: e.g., "Pattern to follow"]

REMEMBER: You can ONLY explore and plan. You CANNOT and MUST NOT write, edit, or modify any files. You do NOT have access to file editing tools.`;
  }

  /**
   * 创建完整的实现计划
   */
  async createPlan(): Promise<PlanResult> {
    const prompt = this.buildPlanPrompt();

    // 使用 Claude API 生成计划
    // 注意：这是一个简化实现，实际需要集成完整的对话循环
    const response = await this.executeWithAgent(prompt);

    // 解析响应并构建结果
    return this.parsePlanResponse(response);
  }

  /**
   * 分析需求
   */
  async analyzeRequirements(): Promise<RequirementsAnalysis> {
    const prompt = `Analyze the following requirements and break them down:

Task: ${this.options.task}
${this.options.context ? `\nContext: ${this.options.context}` : ''}
${this.options.constraints ? `\nConstraints:\n${this.options.constraints.map(c => `- ${c}`).join('\n')}` : ''}

Please provide:
1. Functional requirements (what the system should do)
2. Non-functional requirements (performance, security, etc.)
3. Technical constraints
4. Success criteria
5. Out of scope items
6. Assumptions`;

    const response = await this.executeWithAgent(prompt);
    return this.parseRequirementsAnalysis(response);
  }

  /**
   * 识别关键文件
   */
  async identifyFiles(): Promise<CriticalFile[]> {
    const prompt = `Identify the 3-5 most critical files for implementing this task:

Task: ${this.options.task}
${this.options.existingCode ? `\nExisting code references:\n${this.options.existingCode.map(c => `- ${c}`).join('\n')}` : ''}

For each file, specify:
- File path
- Why this file is critical
- Importance level (1-5)
- Whether it needs to be created (true/false)`;

    const response = await this.executeWithAgent(prompt);
    return this.parseFilesResponse(response);
  }

  /**
   * 评估风险
   */
  async assessRisks(): Promise<Risk[]> {
    const prompt = `Assess potential risks for implementing this task:

Task: ${this.options.task}
${this.options.context ? `\nContext: ${this.options.context}` : ''}

Consider:
- Technical risks (complexity, dependencies, etc.)
- Architectural risks (coupling, scalability, etc.)
- Compatibility risks (breaking changes, backwards compatibility)
- Performance risks
- Security risks
- Maintainability risks

For each risk, provide:
- Category
- Level (low/medium/high/critical)
- Description
- Mitigation strategy
- Impact areas`;

    const response = await this.executeWithAgent(prompt);
    return this.parseRisksResponse(response);
  }

  /**
   * 生成替代方案
   */
  async generateAlternatives(): Promise<Alternative[]> {
    const prompt = `Generate alternative implementation approaches for this task:

Task: ${this.options.task}

For each alternative:
- Name and description
- Pros and cons
- Best use cases
- Recommendation (if any)`;

    const response = await this.executeWithAgent(prompt);
    return this.parseAlternativesResponse(response);
  }

  /**
   * 构建 Plan 提示词
   */
  private buildPlanPrompt(): string {
    const parts = [
      `# Implementation Planning Task`,
      ``,
      `## Requirements`,
      this.options.task,
    ];

    if (this.options.context) {
      parts.push(``, `## Context`, this.options.context);
    }

    if (this.options.constraints && this.options.constraints.length > 0) {
      parts.push(``, `## Constraints`);
      parts.push(...this.options.constraints.map(c => `- ${c}`));
    }

    if (this.options.existingCode && this.options.existingCode.length > 0) {
      parts.push(``, `## Existing Code References`);
      parts.push(...this.options.existingCode.map(c => `- ${c}`));
    }

    if (this.options.perspective) {
      parts.push(``, `## Design Perspective`, this.options.perspective);
    }

    parts.push(
      ``,
      `## Instructions`,
      ``,
      `Please create a comprehensive implementation plan that includes:`,
      ``,
      `1. **Requirements Analysis**`,
      `   - Break down functional and non-functional requirements`,
      `   - Identify technical constraints`,
      `   - Define success criteria`,
      ``,
      `2. **Architecture Decisions**`,
      `   - Document key architectural choices`,
      `   - Explain trade-offs considered`,
      `   - Justify selected approach`,
      ``,
      `3. **Implementation Steps**`,
      `   - Provide detailed, sequential steps`,
      `   - Identify dependencies between steps`,
      `   - Estimate complexity and time for each step`,
      `   - Note potential risks per step`,
      ``,
      `4. **Critical Files** (3-5 files)`,
      `   - List the most important files to modify/create`,
      `   - Explain why each file is critical`,
      ``,
      `5. **Risk Assessment**`,
      `   - Identify potential technical, architectural, and other risks`,
      `   - Provide mitigation strategies`,
      ``,
      `6. **Alternative Approaches**`,
      `   - Describe other viable implementation approaches`,
      `   - Compare pros and cons`,
      ``,
      `7. **Recommendations**`,
      `   - Provide actionable recommendations`,
      `   - Suggest next steps`,
      ``
    );

    return parts.join('\n');
  }

  /**
   * 执行代理任务 (简化版本)
   */
  private async executeWithAgent(prompt: string): Promise<string> {
    // 这是一个简化实现
    // 实际应该启动完整的对话循环，使用工具等

    // 暂时返回模拟响应
    return `Mock response for: ${prompt.substring(0, 100)}...`;
  }

  /**
   * 解析计划响应
   */
  private parsePlanResponse(response: string): PlanResult {
    // 这是一个简化的解析实现
    // 实际应该使用更复杂的 NLP 或结构化提取

    return {
      summary: 'Implementation plan summary',
      requirementsAnalysis: {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        technicalConstraints: [],
        successCriteria: [],
      },
      architecturalDecisions: [],
      steps: [],
      criticalFiles: [],
      risks: [],
      alternatives: [],
      estimatedComplexity: 'moderate',
    };
  }

  /**
   * 解析需求分析响应
   */
  private parseRequirementsAnalysis(response: string): RequirementsAnalysis {
    return {
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      technicalConstraints: [],
      successCriteria: [],
    };
  }

  /**
   * 解析文件响应
   */
  private parseFilesResponse(response: string): CriticalFile[] {
    return [];
  }

  /**
   * 解析风险响应
   */
  private parseRisksResponse(response: string): Risk[] {
    return [];
  }

  /**
   * 解析替代方案响应
   */
  private parseAlternativesResponse(response: string): Alternative[] {
    return [];
  }
}

/**
 * 创建 Plan 代理实例
 */
export function createPlanAgent(options: PlanOptions): PlanAgent {
  return new PlanAgent(options);
}

/**
 * Plan 代理配置 (用于注册到代理系统)
 */
export const PLAN_AGENT_CONFIG = {
  agentType: 'Plan',
  whenToUse: 'Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.',
  disallowedTools: [
    'Write',      // 禁止写入文件
    'Edit',       // 禁止编辑文件
    'MultiEdit',  // 禁止多文件编辑
    'NotebookEdit', // 禁止编辑笔记本
    'ExitPlanMode', // 禁止退出计划模式（这是主线程的工具）
  ],
  source: 'built-in' as const,
  model: 'inherit' as const,
  baseDir: 'built-in',
  // 允许所有其他工具 (探索、搜索等)
  tools: ['*'] as const,
};

/**
 * 导出工具名称常量
 */
export const DISALLOWED_TOOLS = {
  WRITE: 'Write',
  EDIT: 'Edit',
  MULTI_EDIT: 'MultiEdit',
  NOTEBOOK_EDIT: 'NotebookEdit',
  EXIT_PLAN_MODE: 'ExitPlanMode',
} as const;
