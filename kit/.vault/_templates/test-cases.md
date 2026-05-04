---
genre: reference
title: Test Cases Template (living document)
topic: testing
triggers:
  - "test cases"
  - "test execution"
  - "manual testing"
  - "test run"
confidence: high
source: human
updated: {{ISO_TIMESTAMP_PLACEHOLDER}}
---

# Test Cases: [Feature Name]

**Module:** [module-name]
**Feature:** [feature-slug]
**Generated:** YYYY-MM-DD by @QA (Phase=REQUIREMENTS)
**Last updated:** YYYY-MM-DD
**Source:** requirements + corner-case register + spec
**Spec:** `[[reference/<module>/spec/<feature>]]`
**Requirements:** `[[concepts/<module>/requirements/<feature>]]`
**Corner cases register:** `[[concepts/<module>/plans/<feature>-corner-cases]]`

---

## How this file works

This is a **living document**. Multiple parties update it over time:

- **@QA** (REQUIREMENTS phase) — creates this file from requirements + corner cases. All Status default to `⏸ Pending`.
- **@QA** (IMPLEMENTATION phase, DRAFT/FINAL) — appends impl-level TCs (unit-edge, integration, error). Append-only.
- **@TestRunner** — runs interactive walkthrough (mode `EXECUTE`), updates Status, allocates DEF-ids in Defects log.
- **@BugFixer** — after a fix, updates Status `❌ → ✅` and Defects log `🔴 → 🟢` for the row it fixed.
- **PO (you)** — can edit any cell directly. Mark Status, add Notes, append a new TC row when a new bug or scenario is discovered. `/fix` will pick up your edits automatically.

`/fix` reads this file, scans for ❌ Fail and ⏸ Pending rows, asks PO which to fix, dispatches @BugFixer per chosen TC, then dispatches @TestRunner (RERUN) to verify.

---

## Status legend

`⏸ Pending`  •  `✅ Pass`  •  `❌ Fail`  •  `⏭️ Blocked`  •  `⚠️ Partial`

## Defect lifecycle

`🔴 Open` → `🟡 In Progress` → `🟢 Fixed` → `✅ Verified`

---

## Environment

| Parameter | Value |
|-----------|-------|
| Environment | [dev / staging / prod] |
| Version / Build | [commit hash or version] |
| Tester | [PO name or "automated"] |

---

## Test cases

| ID    | Pri  | Type        | Source     | Preconditions | Steps                          | Expected            | Status | Notes | Bug Ref |
|-------|------|-------------|------------|---------------|--------------------------------|---------------------|--------|-------|---------|
| TC-01 | HIGH | happy path  | US-1       | logged in     | 1. open /home  2. click Sign-in | dashboard renders  | ⏸     |       |         |
| TC-02 | HIGH | corner case | CC-3 Crit  | n/a           | 1. POST /login {email:"a+b@x"}  | 200, valid session  | ⏸     |       |         |
| TC-03 | MED  | acceptance  | AC-2       | seeded DB     | 1. ...                         | ...                 | ⏸     |       |         |

> **Type values:** `happy path | acceptance | corner case | error | security | performance | unit-edge | integration | manual`
>
> **Source values (REQUIREMENTS phase):** `US-N` (user story), `AC-N` (acceptance criterion), `CC-N <Severity>` (corner case row).
> **Source values (IMPLEMENTATION phase):** `spec`. **Source values (PO-added):** `PO-added`. **Source values (bug-fix added):** `bug-fix`.

---

## Defects log

> Append-only. Each row links back to a TC via the `Bug Ref` column above. `/fix` and @BugFixer maintain this section automatically.

- **DEF-001** — [HIGH] *<one-line summary>*. TC-02. Status: 🔴 Open. Reported: YYYY-MM-DD by @TestRunner.
- **DEF-002** — [MED] *<summary>*. TC-05. Status: 🟢 Fixed. Fixed by @BugFixer in commit `abc1234`. Verification pending.

---

## Coverage summary (optional, auto-computed by @TestRunner SCAN)

| Metric | Value |
|--------|-------|
| Total TCs | 0 |
| Pending (⏸) | 0 |
| Pass (✅) | 0 |
| Fail (❌) | 0 |
| Blocked (⏭️) | 0 |
| Partial (⚠️) | 0 |
| Pass rate | 0% |
| Defects open | 0 |
| Defects verified | 0 |
