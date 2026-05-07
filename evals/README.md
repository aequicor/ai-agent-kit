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

## Tiers

Seed tasks are split into two tiers:

| Tier | Wall time | When to run | Tasks |
|---|---|---|---|
| **short-horizon** | 30 min – 3 h | every release | feature-001, feature-002, feature-003, bug-001, bug-002, tech-001 |
| **long-horizon** | 4 h – 16 h | every minor release (and any change that touches the orchestration loop) | feature-004, tech-002 |

The long-horizon tier was added in v5.1.0 to address the [SWE-EVO 2026](https://arxiv.org/html/2512.18470v1) finding that short-horizon evals saturate while long-horizon ones stay sensitive to architecture changes. See [`long-horizon-tier.md`](long-horizon-tier.md) for what makes a task long-horizon, the extra metrics to record, and the multi-session flow.

## Layout

```
evals/
├── README.md                # this file
├── metrics.md               # field-by-field recording template
├── long-horizon-tier.md     # rules for long-horizon tasks
├── seed-tasks/
│   ├── feature-001-add-rate-limit.md       # short-horizon
│   ├── feature-002-csv-export.md           # short-horizon
│   ├── feature-003-ui-toggle.md            # short-horizon
│   ├── feature-004-multi-module-data-export.md   # LONG-HORIZON
│   ├── bug-001-null-on-empty-input.md      # short-horizon
│   ├── bug-002-timezone-off-by-one.md      # short-horizon
│   ├── tech-001-extract-service.md         # short-horizon
│   └── tech-002-extract-shared-domain.md   # LONG-HORIZON
└── runs/                                   # one folder per release
    └── <version>/
        ├── SUMMARY.md
        └── <task-id>.md
```

`runs/` is gitignored placeholder content — copy `metrics.md` template into each task file when running.
