# Hello World Plugin

A simple demonstration plugin for Claude Code that shows how to use the plugin system.

## Features

- **Tool**: `hello` - Say hello to someone
- **Command**: `hello` - Greet someone from the command line
- **Hooks**: Registers beforeMessage and onSessionStart hooks
- **Configuration**: Stores greeting prefix and call count
- **File Storage**: Creates and manages a data.json file

## Installation

Copy this directory to `~/.claude/plugins/hello-world/` or `.claude/plugins/hello-world/`

## Usage

### Using the Tool

```javascript
const result = await pluginToolExecutor.execute('hello', {
  name: 'Alice',
  formal: false
});
console.log(result.output); // "Hello, Alice!"
```

### Using the Command

```bash
# Simple greeting
hello Alice

# Formal greeting
hello Bob --formal
```

### Configuration

The plugin uses the following configuration keys:

- `greetingPrefix` - The prefix for greetings (default: "Hello")
- `callCount` - Number of times the plugin has been called

To change the greeting prefix:

```javascript
const context = pluginManager.getPluginContext('hello-world');
await context.config.set('greetingPrefix', 'Hi');
```

## Development

To enable hot reload during development:

```javascript
pluginManager.enableHotReload('hello-world');
```

Now any changes to `index.js` will automatically reload the plugin.

## License

MIT
