# Input 组件 Vim 模式实现总结

## 概述

成功增强了 `/home/user/claude-code-open/src/ui/components/Input.tsx` 组件，添加了完整的 Vim 模式支持。

## 实现的功能

### 1. 模式系统

- **Normal 模式** - 命令模式，显示 `[N]` 指示器（黄色）
- **Insert 模式** - 插入模式，显示 `[I]` 指示器（绿色）
- **多键命令状态** - 显示 `[d]` 等待第二个按键（青色）

### 2. Normal 模式键绑定

#### 基本导航 (h, j, k, l)
```typescript
h - 光标左移
l - 光标右移
j - 历史记录向下（相当于终端的下箭头）
k - 历史记录向上（相当于终端的上箭头）
```

#### 单词导航 (w, b, e)
```typescript
w - 跳到下一个单词开头
b - 跳到上一个单词开头
e - 跳到当前/下一个单词末尾
```

实现使用正则表达式 `/\S/` 和 `/\s/` 检测单词边界。

#### 行导航 (0, $, ^)
```typescript
0 - 跳到行首
$ - 跳到行尾
^ - 跳到第一个非空白字符
```

#### 删除操作 (x, dd, D)
```typescript
x  - 删除当前字符
dd - 删除整行（多键命令）
D  - 删除到行尾
```

所有删除操作都会保存到撤销栈。

#### 撤销 (u)
```typescript
u - 撤销上一次操作
```

撤销栈保留最近 50 个状态。

#### 进入 Insert 模式
```typescript
i - 在光标前插入
a - 在光标后插入
I - 在行首插入
A - 在行尾插入
o - 在行尾插入（单行模式适配）
O - 在行首插入（单行模式适配）
```

### 3. Insert 模式键绑定

#### 退出 Insert 模式
```typescript
ESC      - 返回 Normal 模式
Ctrl+[   - 返回 Normal 模式（标准 Vim 快捷键）
```

退出时自动将光标左移一位（Vim 标准行为）。

#### 标准编辑键
- 字符输入
- `Backspace` / `Delete` - 删除字符（保存到撤销栈）
- 箭头键 - 移动光标
- `Ctrl+A` - 跳到行首
- `Ctrl+E` - 跳到行尾
- `Ctrl+U` - 清除到行首（保存到撤销栈）
- `Ctrl+K` - 清除到行尾（保存到撤销栈）

### 4. 环境变量控制

```bash
export CLAUDE_CODE_VIM_MODE=true   # 启用 Vim 模式
export CLAUDE_CODE_VIM_MODE=false  # 禁用 Vim 模式
```

组件通过轮询（500ms 间隔）检测环境变量变化，实现动态切换。

### 5. 斜杠命令集成

- 在 Insert 模式下输入 `/` 触发命令自动补全
- Normal 模式下命令补全不可用（需先按 `i` 进入 Insert 模式）
- 历史记录导航在两种模式下都可用

## 代码结构

### 状态变量

```typescript
const [vimModeEnabled, setVimModeEnabled] = useState(...)    // Vim 模式开关
const [vimNormalMode, setVimNormalMode] = useState(...)      // Normal/Insert 模式
const [undoStack, setUndoStack] = useState([])               // 撤销栈
const [lastDeletedText, setLastDeletedText] = useState('')   // 最后删除的文本
const [pendingCommand, setPendingCommand] = useState('')     // 多键命令状态
```

### 辅助函数

```typescript
saveToUndoStack()           // 保存当前状态到撤销栈
undo()                      // 执行撤销操作
findNextWordStart()         // 查找下一个单词开头
findPrevWordStart()         // 查找上一个单词开头
findWordEnd()               // 查找单词末尾
```

### 键盘事件处理

`useInput` 回调函数包含三个主要分支：

1. **命令列表处理** - 斜杠命令补全（仅 Insert 模式）
2. **Vim Normal 模式处理** - 所有 Normal 模式键绑定
3. **Insert 模式处理** - 标准输入和编辑操作

### UI 更新

```tsx
{/* Vim 模式指示器 */}
{vimModeEnabled && (
  <Text color={vimNormalMode ? 'yellow' : 'green'} bold>
    {modeIndicator}
  </Text>
)}

{/* 待处理命令指示器 */}
{commandIndicator && (
  <Text color="cyan" bold>
    {commandIndicator}
  </Text>
)}
```

## 与现有 /vim 命令集成

组件与 `src/commands/development.ts` 中的 `/vim` 命令完全兼容：

```typescript
/vim on    // 启用 Vim 模式
/vim off   // 禁用 Vim 模式
/vim       // 切换 Vim 模式
```

命令通过设置 `process.env.CLAUDE_CODE_VIM_MODE` 来控制模式。

## 技术细节

### 环境变量监听

使用 `useEffect` 和 `setInterval` 实现环境变量变化检测：

```typescript
useEffect(() => {
  const checkVimMode = () => {
    const newVimMode = process.env.CLAUDE_CODE_VIM_MODE === 'true';
    if (newVimMode !== vimModeEnabled) {
      setVimModeEnabled(newVimMode);
      setVimNormalMode(newVimMode);
    }
  };

  const interval = setInterval(checkVimMode, 500);
  return () => clearInterval(interval);
}, [vimModeEnabled]);
```

### 单词边界检测

```typescript
const findNextWordStart = (text: string, pos: number): number => {
  let i = pos;
  while (i < text.length && /\S/.test(text[i])) i++;  // 跳过当前单词
  while (i < text.length && /\s/.test(text[i])) i++;  // 跳过空格
  return Math.min(i, text.length);
};
```

### 多键命令处理

```typescript
if (pendingCommand === 'd') {
  if (input === 'd') {
    // dd - 删除整行
    saveToUndoStack();
    setLastDeletedText(value);
    setValue('');
    setCursor(0);
    setPendingCommand('');
    return;
  }
  setPendingCommand('');
}
```

### 光标位置限制

在 Normal 模式下，光标位置限制在 `[0, value.length - 1]`：

```typescript
setCursor(prev => Math.min(value.length - 1, prev + 1))
```

这与 Vim 的行为一致（Normal 模式下光标不能在行尾之后）。

## 测试

### 运行测试

```bash
# 启用 Vim 模式并启动
./examples/vim-mode-test.sh

# 或手动启动
export CLAUDE_CODE_VIM_MODE=true
npm run dev
```

### 测试场景

1. **模式切换**
   - 启动时默认 Normal 模式
   - 按 `i` 进入 Insert 模式
   - 按 `ESC` 返回 Normal 模式

2. **导航**
   - 输入文本，按 `ESC`，使用 `h`/`l` 移动
   - 使用 `w`/`b`/`e` 跳转单词
   - 使用 `0`/`$` 跳到行首/尾

3. **编辑**
   - 使用 `x` 删除字符
   - 使用 `dd` 删除整行
   - 使用 `D` 删除到行尾
   - 使用 `u` 撤销操作

4. **历史记录**
   - 提交多条输入
   - 使用 `j`/`k` 浏览历史

5. **动态切换**
   - 运行 `/vim on` 启用
   - 运行 `/vim off` 禁用
   - 运行 `/vim` 切换

## 文件清单

### 修改的文件
- `/home/user/claude-code-open/src/ui/components/Input.tsx` - 主要实现

### 新增的文件
- `/home/user/claude-code-open/docs/VIM_MODE.md` - 用户文档
- `/home/user/claude-code-open/docs/VIM_MODE_IMPLEMENTATION.md` - 实现文档
- `/home/user/claude-code-open/examples/vim-mode-test.sh` - 测试脚本

## 兼容性

- 与现有斜杠命令系统完全兼容
- 与历史记录功能完全兼容
- 与 `/vim` 命令无缝集成
- 非 Vim 模式下所有原有功能保持不变

## 已知限制

1. **单行限制** - 作为单行输入组件，`j`/`k` 用于历史记录而非多行导航
2. **简化删除** - 不支持完整的 Vim 删除语法（如 `d2w`, `daw`）
3. **无寄存器** - 虽然保存 `lastDeletedText`，但未实现粘贴（`p`/`P`）
4. **无可视模式** - 不支持 `v`/`V`/`Ctrl+v` 可视选择
5. **无搜索** - `/` 用于斜杠命令，不是 Vim 搜索
6. **环境变量轮询** - 使用 500ms 轮询而非事件系统（可优化）

## 未来增强方向

1. **粘贴功能** - 实现 `p`/`P` 使用 `lastDeletedText`
2. **数字重复** - 支持 `3w`, `5x` 等
3. **更多删除组合** - `dw`, `db`, `de`, `d$`, `d0`
4. **替换模式** - `R` 和 `r`
5. **字符查找** - `f`, `t`, `F`, `T`
6. **重做** - `Ctrl+R`
7. **可视模式** - `v` 选择文本
8. **事件系统** - 替换轮询机制

## 性能考虑

- 撤销栈限制为 50 个状态，防止内存泄漏
- 历史记录限制为 100 条
- 环境变量检查每 500ms 一次，对性能影响极小
- 正则表达式用于单词边界检测，效率高

## 总结

成功实现了一个功能完整的 Vim 模式系统，包含：
- ✅ 9 个导航命令 (h, j, k, l, w, b, e, 0, $, ^)
- ✅ 3 个删除命令 (x, dd, D)
- ✅ 1 个撤销命令 (u)
- ✅ 6 个插入命令 (i, a, I, A, o, O)
- ✅ 2 个退出插入模式命令 (ESC, Ctrl+[)
- ✅ 模式指示器 ([N], [I])
- ✅ 多键命令支持 (dd)
- ✅ 撤销栈 (50 个状态)
- ✅ 环境变量控制
- ✅ 动态模式切换

所有功能都与 Ink 组件系统完美集成，代码清晰、可维护。
