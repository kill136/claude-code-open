# PDF 支持使用示例

## 概述

ReadTool 现在完全支持 PDF 文件读取，实现与官方 @anthropic-ai/claude-code 一致的功能。

## 功能特性

1. **自动 PDF 检测**：根据文件扩展名 `.pdf` 自动识别 PDF 文件
2. **Base64 编码**：将 PDF 转换为 base64 编码以便传输
3. **文件验证**：
   - 检查文件是否为空
   - 验证文件大小不超过 32MB (33554432 字节)
   - 验证 PDF 文件头 (%PDF-)
4. **Document 内容块**：将 PDF 作为 document 类型发送给 Claude API

## 代码示例

### 基本使用

```typescript
import { ReadTool } from './tools/file.js';

const readTool = new ReadTool();

// 读取 PDF 文件
const result = await readTool.execute({
  file_path: '/path/to/document.pdf'
});

if (result.success) {
  console.log(result.output);
  // 输出:
  // [PDF Document: /path/to/document.pdf]
  // Size: 1.24 MB
  // Base64 length: 1698532 chars

  // result.newMessages 包含 PDF 的 document 块
  // 这会被发送给 Claude，让它能够"看到"PDF 内容
}
```

### 返回结构

```typescript
{
  success: true,
  output: "[PDF Document: /path/to/document.pdf]\nSize: 1.24 MB\nBase64 length: 1698532 chars\n",
  content: "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9U...",  // base64 编码的 PDF
  newMessages: [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9U...'
          }
        }
      ]
    }
  ]
}
```

### 错误处理

```typescript
// 文件为空
const emptyResult = await readTool.execute({
  file_path: '/path/to/empty.pdf'
});
// { success: false, error: 'PDF file is empty: /path/to/empty.pdf' }

// 文件太大
const largeResult = await readTool.execute({
  file_path: '/path/to/large.pdf'  // > 32MB
});
// { success: false, error: 'PDF file size (35.2 MB) exceeds maximum allowed size (32.00 MB). PDF files must be less than 32MB.' }

// PDF 支持未启用
process.env.CLAUDE_PDF_SUPPORT = 'false';
const disabledResult = await readTool.execute({
  file_path: '/path/to/document.pdf'
});
// { success: false, error: 'PDF support is not enabled. Set CLAUDE_PDF_SUPPORT=true to enable.' }
```

## 环境变量

```bash
# 启用 PDF 支持（默认已启用）
export CLAUDE_PDF_SUPPORT=true

# 禁用 PDF 支持
export CLAUDE_PDF_SUPPORT=false
```

## 与 Conversation Loop 集成

当工具返回 `newMessages` 时，conversation loop 需要将这些消息添加到对话历史中：

```typescript
// 在 conversation loop 中
const toolResult = await tool.execute(input);

if (toolResult.newMessages) {
  // 将 newMessages 添加到对话中
  for (const msg of toolResult.newMessages) {
    messages.push(msg);
  }
}
```

## 技术细节

### Document 内容块类型

```typescript
export interface DocumentBlockParam {
  type: 'document';
  source: DocumentSource;
}

export interface DocumentSource {
  type: 'base64';
  media_type: 'application/pdf';
  data: string;
}
```

### 文件大小限制

- **最大文件大小**: 32 MB (33,554,432 字节)
- **最小文件大小**: 不能为空（0 字节）

### 支持的 PDF 版本

理论上支持所有 PDF 版本（1.0 到 2.0），因为：
- 我们只是将 PDF 作为二进制数据传输
- Claude API 负责实际的 PDF 解析和内容提取
- 我们验证文件头以 `%PDF-` 开头即可

## 对比官方实现

| 特性 | 官方实现 | 本项目实现 | 状态 |
|------|----------|------------|------|
| Base64 编码 | ✅ | ✅ | 完全一致 |
| 文件大小验证 | ✅ (32MB) | ✅ (32MB) | 完全一致 |
| 空文件检查 | ✅ | ✅ | 完全一致 |
| Document 内容块 | ✅ | ✅ | 完全一致 |
| newMessages 支持 | ✅ | ✅ | 完全一致 |
| PDF 文件头验证 | ❌ | ✅ | 增强功能 |

## 注意事项

1. **内存使用**：大型 PDF 文件会占用大量内存（base64 编码后体积增加约 33%）
2. **处理时间**：大文件的读取和编码需要一定时间
3. **API 限制**：Claude API 可能对单次请求的总大小有限制
4. **成本**：PDF 内容会消耗 Claude API 的 token，较大的 PDF 可能产生较高成本

## 相关文件

- **实现**: `/home/user/claude-code-open/src/tools/file.ts` (ReadTool.readPdfEnhanced)
- **PDF 模块**: `/home/user/claude-code-open/src/media/pdf.ts`
- **类型定义**:
  - `/home/user/claude-code-open/src/types/messages.ts` (DocumentBlockParam)
  - `/home/user/claude-code-open/src/types/results.ts` (ToolResult.newMessages)

## 官方源码参考

- **官方 PDF 读取**: `/tmp/package/cli.js` 行 495 (XzB 函数)
- **官方使用示例**: `/tmp/package/cli.js` 行 1027
- **官方类型定义**: `/tmp/package/sdk-tools.d.ts`
