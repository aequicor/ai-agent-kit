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
   - `modules[*].source_root` — list of all module source roots (for nested AGENTS.md removal)
   - `editors` list (default `[opencode]`)
   - `project.name` (for the summary)

3. Compute `MANIFEST_FILE` = the path of the manifest file found in step 1.

---

## PHASE 1 — Inventory

Build the full list of files and directories the kit installed. Use the manifest values from PHASE 0.

### Kit-managed directories (will be deleted entirely)

| Path (relative to project root) | Contents |
|---|---|
| `.opencode/` | All agents, commands, skills, sessions, i18n |
| `.planning/` | CURRENT.md, DECISIONS.md |
| `<vault_path>/_templates/` | Bug-report, requirements, spec, test-cases, test-plan templates |

> **Warning about vault content:** `<vault_path>/` may contain PO/agent-generated content (requirements, specs, test cases) that is NOT part of the kit itself — it is project knowledge. In step PHASE 2 the PO will choose whether to keep or delete the vault root. The kit only *fully owns* `<vault_path>/_templates/` and `<vault_path>/_INDEX.md`.

### Kit-managed files (will be deleted individually)

| Path (relative to project root) | Note |
|---|---|
| `AGENTS.md` | Root agent instructions |
| `AUTO_MEMORY.md` | Agent auto-memory scaffold |
| `CLAUDE.md` | OpenCode claude config (only if `opencode` in `editors`) |
| `opencode.json` | OpenCode provider/model config |
| `<vault_path>/_INDEX.md` | Vault index |
| `<MANIFEST_FILE>` | The manifest itself |

### Nested AGENTS.md (one per module)

For each module whose `source_root` is set: `<source_root>/AGENTS.md`.

---

## PHASE 2 — Confirm with PO

Present the full inventory computed in PHASE 1. Then ask:

```
The following will be PERMANENTLY DELETED:

Directories:
  .opencode/
  .planning/
  <vault_path>/_templates/

Files:
  AGENTS.md
  AUTO_MEMORY.md
  CLAUDE.md
  opencode.json
  <vault_path>/_INDEX.md
  <MANIFEST_FILE>

Nested AGENTS.md:
  <list each source_root>/AGENTS.md

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

For each directory in the list:
- If the directory exists → delete it recursively.
- If it does not exist → report "not found, skipped".

Directories to delete:
- `<target>/.opencode/`
- `<target>/.planning/`
- `<target>/<vault_path>/_templates/`

If `VAULT_CHOICE == delete`:
- Also delete `<target>/<vault_path>/` entirely (after `_templates/` is already gone, delete the parent).

### 3.2. Delete kit-managed files

For each file in the list, if it exists → delete it; else → "not found, skipped".

Files to delete:
- `<target>/AGENTS.md`
- `<target>/AUTO_MEMORY.md`
- `<target>/CLAUDE.md` (only if `opencode` in `manifest.editors`)
- `<target>/opencode.json`
- `<target>/<vault_path>/_INDEX.md` (only if `VAULT_CHOICE == keep`; if `delete`, it was already removed with the vault root)
- `<target>/<MANIFEST_FILE>`

### 3.3. Delete nested AGENTS.md files

For each module in the manifest whose `source_root` is non-empty:
- Target: `<target>/<source_root>/AGENTS.md`
- If the file exists AND its first line is `# <module-name>` or contains `ai-agent-kit` anywhere in the first 10 lines → delete it.
- If the file exists but does NOT look like a kit file (no kit markers) → SKIP and warn PO: "Skipped `<path>` — does not appear to be a kit-generated file. Review manually."
- If the file does not exist → "not found, skipped".

### 3.4. Clean up empty directories

After all deletions, check if `<vault_path>/` now contains only empty subdirectories (recursively no files except `.gitkeep`). If so, offer: "The vault directory `<vault_path>/` is now empty. Delete it? (yes/no)". Delete only on explicit yes.

---

## PHASE 4 — Verify

1. Confirm `.opencode/` no longer exists (or is empty). If it still exists → list remaining contents and warn PO.
2. Confirm `.planning/` no longer exists. If it still exists → list remaining contents and warn PO.
3. Confirm `opencode.json` no longer exists.
4. Confirm `AGENTS.md` at project root no longer exists.
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
- **NEVER delete nested AGENTS.md that does not contain kit markers** — it may be hand-written.
- **STOP immediately if PO does not confirm** in PHASE 2.
- **Do not run `rm -rf` on the entire project root or parent directories.**
