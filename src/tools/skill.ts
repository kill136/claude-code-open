/**
 * Skill 和 SlashCommand 工具
 * 技能和自定义命令系统
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

interface SkillInput {
  skill: string;
}

interface SlashCommandInput {
  command: string;
}

interface SkillDefinition {
  name: string;
  description: string;
  prompt: string;
  location: 'user' | 'project' | 'builtin';
}

interface SlashCommandDefinition {
  name: string;
  description?: string;
  content: string;
  path: string;
}

// 技能注册表
const skillRegistry: Map<string, SkillDefinition> = new Map();
// 斜杠命令注册表
const slashCommandRegistry: Map<string, SlashCommandDefinition> = new Map();

/**
 * 注册技能
 */
export function registerSkill(skill: SkillDefinition): void {
  skillRegistry.set(skill.name, skill);
}

/**
 * 从目录加载技能
 */
export function loadSkillsFromDirectory(dir: string, location: 'user' | 'project'): void {
  if (!fs.existsSync(dir)) return;

  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) return;

  const files = fs.readdirSync(skillsDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(path.join(skillsDir, file), 'utf-8');
      const name = file.replace('.md', '');

      // 解析 frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let description = '';
      let prompt = content;

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        prompt = frontmatterMatch[2].trim();

        const descMatch = frontmatter.match(/description:\s*(.+)/);
        if (descMatch) description = descMatch[1].trim();
      }

      registerSkill({ name, description, prompt, location });
    }
  }
}

/**
 * 从目录加载斜杠命令
 */
export function loadSlashCommandsFromDirectory(dir: string): void {
  if (!fs.existsSync(dir)) return;

  const commandsDir = path.join(dir, 'commands');
  if (!fs.existsSync(commandsDir)) return;

  const files = fs.readdirSync(commandsDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const fullPath = path.join(commandsDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const name = file.replace('.md', '');

      // 解析描述（第一行如果是注释）
      let description: string | undefined;
      const lines = content.split('\n');
      if (lines[0]?.startsWith('<!--') && lines[0].endsWith('-->')) {
        description = lines[0].slice(4, -3).trim();
      }

      slashCommandRegistry.set(name, {
        name,
        description,
        content,
        path: fullPath,
      });
    }
  }
}

/**
 * 初始化：加载所有技能和命令
 */
export function initializeSkillsAndCommands(): void {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const claudeDir = path.join(homeDir, '.claude');

  // 加载用户级别
  loadSkillsFromDirectory(claudeDir, 'user');
  loadSlashCommandsFromDirectory(claudeDir);

  // 加载项目级别
  const projectClaudeDir = path.join(process.cwd(), '.claude');
  loadSkillsFromDirectory(projectClaudeDir, 'project');
  loadSlashCommandsFromDirectory(projectClaudeDir);
}

export class SkillTool extends BaseTool<SkillInput, ToolResult> {
  name = 'Skill';
  description = `Execute a skill within the main conversation.

Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke skills using the skill name only (no arguments)
- The skill's prompt will expand and provide detailed instructions

Available skills are loaded from:
- ~/.claude/skills/*.md (user skills)
- .claude/skills/*.md (project skills)`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'The skill name to execute',
        },
      },
      required: ['skill'],
    };
  }

  async execute(input: SkillInput): Promise<ToolResult> {
    const { skill } = input;

    // 查找技能
    const skillDef = skillRegistry.get(skill);
    if (!skillDef) {
      const available = Array.from(skillRegistry.keys()).join(', ');
      return {
        success: false,
        error: `Skill "${skill}" not found. Available skills: ${available || 'none'}`,
      };
    }

    return {
      success: true,
      output: `<skill name="${skillDef.name}" location="${skillDef.location}">\n${skillDef.prompt}\n</skill>`,
    };
  }
}

export class SlashCommandTool extends BaseTool<SlashCommandInput, ToolResult> {
  name = 'SlashCommand';
  description = `Execute a custom slash command.

Slash commands are loaded from:
- ~/.claude/commands/*.md (user commands)
- .claude/commands/*.md (project commands)

Usage:
- command: The slash command to execute, including arguments
- Example: "/review-pr 123"`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The slash command to execute with its arguments',
        },
      },
      required: ['command'],
    };
  }

  async execute(input: SlashCommandInput): Promise<ToolResult> {
    const { command } = input;

    // 解析命令和参数
    const parts = command.startsWith('/')
      ? command.slice(1).split(' ')
      : command.split(' ');
    const cmdName = parts[0];
    const args = parts.slice(1);

    // 查找命令
    const cmdDef = slashCommandRegistry.get(cmdName);
    if (!cmdDef) {
      const available = Array.from(slashCommandRegistry.keys())
        .map((n) => `/${n}`)
        .join(', ');
      return {
        success: false,
        error: `Command "/${cmdName}" not found. Available commands: ${available || 'none'}`,
      };
    }

    // 替换参数占位符
    let content = cmdDef.content;

    // 替换 $1, $2, ... 或 {{arg}}
    args.forEach((arg, i) => {
      content = content.replace(new RegExp(`\\$${i + 1}`, 'g'), arg);
      content = content.replace(new RegExp(`\\{\\{\\s*arg${i + 1}\\s*\\}\\}`, 'g'), arg);
    });

    // 替换 $@ (所有参数)
    content = content.replace(/\$@/g, args.join(' '));

    return {
      success: true,
      output: `<command-message>/${cmdName} is running…</command-message>\n\n${content}`,
    };
  }
}

/**
 * 获取所有可用技能
 */
export function getAvailableSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

/**
 * 获取所有可用命令
 */
export function getAvailableCommands(): SlashCommandDefinition[] {
  return Array.from(slashCommandRegistry.values());
}
