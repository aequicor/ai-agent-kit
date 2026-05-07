---
genre: reference
title: Test Cases Template (live document)
topic: testing
triggers:
  - "test cases"
  - "test execution"
  - "manual testing"
confidence: high
source: human
updated: {{ISO_TIMESTAMP_PLACEHOLDER}}
---

# Test cases — <feature>

**Module:** <module>
**Feature:** <feature-slug>
**Source:** [[features/<module>/<feature>/feature]] § Test plan

---

## How this file works

Live document owned by `@TestKeeper` end-to-end:

- `MODE=GENERATE` creates this file from `feature.md § Test plan`.
- `MODE=DRAFT` appends impl-level TCs (unit-edge, integration, error) once the implementation plan is written.
- `MODE=EXECUTE` runs the test suite after `@CodeWriter` and updates `Status` per TC.
- `MODE=RECONCILE` (after the last step) attaches `Test impl` references and reruns the full suite.
- `MODE=RERUN` re-verifies a specific TC after a fix or with PO walkthrough.
- `MODE=APPEND` adds a new TC row from a free-form bug report.

`@BugFixer` flips `Status` from FAIL→PASS and the Defects log entry from OPEN→FIXED after a fix.

The PO can edit the file directly — change a Status to FAIL, add a row, append a Note — and `/kit-fix` will pick it up via `MODE=SCAN`.

`Notes` is the only column AI agents do not auto-fill: it is reserved for human observations during manual testing.

---

## Status legend

`PEND` (not run) • `PASS` • `FAIL` • `SKIP`

## Defect lifecycle

`OPEN` → `FIXED` → `VERF`

---

| TC ID | Status | Type | Description | Verifies | Test impl | Notes |
|-------|--------|------|-------------|----------|-----------|-------|
| TC-1 | PEND | unit | <what to verify> | AC-1, EC-1 | (pending) | |
| TC-2 | PEND | integration | ... | AC-2 | (pending) | |

**Type:** `unit` | `unit-edge` | `integration` | `error` | `e2e` | `manual`.
**Verifies:** comma-separated AC/EC ids from `feature.md`.
**Test impl:** filled by `@TestKeeper RECONCILE` — `tests/path/to/file.kt:line`.

---

## Defects log

> Append-only. Each entry references a TC by id.

- **DEF-1** — [HIGH] *<one-line summary>* — TC-NN — Status: OPEN — Opened: YYYY-MM-DD by @TestKeeper
