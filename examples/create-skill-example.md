# 创建和使用 Skills 示例

## 快速开始

### 1. 创建一个简单的 Skill

创建目录和 SKILL.md 文件：

```bash
# 创建 skill 目录
mkdir -p ~/.claude/skills/code-reviewer

# 创建 SKILL.md
cat > ~/.claude/skills/code-reviewer/SKILL.md << 'EOF'
---
name: Code Reviewer
description: Reviews code for best practices, bugs, and improvements
allowed-tools: Read,Grep,Bash
argument-hint: <file-path>
when-to-use: When user asks to review code or check for issues
version: 1.0.0
model: sonnet
user-invocable: true
disable-model-invocation: false
---

# Code Reviewer Skill

You are an expert code reviewer. When this skill is invoked:

1. **Read the code** from the specified file(s)
2. **Analyze** for:
   - Potential bugs
   - Performance issues
   - Security vulnerabilities
   - Code style violations
   - Best practices
3. **Provide** actionable feedback with:
   - Clear issue descriptions
   - Severity levels (Critical, High, Medium, Low)
   - Suggested fixes with code examples

## Review Checklist

- [ ] Error handling
- [ ] Input validation
- [ ] Resource cleanup
- [ ] Thread safety
- [ ] Documentation
- [ ] Test coverage

## Output Format

```markdown
## Code Review Results

### Critical Issues
- ...

### High Priority
- ...

### Suggestions
- ...
```
EOF
```

### 2. 创建一个数据分析 Skill

```bash
mkdir -p ~/.claude/skills/data-analyst

cat > ~/.claude/skills/data-analyst/SKILL.md << 'EOF'
---
name: Data Analyst
description: Analyzes data files and generates insights
allowed-tools: Read,Bash,Write
argument-hint: <data-file>
when-to-use: When user needs to analyze CSV, JSON, or log files
version: 1.0.0
model: sonnet
---

# Data Analyst Skill

Analyze data files and extract meaningful insights.

## Capabilities

1. **Data Loading**: Read various formats (CSV, JSON, TSV, logs)
2. **Statistical Analysis**: Calculate mean, median, mode, std dev
3. **Pattern Detection**: Find trends, anomalies, correlations
4. **Visualization**: Suggest appropriate charts and graphs
5. **Report Generation**: Create markdown reports with findings

## Workflow

1. Load and parse the data file
2. Perform basic statistics
3. Detect patterns and anomalies
4. Generate visualizations (describe charts)
5. Create a comprehensive report

## Report Template

```markdown
# Data Analysis Report

## Summary
- Total records: N
- Date range: X to Y
- Key metrics: ...

## Findings
1. ...
2. ...

## Recommendations
- ...
```
EOF
```

### 3. 创建一个 Git 助手 Skill

```bash
mkdir -p ~/.claude/skills/git-helper

cat > ~/.claude/skills/git-helper/SKILL.md << 'EOF'
---
name: Git Helper
description: Helps with git operations and best practices
allowed-tools: Bash,Read,Write
when-to-use: When user needs help with git commands or workflows
version: 1.0.0
model: haiku
---

# Git Helper Skill

Your git operations assistant.

## Commands I Can Help With

### Basic Operations
- `git status` - Check repository status
- `git add` - Stage changes
- `git commit` - Commit with good messages
- `git push/pull` - Sync with remote

### Advanced Operations
- `git rebase` - Rewrite history
- `git cherry-pick` - Apply specific commits
- `git stash` - Save temporary changes
- `git bisect` - Find problematic commits

### Best Practices
1. **Commit Messages**: Follow conventional commits format
2. **Branching**: Use feature branches
3. **Merging**: Prefer rebase for clean history
4. **Tags**: Version releases properly

## Commit Message Template

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: feat, fix, docs, style, refactor, test, chore
EOF
```

---

## 使用示例

### 在 Claude Code 中调用

#### 方式 1: 通过工具调用

```typescript
import { SkillTool } from './tools/skill.js';

const skillTool = new SkillTool();

// 调用代码审查 skill
const result = await skillTool.execute({
  skill: 'code-reviewer',
  args: 'src/index.ts'
});

console.log(result.output);
```

#### 方式 2: 通过 Claude 对话

用户输入：
```
请使用 code-reviewer skill 检查 src/auth.ts 的代码质量
```

Claude 会自动：
1. 识别需要使用 `code-reviewer` skill
2. 调用 Skill 工具
3. 读取 skill 内容
4. 执行代码审查任务

---

## 高级技巧

### 1. 使用命名空间

如果项目和用户都有同名 skill，项目级优先：

```bash
# 用户级
~/.claude/skills/formatter/SKILL.md

# 项目级（优先）
./.claude/skills/formatter/SKILL.md
```

调用时：
```typescript
// 自动使用项目级
execute({ skill: 'formatter' })

// 明确指定用户级
execute({ skill: 'user:formatter' })

// 明确指定项目级
execute({ skill: 'project:formatter' })
```

### 2. 传递参数

```typescript
// 传递文件路径
execute({
  skill: 'code-reviewer',
  args: 'src/api/auth.ts'
})

// 传递多个参数
execute({
  skill: 'data-analyst',
  args: '--format json --output report.md data.csv'
})
```

Skill 中接收参数：
```markdown
If arguments are provided:
- Parse the file path from args
- Use Read tool to load the file
- Process accordingly
```

### 3. 工具限制

使用 `allowed-tools` 字段限制 skill 可用的工具：

```yaml
---
allowed-tools: Read,Write  # 只能使用这两个工具
---
```

如果 skill 尝试使用其他工具，会被阻止。

### 4. 禁用自动调用

如果希望 skill 只能由用户手动触发：

```yaml
---
user-invocable: true
disable-model-invocation: true  # 模型不能自动调用
---
```

---

## 调试技巧

### 1. 查看已加载的 Skills

```typescript
import { getAllSkills } from './tools/skill.js';

const skills = getAllSkills();
console.log('Loaded skills:', skills.map(s => s.skillName));
```

### 2. 检查调用历史

```typescript
import { getInvokedSkills } from './tools/skill.js';

const invoked = getInvokedSkills();
invoked.forEach((info, name) => {
  console.log(`${name} was called at ${new Date(info.invokedAt)}`);
});
```

### 3. 清除缓存

如果 skill 文件更新了但没有生效：

```typescript
import { clearSkillCache, initializeSkills } from './tools/skill.js';

clearSkillCache();
await initializeSkills();
```

---

## 最佳实践

### 1. 明确的描述

```yaml
description: Analyzes TypeScript code for type safety issues
```

❌ 不好：`description: Does stuff`

### 2. 具体的使用场景

```yaml
when-to-use: When user asks to check types, analyze TypeScript, or find type errors
```

### 3. 清晰的参数提示

```yaml
argument-hint: <file-path> [--strict] [--output <file>]
```

### 4. 版本管理

```yaml
version: 1.0.0  # 遵循语义化版本
```

更新 skill 时递增版本号：
- `1.0.0` → `1.0.1` (bugfix)
- `1.0.0` → `1.1.0` (new feature)
- `1.0.0` → `2.0.0` (breaking change)

---

## 故障排查

### Skill 没有被加载

1. 检查文件名是否为 `SKILL.md`（全大写）
2. 检查文件路径：`~/.claude/skills/<skill-name>/SKILL.md`
3. 检查 frontmatter 格式是否正确
4. 清除缓存并重新加载

### Frontmatter 解析错误

确保格式正确：
```yaml
---
key: value
another-key: another value
---
```

- 每行一个键值对
- 使用冒号分隔
- 值可以有引号（会被自动移除）

### Skill 执行失败

1. 检查 `allowed-tools` 是否包含所需工具
2. 检查 `disable-model-invocation` 是否为 `false`
3. 查看错误日志

---

## 示例项目

查看更多示例：
- [官方 Skills 仓库](https://github.com/anthropics/claude-skills)（假设）
- [社区 Skills 集合](#)
- [本项目测试 Skill](~/.claude/skills/test-skill/SKILL.md)

---

## 资源

- [Skills 实现报告](../SKILLS-IMPLEMENTATION-REPORT.md)
- [官网文档](https://claude.com/code/docs/skills)
- [技能开发指南](#)

---

Happy Skill Building! 🚀
