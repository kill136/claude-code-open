/**
 * 认证命令 - login, logout
 */

import type { SlashCommand, CommandContext, CommandResult } from './types.js';
import { commandRegistry } from './registry.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 获取认证文件路径
const getAuthFile = () => path.join(os.homedir(), '.claude', 'auth.json');

// /login - 登录
export const loginCommand: SlashCommand = {
  name: 'login',
  description: 'Login to Claude API or claude.ai',
  usage: '/login [--api-key | --oauth]',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    const { args } = ctx;
    const method = args[0] || 'interactive';

    // 检查当前认证状态
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

    let loginInfo = `Login to Claude Code:

Current Status: ${hasApiKey ? 'Authenticated (API Key)' : 'Not authenticated'}

Authentication Methods:

1. API Key (Recommended for developers):
   - Get your API key from https://console.anthropic.com
   - Set environment variable:
     export ANTHROPIC_API_KEY=sk-ant-...

2. OAuth (claude.ai account):
   - Run: claude /login --oauth
   - Opens browser for authentication
   - Requires claude.ai subscription

3. Environment Variables:
   - ANTHROPIC_API_KEY - Primary API key
   - CLAUDE_API_KEY    - Alternative API key

Configuration File:
  ~/.claude/settings.json

To verify authentication:
  /doctor

`;

    if (method === '--api-key' || method === 'api-key') {
      loginInfo += `\nAPI Key Setup:

1. Visit https://console.anthropic.com
2. Create or copy your API key
3. Set the environment variable:

   # Bash/Zsh
   export ANTHROPIC_API_KEY=sk-ant-your-key-here

   # Or add to your shell profile
   echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.bashrc

4. Restart Claude Code`;
    } else if (method === '--oauth' || method === 'oauth') {
      loginInfo += `\nOAuth Login:

This would open your browser to authenticate with claude.ai.

Note: OAuth login requires:
  - Active claude.ai subscription
  - Browser access

For now, please use API key authentication.`;
    }

    ctx.ui.addMessage('assistant', loginInfo);
    return { success: true };
  },
};

// /logout - 登出
export const logoutCommand: SlashCommand = {
  name: 'logout',
  description: 'Logout from Claude',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    const authFile = getAuthFile();

    const logoutInfo = `Logout from Claude Code:

To logout completely:

1. Remove environment variables:
   unset ANTHROPIC_API_KEY
   unset CLAUDE_API_KEY

2. Clear stored credentials:
   rm -f ${authFile}

3. Clear OAuth tokens (if used):
   rm -f ~/.claude/oauth.json

After logout:
  - You'll need to re-authenticate to use Claude
  - Session history is preserved
  - Settings are preserved

Note: If using oauth login, this will revoke your session token.`;

    ctx.ui.addMessage('assistant', logoutInfo);
    return { success: true };
  },
};

// /upgrade - 升级账户
export const upgradeCommand: SlashCommand = {
  name: 'upgrade',
  description: 'Upgrade your Claude subscription',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    const upgradeInfo = `Upgrade Claude Subscription:

Current Plans:
  Free     - Limited usage
  Pro      - Higher limits, priority access
  Team     - Collaboration features
  Max      - Maximum limits, enterprise features

To upgrade:
  1. Visit https://claude.ai/settings
  2. Select your desired plan
  3. Complete payment

API Pricing (console.anthropic.com):
  - Pay per token used
  - No subscription required
  - Best for developers

For enterprise inquiries:
  https://www.anthropic.com/contact-sales`;

    ctx.ui.addMessage('assistant', upgradeInfo);
    return { success: true };
  },
};

// /passes - Guest passes
export const passesCommand: SlashCommand = {
  name: 'passes',
  aliases: ['guest-passes'],
  description: 'View or share guest passes',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    const passesInfo = `Guest Passes:

Guest passes let you share Claude Code with friends.

Status: Feature available for Max subscribers

How it works:
  1. Max subscribers get 3 guest passes
  2. Each pass gives 1 week of Claude Code access
  3. Share via email or link

To check your passes:
  - Requires Max subscription
  - Visit https://claude.ai/settings/passes

To redeem a pass:
  - Click the shared link
  - Sign in with your account
  - Start using Claude Code`;

    ctx.ui.addMessage('assistant', passesInfo);
    return { success: true };
  },
};

// /extra-usage - 额外使用量
export const extraUsageCommand: SlashCommand = {
  name: 'extra-usage',
  description: 'Purchase extra usage beyond your plan limits',
  category: 'auth',
  execute: (ctx: CommandContext): CommandResult => {
    const extraUsageInfo = `Extra Usage:

When you reach your plan's limits, you can purchase extra usage.

Options:
  1. Wait for limit reset (usually daily/monthly)
  2. Upgrade to higher tier plan
  3. Purchase extra usage tokens

For API users:
  - Billing is automatic per-token
  - Set spend limits in console
  - No separate extra usage needed

For claude.ai users:
  - Extra usage available with some plans
  - Check https://claude.ai/settings for options

Current Limits:
  - Check /usage for your current usage
  - Check /cost for spending details`;

    ctx.ui.addMessage('assistant', extraUsageInfo);
    return { success: true };
  },
};

// 注册所有认证命令
export function registerAuthCommands(): void {
  commandRegistry.register(loginCommand);
  commandRegistry.register(logoutCommand);
  commandRegistry.register(upgradeCommand);
  commandRegistry.register(passesCommand);
  commandRegistry.register(extraUsageCommand);
}
