/**
 * Hello World Plugin for Claude Code
 *
 * This plugin demonstrates:
 * - Plugin lifecycle (init, activate, deactivate)
 * - Configuration management
 * - Tool registration
 * - Command registration
 * - Hook registration
 * - Event handling
 */

export default {
  metadata: {
    name: 'hello-world',
    version: '1.0.0',
    description: 'A simple hello world plugin',
    author: 'Claude Code Team',
    engines: {
      'claude-code': '^2.0.0',
      'node': '>=18.0.0'
    }
  },

  /**
   * Initialize plugin
   * Called once when plugin is first loaded
   */
  async init(context) {
    context.logger.info('Initializing hello-world plugin');

    // Set default configuration
    if (!context.config.has('greetingPrefix')) {
      await context.config.set('greetingPrefix', 'Hello');
    }

    if (!context.config.has('callCount')) {
      await context.config.set('callCount', 0);
    }

    // Create a data file in plugin directory
    const dataExists = await context.fs.exists('data.json');
    if (!dataExists) {
      await context.fs.writeFile('data.json', JSON.stringify({
        initialized: new Date().toISOString(),
        version: this.metadata.version
      }, null, 2));
    }
  },

  /**
   * Activate plugin
   * Called when plugin is activated
   */
  async activate(context) {
    context.logger.info('Activating hello-world plugin');

    // Register a tool
    context.tools.register({
      name: 'hello',
      description: 'Say hello to someone',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name to greet'
          },
          formal: {
            type: 'boolean',
            description: 'Use formal greeting'
          }
        },
        required: ['name']
      }
    });

    // Register a command
    context.commands.register({
      name: 'hello',
      description: 'Greet someone from the command line',
      usage: 'hello [name] [--formal]',
      examples: [
        'hello Alice',
        'hello Bob --formal'
      ],
      async execute(args, ctx) {
        const name = args[0] || 'World';
        const formal = args.includes('--formal');

        const prefix = ctx.config.get('greetingPrefix', 'Hello');
        const greeting = formal
          ? `${prefix}, ${name}. How do you do?`
          : `${prefix}, ${name}!`;

        ctx.logger.info(greeting);

        // Increment call count
        let count = ctx.config.get('callCount', 0);
        count++;
        await ctx.config.set('callCount', count);

        ctx.logger.debug(`Total greetings: ${count}`);
      }
    });

    // Register hooks
    context.hooks.on('beforeMessage', async (message) => {
      context.logger.debug('Processing message in hello-world plugin');
      return message; // Return unmodified
    });

    context.hooks.on('onSessionStart', async (session) => {
      context.logger.info('Session started - hello-world plugin is ready!');
      return session;
    });

    // Listen to custom events
    context.events.on('greeting-sent', (data) => {
      context.logger.info(`Greeting sent to ${data.name}`);
    });

    context.logger.info('hello-world plugin activated successfully');
  },

  /**
   * Deactivate plugin
   * Called when plugin is deactivated
   */
  async deactivate() {
    console.log('Deactivating hello-world plugin');
    // Cleanup resources here
  },

  /**
   * Execute tool
   * Called when one of this plugin's tools is used
   */
  async executeTool(toolName, input) {
    if (toolName === 'hello') {
      const { name, formal = false } = input;

      const prefix = formal ? 'Good day' : 'Hello';
      const greeting = formal
        ? `${prefix}, ${name}. How do you do?`
        : `${prefix}, ${name}!`;

      // Emit custom event
      // Note: In real usage, get context from somewhere
      // This is simplified for demonstration

      return {
        success: true,
        output: greeting
      };
    }

    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }
};
