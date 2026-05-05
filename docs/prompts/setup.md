# ai-agent-kit — installation prompt (no clone, no scripts)

You are an AI agent applying ai-agent-kit to a target project. Your only job is to follow this script exactly. Do not skip steps. Do not guess values. Do not run any external scripts.

> **No Python, no JDK, no curl-jar.** Everything is done with your own tools: WebFetch (or equivalent fetch), Read, Edit, Write. You parse YAML/JSON yourself and substitute `{{VAR}}` placeholders yourself.

---

## Constants used below

- `KIT_REPO` = the GitHub `<user>/<repo>` slug of the kit you are installing from. You can read it from the URL of the prompt you fetched. Example: if you were told to fetch `https://raw.githubusercontent.com/example-org/ai-agent-kit/master/docs/prompts/setup.md`, then `KIT_REPO = example-org/ai-agent-kit`.
- `RAW_BASE` = `https://raw.githubusercontent.com/{KIT_REPO}/master`

---

## PHASE 1 — Q&A

Ask PO every question below in a numbered list. Wait for ALL answers before proceeding. Defaults shown in `[brackets]`.

### 1. Target

- **Q1.** Target project absolute path. *Required, no default.* The kit will be applied INTO this directory. Verify it exists.

### 2. Project

- **Q2.** Project name `[default: "My Project"]`
- **Q3.** One-line description `[default: ""]`

### 2b. Knowledge vault

- **Q3b.** Vault path (relative to project root) `[default: vault]`. This is the root folder where KnowledgeOS stores all agent-generated documentation (requirements, specs, test cases, guidelines, etc.). KnowledgeOS default is `vault`. Legacy ai-agent-kit installs used `.vault` — enter `.vault` if migrating from that setup.

### 3. Profiles (axis-based)

Profiles are organised into four orthogonal **axes**. Each profile declares `_profile_axis` and is allowed to populate only fields owned by that axis, so cross-axis selections cannot overwrite each other.

| Axis | Cardinality | Owns | Examples |
|------|------------|------|----------|
| `language` | exactly 1 | `stack` commands, `lsp`, `formatter`, `mcp.serena` | `kotlin-gradle`, `make-generic` |
| `framework` | 0..N | `ui`, `code_quality.forbidden_patterns` (list-add) | `compose-multiplatform`, `paper-plugin` |
| `provider` | exactly 1 | `provider`, `models` | `routerai`, `ollama-cloud` |
| `capability` | 0..N (always includes `security-baseline`) | `code_quality.forbidden_patterns` (list-add); may wire agents via skills | `security-baseline`, `solid`, `requirements-pipeline` |

Fetch the live profile list: `RAW_BASE/profiles/` directory listing via GitHub API:
`https://api.github.com/repos/{KIT_REPO}/contents/profiles`. For each `.yaml`, fetch and parse only the front-matter (`_profile_name`, `_profile_description`, `_profile_axis`). Group into the four axes when presenting to PO.

If the API fetch fails, use this hardcoded grouping:
- **language:** `kotlin-gradle`, `make-generic`
- **framework:** `compose-multiplatform`, `paper-plugin`
- **provider:** `routerai`, `ollama-cloud`
- **capability:** `security-baseline` (always-on), `solid`, `requirements-pipeline`

Before asking Q4a, **auto-detect a smart default for the language axis**:
- If `<target>/settings.gradle.kts` or `<target>/build.gradle.kts` exists → default is `kotlin-gradle`.
- Otherwise → default is `make-generic`.

Ask one question per axis:

- **Q4a (language).** Pick exactly one. `[default: <auto-detected>]`
- **Q4b (framework).** Pick zero or more (comma-separated). `[default: empty]`. Recommended pairings: `kotlin-gradle + compose-multiplatform` for KMP apps; `kotlin-gradle + paper-plugin` for Minecraft Paper plugins.
- **Q4c (provider).** Pick exactly one. `[default: routerai]`
- **Q4d (capability).** Pick zero or more (comma-separated). `[default: security-baseline]`. `security-baseline` is included automatically even if you leave the field empty.

**Validation (before continuing):** count selections per axis. If `language` ≠ 1 or `provider` ≠ 1 → re-ask Q4a/Q4c (max 3 retries). If `security-baseline` is missing from the capability list → silently prepend it.

### 4. Build commands

Only ask if the chosen language profile is `make-generic` OR PO wants overrides:
- **Q5.** Build command `[from language profile]`
- **Q6.** Compile command `[from language profile]`
- **Q7.** Lint command `[from language profile]`
- **Q8.** Test command `[from language profile]` — for Gradle, must contain literal `[module]` placeholder, e.g. `./gradlew :[module]:test`.

### 5. Modules

Explain: a module = logical unit with own source root and test root.

- **Q9.** Module count `[default: 2]`
- For each module, ask:
  - a) Name (snake-ish identifier, e.g. `server`, `client`) — *required*
  - b) Gradle path (e.g. `:server`, `:composeApp`). Write `null` if not Gradle. `[default: ":<name>"]`
  - c) Source root (e.g. `server/src/main/kotlin/com/example/`) — *required*
  - d) Test root (e.g. `server/src/test/kotlin/com/example/`) — *required*
  - e) Docs path `[default: "<vault_path>/<name>/" (using the vault_path from Q3b)]`
  - f) Responsibility (one line) `[default: ""]`

If `<target>/settings.gradle.kts` or `build.gradle.kts` exists, read it and propose module names automatically.

### 6. Provider

- **Q10.** Provider display name `[default: "routerai"]`
- **Q11.** Provider base URL (OpenAI-compatible) `[default: https://routerai.ru/api/v1]`
- **Q12.** API key env var **NAME** (NEVER the actual key) `[default: ROUTERAI_OPENCODE]`

### 7. Models

- **Q13.** Default model (orchestrator @Main) `[default: moonshotai/kimi-k2.6]`
- **Q14.** Coder model (@CodeWriter, @BugFixer, @debugger, @QA) `[default: qwen/qwen3-coder-next]`
- **Q15.** Reviewer model (@CodeReviewer, @PromptEngineer) `[default: deepseek/deepseek-v4-pro]`
- **Q16.** Designer model (@Designer) `[default: openai/gpt-5.4, or "null" to disable Designer]`
- **Q17.** Small model (lightweight tasks) `[default: same as coder]`

### 8. MCP integrations

- **Q18.** Enable `context7`? `[default: yes]`. If yes → **Q18a.** API key env var name `[default: CONTEXT7_API_KEY]`.
- **Q19.** Enable `knowledge-my-app` (KnowledgeOS)? `[default: yes]`. If yes → **Q19a.** URL `[default: http://localhost:8085/mcp]`.
- **Q20.** Enable `serena` (semantic code nav, JVM-focused)? `[default: from language profile]`.

### 9. LSP

- **Q21.** Enable LSP? `[default: from language profile]`. If yes → **Q22.** LSP command `[default: kotlin-lsp for Kotlin]`. **Q23.** Extensions `[default: .kt, .kts]`.

### 10. UI / Designer

- **Q24.** UI framework name `[default: from framework profile, or "null" to omit Designer]`
- **Q25.** Target platforms `[default: from framework profile]`
- **Q26.** Color palette: ask "Do you have a design system?" If yes, for each color: name, HEX, purpose.

### 11. Code quality

- **Q27.** Forbidden patterns: show the **union** of `code_quality.forbidden_patterns` from every selected profile (deduplicated, preserving order). Ask "use these?" If no, collect a custom list.

### 12. Formatter

- **Q28.** Enable formatter? `[default: from language profile]`. If yes → **Q29.** Name. **Q30.** Command (list). **Q31.** Extensions.

---

## PHASE 2 — Build manifest

### 2.1. Fetch profile YAMLs and validate axes

For each chosen profile name:
- Fetch `RAW_BASE/profiles/<name>.yaml` and parse it.
- Read `_profile_axis`. If missing or not in `{language, framework, provider, capability}` → STOP, report "profile <name> has no valid `_profile_axis`".
- Validate the profile against `RAW_BASE/kit/profile.schema.json` (axis-specific allowed keys). If a profile populates a field outside its axis (e.g. a `provider`-axis profile sets `lsp`) → STOP and report which key violates the contract.

**Cardinality check:**
- exactly one `language` profile selected, exactly one `provider` profile selected.
- `framework` and `capability` may be 0..N.
- If the `capability` list does not include `security-baseline`, prepend it silently.

If cardinality fails → re-ask Q4a / Q4c.

### 2.1.1. Axis-aware merge

Because every profile is restricted to its axis-owned keys (per `profile.schema.json`), profiles from **different** axes cannot collide on any field — they always fill disjoint slots. Profiles within the same axis follow these rules:

- `language` and `provider` axes have cardinality 1 → no within-axis merging needed.
- `framework` and `capability` axes only ever populate `code_quality.forbidden_patterns` (and `framework` may set `ui`); their lists merge by **concat + dedupe**.

**Merge algorithm** (run in this fixed order so the result is deterministic regardless of how PO listed profiles in Q4a–d):

1. Start with `merged = {}`.
2. Apply the chosen `language` profile (whole-tree).
3. Apply the chosen `provider` profile (whole-tree).
4. For each `framework` profile in selection order: deep-merge into `merged`.
5. For each `capability` profile in selection order (with `security-baseline` first): deep-merge into `merged`.

**Deep-merge algorithm** (apply recursively):
- If both sides are **maps**: for each key in either side, recurse on the values; missing keys are added as-is.
- If both sides are **lists**: concatenate, then deduplicate while preserving order.
- Otherwise: if `merged` already has a non-null scalar value for that key, raise an error — this means two profiles claimed the same field, which is a contract violation that should have been caught by `profile.schema.json`. STOP and report it (do not silently let "right side win" — that was the old bug).

### 2.2. Apply PO answers on top of profile defaults

`final_manifest = deep_merge(merged_profiles, po_answers_as_manifest_shape)`.

Map PO answers into manifest structure:

```yaml
kit_version: "2.0.0"
editors: [opencode]
project:
  name: <Q2>
  description: <Q3>
vault_path: <Q3b or "vault">
stack:
  language: <from chosen language profile or PO override>
  profiles: [<chosen profile list — language first, then provider, then framework(s), then capability(ies)>]
  build_command: <Q5 or language profile>
  compile_command: <Q6 or language profile>
  lint_command: <Q7 or language profile>
  test_command: <Q8 or language profile>
modules:
  - name: <Q9.a>
    gradle_module: <Q9.b or null>
    source_root: <Q9.c>
    test_root: <Q9.d>
    docs_path: <Q9.e>
    responsibility: <Q9.f>
  # ... per module
provider:
  name: <Q10>
  base_url: <Q11>
  api_key_env: <Q12>
models:
  default: <Q13>
  coder: <Q14>
  reviewer: <Q15>
  designer: <Q16 or null>
  small: <Q17>
mcp:
  context7: { enabled: <Q18>, api_key_env: <Q18a> }
  knowledge: { enabled: <Q19>, url: <Q19a> }
  serena: { enabled: <Q20> }
lsp:
  enabled: <Q21>
  command: <Q22>
  extensions: [<Q23 split>]
ui:
  framework: <Q24 or null>
  platforms: [<Q25 split>]
  colors: [<Q26 list>]
code_quality:
  forbidden_patterns: [<Q27 list>]
formatter:
  enabled: <Q28>
  name: <Q29>
  command: [<Q30>]
  extensions: [<Q31>]
```

### 2.3. Validate manifest against schema

Per-profile axis validation already ran in 2.1 against `kit/profile.schema.json`. This step validates the **assembled** manifest.

Fetch `RAW_BASE/kit/manifest.schema.json`. Parse. Validate `final_manifest`:
- All `required` fields present and non-empty.
- All field types match.
- All regex `pattern` constraints match (e.g. `kit_version` must match `^\d+\.\d+\.\d+$`).
- All `enum` values valid (e.g. `editors[]` items ∈ `["opencode"]`).

If validation fails — show PO the errors and re-ask only the relevant questions. Do not proceed.

### 2.4. Security checks (manifest hygiene)

Refuse to proceed if any of these match:
- `provider.api_key_env` looks like a real key: matches `^(sk|ghp|ghs|glpat|xoxp|xoxb)-` or `^AKIA[0-9A-Z]{16}$` or is 32+ chars containing letters+digits+special chars (high entropy).
- `mcp.context7.api_key_env` same check.

If matched: STOP, tell PO "Security: that looks like an actual key. Use the env-var **name** instead, e.g. `ROUTERAI_OPENCODE`. Set the value via `export ROUTERAI_OPENCODE=...` in your shell."

### 2.5. Show, confirm, write

Print the assembled manifest as YAML. Ask: "Does this look correct? (yes / no / edit X)". Loop until PO confirms. Write it to `<target>/<project-slug>.yaml`.

---

## PHASE 3 — Render & write

### 3.1. Build the rendering context

Compute these `{{VAR}} → value` pairs from the manifest. **Many are computed (tables, blocks), not just copied** — implement each rule below faithfully.

| Variable | Source / rule |
|---|---|
| `KIT_REPO` | The `<user>/<repo>` slug of the kit source. |
| `VAULT_PATH` | `manifest.vault_path` (default `vault` — matches KnowledgeOS default). No trailing slash. |
| `PROJECT_NAME` | `manifest.project.name` |
| `PROJECT_DESCRIPTION` | `manifest.project.description` |
| `STACK_DESCRIPTION` | `"<project-name> — <language> stack"` |
| `BUILD_COMMAND` | `manifest.stack.build_command` |
| `COMPILE_COMMAND` | `manifest.stack.compile_command` |
| `LINT_COMMAND` | `manifest.stack.lint_command` |
| `TEST_COMMAND_TEMPLATE` | `manifest.stack.test_command` (keep `[module]` literal placeholder) |
| `MODULE_NAMES_LIST` | `" / ".join(m.name for m in modules)` |
| `MODULE_TABLE` | Markdown table — see rule M1 below |
| `MODULE_SOURCE_TABLE` | Markdown table — see rule M2 |
| `MODULE_TEST_TABLE` | Markdown table — see rule M3 |
| `MODULE_BUILD_COMMANDS` | One line per module — see rule M4 |
| `MODULE_DOCS_LIST` | `\n`-joined `- \`<docs_path>\`` per module |
| `PROVIDER_ID` | `provider.name.lower().replace(" ", "_").replace("-", "_")` |
| `PROVIDER_NAME` | `provider.name` |
| `PROVIDER_BASE_URL` | `provider.base_url` |
| `PROVIDER_API_KEY_ENV` | `provider.api_key_env` |
| `DEFAULT_MODEL` | `models.default` |
| `CODER_MODEL` | `models.coder` |
| `REVIEWER_MODEL` | `models.reviewer` |
| `DESIGNER_MODEL` | `models.designer` (fallback to `coder` if null) |
| `SMALL_MODEL` | `models.small` (fallback to `coder` if missing) |
| `ISO_TIMESTAMP_PLACEHOLDER` | Current UTC time as `YYYY-MM-DDTHH:MM:SSZ` |
| `CONTEXT7_ENABLED` | `"true"` / `"false"` (lowercase) |
| `CONTEXT7_API_KEY_ENV` | `mcp.context7.api_key_env` (default `CONTEXT7_API_KEY`) |
| `KNOWLEDGE_ENABLED` | `"true"` / `"false"` |
| `KNOWLEDGE_URL` | `mcp.knowledge.url` |
| `SERENA_ENABLED` | `"true"` / `"false"` |
| `LSP_BLOCK` | JSON block — see rule B1 |
| `UI_FRAMEWORK` | `ui.framework` (or empty) |
| `PLATFORMS` | `", ".join(ui.platforms)` |
| `COLOR_TABLE` | Markdown table — see rule M5 |
| `FORBIDDEN_PATTERNS_LIST` | `\n`-joined `- <pattern>` |
| `FORMATTER_BLOCK` | JSON block — see rule B2 |
| `FORMATTER_HOOK_COMMAND` | `" ".join(formatter.command)` if enabled, else `"echo"` |
| `DEPENDENCY_FILES_LIST` | One-line description from rule D1 |
| `EVAL_GLOB_EXTENSIONS` | quoted comma-list of LSP extensions (or `"*"`) |
| `CURSOR_GLOB_EXTENSIONS` | quoted comma-list per language (only used for cursor editor — skip if editor not selected) |

#### Rule M1 — `MODULE_TABLE`
```
| Module | Gradle module | Docs | Responsibility |
|--------|---------------|------|----------------|
| `<name>` | `<gradle or "—">` | `<docs_path with trailing />` | <responsibility> |
... per module
```

#### Rule M2 — `MODULE_SOURCE_TABLE`
```
| Module | Gradle task | Source root |
|--------|-------------|-------------|
| <name> | `<gradle or "—">` | `<source_root>` |
```

#### Rule M3 — `MODULE_TEST_TABLE`
```
| Module | Test root |
|--------|----------|
| `<name>` | `<test_root>` |
```

#### Rule M4 — `MODULE_BUILD_COMMANDS`
For each module: if `gradle_module` set → line `<build_command> <gradle_module>:build`; otherwise → comment `# build command for <name>: <build_command> build`. Join with `\n`.

#### Rule M5 — `COLOR_TABLE`
If colors empty → output a placeholder table with one stub row.
Else:
```
| Color | HEX | Purpose |
|-------|-----|---------|
| <name> | `<hex>` | <purpose> |
```

#### Rule B1 — `LSP_BLOCK`
If `lsp.enabled == false` → empty string `""`.
Else:
```json
  "lsp": {
    "<lang>": {
      "command": [
        "<lsp.command>"
      ],
      "extensions": [
        "<ext1>", "<ext2>"
      ]
    }
  },
```
where `<lang> = lsp.command stripped of "-lsp" / "_lsp" suffix, or "default"`.

#### Rule B2 — `FORMATTER_BLOCK`
If `formatter.enabled == false` → empty string.
Else:
```json
  "formatter": {
    "<formatter.name>": {
      "command": ["<cmd1>", "<cmd2>", ...],
      "extensions": ["<ext1>", "<ext2>"]
    }
  },
```

#### Rule D1 — `DEPENDENCY_FILES_LIST`
By language:
- `kotlin` / `java` → `- \`gradle/libs.versions.toml\` (if exists) or \`build.gradle.kts\` deps`
- `python` → `- \`requirements.txt\` / \`pyproject.toml\` dependencies`
- `typescript` → `- \`package.json\` dependencies + devDependencies`
- `go` → `- \`go.mod\` dependencies`
- `rust` → `- \`Cargo.toml\` dependencies`
- otherwise → `- Primary dependency manifest file`

### 3.2. Discover all kit files

Fetch `RAW_BASE/kit/_index.txt`. Each line is a relative path under the repo root, e.g. `kit/.opencode/agents/Main.md.template`. Iterate over them.

### 3.3. Filter out other-editor files

For each path:
- If it starts with `kit/editors/<X>/` and `X NOT IN manifest.editors` → SKIP.
- The kit ships only with `editors/opencode/` — other editor paths shouldn't appear, but check defensively.

### 3.4. Compute target path for each kit file

Given `kit/<rel-path-inside-kit>`:
1. Drop the leading `kit/` segment.
2. If the remaining path starts with `editors/<editor>/` → drop those two segments (so `editors/opencode/CLAUDE.md.template` becomes `CLAUDE.md.template`).
3. If the path starts with `nested/` → SKIP for the base scaffold (handled separately in step 3.6).
4. If the remaining path starts with `.vault/` → replace the `.vault/` prefix with `{manifest.vault_path}/` (e.g. if `vault_path = vault`, then `.vault/_INDEX.md.template` → `vault/_INDEX.md.template`). This makes the vault location configurable. Default produces `vault/`.
5. If the basename ends with `.template` → drop the `.template` suffix.
6. Final target = `<target-dir>/<resulting-relative-path>`.

**Path-escape guard:** resolve the absolute target path; if it does not start with the absolute target directory, SKIP and warn PO.

### 3.5. Render and write each file

For each file path from the index (after filtering and target-path computation):

1. Fetch raw content from `RAW_BASE/<original kit path>`.
2. **Always** scan content for `{{VARNAME}}` patterns (regex `\{\{[A-Z_]+\}\}`) and substitute from the rendering context. This applies to ALL files — `.template` suffix only controls the output filename, not whether to render.
3. After substitution, scan once more for any remaining `{{[A-Z_]+}}` — if found, collect them as "unresolved placeholders" and report at the end (do not fail; PO can fill them manually).
4. Write the rendered content to the target path. Use Edit-or-Write tool to create parent directories as needed.

**Skip logic:** if the target file already exists and PO has not requested merge mode, SKIP it. (Fresh install assumes empty target — if any kit-managed file pre-exists, ask PO whether to overwrite.)

### 3.6. Render nested AGENTS.md per module

The file `kit/nested/AGENTS.md.nested.template` is a per-module template. For each module:
- Build a per-module context with these extra variables (overriding any same-named ones):
  - `MODULE_NAME` = `m.name`
  - `MODULE_SOURCE_ROOT` = `m.source_root`
  - `MODULE_TEST_ROOT` = `m.test_root`
  - `MODULE_RESPONSIBILITY` = `m.responsibility`
  - `MODULE_GRADLE_LINE` = if `m.gradle_module` → ``"**Gradle module:** `<gradle_module>`"`` else `"**Gradle:** (not a Gradle project)"`
  - `MODULE_BUILD_TABLE` = three rows derived from build_command and gradle_module (see rule below)
  - `MODULE_CONVENTIONS` = `m.conventions` or `"(use project-default conventions from root AGENTS.md)"`
  - `MODULE_DEPENDENCIES` = `- \`<m.name>\`: <m.module_dependencies or "(none specified)">`
  - `MODULE_DOCS_PATH` = `m.docs_path` (or `{VAULT_PATH}/<m.name>/`)
- Render the template with this context.
- Write to `<target>/<source_root>/AGENTS.md`. Apply the path-escape guard.
- If the target AGENTS.md already exists, SKIP (do not overwrite without merge confirmation).

**`MODULE_BUILD_TABLE` rule:** If `gradle_module` is set, three lines:
```
| `<build_command> <gradle_module>:build` | Build this module |
| `<build_command> <gradle_module>:test` | Run tests |
| `<build_command> <gradle_module>:compileKotlin` | Quick compile |
```
Else:
```
| `<build_command>` | Build project |
| `<test_command>` | Run tests |
| `<compile_command>` | Quick compile |
```

### 3.7. Create vault scaffold

For each module, create directories and an empty `.gitkeep` in each.

The docs root for each module is `<target>/<m.docs_path>`. If `docs_path` was not explicitly set, default to `<target>/{VAULT_PATH}/<m.name>/` (e.g. `vault/server/`).

All genre subdirs are created **relative to the vault root** (`<target>/{VAULT_PATH}/`), not relative to the per-module docs path:
- `concepts/<module-name>/{requirements, plans}/`
- `reference/<module-name>/{spec, test-cases}/` *(test-cases/ is the home of the living test-cases.md — important)*
- `how-to/<module-name>/plans/`
- `tutorials/<module-name>/documentation/`
- `guidelines/<module-name>/reports/`

Plus `<target>/{VAULT_PATH}/guidelines/libs/.gitkeep`.

> **Note:** the original opencode-kit subdir map did not include `test-cases` under `reference/`. ai-agent-kit adds it because the living `<feature>-test-cases.md` lives there.

---

## PHASE 4 — Verify

1. **Mandatory agents.** Check that all 9 base agents exist in `<target>/.opencode/agents/`:
   `Main.md, CodeWriter.md, CodeReviewer.md, BugFixer.md, debugger.md, QA.md, Designer.md, PromptEngineer.md, AutoApprover.md`.
   Designer.md may be absent if `models.designer == null` — that's OK.
   If the `requirements-pipeline` profile was selected, additionally check: `BusinessAnalyst.md, CornerCaseReviewer.md, SystemAnalyst.md, CoverageChecker.md, ConsistencyChecker.md`.
   `RequirementsQA.md` should NOT exist (it has been merged into `QA.md`).

2. **`opencode.json` is valid JSON.** Read it. Parse with a JSON parser. If parse fails — STOP, ask PO whether to retry.

3. **No literal API keys in `opencode.json`.** Search the file recursively for any string that looks like a real key (regexes from PHASE 2.4). The only acceptable token format is `{env:VAR_NAME}`. If a literal key is found — STOP and warn PO: "SECURITY: literal API key detected at `<path>`. Fix immediately."

4. **No unresolved `{{...}}` placeholders.** Grep the entire target directory for `\{\{[A-Z_]+\}\}`. If matches found, list them by file. Tell PO they need to be filled manually.

5. **Living test-cases path.** Confirm that the directory `<target>/{VAULT_PATH}/reference/<first-module>/test-cases/` exists (where `VAULT_PATH = manifest.vault_path`, default `vault`). Create the `.gitkeep` if it doesn't.

---

## PHASE 5 — Env vars reminder

Print exactly:

```
═══════════════════════════════════════════════════
ai-agent-kit APPLIED SUCCESSFULLY
═══════════════════════════════════════════════════

Files created in <target>:
  <list of files>

Before running opencode, set these environment variables:
  export <PROVIDER_API_KEY_ENV>=<your_api_key>
  export <CONTEXT7_API_KEY_ENV>=<your_context7_key>   (if context7 enabled)

Quick start:
  cd <target>
  export <PROVIDER_API_KEY_ENV>=<your_api_key>
  opencode         # launches with @Main orchestrator

Three commands to know:
  /requirements-pipeline "<feature>"   — generates requirements + spec + the living test-cases.md
  /new-feature           "<feature>"   — runs full FEATURE pipeline (uses pre-made spec if present)
  /fix                   [TC-id|text]  — works on the living test-cases.md (scans, fixes, re-verifies)

If any TODO fields remain in the manifest or unresolved {{...}} placeholders were reported, fix them before relying on agents.

Report back a summary of what was done.
```

---

## Stop conditions

- **Manifest validation fails 3 times in a row** → STOP, ask PO to inspect the manifest manually.
- **Profile axis contract violated** (a profile sets a field outside its axis, or two profiles in the merge claim the same scalar field) → STOP, report which profile and which key.
- **Cardinality violated** (zero or multiple language/provider profiles after Q4a–c) → re-ask the relevant axis question, max 3 retries, then STOP.
- **A kit file 404s when fetched** → STOP, report the exact URL and ask PO whether the kit has been published yet at the expected `KIT_REPO`.
- **A literal API key is detected anywhere** → STOP immediately, warn PO.
- **Target directory is non-empty AND contains a `.opencode/` directory already** → STOP, warn PO that this is a fresh install path. Suggest `/update` from inside the existing kit instead.
