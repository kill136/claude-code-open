/**
 * Skill 工具 - 完全对齐官网实现
 * 基于官网源码 node_modules/@anthropic-ai/claude-code/cli.js 反编译
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolResult, ToolDefinition } from '../types/index.js';

interface SkillInput {
  skill: string;
  args?: string;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  'allowed-tools'?: string;
  'argument-hint'?: string;
  'when-to-use'?: string;
  when_to_use?: string;
  version?: string;
  model?: string;
  'user-invocable'?: string;
  'disable-model-invocation'?: string;
  [key: string]: any;
}

interface SkillDefinition {
  skillName: string;
  displayName: string;
  description: string;
  hasUserSpecifiedDescription: boolean;
  markdownContent: string;
  allowedTools?: string[];
  argumentHint?: string;
  whenToUse?: string;
  version?: string;
  model?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  source: 'user' | 'project' | 'plugin';
  baseDir: string;
  filePath: string;
  loadedFrom: 'skills' | 'commands_DEPRECATED';
}

// 全局状态：已调用的 skills（对齐官网 KP0/VP0）
const invokedSkills = new Map<string, {
  skillName: string;
  skillPath: string;
  content: string;
  invokedAt: number;
}>();

// Skill 注册表
const skillRegistry = new Map<string, SkillDefinition>();
let skillsLoaded = false;

/**
 * 记录已调用的 skill（对齐官网 KP0 函数）
 */
function recordInvokedSkill(skillName: string, skillPath: string, content: string): void {
  invokedSkills.set(skillName, {
    skillName,
    skillPath,
    content,
    invokedAt: Date.now(),
  });
}

/**
 * 获取已调用的 skills（对齐官网 VP0 函数）
 */
export function getInvokedSkills(): Map<string, any> {
  return invokedSkills;
}

/**
 * 解析 frontmatter（对齐官网 NV 函数）
 * 官网实现：
 * function NV(A) {
 *   let Q = /^---\s*\n([\s\S]*?)---\s*\n?/;
 *   let B = A.match(Q);
 *   if (!B) return { frontmatter: {}, content: A };
 *   let G = B[1] || "";
 *   let Z = A.slice(B[0].length);
 *   let Y = {};
 *   let J = G.split('\n');
 *   for (let X of J) {
 *     let I = X.indexOf(":");
 *     if (I > 0) {
 *       let W = X.slice(0, I).trim();
 *       let K = X.slice(I + 1).trim();
 *       if (W) {
 *         let V = K.replace(/^["']|["']$/g, "");
 *         Y[W] = V;
 *       }
 *     }
 *   }
 *   return { frontmatter: Y, content: Z };
 * }
 */
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; content: string } {
  const regex = /^---\s*\n([\s\S]*?)---\s*\n?/;
  const match = content.match(regex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterText = match[1] || '';
  const bodyContent = content.slice(match[0].length);
  const frontmatter: SkillFrontmatter = {};

  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key) {
        // 移除前后的引号
        const cleanValue = value.replace(/^["']|["']$/g, '');
        frontmatter[key] = cleanValue;
      }
    }
  }

  return { frontmatter, content: bodyContent };
}

/**
 * 解析 allowed-tools 字段
 * 官网支持字符串或数组
 */
function parseAllowedTools(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  // 如果是逗号分隔的字符串
  if (value.includes(',')) {
    return value.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  // 单个工具
  if (value.trim()) {
    return [value.trim()];
  }

  return undefined;
}

/**
 * 解析布尔值字段
 */
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  const lower = value.toLowerCase().trim();
  return ['true', '1', 'yes'].includes(lower);
}

/**
 * 构建 Skill 对象（对齐官网 AY9 函数）
 */
function buildSkillDefinition(params: {
  skillName: string;
  displayName?: string;
  description?: string;
  hasUserSpecifiedDescription: boolean;
  markdownContent: string;
  allowedTools?: string[];
  argumentHint?: string;
  whenToUse?: string;
  version?: string;
  model?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  source: 'user' | 'project' | 'plugin';
  baseDir: string;
  filePath: string;
  loadedFrom: 'skills' | 'commands_DEPRECATED';
}): SkillDefinition {
  return {
    skillName: params.skillName,
    displayName: params.displayName || params.skillName,
    description: params.description || '',
    hasUserSpecifiedDescription: params.hasUserSpecifiedDescription,
    markdownContent: params.markdownContent,
    allowedTools: params.allowedTools,
    argumentHint: params.argumentHint,
    whenToUse: params.whenToUse,
    version: params.version,
    model: params.model,
    disableModelInvocation: params.disableModelInvocation,
    userInvocable: params.userInvocable,
    source: params.source,
    baseDir: params.baseDir,
    filePath: params.filePath,
    loadedFrom: params.loadedFrom,
  };
}

/**
 * 从文件创建 Skill（简化版 CPA 函数）
 */
function createSkillFromFile(
  skillName: string,
  fileInfo: {
    filePath: string;
    baseDir: string;
    frontmatter: SkillFrontmatter;
    content: string;
  },
  source: 'user' | 'project' | 'plugin',
  isSkillMode: boolean
): SkillDefinition | null {
  const { frontmatter, content, filePath, baseDir } = fileInfo;

  // 解析 frontmatter
  const displayName = frontmatter.name || skillName;
  const description = frontmatter.description || '';
  const allowedTools = parseAllowedTools(frontmatter['allowed-tools']);
  const argumentHint = frontmatter['argument-hint'];
  const whenToUse = frontmatter['when-to-use'] || frontmatter.when_to_use;
  const version = frontmatter.version;
  const model = frontmatter.model;
  const disableModelInvocation = parseBoolean(frontmatter['disable-model-invocation']);
  const userInvocable = parseBoolean(frontmatter['user-invocable'], true);

  return buildSkillDefinition({
    skillName,
    displayName,
    description,
    hasUserSpecifiedDescription: !!frontmatter.description,
    markdownContent: content,
    allowedTools,
    argumentHint,
    whenToUse,
    version,
    model,
    disableModelInvocation,
    userInvocable,
    source,
    baseDir,
    filePath,
    loadedFrom: isSkillMode ? 'skills' : 'commands_DEPRECATED',
  });
}

/**
 * 从目录加载 skills（完全对齐官网 d62 函数）
 *
 * 官网实现逻辑：
 * async function d62(A, Q, B, G, Z, Y) {
 *   let J = jA(), X = [];
 *   try {
 *     if (!J.existsSync(A)) return [];
 *
 *     // 1. 检查根目录的 SKILL.md（单文件模式）
 *     let I = QKA(A, "SKILL.md");
 *     if (J.existsSync(I)) {
 *       // 加载单个 skill，使用目录名作为 skillName
 *       let K = J.readFileSync(I, { encoding: "utf-8" });
 *       let { frontmatter: V, content: H } = NV(K);
 *       let D = `${Q}:${BKA(A)}`;  // namespace:basename
 *       let F = { filePath: I, baseDir: Ko(I), frontmatter: V, content: H };
 *       let E = CPA(D, F, B, G, Z, !0, { isSkillMode: !0 });
 *       if (E) X.push(E);
 *       return X;
 *     }
 *
 *     // 2. 遍历子目录，查找每个子目录下的 SKILL.md
 *     let W = J.readdirSync(A);
 *     for (let K of W) {
 *       if (!K.isDirectory() && !K.isSymbolicLink()) continue;
 *       let V = QKA(A, K.name);
 *       let H = QKA(V, "SKILL.md");
 *       if (J.existsSync(H)) {
 *         let D = J.readFileSync(H, { encoding: "utf-8" });
 *         let { frontmatter: F, content: E } = NV(D);
 *         let z = `${Q}:${K.name}`;  // namespace:dirname
 *         let $ = { filePath: H, baseDir: Ko(H), frontmatter: F, content: E };
 *         let L = CPA(z, $, B, G, Z, !0, { isSkillMode: !0 });
 *         if (L) X.push(L);
 *       }
 *     }
 *   } catch (I) {
 *     console.error(`Failed to load skills from directory ${A}: ${I}`);
 *   }
 *   return X;
 * }
 */
async function loadSkillsFromDirectory(
  dirPath: string,
  namespace: 'user' | 'project' | 'plugin'
): Promise<SkillDefinition[]> {
  const results: SkillDefinition[] = [];

  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    // 1. 检查根目录的 SKILL.md（单文件模式）
    const rootSkillFile = path.join(dirPath, 'SKILL.md');
    if (fs.existsSync(rootSkillFile)) {
      try {
        const content = fs.readFileSync(rootSkillFile, { encoding: 'utf-8' });
        const { frontmatter, content: markdownContent } = parseFrontmatter(content);

        // 使用目录名作为 skillName
        const skillName = `${namespace}:${path.basename(dirPath)}`;

        const skill = createSkillFromFile(
          skillName,
          {
            filePath: rootSkillFile,
            baseDir: path.dirname(rootSkillFile),
            frontmatter,
            content: markdownContent,
          },
          namespace,
          true // isSkillMode
        );

        if (skill) {
          results.push(skill);
        }
      } catch (error) {
        console.error(`Failed to load skill from ${rootSkillFile}:`, error);
      }

      return results;
    }

    // 2. 遍历子目录，查找每个子目录下的 SKILL.md
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue;
      }

      const subDirPath = path.join(dirPath, entry.name);
      const skillFile = path.join(subDirPath, 'SKILL.md');

      if (fs.existsSync(skillFile)) {
        try {
          const content = fs.readFileSync(skillFile, { encoding: 'utf-8' });
          const { frontmatter, content: markdownContent } = parseFrontmatter(content);

          // 使用子目录名作为 skillName（带命名空间）
          const skillName = `${namespace}:${entry.name}`;

          const skill = createSkillFromFile(
            skillName,
            {
              filePath: skillFile,
              baseDir: path.dirname(skillFile),
              frontmatter,
              content: markdownContent,
            },
            namespace,
            true // isSkillMode
          );

          if (skill) {
            results.push(skill);
          }
        } catch (error) {
          console.error(`Failed to load skill from ${skillFile}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to load skills from directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * 初始化并加载所有 skills
 */
export async function initializeSkills(): Promise<void> {
  if (skillsLoaded) return;

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const claudeDir = path.join(homeDir, '.claude');
  const projectDir = path.join(process.cwd(), '.claude');

  // 清空注册表
  skillRegistry.clear();

  // 1. 加载用户级 skills
  const userSkillsDir = path.join(claudeDir, 'skills');
  const userSkills = await loadSkillsFromDirectory(userSkillsDir, 'user');
  for (const skill of userSkills) {
    skillRegistry.set(skill.skillName, skill);
  }

  // 2. 加载项目级 skills（会覆盖同名的用户 skills）
  const projectSkillsDir = path.join(projectDir, 'skills');
  const projectSkills = await loadSkillsFromDirectory(projectSkillsDir, 'project');
  for (const skill of projectSkills) {
    skillRegistry.set(skill.skillName, skill);
  }

  skillsLoaded = true;

  console.log(`Loaded ${skillRegistry.size} skills: ${Array.from(skillRegistry.keys()).join(', ')}`);
}

/**
 * 清除缓存
 */
export function clearSkillCache(): void {
  skillRegistry.clear();
  skillsLoaded = false;
}

/**
 * 获取所有 skills
 */
export function getAllSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

/**
 * 查找 skill（支持命名空间）
 */
export function findSkill(skillInput: string): SkillDefinition | undefined {
  // 1. 精确匹配
  if (skillRegistry.has(skillInput)) {
    return skillRegistry.get(skillInput);
  }

  // 2. 如果没有命名空间，尝试查找第一个匹配的 skill
  if (!skillInput.includes(':')) {
    for (const [fullName, skill] of skillRegistry.entries()) {
      const parts = fullName.split(':');
      const name = parts[parts.length - 1];
      if (name === skillInput) {
        return skill;
      }
    }
  }

  return undefined;
}

/**
 * Skill 工具类
 */
export class SkillTool extends BaseTool<SkillInput, any> {
  name = 'Skill';

  get description(): string {
    const skills = getAllSkills();
    const skillsXml = skills.map(skill => {
      return `<skill>
<name>
${skill.skillName}
</name>
<description>
${skill.description}
</description>
<location>
${skill.source}
</location>
</skill>`;
    }).join('\n');

    return `Execute a skill within the main conversation

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

When users ask you to run a "slash command" or reference "/<something>" (e.g., "/commit", "/review-pr"), they are referring to a skill. Use this tool to invoke the corresponding skill.

<example>
User: "run /commit"
Assistant: [Calls Skill tool with skill: "commit"]
</example>

How to invoke:
- Use this tool with the skill name and optional arguments
- Examples:
  - \`skill: "pdf"\` - invoke the pdf skill
  - \`skill: "commit", args: "-m 'Fix bug'"\` - invoke with arguments
  - \`skill: "review-pr", args: "123"\` - invoke with arguments
  - \`skill: "user:pdf"\` - invoke using fully qualified name

Important:
- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action
- NEVER just announce or mention a skill in your text response without actually calling this tool
- This is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

<available_skills>
${skillsXml}
</available_skills>
`;
  }

  getInputSchema(): ToolDefinition['inputSchema'] {
    return {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'The skill name. E.g., "pdf", "user:my-skill"',
        },
        args: {
          type: 'string',
          description: 'Optional arguments for the skill',
        },
      },
      required: ['skill'],
    };
  }

  async execute(input: SkillInput): Promise<any> {
    const { skill: skillInput, args } = input;

    // 确保 skills 已加载
    if (!skillsLoaded) {
      await initializeSkills();
    }

    // 查找 skill
    const skill = findSkill(skillInput);
    if (!skill) {
      const available = Array.from(skillRegistry.keys()).join(', ');
      return {
        success: false,
        error: `Skill "${skillInput}" not found. Available skills: ${available || 'none'}`,
      };
    }

    // 检查是否禁用模型调用
    if (skill.disableModelInvocation) {
      return {
        success: false,
        error: `Skill "${skill.skillName}" has model invocation disabled`,
      };
    }

    // 构建输出内容
    let skillContent = skill.markdownContent;
    if (args) {
      skillContent += `\n\n**ARGUMENTS:** ${args}`;
    }

    // 记录已调用的 skill（对齐官网 KP0）
    recordInvokedSkill(skill.skillName, skill.filePath, skillContent);

    // 构建输出消息（对齐官网格式）
    let output = `<command-message>The "${skill.displayName}" skill is loading</command-message>\n\n`;
    output += `<skill name="${skill.skillName}" location="${skill.source}"`;

    if (skill.version) {
      output += ` version="${skill.version}"`;
    }
    if (skill.model) {
      output += ` model="${skill.model}"`;
    }
    if (skill.allowedTools && skill.allowedTools.length > 0) {
      output += ` allowed-tools="${skill.allowedTools.join(',')}"`;
    }

    output += `>\n${skillContent}\n</skill>`;

    return {
      success: true,
      output,
      // 官网格式的额外字段
      commandName: skill.displayName,
      allowedTools: skill.allowedTools,
      model: skill.model,
    };
  }
}
