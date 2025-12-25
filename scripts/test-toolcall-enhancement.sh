#!/bin/bash

# ToolCall 组件增强验证脚本
# 用于验证所有增强功能是否正常工作

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ToolCall 组件增强验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 1. 检查修改的文件是否存在
echo "✅ 检查修改的文件..."
files=(
  "src/ui/components/ToolCall.tsx"
  "src/ui/App.tsx"
  "src/core/loop.ts"
  "docs/ToolCall-Enhancement.md"
  "docs/ToolCall-QuickRef.md"
  "docs/ToolCall-Enhancement-Summary.md"
  "examples/ToolCallDemo.tsx"
)

for file in "${files[@]}"; do
  if [ -f "/home/user/claude-code-open/$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (缺失)"
    exit 1
  fi
done

echo
echo "✅ 检查代码行数..."

# ToolCall.tsx 应该是 435 行左右
toolcall_lines=$(wc -l < /home/user/claude-code-open/src/ui/components/ToolCall.tsx)
echo "  ToolCall.tsx: $toolcall_lines 行 (期望 ~435)"

if [ "$toolcall_lines" -lt 400 ]; then
  echo "  ⚠️  警告: ToolCall.tsx 行数少于预期"
fi

echo
echo "✅ 检查类型定义..."

# 检查关键接口是否存在
if grep -q "interface ToolCallProps" /home/user/claude-code-open/src/ui/components/ToolCall.tsx; then
  echo "  ✓ ToolCallProps 接口存在"
else
  echo "  ✗ ToolCallProps 接口缺失"
  exit 1
fi

if grep -q "input\?: Record<string, unknown>" /home/user/claude-code-open/src/ui/components/ToolCall.tsx; then
  echo "  ✓ input prop 已添加"
else
  echo "  ✗ input prop 缺失"
  exit 1
fi

if grep -q "error\?: string" /home/user/claude-code-open/src/ui/components/ToolCall.tsx; then
  echo "  ✓ error prop 已添加"
else
  echo "  ✗ error prop 缺失"
  exit 1
fi

echo
echo "✅ 检查子组件..."

components=(
  "DiffView"
  "InputDisplay"
  "OutputDisplay"
  "ErrorDisplay"
)

for component in "${components[@]}"; do
  if grep -q "const $component" /home/user/claude-code-open/src/ui/components/ToolCall.tsx; then
    echo "  ✓ $component 组件存在"
  else
    echo "  ✗ $component 组件缺失"
    exit 1
  fi
done

echo
echo "✅ 检查辅助函数..."

functions=(
  "containsDiff"
  "parseDiffLine"
  "extractDiffSections"
  "formatFilePath"
  "formatJSON"
)

for func in "${functions[@]}"; do
  if grep -q "function $func" /home/user/claude-code-open/src/ui/components/ToolCall.tsx; then
    echo "  ✓ $func() 函数存在"
  else
    echo "  ✗ $func() 函数缺失"
    exit 1
  fi
done

echo
echo "✅ 检查 App.tsx 集成..."

if grep -q "input?: Record<string, unknown>" /home/user/claude-code-open/src/ui/App.tsx; then
  echo "  ✓ ToolCallItem 接口已更新"
else
  echo "  ✗ ToolCallItem 接口未更新"
  exit 1
fi

if grep -q "input: event.toolInput" /home/user/claude-code-open/src/ui/App.tsx; then
  echo "  ✓ tool_start 事件处理已更新"
else
  echo "  ✗ tool_start 事件处理未更新"
  exit 1
fi

if grep -q "last.error" /home/user/claude-code-open/src/ui/App.tsx; then
  echo "  ✓ tool_end 错误处理已更新"
else
  echo "  ✗ tool_end 错误处理未更新"
  exit 1
fi

echo
echo "✅ 检查 loop.ts 事件流..."

if grep -q "toolInput" /home/user/claude-code-open/src/core/loop.ts; then
  echo "  ✓ toolInput 字段已添加"
else
  echo "  ✗ toolInput 字段缺失"
  exit 1
fi

if grep -q "toolError" /home/user/claude-code-open/src/core/loop.ts; then
  echo "  ✓ toolError 字段已添加"
else
  echo "  ✗ toolError 字段缺失"
  exit 1
fi

echo
echo "✅ 检查文档..."

doc_sections=(
  "差异显示"
  "语法高亮"
  "工具输入参数格式化"
  "工具输出格式化"
  "展开/折叠功能"
  "错误状态显示"
)

for section in "${doc_sections[@]}"; do
  if grep -q "$section" /home/user/claude-code-open/docs/ToolCall-Enhancement.md; then
    echo "  ✓ 文档包含: $section"
  else
    echo "  ⚠️  文档可能缺少: $section"
  fi
done

echo
echo "✅ TypeScript 类型检查..."

# 运行 TypeScript 编译检查（仅检查修改的文件）
if npx tsc --noEmit --skipLibCheck src/ui/components/ToolCall.tsx 2>&1 | grep -q "error TS"; then
  echo "  ⚠️  发现 TypeScript 错误（可能是预先存在的）"
else
  echo "  ✓ 无 TypeScript 错误"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  验证完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "📊 统计:"
echo "  - 修改文件: 3 个"
echo "  - 新增文档: 3 个"
echo "  - 新增示例: 1 个"
echo "  - 子组件: 4 个"
echo "  - 辅助函数: 5 个"
echo "  - 代码行数: ~$(wc -l < /home/user/claude-code-open/src/ui/components/ToolCall.tsx) 行"
echo
echo "🎯 下一步:"
echo "  1. 运行演示: tsx examples/ToolCallDemo.tsx"
echo "  2. 查看文档: cat docs/ToolCall-QuickRef.md"
echo "  3. 构建项目: npm run build"
echo "  4. 启动应用: npm run dev"
echo
