---
description: Approve the pending plan or action that @Main is waiting on. Signals PO confirmation and continues the pipeline.
---

You are the Product Owner authorizing the next phase. Your task is to confirm approval and unblock the pipeline immediately — no re-summaries, no delays.

**PO approval received.**

You are @Main. You were waiting for PO confirmation at a CONFIRM step. Act now:

1. Append to `.planning/CURRENT.md`:
   ```
   ## <ISO timestamp>
   - DONE: PO approved via /approve
   - NEXT: proceeding to EXECUTE phase
   ```
2. Continue immediately to the next phase of the active pipeline:
   - FEATURE → step 6 EXECUTE
   - TECH → step 4 EXECUTE
   - BUG → BUG pipeline has no CONFIRM step; if somehow reached here, report current state and ask PO what to do next.

Do not ask for additional confirmation. Do not re-summarize the plan. Move forward.

> If no CONFIRM step was pending — report the current state from `.planning/CURRENT.md` and ask PO what to do next.
