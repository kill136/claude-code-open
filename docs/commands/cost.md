# /cost - 成本统计命令

## 功能

显示当前会话的成本、时长和 Token 使用详情。

## 使用方法

```bash
/cost
```

## 输出示例

```
Total cost:            $0.0123
Total duration (API):  2m 15s
Total duration (wall): 2m 18s

Token Usage by Model:
  Sonnet         :      1,234 tokens
  Haiku          :        456 tokens

Current Pricing (per 1M tokens):
  Claude Opus 4.5     : $15 (input) / $75 (output)
  Claude Sonnet 4.5   : $3 (input) / $15 (output)
  Claude Haiku 3.5    : $0.25 (input) / $1.25 (output)

View detailed billing: https://console.anthropic.com/billing
```

## 输出说明

### 成本统计

- **Total cost**: 当前会话的总成本（美元）
  - 基于实际 API Token 使用量计算
  - 如果使用了未知模型，会显示警告

### 时长统计

- **Total duration (API)**: API 调用的总时长
- **Total duration (wall)**: 实际经过的墙上时间
  - 包括用户思考、输入等时间

### Token 使用详情

按模型分组显示 Token 使用量：
- **Opus**: Claude Opus 4.5 模型
- **Sonnet**: Claude Sonnet 4.5 模型
- **Haiku**: Claude Haiku 3.5 模型

### 定价参考

显示当前 Anthropic API 的定价：
- 输入 Token（input）和输出 Token（output）价格不同
- 价格单位：美元/百万 Token

## 相关命令

- `/usage` - 查看使用量统计
- `/stats` - 查看详细的会话统计
- `/context` - 查看上下文窗口使用情况

## 技术细节

### 成本计算

成本根据以下公式计算：

```
总成本 = (输入 Token 数 / 1,000,000) × 输入价格 +
         (输出 Token 数 / 1,000,000) × 输出价格
```

### 时长格式

- `< 1秒`: 显示为毫秒（如 `500ms`）
- `< 1分钟`: 显示为秒（如 `45.2s`）
- `>= 1分钟`: 显示为分秒（如 `2m 15s`）

### 未知模型警告

如果使用了不在标准定价表中的模型，会显示：
```
Total cost:            $0.0123 (costs may be inaccurate due to usage of unknown models)
```

## 最佳实践

1. **定期检查成本**：长时间对话时定期运行 `/cost` 了解花费
2. **选择合适的模型**：
   - 简单任务使用 Haiku（最便宜）
   - 复杂任务使用 Sonnet（性价比高）
   - 关键任务使用 Opus（最强大）
3. **监控 Token 使用**：注意哪些模型使用最多，优化提示词

## 注意事项

- ⚠️ 成本为估算值，实际账单可能略有不同
- ⚠️ 缓存写入和读取的价格可能不同（未单独显示）
- ⚠️ 定价可能随时变化，以官方网站为准

## 查看详细账单

访问 Anthropic Console 查看详细账单：
https://console.anthropic.com/billing

## 示例场景

### 场景 1：简短对话

```
Total cost:            $0.0003
Total duration (API):  5.2s
Total duration (wall): 12.8s

Token Usage by Model:
  Sonnet         :        150 tokens
```

### 场景 2：长时间编程会话

```
Total cost:            $1.2345
Total duration (API):  15m 30s
Total duration (wall): 45m 12s

Token Usage by Model:
  Sonnet         :     85,432 tokens
  Opus           :      5,123 tokens
  Haiku          :      2,890 tokens
```

### 场景 3：使用未知模型

```
Total cost:            $0.0123 (costs may be inaccurate due to usage of unknown models)
Total duration (API):  2m 15s
Total duration (wall): 2m 18s

Token Usage by Model:
  custom-model   :      1,234 tokens
```

## 源码参考

实现文件：`src/commands/utility.ts`

关键函数：
- `formatDuration(ms: number)` - 格式化时长
- `costCommand.execute()` - 主执行逻辑
