# Vim 模式快速参考

## 启用

```bash
export CLAUDE_CODE_VIM_MODE=true
```

或在运行时使用 `/vim on`

## 模式指示器

- `[N]` 黄色 = Normal 模式
- `[I]` 绿色 = Insert 模式
- `[d]` 青色 = 等待第二个按键

## Normal 模式命令

### 导航
| 键 | 功能 | 键 | 功能 |
|---|---|---|---|
| `h` | ← | `l` | → |
| `j` | 历史↓ | `k` | 历史↑ |
| `w` | 下个词 | `b` | 上个词 |
| `e` | 词尾 | `0` | 行首 |
| `^` | 首个非空 | `$` | 行尾 |

### 编辑
| 键 | 功能 |
|---|---|
| `x` | 删除字符 |
| `dd` | 删除整行 |
| `D` | 删除到行尾 |
| `u` | 撤销 |

### 插入
| 键 | 功能 | 键 | 功能 |
|---|---|---|---|
| `i` | 光标前 | `a` | 光标后 |
| `I` | 行首 | `A` | 行尾 |
| `o` | 行尾 | `O` | 行首 |

## Insert 模式命令

| 键 | 功能 | 键 | 功能 |
|---|---|---|---|
| `ESC` | → Normal | `Ctrl+[` | → Normal |
| `Ctrl+A` | 行首 | `Ctrl+E` | 行尾 |
| `Ctrl+U` | 清除←行首 | `Ctrl+K` | 清除→行尾 |
| `Enter` | 提交 | `Backspace` | 删除 |

## 命令
- `/vim on` - 启用
- `/vim off` - 禁用
- `/vim` - 切换

## 工作流示例

```
[N] > _                    # Normal 模式，按 i
[I] > _                    # Insert 模式，输入 "hello world"
[I] > hello world_         # 按 ESC
[N] > hello worl_          # 按 0 (跳到行首)
[N] > _ello world          # 按 w (下个词)
[N] > hello _orld          # 按 A (行尾插入)
[I] > hello world_         # 输入 "!"
[I] > hello world!_        # 按 Enter 提交
```
