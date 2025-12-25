# DiffView Integration Guide

本指南说明如何将 DiffView 组件集成到 Claude Code CLI 的现有工具中。

## 集成到 Edit 工具

Edit 工具是最适合使用 DiffView 的地方，可以在应用编辑前向用户展示差异。

### 修改 `src/tools/file.ts`

```typescript
import { DiffView } from '../ui/components/DiffView.js';
import { render } from 'ink';
import React from 'react';

// 在 EditTool 类中添加预览方法
class EditTool extends BaseTool {
  // ... 现有代码 ...

  /**
   * 显示编辑预览
   */
  private async showEditPreview(
    filePath: string,
    oldContent: string,
    newContent: string
  ): Promise<void> {
    const { waitUntilExit } = render(
      <DiffView
        oldContent={oldContent}
        newContent={newContent}
        fileName={filePath}
        mode="unified"
        showLineNumbers={true}
        contextLines={3}
      />
    );

    await waitUntilExit();
  }

  /**
   * 执行编辑，带预览功能
   */
  async execute(input: EditInput): Promise<ToolResult> {
    const { file_path, old_string, new_string } = input;

    // 读取文件内容
    const oldContent = await fs.readFile(file_path, 'utf-8');

    // 执行替换
    const newContent = oldContent.replace(old_string, new_string);

    // 显示差异预览（如果启用）
    if (this.config.previewEdits) {
      await this.showEditPreview(file_path, oldContent, newContent);
    }

    // 询问确认
    const confirmed = await this.confirmEdit(file_path);
    if (!confirmed) {
      return {
        success: false,
        message: 'Edit cancelled by user',
      };
    }

    // 应用编辑
    await fs.writeFile(file_path, newContent);

    return {
      success: true,
      message: `File edited successfully: ${file_path}`,
    };
  }
}
```

## 集成到 MultiEdit 工具

MultiEdit 工具可以显示多个文件的差异对比。

### 修改 `src/tools/multiedit.ts`

```typescript
import { DiffView } from '../ui/components/DiffView.js';
import { render, Box, Text } from 'ink';
import React from 'react';

// 在 MultiEditTool 类中
class MultiEditTool extends BaseTool {
  /**
   * 显示多个编辑的预览
   */
  private async showMultiEditPreview(edits: Array<{
    path: string;
    oldContent: string;
    newContent: string;
  }>): Promise<void> {
    const MultiEditPreview = () => (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Previewing {edits.length} file change(s)
          </Text>
        </Box>
        {edits.map((edit, index) => (
          <Box key={index} flexDirection="column" marginBottom={2}>
            <Box marginBottom={1}>
              <Text bold>
                [{index + 1}/{edits.length}]
              </Text>
            </Box>
            <DiffView
              oldContent={edit.oldContent}
              newContent={edit.newContent}
              fileName={edit.path}
              mode="unified"
              contextLines={2}
            />
          </Box>
        ))}
      </Box>
    );

    const { waitUntilExit } = render(<MultiEditPreview />);
    await waitUntilExit();
  }
}
```

## 集成到 Git 相关命令

可以创建一个新的斜杠命令来显示 Git 差异。

### 创建 `.claude/commands/git-diff.md`

```markdown
# /git-diff 命令

显示当前工作目录中未提交的更改。

使用 DiffView 组件以友好的方式展示 git diff。
```

### 创建 `src/commands/git.ts`

```typescript
import { execSync } from 'child_process';
import { DiffView } from '../ui/components/DiffView.js';
import { render, Box, Text } from 'ink';
import React from 'react';
import * as fs from 'fs/promises';

export async function gitDiffCommand(filePath?: string) {
  try {
    // 获取 git diff
    const cmd = filePath
      ? `git diff HEAD -- ${filePath}`
      : 'git diff HEAD';

    const diffOutput = execSync(cmd, { encoding: 'utf-8' });

    if (!diffOutput) {
      console.log('No changes detected.');
      return;
    }

    // 解析 diff 输出获取文件列表
    const files = parseDiffOutput(diffOutput);

    // 为每个文件显示 DiffView
    for (const file of files) {
      const oldContent = execSync(`git show HEAD:${file.path}`, {
        encoding: 'utf-8',
      });
      const newContent = await fs.readFile(file.path, 'utf-8');

      const { waitUntilExit } = render(
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="cyan">
              Git Diff: {file.path}
            </Text>
          </Box>
          <DiffView
            oldContent={oldContent}
            newContent={newContent}
            fileName={file.path}
            mode="unified"
          />
        </Box>
      );

      await waitUntilExit();
    }
  } catch (error) {
    console.error('Error showing git diff:', error);
  }
}

function parseDiffOutput(diff: string): Array<{ path: string }> {
  const files: Array<{ path: string }> = [];
  const lines = diff.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        files.push({ path: match[1] });
      }
    }
  }

  return files;
}
```

## 集成到权限提示

在用户授权编辑前显示差异预览。

### 修改 `src/permissions/index.ts`

```typescript
import { DiffView } from '../ui/components/DiffView.js';
import { PermissionPrompt } from '../ui/components/PermissionPrompt.js';
import { render, Box } from 'ink';
import React from 'react';

export async function requestEditPermission(
  filePath: string,
  oldContent: string,
  newContent: string
): Promise<boolean> {
  const PermissionWithPreview = () => (
    <Box flexDirection="column">
      {/* 显示差异 */}
      <DiffView
        oldContent={oldContent}
        newContent={newContent}
        fileName={filePath}
        mode="unified"
        contextLines={3}
      />

      {/* 显示权限提示 */}
      <Box marginTop={2}>
        <PermissionPrompt
          message={`Apply these changes to ${filePath}?`}
          type="edit"
          scope="file"
          details={{
            filePath,
            changes: calculateChanges(oldContent, newContent),
          }}
        />
      </Box>
    </Box>
  );

  const { waitUntilExit } = render(<PermissionWithPreview />);
  return await waitUntilExit();
}

function calculateChanges(oldContent: string, newContent: string) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  return {
    additions: newLines.length - oldLines.length,
    deletions: oldLines.length - newLines.length,
    modifications: Math.min(oldLines.length, newLines.length),
  };
}
```

## 集成到会话重放

显示会话中执行的编辑历史。

### 创建 `src/commands/session-diff.ts`

```typescript
import { DiffView } from '../ui/components/DiffView.js';
import { render, Box, Text } from 'ink';
import React from 'react';

export async function showSessionDiff(sessionId: string) {
  const session = await loadSession(sessionId);
  const edits = extractEdits(session);

  const SessionDiffView = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Session: {sessionId}
        </Text>
        <Text> - </Text>
        <Text color="gray">
          {edits.length} edit(s) found
        </Text>
      </Box>

      {edits.map((edit, index) => (
        <Box key={index} flexDirection="column" marginBottom={2}>
          <Box marginBottom={1}>
            <Text bold>
              Edit #{index + 1} - {edit.timestamp.toLocaleString()}
            </Text>
          </Box>
          <DiffView
            oldContent={edit.oldContent}
            newContent={edit.newContent}
            fileName={edit.filePath}
            mode="unified"
          />
        </Box>
      ))}
    </Box>
  );

  const { waitUntilExit } = render(<SessionDiffView />);
  await waitUntilExit();
}
```

## 配置选项

在 `~/.claude/settings.json` 中添加 DiffView 相关配置：

```json
{
  "diffView": {
    "defaultMode": "unified",
    "contextLines": 3,
    "showLineNumbers": true,
    "maxWidth": 120,
    "enablePreview": true,
    "autoApply": false
  }
}
```

### 在代码中使用配置

```typescript
import { loadConfig } from '../config/index.js';

const config = await loadConfig();
const diffConfig = config.diffView || {};

<DiffView
  oldContent={oldContent}
  newContent={newContent}
  mode={diffConfig.defaultMode || 'unified'}
  contextLines={diffConfig.contextLines || 3}
  showLineNumbers={diffConfig.showLineNumbers !== false}
  maxWidth={diffConfig.maxWidth || 120}
/>
```

## 快捷命令示例

### `/preview-edit` 命令

```markdown
# /preview-edit 命令

在应用编辑前预览更改。

使用 DiffView 组件显示将要进行的更改，然后询问用户是否应用。
```

### `/compare-files` 命令

```markdown
# /compare-files 命令

比较两个文件的差异。

参数:
- file1: 第一个文件路径
- file2: 第二个文件路径

示例: /compare-files package.json package-old.json
```

## 测试建议

### 单元测试

```typescript
import { describe, it, expect } from '@jest/globals';
import { render } from 'ink-testing-library';
import { DiffView } from '../DiffView.js';

describe('DiffView', () => {
  it('should render unified diff correctly', () => {
    const { lastFrame } = render(
      <DiffView
        oldContent="line1\nline2"
        newContent="line1\nline3"
        mode="unified"
      />
    );

    expect(lastFrame()).toContain('line1');
    expect(lastFrame()).toContain('-line2');
    expect(lastFrame()).toContain('+line3');
  });

  it('should render side-by-side diff correctly', () => {
    const { lastFrame } = render(
      <DiffView
        oldContent="old"
        newContent="new"
        mode="side-by-side"
      />
    );

    expect(lastFrame()).toContain('Original');
    expect(lastFrame()).toContain('Modified');
  });
});
```

### 集成测试

```typescript
import { EditTool } from '../tools/file.js';

describe('EditTool with DiffView', () => {
  it('should show preview before applying edit', async () => {
    const tool = new EditTool({ previewEdits: true });

    const result = await tool.execute({
      file_path: '/tmp/test.txt',
      old_string: 'hello',
      new_string: 'world',
    });

    // 验证预览已显示
    // 验证编辑已应用
  });
});
```

## 性能优化建议

1. **大文件处理**:
   ```typescript
   // 对于大文件，限制上下文行数
   const contextLines = fileSize > 10000 ? 1 : 3;
   ```

2. **缓存 diff 结果**:
   ```typescript
   const cachedDiff = useMemo(
     () => computeDiff(oldContent, newContent),
     [oldContent, newContent]
   );
   ```

3. **异步加载**:
   ```typescript
   // 延迟加载 DiffView 组件
   const DiffView = lazy(() => import('./DiffView.js'));
   ```

## 故障排除

### 常见问题

1. **差异不显示**:
   - 检查 oldContent 和 newContent 是否正确
   - 验证两者确实有差异

2. **终端显示异常**:
   - 确保终端支持 ANSI 颜色
   - 调整 maxWidth 以适应终端宽度

3. **性能问题**:
   - 减少 contextLines
   - 使用 unified 模式代替 side-by-side

## 下一步

- [ ] 添加语法高亮支持
- [ ] 实现交互式编辑（点击行号跳转）
- [ ] 支持导出 diff 到文件
- [ ] 添加更多主题选项
- [ ] 集成到 Web UI（如果有的话）

## 相关文件

- `/home/user/claude-code-open/src/ui/components/DiffView.tsx` - 主组件
- `/home/user/claude-code-open/src/ui/components/DiffView.example.tsx` - 示例代码
- `/home/user/claude-code-open/src/ui/components/DiffView.README.md` - 组件文档
- `/home/user/claude-code-open/test-diffview.mjs` - 测试脚本

## 参考资源

- [Ink 文档](https://github.com/vadimdemedes/ink)
- [React 文档](https://react.dev/)
- [Myers Diff 算法](http://www.xmailserver.org/diff2.pdf)
- [Git Diff 格式](https://git-scm.com/docs/git-diff)
