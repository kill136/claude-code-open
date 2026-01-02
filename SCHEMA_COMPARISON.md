# 工具 Schema 对比报告

**生成时间**: 2026-01-02T13:45:17.245Z

## 官方工具 Schema

### Agent

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| description | `string` | ✓ | - |
| prompt | `string` | ✓ | - |
| subagent_type | `string` | ✓ | - |
| model | `"sonnet" | "opus" | "haiku"` | ✗ | - |
| resume | `string` | ✗ | - |
| run_in_background | `boolean` | ✗ | - |

### Bash

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| command | `string` | ✓ | - |
| timeout | `number` | ✗ | - |
| description | `string` | ✗ | - |
| run_in_background | `boolean` | ✗ | - |
| dangerouslyDisableSandbox | `boolean` | ✗ | - |

### TaskOutput

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| task_id | `string` | ✓ | - |
| block | `boolean` | ✗ | - |
| timeout | `number` | ✗ | - |

### ExitPlanMode

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|

### FileEdit

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | `string` | ✓ | - |
| old_string | `string` | ✓ | - |
| new_string | `string` | ✓ | - |
| replace_all | `boolean` | ✗ | - |

### FileRead

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | `string` | ✓ | - |
| offset | `number` | ✗ | - |
| limit | `number` | ✗ | - |

### FileWrite

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | `string` | ✓ | - |
| content | `string` | ✓ | - |

### Glob

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| pattern | `string` | ✓ | - |
| path | `string` | ✗ | - |

### Grep

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| pattern | `string` | ✓ | - |
| path | `string` | ✗ | - |

### KillShell

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| shell_id | `string` | ✓ | - |

### ListMcpResources

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| server | `string` | ✗ | - |

### Mcp

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|

### NotebookEdit

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| notebook_path | `string` | ✓ | - |
| cell_id | `string` | ✗ | - |
| new_source | `string` | ✓ | - |
| cell_type | `"code" | "markdown"` | ✗ | - |
| edit_mode | `"replace" | "insert" | "delete"` | ✗ | - |

### ReadMcpResource

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| server | `string` | ✓ | - |
| uri | `string` | ✓ | - |

### TodoWrite

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| todos | `{` | ✓ | - |
| content | `string` | ✓ | - |
| status | `"pending" | "in_progress" | "completed"` | ✓ | - |
| activeForm | `string` | ✓ | - |

### WebFetch

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| url | `string` | ✓ | - |
| prompt | `string` | ✓ | - |

### WebSearch

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| query | `string` | ✓ | - |
| allowed_domains | `string[]` | ✗ | - |
| blocked_domains | `string[]` | ✗ | - |

### AskUserQuestion

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| question | `string` | ✓ | - |
| header | `string` | ✓ | - |
| label | `string` | ✓ | - |
| description | `string` | ✓ | - |

