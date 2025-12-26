# ReadTool 图片支持功能完善说明

## 已完成的修改

### 1. 图片处理模块 (`src/media/image.ts`)
已经实现完整的图片处理功能，包括：

#### 核心功能：
- **图片读取**: 使用 `sharp` 库读取图片
- **尺寸提取**: 获取图片的 `originalWidth`, `originalHeight`, `displayWidth`, `displayHeight`
- **自动压缩**: 当图片 token 消耗超过限制时，自动压缩到 400x400, JPEG 质量 20%
- **Token 估算**: 使用公式 `Math.ceil(base64.length * 0.125)` 估算 token 消耗
- **Base64 编码**: 返回 base64 编码的图片数据

#### 支持的图片格式：
- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)

### 2. ReadTool 集成 (`src/tools/file.ts`)
已集成图片处理模块：

```typescript
private async readImageEnhanced(filePath: string): Promise<FileResult> {
  const result = await readImageFile(filePath);
  const sizeKB = (result.file.originalSize / 1024).toFixed(2);
  const tokenEstimate = Math.ceil(result.file.base64.length * 0.125);

  let output = `[Image: ${filePath}]\n`;
  output += `Format: ${result.file.type}\n`;
  output += `Size: ${sizeKB} KB\n`;

  if (result.file.dimensions) {
    const { originalWidth, originalHeight, displayWidth, displayHeight } = result.file.dimensions;
    if (originalWidth && originalHeight) {
      output += `Original dimensions: ${originalWidth}x${originalHeight}\n`;
      if (displayWidth && displayHeight && (displayWidth !== originalWidth || displayHeight !== originalHeight)) {
        output += `Display dimensions: ${displayWidth}x${displayHeight} (resized)\n`;
      }
    }
  }

  output += `Estimated tokens: ${tokenEstimate}`;

  return {
    success: true,
    output,
    content: `data:${result.file.type};base64,${result.file.base64}`,
  };
}
```

### 3. 输出格式
Read 工具读取图片时的输出示例：

```
[Image: /path/to/image.png]
Format: image/png
Size: 125.34 KB
Original dimensions: 1920x1080
Display dimensions: 400x225 (resized)
Estimated tokens: 15234
```

## 技术实现细节

### 使用的库
- **sharp**: 高性能图片处理库
  - 获取图片元数据 (宽度、高度)
  - 图片缩放和压缩
  - 格式转换

### 处理流程
1. 读取图片文件到 Buffer
2. 使用 sharp 获取元数据 (宽度、高度)
3. 计算 base64 大小对应的 token 数
4. 如果超过 25000 token，自动压缩：
   - 缩放到最大 400x400
   - 转换为 JPEG 格式
   - 质量设置为 20%
5. 返回包含尺寸信息的结果

### 与官方实现的对应关系
- 官方函数 `CP3`: 对应 `processImage`
- 官方函数 `zP3`: 对应 `compressImage`
- 官方函数 `BQ0`: 对应 `readImageFile`
- 官方函数 `fYA`: 对应 `extractImageDimensions`
- 官方函数 `H91`: 对应 `createImageResult`

### 返回的数据结构
```typescript
interface ImageResult {
  type: 'image';
  file: {
    base64: string;              // Base64 编码的图片数据
    type: string;                // MIME 类型，如 'image/png'
    originalSize: number;        // 原始文件大小（字节）
    dimensions?: {               // 图片尺寸信息
      originalWidth?: number;    // 原始宽度
      originalHeight?: number;   // 原始高度
      displayWidth?: number;     // 显示宽度（可能被缩放）
      displayHeight?: number;    // 显示高度（可能被缩放）
    };
  };
}
```

## 依赖要求
项目的 `package.json` 中已包含必要的依赖：
```json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

## 测试建议
1. 测试不同格式的图片 (PNG, JPEG, GIF, WebP)
2. 测试大图片的自动压缩功能
3. 测试图片尺寸信息的正确提取
4. 测试 token 估算的准确性

## 注意事项
1. `sharp` 库依赖于本地编译的二进制文件，可能在某些环境下需要额外配置
2. 如果 `sharp` 不可用，会降级到基础处理（只返回 base64，不包含尺寸信息）
3. 图片处理是异步的，使用 `async/await`
4. 超大图片会自动压缩以节省 token 消耗
