# ai-agent-kit — installation prompt (no clone, no scripts)

You are an AI agent applying ai-agent-kit to a target project. Your only job is to follow this script exactly. Do not skip steps. Do not guess values. Do not run any external scripts.

> **No Python, no JDK, no curl-jar.** Everything is done with your own tools: WebFetch (or equivalent fetch), Read, Edit, Write. You parse YAML/JSON yourself, resolve `{{INCLUDE: <path>}}` directives yourself, and substitute `{{VAR}}` placeholders yourself.

---

## Constants used below

- `KIT_REPO` = the GitHub `<user>/<repo>` slug of the kit you are installing from. You can read it from the URL of the prompt you fetched. Example: if you were told to fetch `https://raw.githubusercontent.com/example-org/ai-agent-kit/master/docs/prompts/setup.md`, then `KIT_REPO = example-org/ai-agent-kit`.
- `RAW_BASE` = `https://raw.githubusercontent.com/{KIT_REPO}/master`

---

## PHASE 0 — Setup language (ask BEFORE anything else)

Before any Q&A, ask PO which language to use for the rest of the setup conversation. This single answer drives two things:

1. **Interaction language for the rest of this setup run.** Every question label, default hint, validation error, table heading, status update, confirmation prompt, and final summary you emit from PHASE 1 onwards MUST be rendered in this language.
2. **`manifest.language_code`** — the same value is stored in the manifest and propagated to installed agents (PHASE 2.2 maps it as `<Q0>`), so agents will use it for their user-facing messages too.

Because at this point you don't yet know PO's language, the question itself is bilingual. Emit it verbatim:

```
Q0. Language / Язык [default: en]
  - en — English
  - ru — Russian / Русский

  Setup will continue in the chosen language, and installed agents will use it for their user-facing output.
  Настройка продолжится на выбранном языке, и установленные агенты будут использовать его для пользовательских сообщений.
```

Map answers liberally:
- `en`, `english`, `англ`, `English` → `en`
- `ru`, `russian`, `русский`, `ру`, `Русский` → `ru`
- Any other input → re-ask once with the bilingual prompt above, then on the second miss default to `en` and tell PO: "Defaulted to English — you can rerun setup or edit `language_code` in the manifest to change this."

Once PO has answered:
- Store the resolved code as `Q0_ANSWER` (`en` or `ru`).
- **Switch to that language for ALL subsequent output for the remainder of this run** — every PHASE 1 question, every PHASE 2/3/4 status line, every error, every confirmation, every summary in PHASE 5.
- Internal field names (manifest keys, profile names, axis names like `language`/`framework`/`host`/`provider`/`capability`, command names like `/kit-update`, file paths, env-var names, model IDs, regex patterns) stay in English exactly as written below — only the natural-language wrapping around them is translated. Code blocks, YAML samples, tables of profile names, and schema fragments are NOT translated.
- The defaults shown in `[brackets]` (e.g. `[default: en]`, `[default: routerai]`) keep their values verbatim in English; only the word "default" itself may be translated.

If `Q0_ANSWER == ru`, treat the question texts in PHASE 1 below as a guide to **meaning**, not a literal script — render each question to PO in idiomatic Russian, preserving all technical tokens, defaults, and the question identifier (e.g. `Q4a`, `Q9`).

---

## PHASE 1 — Q&A

Ask PO every question below in a numbered list. Wait for ALL answers before proceeding. Defaults shown in `[brackets]`.

> **Reminder:** every question label and explanation you emit must be in the language chosen in PHASE 0 (`Q0_ANSWER`). The English text below is the source of truth for *content*; translate it to Russian if `Q0_ANSWER == ru`. Technical tokens (manifest keys, profile names, defaults, paths, env vars, model IDs) stay in English.

### 1. Target

- **Q1.** Target project absolute path. *Required, no default.* The kit will be applied INTO this directory. Verify it exists.

### 2. Project

- **Q2.** Project name `[default: "My Project"]`
- **Q3.** One-line description `[default: ""]`

### 2b. Knowledge vault

- **Q3b.** Vault path (relative to project root) `[default: vault]`. This is the root folder where KnowledgeOS stores all agent-generated documentation (requirements, specs, test cases, guidelines, etc.). KnowledgeOS default is `vault`. Legacy ai-agent-kit installs used `.vault` — enter `.vault` if migrating from that setup.

### 3. Profiles (axis-based)

Profiles are organised into five orthogonal **axes**. Each profile declares `_profile_axis` and is allowed to populate only fields owned by that axis, so cross-axis selections cannot overwrite each other.

| Axis | Cardinality | Owns | Examples |
|------|------------|------|----------|
| `language` | exactly 1 | `stack` commands, `lsp`, `formatter`, `mcp.serena` | `kotlin-gradle`, `make-generic` |
| `framework` | 0..N | `ui`, `code_quality.forbidden_patterns` (list-add) | `compose-multiplatform`, `paper-plugin` |
| `host` | 1..N | which template tree is rendered, host config file, agent frontmatter format, instruction file | `opencode`, `claude-code` |
| `provider` | exactly 1 IF `opencode` ∈ hosts, else 0 | `provider`, `models` (used only by OpenCode rendering) | `routerai`, `ollama-cloud` |
| `capability` | 0..N (always includes `security-baseline`) | `code_quality.forbidden_patterns` (list-add); may wire agents via skills | `security-baseline`, `solid`, `requirements-pipeline` |

**Profiles are organised on disk by axis:** `profiles/<axis>/<name>.yaml` (e.g. `profiles/language/kotlin-gradle.yaml`, `profiles/host/claude-code.yaml`). The directory name *is* the axis — that's how you discover a profile's axis without parsing its YAML.

Fetch the live profile inventory via the GitHub tree API (one call, recursive):
`https://api.github.com/repos/{KIT_REPO}/git/trees/master?recursive=1`. Filter entries where `path` matches `^profiles/(language|framework|host|provider|capability)/[^/]+\.yaml$`. Build a name→axis map from the path. Group by axis when presenting to PO.

If the tree fetch fails, fall back to listing each axis directory directly: `https://api.github.com/repos/{KIT_REPO}/contents/profiles/<axis>` for each of the five axes.

If both fail, use this hardcoded grouping:
- **language:** `kotlin-gradle`, `make-generic`
- **framework:** `compose-multiplatform`, `paper-plugin`
- **host:** `opencode`, `claude-code`
- **provider:** `routerai`, `ollama-cloud`
- **capability:** `security-baseline` (always-on), `solid`, `requirements-pipeline`

Before asking Q4a, **auto-detect smart defaults**:
- **Language axis.** If `<target>/settings.gradle.kts` or `<target>/build.gradle.kts` exists → default is `kotlin-gradle`. Otherwise → `make-generic`.
- **Host axis.** If `<target>/.claude/` exists or PO already uses Claude Code → default includes `claude-code`. If `<target>/.opencode/` or `<target>/opencode.json` exists → default includes `opencode`. If neither — default is `opencode` (single host). Multi-host (`opencode, claude-code`) is fully supported and renders both trees side-by-side.

Ask one question per axis (in this order):

- **Q4a (language).** Pick exactly one. `[default: <auto-detected>]`
- **Q4b (framework).** Pick zero or more (comma-separated). `[default: empty]`. Recommended pairings: `kotlin-gradle + compose-multiplatform` for KMP apps; `kotlin-gradle + paper-plugin` for Minecraft Paper plugins.
- **Q4c (host).** Pick one or more (comma-separated). `[default: <auto-detected>]`. Choose `opencode, claude-code` if the project will be edited by both runtimes simultaneously.
- **Q4d (provider).** Pick exactly one. `[default: routerai]`. **Skipped if `opencode` is NOT in your Q4c selection** — Claude Code uses Anthropic native models (set in Q17a–Q17e).
- **Q4e (capability).** Pick zero or more (comma-separated). `[default: security-baseline]`. `security-baseline` is included automatically even if you leave the field empty.

**Validation (before continuing):**
- If `language` ≠ 1 → re-ask Q4a (max 3 retries).
- If `host` < 1 → re-ask Q4c (max 3 retries).
- If `opencode` ∈ hosts and `provider` ≠ 1 → re-ask Q4d (max 3 retries).
- If `opencode` ∉ hosts → silently set `provider = []` (no provider profile applied).
- If `security-baseline` is missing from the capability list → silently prepend it.

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

### 6. Provider (OpenCode only — skip the entire section if `opencode` ∉ hosts)

- **Q10.** Provider display name `[default: "routerai"]`
- **Q11.** Provider base URL (OpenAI-compatible) `[default: https://routerai.ru/api/v1]`
- **Q12.** API key env var **NAME** (NEVER the actual key) `[default: ROUTERAI_OPENCODE]`

### 7. OpenCode models (only if `opencode` ∈ hosts)

These are the models OpenCode passes through the provider configured above. Model id strings are in `<vendor>/<name>` form (the way OpenCode/RouterAI expects them).

- **Q13.** Default model (orchestrator @Main) `[default: moonshotai/kimi-k2.6]`
- **Q14.** Coder model (@CodeWriter, @BugFixer, @debugger, @QA) `[default: qwen/qwen3-coder-next]`
- **Q15.** Reviewer model (@CodeReviewer, @PromptEngineer) `[default: deepseek/deepseek-v4-pro]`
- **Q16.** Designer model (@Designer) `[default: openai/gpt-5.4, or "null" to disable Designer]`
- **Q17.** Small model (lightweight tasks) `[default: same as coder]`

### 7b. Claude Code models (only if `claude-code` ∈ hosts)

Claude Code uses Anthropic native models. Either short aliases (`opus`, `sonnet`, `haiku`) which Claude Code resolves to the latest model in each tier, or full model IDs (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`).

- **Q17a.** Default model (orchestrator — main session role) `[default: sonnet]`
- **Q17b.** Coder model (@CodeWriter, @BugFixer, @debugger, @QA) `[default: opus]`
- **Q17c.** Reviewer model (@CodeReviewer, @PromptEngineer, etc.) `[default: opus]`
- **Q17d.** Designer model (@Designer) `[default: opus, or "null" to disable Designer]`
- **Q17e.** Small model (lightweight tasks) `[default: haiku]`

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

### 2.0. Fetch current kit version

Fetch `RAW_BASE/docs/migration/changelog.yaml` and parse as YAML. Set:

```
KIT_VERSION = versions[0].version
```

`versions[0]` is always the latest entry (newest first). This value is what gets stamped into `manifest.kit_version` in step 2.2 — never hardcode it in this prompt.

If the fetch fails on both `RAW_BASE/docs/migration/changelog.yaml` and `https://github.com/{KIT_REPO}/blob/master/docs/migration/changelog.yaml` → STOP. "Cannot reach changelog. Check internet connection or `KIT_REPO` value."

If `versions` is missing, empty, or the top entry has no `version` field → STOP and report the malformed changelog.

### 2.1. Fetch profile YAMLs and validate axes

For each chosen profile name, you already know which axis it belongs to (from the question that produced it: Q4a → language, Q4b → framework, Q4c → host, Q4d → provider, Q4e → capability). Use that to build the path.

For each chosen profile name with its known axis `<A>`:
- Fetch `RAW_BASE/profiles/<A>/<name>.yaml` and parse it.
- Read `_profile_axis`. If missing, not in `{language, framework, host, provider, capability}`, or not equal to `<A>` (the directory name) → STOP, report "profile <name> declares `_profile_axis: <X>` but is filed under `profiles/<A>/`".
- Validate the profile against `RAW_BASE/kit/profile.schema.json` (axis-specific allowed keys). If a profile populates a field outside its axis (e.g. a `provider`-axis profile sets `lsp`) → STOP and report which key violates the contract.

**Cardinality check (final):**
- Exactly one `language` profile.
- One or more `host` profiles (`1..N`).
- If `opencode` ∈ hosts → exactly one `provider` profile. Else → zero `provider` profiles.
- `framework` and `capability` may be 0..N.
- If the `capability` list does not include `security-baseline`, prepend it silently.

If cardinality fails → re-ask the relevant axis question.

### 2.1.1. Axis-aware merge

Because every profile is restricted to its axis-owned keys (per `profile.schema.json`), profiles from **different** axes cannot collide on any field — they always fill disjoint slots. Profiles within the same axis follow these rules:

- `language` and `provider` axes have cardinality 1 → no within-axis merging needed.
- `host` axis: each host profile only contributes its own `host.*` block; multi-host installs collect them into a list (see step 3.1) — they don't merge into a single `host` map in the manifest.
- `framework` and `capability` axes only ever populate `code_quality.forbidden_patterns` (and `framework` may set `ui`); their lists merge by **concat + dedupe**.

**Merge algorithm** (run in this fixed order so the result is deterministic):

1. Start with `merged = {}`.
2. Apply the chosen `language` profile (whole-tree).
3. Apply the chosen `provider` profile if any (whole-tree).
4. For each `framework` profile in selection order: deep-merge into `merged`.
5. For each `capability` profile in selection order (with `security-baseline` first): deep-merge into `merged`.
6. Collect chosen `host` profiles' `host` blocks into a list `host_specs[]` for use in PHASE 3 — they are NOT merged into the manifest itself; instead the manifest stores the host **names** in `hosts:` and PHASE 3 reads each host's profile fresh when computing the per-host rendering context.

**Deep-merge algorithm** (apply recursively):
- If both sides are **maps**: for each key in either side, recurse on the values; missing keys are added as-is.
- If both sides are **lists**: concatenate, then deduplicate while preserving order.
- Otherwise: if `merged` already has a non-null scalar value for that key, raise an error — this means two profiles claimed the same field, which is a contract violation that should have been caught by `profile.schema.json`. STOP and report it.

### 2.2. Apply PO answers on top of profile defaults

`final_manifest = deep_merge(merged_profiles, po_answers_as_manifest_shape)`.

Map PO answers into manifest structure:

```yaml
kit_version: <KIT_VERSION>          # from step 2.0
language_code: <Q0 or "en">
hosts: [<Q4c selection — "opencode" and/or "claude-code">]
project:
  name: <Q2>
  description: <Q3>
vault_path: <Q3b or "vault">
stack:
  language: <from chosen language profile or PO override>
  profiles: [<chosen profile list — language first, then provider (if any), then framework(s), then host(s), then capability(ies)>]
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

# OpenCode block — INCLUDE ONLY IF "opencode" ∈ hosts; OMIT IF claude-code-only install
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

# Claude Code block — INCLUDE ONLY IF "claude-code" ∈ hosts; OMIT IF opencode-only install
claude_code:
  models:
    default: <Q17a>
    coder: <Q17b>
    reviewer: <Q17c>
    designer: <Q17d or null>
    small: <Q17e>

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
- All `required` fields present and non-empty (note: schema is conditional — `provider`/`models` required only if `opencode` ∈ hosts; `claude_code` required only if `claude-code` ∈ hosts).
- All field types match.
- All regex `pattern` constraints match (e.g. `kit_version` must match `^\d+\.\d+\.\d+$`).
- All `enum` values valid (e.g. `hosts[]` items ∈ `["opencode", "claude-code"]`).

If validation fails — show PO the errors and re-ask only the relevant questions. Do not proceed.

### 2.4. Security checks (manifest hygiene)

Refuse to proceed if any of these match:
- `provider.api_key_env` (if present) looks like a real key: matches `^(sk|ghp|ghs|glpat|xoxp|xoxb)-` or `^AKIA[0-9A-Z]{16}$` or is 32+ chars containing letters+digits+special chars (high entropy).
- `mcp.context7.api_key_env` same check.

If matched: STOP, tell PO "Security: that looks like an actual key. Use the env-var **name** instead, e.g. `ROUTERAI_OPENCODE`. Set the value via `export ROUTERAI_OPENCODE=...` in your shell."

### 2.5. Show, confirm, write

Print the assembled manifest as YAML. Ask: "Does this look correct? (yes / no / edit X)". Loop until PO confirms. Write it to `<target>/<project-slug>.yaml`.

---

## PHASE 3 — Render & write

### 3.1. Build per-host rendering contexts

For each host name `H` in `manifest.hosts`, fetch `RAW_BASE/profiles/host/<H>.yaml` to learn its `host` block:

| Host | `template_dir` | `config_file` | `agent_format` | `instruction_file` |
|------|----------------|---------------|----------------|---------------------|
| `opencode` | `.opencode` | `opencode.json` | `opencode` | `AGENTS.md` |
| `claude-code` | `.claude` | `.claude/settings.json` | `claude-code` | `CLAUDE.md` |

Then build a substitution map per host. The base map (host-agnostic placeholders) is the same for every host:

| Variable | Source / rule |
|---|---|
| `KIT_REPO` | The `<user>/<repo>` slug of the kit source. |
| `KIT_LANG` | `manifest.language_code` (default `en`). |
| `VAULT_PATH` | `manifest.vault_path` (default `vault`). No trailing slash. |
| `PROJECT_NAME` | `manifest.project.name` |
| `PROJECT_DESCRIPTION` | `manifest.project.description` |
| `STACK_DESCRIPTION` | `"<project-name> — <language> stack"` |
| `BUILD_COMMAND` | `manifest.stack.build_command` |
| `COMPILE_COMMAND` | `manifest.stack.compile_command` |
| `LINT_COMMAND` | `manifest.stack.lint_command` |
| `TEST_COMMAND_TEMPLATE` | `manifest.stack.test_command` (keep `[module]` literal) |
| `MODULE_NAMES_LIST` | `" / ".join(m.name for m in modules)` |
| `MODULE_TABLE`, `MODULE_SOURCE_TABLE`, `MODULE_TEST_TABLE`, `MODULE_BUILD_COMMANDS`, `MODULE_DOCS_LIST` | Computed as in section 3.5 (rules M1–M4 below) |
| `ISO_TIMESTAMP_PLACEHOLDER` | Current UTC time as `YYYY-MM-DDTHH:MM:SSZ` |
| `CONTEXT7_ENABLED`, `KNOWLEDGE_ENABLED`, `SERENA_ENABLED` | `"true"` / `"false"` (lowercase) |
| `CONTEXT7_API_KEY_ENV` | `mcp.context7.api_key_env` (default `CONTEXT7_API_KEY`) |
| `KNOWLEDGE_URL` | `mcp.knowledge.url` |
| `LSP_BLOCK` | JSON block — see rule B1 |
| `UI_FRAMEWORK`, `PLATFORMS`, `COLOR_TABLE` | From `ui.*` (rule M5) |
| `FORBIDDEN_PATTERNS_LIST` | `\n`-joined `- <pattern>` |
| `FORMATTER_BLOCK` | JSON block — rule B2 |
| `DEPENDENCY_FILES_LIST` | One-line description from rule D1 |

**Per-host overlay** (added on top of the base map for each host `H`):

| Variable | Value when H = `opencode` | Value when H = `claude-code` |
|---|---|---|
| `HOST_DIR` | `.opencode` | `.claude` |
| `HOST_NAME` | `OpenCode` | `Claude Code` |
| `HOST_INSTRUCTION_FILE` | `AGENTS.md` | `CLAUDE.md` |
| `HOST_CONFIG_FILE` | `opencode.json` | `.claude/settings.json` |
| `KIT_LANG_ENV` | `OPENCODE_LANG` | `KIT_LANG` |
| `DISPATCH_TOOL` | `` `task` `` | `the Agent tool` |
| `DISPATCH_TOOL_DESC` | `` the `task` tool — `task @AgentName "<args>"` `` | `` the Agent tool with `subagent_type=<AgentName>` `` |
| `PROVIDER_ID` | `provider.name.lower().replace(" ", "_").replace("-", "_")` | (unused) |
| `PROVIDER_NAME` | `provider.name` | (unused) |
| `PROVIDER_BASE_URL` | `provider.base_url` | (unused) |
| `PROVIDER_API_KEY_ENV` | `provider.api_key_env` | (unused) |
| `DEFAULT_MODEL` | `models.default` | `claude_code.models.default` |
| `CODER_MODEL` | `models.coder` | `claude_code.models.coder` |
| `REVIEWER_MODEL` | `models.reviewer` | `claude_code.models.reviewer` |
| `ARCHITECT_MODEL` | `models.architect` (fallback to `reviewer` if null/absent) | `claude_code.models.architect` (fallback to `reviewer`) |
| `VERIFIER_MODEL` | `models.verifier` (fallback to `reviewer` if null/absent) | `claude_code.models.verifier` (fallback to `reviewer`) |
| `SMALL_MODEL` | `models.small` (fallback to `coder` if missing) | `claude_code.models.small` (fallback to `coder` if missing) |
| `MCP_SERVERS_BLOCK` | (unused — OpenCode renders MCPs inside `opencode.json` directly) | JSON object with only enabled MCPs, inserted into `.mcp.json` at project root (rule B3) |

#### Rule M1 — `MODULE_TABLE`
```
| Module | Gradle module | Docs | Responsibility |
|--------|---------------|------|----------------|
| `<name>` | `<gradle or "—">` | `<docs_path with trailing />` | <responsibility> |
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

#### Rule B1 — `LSP_BLOCK` (only used by OpenCode-rendered `opencode.json`)
If `lsp.enabled == false` → empty string `""`.
Else:
```json
  "lsp": {
    "<lang>": {
      "command": ["<lsp.command>"],
      "extensions": ["<ext1>", "<ext2>"]
    }
  },
```
where `<lang> = lsp.command stripped of "-lsp" / "_lsp" suffix, or "default"`.

#### Rule B2 — `FORMATTER_BLOCK` (OpenCode-only)
If `formatter.enabled == false` → empty string.
Else a `"formatter": { ... }` block — see schema for `opencode.json`.

#### Rule B3 — `MCP_SERVERS_BLOCK` (Claude Code only)
A JSON object listing only enabled MCP servers. Build it dynamically from the manifest:
```json
{
  "context7": { "type": "http", "url": "https://mcp.context7.com/mcp", "headers": { "CONTEXT7_API_KEY": "${<api_key_env>}" } },
  "knowledge-my-app": { "type": "http", "url": "<mcp.knowledge.url>" },
  "serena": { "type": "stdio", "command": "serena", "args": ["start-mcp-server"] }
}
```
Include only the entries whose corresponding manifest flag is `enabled: true`. The whole block is inserted as-is in place of `{{MCP_SERVERS_BLOCK}}` in `kit/.mcp.json.template`, which renders to `<target>/.mcp.json`. If every MCP flag is `false`, skip rendering `.mcp.json` entirely.

**Why `.mcp.json` and not `.claude/settings.json`:** Claude Code reads project-scope MCP server definitions exclusively from `.mcp.json` at the project root. The `mcpServers` key is not part of the `.claude/settings.json` schema and is silently ignored — placing servers there will look correct but they will never connect. `.claude/settings.json` only carries MCP *policies* (`allowedMcpServers` / `deniedMcpServers`), not server definitions.

#### Rule D1 — `DEPENDENCY_FILES_LIST`
By language: `kotlin`/`java` → `gradle/libs.versions.toml` or `build.gradle.kts`; `python` → `requirements.txt` / `pyproject.toml`; `typescript` → `package.json`; `go` → `go.mod`; `rust` → `Cargo.toml`; otherwise → `Primary dependency manifest`.

### 3.2. Discover all kit files

Fetch `RAW_BASE/kit/_index.txt`. Each line is a relative path under the repo root, e.g. `kit/.opencode/agents/Main.md.template` or `kit/_shared/agents/Main.body.md.template`. Iterate over them.

### 3.3. Classify each kit file by render scope

For every path `kit/<rel-path>`:

| Path prefix | Scope | What to do |
|---|---|---|
| `kit/_shared/` | host-shared, included via `{{INCLUDE: ...}}` | NEVER write directly — only resolved on demand by INCLUDE expansion (step 3.4). Skip in the file-by-file pass. |
| `kit/.opencode/...` | OpenCode host | Render only if `opencode` ∈ hosts. Target = `<target>/.opencode/...` (drop `kit/` prefix). |
| `kit/.claude/...` | Claude Code host | Render only if `claude-code` ∈ hosts. Target = `<target>/.claude/...`. |
| `kit/opencode.json.template` | OpenCode host | Render only if `opencode` ∈ hosts. Target = `<target>/opencode.json`. |
| `kit/AGENTS.md.template` | OpenCode host | Render only if `opencode` ∈ hosts. Target = `<target>/AGENTS.md`. |
| `kit/CLAUDE.md.template` | Claude Code host | Render only if `claude-code` ∈ hosts. Target = `<target>/CLAUDE.md`. |
| `kit/.mcp.json.template` | Claude Code host | Render only if `claude-code` ∈ hosts AND at least one MCP server is `enabled: true` (else SKIP — do not write an empty `.mcp.json`). Target = `<target>/.mcp.json`. Claude Code reads project-scope MCP servers exclusively from this file; the `mcpServers` key is NOT a recognized field in `.claude/settings.json` and is silently ignored there. |
| `kit/AUTO_MEMORY.md.template` | both hosts (universal) | Always render. Target = `<target>/AUTO_MEMORY.md`. Render with the FIRST host's substitution map (placeholders inside this file are host-agnostic). |
| `kit/.planning/...`, `kit/.vault/...` | scaffold (host-agnostic) | Always render. Target = same path with `kit/` dropped (and `.vault/` rewritten to `<vault_path>/`). Substitute with the FIRST host's map. |
| `kit/manifest.schema.json`, `kit/profile.schema.json`, `kit/_index.txt` | meta — DO NOT copy to target | Skip. |
| `kit/nested/MODULE.body.md.template` | per-module nested instruction file | Skip in this pass; handled by step 3.7. |
| `kit/editors/<X>/...` | (legacy — no longer present after v4) | Skip. |

In short: each host gets its own copy of `_shared/*` content **inlined via INCLUDE** plus its own `agents/` wrappers and host config; host-agnostic scaffold (`.planning/`, vault) is rendered once.

### 3.4. INCLUDE resolution

Many wrapper templates contain `{{INCLUDE: <relative-path>}}` directives that pull in shared bodies. Resolve them BEFORE the regular `{{VAR}}` substitution pass.

**Algorithm** (run for every file you are about to write):

1. Read the source content from `RAW_BASE/<original kit path>`.
2. Scan for the pattern `{{INCLUDE:\s*([^}]+?)\s*}}`. For each match:
   a. The capture is a path relative to the **repo root's `kit/` directory** (e.g. `_shared/agents/Main.body.md.template`).
   b. Path-escape guard: if the resolved path contains `..` or starts with `/` → STOP, report a malformed INCLUDE.
   c. Fetch `RAW_BASE/kit/<capture>`.
   d. **Recursively resolve** any INCLUDEs inside the fetched content (max recursion depth = 5; if exceeded, STOP and report an INCLUDE cycle).
   e. Substitute the entire `{{INCLUDE: ...}}` directive (the original match, including braces) with the resolved content.
3. Repeat scan until no `{{INCLUDE:` directives remain.
4. Now run the `{{VAR}}` substitution pass on the fully-expanded content.

After both passes, scan once more for any `\{\{[A-Z_]+\}\}` — these are unresolved variables, collect for the post-install report. Scan also for any `{{INCLUDE:` — if any remain after step 3, STOP (something went wrong).

### 3.5. Render and write each file

For each non-`_shared/` kit file from the index (after classification in 3.3):

1. Determine the host(s) for which this file renders. Files under `kit/.opencode/` or `kit/AGENTS.md.template` or `kit/opencode.json.template` are opencode-host scoped — they only render if `opencode` ∈ hosts. Files under `kit/.claude/` or `kit/CLAUDE.md.template` are claude-code-host scoped. Universal scaffold renders once with the first host's map.
2. For each applicable host:
   a. Resolve INCLUDEs (3.4) and substitute `{{VAR}}` placeholders using **that host's** substitution map.
   b. Compute target path: drop the leading `kit/` segment (and apply `.vault/` → `<vault_path>/` rewrite for vault-scaffold paths). If the basename ends with `.template`, drop the suffix. Path-escape guard: resolve absolute path; must start inside `<target>/`.
   c. Write the rendered content. Create parent directories as needed.

**Skip logic:** if the target file already exists and PO has not requested merge mode, SKIP it. (Fresh install assumes empty target — if any kit-managed file pre-exists, ask PO whether to overwrite.)

**Multi-host commands/skills:** because `_shared/` is only inlined via INCLUDE, and there is no top-level wrapper for individual commands/skills, each host needs to render `_shared/commands/*.md.template` and `_shared/skills/*/SKILL.md.template` directly. Implement this by, **per host**, iterating `_shared/commands/` and `_shared/skills/` (from the same `_index.txt`) and writing the rendered content to `<target>/<host_dir>/commands/` and `<target>/<host_dir>/skills/` respectively. The same is true for `_shared/_shared.md.template` → `<target>/<host_dir>/_shared.md`, `_shared/FILE_STRUCTURE.md.template` → `<target>/<host_dir>/FILE_STRUCTURE.md`, `_shared/sessions/SESSIONS.md.template` → `<target>/<host_dir>/sessions/SESSIONS.md`, `_shared/i18n/<code>.md` → `<target>/<host_dir>/i18n/<code>.md`. INCLUDE resolution still applies for any directive these files contain.

### 3.6. UI section handling (v7.0.0+)

The legacy `@Designer` agent was removed in v7.0.0. UI/UX is now produced by `@Architect` as the `## UI / UX` section of `spec.md` when `UI_REQUIRED=true` (computed at @Main step 2). To install the kit on a project with no UI surface: set `manifest.ui.framework: null`. `@Main` then sets `UI_REQUIRED=false` for every task and the section is omitted entirely (no placeholder, no `(none)` literal). Skip this step — there is no separate Designer.md to suppress.

### 3.7. Render nested module instruction files

For each module and for each host:
- Read `kit/nested/MODULE.body.md.template`.
- Build the per-module substitution context (overrides on top of the host's map):
  - `MODULE_NAME` = `m.name`
  - `MODULE_SOURCE_ROOT` = `m.source_root`
  - `MODULE_TEST_ROOT` = `m.test_root`
  - `MODULE_RESPONSIBILITY` = `m.responsibility`
  - `MODULE_GRADLE_LINE` = if `m.gradle_module` → ``"**Gradle module:** `<gradle_module>`"`` else `"**Gradle:** (not a Gradle project)"`
  - `MODULE_BUILD_TABLE` = three rows derived from `build_command` and `gradle_module` (rule below)
  - `MODULE_CONVENTIONS` = `m.conventions` or `"(use project-default conventions from root <HOST_INSTRUCTION_FILE>)"`
  - `MODULE_DEPENDENCIES` = `- \`<m.name>\`: <m.module_dependencies or "(none specified)">`
  - `MODULE_DOCS_PATH` = `m.docs_path` (or `<vault_path>/<m.name>/`)
- Render the template (resolve INCLUDEs first).
- Write to `<target>/<source_root>/<host.instruction_file>` (i.e. `AGENTS.md` for opencode host, `CLAUDE.md` for claude-code host). If both hosts are installed, both files are written per module — they have identical content.
- Path-escape guard. If the target file already exists, SKIP.

**`MODULE_BUILD_TABLE` rule:**
- If `gradle_module` is set:
  ```
  | `<build_command> <gradle_module>:build` | Build this module |
  | `<build_command> <gradle_module>:test` | Run tests |
  | `<build_command> <gradle_module>:compileKotlin` | Quick compile |
  ```
- Else:
  ```
  | `<build_command>` | Build project |
  | `<test_command>` | Run tests |
  | `<compile_command>` | Quick compile |
  ```

### 3.8. Update .gitignore

Append to `<target>/.gitignore` (create if missing). Skip any line already present:

```
# ai-agent-kit: local session pointer — not shared, each developer has their own
.planning/CURRENT.md
# ai-agent-kit v6.1+: local generated artifacts (per-developer, regenerated on demand)
.planning/REPO_MAP.md
.planning/.session-bootstrap.md
.planning/MORNING_REPORT.md
```

### 3.9. Create vault scaffold

For each module, create directories with an empty `.gitkeep`. The docs root for each module is `<target>/<m.docs_path>`.

All genre subdirs are created **relative to the vault root** (`<target>/<vault_path>/`):
- `concepts/<module-name>/{requirements, plans}/`
- `reference/<module-name>/{spec, test-cases}/`
- `how-to/<module-name>/plans/`
- `tutorials/<module-name>/documentation/`
- `guidelines/<module-name>/reports/`

Plus `<target>/<vault_path>/guidelines/libs/.gitkeep`.

---

## PHASE 4 — Verify

For each host `H` in `manifest.hosts`:

1. **Mandatory agents.** Check that the base agents exist in `<target>/<H.template_dir>/agents/`:
   - For `opencode`: `Main.md, CodeWriter.md, CodeReviewer.md, BugFixer.md, debugger.md, QA.md, TestRunner.md, Designer.md, PromptEngineer.md, AutoApprover.md` (Designer.md may be absent if its model is null).
   - For `claude-code`: `CodeWriter.md, CodeReviewer.md, BugFixer.md, debugger.md, QA.md, TestRunner.md, Designer.md, PromptEngineer.md, AutoApprover.md` (no `Main.md` — the orchestrator content lives in `<target>/CLAUDE.md` because the main session is the orchestrator).
   If the `requirements-pipeline` capability profile was selected, additionally check: `BusinessAnalyst.md, CornerCaseReviewer.md, SystemAnalyst.md, CoverageChecker.md, ConsistencyChecker.md`.

2. **Host config file is valid JSON.** Read `<target>/<H.config_file>`. Parse with a JSON parser. If parse fails — STOP, ask PO whether to retry.

3. **No literal API keys in the host config file.** Search for any string that looks like a real key (regexes from PHASE 2.4). Acceptable token formats: `{env:VAR_NAME}` (OpenCode) and `${VAR_NAME}` (Claude Code). If a literal key is found — STOP and warn PO: "SECURITY: literal API key detected at `<path>`. Fix immediately."

4. **Host instruction file present.** `<target>/<H.instruction_file>` exists and is non-empty.

After all hosts:

5. **No unresolved `{{...}}` placeholders.** Grep the entire target directory for `\{\{[A-Z_]+\}\}` and `\{\{INCLUDE:`. If matches found, list them by file. Tell PO they need to be filled manually (or re-fetched).

6. **Living test-cases path.** Confirm that `<target>/<vault_path>/reference/<first-module>/test-cases/` exists; create the `.gitkeep` if it does not.

---

## PHASE 5 — Env vars reminder

Print:

```
═══════════════════════════════════════════════════
ai-agent-kit APPLIED SUCCESSFULLY (kit_version: <KIT_VERSION>, hosts: <hosts list>)
═══════════════════════════════════════════════════

Files created in <target>:
  <list of files>
```

**If `opencode` ∈ hosts**, also print:

```
OpenCode setup:
  export <PROVIDER_API_KEY_ENV>=<your_api_key>
  export <CONTEXT7_API_KEY_ENV>=<your_context7_key>   (if context7 enabled)
  cd <target> && opencode

Three commands to know (OpenCode):
  /kit-requirements-pipeline "<feature>"
  /kit-new-feature           "<feature>"
  /kit-fix                   [TC-id|text]
```

**If `claude-code` ∈ hosts**, also print:

```
Claude Code setup:
  export ANTHROPIC_API_KEY=<your_anthropic_key>
  export <CONTEXT7_API_KEY_ENV>=<your_context7_key>   (if context7 enabled)
  export KIT_LANG=<language_code>                     (optional; default already in .claude/settings.json)
  cd <target> && claude

Three commands to know (Claude Code):
  /kit-requirements-pipeline "<feature>"
  /kit-new-feature           "<feature>"
  /kit-fix                   [TC-id|text]

The main session reads CLAUDE.md and acts as @Main (the Orchestrator).
Subagents live in .claude/agents/ and are dispatched via the Agent tool with subagent_type=<Name>.
```

End with:

```
If any TODO fields remain in the manifest or unresolved {{...}} placeholders were reported, fix them before relying on agents.

Report back a summary of what was done.
```

---

## Stop conditions

- **Manifest validation fails 3 times in a row** → STOP, ask PO to inspect the manifest manually.
- **Profile axis contract violated** (a profile sets a field outside its axis, or two profiles in the merge claim the same scalar field) → STOP, report which profile and which key.
- **Cardinality violated** (zero or multiple language profiles, zero host profiles, or `opencode`-without-provider) → re-ask the relevant axis question, max 3 retries, then STOP.
- **A kit file 404s when fetched** → STOP, report the exact URL and ask PO whether the kit has been published yet at the expected `KIT_REPO`.
- **A literal API key is detected anywhere** → STOP immediately, warn PO.
- **Target directory is non-empty AND already contains a `.opencode/` or `.claude/` directory** → STOP, warn PO that this is a fresh install path. Suggest `/kit-update` from inside the existing kit instead.
- **INCLUDE recursion exceeds depth 5 or path tries to escape `kit/`** → STOP, report the bad directive.
