# ai-agent-kit — uninstall prompt (no scripts)

You are an AI agent removing ai-agent-kit from a target project. Your only job is to follow this script exactly. Do not skip steps. Do not guess values. Do not delete anything outside the explicitly listed paths.

> **No Python, no JDK, no curl-jar.** Everything is done with your own tools: Read, Bash (for `rm`/`rmdir`). You read the manifest yourself and delete only what the kit installed.

---

## PHASE 0 — Locate manifest

1. Look for the manifest file in the project root: any `*.yaml` or `*.yml` file at root level that contains a `kit_version:` field.
   - If multiple candidates exist → list them and ask PO which one is the ai-agent-kit manifest.
   - If none found → STOP. Tell PO: "No ai-agent-kit manifest found. The project does not appear to have ai-agent-kit installed, or the manifest was already deleted."

2. Read the manifest. Extract:
   - `vault_path` (default `vault` if absent)
   - `modules[*].source_root` — list of all module source roots (for nested instruction-file removal)
   - `hosts` list (or — for pre-v4 manifests — fall back to `editors` and treat each value as a host name; if neither is present, default to `[opencode]`)
   - `project.name` (for the summary)

3. Compute `MANIFEST_FILE` = the path of the manifest file found in step 1.

4. **Resolve per-host paths.** For each host name `H` in `hosts`, fetch (or hard-code) its profile:
    - `opencode` → `template_dir = .opencode`, `config_file = opencode.json`, `instruction_file = AGENTS.md`
    - `claude-code` → `template_dir = .claude`, `config_file = .claude/settings.json`, `instruction_file = CLAUDE.md`

   Build `HOST_DIRS = [H.template_dir for H in hosts]`, `HOST_CONFIGS = [H.config_file ...]`, `HOST_INSTRUCTIONS = [H.instruction_file ...]`. These three lists drive PHASE 1 inventory and PHASE 3 deletion.

---

## PHASE 1 — Inventory

Build the full list of files and directories the kit installed. Use the manifest values from PHASE 0.

### Kit-managed directories (will be deleted entirely)

| Path (relative to project root) | Contents |
|---|---|
| Each entry in `HOST_DIRS` (e.g. `.opencode/`, `.claude/`) | Agents, commands, skills, sessions, i18n for that host |
| `.planning/` | CURRENT.md, DECISIONS.md, tasks/, tasks/done/ |
| `<vault_path>/_templates/` | Bug-report, requirements, spec, test-cases, test-plan templates |

> **Warning about vault content:** `<vault_path>/` may contain PO/agent-generated content (requirements, specs, test cases) that is NOT part of the kit itself — it is project knowledge. In step PHASE 2 the PO will choose whether to keep or delete the vault root. The kit only *fully owns* `<vault_path>/_templates/` and `<vault_path>/_INDEX.md`.

### Kit-managed files (will be deleted individually)

| Path (relative to project root) | Note |
|---|---|
| Each entry in `HOST_INSTRUCTIONS` (e.g. `AGENTS.md`, `CLAUDE.md`) | Per-host root instruction file |
| Each entry in `HOST_CONFIGS` (e.g. `opencode.json`, `.claude/settings.json`) | Per-host runtime config file |
| `AUTO_MEMORY.md` | Agent auto-memory scaffold (host-agnostic) |
| `<vault_path>/_INDEX.md` | Vault index |
| `<MANIFEST_FILE>` | The manifest itself |

### Nested module instruction files (one per host per module)

For each module whose `source_root` is set, and for each host: `<source_root>/<H.instruction_file>`. So if both `opencode` and `claude-code` are installed, both `<source_root>/AGENTS.md` and `<source_root>/CLAUDE.md` are inventoried.

---

## PHASE 2 — Confirm with PO

Present the full inventory computed in PHASE 1. Then ask:

```
The following will be PERMANENTLY DELETED:

Directories:
  <each entry in HOST_DIRS, one per line, e.g. ".opencode/" and/or ".claude/">
  .planning/
  <vault_path>/_templates/

Files:
  <each entry in HOST_INSTRUCTIONS, e.g. "AGENTS.md" and/or "CLAUDE.md">
  <each entry in HOST_CONFIGS, e.g. "opencode.json" and/or ".claude/settings.json">
  AUTO_MEMORY.md
  <vault_path>/_INDEX.md
  <MANIFEST_FILE>

Nested instruction files:
  <for each module's source_root, list one line per host: "<source_root>/AGENTS.md", "<source_root>/CLAUDE.md">

Additionally — what should happen to the vault root (<vault_path>/)?
  [K] Keep  — preserve all generated docs (requirements, specs, test cases). RECOMMENDED.
  [D] Delete — remove the entire <vault_path>/ directory including all generated content.

Type YES + K or YES + D to proceed, or NO to cancel.
```

- If PO types anything other than `YES K` / `YES D` (case-insensitive) → STOP. "Uninstall cancelled."
- Record `VAULT_CHOICE` = `keep` or `delete`.

---

## PHASE 3 — Delete

Perform deletions in this order. For each step, report the outcome (deleted / skipped — not found).

### 3.1. Delete kit-managed directories

For each directory in the list, if the directory exists → delete it recursively; else → report "not found, skipped".

Directories to delete:
- For each `D` in `HOST_DIRS`: `<target>/<D>/` (e.g. `<target>/.opencode/`, `<target>/.claude/`)
- `<target>/.planning/`
- `<target>/<vault_path>/_templates/`

If `VAULT_CHOICE == delete`:
- Also delete `<target>/<vault_path>/` entirely.

### 3.2. Delete kit-managed files

For each file in the list, if it exists → delete it; else → "not found, skipped".

Files to delete:
- For each `I` in `HOST_INSTRUCTIONS`: `<target>/<I>` (e.g. `<target>/AGENTS.md`, `<target>/CLAUDE.md`).
- For each `C` in `HOST_CONFIGS`: `<target>/<C>` (e.g. `<target>/opencode.json`, `<target>/.claude/settings.json`). Note: `.claude/settings.json` is already removed when `<target>/.claude/` is deleted in 3.1; the explicit removal here is a no-op for that case but stays in the list for completeness.
- `<target>/AUTO_MEMORY.md`
- `<target>/<vault_path>/_INDEX.md` (only if `VAULT_CHOICE == keep`; if `delete`, it was already removed with the vault root)
- `<target>/<MANIFEST_FILE>`

### 3.3. Delete nested module instruction files

For each module in the manifest whose `source_root` is non-empty, and for each host's instruction file `I` in `HOST_INSTRUCTIONS`:
- Target: `<target>/<source_root>/<I>`
- If the file exists AND contains `ai-agent-kit` anywhere in the first 10 lines OR opens with `# AGENTS.md —` / `# CLAUDE.md —` (kit markers) → delete it.
- If the file exists but does NOT look like a kit file (no kit markers) → SKIP and warn PO: "Skipped `<path>` — does not appear to be a kit-generated file. Review manually."
- If the file does not exist → "not found, skipped".

### 3.4. Clean up empty directories

After all deletions, check if `<vault_path>/` now contains only empty subdirectories (recursively no files except `.gitkeep`). If so, offer: "The vault directory `<vault_path>/` is now empty. Delete it? (yes/no)". Delete only on explicit yes.

---

## PHASE 4 — Verify

1. For each `D` in `HOST_DIRS`: confirm `<target>/<D>/` no longer exists (or is empty). If it still exists → list remaining contents and warn PO.
2. Confirm `.planning/` no longer exists.
3. For each `C` in `HOST_CONFIGS`: confirm `<target>/<C>` no longer exists.
4. For each `I` in `HOST_INSTRUCTIONS`: confirm `<target>/<I>` no longer exists.
5. If `VAULT_CHOICE == delete` → confirm `<vault_path>/` no longer exists.
6. Report any files that could NOT be deleted (permissions issues, etc.) as errors.

---

## PHASE 5 — Summary

Print exactly:

```
═══════════════════════════════════════════════════
ai-agent-kit UNINSTALLED
═══════════════════════════════════════════════════

Project: <project.name>

Deleted:
  <bulleted list of each deleted path>

Skipped (not found):
  <bulleted list, or "none">

Skipped (manual review needed):
  <bulleted list, or "none">

Vault: <"deleted" | "kept at <vault_path>/">

The project no longer has ai-agent-kit installed.
To re-install, run the /setup command.
```

---

## Safety rules

- **NEVER delete files outside the target project root.**
- **NEVER delete anything not listed in this prompt.** If in doubt, skip and warn PO.
- **NEVER delete the vault root without explicit PO confirmation** (VAULT_CHOICE == delete).
- **NEVER delete a nested AGENTS.md or CLAUDE.md that does not contain kit markers** — it may be hand-written.
- **STOP immediately if PO does not confirm** in PHASE 2.
- **Do not run `rm -rf` on the entire project root or parent directories.**
