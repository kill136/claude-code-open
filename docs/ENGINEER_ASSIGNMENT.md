# 工程师任务分配清单

> 共 100 个任务，分配给 100 名工程师
> 每位工程师负责一个独立的功能点测试和修复

---

## 任务分配总览

| 工程师 | 任务ID | 功能模块 | 优先级 | 预计工时 |
|--------|--------|----------|--------|----------|
| #001 | 001 | CLI - 基础启动 | P0 | 4h |
| #002 | 002 | CLI - 带提示词启动 | P0 | 4h |
| #003 | 003 | CLI - 打印模式 | P0 | 6h |
| #004 | 004 | CLI - 输出格式 | P1 | 6h |
| #005 | 005 | CLI - JSON Schema | P2 | 4h |
| #006 | 006 | CLI - 输入格式 | P1 | 4h |
| #007 | 007 | CLI - 模型选择 | P0 | 6h |
| #008 | 008 | CLI - 回退模型 | P2 | 4h |
| #009 | 009 | CLI - 会话继续 | P0 | 8h |
| #010 | 010 | CLI - 会话恢复 | P0 | 8h |
| #011 | 011 | CLI - 会话分叉 | P2 | 4h |
| #012 | 012 | CLI - 禁用持久化 | P2 | 4h |
| #013 | 013 | CLI - 工具控制 | P1 | 8h |
| #014 | 014 | CLI - 权限模式 | P0 | 8h |
| #015 | 015 | CLI - 系统提示词 | P1 | 6h |
| #016 | 016 | CLI - MCP配置 | P1 | 6h |
| #017 | 017 | CLI - 额外目录 | P2 | 4h |
| #018 | 018 | CLI - 调试模式 | P1 | 6h |
| #019 | 019 | CLI - 预算控制 | P2 | 4h |
| #020 | 020 | CLI - 跳过权限 | P1 | 4h |
| #021 | 021 | Tools - Bash基础 | P0 | 8h |
| #022 | 022 | Tools - Bash超时 | P1 | 6h |
| #023 | 023 | Tools - Bash后台 | P1 | 8h |
| #024 | 024 | Tools - BashOutput | P1 | 6h |
| #025 | 025 | Tools - KillShell | P1 | 4h |
| #026 | 026 | Tools - Read基础 | P0 | 8h |
| #027 | 027 | Tools - Read分页 | P1 | 6h |
| #028 | 028 | Tools - Read二进制 | P1 | 8h |
| #029 | 029 | Tools - Write | P0 | 6h |
| #030 | 030 | Tools - Edit替换 | P0 | 8h |
| #031 | 031 | Tools - Edit全局 | P1 | 4h |
| #032 | 032 | Tools - MultiEdit | P1 | 8h |
| #033 | 033 | Tools - Glob | P0 | 6h |
| #034 | 034 | Tools - Grep基础 | P0 | 8h |
| #035 | 035 | Tools - Grep输出 | P1 | 4h |
| #036 | 036 | Tools - Grep上下文 | P2 | 4h |
| #037 | 037 | Tools - Grep多行 | P2 | 4h |
| #038 | 038 | Tools - Task启动 | P0 | 8h |
| #039 | 039 | Tools - Task类型 | P0 | 8h |
| #040 | 040 | Tools - Task恢复 | P2 | 6h |
| #041 | 041 | Tools - WebFetch | P1 | 8h |
| #042 | 042 | Tools - WebSearch | P1 | 8h |
| #043 | 043 | Tools - TodoWrite | P1 | 6h |
| #044 | 044 | Tools - NotebookEdit | P2 | 6h |
| #045 | 045 | Tools - PlanMode | P1 | 8h |
| #046 | 046 | MCP - serve | P1 | 8h |
| #047 | 047 | MCP - add | P0 | 8h |
| #048 | 048 | MCP - remove | P1 | 4h |
| #049 | 049 | MCP - list/get | P1 | 4h |
| #050 | 050 | MCP - add-json | P2 | 4h |
| #051 | 051 | MCP - 导入 | P2 | 6h |
| #052 | 052 | MCP - 工具调用 | P0 | 8h |
| #053 | 053 | MCP - 资源读取 | P2 | 6h |
| #054 | 054 | MCP - 权限 | P1 | 6h |
| #055 | 055 | MCP - 错误处理 | P1 | 6h |
| #056 | 056 | Session - 创建 | P0 | 6h |
| #057 | 057 | Session - 持久化 | P0 | 8h |
| #058 | 058 | Session - 加载 | P0 | 6h |
| #059 | 059 | Session - 过期 | P2 | 4h |
| #060 | 060 | Session - Token | P1 | 6h |
| #061 | 061 | Session - 费用 | P1 | 6h |
| #062 | 062 | Session - 选择器 | P2 | 8h |
| #063 | 063 | Session - 摘要 | P1 | 8h |
| #064 | 064 | Permission - 文件 | P0 | 8h |
| #065 | 065 | Permission - Bash | P0 | 8h |
| #066 | 066 | Permission - 规则 | P1 | 8h |
| #067 | 067 | Permission - Bwrap | P1 | 8h |
| #068 | 068 | Permission - Seatbelt | P1 | 8h |
| #069 | 069 | Permission - 工作目录 | P0 | 6h |
| #070 | 070 | Permission - 敏感文件 | P0 | 6h |
| #071 | 071 | Permission - API Key | P0 | 6h |
| #072 | 072 | Permission - 网络 | P1 | 6h |
| #073 | 073 | Permission - Git安全 | P0 | 6h |
| #074 | 074 | Hooks - PreToolUse | P1 | 6h |
| #075 | 075 | Hooks - PostToolUse | P1 | 6h |
| #076 | 076 | Hooks - SessionStart | P2 | 4h |
| #077 | 077 | Hooks - UserPrompt | P2 | 4h |
| #078 | 078 | Hooks - Stop | P2 | 4h |
| #079 | 079 | Hooks - Notification | P2 | 4h |
| #080 | 080 | Config - settings | P0 | 6h |
| #081 | 081 | Config - local | P2 | 4h |
| #082 | 082 | Config - CLAUDE.md | P0 | 8h |
| #083 | 083 | Config - .mcp.json | P1 | 6h |
| #084 | 084 | Config - 环境变量 | P0 | 6h |
| #085 | 085 | Config - 合并 | P1 | 6h |
| #086 | 086 | Config - Memory | P2 | 6h |
| #087 | 087 | Config - 验证 | P1 | 6h |
| #088 | 088 | IDE - VS Code | P1 | 8h |
| #089 | 089 | IDE - JetBrains | P2 | 8h |
| #090 | 090 | IDE - 文件同步 | P2 | 6h |
| #091 | 091 | IDE - --ide选项 | P2 | 4h |
| #092 | 092 | IDE - Chrome | P2 | 6h |
| #093 | 093 | Plugin - 加载 | P1 | 8h |
| #094 | 094 | Plugin - 安装 | P1 | 6h |
| #095 | 095 | Plugin - 启用 | P2 | 4h |
| #096 | 096 | Plugin - Marketplace | P2 | 6h |
| #097 | 097 | Plugin - 验证 | P2 | 6h |
| #098 | 098 | UI - 终端渲染 | P0 | 8h |
| #099 | 099 | UI - Markdown | P1 | 6h |
| #100 | 100 | UI - 流式输出 | P0 | 8h |

---

## 每位工程师的任务说明

### 工作流程

1. **领取任务**: 在任务分配表中找到你的工程师编号对应的任务
2. **阅读规范**: 查看 `docs/FEATURE_TEST_PLAN.md` 中对应任务的详细说明
3. **编写测试**: 在 `tests/<category>/<task-id>-*.test.ts` 创建测试文件
4. **运行测试**: 使用 `npm run test:feature:<category>` 运行分类测试
5. **对比官方**: 使用 `compareCLIOutput()` 函数对比官方行为
6. **修复实现**: 根据测试结果修复 `src/` 中的实现代码
7. **提交代码**: 确保所有测试通过后提交

### 测试文件模板

```typescript
/**
 * 任务 XXX: [功能名称]
 * 负责人: 工程师 #XXX
 * 优先级: PX
 *
 * 官方行为: [官方CLI的行为描述]
 *
 * 验收标准:
 * - [ ] 验收项1
 * - [ ] 验收项2
 * - [ ] 验收项3
 */

import { describe, it, expect } from 'vitest';
import {
  runCLI,
  compareCLIOutput,
  describeFeature,
} from '../setup';

describeFeature(
  {
    id: 'XXX',
    category: 'CATEGORY',
    priority: 'PX',
    description: '功能名称',
    officialBehavior: '官方行为描述',
  },
  () => {
    describe('验收标准检查', () => {
      it('验收项1', async () => {
        // 测试代码
      });

      it('验收项2', async () => {
        // 测试代码
      });
    });

    describe('官方对比测试', () => {
      it('应该与官方行为一致', async () => {
        const { official, ours, match } = await compareCLIOutput(['--help']);
        expect(match).toBe(true);
      });
    });
  }
);
```

### 运行测试命令

```bash
# 运行所有功能测试
npm run test:feature

# 运行特定类别测试
npm run test:feature:cli       # CLI 命令测试
npm run test:feature:tools     # 工具系统测试
npm run test:feature:mcp       # MCP 集成测试
npm run test:feature:session   # 会话管理测试
npm run test:feature:permission # 权限系统测试
npm run test:feature:hooks     # Hook 钩子测试
npm run test:feature:config    # 配置系统测试
npm run test:feature:ide       # IDE 集成测试
npm run test:feature:plugin    # 插件系统测试
npm run test:feature:ui        # UI 输出测试

# 运行单个测试文件
npx vitest tests/cli/001-basic-start.test.ts

# 运行带覆盖率
npm run test:coverage
```

### 提交规范

```bash
# 提交格式
git commit -m "test(XXX): add feature test for [功能名称]"
git commit -m "fix(XXX): implement [功能名称] to match official behavior"

# 示例
git commit -m "test(021): add Bash tool basic execution tests"
git commit -m "fix(021): implement Bash tool timeout handling"
```

---

## 优先级说明

| 级别 | 含义 | 数量 | 建议 |
|------|------|------|------|
| **P0** | 核心功能 | 28个 | 必须首先完成 |
| **P1** | 重要功能 | 42个 | 第二优先级 |
| **P2** | 增强功能 | 30个 | 可选完成 |

### P0 任务清单 (必须完成)

- 001, 002, 003, 007, 009, 010, 014
- 021, 026, 029, 030, 033, 034, 038, 039
- 047, 052
- 056, 057, 058
- 064, 065, 069, 070, 071, 073
- 080, 082, 084
- 098, 100

---

## 联系方式

- **技术问题**: 在 GitHub Issues 中提问
- **任务协调**: 联系项目负责人
- **文档参考**: `docs/FEATURE_TEST_PLAN.md`

---

*分配日期: 2025-12-28*
*版本: v1.0*
