#!/bin/bash

# Vim 模式测试脚本
# 演示如何启用和使用 Input 组件的 Vim 模式

echo "=== Claude Code Vim 模式测试 ==="
echo ""

# 启用 Vim 模式
export CLAUDE_CODE_VIM_MODE=true

echo "✓ 已设置环境变量 CLAUDE_CODE_VIM_MODE=true"
echo ""
echo "启动 Claude Code 时，Input 组件将启用 Vim 模式："
echo "  - 默认进入 Normal 模式 [N]"
echo "  - 按 'i' 进入 Insert 模式 [I]"
echo "  - 按 ESC 返回 Normal 模式"
echo ""
echo "运行以下命令启动："
echo "  npm run dev"
echo ""
echo "或编译后运行："
echo "  npm run build && npm run start"
echo ""

# 显示所有可用的 Vim 命令
echo "=== Vim 模式快捷键 ==="
echo ""
echo "Normal 模式 [N]:"
echo "  导航:"
echo "    h, l        - 左/右移动"
echo "    j, k        - 历史记录下/上"
echo "    w, b, e     - 单词导航"
echo "    0, ^, $     - 行首/首个非空字符/行尾"
echo ""
echo "  编辑:"
echo "    x           - 删除当前字符"
echo "    dd          - 删除整行"
echo "    D           - 删除到行尾"
echo "    u           - 撤销"
echo ""
echo "  进入 Insert 模式:"
echo "    i           - 在光标前插入"
echo "    a           - 在光标后插入"
echo "    I           - 在行首插入"
echo "    A           - 在行尾插入"
echo ""
echo "Insert 模式 [I]:"
echo "  ESC, Ctrl+[  - 返回 Normal 模式"
echo "  正常输入     - 插入文本"
echo "  Ctrl+A       - 跳到行首"
echo "  Ctrl+E       - 跳到行尾"
echo "  Ctrl+U       - 清除到行首"
echo "  Ctrl+K       - 清除到行尾"
echo ""
echo "运行时切换:"
echo "  /vim on      - 启用 Vim 模式"
echo "  /vim off     - 禁用 Vim 模式"
echo "  /vim         - 切换 Vim 模式"
echo ""

echo "详细文档请查看: docs/VIM_MODE.md"
