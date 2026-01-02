---
name: review-pr
description: Review a GitHub Pull Request. Use this skill when the user wants to review code changes in a PR, provide feedback, or understand what changed.
allowed-tools: Bash, Read, Grep, Glob
argument-hint: PR number or URL (e.g., "123" or "owner/repo#123")
---

# Pull Request Review

You are helping the user review a GitHub Pull Request.

## How to Review

### Step 1: Get PR Information
```bash
# Get PR details
gh pr view <PR_NUMBER>

# Get PR diff
gh pr diff <PR_NUMBER>

# List changed files
gh pr view <PR_NUMBER> --json files -q '.files[].path'

# Get PR comments
gh pr view <PR_NUMBER> --comments
```

### Step 2: Analyze Changes

For each changed file:
1. **Understand the context** - What does this file do?
2. **Review the diff** - What changed and why?
3. **Check for issues** - Bugs, security, performance
4. **Verify tests** - Are changes properly tested?
5. **Check style** - Does it follow project conventions?

### Step 3: Provide Feedback

Structure your review as:

#### Summary
Brief overview of what the PR does

#### Changes Reviewed
- List of files reviewed
- Key changes in each

#### Feedback
##### Critical Issues (must fix)
- Security vulnerabilities
- Breaking changes
- Logic errors

##### Suggestions (should consider)
- Performance improvements
- Better approaches
- Missing edge cases

##### Minor/Nitpicks (optional)
- Style preferences
- Documentation improvements

#### Testing Recommendations
- What should be tested
- Edge cases to verify

#### Approval Status
- ✅ Approve
- 🔄 Request Changes
- 💬 Comment Only

## Review Checklist

### Code Quality
- [ ] Code is readable and well-organized
- [ ] No unnecessary complexity
- [ ] Follows project coding standards
- [ ] No duplicate code

### Functionality
- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Error handling is appropriate
- [ ] No breaking changes to public APIs

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL injection or XSS vulnerabilities
- [ ] Proper authentication/authorization

### Testing
- [ ] Tests cover new functionality
- [ ] Tests are meaningful (not just coverage)
- [ ] Edge cases tested
- [ ] Existing tests still pass

### Documentation
- [ ] Code comments where needed
- [ ] README updated if applicable
- [ ] API documentation updated

## User Guidance

Provide the PR number or URL you want to review. I will:
1. Fetch the PR details and diff
2. Analyze all changed files
3. Provide comprehensive feedback
4. Suggest improvements if needed
