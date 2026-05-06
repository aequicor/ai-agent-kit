# AI-agent kit `v4.6.2`

AI-agent configuration kit for [OpenCode](https://opencode.ai) and [Claude Code](https://claude.com/product/claude-code). Drops a complete agent team into your project — Main, CodeWriter (TDD-first), TestExecutor, CodeReviewer, SecurityReviewer, TraceabilityChecker, DoDGate, BugFixer, Debugger, QA, TestRunner, Designer, plus a full requirements pipeline (BusinessAnalyst → CornerCaseReviewer → SystemAnalyst → CoverageChecker → ConsistencyChecker) and a Definition-of-Done quality gate.

**Multi-host:** pick `opencode`, `claude-code`, or both — projects can run on either runtime, or on both side-by-side. Subagent prompts are shared via the kit's `_shared/` tree, while host-specific frontmatter and config files (`opencode.json`, `.claude/settings.json`) are rendered per host.

---

## Three workflows you get

| Trigger | Pipeline | Output |
|---|---|---|
| `/kit-requirements-pipeline "<feature>"` | BusinessAnalyst → CornerCaseReviewer (loop) → @QA REQUIREMENTS → CoverageChecker (loop) → SystemAnalyst → CornerCaseReviewer (loop) → ConsistencyChecker (loop) → PO sign-off | requirements.md, corner-cases.md, **living test-cases.md**, spec.md |
| `/kit-new-feature "<feature>"` | (auto-runs requirements-pipeline if needed) → SEARCH → DESIGN → PLAN → @QA IMPL DRAFT → CONFIRM → CodeWriter ↔ CodeReviewer (per stage) → @QA IMPL FINAL → optional @TestRunner walkthrough → CLOSE | implementation + tests + updated test-cases.md |
| `/kit-fix [TC-id\|description]` or `/kit-fix` | SCAN test-cases.md → TRIAGE → DEBUG (if needed) → BugFixer → RERUN | fixed code, regression test, test-cases.md updated (Status FAIL→PASS, Defects log OPEN→FIXED) |
| `/kit-techdebt [TD-id\|module=<n>\|severity=<lvl>]` | SCAN `<vault_path>/tech-debt/<module>/` → TRIAGE with PO → DIRECT or PLAN fix loop per entry → @CodeReviewer → ARCHIVE to `done/` | closed tech-debt entries, fix commits, batch report (open entries are written by @CodeWriter/@BugFixer/@CodeReviewer via the `tech-debt-record` skill while doing other work) |

The **living test-cases file** at `<vault_path>/reference/<module>/test-cases/<feature>-test-cases.md` is the single source of truth for `/kit-fix`. PO can edit it manually — change Status to `FAIL`, append a new TC row, edit Notes — and `/kit-fix` will pick it up. (`vault_path` is set in the manifest, default `vault`.)

**Optional add-on:** after `/kit-approve` (and before or after `/kit-new-feature`), run `/kit-diagram [feature]` to generate a single `<feature>-diagrams.md` next to the spec, containing structural (class + component) and behavioral (sequence + state) UML diagrams in **Mermaid**. Available on stacks that include the `requirements-pipeline` capability profile, since the spec it consumes is produced there.

---

## Install (no clone)

Paste this into your AI agent (Claude Code / Cursor / OpenCode chat / GPT-with-tools / etc.):

```
Fetch and follow the setup instructions from:
  https://raw.githubusercontent.com/aequicor/ai-agent-kit/master/docs/prompts/setup.md
Read it completely, then follow every phase exactly. Do not skip steps.
```

The agent will:
1. Ask you ~30 questions about your project (preferred language, target path, profiles **including which host(s) to render**, modules, provider/models, MCP, LSP, UI, code quality, formatter).
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

That command (defined in `kit/.opencode/commands/kit-update.md`) tells the agent to fetch [docs/prompts/update.md](docs/prompts/update.md) and follow it. The update prompt:

- Reads current `kit_version` from your manifest.
- Fetches `docs/migration/changelog.yaml` and computes the migration path.
- Shows you breaking changes, new manifest fields, files to be overwritten.
- After confirmation, re-renders all kit-managed files in **merge mode** (overwrite kit-managed; never touch `<vault_path>/concepts/**`, `<vault_path>/reference/**`, `.planning/CURRENT.md`, etc.).
- Bumps `kit_version`, appends new manifest fields with documented defaults.
- Verifies (9 agents, JSON validity, no literal API keys, smoke `compile_command`).

You can also paste the update prompt directly without `/kit-update`:

```
Fetch and follow:
  https://raw.githubusercontent.com/aequicor/ai-agent-kit/master/docs/prompts/update.md
```

---

## Extend an installed kit with one more profile

Inside an installed kit, you can pull in any single profile by URL:

```
/kit-extend https://github.com/aequicor/ai-agent-kit/blob/master/profiles/capability/solid.yaml
```

The URL may point at this repo or at any third-party repo hosting a profile YAML. Both `github.com/.../blob/...` and `raw.githubusercontent.com/...` shapes are accepted.

The command (defined in [`kit/.opencode/commands/kit-extend.md`](kit/.opencode/commands/kit-extend.md), backed by [`docs/prompts/extend.md`](docs/prompts/extend.md)):

- normalises the URL and fetches the profile YAML;
- validates it against [`kit/profile.schema.json`](kit/profile.schema.json) and cross-checks `_profile_axis` with the URL path;
- if the URL is **external** (not in this repo), shows the parsed profile and asks for confirmation before adding;
- no-ops with a message if the profile is already in `stack.profiles`;
- on a `language` / `provider` axis collision, asks "replace `<old>` with `<new>`?" and stops on no;
- deep-merges the profile into the manifest (lists concat+dedupe; axis-owned scalars only overwritten on confirmed replacement), shows a diff, waits for confirmation;
- re-renders all kit-managed files in merge mode (same skip-list as `/kit-update`);
- records external profiles in `stack.external_profiles[<name>] = <url>` so `/kit-update` can re-validate them later.

To author your own external profile, follow the [Add a profile](#add-a-profile) instructions and host the YAML anywhere reachable over HTTPS.

---

## Reconfigure the installed kit

`/kit-config` edits the installed manifest in place using a plain-language description of what to change. It re-renders only the kit-managed files affected by the change. It does **not** bump `kit_version` (use `/kit-update` for that) and does **not** add profiles (use `/kit-extend` for that).

```
/kit-config switch the reviewer model to claude-opus-4-7
/kit-config выключи MCP serena, он больше не нужен
/kit-config поменяй провайдера на ollama-cloud, ключ в OLLAMA_KEY
/kit-config add a forbidden pattern: no var declarations in Kotlin
/kit-config rename module server to backend
/kit-config                                # interactive — picks a section, asks what to change
```

The command (defined in [`kit/_shared/commands/kit-config.md.template`](kit/_shared/commands/kit-config.md.template), backed by [`docs/prompts/config.md`](docs/prompts/config.md)):

- locates the manifest, parses your plain-language request (any natural language);
- translates intent to a list of `<field path> : <old> → <new>` edits, asking one clarifying question if the request is ambiguous;
- refuses and redirects edits to `kit_version`, `hosts`, or `stack.profiles[]` (those have dedicated commands);
- schema-validates every edit and security-scans every `*api_key_env` change for literal-key patterns;
- classifies blast radius (LOW / MEDIUM / HIGH), shows a unified manifest diff + the file re-render set + warnings for HIGH-blast changes (`vault_path`, `modules[]` rename, `project.name`);
- waits for `/kit-approve` (or dispatches `@AutoApprover` if `AUTO_APPROVE=true`);
- writes the manifest, re-renders only affected files in merge mode (same skip-list as `/kit-update`);
- re-validates manifest + every host config (`opencode.json` / `.claude/settings.json`); surfaces failures with paths and lets PO decide.

---

## Available profiles

Profiles are organised along five **orthogonal axes**. Each profile is restricted to fields its axis owns, so profiles from different axes never overwrite each other — the merge is conflict-free by construction.

| Axis | Cardinality | Owns | Profiles |
|------|------------|------|----------|
| `language` | exactly 1 | `stack` commands, `lsp`, `formatter`, `mcp.serena` | `kotlin-gradle`, `make-generic` |
| `framework` | 0..N | `ui`, `code_quality.forbidden_patterns` | `compose-multiplatform`, `paper-plugin` |
| `host` | 1..N | which template tree is rendered, host config file, agent frontmatter format, instruction file | `opencode`, `claude-code` |
| `provider` | exactly 1 IF `opencode` ∈ hosts, else 0 | `provider`, `models` (used only by OpenCode rendering) | `routerai` (default), `ollama-cloud` |
| `capability` | 0..N (`security-baseline` always added) | `code_quality.forbidden_patterns`; may wire agents via skills | `security-baseline`, `solid`, `requirements-pipeline`, `quality-gates` |

**Common combos:**

```yaml
# KMP app on OpenCode + RouterAI with the requirements pipeline + quality gates:
stack:
  profiles: [kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline, requirements-pipeline, quality-gates]

# Same project on Claude Code (Anthropic native — no provider profile):
stack:
  profiles: [kotlin-gradle, compose-multiplatform, claude-code, security-baseline, requirements-pipeline]

# Dual-host (run both OpenCode and Claude Code on the same project):
stack:
  profiles: [kotlin-gradle, compose-multiplatform, opencode, claude-code, routerai, security-baseline, requirements-pipeline]

# Minecraft Paper plugin on Ollama Cloud (OpenCode-only):
stack:
  profiles: [kotlin-gradle, paper-plugin, opencode, ollama-cloud, security-baseline]

# Anything else — language-agnostic baseline (OpenCode + RouterAI):
stack:
  profiles: [make-generic, opencode, routerai, security-baseline]
```

The setup prompt asks one question per axis, validates cardinality, and checks each profile against [`kit/profile.schema.json`](kit/profile.schema.json) so a profile cannot quietly populate a field outside its axis.

---

## Agent roster

### Always present (14 base agents)

| Agent | Role |
|---|---|
| `@Main` | Orchestrator — your single entry point. Runs FEATURE / BUG / TECH pipelines. **In Claude Code installs this role lives in the main session via `CLAUDE.md`** (no separate `Main.md` subagent file). |
| `@CodeWriter` | Implements code stage by stage **TDD-first** (failing tests → minimal code → green). |
| `@TestExecutor` | Independent run of full module test suite (build + unit + integration) after `@CodeWriter`, before `@CodeReviewer`. Maps in-scope TCs to PASS / FAIL / NOT_RUN. (v4.5+) |
| `@CodeReviewer` | Read-only review after `@TestExecutor` — style + spec + structure + surface-level security smell. |
| `@SecurityReviewer` | Adversarial OWASP-aligned pass for stages touching auth / sessions / PII / payments / SQL / external HTTP / RBAC. (v4.5+) |
| `@TraceabilityChecker` | Read-only matrix audit AC / CC / spec-endpoint → TC → test file → source symbol. Reports orphans + weak assertions. (v4.5+) |
| `@DoDGate` | Definition-of-Done gate — last gate before CLOSE. Runs the `definition-of-done` skill checklist (8 groups, ~25 binary checks). Returns binary PASS / BLOCK. (v4.5+) |
| `@BugFixer` | Root-cause analysis + fix + regression test + updates test-cases.md. CRIT/HIGH defects auto-trigger `bug-retro`. |
| `@Debugger` | Read-only investigation — produces failing test for complex bugs. |
| `@QA` | Owns `<feature>-test-cases.md` (REQUIREMENTS phase creates, IMPLEMENTATION phase appends). |
| `@TestRunner` | Operates on test-cases.md (SCAN / EXECUTE / RERUN / APPEND). |
| `@Designer` | UI/UX description for visual features (read-only). Optional: omit by setting `models.designer: null` (or `claude_code.models.designer: null`). |
| `@PromptEngineer` | Maintains agent prompts and skills. |
| `@AutoApprover` | Automated plan gatekeeper when `AUTO_APPROVE=true`. |

### Requirements-pipeline profile (5 additional)

`@BusinessAnalyst`, `@CornerCaseReviewer` (BUSINESS / TECHNICAL / **IMPLEMENTATION** modes — the last attacks code, not docs, after `@TestExecutor` PASS), `@SystemAnalyst`, `@CoverageChecker`, `@ConsistencyChecker`. Invoked automatically by `@Main` via the `requirements-pipeline` skill — never selected manually.

---

## Bug-fix workflow with the living test-cases file

The test-cases file at `<vault_path>/reference/<module>/test-cases/<feature>-test-cases.md` is your control panel for what's working and what isn't:

1. As you test the feature manually, change the **Status** column for each row: `PEND` → `PASS` or `FAIL`. Add Notes if helpful.
2. If you find a bug not covered by an existing TC, **add a new row** with `Status: FAIL` and Notes describing the symptom.
3. Run `/kit-fix` (no arguments). It dispatches `@TestRunner SCAN`, lists all `FAIL`/`PEND` rows (including your additions), and asks which to fix.
4. For each chosen TC, the BUG pipeline runs: `@BugFixer` analyzes, fixes, runs `@CodeReviewer`, builds, updates the file (Status `FAIL`→`PASS`, Defects log `OPEN`→`FIXED`), commits, writes a report. Then `@TestRunner RERUN` re-verifies with you (`FIXED` → `PASS Verified`).
5. You can also run `/kit-fix TC-05` to fix one specific row, or `/kit-fix "login crashes when email has +"` to add a new TC and fix it in one step.

You never have to leave the markdown file — it's the source of truth.

---

## Tech-debt capture and fix

Agents that touch code (`@CodeWriter`, `@BugFixer`, `@CodeReviewer`) routinely notice non-critical issues outside the scope of their current task — compiler warnings, duplicated blocks in sibling files, deprecated calls, stale TODOs. Instead of expanding the current diff or interrupting PO mid-task, they record these via the `tech-debt-record` skill.

**Recording (automatic, during normal work):**

Each finding becomes one file under `<vault_path>/tech-debt/<module>/<slug>.md` with frontmatter (`category`, `severity`, `status`, `module`, `files`) and a body explaining what it is and why it was deferred. The skill's strict criteria filter out vague impressions, in-scope issues, and anything that is actually a bug or security gap (those escalate or get fixed). Each agent has a per-task cap (5 entries for CodeWriter / CodeReviewer, 3 for BugFixer) so the backlog cannot be flooded.

**Fixing (when PO is ready):**

```
/kit-techdebt                    # scan all modules, ask which to fix
/kit-techdebt module=server      # only entries in `server` module
/kit-techdebt severity=high      # only high-severity entries
/kit-techdebt TD-server-dup-tok  # one specific entry by ID
```

The command shows the PO a triage view, asks which entries to drain, and runs each through either a DIRECT fix loop (`@BugFixer`-style ANALYZE → FIX → `@CodeReviewer` → BUILD — for low/medium severity, ≤2 files) or a PLAN loop (stage files + `@CodeWriter` per stage — for high severity or cross-cutting refactors). Entries archive to `<vault_path>/tech-debt/<module>/done/<slug>.md` on success and stay open with a Notes line on auto-stop. The whole batch runs as a single TECH task in `.planning/tasks/techdebt-batch-<ISO>.md` so it closes cleanly.

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
3. Populate **only** fields the chosen axis is allowed to set. Refer to [`kit/profile.schema.json`](kit/profile.schema.json) — it enforces this at validation time, and setup.md cross-checks that `_profile_axis` matches the directory.
4. Reference it in a manifest: `stack.profiles: [..., <name>, ...]`. Names are bare (no axis prefix) and must be unique across all axes.

If you find yourself wanting to set a field outside your axis, that's a sign the work belongs in a separate profile on a different axis.

### Add an agent

1. Add the body once: `kit/_shared/agents/<YourAgent>.body.md.template`. Pure prose — no frontmatter. This file is included into both host wrappers via `{{INCLUDE: _shared/agents/<YourAgent>.body.md.template}}`.
2. Add a wrapper per host:
   - `kit/.opencode/agents/<YourAgent>.md.template` — OpenCode frontmatter (`description`, `mode`, `model: {{PROVIDER_ID}}/{{...}}_MODEL`, `temperature`, `permission`) + `{{INCLUDE: ...}}` directive.
   - `kit/.claude/agents/<YourAgent>.md.template` — Claude Code frontmatter (`name`, `description`, `tools: <comma-list>`, `model: {{..._MODEL}}`) + the same `{{INCLUDE: ...}}` directive.
3. If the agent is part of a pipeline, reference it from `kit/_shared/agents/Main.body.md.template` (the orchestrator body) or from a skill under `kit/_shared/skills/`.
4. Run `find kit -type f ! -name "_index.txt" | sort > kit/_index.txt` to refresh the index. Commit.

### Add a skill

1. Create `kit/_shared/skills/<your-skill>/SKILL.md.template`. Skills are host-agnostic — one source, rendered into every host's `<host_dir>/skills/`.
2. Reference it from the orchestrator body or wherever it should be invoked.
3. Refresh `kit/_index.txt`. Commit.

### Customize an agent for one project (post-install)

After install, the kit files live in your target project. Edit `<target>/.opencode/agents/<X>.md` (or `<target>/.claude/agents/<X>.md`) directly. Note that `/kit-update` will overwrite kit-managed files in merge mode — commit your edits first, and re-apply them after each upgrade (or use `git diff` after `/kit-update` to spot what was overwritten).

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
│   │   ├── extend.md                      # AI-driven /kit-extend — add one profile by URL
│   │   ├── config.md                      # AI-driven /kit-config — edit manifest fields in plain language
│   │   └── uninstall.md                   # AI-driven uninstall (no scripts)
│   └── migration/changelog.yaml           # version history + breaking changes + new fields
├── profiles/                              # one subdirectory per axis — directory name == _profile_axis
│   ├── language/
│   │   ├── kotlin-gradle.yaml
│   │   └── make-generic.yaml
│   ├── framework/
│   │   ├── compose-multiplatform.yaml
│   │   └── paper-plugin.yaml
│   ├── host/
│   │   ├── opencode.yaml                  #   default
│   │   └── claude-code.yaml
│   ├── provider/
│   │   ├── routerai.yaml                  #   default (only used by opencode host)
│   │   └── ollama-cloud.yaml
│   └── capability/
│       ├── security-baseline.yaml         #   auto-added on every install
│       ├── solid.yaml
│       ├── requirements-pipeline.yaml
│       └── quality-gates.yaml             #   v4.5+ test-quality + traceability forbidden patterns
└── kit/                                   # everything that gets rendered into your project
    ├── _index.txt                         # complete file list — AI reads this to know what to fetch
    ├── manifest.schema.json               # JSON Schema for the assembled manifest
    ├── profile.schema.json                # JSON Schema for individual profile YAMLs (axis contracts)
    ├── AGENTS.md.template                 # rendered iff opencode ∈ hosts
    ├── CLAUDE.md.template                 # rendered iff claude-code ∈ hosts (inlines the orchestrator body)
    ├── AUTO_MEMORY.md.template
    ├── opencode.json.template             # rendered iff opencode ∈ hosts
    ├── nested/MODULE.body.md.template     # rendered per module per host (→ AGENTS.md / CLAUDE.md)
    ├── _shared/                           # single source of truth — pulled into both hosts via {{INCLUDE: ...}}
    │   ├── PROJECT_RULES.body.md.template
    │   ├── _shared.md.template
    │   ├── FILE_STRUCTURE.md.template
    │   ├── sessions/SESSIONS.md.template
    │   ├── i18n/{en,ru}.md
    │   ├── agents/        (19 .body.md.template — agent prose without frontmatter)
    │   ├── commands/      (17 .md.template — /kit-new-feature, /kit-fix, /kit-techdebt, /kit-requirements-pipeline, /kit-config, ...)
    │   └── skills/        (14 — bug-retro, code-review-checklist, definition-of-done, pre-mortem, requirements-pipeline, spec-to-code-trace, tech-debt-record, ...)
    ├── .opencode/
    │   └── agents/        (19 .md.template — OpenCode frontmatter + INCLUDE directive)
    ├── .claude/
    │   ├── agents/        (18 .md.template — Claude Code frontmatter + INCLUDE; Main lives in CLAUDE.md)
    │   └── settings.json.template
    ├── .planning/
    │   ├── CURRENT.md.template
    │   ├── DECISIONS.md.template
    │   └── tasks/TASK.md.template         # per-task planning stubs
    └── .vault/                                # rendered to <vault_path>/ at install time
        ├── _INDEX.md.template
        └── _templates/{bug-report,requirements,spec,tech-debt,test-cases,test-plan}.md
```

---

## Security

- API keys are referenced by **environment variable name only** in the manifest (e.g. `api_key_env: ROUTERAI_OPENCODE`). The actual key is never written into any file. Setup and update prompts both refuse to proceed if a literal-looking key is detected.
- The post-install verifier checks `opencode.json` for any literal key (matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy) and aborts with a clear message if one is found.
- Path-escape protection: target paths are resolved and checked to start with the target directory before write.

---

## License

(Inherit from your fork or set as you wish. The original opencode-kit is hosted at https://github.com/aequicor/opencode-kit.)
