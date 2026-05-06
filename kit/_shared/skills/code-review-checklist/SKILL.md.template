---
name: code-review-checklist
description: Pre-commit code review checklist filled by @CodeReviewer after each CodeWriter cycle. Use ONLY when reviewing code changes before commit — not for design reviews, not for requirements analysis.
---

# Code Review Checklist

@CodeReviewer fills this checklist after each @CodeWriter cycle. Walk through every item. Mark each `[ ]` as `[x]` when verified. If any item fails — describe the issue, reference the file:line, and return to @CodeWriter.

## Invocation

Called by @CodeReviewer automatically after each @CodeWriter stage completion. No manual trigger needed.

## Input

| Field | Required | Description |
|-------|----------|-------------|
| `stage_file` | Yes | Path to the stage file @CodeWriter implemented |
| `files_changed` | Yes | List of changed files (diff summary) |
| `corner_cases` | No | Path to corner case register (if available) |

## Functionality

- [ ] All acceptance criteria from the spec are addressed
- [ ] Edge cases are handled (null, empty, boundary values)
- [ ] Corner case register reviewed — every Critical item has a test
- [ ] Corner case register reviewed — every High item has an explicit decision (test or defer)
- [ ] Error states are handled with appropriate messages
- [ ] No regressions — existing functionality continues to work

## Code Quality

- [ ] Functions are small and single-purpose
- [ ] No magic numbers — use named constants
- [ ] Meaningful variable and function names
- [ ] No dead code, commented-out blocks, or unused imports
- [ ] Consistent formatting (auto-formatter applied)
- [ ] No patterns from forbidden list: `{{FORBIDDEN_PATTERNS_LIST}}`

## Stub & Deferral Check (CRITICAL — blocking)

Regex scan over every changeset file: `TODO|FIXME|XXX|HACK|stage [0-9]|later|TBD`.

- [ ] No unpaired `TODO`, `FIXME`, `XXX`, `HACK`, "stage N", "later", or "TBD" in production code added/modified by this stage
- [ ] Every such marker (if any) is paired with a `.planning/DECISIONS.md` reference, an external tracker ID (`#123`, `JIRA-456`, `TC-NN`), or an explicit deferral entry already in the stage file
- [ ] No method body for an AC the stage was supposed to deliver is comment-only (`{ // TODO: implement… }`)
- [ ] No method body is silently noop (`fun foo() { /* ... */ }`) where the spec required behavior

Any unchecked box → CRITICAL issue, return to @CodeWriter (or escalate to @Main as BLOCKED). This rule fires on **in-changeset hits only** — pre-existing markers in untouched files belong to tech-debt, not the review.

## Architecture

- [ ] No circular dependencies between modules
- [ ] Correct layering: domain → service → controller/presentation
- [ ] Dependency injection used where appropriate
- [ ] Interfaces defined at module boundaries

## Testing

- [ ] Unit tests cover happy path + error cases
- [ ] Integration tests cover API contracts
- [ ] Tests are deterministic (no Thread.sleep, real network calls)
- [ ] All tests pass: `{{TEST_COMMAND_TEMPLATE}}`

## Security

- [ ] Input validation on all external inputs
- [ ] SQL via parameterized queries only
- [ ] No tokens, passwords, or PII in logs
- [ ] Authentication/authorization checks not weakened
- [ ] No sensitive data in error responses

## Performance

- [ ] No N+1 queries in loops
- [ ] Appropriate caching strategy
- [ ] Resources closed properly (connections, files, streams)
- [ ] No blocking calls on UI/main threads

## Documentation

- [ ] Public API documented
- [ ] Complex logic has inline comments explaining WHY, not WHAT
- [ ] Spec/requirements match implementation
- [ ] Any new guidelines saved to `{{VAULT_PATH}}/guidelines/[module]/`

## Output

Return a verdict:

```
VERDICT: [PASS | CRITICAL | HIGH | MEDIUM]
FILES_REVIEWED: [list]
ISSUES:
- [severity] [file:line] [description] → [fix suggestion]

CHANGES_SUMMARY: [1-2 sentences]
```

**PASS** → proceed to next stage.  
**CRITICAL/HIGH** → return to @CodeWriter with issues.  
**MEDIUM** → document and proceed (fix later).

## Error Handling

- If stage file is missing or empty → report `VERDICT: CRITICAL — stage file not found at [path]`. Do not proceed.
- If diff is empty (no code changes) → report `VERDICT: CRITICAL — @CodeWriter produced no changes for [stage]`. Do not proceed.
- If corner case register references a Critical item with no corresponding test → flag as HIGH issue, do not auto-approve.