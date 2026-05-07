# Per-run recording template

Copy this into `runs/<version>/<task-id>.md` for every eval run.

```markdown
---
task_id: <feature-001 | bug-001 | ...>
kit_version: <X.Y.Z>
host: <opencode | claude-code>
provider: <routerai | ollama-cloud | claude-code-native>
date: <YYYY-MM-DD>
operator: <name or anonymous>
---

## Inputs

- Seed prompt: <copy verbatim>
- Manifest: <relative path or short summary of profiles used>

## Counters

| Metric | Value |
|---|---|
| Turns (@Main + subagents) | |
| Total tokens (input + output) | |
| Wall time (minutes) | |
| Artifacts created (count of new files under vault_path) | |
| Artifacts modified (count of edits to existing files under vault_path) | |
| Total artifact size (KB) | |
| PO clarifying questions answered | |
| PO plan revisions requested | |
| PO waivers issued | |

## Verdicts

| Gate | Verdict |
|---|---|
| @DoDGate | PASS / BLOCK / WAIVED |
| Final tests | ALL_GREEN / PARTIAL / NONE |
| Post-CLOSE bugs (24 h window) | <count> |

## Notes

- Anything surprising — agent loops, escalations, places where PO had to step in.
- Whether the artifact set was readable end-to-end (subjective: yes / partially / no).
- One-line summary of what went well and what went badly.
```

## Aggregation

`runs/<version>/SUMMARY.md` collates one row per task:

```markdown
| Task | Turns | Tokens | Wall (min) | Artifacts | DoD | PostBugs |
|---|---|---|---|---|---|---|
| feature-001 | 32 | 480k | 41 | 7 | PASS | 0 |
| feature-002 | ... |
```

Plus a final row with medians.
