# AI-agent kit `v5.1.0`

AI-agent configuration kit for [OpenCode](https://opencode.ai) and [Claude Code](https://claude.com/product/claude-code). Drops a complete, **deliberately small** agent team into your project — 9 agents instead of v4's 19, one design doc per feature instead of seven, seven Definition-of-Done checks instead of twenty-five.

The v5 redesign follows the 2025–2026 multi-agent research consensus: for tightly-coupled work like coding, fewer agents with shared context outperform large orchestrator-worker chains. See [docs/migration/changelog.yaml](docs/migration/changelog.yaml) for the full rationale.

**Multi-host:** pick `opencode`, `claude-code`, or both — projects can run on either runtime, or on both side-by-side. Subagent prompts are shared via the kit's `_shared/` tree, while host-specific frontmatter and config files (`opencode.json`, `.claude/settings.json`) are rendered per host.

---

## Three workflows you get

| Trigger | Pipeline | Output |
|---|---|---|
| `/kit-new-feature "<feature>"` | CLASSIFY → ANALYSIS (`@Analyst` writes `feature.md`; `@TestKeeper GENERATE` creates `test-cases.md`) → PLAN (writing-plans → inline steps; `@Designer` if UI; `@TestKeeper DRAFT`) → CONFIRM (`/kit-approve` or auto-approve flag) → EXECUTE (`@CodeWriter` ↔ `@TestKeeper EXECUTE` ↔ `@Reviewer` per step) → RECONCILE → `@TraceabilityChecker` → `@DoDGate` (7 checks) → CLOSE | Single `feature.md` (Why / ACs / Edge Cases / How it works / Test plan / Implementation plan / DoD), live `test-cases.md`, code + tests |
| `/kit-fix [TC-id\|description]` or `/kit-fix` | SCAN test-cases.md → TRIAGE → DEBUG (`@BugFixer MODE=debug`) if needed → FIX (`@BugFixer MODE=fix`) → `@Reviewer` → `@TestKeeper RERUN` → optional `bug-retro` for CRIT/HIGH | Fixed code, regression test, test-cases.md updated (Status FAIL→PASS, Defects log OPEN→FIXED), retro entry |
| `/kit-techdebt [TD-id\|module=<n>\|severity=<lvl>]` | SCAN `<vault_path>/tech-debt/<module>/` → TRIAGE with PO → DIRECT or PLAN fix loop per entry → `@Reviewer` → ARCHIVE to `done/` | Closed tech-debt entries, fix commits, batch report |

The **live test-cases file** at `<vault_path>/features/<module>/<feature>/test-cases.md` is the single source of truth for `/kit-fix`. PO can edit it manually — change Status to `FAIL`, append a new TC row, edit Notes — and `/kit-fix` will pick it up.

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
| `capability` | 0..N (`security-baseline` always added) | `code_quality.forbidden_patterns`; may wire skills | `security-baseline`, `solid`, `clean-architecture`, `requirements-pipeline` (no-op in v5+, kept for back-compat), `quality-gates` |

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
    ├── _shared/                           # single source of truth — pulled into both hosts via {{INCLUDE: ...}}
    │   ├── PROJECT_RULES.body.md.template
    │   ├── _shared.md.template
    │   ├── FILE_STRUCTURE.md.template
    │   ├── i18n/{en,ru}.md
    │   ├── agents/        (9 .body.md.template — agent prose without frontmatter)
    │   ├── commands/      (12 .md.template — /kit-new-feature, /kit-fix, /kit-techdebt, /kit-config, ...)
    │   └── skills/        (6 — bug-retro, definition-of-done, look-up, pre-mortem, spec-to-code-trace, tech-debt-record)
    ├── .opencode/
    │   └── agents/        (9 .md.template — OpenCode frontmatter + INCLUDE directive)
    ├── .claude/
    │   ├── agents/        (8 .md.template — Claude Code frontmatter + INCLUDE; Main lives in CLAUDE.md)
    │   └── settings.json.template
    ├── .planning/
    │   ├── CURRENT.md.template
    │   ├── DECISIONS.md.template
    │   └── tasks/TASK.md.template         # per-task planning stubs
    └── .vault/                            # rendered to <vault_path>/ at install time
        ├── _INDEX.md.template
        └── _templates/{feature,test-cases,retro,tech-debt}.md
```

---

## Security

- API keys are referenced by **environment variable name only** in the manifest (e.g. `api_key_env: ROUTERAI_OPENCODE`). The actual key is never written into any file. Setup and update prompts both refuse to proceed if a literal-looking key is detected.
- The post-install verifier checks `opencode.json` for any literal key (matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy) and aborts with a clear message if one is found.
- Path-escape protection: target paths are resolved and checked to start with the target directory before write.

---

## License

(Inherit from your fork or set as you wish. The original opencode-kit is hosted at https://github.com/aequicor/opencode-kit.)
