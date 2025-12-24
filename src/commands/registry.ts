/**
 * 斜杠命令注册表
 */

import type { SlashCommand, CommandContext, CommandResult, CommandCategory, CommandRegistry } from './types.js';

class CommandRegistryImpl implements CommandRegistry {
  commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  get(name: string): SlashCommand | undefined {
    // 先检查直接命令名
    const cmd = this.commands.get(name);
    if (cmd) return cmd;

    // 检查别名
    const aliasedName = this.aliases.get(name);
    if (aliasedName) {
      return this.commands.get(aliasedName);
    }

    return undefined;
  }

  getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: CommandCategory): SlashCommand[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  async execute(name: string, ctx: CommandContext): Promise<CommandResult> {
    const command = this.get(name);

    if (!command) {
      return {
        success: false,
        message: `Unknown command: /${name}\n\nType /help for available commands.`,
      };
    }

    try {
      return await command.execute(ctx);
    } catch (error) {
      return {
        success: false,
        message: `Error executing /${name}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// 单例导出
export const commandRegistry = new CommandRegistryImpl();
