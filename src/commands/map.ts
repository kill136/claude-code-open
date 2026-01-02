/**
 * /map 命令 - 增强版代码蓝图生成和可视化
 *
 * 生成包含以下内容的代码蓝图：
 * 1. 层级结构 - 目录树视图 + 架构分层视图
 * 2. 引用关系 - 模块依赖、符号调用、类型引用
 * 3. 语义描述 - AI 生成的业务含义描述
 */

import * as fs from 'fs';
import * as path from 'path';
import { SlashCommand, CommandContext, CommandResult } from './types.js';
import {
  EnhancedOntologyGenerator,
  EnhancedCodeBlueprint,
  EnhancedAnalysisProgress,
  VisualizationServer,
} from '../map/index.js';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析命令参数
 */
function parseArgs(args: string[]): {
  subcommand: string;
  options: Record<string, string | boolean>;
} {
  const subcommand = args[0] || 'generate';
  const options: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { subcommand, options };
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 格式化增强版进度
 */
function formatEnhancedProgress(progress: EnhancedAnalysisProgress): string {
  const phases: Record<string, string> = {
    discover: '发现文件',
    parse: '解析代码',
    symbols: '提取符号',
    references: '分析引用',
    views: '构建视图',
    semantics: '生成语义',
    aggregate: '聚合蓝图',
  };

  const phase = phases[progress.phase] || progress.phase;
  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  if (progress.message) {
    return `${phase}: ${progress.message}`;
  }

  if (progress.currentFile) {
    const fileName = path.basename(progress.currentFile);
    return `${phase}: ${percent}% (${fileName})`;
  }

  return `${phase}: ${percent}%`;
}

/**
 * 生成增强版摘要报告
 */
function generateEnhancedSummary(blueprint: EnhancedCodeBlueprint): string {
  const { project, statistics, views } = blueprint;
  const lines: string[] = [];

  lines.push('');
  lines.push('📊 **增强版代码蓝图生成完成**');
  lines.push('');
  lines.push(`项目: ${project.name}`);
  lines.push(`路径: ${project.rootPath}`);
  lines.push(`语言: ${project.languages.join(', ')}`);

  // 项目语义
  if (project.semantic) {
    lines.push('');
    lines.push('**项目描述:**');
    lines.push(`  ${project.semantic.description}`);
    if (project.semantic.domains.length > 0) {
      lines.push(`  领域: ${project.semantic.domains.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('**统计信息:**');
  lines.push(`  • 模块数: ${statistics.totalModules}`);
  lines.push(`  • 符号数: ${statistics.totalSymbols}`);
  lines.push(`  • 代码行数: ${statistics.totalLines.toLocaleString()}`);
  lines.push(`  • 模块依赖: ${statistics.referenceStats.totalModuleDeps}`);
  lines.push(`  • 符号调用: ${statistics.referenceStats.totalSymbolCalls}`);
  lines.push(`  • 类型引用: ${statistics.referenceStats.totalTypeRefs}`);

  // 语义覆盖率
  lines.push('');
  lines.push('**语义覆盖:**');
  lines.push(`  • 有描述的模块: ${statistics.semanticCoverage.modulesWithDescription}/${statistics.totalModules}`);
  lines.push(`  • 覆盖率: ${statistics.semanticCoverage.coveragePercent}%`);

  // 架构层分布
  lines.push('');
  lines.push('**架构层分布:**');
  const layerNames: Record<string, string> = {
    presentation: '表现层',
    business: '业务层',
    data: '数据层',
    infrastructure: '基础设施',
    crossCutting: '横切关注点',
  };
  for (const [layer, count] of Object.entries(statistics.layerDistribution)) {
    if (count > 0) {
      const name = layerNames[layer] || layer;
      lines.push(`  • ${name}: ${count} 模块`);
    }
  }

  // 语言分布
  if (Object.keys(statistics.languageBreakdown).length > 1) {
    lines.push('');
    lines.push('**语言分布:**');
    for (const [lang, count] of Object.entries(statistics.languageBreakdown)) {
      const percent = Math.round((count / statistics.totalModules) * 100);
      lines.push(`  • ${lang}: ${count} 文件 (${percent}%)`);
    }
  }

  // 最大文件
  if (statistics.largestFiles.length > 0) {
    lines.push('');
    lines.push('**最大文件 (Top 5):**');
    for (const file of statistics.largestFiles.slice(0, 5)) {
      lines.push(`  • ${file.path}: ${file.lines} 行`);
    }
  }

  // 被导入最多的模块
  if (statistics.mostImportedModules.length > 0) {
    lines.push('');
    lines.push('**核心模块 (被导入最多):**');
    for (const mod of statistics.mostImportedModules.slice(0, 5)) {
      lines.push(`  • ${mod.id}: ${mod.importCount} 次导入`);
    }
  }

  // 被调用最多的符号
  if (statistics.mostCalledSymbols.length > 0) {
    lines.push('');
    lines.push('**热点函数 (被调用最多):**');
    for (const sym of statistics.mostCalledSymbols.slice(0, 5)) {
      lines.push(`  • ${sym.name}: ${sym.callCount} 次调用`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// 子命令处理
// ============================================================================

/**
 * generate 子命令 - 生成增强版代码蓝图
 */
async function handleGenerate(
  ctx: CommandContext,
  options: Record<string, string | boolean>
): Promise<CommandResult> {
  const { config, ui } = ctx;
  const outputPath = (options.output || options.o || 'CODE_MAP.json') as string;
  const fullOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(config.cwd, outputPath);

  const skipSemantics = options['skip-semantics'] || options.s;

  ui.addMessage(
    'assistant',
    skipSemantics
      ? '正在生成代码蓝图（跳过 AI 语义）...'
      : '正在生成增强版代码蓝图（包含 AI 语义）...'
  );

  try {
    const generator = new EnhancedOntologyGenerator(config.cwd, {
      outputPath: fullOutputPath,
      withSemantics: !skipSemantics,
      onProgress: (progress) => {
        const msg = formatEnhancedProgress(progress);
        // 可以在这里更新进度显示
        // ui.updateStatus(msg);
      },
    });

    const blueprint = await generator.generate();

    // 保存文件
    const dir = path.dirname(fullOutputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullOutputPath, JSON.stringify(blueprint, null, 2), 'utf-8');

    // 输出摘要
    const summary = generateEnhancedSummary(blueprint);
    ui.addMessage('assistant', summary);
    ui.addMessage('assistant', `\n✅ 蓝图已保存到: ${fullOutputPath}`);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.addMessage('assistant', `❌ 生成失败: ${message}`);
    return { success: false, message };
  }
}

/**
 * serve 子命令 - 启动可视化服务器
 */
async function handleServe(
  ctx: CommandContext,
  options: Record<string, string | boolean>
): Promise<CommandResult> {
  const { config, ui } = ctx;
  const port = options.port ? parseInt(options.port as string, 10) : 3030;
  const mapFile = path.join(config.cwd, 'CODE_MAP.json');

  // 检查图谱文件是否存在
  if (!fs.existsSync(mapFile)) {
    ui.addMessage(
      'assistant',
      '❌ 未找到 CODE_MAP.json 文件。请先运行 `/map` 生成蓝图。'
    );
    return { success: false, message: 'CODE_MAP.json not found' };
  }

  try {
    const server = new VisualizationServer({ ontologyPath: mapFile, port });
    await server.start();
    const url = server.getAddress();

    ui.addMessage(
      'assistant',
      `🚀 **可视化服务器已启动**\n\n` +
      `打开浏览器访问: ${url}\n\n` +
      `功能:\n` +
      `  • 依赖图可视化\n` +
      `  • 架构层视图\n` +
      `  • 模块搜索\n` +
      `  • 语义描述查看\n\n` +
      `按 Ctrl+C 停止服务器`
    );

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.addMessage('assistant', `❌ 启动服务器失败: ${message}`);
    return { success: false, message };
  }
}

/**
 * view 子命令 - 生成并打开浏览器
 */
async function handleView(
  ctx: CommandContext,
  options: Record<string, string | boolean>
): Promise<CommandResult> {
  // 先生成
  const result = await handleGenerate(ctx, options);
  if (!result.success) {
    return result;
  }

  // 然后启动服务
  return handleServe(ctx, options);
}

/**
 * status 子命令 - 显示当前蓝图状态
 */
async function handleStatus(
  ctx: CommandContext,
  _options: Record<string, string | boolean>
): Promise<CommandResult> {
  const { config, ui } = ctx;
  const mapFile = path.join(config.cwd, 'CODE_MAP.json');

  if (!fs.existsSync(mapFile)) {
    ui.addMessage(
      'assistant',
      '❌ 未找到 CODE_MAP.json 文件。\n\n' +
      '运行 `/map` 来生成增强版代码蓝图。'
    );
    return { success: true };
  }

  try {
    const content = fs.readFileSync(mapFile, 'utf-8');
    const blueprint: EnhancedCodeBlueprint = JSON.parse(content);
    const stats = fs.statSync(mapFile);

    const lines: string[] = [];
    lines.push('');
    lines.push('📁 **CODE_MAP.json 状态**');
    lines.push('');
    lines.push(`版本: ${blueprint.meta.version}`);
    lines.push(`生成时间: ${new Date(blueprint.meta.generatedAt).toLocaleString()}`);
    lines.push(`文件大小: ${formatSize(stats.size)}`);
    lines.push('');
    lines.push(`项目: ${blueprint.project.name}`);
    lines.push(`模块数: ${blueprint.statistics.totalModules}`);
    lines.push(`符号数: ${blueprint.statistics.totalSymbols}`);
    lines.push(`代码行数: ${blueprint.statistics.totalLines.toLocaleString()}`);

    // 显示语义覆盖率
    if (blueprint.meta.semanticVersion) {
      lines.push('');
      lines.push('**语义信息:**');
      lines.push(`  • 语义版本: ${blueprint.meta.semanticVersion}`);
      lines.push(`  • 覆盖率: ${blueprint.statistics.semanticCoverage.coveragePercent}%`);
    }

    // 显示项目描述
    if (blueprint.project.semantic?.description) {
      lines.push('');
      lines.push('**项目描述:**');
      lines.push(`  ${blueprint.project.semantic.description}`);
    }

    lines.push('');

    ui.addMessage('assistant', lines.join('\n'));
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.addMessage('assistant', `❌ 读取蓝图失败: ${message}`);
    return { success: false, message };
  }
}

// ============================================================================
// 命令定义
// ============================================================================

export const mapCommand: SlashCommand = {
  name: 'map',
  aliases: ['codemap', 'blueprint'],
  description: '生成增强版代码蓝图（含层级、引用、语义）',
  usage: `/map [subcommand] [options]

子命令:
  generate    生成增强版代码蓝图 (默认)
  serve       启动可视化服务器
  view        生成并打开可视化
  status      查看当前蓝图状态

选项:
  --output, -o <path>   输出文件路径 (默认: CODE_MAP.json)
  --skip-semantics, -s  跳过 AI 语义生成
  --port <n>            服务器端口 (默认: 3030)

蓝图内容:
  • 层级结构: 目录树视图 + 架构分层视图
  • 引用关系: 模块依赖、符号调用、类型引用
  • 语义描述: AI 生成的业务含义描述

示例:
  /map                  生成增强版蓝图（含 AI 语义）
  /map -s               生成蓝图（跳过语义，更快）
  /map generate -o blueprint.json
  /map serve --port 8080
  /map status`,
  category: 'development',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { subcommand, options } = parseArgs(ctx.args);

    switch (subcommand) {
      case 'generate':
        return handleGenerate(ctx, options);

      case 'serve':
        return handleServe(ctx, options);

      case 'view':
        return handleView(ctx, options);

      case 'status':
        return handleStatus(ctx, options);

      default:
        // 默认行为：生成增强版蓝图
        return handleGenerate(ctx, options);
    }
  },
};

// 导出注册函数
import { commandRegistry } from './registry.js';

export function registerMapCommands(): void {
  commandRegistry.register(mapCommand);
}
