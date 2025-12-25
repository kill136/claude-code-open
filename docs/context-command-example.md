# /context Command - Enhanced Output Example

## Example Output (10 messages, ~2% usage)

```
Context Usage:
  [░░░░░░░░░░░░░░░░░░░░] 2%

  Used:      8,000 tokens
  Available: 192,000 tokens
  Total:     200,000 tokens

  Messages: 10 (3 summarized)
  Compression: 83%

Token Breakdown:
  System prompt:  3,000 tokens (1.5%)
  Messages:       5,000 tokens (2.5%)
  Free space:     192,000 tokens (96.0%)

Model: claude-sonnet-4.5
Context Window: 200k tokens

✓ Plenty of context space available.

Session Info:
  Duration: 5m 23s
  Cost: $0.0012

Model Usage:
  claude-sonnet-4.5: 8,000 tokens
```

## Example Output (50 messages, ~42% usage)

```
Context Usage:
  [████████░░░░░░░░░░░░] 42%

  Used:      84,000 tokens
  Available: 116,000 tokens
  Total:     200,000 tokens

  Messages: 50 (15 summarized)
  Compression: 70%

Token Breakdown:
  System prompt:  3,000 tokens (1.5%)
  Messages:       81,000 tokens (40.5%)
  Free space:     116,000 tokens (58.0%)

Model: claude-sonnet-4.5
Context Window: 200k tokens

ℹ️  Context is 42.0% full.
   You can use /compact when context gets too large.

Session Info:
  Duration: 25m 15s
  Cost: $0.0245

Model Usage:
  claude-sonnet-4.5: 84,000 tokens
```

## Example Output (200 messages, ~85% usage)

```
Context Usage:
  [█████████████████░░░] 85%

  Used:      170,000 tokens
  Available: 30,000 tokens
  Total:     200,000 tokens

  Messages: 200 (60 summarized)
  Compression: 73%

Token Breakdown:
  System prompt:  3,000 tokens (1.5%)
  Messages:       167,000 tokens (83.5%)
  Free space:     30,000 tokens (15.0%)

Model: claude-sonnet-4.5
Context Window: 200k tokens

⚠️  Context is nearly full (85.0%).
   Consider using /compact to free up space.

What /compact does:
  • Generates AI summary of conversation
  • Preserves important context and files
  • Clears old messages from context
  • Frees up ~116k tokens

Session Info:
  Duration: 2h 15m 45s
  Cost: $0.1234

Model Usage:
  claude-sonnet-4.5: 170,000 tokens
```

## Key Features

1. **Visual Progress Bar**: 20-character bar with filled (█) and empty (░) blocks
2. **Token Statistics**: Clear breakdown of used, available, and total tokens
3. **Summarization Info**: Shows how many messages have been summarized
4. **Compression Ratio**: Indicates how much space was saved through compression
5. **Token Breakdown**: Detailed view of where tokens are being used
6. **Model Info**: Shows the active model and its context window size
7. **Smart Suggestions**: Context-aware recommendations based on usage level
8. **Session Metrics**: Duration and cost tracking
9. **Model Usage**: Per-model token consumption statistics

## Command Aliases

- `/context` - Full command
- `/ctx` - Short alias

## Related Commands

- `/compact` - Compress conversation history to free up space
- `/cost` - View detailed cost breakdown
- `/stats` - View session statistics
