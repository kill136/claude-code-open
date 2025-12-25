/**
 * Skill 和 SlashCommand 工具
 * 技能和自定义命令系统
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
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
  filePath?: string;
}

interface SlashCommandDefinition {
  name: string;
  description?: string;
  content: string;
  path: string;
}

interface SkillMetadata {
  name?: string;
  description?: string;
  [key: string]: any;
}

// 技能注册表
const skillRegistry: Map<string, SkillDefinition> = new Map();
// 斜杠命令注册表
const slashCommandRegistry: Map<string, SlashCommandDefinition> = new Map();

// 缓存标志和时间戳
let skillsLoaded = false;
let commandsLoaded = false;
let lastLoadTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取内置 skills 目录路径
 */
function getBuiltinSkillsDir(): string {
  // 获取当前模块的目录
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 内置 skills 应该在 src/skills/ 或 dist/skills/
  const srcSkillsDir = path.join(__dirname, '..', 'skills');
  const distSkillsDir = path.join(__dirname, 'skills');

  if (fs.existsSync(srcSkillsDir)) {
    return srcSkillsDir;
  }
  if (fs.existsSync(distSkillsDir)) {
    return distSkillsDir;
  }

  // 如果都不存在，返回 src/skills/ 路径（即使不存在）
  return srcSkillsDir;
}

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const [, frontmatterText, body] = match;
  const metadata: SkillMetadata = {};

  // 简单的 YAML 解析（支持基本的 key: value 格式）
  const lines = frontmatterText.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 匹配 key: value 格式
    const keyValueMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyValueMatch) {
      // 保存之前的 key
      if (currentKey) {
        metadata[currentKey] = currentValue.join('\n').trim();
      }

      currentKey = keyValueMatch[1];
      currentValue = [keyValueMatch[2]];
    } else if (currentKey) {
      // 多行值
      currentValue.push(trimmed);
    }
  }

  // 保存最后一个 key
  if (currentKey) {
    metadata[currentKey] = currentValue.join('\n').trim();
  }

  return { metadata, body: body.trim() };
}

/**
 * 注册技能
 */
export function registerSkill(skill: SkillDefinition): void {
  // 如果已存在同名 skill，根据优先级决定是否覆盖
  // 优先级: project > user > builtin
  const existing = skillRegistry.get(skill.name);
  if (existing) {
    const priority = { project: 3, user: 2, builtin: 1 };
    if (priority[skill.location] <= priority[existing.location]) {
      return; // 不覆盖更高优先级的 skill
    }
  }

  skillRegistry.set(skill.name, skill);
}

/**
 * 从目录加载技能（支持递归）
 */
export function loadSkillsFromDirectory(
  dir: string,
  location: 'user' | 'project' | 'builtin',
  recursive = false
): void {
  if (!fs.existsSync(dir)) return;

  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) return;

  try {
    loadSkillsFromPath(skillsDir, location, recursive);
  } catch (error) {
    console.warn(`Failed to load skills from ${skillsDir}:`, error);
  }
}

/**
 * 从指定路径加载技能文件
 */
function loadSkillsFromPath(dirPath: string, location: 'user' | 'project' | 'builtin', recursive: boolean): void {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      loadSkillsFromPath(fullPath, location, recursive);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const { metadata, body } = parseFrontmatter(content);

        // 从 frontmatter 或文件名获取 skill 名称
        const name = metadata.name || entry.name.replace(/\.md$/, '');
        const description = metadata.description || '';
        const prompt = body;

        registerSkill({
          name,
          description,
          prompt,
          location,
          filePath: fullPath,
        });
      } catch (error) {
        console.warn(`Failed to load skill from ${fullPath}:`, error);
      }
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
 * 检查缓存是否过期
 */
function isCacheExpired(): boolean {
  const now = Date.now();
  return now - lastLoadTime > CACHE_TTL;
}

/**
 * 清除缓存
 */
export function clearSkillCache(): void {
  skillRegistry.clear();
  slashCommandRegistry.clear();
  skillsLoaded = false;
  commandsLoaded = false;
  lastLoadTime = 0;
}

/**
 * 重新加载所有 skills 和 commands（强制刷新）
 */
export function reloadSkillsAndCommands(): void {
  clearSkillCache();
  initializeSkillsAndCommands();
}

/**
 * 初始化：加载所有技能和命令（带缓存）
 */
export function initializeSkillsAndCommands(force = false): void {
  // 如果已加载且缓存未过期，直接返回
  if (!force && skillsLoaded && commandsLoaded && !isCacheExpired()) {
    return;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const claudeDir = path.join(homeDir, '.claude');
  const projectClaudeDir = path.join(process.cwd(), '.claude');

  // 加载顺序很重要：builtin -> user -> project
  // 这样后加载的可以覆盖先加载的（根据优先级）

  // 1. 加载内置 skills
  const builtinSkillsDir = getBuiltinSkillsDir();
  if (fs.existsSync(builtinSkillsDir)) {
    // 直接从 builtin skills 目录加载，不需要 .claude/skills 子目录
    try {
      loadSkillsFromPath(builtinSkillsDir, 'builtin', true);
    } catch (error) {
      console.warn('Failed to load builtin skills:', error);
    }
  }

  // 2. 加载用户级别 skills 和 commands
  loadSkillsFromDirectory(claudeDir, 'user', false);
  loadSlashCommandsFromDirectory(claudeDir);

  // 3. 加载项目级别 skills 和 commands（最高优先级）
  loadSkillsFromDirectory(projectClaudeDir, 'project', false);
  loadSlashCommandsFromDirectory(projectClaudeDir);

  // 更新缓存状态
  skillsLoaded = true;
  commandsLoaded = true;
  lastLoadTime = Date.now();
}

/**
 * 确保 skills 已加载（懒加载）
 */
function ensureSkillsLoaded(): void {
  if (!skillsLoaded || isCacheExpired()) {
    initializeSkillsAndCommands();
  }
}

/**
 * 确保 commands 已加载（懒加载）
 */
function ensureCommandsLoaded(): void {
  if (!commandsLoaded || isCacheExpired()) {
    initializeSkillsAndCommands();
  }
}

export class SkillTool extends BaseTool<SkillInput, ToolResult> {
  name = 'Skill';
  description = `Execute a skill within the main conversation.

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke skills using this tool with the skill name only (no arguments)
- When you invoke a skill, you will see <command-message>The "{name}" skill is loading</command-message>
- The skill's prompt will expand and provide detailed instructions on how to complete the task
- Examples:
  - skill: "pdf" - invoke the pdf skill
  - skill: "xlsx" - invoke the xlsx skill
  - skill: "my-package:analyzer" - invoke using fully qualified name

Important:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

Available skills are loaded from (in priority order):
1. .claude/skills/*.md (project skills - highest priority)
2. ~/.claude/skills/*.md (user skills)
3. Built-in skills (lowest priority)`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'The skill name (no arguments). E.g., "pdf" or "xlsx"',
        },
      },
      required: ['skill'],
    };
  }

  async execute(input: SkillInput): Promise<ToolResult> {
    const { skill } = input;

    // 确保 skills 已加载
    ensureSkillsLoaded();

    // 查找技能
    const skillDef = skillRegistry.get(skill);
    if (!skillDef) {
      const available = Array.from(skillRegistry.keys()).sort().join(', ');
      return {
        success: false,
        error: `Skill "${skill}" not found. Available skills: ${available || 'none'}`,
      };
    }

    return {
      success: true,
      output: `<command-message>The "${skillDef.name}" skill is loading</command-message>\n\n<skill name="${skillDef.name}" location="${skillDef.location}">\n${skillDef.prompt}\n</skill>`,
    };
  }
}

export class SlashCommandTool extends BaseTool<SlashCommandInput, ToolResult> {
  name = 'SlashCommand';
  description = `Execute a slash command within the main conversation

How slash commands work:
When you use this tool or when a user types a slash command, you will see <command-message>{name} is running…</command-message> followed by the expanded prompt. For example, if .claude/commands/foo.md contains "Print today's date", then /foo expands to that prompt in the next message.

Usage:
- command (required): The slash command to execute, including any arguments
- Example: command: "/review-pr 123"

IMPORTANT: Only use this tool for custom slash commands that appear in the Available Commands list below. Do NOT use for:
- Built-in CLI commands (like /help, /clear, etc.)
- Commands not shown in the list
- Commands you think might exist but aren't listed

Notes:
- When a user requests multiple slash commands, execute each one sequentially and check for <command-message>{name} is running…</command-message> to verify each has been processed
- Do not invoke a command that is already running. For example, if you see <command-message>foo is running…</command-message>, do NOT use this tool with "/foo" - process the expanded prompt in the following message
- Only custom slash commands with descriptions are listed in Available Commands. If a user's command is not listed, ask them to check the slash command file and consult the docs.

Slash commands are loaded from:
- .claude/commands/*.md (project commands)
- ~/.claude/commands/*.md (user commands)`;

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The slash command to execute with its arguments, e.g., "/review-pr 123"',
        },
      },
      required: ['command'],
    };
  }

  async execute(input: SlashCommandInput): Promise<ToolResult> {
    const { command } = input;

    // 确保 commands 已加载
    ensureCommandsLoaded();

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
        .sort()
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
  ensureSkillsLoaded();
  return Array.from(skillRegistry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 获取所有可用命令
 */
export function getAvailableCommands(): SlashCommandDefinition[] {
  ensureCommandsLoaded();
  return Array.from(slashCommandRegistry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 获取指定位置的技能
 */
export function getSkillsByLocation(location: 'user' | 'project' | 'builtin'): SkillDefinition[] {
  ensureSkillsLoaded();
  return Array.from(skillRegistry.values())
    .filter((skill) => skill.location === location)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 查找技能（不区分大小写）
 */
export function findSkill(name: string): SkillDefinition | undefined {
  ensureSkillsLoaded();

  // 精确匹配
  let skill = skillRegistry.get(name);
  if (skill) return skill;

  // 不区分大小写匹配
  const lowerName = name.toLowerCase();
  for (const [key, value] of Array.from(skillRegistry.entries())) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

/**
 * 查找命令（不区分大小写）
 */
export function findCommand(name: string): SlashCommandDefinition | undefined {
  ensureCommandsLoaded();

  // 移除前导斜杠
  const cmdName = name.startsWith('/') ? name.slice(1) : name;

  // 精确匹配
  let cmd = slashCommandRegistry.get(cmdName);
  if (cmd) return cmd;

  // 不区分大小写匹配
  const lowerName = cmdName.toLowerCase();
  for (const [key, value] of Array.from(slashCommandRegistry.entries())) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}
