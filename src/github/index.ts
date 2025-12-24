/**
 * GitHub 集成功能
 * 包括 GitHub Actions 工作流设置和 PR 管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * GitHub Actions 工作流模板
 */
const CLAUDE_CODE_WORKFLOW = `name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  claude-review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Run Claude Code Review
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Get PR details
          if [ "\${{ github.event_name }}" == "pull_request" ]; then
            claude -p "Review the changes in this PR and provide feedback" --output-format json
          else
            claude -p "Respond to the comment: \${{ github.event.comment.body }}" --output-format json
          fi
`;

/**
 * 检查 GitHub CLI 是否可用
 */
export async function checkGitHubCLI(): Promise<{ installed: boolean; authenticated: boolean }> {
  return new Promise((resolve) => {
    const gh = spawn('gh', ['auth', 'status'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    gh.stdout.on('data', (data) => (output += data.toString()));
    gh.stderr.on('data', (data) => (output += data.toString()));

    gh.on('error', () => {
      resolve({ installed: false, authenticated: false });
    });

    gh.on('close', (code) => {
      if (code === 0 || output.includes('Logged in')) {
        resolve({ installed: true, authenticated: true });
      } else if (output.includes('gh auth login')) {
        resolve({ installed: true, authenticated: false });
      } else {
        resolve({ installed: false, authenticated: false });
      }
    });
  });
}

/**
 * 设置 GitHub Actions 工作流
 */
export async function setupGitHubWorkflow(projectDir: string): Promise<{
  success: boolean;
  message: string;
  workflowPath?: string;
}> {
  const workflowsDir = path.join(projectDir, '.github', 'workflows');
  const workflowPath = path.join(workflowsDir, 'claude-code.yml');

  // 检查是否是 git 仓库
  const gitDir = path.join(projectDir, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      success: false,
      message: 'Not a git repository. Run "git init" first.',
    };
  }

  // 创建目录
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  // 检查是否已存在
  if (fs.existsSync(workflowPath)) {
    return {
      success: false,
      message: 'GitHub workflow already exists.',
      workflowPath,
    };
  }

  // 写入工作流文件
  fs.writeFileSync(workflowPath, CLAUDE_CODE_WORKFLOW);

  return {
    success: true,
    message: 'GitHub Actions workflow created successfully!',
    workflowPath,
  };
}

/**
 * 获取 PR 信息
 */
export async function getPRInfo(prNumber: number): Promise<{
  title: string;
  body: string;
  author: string;
  state: string;
  additions: number;
  deletions: number;
  changedFiles: number;
} | null> {
  return new Promise((resolve) => {
    const gh = spawn('gh', [
      'pr', 'view', String(prNumber),
      '--json', 'title,body,author,state,additions,deletions,changedFiles',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    gh.stdout.on('data', (data) => (output += data.toString()));

    gh.on('error', () => {
      resolve(null);
    });

    gh.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          resolve({
            title: data.title,
            body: data.body,
            author: data.author?.login || 'unknown',
            state: data.state,
            additions: data.additions,
            deletions: data.deletions,
            changedFiles: data.changedFiles,
          });
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * 获取 PR 评论
 */
export async function getPRComments(prNumber: number): Promise<Array<{
  author: string;
  body: string;
  createdAt: string;
}>> {
  return new Promise((resolve) => {
    const gh = spawn('gh', [
      'pr', 'view', String(prNumber),
      '--json', 'comments',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    gh.stdout.on('data', (data) => (output += data.toString()));

    gh.on('error', () => {
      resolve([]);
    });

    gh.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          resolve(
            (data.comments || []).map((c: { author?: { login: string }; body: string; createdAt: string }) => ({
              author: c.author?.login || 'unknown',
              body: c.body,
              createdAt: c.createdAt,
            }))
          );
        } catch {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * 添加 PR 评论
 */
export async function addPRComment(prNumber: number, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    const gh = spawn('gh', ['pr', 'comment', String(prNumber), '--body', body], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    gh.on('error', () => {
      resolve(false);
    });

    gh.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * 创建 PR
 */
export async function createPR(options: {
  title: string;
  body: string;
  base?: string;
  head?: string;
  draft?: boolean;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  return new Promise((resolve) => {
    const args = ['pr', 'create', '--title', options.title, '--body', options.body];

    if (options.base) {
      args.push('--base', options.base);
    }
    if (options.head) {
      args.push('--head', options.head);
    }
    if (options.draft) {
      args.push('--draft');
    }

    const gh = spawn('gh', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    gh.stdout.on('data', (data) => (stdout += data.toString()));
    gh.stderr.on('data', (data) => (stderr += data.toString()));

    gh.on('error', () => {
      resolve({ success: false, error: 'Failed to run gh command' });
    });

    gh.on('close', (code) => {
      if (code === 0) {
        const url = stdout.trim();
        resolve({ success: true, url });
      } else {
        resolve({ success: false, error: stderr || 'Failed to create PR' });
      }
    });
  });
}
