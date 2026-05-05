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
**Generated:** YYYY-MM-DD by @QA  
**Spec:** `[[reference/<module>/spec/<feature>]]`  
**Requirements:** `[[concepts/<module>/requirements/<feature>]]`  

---

## How this file works

This is a **living document**. Multiple parties update it over time:

- **@QA** (REQUIREMENTS phase) — creates this file from requirements + corner cases. All Status default to `PEND`.
- **@QA** (IMPLEMENTATION phase, DRAFT/FINAL) — appends impl-level TCs (unit-edge, integration, error). Append-only.
- **@TestRunner** — runs interactive walkthrough (mode `EXECUTE`), updates the table (Status, Notes), allocates DEF-ids in Defects log.
- **@BugFixer** — after a fix, updates Status `FAIL → PASS` and Defects log `OPEN → FIXED` for the row it fixed.
- **Manual tester** — writes the TC sections below the table (Pre-requirements, Steps, As is, To be). Can also edit Notes in the table to record bug root cause or remarks.

`/fix` reads this file, scans for `FAIL` and `PEND` rows, asks PO which to fix, dispatches @BugFixer per chosen TC, then dispatches @TestRunner (RERUN) to verify.

---

## Status legend

`PEND`  •  `PASS`  •  `FAIL`  •  `SKIP`

## Defect lifecycle

`OPEN` → `FIXED` → `VERF`

---

> Filled by @TestRunner (AI agent). Do not edit manually — except the **Notes** column, where the manual tester records bug root cause or remarks.

| ID    | Status | Notes | Type | Pre-requirements | To be |
|-------|--------|-------|------|------------------|-------|
| TC-01 | PEND   | —     |      |                  |       |

---

> Everything below is written by the manual tester.

---

## TC-00: Template

**Pre-requirements:**

* pre-requirement number 1

**Steps:**

1. step number 1

**As is:**
as is

**To be:**
what to be

---

## Defects log

> Append-only. Each row links back to a TC via the Notes column above. `/fix` and @BugFixer maintain this section automatically.

- **DEF-001** — [HIGH] *<one-line summary>*. TC-NN. Status: OPEN. Reported: YYYY-MM-DD by @TestRunner.
