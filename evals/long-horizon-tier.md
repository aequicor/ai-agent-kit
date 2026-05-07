# Long-horizon eval tier

> Added in v5.1.0. Required reading before running tasks marked `tier: long-horizon`.

## Why a separate tier

The 2026 frontier-model picture (per [SWE-EVO](https://arxiv.org/html/2512.18470v1) and [SWE-bench Pro](https://www.codeant.ai/blogs/swe-bench-scores)):

- Tasks ≤ 4 minutes of human effort: ~100 % success.
- Tasks ≥ 4 hours: < 25 % success even on best models.

Short-horizon evals saturate quickly. Long-horizon evals don't — they stay sensitive to architecture changes long after the short-horizon set has plateaued. **A kit that scores well on short tasks but degrades on long ones is shipping a regression that short-horizon eval can't see.**

## What makes a task long-horizon

A seed task is `tier: long-horizon` if **any two** of the following are true:

1. Touches 3+ modules.
2. Plan needs ≥ 8 implementation steps.
3. Wall time > 4 hours from intake to CLOSE.
4. Existing tests must keep passing unmodified (high regression risk).
5. Reversibility is poor (DB migration, cross-module entity moves, schema rename).
6. Cannot reasonably be done in one sitting (one session) — needs `/kit-resume`.

## Extra dimensions to record

In addition to the standard fields in [`metrics.md`](metrics.md), every long-horizon run records:

| Metric | What it captures |
|---|---|
| **Sessions used** | Count of `/kit-resume` cycles. ≥ 2 expected. |
| **Replan events** | Number of times feature.md § Implementation plan was edited after CONFIRM. |
| **Steps executed vs planned** | Did the original plan hold up, or did the agent extend / collapse mid-flight? |
| **Cross-day continuity** | After /kit-resume, did the agent reconstruct context without re-asking clarifying questions? (yes/partial/no) |
| **Build-green checkpoint rate** | Of N steps, how many ended with build PASS? Must be 100 %. |
| **Edge cases discovered during EXECUTE** | Critical/High EC that were not in the original feature.md when CONFIRM was issued. |
| **Escalations** | Anti-loop trigger or DoD-fix cap exceeded count. |

## Pass criteria (in addition to standard 4 from README.md)

A long-horizon release passes if:

- **Cross-day continuity** is `yes` on every long-horizon run.
- **Build-green checkpoint rate** = 100 %.
- **Escalations** ≤ 1 per task.
- **Replan events** are documented in feature.md (no silent plan drift).

## How to run a multi-session long-horizon task

The reproducible flow:

```
session 1 (PO laptop, Tuesday morning):
  1. /kit-new-feature with the seed prompt.
  2. Let @Main run CLASSIFY → ANALYSIS → PLAN → CONFIRM → EXECUTE.
  3. After step 3 of N (or roughly 2 hours of wall time, whichever first):
       PO types: "stop after current step, will resume tomorrow"
       @Main writes checkpoint + reset CURRENT.md → archive task to tasks/ (still active, no done/).
  4. Close the chat.

session 2 (Wednesday):
  5. New chat. Type: /kit-resume <task-slug>
  6. @Main reads .planning/CURRENT.md → tasks/<slug>.md → feature.md → test-cases.md.
  7. Outputs Resume Context block (last DONE, NEXT, pending steps, repo state).
  8. PO types "yes" to confirm.
  9. @Main resumes from step N+1.

session 3 (Thursday): repeat /kit-resume until CLOSE.
```

If at any session the Resume Context block is incomplete (missing repo state, missing pending steps, or asks clarifying questions that PO already answered in session 1), record `cross-day continuity: partial` or `no` and note the specific gap.

## Adding a new long-horizon seed task

If you add `evals/seed-tasks/<task>.md` with `tier: long-horizon` in its frontmatter:

1. Use the structure of [`feature-004-multi-module-data-export.md`](seed-tasks/feature-004-multi-module-data-export.md) as the template.
2. Document **why** the task is long-horizon by completing the property table in the task file.
3. Add a row to `runs/<version>/SUMMARY.md` columns: `Sessions | Replans | BuildGreen% | Continuity | Escalations`.

## Current long-horizon tasks

| Task | Type | Modules | Expected wall time |
|---|---|---|---|
| [feature-004 — Multi-module data export pipeline](seed-tasks/feature-004-multi-module-data-export.md) | FEATURE | 3 | 4–12 h |
| [tech-002 — Extract shared domain module](seed-tasks/tech-002-extract-shared-domain.md) | TECH | 3 | 6–16 h |

This set is intentionally small. Long-horizon evals are expensive to run (each task is half a workday minimum). Two stable scenarios that exercise different failure modes (cross-cutting feature vs cross-module refactor) is a better starting point than ten that cover the same ground.
