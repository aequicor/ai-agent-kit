# ai-agent-kit — update prompt (no clone, no scripts)

You are an AI agent upgrading an installed ai-agent-kit. Your only job is to follow this script exactly. Do not skip steps. Do not run any external scripts.

> **No Python, no JDK, no curl-jar.** You fetch files yourself, resolve `{{INCLUDE: <path>}}` yourself, render `{{VAR}}` yourself, write files yourself.

---

## Constants

- `KIT_REPO` = the GitHub `<user>/<repo>` slug from which this kit is hosted. Read it from the URL of the prompt you fetched.
- `RAW_BASE` = `https://raw.githubusercontent.com/{KIT_REPO}/master`

---

## PHASE 0 — Detect current version

1. Find the manifest file in the project root (`*.yaml` or `*.yml`). Read it.
   - Multiple manifests → ask PO which one. (Manifests typically have a `kit_version` field at the top.)
   - None found → STOP. Tell PO: "No manifest found. This project doesn't appear to be applied via ai-agent-kit."

2. Extract `kit_version` from the manifest. This is `CURRENT_VERSION`.

3. If no `kit_version` field exists:
   - Search all `*.yaml` / `*.yml` files in the project root for a `kit_version:` line.
   - If still absent → assume `1.0.0`. Tell PO: "No `kit_version` found — assuming 1.0.0. Continue? (yes/no)". Stop on no.

---

## PHASE 1 — Fetch changelog

4. Fetch `RAW_BASE/docs/migration/changelog.yaml`. Parse as YAML.
5. The structure is:
   ```yaml
   versions:
     - version: "1.1.0"
       released: "..."
       breaking: false
       description: "..."
       files_changed: [list of paths under target dir]
       manifest_changes:
         added_fields:
           - path: "stack.formatter_v2"
             default: <yaml value>
             description: "..."
         profile_transforms:                # optional, processed in order
           - rename:
               from: kotlin-multiplatform
               to: [kotlin-gradle, compose-multiplatform]   # 1→N split allowed
           - ensure: [security-baseline]    # add to stack.profiles[] if missing
           - ensure_axis:                   # add a default profile if no profile of the axis is present
               axis: provider
               default: routerai
     - version: "1.0.0"
       ...
   ```
   `versions[0]` is always the latest.

6. If `CURRENT_VERSION == versions[0].version` → "Already up to date." STOP.

7. Build `MIGRATION_PATH`: all entries in `versions[]` whose version is **strictly greater** than `CURRENT_VERSION` and **less than or equal to** `versions[0].version`. Sort oldest-first (chronological).

If fetch fails on both raw and `https://github.com/{KIT_REPO}/blob/master/docs/migration/changelog.yaml` → STOP. "Cannot reach changelog. Check internet connection or `KIT_REPO` value."

---

## PHASE 2 — Show migration plan

8. Compose and present:

   ```
   ## ai-agent-kit Update Plan

   **Project:**         <manifest.project.name>
   **Current version:** <CURRENT_VERSION>
   **Target version:**  <versions[0].version>
   **Migration path:**  <list of versions in order, e.g. 1.0.0 → 1.1.0 → 1.2.0>

   ### Breaking Changes
   <For each entry in MIGRATION_PATH where breaking == true: list version + description.>
   <If none: write "None.">

   ### New Manifest Fields
   <For each entry in MIGRATION_PATH, list each manifest_changes.added_fields[*]:
    - path, default, description.
    Include version tag for each.>

   ### Profile Transforms
   <For each entry in MIGRATION_PATH, list each manifest_changes.profile_transforms[*]:
    - rename:      "<from> → <to1>, <to2>"
    - ensure:      "<list>"
    - ensure_axis: "<axis> ← <default> (only if no profile of that axis is currently selected)"
    If none across the migration path: write "None.">

   ### Files That Will Be Overwritten
   <Union of files_changed across all MIGRATION_PATH entries. List relative paths.
    These files will be REWRITTEN — local customizations will be lost unless committed.
    PO-managed content in <vault_path>/ (anything outside <vault_path>/_templates/ and <vault_path>/_INDEX.md,
    where vault_path = manifest.vault_path, default "vault"), .planning/CURRENT.md, .planning/tasks/, and .planning/HISTORY.md will NOT be touched.>
   ```

9. Ask PO: "Proceed with update? (yes / no)". Stop on no.

---

## PHASE 2.5 — Pre-render manifest migration (one-shot)

**v4.0.0 host axis migration.** If `CURRENT_VERSION < 4.0.0` AND the manifest has a top-level `editors:` field but no `hosts:` field, this is a pre-v4 manifest:

1. Read `editors` (always `[opencode]` in pre-v4 since that was the only allowed value).
2. Set `manifest.hosts = editors` (same values — `opencode` is identical in both fields).
3. Delete the `editors` field from the manifest.
4. Add `opencode` to `stack.profiles[]` if it is not already present (it represents the new `host`-axis profile that was implicit before v4).
5. The old top-level `provider` and `models` blocks remain — they are still required when `opencode` ∈ `hosts`. Leave them untouched.
6. If PO opts in to Claude Code dual-host (advanced): tell PO they can run `/kit-extend https://github.com/{KIT_REPO}/blob/master/profiles/host/claude-code.yaml` after this update completes to add the `claude-code` host. The auto-update keeps the project OpenCode-only by default.

After this step, the manifest must validate against the v4.0.0 `manifest.schema.json` (with `hosts: [opencode]`). The remaining changelog-driven `added_fields` and `profile_transforms` (from PHASE 4) apply on top of this normalized manifest.

For migrations crossing version 4.0.0, this step ensures PHASE 3's per-host rendering has a valid `manifest.hosts` to iterate over.

---

## PHASE 3 — Re-apply with merge

This is the same render-and-write flow as `setup.md` PHASE 3, but with **merge mode**: kit-managed files are overwritten, PO-managed files are preserved.

### 3.1. Build the rendering context

Compute the same `{{VAR}}` table as documented in `setup.md` PHASE 3.1, using values from the existing manifest (do not ask PO again — assume the manifest is the source of truth for project values).

Add `KIT_REPO` (from constants above) so `commands/kit-update.md` renders correctly.

### 3.2. Discover all kit files

Fetch `RAW_BASE/kit/_index.txt`.

### 3.3. Classify each kit file by host

Use the same classification table as setup.md 3.3: files under `kit/.opencode/` render only if `opencode` ∈ `manifest.hosts`; files under `kit/.claude/` render only if `claude-code` ∈ hosts; files under `kit/_shared/` are not written directly — they are only inlined via INCLUDE; root files (`AGENTS.md.template`, `CLAUDE.md.template`, `opencode.json.template`, `kit/.claude/settings.json.template`, `kit/.mcp.json.template`) are host-scoped accordingly. `kit/.mcp.json.template` is additionally gated on at least one MCP server being `enabled: true` (when all are disabled, do not write `.mcp.json` and remove a stale one if present).

### 3.4. Resolve INCLUDEs

Use the same `{{INCLUDE: <path>}}` resolution algorithm as setup.md 3.4 (recursive, max depth 5, path-escape guard). Apply BEFORE the `{{VAR}}` substitution pass.

### 3.5. Render and write — merge mode

For each non-`_shared/` kit file (per host):

1. Fetch raw content from `RAW_BASE/<kit-path>`.
2. Resolve INCLUDEs (3.4).
3. Substitute `{{VARNAME}}` patterns using the host's substitution map (see setup.md 3.1 for the host overlay).
4. Compute target path: drop `kit/` prefix; for `_shared/...` re-route to `<target>/<H.template_dir>/...`; rewrite `.vault/` → `<manifest.vault_path>/`; drop `.template` suffix.
5. **Skip these target paths even if they appear in the index** (PO-managed runtime state):
   - `<target>/.planning/CURRENT.md`
   - `<target>/.planning/HISTORY.md`
   - `<target>/.planning/tasks/*.md` and `<target>/.planning/tasks/done/*.md` — active and archived task state files.
   - Any content under `<target>/<vault_path>/{concepts,reference,how-to,tutorials,guidelines}/**` created by PO/agents — but `<target>/<vault_path>/_templates/` and `<target>/<vault_path>/_INDEX.md` ARE kit-managed and DO get overwritten.
6. Write the file. Create parent dirs as needed.

Iterate over each host in `manifest.hosts` and run steps 1-6 with that host's substitution map. Universal scaffold (`.planning/`, vault) is rendered once with the first host's map.

### 3.6. Render nested module instruction files — merge mode

Same as setup.md 3.7. For each module and each host: render `kit/nested/MODULE.body.md.template` with the per-module + host context, write to `<target>/<source_root>/<H.instruction_file>`. Overwrite existing.

### 3.7. Vault scaffold — only fill missing dirs

Re-run the directory scaffold from setup.md 3.9. Skip any directory that already exists.

### 3.8. Update .gitignore — append missing lines (v6.1+)

Re-run setup.md 3.8 in *append-only* mode: for each line listed in setup.md 3.8, check if it is already present in `<target>/.gitignore` (string match, ignoring leading/trailing whitespace). If absent, append it. Never remove existing lines — PO may have edited the file. The exact set of lines to ensure (kept in sync with setup.md 3.8):

```
.planning/CURRENT.md
.planning/REPO_MAP.md
.planning/.session-bootstrap.md
.planning/MORNING_REPORT.md
```

This is the only mechanism by which existing installs receive new gitignore entries when the kit version they update to introduces new local artifacts. Skipping this step on a v6.0 → v6.1 update would commit `.session-bootstrap.md` / `MORNING_REPORT.md` files into the project repo, which contain per-developer state.

---

## PHASE 4 — Update manifest

10. Set `manifest.kit_version` to `versions[0].version`.

11. For each version in `MIGRATION_PATH`, for each `manifest_changes.added_fields[*]`:
    - If `path` (e.g. `formatter.environment`) is NOT present in the current manifest → add it with the documented `default`. Append a comment `# NEW in v<version>: <description>` on the same line (or directly above for multi-line values).
    - If already present → leave PO's value alone.

11b. **Apply profile transforms** — for each version in `MIGRATION_PATH`, for each entry in `manifest_changes.profile_transforms` (in declared order):

   Operate on `manifest.stack.profiles` (a list of profile name strings). Treat the list as ordered but deduplicated; preserve order on insert.

   **First, build a name→axis map** by fetching `https://api.github.com/repos/{KIT_REPO}/git/trees/master?recursive=1` and filtering paths matching `^profiles/(language|framework|host|provider|capability)/([^/]+)\.yaml$` (axis = group 1, name = group 2). One call resolves every profile's axis without parsing YAML.

   Then apply each transform:

   - `rename: {from: <X>, to: [<Y1>, <Y2>, ...]}` — find the first occurrence of `<X>` in the list and replace it in place with `<Y1>, <Y2>, ...`. If `<X>` is not in the list → no-op. After substitution, dedupe while preserving order. Log: `"profile rename: <X> → <Y1>, <Y2>"`.
   - `ensure: [<P1>, <P2>, ...]` — for each `<Pn>`, if it is not already in the list, append it. Log: `"profile added: <Pn>"`.
   - `ensure_axis: {axis: <A>, default: <P>}` — using the name→axis map, check whether any profile currently in the list belongs to axis `<A>`. If none → append `<P>`. Log: `"axis <A> was empty — added <P>"`.

   After processing all transforms, validate every name in `stack.profiles` resolves to a real profile YAML:
   - If the name appears as a key in `manifest.stack.external_profiles` → HEAD that URL (after normalising `github.com/.../blob/...` → `raw.githubusercontent.com/...`). On 404, report and stop.
   - Else look up its axis in the kit-repo map built above and HEAD `RAW_BASE/profiles/<axis>/<name>.yaml`. If the name is missing from the map or the HEAD 404s → STOP and report.

   External profiles (those listed under `stack.external_profiles`) are NOT subject to `profile_transforms` — kit-side renames cannot rewrite a third-party profile. Skip them when applying renames.

12. Write the updated manifest back to its original file.

13. Re-validate against the latest schema:
    - Fetch `RAW_BASE/kit/manifest.schema.json`.
    - Validate. Report any errors as warnings (do not auto-fix; ask PO).

---

## PHASE 5 — Verify (per host)

For each host `H` in `manifest.hosts`:

14. **Host config file is valid JSON.** Read `<target>/<H.config_file>` (`opencode.json` for opencode, `.claude/settings.json` for claude-code). Parse. Verify all credential references use the safe-token form: `{env:VAR}` (OpenCode) or `${VAR}` (Claude Code). If a literal key is found — SECURITY ERROR, abort and warn PO.

15. **Mandatory agents present in `<target>/<H.template_dir>/agents/`:**
    - `opencode`: Main, CodeWriter, CodeReviewer, BugFixer, debugger, QA, TestRunner, Designer (optional), PromptEngineer, AutoApprover.
    - `claude-code`: same list **except Main** (the orchestrator content lives in `<target>/CLAUDE.md`).
    If `requirements-pipeline` is in `manifest.stack.profiles`, also: BusinessAnalyst, CornerCaseReviewer, SystemAnalyst, CoverageChecker, ConsistencyChecker.

16. **Host instruction file present.** `<target>/<H.instruction_file>` (`AGENTS.md` for opencode, `CLAUDE.md` for claude-code) exists and is non-empty.

After all hosts:

16a. Grep the target tree for any remaining `\{\{[A-Z_]+\}\}` or `\{\{INCLUDE:` patterns. List them per file as warnings (PO may need to fill manually or re-fetch).

17. Run smoke commands from the manifest (best-effort, don't block on failure):
    - `<manifest.stack.compile_command>` — report PASS / FAIL.
    - `<manifest.stack.test_command>` (substitute first module name for `[module]`) — report PASS / FAIL.

---

## PHASE 6 — Summary

Print exactly:

```
═══════════════════════════════════════════════════
ai-agent-kit UPDATED SUCCESSFULLY
═══════════════════════════════════════════════════

Old version:  <CURRENT_VERSION>
New version:  <versions[0].version>

New capabilities:
  <bullet list pulled from each MIGRATION_PATH entry's description>

Manifest fields added:
  <list of newly-added fields with their defaults>

Files updated: <count>

Breaking changes applied: <yes — list / "None">

Next steps:
  1. Review changes:    git diff
  2. If any customizations were overwritten: restore from git history
  3. Test compile:      <manifest.stack.compile_command>
  4. Run tests:         <manifest.stack.test_command, with first module substituted>
  5. Commit:            git add . && git commit -m "chore: update ai-agent-kit to <new>"
```

Then return control.

---

## Safety rules

- **NEVER modify files outside the target project root.**
- **NEVER delete user files.** Merge mode only overwrites kit-managed files.
- **NEVER touch `<vault_path>/` content created by PO/agents** — only `<vault_path>/_templates/` and `<vault_path>/_INDEX.md` are kit-managed (vault_path = `manifest.vault_path`, default `vault`).
- **NEVER touch `.planning/CURRENT.md`, `.planning/tasks/*.md`, `.planning/tasks/done/*.md`, or `.planning/HISTORY.md`** — runtime state, not kit content.
- **ALWAYS preserve `kit_version`** by explicitly setting it in PHASE 4.
- **STOP if `provider.api_key_env` looks like a real key** (32+ chars with letters+digits+special, or matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`).
- **STOP if any kit file 404s** — report the exact URL and ask PO whether `KIT_REPO` is correct.
