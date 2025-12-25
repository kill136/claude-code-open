/**
 * 动态提示建议生成器
 * Dynamic Prompt Suggestion Generator
 *
 * 根据当前上下文、对话历史和文件状态生成智能的提示建议
 * Generates intelligent prompt suggestions based on current context, conversation history, and file state
 */

import type { PromptContext, DiagnosticInfo, TodoItem, GitStatusInfo } from './types.js';
import type { Message, AnyContentBlock } from '../types/index.js';

/**
 * 建议类型
 */
export interface Suggestion {
  /** 建议的提示文本 */
  text: string;
  /** 描述 */
  description?: string;
  /** 类别 */
  category: 'action' | 'question' | 'command';
  /** 排序优先级 (数值越大优先级越高) */
  priority: number;
}

/**
 * 建议生成器类
 */
export class SuggestionGenerator {
  /**
   * 根据上下文生成建议
   */
  generateFromContext(context: PromptContext): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 从诊断信息生成建议
    if (context.diagnostics && context.diagnostics.length > 0) {
      suggestions.push(...this.generateDiagnosticSuggestions(context.diagnostics));
    }

    // 从 Git 状态生成建议
    if (context.gitStatus && context.isGitRepo) {
      suggestions.push(...this.generateGitSuggestions(context.gitStatus));
    }

    // 从 TODO 列表生成建议
    if (context.todoList && context.todoList.length > 0) {
      suggestions.push(...this.generateTodoSuggestions(context.todoList));
    }

    // 从 IDE 状态生成建议
    if (context.ideSelection) {
      suggestions.push({
        text: '重构选中的代码',
        description: '优化或重构 IDE 中选中的代码段',
        category: 'action',
        priority: 70,
      });
    }

    if (context.ideOpenedFiles && context.ideOpenedFiles.length > 0) {
      suggestions.push(...this.generateFileTypeSuggestions(context.ideOpenedFiles));
    }

    // 根据权限模式生成建议
    if (context.permissionMode === 'bypassPermissions') {
      suggestions.push({
        text: '批量重命名变量',
        description: '在项目中批量重命名变量或函数',
        category: 'action',
        priority: 60,
      });
    }

    // Plan 模式建议
    if (context.planMode) {
      suggestions.push({
        text: '分析当前计划的可行性',
        description: '评估当前计划并提供改进建议',
        category: 'question',
        priority: 80,
      });
    }

    // Delegate 模式建议
    if (context.delegateMode) {
      suggestions.push({
        text: '委托子任务给多个 agent',
        description: '将复杂任务分解并委托给专门的 agent',
        category: 'action',
        priority: 75,
      });
    }

    return this.sortSuggestions(suggestions);
  }

  /**
   * 根据对话历史生成建议
   */
  generateFromHistory(messages: Message[]): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (messages.length === 0) {
      // 首次对话的默认建议
      suggestions.push(
        {
          text: '分析这个项目的代码结构',
          description: '了解项目的架构和组织方式',
          category: 'action',
          priority: 90,
        },
        {
          text: '帮我设置开发环境',
          description: '配置和初始化项目开发环境',
          category: 'action',
          priority: 85,
        },
        {
          text: '这个项目是做什么的?',
          description: '了解项目的目的和功能',
          category: 'question',
          priority: 80,
        }
      );
      return this.sortSuggestions(suggestions);
    }

    // 分析最近的消息
    const lastMessage = messages[messages.length - 1];
    const lastContent = this.extractTextContent(lastMessage);

    // 检测错误或问题
    if (lastContent.toLowerCase().includes('error') || lastContent.toLowerCase().includes('错误')) {
      suggestions.push({
        text: '调试并修复这个错误',
        description: '分析错误原因并提供解决方案',
        category: 'action',
        priority: 95,
      });
    }

    // 检测代码相关的对话
    if (this.hasToolUse(lastMessage, 'Read') || this.hasToolUse(lastMessage, 'Grep')) {
      suggestions.push({
        text: '优化这段代码',
        description: '改进代码质量和性能',
        category: 'action',
        priority: 70,
      });
      suggestions.push({
        text: '添加测试',
        description: '为这段代码编写单元测试',
        category: 'action',
        priority: 65,
      });
    }

    // 检测写入操作
    if (this.hasToolUse(lastMessage, 'Write') || this.hasToolUse(lastMessage, 'Edit')) {
      suggestions.push({
        text: '运行测试验证修改',
        description: '执行测试确保修改没有破坏现有功能',
        category: 'action',
        priority: 85,
      });
      suggestions.push({
        text: '提交这些更改',
        description: '使用 git 提交最近的修改',
        category: 'command',
        priority: 60,
      });
    }

    // 检测 Bash 命令执行
    if (this.hasToolUse(lastMessage, 'Bash')) {
      suggestions.push({
        text: '解释这个命令的输出',
        description: '分析命令执行结果',
        category: 'question',
        priority: 65,
      });
    }

    // 检测长对话
    if (messages.length > 10) {
      suggestions.push({
        text: '总结我们目前完成的工作',
        description: '回顾对话中完成的任务和修改',
        category: 'question',
        priority: 55,
      });
    }

    return this.sortSuggestions(suggestions);
  }

  /**
   * 根据打开的文件生成建议
   */
  generateFromFiles(files: string[]): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (files.length === 0) {
      return suggestions;
    }

    // 分析文件类型
    const fileTypes = this.analyzeFileTypes(files);

    // TypeScript/JavaScript 文件
    if (fileTypes.hasTypeScript || fileTypes.hasJavaScript) {
      suggestions.push({
        text: '检查类型错误',
        description: '运行 TypeScript 类型检查',
        category: 'action',
        priority: 80,
      });
      suggestions.push({
        text: '运行 lint 检查',
        description: '使用 ESLint 检查代码质量',
        category: 'action',
        priority: 70,
      });
    }

    // Python 文件
    if (fileTypes.hasPython) {
      suggestions.push({
        text: '运行 Python 类型检查',
        description: '使用 mypy 或 pyright 检查类型',
        category: 'action',
        priority: 75,
      });
    }

    // 测试文件
    if (fileTypes.hasTests) {
      suggestions.push({
        text: '运行测试套件',
        description: '执行项目的测试用例',
        category: 'action',
        priority: 85,
      });
    }

    // 配置文件
    if (fileTypes.hasConfig) {
      suggestions.push({
        text: '验证配置文件',
        description: '检查配置文件的语法和有效性',
        category: 'action',
        priority: 70,
      });
    }

    // Markdown 文档
    if (fileTypes.hasMarkdown) {
      suggestions.push({
        text: '更新文档',
        description: '改进或更新项目文档',
        category: 'action',
        priority: 60,
      });
    }

    // 包管理文件
    if (fileTypes.hasPackageJson) {
      suggestions.push({
        text: '更新依赖包',
        description: '检查并更新 npm 依赖',
        category: 'action',
        priority: 55,
      });
    }

    return this.sortSuggestions(suggestions);
  }

  /**
   * 从诊断信息生成建议
   */
  private generateDiagnosticSuggestions(diagnostics: DiagnosticInfo[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const errorCount = diagnostics.filter(d => d.severity === 'error').length;
    const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

    if (errorCount > 0) {
      suggestions.push({
        text: `修复 ${errorCount} 个类型错误`,
        description: '解决代码中的错误问题',
        category: 'action',
        priority: 100,
      });
    }

    if (warningCount > 0) {
      suggestions.push({
        text: `修复 ${warningCount} 个警告`,
        description: '解决代码中的警告问题',
        category: 'action',
        priority: 75,
      });
    }

    // 检查特定类型的错误
    const tsErrors = diagnostics.filter(d => d.source === 'typescript' || d.source === 'ts');
    if (tsErrors.length > 0) {
      suggestions.push({
        text: '修复 TypeScript 类型错误',
        description: '解决 TypeScript 类型系统相关的问题',
        category: 'action',
        priority: 95,
      });
    }

    return suggestions;
  }

  /**
   * 从 Git 状态生成建议
   */
  private generateGitSuggestions(gitStatus: GitStatusInfo): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 有未暂存的修改
    if (gitStatus.unstaged.length > 0 || gitStatus.untracked.length > 0) {
      suggestions.push({
        text: '查看修改内容',
        description: '使用 git diff 查看修改详情',
        category: 'command',
        priority: 80,
      });
    }

    // 有暂存的修改
    if (gitStatus.staged.length > 0) {
      suggestions.push({
        text: '提交暂存的修改',
        description: '创建 git commit',
        category: 'action',
        priority: 85,
      });
    }

    // 工作目录干净
    if (gitStatus.isClean && gitStatus.ahead > 0) {
      suggestions.push({
        text: '推送到远程仓库',
        description: '将本地提交推送到远程',
        category: 'command',
        priority: 75,
      });
    }

    // 远程有新提交
    if (gitStatus.behind > 0) {
      suggestions.push({
        text: '拉取远程更新',
        description: '从远程仓库拉取最新代码',
        category: 'command',
        priority: 90,
      });
    }

    // 有未追踪的文件
    if (gitStatus.untracked.length > 0) {
      suggestions.push({
        text: '添加新文件到 git',
        description: '将未追踪的文件添加到版本控制',
        category: 'action',
        priority: 70,
      });
    }

    return suggestions;
  }

  /**
   * 从 TODO 列表生成建议
   */
  private generateTodoSuggestions(todoList: TodoItem[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const pendingTodos = todoList.filter(t => t.status === 'pending');
    const inProgressTodos = todoList.filter(t => t.status === 'in_progress');

    // 有进行中的任务
    if (inProgressTodos.length > 0) {
      suggestions.push({
        text: `继续完成: ${inProgressTodos[0].content}`,
        description: inProgressTodos[0].activeForm,
        category: 'action',
        priority: 95,
      });
    }

    // 有待办任务
    if (pendingTodos.length > 0) {
      suggestions.push({
        text: `开始下一个任务: ${pendingTodos[0].content}`,
        description: '继续处理待办列表中的下一项',
        category: 'action',
        priority: 85,
      });
    }

    // 任务较多时的建议
    if (pendingTodos.length > 5) {
      suggestions.push({
        text: '查看完整的 TODO 列表',
        description: '显示所有待办任务',
        category: 'question',
        priority: 60,
      });
    }

    return suggestions;
  }

  /**
   * 根据文件类型生成建议
   */
  private generateFileTypeSuggestions(files: string[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const fileTypes = this.analyzeFileTypes(files);

    // 根据文件类型提供特定建议
    if (fileTypes.hasTypeScript) {
      suggestions.push({
        text: '解释这个 TypeScript 文件',
        description: '分析文件的功能和结构',
        category: 'question',
        priority: 65,
      });
    }

    if (fileTypes.hasReact) {
      suggestions.push({
        text: '优化 React 组件',
        description: '改进组件性能和可维护性',
        category: 'action',
        priority: 70,
      });
    }

    return suggestions;
  }

  /**
   * 分析文件类型
   */
  private analyzeFileTypes(files: string[]): {
    hasTypeScript: boolean;
    hasJavaScript: boolean;
    hasPython: boolean;
    hasTests: boolean;
    hasConfig: boolean;
    hasMarkdown: boolean;
    hasPackageJson: boolean;
    hasReact: boolean;
  } {
    return {
      hasTypeScript: files.some(f => f.endsWith('.ts') || f.endsWith('.tsx')),
      hasJavaScript: files.some(f => f.endsWith('.js') || f.endsWith('.jsx')),
      hasPython: files.some(f => f.endsWith('.py')),
      hasTests: files.some(f =>
        f.includes('.test.') ||
        f.includes('.spec.') ||
        f.includes('__tests__') ||
        f.includes('/tests/')
      ),
      hasConfig: files.some(f =>
        f.endsWith('config.js') ||
        f.endsWith('config.ts') ||
        f.endsWith('.json') ||
        f.endsWith('.yaml') ||
        f.endsWith('.yml')
      ),
      hasMarkdown: files.some(f => f.endsWith('.md')),
      hasPackageJson: files.some(f => f.endsWith('package.json')),
      hasReact: files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx')),
    };
  }

  /**
   * 提取消息中的文本内容
   */
  private extractTextContent(message: Message): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    return message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join(' ');
  }

  /**
   * 检查消息是否使用了特定工具
   */
  private hasToolUse(message: Message, toolName: string): boolean {
    if (typeof message.content === 'string') {
      return false;
    }

    return message.content.some(
      block => block.type === 'tool_use' && 'name' in block && block.name === toolName
    );
  }

  /**
   * 排序建议（按优先级降序）
   */
  private sortSuggestions(suggestions: Suggestion[]): Suggestion[] {
    return suggestions.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * 导出默认实例
 */
export const suggestionGenerator = new SuggestionGenerator();
