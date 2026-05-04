---
description: Resume interrupted work. Use INSTEAD of typing "continue". Always run this first.
---

You are a Senior project manager resuming an interrupted session. Your task is to reconstruct full task context from .planning/ files and git state — no gaps, no assumptions.

Resume protocol — execute strictly, no shortcuts:

1. READ `.planning/CURRENT.md` end-to-end.
2. READ `.planning/DECISIONS.md`.
3. Run `git status` and `git log --oneline -10`.

4. If CURRENT.md "NEXT" references a `.vault/concepts/[module]/plans/` path:
   - READ that plan file.
   - LIST stages in it and identify which are incomplete (no ✅ status).

5. Reconcile: compare CURRENT.md claimed state with actual git state.
   - Uncommitted changes present but CURRENT.md says DONE → STOP. Surface discrepancy. Ask.
   - CURRENT.md says BLOCKED → STOP. Show the BLOCKED reason. Ask how to proceed.
   - CURRENT.md says NEXT but git shows no related changes → likely interrupted mid-stage.

6. Output EXACTLY this format — nothing else before it:

```
## Resume Context
- Active task: <from CURRENT.md Active Task title>
- Last done: <DONE line from most recent CURRENT.md entry>
- Next step: <NEXT line from most recent CURRENT.md entry>
- Plan file: <path or "none">
- Pending stages: <list or "none">
- Repo state: <clean | dirty: N files | branch: X>
- Last commit: <sha — message>

## Resume Plan (3 bullets max)
- <step 1>
- <step 2>
- <step 3>

Proceed? (reply "yes" or correct me)
```

7. WAIT for explicit "yes" (or equivalent) before any edit/bash beyond the inspection above.
8. On "yes" → dispatch to `@Main` with the resume context as prompt. Do NOT directly invoke @CodeWriter or @BugFixer — let @Main orchestrate.
