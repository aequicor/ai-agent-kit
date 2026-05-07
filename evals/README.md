# Eval suite for ai-agent-kit

Reproducible benchmark of kit performance per release. Without it, "is the new version better?" is unanswerable.

## What it measures

Each release is run against a fixed set of seed tasks (see `seed-tasks/`). Per task we capture:

- **Turns** — total agent turns from intake to CLOSE.
- **Token cost** — sum of input + output tokens over the whole task (provider-reported).
- **Wall time** — minutes from intake to CLOSE.
- **Artifacts produced** — count of files created or modified under `vault/` (or whatever `vault_path` resolves to).
- **DoD verdict** — PASS / BLOCK / waived.
- **Post-CLOSE bug rate** — bugs found by reviewer or PO within 24 h after CLOSE that should have been caught earlier.
- **PO interventions** — number of clarifying questions, plan rejections, or waivers required.

See `metrics.md` for the exact fields and how to record them.

## How to run

The eval suite is **manual** — there is no automation harness, by design. The kit is a configuration of agents inside OpenCode / Claude Code, and the goal is to measure end-to-end behaviour as a real user experiences it.

For each release candidate:

1. Spin up a fresh empty repo.
2. Install the kit at the candidate version (`docs/prompts/setup.md`).
3. For each seed task in `seed-tasks/`:
   - Paste the task prompt verbatim into a fresh chat.
   - Let the agent work autonomously (no extra hints).
   - Stop when @Main reaches CLOSE or escalates.
   - Record metrics in `runs/<version>/<task-id>.md` using the template in `metrics.md`.
4. Append a one-line summary per task to `runs/<version>/SUMMARY.md`.
5. Compare against the previous baseline (`runs/<previous>/SUMMARY.md`).

## Pass criteria for a release

A release should not regress on any of:

- Median **turns** by > 5 %.
- Median **tokens** by > 5 %.
- **DoD PASS rate** below previous version.
- **Post-CLOSE bug rate** above previous version.

A regression on any axis means the release goes back for revision; it does not block the merge if there is a documented reason.

## Layout

```
evals/
├── README.md           # this file
├── metrics.md          # field-by-field recording template
├── seed-tasks/         # five canonical tasks (3 FEATURE / 2 BUG / 1 TECH)
│   ├── feature-001-add-rate-limit.md
│   ├── feature-002-csv-export.md
│   ├── feature-003-ui-toggle.md
│   ├── bug-001-null-on-empty-input.md
│   ├── bug-002-timezone-off-by-one.md
│   └── tech-001-extract-service.md
└── runs/               # one folder per release
    └── <version>/
        ├── SUMMARY.md
        └── <task-id>.md
```

`runs/` is gitignored placeholder content — copy `metrics.md` template into each task file when running.
