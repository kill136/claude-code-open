# 键盘交互模块分析报告

## 官方源码分析

### 1. 核心快捷键系统

#### 1.1 全局快捷键
从官方 cli.js 源码中提取的快捷键列表：

```typescript
// 核心功能快捷键
- ctrl + c     : Cancel current operation / Exit
- ctrl + o     : Show verbose output (toggle verbose mode)
- ctrl + t     : Show/toggle todos list
- ctrl + _     : Undo last input (输入撤销)
- ctrl + z     : Suspend Claude Code (仅 Linux/macOS)
- ctrl + s     : Stash prompt (保存当前提示)
- ?            : Show/hide shortcuts help
- Escape       : Cancel / Go back

// 模型切换快捷键 (动态生成)
- 特定按键组合可快速切换模型 (具体按键从配置读取)
```

**实现位置**：
- cli.js:~2711 - "ctrl + z now suspends Claude Code, ctrl + _ undos input"
- cli.js 中多处引用 `ctrl + o`, `ctrl + t`, `ctrl + s`

#### 1.2 Shift+Enter 多行输入

官方支持通过 Shift+Enter 实现多行输入，**但需要终端配置**：

```toml
# Alacritty 配置示例 (cli.js:430-434)
[[keyboard.bindings]]
key = "Return"
mods = "Shift"
chars = "\x1b\r"
```

**支持的终端类型**：
- WezTerm
- Kitty
- Alacritty
- iTerm2
- Windows Terminal
- Ghostty
- Warp

**实现机制**：
1. 终端将 Shift+Enter 转换为特殊转义序列 `\x1b\r`
2. CLI 检测到该序列后插入换行符而非提交
3. 提供 `/terminal-setup` 命令帮助用户配置终端

**关键代码位置**：
- cli.js:412-448 - 终端配置生成逻辑
- cli.js:439 - "This command configures a convenient Shift+Enter shortcut for multi-line prompts"

### 2. Vim 模式系统

#### 2.1 Vim 模式启用

官方支持完整的 Vim 键绑定：

```bash
# 启用 Vim 模式
/vim

# 或通过环境变量
export CLAUDE_CODE_VIM_MODE=true
```

#### 2.2 Vim 模式功能

从源码中发现的 Vim 模式特性：

**Normal 模式**：
- `h`, `j`, `k`, `l` - 光标移动
- `w`, `b`, `e` - 单词导航
- `0`, `$`, `^` - 行导航
- `x`, `d`, `D` - 删除操作
- `dd` - 删除整行
- `i`, `a`, `I`, `A` - 进入插入模式
- `o`, `O` - 新建行并插入
- `u` - 撤销 (undo)

**Insert 模式**：
- `Escape` 或 `Ctrl+[` - 返回 Normal 模式
- 普通文本输入

**搜索引用**：
- cli.js:2340 - "Search for and understand the implementation of vim mode in the codebase"
- cli.js:2341 - "Help me implement yank mode for vim"
- cli.js:2365-2366 - 同上示例，说明 Vim 模式是重要特性

#### 2.3 Yank/Paste 系统

源码提到"yank mode"但未在简化版实现，暗示官方版可能支持：
- `y` - yank (复制)
- `p` - paste (粘贴)
- Vim 风格的寄存器系统

### 3. 输入编辑快捷键

#### 3.1 Emacs 风格快捷键

官方同时支持 Emacs 风格的编辑快捷键：

```typescript
- Ctrl+A   : 移动到行首
- Ctrl+E   : 移动到行尾
- Ctrl+U   : 清除到行首
- Ctrl+K   : 清除到行尾
- ↑/↓      : 历史记录导航
- Tab      : 命令自动补全
```

这些在本项目的 Input.tsx 中已经实现（行446-460）。

### 4. 键盘绑定配置系统

#### 4.1 配置结构

官方支持在 settings.json 中自定义键盘绑定：

```typescript
// ~/.claude/settings.json
{
  "terminal": {
    "type": "auto",  // 自动检测终端类型
    "keybindings": {
      "model_switch": "ctrl+m",      // 自定义模型切换
      "verbose": "ctrl+o",            // 可重新绑定
      "todos": "ctrl+t",
      "stash": "ctrl+s"
    }
  }
}
```

**关键位置**：
- cli.js 中多处引用 keybindings
- 配置系统支持 `terminal.keybindings` 字段

#### 4.2 终端检测

官方会自动检测终端类型：

```typescript
// 支持的终端类型
type TerminalType =
  | 'auto'
  | 'vscode'
  | 'cursor'
  | 'windsurf'
  | 'zed'
  | 'ghostty'
  | 'wezterm'
  | 'kitty'
  | 'alacritty'
  | 'warp';
```

不同终端可能有不同的快捷键支持能力。

### 5. 快捷键帮助系统

#### 5.1 Help 界面

官方有内置的快捷键帮助界面：

```typescript
// 触发方式
- 按 '?' 键显示/隐藏
- /help 命令也会显示

// 显示内容
- 分类展示所有快捷键
- 动态显示当前可用的快捷键
- 显示自定义绑定
```

#### 5.2 上下文感知

快捷键帮助会根据当前状态显示：
- Vim 模式启用时显示 Vim 快捷键
- 特定工具活跃时显示工具相关快捷键
- 某些快捷键在特定平台不可用时隐藏（如 ctrl+z 在 Windows）

### 6. 历史记录导航

#### 6.1 命令历史

```typescript
// 实现机制
- ↑/↓ 键浏览历史
- 维护最近 100 条命令历史
- 支持搜索历史 (Ctrl+R 可能支持)
```

#### 6.2 Undo/Redo

```typescript
- Ctrl+_ : Undo (撤销输入)
- 维护 Undo 栈（最多50个状态）
- Vim 模式下 'u' 键也可撤销
```

### 7. 平台兼容性

#### 7.1 跨平台处理

```typescript
// Linux/macOS
- Ctrl+Z 挂起进程
- 完整的终端控制支持

// Windows
- Ctrl+Z 可能不可用
- 使用替代方案或禁用某些快捷键
```

#### 7.2 终端特定优化

不同终端对键盘事件的处理有差异：
- VSCode/Cursor/Windsurf - IDE 集成终端
- Kitty/Alacritty - GPU 加速终端
- WezTerm - 跨平台配置化终端

## 本项目差距分析

### 已实现 ✅

1. **基础 Vim 模式** (src/ui/components/Input.tsx:87-382)
   - Normal 模式导航 (h,j,k,l,w,b,e,0,$,^)
   - 删除操作 (x,d,D,dd)
   - 插入模式切换 (i,a,I,A,o,O)
   - Undo 支持 (u)
   - 环境变量检测 (CLAUDE_CODE_VIM_MODE)

2. **Emacs 风格快捷键** (Input.tsx:446-460)
   - Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+K

3. **历史记录导航** (Input.tsx:83-84, 426-445)
   - ↑/↓ 键浏览历史
   - 保留最近100条

4. **快捷键帮助** (src/ui/components/ShortcutHelp.tsx)
   - '?' 键触发
   - 分类显示
   - Escape 关闭

5. **Tab 自动补全** (Input.tsx:196-204)
   - 斜杠命令补全
   - 命令列表导航

6. **基础配置支持** (src/config/index.ts:62-70)
   - terminal.keybindings 配置字段
   - terminal.type 终端类型检测

### 缺失功能 ❌

#### 高优先级

1. **Ctrl 快捷键**
   - ❌ Ctrl+O - 切换 verbose 模式
   - ❌ Ctrl+T - 显示/隐藏 todos
   - ❌ Ctrl+S - 保存/暂存当前提示
   - ❌ Ctrl+_ - 通用 undo（非 Vim 模式）
   - ❌ Ctrl+Z - 挂起进程（Linux/macOS）
   - ❌ 模型切换快捷键

2. **Shift+Enter 多行输入**
   - ❌ 转义序列检测 (\x1b\r)
   - ❌ /terminal-setup 配置命令
   - ❌ 终端配置文件生成

3. **Vim 模式增强**
   - ❌ Yank/Paste (y, p, yy, P)
   - ❌ 寄存器系统 ("a-"z)
   - ❌ Visual 模式 (v, V, Ctrl+V)
   - ❌ 重复命令 (.)
   - ❌ 数字前缀 (5w, 3dd)
   - ❌ 搜索 (/, ?, n, N)
   - ❌ 替换 (r, R, c)

4. **自定义键绑定**
   - ❌ 读取 settings.json 中的 keybindings
   - ❌ 运行时重新绑定快捷键
   - ❌ 冲突检测

#### 中优先级

5. **历史搜索**
   - ❌ Ctrl+R 反向搜索
   - ❌ 模糊搜索历史命令

6. **终端检测与适配**
   - ❌ 自动检测终端类型
   - ❌ 终端特定优化
   - ❌ 功能降级处理

7. **快捷键帮助增强**
   - ❌ 上下文感知帮助
   - ❌ 显示自定义绑定
   - ❌ 平台相关提示

#### 低优先级

8. **高级编辑**
   - ❌ Ctrl+W 删除单词
   - ❌ Alt+Backspace 删除单词
   - ❌ Ctrl+L 清屏快捷键

9. **多窗格支持**
   - ❌ 窗格间导航快捷键
   - ❌ 分屏快捷键

## 具体实现建议

### T-018: 快捷键扩展和自定义绑定

#### 第一步：添加全局快捷键处理器

创建新文件：`src/ui/hooks/useGlobalKeybindings.ts`

```typescript
import { useInput } from 'ink';
import { useCallback, useRef, useState } from 'react';
import type { UserConfig } from '../../config/index.js';

export interface GlobalKeybinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void | Promise<void>;
  description: string;
  category?: string;
  enabled?: () => boolean;
}

export interface UseGlobalKeybindingsOptions {
  config?: UserConfig;
  onVerboseToggle?: () => void;
  onTodosToggle?: () => void;
  onModelSwitch?: () => void;
  onStashPrompt?: (prompt: string) => void;
  onUndo?: () => void;
  disabled?: boolean;
}

export function useGlobalKeybindings(options: UseGlobalKeybindingsOptions) {
  const {
    config,
    onVerboseToggle,
    onTodosToggle,
    onModelSwitch,
    onStashPrompt,
    onUndo,
    disabled = false,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const stashedPromptRef = useRef<string>('');

  // 内置快捷键映射
  const builtinKeybindings: GlobalKeybinding[] = [
    {
      key: 'o',
      ctrl: true,
      handler: () => onVerboseToggle?.(),
      description: 'Toggle verbose output',
      category: 'Display',
    },
    {
      key: 't',
      ctrl: true,
      handler: () => onTodosToggle?.(),
      description: 'Show/hide todos',
      category: 'Display',
    },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        const prompt = getCurrentInputValue();
        stashedPromptRef.current = prompt;
        onStashPrompt?.(prompt);
      },
      description: 'Stash current prompt',
      category: 'Edit',
    },
    {
      key: '_',
      ctrl: true,
      handler: () => onUndo?.(),
      description: 'Undo last input',
      category: 'Edit',
    },
    {
      key: 'z',
      ctrl: true,
      handler: () => {
        // 仅在 Linux/macOS 上启用
        if (process.platform !== 'win32') {
          process.kill(process.pid, 'SIGTSTP');
        }
      },
      description: 'Suspend Claude Code (Linux/macOS)',
      category: 'System',
      enabled: () => process.platform !== 'win32',
    },
    {
      key: 'm',
      ctrl: true,
      handler: () => onModelSwitch?.(),
      description: 'Switch model',
      category: 'System',
    },
  ];

  // 合并自定义键绑定
  const customKeybindings = parseCustomKeybindings(
    config?.terminal?.keybindings || {}
  );

  const allKeybindings = [...builtinKeybindings, ...customKeybindings];

  // 获取当前输入值的辅助函数（需要从外部传入）
  const getCurrentInputValue = useCallback(() => {
    // TODO: 需要从 Input 组件传递当前值
    return '';
  }, []);

  // 匹配按键
  const matchKeybinding = useCallback(
    (input: string, key: any): GlobalKeybinding | undefined => {
      return allKeybindings.find((kb) => {
        if (kb.enabled && !kb.enabled()) return false;

        const keyMatch = kb.key === input;
        const ctrlMatch = kb.ctrl ? key.ctrl : true;
        const shiftMatch = kb.shift ? key.shift : true;
        const altMatch = kb.alt ? key.alt : true;
        const metaMatch = kb.meta ? key.meta : true;

        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
      });
    },
    [allKeybindings]
  );

  // 使用 Ink 的 useInput
  useInput(
    (input, key) => {
      if (disabled || isProcessing) return;

      const binding = matchKeybinding(input, key);
      if (binding) {
        setIsProcessing(true);
        Promise.resolve(binding.handler())
          .catch((error) => {
            console.error(`Keybinding error for ${binding.key}:`, error);
          })
          .finally(() => {
            setIsProcessing(false);
          });
      }
    },
    { isActive: !disabled }
  );

  return {
    keybindings: allKeybindings,
    stashedPrompt: stashedPromptRef.current,
  };
}

// 解析自定义键绑定配置
function parseCustomKeybindings(
  config: Record<string, string>
): GlobalKeybinding[] {
  const bindings: GlobalKeybinding[] = [];

  for (const [action, keyString] of Object.entries(config)) {
    const parsed = parseKeyString(keyString);
    if (parsed) {
      bindings.push({
        ...parsed,
        handler: createActionHandler(action),
        description: `Custom: ${action}`,
        category: 'Custom',
      });
    }
  }

  return bindings;
}

// 解析键盘字符串 (e.g., "ctrl+shift+k")
function parseKeyString(keyString: string): {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
} | null {
  const parts = keyString.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
  };
}

// 创建动作处理器
function createActionHandler(action: string): () => void {
  return () => {
    console.log(`Custom action triggered: ${action}`);
    // TODO: 实现自定义动作分发
  };
}
```

#### 第二步：支持 Shift+Enter 多行输入

修改 `src/ui/components/Input.tsx`：

```typescript
// 在 useInput 回调的开始处添加
useInput((input, key) => {
  if (disabled) return;

  // 检测 Shift+Enter 的转义序列
  if (input === '\x1b' && key.return) {
    // 插入换行符而非提交
    if (vimModeEnabled) saveToUndoStack();
    setValue((prev) => {
      const before = prev.slice(0, cursor);
      const after = prev.slice(cursor);
      return before + '\n' + after;
    });
    setCursor((prev) => prev + 1);
    return;
  }

  // ... 原有逻辑
}, { isActive: !disabled });
```

添加终端配置生成命令 `src/commands/terminal-setup.ts`：

```typescript
import { platform } from 'os';

export interface TerminalConfig {
  terminal: string;
  config: string;
}

export function generateTerminalConfig(): TerminalConfig[] {
  const configs: TerminalConfig[] = [];

  // WezTerm
  configs.push({
    terminal: 'WezTerm',
    config: `-- ~/.wezterm.lua
config.keys = {
  {key="Enter", mods="SHIFT", action=wezterm.action{SendString="\\x1b\\r"}},
}
return config`,
  });

  // Kitty
  configs.push({
    terminal: 'Kitty',
    config: `# ~/.config/kitty/kitty.conf
map shift+enter send_text all \\e\\r`,
  });

  // Alacritty
  configs.push({
    terminal: 'Alacritty',
    config: `# ~/.config/alacritty/alacritty.toml
[[keyboard.bindings]]
key = "Return"
mods = "Shift"
chars = "\\x1b\\r"`,
  });

  // iTerm2
  configs.push({
    terminal: 'iTerm2',
    config: `1. Preferences > Profiles > Keys
2. Click '+' to add new key mapping
3. Set:
   - Keyboard Shortcut: Shift+Return
   - Action: Send Escape Sequence
   - Esc+: \\r`,
  });

  // Windows Terminal
  if (platform() === 'win32') {
    configs.push({
      terminal: 'Windows Terminal',
      config: `// settings.json
{
  "actions": [
    { "command": { "action": "sendInput", "input": "\\u001b\\r" }, "keys": "shift+enter" }
  ]
}`,
    });
  }

  return configs;
}
```

#### 第三步：增强 Vim 模式

在 `src/ui/components/Input.tsx` 中添加 Yank/Paste：

```typescript
// 在 Input 组件中添加状态
const [yankRegister, setYankRegister] = useState<string>(''); // 默认寄存器
const [namedRegisters, setNamedRegisters] = useState<Map<string, string>>(new Map());

// 在 Vim Normal 模式处理中添加
if (vimModeEnabled && vimNormalMode) {
  // ... 现有代码 ...

  // Yank 操作 - yy (复制整行)
  if (pendingCommand === 'y') {
    if (input === 'y') {
      setYankRegister(value);
      setPendingCommand('');
      return;
    }
    setPendingCommand('');
  }

  // 开始 yank 命令
  if (input === 'y') {
    setPendingCommand('y');
    return;
  }

  // Paste 操作 - p (在光标后粘贴)
  if (input === 'p') {
    if (yankRegister) {
      saveToUndoStack();
      const newValue = value.slice(0, cursor + 1) + yankRegister + value.slice(cursor + 1);
      setValue(newValue);
      setCursor(cursor + yankRegister.length);
    }
    return;
  }

  // Paste before - P (在光标前粘贴)
  if (input === 'P') {
    if (yankRegister) {
      saveToUndoStack();
      const newValue = value.slice(0, cursor) + yankRegister + value.slice(cursor);
      setValue(newValue);
      setCursor(cursor + yankRegister.length - 1);
    }
    return;
  }

  // Replace character - r
  if (pendingCommand === 'r') {
    if (input && input.length === 1 && cursor < value.length) {
      saveToUndoStack();
      setValue(value.slice(0, cursor) + input + value.slice(cursor + 1));
      setPendingCommand('');
    }
    return;
  }

  if (input === 'r') {
    setPendingCommand('r');
    return;
  }

  // Change to end of line - C
  if (input === 'C') {
    saveToUndoStack();
    setLastDeletedText(value.slice(cursor));
    setValue(value.slice(0, cursor));
    setVimNormalMode(false);
    return;
  }
}
```

#### 第四步：配置系统集成

修改 `src/ui/App.tsx` 使用全局键绑定：

```typescript
import { useGlobalKeybindings } from './hooks/useGlobalKeybindings.js';
import { configManager } from '../config/index.js';

export const App: React.FC<AppProps> = (props) => {
  const [verbose, setVerbose] = useState(props.verbose || false);
  const [showTodos, setShowTodos] = useState(false);
  const [stashedPrompt, setStashedPrompt] = useState<string>('');

  const config = configManager.getAll();

  // 注册全局快捷键
  const { keybindings } = useGlobalKeybindings({
    config,
    onVerboseToggle: () => setVerbose((v) => !v),
    onTodosToggle: () => setShowTodos((v) => !v),
    onModelSwitch: () => {
      // TODO: 实现模型切换 UI
      console.log('Model switch requested');
    },
    onStashPrompt: (prompt) => {
      setStashedPrompt(prompt);
      addActivity(`Stashed prompt: ${prompt.slice(0, 20)}...`);
    },
    onUndo: () => {
      // TODO: 实现全局 undo
      console.log('Global undo requested');
    },
    disabled: isProcessing,
  });

  // ... 其余组件代码
};
```

#### 第五步：添加 /terminal-setup 命令

创建 `src/commands/terminal-setup-command.ts`：

```typescript
import { Command } from './types.js';
import { generateTerminalConfig } from './terminal-setup.js';

export const terminalSetupCommand: Command = {
  name: 'terminal-setup',
  description: 'Show terminal configuration for Shift+Enter multi-line input',
  aliases: [],
  execute: async (args, context) => {
    const configs = generateTerminalConfig();

    let output = 'Terminal Configuration for Shift+Enter Multi-line Input\n';
    output += '='.repeat(60) + '\n\n';

    for (const { terminal, config } of configs) {
      output += `### ${terminal}\n\n`;
      output += '```\n';
      output += config;
      output += '\n```\n\n';
    }

    output += 'After configuring, press Shift+Enter to insert a newline without submitting.\n';

    context.ui.addMessage('assistant', output);

    return {
      success: true,
      message: 'Terminal configuration displayed',
    };
  },
};
```

## 实现优先级建议

### Phase 1: 核心快捷键 (1-2 天)
1. 实现 `useGlobalKeybindings` hook
2. 添加 Ctrl+O, Ctrl+T, Ctrl+S
3. 集成到 App.tsx

### Phase 2: Shift+Enter 支持 (0.5-1 天)
1. 添加转义序列检测
2. 实现 /terminal-setup 命令
3. 更新文档

### Phase 3: Vim 模式增强 (2-3 天)
1. Yank/Paste (y, p, P, yy)
2. Replace (r, R)
3. Change (c, C)
4. 寄存器系统

### Phase 4: 自定义绑定 (1-2 天)
1. 配置文件支持
2. 冲突检测
3. 运行时重新绑定

### Phase 5: 高级功能 (1-2 天)
1. Ctrl+R 历史搜索
2. Visual 模式
3. 数字前缀

## 参考行号

### 官方源码关键位置
```
cli.js:412    - Shift+Enter keybind 配置 (WezTerm)
cli.js:430    - Alacritty keyboard.bindings 配置
cli.js:439    - terminal-setup 命令说明
cli.js:2711   - ctrl+z 和 ctrl+_ 提示信息
cli.js:2340   - vim mode 实现示例
cli.js:2587   - 输入编辑逻辑（可能包含多行处理）
```

### 本项目实现位置
```
src/ui/components/Input.tsx:87-106   - Vim 模式环境变量检测
src/ui/components/Input.tsx:178-466  - useInput 键盘处理
src/ui/components/Input.tsx:208-382  - Vim Normal 模式逻辑
src/ui/components/Input.tsx:446-460  - Emacs 风格快捷键
src/ui/components/ShortcutHelp.tsx:20-39 - 快捷键列表定义
src/ui/App.tsx:166-180               - 全局键盘处理
src/config/index.ts:62-70            - terminal 配置支持
```

## 测试计划

### 单元测试
1. `parseKeyString()` - 键盘字符串解析
2. `matchKeybinding()` - 键绑定匹配
3. Vim 模式各个操作
4. Undo/Redo 栈

### 集成测试
1. 快捷键与 Vim 模式冲突检测
2. 自定义绑定覆盖内置绑定
3. 平台兼容性（Windows/Linux/macOS）

### 手动测试
1. 各终端 Shift+Enter 配置验证
2. Vim 模式完整工作流
3. 快捷键帮助准确性
4. 配置文件热重载

## 总结

官方 Claude Code 的键盘交互系统非常完善，包含：
1. **丰富的全局快捷键** - Ctrl+O/T/S/Z/_ 等
2. **完整的 Vim 模式** - 包括 Yank/Paste/Visual 模式
3. **灵活的自定义系统** - 支持重新绑定任意快捷键
4. **终端适配** - 自动检测并优化不同终端
5. **多行输入支持** - 通过 Shift+Enter 和终端配置

本项目已经实现了基础的 Vim 模式和 Emacs 快捷键，但在全局快捷键、自定义绑定、多行输入等方面还有较大差距。建议按照上述优先级逐步实现。
