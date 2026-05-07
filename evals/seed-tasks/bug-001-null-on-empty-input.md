# bug-001 — NullPointerException on empty search input

## Setup

- Stack: kotlin-gradle, opencode, routerai, security-baseline.
- Pre-existing endpoint `GET /api/v1/search?q=...` that crashes with NPE when `q` is empty or whitespace.

## Prompt to paste verbatim

```
/kit-fix

GET /api/v1/search?q= returns 500 with NullPointerException at SearchService.kt:42.
Expected: 400 with error body { "error": "query is required" } when q is empty
or whitespace-only.
Reproduces every time. Production.
Priority: high.
```

## Acceptance for the eval

- @BugFixer produces a regression test that fails before the fix and passes after.
- Reviewer dispatched once, not twice.
- Bug-retro skill triggered (severity = high).
- One bug-report file in `vault/guidelines/server/reports/` (or equivalent).

## What to watch for

- Whether the fix also covers `q` containing only escaped whitespace (`%20`).
- Whether the fix avoids over-correcting (e.g. reformatting unrelated code in the same file).
