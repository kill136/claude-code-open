# Vim 模式使用指南

Input 组件现已支持完整的 Vim 键绑定，为熟悉 Vim 的用户提供强大的编辑体验。

## 启用 Vim 模式

设置环境变量：

```bash
export CLAUDE_CODE_VIM_MODE=true
```

然后启动 Claude Code CLI。

## 模式指示器

- `[N]` - Normal 模式（黄色）
- `[I]` - Insert 模式（绿色）
- `[d]` - 等待多键命令的第二个按键（青色）

## Normal 模式命令

### 基本导航

| 键 | 功能 |
|---|---|
| `h` | 光标左移 |
| `l` | 光标右移 |
| `j` | 历史记录向下（下一条） |
| `k` | 历史记录向上（上一条） |

### 单词导航

| 键 | 功能 |
|---|---|
| `w` | 跳到下一个单词开头 |
| `b` | 跳到上一个单词开头 |
| `e` | 跳到当前/下一个单词末尾 |

### 行导航

| 键 | 功能 |
|---|---|
| `0` | 跳到行首 |
| `^` | 跳到第一个非空白字符 |
| `$` | 跳到行尾 |

### 删除操作

| 键 | 功能 |
|---|---|
| `x` | 删除当前字符 |
| `dd` | 删除整行 |
| `D` | 删除到行尾 |

### 撤销

| 键 | 功能 |
|---|---|
| `u` | 撤销上一次操作（最多50个状态） |

### 进入 Insert 模式

| 键 | 功能 |
|---|---|
| `i` | 在光标前插入 |
| `a` | 在光标后插入 |
| `I` | 在行首插入 |
| `A` | 在行尾插入 |
| `o` | 在行尾插入（单行模式） |
| `O` | 在行首插入（单行模式） |

### 其他

| 键 | 功能 |
|---|---|
| `Enter` | 提交输入 |
| `ESC` | 清除待处理命令 |

## Insert 模式命令

### 退出 Insert 模式

| 键 | 功能 |
|---|---|
| `ESC` | 返回 Normal 模式 |
| `Ctrl+[` | 返回 Normal 模式 |

### 标准编辑

在 Insert 模式下，所有标准键盘输入都正常工作：

- 字符输入
- `Backspace` / `Delete` - 删除字符
- `←` / `→` - 移动光标
- `↑` / `↓` - 浏览历史记录
- `Ctrl+A` - 跳到行首
- `Ctrl+E` - 跳到行尾
- `Ctrl+U` - 清除到行首
- `Ctrl+K` - 清除到行尾
- `Enter` - 提交输入

## 斜杠命令自动补全

在 Insert 模式下输入 `/` 会触发命令自动补全：

- `↑` / `↓` - 选择命令
- `Tab` - 补全选中的命令
- 继续输入 - 过滤命令列表

**注意**：在 Normal 模式下，斜杠命令补全不可用。请先按 `i` 进入 Insert 模式。

## 工作流示例

### 编辑并提交一条消息

```
[I] > Hello world_           # Insert 模式，输入文本
[I] > Hello world_           # 按 ESC
[N] > Hello worl_            # 进入 Normal 模式，光标左移
[N] > Hello worl_            # 按 A
[I] > Hello world_           # 光标移到行尾，进入 Insert 模式
[I] > Hello world!_          # 添加感叹号
[I] > Hello world!_          # 按 Enter 提交
```

### 使用 Vim 导航编辑

```
[I] > Fix the authentication bug_    # 输入文本，按 ESC
[N] > Fix the authentication bu_     # 按 0
[N] > _ix the authentication bug     # 跳到行首，按 w
[N] > Fix _he authentication bug     # 跳到下一个单词，按 w
[N] > Fix the _uthentication bug     # 按 cw（实际是先按 d 再按 i）
[d] > Fix the _uthentication bug     # 显示 [d] 等待第二个键，按 d
[N] > _                               # 删除整行，按 i
[I] > _                               # 重新输入
```

### 撤销操作

```
[N] > Some text here_                # 按 x 删除字符
[N] > Some text her_                 # 删除了 'e'，按 u
[N] > Some text here_                # 撤销，'e' 恢复
```

## 兼容性

- 当 `CLAUDE_CODE_VIM_MODE` 未设置或设置为 `false` 时，Input 组件使用标准键绑定
- ESC 键在非 Vim 模式下清空输入，在 Vim 模式下切换到 Normal 模式
- 所有历史记录和斜杠命令功能在两种模式下都可用

## 实现细节

- 撤销栈保留最近 50 个状态
- 历史记录保留最近 100 条
- 多键命令（如 `dd`）通过待处理命令状态实现
- 单词边界使用 `/\S/` 和 `/\s/` 正则表达式检测
- 光标位置在 Normal 模式下限制在 `[0, value.length - 1]`
- 退出 Insert 模式时自动将光标左移一位（Vim 标准行为）

## 已知限制

1. 单行输入：Input 组件是单行编辑器，不支持多行 Vim 命令（如 `j`/`k` 用于浏览历史而非移动行）
2. 简化删除：不支持 Vim 的完整删除运算符语法（如 `d2w`, `daw`），仅支持 `x`, `dd`, `D`
3. 无寄存器：删除的文本不保存在 Vim 寄存器中（虽然保存在 `lastDeletedText` 状态中供未来扩展）
4. 无可视模式：不支持 Vim 的可视模式选择
5. 无搜索：不支持 `/` 和 `?` 搜索（`/` 用于斜杠命令）

## 未来增强

可能的改进方向：

- 粘贴（`p`, `P`）使用 `lastDeletedText`
- 数字重复（如 `3w`, `5x`）
- 更多删除组合（`dw`, `db`, `de`）
- 替换模式（`R`）
- 字符查找（`f`, `t`, `F`, `T`）
- 撤销后重做（`Ctrl+R`）
