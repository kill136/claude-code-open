# Plugin System API Documentation

Complete reference for the Claude Code plugin development system.

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Plugin Structure](#plugin-structure)
- [Plugin Context](#plugin-context)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Creating a Plugin](#creating-a-plugin)
- [Plugin Manager API](#plugin-manager-api)
- [Tool Registration](#tool-registration)
- [Command Registration](#command-registration)
- [Hook Registration](#hook-registration)
- [Plugin Configuration](#plugin-configuration)
- [Dependency Management](#dependency-management)
- [Hot Reload](#hot-reload)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The Claude Code plugin system allows you to extend functionality through third-party plugins. Plugins can:

- **Add tools** - Register custom tools in the tool registry
- **Add commands** - Register slash commands
- **Add hooks** - Register lifecycle hooks
- **Access configuration** - Store and retrieve plugin-specific settings
- **Access filesystem** - Read/write files within plugin directory (sandboxed)
- **Emit events** - Communicate with other plugins
- **Log messages** - Use structured logging

### Key Features

- **Isolated execution** - Plugins run in their own context
- **Dependency management** - Plugins can depend on other plugins
- **Version compatibility** - Automatic version checking
- **Hot reload** - Development mode with automatic reloading
- **Security** - Sandboxed filesystem access
- **Type safety** - Full TypeScript support
- **Event system** - Inter-plugin communication

---

## Plugin Architecture

### Component Overview

```
PluginManager
├── Plugin Discovery
│   └── Scans ~/.claude/plugins/ and .claude/plugins/
├── Plugin Loading
│   ├── Dependency Resolution
│   ├── Version Checking
│   └── Topological Sorting
├── Plugin Context
│   ├── Configuration API
│   ├── Logging API
│   ├── Filesystem API (sandboxed)
│   ├── Tool API
│   ├── Command API
│   ├── Hook API
│   └── Event System
└── Plugin Lifecycle
    ├── init()
    ├── activate()
    └── deactivate()
```

### Plugin Locations

Plugins are discovered in:

1. **User plugins**: `~/.claude/plugins/`
2. **Project plugins**: `.claude/plugins/` (current directory)

Each plugin is a directory with a `package.json` file.

---

## Plugin Structure

### Directory Layout

```
my-plugin/
├── package.json          # Plugin metadata
├── index.js              # Main entry point
├── README.md             # Documentation
├── config.json           # Default configuration (optional)
└── lib/                  # Additional files
    ├── tools.js
    ├── commands.js
    └── hooks.js
```

### package.json

```json
{
  "name": "my-claude-plugin",
  "version": "1.0.0",
  "description": "My awesome Claude Code plugin",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "claude-code": "^2.0.0"
  },
  "claudePluginDependencies": {
    "other-plugin": "^1.0.0"
  }
}
```

**Fields:**
- `name` **(required)** - Unique plugin name
- `version` **(required)** - Semantic version
- `description` - Plugin description
- `main` - Entry point (default: `index.js`)
- `engines.node` - Minimum Node.js version
- `engines.claude-code` - Claude Code version requirement
- `claudePluginDependencies` - Other plugins this plugin depends on

### index.js (Entry Point)

```javascript
export default {
  metadata: {
    name: 'my-claude-plugin',
    version: '1.0.0',
    description: 'My awesome plugin'
  },

  async init(context) {
    // Plugin initialization
  },

  async activate(context) {
    // Plugin activation
  },

  async deactivate() {
    // Plugin cleanup
  }
};
```

---

## Plugin Context

The plugin context provides APIs for interacting with Claude Code.

### PluginContext Interface

```typescript
interface PluginContext {
  // Plugin information
  pluginName: string;
  pluginPath: string;

  // Configuration management
  config: PluginConfigAPI;

  // Logging
  logger: PluginLogger;

  // Sandboxed filesystem access
  fs: PluginFileSystemAPI;

  // Tool registration
  tools: PluginToolAPI;

  // Command registration
  commands: PluginCommandAPI;

  // Hook registration
  hooks: PluginHookAPI;

  // Event system
  events: EventEmitter;
}
```

### Configuration API

```typescript
interface PluginConfigAPI {
  // Get configuration value
  get<T>(key: string, defaultValue?: T): T | undefined;

  // Set configuration value
  set(key: string, value: unknown): Promise<void>;

  // Get all configuration
  getAll(): Record<string, unknown>;

  // Check if key exists
  has(key: string): boolean;

  // Delete configuration value
  delete(key: string): Promise<void>;
}
```

**Example:**
```javascript
async activate(context) {
  // Get configuration
  const apiUrl = context.config.get('apiUrl', 'https://api.example.com');
  const timeout = context.config.get('timeout', 30000);

  // Set configuration
  await context.config.set('lastRun', Date.now());

  // Check existence
  if (context.config.has('customSetting')) {
    // Use custom setting
  }
}
```

### Logger API

```typescript
interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

**Example:**
```javascript
async activate(context) {
  context.logger.info('Plugin activated');
  context.logger.debug('Configuration loaded', context.config.getAll());

  try {
    await riskyOperation();
  } catch (error) {
    context.logger.error('Operation failed', error);
  }
}
```

### Filesystem API (Sandboxed)

```typescript
interface PluginFileSystemAPI {
  // Read file (within plugin directory)
  readFile(relativePath: string): Promise<string>;

  // Write file (within plugin directory)
  writeFile(relativePath: string, content: string): Promise<void>;

  // Check file existence
  exists(relativePath: string): Promise<boolean>;

  // List directory contents
  readdir(relativePath?: string): Promise<string[]>;
}
```

**Example:**
```javascript
async activate(context) {
  // Read plugin file
  const config = await context.fs.readFile('config.json');

  // Write log file
  await context.fs.writeFile('logs/activity.log', logData);

  // Check if file exists
  if (await context.fs.exists('data.json')) {
    const data = await context.fs.readFile('data.json');
  }

  // List files
  const files = await context.fs.readdir('templates');
}
```

**Security Note:** File access is restricted to the plugin directory. Attempts to access parent directories will throw an error.

### Tool API

```typescript
interface PluginToolAPI {
  // Register a tool
  register(tool: ToolDefinition): void;

  // Unregister a tool
  unregister(toolName: string): void;

  // Get all registered tools
  getRegistered(): ToolDefinition[];
}
```

### Command API

```typescript
interface PluginCommandAPI {
  // Register a command
  register(command: CommandDefinition): void;

  // Unregister a command
  unregister(commandName: string): void;

  // Get all registered commands
  getRegistered(): CommandDefinition[];
}
```

### Hook API

```typescript
interface PluginHookAPI {
  // Register a hook
  on(hookType: PluginHookType, handler: HookHandler): void;

  // Unregister a hook
  off(hookType: PluginHookType, handler: HookHandler): void;

  // Get all registered hooks
  getRegistered(): Array<{ type: PluginHookType; handler: HookHandler }>;
}
```

**Plugin Hook Types:**
```typescript
type PluginHookType =
  | 'beforeMessage'      // Before sending message to API
  | 'afterMessage'       // After receiving response
  | 'beforeToolCall'     // Before tool execution
  | 'afterToolCall'      // After tool execution
  | 'onError'            // When error occurs
  | 'onSessionStart'     // When session starts
  | 'onSessionEnd'       // When session ends
  | 'onPluginLoad'       // When plugin is loaded
  | 'onPluginUnload';    // When plugin is unloaded
```

### Event System

```typescript
// Plugin context provides an EventEmitter
context.events.on('custom-event', (data) => {
  context.logger.info('Custom event received', data);
});

context.events.emit('custom-event', { foo: 'bar' });
```

---

## Plugin Lifecycle

### Lifecycle Phases

```
1. Discovery    → Find plugins in plugin directories
2. Load         → Import plugin module
3. Init         → Call init() method
4. Activate     → Call activate() method
5. Execute      → Plugin is active and functional
6. Deactivate   → Call deactivate() method
7. Unload       → Clean up and remove from memory
```

### Lifecycle Methods

#### init(context)

Called once when the plugin is first loaded. Use for one-time setup.

```javascript
async init(context) {
  // Initialize resources
  this.database = await initDatabase();

  // Load configuration
  this.config = await context.fs.readFile('config.json');

  // Set up data structures
  this.cache = new Map();

  context.logger.info('Plugin initialized');
}
```

#### activate(context)

Called after initialization. Use for registering tools, commands, and hooks.

```javascript
async activate(context) {
  // Register tools
  context.tools.register({
    name: 'MyTool',
    description: 'Does something useful',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    }
  });

  // Register commands
  context.commands.register({
    name: 'my-command',
    description: 'My custom command',
    execute: async (args, ctx) => {
      ctx.logger.info('Command executed');
    }
  });

  // Register hooks
  context.hooks.on('beforeToolCall', async (toolContext) => {
    context.logger.debug('Tool about to execute:', toolContext.toolName);
  });

  context.logger.info('Plugin activated');
}
```

#### deactivate()

Called when the plugin is unloaded. Use for cleanup.

```javascript
async deactivate() {
  // Close connections
  await this.database.close();

  // Clear caches
  this.cache.clear();

  // Stop background tasks
  clearInterval(this.intervalId);

  console.log('Plugin deactivated');
}
```

---

## Creating a Plugin

### Step 1: Create Plugin Directory

```bash
mkdir ~/.claude/plugins/my-plugin
cd ~/.claude/plugins/my-plugin
```

### Step 2: Create package.json

```bash
npm init -y
```

Edit `package.json`:
```json
{
  "name": "my-claude-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.js",
  "engines": {
    "node": ">=18.0.0",
    "claude-code": "^2.0.0"
  }
}
```

### Step 3: Create index.js

```javascript
export default {
  metadata: {
    name: 'my-claude-plugin',
    version: '1.0.0',
    description: 'My awesome plugin',
    author: 'Your Name'
  },

  async init(context) {
    context.logger.info('Initializing my plugin');
  },

  async activate(context) {
    context.logger.info('Activating my plugin');

    // Register a custom tool
    context.tools.register({
      name: 'GreetTool',
      description: 'Greets the user',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name to greet'
          }
        },
        required: ['name']
      }
    });

    context.logger.info('Plugin activated successfully');
  },

  async deactivate() {
    console.log('Deactivating my plugin');
  },

  // Tool executor
  async executeTool(toolName, input) {
    if (toolName === 'GreetTool') {
      return {
        success: true,
        output: `Hello, ${input.name}!`
      };
    }

    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }
};
```

### Step 4: Test Plugin

```bash
# From your project directory
claude-code

# Plugin should be automatically discovered and loaded
# Use the GreetTool in conversation
```

---

## Plugin Manager API

### PluginManager Class

```typescript
class PluginManager extends EventEmitter {
  // Discover plugins
  async discover(): Promise<PluginState[]>;

  // Load a plugin
  async load(name: string, options?: { force?: boolean }): Promise<boolean>;

  // Unload a plugin
  async unload(name: string, options?: { force?: boolean }): Promise<boolean>;

  // Reload a plugin
  async reload(name: string): Promise<boolean>;

  // Load all plugins
  async loadAll(options?: { enableHotReload?: boolean }): Promise<void>;

  // Unload all plugins
  async unloadAll(): Promise<void>;

  // Get plugin
  getPlugin(name: string): Plugin | undefined;

  // Get plugin state
  getPluginState(name: string): PluginState | undefined;

  // Get all plugin states
  getPluginStates(): PluginState[];

  // Enable/disable plugin
  async setEnabled(name: string, enabled: boolean): Promise<boolean>;

  // Install plugin
  async install(sourcePath: string, options?: InstallOptions): Promise<PluginState>;

  // Uninstall plugin
  async uninstall(name: string): Promise<boolean>;

  // Get registered tools
  getTools(): ToolDefinition[];

  // Get registered commands
  getCommands(): CommandDefinition[];

  // Execute hook
  async executeHook<T>(hookType: PluginHookType, context: T): Promise<T>;

  // Enable hot reload
  enableHotReload(name: string): void;

  // Disable hot reload
  disableHotReload(name: string): void;
}
```

### Usage Example

```typescript
import { pluginManager } from './plugins/index.js';

// Discover plugins
const plugins = await pluginManager.discover();
console.log('Found plugins:', plugins.map(p => p.metadata.name));

// Load all plugins
await pluginManager.loadAll();

// Get plugin tools
const tools = pluginManager.getTools();

// Enable hot reload for development
pluginManager.enableHotReload('my-plugin');

// Listen to events
pluginManager.on('plugin:loaded', (name, plugin) => {
  console.log(`Plugin ${name} loaded`);
});
```

---

## Tool Registration

### Registering a Tool

```javascript
context.tools.register({
  name: 'MyTool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' },
      options: { type: 'object', description: 'Optional settings' }
    },
    required: ['input']
  }
});
```

### Implementing Tool Executor

```javascript
// Method 1: executeTool method
async executeTool(toolName, input) {
  if (toolName === 'MyTool') {
    // Execute tool logic
    return {
      success: true,
      output: 'Tool executed successfully'
    };
  }
}

// Method 2: Dedicated execute method
async execute_MyTool(input) {
  // Execute tool logic
  return {
    success: true,
    output: 'Tool executed successfully'
  };
}
```

### Full Example

```javascript
export default {
  metadata: {
    name: 'file-stats-plugin',
    version: '1.0.0'
  },

  async activate(context) {
    // Register tool
    context.tools.register({
      name: 'FileStats',
      description: 'Get statistics about a file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file'
          }
        },
        required: ['file_path']
      }
    });
  },

  // Tool executor
  async executeTool(toolName, input) {
    if (toolName === 'FileStats') {
      const fs = require('fs');
      const stats = fs.statSync(input.file_path);

      return {
        success: true,
        output: JSON.stringify({
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }, null, 2)
      };
    }
  }
};
```

---

## Command Registration

### Registering a Command

```javascript
context.commands.register({
  name: 'hello',
  description: 'Greet the user',
  usage: '/hello [name]',
  examples: ['/hello World', '/hello'],
  async execute(args, context) {
    const name = args[0] || 'World';
    context.logger.info(`Hello, ${name}!`);
  }
});
```

### Full Example

```javascript
async activate(context) {
  context.commands.register({
    name: 'analyze',
    description: 'Analyze current project',
    usage: '/analyze [options]',
    examples: [
      '/analyze',
      '/analyze --verbose',
      '/analyze --format json'
    ],
    async execute(args, ctx) {
      const verbose = args.includes('--verbose');
      const format = args.includes('--format')
        ? args[args.indexOf('--format') + 1]
        : 'text';

      ctx.logger.info('Starting analysis...');

      // Perform analysis
      const results = await performAnalysis(ctx.pluginPath, { verbose });

      // Format output
      if (format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`Analysis complete: ${results.summary}`);
      }

      ctx.logger.info('Analysis finished');
    }
  });
}
```

---

## Hook Registration

### Registering Hooks

```javascript
async activate(context) {
  // Before tool execution
  context.hooks.on('beforeToolCall', async (toolContext) => {
    context.logger.debug('Tool about to execute:', toolContext.toolName);

    // Optionally modify context
    toolContext.metadata = {
      timestamp: Date.now(),
      pluginVersion: '1.0.0'
    };

    return toolContext;
  });

  // After tool execution
  context.hooks.on('afterToolCall', async (result) => {
    context.logger.debug('Tool executed:', result);

    // Log to analytics
    await logToAnalytics({
      tool: result.toolName,
      success: result.success,
      duration: result.duration
    });

    return result;
  });

  // Error handling
  context.hooks.on('onError', async (error) => {
    context.logger.error('Error occurred:', error);

    // Send alert
    await sendAlert(error);
  });
}
```

### Hook Priority

```javascript
context.hooks.on('beforeMessage', async (message) => {
  // This hook has priority 10 (lower = higher priority)
  return message;
}, { priority: 10 });
```

---

## Plugin Configuration

### Default Configuration

Create `config.json` in plugin directory:

```json
{
  "apiUrl": "https://api.example.com",
  "timeout": 30000,
  "retries": 3,
  "features": {
    "caching": true,
    "compression": false
  }
}
```

### Loading Configuration

```javascript
async init(context) {
  // Load default configuration
  if (await context.fs.exists('config.json')) {
    const defaultConfig = await context.fs.readFile('config.json');
    const config = JSON.parse(defaultConfig);

    // Merge with user configuration
    for (const [key, value] of Object.entries(config)) {
      if (!context.config.has(key)) {
        await context.config.set(key, value);
      }
    }
  }
}
```

### User Configuration

Users can configure plugins in `~/.claude/plugins.json`:

```json
{
  "my-plugin": {
    "enabled": true,
    "config": {
      "apiUrl": "https://custom.api.com",
      "timeout": 60000
    }
  }
}
```

---

## Dependency Management

### Declaring Dependencies

In `package.json`:

```json
{
  "claudePluginDependencies": {
    "database-plugin": "^1.0.0",
    "auth-plugin": "^2.0.0"
  }
}
```

### Using Dependencies

```javascript
async activate(context) {
  // Dependencies are guaranteed to be loaded before this plugin
  const dbPlugin = pluginManager.getPlugin('database-plugin');
  const db = dbPlugin.getDatabase();

  // Use dependency
  await db.query('SELECT * FROM users');
}
```

### Version Compatibility

Plugin manager automatically:
- Checks version ranges
- Loads dependencies in correct order
- Detects circular dependencies
- Validates plugin compatibility

---

## Hot Reload

### Enabling Hot Reload

```typescript
import { pluginManager } from './plugins/index.js';

// Enable for specific plugin
pluginManager.enableHotReload('my-plugin');

// OR enable for all plugins
await pluginManager.loadAll({ enableHotReload: true });
```

### How It Works

1. File system watcher monitors plugin directory
2. On file change, plugin is unloaded
3. Plugin is reloaded with new code
4. `init()` and `activate()` are called again

### Development Workflow

```bash
# Terminal 1: Run Claude Code with hot reload
claude-code --hot-reload

# Terminal 2: Edit plugin
cd ~/.claude/plugins/my-plugin
vim index.js
# Save file → plugin automatically reloads
```

---

## Best Practices

### 1. Use Semantic Versioning

```json
{
  "version": "1.2.3"
  // Major.Minor.Patch
  // - Major: Breaking changes
  // - Minor: New features (backward compatible)
  // - Patch: Bug fixes
}
```

### 2. Validate Inputs

```javascript
async executeTool(toolName, input) {
  if (!input.file_path) {
    return {
      success: false,
      error: 'file_path is required'
    };
  }

  if (!input.file_path.startsWith('/')) {
    return {
      success: false,
      error: 'file_path must be absolute'
    };
  }

  // ... proceed with execution
}
```

### 3. Handle Errors Gracefully

```javascript
async executeTool(toolName, input) {
  try {
    const result = await riskyOperation(input);
    return {
      success: true,
      output: result
    };
  } catch (error) {
    return {
      success: false,
      error: `Operation failed: ${error.message}`
    };
  }
}
```

### 4. Clean Up Resources

```javascript
async deactivate() {
  // Close connections
  if (this.connection) {
    await this.connection.close();
  }

  // Clear timers
  if (this.intervalId) {
    clearInterval(this.intervalId);
  }

  // Release memory
  this.cache?.clear();
}
```

### 5. Use Configuration

```javascript
async activate(context) {
  // Make behavior configurable
  const maxRetries = context.config.get('maxRetries', 3);
  const timeout = context.config.get('timeout', 30000);
  const debugMode = context.config.get('debug', false);

  if (debugMode) {
    context.logger.debug('Debug mode enabled');
  }
}
```

### 6. Provide Good Documentation

```javascript
export default {
  metadata: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Detailed description of what plugin does',
    author: 'Your Name <email@example.com>',
    homepage: 'https://github.com/user/my-plugin',
    license: 'MIT'
  },
  // ...
};
```

### 7. Test Plugins

```javascript
// test.js
import plugin from './index.js';

async function test() {
  const mockContext = createMockContext();

  await plugin.init(mockContext);
  await plugin.activate(mockContext);

  const result = await plugin.executeTool('MyTool', { input: 'test' });

  console.assert(result.success === true);
  console.log('Tests passed!');

  await plugin.deactivate();
}

test();
```

---

## Examples

### Example 1: Simple Tool Plugin

```javascript
export default {
  metadata: {
    name: 'base64-plugin',
    version: '1.0.0',
    description: 'Encode/decode base64'
  },

  async activate(context) {
    context.tools.register({
      name: 'Base64',
      description: 'Encode or decode base64',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['encode', 'decode'] },
          text: { type: 'string' }
        },
        required: ['operation', 'text']
      }
    });
  },

  async executeTool(toolName, input) {
    if (toolName === 'Base64') {
      if (input.operation === 'encode') {
        return {
          success: true,
          output: Buffer.from(input.text).toString('base64')
        };
      } else {
        return {
          success: true,
          output: Buffer.from(input.text, 'base64').toString('utf-8')
        };
      }
    }
  }
};
```

### Example 2: Database Plugin

```javascript
import sqlite3 from 'sqlite3';

export default {
  metadata: {
    name: 'database-plugin',
    version: '1.0.0'
  },

  async init(context) {
    // Initialize database
    const dbPath = context.pluginPath + '/data.db';
    this.db = new sqlite3.Database(dbPath);

    await new Promise((resolve, reject) => {
      this.db.run('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, message TEXT)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  async activate(context) {
    context.tools.register({
      name: 'LogMessage',
      description: 'Log a message to database',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      }
    });
  },

  async executeTool(toolName, input) {
    if (toolName === 'LogMessage') {
      await new Promise((resolve, reject) => {
        this.db.run('INSERT INTO logs (message) VALUES (?)', [input.message], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return { success: true, output: 'Message logged' };
    }
  },

  async deactivate() {
    if (this.db) {
      await new Promise(resolve => this.db.close(resolve));
    }
  }
};
```

### Example 3: Analytics Plugin

```javascript
export default {
  metadata: {
    name: 'analytics-plugin',
    version: '1.0.0'
  },

  async init(context) {
    this.events = [];
  },

  async activate(context) {
    // Hook into tool executions
    context.hooks.on('afterToolCall', async (result) => {
      this.events.push({
        tool: result.toolName,
        success: result.success,
        timestamp: Date.now()
      });

      // Save to file periodically
      if (this.events.length >= 100) {
        await context.fs.writeFile(
          'analytics.json',
          JSON.stringify(this.events, null, 2)
        );
        this.events = [];
      }
    });

    // Register command to view analytics
    context.commands.register({
      name: 'analytics',
      description: 'View tool usage analytics',
      async execute(args, ctx) {
        const data = await ctx.fs.readFile('analytics.json');
        const events = JSON.parse(data);

        const toolCounts = {};
        events.forEach(e => {
          toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
        });

        console.log('Tool Usage:');
        for (const [tool, count] of Object.entries(toolCounts)) {
          console.log(`  ${tool}: ${count}`);
        }
      }
    });
  }
};
```

---

For more information, see:
- [Tool API Documentation](./tools.md)
- [Type System Documentation](./types.md)
- [Error Handling](./errors.md)
- [Hooks API](./hooks.md)
