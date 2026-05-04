---
description: Fix failing/pending test cases in the current feature's test-cases.md. Argument is optional — without it, scans and asks PO. With a TC-id, fixes that one. With free-form text, creates a new TC and fixes it.
---

You are @Main routing a bug-fix request through the BUG pipeline. Argument: $ISSUE (optional).

The single source of truth is the living test-cases file:
```
{{VAULT_PATH}}/reference/[module]/test-cases/[feature]-test-cases.md
```
PO marks Status ❌ for known bugs and may add new TC rows there at any time. `/fix` reads that file and acts on it. The BUG pipeline definition lives in @Main — this command is the entry point that figures out which TC(s) to feed it.

## Routing

1. **No argument** → SCAN mode:
   - Read `.planning/CURRENT.md` to find the current feature + module.
   - Dispatch `@TestRunner` (Mode=SCAN) on the test-cases file.
   - Show PO the list of ❌ Failing and ⏸ Pending TCs (highlight PO-added rows).
   - Ask PO: "Fix all failing? Pick TC-ids? Or none?"
   - For each chosen TC-id → enter BUG pipeline.

2. **Argument matches `TC-\d+`** → direct TC mode:
   - Read that row from the test-cases file.
   - Enter BUG pipeline at TRIAGE with the TC-id.

3. **Argument is free-form text** → APPEND-then-fix mode:
   - Dispatch `@TestRunner` (Mode=APPEND) with the text:
     - Type: error (default — adjust if PO's text clearly indicates another type)
     - Source: bug-fix
     - Initial Status: ❌ Fail
     - Steps + Expected: derive from PO's text (best-effort; ask if ambiguous)
   - Enter BUG pipeline at TRIAGE with the new TC-id.

## BUG pipeline (per TC-id, executed by @Main)

```
TRIAGE   — clear stacktrace / self-evident steps → DISPATCH directly.
           complex / needs reproduction → DEBUG first.

DEBUG    — task @debugger with TC Steps + Notes + environment. Output: BUG-NNN.md.

DISPATCH — task @BugFixer:
             TC: <TC-id>
             Test-cases file: <path>
             Bug Ref: <DEF-id or empty>
           @BugFixer: ANALYZE → REPRODUCE (failing test) → FIX → REGRESSION TEST →
             @CodeReviewer → BUILD → update test-cases.md (Status ❌→✅, Defects log 🔴→🟢)
             → commit → write report to {{VAULT_PATH}}/guidelines/<module>/reports/<bug-name>.md.

RE-VERIFY — task @TestRunner (Mode=RERUN) with the TC-id.
           PO confirms ✅ → DEF promoted 🟢 Fixed → ✅ Verified.
           PO confirms ❌ → Status reverts, retry counter incremented. Max 3 retries per DEF.

REPORT   — to PO: list of TCs fixed (❌→✅), defects closed (DEF-ids), links to reports.
```

## Stop rules

- **Max 2 fix attempts per same compile/test error** inside @BugFixer → STOP, escalate to PO with full error history.
- **Max 3 RERUN cycles per defect** → STOP, escalate to PO.
- **No CURRENT.md or no test-cases file**, and no argument given → STOP. Tell PO: "No active feature. Run `/new-feature` or `/requirements-pipeline` first, or pass a TC-id or description directly."

## Build verification commands (used by @BugFixer)

- Compile: `{{COMPILE_COMMAND}}`
- Lint:    `{{LINT_COMMAND}}`
- Tests:   `{{TEST_COMMAND_TEMPLATE}}`
