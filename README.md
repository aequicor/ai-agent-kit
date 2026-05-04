# ai-agent-kit

AI-agent configuration kit for [OpenCode](https://opencode.ai). Drops a complete agent team into your project — Main, CodeWriter, CodeReviewer, BugFixer, debugger, QA, TestRunner, Designer, plus a full requirements pipeline (BusinessAnalyst → CornerCaseReviewer → SystemAnalyst → CoverageChecker → ConsistencyChecker).

**Pure prompt-driven.** No Python, no JDK, no curl-jar. The AI agent fetches everything from this repo's raw URLs and renders templates itself.

Forked and trimmed from [aequicor/opencode-kit](https://github.com/aequicor/opencode-kit) v1.6.0 — see [docs/migration/changelog.yaml](docs/migration/changelog.yaml) for the diff.

---

## Three workflows you get

| Trigger | Pipeline | Output |
|---|---|---|
| `/requirements-pipeline "<feature>"` | BusinessAnalyst → CornerCaseReviewer (loop) → @QA REQUIREMENTS → CoverageChecker (loop) → SystemAnalyst → CornerCaseReviewer (loop) → ConsistencyChecker (loop) → PO sign-off | requirements.md, corner-cases.md, **living test-cases.md**, spec.md |
| `/new-feature "<feature>"` | (auto-runs requirements-pipeline if needed) → SEARCH → DESIGN → PLAN → @QA IMPL DRAFT → CONFIRM → CodeWriter ↔ CodeReviewer (per stage) → @QA IMPL FINAL → optional @TestRunner walkthrough → CLOSE | implementation + tests + updated test-cases.md |
| `/fix [TC-id\|description]` or `/fix` | SCAN test-cases.md → TRIAGE → DEBUG (if needed) → BugFixer → RERUN | fixed code, regression test, test-cases.md updated (Status ❌→✅, Defects log 🔴→🟢) |

The **living test-cases file** at `.vault/reference/<module>/test-cases/<feature>-test-cases.md` is the single source of truth for `/fix`. PO can edit it manually — change Status to ❌, append a new TC row, edit Notes — and `/fix` will pick it up.

---

## Install (no clone)

Paste this into your AI agent (Claude Code / Cursor / OpenCode chat / GPT-with-tools / etc.):

```
Fetch and follow the setup instructions from:
  https://raw.githubusercontent.com/<USER>/ai-agent-kit/main/docs/prompts/setup.md
Read it completely, then follow every phase exactly. Do not skip steps.
```

Replace `<USER>` with the GitHub user/org hosting the kit (this repo's owner).

The agent will:
1. Ask you ~30 questions about your project (target path, profiles, modules, provider, models, MCP, LSP, UI, code quality, formatter).
2. Fetch the chosen profile YAMLs, deep-merge them, overlay your answers, validate the manifest against `kit/manifest.schema.json`.
3. Show you the manifest, wait for confirmation, write it to `<target>/<project-slug>.yaml`.
4. Read `kit/_index.txt`, fetch every kit file, render `{{VAR}}` placeholders, write to your target.
5. Verify (9 mandatory agents, valid `opencode.json`, no leaked API keys, no unresolved placeholders).
6. Print env-var reminder.

No external runtime needed — the AI does all rendering itself.

---

## Update

Inside an installed kit, run:

```
/update
```

That command (defined in `kit/.opencode/commands/update.md`) tells the agent to fetch [docs/prompts/update.md](docs/prompts/update.md) and follow it. The update prompt:

- Reads current `kit_version` from your manifest.
- Fetches `docs/migration/changelog.yaml` and computes the migration path.
- Shows you breaking changes, new manifest fields, files to be overwritten.
- After confirmation, re-renders all kit-managed files in **merge mode** (overwrite kit-managed; never touch `.vault/concepts/**`, `.vault/reference/**`, `.planning/CURRENT.md`, etc.).
- Bumps `kit_version`, appends new manifest fields with documented defaults.
- Verifies (9 agents, JSON validity, no literal API keys, smoke `compile_command`).

You can also paste the update prompt directly without `/update`:

```
Fetch and follow:
  https://raw.githubusercontent.com/<USER>/ai-agent-kit/main/docs/prompts/update.md
```

---

## Available profiles

| Profile | Category | What it sets |
|---|---|---|
| `kotlin-multiplatform` | stack | KMP — Compose Desktop + Android + iOS + Ktor; `./gradlew`, detekt+ktlint, kotlin-lsp, serena |
| `minecraft-paper-plugin` | stack | Minecraft Paper plugin (Kotlin / Gradle KTS, multi-module) |
| `generic` | stack | Language-agnostic baseline — fill `build_command`/`compile_command`/`test_command` manually |
| `ollama-cloud` | provider | Ollama Cloud LLMs (kimi-k2, qwen3-coder, deepseek-v4) |
| `requirements-pipeline` | capability | Adds the AI requirements pipeline agents and the `/requirements-pipeline` command |

Combine in your manifest:

```yaml
stack:
  profiles: [kotlin-multiplatform, requirements-pipeline, ollama-cloud]
```

---

## Agent roster

### Always present (10 base agents)

| Agent | Role |
|---|---|
| `@Main` | Orchestrator — your single entry point. Runs FEATURE / BUG / TECH pipelines. |
| `@CodeWriter` | Implements code stage by stage. |
| `@CodeReviewer` | Read-only review after each CodeWriter stage. |
| `@BugFixer` | Root-cause analysis + fix + regression test + updates test-cases.md. |
| `@debugger` | Read-only investigation — produces failing test for complex bugs. |
| `@QA` | Owns `<feature>-test-cases.md` (REQUIREMENTS phase creates, IMPLEMENTATION phase appends). |
| `@TestRunner` | Operates on test-cases.md (SCAN / EXECUTE / RERUN / APPEND). |
| `@Designer` | UI/UX description for visual features (read-only). Optional: omit by setting `models.designer: null`. |
| `@PromptEngineer` | Maintains agent prompts and skills. |
| `@AutoApprover` | Automated plan gatekeeper when `AUTO_APPROVE=true`. |

### Requirements-pipeline profile (5 additional)

`@BusinessAnalyst`, `@CornerCaseReviewer`, `@SystemAnalyst`, `@CoverageChecker`, `@ConsistencyChecker`. Invoked automatically by `@Main` via the `requirements-pipeline` skill — never selected manually.

---

## Bug-fix workflow with the living test-cases file

The test-cases file at `.vault/reference/<module>/test-cases/<feature>-test-cases.md` is your control panel for what's working and what isn't:

1. As you test the feature manually, change the **Status** column for each row: `⏸` → `✅` or `❌`. Add Notes if helpful.
2. If you find a bug not covered by an existing TC, **add a new row** with `Status: ❌` and Notes describing the symptom.
3. Run `/fix` (no arguments). It dispatches `@TestRunner SCAN`, lists all `❌`/`⏸` rows (including your additions), and asks which to fix.
4. For each chosen TC, the BUG pipeline runs: `@BugFixer` analyzes, fixes, runs `@CodeReviewer`, builds, updates the file (Status `❌`→`✅`, Defects log `🔴`→`🟢`), commits, writes a report. Then `@TestRunner RERUN` re-verifies with you (`🟢` → `✅ Verified`).
5. You can also run `/fix TC-05` to fix one specific row, or `/fix "login crashes when email has +"` to add a new TC and fix it in one step.

You never have to leave the markdown file — it's the source of truth.

---

## Extending

### Add a stack profile

1. Create `profiles/<your-stack>.yaml`. Include front-matter keys: `_profile_name`, `_profile_description`, `_profile_category: stack` (or `provider` / `capability`).
2. Set the same fields a stack profile is expected to set — most importantly `stack.language`, `stack.build_command`, `stack.compile_command`, `stack.lint_command`, `stack.test_command`, plus optional `lsp`, `formatter`, `code_quality.forbidden_patterns`, `mcp` defaults.
3. Reference it in a manifest: `stack.profiles: [<your-stack>, ...]`.

### Add an agent

1. Create `kit/.opencode/agents/<YourAgent>.md.template`. Use any existing agent file as a starting point. Include front-matter (`description`, `mode`, `model: {{PROVIDER_ID}}/{{...}}`, `temperature`, `permission`).
2. If the agent is part of a pipeline, reference it from `kit/.opencode/agents/Main.md.template` or from a skill in `kit/.opencode/skills/`.
3. Run `find kit -type f ! -name "_index.txt" | sort > kit/_index.txt` to refresh the index. Commit.

### Add a skill

1. Create `kit/.opencode/skills/<your-skill>/SKILL.md`. Use any existing skill as a starting point.
2. Reference it from `Main.md.template` (or wherever it should be invoked).
3. Refresh `kit/_index.txt`. Commit.

### Customize an agent for one project (post-install)

After install, the kit files live in your target project. Edit `<target>/.opencode/agents/<X>.md` directly. Just remember `/update` will overwrite kit-managed files in merge mode — commit your edits first, and re-apply them after each upgrade (or use `git diff` after `/update` to spot what was overwritten).

---

## Repository layout

```
ai-agent-kit/
├── README.md                              # this file
├── manifest.example.yaml                  # copy & edit for your project
├── docs/
│   ├── prompts/
│   │   ├── setup.md                       # AI-driven install (no scripts)
│   │   └── update.md                      # AI-driven update (no scripts)
│   └── migration/changelog.yaml           # version history + breaking changes + new fields
├── profiles/                              # stack/provider/capability profiles
│   ├── kotlin-multiplatform.yaml
│   ├── minecraft-paper-plugin.yaml
│   ├── generic.yaml
│   ├── ollama-cloud.yaml
│   └── requirements-pipeline.yaml
└── kit/                                   # everything that gets rendered into your project
    ├── _index.txt                         # complete file list — AI reads this to know what to fetch
    ├── manifest.schema.json               # JSON Schema for validating manifests
    ├── AGENTS.md.template
    ├── AUTO_MEMORY.md.template
    ├── opencode.json.template
    ├── nested/AGENTS.md.nested.template   # rendered per-module
    ├── editors/opencode/CLAUDE.md.template
    ├── .opencode/
    │   ├── agents/        (15 .md.template — 10 base + 5 requirements-pipeline)
    │   ├── commands/      (11 — /new-feature, /fix, /requirements-pipeline, /review, /deploy, /update, ...)
    │   ├── skills/        (8 — bug-retro, code-review-checklist, requirements-pipeline, ...)
    │   ├── i18n/{en,ru}.yaml
    │   ├── sessions/SESSIONS.md.template
    │   ├── _shared.md.template
    │   └── FILE_STRUCTURE.md.template
    ├── .planning/{CURRENT,DECISIONS}.md.template
    └── .vault/
        ├── _INDEX.md.template
        └── _templates/{bug-report,requirements,spec,test-cases,test-plan}.md
```

---

## Security

- API keys are referenced by **environment variable name only** in the manifest (e.g. `api_key_env: ROUTERAI_OPENCODE`). The actual key is never written into any file. Setup and update prompts both refuse to proceed if a literal-looking key is detected.
- The post-install verifier checks `opencode.json` for any literal key (matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy) and aborts with a clear message if one is found.
- Path-escape protection: target paths are resolved and checked to start with the target directory before write.

---

## License

(Inherit from your fork or set as you wish. The original opencode-kit is hosted at https://github.com/aequicor/opencode-kit.)
