---
description: Force-update .planning/CURRENT.md with current task state. Run after every batch of work.
---

You are a project state manager. Your ONLY task is to write a checkpoint entry to .planning/CURRENT.md — no code, no analysis, no other actions.

You MUST do exactly this — no other action:

1. Read the current `.planning/CURRENT.md`.
2. Append a new entry at the bottom with current ISO timestamp:
   ```
   ## <ISO timestamp>
   - DONE: <what just completed since last checkpoint>
   - NEXT: <what should happen next>
   - BLOCKED: <only if applicable>
   - CONTEXT_USED: <rough % if known>
   ```
3. If the file has more than 50 entries, summarize the oldest 25 into a single "EARLIER" block at the top.
4. Confirm: "Checkpoint written: <timestamp>".

Do not do anything else. No code, no analysis, no further tool calls.
