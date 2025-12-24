# `/resume` Command - User Guide

## Quick Start

The `/resume` command helps you browse, search, and inspect your saved sessions.

## Basic Usage

### List All Sessions
```bash
/resume
```
Shows up to 20 most recent sessions with:
- Session number (for quick selection)
- Session ID (first 8 characters)
- Last modified time
- Message count
- Git branch (if available)
- Model type
- Summary/title
- Project path (if different from current)
- Token usage (if available)

**Example output:**
```
Recent Sessions
10 of 45 total

 1. a1b2c3d4  2h ago  15 msgs  (main)  🔷 sonnet
    Fix authentication bug in login form
    📁 ~/projects/webapp
    💬 12.5k tokens

 2. e5f6g7h8  1d ago  8 msgs  🔹 haiku
    Add user profile page

 3. i9j0k1l2  3d ago  23 msgs  (feature/api)  🔶 opus
    Implement REST API endpoints
    📁 ~/projects/api-server
    💬 45.2k tokens
```

## Search Sessions

### Search by Keyword
```bash
/resume typescript
/resume authentication
/resume bug fix
```

Searches across:
- Session summary/title
- Project path
- Git branch name
- Model name
- Tags

**Example:**
```bash
/resume typescript
```
```
Recent Sessions (filtered: "typescript")
3 of 45 total

 1. a1b2c3d4  2h ago  15 msgs  🔷 sonnet
    Fix TypeScript compilation errors
```

### Search by Branch
```bash
/resume main
/resume feature/auth
```

### Search by Model
```bash
/resume sonnet
/resume opus
/resume haiku
```

## View Session Details

### Select by Number
```bash
/resume 1
```
Shows the first session from the list.

### Select by ID
```bash
/resume a1b2c3d4
```
Shows the session matching this ID prefix.

**Detailed view includes:**
```
Session Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID: a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
Short ID: a1b2c3d4

Name: Fix authentication bug
Project: ~/projects/webapp
Branch: main
Model: claude-sonnet-4-5-20250929

Activity:
  Created: 12/24/2025, 10:30:00 AM
  Modified: 12/24/2025, 12:45:00 PM (2h ago)
  Messages: 15

Token Usage:
  Input: 8,234
  Output: 4,321
  Total: 12,555

First Message:
  I need help fixing the authentication bug in the login form.
  Users are getting logged out randomly...

Recent Messages:
  👤 Can you test the fix?
  🤖 I'll run the test suite now...
  🤖 All tests passed! The authentication bug is fixed.

To resume this session, restart Claude Code with:

  claude --resume a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6

Or use the short form:

  claude -r a1b2c3d4
```

## Actually Resuming a Session

**Important:** The `/resume` slash command only **shows** session information. To actually resume a session, you must restart Claude Code from the command line:

### Full Command
```bash
claude --resume a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
```

### Short Form (Recommended)
```bash
claude -r a1b2c3d4
```
You only need the first 8 characters of the session ID.

### Fork a Session
Create a new session ID while keeping the message history:
```bash
claude --resume a1b2c3d4 --fork-session
```

## Visual Indicators

### Model Types
- 🔷 **Sonnet** - Balanced performance (claude-sonnet-*)
- 🔶 **Opus** - Most capable (claude-opus-*)
- 🔹 **Haiku** - Fast and efficient (claude-haiku-*)

### Message Roles
- 👤 **User** - Your messages
- 🤖 **Assistant** - Claude's responses

### Other Icons
- 📁 Project path (different from current directory)
- 💬 Token usage statistics

## Tips & Tricks

### 1. Quick Session Selection
Instead of:
```bash
/resume
# Copy session ID from list
claude --resume <paste-id>
```

Do this:
```bash
/resume 1
# Note the short ID shown
claude -r <short-id>
```

### 2. Name Your Sessions
Use `/rename` to give sessions meaningful names:
```bash
/rename Fix auth bug
```
Then search by name:
```bash
/resume auth
```

### 3. Search Combinations
You can search by multiple terms:
```bash
/resume typescript main
```
This finds sessions with "typescript" OR "main" in their metadata.

### 4. Check Before Resume
Before resuming a session, preview it first:
```bash
/resume typescript    # Search
/resume 1             # View details
# Then resume from CLI
claude -r a1b2c3d4
```

### 5. Find Recent Work
Sessions are sorted by last modified time, so:
- `/resume` always shows your most recent work first
- Use `/resume 1` to quickly see your last session

## Common Workflows

### Resume Last Session
```bash
/resume
# Look at first session (#1)
/resume 1
# Note the ID and restart
claude -r <id>
```

### Find Specific Project Work
```bash
/resume ~/projects/webapp
# Or
/resume webapp
```

### Find Branch-Specific Sessions
```bash
/resume feature/auth
```

### Review Token Usage
```bash
/resume
# Sessions show token usage like "12.5k tokens"
# Use this to find expensive sessions
```

## Troubleshooting

### No Sessions Found
```
No previous sessions found.

Sessions are saved to: ~/.claude/sessions

Start a conversation and it will be automatically saved.
```
**Solution:** Have at least one conversation to create a session.

### Search Returns No Results
```
No sessions found matching: "keyword"

Use /resume to see all available sessions.
```
**Solutions:**
- Try a more general search term
- Check spelling
- Use `/resume` to see all sessions

### Can't Resume from Slash Command
The `/resume` slash command **cannot** load a session within the current conversation. You must:
1. Note the session ID
2. Exit current session
3. Run `claude --resume <id>` from terminal

## Session File Location

Sessions are stored in:
- **Linux/Mac:** `~/.claude/sessions/`
- **Windows:** `%USERPROFILE%\.claude\sessions\`

Each session is a JSON file named `<session-id>.json`.

## Advanced Features

### Session Metadata
Sessions can include:
- Custom names/titles
- Tags for categorization
- Token usage statistics
- Git branch information
- Model information
- Creation and modification timestamps

### Multi-Format Support
The command works with both:
- Old session format (from original implementation)
- New session format (from enhanced session manager)

Files are automatically parsed using the correct format.

## Keyboard Shortcuts

None currently, but you can:
- Use bash history (`↑`/`↓`) to recall `/resume` commands
- Use tab completion for paths (if terminal supports)

## Related Commands

- `/rename <name>` - Name the current session
- `/export` - Export session history
- `/context` - View context usage
- `/compact` - Compress conversation history

## FAQ

**Q: Why can't I resume a session from the slash command?**
A: Slash commands run within an existing session. To switch sessions, you must restart Claude Code from the command line.

**Q: How many sessions are saved?**
A: Up to 100 sessions, kept for 30 days.

**Q: Can I delete old sessions?**
A: Currently no built-in command. Manually delete files from `~/.claude/sessions/`.

**Q: What if a session file is corrupted?**
A: The command skips corrupted files and shows only valid sessions.

**Q: Can I export sessions?**
A: Yes, use `/export markdown` within a session, or use the session manager's export functions.

**Q: How do I transfer sessions between machines?**
A: Copy session files from `~/.claude/sessions/` to the same location on the new machine.

## Examples

### Example 1: Quick Resume Workflow
```bash
# In Claude Code session
/resume
# Output shows:
#  1. a1b2c3d4  2h ago  15 msgs  (main)
#     Fix authentication bug

# Exit and resume
exit
claude -r a1b2c3d4
```

### Example 2: Search and Detail
```bash
/resume typescript
# Output shows:
#  1. e5f6g7h8  1d ago  8 msgs
#     TypeScript compilation fix

/resume 1
# Shows full details

# Resume from CLI
claude -r e5f6g7h8
```

### Example 3: Branch-Specific Work
```bash
/resume feature/api
# Shows all sessions from that branch
/resume 2
# View second result details
```

## Version History

- **v2.0.76**: Enhanced `/resume` with search, number selection, and detailed previews
- Earlier: Basic session listing

## Support

For issues or feature requests, check the project documentation or open an issue on the repository.
