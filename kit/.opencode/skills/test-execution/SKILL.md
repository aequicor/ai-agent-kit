---
name: test-execution
description: AI-driven test execution and defect management. Generates test cases from spec/requirements, provides a structured template for manual testing with defect logging, and supports transactional updates — including re-running after fixes and adding new test cases when new defects reveal additional edge cases. Use ONLY when @Main requests test execution or manual test case walkthrough.
---

# Test Execution Skill

Skill for generating, executing, and iteratively managing test cases with defect tracking. Designed for a **transactional workflow**: each modification to the test cases document is an atomic operation recorded in the transaction log.

## When to use

- @Main dispatches test execution after implementation is complete (QA FINAL phase)
- PO requests manual test case walkthrough
- Defects are found during testing and need structured logging
- Fixes are applied and test cases need re-execution/rerun

## Step 0 — INTAKE

Parse the feature name, module, and mode passed from @Main:

```
Feature: [short identifier, snake_case]
Module: [must match a module name from the project manifest]
Mode: GENERATE | EXECUTE | RERUN | AMEND
```

Validation rules:
- Feature name empty or not snake_case → ask PO to clarify.
- Module not found in manifest → list available modules, ask PO to pick one.
- Mode not recognized → default to GENERATE.

---

## Step 1 — GENERATE (initial test case creation)

### 1.1 Read source artifacts

Read the following files in order:
1. `.vault/reference/[module]/spec/[feature].md` — technical spec
2. `.vault/concepts/[module]/requirements/[feature].md` — business requirements
3. `.vault/concepts/[module]/plans/[feature]-corner-cases.md` — corner case register (if exists)
4. `.vault/reference/[module]/spec/[feature]-test-plan.md` — test plan (if exists)

If spec file is missing → report to @Main and STOP.

### 1.2 THINK — before generating, reason briefly:

```
1. What are the highest-risk scenarios from the spec?
2. Which corner cases from the register must become test cases?
3. Are there happy paths, edge cases, and error paths for every requirement?
4. What environments/dependencies affect testability?
```

Record 2-3 key conclusions. Do NOT skip this step.

### 1.3 Generate test cases

For each requirement and acceptance criterion from the spec/requirements:
- Create **at least one happy path** test case
- Create **at least one error path** test case per error scenario
- Create **edge cases** from the corner case register (Critical and High items MUST have test cases)
- Create **manual scenarios** for UI/user-facing features

Each test case follows the template format:

```
### TC-NNN: [Short descriptive name]

| Field | Value |
|-------|-------|
| **ID** | TC-NNN |
| **Priority** | HIGH / MEDIUM / LOW |
| **Type** | Happy path / Edge case / Error / Security / Performance |
| **Preconditions** | List of preconditions |
| **Steps** | 1. Step one<br>2. Step two<br>3. Step three |
| **Expected Result** | What should happen |
| **Actual Result** | [FILLED DURING EXECUTION] |
| **Status** | ⬜ Not Run |
| **Defect** | — |
| **Notes** | — |
```

### 1.4 Write the document

Write to `.vault/reference/[module]/test-cases/[feature]-test-cases.md` following the template from `.vault/_templates/test-cases.md`.

Set Status to **Draft**.

### 1.5 Create transaction log entry

```
| 1 | [timestamp] | CREATE | @TestRunner | Initial test cases generated from spec and requirements |
```

### 1.6 Index

Call `knowledge-my-app_write_guideline` for the new test cases file.

### 1.7 Return

```
Test cases generated: .vault/reference/[module]/test-cases/[feature]-test-cases.md
Total test cases: N
  - Happy path: N
  - Edge case: N
  - Error: N
  - Manual scenario: N
Priority breakdown: HIGH: N, MEDIUM: N, LOW: N
```

---

## Step 2 — EXECUTE (manual or guided test walkthrough)

This step is designed for **interactive execution** where the PO (human) walks through test cases and the AI records results.

### 2.1 Read the test cases file

Read `.vault/reference/[module]/test-cases/[feature]-test-cases.md`.

### 2.2 Present test cases to PO

Present test cases one by one (or in groups by priority). For each test case:

```
TC-NNN: [name] (Priority: HIGH)
Preconditions: ...
Steps:
  1. ...
  2. ...
Expected: ...

Please enter result:
  ✅ Pass — actual result matches expected
  ❌ Fail — describe what went wrong
  ⏭️ Blocked — describe what blocks execution
  ⚠️ Partial — describe what partially works
  ⏭️ Skip — with reason
```

### 2.3 Record results

For each test case result, update the file:

- **✅ Pass:** Set Status to ✅ Pass, fill Actual Result.
- **❌ Fail:** Set Status to ❌ Fail, fill Actual Result, add a new DEF-NNN to Defects Log, link it from the TC's Defect field.
- **⏭️ Blocked:** Set Status to ⏭️ Blocked, add a new DEF-NNN if the blocker is a defect.
- **⚠️ Partial:** Set Status to ⚠️ Partial, fill Actual Result, add notes.
- **Skip:** Set Status to ⬜ Not Run, add note "Skipped: [reason]".

### 2.4 Defect creation protocol

When a defect is found, create a new entry in the Defects Log section:

```
### DEF-NNN: [Short defect title]

| Field | Value |
|-------|-------|
| **ID** | DEF-NNN |
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Related TC** | TC-NNN |
| **Description** | Clear description of what went wrong |
| **Steps to Reproduce** | 1. ...<br>2. ... |
| **Expected Behavior** | What should happen |
| **Actual Behavior** | What actually happened |
| **Fix Status** | 🔴 Open |
| **Fixed By** | — |
| **Fix Commit** | — |
| **Verification TC** | — |
| **Notes** | — |
```

### 2.5 Transaction log entry

After recording each result or batch of results:

```
| N | [timestamp] | UPDATE | @TestRunner | TC-NNN: ⬜→✅ Pass |
| N | [timestamp] | DEFECT_ADD | @TestRunner | DEF-NNN added — TC-NNN: ⬜→❌ Fail |
```

### 2.6 Handle mid-execution changes

If during execution the PO discovers a new edge case or scenario that is NOT covered by existing test cases:

1. **Add a new test case** (TC_ADD transaction):
   - Create a new TC-NNN with sequential numbering
   - Set status to ⬜ Not Run
   - Immediately walk the PO through it
   - Add transaction log entry: `| N | timestamp | TC_ADD | [author] | TC-NNN: New test case for [reason] |`

2. **If a defect reveals an untested scenario:**
   - Add TC for the newly discovered scenario
   - Link it to the existing DEF-NNN
   - Add both TC_ADD and UPDATE transactions

---

## Step 3 — RERUN (re-execute after fixes)

After defects are fixed (by @BugFixer or @CodeWriter), re-execute relevant test cases.

### 3.1 Identify test cases for rerun

Read the test cases file. Identify:
- All test cases with status ❌ Fail or ⏭️ Blocked
- All test cases linked to defects that are now 🟢 Fixed

### 3.2 Re-present test cases

For each identified test case:
- Present to PO for re-verification
- Update Actual Result
- Update Status

### 3.3 Update defect verification

For each defect that is being verified:
- Update Fix Status from 🟡 In Progress to 🟢 Fixed (if fix confirmed) or keep 🔴 Open (if still failing)
- Fill Fixed By, Fix Commit, and Verification TC fields

### 3.4 Update Execution Summary

Recalculate all counts and pass rate.

### 3.5 Transaction log entry

```
| N | [timestamp] | RERUN | @TestRunner | Rerun after DEF-001 fixed — TC-003: ❌→✅ |
```

### 3.6 Check resolution

After rerun:
- **All defects resolved** → update file Status to **Completed**, notify @Main.
- **Open defects remain** → notify @Main with remaining defect list.

---

## Step 4 — AMEND (modify existing test cases)

When requirements change or PO requests modification:

### 4.1 Identify what changes

Read the updated spec/requirements and compare with existing test cases.

### 4.2 Amend test cases

- **Update steps/expected results** → AMEND transaction
- **Add new test cases** → TC_ADD transaction
- **Remove obsolete test cases** → TC_REMOVE transaction (mark as removed, don't delete — keep for audit)
- **Change priority** → AMEND transaction

### 4.3 Transaction log entries

```
| N | [timestamp] | AMEND | @TestRunner | TC-NNN: Steps updated per requirement change |
| N | [timestamp] | TC_ADD | @TestRunner | TC-NNN: Added for new requirement X |
| N | [timestamp] | TC_REMOVE | @TestRunner | TC-NNN: Removed — requirement Y deprecated |
```

---

## Anti-Loop Rules

| Symptom | Action |
|---------|--------|
| Spec file not found after creation | STOP. Report to @Main. Likely a previous step failed. |
| Same TC status updated twice in one run | Use the LATEST status. Log both updates in transaction log. |
| More than 20 test cases for a single feature | Split into groups by priority. Execute HIGH first, then MEDIUM, then LOW. |
| Defect count exceeds TC count | WARNING: likely a systemic issue. Log and surface to @Main. |

**Max 3 RERUN cycles** per defect — if the same defect fails 3 times after alleged fixes, STOP and escalate to @Main.

---

## Severity Classification for Defects

| Severity | Criteria | Example |
|----------|----------|---------|
| CRITICAL | System crash, data loss, security breach | Application crashes on login |
| HIGH | Core functionality broken, no workaround | Payment processing returns wrong amount |
| MEDIUM | Feature partially broken, workaround exists | Search returns incomplete results |
| LOW | Cosmetic, minor inconvenience | Misaligned button text |

---

## Transaction Model — CRITICAL

The test cases document uses an **append-only transaction log**. Key rules:

1. **Atomicity:** Each transaction represents exactly one meaningful change. A batch of results counts as one transaction if applied together.
2. **Immutability:** Never delete or overwrite a transaction log entry. Append only.
3. **Sequential numbering:** Transaction # increments monotonically. No gaps.
4. **Traceability:** Every TC status change, defect addition, and defect fix update has a corresponding transaction log entry.
5. **Defect lifecycle:** 🔴 Open → 🟡 In Progress → 🟢 Fixed → verification TC passes → done. If verification fails, defect goes back to 🔴 Open.
6. **TC lifecycle:** ⬜ Not Run → ✅ Pass / ❌ Fail / ⏭️ Blocked / ⚠️ Partial. If ❌ Fail, the TC can only go to ✅ Pass after a RERUN transaction that verifies the fix.

---

## RAG Pagination

When calling `knowledge-my-app_search_docs`:
- Read at most **3 documents** per query.
- For each document, read at most **500 lines** (use offset/limit).
- If a document exceeds 500 lines, read the relevant section first, then expand only if needed.
- Never dump the entire vault into context.

---

## What NOT to do

- **DO NOT delete** test cases or defects — use TC_REMOVE transaction with explanation.
- **DO NOT overwrite** transaction log entries — append only.
- **DO NOT skip** the transaction log — every change MUST be recorded.
- **DO NOT run** automated tests — this skill is for structured manual test case management.
- **DO NOT invent** test cases not derived from spec/requirements/corner cases. Every test case must trace to a source.
- **DO NOT modify** Spec or Requirements files — those are approved artifacts.
- **DO NOT output** system tags or environment artifacts.
- **DO NOT add conversational filler** — no "Sure!", "Of course", "Here is...". Output ONLY structured results.