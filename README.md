# AI-agent kit `v7.0.0`

AI-agent configuration kit for [OpenCode](https://opencode.ai) and [Claude Code](https://claude.com/product/claude-code). Drops a deliberately small **5-agent team** into your project: **@Main** (orchestrator), **@Architect** (spec.md + plan.md skeleton + UI section, single pass), **@CodeWriter** (code + tests + 5-section runbook), **@Verifier** (mode-driven verification — 10 modes covering test execution, code review, definition-of-done, traceability), **@BugFixer** (debug + fix). Hard slice caps, mandatory diff-review gate, scope-drift detection, frozen-vs-mutable spec/plan split, per-step commits, vertical-slice gate, runbook reports, clean-session-per-step automation, defect-feedback at 5.6, autonomous `sleep mode`, non-destructive `/kit-revert-step`, token-budget slice cap, mandatory ground-truth artefact gate at 5.6, `defect_origin` and `gate_signal_ratio` telemetry, **risk-based pipeline triage with three lanes** (trivial / standard / critical) — all mandatory in v7.0.0.

v7.0.0 is the terminus of the migration plan from PIPELINE_V7_PROPOSAL.md. Two simultaneous breaking changes from v7.0.0-beta:

1. **Agent consolidation 9 → 5 forced.** v7.0.0-beta opt-in flags `agents.{consolidated_architect, consolidated_verifier}` are removed. Six legacy agent bodies (@Analyst, @Designer, @TestKeeper, @Reviewer, @DoDGate, @TraceabilityChecker) and their host wrappers are deleted (18 files). Per-mode behaviour and output formats inside @Verifier match v6.x legacy verbatim — gates.csv ids unchanged, eval-collector aggregation unchanged.
2. **Lanes mandatory.** v7.0.0-alpha opt-out `lanes.enabled: false` is removed.

Migration path: v6.2 (P0 + foundation) → v6.3 (telemetry) → v7.0.0-alpha (lanes opt-in) → v7.0.0-beta (consolidation infra opt-in) → **v7.0.0** (this; mandatory + legacy removed). `/kit-update` walks the changelog and applies all intermediate migrations in one pass; full breaking-change list shown to PO before any write.

Future v7.x releases focus on data-driven refinement (gate deprecation based on accumulated signal_ratio, mutation-sample skill auto-generation, cross-task pattern detection). None breaking — v7.0.0 is the last MAJOR bump on the migration arc.

v6.3 (previous) was the telemetry foundation — every gate verdict logs to `evals/runs/<version>/gates.csv`, surfaced by `/kit-status` with deprecation candidates highlighted. v6.2 added the research-aligned foundation: P0 fix `/kit-revert-step`, P17 token-budget cap, P18 ground-truth gate, P19 defect_origin telemetry. The full v7 plan — risk lanes and 9→5 agent consolidation — is documented in [PIPELINE_V7_PROPOSAL.md](PIPELINE_V7_PROPOSAL.md). v6.2 + v6.3 + v7.0.0-alpha land the path incrementally; each step is reversible via manifest flags.

v6.1 was a workflow-guarantees layer on top of v6.0 (P12–P16). v6.0 itself was the structural release that closed three v5 gaps: scope drift, missing diff-review step, and spec rot during replan. See [docs/migration/changelog.yaml](docs/migration/changelog.yaml) for full rationale and per-version migration plans.

**Multi-host:** pick `opencode`, `claude-code`, or both — projects can run on either runtime, or on both side-by-side. Subagent prompts are shared via the kit's `_shared/` tree, while host-specific frontmatter and config files (`opencode.json`, `.claude/settings.json`) are rendered per host.

---

## Three workflows you get

| Trigger | Pipeline | Output |
|---|---|---|
| `/kit-new-feature "<feature>"` | CLASSIFY → ANALYSIS (`@Analyst` writes **`spec.md`** + `plan.md` skeleton; `@TestKeeper GENERATE` creates `test-cases.md`) → PLAN (writing-plans → steps in `plan.md` with mandatory `Runnable:` lines; `@Designer` appends UI to spec.md before CONFIRM; `@TestKeeper DRAFT`) → **3a SLICE-CAP + RUNNABLE-SLICE GATE** → CONFIRM (`/kit-approve` or auto-approve flag; **spec.md FROZEN at PASS**) → EXECUTE per step (`@CodeWriter` (TDD-first by default; emits 5-section runbook) ↔ `@TestKeeper EXECUTE` ↔ `@Reviewer` (Pass A–E + adversarial A* on Critical-EC steps) ↔ **5.4a unchanged-call-sites** ↔ **5.4b per-step COMMIT** → 5.6 CHECKPOINT with **3-way fork** `/kit-approve` \| `/kit-defect <description>` \| `/kit-revert-step`) → RECONCILE → `@TraceabilityChecker` → `@DoDGate` (7 checks; verdict to plan.md) → **5.10 MANDATORY DIFF-REVIEW** (per-step + total) → CLOSE | `spec.md` (frozen) + `plan.md` (Slice budget / Implementation plan / Replan log / Diff-review / DoD), live `test-cases.md`, per-step git commits, code + tests |
| `/kit-sleep "<feature>"` *(v6.1+)* | Same FEATURE pipeline but autonomous: all CONFIRM/diff-review/replan gates auto-approve; retry budgets doubled (CodeWriter 6 / Reviewer 6 / DoDGate 5 / replan 4); on unrecoverable failure → BLOCKED-shutdown writes `.planning/MORNING_REPORT.md`. PO reads the report on wake-up. | All FEATURE outputs above + `.planning/MORNING_REPORT.md` (TL;DR / per-step runbooks / total diff / Suggested next action) |
| `/kit-fix [TC-id\|description]` or `/kit-fix` | SCAN test-cases.md → TRIAGE → DEBUG (`@BugFixer MODE=debug`) if needed → FIX (`@BugFixer MODE=fix`) → `@Reviewer` → `@TestKeeper RERUN` → optional `bug-retro` for CRIT/HIGH | Fixed code, regression test, test-cases.md updated (Status FAIL→PASS, Defects log OPEN→FIXED), retro entry |
| `/kit-techdebt [TD-id\|module=<n>\|severity=<lvl>]` | SCAN `<vault_path>/tech-debt/<module>/` → TRIAGE with PO → DIRECT or PLAN fix loop per entry (PLAN path synthesises `spec.md`+`plan.md` for the techdebt feature) → `@Reviewer` → ARCHIVE to `done/` | Closed tech-debt entries, fix commits, batch report |

The **live test-cases file** at `<vault_path>/features/<module>/<feature>/test-cases.md` is the single source of truth for `/kit-fix`. PO can edit it manually — change Status to `FAIL`, append a new TC row, edit Notes — and `/kit-fix` will pick it up.

### v6 mental model — frozen vs mutable

```
vault/features/<module>/<feature>/
  spec.md         ← Why / ACs / Edge Cases / How it works / Test plan / UI
                    FROZEN at CONFIRM. Read-only after that for the rest of
                    the FEATURE pipeline. AC/EC changes go through PO + a
                    fresh @Analyst DRAFT cycle, NOT through replan.
  plan.md         ← Slice budget / Implementation plan / Replan log /
                    Diff-review (per-step + total at 5.10) / DoD
                    Mutable across EXECUTE. v6.1 dropped the v6.0
                    `Step-level diff stats` section; per-step diff history
                    now lives in .planning/tasks/<slug>.md.step_commits[].
  test-cases.md   ← Live test state (TC table + Defects log)
  retro.md        ← Optional, accumulates bug-fix retrospectives
```

This is the v6 split — see [docs/migration/changelog.yaml](docs/migration/changelog.yaml) v6.0.0 entry for why. v6.1 trimmed plan.md by moving per-step stats into the task-file `step_commits[]` array (single source of truth).

### v6.1 mental model — workflow guarantees

```
Per step in EXECUTE (interactive default):
  @CodeWriter writes (TDD-first) → emits 5-section runbook
  @TestKeeper EXECUTE → green
  @Reviewer (Pass A–E) → CLEAN
  5.4b: git commit -m "step <N>: <goal>" → step_commits[N].sha
  5.6 CHECKPOINT — PO sees runbook + 3-way fork:
    /kit-approve              → next step (or /clear → /kit-step-resume)
    /kit-defect <description> → re-open step N with PO-found defect
    /kit-revert-step          → undo step entirely
  Repeat until all plan steps done → RECONCILE → DoDGate → 5.10 → CLOSE.

Sleep mode (per-task opt-in via /kit-sleep or --sleep flag):
  Same pipeline, but all forks auto-/kit-approve; retry budgets doubled;
  on unrecoverable failure → BLOCKED-shutdown writes MORNING_REPORT.md
  with TL;DR + last green sha + suggested next action. PO reads on wake-up.

Clean session per step:
  After 5.6, /clear (or new OC session) — SessionStart hook (CC) /
  session.created plugin (OC) injects pending-step context. PO runs
  /kit-step-resume to enter step N+1 with a focused per-step bundle
  instead of the full /kit-resume dump.
```

---

## Install (no clone)

Paste this into your AI agent (Claude Code / Cursor / OpenCode chat / GPT-with-tools / etc.):

```
Fetch and follow the setup instructions from:
  https://raw.githubusercontent.com/aequicor/ai-agent-kit/master/docs/prompts/setup.md
Read it completely, then follow every phase exactly. Do not skip steps.
```

The agent will:

1. Ask you ~30 questions about your project (preferred language, target path, profiles **including which host(s) to render**, modules, provider/models, MCP, LSP, UI, code quality, formatter, **auto_approve flag**).
2. Fetch the chosen profile YAMLs, deep-merge them, overlay your answers, validate the manifest against `kit/manifest.schema.json`.
3. Show you the manifest, wait for confirmation, write it to `<target>/<project-slug>.yaml`.
4. Read `kit/_index.txt`, fetch every kit file, **resolve `{{INCLUDE: <path>}}` directives**, render `{{VAR}}` placeholders **per host**, write to your target. Multi-host installs render `.opencode/` and `.claude/` side-by-side.
5. Verify per host (mandatory agents in `<host_dir>/agents/`, valid host config file, no leaked API keys, no unresolved placeholders).
6. Print env-var reminder per host.

No external runtime needed — the AI does all rendering itself.

---

## Update

Inside an installed kit, run:

```
/kit-update
```

That command tells the agent to fetch [docs/prompts/update.md](docs/prompts/update.md) and follow it. The update prompt:

- Reads current `kit_version` from your manifest.
- Fetches `docs/migration/changelog.yaml` and computes the migration path.
- Shows you breaking changes, new manifest fields, files to be overwritten.
- After confirmation, re-renders all kit-managed files in **merge mode** (overwrite kit-managed; never touch `<vault_path>/features/**`, `<vault_path>/guidelines/**`, `<vault_path>/tech-debt/**`, `.planning/CURRENT.md`, `.planning/tasks/**`, `.planning/DECISIONS.md`).
- Bumps `kit_version`, appends new manifest fields with documented defaults.
- Verifies (9 agents, JSON validity, no literal API keys, smoke `compile_command`).

Upgrading from v4.x to v5.0.0 is a major change — review the [v5 changelog entry](docs/migration/changelog.yaml) before running `/kit-update`.

---

## Extend an installed kit with one more profile

Inside an installed kit, you can pull in any single profile by URL:

```
/kit-extend https://github.com/aequicor/ai-agent-kit/blob/master/profiles/capability/solid.yaml
```

The URL may point at this repo or at any third-party repo hosting a profile YAML. Both `github.com/.../blob/...` and `raw.githubusercontent.com/...` shapes are accepted.

---

## Reconfigure the installed kit

`/kit-config` edits the installed manifest in place using a plain-language description of what to change. It re-renders only the kit-managed files affected.

```
/kit-config switch the reviewer model to claude-opus-4-7
/kit-config выключи MCP serena, он больше не нужен
/kit-config поменяй провайдера на ollama-cloud, ключ в OLLAMA_KEY
/kit-config add a forbidden pattern: no var declarations in Kotlin
/kit-config rename module server to backend
/kit-config enable auto_approve
/kit-config                                # interactive — picks a section, asks what to change
```

It does **not** bump `kit_version` (use `/kit-update`) and does **not** add profiles (use `/kit-extend`).

---

## Available profiles

Profiles are organised along five **orthogonal axes**. Each profile is restricted to fields its axis owns, so profiles from different axes never overwrite each other — the merge is conflict-free by construction.

| Axis | Cardinality | Owns | Profiles |
|------|------------|------|----------|
| `language` | exactly 1 | `stack` commands, `lsp`, `formatter`, `mcp.serena` | `kotlin-gradle`, `make-generic` |
| `framework` | 0..N | `ui`, `code_quality.forbidden_patterns` | `compose-multiplatform`, `paper-plugin` |
| `host` | 1..N | which template tree is rendered, host config file, agent frontmatter format, instruction file | `opencode`, `claude-code` |
| `provider` | exactly 1 IF `opencode` ∈ hosts, else 0 | `provider`, `models` (used only by OpenCode rendering) | `routerai` (default), `ollama-cloud` |
| `capability` | 0..N (`security-baseline` always added) | `code_quality.forbidden_patterns`; may wire skills; `ci-github` enables real-CI rendering | `security-baseline`, `solid`, `clean-architecture`, `requirements-pipeline` (no-op in v5+, kept for back-compat), `quality-gates`, `ci-github` (v6+, P10 — needs `ci_host: github`) |

**Common combos:**

```yaml
# KMP app on OpenCode + RouterAI with Clean Architecture + quality gates:
stack:
  profiles: [kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline, solid, clean-architecture, quality-gates]

# Same project on Claude Code (Anthropic native — no provider profile):
stack:
  profiles: [kotlin-gradle, compose-multiplatform, claude-code, security-baseline, solid]

# Dual-host (run both OpenCode and Claude Code on the same project):
stack:
  profiles: [kotlin-gradle, compose-multiplatform, opencode, claude-code, routerai, security-baseline]

# Minecraft Paper plugin on Ollama Cloud (OpenCode-only):
stack:
  profiles: [kotlin-gradle, paper-plugin, opencode, ollama-cloud, security-baseline]

# Anything else — language-agnostic baseline:
stack:
  profiles: [make-generic, opencode, routerai, security-baseline]
```

The setup prompt asks one question per axis, validates cardinality, and checks each profile against [`kit/profile.schema.json`](kit/profile.schema.json).

---

## Agent roster (9 agents)

| Agent | Role |
|---|---|
| `@Main` | Orchestrator — your single entry point. Runs FEATURE / BUG / TECH pipelines. **In Claude Code installs this role lives in the main session via `CLAUDE.md`** (no separate `Main.md` subagent file). |
| `@Analyst` | Single-pass author of the feature design doc (Why, ACs, Edge Cases, How it works, Test plan) with built-in self-reflection. Replaces v4 BusinessAnalyst + SystemAnalyst + CornerCaseReviewer + CoverageChecker + ConsistencyChecker. |
| `@CodeWriter` | Implements one step **TDD-first** (failing tests → minimal code → green). |
| `@TestKeeper` | Owns `test-cases.md` end-to-end. Modes: GENERATE / DRAFT / EXECUTE / RECONCILE / RERUN / SCAN / APPEND. Replaces v4 QA + TestExecutor + TestRunner. |
| `@Reviewer` | Read-only single-dispatch review: code + security smell + stub-scan. Replaces v4 CodeReviewer + SecurityReviewer + STUB-SCAN. |
| `@TraceabilityChecker` | Read-only matrix audit AC/EC → TC → test file → source symbol. Reports orphans + weak assertions (info-only). |
| `@DoDGate` | Definition-of-Done gate — last gate before CLOSE. 7 hard checks. Returns binary PASS / BLOCK. |
| `@BugFixer` | Defect analysis + fix + retro entry. `MODE=debug` is the v5 successor to the v4 `@Debugger` agent. |
| `@Designer` | UI/UX appendix on UI features (read-only; appends `## UI / UX` section to `feature.md`). Optional — omit by setting `models.designer: null`. |

v4 agents removed in v5: `@BusinessAnalyst`, `@SystemAnalyst`, `@CornerCaseReviewer`, `@CoverageChecker`, `@ConsistencyChecker`, `@CodeReviewer`, `@SecurityReviewer`, `@QA`, `@TestRunner`, `@TestExecutor`, `@Debugger`, `@AutoApprover`, `@PromptEngineer`. Their responsibilities are folded into the merged agents above or into the manifest's `auto_approve` flag.

---

## Bug-fix workflow with the live test-cases file

The test-cases file at `<vault_path>/features/<module>/<feature>/test-cases.md` is your control panel for what's working and what isn't:

1. As you test the feature manually, change the **Status** column for each row: `PEND` → `PASS` or `FAIL`. Add Notes if helpful.
2. If you find a bug not covered by an existing TC, **add a new row** with `Status: FAIL` and Notes describing the symptom.
3. Run `/kit-fix` (no arguments). It dispatches `@TestKeeper MODE=SCAN`, lists all `FAIL`/`PEND` rows (including your additions), and asks which to fix.
4. For each chosen TC, the BUG pipeline runs: `@BugFixer` analyzes, fixes, runs `@Reviewer`, builds, updates the file (Status `FAIL`→`PASS`, Defects log `OPEN`→`FIXED`), commits, appends to `retro.md`. Then `@TestKeeper MODE=RERUN` re-verifies with you.
5. You can also run `/kit-fix TC-05` to fix one specific row, or `/kit-fix "login crashes when email has +"` to add a new TC and fix it in one step.

You never have to leave the markdown file — it's the source of truth.

---

## Tech-debt capture and fix

Agents that touch code (`@CodeWriter`, `@BugFixer`, `@Reviewer`) routinely notice non-critical issues outside the scope of their current task. Instead of expanding the diff or interrupting PO mid-task, they record these via the `tech-debt-record` skill.

Each finding becomes one file under `<vault_path>/tech-debt/<module>/<slug>.md` with frontmatter (`category`, `severity`, `status`, `module`, `files`) and a body explaining what it is and why it was deferred.

```
/kit-techdebt                    # scan all modules, ask which to fix
/kit-techdebt module=server      # only entries in `server` module
/kit-techdebt severity=high      # only high-severity entries
/kit-techdebt TD-server-dup-tok  # one specific entry by ID
```

---

## What's new in v6 — at a glance

| Proposal | What it does | Where |
|----------|--------------|-------|
| P1 | Hard slice caps (steps / files-per-step / lines-per-step). Overflow → BLOCKED, no auto-trim | `manifest.slice_caps`; @Main step 3a; @CodeWriter Step 5b |
| P2 | Mandatory diff-review gate at step 5.10 between EXECUTE and CLOSE; PO eye on every close | @Main 5.10; `auto_approve.diff_review` (separate from class flags) |
| P3 | Forbid bypass markers (`@SuppressWarnings`, `@ts-ignore`, `--no-verify`, …) without an issue id | `security-baseline` profile; @Reviewer Pass A7; `ci-github` bypass-scan job |
| P4 | @Reviewer Pass D — scope drift (out-of-step files MEDIUM, cross-module HIGH) | @Reviewer Pass D |
| P5 | Section-sliced dispatch — subagents get only the relevant slice of spec.md/plan.md | @Main step 5.1 EXTRACT |
| P6 | Step-level diff-stat checkpoints (telemetry for tuning slice_caps) | @Main step 5.6; plan.md § Step-level diff stats |
| P7 | Adversarial second-pass for Critical-EC steps ("what is missing?") | @Reviewer Pass A* |
| P8 | Configurable test_strategy (tdd_first / test_after / mixed) | `manifest.test_strategy`; @CodeWriter Step 3 |
| P9 | spec.md (frozen at CONFIRM) + plan.md (mutable) split — replan can no longer rot the spec | every agent / skill / template / command |
| P10 | Real CI workflow mirroring in-session gates + bypass-scan | `ci-github` profile; `ci_host: github`; `kit/.github/workflows/kit-gates.yml` |
| P11 | Unchanged-call-sites quick check after every step's review | @Main step 5.4a |

New manifest fields (auto-added by `/kit-update` with documented defaults): `slice_caps`, `test_strategy`, `ci_host`, `auto_approve.diff_review`.

## Eval suite (new in v5)

`evals/` contains 5 seed tasks (3 FEATURE, 2 BUG, 1 TECH), a metrics template, and instructions for recording per-version runs. Use as a baseline before tuning further. Per Anthropic's research-system guidance, no agent change should be made blind. See [evals/README.md](evals/README.md).

---

## Extending

### Add a profile

1. Pick the right axis (`language`, `framework`, `host`, `provider`, or `capability`) — see the table above.
2. Create `profiles/<axis>/<name>.yaml` (the directory name *is* the axis). Include the front-matter:

   ```yaml
   _profile_name: <name>
   _profile_description: "<one line>"
   _profile_axis: <axis>      # must match the directory name
   ```

3. Populate **only** fields the chosen axis is allowed to set. Refer to [`kit/profile.schema.json`](kit/profile.schema.json) — it enforces this at validation time.
4. Reference it in a manifest: `stack.profiles: [..., <name>, ...]`. Names are bare (no axis prefix) and must be unique across all axes.

### Add an agent

1. Add the body once: `kit/_shared/agents/<YourAgent>.body.md.template`. Pure prose — no frontmatter.
2. Add a wrapper per host:
   - `kit/.opencode/agents/<YourAgent>.md.template` — OpenCode frontmatter (`description`, `mode`, `model: {{PROVIDER_ID}}/{{...}}_MODEL`, `temperature`, `permission`) + `{{INCLUDE: ...}}` directive.
   - `kit/.claude/agents/<YourAgent>.md.template` — Claude Code frontmatter (`name`, `description`, `tools: <comma-list>`, `model: {{..._MODEL}}`) + the same `{{INCLUDE: ...}}` directive.
3. If the agent is part of a pipeline, reference it from `kit/_shared/agents/Main.body.md.template`.
4. Run `find kit -type f ! -name "_index.txt" | sort > kit/_index.txt` to refresh the index. Commit.

### Add a skill

1. Create `kit/_shared/skills/<your-skill>/SKILL.md.template`.
2. Reference it from the orchestrator body or wherever it should be invoked.
3. Refresh `kit/_index.txt`. Commit.

### Customize an agent for one project (post-install)

After install, the kit files live in your target project. Edit `<target>/.opencode/agents/<X>.md` (or `<target>/.claude/agents/<X>.md`) directly. `/kit-update` will overwrite kit-managed files in merge mode — commit your edits first, and re-apply them after each upgrade.

---

## Repository layout

```
ai-agent-kit/
├── README.md                              # this file
├── manifest.example.yaml                  # copy & edit for your project
├── docs/
│   ├── prompts/
│   │   ├── setup.md                       # AI-driven install (no scripts)
│   │   ├── update.md                      # AI-driven update (no scripts)
│   │   ├── extend.md                      # AI-driven /kit-extend
│   │   ├── config.md                      # AI-driven /kit-config
│   │   └── uninstall.md                   # AI-driven uninstall (no scripts)
│   └── migration/changelog.yaml           # version history + breaking changes + new fields
├── evals/                                 # eval suite (new in v5)
│   ├── README.md
│   ├── metrics.md
│   ├── seed-tasks/                        # 5 seed tasks (3 FEATURE / 2 BUG / 1 TECH)
│   └── runs/                              # one folder per release
├── profiles/                              # one subdirectory per axis — directory name == _profile_axis
│   ├── language/{kotlin-gradle,make-generic}.yaml
│   ├── framework/{compose-multiplatform,paper-plugin}.yaml
│   ├── host/{opencode,claude-code}.yaml
│   ├── provider/{routerai,ollama-cloud}.yaml
│   └── capability/
│       ├── security-baseline.yaml         #   auto-added on every install
│       ├── solid.yaml                     #   class-level OO (SOLID + DRY/YAGNI/KISS)
│       ├── clean-architecture.yaml        #   system-level layering / ports & adapters / boundary DTOs
│       ├── requirements-pipeline.yaml     #   v4 capability — no-op in v5+, kept for back-compat
│       └── quality-gates.yaml             #   test-quality + traceability forbidden patterns
└── kit/                                   # everything that gets rendered into your project
    ├── _index.txt                         # complete file list — AI reads this to know what to fetch
    ├── manifest.schema.json               # JSON Schema for the assembled manifest
    ├── profile.schema.json                # JSON Schema for individual profile YAMLs
    ├── AGENTS.md.template                 # rendered iff opencode ∈ hosts
    ├── CLAUDE.md.template                 # rendered iff claude-code ∈ hosts (inlines the orchestrator body)
    ├── AUTO_MEMORY.md.template
    ├── opencode.json.template             # rendered iff opencode ∈ hosts
    ├── nested/MODULE.body.md.template     # rendered per module per host
    ├── .github/workflows/kit-gates.yml.template   # v6+ rendered iff ci-github profile + ci_host: github (P10)
    ├── _shared/                           # single source of truth — pulled into both hosts via {{INCLUDE: ...}}
    │   ├── PROJECT_RULES.body.md.template
    │   ├── _shared.md.template
    │   ├── FILE_STRUCTURE.md.template
    │   ├── i18n/{en,ru}.md
    │   ├── agents/        (9 .body.md.template — agent prose without frontmatter)
    │   ├── commands/      (17 .md.template — /kit-new-feature, /kit-fix, /kit-techdebt, /kit-config, /kit-resume, /kit-step-resume, /kit-map, /kit-sleep, /kit-defect, /kit-revert-step, ...)
    │   └── skills/        (8 — bug-retro, definition-of-done, look-up, pre-mortem, spec-to-code-trace, tech-debt-record + v5.2 optional: replan-on-discovery, eval-collector)
    ├── .opencode/
    │   ├── agents/        (9 .md.template — OpenCode frontmatter + INCLUDE directive)
    │   └── plugins/       (1 .ts — session-bootstrap plugin on session.created/compacted; v6.1+)
    ├── .claude/
    │   ├── agents/        (8 .md.template — Claude Code frontmatter + INCLUDE; Main lives in CLAUDE.md)
    │   ├── hooks/         (3 .mjs — session-start-context, pre-tool-bash-guard, stop-status-reminder)
    │   └── settings.json.template
    ├── .planning/
    │   ├── CURRENT.md.template            # session pointer (mode: interactive | sleep)
    │   ├── DECISIONS.md.template
    │   ├── MORNING_REPORT.md.template     # v6.1+ sleep mode report
    │   └── tasks/TASK.md.template         # per-task state (current_step_idx, step_commits[])
    └── .vault/                            # rendered to <vault_path>/ at install time
        ├── _INDEX.md.template
        └── _templates/{spec,plan,test-cases,retro,tech-debt}.md   # v6+ — spec/plan split (P9)
```

---

## Security

- API keys are referenced by **environment variable name only** in the manifest (e.g. `api_key_env: ROUTERAI_OPENCODE`). The actual key is never written into any file. Setup and update prompts both refuse to proceed if a literal-looking key is detected.
- The post-install verifier checks `opencode.json` for any literal key (matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy) and aborts with a clear message if one is found.
- Path-escape protection: target paths are resolved and checked to start with the target directory before write.

---

## License

(Inherit from your fork or set as you wish. The original opencode-kit is hosted at https://github.com/aequicor/opencode-kit.)
