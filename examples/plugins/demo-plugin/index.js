/**
 * 演示插件 - 展示 Claude Code 插件系统的所有功能
 *
 * 本插件演示了：
 * 1. 生命周期钩子 (init, activate, deactivate)
 * 2. 工具注册 (Tools)
 * 3. 命令注册 (Commands)
 * 4. 技能注册 (Skills/Prompts)
 * 5. 钩子注册 (Hooks)
 * 6. 配置管理
 * 7. 日志记录
 * 8. 文件系统访问
 */

export default {
  metadata: {
    name: 'demo-plugin',
    version: '1.0.0',
    description: '演示插件 - 展示所有插件系统功能',
    author: 'Claude Code Team',
    license: 'MIT',
    engines: {
      'claude-code': '^2.0.0',
      'node': '>=18.0.0'
    }
  },

  /**
   * 初始化插件
   * 在插件加载时调用，用于设置基本配置
   */
  async init(context) {
    context.logger.info('初始化演示插件...');

    // 设置默认配置
    if (!context.config.has('greeting')) {
      await context.config.set('greeting', 'Hello from Demo Plugin!');
    }

    if (!context.config.has('counter')) {
      await context.config.set('counter', 0);
    }

    context.logger.info('演示插件初始化完成');
  },

  /**
   * 激活插件
   * 在 init 之后调用，用于注册功能
   */
  async activate(context) {
    context.logger.info('激活演示插件...');

    // ============ 1. 注册工具 ============

    context.tools.register({
      name: 'demo_hello',
      description: '演示工具：打印问候语',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '要问候的名字'
          },
          formal: {
            type: 'boolean',
            description: '是否使用正式问候',
            default: false
          }
        },
        required: ['name']
      }
    });

    context.tools.register({
      name: 'demo_counter',
      description: '演示工具：递增计数器并返回当前值',
      inputSchema: {
        type: 'object',
        properties: {
          increment: {
            type: 'number',
            description: '递增的值',
            default: 1
          }
        }
      }
    });

    // ============ 2. 注册命令 ============

    context.commands.register({
      name: 'demo-status',
      description: '显示演示插件的状态',
      usage: 'demo-status',
      examples: [
        'claude demo-status'
      ],
      async execute(args, ctx) {
        const config = ctx.config.getAll();
        ctx.logger.info('=== 演示插件状态 ===');
        ctx.logger.info(`插件名称: ${ctx.pluginName}`);
        ctx.logger.info(`配置: ${JSON.stringify(config, null, 2)}`);

        const tools = ctx.tools.getRegistered();
        ctx.logger.info(`注册的工具数: ${tools.length}`);

        const commands = ctx.commands.getRegistered();
        ctx.logger.info(`注册的命令数: ${commands.length}`);
      }
    });

    context.commands.register({
      name: 'demo-reset',
      description: '重置演示插件的计数器',
      usage: 'demo-reset',
      async execute(args, ctx) {
        await ctx.config.set('counter', 0);
        ctx.logger.info('计数器已重置为 0');
      }
    });

    // ============ 3. 注册技能/提示词 ============

    context.skills.register({
      name: 'code-review',
      description: '代码审查技能：帮助审查代码质量',
      category: 'coding',
      prompt: `请审查以下代码，关注以下方面：
1. 代码质量和可读性
2. 潜在的 bug 和错误
3. 性能问题
4. 安全隐患
5. 最佳实践

代码语言：{language}
代码内容：
{code}

请提供详细的审查意见和改进建议。`,
      parameters: [
        {
          name: 'language',
          description: '代码语言（如：JavaScript, Python, Java）',
          required: true,
          type: 'string'
        },
        {
          name: 'code',
          description: '要审查的代码',
          required: true,
          type: 'string'
        }
      ],
      examples: [
        '/code-review language=JavaScript code="const x = 1; x = 2;"'
      ]
    });

    context.skills.register({
      name: 'explain-code',
      description: '代码解释技能：解释代码的功能',
      category: 'coding',
      prompt: `请解释以下代码的功能和工作原理：

语言：{language}
代码：
{code}

请用通俗易懂的语言解释，适合{level}水平的开发者。`,
      parameters: [
        {
          name: 'language',
          description: '代码语言',
          required: true,
          type: 'string'
        },
        {
          name: 'code',
          description: '要解释的代码',
          required: true,
          type: 'string'
        },
        {
          name: 'level',
          description: '目标读者水平（初级/中级/高级）',
          required: false,
          type: 'string'
        }
      ],
      examples: [
        '/explain-code language=Python code="def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)" level=初级'
      ]
    });

    context.skills.register({
      name: 'write-tests',
      description: '测试编写技能：为代码生成单元测试',
      category: 'testing',
      prompt: `请为以下代码编写单元测试：

语言：{language}
测试框架：{framework}
代码：
{code}

要求：
1. 覆盖主要功能和边界情况
2. 包含正面和负面测试用例
3. 遵循 {framework} 的最佳实践
4. 添加必要的注释说明`,
      parameters: [
        {
          name: 'language',
          description: '代码语言',
          required: true,
          type: 'string'
        },
        {
          name: 'framework',
          description: '测试框架（如：Jest, Mocha, pytest）',
          required: true,
          type: 'string'
        },
        {
          name: 'code',
          description: '要测试的代码',
          required: true,
          type: 'string'
        }
      ],
      examples: [
        '/write-tests language=JavaScript framework=Jest code="function add(a, b) { return a + b; }"'
      ]
    });

    // ============ 4. 注册钩子 ============

    context.hooks.on('beforeMessage', async (message) => {
      context.logger.debug('钩子: beforeMessage 被触发');
      // 可以修改消息或执行其他操作
      return message;
    });

    context.hooks.on('afterMessage', async (message) => {
      context.logger.debug('钩子: afterMessage 被触发');
      return message;
    });

    context.hooks.on('beforeToolCall', async (toolCall) => {
      context.logger.debug(`钩子: beforeToolCall - ${toolCall.name}`);
      return toolCall;
    });

    context.hooks.on('afterToolCall', async (result) => {
      context.logger.debug('钩子: afterToolCall 被触发');
      return result;
    });

    context.hooks.on('onError', async (error) => {
      context.logger.error(`钩子: 捕获错误 - ${error.message}`);
      return error;
    });

    // ============ 5. 监听插件事件 ============

    context.events.on('demo-event', (data) => {
      context.logger.info(`接收到演示事件: ${JSON.stringify(data)}`);
    });

    context.logger.info('演示插件激活完成');
    context.logger.info('已注册 2 个工具、2 个命令、3 个技能、5 个钩子');
  },

  /**
   * 停用插件
   * 在插件卸载时调用，用于清理资源
   */
  async deactivate() {
    console.log('[Demo Plugin] 演示插件正在停用...');
    // 清理资源、关闭连接等
    console.log('[Demo Plugin] 演示插件已停用');
  },

  /**
   * 执行工具
   * 处理工具调用
   */
  async executeTool(toolName, input) {
    if (toolName === 'demo_hello') {
      const { name, formal = false } = input;
      const greeting = formal
        ? `尊敬的 ${name}，您好！`
        : `嗨，${name}！`;

      return {
        success: true,
        output: greeting
      };
    }

    if (toolName === 'demo_counter') {
      const { increment = 1 } = input;

      // 注意：这里无法直接访问 context，需要通过其他方式管理状态
      // 在实际应用中，可以在 activate 时保存 context 引用

      return {
        success: true,
        output: `计数器递增 ${increment}（注意：需要在插件中保存 context 引用才能访问配置）`,
        metadata: {
          increment,
          note: '这是一个演示，实际应用中需要正确管理状态'
        }
      };
    }

    return {
      success: false,
      error: `未知工具: ${toolName}`
    };
  }
};
