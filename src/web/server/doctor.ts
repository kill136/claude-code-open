/**
 * WebUI 诊断工具 (Doctor)
 * 用于检查系统状态和配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { detectProvider, validateProviderConfig } from '../../providers/index.js';

/**
 * 单个诊断检查结果
 */
export interface DiagnosticResult {
  category: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
  fix?: string;
}

/**
 * 完整诊断报告
 */
export interface DoctorReport {
  timestamp: Date;
  results: DiagnosticResult[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  systemInfo?: {
    version: string;
    platform: string;
    nodeVersion: string;
    memory: {
      total: string;
      free: string;
      used: string;
      percentUsed: number;
    };
    cpu: {
      model: string;
      cores: number;
      loadAverage: number[];
    };
  };
}

/**
 * 诊断选项
 */
export interface DiagnosticsOptions {
  verbose?: boolean;
  includeSystemInfo?: boolean;
}

/**
 * 运行所有诊断检查
 */
export async function runDiagnostics(options: DiagnosticsOptions = {}): Promise<DoctorReport> {
  const results: DiagnosticResult[] = [];

  // 环境检查
  results.push(await checkNodeVersion());
  results.push(await checkNpmVersion());
  results.push(await checkGitAvailability());

  // 认证和API检查
  results.push(await checkApiKey());
  results.push(await checkApiConnectivity());

  // 文件系统检查
  results.push(await checkWorkingDirectory());
  results.push(await checkSessionDirectory());
  results.push(await checkFilePermissions());

  // 配置检查
  results.push(await checkConfigurationFiles());

  // 网络检查
  results.push(await checkNetworkConnectivity());

  // 性能检查
  if (options.verbose) {
    results.push(await checkMemoryUsage());
    results.push(await checkDiskSpace());
  }

  // 计算摘要
  const summary = {
    passed: results.filter(r => r.status === 'pass').length,
    warnings: results.filter(r => r.status === 'warn').length,
    failed: results.filter(r => r.status === 'fail').length,
  };

  // 系统信息
  const systemInfo = options.includeSystemInfo || options.verbose ? {
    version: getVersion(),
    platform: `${os.platform()} ${os.release()}`,
    nodeVersion: process.version,
    memory: getMemoryInfo(),
    cpu: getCPUInfo(),
  } : undefined;

  return {
    timestamp: new Date(),
    results,
    summary,
    systemInfo,
  };
}

/**
 * 检查 Node.js 版本
 */
async function checkNodeVersion(): Promise<DiagnosticResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 20) {
    return {
      category: '环境',
      name: 'Node.js 版本',
      status: 'pass',
      message: `Node.js ${version} 已安装`,
    };
  } else if (major >= 18) {
    return {
      category: '环境',
      name: 'Node.js 版本',
      status: 'warn',
      message: `Node.js ${version} 可用，但建议使用 20+`,
      fix: '升级到 Node.js 20+: nvm install 20 && nvm use 20',
    };
  } else {
    return {
      category: '环境',
      name: 'Node.js 版本',
      status: 'fail',
      message: `Node.js ${version} 版本过低`,
      details: '请升级到 Node.js 20 或更高版本',
      fix: '安装 Node.js 20+: https://nodejs.org/',
    };
  }
}

/**
 * 检查 npm 版本
 */
async function checkNpmVersion(): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    child_process.exec('npm --version', (error, stdout) => {
      if (error) {
        resolve({
          category: '环境',
          name: 'npm',
          status: 'warn',
          message: '未找到 npm',
          details: 'npm 通常随 Node.js 一起安装',
          fix: '从 https://nodejs.org/ 重新安装 Node.js',
        });
      } else {
        const version = stdout.trim();
        resolve({
          category: '环境',
          name: 'npm',
          status: 'pass',
          message: `npm ${version}`,
        });
      }
    });
  });
}

/**
 * 检查 Git 可用性
 */
async function checkGitAvailability(): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    child_process.exec('git --version', (error, stdout) => {
      if (error) {
        resolve({
          category: '环境',
          name: 'Git',
          status: 'warn',
          message: '未找到 Git',
          details: '某些功能可能无法使用',
          fix: '安装 Git: https://git-scm.com/',
        });
      } else {
        resolve({
          category: '环境',
          name: 'Git',
          status: 'pass',
          message: stdout.trim(),
        });
      }
    });
  });
}

/**
 * 检查 API 密钥配置
 */
async function checkApiKey(): Promise<DiagnosticResult> {
  const provider = detectProvider();
  const validation = validateProviderConfig(provider);

  if (validation.valid) {
    return {
      category: 'API',
      name: 'API 密钥',
      status: 'pass',
      message: `${provider.type} 认证已配置`,
    };
  } else {
    return {
      category: 'API',
      name: 'API 密钥',
      status: 'fail',
      message: '未配置认证',
      details: validation.errors.join('; '),
      fix: '设置环境变量 ANTHROPIC_API_KEY 或 CLAUDE_API_KEY',
    };
  }
}

/**
 * 检查 API 连接性
 */
async function checkApiConnectivity(): Promise<DiagnosticResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'OPTIONS',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 405) {
      return {
        category: 'API',
        name: 'API 连接',
        status: 'pass',
        message: '可以访问 Anthropic API',
      };
    } else {
      return {
        category: 'API',
        name: 'API 连接',
        status: 'warn',
        message: `API 响应状态 ${response.status}`,
      };
    }
  } catch (err: any) {
    return {
      category: 'API',
      name: 'API 连接',
      status: 'fail',
      message: '无法访问 Anthropic API',
      details: err.message || String(err),
      fix: '检查网络连接和防火墙设置',
    };
  }
}

/**
 * 检查工作目录权限
 */
async function checkWorkingDirectory(): Promise<DiagnosticResult> {
  try {
    const cwd = process.cwd();

    // 检查可读性
    fs.accessSync(cwd, fs.constants.R_OK);

    // 尝试写入测试文件
    const testFile = path.join(cwd, '.claude-write-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return {
        category: '文件系统',
        name: '工作目录',
        status: 'pass',
        message: `目录可读写: ${cwd}`,
      };
    } catch {
      return {
        category: '文件系统',
        name: '工作目录',
        status: 'warn',
        message: '目录可读但不可写',
        details: `路径: ${cwd}`,
      };
    }
  } catch (err) {
    return {
      category: '文件系统',
      name: '工作目录',
      status: 'fail',
      message: '无法访问工作目录',
      details: String(err),
    };
  }
}

/**
 * 检查会话目录
 */
async function checkSessionDirectory(): Promise<DiagnosticResult> {
  const sessionDir = path.join(os.homedir(), '.claude', 'sessions');

  try {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // 统计会话文件
    const files = fs.readdirSync(sessionDir);
    const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

    // 计算总大小
    let totalSize = 0;
    for (const file of files) {
      const stats = fs.statSync(path.join(sessionDir, file));
      totalSize += stats.size;
    }

    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      category: '文件系统',
      name: '会话目录',
      status: 'pass',
      message: `${sessionFiles.length} 个会话，${sizeMB} MB`,
      details: `路径: ${sessionDir}`,
    };
  } catch (err) {
    return {
      category: '文件系统',
      name: '会话目录',
      status: 'fail',
      message: '无法访问会话目录',
      details: String(err),
      fix: `确保 ${sessionDir} 目录可写`,
    };
  }
}

/**
 * 检查文件权限
 */
async function checkFilePermissions(): Promise<DiagnosticResult> {
  const claudeDir = path.join(os.homedir(), '.claude');
  const issues: string[] = [];

  try {
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // 尝试写入测试文件
    const testFile = path.join(claudeDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    issues.push(`无法写入 ${claudeDir}: ${err}`);
  }

  if (issues.length === 0) {
    return {
      category: '文件系统',
      name: '文件权限',
      status: 'pass',
      message: '文件权限正常',
    };
  } else {
    return {
      category: '文件系统',
      name: '文件权限',
      status: 'fail',
      message: '检测到权限问题',
      details: issues.join('; '),
    };
  }
}

/**
 * 检查配置文件
 */
async function checkConfigurationFiles(): Promise<DiagnosticResult> {
  const files: { path: string; name: string; required: boolean }[] = [
    {
      path: path.join(os.homedir(), '.claude', 'settings.json'),
      name: '全局配置',
      required: false
    },
    {
      path: path.join(process.cwd(), '.claude', 'settings.local.json'),
      name: '本地配置',
      required: false
    },
    {
      path: path.join(process.cwd(), 'CLAUDE.md'),
      name: '项目指令',
      required: false
    },
  ];

  const found: string[] = [];
  const issues: string[] = [];

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      try {
        if (file.path.endsWith('.json')) {
          JSON.parse(fs.readFileSync(file.path, 'utf-8'));
        }
        found.push(file.name);
      } catch (err) {
        issues.push(`${file.name} 格式无效`);
      }
    } else if (file.required) {
      issues.push(`${file.name} 未找到`);
    }
  }

  if (issues.length > 0) {
    return {
      category: '配置',
      name: '配置文件',
      status: 'warn',
      message: '检测到配置问题',
      details: issues.join('; '),
    };
  } else if (found.length > 0) {
    return {
      category: '配置',
      name: '配置文件',
      status: 'pass',
      message: `找到: ${found.join(', ')}`,
    };
  } else {
    return {
      category: '配置',
      name: '配置文件',
      status: 'pass',
      message: '使用默认配置',
    };
  }
}

/**
 * 检查网络连接
 */
async function checkNetworkConnectivity(): Promise<DiagnosticResult> {
  const endpoints = [
    { url: 'https://www.google.com', name: 'Internet' },
    { url: 'https://registry.npmjs.org', name: 'NPM' },
  ];

  const results: string[] = [];
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      await fetch(endpoint.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      results.push(endpoint.name);
    } catch {
      failures.push(endpoint.name);
    }
  }

  if (failures.length === 0) {
    return {
      category: '网络',
      name: '网络连接',
      status: 'pass',
      message: '网络连接正常',
    };
  } else if (results.length > 0) {
    return {
      category: '网络',
      name: '网络连接',
      status: 'warn',
      message: `部分端点无法访问: ${failures.join(', ')}`,
    };
  } else {
    return {
      category: '网络',
      name: '网络连接',
      status: 'fail',
      message: '无网络连接',
    };
  }
}

/**
 * 检查内存使用
 */
async function checkMemoryUsage(): Promise<DiagnosticResult> {
  const memInfo = getMemoryInfo();
  const percentUsed = memInfo.percentUsed;

  if (percentUsed >= 90) {
    return {
      category: '性能',
      name: '内存使用',
      status: 'warn',
      message: `内存使用率高: ${percentUsed.toFixed(1)}%`,
      details: `${memInfo.used} / ${memInfo.total} 已使用`,
      fix: '关闭一些应用程序以释放内存',
    };
  } else if (percentUsed >= 75) {
    return {
      category: '性能',
      name: '内存使用',
      status: 'warn',
      message: `内存使用率中等: ${percentUsed.toFixed(1)}%`,
      details: `${memInfo.used} / ${memInfo.total} 已使用`,
    };
  } else {
    return {
      category: '性能',
      name: '内存使用',
      status: 'pass',
      message: `${percentUsed.toFixed(1)}% (${memInfo.used} / ${memInfo.total})`,
    };
  }
}

/**
 * 检查磁盘空间
 */
async function checkDiskSpace(): Promise<DiagnosticResult> {
  try {
    const homeDir = os.homedir();
    const stats = fs.statfsSync(homeDir);
    const freeGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);

    if (freeGB >= 1) {
      return {
        category: '性能',
        name: '磁盘空间',
        status: 'pass',
        message: `${freeGB.toFixed(1)} GB 可用`,
      };
    } else if (freeGB >= 0.1) {
      return {
        category: '性能',
        name: '磁盘空间',
        status: 'warn',
        message: `仅剩 ${freeGB.toFixed(1)} GB`,
        details: '建议释放磁盘空间',
      };
    } else {
      return {
        category: '性能',
        name: '磁盘空间',
        status: 'fail',
        message: '磁盘空间非常低',
        details: '可用空间不足 100MB',
      };
    }
  } catch {
    return {
      category: '性能',
      name: '磁盘空间',
      status: 'warn',
      message: '无法检查磁盘空间',
    };
  }
}

/**
 * 获取版本号
 */
function getVersion(): string {
  try {
    const packagePath = path.join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

/**
 * 获取内存信息
 */
function getMemoryInfo(): {
  total: string;
  free: string;
  used: string;
  percentUsed: number;
} {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const percentUsed = (usedMem / totalMem) * 100;

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  return {
    total: formatBytes(totalMem),
    free: formatBytes(freeMem),
    used: formatBytes(usedMem),
    percentUsed,
  };
}

/**
 * 获取 CPU 信息
 */
function getCPUInfo(): {
  model: string;
  cores: number;
  loadAverage: number[];
} {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    loadAverage: os.loadavg(),
  };
}

/**
 * 格式化诊断报告为文本
 */
export function formatDoctorReport(report: DoctorReport, verbose: boolean = false): string {
  const lines: string[] = [];

  lines.push('╭─────────────────────────────────────────────╮');
  lines.push('│      Claude Code WebUI 诊断报告            │');
  lines.push('╰─────────────────────────────────────────────╯');
  lines.push('');

  if (report.systemInfo) {
    lines.push(`  版本:     ${report.systemInfo.version}`);
    lines.push(`  平台:     ${report.systemInfo.platform}`);
    lines.push(`  Node:     ${report.systemInfo.nodeVersion}`);

    if (verbose) {
      lines.push('');
      lines.push('  系统信息:');
      lines.push(`    内存:   ${report.systemInfo.memory.used} / ${report.systemInfo.memory.total} (${report.systemInfo.memory.percentUsed.toFixed(1)}% 已使用)`);
      lines.push(`    CPU:    ${report.systemInfo.cpu.model}`);
      lines.push(`    核心:   ${report.systemInfo.cpu.cores}`);
      lines.push(`    负载:   ${report.systemInfo.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
    }
  }

  lines.push('');
  lines.push('─────────────────────────────────────────────');
  lines.push('');

  // 按类别分组显示
  const categories = Array.from(new Set(report.results.map(r => r.category)));

  for (const category of categories) {
    const categoryResults = report.results.filter(r => r.category === category);

    lines.push(`${category}`);
    lines.push(`${'-'.repeat(category.length)}`);

    for (const check of categoryResults) {
      const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      lines.push(`  ${icon} ${check.name}: ${check.message}`);

      if (verbose && check.details) {
        lines.push(`    └─ ${check.details}`);
      }

      if (verbose && check.fix) {
        lines.push(`    💡 修复: ${check.fix}`);
      }
    }

    lines.push('');
  }

  lines.push('─────────────────────────────────────────────');
  lines.push('');
  lines.push(`  总结: ${report.summary.passed} 通过, ${report.summary.warnings} 警告, ${report.summary.failed} 失败`);
  lines.push('');

  if (report.summary.warnings > 0 || report.summary.failed > 0) {
    lines.push('  💡 使用 /doctor verbose 查看详细信息和修复建议');
    lines.push('');
  }

  return lines.join('\n');
}
