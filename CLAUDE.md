# ai-agent-kit — Claude Code guide

## What this repo is

A pure-AI configuration kit for [OpenCode](https://opencode.ai) and [Claude Code](https://claude.com/product/claude-code). Running the install prompt drops a complete agent team (10 base agents + optional requirements-pipeline agents) into any target project. No scripts, no runtimes — the AI resolves `{{INCLUDE: <path>}}` directives and renders `{{VAR}}` templates itself.

**Multi-host architecture (since v4.0.0):** every install picks one or more hosts (`opencode`, `claude-code`). Each host gets its own template tree (`.opencode/` or `.claude/`) with host-specific frontmatter and a host-specific config file (`opencode.json` or `.claude/settings.json`). Agent bodies, commands, and skills are shared via `kit/_shared/` and inlined per host via `{{INCLUDE: ...}}`.

**Repo:** `aequicor/ai-agent-kit` on GitHub.
**Raw base:** `https://raw.githubusercontent.com/aequicor/ai-agent-kit/master`

---

## Repository layout

```
ai-agent-kit/
├── README.md                        # user-facing docs; contains profile table + agent roster
├── manifest.example.yaml            # reference manifest for users to copy
├── docs/
│   ├── prompts/
│   │   ├── setup.md                 # AI-driven install prompt
│   │   ├── update.md                # AI-driven update prompt
│   │   ├── extend.md                # AI-driven /kit-extend prompt (add one profile by URL)
│   │   └── uninstall.md             # AI-driven uninstall prompt
│   └── migration/
│       └── changelog.yaml           # version history — source of truth for /kit-update
├── profiles/                        # one subdirectory per axis; dir name IS the axis
│   ├── language/                    # exactly 1 per manifest
│   ├── framework/                   # 0..N per manifest
│   ├── host/                        # 1..N per manifest (opencode, claude-code)
│   ├── provider/                    # 1 if opencode ∈ hosts, else 0
│   └── capability/                  # 0..N (security-baseline always added)
└── kit/                             # everything rendered into the target project
    ├── _index.txt                   # complete file list — must be kept in sync
    ├── manifest.schema.json         # JSON Schema for assembled manifests
    ├── profile.schema.json          # JSON Schema for individual profile YAMLs
    ├── AGENTS.md.template           # rendered iff opencode ∈ hosts
    ├── CLAUDE.md.template           # rendered iff claude-code ∈ hosts (inlines orchestrator body)
    ├── opencode.json.template       # rendered iff opencode ∈ hosts
    ├── _shared/                     # single source of truth — pulled into both hosts via INCLUDE
    │   ├── agents/<Name>.body.md.template     # agent prose, no frontmatter (shared by both hosts)
    │   ├── commands/<name>.md.template        # /kit-* commands (host-agnostic)
    │   ├── skills/<name>/SKILL.md.template
    │   ├── _shared.md.template, FILE_STRUCTURE.md.template, sessions/, i18n/, PROJECT_RULES.body.md.template
    ├── .opencode/agents/<Name>.md.template    # OpenCode frontmatter + INCLUDE
    ├── .claude/
    │   ├── agents/<Name>.md.template          # Claude Code frontmatter + INCLUDE (no Main — see CLAUDE.md)
    │   └── settings.json.template
    └── nested/MODULE.body.md.template         # rendered per module per host
```

---

## Versioning rules

The kit uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`).

| Increment | When |
|-----------|------|
| `PATCH`   | Bug fixes in prompts, typo corrections, profile fixes that don't change manifest structure |
| `MINOR`   | New profiles, new agents/commands/skills, new optional manifest fields (all backward-compatible) |
| `MAJOR`   | Breaking manifest changes (required field added/renamed/removed), profile renames/splits, merge algorithm changes |

**Every change that modifies any file under `kit/` or `profiles/` requires a version bump.**
Changes to `README.md`, `docs/prompts/`, `manifest.example.yaml` alone do not require a bump unless the prompt logic itself changes.

---

## How to release a new version

Follow these steps in order. Do not skip any.

### 1. Decide the new version

Choose `MAJOR.MINOR.PATCH` per the rules above. Current version is in `docs/migration/changelog.yaml` at `versions[0].version`.

### 2. Update `docs/migration/changelog.yaml`

**Prepend** a new entry at the top of the `versions:` list (newest first). The structure:

```yaml
versions:
  - version: "X.Y.Z"
    released: "YYYY-MM-DD"          # today's date
    breaking: true|false
    description: |
      Human-readable summary of what changed and why.
      For breaking changes: include the migration steps the user must take.
    files_changed:
      - path/to/changed/file.ext    # relative to repo root; kit/ and profiles/ only
    manifest_changes:
      added_fields:                 # new optional or required manifest fields
        - path: "some.field.path"
          default: <yaml value>
          description: "what it does"
      profile_transforms:           # only when profiles are renamed/split/merged
        - rename:
            from: old-name
            to: [new-name-1, new-name-2]   # 1→N split is allowed
        - ensure: [profile-name]           # add to stack.profiles[] if absent
        - ensure_axis:
            axis: provider
            default: routerai              # add if no profile of that axis is present
```

Rules:
- `added_fields` is required (can be empty list `[]`) even if nothing changed.
- `profile_transforms` is omitted entirely when there are no profile renames/splits.
- `files_changed` lists only kit/ and profiles/ paths; do not list README.md or docs/ here.

### 3. Update `README.md`

- In the **Available profiles** table, reflect any added/renamed/removed profiles.
- In the **Repository layout** section, reflect any new files.
- In the **Agent roster** section, reflect any new agents.
- If the version is visible as a badge or inline text anywhere in README.md, update it to the new version.

### 4. Update `manifest.example.yaml`

- Set `kit_version: "X.Y.Z"` to the new version.
- Add any new fields with their documented defaults.
- Reflect any profile renames in `stack.profiles`.

### 5. Update `kit/_index.txt`

If any files were added to or removed from `kit/`:

```bash
find kit -type f ! -name "_index.txt" | sort > kit/_index.txt
```

Commit the updated `_index.txt` together with the new files.

### 6. Validate profiles

Run this check locally before committing:

```bash
python3 -c "
import json, yaml, glob, os
try:
    from jsonschema import Draft202012Validator
except ImportError:
    print('pip install jsonschema first'); exit(1)
s = json.load(open('kit/profile.schema.json'))
v = Draft202012Validator(s)
ok = True
for p in sorted(glob.glob('profiles/*/*.yaml')):
    data = yaml.safe_load(open(p))
    errs = list(v.iter_errors(data))
    ax_dir = os.path.basename(os.path.dirname(p))
    ax_dec = data.get('_profile_axis', '')
    if errs or ax_dir != ax_dec:
        print('FAIL', p, [e.message for e in errs], f'axis_dir={ax_dir} axis_declared={ax_dec}')
        ok = False
    else:
        print('OK  ', p)
if ok:
    print('All profiles valid.')
"
```

### 7. Commit

```
feat: release vX.Y.Z — <one-line summary>
```

For breaking changes use `feat!:` (conventional commits breaking-change marker).

---

## Adding a profile

1. Pick the axis (`language`, `framework`, `host`, `provider`, `capability`). An axis owns specific manifest fields — see `profiles/README.md`. If you need fields from two axes, make two profiles.
2. Create `profiles/<axis>/<name>.yaml`. Required front-matter:
   ```yaml
   _profile_name: <name>
   _profile_description: "<one line>"
   _profile_axis: <axis>        # must equal the parent directory name exactly
   ```
3. Populate **only** the fields the axis is allowed to set (enforced by `kit/profile.schema.json`).
4. Run the profile validation check (step 6 above).
5. Add the new profile to the appropriate table in `README.md` and in `profiles/README.md`.
6. Bump the version (MINOR) and add a `changelog.yaml` entry.

If you rename or split an existing profile, add a `profile_transforms.rename` entry in the changelog so `/kit-update` migrates installed manifests automatically.

---

## Adding an agent

Agent prose lives once in `_shared/`; each host has its own thin wrapper file with host-specific frontmatter that includes the body.

1. **Body** — `kit/_shared/agents/<AgentName>.body.md.template`. Pure prose, no frontmatter. Use placeholders from the [**Template placeholders**](#template-placeholders) section below for host-divergent text and manifest-derived values.
2. **OpenCode wrapper** — `kit/.opencode/agents/<AgentName>.md.template`:
   ```
   ---
   description: ...
   mode: subagent
   model: {{PROVIDER_ID}}/{{<role>_MODEL}}
   temperature: 0.1
   permission: { read: allow, edit: allow, ... }
   ---

   {{INCLUDE: _shared/agents/<AgentName>.body.md.template}}
   ```
3. **Claude Code wrapper** — `kit/.claude/agents/<AgentName>.md.template`:
   ```
   ---
   name: <AgentName>
   description: ...
   tools: Read,Edit,Bash,Grep,Glob,...
   model: {{<role>_MODEL}}
   ---

   {{INCLUDE: _shared/agents/<AgentName>.body.md.template}}
   ```
4. If the agent participates in a pipeline, reference it from `kit/_shared/agents/Main.body.md.template` (the orchestrator body) or from a skill.
5. Run `find kit -type f ! -name "_index.txt" | sort > kit/_index.txt` to refresh the index.
6. Update the **Agent roster** table in `README.md`.
7. Bump version (MINOR) and add a changelog entry.

---

## Adding a command or skill

Commands and skills are host-agnostic — single source under `_shared/`, rendered into every host's `<host_dir>/commands/` and `<host_dir>/skills/` at install time.

1. Create `kit/_shared/commands/<name>.md.template` or `kit/_shared/skills/<name>/SKILL.md.template`.
2. Refresh `kit/_index.txt`.
3. Reference the command/skill from the orchestrator body (`kit/_shared/agents/Main.body.md.template`) or from a relevant agent body.
4. Bump version (MINOR) and add a changelog entry.

---

## Template placeholders

`{{NAME}}` tokens inside `.template` files are resolved by `setup.md` / `update.md` from the manifest. Authoritative list of every placeholder the kit currently emits, grouped by source. The post-install verifier rejects any unresolved `{{...}}` — if you introduce a new placeholder, register it here and teach the install prompt how to fill it.

**Project (manifest top-level)**

| Placeholder | Source | Notes |
|-------------|--------|-------|
| `{{PROJECT_NAME}}` | `project.name` | |
| `{{PROJECT_DESCRIPTION}}` | `project.description` | |
| `{{STACK_DESCRIPTION}}` | derived from `stack.profiles[]` | one-line summary |
| `{{KIT_REPO}}` | constant — kit repo URL | |
| `{{VAULT_PATH}}` | `vault_path` | default `vault` |
| `{{KIT_LANG}}` | `language_code` | `en` \| `ru` |
| `{{KIT_LANG_ENV}}` | derived from host | `OPENCODE_LANG` or `KIT_LANG` |

**Host-divergent (filled per host during render)**

| Placeholder | Values (opencode / claude-code) |
|-------------|---------------------------------|
| `{{HOST_NAME}}` | `OpenCode` / `Claude Code` |
| `{{HOST_DIR}}` | `.opencode` / `.claude` |
| `{{HOST_INSTRUCTION_FILE}}` | `AGENTS.md` / `CLAUDE.md` |
| `{{HOST_CONFIG_FILE}}` | `opencode.json` / `.claude/settings.json` |
| `{{DISPATCH_TOOL}}` | `@AgentName` / `Task` |
| `{{DISPATCH_TOOL_DESC}}` | one-line how-to-dispatch hint |

**Provider & models (OpenCode only — empty/omitted when `opencode ∉ hosts`)**

| Placeholder | Source |
|-------------|--------|
| `{{PROVIDER_ID}}` | `provider.name` (slug used in `model: <provider>/<model>`) |
| `{{PROVIDER_NAME}}` | human-readable provider label |
| `{{PROVIDER_BASE_URL}}` | `provider.base_url` |
| `{{PROVIDER_API_KEY_ENV}}` | `provider.api_key_env` |
| `{{DEFAULT_MODEL}}` | `models.default` |
| `{{CODER_MODEL}}` | `models.coder` |
| `{{REVIEWER_MODEL}}` | `models.reviewer` |
| `{{DESIGNER_MODEL}}` | `models.designer` (omits @Designer if `null`) |
| `{{SMALL_MODEL}}` | `models.small` |

**Build, test, modules**

| Placeholder | Source |
|-------------|--------|
| `{{BUILD_COMMAND}}` | `stack.build_command` |
| `{{COMPILE_COMMAND}}` | `stack.compile_command` |
| `{{LINT_COMMAND}}` | `stack.lint_command` |
| `{{TEST_COMMAND_TEMPLATE}}` | `stack.test_command` (literal `[module]` substituted per module) |
| `{{MODULE_TABLE}}` | rendered table — name, gradle module, responsibility |
| `{{MODULE_SOURCE_TABLE}}` | rendered table — `source_root` per module |
| `{{MODULE_TEST_TABLE}}` | rendered table — `test_root` per module |
| `{{MODULE_BUILD_COMMANDS}}` | per-module test-command list (TEST_COMMAND_TEMPLATE × modules) |
| `{{DEPENDENCY_FILES_LIST}}` | derived from language profile (e.g. `build.gradle.kts`, `package.json`) |

**Code quality, formatter, LSP**

| Placeholder | Source |
|-------------|--------|
| `{{FORBIDDEN_PATTERNS_LIST}}` | `code_quality.forbidden_patterns` (rendered as bullet list) |
| `{{FORMATTER_BLOCK}}` | rendered block from `formatter.*` (or empty if `enabled: false`) |
| `{{LSP_BLOCK}}` | rendered block from `lsp.*` (or empty if `enabled: false`) |

**UI / Designer**

| Placeholder | Source |
|-------------|--------|
| `{{UI_FRAMEWORK}}` | `ui.framework` (whole `@Designer` agent omitted if `null`) |
| `{{PLATFORMS}}` | `ui.platforms[]` joined |
| `{{COLOR_TABLE}}` | rendered table from `ui.colors[]` |

**MCP integrations**

| Placeholder | Source |
|-------------|--------|
| `{{CONTEXT7_ENABLED}}` | `mcp.context7.enabled` |
| `{{CONTEXT7_API_KEY_ENV}}` | `mcp.context7.api_key_env` |
| `{{KNOWLEDGE_ENABLED}}` | `mcp.knowledge.enabled` |
| `{{KNOWLEDGE_URL}}` | `mcp.knowledge.url` |
| `{{SERENA_ENABLED}}` | `mcp.serena.enabled` |

**Dynamic (filled by the agent at run time, not at install)**

| Placeholder | Notes |
|-------------|-------|
| `{{ISO_TIMESTAMP_PLACEHOLDER}}` | Literal — agents replace with current ISO-8601 timestamp when stamping vault docs. Survives install render on purpose. |

`{{INCLUDE: <path>}}` is **not** a value placeholder — it is a directive that inlines the contents of another `kit/`-relative file at render time. See [What this repo is](#what-this-repo-is).

---

## Modifying the manifest schema

`kit/manifest.schema.json` is the contract for all installed manifests. When adding a new field:

1. Add it to the schema with a clear description and default value.
2. Add a corresponding `added_fields` entry in the changelog for the version being released so `/kit-update` knows to append it with the default.
3. Update `manifest.example.yaml` to show the new field with a realistic example value.
4. If the field is **required**, this is a breaking change — bump MAJOR.

---

## Migration guide format (for changelog.yaml)

The `update.md` prompt interprets `manifest_changes` in this order:

1. **`added_fields`** — appended to the manifest with their defaults if the key is absent.
2. **`profile_transforms`** — applied to `stack.profiles[]` in order:
   - `rename: {from: X, to: [A, B]}` — replaces every occurrence of `X` with `A, B` (deduplication applied).
   - `ensure: [P]` — adds `P` to the list if not already present.
   - `ensure_axis: {axis: X, default: D}` — adds profile `D` if no profile belonging to axis `X` is present.

The prompt shows the user the full migration plan and waits for confirmation before writing anything.

---

## Security rules (never violate)

- **No literal API keys.** Manifests store only the env-var name (e.g. `api_key_env: ROUTERAI_OPENCODE`). Setup and update prompts abort if a literal key is detected (`sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy string).
- **No path escape.** Target paths are resolved and verified to start inside the target directory before any write.
- **No unresolved placeholders.** The post-install verifier rejects any `{{...}}` remaining in rendered files.

---

## Branching and PR conventions

- Default branch: `master`.
- Work on feature branches; open a PR to `master`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` — new profile / agent / command / skill
  - `feat!:` — breaking change (MAJOR bump)
  - `fix:` — bug fix in prompt logic or profile
  - `docs:` — README / changelog text only (no kit file changes)
  - `chore:` — `_index.txt` refresh, schema tweaks with no manifest impact
- PR title = commit message of the squash commit.

---

## Checklist for any PR that touches `kit/` or `profiles/`

- [ ] `docs/migration/changelog.yaml` has a new entry at the top with correct `version`, `released`, `breaking`, `files_changed`, and `manifest_changes`.
- [ ] `manifest.example.yaml` `kit_version` matches the new version.
- [ ] `README.md` tables (profiles, agents, layout) are up to date.
- [ ] `kit/_index.txt` is up to date (`find kit -type f ! -name "_index.txt" | sort`).
- [ ] All profiles pass schema validation.
- [ ] No literal API keys or unresolved `{{...}}` in any committed file.
