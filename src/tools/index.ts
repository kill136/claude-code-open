/**
 * 工具注册表
 * 导出所有工具
 */

export * from './base.js';
export * from './bash.js';
export * from './file.js';
export * from './search.js';
export * from './web.js';
export * from './todo.js';
export * from './agent.js';
export * from './notebook.js';
export * from './planmode.js';
export * from './mcp.js';
export * from './ask.js';
export * from './sandbox.js';
export * from './multiedit.js';
export * from './tmux.js';
export * from './skill.js';

import { toolRegistry } from './base.js';
import { BashTool, BashOutputTool, KillShellTool } from './bash.js';
import { ReadTool, WriteTool, EditTool } from './file.js';
import { GlobTool, GrepTool } from './search.js';
import { WebFetchTool, WebSearchTool } from './web.js';
import { TodoWriteTool } from './todo.js';
import { TaskTool, TaskOutputTool, ListAgentsTool } from './agent.js';
import { NotebookEditTool } from './notebook.js';
import { EnterPlanModeTool, ExitPlanModeTool } from './planmode.js';
import { ListMcpResourcesTool, ReadMcpResourceTool } from './mcp.js';
import { AskUserQuestionTool } from './ask.js';
import { MultiEditTool } from './multiedit.js';
import { TmuxTool } from './tmux.js';
import { SkillTool, SlashCommandTool, initializeSkillsAndCommands } from './skill.js';

// 注册所有工具
export function registerAllTools(): void {
  // Bash 工具
  toolRegistry.register(new BashTool());
  toolRegistry.register(new BashOutputTool());
  toolRegistry.register(new KillShellTool());

  // 文件工具
  toolRegistry.register(new ReadTool());
  toolRegistry.register(new WriteTool());
  toolRegistry.register(new EditTool());

  // 搜索工具
  toolRegistry.register(new GlobTool());
  toolRegistry.register(new GrepTool());

  // Web 工具
  toolRegistry.register(new WebFetchTool());
  toolRegistry.register(new WebSearchTool());

  // 任务管理
  toolRegistry.register(new TodoWriteTool());

  // 代理工具
  toolRegistry.register(new TaskTool());
  toolRegistry.register(new TaskOutputTool());
  toolRegistry.register(new ListAgentsTool());

  // Notebook 编辑
  toolRegistry.register(new NotebookEditTool());

  // 计划模式
  toolRegistry.register(new EnterPlanModeTool());
  toolRegistry.register(new ExitPlanModeTool());

  // MCP 工具
  toolRegistry.register(new ListMcpResourcesTool());
  toolRegistry.register(new ReadMcpResourceTool());

  // 用户交互
  toolRegistry.register(new AskUserQuestionTool());

  // MultiEdit
  toolRegistry.register(new MultiEditTool());

  // Tmux
  toolRegistry.register(new TmuxTool());

  // Skill 和 SlashCommand
  initializeSkillsAndCommands();
  toolRegistry.register(new SkillTool());
  toolRegistry.register(new SlashCommandTool());
}

// 自动注册
registerAllTools();

export { toolRegistry };
