# 媒体处理模块分析报告

## 官方源码分析

### 1. 图片处理

#### 支持的图片格式
```typescript
V91 = new Set(["png","jpg","jpeg","gif","webp"])
```

#### 处理流程
官方代码使用了三层图片处理策略：

1. **CP3** - 主图片处理函数（cli.js 行495附近）
```typescript
async function CP3(A,Q){
  let G=jA().statSync(A).size;
  if(G===0)throw Error(`Image file is empty: ${A}`);
  let Z=jA().readFileBytesSync(A),
  J=BA1(Z).split("/")[1]||"png";  // BA1 获取 MIME type
  try{
    let X=await fYA(Z,G,J);  // fYA 提取图片尺寸
    return H91(X.buffer,X.mediaType,G,X.dimensions)
  }catch(X){
    return t(X),H91(Z,J,G)
  }
}
```

2. **zP3** - 压缩处理函数（当图片过大时）
```typescript
async function zP3(A,Q){
  let G=jA().statSync(A).size,
  Z=jA().readFileBytesSync(A),
  Y=BA1(Z);  // 获取 MIME type
  try{
    let J=await _DB(Z,Q,Y);  // _DB 处理图片
    return{type:"image",file:{base64:J.base64,type:J.mediaType,originalSize:G}}
  }catch(J){
    t(J);
    try{
      let X=await Promise.resolve().then(() => l(qi1(),1)),  // 动态导入 sharp
      W=await(X.default||X)(Z)
        .resize(400,400,{fit:"inside",withoutEnlargement:!0})
        .jpeg({quality:20})
        .toBuffer();
      return H91(W,"jpeg",G)
    }catch(X){
      t(X);
      let I=Y.split("/")[1]||"png";
      return H91(Z,I,G)
    }
  }
}
```

3. **BQ0** - 主入口函数
```typescript
async function BQ0(A,Q=QQ0,B=A.split(".").pop()?.toLowerCase()||"png"){
  let G=await CP3(A,B);
  // 检查 base64 大小，如果超过限制则使用压缩
  if(Math.ceil(G.file.base64.length*0.125)>Q)
    return await zP3(A,Q);
  return G
}
```

#### 关键技术细节
- **Token 限制**: `QQ0 = 25000` tokens
- **文件大小限制**: `K_A` (需要进一步查找具体值)
- **MIME 类型**: 使用 `BA1()` 函数获取
- **尺寸提取**: 使用 `fYA()` 函数获取宽高信息
- **压缩策略**: sharp 库，400x400 max，JPEG 质量 20%

### 2. PDF 处理

#### 使用的库
- **原生方式**: 直接读取为 base64，不使用 PDF 解析库
- **验证机制**: 通过 VJA() 和 lA1() 检查是否启用

#### 解析流程（cli.js 行495附近）
```typescript
// PDF 支持的文件扩展名
var m43,JzB=33554432;  // 32MB = 33554432 bytes

// 初始化
m43=new Set(["pdf"])

// 检查函数
function VJA(){return x4()==="firstParty"}  // 检查是否为内部版本
function lA1(A){
  let Q=A.startsWith(".")?A.slice(1):A;
  return m43.has(Q.toLowerCase())
}

// PDF 读取函数
async function XzB(A){
  let Q=jA(),
  G=Q.statSync(A).size;

  // 文件大小验证
  if(G===0)
    throw Error(`PDF file is empty: ${A}`);
  if(G>JzB)
    throw Error(`PDF file size (${HI(G)}) exceeds maximum allowed size (${HI(JzB)}). PDF files must be less than 32MB.`);

  // 读取并转换为 base64
  let Y=Q.readFileBytesSync(A).toString("base64");

  return{
    type:"pdf",
    file:{
      filePath:A,
      base64:Y,
      originalSize:G
    }
  }
}
```

#### Read 工具集成
在 Read 工具的 call 方法中（cli.js 行495附近）：
```typescript
// 检查是否是 PDF
if(VJA()&&lA1(I)){
  let E=await XzB(W);
  return ev({operation:"read",tool:"FileReadTool",filePath:W,content:E.file.base64}),
  {
    data:E,
    newMessages:[f0({
      content:[{
        type:"document",
        source:{
          type:"base64",
          media_type:"application/pdf",
          data:E.file.base64
        }
      }],
      isMeta:!0
    })]
  }
}
```

#### 关键函数和行号
- **XzB()**: PDF 读取函数（行495）
- **VJA()**: 功能开关检查（行495）
- **lA1()**: 扩展名验证（行495）
- **JzB**: 32MB 文件大小限制
- **m43**: PDF 扩展名集合

### 3. SVG 渲染

官方代码中**没有找到 SVG 渲染（resvg.wasm）的实现**。

在代码中找到的 SVG 相关内容仅为**生成 SVG**而非渲染：
```javascript
// cli.js 行4280-4288: SVG 生成示例
F+=`  <rect width="100%" height="100%" fill="${X}" rx="${I}" ry="${I}"/>
`,F+=`  <style>
`,F+=`    text { font-family: ${B}; font-size: ${G}px; white-space: pre; }
`,F+=`    .b { font-weight: bold; }
`,F+=`  </style>
`;
F+=`  <text x="${Y}" y="${$}" xml:space="preserve">`;
// ... 生成 SVG 文本内容
```

**结论**: 官方版本可能不包含 SVG 转 PNG 的功能，或该功能在其他模块中。

### 4. 其他媒体类型

#### 二进制文件过滤列表
官方代码维护了一个详细的不支持文件列表：
```typescript
VP3=new Set([
  // 音频格式
  "mp3","wav","flac","ogg","aac","m4a","wma","aiff","opus",

  // 视频格式
  "mp4","avi","mov","wmv","flv","mkv","webm","m4v","mpeg","mpg",

  // 压缩文件
  "zip","rar","tar","gz","bz2","7z","xz","z","tgz","iso",

  // 可执行文件
  "exe","dll","so","dylib","app","msi","deb","rpm","bin",

  // 数据库文件
  "dat","db","sqlite","sqlite3","mdb","idx",

  // Office 文档（旧格式）
  "doc","docx","xls","xlsx","ppt","pptx","odt","ods","odp",

  // 字体文件
  "ttf","otf","woff","woff2","eot",

  // 设计文件
  "psd","ai","eps","sketch","fig","xd","blend","obj","3ds","max",

  // 编译文件
  "class","jar","war","pyc","pyo","rlib","swf","fla"
])
```

#### Jupyter Notebook 支持
```typescript
// cli.js 行495附近
if(I==="ipynb"){
  let E=MCB(W),  // MCB 解析 notebook
  z=JSON.stringify(E);

  if(z.length>J)
    throw Error(`Notebook content too large...`);

  // 返回 cells 数组
  return{
    type:"notebook",
    file:{
      filePath:A,
      cells:E
    }
  }
}
```

---

## 本项目差距分析

### 已实现
目前项目中**没有找到**媒体处理相关的实现文件：
- ❌ `src/media/` 目录不存在
- ❌ `src/tools/Read.ts` 文件不存在

### 缺失功能

#### 核心功能缺失
1. **图片处理模块**
   - 图片读取和 base64 编码
   - 图片压缩（sharp 库）
   - MIME 类型检测
   - 尺寸信息提取

2. **PDF 处理模块**
   - PDF 文件验证
   - Base64 编码
   - 文件大小限制

3. **二进制文件过滤**
   - 文件类型检测
   - 不支持格式的拦截

4. **SVG 渲染**
   - resvg.wasm 集成（官方也未实现）

---

## 具体实现建议

### T-007 PDF 解析实现

#### 方案一：仿照官方（推荐）
```typescript
// src/media/pdf.ts

export const PDF_MAX_SIZE = 33554432; // 32MB
export const PDF_EXTENSIONS = new Set(['pdf']);

export interface PdfReadResult {
  type: 'pdf';
  file: {
    filePath: string;
    base64: string;
    originalSize: number;
  };
}

export function isPdfSupported(): boolean {
  // 检查是否在支持的环境中
  return process.env.CLAUDE_PDF_SUPPORT === 'true' ||
         process.env.NODE_ENV === 'production';
}

export function isPdfExtension(ext: string): boolean {
  const normalized = ext.startsWith('.') ? ext.slice(1) : ext;
  return PDF_EXTENSIONS.has(normalized.toLowerCase());
}

export async function readPdfFile(filePath: string): Promise<PdfReadResult> {
  const fs = await import('fs');
  const stat = fs.statSync(filePath);
  const size = stat.size;

  // 验证文件大小
  if (size === 0) {
    throw new Error(`PDF file is empty: ${filePath}`);
  }

  if (size > PDF_MAX_SIZE) {
    throw new Error(
      `PDF file size (${formatBytes(size)}) exceeds maximum ` +
      `allowed size (${formatBytes(PDF_MAX_SIZE)}). ` +
      `PDF files must be less than 32MB.`
    );
  }

  // 读取文件并转换为 base64
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');

  return {
    type: 'pdf',
    file: {
      filePath,
      base64,
      originalSize: size
    }
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}
```

#### 方案二：使用 pdf-parse（更强大）
```typescript
// src/media/pdf-advanced.ts
import * as pdfParse from 'pdf-parse';

export interface PdfParseResult {
  type: 'pdf';
  file: {
    filePath: string;
    base64: string;
    originalSize: number;
    metadata?: {
      numPages: number;
      title?: string;
      author?: string;
      text?: string; // 提取的文本内容
    };
  };
}

export async function parsePdfFile(filePath: string): Promise<PdfParseResult> {
  const fs = await import('fs');
  const buffer = fs.readFileSync(filePath);

  // 解析 PDF
  const pdfData = await pdfParse(buffer);

  // 转换为 base64
  const base64 = buffer.toString('base64');

  return {
    type: 'pdf',
    file: {
      filePath,
      base64,
      originalSize: buffer.length,
      metadata: {
        numPages: pdfData.numpages,
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        text: pdfData.text // 提取的纯文本
      }
    }
  };
}
```

### T-008 SVG 渲染实现

**注意**: 官方代码中未找到 SVG 渲染实现，以下为推荐方案：

```typescript
// src/media/svg.ts
import { Resvg } from '@resvg/resvg-js';

export interface SvgRenderOptions {
  width?: number;
  height?: number;
  fitTo?: {
    mode: 'width' | 'height' | 'zoom';
    value: number;
  };
}

export interface SvgRenderResult {
  type: 'image';
  file: {
    base64: string;
    type: 'image/png';
    originalSize: number;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export async function renderSvgToPng(
  svgPath: string,
  options: SvgRenderOptions = {}
): Promise<SvgRenderResult> {
  const fs = await import('fs');

  // 读取 SVG 文件
  const svgBuffer = fs.readFileSync(svgPath);
  const svgString = svgBuffer.toString('utf-8');

  // 配置渲染选项
  const resvgOptions = {
    fitTo: options.fitTo || {
      mode: 'original' as const,
    },
  };

  // 使用 resvg 渲染
  const resvg = new Resvg(svgString, resvgOptions);
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // 转换为 base64
  const base64 = pngBuffer.toString('base64');

  // 获取尺寸信息
  const { width, height } = pngData;

  return {
    type: 'image',
    file: {
      base64,
      type: 'image/png',
      originalSize: pngBuffer.length,
      dimensions: {
        width,
        height
      }
    }
  };
}
```

### 图片处理完整实现

```typescript
// src/media/image.ts
import sharp from 'sharp';
import { getMimeType } from './mime';

export const SUPPORTED_IMAGE_FORMATS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp'
]);

export const MAX_IMAGE_TOKENS = 25000;

export interface ImageResult {
  type: 'image';
  file: {
    base64: string;
    type: string; // MIME type
    originalSize: number;
    dimensions?: {
      originalWidth?: number;
      originalHeight?: number;
      displayWidth?: number;
      displayHeight?: number;
    };
  };
}

/**
 * 读取图片并返回 base64
 */
export async function readImageFile(
  filePath: string,
  maxTokens: number = MAX_IMAGE_TOKENS
): Promise<ImageResult> {
  const fs = await import('fs');
  const path = await import('path');

  // 获取文件信息
  const stat = fs.statSync(filePath);
  const originalSize = stat.size;

  if (originalSize === 0) {
    throw new Error(`Image file is empty: ${filePath}`);
  }

  // 读取文件
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeType = getMimeType(buffer) || `image/${ext}`;

  try {
    // 尝试获取尺寸信息
    const result = await processImageWithDimensions(buffer, originalSize, ext);

    // 检查 base64 大小
    const estimatedTokens = Math.ceil(result.file.base64.length * 0.125);

    if (estimatedTokens > maxTokens) {
      // 压缩图片
      return await compressImage(filePath, maxTokens);
    }

    return result;
  } catch (error) {
    console.error('Image processing error:', error);
    // 回退：直接返回 base64
    return {
      type: 'image',
      file: {
        base64: buffer.toString('base64'),
        type: mimeType,
        originalSize
      }
    };
  }
}

/**
 * 处理图片并获取尺寸
 */
async function processImageWithDimensions(
  buffer: Buffer,
  originalSize: number,
  ext: string
): Promise<ImageResult> {
  const metadata = await sharp(buffer).metadata();

  return {
    type: 'image',
    file: {
      base64: buffer.toString('base64'),
      type: `image/${ext}`,
      originalSize,
      dimensions: {
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        displayWidth: metadata.width,
        displayHeight: metadata.height
      }
    }
  };
}

/**
 * 压缩图片（仿照官方）
 */
async function compressImage(
  filePath: string,
  maxTokens: number
): Promise<ImageResult> {
  const fs = await import('fs');
  const buffer = fs.readFileSync(filePath);
  const originalSize = buffer.length;

  // 使用 sharp 压缩
  const compressed = await sharp(buffer)
    .resize(400, 400, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 20 })
    .toBuffer();

  const metadata = await sharp(compressed).metadata();

  return {
    type: 'image',
    file: {
      base64: compressed.toString('base64'),
      type: 'image/jpeg',
      originalSize,
      dimensions: {
        displayWidth: metadata.width,
        displayHeight: metadata.height
      }
    }
  };
}
```

### MIME 类型检测

```typescript
// src/media/mime.ts
import { fileTypeFromBuffer } from 'file-type';

/**
 * 获取文件的 MIME 类型
 */
export async function getMimeType(buffer: Buffer): Promise<string | null> {
  try {
    const fileType = await fileTypeFromBuffer(buffer);
    return fileType?.mime || null;
  } catch (error) {
    console.error('MIME type detection error:', error);
    return null;
  }
}

/**
 * 同步获取 MIME 类型（基于文件头）
 */
export function getMimeTypeSync(buffer: Buffer): string | null {
  // PNG
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPEG
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // GIF
  if (buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }

  // WebP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // PDF
  if (buffer.length >= 5 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 &&
      buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D) {
    return 'application/pdf';
  }

  return null;
}
```

---

## 依赖库建议

### 必需依赖
```json
{
  "dependencies": {
    "sharp": "^0.33.0",           // 图片处理和压缩
    "file-type": "^18.0.0"        // MIME 类型检测
  },
  "optionalDependencies": {
    "pdf-parse": "^1.1.1",        // PDF 文本提取（可选）
    "@resvg/resvg-js": "^2.6.0"   // SVG 渲染（如需实现）
  }
}
```

### 依赖说明

1. **sharp** (必需)
   - 图片压缩和调整大小
   - 官方代码中已使用
   - 支持 PNG, JPEG, WebP, GIF 等格式

2. **file-type** (必需)
   - MIME 类型自动检测
   - 基于文件头（magic bytes）
   - 比扩展名检测更可靠

3. **pdf-parse** (可选)
   - 如需提取 PDF 文本内容
   - 官方版本未使用，仅读取 base64
   - 可用于增强功能

4. **@resvg/resvg-js** (可选)
   - SVG 转 PNG
   - 官方未实现此功能
   - WASM 版本，跨平台兼容

---

## 参考行号总结

### cli.js 关键位置

| 功能 | 行号 | 函数名 | 说明 |
|------|------|--------|------|
| PDF 配置 | 495 | `m43, JzB` | PDF 扩展名集合和大小限制 |
| PDF 检查 | 495 | `VJA()` | 检查是否启用 PDF 支持 |
| PDF 扩展名 | 495 | `lA1(A)` | 验证 PDF 扩展名 |
| PDF 读取 | 495 | `XzB(A)` | 读取 PDF 并返回 base64 |
| 图片格式 | 495 | `V91` | 支持的图片格式集合 |
| 二进制过滤 | 495 | `VP3` | 不支持的二进制格式列表 |
| 图片主处理 | 495 | `CP3(A,Q)` | 读取图片和尺寸信息 |
| 图片压缩 | 495 | `zP3(A,Q)` | Sharp 压缩处理 |
| 图片入口 | 495 | `BQ0(A,Q,B)` | 图片处理主入口 |
| Read 工具 | 495 | `W3.call()` | Read 工具的核心逻辑 |
| Token 限制 | 495 | `QQ0=25000` | 最大图片 token 数 |

### 实现优先级
1. ✅ **高优先级**: PDF 读取（T-007）- 官方已实现
2. ✅ **高优先级**: 图片处理 - 官方已完整实现
3. ⚠️ **中优先级**: SVG 渲染（T-008）- 官方未实现
4. ✅ **低优先级**: 二进制文件过滤 - 官方已实现

---

## 结论

官方 Claude Code 的媒体处理实现**非常简洁高效**：

1. **PDF**: 直接 base64 编码，不做复杂解析
2. **图片**: 使用 sharp 库智能压缩
3. **SVG**: 未实现渲染功能
4. **二进制**: 维护黑名单阻止读取

建议本项目**优先实现 PDF 和图片处理**，SVG 渲染可作为增强功能。
